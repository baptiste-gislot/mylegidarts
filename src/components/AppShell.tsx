'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LeagueProvider } from '@/lib/LeagueProvider'
import { setSoundsEnabled, soundsEnabled } from '@/lib/sound'
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

  useEffect(() => {
    setSounds(soundsEnabled())
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
          <p className="masthead__eyebrow">Fléchettes</p>
          <h1 className="masthead__title">
            MyLegi<em>Darts</em>
          </h1>
          <button
            type="button"
            className="masthead__sound"
            onClick={toggleSounds}
            aria-pressed={sounds}
            aria-label={sounds ? 'Couper les sons et l’annonceur' : 'Activer les sons et l’annonceur'}
            title={sounds ? 'Sons activés' : 'Sons coupés'}
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
              (tab.href === '/' && pathname.startsWith('/profil')) ||
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
