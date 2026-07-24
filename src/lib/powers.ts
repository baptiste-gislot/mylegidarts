// Système de pouvoirs : un pouvoir par joueur, tiré au sort au lancement,
// utilisable une seule fois. Mode « défi 4 volées » uniquement, hors classement.
//
// Le moteur suit le modèle de replay301 : une seule source de vérité, le
// journal d'événements (fléchettes ET activations, dans l'ordre), rejouée
// pour dériver tout l'état. L'annulation retire le dernier événement et tous
// les cas particuliers (trou de relance restauré, pouvoir redisponible)
// retombent juste automatiquement.

import {
  DARTS_PER_VOLLEY,
  VOLLEYS_PER_SESSION,
  dartValue,
  type Dart,
} from './scoring'

export type PowerId =
  | 'controle'
  | 'reecriture'
  | 'reclamation'
  | 'bug'
  | 'tournee'
  | 'copie'
  | 'rab'
  | 'simulation'
  | 'classe'
  | 'aspiration'
  | 'motion'
  | 'tentacules'
  | 'defile'

/** Paramètre à demander au moment de l'activation. */
export type PowerParam = 'rien' | 'cible' | 'secteur' | 'vote' | 'pouvoir'

export interface PowerDef {
  id: PowerId
  persona: string
  emoji: string
  title: string
  description: string
  param: PowerParam
}

export const POWERS: PowerDef[] = [
  {
    id: 'controle',
    persona: 'César « dit 16 » — Le gendre idéal',
    emoji: '👔',
    title: 'Tout est sous contrôle',
    description: 'Relance immédiatement une fléchette ratée.',
    param: 'rien',
  },
  {
    id: 'reecriture',
    persona: 'Adrien — Chauve et écrivain amateur',
    emoji: '✍️',
    title: 'Réécriture',
    description: 'Après ses 3 fléchettes, annule sa pire fléchette et la rejoue.',
    param: 'rien',
  },
  {
    id: 'reclamation',
    persona: 'Baptiste — Râle tout le temps, Portugais',
    emoji: '🇵🇹',
    title: 'Réclamation à l’arbitre',
    description: 'Oblige un adversaire à relancer sa meilleure fléchette du tour.',
    param: 'cible',
  },
  {
    id: 'bug',
    persona: 'Claire — Testeuse QA, fan de dinos',
    emoji: '🦖',
    title: 'Bug détecté',
    description: 'Annule la fléchette adverse qui vient d’être lancée (0 point).',
    param: 'rien',
  },
  {
    id: 'tournee',
    persona: 'Greg « Le Puissant » — Breton alcoolique',
    emoji: '🍺',
    title: 'Dernière tournée',
    description: 'Lance une 4ᵉ fléchette sur sa volée en cours.',
    param: 'rien',
  },
  {
    id: 'copie',
    persona: 'Martin — Mauvais perdant, râleur',
    emoji: '😤',
    title: 'C’est pas juste !',
    description: 'Copie le pouvoir d’un joueur qui l’a déjà utilisé.',
    param: 'pouvoir',
  },
  {
    id: 'rab',
    persona: 'Mélissa — Part pour 5 km, finit à 21 km',
    emoji: '🏃‍♀️',
    title: 'J’en fais toujours trop',
    description: 'Rejoue une volée complète si la sienne a marqué moins de 30 points.',
    param: 'rien',
  },
  {
    id: 'simulation',
    persona: 'Neymarpri — Toujours blessé, sportif américain',
    emoji: '🩹',
    title: 'Simulation',
    description: 'Crie « FAUTE ! » : sa fléchette ratée compte comme le simple visé.',
    param: 'secteur',
  },
  {
    id: 'classe',
    persona: 'Olivier — Toujours premier au baby, coiffure impeccable',
    emoji: '💇',
    title: 'Classe naturelle',
    description: 'Annonce un chiffre avant sa volée : chaque touche vaut +10 points.',
    param: 'secteur',
  },
  {
    id: 'aspiration',
    persona: 'RDD — Cycliste, adore sucer les roues',
    emoji: '🚴',
    title: 'Aspiration',
    description: 'Copie le score de la volée précédente si elle est meilleure que la sienne.',
    param: 'rien',
  },
  {
    id: 'motion',
    persona: 'Aloïs — Pose toujours des questions, syndicaliste',
    emoji: '🤔',
    title: 'Motion déposée',
    description: 'Vote : au tour suivant, les triples valent seulement double (ou rien ne change).',
    param: 'vote',
  },
  {
    id: 'tentacules',
    persona: 'Le W — Fan de tentacules, grognon',
    emoji: '🐙',
    title: 'Tentacules',
    description: 'Un adversaire lance ses deux prochaines fléchettes de la mauvaise main.',
    param: 'cible',
  },
  {
    id: 'defile',
    persona: 'Léa — Fashion victime',
    emoji: '👠',
    title: 'Défilé',
    description: 'Un joueur pose en mannequin : +15 points pour Léa par fléchette totalement ratée.',
    param: 'cible',
  },
]

