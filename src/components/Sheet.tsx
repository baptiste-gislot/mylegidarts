'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Une feuille d'actions : glissée depuis le bas sur téléphone, posée au centre
 * sur grand écran. Échap, un clic à côté ou « Fermer » la renvoient par où
 * elle est venue. `onClose` est appelé une fois la sortie terminée.
 */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  function close() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) onClose()
    else setClosing(true)
  }

  return (
    <dialog
      ref={ref}
      className={closing ? 'sheet sheet--closing' : 'sheet'}
      aria-labelledby="sheet-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => {
        if (e.target === ref.current) close()
      }}
      onAnimationEnd={(e) => {
        if (closing && e.animationName === 'sheet-out') onClose()
      }}
    >
      <div className="sheet__panel">
        <div className="sheet__head">
          <h2 id="sheet-title" className="sheet__title">
            {title}
          </h2>
          {subtitle && <p className="sheet__subtitle">{subtitle}</p>}
        </div>
        {/* Chaque action ferme la feuille avant d'agir : on ne garde pas une
            feuille ouverte sous un dialogue de confirmation. */}
        <div
          className="sheet__actions"
          onClickCapture={(e) => {
            if ((e.target as HTMLElement).closest('button, a')) close()
          }}
        >
          {children}
        </div>
        <button type="button" className="button-secondary sheet__close" onClick={close}>
          Fermer
        </button>
      </div>
    </dialog>
  )
}
