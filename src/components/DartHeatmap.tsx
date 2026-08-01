import { dartLabel } from '@/lib/scoring'
import type { Dart, Mult } from '@/lib/scoring'
import { BOARD_SECTORS, heatKey, heatmapCounts } from '@/lib/heatmap'

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
/** 18° par secteur. */
const STEP = Math.PI / 10

/** Point sur le cercle de rayon r, angle a depuis le haut, sens horaire. */
function px(r: number, a: number): number {
  return C + r * Math.sin(a)
}
function py(r: number, a: number): number {
  return C - r * Math.cos(a)
}

/** Portion d'anneau entre les rayons r0 < r1, de l'angle a0 à a1. */
function ringSector(r0: number, r1: number, a0: number, a1: number): string {
  return [
    `M ${px(r1, a0)} ${py(r1, a0)}`,
    `A ${r1} ${r1} 0 0 1 ${px(r1, a1)} ${py(r1, a1)}`,
    `L ${px(r0, a1)} ${py(r0, a1)}`,
    `A ${r0} ${r0} 0 0 0 ${px(r0, a0)} ${py(r0, a0)}`,
    'Z',
  ].join(' ')
}

function circlePath(r: number): string {
  return `M ${C - r} ${C} A ${r} ${r} 0 1 1 ${C + r} ${C} A ${r} ${r} 0 1 1 ${C - r} ${C} Z`
}

/** Racine carrée pour étaler les faibles effectifs, plancher pour qu'un impact isolé reste visible. */
function heatOpacity(count: number, max: number): number {
  if (count === 0 || max === 0) return 0
  return 0.15 + 0.85 * Math.sqrt(count / max)
}

export function DartHeatmap({ darts }: DartHeatmapProps) {
  if (darts.length === 0) return null

  const { hits, max, misses, onTarget } = heatmapCounts(darts)

  const segTitle = (sector: number, mult: Mult, count: number) => {
    const share = onTarget > 0 ? ` (${Math.round((count / onTarget) * 100)} %)` : ''
    return `${dartLabel({ sector, mult })} : ${count} impact${count > 1 ? 's' : ''}${share}`
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
                  <path
                    key={j}
                    d={ringSector(r0, r1, a0, a1)}
                    className="heatmap__seg"
                    fillOpacity={heatOpacity(count, max)}
                  >
                    <title>{segTitle(sector, mult, count)}</title>
                  </path>
                )
              })}
              <text x={px(NUM_R, i * STEP)} y={py(NUM_R, i * STEP)} className="heatmap__num">
                {sector}
              </text>
            </g>
          )
        })}

        <path
          d={`${circlePath(BULL_R)} ${circlePath(BULLSEYE_R)}`}
          fillRule="evenodd"
          className="heatmap__seg"
          fillOpacity={heatOpacity(hits.get(heatKey(25, 1)) ?? 0, max)}
        >
          <title>{segTitle(25, 1, hits.get(heatKey(25, 1)) ?? 0)}</title>
        </path>
        <circle
          cx={C}
          cy={C}
          r={BULLSEYE_R}
          className="heatmap__seg"
          fillOpacity={heatOpacity(hits.get(heatKey(25, 2)) ?? 0, max)}
        >
          <title>{segTitle(25, 2, hits.get(heatKey(25, 2)) ?? 0)}</title>
        </circle>
      </svg>

      <div className="heatmap__legend" aria-hidden="true">
        <span>0</span>
        <span className="heatmap__gradient" />
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
