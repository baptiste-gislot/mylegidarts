'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Side } from './fletanque'
import type { PlayerView } from './turnGames'
import { channelHealthy, onReconnectHints, useWatchdog } from './realtimeHealth'
import type { Dart } from './scoring'
import { supabase } from './supabaseClient'
import type { GameMode } from './useLeague'

/** Résumé pouvoirs calculé côté tireur : le spectateur l'affiche tel quel. */
export interface LiveMatchPowers {
  byPlayer: { emoji: string; title: string; used: boolean }[]
  totals: number[]
  current: number | null
  round: number
}

/** Résumé flétanque calculé côté tireur : le spectateur l'affiche tel quel. */
export interface LiveMatchFletanque {
  scores: [number, number]
  /** Numéro de la mène en cours (1-based). */
  mene: number
  /** Équipe qui ouvre la mène en cours. */
  opener: Side
}

/** Résumé d'un jeu au tour par tour, calculé côté tireur. */
export interface LiveMatchTurn {
  current: number | null
  round: number
  lines: PlayerView[]
}

/** État d'une partie en cours, diffusé via Supabase Realtime Presence. */
export interface LiveMatch {
  id: string
  startedAt: string
  /** Horodatage de la diffusion : sert à ne garder que l'état le plus récent. */
  updatedAt: string
  finished: boolean
  mode?: GameMode
  players: { id: string; name: string; nickname?: string | null }[]
  darts: Dart[][]
  /** Présent quand la partie se joue avec pouvoirs (rétrocompatible). */
  powers?: LiveMatchPowers
  /** Présent en flétanque : les fléchettes n'y sont pas notées. */
  fletanque?: LiveMatchFletanque
  /** Présent dans les jeux au tour par tour (Cricket, Killer…). */
  turn?: LiveMatchTurn
}

export type LiveMatchInput = Omit<LiveMatch, 'updatedAt'>

const CHANNEL = 'live-matches'

/**
 * Côté tireur : diffuse l'état de la partie après chaque fléchette.
 * La présence expire d'elle-même si l'appareil se déconnecte —
 * aucune donnée à nettoyer côté base.
 *
 * Fiabilité : chaque diffusion est acquittée (deux échecs → canal
 * reconstruit), un canal en erreur est reconstruit avec backoff, et le
 * dernier état est re-signalé au retour au premier plan puis, en dernier
 * recours, par le chien de garde — la partie réapparaît chez les spectateurs
 * sans qu'aucune fléchette n'ait besoin d'être lancée.
 */
