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

/* Searching the Accounts step shows the matches and nothing else, as the Chart
   of Accounts listing does. Mahad, 2026-10-02: *"When searching for account in
   guided setup or in build from scratch, the search functionality should behave
   the same way we have it in COA listing page."* */

async function firstTime(page: Page, path: 'Start building' | 'Start guided setup') {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody tr').first().waitFor()
  await page.getByRole('button', { name: /View as first-time user/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: path }).click()
  await page.getByRole('button', { name: 'Continue' }).last().click()
}

const names = (page: Page) => page.locator('[role="dialog"] table tbody tr, body > div.fixed table tbody tr')
  .evaluateAll(rows => rows.map(r => (r as HTMLElement).innerText).filter(t => /\d{5}/.test(t)))

test('guided setup: a search shows only the accounts it matched', async ({ page }) => {
  await firstTime(page, 'Start guided setup')
  await page.getByRole('button', { name: /^Accrual basis/ }).click()
  await skipGuidedDimensions(page)
  await skipTour(page)
  const before = (await names(page)).length
  await page.getByPlaceholder('Search accounts…').fill('petty')
  await expect.poll(async () => (await names(page)).length).toBe(1)
  expect((await names(page))[0]).toContain('Petty Cash')
  // Results only: no Add row under them (Mahad, 2026-10-02).
  await expect(page.getByRole('button', { name: /Add row/ })).toHaveCount(0)
  expect(before).toBeGreaterThan(5)
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/setup-search-guided.png' })

  await page.getByPlaceholder('Search accounts…').fill('zzzz')
  await expect(page.getByText('No accounts match "zzzz"')).toBeVisible()
  // The field's own clear button shares the name; the empty state's is the second.
  await page.getByRole('button', { name: 'Clear search' }).last().click()
  await expect.poll(async () => (await names(page)).length).toBe(before)
})

test('build from scratch: a search shows only the accounts it matched', async ({ page }) => {
  await firstTime(page, 'Start building')
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: /^Skip$/ }).last().click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await expect.poll(async () => (await names(page)).length).toBe(5)
  // By number: a word like liab also finds Equity, whose description names liabilities, as the listing would.
  await expect(page.getByRole('button', { name: /Add row/ }).first()).toBeVisible()
  await page.getByPlaceholder('Search accounts…').fill('20000')
  await expect.poll(async () => (await names(page)).length).toBe(1)
  await expect(page.getByRole('button', { name: /Add row/ })).toHaveCount(0)
  expect((await names(page))[0]).toContain('Liability')
})
