import { test, expect, type Page, type Locator } from '@playwright/test'

/* Editing a summary account.

   It used to open a modal of its own - three live fields over a read-only list
   of facts, under the headings "What you can change" and "Set by the chart".
   Mahad, 2026-09-22, having seen it: *"replace the cramped/weird UI with the
   spacious GL Account Details view framework"*, *"remove confusing helper text
   (such as 'what you can change' or 'set by the chart')"*, and lock by state
   rather than by kind - *"in-use: structural parameters locked ... unused: all
   fields fully editable."* So a summary now walks the same form a posting
   account does, and `editFieldParity.spec.ts` pins that the two ask alike.

   What is pinned here is the flow: that Continue reaches a review naming both
   sides of each change, and that Save writes them. A review that reported the
   right changes and saved the wrong ones would read, on the way through,
   exactly like a working one. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()

// Nothing on the step ties a control to its label by `for`, so a field is found
// through the label's block. The range's two boxes carry aria-labels of their own.
const field = (m: Locator, label: string) =>
  m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)

async function openEdit(page: Page, id: string) {
  await page.goto(`/chart-of-accounts/${id}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Edit Account/ }).first().click()
  const m = modal(page)
  await m.getByText('GL account details').first().waitFor()
  return m
}

test('Continue names both sides of every change, and Save applies them', async ({ page }) => {
  const m = await openEdit(page, 'acct_11200')

  await field(m, 'GL account name').locator('input').fill('Short-term investments & deposits')
  await m.getByLabel('Range end').fill('11265')
  await field(m, 'Description').locator('textarea').fill('Everything parked for under a year.')
  await m.getByRole('button', { name: /Continue/ }).click()

  // The row for each change carries what it is now as well as what it becomes:
  // a review that only showed the new value would not be a review of a change.
  const row = (label: string) => m.locator('tr', { hasText: label })
  await expect(row('GL account name')).toContainText('Short-Term Investments')
  await expect(row('GL account name')).toContainText('Short-term investments & deposits')
  await expect(row('Number range')).toContainText('11200–11299')
  await expect(row('Number range')).toContainText('11200–11265')
  await expect(row('Description')).toContainText('Everything parked for under a year.')

  await m.getByRole('button', { name: 'Save changes' }).click()
  await expect(modal(page)).toHaveCount(0)

  // On the page behind it, which is the only proof the write landed.
  await expect(page.getByRole('heading', { name: 'Short-term investments & deposits' }).first()).toBeVisible()
  await expect(page.getByText('11200–11265').first()).toBeVisible()
})

/* Nothing typed is nothing to save. The step says so rather than showing an
   empty table, and Save is not offered for a write with no content. Since
   2026-09-24 the words are an empty state's title - see `emptyStates.spec.ts`. */
test('says so when nothing has changed, and offers no Save', async ({ page }) => {
  const m = await openEdit(page, 'acct_11200')
  await m.getByRole('button', { name: /Continue/ }).click()
  await expect(m.getByText('No changes to review')).toBeVisible()
  await expect(m.getByRole('button', { name: 'Save changes' })).toBeDisabled()
})

/* A range that collides is refused where it is typed, and the reader never
   reaches a review of a change that cannot be saved. */
test('holds a colliding range on the step that asked for it', async ({ page }) => {
  const m = await openEdit(page, 'acct_11200')
  // Reaching into Accounts Receivable, whose own number is the first thing in the way.
  await m.getByLabel('Range end').fill('11379')
  await expect(m.getByText(/already uses a number in this range/)).toBeVisible()
  await m.getByRole('button', { name: /Continue/ }).click()
  await expect(m.getByText('GL account details')).toBeVisible()
})

/* The five category rows come through the same door - they are the most fixed
   accounts on the chart, so every structural field on the form answers instead
   of asking, including the parent they do not have. */
test('opens the same form on a category row', async ({ page }) => {
  const m = await openEdit(page, 'acct_10000')
  await expect(m.getByText('Edit GL account')).toBeVisible()
  await expect(m.locator('div.input', { hasText: /^None$/ })).toBeVisible()
  await field(m, 'GL account name').locator('input').fill('Assets')
  await m.getByRole('button', { name: /Continue/ }).click()
  await m.getByRole('button', { name: 'Save changes' }).click()
  await expect(modal(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Assets' }).first()).toBeVisible()
})

/* And the way in from the listing is the same form, reached by the same row
   menu item as any other account. */
test('opens from the listing row menu too', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  await page.locator('tbody tr', { hasText: 'Short-Term Investments' }).first()
    .locator('td').last().locator('button').last().click()
  await page.getByText('Edit account', { exact: true }).click()
  await expect(modal(page).getByText('GL account details')).toBeVisible()
})

/* The item that creates one. Mahad: *"the option currently says 'Add Sub
   Account'. Please change this microcopy to 'Create General Ledger (GL)
   Account'."* Sentence case, matching the button at the top of the listing. */
test('names the child it creates the way the page header does', async ({ page }) => {
  await page.goto('/chart-of-accounts/acct_11200', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Account actions' }).click()
  const menu = page.locator('body > div.fixed').last()
  await expect(menu.getByText('Create GL account', { exact: true })).toBeVisible()
  await expect(menu.getByText(/sub-account/i)).toHaveCount(0)
})
