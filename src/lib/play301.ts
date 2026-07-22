import { dartValue, volleys, type Dart } from './scoring'

export const START_301 = 301

export interface Replay301 {
  /** Points restants à descendre. */
  remaining: number
  /** Points marqués (301 - remaining). */
  scored: number
  /** true si le joueur a atteint exactement 0. */
  finished: boolean
  /** true si la dernière volée jouée a été annulée (bust). */
  lastVolleyBusted: boolean
}

/**
 * Rejoue une séquence de fléchettes en mode 301 (sortie sèche, sans double
 * obligatoire). Une fléchette qui ferait passer sous 0 annule toute la
 * volée (bust) : le score revient au début de la volée.
 *
 * Convention de stockage : les volées font toujours 3 fléchettes ; quand un
 * bust ou une victoire écourte une volée, elle est complétée par des
 * fléchettes « ratées » (sector 0) qui ne changent rien au calcul.
 */
export function replay301(darts: Dart[]): Replay301 {
  let remaining = START_301
  let lastVolleyBusted = false

  for (const volley of volleys(darts)) {
    const volleyStart = remaining
    lastVolleyBusted = false
    for (const dart of volley) {
      const value = dartValue(dart)
      if (remaining - value < 0) {
        remaining = volleyStart
        lastVolleyBusted = true
        break
      }
      remaining -= value
      if (remaining === 0) {
        return { remaining: 0, scored: START_301, finished: true, lastVolleyBusted: false }
      }
    }
  }

  return { remaining, scored: START_301 - remaining, finished: false, lastVolleyBusted }
}

/** Complète la volée en cours à 3 fléchettes avec des « ratés » neutres. */
export function padVolley(darts: Dart[]): Dart[] {
  const padded = [...darts]
  while (padded.length % 3 !== 0) padded.push({ sector: 0, mult: 1 })
  return padded
}
