export type Mult = 1 | 2 | 3

export interface Dart {
  /** 1–20, 25 pour le bull, 0 pour une fléchette ratée */
  sector: number
  mult: Mult
}

export const DARTS_PER_VOLLEY = 3
export const VOLLEYS_PER_SESSION = 4
export const DARTS_PER_SESSION = DARTS_PER_VOLLEY * VOLLEYS_PER_SESSION
export const MAX_SESSION_TOTAL = 720 // 12 × triple 20

export function dartValue(dart: Dart): number {
  return dart.sector * dart.mult
}

export function dartLabel(dart: Dart): string {
  if (dart.sector === 0) return '✕'
  if (dart.sector === 25) return dart.mult === 2 ? 'BULL' : '25'
  return `${['S', 'D', 'T'][dart.mult - 1]}${dart.sector}`
}

export function sessionTotal(darts: Dart[]): number {
  return darts.reduce((sum, d) => sum + dartValue(d), 0)
}

export function volleys(darts: Dart[]): Dart[][] {
  const groups: Dart[][] = []
  for (let i = 0; i < darts.length; i += DARTS_PER_VOLLEY) {
    groups.push(darts.slice(i, i + DARTS_PER_VOLLEY))
  }
  return groups
}

export function bestVolley(darts: Dart[]): number {
  return volleys(darts).reduce((best, v) => Math.max(best, sessionTotal(v)), 0)
}

export const PERFECT_VOLLEY = 180

/** Nombre de volées parfaites (180) dans une session. */
export function count180s(darts: Dart[]): number {
  return volleys(darts).filter(
    (v) => v.length === DARTS_PER_VOLLEY && sessionTotal(v) === PERFECT_VOLLEY,
  ).length
}

export interface DartBreakdown {
  triples: number
  doubles: number
  simples: number
  bulls: number
  rates: number
  total: number
}

export function dartBreakdown(darts: Dart[]): DartBreakdown {
  const breakdown: DartBreakdown = { triples: 0, doubles: 0, simples: 0, bulls: 0, rates: 0, total: darts.length }
  for (const d of darts) {
    if (d.sector === 0) breakdown.rates++
    else if (d.sector === 25) breakdown.bulls++
    else if (d.mult === 3) breakdown.triples++
    else if (d.mult === 2) breakdown.doubles++
    else breakdown.simples++
  }
  return breakdown
}

export function isValidDart(value: unknown): value is Dart {
  if (typeof value !== 'object' || value === null) return false
  const d = value as Dart
  const sectorOk = d.sector === 0 || d.sector === 25 || (Number.isInteger(d.sector) && d.sector >= 1 && d.sector <= 20)
  const multOk = d.mult === 1 || d.mult === 2 || d.mult === 3
  const bullOk = d.sector !== 25 || d.mult !== 3
  return sectorOk && multOk && bullOk
}
