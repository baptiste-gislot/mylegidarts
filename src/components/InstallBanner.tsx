'use client'

import { useEffect, useState } from 'react'

const DISMISS_KEY = 'mylegidarts-install-banner-vu'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Bandeau d'installation PWA, sur mobile uniquement :
 * - Android/Chrome : bouton natif via beforeinstallprompt
 * - iOS Safari : instructions (pas d'API d'installation)
 * Masqué si l'app est déjà installée ou si le bandeau a été fermé.
 */
export function InstallBanner() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
    if (standalone) return
    const mobile = window.matchMedia('(pointer: coarse)').matches
    if (!mobile) return

    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      setShowIosHint(true)
      return
    }

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, 'oui')
    setInstallPrompt(null)
    setShowIosHint(false)
  }

  async function install() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') dismiss()
    else setInstallPrompt(null)
  }

  if (!installPrompt && !showIosHint) return null

  return (
    <div className="install-banner" role="region" aria-label="Installer l’application">
      <span className="install-banner__icon" aria-hidden="true">
        🎯
      </span>
      <span className="install-banner__text">
        {showIosHint ? (
          <>
            Installez MyLegiDarts : bouton <strong>Partager</strong> puis{' '}
            <strong>« Sur l’écran d’accueil »</strong>.
          </>
        ) : (
          <>Installez MyLegiDarts sur votre téléphone.</>
        )}
      </span>
      {installPrompt && (
        <button type="button" className="install-banner__cta" onClick={() => void install()}>
          Installer
        </button>
      )}
      <button type="button" className="install-banner__close" onClick={dismiss} aria-label="Fermer">
        ✕
      </button>
    </div>
  )
}
