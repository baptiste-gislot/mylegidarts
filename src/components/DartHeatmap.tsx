import { dartLabel } from '@/lib/scoring'
import type { Dart, Mult } from '@/lib/scoring'
import { SECTOR_STEP as STEP, circlePath, px, py, ringSector } from '@/lib/boardGeometry'
import { BOARD_SECTORS, HEAT_LEVELS, heatKey, heatLevel, heatmapCounts } from '@/lib/heatmap'

interface DartHeatmapProps {
  /** Toutes les fléchettes du joueur, ratés compris. */
  darts: Dart[]
}

const SIZE = 260
const C = SIZE / 2
/** Rayons stylisés : anneaux double/triple élargis pour que la teinte reste lisible. */
const RINGS: { r0: number; r1: number; mult: Mult }[] = [
  { r0: 10, r1: 52, mult: 1 },
  { r0: 52, r1: 64, mult: 3 },
  { r0: 64, r1: 88, mult: 1 },
  { r0: 88, r1: 100, mult: 2 },
]
const BULL_R = 10
const BULLSEYE_R = 4.5
const NUM_R = 111

export function DartHeatmap({ darts }: DartHeatmapProps) {
  if (darts.length === 0) return null

  const { hits, max, misses, onTarget } = heatmapCounts(darts)

  const segTitle = (sector: number, mult: Mult, count: number) => {
    const share = onTarget > 0 ? ` (${Math.round((count / onTarget) * 100)} %)` : ''
    return `${dartLabel({ sector, mult })} : ${count} impact${count > 1 ? 's' : ''}${share}`
  }

  const segClass = (count: number) => {
    const level = heatLevel(count, max)
    return level === 0 ? 'heatmap__seg' : `heatmap__seg heatmap__seg--l${level}`
  }

  return (
    <figure className="chart heatmap">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Heatmap de la cible : répartition des ${onTarget} fléchettes sur la cible`}
      >
        <circle cx={C} cy={C} r={100} className="heatmap__bg" />

        {BOARD_SECTORS.map((sector, i) => {
          const a0 = (i - 0.5) * STEP
          const a1 = (i + 0.5) * STEP
          return (
            <g key={sector}>
              {RINGS.map(({ r0, r1, mult }, j) => {
                const count = hits.get(heatKey(sector, mult)) ?? 0
                return (
                  <path key={j} d={ringSector(C, r0, r1, a0, a1)} className={segClass(count)}>
                    <title>{segTitle(sector, mult, count)}</title>
                  </path>
                )
              })}
              <text x={px(C, NUM_R, i * STEP)} y={py(C, NUM_R, i * STEP)} className="heatmap__num">
                {sector}
              </text>
            </g>
          )
        })}

        <path
          d={`${circlePath(C, BULL_R)} ${circlePath(C, BULLSEYE_R)}`}
          fillRule="evenodd"
          className={segClass(hits.get(heatKey(25, 1)) ?? 0)}
        >
          <title>{segTitle(25, 1, hits.get(heatKey(25, 1)) ?? 0)}</title>
        </path>
        <circle cx={C} cy={C} r={BULLSEYE_R} className={segClass(hits.get(heatKey(25, 2)) ?? 0)}>
          <title>{segTitle(25, 2, hits.get(heatKey(25, 2)) ?? 0)}</title>
        </circle>
      </svg>

      <div className="heatmap__legend" aria-hidden="true">
        <span>0</span>
        <span className="heatmap__steps">
          {Array.from({ length: HEAT_LEVELS }, (_, i) => (
            <span key={i} className={`heatmap__step heatmap__seg--l${i + 1}`} />
          ))}
        </span>
        <span>
          {max} impact{max > 1 ? 's' : ''}
        </span>
      </div>

      <figcaption className="chart__caption">
        <span>
          {onTarget} fléchette{onTarget > 1 ? 's' : ''} sur la cible
        </span>
        <span>
          {misses} raté{misses > 1 ? 's' : ''}
        </span>
      </figcaption>
    </figure>
  )
}
