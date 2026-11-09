import { test, expect } from '@playwright/test'

/* An account in another currency archives the way a USD one does. Mahad,
   2026-10-10: *"When I try to archive an account that has another currency
   other than USD, make sure we have the same behavior as we have in the USD
   account for now."* It used to be offered only accounts in its own currency,
   found none, and was refused. Now it is offered the same accounts, and the move
   is stated in the base currency its balance is held in. */
test('a EUR account moves its balance and archives, like a USD one', async ({ page }) => {
  await page.goto('/chart-of-accounts/acct_11170', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Account actions' }).click()
  await page.getByRole('button', { name: /^Archive/ }).last().click()
  const d = page.getByRole('alertdialog')
  await expect(d).toContainText("Archived accounts can't hold a balance. Transfer the $ 148,600.00 to another account first.")

  await d.getByRole('button', { name: /Select account/ }).click()
  const options = page.getByRole('option')
  // Dollars and pounds alike, every cash account under 11100.
  await expect(options.filter({ hasText: '11130 Operating - Chase Bank' })).toHaveCount(1)
  await expect(options.filter({ hasText: '11160 Savings - Barclays' })).toHaveCount(1)
  await options.filter({ hasText: '11130 Operating - Chase Bank' }).click()
  await expect(d.getByText('GL impact')).toBeVisible()

  await d.getByRole('button', { name: 'Move and archive' }).click()
  await expect(d).toHaveCount(0)
  await expect(page.locator('h1').first().locator('xpath=..')).toContainText('Archived')
})
