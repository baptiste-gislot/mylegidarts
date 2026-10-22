'use client'

import { useSyncExternalStore } from 'react'
import { setSoundsEnabled, soundsEnabled, subscribeSounds } from '@/lib/sound'

/**
 * Coupe ou rétablit sons et annonceur. Avec `voice`, le titre nomme la voix
 * retenue : sur le kiosque, c'est le moyen le plus court de vérifier que
 * Piper a bien été trouvé. Plusieurs exemplaires peuvent vivre en même temps
 * (en-tête, barre de partie) : ils lisent tous le même réglage.
 */
export function SoundToggle({ voice }: { voice?: string | null }) {
  const on = useSyncExternalStore(subscribeSounds, soundsEnabled, () => true)

  return (
    <button
      type="button"
      className="sound-toggle"
      onClick={() => setSoundsEnabled(!on)}
      aria-pressed={on}
      aria-label={on ? 'Couper les sons et l’annonceur' : 'Activer les sons et l’annonceur'}
      title={
        !on
          ? 'Sons coupés'
          : voice === undefined
            ? 'Sons activés'
            : `Sons activés — annonceur : ${voice ?? 'voix système par défaut'}`
      }
    >
      {on ? '🔊' : '🔇'}
    </button>
  )
}
