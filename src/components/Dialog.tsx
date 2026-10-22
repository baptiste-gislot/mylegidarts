'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export interface AskOptions {
  title: string
  body?: string
  /** Le verbe du bouton : il dit exactement ce qui va se passer. */
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  /** Un champ à remplir avant de confirmer (surnom, code de suppression…). */
  input?: {
    label: string
    initial?: string
    placeholder?: string
    secret?: boolean
    required?: boolean
    maxLength?: number
  }
}

/** null si la personne annule ; sinon la valeur saisie ('' sans champ). */
type Ask = (options: AskOptions) => Promise<{ value: string } | null>

const DialogContext = createContext<Ask>(async () => null)

/** Remplace window.confirm / window.prompt par un dialogue à l'image de l'app. */
export function useDialog(): Ask {
  return useContext(DialogContext)
}

interface Pending {
  options: AskOptions
  resolve: (answer: { value: string } | null) => void
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)

  const ask = useCallback<Ask>(
    (options) =>
      new Promise((resolve) => {
        setPending({ options, resolve })
      }),
    [],
  )

  const settle = (answer: { value: string } | null) => {
    pending?.resolve(answer)
    setPending(null)
  }

  return (
    <DialogContext.Provider value={ask}>
      {children}
      {pending && <AskDialog key={pending.options.title} options={pending.options} onSettle={settle} />}
    </DialogContext.Provider>
  )
}

function AskDialog({ options, onSettle }: { options: AskOptions; onSettle: (answer: { value: string } | null) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(options.input?.initial ?? '')
  /** La réponse, gardée le temps que la boîte reparte par où elle est venue. */
  const [leaving, setLeaving] = useState<{ answer: { value: string } | null } | null>(null)
  const missing = options.input?.required === true && value.trim() === ''

  const settle = (answer: { value: string } | null) => {
    if (leaving) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) onSettle(answer)
    else setLeaving({ answer })
  }

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className={leaving ? 'ask ask--closing' : 'ask'}
      aria-labelledby="ask-title"
      onCancel={(e) => {
        // Échap : on referme nous-mêmes pour résoudre la promesse.
        e.preventDefault()
        settle(null)
      }}
      onClick={(e) => {
        // Un clic sur le fond (hors de la boîte) vaut « annuler ».
        if (e.target === ref.current) settle(null)
      }}
      onAnimationEnd={(e) => {
        if (leaving && e.animationName === 'ask-out') onSettle(leaving.answer)
      }}
    >
      <form
        method="dialog"
        className="ask__box"
        onSubmit={(e) => {
          e.preventDefault()
          if (!missing) settle({ value })
        }}
      >
        <h2 id="ask-title" className="ask__title">
          {options.title}
        </h2>
        {options.body && <p className="ask__body">{options.body}</p>}
        {options.input && (
          <label className="ask__field">
            <span>{options.input.label}</span>
            <input
              type={options.input.secret ? 'password' : 'text'}
              value={value}
              placeholder={options.input.placeholder}
              maxLength={options.input.maxLength}
              autoComplete="off"
              autoFocus
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
        )}
        <div className="ask__actions">
          <button type="button" className="button-ghost" onClick={() => settle(null)}>
            {options.cancelLabel ?? 'Annuler'}
          </button>
          <button
            type="submit"
            className={options.danger ? 'ask__confirm ask__confirm--danger' : 'ask__confirm'}
            disabled={missing}
            autoFocus={!options.input}
          >
            {options.confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  )
}
