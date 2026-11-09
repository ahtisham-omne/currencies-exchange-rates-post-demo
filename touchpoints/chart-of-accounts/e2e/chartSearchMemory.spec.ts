import { test, expect } from '@playwright/test'

/* Coming back to the chart from an account. Design review, 2026-09-28 - Eli:
   *"When I click on a detail and I go back, I lose the search that I'm looking
   at and it forgets it."* The search, the category pill, the filters and the
   view are what the reader was looking at, so all of them come back. */

const search = (page: import('@playwright/test').Page) => page.getByPlaceholder('Search accounts')

test('keeps the search when the reader opens an account and comes back', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await search(page).fill('petty')
  await expect(page.locator('tbody tr', { hasText: 'Operating - Chase Bank' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Petty Cash', exact: true }).click()
  await page.waitForURL(/\/chart-of-accounts\/acct_/)
  await page.goBack()

  await expect(search(page)).toHaveValue('petty')
  await expect(page.locator('tbody tr', { hasText: 'Petty Cash' })).toHaveCount(1)
  // Filtered from the first frame back, not after the whole chart flashes up.
  await expect(page.locator('tbody tr', { hasText: 'Operating - Chase Bank' })).toHaveCount(0)
})

test('keeps it through the page\'s own Back button too', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await search(page).fill('petty')
  await page.getByRole('button', { name: 'Petty Cash', exact: true }).click()
  await page.waitForURL(/\/chart-of-accounts\/acct_/)
  await page.getByTitle(/Back to Chart of Accounts/).first().click()
  await expect(search(page)).toHaveValue('petty')
})

// A reload is a fresh start; the memory is for coming back, not for ever.
test('starts afresh on a reload', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await search(page).fill('petty')
  await page.reload({ waitUntil: 'networkidle' })
  await expect(search(page)).toHaveValue('')
})
