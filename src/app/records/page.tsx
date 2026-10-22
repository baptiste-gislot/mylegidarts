'use client'

import Link from 'next/link'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { RANKING_LINKS, SectionNav } from '@/components/SectionNav'
import { SetupNotice } from '@/components/SetupNotice'
import { computeRecords } from '@/lib/records'
import { useLeagueContext } from '@/lib/LeagueProvider'
import { useAllSessionStats } from '@/lib/useSessions'

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return monthFormat.format(new Date(year, month - 1, 1))
}

export default function RecordsPage() {
  const { players, stats, loading, error, configured } = useLeagueContext()
  const { rows, error: rowsError } = useAllSessionStats()

  if (!configured) return <SetupNotice />
  if (loading || rows === null) return <p className="empty">Chargement des records…</p>
  if (error || rowsError) return <p className="notice notice--error">Erreur : {error ?? rowsError}</p>

  const records = computeRecords(rows, stats)
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? 'Joueur supprimé'

  return (
    <div className="stack">
      <SectionNav label="Classements" links={RANKING_LINKS} />

      {records.length === 0 ? (
        <div className="empty">
          <p className="empty__title">Aucun record pour l’instant</p>
          <p>Les records tomberont dès la première partie dans l’onglet Jouer.</p>
        </div>
      ) : (
        <ul className="records">
          {records.map((entry) => (
            <li key={entry.id} className="records__row">
              <span className="records__icon" aria-hidden="true">
                {entry.icon}
              </span>
              <span className="records__what">
                <span className="records__label">{entry.label}</span>
                <span className="records__detail">
                  {[
                    entry.date && dateFormat.format(new Date(entry.date)),
                    entry.month && monthLabel(entry.month),
                    entry.note,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className="records__who">
                <span className="records__avatars">
                  {entry.playerIds.map((id) => (
                    <Link key={id} href={`/profil/${id}`} className="records__holder" title={name(id)}>
                      <PlayerAvatar name={name(id)} />
                    </Link>
                  ))}
                </span>
                <span className="records__names">{entry.playerIds.map(name).join(' · ')}</span>
              </span>
              <span className="records__value">{entry.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
