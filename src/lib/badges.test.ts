import { describe, expect, it } from 'vitest'
import { BIG_SESSION, computeBadges, NEMESIS_WINS } from './badges'
import type { Dart } from './scoring'
import type { DuelStatRow } from './useLeague'

const d = (sector: number, mult: 1 | 2 | 3 = 1): Dart => ({ sector, mult })
const session = (darts: Dart[]) => ({ darts, total: darts.reduce((s, x) => s + x.sector * x.mult, 0) })
const duel = (wins: number, losses: number): DuelStatRow => ({
  player_id: 'p',
  opponent_id: 'o',
  played: wins + losses,
  wins,
  losses,
})

const badge = (sessions: ReturnType<typeof session>[], duels: DuelStatRow[], id: string) =>
  computeBadges(sessions, duels).find((b) => b.id === id)!

describe('computeBadges', () => {
  it('liste tous les trophées, verrouillés sans historique', () => {
    const badges = computeBadges([], [])
    expect(badges.length).toBeGreaterThan(0)
    expect(badges.every((b) => !b.earned)).toBe(true)
  })

  it('débloque 180 puis Récidiviste selon le nombre de volées parfaites', () => {
    const perfect = [d(20, 3), d(20, 3), d(20, 3)]
    const one = [session([...perfect, d(1), d(1), d(1)])]
    expect(badge(one, [], '180').earned).toBe(true)
    expect(badge(one, [], 'double-180').earned).toBe(false)
    const two = [session([...perfect, ...perfect])]
    expect(badge(two, [], 'double-180').earned).toBe(true)
  })

  it('Mouche exige le bullseye, pas le simple 25', () => {
    expect(badge([session([d(25, 1)])], [], 'bull').earned).toBe(false)
    expect(badge([session([d(25, 2)])], [], 'bull').earned).toBe(true)
  })

  it('Sans bavure exige une session complète sans raté', () => {
    const clean = Array(12).fill(d(20))
    const short = Array(6).fill(d(20))
    const missed = [...Array(11).fill(d(20)), d(0)]
    expect(badge([session(clean)], [], 'clean').earned).toBe(true)
    expect(badge([session(short)], [], 'clean').earned).toBe(false)
    expect(badge([session(missed)], [], 'clean').earned).toBe(false)
  })

  it('Grosse artillerie se joue au total de session', () => {
    const big = { darts: [], total: BIG_SESSION }
    const small = { darts: [], total: BIG_SESSION - 1 }
    expect(badge([big], [], 'big').earned).toBe(true)
    expect(badge([small], [], 'big').earned).toBe(false)
  })

  it('Bête noire exige les victoires contre un même adversaire', () => {
    expect(badge([], [duel(NEMESIS_WINS, 3)], 'nemesis').earned).toBe(true)
    expect(badge([], [duel(NEMESIS_WINS - 1, 0), duel(5, 0)], 'nemesis').earned).toBe(false)
  })

  it('Intouchable exige de mener partout, contre au moins deux adversaires', () => {
    expect(badge([], [duel(3, 1)], 'untouchable').earned).toBe(false)
    expect(badge([], [duel(3, 1), duel(2, 2)], 'untouchable').earned).toBe(false)
    expect(badge([], [duel(3, 1), duel(4, 2)], 'untouchable').earned).toBe(true)
  })
})
