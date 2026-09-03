import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { TrendingUp, Brain, Clock, Zap, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import { analyticsService } from '@/services/analyticsService'
import type { FocusHistoryPoint, Insight } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────
const EMOTION_COLORS: Record<string, string> = {
  FOCUSED:    '#00F5A0',
  BORED:      '#6C757D',
  SLEEPY:     '#FF9F43',
}

function normalizeEmotion(emotion?: string) {
  const value = (emotion ?? '').toUpperCase()
  if (value === 'SLEEPY') return 'SLEEPY'
  if (value === 'BORED' || value === 'DISENGAGED' || value === 'SAD' || value === 'FRUSTRATED' || value === 'ANGRY' || value === 'ANXIOUS' || value === 'CONFUSED' || value === 'SURPRISE' || value === 'FEAR') return 'BORED'
  return 'FOCUSED'
}

function aggregateEmotionDistribution(distribution: Record<string, number>) {
  return Object.entries(distribution).reduce<Record<string, number>>((acc, [name, value]) => {
    const normalized = normalizeEmotion(name)
    acc[normalized] = (acc[normalized] ?? 0) + value
    return acc
  }, {})
}

function focusColor(score: number) {
  if (score >= 70) return '#00F5A0'
  if (score >= 40) return '#FFD700'
  return '#FF4757'
}

function avg(arr: number[]) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: color + '20', border: `1px solid ${color}40` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="stat-label">{label}</p>
        <p className="font-display text-xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 font-mono">{sub}</p>}
      </div>
    </div>
  )
}

function InsightCard({ insight }: { insight: Insight }) {
  const icon = insight.severity === 'success' ? <CheckCircle size={16} />
    : insight.severity === 'warning' ? <AlertTriangle size={16} />
    : <Info size={16} />
  const color = insight.severity === 'success' ? '#00F5A0'
    : insight.severity === 'warning' ? '#FF9F43'
    : '#8B85FF'
  return (
    <div className="flex gap-3 p-3 rounded-xl border"
      style={{ background: color + '08', borderColor: color + '30' }}>
      <span style={{ color }} className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-sm text-white font-display">{insight.message}</p>
        {insight.action && (
          <p className="text-xs text-gray-400 font-mono mt-0.5">→ {insight.action}</p>
        )}
      </div>
    </div>
  )
}

