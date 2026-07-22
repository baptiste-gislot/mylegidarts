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
  'La cible a plus peur de ton haleine que de tes fléchettes.',
  'C’était un échauffement, on va dire.',
  'Il paraît que la pratique paie. Un jour.',
  'Les lunettes, c’est remboursé par la mutuelle.',
  'Ta technique est unique. Garde-la pour toi.',
  'On lance avec la main, pas avec les yeux fermés.',
  'Le stagiaire fait mieux. Et il n’a pas de bras.',
  'Ce n’est plus du sport, c’est de l’art abstrait.',
  'Rassure-moi, tu tenais la fléchette dans le bon sens ?',
]

const ZERO_VOLLEY_LINES = [
  'Zéro. Historique.',
  'Trois fléchettes, zéro point. Respect.',
  'Le sol est touché, la cible non.',
  'Personne n’a rien vu, promis.',
  'On encadre celle-là ?',
  'Trois lancers, zéro dégât. La cible te remercie.',
  'Statistiquement, c’est presque impossible. Bravo ?',
  'Même en visant à côté, tu aurais marqué.',
]

const GOOD_VOLLEY_LINES = [
  'Belle volée !',
  'Propre.',
  'Voilà qui met la pression.',
  'Le sisal s’en souviendra.',
  'Ça commence à sentir le record.',
  'Joli bras.',
  'Voilà pourquoi on te laisse gagner au babyfoot.',
  'La cible n’a rien vu venir.',
  'Du travail d’orfèvre.',
  'Chirurgical.',
  'Quelqu’un s’est entraîné en cachette.',
  'Le genre de volée qui fait taire l’open space.',
]

const BIG_VOLLEY_LINES = [
  'Énorme !',
  'Ça, c’est du tir !',
  'On se calme, c’est censé être un loisir.',
  'Quelqu’un a pris une licence en douce.',
  'Le patron de la cible.',
  'Magistral !',
  'Appelez la fédération, il y a un dossier.',
  'La cible demande un arbitrage vidéo.',
  'C’est plus une volée, c’est une démonstration.',
  'Les autres peuvent rentrer chez eux.',
  'Standing ovation de la machine à café.',
  'On va devoir reculer la ligne de tir pour toi.',
]

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]
}

/** Une pique (au hasard mais systématique) dès que la volée est mauvaise. */
export function trashTalk(volleyTotal: number): string | null {
  if (volleyTotal === 0) return pick(ZERO_VOLLEY_LINES)
  if (volleyTotal > 20) return null
  return pick(LOW_VOLLEY_LINES)
}

/** Un compliment pour une belle volée (systématique à 140+, occasionnel à 100+). */
export function praise(volleyTotal: number): string | null {
  if (volleyTotal >= 140) return pick(BIG_VOLLEY_LINES)
  if (volleyTotal >= 100 && Math.random() <= 0.6) return pick(GOOD_VOLLEY_LINES)
  return null
}
