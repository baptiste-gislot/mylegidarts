'use client'

import { useLayoutEffect, useRef } from 'react'

/** Réponse du ressort, en secondes : le temps qu'il met à presque arriver. */
const RESPONSE = 0.5
const OMEGA = (2 * Math.PI) / RESPONSE

/**
 * Un score qui défile jusqu'à sa nouvelle valeur, comme au tableau d'une
 * retransmission. Ressort sans rebond : s'il change encore en route, il
 * repart de la valeur affichée, pas de l'ancienne cible. Le texte est tenu
 * hors de React pour pouvoir l'écrire à chaque image.
 *
 * `from` : la valeur d'où partir au premier affichage (0 pour un décompte qui
 * monte à l'apparition) ; sans elle, le premier affichage est immédiat.
 */
export function RollingNumber({ value, from, className }: { value: number; from?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  /** Valeur affichée, fractionnaire pendant le défilement. */
  const shown = useRef<number | null>(from ?? null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const origin = shown.current
    const show = (v: number) => {
      shown.current = v
      el.textContent = String(Math.round(v))
    }
    if (origin === null || origin === value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      show(value)
      return
    }

    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      // L'horodatage d'une image peut précéder le départ : jamais de temps négatif.
      const t = Math.max(0, now - start) / 1000
      const progress = 1 - (1 + OMEGA * t) * Math.exp(-OMEGA * t)
      if (progress > 0.995) {
        show(value)
        return
      }
      show(origin + (value - origin) * progress)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return <span ref={ref} className={className} />
}
