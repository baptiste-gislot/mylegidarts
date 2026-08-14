import { describe, expect, it } from 'vitest'
import { flopLine, praise, trashTalk, volleyComment, type Punchline } from './trashTalk'

const taunt = (threshold: number, text = `pique ≤ ${threshold}`): Punchline => ({
  kind: 'taunt',
  text,
  threshold,
})
const congrat = (threshold: number, text = `compliment ≥ ${threshold}`): Punchline => ({
  kind: 'congrat',
  text,
  threshold,
})
const flop = (text: string): Punchline => ({ kind: 'flop', text, threshold: 0 })

// Un répertoire réduit aux mêmes seuils que le semis d'origine.
const repertoire: Punchline[] = [
  taunt(0, 'zéro pile'),
  taunt(20, 'petite volée'),
  congrat(40, 'belle volée'),
  congrat(60, 'énorme volée'),
  flop('flop du tableau'),
]

describe('trashTalk', () => {
  it('chambre systématiquement quand un seuil de pique couvre la volée', () => {
    for (let i = 0; i < 20; i++) {
      expect(trashTalk(15, repertoire)).toBeTypeOf('string')
      expect(trashTalk(20, repertoire)).toBeTypeOf('string')
    }
  })

  it('les répliques à seuil zéro ne sortent qu’à zéro pile', () => {
    const atZero = new Set(Array.from({ length: 300 }, () => trashTalk(0, repertoire)))
    expect(atZero.has('zéro pile')).toBe(true)
    const atFive = new Set(Array.from({ length: 300 }, () => trashTalk(5, repertoire)))
    expect(atFive.has('zéro pile')).toBe(false)
  })

  it('se tait quand aucun seuil ne couvre la volée', () => {
    for (let i = 0; i < 20; i++) {
      expect(trashTalk(21, repertoire)).toBeNull()
      expect(trashTalk(60, repertoire)).toBeNull()
    }
  })

  it('tire dans le pot commun sans favoriser personne', () => {
    const lines = [taunt(20, 'a'), taunt(20, 'b'), taunt(35, 'c')]
    const seen = new Set(Array.from({ length: 300 }, () => trashTalk(15, lines)))
    expect(seen).toEqual(new Set(['a', 'b', 'c']))
  })
})

describe('praise', () => {
  it('félicite systématiquement dès qu’un seuil de compliment est atteint', () => {
    for (let i = 0; i < 20; i++) {
      expect(praise(40, repertoire)).toBeTypeOf('string')
      expect(praise(180, repertoire)).toBeTypeOf('string')
    }
  })

  it('jamais sous le plus petit seuil de compliment', () => {
    for (let i = 0; i < 20; i++) {
      expect(praise(39, repertoire)).toBeNull()
    }
  })

  it('réserve les compliments à seuil haut aux grosses volées', () => {
    const modest = new Set(Array.from({ length: 300 }, () => praise(45, repertoire)))
    expect(modest).toEqual(new Set(['belle volée']))
    const big = new Set(Array.from({ length: 300 }, () => praise(70, repertoire)))
    expect(big).toEqual(new Set(['belle volée', 'énorme volée']))
  })
})

describe('volleyComment', () => {
  it('compliment d’abord, pique sinon', () => {
    for (let i = 0; i < 20; i++) {
      expect(volleyComment(45, [taunt(50), congrat(40)])).toBe('compliment ≥ 40')
      expect(volleyComment(15, repertoire)).toBeTypeOf('string')
    }
  })

  it('reste muet entre les zones ou avec un répertoire vide', () => {
    for (let i = 0; i < 20; i++) {
      expect(volleyComment(30, repertoire)).toBeNull()
      expect(volleyComment(15, [])).toBeNull()
    }
  })
})

describe('flopLine', () => {
  const lines = [flop('un'), flop('deux'), flop('trois'), taunt(20)]

  it('rend toujours la même pique pour la même graine', () => {
    const first = flopLine('abc-42', lines)
    for (let i = 0; i < 20; i++) {
      expect(flopLine('abc-42', lines)).toBe(first)
    }
    expect(first).toBeTypeOf('string')
  })

  it('varie selon la graine', () => {
    const seen = new Set(Array.from({ length: 50 }, (_, i) => flopLine(`joueur-${i}`, lines)))
    expect(seen.size).toBeGreaterThan(1)
  })

  it('null sans pique de tableau dans le répertoire', () => {
    expect(flopLine('abc-42', [taunt(20), congrat(40)])).toBeNull()
  })
})
