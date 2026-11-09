import type { Page } from '@playwright/test'

// Reaching the General Ledger and its two tabs, shared by the specs that read
// the page rather than the source.

export const settle = async (page: Page, path: string) => {
  await page.goto(path, { waitUntil: 'networkidle' })
  // The grid, so anything counted afterwards is counted against real rows - an
  // empty page satisfies every "nothing is open" assertion.
  await page.locator('table tbody tr').first().waitFor()
}

export const view = (page: Page, name: 'General ledger' | 'Journal entries') =>
  page.getByRole('button', { name, exact: true }).first()
