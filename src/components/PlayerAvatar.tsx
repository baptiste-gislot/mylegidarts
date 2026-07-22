interface PlayerAvatarProps {
  name: string
  leader?: boolean
}

export function PlayerAvatar({ name, leader = false }: PlayerAvatarProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <span className={leader ? 'avatar avatar--bullseye' : 'avatar'} aria-hidden="true">
      {initials}
    </span>
  )
}
