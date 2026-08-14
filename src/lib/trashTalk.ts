// Piques et compliments de l'annonceur. Bienveillant, mais à peine.
//
// Tout le répertoire vit dans la table punchlines (les lignes d'origine y ont
// été semées par migration) : aucune distinction entre origine et maison,
// chaque ligne s'édite et se supprime, et le tirage est uniforme parmi les
// lignes dont le seuil couvre la volée.

/** Une punchline du répertoire commun, avec son seuil de déclenchement. */
export interface Punchline {
  /**
   * taunt : dite quand la volée fait AU PLUS `threshold` points ;
   * congrat : AU MOINS. flop : affichée au tableau (seuil ignoré).
   */
  kind: 'taunt' | 'congrat' | 'flop'
  text: string
  threshold: number
}

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]
}

/** Textes dont le seuil couvre cette volée, toutes origines confondues. */
function eligible(
  punchlines: Punchline[],
  kind: 'taunt' | 'congrat',
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

/** Une pique au hasard, systématique dès qu'un seuil couvre la volée. */
export function trashTalk(volleyTotal: number, punchlines: Punchline[]): string | null {
  const lines = eligible(punchlines, 'taunt', volleyTotal)
  return lines.length > 0 ? pick(lines) : null
}

/** Un compliment au hasard, systématique dès qu'un seuil est atteint. */
export function praise(volleyTotal: number, punchlines: Punchline[]): string | null {
  const lines = eligible(punchlines, 'congrat', volleyTotal)
  return lines.length > 0 ? pick(lines) : null
}

/**
 * Le commentaire de volée complet : compliment d'abord, pique sinon.
 * En cas de chevauchement de seuils, le compliment gagne donc.
 */
export function volleyComment(volleyTotal: number, punchlines: Punchline[]): string | null {
  return praise(volleyTotal, punchlines) ?? trashTalk(volleyTotal, punchlines)
}

/**
 * Pique du classement « plus petit score » : déterministe (même graine,
 * même réplique) pour que le tableau ne se réécrive pas à chaque rendu.
 * Null si le répertoire ne contient plus aucune pique de tableau.
 */
export function flopLine(seed: string, punchlines: Punchline[]): string | null {
  // Trié pour rester déterministe quel que soit l'ordre renvoyé par la base.
  const lines = punchlines
    .filter((p) => p.kind === 'flop')
    .map((p) => p.text)
    .sort()
  if (lines.length === 0) return null
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return lines[hash % lines.length]
}
