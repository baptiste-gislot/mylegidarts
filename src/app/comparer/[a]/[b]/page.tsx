'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { DartHeatmap } from '@/components/DartHeatmap'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { SetupNotice } from '@/components/SetupNotice'
import { gameLabel } from '@/lib/gameCatalog'
import { headToHead } from '@/lib/headToHead'
import { consistency, recentForm } from '@/lib/profileStats'
import { bestVolley, count180s } from '@/lib/scoring'
import type { Dart } from '@/lib/scoring'
import { useLeagueContext } from '@/lib/LeagueProvider'
import type { GameMode, SessionRow } from '@/lib/useLeague'
import { useHeadToHeadRows, usePlayerSessions } from '@/lib/useSessions'

interface Side {
  record: number
  average: number
  form: number | null
  bestVolley: number
  perDart: number
  total180: number
  sigma: number
  count: number
  darts: Dart[]
}

/** Stats d'un joueur pour la comparaison. Null tant qu'il n'a pas tiré. */
function summarize(sessions: SessionRow[]): Side | null {
  if (sessions.length === 0) return null
  const totals = sessions.map((s) => s.total)
  const darts = sessions.flatMap((s) => s.darts)
  return {
    record: Math.max(...totals),
    average: Math.round(totals.reduce((sum, t) => sum + t, 0) / totals.length),
    form: recentForm(totals)?.recent ?? null,
    bestVolley: Math.max(...sessions.map((s) => bestVolley(s.darts))),
    perDart: darts.reduce((sum, d) => sum + d.sector * d.mult, 0) / darts.length,
    total180: sessions.reduce((sum, s) => sum + count180s(s.darts), 0),
    sigma: consistency(totals),
    count: sessions.length,
    darts,
  }
}

interface VersusRow {
  label: string
  a: number | null
  b: number | null
  /** Sens de la comparaison : à qui profite la valeur la plus haute ? */
  better: 'high' | 'low' | 'none'
  format?: (value: number) => string
}

