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

/* The first-time Number length step sets the block each category keeps again.
   Mahad, 2026-10-01: *"We had setting up the ranges in the first-time view
   before. Can we bring it back?"* Locked until Edit ranges is pressed; each row
   says what is wrong with it and Continue waits; and the chart the flow builds
   holds the blocks the step stated. */

async function firstTime(page: Page) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody tr').first().waitFor()
  await page.getByRole('button', { name: /View as first-time user/ }).click()
  await expect(page.getByText('Set up your chart of accounts')).toBeVisible()
  // Walked, not navigated to: a reload re-reads the saved tenant before the reset
  // has been written out.
  await page.getByRole('button', { name: 'Continue' }).click()
}

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true })
const continueBtn = (page: Page) => page.getByRole('button', { name: 'Continue' }).last()

test('build from scratch: edits a block, refuses an overlap, and builds the chart on it', async ({ page }) => {
  await firstTime(page)
  await page.getByRole('button', { name: 'Start building' }).click()
  await expect(page.getByText('Set up your account numbers')).toBeVisible()
  // The step's welcome opens a moment after it does (2026-10-02); closed first,
  // or it lands over whatever this test is pressing at the time.
  await page.getByRole('button', { name: 'Skip for now' }).click()

  // Locked until asked.
  await expect(field(page, 'Assets to')).toBeDisabled()
  await expect(field(page, 'Assets to')).toHaveValue('19999')
  await page.getByRole('button', { name: 'Edit ranges' }).click()
  await expect(field(page, 'Assets to')).toBeEnabled()

  // An overlap is refused on both rows. Continue stays pressable and, pressed,
  // lists both and stays on the step (decision 120; module review, COA-28).
  await field(page, 'Assets to').fill('25000')
  await expect(page.getByText('Assets overlaps the Liabilities range, 20000 to 29999.')).toBeVisible()
  await expect(page.getByText('Liabilities overlaps the Assets range, 10000 to 25000.')).toBeVisible()
  await continueBtn(page).click()
  await expect(page.locator('[data-range-summary]')).toContainText("These ranges can't be saved yet - 2 things to fix.")
  await expect(page.getByText('Set up your account numbers')).toBeVisible()

  await field(page, 'Assets to').fill('14999')
  await expect(page.getByText(/overlaps/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(field(page, 'Assets to')).toBeDisabled()
  await expect(field(page, 'Assets to')).toHaveValue('14999')

  await continueBtn(page).click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('button', { name: 'Add account' }).first()).toBeVisible()
  // Published, the chart's Assets account reserves the block the step was given.
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  const assets = page.locator('tbody tr').filter({ hasText: /^\s*10000/ }).first()
  await expect(assets).toContainText('10000–14999')
})

test('a new length resets the blocks to that length\'s defaults', async ({ page }) => {
  await firstTime(page)
  await page.getByRole('button', { name: 'Start building' }).click()
  await page.getByRole('button', { name: 'Edit ranges' }).click()
  await field(page, 'Assets to').fill('14999')
  await page.getByRole('button', { name: 'Default account number length: one fewer digit' }).click()
  await expect(field(page, 'Assets from')).toHaveValue('1000')
  await expect(field(page, 'Assets to')).toHaveValue('1999')
})

test('guided setup: numbers its accounts inside the block it was given', async ({ page }) => {
  await firstTime(page)
  await page.getByRole('button', { name: 'Start guided setup' }).click()
  await expect(page.getByText('Set up your account numbers')).toBeVisible()
  await skipTour(page)
  await page.getByRole('button', { name: 'Edit ranges' }).click()
  await field(page, 'Expenses from').fill('60000')
  await field(page, 'Expenses to').fill('69999')
  await continueBtn(page).click()
  // The accounting method is the one required answer (2026-10-02).
  await page.getByRole('button', { name: /^Accrual basis/ }).click()
  await skipGuidedDimensions(page)
  // Every expense on the preview is numbered in 60000-69999.
  const expenses = page.locator('tbody tr').filter({ hasText: /^\s*6\d{4}/ })
  await expect(expenses.first()).toBeVisible()
  const numbers = (await page.locator('tbody tr').allInnerTexts()).map(t => t.match(/\b([1-9]\d{4})\b/)?.[1]).filter(Boolean).map(Number)
  expect(numbers.some(n => n >= 60000 && n <= 69999)).toBe(true)
  expect(numbers.some(n => n >= 50000 && n <= 59999), 'nothing left in the default expense block').toBe(false)
})
