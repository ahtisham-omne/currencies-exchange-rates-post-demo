import { test, expect, type Page } from '@playwright/test'

/* Mahad, 2026-09-22: *"this is for all column headers, when we click on it and
   this menu comes, there should also be options for freeze and hide as in
   partners."*

   Pinned in a browser because freezing is a claim about paint, not markup. A
   source test can see that a menu renders the two items; only a real scroll can
   see whether the column the reader froze actually held its ground while the rest
   of the table went past it - the offsets are summed from measured widths, and a
   figure short by a few pixels leaves a seam or laps the column before it. */

async function openHeaderMenu(page: Page, label: string) {
  await page.getByRole('columnheader').filter({ hasText: label }).first().getByRole('button').first().click()
  await expect(page.locator('[data-col-popover]')).toBeVisible()
}

const headerLeft = (page: Page, label: string) => page.evaluate((l) => {
  const th = Array.from(document.querySelectorAll('th')).find(e => e.textContent?.includes(l))
  return th ? Math.round(th.getBoundingClientRect().left) : null
}, label)

// The one element on the page that actually overflows horizontally and holds a
// table, whichever card it happens to live in.
const scrollTable = (page: Page, to: number) => page.evaluate((x) => {
  const el = (Array.from(document.querySelectorAll('div')) as HTMLElement[])
    .find(e => e.scrollWidth > e.clientWidth + 10 && e.querySelector('table'))
  if (!el) return null
  el.scrollLeft = x
  return el.scrollWidth - el.clientWidth
}, to)

/** Freeze `label` from its header menu, then check it doesn't move when the table
 *  is scrolled past it - and that the columns behind it did move. */
async function freezeHolds(page: Page, label: string, neighbour: string) {
  await openHeaderMenu(page, label)
  await expect(page.locator('[data-col-popover]')).toContainText('Freeze')
  await page.getByText('Freeze', { exact: true }).click()
  await expect(page.locator('[data-col-popover]')).toHaveCount(0)

  // From the left edge: the ledger's two tabs share one scroller, so a scroll
  // made on one tab is still there on the other, and scrolling to where it
  // already is would prove nothing.
  await scrollTable(page, 0)
  await page.waitForTimeout(100)
  const pinnedBefore = await headerLeft(page, label)
  const looseBefore = await headerLeft(page, neighbour)
  const overflow = await scrollTable(page, 600)
  expect(overflow).toBeTruthy()
  await page.waitForTimeout(300)

  expect(await headerLeft(page, label)).toBe(pinnedBefore)
  expect(await headerLeft(page, neighbour)).toBeLessThan(looseBefore!)
}

test('every column header offers Hide and Freeze', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await openHeaderMenu(page, 'Statement classification')
  await expect(page.locator('[data-col-popover] button')).toHaveText([
    'Filter', 'Sort ascending', 'Sort descending', 'Hide', 'Freeze',
  ])
})

test('a frozen chart column holds its place', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await freezeHolds(page, 'Statement classification', 'Account role')
})

test('a frozen ledger column holds its place on both tabs', async ({ page }) => {
  // Narrow enough to overflow: at 1440 the ledger fits now that the figures are
  // not pinned and the short columns take only their content's width.
  await page.setViewportSize({ width: 1100, height: 900 })
  await page.goto('/general-ledger', { waitUntil: 'networkidle' })
  // Collapsed, the tree holds only account rows and its text columns are empty,
  // so there is nothing wide enough to scroll. Opened, the postings fill them.
  await page.getByRole('button', { name: /^(Expand|Collapse) all$/ }).first().click()
  await page.getByText('Show the postings under every account').click()
  await page.locator('tr.gl-child').first().waitFor()
  // GL category ships hidden since the design review of 2026-09-24, so Source.
  await freezeHolds(page, 'Source', 'Line description')

  await page.getByText('Journal entries', { exact: true }).first().click()
  await expect(page.getByRole('columnheader').filter({ hasText: 'Journal entry' }).first()).toBeVisible()
  await freezeHolds(page, 'Journal entry', 'Memo')
})

test('hiding a column from its header menu removes it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/general-ledger', { waitUntil: 'networkidle' })
  const memo = page.getByRole('columnheader').filter({ hasText: 'Line description' })
  await expect(memo).toHaveCount(1)
  await openHeaderMenu(page, 'Line description')
  await page.getByText('Hide', { exact: true }).click()
  await expect(memo).toHaveCount(0)
})

test('a frozen register column holds its place on the account page', async ({ page }) => {
  // Narrow enough that the register overflows, which is the only state in which a
  // frozen column has anything to hold against.
  await page.setViewportSize({ width: 1100, height: 900 })
  await page.goto('/chart-of-accounts/acct_11110', { waitUntil: 'networkidle' })
  await page.getByText('Transactions', { exact: true }).first().click()
  await expect(page.getByRole('columnheader').filter({ hasText: 'Journal entry' })).toHaveCount(1)
  // All time, so the rows are wide enough to overflow; the register opens on
  // the last 30 days.
  await page.getByRole('button', { name: /^Last 30 days/ }).first().click()
  await page.getByText('All time', { exact: true }).last().click()
  await freezeHolds(page, 'Journal entry', 'Source')
})
