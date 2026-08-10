// Piques et compliments de l'annonceur. Bienveillant, mais à peine.

/** Punchline maison : ajoutée par un joueur, avec son seuil de déclenchement. */
export interface Punchline {
  /** taunt : dite quand la volée fait AU PLUS `threshold` points ; congrat : AU MOINS. */
  kind: 'taunt' | 'congrat'
  text: string
  threshold: number
}

/** Plafond de la zone de chambrage d'origine (piques systématiques en dessous). */
export const LOW_VOLLEY_MAX = 20

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
  'À peine plus de points que le nombre de cheveux d’Adrien.',
  'T’auras peut-être plus de succès si tu fais le canard comme César.',
  'Tu galères plus que Privel en compétition. Dur.',
  'Bientôt Baptiste aura plus d’enfants que t’as de points.',
  'T’allais passer pro, mais les croisés, tu connais.',
  'Sam Neill se retourne dans sa tombe.',
  'Si t’es pas content, va te plaindre à la RH.',
  'Reprends une dose de whey, c’est pour ton bien.',
  'Un score moins élevé que le degré des bières d’Aloïs.',
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

const FLOP_BOARD_LINES = [
  'Le tableau a demandé à rester anonyme.',
  'Gardien officiel du bas du tableau.',
  'La cible se souvient surtout du mur.',
  'Un score pareil, ça se fête. Ou pas.',
  'Le sisal a porté plainte.',
  'Champion, mais dans l’autre sens.',
  'Ce record-là, personne ne viendra le chercher.',
  'La craie a refusé de l’écrire deux fois.',
  'Validé par huissier, malheureusement.',
  'On a vérifié : la cible était bien accrochée.',
  'La moyenne de l’équipe te remercie d’exister.',
  'Même le stagiaire n’ose pas commenter.',
]

/** Répertoire d'origine, exposé pour la page récapitulative des punchlines. */
export const BUILT_IN_LINES = {
  zero: ZERO_VOLLEY_LINES,
  low: LOW_VOLLEY_LINES,
  good: GOOD_VOLLEY_LINES,
  big: BIG_VOLLEY_LINES,
  flop: FLOP_BOARD_LINES,
} as const

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]
}

/**
 * Tirage dans un pot commun où les punchlines maison éligibles raflent une
 * pièce sur deux : noyées dans le répertoire d'origine (bien plus fourni),
 * on ne les entendrait presque jamais.
 */
function pickWithCustom(builtIn: string[], custom: string[]): string {
  if (custom.length > 0 && Math.random() < 0.5) return pick(custom)
  return pick(builtIn)
}

/** Textes des punchlines maison que cette volée déclenche. */
function eligibleCustom(
  punchlines: Punchline[],
  kind: Punchline['kind'],
  volleyTotal: number,
): string[] {
  return punchlines
    .filter(
      (p) =>
        p.kind === kind &&
        (kind === 'taunt' ? volleyTotal <= p.threshold : volleyTotal >= p.threshold),
    )
    .map((p) => p.text)
}

/** Une pique (au hasard mais systématique) dès que la volée est mauvaise. */
export function trashTalk(volleyTotal: number, punchlines: Punchline[] = []): string | null {
  const custom = eligibleCustom(punchlines, 'taunt', volleyTotal)
  if (volleyTotal === 0) return pickWithCustom(ZERO_VOLLEY_LINES, custom)
  if (volleyTotal <= LOW_VOLLEY_MAX) return pickWithCustom(LOW_VOLLEY_LINES, custom)
  // Au-dessus de la zone d'origine, seules les piques maison dont le seuil
  // couvre cette volée prennent la parole — et alors systématiquement.
  return custom.length > 0 ? pick(custom) : null
}

/** Sans historique, on suppose une volée maison à 30 points (~120 par session). */
const DEFAULT_AVERAGE_VOLLEY = 30

/**
 * Seuils de compliment du moment, calibrés sur la moyenne maison. Les
 * planchers gardent les compliments au-dessus de la zone de chambrage
 * (≤ 20), les plafonds évitent d'exiger un niveau de pro.
 */
export function praiseThresholds(averageVolley: number | null): { good: number; big: number } {
  const reference =
    averageVolley !== null && averageVolley > 0 ? averageVolley : DEFAULT_AVERAGE_VOLLEY
  return {
    big: Math.min(140, Math.max(50, reference * 2)),
    good: Math.min(100, Math.max(35, reference * 1.35)),
  }
}

/**
 * Un compliment calibré sur le niveau réel de l'équipe : systématique quand
 * la volée double la moyenne maison, fréquent (60 %) dès qu'elle la dépasse
 * d'un bon tiers. Un compliment maison dont le seuil est atteint se déclenche
 * toujours, même quand le barème d'origine serait resté muet.
 */
export function praise(
  volleyTotal: number,
  averageVolley: number | null = null,
  punchlines: Punchline[] = [],
): string | null {
  const custom = eligibleCustom(punchlines, 'congrat', volleyTotal)
  const { good, big } = praiseThresholds(averageVolley)
  if (volleyTotal >= big) return pickWithCustom(BIG_VOLLEY_LINES, custom)
  if (volleyTotal >= good && Math.random() <= 0.6) return pickWithCustom(GOOD_VOLLEY_LINES, custom)
  return custom.length > 0 ? pick(custom) : null
}

/**
 * Le commentaire de volée complet : compliment d'abord, pique sinon.
 * En cas de chevauchement de seuils maison, le compliment gagne donc.
 */
export function volleyComment(
  volleyTotal: number,
  averageVolley: number | null,
  punchlines: Punchline[] = [],
): string | null {
  return praise(volleyTotal, averageVolley, punchlines) ?? trashTalk(volleyTotal, punchlines)
}

/**
 * Pique du classement « plus petit score » : déterministe (même graine,
 * même réplique) pour que le tableau ne se réécrive pas à chaque rendu.
 */
export function flopLine(seed: string): string {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return FLOP_BOARD_LINES[hash % FLOP_BOARD_LINES.length]
}
