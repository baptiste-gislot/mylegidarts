import { describe, expect, it } from 'vitest'
import { CLOCK_STEPS, clockRules } from './games/aroundTheClock'
import { CRICKET_ROUNDS, cricketRules } from './games/cricket'
import { KILLER_LIVES, drawKillerNumbers, killerRules } from './games/killer'
import { SHANGHAI_ROUNDS, drawShanghaiTargets, shanghaiRules } from './games/shanghai'
import type { Dart } from './scoring'
import { replayTurnGame } from './turnGames'

const S = (sector: number): Dart => ({ sector, mult: 1 })
const D = (sector: number): Dart => ({ sector, mult: 2 })
const T = (sector: number): Dart => ({ sector, mult: 3 })
const MISS: Dart = { sector: 0, mult: 1 }
const misses = (n: number) => Array.from({ length: n }, () => MISS)

describe('replayTurnGame — rotation', () => {
  it('passe la main toutes les trois fléchettes et compte les manches', () => {
    const replay = replayTurnGame(cricketRules, 3, {}, misses(7))
    expect(replay.current).toBe(2)
    expect(replay.round).toBe(0)
    expect(replay.volley).toEqual([MISS])
    const next = replayTurnGame(cricketRules, 3, {}, misses(9))
    expect(next.current).toBe(0)
    expect(next.round).toBe(1)
    expect(next.volleyClosed).toBe(true)
  })

  it('range les fléchettes de chacun pour l’enregistrement', () => {
    const replay = replayTurnGame(cricketRules, 2, {}, [T(20), S(1), S(2), D(19)])
    expect(replay.dartsByPlayer).toEqual([[T(20), S(1), S(2)], [D(19)]])
  })

  it('ignore ce qui est lancé après la fin de la partie', () => {
    const replay = replayTurnGame(shanghaiRules, 1, {}, [S(1), D(1), T(1), S(5)])
    expect(replay.finished).toBe(true)
    expect(replay.dartsByPlayer[0]).toHaveLength(3)
  })
})

describe('Cricket', () => {
  it('ferme un numéro à trois marques puis marque tant qu’un adversaire l’a ouvert', () => {
    const replay = replayTurnGame(cricketRules, 2, {}, [T(20), T(20), S(1)])
    expect(replay.state.marks[0][0]).toBe(3)
    expect(replay.state.points[0]).toBe(60)
    expect(replay.lastNote).toBeNull()
  })

  it('ne marque plus sur un numéro fermé par tout le monde', () => {
    const journal = [T(20), ...misses(2), T(20), ...misses(2), T(20)]
    const replay = replayTurnGame(cricketRules, 2, {}, journal)
    expect(replay.state.points).toEqual([0, 0])
  })

  it('compte le bull 25 pour une marque et le 50 pour deux', () => {
    const replay = replayTurnGame(cricketRules, 2, {}, [D(25), S(25)])
    expect(replay.state.marks[0][6]).toBe(3)
    expect(replay.lastNote?.text).toBe('{lanceur} ferme le bull !')
  })

  it('sacre celui qui a tout fermé avec au moins autant de points', () => {
    const journal = [T(20), T(19), T(18), ...misses(3), T(17), T(16), T(15), ...misses(3), D(25), S(25)]
    const replay = replayTurnGame(cricketRules, 2, {}, journal)
    expect(replay.finished).toBe(true)
    expect(replay.winners).toEqual([0])
  })

  it('départage aux points au bout de 20 volées', () => {
    const journal = Array.from({ length: CRICKET_ROUNDS }, (_, r) =>
      r === 0 ? [T(20), T(20), MISS, ...misses(3)] : misses(6),
    ).flat()
    const replay = replayTurnGame(cricketRules, 2, {}, journal)
    expect(replay.finished).toBe(true)
    expect(replay.winners).toEqual([0])
    expect(replay.round).toBe(CRICKET_ROUNDS)
  })
})

