import { test, expect, type Locator, type Page } from '@playwright/test'
import { settle, view } from './glPage'

/* Mahad's points of 2026-10-10, each read off the screen.

   1. A reversed entry cannot be reversed again, so it offers no way to.
   2. An entry written in EUR reverses in EUR, at its own rate.
   3. The opening balance is the balance on the first day of the selected month,
      the same on the listing and the account's page.
   5. Net income and Gross profit add up the last closed month alone, name it,
      and do not move with the period strip.

   Point 4 (archive destinations) is pinned in accountLifecycle.test.ts. */

const jeModal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'New journal entry' }).last()

async function fillLine(page: Page, m: Locator, row: number, number: string, col: 'debit' | 'credit', amount: string) {
  await m.locator('table button[aria-haspopup="listbox"]').nth(row).click()
  const list = page.getByRole('listbox').last()
  await list.getByPlaceholder('Search account by name or number').fill(number)
  await list.getByRole('option').filter({ hasText: `${number} · ` }).first().click()
  await expect(list).toHaveCount(0)
  await m.locator('table').getByLabel(col, { exact: true }).nth(row).fill(amount)
}

// Posts EUR 92.43 (USD 100.00 at the module's 0.9243) and lands on the entry.
async function postEuroEntry(page: Page): Promise<string> {
  await settle(page, '/general-ledger')
  await page.getByRole('button', { name: 'New journal entry' }).first().click()
  const m = jeModal(page)
  await m.getByText('Journal lines').first().waitFor()
  await m.getByRole('button', { name: 'Currency' }).click()
  const list = page.getByRole('listbox').last()
  await list.getByPlaceholder('Search currency').fill('EUR')
  await list.getByRole('option').filter({ hasText: 'EUR · Euro' }).first().click()
  await fillLine(page, m, 0, '52110', 'debit', '92.43')
  await fillLine(page, m, 1, '11130', 'credit', '92.43')
  await m.getByRole('button', { name: 'Post journal entry' }).click()
  await page.waitForURL(/\/general-ledger\/entry\//)
  return decodeURIComponent(page.url().split('/entry/')[1])
}

async function reverseOpenEntry(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Reverse this entry' }).click()
  const dialog = page.locator('body > div.fixed').filter({ hasText: 'Reason for reversal' }).last()
  await dialog.getByLabel('Reason for reversal').fill('Posted to the wrong account')
  const before = page.url()
  await dialog.getByRole('button', { name: /^Post JE-/ }).click()
  await page.waitForURL(u => u.toString() !== before && /\/general-ledger\/entry\//.test(u.toString()))
  return decodeURIComponent(page.url().split('/entry/')[1])
}

test.describe('reversing an entry', () => {
  test('copies the EUR amounts and the original rate', async ({ page }) => {
    const original = await postEuroEntry(page)
    await page.getByRole('button', { name: 'Reverse this entry' }).click()
    // The dialog states the lines as typed, in euros, over the dollars.
    const dialog = page.locator('body > div.fixed').filter({ hasText: 'Reason for reversal' }).last()
    await expect(dialog).toContainText('€ 92.43')
    await expect(dialog).toContainText('$ 100.00')
    await dialog.getByLabel('Reason for reversal').fill('Posted to the wrong account')
    await dialog.getByRole('button', { name: /^Post JE-/ }).click()
    await page.waitForURL(u => !u.toString().endsWith(encodeURIComponent(original)))

    // The reversal reads in euros, at the rate the original posted at.
    await expect(page.locator('div.min-w-0').filter({ has: page.getByText('Currency', { exact: true }) }).first()).toContainText('EUR')
    await expect(page.getByText('1 USD = 0.9243 EUR')).toBeVisible()
    const lines = page.locator('table').first()
    await expect(lines).toContainText('€ 92.43')
    await expect(lines).toContainText('$ 100.00')
  })

  test('is not offered again on an entry already reversed', async ({ page }) => {
    const original = await postEuroEntry(page)
    const reversal = await reverseOpenEntry(page)

    // Neither can be reversed now: the reversal offers no button (Mahad,
    // 2026-10-11), and the original greys its own.
    await expect(page.getByRole('button', { name: 'Reverse this entry' })).toHaveCount(0)
    await page.getByRole('link', { name: original, exact: true }).first().click()
    await page.waitForURL(u => decodeURIComponent(u.toString()).endsWith(original))
    await expect(page.getByText('Reversed', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reverse this entry' })).toHaveAttribute('aria-disabled', 'true')

    // Nor from its row on Journal entries.
    await page.getByTitle('Back to General Ledger').first().click()
    await view(page, 'Journal entries').click()
    await page.getByPlaceholder('Search entries').fill(original)
    // The reversal's memo names the original, so both rows match its number.
    await page.getByRole('button', { name: `Actions for ${original}` }).click()
    await expect(page.getByRole('button', { name: 'Reverse entry' })).toHaveAttribute('aria-disabled', 'true')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: `Actions for ${reversal}` }).click()
    await expect(page.getByRole('button', { name: 'Print entry' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reverse entry' })).toHaveCount(0)
  })
})

const money = (s: string) => [...s.matchAll(/-?\$\s?-?[\d,]+\.\d{2}/g)].map(m => Number(m[0].replace(/[$,\s]/g, '')))
const rowByNumber = (page: Page, number: string) => page.locator('tbody tr[data-tree-account]').filter({ hasText: number }).first()

async function pickMonth(page: Page, month: string) {
  await page.getByRole('button', { name: 'Change accounting period' }).click()
  const panel = page.locator('body > div').filter({ hasText: 'Fiscal year' }).last()
  await panel.getByText('Month', { exact: true }).click()
  await panel.locator('button', { hasText: new RegExp(`^${month}`) }).first().click()
  await expect(page.getByRole('button', { name: 'Change accounting period' })).toHaveText(new RegExp(`^${month.slice(0, 3)}`))
}

test('the opening balance is the first day of the selected month, on the listing and the page', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  // A month that is not the one today falls in: the page used to read today's.
  await pickMonth(page, 'August')
  await expect(page.getByRole('button', { name: 'Period from' })).toContainText('Aug 1,')
  const listed = money(await rowByNumber(page, '11130').innerText())[0]

  await rowByNumber(page, '11130').getByText('Operating - Chase Bank').first().click()
  await page.getByRole('button', { name: 'Edit Account' }).waitFor()
  const tile = page.locator('div').filter({ has: page.getByText('Opening balance', { exact: true }) }).filter({ hasText: /As of/ }).last()
  await expect(tile).toContainText(/As of Aug 1, \d{4}/)
  // The tile prints whole dollars, the listing cents.
  const shown = Number((await tile.innerText()).match(/-?\$\s?-?[\d,]+/)![0].replace(/[$,\s]/g, ''))
  expect(shown).toBe(Math.round(listed))
})

test('Net income and Gross profit name the last closed month and ignore the strip', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  const card = (label: string) => page.locator('div.rounded-lg', { has: page.getByText(label, { exact: true }) }).last()
  const before: Record<string, string> = {}
  for (const label of ['Net income', 'Gross profit']) {
    await expect(card(label).getByText(/^[A-Z][a-z]+ \d{4}$/)).toBeVisible()
    await expect(card(label)).not.toContainText(/to date|January to/)
    before[label] = await card(label).locator('p.text-15').innerText()
  }
  await pickMonth(page, 'August')
  for (const label of ['Net income', 'Gross profit']) {
    await expect(card(label).locator('p.text-15')).toHaveText(before[label])
  }
})
