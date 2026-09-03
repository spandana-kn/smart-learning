import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, TrendingDown, TrendingUp, Lightbulb, Coffee, X } from 'lucide-react'
import { useCVStore } from '@/stores/cvStore'
import { useShallow } from 'zustand/react/shallow'

const ACTION_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  REDUCE_DIFFICULTY:    { icon: <TrendingDown size={15} />, color: '#FF9F43', bg: '#FF9F4315' },
  INCREASE_DIFFICULTY:  { icon: <TrendingUp   size={15} />, color: '#00F5A0', bg: '#00F5A015' },
  OFFER_HINT:           { icon: <Lightbulb    size={15} />, color: '#FFD700', bg: '#FFD70015' },
  BOOST_ENCOURAGEMENT:  { icon: <Sparkles     size={15} />, color: '#8B85FF', bg: '#8B85FF15' },
  FORCE_BREAK:          { icon: <Coffee       size={15} />, color: '#FF4757', bg: '#FF475715' },
}

const DEFAULT_CONFIG = { icon: <Sparkles size={15} />, color: '#8B85FF', bg: '#8B85FF15' }

export default function AdaptationToast() {
  const { lastAdaptation, setAdaptation } = useCVStore(
    useShallow((s) => ({ lastAdaptation: s.lastAdaptation, setAdaptation: s.setAdaptation })),
  )
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!lastAdaptation) return
    setVisible(true)
    const t = setTimeout(() => {
      setVisible(false)
      // Clear after exit animation
      setTimeout(() => setAdaptation('', ''), 400)
    }, 5000)
    return () => clearTimeout(t)
  }, [lastAdaptation, setAdaptation])

  const cfg = lastAdaptation
    ? (ACTION_CONFIG[lastAdaptation.action] ?? DEFAULT_CONFIG)
    : DEFAULT_CONFIG

  return (
    <AnimatePresence>
      {visible && lastAdaptation && (
        <motion.div
          key={lastAdaptation.action + lastAdaptation.message}
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0,   scale: 1 }}
          exit={{   opacity: 0, y: -12,  scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="fixed top-4 right-4 z-50 flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl border max-w-xs"
          style={{ background: cfg.bg, borderColor: cfg.color + '40' }}
        >
          <span className="mt-0.5 shrink-0" style={{ color: cfg.color }}>{cfg.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono uppercase tracking-wide" style={{ color: cfg.color }}>
              {lastAdaptation.action.replace(/_/g, ' ')}
            </p>
            <p className="text-sm text-white font-display leading-snug mt-0.5">
              {lastAdaptation.message}
            </p>
          </div>
          <button
            onClick={() => setVisible(false)}
            className="text-gray-500 hover:text-white mt-0.5 shrink-0 transition-colors"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
