import { describe, expect, it } from 'vitest'
import { flopLine, praise, trashTalk } from './trashTalk'

describe('trashTalk', () => {
  it('chambre systématiquement une volée faible', () => {
    for (let i = 0; i < 20; i++) {
      expect(trashTalk(15)).toBeTypeOf('string')
      expect(trashTalk(20)).toBeTypeOf('string')
    }
  })

  it('a des répliques dédiées pour zéro', () => {
    expect(trashTalk(0)).toBeTypeOf('string')
  })

  it('laisse tranquille au-dessus de 20', () => {
    for (let i = 0; i < 20; i++) {
      expect(trashTalk(21)).toBeNull()
      expect(trashTalk(60)).toBeNull()
    }
  })
})

describe('flopLine', () => {
  it('rend toujours la même pique pour la même graine', () => {
    const first = flopLine('abc-42')
    for (let i = 0; i < 20; i++) {
      expect(flopLine('abc-42')).toBe(first)
    }
    expect(first).toBeTypeOf('string')
    expect(first.length).toBeGreaterThan(0)
  })

  it('varie selon la graine', () => {
    const seen = new Set(Array.from({ length: 50 }, (_, i) => flopLine(`joueur-${i}`)))
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe('praise', () => {
  it('félicite systématiquement à 140 et plus', () => {
    for (let i = 0; i < 20; i++) {
      expect(praise(140)).toBeTypeOf('string')
      expect(praise(180)).toBeTypeOf('string')
    }
  })

  it('ne félicite jamais sous 100', () => {
    for (let i = 0; i < 20; i++) {
      expect(praise(99)).toBeNull()
      expect(praise(21)).toBeNull()
    }
  })
})
