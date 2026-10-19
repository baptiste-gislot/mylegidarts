'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { SetupNotice } from '@/components/SetupNotice'
import { useDialog } from '@/components/Dialog'
import { useToast } from '@/components/Toaster'
import {
  DELETE_CODE_INPUT,
  forgetDeleteCode,
  rememberDeleteCode,
  storedDeleteCode,
} from '@/lib/deleteCode'
import { useLeagueContext } from '@/lib/LeagueProvider'
import { checkSignatureFile, signatureUrl } from '@/lib/signatures'
import { playSignature } from '@/lib/sound'
import type { PlayerRow } from '@/lib/useLeague'

export default function JoueursPage() {
  const toast = useToast()
  const ask = useDialog()
  const {
    players,
    stats,
    loading,
    error,
    configured,
    addPlayer,
    removePlayer,
    setNickname,
    setSignature,
  } = useLeagueContext()

  // Choix du MP3 de signature : un seul input caché pour toute la liste,
  // le joueur visé est retenu le temps que le sélecteur de fichier revienne.
  const signatureInputRef = useRef<HTMLInputElement>(null)
  const signatureTargetRef = useRef<PlayerRow | null>(null)

  const sessionCount = (playerId: string) =>
    stats.filter((s) => s.player_id === playerId).reduce((sum, s) => sum + s.sessions_count, 0)
  const [name, setName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  if (!configured) return <SetupNotice />
  if (loading) return <p className="empty">Chargement des joueurs…</p>
  if (error) return <p className="notice notice--error">Erreur : {error}</p>

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const err = await addPlayer(name)
    if (err) {
      setFormError(err)
    } else {
      toast(`${name.trim()} rejoint la ligue`, 'success')
      setName('')
      setFormError(null)
    }
  }

  async function editNickname(playerId: string, playerName: string, current: string | null) {
    const answer = await ask({
      title: `Surnom de ${playerName}`,
      body: 'L’annonceur et le direct l’utilisent. Laissez vide pour le retirer.',
      confirmLabel: 'Enregistrer le surnom',
      input: { label: 'Surnom', initial: current ?? '', maxLength: 40 },
    })
    if (!answer) return
    const nickname = answer.value
    const err = await setNickname(playerId, nickname)
    if (err) setFormError(err)
    else toast(nickname.trim() ? `${playerName} devient « ${nickname.trim()} »` : 'Surnom retiré')
  }

  function pickSignature(player: PlayerRow) {
    signatureTargetRef.current = player
    signatureInputRef.current?.click()
  }

  async function onSignatureFile(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = '' // permet de re-sélectionner le même fichier plus tard
    const player = signatureTargetRef.current
    signatureTargetRef.current = null
    if (!file || !player) return
    const invalid = checkSignatureFile(file)
    if (invalid) {
      setFormError(invalid)
      return
    }
    const err = await setSignature(player.id, file)
    if (err) {
      setFormError(err)
    } else {
      setFormError(null)
      toast(`La signature de ${player.name} est en place — ▶ pour l’écouter`, 'success')
    }
  }

  function listenSignature(player: PlayerRow) {
    const url = player.signature_path ? signatureUrl(player.signature_path) : null
    if (url) void playSignature(url)
  }

  async function removeSignature(player: PlayerRow) {
    const answer = await ask({
      title: `Retirer la signature de ${player.name} ?`,
      body: 'Son entrée en piste se fera sans musique.',
      confirmLabel: 'Retirer la signature',
      danger: true,
    })
    if (!answer) return
    const err = await setSignature(player.id, null)
    if (err) setFormError(err)
    else toast(`${player.name} entrera désormais en silence`)
  }

  async function remove(playerId: string, playerName: string) {
    const count = sessionCount(playerId)
    const stored = storedDeleteCode()
    const answer = await ask({
      title: `Supprimer ${playerName} ?`,
      body:
        count > 0
          ? `${count > 1 ? `Ses ${count} scores de partie sont supprimés` : 'Son score de partie est supprimé'} aussi, et les classements sont recalculés.`
          : 'Aucune partie jouée pour l’instant.',
      confirmLabel: 'Supprimer le joueur',
      danger: true,
      input: stored ? undefined : DELETE_CODE_INPUT,
    })
    if (!answer) return
    const code = stored ?? answer.value.trim()
    const err = await removePlayer(playerId, code)
    if (err) {
      forgetDeleteCode()
      setFormError(err)
    } else {
      rememberDeleteCode(code)
      toast(`${playerName} quitte la ligue`)
    }
  }

  return (
    <div className="stack">
      <form className="add-form" onSubmit={(e) => void submit(e)}>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setFormError(null)
          }}
          placeholder="Nom du joueur"
          aria-label="Nom du joueur"
          maxLength={24}
        />
        <button type="submit" className="button-primary" disabled={!name.trim()}>
          Ajouter
        </button>
      </form>

      {formError && (
        <p className="notice notice--error" role="alert">
          {formError}
        </p>
      )}

      <input
        ref={signatureInputRef}
        type="file"
        accept="audio/mpeg,.mp3"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => void onSignatureFile(e)}
      />

      {players.length === 0 ? (
        <div className="empty">
          <p className="empty__title">Personne à la ligne de tir</p>
          <p>Ajoutez vos premiers joueurs pour lancer la saison.</p>
        </div>
      ) : (
        <ul className="board">
          {players.map((player) => {
            const count = sessionCount(player.id)
            return (
              <li key={player.id} className="board__row board__row--manage">
                <PlayerAvatar name={player.name} />
                <span className="board__who">
                  <span className="board__name">
                    {player.name}
                    {player.nickname && <em className="board__nickname"> « {player.nickname} »</em>}
                  </span>
                  <span className="board__record">
                    {count} partie{count > 1 ? 's' : ''}
                  </span>
                </span>
                <span className="board__actions">
                  <button
                    type="button"
                    className="button-ghost"
                    title={
                      player.signature_path
                        ? `Remplacer la signature sonore de ${player.name} (MP3)`
                        : `Ajouter une signature sonore à ${player.name} (MP3, jouée à son entrée en piste)`
                    }
                    aria-label={
                      player.signature_path
                        ? `Remplacer la signature sonore de ${player.name}`
                        : `Ajouter une signature sonore à ${player.name}`
                    }
                    onClick={() => pickSignature(player)}
                  >
                    🎵
                  </button>
                  {player.signature_path && (
                    <>
                      <button
                        type="button"
                        className="button-ghost"
                        title={`Écouter la signature de ${player.name}`}
                        aria-label={`Écouter la signature de ${player.name}`}
                        onClick={() => listenSignature(player)}
                      >
                        ▶
                      </button>
                      <button
                        type="button"
                        className="button-ghost"
                        title={`Retirer la signature de ${player.name}`}
                        aria-label={`Retirer la signature de ${player.name}`}
                        onClick={() => void removeSignature(player)}
                      >
                        🔇
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => void editNickname(player.id, player.name, player.nickname)}
                  >
                    Surnom
                  </button>
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => void remove(player.id, player.name)}
                  >
                    Supprimer
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <Link href="/punchlines" className="button-ghost invite-link">
        Punchlines de l’annonceur
      </Link>

      <Link href="/inviter" className="button-ghost invite-link">
        Afficher le QR code d’installation
      </Link>
    </div>
  )
}
