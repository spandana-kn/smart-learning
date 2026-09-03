import { motion, AnimatePresence } from 'framer-motion'
import { useGamificationStore } from '@/stores/gamificationStore'
import { useEffect } from 'react'

const RARITY_STYLES = {
  common:    { border: '#6C757D', bg: 'rgba(108,117,125,0.15)', text: '#9CA3AF' },
  rare:      { border: '#00B4D8', bg: 'rgba(0,180,216,0.15)',   text: '#00B4D8' },
  epic:      { border: '#6C63FF', bg: 'rgba(108,99,255,0.15)',  text: '#8B85FF' },
  legendary: { border: '#FFD700', bg: 'rgba(255,215,0,0.15)',   text: '#FFD700' },
}

export default function BadgeToast() {
  const { pendingBadges, clearPendingBadge } = useGamificationStore()

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    if (pendingBadges.length === 0) return
    const badge = pendingBadges[0]
    const timer = setTimeout(() => clearPendingBadge(badge.id), 4000)
    return () => clearTimeout(timer)
  }, [pendingBadges.length])

  const badge = pendingBadges[0]

  return (
    <div className="fixed top-4 right-4 z-50 pointer-events-none">
      <AnimatePresence>
        {badge && (
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            className="pointer-events-auto rounded-xl px-4 py-3 flex items-center gap-3 shadow-card min-w-[240px]"
            style={{
              background: RARITY_STYLES[badge.rarity]?.bg ?? RARITY_STYLES.common.bg,
              border: `1px solid ${RARITY_STYLES[badge.rarity]?.border ?? '#6C757D'}`,
            }}
          >
            <span className="text-2xl">🏅</span>
            <div>
              <p className="text-xs font-mono uppercase tracking-widest"
                style={{ color: RARITY_STYLES[badge.rarity]?.text ?? '#9CA3AF' }}>
                {badge.rarity} badge earned!
              </p>
              <p className="font-display text-sm font-bold text-white">{badge.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{badge.description}</p>
            </div>
            <button
              onClick={() => clearPendingBadge(badge.id)}
              className="ml-auto text-gray-500 hover:text-white text-lg leading-none"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
