import api from './api'
import type { FocusHistoryPoint, HeatmapCell, Insight } from '@/types'

export const analyticsService = {
  async getFocusHistory(days = 7): Promise<FocusHistoryPoint[]> {
    const { data } = await api.get<FocusHistoryPoint[]>('/focus/history', { params: { days } })
    return data
  },

  async getHeatmap(weeks = 8): Promise<HeatmapCell[]> {
    const { data } = await api.get<HeatmapCell[]>('/focus/heatmap', { params: { weeks } })
    return data
  },

  async getInsights(): Promise<Insight[]> {
    const { data } = await api.get<Insight[]>('/focus/insights')
    return data
  },

  async getEmotionDistribution(days = 7): Promise<Record<string, number>> {
    const { data } = await api.get<Record<string, number>>('/emotions/distribution', { params: { days } })
    return data
  },

  async getLiveFocus() {
    const { data } = await api.get('/focus/live')
    return data as { score: number; attention: number; state: string; timestamp: string | null; stale: boolean }
  },

  async getLiveEmotion() {
    const { data } = await api.get('/emotions/live')
    return data as { emotion: string; confidence: number; timestamp: string | null; stale: boolean }
  },
}
