import { test, expect, type Page, type Locator } from '@playwright/test'

/* Column reorder is Partners' mouse drag since 2026-10-01 (Mahad: *"I dont like
   the UI when you drag the columns, please make it more like partners"*): a chip
   follows the cursor, the dragged header takes a blue wash and a top bar, and
   the column moves live as the pointer crosses a neighbour. It used to be HTML5
   drag-and-drop, which jsdom cannot fake and which once died at dragstart - so
   every assertion below is still downstream of a real drag in a real browser.

   Run with `npx playwright test`, against the dev server on :8080. */

const headers = (page: Page) =>
  page.$$eval('thead tr th', ths =>
    ths.map(t => t.innerText.trim().split('\n')[0]).filter(Boolean))

/* The chart is wider than any window, so a header can sit past the right edge -
   or worse, underneath the pinned Actions column, which is where the mouse would
   land instead. Neither raises an error: the drag simply happens somewhere else
   and the test passes having proved nothing. So every drag measures first and
   says so.

   The two pinned columns bracket the reachable zone: Actions is stuck to the
   right edge, so anything at or beyond its left edge is unreachable however wide
   the window is. */
async function grabbable(page: Page, th: Locator, what: string) {
  const box = (await th.boundingBox())!
  const actions = (await page.locator('thead th').last().boundingBox())!
  const centre = box.x + box.width / 2
  expect(box, `${what} has no box`).toBeTruthy()
  expect(centre, `${what} is off the right edge of the window`).toBeLessThan(page.viewportSize()!.width)
  expect(centre, `${what} sits under the pinned Actions column`).toBeLessThan(actions.x)
  return box
}

/* A person's drag: press on the header, move off it far enough for the browser
   to call it a drag, travel to the target, release. `dragTo` would do this in
   one hop, which is worth avoiding - the bug was in the frames between the
   press and the first dragover, and a single hop can skip straight past them. */
async function dragHeader(page: Page, from: Locator, to: Locator, names = ['source', 'target']) {
  const a = await grabbable(page, from, names[0])
  const b = await grabbable(page, to, names[1])
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2 - 24, a.y + a.height / 2, { steps: 5 })
  /* A little past the target's middle, toward its far side: a column swaps once
     the pointer crosses the middle of the one it is over (tableColumns, Mahad
     2026-10-13), and dead on the middle is a coin toss on sub-pixel rounding. */
  const past = b.x > a.x ? 8 : -8
  await page.mouse.move(b.x + b.width / 2 + past, b.y + b.height / 2, { steps: 15 })
  await page.mouse.up()
}

// The chip that follows the cursor while a header is dragged.
const ghost = (page: Page) => page.locator('[data-drag-ghost]')

test.describe('the chart listing reorders its columns by dragging a header', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chart-of-accounts')
    await page.waitForSelector('thead th')
  })

  test('carries Partners\' chip with the cursor, naming the column, and drops it on release', async ({ page }) => {
    const col = page.locator('thead th', { hasText: 'GL account type' }).first()
    const a = await grabbable(page, col, 'GL account type')
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await page.mouse.down()
    await page.mouse.move(a.x + a.width / 2 - 24, a.y + a.height / 2, { steps: 5 })
    await expect(ghost(page)).toHaveText('GL account type')
    await expect(ghost(page)).toHaveAttribute('data-drag-ghost', 'move')
    // Partners' chip: a blue edge, the label in the brand blue, not uppercased.
    expect(await ghost(page).evaluate(el => [getComputedStyle(el).borderTopColor, getComputedStyle(el).textTransform])).toEqual(['rgba(10, 119, 255, 0.3)', 'none'])
    await page.mouse.up()
    await expect(ghost(page)).toHaveCount(0)
  })

  test('puts the dragged column where it was dropped', async ({ page }) => {
    const before = await headers(page)
    expect(before.indexOf('GL account type')).toBeGreaterThan(before.indexOf('Statement classification'))

    await dragHeader(page,
      page.locator('thead th', { hasText: 'GL account type' }).first(),
      page.locator('thead th', { hasText: 'Statement classification' }).first(),
      ['GL account type', 'Statement classification'])

    await expect.poll(async () => {
      const h = await headers(page)
      return h.indexOf('GL account type') < h.indexOf('Statement classification')
    }).toBe(true)

    // Moved, not duplicated or dropped: the same columns, reordered.
    expect([...await headers(page)].sort()).toEqual([...before].sort())
  })

  /* The dragged header is washed blue with a 2px bar along its top, Partners'
     way, and both clear on release. */
  test('marks the dragged header while it travels and clears it on release', async ({ page }) => {
    const col = page.locator('thead th', { hasText: 'GL account type' }).first()
    const target = page.locator('thead th', { hasText: 'Statement classification' }).first()
    const a = await grabbable(page, col, 'GL account type')
    const b = await grabbable(page, target, 'Statement classification')

    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await page.mouse.down()
    await page.mouse.move(a.x + a.width / 2 - 24, a.y + a.height / 2, { steps: 5 })
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 })
    const dragged = page.locator('thead th[style*="linear-gradient"]')
    await expect(dragged).toHaveCount(1)
    await expect(dragged).toContainText('GL account type')

    await page.mouse.up()
    await expect(page.locator('thead th[style*="linear-gradient"]')).toHaveCount(0)
  })

  /* Number and Name are pinned and sit outside the draggable set, so the
     columns that scroll cannot be dropped into the frozen zone and displace
     them. The reorder is live, so a header dragged toward Name slides past the
     columns it crosses and stops at the first slot after the pinned pair -
     never inside it. */
  test('leaves the pinned pair where they are', async ({ page }) => {
    const before = await headers(page)
    await dragHeader(page,
      page.locator('thead th', { hasText: 'Statement classification' }).first(),
      page.locator('thead th', { hasText: 'GL account name' }).first(),
      ['Statement classification', 'GL account name'])
    await page.waitForTimeout(200)
    const after = await headers(page)
    expect(after.slice(0, 2)).toEqual(['GL account no.', 'GL account name'])
    expect(after[2]).toBe('Statement classification')
    expect([...after].sort()).toEqual([...before].sort())
  })
})

/* The account register is a second grid on the same shared drag start. It was
   never broken - dragging a header here completed even against the old code,
   which is worth knowing, because it means the chart's failure was not simply
   "the handler is wrong" but that grid's re-render tearing the dragged element
   out from under the browser. Pinned so a change made for the chart cannot
   quietly cost the register the drag it already had. */
test.describe('the account register reorders its columns too', () => {
  test('puts the dragged column where it was dropped', async ({ page }) => {
    // Any posting account with entries will do; 1030 is the seeded operating
    // bank. The register is the tab labelled Transactions.
    await page.goto('/chart-of-accounts/acct_11130')
    await page.getByRole('button', { name: 'Transactions', exact: true }).click()
    await page.waitForSelector('thead th')

    const before = await headers(page)
    expect(before).toContain('Journal entry number')
    expect(before.indexOf('Source')).toBeGreaterThan(before.indexOf('Journal entry number'))

    await dragHeader(page,
      page.locator('thead th', { hasText: 'Source' }).first(),
      page.locator('thead th', { hasText: 'Journal entry' }).first())

    await expect.poll(async () => {
      const h = await headers(page)
      return h.indexOf('Source') < h.indexOf('Journal entry number')
    }).toBe(true)
    expect([...await headers(page)].sort()).toEqual([...before].sort())
  })
})
