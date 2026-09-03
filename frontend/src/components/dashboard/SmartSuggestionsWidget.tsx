/**
 * AI Suggestions panel — shows 1-3 contextual suggestions derived from the
 * current live focus/emotion state. Generates locally from cvStore so it
 * works in demo mode without hitting the backend.
 */
import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Swords, TrendingDown, Lightbulb, Coffee, Flame } from 'lucide-react'
import { useCVStore } from '@/stores/cvStore'
import { useShallow } from 'zustand/react/shallow'

interface Suggestion {
  icon: React.ReactNode
  text: string
  color: string
  action?: string
  actionPath?: string
}

function buildSuggestions(
  focusScore: number,
  emotion: string,
  learningState: string,
): Suggestion[] {
  const out: Suggestion[] = []

  if (learningState === 'FLOW' || focusScore >= 75) {
    out.push({
      icon: <Swords size={14} />,
      text: "You're in the zone — this is the perfect moment to challenge a boss!",
      color: '#00F5A0',
      action: 'Fight Boss',
      actionPath: '/boss',
    })
  }

  if (focusScore < 35 || learningState === 'FATIGUED') {
    out.push({
      icon: <Coffee size={14} />,
      text: 'Focus is very low. A 5-minute break will restore your performance.',
      color: '#FF4757',
    })
  } else if (focusScore < 50 || learningState === 'STRUGGLING') {
    out.push({
      icon: <TrendingDown size={14} />,
      text: 'Try an easier quest to rebuild your momentum before levelling up.',
      color: '#FF9F43',
      action: 'Easy Quests',
      actionPath: '/quests',
    })
  }

  if (emotion === 'SLEEPY') {
    out.push({
      icon: <Coffee size={14} />,
      text: 'Your eyes look closed — take a short reset before the next topic.',
      color: '#FF9F43',
    })
  }

  if (emotion === 'BORED' && focusScore > 60) {
    out.push({
      icon: <Flame size={14} />,
      text: 'You look bored — switch to a harder quest or enter boss battle mode.',
      color: '#FF9F43',
      action: 'Boss Battle',
      actionPath: '/boss',
    })
  }

  if (out.length === 0) {
    out.push({
      icon: <Brain size={14} />,
      text: focusScore > 0
        ? 'Learning is steady. Keep your current pace — consistency is key.'
        : 'Enable webcam or Demo Mode to get personalised suggestions.',
      color: '#8B85FF',
    })
  }

  return out.slice(0, 3)
}

export default function SmartSuggestionsWidget() {
  const { focusScore, emotion, learningState } = useCVStore(
    useShallow((s) => ({ focusScore: s.focusScore, emotion: s.emotion, learningState: s.learningState })),
  )
  const suggestions = useMemo(
    () => buildSuggestions(focusScore, emotion, learningState),
    [focusScore, emotion, learningState],
  )

  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Brain size={14} className="text-brand" />
        <p className="stat-label">AI Suggestions</p>
      </div>

      <AnimatePresence mode="popLayout">
        {suggestions.map((s, i) => (
          <motion.div
            key={s.text}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-start gap-2.5 p-3 rounded-xl border"
            style={{ background: s.color + '08', borderColor: s.color + '30' }}
          >
            <span className="shrink-0 mt-0.5" style={{ color: s.color }}>{s.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 font-display leading-snug">{s.text}</p>
              {s.action && s.actionPath && (
                <a
                  href={s.actionPath}
                  className="text-xs font-mono mt-1.5 inline-flex items-center gap-1 hover:underline"
                  style={{ color: s.color }}
                >
                  → {s.action}
                </a>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
