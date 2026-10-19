'use client'

// Le code de suppression est demandé une fois puis mémorisé sur l'appareil
// tant qu'il fonctionne (oublié s'il est refusé par le serveur).

const CODE_KEY = 'mylegidarts-code-suppression'

/** Le code mémorisé sur cet appareil, s'il y en a un. */
export function storedDeleteCode(): string | null {
  try {
    return localStorage.getItem(CODE_KEY)
  } catch {
    return null
  }
}

/** Le champ à ajouter au dialogue de suppression quand le code n'est pas connu. */
export const DELETE_CODE_INPUT = {
  label: 'Code de suppression de la ligue',
  secret: true,
  required: true,
} as const

export function rememberDeleteCode(code: string): void {
  localStorage.setItem(CODE_KEY, code)
}

export function forgetDeleteCode(): void {
  localStorage.removeItem(CODE_KEY)
}
