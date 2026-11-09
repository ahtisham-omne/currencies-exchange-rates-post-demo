import { test, expect, type Locator, type Page } from '@playwright/test'
import { settle, view } from './glPage'

/* Four columns on both ledger tabs. Mahad, 2026-09-30: *"Additional column for
   Journal Internal ID. Column for currency. Column for Amount (Foreign currency)
   - if transaction was in a different currency. Column for tags in journal
   entries. Column for tags in general ledger as well."*

   Read against one entry posted here in euros, with tags: EUR 92.43 at the
   module's 0.9243 is $100.00 in the ledger. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'New journal entry' }).last()

async function fillLine(page: Page, m: Locator, row: number, number: string, col: 'debit' | 'credit', amount: string) {
  await m.locator('table button[aria-haspopup="listbox"]').nth(row).click()
  const list = page.getByRole('listbox').last()
  await list.getByPlaceholder('Search account by name or number').fill(number)
  await list.getByRole('option').filter({ hasText: `${number} · ` }).first().click()
  await expect(list).toHaveCount(0)
  await m.locator('table').getByLabel(col, { exact: true }).nth(row).fill(amount)
}

// Posts EUR 92.43 tagged "quarterly" and "dock-5"; returns its JE number and internal ID.
async function postEuroEntry(page: Page) {
  await settle(page, '/general-ledger')
  await page.getByRole('button', { name: 'New journal entry' }).first().click()
  const m = modal(page)
  await m.getByText('Journal lines').first().waitFor()
  await m.getByRole('button', { name: 'Currency' }).click()
  const list = page.getByRole('listbox').last()
  await list.getByPlaceholder('Search currency').fill('EUR')
  await list.getByRole('option').filter({ hasText: 'EUR · Euro' }).first().click()
  const tags = m.getByLabel('Tags', { exact: true })
  for (const t of ['quarterly', 'dock-5']) { await tags.fill(t); await tags.press('Enter') }
  await fillLine(page, m, 0, '52110', 'debit', '92.43')
  await fillLine(page, m, 1, '11130', 'credit', '92.43')
  await m.getByRole('button', { name: 'Post journal entry' }).click()
  await page.waitForURL(/\/general-ledger\/entry\//)
  const je = decodeURIComponent(page.url().split('/entry/')[1])
  const id = (await page.locator('div.min-w-0').filter({ has: page.locator('p', { hasText: /^Journal entry ID$/ }) }).last().innerText()).match(/JNL-\d{6}/)![0]
  return { je, id }
}

const rawHeaders = (page: Page) => page.$$eval('thead tr th', ths => ths.map(t => t.innerText.trim().split('\n')[0]))
/* The flag each Currency cell leads with. The chart's cell, flag and code chip,
   on both tabs (Mahad, 2026-10-09: *"Make the currency column in general ledger
   and journal entries as we have in the COA (with flag)"*). */
async function flagsUnder(page: Page, rows: Locator) {
  const i = (await rawHeaders(page)).indexOf('Currency')
  return rows.locator(`td:nth-child(${i + 1}) img[data-flag]`).evaluateAll(imgs => imgs.map(img => img.getAttribute('data-flag')))
}

async function cellsUnder(page: Page, rows: Locator, header: string) {
  const i = (await rawHeaders(page)).indexOf(header)
  expect(i, `${header} is a column`).toBeGreaterThanOrEqual(0)
  return (await rows.locator(`td:nth-child(${i + 1})`).allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim())
}

test('both tabs carry Journal Entry ID, Tags, Currency and Amount (foreign currency)', async ({ page }) => {
  await settle(page, '/general-ledger')
  for (const tab of ['General ledger', 'Journal entries'] as const) {
    await view(page, tab).click()
    const h = await rawHeaders(page)
    for (const col of ['Journal entry ID', 'Tags', 'Currency', 'Amount (foreign currency)']) expect(h, `${tab}: ${col}`).toContain(col)
    // Named for the entry, not the account's plain "Internal ID" (2026-09-30).
    expect(h, tab).not.toContain('Internal ID')
  }
})

test('an entry written in euros reads its ID, tags, currency and euro amount on both tabs', async ({ page }) => {
  const { je, id } = await postEuroEntry(page)
  await page.getByTitle('Back to General Ledger').first().click()
  await page.locator('tbody tr').first().waitFor()

  // Journal entries: the entry's own row, its total in euros.
  await view(page, 'Journal entries').click()
  await page.getByPlaceholder('Search entries').fill(je)
  const entry = page.locator('tr.gl-je-parent').filter({ hasText: je })
  await expect(entry).toHaveCount(1)
  expect(await cellsUnder(page, entry, 'Journal entry ID')).toEqual([id])
  expect(await cellsUnder(page, entry, 'Currency')).toEqual(['EUR'])
  expect(await flagsUnder(page, entry)).toEqual(['eu'])
  expect(await cellsUnder(page, entry, 'Amount (foreign currency)')).toEqual(['€ 92.43'])
  expect(await cellsUnder(page, entry, 'Amount')).toEqual(['$ 100.00'])
  expect(await cellsUnder(page, entry, 'Tags')).toEqual(['quarterly dock-5'])

  // General ledger: each line, with its own euro amount and the entry's ID and tags.
  await view(page, 'General ledger').click()
  await page.getByPlaceholder('Search postings').fill(je)
  const lines = page.locator('tbody tr').filter({ hasText: je })
  await expect(lines).toHaveCount(2)
  expect(await cellsUnder(page, lines, 'Journal entry ID')).toEqual([id, id])
  expect(await cellsUnder(page, lines, 'Currency')).toEqual(['EUR', 'EUR'])
  expect(await flagsUnder(page, lines)).toEqual(['eu', 'eu'])
  expect(await cellsUnder(page, lines, 'Amount (foreign currency)')).toEqual(['€ 92.43', '€ 92.43'])
  expect(await cellsUnder(page, lines, 'Tags')).toEqual(['quarterly dock-5', 'quarterly dock-5'])
})

test('a base-currency entry has no foreign amount', async ({ page }) => {
  await settle(page, '/general-ledger')
  await view(page, 'Journal entries').click()
  const first = page.locator('tr.gl-je-parent').first()
  expect(await cellsUnder(page, first, 'Currency')).toEqual(['USD'])
  expect(await flagsUnder(page, first)).toEqual(['us'])
  expect(await cellsUnder(page, first, 'Amount (foreign currency)')).toEqual(['-'])
  expect((await cellsUnder(page, first, 'Journal entry ID'))[0]).toMatch(/^JNL-\d{6}$/)
})

test('finds an entry by its internal ID and by a tag, and marks the match', async ({ page }) => {
  const { je, id } = await postEuroEntry(page)
  await page.getByTitle('Back to General Ledger').first().click()
  await page.locator('tbody tr').first().waitFor()
  await view(page, 'Journal entries').click()

  await page.getByPlaceholder('Search entries').fill(id)
  const byId = page.locator('tr.gl-je-parent')
  await expect(byId).toHaveCount(1)
  await expect(byId).toContainText(je)
  const i = (await rawHeaders(page)).indexOf('Journal entry ID')
  await expect(byId.locator(`td:nth-child(${i + 1}) mark`)).toHaveText(id)

  await page.getByPlaceholder('Search entries').fill('dock-5')
  const byTag = page.locator('tr.gl-je-parent').filter({ hasText: je })
  await expect(byTag).toHaveCount(1)
  const t = (await rawHeaders(page)).indexOf('Tags')
  await expect(byTag.locator(`td:nth-child(${t + 1}) mark`)).toHaveText('dock-5')
})
