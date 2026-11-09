import { test, expect, type Page } from '@playwright/test'

/* Search reads every column, on or off. Mahad, 2026-10-05: *"Right now when I
   search only the internal ID is being searched when it is hidden from the
   column configurator. I think this should be the case for every column that is
   hidden."* A match in a column that is off brings the column out for the
   search and the note above the table names it - the note he asked to keep:
   *"I really like this indicator."* */

const search = (page: Page) => page.getByPlaceholder('Search accounts')
const headers = (page: Page) =>
  page.$$eval('thead tr th', ths => ths.map(t => (t as HTMLElement).innerText.trim().split('\n')[0]))
const note = (page: Page) => page.getByText(/^Your search also matched/)

async function cellUnder(page: Page, rowText: string, header: string) {
  const at = (await headers(page)).indexOf(header)
  expect(at, `${header} is on screen`).toBeGreaterThan(-1)
  return page.locator('tbody tr', { hasText: rowText }).first().locator('td').nth(at)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
})

test('finds an account by who made it, with both people columns off', async ({ page }) => {
  const before = await headers(page)
  expect(before).not.toContain('Created by')
  expect(before).not.toContain('Last updated by')

  await search(page).fill('marcus')
  await expect(note(page)).toHaveText('Your search also matched Created by and Last updated by, so those columns are shown while you search.')
  const cell = await cellUnder(page, 'Petty Cash', 'Created by')
  await expect(cell.locator('mark')).toHaveText('Marcus')

  // Only for the search: clearing it gives the reader's columns back.
  await search(page).fill('')
  await expect(note(page)).toHaveCount(0)
  expect(await headers(page)).not.toContain('Created by')
})

test('finds an account by a dimension value, with Dimensions off', async ({ page }) => {
  // On by default once the chart carries dimensions, so turned off first.
  await page.getByRole('button', { name: /^Columns/ }).first().click()
  await page.locator('[data-col-key="dimensions"]').getByTitle('Hide column').click()
  await page.getByRole('button', { name: 'Close columns' }).click()
  expect(await headers(page)).not.toContain('Dimensions')
  await search(page).fill('singapore')
  await expect(note(page)).toContainText('Dimensions')
  await expect(page.locator('tbody tr', { hasText: '52210' }).first()).toBeVisible()
})

test('marks the match in a column that is already on', async ({ page }) => {
  // Account role ships on and was never searched.
  await search(page).fill('accounts receivable')
  // 11310 rather than the 11300 summary above it, which carries no role.
  const cell = await cellUnder(page, '11310', 'Account role')
  await expect(cell.locator('mark')).toHaveText(/accounts receivable/i)
})

/* Figures and dates are searched as they print. Mahad, 2026-10-05: *"the
   search should have everything in it."* A figure is found with or without its
   thousands separators, and the mark lands on the figure as printed. */
test('finds a figure typed without its separators, and marks it as printed', async ({ page }) => {
  const cell = await cellUnder(page, 'Petty Cash', 'Running balance')
  const printed = (await cell.innerText()).trim()
  const digits = printed.replace(/[^0-9.]/g, '').replace(/\.00$/, '')
  expect(digits.length, `a figure to look for in "${printed}"`).toBeGreaterThan(3)
  await search(page).fill(digits)
  const after = await cellUnder(page, 'Petty Cash', 'Running balance')
  await expect(after.locator('mark')).toHaveCount(1)
  expect(printed).toContain(await after.locator('mark').innerText())
})

test('finds an account by the day it was made, with Created on off', async ({ page }) => {
  // Read the day off the column, then put the column away again.
  await page.getByRole('button', { name: /^Columns/ }).first().click()
  await page.locator('[data-col-key="createdAt"]').getByTitle('Show column').click()
  await page.getByRole('button', { name: 'Close columns' }).click()
  const stamp = (await (await cellUnder(page, 'Petty Cash', 'Created on')).innerText()).trim()
  await page.getByRole('button', { name: /^Columns/ }).first().click()
  await page.locator('[data-col-key="createdAt"]').getByTitle('Hide column').click()
  await page.getByRole('button', { name: 'Close columns' }).click()
  expect(await headers(page)).not.toContain('Created on')

  const day = stamp.split(',').slice(0, 2).join(',') // "Sep 12, 2026"
  await search(page).fill(day)
  await expect(note(page)).toContainText('Created on')
  const cell = await cellUnder(page, 'Petty Cash', 'Created on')
  await expect(cell.locator('mark')).toHaveText(day)
})

test('marks a status it found', async ({ page }) => {
  await search(page).fill('inactive')
  const at = (await headers(page)).indexOf('Status')
  await expect(page.locator(`tbody tr td:nth-child(${at + 1}) mark`, { hasText: /^Inactive$/ }).first()).toBeVisible()
})
