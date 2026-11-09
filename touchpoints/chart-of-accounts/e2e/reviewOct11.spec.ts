import { test, expect, type Locator, type Page } from '@playwright/test'
import { settle, view } from './glPage'

/* Mahad's priority changes of 2026-10-11, each read off the screen.

   1. A month locks when it ends, says "Locked", and takes no entry dated in it.
   2. A reversal offers no Reverse; an entry already reversed greys it out and
      names the entry that reversed it.
   3. The EUR account shows the euros typed (€ 123.45), not their restatement
      (€ 124.34), and its euro balance adds up from them.
   6. The profit cards' tooltips say the month is locked, not that the period
      picker is "above".

   Point 5 (archive to the same parent or the same role) is pinned in
   accountLifecycle.test.ts and archiveForeignCurrency.spec.ts. */

const jeModal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'New journal entry' }).last()

async function openEntryForm(page: Page) {
  await settle(page, '/general-ledger')
  await page.getByRole('button', { name: 'New journal entry' }).first().click()
  const m = jeModal(page)
  await m.getByText('Journal lines').first().waitFor()
  return m
}

async function fillLine(page: Page, m: Locator, row: number, number: string, col: 'debit' | 'credit', amount: string) {
  await m.locator('table button[aria-haspopup="listbox"]').nth(row).click()
  const list = page.getByRole('listbox').last()
  await list.getByPlaceholder('Search account by name or number').fill(number)
  await list.getByRole('option').filter({ hasText: `${number} · ` }).first().click()
  await expect(list).toHaveCount(0)
  await m.locator('table').getByLabel(col, { exact: true }).nth(row).fill(amount)
}

async function post(page: Page, m: Locator) {
  await m.getByRole('button', { name: 'Post journal entry' }).click()
  await page.waitForURL(/\/general-ledger\/entry\//)
  return decodeURIComponent(page.url().split('/entry/')[1])
}

test.describe('a month locks when it ends', () => {
  test('says Locked on a month that has ended', async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.waitForSelector('thead th')
    await page.getByRole('button', { name: 'Change accounting period' }).click()
    const panel = page.locator('body > div').filter({ hasText: 'Fiscal year' }).last()
    await panel.getByText('Month', { exact: true }).click()
    await panel.locator('button', { hasText: /^August/ }).first().click()
    await expect(page.getByText('Locked', { exact: true }).first()).toBeVisible()
  })

  test('refuses an entry dated in a locked month', async ({ page }) => {
    const m = await openEntryForm(page)
    await m.getByLabel('Date', { exact: true }).click()
    const cal = page.locator('[data-date-popover]')
    await cal.waitFor()
    // The month before this one has ended, so it is locked.
    const prev = new Date(); prev.setDate(1); prev.setMonth(prev.getMonth() - 1)
    await cal.getByLabel('Year', { exact: true }).selectOption(String(prev.getFullYear()))
    await cal.getByLabel('Month', { exact: true }).selectOption({ label: prev.toLocaleString('en-US', { month: 'short' }) })
    await cal.getByRole('button', { name: '15', exact: true }).first().click()
    await fillLine(page, m, 0, '52110', 'debit', '25')
    await fillLine(page, m, 1, '11130', 'credit', '25')
    await m.getByRole('button', { name: 'Post journal entry' }).click()
    await expect(m.getByText(/is locked - nothing can be posted into it\./).first()).toBeVisible()
    await expect(page).toHaveURL(/\/general-ledger$/)
  })
})

