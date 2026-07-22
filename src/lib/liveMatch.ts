'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Dart } from './scoring'
import { supabase } from './supabaseClient'

/** État d'une partie en cours, diffusé via Supabase Realtime Presence. */
export interface LiveMatch {
  id: string
  startedAt: string
  finished: boolean
  players: { id: string; name: string }[]
  darts: Dart[][]
}

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

  const publish = useCallback((match: LiveMatch) => {
    if (!supabase) return
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
        const list = Object.values(state)
          .flat()
          .filter((m) => typeof m.id === 'string' && Array.isArray(m.darts))
          .map((m) => ({
            id: m.id,
            startedAt: m.startedAt,
            finished: m.finished,
            players: m.players,
            darts: m.darts,
          }))
          .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
        setMatches(list)
      })
      .subscribe()

    return () => {
      void supabase?.removeChannel(spectator)
    }
  }, [])

  return matches
}
