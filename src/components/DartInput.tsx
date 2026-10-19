'use client'

import { useState } from 'react'
import { SECTOR_STEP, circlePath, px, py, ringSector } from '@/lib/boardGeometry'
import { BOARD_SECTORS } from '@/lib/heatmap'
import { dartLabel, dartValue, type Dart, type Mult } from '@/lib/scoring'

interface DartInputProps {
  /** Fléchettes déjà saisies dans la volée en cours (null = emplacement vide). */
  volley: (Dart | null)[]
  onThrow: (dart: Dart) => void
  onUndo: () => void
  undoDisabled: boolean
}

/**
 * La saisie d'une fléchette : la cible cliquable sur un poste à souris, le
 * pavé sur écran tactile. Les deux sont rendus, le CSS n'en montre qu'un
 * selon le pointeur — pas de mesure côté client, donc pas de saut au chargement.
 */
export function DartInput({ volley, onThrow, onUndo, undoDisabled }: DartInputProps) {
  const extras = (
    <div className="dart-extras">
      <button type="button" className="key key--miss" onClick={() => onThrow({ sector: 0, mult: 1 })}>
        Raté
      </button>
      <button type="button" className="key key--undo" onClick={onUndo} disabled={undoDisabled}>
        Annuler
      </button>
    </div>
  )

  return (
    <div className="dart-input">
      <div className="dart-input__board">
        <DartBoard volley={volley} onThrow={onThrow} />
        {extras}
      </div>
      <div className="dart-input__pad">
        <DartPad onThrow={onThrow} />
        {extras}
      </div>
    </div>
  )
}

const SIZE = 500
const C = SIZE / 2
/**
 * Rayons de la cible cliquable. Les anneaux double et triple sont bien plus
 * épais que sur une vraie cible : à la souris, on doit pouvoir les viser
 * sans s'appliquer.
 */
const RINGS: { r0: number; r1: number; mult: Mult; inner?: boolean }[] = [
  { r0: 36, r1: 104, mult: 1, inner: true },
  { r0: 104, r1: 136, mult: 3 },
  { r0: 136, r1: 180, mult: 1 },
  { r0: 180, r1: 212, mult: 2 },
]
const OUTER_R = 238
const NUM_R = 226
const BULL_R = 36
const BULLSEYE_R = 16

/** Position (centre) d'un segment, pour y poser les marqueurs de la volée. */
function anchor(dart: Dart): { x: number; y: number } {
  if (dart.sector === 25) return { x: C, y: dart.mult === 2 ? C : C - (BULL_R + BULLSEYE_R) / 2 }
  const ring = RINGS.find((r) => r.mult === dart.mult && !r.inner)!
  const a = BOARD_SECTORS.indexOf(dart.sector as (typeof BOARD_SECTORS)[number]) * SECTOR_STEP
  const r = (ring.r0 + ring.r1) / 2
  return { x: px(C, r, a), y: py(C, r, a) }
}

function DartBoard({ volley, onThrow }: { volley: (Dart | null)[]; onThrow: (dart: Dart) => void }) {
  const [aimed, setAimed] = useState<Dart | null>(null)

  // Fléchettes de la volée regroupées par segment : deux fois T20 → « 1 2 ».
  const marks = new Map<string, { dart: Dart; numbers: number[] }>()
  volley.forEach((dart, i) => {
    if (!dart || dart.sector === 0) return
    const key = `${dart.sector}-${dart.mult}`
    const mark = marks.get(key) ?? { dart, numbers: [] }
    mark.numbers.push(i + 1)
    marks.set(key, mark)
  })

  const segment = (dart: Dart, d: string, className: string, key: string, fillRule?: 'evenodd') => (
    <path
      key={key}
      d={d}
      fillRule={fillRule}
      className={`${className}${marks.has(`${dart.sector}-${dart.mult}`) ? ' board-seg--hit' : ''}`}
      onPointerEnter={() => setAimed(dart)}
      onPointerLeave={() =>
        setAimed((current) =>
          current?.sector === dart.sector && current.mult === dart.mult ? null : current,
        )
      }
      onClick={() => onThrow(dart)}
    >
      <title>{`${dartLabel(dart)} · ${dartValue(dart)} pts`}</title>
    </path>
  )

  return (
    <figure className="board">
      <p className="board__aim" aria-live="off">
        {aimed ? (
          <>
            <strong>{dartLabel(aimed)}</strong> {dartValue(aimed)} pts
          </>
        ) : (
          'Cliquez où la fléchette s’est plantée'
        )}
      </p>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="group" aria-label="Cible : cliquez le segment touché">
        <circle cx={C} cy={C} r={OUTER_R} className="board__rim" />
        {BOARD_SECTORS.map((sector, i) => {
          const a0 = (i - 0.5) * SECTOR_STEP
          const a1 = (i + 0.5) * SECTOR_STEP
          const tone = i % 2 === 0 ? 'dark' : 'light'
          return (
            <g key={sector}>
              {RINGS.map(({ r0, r1, mult }, j) =>
                segment(
                  { sector, mult },
                  ringSector(C, r0, r1, a0, a1),
                  `board-seg board-seg--${mult === 1 ? tone : mult === 3 ? `t-${tone}` : `d-${tone}`}`,
                  `${sector}-${j}`,
                ),
              )}
              <text x={px(C, NUM_R, i * SECTOR_STEP)} y={py(C, NUM_R, i * SECTOR_STEP)} className="board__num">
                {sector}
              </text>
            </g>
          )
        })}
        {segment(
          { sector: 25, mult: 1 },
          `${circlePath(C, BULL_R)} ${circlePath(C, BULLSEYE_R)}`,
          'board-seg board-seg--bull25',
          'bull25',
          'evenodd',
        )}
        {segment(
          { sector: 25, mult: 2 },
          circlePath(C, BULLSEYE_R),
          'board-seg board-seg--bull50',
          'bull50',
        )}
        {[...marks.values()].map(({ dart, numbers }) => {
          const { x, y } = anchor(dart)
          return (
            <g key={`${dart.sector}-${dart.mult}`} className="board__mark" aria-hidden="true">
              <circle cx={x} cy={y} r={numbers.length > 1 ? 17 : 13} />
              <text x={x} y={y}>
                {numbers.join(' ')}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/** Le pavé tactile : un numéro par case dans l'ordre de la cible, double et triple en direct. */
function DartPad({ onThrow }: { onThrow: (dart: Dart) => void }) {
  return (
    <div className="dart-pad">
      <div className="dart-pad__sectors">
        {BOARD_SECTORS.map((sector) => (
          <div key={sector} className="dart-pad__cell">
            <button
              type="button"
              className="dart-pad__single"
              onClick={() => onThrow({ sector, mult: 1 })}
              aria-label={`Simple ${sector}`}
            >
              {sector}
            </button>
            <button
              type="button"
              className="dart-pad__double"
              onClick={() => onThrow({ sector, mult: 2 })}
              aria-label={`Double ${sector}`}
            >
              D
            </button>
            <button
              type="button"
              className="dart-pad__triple"
              onClick={() => onThrow({ sector, mult: 3 })}
              aria-label={`Triple ${sector}`}
            >
              T
            </button>
          </div>
        ))}
      </div>
      <div className="dart-pad__bulls">
        <button type="button" className="key key--bull25" onClick={() => onThrow({ sector: 25, mult: 1 })}>
          25
        </button>
        <button type="button" className="key key--bull50" onClick={() => onThrow({ sector: 25, mult: 2 })}>
          Bull
        </button>
      </div>
    </div>
  )
}
