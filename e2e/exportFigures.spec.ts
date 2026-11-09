import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

/* Mahad, 2026-09-24: *"Exports show summary totals as zero."* and *"Exporting a
   single account drops its parent."*

   Two readings of the same mistake: the file answered both questions out of what
   it had to hand instead of out of the chart. A summary account stores no balance
   of its own - its figure is the sum of what hangs beneath it - so `a.balance`
   was the zero nothing had ever written to. And a parent was looked up among the
   rows being exported, which for a selection of one never includes it.

   Read back off the written file, because the bug was in the bytes: the modal
   looked right and the chart on screen showed the right totals the whole time. */

// The file names a column the way the listing header does, so these are the
// listing's own words rather than a second vocabulary for the same facts.
const HEADER = ['GL account no.', 'GL account name', 'GL account type', 'Parent', 'Opening balance', 'Running balance', 'Status']

// RFC 4180 enough for the cells this file writes: quoted fields with doubled
// quotes inside, CRLF between records.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c !== '"') { cell += c; continue }
      if (text[i + 1] === '"') { cell += '"'; i++; continue }
      quoted = false
      continue
    }
    if (c === '"') { quoted = true; continue }
    if (c === ',') { row.push(cell); cell = ''; continue }
    if (c === '\r') continue
    if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue }
    cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

type Row = Record<string, string>

async function csvRows(page: Page): Promise<Row[]> {
  const started = page.waitForEvent('download')
  await page.getByText(/^CSV File$/).first().click()
  await page.getByRole('button', { name: 'Export as CSV' }).click()
  const d = await started
  // The BOM is stripped, or the first heading arrives with it glued on.
  const text = readFileSync((await d.path())!, 'utf8').replace(/^﻿/, '')
  const [head, ...body] = parseCsv(text)
  for (const h of HEADER) expect(head, `the file carries a ${h} column`).toContain(h)
  return body.filter(r => r.length === head.length)
    .map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])))
}

async function openExport(page: Page) {
  await expect(async () => {
    await page.getByRole('button', { name: /Create GL account/ }).locator('xpath=..')
      .getByRole('button', { name: /^Actions/ }).click()
    await page.getByRole('button', { name: 'Export', exact: true }).click({ timeout: 2000 })
    await expect(page.getByRole('heading', { name: 'Export Accounts' })).toBeVisible({ timeout: 2000 })
  }).toPass({ timeout: 20000 })
  // Every column, so the file can be checked against itself.
  await page.locator('[data-export-panel]').getByRole('checkbox', { name: 'Select All Columns' }).click()
  await expect(page.getByText(/^All \d+ columns selected$/)).toBeVisible()
}

test('a summary account carries what it totals, not a zero', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  await openExport(page)
  const rows = await csvRows(page)

  const summaries = rows.filter(r => r.Status === 'Active' && r['GL account type'] === 'Summary')
  expect(summaries.length, 'the chart holds summary accounts to check').toBeGreaterThan(0)

  // A summary is the sum of the rows naming it as their parent - which is the
  // whole of what the figure means, and what the listing beside it prints.
  let nonZero = 0
  for (const s of summaries) {
    const kids = rows.filter(r => r.Parent === s['GL account no.'])
    const total = kids.reduce((n, r) => n + Number(r['Running balance'] || 0), 0)
    expect(Number(s['Running balance']), `${s['GL account no.']} ${s['GL account name']}`).toBeCloseTo(total, 2)
    if (Number(s['Running balance']) !== 0) nonZero++
  }
  /* Or the loop above is satisfied by a file of zeros summing to zero, which is
     exactly the file this test exists to reject. */
  expect(nonZero, 'some summary account totals something').toBeGreaterThan(0)
})

/* The listing had this right the whole time, which is what made the file's zeros
   so hard to argue with: two surfaces over one chart, disagreeing. */
test('the figures in the file are the figures on the row', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')

  const headings = (await page.locator('thead th').allInnerTexts()).map(h => h.trim())
  const col = (h: string) => {
    const i = headings.indexOf(h)
    expect(i, `the listing shows a ${h} column`).toBeGreaterThan(-1)
    return i
  }
  const money = (s: string) => Number(s.replace(/[^0-9.-]/g, ''))

  // "1000 Asset ASSETS (50) 2" → "1000". A summary row, so the figure it prints
  // is a rollup rather than a stored amount.
  const onScreen = new Map<string, { opening: number; balance: number }>()
  for (const cells of await page.locator('tbody tr').filter({ hasText: 'Summary' }).evaluateAll(
    rows => rows.slice(0, 6).map(r => Array.from(r.querySelectorAll('td'), td => td.textContent ?? '')))) {
    onScreen.set(cells[col('GL account no.')].trim(), {
      opening: money(cells[col('Opening balance')]),
      balance: money(cells[col('Running balance')]),
    })
  }
  expect(onScreen.size, 'the chart draws summary rows').toBeGreaterThan(0)
  expect([...onScreen.values()].some(v => v.balance !== 0), 'one of them prints a total').toBe(true)

  await openExport(page)
  const written = await csvRows(page)
  for (const [number, shown] of onScreen) {
    const row = written.find(r => r['GL account no.'] === number)
    expect(row, `the file carries ${number}`).toBeTruthy()
    expect(Number(row!['Running balance']), `${number} closing`).toBeCloseTo(shown.balance, 2)
    expect(Number(row!['Opening balance']), `${number} opening`).toBeCloseTo(shown.opening, 2)
  }
})

test('exporting one account still says where it sits', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')

  /* A row far enough down the list to have a parent. The tree opens with the
     category anchors expanded, so the rows under the first one are children. */
  const checks = page.locator('tbody input[type="checkbox"]')
  await checks.nth(1).click()
  await page.getByRole('button', { name: 'Export' }).click()
  await expect(page.getByRole('heading', { name: 'Export Accounts' })).toBeVisible()
  await page.locator('[data-export-panel]').getByRole('checkbox', { name: 'Select All Columns' }).click()

  const rows = await csvRows(page)
  expect(rows).toHaveLength(1)
  expect(rows[0].Parent, 'the one row exported names the summary it rolls into').not.toBe('')
})
