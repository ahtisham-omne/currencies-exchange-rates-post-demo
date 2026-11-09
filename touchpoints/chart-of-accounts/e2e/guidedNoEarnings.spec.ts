import { test, expect, type Page } from '@playwright/test'

/* Design, 2026-10-12: *"remove the Current Year Earnings account from the guided
   setup output in the prototype."* The chart guided setup publishes holds
   revenue and expense accounts and no Current Year Earnings. */

const footer = (page: Page) => page.getByRole('button', { name: /^(Continue|Skip|Review accounts|Publish chart|Publish|Create chart of accounts)$/ }).last()

async function dismissWelcome(page: Page) {
  const welcome = page.getByRole('button', { name: 'Skip for now' })
  await welcome.waitFor({ timeout: 2500 }).then(() => welcome.click()).catch(() => {})
}

test('the chart guided setup builds has no Current Year Earnings account', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /View as first-time user/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start guided setup' }).click()
  await dismissWelcome(page)
  await footer(page).click()                                   // Number length
  await dismissWelcome(page)
  await page.getByRole('button', { name: /^Accrual basis/ }).click()
  await footer(page).click()                                   // Your business
  await dismissWelcome(page)
  await footer(page).click()                                   // Dimensions
  await dismissWelcome(page)
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-mahad-Documents-Chart-of-Accounts-chart-of-accounts-v2-1/2c6fbcd7-160c-43c6-ac48-a99e1668ca44/scratchpad/guided-accounts.png' })
  await footer(page).click()                                   // Add your accounts
  await page.waitForURL(/\/chart-of-accounts$/)
  await dismissWelcome(page)
  await page.waitForSelector('tbody tr[data-tree-account]')
  await page.getByPlaceholder('Search accounts').fill('Earnings')
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-mahad-Documents-Chart-of-Accounts-chart-of-accounts-v2-1/2c6fbcd7-160c-43c6-ac48-a99e1668ca44/scratchpad/guided-chart.png' })
  await expect(page.locator('tbody tr[data-tree-account]').filter({ hasText: 'Current Year Earnings' })).toHaveCount(0)
  await expect(page.locator('tbody tr[data-tree-account]').filter({ hasText: 'Retained System Earnings' })).toHaveCount(1)
})
