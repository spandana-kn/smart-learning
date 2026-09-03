import { useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useCVStore } from '@/stores/cvStore'
import { useGamificationStore } from '@/stores/gamificationStore'
import { useShallow } from 'zustand/react/shallow'
import type { WSEvent } from '@/types'

let sessionId: string | null = null
let sharedWs: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let activeToken: string | null = null

export function getSessionId() {
  if (!sessionId) sessionId = crypto.randomUUID()
  return sessionId
}

function getWsUrl(token: string) {
  const sid = getSessionId()
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host || 'localhost:5173'
  return `${protocol}//${host}/ws/cv-stream?session_id=${sid}&token=${encodeURIComponent(token)}`
}

export function useWebSocket() {
  const token = useAuthStore((s) => s.accessToken)
  // Pulling only stable action references (never the live state) so this
  // hook — used from AppShell, which wraps the whole app — never re-renders
  // its callers on every FOCUS_UPDATE/VISION_UPDATE tick.
  const { setFocusUpdate, setEmotionUpdate, setVisionUpdate, setAdaptation, setConnected } = useCVStore(
    useShallow((s) => ({
      setFocusUpdate: s.setFocusUpdate,
      setEmotionUpdate: s.setEmotionUpdate,
      setVisionUpdate: s.setVisionUpdate,
      setAdaptation: s.setAdaptation,
      setConnected: s.setConnected,
    })),
  )
  const { addXP, setPendingLevelUp, addPendingBadge } = useGamificationStore(
    useShallow((s) => ({
      addXP: s.addXP,
      setPendingLevelUp: s.setPendingLevelUp,
      addPendingBadge: s.addPendingBadge,
    })),
  )

  const connect = useCallback(() => {
    if (!token) return
    if (
      sharedWs &&
      activeToken === token &&
      (sharedWs.readyState === WebSocket.OPEN || sharedWs.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    sharedWs?.close()
    activeToken = token
    const url = getWsUrl(token)
    const ws = new WebSocket(url)

    ws.onopen = () => setConnected(true)
    ws.onclose = () => {
      setConnected(false)
      if (sharedWs === ws && activeToken === token) {
        reconnectTimer = setTimeout(connect, 3000)
      }
    }

    ws.onmessage = (event) => {
      try {
        const msg: WSEvent = JSON.parse(event.data)
        switch (msg.type) {
          case 'FOCUS_UPDATE':
            setFocusUpdate(msg.payload.score, msg.payload.state, msg.payload.attention)
            break
          case 'EMOTION_UPDATE':
            setEmotionUpdate(msg.payload.emotion, msg.payload.confidence)
            break
          case 'VISION_UPDATE':
            setVisionUpdate(
              msg.payload.face_box,
              msg.payload.eye_boxes ?? [],
              msg.payload.emotion,
              msg.payload.confidence,
              msg.payload.raw_scores ?? {},
            )
            break
          case 'ADAPTATION_EVENT':
            setAdaptation(msg.payload.action, msg.payload.message)
            break
          case 'XP_GRANT':
            addXP(msg.payload.amount)
            break
          case 'LEVEL_UP':
            setPendingLevelUp(msg.payload.new_level)
            break
          case 'BADGE_EARNED':
            addPendingBadge(msg.payload)
            break
        }
      } catch {
        // Ignore malformed messages
      }
    }

    sharedWs = ws
  }, [token, setFocusUpdate, setEmotionUpdate, setVisionUpdate, setAdaptation, setConnected, addXP, setPendingLevelUp, addPendingBadge])

  const send = useCallback((data: unknown) => {
    if (sharedWs?.readyState === WebSocket.OPEN) {
      sharedWs.send(JSON.stringify(data))
    }
  }, [])

  // CV frames go over the wire as raw bytes (no JSON/base64 envelope) —
  // smaller payload, and the backend reads them straight into cv2.imdecode.
  const sendBinary = useCallback((data: ArrayBuffer) => {
    if (sharedWs?.readyState === WebSocket.OPEN) {
      sharedWs.send(data)
    }
  }, [])

  const disconnect = useCallback(() => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    activeToken = null
    sharedWs?.close()
    sharedWs = null
    setConnected(false)
  }, [setConnected])

  return { connect, send, sendBinary, disconnect }
}
