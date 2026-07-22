'use client'

import Link from 'next/link'
import { SetupNotice } from '@/components/SetupNotice'
import { useToast } from '@/components/Toaster'
import { askDeleteCode, forgetDeleteCode, rememberDeleteCode } from '@/lib/deleteCode'
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
  const toast = useToast()
  const { players, configured, removeMatch } = useLeagueContext()
  const { rows, hasMore, error, loadMore, reload } = useSessionHistory()

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
      <ul className="history">
        {groups.map((group) => {
          const total180 = group.sessions.reduce((sum, s) => sum + s.count_180, 0)
          const is301 = group.sessions[0]?.mode === '301'
          return (
            <li key={group.id}>
              <Link href={`/partie/${group.id}`} className="match-card">
                <div className="match-card__head">
                  <span className="match-card__type">
                    {is301 ? '301' : 'Défi 4 volées'}
                    {group.sessions.length > 1 ? ` · à ${group.sessions.length}` : ' · solo'}
                    {total180 > 0 && <em className="board__180"> · {total180}× 180</em>}
                  </span>
                  <time className="history__date">{dateFormat.format(new Date(group.date))}</time>
                </div>
                <ul className="match-card__lines">
                  {group.sessions.map((session, index) => {
                    const winner = is301
                      ? session.won === true
                      : index === 0 && group.sessions.length > 1
                    return (
                      <li key={session.id} className="match-card__line">
                        <span
                          className={
                            winner
                              ? 'match-card__player match-card__player--winner'
                              : 'match-card__player'
                          }
                        >
                          {winner && '🏆 '}
                          {nameById.get(session.player_id) ?? 'Joueur supprimé'}
                        </span>
                        <span className="match-card__total">
                          {is301 && !session.won ? `reste ${301 - session.total}` : session.total}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                <div className="history__actions">
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const label = group.sessions.length > 1 ? 'cette partie' : 'cette session'
                      if (!window.confirm(`Supprimer ${label} ? Le classement sera recalculé.`)) return
                      const code = askDeleteCode()
                      if (code === null) return
                      void removeMatch(group.sessions.map((s) => s.id), code).then((err) => {
                        if (err) {
                          forgetDeleteCode()
                          toast(err, 'error')
                        } else {
                          rememberDeleteCode(code)
                          reload()
                          toast('Partie supprimée, classement recalculé')
                        }
                      })
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      {hasMore && (
        <button type="button" className="button-ghost history__more" onClick={loadMore}>
          Voir plus de parties
        </button>
      )}
    </div>
  )
}
