/**
 * Demo Mode — drives fake focus/emotion data so the app is fully functional
 * during a presentation without a real webcam or CV backend.
 *
 * Simulation state machine (cycles every ~30 s):
 *   WARMUP → FLOW → DISTRACTED → RECOVERY → STRUGGLING → FLOW …
 */
import { create } from 'zustand'
import { useCVStore } from './cvStore'
import { useGamificationStore } from './gamificationStore'

type SimPhase = 'WARMUP' | 'FLOW' | 'DISTRACTED' | 'RECOVERY' | 'STRUGGLING'

const PHASE_SEQUENCE: SimPhase[] = ['WARMUP', 'FLOW', 'DISTRACTED', 'RECOVERY', 'STRUGGLING']

interface DemoStore {
  isDemoMode: boolean
  simPhase: SimPhase
  tick: number
  enable: () => void
  disable: () => void
}

// Phase definitions: [targetFocus, emotion, duration ticks]
const PHASE_CONFIG: Record<SimPhase, { focus: number; emotion: string; ticks: number }> = {
  WARMUP:     { focus: 45,  emotion: 'BORED',      ticks: 6  },
  FLOW:       { focus: 82,  emotion: 'FOCUSED',    ticks: 12 },
  DISTRACTED: { focus: 38,  emotion: 'BORED',      ticks: 8  },
  RECOVERY:   { focus: 60,  emotion: 'FOCUSED',    ticks: 6  },
  STRUGGLING: { focus: 28,  emotion: 'SLEEPY',     ticks: 6  },
}

let _intervalId: ReturnType<typeof setInterval> | null = null
let _phaseIdx = 0
let _phaseTick = 0
let _ema = 50  // exponential moving average for smooth transitions

function _tick() {
  const phase = PHASE_SEQUENCE[_phaseIdx % PHASE_SEQUENCE.length]
  const cfg   = PHASE_CONFIG[phase]

  // Smooth EMA toward target + small noise
  const noise = (Math.random() - 0.5) * 6
  _ema = 0.25 * (cfg.focus + noise) + 0.75 * _ema
  const score = Math.round(Math.min(100, Math.max(0, _ema)))

  // Derive learning state from score
  const state =
    score >= 75 ? 'FLOW' :
    score >= 55 ? 'PRODUCTIVE' :
    score >= 35 ? 'STRUGGLING' :
    'FATIGUED'

  // Push to CV store
  useCVStore.getState().setFocusUpdate(score, state as any, score / 100)

  // Emit emotion every 3 ticks
  if (_phaseTick % 3 === 0) {
    useCVStore.getState().setEmotionUpdate(cfg.emotion as any, 0.82)
  }

  _phaseTick++
  if (_phaseTick >= cfg.ticks) {
    _phaseTick = 0
    _phaseIdx++
    useDemoStore.setState({ simPhase: PHASE_SEQUENCE[_phaseIdx % PHASE_SEQUENCE.length] })
  }

  if (score >= 75) {
    import('@/services/badgeService').then(({ tryAwardFlowBadge }) => tryAwardFlowBadge(score))
  }

  useDemoStore.setState((s) => ({ tick: s.tick + 1 }))
}

export const useDemoStore = create<DemoStore>((set) => ({
  isDemoMode: false,
  simPhase:   'WARMUP',
  tick:       0,

  enable: () => {
    if (_intervalId) return
    _phaseIdx  = 0
    _phaseTick = 0
    _ema       = 50
    useCVStore.getState().setWebcamActive(true)
    useCVStore.getState().setConnected(true)
    _intervalId = setInterval(_tick, 1500)  // tick every 1.5 s
    set({ isDemoMode: true, simPhase: 'WARMUP', tick: 0 })
    // Award demo badge (lazy import avoids circular dep)
    import('@/services/badgeService').then(({ tryAwardBadge }) => tryAwardBadge('demo_master'))
  },

  disable: () => {
    if (_intervalId) { clearInterval(_intervalId); _intervalId = null }
    useCVStore.getState().setWebcamActive(false)
    useCVStore.getState().setConnected(false)
    useCVStore.getState().reset()
    set({ isDemoMode: false, simPhase: 'WARMUP', tick: 0 })
  },
}))
