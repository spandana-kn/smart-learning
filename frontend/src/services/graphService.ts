import api from './api'

export interface GraphNode {
  id: string
  name: string
  mastery: number
  status: 'mastered' | 'available' | 'locked'
  tier: number
  difficulty: 'easy' | 'medium' | 'hard'
  xp_reward: number
  bloom: string
  description: string
}

export interface PathCandidate {
  concept: string
  score: number
  mastery: number
  difficulty: 'easy' | 'medium' | 'hard'
  tier: number
  reason: string
}

export interface LearningPathState {
  start_concept: string
  covered_order: string[]
  recommended_concept: string
  candidates: PathCandidate[]
  mastery: Record<string, number>
  attempt_summary: {
    attempts: number
    recent_accuracy: number
    recent_avg_time_ms: number
  }
}

export interface GraphLink {
  source: string
  target: string
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

export interface NextConceptResult {
  recommended_concept: string
  action: string
  message: string
  weak_prerequisites: string[]
  learning_path: string[]
}

export interface AttemptResult {
  new_mastery: number
  xp_earned: number
  next_concept: string | null
  message: string | null
}

export interface QuestionOption {
  label: string
  text: string
  is_correct: boolean
}

export interface Question {
  id: string
  concept: string
  difficulty: string
  bloom_level: string
  question_text: string
  options: QuestionOption[]
  correct_answer: string
  explanation: string
}

export const graphService = {
  getVisualization: (): Promise<GraphData> =>
    api.get('/graph/visualization').then((r) => r.data),

  getMastery: (): Promise<Record<string, number>> =>
    api.get('/graph/mastery').then((r) => r.data),

  getNextConcept: (params?: {
    current_concept?: string
    emotion?: string
    focus?: number
  }): Promise<NextConceptResult> =>
    api.get('/graph/next-concept', { params }).then((r) => r.data),

  getPathState: (params?: { emotion?: string; focus?: number }): Promise<LearningPathState> =>
    api.get('/graph/path-state', { params }).then((r) => r.data),

  getNextQuestion: (params: {
    concept: string
    emotion?: string
    focus?: number
    seen_ids?: string
  }): Promise<Question | null> =>
    api.get('/graph/next-question', { params }).then((r) => r.data),

  getSessionQuestions: (params: {
    concept: string
    n?: number
    emotion?: string
    focus?: number
  }): Promise<Question[]> =>
    api.get('/graph/session-questions', { params }).then((r) => r.data),

  recordAttempt: (body: {
    question_id: string
    concept: string
    correct: boolean
    answer: string
    focus_score?: number
    emotion?: string
    time_ms?: number
  }): Promise<AttemptResult> =>
    api.post('/graph/attempt', body).then((r) => r.data),

  getLearningPath: (start: string, end: string): Promise<string[]> =>
    api.get('/graph/learning-path', { params: { start, end } }).then((r) => r.data),

  getTeacherBottlenecks: (): Promise<
    { concept_id: string; name: string; avg_mastery: number; blocking_count: number }[]
  > => api.get('/graph/teacher/bottlenecks').then((r) => r.data),
}
