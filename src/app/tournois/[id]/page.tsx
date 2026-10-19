'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { SetupNotice } from '@/components/SetupNotice'
import { TournamentBoard } from '@/components/TournamentBoard'
import { useLeagueContext } from '@/lib/LeagueProvider'
import { replayTournament } from '@/lib/tournament'
import { useTournamentSessions, useTournaments } from '@/lib/useTournaments'

/** Un tournoi passé, consulté depuis les archives. */
export default function TournoiPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { players, loading, configured } = useLeagueContext()
  const { tournaments, updateTournament, deleteTournament } = useTournaments()
  const sessions = useTournamentSessions([id])

  if (!configured) return <SetupNotice />
  if (loading || tournaments === null || sessions === null) {
    return <p className="empty">Chargement du tournoi…</p>
  }

  const tournament = tournaments.find((t) => t.id === id)
  if (!tournament) {
    return (
      <div className="empty">
        <p className="empty__title">Tournoi introuvable</p>
        <p>
          Il a peut-être été supprimé. <Link href="/tournois">Retour aux tournois</Link>.
        </p>
      </div>
    )
  }

  return (
    <div className="stack">
      <Link href="/tournois" className="button-ghost back-link">
        ← Tournois
      </Link>
      <TournamentBoard
        tournament={tournament}
        view={replayTournament(tournament, sessions)}
        players={players}
        onUpdate={(patch) => updateTournament(tournament.id, patch)}
        onDelete={async (code) => {
          const err = await deleteTournament(tournament.id, code)
          if (!err) router.push('/tournois')
          return err
        }}
      />
    </div>
  )
}
