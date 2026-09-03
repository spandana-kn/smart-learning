"""
Neo4j connection manager with graceful fallback.

Modes:
  LIVE   — real Neo4j instance (NEO4J_URI env var set and reachable)
  MOCK   — in-memory networkx graph (demo / CI / no Neo4j)

All public API methods work identically in both modes so the rest of
the codebase never needs to branch.

WHY GRAPH DB OVER RELATIONAL?
──────────────────────────────
In a relational model, "find all prerequisite concepts of Recursion up
to depth 4" requires 4 self-joins on a skill_prerequisites table.
In Neo4j that is a single Cypher clause:
    MATCH (c:Concept)-[:PREREQUISITE_OF*1..4]->(target {name:'Recursion'})
Graph DBs also store relationship properties (mastery score, timestamp)
directly on edges, making student-concept interactions O(1) lookups
instead of multi-table joins.
"""
from __future__ import annotations

import logging
import os
from typing import Any

log = logging.getLogger(__name__)

# ── Neo4j driver (optional) ────────────────────────────────────────────────
try:
    from neo4j import GraphDatabase, Driver
    _NEO4J_AVAILABLE = True
except ImportError:
    _NEO4J_AVAILABLE = False

_driver: Any = None
_mode: str = "MOCK"


def get_driver() -> Any:
    """Return the active driver (Neo4j or None for mock mode)."""
    return _driver


def get_mode() -> str:
    return _mode


def init_neo4j() -> str:
    """
    Try to connect to Neo4j.  Returns 'LIVE' or 'MOCK'.
    Call once at application startup.
    """
    global _driver, _mode

    uri  = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    user = os.getenv("NEO4J_USER", "neo4j")
    pw   = os.getenv("NEO4J_PASSWORD", "smartfocus123")

    if _NEO4J_AVAILABLE and uri:
        try:
            drv = GraphDatabase.driver(uri, auth=(user, pw))
            drv.verify_connectivity()
            _driver = drv
            _mode   = "LIVE"
            log.info("✅ Neo4j connected: %s  [LIVE mode]", uri)
        except Exception as exc:
            log.warning("Neo4j unavailable (%s) – falling back to MOCK mode", exc)
            _mode = "MOCK"
    else:
        reason = "neo4j package missing" if not _NEO4J_AVAILABLE else "NEO4J_URI not set"
        log.info("Neo4j MOCK mode (%s). Set NEO4J_URI to enable live graph.", reason)
        _mode = "MOCK"

    return _mode


def run_query(cypher: str, params: dict | None = None) -> list[dict]:
    """Execute a read Cypher query.  Returns [] in MOCK mode."""
    if _driver is None:
        return []
    params = params or {}
    with _driver.session() as session:
        result = session.run(cypher, params)
        return [dict(record) for record in result]


def run_write(cypher: str, params: dict | None = None) -> list[dict]:
    """Execute a write Cypher query.  Returns [] in MOCK mode."""
    if _driver is None:
        return []
    params = params or {}
    with _driver.session() as session:
        result = session.write_transaction(lambda tx: tx.run(cypher, params).data())
        return result or []


def close() -> None:
    global _driver
    if _driver:
        _driver.close()
        _driver = None


# ── Cypher helpers ─────────────────────────────────────────────────────────

CYPHER_SEED_CONCEPT = """
MERGE (c:Concept {id: $id})
SET c.name       = $name,
    c.topic      = $topic,
    c.difficulty = $difficulty,
    c.bloom      = $bloom,
    c.tier       = $tier,
    c.xp_reward  = $xp_reward,
    c.description = $description
"""

CYPHER_SEED_PREREQUISITE = """
MATCH (a:Concept {id: $src_id}), (b:Concept {id: $dst_id})
MERGE (a)-[:PREREQUISITE_OF]->(b)
MERGE (b)-[:UNLOCKS]->(a)
"""

CYPHER_SET_MASTERY = """
MERGE (s:Student {id: $student_id})
WITH s
MATCH (c:Concept {id: $concept_id})
MERGE (s)-[r:MASTERED]->(c)
SET r.score        = $score,
    r.updated_at   = datetime()
"""

CYPHER_SET_STRUGGLES = """
MATCH (s:Student {id: $student_id}), (c:Concept {id: $concept_id})
MERGE (s)-[r:STRUGGLES_WITH]->(c)
SET r.attempts     = $attempts,
    r.updated_at   = datetime()
"""

CYPHER_LOG_ATTEMPT = """
MERGE (s:Student {id: $student_id})
WITH s
MATCH (q:Question {id: $question_id})
CREATE (s)-[:ATTEMPTED {
    correct:     $correct,
    answer:      $answer,
    focus_score: $focus_score,
    emotion:     $emotion,
    time_ms:     $time_ms,
    timestamp:   datetime()
}]->(q)
"""

CYPHER_GET_MASTERY = """
MATCH (s:Student {id: $student_id})-[r:MASTERED]->(c:Concept)
RETURN c.id AS concept_id, c.name AS concept_name, r.score AS mastery
"""

CYPHER_WEAK_PREREQUISITES = """
MATCH (target:Concept {id: $concept_id})<-[:PREREQUISITE_OF*1..5]-(prereq:Concept)
OPTIONAL MATCH (s:Student {id: $student_id})-[m:MASTERED]->(prereq)
WITH prereq, coalesce(m.score, 0.0) AS mastery
WHERE mastery < 0.6
RETURN prereq.id AS concept_id, prereq.name AS name, mastery
ORDER BY mastery ASC
LIMIT 3
"""

CYPHER_NEXT_CONCEPTS = """
MATCH (s:Student {id: $student_id})-[m:MASTERED]->(c:Concept)
WHERE m.score >= 0.6
WITH collect(c.id) AS mastered_ids
MATCH (next:Concept)
WHERE NOT next.id IN mastered_ids
AND ALL(p IN [(next)<-[:PREREQUISITE_OF]-(prereq) | prereq.id]
        WHERE prereq.id IN mastered_ids)
OPTIONAL MATCH (s2:Student {id: $student_id})-[m2:MASTERED]->(next)
RETURN next.id AS concept_id, next.name AS name,
       next.difficulty AS difficulty,
       coalesce(m2.score, 0.0) AS current_mastery
ORDER BY current_mastery ASC
LIMIT 5
"""

CYPHER_TEACHER_BOTTLENECKS = """
MATCH (s:Student)-[r:MASTERED]->(c:Concept)
WITH c, avg(r.score) AS avg_mastery, count(s) AS student_count
MATCH (c)<-[:PREREQUISITE_OF*1..3]-(dependents:Concept)
WITH c, avg_mastery, student_count, count(dependents) AS blocking_count
RETURN c.id AS concept_id, c.name AS name,
       round(avg_mastery * 100) / 100 AS avg_mastery,
       student_count, blocking_count
ORDER BY avg_mastery ASC, blocking_count DESC
LIMIT 10
"""

CYPHER_MERGE_STUDENT = """
MERGE (s:Student {id: $id})
SET s.name  = $name,
    s.email = $email,
    s.level = $level
"""
