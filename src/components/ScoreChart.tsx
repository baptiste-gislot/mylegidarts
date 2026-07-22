import type { SessionRow } from '@/lib/useLeague'

interface ScoreChartProps {
  /** Sessions du joueur, de la plus ancienne à la plus récente. */
  sessions: SessionRow[]
}

const W = 320
const H = 110
const PAD = { top: 18, right: 34, bottom: 16, left: 8 }

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

export function ScoreChart({ sessions }: ScoreChartProps) {
  if (sessions.length < 2) return null

  const max = Math.max(...sessions.map((s) => s.total))
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (i / (sessions.length - 1)) * innerW
  const y = (total: number) => PAD.top + innerH - (total / Math.max(1, max)) * innerH

  const points = sessions.map((s, i) => ({ s, cx: x(i), cy: y(s.total) }))
  const recordIndex = sessions.findIndex((s) => s.total === max)
  const last = points[points.length - 1]

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Évolution des scores de session">
        {/* repères discrets : ligne de base et niveau du record */}
        <line x1={PAD.left} y1={y(0)} x2={W - PAD.right} y2={y(0)} className="chart__grid" />
        <line x1={PAD.left} y1={y(max)} x2={W - PAD.right} y2={y(max)} className="chart__grid chart__grid--dashed" />

        <polyline
          className="chart__line"
          points={points.map((p) => `${p.cx},${p.cy}`).join(' ')}
        />

        {points.map((p, i) => (
          <circle
            key={p.s.id}
            cx={p.cx}
            cy={p.cy}
            r={i === recordIndex ? 4 : 2.5}
            className={i === recordIndex ? 'chart__dot chart__dot--record' : 'chart__dot'}
          >
            <title>
              {dateFormat.format(new Date(p.s.created_at))} : {p.s.total}
            </title>
          </circle>
        ))}

        {/* labels sélectifs : le record et le dernier score */}
        <text x={points[recordIndex].cx} y={points[recordIndex].cy - 7} className="chart__label" textAnchor="middle">
          {max}
        </text>
        {recordIndex !== points.length - 1 && (
          <text x={last.cx + 7} y={last.cy + 4} className="chart__label chart__label--muted">
            {last.s.total}
          </text>
        )}
      </svg>
      <figcaption className="chart__caption">
        <span>{dateFormat.format(new Date(sessions[0].created_at))}</span>
        <span>{dateFormat.format(new Date(sessions[sessions.length - 1].created_at))}</span>
      </figcaption>
    </figure>
  )
}
