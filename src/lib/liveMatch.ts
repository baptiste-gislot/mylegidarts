'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
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
}

export type LiveMatchInput = Omit<LiveMatch, 'updatedAt'>

const CHANNEL = 'live-matches'

/**
 * Côté tireur : diffuse l'état de la partie après chaque fléchette.
 * La présence expire d'elle-même si l'appareil se déconnecte —
 * aucune donnée à nettoyer côté base.
 */
export function useLiveMatchPublisher() {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const readyRef = useRef(false)
  const pendingRef = useRef<LiveMatch | null>(null)

  const publish = useCallback((input: LiveMatchInput) => {
    if (!supabase) return
    const match: LiveMatch = { ...input, updatedAt: new Date().toISOString() }
    if (channelRef.current === null) {
      const channel = supabase.channel(CHANNEL, {
        config: { presence: { key: match.id } },
      })
      channelRef.current = channel
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          readyRef.current = true
          if (pendingRef.current) void channel.track(pendingRef.current)
          return
        }
        // Canal mort (téléphone verrouillé, réseau coupé…) : on le jette pour
        // que la prochaine publication reparte d'un canal neuf. Sans ça, les
        // track() suivants échouent en silence et la partie disparaît du live.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (channelRef.current !== channel) return // fermeture volontaire via stop()
          channelRef.current = null
          readyRef.current = false
          if (supabase) void supabase.removeChannel(channel)
        }
      })
    }
    pendingRef.current = match
    if (readyRef.current) void channelRef.current.track(match)
  }, [])

  const stop = useCallback(() => {
    const channel = channelRef.current
    // Nullifier avant removeChannel : le statut CLOSED déclenché par la
    // fermeture volontaire ne doit pas être pris pour une panne.
    channelRef.current = null
    readyRef.current = false
    pendingRef.current = null
    if (channel && supabase) {
      void supabase.removeChannel(channel)
    }
  }, [])

  // Au retour au premier plan (déverrouillage du téléphone, retour réseau),
  // rediffuse l'état en attente : la présence a probablement expiré côté
  // serveur pendant le gel de l'onglet.
  useEffect(() => {
    const republish = () => {
      if (document.visibilityState !== 'visible') return
      const pending = pendingRef.current
      if (!pending) return
      if (channelRef.current === null) {
        publish(pending)
      } else if (readyRef.current) {
        void channelRef.current.track(pending)
      }
    }
    document.addEventListener('visibilitychange', republish)
    window.addEventListener('online', republish)
    return () => {
      document.removeEventListener('visibilitychange', republish)
      window.removeEventListener('online', republish)
    }
  }, [publish])

  useEffect(() => stop, [stop])

  return { publish, stop }
}

/** Côté spectateurs : la liste des parties en cours, mise à jour en direct. */
export function useLiveMatches(): LiveMatch[] {
  const [matches, setMatches] = useState<LiveMatch[]>([])
  // Incrémenté pour reconstruire le canal (panne, retour au premier plan) :
  // un canal neuf force une resynchronisation complète de la présence.
  const [epoch, setEpoch] = useState(0)

  useEffect(() => {
    const resync = () => {
      if (document.visibilityState !== 'visible') return
      setEpoch((e) => e + 1)
    }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('online', resync)
    return () => {
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('online', resync)
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    let alive = true
    const spectator = supabase.channel(CHANNEL)

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
          }
          const known = freshest.get(match.id)
          if (!known || match.updatedAt >= known.updatedAt) freshest.set(match.id, match)
        }
        setMatches(
          [...freshest.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
        )
      })
      .subscribe((status) => {
        // Canal irrécupérable : on le reconstruit plutôt que d'afficher un
        // direct figé sur le dernier état reçu.
        if (!alive) return
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setTimeout(() => {
            if (alive) setEpoch((e) => e + 1)
          }, 3000)
        }
      })

    return () => {
      alive = false
      void supabase?.removeChannel(spectator)
    }
  }, [epoch])

  return matches
}
