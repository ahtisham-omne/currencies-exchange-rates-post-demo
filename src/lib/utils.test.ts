import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { fmtCurrency, fmtCurrencyExact, fmtDate, fmtDateTime, localDayOf, todayIso } from './utils'

/* Run west of Greenwich, because that is the only place the bug was ever
   visible. The machine this was written on sits at UTC+5, where every wrong
   answer happens to round back to the right day - so a test in the local zone
   would have passed against the broken code and told nobody anything. */
const TZ = process.env.TZ
beforeAll(() => { process.env.TZ = 'America/New_York' })
afterAll(() => { process.env.TZ = TZ })

/* Mahad, 2026-09-24: *"Dates display one day earlier than selected, which risks
   posting to the wrong period."* Both halves of that are here: reading a day
   back out, and writing today's day down. */
describe('fmtDate', () => {
  it('shows a calendar day as itself, not as the evening before', () => {
    expect(fmtDate('2026-09-24')).toBe('Sep 24, 2026')
    expect(fmtDate('2026-01-01')).toBe('Jan 1, 2026')
  })

  // A timestamp is an instant and does belong to the reader's zone: 00:30 UTC is
  // still the previous evening in New York, and saying so is correct.
  it('still shows an instant in the reader’s own zone', () => {
    expect(fmtDate('2026-09-24T00:30:00.000Z')).toBe('Sep 23, 2026')
  })
})

describe('todayIso', () => {
  it('answers with the reader’s day, not UTC’s', () => {
    expect(todayIso(new Date('2026-09-24T02:00:00.000Z'))).toBe('2026-09-23')
  })

  it('pads a single-digit month and day', () => {
    expect(todayIso(new Date('2026-03-05T17:00:00.000Z'))).toBe('2026-03-05')
  })
})

/* Mahad, 2026-09-24: *"A one-cent imbalance (12.34 debit vs 12.33 credit)
   blocks posting correctly but shows 'Out of balance by $0.'"* */
describe('fmtCurrencyExact', () => {
  it('states a shortfall the rounded formatter loses entirely', () => {
    expect(fmtCurrency(0.01)).toBe('$ 0')
    expect(fmtCurrencyExact(0.01)).toBe('$ 0.01')
  })

  // The pair the reader compares must not collapse into one number.
  it('keeps two totals a cent apart apart', () => {
    expect(fmtCurrencyExact(12.34)).toBe('$ 12.34')
    expect(fmtCurrencyExact(12.33)).toBe('$ 12.33')
  })

  it('puts the sign before the symbol, and groups thousands', () => {
    expect(fmtCurrencyExact(-1234.5, 'EUR')).toBe('-€ 1,234.50')
  })
})

/* The audit columns' moments (design review, 2026-10-02 - *"Dates, times, and
   whose"*): the time of day where there is one, the date alone where there is
   not, and a From/To filter that compares the reader's own calendar day. */
describe('a moment in a grid', () => {
  it('reads the date and the time of day', () => {
    expect(fmtDateTime('2026-10-02T14:05:00')).toBe('Oct 2, 2026, 2:05 PM')
  })
  it('reads a bare day as the day, not as midnight', () => {
    expect(fmtDateTime('2026-10-02')).toBe('Oct 2, 2026')
    expect(fmtDateTime('')).toBe('')
  })
  it('files a moment under the reader\'s own day', () => {
    expect(localDayOf('2026-10-02T23:30:00')).toBe('2026-10-02')
    expect(localDayOf('2026-10-02')).toBe('2026-10-02')
    expect(localDayOf('not a date')).toBe('')
  })
})
