import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

/* Mahad, 2026-09-24: *"PDF export truncates names and amounts, and the page
   count is wrong."*

   Both were true and both were structural. Cells were laid out with autotable's
   `ellipsize`, so a 24-column export cut 1,585 of them - the heading row
   included, where "Statement Classification" printed as "Statem...". And the
   footer was stamped from `didDrawPage`, which runs as each page is produced: the
   total it could read was only ever the pages so far, so a six-page file said
   "Page 1 of 1", "Page 2 of 2", on to "Page 6 of 6".

   Read out of the bytes. jsPDF writes its content streams uncompressed unless
   asked otherwise, so every string it drew is in the file as `(text) Tj` - which
   is the only place the two defects were ever visible. */

const strings = (pdf: Buffer) =>
  [...pdf.toString('latin1').matchAll(/\(((?:[^()\\]|\\.)*)\) Tj/g)].map(m => m[1])

const pageCount = (pdf: Buffer) => {
  const counts = [...pdf.toString('latin1').matchAll(/\/Count (\d+)/g)].map(m => Number(m[1]))
  return Math.max(...counts)
}

async function exportPdf(page: Page, everyColumn: boolean) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  await expect(async () => {
    await page.getByRole('button', { name: /Create GL account/ }).locator('xpath=..')
      .getByRole('button', { name: /^Actions/ }).click()
    await page.getByRole('button', { name: 'Export', exact: true }).click({ timeout: 2000 })
    await expect(page.getByRole('heading', { name: 'Export Accounts' })).toBeVisible({ timeout: 2000 })
  }).toPass({ timeout: 20000 })

  if (everyColumn) {
    await page.locator('[data-export-panel]').getByRole('checkbox', { name: 'Select All Columns' }).click()
    await expect(page.getByText(/^All \d+ columns selected$/)).toBeVisible()
  }
  const started = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export as PDF' }).click()
  return readFileSync((await (await started).path())!)
}

for (const everyColumn of [false, true]) {
  const what = everyColumn ? 'every column' : 'the listing columns'

  test(`numbers its pages against the file it ended up writing, on ${what}`, async ({ page }) => {
    const pdf = await exportPdf(page, everyColumn)
    const total = pageCount(pdf)
    // Or the file is one page and "Page 1 of 1" was right by accident.
    expect(total, 'the export runs to more than one page').toBeGreaterThan(1)
    expect(strings(pdf).filter(s => s.startsWith('Page ')))
      .toEqual(Array.from({ length: total }, (_, i) => `Page ${i + 1} of ${total}`))
  })

  test(`cuts nothing short on ${what}`, async ({ page }) => {
    const pdf = await exportPdf(page, everyColumn)
    const drawn = strings(pdf)
    expect(drawn.filter(s => s.endsWith('...')), 'cells cut short').toEqual([])

    /* Named, so the assertion above cannot pass on a file that drew nothing.
       Whether a heading wraps depends on how wide its column came out, so it
       counts either drawn in one piece or a word to a line - what it must never
       be is a fragment of a word. */
    /* Whole on one line, or wrapped over consecutive lines that break between
       words. The figure columns print as money now, so they are wider and a
       long name can take two lines - which is a wrap, not a cut. */
    const arrivesWhole = (text: string) => drawn.some((_, i) => {
      let acc = ''
      for (let j = i; j < drawn.length; j++) {
        acc = acc ? `${acc} ${drawn[j]}` : drawn[j]
        if (acc === text) return true
        if (!text.startsWith(`${acc} `)) return false
      }
      return false
    })
    for (const whole of ['Allowance for Doubtful Accounts', 'Statement classification']) {
      expect(arrivesWhole(whole), `${whole} arrives whole`).toBe(true)
    }
  })
}

/* A figure is one token. Wrapping rescued it from being cut, but an amount
   broken over two lines has stopped being an amount, so the columns holding one
   are sized to the widest value in them and never squeezed below it. */
test('writes every balance as a single unbroken figure', async ({ page }) => {
  const pdf = await exportPdf(page, true)
  const drawn = strings(pdf)

  // The chart's own totals, off the listing, so this is checked against figures
  // the page is showing rather than against whatever the file happens to hold.
  const onScreen = await page.evaluate(() =>
    Array.from(document.querySelectorAll('tbody tr'), r =>
      Array.from(r.querySelectorAll('td'), td => td.textContent ?? '')))
  /* As money, the way the listing prints it - not the bare 5858600 a
     spreadsheet wants. Mahad, 2026-09-29: *"PDF export amounts are hard to
     read. They print as 5858600 instead of $5,858,600.00."* */
  const figures = onScreen
    .flat()
    .map(c => c.trim())
    .filter(c => /^-?\$\s[\d,]+\.\d{2}$/.test(c))
  expect(figures.length, 'the listing prints figures to compare against').toBeGreaterThan(0)

  const missing = [...new Set(figures)].filter(f => !drawn.includes(f))
  expect(missing, 'figures the file did not write as the listing does').toEqual([])
})

/* The figures are period-scoped, so the page says which day they are struck at -
   and the opening figure is struck at the other end of the period from the rest.
   Mahad, 2026-09-30: *"The PDF's Opening balance column has no date. The header
   says balances are as of Sep 30, but the opening balance is as of Sep 1."* Read
   as a pattern rather than as dates, so the test does not drift with the
   calendar: the opening day is the first of a month, and not the closing day. */
test('says which day each figure column is as of', async ({ page }) => {
  const drawn = strings(await exportPdf(page, false))
  expect(drawn).toContain('Chart of Accounts Export')
  const DAY = '([A-Z][a-z]{2} \\d{1,2}, \\d{4})'
  const line = drawn.map(s => new RegExp(`^Opening balance as of ${DAY} · Running balance(?: and Foreign balance)? as of ${DAY}$`).exec(s)).find(Boolean)
  expect(line, drawn.filter(s => s.includes(' as of ')).join(' | ')).toBeTruthy()
  const [, opened, closed] = line!
  expect(opened).toMatch(/^[A-Z][a-z]{2} 1, /)
  // The same day only on the period's first, when nothing has posted yet.
  if (new Date().getDate() !== 1) expect(opened).not.toBe(closed)
  else expect(closed).toBe(opened)
  expect(drawn.some(s => s.startsWith('Balances as of'))).toBe(false)
  expect(drawn.some(s => s.startsWith('Exported '))).toBe(true)
})
