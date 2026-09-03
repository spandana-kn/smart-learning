import { motion } from 'framer-motion'
import { Flame, Calendar } from 'lucide-react'
import { useGamificationStore } from '@/stores/gamificationStore'

function DayDot({ active, today }: { active: boolean; today?: boolean }) {
  return (
    <motion.div
      animate={{ scale: today ? [1, 1.2, 1] : 1 }}
      transition={{ repeat: today ? Infinity : 0, duration: 2 }}
      className={`w-6 h-6 rounded-full flex items-center justify-center ${
        today
          ? 'bg-accent-amber shadow-[0_0_8px_rgba(255,159,67,0.6)]'
          : active
          ? 'bg-brand'
          : 'bg-surface-border'
      }`}
    >
      {(active || today) && <Flame size={10} className="text-white" />}
    </motion.div>
  )
}

export default function StreakWidget() {
  const { streakDays } = useGamificationStore()

  // Show last 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const daysAgo = 6 - i
    return {
      active: daysAgo < streakDays,
      today: daysAgo === 0,
      label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][(new Date().getDay() - daysAgo + 7) % 7],
    }
  })

  const nextMilestone = streakDays < 7 ? 7 : streakDays < 14 ? 14 : streakDays < 30 ? 30 : streakDays + 10

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="stat-label">Daily Streak</p>
        <Calendar size={14} className="text-gray-500" />
      </div>

      {/* Streak count */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-accent-amber/15 border border-accent-amber/30 flex items-center justify-center">
          <Flame size={22} className="text-accent-amber" />
        </div>
        <div>
          <p className="stat-value text-accent-amber text-3xl">{streakDays}</p>
          <p className="stat-label">day streak</p>
        </div>
      </div>

      {/* Day dots */}
      <div className="flex justify-between">
        {days.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <DayDot active={d.active} today={d.today} />
            <span className="text-xs font-mono text-gray-500">{d.label}</span>
          </div>
        ))}
      </div>

      {/* Next milestone */}
      <div className="pt-2 border-t border-surface-border">
        <div className="flex justify-between mb-1.5">
          <span className="text-xs font-mono text-gray-400">Next milestone</span>
          <span className="text-xs font-mono text-accent-amber">{nextMilestone} days</span>
        </div>
        <div className="progress-bar-track h-1.5">
          <motion.div
            className="h-full bg-gradient-gold rounded-full"
            animate={{ width: `${Math.min(100, (streakDays / nextMilestone) * 100)}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
      </div>
    </div>
  )
}
