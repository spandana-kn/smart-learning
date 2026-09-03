import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Swords, ChevronRight, Clock, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { questService } from '@/services/questService'
import type { Quest } from '@/types'

const DIFF_COLORS = { easy: '#00F5A0', medium: '#FF9F43', hard: '#FF4757' }

function QuestRow({ quest }: { quest: Quest }) {
  const navigate = useNavigate()
  return (
    <motion.div
      whileHover={{ x: 4 }}
      onClick={() => navigate('/quests')}
      className="flex items-center gap-3 p-3 rounded-lg bg-surface-elevated border border-surface-border hover:border-brand/40 cursor-pointer transition-colors"
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: DIFF_COLORS[quest.base_difficulty] + '20' }}
      >
        <Swords size={14} style={{ color: DIFF_COLORS[quest.base_difficulty] }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-display font-semibold text-white truncate">{quest.title}</p>
        <p className="text-xs text-gray-400 font-mono">{quest.subject} · {quest.base_difficulty}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className="text-xs font-mono text-accent-gold">{quest.xp_reward_base} XP</p>
          <p className="text-xs font-mono text-gray-500">{quest.progress_pct}%</p>
        </div>
        <ChevronRight size={14} className="text-gray-500" />
      </div>
    </motion.div>
  )
}

export default function ActiveQuestWidget() {
  const navigate = useNavigate()
  const { data: quests, isLoading } = useQuery({
    queryKey: ['quests', 'available'],
    queryFn: () => questService.list(),
  })

  const active = quests?.filter((q) => q.status === 'in_progress').slice(0, 2) ?? []
  const available = quests?.filter((q) => q.status === 'not_started').slice(0, 2) ?? []
  const shown = active.length > 0 ? active : available

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="stat-label">Active Quests</p>
        <button
          onClick={() => navigate('/quests')}
          className="text-xs font-mono text-brand hover:text-brand-light flex items-center gap-1 transition-colors"
        >
          View All <ChevronRight size={12} />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-surface-elevated animate-pulse" />
          ))}
        </div>
      ) : shown.length > 0 ? (
        <div className="space-y-2">
          {shown.map((q) => <QuestRow key={q.id} quest={q} />)}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 gap-3">
          <Swords size={28} className="text-gray-600" />
          <p className="text-sm text-gray-400 font-mono">No active quests</p>
          <button onClick={() => navigate('/quests')} className="btn-primary text-xs px-4 py-2">
            Start a Quest
          </button>
        </div>
      )}
    </div>
  )
}
