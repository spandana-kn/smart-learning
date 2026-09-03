import { motion, AnimatePresence } from 'framer-motion'
import { FlaskConical, X } from 'lucide-react'
import { useDemoStore } from '@/stores/demoStore'

const PHASE_LABELS: Record<string, string> = {
  WARMUP:     '↑ Warming Up',
  FLOW:       '🔥 Flow State',
  DISTRACTED: '😴 Distracted',
  RECOVERY:   '⚡ Recovery',
  STRUGGLING: '⚠️ Struggling',
}

export default function DemoModeToggle() {
  const { isDemoMode, simPhase, enable, disable } = useDemoStore()

  return (
    <div className="flex items-center gap-2">
      <AnimatePresence>
        {isDemoMode && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-amber/10 border border-accent-amber/30"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-accent-amber animate-pulse shrink-0" />
            <span className="text-xs font-mono text-accent-amber whitespace-nowrap">
              DEMO · {PHASE_LABELS[simPhase] ?? simPhase}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={isDemoMode ? disable : enable}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all ${
          isDemoMode
            ? 'bg-accent-amber/20 border-accent-amber/50 text-accent-amber hover:bg-accent-amber/30'
            : 'bg-surface-elevated border-surface-border text-gray-400 hover:text-white hover:border-brand/40'
        }`}
        title={isDemoMode ? 'Disable demo mode' : 'Enable demo mode (simulates CV data)'}
      >
        {isDemoMode ? <X size={12} /> : <FlaskConical size={12} />}
        {isDemoMode ? 'Stop Demo' : 'Demo Mode'}
      </motion.button>
    </div>
  )
}
