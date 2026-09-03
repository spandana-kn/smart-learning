"""
Python learning concept graph.

Defines 33 concepts mapped from the CSV dataset plus their
prerequisite edges.  Uses networkx for in-memory graph traversal
(the same logic is mirrored in Cypher queries for Neo4j live mode).

Prerequisite model:  A → B means "A must be ≥ 60% mastered before B unlocks"
"""
from __future__ import annotations

import json
import re
from pathlib import Path
import networkx as nx
from typing import Any

CUSTOM_CONTENT_PATH = Path(__file__).resolve().parents[1] / "importers" / "data" / "custom_content.json"

# ── Concept definitions ────────────────────────────────────────────────────

CONCEPTS: dict[str, dict[str, Any]] = {
    "Data Types": {
        "id": "data_types", "difficulty": "easy", "bloom": "remember",
        "xp_reward": 40, "tier": 0,
        "description": "int, float, str, bool, NoneType, complex",
    },
    "Variables": {
        "id": "variables", "difficulty": "easy", "bloom": "remember",
        "xp_reward": 40, "tier": 0,
        "description": "Variable naming, assignment, deletion, scope",
    },
    "Operators": {
        "id": "operators", "difficulty": "easy", "bloom": "understand",
        "xp_reward": 50, "tier": 1,
        "description": "Arithmetic, comparison, logical, bitwise, walrus",
    },
    "Type Casting": {
        "id": "type_casting", "difficulty": "easy", "bloom": "apply",
        "xp_reward": 50, "tier": 1,
        "description": "Implicit and explicit type conversion; int(), float(), str()",
    },
    "Input Output": {
        "id": "input_output", "difficulty": "easy", "bloom": "apply",
        "xp_reward": 45, "tier": 1,
        "description": "print(), input(), f-strings, format(), file-like output",
    },
    "Conditional Statements": {
        "id": "conditionals", "difficulty": "easy", "bloom": "apply",
        "xp_reward": 55, "tier": 2,
        "description": "if / elif / else, ternary operator, match-case",
    },
    "Nested Conditionals": {
        "id": "nested_conditionals", "difficulty": "medium", "bloom": "apply",
        "xp_reward": 60, "tier": 3,
        "description": "Deeply nested if-else blocks, dangling else, readability",
    },
    "Loops": {
        "id": "loops", "difficulty": "easy", "bloom": "apply",
        "xp_reward": 60, "tier": 3,
        "description": "for / while loops, range(), enumerate(), zip()",
    },
    "Loop Control": {
        "id": "loop_control", "difficulty": "easy", "bloom": "apply",
        "xp_reward": 55, "tier": 4,
        "description": "break, continue, pass, else on loops",
    },
    "Functions": {
        "id": "functions", "difficulty": "medium", "bloom": "apply",
        "xp_reward": 70, "tier": 3,
        "description": "def, return, scope, first-class functions, docstrings",
    },
    "Function Arguments": {
        "id": "function_arguments", "difficulty": "medium", "bloom": "apply",
        "xp_reward": 70, "tier": 4,
        "description": "*args, **kwargs, default params, keyword-only args",
    },
    "Lambda Functions": {
        "id": "lambda_functions", "difficulty": "medium", "bloom": "apply",
        "xp_reward": 65, "tier": 4,
        "description": "Anonymous functions, map(), filter(), sort key",
    },
    "Recursion": {
        "id": "recursion", "difficulty": "hard", "bloom": "analyze",
        "xp_reward": 100, "tier": 5,
        "description": "Base case, call stack, tail recursion, memoization",
    },
    "Exception Handling": {
        "id": "exception_handling", "difficulty": "medium", "bloom": "apply",
        "xp_reward": 75, "tier": 4,
        "description": "try/except/else/finally, raise, assert",
    },
    "Custom Exceptions": {
        "id": "custom_exceptions", "difficulty": "medium", "bloom": "create",
        "xp_reward": 80, "tier": 5,
        "description": "Inheriting from Exception, __str__, chaining",
    },
    "Context Managers": {
        "id": "context_managers", "difficulty": "medium", "bloom": "apply",
        "xp_reward": 80, "tier": 5,
        "description": "with statement, __enter__/__exit__, contextlib",
    },
    "Lists": {
        "id": "lists", "difficulty": "easy", "bloom": "apply",
        "xp_reward": 65, "tier": 4,
        "description": "Mutable sequences, slicing, methods, nesting",
    },
    "Tuples": {
        "id": "tuples", "difficulty": "easy", "bloom": "understand",
        "xp_reward": 55, "tier": 5,
        "description": "Immutable sequences, packing/unpacking, named tuples",
    },
    "Sets": {
        "id": "sets", "difficulty": "medium", "bloom": "apply",
        "xp_reward": 65, "tier": 5,
        "description": "Unordered unique collections, set operations, frozenset",
    },
    "Dictionaries": {
        "id": "dictionaries", "difficulty": "medium", "bloom": "apply",
        "xp_reward": 70, "tier": 6,
        "description": "Key-value store, methods, comprehension, OrderedDict",
    },
    "List Comprehensions": {
        "id": "list_comprehensions", "difficulty": "medium", "bloom": "apply",
        "xp_reward": 75, "tier": 5,
        "description": "Compact list creation, filtering, nested comprehensions",
    },
    "File Handling": {
        "id": "file_handling", "difficulty": "medium", "bloom": "apply",
        "xp_reward": 75, "tier": 5,
        "description": "open(), read/write modes, seek(), context managers",
    },
    "Iterators": {
        "id": "iterators", "difficulty": "medium", "bloom": "understand",
        "xp_reward": 80, "tier": 5,
        "description": "__iter__, __next__, StopIteration, iter()",
    },
    "Generators": {
        "id": "generators", "difficulty": "hard", "bloom": "apply",
        "xp_reward": 95, "tier": 6,
        "description": "yield, generator expressions, yield from, lazy eval",
    },
    "Modules": {
        "id": "modules", "difficulty": "easy", "bloom": "apply",
        "xp_reward": 60, "tier": 4,
        "description": "import, from...import, __name__, sys.path",
    },
    "Packages": {
        "id": "packages", "difficulty": "medium", "bloom": "apply",
        "xp_reward": 65, "tier": 5,
        "description": "__init__.py, relative imports, site-packages, pip",
    },
    "OOP Basics": {
        "id": "oop_basics", "difficulty": "medium", "bloom": "understand",
        "xp_reward": 70, "tier": 3,
        "description": "Classes, objects, methods, attributes, instantiation",
    },
    "Classes Objects": {
        "id": "classes_objects", "difficulty": "medium", "bloom": "apply",
        "xp_reward": 75, "tier": 4,
        "description": "class keyword, self, __dict__, __class__",
    },
    "Constructors": {
        "id": "constructors", "difficulty": "medium", "bloom": "apply",
        "xp_reward": 70, "tier": 5,
        "description": "__init__, super().__init__(), constructor overloading",
    },
    "Encapsulation": {
        "id": "encapsulation", "difficulty": "medium", "bloom": "apply",
        "xp_reward": 80, "tier": 5,
        "description": "Private/protected, name mangling, @property, getters/setters",
    },
    "Inheritance": {
        "id": "inheritance", "difficulty": "hard", "bloom": "analyze",
        "xp_reward": 95, "tier": 5,
        "description": "Single/multiple inheritance, MRO, super(), mixins",
    },
    "Polymorphism": {
        "id": "polymorphism", "difficulty": "hard", "bloom": "analyze",
        "xp_reward": 100, "tier": 6,
        "description": "Method overriding, duck typing, operator overloading",
    },
    "Decorators": {
        "id": "decorators", "difficulty": "hard", "bloom": "create",
        "xp_reward": 110, "tier": 6,
        "description": "@decorator, functools.wraps, class decorators, args",
    },
}

