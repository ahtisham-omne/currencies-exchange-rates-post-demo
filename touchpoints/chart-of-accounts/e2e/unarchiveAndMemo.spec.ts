import { test, expect, type Locator, type Page } from '@playwright/test'
import { settle, view } from './glPage'

/* Two of Mahad's pointers from 2026-09-30, read against the running page.

   *"Unarchive account has no confirmation. One click makes the account active
   again straight away."* Archiving is confirmed, and bringing an account back
   puts it on the chart again, so it is asked the same way - from the menu and
   from the status chip alike, and Cancel leaves it archived.

   *"The Memo field shows the first line's text."* The General ledger tab's Memo
   column read each posting's line text, so a typed memo never reached it; and an
   entry posted with no memo borrowed its first line's text for one. */

// 11180 Legacy Petty Cash (Closed): archived in the seed, with no balance.
const ARCHIVED = 'acct_arch_petty'
const dialog = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Unarchive account?' }).last()
const statusChip = (page: Page) =>
  page.locator('.rounded-full', { hasText: /^(Active|Inactive|Archived)$/ }).first()

test.describe('unarchive asks first', () => {
  test('from the Actions menu, and Cancel leaves it archived', async ({ page }) => {
    await page.goto(`/chart-of-accounts/${ARCHIVED}`, { waitUntil: 'networkidle' })
    await expect(statusChip(page)).toHaveText('Archived')
    await page.getByRole('button', { name: 'Account actions' }).click()
    await page.getByRole('button', { name: 'Unarchive account' }).click()
    const d = dialog(page)
    await expect(d).toBeVisible()
    await expect(d).toContainText('will be restored to your chart of accounts and reports, and can be used in transactions again.')

    await d.getByRole('button', { name: 'Cancel' }).click()
    await expect(d).toHaveCount(0)
    await expect(statusChip(page)).toHaveText('Archived')

    await page.getByRole('button', { name: 'Account actions' }).click()
    await page.getByRole('button', { name: 'Unarchive account' }).click()
    await dialog(page).getByRole('button', { name: 'Unarchive account' }).click()
    await expect(statusChip(page)).toHaveText('Active')
  })

  test('from the row menu on the chart', async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.waitForSelector('thead th')
    // An archived account is only listed under the Archived pill.
    await page.getByRole('button', { name: /^Archived\b/ }).first().click()
    const row = page.locator('tbody tr').filter({ hasText: 'Legacy Petty Cash' }).first()
    // The kebab is the last cell's button; the row menu has no label of its own.
    await row.locator('td').last().locator('button').last().click()
    await page.getByRole('button', { name: 'Unarchive account' }).click()
    await expect(dialog(page)).toBeVisible()
    await expect(row).toContainText('Archived')
  })
})

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'New journal entry' }).last()

async function fillLine(page: Page, m: Locator, row: number, number: string, col: 'debit' | 'credit', amount: string, text: string) {
  await m.locator('table button[aria-haspopup="listbox"]').nth(row).click()
  const list = page.getByRole('listbox').last()
  await list.getByPlaceholder('Search account by name or number').fill(number)
  await list.getByRole('option').filter({ hasText: `${number} · ` }).first().click()
  await expect(list).toHaveCount(0)
  await m.locator('table').getByLabel(col, { exact: true }).nth(row).fill(amount)
  await m.locator('table input[placeholder="Optional, this line only"]').nth(row).fill(text)
}

async function post(page: Page, memo: string) {
  await settle(page, '/general-ledger')
  await page.getByRole('button', { name: 'New journal entry' }).first().click()
  const m = modal(page)
  await m.getByText('Journal lines').first().waitFor()
  if (memo) await m.getByLabel('Memo', { exact: true }).fill(memo)
  await fillLine(page, m, 0, '52110', 'debit', '77', 'First line text')
  await fillLine(page, m, 1, '11130', 'credit', '77', 'Second line text')
  await m.getByRole('button', { name: 'Post journal entry' }).click()
  await page.waitForURL(/\/general-ledger\/entry\//)
  return decodeURIComponent(page.url().split('/entry/')[1])
}

const rail = (page: Page) =>
  page.locator('div.rounded-xl').filter({ has: page.getByText('Journal entry information', { exact: true }) }).last()

// The cells under one header for the entry's rows on one tab.
async function cellsUnder(page: Page, tab: 'General ledger' | 'Journal entries', je: string, header: string) {
  await page.getByTitle('Back to General Ledger').first().click()
  await page.locator('table tbody tr').first().waitFor()
  await view(page, tab).click()
  await page.getByPlaceholder(tab === 'Journal entries' ? 'Search entries' : 'Search postings').fill(je)
  const rows = page.locator('tbody tr').filter({ hasText: je })
  await expect(rows.first()).toBeVisible()
  const heads = (await page.locator('table thead th').allInnerTexts()).map(h => h.trim())
  const idx = heads.indexOf(header)
  if (idx < 0) return null
  return (await rows.locator(`td:nth-child(${idx + 1})`).allInnerTexts()).map(s => s.trim())
}

test.describe('the memo is the memo', () => {
  test('a typed memo is what every surface calls Memo', async ({ page }) => {
    const je = await post(page, 'Typed memo')
    await expect(rail(page)).toContainText('MemoTyped memo')
    // No Description: the memo is the entry's text (2026-09-30).
    await expect(rail(page).getByText('Description', { exact: true })).toHaveCount(0)
    /* The General ledger tab lists lines, so it shows each line's own text and
       no Memo. Mahad, 2026-09-30: *"the General Ledger listing page should
       display line item descriptions instead of a header memo."* */
    expect(await cellsUnder(page, 'General ledger', je, 'Memo')).toBeNull()
    await page.goto(`/general-ledger/entry/${encodeURIComponent(je)}`, { waitUntil: 'networkidle' })
    expect((await cellsUnder(page, 'General ledger', je, 'Line description'))!.sort()).toEqual(['First line text', 'Second line text'])
    await page.goto(`/general-ledger/entry/${encodeURIComponent(je)}`, { waitUntil: 'networkidle' })
    expect(await cellsUnder(page, 'Journal entries', je, 'Memo')).toEqual(['Typed memo'])
  })

  test('no memo reads as none, not as a line', async ({ page }) => {
    const je = await post(page, '')
    await expect(rail(page)).toContainText('Memo-')
    await expect(rail(page)).not.toContainText('First line text')
    expect(await cellsUnder(page, 'Journal entries', je, 'Memo')).toEqual(['-'])
  })
})
