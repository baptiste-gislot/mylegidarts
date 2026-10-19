import { count180s, DARTS_PER_SESSION } from './scoring'
import type { Dart } from './scoring'
import type { DuelStatRow } from './useLeague'

export interface Badge {
  id: string
  icon: string
  label: string
  /** Condition à remplir, affichée telle quelle sous le badge. */
  description: string
  earned: boolean
}

/** Sous-ensemble de SessionRow suffisant pour calculer les trophées. */
interface BadgeSession {
  darts: Dart[]
  total: number
}

/** Total de session qui vaut le trophée « Grosse artillerie ». */
export const BIG_SESSION = 400
/** Victoires contre un même adversaire pour « Bête noire ». */
export const NEMESIS_WINS = 10

/** Trophées du joueur, tous listés — `earned` dit lesquels sont débloqués. */
export function computeBadges(sessions: BadgeSession[], duels: DuelStatRow[]): Badge[] {
  const total180 = sessions.reduce((sum, s) => sum + count180s(s.darts), 0)
  const bullseye = sessions.some((s) => s.darts.some((d) => d.sector === 25 && d.mult === 2))
  const cleanSession = sessions.some(
    (s) => s.darts.length === DARTS_PER_SESSION && s.darts.every((d) => d.sector !== 0),
  )
  const bigSession = sessions.some((s) => s.total >= BIG_SESSION)
  const nemesis = duels.some((d) => d.wins >= NEMESIS_WINS)
  const untouchable = duels.length >= 2 && duels.every((d) => d.wins > d.losses)

  return [
    { id: '180', icon: '💥', label: '180 !', description: 'Réussir une volée parfaite', earned: total180 >= 1 },
    { id: 'double-180', icon: '🔁', label: 'Récidiviste', description: 'Deux 180 en carrière', earned: total180 >= 2 },
    { id: 'bull', icon: '🎯', label: 'Mouche', description: 'Toucher le bullseye', earned: bullseye },
    { id: 'clean', icon: '🧼', label: 'Sans bavure', description: 'Une partie sans aucun raté', earned: cleanSession },
    { id: 'big', icon: '🚀', label: 'Grosse artillerie', description: `Une partie à ${BIG_SESSION} ou plus`, earned: bigSession },
    { id: 'regular', icon: '🎪', label: 'Habitué', description: '10 parties jouées', earned: sessions.length >= 10 },
    { id: 'marathon', icon: '🏃', label: 'Marathonien', description: '50 parties jouées', earned: sessions.length >= 50 },
    { id: 'nemesis', icon: '😈', label: 'Bête noire', description: `${NEMESIS_WINS} victoires contre un même joueur`, earned: nemesis },
    { id: 'untouchable', icon: '👑', label: 'Intouchable', description: 'Mener tous ses face-à-face', earned: untouchable },
  ]
}
