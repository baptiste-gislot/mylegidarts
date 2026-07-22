'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Dart } from './scoring'
import { supabase } from './supabaseClient'
import type { GameMode } from './useLeague'

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
        }
      })
    }
    pendingRef.current = match
    if (readyRef.current) void channelRef.current.track(match)
  }, [])

  const stop = useCallback(() => {
    if (channelRef.current && supabase) {
      void supabase.removeChannel(channelRef.current)
    }
    channelRef.current = null
    readyRef.current = false
    pendingRef.current = null
  }, [])

  useEffect(() => stop, [stop])

  return { publish, stop }
}

/** Côté spectateurs : la liste des parties en cours, mise à jour en direct. */
export function useLiveMatches(): LiveMatch[] {
  const [matches, setMatches] = useState<LiveMatch[]>([])

  useEffect(() => {
    if (!supabase) return
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
          }
          const known = freshest.get(match.id)
          if (!known || match.updatedAt >= known.updatedAt) freshest.set(match.id, match)
        }
        setMatches(
          [...freshest.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
        )
      })
      .subscribe()

    return () => {
      void supabase?.removeChannel(spectator)
    }
  }, [])

  return matches
}
