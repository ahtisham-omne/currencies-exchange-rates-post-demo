import { test, expect, type Page } from '@playwright/test'

/* Mahad, 2026-09-22: *"Please make sure we use the exact same behavior and the
   exact same sizing when the widgets a resized to small, medium, and large as
   partners management module."*

   The summary account's widgets had no size toggle at all - a fixed two-column
   grid with the trend pinned at 184px. This pins the ported behaviour in a
   browser because every claim it makes is a claim about paint: the card takes
   half the row at Small and Medium and the whole row at Large, and the donut's
   ring is drawn at a fixed square, so only a measured radius can tell Small from
   Medium. Markup shows none of it. */

const CARD = 'div.rounded-xl.border'
const TREND = 'Total running balance trend'
const PIE = 'Running Balance by account'

const card = (page: Page, title: string) => page.locator(CARD).filter({ hasText: title }).first()

async function openSummary(page: Page) {
  await page.goto('/chart-of-accounts')
  await page.getByText('Current Assets', { exact: true }).first().click()
  await expect(card(page, TREND)).toBeVisible()
  await expect(card(page, PIE)).toBeVisible()
  await settledRing(page, PIE)
}

/** The ring sweeps in from nothing, and sweeps again whenever its radius changes,
 *  so a single read catches it mid-flight. Poll until two reads agree. */
async function settledRing(page: Page, title: string) {
  let last = -1
  for (let i = 0; i < 40; i++) {
    const w = await ringWidth(page, title)
    if (w > 0 && w === last) return w
    last = w
    await page.waitForTimeout(100)
  }
  return last
}

/** The size toggle only exists while the card is hovered, and the first mouse
 *  move into a fresh page doesn't always land, so the hover is made twice. */
async function setSize(page: Page, title: string, size: 'Small' | 'Medium' | 'Large') {
  const c = card(page, title)
  // Somewhere empty first, so the move into the card counts as an entry. Not the
  // top-left corner: the sidebar lives there and expands under the pointer.
  await page.mouse.move(900, 760)
  await c.hover({ position: { x: 20, y: 10 } })
  await c.hover({ position: { x: 24, y: 12 } })
  const btn = c.getByRole('button', { name: `Set widget size ${size}` })
  await expect(btn).toBeVisible()
  // Forced past the chart tooltip, which can sit over the header.
  await btn.click({ force: true })
  await expect(btn).toHaveAttribute('aria-pressed', 'true')
  // The width transition runs 500ms.
  await page.waitForTimeout(700)
}

const widthOf = (page: Page, title: string) => card(page, title).evaluate(el => Math.round(el.getBoundingClientRect().width))
const ringWidth = (page: Page, title: string) =>
  card(page, title).locator('.recharts-pie').evaluate(el => Math.round(el.getBoundingClientRect().width))

test('a summary widget takes half the row until it is set to Large', async ({ page }) => {
  await openSummary(page)

  // Two widgets, side by side, each half the row less the gap.
  const trendMd = await widthOf(page, TREND)
  const pieMd = await widthOf(page, PIE)
  expect(Math.abs(trendMd - pieMd)).toBeLessThanOrEqual(1)

  await setSize(page, TREND, 'Large')
  const trendLg = await widthOf(page, TREND)
  expect(trendLg).toBeGreaterThan(trendMd * 1.8)
  // The one beside it keeps its half and wraps to the next line.
  expect(await widthOf(page, PIE)).toBeCloseTo(pieMd, -1)

  await setSize(page, TREND, 'Small')
  expect(await widthOf(page, TREND)).toBeCloseTo(trendMd, -1)
})

test('the donut is drawn smaller at Small and larger at Large', async ({ page }) => {
  await openSummary(page)

  const md = await settledRing(page, PIE)
  await setSize(page, PIE, 'Small')
  const sm = await settledRing(page, PIE)
  await setSize(page, PIE, 'Large')
  const lg = await settledRing(page, PIE)

  expect(sm).toBeLessThan(md)
  expect(lg).toBeGreaterThan(md)

  /* The hole empties at Small: it is 60px across there and the total runs to
     eleven characters, which spilled over the ring. The stat row states Total at
     every size, so nothing is lost. */
  await setSize(page, PIE, 'Small')
  await expect(card(page, PIE).getByText('TOTAL', { exact: true })).toHaveCount(0)
  await setSize(page, PIE, 'Medium')
  await expect(card(page, PIE).getByText('Total', { exact: true }).first()).toBeVisible()
})

test('the chosen size survives a reload', async ({ page }) => {
  await openSummary(page)
  const before = await widthOf(page, TREND)
  await setSize(page, TREND, 'Large')

  await page.reload()
  await expect(card(page, TREND)).toBeVisible()
  await page.waitForTimeout(500)
  expect(await widthOf(page, TREND)).toBeGreaterThan(before * 1.8)
})
