'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { SetupNotice } from '@/components/SetupNotice'
import { useLiveMatches } from '@/lib/liveMatch'
import { bestVolley, count180s } from '@/lib/scoring'
import { useLeague } from '@/lib/useLeague'

type Period = 'mois' | 'toujours'

interface Line {
  playerId: string
  name: string
  best: number
  bestVolley: number
  sessionsCount: number
  average: number
  count180: number
}

const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

export default function ClassementPage() {
  const { players, sessions, loading, error, configured } = useLeague()
  const liveMatches = useLiveMatches()
  const [period, setPeriod] = useState<Period>('mois')

  if (!configured) return <SetupNotice />
  if (loading) return <p className="empty">Chargement du classement…</p>
  if (error) return <p className="notice notice--error">Erreur : {error}</p>

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const inPeriod =
    period === 'mois'
      ? sessions.filter((s) => new Date(s.created_at) >= monthStart)
      : sessions

  const lines: Line[] = players
    .map((player) => {
      const own = inPeriod.filter((s) => s.player_id === player.id)
      if (own.length === 0) return null
      return {
        playerId: player.id,
        name: player.name,
        best: Math.max(...own.map((s) => s.total)),
        bestVolley: Math.max(...own.map((s) => bestVolley(s.darts))),
        sessionsCount: own.length,
        average: Math.round(own.reduce((sum, s) => sum + s.total, 0) / own.length),
        count180: own.reduce((sum, s) => sum + count180s(s.darts), 0),
      }
    })
    .filter((line): line is Line => line !== null)
    .sort((a, b) => b.best - a.best || b.average - a.average || a.name.localeCompare(b.name))

  const idle = players.filter((p) => !lines.some((l) => l.playerId === p.id))

  if (players.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">Le tableau est vide</p>
        <p>Ajoutez des joueurs dans l’onglet Joueurs, puis lancez une première session.</p>
      </div>
    )
  }

  return (
    <div className="stack">
      {liveMatches.length > 0 && (
        <Link href="/live" className="live-banner">
          <span className="live-dot" aria-hidden="true" />
          <span className="live-banner__text">
            Partie en cours :{' '}
            {liveMatches
              .map((m) => m.players.map((p) => p.name).join(' · '))
              .join(' — ')}
          </span>
          <span className="live-banner__cta">Suivre</span>
        </Link>
      )}

      <div className="chips" role="radiogroup" aria-label="Période du classement">
        <button
          type="button"
          role="radio"
          aria-checked={period === 'mois'}
          className={period === 'mois' ? 'chip chip--on' : 'chip'}
          onClick={() => setPeriod('mois')}
        >
          {monthFormat.format(now)}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={period === 'toujours'}
          className={period === 'toujours' ? 'chip chip--on' : 'chip'}
          onClick={() => setPeriod('toujours')}
        >
          Depuis toujours
        </button>
      </div>

      {lines.length === 0 ? (
        <div className="empty">
          <p className="empty__title">
            {period === 'mois' ? 'Aucune session ce mois-ci' : 'Aucune session jouée'}
          </p>
          <p>
            {period === 'mois'
              ? 'Le mois repart de zéro : premier arrivé à la ligne de tir, premier au tableau.'
              : 'Le classement apparaîtra après la première session dans l’onglet Tirer.'}
          </p>
        </div>
      ) : (
        <ol className="board">
          {lines.map((line, index) => (
            <li key={line.playerId}>
              <Link
                href={`/profil/${line.playerId}`}
                className={index === 0 ? 'board__row board__row--leader' : 'board__row'}
              >
                <span className="board__rank">{index + 1}</span>
                <PlayerAvatar name={line.name} leader={index === 0} />
                <span className="board__who">
                  <span className="board__name">{line.name}</span>
                  <span className="board__record">
                    {line.sessionsCount} session{line.sessionsCount > 1 ? 's' : ''} · moy.{' '}
                    {line.average} · volée max {line.bestVolley}
                    {line.count180 > 0 && (
                      <em className="board__180"> · {line.count180}× 180</em>
                    )}
                  </span>
                </span>
                <span className="board__score">
                  <span className="board__points">{line.best}</span>
                  <span className="board__sub">record</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {idle.length > 0 && lines.length > 0 && (
        <section>
          <h2 className="section-title">
            {period === 'mois' ? 'Pas encore tiré ce mois-ci' : 'En attente d’une première session'}
          </h2>
          <ul className="board">
            {idle.map((player) => (
              <li key={player.id}>
                <Link href={`/profil/${player.id}`} className="board__row">
                  <span className="board__rank">–</span>
                  <PlayerAvatar name={player.name} />
                  <span className="board__who">
                    <span className="board__name">{player.name}</span>
                    <span className="board__record">non classé</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
