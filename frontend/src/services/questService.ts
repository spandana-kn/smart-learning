import api from './api'
import type { Quest, Question } from '@/types'

export interface AnswerPayload {
  question_id: string
  answer: string
  time_taken_ms: number
  hint_tier_used: number
  focus_score?: number
  emotion?: string
  correct_streak?: number
  wrong_streak?: number
}

export interface AnswerResult {
  correct: boolean
  xp_earned: number
  feedback: string
  explanation: string
  next_question: Question | null
  combo: number
  adaptation_applied: { action: string; message: string } | null
}

export interface QuestStartResult {
  session_quest_id: string
  first_question: Question
}

export const questService = {
  list: (params?: { subject?: string; difficulty?: string }) =>
    api.get<Quest[]>('/quests', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<Quest>(`/quests/${id}`).then((r) => r.data),

  start: (id: string) =>
    api.post<QuestStartResult>(`/quests/${id}/start`).then((r) => r.data),

  answer: (id: string, payload: AnswerPayload) =>
    api.post<AnswerResult>(`/quests/${id}/answer`, payload).then((r) => r.data),

  getHint: (questId: string, tier: number) =>
    api.get<{ hint_text: string; xp_multiplier_remaining: number }>(
      `/quests/${questId}/hints/${tier}`
    ).then((r) => r.data),

  complete: (id: string) =>
    api.post(`/quests/${id}/complete`).then((r) => r.data),
}
