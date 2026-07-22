'use client'

import { createContext, useContext } from 'react'
import { useLeague, type LeagueData } from './useLeague'

const LeagueContext = createContext<LeagueData | null>(null)

/**
 * Monte useLeague une seule fois pour toute l'app (dans AppShell) :
 * les données sont chargées une fois puis tenues à jour par le realtime,
 * au lieu d'être re-téléchargées à chaque changement d'onglet.
 */
export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const league = useLeague()
  return <LeagueContext.Provider value={league}>{children}</LeagueContext.Provider>
}

export function useLeagueContext(): LeagueData {
  const value = useContext(LeagueContext)
  if (value === null) throw new Error('useLeagueContext doit être utilisé sous LeagueProvider')
  return value
}
