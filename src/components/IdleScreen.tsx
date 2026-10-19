'use client'

import { useEffect, useState } from 'react'
import { PlayerAvatar } from './PlayerAvatar'
import { useLeagueContext } from '@/lib/LeagueProvider'
import { computeStandings, seasonLabel, seasonOf } from '@/lib/elo'
import { hasMatchInProgress } from '@/lib/matchInProgress'
import { computeRecords } from '@/lib/records'
import { monthKey, type PlayerRow } from '@/lib/useLeague'
import { useAllSessionStats } from '@/lib/useSessions'

/** Délai sans souris ni clavier avant que l'écran d'attente prenne l'antenne. */
const IDLE_DELAY_MS = 2 * 60 * 1000
/** Durée d'affichage de chaque écran de la rotation. */
const SLIDE_MS = 12 * 1000
const WAKE_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const

const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long' })
const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const clockFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

/** « Défi d’octobre », « Défi de mars » : élision devant une voyelle. */
function challengeTitle(date: Date): string {
  const month = monthName.format(date)
  return /^[aeiouéâ]/i.test(month) ? `Défi d’${month}` : `Défi de ${month}`
}

/**
 * L'écran d'attente du kiosque : il prend l'antenne après deux minutes sans
 * activité, uniquement sur un poste à souris et jamais pendant une partie.
 * Le moindre mouvement rend la main.
 */
export function IdleWatcher() {
  const [idle, setIdle] = useState(false)

  useEffect(() => {
    // Sur téléphone, un écran qui s'allume tout seul gênerait plus qu'il n'aide.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    let timer: ReturnType<typeof setTimeout>
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (hasMatchInProgress()) arm()
        else setIdle(true)
      }, IDLE_DELAY_MS)
    }
    const wake = () => {
      setIdle(false)
      arm()
    }
    for (const event of WAKE_EVENTS) window.addEventListener(event, wake, { passive: true })
    arm()
    return () => {
      clearTimeout(timer)
      for (const event of WAKE_EVENTS) window.removeEventListener(event, wake)
    }
  }, [])

  return idle ? <IdleScreen /> : null
}

type Slide = 'niveau' | 'defi' | 'records' | 'joueur' | 'appel'

