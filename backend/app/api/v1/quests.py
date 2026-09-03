import math, random
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, timezone
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User, StudentProgress, SkillMastery
from app.models.quest import Quest, Question
from app.schemas.quest import (
    QuestOut, QuestStartResponse, AnswerRequest, AnswerResponse,
    HintResponse, QuestionOut
)
from app.intelligence.adaptive_engine import decide as adaptive_decide, clamp_difficulty
from app.graph_engine.concept_graph import CONCEPTS, recommend_next_concept, get_unlocks
from app.graph_engine.adaptive_engine import get_mastery_map, log_attempt
from app.graph_engine.knowledge_tracker import KnowledgeTracker
from app.graph_engine.question_recommender import select_question
from app.importers.csv_importer import load_questions, get_questions_for_concept

router = APIRouter(prefix="/quests", tags=["quests"])

# ─── XP helpers ───────────────────────────────────────────────────────────────
HINT_PENALTY   = [1.0, 0.80, 0.65, 0.50, 0.40]
DIFF_XP_MULT   = {"easy": 1.0, "medium": 1.2, "hard": 1.5}
LEVEL_THRESH   = lambda n: math.floor(100 * (n ** 1.6))


def _concept_by_id(concept_id: str) -> Optional[str]:
    for name, meta in CONCEPTS.items():
        if meta["id"] == concept_id or name == concept_id:
            return name
    return None


def _question_out_from_bank(q: dict, quest_id: str, hide_answer: bool = True) -> QuestionOut:
    return QuestionOut(
        id=q["id"],
        quest_id=quest_id,
        skill_id=q["concept"],
        question_text=q["question_text"],
        question_type="mcq",
        options=q["options"],
        correct_answer="" if hide_answer else q["correct_answer"],
        explanation="" if hide_answer else q["explanation"],
        hints=[{"tier": 0, "text": q["explanation"]}],
        difficulty=q["difficulty"],
        bloom_level=q["bloom_level"],
    )


def _quest_out_for_concept(concept: str, mastery: float, recommended: Optional[str]) -> QuestOut:
    meta = CONCEPTS[concept]
    status = "completed" if mastery >= 0.6 else "in_progress" if mastery > 0 else "not_started"
    if concept == recommended and status == "not_started":
        status = "in_progress"
    return QuestOut(
        id=meta["id"],
        title=f"{concept} Quest",
        description=f"Practice Python {concept.lower()} with adaptive questions from the concept graph.",
        subject=meta.get("subject", "Python"),
        base_difficulty=meta["difficulty"],
        question_count=len(get_questions_for_concept(concept)),
        xp_reward_base=meta["xp_reward"],
        min_level=max(1, meta["tier"] + 1),
        status=status,
        progress_pct=min(100, round(mastery * 100)),
        skill_name=concept,
    )

def compute_xp(base: int, difficulty: str, combo: int, hint_tier: int, focus: float = 50.0) -> int:
    focus_mult = 1.0 + 0.5 * max(0, (focus - 80) / 20) if focus > 80 else 1.0
    combo_mults = [1.0, 1.3, 1.6, 2.0, 2.5]
    combo_mult  = combo_mults[min(combo, 4)]
    hint_mult   = HINT_PENALTY[min(hint_tier, 4)]
    diff_mult   = DIFF_XP_MULT.get(difficulty, 1.0)
    return max(1, round(base * diff_mult * combo_mult * hint_mult * focus_mult))

async def _get_progress(db: AsyncSession, user_id: str, quest_id: str) -> Optional[StudentProgress]:
    r = await db.execute(
        select(StudentProgress).where(
            and_(StudentProgress.user_id == user_id, StudentProgress.quest_id == quest_id)
        )
    )
    return r.scalar_one_or_none()

async def _get_random_question(db: AsyncSession, quest_id: str, exclude_id: Optional[str] = None) -> Optional[Question]:
    q = select(Question).where(Question.quest_id == quest_id)
    if exclude_id:
        q = q.where(Question.id != exclude_id)
    r = await db.execute(q)
    questions = r.scalars().all()
    return random.choice(questions) if questions else None

