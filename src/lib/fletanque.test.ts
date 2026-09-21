import { describe, expect, it } from 'vitest'
import {
  DARTS_PER_PLAYER,
  DARTS_PER_TEAM,
  PLAYERS_PER_MATCH,
  TARGET_SCORE,
  replayFletanque,
  otherSide,
  sessionFletanque,
  teamOf,
  type FletanqueEvent,
  type Side,
} from './fletanque'

/** Un lancer : le joueur, puis l'équipe qui a le point après (null = égalité). */
const lance = (player: number, holder: Side | null): FletanqueEvent => ({
  kind: 'lance',
  player,
  holder,
})
const mene = (points: number): FletanqueEvent => ({ kind: 'mene', points })

/** Déroule une mène complète où `winner` garde le point de bout en bout. */
function sweep(opener: Side, winner: Side): FletanqueEvent[] {
  const journal: FletanqueEvent[] = []
  let replay = replayFletanque(opener, journal)
  while (!replay.awaitingCount && replay.thrower !== null) {
    journal.push(lance(replay.thrower, winner))
    replay = replayFletanque(opener, journal)
  }
  return journal
}

describe('teamOf', () => {
  it('range les deux premiers de l’ordre en équipe A, les suivants en B', () => {
    expect([0, 1, 2, 3].map(teamOf)).toEqual([0, 0, 1, 1])
  })
})

describe('replayFletanque — ouverture', () => {
  it('fait ouvrir la mène par l’équipe tirée au sort', () => {
    expect(replayFletanque(1, []).side).toBe(1)
    expect(replayFletanque(1, []).thrower).toBe(2)
    expect(replayFletanque(0, []).thrower).toBe(0)
  })

  it('donne d’office le point à la première fléchette : seule sur la cible', () => {
    expect(replayFletanque(0, []).outcomes).toEqual([0])
  })

  it('passe la main à l’adversaire une fois le point pris', () => {
    const replay = replayFletanque(0, [lance(0, 0)])
    expect(replay.holder).toBe(0)
    expect(replay.side).toBe(1)
    expect(replay.thrower).toBe(2)
    // L'équipe B peut prendre le point, égaliser, ou rester derrière.
    expect(replay.outcomes).toEqual([1, null, 0])
  })
})

describe('replayFletanque — la main suit le point', () => {
  it('fait relancer l’équipe qui n’a pas le point jusqu’à ce qu’elle le reprenne', () => {
    const journal = [lance(0, 0), lance(2, 0), lance(3, 0)]
    const replay = replayFletanque(0, journal)
    // B a lancé deux fois sans reprendre : c'est encore à elle.
    expect(replay.side).toBe(1)
    expect(replay.thrower).toBe(2) // B alterne : 2, 3, puis 2 de nouveau
  })

  it('rend la main à l’adversaire dès que le point change de camp', () => {
    const replay = replayFletanque(0, [lance(0, 0), lance(2, 1)])
    expect(replay.holder).toBe(1)
    expect(replay.side).toBe(0)
    expect(replay.thrower).toBe(1) // A alterne : 0 puis 1
  })

  it('fait rejouer l’équipe qui vient de lancer quand les deux sont à égalité', () => {
    const replay = replayFletanque(0, [lance(0, 0), lance(2, null)])
    expect(replay.holder).toBeNull()
    expect(replay.side).toBe(1)
    // À égalité, seule l'équipe qui relance peut prendre le point.
    expect(replay.outcomes).toEqual([1, null])
  })

  it('laisse l’autre équipe terminer quand une équipe n’a plus de fléchettes', () => {
    // B tient le point d'un bout à l'autre : A brûle ses six fléchettes.
    const journal = [
      lance(2, 1),
      lance(0, 1),
      lance(1, 1),
      lance(0, 1),
      lance(1, 1),
      lance(0, 1),
      lance(1, 1),
    ]
    const replay = replayFletanque(1, journal)
    expect(replay.left.slice(0, 2)).toEqual([0, 0])
    expect(replay.side).toBe(1) // A est à sec, B finit
    // Ses propres fléchettes ne peuvent rien lui retirer : issue forcée.
    expect(replay.outcomes).toEqual([1])
  })

  it('alterne les deux joueurs d’une équipe', () => {
    const order: number[] = []
    const journal: FletanqueEvent[] = []
    // A garde le point : B relance jusqu'à épuisement.
    for (let i = 0; i < 6; i++) {
      const replay = replayFletanque(0, [lance(0, 0), ...journal])
      order.push(replay.thrower!)
      journal.push(lance(replay.thrower!, 0))
    }
    expect(order).toEqual([2, 3, 2, 3, 2, 3])
  })
})

