import { test, expect, type Page } from '@playwright/test'

/* Where the chart says an account came from. It is a column, and only a column.

   Two things sat beside the account name before it: a switch by the quick-filter
   pills, then an "Imported" chip gated on the Prior account number column being
   on. Both are gone - the column answers the question for every row and in both
   directions, so a chip a few columns away from it was restating a cell.

   Pinned against the running page because the column ships hidden. A source-text
   test reads both halves of this as present while the screen shows one pill, no
   pill, or a chip nobody asked for. */

const headers = (page: Page) =>
  page.$$eval('thead tr th', ths =>
    ths.map(t => t.innerText.trim().split('\n')[0]).filter(Boolean))

// The panel's eye button is the switch; the label beside it is inert.
async function toggleColumn(page: Page, key: string) {
  await page.getByRole('button', { name: /columns/i }).first().click()
  // The eye, not the last button: a row that is on also offers Freeze.
  await page.locator(`[data-col-key="${key}"]`).getByTitle(/^(Hide|Show) column$/).click()
  await page.getByRole('button', { name: /columns/i }).first().click()
}

/* Which cell of a row is the Imported one, counted over every `th` including the
   unlabelled select and kebab columns - `headers` drops those, and the row's
   `td`s do not. Read by position rather than by contents, because the point is
   to read whatever is in it. */
async function importedIndex(page: Page) {
  const at = await page.$$eval('thead tr th', ths =>
    ths.findIndex(t => (t as HTMLElement).innerText.trim().split('\n')[0] === 'Imported'))
  expect(at, 'Imported column is on screen').toBeGreaterThan(-1)
  return at
}

const importedCell = async (page: Page, name: string) =>
  page.locator('tbody tr', { hasText: name }).first().locator('td').nth(await importedIndex(page))

test.describe('the chart says where an account came from, in a column', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chart-of-accounts')
    await page.waitForSelector('thead th')
  })

  test('says nothing about provenance until it is asked', async ({ page }) => {
    expect(await headers(page)).not.toContain('Imported')
    expect(await headers(page)).not.toContain('Prior account number')
  })

  /* Both answers, both chipped, in the same shape. One chipped and the other set
     as plain text read as an answer and a blank space where an answer would go,
     when they are two answers to one question. */
  test('chips both answers alike', async ({ page }) => {
    await toggleColumn(page, 'imported')
    // Seeded migrated branch, and an account nobody imported.
    const yes = await importedCell(page, 'Operating - Chase Bank')
    const no = await importedCell(page, 'Marketable Securities')

    await expect(yes.locator('span').first()).toHaveText('Yes')
    await expect(no.locator('span').first()).toHaveText('No')
    // Same chip: the pill's own padding and radius, which plain text has neither of.
    for (const cell of [yes, no]) {
      await expect(cell.locator('span').first()).toHaveClass(/rounded-md/)
      await expect(cell.locator('span').first()).toHaveClass(/px-2\.5/)
    }
  })

  test('answers on every row, so a blank is never one of the answers', async ({ page }) => {
    await toggleColumn(page, 'imported')
    const at = await importedIndex(page)
    const texts = await page.$$eval(`tbody tr td:nth-child(${at + 1})`,
      tds => tds.map(t => (t as HTMLElement).innerText.trim()))
    expect(texts.length).toBeGreaterThan(0)
    expect(texts.every(t => t === 'Yes' || t === 'No')).toBe(true)
    // And it really is answering rather than saying one thing throughout.
    expect(new Set(texts).size).toBe(2)
  })

  /* Nothing beside the name, whichever provenance column is on. The chip used to
     appear with Prior account number, which is the column most likely to be
     turned on next to this one. */
  test('leaves the account name alone', async ({ page }) => {
    const chips = page.locator('tbody .badge-info', { hasText: 'Imported' })
    await expect(chips).toHaveCount(0)
    for (const key of ['imported', 'originalNumber']) {
      await toggleColumn(page, key)
      await expect(chips).toHaveCount(0)
    }
  })
})
