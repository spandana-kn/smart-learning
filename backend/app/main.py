import logging
logging.getLogger("passlib").setLevel(logging.ERROR)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.core.database import init_db
from app.api.v1.router import api_router
from app.api.ws.cv_stream import ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await _seed_demo_data()
    _init_graph()
    yield


app = FastAPI(
    title="SMARTFOCUS API",
    version="1.0.0",
    description="Emotion-Aware Gamified Adaptive Learning Platform",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
app.include_router(ws_router)


@app.get("/health")
async def health():
    from app.db.neo4j_db import get_mode
    return {"status": "ok", "service": "smartfocus-api", "graph_mode": get_mode()}


def _init_graph() -> None:
    """Initialize Neo4j (or MOCK mode) and pre-load the question bank."""
    from app.db.neo4j_db import init_neo4j
    from app.importers.csv_importer import load_questions, seed_neo4j_concepts, seed_neo4j_questions
    mode = init_neo4j()
    questions = load_questions()
    print(f"📚 Question bank loaded: {len(questions)} questions  [graph mode: {mode}]")
    if mode == "LIVE":
        seed_neo4j_concepts()
        seed_neo4j_questions(questions)
        print("✅ Neo4j concept graph seeded")


async def _seed_demo_data():
    """Seed demo users, skills, quests, questions, and bosses on first run."""
    from app.core.database import AsyncSessionLocal
    from app.core.security import hash_password
    from app.models.user import User
    from app.models.skill import Skill
    from app.models.quest import Quest, Question
    from app.models.boss import Boss
    from sqlalchemy import select, func

    async with AsyncSessionLocal() as db:
        # Skip if data already seeded
        count = await db.execute(select(func.count()).select_from(User))
        if count.scalar() > 0:
            return

        print("🌱 Seeding demo data...")

        # Demo users
        student = User(email="demo@student.com", password_hash=hash_password("demo1234"),
                       full_name="Alex Mercer", role="student", level=3,
                       xp_current=240, xp_total=740, xp_to_next=449, streak_days=5)
        teacher = User(email="demo@teacher.com", password_hash=hash_password("demo1234"),
                       full_name="Dr. Sarah Chen", role="teacher")
        db.add_all([student, teacher])
        await db.flush()

        # Skills
        skills = [
            Skill(name="Algebra Basics",      subject="Mathematics", difficulty="easy",   bloom_level="remember",  prereq_ids=[],               xp_reward=50),
            Skill(name="Linear Equations",     subject="Mathematics", difficulty="medium", bloom_level="apply",     prereq_ids=[],               xp_reward=80),
            Skill(name="Quadratic Functions",  subject="Mathematics", difficulty="hard",   bloom_level="analyze",   prereq_ids=[],               xp_reward=120),
            Skill(name="Newton's Laws",        subject="Physics",     difficulty="easy",   bloom_level="understand",prereq_ids=[],               xp_reward=60),
            Skill(name="Kinematics",           subject="Physics",     difficulty="medium", bloom_level="apply",     prereq_ids=[],               xp_reward=90),
            Skill(name="Grammar Foundations",  subject="English",     difficulty="easy",   bloom_level="remember",  prereq_ids=[],               xp_reward=40),
        ]
        db.add_all(skills)
        await db.flush()

        skill_ids = [s.id for s in skills]

        # Quests
        quests = [
            Quest(title="The Algebra Dungeon",   description="Master the fundamentals of algebra. Face equations head-on!",
                  subject="Mathematics", base_difficulty="easy",   xp_reward_base=120, question_count=5, skill_id=skill_ids[0]),
            Quest(title="Linear Realms",          description="Solve linear equations to unlock the next tier of power.",
                  subject="Mathematics", base_difficulty="medium",  xp_reward_base=200, question_count=5, skill_id=skill_ids[1]),
            Quest(title="The Quadratic Fortress", description="Advanced algebra awaits. Prove your mathematical might!",
                  subject="Mathematics", base_difficulty="hard",    xp_reward_base=350, question_count=5, skill_id=skill_ids[2]),
            Quest(title="Newton's Trial",         description="Understand the three laws that govern the universe.",
                  subject="Physics",     base_difficulty="easy",    xp_reward_base=130, question_count=5, skill_id=skill_ids[3]),
            Quest(title="Kinematics Chronicles",  description="Motion, velocity, acceleration — master them all.",
                  subject="Physics",     base_difficulty="medium",  xp_reward_base=210, question_count=5, skill_id=skill_ids[4]),
            Quest(title="Grammar Gauntlet",       description="Conquer the rules of English grammar.",
                  subject="English",     base_difficulty="easy",    xp_reward_base=100, question_count=5, skill_id=skill_ids[5]),
        ]
        db.add_all(quests)
        await db.flush()

        # Questions (5 per quest)
        questions = []
        quest_data = [
            # Algebra (quest 0)
            [("What is 2x + 3 = 11? Solve for x.", "A", [("A","x = 4"),("B","x = 3"),("C","x = 5"),("D","x = 7")], "easy",
              "Subtract 3: 2x=8, divide by 2: x=4.", [{"tier":0,"text":"Subtract 3 from both sides first."}]),
             ("Simplify: 3(x + 2) - x", "B", [("A","2x+2"),("B","2x+6"),("C","3x+6"),("D","4x+2")], "easy",
              "3x+6-x = 2x+6", [{"tier":0,"text":"Distribute the 3 first."}]),
             ("What is the value of 5² - 3²?", "C", [("A","4"),("B","16"),("C","16"),("D","25")], "easy",
              "25 - 9 = 16", [{"tier":0,"text":"Calculate each square separately."}]),
             ("Factor: x² - 9", "A", [("A","(x-3)(x+3)"),("B","(x-9)(x+1)"),("C","(x+3)²"),("D","x(x-9)")], "medium",
              "Difference of squares: (x-3)(x+3)", [{"tier":0,"text":"This is a difference of two squares."}]),
             ("Solve: x/4 = 5", "B", [("A","x=15"),("B","x=20"),("C","x=25"),("D","x=1")], "easy",
              "Multiply both sides by 4: x=20", [{"tier":0,"text":"Multiply both sides by 4."}]),
            ],
            # Linear Equations (quest 1)
            [("Solve: 2x - 5 = 9", "C", [("A","x=5"),("B","x=6"),("C","x=7"),("D","x=2")], "medium",
              "2x=14, x=7", [{"tier":0,"text":"Add 5 to both sides first."}]),
             ("What is the slope of y = 3x + 2?", "A", [("A","3"),("B","2"),("C","1"),("D","5")], "easy",
              "Slope is the coefficient of x", [{"tier":0,"text":"y = mx + b, m is slope."}]),
             ("Which point lies on y = 2x - 1?", "B", [("A","(1,0)"),("B","(2,3)"),("C","(0,1)"),("D","(3,4)")], "medium",
              "y=2(2)-1=3 ✓", [{"tier":0,"text":"Substitute each x value."}]),
             ("Find x: 3x + 2 = 2x + 8", "D", [("A","x=4"),("B","x=3"),("C","x=2"),("D","x=6")], "medium",
              "x=6", [{"tier":0,"text":"Move 2x to the left side."}]),
             ("What is the y-intercept of y = -2x + 7?", "C", [("A","-2"),("B","2"),("C","7"),("D","-7")], "easy",
              "y-intercept is b in y=mx+b", [{"tier":0,"text":"The y-intercept is when x=0."}]),
            ],
            # Quadratic (quest 2)
            [("Solve: x² - 5x + 6 = 0", "A", [("A","x=2,3"),("B","x=1,6"),("C","x=-2,-3"),("D","x=2,-3")], "hard",
              "Factor: (x-2)(x-3)=0", [{"tier":0,"text":"Try to factor into (x-a)(x-b)."}]),
             ("What is the vertex form?", "B", [("A","ax+b=0"),("B","a(x-h)²+k"),("C","ax²+bx"),("D","a/x+b")], "medium",
              "Vertex form is a(x-h)²+k", [{"tier":0,"text":"Vertex form shows the turning point."}]),
             ("Discriminant of x²-4x+4?", "C", [("A","8"),("B","4"),("C","0"),("D","-4")], "hard",
              "b²-4ac = 16-16 = 0", [{"tier":0,"text":"Formula: b²-4ac"}]),
             ("Roots of x²-1=0?", "A", [("A","x=±1"),("B","x=1"),("C","x=0"),("D","No roots")], "medium",
              "(x-1)(x+1)=0", [{"tier":0,"text":"Difference of squares."}]),
             ("Parabola opens down when?", "D", [("A","a=0"),("B","a>0"),("C","b<0"),("D","a<0")], "easy",
              "Negative a makes it open downward", [{"tier":0,"text":"Think about the sign of the leading coefficient."}]),
            ],
            # Newton's Laws (quest 3)
            [("Newton's 1st law is also called?", "B", [("A","Action-Reaction"),("B","Law of Inertia"),("C","Law of Gravity"),("D","Law of Motion")], "easy",
              "Inertia means resistance to change in motion", [{"tier":0,"text":"Think about objects at rest staying at rest."}]),
             ("F = ma is Newton's which law?", "C", [("A","First"),("B","Third"),("C","Second"),("D","Fourth")], "easy",
              "F=ma is the second law", [{"tier":0,"text":"It relates force, mass, and acceleration."}]),
             ("A 10kg object with a=2m/s². Force?", "A", [("A","20N"),("B","10N"),("C","5N"),("D","12N")], "medium",
              "F=ma=10×2=20N", [{"tier":0,"text":"Use F=ma directly."}]),
             ("Action-reaction pairs act on?", "B", [("A","Same object"),("B","Different objects"),("C","Equal masses"),("D","Frictionless surfaces")], "medium",
              "Newton's 3rd: equal forces on different objects", [{"tier":0,"text":"Think about what object the force acts on."}]),
             ("Unit of force?", "D", [("A","Joule"),("B","Watt"),("C","Pascal"),("D","Newton")], "easy",
              "Force is measured in Newtons (N)", [{"tier":0,"text":"Named after Sir Isaac Newton."}]),
            ],
            # Kinematics (quest 4)
            [("v = u + at. What is v?", "A", [("A","Final velocity"),("B","Initial velocity"),("C","Acceleration"),("D","Time")], "easy",
              "v = final velocity in SUVAT", [{"tier":0,"text":"SUVAT equations of motion."}]),
             ("Object at rest falls for 3s. Distance (g=10)?", "C", [("A","15m"),("B","20m"),("C","45m"),("D","30m")], "medium",
              "s = ½×10×9 = 45m", [{"tier":0,"text":"Use s = ½gt²"}]),
             ("Speed vs velocity: difference?", "B", [("A","Speed has direction"),("B","Velocity has direction"),("C","Same thing"),("D","Velocity has no direction")], "easy",
              "Velocity is a vector — has magnitude and direction", [{"tier":0,"text":"Think about scalar vs vector quantities."}]),
             ("Acceleration when velocity constant?", "D", [("A","Maximum"),("B","Increasing"),("C","1 m/s²"),("D","Zero")], "easy",
              "Constant velocity means zero acceleration", [{"tier":0,"text":"a = Δv/Δt"}]),
             ("Car decelerates from 20m/s to rest in 4s. a=?", "A", [("A","-5 m/s²"),("B","5 m/s²"),("C","-4 m/s²"),("D","-80 m/s²")], "medium",
              "a = (0-20)/4 = -5 m/s²", [{"tier":0,"text":"Use a = (v-u)/t"}]),
            ],
            # Grammar (quest 5)
            [("Which is a proper noun?", "C", [("A","city"),("B","river"),("C","London"),("D","mountain")], "easy",
              "Proper nouns name specific places/people", [{"tier":0,"text":"Proper nouns are always capitalised."}]),
             ("Correct sentence?", "A", [("A","She runs every day."),("B","She run every day."),("C","She running every day."),("D","She runned every day.")], "easy",
              "Subject-verb agreement: She + runs", [{"tier":0,"text":"Check subject-verb agreement."}]),
             ("Past tense of 'go'?", "B", [("A","goed"),("B","went"),("C","gone"),("D","going")], "easy",
              "'went' is the past tense of 'go'", [{"tier":0,"text":"'go' is an irregular verb."}]),
             ("An adjective modifies?", "C", [("A","A verb"),("B","Another adverb"),("C","A noun"),("D","A preposition")], "easy",
              "Adjectives describe nouns", [{"tier":0,"text":"Think: 'a red ball' — what does 'red' describe?"}]),
             ("Which uses a semicolon correctly?", "D", [("A","I like cats, and dogs."),("B","I like; cats and dogs."),("C","I like cats; and dogs."),("D","I like cats; I dislike dogs.")], "medium",
              "Semicolons join two independent clauses", [{"tier":0,"text":"Both sides of the semicolon must be complete sentences."}]),
            ],
        ]

        for qi, (quest, qdata) in enumerate(zip(quests, quest_data)):
            for q_text, correct, opts, diff, expl, hints in qdata:
                options = [{"label": l, "text": t, "is_correct": l == correct} for l, t in opts]
                questions.append(Question(
                    quest_id=quest.id, skill_id=skill_ids[qi],
                    question_text=q_text, question_type="mcq",
                    options=options, correct_answer=correct,
                    explanation=expl, hints=hints, difficulty=diff, bloom_level="apply",
                ))

        db.add_all(questions)

        # Bosses
        bosses = [
            Boss(name="The Algebra Golem",    subject="Mathematics", sprite_id="algebra_golem",
                 lore_text="Forged from unsolved equations, it guards the gateway to higher mathematics.",
                 hp_total=200, unlock_level=1),
            Boss(name="The Derivative Dragon", subject="Mathematics", sprite_id="derivative_dragon",
                 lore_text="An ancient beast who speaks only in rates of change.",
                 hp_total=300, unlock_level=3),
            Boss(name="The Grammar Ghost",    subject="English", sprite_id="grammar_ghost",
                 lore_text="A specter born from misspelled words and dangling modifiers.",
                 hp_total=150, unlock_level=1),
        ]
        db.add_all(bosses)
        await db.commit()
        print("✅ Demo data seeded!")
