import { test, expect, type Page } from '@playwright/test'

/* Mahad, 2026-10-10: *"Current year earnings should exist like any other
   account."* It was a line the listing drew, with no number, no checkbox, no
   audit columns, no menu and no page. It is 35000 now, and its figure is still
   revenue less expenses. */

const rowByNumber = (page: Page, number: string) => page.locator('tbody tr[data-tree-account]').filter({ hasText: number }).first()
const money = (s: string) => [...s.matchAll(/-?\$\s?-?[\d,]+\.\d{2}/g)].map(m => Number(m[0].replace(/[$,\s]/g, '')))

test('sits on the chart as 35000, with everything an account row carries', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  const row = rowByNumber(page, '35000')
  await expect(row).toContainText('Current Year Earnings')
  await expect(row.getByRole('checkbox', { name: 'Select Current Year Earnings' })).toBeVisible()
  await expect(row).toContainText('Active')
  // Its balance is a real figure, not a dash.
  expect(money(await row.innerText()).length).toBeGreaterThan(0)
  await expect(row.getByRole('button', { name: /Actions for|More actions|Account actions/ }).first()).toBeAttached()
})

test('opens its own page, and the page states the figure the chart does', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  const row = rowByNumber(page, '35000')
  const listed = money(await row.innerText())
  await row.getByText('Current Year Earnings').first().click()
  await page.getByRole('button', { name: 'Edit Account' }).waitFor()
  await expect(page.locator('h1').first()).toContainText('Current Year Earnings')
  const running = page.locator('div').filter({ has: page.getByText('Running balance', { exact: true }) }).filter({ hasText: /As of/ }).last()
  const shown = Number((await running.innerText()).match(/-?\$\s?-?[\d,]+/)![0].replace(/[$,\s]/g, ''))
  // The tile prints whole dollars; the listing's running balance is its second figure.
  expect(shown).toBe(Math.round(listed[1]))
})
