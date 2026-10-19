// Cricket standard : fermer 15 à 20 et le bull (trois marques chacun), et
// marquer des points sur les numéros fermés chez soi mais encore ouverts chez
// au moins un adversaire. Gagne celui qui a tout fermé avec au moins autant de
// points que les autres ; au bout de 20 volées, le plus de points l'emporte.

import { leaders, type TurnRules } from '../turnGames'

export const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25] as const
export const CRICKET_ROUNDS = 20
const MARKS_TO_CLOSE = 3

export interface CricketState {
  /** Marques par joueur et par cible (dans l'ordre de CRICKET_TARGETS), plafonnées à 3. */
  marks: number[][]
  points: number[]
}

const targetLabel = (target: number) => (target === 25 ? 'bull' : `${target}`)

function closedCount(state: CricketState, player: number): number {
  return state.marks[player].filter((m) => m >= MARKS_TO_CLOSE).length
}

export const cricketRules: TurnRules<CricketState> = {
  maxRounds: CRICKET_ROUNDS,
  minPlayers: 1,

  init(players) {
    return {
      marks: Array.from({ length: players }, () => CRICKET_TARGETS.map(() => 0)),
      points: Array.from({ length: players }, () => 0),
    }
  },

  apply(state, { player, dart }) {
    const index = CRICKET_TARGETS.indexOf(dart.sector as (typeof CRICKET_TARGETS)[number])
    if (index === -1) return { state }
    const before = state.marks[player][index]
    const hits = before + dart.mult
    const excess = Math.max(0, hits - Math.max(MARKS_TO_CLOSE, before))
    const marks = state.marks.map((row, p) =>
      p === player ? row.map((m, i) => (i === index ? Math.min(MARKS_TO_CLOSE, hits) : m)) : row,
    )
    const opponentsOpen = marks.some((row, p) => p !== player && row[index] < MARKS_TO_CLOSE)
    const gained = excess > 0 && opponentsOpen ? excess * CRICKET_TARGETS[index] : 0
    const points = state.points.map((pts, p) => (p === player ? pts + gained : pts))
    const target = targetLabel(CRICKET_TARGETS[index])
    const text =
      before < MARKS_TO_CLOSE && hits >= MARKS_TO_CLOSE
        ? `{lanceur} ferme le ${target} !`
        : gained > 0
          ? `${gained} points sur le ${target} !`
          : null
    return { state: { marks, points }, note: text ? { text } : undefined }
  },

  isOut() {
    return false
  },

  winners(state, roundsOver) {
    const players = state.points.length
    const best = Math.max(...state.points)
    const champion = Array.from({ length: players }, (_, p) => p).find(
      (p) => closedCount(state, p) === CRICKET_TARGETS.length && state.points[p] >= best,
    )
    if (champion !== undefined) return [champion]
    if (!roundsOver) return null
    // Aux points, puis au nombre de numéros fermés.
    const top = leaders(state.points)
    return leaders(
      state.points.map((_, p) => closedCount(state, p)),
      (p) => top.includes(p),
    )
  },

  view(state, player) {
    return {
      primary: `${state.points[player]}`,
      secondary: `${closedCount(state, player)} sur ${CRICKET_TARGETS.length} fermés`,
    }
  },

  total(state, player) {
    return state.points[player]
  },
}
