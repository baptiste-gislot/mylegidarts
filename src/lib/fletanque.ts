// Flétanque : la pétanque aux fléchettes. Deux équipes de deux, trois
// fléchettes chacun, et le cochonnet c'est le centre de la cible.
//
// Aucune fléchette n'est notée ici : ce sont les joueurs qui jugent à l'œil,
// après chaque lancer, quelle équipe est la plus proche. Le moteur suit le
// modèle de replay301 et replayPowers — une seule source de vérité, le journal
// des lancers et des décomptes, rejoué pour dériver tout l'état. L'annulation
// retire le dernier événement et tout le reste (main, fléchettes restantes,
// équipe qui ouvre) retombe juste tout seul.

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
 * Le journal d'une partie, dans l'ordre :
 * - `lance` : une fléchette partie, et l'équipe qui a le point une fois
 *   qu'elle s'est plantée (null = les deux meilleures sont à égalité) ;
 * - `mene` : la mène est close, le détenteur du point marque `points`
 *   (0 = mène nulle, personne ne marque et on rejoue).
 */
export type FletanqueEvent =
  | { kind: 'lance'; player: number; holder: Side | null }
  | { kind: 'mene'; points: number }

/** Une mène close : qui avait le point à la fin, et ce qu'elle a rapporté. */
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
  /** Fléchettes restantes de chaque joueur dans la mène en cours. */
  left: number[]
  /** Fléchettes lancées par chaque joueur depuis le début de la partie. */
  thrown: number[]
  /** Équipe qui tient le point (null = égalité, ou mène pas encore ouverte). */
  holder: Side | null
  /** true tant qu'aucune fléchette n'est partie dans la mène en cours. */
  opening: boolean
  /** Équipe à qui c'est le tour, null si on attend le décompte ou si c'est fini. */
  side: Side | null
  /** Joueur proposé au lancer : celui de `side` à qui il reste le plus de fléchettes. */
  thrower: number | null
  /** Issues possibles du prochain lancer, à proposer telles quelles. */
  outcomes: (Side | null)[]
  /** true quand les 12 fléchettes sont parties : la mène attend son décompte. */
  awaitingCount: boolean
  winner: Side | null
  finished: boolean
}

function freshDarts(): number[] {
  return Array.from({ length: PLAYERS_PER_MATCH }, () => DARTS_PER_PLAYER)
}

/**
 * Rejoue une partie de flétanque depuis son journal.
 *
 * Règles de pétanque reprises telles quelles : l'équipe qui n'a pas le point
 * relance jusqu'à le reprendre ; à égalité, c'est celle qui vient de lancer
 * qui rejoue ; une équipe à court de fléchettes laisse l'autre terminer ; le
 * vainqueur de la mène ouvre la suivante, et une mène nulle est rejouée par
 * la même équipe.
 */
export function replayFletanque(firstOpener: Side, journal: FletanqueEvent[]): FletanqueReplay {
  const scores: [number, number] = [0, 0]
  const menes: ClosedMene[] = []
  const thrown = Array.from({ length: PLAYERS_PER_MATCH }, () => 0)
  let opener = firstOpener
  let left = freshDarts()
  let holder: Side | null = null
  // Dernier lanceur de la mène en cours ; null tant qu'elle est vierge.
  let last: number | null = null

  for (const event of journal) {
    if (event.kind === 'lance') {
      if (left[event.player] > 0) left[event.player] -= 1
      thrown[event.player] += 1
      holder = event.holder
      last = event.player
      continue
    }
    menes.push({ holder, points: event.points })
    if (holder !== null && event.points > 0) {
      scores[holder] += event.points
      opener = holder
    }
    left = freshDarts()
    holder = null
    last = null
  }

  const winner = scores[0] >= TARGET_SCORE ? 0 : scores[1] >= TARGET_SCORE ? 1 : null
  const remaining = (side: Side) => teamPlayers(side).reduce((sum, p) => sum + left[p], 0)
  const awaitingCount = winner === null && remaining(0) + remaining(1) === 0

  let side: Side | null = null
  if (winner === null && !awaitingCount) {
    side =
      last === null
        ? opener // ouverture de mène
        : holder === null
          ? teamOf(last) // égalité : celle qui vient de lancer rejoue
          : otherSide(holder) // sinon, celle qui n'a pas le point
    // Équipe à court de fléchettes : l'autre termine la mène.
    if (remaining(side) === 0) side = otherSide(side)
  }

  const thrower =
    side === null
      ? null
      : (teamPlayers(side)
          .filter((p) => left[p] > 0)
          .sort((a, b) => left[b] - left[a] || a - b)[0] ?? null)

  // Ce que le prochain lancer peut changer : sa propre fléchette ne peut
  // jamais donner le point à l'adversaire, ni le retirer à sa propre équipe.
  const outcomes: (Side | null)[] =
    side === null
      ? []
      : last === null
        ? [side] // première fléchette de la mène : elle est seule, donc la plus proche
        : holder === null
          ? [side, null]
          : holder === side
            ? [side] // l'adversaire n'a plus de fléchette : rien ne peut bouger
            : [side, null, holder]

  return {
    scores,
    menes,
    opener,
    left,
    thrown,
    holder,
    opening: last === null,
    side,
    thrower,
    outcomes,
    awaitingCount,
    winner,
    finished: winner !== null,
  }
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
