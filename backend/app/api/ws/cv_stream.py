import json, asyncio
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.security import decode_token
from app.core.database import AsyncSessionLocal
from app.models.session_model import FocusLog, EmotionLog

ws_router = APIRouter()

# Import CV pipeline lazily to avoid import error if OpenCV missing
def _get_pipeline():
    try:
        from app.cv_engine.pipeline import CVPipeline
        return CVPipeline()
    except Exception:
        return None

_pipeline = None


def _pipeline_instance():
    global _pipeline
    if _pipeline is None:
        _pipeline = _get_pipeline()
    return _pipeline


def _process_frame_sync(pipeline, frame_bytes: bytes) -> dict:
    """Synchronous, CPU-bound entry point (decode -> cascades -> emotion -> focus).

    Runs entirely off the event loop via asyncio.to_thread — nothing in here
    may await, and nothing async-only (DB session, websocket.send) may be
    called from inside it.
    """
    return pipeline.process_frame(frame_bytes)


@ws_router.websocket("/ws/cv-stream")
async def cv_stream(
    websocket: WebSocket,
    session_id: str = Query(...),
    token: str = Query(...),
):
    user_id = decode_token(token)
    if not user_id:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await websocket.accept()
    pipeline = _pipeline_instance()

    # State tracked per WS connection
    state = {
        "focus_score": 0.0,
        "emotion": "FOCUSED",
        "learning_state": "PRODUCTIVE",
        "frame_count": 0,
        "focus_ema": 0.0,
        "combo": 0,
    }

    # Busy flag: only one frame is ever in flight for this connection.
    # A frame that arrives while the previous one is still being processed
    # (decode + cascades can take >650ms under load) is dropped rather than
    # queued, so the pipeline always works on the freshest frame available.
    is_processing = False

    async def flush_logs(focus: float, emotion: str, attention: float):
        async with AsyncSessionLocal() as db:
            db.add(FocusLog(
                session_id=session_id, user_id=user_id,
                score=focus, attention=attention,
                state=state["learning_state"],
            ))
            db.add(EmotionLog(
                session_id=session_id, user_id=user_id,
                emotion=emotion, confidence=0.8,
            ))
            await db.commit()

    async def handle_frame(frame_bytes: bytes):
        """Runs as its own task so the receive loop is never blocked on it."""
        nonlocal is_processing
        try:
            focus = state["focus_score"]
            emotion = state["emotion"]
            attention = 0.7

            if pipeline:
                try:
                    # The only CPU-bound (OpenCV) work happens inside this
                    # to_thread call, in a worker thread — the event loop
                    # stays free to keep servicing other connections/frames.
                    result = await asyncio.to_thread(_process_frame_sync, pipeline, frame_bytes)
                    focus      = result["focus_score"]
                    emotion    = result["emotion"]
                    attention  = result["attention"]
                    confidence = result.get("confidence", 0.8)
                    face_box   = result.get("face_box")
                    eye_boxes  = result.get("eye_boxes", [])
                    raw_scores = result.get("raw_scores", {})

                    await websocket.send_text(json.dumps({
                        "type": "VISION_UPDATE",
                        "payload": {
                            "face_box":   face_box,
                            "eye_boxes":  eye_boxes,
                            "emotion":    emotion,
                            "confidence": round(confidence, 3),
                            "raw_scores": raw_scores,
                        },
                    }))
                except Exception:
                    pass
            else:
                # No CV available — behavioural fallback: slowly converge to 60
                focus = state["focus_ema"] + 0.1 * (60 - state["focus_ema"])

            state["frame_count"] += 1

            # EMA smoothing
            alpha = 0.3
            state["focus_ema"] = alpha * focus + (1 - alpha) * state["focus_ema"]
            focus = round(state["focus_ema"], 1)

            state["focus_score"] = focus
            state["emotion"] = emotion
            state["learning_state"] = _classify_state(focus, emotion)

            await websocket.send_text(json.dumps({
                "type": "FOCUS_UPDATE",
                "payload": {
                    "score": focus,
                    "state": state["learning_state"],
                    "attention": round(attention, 2),
                },
            }))

            if state["frame_count"] % 3 == 0:
                await websocket.send_text(json.dumps({
                    "type": "EMOTION_UPDATE",
                    "payload": {"emotion": emotion, "confidence": 0.82},
                }))

            if state["frame_count"] % 10 == 0:
                asyncio.create_task(flush_logs(focus, emotion, attention))

            adaptation = _check_adaptation(state)
            if adaptation:
                await websocket.send_text(json.dumps({
                    "type": "ADAPTATION_EVENT",
                    "payload": adaptation,
                }))
        finally:
            is_processing = False

    try:
        while True:
            message = await asyncio.wait_for(websocket.receive(), timeout=30.0)

            if message["type"] == "websocket.disconnect":
                break

            frame_bytes = message.get("bytes")
            if frame_bytes is None:
                # Non-frame (text) messages aren't currently used by the
                # client for this endpoint — ignore rather than error.
                continue

            if is_processing:
                # Backend is still working on the previous frame: drop this
                # one immediately instead of buffering it. Buffering is what
                # produces the visual desync under load.
                continue

            is_processing = True
            asyncio.create_task(handle_frame(frame_bytes))

    except asyncio.TimeoutError:
        pass  # Connection idle
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WS error: {e}")


def _classify_state(focus: float, emotion: str) -> str:
    if emotion == "SLEEPY": return "FATIGUED"
    if focus >= 75 and emotion == "FOCUSED": return "FLOW"
    if focus >= 55: return "PRODUCTIVE"
    if focus >= 35: return "STRUGGLING"
    if focus < 20:  return "FATIGUED"
    if emotion == "BORED": return "DISENGAGED"
    return "PRODUCTIVE"


# Cooldown tracker (per session, in-memory)
_last_adaptation: dict[str, dict] = {}

def _check_adaptation(state: dict) -> Optional[dict]:
    import time
    sid = id(state)
    last = _last_adaptation.get(sid, {})
    now = time.time()

    focus = state["focus_score"]
    emotion = state["emotion"]

    rules = [
        ("FORCE_BREAK",       focus < 15,                              120, "Take a short break — your focus is very low."),
        ("WAKE_PROMPT",       emotion == "SLEEPY",                     90,  "Your eyes look closed — pause, blink, or take a short reset."),
        ("BOOST_ENCOURAGEMENT", focus > 80,                            180,  "You're in the zone! Keep this up!"),
        ("INCREASE_DIFFICULTY", emotion == "BORED" and focus > 70,     120,  "Boosting challenge level — you're ready!"),
    ]

    for action, condition, cooldown, message in rules:
        if condition and (now - last.get(action, 0)) > cooldown:
            _last_adaptation.setdefault(sid, {})[action] = now
            return {"action": action, "message": message}

    return None
