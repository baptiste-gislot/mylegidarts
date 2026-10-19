'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { Tiebreak, TournamentMode, TournamentSession } from './tournament'

export interface TournamentRow {
  id: string
  name: string
  mode: TournamentMode
  pools: string[][]
  forfeits: string[]
  tiebreaks: Record<string, Tiebreak>
  created_at: string
}

function codeError(message: string): string {
  return message.includes('code invalide') ? 'Code de suppression incorrect.' : message
}

/** Tous les tournois, le plus récent d'abord, tenus à jour en direct. */
export function useTournaments() {
  const [tournaments, setTournaments] = useState<TournamentRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) return
    const { data, error: err } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else {
      setTournaments(data as TournamentRow[])
      setError(null)
    }
  }, [])

  useEffect(() => {
    void load()
    if (!supabase) return
    const channel = supabase
      .channel('tournaments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, () => void load())
      .subscribe()
    return () => {
      void supabase?.removeChannel(channel)
    }
  }, [load])

  async function createTournament(
    name: string,
    mode: TournamentMode,
    pools: string[][],
  ): Promise<{ id: string } | { error: string }> {
    if (!supabase) return { error: 'Supabase n’est pas configuré.' }
    const { data, error: err } = await supabase
      .from('tournaments')
      .insert({ name: name.trim(), mode, pools })
      .select('id')
      .single()
    if (err) return { error: err.message }
    await load()
    return { id: (data as { id: string }).id }
  }

  async function updateTournament(
    id: string,
    patch: { forfeits?: string[]; tiebreaks?: Record<string, Tiebreak> },
  ): Promise<string | null> {
    if (!supabase) return 'Supabase n’est pas configuré.'
    const { error: err } = await supabase.from('tournaments').update(patch).eq('id', id)
    if (err) return err.message
    await load()
    return null
  }

  async function deleteTournament(id: string, code: string): Promise<string | null> {
    if (!supabase) return 'Supabase n’est pas configuré.'
    const { error: err } = await supabase.rpc('delete_tournament', { tid: id, code })
    if (err) return codeError(err.message)
    await load()
    return null
  }

  return { tournaments, error, createTournament, updateTournament, deleteTournament }
}

/** Les parties rattachées à un tournoi (ou à plusieurs), tenues à jour en direct. */
export function useTournamentSessions(ids: string[]) {
  const [sessions, setSessions] = useState<(TournamentSession & { tournament_id: string })[] | null>(null)
  const key = ids.join(',')

  const load = useCallback(async () => {
    if (!supabase) return
    if (key === '') {
      setSessions([])
      return
    }
    const { data, error: err } = await supabase
      .from('sessions')
      .select('player_id, total, won, tournament_id, tournament_slot, created_at')
      .in('tournament_id', key.split(','))
    if (!err) setSessions(data as (TournamentSession & { tournament_id: string })[])
  }, [key])

  useEffect(() => {
    void load()
    if (!supabase) return
    const channel = supabase
      .channel(`tournament-sessions-${key}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => void load())
      .subscribe()
    return () => {
      void supabase?.removeChannel(channel)
    }
  }, [key, load])

  return sessions
}
