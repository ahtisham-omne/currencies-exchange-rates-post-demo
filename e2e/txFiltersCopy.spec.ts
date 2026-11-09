import { test, expect } from '@playwright/test'

/* Mahad's copy for the Filters panel on a posting account's Transactions tab,
   2026-10-12. */
test('the Transactions tab filters read in Mahad\'s copy', async ({ page }) => {
  await page.goto('/chart-of-accounts/acct_11110', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Transactions/ }).first().click()
  await page.getByRole('button', { name: /^Filters/ }).first().click()
  const panel = page.locator('body > div.fixed').filter({ hasText: 'Clear all' }).last()
  for (const text of [
    'Accounting period', 'Show only transactions posted to this period.', 'All periods',
    'Amount range', 'Matches debits and credits alike, so $1,000 finds either one.',
    'Posting date', 'Filters within the toolbar date range. Leave a date blank for no limit.',
    'Clear all',
  ]) await expect(panel.getByText(text, { exact: true }).first()).toBeVisible()
  const minMax = panel.locator('input[type="number"]')
  await expect(minMax.nth(0)).toHaveAttribute('placeholder', 'Any')
  await expect(minMax.nth(1)).toHaveAttribute('placeholder', 'Any')
  await expect(panel.getByRole('button', { name: /^Show [\d,]+ transactions?$/ })).toBeVisible()
  await panel.screenshot({ path: '/private/tmp/claude-501/-Users-mahad-Documents-Chart-of-Accounts-chart-of-accounts-v2-1/2c6fbcd7-160c-43c6-ac48-a99e1668ca44/scratchpad/txfilters.png' })
})
