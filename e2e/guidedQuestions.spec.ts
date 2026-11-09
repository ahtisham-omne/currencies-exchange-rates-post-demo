import { test, expect, type Page } from '@playwright/test'

/* The guided wizard's questions, as specced by Mahad on 2026-10-02: nine of
   them, ownership and sales tax for US businesses only, the accounting method
   required, and "None of these" clearing the other long-term asset choices. */

async function questions(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody tr').first().waitFor()
  await page.getByRole('button', { name: /View as first-time user/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start guided setup' }).click()
  await page.getByRole('button', { name: 'Continue' }).last().click()
  await expect(page.getByText('Where is your business based?')).toBeVisible()
  // The questions have their own introduction now (design review, 2026-10-02).
  await page.getByRole('button', { name: 'Skip for now' }).click()
}

async function pickCountry(page: Page, name: string) {
  await page.getByText('Choose a country').click()
  // Filled rather than typed: the search box takes focus a frame after opening.
  await page.getByPlaceholder('Search countries…').fill(name)
  await page.getByRole('option', { name: new RegExp(name) }).first().click()
}

test('asks a US business all nine, and waits for the accounting method', async ({ page }) => {
  await questions(page)
  await pickCountry(page, 'United States')
  for (const title of [
    'What does your business do?', 'Which accounting method does your business use?',
    'How is your business legally set up?', 'How do customers pay you?', 'How do you pay vendors?',
    'Do you collect sales tax from customers?', 'Do you have employees on payroll?',
    'Do you own or lease long-term assets, or have business loans?',
  ]) await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByText(/Our tailored setup is currently only available/)).toHaveCount(0)

  // Continue leads to Dimensions now (2026-10-08); it waits on the method all the
  // same, but by saying so when pressed rather than by being disabled (design
  // review, 2026-10-08).
  const review = page.getByRole('button', { name: 'Continue' }).last()
  await expect(review).toBeEnabled()
  await review.click()
  await expect(page.locator('[data-step-summary]')).toContainText('Choose an accounting method.')
  await page.getByRole('button', { name: /^Accrual basis/ }).click()
  await expect(page.locator('[data-step-summary]')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/guided-questions-us.png', fullPage: true })
})

test('skips ownership and sales tax outside the US, and says so', async ({ page }) => {
  await questions(page)
  await pickCountry(page, 'United Kingdom')
  await expect(page.getByText("Our tailored setup is currently only available for US businesses. You can still answer the questions, and we'll create a general chart for you. Questions we don't have tailored support for, like ownership and sales tax, will be skipped.")).toBeVisible()
  await expect(page.getByRole('heading', { name: 'How is your business legally set up?' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Do you collect sales tax from customers?' })).toHaveCount(0)
  await page.screenshot({ path: 'test-results/guided-questions-gb.png' })
})

// Countries only: the Somewhere else row is gone (Mahad, 2026-10-02).
test('offers countries only, with no Somewhere else row', async ({ page }) => {
  await questions(page)
  await page.getByText('Choose a country').click()
  await expect(page.getByRole('option', { name: /United States/ })).toBeVisible()
  await expect(page.getByText('Somewhere else')).toHaveCount(0)
  await expect(page.getByText('Sales tax / VAT / GST')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/guided-country-list.png' })
})

test('lets None of these clear the other asset choices, and be cleared by them', async ({ page }) => {
  await questions(page)
  const own = page.getByRole('button', { name: /^We own equipment/ })
  const none = page.getByRole('button', { name: /^None of these/ })
  await own.click()
  await page.getByRole('button', { name: /^We have loans/ }).click()
  await none.click()
  await expect(none).toHaveAttribute('aria-pressed', 'true')
  await expect(own).toHaveAttribute('aria-pressed', 'false')
  await own.click()
  await expect(none).toHaveAttribute('aria-pressed', 'false')
})
