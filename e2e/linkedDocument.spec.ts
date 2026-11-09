import { test, expect, type Page } from '@playwright/test'
import { settle, view } from './glPage'

/* A linked document leaves the app. Mahad, 2026-09-11: *"Any 'Linked Document'
   we display must always open in a separate location (e.g., a new tab or page).
   For instance, if it is a customer invoice, it should not be embedded directly
   at the bottom of the details page… the main idea we need to convey is that
   clicking a linked document takes the user directly to the actual source
   document where the transaction took place."*

   It used to open a quick view: what the ledger knew about the document, in a
   panel over the register. That answered "is this the invoice I meant?" and
   stopped one step short of the invoice.

   Read in a browser because the claim is about a second tab, which only a
   browser has, and because the toast the quick view offered instead would have
   satisfied any assertion that merely said the click did something. */

/* Served locally so the assertion is about the URL the app asked for, not about
   a third-party app being up. Fulfilled rather than aborted: an aborted
   navigation leaves the tab on chrome-error://chromewebdata and the target URL
   is lost, which is the one thing being read here. */
const stubExternal = (page: Page) =>
  page.context().route('https://*.lovable.app/**', r =>
    r.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }))

/* Read on Journal entries, whose parent rows carry the reference. The General
   ledger tab shows only account lines until one is opened - see
   glCollapsed.spec.ts. */
const firstDoc = async (page: Page) => {
  await settle(page, '/general-ledger')
  await view(page, 'Journal entries').click()
  return page.locator('button[title^="Open "][title*="new tab"]').first()
}

test.describe('a linked document opens where it lives', () => {
  test('leaves the app in a new tab, on the document itself', async ({ page }) => {
    await stubExternal(page)
    const link = await firstDoc(page)
    const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()])
    // A document, not the module's front door - the path names one. Which
    // document is pinned in sourceDocumentLink.test.ts; there is one for the
    // whole module now, because it is the only one that really exists.
    expect(popup.url()).toBe('https://vendor-invoicing-payments.lovable.app/invoices/INV-2024-1011')
    // And the ledger is still where the reader left it.
    await expect(page).toHaveURL(/\/general-ledger/)
  })

  test('opens from the entry page rail too', async ({ page }) => {
    await stubExternal(page)
    await settle(page, '/general-ledger')
    await view(page, 'Journal entries').click()
    // An entry that has a document behind it, reached from its own number.
    const row = page.locator('tr', { has: page.locator('button[title*="new tab"]') }).first()
    await row.locator('button[title="Open journal entry"]').click()
    await page.getByText('Linked document').first().waitFor()
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.locator('button[title*="new tab"]').first().click(),
    ])
    expect(popup.url()).toContain('lovable.app')
  })

  /* The preview it replaced. A panel opening alongside the tab would satisfy
     every assertion above, so the absence is pinned beside the presence. */
  test('shows no in-app preview of the document', async ({ page }) => {
    await stubExternal(page)
    const link = await firstDoc(page)
    await Promise.all([page.waitForEvent('popup'), link.click()])
    // The quick view's own chrome, named rather than asserted by role - it was a
    // QuickViewModal, which carries no dialog role, so getByRole('dialog') would
    // pass whether the preview was there or not.
    await expect(page.getByRole('button', { name: 'Open document' })).toHaveCount(0)
    await expect(page.getByText('Document details')).toHaveCount(0)
  })
})
