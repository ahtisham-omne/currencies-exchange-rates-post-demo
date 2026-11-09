import { test, expect, type Page } from '@playwright/test'

/* Mahad, 2026-10-11: *"Running balance always shows the current balance always.
   Does not change with the period filter."* The opening balance still follows
   the period; the running balance does not, on a posting row or a summary. */

const rowByNumber = (page: Page, number: string) => page.locator('tbody tr[data-tree-account]').filter({ hasText: number }).first()

async function cell(page: Page, number: string, col: string) {
  const heads = await page.locator('thead th').evaluateAll(ths => ths.map(th => th.getAttribute('data-col-head')))
  return (await rowByNumber(page, number).locator(':scope > td').nth(heads.indexOf(col)).innerText()).trim()
}

async function pickMonth(page: Page, month: string) {
  await page.getByRole('button', { name: 'Change accounting period' }).click()
  const panel = page.locator('body > div').filter({ hasText: 'Fiscal year' }).last()
  await panel.getByText('Month', { exact: true }).click()
  await panel.locator('button', { hasText: new RegExp(`^${month}`) }).first().click()
  await expect(page.getByRole('button', { name: 'Change accounting period' })).toHaveText(new RegExp(`^${month.slice(0, 3)}`))
}

test('the running balance stays at today whatever period is picked', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  const summary = (await page.locator('tbody tr[data-tree-account]').first().innerText()).match(/^\s*(\S+)/)![1]
  const before = { posting: await cell(page, '11130', 'runningBalance'), summary: await cell(page, summary, 'runningBalance'), opening: await cell(page, '11130', 'openingBalance') }

  await pickMonth(page, 'March')
  await expect.poll(() => cell(page, '11130', 'openingBalance')).not.toBe(before.opening)
  expect(await cell(page, '11130', 'runningBalance')).toBe(before.posting)
  expect(await cell(page, summary, 'runningBalance')).toBe(before.summary)
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-mahad-Documents-Chart-of-Accounts-chart-of-accounts-v2-1/2c6fbcd7-160c-43c6-ac48-a99e1668ca44/scratchpad/running-march.png' })
})

test('the period picker says what it changes and what it does not', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Change accounting period' }).hover()
  await expect(page.getByText('The accounting period this page reports on. Changing it updates the opening balance and period KPIs. Current KPIs and running balance don’t change with it.')).toBeVisible()
})
