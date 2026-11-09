import { test, expect, type Page, type Locator } from '@playwright/test'
import { settle, view } from './glPage'

/* The General ledger's search reads every column on the tab, shown or hidden, by
   the text its cell prints, and marks what it found. Mahad, 2026-10-05: *"I am
   still unable to search in general ledger and journal entry. Also, the search
   should have everything in it. For example, When I have search for "System"
   and the created by column is active, it doesn't heightlight it ... do this
   carefully for both active and hidden columns."* His screenshot: "ahti" on the
   Journal entries tab, Created by shown, 0 of 657 entries.

   A hidden column the search matched in is brought out next to Account for the
   search, and the note the chart of accounts carries names it.

   Read off the page, not the store: the demo ledger drifts with the calendar, so
   each test picks its terms from what the page shows. */

const search = (page: Page) => page.getByPlaceholder(/^Search (entries|postings)$/)
const headers = (page: Page) =>
  page.$$eval('thead tr th', ths => ths.map(t => (t as HTMLElement).innerText.trim().split('\n')[0]))
const note = (page: Page) => page.locator('[data-search-revealed]')
const count = async (page: Page) => {
  const t = await page.getByText(/ of [\d,]+ (entries|postings)$/).first().innerText()
  return Number(t.split(' ')[0].replace(/,/g, ''))
}

async function toggleColumn(page: Page, key: string) {
  await page.getByRole('button', { name: /^Columns/ }).first().click()
  await page.locator(`[data-col-key="${key}"]`).getByTitle(/^(Hide|Show) column$/).click()
  await page.getByRole('button', { name: 'Close columns' }).click()
}

async function column(page: Page, header: string): Promise<number> {
  const at = (await headers(page)).indexOf(header)
  expect(at, `${header} is on screen`).toBeGreaterThan(-1)
  return at
}

const cellsUnder = (page: Page, rows: Locator, at: number) => rows.locator(`td:nth-child(${at + 1})`)

test.describe('the Journal entries tab', () => {
  test.beforeEach(async ({ page }) => {
    await settle(page, '/general-ledger')
    await view(page, 'Journal entries').click()
    await page.locator('tr.gl-je-parent').first().waitFor()
  })

  test('finds entries by who posted them, and marks the name in a shown Created by', async ({ page }) => {
    await toggleColumn(page, 'createdBy')
    await search(page).fill('system')
    await expect.poll(() => count(page)).toBeGreaterThan(0)
    const at = await column(page, 'Created by')
    const cells = cellsUnder(page, page.locator('tr.gl-je-parent'), at)
    await expect(cells.first().locator('mark')).toHaveText(/^system$/i)
    // Shown already, so it is not brought out and the note does not name it.
    // (Last updated by, still off, repeats the poster and is brought out.)
    await expect(note(page)).not.toContainText('Created by')
  })

  test('brings a hidden Created by out next to Account, and says so', async ({ page }) => {
    expect(await headers(page)).not.toContain('Created by')
    await search(page).fill('system')
    // Last updated by repeats the poster until an entry is reversed, so it answers too.
    await expect(note(page)).toHaveText('Your search also matched Created by and Last updated by, so those columns are shown while you search.')
    const hs = await headers(page)
    expect(hs.indexOf('Created by')).toBe(hs.indexOf('Account') + 1)
    const cells = cellsUnder(page, page.locator('tr.gl-je-parent'), hs.indexOf('Created by'))
    await expect(cells.first().locator('mark')).toBeVisible()

    // Only for the search.
    await search(page).fill('')
    await expect(note(page)).toHaveCount(0)
    expect(await headers(page)).not.toContain('Created by')
  })

  test('a column hidden again during the search stays hidden', async ({ page }) => {
    await search(page).fill('system')
    await expect(note(page)).toBeVisible()
    await page.getByRole('columnheader').filter({ hasText: 'Created by' }).first().getByRole('button').first().click()
    await page.locator('[data-col-popover]').getByText('Hide', { exact: true }).click()
    expect(await headers(page)).not.toContain('Created by')
    await expect(note(page)).toHaveText('Your search also matched Last updated by, so that column is shown while you search.')
  })

  test('finds an amount typed without its separators, and marks it', async ({ page }) => {
    const at = await column(page, 'Amount')
    const amounts = await cellsUnder(page, page.locator('tr.gl-je-parent'), at).allInnerTexts()
    const printed = amounts.map(a => a.trim()).find(a => /\d,\d{3}\.\d\d$/.test(a))
    expect(printed, 'an entry of a thousand or more is on the page').toBeTruthy()
    const bare = printed!.replace(/[^\d.]/g, '').replace(/\.00$/, '')
    await search(page).fill(bare)
    const row = page.locator('tr.gl-je-parent').filter({ hasText: printed! }).first()
    await expect(row).toBeVisible()
    await expect(row.locator('mark').first()).toBeVisible()
  })

  test('finds entries by a date as the Date column prints it', async ({ page }) => {
    const date = (await page.locator('tr.gl-je-parent').first().locator('td').nth(await column(page, 'Date')).innerText()).trim()
    expect(date).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/)
    await search(page).fill(date)
    await expect.poll(() => count(page)).toBeGreaterThan(0)
    await expect(page.locator('tr.gl-je-parent').first().locator('mark').first()).toHaveText(date)
  })
})

