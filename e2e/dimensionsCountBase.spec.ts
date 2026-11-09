import { test, expect, type Page } from '@playwright/test'

/* The Dimensions page's count, on the rule `chartCountBase.spec.ts` sets for the
   chart: the numerator is what the table drew, the denominator is the whole set,
   and the denominator never moves.

   This spec used to also cover the Filters panel's Apply button, which forecast
   the listing and once got it wrong - search "Location" and the table drew one row
   and the toolbar agreed, "1 of 3 dimensions", while the panel offered "Show 3
   dimensions" because it counted its Status facet over the whole set instead of
   over what the search had already left. The panel is gone (Mahad, 2026-09-22:
   *"Can we remove Filters from the Dimensions page?"* - one facet, over a column
   printed on every row of a list this short). Search is the only thing that can
   narrow this table now, so it is the only thing the count has to survive. */

const dimensions = async (page: Page) => {
  await page.goto('/dimensions', { waitUntil: 'networkidle' })
  await page.waitForSelector('tbody tr')
}

// "1 of 3 dimensions" → { shown: 1, total: 3 }
async function tally(page: Page) {
  const text = await page.locator('span')
    .filter({ hasText: /^[\d,]+ of [\d,]+ dimensions$/ }).first().innerText()
  const m = /^([\d,]+) of ([\d,]+) dimensions$/.exec(text.trim())!
  return { shown: Number(m[1]), total: Number(m[2]) }
}

test('counts every row it drew, out of every dimension defined', async ({ page }) => {
  await dimensions(page)
  const { shown, total } = await tally(page)
  expect(shown).toBe(await page.locator('tbody tr').count())
  expect(shown).toBe(total)
})

test('a search moves the numerator and leaves the whole alone', async ({ page }) => {
  await dimensions(page)
  const before = await tally(page)
  await page.getByPlaceholder('Search by name or value').fill('Location')

  await expect.poll(async () => (await tally(page)).shown).toBeLessThan(before.shown)
  const narrowed = await tally(page)
  expect(narrowed.shown, 'the numerator is what was drawn').toBe(await page.locator('tbody tr').count())
  expect(narrowed.total, 'the whole is not a result').toBe(before.total)
})

/* Filters came back on 2026-10-02 for who and when only - Eli wanted Created by
   and Last updated as columns and filters on every grid. The Status facet that
   was taken away with the button stays away: what is pinned is that the panel
   asks who and when, and nothing about status. */
test('filters by who and when, and not by status', async ({ page }) => {
  await dimensions(page)
  await page.getByRole('button', { name: /^Filters/ }).click()
  await expect(page.getByText('Who added the dimension, and when.')).toBeVisible()
  await expect(page.getByText('Who last changed the dimension, and when.')).toBeVisible()
  // Inside the panel: the table behind it has a Status column of its own.
  const panel = page.locator('body > div.fixed').filter({ hasText: 'Who added the dimension' }).last()
  await expect(panel.getByText('Status', { exact: true })).toHaveCount(0)
})