export const POWER_BY_ID: Record<PowerId, PowerDef> = Object.fromEntries(
  POWERS.map((p) => [p.id, p]),
) as Record<PowerId, PowerDef>

export interface PowerEvent {
  kind: 'power'
  power: PowerId
  /** Index (dans order) du joueur qui active — via Martin, pas forcément le détenteur d'origine. */
  actor: number
  target?: number
  sector?: number
  outcome?: 'normal' | 'triples-double'
  copied?: PowerId
}

export type MatchEvent = { kind: 'dart'; dart: Dart } | PowerEvent

/** Une volée du planning : le joueur, sa taille (4 avec Greg) et sa manche. */
export interface PowerTurn {
  player: number
  size: number
  round: number
  darts: (Dart | null)[]
  /** Annonce d'Olivier sur cette volée : +10 par touche du secteur. */
  classe?: { sector: number }
  /** Volée sous « Défilé » : chaque raté total crédite +15 au détenteur. */
  defile?: { holder: number }
}

export interface PowersReplay {
  /** Planning complet, dans l'ordre de jeu — la vue de référence pour l'UI. */
  turns: PowerTurn[]
  /** Fléchettes effectives par joueur (trous exclus), pour le live et la sauvegarde. */
  dartsByPlayer: Dart[][]
  /** Tailles de volées par joueur (3 ou 4), pour regrouper à l'affichage. */
  volleySizes: number[][]
  /** Totaux effectifs de chaque volée (règle Aloïs incluse, bonus exclus). */
  effectiveVolleyTotals: number[][]
  /** Bonus par joueur (classe, défilé, aspiration). */
  bonuses: number[]
  /** Total final par joueur : somme effective + bonus. */
  totals: number[]
  /** Volée en cours, ou null si relance en attente / partie finie. */
  current: { player: number; round: number } | null
  /** Fléchette retirée à relancer : la prochaine saisie la remplace. */
  pendingHole: { player: number; round: number } | null
  /** La volée à afficher au tableau : celle du trou à combler, sinon la courante. */
  activeTurn: PowerTurn | null
  /** Emplacement de la relance dans activeTurn, s'il y en a une. */
  pendingSlot: number | null
  /** Pouvoir actuellement détenu et non utilisé, par joueur. */
  holders: (PowerId | null)[]
  usedPowers: { power: PowerId; actor: number }[]
  finished: boolean
}

function fillCount(turn: PowerTurn): number {
  let n = 0
  for (const d of turn.darts) if (d !== null) n++
  return n
}

function isFull(turn: PowerTurn): boolean {
  return fillCount(turn) >= turn.size && turn.darts.every((d) => d !== null)
}

interface ReplayInternals {
  turns: PowerTurn[]
  currentTurn: number
  hole: { turn: PowerTurn; slot: number } | null
  lastDart: { turn: PowerTurn; slot: number } | null
  holders: (PowerId | null)[]
  usedPowers: { power: PowerId; actor: number }[]
  fixedBonuses: number[]
  triplesDoubleRounds: Set<number>
}

function effectiveDartValue(dart: Dart, round: number, triplesDouble: Set<number>): number {
  if (triplesDouble.has(round) && dart.mult === 3) return dart.sector * 2
  return dartValue(dart)
}

function turnTotal(turn: PowerTurn, triplesDouble: Set<number>): number {
  return turn.darts.reduce(
    (sum, d) => sum + (d ? effectiveDartValue(d, turn.round, triplesDouble) : 0),
    0,
  )
}

/** La dernière volée entièrement jouée, tous joueurs confondus. */
function lastCompletedTurn(state: ReplayInternals): PowerTurn | null {
  const fromDart = state.lastDart?.turn
  if (fromDart && isFull(fromDart)) return fromDart
  return null
}

