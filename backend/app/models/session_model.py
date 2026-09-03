import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Float, DateTime, Boolean, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Session(Base):
    __tablename__ = "sessions"

    id:              Mapped[str]   = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id:         Mapped[str]   = mapped_column(String, ForeignKey("users.id"), nullable=False)
    quest_id:        Mapped[Optional[str]] = mapped_column(String, nullable=True)
    started_at:      Mapped[datetime]   = mapped_column(DateTime, server_default=func.now())
    ended_at:        Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    avg_focus_score: Mapped[float] = mapped_column(Float, default=0.0)
    cv_available:    Mapped[bool]  = mapped_column(Boolean, default=False)

    user       = relationship("User",       back_populates="sessions")
    focus_logs = relationship("FocusLog",   back_populates="session", lazy="select")
    emotion_logs = relationship("EmotionLog", back_populates="session", lazy="select")


class FocusLog(Base):
    __tablename__ = "focus_logs"

    id:         Mapped[int]   = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str]   = mapped_column(String, ForeignKey("sessions.id"), nullable=False)
    user_id:    Mapped[str]   = mapped_column(String, nullable=False)
    score:      Mapped[float] = mapped_column(Float, nullable=False)
    attention:  Mapped[float] = mapped_column(Float, default=0.0)
    state:      Mapped[str]   = mapped_column(String(30), default="PRODUCTIVE")
    timestamp:  Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    session = relationship("Session", back_populates="focus_logs")


class EmotionLog(Base):
    __tablename__ = "emotion_logs"

    id:          Mapped[int]   = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id:  Mapped[str]   = mapped_column(String, ForeignKey("sessions.id"), nullable=False)
    user_id:     Mapped[str]   = mapped_column(String, nullable=False)
    emotion:     Mapped[str]   = mapped_column(String(30), nullable=False)
    confidence:  Mapped[float] = mapped_column(Float, default=0.0)
    timestamp:   Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    session = relationship("Session", back_populates="emotion_logs")


class AdaptationEvent(Base):
    __tablename__ = "adaptation_events"

    id:           Mapped[str]  = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id:   Mapped[str]  = mapped_column(String, nullable=False)
    user_id:      Mapped[str]  = mapped_column(String, nullable=False)
    trigger_state: Mapped[str] = mapped_column(String(30), default="")
    action_type:  Mapped[str]  = mapped_column(String(50), default="")
    timestamp:    Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
