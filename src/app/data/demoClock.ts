// The demo's clock. The seed data was written against fixed days; at load it is
// moved forward so that whenever the prototype is opened it reads as current:
// the rate provider read today's rates at the start of the day, the corporate
// rates took effect at the start of a recent month,
// and every open transaction falls in the last three months. Each timeline
// keeps its own order, so nothing is priced at a rate before that rate existed.

const DAY = 86_400_000
const dayMs = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Whole days from ISO day `a` to ISO day `b`. */
export const daysBetween = (a: string, b: string) => Math.round((dayMs(b) - dayMs(a)) / DAY)

/** An ISO day or date-time moved by whole days; a date-time keeps its time and zone. */
export function shiftIso(iso: string, days: number): string {
  if (!days) return iso
  const moved = isoDay(dayMs(iso) + days * DAY)
  return moved + iso.slice(10)
}

/** Today's read from the rate provider, at the start of the day (00:00 UTC,
 *  5:00 AM in Pakistan). Eli's ruling (26 Nov 2026): one daily market rate per
 *  currency per day, read once a day and fixed for that date, so every entry
 *  dated today has today's rate from the start of the day. It was 13:00 UTC
 *  (6:00 PM, the BA's activity log's sync time), which read yesterday's rates
 *  until the evening. */
export const LAST_SYNC: string = new Date(dayMs(new Date().toISOString())).toISOString().replace('.000Z', 'Z')

/** The day of the last sync: the mid-market rates' effective date and the end of their history. */
export const SYNC_DAY = LAST_SYNC.slice(0, 10)

/* Corporate rates take effect on the 1st of the month that holds the day 40
   days before the sync: 40 to 70 days ago. Every transaction priced at one is
   dated within the last 40 days, so it always comes after the rate it used. */
const effective = new Date(dayMs(SYNC_DAY) - 40 * DAY)
export const CORPORATE_EFFECTIVE = isoDay(Date.UTC(effective.getUTCFullYear(), effective.getUTCMonth(), 1))
/** Set up a little over two weeks before taking effect. */
export const CORPORATE_CREATED = shiftIso(CORPORATE_EFFECTIVE, -17)
/** The note the team left on them: the quarter they cover ("Q4 2026 corporate rate"). */
export const CORPORATE_NOTE = `Q${Math.floor((Number(CORPORATE_EFFECTIVE.slice(5, 7)) - 1) / 3) + 1} ${CORPORATE_EFFECTIVE.slice(0, 4)} corporate rate`

/* The Currency Library's seed was written with its latest open transaction on
   2025-12-10. Every currency date (transactions, payments, the library's setup
   and its history) moves by the same number of days, so that one lands on the
   day before the last sync and the rest keep their spacing behind it. */
export const CURRENCY_SEED_SHIFT = daysBetween('2025-12-10', SYNC_DAY) - 1
