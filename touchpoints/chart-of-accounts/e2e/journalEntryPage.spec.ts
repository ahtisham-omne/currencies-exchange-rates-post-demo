import { test, expect, type Page } from '@playwright/test'
import { settle, view } from './glPage'

/* The journal entry page, and the retained earnings accounts' pages, as the
   design review of 2026-09-28 left them.

   - Notes and Activity join Attachments and Communication, the four tabs every
     record carries, in the account page's order.
   - Type explains all three kinds of entry, not only the one this entry is.
   - The system retained earnings account says where hand corrections go, and
     both halves open the retained earnings guide. */

async function openFirstEntry(page: Page) {
  await settle(page, '/general-ledger')
  await view(page, 'Journal entries').click()
  const row = page.locator('tr.gl-je-parent').first()
  await row.waitFor()
  const je = (await row.getByRole('button', { name: /^JE-/ }).innerText()).trim()
  await row.getByRole('button', { name: `Actions for ${je}` }).click()
  await page.getByRole('button', { name: 'Open entry' }).click()
  await page.waitForURL(/\/general-ledger\/entry\//)
  return je
}

const tab = (page: Page, name: RegExp) => page.getByRole('button', { name }).first()

test('carries Notes, Attachments, Communication and Activity, in that order', async ({ page }) => {
  await openFirstEntry(page)
  await tab(page, /^Activity/).waitFor()
  const labels = await page.getByRole('button').allInnerTexts()
  const at = (l: string) => labels.findIndex(t => t.trim().startsWith(l))
  expect(at('Notes')).toBeGreaterThan(at('Overview'))
  expect(at('Attachments')).toBeGreaterThan(at('Notes'))
  expect(at('Communications')).toBeGreaterThan(at('Attachments'))
  expect(at('Activity')).toBeGreaterThan(at('Communications'))
})

// Notes is built now (Mahad, 2026-10-06); see notesTab.spec.ts.
test('Notes takes a note, and Activity still reads the entry\'s own history', async ({ page }) => {
  await openFirstEntry(page)
  await tab(page, /^Notes/).click()
  await expect(page.getByText('Coming Soon')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Add a note' })).toBeVisible()

  await tab(page, /^Activity/).click()
  await expect(page.getByText('Activity Timeline')).toBeVisible()
  await expect(page.getByText(/posted the/).first()).toBeVisible()
  await expect(page.getByText(/backend integration/)).toHaveCount(0)
})

/* No Type and no Description on the entry page. Mahad, 2026-09-30: *"Remove
   type from journal entry detail page"* and *"remove description entirly, we
   will only have memo and line description."* The page is titled by the entry's
   number, and its rail names the Journal Entry ID as the ledger's column does. */
test('states no type and no description, and is titled by its number', async ({ page }) => {
  const je = await openFirstEntry(page)
  await expect(page.locator('h1').first()).toHaveText(je)
  const badges = page.locator('h1').first().locator('xpath=..')
  for (const t of ['Simple', 'Compound', 'Reversing']) await expect(badges.getByText(t, { exact: true })).toHaveCount(0)
  await expect(page.getByText(/journal entry · posts to/)).toHaveCount(0)
  await expect(page.getByText(/^Posts to /)).toBeVisible()
  for (const label of ['Type', 'Description']) await expect(page.getByText(label, { exact: true })).toHaveCount(0)
  await expect(page.getByText('How the entry is built', { exact: false })).toHaveCount(0)
  await expect(page.getByText('Journal entry ID', { exact: true })).toBeVisible()
  await expect(page.getByText('Memo', { exact: true }).first()).toBeVisible()
})

test.describe('the two retained earnings accounts', () => {
  test('the system account says the close posts there and where corrections go', async ({ page }) => {
    await page.goto('/chart-of-accounts/acct_32100', { waitUntil: 'networkidle' })
    await expect(page.getByText('The year-end close posts here, and nothing else does')).toBeVisible()
    await expect(page.getByText(/Corrections made by hand go to 32200 Manual GL Transactions/)).toBeVisible()
    await page.getByRole('button', { name: 'Learn more' }).first().click()
    await expect(page.getByRole('dialog', { name: 'Correcting retained earnings' })).toBeVisible()
  })

  test('the manual account says what it is for', async ({ page }) => {
    await page.goto('/chart-of-accounts/acct_32200', { waitUntil: 'networkidle' })
    await expect(page.getByText(/Corrections to retained earnings made by hand land here/)).toBeVisible()
  })

  test('both roll up under one Retained Earnings summary on the chart', async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.getByPlaceholder('Search accounts').fill('Retained Earnings')
    await expect(page.locator('tbody tr', { hasText: 'Retained System Earnings' })).toHaveCount(1)
    await expect(page.locator('tbody tr', { hasText: 'Manual GL Transactions' })).toHaveCount(1)
  })
})
