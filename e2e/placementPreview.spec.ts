import { test, expect, type Page, type Locator } from '@playwright/test'

/* How much of the branch the last step of Create shows. Mahad, 2026-09-24, on a
   preview that happened to be drawing a whole branch: *"We need to define a rule
   here for how many accounts we see above and below in the preview... I think two
   above and two below works fine."*

   Which is the rule `placementPreview` already keeps (`SIDE = 2`), and the case he
   was looking at hid nothing because the branch was three rows long. Pinned here
   rather than left to the unit tests, which is where the window is arithmetic:
   only a rendered step says the table draws the window it was handed, counts and
   all. */

const modal = (page: Page) => page.locator('body > div.fixed').filter({ hasText: 'Full view' }).last()
const field = (m: Locator, label: string) =>
  m.locator(`xpath=.//label[starts-with(normalize-space(.), "${label}")]/..`)

async function details(page: Page, type: 'Posting' | 'Summary', parent: string) {
  await page.goto('/chart-of-accounts', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Create GL account/ }).click()
  const m = modal(page)
  await m.getByRole('button', { name: /Continue/ }).first().click()
  await m.getByText('GL account details').first().waitFor()
  await field(m, 'GL account type').locator('button[aria-haspopup="listbox"]').click()
  await page.getByRole('option', { name: type, exact: true }).click()
  await field(m, 'Parent').locator('button[aria-haspopup="listbox"]').first().click()
  await page.getByRole('option', { name: new RegExp(parent) }).first().click()
  await field(m, 'GL account name').locator('input').fill('Test Fixtures')
  return m
}

/* A posting takes a Dimensions step on the way, so the preview is reached by
   continuing until it is on screen rather than by counting clicks. */
async function toPreview(m: Locator) {
  for (let i = 0; i < 3; i++) {
    if (await m.getByText('Placement preview').first().isVisible()) return
    await m.getByRole('button', { name: /Continue/ }).first().click()
  }
  await m.getByText('Placement preview').first().waitFor()
}

const rows = (m: Locator) => m.locator('table tbody tr')

test('draws two siblings either side of the account, and counts the rest', async ({ page }) => {
  /* 12100 Property, Plant and Equipment holds thirteen postings and 12132 lands in
     the middle of them, so both ends have something left over. */
  const m = await details(page, 'Posting', '12100')
  await field(m, 'GL account no.').locator('input').fill('12132')
  await toPreview(m)

  /* Three enclosing summaries, a stand-in, two siblings, the account, two
     siblings, a stand-in. The count is what carries "two either side": naming
     the four accounts alone would still pass if a fifth were drawn. */
  await expect(rows(m)).toHaveCount(10)
  await expect(rows(m).nth(4)).toContainText('Furniture and Fixtures')
  await expect(rows(m).nth(5)).toContainText('Vehicles')
  await expect(rows(m).nth(6)).toContainText('Test Fixtures')
  await expect(rows(m).nth(7)).toContainText('Computer Equipment')
  await expect(rows(m).nth(8)).toContainText('Accumulated Depreciation - Buildings')
  await expect(m.getByText('4 more above')).toBeVisible()
  await expect(m.getByText('5 more below')).toBeVisible()
})

test('counts nothing on a branch short enough to draw whole', async ({ page }) => {
  /* Mahad's own case. ASSETS holds two summaries and the draft sorts after both,
     so two above is the whole run and there is no remainder to name. A count
     appearing here would be counting rows that are on screen. */
  const m = await details(page, 'Summary', '10000')
  await toPreview(m)

  // ASSETS, both its summaries, and the account: the branch entire.
  await expect(rows(m)).toHaveCount(4)
  await expect(rows(m).nth(1)).toContainText('Current Assets')
  await expect(rows(m).nth(2)).toContainText('Non-Current Assets')
  await expect(rows(m).nth(3)).toContainText('Test Fixtures')
  await expect(m.getByText(/more above/)).toHaveCount(0)
  await expect(m.getByText(/more below/)).toHaveCount(0)
})

/* Mahad, 2026-10-01: *"Everywhere in the preview, can we remove this"* - the
   breadcrumb of the branch above the table - *"And can we have the curved
   horizontal lines in the preview as well? ... Exactly how we have them in the
   COA listing table."* Each nested account row branches off its trunk on a
   curve; a stand-in row ("N more") runs straight through, being no account. */
const elbow = (scope: Locator) => scope.locator('span.border-l.border-b')
const elbowLook = (l: Locator) => l.first().evaluate(el => {
  const c = getComputedStyle(el)
  return { radius: c.borderBottomLeftRadius, color: c.borderLeftColor, width: c.width, height: c.height }
})

test('draws the listing\'s curved branches, and no breadcrumb above the table', async ({ page }) => {
  const m = await details(page, 'Posting', '12100')
  await field(m, 'GL account no.').locator('input').fill('12132')
  await toPreview(m)

  // The breadcrumb's names were small type above the table; none is left.
  await expect(m.locator('span.text-2xs', { hasText: 'Test Fixtures' })).toHaveCount(0)

  const all = rows(m)
  const n = await all.count()
  for (let i = 0; i < n; i++) {
    const row = all.nth(i)
    const text = (await row.innerText()).trim()
    const isStandIn = /^\d+ more/.test(text.replace(/^\S*\s*/, '')) || /more\b/.test(text) && !/\d{5}/.test(text)
    const nested = i > 0
    await expect(elbow(row), `${text}: ${isStandIn ? 'stand-in' : 'account'}`).toHaveCount(nested && !isStandIn ? 1 : 0)
  }

  // Drawn as the chart listing draws its own.
  const previewLook = await elbowLook(elbow(m.locator('table')))
  await page.keyboard.press('Escape')
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('tbody tr').first().waitFor()
  expect(await elbowLook(elbow(page.locator('table').first()))).toEqual(previewLook)
})