describe('replayFletanque — décompte des mènes', () => {
  it('attend le décompte une fois les douze fléchettes parties', () => {
    const replay = replayFletanque(0, sweep(0, 0))
    expect(replay.awaitingCount).toBe(true)
    expect(replay.side).toBeNull()
    expect(replay.thrower).toBeNull()
    expect(replay.left.every((n) => n === 0)).toBe(true)
  })

  it('crédite l’équipe qui tient le point et lui fait ouvrir la mène suivante', () => {
    const replay = replayFletanque(0, [...sweep(0, 1), mene(3)])
    expect(replay.scores).toEqual([0, 3])
    expect(replay.opener).toBe(1)
    expect(replay.side).toBe(1)
    expect(replay.left.every((n) => n === DARTS_PER_PLAYER)).toBe(true)
    expect(replay.menes).toEqual([{ holder: 1, points: 3 }])
  })

  it('ne donne rien sur une mène nulle et la fait rejouer par la même équipe', () => {
    const journal = sweep(0, 0)
    // Dernière fléchette annulée puis rejouée à égalité : personne ne tient le point.
    const nulle = [...journal.slice(0, -1), lance(3, null), mene(0)]
    const replay = replayFletanque(0, nulle)
    expect(replay.scores).toEqual([0, 0])
    expect(replay.opener).toBe(0)
    expect(replay.menes).toEqual([{ holder: null, points: 0 }])
  })
})

describe('replayFletanque — fin de partie', () => {
  it('sacre la première équipe à 5 points', () => {
    const journal = [...sweep(0, 0), mene(2), ...sweep(0, 0), mene(3)]
    const replay = replayFletanque(0, journal)
    expect(replay.scores[0]).toBe(TARGET_SCORE)
    expect(replay.winner).toBe(0)
    expect(replay.finished).toBe(true)
    expect(replay.side).toBeNull()
  })

  it('laisse gagner une mène qui dépasse la cible', () => {
    const replay = replayFletanque(1, [...sweep(1, 1), mene(6)])
    expect(replay.scores).toEqual([0, 6])
    expect(replay.winner).toBe(1)
  })

  it('ne déclare aucun vainqueur tant que personne n’a atteint 5', () => {
    const replay = replayFletanque(0, [...sweep(0, 0), mene(4)])
    expect(replay.winner).toBeNull()
    expect(replay.finished).toBe(false)
  })
})

describe('replayFletanque — annulation', () => {
  it('retrouve l’état exact en retirant le dernier événement', () => {
    const journal = [lance(0, 0), lance(2, 1), lance(1, 0)]
    const before = replayFletanque(0, journal.slice(0, -1))
    const after = replayFletanque(0, journal)
    expect(after.holder).toBe(0)
    expect(replayFletanque(0, journal.slice(0, -1))).toEqual(before)
    expect(after).not.toEqual(before)
  })

  it('rouvre la mène close quand on annule son décompte', () => {
    const journal = [...sweep(0, 0), mene(2)]
    const reopened = replayFletanque(0, journal.slice(0, -1))
    expect(reopened.awaitingCount).toBe(true)
    expect(reopened.scores).toEqual([0, 0])
    expect(reopened.menes).toEqual([])
  })
})

