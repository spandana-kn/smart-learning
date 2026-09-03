import asyncio
import csv
import os
import random
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, delete
from app.core.database import AsyncSessionLocal
from app.models.user import User, StudentProgress, SkillMastery
from app.models.session_model import Session, FocusLog, EmotionLog

# Path to the CSV
CSV_PATH = "../testing/student_testing_results.csv"

def parse_csv_test_cases():
    cases = []
    if not os.path.exists(CSV_PATH):
        print(f"CSV not found at {CSV_PATH}")
        return cases
    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            cases.append(row)
    return cases

def find_best_match(user_name, user_email, test_cases):
    user_name_lower = user_name.lower().strip()
    user_email_lower = user_email.lower().strip()
    
    # Try exact match on name
    for case in test_cases:
        if case['student_name'].lower().strip() == user_name_lower:
            return case
            
    # Try prefix match on name (e.g. "shankar" matches "Shankar Nair")
    for case in test_cases:
        case_name = case['student_name'].lower().strip()
        if user_name_lower in case_name or case_name in user_name_lower:
            return case
            
    # Try email matching
    for case in test_cases:
        case_email = case['student_email'].lower().strip()
        if user_email_lower.split('@')[0] in case_email or case_email.split('@')[0] in user_email_lower:
            return case

    # Fallbacks for specific names seen in screenshot
    if "shankar" in user_name_lower:
        # Match to Shankar Shetty (TC043)
        return next((c for c in test_cases if c['test_case_id'] == 'TC043'), None)
    if "spandu" in user_name_lower or "spandana" in user_name_lower:
        # Match to Spandana Kumar (TC048)
        return next((c for c in test_cases if c['test_case_id'] == 'TC048'), None)
    if "ra,esh" in user_name_lower:
        # Match to a random medium risk student (e.g. TC026 - Nikhil Bhat) for variation
        return next((c for c in test_cases if c['risk_level'] == 'MEDIUM'), None)
        
    return None

