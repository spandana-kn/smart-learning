"""
HuggingFace-backed emotion detector.
Model: dima806/facial_emotions_image_detection
  — image classification, 7 classes: angry, disgust, fear, happy, neutral, sad, surprise

Returns:
    {
        "emotion":    str   — canonical SmartFocus label
        "confidence": float — top-class score (0-1)
        "raw_scores": dict  — {label: score} for all 7 classes
        "face_box":   dict  — {x,y,w,h} normalised 0-1, or None
        "eye_boxes":  list  — [{x,y,w,h} normalised] up to 2, or []
    }

Falls back gracefully when HF_TOKEN is absent or the API is unreachable.
"""
from __future__ import annotations

import io
import os
import logging
from typing import Optional

import numpy as np

log = logging.getLogger(__name__)

_HF_MODEL = "dima806/facial_emotions_image_detection"

_HF_TO_LABEL = {
    "angry":    "BORED",
    "disgust":  "BORED",
    "fear":     "BORED",
    "happy":    "FOCUSED",
    "neutral":  "FOCUSED",
    "sad":      "BORED",
    "surprise": "BORED",
}


def _get_client():
    token = os.environ.get("HF_TOKEN", "")
    if not token:
        return None
    try:
        from huggingface_hub import InferenceClient
        return InferenceClient(provider="hf-inference", api_key=token)
    except Exception:
        return None


# Module-level client (created once)
_client = None
_client_checked = False


def _client_instance():
    global _client, _client_checked
    if not _client_checked:
        _client = _get_client()
        _client_checked = True
    return _client


class HFEmotionDetector:
    """
    Combines:
      1. OpenCV Haar cascades  → face box + eye boxes (always runs locally)
      2. HuggingFace InferenceClient → emotion scores (only if HF_TOKEN is set)
    """

    def __init__(self):
        self._face_cascades = []
        self._eye_cascade = None
        self._load_cascades()

    def _load_cascades(self):
        try:
            import cv2
            for filename in (
                "haarcascade_frontalface_default.xml",
                "haarcascade_frontalface_alt2.xml",
                "haarcascade_profileface.xml",
            ):
                cascade = cv2.CascadeClassifier(cv2.data.haarcascades + filename)
                if not cascade.empty():
                    self._face_cascades.append(cascade)
            self._eye_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_eye.xml"
            )
        except Exception:
            log.warning("OpenCV cascades unavailable")

    # ── Public API ────────────────────────────────────────────────────────────

    def detect(self, frame_bgr: np.ndarray) -> dict:
        """Run face detection + HF emotion classification."""
        result = self._blank_result()

        face_box, eye_boxes, face_crop, frame_hw = self._detect_face_and_eyes(frame_bgr)
        result["face_box"] = face_box
        result["eye_boxes"] = eye_boxes

        if face_crop is not None:
            emotion_result = self._classify_emotion(face_crop)
            result.update(emotion_result)

        return result

    # ── Face + eye detection (OpenCV) ─────────────────────────────────────────

    def _detect_face_and_eyes(self, frame_bgr: np.ndarray):
        """Returns (face_box_norm, eye_boxes_norm, face_crop_bgr, (h,w))."""
        if not self._face_cascades or frame_bgr is None:
            return None, [], None, None

        try:
            import cv2
            h, w = frame_bgr.shape[:2]
            gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
            gray = cv2.equalizeHist(gray)

            faces = []
            min_face = (max(36, w // 8), max(36, h // 8))
            for cascade in self._face_cascades:
                faces = cascade.detectMultiScale(
                    gray, scaleFactor=1.08, minNeighbors=4, minSize=min_face
                )
                if len(faces) == 0:
                    faces = cascade.detectMultiScale(
                        gray, scaleFactor=1.05, minNeighbors=3, minSize=min_face
                    )
                if len(faces) > 0:
                    break
            if len(faces) == 0:
                return None, [], None, (h, w)

            # Largest face
            fx, fy, fw, fh = max(faces, key=lambda r: r[2] * r[3])
            face_box = {"x": fx / w, "y": fy / h, "w": fw / w, "h": fh / h}

            # Eyes inside face ROI
            face_roi_gray = gray[fy:fy+fh, fx:fx+fw]
            upper_face_roi = face_roi_gray[: max(1, int(fh * 0.62)), :]
            raw_eyes = self._eye_cascade.detectMultiScale(
                upper_face_roi,
                scaleFactor=1.08,
                minNeighbors=3,
                minSize=(max(12, fw // 10), max(8, fh // 16)),
            )

            eye_boxes = []
            raw_eyes = sorted(raw_eyes, key=lambda r: r[2] * r[3], reverse=True)[:2]
            for (ex, ey, ew, eh) in raw_eyes:
                eye_boxes.append({
                    "x": (fx + ex) / w,
                    "y": (fy + ey) / h,
                    "w": ew / w,
                    "h": eh / h,
                })

            face_crop = frame_bgr[fy:fy+fh, fx:fx+fw]
            return face_box, eye_boxes, face_crop, (h, w)

        except Exception as exc:
            log.debug("Face detection error: %s", exc)
            return None, [], None, None

    # ── HF emotion classification ─────────────────────────────────────────────

    def _classify_emotion(self, face_crop_bgr: np.ndarray) -> dict:
        """Call HF API or fall back to FER/neutral."""
        client = _client_instance()
        if client is None:
            return self._fer_fallback(face_crop_bgr)

        try:
            import cv2
            _, buf = cv2.imencode(".jpg", face_crop_bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
            image_bytes = io.BytesIO(buf.tobytes())

            results = client.image_classification(image_bytes, model=_HF_MODEL)
            # results is a list of ClassificationOutput with .label and .score
            raw_scores = {r.label.lower(): round(float(r.score), 4) for r in results}

            top = max(raw_scores, key=raw_scores.get)
            confidence = raw_scores[top]
            emotion = _HF_TO_LABEL.get(top, "FOCUSED")

            return {
                "emotion": emotion,
                "confidence": confidence,
                "raw_scores": raw_scores,
            }
        except Exception as exc:
            log.debug("HF API error: %s", exc)
            return self._fer_fallback(face_crop_bgr)

    def _fer_fallback(self, face_crop_bgr: np.ndarray) -> dict:
        """Use local FER library if HF is unavailable."""
        try:
            from fer import FER
            fer = FER(mtcnn=False)
            result = fer.detect_emotions(face_crop_bgr)
            if result:
                emotions = result[0].get("emotions", {})
                top = max(emotions, key=emotions.get)
                from app.cv_engine.emotion_detector import _FER_TO_LABEL
                return {
                    "emotion":    _FER_TO_LABEL.get(top, "FOCUSED"),
                    "confidence": round(float(emotions[top]), 3),
                    "raw_scores": {k: round(float(v), 3) for k, v in emotions.items()},
                }
        except Exception:
            pass
        return {"emotion": "FOCUSED", "confidence": 0.5, "raw_scores": {}}

    @staticmethod
    def _blank_result() -> dict:
        return {
            "emotion":    "FOCUSED",
            "confidence": 0.5,
            "raw_scores": {},
            "face_box":   None,
            "eye_boxes":  [],
        }
