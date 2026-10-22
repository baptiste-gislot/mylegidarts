'use client'

import { useState } from 'react'
import { PLAYERS_LINKS, SectionNav } from '@/components/SectionNav'
import { SetupNotice } from '@/components/SetupNotice'
import { useDialog } from '@/components/Dialog'
import { useToast } from '@/components/Toaster'
import { useLeagueContext } from '@/lib/LeagueProvider'
import type { Punchline } from '@/lib/trashTalk'
import type { PunchlineRow } from '@/lib/useLeague'

type Kind = Punchline['kind']

/** Seuil proposé à la sélection d'une famille : bas pour piquer, haut pour saluer. */
const DEFAULT_THRESHOLD: Record<Kind, string> = { taunt: '20', congrat: '60', flop: '0' }

const KIND_HINT: Record<Kind, string> = {
  taunt:
    'Dite quand la volée fait au plus ce seuil de points. Toutes les piques éligibles partent dans le même tirage au sort.',
  congrat:
    'Dite dès que la volée atteint ce seuil de points. En cas de chevauchement, le compliment gagne sur la pique.',
  flop: 'Pas lue pendant la partie : affichée au tableau du classement, sous le plus petit score du mois.',
}

/** Condition de déclenchement d'une punchline, en toutes lettres. */
function triggerLabel(punchline: Punchline): string {
  if (punchline.kind === 'flop') return 'au tableau, sous le plus petit score du mois'
  if (punchline.kind === 'congrat') return `dès ${punchline.threshold} points`
  return punchline.threshold === 0
    ? 'volée à zéro pile'
    : `volée à ${punchline.threshold} points ou moins`
}

export default function PunchlinesPage() {
  const toast = useToast()
  const ask = useDialog()
  const {
    punchlines,
    loading,
    error,
    configured,
    addPunchline,
    updatePunchline,
    removePunchline,
  } = useLeagueContext()

  const [kind, setKind] = useState<Kind>('taunt')
  const [text, setText] = useState('')
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD.taunt)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Édition en place : une seule rangée à la fois.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editThreshold, setEditThreshold] = useState('0')

  if (!configured) return <SetupNotice />
  if (loading) return <p className="empty">Chargement des punchlines…</p>
  if (error) return <p className="notice notice--error">Erreur : {error}</p>

  const byThreshold = (a: PunchlineRow, b: PunchlineRow) =>
    a.threshold - b.threshold || a.text.localeCompare(b.text)
  const ofKind = (k: Kind) => punchlines.filter((p) => p.kind === k).sort(byThreshold)

  function selectKind(next: Kind) {
    setKind(next)
    setThreshold(DEFAULT_THRESHOLD[next])
    setFormError(null)
  }

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    const err = await addPunchline({
      kind,
      text,
      threshold: kind === 'flop' ? 0 : Number(threshold),
    })
    setSaving(false)
    if (err) {
      setFormError(err)
      return
    }
    setFormError(null)
    setText('')
    toast('Punchline ajoutée — l’annonceur la connaît déjà', 'success')
  }

  function startEdit(punchline: PunchlineRow) {
    setEditingId(punchline.id)
    setEditText(punchline.text)
    setEditThreshold(String(punchline.threshold))
    setFormError(null)
  }

  async function saveEdit(event: React.SubmitEvent<HTMLFormElement>, punchline: PunchlineRow) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    const err = await updatePunchline(
      punchline.id,
      editText,
      punchline.kind === 'flop' ? punchline.threshold : Number(editThreshold),
    )
    setSaving(false)
    if (err) {
      setFormError(err)
      return
    }
    setFormError(null)
    setEditingId(null)
    toast('Punchline modifiée')
  }

  async function remove(punchline: PunchlineRow) {
    const answer = await ask({
      title: 'Retirer cette punchline ?',
      body: `« ${punchline.text} » ne sera plus dite par l’annonceur.`,
      confirmLabel: 'Retirer la punchline',
      danger: true,
    })
    if (!answer) return
    const err = await removePunchline(punchline.id)
    if (err) setFormError(err)
    else toast('Punchline retirée')
  }

  const sections: { title: string; kind: Kind; empty: string }[] = [
    { title: 'Piques', kind: 'taunt', empty: 'Aucune pique — soyez le premier à chambrer.' },
    {
      title: 'Compliments',
      kind: 'congrat',
      empty: 'Aucun compliment — un peu de bienveillance, voyons.',
    },
    {
      title: 'Piques du tableau',
      kind: 'flop',
      empty: 'Aucune pique de tableau — le plus petit score du mois dort tranquille.',
    },
  ]

  return (
    <div className="stack">
      <SectionNav label="Joueurs" links={PLAYERS_LINKS} />

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
          <button
            type="button"
            role="radio"
            aria-checked={kind === 'flop'}
            className={kind === 'flop' ? 'chip chip--on' : 'chip'}
            onClick={() => selectKind('flop')}
          >
            🤡 Pique du tableau
          </button>
        </div>
        <p className="mode-hint">{KIND_HINT[kind]}</p>
        <form className="add-form" onSubmit={(e) => void submit(e)}>
          <input
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setFormError(null)
            }}
            placeholder={
              kind === 'taunt'
                ? 'Votre pique…'
                : kind === 'congrat'
                  ? 'Votre compliment…'
                  : 'Votre pique de tableau…'
            }
            aria-label="Texte de la punchline"
            maxLength={200}
          />
          {kind !== 'flop' && (
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
          )}
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

      <p className="mode-hint">
        Tout le répertoire vit ici, lignes d’origine comprises : à chaque volée, l’annonceur tire au
        hasard parmi les punchlines dont le seuil est atteint. Tout se modifie, tout se supprime.
      </p>

      {sections.map((section) => {
        const rows = ofKind(section.kind)
        return (
          <section key={section.kind}>
            <h2 className="section-title">{section.title}</h2>
            {rows.length === 0 ? (
              <p className="mode-hint">{section.empty}</p>
            ) : (
              <ul className="board">
                {rows.map((p) => (
                  <li key={p.id} className="board__row board__row--manage">
                    {editingId === p.id ? (
                      <form className="add-form" onSubmit={(e) => void saveEdit(e, p)}>
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => {
                            setEditText(e.target.value)
                            setFormError(null)
                          }}
                          aria-label="Texte de la punchline"
                          maxLength={200}
                          autoFocus
                        />
                        {p.kind !== 'flop' && (
                          <input
                            type="number"
                            className="punchline-threshold"
                            value={editThreshold}
                            onChange={(e) => setEditThreshold(e.target.value)}
                            min={0}
                            max={180}
                            step={1}
                            required
                            aria-label="Seuil de déclenchement (points de la volée)"
                            title="Seuil de déclenchement (points de la volée)"
                          />
                        )}
                        <button
                          type="submit"
                          className="button-primary"
                          disabled={saving || !editText.trim()}
                        >
                          {saving ? '…' : 'OK'}
                        </button>
                        <button
                          type="button"
                          className="button-ghost"
                          onClick={() => setEditingId(null)}
                        >
                          Annuler
                        </button>
                      </form>
                    ) : (
                      <>
                        <span className="board__who">
                          <span className="board__name board__name--quote">{p.text}</span>
                          <span className="board__record">{triggerLabel(p)}</span>
                        </span>
                        <span className="board__actions">
                          <button
                            type="button"
                            className="button-ghost"
                            onClick={() => startEdit(p)}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="button-ghost button-ghost--danger"
                            onClick={() => void remove(p)}
                          >
                            Supprimer
                          </button>
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
