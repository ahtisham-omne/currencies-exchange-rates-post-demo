import { test, expect, type Page } from '@playwright/test'

/* The Dimensions list searches every column as it prints - the name, every
   value, the status, and who made and last changed a dimension and when - and
   marks what it found. Mahad, 2026-10-05: *"the search should have everything in
   it."* The list hides no columns, so there is nothing to bring out. */

const headers = (page: Page) =>
  page.$$eval('thead tr th', ths => ths.map(t => (t as HTMLElement).innerText.trim().split('\n')[0]))

async function cellUnder(page: Page, rowText: string, header: string) {
  const at = (await headers(page)).indexOf(header)
  expect(at, `${header} is on screen`).toBeGreaterThan(-1)
  return page.locator('tbody tr', { hasText: rowText }).first().locator('td').nth(at)
}

const search = (page: Page) => page.getByPlaceholder('Search by name or value')

test.beforeEach(async ({ page }) => {
  await page.goto('/dimensions', { waitUntil: 'networkidle' })
  await page.waitForSelector('tbody tr')
})

test('finds and marks who last changed a dimension', async ({ page }) => {
  await search(page).fill('marcus')
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect((await cellUnder(page, 'Department', 'Last updated by')).locator('mark')).toHaveText('Marcus')
  await search(page).fill('')
  expect(await page.locator('tbody tr').count()).toBeGreaterThan(1)
})

test('finds and marks the day a dimension was made, as it prints', async ({ page }) => {
  const stamp = (await (await cellUnder(page, 'Location', 'Created on')).innerText()).trim()
  const day = stamp.split(',').slice(0, 2).join(',') // "Jun 7, 2026"
  await search(page).fill(day)
  await expect((await cellUnder(page, 'Location', 'Created on')).locator('mark')).toHaveText(day)
})

test('leads with a value found behind the +N, marked', async ({ page }) => {
  await search(page).fill('singapore')
  const values = await cellUnder(page, 'Location', 'Values')
  await expect(values.locator('mark')).toHaveText(/singapore/i)
})

test('marks the status it found', async ({ page }) => {
  await search(page).fill('active')
  await expect((await cellUnder(page, 'Location', 'Status')).locator('mark')).toHaveText(/active/i)
})
