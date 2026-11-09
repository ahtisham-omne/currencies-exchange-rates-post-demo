import { test, expect, type Page, type Locator } from '@playwright/test'

/* Retest, 2026-10-09 (archive transition): after archiving a fresh 12170, Add
   dimension still saved Department = Design; a reload kept the tag and then
   refused the same edit. An archived account is read-only the moment it is
   archived, and editable again the moment it is unarchived, before and after a
   reload. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()
const field = (m: Locator, label: string) => m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)
const picker = (f: Locator) => f.locator('button[aria-haspopup="listbox"]')
const addDimension = (page: Page) => page.getByRole('button', { name: 'Add dimension' })
const readOnlyNote = (page: Page) => page.locator('[data-dimensions-read-only]')

async function createFresh(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Create GL account/ }).click()
  const m = modal(page)
  await m.getByRole('button', { name: /Continue/ }).first().click()
  await m.getByText('GL account details').first().waitFor()
  await picker(field(m, 'GL account type')).click()
  await page.getByRole('option', { name: 'Posting', exact: true }).click()
  await picker(field(m, 'Parent')).click()
  await page.getByRole('option').filter({ hasText: '12100' }).first().click()
  await field(m, 'GL account name').locator('input').fill('Archive guard probe')
  await field(m, 'GL account no.').locator('input').fill('12170')
  const create = m.getByRole('button', { name: 'Create account' })
  for (let i = 0; i < 4 && !(await create.count()); i++) await m.getByRole('button', { name: /Continue/ }).first().click()
  await create.first().click()
  await page.waitForURL(u => /^\/chart-of-accounts\/.+/.test(u.pathname))
  await page.getByRole('button', { name: 'Activity', exact: true }).first().waitFor()
}

async function archive(page: Page) {
  const d = page.locator('body > div.fixed').filter({ hasText: /Archive account\?|Archive 12170/ }).last()
  // Retried: the page is still settling from the save when the menu is first asked for.
  await expect(async () => {
    await page.getByRole('button', { name: 'Account actions' }).click()
    await page.getByRole('button', { name: /^Archive/ }).first().click({ timeout: 2000 })
    await expect(d).toBeVisible({ timeout: 2000 })
  }).toPass({ timeout: 20000 })
  await d.getByRole('button', { name: /^(Archive account|Move and archive)$/ }).first().click()
  await expect(d).toHaveCount(0)
}

async function unarchive(page: Page) {
  await page.getByRole('button', { name: 'Account actions' }).click()
  await page.getByRole('button', { name: 'Unarchive account' }).click()
  await page.locator('body > div.fixed').filter({ hasText: 'Unarchive account?' }).last()
    .getByRole('button', { name: 'Unarchive account' }).click()
}

// The store writes to IndexedDB a moment after the change; wait for it before a reload.
const settleStore = (page: Page) => page.waitForTimeout(800)

test('archiving locks the dimensions at once and after a reload, and unarchiving unlocks them the same way', async ({ page }) => {
  await createFresh(page)
  await expect(addDimension(page)).toBeVisible()

  await archive(page)
  // At once, without a reload.
  await expect(addDimension(page)).toHaveCount(0)
  await expect(readOnlyNote(page)).toHaveText('Archived accounts can’t be changed. Unarchive it to edit it.')
  await expect(page.getByRole('button', { name: 'Edit Account' })).toHaveCount(0)

  await settleStore(page)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Activity', exact: true }).first().waitFor()
  await expect(addDimension(page)).toHaveCount(0)
  await expect(readOnlyNote(page)).toBeVisible()

  await unarchive(page)
  // At once again.
  await expect(addDimension(page)).toBeVisible()
  await expect(readOnlyNote(page)).toHaveCount(0)

  await settleStore(page)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Activity', exact: true }).first().waitFor()
  await expect(addDimension(page)).toBeVisible()
})

test('an account archived before the page opened offers no dimension edit either', async ({ page }) => {
  await page.goto('/chart-of-accounts/acct_arch_petty', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Activity', exact: true }).first().waitFor()
  await expect(addDimension(page)).toHaveCount(0)
  await expect(readOnlyNote(page)).toBeVisible()
})
