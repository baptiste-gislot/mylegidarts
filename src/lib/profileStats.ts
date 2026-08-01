import { sessionTotal, volleys } from './scoring'
import type { Dart } from './scoring'

/** Nombre de sessions prises en compte pour la forme récente. */
export const FORM_WINDOW = 5

export interface RecentForm {
  /** Moyenne des FORM_WINDOW dernières sessions, arrondie. */
  recent: number
  /** Écart à la moyenne globale, arrondi (positif = en progrès). */
  delta: number
}

/**
 * Forme récente : les dernières sessions comparées à la moyenne globale.
 * Null tant qu'il n'y a pas plus de sessions que la fenêtre : la comparaison
 * ne voudrait rien dire.
 */
export function recentForm(totals: number[]): RecentForm | null {
  if (totals.length <= FORM_WINDOW) return null
  const overall = totals.reduce((sum, t) => sum + t, 0) / totals.length
  const recent = totals.slice(-FORM_WINDOW).reduce((sum, t) => sum + t, 0) / FORM_WINDOW
  return { recent: Math.round(recent), delta: Math.round(recent - overall) }
}

/** Écart-type des totaux de session, arrondi. Plus il est bas, plus le joueur est régulier. */
export function consistency(totals: number[]): number {
  if (totals.length === 0) return 0
  const mean = totals.reduce((sum, t) => sum + t, 0) / totals.length
  const variance = totals.reduce((sum, t) => sum + (t - mean) ** 2, 0) / totals.length
  return Math.round(Math.sqrt(variance))
}

/** Série en cours de sessions au moins au niveau de la moyenne globale, en partant de la dernière. */
export function hotStreak(totals: number[]): number {
  if (totals.length === 0) return 0
  const mean = totals.reduce((sum, t) => sum + t, 0) / totals.length
  let streak = 0
  for (let i = totals.length - 1; i >= 0 && totals[i] >= mean; i--) streak++
  return streak
}

export interface BestVolleyDetail {
  darts: Dart[]
  total: number
  createdAt: string
}

/** Meilleure volée toutes sessions confondues, avec ses fléchettes et sa date. */
export function bestVolleyDetail(
  sessions: { darts: Dart[]; created_at: string }[],
): BestVolleyDetail | null {
  let best: BestVolleyDetail | null = null
  for (const session of sessions) {
    for (const volley of volleys(session.darts)) {
      const total = sessionTotal(volley)
      if (best === null || total > best.total) {
        best = { darts: volley, total, createdAt: session.created_at }
      }
    }
  }
  return best
}
