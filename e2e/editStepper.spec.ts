import { test, expect, type Page } from '@playwright/test'

/* Which step tabs a reader can press. Mahad, 2026-09-24, on an edit whose
   "2 Review changes" tab was greyed out until Continue had been pressed:
   *"Only while editing an account, please make sure that the modal steppers are
   clickable at all times."*

   The create keeps its walk. A step ahead of the current one is closed there
   because it has nothing to show yet - previewing an account before it has been
   named previews nothing. An edit has no such state: every field opens holding
   the saved account's value, and the review step has something to diff from the
   first moment.

   In a browser because the tabs are a header the form draws either way; what
   changed is whether pressing one moves. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()

test('an edit opens with every step already open', async ({ page }) => {
  await page.goto('/chart-of-accounts/acct_11400', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Edit account/i }).first().click()
  const m = modal(page)

  // Forward, without having pressed Continue.
  await m.getByRole('button', { name: /Review changes/ }).click()
  await expect(m.getByRole('heading', { name: 'Review changes' })).toBeVisible()

  // And back again, which is the half that already worked.
  await m.getByRole('button', { name: /Details/ }).first().click()
  await expect(m.getByText('GL account details').first()).toBeVisible()
})

test('a create still walks its steps in order', async ({ page }) => {
  /* The contrast that says the rule is about editing rather than about
     steppers. Were this to go the same way, Preview would open on an account
     with no name, no number and no parent. */
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Create GL account/ }).click()
  const m = modal(page)
  await m.getByText('Classification').first().waitFor()

  for (const label of ['Details', 'Dimensions', 'Preview']) {
    await expect(m.getByRole('button', { name: new RegExp(label) }).first()).toBeDisabled()
  }
})

/* Once reached, a create's steps stay open - forward as well as back. Mahad,
   2026-10-01: *"if I fill in all my details in the 'Create a GL Account' modal
   ... move on to the 'Dimensions' step. Now, if I go back to 'Details', and then
   want to move forward again ... why can't I click on the steps at the top to
   navigate? ... only after those steps have been completed/filled out."* Forward
   passes the same checks Continue makes, so a step changed since and no longer
   complete stops the walk on itself. */
const field = (m: ReturnType<typeof modal>, label: string) =>
  m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)
const tab = (m: ReturnType<typeof modal>, label: string) => m.getByRole('button', { name: new RegExp(label) }).first()

async function filledCreate(page: Page) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Create GL account/ }).click()
  const m = modal(page)
  await m.getByRole('button', { name: /Continue/ }).first().click()
  await m.getByText('GL account details').first().waitFor()
  await field(m, 'GL account type').locator('button[aria-haspopup="listbox"]').click()
  await page.getByRole('option', { name: 'Posting', exact: true }).click()
  // Under 11100, whose block 11135 sits in.
  await field(m, 'Parent').locator('button[aria-haspopup="listbox"]').first().click()
  await page.getByRole('option', { name: /11100/ }).first().click()
  await field(m, 'GL account no.').locator('input').fill('11135')
  await field(m, 'GL account name').locator('input').fill('Stepper probe account')
  // Walk to the end with Continue.
  for (let i = 0; i < 4 && !(await m.getByText('Placement preview').first().isVisible()); i++) {
    await m.getByRole('button', { name: /^Continue$/ }).first().click()
  }
  await expect(m.getByText('Placement preview').first()).toBeVisible()
  return m
}

test('a create keeps the steps it reached open, forward as well as back', async ({ page }) => {
  const m = await filledCreate(page)
  await tab(m, 'Details').click()
  await expect(m.getByText('GL account details').first()).toBeVisible()
  // Forward from the tabs, with nothing pressed in the footer.
  await expect(tab(m, 'Preview')).toBeEnabled()
  await tab(m, 'Preview').click()
  await expect(m.getByText('Placement preview').first()).toBeVisible()
  await tab(m, 'Details').click()
  await tab(m, 'Dimensions').click()
  await expect(m.getByText('Placement preview')).toHaveCount(0)
  await expect(m.getByText('GL account details')).toHaveCount(0)
})

test('a step changed since and no longer complete stops a forward jump on itself', async ({ page }) => {
  const m = await filledCreate(page)
  await tab(m, 'Details').click()
  await field(m, 'GL account name').locator('input').fill('')
  await tab(m, 'Preview').click()
  // Still on Details, saying why, as Continue would.
  await expect(m.getByText('GL account details').first()).toBeVisible()
  await expect(m.getByText('Placement preview')).toHaveCount(0)
  await expect(field(m, 'GL account name')).toContainText(/required|Enter/i)
})
