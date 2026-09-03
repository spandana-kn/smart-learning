from __future__ import annotations

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.session_model import EmotionLog
from app.schemas.focus import EmotionDataOut

router = APIRouter(prefix="/emotions", tags=["emotions"])


def _normalize_emotion(emotion: str | None) -> str:
    value = (emotion or "").upper()
    if value == "SLEEPY":
        return "SLEEPY"
    if value in {"BORED", "DISENGAGED", "SAD"}:
        return "BORED"
    if value in {"FRUSTRATED", "ANGRY", "ANXIOUS", "DISGUST", "CONFUSED", "SURPRISE", "FEAR"}:
        return "BORED"
    return "FOCUSED"


@router.get("/live")
async def get_live_emotion(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lightweight polling endpoint — returns latest emotion snapshot."""
    r = await db.execute(
        select(EmotionLog)
        .where(EmotionLog.user_id == user.id)
        .order_by(EmotionLog.timestamp.desc())
        .limit(1)
    )
    log = r.scalar_one_or_none()
    if log:
        emotion = _normalize_emotion(log.emotion)
        return {
            "emotion": emotion,
            "confidence": log.confidence,
            "timestamp": log.timestamp.isoformat(),
            "stale": False,
        }
    return {"emotion": "BORED", "confidence": 0.0, "timestamp": None, "stale": True}


@router.get("/current", response_model=EmotionDataOut)
async def get_current_emotion(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = await db.execute(
        select(EmotionLog)
        .where(EmotionLog.user_id == user.id)
        .order_by(EmotionLog.timestamp.desc())
        .limit(1)
    )
    log = r.scalar_one_or_none()
    if log:
        emotion = _normalize_emotion(log.emotion)
        return EmotionDataOut(
            emotion=emotion, confidence=log.confidence,
            probabilities={emotion: log.confidence},
            since=log.timestamp.isoformat(),
        )
    return EmotionDataOut(
        emotion="BORED", confidence=0.0,
        probabilities={"BORED": 1.0},
        since=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/distribution")
async def get_emotion_distribution(
    days: int = 7,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    r = await db.execute(
        select(EmotionLog)
        .where(and_(EmotionLog.user_id == user.id, EmotionLog.timestamp >= since))
    )
    logs = r.scalars().all()

    if not logs:
        return {"BORED": 1.0}

    counts: dict[str, int] = {}
    for log in logs:
        emotion = _normalize_emotion(log.emotion)
        counts[emotion] = counts.get(emotion, 0) + 1

    total = sum(counts.values())
    return {k: round(v / total, 3) for k, v in counts.items()}
