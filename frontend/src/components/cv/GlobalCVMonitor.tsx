import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useCVStore } from '@/stores/cvStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { getSharedCameraStream } from '@/lib/cameraStream'

export default function GlobalCVMonitor() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const workerBusyRef = useRef(false) // mirrors the backend's is_processing drop strategy, but on the capture side
  const user = useAuthStore((s) => s.user)
  const { send, sendBinary } = useWebSocket()
  const setWebcamActive = useCVStore((s) => s.setWebcamActive)

  useEffect(() => {
    if (user?.role !== 'student') return
    let cancelled = false

    const worker = new Worker(new URL('../../workers/cvFrameWorker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<{ buffer?: ArrayBuffer; error?: string }>) => {
      workerBusyRef.current = false
      if (event.data.buffer) sendBinary(event.data.buffer)
    }

    const start = async () => {
      try {
        const stream = await getSharedCameraStream()
        if (cancelled) return
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setWebcamActive(true)
        intervalRef.current = setInterval(async () => {
          if (document.visibilityState !== 'visible') return
          // Frontend-side back-pressure: if the worker hasn't finished
          // encoding the previous frame, skip this tick rather than piling
          // up postMessage calls (mirrors the backend's drop-if-busy rule).
          if (workerBusyRef.current) return
          const video = videoRef.current
          if (!video || video.readyState < 2) return

          workerBusyRef.current = true
          try {
            const bitmap = await createImageBitmap(video)
            worker.postMessage({ bitmap }, [bitmap])
          } catch {
            workerBusyRef.current = false
          }
        }, 650)
      } catch {
        setWebcamActive(false)
      }
    }

    start()
    return () => {
      cancelled = true
      if (intervalRef.current) clearInterval(intervalRef.current)
      worker.terminate()
      workerRef.current = null
    }
  }, [send, sendBinary, setWebcamActive, user?.role])

  if (user?.role !== 'student') return null
  return (
    <div className="hidden">
      <video ref={videoRef} muted playsInline />
    </div>
  )
}
