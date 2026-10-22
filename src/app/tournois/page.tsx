'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { SetupNotice } from '@/components/SetupNotice'
import { useToast } from '@/components/Toaster'
import { TournamentBoard, poolName } from '@/components/TournamentBoard'
import { gameLabel } from '@/lib/gameCatalog'
import { useLeagueContext } from '@/lib/LeagueProvider'
import {
  MIN_TOURNAMENT_PLAYERS,
  TOURNAMENT_MODES,
  drawPools,
  replayTournament,
  type TournamentMode,
  type TournamentView,
} from '@/lib/tournament'
import { shuffle } from '@/lib/random'
import { useTournamentSessions, useTournaments } from '@/lib/useTournaments'

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })
const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

export default function TournoisPage() {
  const { players, loading, error, configured } = useLeagueContext()
  const { tournaments, error: tournamentsError, createTournament, updateTournament, deleteTournament } =
    useTournaments()
  const ids = useMemo(() => (tournaments ?? []).map((t) => t.id), [tournaments])
  const sessions = useTournamentSessions(ids)

  if (!configured) return <SetupNotice />
  if (loading || tournaments === null || sessions === null) {
    return <p className="empty">Chargement des tournois…</p>
  }
  if (error || tournamentsError) {
    return <p className="notice notice--error">Erreur : {error ?? tournamentsError}</p>
  }

  const views = new Map<string, TournamentView>(
    tournaments.map((t) => [t.id, replayTournament(t, sessions.filter((s) => s.tournament_id === t.id))]),
  )
  // Un seul tournoi à la fois : le plus récent qui n'a pas encore de vainqueur.
  const current = tournaments.find((t) => !views.get(t.id)!.finished) ?? null
  const archive = tournaments.filter((t) => t !== current)
  const name = (id: string | null) => players.find((p) => p.id === id)?.name ?? 'Joueur supprimé'

  return (
    <div className="stack">
      {current ? (
        <TournamentBoard
          tournament={current}
          view={views.get(current.id)!}
          players={players}
          onUpdate={(patch) => updateTournament(current.id, patch)}
          onDelete={(code) => deleteTournament(current.id, code)}
        />
      ) : (
        <CreateTournament onCreate={createTournament} />
      )}

      {archive.length > 0 && (
        <section>
          <h2 className="section-title">Tournois passés</h2>
          <ul className="hall">
            {archive.map((t) => (
              <li key={t.id}>
                <Link href={`/tournois/${t.id}`} className="hall__row hall__row--link">
                  <span className="hall__month">
                    {t.name} · {gameLabel(t.mode)} · {dateFormat.format(new Date(t.created_at))}
                  </span>
                  <span className="hall__name">🏆 {name(views.get(t.id)!.champion)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function CreateTournament({
  onCreate,
}: {
  onCreate: (name: string, mode: TournamentMode, pools: string[][]) => Promise<{ id: string } | { error: string }>
}) {
  const { players } = useLeagueContext()
  const toast = useToast()
  const [name, setName] = useState(() => `Tournoi du ${dayFormat.format(new Date())}`)
  const [mode, setMode] = useState<TournamentMode>('volees')
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const enough = selected.length >= MIN_TOURNAMENT_PLAYERS

  async function create(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!enough || busy) return
    setBusy(true)
    // Poules tirées au sort.
    const pools = drawPools(shuffle(selected))
    const result = await onCreate(name, mode, pools)
    setBusy(false)
    if ('error' in result) {
      setFormError(result.error)
      return
    }
    toast(
      `${name} est lancé : ${pools.map((p, i) => `${poolName(i)} (${p.length})`).join(', ')}`,
      'success',
    )
  }

  return (
    <form className="stack" onSubmit={(e) => void create(e)}>
      <section className="empty">
        <p className="empty__title">Aucun tournoi en cours</p>
        <p>
          Des poules de 3 ou 4 joueurs, puis les deux premiers de chaque poule en tableau à
          élimination directe. Chaque rencontre se joue en une partie, et compte comme une partie
          ordinaire.
        </p>
      </section>

      <section>
        <h2 className="section-title">Nom</h2>
        <div className="add-form">
          <input
            type="text"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            aria-label="Nom du tournoi"
          />
        </div>
      </section>

      <section>
        <h2 className="section-title">Jeu</h2>
        <div className="chips" role="radiogroup" aria-label="Jeu du tournoi">
          {TOURNAMENT_MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={mode === m ? 'chip chip--on' : 'chip'}
              onClick={() => setMode(m)}
            >
              {gameLabel(m)}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title">Participants</h2>
        <p className="mode-hint">
          {MIN_TOURNAMENT_PLAYERS} joueurs minimum. Les poules sont tirées au sort.
        </p>
        <div className="chips">
          {players.map((p) => {
            const on = selected.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                className={on ? 'chip chip--on' : 'chip'}
                onClick={() =>
                  setSelected((current) => (on ? current.filter((id) => id !== p.id) : [...current, p.id]))
                }
              >
                {p.name}
              </button>
            )
          })}
        </div>
      </section>

      {formError && (
        <p className="notice notice--error" role="alert">
          {formError}
        </p>
      )}

      <button type="submit" className="button-primary" disabled={!enough || busy || name.trim() === ''}>
        {busy
          ? 'Tirage des poules…'
          : enough
            ? `Lancer le tournoi à ${selected.length}`
            : `Encore ${MIN_TOURNAMENT_PLAYERS - selected.length} joueur${MIN_TOURNAMENT_PLAYERS - selected.length > 1 ? 's' : ''}`}
      </button>
    </form>
  )
}

