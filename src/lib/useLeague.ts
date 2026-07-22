'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Dart } from './scoring'
import { supabase } from './supabaseClient'

export interface PlayerRow {
  id: string
  name: string
  nickname: string | null
  created_at: string
}

export interface SessionRow {
  id: string
  player_id: string
  match_id: string | null
  darts: Dart[]
  total: number
  created_at: string
}

export interface LeagueData {
  players: PlayerRow[]
  sessions: SessionRow[]
  loading: boolean
  error: string | null
  configured: boolean
  addPlayer: (name: string) => Promise<string | null>
  removePlayer: (playerId: string) => Promise<string | null>
  setNickname: (playerId: string, nickname: string) => Promise<string | null>
  saveSessions: (
    entries: { playerId: string; darts: Dart[]; total: number }[],
    matchId?: string | null,
  ) => Promise<string | null>
  removeSession: (sessionId: string) => Promise<string | null>
  removeMatch: (sessionIds: string[]) => Promise<string | null>
}

export function useLeague(): LeagueData {
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(supabase !== null)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!supabase) return
    const [playersRes, sessionsRes] = await Promise.all([
      supabase.from('players').select('*').order('name'),
      supabase.from('sessions').select('*').order('created_at', { ascending: false }),
    ])
    if (playersRes.error || sessionsRes.error) {
      setError((playersRes.error ?? sessionsRes.error)!.message)
    } else {
      setPlayers(playersRes.data as PlayerRow[])
      setSessions(sessionsRes.data as SessionRow[])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!supabase) return
    void refetch()
    const channel = supabase
      .channel('league-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => void refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => void refetch())
      .subscribe()
    return () => {
      void supabase?.removeChannel(channel)
    }
  }, [refetch])

  async function addPlayer(name: string): Promise<string | null> {
    if (!supabase) return 'Supabase n’est pas configuré.'
    const trimmed = name.trim()
    if (!trimmed) return 'Le nom est vide.'
    const { error: err } = await supabase.from('players').insert({ name: trimmed })
    if (err) {
      return err.code === '23505' ? 'Ce nom est déjà pris. Choisissez-en un autre.' : err.message
    }
    await refetch()
    return null
  }

  async function removePlayer(playerId: string): Promise<string | null> {
    if (!supabase) return 'Supabase n’est pas configuré.'
    const { error: err } = await supabase.from('players').delete().eq('id', playerId)
    if (err) return err.message
    await refetch()
    return null
  }

  async function setNickname(playerId: string, nickname: string): Promise<string | null> {
    if (!supabase) return 'Supabase n’est pas configuré.'
    const { error: err } = await supabase
      .from('players')
      .update({ nickname: nickname.trim() || null })
      .eq('id', playerId)
    if (err) return err.message
    await refetch()
    return null
  }

  async function saveSessions(
    entries: { playerId: string; darts: Dart[]; total: number }[],
    matchId: string | null = null,
  ): Promise<string | null> {
    if (!supabase) return 'Supabase n’est pas configuré.'
    const rows = entries.map((e) => ({
      player_id: e.playerId,
      match_id: matchId,
      darts: e.darts,
      total: e.total,
    }))
    const { error: err } = await supabase.from('sessions').insert(rows)
    if (err) return err.message
    await refetch()
    return null
  }

  async function removeSession(sessionId: string): Promise<string | null> {
    if (!supabase) return 'Supabase n’est pas configuré.'
    const { error: err } = await supabase.from('sessions').delete().eq('id', sessionId)
    if (err) return err.message
    await refetch()
    return null
  }

  async function removeMatch(sessionIds: string[]): Promise<string | null> {
    if (!supabase) return 'Supabase n’est pas configuré.'
    const { error: err } = await supabase.from('sessions').delete().in('id', sessionIds)
    if (err) return err.message
    await refetch()
    return null
  }

  return {
    players,
    sessions,
    loading,
    error,
    configured: supabase !== null,
    addPlayer,
    removePlayer,
    setNickname,
    saveSessions,
    removeSession,
    removeMatch,
  }
}
