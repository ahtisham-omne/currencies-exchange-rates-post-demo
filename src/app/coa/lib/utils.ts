import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

// Currency symbol per ISO code; falls back to the code itself for currencies
// without a common symbol. Matches the table cells' symbol-first style
// ("$ 481,200" rather than "USD 481,200").
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', HKD: 'HK$', JPY: '¥', CNY: 'CN¥', INR: '₹', PKR: '₨',
  AUD: 'A$', CAD: 'C$', NZD: 'NZ$', SGD: 'S$', CHF: 'CHF', BRL: 'R$', MXN: 'MX$',
  THB: '฿', TRY: '₺', ZAR: 'R', SEK: 'kr', NOK: 'kr', DKK: 'kr',
}
// Sign precedes the currency symbol: "-$ 5,000", not "$ -5,000".
export function fmtCurrency(n: number, code = 'USD') {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const f = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(abs)
  return `${sign}${CURRENCY_SYMBOLS[code] ?? code} ${f}`
}

/* The same money, to the cent. The chart and the registers round to whole
   dollars because a column of them is read for shape, not for change - but an
   entry being balanced is decided at the cent, so anywhere the reader is being
   told what is wrong with an amount has to say the cents out loud.

   Mahad, 2026-09-24: *"A one-cent imbalance (12.34 debit vs 12.33 credit)
   blocks posting correctly but shows 'Out of balance by $0.'"* Rounded, the
   shortfall disappears and the two totals become the same number, so the form
   refuses an entry that looks, on its face, already balanced. */
export function fmtCurrencyExact(n: number, code = 'USD') {
  const sign = n < 0 ? '-' : ''
  const f = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n))
  return `${sign}${CURRENCY_SYMBOLS[code] ?? code} ${f}`
}

export function fmtNumber(n: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)
}

export function currencySymbol(code = 'USD') {
  return CURRENCY_SYMBOLS[code] ?? code
}

// Digits and at most one decimal point, capped at two places. Runs on every
// keystroke, so partial input like "12." has to survive untouched. Leading
// zeros go, or grouping would render 00012 as "00,012" - but a lone zero stays,
// since it's how "0.50" starts.
export function sanitizeAmount(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const dot = cleaned.indexOf('.')
  const int = (dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(/^0+(?=\d)/, '')
  if (dot === -1) return int
  return `${int}.${cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2)}`
}

// Thousands separators for an amount that is still being typed. Intl would
// round "12." to "12" and drop a trailing zero, so the integer part is grouped
// by hand and everything from the point on is left exactly as entered.
export function groupAmount(sanitized: string) {
  const dot = sanitized.indexOf('.')
  const int = dot === -1 ? sanitized : sanitized.slice(0, dot)
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return dot === -1 ? grouped : grouped + sanitized.slice(dot)
}

/* Two shapes arrive here and they mean different things. `2026-09-24` is a
   calendar day - the day something was posted on, the day a period ends - and it
   means that day everywhere on earth. A full timestamp is an instant, and the
   reader should see it in their own zone.

   Told apart because the language does not tell them apart for us: `new
   Date('2026-09-24')` is specified to parse as UTC midnight, so rendering it
   locally puts it on the 23rd for every reader west of Greenwich. A posting date
   a day early is a posting in the wrong period, so a day is parsed as local
   midnight and an instant is left alone. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function fmtDate(s: string) {
  try {
    const d = new Date(DATE_ONLY.test(s) ? `${s}T00:00:00` : s)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return s }
}

/* A moment somebody did something - created a record, changed it - as the date
   and the time of day. Design review, 2026-10-02, Eli on the audit columns:
   *"Dates, times, and whose."* A bare calendar day has no time to give, so it
   reads as the date alone rather than as midnight. */
export function fmtDateTime(s: string) {
  if (!s) return ''
  // The module's date-and-time format, 11/11/2026 5:39 PM, spelled out by hand so
  // no locale adds "at", a comma or a narrow space before PM. A bare day has no
  // time to give, so it reads as 11/11/2026 alone rather than as midnight.
  const d = new Date(DATE_ONLY.test(s) ? `${s}T00:00:00` : s)
  if (Number.isNaN(d.getTime())) return s
  const two = (n: number) => String(n).padStart(2, '0')
  const day = `${two(d.getMonth() + 1)}/${two(d.getDate())}/${d.getFullYear()}`
  if (DATE_ONLY.test(s)) return day
  const h = d.getHours()
  return `${day} ${h % 12 || 12}:${two(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`
}

/* The calendar day a moment fell on, in the reader's zone, so a From/To date
   filter compares days with days. Slicing the ISO string would answer with
   UTC's day - the same trap `todayIso` describes. */
export function localDayOf(s: string) {
  if (!s) return ''
  if (DATE_ONLY.test(s)) return s
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : todayIso(d)
}

/* Today as a calendar day, in the reader's zone. `toISOString().slice(0, 10)`
   is the same bug from the other end: it answers with UTC's day, which after
   7pm in New York is tomorrow. */
export function todayIso(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function relativeTime(s: string) {
  const t = new Date(s).getTime()
  const diff = Date.now() - t
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return `${Math.floor(d / 30)}mo ago`
}

/* A range whose two ends cross, and so asks for nothing: a minimum of 100 with a
   maximum of 10 matches no account there could ever be. Every filter surface in
   the module reads it the same way, so the reading lives here rather than three
   times over.
 *
 * A range with one end open is not crossed - that is the ordinary way to ask for
 * "at least this much" - and neither is a half-typed number. */
export function invertedRange(min: string, max: string, magnitude = false): boolean {
  if (min.trim() === '' || max.trim() === '') return false
  const lo = magnitude ? Math.abs(Number(min)) : Number(min)
  const hi = magnitude ? Math.abs(Number(max)) : Number(max)
  return Number.isFinite(lo) && Number.isFinite(hi) && lo > hi
}

/* Whether a posting's size falls inside an amount filter's bounds. A posting is
   either a debit or a credit and its amount is the size of it, so the bounds are
   sizes too and a sign on one is not a bound the ledger can honour.

   Mahad, 2026-09-24: *"The amount filter should match by absolute value, so
   entering -23.45 or 23.45 returns the same results."* Signed, a minimum of
   -23.45 barred nothing and a maximum of -23.45 barred everything, so a reader
   who wrote down a credit the way it appeared on their statement got an empty
   table and no account of why.

   Not for a balance range, where the sign is the point: an account 500 in the
   red and one 500 in the black are not the same account. */
export function withinMagnitude(amount: number, min: string, max: string): boolean {
  const lo = Math.abs(Number(min))
  const hi = Math.abs(Number(max))
  if (min.trim() !== '' && Number.isFinite(lo) && amount < lo) return false
  if (max.trim() !== '' && Number.isFinite(hi) && amount > hi) return false
  return true
}

/** The same reading of a From / To pair, which crosses on ISO dates as strings. */
export function invertedDates(from: string, to: string): boolean {
  return !!from && !!to && from > to
}

export function debounce<T extends (...args: any[]) => void>(fn: T, wait: number): T {
  let to: any
  return ((...args: any[]) => {
    clearTimeout(to)
    to = setTimeout(() => fn(...args), wait)
  }) as T
}
