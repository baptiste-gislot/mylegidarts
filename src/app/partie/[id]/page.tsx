'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { SetupNotice } from '@/components/SetupNotice'
import { dartLabel, sessionTotal, volleys } from '@/lib/scoring'
import { useLeagueContext } from '@/lib/LeagueProvider'

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

export default function PartiePage() {
  const { id } = useParams<{ id: string }>()
  const { players, sessions, loading, error, configured } = useLeagueContext()

  if (!configured) return <SetupNotice />
  if (loading) return <p className="empty">Chargement de la partie…</p>
  if (error) return <p className="notice notice--error">Erreur : {error}</p>

  const matchSessions = sessions
    .filter((s) => (s.match_id ?? s.id) === id)
    .sort((a, b) => b.total - a.total)

  if (matchSessions.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">Partie introuvable</p>
        <p>
          Cette partie a peut-être été supprimée.{' '}
          <Link href="/historique">Retour à l’historique</Link>.
        </p>
      </div>
    )
  }

  const nameById = new Map(players.map((p) => [p.id, p.name]))
  const winner = matchSessions[0]
  const isDuel = matchSessions.length > 1

  return (
    <div className="stack">
      <div className="profil-head">
        <Link href="/historique" className="button-ghost">
          ← Historique
        </Link>
        <div>
          <h2 className="profil-head__name">
            {isDuel
              ? `Victoire de ${nameById.get(winner.player_id) ?? '?'}`
              : `Session de ${nameById.get(winner.player_id) ?? '?'}`}
          </h2>
          <p className="board__record">{dateFormat.format(new Date(winner.created_at))}</p>
        </div>
      </div>

      {matchSessions.map((session, index) => {
        const name = nameById.get(session.player_id) ?? 'Joueur supprimé'
        return (
          <section
            key={session.id}
            className={index === 0 && isDuel ? 'match-detail match-detail--winner' : 'match-detail'}
          >
            <div className="match-detail__head">
              <PlayerAvatar name={name} leader={index === 0 && isDuel} />
              <span className="match-detail__name">
                {index === 0 && isDuel && '🏆 '}
                {name}
              </span>
              <span className="match-detail__total">{session.total}</span>
            </div>
            <div className="match-detail__volleys">
              {volleys(session.darts).map((volley, i) => {
                const volleyTotal = sessionTotal(volley)
                return (
                  <div key={i} className="volley-line">
                    <span className="volley-line__label">Volée {i + 1}</span>
                    <span className="volley-line__darts">{volley.map(dartLabel).join('  ')}</span>
                    <span className={volleyTotal === 180 ? 'volley-line__total b--180' : 'volley-line__total'}>
                      {volleyTotal}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
