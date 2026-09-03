from __future__ import annotations

import asyncio
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import delete, select

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.database import AsyncSessionLocal, init_db
from app.core.security import hash_password
from app.graph_engine.concept_graph import CONCEPTS
from app.models.session_model import EmotionLog, FocusLog, Session
from app.models.user import SkillMastery, StudentProgress, User


DEMO_DOMAIN = "smartfocus.demo"
DEMO_PASSWORD = "demo1234"
STUDENT_COUNT = 58

FIRST_NAMES = [
    "Shreyas", "Spoorthi", "Spandana", "Shankar", "Saketh", "Vishnu",
    "Sania", "Harsha", "Manu", "Megha", "Meghana", "Shreya",
    "Ananya", "Aishwarya", "Nandini", "Kavya", "Tejas", "Kiran",
    "Raksha", "Sahana", "Prajwal", "Nikhil", "Dhanush", "Deepak",
    "Varsha", "Vaishnavi", "Sanjana", "Pranav", "Rohith", "Charan",
    "Pavithra", "Keerthana", "Bhuvan", "Likith", "Srinidhi",
]

LAST_NAMES = [
    "Rao", "Shetty", "Gowda", "Patil", "Hegde", "Naidu", "Nair",
    "Iyer", "Menon", "Reddy", "Poojary", "Kulkarni", "Bhat",
    "Acharya", "Kumar", "Krishna", "Murthy", "Pai", "Shenoy",
    "Prabhu",
]

PATH_TEMPLATES = [
    ["Data Types", "Variables", "Operators", "Input/Output", "Conditionals"],
    ["Data Types", "Variables", "Operators", "Conditionals", "Loops", "Functions"],
    ["Data Types", "Variables", "Strings", "Lists", "Tuples", "Dictionaries"],
    ["Data Types", "Variables", "Operators", "Loops", "Functions", "Exception Handling"],
    ["Data Types", "Variables", "Lists", "Dictionaries", "Sets", "Comprehensions"],
    ["Data Types", "Variables", "Functions", "Modules", "File Handling"],
    ["Data Types", "Variables", "Functions", "Recursion", "Lambda Functions"],
    ["Data Types", "Variables", "Classes and Objects", "Inheritance", "Polymorphism"],
    ["Data Types", "Variables", "Loops", "Functions", "Generators", "Decorators"],
]


def _concept_path(index: int, rng: random.Random) -> list[str]:
    path = [c for c in PATH_TEMPLATES[index % len(PATH_TEMPLATES)] if c in CONCEPTS]
    target_len = rng.randint(3, min(len(path), 8))
    return path[:target_len]


def _learning_profile(index: int) -> tuple[str, float, float, int]:
    profiles = [
        ("steady", 76, 0.92, 6),
        ("watch", 59, 0.84, 3),
        ("at_risk", 38, 0.68, 1),
        ("accelerated", 84, 0.95, 8),
        ("sleepy", 49, 0.76, 2),
    ]
    return profiles[index % len(profiles)]


def _state_from_focus(score: float, emotion: str) -> str:
    if emotion == "SLEEPY":
        return "FATIGUED"
    if emotion == "BORED":
        return "DISENGAGED" if score < 45 else "STRUGGLING"
    if score >= 78:
        return "FLOW"
    if score >= 55:
        return "PRODUCTIVE"
    return "STRUGGLING"


