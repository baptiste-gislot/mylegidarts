import { describe, expect, it } from 'vitest'
import {
  bestVolley,
  count180s,
  dartBreakdown,
  dartLabel,
  dartValue,
  isValidDart,
  sessionTotal,
  volleys,
  type Dart,
} from './scoring'

const d = (sector: number, mult: 1 | 2 | 3 = 1): Dart => ({ sector, mult })

describe('dartValue', () => {
  it('multiplie le secteur', () => {
    expect(dartValue(d(20, 3))).toBe(60)
    expect(dartValue(d(19, 2))).toBe(38)
    expect(dartValue(d(5))).toBe(5)
  })

  it('gère le bull et le raté', () => {
    expect(dartValue(d(25))).toBe(25)
    expect(dartValue(d(25, 2))).toBe(50)
    expect(dartValue(d(0))).toBe(0)
  })
})

describe('dartLabel', () => {
  it('étiquette S/D/T, bull et raté', () => {
    expect(dartLabel(d(20, 3))).toBe('T20')
    expect(dartLabel(d(16, 2))).toBe('D16')
    expect(dartLabel(d(5))).toBe('S5')
    expect(dartLabel(d(25))).toBe('25')
    expect(dartLabel(d(25, 2))).toBe('BULL')
    expect(dartLabel(d(0))).toBe('✕')
  })
})

describe('sessionTotal / volleys / bestVolley', () => {
  const darts = [d(20, 3), d(20, 3), d(20, 3), d(1), d(2), d(3)]

  it('additionne toutes les fléchettes', () => {
    expect(sessionTotal(darts)).toBe(186)
  })

  it('découpe en volées de 3', () => {
    expect(volleys(darts)).toHaveLength(2)
    expect(volleys(darts.slice(0, 4))).toHaveLength(2)
    expect(volleys([])).toHaveLength(0)
  })

  it('trouve la meilleure volée', () => {
    expect(bestVolley(darts)).toBe(180)
    expect(bestVolley([])).toBe(0)
  })
})

describe('count180s', () => {
  it('ne compte que les volées complètes à 180', () => {
    expect(count180s([d(20, 3), d(20, 3), d(20, 3)])).toBe(1)
    // volée incomplète à 180 impossible, mais une partielle ne compte pas
    expect(count180s([d(20, 3), d(20, 3)])).toBe(0)
    expect(count180s([d(20, 3), d(20, 3), d(19, 3)])).toBe(0)
  })

  it('compte plusieurs 180 dans une session', () => {
    const perfect = [d(20, 3), d(20, 3), d(20, 3)]
    expect(count180s([...perfect, ...perfect])).toBe(2)
  })
})

describe('dartBreakdown', () => {
  it('classe chaque fléchette dans une seule catégorie', () => {
    const breakdown = dartBreakdown([d(20, 3), d(16, 2), d(5), d(25), d(25, 2), d(0)])
    expect(breakdown).toEqual({
      triples: 1,
      doubles: 1,
      simples: 1,
      bulls: 2,
      rates: 1,
      total: 6,
    })
  })
})

describe('isValidDart', () => {
  it('accepte les fléchettes légales', () => {
    expect(isValidDart(d(20, 3))).toBe(true)
    expect(isValidDart(d(25, 2))).toBe(true)
    expect(isValidDart(d(0))).toBe(true)
  })

  it('rejette secteur ou multiplicateur impossibles', () => {
    expect(isValidDart({ sector: 21, mult: 1 })).toBe(false)
    expect(isValidDart({ sector: 20, mult: 4 })).toBe(false)
    expect(isValidDart({ sector: 25, mult: 3 })).toBe(false) // triple bull n'existe pas
    expect(isValidDart(null)).toBe(false)
  })
})
