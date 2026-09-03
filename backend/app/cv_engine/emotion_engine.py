"""
Heuristic emotion engine — derives emotional state from face geometry deltas.
No ML model required; works as a reliable fallback when FER is unavailable.

Rules (in priority order):
  1. No face                → BORED
  2. Face present + eyes closed → SLEEPY
  3. Face stable + eyes open → FOCUSED
  4. Default                → BORED
"""

import math
from collections import deque

# How many frames of history to keep for movement analysis (~3 seconds at 2fps)
_HISTORY = 6


class EmotionEngine:
    def __init__(self):
        # Ring buffer of (cx, cy, attention_score) tuples
        self._history: deque[tuple[float, float, float]] = deque(maxlen=_HISTORY)
        self._stable_frames = 0

    def update(
        self,
        face_detected: bool,
        head_centered: bool,
        eyes_open: bool,
        attention_score: float,
        face_cx: float = 0.5,  # normalised 0-1
        face_cy: float = 0.5,
    ) -> dict:
        """
        Returns:
            {"emotion": str, "confidence": float}
        """
        if not face_detected:
            self._history.clear()
            self._stable_frames = 0
            return {"emotion": "BORED", "confidence": 0.85}

        self._history.append((face_cx, face_cy, attention_score))

        # ── Sleepiness: face present but eyes are not visible/open ───────────
        if not eyes_open:
            self._stable_frames = 0
            return {"emotion": "SLEEPY", "confidence": 0.88}

        # Movement or looking away is treated as loss of focus, not a separate emotion.
        jitter = self._compute_jitter()
        if jitter > 0.05:
            self._stable_frames = 0
            return {"emotion": "BORED", "confidence": min(0.86, 0.58 + jitter * 4)}

        if not head_centered and eyes_open:
            self._stable_frames = 0
            return {"emotion": "BORED", "confidence": 0.70}

        # ── Stable + engaged ─────────────────────────────────────────────────
        if eyes_open and head_centered:
            self._stable_frames += 1
        else:
            self._stable_frames = max(0, self._stable_frames - 1)

        if self._stable_frames >= 4:
            return {"emotion": "FOCUSED", "confidence": min(0.92, 0.70 + attention_score * 0.25)}

        return {"emotion": "BORED", "confidence": 0.60}

    def _compute_jitter(self) -> float:
        """Mean frame-to-frame Euclidean displacement of face centre."""
        if len(self._history) < 2:
            return 0.0
        total = 0.0
        h = list(self._history)
        for i in range(1, len(h)):
            dx = h[i][0] - h[i - 1][0]
            dy = h[i][1] - h[i - 1][1]
            total += math.sqrt(dx * dx + dy * dy)
        return total / (len(h) - 1)
