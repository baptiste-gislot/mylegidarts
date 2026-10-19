// Le moteur des tournois : poules, puis tableau à élimination directe.
//
// Rien n'est stocké en cours de route : le tournoi garde sa composition, ses
// forfaits et ses morts subites, et tout le reste (classements de poule,
// qualifiés, tableau, champion) se rejoue depuis les parties rattachées à
// chaque rencontre. Supprimer une partie remet simplement la rencontre en jeu.

import type { GameMode } from './useLeague'

export const TOURNAMENT_MODES = ['volees', '301', 'cricket', 'clock', 'killer', 'shanghai'] as const
export type TournamentMode = (typeof TOURNAMENT_MODES)[number]

export const MIN_TOURNAMENT_PLAYERS = 4
export const QUALIFIERS_PER_POOL = 2
/** Jusqu'à ce nombre, une seule poule ; au-delà, des poules de 3 ou 4. */
const SINGLE_POOL_MAX = 5
const POOL_TARGET = 4

export interface Tiebreak {
  winner: string
  /** Totaux des volées de mort subite, dans l'ordre (joueur a, joueur b). */
  volleys: [number, number][]
}

export interface TournamentDef {
  id: string
  mode: TournamentMode
  pools: string[][]
  forfeits: string[]
  tiebreaks: Record<string, Tiebreak>
}

/** Une partie jouée pour le tournoi (une ligne par joueur). */
export interface TournamentSession {
  player_id: string
  total: number
  won: boolean | null
  tournament_slot: string | null
  created_at: string
}

export type RencontreStatus =
  /** Les joueurs ne sont pas encore connus (tour suivant du tableau). */
  | 'attente'
  | 'a_jouer'
  | 'jouee'
  | 'forfait'
  /** Pas d'adversaire : le joueur passe d'office. */
  | 'exempt'
  /** Égalité au tableau : une mort subite doit trancher. */
  | 'mort_subite'

export interface Rencontre {
  slot: string
  a: string | null
  b: string | null
  status: RencontreStatus
  /** null avec le statut « jouee » : match nul (en poule seulement). */
  winner: string | null
  scores: { a: number; b: number } | null
}

export interface PoolLine {
  player: string
  played: number
  wins: number
  draws: number
  losses: number
  /** 1 par victoire, ½ par nul. */
  points: number
  /** Somme des scores de partie, premier départage. */
  scored: number
  forfeit: boolean
}

export interface PoolView {
  index: number
  rencontres: Rencontre[]
  standings: PoolLine[]
  complete: boolean
}

export interface BracketRound {
  /** Tour à partir de 1. */
  round: number
  rencontres: Rencontre[]
}

export interface TournamentView {
  pools: PoolView[]
  poolsComplete: boolean
  /** Tableau, vide tant que les poules ne sont pas finies. */
  bracket: BracketRound[]
  champion: string | null
  finished: boolean
}

// ---------- Composition ----------

/** Tailles des poules pour n joueurs : une seule jusqu'à 5, sinon des poules de 3 ou 4. */
export function poolSizes(players: number): number[] {
  if (players <= SINGLE_POOL_MAX) return [players]
  const count = Math.ceil(players / POOL_TARGET)
  const base = Math.floor(players / count)
  const extra = players % count
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0))
}

/**
 * Ordre des têtes de série : les joueurs cotés la saison précédente par
 * niveau décroissant, puis les autres dans un ordre tiré au sort.
 */
export function seedOrder(players: string[], ratings: Map<string, number>, random: () => number): string[] {
  const rated = players.filter((p) => ratings.has(p)).sort((x, y) => ratings.get(y)! - ratings.get(x)!)
  const unrated = players.filter((p) => !ratings.has(p))
  for (let i = unrated.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[unrated[i], unrated[j]] = [unrated[j], unrated[i]]
  }
  return [...rated, ...unrated]
}

/** Répartit les têtes de série en serpentin : A B C, C B A, A B C… */
export function drawPools(seeded: string[]): string[][] {
  const count = poolSizes(seeded.length).length
  const pools: string[][] = Array.from({ length: count }, () => [])
  seeded.forEach((player, i) => {
    const row = Math.floor(i / count)
    const col = row % 2 === 0 ? i % count : count - 1 - (i % count)
    pools[col].push(player)
  })
  return pools
}

// ---------- Rencontres ----------

export function poolSlot(pool: number, a: string, b: string): string {
  return `p${pool}:${[a, b].sort().join(':')}`
}

export function bracketSlot(round: number, index: number): string {
  return `t${round}:${index}`
}

