import { test, expect } from '@playwright/test'

/* The period picker's hover, in plain English, page by page. Mahad,
   2026-10-14: *"Tooltip on period to be in simple plain english that is easy to
   understand."* */
for (const [page_, url, text] of [
  ['the General ledger', '/general-ledger', 'Accounting period to view, set to the current period by default.'],
  ['an account', '/chart-of-accounts/acct_11130', "Pick the period to look at. It changes the opening balance and this period's figures, but not the running balance."],
  ['the chart', '/chart-of-accounts', 'The accounting period this page reports on. Changing it updates the opening balance and period KPIs. Current KPIs and running balance don’t change with it.'],
] as const) {
  test(`says what the period changes on ${page_}`, async ({ page }) => {
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Change accounting period' }).hover()
    await expect(page.getByText(text, { exact: true })).toBeVisible()
    await expect(page.getByText(/re-strikes/)).toHaveCount(0)
    if (url === '/general-ledger') await page.screenshot({ path: '/private/tmp/claude-501/-Users-mahad-Documents-Chart-of-Accounts-chart-of-accounts-v2-1/2c6fbcd7-160c-43c6-ac48-a99e1668ca44/scratchpad/period-gl.png', clip: { x: 60, y: 150, width: 700, height: 200 } })
  })
}

/* The General ledger's own words for the strip, Mahad's copy of 2026-10-14: the
   month as the calendar names it, "Custom range" once a date is edited, and what
   each badge means for posting. The chart keeps its fiscal-year label. */
test('the ledger names the month plainly and says what its status means', async ({ page }) => {
  await page.goto('/general-ledger', { waitUntil: 'networkidle' })
  const picker = page.getByRole('button', { name: 'Change accounting period' })
  await expect(picker).toHaveText(/^[A-Z][a-z]{2} \d{4}$/)
  const badge = page.getByText('Active accounting period', { exact: true })
  await badge.hover()
  await expect(page.getByText('Entries can be posted to this period.', { exact: true })).toBeVisible()
  await page.mouse.move(0, 0)

  // A month that has ended is locked.
  await picker.click()
  const panel = page.locator('body > div').filter({ hasText: 'Fiscal year' }).last()
  await panel.getByText('Month', { exact: true }).click()
  await panel.locator('button', { hasText: /^Aug/ }).first().click()
  await expect(picker).toHaveText(/^Aug \d{4}$/)
  await page.getByText('Locked', { exact: true }).first().hover()
  await expect(page.getByText('This period is closed. No new entries can be posted.', { exact: true })).toBeVisible()
  await page.mouse.move(0, 0)

  // A date typed in by hand.
  await page.getByRole('button', { name: 'Period from' }).click()
  await page.getByRole('button', { name: '10', exact: true }).first().click()
  await expect(picker).toHaveText('Custom range')

  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await expect(page.getByRole('button', { name: 'Change accounting period' })).toHaveText(/FY\d{4}/)
})
