"""
Focus engine — three-component weighted formula.

  score = 0.4 * face_presence
        + 0.3 * head_alignment
        + 0.3 * eye_engagement
  result scaled 0-100 with small emotion modifier applied last.
"""

_EMOTION_MOD: dict[str, float] = {
    "FOCUSED":    10.0,
    "BORED":     -10.0,
    "SLEEPY":    -25.0,
}


def get_focus_score(
    face_detected: bool,
    head_centered: bool,
    eyes_open: bool,
    emotion: str = "FOCUSED",
) -> float:
    """
    Standalone helper — useful for tests and the adaptive engine.
    Returns a score in [0, 100].
    """
    face_presence  = 1.0 if face_detected else 0.0
    head_alignment = 1.0 if head_centered  else 0.3
    eye_engagement = 1.0 if eyes_open      else 0.2

    base = (0.4 * face_presence + 0.3 * head_alignment + 0.3 * eye_engagement) * 100.0
    mod  = _EMOTION_MOD.get(emotion, 0.0)
    return round(min(100.0, max(0.0, base + mod)), 1)


class FocusEngine:
    """Stateless wrapper kept for pipeline compatibility."""

    def compute(
        self,
        _attention_score: float,  # kept for API compat, superseded by component formula
        emotion: str,
        face_detected: bool,
        eyes_open: bool,
        head_centered: bool = True,
    ) -> float:
        return get_focus_score(face_detected, head_centered, eyes_open, emotion)
