import { motion, AnimatePresence } from 'framer-motion'
import { Zap } from 'lucide-react'
import { useGamificationStore } from '@/stores/gamificationStore'

const COMBO_TIERS = [
  { min: 1,  label: 'COMBO',   color: '#6C63FF', mult: '×1.3' },
  { min: 3,  label: 'CHAIN',   color: '#00B4D8', mult: '×1.6' },
  { min: 5,  label: 'RAMPAGE', color: '#FF9F43', mult: '×2.0' },
  { min: 8,  label: 'GODLIKE', color: '#FF4757', mult: '×2.5' },
]

export default function ComboCounter() {
  const { combo } = useGamificationStore()
  if (combo < 2) return null

  const tier = [...COMBO_TIERS].reverse().find((t) => combo >= t.min) ?? COMBO_TIERS[0]

  return (
    <AnimatePresence>
      <motion.div
        key={combo}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.6, opacity: 0 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
        style={{
          borderColor: tier.color + '60',
          background: tier.color + '15',
          boxShadow: `0 0 12px ${tier.color}40`,
        }}
      >
        <Zap size={14} style={{ color: tier.color }} />
        <span className="font-display font-bold text-sm" style={{ color: tier.color }}>
          {combo}× {tier.label}
        </span>
        <span className="text-xs font-mono text-gray-400">{tier.mult}</span>
      </motion.div>
    </AnimatePresence>
  )
}
