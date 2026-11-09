import { test, expect, type Page } from '@playwright/test'
import { settle, view } from './glPage'

/* One rule, everywhere a collapsible table offers a search box.

   Mahad, 2026-09-29: *"Search is not working in general ledger as it is working
   on journal entries. So this will be a rule in this module as a whole, if a row
   is collapsed and if the search results have something in the row, the row
   should open, showcasing the yellow highlight."* Eli had asked for it on the
   ledger in the design review: *"if you have results that are in the buried
   structure, then open those structures ... Don't surface them and force the
   user to open, open, open."*

   The entries tab already obeyed it (see journalEntriesTab.spec.ts). The two
   trees did not: searching "rent" on the General ledger tab returned six
   collapsed accounts with no yellow anywhere, and a collapsed chart answered
   "petty" with "1 of 140 accounts" over two shut summaries and no matched row on
   screen at all.

   The assertions below are written as the rule rather than against a fixture,
   because the demo ledger is reseeded per browser profile and drifts with the
   calendar: what matters is that nothing comes back shut without saying why, not
   how many postings a given month happens to hold. */

// A row that is shut AND carries no mark is the fault itself: the reader is
// shown a row, told it answered, and given nothing to go on.
const shutAndUnmarked = (page: Page) =>
  page.locator('tbody.gl-group:not(.gl-expanded)').filter({ hasNot: page.locator('mark.mark') })

test.describe('the General ledger tab', () => {
  test('opens each account onto the postings the search found inside it', async ({ page }) => {
    await settle(page, '/general-ledger')
    // A journal entry number is carried by the postings and by no account name,
    // so an account that comes back for one can only have matched inside.
    await view(page, 'Journal entries').click()
    const je = (await page.locator('tr.gl-je-parent').first().getByRole('button', { name: /^JE-/ }).innerText()).trim()

    await view(page, 'General ledger').click()
    await page.getByPlaceholder('Search postings').fill(je)
    await expect.poll(() => page.locator('tbody.gl-group').count()).toBeGreaterThan(0)
    // Every account it returned holds that entry, so every one of them is open.
    expect(await page.locator('tbody.gl-expanded').count())
      .toBe(await page.locator('tbody.gl-group').count())
    await expect(page.locator('mark.mark').first()).toBeVisible()
  })

  /* The other half of the rule, and the reason it is not "open everything": an
     account the search found by its own number or name has nothing further
     inside to show, and the parent row marks the hit where the reader is
     already looking. Opening it would bury the answer under its whole register. */
  test('leaves an account it only named shut, and marks the name', async ({ page }) => {
    await settle(page, '/general-ledger')
    await view(page, 'General ledger').click()
    const name = (await page.locator('tbody.gl-group > tr:first-child td:first-child').first().innerText())
      .replace(/\s+/g, ' ').replace(/^\S+\s/, '').replace(/ · .*$/, '').trim()

    await page.getByPlaceholder('Search postings').fill(name)
    await expect.poll(() => page.locator('tbody.gl-group').count()).toBeGreaterThan(0)
    await expect(page.locator('mark.mark').first()).toBeVisible()
    await expect(shutAndUnmarked(page)).toHaveCount(0)
  })

  test('never answers a search with a screen of shut, unexplained rows', async ({ page }) => {
    await settle(page, '/general-ledger')
    await view(page, 'General ledger').click()
    const search = page.getByPlaceholder('Search postings')
    for (const term of ['rent', 'cash', 'payroll', 'bank']) {
      await search.fill(term)
      await expect.poll(() => page.locator('tbody.gl-group').count()).toBeGreaterThan(0)
      await expect(page.locator('mark.mark').first(), `"${term}" shows the reader what it found`).toBeVisible()
      await expect(shutAndUnmarked(page), `"${term}" leaves nothing shut and unexplained`).toHaveCount(0)
    }
  })

  // The search's disclosure is the search's; the reader's own still wins over it.
  test('lets the reader shut one the search opened', async ({ page }) => {
    await settle(page, '/general-ledger')
    await view(page, 'General ledger').click()
    await page.getByPlaceholder('Search postings').fill('rent')
    await expect.poll(() => page.locator('tbody.gl-expanded').count()).toBeGreaterThan(0)
    const open = await page.locator('tbody.gl-expanded').count()
    await page.locator('tbody.gl-group button[aria-label="Collapse"]').first().click()
    await expect.poll(() => page.locator('tbody.gl-expanded').count()).toBe(open - 1)
  })
})

test.describe('the chart of accounts', () => {
  const collapseAll = async (page: Page) => {
    await page.getByRole('button', { name: /^(Expand|Collapse) all$/ }).first().click()
    await page.getByText('Show the five category rows only').click()
  }

  test('draws a match inside a collapsed chart, in its place and marked', async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.locator('table tbody tr').first().waitFor()
    await collapseAll(page)

    await page.getByPlaceholder('Search accounts').fill('petty')
    // 11110 Petty Cash sits three summaries deep, every one of them shut a
    // moment ago. The chart said "1 of 140 accounts" and drew none of it.
    await expect(page.locator('tr', { hasText: 'Petty Cash' }).first()).toBeVisible()
    await expect(page.locator('mark.mark').first()).toBeVisible()
    // And only the match: the summaries above it are not results, so they are
    // not drawn. Design review, 2026-09-30 - Eli: *"You should isolate it to the
    // specific line."*
    const rows = await page.locator('table tbody tr').allInnerTexts()
    expect(rows.some(r => r.includes('Petty Cash'))).toBe(true)
    expect(rows.some(r => r.includes('Current Assets'))).toBe(false)
    expect(rows.some(r => r.includes('Cash and Cash Equivalents'))).toBe(false)
  })

  /* What the search opened is the search's, so clearing the box has to give the
     reader their own tree back. The page used to delete collapsed groups outright
     to get a match on screen, and they never came back. */
  test('gives the reader their collapsed tree back when the box is cleared', async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.locator('table tbody tr').first().waitFor()
    await collapseAll(page)
    const shut = await page.locator('table tbody tr').count()

    const search = page.getByPlaceholder('Search accounts')
    await search.fill('petty')
    await expect(page.locator('mark.mark').first()).toBeVisible()
    await search.fill('')
    await expect.poll(() => page.locator('table tbody tr').count()).toBe(shut)
  })
})
