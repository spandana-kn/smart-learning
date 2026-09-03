import uuid
from typing import Optional
from sqlalchemy import String, Integer, Text, JSON, Boolean, Float
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class Quest(Base):
    __tablename__ = "quests"

    id:             Mapped[str]  = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title:          Mapped[str]  = mapped_column(String(255), nullable=False)
    description:    Mapped[str]  = mapped_column(Text, default="")
    subject:        Mapped[str]  = mapped_column(String(100), nullable=False)
    skill_id:       Mapped[Optional[str]] = mapped_column(String, nullable=True)
    base_difficulty: Mapped[str] = mapped_column(String(10), default="medium")
    question_count: Mapped[int]  = mapped_column(Integer, default=5)
    xp_reward_base: Mapped[int]  = mapped_column(Integer, default=100)
    min_level:      Mapped[int]  = mapped_column(Integer, default=1)
    is_active:      Mapped[bool] = mapped_column(Boolean, default=True)


class Question(Base):
    __tablename__ = "questions"

    id:            Mapped[str]  = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    quest_id:      Mapped[str]  = mapped_column(String, nullable=False)
    skill_id:      Mapped[Optional[str]] = mapped_column(String, nullable=True)
    question_text: Mapped[str]  = mapped_column(Text, nullable=False)
    question_type: Mapped[str]  = mapped_column(String(20), default="mcq")
    options:       Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    correct_answer: Mapped[str] = mapped_column(String(255), nullable=False)
    explanation:   Mapped[str]  = mapped_column(Text, default="")
    hints:         Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    difficulty:    Mapped[str]  = mapped_column(String(10), default="medium")
    bloom_level:   Mapped[str]  = mapped_column(String(30), default="remember")
