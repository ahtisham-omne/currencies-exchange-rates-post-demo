import { test, expect, type Page } from '@playwright/test'
import { settle, view } from './glPage'

/* What raised a posting, named as the business document it came from. Mahad,
   2026-09-21: *"For the Source column in general ledger, can you populate these
   inside as demo data?: Vendor Invoice, Vendor Payments, Customer Invoice,
   Customer payments, Cash Management, RMA, Receiving"*

   Read against the running page, because the seed being right is not the claim.
   The whole unit suite was green while every row on screen read "Source
   Document": `sourceDocLabel` answers an unknown key with that fallback, and a
   returning reader's saved chart still held the retired keys (AP Bill, AR
   Invoice…). Only a browser holding a saved chart can see that. */

const SOURCES = [
  'Vendor Invoice', 'Vendor Payments', 'Customer Invoice', 'Customer Payments',
  'Cash Management', 'RMA', 'Receiving',
]

async function sourceCells(page: Page) {
  await settle(page, '/general-ledger')
  await view(page, 'General ledger').click()
  await page.getByRole('button', { name: /^(Expand|Collapse) all$/ }).first().click()
  await page.getByText('Show the postings under every account').click()
  await page.getByRole('button', { name: 'Collapse', exact: true }).first().waitFor()
  /* Expand all draws a group's postings as it comes near the viewport, so the
     table is scrolled to the bottom first and every group gets its turn. */
  for (let i = 0; i < 80; i++) {
    if (await page.locator('tr[data-gl-spacer]').count() === 0) break
    await page.locator('table').first().evaluate(t => {
      const sp = t.closest('.overflow-auto') as HTMLElement | null
      if (sp) sp.scrollTop += 1500
    })
    await page.waitForTimeout(80)
  }
  const headers = await page.locator('table thead th').allInnerTexts()
  const idx = headers.findIndex(h => h.trim().toLowerCase().startsWith('source'))
  const cells = await page.locator(`table tbody tr td:nth-child(${idx + 1})`).allInnerTexts()
  // Account rows carry no source, so only the posting rows are the subject.
  return cells.map(c => c.trim()).filter(Boolean)
}

test('every requested source is on screen, and none reads as the fallback', async ({ page }) => {
  const seen = new Set(await sourceCells(page))
  for (const s of SOURCES) expect([...seen], s).toContain(s)
  // The fallback naming no document in particular is the shape this bug took.
  expect([...seen]).not.toContain('Source Document')
})

/* A reader who has opened the demo before arrives holding a saved chart written
   by the previous build. It names sources this build no longer knows, so it has
   to be dropped rather than read back - that is what the store's `version` is
   for, and forgetting to turn it is what put the fallback on screen. */
test('a chart saved by the previous build is dropped, not read back', async ({ page }) => {
  await page.goto('/general-ledger', { waitUntil: 'networkidle' })
  const planted = await page.evaluate(
    () =>
      new Promise<boolean>(resolve => {
        const req = indexedDB.open('omne-coa', 1)
        req.onupgradeneeded = () => req.result.createObjectStore('state')
        req.onsuccess = () => {
          const blob = JSON.stringify({
            version: 1,
            state: {
              transactions: [{
                id: 'stale_1', accountId: 'x', date: '2026-09-10', source: 'AP Bill',
                reference: 'INV-2026-1004', memo: 'planted stale posting',
                debit: 100, credit: 0, jeNumber: 'JE-2026-2001', entryType: 'Simple',
              }],
            },
          })
          const tx = req.result.transaction('state', 'readwrite')
          tx.objectStore('state').put(blob, 'coa-store')
          tx.oncomplete = () => resolve(true)
          tx.onerror = () => resolve(false)
        }
        req.onerror = () => resolve(false)
      }),
  )
  expect(planted).toBe(true)

  const seen = new Set(await sourceCells(page))
  expect([...seen]).not.toContain('Source Document')
  for (const s of SOURCES) expect([...seen], s).toContain(s)
})
