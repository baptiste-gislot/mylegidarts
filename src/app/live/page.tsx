'use client'

import Link from 'next/link'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { SetupNotice } from '@/components/SetupNotice'
import {
  DARTS_PER_SESSION,
  DARTS_PER_VOLLEY,
  VOLLEYS_PER_SESSION,
  dartLabel,
  sessionTotal,
} from '@/lib/scoring'
import { useLiveMatches, type LiveMatch } from '@/lib/liveMatch'
import { supabase } from '@/lib/supabaseClient'

export default function LivePage() {
  const matches = useLiveMatches()

  if (!supabase) return <SetupNotice />

  if (matches.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">Aucune partie en cours</p>
        <p>
          Dès que quelqu’un lance une session dans l’onglet{' '}
          <Link href="/tirer">Tirer</Link>, elle apparaîtra ici en direct.
        </p>
      </div>
    )
  }

  return (
    <div className="stack">
      {matches.map((match) => (
        <LiveMatchCard key={match.id} match={match} />
      ))}
    </div>
  )
}

function LiveMatchCard({ match }: { match: LiveMatch }) {
  const thrownCount = match.darts.reduce((sum, d) => sum + d.length, 0)
  const playerCount = Math.max(1, match.players.length)
  const globalVolley = Math.floor(thrownCount / DARTS_PER_VOLLEY)
  const currentPlayerIndex = globalVolley % playerCount
  const currentRound = Math.floor(globalVolley / playerCount)
  const finished = match.finished || thrownCount === match.players.length * DARTS_PER_SESSION

  return (
    <section className="live-card" aria-live="polite">
      <div className="live-card__head">
        <span className="live-card__status">
          <span className="live-dot" aria-hidden="true" />
          {finished ? 'Terminée — en attente d’enregistrement' : `En direct · volée ${Math.min(currentRound + 1, VOLLEYS_PER_SESSION)}/${VOLLEYS_PER_SESSION}`}
        </span>
      </div>

      <ul className="live-card__players">
        {match.players.map((player, i) => {
          const darts = match.darts[i] ?? []
          const active = !finished && i === currentPlayerIndex
          const volleyStart = active ? currentRound * DARTS_PER_VOLLEY : darts.length - (darts.length % DARTS_PER_VOLLEY || DARTS_PER_VOLLEY)
          const lastVolley = darts.slice(Math.max(0, volleyStart))

          return (
            <li key={player.id} className={active ? 'live-row live-row--active' : 'live-row'}>
              <PlayerAvatar name={player.name} />
              <span className="live-row__who">
                <span className="board__name">
                  {player.name}
                  {player.nickname && <em className="board__nickname"> « {player.nickname} »</em>}
                  {active && <em className="live-row__turn"> · à la cible</em>}
                </span>
                <span className="board__record">
                  {lastVolley.length > 0
                    ? lastVolley.map(dartLabel).join(' ')
                    : 'pas encore tiré'}
                </span>
              </span>
              <span className="board__points">{sessionTotal(darts)}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