export function useLiveMatchPublisher() {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const readyRef = useRef(false)
  const pendingRef = useRef<LiveMatch | null>(null)
  const trackFailuresRef = useRef(0)
  const rebuildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rebuildDelayRef = useRef(1_000)
  const ensureChannelRef = useRef<(() => void) | null>(null)

  /** Jette le canal donné, s'il est encore le canal courant. */
  const discard = useCallback((channel: RealtimeChannel | null) => {
    if (channel === null || channelRef.current !== channel) return
    channelRef.current = null
    readyRef.current = false
    trackFailuresRef.current = 0
    if (supabase) void supabase.removeChannel(channel)
  }, [])

  /** Diffuse en vérifiant l'acquittement : un canal qui ment est reconstruit. */
  const trackOn = useCallback(
    (channel: RealtimeChannel, match: LiveMatch) => {
      void channel.track(match).then((result) => {
        if (channelRef.current !== channel) return
        if (result === 'ok') {
          trackFailuresRef.current = 0
          return
        }
        trackFailuresRef.current += 1
        if (trackFailuresRef.current >= 2) {
          discard(channel)
          ensureChannelRef.current?.()
        }
      })
    },
    [discard],
  )

  const ensureChannel = useCallback(() => {
    const pending = pendingRef.current
    if (!supabase || pending === null || channelRef.current !== null) return
    const channel = supabase.channel(CHANNEL, {
      config: { presence: { key: pending.id } },
    })
    channelRef.current = channel
    channel.subscribe((status) => {
      if (channelRef.current !== channel) return // fermeture volontaire via stop()
      if (status === 'SUBSCRIBED') {
        readyRef.current = true
        rebuildDelayRef.current = 1_000
        if (pendingRef.current) trackOn(channel, pendingRef.current)
        return
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // Canal mort : reconstruction avec backoff borné — assez vite pour
        // que la présence revienne, sans marteler un serveur en difficulté.
        discard(channel)
        if (rebuildTimerRef.current !== null) clearTimeout(rebuildTimerRef.current)
        rebuildTimerRef.current = setTimeout(() => {
          rebuildTimerRef.current = null
          ensureChannelRef.current?.()
        }, rebuildDelayRef.current)
        rebuildDelayRef.current = Math.min(rebuildDelayRef.current * 2, 8_000)
      }
    })
  }, [discard, trackOn])

  useEffect(() => {
    ensureChannelRef.current = ensureChannel
  }, [ensureChannel])

  const publish = useCallback(
    (input: LiveMatchInput) => {
      if (!supabase) return
      const match: LiveMatch = { ...input, updatedAt: new Date().toISOString() }
      pendingRef.current = match
      ensureChannel()
      if (readyRef.current && channelRef.current) trackOn(channelRef.current, match)
    },
    [ensureChannel, trackOn],
  )

  /**
   * Remise sur pied : reconstruit un canal malade, et re-signale la présence
   * même sur canal sain — elle a pu expirer côté serveur pendant un gel de
   * l'onglet (téléphone verrouillé entre deux volées).
   */
  const heal = useCallback(() => {
    if (pendingRef.current === null) return
    if (!channelHealthy(channelRef.current)) {
      discard(channelRef.current)
      ensureChannel()
    } else if (readyRef.current && channelRef.current) {
      trackOn(channelRef.current, pendingRef.current)
    }
  }, [discard, ensureChannel, trackOn])

  useEffect(() => onReconnectHints(heal), [heal])
  useWatchdog(heal)

  const stop = useCallback(() => {
    const channel = channelRef.current
    // Nullifier avant removeChannel : le statut CLOSED déclenché par la
    // fermeture volontaire ne doit pas être pris pour une panne.
    channelRef.current = null
    readyRef.current = false
    pendingRef.current = null
    trackFailuresRef.current = 0
    if (rebuildTimerRef.current !== null) {
      clearTimeout(rebuildTimerRef.current)
      rebuildTimerRef.current = null
    }
    if (channel && supabase) {
      void supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => stop, [stop])

  return { publish, stop }
}

/**
 * Côté spectateurs : la liste des parties en cours, mise à jour en direct.
 * Un canal en erreur, gelé ou orphelin est reconstruit (signaux de réveil,
 * statuts d'erreur, chien de garde) : un canal neuf force une
 * resynchronisation complète de la présence — jamais de direct figé.
 */
export function useLiveMatches(): LiveMatch[] {
  const [matches, setMatches] = useState<LiveMatch[]>([])
  // Incrémenté pour reconstruire le canal : chaque époque = un canal neuf.
  const [epoch, setEpoch] = useState(0)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const resync = useCallback(() => setEpoch((e) => e + 1), [])

  useEffect(() => onReconnectHints(resync), [resync])

  const watchdogCheck = useCallback(() => {
    if (!supabase) return
    if (!channelHealthy(channelRef.current)) resync()
  }, [resync])
  useWatchdog(watchdogCheck)

  useEffect(() => {
    if (!supabase) return
    let alive = true
    const spectator = supabase.channel(CHANNEL)
    channelRef.current = spectator

    spectator
      .on('presence', { event: 'sync' }, () => {
        const state = spectator.presenceState<LiveMatch>()
        // Presence peut laisser plusieurs états empilés pour une même partie
        // (un par track/reconnexion) : on ne garde que le plus récent par id.
        const freshest = new Map<string, LiveMatch>()
        for (const meta of Object.values(state).flat()) {
          if (typeof meta.id !== 'string' || !Array.isArray(meta.darts)) continue
          const match: LiveMatch = {
            id: meta.id,
            startedAt: meta.startedAt,
            updatedAt: meta.updatedAt ?? meta.startedAt,
            finished: meta.finished,
            mode: meta.mode ?? 'volees',
            players: meta.players,
            darts: meta.darts,
            powers: meta.powers,
            fletanque: meta.fletanque,
            turn: meta.turn,
          }
          const known = freshest.get(match.id)
          if (!known || match.updatedAt >= known.updatedAt) freshest.set(match.id, match)
        }
        setMatches(
          [...freshest.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
        )
      })
      .subscribe((status) => {
        if (!alive) return
        // Voie rapide avant le chien de garde : un canal irrécupérable est
        // reconstruit sous 3 s plutôt que d'afficher un direct figé.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setTimeout(() => {
            if (alive) resync()
          }, 3_000)
        }
      })

    return () => {
      alive = false
      if (channelRef.current === spectator) channelRef.current = null
      void supabase?.removeChannel(spectator)
    }
  }, [epoch, resync])

  return matches
}
