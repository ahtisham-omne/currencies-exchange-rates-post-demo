import { cn } from '../lib/utils'

// Shared person avatar: a deterministic colour circle with the person's
// first + last initials, optionally followed by their full name. Used wherever
// a user is shown (e.g. "Created by") so every avatar looks and reads the same.

// Strip a parenthetical like "(You)" / "(Controller)" to get the display name.
export const cleanName = (name: string) => name.replace(/\s*\(.*?\)\s*/g, '').trim() || name

// First + last initials (up to two letters), e.g. "Ayesha Khan" → "AK".
export const initialsOf = (name: string) => {
  const parts = cleanName(name).split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const AVATAR_COLORS = ['#0A77FF', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2', '#4F46E5', '#BE185D', '#15803D', '#9333EA']
export const avatarColor = (name: string) => {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function Avatar({
  name, size = 28, showName = false, className,
}: {
  name: string
  size?: number
  showName?: boolean
  className?: string
}) {
  const circle = (
    <span
      className="rounded-full flex items-center justify-center font-semibold shrink-0 text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), backgroundColor: avatarColor(cleanName(name)) }}
      title={cleanName(name)}
    >
      {initialsOf(name)}
    </span>
  )
  if (!showName) return circle
  return (
    <span className={cn('flex items-center gap-1.5 min-w-0', className)}>
      {circle}
      <span className="text-sm text-fg truncate">{cleanName(name)}</span>
    </span>
  )
}
