import { motion, AnimatePresence } from 'framer-motion'
import { useCVStore } from '@/stores/cvStore'
import { useShallow } from 'zustand/react/shallow'
import type { EmotionLabel } from '@/types'

const EMOTIONS: { label: EmotionLabel; emoji: string; color: string; tip: string }[] = [
  { label: 'FOCUSED',    emoji: '🎯', color: '#00F5A0', tip: 'Keep it up!'         },
  { label: 'BORED',      emoji: '😴', color: '#6C757D', tip: 'Challenge mode?'      },
  { label: 'SLEEPY',     emoji: '🥱', color: '#FF9F43', tip: 'Eyes closed'          },
]

export default function EmotionWidget() {
  const { emotion, emotionConfidence, isWebcamActive } = useCVStore(
    useShallow((s) => ({ emotion: s.emotion, emotionConfidence: s.emotionConfidence, isWebcamActive: s.isWebcamActive })),
  )
  const current = EMOTIONS.find((e) => e.label === emotion) ?? EMOTIONS[0]

  return (
    <div className="card p-5 flex flex-col gap-4">
      <p className="stat-label">Emotion State</p>

      {/* Current emotion display */}
      <AnimatePresence mode="wait">
        <motion.div
          key={emotion}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-center gap-3"
        >
          <span
            className="text-4xl w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ background: current.color + '15', border: `1px solid ${current.color}40` }}
          >
            {current.emoji}
          </span>
          <div>
            <p className="font-display text-lg font-bold" style={{ color: current.color }}>
              {isWebcamActive ? current.label : 'NO CAM'}
            </p>
            <p className="text-xs text-gray-400 font-mono">{current.tip}</p>
            {isWebcamActive && (
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                Conf: {Math.round(emotionConfidence * 100)}%
              </p>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Emotion palette */}
      <div className="grid grid-cols-3 gap-1.5">
        {EMOTIONS.map((e) => (
          <motion.div
            key={e.label}
            className="flex flex-col items-center gap-0.5 p-1 rounded-lg cursor-default"
            animate={{
              scale: e.label === emotion && isWebcamActive ? 1.15 : 1,
              opacity: isWebcamActive ? 1 : 0.4,
            }}
            style={{
              background: e.label === emotion && isWebcamActive ? e.color + '20' : 'transparent',
              border: `1px solid ${e.label === emotion && isWebcamActive ? e.color + '60' : 'transparent'}`,
            }}
          >
            <span className="text-base">{e.emoji}</span>
            <span className="text-gray-500" style={{ fontSize: '9px' }}>
              {e.label.slice(0, 3)}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
