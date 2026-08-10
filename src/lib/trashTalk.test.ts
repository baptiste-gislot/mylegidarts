import { describe, expect, it } from 'vitest'
import { flopLine, praise, trashTalk, volleyComment, type Punchline } from './trashTalk'

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

describe('punchlines maison', () => {
  const taunt = (threshold: number): Punchline => ({
    kind: 'taunt',
    text: 'pique maison',
    threshold,
  })
  const congrat = (threshold: number): Punchline => ({
    kind: 'congrat',
    text: 'compliment maison',
    threshold,
  })

  it('une pique maison élargit la zone de chambrage jusqu’à son seuil', () => {
    for (let i = 0; i < 20; i++) {
      expect(trashTalk(30, [taunt(35)])).toBe('pique maison')
      expect(trashTalk(36, [taunt(35)])).toBeNull()
    }
  })

  it('dans la zone d’origine, la pique maison rejoint le tirage sans l’écraser', () => {
    const seen = new Set(Array.from({ length: 300 }, () => trashTalk(15, [taunt(20)])))
    expect(seen.has('pique maison')).toBe(true)
    expect(seen.size).toBeGreaterThan(1)
  })

  it('un compliment maison se déclenche systématiquement dès son seuil', () => {
    for (let i = 0; i < 20; i++) {
      // Équipe forte (60/volée) : le barème d'origine se tait à 40 points,
      // mais le compliment maison au seuil de 40 parle quand même.
      expect(praise(40, 60, [congrat(40)])).toBe('compliment maison')
      expect(praise(39, 60, [congrat(40)])).toBeNull()
    }
  })

  it('en cas de chevauchement de seuils, le compliment gagne', () => {
    for (let i = 0; i < 20; i++) {
      expect(volleyComment(45, 60, [taunt(50), congrat(40)])).toBe('compliment maison')
    }
  })

  it('sans punchline maison, le commentaire reste celui d’origine', () => {
    for (let i = 0; i < 20; i++) {
      expect(volleyComment(21, null)).toBeNull()
      expect(volleyComment(15, null)).toBeTypeOf('string')
      expect(volleyComment(120, null)).toBeTypeOf('string')
    }
  })
})
