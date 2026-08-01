import { describe, expect, it } from 'vitest'
import { computeRecords, MIN_MONTH_SESSIONS } from './records'

const row = (
  player_id: string,
  total: number,
  created_at: string,
  best_volley = 0,
  count_180 = 0,
) => ({ player_id, total, created_at, best_volley, count_180 })

const month = (player_id: string, m: string, sessions_count: number, sum_total: number) => ({
  player_id,
  month: m,
  sessions_count,
  sum_total,
})

const record = (records: ReturnType<typeof computeRecords>, id: string) =>
  records.find((r) => r.id === id)

describe('computeRecords', () => {
  it('ne retourne rien sans session', () => {
    expect(computeRecords([], [])).toEqual([])
  })

  it('attribue record et pire session, avec la date de la première occurrence', () => {
    const records = computeRecords(
      [row('a', 300, '2026-07-02'), row('b', 300, '2026-07-01'), row('b', 80, '2026-07-03')],
      [],
    )
    const best = record(records, 'session')!
    // Ex æquo : les deux joueurs sont détenteurs, la date est celle du premier 300.
    expect(best.playerIds.sort()).toEqual(['a', 'b'])
    expect(best.value).toBe(300)
    expect(best.date).toBe('2026-07-01')
    const worst = record(records, 'worst')!
    expect(worst.playerIds).toEqual(['b'])
    expect(worst.value).toBe(80)
  })

  it('omet le record de 180 quand personne n’en a fait', () => {
    const none = computeRecords([row('a', 100, '2026-07-01')], [])
    expect(record(none, '180')).toBeUndefined()
    const some = computeRecords(
      [row('a', 100, '2026-07-01', 60, 1), row('a', 100, '2026-07-02', 60, 2), row('b', 100, '2026-07-03', 60, 2)],
      [],
    )
    expect(record(some, '180')!.playerIds).toEqual(['a'])
    expect(record(some, '180')!.value).toBe(3)
  })

  it('calcule la plus longue série au-dessus de la moyenne de chaque joueur', () => {
    // Joueur a : moyenne 200, la série 250/250/200 (≥ moyenne) fait 3.
    const records = computeRecords(
      [
        row('a', 100, '2026-07-01'),
        row('a', 250, '2026-07-02'),
        row('a', 250, '2026-07-03'),
        row('a', 200, '2026-07-04'),
        row('a', 100, '2026-07-05'),
        row('b', 300, '2026-07-06'),
      ],
      [],
    )
    const streak = record(records, 'streak')!
    expect(streak.playerIds).toEqual(['a'])
    expect(streak.value).toBe(3)
  })

  it('la meilleure moyenne mensuelle exige un minimum de sessions', () => {
    const rows = [row('a', 100, '2026-07-01')]
    const tooFew = computeRecords(rows, [month('a', '2026-07', MIN_MONTH_SESSIONS - 1, 500)])
    expect(record(tooFew, 'month-average')).toBeUndefined()
    const enough = computeRecords(rows, [
      month('a', '2026-07', MIN_MONTH_SESSIONS, 750),
      month('b', '2026-06', MIN_MONTH_SESSIONS, 600),
    ])
    const best = record(enough, 'month-average')!
    expect(best.playerIds).toEqual(['a'])
    expect(best.value).toBe(250)
    expect(best.month).toBe('2026-07')
  })

  it('compte les sessions de carrière', () => {
    const records = computeRecords(
      [row('a', 100, '2026-07-01'), row('a', 100, '2026-07-02'), row('b', 300, '2026-07-03')],
      [],
    )
    const sessions = record(records, 'sessions')!
    expect(sessions.playerIds).toEqual(['a'])
    expect(sessions.value).toBe(2)
  })
})
