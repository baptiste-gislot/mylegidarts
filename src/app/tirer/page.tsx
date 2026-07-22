'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SetupNotice } from '@/components/SetupNotice'
import {
  DARTS_PER_SESSION,
  DARTS_PER_VOLLEY,
  PERFECT_VOLLEY,
  VOLLEYS_PER_SESSION,
  dartLabel,
  dartValue,
  sessionTotal,
  type Dart,
  type Mult,
} from '@/lib/scoring'
import { useToast } from '@/components/Toaster'
import { fireConfetti, vibrate } from '@/lib/effects'
import { useLiveMatchPublisher } from '@/lib/liveMatch'
import { padVolley, replay301, START_301 } from '@/lib/play301'
import { fanfare, say, soundsEnabled, thock } from '@/lib/sound'
import { praise, trashTalk } from '@/lib/trashTalk'
import { useLeagueContext } from '@/lib/LeagueProvider'
import type { GameMode, PlayerRow } from '@/lib/useLeague'

/** Nom d'annonce : le surnom s'il existe, sinon le prénom. */
function stageName(player: PlayerRow | undefined): string {
  return player?.nickname ?? player?.name ?? '?'
}

const SECTORS = Array.from({ length: 20 }, (_, i) => i + 1)

const IN_PROGRESS_KEY = 'mylegidarts-session-en-cours'
const IN_PROGRESS_MAX_AGE_MS = 6 * 60 * 60 * 1000

interface StoredMatch {
  matchId: string
  startedAt: string
  order: string[]
  dartsByPlayer: Dart[][]
  gameMode: GameMode
}

interface Flash {
  title: string
  name: string
  kind: 'perfect' | 'win'
}

