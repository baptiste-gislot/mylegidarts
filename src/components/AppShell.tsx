'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LeagueProvider } from '@/lib/LeagueProvider'
import { announcerVoice, setSoundsEnabled, soundsEnabled, warmUpVoices } from '@/lib/sound'
import { DialogProvider } from './Dialog'
import { IdleWatcher } from './IdleScreen'
import { InstallBanner } from './InstallBanner'
import { ToastProvider } from './Toaster'

/** Onglets principaux, avec les pages qu'on atteint depuis chacun d'eux. */
const TABS = [
  { href: '/tirer', label: 'Jouer', also: [] },
  { href: '/', label: 'Classements', also: ['/profil', '/records', '/comparer'] },
  { href: '/tournois', label: 'Tournois', also: ['/tournois/'] },
  { href: '/historique', label: 'Historique', also: ['/partie', '/live'] },
  { href: '/joueurs', label: 'Joueurs', also: ['/punchlines', '/inviter'] },
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
      <DialogProvider>
        <LeagueProvider>
          <div className="app">
            <header className="masthead">
              <h1 className="masthead__title">
                <span>MyLegi</span>
                <span>Darts</span>
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
                  pathname === tab.href || tab.also.some((prefix) => pathname.startsWith(prefix))
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
          <IdleWatcher />
        </LeagueProvider>
      </DialogProvider>
    </ToastProvider>
  )
}
