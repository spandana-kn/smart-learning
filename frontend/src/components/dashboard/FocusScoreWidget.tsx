import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useCVStore } from '@/stores/cvStore'
import { useShallow } from 'zustand/react/shallow'
import { analyticsService } from '@/services/analyticsService'
import FocusOrb from '@/components/cv/FocusOrb'

const STATE_LABELS: Record<string, { label: string; color: string }> = {
  FLOW:                 { label: 'In The Zone', color: '#00F5A0' },
  PRODUCTIVE:           { label: 'Productive',  color: '#6C63FF' },
  STRUGGLING:           { label: 'Struggling',  color: '#FF9F43' },
  FRUSTRATED_OVERLOAD:  { label: 'Overloaded',  color: '#FF4757' },
  DISENGAGED:           { label: 'Disengaged',  color: '#6C757D' },
  FATIGUED:             { label: 'Fatigued',    color: '#8B7FCC' },
  MASTERY_HIGH:         { label: 'Mastered!',   color: '#FFD700' },
}

function focusColor(score: number) {
  if (score >= 70) return '#00F5A0'   // green — flow
  if (score >= 40) return '#FFD700'   // yellow — productive
  return '#FF4757'                    // red — needs attention
}

const COMPONENT_LABELS = [
  { key: 'face',  label: 'Face Presence',  weight: '40%' },
  { key: 'head',  label: 'Head Alignment', weight: '30%' },
  { key: 'eyes',  label: 'Eye Engagement', weight: '30%' },
] as const

export default function FocusScoreWidget() {
  const { focusScore, attention, learningState, isWebcamActive, isConnected, setFocusUpdate } = useCVStore(
    useShallow((s) => ({
      focusScore: s.focusScore,
      attention: s.attention,
      learningState: s.learningState,
      isWebcamActive: s.isWebcamActive,
      isConnected: s.isConnected,
      setFocusUpdate: s.setFocusUpdate,
    })),
  )
  const stateInfo = STATE_LABELS[learningState] ?? STATE_LABELS.PRODUCTIVE
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // HTTP polling fallback when WebSocket is not connected
  useEffect(() => {
    if (isConnected) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    pollRef.current = setInterval(async () => {
      try {
        const data = await analyticsService.getLiveFocus()
        if (!data.stale) setFocusUpdate(data.score, data.state as any, data.attention)
      } catch { /* ignore */ }
    }, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [isConnected, setFocusUpdate])

  const color = focusColor(focusScore)

  // Approximate component breakdown from attention (0-1) and focusScore
  const faceVal    = isWebcamActive ? Math.min(100, Math.round(attention * 100 + 10)) : 0
  const headVal    = isWebcamActive ? Math.min(100, Math.round(focusScore + (attention - 0.5) * 20)) : 0
  const eyesVal    = isWebcamActive ? Math.min(100, Math.round(focusScore * 0.9)) : 0

  const components = [
    { ...COMPONENT_LABELS[0], value: faceVal },
    { ...COMPONENT_LABELS[1], value: headVal },
    { ...COMPONENT_LABELS[2], value: eyesVal },
  ]

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="stat-label">Focus Score</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-xs font-mono px-2 py-0.5 rounded-full border"
              style={{ color: stateInfo.color, borderColor: stateInfo.color + '60', background: stateInfo.color + '15' }}
            >
              {stateInfo.label}
            </span>
            {!isConnected && !isWebcamActive && (
              <span className="text-xs font-mono text-gray-500 border border-gray-700 px-1.5 py-0.5 rounded-full">
                polling
              </span>
            )}
          </div>
        </div>
        <FocusOrb size="lg" showLabel />
      </div>

      {/* Big color-coded score */}
      <div className="flex items-end gap-2">
        <motion.span
          key={Math.round(focusScore)}
          initial={{ scale: 0.9, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          className="font-display text-4xl font-bold tabular-nums"
          style={{ color }}
        >
          {isWebcamActive || focusScore > 0 ? Math.round(focusScore) : '--'}
        </motion.span>
        <span className="text-gray-500 font-mono text-sm mb-1">/ 100</span>
        <div className="ml-auto text-right">
          <p className="text-xs font-mono" style={{ color }}>
            {focusScore >= 70 ? '● FLOW' : focusScore >= 40 ? '● ACTIVE' : focusScore > 0 ? '● LOW' : ''}
          </p>
        </div>
      </div>

      {/* 3-component breakdown bars */}
      <div className="space-y-2.5">
        {components.map(({ label, weight, value }) => (
          <div key={label}>
            <div className="flex justify-between mb-1">
              <span className="text-xs font-mono text-gray-400">
                {label} <span className="text-gray-600">({weight})</span>
              </span>
              <span className="text-xs font-mono" style={{ color: focusColor(value) }}>
                {isWebcamActive ? `${value}%` : '--'}
              </span>
            </div>
            <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: focusColor(value) }}
                animate={{ width: isWebcamActive ? `${value}%` : '0%' }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </div>

      {!isWebcamActive && focusScore === 0 && (
        <p className="text-xs text-gray-500 font-mono text-center">
          Enable webcam for live component tracking
        </p>
      )}
    </div>
  )
}
