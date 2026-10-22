'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DartInput } from '@/components/DartInput'
import { LastVolley } from '@/components/LastVolley'
import { useDialog } from '@/components/Dialog'
import { TurnGameScorer } from '@/components/TurnGameScorer'
import { SetupNotice } from '@/components/SetupNotice'
import { RollingNumber } from '@/components/RollingNumber'
import { SoundToggle } from '@/components/SoundToggle'
import {
  DARTS_PER_SESSION,
  DARTS_PER_VOLLEY,
  PERFECT_VOLLEY,
  VOLLEYS_PER_SESSION,
  dartLabel,
  dartValue,
  sessionTotal,
  type Dart,
} from '@/lib/scoring'
import { useToast } from '@/components/Toaster'
import { fireConfetti, vibrate } from '@/lib/effects'
import {
  PLAYERS_PER_MATCH,
  POINTS_OPTIONS,
  SIDE_LABEL,
  TARGET_SCORE,
  drawOpener,
  migrateFletanqueJournal,
  otherSide,
  replayFletanque,
  sessionFletanque,
  teamOf,
  teamPlayers,
  type FletanqueEvent,
  type Side,
} from '@/lib/fletanque'
import { TURN_GAMES, TURN_GAME_IDS, gameLabel, isTurnGame } from '@/lib/gameCatalog'
import { drawKillerNumbers } from '@/lib/games/killer'
import { drawShanghaiTargets, type ShanghaiState } from '@/lib/games/shanghai'
import { useLiveMatchPublisher } from '@/lib/liveMatch'
import { shuffle } from '@/lib/random'
import { IN_PROGRESS_KEY, IN_PROGRESS_MAX_AGE_MS } from '@/lib/matchInProgress'
import { padVolley, replay301, START_301 } from '@/lib/play301'
import type { TurnSetup } from '@/lib/turnGames'
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
import type { GameMode, PlayerRow, TournamentLink } from '@/lib/useLeague'

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



interface StoredMatch {
  matchId: string
  startedAt: string
  order: string[]
  dartsByPlayer: Dart[][]
  gameMode: GameMode
  /** Présent quand la session se joue avec pouvoirs : le journal fait foi. */
  powers?: { assignments: PowerId[]; journal: MatchEvent[] }
  /** Présent en flétanque : l'équipe qui a ouvert, puis le journal des mènes. */
  fletanque?: { opener: Side; journal: FletanqueEvent[] }
  /** Présent dans les jeux au tour par tour : le tirage, puis les fléchettes dans l'ordre. */
  turn?: { setup: TurnSetup; journal: Dart[] }
  /** Présent quand la partie est une rencontre de tournoi. */
  tournament?: TournamentMatch
}

/** Une rencontre de tournoi jouée ici : le résultat s'y inscrit à l'enregistrement. */
interface TournamentMatch extends TournamentLink {
  /** « Poule A », « Demi-finales »… pour le bandeau. */
  label: string
}

/** Lit la rencontre de tournoi passée dans l'URL par la page des tournois. */
function tournamentFromUrl(): { link: TournamentMatch; mode: GameMode; order: string[] } | null {
  const params = new URLSearchParams(window.location.search)
  const id = params.get('tournoi')
  const slot = params.get('rencontre')
  const mode = params.get('jeu')
  const a = params.get('a')
  const b = params.get('b')
  if (!id || !slot || !mode || !a || !b) return null
  if (mode !== 'volees' && mode !== '301' && !isTurnGame(mode)) return null
  return { link: { id, slot, label: params.get('titre') ?? 'Rencontre' }, mode, order: [a, b] }
}

