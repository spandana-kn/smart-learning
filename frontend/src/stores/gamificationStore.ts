import { create } from 'zustand'
import type { Badge } from '@/types'

interface GamificationStore {
  xp: number
  xpToNext: number
  level: number
  combo: number
  streakDays: number
  pendingLevelUp: number | null
  pendingBadges: Badge[]

  addXP: (amount: number) => void
  setCombo: (combo: number) => void
  breakCombo: () => void
  setPendingLevelUp: (level: number | null) => void
  addPendingBadge: (badge: Badge) => void
  clearPendingBadge: (id: string) => void
  syncFromUser: (xp: number, xpToNext: number, level: number, streak: number) => void
}

function levelThreshold(n: number) {
  return Math.floor(100 * Math.pow(n, 1.6))
}

export const useGamificationStore = create<GamificationStore>((set, get) => ({
  xp: 0,
  xpToNext: levelThreshold(2),
  level: 1,
  combo: 0,
  streakDays: 0,
  pendingLevelUp: null,
  pendingBadges: [],

  addXP: (amount) => {
    const { xp, xpToNext, level } = get()
    const newXP = xp + amount
    if (newXP >= xpToNext) {
      const newLevel = level + 1
      set({
        xp: newXP - xpToNext,
        xpToNext: levelThreshold(newLevel + 1),
        level: newLevel,
        pendingLevelUp: newLevel,
      })
    } else {
      set({ xp: newXP })
    }
  },

  setCombo: (combo) => set({ combo }),
  breakCombo: () => set({ combo: 0 }),

  setPendingLevelUp: (level) => set({ pendingLevelUp: level }),

  addPendingBadge: (badge) =>
    set((s) => ({ pendingBadges: [...s.pendingBadges, badge] })),

  clearPendingBadge: (id) =>
    set((s) => ({ pendingBadges: s.pendingBadges.filter((b) => b.id !== id) })),

  syncFromUser: (xp, xpToNext, level, streak) =>
    set({ xp, xpToNext, level, streakDays: streak }),
}))
