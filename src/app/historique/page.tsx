'use client'

import { SetupNotice } from '@/components/SetupNotice'
import { useToast } from '@/components/Toaster'
import { dartLabel, sessionTotal, volleys } from '@/lib/scoring'
import { useLeague } from '@/lib/useLeague'

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export default function HistoriquePage() {
  const toast = useToast()
  const { players, sessions, loading, error, configured, removeSession } = useLeague()

  if (!configured) return <SetupNotice />
  if (loading) return <p className="empty">Chargement de l’historique…</p>
  if (error) return <p className="notice notice--error">Erreur : {error}</p>

  if (sessions.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">Aucune session pour l’instant</p>
        <p>Chaque session enregistrée apparaîtra ici, de la plus récente à la plus ancienne.</p>
      </div>
    )
  }

  const nameById = new Map(players.map((p) => [p.id, p.name]))

  return (
    <ul className="history">
      {sessions.map((session) => (
        <li key={session.id} className="history__item">
          <div className="history__head">
            <span className="history__player">
              {nameById.get(session.player_id) ?? 'Joueur supprimé'}
            </span>
            <time className="history__date">{dateFormat.format(new Date(session.created_at))}</time>
          </div>
          <span className="history__total">{session.total}</span>
          <p className="history__darts">
            {volleys(session.darts).map((volley, i) => {
              const volleyTotal = sessionTotal(volley)
              return (
                <span key={i}>
                  {i > 0 && '   ·   '}
                  {volley.map(dartLabel).join(' ')}{' '}
                  <b className={volleyTotal === 180 ? 'b--180' : undefined}>{volleyTotal}</b>
                </span>
              )
            })}
          </p>
          <div className="history__actions">
            <button
              type="button"
              className="button-ghost"
              onClick={() => {
                if (window.confirm('Supprimer cette session ? Le classement sera recalculé.')) {
                  void removeSession(session.id).then((err) => {
                    if (!err) toast('Session supprimée, classement recalculé')
                  })
                }
              }}
            >
              Supprimer
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
