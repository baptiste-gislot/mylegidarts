'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { SetupNotice } from '@/components/SetupNotice'
import { dartLabel, sessionTotal, volleys } from '@/lib/scoring'
import { useLeagueContext } from '@/lib/LeagueProvider'
import { useMatchSessions } from '@/lib/useSessions'

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

export default function PartiePage() {
  const { id } = useParams<{ id: string }>()
  const { players, loading, error, configured } = useLeagueContext()
  const { sessions: matchSessions, error: sessionsError } = useMatchSessions(id)

  if (!configured) return <SetupNotice />
  if (loading || matchSessions === null) return <p className="empty">Chargement de la partie…</p>
  if (error || sessionsError) {
    return <p className="notice notice--error">Erreur : {error ?? sessionsError}</p>
  }

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
  const is301 = matchSessions[0]?.mode === '301'
  const winner = is301
    ? (matchSessions.find((s) => s.won) ?? matchSessions[0])
    : matchSessions[0]
  const isDuel = matchSessions.length > 1

  const title = is301
    ? matchSessions.some((s) => s.won)
      ? `301 — Victoire de ${nameById.get(winner.player_id) ?? '?'}`
      : '301 — Partie abandonnée'
    : isDuel
      ? `Victoire de ${nameById.get(winner.player_id) ?? '?'}`
      : `Session de ${nameById.get(winner.player_id) ?? '?'}`

  return (
    <div className="stack">
      <div className="profil-head">
        <Link href="/historique" className="button-ghost">
          ← Historique
        </Link>
        <div>
          <h2 className="profil-head__name">{title}</h2>
          <p className="board__record">{dateFormat.format(new Date(winner.created_at))}</p>
        </div>
      </div>

      {matchSessions.map((session, index) => {
        const name = nameById.get(session.player_id) ?? 'Joueur supprimé'
        const winnerRow = is301 ? session.won === true : index === 0 && isDuel
        return (
          <section
            key={session.id}
            className={winnerRow ? 'match-detail match-detail--winner' : 'match-detail'}
          >
            <div className="match-detail__head">
              <PlayerAvatar name={name} leader={winnerRow} />
              <span className="match-detail__name">
                {winnerRow && '🏆 '}
                {name}
              </span>
              <span className="match-detail__total">
                {is301 && !session.won ? `reste ${301 - session.total}` : session.total}
              </span>
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
