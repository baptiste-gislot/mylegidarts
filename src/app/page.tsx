'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LevelStandings } from '@/components/LevelStandings'
import { MonthPodium } from '@/components/MonthPodium'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { SetupNotice } from '@/components/SetupNotice'
import { useLiveMatches } from '@/lib/liveMatch'
import { useLeagueContext } from '@/lib/LeagueProvider'
import { flopLine } from '@/lib/trashTalk'
import { monthKey, type PlayerMonthStats } from '@/lib/useLeague'

type View = 'niveau' | 'defi'
type Period = 'mois' | 'toujours'
type Ranking = 'record' | 'moyenne' | 'flop'

interface Line {
  playerId: string
  name: string
  best: number
  worst: number
  bestVolley: number
  sessionsCount: number
  average: number
  count180: number
}

const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return monthFormat.format(new Date(year, month - 1, 1))
}

export default function ClassementPage() {
  const { players, stats, punchlines, loading, error, configured } = useLeagueContext()
  const liveMatches = useLiveMatches()
  const [view, setView] = useState<View>('niveau')
  const [period, setPeriod] = useState<Period>('mois')
  const [ranking, setRanking] = useState<Ranking>('record')

  if (!configured) return <SetupNotice />
  if (loading) return <p className="empty">Chargement du classement…</p>
  if (error) return <p className="notice notice--error">Erreur : {error}</p>

  const currentMonth = monthKey(new Date())
  const inPeriod = period === 'mois' ? stats.filter((s) => s.month === currentMonth) : stats

  const lines: Line[] = players
    .map((player) => {
      const own = inPeriod.filter((s) => s.player_id === player.id)
      if (own.length === 0) return null
      const sessionsCount = own.reduce((sum, s) => sum + s.sessions_count, 0)
      return {
        playerId: player.id,
        name: player.name,
        best: Math.max(...own.map((s) => s.best_total)),
        worst: Math.min(...own.map((s) => s.worst_total)),
        bestVolley: Math.max(...own.map((s) => s.best_volley)),
        sessionsCount,
        average: Math.round(own.reduce((sum, s) => sum + s.sum_total, 0) / sessionsCount),
        count180: own.reduce((sum, s) => sum + s.count_180, 0),
      }
    })
    .filter((line): line is Line => line !== null)
    .sort((a, b) =>
      ranking === 'record'
        ? b.best - a.best || b.average - a.average || a.name.localeCompare(b.name)
        : ranking === 'moyenne'
          ? b.average - a.average || b.best - a.best || a.name.localeCompare(b.name)
          : a.worst - b.worst || a.average - b.average || a.name.localeCompare(b.name),
    )

  const idle = players.filter((p) => !lines.some((l) => l.playerId === p.id))

  // Palmarès : le vainqueur (meilleur score) de chaque mois écoulé.
  const hallOfFame = (() => {
    const byMonth = new Map<string, PlayerMonthStats>()
    for (const s of stats) {
      if (s.month >= currentMonth) continue
      const current = byMonth.get(s.month)
      if (!current || s.best_total > current.best_total) byMonth.set(s.month, s)
    }
    return [...byMonth.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, s]) => ({
        label: monthLabel(key),
        name: players.find((p) => p.id === s.player_id)?.name ?? '?',
        best: s.best_total,
      }))
  })()

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

      {/* Deux classements : le niveau de la saison, et le défi du mois au score. */}
      <div className="segmented" role="radiogroup" aria-label="Classement">
        <button
          type="button"
          role="radio"
          aria-checked={view === 'niveau'}
          className={view === 'niveau' ? 'segmented__option segmented__option--on' : 'segmented__option'}
          onClick={() => setView('niveau')}
        >
          Niveau
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={view === 'defi'}
          className={view === 'defi' ? 'segmented__option segmented__option--on' : 'segmented__option'}
          onClick={() => setView('defi')}
        >
          Défi du mois
        </button>
      </div>

      {view === 'niveau' ? (
        <LevelStandings players={players} />
      ) : (
        <>
          <div className="chips" role="radiogroup" aria-label="Période du classement">
            <button
              type="button"
              role="radio"
              aria-checked={period === 'mois'}
              className={period === 'mois' ? 'chip chip--on' : 'chip'}
              onClick={() => setPeriod('mois')}
            >
              {monthLabel(currentMonth)}
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

          <div className="chips" role="radiogroup" aria-label="Critère de classement">
            <button
              type="button"
              role="radio"
              aria-checked={ranking === 'record'}
              className={ranking === 'record' ? 'chip chip--on' : 'chip'}
              onClick={() => setRanking('record')}
            >
              Meilleur score
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={ranking === 'moyenne'}
              className={ranking === 'moyenne' ? 'chip chip--on' : 'chip'}
              onClick={() => setRanking('moyenne')}
            >
              Moyenne / partie
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={ranking === 'flop'}
              className={ranking === 'flop' ? 'chip chip--on' : 'chip'}
              onClick={() => setRanking('flop')}
            >
              Plus petit score
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
              {lines.map((line, index) => {
                // Sans pique de tableau dans le répertoire, la rangée flop retombe
                // sur les détails standard plutôt qu'une ligne vide.
                const pique =
                  ranking === 'flop' ? flopLine(line.playerId + line.worst, punchlines) : null
                return (
                  <li key={line.playerId}>
                    <Link
                      href={`/profil/${line.playerId}`}
                      className={`board__row${
                        ranking === 'flop'
                          ? index === 0
                            ? ' board__row--flop'
                            : ''
                          : index === 0
                            ? ' board__row--leader'
                            : index === 1
                              ? ' board__row--second'
                              : index === 2
                                ? ' board__row--third'
                                : ''
                      }`}
                    >
                      <span className="board__rank">
                        {index < 3
                          ? (ranking === 'flop' ? ['🤡', '🫣', '😬'] : ['🥇', '🥈', '🥉'])[index]
                          : index + 1}
                      </span>
                      <PlayerAvatar name={line.name} leader={index === 0 && ranking !== 'flop'} />
                      <span className="board__who">
                        <span className="board__name">{line.name}</span>
                        {pique !== null ? (
                          <span className="board__record board__record--pique">{pique}</span>
                        ) : (
                          <span className="board__record">
                            {line.sessionsCount} session{line.sessionsCount > 1 ? 's' : ''} ·{' '}
                            {ranking === 'record' ? `moy. ${line.average}` : `record ${line.best}`} ·
                            volée max {line.bestVolley}
                            {line.count180 > 0 && (
                              <em className="board__180"> · {line.count180}× 180</em>
                            )}
                          </span>
                        )}
                      </span>
                      <span className="board__score">
                        <span className="board__points">
                          {ranking === 'record' ? line.best : ranking === 'moyenne' ? line.average : line.worst}
                        </span>
                        <span className="board__sub">
                          {ranking === 'record' ? 'record' : ranking === 'moyenne' ? 'moyenne' : 'pire score'}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
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

          {period === 'toujours' && hallOfFame.length > 0 && (
            <section>
              <h2 className="section-title">Palmarès des mois</h2>
              <ul className="hall">
                {hallOfFame.map((entry) => (
                  <li key={entry.label} className="hall__row">
                    <span className="hall__month">{entry.label}</span>
                    <span className="hall__name">🏆 {entry.name}</span>
                    <span className="hall__score">{entry.best}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <MonthPodium players={players} stats={stats} />

      <Link href="/records" className="button-ghost records-link">
        🏅 Records de la ligue
      </Link>
    </div>
  )
}
