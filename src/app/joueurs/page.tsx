'use client'

import { useState } from 'react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { SetupNotice } from '@/components/SetupNotice'
import { useLeague } from '@/lib/useLeague'

export default function JoueursPage() {
  const { players, sessions, loading, error, configured, addPlayer, removePlayer } = useLeague()
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
      setName('')
      setFormError(null)
    }
  }

  async function remove(playerId: string, playerName: string) {
    const count = sessions.filter((s) => s.player_id === playerId).length
    const warning =
      count > 0
        ? `Supprimer ${playerName} ? Ses ${count} session${count > 1 ? 's seront supprimées' : ' sera supprimée'} et le classement recalculé.`
        : `Supprimer ${playerName} ?`
    if (window.confirm(warning)) {
      const err = await removePlayer(playerId)
      if (err) setFormError(err)
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
            const count = sessions.filter((s) => s.player_id === player.id).length
            return (
              <li key={player.id} className="board__row">
                <PlayerAvatar name={player.name} />
                <span className="board__who">
                  <span className="board__name">{player.name}</span>
                  <span className="board__record">
                    {count} session{count > 1 ? 's' : ''}
                  </span>
                </span>
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
    </div>
  )
}
