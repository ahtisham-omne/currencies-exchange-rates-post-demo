import { test, expect, type Page } from '@playwright/test'
import { settle, view } from './glPage'

/* The docked Columns panel stretches to the table beside it, so a search that
   cut the table to one row cut the panel to its header, with none of its list
   showing. Mahad, 2026-10-01: *"When I search something and the column
   configurator gets cut off. Can you fix this bug?"* It now keeps room for its
   list while open, on every table that docks it. */

// The panel, its height, and how many of its column rows are on screen in it.
const panel = (page: Page) => page.evaluate(() => {
  let el = document.querySelector('[aria-label="Close columns"]') as HTMLElement | null
  while (el && el.style.width !== '300px') el = el.parentElement
  if (!el) return null
  const box = el.getBoundingClientRect()
  const rows = [...el.querySelectorAll('[data-col-key]')]
  return {
    height: Math.round(box.height),
    shown: rows.filter(r => { const b = r.getBoundingClientRect(); return b.height > 0 && b.bottom <= box.bottom + 1 }).length,
  }
})

test('the chart\'s panel shows its columns when a search leaves one row', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  await page.getByPlaceholder('Search accounts').fill('pett')
  await expect(page.getByText(/^1 of /)).toBeVisible()
  await page.getByRole('button', { name: /^Columns/ }).first().click()
  await expect.poll(async () => (await panel(page))?.height ?? 0).toBeGreaterThanOrEqual(480)
  // Past the header: its visuals, the pinned group and the list's first rows.
  await expect(page.getByRole('button', { name: 'Configure Visuals' })).toBeVisible()
  expect((await panel(page))!.shown).toBeGreaterThanOrEqual(2)
})

test('the ledger\'s panel does too', async ({ page }) => {
  await settle(page, '/general-ledger')
  await view(page, 'Journal entries').click()
  // Whichever entry the period lists first, so the test does not drift with the date.
  const je = (await page.locator('tr.gl-je-parent').first().getByRole('button', { name: /^JE-/ }).innerText()).trim()
  await page.getByPlaceholder('Search entries').fill(je)
  await expect(page.locator('tr.gl-je-parent')).toHaveCount(1)
  await page.getByRole('button', { name: /^Columns/ }).first().click()
  await expect.poll(async () => (await panel(page))?.height ?? 0).toBeGreaterThanOrEqual(480)
  // Past the header: its visuals, the pinned group and the list's first rows.
  await expect(page.getByRole('button', { name: 'Configure Visuals' })).toBeVisible()
  expect((await panel(page))!.shown).toBeGreaterThanOrEqual(2)
})
