import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Float, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class Boss(Base):
    __tablename__ = "bosses"

    id:           Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name:         Mapped[str] = mapped_column(String(255), nullable=False)
    subject:      Mapped[str] = mapped_column(String(100), nullable=False)
    lore_text:    Mapped[str] = mapped_column(Text, default="")
    hp_total:     Mapped[int] = mapped_column(Integer, default=300)
    phases:       Mapped[int] = mapped_column(Integer, default=3)
    unlock_level: Mapped[int] = mapped_column(Integer, default=1)
    sprite_id:    Mapped[str] = mapped_column(String(50), default="default")


class BossBattle(Base):
    __tablename__ = "boss_battles"

    id:              Mapped[str]   = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id:         Mapped[str]   = mapped_column(String, nullable=False)
    boss_id:         Mapped[str]   = mapped_column(String, nullable=False)
    boss_hp:         Mapped[int]   = mapped_column(Integer, default=300)
    player_hp:       Mapped[int]   = mapped_column(Integer, default=100)
    phase:           Mapped[int]   = mapped_column(Integer, default=1)
    combo:           Mapped[int]   = mapped_column(Integer, default=0)
    outcome:         Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    xp_earned:       Mapped[int]   = mapped_column(Integer, default=0)
    started_at:      Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    ended_at:        Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
