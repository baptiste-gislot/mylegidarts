'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { BadgeGrid } from '@/components/BadgeGrid'
import { DartHeatmap } from '@/components/DartHeatmap'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { ScoreChart } from '@/components/ScoreChart'
import { SetupNotice } from '@/components/SetupNotice'
import { computeBadges } from '@/lib/badges'
import { bestVolleyDetail, consistency, FORM_WINDOW, hotStreak, recentForm } from '@/lib/profileStats'
import {
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
  const [heatScope, setHeatScope] = useState<'all' | 'month'>('all')

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
          <p className="empty__title">Aucune partie</p>
          <p>{player.name} n’a pas encore tiré. Le profil se remplira dès la première session.</p>
        </div>
      </div>
    )
  }

  const allDarts = own.flatMap((s) => s.darts)
  const breakdown = dartBreakdown(allDarts)
  const totals = own.map((s) => s.total)
  const record = Math.max(...totals)
  const average = Math.round(totals.reduce((sum, t) => sum + t, 0) / totals.length)
  const bestV = bestVolleyDetail(own)
  const total180 = own.reduce((sum, s) => sum + count180s(s.darts), 0)
  const perDart = (allDarts.reduce((sum, d) => sum + d.sector * d.mult, 0) / allDarts.length).toFixed(1)
  const form = recentForm(totals)
  const sigma = consistency(totals)
  const streak = hotStreak(totals)
  const badges = computeBadges(own, duels ?? [])
  const earnedBadges = badges.filter((b) => b.earned).length

  const now = new Date()
  const monthDarts = own
    .filter((s) => {
      const date = new Date(s.created_at)
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
    })
    .flatMap((s) => s.darts)
  const heatDarts = heatScope === 'all' ? allDarts : monthDarts

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
        {form && (
          <div className="tile" title={`Moyenne des ${FORM_WINDOW} dernières parties, contre ${average} en général`}>
            <span className="tile__value">{form.recent}</span>
            <span className="tile__label">forme</span>
            <span
              className={
                form.delta > 0 ? 'tile__sub tile__sub--up' : form.delta < 0 ? 'tile__sub tile__sub--down' : 'tile__sub'
              }
            >
              {form.delta > 0 ? `↑ +${form.delta}` : form.delta < 0 ? `↓ ${form.delta}` : '='}
            </span>
          </div>
        )}
        <div className="tile" title={bestV ? dateFormat.format(new Date(bestV.createdAt)) : undefined}>
          <span className="tile__value">{bestV?.total ?? 0}</span>
          <span className="tile__label">volée max</span>
          {bestV && <span className="tile__sub">{bestV.darts.map(dartLabel).join(' ')}</span>}
        </div>
        <div className="tile">
          <span className="tile__value">{perDart}</span>
          <span className="tile__label">pts / fléchette</span>
        </div>
        <div className={total180 > 0 ? 'tile tile--180' : 'tile'}>
          <span className="tile__value">{total180}</span>
          <span className="tile__label">180</span>
        </div>
        <div className="tile">
          <span className="tile__value">{own.length}</span>
          <span className="tile__label">partie{own.length > 1 ? 's' : ''}</span>
        </div>
        {own.length >= 2 && (
          <div className="tile" title="Écart-type des scores de partie : plus c’est bas, plus le jeu est régulier">
            <span className="tile__value">± {sigma}</span>
            <span className="tile__label">constance</span>
          </div>
        )}
        <div className="tile" title="Parties consécutives au moins au niveau de la moyenne">
          <span className="tile__value">{streak}</span>
          <span className="tile__label">série ≥ moy.</span>
        </div>
      </div>

      <section>
        <h2 className="section-title">
          Trophées · {earnedBadges}/{badges.length}
        </h2>
        <BadgeGrid badges={badges} />
      </section>

      {own.length >= 2 && (
        <section>
          <h2 className="section-title">Évolution des scores</h2>
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
                  <li key={duel.opponent_id}>
                    <Link href={`/comparer/${id}/${duel.opponent_id}`} className="duels__row">
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
                      <span className="duels__go" aria-hidden="true">
                        ›
                      </span>
                    </Link>
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
        <h2 className="section-title">Heatmap de la cible</h2>
        <div className="chips chips--scope">
          <button
            type="button"
            className={heatScope === 'all' ? 'chip chip--on' : 'chip'}
            onClick={() => setHeatScope('all')}
          >
            Tout
          </button>
          <button
            type="button"
            className={heatScope === 'month' ? 'chip chip--on' : 'chip'}
            onClick={() => setHeatScope('month')}
          >
            Ce mois-ci
          </button>
        </div>
        {heatDarts.length > 0 ? (
          <DartHeatmap darts={heatDarts} />
        ) : (
          <p className="empty">Aucune fléchette ce mois-ci.</p>
        )}
      </section>

      <section>
        <h2 className="section-title">Parties</h2>
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
