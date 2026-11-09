import { test, expect, type Page } from '@playwright/test'

/* The internal ID, shown, as settled in the design review of 2026-09-24. Eli:
   *"So the system ID, expose it in the table so it becomes searchable ... And
   expose it in the detail view of the item. You could put it at the bottom in a
   bottom card, something out of the way."*

   Read against the demo chart, where the ids are stamped in chart order: Petty
   Cash 11110 is ACC-000004 and Cash and Cash Equivalents 11100 is ACC-000003.

   In a browser because the promises are about what is drawn: a column that
   renders, a search that narrows, a field on both page templates. */

const headers = (page: Page) =>
  page.$$eval('thead tr th', ths => ths.map(t => t.innerText.trim().split('\n')[0]).filter(Boolean))

async function cellIn(page: Page, row: string, header: string) {
  const th = page.locator('thead th', { hasText: header })
  const i = await th.evaluate(el => Array.from(el.parentElement!.children).indexOf(el))
  return page.locator('tbody tr', { hasText: row }).first().locator('td').nth(i)
}

async function toggleColumn(page: Page, key: string) {
  await page.getByRole('button', { name: /columns/i }).first().click()
  // The eye, not the last button: a row that is on also offers Freeze.
  await page.locator(`[data-col-key="${key}"]`).getByTitle(/^(Hide|Show) column$/).click()
  await page.getByRole('button', { name: /columns/i }).first().click()
}

/* The field in the rail, found by its label and read as the block around it. */
const railField = (page: Page) =>
  page.locator('div.min-w-0').filter({ has: page.locator('p', { hasText: /^Internal ID$/ }) }).last()

test.describe('on the listing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.waitForSelector('thead th')
  })

  test('ships hidden, and is in the Columns panel to turn on', async ({ page }) => {
    expect(await headers(page)).not.toContain('Internal ID')
    await toggleColumn(page, 'internalId')
    expect(await headers(page)).toContain('Internal ID')
    await expect(await cellIn(page, 'Petty Cash', 'Internal ID')).toHaveText('ACC-000004')
  })

  test('is found by search with the column off', async ({ page }) => {
    await page.getByPlaceholder('Search accounts').fill('ACC-000004')
    await expect(page.locator('tbody tr', { hasText: 'Petty Cash' })).toHaveCount(1)
    // Its siblings are gone; only the summaries above it stay, to place it.
    await expect(page.locator('tbody tr', { hasText: 'Operating - Chase Bank' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Petty Cash', exact: true })).toBeVisible()
  })

  /* Mahad, 2026-09-30: *"make sure that the internal ID is searchable and is
     highlighted in yellow when we search."* Marked the way the name and number
     are, whole or in part, and in no other row. */
  for (const typed of ['ACC-000004', 'acc-000004', '000004']) {
    test(`marks "${typed}" in the Internal ID column`, async ({ page }) => {
      await toggleColumn(page, 'internalId')
      await page.getByPlaceholder('Search accounts').fill(typed)
      await expect(page.locator('tbody tr', { hasText: 'Petty Cash' })).toHaveCount(1)
      const cell = await cellIn(page, 'Petty Cash', 'Internal ID')
      const mark = cell.locator('mark')
      await expect(mark).toHaveCount(1)
      await expect(mark).toHaveText(typed === '000004' ? '000004' : 'ACC-000004')
      // The page's yellow, not merely a <mark>.
      expect(await mark.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(254, 240, 138)')
      // The summaries kept above it to place it do not match, so carry no mark.
      await expect(page.locator('tbody tr', { hasNotText: 'Petty Cash' }).locator('mark')).toHaveCount(0)
    })
  }
})

test.describe('on the account page', () => {
  test('sits in the bottom block of a posting account\'s rail', async ({ page }) => {
    await page.goto('/chart-of-accounts/acct_11110', { waitUntil: 'networkidle' })
    await expect(railField(page)).toContainText('ACC-000004')
    await expect(railField(page).getByRole('button', { name: 'Copy internal ID' })).toBeVisible()
  })

  test('sits in the bottom block of a summary account\'s rail', async ({ page }) => {
    await page.goto('/chart-of-accounts/acct_11100', { waitUntil: 'networkidle' })
    await expect(railField(page)).toContainText('ACC-000003')
  })

  test('copies the id', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/chart-of-accounts/acct_11110', { waitUntil: 'networkidle' })
    await railField(page).getByRole('button', { name: 'Copy internal ID' }).click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('ACC-000004')
  })
})
