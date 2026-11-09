import { test, expect, type Page } from '@playwright/test'
import { settle, view } from './glPage'

/* A listing is as the reader left it when they come back from a record: the
   search, and the columns as they set them up. Mahad, 2026-10-09: *"if we search
   something and then go to the details page, the search should persist when we
   come back ... the columns that we configured should also be the same if we
   come back on the listing page. Right now when we go back the columns are back
   to defaults."* The chart already kept its search; the ledger kept nothing, and
   neither kept its columns. Held for the tab's session (useRememberedState), so a
   reload still starts afresh. */

const eye = (page: Page, key: string) => page.locator(`[data-col-key="${key}"]`).getByTitle(/^(Hide|Show) column$/)
const headers = (page: Page) => page.$$eval('thead tr th', ths => ths.map(t => (t as HTMLElement).innerText.trim().split('\n')[0]))

async function setUpColumns(page: Page, hide: string) {
  await page.getByRole('button', { name: /^Columns/ }).first().click()
  await eye(page, hide).click()
  await page.getByLabel('Close columns').click()
  // Comfort, from the density menu beside it.
  await page.getByRole('button', { name: /^Condensed/ }).first().click()
  await page.getByRole('menuitemradio', { name: /Comfort/ }).or(page.getByRole('button', { name: /^Comfort/ })).first().click()
  await expect(page.getByRole('button', { name: /^Comfort/ }).first()).toBeVisible()
}

test('the journal entries tab keeps its search and columns across an entry', async ({ page }) => {
  await settle(page, '/general-ledger')
  await view(page, 'Journal entries').click()
  // A column the search below cannot match, since a hidden column holding a
  // hit is shown for as long as the search is on (SearchReveal).
  await setUpColumns(page, 'reference')
  expect(await headers(page)).not.toContain('Linked document')
  const search = page.getByPlaceholder('Search entries')
  await search.fill('Manual')
  const first = page.locator('tr.gl-je-parent').first()
  await expect(first).toBeVisible()
  const shown = await page.getByText(/^\d[\d,]* of [\d,]+ entries$/).first().innerText()

  await first.getByTitle('Open journal entry').click()
  await page.waitForURL(/\/general-ledger\/entry\//)
  await expect(page.getByRole('button', { name: 'Reverse this entry' })).toBeVisible()
  await page.getByTitle('Back to General Ledger').first().click()
  await page.locator('tbody tr').first().waitFor()

  await expect(search).toHaveValue('Manual')
  await expect(page.getByText(shown, { exact: true }).first()).toBeVisible()
  expect(await headers(page)).not.toContain('Linked document')
  await expect(page.getByRole('button', { name: /^Comfort/ }).first()).toBeVisible()
})

test('the general ledger tab keeps its search and columns across the browser\'s back', async ({ page }) => {
  await settle(page, '/general-ledger')
  await view(page, 'General ledger').click()
  await setUpColumns(page, 'internalId')
  expect(await headers(page)).not.toContain('Journal entry ID')
  const search = page.getByPlaceholder('Search postings')
  await search.fill('Petty')
  await expect(page.getByText(/^\d[\d,]* of [\d,]+ postings$/).first()).toBeVisible()

  // Into an entry from a posting under the account the search opened, and back.
  const posting = page.locator('tbody tr').filter({ has: page.locator('button[title="Open journal entry"], a[href*="/entry/"]') }).first()
  await posting.locator('button[title="Open journal entry"], a[href*="/entry/"]').first().click()
  await page.waitForURL(/\/general-ledger\/entry\//)
  // The entry page itself, so the ledger has really gone before coming back.
  await expect(page.getByRole('button', { name: 'Reverse this entry' })).toBeVisible()
  await page.goBack()
  await page.locator('tbody tr').first().waitFor()

  await expect(search).toHaveValue('Petty')
  expect(await headers(page)).not.toContain('Journal entry ID')
  await expect(page.getByRole('button', { name: /^Comfort/ }).first()).toBeVisible()
})

test('the chart keeps its columns as well as its search across an account', async ({ page }) => {
  await settle(page, '/chart-of-accounts')
  await setUpColumns(page, 'classification')
  expect(await headers(page)).not.toContain('Statement classification')
  const search = page.getByPlaceholder('Search accounts')
  await search.fill('Petty')
  const row = page.locator('tbody tr', { hasText: 'Petty Cash' }).first()
  await expect(row).toBeVisible()

  await row.getByRole('button', { name: /Petty Cash/ }).first().click()
  await page.waitForURL(/\/chart-of-accounts\/acct_/)
  await expect(page.getByRole('button', { name: 'Edit Account' })).toBeVisible()
  await page.getByTitle('Back to Chart of Accounts').first().click()
  await page.locator('tbody tr').first().waitFor()

  await expect(search).toHaveValue('Petty')
  expect(await headers(page)).not.toContain('Statement classification')
  await expect(page.getByRole('button', { name: /^Comfort/ }).first()).toBeVisible()
})
