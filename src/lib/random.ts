// Tirages au sort : le hasard cryptographique du navigateur, sans biais de
// Math.random, pour les numéros, les équipes et les poules.

/** Une copie mélangée (Fisher-Yates). */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items]
  const random = new Uint32Array(result.length)
  crypto.getRandomValues(random)
  for (let i = result.length - 1; i > 0; i--) {
    const j = random[i] % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
