import { useState, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Skull, Heart, Zap, Shield, Swords, Star, Lightbulb } from 'lucide-react'
import api from '@/services/api'
import { useCVStore } from '@/stores/cvStore'
import { useShallow } from 'zustand/react/shallow'
import { useGamificationStore } from '@/stores/gamificationStore'
import { tryAwardBadge } from '@/services/badgeService'
import ComboCounter from '@/components/gamification/ComboCounter'
import FocusOrb from '@/components/cv/FocusOrb'
import type { BossData, Question } from '@/types'
import clsx from 'clsx'

interface BossSummary {
  id: string; name: string; subject: string; lore_text: string
  hp_total: number; unlock_level: number; sprite_id: string
}

interface BattleState {
  battle_id: string; boss_hp: number; player_hp: number
  phase: number; combo: number; current_question: Question
}

interface AttackResult {
  correct: boolean; damage_dealt: number; boss_hp_remaining: number
  player_damage_taken: number; player_hp_remaining: number
  combo: number; phase_changed: boolean; new_phase: number
  is_crit: boolean; battle_over: boolean; outcome?: 'win' | 'lose'
  next_question: Question | null
  attack_label?: string; hint_suggestion?: string
  adaptation_action?: string; level_up?: boolean
}

const PHASE_COLORS = ['#6C63FF', '#FF9F43', '#FF4757']
const BOSS_EMOJIS: Record<string, string> = {
  algebra_golem: '🗿', derivative_dragon: '🐉',
  grammar_ghost: '👻', history_hydra: '🐍',
  python_sprite: '🐍', python_guardian: '🛡️', python_overlord: '👑',
  default: '💀'
}

// ─── HP Bar ───────────────────────────────────────────────────────────────────
function HPBar({ current, max, color, label }: { current: number; max: number; color: string; label: string }) {
  const pct = Math.max(0, (current / max) * 100)
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs font-mono text-gray-400 flex items-center gap-1">
          <Heart size={10} style={{ color }} /> {label}
        </span>
        <span className="text-xs font-mono" style={{ color }}>{current} / {max}</span>
      </div>
      <div className="progress-bar-track h-3">
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
          style={{ background: color, boxShadow: `0 0 8px ${color}60` }}
        />
      </div>
    </div>
  )
}

// ─── Damage Number popup ───────────────────────────────────────────────────────
function DamageNumber({ dmg, isCrit }: { dmg: number; isCrit: boolean }) {
  return (
    <motion.div
      initial={{ y: 0, opacity: 1, scale: 1 }}
      animate={{ y: -70, opacity: 0, scale: isCrit ? 2 : 1.3 }}
      transition={{ duration: 0.8 }}
      className={clsx(
        'absolute top-1/3 left-1/2 -translate-x-1/2 font-display font-black pointer-events-none z-10',
        isCrit ? 'text-accent-gold text-4xl' : 'text-accent-emerald text-2xl'
      )}
    >
      {isCrit ? '⚡ CRIT! ' : ''}−{dmg}
    </motion.div>
  )
}

