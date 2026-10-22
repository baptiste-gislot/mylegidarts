'use client'

import Link from 'next/link'
import { LevelStandings } from '@/components/LevelStandings'
import { MonthPodium } from '@/components/MonthPodium'
import { RANKING_LINKS, SectionNav } from '@/components/SectionNav'
import { SetupNotice } from '@/components/SetupNotice'
import { useLiveMatches } from '@/lib/liveMatch'
import { useLeagueContext } from '@/lib/LeagueProvider'

/** Le classement au niveau de la saison ; le défi du mois et les records sont à côté. */
export default function ClassementPage() {
  const { players, stats, loading, error, configured } = useLeagueContext()
  const liveMatches = useLiveMatches()

  if (!configured) return <SetupNotice />
  if (loading) return <p className="empty">Chargement du classement…</p>
  if (error) return <p className="notice notice--error">Erreur : {error}</p>

  if (players.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">Le tableau est vide</p>
        <p>Ajoutez des joueurs dans l’onglet Joueurs, puis lancez une première session.</p>
      </div>
    )
  }

  return (
    <div className="stack">
      {liveMatches.length > 0 && (
        <Link href="/live" className="live-banner">
          <span className="live-dot" aria-hidden="true" />
          <span className="live-banner__text">
            Partie en cours :{' '}
            {liveMatches
              .map((m) => m.players.map((p) => p.name).join(' · '))
              .join(' — ')}
          </span>
          <span className="live-banner__cta">Suivre</span>
        </Link>
      )}

      <SectionNav label="Classements" links={RANKING_LINKS} />

      <LevelStandings players={players} />

      <MonthPodium players={players} stats={stats} />
    </div>
  )
}
