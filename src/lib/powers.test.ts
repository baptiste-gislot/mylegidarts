import { describe, expect, it } from 'vitest'
import type { Dart } from './scoring'
import {
  POWERS,
  canActivate,
  drawAssignments,
  replayPowers,
  sessionPowers,
  type MatchEvent,
  type PowerId,
} from './powers'

function d(sector: number, mult: 1 | 2 | 3 = 1): MatchEvent {
  return { kind: 'dart', dart: { sector, mult } as Dart }
}

function volley(...values: [number, (1 | 2 | 3)?][]): MatchEvent[] {
  return values.map(([sector, mult]) => d(sector, mult ?? 1))
}

const A = 0
const B = 1

describe('rotation sans activation', () => {
  const assignments: PowerId[] = ['controle', 'bug']

  it('alterne les volées et finit après 4 tours chacun', () => {
    const journal: MatchEvent[] = []
    for (let round = 0; round < 4; round++) {
      journal.push(...volley([20], [5], [1]), ...volley([19], [7], [3]))
    }
    const replay = replayPowers(2, assignments, journal)
    expect(replay.finished).toBe(true)
    expect(replay.totals).toEqual([26 * 4, 29 * 4])
    expect(replay.volleySizes[A]).toEqual([3, 3, 3, 3])
  })

  it('donne la main au joueur suivant après 3 fléchettes', () => {
    const replay = replayPowers(2, assignments, volley([20], [5], [1]))
    expect(replay.current).toEqual({ player: B, round: 0 })
  })
})

describe('tournee (Greg) — 4e fléchette', () => {
  const assignments: PowerId[] = ['tournee', 'bug']

  it('agrandit la volée en cours à 4 fléchettes', () => {
    const journal: MatchEvent[] = [
      { kind: 'power', power: 'tournee', actor: A },
      ...volley([20], [20], [20], [20]),
    ]
    const replay = replayPowers(2, assignments, journal)
    expect(replay.volleySizes[A][0]).toBe(4)
    expect(replay.current).toEqual({ player: B, round: 0 })
    expect(replay.totals[A]).toBe(80)
  })

  it('refuse une fois la volée passée', () => {
    const journal = volley([20], [20], [20])
    expect(canActivate(2, assignments, journal, { power: 'tournee', actor: A }).ok).toBe(false)
  })
})

describe('rab (Mélissa) — volée supplémentaire sous 30 points', () => {
  const assignments: PowerId[] = ['rab', 'bug']

  it('insère une volée de plus juste après la volée faible', () => {
    const journal: MatchEvent[] = [
      ...volley([5], [5], [5]),
      { kind: 'power', power: 'rab', actor: A },
      ...volley([20], [20], [20]),
    ]
    const replay = replayPowers(2, assignments, journal)
    expect(replay.volleySizes[A]).toHaveLength(5)
    expect(replay.totals[A]).toBe(15 + 60)
    expect(replay.current).toEqual({ player: B, round: 0 })
  })

  it('refuse à 30 points ou plus', () => {
    const journal = volley([10], [10], [10])
    expect(canActivate(2, assignments, journal, { power: 'rab', actor: A }).ok).toBe(false)
  })
})

