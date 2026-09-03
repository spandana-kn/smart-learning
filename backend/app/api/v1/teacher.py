from __future__ import annotations

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import case, select, and_, func
from app.core.database import get_db
from app.dependencies import require_teacher
from app.models.user import SkillMastery, StudentProgress, User
from app.models.session_model import FocusLog, EmotionLog, Session
from app.intelligence.teacher_engine import analyse as risk_analyse
from app.graph_engine.concept_graph import load_custom_content, save_custom_content, CONCEPTS
from app.importers.csv_importer import reload_questions

router = APIRouter(prefix="/teacher", tags=["teacher"])


def _normalize_emotion(emotion: str | None) -> str:
    value = (emotion or "").upper()
    if value == "SLEEPY":
        return "SLEEPY"
    if value in {"BORED", "DISENGAGED", "SAD"}:
        return "BORED"
    if value in {"FRUSTRATED", "ANGRY", "ANXIOUS", "DISGUST", "CONFUSED", "SURPRISE", "FEAR"}:
        return "BORED"
    return "FOCUSED"


class ContentSetupIn(BaseModel):
    subject: dict = {}
    topic: dict
    question: dict = {}
    questions: list[dict] = []
    quest: dict = {}
    boss: dict = {}


async def _student_risk(db: AsyncSession, student: User, since: datetime) -> dict:
    """Compute full risk profile for one student."""
    fr = await db.execute(
        select(func.avg(FocusLog.score)).where(
            and_(FocusLog.user_id == student.id, FocusLog.timestamp >= since)
        )
    )
    avg_focus = float(fr.scalar() or 0.0)

    # Emotion distribution
    er = await db.execute(
        select(EmotionLog).where(
            and_(EmotionLog.user_id == student.id, EmotionLog.timestamp >= since)
        )
    )
    emo_logs = er.scalars().all()

    emotion_counts: dict[str, int] = {}
    for e in emo_logs:
        emotion = _normalize_emotion(e.emotion)
        emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1

    total_emo = sum(emotion_counts.values()) or 1
    frustrated_pct = emotion_counts.get("SLEEPY", 0) / total_emo
    dominant_emotion = max(emotion_counts, key=emotion_counts.get) if emotion_counts else "FOCUSED"

    # Session count
    sr = await db.execute(
        select(func.count()).select_from(Session).where(
            and_(Session.user_id == student.id, Session.started_at >= since)
        )
    )
    sessions_7d = int(sr.scalar() or 0)

    profile = risk_analyse(
        avg_focus=avg_focus,
        streak_days=student.streak_days,
        dominant_emotion=dominant_emotion,
        frustrated_pct=frustrated_pct,
        sessions_last_7d=sessions_7d,
    )
    return profile, avg_focus, emotion_counts


async def _learning_summary(db: AsyncSession, student_id: str, since: datetime) -> dict:
    progress_r = await db.execute(
        select(StudentProgress).where(StudentProgress.user_id == student_id)
    )
    progress = progress_r.scalars().all()
    completed = [p.quest_id for p in progress if p.status == "completed" or p.progress_pct >= 100]
    in_progress = sorted(
        [p for p in progress if p.status == "in_progress" and p.progress_pct < 100],
        key=lambda p: p.progress_pct,
        reverse=True,
    )

    mastery_r = await db.execute(
        select(SkillMastery).where(SkillMastery.user_id == student_id)
    )
    mastery_by_skill = {m.skill_id: m.mastery for m in mastery_r.scalars().all()}
    concept_by_id = {meta["id"]: name for name, meta in CONCEPTS.items()}
    mastered_from_skill = [
        concept_by_id.get(skill_id, skill_id)
        for skill_id, mastery in mastery_by_skill.items()
        if mastery >= 0.6
    ]
    all_completed = []
    for concept in completed + mastered_from_skill:
        if concept and concept not in all_completed:
            all_completed.append(concept)

    face_r = await db.execute(
        select(
            func.count().label("total"),
            func.sum(case((FocusLog.attention > 0, 1), else_=0)).label("detected"),
        ).where(and_(FocusLog.user_id == student_id, FocusLog.timestamp >= since))
    )
    face_row = face_r.one()
    total_frames = int(face_row.total or 0)
    detected_frames = int(face_row.detected or 0)
    face_detection_rate = round((detected_frames / total_frames) * 100, 1) if total_frames else 0.0

    return {
        "topics_completed": len(all_completed),
        "completed_topics": all_completed[:12],
        "current_topic": in_progress[0].quest_id if in_progress else (all_completed[-1] if all_completed else "Data Types"),
        "current_progress_pct": in_progress[0].progress_pct if in_progress else (100 if all_completed else 0),
        "path_preview": all_completed[:5],
        "cv_sessions_7d": total_frames,
        "face_detection_rate": face_detection_rate,
    }


