import { describe, expect, it } from 'vitest'
import { praise, trashTalk } from './trashTalk'

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
