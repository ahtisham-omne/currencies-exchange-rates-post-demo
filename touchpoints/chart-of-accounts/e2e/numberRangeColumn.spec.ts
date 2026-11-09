import { test, expect, type Page } from '@playwright/test'

/* The block of numbers a summary reserves used to print small and grey beneath
   the account number. As a column of its own it can be read, sorted, filtered
   and switched off like the fact about the summary that it is.

   Pinned against the running page because the move is only half done in the
   source: the old line is gone from the number cell, which no source-text test
   can tell apart from a column that renders nothing. */

const headers = (page: Page) =>
  page.$$eval('thead tr th', ths => ths.map(t => t.innerText.trim().split('\n')[0]).filter(Boolean))

// The cell under a named row, by the column's position in the header.
async function cellIn(page: Page, row: string, header: string) {
  const th = page.locator('thead th', { hasText: header })
  const i = await th.evaluate(el => Array.from(el.parentElement!.children).indexOf(el))
  return page.locator('tbody tr', { hasText: row }).first().locator('td').nth(i)
}

// The panel's eye button is the switch; the label beside it is inert.
async function toggleColumn(page: Page, key: string) {
  await page.getByRole('button', { name: /columns/i }).first().click()
  // The eye, not the last button: a row that is on also offers Freeze.
  await page.locator(`[data-col-key="${key}"]`).getByTitle(/^(Hide|Show) column$/).click()
  await page.getByRole('button', { name: /columns/i }).first().click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
})

test.describe('a summary states the numbers it reserves in its own column', () => {
  test('shows the block without being asked', async ({ page }) => {
    expect(await headers(page)).toContain('Number range')
    await expect(await cellIn(page, 'Cash and Cash Equivalents', 'Number range')).toHaveText('11100–11199')
  })

  test('leaves the number alone', async ({ page }) => {
    // The whole point of the move: the number cell carries the number, and
    // nothing else. It used to carry the range stacked underneath.
    await expect(await cellIn(page, 'Cash and Cash Equivalents', 'GL account no.')).toHaveText('11100')
  })

  test('dashes every row without a range, postings included', async ({ page }) => {
    /* A posting is a leaf and could never reserve a block; a summary can and
       this one has not. The column does not tell the two apart, because blank
       on most of its rows reads as a rendering fault rather than an answer. */
    await expect(await cellIn(page, 'Petty Cash', 'Number range')).toHaveText('-')
    // Long-Term Debt is the demo's summary left without a typed range.
    await expect(await cellIn(page, 'Long-Term Debt', 'Number range')).toHaveText('-')
  })

  test('filters to the summary holding a number, by that number alone', async ({ page }) => {
    /* Filtered by overlap rather than by the two ends separately: the question
       the column invites is "who has 59500?", and 59500 in both boxes has to find
       the summary reserving 50000-59999. Comparing an end to an end would not. */
    await page.locator('thead th', { hasText: 'Number range' }).locator('button').first().click()
    const pop = page.locator('[data-col-popover]')
    await pop.getByText('Filter', { exact: true }).click()
    await pop.locator('input[type=number]').first().fill('59500')
    await pop.locator('input[type=number]').last().fill('59500')
    await page.keyboard.press('Escape')

    const rows = page.locator('tbody tr')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('EXPENSES')
    await expect(await cellIn(page, 'EXPENSES', 'Number range')).toHaveText('50000–59999')
  })

  test('switches off like any other column, and takes nothing else with it', async ({ page }) => {
    await toggleColumn(page, 'numberRange')
    expect(await headers(page)).not.toContain('Number range')
    // The number is still there rather than having gone with it.
    await expect(await cellIn(page, 'Cash and Cash Equivalents', 'GL account no.')).toHaveText('11100')
  })
})
