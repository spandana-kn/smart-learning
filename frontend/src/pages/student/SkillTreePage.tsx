import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, CheckCircle, Zap, BookOpen, ChevronRight, X, RotateCcw, Route } from 'lucide-react'
import { graphService, type GraphNode, type Question } from '@/services/graphService'
import ConceptGraph from '@/components/graph/ConceptGraph'
import { useCVStore } from '@/stores/cvStore'
import { useShallow } from 'zustand/react/shallow'
import clsx from 'clsx'

const DIFF_COLOR = { easy: 'text-green-400', medium: 'text-yellow-400', hard: 'text-red-400' }
const STATUS_ICON = {
  mastered:  <CheckCircle size={14} className="text-yellow-400" />,
  available: <Zap size={14} className="text-brand" />,
  locked:    <Lock size={14} className="text-gray-500" />,
}

export default function SkillTreePage() {
  const qc = useQueryClient()
  const graphWrapRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [quizMode, setQuizMode] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [qIdx, setQIdx] = useState(0)
  const [chosen, setChosen] = useState<string | null>(null)
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<{ correct: boolean; explanation: string } | null>(null)
  const [sessionXP, setSessionXP] = useState(0)
  const [graphSize, setGraphSize] = useState({ width: 720, height: 560 })
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now())
  const { focusScore, emotion } = useCVStore(
    useShallow((s) => ({ focusScore: s.focusScore, emotion: s.emotion })),
  )
  const [routingCV, setRoutingCV] = useState({ emotion, focusScore: focusScore || 65 })

  useEffect(() => {
    const timer = setInterval(() => {
      setRoutingCV({ emotion, focusScore: focusScore || 65 })
    }, 5_000)
    return () => clearInterval(timer)
  }, [emotion, focusScore])

  const { data: graphData, isLoading } = useQuery({
    queryKey: ['graph-viz'],
    queryFn: graphService.getVisualization,
    staleTime: 30_000,
  })

  const { data: pathState } = useQuery({
    queryKey: ['graph-path-state', routingCV.emotion, Math.round(routingCV.focusScore || 0)],
    queryFn: () => graphService.getPathState({ emotion: routingCV.emotion, focus: routingCV.focusScore || 65 }),
    refetchInterval: 10_000,
  })

  const { data: nextRec } = useQuery({
    queryKey: ['next-concept', selected?.id, routingCV.emotion, Math.round(routingCV.focusScore || 0)],
    queryFn: () =>
      graphService.getNextConcept({
        current_concept: selected?.name,
        emotion: routingCV.emotion,
        focus: routingCV.focusScore || 65,
      }),
    enabled: !quizMode,
  })

  const attemptMutation = useMutation({
    mutationFn: graphService.recordAttempt,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['graph-viz'] })
      qc.invalidateQueries({ queryKey: ['next-concept'] })
    },
  })

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (quizMode) return
    setSelected(node)
    setQuizMode(false)
    setQuestions([])
    setResult(null)
    setChosen(null)
  }, [quizMode])

  const startQuiz = async () => {
    if (!selected || selected.status === 'locked') return
    const qs = await graphService.getSessionQuestions({
      concept: selected.name,
      n: 5,
      emotion: routingCV.emotion,
      focus: routingCV.focusScore || 65,
    })
    setQuestions(qs)
    setQIdx(0)
    setChosen(null)
    setResult(null)
    setSeenIds(new Set())
    setSessionXP(0)
    setQuestionStartedAt(Date.now())
    setQuizMode(true)
  }

  const handleAnswer = async (label: string) => {
    if (chosen || !selected) return
    setChosen(label)
    const q = questions[qIdx]
    const correct = label === q.correct_answer
    setResult({ correct, explanation: q.explanation })
    setSeenIds((prev) => new Set([...prev, q.id]))

    const res = await attemptMutation.mutateAsync({
      question_id: q.id,
      concept: selected.name,
      correct,
      answer: label,
      focus_score: focusScore || 65,
      emotion,
      time_ms: Date.now() - questionStartedAt,
    })
    if (correct) setSessionXP((x) => x + (res.xp_earned ?? 0))
  }

  const nextQuestion = () => {
    if (qIdx + 1 >= questions.length) {
      setQuizMode(false)
      setResult(null)
      setChosen(null)
      qc.invalidateQueries({ queryKey: ['graph-viz'] })
      return
    }
    setQIdx((i) => i + 1)
    setChosen(null)
    setResult(null)
    setQuestionStartedAt(Date.now())
  }

  useEffect(() => {
    const el = graphWrapRef.current
    if (!el) return

    const resize = () => {
      const rect = el.getBoundingClientRect()
      setGraphSize({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(420, Math.floor(rect.height)),
      })
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex h-full min-h-[640px] gap-0 overflow-hidden">
      {/* Graph canvas */}
      <div ref={graphWrapRef} className="flex-1 relative bg-surface rounded-xl overflow-hidden border border-surface-border">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Loading concept graph…
          </div>
        ) : graphData ? (
          <ConceptGraph
            data={graphData}
            pathState={pathState}
            selectedNode={selected?.id ?? null}
            onNodeClick={handleNodeClick}
            width={graphSize.width}
            height={graphSize.height}
          />
        ) : null}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 flex gap-3 text-xs text-gray-400">
          {(['mastered', 'available', 'locked'] as const).map((s) => (
            <span key={s} className="flex items-center gap-1 capitalize">
              {STATUS_ICON[s]} {s}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#00F5A0] inline-block" /> mastery fill
          </span>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-80 shrink-0 flex flex-col gap-4 pl-4 overflow-y-auto">

        {/* Recommended concept */}
        {(nextRec || pathState) && !quizMode && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-brand/30 bg-surface-card p-4"
          >
            <p className="text-xs text-gray-400 mb-1 font-mono uppercase tracking-wide">AI Recommends</p>
            <p className="text-sm font-display font-semibold text-white">{pathState?.recommended_concept ?? nextRec?.recommended_concept}</p>
            {nextRec?.message && (
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{nextRec.message}</p>
            )}
            {pathState && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-surface-elevated p-2">
                  <p className="text-sm font-bold text-white">{pathState.attempt_summary.attempts}</p>
                  <p className="text-[10px] text-gray-500 font-mono">Attempts</p>
                </div>
                <div className="rounded-lg bg-surface-elevated p-2">
                  <p className="text-sm font-bold text-accent-emerald">{Math.round(pathState.attempt_summary.recent_accuracy * 100)}%</p>
                  <p className="text-[10px] text-gray-500 font-mono">Accuracy</p>
                </div>
                <div className="rounded-lg bg-surface-elevated p-2">
                  <p className="text-sm font-bold text-accent-gold">{Math.round(pathState.attempt_summary.recent_avg_time_ms / 1000)}s</p>
                  <p className="text-[10px] text-gray-500 font-mono">Avg Time</p>
                </div>
              </div>
            )}
            {nextRec?.learning_path && nextRec.learning_path.length > 1 && (
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {nextRec.learning_path.map((step, i) => (
                  <span key={step} className="flex items-center gap-1 text-xs text-gray-500">
                    {i > 0 && <ChevronRight size={10} />}
                    <span className={i === nextRec.learning_path.length - 1 ? 'text-brand' : ''}>
                      {step}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {pathState && !quizMode && (
          <div className="rounded-xl border border-surface-border bg-surface-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Route size={14} className="text-brand" />
              <p className="text-xs text-gray-400 font-mono uppercase tracking-wide">Start + Covered Order</p>
            </div>
            <div className="space-y-2">
              {pathState.covered_order.slice(0, 8).map((topic, i) => (
                <div key={topic} className="flex items-center gap-2 text-xs">
                  <span className="w-5 h-5 rounded-full bg-accent-gold/15 border border-accent-gold/40 text-accent-gold flex items-center justify-center font-mono">
                    {i + 1}
                  </span>
                  <span className="text-gray-200">{topic}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {pathState && !quizMode && (
          <div className="rounded-xl border border-accent-emerald/25 bg-surface-card p-4 space-y-3">
            <p className="text-xs text-gray-400 font-mono uppercase tracking-wide">Next Topic Candidates</p>
            {pathState.candidates.map((candidate, i) => (
              <button
                key={candidate.concept}
                onClick={() => {
                  const node = graphData?.nodes.find((n) => n.name === candidate.concept)
                  if (node) setSelected(node)
                }}
                className="w-full text-left rounded-lg bg-surface-elevated/70 border border-surface-border px-3 py-2 hover:border-accent-emerald/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-display font-semibold text-white">{i + 1}. {candidate.concept}</span>
                  <span className="text-xs font-mono text-accent-emerald">{candidate.score}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{candidate.reason}</p>
              </button>
            ))}
          </div>
        )}

        {/* Selected concept card */}
        {selected && !quizMode && (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-xl border border-surface-border bg-surface-card p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display font-bold text-white">{selected.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{selected.description}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white">
                <X size={14} />
              </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-surface-hover p-2">
                <p className="text-[10px] text-gray-400 uppercase">Mastery</p>
                <p className="text-sm font-bold text-white">{Math.round(selected.mastery * 100)}%</p>
              </div>
              <div className="rounded-lg bg-surface-hover p-2">
                <p className="text-[10px] text-gray-400 uppercase">Tier</p>
                <p className="text-sm font-bold text-white">{selected.tier}</p>
              </div>
              <div className="rounded-lg bg-surface-hover p-2">
                <p className="text-[10px] text-gray-400 uppercase">XP</p>
                <p className="text-sm font-bold text-accent-gold">+{selected.xp_reward}</p>
              </div>
            </div>

            {/* Mastery bar */}
            <div>
              <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-accent-gold"
                  initial={{ width: 0 }}
                  animate={{ width: `${selected.mastery * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            {/* Tags */}
            <div className="flex gap-2 flex-wrap">
              <span className={clsx('text-xs font-mono', DIFF_COLOR[selected.difficulty])}>
                {selected.difficulty}
              </span>
              <span className="text-xs text-purple-400 font-mono">{selected.bloom}</span>
              {STATUS_ICON[selected.status]}
              <span className="text-xs text-gray-500 capitalize">{selected.status}</span>
            </div>

            {/* Start quiz button */}
            <button
              onClick={startQuiz}
              disabled={selected.status === 'locked'}
              className={clsx(
                'w-full py-2 rounded-lg text-sm font-display font-semibold transition-all flex items-center justify-center gap-2',
                selected.status === 'locked'
                  ? 'bg-surface-hover text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-brand text-white hover:opacity-90 shadow-glow',
              )}
            >
              <BookOpen size={14} />
              {selected.status === 'locked' ? 'Locked — master prerequisites first' : 'Start Practice'}
            </button>
          </motion.div>
        )}

        {/* Quiz mode */}
        <AnimatePresence>
          {quizMode && questions.length > 0 && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-surface-border bg-surface-card p-4 space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-mono">
                    Question {qIdx + 1} / {questions.length}
                  </p>
                  <p className="text-sm font-display font-semibold text-brand">{selected?.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {sessionXP > 0 && (
                    <span className="text-xs text-accent-gold font-mono">+{sessionXP} XP</span>
                  )}
                  <button
                    onClick={() => { setQuizMode(false); setResult(null); setChosen(null) }}
                    className="text-gray-500 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Question */}
              <p className="text-sm text-white leading-relaxed">
                {questions[qIdx].question_text}
              </p>

              {/* Options */}
              <div className="space-y-2">
                {questions[qIdx].options.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => handleAnswer(opt.label)}
                    disabled={!!chosen}
                    className={clsx(
                      'w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-all',
                      !chosen && 'border-surface-border hover:border-brand hover:bg-brand/5',
                      chosen && opt.label === questions[qIdx].correct_answer &&
                        'border-green-500 bg-green-500/10 text-green-300',
                      chosen && opt.label === chosen && opt.label !== questions[qIdx].correct_answer &&
                        'border-red-500 bg-red-500/10 text-red-300',
                      chosen && opt.label !== chosen && opt.label !== questions[qIdx].correct_answer &&
                        'border-surface-border opacity-50',
                    )}
                  >
                    <span className="font-mono text-xs text-gray-500 mr-2">{opt.label}.</span>
                    {opt.text}
                  </button>
                ))}
              </div>

              {/* Explanation */}
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={clsx(
                    'rounded-lg p-3 text-xs leading-relaxed',
                    result.correct
                      ? 'bg-green-500/10 border border-green-500/30 text-green-300'
                      : 'bg-red-500/10 border border-red-500/30 text-red-300',
                  )}
                >
                  <p className="font-semibold mb-1">{result.correct ? '✓ Correct!' : '✗ Incorrect'}</p>
                  <p className="text-gray-300">{result.explanation}</p>
                </motion.div>
              )}

              {/* Next button */}
              {chosen && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={nextQuestion}
                  className="w-full py-2 rounded-lg bg-gradient-brand text-white text-sm font-display font-semibold flex items-center justify-center gap-2 hover:opacity-90"
                >
                  {qIdx + 1 >= questions.length ? (
                    <><RotateCcw size={14} /> Finish Session</>
                  ) : (
                    <><ChevronRight size={14} /> Next Question</>
                  )}
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!selected && !quizMode && (
          <div className="rounded-xl border border-dashed border-surface-border p-6 text-center text-sm text-gray-500">
            Click a node to explore a concept
          </div>
        )}
      </div>
    </div>
  )
}
