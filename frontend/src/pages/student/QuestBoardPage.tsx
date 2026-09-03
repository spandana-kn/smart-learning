import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Swords, Star, Clock, ChevronRight, X, Lightbulb, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { questService } from '@/services/questService'
import { useGamificationStore } from '@/stores/gamificationStore'
import { useCVStore } from '@/stores/cvStore'
import { useShallow } from 'zustand/react/shallow'
import { tryAwardBadge } from '@/services/badgeService'
import ComboCounter from '@/components/gamification/ComboCounter'
import type { Quest, Question } from '@/types'
import clsx from 'clsx'

const DIFF_CONFIG = {
  easy:   { color: '#00F5A0', label: 'Easy',   icon: '🌱' },
  medium: { color: '#FF9F43', label: 'Medium', icon: '⚔️' },
  hard:   { color: '#FF4757', label: 'Hard',   icon: '💀' },
}

// ─── Quest Card ──────────────────────────────────────────────────────────────
function QuestCard({ quest, onSelect }: { quest: Quest; onSelect: () => void }) {
  const diff = DIFF_CONFIG[quest.base_difficulty]
  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: '0 8px 30px rgba(108,99,255,0.2)' }}
      onClick={onSelect}
      className="card p-5 cursor-pointer border-surface-border hover:border-brand/40 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{diff.icon}</span>
        <span
          className="text-xs font-mono px-2 py-0.5 rounded-full border"
          style={{ color: diff.color, borderColor: diff.color + '60', background: diff.color + '15' }}
        >
          {diff.label}
        </span>
      </div>

      <h3 className="font-display font-bold text-white mb-1">{quest.title}</h3>
      <p className="text-xs text-gray-400 font-mono mb-3 line-clamp-2">{quest.description}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs font-mono text-gray-400">
          <span className="flex items-center gap-1">
            <Star size={11} className="text-accent-gold" />
            {quest.xp_reward_base} XP
          </span>
          <span>{quest.question_count} Qs</span>
        </div>
        {quest.status === 'in_progress' && (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1 bg-surface-border rounded-full overflow-hidden">
              <div className="h-full bg-brand rounded-full" style={{ width: `${quest.progress_pct}%` }} />
            </div>
            <span className="text-xs font-mono text-brand">{quest.progress_pct}%</span>
          </div>
        )}
        {quest.status === 'completed' && (
          <CheckCircle size={14} className="text-accent-emerald" />
        )}
      </div>
    </motion.div>
  )
}

