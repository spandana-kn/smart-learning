"""
CVPipeline — single entry point for the CV subsystem.

Returns:
    {
        "focus_score":   float (0-100),
        "emotion":       str   (canonical label),
        "confidence":    float (0-1),
        "attention":     float (0-1),
        "face_detected": bool,
        "head_centered": bool,
        "eyes_open":     bool,
        "face_box":      dict | None  — {x,y,w,h} normalised 0-1
        "eye_boxes":     list         — [{x,y,w,h} normalised] up to 2
        "raw_scores":    dict         — {emotion_label: score} from HF / FER
    }
"""
import numpy as np

from app.cv_engine.attention_detector import AttentionDetector
from app.cv_engine.hf_emotion_detector import HFEmotionDetector
from app.cv_engine.emotion_engine import EmotionEngine
from app.cv_engine.focus_engine import get_focus_score


class CVPipeline:
    def __init__(self):
        self.attention      = AttentionDetector()
        self.hf_detector    = HFEmotionDetector()   # HF API + OpenCV boxes
        self.emotion_engine = EmotionEngine()        # heuristic fallback

    def process_frame(self, frame_bytes: bytes) -> dict:
        """Decode image bytes → run detectors → compute focus. Thread-safe."""
        try:
            frame_bgr = self._decode(frame_bytes)
        except Exception:
            return self._fallback()

        # ── Attention (face geometry) ────────────────────────────────────────
        attn = self.attention.detect(frame_bgr)
        face_detected   = attn["face_detected"]
        head_centered   = attn["head_centered"]
        eyes_open       = attn["eyes_open"]
        eyes_closed     = attn.get("eyes_closed", False)
        eye_count       = attn.get("eye_count", len(attn.get("eye_boxes", [])))
        attention_score = attn["attention_score"]
        attention_face_box = attn.get("face_box")
        attention_eye_boxes = attn.get("eye_boxes", [])

        # ── HF emotion + bounding boxes ──────────────────────────────────────
        hf = self.hf_detector.detect(frame_bgr)
        emotion    = hf["emotion"]
        confidence = hf["confidence"]
        face_box   = hf["face_box"]
        eye_boxes  = hf["eye_boxes"]
        raw_scores = hf["raw_scores"]

        if face_box is None and attention_face_box is not None:
            face_box = attention_face_box
        if not eye_boxes and attention_eye_boxes:
            eye_boxes = attention_eye_boxes

        emotion = self._normalize_emotion(
            emotion=emotion,
            face_detected=face_detected or (face_box is not None),
            attention_score=attention_score,
            head_centered=head_centered,
            eyes_open=eyes_open and not eyes_closed,
            eye_count=eye_count,
        )
        if emotion == "FOCUSED":
            confidence = max(confidence, min(0.92, max(attention_score, 0.62)))
        elif emotion == "BORED":
            confidence = max(confidence, 0.62)
        elif emotion == "SLEEPY":
            confidence = max(confidence, 0.88)

        # If HF gave no face but attention detector found one, use focused as a sane baseline
        if face_box is None and face_detected:
            emotion = "FOCUSED"
            confidence = 0.5

        # If neither found a face, use heuristic emotion engine
        if not face_detected and face_box is None:
            heur = self.emotion_engine.update(
                face_detected=False,
                head_centered=False,
                eyes_open=False,
                attention_score=0.0,
                face_cx=0.5,
                face_cy=0.5,
            )
            emotion    = self._normalize_emotion(
                emotion=heur["emotion"],
                face_detected=False,
                attention_score=0.0,
                head_centered=False,
                eyes_open=False,
                eye_count=0,
            )
            confidence = heur["confidence"]

        # ── Focus score ───────────────────────────────────────────────────────
        focus_score = get_focus_score(
            face_detected=face_detected or (face_box is not None),
            head_centered=head_centered,
            eyes_open=eyes_open and not eyes_closed,
            emotion=emotion,
        )

        return {
            "focus_score":   focus_score,
            "emotion":       emotion,
            "confidence":    round(confidence, 3),
            "attention":     attention_score,
            "face_detected": face_detected or (face_box is not None),
            "head_centered": head_centered,
            "eyes_open":     eyes_open and not eyes_closed,
            "face_box":      face_box,
            "eye_boxes":     eye_boxes,
            "raw_scores":    raw_scores,
        }

    @staticmethod
    def _normalize_emotion(
        emotion: str,
        face_detected: bool,
        attention_score: float,
        head_centered: bool,
        eyes_open: bool,
        eye_count: int = 2,
    ) -> str:
        if not face_detected:
            return "BORED"
        if not eyes_open:
            return "SLEEPY"

        # After reducing the emotion model, attention geometry should be the
        # source of truth. Many face-emotion models return "neutral/focused"
        # even when the learner is looking away, so classify low engagement as
        # BORED before trusting the model label.
        if attention_score < 0.68 or not head_centered or eye_count < 2:
            return "BORED"

        if emotion == "BORED":
            return "BORED"
        if emotion == "SLEEPY":
            return "SLEEPY"
        if emotion in {"SAD", "DISENGAGED", "ANGRY", "DISGUST", "FEAR", "SURPRISE", "ANXIOUS", "CONFUSED", "FRUSTRATED"}:
            return "BORED"
        if attention_score >= 0.55 and head_centered and eyes_open:
            return "FOCUSED"
        return "BORED"

    @staticmethod
    def _decode(frame_bytes: bytes) -> np.ndarray:
        import cv2
        arr = np.frombuffer(frame_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("cv2.imdecode returned None")
        return img

    @staticmethod
    def _fallback() -> dict:
        return {
            "focus_score":   50.0,
            "emotion":       "BORED",
            "confidence":    0.5,
            "attention":     0.5,
            "face_detected": False,
            "head_centered": False,
            "eyes_open":     False,
            "face_box":      None,
            "eye_boxes":     [],
            "raw_scores":    {},
        }
