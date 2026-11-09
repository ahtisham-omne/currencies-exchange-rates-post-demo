import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { seedAccounts, seedTransactions, seedQ1Openings, seedPeriods } from './seed'
import { normalSideDelta, monthlyBalanceAsOf, runningBalanceLedger } from './monthlyLedger'
import { deriveNormalBalance, deriveContra } from '../store'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CONTRA_ACCOUNT_LINE, signConventionLine, NormalBalanceHelp } from './normalBalanceCopy'
import type { Account } from '../types'

/* One sign convention, stated once and obeyed everywhere.
   Every figure in the app is signed on the side its CATEGORY is carried on
   (lib/monthlyLedger), which is the side Account.balance and Account.netChange
   are already authored on. On a credit-normal account that is the negation of
   debit less credit, which is why the account page had the same account reading
   +19,429 on one card, -18,500 on another and -19,429 in the listing, and why
   "Net" printed the movement backwards on every credit-normal account.

   A contra account is carried on the opposite side to its category, so it reads
   negative and deepens as it grows. Signing it by its own normalBalance - which
   is deliberately the flip of its category's - is the bug this file now pins:
   every credit to the allowance for doubtful accounts walked it toward zero, so
   a year of provisions read as the allowance being released.

   The convention is not a matter of opinion, so it is not left to each surface
   to apply. What is guarded here: the arithmetic reconciles under it, the old
   arithmetic really was the negation of it, and the page says which side it is
   printing rather than leaving the reader to infer it from a sign. */

const byNumber = (n: string) => seedAccounts.find(a => a.accountNumber === n)!
const CONTRA = byNumber('11330')      // Allowance for Doubtful Accounts, credit-normal asset
const PAYABLES = byNumber('21110')    // Trade Payables, credit-normal by category
const own = (a: Account) => seedTransactions.filter(t => t.accountId === a.id)
const normalSideNet = (a: Account) => own(a).reduce((s, t) => s + normalSideDelta(a, t), 0)
const debitLessCredit = (a: Account) => own(a).reduce((s, t) => s + (t.debit - t.credit), 0)

describe('the convention holds on the accounts that contradicted it', () => {
  it('picked the two accounts the report named', () => {
    expect([CONTRA.normalBalance, CONTRA.isContra]).toEqual(['Credit', true])
    expect([PAYABLES.normalBalance, PAYABLES.isContra]).toEqual(['Credit', false])
  })

  /* The whole reason a single convention is worth enforcing: under it the
     figures add up, so no surface has to reach for an absolute value to make a
     card look right. */
  for (const a of [CONTRA, PAYABLES]) {
    it(`carries ${a.accountNumber} from its opening to its stored balance`, () => {
      expect(seedQ1Openings[a.id] + normalSideNet(a)).toBe(a.balance)
      const running = runningBalanceLedger(a, seedTransactions, seedQ1Openings[a.id])
      expect(running[running.length - 1].runningBalance).toBe(a.balance)
    })
  }

  // What "Net" used to print. Naming it keeps the fix from being re-broken by
  // someone who reads debit-less-credit as the obviously correct arithmetic.
  it('prints the opposite of debit less credit on 2020', () => {
    expect(debitLessCredit(PAYABLES)).toBe(-normalSideNet(PAYABLES))
    expect(normalSideNet(PAYABLES)).toBeGreaterThan(0)
  })

  /* The contra account is the one place the account's own normal side is not
     the side its figures are carried on, so it nets the other way from 2020
     despite both being credit-normal. 1085 is credited all year and never
     debited; each of those credits has to deepen it. */
  it('takes a credit off 1085 rather than carrying it back toward zero', () => {
    const opening = seedQ1Openings[CONTRA.id]
    const running = runningBalanceLedger(CONTRA, seedTransactions, opening)
    expect(running.length).toBeGreaterThan(0)
    let prev = opening
    for (const p of running) {
      // Its category is an asset, so the figures are carried debit-positive.
      expect(p.delta).toBe(p.transaction.debit - p.transaction.credit)
      expect(p.runningBalance).toBe(prev + p.delta)
      prev = p.runningBalance
    }
    expect(normalSideNet(CONTRA)).toBe(debitLessCredit(CONTRA))
    expect(normalSideNet(CONTRA)).toBeLessThan(0)
    expect(prev).toBeLessThan(opening)
  })

  /* 1085 read +19,429 on the opening card and -19,429 in the listing off one
     stored figure, because the card took the magnitude. The two need not agree
     in size - they are different periods - but they cannot disagree in side. */
  it('agrees on the side of the contra account opening, card and listing', () => {
    const card = monthlyBalanceAsOf(CONTRA, seedTransactions, seedQ1Openings[CONTRA.id], seedPeriods, '2026-03-15')!
    const listing = CONTRA.balance - (CONTRA.netChange ?? 0)
    expect(card.opening).toBeLessThan(0)
    expect(listing).toBeLessThan(0)
    expect(Math.sign(card.opening)).toBe(Math.sign(listing))
  })
})

