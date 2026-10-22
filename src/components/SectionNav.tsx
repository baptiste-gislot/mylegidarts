'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export interface SectionLink {
  href: string
  label: string
  /** Pastille rouge « en direct » à côté du libellé. */
  live?: boolean
}

/** Les sous-pages d'un onglet, toujours au même endroit : en tête de page. */
export function SectionNav({ label, links }: { label: string; links: SectionLink[] }) {
  const pathname = usePathname()

  return (
    <nav className="segmented" aria-label={label}>
      {links.map((link) => {
        const active = pathname === link.href
        return (
          <Link
            key={link.href}
            href={link.href}
            className={active ? 'segmented__option segmented__option--on' : 'segmented__option'}
            aria-current={active ? 'page' : undefined}
          >
            {link.live && <span className="live-dot" aria-label="en direct" />}
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}

export const RANKING_LINKS: SectionLink[] = [
  { href: '/', label: 'Niveau' },
  { href: '/defi', label: 'Défi du mois' },
  { href: '/records', label: 'Records' },
]

/** Historique : la pastille « en direct » s'allume quand une partie est en cours. */
export function historyLinks(live: boolean): SectionLink[] {
  return [
    { href: '/historique', label: 'Parties' },
    { href: '/live', label: 'En direct', live },
  ]
}

export const PLAYERS_LINKS: SectionLink[] = [
  { href: '/joueurs', label: 'Équipe' },
  { href: '/punchlines', label: 'Punchlines' },
  { href: '/inviter', label: 'Inviter' },
]
