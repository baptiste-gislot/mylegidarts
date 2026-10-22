'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'

type Tone = 'info' | 'success' | 'error'

interface Toast {
  id: number
  message: string
  tone: Tone
  /** En train de repartir : retiré une fois sa sortie jouée. */
  leaving?: boolean
}

const VISIBLE_MS = 2800
/** Durée de l'animation de sortie (toast-out dans globals.css). */
const LEAVE_MS = 200

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const push = useCallback((message: string, tone: Tone = 'info') => {
    const id = nextId.current++
    setToasts((current) => [...current.slice(-2), { id, message, tone }])
    setTimeout(() => {
      setToasts((current) => current.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
      setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), LEAVE_MS)
    }, VISIBLE_MS)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}${toast.leaving ? ' toast--leaving' : ''}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
