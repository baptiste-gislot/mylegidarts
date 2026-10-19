import { describe, expect, it } from 'vitest'
import {
  bracketPositions,
  bracketSlot,
  drawPools,
  playableRencontres,
  poolSizes,
  poolSlot,
  replayTournament,
  roundLabel,
  seedOrder,
  type TournamentDef,
  type TournamentSession,
} from './tournament'

let clock = 0
/** Une rencontre jouée au défi : les deux totaux. */
function played(slot: string, a: string, totalA: number, b: string, totalB: number): TournamentSession[] {
  const created_at = new Date(Date.UTC(2026, 9, 19, 12, 0, clock++)).toISOString()
  return [
    { player_id: a, total: totalA, won: null, tournament_slot: slot, created_at },
    { player_id: b, total: totalB, won: null, tournament_slot: slot, created_at },
  ]
}

const def = (pools: string[][], extra: Partial<TournamentDef> = {}): TournamentDef => ({
  id: 't1',
  mode: 'volees',
  pools,
  forfeits: [],
  tiebreaks: {},
  ...extra,
})

/** Joue toute une poule en faisant gagner le mieux placé dans `order`. */
function sweepPool(index: number, members: string[], order: string[]): TournamentSession[] {
  const out: TournamentSession[] = []
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const [a, b] = [members[i], members[j]]
      const aWins = order.indexOf(a) < order.indexOf(b)
      out.push(...played(poolSlot(index, a, b), a, aWins ? 200 : 100, b, aWins ? 100 : 200))
    }
  }
  return out
}