function replayInternals(
  playerCount: number,
  assignments: PowerId[],
  journal: MatchEvent[],
): ReplayInternals {
  const turns: PowerTurn[] = []
  for (let round = 0; round < VOLLEYS_PER_SESSION; round++) {
    for (let player = 0; player < playerCount; player++) {
      turns.push({ player, size: DARTS_PER_VOLLEY, round, darts: [] })
    }
  }

  const state: ReplayInternals = {
    turns,
    currentTurn: 0,
    hole: null,
    lastDart: null,
    holders: assignments.slice(0, playerCount),
    usedPowers: [],
    fixedBonuses: new Array<number>(playerCount).fill(0),
    triplesDoubleRounds: new Set<number>(),
  }

  const advance = () => {
    while (state.currentTurn < turns.length && isFull(turns[state.currentTurn])) {
      state.currentTurn++
    }
  }

  for (const event of journal) {
    if (event.kind === 'dart') {
      if (state.hole) {
        state.hole.turn.darts[state.hole.slot] = event.dart
        state.lastDart = { turn: state.hole.turn, slot: state.hole.slot }
        state.hole = null
      } else if (state.currentTurn < turns.length) {
        const turn = turns[state.currentTurn]
        turn.darts.push(event.dart)
        state.lastDart = { turn, slot: turn.darts.length - 1 }
      } else {
        continue // partie finie : fléchette ignorée
      }
      advance()
      continue
    }

    // Activation d'un pouvoir. La validation a eu lieu via canActivate ;
    // le rejeu applique en confiance (journal = source de vérité).
    state.usedPowers.push({ power: event.power, actor: event.actor })
    state.holders[event.actor] =
      event.power === 'copie' && event.copied ? event.copied : null

    switch (event.power) {
      case 'controle':
      case 'simulation': {
        const last = state.lastDart
        if (!last) break
        if (event.power === 'controle') {
          last.turn.darts[last.slot] = null
          state.hole = { turn: last.turn, slot: last.slot }
        } else {
          last.turn.darts[last.slot] = { sector: event.sector ?? 0, mult: 1 }
        }
        break
      }
      case 'reecriture':
      case 'reclamation': {
        const turn = lastCompletedTurn(state)
        if (!turn) break
        let slot = 0
        for (let i = 1; i < turn.darts.length; i++) {
          const dart = turn.darts[i]
          const best = turn.darts[slot]
          if (dart === null || best === null) continue
          const value = dartValue(dart)
          if (event.power === 'reecriture' ? value < dartValue(best) : value > dartValue(best)) {
            slot = i
          }
        }
        turn.darts[slot] = null
        state.hole = { turn, slot }
        break
      }
      case 'bug': {
        const last = state.lastDart
        if (last) last.turn.darts[last.slot] = { sector: 0, mult: 1 }
        break
      }
      case 'tournee': {
        const turn = turns[state.currentTurn]
        if (turn && turn.player === event.actor) turn.size = DARTS_PER_VOLLEY + 1
        break
      }
      case 'rab': {
        const previous = lastCompletedTurn(state)
        turns.splice(state.currentTurn, 0, {
          player: event.actor,
          size: DARTS_PER_VOLLEY,
          round: previous?.round ?? 0,
          darts: [],
        })
        break
      }
      case 'classe': {
        const turn = turns[state.currentTurn]
        if (turn && turn.player === event.actor && event.sector !== undefined) {
          turn.classe = { sector: event.sector }
        }
        break
      }
      case 'aspiration': {
        const own = lastCompletedTurn(state)
        if (!own) break
        const index = turns.indexOf(own)
        const previous = index > 0 ? turns[index - 1] : null
        if (!previous) break
        const diff =
          turnTotal(previous, state.triplesDoubleRounds) -
          turnTotal(own, state.triplesDoubleRounds)
        if (diff > 0) state.fixedBonuses[event.actor] += diff
        break
      }
      case 'motion': {
        if (event.outcome !== 'triples-double') break
        const round = turns[Math.min(state.currentTurn, turns.length - 1)].round
        state.triplesDoubleRounds.add(round + 1)
        break
      }
      case 'defile': {
        if (event.target === undefined) break
        for (let i = state.currentTurn; i < turns.length; i++) {
          const turn = turns[i]
          if (turn.player === event.target && turn.darts.length === 0) {
            turn.defile = { holder: event.actor }
            break
          }
        }
        break
      }
      case 'tentacules':
      case 'copie':
        break // cérémonie / méta : aucun effet sur les scores
    }
    advance()
  }

  return state
}

