import { motion, AnimatePresence } from 'framer-motion'
import { Flame, Bell, Wifi, WifiOff, Moon, Sun } from 'lucide-react'
import { useCVStore } from '@/stores/cvStore'
import { useShallow } from 'zustand/react/shallow'
import { useGamificationStore } from '@/stores/gamificationStore'
import FocusOrb from '@/components/cv/FocusOrb'
import EmotionBadge from '@/components/cv/EmotionBadge'
import DemoModeToggle from '@/components/ui/DemoModeToggle'
import { useThemeStore } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'

export default function TopBar() {
  const streakDays = useGamificationStore((s) => s.streakDays)
  const { isConnected, lastAdaptation } = useCVStore(
    useShallow((s) => ({ isConnected: s.isConnected, lastAdaptation: s.lastAdaptation })),
  )
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const user = useAuthStore((s) => s.user)
  const isTeacher = user?.role === 'teacher'

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-surface-card border-b border-surface-border shrink-0">
      {/* Left: Adaptation banner */}
      <div className="flex-1">
        <AnimatePresence>
          {lastAdaptation && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/20 border border-brand/30 text-xs font-mono text-brand"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              {lastAdaptation.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: Focus + Emotion + Streak + WS status */}
      <div className="flex items-center gap-4">
        {!isTeacher && <DemoModeToggle />}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-full bg-surface-elevated border border-surface-border flex items-center justify-center hover:border-brand transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={14} className="text-accent-gold" /> : <Moon size={14} className="text-brand" />}
        </button>
        {/* WebSocket status */}
        {!isTeacher && <div className="flex items-center gap-1.5">
          {isConnected
            ? <Wifi size={14} className="text-accent-emerald" />
            : <WifiOff size={14} className="text-gray-500" />
          }
          <span className={`text-xs font-mono ${isConnected ? 'text-accent-emerald' : 'text-gray-500'}`}>
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>}

        {/* Streak */}
        {!isTeacher && <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-elevated border border-surface-border">
          <Flame size={14} className="text-accent-amber" />
          <span className="text-xs font-mono text-accent-amber font-medium">{streakDays}d</span>
        </div>}

        {/* Emotion Badge */}
        {!isTeacher && <EmotionBadge />}

        {/* Focus Orb */}
        {!isTeacher && <FocusOrb size="sm" />}

        {/* Notifications */}
        <button className="w-8 h-8 rounded-full bg-surface-elevated border border-surface-border flex items-center justify-center hover:border-brand transition-colors relative">
          <Bell size={14} className="text-gray-400" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-accent-crimson rounded-full" />
        </button>
      </div>
    </header>
  )
}
