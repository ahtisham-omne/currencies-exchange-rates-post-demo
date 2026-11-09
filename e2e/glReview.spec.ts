import { test, expect, type Page } from '@playwright/test'
import { settle, view } from './glPage'

/* The General Ledger and the tables around it, as the design review of
   2026-09-24 left them.

   Ledger: insights off by default; GL category renamed and hidden; Dimensions
   hidden but searched and filtered; the entry number under the account instead
   of a column; Debit, Credit and Running balance always shown and no longer
   pinned; Expand all fast enough to use.

   Every table: Freeze in the Columns panel, and the whole header cell opens the
   column's menu. */

const headers = (page: Page) =>
  page.$$eval('thead tr th', ths => ths.map(t => t.innerText.trim().split('\n')[0]).filter(Boolean))
const th = (page: Page, name: string) => page.locator('thead th').filter({ hasText: name }).first()

async function ledger(page: Page) {
  await settle(page, '/general-ledger')
  await view(page, 'General ledger').click()
}

async function expandAll(page: Page) {
  await page.getByRole('button', { name: /^(Expand|Collapse) all$/ }).first().click()
  await page.getByText('Show the postings under every account').click()
  await page.locator('tr.gl-child').first().waitFor()
}

test.describe('the ledger opens with room for the ledger', () => {
  test('shows no insight cards until asked for', async ({ page }) => {
    await ledger(page)
    await expect(page.getByText('Customize insights')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Insights/ })).toContainText('0')
  })

  test('shows the columns the review kept, and not the ones it hid', async ({ page }) => {
    await ledger(page)
    const h = await headers(page)
    for (const kept of ['Account', 'Date', 'Source', 'Linked document', 'Line description', 'Debit', 'Credit', 'Running balance']) expect(h).toContain(kept)
    // Memo is the entry's, so it is the Journal entries tab's (2026-09-30).
    for (const hidden of ['GL category', 'GL account category', 'Dimensions', 'Journal entry number', 'Link Description', 'Memo']) expect(h).not.toContain(hidden)
  })

  test('puts the entry number under the account, where the tree had nothing', async ({ page }) => {
    await ledger(page)
    await expandAll(page)
    const accountCell = page.locator('tr.gl-child').first().locator('td').first()
    await expect(accountCell.getByRole('button', { name: /^JE-/ })).toBeVisible()
  })

  test('pins the account, and not the figures', async ({ page }) => {
    await ledger(page)
    const position = (name: string) => th(page, name).evaluate(el => getComputedStyle(el).position)
    expect(await position('Account')).toBe('sticky')
    for (const figure of ['Debit', 'Credit', 'Running balance']) expect(await position(figure)).not.toBe('sticky')
  })
})

test.describe('the figures a ledger is', () => {
  test('cannot be hidden from the Columns panel', async ({ page }) => {
    await ledger(page)
    await page.getByRole('button', { name: /Columns/ }).first().click()
    for (const key of ['debit', 'credit', 'balance']) {
      await expect(page.locator(`[data-col-key="${key}"]`).getByTitle('Always shown')).toHaveCount(2)
    }
    // Hide All leaves them on screen.
    await page.getByRole('button', { name: 'Hide All' }).click()
    for (const figure of ['Debit', 'Credit', 'Running balance']) expect(await headers(page)).toContain(figure)
  })

  test('cannot be hidden from their header menu, but can be frozen', async ({ page }) => {
    await ledger(page)
    await th(page, 'Debit').click({ position: { x: 8, y: 10 } })
    const menu = page.locator('[data-col-popover]')
    await expect(menu).toContainText('Freeze')
    await expect(menu.getByText('Hide', { exact: true })).toHaveCount(0)
  })
})

