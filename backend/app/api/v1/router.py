from fastapi import APIRouter
from app.api.v1 import auth, users, quests, skills, focus, emotions, boss, teacher, graph

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(quests.router)
api_router.include_router(skills.router)
api_router.include_router(focus.router)
api_router.include_router(emotions.router)
api_router.include_router(boss.router)
api_router.include_router(teacher.router)
api_router.include_router(graph.router)
