import { test, expect, type Page } from '@playwright/test'

/* One denominator for the whole chart. Mahad, 2026-09-15: *"standardize every
   count on one base, the full account set including archived (138). The pill row
   should read '136 of 138' (136 active shown, 138 total), and the Archived view
   should read '2 of 138' (2 archived out of 138 total), so all three places, pill
   row, Filters dialog, and Archived view, count against the same 138 denominator
   instead of mixing '136' and '138' as bases."*

   The total used to drop the archived accounts unless Filters → Status asked for
   them, so the same chart was 136 in one state and 138 in another and the
   Archived view read "2 of 136" - two accounts out of a set that excluded them.
   How many accounts exist is not a question the reader's filters answer. Only the
   numerator moves.

   Asserted as a relation, not against 138: the chart is seeded and a later commit
   may add an account. What has to hold is that the denominator never moves, that
   the numerator is a share of it, and that the shares partition it. */

const chart = async (page: Page) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
}

// "136 of 138 accounts" → { shown: 136, total: 138 }
async function tally(page: Page) {
  const text = await page.locator('span')
    .filter({ hasText: /^[\d,]+ of [\d,]+ accounts$/ }).first().innerText()
  const m = /^([\d,]+) of ([\d,]+) accounts$/.exec(text.trim())!
  return { shown: Number(m[1].replace(/,/g, '')), total: Number(m[2].replace(/,/g, '')) }
}

const pill = (page: Page, label: string) =>
  page.getByRole('button', { name: new RegExp(`^${label}\\b`) }).first()

// The number a quick-filter pill carries, e.g. "Archived 2" → 2.
async function pillCount(page: Page, label: string) {
  const m = /([\d,]+)\s*$/.exec((await pill(page, label).innerText()).trim())
  return m ? Number(m[1].replace(/,/g, '')) : null
}

test('the Archived view counts out of the whole chart, not out of what hides it', async ({ page }) => {
  await chart(page)
  const untouched = await tally(page)
  const archived = await pillCount(page, 'Archived')
  expect(archived, 'the chart holds archived accounts to count').toBeGreaterThan(0)

  // Archived rows are the ones the untouched page leaves out, so the two
  // together are the whole chart.
  expect(untouched.shown + archived!).toBe(untouched.total)

  await pill(page, 'Archived').click()
  const view = await tally(page)
  expect(view.shown, 'the view shows what its pill counted').toBe(archived)
  expect(view.total, 'and counts out of the same whole').toBe(untouched.total)
})

test('the category pills partition the same whole', async ({ page }) => {
  await chart(page)
  const { total } = await tally(page)
  let sum = await pillCount(page, 'Archived') ?? 0
  for (const label of ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']) {
    const n = await pillCount(page, label)
    expect(n, `${label} carries a count`).not.toBeNull()
    sum += n!
    // What the pill promises is what clicking it draws.
    await pill(page, label).click()
    expect((await tally(page)).shown, `${label} draws the rows it counted`).toBe(n)
    expect((await tally(page)).total, `${label} counts out of the same whole`).toBe(total)
    await page.getByRole('button', { name: 'Show All', exact: true }).click()
  }
  expect(sum, 'every account sits under exactly one pill').toBe(total)
})

test('a search narrows the numerator and leaves the whole alone', async ({ page }) => {
  await chart(page)
  const before = await tally(page)
  // By its own placeholder: the app shell carries a search box of its own, and
  // the first /search/i on the page is that one, which narrows nothing here.
  await page.getByPlaceholder('Search accounts').fill('cash')
  // Against what was shown, not against the whole: the untouched page already
  // shows fewer than the whole, so comparing to the total proves nothing.
  await expect
    .poll(async () => (await tally(page)).shown, { message: 'the search narrows' })
    .toBeLessThan(before.shown)
  expect((await tally(page)).total, 'the whole is not a result').toBe(before.total)
})

/* The panel's Apply button forecasts the listing, so it has to quote the number
   the page will draw rather than the chart's total. It used to read "Show 138
   accounts" on an untouched chart and then list 136, because it applied the
   facets without the rule that keeps archived rows off the page. */
test('the Filters panel offers to show what the page will draw', async ({ page }) => {
  await chart(page)
  const { shown } = await tally(page)
  await page.getByRole('button', { name: /^Filters/ }).first().click()
  await expect(page.getByRole('button', { name: `Show ${shown.toLocaleString()} accounts` })).toBeVisible()
})