describe('relances — trous comblés par la fléchette suivante', () => {
  it('controle : le raté est retiré puis rejoué', () => {
    const assignments: PowerId[] = ['controle', 'bug']
    const journal: MatchEvent[] = [
      d(20),
      d(0),
      { kind: 'power', power: 'controle', actor: A },
    ]
    let replay = replayPowers(2, assignments, journal)
    expect(replay.pendingHole).toEqual({ player: A, round: 0 })
    expect(replay.current).toBeNull()

    replay = replayPowers(2, assignments, [...journal, d(19), d(3)])
    expect(replay.pendingHole).toBeNull()
    expect(replay.dartsByPlayer[A].map((x) => x.sector)).toEqual([20, 19, 3])
    expect(replay.current).toEqual({ player: B, round: 0 })
  })

  it('reecriture : la pire fléchette de la volée est rejouée', () => {
    const assignments: PowerId[] = ['reecriture', 'bug']
    const journal: MatchEvent[] = [
      ...volley([1], [20, 3], [5]),
      { kind: 'power', power: 'reecriture', actor: A },
      d(17),
    ]
    const replay = replayPowers(2, assignments, journal)
    expect(replay.dartsByPlayer[A].map((x) => x.sector)).toEqual([17, 20, 5])
    expect(replay.totals[A]).toBe(17 + 60 + 5)
  })

  it('reclamation : la meilleure fléchette adverse est rejouée', () => {
    const assignments: PowerId[] = ['controle', 'reclamation']
    const journal: MatchEvent[] = [
      ...volley([1], [20, 3], [5]),
      { kind: 'power', power: 'reclamation', actor: B, target: A },
      d(0),
    ]
    const replay = replayPowers(2, assignments, journal)
    expect(replay.totals[A]).toBe(1 + 0 + 5)
  })

  it('bloque la fin de partie tant que la relance est due', () => {
    const assignments: PowerId[] = ['bug', 'reecriture']
    const journal: MatchEvent[] = []
    for (let round = 0; round < 4; round++) {
      journal.push(...volley([20], [5], [1]), ...volley([19], [7], [3]))
    }
    journal.push({ kind: 'power', power: 'reecriture', actor: B })
    let replay = replayPowers(2, ['bug', 'reecriture'], journal)
    expect(replay.finished).toBe(false)
    replay = replayPowers(2, assignments, [...journal, d(18)])
    expect(replay.finished).toBe(true)
  })

  it('refuse une deuxième relance tant que la première est ouverte', () => {
    const assignments: PowerId[] = ['controle', 'reclamation']
    const journal: MatchEvent[] = [
      ...volley([1], [20, 3], [0]),
      { kind: 'power', power: 'reclamation', actor: B, target: A },
    ]
    const check = canActivate(2, assignments, journal, { power: 'controle', actor: A })
    expect(check.ok).toBe(false)
  })
})

describe('mutations — bug et simulation', () => {
  it('bug : la dernière fléchette adverse tombe à zéro', () => {
    const assignments: PowerId[] = ['controle', 'bug']
    const journal: MatchEvent[] = [d(20, 3), { kind: 'power', power: 'bug', actor: B }]
    const replay = replayPowers(2, assignments, journal)
    expect(replay.totals[A]).toBe(0)
    expect(replay.dartsByPlayer[A]).toEqual([{ sector: 0, mult: 1 }])
  })

  it('simulation : le raté devient le simple annoncé', () => {
    const assignments: PowerId[] = ['simulation', 'bug']
    const journal: MatchEvent[] = [
      d(0),
      { kind: 'power', power: 'simulation', actor: A, sector: 16 },
    ]
    const replay = replayPowers(2, assignments, journal)
    expect(replay.dartsByPlayer[A]).toEqual([{ sector: 16, mult: 1 }])
  })

  it('simulation refusée si la dernière fléchette n’est pas un raté', () => {
    const assignments: PowerId[] = ['simulation', 'bug']
    expect(
      canActivate(2, assignments, [d(5)], { power: 'simulation', actor: A }).ok,
    ).toBe(false)
  })
})

describe('bonus — classe, defile, aspiration', () => {
  it('classe : +10 par touche du secteur annoncé, sur cette volée seulement', () => {
    const assignments: PowerId[] = ['classe', 'bug']
    const journal: MatchEvent[] = [
      { kind: 'power', power: 'classe', actor: A, sector: 20 },
      ...volley([20, 3], [20], [5]),
      ...volley([19], [7], [3]),
      ...volley([20], [20], [20]), // 2e volée de A : plus de bonus
    ]
    const replay = replayPowers(2, assignments, journal)
    expect(replay.bonuses[A]).toBe(20)
    expect(replay.totals[A]).toBe(85 + 60 + 20)
  })

  it('defile : +15 par raté total, crédités au détenteur', () => {
    const assignments: PowerId[] = ['controle', 'defile']
    const journal: MatchEvent[] = [
      { kind: 'power', power: 'defile', actor: B, target: A },
      ...volley([0], [0], [5]),
    ]
    const replay = replayPowers(2, assignments, journal)
    expect(replay.bonuses[B]).toBe(30)
    expect(replay.totals[A]).toBe(5)
  })

  it('aspiration : copie le total de la volée précédente si meilleur', () => {
    const assignments: PowerId[] = ['controle', 'aspiration']
    const journal: MatchEvent[] = [
      ...volley([20], [20], [20]),
      ...volley([5], [5], [5]),
      { kind: 'power', power: 'aspiration', actor: B },
    ]
    const replay = replayPowers(2, assignments, journal)
    expect(replay.bonuses[B]).toBe(45)
    expect(replay.totals[B]).toBe(60)
  })

  it('aspiration refusée pour le tout premier tireur ou si moins bon', () => {
    const assignments: PowerId[] = ['aspiration', 'controle']
    expect(
      canActivate(2, assignments, volley([5], [5], [5]), { power: 'aspiration', actor: A }).ok,
    ).toBe(false)
    const journal: MatchEvent[] = [...volley([5], [5], [5]), ...volley([20], [20], [20])]
    expect(
      canActivate(2, ['controle', 'aspiration'], journal, { power: 'aspiration', actor: B }).ok,
    ).toBe(false)
  })
})

