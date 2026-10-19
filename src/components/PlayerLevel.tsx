'use client'

import { PROVISIONAL_GAMES, computeStandings, seasonLabel, seasonOf } from '@/lib/elo'
import { useAllSessionStats } from '@/lib/useSessions'

/** Le niveau d'un joueur dans la saison en cours, en tête de son profil. */
export function PlayerLevel({ playerId }: { playerId: string }) {
  const { rows } = useAllSessionStats()
  if (rows === null) return null

  const season = seasonOf(new Date().toISOString())
  const standings = computeStandings(rows, season)
  const own = standings.find((s) => s.playerId === playerId)
  const ranked = standings.filter((s) => !s.provisional)
  const rank = own && !own.provisional ? ranked.indexOf(own) + 1 : null
  const delta = own ? Math.round(own.lastDelta) : 0

  return (
    <section className="level-card" aria-label="Niveau">
      <span className="level-card__season">{seasonLabel(season).split(' · ')[0]}</span>
      {own ? (
        <>
          <span className="level-card__rating">{Math.round(own.rating)}</span>
          <span className="level-card__detail">
            {rank !== null
              ? `${rank}${rank === 1 ? 'er' : 'e'} sur ${ranked.length} au niveau`
              : `En rodage : ${own.games} partie${own.games > 1 ? 's' : ''} sur ${PROVISIONAL_GAMES}`}
            {delta !== 0 && (
              <em className={delta > 0 ? 'level-delta--up' : 'level-delta--down'}>
                {' '}
                · {delta > 0 ? `+${delta}` : `−${-delta}`} à la dernière partie
              </em>
            )}
          </span>
        </>
      ) : (
        <span className="level-card__detail">Pas encore de partie classée cette saison.</span>
      )}
    </section>
  )
}
