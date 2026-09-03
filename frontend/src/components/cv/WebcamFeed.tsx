import { useEffect, useRef, useState, useCallback } from 'react'
import { CameraOff } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCVStore } from '@/stores/cvStore'
import { useShallow } from 'zustand/react/shallow'
import { getSharedCameraStream } from '@/lib/cameraStream'

interface Props {
  compact?: boolean
}

const EMOTION_COLOR: Record<string, string> = {
  FOCUSED:    '#00F5A0',
  BORED:      '#A29BFE',
  SLEEPY:     '#FF9F43',
}

export default function WebcamFeed({ compact = false }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const overlayRef  = useRef<HTMLCanvasElement>(null)   // visible — bounding boxes
  const animRef     = useRef<number>(0)

  const [error, setError] = useState<string | null>(null)
  const { setWebcamActive, faceBox, eyeBoxes, emotion, emotionConfidence } = useCVStore(
    useShallow((s) => ({
      setWebcamActive: s.setWebcamActive,
      faceBox: s.faceBox,
      eyeBoxes: s.eyeBoxes,
      emotion: s.emotion,
      emotionConfidence: s.emotionConfidence,
    })),
  )

  // ── Overlay drawing (requestAnimationFrame loop) ──────────────────────────
  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current
    if (!canvas) { animRef.current = requestAnimationFrame(drawOverlay); return }

    const W = canvas.offsetWidth
    const H = canvas.offsetHeight
    if (W === 0 || H === 0) { animRef.current = requestAnimationFrame(drawOverlay); return }

    // Keep canvas buffer in sync with CSS size
    if (canvas.width !== W)  canvas.width  = W
    if (canvas.height !== H) canvas.height = H

    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, W, H)

    // ── No face: draw subtle red pulse border ──────────────────────────────
    if (!faceBox) {
      ctx.strokeStyle = 'rgba(255,71,87,0.25)'
      ctx.lineWidth   = 1.5
      ctx.strokeRect(1, 1, W - 2, H - 2)
      animRef.current = requestAnimationFrame(drawOverlay)
      return
    }

    const color = EMOTION_COLOR[emotion] ?? '#6C63FF'

    // Canvas has the same CSS scale-x-[-1] as the video.
    // OpenCV coords are in raw (unflipped) frame space.
    // Draw at raw normalised coords — CSS flip handles the visual mirror.
    const toX = (xn: number) => xn * W
    const toY = (yn: number) => yn * H
    const toW = (wn: number) => wn * W
    const toH = (hn: number) => hn * H

    const fx = toX(faceBox.x)
    const fy = toY(faceBox.y)
    const fw = toW(faceBox.w)
    const fh = toH(faceBox.h)

    // ── Face glow ──────────────────────────────────────────────────────────
    ctx.shadowColor = color
    ctx.shadowBlur  = 14
    ctx.strokeStyle = color
    ctx.lineWidth   = 2
    ctx.strokeRect(fx, fy, fw, fh)
    ctx.shadowBlur  = 0

    // Corner bracket decoration
    const cs = Math.min(fw, fh) * 0.15
    ctx.lineWidth   = 2.5
    ctx.strokeStyle = color
    ;([
      [fx,      fy,      cs,  0 ],
      [fx,      fy,      0,   cs],
      [fx+fw,   fy,      -cs, 0 ],
      [fx+fw,   fy,      0,   cs],
      [fx,      fy+fh,   cs,  0 ],
      [fx,      fy+fh,   0,   -cs],
      [fx+fw,   fy+fh,   -cs, 0 ],
      [fx+fw,   fy+fh,   0,   -cs],
    ] as [number, number, number, number][]).forEach(([x0, y0, dx, dy]) => {
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0+dx, y0+dy); ctx.stroke()
    })

    // ── Emotion label pill ─────────────────────────────────────────────────
    const pct   = Math.round(emotionConfidence * 100)
    const label = `${emotion}  ${pct}%`
    ctx.font = 'bold 11px "SF Mono", ui-monospace, monospace'
    const tw  = ctx.measureText(label).width
    const pad = 6
    const ph  = 20
    const px  = fx
    const py  = Math.max(0, fy - ph - 4)

    ctx.fillStyle = color + 'DD'
    ctx.beginPath()
    ;(ctx as any).roundRect?.(px, py, tw + pad * 2, ph, 4) ??
      ctx.rect(px, py, tw + pad * 2, ph)
    ctx.fill()

    ctx.fillStyle    = '#0D0B1A'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, px + pad, py + ph / 2)

    // ── Eye boxes ──────────────────────────────────────────────────────────
    eyeBoxes.forEach((eb) => {
      const ex = toX(eb.x)
      const ey = toY(eb.y)
      const ew = toW(eb.w)
      const eh = toH(eb.h)

      ctx.shadowColor = '#00D4FF'
      ctx.shadowBlur  = 8
      ctx.strokeStyle = '#00D4FF'
      ctx.lineWidth   = 1.5
      ctx.strokeRect(ex, ey, ew, eh)
      ctx.shadowBlur  = 0

      ctx.font      = 'bold 8px monospace'
      ctx.fillStyle = '#00D4FF'
      ctx.textBaseline = 'bottom'
      ctx.fillText('EYE', ex + 2, ey - 1)
    })

    animRef.current = requestAnimationFrame(drawOverlay)
  }, [faceBox, eyeBoxes, emotion, emotionConfidence])

  useEffect(() => {
    animRef.current = requestAnimationFrame(drawOverlay)
    return () => cancelAnimationFrame(animRef.current)
  }, [drawOverlay])

  // ── Camera ────────────────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const shared = await getSharedCameraStream()
      if (videoRef.current) {
        videoRef.current.srcObject = shared
        await videoRef.current.play()
      }
      setWebcamActive(true)
      setError(null)
    } catch {
      setError('Camera access denied.')
      setWebcamActive(false)
    }
  }

  const stopCamera = () => {
    // The hidden global monitor owns the shared camera lifecycle.
    // This visible feed is only a viewer, so unmounting it should not mark CV inactive.
  }

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])

  const h = compact ? 'h-32' : 'h-56'

  return (
    <div className={`relative rounded-xl overflow-hidden bg-surface-elevated border border-surface-border ${h}`}>

      {/* Mirrored live video */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
        muted
        playsInline
      />

      {/* Overlay canvas — same CSS mirror as video so OpenCV coords map correctly */}
      <canvas
        ref={overlayRef}
        className="absolute inset-0 w-full h-full scale-x-[-1] pointer-events-none"
        style={{ zIndex: 2 }}
      />

      {/* Scanline effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background:
            'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(108,99,255,0.03) 2px,rgba(108,99,255,0.03) 4px)',
        }}
      />

      {/* LIVE badge */}
      {!error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 border border-surface-border"
          style={{ zIndex: 3 }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
          <span className="text-xs font-mono text-accent-emerald">LIVE</span>
        </motion.div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-card/90 gap-2 p-3" style={{ zIndex: 4 }}>
          <CameraOff size={24} className="text-gray-500" />
          <p className="text-xs text-gray-400 text-center">{error}</p>
          <button onClick={startCamera} className="btn-secondary text-xs px-3 py-1.5">Retry</button>
        </div>
      )}
    </div>
  )
}