test.describe('the General ledger tab', () => {
  test.beforeEach(async ({ page }) => {
    await settle(page, '/general-ledger')
    await view(page, 'General ledger').click()
    await page.locator('tbody.gl-group').first().waitFor()
  })

  test('finds a debit typed without its separators, opens its account, and marks it', async ({ page }) => {
    // Open accounts until a posting of a thousand or more is on screen.
    const groups = page.locator('tbody.gl-group')
    let printed: string | undefined
    for (let i = 0; i < Math.min(await groups.count(), 12) && !printed; i++) {
      await groups.nth(i).locator('button[aria-label="Expand"]').first().click()
      const figures = await groups.nth(i).locator('tr.gl-child td').allInnerTexts()
      printed = figures.map(f => f.trim()).find(f => /^\$ \d{1,3}(,\d{3})+\.\d\d$/.test(f))
    }
    expect(printed, 'a posting of a thousand or more is on screen').toBeTruthy()
    await page.getByRole('button', { name: /^(Expand|Collapse) all/ }).first().click().catch(() => {})
    await settle(page, '/general-ledger')
    await view(page, 'General ledger').click()

    const bare = printed!.replace(/[^\d.]/g, '').replace(/\.00$/, '')
    await search(page).fill(bare)
    const marked = page.locator('tbody.gl-expanded tr.gl-child mark').first()
    await expect(marked).toBeVisible()
    expect((await marked.innerText()).replace(/,/g, '')).toBe(bare)
  })

  test('leaves an account it found by name shut, and opens one whose posting it found', async ({ page }) => {
    const name = (await page.locator('tbody.gl-group > tr:first-child td:first-child').first().innerText())
      .replace(/\s+/g, ' ').replace(/^\S+\s/, '').replace(/ · .*$/, '').trim()
    await search(page).fill(name)
    await expect.poll(() => page.locator('tbody.gl-group').count()).toBeGreaterThan(0)
    // A group the name found on its own row stays shut; one that is open is open
    // because a posting inside also holds the name, and shows it marked.
    const named = page.locator('tbody.gl-group').filter({ has: page.locator('tr.gl-parent mark') })
    await expect.poll(() => named.count()).toBeGreaterThan(0)
    for (let i = 0; i < await named.count(); i++) {
      const g = named.nth(i)
      if (await g.evaluate(el => el.classList.contains('gl-expanded'))) await expect(g.locator('tr.gl-child mark').first()).toBeVisible()
    }
    // And nothing comes back shut without a mark to say why.
    await expect(page.locator('tbody.gl-group:not(.gl-expanded)').filter({ hasNot: page.locator('mark') })).toHaveCount(0)

    // A posting's date is the posting's own text, so its account opens onto it.
    await view(page, 'Journal entries').click()
    const date = (await page.locator('tr.gl-je-parent').first().locator('td').nth(await column(page, 'Date')).innerText()).trim()
    await view(page, 'General ledger').click()
    await search(page).fill(date)
    await expect.poll(() => page.locator('tbody.gl-expanded').count()).toBeGreaterThan(0)
    await expect(page.locator('tbody.gl-expanded tr.gl-child mark').first()).toHaveText(date)
  })
})

/* "ahti": an entry posted from the form is stamped with the poster's name, and
   its first letters find it - the search Mahad ran. */
test('an entry posted here is found by the first letters of who posted it', async ({ page }) => {
  await settle(page, '/general-ledger')
  await page.getByRole('button', { name: 'New journal entry' }).first().click()
  const m = page.locator('body > div.fixed').filter({ hasText: 'New journal entry' }).last()
  await m.getByText('Journal lines').first().waitFor()
  for (const [row, number, col] of [[0, '52110', 'debit'], [1, '11130', 'credit']] as const) {
    await m.locator('table button[aria-haspopup="listbox"]').nth(row).click()
    const list = page.getByRole('listbox').last()
    await list.getByPlaceholder('Search account by name or number').fill(number)
    await list.getByRole('option').filter({ hasText: `${number} · ` }).first().click()
    await expect(list).toHaveCount(0)
    await m.locator('table').getByLabel(col, { exact: true }).nth(row).fill('37')
  }
  await m.getByRole('button', { name: 'Post journal entry' }).click()
  await page.waitForURL(/\/general-ledger\/entry\//)
  const je = decodeURIComponent(page.url().split('/entry/')[1])

  // Back through the breadcrumb, not a reload: the save to the browser's
  // storage may not have landed yet, and a reload would read the old ledger.
  await page.getByText('General ledger', { exact: true }).first().click()
  await page.waitForURL(/\/general-ledger$/)
  await view(page, 'Journal entries').click()
  await search(page).fill('ahti')
  const row = page.locator('tr.gl-je-parent').filter({ hasText: je }).first()
  await expect(row).toBeVisible()
  // Created by is off, so the search brings it out to show why the entry answered.
  await expect(note(page)).toContainText('Created by')
  // Marked in Created by (and in Last updated by, which repeats it).
  await expect(row.locator('mark').filter({ hasText: /^ahti$/i }).first()).toBeVisible()
})
