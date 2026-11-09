import { test, expect, type Page } from '@playwright/test'

/* Mahad, 2026-10-08: a category's Add row opens the create form on its first
   step, where the category is already picked and the statement line - current
   or non-current - is still asked. Every category, both setups. */

async function firstTime(page: Page, path: 'Start building' | 'Start guided setup') {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody tr').first().waitFor()
  await page.getByRole('button', { name: /View as first-time user/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: path }).click()
}

async function toScratchAccounts(page: Page) {
  await firstTime(page, 'Start building')
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: 'Continue' }).last().click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: /^Skip$/ }).last().click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
}

/* Build from scratch, where every category starts empty and so carries an Add
   row. Guided setup draws the same control, and passes the same request to the
   same form, but only under a category it has emptied. */
{
  test("build from scratch: a category's Add row asks current or non-current first", async ({ page }) => {
    await toScratchAccounts(page)
    // The rows run Asset, Liability, ... so the second Add row is Liability's.
    await page.getByRole('button', { name: /Add row/ }).nth(1).click()
    await expect(page.getByText('What kind of account is this?')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Current liability/ })).toBeVisible()
    await page.getByRole('button', { name: /^Non-current liability/ }).click()
    await expect(page.getByRole('button', { name: /^Non-current liability/ })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: /Continue/ }).last().click()
    await expect(page.getByText('GL account details').first()).toBeVisible()
  })
}
