// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  full_name: string
  role: 'student' | 'teacher' | 'admin'
  avatar_id: string
  level: number
  xp_total: number
  xp_current: number
  xp_to_next: number
  streak_days: number
}

export interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
}

// ─── CV / Focus ───────────────────────────────────────────────────────────────
export type EmotionLabel =
  | 'FOCUSED'
  | 'BORED'
  | 'SLEEPY'

export type LearningState =
  | 'FLOW'
  | 'PRODUCTIVE'
  | 'STRUGGLING'
  | 'FRUSTRATED_OVERLOAD'
  | 'DISENGAGED'
  | 'FATIGUED'
  | 'MASTERY_HIGH'

export interface FocusData {
  score: number
  attention: number
  accuracy: number
  speed: number
  duration: number
  state: LearningState
  computed_at: string
}

export interface EmotionData {
  emotion: EmotionLabel
  confidence: number
  probabilities: Record<EmotionLabel, number>
  since: string
}

// ─── WebSocket Events ─────────────────────────────────────────────────────────
export type WSEvent =
  | { type: 'FOCUS_UPDATE'; payload: { score: number; state: LearningState; attention: number } }
  | { type: 'EMOTION_UPDATE'; payload: { emotion: EmotionLabel; confidence: number } }
  | { type: 'ADAPTATION_EVENT'; payload: { action: string; message: string } }
  | { type: 'XP_GRANT'; payload: { amount: number; reason: string; total: number } }
  | { type: 'LEVEL_UP'; payload: { new_level: number; rewards: Reward[] } }
  | { type: 'BADGE_EARNED'; payload: Badge }
  | { type: 'BOSS_DAMAGE'; payload: { damage: number; is_crit: boolean; boss_hp: number } }
  | { type: 'VISION_UPDATE'; payload: { face_box: { x: number; y: number; w: number; h: number } | null; eye_boxes: { x: number; y: number; w: number; h: number }[]; emotion: EmotionLabel; confidence: number; raw_scores: Record<string, number> } }

// ─── Quests ───────────────────────────────────────────────────────────────────
export type Difficulty = 'easy' | 'medium' | 'hard'
export type QuestionType = 'mcq' | 'true_false' | 'fill'

export interface MCQOption {
  label: string
  text: string
  is_correct: boolean
}

export interface Question {
  id: string
  quest_id: string
  skill_id: string
  question_text: string
  question_type: QuestionType
  options: MCQOption[] | null
  correct_answer: string
  explanation: string
  hints: { tier: number; text: string }[]
  difficulty: Difficulty
  bloom_level: string
}

export interface Quest {
  id: string
  title: string
  description: string
  subject: string
  base_difficulty: Difficulty
  question_count: number
  xp_reward_base: number
  min_level: number
  status: 'not_started' | 'in_progress' | 'completed'
  progress_pct: number
  skill_name: string
}

// ─── Skills ───────────────────────────────────────────────────────────────────
export interface Skill {
  id: string
  name: string
  subject: string
  description: string
  difficulty: Difficulty
  mastery: number
  status: 'locked' | 'available' | 'in_progress' | 'mastered'
  prereq_ids: string[]
  icon_name: string
  xp_reward: number
}

export interface SkillTreeData {
  nodes: Skill[]
  edges: { source: string; target: string }[]
}

// ─── Gamification ─────────────────────────────────────────────────────────────
export interface Badge {
  id: string
  name: string
  description: string
  icon_name: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  earned_at?: string
}

export interface Reward {
  id: string
  name: string
  type: 'badge' | 'title' | 'avatar' | 'loot'
  description: string
  icon_name: string
  rarity: string
}

export interface BossData {
  id: string
  name: string
  subject: string
  lore_text: string
  hp_total: number
  hp_current: number
  phases: number
  current_phase: number
  sprite_id: string
}

export interface BattleContext {
  battle_id: string
  boss: BossData
  player_hp: number
  player_max_hp: number
  combo: number
  current_question: Question
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export interface FocusHistoryPoint {
  timestamp: string
  score: number
  emotion: EmotionLabel
  state: LearningState
}

export interface HeatmapCell {
  date: string
  avg_score: number
  study_minutes: number
}

export interface Insight {
  type: string
  message: string
  severity: 'info' | 'warning' | 'success'
  action?: string
}

// ─── Teacher ──────────────────────────────────────────────────────────────────
export interface StudentSummary {
  id: string
  name: string
  avatar_id: string
  level: number
  avg_focus_7d: number
  streak_days: number
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
  risk_score: number
  last_active: string
  topics_completed: number
  completed_topics: string[]
  current_topic: string
  current_progress_pct: number
  path_preview: string[]
  cv_sessions_7d: number
  face_detection_rate: number
}
