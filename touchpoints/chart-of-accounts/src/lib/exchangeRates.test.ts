import { describe, it, expect } from 'vitest'
import { CURRENCY_META, currencyMeta, formatRate, bookedFromBase, fxStanding, PEGGED_TO_BASE } from './currencies'

/* A rate is quoted to four decimals, so it has to be shown to four decimals.
   Two is not a shorter way of writing the same number: at 0.92 against 0.9243 a
   million-dollar balance is out by 4,300, and a reader checking the hover card
   against their bank cannot tell a rounded rate from a stale one.

   The floor holds even where the extra places are zeros, because 1.0000 and 1
   are the same rate only to someone who already knows it is a peg. */

const decimals = (s: string) => (s.split('.')[1] ?? '').length

describe('the rate shown in a hover card', () => {
  it('never drops below four decimals', () => {
    for (const code of Object.keys(CURRENCY_META)) {
      expect(decimals(formatRate(currencyMeta(code).rate))).toBeGreaterThanOrEqual(4)
    }
  })

  it('pads a rate that is short of four, rather than showing it bare', () => {
    expect(formatRate(1)).toBe('1.0000')
    expect(formatRate(0.9)).toBe('0.9000')
  })

  it('keeps the places a rate actually carries', () => {
    expect(formatRate(0.9243)).toBe('0.9243')
    expect(formatRate(278.534)).toBe('278.5340')
  })

  it('lets a rate that needs more precision keep it', () => {
    expect(formatRate(0.000125)).toBe('0.000125')
  })

  it('still groups the thousands, so a large rate stays readable', () => {
    expect(formatRate(1234.5678)).toBe('1,234.5678')
  })
})

describe('the rates behind the cards', () => {
  /* Asks for more than two decimals rather than for exactly four, because a
     rate whose fourth decimal is zero cannot say so: 278.5340 and 278.534 are
     one number. What this catches is a rate left at the two-decimal placeholder
     it used to be, which would show as 0.9200 and pass for precision it does
     not have. */
  it('carries more precision than the display floor, so four decimals are not padding', () => {
    const quoted = Object.values(CURRENCY_META).filter(m => m.code !== 'USD')
    expect(quoted.length).toBeGreaterThan(0)
    for (const m of quoted) {
      expect(decimals(String(m.rate)), `${m.code} is quoted too coarsely`).toBeGreaterThan(2)
    }
  })

  it('leaves the base currency at parity', () => {
    expect(CURRENCY_META.USD.rate).toBe(1)
  })

  it('answers for a currency it has never heard of at parity', () => {
    expect(formatRate(currencyMeta('ZZZ').rate)).toBe('1.0000')
  })
})

/* The booked rate and the spot rate are two different questions.

   A foreign-currency balance is carried in base at the rate it was last
   revalued at. That figure is what the ledger holds, what the totals add and
   what the statements print. Today's spot rate has posted nothing; it only
   answers what a revaluation would find if one ran now.

   The hover card shows both, and the gap between them is the unrealized
   difference. So the gap has to be able to exist - which is a claim about the
   data, not only about the card. */
