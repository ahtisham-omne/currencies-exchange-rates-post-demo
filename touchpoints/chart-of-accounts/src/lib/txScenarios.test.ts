import { describe, it, expect } from 'vitest'
import { TX_SCENARIOS, formatLeg, type ScenarioLeg } from './txScenarios'
import { FULL_CHART } from './fullChart'
import { SOURCE_DOC, isSeedPostingAccount, seedAccounts, seedPeriods, seedTransactions, GROUP_BY_NUMBER } from './seed'

// A leg's `group` is the name of the summary account its posting rows hang from,
// derived from the parent link rather than authored per row, so these read the
// same derivation the seed itself uses.
const groupOf = (number: string) => GROUP_BY_NUMBER[number] ?? ''
const POSTING_ROWS = FULL_CHART.filter(r => r.glType === 'Posting' && groupOf(r.number))
const GROUPS = new Set(POSTING_ROWS.map(r => groupOf(r.number)))
const ELIGIBLE = seedAccounts.filter(isSeedPostingAccount)

const legs = TX_SCENARIOS.flatMap(s => [
  { id: `${s.id}.debit`, leg: s.debit },
  { id: `${s.id}.credit`, leg: s.credit },
])

const poolFor = (leg: ScenarioLeg) => ELIGIBLE.filter(a =>
  groupOf(a.accountNumber) === leg.group
  && a.isContra === !!leg.contra
  && (!leg.accounts || leg.accounts.includes(a.accountNumber)))

describe('transaction scenarios', () => {
  it('gives every account family narration to draw on', () => {
    const covered = new Set(legs.map(l => l.leg.group))
    expect([...GROUPS].filter(g => !covered.has(g))).toEqual([])
  })

  // A leg names accounts by number, so a typo or a chart rename would strand its
  // copy. Checked against the whole chart rather than the accounts that post,
  // because a few accounts are seeded deliberately transaction-free and their
  // scenarios are meant to sit unused until that changes.
  it('lands every leg on a real chart account', () => {
    const stranded = legs.filter(({ leg }) => !POSTING_ROWS.some(r =>
      groupOf(r.number) === leg.group
      && !!r.contra === !!leg.contra
      && (!leg.accounts || leg.accounts.includes(r.number))))
    expect(stranded.map(l => l.id)).toEqual([])
  })

  it('gives every eligible posting account at least one leg', () => {
    const reached = new Set(legs.flatMap(l => poolFor(l.leg).map(a => a.id)))
    expect(ELIGIBLE.filter(a => !reached.has(a.id)).map(a => a.accountNumber)).toEqual([])
  })

  it('names a real source document for every scenario', () => {
    expect(TX_SCENARIOS.filter(s => !SOURCE_DOC[s.source]).map(s => s.id)).toEqual([])
  })

  // Every document except a payroll run has the other side of the deal - vendor,
  // customer, counterparty, claimant - and the party is what an entry line's
  // Entity is read from (journalEntry.ts, scenarioParty), so a scenario without
  // one leaves that column blank.
  it('names a party for every document that shows one', () => {
    const needsParty = TX_SCENARIOS.filter(s => SOURCE_DOC[s.source]?.linked && s.source !== 'Payroll')
    expect(needsParty.filter(s => !s.party).map(s => s.id)).toEqual([])
  })

  it('uses no em dashes anywhere in the copy', () => {
    const copy = TX_SCENARIOS.flatMap(s => [
      s.docTitle, s.doc, s.party ?? '',
      s.debit.text, s.credit.text,
      ...(s.debit.alts ?? []), ...(s.credit.alts ?? []),
    ])
    expect(copy.filter(t => t.includes('—'))).toEqual([])
  })

  it('substitutes every token it declares', () => {
    for (const { id, leg } of legs) {
      for (const text of [leg.text, ...(leg.alts ?? [])]) {
        const filled = formatLeg({ ...leg, text, alts: undefined }, '2026-11-18', 'INV-2026-1042')
        expect(filled, id).not.toMatch(/[{}]/)
      }
    }
  })

  it('appends the document reference only where a leg asks for it', () => {
    for (const { id, leg } of legs) {
      const filled = formatLeg({ ...leg, alts: undefined }, '2026-11-18', 'INV-2026-1042')
      expect(filled.endsWith('INV-2026-1042'), id).toBe(!!leg.appendRef)
    }
  })
})

/* Revaluation is close work. Retranslating a foreign currency balance at the
   closing rate is the last thing done to a period, not something anyone does on
   the 9th - and the GBP retranslation was posting every few days, which reads
   as a close that never ends. So a period-end scenario lands on the period's
   last day, once per period, and not at all in a period whose close has not
   come round yet. */
describe('the entries that only exist because a period is closing', () => {
  const CLOSE_ONLY = TX_SCENARIOS.filter(s => s.timing === 'period-end')
  const PERIOD_ENDS = new Set(seedPeriods.map(p => p.endDate))
  const linesOf = (id: string) => seedTransactions.filter(t => t.scenarioId === id)

  it('marks the revaluations, and only work of that kind', () => {
    expect(CLOSE_ONLY.map(s => s.id).sort()).toEqual(['currency-translation', 'fx-revaluation'])
    for (const s of CLOSE_ONLY) expect(s.source, s.id).toBe('Manual JE')
  })

  it('posts every one of them on a period end', () => {
    for (const s of CLOSE_ONLY) {
      const lines = linesOf(s.id)
      expect(lines.length, s.id).toBeGreaterThan(0)
      for (const t of lines) expect(PERIOD_ENDS.has(t.date.slice(0, 10)), `${s.id} ${t.date}`).toBe(true)
    }
  })

  it('closes each period once, not every few days', () => {
    for (const s of CLOSE_ONLY) {
      const days = linesOf(s.id).map(t => t.date.slice(0, 10))
      const jesPerDay = new Map<string, Set<string>>()
      for (const t of linesOf(s.id)) {
        if (!jesPerDay.has(t.date.slice(0, 10))) jesPerDay.set(t.date.slice(0, 10), new Set())
        jesPerDay.get(t.date.slice(0, 10))!.add(t.jeNumber)
      }
      for (const [day, jes] of jesPerDay) expect(jes.size, `${s.id} ${day}`).toBe(1)
      expect(new Set(days).size, s.id).toBeGreaterThan(1)
    }
  })

  // The current month has not been closed, so its revaluation has not happened.
  // Dating one at the month end would put a posting ahead of the ledger.
  it('leaves the period whose close has not come round yet alone', () => {
    const latest = seedTransactions.map(t => t.date.slice(0, 10)).reduce((m, d) => (d > m ? d : m))
    for (const s of CLOSE_ONLY) {
      for (const t of linesOf(s.id)) expect(t.date.slice(0, 10) <= latest, `${s.id} ${t.date}`).toBe(true)
    }
    const open = seedPeriods.find(p => p.startDate <= latest && p.endDate > latest)
    expect(open, 'a period in progress').toBeDefined()
    for (const s of CLOSE_ONLY) {
      expect(linesOf(s.id).some(t => t.date.slice(0, 10) === open!.endDate), s.id).toBe(false)
    }
  })
})
