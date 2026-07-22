import { describe, expect, it } from 'vitest'
import { padVolley, replay301, START_301 } from './play301'
import type { Dart } from './scoring'

const d = (sector: number, mult: 1 | 2 | 3 = 1): Dart => ({ sector, mult })
const T20 = d(20, 3)

describe('replay301', () => {
  it('démarre à 301 et descend', () => {
    expect(replay301([]).remaining).toBe(START_301)
    const result = replay301([T20, T20, T20]) // 180
    expect(result.remaining).toBe(121)
    expect(result.scored).toBe(180)
    expect(result.finished).toBe(false)
  })

  it('gagne en atteignant exactement 0', () => {
    // 301 = 180 + 121 = 180 + (T20 + T20 + 1)
    const result = replay301([T20, T20, T20, T20, T20, d(1)])
    expect(result.finished).toBe(true)
    expect(result.remaining).toBe(0)
    expect(result.scored).toBe(START_301)
  })

  it('annule toute la volée en cas de dépassement (bust)', () => {
    // reste 121 après la volée 1 ; T20+T20+T20=180 > 121 → bust
    const result = replay301([T20, T20, T20, T20, T20, T20])
    expect(result.remaining).toBe(121)
    expect(result.lastVolleyBusted).toBe(true)
  })

  it('le bust ne compte aucune fléchette de la volée, même les bonnes', () => {
    // volée 1 : 180 (reste 121) ; volée 2 : 60 puis 62... impossible ;
    // 60 + 60 = 120 (reste 1), puis 2 → bust : retour à 121
    const result = replay301([T20, T20, T20, T20, T20, d(2)])
    expect(result.remaining).toBe(121)
    expect(result.lastVolleyBusted).toBe(true)
  })

  it('les ratés de complétion (padding) ne changent rien', () => {
    const win = [T20, T20, T20, T20, T20, d(1)]
    expect(replay301(padVolley(win)).finished).toBe(true)
    const bust = padVolley([T20, T20, T20, T20, T20, T20])
    expect(replay301(bust).remaining).toBe(121)
  })

  it('une volée partielle en cours est prise en compte sans bust', () => {
    const result = replay301([T20, T20, T20, d(20)])
    expect(result.remaining).toBe(101)
    expect(result.lastVolleyBusted).toBe(false)
  })
})

describe('padVolley', () => {
  it('complète à un multiple de 3 avec des ratés', () => {
    expect(padVolley([T20])).toHaveLength(3)
    expect(padVolley([T20, T20])).toHaveLength(3)
    expect(padVolley([T20, T20, T20])).toHaveLength(3)
    expect(padVolley([])).toHaveLength(0)
    expect(padVolley([T20])[1]).toEqual({ sector: 0, mult: 1 })
  })
})
