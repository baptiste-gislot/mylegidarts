'use client'

import Link from 'next/link'
import { SectionNav, historyLinks } from '@/components/SectionNav'
import { SetupNotice } from '@/components/SetupNotice'
import { SIDE_LABEL, type Side } from '@/lib/fletanque'
import { TURN_GAMES, isTurnGame } from '@/lib/gameCatalog'
import { useLiveMatches } from '@/lib/liveMatch'
import { groupByMatch } from '@/lib/matches'
import { useLeagueContext } from '@/lib/LeagueProvider'
import { useSessionHistory } from '@/lib/useSessions'

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export default function HistoriquePage() {
  const { players, configured } = useLeagueContext()
  const { rows, hasMore, error, loadMore } = useSessionHistory()
  const liveMatches = useLiveMatches()

  if (!configured) return <SetupNotice />
  if (error) return <p className="notice notice--error">Erreur : {error}</p>
  if (rows === null) return <p className="empty">Chargement de l’historique…</p>

  if (rows.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">Aucune partie pour l’instant</p>
        <p>Chaque partie enregistrée apparaîtra ici, de la plus récente à la plus ancienne.</p>
      </div>
    )
  }

  const nameById = new Map(players.map((p) => [p.id, p.name]))
  let groups = groupByMatch(rows)
  // La fenêtre paginée peut couper la dernière partie en deux : on la
  // masque tant qu'il reste des sessions à charger (elle reviendra complète).
  if (hasMore && groups.length > 1) groups = groups.slice(0, -1)

  return (
    <div className="stack">
      <SectionNav label="Historique" links={historyLinks(liveMatches.length > 0)} />

      <ul className="history">
        {groups.map((group) => {
          const total180 = group.sessions.reduce((sum, s) => sum + s.count_180, 0)
          const is301 = group.sessions[0]?.mode === '301'
          const mode = group.sessions[0]?.mode ?? 'volees'
          const turnGame = isTurnGame(mode) ? TURN_GAMES[mode] : null
          const withPowers = group.sessions[0]?.powers != null
          const isFletanque = group.sessions[0]?.fletanque != null
          // La flétanque se lit par équipe : les deux coéquipiers partagent
          // le même score et le même sort.
          const lines = isFletanque
            ? ([0, 1] as Side[])
                .map((side) => {
                  const rows = group.sessions.filter((s) => s.fletanque?.team === side)
                  return {
                    key: `equipe-${side}`,
                    label: `${SIDE_LABEL[side]} — ${rows
                      .map((s) => nameById.get(s.player_id) ?? 'Joueur supprimé')
                      .join(' & ')}`,
                    total: `${rows[0]?.total ?? 0}`,
                    winner: rows[0]?.won === true,
                  }
                })
                .sort((a, b) => Number(b.winner) - Number(a.winner))
            : group.sessions
                .map((session, index) => ({
                  key: session.id,
                  label: nameById.get(session.player_id) ?? 'Joueur supprimé',
                  total: turnGame
                    ? turnGame.totalLabel(session.total)
                    : is301 && !session.won
                      ? `reste ${301 - session.total}`
                      : `${session.total}`,
                  winner:
                    is301 || turnGame
                      ? session.won === true
                      : index === 0 && group.sessions.length > 1,
                }))
                .sort((a, b) => (turnGame ? Number(b.winner) - Number(a.winner) : 0))
          return (
            <li key={group.id}>
              <Link href={`/partie/${group.id}`} className="match-card">
                <div className="match-card__head">
                  <span className="match-card__type">
                    {isFletanque
                      ? '🍹 Flétanque'
                      : turnGame
                        ? turnGame.label
                        : is301
                        ? '301'
                        : withPowers
                          ? 'Défi 4 volées · 🃏 Pouvoirs'
                          : 'Défi 4 volées'}
                    {isFletanque
                      ? ' · 2 contre 2'
                      : group.sessions.length > 1
                        ? ` · à ${group.sessions.length}`
                        : ' · solo'}
                    {total180 > 0 && <em className="board__180"> · {total180}× 180</em>}
                  </span>
                  <time className="history__date">{dateFormat.format(new Date(group.date))}</time>
                </div>
                <ul className="match-card__lines">
                  {lines.map((line) => (
                    <li key={line.key} className="match-card__line">
                      <span
                        className={
                          line.winner
                            ? 'match-card__player match-card__player--winner'
                            : 'match-card__player'
                        }
                      >
                        {line.winner && '🏆 '}
                        {line.label}
                      </span>
                      <span className="match-card__total">{line.total}</span>
                    </li>
                  ))}
                </ul>
              </Link>
            </li>
          )
        })}
      </ul>

      {hasMore && (
        <button type="button" className="button-secondary history__more" onClick={loadMore}>
          Voir plus de parties
        </button>
      )}
    </div>
  )
}