# ─── Routes ───────────────────────────────────────────────────────────────────
@router.get("", response_model=list[QuestOut])
async def list_quests(
    subject: Optional[str] = None,
    difficulty: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    mastery_map = get_mastery_map(str(user.id))
    recommended = recommend_next_concept(mastery_map, emotion="FOCUSED", focus=60.0) or "Data Types"
    active_concepts = {
        concept for concept, mastery in mastery_map.items()
        if mastery > 0 or mastery >= 0.6
    }
    active_concepts.add(recommended)
    for concept, mastery in mastery_map.items():
        if mastery >= 0.6:
            active_concepts.update(get_unlocks(concept))

    ordered = [
        concept for concept in CONCEPTS
        if concept in active_concepts or mastery_map.get(concept, 0.0) >= 0.6
    ]
    if not ordered:
        ordered = [recommended]

    out = [_quest_out_for_concept(c, mastery_map.get(c, 0.0), recommended) for c in ordered]
    if subject:
        out = [q for q in out if q.subject == subject]
    if difficulty:
        out = [q for q in out if q.base_difficulty == difficulty]
    return out

    q = select(Quest).where(Quest.is_active == True)
    if subject:    q = q.where(Quest.subject == subject)
    if difficulty: q = q.where(Quest.base_difficulty == difficulty)
    result = await db.execute(q)
    quests = result.scalars().all()

    # Attach user progress
    prog_result = await db.execute(
        select(StudentProgress).where(StudentProgress.user_id == user.id)
    )
    progress_map = {p.quest_id: p for p in prog_result.scalars().all()}

    out = []
    for quest in quests:
        p = progress_map.get(quest.id)
        out.append(QuestOut(
            id=quest.id, title=quest.title, description=quest.description,
            subject=quest.subject, base_difficulty=quest.base_difficulty,
            question_count=quest.question_count, xp_reward_base=quest.xp_reward_base,
            min_level=quest.min_level,
            status=p.status if p else "not_started",
            progress_pct=p.progress_pct if p else 0,
        ))
    return out


@router.get("/{quest_id}", response_model=QuestOut)
async def get_quest(quest_id: str, db: AsyncSession = Depends(get_db),
                    user: User = Depends(get_current_user)):
    concept = _concept_by_id(quest_id)
    if concept:
        mastery_map = get_mastery_map(str(user.id))
        recommended = recommend_next_concept(mastery_map, emotion="FOCUSED", focus=60.0)
        return _quest_out_for_concept(concept, mastery_map.get(concept, 0.0), recommended)

    r = await db.execute(select(Quest).where(Quest.id == quest_id))
    quest = r.scalar_one_or_none()
    if not quest:
        raise HTTPException(404, "Quest not found")
    p = await _get_progress(db, user.id, quest_id)
    return QuestOut(
        id=quest.id, title=quest.title, description=quest.description,
        subject=quest.subject, base_difficulty=quest.base_difficulty,
        question_count=quest.question_count, xp_reward_base=quest.xp_reward_base,
        min_level=quest.min_level,
        status=p.status if p else "not_started",
        progress_pct=p.progress_pct if p else 0,
    )


@router.post("/{quest_id}/start", response_model=QuestStartResponse)
async def start_quest(quest_id: str, db: AsyncSession = Depends(get_db),
                      user: User = Depends(get_current_user)):
    concept = _concept_by_id(quest_id)
    if concept:
        p = await _get_progress(db, user.id, quest_id)
        if not p:
            p = StudentProgress(user_id=user.id, quest_id=quest_id,
                                status="in_progress", started_at=datetime.now(timezone.utc))
            db.add(p)
        else:
            p.status = "in_progress"
        await db.flush()
        mastery_map = get_mastery_map(str(user.id))
        q = select_question(
            concept=concept,
            questions=load_questions(),
            mastery=mastery_map.get(concept, 0.0),
            emotion="FOCUSED",
            focus=60.0,
            seen_ids=set(),
        )
        if not q:
            raise HTTPException(400, "No questions available for this concept")
        await db.commit()
        return QuestStartResponse(session_quest_id=p.id, first_question=_question_out_from_bank(q, quest_id))

    r = await db.execute(select(Quest).where(Quest.id == quest_id))
    quest = r.scalar_one_or_none()
    if not quest:
        raise HTTPException(404, "Quest not found")

    p = await _get_progress(db, user.id, quest_id)
    if not p:
        p = StudentProgress(user_id=user.id, quest_id=quest_id,
                             status="in_progress", started_at=datetime.now(timezone.utc))
        db.add(p)
    else:
        p.status = "in_progress"

    question = await _get_random_question(db, quest_id)
    if not question:
        raise HTTPException(400, "No questions available for this quest")

    qout = QuestionOut(
        id=question.id, quest_id=question.quest_id, skill_id=question.skill_id,
        question_text=question.question_text, question_type=question.question_type,
        options=question.options, correct_answer="",  # hide answer from client
        explanation="", hints=question.hints, difficulty=question.difficulty,
        bloom_level=question.bloom_level,
    )
    return QuestStartResponse(session_quest_id=p.id, first_question=qout)


@router.post("/{quest_id}/answer", response_model=AnswerResponse)
async def answer_question(
    quest_id: str, body: AnswerRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    concept = _concept_by_id(quest_id)
    if concept:
        questions = load_questions()
        question = next((q for q in questions if q["id"] == body.question_id), None)
        if not question:
            raise HTTPException(404, "Question not found")

        correct = body.answer.strip().upper() == question["correct_answer"].strip().upper()
        tracker = KnowledgeTracker.load(str(user.id))
        new_mastery = tracker.record_answer(
            concept,
            correct,
            focus_score=body.focus_score,
            time_ms=body.time_taken_ms,
            difficulty=question["difficulty"],
            emotion=body.emotion,
        )
        log_attempt(
            student_id=str(user.id),
            question_id=body.question_id,
            correct=correct,
            answer=body.answer,
            focus_score=body.focus_score,
            emotion=body.emotion,
            time_ms=body.time_taken_ms,
        )

        p = await _get_progress(db, user.id, quest_id)
        if not p:
            p = StudentProgress(user_id=user.id, quest_id=quest_id, started_at=datetime.now(timezone.utc))
            db.add(p)
        p.progress_pct = min(100, round(new_mastery * 100))
        p.status = "completed" if new_mastery >= 0.6 else "in_progress"
        if p.status == "completed" and not p.completed_at:
            p.completed_at = datetime.now(timezone.utc)

        combo = body.correct_streak + 1 if correct else 0
        xp = compute_xp(CONCEPTS[concept]["xp_reward"] // 5, question["difficulty"], combo, body.hint_tier_used, body.focus_score) if correct else 0
        if correct and xp > 0:
            user.xp_current += xp
            user.xp_total += xp
            thresh = LEVEL_THRESH(user.level + 1)
            if user.xp_current >= thresh:
                user.level += 1
                user.xp_current -= thresh
                user.xp_to_next = LEVEL_THRESH(user.level + 1)

        decision = adaptive_decide(
            focus=body.focus_score,
            emotion=body.emotion,
            correct_streak=body.correct_streak,
            wrong_streak=body.wrong_streak,
            current_difficulty=question["difficulty"],
        )
        target_diff = clamp_difficulty(decision.difficulty)
        concept_questions = [q for q in get_questions_for_concept(concept) if q["id"] != question["id"]]
        candidates = [q for q in concept_questions if q["difficulty"] == target_diff] or concept_questions
        next_q = random.choice(candidates) if candidates and new_mastery < 0.6 else None
        await db.commit()

        return AnswerResponse(
            correct=correct,
            xp_earned=xp,
            feedback="Correct! Well done." if correct else f"Incorrect. {question['explanation']}",
            explanation=question["explanation"],
            next_question=_question_out_from_bank(next_q, quest_id) if next_q else None,
            combo=combo,
            adaptation_applied={"action": decision.action, "message": decision.message} if decision.action else None,
        )

    r = await db.execute(select(Question).where(Question.id == body.question_id))
    question = r.scalar_one_or_none()
    if not question:
        raise HTTPException(404, "Question not found")

    correct = body.answer.strip().upper() == question.correct_answer.strip().upper()

    # Update progress
    p = await _get_progress(db, user.id, quest_id)
    if p:
        if correct:
            p.progress_pct = min(100, p.progress_pct + 20)

    # Update combo (stored in a simple session var — real impl uses Redis)
    # For MVP: derive combo from progress steps
    combo = (p.progress_pct // 20) if (p and correct) else 0

    # XP calc
    xp = compute_xp(question.quest_id and 10 or 10, question.difficulty, combo, body.hint_tier_used) if correct else 0

    # Update user XP
    if correct and xp > 0:
        user.xp_current += xp
        user.xp_total   += xp
        thresh = LEVEL_THRESH(user.level + 1)
        if user.xp_current >= thresh:
            user.level     += 1
            user.xp_current -= thresh
            user.xp_to_next = LEVEL_THRESH(user.level + 1)

    # Update skill mastery
    if question.skill_id:
        sm_r = await db.execute(
            select(SkillMastery).where(
                and_(SkillMastery.user_id == user.id, SkillMastery.skill_id == question.skill_id)
            )
        )
        sm = sm_r.scalar_one_or_none()
        if not sm:
            sm = SkillMastery(user_id=user.id, skill_id=question.skill_id)
            db.add(sm)
        diff_w = {"easy": 0.3, "medium": 0.6, "hard": 1.0}.get(question.difficulty, 0.6)
        if correct:
            sm.mastery = min(1.0, sm.mastery + diff_w * (1 - sm.mastery) * 0.10)
            sm.correct_count += 1
        else:
            sm.mastery = max(0.0, sm.mastery - diff_w * sm.mastery * 0.05)
            sm.wrong_count += 1
        sm.last_practiced = datetime.now(timezone.utc)

    # ── Adaptive engine: pick next difficulty ────────────────────────────────
    decision = adaptive_decide(
        focus=body.focus_score,
        emotion=body.emotion,
        correct_streak=body.correct_streak,
        wrong_streak=body.wrong_streak,
        current_difficulty=question.difficulty,
    )
    target_diff = clamp_difficulty(decision.difficulty)

    # Get next question filtered by adaptive difficulty (fallback to any)
    all_q_r = await db.execute(
        select(Question).where(
            Question.quest_id == quest_id,
            Question.id != question.id,
            Question.difficulty == target_diff,
        )
    )
    candidates = all_q_r.scalars().all()
    if not candidates:
        # Fallback: any question from the quest
        all_q_r2 = await db.execute(
            select(Question).where(
                Question.quest_id == quest_id,
                Question.id != question.id,
            )
        )
        candidates = all_q_r2.scalars().all()

    next_q = random.choice(candidates) if candidates else None
    next_qout = None
    if next_q and (p and p.progress_pct < 100):
        next_qout = QuestionOut(
            id=next_q.id, quest_id=next_q.quest_id, skill_id=next_q.skill_id,
            question_text=next_q.question_text, question_type=next_q.question_type,
            options=next_q.options, correct_answer="",
            explanation="", hints=next_q.hints, difficulty=next_q.difficulty,
            bloom_level=next_q.bloom_level,
        )

    adaptation_payload = None
    if decision.action:
        adaptation_payload = {"action": decision.action, "message": decision.message}

    return AnswerResponse(
        correct=correct,
        xp_earned=xp,
        feedback="Correct! Well done." if correct else f"Incorrect. {question.explanation}",
        explanation=question.explanation,
        next_question=next_qout,
        combo=combo,
        adaptation_applied=adaptation_payload,
    )


@router.get("/{quest_id}/hints/{tier}", response_model=HintResponse)
async def get_hint(quest_id: str, tier: int, db: AsyncSession = Depends(get_db),
                   _: User = Depends(get_current_user)):
    concept = _concept_by_id(quest_id)
    if concept:
        return HintResponse(
            hint_text=f"Review the core idea of {concept}: {CONCEPTS[concept]['description']}",
            xp_multiplier_remaining=HINT_PENALTY[min(tier + 1, 4)],
        )

    r = await db.execute(select(Question).where(Question.quest_id == quest_id))
    question = r.scalar_one_or_none()
    if not question or not question.hints:
        return HintResponse(hint_text="No hints available.", xp_multiplier_remaining=1.0)

    hints = question.hints
    safe_tier = min(tier, len(hints) - 1)
    hint_text = hints[safe_tier]["text"] if isinstance(hints[safe_tier], dict) else str(hints[safe_tier])
    return HintResponse(hint_text=hint_text, xp_multiplier_remaining=HINT_PENALTY[min(tier + 1, 4)])


@router.post("/{quest_id}/complete")
async def complete_quest(quest_id: str, db: AsyncSession = Depends(get_db),
                         user: User = Depends(get_current_user)):
    p = await _get_progress(db, user.id, quest_id)
    if p:
        p.status = "completed"
        p.progress_pct = 100
        p.completed_at = datetime.now(timezone.utc)
    return {"completed": True}
