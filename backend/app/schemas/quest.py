from typing import Any, Optional
from pydantic import BaseModel

class MCQOption(BaseModel):
    label: str
    text: str
    is_correct: bool

class QuestionOut(BaseModel):
    id: str
    quest_id: str
    skill_id: Optional[str]
    question_text: str
    question_type: str
    options: Optional[list[MCQOption]]
    correct_answer: str
    explanation: str
    hints: Optional[list[dict]]
    difficulty: str
    bloom_level: str

    model_config = {"from_attributes": True}

class QuestOut(BaseModel):
    id: str
    title: str
    description: str
    subject: str
    base_difficulty: str
    question_count: int
    xp_reward_base: int
    min_level: int
    status: str = "not_started"
    progress_pct: int = 0
    skill_name: str = ""

    model_config = {"from_attributes": True}

class QuestStartResponse(BaseModel):
    session_quest_id: str
    first_question: QuestionOut

class AnswerRequest(BaseModel):
    question_id: str
    answer: str
    time_taken_ms: int
    hint_tier_used: int = 0
    # Adaptive engine inputs — sent from frontend CV store
    focus_score: float = 50.0
    emotion: str = "FOCUSED"
    correct_streak: int = 0
    wrong_streak: int = 0

class AnswerResponse(BaseModel):
    correct: bool
    xp_earned: int
    feedback: str
    explanation: str
    next_question: Optional[QuestionOut]
    combo: int
    adaptation_applied: Optional[dict] = None

class HintResponse(BaseModel):
    hint_text: str
    xp_multiplier_remaining: float
