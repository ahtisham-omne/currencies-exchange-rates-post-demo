import { test, expect } from '@playwright/test'
import { settle, view } from './glPage'

/* The ledger opens closed. Mahad, 2026-09-11: *"By default, all entries in the
   General Ledger must be in a collapsed state. While the data might look minimal
   in our examples, a single account can easily have 500 to 1,000 transactions in
   a single day. Because of this high volume, everything must start collapsed to
   avoid overwhelming the user."*

   The page used to seed one account branch open on arrival, on the argument that
   the seeded chart is small enough to make a closed page look empty. That reads
   the demo data rather than the volume the page is built for.

   Read against the running page, because the state a reader arrives in is not a
   claim source text can make: the expansion default was already 'collapsed' and
   the page still opened a branch. */

test.describe('the ledger opens collapsed', () => {
  test('no account branch is open on arrival', async ({ page }) => {
    await settle(page, '/general-ledger')
    await view(page, 'General ledger').click()
    await expect(page.getByRole('button', { name: 'Expand', exact: true }).first()).toBeVisible()
    // Every disclosure reads Expand, so not one of them is open.
    await expect(page.getByRole('button', { name: 'Collapse', exact: true })).toHaveCount(0)
  })

  /* One journal entry opens on arrival, and only one. Design review, 2026-09-28 -
     Mahreen: *"whenever you open it, the default will open one line so that the
     user can see that, but the rest will be standard collapse."* The General
     ledger tab above still opens with nothing open. */
  test('only the first journal entry is open on arrival', async ({ page }) => {
    await settle(page, '/general-ledger')
    await view(page, 'Journal entries').click()
    await expect(page.getByRole('button', { name: 'Collapse entry' })).toHaveCount(1)
    await expect(page.locator('tr.gl-je-parent').first().getByRole('button', { name: 'Collapse entry' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Expand entry' }).first()).toBeVisible()
  })

  /* The reader can still open one, and closing it sticks. This is the half the
     seeding broke: a seeded branch reopened on every remount, so collapsing it
     did not hold. */
  test('opens and closes a branch on demand', async ({ page }) => {
    await settle(page, '/general-ledger')
    await view(page, 'General ledger').click()
    await page.getByRole('button', { name: 'Expand', exact: true }).first().click()
    await expect(page.getByRole('button', { name: 'Collapse', exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Collapse', exact: true }).first().click()
    await expect(page.getByRole('button', { name: 'Collapse', exact: true })).toHaveCount(0)
  })

  /* The scope menu is the way to open the whole ledger deliberately, and it has
     to keep working - "everything starts collapsed" is a default, not a ban. */
  test('still opens and closes everything from the scope menu', async ({ page }) => {
    await settle(page, '/general-ledger')
    await view(page, 'General ledger').click()
    const scope = () => page.getByRole('button', { name: /^(Expand|Collapse) all$/ }).first()
    // The options carry their own descriptions, which is what tells them apart
    // from the trigger button naming the current mode.
    await scope().click()
    await page.getByText('Show the postings under every account').click()
    await expect(page.getByRole('button', { name: 'Collapse', exact: true }).first()).toBeVisible()
    await scope().click()
    await page.getByText('Show account lines only').click()
    await expect(page.getByRole('button', { name: 'Collapse', exact: true })).toHaveCount(0)
  })
})
