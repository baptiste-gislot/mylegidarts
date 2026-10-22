// Le moteur commun des jeux au tour par tour (Cricket, Around the clock,
// Killer, Shanghai). Comme pour les pouvoirs, une seule source de vérité :
// la suite des fléchettes dans l'ordre où elles ont été lancées. Le moteur la
// rejoue pour savoir qui est à la cible, à quelle manche, qui est éliminé et
// qui a gagné ; chaque jeu ne fournit que ses règles. Annuler = retirer la
// dernière fléchette.

import { DARTS_PER_VOLLEY, type Dart } from './scoring'

/** Paramètres tirés au lancement de la partie. */
export interface TurnSetup {
  /** Killer : le numéro de chaque joueur. */
  numbers?: number[]
  /** Shanghai : le numéro visé à chaque manche. */
  targets?: number[]
}

export interface ThrowContext {
  player: number
  dart: Dart
  /** Manche en cours, à partir de 0. */
  round: number
  /** Fléchettes de la volée en cours, celle-ci comprise. */
  volley: Dart[]
}

/**
 * Ce que l'annonceur peut dire d'une fléchette. `{lanceur}` et `{cible}`
 * sont remplacés par les noms des joueurs concernés.
 */
export interface TurnNote {
  text: string
  target?: number
}

/** Ce que le tableau affiche d'un joueur. */
export interface PlayerView {
  primary: string
  secondary: string
}

export interface TurnRules<S> {
  /** Manches au-delà desquelles la partie se règle aux points ; null = sans limite. */
  maxRounds: number | null
  minPlayers: number
  init(players: number, setup: TurnSetup): S
  /** Applique une fléchette ; `note` est ce que l'annonceur peut en dire. */
  apply(state: S, ctx: ThrowContext): { state: S; note?: TurnNote }
  /** Joueur éliminé : il ne lance plus. */
  isOut(state: S, player: number): boolean
  /** Vainqueurs si la partie est terminée, sinon null (`roundsOver` : limite atteinte). */
  winners(state: S, roundsOver: boolean): number[] | null
  view(state: S, player: number): PlayerView
  /** Score de partie enregistré pour un joueur. */
  total(state: S, player: number): number
}

export interface TurnReplay<S> {
  state: S
  /** Joueur à la cible, null une fois la partie terminée. */
  current: number | null
  round: number
  /** Fléchettes déjà lancées dans la volée en cours. */
  volley: Dart[]
  dartsByPlayer: Dart[][]
  finished: boolean
  winners: number[]
  /** Ce qu'a provoqué la dernière fléchette, pour l'annonceur. */
  lastNote: TurnNote | null
  /** true si la dernière fléchette a clos une volée (la main passe). */
  volleyClosed: boolean
  /** La dernière volée achevée, pour la laisser lisible quand la main passe. */
  lastVolley: { player: number; darts: Dart[] } | null
}

export function replayTurnGame<S>(
  rules: TurnRules<S>,
  players: number,
  setup: TurnSetup,
  journal: Dart[],
): TurnReplay<S> {
  let state = rules.init(players, setup)
  const dartsByPlayer: Dart[][] = Array.from({ length: players }, () => [])
  let current = 0
  let round = 0
  let volley: Dart[] = []
  let winners: number[] | null = null
  let lastNote: TurnNote | null = null
  let volleyClosed = false
  let lastVolley: { player: number; darts: Dart[] } | null = null

  const nextAlive = (from: number): number | null => {
    for (let step = 1; step <= players; step++) {
      const candidate = (from + step) % players
      if (!rules.isOut(state, candidate)) return candidate
    }
    return null
  }

  for (const dart of journal) {
    if (winners !== null) break
    volley = [...volley, dart]
    const result = rules.apply(state, { player: current, dart, round, volley })
    state = result.state
    lastNote = result.note ?? null
    dartsByPlayer[current].push(dart)
    volleyClosed = false

    winners = rules.winners(state, false)
    if (winners !== null) break

    // La main passe au bout de trois fléchettes, ou tout de suite si le
    // lanceur vient de s'éliminer lui-même.
    if (volley.length === DARTS_PER_VOLLEY || rules.isOut(state, current)) {
      volleyClosed = true
      lastVolley = { player: current, darts: volley }
      volley = []
      const next = nextAlive(current)
      if (next === null) {
        winners = rules.winners(state, true) ?? []
        break
      }
      if (next <= current) round += 1
      current = next
      if (rules.maxRounds !== null && round >= rules.maxRounds) {
        winners = rules.winners(state, true) ?? []
        break
      }
    }
  }

  const finished = winners !== null
  return {
    state,
    current: finished ? null : current,
    round,
    volley: finished ? [] : volley,
    dartsByPlayer,
    finished,
    winners: winners ?? [],
    lastNote,
    volleyClosed,
    lastVolley,
  }
}

/** Les joueurs en tête d'un critère : plusieurs en cas d'égalité. */
export function leaders(values: number[], eligible: (player: number) => boolean = () => true): number[] {
  const candidates = values.map((value, player) => ({ value, player })).filter((c) => eligible(c.player))
  const best = Math.max(...candidates.map((c) => c.value))
  return candidates.filter((c) => c.value === best).map((c) => c.player)
}
