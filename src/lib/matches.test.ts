import { describe, expect, it } from 'vitest'
import { groupByMatch } from './matches'

const row = (id: string, match_id: string | null, total: number, created_at: string) => ({
  id,
  match_id,
  total,
  created_at,
})

describe('groupByMatch', () => {
  it('regroupe les sessions partageant un match_id', () => {
    const groups = groupByMatch([
      row('a', 'm1', 200, '2026-07-01T10:00:00Z'),
      row('b', 'm1', 250, '2026-07-01T10:05:00Z'),
      row('c', null, 100, '2026-07-02T10:00:00Z'),
    ])
    expect(groups).toHaveLength(2)
    const m1 = groups.find((g) => g.id === 'm1')!
    expect(m1.sessions).toHaveLength(2)
  })

  it('trie les sessions d’une partie du meilleur au moins bon total', () => {
    const groups = groupByMatch([
      row('a', 'm1', 200, '2026-07-01T10:00:00Z'),
      row('b', 'm1', 250, '2026-07-01T10:05:00Z'),
    ])
    expect(groups[0].sessions.map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('trie les parties de la plus récente à la plus ancienne', () => {
    const groups = groupByMatch([
      row('vieux', null, 100, '2026-06-01T10:00:00Z'),
      row('recent', null, 100, '2026-07-01T10:00:00Z'),
    ])
    expect(groups.map((g) => g.id)).toEqual(['recent', 'vieux'])
  })

  it('date une partie par sa session la plus récente', () => {
    const groups = groupByMatch([
      row('a', 'm1', 200, '2026-07-01T10:00:00Z'),
      row('b', 'm1', 250, '2026-07-01T10:30:00Z'),
    ])
    expect(groups[0].date).toBe('2026-07-01T10:30:00Z')
  })

  it('une session sans match_id forme sa propre partie', () => {
    const groups = groupByMatch([row('solo', null, 150, '2026-07-01T10:00:00Z')])
    expect(groups[0].id).toBe('solo')
    expect(groups[0].sessions).toHaveLength(1)
  })
})
