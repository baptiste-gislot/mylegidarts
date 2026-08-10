'use client'

import { useMemo, useState } from 'react'
import { SetupNotice } from '@/components/SetupNotice'
import { useToast } from '@/components/Toaster'
import { useLeagueContext } from '@/lib/LeagueProvider'
import {
  BUILT_IN_LINES,
  LOW_VOLLEY_MAX,
  praiseThresholds,
  type Punchline,
} from '@/lib/trashTalk'
import { averageVolleyOf, type PunchlineRow } from '@/lib/useLeague'

type Kind = Punchline['kind']

/** Seuil proposé à la sélection d'une famille : bas pour piquer, haut pour saluer. */
const DEFAULT_THRESHOLD: Record<Kind, string> = { taunt: '20', congrat: '60' }

/** Condition de déclenchement d'une punchline maison, en toutes lettres. */
function triggerLabel(punchline: Punchline): string {
  return punchline.kind === 'taunt'
    ? `volée à ${punchline.threshold} points ou moins`
    : `dès ${punchline.threshold} points`
}

export default function PunchlinesPage() {
  const toast = useToast()
  const { punchlines, stats, loading, error, configured, addPunchline, removePunchline } =
    useLeagueContext()

  const [kind, setKind] = useState<Kind>('taunt')
  const [text, setText] = useState('')
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD.taunt)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Mêmes seuils de compliment que l'annonceur de la page Tirer : la page
  // affiche le barème du moment, recalibré sur la moyenne maison.
  const averageVolley = useMemo(() => averageVolleyOf(stats), [stats])
  const { good, big } = praiseThresholds(averageVolley)

  if (!configured) return <SetupNotice />
  if (loading) return <p className="empty">Chargement des punchlines…</p>
  if (error) return <p className="notice notice--error">Erreur : {error}</p>

  const taunts = punchlines.filter((p) => p.kind === 'taunt')
  const congrats = punchlines.filter((p) => p.kind === 'congrat')

  function selectKind(next: Kind) {
    setKind(next)
    setThreshold(DEFAULT_THRESHOLD[next])
    setFormError(null)
  }

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    const err = await addPunchline({ kind, text, threshold: Number(threshold) })
    setSaving(false)
    if (err) {
      setFormError(err)
      return
    }
    setFormError(null)
    setText('')
    toast('Punchline ajoutée — l’annonceur la connaît déjà', 'success')
  }

  async function remove(punchline: PunchlineRow) {
    if (!window.confirm(`Retirer « ${punchline.text} » du répertoire ?`)) return
    const err = await removePunchline(punchline.id)
    if (err) setFormError(err)
    else toast('Punchline retirée')
  }

  const customSections: { title: string; rows: PunchlineRow[]; empty: string }[] = [
    {
      title: 'Piques maison',
      rows: taunts,
      empty: 'Aucune pique maison — soyez le premier à chambrer.',
    },
    {
      title: 'Compliments maison',
      rows: congrats,
      empty: 'Aucun compliment maison — un peu de bienveillance, voyons.',
    },
  ]

  // Le répertoire d'origine, avec les conditions réelles de déclenchement.
  const builtInSections = [
    { title: 'Volée à zéro', trigger: 'volée à 0 point pile', lines: BUILT_IN_LINES.zero },
    {
      title: 'Volée faible',
      trigger: `volée à ${LOW_VOLLEY_MAX} points ou moins`,
      lines: BUILT_IN_LINES.low,
    },
    {
      title: 'Bonne volée',
      trigger: `dès ${Math.round(good)} points, 6 fois sur 10`,
      lines: BUILT_IN_LINES.good,
    },
    { title: 'Volée énorme', trigger: `dès ${Math.round(big)} points`, lines: BUILT_IN_LINES.big },
    {
      title: 'Bas du classement',
      trigger: 'affichée au tableau, sous le plus petit score du mois',
      lines: BUILT_IN_LINES.flop,
    },
  ]

  return (
    <div className="stack">
      <section>
        <h2 className="section-title">Nouvelle punchline</h2>
        <div className="chips" role="radiogroup" aria-label="Famille de punchline">
          <button
            type="button"
            role="radio"
            aria-checked={kind === 'taunt'}
            className={kind === 'taunt' ? 'chip chip--on' : 'chip'}
            onClick={() => selectKind('taunt')}
          >
            😈 Pique
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={kind === 'congrat'}
            className={kind === 'congrat' ? 'chip chip--on' : 'chip'}
            onClick={() => selectKind('congrat')}
          >
            👏 Compliment
          </button>
        </div>
        <p className="mode-hint">
          {kind === 'taunt'
            ? 'Dite quand la volée fait au plus ce seuil de points. En dessous de 21, elle rejoint le tirage des piques d’origine ; au-dessus, elle élargit la zone de chambrage.'
            : 'Dite dès que la volée atteint ce seuil de points — systématiquement, même quand le barème d’origine serait resté muet.'}
        </p>
        <form className="add-form" onSubmit={(e) => void submit(e)}>
          <input
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setFormError(null)
            }}
            placeholder={kind === 'taunt' ? 'Votre pique…' : 'Votre compliment…'}
            aria-label="Texte de la punchline"
            maxLength={200}
          />
          <input
            type="number"
            className="punchline-threshold"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            min={0}
            max={180}
            step={1}
            required
            aria-label="Seuil de déclenchement (points de la volée)"
            title="Seuil de déclenchement (points de la volée)"
          />
          <button type="submit" className="button-primary" disabled={saving || !text.trim()}>
            {saving ? '…' : 'Ajouter'}
          </button>
        </form>
      </section>

      {formError && (
        <p className="notice notice--error" role="alert">
          {formError}
        </p>
      )}

      {customSections.map((section) => (
        <section key={section.title}>
          <h2 className="section-title">{section.title}</h2>
          {section.rows.length === 0 ? (
            <p className="mode-hint">{section.empty}</p>
          ) : (
            <ul className="board">
              {section.rows.map((p) => (
                <li key={p.id} className="board__row board__row--manage">
                  <span className="board__who">
                    <span className="board__name">{p.text}</span>
                    <span className="board__record">{triggerLabel(p)}</span>
                  </span>
                  <span className="board__actions">
                    <button type="button" className="button-ghost" onClick={() => void remove(p)}>
                      Supprimer
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section>
        <h2 className="section-title">Le répertoire d’origine</h2>
        <p className="mode-hint">
          Les seuils de compliment suivent la moyenne maison
          {averageVolley !== null
            ? ` (${Math.round(averageVolley)} points par volée en ce moment)`
            : ' (30 points par volée tant qu’il n’y a pas d’historique)'}
          . Quand une punchline maison est éligible en même temps, elle sort une fois sur deux.
        </p>
        {builtInSections.map((section) => (
          <div key={section.title} className="punchline-card">
            <p className="punchline-card__title">
              {section.title} <span className="punchline-card__trigger">— {section.trigger}</span>
            </p>
            <ul className="punchline-card__lines">
              {section.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  )
}
