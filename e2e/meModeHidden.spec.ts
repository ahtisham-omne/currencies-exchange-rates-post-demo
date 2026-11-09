import { test, expect, type Page, type Locator } from '@playwright/test'

/* Me mode is hidden for now. Mahad, 2026-09-30: *"Hide me mode feature from this
   entire module for now please. Also, when I create something, the table shows a
   user icon next to the checkbox, that would also be a part of me mode, so please
   hide it for now."* Kept in the code behind `ME_MODE` (src/lib/features.ts).

   Read with an account the reader has just created on the chart, because that
   is the one row the icon was ever drawn on - a chart of seeded accounts would
   pass whether or not the icon was hidden. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()
const field = (m: Locator, label: string) =>
  m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)

async function createAccount(page: Page, number: string, name: string) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  await page.getByRole('button', { name: /Create GL account/ }).click()
  const m = modal(page)
  await m.getByRole('button', { name: /Continue/ }).first().click()
  await m.getByText('GL account details').first().waitFor()
  await field(m, 'GL account type').locator('button[aria-haspopup="listbox"]').click()
  await page.getByRole('option', { name: 'Posting', exact: true }).click()
  // The form no longer picks a parent (Mahad, 2026-10-08).
  await field(m, 'Parent').locator('button[aria-haspopup="listbox"]').first().click()
  await page.getByRole('option', { name: /11000/ }).first().click()
  await field(m, 'GL account no.').locator('input').fill(number)
  await field(m, 'GL account name').locator('input').fill(name)
  const commit = m.getByRole('button', { name: 'Create account', exact: true })
  for (let step = 0; step < 6 && !(await commit.count()); step++) {
    await m.getByRole('button', { name: /^Continue$/ }).first().click()
    await page.waitForTimeout(120)
  }
  await commit.click()
  await expect(modal(page)).toHaveCount(0)
}

test('offers no Me mode pill, and marks no row as yours', async ({ page }) => {
  await createAccount(page, '1376', 'Own probe account')
  // Creating opens the new account's page; back to the chart in-app, so the
  // store's delayed save is not raced by a reload.
  await page.getByTitle('Back to Chart of Accounts').first().click()
  await page.waitForSelector('thead th')
  // The pill row is drawn - Dimensions stands in it - with no Me mode among it.
  await expect(page.getByRole('button', { name: /Dimensions/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /^Me mode/ })).toHaveCount(0)

  // Found by search, which opens the branch it was filed under.
  await page.getByPlaceholder('Search accounts').fill('Own probe account')
  const row = page.locator('tbody tr').filter({ hasText: 'Own probe account' }).first()
  await expect(row).toBeVisible()
  // The checkbox cell holds the checkbox and nothing else.
  const cell = row.locator('td').first()
  await expect(cell.locator('input[type="checkbox"]')).toHaveCount(1)
  await expect(cell.locator('svg')).toHaveCount(0)
})
