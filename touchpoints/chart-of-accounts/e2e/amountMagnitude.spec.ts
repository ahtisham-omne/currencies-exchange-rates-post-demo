import { test, expect, type Page } from '@playwright/test'
import { settle, view } from './glPage'

/* Mahad, 2026-09-24: *"The amount filter should match by absolute value, so
   entering -23.45 or 23.45 returns the same results."*

   A posting is either a debit or a credit and its amount is the size of it, so
   there is no posting a signed bound could ever mean. Read in a browser because
   what went wrong is what the reader was shown: a minimum of -1000 barred
   nothing and a maximum of -1000 barred everything, and both came back looking
   like an answer. The panel forecasts its own result on the Apply button, so the
   two spellings can be compared without leaving it. */

const SIZE = '1000'

/* The ledger's range lives on the toolbar since the design review of
   2026-09-28 (Eli: *"I would bring the range out for starters"*), so it is read
   there, against the count beside it, rather than off the Filters panel. */
const rangePanel = (page: Page) => page.locator('[data-amount-range]')
const rangeBound = (page: Page, which: 'Minimum' | 'Maximum') =>
  rangePanel(page).locator('input[type="number"]').nth(which === 'Minimum' ? 0 : 1)

const openGl = async (page: Page) => {
  await settle(page, '/general-ledger')
  await view(page, 'General ledger').click()
  await page.getByRole('button', { name: /^Amount range/ }).click()
  await rangePanel(page).waitFor()
}

// "892 of 2,150 postings" → 892
async function shown(page: Page) {
  const text = await page.getByText(/ of [\d,]+ postings$/).first().innerText()
  return Number(text.split(' ')[0].replace(/,/g, ''))
}

test.describe('an amount bound is a size, however it is spelled', () => {
  for (const which of ['Minimum', 'Maximum'] as const) {
    test(`a ${which.toLowerCase()} keeps the same postings signed or not`, async ({ page }) => {
      await openGl(page)
      const all = await shown(page)

      await rangeBound(page, which).fill(SIZE)
      await expect.poll(() => shown(page)).toBeLessThan(all)
      const plus = await shown(page)
      /* Or the comparison below proves nothing: a bound that bars no posting
         returns the whole ledger, which is also what the broken reading of a
         negative minimum returned. */
      expect(plus).toBeGreaterThan(0)

      await rangeBound(page, which).fill(`-${SIZE}`)
      await expect.poll(() => shown(page)).toBe(plus)
    })
  }

  /* The warning has to read the pair the way the matching does, or a range that
     matches nothing goes by in silence. -1000 to 10 is a minimum above a maximum
     once both ends are sizes. */
  test('warns on a range that crosses once both ends are sizes', async ({ page }) => {
    await openGl(page)
    await rangeBound(page, 'Minimum').fill(`-${SIZE}`)
    await rangeBound(page, 'Maximum').fill('10')
    await expect(rangePanel(page).getByText('The minimum is above the maximum, so nothing can fall between them.')).toBeVisible()
  })
})

/* The same pair of fields under the chart's balance filter bounds a signed
   figure, where an account 500 in the red and one 500 in the black are not the
   same account. Absolutising there would have merged them, so that range is left
   reading by sign - and its warning with it. */
const panel = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Filters' }).last()
const section = (page: Page, title: string) =>
  panel(page).locator('div.px-6.py-4')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
const bound = (page: Page, title: string, which: 'Minimum' | 'Maximum') =>
  section(page, title).locator('input[type="number"]').nth(which === 'Minimum' ? 0 : 1)

test('a running balance range is still read by sign', async ({ page }) => {
  await settle(page, '/chart-of-accounts')
  await page.getByRole('button', { name: /^Filters/ }).first().click()
  await bound(page, 'Running balance', 'Minimum').fill(`-${SIZE}`)
  await bound(page, 'Running balance', 'Maximum').fill('10')
  await expect(panel(page).getByText('The minimum is above the maximum, so nothing can fall between them.')).toHaveCount(0)
})
