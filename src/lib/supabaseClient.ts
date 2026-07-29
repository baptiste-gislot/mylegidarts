import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Null tant que les variables d'environnement Supabase ne sont pas
 * renseignées : l'UI affiche alors les instructions de configuration.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        realtime: {
          // Un socket mort (téléphone verrouillé, wifi de bar) est détecté en
          // ~20 s (deux battements + timeout) au lieu de ~50 s par défaut…
          heartbeatIntervalMs: 10_000,
          // …et la reconnexion réessaie vite : 0,5 s, 1 s, 1,5 s… plafonné à
          // 3 s, au lieu du palier par défaut qui monte à 10 s.
          reconnectAfterMs: (tries: number) => Math.min(500 * tries, 3_000),
        },
      })
    : null
