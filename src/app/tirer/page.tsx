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
import {
  POWER_BY_ID,
  canActivate,
  drawAssignments,
  replayPowers,
  sessionPowers,
  virageOptions,
  type MatchEvent,
  type PowerEvent,
  type PowerId,
} from '@/lib/powers'
import { signatureUrl } from '@/lib/signatures'
import { fanfare, playSignature, say, soundsEnabled, thock } from '@/lib/sound'
import { volleyComment } from '@/lib/trashTalk'
import { useLeagueContext } from '@/lib/LeagueProvider'
import { averageVolleyOf, type GameMode, type PlayerRow } from '@/lib/useLeague'

/** Nom d'annonce : le surnom s'il existe, sinon le prénom. */
function stageName(player: PlayerRow | undefined): string {
  return player?.nickname ?? player?.name ?? '?'
}

/** URL de la signature sonore du joueur (MP3 d'entrée en scène), s'il en a une. */
function signatureOf(player: PlayerRow | undefined): string | null {
  return player?.signature_path ? signatureUrl(player.signature_path) : null
}

/** Relais annoncé : entrée en piste au premier tour du joueur, « À toi » ensuite. */
function relayText(player: PlayerRow | undefined, firstTurn: boolean): string {
  return firstTurn ? `${stageName(player)} entre en piste !` : `À toi, ${stageName(player)} !`
}

/**
 * Une annonce en trois temps, toujours dans cet ordre : ce qui vient de se
 * passer (commentaire de volée, bust, records…), le thème du joueur qui prend
 * la main, puis son relais. Le commentaire ne doit jamais s'intercaler entre
 * la signature et l'entrée en piste qu'elle annonce.
 */
interface Announcement {
  lead?: string
  signature?: string | null
  relay?: string
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
  /** Présent quand la session se joue avec pouvoirs : le journal fait foi. */
  powers?: { assignments: PowerId[]; journal: MatchEvent[] }
}

interface Flash {
  title: string
  name: string
  kind: 'perfect' | 'win'
  /** Thème musical du vainqueur, rejoué avant l'annonce (301). */
  signature?: string | null
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
  const { players, stats, punchlines, loading, error, configured, saveSessions } =
    useLeagueContext()
  const { publish, stop: stopLive } = useLiveMatchPublisher()

