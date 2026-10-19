import { dartLabel, sessionTotal, type Dart } from '@/lib/scoring'

/**
 * La volée qui vient de s'achever, sous les cases de la volée en cours : quand
 * la main passe, on voit encore ce que le joueur précédent a fait.
 */
export function LastVolley({ name, darts, showTotal = true }: { name: string; darts: Dart[]; showTotal?: boolean }) {
  return (
    <p className="last-volley">
      <span className="last-volley__label">Volée précédente</span>
      <span className="last-volley__who">{name}</span>
      <span className="last-volley__darts">{darts.map(dartLabel).join(' ')}</span>
      {showTotal && <span className="last-volley__total">{sessionTotal(darts)}</span>}
    </p>
  )
}
