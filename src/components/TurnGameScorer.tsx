'use client'

import { DartInput } from './DartInput'
import { TURN_GAMES, type TurnGameId } from '@/lib/gameCatalog'
import { CRICKET_ROUNDS, CRICKET_TARGETS, type CricketState } from '@/lib/games/cricket'
import { SHANGHAI_ROUNDS } from '@/lib/games/shanghai'
import { dartLabel, dartValue, DARTS_PER_VOLLEY, type Dart } from '@/lib/scoring'
import type { TurnReplay } from '@/lib/turnGames'

interface TurnGameScorerProps {
  game: TurnGameId
  replay: TurnReplay<unknown>
  names: string[]
  onThrow: (dart: Dart) => void
  onUndo: () => void
  undoDisabled: boolean
  onAbandon: () => void
}

/** Marques du Cricket : une barre, une croix, une croix cerclée (fermé). */
const MARK_GLYPHS = ['', '/', '✕', 'ⓧ']

function roundLabel(game: TurnGameId, round: number): string {
  if (game === 'shanghai') return `Manche ${round + 1} sur ${SHANGHAI_ROUNDS} · on vise le ${round + 1}`
  if (game === 'cricket') return `Volée ${round + 1} sur ${CRICKET_ROUNDS}`
  return `Tour ${round + 1}`
}

/** L'écran de jeu des parties au tour par tour : tableau à gauche, cible à droite. */
export function TurnGameScorer({ game, replay, names, onThrow, onUndo, undoDisabled, onAbandon }: TurnGameScorerProps) {
  const entry = TURN_GAMES[game]
  const current = replay.current ?? 0
  const view = entry.view(replay.state, current)

  return (
    <div className="scorer">
      <div className="scorer__status">
        <div>
          <p className="scorer__volley">
            {entry.label} · {roundLabel(game, replay.round)}
          </p>
          <p className="scorer__thrower">{names[current]}</p>
          {game === 'clock' && <p className="scorer__goal">Vise le {view.primary}</p>}
        </div>
        <button type="button" className="button-ghost" onClick={onAbandon}>
          Abandonner
        </button>
      </div>

      <div className="scorer__slots">
        {Array.from({ length: DARTS_PER_VOLLEY }, (_, i) => {
          const dart = replay.volley[i]
          return (
            <div key={i} className={dart ? 'slot slot--filled' : 'slot'}>
              <span className="slot__index">{i + 1}</span>
              {dart && (
                <>
                  <span className="slot__label">{dartLabel(dart)}</span>
                  <span className="slot__value">{dartValue(dart)}</span>
                </>
              )}
            </div>
          )
        })}
      </div>

      {game === 'cricket' ? (
        <CricketGrid state={replay.state as CricketState} names={names} current={current} />
      ) : (
        <ol className="scoreboard" aria-label="Scores">
          {names.map((name, i) => {
            const line = entry.view(replay.state, i)
            const out = game === 'killer' && line.primary === '✕'
            return (
              <li
                key={i}
                className={[
                  'scoreboard__row',
                  i === current ? 'scoreboard__row--active' : '',
                  out ? 'scoreboard__row--out' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={i === current ? 'step' : undefined}
              >
                <span className="scoreboard__who">
                  <span className="scoreboard__name">{name}</span>
                  <span className="scoreboard__detail">{line.secondary}</span>
                </span>
                <span className="scoreboard__score">{line.primary}</span>
              </li>
            )
          })}
        </ol>
      )}

      <DartInput volley={[0, 1, 2].map((i) => replay.volley[i] ?? null)} onThrow={onThrow} onUndo={onUndo} undoDisabled={undoDisabled} />
    </div>
  )
}

function CricketGrid({ state, names, current }: { state: CricketState; names: string[]; current: number }) {
  return (
    <table className="cricket">
      <thead>
        <tr>
          <th scope="col">
            <span className="visually-hidden">Numéro</span>
          </th>
          {names.map((name, p) => (
            <th key={p} scope="col" className={p === current ? 'cricket__player cricket__player--active' : 'cricket__player'}>
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {CRICKET_TARGETS.map((target, t) => {
          const closedByAll = state.marks.every((row) => row[t] >= 3)
          return (
            <tr key={target} className={closedByAll ? 'cricket__row cricket__row--dead' : 'cricket__row'}>
              <th scope="row" className="cricket__target">
                {target === 25 ? 'Bull' : target}
              </th>
              {state.marks.map((row, p) => (
                <td key={p} className={row[t] >= 3 ? 'cricket__marks cricket__marks--closed' : 'cricket__marks'}>
                  {MARK_GLYPHS[row[t]]}
                </td>
              ))}
            </tr>
          )
        })}
        <tr className="cricket__points">
          <th scope="row">Points</th>
          {state.points.map((pts, p) => (
            <td key={p}>{pts}</td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}
