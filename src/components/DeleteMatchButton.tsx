'use client'

import { useRouter } from 'next/navigation'
import { useDialog } from './Dialog'
import { useToast } from './Toaster'
import { DELETE_CODE_INPUT, forgetDeleteCode, rememberDeleteCode, storedDeleteCode } from '@/lib/deleteCode'
import { useLeagueContext } from '@/lib/LeagueProvider'

/**
 * Supprimer une partie, depuis sa page de détail : la liste de l'historique
 * sert à lire, pas à détruire. Une fois la partie partie, retour à l'historique.
 */
export function DeleteMatchButton({ sessionIds }: { sessionIds: string[] }) {
  const ask = useDialog()
  const toast = useToast()
  const router = useRouter()
  const { removeMatch } = useLeagueContext()

  async function remove() {
    const stored = storedDeleteCode()
    const answer = await ask({
      title: 'Supprimer cette partie ?',
      body: 'Elle disparaît de l’historique et les classements sont recalculés.',
      confirmLabel: 'Supprimer la partie',
      danger: true,
      input: stored ? undefined : DELETE_CODE_INPUT,
    })
    if (!answer) return
    const code = stored ?? answer.value.trim()
    const err = await removeMatch(sessionIds, code)
    if (err) {
      forgetDeleteCode()
      toast(err, 'error')
      return
    }
    rememberDeleteCode(code)
    toast('Partie supprimée, classement recalculé')
    router.push('/historique')
  }

  return (
    <button type="button" className="button-ghost button-ghost--danger match-delete" onClick={() => void remove()}>
      Supprimer la partie
    </button>
  )
}
