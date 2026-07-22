import type { SessionRow } from './useLeague'

export interface MatchGroup {
  id: string
  date: string
  /** Sessions de la partie, triées du meilleur au moins bon total. */
  sessions: SessionRow[]
}

/** Regroupe les sessions par partie (match_id partagé ; les anciennes sessions restent seules). */
export function groupByMatch(sessions: SessionRow[]): MatchGroup[] {
  const groups = new Map<string, SessionRow[]>()
  for (const s of sessions) {
    const key = s.match_id ?? s.id
    groups.set(key, [...(groups.get(key) ?? []), s])
  }
  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      date: group.reduce((max, s) => (s.created_at > max ? s.created_at : max), group[0].created_at),
      sessions: [...group].sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}
