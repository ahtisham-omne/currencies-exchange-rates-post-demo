import { test, expect, type Page, type Locator } from '@playwright/test'

/* Mahad, 2026-10-08: turning on Restricted account puts the access list beside
   the switch, in the Notify picker's dialog. Design review the same day: it
   starts from the company default, the account owner is always on it, Manage is
   a button, and the switch explains itself in full. What is picked is kept on
   the account and named on its page. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()
const field = (m: Locator, label: string) => m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)

test('choose who has access to a restricted account, and see it on the account', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Create GL account/ }).click()
  const m = modal(page)
  await m.getByRole('button', { name: /Continue/ }).first().click()
  await m.getByText('GL account details').first().waitFor()
  await field(m, 'GL account type').locator('button[aria-haspopup="listbox"]').click()
  await page.getByRole('option', { name: 'Posting', exact: true }).click()
  await field(m, 'Parent').locator('button[aria-haspopup="listbox"]').first().click()
  await page.getByRole('option', { name: /11000/ }).first().click()
  await field(m, 'GL account name').locator('input').fill('Restricted test account')
  await m.getByRole('button', { name: '11010', exact: true }).click()

  // Off: nothing beside the switch.
  const summary = m.locator('[data-restricted-access]')
  await expect(summary).toHaveCount(0)
  const toggle = m.locator('[data-restricted-toggle]')
  // What restricted means, with an example, is in the (i)'s tooltip rather than
  // under the switch (Mahad, 2026-10-08); hovering it leaves the switch off.
  await expect(toggle).not.toContainText('Only people you give access to')
  await toggle.locator('[data-toggle-info]').hover()
  await expect(page.getByText('Only people you give access to can see this account, its balance, and its transactions. For example, your bookkeeper can work in the operating account without seeing the money market account that holds your reserves.')).toBeVisible()
  await toggle.locator('[data-toggle-info]').click()
  await expect(toggle.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  await toggle.getByText('Restricted account', { exact: true }).click()

  // On: the list starts from the company default, never from nobody.
  await expect(summary).toBeVisible()
  await expect(summary.locator('[data-access-source]')).toHaveText('Your company’s default access for restricted accounts.')
  // An avatar group with nothing tinted behind it: the owner grey and first,
  // then the default roles, and the Partners dashed Manage button beside it.
  const group = summary.locator('[data-avatar-group]')
  const avatars = group.locator('[data-avatar]')
  await expect(avatars).toHaveCount(3)
  await expect(avatars.first()).toHaveText('AO')
  expect(await avatars.first().evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(241, 245, 249)')
  expect(await group.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
  await expect(group.locator('[data-avatar-count]')).toHaveText(/^\d+ people$/)
  const manage = summary.locator('[data-picker-manage]')
  await expect(manage).toHaveText('Manage people')
  expect(await manage.evaluate(el => getComputedStyle(el).borderTopStyle)).toBe('dashed')

  await manage.click()
  const dialog = page.getByRole('dialog', { name: 'Who has access' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Select the roles or people who can see this account')).toBeVisible()
  // The account owner is always there, greyed out and locked.
  const owner = dialog.locator('[data-locked-pick]')
  await expect(owner).toContainText('Account owner')
  await expect(owner).toHaveAttribute('aria-disabled', 'true')
  // Taking Controller off makes the list this account's own.
  await dialog.getByRole('button', { name: /^Controller/ }).first().click()
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(summary.locator('[data-access-source]')).toContainText('Set for this account only.')
  await expect(summary.getByRole('button', { name: 'Use default' })).toBeVisible()

  // Through to creation.
  for (let i = 0; i < 4; i++) {
    const create = m.getByRole('button', { name: /^Create account/ })
    if (await create.count()) { await create.click(); break }
    await m.getByRole('button', { name: /Continue/ }).last().click()
  }
  await page.waitForURL(/chart-of-accounts\/acct_/, { timeout: 10000 }).catch(() => {})
  if (!/acct_/.test(page.url())) {
    await page.getByText('Restricted test account').first().click()
  }
  await expect(page.locator('[data-restricted-access-list]')).toHaveText('Open to Account owner, Accounting Manager')
})
