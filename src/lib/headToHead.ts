// Le face-à-face entre deux joueurs, jeu par jeu. Même règle que la vue
// duel_stats : seules comptent les parties jouées à eux deux ; au défi le plus
// gros total gagne, ailleurs c'est le drapeau won (deux vainqueurs = nul).

import type { GameMode, SessionStatRow } from './useLeague'

export type DuelSession = Pick<SessionStatRow, 'player_id' | 'match_id' | 'total' | 'mode' | 'won'>

export interface DuelRecord {
  played: number
  wins: number
  draws: number
  losses: number
}

/** Bilan du point de vue de `a` contre `b`, par jeu et tous jeux confondus (clé 'all'). */
export function headToHead(rows: DuelSession[], a: string, b: string): Map<GameMode | 'all', DuelRecord> {
  const matches = new Map<string, DuelSession[]>()
  for (const row of rows) {
    if (row.match_id === null) continue
    const list = matches.get(row.match_id) ?? []
    list.push(row)
    matches.set(row.match_id, list)
  }

  const result = new Map<GameMode | 'all', DuelRecord>()
  const add = (key: GameMode | 'all', outcome: 1 | 0 | -1) => {
    const record = result.get(key) ?? { played: 0, wins: 0, draws: 0, losses: 0 }
    record.played += 1
    if (outcome === 1) record.wins += 1
    else if (outcome === -1) record.losses += 1
    else record.draws += 1
    result.set(key, record)
  }

  for (const sessions of matches.values()) {
    if (sessions.length !== 2) continue
    const mine = sessions.find((s) => s.player_id === a)
    const theirs = sessions.find((s) => s.player_id === b)
    if (!mine || !theirs) continue
    const outcome =
      mine.mode === 'volees'
        ? Math.sign(mine.total - theirs.total)
        : mine.won && !theirs.won
          ? 1
          : theirs.won && !mine.won
            ? -1
            : 0
    add(mine.mode, outcome as 1 | 0 | -1)
    add('all', outcome as 1 | 0 | -1)
  }
  return result
}
