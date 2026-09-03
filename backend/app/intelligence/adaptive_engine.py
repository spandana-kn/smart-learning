"""
Adaptive Difficulty Engine.

Stateless rule evaluator — takes current session snapshot and returns
the recommended next difficulty + any hint/break suggestion.
"""
from dataclasses import dataclass
from typing import Optional


@dataclass
class AdaptiveDecision:
    difficulty: str          # "easy" | "medium" | "hard"
    action: Optional[str]     # e.g. "REDUCE_DIFFICULTY", "OFFER_HINT", …
    message: Optional[str]   # human-readable explanation shown in the UI
    show_hint: bool = False


_DEFAULT = AdaptiveDecision(difficulty="medium", action=None, message=None)


def decide(
    focus: float,
    emotion: str,
    correct_streak: int,
    wrong_streak: int,
    current_difficulty: str = "medium",
) -> AdaptiveDecision:
    """
    Pure function — no side effects, easy to test.

    Rules (evaluated top-to-bottom, first match wins):

    1. Very low focus (<30) OR 3+ wrong in a row → easy + break hint
    2. Sleepy emotion AND focus <45               → easy + reset prompt
    3. Bored emotion AND focus >65 AND 2+ correct → hard + challenge bump
    4. High focus (>72) AND 2+ correct streak     → hard + praise
    5. Focus 45-72 AND wrong streak <2            → medium (steady)
    6. Focus <45                                  → easy
    7. Default                                    → keep current
    """
    if focus < 30 or wrong_streak >= 3:
        return AdaptiveDecision(
            difficulty="easy",
            action="REDUCE_DIFFICULTY",
            message="Switching to easier questions — take a breath, you've got this.",
        )

    if emotion == "SLEEPY" and focus < 45:
        return AdaptiveDecision(
            difficulty="easy",
            action="WAKE_PROMPT",
            message="Your eyes look closed. Take a short reset, then continue with an easier question.",
            show_hint=False,
        )

    if emotion == "BORED" and focus > 65 and correct_streak >= 2:
        return AdaptiveDecision(
            difficulty="hard",
            action="INCREASE_DIFFICULTY",
            message="You're breezing through — time to level up the challenge!",
        )

    if focus > 72 and correct_streak >= 2:
        return AdaptiveDecision(
            difficulty="hard",
            action="BOOST_ENCOURAGEMENT",
            message="You're in the zone! Pushing to harder questions.",
        )

    if 45 <= focus <= 72 and wrong_streak < 2:
        return AdaptiveDecision(
            difficulty="medium",
            action=None,
            message=None,
        )

    if focus < 45:
        return AdaptiveDecision(
            difficulty="easy",
            action="REDUCE_DIFFICULTY",
            message="Let's dial it back a notch to rebuild momentum.",
        )

    return AdaptiveDecision(difficulty=current_difficulty, action=None, message=None)


def clamp_difficulty(raw: str) -> str:
    return raw if raw in ("easy", "medium", "hard") else "medium"