describe('the booked rate against today’s rate', () => {
  const floating = Object.values(CURRENCY_META).filter(m => !PEGGED_TO_BASE.has(m.code))

  it('quotes them as different numbers wherever the currency can move', () => {
    expect(floating.length).toBeGreaterThan(0)
    for (const m of floating) {
      expect(m.bookedRate, `${m.code} was booked at today's rate`).not.toBe(m.rate)
    }
  })

  /* The failure this guards against is subtle and silent: set the booked rate
     equal to spot and every figure still renders, but the own-currency balance
     converted back at spot returns the base balance it came from, so the card
     reports a zero difference for every account and quietly stops meaning
     anything. */
  it('leaves an unrealized difference that is actually non-zero', () => {
    for (const m of floating) {
      expect(fxStanding(100_000, m.code).difference, `${m.code} shows no movement`).not.toBe(0)
    }
  })

  it('holds a pegged currency at one rate, so its difference is genuinely nil', () => {
    for (const code of PEGGED_TO_BASE) {
      expect(currencyMeta(code).bookedRate).toBe(currencyMeta(code).rate)
      expect(fxStanding(100_000, code).difference).toBeCloseTo(0, 6)
    }
  })

  it('leaves the base currency at parity on both', () => {
    expect(CURRENCY_META.USD.rate).toBe(1)
    expect(CURRENCY_META.USD.bookedRate).toBe(1)
  })

  it('carries the booked rate to four decimals too, since the card quotes it', () => {
    for (const m of Object.values(CURRENCY_META)) {
      expect(decimals(formatRate(m.bookedRate))).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('what one balance stands at', () => {
  // 100,000 booked in base, revalued at 0.9310 to the dollar, spot now 0.9243.
  const fx = fxStanding(100_000, 'EUR')

  it('reads the own-currency balance off the booked rate, not today’s', () => {
    expect(fx.own).toBeCloseTo(93_100, 6)
    expect(fx.own).not.toBeCloseTo(100_000 * CURRENCY_META.EUR.rate, 2)
  })

  it('leaves the booked base value exactly as the ledger holds it', () => {
    expect(fx.booked).toBe(100_000)
  })

  /* The whole point of the card: the same holding, valued at today's rate, is
     worth more base than was booked for it, and nobody has posted the
     difference. */
  it('values it again at today’s rate and keeps the two apart', () => {
    expect(fx.indicative).toBeCloseTo(93_100 / 0.9243, 6)
    expect(fx.indicative).toBeGreaterThan(fx.booked)
    expect(fx.difference).toBeCloseTo(fx.indicative - fx.booked, 6)
  })

  /* Direction, stated once so a flipped divide cannot pass. Fewer euros to the
     dollar today than when the balance was struck means the euro has
     strengthened, so a euro holding is worth more dollars - not fewer. */
  it('moves the base value up when the currency has strengthened', () => {
    expect(CURRENCY_META.EUR.rate).toBeLessThan(CURRENCY_META.EUR.bookedRate)
    expect(fx.difference).toBeGreaterThan(0)
  })

  it('reports no difference on a balance of nothing', () => {
    expect(fxStanding(0, 'EUR').difference).toBe(0)
  })

  it('carries a negative balance through with its sign intact', () => {
    const credit = fxStanding(-100_000, 'EUR')
    expect(credit.own).toBeCloseTo(-93_100, 6)
    expect(credit.difference).toBeCloseTo(-fx.difference, 6)
  })
})

/* A column total adds what the ledger carries.

   The Foreign balance column restates each balance at its booked rate, so a
   single-currency subtotal is the booked total. Re-converting at today's rate
   would total a set of figures nobody posted, and would drift from the Balance
   column beside it by exactly the unrealized movement. */
describe('a column of foreign balances', () => {
  const balances = [120_000, -45_500, 8_250]

  it('totals the same whether each row is restated first or the base total is', () => {
    const rowByRow = balances.reduce((s, b) => s + bookedFromBase(b, 'GBP'), 0)
    const totalFirst = bookedFromBase(balances.reduce((s, b) => s + b, 0), 'GBP')
    expect(rowByRow).toBeCloseTo(totalFirst, 6)
  })

  it('does not total to what today’s rate would make of it', () => {
    const booked = balances.reduce((s, b) => s + bookedFromBase(b, 'GBP'), 0)
    const atSpot = balances.reduce((s, b) => s + b * CURRENCY_META.GBP.rate, 0)
    expect(booked).not.toBeCloseTo(atSpot, 2)
  })

  it('stays the booked figure the hover card names', () => {
    for (const b of balances) {
      expect(bookedFromBase(b, 'GBP')).toBeCloseTo(fxStanding(b, 'GBP').own, 6)
    }
  })
})
