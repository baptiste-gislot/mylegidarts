import { describe, expect, it } from 'vitest'
import { bestVolleyDetail, consistency, FORM_WINDOW, hotStreak, recentForm } from './profileStats'
import type { Dart } from './scoring'

const d = (sector: number, mult: 1 | 2 | 3 = 1): Dart => ({ sector, mult })

describe('recentForm', () => {
  it('reste muette tant que la fenêtre n’est pas dépassée', () => {
    expect(recentForm([])).toBeNull()
    expect(recentForm(Array(FORM_WINDOW).fill(200))).toBeNull()
  })

  it('compare les dernières sessions à la moyenne globale', () => {
    // Moyenne globale 200, cinq dernières à 250 : delta +50 sur la fenêtre.
    const totals = [100, 150, 250, 250, 250, 250, 150]
    const form = recentForm(totals)
    expect(form).not.toBeNull()
    expect(form!.recent).toBe(Math.round((250 + 250 + 250 + 250 + 150) / 5))
    expect(form!.delta).toBe(form!.recent - Math.round(totals.reduce((a, b) => a + b) / totals.length))
  })

  it('signale une baisse par un delta négatif', () => {
    const form = recentForm([300, 300, 300, 100, 100, 100, 100, 100])
    expect(form!.delta).toBeLessThan(0)
  })
})

describe('consistency', () => {
  it('vaut 0 sans session ou avec des totaux identiques', () => {
    expect(consistency([])).toBe(0)
    expect(consistency([250, 250, 250])).toBe(0)
  })

  it('calcule l’écart-type', () => {
    // Moyenne 200, écarts ±100 : écart-type 100.
    expect(consistency([100, 300, 100, 300])).toBe(100)
  })
})

describe('hotStreak', () => {
  it('vaut 0 sans session', () => {
    expect(hotStreak([])).toBe(0)
  })

  it('compte les sessions consécutives au niveau de la moyenne, en partant de la fin', () => {
    // Moyenne 200 : les deux dernières sont au-dessus, la précédente casse la série.
    expect(hotStreak([300, 100, 100, 250, 250])).toBe(2)
  })

  it('une session à la moyenne exacte prolonge la série', () => {
    expect(hotStreak([200, 200])).toBe(2)
  })
})

describe('bestVolleyDetail', () => {
  it('retourne null sans session', () => {
    expect(bestVolleyDetail([])).toBeNull()
  })

  it('trouve la volée maximale et sa session', () => {
    const best = bestVolleyDetail([
      { darts: [d(20, 3), d(20, 3), d(20, 1), d(1), d(1), d(1)], created_at: '2026-07-01' },
      { darts: [d(20, 3), d(20, 3), d(19, 3), d(5), d(5), d(5)], created_at: '2026-07-12' },
    ])
    expect(best!.total).toBe(177)
    expect(best!.createdAt).toBe('2026-07-12')
    expect(best!.darts).toEqual([d(20, 3), d(20, 3), d(19, 3)])
  })
})
