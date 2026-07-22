'use client'

import { PlayerAvatar } from '@/components/PlayerAvatar'
import { SetupNotice } from '@/components/SetupNotice'
import { bestVolley } from '@/lib/scoring'
import { useLeague } from '@/lib/useLeague'

interface Line {
  playerId: string
  name: string
  best: number
  bestVolley: number
  sessionsCount: number
  average: number
}

export default function ClassementPage() {
  const { players, sessions, loading, error, configured } = useLeague()

  if (!configured) return <SetupNotice />
  if (loading) return <p className="empty">Chargement du classement…</p>
  if (error) return <p className="notice notice--error">Erreur : {error}</p>

  const lines: Line[] = players
    .map((player) => {
      const own = sessions.filter((s) => s.player_id === player.id)
      if (own.length === 0) return null
      return {
        playerId: player.id,
        name: player.name,
        best: Math.max(...own.map((s) => s.total)),
        bestVolley: Math.max(...own.map((s) => bestVolley(s.darts))),
        sessionsCount: own.length,
        average: Math.round(own.reduce((sum, s) => sum + s.total, 0) / own.length),
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
      {lines.length === 0 ? (
        <div className="empty">
          <p className="empty__title">Aucune session jouée</p>
          <p>Le classement apparaîtra après la première session dans l’onglet Tirer.</p>
        </div>
      ) : (
        <ol className="board">
          {lines.map((line, index) => (
            <li
              key={line.playerId}
              className={index === 0 ? 'board__row board__row--leader' : 'board__row'}
            >
              <span className="board__rank">{index + 1}</span>
              <PlayerAvatar name={line.name} leader={index === 0} />
              <span className="board__who">
                <span className="board__name">{line.name}</span>
                <span className="board__record">
                  {line.sessionsCount} session{line.sessionsCount > 1 ? 's' : ''} · moy.{' '}
                  {line.average} · volée max {line.bestVolley}
                </span>
              </span>
              <span className="board__score">
                <span className="board__points">{line.best}</span>
                <span className="board__sub">record</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {idle.length > 0 && lines.length > 0 && (
        <section>
          <h2 className="section-title">En attente d’une première session</h2>
          <ul className="board">
            {idle.map((player) => (
              <li key={player.id} className="board__row">
                <span className="board__rank">–</span>
                <PlayerAvatar name={player.name} />
                <span className="board__who">
                  <span className="board__name">{player.name}</span>
                  <span className="board__record">non classé</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
