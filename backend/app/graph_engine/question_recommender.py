"""
Question recommender — selects the best MCQ for a given concept/session context.

Scoring factors:
  - Concept match (required)
  - Difficulty ↔ mastery alignment
  - Bloom level progression
  - Avoids recently seen questions (cooldown)
"""
from __future__ import annotations

import random
from typing import Any, Optional

from app.graph_engine.concept_graph import CONCEPTS

# Bloom level ordering (lower index = simpler)
BLOOM_ORDER = ["remember", "understand", "apply", "analyze", "evaluate", "create"]

# Difficulty scoring
DIFFICULTY_SCORE = {"easy": 0, "medium": 1, "hard": 2}


def _mastery_to_target_difficulty(mastery: float) -> str:
    """Map mastery level to the right challenge difficulty."""
    if mastery < 0.3:
        return "easy"
    if mastery < 0.65:
        return "medium"
    return "hard"


def select_question(
    concept: str,
    questions: list[dict[str, Any]],
    mastery: float = 0.0,
    emotion: str = "FOCUSED",
    focus: float = 60.0,
    seen_ids: Optional[set[str]] = None,
) -> Optional[dict[str, Any]]:
    """
    Pick the single best question for `concept` given current student state.

    `questions` is a list of dicts with at minimum:
        id, concept, difficulty, bloom_level, question_text, options, correct_answer
    """
    seen_ids = seen_ids or set()

    # Filter to concept and unseen
    candidates = [
        q for q in questions
        if q.get("concept") == concept and q.get("id") not in seen_ids
    ]

    if not candidates:
        # Relax: allow seen questions if no unseen ones exist
        candidates = [q for q in questions if q.get("concept") == concept]

    if not candidates:
        return None

    target_diff = _mastery_to_target_difficulty(mastery)

    # Adjust for emotion/focus
    if emotion == "SLEEPY" or focus < 35:
        target_diff = "easy"
    elif emotion == "BORED" and focus > 70:
        target_diff = "hard"

    concept_bloom = CONCEPTS.get(concept, {}).get("bloom", "apply")
    target_bloom_idx = BLOOM_ORDER.index(concept_bloom) if concept_bloom in BLOOM_ORDER else 2

    def _score(q: dict) -> float:
        diff_match = 1.0 if q.get("difficulty") == target_diff else 0.0
        bloom = q.get("bloom_level", "apply")
        bloom_idx = BLOOM_ORDER.index(bloom) if bloom in BLOOM_ORDER else 2
        bloom_match = 1.0 - abs(bloom_idx - target_bloom_idx) / len(BLOOM_ORDER)
        noise = random.uniform(0, 0.1)  # small noise to avoid deterministic repeats
        return diff_match * 0.6 + bloom_match * 0.3 + noise

    candidates.sort(key=_score, reverse=True)
    return candidates[0]


def select_questions_for_session(
    concept: str,
    questions: list[dict[str, Any]],
    n: int = 5,
    mastery: float = 0.0,
    emotion: str = "FOCUSED",
    focus: float = 60.0,
) -> list[dict[str, Any]]:
    """
    Select up to `n` questions for a full concept session.
    Progresses difficulty: starts at target, ramps up.
    """
    seen: set[str] = set()
    selected: list[dict[str, Any]] = []

    for _ in range(n):
        q = select_question(concept, questions, mastery=mastery,
                            emotion=emotion, focus=focus, seen_ids=seen)
        if q is None:
            break
        selected.append(q)
        seen.add(q["id"])
        # Simulate mastery increase after each correct attempt (optimistic)
        mastery = min(mastery + 0.1, 1.0)

    return selected
