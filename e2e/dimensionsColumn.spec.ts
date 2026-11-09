import { test, expect, type Page } from '@playwright/test'

/* The Dimensions column reads off each account's own defaults, and for a long
   time every seeded account had none - so the column rendered a dash on all 136
   rows and looked broken rather than empty. The data is asserted in
   src/lib/seedDimensions.test.ts; what is pinned here is that it reaches the
   screen, which a test over the seed module cannot tell you. */

const dimsCell = (page: Page, rowText: string) =>
  page.locator('tbody tr', { hasText: rowText }).first().locator('td').nth(3)

test.describe('the chart says how its accounts are cut', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.waitForSelector('thead th')
  })

  test('shows the column without being asked', async ({ page }) => {
    // Fourth column, which is what dimsCell indexes on below.
    const heads = await page.$$eval('thead th', ths => ths.map(t => t.innerText.trim().split('\n')[0]))
    expect(heads[3]).toBe('Dimensions')
  })

  test('names the dimension as well as the value', async ({ page }) => {
    // "United Kingdom" alone would not say which dimension it came from.
    await expect(dimsCell(page, 'Savings - Barclays')).toContainText('Location: United Kingdom')
    await expect(dimsCell(page, 'Operating - Chase Bank')).toContainText('Location: USA')
  })

  /* An account carries a default only where its own identity fixes the answer.
     Trade Receivables is owed by customers everywhere, so its dash is the right
     answer and not a hole - pinned so nobody "fixes" it by tagging every row. */
  test('leaves the accounts that no single value fits alone', async ({ page }) => {
    await expect(dimsCell(page, 'Trade Receivables')).toHaveText('-')
    await expect(dimsCell(page, 'Product Sales')).toHaveText('-')
  })

  test('folds the second dimension into a +1 the reader can open', async ({ page }) => {
    const cell = dimsCell(page, 'Raw Materials')
    await expect(cell).toContainText('Location: Singapore')
    await cell.getByText('+1').hover()
    // The card portals to the body, same as Menu and Tooltip do.
    await expect(page.locator('body > div.fixed').last()).toContainText('Operations')
  })
})