describe('Around the clock', () => {
  it('avance d’une case sur n’importe quel segment du numéro visé', () => {
    const replay = replayTurnGame(clockRules, 1, {}, [T(1), S(3), D(2)])
    expect(replay.state.progress[0]).toBe(2)
  })

  it('finit au bull après le 20', () => {
    const run = Array.from({ length: 20 }, (_, i) => S(i + 1))
    const journal = [...run, S(25)]
    const replay = replayTurnGame(clockRules, 1, {}, journal)
    expect(replay.state.progress[0]).toBe(CLOCK_STEPS)
    expect(replay.finished).toBe(true)
    expect(replay.winners).toEqual([0])
  })
})

describe('Killer', () => {
  const setup = { numbers: [20, 1, 5] }

  it('tire des numéros distincts', () => {
    const numbers = drawKillerNumbers(6)
    expect(new Set(numbers).size).toBe(6)
    expect(numbers.every((n) => n >= 1 && n <= 20)).toBe(true)
  })

  it('fait devenir killer sur son propre double, et seulement ensuite on élimine', () => {
    const before = replayTurnGame(killerRules, 3, setup, [D(1)])
    expect(before.state.lives[1]).toBe(KILLER_LIVES)
    const after = replayTurnGame(killerRules, 3, setup, [D(20), D(1)])
    expect(after.state.killer[0]).toBe(true)
    expect(after.state.lives[1]).toBe(0)
    expect(after.lastNote).toEqual({ text: '{lanceur} élimine {cible} !', target: 1 })
  })

  it('saute les éliminés et sacre le dernier en vie', () => {
    // Le joueur 0 devient killer et élimine le 1 ; le 2 rate tout, puis tombe à son tour.
    const afterKill = replayTurnGame(killerRules, 3, setup, [D(20), D(1), MISS])
    expect(afterKill.state.lives[1]).toBe(0)
    expect(afterKill.current).toBe(2)
    const replay = replayTurnGame(killerRules, 3, setup, [D(20), D(1), MISS, ...misses(3), D(5)])
    expect(replay.finished).toBe(true)
    expect(replay.winners).toEqual([0])
  })

  it('passe la main tout de suite au killer qui s’élimine lui-même', () => {
    const replay = replayTurnGame(killerRules, 3, setup, [D(20), D(20)])
    expect(replay.state.lives[0]).toBe(0)
    expect(replay.current).toBe(1)
  })
})

describe('Shanghai', () => {
  it('ne compte que le numéro de la manche', () => {
    const replay = replayTurnGame(shanghaiRules, 2, {}, [T(1), S(2), D(1)])
    expect(replay.state.points[0]).toBe(5)
  })

  it('gagne sur-le-champ avec simple, double et triple dans la volée', () => {
    const replay = replayTurnGame(shanghaiRules, 2, {}, [S(1), T(1), D(1)])
    expect(replay.finished).toBe(true)
    expect(replay.winners).toEqual([0])
  })

  it('vise les numéros tirés au sort, manche après manche', () => {
    const targets = [17, 4, 9, 12, 1, 20, 6]
    // Joueur 0 : un 17 en manche 1 (le 1 ne compte plus), puis joueur 1, puis le 4.
    const replay = replayTurnGame(shanghaiRules, 2, { targets }, [S(17), S(1), S(1), ...misses(3), D(4)])
    expect(replay.round).toBe(1)
    expect(replay.state.points[0]).toBe(17 + 8)
  })

  it('tire sept numéros distincts entre 1 et 20', () => {
    const targets = drawShanghaiTargets()
    expect(targets).toHaveLength(SHANGHAI_ROUNDS)
    expect(new Set(targets).size).toBe(SHANGHAI_ROUNDS)
    expect(targets.every((n) => n >= 1 && n <= 20)).toBe(true)
  })

  it('se règle aux points après sept manches, ex æquo compris', () => {
    const replay = replayTurnGame(shanghaiRules, 2, {}, misses(SHANGHAI_ROUNDS * 6))
    expect(replay.finished).toBe(true)
    expect(replay.winners).toEqual([0, 1])
  })
})