export default function ComparerPage() {
  const { a, b } = useParams<{ a: string; b: string }>()
  const { players, loading, error, configured } = useLeagueContext()
  const { sessions: ownA, error: errorA } = usePlayerSessions(a)
  const { sessions: ownB, error: errorB } = usePlayerSessions(b)
  const duelRows = useHeadToHeadRows(a, b)
  const [duelGame, setDuelGame] = useState<GameMode | 'all'>('all')

  if (!configured) return <SetupNotice />
  if (loading) return <p className="empty">Chargement de la comparaison…</p>
  const anyError = error ?? errorA ?? errorB
  if (anyError) return <p className="notice notice--error">Erreur : {anyError}</p>

  const playerA = players.find((p) => p.id === a)
  const playerB = players.find((p) => p.id === b)
  if (!playerA || !playerB) {
    return (
      <div className="empty">
        <p className="empty__title">Joueur introuvable</p>
        <p>
          Un des deux joueurs n’existe plus. <Link href="/">Retour au classement</Link>.
        </p>
      </div>
    )
  }

  if (ownA === null || ownB === null) return <p className="empty">Chargement de la comparaison…</p>

  const sideA = summarize(ownA)
  const sideB = summarize(ownB)
  // Bilan par jeu : un filtre n'apparaît que pour les jeux réellement joués.
  const byGame = headToHead(duelRows ?? [], a, b)
  const games = [...byGame.keys()].filter((key): key is GameMode => key !== 'all')
  const activeGame = byGame.has(duelGame) ? duelGame : 'all'
  const duel = byGame.get(activeGame)
  const draws = duel?.draws ?? 0

  const rows: VersusRow[] = [
    { label: 'record', a: sideA?.record ?? null, b: sideB?.record ?? null, better: 'high' },
    { label: 'moyenne', a: sideA?.average ?? null, b: sideB?.average ?? null, better: 'high' },
    { label: 'forme (5 dern.)', a: sideA?.form ?? null, b: sideB?.form ?? null, better: 'high' },
    { label: 'volée max', a: sideA?.bestVolley ?? null, b: sideB?.bestVolley ?? null, better: 'high' },
    {
      label: 'pts / fléchette',
      a: sideA?.perDart ?? null,
      b: sideB?.perDart ?? null,
      better: 'high',
      format: (v) => v.toFixed(1),
    },
    { label: '180', a: sideA?.total180 ?? null, b: sideB?.total180 ?? null, better: 'high' },
    {
      label: 'constance',
      a: sideA?.sigma ?? null,
      b: sideB?.sigma ?? null,
      better: 'low',
      format: (v) => `± ${v}`,
    },
    { label: 'parties', a: sideA?.count ?? null, b: sideB?.count ?? null, better: 'none' },
  ]

  const cell = (row: VersusRow, side: 'a' | 'b') => {
    const value = row[side]
    if (value === null) return <span className="versus__value">—</span>
    const other = row[side === 'a' ? 'b' : 'a']
    const wins =
      row.better !== 'none' &&
      other !== null &&
      (row.better === 'high' ? value > other : value < other)
    return (
      <span className={wins ? 'versus__value versus__value--win' : 'versus__value'}>
        {row.format ? row.format(value) : value}
      </span>
    )
  }

  return (
    <div className="stack">
      <div className="profil-head">
        <Link href={`/profil/${a}`} className="button-ghost">
          ← Profil
        </Link>
        <div className="versus-head">
          <span className="versus-head__side">
            <PlayerAvatar name={playerA.name} />
            <span className="board__name">{playerA.name}</span>
          </span>
          <span className="versus-head__vs">vs</span>
          <span className="versus-head__side">
            <PlayerAvatar name={playerB.name} />
            <span className="board__name">{playerB.name}</span>
          </span>
        </div>
      </div>

      <section>
        <h2 className="section-title">Face-à-face</h2>
        {games.length > 1 && (
          <div className="chips versus-games" role="radiogroup" aria-label="Jeu du face-à-face">
            {(['all', ...games] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={activeGame === key}
                className={activeGame === key ? 'chip chip--on' : 'chip'}
                onClick={() => setDuelGame(key)}
              >
                {key === 'all' ? 'Tous les jeux' : gameLabel(key)}
              </button>
            ))}
          </div>
        )}
        {duel ? (
          <p className="versus-duel">
            <span className="versus-duel__score">{duel.wins}</span> victoire{duel.wins > 1 ? 's' : ''}
            {draws > 0 && ` · ${draws} nul${draws > 1 ? 's' : ''}`} ·{' '}
            <span className="versus-duel__score">{duel.losses}</span> défaite{duel.losses > 1 ? 's' : ''}
            <span className="versus-duel__hint">
              {' '}
              (du point de vue de {playerA.name}, sur {duel.played} partie{duel.played > 1 ? 's' : ''})
            </span>
          </p>
        ) : (
          <p className="empty">Aucune partie jouée l’un contre l’autre pour l’instant.</p>
        )}
      </section>

      <section>
        <h2 className="section-title">Statistiques</h2>
        <div className="versus">
          {rows.map((row) => (
            <div key={row.label} className="versus__row">
              {cell(row, 'a')}
              <span className="versus__label">{row.label}</span>
              {cell(row, 'b')}
            </div>
          ))}
        </div>
      </section>

      {(sideA || sideB) && (
        <section>
          <h2 className="section-title">Heatmaps</h2>
          <div className="versus-heatmaps">
            <div>
              <p className="versus-heatmaps__name">{playerA.name}</p>
              {sideA ? <DartHeatmap darts={sideA.darts} /> : <p className="empty">Aucune session.</p>}
            </div>
            <div>
              <p className="versus-heatmaps__name">{playerB.name}</p>
              {sideB ? <DartHeatmap darts={sideB.darts} /> : <p className="empty">Aucune session.</p>}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
