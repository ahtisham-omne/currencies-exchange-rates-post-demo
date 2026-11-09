import { test, expect, type Page, type Locator } from '@playwright/test'

/* The account role field, as the design review of 2026-09-24 left it: a
   dropdown rather than a row of pills (Eli: *"It's not going to be a pill. It's
   going to want to be a drop-down."*), each option carrying its one line.

   Nothing explains a role beyond that line. Mahad, 2026-09-21: *"Remove hover
   from account roles"* took the per-role card off the pills, the dropdown and
   the detail rail; the flow panel that used to open under the field once a role
   was picked went on 2026-09-29, the same way and for the same reason.

   Pinned in a browser because the claims are about what a pointer and a pick make
   happen. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()
const field = (m: Locator, label: string) =>
  m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)

// An Asset posting account, where the picker offers the most roles.
async function roleField(page: Page) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Create GL account/ }).first().click()
  const m = modal(page)
  await m.getByText('What kind of account is this?').first().waitFor()
  await m.getByRole('button', { name: /Asset/ }).first().click()
  await m.getByRole('button', { name: /Continue/ }).first().click()
  await m.getByText('GL account details').first().waitFor()
  // A role is a posting account's identity, so the field only appears once the
  // account is one.
  await field(m, 'GL account type').locator('button[aria-haspopup="listbox"]').first().click()
  await page.getByRole('option', { name: 'Posting', exact: true }).first().click()
  const f = field(m, 'Account role')
  await f.locator('button[aria-haspopup="listbox"]').first().waitFor()
  return { m, f }
}

async function pick(page: Page, f: Locator, role: string) {
  await f.locator('button[aria-haspopup="listbox"]').first().click()
  await page.getByRole('option', { name: new RegExp(`^${role} `) }).click()
}

test('is a dropdown, not a row of pills', async ({ page }) => {
  const { f } = await roleField(page)
  await expect(f.locator('button[aria-pressed]')).toHaveCount(0)
  await expect(f.locator('button[aria-haspopup="listbox"]')).toHaveCount(1)
})

test('lists each role with what it does under its name', async ({ page }) => {
  const { f } = await roleField(page)
  await f.locator('button[aria-haspopup="listbox"]').first().click()
  const options = page.getByRole('option')
  expect(await options.count()).toBeGreaterThan(4)
  await expect(page.getByRole('option', { name: /^Accounts Receivable/ })).toContainText('Tracks amounts owed by customers.')
  await expect(page.getByRole('option', { name: /^No role/ })).toBeVisible()
})

test('finds a role by what it does, not only by its name', async ({ page }) => {
  const { f } = await roleField(page)
  await f.locator('button[aria-haspopup="listbox"]').first().click()
  await page.getByPlaceholder('Search roles…').fill('customers')
  await expect(page.getByRole('option', { name: /^Accounts Receivable/ })).toBeVisible()
  await expect(page.getByRole('option', { name: /^Inventory/ })).toHaveCount(0)
})

test('opens nothing when the pointer runs along the options', async ({ page }) => {
  const { f } = await roleField(page)
  await f.locator('button[aria-haspopup="listbox"]').first().click()
  for (const option of (await page.getByRole('option').all()).slice(0, 5)) {
    await option.hover()
    // Longer than the hover delay, so a card that was merely slow still counts.
    await page.waitForTimeout(800)
    // `w-max` is the rich card's own shape, which the modal behind it does not
    // share - matching every `body > div.fixed` would match the form itself.
    const open = await page.locator('body > div.fixed.w-max, body > span.fixed').allInnerTexts()
    expect(open, `a hint opened over "${(await option.innerText()).trim()}"`).toEqual([])
  }
})

/* Mahad, 2026-09-29, on the panel opening under the field on an edit: *"Please
   remove this ... for all detail pages in the entire COA module and general
   ledger."* Picking a role now changes the field and nothing else. */
test('opens no explanation of its own when a role is picked', async ({ page }) => {
  const { m, f } = await roleField(page)
  await pick(page, f, 'Accounts Receivable')
  await expect(m.locator('[data-role-guide]')).toHaveCount(0)
  await expect(m.getByText(/How the .* role works/)).toHaveCount(0)
  await expect(m.getByText('What happens next')).toHaveCount(0)
  // Bank unlocks a step, so it is the role most likely to grow a panel back.
  await pick(page, f, 'Bank')
  await expect(m.locator('[data-role-guide]')).toHaveCount(0)
  await expect(m.getByText(/How the .* role works/)).toHaveCount(0)
})

/* The field label keeps its own hint, which answers the different question of
   what a role is for at all. */
test('still explains on the field label what a role is for', async ({ page }) => {
  const { f } = await roleField(page)
  await f.locator('span.cursor-help').first().hover()
  const card = page.locator('body > div.fixed.w-max').filter({ hasText: 'A role tells the system what job this account does' })
  await expect(card).toBeVisible()
  await expect(card).toContainText('Some roles are control accounts')
})
