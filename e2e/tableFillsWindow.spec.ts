import { test, expect, type Page } from '@playwright/test'

/* A table's card reaches the bottom of the window however few rows it holds,
   as the Partners listing's does, so the Columns panel docked in it opens at
   full height rather than stopping where a search left the rows. Mahad,
   2026-10-09: *"even if no search results are found in Partners, the entire
   white table container still stretches down to the bottom ... I need this same
   behavior applied here as well."* */

// How far the card's bottom, and the docked panel's, sit above the window's.
const gaps = (page: Page, search: string) => page.evaluate((search) => {
  const input = document.querySelector(`input[placeholder="${search}"]`) as HTMLElement
  const card = input.closest('.card') as HTMLElement
  let panel = document.querySelector('[aria-label="Close columns"]') as HTMLElement | null
  while (panel && panel.style.width !== '300px') panel = panel.parentElement
  const bottom = (el: HTMLElement | null) => (el ? Math.round(innerHeight - el.getBoundingClientRect().bottom) : null)
  return { card: bottom(card), panel: bottom(panel) }
}, search)

const TABLES: { name: string; path: string; search: string; tab?: string; columns: boolean }[] = [
  { name: 'chart of accounts', path: '/chart-of-accounts', search: 'Search accounts', columns: true },
  { name: 'general ledger', path: '/general-ledger', search: 'Search postings', columns: true },
  { name: 'account transactions', path: '/chart-of-accounts/acct_11130', search: 'Search transactions', tab: 'Transactions', columns: true },
  { name: 'summary accounts', path: '/chart-of-accounts/acct_11100', search: 'Search accounts', tab: 'Accounts', columns: true },
  { name: 'dimensions', path: '/dimensions', search: 'Search by name or value', columns: false },
]

for (const t of TABLES) {
  test(`the ${t.name} card runs to the bottom of the window with nothing found`, async ({ page }) => {
    await page.goto(t.path, { waitUntil: 'networkidle' })
    if (t.tab) await page.getByRole('tab', { name: new RegExp(`^${t.tab}`) }).or(page.getByRole('button', { name: new RegExp(`^${t.tab}`) })).first().click()
    await page.getByPlaceholder(t.search).first().fill('zzzqqq')
    await expect(page.getByText(/^0 of /).first()).toBeVisible()
    if (t.columns) await page.getByRole('button', { name: /^Columns/ }).first().click()

    // The page's own bottom gutter, and no more: a short table used to leave
    // the card ending a few hundred pixels up, the panel cut off with it.
    await expect.poll(async () => (await gaps(page, t.search)).card).toBeLessThanOrEqual(32)
    if (t.columns) {
      // The panel stands the card's full height beside the empty table.
      await expect.poll(async () => {
        const g = await gaps(page, t.search)
        return Math.abs((g.panel ?? 999) - (g.card ?? 0))
      }).toBeLessThanOrEqual(2)
    }
  })
}
