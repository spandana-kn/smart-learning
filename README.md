# SmartFocus

**Emotion-Aware Gamified Adaptive Learning Platform**

SmartFocus uses webcam-based computer vision to track student focus and emotion in real time, then adapts the learning experience through gamified quests, boss battles, and an AI Oracle tutor.

---

## Stack

| Layer     | Technology                                     |
|-----------|------------------------------------------------|
| Frontend  | React 18 + Vite + TypeScript + Tailwind CSS    |
| Backend   | FastAPI + SQLAlchemy (async) + SQLite          |
| CV Engine | OpenCV + FER (Facial Expression Recognition)  |
| Auth      | JWT (python-jose)                              |
| Real-time | WebSocket (`/ws/cv-stream`)                    |

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+ / npm

### One-command setup

```bash
bash setup.sh
```

### Manual setup

**Backend**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # edit SECRET_KEY for production
uvicorn app.main:app --reload
```

API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

App will be available at `http://localhost:5173`.

---

## Demo Credentials

| Role    | Email               | Password   |
|---------|---------------------|------------|
| Student | demo@student.com    | demo1234   |
| Teacher | demo@teacher.com    | demo1234   |

---

## Project Structure

```
smartfocus/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/          # REST endpoints (auth, users, quests, skills, focus, boss, teacher)
│   │   │   └── ws/          # WebSocket CV stream
│   │   ├── cv_engine/       # Computer vision pipeline
│   │   │   ├── attention_detector.py
│   │   │   ├── emotion_detector.py
│   │   │   ├── focus_engine.py
│   │   │   └── pipeline.py
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── core/            # DB, security, exceptions
│   │   └── main.py          # App entry point + seeder
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── pages/           # Student & Teacher pages
│       ├── components/      # CV overlay, gamification, layout
│       ├── stores/          # Zustand state (auth, cv, gamification)
│       ├── services/        # API clients
│       └── hooks/           # useWebSocket
├── setup.sh
└── README.md
```

---

## Key Features

- **Real-time focus tracking** — webcam frames sent over WebSocket, processed by OpenCV + FER
- **Adaptive engine** — automatically triggers hints, difficulty changes, and breaks based on focus/emotion state
- **Gamified quests** — 6 subject quests (Math, Physics, English) with 5 MCQs each, XP rewards, and skill trees
- **Boss battles** — combo-based damage system with phase mechanics and focus multipliers
- **Emotion Oracle** — historical emotion and focus analytics with personalised insights
- **Teacher dashboard** — class overview with per-student focus history and at-risk flagging

---

## CV Pipeline

```
WebSocket frame (base64 JPEG)
    ↓
CVPipeline.process_frame(bytes)
    ├─ AttentionDetector  → face presence, eye openness, head centring
    ├─ EmotionDetector    → FER → canonical label (FOCUSED/ENGAGED/NEUTRAL/…)
    └─ FocusEngine        → weighted fusion → score 0–100
    ↓
FOCUS_UPDATE + EMOTION_UPDATE messages back to client
```

If OpenCV/FER is unavailable (e.g. no camera), the system degrades gracefully to a behavioural fallback that converges focus to 60.

---

## API Endpoints

| Method | Path                          | Description               |
|--------|-------------------------------|---------------------------|
| POST   | /api/v1/auth/login            | JWT login                 |
| POST   | /api/v1/auth/register         | Register new user         |
| GET    | /api/v1/users/me              | Current user profile      |
| GET    | /api/v1/quests                | List all quests           |
| POST   | /api/v1/quests/{id}/start     | Start a quest session     |
| POST   | /api/v1/quests/{id}/answer    | Submit an answer          |
| GET    | /api/v1/skills                | Skill tree data           |
| GET    | /api/v1/boss/available        | List boss encounters      |
| POST   | /api/v1/boss/{id}/start       | Start a boss battle       |
| POST   | /api/v1/boss/{id}/attack      | Submit attack answer      |
| GET    | /api/v1/focus/history         | Focus log history         |
| GET    | /api/v1/emotions/history      | Emotion log history       |
| GET    | /api/v1/teacher/class         | Teacher: class overview   |
| GET    | /api/v1/teacher/student/{id}  | Teacher: student detail   |
| WS     | /ws/cv-stream                 | Real-time CV stream       |