export function replayPowers(
  playerCount: number,
  assignments: PowerId[],
  journal: MatchEvent[],
): PowersReplay {
  const state = replayInternals(playerCount, assignments, journal)
  const { turns, triplesDoubleRounds } = state

  const dartsByPlayer: Dart[][] = Array.from({ length: playerCount }, () => [])
  const volleySizes: number[][] = Array.from({ length: playerCount }, () => [])
  const effectiveVolleyTotals: number[][] = Array.from({ length: playerCount }, () => [])
  const bonuses = state.fixedBonuses.slice()

  for (const turn of turns) {
    volleySizes[turn.player].push(turn.size)
    effectiveVolleyTotals[turn.player].push(turnTotal(turn, triplesDoubleRounds))
    for (const dart of turn.darts) {
      if (dart === null) continue
      dartsByPlayer[turn.player].push(dart)
      if (turn.classe && dart.sector === turn.classe.sector) bonuses[turn.player] += 10
      if (turn.defile && dart.sector === 0) bonuses[turn.defile.holder] += 15
    }
  }

  const totals = Array.from({ length: playerCount }, (_, p) =>
    effectiveVolleyTotals[p].reduce((sum, t) => sum + t, 0) + bonuses[p],
  )

  const finished = state.currentTurn >= turns.length && state.hole === null
  const currentTurn = turns[state.currentTurn]

  return {
    turns,
    dartsByPlayer,
    volleySizes,
    effectiveVolleyTotals,
    bonuses,
    totals,
    current:
      state.hole === null && currentTurn
        ? { player: currentTurn.player, round: currentTurn.round }
        : null,
    pendingHole: state.hole
      ? { player: state.hole.turn.player, round: state.hole.turn.round }
      : null,
    activeTurn: state.hole ? state.hole.turn : (currentTurn ?? null),
    pendingSlot: state.hole?.slot ?? null,
    holders: state.holders,
    usedPowers: state.usedPowers,
    finished,
  }
}

/**
 * L'activation est-elle valide maintenant ? `target`/`sector`/`outcome`/`copied`
 * absents = « existe-t-il au moins un choix valide ? » (pour activer le bouton
 * avant d'ouvrir le mini-dialogue).
 */
