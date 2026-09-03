from __future__ import annotations

import math, random
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.boss import Boss, BossBattle
from app.models.quest import Question
from app.schemas.quest import QuestionOut
from app.intelligence.adaptive_engine import decide as adaptive_decide
from app.graph_engine.concept_graph import CONCEPTS
from app.graph_engine.adaptive_engine import get_mastery_map, log_attempt
from app.graph_engine.knowledge_tracker import KnowledgeTracker
from app.importers.csv_importer import load_questions, get_questions_for_concept

router = APIRouter(prefix="/boss", tags=["boss"])

PHASE_THRESHOLDS = [0.67, 0.33, 0.0]  # HP% where phases begin


def _concept_from_boss_id(boss_id: str) -> str | None:
    raw_id = boss_id.removeprefix("boss_")
    for name, meta in CONCEPTS.items():
        if meta["id"] == raw_id or name == raw_id:
            return name
    return None


def _dynamic_boss(concept: str, mastery: float) -> dict:
    meta = CONCEPTS[concept]
    difficulty_hp = {"easy": 160, "medium": 230, "hard": 320}
    sprite = {"easy": "python_sprite", "medium": "python_guardian", "hard": "python_overlord"}.get(meta["difficulty"], "default")
    return {
        "id": f"boss_{meta['id']}",
        "name": f"The {concept} Sentinel",
        "subject": meta.get("subject", "Python"),
        "concept": concept,
        "lore_text": f"A milestone challenge forged from your completed {concept} mastery.",
        "hp_total": difficulty_hp.get(meta["difficulty"], 230) + meta["tier"] * 15,
        "unlock_level": max(1, meta["tier"] + 1),
        "sprite_id": sprite,
        "mastery": round(mastery, 3),
    }


def _question_out_from_bank(q: dict) -> dict:
    return {
        "id": q["id"], "quest_id": CONCEPTS[q["concept"]]["id"], "skill_id": q["concept"],
        "question_text": q["question_text"], "question_type": "mcq",
        "options": q["options"], "correct_answer": "",
        "explanation": "", "hints": [{"tier": 0, "text": q["explanation"]}],
        "difficulty": q["difficulty"], "bloom_level": q["bloom_level"],
    }

def compute_damage(difficulty: str, combo: int, focus: float, phase: int, resp_ms: int) -> tuple[int, bool]:
    base = {"easy": 15, "medium": 25, "hard": 40}.get(difficulty, 20)
    combo_mult  = [1.0, 1.3, 1.6, 2.0, 2.5][min(combo, 4)]
    focus_mult  = 1.0 + 0.5 * (min(focus, 100) / 100)
    phase_mult  = [1.0, 1.2, 1.5][min(phase - 1, 2)]
    speed_mult  = 1.2 if resp_ms < 5000 else 1.0
    is_crit     = focus > 90 and random.random() < 0.20
    crit_mult   = 1.5 if is_crit else 1.0
    dmg = max(1, round(base * combo_mult * focus_mult * phase_mult * speed_mult * crit_mult))
    return dmg, is_crit

def get_phase(hp: int, hp_total: int) -> int:
    pct = hp / hp_total
    if pct > 0.67: return 1
    if pct > 0.33: return 2
    return 3


