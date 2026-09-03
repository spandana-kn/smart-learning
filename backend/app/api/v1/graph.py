"""
Graph-based adaptive learning API endpoints.

Endpoints:
  GET  /graph/visualization          — concept graph for react-force-graph-2d
  GET  /graph/next-concept           — recommended next concept to study
  POST /graph/attempt                — record a question attempt and update mastery
  GET  /graph/questions/{concept}    — get questions for a concept
  GET  /graph/next-question          — get the best next question
  GET  /graph/learning-path          — shortest path to a target concept
  GET  /graph/teacher/bottlenecks    — concepts blocking most students
  GET  /graph/mastery                — current student mastery map
"""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user
from app.models.user import User
from app.graph_engine.concept_graph import get_graph_json, shortest_learning_path
from app.graph_engine.adaptive_engine import decide_next, get_learning_path_state, get_mastery_map, log_attempt
from app.graph_engine.knowledge_tracker import KnowledgeTracker
from app.graph_engine.question_recommender import select_question, select_questions_for_session
from app.importers.csv_importer import load_questions, get_questions_for_concept

router = APIRouter(prefix="/graph", tags=["graph"])


# ── Schemas ────────────────────────────────────────────────────────────────

class AttemptIn(BaseModel):
    question_id: str
    concept: str
    correct: bool
    answer: str
    focus_score: float = 60.0
    emotion: str = "FOCUSED"
    time_ms: int = 0


class AttemptOut(BaseModel):
    new_mastery: float
    xp_earned: int
    next_concept: Optional[str]
    message: Optional[str]


# ── Visualization ──────────────────────────────────────────────────────────

@router.get("/visualization")
async def graph_visualization(
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Return concept graph nodes + links for react-force-graph-2d."""
    mastery = get_mastery_map(str(current_user.id))
    return get_graph_json(mastery_map=mastery)


# ── Mastery ────────────────────────────────────────────────────────────────

@router.get("/mastery")
async def get_mastery(
    current_user: User = Depends(get_current_user),
) -> dict[str, float]:
    """Return the student's current mastery map."""
    return get_mastery_map(str(current_user.id))


# ── Adaptive recommendations ───────────────────────────────────────────────

@router.get("/next-concept")
async def next_concept(
    current_concept: Optional[str] = Query(None),
    emotion: str = Query("FOCUSED"),
    focus: float = Query(60.0),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Return the recommended next concept to study."""
    decision = decide_next(
        student_id=str(current_user.id),
        current_concept=current_concept,
        emotion=emotion,
        focus=focus,
    )
    return {
        "recommended_concept": decision.recommended_concept,
        "action": decision.action,
        "message": decision.message,
        "weak_prerequisites": decision.weak_prerequisites,
        "learning_path": decision.learning_path,
    }


@router.get("/path-state")
async def path_state(
    emotion: str = Query("FOCUSED"),
    focus: float = Query(60.0),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Return personalized learning path order and next-topic candidates."""
    return get_learning_path_state(str(current_user.id), emotion=emotion, focus=focus)


@router.get("/next-question")
async def next_question(
    concept: str = Query(...),
    emotion: str = Query("FOCUSED"),
    focus: float = Query(60.0),
    seen_ids: str = Query(""),
    current_user: User = Depends(get_current_user),
) -> Optional[dict[str, Any]]:
    """Return the best next question for a concept."""
    mastery_map = get_mastery_map(str(current_user.id))
    mastery = mastery_map.get(concept, 0.0)
    seen = set(seen_ids.split(",")) if seen_ids else set()
    questions = load_questions()
    q = select_question(
        concept=concept,
        questions=questions,
        mastery=mastery,
        emotion=emotion,
        focus=focus,
        seen_ids=seen,
    )
    return q


@router.get("/questions/{concept}")
async def concept_questions(
    concept: str,
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Return all questions for a given concept."""
    return get_questions_for_concept(concept)


@router.get("/session-questions")
async def session_questions(
    concept: str = Query(...),
    n: int = Query(5, ge=1, le=20),
    emotion: str = Query("FOCUSED"),
    focus: float = Query(60.0),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Return a curated set of questions for a full concept session."""
    mastery_map = get_mastery_map(str(current_user.id))
    mastery = mastery_map.get(concept, 0.0)
    questions = load_questions()
    return select_questions_for_session(
        concept=concept,
        questions=questions,
        n=n,
        mastery=mastery,
        emotion=emotion,
        focus=focus,
    )


# ── Attempt recording ──────────────────────────────────────────────────────

@router.post("/attempt")
async def record_attempt(
    body: AttemptIn,
    current_user: User = Depends(get_current_user),
) -> AttemptOut:
    """Record a question attempt and update mastery."""
    tracker = KnowledgeTracker.load(str(current_user.id))
    questions = load_questions()
    question = next((q for q in questions if q["id"] == body.question_id), None)
    difficulty = question.get("difficulty", "medium") if question else "medium"
    new_mastery = tracker.record_answer(
        body.concept,
        body.correct,
        focus_score=body.focus_score,
        time_ms=body.time_ms,
        difficulty=difficulty,
        emotion=body.emotion,
    )

    log_attempt(
        student_id=str(current_user.id),
        question_id=body.question_id,
        correct=body.correct,
        answer=body.answer,
        focus_score=body.focus_score,
        emotion=body.emotion,
        time_ms=body.time_ms,
    )

    from app.graph_engine.concept_graph import CONCEPTS
    xp = CONCEPTS.get(body.concept, {}).get("xp_reward", 50) if body.correct else 0

    decision = decide_next(
        student_id=str(current_user.id),
        current_concept=body.concept,
        emotion=body.emotion,
        focus=body.focus_score,
        mastery_map=tracker.snapshot(),
    )

    return AttemptOut(
        new_mastery=round(new_mastery, 3),
        xp_earned=xp,
        next_concept=decision.recommended_concept,
        message=decision.message,
    )


# ── Learning path ──────────────────────────────────────────────────────────

@router.get("/learning-path")
async def learning_path(
    start: str = Query(...),
    end: str = Query(...),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    """Return the shortest concept learning path from start to end."""
    return shortest_learning_path(start, end)


# ── Teacher analytics ──────────────────────────────────────────────────────

@router.get("/teacher/bottlenecks")
async def teacher_bottlenecks(
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Return concepts that are blocking the most learning progress."""
    from app.graph_engine.adaptive_engine import get_teacher_bottlenecks
    return get_teacher_bottlenecks()
