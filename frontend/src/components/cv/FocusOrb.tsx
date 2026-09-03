import { motion } from 'framer-motion'
import { useCVStore } from '@/stores/cvStore'
import { useShallow } from 'zustand/react/shallow'
import clsx from 'clsx'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

function scoreColor(score: number) {
  if (score >= 75) return { ring: '#00F5A0', glow: 'rgba(0,245,160,0.4)', label: 'FOCUSED' }
  if (score >= 50) return { ring: '#6C63FF', glow: 'rgba(108,99,255,0.4)', label: 'ON-TASK' }
  if (score >= 30) return { ring: '#FF9F43', glow: 'rgba(255,159,67,0.4)', label: 'DRIFTING' }
  return { ring: '#FF4757', glow: 'rgba(255,71,87,0.4)', label: 'LOST' }
}

const SIZES = {
  sm: { outer: 'w-9 h-9', text: 'text-xs', strokeW: 3, r: 14, cx: 18 },
  md: { outer: 'w-16 h-16', text: 'text-sm', strokeW: 4, r: 24, cx: 30 },
  lg: { outer: 'w-28 h-28', text: 'text-xl', strokeW: 5, r: 42, cx: 54 },
}

export default function FocusOrb({ size = 'md', showLabel = false }: Props) {
  const { focusScore, isWebcamActive } = useCVStore(
    useShallow((s) => ({ focusScore: s.focusScore, isWebcamActive: s.isWebcamActive })),
  )
  const { ring, glow, label } = scoreColor(focusScore)
  const cfg = SIZES[size]

  const circumference = 2 * Math.PI * cfg.r
  const strokeDash = (focusScore / 100) * circumference

  return (
    <div className={clsx('relative flex items-center justify-center', cfg.outer)}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${cfg.cx * 2} ${cfg.cx * 2}`}
        className="-rotate-90"
      >
        {/* Track */}
        <circle
          cx={cfg.cx}
          cy={cfg.cx}
          r={cfg.r}
          fill="none"
          stroke="#2E2A47"
          strokeWidth={cfg.strokeW}
        />
        {/* Progress */}
        <motion.circle
          cx={cfg.cx}
          cy={cfg.cx}
          r={cfg.r}
          fill="none"
          stroke={ring}
          strokeWidth={cfg.strokeW}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: circumference - strokeDash }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${glow})` }}
        />
      </svg>

      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={clsx('font-mono font-bold leading-none', cfg.text)} style={{ color: ring }}>
          {isWebcamActive ? Math.round(focusScore) : '--'}
        </span>
        {size === 'lg' && (
          <span className="text-xs font-mono text-gray-400 mt-0.5">FOCUS</span>
        )}
      </div>

      {showLabel && (
        <p className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs font-mono whitespace-nowrap" style={{ color: ring }}>
          {isWebcamActive ? label : 'NO CAM'}
        </p>
      )}
    </div>
  )
}
