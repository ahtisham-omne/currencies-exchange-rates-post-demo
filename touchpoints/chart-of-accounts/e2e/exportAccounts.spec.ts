import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

/* The export modal, and the three files it writes.

   The picker used to offer three formats and write two: "Excel Spreadsheet" put
   `text/csv` in a file named `.csv`, so a reader who chose Excel got the same
   bytes CSV had already given them under a label promising a workbook. Each
   format is opened here and the downloaded file is read back, because a suggested
   filename is not evidence of what is inside it - only the leading bytes are.

   The surface is checked in a browser rather than in source because half of what
   the port added is behaviour: the full-view toggle, the scope banner that reports
   which trigger opened the modal, and a footer that names the format it will
   write. */

// The header's own action group, reached as the parent of the one button only it
// has - the filter row carries buttons under the same names.
const headerBar = (page: Page) =>
  page.getByRole('button', { name: /Create GL account/ }).locator('xpath=..')

/* Actions → Export. Retried as a unit because `Menu` closes itself on any scroll
   event, and the KPI cards and insights panel land late enough to fire one - so
   the item can be gone between the click that opened it and the click that picks
   it. Nothing else on the page is a button named exactly "Export" while the
   dropdown is the only thing open. */
async function openFromActions(page: Page) {
  await expect(async () => {
    await headerBar(page).getByRole('button', { name: /^Actions/ }).click()
    await page.getByRole('button', { name: 'Export', exact: true }).click({ timeout: 2000 })
    await expect(page.getByRole('heading', { name: 'Export Accounts' })).toBeVisible({ timeout: 2000 })
  }).toPass({ timeout: 20000 })
}

async function openExport(page: Page) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  await openFromActions(page)
}

/** Pick a format card, press the footer button, and hand back the saved file. */
async function download(page: Page, card: RegExp, cta: string) {
  await page.getByText(card).first().click()
  const started = page.waitForEvent('download')
  await page.getByRole('button', { name: cta }).click()
  const d = await started
  return { name: d.suggestedFilename(), bytes: readFileSync((await d.path())!) }
}

test('each format writes its own format', async ({ page }) => {
  await openExport(page)

  // CSV: a BOM, then the header row in plain text.
  const csv = await download(page, /^CSV File$/, 'Export as CSV')
  expect(csv.name).toMatch(/^Chart_of_Accounts_Export_\d{4}-\d{2}-\d{2}\.csv$/)
  expect(csv.bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]))
  expect(csv.bytes.subarray(0, 64).toString('utf8')).toContain('GL account name')

  await openExport(page)

  // XLSX is a zip container, so it opens on "PK". A CSV wearing an .xlsx coat
  // fails here, which is the defect this test exists for.
  const xlsx = await download(page, /^Excel Spreadsheet$/, 'Export as Excel')
  expect(xlsx.name).toMatch(/\.xlsx$/)
  expect(xlsx.bytes.subarray(0, 2).toString('latin1')).toBe('PK')

  await openExport(page)

  const pdf = await download(page, /^PDF Document$/, 'Export as PDF')
  expect(pdf.name).toMatch(/\.pdf$/)
  expect(pdf.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')
})

test('the footer names the format it is about to write', async ({ page }) => {
  await openExport(page)
  // PDF is the card the modal opens on.
  await expect(page.getByRole('button', { name: 'Export as PDF' })).toBeVisible()
  await page.getByText(/^Excel Spreadsheet$/).first().click()
  await expect(page.getByRole('button', { name: 'Export as Excel' })).toBeVisible()
  await page.getByText(/^CSV File$/).first().click()
  await expect(page.getByRole('button', { name: 'Export as CSV' })).toBeVisible()
})

test('the banner reports the trigger that opened the modal', async ({ page }) => {
  await openExport(page)
  await expect(page.getByText('Every account on your list will be exported')).toBeVisible()
  const all = Number((await page.getByText(/^\d+ accounts?$/).first().innerText()).split(' ')[0])
  await page.keyboard.press('Escape')

  // A search narrows it, and the banner says so rather than repeating the whole.
  await page.getByPlaceholder('Search accounts').fill('cash')
  // The search is debounced; under a loaded run the modal could open on the
  // whole list before it landed. The count reading "N of M" is the sign it has.
  await expect.poll(async () => {
    const [shown, total] = ((await page.getByText(/^\d+ of \d+ accounts$/).first().innerText()).match(/\d+/g) ?? []).map(Number)
    return shown < total
  }).toBe(true)
  await openFromActions(page)
  await expect(page.getByText('Only the accounts matching your current filters will be exported')).toBeVisible()
  const filtered = Number((await page.getByText(/^\d+ accounts?$/).first().innerText()).split(' ')[0])
  expect(filtered).toBeGreaterThan(0)
  expect(filtered).toBeLessThan(all)
})

test('the bulk bar exports the ticked rows, and says so', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')

  const rowChecks = page.locator('tbody input[type="checkbox"]')
  await rowChecks.nth(0).click()
  await rowChecks.nth(1).click()
  await page.getByRole('button', { name: 'Export' }).click()

  await expect(page.getByRole('heading', { name: 'Export Accounts' })).toBeVisible()
  await expect(page.getByText('Only the accounts you selected will be exported')).toBeVisible()
  await expect(page.getByText('2 accounts', { exact: true })).toBeVisible()
})

