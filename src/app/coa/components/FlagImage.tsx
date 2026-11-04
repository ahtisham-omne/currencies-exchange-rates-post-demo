// Ported from chart-of-accounts-v2.1/src/components/FlagImage.tsx; adapted: draws flag-icons' 4:3 artwork bundled in public/flags/4x3 instead of flagcdn's native-ratio PNGs, which the 4:3 box cropped (Canada lost most of its red bands).
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
 * So a flag is a picture (originally from flagcdn.com; see flagUrl below).
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

/* Every flag is drawn in a 4:3 box. flagcdn's PNGs keep each flag's own ratio
   (Canada 2:1, Switzerland 1:1), so `object-cover` cropped them - Canada lost most
   of its red bands. flag-icons draws each flag for 4:3, so nothing is cut; the set
   ships with the app (public/flags, MIT), which also means flags draw offline. */
const FLAG_FILE: Record<string, string> = {
  ac: 'sh-ac', // Ascension Island
  ta: 'sh-ta', // Tristan da Cunha
}
const flagUrl = (code: string) => {
  const c = code.toLowerCase()
  return `${import.meta.env.BASE_URL}flags/4x3/${FLAG_FILE[c] ?? c}.svg`
}

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
      src={flagUrl(code)}
      alt=""
      aria-hidden
      loading="lazy"
      onError={() => setFailed(true)}
      data-flag={code.toLowerCase()}
      className={cn(box, 'object-cover ring-1 ring-black/10', className)}
    />
  )
}
