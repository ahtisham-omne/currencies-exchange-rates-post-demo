import { test, expect, type Page, type Locator } from '@playwright/test'

/* Restricted accounts, COA discussion of 2026-10-06: a flag on the account,
   set on Create GL account, shown on the chart and on the account's page, with
   what it means. Who may see one is a permission, not built here. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()
const field = (m: Locator, label: string) => m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)
const picker = (f: Locator) => f.locator('button[aria-haspopup="listbox"]')

test('a restricted account is marked so on the chart and on its page', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  await expect(page.locator('thead th', { hasText: 'Restricted' })).toHaveCount(1)

  await page.getByRole('button', { name: /Create GL account/ }).click()
  const m = modal(page)
  await m.getByText('What kind of account is this?').first().waitFor()
  await m.getByRole('button', { name: /Continue/ }).first().click()
  await m.getByText('GL account details').first().waitFor()
  await picker(field(m, 'GL account type')).click()
  await page.getByRole('option', { name: 'Posting', exact: true }).click()
  // The form no longer picks a parent (Mahad, 2026-10-08).
  await field(m, 'Parent').locator('button[aria-haspopup="listbox"]').first().click()
  // Asset itself: 19010 is outside Current Assets' block.
  await page.getByRole('option', { name: /10000/ }).first().click()
  await field(m, 'GL account name').locator('input').fill('Owner Loans')
  await field(m, 'GL account no.').locator('input').fill('19010')

  const toggle = m.locator('[data-restricted-toggle]')
  await expect(toggle).toContainText('Restricted account')
  await toggle.locator('[data-toggle-info]').hover()
  await expect(page.getByText(/Only people you give access to can see this account/)).toBeVisible()
  await toggle.getByRole('switch').click()

  const create = m.getByRole('button', { name: 'Create account' })
  for (let i = 0; i < 4 && !(await create.count()); i++) await m.getByRole('button', { name: /Continue/ }).first().click()
  await expect(m.getByText('Restricted', { exact: true })).toBeVisible()
  await create.first().click()
  await expect(modal(page)).toHaveCount(0)

  // Saving opens the account: its page says so.
  await page.waitForURL(u => /^\/chart-of-accounts\/.+/.test(u.pathname))
  await expect(page.locator('[data-restricted-field]').first()).toContainText('Yes')

  // And the chart, reached in the app while the account is still being stored.
  await page.locator('a[href="/chart-of-accounts"]').first().dispatchEvent('click')
  await page.waitForSelector('thead th')
  await page.getByRole('button', { name: 'Expand all' }).click()
  const header = await page.locator('thead th').allInnerTexts()
  const col = header.findIndex(t => t.trim().startsWith('Restricted'))
  const made = page.locator('tbody tr[data-tree-account]').filter({ hasText: 'Owner Loans' }).first()
  await expect(made.locator('td').nth(col)).toHaveText('Yes')
  const other = page.locator('tbody tr[data-tree-account]').filter({ hasText: 'Petty Cash' }).first()
  await expect(other.locator('td').nth(col)).toHaveText('No')
})
