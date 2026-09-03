"""
Teacher Risk Engine — analyses a student's focus + emotion history and
produces a risk classification and actionable suggestions.
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class RiskProfile:
    level: str                   # "LOW" | "MEDIUM" | "HIGH"
    score: float                 # 0-100, lower = more at risk
    reasons: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)


def analyse(
    avg_focus: float,
    streak_days: int,
    dominant_emotion: Optional[str],
    frustrated_pct: float = 0.0,   # 0-1, share of sleepy/low-readiness readings
    sessions_last_7d: int = 0,
) -> RiskProfile:
    """
    Pure function — easy to test, no DB access.

    Scoring rubric (lower raw score = higher risk):
      base = avg_focus (0-100)
      streak bonus  : +10 if streak >= 5, +5 if >= 2
      emotion penalty: -20 if sleepy share > 0.4, -10 if > 0.2
      inactivity penalty: -15 if sessions = 0
    """
    score = avg_focus

    if streak_days >= 5:
        score += 10
    elif streak_days >= 2:
        score += 5
    elif streak_days == 0:
        score -= 10

    if frustrated_pct > 0.4:
        score -= 20
    elif frustrated_pct > 0.2:
        score -= 10

    if sessions_last_7d == 0:
        score -= 15

    score = max(0.0, min(100.0, score))

    reasons: list[str] = []
    suggestions: list[str] = []

    if avg_focus < 35:
        reasons.append("Very low average focus this week")
        suggestions.append("Schedule shorter 20-min study blocks")
    elif avg_focus < 55:
        reasons.append("Below-average focus levels")
        suggestions.append("Try the Focus Oracle for pattern insights")

    if frustrated_pct > 0.4:
        reasons.append("High sleepiness detected in sessions")
        suggestions.append("Reduce session length and add short reset breaks")
    elif frustrated_pct > 0.2:
        reasons.append("Moderate sleepiness in some sessions")

    if streak_days == 0:
        reasons.append("No study activity in recent days")
        suggestions.append("Send a re-engagement nudge")

    if sessions_last_7d == 0:
        reasons.append("Zero sessions recorded in 7 days")
        suggestions.append("Check if student needs technical support")

    if dominant_emotion == "BORED":
        reasons.append("Predominantly bored emotion state")
        suggestions.append("Introduce boss battles or increase challenge level")
    elif dominant_emotion == "SLEEPY":
        reasons.append("Predominantly sleepy emotion state")
        suggestions.append("Schedule a break before harder concepts")

    # Classify
    if score < 40:
        level = "HIGH"
    elif score < 65:
        level = "MEDIUM"
    else:
        level = "LOW"

    return RiskProfile(
        level=level,
        score=round(score, 1),
        reasons=reasons,
        suggestions=suggestions,
    )
