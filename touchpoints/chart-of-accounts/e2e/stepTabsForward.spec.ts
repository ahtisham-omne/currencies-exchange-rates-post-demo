import { test, expect, type Page } from '@playwright/test'

/* Your business leads to Dimensions now (2026-10-08). Skipped here: its tour's
   welcome is closed if it comes up, then the step is skipped. */
async function skipGuidedDimensions(page: Page) {
  await page.getByRole('button', { name: 'Continue' }).last().click()
  await expect(page.getByRole('heading', { name: 'What do you want to report by?' })).toBeVisible()
  const welcome = page.getByRole('button', { name: 'Skip for now' })
  await welcome.waitFor({ timeout: 2500 }).then(() => welcome.click()).catch(() => {})
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
}


/* A step's welcome opens a moment after the step does (2026-10-02). Closed if it
   came, so it never lands over whatever the test is pressing at the time. */
async function skipTour(page: Page) {
  try { await page.getByRole('button', { name: 'Skip for now' }).click({ timeout: 2500 }) } catch { /* none came */ }
}

/* Step tabs go forward to any step already reached, across the setup flows -
   Mahad, 2026-10-01: *"Please implement this across the board so that we can
   navigate between steps from the top navigation bar, but only after those
   steps have been completed/filled out."* A step changed since and no longer
   complete holds the jump, as its Continue would. */

async function firstTime(page: Page) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody tr').first().waitFor()
  await page.getByRole('button', { name: /View as first-time user/ }).click()
  await expect(page.getByText('Set up your chart of accounts')).toBeVisible()
}
const tab = (page: Page, label: string) => page.getByRole('button', { name: new RegExp(`^\\d?\\s*${label}$`) }).first()

test('the first-time landing: Choose setup stays open after going back to Fiscal year', async ({ page }) => {
  await firstTime(page)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Choose how to begin')).toBeVisible()
  await tab(page, 'Fiscal year').click()
  await expect(page.getByText('Choose how to begin')).toHaveCount(0)
  await tab(page, 'Choose setup').click()
  await expect(page.getByText('Choose how to begin')).toBeVisible()
})

test('build from scratch: forward to Accounts from Number length, held while a range is wrong', async ({ page }) => {
  await firstTime(page)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start building' }).click()
  await page.getByRole('button', { name: 'Continue' }).last().click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('button', { name: 'Add account' }).first()).toBeVisible()

  await tab(page, 'Number length').click()
  await expect(page.getByText('Set up your account numbers')).toBeVisible()
  await tab(page, 'Accounts').click()
  await expect(page.getByRole('button', { name: 'Add account' }).first()).toBeVisible()

  // Break a range, and the jump stops on the step that broke.
  await tab(page, 'Number length').click()
  await page.getByRole('button', { name: 'Edit ranges' }).click()
  await page.getByLabel('Assets to', { exact: true }).fill('25000')
  await tab(page, 'Accounts').click()
  await expect(page.getByText('Set up your account numbers')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add account' })).toHaveCount(0)
})

test('guided setup: forward to the review from the number length, once reached', async ({ page }) => {
  await firstTime(page)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start guided setup' }).click()
  await page.getByRole('button', { name: 'Continue' }).last().click()
  // The accounting method is the one required answer (2026-10-02).
  await page.getByRole('button', { name: /^Accrual basis/ }).click()
  await skipGuidedDimensions(page)
  await expect(page.getByRole('button', { name: 'Publish chart' })).toBeVisible()
  await skipTour(page)
  await tab(page, 'Number length').click()
  await expect(page.getByText('Set up your account numbers')).toBeVisible()
  // The review is the last tab; open it from the bar.
  await tab(page, 'Add your accounts').click()
  await expect(page.getByRole('button', { name: 'Publish chart' })).toBeVisible()
})
