import { test, expect, type Page } from '@playwright/test'

/* A hover hint has to leave when the pointer does, and React cannot work that
   out on its own here. It computes mouseleave over its own component tree, and
   anything the wrapped control portals out - an open dropdown panel, a calendar
   - is still a React descendant of the tooltip however far from it the panel
   actually sits. So moving the pointer onto that panel was not a leave, and a
   panel that unmounts under the pointer never delivered one at all: the hint
   stayed on screen with nothing beneath it.

   None of that is visible to a source-text test. The bug is where the pointer
   is versus where the DOM says it is, so it is pinned in a browser. */

// The chart's period hint, in Mahad's copy of 2026-10-11.
const HINT = 'The accounting period this page reports on'

// The plain hint and a rich card are different nodes: a plain hint is a <span>
// that never takes the pointer, a rich card is a <div> that does.
const hint = (page: Page) => page.locator('body > span.fixed').filter({ hasText: HINT })
const trigger = (page: Page) => page.getByRole('button', { name: 'Change accounting period' })

// Somewhere on the page with nothing under it.
const AWAY = { x: 700, y: 700 }

test.beforeEach(async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  // The KPI cards land after the table and push it down the page, so a hover
  // aimed before that lands on whatever slid into its place.
  await expect(trigger(page)).toBeVisible()
  await page.waitForTimeout(1000)
})

test.describe('a hover hint follows the pointer', () => {
  test('waits for the hover to be sustained', async ({ page }) => {
    /* The period strip asks for a 600ms delay: dragging past it to reach the
       filters bar should not pop its explanation over the row the reader was
       heading for. The delay helpers existed but only the rich branch used
       them, so every plain hint in the module opened on contact. */
    await expect(hint(page)).toHaveCount(0)

    await trigger(page).hover()
    await page.waitForTimeout(150)
    await expect(hint(page)).toHaveCount(0)

    await expect(hint(page)).toHaveCount(1, { timeout: 2000 })
  })

  test('goes away when the pointer moves off', async ({ page }) => {
    await trigger(page).hover()
    await expect(hint(page)).toHaveCount(1, { timeout: 2000 })

    await page.mouse.move(AWAY.x, AWAY.y)
    await expect(hint(page)).toHaveCount(0)
  })

  test('goes away when the pointer moves onto the panel the control opened', async ({ page }) => {
    // The panel is portalled to <body>, nowhere near the trigger in the DOM,
    // but it is the trigger's React child - which is what fooled React.
    await trigger(page).hover()
    await expect(hint(page)).toHaveCount(1, { timeout: 2000 })
    await trigger(page).click()

    const panel = page.locator('body > div').filter({ hasText: 'Fiscal year' }).last()
    const box = (await panel.boundingBox())!
    await page.mouse.move(box.x + box.width - 60, box.y + box.height - 30)

    await expect(hint(page)).toHaveCount(0)
  })

  test('goes away when the panel closes under the pointer', async ({ page }) => {
    /* The worst case: the panel unmounts beneath a stationary pointer, so no
       further pointer event is coming and nothing is left to leave. The hint
       was stranded over a page the reader had already moved on from. */
    await trigger(page).hover()
    await expect(hint(page)).toHaveCount(1, { timeout: 2000 })
    await trigger(page).click()

    const panel = page.locator('body > div').filter({ hasText: 'Fiscal year' }).last()
    await panel.getByText('Month', { exact: true }).click()

    await expect(hint(page)).toHaveCount(0)
  })

  test('lets the pointer move onto a rich card without dismissing it', async ({ page }) => {
    /* A rich hint is a card, not a label, and it sits a gap away from the thing
       that opens it. The document-level watch that fixes the cases above must not
       count the card itself as somewhere else, or the card would vanish as it is
       reached.

       Opened from a foreign-currency balance, which is where the chart's rich
       cards live now. This used to hover the GL account type column header, back
       when its hint compared both types; that header carries a plain one-line
       `info` today, so the card the test waited for could never appear. */
    // The marker icon is what separates the two kinds of hint in a cell: a plain
    // one-liner hangs off bare text, a rich card off the balance that carries a
    // currency marker beside it.
    const cell = page.locator('td span.cursor-help').filter({ has: page.locator('svg') }).first()
    await cell.hover()

    const card = page.locator('body > div.fixed.w-max').filter({ hasText: 'Booked in' }).first()
    await expect(card).toBeVisible()

    const box = (await card.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await expect(card).toBeVisible()
  })
})
