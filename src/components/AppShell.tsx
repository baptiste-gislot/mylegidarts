'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LeagueProvider } from '@/lib/LeagueProvider'
import { announcerVoice, setSoundsEnabled, soundsEnabled, warmUpVoices } from '@/lib/sound'
import { InstallBanner } from './InstallBanner'
import { ToastProvider } from './Toaster'

const TABS = [
  { href: '/', label: 'Classement' },
  { href: '/tirer', label: 'Tirer' },
  { href: '/historique', label: 'Historique' },
  { href: '/joueurs', label: 'Joueurs' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sounds, setSounds] = useState(true)
  const [voice, setVoice] = useState<string | null>(null)

  useEffect(() => {
    setSounds(soundsEnabled())
    // La liste des voix de Chromium se peuple après coup : on l'amorce tout de
    // suite pour que la première annonce ait déjà Piper sous la main.
    warmUpVoices()
    const refresh = () => setVoice(announcerVoice())
    refresh()
    window.speechSynthesis?.addEventListener('voiceschanged', refresh)
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', refresh)
  }, [])

  function toggleSounds() {
    setSoundsEnabled(!sounds)
    setSounds(!sounds)
  }

  return (
    <ToastProvider>
      <LeagueProvider>
        <div className="app">
        <header className="masthead">
          <h1 className="masthead__title">
            MyLegi<em>Darts</em>
          </h1>
          <p className="masthead__tagline">Mes fléchettes juridiques</p>
          {/* Le titre nomme la voix retenue : sur le kiosque, c'est le moyen le
              plus court de vérifier que Piper a bien été trouvé. */}
          <button
            type="button"
            className="masthead__sound"
            onClick={toggleSounds}
            aria-pressed={sounds}
            aria-label={sounds ? 'Couper les sons et l’annonceur' : 'Activer les sons et l’annonceur'}
            title={
              sounds
                ? `Sons activés — annonceur : ${voice ?? 'voix système par défaut'}`
                : 'Sons coupés'
            }
          >
            {sounds ? '🔊' : '🔇'}
          </button>
        </header>

        <InstallBanner />

        <main className="content">{children}</main>

        <nav className="tabbar" aria-label="Navigation principale">
          {TABS.map((tab) => {
            const active =
              pathname === tab.href ||
              (tab.href === '/' &&
                ['/profil', '/records', '/comparer'].some((p) => pathname.startsWith(p))) ||
              (tab.href === '/historique' && pathname.startsWith('/partie'))
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={active ? 'tabbar__tab tabbar__tab--on' : 'tabbar__tab'}
                aria-current={active ? 'page' : undefined}
              >
                {tab.label}
              </Link>
            )
          })}
          </nav>
        </div>
      </LeagueProvider>
    </ToastProvider>
  )
}
