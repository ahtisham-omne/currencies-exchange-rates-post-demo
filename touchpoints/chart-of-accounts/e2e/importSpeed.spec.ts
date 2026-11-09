import { test, expect } from '@playwright/test'

/* The import's count-up is cosmetic and held to about a second, whatever the
   file's size. Mahad, 2026-10-02, over 58 accounts: *"Can this loading be fast?
   It's really slow to import."* It used to take at least 220ms an account. */
const rows = Array.from({ length: 58 }, (_, i) => `${70100 + i},Imported ${i + 1},Expense,Posting,`)
const FILE = {
  name: '_speed.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from(['GL account no.,GL account name,GL account category,GL account type,Parent', ...rows].join('\n')),
}

test('imports 58 accounts in about a second', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody tr').first().waitFor()
  await page.getByRole('button', { name: 'Actions', exact: true }).click()
  await page.getByText('Import', { exact: true }).click()
  await page.locator('input[type=file]').waitFor({ state: 'attached' })
  const skip = page.getByRole('button', { name: /^Skip/ }).first()
  await skip.waitFor({ timeout: 3000 }).then(() => skip.click()).catch(() => {})
  await page.locator('input[type=file]').setInputFiles(FILE)
  await expect(page.getByText(FILE.name)).toBeVisible()
  await page.getByRole('button', { name: 'Review data' }).click()
  const start = page.getByRole('button', { name: /^(Start import|Import \d+)/ }).first()
  await start.click()
  const t0 = Date.now()
  await expect(page.getByText(/Importing 58 accounts/)).toBeVisible()
  await expect(page.getByText(/Importing 58 accounts/)).toHaveCount(0, { timeout: 5000 })
  expect(Date.now() - t0).toBeLessThan(2500)
})
