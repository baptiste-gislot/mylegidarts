// Killer : chacun reçoit un numéro tiré au sort. On devient killer en
// touchant le double de son propre numéro ; ensuite, toucher le double d'un
// adversaire l'élimine. Un killer qui touche son propre double s'élimine.
// Le dernier en vie gagne.

import { shuffle } from '../random'
import type { TurnRules } from '../turnGames'

export const KILLER_LIVES = 1

export interface KillerState {
  numbers: number[]
  lives: number[]
  killer: boolean[]
}

/** Numéros distincts tirés au sort, un par joueur. */
export function drawKillerNumbers(players: number): number[] {
  return shuffle(Array.from({ length: 20 }, (_, i) => i + 1)).slice(0, players)
}

export const killerRules: TurnRules<KillerState> = {
  maxRounds: null,
  minPlayers: 2,

  init(players, setup) {
    const numbers = setup.numbers ?? Array.from({ length: players }, (_, i) => i + 1)
    return {
      numbers,
      lives: numbers.map(() => KILLER_LIVES),
      killer: numbers.map(() => false),
    }
  },

  apply(state, { player, dart }) {
    if (dart.mult !== 2) return { state }
    const owner = state.numbers.indexOf(dart.sector)
    if (owner === -1 || state.lives[owner] === 0) return { state }

    if (owner === player && !state.killer[player]) {
      return {
        state: { ...state, killer: state.killer.map((k, i) => k || i === player) },
        note: { text: '{lanceur} devient killer !' },
      }
    }
    if (owner !== player && !state.killer[player]) return { state }

    const lives = state.lives.map((l, i) => (i === owner ? l - 1 : l))
    const text = owner === player ? '{lanceur} se tire dessus et s’élimine !' : '{lanceur} élimine {cible} !'
    return { state: { ...state, lives }, note: { text, target: owner } }
  },

  isOut(state, player) {
    return state.lives[player] === 0
  },

  winners(state) {
    const alive = state.lives.flatMap((l, i) => (l > 0 ? [i] : []))
    return alive.length <= 1 ? alive : null
  },

  view(state, player) {
    const lives = state.lives[player]
    return {
      primary: lives === 0 ? '✕' : '♥'.repeat(lives),
      secondary: `numéro ${state.numbers[player]}${state.killer[player] ? ' · killer' : ''}`,
    }
  },

  total(state, player) {
    return state.lives[player]
  },
}
