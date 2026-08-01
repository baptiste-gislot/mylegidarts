import type { Dart, Mult } from '@/lib/scoring'

/** Ordre des secteurs sur une cible réelle, dans le sens horaire, le 20 en haut. */
export const BOARD_SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5] as const

/** Clé d'un segment de la cible : `20:3` = T20, `25:1` = 25, `25:2` = bull. */
export function heatKey(sector: number, mult: Mult): string {
  return `${sector}:${mult}`
}

export interface HeatmapCounts {
  /** Impacts par segment (voir heatKey). Les segments jamais touchés sont absents. */
  hits: Map<string, number>
  /** Plus grand nombre d'impacts sur un même segment. */
  max: number
  /** Fléchettes hors cible. */
  misses: number
  /** Fléchettes sur la cible. */
  onTarget: number
}

/** Agrège les fléchettes par segment de cible pour la heatmap. */
export function heatmapCounts(darts: Dart[]): HeatmapCounts {
  const hits = new Map<string, number>()
  let misses = 0
  let max = 0
  for (const dart of darts) {
    if (dart.sector === 0) {
      misses++
      continue
    }
    const key = heatKey(dart.sector, dart.mult)
    const count = (hits.get(key) ?? 0) + 1
    hits.set(key, count)
    if (count > max) max = count
  }
  return { hits, max, misses, onTarget: darts.length - misses }
}