describe('composition', () => {
  it('fait une seule poule jusqu’à 5, puis des poules de 3 ou 4', () => {
    expect(poolSizes(4)).toEqual([4])
    expect(poolSizes(5)).toEqual([5])
    expect(poolSizes(6)).toEqual([3, 3])
    expect(poolSizes(7)).toEqual([4, 3])
    expect(poolSizes(10)).toEqual([4, 3, 3])
  })

  it('répartit les têtes de série en serpentin', () => {
    expect(drawPools(['1', '2', '3', '4', '5', '6'])).toEqual([
      ['1', '4', '5'],
      ['2', '3', '6'],
    ])
  })

  it('classe d’abord les joueurs cotés, puis les autres', () => {
    const order = seedOrder(['a', 'b', 'c', 'd'], new Map([['c', 1100], ['a', 1050]]), () => 0)
    expect(order.slice(0, 2)).toEqual(['c', 'a'])
    expect(new Set(order)).toEqual(new Set(['a', 'b', 'c', 'd']))
  })

  it('place les têtes de série d’un tableau de 8', () => {
    expect(bracketPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
  })

  it('nomme les tours depuis la finale', () => {
    expect([1, 2, 3].map((r) => roundLabel(r, 3))).toEqual(['Quarts de finale', 'Demi-finales', 'Finale'])
  })
})

describe('poules', () => {
  it('compte 1 point la victoire, ½ le nul, puis départage aux points marqués', () => {
    const pool = ['a', 'b', 'c']
    const sessions = [
      ...played(poolSlot(0, 'a', 'b'), 'a', 150, 'b', 150),
      ...played(poolSlot(0, 'a', 'c'), 'a', 300, 'c', 100),
      ...played(poolSlot(0, 'b', 'c'), 'b', 120, 'c', 110),
    ]
    const view = replayTournament(def([pool]), sessions)
    const [first, second, third] = view.pools[0].standings
    expect(first).toMatchObject({ player: 'a', points: 1.5, scored: 450 })
    expect(second).toMatchObject({ player: 'b', points: 1.5, scored: 270 })
    expect(third).toMatchObject({ player: 'c', points: 0 })
    expect(view.pools[0].complete).toBe(true)
  })

  it('n’ouvre pas le tableau tant qu’une poule n’est pas finie', () => {
    const view = replayTournament(def([['a', 'b', 'c']]), played(poolSlot(0, 'a', 'b'), 'a', 1, 'b', 0))
    expect(view.poolsComplete).toBe(false)
    expect(view.bracket).toEqual([])
    expect(playableRencontres(view)).toHaveLength(2)
  })

  it('fait perdre ses rencontres restantes à un forfait et l’écarte des qualifiés', () => {
    const t = def([['a', 'b', 'c', 'd']], { forfeits: ['a'] })
    const sessions = [
      ...played(poolSlot(0, 'a', 'b'), 'a', 300, 'b', 100),
      ...played(poolSlot(0, 'b', 'c'), 'b', 200, 'c', 100),
      ...played(poolSlot(0, 'b', 'd'), 'b', 200, 'd', 100),
      ...played(poolSlot(0, 'c', 'd'), 'c', 200, 'd', 100),
    ]
    const view = replayTournament(t, sessions)
    expect(view.pools[0].standings.map((l) => l.player)).toEqual(['b', 'c', 'd', 'a'])
    expect(view.bracket[0].rencontres[0]).toMatchObject({ a: 'b', b: 'c', status: 'a_jouer' })
  })
})

describe('tableau', () => {
  it('oppose les premiers aux deuxièmes et sacre le vainqueur de la finale', () => {
    const pools = [
      ['a1', 'a2', 'a3'],
      ['b1', 'b2', 'b3'],
    ]
    const order = ['a1', 'b1', 'a2', 'b2', 'a3', 'b3']
    const sessions = [...sweepPool(0, pools[0], order), ...sweepPool(1, pools[1], order)]
    let view = replayTournament(def(pools), sessions)
    const slotOf = (x: string) =>
      view.bracket[0].rencontres.find((r) => r.a === x || r.b === x)!.slot
    // 4 qualifiés : 1er de A contre 2e de B, 1er de B contre 2e de A.
    const pairs = view.bracket[0].rencontres.map((r) => [r.a, r.b].sort().join('-')).sort()
    expect(pairs).toEqual(['a1-b2', 'a2-b1'])
    sessions.push(
      ...played(slotOf('a1'), 'a1', 200, 'b2', 100),
      ...played(slotOf('b1'), 'b1', 200, 'a2', 100),
      ...played(bracketSlot(2, 0), 'a1', 90, 'b1', 180),
    )
    view = replayTournament(def(pools), sessions)
    expect(view.champion).toBe('b1')
    expect(view.finished).toBe(true)
  })

  it('exempte les meilleurs quand les qualifiés ne remplissent pas le tableau', () => {
    const pools = [
      ['a1', 'a2', 'a3'],
      ['b1', 'b2', 'b3'],
      ['c1', 'c2', 'c3'],
    ]
    const order = ['a1', 'b1', 'c1', 'a2', 'b2', 'c2', 'a3', 'b3', 'c3']
    const sessions = pools.flatMap((p, i) => sweepPool(i, p, order))
    const view = replayTournament(def(pools), sessions)
    const firstRound = view.bracket[0].rencontres
    expect(view.bracket).toHaveLength(3)
    expect(firstRound.filter((r) => r.status === 'exempt')).toHaveLength(2)
    // Les exemptés attendent déjà au deuxième tour, et ne s'y croisent pas.
    const waiting = view.bracket[1].rencontres.map((r) => r.a ?? r.b)
    expect(waiting.every((p) => p !== null)).toBe(true)
    expect(view.bracket[1].rencontres.every((r) => r.status === 'attente')).toBe(true)
    // Aucun premier tour ne réunit deux joueurs de la même poule.
    for (const r of firstRound.filter((x) => x.a && x.b)) expect(r.a![0]).not.toBe(r.b![0])
  })

  it('réclame une mort subite sur une égalité, puis la prend en compte', () => {
    const pool = ['a', 'b', 'c', 'd']
    const sessions = sweepPool(0, pool, ['a', 'b', 'c', 'd'])
    sessions.push(...played(bracketSlot(1, 0), 'a', 150, 'b', 150))
    const tied = replayTournament(def([pool]), sessions)
    expect(tied.bracket[0].rencontres[0].status).toBe('mort_subite')
    expect(tied.champion).toBeNull()
    const settled = replayTournament(
      def([pool], { tiebreaks: { [bracketSlot(1, 0)]: { winner: 'b', volleys: [[40, 60]] } } }),
      sessions,
    )
    expect(settled.champion).toBe('b')
  })

  it('juge les autres jeux au vainqueur désigné', () => {
    const t = def([['a', 'b']], { mode: 'cricket' })
    const view = replayTournament(t, [
      { player_id: 'a', total: 90, won: false, tournament_slot: poolSlot(0, 'a', 'b'), created_at: '2026-10-19T12:00:00Z' },
      { player_id: 'b', total: 40, won: true, tournament_slot: poolSlot(0, 'a', 'b'), created_at: '2026-10-19T12:00:00Z' },
    ])
    expect(view.pools[0].standings[0].player).toBe('b')
  })
})
