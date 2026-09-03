import { motion } from 'framer-motion'
import { Star, TrendingUp } from 'lucide-react'
import { useGamificationStore } from '@/stores/gamificationStore'
import { useAuthStore } from '@/stores/authStore'

const RANK_TITLES: Record<number, string> = {
  1:  'Novice Scholar',   2:  'Apprentice',       3:  'Student Mage',
  4:  'Arcane Seeker',    5:  'Knowledge Knight', 6:  'Lore Keeper',
  7:  'Wisdom Warden',    8:  'Sage',              9:  'Grand Scholar',
  10: 'Archmage',
}

export default function XPWidget() {
  const { xp, xpToNext, level, streakDays } = useGamificationStore()
  const user = useAuthStore((s) => s.user)

  const pct = Math.min(100, Math.round((xp / xpToNext) * 100))
  const title = RANK_TITLES[Math.min(level, 10)] ?? 'Archmage'

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="stat-label">Experience</p>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-gold/10 border border-accent-gold/30">
          <Star size={10} className="text-accent-gold" />
          <span className="text-xs font-mono text-accent-gold">LVL {level}</span>
        </div>
      </div>

      {/* Level + Title */}
      <div>
        <p className="font-lore text-base text-accent-gold">{title}</p>
        <p className="text-xs text-gray-400 font-mono mt-0.5">{user?.full_name ?? 'Adventurer'}</p>
      </div>

      {/* XP Bar */}
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-xs font-mono text-gray-400">Progress to Level {level + 1}</span>
          <span className="text-xs font-mono text-accent-gold">{xp} / {xpToNext} XP</span>
        </div>
        <div className="progress-bar-track h-3 relative">
          <motion.div
            className="h-full bg-gradient-gold rounded-full relative"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            {/* Shimmer */}
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 w-1/3 bg-white/20 skew-x-12 animate-[shimmer_2s_ease-in-out_infinite]"
                style={{ left: '-40%', animation: 'shimmer 2s ease-in-out infinite' }}
              />
            </div>
          </motion.div>
        </div>
        <p className="text-xs font-mono text-gray-500 mt-1 text-right">{pct}% complete</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-surface-border">
        <div className="text-center">
          <p className="stat-value text-accent-gold text-xl">{level}</p>
          <p className="stat-label text-xs mt-0.5">Level</p>
        </div>
        <div className="text-center">
          <p className="stat-value text-accent-amber text-xl">{streakDays}</p>
          <p className="stat-label text-xs mt-0.5">Day Streak</p>
        </div>
      </div>
    </div>
  )
}
