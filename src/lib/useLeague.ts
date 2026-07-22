'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dart } from './scoring'
import { supabase } from './supabaseClient'

const SNAPSHOT_KEY = 'mylegidarts-cache-v3'

/** Version de schéma attendue en base (table schema_version). */
export const EXPECTED_SCHEMA_VERSION = 4

const OUTDATED_MESSAGE =
  'La base de données n’est pas à jour : exécutez les fichiers de supabase/migrations/ dans le SQL Editor de Supabase.'

export type GameMode = 'volees' | '301'

export interface PlayerRow {
  id: string
  name: string
  nickname: string | null
  created_at: string
}

/** Ligne complète de la table sessions (darts inclus) — chargée à la demande. */
export interface SessionRow {
  id: string
  player_id: string
  match_id: string | null
  darts: Dart[]
  total: number
  mode: GameMode
  won: boolean | null
  created_at: string
}

/** Ligne de la vue session_stats : la session sans le détail des fléchettes. */
export interface SessionStatRow {
  id: string
  player_id: string
  match_id: string | null
  total: number
  created_at: string
  best_volley: number
  count_180: number
  mode: GameMode
  won: boolean | null
}

/** Ligne de la vue duel_stats : bilan face-à-face entre deux joueurs. */
export interface DuelStatRow {
  player_id: string
  opponent_id: string
  played: number
  wins: number
  losses: number
}

/** Ligne de la vue player_month_stats (month au format 'YYYY-MM', Europe/Paris). */
export interface PlayerMonthStats {
  player_id: string
  month: string
  sessions_count: number
  best_total: number
  sum_total: number
  best_volley: number
  count_180: number
}

/** Clé 'YYYY-MM' d'une date, pour comparer avec player_month_stats.month. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export interface LeagueData {
  players: PlayerRow[]
  stats: PlayerMonthStats[]
  loading: boolean
  error: string | null
  configured: boolean
  addPlayer: (name: string) => Promise<string | null>
  removePlayer: (playerId: string, code: string) => Promise<string | null>
  setNickname: (playerId: string, nickname: string) => Promise<string | null>
  saveSessions: (
    entries: { playerId: string; darts: Dart[]; total: number; won?: boolean | null }[],
    matchId?: string | null,
    mode?: GameMode,
  ) => Promise<string | null>
  removeMatch: (sessionIds: string[], code: string) => Promise<string | null>
}

function deleteErrorMessage(message: string): string {
  return message.includes('code invalide')
    ? 'Code de suppression incorrect.'
    : message
}

/**
 * Données partagées de la ligue : joueurs + agrégats par joueur/mois.
 * Le détail des sessions (fléchettes) n'est jamais chargé ici — les pages
 * qui en ont besoin (historique, profil, partie) le chargent à la demande
 * via les hooks de useSessions.ts.
 */
export function useLeague(): LeagueData {
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [stats, setStats] = useState<PlayerMonthStats[]>([])
  const [loading, setLoading] = useState(supabase !== null)
  const [error, setError] = useState<string | null>(null)
  const hasDataRef = useRef(false)

  const refetch = useCallback(async () => {
    if (!supabase) return
    const [playersRes, statsRes, versionRes] = await Promise.all([
      supabase.from('players').select('*').order('name'),
      supabase.from('player_month_stats').select('*'),
      supabase.from('schema_version').select('version').eq('id', 1).maybeSingle(),
    ])
    // Garde-fou : base pas migrée → message clair plutôt qu'erreurs cryptiques.
    const version = versionRes.data?.version ?? 0
    if (versionRes.error || version < EXPECTED_SCHEMA_VERSION) {
      setError(OUTDATED_MESSAGE)
      setLoading(false)
      return
    }
    if (playersRes.error || statsRes.error) {
      // Avec des données (fraîches ou en cache) déjà affichées, un échec de
      // rafraîchissement reste silencieux : mieux vaut du légèrement périmé
      // qu'un écran d'erreur.
      if (!hasDataRef.current) setError((playersRes.error ?? statsRes.error)!.message)
    } else {
      hasDataRef.current = true
      const nextPlayers = playersRes.data as PlayerRow[]
      const nextStats = statsRes.data as PlayerMonthStats[]
      setPlayers(nextPlayers)
      setStats(nextStats)
      setError(null)
      try {
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ players: nextPlayers, stats: nextStats }))
      } catch {
        // stockage plein : tant pis pour le cache, l'app fonctionne sans
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!supabase) return
    // Affichage immédiat depuis le dernier instantané local (stale-while-revalidate).
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY)
      if (raw) {
        const cached = JSON.parse(raw) as { players: PlayerRow[]; stats: PlayerMonthStats[] }
        if (Array.isArray(cached.players) && Array.isArray(cached.stats)) {
          hasDataRef.current = true
          setPlayers(cached.players)
          setStats(cached.stats)
          setLoading(false)
        }
      }
    } catch {
      // instantané corrompu : on attend simplement le réseau
    }
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

  async function removePlayer(playerId: string, code: string): Promise<string | null> {
    if (!supabase) return 'Supabase n’est pas configuré.'
    const { error: err } = await supabase.rpc('delete_player', { pid: playerId, code })
    if (err) return deleteErrorMessage(err.message)
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
    entries: { playerId: string; darts: Dart[]; total: number; won?: boolean | null }[],
    matchId: string | null = null,
    mode: GameMode = 'volees',
  ): Promise<string | null> {
    if (!supabase) return 'Supabase n’est pas configuré.'
    const rows = entries.map((e) => ({
      player_id: e.playerId,
      match_id: matchId,
      darts: e.darts,
      total: e.total,
      mode,
      won: e.won ?? null,
    }))
    const { error: err } = await supabase.from('sessions').insert(rows)
    if (err) return err.message
    await refetch()
    return null
  }

  async function removeMatch(sessionIds: string[], code: string): Promise<string | null> {
    if (!supabase) return 'Supabase n’est pas configuré.'
    const { error: err } = await supabase.rpc('delete_sessions', { ids: sessionIds, code })
    if (err) return deleteErrorMessage(err.message)
    await refetch()
    return null
  }

  return {
    players,
    stats,
    loading,
    error,
    configured: supabase !== null,
    addPlayer,
    removePlayer,
    setNickname,
    saveSessions,
    removeMatch,
  }
}
