import type { Badge } from '@/lib/badges'

interface BadgeGridProps {
  badges: Badge[]
}

export function BadgeGrid({ badges }: BadgeGridProps) {
  return (
    <ul className="badges">
      {badges.map((badge) => (
        <li key={badge.id} className={badge.earned ? 'badge' : 'badge badge--locked'}>
          <span className="badge__icon" aria-hidden="true">
            {badge.icon}
          </span>
          <span className="badge__name">{badge.label}</span>
          <span className="badge__desc">{badge.description}</span>
        </li>
      ))}
    </ul>
  )
}
