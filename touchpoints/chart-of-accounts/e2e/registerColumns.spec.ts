import { test, expect, type Page } from '@playwright/test'

/* The account's Transactions tab lists postings, so it carries each line's own
   text and not the entry's. Description and Memo came over from the Journal
   entries tab on 2026-09-30 and went again the same day - Mahad: *"Can we remove
   Description and Memo from the transaction tab table in posting account detail
   page?"* They stay on the Journal entries tab, where a row is the whole entry.

   Read against 11130 Operating - Chase Bank, which posts most days. */

const headers = (page: Page) =>
  page.$$eval('thead tr th', ths => ths.map(t => t.innerText.trim().split('\n')[0]).filter(Boolean))

test('carries the line\'s columns, and neither Description nor Memo', async ({ page }) => {
  await page.goto('/chart-of-accounts/acct_11130', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Transactions', exact: true }).first().click()
  await page.locator('tbody tr').first().waitFor()
  expect(await headers(page)).toEqual([
    'Date', 'Journal entry number', 'Source', 'Linked document',
    'Line description', 'Dimensions', 'Debit', 'Credit', 'Running balance',
  ])
  // Not merely hidden: the Columns panel offers neither.
  await page.getByRole('button', { name: /^Columns/ }).first().click()
  const panel = page.locator('[data-col-key]')
  await expect(panel.first()).toBeVisible()
  const offered = await panel.evaluateAll(els => els.map(e => e.getAttribute('data-col-key')))
  expect(offered).not.toContain('entryDescription')
  expect(offered).not.toContain('memo')
})
