'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { ScoreChart } from '@/components/ScoreChart'
import { SetupNotice } from '@/components/SetupNotice'
import {
  bestVolley,
  count180s,
  dartBreakdown,
  dartLabel,
  sessionTotal,
  volleys,
} from '@/lib/scoring'
import { useLeagueContext } from '@/lib/LeagueProvider'
import type { PlayerRow } from '@/lib/useLeague'
import { useDuels, usePlayerSessions } from '@/lib/useSessions'

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export default function ProfilPage() {
  const { id } = useParams<{ id: string }>()
  const { players, loading, error, configured } = useLeagueContext()
  const { sessions: own, error: sessionsError } = usePlayerSessions(id)
  const duels = useDuels(id)

  if (!configured) return <SetupNotice />
  if (loading) return <p className="empty">Chargement du profil…</p>
  if (error || sessionsError) {
    return <p className="notice notice--error">Erreur : {error ?? sessionsError}</p>
  }

  const player = players.find((p) => p.id === id)
  if (!player) {
    return (
      <div className="empty">
        <p className="empty__title">Joueur introuvable</p>
        <p>
          Ce joueur n’existe plus. <Link href="/">Retour au classement</Link>.
        </p>
      </div>
    )
  }

  if (own === null) return <p className="empty">Chargement du profil…</p>

  if (own.length === 0) {
    return (
      <div className="stack">
        <ProfilHeader player={player} />
        <div className="empty">
          <p className="empty__title">Aucune session</p>
          <p>{player.name} n’a pas encore tiré. Le profil se remplira dès la première session.</p>
        </div>
      </div>
    )
  }

  const allDarts = own.flatMap((s) => s.darts)
  const breakdown = dartBreakdown(allDarts)
  const record = Math.max(...own.map((s) => s.total))
  const average = Math.round(own.reduce((sum, s) => sum + s.total, 0) / own.length)
  const maxVolley = Math.max(...own.map((s) => bestVolley(s.darts)))
  const total180 = own.reduce((sum, s) => sum + count180s(s.darts), 0)
  const perDart = (allDarts.reduce((sum, d) => sum + d.sector * d.mult, 0) / allDarts.length).toFixed(1)

  const breakdownRows = [
    { label: 'Triples', value: breakdown.triples },
    { label: 'Doubles', value: breakdown.doubles },
    { label: 'Simples', value: breakdown.simples },
    { label: 'Bulls (25/50)', value: breakdown.bulls },
    { label: 'Ratés', value: breakdown.rates },
  ]
  const maxRow = Math.max(...breakdownRows.map((r) => r.value), 1)

  return (
    <div className="stack">
      <ProfilHeader player={player} />

      <div className="tiles">
        <div className="tile tile--hero">
          <span className="tile__value">{record}</span>
          <span className="tile__label">record</span>
        </div>
        <div className="tile">
          <span className="tile__value">{average}</span>
          <span className="tile__label">moyenne</span>
        </div>
        <div className="tile">
          <span className="tile__value">{maxVolley}</span>
          <span className="tile__label">volée max</span>
        </div>
        <div className="tile">
          <span className="tile__value">{own.length}</span>
          <span className="tile__label">session{own.length > 1 ? 's' : ''}</span>
        </div>
        <div className="tile">
          <span className="tile__value">{perDart}</span>
          <span className="tile__label">pts / fléchette</span>
        </div>
        <div className={total180 > 0 ? 'tile tile--180' : 'tile'}>
          <span className="tile__value">{total180}</span>
          <span className="tile__label">180</span>
        </div>
      </div>

      {own.length >= 2 && (
        <section>
          <h2 className="section-title">Évolution des sessions</h2>
          <ScoreChart sessions={own} />
        </section>
      )}

      {duels !== null && duels.length > 0 && (
        <section>
          <h2 className="section-title">Face-à-face</h2>
          <ul className="duels">
            {[...duels]
              .sort((a, b) => b.played - a.played)
              .map((duel) => {
                const opponent = players.find((p) => p.id === duel.opponent_id)
                const draws = duel.played - duel.wins - duel.losses
                const leading = duel.wins > duel.losses
                return (
                  <li key={duel.opponent_id} className="duels__row">
                    <PlayerAvatar name={opponent?.name ?? '?'} />
                    <span className="duels__who">
                      <span className="board__name">contre {opponent?.name ?? 'Joueur supprimé'}</span>
                      <span className="board__record">
                        {duel.played} partie{duel.played > 1 ? 's' : ''}
                        {draws > 0 && ` · ${draws} nul${draws > 1 ? 's' : ''}`}
                      </span>
                    </span>
                    <span className={leading ? 'duels__score duels__score--up' : 'duels__score'}>
                      {duel.wins} V – {duel.losses} D
                    </span>
                  </li>
                )
              })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="section-title">
          Répartition des {breakdown.total} fléchettes
        </h2>
        <div className="bars">
          {breakdownRows.map((row) => (
            <div key={row.label} className="bars__row">
              <span className="bars__label">{row.label}</span>
              <span className="bars__track">
                <span className="bars__fill" style={{ width: `${(row.value / maxRow) * 100}%` }} />
              </span>
              <span className="bars__value">
                {row.value}
                <em> · {Math.round((row.value / breakdown.total) * 100)}%</em>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title">Sessions</h2>
        <ul className="history">
          {[...own].reverse().map((session) => (
            <li key={session.id} className="history__item">
              <div className="history__head">
                <span className={session.total === record ? 'history__player history__player--gold' : 'history__player'}>
                  {session.total === record ? 'Record' : ''}
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
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function ProfilHeader({ player }: { player: PlayerRow }) {
  return (
    <div className="profil-head">
      <Link href="/" className="button-ghost">
        ← Classement
      </Link>
      <div className="profil-head__who">
        <PlayerAvatar name={player.name} />
        <h2 className="profil-head__name">
          {player.name}
          {player.nickname && <em className="board__nickname"> « {player.nickname} »</em>}
        </h2>
      </div>
    </div>
  )
}
