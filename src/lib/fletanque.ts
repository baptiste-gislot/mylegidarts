// Flétanque : la pétanque aux fléchettes. Deux équipes de deux, trois
// fléchettes chacun, et le cochonnet c'est le centre de la cible.
//
// Aucune fléchette n'est notée ici : les quatre joueurs tirent toute leur
// main, puis jugent à l'œil quelle équipe prend la mène et combien de ses
// fléchettes sont devant. Le journal ne contient que ces décomptes, rejoués
// pour dériver tout l'état — l'annulation retire le dernier et le score,
// l'équipe qui ouvre et le vainqueur retombent juste tout seuls.

/** Les deux équipes : 0 = A, 1 = B. */
export type Side = 0 | 1

export const TEAM_SIZE = 2
export const PLAYERS_PER_MATCH = 4
export const DARTS_PER_PLAYER = 3
export const DARTS_PER_TEAM = TEAM_SIZE * DARTS_PER_PLAYER
/** Premier à 5 points : la partie s'arrête là. */
export const TARGET_SCORE = 5

export const SIDE_LABEL: Record<Side, string> = { 0: 'Équipe A', 1: 'Équipe B' }

/** Équipe d'un joueur : les deux premiers de l'ordre de passage forment l'équipe A. */
export function teamOf(player: number): Side {
  return player < TEAM_SIZE ? 0 : 1
}

/** Index (dans l'ordre de passage) des deux joueurs d'une équipe. */
export function teamPlayers(side: Side): number[] {
  return side === 0 ? [0, 1] : [2, 3]
}

export function otherSide(side: Side): Side {
  return side === 0 ? 1 : 0
}

/**
 * Le décompte d'une mène, saisi une fois les 12 fléchettes parties : l'équipe
 * qui la prend et ses fléchettes devant (holder null, points 0 = mène nulle,
 * personne ne marque et on rejoue).
 */
export interface FletanqueEvent {
  kind: 'mene'
  holder: Side | null
  points: number
}

/** Une mène close : qui l'a prise, et ce qu'elle a rapporté. */
export interface ClosedMene {
  holder: Side | null
  points: number
}

export interface FletanqueReplay {
  scores: [number, number]
  /** Mènes closes, dans l'ordre. */
  menes: ClosedMene[]
  /** Équipe qui ouvre la mène en cours (le vainqueur de la précédente). */
  opener: Side
  /** Fléchettes lancées par chaque joueur depuis le début de la partie. */
  thrown: number[]
  winner: Side | null
  finished: boolean
}

/**
 * Rejoue une partie de flétanque depuis son journal.
 *
 * Le vainqueur de la mène ouvre la suivante, et une mène nulle est rejouée
 * par la même équipe. Chaque mène close compte les trois fléchettes de
 * chacun : tout le monde tire toute sa main avant le décompte.
 */
export function replayFletanque(firstOpener: Side, journal: FletanqueEvent[]): FletanqueReplay {
  const scores: [number, number] = [0, 0]
  const menes: ClosedMene[] = []
  let opener = firstOpener

  for (const { holder, points } of journal) {
    if (holder === null || points <= 0) {
      menes.push({ holder: null, points: 0 })
      continue
    }
    menes.push({ holder, points })
    scores[holder] += points
    opener = holder
  }

  const winner = scores[0] >= TARGET_SCORE ? 0 : scores[1] >= TARGET_SCORE ? 1 : null
  return {
    scores,
    menes,
    opener,
    thrown: Array.from({ length: PLAYERS_PER_MATCH }, () => menes.length * DARTS_PER_PLAYER),
    winner,
    finished: winner !== null,
  }
}

/**
 * Convertit un journal enregistré avant la saisie en fin de mène (un événement
 * par fléchette) : chaque décompte reprend l'équipe qui tenait le point.
 */
export function migrateFletanqueJournal(journal: unknown[]): FletanqueEvent[] {
  const events: FletanqueEvent[] = []
  let holder: Side | null = null
  for (const raw of journal) {
    const event = raw as { kind?: string; holder?: Side | null; points?: number }
    if (event.kind === 'lance') {
      holder = event.holder ?? null
    } else if (event.kind === 'mene') {
      const meneHolder = event.holder !== undefined ? event.holder : holder
      events.push({ kind: 'mene', holder: meneHolder, points: event.points ?? 0 })
      holder = null
    }
  }
  return events
}

/** Points possibles au décompte d'une mène : de 1 à 6 fléchettes devant. */
export const POINTS_OPTIONS = Array.from({ length: DARTS_PER_TEAM }, (_, i) => i + 1)

/** Tirage au sort de l'équipe qui ouvre la première mène. */
export function drawOpener(): Side {
  const random = new Uint32Array(1)
  crypto.getRandomValues(random)
  return (random[0] % 2) as Side
}

/** Résumé persisté en base (jsonb `sessions.fletanque`, une ligne par joueur). */
export interface SessionFletanque {
  team: Side
  /** Fléchettes lancées par ce joueur sur toute la partie. */
  thrown: number
  /** Déroulé des mènes — identique sur les quatre lignes d'une même partie. */
  menes: ClosedMene[]
}

export function sessionFletanque(replay: FletanqueReplay): SessionFletanque[] {
  return Array.from({ length: PLAYERS_PER_MATCH }, (_, player) => ({
    team: teamOf(player),
    thrown: replay.thrown[player],
    menes: replay.menes,
  }))
}
