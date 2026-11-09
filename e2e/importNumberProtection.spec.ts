import { test, expect, type Page, type Locator } from '@playwright/test'

/* Number protection meets an import (design review, 2026-09-24). A file whose
   numbers sit among another branch's is told so on the review step, with a
   recommendation to renumber - the old number stays on as the prior account
   number - and importing it as it is turns protection off for the chart.

   11205 is filed under Cash and Cash Equivalents but sits inside the block
   Short-Term Investments reserves (11200-11299). 7300 sits in nobody's block. */
const FILE = {
  name: '_protection.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from([
    'Account Number,Account Name,Type,GL Account Type,Parent Account No.',
    '11205,Stray Cash Float,Asset,Posting,11100',
    '7300,Somewhere Free,Expense,Posting,',
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
  const skip = page.getByRole('button', { name: 'Skip' }).first()
  if (await skip.isVisible().catch(() => false)) await skip.click()
  await expect(page.locator('[data-wizard-overlay]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Review data' }).click()
  await expect(page.getByText('Review and fix your data')).toBeVisible()
}

test('says which accounts sit among another branch\'s numbers, and recommends renumbering', async ({ page }) => {
  await reviewGrid(page)
  await expect(page.getByText('One account sits among another branch\'s numbers')).toBeVisible()
  await expect(page.getByText(/We recommend renumbering them in the grid/)).toBeVisible()
  await expect(page.getByText(/stays on the account as its prior account number/)).toBeVisible()
  await expect(page.getByText(/number protection is turned off for your chart/)).toBeVisible()
})

/* Proved by what protection does rather than by a control reading off, because
   the import is the only thing that turns it off. The paired refusal, with
   protection at its default, is accountNumberInRange.spec.ts: 11650 under 11100
   would stretch the Cash branch across Short-Term Investments. */
const field = (m: Locator, label: string) =>
  m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)

test('turns protection off when the file is imported as it is', async ({ page }) => {
  await reviewGrid(page)
  await page.getByRole('button', { name: 'Start import' }).click()
  await expect(page.getByText('Number protection turned off')).toBeVisible()
  // The save is debounced; let it land before the next page load reads it back.
  await page.waitForTimeout(900)

  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Create GL account/ }).click()
  const m = page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()
  await m.getByRole('button', { name: /Continue/ }).first().click()
  await m.getByText('GL account details').first().waitFor()
  await field(m, 'GL account type').locator('button[aria-haspopup="listbox"]').click()
  await page.getByRole('option', { name: 'Posting', exact: true }).click()
  await field(m, 'Parent').locator('button[aria-haspopup="listbox"]').first().click()
  await page.getByRole('option', { name: /11100/ }).first().click()
  await field(m, 'GL account no.').locator('input').fill('11650')
  await expect(m.locator('p.text-danger-600')).toHaveCount(0)
})
