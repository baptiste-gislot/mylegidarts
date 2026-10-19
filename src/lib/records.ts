import type { PlayerMonthStats, SessionStatRow } from './useLeague'

/** Sessions minimum dans le mois pour concourir à la meilleure moyenne mensuelle. */
export const MIN_MONTH_SESSIONS = 3

/** Sous-ensembles des vues suffisants pour calculer les records. */
type RecordSession = Pick<SessionStatRow, 'player_id' | 'total' | 'best_volley' | 'count_180' | 'created_at'>
type RecordMonth = Pick<PlayerMonthStats, 'player_id' | 'month' | 'sessions_count' | 'sum_total'>

export interface RecordEntry {
  id: string
  icon: string
  label: string
  /** Détenteurs du record — plusieurs en cas d'ex æquo. */
  playerIds: string[]
  value: number
  /** Date ISO de la session qui a établi le record (la première en cas d'ex æquo). */
  date?: string
  /** Mois 'YYYY-MM' concerné (records mensuels). */
  month?: string
  /** Condition affichée sous le libellé. */
  note?: string
}

/** Détenteurs d'un maximum : tous les joueurs dont la valeur atteint le max. */
function holders<T>(items: T[], playerOf: (item: T) => string, valueOf: (item: T) => number): { ids: string[]; value: number } {
  const best = Math.max(...items.map(valueOf))
  const ids = [...new Set(items.filter((i) => valueOf(i) === best).map(playerOf))]
  return { ids, value: best }
}

/** Plus longue série de sessions au moins au niveau de la moyenne du joueur. */
function longestStreak(totals: number[]): number {
  if (totals.length === 0) return 0
  const mean = totals.reduce((sum, t) => sum + t, 0) / totals.length
  let best = 0
  let run = 0
  for (const total of totals) {
    run = total >= mean ? run + 1 : 0
    if (run > best) best = run
  }
  return best
}

/**
 * Records de la ligue, calculés depuis la vue session_stats (mode défi)
 * et les agrégats mensuels. Les records sans prétendant sont omis.
 */
export function computeRecords(rows: RecordSession[], months: RecordMonth[]): RecordEntry[] {
  if (rows.length === 0) return []
  const ordered = [...rows].sort((x, y) => x.created_at.localeCompare(y.created_at))
  const records: RecordEntry[] = []

  const bestSession = holders(ordered, (r) => r.player_id, (r) => r.total)
  records.push({
    id: 'session',
    icon: '🏆',
    label: 'Record de partie',
    playerIds: bestSession.ids,
    value: bestSession.value,
    date: ordered.find((r) => r.total === bestSession.value)!.created_at,
  })

  const bestVolley = holders(ordered, (r) => r.player_id, (r) => r.best_volley)
  records.push({
    id: 'volley',
    icon: '🎯',
    label: 'Volée record',
    playerIds: bestVolley.ids,
    value: bestVolley.value,
    date: ordered.find((r) => r.best_volley === bestVolley.value)!.created_at,
  })

  // Agrégats de carrière par joueur.
  const careers = new Map<string, { count180: number; sessions: number; totals: number[] }>()
  for (const row of ordered) {
    const career = careers.get(row.player_id) ?? { count180: 0, sessions: 0, totals: [] }
    career.count180 += row.count_180
    career.sessions += 1
    career.totals.push(row.total)
    careers.set(row.player_id, career)
  }
  const careerRows = [...careers.entries()]

  const most180 = holders(careerRows, ([id]) => id, ([, c]) => c.count180)
  if (most180.value > 0) {
    records.push({
      id: '180',
      icon: '💥',
      label: 'Plus de 180 en carrière',
      playerIds: most180.ids,
      value: most180.value,
    })
  }

  const streaks = holders(careerRows, ([id]) => id, ([, c]) => longestStreak(c.totals))
  if (streaks.value >= 2) {
    records.push({
      id: 'streak',
      icon: '🔥',
      label: 'Plus longue série au-dessus de sa moyenne',
      playerIds: streaks.ids,
      value: streaks.value,
      note: 'parties consécutives',
    })
  }

  const eligibleMonths = months.filter((m) => m.sessions_count >= MIN_MONTH_SESSIONS)
  if (eligibleMonths.length > 0) {
    const withAverage = eligibleMonths.map((m) => ({ ...m, average: Math.round(m.sum_total / m.sessions_count) }))
    const bestMonth = holders(withAverage, (m) => m.player_id, (m) => m.average)
    records.push({
      id: 'month-average',
      icon: '📈',
      label: 'Meilleure moyenne sur un mois',
      playerIds: bestMonth.ids,
      value: bestMonth.value,
      month: withAverage.find((m) => m.average === bestMonth.value)!.month,
      note: `min. ${MIN_MONTH_SESSIONS} parties dans le mois`,
    })
  }

  const mostSessions = holders(careerRows, ([id]) => id, ([, c]) => c.sessions)
  records.push({
    id: 'sessions',
    icon: '🎪',
    label: 'Plus de parties jouées',
    playerIds: mostSessions.ids,
    value: mostSessions.value,
  })

  const worst = holders(ordered, (r) => r.player_id, (r) => -r.total)
  records.push({
    id: 'worst',
    icon: '🤡',
    label: 'Pire partie',
    playerIds: worst.ids,
    value: -worst.value,
    date: ordered.find((r) => r.total === -worst.value)!.created_at,
  })

  return records
}
