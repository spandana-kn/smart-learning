import { create } from 'zustand'
import type { EmotionLabel, LearningState } from '@/types'

export interface BoundingBox { x: number; y: number; w: number; h: number }

interface CVStore {
  // Live CV state
  focusScore: number
  attention: number
  emotion: EmotionLabel
  emotionConfidence: number
  learningState: LearningState
  isWebcamActive: boolean
  isConnected: boolean
  lastUpdated: number | null

  // Vision overlay (bounding boxes)
  faceBox: BoundingBox | null
  eyeBoxes: BoundingBox[]
  rawScores: Record<string, number>

  // Adaptation
  lastAdaptation: { action: string; message: string } | null

  // Actions
  setFocusUpdate: (score: number, state: LearningState, attention: number) => void
  setEmotionUpdate: (emotion: EmotionLabel, confidence: number) => void
  setVisionUpdate: (faceBox: BoundingBox | null, eyeBoxes: BoundingBox[], emotion: EmotionLabel, confidence: number, rawScores: Record<string, number>) => void
  setAdaptation: (action: string, message: string) => void
  setWebcamActive: (active: boolean) => void
  setConnected: (connected: boolean) => void
  reset: () => void
}

const INITIAL: Omit<CVStore, keyof { setFocusUpdate: unknown; setEmotionUpdate: unknown; setVisionUpdate: unknown; setAdaptation: unknown; setWebcamActive: unknown; setConnected: unknown; reset: unknown }> = {
  focusScore: 0,
  attention: 0,
  emotion: 'FOCUSED',
  emotionConfidence: 0,
  learningState: 'PRODUCTIVE',
  isWebcamActive: false,
  isConnected: false,
  lastUpdated: null,
  faceBox: null,
  eyeBoxes: [],
  rawScores: {},
  lastAdaptation: null,
}

const EMOTION_COMMIT_INTERVAL_MS = 5_000
let lastEmotionCommittedAt = 0

function shouldCommitEmotion(current: EmotionLabel, next: EmotionLabel) {
  if (current === next) return true
  const now = Date.now()
  if (now - lastEmotionCommittedAt >= EMOTION_COMMIT_INTERVAL_MS) {
    lastEmotionCommittedAt = now
    return true
  }
  return false
}

export const useCVStore = create<CVStore>((set) => ({
  ...INITIAL,

  setFocusUpdate: (score, state, attention) =>
    set({ focusScore: score, learningState: state, attention, lastUpdated: Date.now() }),

  setEmotionUpdate: (emotion, confidence) =>
    set((state) =>
      shouldCommitEmotion(state.emotion, emotion)
        ? { emotion, emotionConfidence: confidence }
        : { emotionConfidence: confidence },
    ),

  setVisionUpdate: (faceBox, eyeBoxes, emotion, confidence, rawScores) =>
    set((state) =>
      shouldCommitEmotion(state.emotion, emotion)
        ? { faceBox, eyeBoxes, emotion, emotionConfidence: confidence, rawScores }
        : { faceBox, eyeBoxes, emotionConfidence: confidence, rawScores },
    ),

  setAdaptation: (action, message) =>
    set({ lastAdaptation: action ? { action, message } : null }),

  setWebcamActive: (isWebcamActive) => set({ isWebcamActive }),

  setConnected: (isConnected) => set({ isConnected }),

  reset: () => {
    lastEmotionCommittedAt = 0
    set({ ...INITIAL })
  },
}))
