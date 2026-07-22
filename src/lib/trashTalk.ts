// Piques de l'annonceur sur les volées ratées. Bienveillant, mais à peine.

const LOW_VOLLEY_LINES = [
  'La cible est en face, pourtant.',
  'Le mur, lui, n’avait rien demandé.',
  'On dira que c’était un tir de réglage.',
  'Même la craie a eu peur.',
  'Courageux de continuer.',
  'La fléchette a fait ce qu’elle a pu.',
  'Quelqu’un a bougé la cible, sûrement.',
  'Ça ira mieux au prochain café.',
]

const ZERO_VOLLEY_LINES = [
  'Zéro. Historique.',
  'Trois fléchettes, zéro point. Respect.',
  'Le sol est touché, la cible non.',
]

/**
 * Une pique aléatoire pour une volée faible, ou null.
 * Volontairement pas systématique pour ne pas lasser.
 */
export function trashTalk(volleyTotal: number): string | null {
  if (volleyTotal === 0) {
    return ZERO_VOLLEY_LINES[Math.floor(Math.random() * ZERO_VOLLEY_LINES.length)]
  }
  if (volleyTotal > 20 || Math.random() > 0.45) return null
  return LOW_VOLLEY_LINES[Math.floor(Math.random() * LOW_VOLLEY_LINES.length)]
}
