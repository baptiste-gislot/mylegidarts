// Around the clock : toucher 1, puis 2… jusqu'à 20, puis le bull. Tout
// segment du numéro visé (simple, double ou triple) fait avancer d'une case.
// Le premier à toucher le bull gagne.

import type { TurnRules } from '../turnGames'

/** 20 numéros puis le bull. */
export const CLOCK_STEPS = 21

export interface ClockState {
  /** Cases franchies par joueur (0 à 21). */
  progress: number[]
}

/** Le numéro que vise un joueur arrivé à `progress` cases. */
export function clockTarget(progress: number): number {
  return progress < CLOCK_STEPS - 1 ? progress + 1 : 25
}

const targetLabel = (target: number) => (target === 25 ? 'bull' : `${target}`)

export const clockRules: TurnRules<ClockState> = {
  maxRounds: null,
  minPlayers: 1,

  init(players) {
    return { progress: Array.from({ length: players }, () => 0) }
  },

  apply(state, { player, dart }) {
    const progress = state.progress[player]
    if (progress >= CLOCK_STEPS || dart.sector !== clockTarget(progress)) return { state }
    const next = progress + 1
    return {
      state: { progress: state.progress.map((p, i) => (i === player ? next : p)) },
      note: next === CLOCK_STEPS - 1 ? { text: 'Plus que le bull pour {lanceur} !' } : undefined,
    }
  },

  isOut() {
    return false
  },

  winners(state) {
    const done = state.progress.findIndex((p) => p >= CLOCK_STEPS)
    return done === -1 ? null : [done]
  },

  view(state, player) {
    const progress = state.progress[player]
    return progress >= CLOCK_STEPS
      ? { primary: '✓', secondary: 'le tour est bouclé' }
      : { primary: targetLabel(clockTarget(progress)), secondary: `${progress} sur ${CLOCK_STEPS}` }
  },

  total(state, player) {
    return state.progress[player]
  },
}
