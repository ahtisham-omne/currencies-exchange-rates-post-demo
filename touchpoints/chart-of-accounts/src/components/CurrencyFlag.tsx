import { cn } from '../lib/utils'
import type { CurrencyMeta } from '../lib/currencies'
import { FlagImage, flagEmojiCode } from './FlagImage'

/* ──────────────────────────────────────────────────────────────────
 * A CURRENCY'S FLAG
 *
 * Always a picture, never the emoji. Windows ships no flag emoji: 🇺🇸 draws
 * there as the two letters "US", so a picker or a Currency column read as a row
 * of stray initials. Design review, 2026-09-30, on Eli's Windows machine: *"It's
 * not showing the flag? ... not the flag, but the symbol."* Mahad, 2026-10-05,
 * finding the last emoji in the journal entry's Currency field: *"Can you make
 * sure we use these ones everywhere through out the module?"*
 *
 * `CURRENCY_META` still keys each flag as its emoji; FlagImage reads the two
 * letters out of it. Nothing prints the emoji itself - a list that can only hold
 * text, such as a Select option, takes the picture through `data-icon`.
 * ────────────────────────────────────────────────────────────────── */

export function CurrencyFlag({ meta, className }: { meta: Pick<CurrencyMeta, 'code' | 'flag'>; className?: string }) {
  return (
    <span className={cn('inline-flex items-center', className)} aria-hidden>
      <FlagImage code={flagEmojiCode(meta.flag)} />
    </span>
  )
}
