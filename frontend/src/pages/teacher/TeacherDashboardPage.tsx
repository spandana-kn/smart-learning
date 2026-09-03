import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, AlertTriangle, TrendingUp, TrendingDown, Minus,
  X, ChevronRight, Lightbulb, Brain, Settings2, Save, Plus, Trash2,
} from 'lucide-react'
import api from '@/services/api'
import type { StudentSummary } from '@/types'
import clsx from 'clsx'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Cell,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────
interface StudentDetail {
  id: string; name: string; level: number; xp_total: number
  avg_focus_7d: number; streak_days: number
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
  risk_score: number; risk_reasons: string[]; suggestions: string[]
  focus_history: { timestamp: string; score: number; state: string }[]
  emotion_distribution: Record<string, number>
  topics_completed: number
  completed_topics: string[]
  current_topic: string
  current_progress_pct: number
  path_preview: string[]
  cv_sessions_7d: number
  face_detection_rate: number
}

interface ClassSummary {
  total_students: number
  class_avg_focus: number
  emotion_distribution: Record<string, number>
}

interface BottleneckConcept {
  concept_id: string
  name: string
  avg_mastery: number
  blocking_count: number
}

interface ContentSetup {
  subjects: string[]
  topics: { name: string; id: string; subject: string; difficulty: 'easy' | 'medium' | 'hard'; tier: number }[]
  questions: { id: string; concept: string; question_text: string }[]
  bosses: { topic: string; name: string }[]
  all_topics: { name: string; id: string; difficulty: 'easy' | 'medium' | 'hard'; tier: number }[]
}

const RISK_CONFIG = {
  LOW:    { color: '#00F5A0', bg: 'rgba(0,245,160,0.08)',   label: 'Low Risk'  },
  MEDIUM: { color: '#FF9F43', bg: 'rgba(255,159,67,0.08)',  label: 'Watch'     },
  HIGH:   { color: '#FF4757', bg: 'rgba(255,71,87,0.08)',   label: 'At Risk'   },
}

type QuestionDraft = {
  question_text: string
  options: string[]
  correct_answer: string
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
}

const emptyQuestion = (difficulty: 'easy' | 'medium' | 'hard' = 'easy'): QuestionDraft => ({
  question_text: '',
  options: ['', '', '', ''],
  correct_answer: 'A',
  explanation: '',
  difficulty,
})

