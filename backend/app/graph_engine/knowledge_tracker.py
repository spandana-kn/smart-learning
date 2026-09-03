"""
Knowledge state tracker — updates mastery after each quiz attempt.

Algorithm (EMA-based update):
    new_mastery = α × result + (1 - α) × old_mastery
    where α = 0.3 (recent performance weighted at 30%)

For streaks of correct answers, α rises to 0.45.
For repeated wrong answers, mastery can decay (floor: 0.0).
"""
from __future__ import annotations

from typing import Optional

from app.graph_engine.adaptive_engine import get_mastery_map, update_mastery

ALPHA_BASE = 0.3
ALPHA_STREAK = 0.45
MASTERY_FLOOR = 0.0
MASTERY_CEIL = 1.0


class KnowledgeTracker:
    """
    In-memory mastery tracker for a single student session.
    Writes back to Neo4j/SQLite after each answer.
    """

    def __init__(self, student_id: str, initial_map: Optional[dict[str, float]] = None):
        self.student_id = student_id
        self._map: dict[str, float] = dict(initial_map or {})
        self._streaks: dict[str, int] = {}  # consecutive correct answers per concept

    @classmethod
    def load(cls, student_id: str) -> "KnowledgeTracker":
        """Load mastery state from the graph database."""
        mastery = get_mastery_map(student_id)
        return cls(student_id, mastery)

    # ── Read ──────────────────────────────────────────────────────────────────

    def get(self, concept: str) -> float:
        return self._map.get(concept, 0.0)

    def snapshot(self) -> dict[str, float]:
        return dict(self._map)

    # ── Write ─────────────────────────────────────────────────────────────────

    def record_answer(
        self,
        concept: str,
        correct: bool,
        *,
        focus_score: float = 60.0,
        time_ms: int = 0,
        difficulty: str = "medium",
        emotion: str = "FOCUSED",
    ) -> float:
        """
        Update mastery for `concept` based on answer correctness.
        Returns the new mastery value.
        """
        old = self._map.get(concept, 0.0)
        streak = self._streaks.get(concept, 0)
        difficulty_weight = {"easy": 0.85, "medium": 1.0, "hard": 1.15}.get(difficulty, 1.0)
        focus_weight = 0.8 + 0.4 * max(0.0, min(100.0, focus_score)) / 100.0
        speed_weight = 1.0
        if time_ms > 0:
            if time_ms <= 8_000:
                speed_weight = 1.08
            elif time_ms >= 25_000:
                speed_weight = 0.9
        emotion_weight = {
            "FOCUSED": 1.08,
            "BORED": 0.9,
            "SLEEPY": 0.85,
        }.get(emotion, 1.0)

        if correct:
            streak += 1
            alpha = ALPHA_STREAK if streak >= 3 else ALPHA_BASE
            alpha = max(0.12, min(0.5, alpha * difficulty_weight * focus_weight * speed_weight * emotion_weight))
            new = old + alpha * (1.0 - old)
        else:
            streak = 0
            alpha = max(0.12, min(0.38, ALPHA_BASE * difficulty_weight * emotion_weight))
            new = old - alpha * old * 0.5  # softer decay than full alpha

        self._streaks[concept] = streak
        new = max(MASTERY_FLOOR, min(MASTERY_CEIL, new))
        self._map[concept] = round(new, 4)

        # Persist
        update_mastery(self.student_id, concept, new)
        return new

    def bulk_update(self, updates: dict[str, float]) -> None:
        """Directly set mastery values (e.g. from an import or reset)."""
        for concept, score in updates.items():
            score = max(MASTERY_FLOOR, min(MASTERY_CEIL, score))
            self._map[concept] = round(score, 4)
            update_mastery(self.student_id, concept, score)
