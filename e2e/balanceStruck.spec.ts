import { test, expect, type Page } from '@playwright/test'

/* The line under a balance says when that balance was struck.

   It used to answer a different question - whether anything had ever posted to
   the account - and printed the answer under a figure that was not nothing. 6530
   Loss on Sale of Assets carries an opening of $3,200 and has never been posted
   to, so its Running balance tile read "+$ 3,200" over "No postings yet" while
   the tile beside it printed the same 3,200 with a date on it, leaving the
   reader to work out which one to believe.

   A figure standing with no movement behind it is an opening balance, not an
   absence. Pinned in a browser because lib/balanceStruck.test.ts can only prove
   the function picks the right words; it cannot see which tiles are wired to it,
   or that the page still draws a figure over the caption. */

// The KPI tile carrying `label`: innermost rounded card holding that label.
const tile = (page: Page, label: string) =>
  page.locator('div.rounded-lg')
    .filter({ has: page.getByText(label, { exact: true }) })
    .last()

// "$ 3,200" → 3200, "-$ 110,000" → -110000, "-" → null.
const money = (s: string): number | null => {
  const t = s.trim()
  if (!/\d/.test(t)) return null
  const n = Number(t.replace(/[^0-9.]/g, ''))
  return /^-|^\(/.test(t) ? -n : n
}

async function readTile(page: Page, label: string) {
  const text = await tile(page, label).innerText()
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const i = lines.indexOf(label)
  return { figure: money(lines[i + 1] ?? ''), caption: lines[i + 2] ?? '' }
}

test('an untouched account states its balance as standing, not as absent', async ({ page }) => {
  await page.goto('/chart-of-accounts/acct_53020', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: /loss on sale of assets/i })).toBeVisible()

  const running = await readTile(page, 'Running balance')
  const opening = await readTile(page, 'Opening balance')

  // The account this test is about: an opening carried with nothing posted
  // against it. If the seed ever starts posting here, the caption below would be
  // right for the wrong reason.
  expect(running.figure, 'the tile prints a figure').not.toBeNull()
  expect(running.figure).not.toBe(0)
  expect(running.figure, 'nothing has moved it off its opening').toBe(opening.figure)

  expect(running.caption).toBe('No activity in this window')
  expect(running.caption, 'a figure is not an absence').not.toBe('No postings yet')
})

test('an account that has been posted to dates its balance', async ({ page }) => {
  // The other half: the caption only stands in for a date when there is no date
  // to give. 1085 is credited all year.
  await page.goto('/chart-of-accounts/acct_11330', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: /allowance for doubtful accounts/i })).toBeVisible()

  const { figure, caption } = await readTile(page, 'Running balance')
  expect(figure).not.toBeNull()
  expect(caption, 'a posted account is dated, not captioned').toMatch(/^As of /)
})
