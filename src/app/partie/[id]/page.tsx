'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { SetupNotice } from '@/components/SetupNotice'
import { SIDE_LABEL, type Side } from '@/lib/fletanque'
import { dartLabel, sessionTotal, volleys } from '@/lib/scoring'
import { POWER_BY_ID, groupBySizes } from '@/lib/powers'
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
  const flet = matchSessions[0]?.fletanque ?? null
  if (flet) {
    // La flétanque se lit par équipe : quatre lignes, deux camps, un déroulé
    // de mènes partagé.
    const teams = ([0, 1] as Side[]).map((side) => {
      const rows = matchSessions.filter((s) => s.fletanque?.team === side)
      return {
        side,
        roster: rows.map((s) => nameById.get(s.player_id) ?? 'Joueur supprimé'),
        score: rows[0]?.total ?? 0,
        won: rows[0]?.won === true,
      }
    })
    const champions = teams.find((t) => t.won)

    return (
      <div className="stack">
        <div className="profil-head">
          <Link href="/historique" className="button-ghost">
            ← Historique
          </Link>
          <div>
            <h2 className="profil-head__name">
              {champions
                ? `Flétanque — Victoire de ${champions.roster.join(' & ')}`
                : 'Flétanque — partie abandonnée'}
            </h2>
            <p className="board__record">
              {dateFormat.format(new Date(matchSessions[0].created_at))}
            </p>
          </div>
        </div>

        {[...teams]
          .sort((a, b) => Number(b.won) - Number(a.won))
          .map((team) => (
            <section
              key={team.side}
              className={team.won ? 'match-detail match-detail--winner' : 'match-detail'}
            >
              <div className="match-detail__head">
                <PlayerAvatar name={team.roster[0] ?? '?'} leader={team.won} />
                <span className="match-detail__name">
                  {team.won && '🏆 '}
                  {SIDE_LABEL[team.side]} — {team.roster.join(' & ')}
                </span>
                <span className="match-detail__total">{team.score}</span>
              </div>
            </section>
          ))}

        <section className="match-detail">
          <div className="match-detail__volleys">
            {flet.menes.map((mene, i) => (
              <div key={i} className="volley-line">
                <span className="volley-line__label">Mène {i + 1}</span>
                <span className="volley-line__darts">
                  {mene.holder === null
                    ? 'nulle — rejouée'
                    : `${SIDE_LABEL[mene.holder]} · ${teams[mene.holder].roster.join(' & ')}`}
                </span>
                <span className="volley-line__total">{mene.points}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    )
  }

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
        const power = session.powers ? POWER_BY_ID[session.powers.power] : null
        const copied = session.powers?.copied ? POWER_BY_ID[session.powers.copied] : null
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
            {power && session.powers && (
              <p className="match-detail__power">
                {power.emoji} « {power.title} »
                {copied ? ` → copie de « ${copied.title} »` : ''} —{' '}
                {session.powers.used ? 'utilisé' : 'gardé en poche'}
                {session.powers.bonus > 0 && ` · bonus +${session.powers.bonus}`}
              </p>
            )}
            <div className="match-detail__volleys">
              {(session.powers
                ? groupBySizes(session.darts, session.powers.volleySizes)
                : volleys(session.darts)
              ).map((volley, i) => {
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
