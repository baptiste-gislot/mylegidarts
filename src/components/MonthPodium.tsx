'use client'

import { useEffect, useMemo, useState } from 'react'
import { fireConfetti } from '@/lib/effects'
import { say } from '@/lib/sound'
import type { PlayerRow, SessionRow } from '@/lib/useLeague'

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
export function MonthPodium({ players, sessions }: { players: PlayerRow[]; sessions: SessionRow[] }) {
  const [visible, setVisible] = useState(false)

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`

  const podium: Step[] = useMemo(() => {
    const bestByPlayer = new Map<string, number>()
    for (const s of sessions) {
      const d = new Date(s.created_at)
      if (d < start || d >= end) continue
      bestByPlayer.set(s.player_id, Math.max(bestByPlayer.get(s.player_id) ?? 0, s.total))
    }
    return [...bestByPlayer.entries()]
      .map(([playerId, best]) => ({
        name: players.find((p) => p.id === playerId)?.name ?? '?',
        best,
      }))
      .sort((a, b) => b.best - a.best)
      .slice(0, 3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, sessions, monthKey])

  useEffect(() => {
    if (podium.length === 0) return
    if (localStorage.getItem(SEEN_KEY) === monthKey) return
    setVisible(true)
    void fireConfetti('record')
    say(`Le podium de ${monthFormat.format(start)} : ${podium[0].name}, champion du mois !`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podium.length, monthKey])

  function close() {
    localStorage.setItem(SEEN_KEY, monthKey)
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
      <h2 className="podium__title">Podium de {monthFormat.format(start)}</h2>
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
