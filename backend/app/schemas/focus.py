from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class FocusDataOut(BaseModel):
    score: float
    attention: float
    accuracy: float = 0.0
    speed: float = 0.0
    duration: float = 0.0
    state: str
    computed_at: str

class EmotionDataOut(BaseModel):
    emotion: str
    confidence: float
    probabilities: dict
    since: str

class FocusHistoryPoint(BaseModel):
    timestamp: str
    score: float
    emotion: str
    state: str

class HeatmapCell(BaseModel):
    date: str
    avg_score: float
    study_minutes: int

class InsightOut(BaseModel):
    type: str
    message: str
    severity: str
    action: Optional[str] = None

class SessionStartResponse(BaseModel):
    session_id: str

class SessionEndResponse(BaseModel):
    duration_secs: int
    avg_focus: float
    peak_focus: float
    xp_from_focus: int
