// La partie en cours vit dans le localStorage du kiosque : /tirer l'y écrit à
// chaque fléchette pour survivre à un rechargement, et l'écran d'attente la
// consulte pour ne jamais recouvrir une partie entamée.

export const IN_PROGRESS_KEY = 'mylegidarts-session-en-cours'
/** Au-delà, une partie abandonnée sans être enregistrée est considérée périmée. */
export const IN_PROGRESS_MAX_AGE_MS = 6 * 60 * 60 * 1000

/** true si une partie récente attend d'être finie ou enregistrée sur cet appareil. */
export function hasMatchInProgress(): boolean {
  try {
    const raw = localStorage.getItem(IN_PROGRESS_KEY)
    if (!raw) return false
    const { startedAt } = JSON.parse(raw) as { startedAt?: string }
    return startedAt !== undefined && Date.now() - new Date(startedAt).getTime() < IN_PROGRESS_MAX_AGE_MS
  } catch {
    return false
  }
}