# ── Prerequisite edges  (A → B means A must be learned before B) ───────────

PREREQUISITES: list[tuple[str, str]] = [
    # Common starting topic for every personalized path
    ("Data Types",            "Variables"),

    # Tier 0 → 1
    ("Variables",             "Operators"),
    ("Data Types",            "Operators"),
    ("Data Types",            "Type Casting"),
    ("Variables",             "Type Casting"),
    ("Variables",             "Input Output"),
    ("Type Casting",          "Input Output"),

    # Tier 1 → 2
    ("Operators",             "Conditional Statements"),

    # Tier 2 → 3
    ("Conditional Statements","Nested Conditionals"),
    ("Conditional Statements","Loops"),
    ("Conditional Statements","Functions"),
    ("Variables",             "OOP Basics"),
    ("Conditional Statements","Exception Handling"),

    # Tier 3 → 4
    ("Loops",                 "Loop Control"),
    ("Loops",                 "Lists"),
    ("Functions",             "Function Arguments"),
    ("Functions",             "Lambda Functions"),
    ("Functions",             "Modules"),
    ("OOP Basics",            "Classes Objects"),

    # Tier 4 → 5
    ("Lists",                 "Tuples"),
    ("Lists",                 "Sets"),
    ("Lists",                 "List Comprehensions"),
    ("Conditional Statements","List Comprehensions"),
    ("Lists",                 "Iterators"),
    ("Loops",                 "Iterators"),
    ("Functions",             "Recursion"),
    ("Loops",                 "Recursion"),
    ("Exception Handling",    "Custom Exceptions"),
    ("Exception Handling",    "Context Managers"),
    ("Input Output",          "File Handling"),
    ("Exception Handling",    "File Handling"),
    ("Modules",               "Packages"),
    ("Classes Objects",       "Constructors"),
    ("Classes Objects",       "Encapsulation"),
    ("Classes Objects",       "Inheritance"),

    # Tier 5 → 6
    ("Sets",                  "Dictionaries"),
    ("Iterators",             "Generators"),
    ("Functions",             "Generators"),
    ("Inheritance",           "Polymorphism"),
    ("Functions",             "Decorators"),
    ("Classes Objects",       "Decorators"),
]

