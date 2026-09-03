import { motion, AnimatePresence } from 'framer-motion'
import { Star, Sparkles } from 'lucide-react'
import { useGamificationStore } from '@/stores/gamificationStore'

const RANK_TITLES: Record<number, string> = {
  1: 'Novice Scholar', 2: 'Apprentice', 3: 'Student Mage',
  4: 'Arcane Seeker', 5: 'Knowledge Knight', 6: 'Lore Keeper',
  7: 'Wisdom Warden', 8: 'Sage', 9: 'Grand Scholar', 10: 'Archmage',
}

export default function LevelUpModal() {
  const { pendingLevelUp, setPendingLevelUp } = useGamificationStore()

  return (
    <AnimatePresence>
      {pendingLevelUp !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setPendingLevelUp(null)}
        >
          <motion.div
            initial={{ scale: 0.5, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 16, stiffness: 200 }}
            onClick={(e) => e.stopPropagation()}
            className="card-elevated p-8 max-w-sm w-full mx-4 text-center border-glow-gold relative overflow-hidden"
          >
            {/* Glow background */}
            <div className="absolute inset-0 bg-gradient-to-b from-accent-gold/10 to-transparent pointer-events-none" />

            {/* Stars animation */}
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute"
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0],
                  x: Math.cos((i / 8) * Math.PI * 2) * 80,
                  y: Math.sin((i / 8) * Math.PI * 2) * 80,
                }}
                transition={{ delay: i * 0.1, duration: 1, repeat: 2 }}
                style={{ left: '50%', top: '30%' }}
              >
                <Star size={14} className="text-accent-gold" />
              </motion.div>
            ))}

            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-6xl mb-4"
            >
              🏆
            </motion.div>

            <p className="font-lore text-sm text-accent-gold mb-1 tracking-widest uppercase">
              Level Up!
            </p>
            <p className="font-display text-5xl font-bold text-white mb-2">
              {pendingLevelUp}
            </p>
            <p className="font-lore text-lg text-accent-gold mb-6">
              {RANK_TITLES[Math.min(pendingLevelUp, 10)] ?? 'Archmage'}
            </p>

            <p className="text-sm text-gray-400 font-mono mb-6">
              New quests and challenges unlocked!
            </p>

            <button
              onClick={() => setPendingLevelUp(null)}
              className="btn-primary w-full"
            >
              <Sparkles size={14} className="inline mr-2" />
              Continue Adventure
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
