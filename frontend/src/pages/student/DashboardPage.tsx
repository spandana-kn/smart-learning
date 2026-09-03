import { motion } from 'framer-motion'
import { FlaskConical, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useCVStore } from '@/stores/cvStore'
import { useShallow } from 'zustand/react/shallow'
import { useDemoStore } from '@/stores/demoStore'
import FocusScoreWidget from '@/components/dashboard/FocusScoreWidget'
import EmotionWidget from '@/components/dashboard/EmotionWidget'
import XPWidget from '@/components/dashboard/XPWidget'
import ActiveQuestWidget from '@/components/dashboard/ActiveQuestWidget'
import StreakWidget from '@/components/dashboard/StreakWidget'
import SmartSuggestionsWidget from '@/components/dashboard/SmartSuggestionsWidget'
import WebcamFeed from '@/components/cv/WebcamFeed'
import ComboCounter from '@/components/gamification/ComboCounter'
import LiveMoodWidget from '@/components/dashboard/LiveMoodWidget'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}
const item = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35 } },
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { lastAdaptation, focusScore } = useCVStore(
    useShallow((s) => ({ lastAdaptation: s.lastAdaptation, focusScore: s.focusScore })),
  )
  const { isDemoMode, simPhase } = useDemoStore()

  const greetingEmoji = focusScore >= 70 ? '🔥' : focusScore >= 40 ? '⚔️' : focusScore > 0 ? '😴' : '⚔️'

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 max-w-7xl">

      {/* Demo mode banner */}
      {isDemoMode && (
        <motion.div
          variants={item}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-accent-amber/10 border border-accent-amber/25"
        >
          <FlaskConical size={14} className="text-accent-amber shrink-0" />
          <p className="text-xs font-mono text-accent-amber">
            <span className="font-bold">DEMO MODE</span> — Focus &amp; emotion data is simulated.
            Current phase: <span className="font-bold">{simPhase}</span>
          </p>
        </motion.div>
      )}

      {/* Adaptation banner */}
      {lastAdaptation && (
        <motion.div
          variants={item}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-brand/10 border border-brand/30"
        >
          <Sparkles size={15} className="text-brand shrink-0" />
          <div>
            <p className="text-xs font-mono text-brand uppercase tracking-wide">{lastAdaptation.action.replace(/_/g, ' ')}</p>
            <p className="text-sm text-white font-display">{lastAdaptation.message}</p>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <motion.div variants={item} className="flex items-start justify-between">
        <div>
          <p className="stat-label">Learning Realm</p>
          <h1 className="page-title mt-0.5">
            <span className="text-gradient-gold">{greetingEmoji} </span>
            {user?.full_name?.split(' ')[0] ?? 'Scholar'}
          </h1>
          <p className="text-sm text-gray-400 font-mono mt-1">
            Your adventure continues — quests await.
          </p>
        </div>
        <ComboCounter />
      </motion.div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-4">

        {/* Left column: webcam + focus */}
        <motion.div variants={item} className="col-span-12 lg:col-span-4 space-y-4">
          {!isDemoMode && <WebcamFeed />}
          {isDemoMode && (
            <div className="h-36 rounded-xl bg-surface-elevated border border-accent-amber/20 flex flex-col items-center justify-center gap-2">
              <FlaskConical size={24} className="text-accent-amber" />
              <p className="text-xs font-mono text-accent-amber">Demo — Webcam bypassed</p>
            </div>
          )}
          <FocusScoreWidget />
        </motion.div>

        {/* Middle column: emotion + quests */}
        <motion.div variants={item} className="col-span-12 lg:col-span-5 space-y-4">
          <EmotionWidget />
          <ActiveQuestWidget />
        </motion.div>

        {/* Right column: XP + streak + suggestions */}
        <motion.div variants={item} className="col-span-12 lg:col-span-3 space-y-4">
          <XPWidget />
          <StreakWidget />
          <SmartSuggestionsWidget />
        </motion.div>

      </div>
    </motion.div>
  )
}