/** Hasard reproductible : le même tournoi départage toujours de la même façon. */
function drawKey(tournamentId: string, player: string): number {
  let hash = 2166136261
  for (const char of `${tournamentId}:${player}`) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Résultat d'une rencontre jouée : la dernière partie de chacun sur ce créneau. */
function playedResult(
  mode: GameMode,
  sessions: TournamentSession[],
  a: string,
  b: string,
): { winner: string | null; scores: { a: number; b: number } } | null {
  const latest = (player: string) =>
    sessions
      .filter((s) => s.player_id === player)
      .sort((x, y) => y.created_at.localeCompare(x.created_at))[0]
  const sa = latest(a)
  const sb = latest(b)
  if (!sa || !sb) return null
  const scores = { a: sa.total, b: sb.total }
  if (mode === 'volees') {
    return { winner: sa.total > sb.total ? a : sb.total > sa.total ? b : null, scores }
  }
  const winner = sa.won && !sb.won ? a : sb.won && !sa.won ? b : null
  return { winner, scores }
}

function settle(
  def: TournamentDef,
  slot: string,
  a: string | null,
  b: string | null,
  bySlot: Map<string, TournamentSession[]>,
  knockout: boolean,
): Rencontre {
  const base = { slot, a, b, scores: null }
  if (a === null || b === null) return { ...base, status: 'attente', winner: null }

  const played = playedResult(def.mode, bySlot.get(slot) ?? [], a, b)
  if (played) {
    if (played.winner !== null || !knockout) {
      return { ...base, status: 'jouee', winner: played.winner, scores: played.scores }
    }
    const tiebreak = def.tiebreaks[slot]
    if (tiebreak && (tiebreak.winner === a || tiebreak.winner === b)) {
      return { ...base, status: 'jouee', winner: tiebreak.winner, scores: played.scores }
    }
    return { ...base, status: 'mort_subite', winner: null, scores: played.scores }
  }

  const outA = def.forfeits.includes(a)
  const outB = def.forfeits.includes(b)
  if (outA || outB) {
    return { ...base, status: 'forfait', winner: outA && outB ? null : outA ? b : a }
  }
  return { ...base, status: 'a_jouer', winner: null }
}

/** Positions des têtes de série dans un tableau de `size` : 1 contre size, 2 contre size-1… */
export function bracketPositions(size: number): number[] {
  let positions = [1]
  while (positions.length < size) {
    const width = positions.length * 2 + 1
    positions = positions.flatMap((seed) => [seed, width - seed])
  }
  return positions
}

/** Nom d'un tour du tableau, compté depuis la finale. */
export function roundLabel(round: number, rounds: number): string {
  const fromEnd = rounds - round
  if (fromEnd === 0) return 'Finale'
  if (fromEnd === 1) return 'Demi-finales'
  if (fromEnd === 2) return 'Quarts de finale'
  if (fromEnd === 3) return 'Huitièmes de finale'
  return `Tour ${round}`
}

// ---------- Rejeu ----------

export function replayTournament(def: TournamentDef, sessions: TournamentSession[]): TournamentView {
  const bySlot = new Map<string, TournamentSession[]>()
  for (const s of sessions) {
    if (!s.tournament_slot) continue
    const list = bySlot.get(s.tournament_slot) ?? []
    list.push(s)
    bySlot.set(s.tournament_slot, list)
  }

  const pools: PoolView[] = def.pools.map((members, index) => {
    const rencontres: Rencontre[] = []
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        rencontres.push(settle(def, poolSlot(index, members[i], members[j]), members[i], members[j], bySlot, false))
      }
    }

    const lines = new Map<string, PoolLine>(
      members.map((player) => [
        player,
        { player, played: 0, wins: 0, draws: 0, losses: 0, points: 0, scored: 0, forfeit: def.forfeits.includes(player) },
      ]),
    )
    for (const r of rencontres) {
      if (r.status !== 'jouee' && r.status !== 'forfait') continue
      const la = lines.get(r.a!)!
      const lb = lines.get(r.b!)!
      la.played += 1
      lb.played += 1
      if (r.scores) {
        la.scored += r.scores.a
        lb.scored += r.scores.b
      }
      if (r.winner === null) {
        la.draws += 1
        lb.draws += 1
      } else {
        const [win, lose] = r.winner === r.a ? [la, lb] : [lb, la]
        win.wins += 1
        lose.losses += 1
      }
    }
    for (const line of lines.values()) line.points = line.wins + line.draws / 2

    const direct = (x: string, y: string) =>
      rencontres.find((r) => r.status === 'jouee' && ((r.a === x && r.b === y) || (r.a === y && r.b === x)))?.winner
    const standings = [...lines.values()].sort((x, y) => {
      if (x.forfeit !== y.forfeit) return Number(x.forfeit) - Number(y.forfeit)
      if (y.points !== x.points) return y.points - x.points
      if (y.scored !== x.scored) return y.scored - x.scored
      const duel = direct(x.player, y.player)
      if (duel === x.player) return -1
      if (duel === y.player) return 1
      return drawKey(def.id, x.player) - drawKey(def.id, y.player)
    })

    return {
      index,
      rencontres,
      standings,
      complete: rencontres.every((r) => r.status === 'jouee' || r.status === 'forfait'),
    }
  })

  const poolsComplete = pools.every((p) => p.complete)
  if (!poolsComplete) return { pools, poolsComplete, bracket: [], champion: null, finished: false }

  // Les qualifiés : tous les premiers de poule, puis tous les deuxièmes,
  // chaque rang classé entre poules aux points puis aux points marqués.
  const qualifiers: string[] = []
  for (let rank = 0; rank < QUALIFIERS_PER_POOL; rank++) {
    const atRank = pools
      .map((p) => p.standings[rank])
      .filter((line): line is PoolLine => line !== undefined && !line.forfeit)
      .sort((x, y) => y.points - x.points || y.scored - x.scored || drawKey(def.id, x.player) - drawKey(def.id, y.player))
    qualifiers.push(...atRank.map((line) => line.player))
  }

  if (qualifiers.length < 2) {
    const champion = qualifiers[0] ?? null
    return { pools, poolsComplete, bracket: [], champion, finished: champion !== null }
  }

  const size = 2 ** Math.ceil(Math.log2(qualifiers.length))
  const rounds = Math.log2(size)
  const positions = bracketPositions(size)
  const seedAt = (position: number): string | null => qualifiers[position - 1] ?? null

  // Premier tour : deux joueurs d'une même poule ne se retrouvent pas
  // d'emblée — on échange un deuxième de poule avec celui d'une autre
  // rencontre quand ça règle le conflit sans en créer un autre.
  const poolOf = new Map(def.pools.flatMap((members, i) => members.map((p) => [p, i] as const)))
  const seats = positions.map(seedAt)
  const clash = (x: string | null, y: string | null) =>
    x !== null && y !== null && poolOf.get(x) === poolOf.get(y)
  for (let i = 0; i < seats.length; i += 2) {
    if (!clash(seats[i], seats[i + 1])) continue
    for (let j = 0; j < seats.length; j += 2) {
      // Jamais avec une case vide : les exemptions restent aux meilleurs.
      if (j === i || seats[j] === null || seats[j + 1] === null) continue
      if (!clash(seats[i], seats[j + 1]) && !clash(seats[j], seats[i + 1])) {
        ;[seats[i + 1], seats[j + 1]] = [seats[j + 1], seats[i + 1]]
        break
      }
    }
  }

  // Chaque case du tableau : le joueur qui y arrive, et si elle est
  // définitive (une case vide définitive vaut exemption pour l'adversaire).
  const bracket: BracketRound[] = []
  let entrants = seats.map((player) => ({ player, settled: true }))
  for (let round = 1; round <= rounds; round++) {
    const rencontres: Rencontre[] = []
    for (let i = 0; i < entrants.length; i += 2) {
      const [x, y] = [entrants[i], entrants[i + 1]]
      const slot = bracketSlot(round, i / 2)
      const a = x.player
      const b = y.player
      if (x.settled && y.settled && (a === null || b === null)) {
        // Exemption, ou rencontre vidée par un double forfait.
        rencontres.push({ slot, a, b, status: a === null && b === null ? 'forfait' : 'exempt', winner: a ?? b, scores: null })
      } else {
        rencontres.push(settle(def, slot, a, b, bySlot, true))
      }
    }
    bracket.push({ round, rencontres })
    entrants = rencontres.map((r) => ({
      player: r.winner,
      settled: r.status === 'jouee' || r.status === 'forfait' || r.status === 'exempt',
    }))
  }

  const final = bracket[bracket.length - 1].rencontres[0]
  const champion = final.status === 'jouee' || final.status === 'forfait' ? final.winner : null
  return { pools, poolsComplete, bracket, champion, finished: champion !== null }
}

/** Les rencontres qu'on peut lancer maintenant, poules puis tableau. */
export function playableRencontres(view: TournamentView): Rencontre[] {
  return [...view.pools.flatMap((p) => p.rencontres), ...view.bracket.flatMap((r) => r.rencontres)].filter(
    (r) => r.status === 'a_jouer',
  )
}