describe('motion (Aloïs) — triples valent double au tour suivant', () => {
  const assignments: PowerId[] = ['motion', 'bug']

  it('dévalue les triples du tour suivant, un 180 n’en est plus un', () => {
    const journal: MatchEvent[] = [
      { kind: 'power', power: 'motion', actor: A, outcome: 'triples-double' },
      ...volley([20, 3], [5], [5]), // tour 0 : triple normal
      ...volley([1], [1], [1]),
      ...volley([20, 3], [20, 3], [20, 3]), // tour 1 : triples dévalués
    ]
    const replay = replayPowers(2, assignments, journal)
    expect(replay.effectiveVolleyTotals[A][0]).toBe(70)
    expect(replay.effectiveVolleyTotals[A][1]).toBe(120)
    expect(replay.totals[A]).toBe(70 + 120)
  })

  it('vote « normal » : aucun effet', () => {
    const journal: MatchEvent[] = [
      { kind: 'power', power: 'motion', actor: A, outcome: 'normal' },
      ...volley([1], [1], [1]),
      ...volley([1], [1], [1]),
      ...volley([20, 3], [20, 3], [20, 3]),
    ]
    const replay = replayPowers(2, assignments, journal)
    expect(replay.effectiveVolleyTotals[A][1]).toBe(180)
  })
})

describe('copie (Martin)', () => {
  const assignments: PowerId[] = ['controle', 'copie']

  it('refuse de copier un pouvoir non utilisé, ou la copie elle-même', () => {
    expect(
      canActivate(2, assignments, [], { power: 'copie', actor: B, copied: 'controle' }).ok,
    ).toBe(false)
    expect(canActivate(2, assignments, [], { power: 'copie', actor: B }).ok).toBe(false)
  })

  it('permet de rejouer le pouvoir copié', () => {
    const journal: MatchEvent[] = [
      d(0),
      { kind: 'power', power: 'controle', actor: A }, // César relance son raté
      d(20),
      d(5),
      d(1),
      // Martin copie « controle »...
      { kind: 'power', power: 'copie', actor: B, copied: 'controle' },
      d(0),
      // ... et l'utilise sur son propre raté
      { kind: 'power', power: 'controle', actor: B },
      d(19),
    ]
    const replay = replayPowers(2, assignments, journal)
    expect(replay.dartsByPlayer[B].map((x) => x.sector)).toEqual([19])
    expect(replay.usedPowers.map((u) => u.power)).toEqual(['controle', 'copie', 'controle'])
  })
})

describe('annulation par retrait du dernier événement', () => {
  it('rend le pouvoir et restaure la fléchette retirée', () => {
    const assignments: PowerId[] = ['controle', 'bug']
    const journal: MatchEvent[] = [d(0), { kind: 'power', power: 'controle', actor: A }]
    const after = replayPowers(2, assignments, journal)
    expect(after.holders[A]).toBeNull()
    expect(after.pendingHole).not.toBeNull()

    const undone = replayPowers(2, assignments, journal.slice(0, -1))
    expect(undone.holders[A]).toBe('controle')
    expect(undone.pendingHole).toBeNull()
    expect(undone.dartsByPlayer[A]).toEqual([{ sector: 0, mult: 1 }])
  })
})

describe('tirage et persistance', () => {
  it('assigne des pouvoirs distincts jusqu’à 13 joueurs', () => {
    const drawn = drawAssignments(13)
    expect(new Set(drawn).size).toBe(13)
    expect(drawAssignments(3)).toHaveLength(3)
  })

  it('résume la partie pour le jsonb en base', () => {
    const assignments: PowerId[] = ['classe', 'bug']
    const journal: MatchEvent[] = [
      { kind: 'power', power: 'classe', actor: A, sector: 20 },
      ...volley([20], [20], [5]),
    ]
    const replay = replayPowers(2, assignments, journal)
    const rows = sessionPowers(replay, assignments)
    expect(rows[A]).toEqual({
      power: 'classe',
      used: true,
      bonus: 20,
      volleySizes: [3, 3, 3, 3],
    })
    expect(rows[B].used).toBe(false)
  })

  it('expose 13 pouvoirs définis', () => {
    expect(POWERS).toHaveLength(13)
  })
})
