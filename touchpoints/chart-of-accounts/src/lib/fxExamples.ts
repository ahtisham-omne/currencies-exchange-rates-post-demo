import type { Account, AuditEntry, JournalEntry, Period, Transaction } from '../types'
import { normalSideDelta } from './monthlyLedger'
import { nextJeNumber, periodForDate } from './journalEntry'
import { nextInternalId, nextJournalInternalId } from './internalId'
import { rateQuote, unitsPerBase, type RateKind } from './fxRates'

/* ── Two journal entries written in another currency ──────────────────
   Mahad, 2026-11-18: *"Add 1 example in the general ledger with a foreign
   currency … Also keep the ability to switch between mid market rate and
   corporate rate if corporate rate is available. Add 1 example for this."*

   Written as the New journal entry form writes one under the rules for an
   entry in another currency (see NewJournalEntryModal):
   - one currency for the whole entry, every line typed in it;
   - the rate is the entry date's, of the kind the company takes (mid-market
     for GBP, which Treasury sets no corporate rate for; Treasury's corporate
     rate for EUR);
   - a dollar account's line is converted at that rate, and a pound account
     only appears in a pound entry;
   - it balances in both currencies, the cent the line-by-line conversion
     leaves going to a rounding line on Foreign Exchange Gain/Loss.

   Applied on top of the seed the way `addJournalEntry` posts an entry: each
   account's balance moves by what posts to it. Nothing the seed generated is
   touched, so every scenario figure stays where it was. */

export const FX_ROUNDING_NUMBER = '42050'

/* The account a rounding gap posts to. Added after the seed is generated rather
   than in the chart the generator sizes entries from, so no draw moves. */
function roundingAccount(accounts: Account[]): Account | null {
  const template = accounts.find(a => a.accountNumber === '42040')
  if (!template) return null
  return {
    ...template,
    id: `acct_${FX_ROUNDING_NUMBER}`,
    internalId: nextInternalId(accounts),
    accountNumber: FX_ROUNDING_NUMBER,
    accountName: 'Foreign Exchange Gain/Loss',
    description: 'Exchange differences, and the rounding left when an entry in another currency converts line by line.',
    balance: 0,
    netChange: 0,
    hasTransactions: false,
  }
}

interface ExampleLine { number: string; side: 'debit' | 'credit'; amount: number; description: string }
interface Example { date: string; time: string; currency: string; kind: RateKind; memo: string; tags?: string[]; lines: ExampleLine[] }

export const FX_EXAMPLES: Example[] = [
  {
    date: '2026-11-12',
    time: '15:05:00',
    currency: 'EUR',
    kind: 'corporate',
    memo: 'Interest credited on the Deutsche Bank euro account, booked at Treasury\'s corporate rate.',
    lines: [
      { number: '11170', side: 'debit', amount: 418.6, description: 'Interest credited, October balance' },
      { number: '42010', side: 'credit', amount: 418.6, description: 'Interest on the euro account' },
    ],
  },
  {
    // Back-dated two days, so it took that day's rate rather than today's. Its
    // lines convert to a cent apart, which the rounding line takes.
    date: '2026-11-16',
    time: '10:24:00',
    currency: 'GBP',
    kind: 'mid',
    memo: 'London office costs for November, paid from the Barclays reserve account in pounds.',
    lines: [
      { number: '52310', side: 'debit', amount: 1850.0, description: 'London office rent, November' },
      { number: '52320', side: 'debit', amount: 312.46, description: 'London office electricity and water' },
      { number: '52330', side: 'debit', amount: 87.3, description: 'London office stationery' },
      { number: '11160', side: 'credit', amount: 2249.76, description: 'Paid from Barclays reserve' },
    ],
  },
]

const cents = (v: number) => Math.round(v * 100) / 100

/** The base figures an entry posts: each line converted and rounded on its own,
 *  and the gap that leaves between the two sides, if any. */
export function convertLines(lines: { side: 'debit' | 'credit'; amount: number }[], basePerOne: number) {
  const base = lines.map(l => cents(l.amount * basePerOne))
  const debit = cents(base.reduce((s, v, i) => s + (lines[i].side === 'debit' ? v : 0), 0))
  const credit = cents(base.reduce((s, v, i) => s + (lines[i].side === 'credit' ? v : 0), 0))
  return { base, gap: cents(debit - credit) }
}

