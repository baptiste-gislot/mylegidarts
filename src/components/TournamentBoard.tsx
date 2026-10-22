'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useDialog } from './Dialog'
import { PlayerAvatar } from './PlayerAvatar'
import { useToast } from './Toaster'
import { DELETE_CODE_INPUT, forgetDeleteCode, rememberDeleteCode, storedDeleteCode } from '@/lib/deleteCode'
import { gameLabel } from '@/lib/gameCatalog'
import { roundLabel, type Rencontre, type Tiebreak, type TournamentView } from '@/lib/tournament'
import type { PlayerRow } from '@/lib/useLeague'
import type { TournamentRow } from '@/lib/useTournaments'

const dateFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

/** « Poule A », « Poule B »… */
export function poolName(index: number): string {
  return `Poule ${String.fromCharCode(65 + index)}`
}

interface TournamentBoardProps {
  tournament: TournamentRow
  view: TournamentView
  players: PlayerRow[]
  onUpdate: (patch: { forfeits?: string[]; tiebreaks?: Record<string, Tiebreak> }) => Promise<string | null>
  onDelete: (code: string) => Promise<string | null>
}

/** Un tournoi : poules, tableau, champion — et de quoi lancer chaque rencontre. */
export function TournamentBoard({ tournament, view, players, onUpdate, onDelete }: TournamentBoardProps) {
  const ask = useDialog()
  const toast = useToast()
  const name = (id: string | null) =>
    id === null ? 'À déterminer' : (players.find((p) => p.id === id)?.name ?? 'Joueur supprimé')
  const live = !view.finished

  /** Le lien qui ouvre /tirer avec la rencontre toute réglée. */
  const playHref = (r: Rencontre, label: string) =>
    `/tirer?${new URLSearchParams({
      tournoi: tournament.id,
      rencontre: r.slot,
      jeu: tournament.mode,
      a: r.a!,
      b: r.b!,
      titre: label,
    })}`

  async function declareForfeit(player: string) {
    const answer = await ask({
      title: `Forfait de ${name(player)} ?`,
      body: 'Ses rencontres restantes sont perdues : ses adversaires gagnent sans jouer.',
      confirmLabel: 'Déclarer forfait',
      danger: true,
    })
    if (!answer) return
    const err = await onUpdate({ forfeits: [...tournament.forfeits, player] })
    if (err) toast(err, 'error')
    else toast(`${name(player)} déclare forfait`)
  }

  async function remove() {
    const stored = storedDeleteCode()
    const answer = await ask({
      title: `Supprimer « ${tournament.name} » ?`,
      body: 'Le tournoi disparaît ; ses parties restent dans l’historique comme des parties ordinaires.',
      confirmLabel: 'Supprimer le tournoi',
      danger: true,
      input: stored ? undefined : DELETE_CODE_INPUT,
    })
    if (!answer) return
    const code = stored ?? answer.value.trim()
    const err = await onDelete(code)
    if (err) {
      forgetDeleteCode()
      toast(err, 'error')
    } else {
      rememberDeleteCode(code)
      toast('Tournoi supprimé')
    }
  }

  const rounds = view.bracket.length

  // La prochaine rencontre à jouer : les poules dans l'ordre, puis le tableau.
  // C'est la seule qui porte le bouton jaune ; les autres restent discrètes.
  const next = live
    ? ([
        ...view.pools.flatMap((pool) => pool.rencontres.map((r) => ({ r, label: poolName(pool.index) }))),
        ...view.bracket.flatMap(({ round, rencontres }) =>
          rencontres.map((r) => ({ r, label: roundLabel(round, rounds) })),
        ),
      ].find(({ r }) => r.status === 'a_jouer' && r.a !== null && r.b !== null) ?? null)
    : null

  return (
    <div className="stack">
      <header className="tournament-head">
        <h2 className="tournament-head__name">{tournament.name}</h2>
        <p className="tournament-head__meta">
          {gameLabel(tournament.mode)}, {dateFormat.format(new Date(tournament.created_at))}
        </p>
      </header>

      {next && (
        <section className="next-up">
          <p className="next-up__label">Prochaine rencontre · {next.label}</p>
          <p className="next-up__players">
            <span>{name(next.r.a)}</span>
            <span className="next-up__vs">contre</span>
            <span>{name(next.r.b)}</span>
          </p>
          <Link href={playHref(next.r, next.label)} className="button-primary next-up__play">
            Lancer la rencontre
          </Link>
        </section>
      )}

      {view.champion && (
        <section className="champion">
          <PlayerAvatar name={name(view.champion)} leader />
          <span className="champion__label">Vainqueur du tournoi</span>
          <span className="champion__name">{name(view.champion)}</span>
        </section>
      )}

      {view.bracket.length > 0 && (
        <section>
          <h3 className="section-title">Tableau</h3>
          <div className="bracket">
            {view.bracket.map(({ round, rencontres }) => (
              <div key={round} className="bracket__round">
                <p className="bracket__title">{roundLabel(round, rounds)}</p>
                {rencontres.map((r) => (
                  <RencontreCard
                    key={r.slot}
                    rencontre={r}
                    name={name}
                    playHref={live ? playHref(r, roundLabel(round, rounds)) : null}
                    onTiebreak={(tiebreak) =>
                      onUpdate({ tiebreaks: { ...tournament.tiebreaks, [r.slot]: tiebreak } })
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {view.pools.map((pool) => (
        <section key={pool.index}>
          <h3 className="section-title">{poolName(pool.index)}</h3>
          <table className="pool">
            <thead>
              <tr>
                <th scope="col" className="pool__rank">
                  <span className="visually-hidden">Rang</span>
                </th>
                <th scope="col" className="pool__name">
                  Joueur
                </th>
                <th scope="col" title="Victoires">V</th>
                <th scope="col" title="Nuls">N</th>
                <th scope="col" title="Défaites">D</th>
                <th scope="col" title="Points marqués">Marqués</th>
                <th scope="col" title="Points de classement">Pts</th>
              </tr>
            </thead>
            <tbody>
              {pool.standings.map((line, rank) => (
                <tr
                  key={line.player}
                  className={[
                    rank < 2 && !line.forfeit ? 'pool__row--qualified' : '',
                    line.forfeit ? 'pool__row--out' : '',
                  ].join(' ')}
                >
                  <td className="pool__rank">{rank + 1}</td>
                  <td className="pool__name">
                    {name(line.player)}
                    {line.forfeit && <em> · forfait</em>}
                    {live && !line.forfeit && (
                      <button
                        type="button"
                        className="pool__forfeit"
                        onClick={() => void declareForfeit(line.player)}
                      >
                        Forfait
                      </button>
                    )}
                  </td>
                  <td>{line.wins}</td>
                  <td>{line.draws}</td>
                  <td>{line.losses}</td>
                  <td>{line.scored}</td>
                  <td className="pool__points">{line.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="fixtures">
            {pool.rencontres.map((r) => (
              <RencontreCard
                key={r.slot}
                rencontre={r}
                name={name}
                playHref={live ? playHref(r, poolName(pool.index)) : null}
                onTiebreak={null}
              />
            ))}
          </div>
        </section>
      ))}

      <button type="button" className="button-ghost button-ghost--danger tournament-delete" onClick={() => void remove()}>
        Supprimer le tournoi
      </button>
    </div>
  )
}

function RencontreCard({
  rencontre: r,
  name,
  playHref,
  onTiebreak,
}: {
  rencontre: Rencontre
  name: (id: string | null) => string
  playHref: string | null
  onTiebreak: ((tiebreak: Tiebreak) => Promise<string | null>) | null
}) {
  const side = (player: string | null, score: number | undefined) => (
    <span
      className={
        r.winner !== null && r.winner === player ? 'fixture-card__side fixture-card__side--won' : 'fixture-card__side'
      }
    >
      <span className="fixture-card__name">{name(player)}</span>
      {score !== undefined && <span className="fixture-card__score">{score}</span>}
    </span>
  )

  return (
    <div className={`fixture-card fixture-card--${r.status}`}>
      {side(r.a, r.scores?.a)}
      {side(r.b, r.scores?.b)}
      <span className="fixture-card__status">
        {r.status === 'a_jouer' && playHref ? (
          <Link href={playHref} className="button-secondary fixture-card__play">
            Jouer
          </Link>
        ) : r.status === 'jouee' && r.winner === null ? (
          'Match nul'
        ) : r.status === 'forfait' ? (
          'Forfait'
        ) : r.status === 'exempt' ? (
          'Exempt'
        ) : r.status === 'attente' ? (
          'En attente'
        ) : null}
      </span>
      {r.status === 'mort_subite' && onTiebreak && r.a && r.b && (
        <SuddenDeath a={r.a} b={r.b} name={name} onDecide={onTiebreak} />
      )}
    </div>
  )
}

/**
 * Égalité au tableau : une volée de trois fléchettes chacun, le plus gros total
 * passe. On note les deux totaux ; à égalité, on recommence.
 */
function SuddenDeath({
  a,
  b,
  name,
  onDecide,
}: {
  a: string
  b: string
  name: (id: string | null) => string
  onDecide: (tiebreak: Tiebreak) => Promise<string | null>
}) {
  const toast = useToast()
  const [volleys, setVolleys] = useState<[number, number][]>([])
  const [totals, setTotals] = useState(['', ''])

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const [x, y] = totals.map(Number)
    const next: [number, number][] = [...volleys, [x, y]]
    if (x === y) {
      setVolleys(next)
      setTotals(['', ''])
      toast('Encore égalité : une autre volée chacun !')
      return
    }
    const err = await onDecide({ winner: x > y ? a : b, volleys: next })
    if (err) toast(err, 'error')
  }

  const valid = totals.every((t) => t !== '' && Number(t) >= 0 && Number(t) <= 180)

  return (
    <form className="sudden-death" onSubmit={(e) => void submit(e)}>
      <p className="sudden-death__title">
        Égalité : mort subite{volleys.length > 0 ? ` (volée ${volleys.length + 1})` : ''}
      </p>
      <p className="sudden-death__hint">Une volée de trois fléchettes chacun, le plus gros total passe.</p>
      {[a, b].map((player, i) => (
        <label key={player} className="sudden-death__field">
          <span>{name(player)}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={180}
            value={totals[i]}
            onChange={(e) => setTotals((t) => t.map((v, j) => (j === i ? e.target.value : v)))}
          />
        </label>
      ))}
      <button type="submit" className="button-primary" disabled={!valid}>
        Valider la volée
      </button>
    </form>
  )
}
