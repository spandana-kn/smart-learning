import { motion, AnimatePresence } from 'framer-motion'
import { useCVStore } from '@/stores/cvStore'
import { useShallow } from 'zustand/react/shallow'

const EMOTION_CONFIG = {
  FOCUSED:    { color: '#00F5A0', bg: 'rgba(0,245,160,0.1)',   emoji: '🎯', border: '#00F5A0' },
  BORED:      { color: '#6C757D', bg: 'rgba(108,117,125,0.1)', emoji: '😴', border: '#6C757D' },
  SLEEPY:     { color: '#FF9F43', bg: 'rgba(255,159,67,0.1)',  emoji: '🥱', border: '#FF9F43' },
}

export default function EmotionBadge() {
  const { emotion, emotionConfidence, isWebcamActive } = useCVStore(
    useShallow((s) => ({ emotion: s.emotion, emotionConfidence: s.emotionConfidence, isWebcamActive: s.isWebcamActive })),
  )
  const cfg = EMOTION_CONFIG[emotion] ?? EMOTION_CONFIG.FOCUSED

  if (!isWebcamActive) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-elevated border border-surface-border">
        <span className="text-xs">😶</span>
        <span className="text-xs font-mono text-gray-500">NO CAM</span>
      </div>
    )
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={emotion}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono"
        style={{
          color: cfg.color,
          background: cfg.bg,
          borderColor: cfg.border + '60',
        }}
      >
        <span>{cfg.emoji}</span>
        <span>{emotion}</span>
        <span className="text-gray-500 ml-0.5">{Math.round(emotionConfidence * 100)}%</span>
      </motion.div>
    </AnimatePresence>
  )
}
