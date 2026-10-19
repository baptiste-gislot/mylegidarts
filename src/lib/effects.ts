'use client'

// Effets festifs : confettis et retour haptique.
// Tous respectent prefers-reduced-motion et ne font rien côté serveur.

function motionOk(): boolean {
  return (
    typeof window !== 'undefined' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

const PALETTE = ['#ffd23f', '#e5383b', '#f4f6ff', '#1fa35c']

export async function fireConfetti(kind: 'perfect' | 'record'): Promise<void> {
  if (!motionOk()) return
  const confetti = (await import('canvas-confetti')).default

  if (kind === 'perfect') {
    // 180 : deux canons croisés depuis le bas, dans les couleurs de la cible.
    const common = { colors: PALETTE, ticks: 220, gravity: 1.1, scalar: 1.05, zIndex: 60 }
    void confetti({ ...common, particleCount: 90, angle: 65, spread: 60, origin: { x: 0, y: 1 } })
    void confetti({ ...common, particleCount: 90, angle: 115, spread: 60, origin: { x: 1, y: 1 } })
    return
  }

  // Record : pluie généreuse depuis le haut, en trois salves.
  const burst = (delay: number, x: number) =>
    setTimeout(() => {
      void confetti({
        particleCount: 70,
        spread: 100,
        startVelocity: 32,
        colors: PALETTE,
        ticks: 260,
        gravity: 0.9,
        zIndex: 60,
        origin: { x, y: 0.1 },
      })
    }, delay)
  burst(0, 0.5)
  burst(250, 0.25)
  burst(500, 0.75)
}

/** Petit retour haptique (silencieusement ignoré si non supporté). */
export function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator && motionOk()) {
    navigator.vibrate(pattern)
  }
}