export function withFxExamples(
  seed: { accounts: Account[]; transactions: Transaction[]; journalEntries: JournalEntry[] },
  periods: Period[],
  baseCurrency = 'USD',
) {
  const rounding = roundingAccount(seed.accounts)
  if (!rounding) return { ...seed, audit: [] as AuditEntry[] }
  // Its Create entry, as every account has one, credited and dated as it is.
  const audit: AuditEntry[] = [{ id: `au_${rounding.id}`, accountId: rounding.id, action: 'Create', user: rounding.createdBy, timestamp: rounding.createdAt }]
  let accounts = [...seed.accounts, rounding]
  const transactions = [...seed.transactions]
  const journalEntries = [...seed.journalEntries]
  const byNumber = new Map(accounts.map(a => [a.accountNumber, a]))
  const issued = new Set([...journalEntries.map(e => e.reference), ...transactions.map(t => t.jeNumber)])

  for (const ex of FX_EXAMPLES) {
    const resolved = ex.lines.map(l => ({ ...l, account: byNumber.get(l.number) }))
    if (resolved.some(l => !l.account)) continue
    const quote = rateQuote(ex.currency, ex.date, ex.kind, baseCurrency)
    const { base, gap } = convertLines(ex.lines, quote.rate)
    const jeNumber = nextJeNumber(issued, ex.date)
    issued.add(jeNumber)
    const entryInternalId = nextJournalInternalId(transactions)
    const period = periodForDate(ex.date, periods)?.label ?? ''
    const createdAt = `${ex.date}T${ex.time}`
    const entryType = ex.lines.length + (gap ? 1 : 0) > 2 ? 'Compound' : 'Simple'
    const stored = unitsPerBase(quote.rate)
    const common = {
      date: ex.date, source: 'Manual JE', jeNumber, reference: '', entryType, memo: ex.memo,
      createdAt, createdBy: 'Ahtisham Ahmad', entryInternalId, period, runningBalance: 0,
      entryCurrency: ex.currency, entryRate: stored, entryRateType: quote.kind,
    } as const
    const posted: Transaction[] = resolved.map((l, i) => ({
      ...common,
      id: `tx_fx_${jeNumber}_${i + 1}`,
      accountId: l.account!.id,
      description: l.description,
      debit: l.side === 'debit' ? base[i] : 0,
      credit: l.side === 'credit' ? base[i] : 0,
      fxDebit: l.side === 'debit' ? l.amount : 0,
      fxCredit: l.side === 'credit' ? l.amount : 0,
      dimensionValues: l.account!.defaultDimensionValues ?? [],
    }))
    // The cent the conversion leaves, in dollars only, on the short side.
    if (gap) {
      posted.push({
        ...common,
        id: `tx_fx_${jeNumber}_rounding`,
        accountId: rounding.id,
        description: `Rounding, ${ex.currency} converted line by line`,
        debit: gap < 0 ? -gap : 0,
        credit: gap > 0 ? gap : 0,
        fxDebit: 0,
        fxCredit: 0,
        dimensionValues: [],
      })
    }
    transactions.push(...posted)
    journalEntries.push({
      id: `je_fx_${jeNumber}`,
      date: ex.date,
      reference: jeNumber,
      description: 'Manual journal entry',
      status: 'Posted',
      lines: posted.map(t => ({ accountId: t.accountId, debit: t.debit, credit: t.credit })),
    })
    // Move each account's balance by what posted to it, as addJournalEntry does.
    const deltas = new Map<string, number>()
    for (const t of posted) {
      const a = accounts.find(x => x.id === t.accountId)!
      deltas.set(a.id, (deltas.get(a.id) ?? 0) + normalSideDelta(a, t))
    }
    accounts = accounts.map(a => {
      const d = deltas.get(a.id)
      return d === undefined ? a : { ...a, balance: cents(a.balance + d), netChange: cents((a.netChange ?? 0) + d), hasTransactions: true }
    })
  }
  return { accounts, transactions, journalEntries, audit }
}
