'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { SessionRow, SessionStatRow } from './useLeague'

/** Taille de page de l'historique, en sessions (une partie = 1 à N sessions). */
export const HISTORY_PAGE_SIZE = 60

/**
 * Historique paginé, sans le détail des fléchettes (vue session_stats).
 * « Voir plus » élargit la fenêtre depuis le début pour ne jamais couper
 * une partie en deux entre deux pages.
 */
export function useSessionHistory() {
  const [rows, setRows] = useState<SessionStatRow[] | null>(null)
  const [limit, setLimit] = useState(HISTORY_PAGE_SIZE)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (count: number) => {
    if (!supabase) return
    // On demande une ligne de plus que la page pour savoir s'il en reste.
    const { data, error: err } = await supabase
      .from('session_stats')
      .select('*')
      .order('created_at', { ascending: false })
      .range(0, count)
    if (err) {
      setError(err.message)
      return
    }
    const list = data as SessionStatRow[]
    setHasMore(list.length > count)
    setRows(list.slice(0, count))
    setError(null)
  }, [])

  useEffect(() => {
    void load(limit)
    if (!supabase) return
    const channel = supabase
      .channel('history-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => void load(limit))
      .subscribe()
    return () => {
      void supabase?.removeChannel(channel)
    }
  }, [limit, load])

  return {
    rows,
    hasMore,
    error,
    loadMore: () => setLimit((l) => l + HISTORY_PAGE_SIZE),
    reload: () => void load(limit),
  }
}

/** Sessions complètes (avec fléchettes) d'un joueur, pour la page profil. */
export function usePlayerSessions(playerId: string | undefined) {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !playerId) return
    let cancelled = false
    void supabase
      .from('sessions')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) setError(err.message)
        else setSessions(data as SessionRow[])
      })
    return () => {
      cancelled = true
    }
  }, [playerId])

  return { sessions, error }
}

/** Sessions complètes d'une partie (match_id partagé, ou session seule). */
export function useMatchSessions(matchId: string | undefined) {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !matchId) return
    let cancelled = false
    void supabase
      .from('sessions')
      .select('*')
      .or(`match_id.eq.${matchId},id.eq.${matchId}`)
      .order('total', { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) setError(err.message)
        else setSessions(data as SessionRow[])
      })
    return () => {
      cancelled = true
    }
  }, [matchId])

  return { sessions, error }
}
