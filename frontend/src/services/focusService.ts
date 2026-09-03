import api from './api'
import type { FocusData, EmotionData, FocusHistoryPoint, HeatmapCell, Insight } from '@/types'

export const focusService = {
  getCurrent: () =>
    api.get<FocusData>('/focus/current').then((r) => r.data),

  getCurrentEmotion: () =>
    api.get<EmotionData>('/emotions/current').then((r) => r.data),

  getHistory: (days = 7) =>
    api.get<FocusHistoryPoint[]>('/focus/history', { params: { days } }).then((r) => r.data),

  getHeatmap: (weeks = 12) =>
    api.get<HeatmapCell[]>('/focus/heatmap', { params: { weeks } }).then((r) => r.data),

  getInsights: () =>
    api.get<Insight[]>('/focus/insights').then((r) => r.data),

  startSession: (questId?: string) =>
    api.post<{ session_id: string }>('/focus/session/start', { quest_id: questId }).then((r) => r.data),

  endSession: (sessionId: string) =>
    api.post('/focus/session/end', { session_id: sessionId }).then((r) => r.data),
}
