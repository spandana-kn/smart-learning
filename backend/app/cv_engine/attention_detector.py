"""
Attention detector using facial landmark analysis.
Estimates head pose (yaw/pitch) via eye and face geometry to detect
whether the user is looking at the screen.
"""
import math
import numpy as np


class AttentionDetector:
    def __init__(self):
        self._cascades = []
        self._eye_cascade = None
        self._closed_eye_frames = 0
        self._open_eye_frames = 0
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
                    self._cascades.append(cascade)
            self._eye_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_eye.xml"
            )
        except Exception:
            pass

    def detect(self, frame_bgr: np.ndarray) -> dict:
        """
        Returns:
            {
                "face_detected": bool,
                "attention_score": float (0-1),
                "eyes_open": bool,
                "head_centered": bool,
                "face_box": dict | None,
                "eye_boxes": list[dict],
            }
        """
        if not self._cascades or frame_bgr is None:
            return self._no_face_result()

        try:
            return self._analyse(frame_bgr)
        except Exception:
            return self._no_face_result()

    def _analyse(self, frame_bgr: np.ndarray) -> dict:
        import cv2

        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        h, w = gray.shape

        faces = []
        min_face = (max(36, w // 8), max(36, h // 8))
        for cascade in self._cascades:
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
            return self._no_face_result()

        # Use the largest face
        x, y, fw, fh = max(faces, key=lambda r: r[2] * r[3])

        face_cx = x + fw / 2
        face_cy = y + fh / 2

        # How centred is the face in the frame?
        dx = abs(face_cx / w - 0.5) * 2   # 0 = centred, 1 = at edge
        dy = abs(face_cy / h - 0.5) * 2
        centred_score = max(0.0, 1.0 - math.sqrt(dx**2 + dy**2))
        head_centered = centred_score > 0.5

        # Eye detection inside face ROI
        face_roi = gray[y:y+fh, x:x+fw]
        upper_face_roi = face_roi[: max(1, int(fh * 0.62)), :]
        eyes = self._eye_cascade.detectMultiScale(
            upper_face_roi,
            scaleFactor=1.08,
            minNeighbors=3,
            minSize=(max(12, fw // 10), max(8, fh // 16)),
        )
        eyes = sorted(eyes, key=lambda r: r[2] * r[3], reverse=True)[:2]
        eye_count = len(eyes)
        eyes_found = eye_count >= 1
        if eyes_found:
            self._open_eye_frames += 1
            self._closed_eye_frames = 0
        else:
            self._closed_eye_frames += 1
            self._open_eye_frames = 0

        # Haar cascades detect open eyes much better than closed eyelids.
        # Require two consecutive no-eye frames before treating it as closed.
        eyes_open = self._closed_eye_frames < 2

        # Face size relative to frame (proxy for proximity / presence)
        face_area_ratio = (fw * fh) / (w * h)
        # Ideal: face fills 10-40% of frame
        size_score = min(face_area_ratio / 0.25, 1.0) if face_area_ratio <= 0.25 else max(0.5, 1.0 - (face_area_ratio - 0.25) * 2)

        eye_engagement = 1.0 if eye_count >= 2 else 0.55 if eye_count == 1 else 0.15
        if not eyes_open:
            eye_engagement = 0.0

        attention_score = (
            0.4 * centred_score
            + 0.4 * eye_engagement
            + 0.2 * size_score
        )
        attention_score = round(min(1.0, max(0.0, attention_score)), 3)

        return {
            "face_detected": True,
            "attention_score": attention_score,
            "eyes_open": eyes_open,
            "eye_count": eye_count,
            "head_centered": head_centered,
            "eyes_closed": not eyes_open,
            "face_box": {"x": x / w, "y": y / h, "w": fw / w, "h": fh / h},
            "eye_boxes": [
                {"x": (x + ex) / w, "y": (y + ey) / h, "w": ew / w, "h": eh / h}
                for ex, ey, ew, eh in eyes
            ],
        }

    @staticmethod
    def _no_face_result() -> dict:
        return {
            "face_detected": False,
            "attention_score": 0.0,
            "eyes_open": False,
            "eye_count": 0,
            "head_centered": False,
            "eyes_closed": True,
            "face_box": None,
            "eye_boxes": [],
        }
