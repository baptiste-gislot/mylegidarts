'use client'

import Link from 'next/link'
import { SetupNotice } from '@/components/SetupNotice'
import { useToast } from '@/components/Toaster'
import { groupByMatch } from '@/lib/matches'
import { count180s } from '@/lib/scoring'
import { useLeagueContext } from '@/lib/LeagueProvider'

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export default function HistoriquePage() {
  const toast = useToast()
  const { players, sessions, loading, error, configured, removeMatch } = useLeagueContext()

  if (!configured) return <SetupNotice />
  if (loading) return <p className="empty">Chargement de l’historique…</p>
  if (error) return <p className="notice notice--error">Erreur : {error}</p>

  if (sessions.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">Aucune partie pour l’instant</p>
        <p>Chaque partie enregistrée apparaîtra ici, de la plus récente à la plus ancienne.</p>
      </div>
    )
  }

  const nameById = new Map(players.map((p) => [p.id, p.name]))
  const groups = groupByMatch(sessions)

  return (
    <ul className="history">
      {groups.map((group) => {
        const total180 = group.sessions.reduce((sum, s) => sum + count180s(s.darts), 0)
        return (
          <li key={group.id}>
            <Link href={`/partie/${group.id}`} className="match-card">
              <div className="match-card__head">
                <span className="match-card__type">
                  {group.sessions.length > 1 ? `Partie à ${group.sessions.length}` : 'Session solo'}
                  {total180 > 0 && <em className="board__180"> · {total180}× 180</em>}
                </span>
                <time className="history__date">{dateFormat.format(new Date(group.date))}</time>
              </div>
              <ul className="match-card__lines">
                {group.sessions.map((session, index) => (
                  <li key={session.id} className="match-card__line">
                    <span
                      className={
                        index === 0 && group.sessions.length > 1
                          ? 'match-card__player match-card__player--winner'
                          : 'match-card__player'
                      }
                    >
                      {index === 0 && group.sessions.length > 1 && '🏆 '}
                      {nameById.get(session.player_id) ?? 'Joueur supprimé'}
                    </span>
                    <span className="match-card__total">{session.total}</span>
                  </li>
                ))}
              </ul>
              <div className="history__actions">
                <button
                  type="button"
                  className="button-ghost"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const label =
                      group.sessions.length > 1 ? 'cette partie' : 'cette session'
                    if (window.confirm(`Supprimer ${label} ? Le classement sera recalculé.`)) {
                      void removeMatch(group.sessions.map((s) => s.id)).then((err) => {
                        if (!err) toast('Partie supprimée, classement recalculé')
                      })
                    }
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
  )
}
