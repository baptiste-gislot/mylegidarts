'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { SetupNotice } from '@/components/SetupNotice'
import { useToast } from '@/components/Toaster'
import { askDeleteCode, forgetDeleteCode, rememberDeleteCode } from '@/lib/deleteCode'
import { useLeagueContext } from '@/lib/LeagueProvider'

export default function JoueursPage() {
  const toast = useToast()
  const { players, stats, loading, error, configured, addPlayer, removePlayer, setNickname } =
    useLeagueContext()

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
    const nickname = window.prompt(
      `Surnom de ${playerName} (laissez vide pour le retirer) :`,
      current ?? '',
    )
    if (nickname === null) return
    const err = await setNickname(playerId, nickname)
    if (err) setFormError(err)
    else toast(nickname.trim() ? `${playerName} devient « ${nickname.trim()} »` : 'Surnom retiré')
  }

  async function remove(playerId: string, playerName: string) {
    const count = sessionCount(playerId)
    const warning =
      count > 0
        ? `Supprimer ${playerName} ? Ses ${count} session${count > 1 ? 's seront supprimées' : ' sera supprimée'} et le classement recalculé.`
        : `Supprimer ${playerName} ?`
    if (!window.confirm(warning)) return
    const code = askDeleteCode()
    if (code === null) return
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
              <li key={player.id} className="board__row">
                <PlayerAvatar name={player.name} />
                <span className="board__who">
                  <span className="board__name">
                    {player.name}
                    {player.nickname && <em className="board__nickname"> « {player.nickname} »</em>}
                  </span>
                  <span className="board__record">
                    {count} session{count > 1 ? 's' : ''}
                  </span>
                </span>
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
              </li>
            )
          })}
        </ul>
      )}

      <Link href="/inviter" className="button-ghost invite-link">
        Afficher le QR code d’installation →
      </Link>
    </div>
  )
}