// ─── Active Quest Modal ────────────────────────────────────────────────────
function QuestModal({ quest, onClose }: { quest: Quest; onClose: () => void }) {
  const [question, setQuestion] = useState<Question | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [result, setResult] = useState<{ correct: boolean; feedback: string; xp: number } | null>(null)
  const [hintTier, setHintTier] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const [startTime, setStartTime] = useState(Date.now())
  const [correctStreak, setCorrectStreak] = useState(0)
  const [wrongStreak, setWrongStreak] = useState(0)
  const qc = useQueryClient()
  const { setCombo, breakCombo, addXP } = useGamificationStore()
  const { focusScore, emotion, setAdaptation } = useCVStore(
    useShallow((s) => ({ focusScore: s.focusScore, emotion: s.emotion, setAdaptation: s.setAdaptation })),
  )

  const startMutation = useMutation({
    mutationFn: () => questService.start(quest.id),
    onSuccess: (data) => {
      setSessionId(data.session_quest_id)
      setQuestion(data.first_question)
      setStartTime(Date.now())
    },
  })

  const answerMutation = useMutation({
    mutationFn: (answer: string) =>
      questService.answer(quest.id, {
        question_id: question!.id,
        answer,
        time_taken_ms: Date.now() - startTime,
        hint_tier_used: hintTier,
        focus_score: focusScore,
        emotion: emotion,
        correct_streak: correctStreak,
        wrong_streak: wrongStreak,
      }),
    onSuccess: (data) => {
      setResult({ correct: data.correct, feedback: data.feedback, xp: data.xp_earned })
      if (data.correct) {
        setCombo(data.combo)
        addXP(data.xp_earned)
        setCorrectStreak((s) => s + 1)
        setWrongStreak(0)
      } else {
        breakCombo()
        setWrongStreak((s) => s + 1)
        setCorrectStreak(0)
      }
      // Show adaptation notification if engine fired
      if (data.adaptation_applied?.action) {
        setAdaptation(data.adaptation_applied.action, data.adaptation_applied.message ?? '')
      }
      // Badge awards
      if (data.correct) {
        tryAwardBadge('first_answer')
        if (data.combo >= 3) tryAwardBadge('combo_3')
      }
      if (!data.next_question) tryAwardBadge('quest_complete')
      setTimeout(() => {
        if (data.next_question) {
          setQuestion(data.next_question)
          setResult(null)
          setSelected(null)
          setHint(null)
          setHintTier(0)
          setStartTime(Date.now())
        } else {
          qc.invalidateQueries({ queryKey: ['quests', 'available'] })
          onClose()
        }
      }, 1800)
    },
  })

  const fetchHint = async () => {
    const data = await questService.getHint(quest.id, hintTier)
    setHint(data.hint_text)
    setHintTier((t) => Math.min(t + 1, 4))
  }

  // Start the quest on mount
  if (!sessionId && !startMutation.isPending && !startMutation.isSuccess) {
    startMutation.mutate()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="card-elevated w-full max-w-xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-border">
          <div>
            <p className="stat-label">{quest.subject}</p>
            <h2 className="font-display font-bold text-white">{quest.title}</h2>
          </div>
          <div className="flex items-center gap-3">
            <ComboCounter />
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {startMutation.isPending && (
            <div className="flex justify-center py-12">
              <Loader2 size={32} className="animate-spin text-brand" />
            </div>
          )}

          {question && (
            <>
              {/* Difficulty + bloom */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-surface-elevated border border-surface-border text-gray-400">
                  {DIFF_CONFIG[question.difficulty]?.icon} {question.difficulty}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-surface-elevated border border-surface-border text-gray-400">
                  {question.bloom_level}
                </span>
              </div>

              {/* Question */}
              <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border">
                <p className="font-display text-base text-white leading-relaxed">
                  {question.question_text}
                </p>
              </div>

              {/* MCQ Options */}
              {question.question_type === 'mcq' && question.options && (
                <div className="space-y-2">
                  {question.options.map((opt) => {
                    const isSelected = selected === opt.label
                    const showCorrect = result && opt.is_correct
                    const showWrong = result && isSelected && !opt.is_correct
                    return (
                      <motion.button
                        key={opt.label}
                        whileHover={!result ? { x: 4 } : {}}
                        onClick={() => {
                          if (result || answerMutation.isPending) return
                          setSelected(opt.label)
                          answerMutation.mutate(opt.label)
                        }}
                        className={clsx(
                          'w-full text-left px-4 py-3 rounded-xl border font-display text-sm transition-all duration-200 flex items-center gap-3',
                          showCorrect
                            ? 'bg-accent-emerald/15 border-accent-emerald text-accent-emerald'
                            : showWrong
                            ? 'bg-accent-crimson/15 border-accent-crimson text-accent-crimson'
                            : isSelected
                            ? 'bg-brand/15 border-brand text-white'
                            : 'bg-surface-elevated border-surface-border text-gray-300 hover:border-brand/40'
                        )}
                      >
                        <span className="w-6 h-6 rounded-full bg-surface-border flex items-center justify-center text-xs font-mono shrink-0">
                          {opt.label}
                        </span>
                        {opt.text}
                        {showCorrect && <CheckCircle size={14} className="ml-auto text-accent-emerald" />}
                        {showWrong   && <XCircle    size={14} className="ml-auto text-accent-crimson"  />}
                      </motion.button>
                    )
                  })}
                </div>
              )}

              {/* Result feedback */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={clsx(
                      'p-3 rounded-xl border text-sm font-mono',
                      result.correct
                        ? 'bg-accent-emerald/10 border-accent-emerald/30 text-accent-emerald'
                        : 'bg-accent-crimson/10 border-accent-crimson/30 text-accent-crimson'
                    )}
                  >
                    {result.correct ? `✓ Correct! +${result.xp} XP` : `✗ ${result.feedback}`}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Hint */}
              {hint && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 rounded-xl bg-accent-amber/10 border border-accent-amber/30"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Lightbulb size={12} className="text-accent-amber" />
                    <span className="text-xs font-mono text-accent-amber">HINT (tier {hintTier})</span>
                  </div>
                  <p className="text-sm text-gray-200 font-mono">{hint}</p>
                </motion.div>
              )}

              {/* Hint button */}
              {!result && (
                <button
                  onClick={fetchHint}
                  className="flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-accent-amber transition-colors"
                >
                  <Lightbulb size={12} />
                  {hint ? 'Next hint' : 'Show hint'} (−20% XP)
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Quest Board Page ─────────────────────────────────────────────────────────
export default function QuestBoardPage() {
  const [filter, setFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all')
  const [activeQuest, setActiveQuest] = useState<Quest | null>(null)

  const { data: quests = [], isLoading } = useQuery({
    queryKey: ['quests', 'available'],
    queryFn: () => questService.list(),
  })

  const filtered = filter === 'all' ? quests : quests.filter((q) => q.base_difficulty === filter)

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <p className="stat-label">Adventure Board</p>
        <h1 className="page-title mt-0.5">⚔️ Quest Board</h1>
        <p className="text-sm text-gray-400 font-mono mt-1">
          Choose your challenge. Difficulty adapts to your current focus.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(['all', 'easy', 'medium', 'hard'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all duration-200',
              filter === f
                ? 'bg-brand text-white shadow-glow'
                : 'bg-surface-elevated border border-surface-border text-gray-400 hover:text-white'
            )}
          >
            {f === 'all' ? '📋 All' : `${DIFF_CONFIG[f].icon} ${DIFF_CONFIG[f].label}`}
          </button>
        ))}
        <span className="text-xs font-mono text-gray-500 ml-2">{filtered.length} quests</span>
      </div>

      {/* Quest Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-surface-card animate-pulse" />
          ))}
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <AnimatePresence>
            {filtered.map((q) => (
              <motion.div
                key={q.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <QuestCard quest={q} onSelect={() => setActiveQuest(q)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Active quest modal */}
      <AnimatePresence>
        {activeQuest && (
          <QuestModal quest={activeQuest} onClose={() => setActiveQuest(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
