'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { fireConfetti } from '@/lib/effects'
import { say } from '@/lib/sound'
import { monthKey, type PlayerMonthStats, type PlayerRow } from '@/lib/useLeague'

const SEEN_KEY = 'mylegidarts-podium-vu'

const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

interface Step {
  name: string
  best: number
}

/**
 * Au premier lancement de l'app un nouveau mois, célèbre le podium
 * du mois écoulé (une fois par appareil). C'est une fenêtre modale : le
 * classement reste derrière, assombri, et Échap ou un clic à côté la referme.
 */
export function MonthPodium({ players, stats }: { players: PlayerRow[]; stats: PlayerMonthStats[] }) {
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const confettiRef = useRef<HTMLCanvasElement>(null)

  const now = new Date()
  const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const previousMonth = monthKey(previousMonthDate)

  const podium: Step[] = useMemo(
    () =>
      stats
        .filter((s) => s.month === previousMonth)
        .sort((a, b) => b.best_total - a.best_total)
        .slice(0, 3)
        .map((s) => ({
          name: players.find((p) => p.id === s.player_id)?.name ?? '?',
          best: s.best_total,
        })),
    [players, stats, previousMonth],
  )

  useEffect(() => {
    if (podium.length === 0) return
    if (localStorage.getItem(SEEN_KEY) === previousMonth) return
    setVisible(true)
    void say(
      `Le podium de ${monthFormat.format(previousMonthDate)} : ${podium[0].name}, champion du mois !`,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podium.length, previousMonth])

  useEffect(() => {
    if (!visible) return
    dialogRef.current?.showModal()
    void fireConfetti('record', confettiRef.current)
  }, [visible])

  // La fenêtre repart par où elle est arrivée ; sans animation, elle part tout de suite.
  function close() {
    localStorage.setItem(SEEN_KEY, previousMonth)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setVisible(false)
    else setClosing(true)
  }

  if (!visible || podium.length === 0) return null

  const medals = ['🥇', '🥈', '🥉']
  // ordre d'affichage : 2e, 1er, 3e (le vainqueur au centre, plus haut)
  const display = [podium[1], podium[0], podium[2]].filter(Boolean) as Step[]
  const rankOf = (step: Step) => podium.indexOf(step)

  return (
    <dialog
      ref={dialogRef}
      className={closing ? 'podium podium--closing' : 'podium'}
      aria-label="Podium du mois écoulé"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) close()
      }}
      onAnimationEnd={(e) => {
        if (closing && e.animationName === 'podium-out') setVisible(false)
      }}
    >
      <div className="podium__card">
        <p className="podium__eyebrow">Le mois est terminé</p>
        <h2 className="podium__title">Podium de {monthFormat.format(previousMonthDate)}</h2>
        <div className="podium__steps">
          {display.map((step) => {
            const rank = rankOf(step)
            return (
              <div key={step.name} className={`podium__step podium__step--${rank + 1}`}>
                <span className="podium__medal">{medals[rank]}</span>
                <span className="podium__name">{step.name}</span>
                <span className="podium__score">{step.best}</span>
                <span className="podium__block" />
              </div>
            )
          })}
        </div>
        <button type="button" className="button-primary podium__close" onClick={close} autoFocus>
          Nouveau mois, nouveau défi
        </button>
      </div>
      <canvas ref={confettiRef} className="podium__confetti" aria-hidden="true" />
    </dialog>
  )
}
