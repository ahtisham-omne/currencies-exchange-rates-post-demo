import { test, expect, type Locator, type Page } from '@playwright/test'
import { settle, view } from './glPage'

/* Two fields on the new journal entry form. Mahad, 2026-09-30: *"Journal entry
   no. field in creation. Pre-filled for now and not editable. Field for currency
   on the journal entry."* The currency is entered in and posted in base at the
   rate: the ledger holds base figures, the entry keeps what was typed.

   EUR's spot rate in the module is 0.9243 to the dollar, so EUR 92.43 posts as
   $100.00. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'New journal entry' }).last()

async function fillLine(page: Page, m: Locator, row: number, number: string, col: 'debit' | 'credit', amount: string) {
  await m.locator('table button[aria-haspopup="listbox"]').nth(row).click()
  const list = page.getByRole('listbox').last()
  await list.getByPlaceholder('Search account by name or number').fill(number)
  await list.getByRole('option').filter({ hasText: `${number} · ` }).first().click()
  await expect(list).toHaveCount(0)
  await m.locator('table').getByLabel(col, { exact: true }).nth(row).fill(amount)
}

async function openEntry(page: Page) {
  await settle(page, '/general-ledger')
  await page.getByRole('button', { name: 'New journal entry' }).first().click()
  const m = modal(page)
  await m.getByText('Journal lines').first().waitFor()
  return m
}

const number = (m: Locator) => m.getByLabel('Journal entry number', { exact: true })

test.describe('the journal entry number', () => {
  test('is pre-filled, cannot be typed into, and is the number the entry posts under', async ({ page }) => {
    const m = await openEntry(page)
    const shown = (await number(m).innerText()).trim()
    expect(shown).toMatch(/^JE-\d{4}-\d{4}$/)
    // A stated value, not an input.
    await expect(number(m).locator('input')).toHaveCount(0)
    expect(await number(m).evaluate(el => el.tagName)).not.toBe('INPUT')
    await expect(number(m).locator('svg')).toHaveCount(1)

    await fillLine(page, m, 0, '52110', 'debit', '25')
    await fillLine(page, m, 1, '11130', 'credit', '25')
    await m.getByRole('button', { name: 'Post journal entry' }).click()
    await page.waitForURL(/\/general-ledger\/entry\//)
    expect(decodeURIComponent(page.url().split('/entry/')[1])).toBe(shown)
  })
})

test.describe('the currency', () => {
  test('opens on the base currency, with no rate to state', async ({ page }) => {
    const m = await openEntry(page)
    await expect(m.getByRole('button', { name: 'Currency' })).toContainText('USD')
    // Each option leads with its flag (Mahad, 2026-09-30) - a picture, never the
    // emoji, which Windows draws as two letters (Mahad, 2026-10-05).
    await m.getByRole('button', { name: 'Currency' }).click()
    const options = page.getByRole('listbox').last().getByRole('option')
    const eur = options.filter({ hasText: 'EUR · Euro' }).first()
    await expect(eur).toHaveText(/^\s*EUR · Euro/)
    await expect(eur.locator('img[data-flag]').first()).toHaveAttribute('data-flag', 'eu')
    await expect(options.filter({ hasText: 'USD · US Dollar' }).first().locator('img[data-flag]').first()).toHaveAttribute('data-flag', 'us')
    await page.keyboard.press('Escape')
    await expect(m.getByText(/^Posts in USD at/)).toHaveCount(0)
  })

  test('types the lines in euros and posts them in dollars at the rate', async ({ page }) => {
    const m = await openEntry(page)
    await m.getByRole('button', { name: 'Currency' }).click()
    const list = page.getByRole('listbox').last()
    await list.getByPlaceholder('Search currency').fill('EUR')
    await list.getByRole('option').filter({ hasText: 'EUR · Euro' }).first().click()
    await expect(m.getByText('1 USD = 0.9243 EUR')).toBeVisible()
    await expect(m.getByText(/Open Exchange Rates/)).toBeVisible()

    await fillLine(page, m, 0, '52110', 'debit', '92.43')
    await fillLine(page, m, 1, '11130', 'credit', '92.43')
    // Totals in euros, with the dollars they post at under them.
    const foot = m.locator('tfoot')
    await expect(foot).toContainText('€ 92.43')
    await expect(foot).toContainText('$ 100.00')
    await m.getByRole('button', { name: 'Post journal entry' }).click()
    await page.waitForURL(/\/general-ledger\/entry\//)
    const je = decodeURIComponent(page.url().split('/entry/')[1])

    // The entry reads as written, in euros, with the posted dollars beneath.
    // Stated once, in the rail: the header carries no currency chip (Mahad,
    // 2026-10-09: *"remove currency from header in the detail pages"*).
    await expect(page.locator('h1').first().locator('xpath=..').getByText('EUR', { exact: true })).toHaveCount(0)
    await expect(page.locator('div.min-w-0').filter({ has: page.getByText('Currency', { exact: true }) }).first()).toContainText('EUR')
    await expect(page.getByText('1 USD = 0.9243 EUR')).toBeVisible()
    const lines = page.locator('table').first()
    await expect(lines).toContainText('€ 92.43')
    await expect(lines).toContainText('$ 100.00')

    // The ledger holds the dollars.
    await page.getByTitle('Back to General Ledger').first().click()
    await view(page, 'Journal entries').click()
    await page.getByPlaceholder('Search entries').fill(je)
    const row = page.locator('tr.gl-je-parent').filter({ hasText: je })
    await expect(row).toContainText('$ 100.00')
  })
})