/** Une ligne du récapitulatif de fin : un joueur, ou une équipe en flétanque. */
interface RecapLine {
  playerId: string
  name: string
  total: number
  won: boolean
  record: boolean
  sub: string | null
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
      const mode: GameMode =
        stored.gameMode === '301' || stored.gameMode === 'fletanque' || isTurnGame(stored.gameMode)
          ? stored.gameMode
          : 'volees'
      return { ...stored, gameMode: mode }
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
  const ask = useDialog()
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
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [flash, setFlash] = useState<Flash | null>(null)
  // Pouvoirs : opt-in au lancement, journal unique (fléchettes + activations).
  const [powersEnabled, setPowersEnabled] = useState(false)
  const [assignments, setAssignments] = useState<PowerId[] | null>(null)
  const [journal, setJournal] = useState<MatchEvent[]>([])
  /** Index (dans order) du joueur dont le pouvoir attend un paramètre. */
  const [powerDialog, setPowerDialog] = useState<number | null>(null)
  // Flétanque : l'équipe qui ouvre est tirée au sort, tout le reste découle
  // du journal des décomptes de mène.
  const [fletOpener, setFletOpener] = useState<Side | null>(null)
  const [fletJournal, setFletJournal] = useState<FletanqueEvent[]>([])
  /** Équipe désignée comme gagnante de la mène, en attente de ses points. */
  const [menePick, setMenePick] = useState<Side | null>(null)
  // Jeux au tour par tour : le tirage du lancement, puis les fléchettes dans
  // l'ordre où elles ont été lancées — le moteur en déduit tout le reste.
  const [turnSetup, setTurnSetup] = useState<TurnSetup | null>(null)
  const [turnJournal, setTurnJournal] = useState<Dart[]>([])
  const [tournamentMatch, setTournamentMatch] = useState<TournamentMatch | null>(null)

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
      if (stored.fletanque) {
        setFletOpener(stored.fletanque.opener)
        setFletJournal(migrateFletanqueJournal(stored.fletanque.journal))
      }
      if (stored.turn) {
        setTurnSetup(stored.turn.setup)
        setTurnJournal(stored.turn.journal)
      }
      if (stored.tournament) setTournamentMatch(stored.tournament)
      setStarted(true)
      return
    }
    // Sinon, une rencontre de tournoi peut arriver toute réglée par l'URL.
    const fromUrl = tournamentFromUrl()
    if (fromUrl) {
      setGameMode(fromUrl.mode)
      setOrder(fromUrl.order)
      setPowersEnabled(false)
      setTournamentMatch(fromUrl.link)
    }
  }, [])

  const replays = useMemo(
    () => (gameMode === '301' ? dartsByPlayer.map(replay301) : []),
    [gameMode, dartsByPlayer],
  )

  // Rejeu du journal de flétanque : scores et équipe qui ouvre en découlent —
  // comme pour les pouvoirs, l'annulation est gratuite.
  const fletanqueActive = started && gameMode === 'fletanque' && fletOpener !== null
  const fletReplay = useMemo(
    () => (fletOpener === null ? null : replayFletanque(fletOpener, fletJournal)),
    [fletOpener, fletJournal],
  )

  const turnGame = isTurnGame(gameMode) ? gameMode : null
  const turnActive = started && turnGame !== null && turnSetup !== null
  const turnReplay = useMemo(
    () =>
      turnGame !== null && turnSetup !== null
        ? TURN_GAMES[turnGame].replay(order.length, turnSetup, turnJournal)
        : null,
    [turnGame, turnSetup, order.length, turnJournal],
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
    const withFletanque = fletanqueActive && fletReplay !== null && fletOpener !== null
    const withTurn = turnActive && turnReplay !== null && turnSetup !== null && turnGame !== null
    localStorage.setItem(
      IN_PROGRESS_KEY,
      JSON.stringify({
        matchId,
        startedAt,
        order,
        dartsByPlayer: withPowers
          ? powersReplay.dartsByPlayer
          : withTurn
            ? turnReplay.dartsByPlayer
            : dartsByPlayer,
        gameMode,
        ...(withPowers ? { powers: { assignments, journal } } : {}),
        ...(withFletanque ? { fletanque: { opener: fletOpener, journal: fletJournal } } : {}),
        ...(withTurn ? { turn: { setup: turnSetup, journal: turnJournal } } : {}),
        ...(tournamentMatch ? { tournament: tournamentMatch } : {}),
      } satisfies StoredMatch),
    )
    const thrown = dartsByPlayer.reduce((sum, d) => sum + d.length, 0)
    const done = withTurn
      ? turnReplay.finished
      : withFletanque
      ? fletReplay.finished
      : withPowers
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
      darts: withPowers
        ? powersReplay.dartsByPlayer
        : withTurn
          ? turnReplay.dartsByPlayer
          : dartsByPlayer,
      ...(withTurn
        ? {
            turn: {
              current: turnReplay.current,
              round: turnReplay.round,
              lines: order.map((_, i) => TURN_GAMES[turnGame].view(turnReplay.state, i)),
            },
          }
        : {}),
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
      ...(withFletanque
        ? {
            fletanque: {
              scores: fletReplay.scores,
              mene: fletReplay.menes.length + 1,
              opener: fletReplay.opener,
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
    fletanqueActive,
    fletReplay,
    fletOpener,
    fletJournal,
    turnActive,
    turnReplay,
    turnSetup,
    turnJournal,
    turnGame,
    tournamentMatch,
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
      setFletOpener(null)
      setFletJournal([])
      setTurnSetup(null)
      setTurnJournal([])
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

  // Sacre de la flétanque : l'équipe gagnante sort sur le thème d'un des siens.
  const fletCelebratedRef = useRef(false)
  useEffect(() => {
    if (gameMode !== 'fletanque' || !started || fletReplay === null || !fletReplay.finished) {
      fletCelebratedRef.current = false
      return
    }
    if (fletCelebratedRef.current) return
    fletCelebratedRef.current = true
    void fireConfetti('record')
    fanfare('record')
    vibrate([80, 60, 80])
    const side = fletReplay.winner!
    const winners = teamPlayers(side).map((i) => players.find((p) => p.id === order[i]))
    announce({
      signature: winners.map((w) => signatureOf(w)).find((url) => url !== null) ?? null,
      relay: `${winners.map((w) => stageName(w)).join(' et ')} remportent la flétanque, ${
        fletReplay.scores[side]
      } à ${fletReplay.scores[otherSide(side)]} !`,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode, started, fletReplay, players, order])

  // Fin d'un jeu au tour par tour : le vainqueur sort sur son thème.
  const turnCelebratedRef = useRef(false)
  useEffect(() => {
    if (!turnActive || turnReplay === null || !turnReplay.finished || turnGame === null) {
      turnCelebratedRef.current = false
      return
    }
    if (turnCelebratedRef.current) return
    turnCelebratedRef.current = true
    void fireConfetti('record')
    fanfare('record')
    vibrate([80, 60, 80])
    const winners = turnReplay.winners.map((i) => players.find((p) => p.id === order[i]))
    const label = TURN_GAMES[turnGame].label
    announce({
      lead: turnReplay.lastNote?.text.startsWith('Shanghai')
        ? 'Shanghai !'
        : '',
      signature: winners.length === 1 ? signatureOf(winners[0]) : null,
      relay:
        winners.length === 1
          ? `${stageName(winners[0])} remporte le ${label} !`
          : winners.length > 1
            ? `Égalité au ${label} entre ${winners.map((w) => stageName(w)).join(' et ')} !`
            : `Fin du ${label}.`,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnActive, turnReplay, turnGame, players, order])

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
    (turnActive && turnReplay !== null
      ? turnReplay.finished
      : fletanqueActive && fletReplay !== null
      ? fletReplay.finished
      : powersActive && powersReplay !== null
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

  const fletPlayer = (index: number) => players.find((p) => p.id === order[index])
  const teamSpeech = (side: Side) => (side === 0 ? 'L’équipe A' : 'L’équipe B')
  const teamRoster = (side: Side) =>
    teamPlayers(side)
      .map((i) => fletPlayer(i)?.name ?? '…')
      .join(' & ')

  function toggleOrder(id: string) {
    setOrder((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id)
      if (gameMode === 'fletanque' && current.length >= PLAYERS_PER_MATCH) {
        toast('La flétanque se joue à quatre : retirez un joueur pour en changer.')
        return current
      }
      return [...current, id]
    })
  }

  function start() {
    if (order.length === 0) return
    if (gameMode === 'fletanque' && order.length !== PLAYERS_PER_MATCH) return
    savedRef.current = false
    setDartsByPlayer(order.map(() => []))
    setMatchId(crypto.randomUUID())
    setStartedAt(new Date().toISOString())
    setStarted(true)
    setSaveError(null)
    setMenePick(null)

    if (turnGame !== null) {
      // Killer : chacun reçoit son numéro au lancement, révélé joueur par joueur.
      // Shanghai : les sept numéros à viser sont tirés au sort.
      const setup: TurnSetup =
        turnGame === 'killer'
          ? { numbers: drawKillerNumbers(order.length) }
          : turnGame === 'shanghai'
            ? { targets: drawShanghaiTargets() }
            : {}
      setTurnSetup(setup)
      setTurnJournal([])
      setFletOpener(null)
      setFletJournal([])
      setAssignments(null)
      setJournal([])
      setup.numbers?.forEach((number, i) => {
        toast(`🎯 ${players.find((p) => p.id === order[i])?.name ?? '?'} a le ${number}`)
      })
      if (setup.targets) toast(`🎯 Les numéros à viser : ${setup.targets.join(', ')}`)
      const first = players.find((p) => p.id === order[0])
      announce({
        lead: `${TURN_GAMES[turnGame].label}, c'est parti !${
          setup.targets ? ` Première manche : on vise le ${setup.targets[0]}.` : ''
        }`,
        signature: signatureOf(first),
        relay: relayText(first, true),
      })
      return
    }
    setTurnSetup(null)
    setTurnJournal([])

    if (gameMode === 'fletanque') {
      // Les équipes sont tirées au sort : l'ordre de passage mélangé donne
      // l'équipe A (les deux premiers) et l'équipe B.
      const lineup = shuffle(order)
      setOrder(lineup)
      const roster = (side: Side) =>
        teamPlayers(side)
          .map((i) => players.find((p) => p.id === lineup[i])?.name ?? '?')
          .join(' & ')
      ;([0, 1] as Side[]).forEach((side) => toast(`${SIDE_LABEL[side]} : ${roster(side)}`))
      // Tirage au sort de l'équipe qui ouvre, comme au but en pétanque.
      const opener = drawOpener()
      setFletOpener(opener)
      setFletJournal([])
      setAssignments(null)
      const first = players.find((p) => p.id === lineup[teamPlayers(opener)[0]])
      announce({
        lead: `Flétanque ! Premier à ${TARGET_SCORE} points. ${teamSpeech(opener)} ouvre la mène.`,
        signature: signatureOf(first),
        relay: relayText(first, true),
      })
      return
    }

    setFletOpener(null)
    setFletJournal([])
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
    const commentaire = volleyComment(volleyTotal, punchlines)
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
    const commentaire = volleyComment(volleyTotal, punchlines)
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

  /** Clôt la mène : `points` fléchettes devant pour `holder`, ou null/0 pour une mène nulle. */
  function closeMene(holder: Side | null, points: number) {
    if (fletReplay === null || fletOpener === null || fletReplay.finished) return
    const next: FletanqueEvent[] = [...fletJournal, { kind: 'mene', holder, points }]
    const after = replayFletanque(fletOpener, next)
    setFletJournal(next)
    setMenePick(null)
    vibrate([40, 60, 40])
    if (after.finished) return // le sacre est annoncé par la célébration
    announce({
      lead:
        holder !== null && points > 0
          ? `${teamSpeech(holder)} marque ${points} point${points > 1 ? 's' : ''} ! ${
              after.scores[0]
            } à ${after.scores[1]}. ${teamSpeech(after.opener)} ouvre la mène suivante.`
          : `Mène nulle, personne ne marque. ${teamSpeech(after.opener)} rouvre la mène.`,
    })
  }

  /** Une fléchette dans un jeu au tour par tour : le moteur dit ce qu'elle a changé. */
  function throwTurnDart(dart: Dart) {
    if (turnGame === null || turnSetup === null || turnReplay === null || turnReplay.finished) return
    thock(dart.sector === 0 ? 'miss' : dart.sector === 25 && dart.mult === 2 ? 'bull' : 'normal')
    vibrate(12)
    const next = [...turnJournal, dart]
    const after = TURN_GAMES[turnGame].replay(order.length, turnSetup, next)
    setTurnJournal(next)
    if (after.finished) return // le sacre est annoncé par la célébration
    const thrower = turnReplay.current ?? 0
    const nameAt = (i: number) => stageName(players.find((p) => p.id === order[i]))
    const lead = after.lastNote
      ? after.lastNote.text
          .replace('{lanceur}', nameAt(thrower))
          .replace('{cible}', after.lastNote.target !== undefined ? nameAt(after.lastNote.target) : '')
      : ''
    if (!after.volleyClosed || after.current === null || order.length < 2) {
      if (lead) announce({ lead })
      return
    }
    const nextPlayer = players.find((p) => p.id === order[after.current!])
    const firstTurn = after.dartsByPlayer[after.current].length === 0
    const relay = relayText(nextPlayer, firstTurn)
    // Shanghai : chaque nouvelle manche annonce son numéro tiré au sort.
    if (turnGame === 'shanghai' && after.round > turnReplay.round) {
      const target = (after.state as ShanghaiState).targets[after.round]
      const manche = `Manche ${after.round + 1} : on vise le ${target} !`
      announce({ lead: lead ? `${lead} ${manche}` : manche, signature: firstTurn ? signatureOf(nextPlayer) : null, relay })
      return
    }
    announce({ lead, signature: firstTurn ? signatureOf(nextPlayer) : null, relay })
  }

  function throwDart(dart: Dart) {
    if (turnActive) {
      throwTurnDart(dart)
      return
    }
    if (powersActive) {
      throwPowersDart(dart)
      return
    }
    if (finished) return
    thock(dart.sector === 0 ? 'miss' : dart.sector === 25 && dart.mult === 2 ? 'bull' : 'normal')
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
    if (turnActive) {
      if (turnJournal.length === 0) return
      setTurnJournal(turnJournal.slice(0, -1))
      return
    }
    // En flétanque comme avec les pouvoirs, le journal fait foi : retirer le
    // dernier décompte rend le score et l'équipe qui ouvre d'avant.
    if (fletanqueActive) {
      if (menePick !== null) {
        setMenePick(null)
        return
      }
      if (fletJournal.length === 0) return
      setFletJournal(fletJournal.slice(0, -1))
      setMenePick(null)
      return
    }
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
    setSaveError(null)
    setAssignments(null)
    setJournal([])
    setPowerDialog(null)
    setFletOpener(null)
    setFletJournal([])
    setMenePick(null)
    setTurnSetup(null)
    setTurnJournal([])
    setTournamentMatch(null)
  }

  /**
   * Abandon avec garde-fou : rien à perdre tant que rien n'est saisi ; une
   * partie terminée mais pas enregistrée mérite un avertissement appuyé.
   */
  async function abandon() {
    const anything =
      thrownCount > 0 || journal.length > 0 || fletJournal.length > 0 || turnJournal.length > 0
    if (anything) {
      const answer = await ask(
        finished
          ? {
              title: 'Abandonner sans enregistrer ?',
              body: 'La partie est terminée mais pas encore enregistrée : ses scores seront perdus.',
              confirmLabel: 'Abandonner la partie',
              cancelLabel: 'Revenir',
              danger: true,
            }
          : {
              title: 'Abandonner la partie en cours ?',
              body: 'Les fléchettes déjà saisies seront perdues.',
              confirmLabel: 'Abandonner la partie',
              cancelLabel: 'Continuer à jouer',
              danger: true,
            },
      )
      if (!answer) return
    }
    reset()
  }

  async function save() {
    // Verrou anti double-clic : une partie ne s'enregistre qu'une fois.
    if (saving || savedRef.current) return
    setSaving(true)
    const powersRows =
      powersActive && powersReplay !== null && assignments !== null
        ? sessionPowers(powersReplay, assignments)
        : null
    // En flétanque, aucune fléchette n'est notée : la ligne porte le score de
    // l'équipe du joueur et le déroulé des mènes.
    const fletRows = fletanqueActive && fletReplay !== null ? sessionFletanque(fletReplay) : null
    const turnEntry = turnActive && turnReplay !== null && turnGame !== null ? TURN_GAMES[turnGame] : null
    const entries = order.map((playerId, i) =>
      turnEntry !== null && turnReplay !== null
        ? {
            playerId,
            darts: padVolley(turnReplay.dartsByPlayer[i]),
            total: turnEntry.total(turnReplay.state, i),
            won: turnReplay.winners.includes(i),
          }
        : fletRows !== null && fletReplay !== null
        ? {
            playerId,
            darts: [],
            total: fletReplay.scores[teamOf(i)],
            won: fletReplay.winner === teamOf(i),
            fletanque: fletRows[i],
          }
        : powersRows !== null && powersReplay !== null
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
    const err = await saveSessions(
      entries,
      matchId,
      gameMode,
      tournamentMatch ? { id: tournamentMatch.id, slot: tournamentMatch.slot } : null,
    )
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
      // Une rencontre de tournoi ramène au tournoi ; hors classement (301,
      // flétanque, pouvoirs…), direction l'historique plutôt que le tableau.
      const backToTournament = tournamentMatch !== null
      setTournamentMatch(null)
      router.push(
        backToTournament
          ? '/tournois'
          : gameMode !== 'volees' || powersRows !== null
            ? '/historique'
            : '/',
      )
    }
  }

  const flashOverlay = flash !== null && (
    <div className="flash180" role="status">
      <span className="flash180__score">{flash.title}</span>
      <span className="flash180__name">{flash.name}</span>
    </div>
  )

  // Rencontre de tournoi : joueurs et jeu sont imposés, on ne fait que lancer.
  if (!started && tournamentMatch !== null) {
    const [first, second] = order.map((id) => players.find((p) => p.id === id))
    return (
      <div className="stack">
        <section className="fixture">
          <p className="fixture__stage">
            Tournoi · {tournamentMatch.label} · {gameLabel(gameMode)}
          </p>
          <p className="fixture__players">
            <span>{first?.name ?? '?'}</span>
            <span className="fixture__vs">contre</span>
            <span>{second?.name ?? '?'}</span>
          </p>
          <p className="fixture__hint">
            Le résultat s’inscrira au tournoi dès l’enregistrement de la partie.
          </p>
        </section>
        <button type="button" className="button-primary" onClick={start} disabled={!first || !second}>
          Lancer la rencontre
        </button>
        <Link
          href="/tournois"
          className="button-ghost fixture__back"
          onClick={() => {
            setTournamentMatch(null)
            setOrder([])
          }}
        >
          Retour au tournoi
        </Link>
      </div>
    )
  }

  if (!started) {
    // Le bouton dit ce qui manque plutôt que de rester grisé sans explication.
    const needed =
      gameMode === 'fletanque'
        ? PLAYERS_PER_MATCH
        : turnGame !== null
          ? TURN_GAMES[turnGame].minPlayers
          : 1
    const missing = needed - order.length
    const startLabel =
      order.length === 0
        ? 'Choisissez qui tire'
        : missing > 0
          ? `Encore ${missing} joueur${missing > 1 ? 's' : ''} à choisir`
          : gameMode === 'fletanque'
            ? 'Lancer la flétanque'
            : turnGame !== null
              ? `Lancer le ${TURN_GAMES[turnGame].label}`
              : 'Commencer la partie'

    return (
      <div className="stack">
        <section>
          <h2 className="section-title">
            <span className="step">1</span> Le jeu
          </h2>
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
            <button
              type="button"
              role="radio"
              aria-checked={gameMode === 'fletanque'}
              className={gameMode === 'fletanque' ? 'chip chip--on' : 'chip'}
              onClick={() => {
                setGameMode('fletanque')
                setOrder((current) => current.slice(0, PLAYERS_PER_MATCH))
              }}
            >
              🍹 Flétanque
            </button>
            {TURN_GAME_IDS.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={gameMode === id}
                className={gameMode === id ? 'chip chip--on' : 'chip'}
                onClick={() => setGameMode(id)}
              >
                {TURN_GAMES[id].label}
              </button>
            ))}
          </div>
          {turnGame !== null && (
            <p className="mode-hint">
              {TURN_GAMES[turnGame].pitch}
              {TURN_GAMES[turnGame].minPlayers > 1 &&
                ` À ${TURN_GAMES[turnGame].minPlayers} joueurs minimum.`}{' '}
              Hors classement, mais compte dans les face-à-face.
            </p>
          )}
          {gameMode === '301' && (
            <p className="mode-hint">
              Premier à zéro exactement — dépasser annule la volée. Sortie sèche, sans double
              obligatoire. Ne compte pas au classement, mais nourrit les face-à-face.
            </p>
          )}
          {gameMode === 'fletanque' && (
            <p className="mode-hint">
              La pétanque aux fléchettes : deux contre deux, trois fléchettes chacun, et le
              cochonnet c’est le centre de la cible. L’équipe qui n’a pas le point relance
              jusqu’à le reprendre ; à la fin de la mène, elle marque autant de points qu’elle
              a de fléchettes devant la meilleure adverse. Premier à {TARGET_SCORE}. Hors
              classement.
            </p>
          )}
          {gameMode === 'volees' && (
            <button
              type="button"
              role="switch"
              aria-checked={powersEnabled}
              className="option-switch"
              onClick={() => setPowersEnabled((on) => !on)}
            >
              <span className="option-switch__text">
                <span className="option-switch__title">🃏 Variante avec pouvoirs</span>
                <span className="option-switch__hint">
                  {powersEnabled
                    ? 'Chaque joueur reçoit au hasard un pouvoir secret, utilisable une seule fois. Partie hors classement.'
                    : 'Un pouvoir secret par joueur. Partie hors classement.'}
                </span>
              </span>
              <span className="option-switch__track" aria-hidden="true">
                <span className="option-switch__thumb" />
              </span>
            </button>
          )}
        </section>
        <section>
          <h2 className="section-title">
            <span className="step">2</span> {gameMode === 'fletanque' ? 'Les quatre joueurs' : 'Qui tire ?'}
          </h2>
          <p className="mode-hint mode-hint--lead">
            {gameMode === 'fletanque'
              ? 'Les équipes sont tirées au sort au lancement.'
              : 'Touchez les joueurs dans l’ordre de passage.'}
          </p>
          <div className="chips">
            {players.map((p) => {
              const position = order.indexOf(p.id)
              const badge =
                position === -1
                  ? ''
                  : gameMode === 'fletanque'
                    ? '✓ '
                    : `${position + 1}. `
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={position !== -1}
                  className={position !== -1 ? 'chip chip--on' : 'chip'}
                  onClick={() => toggleOrder(p.id)}
                >
                  {badge}
                  {p.name}
                </button>
              )
            })}
          </div>
        </section>
        <button
          type="button"
          className="button-primary"
          disabled={missing > 0}
          onClick={start}
        >
          {startLabel}
        </button>
      </div>
    )
  }

  if (finished) {
    // En flétanque, le récapitulatif compte les équipes, pas les joueurs.
    const fletRecap: RecapLine[] | null =
      fletanqueActive && fletReplay !== null
        ? ([0, 1] as Side[]).map((side) => ({
            playerId: `equipe-${side}`,
            name: `${SIDE_LABEL[side]} — ${teamRoster(side)}`,
            total: fletReplay.scores[side],
            won: fletReplay.winner === side,
            record: false,
            sub: null,
          }))
        : null
    const turnRecap: RecapLine[] | null =
      turnActive && turnReplay !== null && turnGame !== null
        ? order.map((playerId, i) => {
            const total = TURN_GAMES[turnGame].total(turnReplay.state, i)
            return {
              playerId,
              name: players.find((p) => p.id === playerId)?.name ?? '?',
              total,
              won: turnReplay.winners.includes(i),
              record: false,
              sub: TURN_GAMES[turnGame].totalLabel(total),
            }
          })
        : null
    const recap: RecapLine[] = (
      turnRecap ??
      fletRecap ??
      order.map((playerId, i) => {
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
    ).sort((a, b) => Number(b.won) - Number(a.won) || b.total - a.total)

    return (
      <div className="stack">
        <section>
          <h2 className="section-title">
            {turnGame !== null
              ? `Fin de partie — ${TURN_GAMES[turnGame].label}`
              : gameMode === 'fletanque'
              ? 'Fin de partie — Flétanque'
              : gameMode === '301'
                ? 'Fin de partie — 301'
                : powersActive
                  ? 'Fin de partie — Pouvoirs'
                  : 'Fin de partie'}
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
                <RollingNumber className="recap__total" value={line.total} from={0} />
              </div>
            ))}
          </div>
        </section>
        {fletanqueActive && fletReplay !== null && (
          <section>
            <h2 className="section-title">Les mènes</h2>
            <div className="match-detail__volleys">
              {fletReplay.menes.map((mene, i) => (
                <div key={i} className="volley-line">
                  <span className="volley-line__label">Mène {i + 1}</span>
                  <span className="volley-line__darts">
                    {mene.holder === null
                      ? 'nulle — rejouée'
                      : `${SIDE_LABEL[mene.holder]} · ${teamRoster(mene.holder)}`}
                  </span>
                  <span className="volley-line__total">{mene.points}</span>
                </div>
              ))}
            </div>
          </section>
        )}
        {saveError && (
          <p className="notice notice--error" role="alert">
            L’enregistrement a échoué : {saveError}
          </p>
        )}
        <button type="button" className="button-primary" disabled={saving} onClick={() => void save()}>
          {saving ? 'Enregistrement…' : 'Enregistrer les scores'}
        </button>
        <button type="button" className="button-ghost" onClick={() => void abandon()}>
          Abandonner la partie
        </button>
        {flashOverlay}
      </div>
    )
  }

  // Flétanque : pas de clavier de saisie — les quatre joueurs tirent toute
  // leur main, puis désignent l'équipe qui prend la mène et ses points.
  if (turnActive && turnReplay !== null && turnGame !== null) {
    return (
      <>
        <TurnGameScorer
          game={turnGame}
          replay={turnReplay}
          names={order.map((id) => players.find((p) => p.id === id)?.name ?? '?')}
          onThrow={throwDart}
          onUndo={undo}
          undoDisabled={turnJournal.length === 0}
          onAbandon={() => void abandon()}
        />
        {flashOverlay}
      </>
    )
  }

  if (fletanqueActive && fletReplay !== null) {
    const replay = fletReplay

    return (
      <div className="scorer">
        <div className="scorer__status">
          <div>
            <p className="scorer__volley">Flétanque · Mène {replay.menes.length + 1}</p>
            <p className="scorer__thrower" key={replay.opener}>
              {SIDE_LABEL[replay.opener]} ouvre
            </p>
          </div>
          <div className="scorer__actions">
            <SoundToggle />
            <button type="button" className="button-ghost" onClick={() => void abandon()}>
              Abandonner
            </button>
          </div>
        </div>

        <div className="flet-teams">
          {([0, 1] as Side[]).map((side) => (
            <section
              key={side}
              className={menePick === side ? 'flet-team flet-team--point' : 'flet-team'}
            >
              <div className="flet-team__head">
                <span className="flet-team__label">
                  {SIDE_LABEL[side]}
                  {replay.opener === side && <em className="flet-team__point"> · ouvre</em>}
                </span>
                <RollingNumber className="flet-team__score" value={replay.scores[side]} />
              </div>
              <p className="flet-team__roster">{teamRoster(side)}</p>
            </section>
          ))}
        </div>

        <section className="flet-call">
          {menePick === null ? (
            <>
              <p className="flet-call__title">Qui prend la mène ?</p>
              <p className="flet-call__hint">
                Une fois les douze fléchettes tirées, l’équipe la plus proche du centre prend la
                mène.
              </p>
              <div className="flet-outcomes">
                {([0, 1] as Side[]).map((side) => (
                  <button
                    key={side}
                    type="button"
                    className={`flet-outcome flet-outcome--${side === 0 ? 'a' : 'b'}`}
                    onClick={() => setMenePick(side)}
                  >
                    {SIDE_LABEL[side]}
                  </button>
                ))}
                <button
                  type="button"
                  className="flet-outcome flet-outcome--tie"
                  onClick={() => closeMene(null, 0)}
                >
                  Mène nulle
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="flet-call__title">{SIDE_LABEL[menePick]} prend la mène</p>
              <p className="flet-call__hint">
                Combien de ses fléchettes sont plus proches que la meilleure de{' '}
                {SIDE_LABEL[otherSide(menePick)]} ?
              </p>
              <div className="flet-points">
                {POINTS_OPTIONS.map((points) => (
                  <button
                    key={points}
                    type="button"
                    className="key key--sector"
                    onClick={() => closeMene(menePick, points)}
                  >
                    {points}
                  </button>
                ))}
              </div>
            </>
          )}
          <button
            type="button"
            className="button-ghost"
            onClick={undo}
            disabled={menePick === null && fletJournal.length === 0}
          >
            {menePick === null ? 'Annuler la dernière mène' : 'Retour'}
          </button>
        </section>
      </div>
    )
  }

  const activeTurn = powersActive ? (powersReplay?.activeTurn ?? null) : null
  // La volée qui vient de s'achever reste lisible quand la main passe.
  const previousVolley: { player: number; darts: Dart[] } | null = (() => {
    if (powersActive && powersReplay !== null) {
      const done = powersReplay.turns.filter(
        (t) => t !== activeTurn && t.darts.length >= t.size && t.darts.every((d) => d !== null),
      )
      const last = done[done.length - 1]
      return last ? { player: last.player, darts: last.darts as Dart[] } : null
    }
    if (globalVolley === 0) return null
    const index = globalVolley - 1
    const player = index % order.length
    const round = Math.floor(index / order.length)
    const darts = (dartsByPlayer[player] ?? []).slice(round * DARTS_PER_VOLLEY, (round + 1) * DARTS_PER_VOLLEY)
    return darts.length > 0 ? { player, darts } : null
  })()
  const slotCount = activeTurn ? activeTurn.size : DARTS_PER_VOLLEY
  const pendingSlot = powersActive ? (powersReplay?.pendingSlot ?? null) : null

  return (
    <div className="scorer">
      <div className="scorer__status">
        <div>
          <p className="scorer__volley">
            {gameMode === '301'
              ? `301 · volée ${currentRound + 1}`
              : powersActive
                ? `🃏 Volée ${currentRound + 1} sur ${VOLLEYS_PER_SESSION}`
                : `Volée ${currentRound + 1} sur ${VOLLEYS_PER_SESSION}`}
          </p>
          <p className="scorer__thrower" key={currentPlayer?.id}>
            {currentPlayer?.name}
            {pendingSlot !== null && <em> relance !</em>}
          </p>
        </div>
        <div className="scorer__actions">
          <SoundToggle />
          <button type="button" className="button-ghost" onClick={() => void abandon()}>
            Abandonner
          </button>
        </div>
      </div>

      <div className="scorer__slots">
        {Array.from({ length: slotCount }, (_, i) => {
          const dart = activeTurn ? activeTurn.darts[i] : currentVolley[i]
          return (
            <div key={i} className={dart ? 'slot slot--filled' : 'slot'}>
              <span className="slot__index">{i + 1}</span>
              {dart ? (
                <>
                  <span className="slot__label">{dartLabel(dart)}</span>
                  <span className="slot__value">{dartValue(dart)}</span>
                </>
              ) : (
                <span className="slot__empty">{i === pendingSlot ? 'Relance' : ''}</span>
              )}
            </div>
          )
        })}
      </div>

      {previousVolley && order.length > 1 && (
        <LastVolley
          name={players.find((p) => p.id === order[previousVolley.player])?.name ?? '?'}
          darts={previousVolley.darts}
        />
      )}

      <ol className="scoreboard" aria-label={gameMode === '301' ? 'Points restants' : 'Scores'}>
        {order.map((playerId, i) => {
          const player = players.find((p) => p.id === playerId)
          return (
            <li
              key={playerId}
              className={i === currentPlayerIndex ? 'scoreboard__row scoreboard__row--active' : 'scoreboard__row'}
              aria-current={i === currentPlayerIndex ? 'step' : undefined}
            >
              <span className="scoreboard__name">{player?.name}</span>
              <RollingNumber
                className="scoreboard__score"
                value={
                  powersActive && powersReplay !== null
                    ? powersReplay.totals[i]
                    : gameMode === '301'
                      ? (replays[i]?.remaining ?? START_301)
                      : sessionTotal(dartsByPlayer[i])
                }
              />
            </li>
          )
        })}
      </ol>

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

      <DartInput
        volley={activeTurn ? activeTurn.darts : Array.from({ length: slotCount }, (_, i) => currentVolley[i] ?? null)}
        onThrow={throwDart}
        onUndo={undo}
        undoDisabled={
          powersActive
            ? journal.length === 0
            : gameMode === '301'
              ? currentVolley.length === 0
              : thrownCount === 0
        }
      />
      {flashOverlay}
    </div>
  )
}
