import { test, expect, type Page, type Locator } from '@playwright/test'

/* One account, one set of actions, whichever page you ask from. The listing's
   row kebab used to withhold a posting account's "Move under a new summary
   account" and "Enter opening balance", and the account's own page used to
   withhold every lifecycle action and offer Delete as a button standing outside
   the menu - so which verbs an account had depended on where you looked.

   Both menus are drawn by `AccountActionItems` now, which is why the assertions
   below are set comparisons rather than a list of items per page: the point is
   not which items exist, it is that the two agree. "Enter opening balance" is the
   one sanctioned difference, and it is named here so that a second one cannot
   arrive quietly. */

const DETAIL_ONLY = ['Enter opening balance']

/* `Menu` portals its panel straight into the body and gives it no role. Tooltips
   portal to the same place and look the same to a selector, and hovering a kebab
   to click it raises one - so the panel is the portalled box that holds buttons,
   not simply the last one. */
const panel = (page: Page) =>
  page.locator('body > div.fixed').filter({ has: page.locator('button') }).last()

// Waits for the panel to have its items, not merely to exist. An empty menu
// would satisfy every `not.toContain` here.
async function openMenu(page: Page, open: () => Promise<void>) {
  await open()
  const p = panel(page)
  await p.locator('button').first().waitFor()
  return p
}

async function itemsOf(menu: Locator) {
  const items = (await menu.locator('button').allInnerTexts())
    .map(t => t.trim().split('\n')[0]).filter(Boolean)
  expect(items.length).toBeGreaterThan(0)
  return items
}

/* Settled, not merely painted. The KPI cards and the insights panel land after
   the table does and push it down the page; a kebab clicked before that lands on
   whatever slid into its place, and the menu never opens. */
async function listing(page: Page) {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
}

// The kebab is the last cell's button; the row menu has no label of its own.
const rowItems = async (page: Page, rowText: string) =>
  itemsOf(await openMenu(page, () => page.locator('tbody tr', { hasText: rowText }).first()
    .locator('td').last().locator('button').last().click()))

const detailItems = async (page: Page, id: string) => {
  await page.goto(`/chart-of-accounts/${id}`, { waitUntil: 'networkidle' })
  return itemsOf(await openMenu(page, () =>
    page.getByRole('button', { name: 'Account actions' }).click()))
}

/* One case per kind of account, because what each kind is offered is the part of
   this a reader would notice being wrong. The listing is loaded once per case
   and the account's page after it, so both halves are read from the same seed. */
const CASES = [
  {
    kind: 'posting',
    id: 'acct_11130',
    row: 'Operating - Chase Bank',
    // Deactivate and Archive read as their own verbs, so they are matched loosely.
    expect: ['Edit account', 'Create journal entry', 'Move under a new summary account'],
    absent: ['Create GL account'],
    lifecycle: true,
  },
  {
    kind: 'summary',
    id: 'acct_11200',
    row: 'Short-Term Investments',
    expect: ['Edit account', 'Create GL account'],
    // A summary has no balance of its own and nothing posts to it.
    absent: ['Create journal entry', 'Enter opening balance', 'Move under a new summary account'],
    lifecycle: true,
  },
  {
    kind: 'category',
    id: 'acct_10000',
    row: 'ASSETS',
    expect: ['Edit account', 'Create GL account'],
    // The chart's fixed spine: nothing takes one out of service, and nothing
    // posts to it either.
    absent: ['Create journal entry', 'Enter opening balance', 'Move under a new summary account', 'Delete account'],
    lifecycle: false,
  },
] as const

const closings = (items: readonly string[]) => items.filter(i => /deactivate|archive/i.test(i))

for (const c of CASES) {
  test.describe(`a ${c.kind} account`, () => {
    test('offers the same actions on the row and on its page', async ({ page }) => {
      await listing(page)
      const row = await rowItems(page, c.row)
      const detail = await detailItems(page, c.id)

      for (const item of c.expect) {
        expect(row, `row: ${item}`).toContain(item)
        expect(detail, `detail: ${item}`).toContain(item)
      }
      /* In one order, and `c.expect` is written in it: the record, then the
         money, then where the account is filed, and taking it out of service
         last. The order is the reader's, not an accident of how the pieces were
         assembled, so it is worth stating. */
      expect(row.filter(i => (c.expect as readonly string[]).includes(i))).toEqual([...c.expect])
      for (const closing of closings(row)) {
        expect(row.indexOf(closing), closing).toBeGreaterThan(row.indexOf(c.expect[c.expect.length - 1]))
      }
      for (const item of c.absent) {
        expect(row, `row: ${item}`).not.toContain(item)
        expect(detail, `detail: ${item}`).not.toContain(item)
      }

      // And nothing else differs: the two lists are equal but for the item the
      // page is allowed to keep to itself.
      expect(detail.filter(i => !DETAIL_ONLY.includes(i))).toEqual(row)
    })

    test(`${c.lifecycle ? 'can' : 'cannot'} be taken out of service, from either page`, async ({ page }) => {
      await listing(page)
      const row = closings(await rowItems(page, c.row))
      const detail = closings(await detailItems(page, c.id))
      expect(row.length > 0).toBe(c.lifecycle)
      expect(detail).toEqual(row)
    })
  })
}

/* Both halves of the one difference, because the parity test above filters the
   item out and so would pass just as well if the page had lost it too. Stating
   where an account started is work done on that account, and the row is for
   reading the chart and picking from it. */
test('keeps Enter opening balance to the account\'s own page', async ({ page }) => {
  await listing(page)
  expect(await rowItems(page, 'Operating - Chase Bank')).not.toContain('Enter opening balance')
  expect(await detailItems(page, 'acct_11130')).toContain('Enter opening balance')
})

/* Delete is not on every row - it exists only while nothing has posted to the
   account, which is the rule `canDeleteAccount` states. What is pinned is that
   the rule decides it rather than the page: an account offering Delete on its
   own page and not on its row is how a reader concludes one of the two is lying
   about what has posted. Read off the summary, which the seed leaves empty. */
test('offers Delete on the same rule on both pages', async ({ page }) => {
  await listing(page)
  const row = await rowItems(page, 'Short-Term Investments')
  const detail = await detailItems(page, 'acct_11200')
  expect(detail.includes('Delete account')).toBe(row.includes('Delete account'))
})

/* The status chip is a second way into the lifecycle, so it has to answer the
   same way the menu does. On a category row it now answers nothing: the chip is
   a chip, and every state it used to offer led to the same refusal. */
test('leaves a category row a status chip with nothing behind it', async ({ page }) => {
  await listing(page)
  // Matched on the shape, not the tag, because the tag is now part of the answer:
  // a chip that opens the lifecycle is a button, and one that only states it stays
  // a span - so no Tab stop is spent on a control that refuses everything.
  const chip = (rowText: string) => page.locator('tbody tr', { hasText: rowText }).first()
    .locator('.rounded-full', { hasText: /^(Active|Inactive|Archived)$/ }).first()

  await expect(chip('ASSETS')).toBeVisible()
  await expect(chip('ASSETS')).not.toHaveClass(/cursor-pointer/)
  await expect(chip('ASSETS')).toHaveJSProperty('tagName', 'SPAN')
  // A row that does have a lifecycle still opens one, so this is a gate rather
  // than the control having been dropped.
  await expect(chip('Short-Term Investments')).toHaveClass(/cursor-pointer/)
  await expect(chip('Short-Term Investments')).toHaveJSProperty('tagName', 'BUTTON')
})
