import { test, expect, type Page } from '@playwright/test'

/* The controls in the chart's page header, and which of them a reader has to
   open something to find.

   Dimensions was a third item under Actions - Mahad: *"dimensions needs to be a
   button in between actions and create GL account. Not in the actions dropdown.
   It is too hidden."* Import and Export stayed behind Actions, because each is a
   one-off job that ends on this page, where Dimensions leaves for another one.

   Pinned against the running page rather than the source, because "too hidden"
   is a fact about what is on screen before anything is clicked. */

/* Settled, not merely painted: the KPI cards and the insights panel land after
   the header and reflow the page, and these assertions read positions. */
async function chart(page: Page) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
}

/* Scoped to the header's action group, reached as the parent of the one button
   only it has. The filter row carries a "Dimensions" button too, so an
   unscoped name matched that one and reported the header control present after
   it had been put back in the dropdown. */
const bar = (page: Page) =>
  page.getByRole('button', { name: /Create GL account/ }).locator('xpath=..')

const button = (page: Page, name: RegExp) => bar(page).getByRole('button', { name })

// Left-to-right order of the header's own buttons, by where they sit on screen.
async function xOf(page: Page, names: RegExp[]) {
  const boxes = await Promise.all(names.map(async n => {
    const b = button(page, n)
    await expect(b, String(n)).toHaveCount(1)
    return b.boundingBox()
  }))
  return boxes.map(b => b!.x)
}

test.describe('the chart header says where to go without being opened', () => {
  test.beforeEach(({ page }) => chart(page))

  // Guards the scope above: if the group stops being the button's parent, these
  // read an empty set and every assertion below becomes vacuous.
  test('finds the header action group', async ({ page }) => {
    await expect(bar(page)).toHaveCount(1)
    // Read by accessible name, so an icon-only button would still be counted.
    const names = await bar(page).getByRole('button').evaluateAll(bs =>
      bs.map(b => (b.getAttribute('aria-label') || (b as HTMLElement).innerText).trim()))
    // How it works sits with the page's own controls (decision 124, COA-20),
    // as an icon button, the last before Create GL account (design review,
    // 2026-10-08: "the first button you see before the primary action").
    expect(names).toEqual(['Actions', 'Dimensions', 'How it works', 'Create GL account'])
    const help = bar(page).getByRole('button', { name: 'How it works' })
    await expect(help).toHaveText('')
    const [h, a] = await Promise.all([help, bar(page).getByRole('button', { name: /^Actions/ })].map(b => b.evaluate(el => Math.round(el.getBoundingClientRect().height))))
    expect(h).toBe(a)
  })

  test('offers Dimensions as a button, between Actions and Create GL account', async ({ page }) => {
    const [actions, dimensions, create] =
      await xOf(page, [/^Actions/, /^Dimensions$/, /Create GL account/])
    expect(actions).toBeLessThan(dimensions)
    expect(dimensions).toBeLessThan(create)
  })

  /* The point of the move: closed, the header already names it. One that appears
     only once Actions is open is the dropdown item under another name. */
  test('shows it before anything is opened', async ({ page }) => {
    await expect(button(page, /^Dimensions$/)).toBeVisible()
  })

  test('goes to the dimensions page', async ({ page }) => {
    await button(page, /^Dimensions$/).click()
    await expect(page).toHaveURL(/\/dimensions$/)
  })

  /* Not offered in both places. A duplicate sitting beside the button is the
     same "too hidden" problem solved twice, and reads as two different things.

     `Menu` portals its panel into the body with no role of its own, and a
     tooltip raised by the same hover portals to the same place - so the panel is
     the portalled box that holds buttons. */
  test('keeps Actions to the jobs that end on this page', async ({ page }) => {
    await button(page, /^Actions/).click()
    const panel = page.locator('body > div.fixed').filter({ has: page.locator('button') }).last()
    await panel.locator('button').first().waitFor()
    const items = (await panel.locator('button').allInnerTexts())
      .map(t => t.trim().split('\n')[0]).filter(Boolean)
    // Account numbers came off on 2026-10-07 (Mahad: *"please remove the
    // account numbers from actions dropdown"*).
    expect(items).toEqual(['Import', 'Export'])
  })
})