  // L'annonceur parle ; son coupé, il écrit (toast) pour ne rien perdre.
  // Quand le joueur qui prend la main a une signature (MP3), le commentaire de
  // la volée qui s'achève passe d'abord, puis le thème ouvre le bal, puis la
  // voix annonce l'entrée en piste. Sans signature, tout tient en un énoncé.
  const announce = ({ lead = '', signature = null, relay = '' }: Announcement) => {
    const full = [lead, relay].filter(Boolean).join(' ')
    if (!soundsEnabled()) {
      if (full) toast(full)
      return
    }
    if (!signature) {
      if (full) void say(full)
      return
    }
    void (async () => {
      if (lead) await say(lead)
      // Le son a pu être coupé pendant le commentaire ; say le vérifie déjà.
      if (soundsEnabled()) await playSignature(signature)
      if (relay) void say(relay)
    })()
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
  // Pouvoirs : opt-in au lancement, journal unique (fléchettes + activations).
  const [powersEnabled, setPowersEnabled] = useState(false)
  const [assignments, setAssignments] = useState<PowerId[] | null>(null)
  const [journal, setJournal] = useState<MatchEvent[]>([])
  /** Index (dans order) du joueur dont le pouvoir attend un paramètre. */
  const [powerDialog, setPowerDialog] = useState<number | null>(null)

  useEffect(() => {
    if (flash === null) return
    if (flash.kind === 'perfect') {
      void fireConfetti('perfect')
      fanfare('perfect')
      void say('Cent quatre-vingts !')
      vibrate([60, 60, 60, 60, 120])
    } else {
      void fireConfetti('record')
      fanfare('record')
      vibrate([80, 60, 80])
      // Le vainqueur ressort sur son thème, l'annonce enchaîne.
      const text = `${flash.name} remporte le 301 !`
      if (flash.signature && soundsEnabled()) {
        void playSignature(flash.signature).then(() => say(text))
      } else {
        void say(text)
      }
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
      if (stored.powers) {
        setAssignments(stored.powers.assignments)
        setJournal(stored.powers.journal)
        setPowersEnabled(true)
      }
      setStarted(true)
    }
  }, [])

  const replays = useMemo(
    () => (gameMode === '301' ? dartsByPlayer.map(replay301) : []),
    [gameMode, dartsByPlayer],
  )

  // Rejeu du journal des pouvoirs : toute la partie en découle.
  const powersActive = started && gameMode === 'volees' && assignments !== null
  const powersReplay = useMemo(
    () => (assignments !== null ? replayPowers(order.length, assignments, journal) : null),
    [assignments, order.length, journal],
  )

  // Sauvegarde locale de la session en cours + diffusion en direct.
  useEffect(() => {
    if (!started || matchId === null || startedAt === null) return
    const withPowers = powersActive && powersReplay !== null && assignments !== null
    localStorage.setItem(
      IN_PROGRESS_KEY,
      JSON.stringify({
        matchId,
        startedAt,
        order,
        dartsByPlayer: withPowers ? powersReplay.dartsByPlayer : dartsByPlayer,
        gameMode,
        ...(withPowers ? { powers: { assignments, journal } } : {}),
      } satisfies StoredMatch),
    )
    const thrown = dartsByPlayer.reduce((sum, d) => sum + d.length, 0)
    const done = withPowers
      ? powersReplay.finished
      : gameMode === '301'
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
      darts: withPowers ? powersReplay.dartsByPlayer : dartsByPlayer,
      ...(withPowers
        ? {
            powers: {
              byPlayer: assignments.map((powerId, i) => {
                const held = powersReplay.holders[i]
                const def = POWER_BY_ID[held ?? powerId]
                return { emoji: def.emoji, title: def.title, used: held === null }
              }),
              totals: powersReplay.totals,
              current:
                powersReplay.current?.player ?? powersReplay.pendingHole?.player ?? null,
              round:
                powersReplay.current?.round ?? powersReplay.pendingHole?.round ?? 0,
            },
          }
        : {}),
    })
  }, [
    started,
    matchId,
    startedAt,
    order,
    dartsByPlayer,
    gameMode,
    replays,
    players,
    publish,
    powersActive,
    powersReplay,
    assignments,
    journal,
  ])

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

  // Moyenne de volée maison (toutes sessions classées confondues) : l'annonceur
  // calibre ses compliments sur le niveau réel de l'équipe, pas sur celui des pros.
  const averageVolley = useMemo(() => averageVolleyOf(stats), [stats])

  // Verrou d'enregistrement : empêche d'insérer deux fois la même partie.
  const savedRef = useRef(false)

  // Célébration de fin de défi 4 volées : le vainqueur est annoncé et ressort
  // sur son thème musical ; confettis si au moins un record tombe. Le 301
  // fête son vainqueur via le flash « Gagné ! » ; avec pouvoirs, pas de
  // record à fêter (partie hors classement), mais un vainqueur quand même.
  const celebratedRef = useRef(false)
  useEffect(() => {
    if (gameMode !== 'volees') return
    const withPowers = powersActive && powersReplay !== null
    const thrown = dartsByPlayer.reduce((sum, d) => sum + d.length, 0)
    const done =
      started &&
      order.length > 0 &&
      (withPowers ? powersReplay.finished : thrown === order.length * DARTS_PER_SESSION)
    if (!done) {
      celebratedRef.current = false
      return
    }
    if (celebratedRef.current) return
    celebratedRef.current = true
    vibrate([40, 60, 40])
    const recordHolders = withPowers
      ? []
      : order.filter(
          (playerId, i) => sessionTotal(dartsByPlayer[i]) > (bestByPlayer.get(playerId) ?? -1),
        )
    if (recordHolders.length > 0) {
      void fireConfetti('record')
      fanfare('record')
    }
    const recordNames = recordHolders.map((id) => stageName(players.find((p) => p.id === id)))
    const records =
      recordNames.length > 0 ? `Nouveau record pour ${recordNames.join(' et ')} ! ` : ''
    // En solo, pas de vainqueur à proclamer : on s'en tient aux records.
    if (order.length < 2) {
      if (records) announce({ lead: records.trim() })
      return
    }
    const totals = withPowers
      ? powersReplay.totals
      : order.map((_, i) => sessionTotal(dartsByPlayer[i]))
    const best = Math.max(...totals)
    const winnerIds = order.filter((_, i) => totals[i] === best)
    const winner = winnerIds.length === 1 ? players.find((p) => p.id === winnerIds[0]) : undefined
    const winnerNames = winnerIds.map((id) => stageName(players.find((p) => p.id === id)))
    announce({
      lead: records.trim(),
      signature: signatureOf(winner),
      relay: winner
        ? `${stageName(winner)} remporte la partie !`
        : `Égalité entre ${winnerNames.join(' et ')} !`,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode, started, order, dartsByPlayer, bestByPlayer, players, powersActive, powersReplay])

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
    (powersActive && powersReplay !== null
      ? powersReplay.finished
      : gameMode === '301'
        ? replays.some((r) => r.finished)
        : thrownCount === totalDarts)

  // Les volées alternent entre joueurs : volée 1 de chacun, puis volée 2, etc.
  // (en 301, les volées écourtées sont complétées par des ratés neutres,
  // la rotation reste donc exacte ; avec pouvoirs, le moteur fait foi)
  const globalVolley = Math.floor(thrownCount / DARTS_PER_VOLLEY)
  const currentPlayerIndex =
    powersActive && powersReplay !== null
      ? (powersReplay.current?.player ?? powersReplay.pendingHole?.player ?? 0)
      : globalVolley % Math.max(1, order.length)
  const currentRound =
    powersActive && powersReplay !== null
      ? (powersReplay.current?.round ?? powersReplay.pendingHole?.round ?? 0)
      : Math.floor(globalVolley / Math.max(1, order.length))
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
    const withPowers = gameMode === 'volees' && powersEnabled
    if (withPowers) {
      const drawn = drawAssignments(order.length)
      setAssignments(drawn)
      setJournal([])
      // Le tirage est révélé joueur par joueur, façon annonceur.
      drawn.forEach((powerId, i) => {
        const def = POWER_BY_ID[powerId]
        const player = players.find((p) => p.id === order[i])
        toast(`${def.emoji} ${player?.name ?? '?'} reçoit « ${def.title} » — ${def.description}`)
      })
    } else {
      setAssignments(null)
      setJournal([])
    }
    const first = players.find((p) => p.id === order[0])
    announce({
      lead:
        gameMode === '301'
          ? `301, c'est parti !`
          : withPowers
            ? 'Tirage des pouvoirs effectué !'
            : `C'est parti !`,
      signature: signatureOf(first),
      relay: relayText(first, true),
    })
  }

  function announceVolley(volleyTotal: number, sessionDone: boolean) {
    const commentaire = volleyComment(volleyTotal, averageVolley, punchlines)
    // Le commentaire s'affiche pendant que l'annonceur le dit ; son coupé,
    // c'est announce qui l'écrit, relais compris.
    if (commentaire && soundsEnabled()) toast(commentaire)
    const nextIndex = (globalVolley + 1) % Math.max(1, order.length)
    const nextPlayer = players.find((p) => p.id === order[nextIndex])
    const firstTurn = (dartsByPlayer[nextIndex] ?? []).length === 0
    const relais = !sessionDone && order.length > 1 ? relayText(nextPlayer, firstTurn) : ''
    // La signature n'accompagne que l'entrée en piste, pas les tours suivants.
    announce({
      lead: commentaire ?? '',
      signature: relais && firstTurn ? signatureOf(nextPlayer) : null,
      relay: relais,
    })
  }

  function setPlayerDarts(playerIndex: number, darts: Dart[]) {
    setDartsByPlayer((current) => current.map((d, i) => (i === playerIndex ? darts : d)))
  }

  /** Volée tout juste complétée par la dernière fléchette du journal, s'il y en a une. */
  function completedTurnTotal(
    before: NonNullable<typeof powersReplay>,
    after: NonNullable<typeof powersReplay>,
  ): number | null {
    const full = (t: (typeof after.turns)[number]) =>
      t.darts.length >= t.size && t.darts.every((d) => d !== null)
    for (let i = 0; i < after.turns.length; i++) {
      if (full(after.turns[i]) && (before.turns[i] === undefined || !full(before.turns[i]))) {
        const turn = after.turns[i]
        const volleyIndex = after.turns
          .slice(0, i)
          .filter((t) => t.player === turn.player).length
        return after.effectiveVolleyTotals[turn.player][volleyIndex]
      }
    }
    return null
  }

  function throwPowersDart(dart: Dart) {
    if (powersReplay === null || assignments === null || powersReplay.finished) return
    thock(dart.sector === 0 ? 'miss' : dart.sector === 25 && dart.mult === 2 ? 'bull' : 'normal')
    setMult(1)
    vibrate(12)
    const nextJournal: MatchEvent[] = [...journal, { kind: 'dart', dart }]
    const after = replayPowers(order.length, assignments, nextJournal)
    setJournal(nextJournal)

    const volleyTotal = completedTurnTotal(powersReplay, after)
    if (volleyTotal === null) return
    if (volleyTotal === PERFECT_VOLLEY && currentPlayer) {
      setFlash({ title: '180 !', name: currentPlayer.name, kind: 'perfect' })
      return
    }
    const commentaire = volleyComment(volleyTotal, averageVolley, punchlines)
    if (commentaire && soundsEnabled()) toast(commentaire)
    const nextPlayer =
      after.current !== null ? players.find((p) => p.id === order[after.current!.player]) : null
    const firstTurn =
      after.current !== null && after.dartsByPlayer[after.current.player].length === 0
    const relais =
      !after.finished && nextPlayer && order.length > 1 ? relayText(nextPlayer, firstTurn) : ''
    // La signature n'accompagne que l'entrée en piste, pas les tours suivants.
    announce({
      lead: commentaire ?? '',
      signature: relais && firstTurn ? signatureOf(nextPlayer ?? undefined) : null,
      relay: relais,
    })
  }

  /** Active un pouvoir (après validation) et l'annonce. */
  function activatePower(event: Omit<PowerEvent, 'kind'>) {
    if (assignments === null) return
    const check = canActivate(order.length, assignments, journal, event)
    if (!check.ok) {
      toast(check.reason)
      return
    }
    setJournal([...journal, { kind: 'power', ...event }])
    setPowerDialog(null)
    const def = POWER_BY_ID[event.power]
    const actor = players.find((p) => p.id === order[event.actor])
    const targetId = event.target !== undefined ? order[event.target] : null
    const target = targetId !== null ? players.find((p) => p.id === targetId) : null
    announce({
      lead: `${stageName(actor)} dégaine ${def.title} !${target ? ` ${stageName(target)}, tiens-toi prêt.` : ''}`,
    })
  }

  function throwDart(dart: Dart) {
    if (powersActive) {
      throwPowersDart(dart)
      return
    }
    if (finished) return
    thock(dart.sector === 0 ? 'miss' : dart.sector === 25 && dart.mult === 2 ? 'bull' : 'normal')
    setMult(1)
    vibrate(12)

    if (gameMode === '301') {
      const own = [...currentDarts, dart]
      const result = replay301(own)

      if (result.finished) {
        setPlayerDarts(currentPlayerIndex, padVolley(own))
        if (currentPlayer) {
          setFlash({
            title: 'Gagné !',
            name: currentPlayer.name,
            kind: 'win',
            signature: signatureOf(currentPlayer),
          })
        }
        return
      }
      if (result.lastVolleyBusted) {
        // La volée est annulée et complétée : la main passe.
        setPlayerDarts(currentPlayerIndex, padVolley(own))
        const nextIndex = (globalVolley + 1) % Math.max(1, order.length)
        const nextPlayer = players.find((p) => p.id === order[nextIndex])
        const firstTurn = (dartsByPlayer[nextIndex] ?? []).length === 0
        const relais = order.length > 1 ? relayText(nextPlayer, firstTurn) : ''
        announce({
          lead: 'Bust ! La volée est annulée.',
          signature: relais && firstTurn ? signatureOf(nextPlayer) : null,
          relay: relais,
        })
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
    // Avec pouvoirs : on retire le dernier événement du journal (fléchette ou
    // activation) — le rejeu restaure trous et pouvoirs automatiquement.
    if (powersActive) {
      if (journal.length === 0) return
      setJournal(journal.slice(0, -1))
      return
    }
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
    setAssignments(null)
    setJournal([])
    setPowerDialog(null)
  }

  async function save() {
    // Verrou anti double-clic : une partie ne s'enregistre qu'une fois.
    if (saving || savedRef.current) return
    setSaving(true)
    const powersRows =
      powersActive && powersReplay !== null && assignments !== null
        ? sessionPowers(powersReplay, assignments)
        : null
    const entries = order.map((playerId, i) =>
      powersRows !== null && powersReplay !== null
        ? {
            playerId,
            darts: powersReplay.dartsByPlayer[i],
            total: powersReplay.totals[i],
            powers: powersRows[i],
          }
        : gameMode === '301'
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
      // Hors classement (301, pouvoirs) : direction l'historique plutôt que le tableau.
      router.push(gameMode === '301' || powersRows !== null ? '/historique' : '/')
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
          {gameMode === 'volees' && (
            <div className="chips chips--powers">
              <button
                type="button"
                aria-pressed={powersEnabled}
                className={powersEnabled ? 'chip chip--on' : 'chip'}
                onClick={() => setPowersEnabled((on) => !on)}
              >
                🃏 Pouvoirs
              </button>
            </div>
          )}
          {gameMode === 'volees' && powersEnabled && (
            <p className="mode-hint">
              Chaque joueur reçoit au hasard un pouvoir secret de l’équipe, utilisable une seule
              fois. Partie hors classement, mais l’honneur est en jeu.
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
        if (powersActive && powersReplay !== null) {
          return {
            playerId,
            name: player?.name ?? '?',
            total: powersReplay.totals[i],
            won: false,
            record: false,
            sub: powersReplay.bonuses[i] > 0 ? `dont +${powersReplay.bonuses[i]} de bonus` : null,
          }
        }
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
            {gameMode === '301'
              ? 'Fin de partie — 301'
              : powersActive
                ? 'Fin de session — Pouvoirs'
                : 'Fin de session'}
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

  const activeTurn = powersActive ? (powersReplay?.activeTurn ?? null) : null
  const slotCount = activeTurn ? activeTurn.size : DARTS_PER_VOLLEY
  const pendingSlot = powersActive ? (powersReplay?.pendingSlot ?? null) : null

  return (
    <div className="scorer">
      <div className="scorer__status">
        <div>
          <p className="scorer__volley">
            {gameMode === '301'
              ? `301 · Volée ${currentRound + 1}`
              : powersActive
                ? `🃏 Volée ${currentRound + 1}/${VOLLEYS_PER_SESSION}`
                : `Volée ${currentRound + 1}/${VOLLEYS_PER_SESSION}`}
          </p>
          <p className="scorer__thrower">
            {currentPlayer?.name}
            {pendingSlot !== null && ' — relance !'}
          </p>
        </div>
        <button type="button" className="button-ghost" onClick={reset}>
          Abandonner
        </button>
      </div>

      <div className="scorer__slots">
        {Array.from({ length: slotCount }, (_, i) => {
          const dart = activeTurn ? activeTurn.darts[i] : currentVolley[i]
          return (
            <div key={i} className={dart ? 'slot slot--filled' : 'slot'}>
              {dart ? (
                <>
                  <span className="slot__label">{dartLabel(dart)}</span>
                  <span className="slot__value">{dartValue(dart)} pts</span>
                </>
              ) : (
                <span className="slot__value">
                  {i === pendingSlot ? 'Relance !' : `Fléchette ${i + 1}`}
                </span>
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
                {powersActive && powersReplay !== null
                  ? powersReplay.totals[i]
                  : gameMode === '301'
                    ? (replays[i]?.remaining ?? START_301)
                    : sessionTotal(dartsByPlayer[i])}
              </strong>
            </span>
          )
        })}
      </div>

      {powersActive && powersReplay !== null && assignments !== null && (
        <div className="powers-bar">
          {order.map((playerId, i) => {
            const held = powersReplay.holders[i]
            const def = POWER_BY_ID[held ?? assignments[i]]
            const player = players.find((p) => p.id === playerId)
            const ready =
              held !== null &&
              canActivate(order.length, assignments, journal, { power: held, actor: i }).ok
            return (
              <button
                key={playerId}
                type="button"
                className={
                  held === null
                    ? 'power-chip power-chip--used'
                    : ready
                      ? 'power-chip power-chip--ready'
                      : 'power-chip'
                }
                disabled={held === null}
                title={`${def.persona} — ${def.description}`}
                onClick={() => {
                  if (held === null) return
                  const check = canActivate(order.length, assignments, journal, {
                    power: held,
                    actor: i,
                  })
                  if (!check.ok) {
                    toast(check.reason)
                    return
                  }
                  if (POWER_BY_ID[held].param === 'rien') activatePower({ power: held, actor: i })
                  else setPowerDialog(i)
                }}
              >
                <span className="power-chip__emoji" aria-hidden="true">
                  {def.emoji}
                </span>
                <span className="power-chip__who">{player?.name}</span>
                <span className="power-chip__title">{held === null ? 'utilisé' : def.title}</span>
              </button>
            )
          })}
        </div>
      )}

      {powersActive &&
        powerDialog !== null &&
        assignments !== null &&
        powersReplay !== null &&
        (() => {
          const actor = powerDialog
          const held = powersReplay.holders[actor]
          if (held === null) return null
          const def = POWER_BY_ID[held]
          const copiables = [
            ...new Set(
              powersReplay.usedPowers.filter((u) => u.power !== 'copie').map((u) => u.power),
            ),
          ]
          return (
            <section className="power-dialog">
              <p className="power-dialog__title">
                {def.emoji} {def.title}
              </p>
              <p className="power-dialog__desc">{def.description}</p>
              <div className="chips">
                {def.param === 'cible' &&
                  order.map(
                    (pid, t) =>
                      t !== actor && (
                        <button
                          key={pid}
                          type="button"
                          className="chip"
                          onClick={() => activatePower({ power: held, actor, target: t })}
                        >
                          {players.find((p) => p.id === pid)?.name}
                        </button>
                      ),
                  )}
                {def.param === 'secteur' &&
                  SECTORS.map((sector) => (
                    <button
                      key={sector}
                      type="button"
                      className="chip"
                      onClick={() => activatePower({ power: held, actor, sector })}
                    >
                      {sector}
                    </button>
                  ))}
                {def.param === 'vote' && (
                  <>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => activatePower({ power: held, actor, outcome: 'normal' })}
                    >
                      Vote : rien ne change
                    </button>
                    <button
                      type="button"
                      className="chip"
                      onClick={() =>
                        activatePower({ power: held, actor, outcome: 'triples-double' })
                      }
                    >
                      Vote : triples valent double
                    </button>
                  </>
                )}
                {def.param === 'pouvoir' &&
                  copiables.map((powerId) => (
                    <button
                      key={powerId}
                      type="button"
                      className="chip"
                      onClick={() => activatePower({ power: held, actor, copied: powerId })}
                    >
                      {POWER_BY_ID[powerId].emoji} {POWER_BY_ID[powerId].title}
                    </button>
                  ))}
                {def.param === 'virage' &&
                  (() => {
                    const turn = [...powersReplay.turns]
                      .reverse()
                      .find(
                        (t) =>
                          t.player === actor &&
                          t.darts.length >= t.size &&
                          t.darts.every((x) => x !== null),
                      )
                    if (!turn) return null
                    return virageOptions(turn).map(({ slot, dart }) => (
                      <button
                        key={`${slot}-${dart.sector}-${dart.mult}`}
                        type="button"
                        className="chip"
                        onClick={() => activatePower({ power: held, actor, slot, dart })}
                      >
                        {dartLabel(turn.darts[slot]!)} → {dartLabel(dart)}
                      </button>
                    ))
                  })()}
              </div>
              <button type="button" className="button-ghost" onClick={() => setPowerDialog(null)}>
                Fermer
              </button>
            </section>
          )
        })()}

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
            disabled={
              powersActive
                ? journal.length === 0
                : gameMode === '301'
                  ? currentVolley.length === 0
                  : thrownCount === 0
            }
          >
            Annuler
          </button>
        </div>
      </div>
      {flashOverlay}
    </div>
  )
}