async def seed() -> None:
    await init_db()
    rng = random.Random(20260609)
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        existing = await db.execute(
            select(User.id).where(User.email.like(f"%@{DEMO_DOMAIN}"))
        )
        demo_ids = [row[0] for row in existing.all()]
        if demo_ids:
            await db.execute(delete(FocusLog).where(FocusLog.user_id.in_(demo_ids)))
            await db.execute(delete(EmotionLog).where(EmotionLog.user_id.in_(demo_ids)))
            await db.execute(delete(Session).where(Session.user_id.in_(demo_ids)))
            await db.execute(delete(StudentProgress).where(StudentProgress.user_id.in_(demo_ids)))
            await db.execute(delete(SkillMastery).where(SkillMastery.user_id.in_(demo_ids)))
            await db.execute(delete(User).where(User.id.in_(demo_ids)))
            await db.commit()

        students: list[User] = []
        used_names: set[str] = set()
        password_hash = hash_password(DEMO_PASSWORD)

        for i in range(STUDENT_COUNT):
            first = FIRST_NAMES[i % len(FIRST_NAMES)]
            last = LAST_NAMES[(i * 7) % len(LAST_NAMES)]
            name = f"{first} {last}"
            if name in used_names:
                name = f"{first} {last} {i + 1}"
            used_names.add(name)

            profile, base_focus, face_rate, streak = _learning_profile(i)
            jitter = rng.randint(-2, 3)
            level = max(1, min(12, int((base_focus - 25) / 9) + rng.randint(0, 2)))
            xp_total = level * 180 + rng.randint(20, 220)
            student = User(
                email=f"{first.lower()}.{last.lower()}.{i + 1}@{DEMO_DOMAIN}",
                password_hash=password_hash,
                full_name=name,
                role="student",
                avatar_id=f"avatar-{(i % 12) + 1}",
                level=level,
                xp_total=xp_total,
                xp_current=xp_total % 100,
                xp_to_next=100,
                streak_days=max(0, streak + jitter),
                last_active=now - timedelta(hours=rng.randint(1, 72)),
            )
            db.add(student)
            students.append(student)

        await db.flush()

        concepts = list(CONCEPTS.keys())
        for i, student in enumerate(students):
            profile, base_focus, face_rate, _ = _learning_profile(i)
            path = _concept_path(i, rng)
            extra_started = rng.sample([c for c in concepts if c not in path], k=rng.randint(1, 3))

            for order, concept in enumerate(path):
                mastery = min(0.98, rng.uniform(0.62, 0.94) - order * 0.015)
                db.add(SkillMastery(
                    user_id=student.id,
                    skill_id=CONCEPTS[concept]["id"],
                    mastery=round(mastery, 3),
                    correct_count=rng.randint(5, 13),
                    wrong_count=rng.randint(0, 4),
                    last_practiced=now - timedelta(days=rng.randint(0, 6), hours=rng.randint(0, 8)),
                ))
                db.add(StudentProgress(
                    user_id=student.id,
                    quest_id=concept,
                    status="completed",
                    progress_pct=100,
                    xp_earned=CONCEPTS[concept].get("xp_reward", 50),
                    started_at=now - timedelta(days=rng.randint(3, 10)),
                    completed_at=now - timedelta(days=rng.randint(0, 5), hours=rng.randint(0, 20)),
                ))

            for concept in extra_started:
                progress = rng.randint(15, 58)
                db.add(SkillMastery(
                    user_id=student.id,
                    skill_id=CONCEPTS[concept]["id"],
                    mastery=round(progress / 100, 3),
                    correct_count=rng.randint(1, 5),
                    wrong_count=rng.randint(1, 5),
                    last_practiced=now - timedelta(days=rng.randint(0, 6)),
                ))
                db.add(StudentProgress(
                    user_id=student.id,
                    quest_id=concept,
                    status="in_progress",
                    progress_pct=progress,
                    xp_earned=round(CONCEPTS[concept].get("xp_reward", 50) * progress / 100),
                    started_at=now - timedelta(days=rng.randint(0, 7)),
                ))

            session_count = rng.randint(3, 7)
            for s_idx in range(session_count):
                started = now - timedelta(days=rng.randint(0, 6), hours=rng.randint(0, 21), minutes=rng.randint(0, 50))
                duration = timedelta(minutes=rng.randint(18, 42))
                session = Session(
                    user_id=student.id,
                    quest_id=path[min(s_idx, len(path) - 1)] if path else "Data Types",
                    started_at=started,
                    ended_at=started + duration,
                    avg_focus_score=0.0,
                    cv_available=True,
                )
                db.add(session)
                await db.flush()

                focus_values: list[float] = []
                frame_count = rng.randint(16, 26)
                for frame in range(frame_count):
                    detected = rng.random() < face_rate
                    if not detected:
                        score = rng.uniform(8, 24)
                        attention = 0.0
                        emotion = "SLEEPY" if profile in {"sleepy", "at_risk"} else "BORED"
                    else:
                        score = max(18, min(98, rng.gauss(base_focus, 10)))
                        attention = max(0.2, min(1.0, score / 100 + rng.uniform(-0.08, 0.08)))
                        if profile == "at_risk" and rng.random() < 0.32:
                            emotion = rng.choice(["BORED", "SLEEPY"])
                        elif profile == "sleepy" and rng.random() < 0.38:
                            emotion = "SLEEPY"
                        elif profile == "watch" and rng.random() < 0.24:
                            emotion = "BORED"
                        else:
                            emotion = "FOCUSED"

                    timestamp = started + (duration / frame_count) * frame
                    confidence = round(rng.uniform(0.72, 0.96), 2) if detected else round(rng.uniform(0.35, 0.58), 2)
                    state = _state_from_focus(score, emotion)
                    focus_values.append(score)
                    db.add(FocusLog(
                        session_id=session.id,
                        user_id=student.id,
                        score=round(score, 1),
                        attention=round(attention, 2),
                        state=state,
                        timestamp=timestamp,
                    ))
                    db.add(EmotionLog(
                        session_id=session.id,
                        user_id=student.id,
                        emotion=emotion,
                        confidence=confidence,
                        timestamp=timestamp,
                    ))

                session.avg_focus_score = round(sum(focus_values) / len(focus_values), 1)

        await db.commit()

    print(f"Seeded {STUDENT_COUNT} demo students.")
    print(f"Login password for generated students: {DEMO_PASSWORD}")
    print(f"Email pattern: firstname.lastname.number@{DEMO_DOMAIN}")


if __name__ == "__main__":
    asyncio.run(seed())
