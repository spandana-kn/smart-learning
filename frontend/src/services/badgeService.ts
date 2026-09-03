/**
 * Client-side badge awards — triggered by in-app events.
 * We track earned badges in localStorage so we don't re-award across sessions.
 */
import { useGamificationStore } from '@/stores/gamificationStore'
import type { Badge } from '@/types'

const EARNED_KEY = 'sf_earned_badges'

function getEarned(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(EARNED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function markEarned(id: string) {
  const s = getEarned()
  s.add(id)
  localStorage.setItem(EARNED_KEY, JSON.stringify([...s]))
}

const BADGES: Record<string, Badge> = {
  first_answer: {
    id: 'first_answer', name: 'First Strike',
    description: 'Answered your first question correctly.',
    icon_name: 'swords', rarity: 'common',
  },
  combo_3: {
    id: 'combo_3', name: 'Hat Trick',
    description: '3-answer combo in a quest.',
    icon_name: 'zap', rarity: 'rare',
  },
  quest_complete: {
    id: 'quest_complete', name: 'Quest Champion',
    description: 'Completed your first quest.',
    icon_name: 'trophy', rarity: 'rare',
  },
  boss_slayer: {
    id: 'boss_slayer', name: 'Dragon Slayer',
    description: 'Defeated a boss in battle.',
    icon_name: 'skull', rarity: 'epic',
  },
  flow_state: {
    id: 'flow_state', name: 'Flow State',
    description: 'Maintained focus ≥ 75 during a session.',
    icon_name: 'brain', rarity: 'epic',
  },
  demo_master: {
    id: 'demo_master', name: 'Demo Master',
    description: 'Ran the platform in demo mode.',
    icon_name: 'flask', rarity: 'legendary',
  },
}

export function tryAwardBadge(id: keyof typeof BADGES) {
  const earned = getEarned()
  if (earned.has(id)) return
  const badge = BADGES[id]
  if (!badge) return
  markEarned(id)
  badge.earned_at = new Date().toISOString()
  useGamificationStore.getState().addPendingBadge(badge)
}

export function tryAwardFlowBadge(focusScore: number) {
  if (focusScore >= 75) tryAwardBadge('flow_state')
}
