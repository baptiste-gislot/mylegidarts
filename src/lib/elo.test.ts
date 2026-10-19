import { describe, expect, it } from 'vitest'
import {
  FIRST_SEASON,
  K_FACTOR,
  PROVISIONAL_GAMES,
  START_RATING,
  computeStandings,
  seasonLabel,
  seasonNumber,
  seasonOf,
  seasonsPlayed,
  type RatedSession,
} from './elo'

let seq = 0
/** Une partie de défi : les totaux de chacun, à une date donnée. */
function match(date: string, totals: Record<string, number>, extra: Partial<RatedSession> = {}): RatedSession[] {
  const matchId = `m${++seq}`
  return Object.entries(totals).map(([player, total]) => ({
    player_id: player,
    match_id: matchId,
    total,
    created_at: date,
    mode: 'volees',
    powers: null,
    ...extra,
  }))
}

const byId = (standings: ReturnType<typeof computeStandings>) =>
  Object.fromEntries(standings.map((s) => [s.playerId, s]))

describe('saisons', () => {
  it('range une date dans son trimestre, à l’heure de Paris', () => {
    expect(seasonOf('2026-10-19T10:00:00Z')).toBe('2026-T4')
    expect(seasonOf('2027-01-01T08:00:00Z')).toBe('2027-T1')
    // 31 décembre 23h30 UTC = déjà le 1er janvier à Paris.
    expect(seasonOf('2026-12-31T23:30:00Z')).toBe('2027-T1')
  })

  it('numérote les saisons à partir du quatrième trimestre 2026', () => {
    expect(FIRST_SEASON).toBe('2026-T4')
    expect(seasonNumber('2026-T4')).toBe(1)
    expect(seasonNumber('2027-T1')).toBe(2)
    expect(seasonNumber('2028-T1')).toBe(6)
    expect(seasonNumber('2026-T3')).toBe(0)
  })

  it('nomme une saison avec ses mois', () => {
    expect(seasonLabel('2026-T4')).toBe('Saison 1 · octobre à décembre 2026')
  })

  it('liste les saisons jouées, la plus récente d’abord, sans celles d’avant la première', () => {
    const rows = [
      ...match('2026-09-10T10:00:00Z', { a: 100, b: 90 }),
      ...match('2026-10-10T10:00:00Z', { a: 100, b: 90 }),
      ...match('2027-02-10T10:00:00Z', { a: 100, b: 90 }),
    ]
    expect(seasonsPlayed(rows)).toEqual(['2027-T1', '2026-T4'])
  })
})

describe('computeStandings', () => {
  const S = '2026-T4'
  const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}T12:00:00Z`

  it('fait gagner au vainqueur ce que perd le vaincu, à cote égale', () => {
    const table = byId(computeStandings(match(day(1), { a: 200, b: 150 }), S))
    expect(table.a.rating).toBeCloseTo(START_RATING + K_FACTOR / 2)
    expect(table.b.rating).toBeCloseTo(START_RATING - K_FACTOR / 2)
    expect(table.a.wins).toBe(1)
    expect(table.b.losses).toBe(1)
  })

  it('compte une égalité de score comme un match nul', () => {
    const table = byId(computeStandings(match(day(1), { a: 150, b: 150 }), S))
    expect(table.a.rating).toBe(START_RATING)
    expect(table.a.draws).toBe(1)
  })

  it('découpe une partie à plusieurs en duels, sans dépasser l’enjeu d’un duel', () => {
    const table = byId(computeStandings(match(day(1), { a: 300, b: 200, c: 100 }), S))
    // a bat b et c : deux duels à K/2 chacun, soit K/2 au total.
    expect(table.a.rating).toBeCloseTo(START_RATING + K_FACTOR / 2)
    expect(table.b.rating).toBeCloseTo(START_RATING)
    expect(table.c.rating).toBeCloseTo(START_RATING - K_FACTOR / 2)
    expect(table.b.wins).toBe(1)
    expect(table.b.losses).toBe(1)
  })

  it('rapporte moins en battant un joueur plus faible', () => {
    const rows = [
      ...match(day(1), { a: 200, b: 100 }),
      ...match(day(2), { a: 200, b: 100 }),
    ]
    const table = byId(computeStandings(rows, S))
    expect(table.a.lastDelta).toBeLessThan(K_FACTOR / 2)
    expect(table.a.lastDelta).toBeGreaterThan(0)
  })

  it('ignore les pouvoirs, les autres jeux, les parties solo et les autres saisons', () => {
    const rows: RatedSession[] = [
      ...match(day(1), { a: 200, b: 100 }, { powers: { power: 'controle', used: true, bonus: 10, volleySizes: [3, 3, 3, 3] } }),
      ...match(day(2), { a: 200, b: 100 }, { mode: '301' }),
      ...match(day(3), { a: 200 }),
      ...match('2027-01-05T12:00:00Z', { a: 200, b: 100 }),
      { player_id: 'a', match_id: null, total: 200, created_at: day(4), mode: 'volees', powers: null },
    ]
    expect(computeStandings(rows, S)).toEqual([])
  })

  it('repart de la même cote à chaque saison', () => {
    const rows = [
      ...match(day(1), { a: 200, b: 100 }),
      ...match('2027-01-05T12:00:00Z', { a: 100, b: 200 }),
    ]
    const winter = byId(computeStandings(rows, '2027-T1'))
    expect(winter.b.rating).toBeCloseTo(START_RATING + K_FACTOR / 2)
  })

  it('rejoue les parties dans l’ordre chronologique, quel que soit l’ordre reçu', () => {
    const rows = [
      ...match(day(1), { a: 200, b: 100 }),
      ...match(day(2), { a: 100, b: 200 }),
      ...match(day(3), { a: 200, b: 100 }),
    ]
    expect(computeStandings([...rows].reverse(), S)).toEqual(computeStandings(rows, S))
  })

  it('marque provisoire un joueur sous les cinq parties et le classe après les autres', () => {
    const rows = [
      ...Array.from({ length: PROVISIONAL_GAMES }, (_, i) => match(day(i + 1), { a: 100, b: 200 })).flat(),
      ...match(day(20), { c: 300, a: 50 }),
    ]
    const standings = computeStandings(rows, S)
    expect(standings.map((s) => [s.playerId, s.provisional])).toEqual([
      ['b', false],
      ['a', false],
      ['c', true],
    ])
    expect(byId(standings).a.games).toBe(PROVISIONAL_GAMES + 1)
  })
})
