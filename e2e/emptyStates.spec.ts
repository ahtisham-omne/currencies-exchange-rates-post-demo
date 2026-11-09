import { test, expect, type Page } from '@playwright/test'

/* Mahad, 2026-09-24, on the edit form's "Review changes" step showing a plain
   bordered line reading "Nothing has changed, so there is nothing to save.":
   *"I think if there is nothing to show, we do have UI patterns for emplty
   state in partners module. Please look it up here and implement them."*

   Partners builds an empty state from four parts - an icon tile, a title naming
   what is absent, a line saying why, and where there is one, the thing to do
   about it - and varies only the container: a dashed frame where it stands in
   open space, none where a card already draws the border. That is now what
   `EmptyState` in `ui.tsx` is, and every hand-rolled copy in the module was
   folded into it.

   In a browser because the look is not a value the form holds, and because the
   part worth pinning is the part that moves: the title and the button are new
   markup, and the button goes somewhere. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()

test('an edit with nothing changed names the absence and offers the way back', async ({ page }) => {
  await page.goto('/chart-of-accounts/acct_11400', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Edit account/i }).first().click()
  const m = modal(page)
  await m.getByRole('button', { name: /Review changes/ }).click()

  // A title naming what is absent, rather than a sentence about emptiness.
  await expect(m.getByText('No changes to review')).toBeVisible()
  await expect(m.getByText('Nothing has changed, so there is nothing to save.')).toHaveCount(0)

  /* And the one thing to do about it, which is to go and change something -
     one thing, so the footer's Back stands down while it is offered. Mahad,
     2026-09-24: *"there are two back buttons here, I think when the empty state
     occurs, the 'Back to details' should be the only button to go back."* */
  await expect(m.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0)
  await m.getByRole('button', { name: 'Back to details' }).click()
  await expect(m.getByText('GL account details').first()).toBeVisible()
})

test('the offer goes once there is a change to review', async ({ page }) => {
  // The empty state is the empty branch only: a real diff must still show.
  await page.goto('/chart-of-accounts/acct_11400', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Edit account/i }).first().click()
  const m = modal(page)
  await m.locator('xpath=.//label[starts-with(normalize-space(.), "GL account name")]/..')
    .locator('input').fill('Inventory, renamed')

  await m.getByRole('button', { name: /Review changes/ }).click()
  await expect(m.getByText('No changes to review')).toHaveCount(0)
  await expect(m.getByText('Inventory, renamed').first()).toBeVisible()
  // And the footer's Back returns, now that nothing else offers the way out.
  await expect(m.getByRole('button', { name: 'Back', exact: true })).toBeVisible()
})

test('a search matching nothing states it the same way', async ({ page }) => {
  /* The same four parts on a listing, unframed because the table's card already
     draws the border. Here to catch the shared component breaking one caller
     while another still reads fine. */
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByPlaceholder('Search accounts').fill('zzzznothing')
  await expect(page.getByText('No accounts match "zzzznothing"')).toBeVisible()
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(page.getByText('No accounts match "zzzznothing"')).toHaveCount(0)
})

test('a journal entry that does not exist says so and points back', async ({ page }) => {
  await page.goto('/general-ledger/entry/JE-NOPE-0000', { waitUntil: 'networkidle' })
  await expect(page.getByText('Journal entry not found')).toBeVisible()
  await page.getByRole('button', { name: /Back to General Ledger/ }).click()
  await expect(page).toHaveURL(/\/general-ledger$/)
})
