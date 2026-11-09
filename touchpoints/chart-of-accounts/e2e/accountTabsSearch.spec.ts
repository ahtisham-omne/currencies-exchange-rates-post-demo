import { test, expect, type Page } from '@playwright/test'

/* An account's own tables search every column as it prints, on or off, and mark
   what they found. Mahad, 2026-10-05: *"can we have that on all searchable
   tables in the COA module? ... the search should have everything in it ... do
   this carefully for both active and hidden columns."*

   Read off the page: each claim is about what the reader finds on screen. */

const headers = (page: Page) =>
  page.$$eval('thead tr th', ths => ths.map(t => (t as HTMLElement).innerText.trim().split('\n')[0]))
const note = (page: Page) => page.locator('[data-search-revealed]')

async function cellUnder(page: Page, rowText: string | RegExp, header: string) {
  const at = (await headers(page)).indexOf(header)
  expect(at, `${header} is on screen`).toBeGreaterThan(-1)
  return page.locator('tbody tr', { hasText: rowText }).first().locator('td').nth(at)
}

/** "$ 1,234.56" as a reader types it off a statement: digits and the point only. */
const bare = (figure: string) => figure.replace(/[^\d.]/g, '')

test.describe("a summary's Accounts tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chart-of-accounts/acct_11100', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /^Accounts$/ }).first().click()
    await page.locator('tbody tr').first().waitFor()
  })

  test('brings out and marks the people columns it found a name in', async ({ page }) => {
    const before = await headers(page)
    expect(before).not.toContain('Created by')
    const search = page.getByPlaceholder('Search accounts')
    await search.fill('marcus')
    await expect(note(page)).toHaveText('Your search also matched Created by and Last updated by, so those columns are shown while you search.')
    await expect((await cellUnder(page, 'Petty Cash', 'Created by')).locator('mark')).toHaveText('Marcus')
    // Next to the name, where the eye already is.
    const after = await headers(page)
    expect(after.indexOf('Created by')).toBe(after.indexOf('GL account name') + 1)

    await search.fill('')
    await expect(note(page)).toHaveCount(0)
    expect(await headers(page)).not.toContain('Created by')
  })

  test('finds an account by its internal ID, with the column off', async ({ page }) => {
    await page.getByPlaceholder('Search accounts').fill('ACC-')
    await expect(note(page)).toContainText('Internal ID')
    await expect((await cellUnder(page, 'Petty Cash', 'Internal ID')).locator('mark')).toHaveText('ACC-')
  })

  test('finds a balance typed without its separators, and marks it', async ({ page }) => {
    const figure = (await (await cellUnder(page, 'Petty Cash', 'Running balance')).innerText()).trim()
    expect(figure).toMatch(/\d/)
    await page.getByPlaceholder('Search accounts').fill(bare(figure))
    const cell = await cellUnder(page, 'Petty Cash', 'Running balance')
    await expect(cell.locator('mark')).toHaveCount(1)
    expect(bare(await cell.locator('mark').innerText())).toBe(bare(figure))
  })
})

test.describe("a posting account's Transactions tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chart-of-accounts/acct_11130', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Transactions', exact: true }).first().click()
    await page.locator('tbody tr').first().waitFor()
  })
  const search = (page: Page) => page.getByPlaceholder('Search transactions')

  test('marks a figure typed without its separators, and the date as it prints', async ({ page }) => {
    const row = page.locator('tbody tr').first()
    const at = await headers(page)
    const debit = (await row.locator('td').nth(at.indexOf('Debit')).innerText()).trim()
    const credit = (await row.locator('td').nth(at.indexOf('Credit')).innerText()).trim()
    const [col, figure] = /\d/.test(debit) ? ['Debit', debit] : ['Credit', credit]
    await search(page).fill(bare(figure))
    const cell = page.locator('tbody tr').filter({ has: page.locator('mark') }).first().locator('td').nth(at.indexOf(col))
    await expect(cell.locator('mark')).toHaveCount(1)
    expect(bare(await cell.locator('mark').innerText())).toBe(bare(figure))

    const date = (await page.locator('tbody tr').first().locator('td').nth(at.indexOf('Date')).innerText()).trim()
    await search(page).fill(date)
    await expect(page.locator('tbody tr').first().locator('td').nth(at.indexOf('Date')).locator('mark')).toHaveText(date)
  })

  test('brings back a column the reader hid when the search is in it, and lets it go after', async ({ page }) => {
    const source = (await (await cellUnder(page, /./, 'Source')).innerText()).trim()
    await page.getByRole('button', { name: 'Columns' }).first().click()
    await page.locator('[data-col-key="source"]').getByTitle('Hide column').click()
    await page.getByRole('button', { name: 'Close columns' }).click()
    expect(await headers(page)).not.toContain('Source')

    await search(page).fill(source)
    await expect(note(page)).toHaveText('Your search also matched Source, so that column is shown while you search.')
    const after = await headers(page)
    expect(after.indexOf('Source')).toBe(after.indexOf('Journal entry number') + 1)
    await expect((await cellUnder(page, /./, 'Source')).locator('mark')).toHaveText(source)

    await search(page).fill('')
    await expect(note(page)).toHaveCount(0)
    expect(await headers(page)).not.toContain('Source')
  })
})

test("the Attachments tab searches who uploaded a file, and marks it", async ({ page }) => {
  await page.goto('/chart-of-accounts/acct_11130', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Attachments/ }).first().click()
  const search = page.getByPlaceholder('Search attachments...')
  await search.fill('marcus')
  await expect(page.getByText('Voided check - scan.png')).toBeVisible()
  await expect(page.locator('mark', { hasText: /^Marcus$/ }).first()).toBeVisible()
  await expect(page.getByText('Bank authorisation letter.rtf')).toBeVisible()
  // The files Ayesha uploaded are not listed.
  await expect(page.getByText('Signature card - 2026.pdf')).toHaveCount(0)

  // And by the date a file was added, as it prints.
  await search.fill('')
  const dated = page.getByText(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/).first()
  const date = (await dated.innerText()).trim()
  await search.fill(date)
  await expect(page.locator('mark', { hasText: date }).first()).toBeVisible()
})
