// Géométrie d'une cible dessinée en SVG : angles depuis le haut, sens horaire,
// comme sur une vraie cible où le 20 est en haut.

/** 18° par secteur. */
export const SECTOR_STEP = Math.PI / 10

/** Abscisse du point de rayon r, angle a, autour du centre c. */
export function px(c: number, r: number, a: number): number {
  return c + r * Math.sin(a)
}

/** Ordonnée du point de rayon r, angle a, autour du centre c. */
export function py(c: number, r: number, a: number): number {
  return c - r * Math.cos(a)
}

/** Portion d'anneau entre les rayons r0 < r1, de l'angle a0 à a1. */
export function ringSector(c: number, r0: number, r1: number, a0: number, a1: number): string {
  return [
    `M ${px(c, r1, a0)} ${py(c, r1, a0)}`,
    `A ${r1} ${r1} 0 0 1 ${px(c, r1, a1)} ${py(c, r1, a1)}`,
    `L ${px(c, r0, a1)} ${py(c, r0, a1)}`,
    `A ${r0} ${r0} 0 0 0 ${px(c, r0, a0)} ${py(c, r0, a0)}`,
    'Z',
  ].join(' ')
}

/** Cercle plein de rayon r, en chemin (pour les combiner en evenodd). */
export function circlePath(c: number, r: number): string {
  return `M ${c - r} ${c} A ${r} ${r} 0 1 1 ${c + r} ${c} A ${r} ${r} 0 1 1 ${c - r} ${c} Z`
}