export function canActivate(
  playerCount: number,
  assignments: PowerId[],
  journal: MatchEvent[],
  event: Omit<PowerEvent, 'kind'>,
): { ok: true } | { ok: false; reason: string } {
  const state = replayInternals(playerCount, assignments, journal)
  const { turns } = state
  const refuse = (reason: string) => ({ ok: false as const, reason })

  if (state.holders[event.actor] !== event.power) {
    return refuse('Ce joueur ne détient pas ce pouvoir (ou l’a déjà utilisé).')
  }
  if (state.hole !== null) return refuse('Une relance est en attente : jouez-la d’abord.')
  const finished = state.currentTurn >= turns.length
  if (finished) return refuse('La partie est terminée.')

  const last = state.lastDart
  const lastTurn = last?.turn ?? null
  const completed = lastCompletedTurn(state)
  const current = turns[state.currentTurn]

  switch (event.power) {
    case 'controle':
    case 'simulation': {
      if (!last || lastTurn!.player !== event.actor)
        return refuse('Valable juste après une de ses propres fléchettes.')
      if (lastTurn!.darts[last.slot]!.sector !== 0)
        return refuse('Valable seulement sur une fléchette ratée.')
      return { ok: true }
    }
    case 'reecriture': {
      if (!completed || completed.player !== event.actor)
        return refuse('Valable juste après sa propre volée complète.')
      return { ok: true }
    }
    case 'reclamation': {
      if (!completed || completed.player === event.actor)
        return refuse('Valable juste après la volée complète d’un adversaire.')
      if (event.target !== undefined && completed.player !== event.target)
        return refuse('Seule la dernière volée jouée peut être contestée.')
      if (completed.darts.every((d) => d !== null && dartValue(d) === 0))
        return refuse('Rien à relancer : la volée n’a rien marqué.')
      return { ok: true }
    }
    case 'bug': {
      if (!last || lastTurn!.player === event.actor)
        return refuse('Valable juste après une fléchette adverse.')
      return { ok: true }
    }
    case 'tournee': {
      if (!current || current.player !== event.actor)
        return refuse('Valable pendant sa propre volée, avant la 3ᵉ fléchette.')
      if (current.size > DARTS_PER_VOLLEY) return refuse('Déjà une fléchette de rab.')
      return { ok: true }
    }
    case 'rab': {
      if (!completed || completed.player !== event.actor)
        return refuse('Valable juste après sa propre volée complète.')
      if (turnTotal(completed, state.triplesDoubleRounds) >= 30)
        return refuse('Volée à 30 points ou plus : pas de rab.')
      return { ok: true }
    }
    case 'classe': {
      if (!current || current.player !== event.actor || current.darts.length > 0)
        return refuse('Valable avant de lancer sa volée.')
      return { ok: true }
    }
    case 'aspiration': {
      if (!completed || completed.player !== event.actor)
        return refuse('Valable juste après sa propre volée complète.')
      const index = turns.indexOf(completed)
      if (index === 0) return refuse('Personne n’a tiré avant : rien à aspirer.')
      const previous = turns[index - 1]
      const diff =
        turnTotal(previous, state.triplesDoubleRounds) -
        turnTotal(completed, state.triplesDoubleRounds)
      if (diff <= 0) return refuse('La volée précédente n’est pas meilleure.')
      return { ok: true }
    }
    case 'motion': {
      if (!current || current.round >= VOLLEYS_PER_SESSION - 1)
        return refuse('Plus de tour suivant à réglementer.')
      return { ok: true }
    }
    case 'tentacules':
    case 'defile': {
      const hasFutureTurn = (target: number) =>
        target !== event.actor &&
        turns.some((t, i) => i >= state.currentTurn && t.player === target && t.darts.length === 0)
      if (event.target !== undefined) {
        if (!hasFutureTurn(event.target)) return refuse('Ce joueur n’a plus de volée à venir.')
        return { ok: true }
      }
      for (let p = 0; p < playerCount; p++) if (hasFutureTurn(p)) return { ok: true }
      return refuse('Aucun adversaire n’a de volée à venir.')
    }
    case 'copie': {
      const copiable = state.usedPowers.filter((u) => u.power !== 'copie')
      if (event.copied !== undefined) {
        if (!copiable.some((u) => u.power === event.copied))
          return refuse('Ce pouvoir n’a pas encore été utilisé.')
        return { ok: true }
      }
      if (copiable.length === 0) return refuse('Aucun pouvoir déjà utilisé à copier.')
      return { ok: true }
    }
  }
}

/** Regroupe des fléchettes selon les tailles réelles de volées (3 ou 4). */
export function groupBySizes(darts: Dart[], sizes: number[]): Dart[][] {
  const groups: Dart[][] = []
  let cursor = 0
  for (const size of sizes) {
    groups.push(darts.slice(cursor, cursor + size))
    cursor += size
  }
  return groups
}

/** Tirage au sort des pouvoirs : distincts tant qu'il y a assez de pouvoirs. */
export function drawAssignments(playerCount: number): PowerId[] {
  const ids = POWERS.map((p) => p.id)
  const pool: PowerId[] = []
  while (pool.length < playerCount) {
    const batch = ids.slice()
    for (let i = batch.length - 1; i > 0; i--) {
      const random = new Uint32Array(1)
      crypto.getRandomValues(random)
      const j = random[0] % (i + 1)
      ;[batch[i], batch[j]] = [batch[j], batch[i]]
    }
    pool.push(...batch)
  }
  return pool.slice(0, playerCount)
}

/** Résumé persisté en base (jsonb `sessions.powers`, une ligne par joueur). */
export interface SessionPowers {
  power: PowerId
  used: boolean
  copied?: PowerId
  bonus: number
  volleySizes: number[]
}

export function sessionPowers(replay: PowersReplay, assignments: PowerId[]): SessionPowers[] {
  return assignments.map((power, index) => {
    // Pour Martin : le pouvoir réellement joué après sa copie.
    const copiedPower = replay.usedPowers.find(
      (u) => u.actor === index && u.power !== 'copie',
    )?.power
    return {
      power,
      used: replay.usedPowers.some((u) => u.actor === index),
      ...(power === 'copie' && copiedPower ? { copied: copiedPower } : {}),
      bonus: replay.bonuses[index],
      volleySizes: replay.volleySizes[index],
    }
  })
}
