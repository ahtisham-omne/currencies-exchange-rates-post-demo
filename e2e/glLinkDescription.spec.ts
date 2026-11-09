import { test, expect, type Page } from '@playwright/test'
import { settle, view } from './glPage'

/* The reference column is "Linked document" on both tabs.

   It read "Link Description" on the General ledger tab from 2026-09-21 (Mahad:
   *"Change to Link Description but only in the general ledger listing page"*).
   The design review of 2026-09-24 read that as a slip for the document it opens
   - Nophil: *"It's not link description. It's link document."* - and it is what
   the Journal entries tab and the entry detail page already call it.

   Pinned in a browser because the two tabs are one column set, and the old
   failure was a name that answered on one tab and not the other. */

const header = (page: Page, name: string) =>
  page.locator('thead th').filter({ hasText: name })

test.describe('the reference column', () => {
  for (const tab of ['General ledger', 'Journal entries'] as const) {
    test(`reads Linked document on the ${tab} tab`, async ({ page }) => {
      await settle(page, '/general-ledger')
      await view(page, tab).click()
      await expect(header(page, 'Linked document')).toHaveCount(1)
      await expect(header(page, 'Link Description')).toHaveCount(0)
    })
  }

  test('carries the same name into the Columns drawer', async ({ page }) => {
    await settle(page, '/general-ledger')
    await view(page, 'General ledger').click()
    await page.getByRole('button', { name: /Columns/ }).first().click()
    await expect(page.locator('[data-col-key="reference"]')).toContainText('Linked document')
    await expect(page.getByText('Link Description')).toHaveCount(0)
  })

  /* The cell underneath is untouched - the same document link, opening the same
     way. A rename that took the links with it would pass every header assertion
     above. */
  test('leaves the links themselves alone', async ({ page }) => {
    await settle(page, '/general-ledger')
    await view(page, 'Journal entries').click()
    await expect(page.locator('button[title*="new tab"]').first()).toBeVisible()
  })
})
