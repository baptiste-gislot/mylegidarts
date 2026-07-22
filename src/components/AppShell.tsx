'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/', label: 'Classement' },
  { href: '/tirer', label: 'Tirer' },
  { href: '/historique', label: 'Historique' },
  { href: '/joueurs', label: 'Joueurs' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="app">
      <header className="masthead">
        <p className="masthead__eyebrow">MyLegiTech</p>
        <h1 className="masthead__title">
          MyLegi<em>Darts</em>
        </h1>
      </header>

      <main className="content">{children}</main>

      <nav className="tabbar" aria-label="Navigation principale">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={pathname === tab.href ? 'tabbar__tab tabbar__tab--on' : 'tabbar__tab'}
            aria-current={pathname === tab.href ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
