import { test, expect, type Page } from '@playwright/test'

/* A contra account is carried on the opposite side to its category, so it reads
   negative and has to deepen as it grows. 1085 is the allowance for doubtful
   accounts: it is credited all year and never debited, and every one of those
   postings narrates itself "Increase allowance for doubtful accounts".

   The register used to carry it the other way - each credit walked the balance
   back toward zero, so a year of provisions read as the allowance being
   released while every line beside it said the opposite. The cause was
   normalSideDelta signing by the account's own normalBalance, which on a contra
   is deliberately the flip of its category's.

   Pinned in a browser because lib/accountSignConvention.test.ts can only prove
   the arithmetic; it cannot see the page hand the register a different opening,
   or a cell negate the figure again on the way out.

   Asserted relationally, never against a figure. The seed clamps its postings
   to today (SEED_TX_END), so every absolute currency total in this chart drifts
   with the calendar - three tests in coaKpis.test.ts are pinned that way and
   fail a little more each day the repo sits. */

// "-$ 18,500" → -18500, "$ 346" → 346, "-" → null.
const money = (s: string): number | null => {
  const t = s.trim()
  if (!/\d/.test(t)) return null
  const n = Number(t.replace(/[^0-9.]/g, ''))
  return /^-|^\(/.test(t) ? -n : n
}

async function registerRows(page: Page) {
  const heads = await page.$$eval('table thead th', ths => ths.map(t => t.innerText.trim()))
  const iCredit = heads.indexOf('Credit')
  const iDebit = heads.indexOf('Debit')
  const iRunning = heads.indexOf('Running balance')
  expect(iCredit, 'the register states a Credit column').toBeGreaterThan(-1)
  expect(iRunning, 'the register states a Running balance column').toBeGreaterThan(-1)
  return page.$$eval('table tbody tr', (trs, cols) => trs.map(tr => {
    const td = Array.from(tr.querySelectorAll('td'))
    return {
      debit: td[cols.d]?.innerText ?? '',
      credit: td[cols.c]?.innerText ?? '',
      running: td[cols.r]?.innerText ?? '',
    }
  }), { d: iDebit, c: iCredit, r: iRunning })
}

test('a credit deepens the allowance instead of releasing it', async ({ page }) => {
  await page.goto('/chart-of-accounts/acct_11330', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: /allowance for doubtful accounts/i })).toBeVisible()

  await page.getByRole('button', { name: /^transactions$/i }).first().click()
  await page.waitForSelector('table tbody tr')

  const rows = await registerRows(page)
  expect(rows.length).toBeGreaterThan(1)

  /* Newest first, so each row's balance is the one below it moved by this
     posting: a credit takes it down, a debit brings it back up. Checking the
     step rather than the endpoints is what makes this independent of the date. */
  let credits = 0
  for (let i = 0; i < rows.length - 1; i++) {
    const here = money(rows[i].running)
    const below = money(rows[i + 1].running)
    const credit = money(rows[i].credit) ?? 0
    const debit = money(rows[i].debit) ?? 0
    expect(here, `row ${i} states a running balance`).not.toBeNull()
    expect(below, `row ${i + 1} states a running balance`).not.toBeNull()
    expect(here, `row ${i} moves by its own posting`).toBe(below! - credit + debit)
    credits += credit
  }

  // The account this page is about: if the seed ever stops crediting it, the
  // loop above would pass over a register that proves nothing.
  expect(credits, 'the allowance is credited over the period shown').toBeGreaterThan(0)

  // Oldest row at the bottom, newest at the top, and it ended deeper than it began.
  const newest = money(rows[0].running)!
  const oldest = money(rows[rows.length - 1].running)!
  expect(newest).toBeLessThan(oldest)
  expect(newest).toBeLessThan(0)
})
