import { test, expect } from '@playwright/test'

/* Only posting accounts can have dimensions. Mahad, 2026-10-02, over a file whose
   summaries are written 11000 and whose postings are segmented: the Structure
   step was flagging the summaries for holding no separator. */
const FILE = {
  name: '_summaries.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from([
    'GL account no.,GL account name,GL account category,GL account type,Parent',
    '11000,Current Assets,Asset,Summary,',
    '11100,Cash,Asset,Summary,11000',
    '01-11110-40,Bank - Sales,Asset,Posting,11100',
    '01-11120-50,Bank - Marketing,Asset,Posting,11100',
    '02-11110-40,Bank - Sales HK,Asset,Posting,11100',
  ].join('\n')),
}

test('does not ask summaries for segments, and imports them with none', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody tr').first().waitFor()
  await page.getByRole('button', { name: 'Actions', exact: true }).click()
  await page.getByText('Import', { exact: true }).click()
  await page.locator('input[type=file]').waitFor({ state: 'attached' })
  const skip = page.getByRole('button', { name: /^Skip/ }).first()
  await skip.waitFor({ timeout: 3000 }).then(() => skip.click()).catch(() => {})
  await page.locator('input[type=file]').setInputFiles(FILE)
  await expect(page.getByText(FILE.name)).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByText('The account number has multiple segments.').click()
  await expect(page.getByText(/hold no separator|holds no separator/)).toHaveCount(0)
  await expect(page.getByText(/fewer segments than the rest/)).toHaveCount(0)
  await page.screenshot({ path: 'test-results/import-summary-structure.png' })
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('What does each segment mean?')).toBeVisible()
  await expect(page.getByRole('rowheader', { name: /Segment 3/ })).toBeVisible()
})
