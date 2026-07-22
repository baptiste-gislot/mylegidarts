// Piques et compliments de l'annonceur. Bienveillant, mais à peine.

const LOW_VOLLEY_LINES = [
  'La cible est en face, pourtant.',
  'Le mur, lui, n’avait rien demandé.',
  'On dira que c’était un tir de réglage.',
  'Même la craie a eu peur.',
  'Courageux de continuer.',
  'La fléchette a fait ce qu’elle a pu.',
  'Quelqu’un a bougé la cible, sûrement.',
  'Ça ira mieux au prochain café.',
  'On a vu des fléchettes plus motivées.',
  'C’est le coude ou la vue ?',
  'Le tableau ne juge pas. Nous, si.',
  'La prochaine tournée est pour toi, ça motive.',
  'Heureusement que c’est l’intention qui compte.',
  'Tu vises le 20 ou tu improvises ?',
]

const ZERO_VOLLEY_LINES = [
  'Zéro. Historique.',
  'Trois fléchettes, zéro point. Respect.',
  'Le sol est touché, la cible non.',
  'Personne n’a rien vu, promis.',
  'On encadre celle-là ?',
]

const GOOD_VOLLEY_LINES = [
  'Belle volée !',
  'Propre.',
  'Voilà qui met la pression.',
  'Le sisal s’en souviendra.',
  'Ça commence à sentir le record.',
  'Joli bras.',
]

const BIG_VOLLEY_LINES = [
  'Énorme !',
  'Ça, c’est du tir !',
  'On se calme, c’est censé être un loisir.',
  'Quelqu’un a pris une licence en douce.',
  'Le patron de la cible.',
  'Magistral !',
]

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]
}

/**
 * Une pique aléatoire pour une volée faible, ou null.
 * Volontairement pas systématique pour ne pas lasser.
 */
export function trashTalk(volleyTotal: number): string | null {
  if (volleyTotal === 0) return pick(ZERO_VOLLEY_LINES)
  if (volleyTotal > 20 || Math.random() > 0.45) return null
  return pick(LOW_VOLLEY_LINES)
}

/** Un compliment pour une belle volée (systématique à 140+, occasionnel à 100+). */
export function praise(volleyTotal: number): string | null {
  if (volleyTotal >= 140) return pick(BIG_VOLLEY_LINES)
  if (volleyTotal >= 100 && Math.random() <= 0.6) return pick(GOOD_VOLLEY_LINES)
  return null
}