async def simulate_for_user(db, user, case):
    print(f"⚡ Simulating logs for {user.full_name} matching {case['student_name']} (Risk: {case['risk_level']})")
    
    # 1. Clean old logs
    user_id = user.id
    await db.execute(delete(FocusLog).where(FocusLog.user_id == user_id))
    await db.execute(delete(EmotionLog).where(EmotionLog.user_id == user_id))
    
    # Find all sessions for this user and delete them
    r = await db.execute(select(Session).where(Session.user_id == user_id))
    sessions = r.scalars().all()
    for s in sessions:
        await db.execute(delete(Session).where(Session.id == s.id))
        
    # Clear old progress/mastery to make counts accurate
    await db.execute(delete(StudentProgress).where(StudentProgress.user_id == user_id))
    await db.execute(delete(SkillMastery).where(SkillMastery.user_id == user_id))

    # Parse parameters from CSV
    sessions_count = int(case['sessions_tested'] or 3)
    total_samples = int(case['webcam_samples'] or 80)
    face_rate = float(case['face_detection_rate_pct'] or 90.0) / 100.0
    avg_focus = float(case['avg_focus_pct'] or 70.0)
    focused_pct = float(case['focused_pct'] or 70.0) / 100.0
    bored_pct = float(case['bored_pct'] or 15.0) / 100.0
    sleepy_pct = float(case['sleepy_pct'] or 15.0) / 100.0
    completed_count = int(case['topics_completed_count'] or 3)
    
    # Update User properties
    user.streak_days = 6 if case['risk_level'] == 'LOW' else 3 if case['risk_level'] == 'MEDIUM' else 0
    user.level = 3 if case['risk_level'] == 'LOW' else 2 if case['risk_level'] == 'MEDIUM' else 1
    user.last_active = datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 24))
    db.add(user)

    # 2. Add Completed Quests & Mastery
    topics = [
        "Algebra Basics", "Linear Equations", "Quadratic Functions",
        "Newton's Laws", "Kinematics", "Grammar Foundations"
    ]
    for i in range(min(completed_count, len(topics))):
        db.add(StudentProgress(
            user_id=user_id,
            quest_id=topics[i],
            status="completed",
            progress_pct=100,
            xp_earned=150,
            completed_at=datetime.now(timezone.utc) - timedelta(days=random.randint(1, 6))
        ))
        db.add(SkillMastery(
            user_id=user_id,
            skill_id=topics[i].lower().replace(" ", "_"),
            mastery=0.75 + random.random() * 0.2,
            correct_count=12,
            wrong_count=2,
            last_practiced=datetime.now(timezone.utc) - timedelta(days=random.randint(1, 6))
        ))

    # Add currently in progress topic if completed count is not max
    if completed_count < len(topics):
        db.add(StudentProgress(
            user_id=user_id,
            quest_id=topics[completed_count],
            status="in_progress",
            progress_pct=int(case.get('current_topic_progress_pct') or 45),
            xp_earned=50,
            started_at=datetime.now(timezone.utc) - timedelta(hours=12)
        ))

    # 3. Create Sessions and Logs
    samples_per_session = total_samples // sessions_count
    
    for s_idx in range(sessions_count):
        # Stagger session times over the last 7 days
        session_time = datetime.now(timezone.utc) - timedelta(days=s_idx, hours=random.randint(0, 10))
        
        session = Session(
            user_id=user_id,
            quest_id=topics[s_idx % len(topics)],
            started_at=session_time,
            ended_at=session_time + timedelta(minutes=20),
            avg_focus_score=avg_focus,
            cv_available=True
        )
        db.add(session)
        await db.flush()  # get session.id

        # Insert individual logs
        for l_idx in range(samples_per_session):
            log_time = session_time + timedelta(seconds=l_idx * 10)
            
            # Determine face presence based on face_detection_rate
            face_detected = random.random() < face_rate
            attention = 0.82 if face_detected else 0.0
            
            # Determine focus score (stochastic around average focus)
            if face_detected:
                score = max(10.0, min(100.0, avg_focus + random.normalvariate(0, 8.0)))
            else:
                score = 0.0
                
            # Classify state
            state = "PRODUCTIVE"
            if score >= 75:
                state = "FLOW"
            elif score < 35:
                state = "STRUGGLING"
            if not face_detected:
                state = "DISENGAGED"

            # Determine emotion based on percentages
            rand_val = random.random()
            if rand_val < focused_pct:
                emotion = "FOCUSED"
            elif rand_val < focused_pct + bored_pct:
                emotion = "BORED"
            else:
                emotion = "SLEEPY"

            # Insert logs
            db.add(FocusLog(
                session_id=session.id,
                user_id=user_id,
                score=score,
                attention=attention,
                state=state,
                timestamp=log_time
            ))
            
            db.add(EmotionLog(
                session_id=session.id,
                user_id=user_id,
                emotion=emotion,
                confidence=0.75 + random.random() * 0.2,
                timestamp=log_time
            ))

    await db.commit()
    print(f"✅ Seeding complete for {user.full_name}. Focus logs generated.")

async def main():
    print("🚀 Starting simulation of student test cases...")
    test_cases = parse_csv_test_cases()
    if not test_cases:
        return
        
    async with AsyncSessionLocal() as db:
        # Get all registered students
        r = await db.execute(select(User).where(User.role == "student"))
        students = r.scalars().all()
        
        for student in students:
            case = find_best_match(student.full_name, student.email, test_cases)
            if case:
                await simulate_for_user(db, student, case)
            else:
                # Default fallback simulation if no match
                print(f"⚠️ No direct CSV match for {student.full_name}. Simulating a default LOW-risk profile.")
                default_case = next((c for c in test_cases if c['risk_level'] == 'LOW'), None)
                if default_case:
                    await simulate_for_user(db, student, default_case)

    print("🏁 Simulation finished successfully. Please refresh the Teacher Console dashboard.")

if __name__ == "__main__":
    asyncio.run(main())
