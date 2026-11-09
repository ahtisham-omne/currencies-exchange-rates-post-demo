import { test, expect, type Page } from '@playwright/test'

/* Mahad, 2026-09-24: *"Import creates duplicate account codes and still marks
   them 'Ready.'"*

   A row is told apart by its number plus the dimensions kept off it, which is
   what lets segmented codes say 71100 once per department. Read on both sides
   of the comparison, that handed a row carrying no dimensions an identity of
   its own - the bare number - so nothing collided with it and it read Ready.

   The grid is where "Ready" is a word the reader sees, so that is where this
   is read back. The tallies above the rows say the same thing a second way,
   and a row's own chip is what the sentence in the report is about. */

const FILE = {
  name: '_duplicate-numbers.csv',
  mimeType: 'text/csv',
  // 11100 is Cash and Cash Equivalents in the demo chart. 7100 is free, and
  // repeats here with nothing on either row to tell the two apart.
  buffer: Buffer.from([
    'Account Number,Account Name,Type,GL Account Type',
    '7100,Marketing,Expense,Posting',
    '7100,Marketing Again,Expense,Posting',
    '11100,Clashing With The Chart,Asset,Posting',
    '7200,Perfectly Fine,Expense,Posting',
  ].join('\n')),
}

async function reviewGrid(page: Page) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('table tbody tr').first().waitFor()
  await page.getByRole('button', { name: 'Actions', exact: true }).click()
  await page.getByText('Import', { exact: true }).click()

  await page.locator('input[type=file]').waitFor({ state: 'attached' })
  await page.locator('input[type=file]').setInputFiles(FILE)
  await expect(page.getByText(FILE.name)).toBeVisible()

  // The walkthrough welcome opens over the modal and swallows the click.
  const skip = page.getByRole('button', { name: 'Skip' }).first()
  if (await skip.isVisible().catch(() => false)) await skip.click()
  await expect(page.locator('[data-wizard-overlay]')).toHaveCount(0)

  await page.getByRole('button', { name: 'Review data' }).click()
  await expect(page.getByText('Review and fix your data')).toBeVisible()
}

test('a number with nothing to tell it apart is refused, whoever else is holding it', async ({ page }) => {
  await reviewGrid(page)

  const resultOf = (n: string) => page.locator('tr', { has: page.getByText(n, { exact: true }) })
    .last().locator('td').nth(2)

  // Both halves of a repeat are refused: neither is the one that was there first.
  await expect(resultOf('Marketing')).toContainText('Error')
  await expect(resultOf('Marketing Again')).toContainText('Error')
  // The chart is the other place a number can already be in use.
  await expect(resultOf('Clashing With The Chart')).toContainText('Error')
  // A number nothing else claims still imports, so this refuses collisions
  // rather than the file.
  await expect(resultOf('Perfectly Fine')).toContainText('Ready')

  await expect(page.getByRole('button', { name: /^Ready 1$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Errors 3$/ })).toBeVisible()
})
