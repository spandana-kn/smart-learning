"""
Adaptive learning engine — combines graph traversal with emotion/focus signals.

Works in both LIVE (Neo4j) and MOCK (networkx) modes.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from app.db import neo4j_db
from app.graph_engine.concept_graph import (
    CONCEPTS,
    GRAPH,
    get_frontier,
    get_weak_prerequisites,
    recommend_next_concept,
    shortest_learning_path,
)

_MOCK_MASTERY: dict[str, dict[str, float]] = {}
_MOCK_ATTEMPTS: list[dict[str, Any]] = []


@dataclass
class AdaptiveDecision:
    recommended_concept: str
    reason: str
    weak_prerequisites: list[str] = field(default_factory=list)
    learning_path: list[str] = field(default_factory=list)
    action: Optional[str] = None          # "revise" | "advance" | "new"
    message: Optional[str] = None         # human-readable tip for the student


def get_mastery_map(student_id: str) -> dict[str, float]:
    """
    Pull per-concept mastery scores for a student.
    LIVE: Cypher query on Neo4j.
    MOCK: returns empty map (all concepts at 0).
    """
    if neo4j_db.get_mode() == "LIVE":
        rows = neo4j_db.run_query(
            neo4j_db.CYPHER_GET_MASTERY, {"student_id": student_id}
        )
        return {r["concept_name"]: float(r["mastery"]) for r in rows}
    return dict(_MOCK_MASTERY.get(student_id, {}))


def update_mastery(student_id: str, concept: str, score: float) -> None:
    """Persist mastery update."""
    if neo4j_db.get_mode() != "LIVE":
        _MOCK_MASTERY.setdefault(student_id, {})[concept] = round(float(score), 4)
        return
    meta = CONCEPTS.get(concept, {})
    neo4j_db.run_write(
        neo4j_db.CYPHER_SET_MASTERY,
        {
            "student_id": student_id,
            "concept_id": meta.get("id", concept.lower().replace(" ", "_")),
            "score": score,
        },
    )


def log_attempt(
    student_id: str,
    question_id: str,
    correct: bool,
    answer: str,
    focus_score: float,
    emotion: str,
    time_ms: int,
) -> None:
    """Log a question attempt."""
    if neo4j_db.get_mode() != "LIVE":
        _MOCK_ATTEMPTS.append({
            "student_id": student_id,
            "question_id": question_id,
            "correct": correct,
            "answer": answer,
            "focus_score": focus_score,
            "emotion": emotion,
            "time_ms": time_ms,
        })
        return
    neo4j_db.run_write(
        neo4j_db.CYPHER_LOG_ATTEMPT,
        {
            "student_id": student_id,
            "question_id": question_id,
            "correct": correct,
            "answer": answer,
            "focus_score": focus_score,
            "emotion": emotion,
            "time_ms": time_ms,
        },
    )


def get_attempt_history(student_id: str) -> list[dict[str, Any]]:
    if neo4j_db.get_mode() == "LIVE":
        rows = neo4j_db.run_query(
            """
            MATCH (s:Student {id: $student_id})-[a:ATTEMPTED]->(q:Question)-[:TESTS]->(c:Concept)
            RETURN c.name AS concept, a.correct AS correct,
                   a.focus_score AS focus_score, a.time_ms AS time_ms,
                   a.emotion AS emotion, a.timestamp AS timestamp
            ORDER BY a.timestamp ASC
            """,
            {"student_id": student_id},
        )
        return rows

    from app.importers.csv_importer import load_questions
    question_concepts = {q["id"]: q["concept"] for q in load_questions()}
    return [
        {**a, "concept": question_concepts.get(a["question_id"], "")}
        for a in _MOCK_ATTEMPTS
        if a["student_id"] == student_id and question_concepts.get(a["question_id"])
    ]


def _difficulty_rank(concept: str) -> int:
    return {"easy": 0, "medium": 1, "hard": 2}.get(CONCEPTS[concept]["difficulty"], 1)


def _candidate_reason(concept: str, emotion: str, focus: float, avg_time_ms: float, accuracy: float) -> str:
    diff = CONCEPTS[concept]["difficulty"]
    if emotion == "SLEEPY" or accuracy < 0.55:
        return "revision-safe option based on recent mistakes"
    if emotion == "BORED" and focus >= 65:
        return "challenge option because focus is high"
    if avg_time_ms > 20_000:
        return "lighter step because response time is high"
    if diff == "hard":
        return "advanced step unlocked by mastery"
    return "best prerequisite-ready next step"


def score_next_candidates(
    student_id: str,
    emotion: str = "FOCUSED",
    focus: float = 60.0,
    mastery_map: Optional[dict[str, float]] = None,
) -> list[dict[str, Any]]:
    mastery_map = mastery_map if mastery_map is not None else get_mastery_map(student_id)
    attempts = get_attempt_history(student_id)
    recent = attempts[-8:]
    accuracy = (
        sum(1 for a in recent if a.get("correct")) / len(recent)
        if recent else 0.75
    )
    avg_time_ms = (
        sum(float(a.get("time_ms") or 0) for a in recent) / len(recent)
        if recent else 12_000
    )
    frontier = get_frontier(set(), mastery_map=mastery_map)
    if not frontier:
        frontier = ["Data Types"]

    candidates: list[dict[str, Any]] = []
    for concept in frontier:
        mastery = mastery_map.get(concept, 0.0)
        diff_rank = _difficulty_rank(concept)
        reward = (1 - mastery) * 45
        reward += max(0, 8 - CONCEPTS[concept]["tier"]) * 1.5

        if emotion == "SLEEPY":
            reward += (2 - diff_rank) * 12
        elif emotion == "BORED" and focus >= 65:
            reward += diff_rank * 14
        else:
            reward += 8 if diff_rank <= 1 else 4

        if accuracy >= 0.8 and focus >= 70:
            reward += diff_rank * 8
        if accuracy < 0.55:
            reward += (2 - diff_rank) * 10
        if avg_time_ms > 20_000:
            reward += (2 - diff_rank) * 8
        if avg_time_ms < 8_000 and accuracy >= 0.75:
            reward += diff_rank * 6

        candidates.append({
            "concept": concept,
            "score": round(reward, 2),
            "mastery": round(mastery, 3),
            "difficulty": CONCEPTS[concept]["difficulty"],
            "tier": CONCEPTS[concept]["tier"],
            "reason": _candidate_reason(concept, emotion, focus, avg_time_ms, accuracy),
        })

    candidates.sort(key=lambda c: c["score"], reverse=True)
    return candidates[:4]


def get_learning_path_state(
    student_id: str,
    emotion: str = "FOCUSED",
    focus: float = 60.0,
) -> dict[str, Any]:
    mastery_map = get_mastery_map(student_id)
    attempts = get_attempt_history(student_id)
    covered = {concept for concept, mastery in mastery_map.items() if mastery >= 0.6}
    ordered: list[str] = []
    for attempt in attempts:
        concept = attempt.get("concept")
        if concept in covered and concept not in ordered:
            ordered.append(concept)
    for concept in CONCEPTS:
        if concept in covered and concept not in ordered:
            ordered.append(concept)

    start = "Data Types"
    if start not in ordered:
        ordered.insert(0, start)

    candidates = score_next_candidates(student_id, emotion=emotion, focus=focus, mastery_map=mastery_map)
    recommended = candidates[0]["concept"] if candidates else start

    return {
        "start_concept": start,
        "covered_order": ordered,
        "recommended_concept": recommended,
        "candidates": candidates,
        "mastery": mastery_map,
        "attempt_summary": {
            "attempts": len(attempts),
            "recent_accuracy": round(sum(1 for a in attempts[-8:] if a.get("correct")) / max(1, len(attempts[-8:])), 2),
            "recent_avg_time_ms": round(sum(float(a.get("time_ms") or 0) for a in attempts[-8:]) / max(1, len(attempts[-8:]))),
        },
    }


def decide_next(
    student_id: str,
    current_concept: Optional[str],
    emotion: str = "FOCUSED",
    focus: float = 60.0,
    mastery_map: Optional[dict[str, float]] = None,
) -> AdaptiveDecision:
    """
    Core adaptive decision:

    1. SLEEPY + weak prereqs exist     → revise weakest prerequisite
    2. focus < 35                       → easiest available concept
    3. BORED + focus > 70              → hardest available concept
    4. default                          → lowest-mastery frontier concept
    """
    if mastery_map is None:
        mastery_map = get_mastery_map(student_id)

    candidates = score_next_candidates(student_id, emotion=emotion, focus=focus, mastery_map=mastery_map)
    recommended = candidates[0]["concept"] if candidates else recommend_next_concept(mastery_map, emotion=emotion, focus=focus)

    # If nothing recommended, fall back to Data Types (starting point)
    if recommended is None:
        recommended = "Data Types"

    weak_prereqs: list[str] = []
    action = "new"
    message: Optional[str] = None
    path: list[str] = []

    if emotion == "SLEEPY" and current_concept:
        weak_prereqs = get_weak_prerequisites(current_concept, mastery_map)
        if weak_prereqs:
            recommended = weak_prereqs[0]
            action = "revise"
            message = (
                f"You seem sleepy. Let's revisit '{recommended}' "
                "to strengthen your foundation before moving on."
            )

    elif focus < 35:
        action = "easy"
        message = (
            f"Your focus is low — let's try something lighter: '{recommended}'."
        )

    elif emotion == "BORED" and focus > 70:
        action = "advance"
        message = (
            f"Feeling bored? Challenge yourself with '{recommended}'!"
        )

    else:
        current_mastery = mastery_map.get(recommended, 0.0)
        if current_mastery > 0:
            action = "continue"
            message = f"Keep building on '{recommended}' (mastery: {current_mastery:.0%})."
        else:
            action = "new"
            message = f"Time to start '{recommended}' — it's unlocked and ready!"

    # Build shortest path from current concept to recommended (if different)
    if current_concept and current_concept != recommended:
        path = shortest_learning_path(current_concept, recommended)

    return AdaptiveDecision(
        recommended_concept=recommended,
        reason=action,
        weak_prerequisites=weak_prereqs,
        learning_path=path,
        action=action,
        message=message,
    )


def get_teacher_bottlenecks() -> list[dict[str, Any]]:
    """
    LIVE: Cypher query for concepts blocking the most students.
    MOCK: static analysis using concept centrality.
    """
    if neo4j_db.get_mode() == "LIVE":
        return neo4j_db.run_query(neo4j_db.CYPHER_TEACHER_BOTTLENECKS)

    from app.graph_engine.concept_graph import concept_centrality
    centrality = concept_centrality()
    results = sorted(
        [{"concept_id": CONCEPTS[c]["id"], "name": c,
          "avg_mastery": 0.0, "blocking_count": round(v * 100, 1)}
         for c, v in centrality.items()],
        key=lambda x: x["blocking_count"],
        reverse=True,
    )
    return results[:10]
