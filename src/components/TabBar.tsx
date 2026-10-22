'use client'

import { useLayoutEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** Onglets principaux, avec les pages qu'on atteint depuis chacun d'eux. */
const TABS = [
  { href: '/tirer', label: 'Jouer', also: [], icon: 'target' },
  { href: '/', label: 'Classements', also: ['/defi', '/records', '/profil', '/comparer'], icon: 'podium' },
  { href: '/tournois', label: 'Tournois', also: ['/tournois/'], icon: 'trophy' },
  { href: '/historique', label: 'Historique', also: ['/partie', '/live'], icon: 'clock' },
  { href: '/joueurs', label: 'Joueurs', also: ['/punchlines', '/inviter'], icon: 'people' },
] as const

type IconName = (typeof TABS)[number]['icon']

/** Pictos au trait, 24 × 24 : affichés sur téléphone au-dessus du libellé. */
const ICONS: Record<IconName, React.ReactNode> = {
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  podium: <path d="M3 21h18M4 21v-6h5v6M9.5 21V9h5v12M15 21v-4h5v4M12 3.5l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 5.6l2-.3z" />,
  trophy: <path d="M8 21h8M12 16v5M7 4h10v5a5 5 0 0 1-10 0zM17 6h3v1.5A3.5 3.5 0 0 1 16.5 11M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.2 3.2 0 0 1 0 6.4M18 14a5.5 5.5 0 0 1 3.5 6" />
    </>
  ),
}

/**
 * La barre d'onglets. Le bandeau jaune de l'onglet courant est un seul
 * élément qui glisse d'un onglet à l'autre : on voit d'où l'on vient. Avant
 * la première mesure (et sans JavaScript), chaque onglet porte son propre
 * bandeau, à la même place.
 */
export function TabBar() {
  const pathname = usePathname()
  const navRef = useRef<HTMLElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)

  const placeAt = (tab: HTMLElement) => {
    const indicator = indicatorRef.current
    if (!indicator) return
    indicator.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop}px)`
    indicator.style.width = `${tab.offsetWidth}px`
    indicator.style.height = `${tab.offsetHeight}px`
  }

  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return
    nav.querySelector('[data-pending]')?.removeAttribute('data-pending')

    const place = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]')
      if (!active) {
        nav.removeAttribute('data-indicator')
        return
      }
      placeAt(active)
      nav.setAttribute('data-indicator', 'on')
    }

    place()
    // Le premier placement se fait sans glissement ; les suivants glissent.
    const frame = requestAnimationFrame(() => nav.setAttribute('data-animate', 'on'))
    const observer = new ResizeObserver(place)
    observer.observe(nav)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [pathname])

  return (
    <nav ref={navRef} className="tabbar" aria-label="Navigation principale">
      <span ref={indicatorRef} className="tabbar__indicator" aria-hidden="true" />
      {TABS.map((tab) => {
        const active =
          pathname === tab.href || tab.also.some((prefix: string) => pathname.startsWith(prefix))
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active ? 'tabbar__tab tabbar__tab--on' : 'tabbar__tab'}
            aria-current={active ? 'page' : undefined}
            onClick={(e) => {
              // Le bandeau part dès le clic, sans attendre que la page change.
              if (active || e.metaKey || e.ctrlKey || e.shiftKey) return
              navRef.current?.querySelector('[data-pending]')?.removeAttribute('data-pending')
              e.currentTarget.setAttribute('data-pending', '')
              placeAt(e.currentTarget)
            }}
          >
            <svg
              className="tabbar__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {ICONS[tab.icon]}
            </svg>
            <span className="tabbar__label">{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