describe('the convention holds across the whole chart', () => {
  const postings = seedAccounts.filter(a => a.isPosting && a.normalBalance !== 'n/a')

  it('gives every account the side its category says, unless it is contra', () => {
    for (const a of postings) {
      expect(a.normalBalance, a.accountNumber).toBe(deriveNormalBalance(a.accountType, a.isContra))
      expect(deriveContra(a.accountType, a.normalBalance), a.accountNumber).toBe(!!a.isContra)
    }
  })

  it('has contra accounts to identify, or the field on the page says nothing', () => {
    expect(postings.filter(a => a.isContra).length).toBeGreaterThan(0)
  })
})

/* The convention has to be printed where the figures are. A page that states a
   category, prints figures that read the other way round, and says nothing
   about either has told the reader the wrong thing by omission. */
describe('what the account page says about the side it is printing', () => {
  const src = readFileSync(join(__dirname, '..', 'pages', 'AccountDetail.tsx'), 'utf8')

  /* The page states the side and badges a contra account; the two explanations
     under it moved into the field's tooltip on 2026-09-10, when Mahad cut the
     detail page's explanatory prose. Rendered rather than grepped, because the
     tooltip only says them if the page hands it this account's own two facts -
     and a `<NormalBalanceHelp />` with no props compiles and says nothing. */
  it('names the side, and badges contra when the account is one', () => {
    expect(src).toContain('Normal balance')
    expect(src).toContain('<Badge tone="warning">Contra</Badge>')
    expect(src).toMatch(/NormalBalanceHelp normalBalance=\{account\.normalBalance\} isContra=\{account\.isContra\}/)
  })

  it('explains the side and contra one hover away', () => {
    // The apostrophe in "this account's normal side" comes back as `&#x27;`, so
    // stripping tags alone leaves a string the copy can never match.
    const text = (el: Parameters<typeof renderToStaticMarkup>[0]) =>
      renderToStaticMarkup(el).replace(/<[^>]*>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ')
    const help = text(createElement(NormalBalanceHelp, { normalBalance: 'Credit', isContra: true }))
    expect(help).toContain(signConventionLine('Credit'))
    expect(help).toContain(CONTRA_ACCOUNT_LINE)
    // Neither is claimed of an account that is not one: the contra line is a
    // statement about this account, not a definition offered to everyone.
    expect(text(createElement(NormalBalanceHelp, { normalBalance: 'Debit' }))).not.toContain(CONTRA_ACCOUNT_LINE)
  })

  it('signs the figures rather than taking their magnitude', () => {
    expect(src).not.toMatch(/Math\.abs\(\s*(openingBalance|end - change)/)
  })

  it('moves every balance by the normal-side delta', () => {
    expect(src).toContain('normalSideDelta')
    expect(src).not.toMatch(/\bt\.debit - t\.credit\b/)
  })

  it('names the positive side after the account, not after debit', () => {
    expect(signConventionLine('Credit')).toBe('Positive figures on this page move toward credit, this account\'s normal side.')
    expect(CONTRA_ACCOUNT_LINE).toMatch(/opposite side to its category/)
  })
})
