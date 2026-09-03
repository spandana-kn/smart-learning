import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'
import { focusService } from '@/services/focusService'
import { Eye, TrendingUp, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import type { Insight } from '@/types'
import clsx from 'clsx'

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

function InsightCard({ insight }: { insight: Insight }) {
  const config = {
    info:    { icon: Info,          color: '#6C63FF', bg: 'rgba(108,99,255,0.1)'  },
    warning: { icon: AlertTriangle, color: '#FF9F43', bg: 'rgba(255,159,67,0.1)' },
    success: { icon: CheckCircle,   color: '#00F5A0', bg: 'rgba(0,245,160,0.1)'  },
  }
  const cfg = config[insight.severity]
  const Icon = cfg.icon

  return (
    <motion.div
      whileHover={{ x: 4 }}
      className="flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-default"
      style={{ background: cfg.bg, borderColor: cfg.color + '40' }}
    >
      <Icon size={16} className="shrink-0 mt-0.5" style={{ color: cfg.color }} />
      <div className="flex-1">
        <p className="text-sm text-white font-display">{insight.message}</p>
        {insight.action && (
          <p className="text-xs text-gray-400 font-mono mt-1">💡 {insight.action}</p>
        )}
      </div>
    </motion.div>
  )
}

function HeatmapCell({ score, date }: { score: number; date: string }) {
  const opacity = score / 100
  const color = score >= 70 ? '#00F5A0' : score >= 40 ? '#6C63FF' : '#FF4757'
  return (
    <div
      title={`${date}: ${Math.round(score)}% focus`}
      className="w-4 h-4 rounded-sm cursor-default transition-transform hover:scale-125"
      style={{ background: color, opacity: Math.max(0.1, opacity) }}
    />
  )
}

export default function EmotionOraclePage() {
  const { data: history = [], isLoading: hLoading } = useQuery({
    queryKey: ['focus', 'history', 7],
    queryFn: () => focusService.getHistory(7),
  })

  const { data: heatmap = [] } = useQuery({
    queryKey: ['focus', 'heatmap'],
    queryFn: () => focusService.getHeatmap(8),
  })

  const { data: insights = [] } = useQuery({
    queryKey: ['focus', 'insights'],
    queryFn: () => focusService.getInsights(),
  })

  // Build emotion distribution from history
  const emotionCounts = history.reduce((acc: Record<string, number>, p) => {
    const emotion = normalizeEmotion(p.emotion)
    acc[emotion] = (acc[emotion] ?? 0) + 1
    return acc
  }, {})
  const pieData = Object.entries(emotionCounts).map(([name, value]) => ({ name, value }))

  // Format history for charts
  const chartData = history.map((p) => ({
    time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    focus: Math.round(p.score),
    emotion: normalizeEmotion(p.emotion),
  }))

  // Group heatmap into weeks
  const weeks: typeof heatmap[] = []
  for (let i = 0; i < heatmap.length; i += 7) {
    weeks.push(heatmap.slice(i, i + 7))
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <p className="stat-label">Analytics & Intelligence</p>
        <h1 className="page-title mt-0.5">
          <Eye className="inline mr-2 text-brand" size={28} />
          Focus Oracle
        </h1>
        <p className="text-sm text-gray-400 font-mono mt-1">
          Deep insights into your learning patterns and emotional states.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Avg Focus (7d)', value: history.length ? Math.round(history.reduce((a, p) => a + p.score, 0) / history.length) + '%' : '--', color: '#6C63FF' },
          { label: 'Peak Focus', value: history.length ? Math.round(Math.max(...history.map((p) => p.score))) + '%' : '--', color: '#00F5A0' },
          { label: 'Sessions', value: String(new Set(history.map((p) => p.timestamp.slice(0, 10))).size), color: '#FFD700' },
        ].map((stat) => (
          <div key={stat.label} className="card p-4 text-center">
            <p className="stat-value text-3xl" style={{ color: stat.color }}>{stat.value}</p>
            <p className="stat-label mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-12 gap-4">
        {/* Focus timeline */}
        <div className="col-span-12 lg:col-span-8 card p-5">
          <p className="section-title mb-4">Focus Timeline (7 days)</p>
          {hLoading ? (
            <div className="h-48 bg-surface-elevated rounded-lg animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="focusGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6C63FF" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#6C63FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E2A47" />
                <XAxis dataKey="time" stroke="#6C757D" tick={{ fontSize: 10, fill: '#6C757D' }} />
                <YAxis domain={[0, 100]} stroke="#6C757D" tick={{ fontSize: 10, fill: '#6C757D' }} />
                <Tooltip
                  contentStyle={{ background: '#1A1828', border: '1px solid #2E2A47', borderRadius: 8 }}
                  labelStyle={{ color: '#9CA3AF', fontSize: 11 }}
                  itemStyle={{ color: '#6C63FF', fontSize: 11 }}
                />
                <Area type="monotone" dataKey="focus" stroke="#6C63FF" strokeWidth={2}
                  fill="url(#focusGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Emotion pie */}
        <div className="col-span-12 lg:col-span-4 card p-5">
          <p className="section-title mb-4">Emotion Distribution</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                  dataKey="value" paddingAngle={3}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={EMOTION_COLORS[entry.name] ?? '#6C63FF'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1A1828', border: '1px solid #2E2A47', borderRadius: 8 }}
                  labelStyle={{ color: '#9CA3AF', fontSize: 11 }}
                />
                <Legend
                  formatter={(value) => <span style={{ color: '#9CA3AF', fontSize: 11 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500 font-mono text-sm">
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* Heatmap */}
      <div className="card p-5">
        <p className="section-title mb-4">Focus Heatmap (8 weeks)</p>
        <div className="flex gap-2 flex-wrap">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((cell, di) => (
                <HeatmapCell key={di} score={cell.avg_score} date={cell.date} />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4">
          <span className="text-xs font-mono text-gray-500">Less</span>
          {[10, 30, 55, 75, 90].map((v) => (
            <div key={v} className="w-3 h-3 rounded-sm" style={{
              background: v >= 70 ? '#00F5A0' : v >= 40 ? '#6C63FF' : '#FF4757',
              opacity: Math.max(0.1, v / 100),
            }} />
          ))}
          <span className="text-xs font-mono text-gray-500">More</span>
        </div>
      </div>

      {/* AI Insights */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-brand" />
          <p className="section-title">AI Insights</p>
        </div>
        {insights.length > 0 ? (
          <div className="space-y-3">
            {insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
          </div>
        ) : (
          <p className="text-sm text-gray-500 font-mono text-center py-6">
            Study more sessions to unlock insights
          </p>
        )}
      </div>
    </div>
  )
}
