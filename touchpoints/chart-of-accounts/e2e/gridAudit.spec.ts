import { test, expect, type Locator, type Page } from '@playwright/test'

/* Design review, 2026-10-02, the chart of accounts and its grids.

   - Every grid can show who made a record and when, and who changed it last and
     when, and be filtered by both. Eli went looking for the entry he had just
     posted: *"I know I made it, so let me find the ones I made."*
   - Opening balance hides like any other figure.
   - Actions keeps the width of its button, however few columns are showing.
   - A row's menu offers "Create account above" and "Create account below".

   Pinned against the running page: each of these is a claim about what a reader
   finds on screen. */

const headers = (page: Page) =>
  page.$$eval('thead tr th', ths => ths.map(t => (t as HTMLElement).innerText.trim().split('\n')[0]))

async function toggleColumn(page: Page, key: string) {
  await page.getByRole('button', { name: /^Columns/ }).first().click()
  await page.locator(`[data-col-key="${key}"]`).getByTitle(/^(Hide|Show) column$/).click()
  await page.getByRole('button', { name: 'Close columns' }).click()
}

async function cellUnder(page: Page, row: Locator, header: string) {
  const at = (await headers(page)).indexOf(header)
  expect(at, `${header} is on screen`).toBeGreaterThan(-1)
  return row.locator('td').nth(at)
}

async function listing(page: Page) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
}

test.describe('the chart of accounts', () => {
  test.beforeEach(async ({ page }) => { await listing(page) })

  test('offers the four audit columns, off until asked for', async ({ page }) => {
    const before = await headers(page)
    for (const h of ['Created by', 'Created on', 'Last updated by', 'Last updated on']) expect(before).not.toContain(h)

    await toggleColumn(page, 'createdBy')
    await toggleColumn(page, 'createdAt')
    const row = page.locator('tbody tr', { hasText: 'Petty Cash' }).first()
    await expect(await cellUnder(page, row, 'Created by')).toHaveText('MLMarcus Lee')
    // A date and a time of day.
    await expect(await cellUnder(page, row, 'Created on')).toHaveText(/^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2} [AP]M$/)
  })

  test('filters by who created an account, from the Filters panel', async ({ page }) => {
    await page.getByRole('button', { name: /^Filters/ }).first().click()
    const created = page.locator('div', { has: page.getByText('Who added the account, and when.') }).last()
    await created.getByRole('button', { name: /Marcus Lee/ }).click()
    await page.getByRole('button', { name: /^Show \d+ accounts?$/ }).click()
    // 141 since Current Year Earnings became an account (2026-10-10).
    await expect(page.getByText(/^12\s*of\s*141 accounts$/)).toBeVisible()
  })

  test('hides Opening balance like any other column', async ({ page }) => {
    expect(await headers(page)).toContain('Opening balance')
    await toggleColumn(page, 'openingBalance')
    expect(await headers(page)).not.toContain('Opening balance')
  })

  test('keeps Actions the width of its button when few columns are showing', async ({ page }) => {
    await page.getByRole('button', { name: /^Columns/ }).first().click()
    for (const key of ['dimensions', 'numberRange', 'classification', 'glType', 'role', 'normalBalance', 'openingBalance', 'runningBalance', 'fxBalance', 'status']) {
      const hide = page.locator(`[data-col-key="${key}"]`).getByTitle('Hide column')
      if (await hide.count()) await hide.click()
    }
    await page.getByRole('button', { name: 'Close columns' }).click()
    const actions = page.locator('thead th[data-actions-cell]')
    expect((await actions.boundingBox())!.width).toBeLessThan(80)
    // Still at the right edge of the table, where the spare width went in front of it.
    const table = (await page.locator('table').first().boundingBox())!
    const box = (await actions.boundingBox())!
    expect(Math.abs(box.x + box.width - (table.x + table.width))).toBeLessThan(2)
  })

  test('creates an account above or below a row, numbered in the gap', async ({ page }) => {
    const row = page.locator('tbody tr', { hasText: 'Operating - Chase Bank' }).first()
    await row.getByRole('button', { name: 'Actions for Operating - Chase Bank' }).click()
    await page.getByRole('button', { name: 'Create account above' }).click()
    const form = page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()
    // Classification first, as every create opens (Mahad, 2026-10-09).
    await form.getByText('What kind of account is this?').first().waitFor()
    await form.getByRole('button', { name: /^Continue/ }).click()
    await form.getByText('GL account details').first().waitFor()
    const field = (label: string) => form.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)
    await expect(field('GL account no.').locator('input')).toHaveValue('11125')
    await expect(field('Parent')).toContainText('11100')
    // Picked for the place asked for, so the end-of-branch recommendation stays quiet.
    await expect(form.getByText(/Next recommended/)).toHaveCount(0)
  })

  test('offers neither beside a category, which has no parent to share', async ({ page }) => {
    await page.getByRole('button', { name: 'Actions for ASSETS' }).click()
    // The menu is open - its first item is there - and the two are not.
    await expect(page.getByRole('button', { name: 'Edit account' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create account above' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create account below' })).toHaveCount(0)
  })
})

test('the dimensions list says who added and last changed each dimension', async ({ page }) => {
  await page.goto('/dimensions', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  const row = page.locator('tbody tr', { hasText: 'Department' }).first()
  await expect(await cellUnder(page, row, 'Created by')).toHaveText('AKAyesha Khan')
  await expect(await cellUnder(page, row, 'Last updated by')).toHaveText('MLMarcus Lee')

  await page.getByRole('button', { name: /^Filters/ }).first().click()
  const modified = page.locator('div', { has: page.getByText('Who last changed the dimension, and when.') }).last()
  await modified.getByRole('button', { name: /Marcus Lee/ }).click()
  await page.getByRole('button', { name: 'Show 1 dimension' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
})

test('the journal entries tab says who posted each entry', async ({ page }) => {
  await page.goto('/general-ledger', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Journal entries' }).click()
  await page.waitForSelector('thead th')
  await toggleColumn(page, 'createdBy')
  const at = (await headers(page)).indexOf('Created by')
  expect(at).toBeGreaterThan(-1)
  const names = await page.$$eval(`tbody tr td:nth-child(${at + 1})`, tds => tds.map(t => (t as HTMLElement).innerText.trim()).filter(Boolean))
  expect(names.length).toBeGreaterThan(0)
  for (const n of names.slice(0, 10)) expect(n).toMatch(/Ayesha Khan|Daniel Osei|System|Ahtisham Ahmad/)
})
