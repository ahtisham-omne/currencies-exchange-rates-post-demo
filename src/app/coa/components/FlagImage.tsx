import { useState } from 'react'
import { cn } from '../lib/utils'

/* ──────────────────────────────────────────────────────────────────
 * A FLAG THAT DRAWS ON EVERY COMPUTER
 *
 * Flags were emoji, and Windows ships no flag emoji: 🇺🇸 draws there as the
 * letters "US". The currency columns fell back to the currency's symbol on
 * Windows; the country picker in Guided setup showed letters. Design review,
 * 2026-10-02 - Eli: *"the Macintosh is not the primary computer for business
 * operators. So you must make it work for Windows ... Just make it so that it's
 * functional across the board, regardless of what computer you're on."*
 *
 * So a flag is a picture, from flagcdn.com - the same source the Currencies and
 * exchange rates module draws its flags from, so a flag looks the same in both.
 * Sized in ems, so it sits in a line of text at that text's size. Where the
 * picture can't load (offline, say) the two letters stand in, in a chip the
 * flag's size, rather than a broken image.
 * ────────────────────────────────────────────────────────────────── */

/** The two letters a flag emoji spells, lower case: '🇪🇺' → 'eu'. Empty for anything else. */
export function flagEmojiCode(emoji: string): string {
  const points = [...emoji].map(ch => ch.codePointAt(0) ?? 0)
  if (points.length !== 2 || points.some(p => p < 0x1f1e6 || p > 0x1f1ff)) return ''
  return points.map(p => String.fromCharCode(p - 0x1f1e6 + 97)).join('')
}

const flagUrl = (code: string, width: number) => `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`

export function FlagImage({ code, className }: {
  /** ISO 3166 alpha-2, or EU. Either case. */
  code: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const box = 'inline-block align-[-0.12em] w-[1.33em] h-[1em] rounded-[0.15em] shrink-0'
  if (!code || failed) {
    return (
      <span aria-hidden className={cn(box, 'inline-flex items-center justify-center bg-bg-subtle border border-border text-fg-muted uppercase', className)}
        style={{ fontSize: '0.55em', fontWeight: 700, width: '2.4em', height: '1.8em' }}>
        {code}
      </span>
    )
  }
  return (
    <img
      src={flagUrl(code, 40)}
      srcSet={`${flagUrl(code, 80)} 2x`}
      alt=""
      aria-hidden
      loading="lazy"
      onError={() => setFailed(true)}
      data-flag={code.toLowerCase()}
      className={cn(box, 'object-cover ring-1 ring-black/10', className)}
    />
  )
}