describe('sessionFletanque', () => {
  it('résume la partie pour les quatre lignes enregistrées', () => {
    const replay = replayFletanque(0, [...sweep(0, 0), mene(2)])
    const rows = sessionFletanque(replay)
    expect(rows.map((r) => r.team)).toEqual([0, 0, 1, 1])
    expect(rows.reduce((sum, r) => sum + r.thrown, 0)).toBe(12)
    expect(rows.every((r) => r.menes.length === 1)).toBe(true)
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

  it('mène toujours une partie à son terme, sans état bloqué', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const random = rng(seed)
      const opener: Side = random() < 0.5 ? 0 : 1
      const journal: FletanqueEvent[] = []
      let replay = replayFletanque(opener, journal)
      let guard = 0

      while (!replay.finished) {
        expect(guard++).toBeLessThan(2000) // filet anti-boucle infinie

        if (replay.awaitingCount) {
          // Mène nulle si personne ne tient le point, sinon 1 à 6 fléchettes devant.
          const points =
            replay.holder === null ? 0 : 1 + Math.floor(random() * DARTS_PER_TEAM)
          journal.push({ kind: 'mene', points })
        } else {
          // Un état jouable a toujours une équipe ET un lanceur : sans quoi
          // l'écran de saisie resterait figé.
          expect(replay.side).not.toBeNull()
          expect(replay.thrower).not.toBeNull()
          expect(replay.outcomes.length).toBeGreaterThan(0)
          expect(teamOf(replay.thrower!)).toBe(replay.side)
          expect(replay.left[replay.thrower!]).toBeGreaterThan(0)
          // Les issues proposées ne mentionnent jamais un camp impossible.
          for (const outcome of replay.outcomes) {
            expect(outcome === null || outcome === replay.side || outcome === replay.holder).toBe(
              true,
            )
          }
          const outcome = replay.outcomes[Math.floor(random() * replay.outcomes.length)]
          journal.push({ kind: 'lance', player: replay.thrower!, holder: outcome })
        }
        replay = replayFletanque(opener, journal)
      }

      // Un seul vainqueur, à 5 points au moins, et l'adversaire en dessous.
      const winner = replay.winner!
      expect(replay.scores[winner]).toBeGreaterThanOrEqual(TARGET_SCORE)
      expect(replay.scores[otherSide(winner)]).toBeLessThan(TARGET_SCORE)
      // Chaque mène close a distribué exactement ce qu'annonce le score.
      const credited = replay.menes.reduce(
        (sum, m) => sum + (m.holder === winner ? m.points : 0),
        0,
      )
      expect(credited).toBe(replay.scores[winner])
      // Toutes les mènes closes ont vu partir les douze fléchettes.
      expect(replay.thrown.reduce((sum, n) => sum + n, 0)).toBe(
        replay.menes.length * PLAYERS_PER_MATCH * DARTS_PER_PLAYER,
      )
    }
  })

  it('annule n’importe quelle partie jusqu’au premier lancer', () => {
    const random = rng(7)
    const opener: Side = 0
    const journal: FletanqueEvent[] = []
    let replay = replayFletanque(opener, journal)
    while (!replay.finished) {
      if (replay.awaitingCount) {
        journal.push({
          kind: 'mene',
          points: replay.holder === null ? 0 : 1 + Math.floor(random() * DARTS_PER_TEAM),
        })
      } else {
        journal.push({
          kind: 'lance',
          player: replay.thrower!,
          holder: replay.outcomes[Math.floor(random() * replay.outcomes.length)],
        })
      }
      replay = replayFletanque(opener, journal)
    }
    // Remonter le journal événement par événement doit toujours donner un état
    // cohérent — c'est exactement ce que fait le bouton « Annuler ».
    for (let cut = journal.length; cut >= 0; cut--) {
      const state = replayFletanque(opener, journal.slice(0, cut))
      expect(state.finished || state.awaitingCount || state.thrower !== null).toBe(true)
    }
    expect(replayFletanque(opener, [])).toEqual(replayFletanque(opener, journal.slice(0, 0)))
  })
})
