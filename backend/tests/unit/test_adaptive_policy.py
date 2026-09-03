from app.graph_engine import adaptive_engine as ae
from app.graph_engine.knowledge_tracker import KnowledgeTracker


def setup_function():
    ae._MOCK_MASTERY.clear()
    ae._MOCK_ATTEMPTS.clear()


def test_common_start_unlocks_variables_after_data_types(monkeypatch):
    monkeypatch.setattr(ae.neo4j_db, "get_mode", lambda: "MOCK")
    student_id = "student-path"

    initial = ae.get_learning_path_state(student_id, emotion="FOCUSED", focus=80)
    assert initial["start_concept"] == "Data Types"
    assert initial["recommended_concept"] == "Data Types"

    ae._MOCK_MASTERY[student_id] = {"Data Types": 0.72}
    after_start = ae.get_learning_path_state(student_id, emotion="FOCUSED", focus=80)
    assert after_start["recommended_concept"] == "Variables"
    assert after_start["candidates"][0]["concept"] == "Variables"


def test_bored_high_focus_pushes_to_harder_unlocked_topic(monkeypatch):
    monkeypatch.setattr(ae.neo4j_db, "get_mode", lambda: "MOCK")
    student_id = "student-bored"
    ae._MOCK_MASTERY[student_id] = {
        "Data Types": 0.8,
        "Variables": 0.8,
        "Operators": 0.8,
    }

    focused = ae.get_learning_path_state(student_id, emotion="FOCUSED", focus=75)
    bored = ae.get_learning_path_state(student_id, emotion="BORED", focus=85)

    assert bored["recommended_concept"] in {"Conditional Statements", "OOP Basics"}
    assert bored["recommended_concept"] != focused["recommended_concept"]
    assert "challenge" in bored["candidates"][0]["reason"]


def test_mastery_update_uses_correctness_focus_emotion_and_time(monkeypatch):
    monkeypatch.setattr(ae.neo4j_db, "get_mode", lambda: "MOCK")

    fast_focused = KnowledgeTracker("fast", {"Data Types": 0.2})
    slow_sleepy = KnowledgeTracker("slow", {"Data Types": 0.2})

    high = fast_focused.record_answer(
        "Data Types",
        True,
        focus_score=95,
        time_ms=5_000,
        difficulty="easy",
        emotion="FOCUSED",
    )
    low = slow_sleepy.record_answer(
        "Data Types",
        True,
        focus_score=30,
        time_ms=30_000,
        difficulty="easy",
        emotion="SLEEPY",
    )

    assert high > low
    assert ae._MOCK_MASTERY["fast"]["Data Types"] == round(high, 4)
    assert ae._MOCK_MASTERY["slow"]["Data Types"] == round(low, 4)