test.describe('a hidden column still answers', () => {
  /* Since 2026-10-05 the column comes out by itself for the search, with the
     note every searchable table in the module carries (components/SearchReveal),
     in place of a banner offering to show it. */
  test('search finds a dimension value, and brings the hidden column out to show it', async ({ page }) => {
    await ledger(page)
    expect(await headers(page)).not.toContain('Dimensions')
    await page.getByPlaceholder('Search postings').fill('United Kingdom')
    const note = page.locator('[data-search-revealed]')
    await expect(note).toContainText('Dimensions')
    const count = await page.getByText(/ of [\d,]+ postings$/).first().innerText()
    expect(Number(count.split(' ')[0].replace(/,/g, ''))).toBeGreaterThan(0)
    expect(await headers(page)).toContain('Dimensions')
    await expect(page.locator('tbody.gl-expanded tr.gl-child mark').filter({ hasText: 'United Kingdom' }).first()).toBeVisible()
    await page.getByPlaceholder('Search postings').fill('')
    await expect(note).toHaveCount(0)
    expect(await headers(page)).not.toContain('Dimensions')
  })

  test('the Filters panel filters by dimension', async ({ page }) => {
    await ledger(page)
    const before = await page.getByText(/ of [\d,]+ postings$/).first().innerText()
    await page.getByRole('button', { name: /^Filters/ }).first().click()
    const modal = page.locator('body > div.fixed.inset-0').last()
    await expect(modal.getByText('Dimensions', { exact: true })).toBeVisible()
    await modal.getByRole('button', { name: /^United Kingdom/ }).first().click()
    await modal.getByRole('button', { name: /^Show [\d,]+ posting/ }).click()
    const after = await page.getByText(/ of [\d,]+ postings$/).first().innerText()
    expect(Number(after.split(' ')[0].replace(/,/g, ''))).toBeLessThan(Number(before.split(' ')[0].replace(/,/g, '')))
  })
})

test.describe('Expand all', () => {
  test('draws the groups near the screen first, and the rest as they scroll in', async ({ page }) => {
    await ledger(page)
    await expandAll(page)
    const spacers = page.locator('tr[data-gl-spacer]')
    expect(await spacers.count()).toBeGreaterThan(0)
    const drawnBefore = await page.locator('tr.gl-child').count()
    await page.locator('table').first().evaluate(t => { (t.closest('.overflow-auto') as HTMLElement).scrollTop += 15000 })
    await expect.poll(() => page.locator('tr.gl-child').count()).toBeGreaterThan(drawnBefore)
  })

  test('traces the connector to a hovered posting without re-rendering the page', async ({ page }) => {
    await ledger(page)
    await expandAll(page)
    const group = page.locator('tbody.gl-group.gl-expanded').filter({ has: page.locator('tr.gl-child:nth-of-type(4)') }).first()
    const rows = group.locator('tr.gl-child')
    await rows.nth(2).hover()
    await expect(rows.nth(2).locator('.gl-guide-elbow').first()).toBeVisible()
    await expect(rows.nth(0).locator('.gl-guide-through')).toBeVisible()
    await expect(rows.nth(3).locator('.gl-guide-through')).toBeHidden()
  })
})

test.describe('every table', () => {
  test('offers Freeze in the Columns panel, and the column freezes', async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.waitForSelector('thead th')
    await page.getByRole('button', { name: /columns/i }).first().click()
    const row = page.locator('[data-col-key="classification"]')
    await row.hover()
    await row.getByRole('button', { name: 'Freeze Statement classification' }).click()
    await expect(row.getByRole('button', { name: 'Unfreeze Statement classification' })).toHaveAttribute('aria-pressed', 'true')
    expect(await th(page, 'Statement classification').evaluate(el => getComputedStyle(el).position)).toBe('sticky')
  })

  test('opens the column menu from anywhere in the header cell, not only the label', async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.waitForSelector('thead th')
    const cell = th(page, 'Statement classification')
    const box = (await cell.boundingBox())!
    // The far right of the cell, clear of the label and short of the resize grip.
    await page.mouse.click(box.x + box.width - 14, box.y + box.height / 2)
    await expect(page.locator('[data-col-popover]')).toBeVisible()
  })
})
