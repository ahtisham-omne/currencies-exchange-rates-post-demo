import { test, expect } from '@playwright/test'

/* The pieces of a segmented number are named Segment 1, Segment 2 and so on;
   "Dimension" is one of the answers a segment can be given. Mahad, 2026-10-02:
   *"For the imports, this should be Segment 1, Segment 2, and so on."* */
const FILE = {
  name: '_segments.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from([
    'Account Number,Account Name,Type,GL Account Type,Parent Account No.',
    '01-100-5020,Travel,Expense,Posting,',
    '02-200-5030,Meals,Expense,Posting,',
  ].join('\n')),
}

test('names each piece of the number a segment', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody tr').first().waitFor()
  await page.getByRole('button', { name: 'Actions', exact: true }).click()
  await page.getByText('Import', { exact: true }).click()
  await page.locator('input[type=file]').waitFor({ state: 'attached' })
  await page.locator('input[type=file]').setInputFiles(FILE)
  await expect(page.getByText(FILE.name)).toBeVisible()
  const skip = page.getByRole('button', { name: 'Skip' }).first()
  if (await skip.isVisible().catch(() => false)) await skip.click()
  await expect(page.locator('[data-wizard-overlay]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByText('The account number has multiple segments.').click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('What does each segment mean?')).toBeVisible()
  for (const n of [1, 2, 3]) await expect(page.getByRole('rowheader', { name: new RegExp(`^${n}\\s*Segment ${n}$`) })).toBeVisible()
  await expect(page.getByRole('rowheader', { name: /Dimension \d/ })).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: 'Segment', exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/import-segments.png' })
})