export default function BossBattlePage() {
  const { data: bosses = [], isLoading } = useQuery<BossSummary[]>({
    queryKey: ['boss', 'available'],
    queryFn: () => api.get('/boss/available').then((r) => r.data),
  })

  const [battle, setBattle] = useState<BattleState | null>(null)
  const [selectedBoss, setSelectedBoss] = useState<BossSummary | null>(null)
  const [lastDamage, setLastDamage] = useState<{ dmg: number; isCrit: boolean } | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<'win' | 'lose' | null>(null)

  const { focusScore, emotion, setAdaptation } = useCVStore(
    useShallow((s) => ({ focusScore: s.focusScore, emotion: s.emotion, setAdaptation: s.setAdaptation })),
  )
  const { setCombo, breakCombo, addXP, setPendingLevelUp } = useGamificationStore()
  const [attackLabel, setAttackLabel] = useState<string | null>(null)
  const [phaseFlash, setPhaseFlash] = useState(false)
  const [hintText, setHintText] = useState<string | null>(null)
  const [correctStreak, setCorrectStreak] = useState(0)
  const [wrongStreak, setWrongStreak] = useState(0)
  const attackTimeRef = useRef(Date.now())

  const startMutation = useMutation({
    mutationFn: (bossId: string) => api.post<BattleState>(`/boss/${bossId}/start`).then((r) => r.data),
    onSuccess: (data) => {
      setBattle(data)
      setSelectedAnswer(null)
      setAttackLabel(null)
      setHintText(null)
      setCorrectStreak(0)
      setWrongStreak(0)
      attackTimeRef.current = Date.now()
    },
  })

  const attackMutation = useMutation({
    mutationFn: (answer: string) =>
      api.post<AttackResult>(`/boss/${selectedBoss!.id}/attack`, {
        battle_id:      battle!.battle_id,
        question_id:    battle!.current_question.id,
        answer,
        time_taken_ms:  Date.now() - attackTimeRef.current,
        focus_score:    focusScore,
        emotion:        emotion,
        correct_streak: correctStreak,
        wrong_streak:   wrongStreak,
      }).then((r) => r.data),
    onSuccess: (res) => {
      // Show attack label
      setAttackLabel((res as any).attack_label ?? (res.correct ? '⚔️ Strike!' : '💨 Weak Attack…'))
      setTimeout(() => setAttackLabel(null), 1400)

      setLastDamage({ dmg: res.damage_dealt, isCrit: res.is_crit })
      setTimeout(() => setLastDamage(null), 900)

      if (res.correct) {
        setCombo(res.combo)
        setCorrectStreak((s) => s + 1)
        setWrongStreak(0)
      } else {
        breakCombo()
        setWrongStreak((s) => s + 1)
        setCorrectStreak(0)
      }

      // Phase change flash
      if (res.phase_changed) {
        setPhaseFlash(true)
        setTimeout(() => setPhaseFlash(false), 600)
      }

      // Adaptive hint suggestion
      if ((res as any).hint_suggestion) {
        setHintText((res as any).hint_suggestion)
      }

      // Adaptation notification
      if ((res as any).adaptation_action) {
        setAdaptation((res as any).adaptation_action, '')
      }

      if (res.battle_over) {
        setOutcome(res.outcome ?? 'lose')
        if (res.outcome === 'win') {
          addXP(500)
          tryAwardBadge('boss_slayer')
          if (res.level_up) setPendingLevelUp(0)
        }
        return
      }

      setTimeout(() => {
        setBattle((b) => b ? {
          ...b,
          boss_hp: res.boss_hp_remaining,
          player_hp: res.player_hp_remaining,
          combo: res.combo,
          current_question: res.next_question ?? b.current_question,
        } : null)
        setSelectedAnswer(null)
        setHintText(null)
        attackTimeRef.current = Date.now()
      }, 1100)
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Battle outcome screen ─────────────────────────────────────────────────
  if (outcome) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-[70vh] gap-6"
      >
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12 }}
          className="text-8xl"
        >
          {outcome === 'win' ? '🏆' : '💀'}
        </motion.div>
        <h2 className="font-lore text-4xl" style={{ color: outcome === 'win' ? '#FFD700' : '#FF4757' }}>
          {outcome === 'win' ? 'Victory!' : 'Defeated!'}
        </h2>
        {outcome === 'win' && (
          <p className="font-mono text-accent-gold text-lg">+500 XP · Loot Acquired!</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => { setOutcome(null); setBattle(null); setSelectedBoss(null) }}
            className="btn-primary"
          >
            Return to Realm
          </button>
          {selectedBoss && (
            <button
              onClick={() => { setOutcome(null); startMutation.mutate(selectedBoss.id) }}
              className="btn-secondary"
            >
              Rematch
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  // ── Active battle arena ───────────────────────────────────────────────────
  if (battle && selectedBoss) {
    const q = battle.current_question
    const phase = battle.phase - 1
    const phaseColor = PHASE_COLORS[phase] ?? PHASE_COLORS[0]

    return (
      <div className="space-y-5 max-w-4xl">
        {/* Battle header */}
        <div className="flex items-center justify-between">
          <h1 className="font-lore text-2xl text-accent-crimson">⚔️ Battle Arena</h1>
          <div className="flex items-center gap-3">
            <motion.span
              key={battle.phase}
              initial={{ scale: 1.4, color: '#fff' }}
              animate={{ scale: 1 }}
              className="text-xs font-mono px-2 py-1 rounded-full border"
              style={{ color: phaseColor, borderColor: phaseColor + '60', background: phaseColor + '15' }}
            >
              Phase {battle.phase}
            </motion.span>
            <FocusOrb size="sm" />
            <ComboCounter />
          </div>
        </div>

        {/* Combat arena */}
        <motion.div
          animate={phaseFlash ? { backgroundColor: ['#1A1828', phaseColor + '22', '#1A1828'] } : {}}
          transition={{ duration: 0.5 }}
          className="card p-6 relative"
          style={{ borderColor: phaseColor + '40' }}
        >
          {/* Damage + attack label popups */}
          <AnimatePresence>
            {lastDamage && <DamageNumber dmg={lastDamage.dmg} isCrit={lastDamage.isCrit} />}
          </AnimatePresence>
          <AnimatePresence>
            {attackLabel && (
              <motion.div
                key={attackLabel}
                initial={{ opacity: 0, scale: 0.7, y: 0 }}
                animate={{ opacity: 1, scale: 1, y: -10 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.5 }}
                className="absolute top-2 left-1/2 -translate-x-1/2 z-20 font-lore text-lg pointer-events-none text-center whitespace-nowrap px-3 py-1 rounded-full"
                style={{
                  color: attackLabel.includes('CRIT') ? '#FFD700' : attackLabel.includes('Weak') ? '#6C757D' : '#00F5A0',
                  background: 'rgba(0,0,0,0.5)',
                  border: `1px solid ${attackLabel.includes('CRIT') ? '#FFD70050' : '#ffffff10'}`,
                }}
              >
                {attackLabel}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Boss + Player HPs */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <motion.span
                  animate={lastDamage ? { scale: [1, 1.3, 0.9, 1], rotate: [0, -8, 5, 0] } : {}}
                  transition={{ duration: 0.4 }}
                  className="text-3xl"
                >
                  {BOSS_EMOJIS[selectedBoss.sprite_id] ?? BOSS_EMOJIS.default}
                </motion.span>
                <div>
                  <p className="font-lore text-sm text-accent-crimson">{selectedBoss.name}</p>
                  <p className="text-xs font-mono text-gray-500">{selectedBoss.subject}</p>
                </div>
              </div>
              <HPBar current={battle.boss_hp} max={selectedBoss.hp_total} color="#FF4757" label="Boss HP" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl">🧙</span>
                <div>
                  <p className="font-display text-sm text-white">You</p>
                  <p className="text-xs font-mono text-gray-500">
                    Focus: <span style={{ color: focusScore >= 70 ? '#00F5A0' : focusScore >= 40 ? '#FFD700' : '#FF4757' }}>
                      {Math.round(focusScore)}%
                    </span>
                    {focusScore >= 70 && ' ⚡'}
                  </p>
                </div>
              </div>
              <HPBar current={battle.player_hp} max={100} color="#00F5A0" label="Your HP" />
            </div>
          </div>

          {/* Hint suggestion from adaptive engine */}
          <AnimatePresence>
            {hintText && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-accent-gold/10 border border-accent-gold/30"
              >
                <Lightbulb size={14} className="text-accent-gold shrink-0 mt-0.5" />
                <p className="text-xs font-mono text-accent-gold">{hintText}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Question */}
          <div className="p-4 rounded-xl bg-surface-elevated border mb-4"
            style={{ borderColor: phaseColor + '40' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{ background: phaseColor + '20', color: phaseColor }}>
                {q.difficulty.toUpperCase()}
              </span>
              <span className="text-xs font-mono text-gray-500">{q.bloom_level}</span>
            </div>
            <p className="font-display text-base text-white">{q.question_text}</p>
          </div>

          {/* MCQ options */}
          {q.options && (
            <div className="grid grid-cols-2 gap-2">
              {q.options.map((opt) => (
                <motion.button
                  key={opt.label}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={!!selectedAnswer || attackMutation.isPending}
                  onClick={() => { setSelectedAnswer(opt.label); attackMutation.mutate(opt.label) }}
                  className={clsx(
                    'px-4 py-3 rounded-xl border text-sm font-display text-left transition-all',
                    selectedAnswer === opt.label
                      ? 'border-brand bg-brand/20 text-white shadow-glow'
                      : 'border-surface-border bg-surface-elevated text-gray-300 hover:border-brand/40 hover:bg-brand/5'
                  )}
                >
                  <span className="text-gray-500 mr-2 font-mono text-xs">{opt.label}.</span>
                  {opt.text}
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Flee button */}
        <button
          onClick={() => { setBattle(null); setSelectedBoss(null) }}
          className="text-xs font-mono text-gray-500 hover:text-accent-crimson transition-colors flex items-center gap-1"
        >
          🏃 Flee battle
        </button>
      </div>
    )
  }

  // ── Boss select screen ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <p className="stat-label">Challenge Mode</p>
        <h1 className="page-title mt-0.5">💀 Boss Battle</h1>
        <p className="text-sm text-gray-400 font-mono mt-1">
          Defeat the guardians of knowledge. High focus = massive damage.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bosses.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-surface-border bg-surface-card/60 p-8 text-center">
            <Skull size={28} className="mx-auto text-gray-500 mb-3" />
            <p className="font-display font-semibold text-white">No boss unlocked yet</p>
            <p className="text-sm font-mono text-gray-500 mt-1">
              Master medium or hard Python concepts in the Skill Tree to reveal milestone bosses.
            </p>
          </div>
        )}
        {bosses.map((boss) => (
          <motion.div
            key={boss.id}
            whileHover={{ y: -4, boxShadow: '0 12px 30px rgba(255,71,87,0.2)' }}
            className="card p-5 cursor-pointer border-surface-border hover:border-accent-crimson/40 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-4xl">{BOSS_EMOJIS[boss.sprite_id] ?? BOSS_EMOJIS.default}</span>
              <span className="text-xs font-mono text-gray-400 px-2 py-0.5 rounded-full bg-surface-elevated border border-surface-border">
                LVL {boss.unlock_level}+
              </span>
            </div>
            <h3 className="font-lore text-base text-accent-crimson mb-1">{boss.name}</h3>
            <p className="text-xs text-gray-400 font-mono mb-3">{boss.subject}</p>
            <p className="text-xs text-gray-500 italic mb-4 line-clamp-2">"{boss.lore_text}"</p>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1 text-xs font-mono text-gray-400">
                <Heart size={11} className="text-accent-crimson" /> {boss.hp_total} HP
              </div>
              <div className="flex items-center gap-1 text-xs font-mono text-accent-gold">
                <Star size={11} /> 500 XP
              </div>
            </div>

            <button
              onClick={() => { setSelectedBoss(boss); startMutation.mutate(boss.id) }}
              disabled={startMutation.isPending}
              className="btn-danger w-full text-sm"
            >
              <Skull size={14} className="inline mr-2" />
              {startMutation.isPending ? 'Entering...' : 'Challenge'}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