test('the column picker searches, and the account name cannot be dropped', async ({ page }) => {
  await openExport(page)

  // Scoped: the listing's own Columns panel carries a box under almost the same
  // placeholder, and it is in the DOM whether or not it is open.
  const panel = page.locator('[data-export-panel]')
  const search = panel.getByPlaceholder('Search columns')

  await search.fill('balance')
  const labels = await panel.locator('[data-field-id]').allInnerTexts()
  expect(labels.length).toBeGreaterThan(0)
  for (const l of labels) expect(l.toLowerCase()).toContain('balance')

  await search.fill('zzz')
  await expect(panel.getByText('No Columns Match Your Search.')).toBeVisible()
  await search.fill('')

  // The modal opens part-checked, so the master box fills it first and clears it
  // second. The account name is locked on and so is out of its reach: the count
  // falls to the one column every export must carry, never to none.
  const selectAll = panel.getByRole('checkbox', { name: 'Select All Columns' })
  await selectAll.click()
  await expect(panel.getByText(/^All \d+ columns selected$/)).toBeVisible()
  await selectAll.click()
  await expect(panel.getByText(/^1 of \d+ columns selected$/)).toBeVisible()
  await expect(panel.locator('[data-field-id="name"] input[type="checkbox"]')).toBeChecked()
  await expect(panel.getByRole('button', { name: /^Export as/ })).toBeEnabled()
})

/* Mahad, 2026-09-24: *"The export needs to show all the columns in the column
   manager. Pre-selected are ones that are in the default view in listing."* and
   *"Only those columns should be present in the exports as well."*

   Which two lists line up is arithmetic, and `exportColumns.test.ts` holds that.
   What only a running page can say is that the picker a reader opens is ticked
   the way the table behind it is drawn, and that a column the file has just
   learned about reaches the file. */
test('opens ticked the way the listing is drawn, and writes what it ticked', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  await openFromActions(page)

  const panel = page.locator('[data-export-panel]')
  const box = (key: string) => panel.locator(`[data-field-id="${key}"] input[type="checkbox"]`)

  /* Shown on the listing and, until now, absent from the file altogether - there
     was no Opening balance or Dimensions column to tick. */
  await expect(box('openingBalance')).toBeChecked()
  await expect(box('dimensions')).toBeChecked()
  // Shown on the listing, offered by the file, and arriving unticked.
  await expect(box('role')).toBeChecked()
  await expect(box('numberRange')).toBeChecked()
  await expect(box('normalBalance')).toBeChecked()

  /* Hidden on the listing and arriving ticked, which is the same drift running
     the other way: Category is hidden because the sticky per-category band
     already says it, and nobody had told the export. */
  await expect(box('type')).not.toBeChecked()
  await expect(box('currency')).not.toBeChecked()

  /* The picker offers the Columns panel's catalogue and nothing else. These five
     were its own, for facts nothing on the listing states. */
  for (const gone of ['netChange', 'incomeBalance', 'contra', 'directPosting', 'effectiveDate']) {
    await expect(panel.locator(`[data-field-id="${gone}"]`), `${gone} is no longer offered`).toHaveCount(0)
  }

  const csv = await download(page, /^CSV File$/, 'Export as CSV')
  const header = csv.bytes.toString('utf8').split('\r\n')[0]
  expect(header).toContain('Opening balance')
  expect(header).toContain('Dimensions')
  expect(header).toContain('Account role')
  // One tick, two cells: a range is no use as half a string in a spreadsheet.
  expect(header).toContain('Number range start')
  expect(header).toContain('Number range end')
  expect(header).not.toContain('GL account category')
})

test('follows the listing when a column is hidden there', async ({ page }) => {
  // Not a fixed list of its own: the picker reads whatever the table is showing
  // at the moment it opens.
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  const columns = page.getByRole('button', { name: /^Columns/ })
  await columns.click()
  // The panel's own toggle: an eye button inside the row, which is how a reader
  // hides a column and what the export has to be reading.
  await page.locator('[data-col-key="role"]').getByTitle('Hide column').click()
  await columns.click()

  await openFromActions(page)
  await expect(page.locator('[data-export-panel] [data-field-id="role"] input[type="checkbox"]')).not.toBeChecked()
})

test('full view fills the window and comes back', async ({ page }) => {
  await openExport(page)
  const panel = page.locator('[data-export-panel]')

  /* The panel both animates in and transitions its max-width, so a width read
     straight after a click is a frame of the animation rather than the size it
     is heading for. Waited out per toggle. */
  const settledWidth = async () => {
    await panel.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
    return (await panel.boundingBox())!.width
  }

  const before = await settledWidth()

  await page.getByRole('button', { name: 'Full View' }).click()
  await expect(page.getByRole('button', { name: 'Exit Full' })).toBeVisible()
  expect(await settledWidth()).toBeGreaterThan(before)

  await page.getByRole('button', { name: 'Exit Full' }).click()
  expect(await settledWidth()).toBe(before)
})