// ── Custom recharts tooltip ───────────────────────────────────────────────────
function FocusTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const score = payload[0]?.value ?? 0
  return (
    <div className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 shadow-xl text-xs font-mono">
      <p className="text-gray-400">{label}</p>
      <p className="font-bold mt-0.5" style={{ color: focusColor(score) }}>
        Focus: {score}
      </p>
      {payload[1] && (
        <p className="text-gray-400">Emotion: {payload[1].payload.emotion}</p>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function FocusAnalyticsPage() {
  const [history, setHistory]   = useState<FocusHistoryPoint[]>([])
  const [emotions, setEmotions] = useState<Record<string, number>>({})
  const [insights, setInsights] = useState<Insight[]>([])
  const [days, setDays]         = useState(7)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      analyticsService.getFocusHistory(days),
      analyticsService.getEmotionDistribution(days),
      analyticsService.getInsights(),
    ]).then(([h, e, i]) => {
      setHistory(h)
      setEmotions(e)
      setInsights(i)
    }).finally(() => setLoading(false))
  }, [days])

  const scores   = history.map((h) => h.score)
  const avgScore = avg(scores)
  const peakScore = Math.max(0, ...scores)
  const flowPct  = scores.length
    ? Math.round(scores.filter((s) => s >= 70).length / scores.length * 100)
    : 0

  const chartData = history.map((h) => ({
    time:    fmtTime(h.timestamp),
    score:   Math.round(h.score),
    emotion: normalizeEmotion(h.emotion),
  }))

  const pieData = Object.entries(aggregateEmotionDistribution(emotions))
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) }))

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
  const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-6xl">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <p className="stat-label">Intelligence Layer</p>
          <h1 className="page-title mt-0.5">Focus Analytics</h1>
        </div>
        {/* Day filter */}
        <div className="flex gap-2">
          {[1, 7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                days === d
                  ? 'bg-brand/20 text-brand border border-brand/40'
                  : 'text-gray-400 border border-surface-border hover:text-white'
              }`}
            >
              {d === 1 ? 'Today' : `${d}d`}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Stat cards */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<TrendingUp size={18} />} label="Avg Focus"
          value={`${Math.round(avgScore)}%`} sub="last session"
          color={focusColor(avgScore)} />
        <StatCard icon={<Zap size={18} />} label="Peak Focus"
          value={`${Math.round(peakScore)}%`} sub="single reading"
          color="#FFD700" />
        <StatCard icon={<Brain size={18} />} label="Flow State"
          value={`${flowPct}%`} sub="of session time"
          color="#8B85FF" />
        <StatCard icon={<Clock size={18} />} label="Data Points"
          value={`${scores.length}`} sub={`over ${days} day${days > 1 ? 's' : ''}`}
          color="#00F5A0" />
      </motion.div>

      {/* Focus line chart */}
      <motion.div variants={item} className="card p-5">
        <p className="stat-label mb-4">Focus Score Over Time</p>
        {loading ? (
          <div className="h-52 flex items-center justify-center text-gray-500 font-mono text-sm">
            Loading…
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-gray-500 font-mono text-sm">
            No data yet — start a study session to see your focus history.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Tooltip content={<FocusTooltip />} />
              <Line
                type="monotone" dataKey="score" stroke="#6C63FF"
                strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#6C63FF' }}
              />
              {/* Reference bands */}
              {[40, 70].map((threshold) => (
                <Line
                  key={threshold}
                  type="monotone"
                  data={chartData.map((d) => ({ ...d, ref: threshold }))}
                  dataKey="ref"
                  stroke={threshold === 70 ? '#00F5A0' : '#FF4757'}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  dot={false}
                  strokeOpacity={0.3}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        <div className="flex gap-4 mt-3">
          {[
            { color: '#00F5A0', label: '≥70 — Flow zone' },
            { color: '#FFD700', label: '40–70 — Productive' },
            { color: '#FF4757', label: '<40 — Needs break' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span className="text-xs font-mono text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Emotion distribution + Insights side-by-side */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Emotion pie */}
        <div className="card p-5">
          <p className="stat-label mb-4">Emotion Distribution</p>
          {pieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-500 font-mono text-sm">
              No emotion data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  paddingAngle={3} dataKey="value"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={EMOTION_COLORS[entry.name] ?? '#8B85FF'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [`${v}%`, '']}
                  contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                />
                <Legend
                  formatter={(v) => <span style={{ color: '#9ca3af', fontSize: 11 }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* AI Insights */}
        <div className="card p-5 flex flex-col gap-3">
          <p className="stat-label">AI Insights</p>
          {insights.length === 0 ? (
            <p className="text-xs text-gray-500 font-mono">
              Complete a study session to unlock personalised insights.
            </p>
          ) : (
            insights.map((ins, i) => <InsightCard key={i} insight={ins} />)
          )}
        </div>
      </motion.div>

      {/* Session summary table */}
      {chartData.length > 0 && (
        <motion.div variants={item} className="card p-5">
          <p className="stat-label mb-3">Session Summary</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-gray-500 border-b border-surface-border">
                  <th className="text-left pb-2">Time</th>
                  <th className="text-right pb-2">Focus</th>
                  <th className="text-right pb-2">Emotion</th>
                  <th className="text-right pb-2">Zone</th>
                </tr>
              </thead>
              <tbody>
                {chartData.slice(-10).reverse().map((row, i) => (
                  <tr key={i} className="border-b border-surface-border/30 hover:bg-surface-elevated/30">
                    <td className="py-1.5 text-gray-400">{row.time}</td>
                    <td className="py-1.5 text-right font-bold" style={{ color: focusColor(row.score) }}>
                      {row.score}%
                    </td>
                    <td className="py-1.5 text-right" style={{ color: EMOTION_COLORS[row.emotion] ?? '#9ca3af' }}>
                      {row.emotion}
                    </td>
                    <td className="py-1.5 text-right text-gray-500">
                      {row.score >= 70 ? '🔥 Flow' : row.score >= 40 ? '⚡ Active' : '😴 Low'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