# ── Build the networkx graph ───────────────────────────────────────────────

def _build() -> nx.DiGraph:
    G: nx.DiGraph = nx.DiGraph()
    for name, meta in CONCEPTS.items():
        G.add_node(name, **meta)
    for src, dst in PREREQUISITES:
        G.add_edge(src, dst, relation="PREREQUISITE_OF")
    return G


GRAPH: nx.DiGraph = _build()


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return slug or "custom_topic"


def _read_custom_content() -> dict[str, Any]:
    if not CUSTOM_CONTENT_PATH.exists():
        return {"subjects": [], "topics": [], "questions": [], "quests": [], "bosses": []}
    with open(CUSTOM_CONTENT_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return {
        "subjects": data.get("subjects", []),
        "topics": data.get("topics", []),
        "questions": data.get("questions", []),
        "quests": data.get("quests", []),
        "bosses": data.get("bosses", []),
    }


def _write_custom_content(data: dict[str, Any]) -> None:
    CUSTOM_CONTENT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CUSTOM_CONTENT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def rebuild_graph() -> None:
    global GRAPH
    GRAPH = _build()


def load_custom_content() -> dict[str, Any]:
    """Load teacher-created topics into the in-memory concept graph."""
    data = _read_custom_content()
    for topic in data["topics"]:
        name = topic["name"]
        CONCEPTS[name] = {
            "id": topic.get("id") or _slugify(name),
            "difficulty": topic.get("difficulty", "easy"),
            "bloom": topic.get("bloom", "apply"),
            "xp_reward": int(topic.get("xp_reward", 50)),
            "tier": int(topic.get("tier", 0)),
            "description": topic.get("description", ""),
            "subject": topic.get("subject", "Custom"),
            "custom": True,
        }
    for topic in data["topics"]:
        name = topic["name"]
        for prereq in topic.get("prerequisites", []):
            if prereq in CONCEPTS and (prereq, name) not in PREREQUISITES:
                PREREQUISITES.append((prereq, name))
    rebuild_graph()
    return data


def save_custom_content(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Upsert a subject/topic/question/quest/boss bundle and reload the graph.
    """
    data = _read_custom_content()

    subject = payload.get("subject", {}).get("name", "").strip()
    if subject and subject not in data["subjects"]:
        data["subjects"].append(subject)

    topic = payload.get("topic") or {}
    topic_name = topic.get("name", "").strip()
    topic_id = topic.get("id") or _slugify(topic_name)
    if topic_name:
        topic_record = {
            "id": topic_id,
            "name": topic_name,
            "subject": subject or topic.get("subject", "Custom"),
            "description": topic.get("description", ""),
            "difficulty": topic.get("difficulty", "easy"),
            "bloom": topic.get("bloom", "apply"),
            "tier": int(topic.get("tier", 0)),
            "xp_reward": int(topic.get("xp_reward", 50)),
            "prerequisites": topic.get("prerequisites", []),
        }
        data["topics"] = [t for t in data["topics"] if t.get("id") != topic_id and t.get("name") != topic_name]
        data["topics"].append(topic_record)

    questions = payload.get("questions") or []
    legacy_question = payload.get("question") or {}
    if legacy_question.get("question_text"):
        questions.append(legacy_question)

    for question in questions:
        if not topic_name or not question.get("question_text"):
            continue
        qid = question.get("id") or f"q_{topic_id}_{len(data['questions']) + 1:03d}"
        data["questions"] = [q for q in data["questions"] if q.get("id") != qid]
        data["questions"].append({
            "id": qid,
            "concept": topic_name,
            "difficulty": question.get("difficulty", topic.get("difficulty", "easy")),
            "bloom_level": question.get("bloom_level", topic.get("bloom", "apply")),
            "question_text": question["question_text"],
            "options": question.get("options", []),
            "correct_answer": question.get("correct_answer", "A"),
            "explanation": question.get("explanation", ""),
        })

    quest = payload.get("quest") or {}
    if topic_name and quest.get("enabled", True):
        data["quests"] = [q for q in data["quests"] if q.get("topic") != topic_name]
        data["quests"].append({
            "topic": topic_name,
            "title": quest.get("title") or f"{topic_name} Quest",
            "description": quest.get("description") or f"Practice {topic_name}.",
        })

    boss = payload.get("boss") or {}
    if topic_name and boss.get("enabled", False):
        data["bosses"] = [b for b in data["bosses"] if b.get("topic") != topic_name]
        data["bosses"].append({
            "topic": topic_name,
            "name": boss.get("name") or f"The {topic_name} Sentinel",
            "lore_text": boss.get("lore_text") or f"A challenge forged from {topic_name}.",
            "hp_total": int(boss.get("hp_total", 240)),
        })

    _write_custom_content(data)
    return load_custom_content()


load_custom_content()


# ── Traversal helpers ──────────────────────────────────────────────────────

def get_prerequisites(concept: str) -> list[str]:
    """Direct prerequisites only."""
    return list(GRAPH.predecessors(concept))


def get_all_prerequisites(concept: str) -> list[str]:
    """All transitive prerequisites (BFS)."""
    return list(nx.ancestors(GRAPH, concept))


def get_unlocks(concept: str) -> list[str]:
    """Concepts directly unlocked by mastering this one."""
    return list(GRAPH.successors(concept))


def get_frontier(mastered: set[str], threshold: float = 0.6,
                 mastery_map: dict[str, float] | None = None) -> list[str]:
    """
    Concepts available to study: all prerequisites are ≥ threshold mastered.
    Excludes already-mastered concepts (≥ threshold).
    """
    mastery_map = mastery_map or {}
    start = "Data Types"
    if mastery_map.get(start, 0.0) < threshold:
        return [start]

    frontier = []
    for concept in CONCEPTS:
        current = mastery_map.get(concept, 0.0)
        if current >= threshold:
            continue  # already mastered
        prereqs = set(get_prerequisites(concept))
        if all(mastery_map.get(p, 0.0) >= threshold for p in prereqs):
            frontier.append(concept)
    return frontier


def get_weak_prerequisites(concept: str,
                            mastery_map: dict[str, float],
                            threshold: float = 0.6) -> list[str]:
    """Prerequisite concepts (transitive) with mastery below threshold."""
    all_prereqs = get_all_prerequisites(concept)
    weak = [p for p in all_prereqs if mastery_map.get(p, 0.0) < threshold]
    weak.sort(key=lambda p: mastery_map.get(p, 0.0))  # weakest first
    return weak


def shortest_learning_path(start: str, end: str) -> list[str]:
    """Ordered concept list from start to end."""
    try:
        return nx.shortest_path(GRAPH, start, end)
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return [end]


def concept_centrality() -> dict[str, float]:
    """Betweenness centrality — how 'critical' each concept is."""
    return nx.betweenness_centrality(GRAPH)


def _get_live_graph_json(mastery_map: dict[str, float], threshold: float) -> dict | None:
    """Read the concept graph shape from Neo4j when LIVE mode is active."""
    try:
        from app.db import neo4j_db
    except Exception:
        return None

    if neo4j_db.get_mode() != "LIVE":
        return None

    rows = neo4j_db.run_query(
        """
        MATCH (c:Concept)
        RETURN c.id AS id, c.name AS name, c.difficulty AS difficulty,
               c.bloom AS bloom, c.tier AS tier, c.xp_reward AS xp_reward,
               c.description AS description
        ORDER BY coalesce(c.tier, 99), c.name
        """
    )
    edge_rows = neo4j_db.run_query(
        """
        MATCH (a:Concept)-[:PREREQUISITE_OF]->(b:Concept)
        RETURN a.name AS source, b.name AS target
        ORDER BY source, target
        """
    )
    if not rows:
        return None

    prereqs_by_name: dict[str, set[str]] = {row["name"]: set() for row in rows}
    for edge in edge_rows:
        prereqs_by_name.setdefault(edge["target"], set()).add(edge["source"])

    start = "Data Types"
    start_mastered = mastery_map.get(start, 0.0) >= threshold
    nodes = []
    for row in rows:
        name = row["name"]
        local_meta = CONCEPTS.get(name, {})
        mastery = mastery_map.get(name, 0.0)
        prereqs = prereqs_by_name.get(name, set())
        if mastery >= threshold:
            status = "mastered"
        elif name != start and not start_mastered:
            status = "locked"
        elif all(mastery_map.get(p, 0.0) >= threshold for p in prereqs):
            status = "available"
        else:
            status = "locked"

        nodes.append({
            "id":          name,
            "name":        name,
            "mastery":     round(mastery, 3),
            "status":      status,
            "tier":        int(row.get("tier") if row.get("tier") is not None else local_meta.get("tier", 0)),
            "difficulty":  row.get("difficulty") or local_meta.get("difficulty", "easy"),
            "xp_reward":   int(row.get("xp_reward") or local_meta.get("xp_reward", 50)),
            "bloom":       row.get("bloom") or local_meta.get("bloom", "apply"),
            "description": row.get("description") or local_meta.get("description", ""),
        })

    return {
        "nodes": nodes,
        "links": [{"source": row["source"], "target": row["target"]} for row in edge_rows],
    }


def get_graph_json(mastery_map: dict[str, float] | None = None) -> dict:
    """
    Return node/link data suitable for react-force-graph-2d.

    Node fields:  id, name, mastery, status, tier, difficulty, xp_reward
    Link fields:  source, target
    """
    mastery_map = mastery_map or {}
    threshold = 0.6
    live_graph = _get_live_graph_json(mastery_map, threshold)
    if live_graph is not None:
        return live_graph

    start = "Data Types"
    start_mastered = mastery_map.get(start, 0.0) >= threshold

    nodes = []
    for name, meta in CONCEPTS.items():
        mastery = mastery_map.get(name, 0.0)
        prereqs = set(get_prerequisites(name))
        if mastery >= threshold:
            status = "mastered"
        elif name != start and not start_mastered:
            status = "locked"
        elif all(mastery_map.get(p, 0.0) >= threshold for p in prereqs):
            status = "available"
        else:
            status = "locked"

        nodes.append({
            "id":         name,
            "name":       name,
            "mastery":    round(mastery, 3),
            "status":     status,
            "tier":       meta["tier"],
            "difficulty": meta["difficulty"],
            "xp_reward":  meta["xp_reward"],
            "bloom":      meta["bloom"],
            "description": meta["description"],
        })

    links = [
        {"source": src, "target": dst}
        for src, dst in GRAPH.edges()
    ]

    return {"nodes": nodes, "links": links}


def recommend_next_concept(mastery_map: dict[str, float],
                           emotion: str = "FOCUSED",
                           focus: float = 60.0) -> str | None:
    """
    Pick the single best next concept to study.

    Priority rules:
    1. If focus < 35 → recommend the easiest available concept
    2. If emotion == SLEEPY → recommend weakest mastered concept (revision)
    3. If emotion == BORED and focus > 70 → recommend hardest available
    4. Otherwise → concept in frontier with lowest current mastery (most need)
    """
    frontier = get_frontier(set(), mastery_map=mastery_map)
    if not frontier:
        return None

    difficulty_rank = {"easy": 0, "medium": 1, "hard": 2}

    if focus < 35:
        # Low focus: pick easiest available
        frontier.sort(key=lambda c: difficulty_rank.get(CONCEPTS[c]["difficulty"], 1))
        return frontier[0]

    if emotion == "SLEEPY":
        # Struggling: step back to a weak prerequisite of current concept
        weak = [c for c in mastery_map if mastery_map[c] < 0.4]
        if weak:
            weak.sort(key=lambda c: mastery_map.get(c, 0.0))
            return weak[0]

    if emotion == "BORED" and focus > 70:
        # Bored + high focus: most advanced available concept
        frontier.sort(key=lambda c: (
            -CONCEPTS[c]["tier"],
            -difficulty_rank.get(CONCEPTS[c]["difficulty"], 1),
        ))
        return frontier[0]

    # Default: frontier concept with lowest current mastery (biggest gap)
    frontier.sort(key=lambda c: mastery_map.get(c, 0.0))
    return frontier[0]
