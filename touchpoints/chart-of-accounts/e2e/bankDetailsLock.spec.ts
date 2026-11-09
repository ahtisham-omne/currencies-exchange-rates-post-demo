import { test, expect } from '@playwright/test'

/* Mahad, 2026-10-11: *"Bank and credit card details should also lock after
   first transaction."* 11130 has postings, so its bank details are stated with
   a padlock, not offered as fields. */
test('a bank account with postings locks its bank details', async ({ page }) => {
  await page.goto('/chart-of-accounts/acct_11130', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Edit Account' }).click()
  const form = page.locator('body > div.fixed').filter({ hasText: 'Edit GL account' }).last()
  await form.getByRole('button', { name: /Bank details/ }).first().click()
  const locked = form.locator('[data-bank-details-locked]')
  await expect(locked).toBeVisible()
  for (const label of ['Bank name', 'Account number', 'Account title', 'Bank account type']) {
    await expect(locked.getByText(label, { exact: true })).toBeVisible()
  }
  await expect(locked).toContainText('JPMorgan Chase Bank')
  await expect(locked.locator('input')).toHaveCount(0)
  await expect(locked.locator('button[aria-haspopup="listbox"]')).toHaveCount(0)
  // Each padlock says why.
  await locked.locator('svg.lucide-lock').first().hover()
  await expect(page.getByText("Entries have posted to this bank account, so its bank details can't be changed.")).toBeVisible()
})

test('a locked bank name stops pointing at the bank list', async ({ page }) => {
  await page.goto('/chart-of-accounts/acct_11130', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Edit Account' }).click()
  const form = page.locator('body > div.fixed').filter({ hasText: 'Edit GL account' }).last()
  await form.getByRole('button', { name: /Bank details/ }).first().click()
  await expect(form.getByText('A manually typed bank name can’t be connected.', { exact: true })).toBeVisible()
  await expect(form.getByText(/Pick your bank from the list above/)).toHaveCount(0)
  await form.screenshot({ path: 'test-results/bank-details-locked.png' })
})
