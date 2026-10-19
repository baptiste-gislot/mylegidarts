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
import { SIDE_LABEL, teamPlayers, type Side } from '@/lib/fletanque'
import { replay301 } from '@/lib/play301'
import { TURN_GAMES, isTurnGame } from '@/lib/gameCatalog'
import {
  useLiveMatches,
  type LiveMatch,
  type LiveMatchFletanque,
  type LiveMatchTurn,
} from '@/lib/liveMatch'
import { supabase } from '@/lib/supabaseClient'

export default function LivePage() {
  const matches = useLiveMatches()

  if (!supabase) return <SetupNotice />

  if (matches.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">Aucune partie en cours</p>
        <p>
          Dès que quelqu’un lance une partie dans l’onglet{' '}
          <Link href="/tirer">Jouer</Link>, elle apparaîtra ici en direct.
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
  // En flétanque, aucune fléchette n'est notée : le tireur diffuse son résumé.
  if (match.fletanque) return <LiveFletanqueCard match={match} flet={match.fletanque} />
  if (match.turn && match.mode && isTurnGame(match.mode)) {
    return <LiveTurnCard match={match} turn={match.turn} label={TURN_GAMES[match.mode].label} />
  }
  return <LiveScoreCard match={match} />
}

/** Le direct d'une flétanque : deux équipes, leur score et l'équipe qui ouvre. */
function LiveFletanqueCard({ match, flet }: { match: LiveMatch; flet: LiveMatchFletanque }) {
  return (
    <section className="live-card" aria-live="polite">
      <div className="live-card__head">
        <span className="live-card__status">
          <span className="live-dot" aria-hidden="true" />
          {match.finished
            ? 'Terminée — en attente d’enregistrement'
            : `En direct · 🍹 Flétanque · mène ${flet.mene}`}
        </span>
      </div>

      <ul className="live-card__players">
        {([0, 1] as Side[]).map((side) => (
          <li
            key={side}
            className={flet.opener === side ? 'live-row live-row--active' : 'live-row'}
          >
            <span className="live-row__who">
              <span className="board__name">
                {SIDE_LABEL[side]}
                {flet.opener === side && <em className="live-row__turn"> · ouvre</em>}
              </span>
              <span className="board__record">
                {teamPlayers(side)
                  .map((index) => match.players[index]?.name ?? '?')
                  .join(' & ')}
              </span>
            </span>
            <span className="board__points">{flet.scores[side]}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Le direct d'un jeu au tour par tour : le résumé calculé par le tireur. */
function LiveTurnCard({ match, turn, label }: { match: LiveMatch; turn: LiveMatchTurn; label: string }) {
  return (
    <section className="live-card" aria-live="polite">
      <div className="live-card__head">
        <span className="live-card__status">
          <span className="live-dot" aria-hidden="true" />
          {match.finished
            ? 'Terminée — en attente d’enregistrement'
            : `En direct · ${label} · tour ${turn.round + 1}`}
        </span>
      </div>
      <ul className="live-card__players">
        {match.players.map((player, i) => {
          const active = !match.finished && turn.current === i
          const line = turn.lines[i]
          return (
            <li key={player.id} className={active ? 'live-row live-row--active' : 'live-row'}>
              <PlayerAvatar name={player.name} />
              <span className="live-row__who">
                <span className="board__name">
                  {player.name}
                  {active && <em className="live-row__turn"> · à la cible</em>}
                </span>
                <span className="board__record">{line?.secondary}</span>
              </span>
              <span className="board__points">{line?.primary}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function LiveScoreCard({ match }: { match: LiveMatch }) {
  const is301 = match.mode === '301'
  const powers = match.powers ?? null
  const thrownCount = match.darts.reduce((sum, d) => sum + d.length, 0)
  const playerCount = Math.max(1, match.players.length)
  const globalVolley = Math.floor(thrownCount / DARTS_PER_VOLLEY)
  // Avec pouvoirs, la rotation (4e fléchette, volée de rab, relance) est
  // calculée côté tireur : on affiche son résumé tel quel.
  const currentPlayerIndex = powers ? powers.current : globalVolley % playerCount
  const currentRound = powers ? powers.round : Math.floor(globalVolley / playerCount)
  const finished =
    match.finished ||
    (!is301 && !powers && thrownCount === match.players.length * DARTS_PER_SESSION)

  return (
    <section className="live-card" aria-live="polite">
      <div className="live-card__head">
        <span className="live-card__status">
          <span className="live-dot" aria-hidden="true" />
          {finished
            ? 'Terminée — en attente d’enregistrement'
            : is301
              ? `En direct · 301 · volée ${currentRound + 1}`
              : powers
                ? `En direct · 🃏 Pouvoirs · volée ${Math.min(currentRound + 1, VOLLEYS_PER_SESSION)}/${VOLLEYS_PER_SESSION}`
                : `En direct · volée ${Math.min(currentRound + 1, VOLLEYS_PER_SESSION)}/${VOLLEYS_PER_SESSION}`}
        </span>
      </div>

      <ul className="live-card__players">
        {match.players.map((player, i) => {
          const darts = match.darts[i] ?? []
          const active = !finished && i === currentPlayerIndex
          const volleyStart = active && !powers ? currentRound * DARTS_PER_VOLLEY : darts.length - (darts.length % DARTS_PER_VOLLEY || DARTS_PER_VOLLEY)
          const lastVolley = darts.slice(Math.max(0, volleyStart))
          const power = powers?.byPlayer[i]

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
                  {power && (
                    <span title={power.title} className={power.used ? 'live-power live-power--used' : 'live-power'}>
                      {power.emoji}{' '}
                    </span>
                  )}
                  {lastVolley.length > 0
                    ? lastVolley.map(dartLabel).join(' ')
                    : 'pas encore tiré'}
                </span>
              </span>
              <span className="board__points">
                {is301
                  ? `↓ ${replay301(darts).remaining}`
                  : powers
                    ? powers.totals[i]
                    : sessionTotal(darts)}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
