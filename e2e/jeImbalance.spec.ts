import { test, expect, type Page, type Locator } from '@playwright/test'
import { settle } from './glPage'

/* Mahad, 2026-09-24: *"A one-cent imbalance (12.34 debit vs 12.33 credit) blocks
   posting correctly but shows 'Out of balance by $0.' It should show '$0.01' and
   say which side to adjust."*

   The refusal was always right; only the account of it was wrong. Rounded to
   whole dollars, the shortfall reads as nothing and the two totals read as the
   same number, so the form appears to be refusing an entry that balances. Pinned
   on the running page because the amounts are typed into the inputs and the
   verdict is derived from them - a source test would be reading the formatter it
   is meant to be checking the use of. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'New journal entry' }).last()

async function fillLine(page: Page, m: Locator, row: number, number: string, col: 'debit' | 'credit', amount: string) {
  const picker = m.locator('table button[aria-haspopup="listbox"]').nth(row)
  await picker.click()
  const list = page.getByRole('listbox').last()
  await list.getByPlaceholder('Search account by name or number').fill(number)
  await list.getByRole('option').first().click()
  await expect(list).toHaveCount(0)
  await m.locator('table').getByLabel(col, { exact: true }).nth(row).fill(amount)
}

async function offByACent(page: Page) {
  await settle(page, '/general-ledger')
  await page.getByRole('button', { name: 'New journal entry' }).first().click()
  const m = modal(page)
  await m.getByText('Journal lines').first().waitFor()
  await fillLine(page, m, 0, '52110', 'debit', '12.34')
  await fillLine(page, m, 1, '11130', 'credit', '12.33')
  return m
}

test('states the cent it is short, and the side that closes it', async ({ page }) => {
  const m = await offByACent(page)

  await expect(m.getByText('Out of balance by $ 0.01', { exact: false }).first()).toBeVisible()
  await expect(m.getByText('Add a credit of $ 0.01 to balance this journal entry.')).toBeVisible()
  // Nowhere may it still say nothing is missing.
  await expect(m.getByText('Out of balance by $ 0', { exact: true })).toHaveCount(0)
})

// The two totals are what the reader compares. Rounded they were both "$ 12",
// which is a pair of figures asserting the entry balances over a banner saying
// it does not.
test('shows the two totals a cent apart, not as the same figure', async ({ page }) => {
  const m = await offByACent(page)
  const foot = m.locator('tfoot')
  await expect(foot).toContainText('$ 12.34')
  await expect(foot).toContainText('$ 12.33')
})

test('will not post while the cent is outstanding, and will once it is not', async ({ page }) => {
  const m = await offByACent(page)
  const post = m.getByRole('button', { name: 'Post journal entry' })
  // Not a dead button: pressing it says what is wrong and stays on the form.
  await post.click()
  await expect(m.getByText(/This entry can't post yet/).locator('..')).toContainText('Debits and credits must match. They are $ 0.01 apart.')
  await expect(page).not.toHaveURL(/\/general-ledger\/entry\//)

  await m.locator('table').getByLabel('credit', { exact: true }).nth(1).fill('12.34')
  await expect(m.getByText('Balanced').first()).toBeVisible()
  await expect(post).toBeEnabled()
})
