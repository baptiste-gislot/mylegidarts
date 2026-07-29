// Boîte à outils de fiabilité pour les canaux Supabase Realtime.
//
// Trois mécanismes complémentaires, du plus réactif au plus infaillible :
// 1. les « signaux de réveil » (retour au premier plan, réseau) déclenchent
//    une vérification immédiate ;
// 2. les statuts d'erreur des canaux déclenchent une reconstruction ciblée ;
// 3. un chien de garde périodique rattrape tous les cas que 1 et 2 ratent
//    (timers gelés par iOS, callbacks perdus, socket zombie).

import { useEffect } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

/** Fréquence du chien de garde : la reprise sans interaction est garantie sous ce délai. */
export const WATCHDOG_INTERVAL_MS = 15_000

/**
 * Appelle `callback` quand l'onglet « revient à la vie » : retour au premier
 * plan, restauration depuis le bfcache (iOS), focus, retour du réseau.
 * Débouncé : ces événements arrivent souvent en rafale au déverrouillage.
 * Retourne la fonction de nettoyage.
 */
export function onReconnectHints(callback: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const fire = () => {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(callback, 250)
  }
  const whenVisible = () => {
    if (document.visibilityState === 'visible') fire()
  }
  document.addEventListener('visibilitychange', whenVisible)
  window.addEventListener('pageshow', whenVisible)
  window.addEventListener('focus', whenVisible)
  window.addEventListener('online', fire)
  return () => {
    if (timer !== null) clearTimeout(timer)
    document.removeEventListener('visibilitychange', whenVisible)
    window.removeEventListener('pageshow', whenVisible)
    window.removeEventListener('focus', whenVisible)
    window.removeEventListener('online', fire)
  }
}

/** Un canal est sain quand le socket est connecté ET le canal joint. */
export function channelHealthy(channel: RealtimeChannel | null): boolean {
  if (channel === null || supabase === null) return false
  return supabase.realtime.isConnected() && channel.state === 'joined'
}

/**
 * Chien de garde : exécute `check` à intervalle régulier tant que le
 * composant est monté. `check` doit être stable (useCallback).
 */
export function useWatchdog(check: () => void): void {
  useEffect(() => {
    const id = setInterval(check, WATCHDOG_INTERVAL_MS)
    return () => clearInterval(id)
  }, [check])
}
