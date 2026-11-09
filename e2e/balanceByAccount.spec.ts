import { test, expect, type Page } from '@playwright/test'

/* Mahad, 2026-09-22, on the account detail donut: *"There is a scroll inside the
   widget and when you hover over a specific one that area in the pie is
   heighlighted. Also, the percentages dont make any sense, we need acctual
   numbers (money) to be displayed there. I dont think we need to show a '+' with
   the positive values."*

   Pinned in a browser because the highlight is a hover that repaints an SVG
   sector, and the list only scrolls once it overflows - neither is visible to a
   source test. The figures are left unasserted on purpose: the seeded postings
   are drawn across a span that ends today, so any amount pinned here rots. What
   is asserted is the shape - that a row states money at all, and that the sector
   grows under the pointer. */

const BIG_SUMMARY = '/chart-of-accounts/acct_10000'   // ASSETS: 40 posting accounts, so the legend overflows

const legend = (page: Page) => page.locator('ul').filter({ hasText: 'Buildings' }).first()

// Painted area of each pie sector. The highlighted one is drawn at a larger
// outer radius, so its area is what changes under a hover - the fill and the
// path data stay otherwise the same.
const sectorAreas = (page: Page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('.recharts-pie path')).map((p) => {
    const b = (p as SVGGraphicsElement).getBBox()
    return Math.round(b.width * b.height)
  }))

/* Put the pointer on the nth sector. A sector is an arc, so most of its bounding
   box is elsewhere in the ring - Playwright's own hover aims at the box's centre
   and lands on the SVG instead. This walks the box for a point the browser
   agrees belongs to that path. */
async function hoverSector(page: Page, n: number) {
  const pt = await page.evaluate((i) => {
    const path = Array.from(document.querySelectorAll('.recharts-pie path'))[i]
    if (!path) return null
    const r = path.getBoundingClientRect()
    for (let fy = 0.5; fy <= 24; fy++) for (let fx = 0.5; fx <= 24; fx++) {
      const x = r.x + (r.width * fx) / 24, y = r.y + (r.height * fy) / 24
      if (document.elementFromPoint(x, y) === path) return { x, y }
    }
    return null
  }, n)
  if (!pt) throw new Error(`no hoverable point on sector ${n}`)
  await page.mouse.move(pt.x, pt.y)
}

const litRows = (page: Page) => page.evaluate(() => {
  const ul = Array.from(document.querySelectorAll('ul')).find(u => u.className.includes('overflow-y-auto'))
  return Array.from(ul?.children ?? []).flatMap((li, i) => li.className.includes('bg-slate-50') ? [i] : [])
})

test('every legend row states an amount, not only a share', async ({ page }) => {
  await page.goto(BIG_SUMMARY, { waitUntil: 'networkidle' })
  await expect(legend(page)).toBeVisible()

  const rows = await legend(page).locator('li').allInnerTexts()
  expect(rows.length).toBeGreaterThan(1)
  for (const r of rows) {
    // A share on its own is what Mahad could not read: it says nothing that can be
    // checked against the total in the ring or the KPIs above it.
    expect(r, r).toMatch(/-?\$ [\d,]+/)
    expect(r, r).toMatch(/\d%/)
  }
})

test('the legend scrolls rather than growing the card', async ({ page }) => {
  await page.goto(BIG_SUMMARY, { waitUntil: 'networkidle' })
  await expect(legend(page)).toBeVisible()

  const box = await legend(page).evaluate((ul) => ({ shown: ul.clientHeight, whole: ul.scrollHeight }))
  expect(box.whole).toBeGreaterThan(box.shown)
})

test('hovering a legend row pushes its slice out of the ring', async ({ page }) => {
  await page.goto(BIG_SUMMARY, { waitUntil: 'networkidle' })
  await expect(legend(page)).toBeVisible()

  /* The ring sweeps in from nothing, so a read taken while it is still drawing
     sees every slice grow afterwards. Wait for two reads to agree first. */
  let before = await sectorAreas(page)
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(100)
    const again = await sectorAreas(page)
    if (JSON.stringify(again) === JSON.stringify(before)) break
    before = again
  }
  await legend(page).locator('li').nth(2).hover()
  await page.waitForTimeout(300)
  const after = await sectorAreas(page)

  expect(after[2]).toBeGreaterThan(before[2])
  // And only that one - a ring where every slice grew would be a redraw, not a highlight.
  expect(after.filter((a, i) => a > before[i])).toHaveLength(1)
})

test('hovering a slice lights its row, and brings it into view if it is scrolled off', async ({ page }) => {
  await page.goto(BIG_SUMMARY, { waitUntil: 'networkidle' })
  await expect(legend(page)).toBeVisible()
  expect(await litRows(page)).toEqual([])

  const rows = await legend(page).locator('li').count()
  expect(rows).toBeGreaterThan(12)
  expect(await legend(page).evaluate(ul => ul.scrollTop)).toBe(0)

  /* Six rows fit, so the tenth starts well below the fold. Not the last one:
     every account has its own slice now, and the smallest are sub-degree arcs
     with nowhere to put a pointer. */
  const off = 10
  await hoverSector(page, off)
  await page.waitForTimeout(300)

  expect(await litRows(page)).toEqual([off])
  expect(await legend(page).evaluate(ul => ul.scrollTop), 'the list came to the row').toBeGreaterThan(0)
  // The page itself stays put - only the list inside the card moved.
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
})

test('a positive balance is stated without a leading plus', async ({ page }) => {
  // 6530 carries an opening of 3,200 and has never been posted to, so its
  // Running balance and Opening balance tiles both print a positive figure.
  await page.goto('/chart-of-accounts/acct_53020', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: /loss on sale of assets/i })).toBeVisible()

  // Nothing stands between the label and the figure: the tile used to read
  // "Running balance" over "+$ 3,200".
  const tile = page.locator('div.rounded-lg').filter({ has: page.getByText('Running balance', { exact: true }) }).last()
  await expect(tile).toContainText(/Running balance\$ [\d,]+/)

  const text = await page.locator('body').innerText()
  expect(text.match(/\+\$/g) ?? [], 'no figure carries a "+"').toHaveLength(0)
})

test('the general ledger states its running balances without a plus either', async ({ page }) => {
  await page.goto('/general-ledger', { waitUntil: 'networkidle' })
  await expect(page.getByRole('columnheader').filter({ hasText: 'Running balance' }).first()).toBeVisible()

  const text = await page.locator('body').innerText()
  expect(text.match(/\+\$/g) ?? [], 'no figure carries a "+"').toHaveLength(0)
})