@router.get("/class")
async def get_class(
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    r = await db.execute(select(User).where(User.role == "student"))
    students = r.scalars().all()
    since = datetime.now(timezone.utc) - timedelta(days=7)
    result = []

    for s in students:
        profile, avg_focus, _ = await _student_risk(db, s, since)
        learning = await _learning_summary(db, s.id, since)
        result.append({
            "id": s.id,
            "name": s.full_name,
            "avatar_id": s.avatar_id,
            "level": s.level,
            "avg_focus_7d": round(avg_focus, 1),
            "streak_days": s.streak_days,
            "risk_level": profile.level,
            "risk_score": profile.score,
            "last_active": s.last_active.isoformat() if s.last_active else "",
            **learning,
        })

    return result


@router.get("/student/{student_id}")
async def get_student_detail(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    r = await db.execute(select(User).where(User.id == student_id))
    student = r.scalar_one_or_none()
    if not student:
        return {"error": "Not found"}

    since = datetime.now(timezone.utc) - timedelta(days=7)
    profile, avg_focus, emotion_dist = await _student_risk(db, student, since)
    learning = await _learning_summary(db, student.id, since)

    fr = await db.execute(
        select(FocusLog)
        .where(and_(FocusLog.user_id == student_id, FocusLog.timestamp >= since))
        .order_by(FocusLog.timestamp.asc())
        .limit(200)
    )
    focus_logs = fr.scalars().all()

    return {
        "id": student.id,
        "name": student.full_name,
        "level": student.level,
        "xp_total": student.xp_total,
        "avg_focus_7d": round(avg_focus, 1),
        "streak_days": student.streak_days,
        "risk_level": profile.level,
        "risk_score": profile.score,
        "risk_reasons": profile.reasons,
        "suggestions": profile.suggestions,
        "focus_history": [
            {"timestamp": l.timestamp.isoformat(), "score": l.score, "state": l.state}
            for l in focus_logs
        ],
        "emotion_distribution": emotion_dist,
        **learning,
    }


@router.get("/summary")
async def get_class_summary(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_teacher),
):
    """Aggregate stats for the teacher's overview panel."""
    since = datetime.now(timezone.utc) - timedelta(days=7)

    r = await db.execute(select(User).where(User.role == "student"))
    students = r.scalars().all()

    all_focus: list[float] = []
    for s in students:
        fr = await db.execute(
            select(func.avg(FocusLog.score)).where(
                and_(FocusLog.user_id == s.id, FocusLog.timestamp >= since)
            )
        )
        v = fr.scalar()
        if v: all_focus.append(float(v))

    class_avg = sum(all_focus) / len(all_focus) if all_focus else 0.0

    er = await db.execute(
        select(EmotionLog.emotion, func.count().label("cnt"))
        .where(EmotionLog.timestamp >= since)
        .group_by(EmotionLog.emotion)
    )
    emotion_dist: dict[str, int] = {}
    for row in er.all():
        emotion = _normalize_emotion(row.emotion)
        emotion_dist[emotion] = emotion_dist.get(emotion, 0) + row.cnt

    return {
        "total_students": len(students),
        "class_avg_focus": round(class_avg, 1),
        "emotion_distribution": emotion_dist,
    }


@router.get("/content")
async def get_content_setup(_: User = Depends(require_teacher)):
    custom = load_custom_content()
    return {
        "subjects": custom.get("subjects", []),
        "topics": custom.get("topics", []),
        "questions": custom.get("questions", []),
        "quests": custom.get("quests", []),
        "bosses": custom.get("bosses", []),
        "all_topics": [
            {"name": name, **meta}
            for name, meta in CONCEPTS.items()
        ],
    }


@router.post("/content")
async def save_content_setup(
    body: ContentSetupIn,
    _: User = Depends(require_teacher),
):
    payload = body.model_dump()
    topic_name = (payload.get("topic") or {}).get("name", "")
    incoming_questions = payload.get("questions") or []
    legacy_question = payload.get("question") or {}
    if legacy_question.get("question_text"):
        incoming_questions.append(legacy_question)
    boss_enabled = (payload.get("boss") or {}).get("enabled", False)
    if boss_enabled and not any(q.get("difficulty") == "hard" for q in incoming_questions):
        existing = [
            q for q in load_custom_content().get("questions", [])
            if q.get("concept") == topic_name and q.get("difficulty") == "hard"
        ]
        if not existing:
            raise HTTPException(400, "Boss fights need at least one hard question for this topic.")
    data = save_custom_content(payload)
    reload_questions()
    return {
        "saved": True,
        "topics": data.get("topics", []),
        "questions": data.get("questions", []),
        "message": "Content saved and published to the Skill Tree.",
    }
