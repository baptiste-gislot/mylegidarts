// Le niveau : une cote Elo par saison, recalculée depuis l'historique.
//
// Seules comptent les parties de défi 4 volées sans pouvoirs, à deux joueurs
// ou plus. Une partie se découpe en duels entre chaque paire de joueurs —
// le plus gros score gagne, l'égalité fait match nul — et l'enjeu d'un duel
// est divisé par le nombre d'adversaires : une partie à six ne fait pas
// bouger une cote plus qu'un duel. Rien n'est stocké : changer une règle,
// c'est juste recalculer.

import type { SessionStatRow } from './useLeague'

export const START_RATING = 1000
/** Enjeu maximal d'une partie pour un joueur. */
export const K_FACTOR = 32
/** En dessous, le niveau est provisoire et le joueur n'est pas encore classé. */
export const PROVISIONAL_GAMES = 5
/** La saison 1 : le quatrième trimestre 2026. */
export const FIRST_SEASON = '2026-T4'

export type RatedSession = Pick<
  SessionStatRow,
  'player_id' | 'match_id' | 'total' | 'created_at' | 'mode' | 'powers'
>

export interface Standing {
  playerId: string
  rating: number
  /** Parties jouées dans la saison. */
  games: number
  /** Bilan des duels de la saison. */
  wins: number
  draws: number
  losses: number
  /** Variation de cote lors de sa dernière partie. */
  lastDelta: number
  provisional: boolean
}

const parisMonth = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
})

/** Saison ('YYYY-Tn') d'une date ISO : le trimestre civil, à l'heure de Paris. */
export function seasonOf(iso: string): string {
  const [year, month] = parisMonth.format(new Date(iso)).split('-').map(Number)
  return `${year}-T${Math.ceil(month / 3)}`
}

function quarterIndex(season: string): number {
  const [year, quarter] = season.split('-T').map(Number)
  return year * 4 + quarter - 1
}

/** La saison qui précède (le trimestre d'avant). */
export function previousSeason(season: string): string {
  const index = quarterIndex(season) - 1
  return `${Math.floor(index / 4)}-T${(index % 4) + 1}`
}

/** Numéro de saison (1 = T4 2026) ; 0 pour un trimestre d'avant la ligue classée. */
export function seasonNumber(season: string): number {
  return Math.max(0, quarterIndex(season) - quarterIndex(FIRST_SEASON) + 1)
}

const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long' })

/** « Saison 1 · octobre à décembre 2026 ». */
export function seasonLabel(season: string): string {
  const [year, quarter] = season.split('-T').map(Number)
  const first = monthName.format(new Date(year, (quarter - 1) * 3, 1))
  const last = monthName.format(new Date(year, (quarter - 1) * 3 + 2, 1))
  return `Saison ${seasonNumber(season)} · ${first} à ${last} ${year}`
}

function counts(row: RatedSession): boolean {
  return row.mode === 'volees' && row.powers === null && row.match_id !== null
}

/** Saisons classées où au moins une partie compte, la plus récente d'abord. */
export function seasonsPlayed(rows: RatedSession[]): string[] {
  const seasons = new Set(rows.filter(counts).map((r) => seasonOf(r.created_at)))
  return [...seasons].filter((s) => seasonNumber(s) > 0).sort((a, b) => quarterIndex(b) - quarterIndex(a))
}

/** Classement de niveau d'une saison : les classés par cote, puis les provisoires. */
export function computeStandings(rows: RatedSession[], season: string): Standing[] {
  const matches = new Map<string, RatedSession[]>()
  for (const row of rows) {
    if (!counts(row) || seasonOf(row.created_at) !== season) continue
    const list = matches.get(row.match_id!) ?? []
    list.push(row)
    matches.set(row.match_id!, list)
  }

  const table = new Map<string, Standing>()
  const standing = (playerId: string) => {
    const existing = table.get(playerId)
    if (existing) return existing
    const fresh: Standing = {
      playerId,
      rating: START_RATING,
      games: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      lastDelta: 0,
      provisional: true,
    }
    table.set(playerId, fresh)
    return fresh
  }

  const chronological = [...matches.values()]
    .filter((sessions) => new Set(sessions.map((s) => s.player_id)).size >= 2)
    .map((sessions) => ({ sessions, at: sessions.reduce((min, s) => (s.created_at < min ? s.created_at : min), sessions[0].created_at) }))
    .sort((x, y) => x.at.localeCompare(y.at) || x.sessions[0].match_id!.localeCompare(y.sessions[0].match_id!))

  for (const { sessions } of chronological) {
    const players = sessions.map((s) => standing(s.player_id))
    // Toutes les cotes bougent ensemble, à partir de celles d'avant la partie.
    const before = players.map((p) => p.rating)
    const deltas = players.map(() => 0)
    const k = K_FACTOR / (players.length - 1)
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const expected = 1 / (1 + 10 ** ((before[j] - before[i]) / 400))
        const diff = sessions[i].total - sessions[j].total
        const score = diff > 0 ? 1 : diff < 0 ? 0 : 0.5
        deltas[i] += k * (score - expected)
        deltas[j] -= k * (score - expected)
        if (score === 1) {
          players[i].wins += 1
          players[j].losses += 1
        } else if (score === 0) {
          players[i].losses += 1
          players[j].wins += 1
        } else {
          players[i].draws += 1
          players[j].draws += 1
        }
      }
    }
    players.forEach((p, i) => {
      p.rating = before[i] + deltas[i]
      p.lastDelta = deltas[i]
      p.games += 1
      p.provisional = p.games < PROVISIONAL_GAMES
    })
  }

  return [...table.values()].sort(
    (a, b) => Number(a.provisional) - Number(b.provisional) || b.rating - a.rating || b.games - a.games,
  )
}
