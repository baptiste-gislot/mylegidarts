'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SetupNotice } from '@/components/SetupNotice'
import {
  DARTS_PER_SESSION,
  DARTS_PER_VOLLEY,
  VOLLEYS_PER_SESSION,
  dartLabel,
  dartValue,
  sessionTotal,
  type Dart,
  type Mult,
} from '@/lib/scoring'
import { useLeague } from '@/lib/useLeague'

const SECTORS = Array.from({ length: 20 }, (_, i) => i + 1)

export default function TirerPage() {
  const router = useRouter()
  const { players, sessions, loading, error, configured, saveSessions } = useLeague()

  const [order, setOrder] = useState<string[]>([])
  const [started, setStarted] = useState(false)
  const [dartsByPlayer, setDartsByPlayer] = useState<Dart[][]>([])
  const [mult, setMult] = useState<Mult>(1)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const bestByPlayer = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sessions) {
      map.set(s.player_id, Math.max(map.get(s.player_id) ?? 0, s.total))
    }
    return map
  }, [sessions])

  if (!configured) return <SetupNotice />
  if (loading) return <p className="empty">Chargement…</p>
  if (error) return <p className="notice notice--error">Erreur : {error}</p>

  if (players.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">Personne à la ligne de tir</p>
        <p>Ajoutez des joueurs dans l’onglet Joueurs pour lancer une session.</p>
      </div>
    )
  }

  const thrownCount = dartsByPlayer.reduce((sum, d) => sum + d.length, 0)
  const totalDarts = order.length * DARTS_PER_SESSION
  const finished = started && thrownCount === totalDarts

  // Les volées alternent entre joueurs : volée 1 de chacun, puis volée 2, etc.
  const globalVolley = Math.floor(thrownCount / DARTS_PER_VOLLEY)
  const currentPlayerIndex = globalVolley % Math.max(1, order.length)
  const currentRound = Math.floor(globalVolley / Math.max(1, order.length))
  const currentDarts = dartsByPlayer[currentPlayerIndex] ?? []
  const currentVolley = currentDarts.slice(currentRound * DARTS_PER_VOLLEY)
  const currentPlayer = players.find((p) => p.id === order[currentPlayerIndex])

  function toggleOrder(id: string) {
    setOrder((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )
  }

  function start() {
    if (order.length === 0) return
    setDartsByPlayer(order.map(() => []))
    setStarted(true)
    setSaveError(null)
  }

  function throwDart(dart: Dart) {
    if (finished) return
    setDartsByPlayer((current) =>
      current.map((darts, i) => (i === currentPlayerIndex ? [...darts, dart] : darts)),
    )
    setMult(1)
  }

  function undo() {
    if (thrownCount === 0) return
    const lastVolley = Math.floor((thrownCount - 1) / DARTS_PER_VOLLEY)
    const lastPlayerIndex = lastVolley % order.length
    setDartsByPlayer((current) =>
      current.map((darts, i) => (i === lastPlayerIndex ? darts.slice(0, -1) : darts)),
    )
  }

  function reset() {
    setStarted(false)
    setDartsByPlayer([])
    setMult(1)
    setSaveError(null)
  }

  async function save() {
    setSaving(true)
    const entries = order.map((playerId, i) => ({
      playerId,
      darts: dartsByPlayer[i],
      total: sessionTotal(dartsByPlayer[i]),
    }))
    const err = await saveSessions(entries)
    setSaving(false)
    if (err) {
      setSaveError(err)
    } else {
      router.push('/')
    }
  }

  if (!started) {
    return (
      <div className="stack">
        <section>
          <h2 className="section-title">Qui tire ? (dans l’ordre de passage)</h2>
          <div className="chips">
            {players.map((p) => {
              const position = order.indexOf(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={position !== -1}
                  className={position !== -1 ? 'chip chip--on' : 'chip'}
                  onClick={() => toggleOrder(p.id)}
                >
                  {position !== -1 ? `${position + 1}. ` : ''}
                  {p.name}
                </button>
              )
            })}
          </div>
        </section>
        <button type="button" className="button-primary" disabled={order.length === 0} onClick={start}>
          Commencer la session
        </button>
      </div>
    )
  }

  if (finished) {
    const recap = order
      .map((playerId, i) => {
        const player = players.find((p) => p.id === playerId)
        const total = sessionTotal(dartsByPlayer[i])
        return {
          playerId,
          name: player?.name ?? '?',
          total,
          record: total > (bestByPlayer.get(playerId) ?? -1),
        }
      })
      .sort((a, b) => b.total - a.total)

    return (
      <div className="stack">
        <section>
          <h2 className="section-title">Fin de session</h2>
          <div className="recap">
            {recap.map((line) => (
              <div
                key={line.playerId}
                className={line.record ? 'recap__row recap__row--record' : 'recap__row'}
              >
                <span className="recap__name">{line.name}</span>
                {line.record && <span className="recap__badge">Nouveau record</span>}
                <span className="recap__total">{line.total}</span>
              </div>
            ))}
          </div>
        </section>
        {saveError && (
          <p className="notice notice--error" role="alert">
            L’enregistrement a échoué : {saveError}
          </p>
        )}
        <button type="button" className="button-primary" disabled={saving} onClick={() => void save()}>
          {saving ? 'Enregistrement…' : 'Enregistrer les scores'}
        </button>
        <button type="button" className="button-ghost" onClick={reset}>
          Abandonner la session
        </button>
      </div>
    )
  }

  return (
    <div className="scorer">
      <div className="scorer__status">
        <div>
          <p className="scorer__volley">
            Volée {currentRound + 1}/{VOLLEYS_PER_SESSION}
          </p>
          <p className="scorer__thrower">{currentPlayer?.name}</p>
        </div>
        <button type="button" className="button-ghost" onClick={reset}>
          Abandonner
        </button>
      </div>

      <div className="scorer__slots">
        {Array.from({ length: DARTS_PER_VOLLEY }, (_, i) => {
          const dart = currentVolley[i]
          return (
            <div key={i} className={dart ? 'slot slot--filled' : 'slot'}>
              {dart ? (
                <>
                  <span className="slot__label">{dartLabel(dart)}</span>
                  <span className="slot__value">{dartValue(dart)} pts</span>
                </>
              ) : (
                <span className="slot__value">Fléchette {i + 1}</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="scorer__totals">
        {order.map((playerId, i) => {
          const player = players.find((p) => p.id === playerId)
          return (
            <span
              key={playerId}
              className={i === currentPlayerIndex ? 'total-chip total-chip--active' : 'total-chip'}
            >
              {player?.name} <strong>{sessionTotal(dartsByPlayer[i])}</strong>
            </span>
          )
        })}
      </div>

      <div className="keypad">
        <div className="keypad__mults">
          {([1, 2, 3] as Mult[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mult === m}
              className={`key key--mult ${m === 2 ? 'key--double' : ''} ${m === 3 ? 'key--triple' : ''}`}
              onClick={() => setMult(m)}
            >
              {['Simple', 'Double', 'Triple'][m - 1]}
            </button>
          ))}
        </div>
        <div className="keypad__sectors">
          {SECTORS.map((sector) => (
            <button
              key={sector}
              type="button"
              className="key key--sector"
              onClick={() => throwDart({ sector, mult })}
            >
              {sector}
            </button>
          ))}
        </div>
        <div className="keypad__special">
          <button type="button" className="key key--bull25" onClick={() => throwDart({ sector: 25, mult: 1 })}>
            25
          </button>
          <button type="button" className="key key--bull50" onClick={() => throwDart({ sector: 25, mult: 2 })}>
            Bull
          </button>
          <button type="button" className="key key--miss" onClick={() => throwDart({ sector: 0, mult: 1 })}>
            Raté
          </button>
          <button type="button" className="key key--undo" onClick={undo} disabled={thrownCount === 0}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
