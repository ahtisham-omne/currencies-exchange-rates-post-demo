import { test, expect, type Page, type Locator } from '@playwright/test'

/* Your business leads to Dimensions now (2026-10-08). Skipped here: its tour's
   welcome is closed if it comes up, then the step is skipped. */
async function skipGuidedDimensions(page: Page) {
  await page.getByRole('button', { name: 'Continue' }).last().click()
  await expect(page.getByRole('heading', { name: 'What do you want to report by?' })).toBeVisible()
  const welcome = page.getByRole('button', { name: 'Skip for now' })
  await welcome.waitFor({ timeout: 2500 }).then(() => welcome.click()).catch(() => {})
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
}


/* The search on the setup Accounts steps, the import review grid and Merge
   reads every column as it prints and marks what it found, the way the chart
   listing does. Mahad, 2026-10-05: *"can we have that on all searchable tables
   in the COA module? ... the search should have everything in it ... do this
   carefully for both active and hidden columns."* Where a table hides columns,
   one a search matched in comes out for the search under the note, and goes
   back when the search is cleared. */

const note = (page: Page) => page.locator('[data-search-revealed]')
const headers = (scope: Locator) =>
  scope.locator('thead tr th').evaluateAll(ths => ths.map(t => (t as HTMLElement).innerText.trim().split('\n')[0]))

async function firstTime(page: Page, path: 'Start building' | 'Start guided setup') {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody tr').first().waitFor()
  await page.getByRole('button', { name: /View as first-time user/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: path }).click()
  await page.getByRole('button', { name: 'Continue' }).last().click()
}


test('build from scratch: marks a shown column, and brings out a hidden one it matched', async ({ page }) => {
  await firstTime(page, 'Start building')
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: /^Skip$/ }).last().click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  const table = page.locator('[data-walkthrough="chart-table"] table').first()
  const search = page.getByPlaceholder('Search accounts…')

  // Shown: the number.
  await search.fill('20000')
  await expect(table.locator('tbody mark').first()).toHaveText('20000')

  // Hidden: Status ships off on this step; every category reads Active.
  expect(await headers(table)).not.toContain('Status')
  await search.fill('active')
  await expect(note(page)).toContainText('Status')
  expect(await headers(table)).toContain('Status')
  // The Status chips carry the mark.
  await expect(table.locator('tbody mark', { hasText: /^active$/i }).first()).toBeVisible()

  await search.fill('')
  await expect(note(page)).toHaveCount(0)
  expect(await headers(table)).not.toContain('Status')
})

test('guided setup: marks a shown column, and brings out a hidden one it matched', async ({ page }) => {
  await firstTime(page, 'Start guided setup')
  await page.getByRole('button', { name: /^Accrual basis/ }).click()
  await skipGuidedDimensions(page)
  const table = page.locator('[data-walkthrough="chart-table"] table').first()
  const search = page.getByPlaceholder('Search accounts…')

  await search.fill('petty')
  await expect(table.locator('tbody mark').first()).toHaveText(/petty/i)

  // Status ships off here, and every account the step builds reads Active.
  expect(await headers(table)).not.toContain('Status')
  await search.fill('active')
  await expect(note(page)).toHaveText('Your search also matched Status, so that column is shown while you search.')
  expect(await headers(table)).toContain('Status')
  await expect(table.locator('tbody mark', { hasText: /^active$/i }).first()).toBeVisible()

  await search.fill('')
  await expect(note(page)).toHaveCount(0)
  expect(await headers(table)).not.toContain('Status')
})

const FILE = {
  name: '_search-review.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from([
    'Account Number,Account Name,Type,GL Account Type',
    '7100,Marketing,Expense,Posting',
    '7100,Marketing Again,Expense,Posting',
    '7200,Perfectly Fine,Expense,Posting',
  ].join('\n')),
}

test('import review: finds and marks a row by any column, its Result included', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody tr').first().waitFor()
  await page.getByRole('button', { name: 'Actions', exact: true }).click()
  await page.getByText('Import', { exact: true }).click()
  await page.locator('input[type=file]').waitFor({ state: 'attached' })
  await page.locator('input[type=file]').setInputFiles(FILE)
  await expect(page.getByText(FILE.name)).toBeVisible()
  const skip = page.getByRole('button', { name: 'Skip' }).first()
  if (await skip.isVisible().catch(() => false)) await skip.click()
  await expect(page.locator('[data-wizard-overlay]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Review data' }).click()
  await expect(page.getByText('Review and fix your data')).toBeVisible()

  const search = page.getByPlaceholder('Search accounts…')
  // The grid's own rows: the chart behind the modal is a table too.
  const rows = page.locator('tbody tr', { has: page.locator('td[data-cell-key]') })

  await search.fill('perfectly')
  await expect(rows).toHaveCount(1)
  await expect(rows.first().locator('mark')).toHaveText(/perfectly/i)

  // The Result column: the two repeats of 7100 read Error.
  await search.fill('error')
  await expect(rows).toHaveCount(2)
  await expect(rows.first().locator('td').nth(2).locator('mark')).toHaveText('Error')

  await search.fill('')
  await expect(rows).toHaveCount(3)
})

test('merge: finds and marks an account by its balance and its number', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody tr').first().waitFor()
  await page.goto('/merge?source=acct_52110', { waitUntil: 'networkidle' })
  const table = page.locator('table').first()
  const firstRow = table.locator('tbody tr').first()
  const balance = (await firstRow.locator('td').nth(3).innerText()).trim()
  const all = await table.locator('tbody tr').count()
  // Typed without its separators, as a figure read off a statement often is.
  const digits = balance.replace(/[^\d.]/g, '').replace(/\.00$/, '')
  // The page's own box, not the app bar's.
  const search = page.locator('main input[placeholder="Search…"], input.input[placeholder="Search…"]').last()
  await search.fill(digits)
  await expect(table.locator('tbody tr').first().locator('td').nth(3).locator('mark')).toBeVisible()

  await search.fill('52110')
  await expect(table.locator('tbody tr', { hasText: '52110' }).first().locator('mark')).toHaveText('52110')
  await search.fill('')
  await expect(table.locator('tbody tr')).toHaveCount(all)
})
