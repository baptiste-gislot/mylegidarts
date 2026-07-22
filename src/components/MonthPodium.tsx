'use client'

import { useEffect, useMemo, useState } from 'react'
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
 * du mois écoulé (une fois par appareil).
 */
export function MonthPodium({ players, stats }: { players: PlayerRow[]; stats: PlayerMonthStats[] }) {
  const [visible, setVisible] = useState(false)

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
    void fireConfetti('record')
    say(`Le podium de ${monthFormat.format(previousMonthDate)} : ${podium[0].name}, champion du mois !`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podium.length, previousMonth])

  function close() {
    localStorage.setItem(SEEN_KEY, previousMonth)
    setVisible(false)
  }

  if (!visible || podium.length === 0) return null

  const medals = ['🥇', '🥈', '🥉']
  // ordre d'affichage : 2e, 1er, 3e (le vainqueur au centre, plus haut)
  const display = [podium[1], podium[0], podium[2]].filter(Boolean) as Step[]
  const rankOf = (step: Step) => podium.indexOf(step)

  return (
    <div className="podium" role="dialog" aria-modal="true" aria-label="Podium du mois écoulé">
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
      <button type="button" className="button-primary podium__close" onClick={close}>
        Nouveau mois, nouveau défi
      </button>
    </div>
  )
}
