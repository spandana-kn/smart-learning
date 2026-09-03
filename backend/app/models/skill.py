import uuid
from typing import Optional
from sqlalchemy import String, Integer, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class Skill(Base):
    __tablename__ = "skills"

    id:          Mapped[str]        = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name:        Mapped[str]        = mapped_column(String(255), nullable=False)
    subject:     Mapped[str]        = mapped_column(String(100), nullable=False)
    description: Mapped[str]        = mapped_column(String(500), default="")
    difficulty:  Mapped[str]        = mapped_column(String(10), default="medium")
    bloom_level: Mapped[str]        = mapped_column(String(30), default="remember")
    prereq_ids:  Mapped[Optional[list]] = mapped_column(JSON, default=list)
    icon_name:   Mapped[str]        = mapped_column(String(50), default="book")
    xp_reward:   Mapped[int]        = mapped_column(Integer, default=50)
