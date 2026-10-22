'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PlayerAvatar } from './PlayerAvatar'
import {
  PROVISIONAL_GAMES,
  computeStandings,
  seasonLabel,
  seasonOf,
  seasonsPlayed,
  type Standing,
} from '@/lib/elo'
import type { PlayerRow } from '@/lib/useLeague'
import { useAllSessionStats } from '@/lib/useSessions'

/** Variation affichée : « +12 », « −8 », rien quand elle est nulle. */
function deltaLabel(delta: number): string | null {
  const rounded = Math.round(delta)
  if (rounded === 0) return null
  return rounded > 0 ? `+${rounded}` : `−${-rounded}`
}

/** Le classement de niveau d'une saison, avec accès aux saisons archivées. */
export function LevelStandings({ players }: { players: PlayerRow[] }) {
  const { rows, error } = useAllSessionStats()
  const current = seasonOf(new Date().toISOString())
  const [season, setSeason] = useState(current)

  if (error) return <p className="notice notice--error">Erreur : {error}</p>
  if (rows === null) return <p className="empty">Calcul des niveaux…</p>

  const seasons = [...new Set([current, ...seasonsPlayed(rows)])]
  const standings = computeStandings(rows, season)
  const ranked = standings.filter((s) => !s.provisional)
  const rookies = standings.filter((s) => s.provisional)
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? 'Joueur supprimé'

  return (
    <div className="stack">
      <div className="level-head">
        <h2 className="level-head__title">{seasonLabel(season)}</h2>
        {seasons.length > 1 && (
          <div className="chips" role="radiogroup" aria-label="Saison">
            {seasons.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={season === key}
                className={season === key ? 'chip chip--on' : 'chip'}
                onClick={() => setSeason(key)}
              >
                {key === current ? 'En cours' : seasonLabel(key).split(' · ')[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      {ranked.length === 0 ? (
        <div className="empty">
          <p className="empty__title">Personne n’est encore classé</p>
          <p>
            Le niveau se gagne au défi 4 volées sans pouvoirs, à deux joueurs ou plus. On entre au
            classement après {PROVISIONAL_GAMES} parties dans la saison.
          </p>
        </div>
      ) : (
        <ol className="board">
          {ranked.map((s, index) => (
            <StandingRow key={s.playerId} standing={s} rank={index + 1} name={name(s.playerId)} />
          ))}
        </ol>
      )}

      {rookies.length > 0 && (
        <section>
          <h2 className="section-title">En rodage</h2>
          <ul className="board">
            {rookies.map((s) => (
              <StandingRow key={s.playerId} standing={s} rank={null} name={name(s.playerId)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function StandingRow({ standing: s, rank, name }: { standing: Standing; rank: number | null; name: string }) {
  const delta = deltaLabel(s.lastDelta)
  const leader = rank === 1
  return (
    <li>
      <Link
        href={`/profil/${s.playerId}`}
        className={leader ? 'board__row board__row--leader' : 'board__row'}
      >
        <span className="board__rank">{rank ?? '–'}</span>
        <PlayerAvatar name={name} leader={leader} />
        <span className="board__who">
          <span className="board__name">{name}</span>
          <span
            className="board__record"
            title={`Duels : ${s.wins} gagnés, ${s.draws} nuls, ${s.losses} perdus`}
          >
            {rank === null ? (
              `${s.games} partie${s.games > 1 ? 's' : ''} sur ${PROVISIONAL_GAMES} pour être classé`
            ) : (
              // Deux blocs insécables : la ligne ne se coupe qu'entre les parties et le bilan.
              <>
                <span className="nowrap">{s.games} parties</span> ·{' '}
                <span className="nowrap">
                  {s.wins} V · {s.draws} N · {s.losses} D
                </span>
              </>
            )}
          </span>
        </span>
        <span className="board__score">
          <span className="board__points">{Math.round(s.rating)}</span>
          {delta && (
            <span
              className={s.lastDelta > 0 ? 'board__sub level-delta level-delta--up' : 'board__sub level-delta level-delta--down'}
              title="Variation à la dernière partie"
            >
              {delta}
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}
