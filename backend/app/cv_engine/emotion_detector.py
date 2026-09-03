"""
Emotion detector using the FER library (fer==22.5.1).
Maps FER emotions → SmartFocus canonical emotion labels.
"""
import numpy as np

_FER_TO_LABEL = {
    "angry":    "BORED",
    "disgust":  "BORED",
    "fear":     "BORED",
    "happy":    "FOCUSED",
    "sad":      "BORED",
    "surprise": "BORED",
    "neutral":  "FOCUSED",
    "confused": "BORED",
}

_CANONICAL = {"FOCUSED", "BORED", "SLEEPY"}


class EmotionDetector:
    def __init__(self):
        self._fer = None
        self._load()

    def _load(self):
        try:
            from fer import FER
            self._fer = FER(mtcnn=False)
        except Exception:
            pass

    def detect(self, frame_bgr: np.ndarray) -> dict:
        """
        Returns:
            {
                "emotion": str (canonical label),
                "confidence": float (0-1),
                "raw": dict  (full FER scores),
            }
        """
        if self._fer is None or frame_bgr is None:
            return {"emotion": "FOCUSED", "confidence": 0.5, "raw": {}}

        try:
            return self._analyse(frame_bgr)
        except Exception:
            return {"emotion": "FOCUSED", "confidence": 0.5, "raw": {}}

    def _analyse(self, frame_bgr: np.ndarray) -> dict:
        result = self._fer.detect_emotions(frame_bgr)
        if not result:
            return {"emotion": "FOCUSED", "confidence": 0.5, "raw": {}}

        # Use the first detected face
        emotions: dict = result[0].get("emotions", {})
        if not emotions:
            return {"emotion": "FOCUSED", "confidence": 0.5, "raw": {}}

        top_fer = max(emotions, key=emotions.get)
        confidence = float(emotions[top_fer])
        label = _FER_TO_LABEL.get(top_fer, "FOCUSED")

        return {"emotion": label, "confidence": round(confidence, 3), "raw": emotions}
