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
  it('sans historique : félicite systématiquement dès 60 (double de la volée maison supposée)', () => {
    for (let i = 0; i < 20; i++) {
      expect(praise(60)).toBeTypeOf('string')
      expect(praise(180)).toBeTypeOf('string')
    }
  })

  it('sans historique : ne félicite jamais sous 35', () => {
    for (let i = 0; i < 20; i++) {
      expect(praise(34)).toBeNull()
      expect(praise(21)).toBeNull()
    }
  })

  it('se calibre sur la moyenne réelle de l’équipe', () => {
    for (let i = 0; i < 20; i++) {
      // Équipe modeste (20/volée) : 50 points, c'est déjà énorme.
      expect(praise(50, 20)).toBeTypeOf('string')
      // Équipe forte (60/volée) : 80 points ne mérite même pas un mot.
      expect(praise(80, 60)).toBeNull()
      expect(praise(120, 60)).toBeTypeOf('string')
    }
  })

  it('plafonne l’exigence à 140, même pour une équipe de tueurs', () => {
    for (let i = 0; i < 20; i++) {
      expect(praise(140, 100)).toBeTypeOf('string')
    }
  })
})