function loadStoredMatch(): StoredMatch | null {
  try {
    const raw = localStorage.getItem(IN_PROGRESS_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as StoredMatch
    const fresh = Date.now() - new Date(stored.startedAt).getTime() < IN_PROGRESS_MAX_AGE_MS
    if (fresh && Array.isArray(stored.order) && Array.isArray(stored.dartsByPlayer)) {
      return { ...stored, gameMode: stored.gameMode === '301' ? '301' : 'volees' }
    }
  } catch {
    // stockage corrompu : on repart d'une session vierge
  }
  localStorage.removeItem(IN_PROGRESS_KEY)
  return null
}

export default function TirerPage() {
  const router = useRouter()
  const toast = useToast()
  const { players, stats, loading, error, configured, saveSessions } = useLeagueContext()
  const { publish, stop: stopLive } = useLiveMatchPublisher()

  // L'annonceur parle ; son coupé, il écrit (toast) pour ne rien perdre.
  const announce = (text: string) => {
    if (soundsEnabled()) say(text)
    else toast(text)
  }

  const [gameMode, setGameMode] = useState<GameMode>('volees')
  const [order, setOrder] = useState<string[]>([])
  const [started, setStarted] = useState(false)
  const [dartsByPlayer, setDartsByPlayer] = useState<Dart[][]>([])
  const [matchId, setMatchId] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [mult, setMult] = useState<Mult>(1)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [flash, setFlash] = useState<Flash | null>(null)

  useEffect(() => {
    if (flash === null) return
    if (flash.kind === 'perfect') {
      void fireConfetti('perfect')
      fanfare('perfect')
      say('Cent quatre-vingts !')
      vibrate([60, 60, 60, 60, 120])
    } else {
      void fireConfetti('record')
      fanfare('record')
      say(`${flash.name} remporte le 301 !`)
      vibrate([80, 60, 80])
    }
    const timer = setTimeout(() => setFlash(null), 1800)
    return () => clearTimeout(timer)
  }, [flash])

  // Reprend une session interrompue (changement d'onglet, rechargement).
  useEffect(() => {
    const stored = loadStoredMatch()
    if (stored) {
      setOrder(stored.order)
      setDartsByPlayer(stored.dartsByPlayer)
      setMatchId(stored.matchId)
      setStartedAt(stored.startedAt)
      setGameMode(stored.gameMode)
      setStarted(true)
    }
  }, [])

  const replays = useMemo(
    () => (gameMode === '301' ? dartsByPlayer.map(replay301) : []),
    [gameMode, dartsByPlayer],
  )

  // Sauvegarde locale de la session en cours + diffusion en direct.
  useEffect(() => {
    if (!started || matchId === null || startedAt === null) return
    localStorage.setItem(
      IN_PROGRESS_KEY,
      JSON.stringify({ matchId, startedAt, order, dartsByPlayer, gameMode } satisfies StoredMatch),
    )
    const thrown = dartsByPlayer.reduce((sum, d) => sum + d.length, 0)
    const done =
      gameMode === '301'
        ? replays.some((r) => r.finished)
        : thrown === order.length * DARTS_PER_SESSION
    publish({
      id: matchId,
      startedAt,
      finished: done,
      mode: gameMode,
      players: order.map((id) => {
        const player = players.find((p) => p.id === id)
        return { id, name: player?.name ?? '?', nickname: player?.nickname ?? null }
      }),
      darts: dartsByPlayer,
    })
  }, [started, matchId, startedAt, order, dartsByPlayer, gameMode, replays, players, publish])

  // Si un joueur de la session restaurée a été supprimé entre-temps, on repart à zéro.
  useEffect(() => {
    if (!started || loading || order.length === 0) return
    if (order.some((id) => !players.some((p) => p.id === id))) {
      localStorage.removeItem(IN_PROGRESS_KEY)
      stopLive()
      setStarted(false)
      setOrder([])
      setDartsByPlayer([])
      setMatchId(null)
      setStartedAt(null)
    }
  }, [started, loading, order, players, stopLive])

  const bestByPlayer = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of stats) {
      map.set(s.player_id, Math.max(map.get(s.player_id) ?? 0, s.best_total))
    }
    return map
  }, [stats])

  // Verrou d'enregistrement : empêche d'insérer deux fois la même partie.
  const savedRef = useRef(false)

  // Célébration de fin de défi 4 volées : confettis si au moins un record tombe.
  const celebratedRef = useRef(false)
  useEffect(() => {
    if (gameMode !== 'volees') return
    const thrown = dartsByPlayer.reduce((sum, d) => sum + d.length, 0)
    const done = started && order.length > 0 && thrown === order.length * DARTS_PER_SESSION
    if (!done) {
      celebratedRef.current = false
      return
    }
    if (celebratedRef.current) return
    celebratedRef.current = true
    vibrate([40, 60, 40])
    const recordHolders = order.filter(
      (playerId, i) => sessionTotal(dartsByPlayer[i]) > (bestByPlayer.get(playerId) ?? -1),
    )
    if (recordHolders.length > 0) {
      void fireConfetti('record')
      fanfare('record')
      const names = recordHolders.map((id) => stageName(players.find((p) => p.id === id)))
      announce(`Nouveau record pour ${names.join(' et ')} !`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode, started, order, dartsByPlayer, bestByPlayer, players])

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
  const finished =
    started &&
    (gameMode === '301' ? replays.some((r) => r.finished) : thrownCount === totalDarts)

  // Les volées alternent entre joueurs : volée 1 de chacun, puis volée 2, etc.
  // (en 301, les volées écourtées sont complétées par des ratés neutres,
  // la rotation reste donc exacte)
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
    savedRef.current = false
    setDartsByPlayer(order.map(() => []))
    setMatchId(crypto.randomUUID())
    setStartedAt(new Date().toISOString())
    setStarted(true)
    setSaveError(null)
    const first = players.find((p) => p.id === order[0])
    announce(
      gameMode === '301'
        ? `301, c'est parti ! ${stageName(first)}, à la cible.`
        : `C'est parti ! ${stageName(first)}, à la cible.`,
    )
  }

  function announceVolley(volleyTotal: number, sessionDone: boolean) {
    const commentaire = praise(volleyTotal) ?? trashTalk(volleyTotal)
    if (commentaire) toast(commentaire)
    const nextIndex = (globalVolley + 1) % Math.max(1, order.length)
    const nextPlayer = players.find((p) => p.id === order[nextIndex])
    const relais = !sessionDone && order.length > 1 ? ` À toi, ${stageName(nextPlayer)} !` : ''
    if (soundsEnabled()) {
      if (commentaire || relais) say(`${commentaire ?? ''}${relais}`)
    } else if (relais) {
      toast(relais.trim())
    }
  }

  function setPlayerDarts(playerIndex: number, darts: Dart[]) {
    setDartsByPlayer((current) => current.map((d, i) => (i === playerIndex ? darts : d)))
  }

  function throwDart(dart: Dart) {
    if (finished) return
    thock(dart.sector === 0 ? 'miss' : dart.sector === 25 && dart.mult === 2 ? 'bull' : 'normal')
    setMult(1)
    vibrate(12)

    if (gameMode === '301') {
      const own = [...currentDarts, dart]
      const result = replay301(own)

      if (result.finished) {
        setPlayerDarts(currentPlayerIndex, padVolley(own))
        if (currentPlayer) setFlash({ title: 'Gagné !', name: currentPlayer.name, kind: 'win' })
        return
      }
      if (result.lastVolleyBusted) {
        // La volée est annulée et complétée : la main passe.
        setPlayerDarts(currentPlayerIndex, padVolley(own))
        const nextIndex = (globalVolley + 1) % Math.max(1, order.length)
        const nextPlayer = players.find((p) => p.id === order[nextIndex])
        const relais = order.length > 1 ? ` À toi, ${stageName(nextPlayer)} !` : ''
        announce(`Bust ! La volée est annulée.${relais}`)
        return
      }
      setPlayerDarts(currentPlayerIndex, own)
      if (own.length % DARTS_PER_VOLLEY === 0) {
        const volleyDarts = own.slice(-DARTS_PER_VOLLEY)
        announceVolley(sessionTotal(volleyDarts), false)
      }
      return
    }

    const volleyAfterThrow = [...currentVolley, dart]
    if (volleyAfterThrow.length === DARTS_PER_VOLLEY) {
      const volleyTotal = sessionTotal(volleyAfterThrow)
      if (volleyTotal === PERFECT_VOLLEY && currentPlayer) {
        setFlash({ title: '180 !', name: currentPlayer.name, kind: 'perfect' })
      } else {
        announceVolley(volleyTotal, thrownCount + 1 === totalDarts)
      }
    }
    setPlayerDarts(currentPlayerIndex, [...currentDarts, dart])
  }

  function undo() {
    // En 301, une volée passée peut avoir été annulée ou complétée :
    // on ne revient que sur la volée en cours.
    if (gameMode === '301') {
      if (currentVolley.length === 0) return
      setPlayerDarts(currentPlayerIndex, currentDarts.slice(0, -1))
      return
    }
    if (thrownCount === 0) return
    const lastVolley = Math.floor((thrownCount - 1) / DARTS_PER_VOLLEY)
    const lastPlayerIndex = lastVolley % order.length
    setDartsByPlayer((current) =>
      current.map((darts, i) => (i === lastPlayerIndex ? darts.slice(0, -1) : darts)),
    )
  }

  function reset() {
    localStorage.removeItem(IN_PROGRESS_KEY)
    stopLive()
    setStarted(false)
    setDartsByPlayer([])
    setMatchId(null)
    setStartedAt(null)
    setMult(1)
    setSaveError(null)
  }

  async function save() {
    // Verrou anti double-clic : une partie ne s'enregistre qu'une fois.
    if (saving || savedRef.current) return
    setSaving(true)
    const entries = order.map((playerId, i) =>
      gameMode === '301'
        ? {
            playerId,
            darts: dartsByPlayer[i],
            total: replays[i].scored,
            won: replays[i].finished,
          }
        : {
            playerId,
            darts: dartsByPlayer[i],
            total: sessionTotal(dartsByPlayer[i]),
          },
    )
    const err = await saveSessions(entries, matchId, gameMode)
    if (err) {
      setSaving(false)
      setSaveError(err)
    } else {
      savedRef.current = true
      localStorage.removeItem(IN_PROGRESS_KEY)
      stopLive()
      toast('Partie enregistrée — le classement est à jour', 'success')
      // reset immédiat : le bouton disparaît, impossible de ré-enregistrer
      setStarted(false)
      setDartsByPlayer([])
      setMatchId(null)
      setStartedAt(null)
      setSaving(false)
      router.push(gameMode === '301' ? '/historique' : '/')
    }
  }

  const flashOverlay = flash !== null && (
    <div className="flash180" role="status">
      <span className="flash180__score">{flash.title}</span>
      <span className="flash180__name">{flash.name}</span>
    </div>
  )

  if (!started) {
    return (
      <div className="stack">
        <div className="idle-board" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-512.png" alt="" width={180} height={180} />
        </div>
        <section>
          <h2 className="section-title">Jeu</h2>
          <div className="chips" role="radiogroup" aria-label="Type de jeu">
            <button
              type="button"
              role="radio"
              aria-checked={gameMode === 'volees'}
              className={gameMode === 'volees' ? 'chip chip--on' : 'chip'}
              onClick={() => setGameMode('volees')}
            >
              Défi 4 volées
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={gameMode === '301'}
              className={gameMode === '301' ? 'chip chip--on' : 'chip'}
              onClick={() => setGameMode('301')}
            >
              301
            </button>
          </div>
          {gameMode === '301' && (
            <p className="mode-hint">
              Premier à zéro exactement — dépasser annule la volée. Sortie sèche, sans double
              obligatoire. Ne compte pas au classement, mais nourrit les face-à-face.
            </p>
          )}
        </section>
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
        return gameMode === '301'
          ? {
              playerId,
              name: player?.name ?? '?',
              total: replays[i].scored,
              won: replays[i].finished,
              record: false,
              sub: replays[i].finished ? '301 franchi' : `reste ${replays[i].remaining}`,
            }
          : {
              playerId,
              name: player?.name ?? '?',
              total: sessionTotal(dartsByPlayer[i]),
              won: false,
              record: sessionTotal(dartsByPlayer[i]) > (bestByPlayer.get(playerId) ?? -1),
              sub: null,
            }
      })
      .sort((a, b) => Number(b.won) - Number(a.won) || b.total - a.total)

    return (
      <div className="stack">
        <section>
          <h2 className="section-title">
            {gameMode === '301' ? 'Fin de partie — 301' : 'Fin de session'}
          </h2>
          <div className="recap">
            {recap.map((line) => (
              <div
                key={line.playerId}
                className={line.record || line.won ? 'recap__row recap__row--record' : 'recap__row'}
              >
                <span className="recap__name">
                  {line.won && '🏆 '}
                  {line.name}
                </span>
                {line.record && <span className="recap__badge">Nouveau record</span>}
                {line.sub && !line.won && <span className="recap__badge">{line.sub}</span>}
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
        {flashOverlay}
      </div>
    )
  }

  return (
    <div className="scorer">
      <div className="scorer__status">
        <div>
          <p className="scorer__volley">
            {gameMode === '301'
              ? `301 · Volée ${currentRound + 1}`
              : `Volée ${currentRound + 1}/${VOLLEYS_PER_SESSION}`}
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
              {player?.name}{' '}
              <strong>
                {gameMode === '301'
                  ? (replays[i]?.remaining ?? START_301)
                  : sessionTotal(dartsByPlayer[i])}
              </strong>
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
          <button
            type="button"
            className="key key--undo"
            onClick={undo}
            disabled={gameMode === '301' ? currentVolley.length === 0 : thrownCount === 0}
          >
            Annuler
          </button>
        </div>
      </div>
      {flashOverlay}
    </div>
  )
}
