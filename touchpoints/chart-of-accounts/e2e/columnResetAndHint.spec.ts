import { test, expect, type Page } from '@playwright/test'
import { settle, view } from './glPage'

/* Mahad, 2026-10-01: *"Why is there a chevron icon in the dimensions column
   header? I think we are using this [up-down] icon everywhere else"* and *"reset
   button in the columns config is not working, it should make the table with
   default columns."* */

const headers = (page: Page) =>
  page.$$eval('thead tr th', ths => ths.map(t => (t as HTMLElement).innerText.trim().split('\n')[0]).filter(Boolean))
const columnsBtn = (page: Page) => page.getByRole('button', { name: /^Columns/ }).first()
const eye = (page: Page, key: string) => page.locator(`[data-col-key="${key}"]`).getByTitle(/^(Hide|Show) column$/)

test('the Dimensions header hints the way every header does, and sorts', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('tbody tr').first().waitFor()
  const th = page.locator('thead th', { hasText: 'Dimensions' }).first()
  await th.hover()
  await expect(th.locator('svg.lucide-arrow-up-down')).toHaveCount(1)
  await expect(th.locator('svg.lucide-chevron-down')).toHaveCount(0)
  // No header on the chart draws the chevron any more.
  await expect(page.locator('thead th svg.coa-col-hint.lucide-chevron-down')).toHaveCount(0)
  await th.getByRole('button').first().click()
  await expect(page.locator('[data-col-popover]')).toContainText(/Sort/)
})

/* Reset returns the table to how it opened: the default columns, in the default
   order, nothing frozen. It used to turn every column on. */
async function resetBringsBack(page: Page, change: () => Promise<void>) {
  const opened = await headers(page)
  await columnsBtn(page).click()
  await change()
  await page.waitForTimeout(150)
  expect(await headers(page), 'the change took').not.toEqual(opened)
  await page.getByRole('button', { name: 'Reset' }).first().click()
  await expect.poll(() => headers(page)).toEqual(opened)
}

test('the chart\'s Reset puts its default columns back', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('tbody tr').first().waitFor()
  await resetBringsBack(page, async () => {
    await eye(page, 'internalId').click()       // ships hidden: on
    await eye(page, 'classification').click()   // ships shown: off
  })
  // Not every column, as it used to.
  await expect(columnsBtn(page)).not.toContainText('18')
})

test('the ledger\'s Reset puts each tab\'s defaults back', async ({ page }) => {
  await settle(page, '/general-ledger')
  for (const tab of ['General ledger', 'Journal entries'] as const) {
    await view(page, tab).click()
    await page.locator('tbody tr').first().waitFor()
    await resetBringsBack(page, async () => {
      await eye(page, 'dimensions').click()
      await eye(page, 'source').click()
    })
    await page.keyboard.press('Escape')
    await columnsBtn(page).click()
  }
})

test('the account register\'s Reset puts every column back, in order', async ({ page }) => {
  await page.goto('/chart-of-accounts/acct_11130', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Transactions', exact: true }).first().click()
  await page.locator('tbody tr').first().waitFor()
  await resetBringsBack(page, async () => {
    await eye(page, 'source').click()
    await eye(page, 'dimensions').click()
  })
})
