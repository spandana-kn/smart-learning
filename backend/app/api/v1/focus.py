import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.session_model import Session, FocusLog, EmotionLog
from app.schemas.focus import (
    FocusDataOut, EmotionDataOut, FocusHistoryPoint, HeatmapCell,
    InsightOut, SessionStartResponse, SessionEndResponse
)

router = APIRouter(prefix="/focus", tags=["focus"])

# In-memory session state for MVP (replace with Redis in prod)
_active_sessions: dict[str, dict] = {}


@router.get("/live")
async def get_live_focus(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lightweight polling endpoint — returns latest focus snapshot."""
    r = await db.execute(
        select(FocusLog)
        .where(FocusLog.user_id == user.id)
        .order_by(FocusLog.timestamp.desc())
        .limit(1)
    )
    log = r.scalar_one_or_none()
    if log:
        return {
            "score": log.score,
            "attention": log.attention,
            "state": log.state,
            "timestamp": log.timestamp.isoformat(),
            "stale": False,
        }
    return {"score": 0, "attention": 0, "state": "PRODUCTIVE", "timestamp": None, "stale": True}


@router.get("/current", response_model=FocusDataOut)
async def get_current_focus(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Return latest focus log for this user
    r = await db.execute(
        select(FocusLog)
        .where(FocusLog.user_id == user.id)
        .order_by(FocusLog.timestamp.desc())
        .limit(1)
    )
    log = r.scalar_one_or_none()
    if log:
        return FocusDataOut(score=log.score, attention=log.attention,
                             state=log.state, computed_at=log.timestamp.isoformat())
    return FocusDataOut(score=0, attention=0, state="PRODUCTIVE",
                        computed_at=datetime.now(timezone.utc).isoformat())


@router.get("/history", response_model=list[FocusHistoryPoint])
async def get_focus_history(
    days: int = 7,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    r = await db.execute(
        select(FocusLog)
        .where(and_(FocusLog.user_id == user.id, FocusLog.timestamp >= since))
        .order_by(FocusLog.timestamp.asc())
        .limit(500)
    )
    logs = r.scalars().all()

    # Join with emotion logs by session
    emotion_map: dict[str, str] = {}
    if logs:
        session_ids = list({l.session_id for l in logs})
        er = await db.execute(
            select(EmotionLog)
            .where(EmotionLog.session_id.in_(session_ids))
            .order_by(EmotionLog.timestamp.asc())
        )
        for elog in er.scalars().all():
            emotion_map[elog.session_id] = elog.emotion

    return [
        FocusHistoryPoint(
            timestamp=l.timestamp.isoformat(),
            score=l.score,
            emotion=emotion_map.get(l.session_id, "FOCUSED"),
            state=l.state,
        )
        for l in logs
    ]


@router.get("/heatmap", response_model=list[HeatmapCell])
async def get_heatmap(
    weeks: int = 8,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    since = datetime.now(timezone.utc) - timedelta(weeks=weeks)
    r = await db.execute(
        select(FocusLog)
        .where(and_(FocusLog.user_id == user.id, FocusLog.timestamp >= since))
        .order_by(FocusLog.timestamp.asc())
    )
    logs = r.scalars().all()

    # Group by date
    by_date: dict[str, list[float]] = {}
    for log in logs:
        d = log.timestamp.date().isoformat()
        by_date.setdefault(d, []).append(log.score)

    return [
        HeatmapCell(
            date=d,
            avg_score=sum(scores) / len(scores),
            study_minutes=len(scores) // 2,  # 1 log per 30s → /2 = minutes
        )
        for d, scores in sorted(by_date.items())
    ]


@router.get("/insights", response_model=list[InsightOut])
async def get_insights(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    since = datetime.now(timezone.utc) - timedelta(days=7)
    r = await db.execute(
        select(FocusLog)
        .where(and_(FocusLog.user_id == user.id, FocusLog.timestamp >= since))
        .order_by(FocusLog.timestamp.desc())
        .limit(200)
    )
    logs = r.scalars().all()

    insights: list[InsightOut] = []

    if not logs:
        insights.append(InsightOut(
            type="onboarding",
            message="Start a study session to unlock personalised insights!",
            severity="info",
        ))
        return insights

    scores = [l.score for l in logs]
    avg = sum(scores) / len(scores)

    if avg < 40:
        insights.append(InsightOut(
            type="low_focus",
            message=f"Your average focus this week is {avg:.0f}%. Try shorter 25-min sessions.",
            severity="warning",
            action="Enable Pomodoro mode in settings.",
        ))
    elif avg >= 70:
        insights.append(InsightOut(
            type="high_focus",
            message=f"Excellent! Your average focus is {avg:.0f}% this week.",
            severity="success",
        ))

    # Fatigue check: last 10 scores declining
    if len(scores) >= 10:
        recent = scores[:10]
        if recent[0] < recent[-1] - 15:
            insights.append(InsightOut(
                type="fatigue",
                message="Your focus has been declining in recent sessions.",
                severity="warning",
                action="Take a 10-minute break before your next session.",
            ))

    return insights


@router.post("/session/start", response_model=SessionStartResponse)
async def start_session(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = Session(user_id=user.id, cv_available=False)
    db.add(session)
    await db.flush()
    _active_sessions[session.id] = {
        "user_id": user.id, "focus_scores": [], "start": datetime.now(timezone.utc)
    }
    return SessionStartResponse(session_id=session.id)


@router.post("/session/end", response_model=SessionEndResponse)
async def end_session(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session_id = body.get("session_id", "")
    r = await db.execute(select(Session).where(Session.id == session_id))
    session = r.scalar_one_or_none()

    state = _active_sessions.pop(session_id, {})
    scores = state.get("focus_scores", [0])
    avg = sum(scores) / len(scores) if scores else 0
    peak = max(scores) if scores else 0
    duration = int((datetime.now(timezone.utc) - state["start"]).total_seconds()) if state.get("start") else 0

    if session:
        session.ended_at = datetime.now(timezone.utc)
        session.avg_focus_score = avg

    xp_bonus = int(avg * 0.15) if avg > 60 else 0

    return SessionEndResponse(
        duration_secs=duration,
        avg_focus=avg,
        peak_focus=peak,
        xp_from_focus=xp_bonus,
    )
