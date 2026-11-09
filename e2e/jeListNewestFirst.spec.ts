import { test, expect } from '@playwright/test'
import { settle, view } from './glPage'

/* Mahad, 2026-10-09: the Journal entries tab opens sorted by date, newest first.
   The General ledger tab keeps posting order, oldest first. */

const dates = async (page: import('@playwright/test').Page) => {
  const head = await page.locator('table thead th').allInnerTexts()
  const col = head.findIndex(h => h.trim().startsWith('Date'))
  const texts = await page.locator('tr.gl-je-parent').evaluateAll((rows, i) =>
    rows.map(r => (r.querySelectorAll('td')[i] as HTMLElement | undefined)?.innerText.trim() ?? ''), col)
  return texts.filter(Boolean).map(t => new Date(t).getTime())
}

test('Journal entries opens newest first by date', async ({ page }) => {
  await settle(page, '/general-ledger')
  await view(page, 'Journal entries').click()
  await page.locator('tr.gl-je-parent').first().waitFor()
  const d = await dates(page)
  expect(d.length).toBeGreaterThan(5)
  for (let i = 1; i < d.length; i++) expect(d[i], `row ${i + 1} is not later than row ${i}`).toBeLessThanOrEqual(d[i - 1])
  expect(d[0]).toBeGreaterThan(d[d.length - 1])
})
