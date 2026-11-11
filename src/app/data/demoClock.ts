// The demo's clock. The seed data was written against fixed days; at load it is
// moved forward so that whenever the prototype is opened it reads as current:
// the rate provider last synced today (or yesterday, before 7:30 PM in
// Pakistan), the corporate rates took effect at the start of a recent month,
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

/** The last daily sync from the rate provider: 14:30 UTC (7:30 PM in Pakistan)
 *  today, or yesterday's when today's is still to come. */
export const LAST_SYNC: string = (() => {
  const now = Date.now()
  let t = dayMs(new Date(now).toISOString()) + (14 * 60 + 30) * 60_000
  if (t > now) t -= DAY
  return new Date(t).toISOString().replace('.000Z', 'Z')
})()

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
