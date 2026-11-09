import { test, expect, type Page, type Locator } from '@playwright/test'
import { settle, view } from './glPage'

/* An entry posted by hand to an account the system keeps. Mahad, 2026-10-05:
   - On its page, vendor invoicing's exception banner in place of the Flags card
     in the rail: *"See how we have this in vendor invoicing. We want this
     instead."*
   - A more prominent badge than the bare triangle on the line, used in the
     listing too: *"Please make sure to use it in the listing table as well both
     in general ledger and journal entries. please use our own UI patterns."*

   Posted from the form in the test: the seed carries no adjustment. Reached
   inside the app afterwards, never by a reload, which can outrun the save. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'New journal entry' }).last()
const linePicker = (m: Locator, row = 0) => m.locator('table button[aria-haspopup="listbox"]').nth(row)

async function fillLine(page: Page, m: Locator, row: number, number: string, col: 'debit' | 'credit', amount: string) {
  await linePicker(m, row).click()
  const list = page.getByRole('listbox').last()
  await list.getByPlaceholder('Search account by name or number').fill(number)
  await list.getByRole('option').filter({ hasText: `${number} · ` }).first().click()
  await expect(list).toHaveCount(0)
  await m.locator('table').getByLabel(col, { exact: true }).nth(row).fill(amount)
}

const REASON = '2025 insurance expense was 500 short'

async function postAdjustment(page: Page) {
  await settle(page, '/general-ledger')
  await page.getByRole('button', { name: 'New journal entry' }).first().click()
  const m = modal(page)
  await m.getByText('Journal lines').first().waitFor()
  await fillLine(page, m, 0, '32200', 'debit', '500')
  await fillLine(page, m, 1, '11130', 'credit', '500')
  await m.getByLabel('Reason for this adjustment').fill(REASON)
  await m.getByRole('button', { name: 'Post journal entry' }).click()
  await page.waitForURL(/\/general-ledger\/entry\//)
  return decodeURIComponent(page.url().split('/entry/')[1])
}

test('the entry page carries the banner, not a Flags card, and badges the line', async ({ page }) => {
  await postAdjustment(page)
  const banner = page.locator('[data-system-account-flag-card]')
  await expect(banner).toBeVisible()
  await expect(banner).toContainText('Retained earnings adjustment')
  await expect(banner.getByText('Reason', { exact: true })).toBeVisible()
  await expect(banner).toContainText(REASON)
  await expect(banner).toContainText(/ · by .+ on [A-Z][a-z]{2} \d{1,2}, \d{4} at \d{1,2}:\d{2} [AP]M$/)
  // Nothing to resolve: the entry has posted.
  await expect(banner.getByRole('button')).toHaveCount(0)
  // Above the tabs' content, not in the rail.
  await expect(page.getByText('Flags', { exact: true })).toHaveCount(0)
  const lines = page.locator('table').filter({ hasText: 'Debit' }).first()
  const above = (await banner.boundingBox())!
  expect(above.y).toBeLessThan((await lines.boundingBox())!.y)

  // The line that made it an adjustment carries the badge; the other does not.
  const flagged = lines.locator('tr', { hasText: '32200' })
  await expect(flagged.locator('[data-adjustment-badge]')).toHaveText('Adjustment')
  await expect(lines.locator('tr', { hasText: '11130' }).locator('[data-adjustment-badge]')).toHaveCount(0)
  await expect(lines.locator('[data-adjustment-badge]')).toHaveCount(1)
  await banner.screenshot({ path: 'test-results/je-adjustment-banner.png' })
})

test('the ledger badges the entry and its line on both tabs, and search finds the badge', async ({ page }) => {
  const je = await postAdjustment(page)
  await page.getByTitle('Back to General Ledger').first().click()
  await page.locator('table tbody tr').first().waitFor()

  // Journal entries: the entry row, and the line under it once open.
  await view(page, 'Journal entries').click()
  const search = page.getByPlaceholder(/Search entries/)
  await search.fill(je)
  const entryRow = page.locator('tbody tr', { hasText: je }).first()
  await expect(entryRow.locator('[data-adjustment-badge]')).toHaveText('Adjustment')
  // Level with the entry number beside it. It sat a couple of pixels low, the
  // number riding its text's baseline and the badge on align-middle (Mahad,
  // 2026-10-09: *"please fix the alignment issue of the yellow pill"*).
  const centres = await entryRow.evaluate(tr => {
    const badge = tr.querySelector('[data-adjustment-badge]')!.firstElementChild!
    const number = badge.closest('td')!.querySelector('button')!
    const mid = (e: Element) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2 }
    return { number: mid(number), badge: mid(badge) }
  })
  expect(Math.abs(centres.badge - centres.number)).toBeLessThanOrEqual(0.5)
  await entryRow.click()
  const line = page.locator('tbody tr', { hasText: '32200' }).first()
  await expect(line.locator('[data-adjustment-badge]')).toBeVisible()
  await expect(page.locator('tbody tr', { hasText: '11130' }).first().locator('[data-adjustment-badge]')).toHaveCount(0)
  await page.locator('tbody').first().screenshot({ path: 'test-results/je-adjustment-entries.png' })

  // A search for the badge's word finds it and marks it.
  await search.fill('adjustment')
  await expect(page.locator('[data-adjustment-badge] mark').first()).toHaveText(/adjustment/i)

  // General ledger: the posting under 32200.
  await view(page, 'General ledger').click()
  const tree = page.getByPlaceholder(/Search postings/)
  await tree.fill(je)
  const acctRow = page.locator('tbody tr', { hasText: '32200' }).first()
  await expect(acctRow).toBeVisible()
  const posting = page.locator('tbody tr', { hasText: je }).filter({ has: page.locator('[data-adjustment-badge]') })
  // A search that found the posting opens the account onto it.
  await expect(posting.first()).toBeVisible()
  await expect(posting).toHaveCount(1)
  // Only the line to the system-kept account: 11130 is the ordinary side.
  await expect(page.locator('tbody tr', { hasText: '11130' }).locator('[data-adjustment-badge]')).toHaveCount(0)
  await page.locator('table').first().screenshot({ path: 'test-results/je-adjustment-tree.png' })
})