@router.get("/available")
async def list_bosses(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    mastery_map = get_mastery_map(str(user.id))
    unlocked = [
        concept for concept, mastery in mastery_map.items()
        if mastery >= 0.6 and (CONCEPTS[concept]["difficulty"] in ("medium", "hard") or CONCEPTS[concept]["tier"] >= 4)
    ]
    if unlocked:
        return [_dynamic_boss(concept, mastery_map.get(concept, 0.0)) for concept in unlocked]

    r = await db.execute(select(Boss))
    existing = r.scalars().all()
    return [] if existing else []


@router.post("/{boss_id}/start")
async def start_battle(
    boss_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    concept = _concept_from_boss_id(boss_id)
    if concept:
        boss = _dynamic_boss(concept, get_mastery_map(str(user.id)).get(concept, 0.0))
        concept_questions = get_questions_for_concept(concept)
        hard = [q for q in concept_questions if q["difficulty"] in ("medium", "hard")]
        question = random.choice(hard or concept_questions) if concept_questions else None
        if not question:
            raise HTTPException(400, "No questions available")

        battle = BossBattle(user_id=user.id, boss_id=boss_id,
                            boss_hp=boss["hp_total"], player_hp=100, phase=1, combo=0)
        db.add(battle)
        await db.flush()
        await db.commit()

        return {
            "battle_id": battle.id,
            "boss_hp": battle.boss_hp,
            "player_hp": battle.player_hp,
            "phase": battle.phase,
            "combo": battle.combo,
            "current_question": _question_out_from_bank(question),
        }

    r = await db.execute(select(Boss).where(Boss.id == boss_id))
    boss = r.scalar_one_or_none()
    if not boss:
        raise HTTPException(404, "Boss not found")

    # Get a random question for this boss's subject
    qr = await db.execute(
        select(Question).limit(100)
    )
    all_qs = qr.scalars().all()
    question = random.choice(all_qs) if all_qs else None
    if not question:
        raise HTTPException(400, "No questions available")

    battle = BossBattle(user_id=user.id, boss_id=boss.id,
                        boss_hp=boss.hp_total, player_hp=100, phase=1, combo=0)
    db.add(battle)
    await db.flush()

    return {
        "battle_id": battle.id,
        "boss_hp": battle.boss_hp,
        "player_hp": battle.player_hp,
        "phase": battle.phase,
        "combo": battle.combo,
        "current_question": _question_out(question),
    }


@router.post("/{boss_id}/attack")
async def attack(
    boss_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    battle_id   = body.get("battle_id")
    question_id = body.get("question_id")
    answer      = body.get("answer", "")
    resp_ms     = body.get("time_taken_ms", 8000)
    focus       = float(body.get("focus_score", 50.0))
    emotion     = body.get("emotion", "FOCUSED")
    correct_streak = int(body.get("correct_streak", 0))
    wrong_streak   = int(body.get("wrong_streak", 0))
    concept = _concept_from_boss_id(boss_id)

    if concept:
        br = await db.execute(select(BossBattle).where(BossBattle.id == battle_id))
        battle = br.scalar_one_or_none()
        if not battle:
            raise HTTPException(404, "Battle not found")

        question = next((q for q in load_questions() if q["id"] == question_id), None)
        if not question:
            raise HTTPException(404, "Question not found")

        boss = _dynamic_boss(concept, get_mastery_map(str(user.id)).get(concept, 0.0))
        correct = answer.strip().upper() == question["correct_answer"].strip().upper()

        damage_dealt = 0
        player_damage = 0
        is_crit = False
        attack_label = ""
        prev_phase = battle.phase

        if correct:
            battle.combo += 1
            dmg, is_crit = compute_damage(question["difficulty"], battle.combo, focus, battle.phase, resp_ms)
            damage_dealt = dmg
            battle.boss_hp = max(0, battle.boss_hp - dmg)
            attack_label = "⚡ CRITICAL HIT!" if is_crit else "🔥 Focus Boost!" if focus > 70 else f"Combo x{battle.combo}!" if battle.combo >= 3 else "Strike!"
        else:
            battle.combo = 0
            player_damage = 5 * battle.phase
            battle.player_hp = max(0, battle.player_hp - player_damage)
            attack_label = "Weak Attack..."

        tracker = KnowledgeTracker.load(str(user.id))
        tracker.record_answer(
            concept,
            correct,
            focus_score=focus,
            time_ms=resp_ms,
            difficulty=question["difficulty"],
            emotion=emotion,
        )
        log_attempt(str(user.id), question_id, correct, answer, focus, emotion, resp_ms)

        new_phase = get_phase(battle.boss_hp, boss["hp_total"])
        phase_changed = new_phase != prev_phase
        battle.phase = new_phase

        decision = adaptive_decide(
            focus=focus,
            emotion=emotion,
            correct_streak=correct_streak,
            wrong_streak=wrong_streak,
            current_difficulty=question["difficulty"],
        )
        target_diff = decision.difficulty
        concept_questions = [q for q in get_questions_for_concept(concept) if q["id"] != question_id]
        candidates = [q for q in concept_questions if q["difficulty"] == target_diff] or concept_questions
        next_q = random.choice(candidates) if candidates else None

        hint_suggestion = None
        if decision.show_hint:
            hint_suggestion = question["explanation"]

        battle_over = battle.boss_hp <= 0 or battle.player_hp <= 0
        outcome = None
        level_up = False
        if battle_over:
            outcome = "win" if battle.boss_hp <= 0 else "lose"
            battle.outcome = outcome
            battle.ended_at = datetime.now(timezone.utc)
            if outcome == "win":
                battle.xp_earned = 500
                user.xp_current += 500
                user.xp_total += 500
                thresh = math.floor(100 * (user.level + 1) ** 1.6)
                if user.xp_current >= thresh:
                    user.level += 1
                    user.xp_current -= thresh
                    level_up = True
        await db.commit()

        return {
            "correct": correct,
            "attack_label": attack_label,
            "damage_dealt": damage_dealt,
            "boss_hp_remaining": battle.boss_hp,
            "player_damage_taken": player_damage,
            "player_hp_remaining": battle.player_hp,
            "combo": battle.combo,
            "phase_changed": phase_changed,
            "new_phase": battle.phase,
            "is_crit": is_crit,
            "next_question": _question_out_from_bank(next_q) if next_q and not battle_over else None,
            "battle_over": battle_over,
            "outcome": outcome,
            "level_up": level_up,
            "hint_suggestion": hint_suggestion,
            "adaptation_action": decision.action,
        }

    br = await db.execute(select(BossBattle).where(BossBattle.id == battle_id))
    battle = br.scalar_one_or_none()
    if not battle:
        raise HTTPException(404, "Battle not found")

    qr = await db.execute(select(Question).where(Question.id == question_id))
    question = qr.scalar_one_or_none()
    if not question:
        raise HTTPException(404, "Question not found")

    br2 = await db.execute(select(Boss).where(Boss.id == boss_id))
    boss = br2.scalar_one_or_none()

    correct = answer.strip().upper() == question.correct_answer.strip().upper()

    damage_dealt  = 0
    player_damage = 0
    is_crit       = False
    attack_label  = ""
    prev_phase    = battle.phase

    if correct:
        battle.combo += 1
        dmg, is_crit = compute_damage(question.difficulty, battle.combo, focus, battle.phase, resp_ms)
        damage_dealt  = dmg
        battle.boss_hp = max(0, battle.boss_hp - dmg)
        # Attack label for UI
        if is_crit:
            attack_label = "⚡ CRITICAL HIT!"
        elif focus > 70:
            attack_label = "🔥 Focus Boost!"
        elif dmg >= 40:
            attack_label = "💥 Heavy Strike!"
        elif battle.combo >= 3:
            attack_label = f"🌀 Combo ×{battle.combo}!"
        else:
            attack_label = "⚔️ Strike!"
    else:
        battle.combo  = 0
        player_damage = 5 * battle.phase
        battle.player_hp = max(0, battle.player_hp - player_damage)
        attack_label  = "💨 Weak Attack…"

    new_phase    = get_phase(battle.boss_hp, boss.hp_total if boss else 300)
    phase_changed = new_phase != prev_phase
    battle.phase  = new_phase

    # ── Adaptive: pick next question difficulty ──────────────────────────────
    decision = adaptive_decide(
        focus=focus,
        emotion=emotion,
        correct_streak=correct_streak,
        wrong_streak=wrong_streak,
        current_difficulty=question.difficulty,
    )
    target_diff = decision.difficulty

    all_qr = await db.execute(
        select(Question).where(
            Question.id != question_id,
            Question.difficulty == target_diff,
        ).limit(30)
    )
    candidates = all_qr.scalars().all()
    if not candidates:
        all_qr2 = await db.execute(
            select(Question).where(Question.id != question_id).limit(30)
        )
        candidates = all_qr2.scalars().all()
    next_q = random.choice(candidates) if candidates else None

    # Hint suggestion when frustrated
    hint_suggestion = None
    if decision.show_hint and question.hints:
        hint_suggestion = question.hints[0].get("text", "") if isinstance(question.hints[0], dict) else str(question.hints[0])

    battle_over = battle.boss_hp <= 0 or battle.player_hp <= 0
    outcome = None
    level_up = False
    if battle_over:
        outcome = "win" if battle.boss_hp <= 0 else "lose"
        battle.outcome   = outcome
        battle.ended_at  = datetime.now(timezone.utc)
        if outcome == "win":
            battle.xp_earned  = 500
            user.xp_current  += 500
            user.xp_total    += 500
            # Check level up
            import math as _math
            thresh = _math.floor(100 * (user.level + 1) ** 1.6)
            if user.xp_current >= thresh:
                user.level += 1
                user.xp_current -= thresh
                level_up = True

    return {
        "correct":            correct,
        "attack_label":       attack_label,
        "damage_dealt":       damage_dealt,
        "boss_hp_remaining":  battle.boss_hp,
        "player_damage_taken": player_damage,
        "player_hp_remaining": battle.player_hp,
        "combo":              battle.combo,
        "phase_changed":      phase_changed,
        "new_phase":          battle.phase,
        "is_crit":            is_crit,
        "next_question":      _question_out(next_q) if next_q and not battle_over else None,
        "battle_over":        battle_over,
        "outcome":            outcome,
        "level_up":           level_up,
        "hint_suggestion":    hint_suggestion,
        "adaptation_action":  decision.action,
    }


def _question_out(q: Question) -> dict:
    return {
        "id": q.id, "quest_id": q.quest_id, "skill_id": q.skill_id,
        "question_text": q.question_text, "question_type": q.question_type,
        "options": q.options, "correct_answer": "",
        "explanation": "", "hints": q.hints,
        "difficulty": q.difficulty, "bloom_level": q.bloom_level,
    }
