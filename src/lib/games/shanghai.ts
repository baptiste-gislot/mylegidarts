// Shanghai : sept manches, la manche n vise le numéro n et seules ses
// fléchettes marquent. Simple, double et triple du numéro dans la même
// volée font un « Shanghai » : victoire immédiate. Sinon, le plus de points
// au bout des sept manches l'emporte.

import { dartValue } from '../scoring'
import { leaders, type TurnRules } from '../turnGames'

export const SHANGHAI_ROUNDS = 7

export interface ShanghaiState {
  points: number[]
  /** Auteur d'un Shanghai, qui termine la partie sur-le-champ. */
  shanghai: number | null
}

export const shanghaiRules: TurnRules<ShanghaiState> = {
  maxRounds: SHANGHAI_ROUNDS,
  minPlayers: 1,

  init(players) {
    return { points: Array.from({ length: players }, () => 0), shanghai: null }
  },

  apply(state, { player, dart, round, volley }) {
    const target = round + 1
    if (dart.sector !== target) return { state }
    const points = state.points.map((p, i) => (i === player ? p + dartValue(dart) : p))
    const onTarget = volley.filter((d) => d.sector === target)
    const shanghai = [1, 2, 3].every((mult) => onTarget.some((d) => d.mult === mult))
    return {
      state: { points, shanghai: shanghai ? player : state.shanghai },
      note: shanghai ? { text: 'Shanghai ! {lanceur} rafle tout !' } : undefined,
    }
  },

  isOut() {
    return false
  },

  winners(state, roundsOver) {
    if (state.shanghai !== null) return [state.shanghai]
    return roundsOver ? leaders(state.points) : null
  },

  view(state, player) {
    return { primary: `${state.points[player]}`, secondary: 'points' }
  },

  total(state, player) {
    return state.points[player]
  },
}