function IdleScreen() {
  const { players, stats } = useLeagueContext()
  const { rows } = useAllSessionStats()
  const [step, setStep] = useState(0)
  const [now, setNow] = useState(() => new Date())
  // Point de départ de la rotation des fiches joueur, tiré une fois par réveil.
  const [seed] = useState(() => Math.floor(Math.random() * 1000))

  useEffect(() => {
    const rotation = setInterval(() => setStep((s) => s + 1), SLIDE_MS)
    const clock = setInterval(() => setNow(new Date()), 15 * 1000)
    return () => {
      clearInterval(rotation)
      clearInterval(clock)
    }
  }, [])

  const name = (id: string) => players.find((p) => p.id === id)?.name ?? 'Joueur supprimé'
  /** Détenteurs d'un record : au-delà de deux, on résume pour tenir sur une ligne. */
  const holders = (ids: string[]) =>
    ids.length <= 2
      ? ids.map(name).join(' & ')
      : `${ids.slice(0, 2).map(name).join(', ')} et ${ids.length - 2} autre${ids.length > 3 ? 's' : ''}`
  const currentMonth = monthKey(now)

  const month = stats
    .filter((s) => s.month === currentMonth)
    .sort((a, b) => b.best_total - a.best_total || a.sessions_count - b.sessions_count)
  const leader = month[0]

  const season = seasonOf(now.toISOString())
  const levels = rows ? computeStandings(rows, season).filter((s) => !s.provisional).slice(0, 5) : []

  const records = rows ? computeRecords(rows, stats).slice(0, 4) : []
  const recent180 = rows
    ? rows
        .filter((r) => r.count_180 > 0)
        .slice(-3)
        .reverse()
    : []

  const contenders = players.filter((p) => stats.some((s) => s.player_id === p.id))
  const featured: PlayerRow | undefined =
    contenders[(seed + Math.floor(step / 4)) % Math.max(1, contenders.length)]

  const slides: Slide[] = [
    ...(levels.length > 0 ? (['niveau'] as const) : []),
    ...(month.length > 0 ? (['defi'] as const) : []),
    ...(records.length > 0 ? (['records'] as const) : []),
    ...(featured ? (['joueur'] as const) : []),
    'appel',
  ]
  const index = step % slides.length
  const slide = slides[index]

  return (
    <div className="attente" role="region" aria-label="Écran d’attente">
      <header className="attente__bar">
        <span className="attente__bug" aria-hidden="true">
          <span>MyLegi</span>
          <span>Darts</span>
        </span>
        <time className="attente__clock" dateTime={now.toISOString()}>
          {clockFormat.format(now)}
        </time>
      </header>

      <div key={step} className="attente__stage">
        {slide === 'niveau' && (
          <>
            <h2 className="attente__title">Niveau · {seasonLabel(season).split(' · ')[0]}</h2>
            <ol className="attente__board">
              {levels.map((standing, rank) => (
                <li
                  key={standing.playerId}
                  className={rank === 0 ? 'attente__row attente__row--leader' : 'attente__row'}
                >
                  <span className="attente__rank">{rank + 1}</span>
                  <PlayerAvatar name={name(standing.playerId)} leader={rank === 0} />
                  <span className="attente__name">{name(standing.playerId)}</span>
                  <span className="attente__value">{Math.round(standing.rating)}</span>
                </li>
              ))}
            </ol>
          </>
        )}

        {slide === 'defi' && (
          <>
            <h2 className="attente__title">{challengeTitle(now)}</h2>
            <ol className="attente__board">
              {month.slice(0, 5).map((line, rank) => (
                <li
                  key={line.player_id}
                  className={rank === 0 ? 'attente__row attente__row--leader' : 'attente__row'}
                >
                  <span className="attente__rank">{rank + 1}</span>
                  <PlayerAvatar name={name(line.player_id)} leader={rank === 0} />
                  <span className="attente__name">{name(line.player_id)}</span>
                  <span className="attente__value">{line.best_total}</span>
                </li>
              ))}
            </ol>
          </>
        )}

        {slide === 'records' && (
          <>
            <h2 className="attente__title">Records de la ligue</h2>
            <ul className="attente__board">
              {records.map((entry) => (
                <li key={entry.id} className="attente__row">
                  <span className="attente__rank" aria-hidden="true">
                    {entry.icon}
                  </span>
                  <span className="attente__what">
                    <span className="attente__label">{entry.label}</span>
                    <span className="attente__name">{holders(entry.playerIds)}</span>
                  </span>
                  <span className="attente__value">{entry.value}</span>
                </li>
              ))}
            </ul>
            {recent180.length > 0 && (
              <p className="attente__ticker">
                <strong>Derniers 180</strong>
                {recent180.map((r) => (
                  <span key={r.id}>
                    {name(r.player_id)}, {dayFormat.format(new Date(r.created_at))}
                  </span>
                ))}
              </p>
            )}
          </>
        )}

        {slide === 'joueur' && featured && (
          <PlayerCard player={featured} currentMonth={currentMonth} />
        )}

        {slide === 'appel' && (
          <div className="attente__call">
            {leader ? (
              <>
                <h2 className="attente__headline">Qui détrône {name(leader.player_id)} ?</h2>
                <p className="attente__lede">
                  {leader.best_total} points à battre au {challengeTitle(now).toLowerCase()}.
                </p>
              </>
            ) : (
              <>
                <h2 className="attente__headline">La cible attend son premier tireur</h2>
                <p className="attente__lede">Personne n’a encore joué ce mois-ci.</p>
              </>
            )}
            <p className="attente__games">
              Défi 4 volées, 301 ou flétanque : la partie se lance depuis l’onglet Jouer.
            </p>
          </div>
        )}
      </div>

      <footer className="attente__foot">
        <ol className="attente__progress" aria-hidden="true">
          {slides.map((s, i) => (
            <li
              key={s}
              className={
                i === index
                  ? 'attente__segment attente__segment--on'
                  : i < index
                    ? 'attente__segment attente__segment--done'
                    : 'attente__segment'
              }
              style={i === index ? { animationDuration: `${SLIDE_MS}ms` } : undefined}
            />
          ))}
        </ol>
        <p className="attente__wake">Bougez la souris pour jouer</p>
      </footer>
    </div>
  )
}

/** La fiche d'un joueur, façon incrustation de présentation avant un match. */
function PlayerCard({ player, currentMonth }: { player: PlayerRow; currentMonth: string }) {
  const { stats } = useLeagueContext()
  const own = stats.filter((s) => s.player_id === player.id)
  const thisMonth = own.find((s) => s.month === currentMonth)
  const games = own.reduce((sum, s) => sum + s.sessions_count, 0)
  const average = Math.round(own.reduce((sum, s) => sum + s.sum_total, 0) / Math.max(1, games))

  const figures = [
    { label: 'Record', value: Math.max(...own.map((s) => s.best_total)) },
    { label: 'Moyenne', value: average },
    { label: 'Meilleure volée', value: Math.max(...own.map((s) => s.best_volley)) },
    { label: '180', value: own.reduce((sum, s) => sum + s.count_180, 0) },
  ]

  return (
    <div className="attente__card">
      <div className="attente__card-head">
        <PlayerAvatar name={player.name} />
        <div>
          <h2 className="attente__card-name">{player.name}</h2>
          {player.nickname && <p className="attente__card-nick">« {player.nickname} »</p>}
        </div>
      </div>
      <dl className="attente__figures">
        {figures.map((figure) => (
          <div key={figure.label} className="attente__figure">
            <dt>{figure.label}</dt>
            <dd>{figure.value}</dd>
          </div>
        ))}
      </dl>
      <p className="attente__card-foot">
        {games} partie{games > 1 ? 's' : ''} au défi
        {thisMonth
          ? `, dont ${thisMonth.sessions_count} ce mois-ci (record du mois : ${thisMonth.best_total})`
          : ', pas encore de partie ce mois-ci'}
      </p>
    </div>
  )
}
