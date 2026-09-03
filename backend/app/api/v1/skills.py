from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User, SkillMastery
from app.models.skill import Skill

router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("")
async def list_skills(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = await db.execute(select(Skill))
    skills = r.scalars().all()

    mastery_r = await db.execute(
        select(SkillMastery).where(SkillMastery.user_id == user.id)
    )
    mastery_map = {m.skill_id: m.mastery for m in mastery_r.scalars().all()}

    result = []
    for s in skills:
        mastery = mastery_map.get(s.id, 0.0)
        prereqs_met = all(mastery_map.get(pid, 0.0) >= 0.3 for pid in (s.prereq_ids or []))
        status = (
            "locked" if not prereqs_met and s.prereq_ids
            else "mastered" if mastery >= 0.85
            else "in_progress" if mastery > 0
            else "available"
        )
        result.append({
            "id": s.id, "name": s.name, "subject": s.subject,
            "description": s.description, "difficulty": s.difficulty,
            "mastery": round(mastery, 3), "status": status,
            "prereq_ids": s.prereq_ids or [],
            "icon_name": s.icon_name, "xp_reward": s.xp_reward,
        })
    return result


@router.get("/tree")
async def get_skill_tree(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = await db.execute(select(Skill))
    skills = r.scalars().all()

    mastery_r = await db.execute(
        select(SkillMastery).where(SkillMastery.user_id == user.id)
    )
    mastery_map = {m.skill_id: m.mastery for m in mastery_r.scalars().all()}

    nodes = []
    edges = []
    for s in skills:
        mastery = mastery_map.get(s.id, 0.0)
        prereqs_met = all(mastery_map.get(pid, 0.0) >= 0.3 for pid in (s.prereq_ids or []))
        status = (
            "locked" if not prereqs_met and s.prereq_ids
            else "mastered" if mastery >= 0.85
            else "in_progress" if mastery > 0
            else "available"
        )
        nodes.append({
            "id": s.id, "name": s.name, "subject": s.subject,
            "description": s.description, "difficulty": s.difficulty,
            "mastery": round(mastery, 3), "status": status,
            "prereq_ids": s.prereq_ids or [],
            "icon_name": s.icon_name, "xp_reward": s.xp_reward,
        })
        for prereq_id in (s.prereq_ids or []):
            edges.append({"source": prereq_id, "target": s.id})

    return {"nodes": nodes, "edges": edges}
