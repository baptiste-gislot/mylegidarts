import { describe, expect, it } from 'vitest'
import { BOARD_SECTORS, HEAT_LEVELS, heatKey, heatLevel, heatmapCounts } from './heatmap'
import type { Dart } from './scoring'

const d = (sector: number, mult: 1 | 2 | 3 = 1): Dart => ({ sector, mult })

describe('BOARD_SECTORS', () => {
  it('contient les 20 secteurs une seule fois', () => {
    expect(BOARD_SECTORS).toHaveLength(20)
    expect(new Set(BOARD_SECTORS).size).toBe(20)
  })

  it('respecte les voisins classiques du 20', () => {
    expect(BOARD_SECTORS[0]).toBe(20)
    expect(BOARD_SECTORS[1]).toBe(1)
    expect(BOARD_SECTORS[19]).toBe(5)
  })
})

describe('heatLevel', () => {
  it('vaut 0 pour un segment vierge ou une cible vide', () => {
    expect(heatLevel(0, 4)).toBe(0)
    expect(heatLevel(0, 0)).toBe(0)
  })

  it('répartit linéairement les paliers jusqu’au segment le plus touché', () => {
    expect(heatLevel(1, 4)).toBe(2)
    expect(heatLevel(2, 4)).toBe(3)
    expect(heatLevel(3, 4)).toBe(4)
    expect(heatLevel(4, 4)).toBe(HEAT_LEVELS)
  })

  it('garde un impact isolé visible même avec un max élevé', () => {
    expect(heatLevel(1, 20)).toBe(1)
  })

  it('le max touche toujours le palier le plus chaud', () => {
    expect(heatLevel(1, 1)).toBe(HEAT_LEVELS)
    expect(heatLevel(7, 7)).toBe(HEAT_LEVELS)
  })
})

describe('heatmapCounts', () => {
  it('agrège par segment sans confondre les multiplicateurs', () => {
    const { hits, max } = heatmapCounts([d(20, 3), d(20, 3), d(20, 1), d(19, 2)])
    expect(hits.get(heatKey(20, 3))).toBe(2)
    expect(hits.get(heatKey(20, 1))).toBe(1)
    expect(hits.get(heatKey(19, 2))).toBe(1)
    expect(hits.get(heatKey(19, 1))).toBeUndefined()
    expect(max).toBe(2)
  })

  it('distingue le 25 du bull', () => {
    const { hits } = heatmapCounts([d(25, 1), d(25, 1), d(25, 2)])
    expect(hits.get(heatKey(25, 1))).toBe(2)
    expect(hits.get(heatKey(25, 2))).toBe(1)
  })

  it('compte les ratés à part', () => {
    const { hits, misses, onTarget } = heatmapCounts([d(0), d(0), d(12)])
    expect(misses).toBe(2)
    expect(onTarget).toBe(1)
    expect(hits.has(heatKey(0, 1))).toBe(false)
  })

  it('gère une liste vide', () => {
    const { hits, max, misses, onTarget } = heatmapCounts([])
    expect(hits.size).toBe(0)
    expect(max).toBe(0)
    expect(misses).toBe(0)
    expect(onTarget).toBe(0)
  })
})
