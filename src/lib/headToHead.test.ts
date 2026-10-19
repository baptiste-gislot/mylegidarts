import { describe, expect, it } from 'vitest'
import { headToHead, type DuelSession } from './headToHead'
import type { GameMode } from './useLeague'

let seq = 0
function match(mode: GameMode, a: Partial<DuelSession>, b: Partial<DuelSession>, extra: DuelSession[] = []): DuelSession[] {
  const match_id = `m${++seq}`
  return [
    { player_id: 'a', match_id, total: 0, mode, won: null, ...a },
    { player_id: 'b', match_id, total: 0, mode, won: null, ...b },
    ...extra.map((s) => ({ ...s, match_id })),
  ]
}

describe('headToHead', () => {
  it('juge le défi au total et les autres jeux au vainqueur désigné', () => {
    const rows = [
      ...match('volees', { total: 200 }, { total: 150 }),
      ...match('volees', { total: 120 }, { total: 120 }),
      ...match('cricket', { won: false }, { won: true }),
      ...match('301', { won: true }, { won: false }),
    ]
    const table = headToHead(rows, 'a', 'b')
    expect(table.get('volees')).toEqual({ played: 2, wins: 1, draws: 1, losses: 0 })
    expect(table.get('cricket')).toEqual({ played: 1, wins: 0, draws: 0, losses: 1 })
    expect(table.get('all')).toEqual({ played: 4, wins: 2, draws: 1, losses: 1 })
  })

  it('compte deux vainqueurs ex æquo comme un nul', () => {
    const table = headToHead(match('shanghai', { won: true }, { won: true }), 'a', 'b')
    expect(table.get('shanghai')).toEqual({ played: 1, wins: 0, draws: 1, losses: 0 })
  })

  it('ignore les parties à plus de deux joueurs et celles d’autres joueurs', () => {
    const third: DuelSession = { player_id: 'c', match_id: null, total: 10, mode: 'volees', won: null }
    const rows = [
      ...match('volees', { total: 200 }, { total: 150 }, [third]),
      { player_id: 'a', match_id: 'solo', total: 100, mode: 'volees' as const, won: null },
    ]
    expect(headToHead(rows, 'a', 'b').size).toBe(0)
  })
})
