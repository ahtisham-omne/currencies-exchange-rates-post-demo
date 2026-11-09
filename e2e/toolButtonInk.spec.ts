import { test, expect, type Page } from '@playwright/test'

/* The table toolbar's Density and Columns buttons draw their text and icon in
   the Insights button's colours. Mahad, 2026-10-01: *"the grey color on the
   icon and text is not right on these two buttons wherever they are in the
   entire module. Please use the same colors as we have in the insights button."*
   Read as computed colours, because the claim is about paint. */

const ink = (page: Page, name: RegExp) => page.getByRole('button', { name }).first().evaluate(el => ({
  text: getComputedStyle(el).color,
  icon: getComputedStyle(el.querySelector('svg')!).color,
}))

for (const path of ['/chart-of-accounts', '/general-ledger']) {
  test(`${path}: Density and Columns read like Insights`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' })
    await page.locator('tbody tr').first().waitFor()
    const insights = await ink(page, /^Insights/)
    expect(await ink(page, /^Columns/)).toEqual(insights)
    expect(await ink(page, /^(Condensed|Comfort|Standard|Compact)/)).toEqual(insights)
  })
}

test('the account register\'s Columns reads like the chart\'s Insights', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('tbody tr').first().waitFor()
  const insights = await ink(page, /^Insights/)
  await page.goto('/chart-of-accounts/acct_11130', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Transactions', exact: true }).first().click()
  await page.locator('tbody tr').first().waitFor()
  expect(await ink(page, /^Columns/)).toEqual(insights)
})
