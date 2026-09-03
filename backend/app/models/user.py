import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id:            Mapped[str]      = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email:         Mapped[str]      = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str]      = mapped_column(String(255), nullable=False)
    full_name:     Mapped[str]      = mapped_column(String(255), nullable=False)
    role:          Mapped[str]      = mapped_column(String(20), nullable=False, default="student")
    avatar_id:     Mapped[str]      = mapped_column(String(50), default="default")
    level:         Mapped[int]      = mapped_column(Integer, default=1)
    xp_total:      Mapped[int]      = mapped_column(Integer, default=0)
    xp_current:    Mapped[int]      = mapped_column(Integer, default=0)
    xp_to_next:    Mapped[int]      = mapped_column(Integer, default=100)
    streak_days:   Mapped[int]      = mapped_column(Integer, default=0)
    last_active:   Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at:    Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    progress = relationship("StudentProgress", back_populates="user", lazy="select")
    mastery  = relationship("SkillMastery",    back_populates="user", lazy="select")
    sessions = relationship("Session",          back_populates="user", lazy="select")


class StudentProgress(Base):
    __tablename__ = "student_progress"

    id:           Mapped[str]    = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id:      Mapped[str]    = mapped_column(String, ForeignKey("users.id"), nullable=False)
    quest_id:     Mapped[str]    = mapped_column(String, nullable=False)
    status:       Mapped[str]    = mapped_column(String(20), default="not_started")
    progress_pct: Mapped[int]    = mapped_column(Integer, default=0)
    xp_earned:    Mapped[int]    = mapped_column(Integer, default=0)
    started_at:   Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user = relationship("User", back_populates="progress")


class SkillMastery(Base):
    __tablename__ = "skill_mastery"

    id:            Mapped[str]   = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id:       Mapped[str]   = mapped_column(String, ForeignKey("users.id"), nullable=False)
    skill_id:      Mapped[str]   = mapped_column(String, nullable=False)
    mastery:       Mapped[float] = mapped_column(Float, default=0.0)
    correct_count: Mapped[int]   = mapped_column(Integer, default=0)
    wrong_count:   Mapped[int]   = mapped_column(Integer, default=0)
    last_practiced: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user = relationship("User", back_populates="mastery")
