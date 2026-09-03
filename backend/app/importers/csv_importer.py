"""
CSV question importer.

Reads quiz_questions.csv and returns a list of question dicts usable by
the question recommender.  Optionally seeds Neo4j (LIVE mode) with concept
nodes and edges from the concept graph.
"""
from __future__ import annotations

import csv
import os
import uuid
from pathlib import Path
from typing import Any

from app.db import neo4j_db
from app.graph_engine.concept_graph import CONCEPTS, PREREQUISITES, load_custom_content

CSV_PATH = Path(__file__).parent / "data" / "quiz_questions.csv"

_QUESTIONS: list[dict[str, Any]] = []
_LOADED = False


def load_questions(path: str | None = None) -> list[dict[str, Any]]:
    """Load questions from CSV (cached after first call)."""
    global _QUESTIONS, _LOADED
    if _LOADED:
        return _QUESTIONS

    csv_file = Path(path) if path else CSV_PATH
    if not csv_file.exists():
        return []

    with open(csv_file, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            _QUESTIONS.append({
                "id":           row["id"],
                "concept":      row["concept"],
                "difficulty":   row["difficulty"],
                "bloom_level":  row["bloom_level"],
                "question_text": row["question_text"],
                "options": [
                    {"label": "A", "text": row["option_a"], "is_correct": row["correct_answer"] == "A"},
                    {"label": "B", "text": row["option_b"], "is_correct": row["correct_answer"] == "B"},
                    {"label": "C", "text": row["option_c"], "is_correct": row["correct_answer"] == "C"},
                    {"label": "D", "text": row["option_d"], "is_correct": row["correct_answer"] == "D"},
                ],
                "correct_answer": row["correct_answer"],
                "explanation":   row["explanation"],
            })
    custom = load_custom_content()
    for q in custom.get("questions", []):
        options = q.get("options") or []
        if options and isinstance(options[0], str):
            labels = ["A", "B", "C", "D"]
            options = [
                {"label": labels[i], "text": text, "is_correct": labels[i] == q.get("correct_answer", "A")}
                for i, text in enumerate(options[:4])
            ]
        _QUESTIONS.append({
            "id": q["id"],
            "concept": q["concept"],
            "difficulty": q.get("difficulty", "easy"),
            "bloom_level": q.get("bloom_level", "apply"),
            "question_text": q["question_text"],
            "options": options,
            "correct_answer": q.get("correct_answer", "A"),
            "explanation": q.get("explanation", ""),
        })
    _LOADED = True
    return _QUESTIONS


def reload_questions() -> list[dict[str, Any]]:
    global _QUESTIONS, _LOADED
    _QUESTIONS = []
    _LOADED = False
    return load_questions()


def seed_neo4j_concepts() -> None:
    """
    Seed Neo4j with concept nodes and prerequisite edges.
    No-op in MOCK mode.
    """
    if neo4j_db.get_mode() != "LIVE":
        return

    for name, meta in CONCEPTS.items():
        neo4j_db.run_write(neo4j_db.CYPHER_SEED_CONCEPT, {
            "id":          meta["id"],
            "name":        name,
            "topic":       name,
            "difficulty":  meta["difficulty"],
            "bloom":       meta["bloom"],
            "tier":        meta.get("tier", 0),
            "xp_reward":   meta["xp_reward"],
            "description": meta["description"],
        })

    for src, dst in PREREQUISITES:
        src_id = CONCEPTS[src]["id"]
        dst_id = CONCEPTS[dst]["id"]
        neo4j_db.run_write(neo4j_db.CYPHER_SEED_PREREQUISITE, {
            "src_id": src_id,
            "dst_id": dst_id,
        })


def seed_neo4j_questions(questions: list[dict[str, Any]]) -> None:
    """Seed Neo4j with Question nodes.  No-op in MOCK mode."""
    if neo4j_db.get_mode() != "LIVE":
        return

    cypher = """
    MERGE (q:Question {id: $id})
    SET q.concept     = $concept,
        q.difficulty  = $difficulty,
        q.bloom_level = $bloom_level,
        q.text        = $text
    WITH q
    MATCH (c:Concept {name: $concept})
    MERGE (q)-[:TESTS]->(c)
    """
    for q in questions:
        neo4j_db.run_write(cypher, {
            "id":         q["id"],
            "concept":    q["concept"],
            "difficulty": q["difficulty"],
            "bloom_level": q["bloom_level"],
            "text":       q["question_text"],
        })


def get_questions_for_concept(concept: str) -> list[dict[str, Any]]:
    """Return all questions for a given concept name."""
    questions = load_questions()
    return [q for q in questions if q["concept"] == concept]


def get_all_concepts_in_bank() -> list[str]:
    """Return unique concept names present in the question bank."""
    questions = load_questions()
    return list({q["concept"] for q in questions})