test('a reversal offers no Reverse, and a reversed entry greys it and names its reversal', async ({ page }) => {
  const m = await openEntryForm(page)
  await fillLine(page, m, 0, '52110', 'debit', '40')
  await fillLine(page, m, 1, '11130', 'credit', '40')
  const original = await post(page, m)

  await page.getByRole('button', { name: 'Reverse this entry' }).click()
  const dialog = page.locator('body > div.fixed').filter({ hasText: 'Reason for reversal' }).last()
  await dialog.getByLabel('Reason for reversal').fill('Posted to the wrong account')
  await dialog.getByRole('button', { name: /^Post JE-/ }).click()
  await page.waitForURL(u => !decodeURIComponent(u.toString()).endsWith(original))
  const reversal = decodeURIComponent(page.url().split('/entry/')[1])

  // The reversal: no button at all.
  await expect(page.getByRole('button', { name: 'Reverse this entry' })).toHaveCount(0)

  // The original: greyed, and saying which entry reversed it.
  await page.getByRole('link', { name: original, exact: true }).first().click()
  await page.waitForURL(u => decodeURIComponent(u.toString()).endsWith(original))
  const button = page.getByRole('button', { name: 'Reverse this entry' })
  await expect(button).toHaveAttribute('aria-disabled', 'true')
  await expect(page.locator('[data-reversed-by]')).toHaveText(`Reversed by ${reversal}`)
  await button.click({ force: true })
  await expect(page.getByRole('alertdialog')).toHaveCount(0)

  // The row menus agree.
  await page.getByTitle('Back to General Ledger').first().click()
  await view(page, 'Journal entries').click()
  await page.getByPlaceholder('Search entries').fill(original)
  await page.getByRole('button', { name: `Actions for ${original}` }).click()
  await expect(page.getByRole('button', { name: 'Reverse entry' })).toHaveAttribute('aria-disabled', 'true')
  await page.getByRole('button', { name: 'Reverse entry' }).hover({ force: true })
  await expect(page.getByText(`Already reversed by ${reversal}.`)).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: `Actions for ${reversal}` }).click()
  await expect(page.getByRole('button', { name: 'Print entry' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reverse entry' })).toHaveCount(0)
})

const eurBalance = async (page: Page) => {
  const row = page.locator('tbody tr[data-tree-account]').filter({ hasText: '11170' }).first()
  const m = (await row.innerText()).match(/€\s?-?[\d,]+\.\d{2}/)
  return Number(m![0].replace(/[€,\s]/g, ''))
}

test('the EUR account shows the euros typed, and adds its balance up from them', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  const before = await eurBalance(page)

  await settle(page, '/general-ledger')
  await page.getByRole('button', { name: 'New journal entry' }).first().click()
  const m = jeModal(page)
  await m.getByText('Journal lines').first().waitFor()
  await m.getByRole('button', { name: 'Currency' }).click()
  const list = page.getByRole('listbox').last()
  await list.getByPlaceholder('Search currency').fill('EUR')
  await list.getByRole('option').filter({ hasText: 'EUR · Euro' }).first().click()
  await fillLine(page, m, 0, '11170', 'debit', '123.45')
  await fillLine(page, m, 1, '41010', 'credit', '123.45')
  await post(page, m)

  // In the app rather than a reload, which can beat the entry to storage. From
  // the entry's line to the account, then back to the chart.
  await page.locator('table').first().getByText('EUR Account - Deutsche Bank').first().click()
  await page.getByRole('button', { name: 'Edit Account' }).waitFor()
  await page.getByRole('button', { name: /^Transactions/ }).first().click()
  const row = page.locator('tbody tr').filter({ hasText: '€ 123.45' }).first()
  await expect(row).toBeVisible()
  await expect(page.locator('tbody')).not.toContainText('€ 124.34')

  await page.getByTitle(/^Back to Chart of Accounts/).first().click()
  await page.waitForSelector('thead th')
  await expect.poll(async () => Math.round((await eurBalance(page) - before) * 100) / 100).toBe(123.45)
})

test('the profit cards say the month is locked, and nothing is "above"', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  for (const label of ['Net income', 'Gross profit']) {
    const card = page.locator('div.rounded-lg', { has: page.getByText(label, { exact: true }) }).last()
    await card.locator('svg').first().hover()
    const tip = page.getByText(/The month is locked, so this figure won't change\./).first()
    await expect(tip).toBeVisible()
    await expect(tip).not.toContainText('above')
    await page.mouse.move(0, 0)
  }
})
