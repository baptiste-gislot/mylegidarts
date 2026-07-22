'use client'

// Le code de suppression est demandé une fois puis mémorisé sur l'appareil
// tant qu'il fonctionne (oublié s'il est refusé par le serveur).

const CODE_KEY = 'mylegidarts-code-suppression'

/** Demande le code (ou réutilise celui mémorisé). null si l'utilisateur annule. */
export function askDeleteCode(): string | null {
  const stored = localStorage.getItem(CODE_KEY)
  if (stored) return stored
  const code = window.prompt('Code de suppression de la ligue :')
  return code === null || code.trim() === '' ? null : code.trim()
}

export function rememberDeleteCode(code: string): void {
  localStorage.setItem(CODE_KEY, code)
}

export function forgetDeleteCode(): void {
  localStorage.removeItem(CODE_KEY)
}
