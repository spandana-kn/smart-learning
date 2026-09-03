import { useMemo } from 'react'
import type { GraphData, GraphNode, LearningPathState } from '@/services/graphService'

interface Props {
  data: GraphData
  pathState?: LearningPathState
  selectedNode: string | null
  onNodeClick: (node: GraphNode) => void
  width?: number
  height?: number
}

const STATUS_COLOR: Record<string, string> = {
  mastered: '#FFD700',
  available: '#6C63FF',
  locked: '#3A3555',
}

const CANDIDATE_COLOR = '#00F5A0'
const START_COLOR = '#00B4D8'

function short(name: string) {
  return name.length > 18 ? `${name.slice(0, 16)}...` : name
}

export default function ConceptGraph({
  data,
  pathState,
  selectedNode,
  onNodeClick,
  width = 900,
  height = 560,
}: Props) {
  const nodeByName = useMemo(() => new Map(data.nodes.map((n) => [n.name, n])), [data.nodes])
  const covered = pathState?.covered_order ?? ['Data Types']
  const recommended = pathState?.recommended_concept
  const candidateNames = new Set(pathState?.candidates.map((c) => c.concept) ?? [])
  const startConcept = pathState?.start_concept ?? 'Data Types'

  const layout = useMemo(() => {
    const positions = new Map<string, { x: number; y: number; lane: 'path' | 'candidate' | 'remaining' }>()
    const tiers = [...new Set(data.nodes.map((n) => n.tier))].sort((a, b) => a - b)
    const tierIndex = new Map(tiers.map((tier, i) => [tier, i]))
    const top = 92
    const bottom = height - 74
    const usableH = Math.max(260, bottom - top)
    const usableW = Math.max(420, width - 150)

    tiers.forEach((tier) => {
      const tierNodes = data.nodes
        .filter((n) => n.tier === tier)
        .sort((a, b) => {
          const statusRank = (n: GraphNode) =>
            n.name === startConcept ? -4 :
            n.name === recommended ? -3 :
            covered.includes(n.name) ? -2 :
            candidateNames.has(n.name) ? -1 : 0
          return statusRank(a) - statusRank(b) || a.name.localeCompare(b.name)
        })
      const x = 70 + (tierIndex.get(tier) ?? 0) * (usableW / Math.max(1, tiers.length - 1))
      const gap = usableH / Math.max(1, tierNodes.length)
      tierNodes.forEach((node, i) => {
        const centeredOffset = gap * (i + 0.5)
        const lane =
          covered.includes(node.name) || node.name === recommended
            ? 'path'
            : candidateNames.has(node.name)
              ? 'candidate'
              : 'remaining'
        positions.set(node.name, {
          x,
          y: top + centeredOffset,
          lane,
        })
      })
    })
    return positions
  }, [candidateNames, covered, data.nodes, height, recommended, startConcept, width])

  const visibleLinks = data.links.filter((link) => layout.has(String(link.source)) && layout.has(String(link.target)))
  const pathNames = useMemo(() => {
    const path = [...covered]
    if (recommended && !path.includes(recommended)) path.push(recommended)
    return path
  }, [covered, recommended])
  const lastPathName = pathNames[pathNames.length - 1]

  return (
    <svg width={width} height={height} className="block" role="img" aria-label="Personalized learning path map">
      <defs>
        <filter id="nodeGlow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#6C63FF" opacity="0.7" />
        </marker>
      </defs>

      <rect width={width} height={height} rx="16" fill="rgb(var(--color-surface))" />
      <text x="24" y="34" fill="var(--text-muted)" fontSize="11" fontFamily="JetBrains Mono" letterSpacing="3">
        PERSONALIZED LEARNING PATH
      </text>
      <text x="24" y="58" fill="var(--text-primary)" fontSize="16" fontFamily="Space Grotesk" fontWeight="700">
        Start at Data Types, then adapt by answer accuracy, focus, and quiz time.
      </text>

      {visibleLinks.map((link) => {
        const src = layout.get(String(link.source))
        const dst = layout.get(String(link.target))
        if (!src || !dst) return null
        const onPath = pathNames.includes(String(link.source)) && pathNames.includes(String(link.target))
        const toCandidate = dst.lane === 'candidate'
        return (
          <path
            key={`${link.source}-${link.target}`}
            d={`M ${src.x} ${src.y} C ${src.x + 48} ${src.y}, ${dst.x - 48} ${dst.y}, ${dst.x} ${dst.y}`}
            fill="none"
            stroke={onPath ? '#FFD700' : toCandidate ? CANDIDATE_COLOR : '#2E2A47'}
            strokeWidth={onPath ? 3 : toCandidate ? 2 : 1}
            strokeOpacity={onPath || toCandidate ? 0.8 : 0.28}
            markerEnd={onPath || toCandidate ? 'url(#arrow)' : undefined}
          />
        )
      })}

      {pathNames.slice(0, -1).map((name, i) => {
        const src = layout.get(name)
        const dst = layout.get(pathNames[i + 1])
        if (!src || !dst) return null
        return (
          <path
            key={`path-${name}-${pathNames[i + 1]}`}
            d={`M ${src.x} ${src.y} C ${src.x + 56} ${src.y}, ${dst.x - 56} ${dst.y}, ${dst.x} ${dst.y}`}
            fill="none"
            stroke="#FFD700"
            strokeWidth="4"
            strokeOpacity="0.8"
            markerEnd="url(#arrow)"
          />
        )
      })}

      {[...candidateNames].filter((name) => name !== recommended).map((name) => {
        const src = layout.get(lastPathName)
        const dst = layout.get(name)
        if (!src || !dst) return null
        return (
          <path
            key={`candidate-${lastPathName}-${name}`}
            d={`M ${src.x} ${src.y} C ${src.x + 56} ${src.y}, ${dst.x - 56} ${dst.y}, ${dst.x} ${dst.y}`}
            fill="none"
            stroke={CANDIDATE_COLOR}
            strokeWidth="2"
            strokeDasharray="5 5"
            strokeOpacity="0.65"
            markerEnd="url(#arrow)"
          />
        )
      })}

      {data.nodes.map((node) => {
        const p = layout.get(node.name)
        if (!p) return null
        const isStart = node.name === startConcept
        const isRecommended = node.name === recommended
        const isCandidate = candidateNames.has(node.name)
        const isSelected = selectedNode === node.id
        const order = covered.indexOf(node.name)
        const color = isStart ? START_COLOR : isRecommended ? CANDIDATE_COLOR : STATUS_COLOR[node.status]
        const radius = p.lane === 'remaining' ? 13 : isRecommended ? 25 : isStart ? 24 : 20
        const opacity = p.lane === 'remaining' && node.status === 'locked' ? 0.48 : 1

        return (
          <g
            key={node.id}
            transform={`translate(${p.x}, ${p.y})`}
            opacity={opacity}
            onClick={() => onNodeClick(node)}
            className="cursor-pointer"
          >
            <circle
              r={radius + 8}
              fill={color}
              opacity={isRecommended || isSelected ? 0.18 : 0.08}
              filter={isRecommended || isSelected ? 'url(#nodeGlow)' : undefined}
            />
            <circle
              r={radius}
              fill={node.status === 'locked' && !isCandidate ? '#161326' : color}
              stroke={color}
              strokeWidth={isSelected || isRecommended ? 3 : 2}
            />
            {node.mastery > 0 && (
              <circle
                r={Math.max(4, radius * node.mastery)}
                fill="#00F5A0"
                opacity="0.28"
              />
            )}
            {order >= 0 && (
              <g transform={`translate(${radius - 5}, ${-radius + 3})`}>
                <circle r="9" fill="rgb(var(--color-surface))" stroke="#FFD700" strokeWidth="1.5" />
                <text y="4" textAnchor="middle" fill="#FFD700" fontSize="9" fontFamily="JetBrains Mono" fontWeight="700">
                  {order + 1}
                </text>
              </g>
            )}
            {isRecommended && (
              <text y={-radius - 14} textAnchor="middle" fill={CANDIDATE_COLOR} fontSize="10" fontFamily="JetBrains Mono" fontWeight="700">
                NEXT
              </text>
            )}
            <text
              y={radius + 17}
              textAnchor="middle"
              fill={node.status === 'locked' ? '#7B7890' : 'var(--text-primary)'}
              fontSize={p.lane === 'remaining' ? 9 : 11}
              fontFamily="Outfit"
              fontWeight={p.lane === 'remaining' ? 500 : 700}
            >
              {short(node.name)}
            </text>
            {p.lane !== 'remaining' && (
              <text y={radius + 32} textAnchor="middle" fill="#8F8AA7" fontSize="9" fontFamily="JetBrains Mono">
                {Math.round(node.mastery * 100)}% mastery
              </text>
            )}
          </g>
        )
      })}

      <g transform={`translate(24, ${height - 28})`} fontFamily="JetBrains Mono" fontSize="11">
        <circle cx="0" cy="-4" r="5" fill={START_COLOR} /><text x="12" y="0" fill="var(--text-muted)">Common start</text>
        <circle cx="118" cy="-4" r="5" fill="#FFD700" /><text x="130" y="0" fill="var(--text-muted)">Covered order</text>
        <circle cx="250" cy="-4" r="5" fill={CANDIDATE_COLOR} /><text x="262" y="0" fill="var(--text-muted)">Recommended next</text>
        <circle cx="420" cy="-4" r="5" fill="#3A3555" /><text x="432" y="0" fill="var(--text-muted)">Remaining</text>
      </g>
    </svg>
  )
}
