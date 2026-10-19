// Les jeux au tour par tour, tels que l'app les présente : nom, règle en une
// phrase, et comment lire le score enregistré. Les règles elles-mêmes vivent
// dans lib/games/, le moteur dans lib/turnGames.

import { CLOCK_STEPS, clockRules, clockTarget } from './games/aroundTheClock'
import { cricketRules } from './games/cricket'
import { killerRules } from './games/killer'
import { shanghaiRules } from './games/shanghai'
import type { Dart } from './scoring'
import { replayTurnGame, type PlayerView, type TurnReplay, type TurnRules, type TurnSetup } from './turnGames'

export const TURN_GAME_IDS = ['cricket', 'clock', 'killer', 'shanghai'] as const
export type TurnGameId = (typeof TURN_GAME_IDS)[number]

export interface TurnGameEntry {
  label: string
  /** La règle en une phrase, sous le choix du jeu. */
  pitch: string
  minPlayers: number
  replay: (players: number, setup: TurnSetup, journal: Dart[]) => TurnReplay<unknown>
  view: (state: unknown, player: number) => PlayerView
  total: (state: unknown, player: number) => number
  /** Le score enregistré, tel qu'on le lit dans l'historique. */
  totalLabel: (total: number) => string
}

function bind<S>(rules: TurnRules<S>) {
  return {
    minPlayers: rules.minPlayers,
    replay: (players: number, setup: TurnSetup, journal: Dart[]) =>
      replayTurnGame(rules, players, setup, journal) as TurnReplay<unknown>,
    view: (state: unknown, player: number) => rules.view(state as S, player),
    total: (state: unknown, player: number) => rules.total(state as S, player),
  }
}

const points = (total: number) => `${total} pt${total > 1 ? 's' : ''}`

export const TURN_GAMES: Record<TurnGameId, TurnGameEntry> = {
  cricket: {
    label: 'Cricket',
    pitch: 'Fermez 15 à 20 et le bull, marquez sur ce que les autres n’ont pas fermé. 20 volées maximum.',
    ...bind(cricketRules),
    totalLabel: points,
  },
  clock: {
    label: 'Around the clock',
    pitch: 'De 1 à 20 dans l’ordre, puis le bull. Le premier qui boucle le tour gagne.',
    ...bind(clockRules),
    totalLabel: (total) =>
      total >= CLOCK_STEPS ? 'tour bouclé' : `arrêté au ${clockTarget(total) === 25 ? 'bull' : clockTarget(total)}`,
  },
  killer: {
    label: 'Killer',
    pitch: 'Un numéro chacun, 3 vies. Touchez votre double pour devenir killer, puis visez les doubles des autres.',
    ...bind(killerRules),
    totalLabel: (total) => (total === 0 ? 'éliminé' : `${total} vie${total > 1 ? 's' : ''}`),
  },
  shanghai: {
    label: 'Shanghai',
    pitch: 'Sept manches, une par numéro. Simple, double et triple dans la même volée : victoire immédiate.',
    ...bind(shanghaiRules),
    totalLabel: points,
  },
}

export function isTurnGame(mode: string): mode is TurnGameId {
  return (TURN_GAME_IDS as readonly string[]).includes(mode)
}
