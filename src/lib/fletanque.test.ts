import { describe, expect, it } from 'vitest'
import {
  DARTS_PER_PLAYER,
  DARTS_PER_TEAM,
  PLAYERS_PER_MATCH,
  TARGET_SCORE,
  migrateFletanqueJournal,
  replayFletanque,
  otherSide,
  sessionFletanque,
  teamOf,
  type FletanqueEvent,
  type Side,
} from './fletanque'

/** Le décompte d'une mène : l'équipe qui la prend et ses fléchettes devant. */
const mene = (holder: Side | null, points: number): FletanqueEvent => ({
  kind: 'mene',
  holder,
  points,
})

describe('teamOf', () => {
  it('range les deux premiers de l’ordre en équipe A, les suivants en B', () => {
    expect([0, 1, 2, 3].map(teamOf)).toEqual([0, 0, 1, 1])
  })
})

describe('replayFletanque — décompte des mènes', () => {
  it('fait ouvrir la première mène par l’équipe tirée au sort', () => {
    expect(replayFletanque(1, []).opener).toBe(1)
    expect(replayFletanque(0, []).opener).toBe(0)
  })

  it('crédite l’équipe qui prend la mène et lui fait ouvrir la suivante', () => {
    const replay = replayFletanque(0, [mene(1, 3)])
    expect(replay.scores).toEqual([0, 3])
    expect(replay.opener).toBe(1)
    expect(replay.menes).toEqual([{ holder: 1, points: 3 }])
  })

  it('ne donne rien sur une mène nulle et la fait rejouer par la même équipe', () => {
    const replay = replayFletanque(0, [mene(null, 0)])
    expect(replay.scores).toEqual([0, 0])
    expect(replay.opener).toBe(0)
    expect(replay.menes).toEqual([{ holder: null, points: 0 }])
  })

  it('compte les trois fléchettes de chacun par mène close', () => {
    const replay = replayFletanque(0, [mene(0, 1), mene(null, 0)])
    expect(replay.thrown).toEqual(Array(PLAYERS_PER_MATCH).fill(2 * DARTS_PER_PLAYER))
  })
})

describe('replayFletanque — fin de partie', () => {
  it('sacre la première équipe à 5 points', () => {
    const replay = replayFletanque(0, [mene(0, 2), mene(0, 3)])
    expect(replay.scores[0]).toBe(TARGET_SCORE)
    expect(replay.winner).toBe(0)
    expect(replay.finished).toBe(true)
  })

  it('laisse gagner une mène qui dépasse la cible', () => {
    const replay = replayFletanque(1, [mene(1, 6)])
    expect(replay.scores).toEqual([0, 6])
    expect(replay.winner).toBe(1)
  })

  it('ne déclare aucun vainqueur tant que personne n’a atteint 5', () => {
    const replay = replayFletanque(0, [mene(0, 4)])
    expect(replay.winner).toBeNull()
    expect(replay.finished).toBe(false)
  })
})

describe('replayFletanque — annulation', () => {
  it('retrouve l’état exact en retirant le dernier décompte', () => {
    const journal = [mene(0, 2), mene(1, 3)]
    const undone = replayFletanque(0, journal.slice(0, -1))
    expect(undone).toEqual(replayFletanque(0, [mene(0, 2)]))
    expect(undone.opener).toBe(0)
    expect(undone.scores).toEqual([2, 0])
  })
})

describe('sessionFletanque', () => {
  it('résume la partie pour les quatre lignes enregistrées', () => {
    const replay = replayFletanque(0, [mene(0, 2)])
    const rows = sessionFletanque(replay)
    expect(rows.map((r) => r.team)).toEqual([0, 0, 1, 1])
    expect(rows.reduce((sum, r) => sum + r.thrown, 0)).toBe(12)
    expect(rows.every((r) => r.menes.length === 1)).toBe(true)
  })
})

describe('migrateFletanqueJournal', () => {
  it('reprend l’équipe au point d’un ancien journal fléchette par fléchette', () => {
    const legacy = [
      { kind: 'lance', player: 0, holder: 0 },
      { kind: 'lance', player: 2, holder: 1 },
      { kind: 'mene', points: 2 },
      { kind: 'lance', player: 2, holder: null },
      { kind: 'mene', points: 0 },
      { kind: 'lance', player: 2, holder: 1 },
    ]
    expect(migrateFletanqueJournal(legacy)).toEqual([mene(1, 2), mene(null, 0)])
  })

  it('laisse intact un journal déjà au nouveau format', () => {
    const journal = [mene(0, 1), mene(null, 0)]
    expect(migrateFletanqueJournal(journal)).toEqual(journal)
  })
})

describe('replayFletanque — parties simulées', () => {
  /**
   * Un générateur déterministe : mêmes graines, mêmes parties, donc un échec
   * se rejoue à l'identique.
   */
  function rng(seed: number) {
    let state = seed >>> 0
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0
      return state / 0x100000000
    }
  }

  it('mène toujours une partie à son terme', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const random = rng(seed)
      const opener: Side = random() < 0.5 ? 0 : 1
      const journal: FletanqueEvent[] = []
      let replay = replayFletanque(opener, journal)
      let guard = 0

      while (!replay.finished) {
        expect(guard++).toBeLessThan(2000) // filet anti-boucle infinie
        const pick = random()
        journal.push(
          pick < 0.1
            ? mene(null, 0)
            : mene(pick < 0.55 ? 0 : 1, 1 + Math.floor(random() * DARTS_PER_TEAM)),
        )
        replay = replayFletanque(opener, journal)
      }

      // Un seul vainqueur, à 5 points au moins, et l'adversaire en dessous.
      const winner = replay.winner!
      expect(replay.scores[winner]).toBeGreaterThanOrEqual(TARGET_SCORE)
      expect(replay.scores[otherSide(winner)]).toBeLessThan(TARGET_SCORE)
      const credited = replay.menes.reduce(
        (sum, m) => sum + (m.holder === winner ? m.points : 0),
        0,
      )
      expect(credited).toBe(replay.scores[winner])
    }
  })
})