function ContentSetupPanel() {
  const qc = useQueryClient()
  const { data: content } = useQuery<ContentSetup>({
    queryKey: ['teacher', 'content'],
    queryFn: () => api.get('/teacher/content').then((r) => r.data),
  })
  const [subject, setSubject] = useState('Python')
  const [topicName, setTopicName] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy')
  const [tier, setTier] = useState(0)
  const [prerequisite, setPrerequisite] = useState('')
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion('easy')])
  const [questTitle, setQuestTitle] = useState('')
  const [bossEnabled, setBossEnabled] = useState(false)
  const [bossName, setBossName] = useState('')

  const updateQuestion = (index: number, patch: Partial<QuestionDraft>) => {
    setQuestions((prev) => prev.map((q, i) => i === index ? { ...q, ...patch } : q))
  }

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== questionIndex) return q
      return {
        ...q,
        options: q.options.map((option, idx) => idx === optionIndex ? value : option),
      }
    }))
  }

  const completeQuestions = questions.filter((q) => q.question_text.trim() && q.options.every((o) => o.trim()))
  const hardQuestionCount = completeQuestions.filter((q) => q.difficulty === 'hard').length

  const saveMutation = useMutation({
    mutationFn: () => api.post('/teacher/content', {
      subject: { name: subject },
      topic: {
        name: topicName,
        subject,
        description,
        difficulty,
        bloom: 'apply',
        tier,
        xp_reward: difficulty === 'hard' ? 110 : difficulty === 'medium' ? 75 : 45,
        prerequisites: prerequisite ? [prerequisite] : [],
      },
      questions: completeQuestions.map((q) => ({
        question_text: q.question_text,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        bloom_level: 'apply',
      })),
      quest: {
        enabled: true,
        title: questTitle || `${topicName} Quest`,
        description: `Practice ${topicName} with adaptive questions.`,
      },
      boss: {
        enabled: bossEnabled,
        name: bossName || `The ${topicName} Sentinel`,
        lore_text: `A milestone boss unlocked from ${topicName}.`,
        hp_total: difficulty === 'hard' ? 340 : 240,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher', 'content'] })
      qc.invalidateQueries({ queryKey: ['graph-viz'] })
      qc.invalidateQueries({ queryKey: ['quests', 'available'] })
      qc.invalidateQueries({ queryKey: ['boss', 'available'] })
      setTopicName('')
      setDescription('')
      setQuestions([emptyQuestion('easy')])
      setQuestTitle('')
      setBossName('')
      setBossEnabled(false)
    },
  })

  const canSave = Boolean(
    subject.trim()
    && topicName.trim()
    && completeQuestions.length > 0
    && (!bossEnabled || hardQuestionCount > 0),
  )

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 xl:col-span-7 card p-5 space-y-5">
        <div>
          <p className="stat-label">Content Setup</p>
          <h2 className="section-title mt-1">Publish to Skill Tree</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="stat-label">Subject</span>
            <input className="input-field" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Python" />
          </label>
          <label className="space-y-1.5">
            <span className="stat-label">Topic</span>
            <input className="input-field" value={topicName} onChange={(e) => setTopicName(e.target.value)} placeholder="Decorators" />
          </label>
        </div>

        <label className="space-y-1.5 block">
          <span className="stat-label">Topic Description</span>
          <textarea className="input-field min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What students should learn in this topic" />
        </label>

        <div className="grid md:grid-cols-3 gap-3">
          <label className="space-y-1.5">
            <span className="stat-label">Difficulty</span>
            <select className="input-field" value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="stat-label">Tier</span>
            <input className="input-field" type="number" min={0} max={10} value={tier} onChange={(e) => setTier(Number(e.target.value))} />
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Tier is the topic's depth in the learning map. Use 0 for starting topics, then increase as prerequisites get more advanced.
            </p>
          </label>
          <label className="space-y-1.5">
            <span className="stat-label">Prerequisite</span>
            <select className="input-field" value={prerequisite} onChange={(e) => setPrerequisite(e.target.value)}>
              <option value="">None</option>
              {content?.all_topics.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </label>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-elevated/40 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="stat-label">Questions</p>
              <p className="text-xs text-gray-500 mt-1">Add multiple MCQs for adaptive practice and boss fights.</p>
            </div>
            <button
              type="button"
              onClick={() => setQuestions((prev) => [...prev, emptyQuestion(difficulty)])}
              className="btn-secondary text-xs flex items-center gap-2"
            >
              <Plus size={14} />
              Add Question
            </button>
          </div>

          {questions.map((question, qIndex) => (
            <div key={qIndex} className="rounded-lg border border-surface-border bg-surface-card/60 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-display font-semibold text-white">Question {qIndex + 1}</p>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qIndex))}
                    className="text-gray-500 hover:text-red-300"
                    aria-label={`Remove question ${qIndex + 1}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <input
                className="input-field"
                value={question.question_text}
                onChange={(e) => updateQuestion(qIndex, { question_text: e.target.value })}
                placeholder="Ask an MCQ for this topic"
              />
              <div className="grid md:grid-cols-2 gap-2">
                {question.options.map((option, i) => (
                  <input
                    key={i}
                    className="input-field"
                    value={option}
                    onChange={(e) => updateOption(qIndex, i, e.target.value)}
                    placeholder={`${String.fromCharCode(65 + i)} option`}
                  />
                ))}
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="stat-label">Correct Option</span>
                  <select className="input-field" value={question.correct_answer} onChange={(e) => updateQuestion(qIndex, { correct_answer: e.target.value })}>
                    {['A', 'B', 'C', 'D'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="stat-label">Question Difficulty</span>
                  <select className="input-field" value={question.difficulty} onChange={(e) => updateQuestion(qIndex, { difficulty: e.target.value as QuestionDraft['difficulty'] })}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
              </div>
              <textarea
                className="input-field min-h-16"
                value={question.explanation}
                onChange={(e) => updateQuestion(qIndex, { explanation: e.target.value })}
                placeholder="Explanation shown after answering"
              />
            </div>
          ))}

          <div className="grid md:grid-cols-2 gap-3">
            <label className="space-y-1.5 md:col-span-2">
              <span className="stat-label">Quest Title</span>
              <input className="input-field" value={questTitle} onChange={(e) => setQuestTitle(e.target.value)} placeholder={`${topicName || 'Topic'} Quest`} />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-elevated/40 p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-display text-white">
            <input type="checkbox" checked={bossEnabled} onChange={(e) => setBossEnabled(e.target.checked)} />
            Create boss fight for this topic
          </label>
          <p className={clsx('text-xs leading-relaxed', bossEnabled && hardQuestionCount === 0 ? 'text-red-300' : 'text-gray-500')}>
            Boss fights need at least one hard question for this topic. Add a hard MCQ above before publishing the boss.
          </p>
          <input className="input-field" disabled={!bossEnabled} value={bossName} onChange={(e) => setBossName(e.target.value)} placeholder={`The ${topicName || 'Topic'} Sentinel`} />
        </div>

        <button disabled={!canSave || saveMutation.isPending} onClick={() => saveMutation.mutate()} className="btn-primary flex items-center gap-2">
          <Save size={16} />
          {saveMutation.isPending ? 'Publishing...' : 'Publish Content'}
        </button>
      </div>

      <div className="col-span-12 xl:col-span-5 space-y-4">
        <div className="card p-5">
          <p className="section-title mb-3">Published Topics</p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {(content?.topics ?? []).length === 0 && <p className="text-sm text-gray-500 font-mono">No custom topics yet.</p>}
            {content?.topics.map((t) => (
              <div key={t.id} className="rounded-lg border border-surface-border bg-surface-elevated/50 px-3 py-2">
                <p className="text-sm font-display font-semibold text-white">{t.name}</p>
                <p className="text-xs font-mono text-gray-500">{t.subject} · {t.difficulty} · tier {t.tier}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <p className="section-title mb-3">Setup Flow</p>
          {['Add subject', 'Add topic + prerequisite', 'Add MCQ', 'Generate quest', 'Unlock boss when mastered'].map((step, i) => (
            <div key={step} className="flex items-center gap-3 py-2">
              <span className="w-7 h-7 rounded-lg bg-brand/15 text-brand flex items-center justify-center font-mono text-xs">{i + 1}</span>
              <span className="text-sm text-gray-300">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const EMOTION_COLORS: Record<string, string> = {
  FOCUSED: '#00F5A0',
  BORED: '#6C757D',
  SLEEPY: '#FF9F43',
}

function normalizeEmotion(emotion?: string) {
  const value = (emotion ?? '').toUpperCase()
  if (value === 'SLEEPY') return 'SLEEPY'
  if (value === 'BORED' || value === 'DISENGAGED' || value === 'SAD' || value === 'FRUSTRATED' || value === 'ANGRY' || value === 'ANXIOUS' || value === 'CONFUSED' || value === 'SURPRISE' || value === 'FEAR') return 'BORED'
  return 'FOCUSED'
}

function aggregateEmotionCounts(distribution: Record<string, number>) {
  return Object.entries(distribution).reduce<Record<string, number>>((acc, [name, count]) => {
    const normalized = normalizeEmotion(name)
    acc[normalized] = (acc[normalized] ?? 0) + count
    return acc
  }, {})
}

// ── Student Card ──────────────────────────────────────────────────────────────
function StudentCard({ student, onSelect }: { student: StudentSummary; onSelect: () => void }) {
  const risk  = RISK_CONFIG[student.risk_level]
  const Trend = student.avg_focus_7d >= 60 ? TrendingUp
              : student.avg_focus_7d >= 40 ? Minus
              : TrendingDown
  const trendColor = student.avg_focus_7d >= 60 ? '#00F5A0'
                   : student.avg_focus_7d >= 40 ? '#FF9F43'
                   : '#FF4757'

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: `0 8px 24px ${risk.color}18` }}
      onClick={onSelect}
      className="card p-4 flex items-center gap-4 cursor-pointer hover:border-brand/30 transition-all"
    >
      <div className="w-10 h-10 rounded-full bg-gradient-brand flex items-center justify-center
                      font-display font-bold text-white text-sm shrink-0 shadow-glow">
        {student.name.charAt(0)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-white truncate">{student.name}</p>
        <p className="text-xs font-mono text-gray-400">
          LVL {student.level} · {student.streak_days}d streak · {student.topics_completed} topics
        </p>
        <p className="text-[11px] text-gray-500 truncate mt-0.5">
          Path: {(student.path_preview ?? []).slice(0, 3).join(' → ') || student.current_topic}
        </p>
      </div>

      {/* Focus bar */}
      <div className="hidden md:block w-36">
        <div className="flex items-center gap-1 mb-1">
          <Trend size={11} style={{ color: trendColor }} />
          <span className="text-xs font-mono font-bold" style={{ color: trendColor }}>
            {Math.round(student.avg_focus_7d)}%
          </span>
          <span className="text-[10px] font-mono text-gray-500 ml-auto">
            Face {Math.round(student.face_detection_rate)}%
          </span>
        </div>
        <div className="h-1 bg-surface-border rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{
            width: `${student.avg_focus_7d}%`,
            background: trendColor,
          }} />
        </div>
      </div>

      <div className="px-2.5 py-1 rounded-full border text-xs font-mono shrink-0"
        style={{ color: risk.color, borderColor: risk.color + '60', background: risk.bg }}>
        {student.risk_level === 'HIGH' && <AlertTriangle size={10} className="inline mr-1" />}
        {risk.label}
      </div>

      <ChevronRight size={14} className="text-gray-600 shrink-0" />
    </motion.div>
  )
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────
function StudentDrawer({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const { data: detail, isLoading } = useQuery<StudentDetail>({
    queryKey: ['teacher', 'student', studentId],
    queryFn: () => api.get(`/teacher/student/${studentId}`).then((r) => r.data),
    enabled: !!studentId,
  })

  const risk = detail ? RISK_CONFIG[detail.risk_level] : RISK_CONFIG.LOW
  const chartData = detail?.focus_history.slice(-20).map((h) => ({
    time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    score: Math.round(h.score),
  })) ?? []

  const emoData = detail
    ? Object.entries(aggregateEmotionCounts(detail.emotion_distribution)).map(([name, count]) => ({ name, count }))
    : []

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-y-0 right-0 w-full max-w-md bg-surface-card border-l border-surface-border z-40 overflow-y-auto shadow-2xl"
    >
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-bold text-white">
            {detail?.name ?? '…'}
          </p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-elevated text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-surface-elevated animate-pulse" />
            ))}
          </div>
        )}

        {detail && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Avg Focus', value: `${detail.avg_focus_7d}%`, color: risk.color },
                { label: 'Face Detect', value: `${Math.round(detail.face_detection_rate)}%`, color: '#00F5A0' },
                { label: 'Topics', value: `${detail.topics_completed}`, color: '#FFD700' },
              ].map((s) => (
                <div key={s.label} className="card p-3 text-center">
                  <p className="font-display text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs font-mono text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="card p-3">
              <p className="text-xs font-mono text-gray-400 uppercase tracking-wide mb-2">Learning Path</p>
              <p className="text-sm font-display font-semibold text-white">{detail.current_topic}</p>
              <div className="h-1.5 rounded-full bg-surface-border overflow-hidden mt-2">
                <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${detail.current_progress_pct}%` }} />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {detail.completed_topics.slice(0, 8).map((topic) => (
                  <span key={topic} className="text-[11px] font-mono px-2 py-1 rounded-full border border-accent-emerald/30 bg-accent-emerald/10 text-accent-emerald">
                    {topic}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 mt-3">
                {detail.cv_sessions_7d} webcam samples logged in the last 7 days.
              </p>
            </div>

            {/* Risk badge + reasons */}
            <div className="p-3 rounded-xl border" style={{ background: risk.bg, borderColor: risk.color + '40' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono font-bold" style={{ color: risk.color }}>
                  {detail.risk_level} RISK — score {Math.round(detail.risk_score)}/100
                </span>
              </div>
              {detail.risk_reasons.length > 0 && (
                <ul className="space-y-0.5">
                  {detail.risk_reasons.map((r, i) => (
                    <li key={i} className="text-xs font-mono text-gray-400 flex items-center gap-1">
                      <span style={{ color: risk.color }}>·</span> {r}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Suggestions */}
            {detail.suggestions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Lightbulb size={13} className="text-accent-gold" />
                  <p className="text-xs font-mono text-gray-400 uppercase tracking-wide">Suggestions</p>
                </div>
                {detail.suggestions.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-accent-gold/08 border border-accent-gold/20">
                    <Brain size={12} className="text-accent-gold shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-200 font-display">{s}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Focus chart */}
            {chartData.length > 0 && (
              <div>
                <p className="text-xs font-mono text-gray-400 uppercase tracking-wide mb-2">Focus History</p>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                    <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 9 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 9 }} width={24} />
                    <Tooltip
                      contentStyle={{ background: '#1A1828', border: '1px solid #2E2A47', borderRadius: 8, fontSize: 11 }}
                    />
                    <Line type="monotone" dataKey="score" stroke="#6C63FF" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Emotion breakdown */}
            {emoData.length > 0 && (
              <div>
                <p className="text-xs font-mono text-gray-400 uppercase tracking-wide mb-2">Emotion Breakdown</p>
                <div className="space-y-1.5">
                  {emoData.sort((a, b) => b.count - a.count).map(({ name, count }) => {
                    const total = emoData.reduce((s, e) => s + e.count, 0)
                    const pct = Math.round((count / total) * 100)
                    return (
                      <div key={name}>
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs font-mono" style={{ color: EMOTION_COLORS[name] ?? '#9ca3af' }}>{name}</span>
                          <span className="text-xs font-mono text-gray-500">{pct}%</span>
                        </div>
                        <div className="h-1 bg-surface-border rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: `${pct}%`,
                            background: EMOTION_COLORS[name] ?? '#6C63FF',
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TeacherDashboardPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<'class' | 'setup'>('class')
  const [filterRisk, setFilterRisk] = useState<'HIGH' | 'MEDIUM' | 'LOW' | null>(null)

  const { data: students = [], isLoading } = useQuery<StudentSummary[]>({
    queryKey: ['teacher', 'class'],
    queryFn: () => api.get('/teacher/class').then((r) => r.data),
    refetchInterval: 30_000,
  })

  const { data: summary } = useQuery<ClassSummary>({
    queryKey: ['teacher', 'summary'],
    queryFn: () => api.get('/teacher/summary').then((r) => r.data),
    refetchInterval: 30_000,
  })

  const { data: bottlenecks = [] } = useQuery<BottleneckConcept[]>({
    queryKey: ['teacher', 'bottlenecks'],
    queryFn: () => api.get('/graph/teacher/bottlenecks').then((r) => r.data),
    refetchInterval: 60_000,
  })

  const atRisk   = students.filter((s) => s.risk_level === 'HIGH')
  const watching = students.filter((s) => s.risk_level === 'MEDIUM')
  const healthy  = students.filter((s) => s.risk_level === 'LOW')
  const avgFocus = summary?.class_avg_focus ?? (students.length
    ? Math.round(students.reduce((a, s) => a + s.avg_focus_7d, 0) / students.length)
    : 0)

  const focusBarData = students.map((s) => ({
    name: s.name.split(' ')[0],
    focus: Math.round(s.avg_focus_7d),
    fill: s.avg_focus_7d >= 60 ? '#00F5A0' : s.avg_focus_7d >= 40 ? '#FF9F43' : '#FF4757',
  }))

  const emotionData = Object.entries(aggregateEmotionCounts(summary?.emotion_distribution ?? {}))
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
  const emotionTotal = emotionData.reduce((sum, e) => sum + e.count, 0)

  return (
    <div className="space-y-6 max-w-6xl relative">
      {/* Overlay for drawer */}
      <AnimatePresence>
        {selectedId && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedId(null)}
              className="fixed inset-0 bg-black/50 z-30"
            />
            <StudentDrawer studentId={selectedId} onClose={() => setSelectedId(null)} />
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <div>
        <p className="stat-label">Educator View</p>
        <h1 className="page-title mt-0.5">
          <Users className="inline mr-2 text-brand" size={28} />
          Class View
        </h1>
        <p className="text-sm text-gray-400 font-mono mt-1">
          Monitor students and publish learning content to the Skill Tree.
        </p>
      </div>

      <div className="inline-flex rounded-xl bg-surface-card border border-surface-border p-1">
        {[
          { id: 'class', label: 'Class View', icon: Users },
          { id: 'setup', label: 'Content Setup', icon: Settings2 },
        ].map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setView(tab.id as 'class' | 'setup')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-display font-semibold flex items-center gap-2 transition-all',
                view === tab.id ? 'bg-brand text-white shadow-glow' : 'text-gray-400 hover:text-white',
              )}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {view === 'setup' && <ContentSetupPanel />}

      {view === 'class' && (
        <>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: summary?.total_students ?? students.length, color: '#8B85FF', type: 'ALL' },
          { label: 'At Risk',        value: atRisk.length,     color: '#FF4757', type: 'HIGH' },
          { label: 'Watching',       value: watching.length,   color: '#FF9F43', type: 'MEDIUM' },
          { label: 'Class Avg Focus',value: `${avgFocus}%`,    color: '#00F5A0', type: 'AVG' },
        ].map((s) => {
          const isInteractive = s.type !== 'AVG';
          const isActive = isInteractive && (s.type === 'ALL' ? !filterRisk : filterRisk === s.type);
          return (
            <div
              key={s.label}
              onClick={() => isInteractive && setFilterRisk(s.type === 'ALL' ? null : s.type as any)}
              className={clsx(
                "card p-4 text-center select-none transition-all",
                isInteractive && "cursor-pointer hover:border-brand/40 hover:bg-brand/05",
                isActive && "border-brand bg-brand/10 shadow-glow"
              )}
            >
              <p className="text-3xl font-display font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="stat-label mt-1">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Alert banner */}
      {atRisk.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          onClick={() => {
            setFilterRisk('HIGH');
            document.getElementById('student-list')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="flex items-center gap-3 p-3 rounded-xl bg-accent-crimson/10 border border-accent-crimson/30 cursor-pointer hover:bg-accent-crimson/15 transition-all"
        >
          <AlertTriangle size={15} className="text-accent-crimson shrink-0" />
          <p className="text-sm font-display text-accent-crimson">
            {atRisk.length} student{atRisk.length > 1 ? 's' : ''} need attention:{' '}
            <span className="font-bold">{atRisk.map((s) => s.name.split(' ')[0]).join(', ')}</span>
          </p>
          <span className="ml-auto text-xs font-mono text-accent-crimson/60 hover:text-accent-crimson transition-colors">
            Click to view →
          </span>
        </motion.div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Student list */}
        <div id="student-list" className="col-span-12 lg:col-span-7 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="stat-label">
              {filterRisk 
                ? `Students — showing ${filterRisk === 'HIGH' ? 'At Risk' : filterRisk === 'MEDIUM' ? 'Watching' : 'Low Risk'}`
                : 'Students — sorted by risk'
              }
            </p>
            {filterRisk && (
              <button 
                onClick={() => setFilterRisk(null)}
                className="text-xs font-mono text-brand hover:text-brand-light transition-colors"
              >
                [Clear Filter]
              </button>
            )}
          </div>
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-surface-card animate-pulse" />
              ))
            : (filterRisk 
                ? students.filter((s) => s.risk_level === filterRisk)
                : [...atRisk, ...watching, ...healthy]
              ).map((s) => (
                <StudentCard key={s.id} student={s} onSelect={() => setSelectedId(s.id)} />
              ))
          }
        </div>

        {/* Focus bar chart */}
        <div className="col-span-12 lg:col-span-5 card p-5">
          <p className="section-title mb-4">Class Focus Distribution</p>
          {focusBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={focusBarData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#2E2A47" />
                <XAxis type="number" domain={[0, 100]} stroke="#6C757D" tick={{ fontSize: 10, fill: '#6C757D' }} />
                <YAxis type="category" dataKey="name" width={64} stroke="#6C757D" tick={{ fontSize: 10, fill: '#6C757D' }} />
                <Tooltip
                  contentStyle={{ background: '#1A1828', border: '1px solid #2E2A47', borderRadius: 8 }}
                  labelStyle={{ color: '#9CA3AF', fontSize: 11 }}
                />
                <Bar dataKey="focus" radius={[0, 4, 4, 0]}
                  background={{ fill: '#1A1828', radius: 4 }}
                  fill="#6C63FF"
                >
                  {focusBarData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500 font-mono text-sm">
              No student data yet
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-5 card p-5">
          <p className="section-title mb-4">Class Emotion Trend</p>
          {emotionData.length > 0 ? (
            <div className="space-y-3">
              {emotionData.map(({ name, count }) => {
                const pct = emotionTotal ? Math.round((count / emotionTotal) * 100) : 0
                const color = EMOTION_COLORS[name] ?? '#9CA3AF'
                return (
                  <div key={name}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-mono" style={{ color }}>{name}</span>
                      <span className="text-xs font-mono text-gray-500">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-surface-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-500 font-mono text-sm">
              Emotion data appears after students run webcam sessions
            </div>
          )}
        </div>

        <div className="col-span-12 lg:col-span-7 card p-5">
          <p className="section-title mb-4">Bottleneck Concepts</p>
          {bottlenecks.length > 0 ? (
            <div className="space-y-2">
              {bottlenecks.slice(0, 6).map((concept) => (
                <div key={concept.concept_id} className="flex items-center gap-3 rounded-lg bg-surface-elevated/60 border border-surface-border px-3 py-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand/15 text-brand flex items-center justify-center font-mono text-xs">
                    {concept.blocking_count}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-display font-semibold text-white truncate">{concept.name}</p>
                    <p className="text-xs font-mono text-gray-500">
                      Avg mastery {Math.round(concept.avg_mastery * 100)}%
                    </p>
                  </div>
                  <div className="w-24 h-1.5 rounded-full bg-surface-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent-crimson"
                      style={{ width: `${Math.min(100, Math.round((1 - concept.avg_mastery) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-500 font-mono text-sm">
              Bottlenecks appear after students answer concept questions
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  )
}
