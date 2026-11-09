import { test, expect, type Page } from '@playwright/test'

/* Mahad, 2026-11-03: the account's Transactions tab scrolls as the Journal
   entries tab does - no pages, fifty postings drawn on arrival, the next fifty as
   the reader scrolls down, never more than a hundred at once; a block scrolled
   past leaves the DOM and comes back on the way up - and none of it may jerk the
   rows on screen. Here it is the page that scrolls, not the table's own frame. */

const ROWS = 'tbody tr[data-tree-account]'

async function register(page: Page) {
  await page.goto('/chart-of-accounts/acct_11130', { waitUntil: 'networkidle' })
  await page.getByText('Transactions', { exact: true }).first().click()
  await page.locator(ROWS).first().waitFor()
  await page.getByRole('button', { name: /^Last 30 days/ }).first().click()
  await page.getByText('All time', { exact: true }).last().click()
  await expect(page.getByText(/^768 of 768 transactions$/)).toBeVisible()
  await page.locator(ROWS).nth(49).waitFor()
}

/* Whatever scrolls the table, then two frames for the scroll handler and the
   render. Returns where the scroll stands after them: the page's scroll anchoring
   would quietly move it to hide a spacer of the wrong height, so a test of
   stillness has to check it stayed put as well as that the rows did. */
const scrollTo = (page: Page, top: number) => page.locator(ROWS).first().evaluate(async (row, y) => {
  let sp: HTMLElement | null = row.parentElement
  while (sp && !(/(auto|scroll)/.test(getComputedStyle(sp).overflowY) && sp.scrollHeight > sp.clientHeight + 1)) sp = sp.parentElement
  if (sp) sp.scrollTop = y
  else window.scrollTo(0, y)
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  return sp ? sp.scrollTop : window.scrollY
}, top)
const scrollHeight = (page: Page) => page.locator(ROWS).first().evaluate(row => {
  let sp: HTMLElement | null = row.parentElement
  while (sp && !(/(auto|scroll)/.test(getComputedStyle(sp).overflowY) && sp.scrollHeight > sp.clientHeight + 1)) sp = sp.parentElement
  return sp ? sp.scrollHeight : document.documentElement.scrollHeight
})
// Each drawn posting by its entry number and date, with where it sits on screen.
const onScreen = (page: Page) => page.locator(ROWS).evaluateAll(rows =>
  rows.map(r => [(r as HTMLElement).innerText.replace(/\s+/g, ' ').slice(0, 80), r.getBoundingClientRect().top] as const))

test('has no pages', async ({ page }) => {
  await register(page)
  await expect(page.getByText('Records per page')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Next/ })).toHaveCount(0)
})

test('draws fifty on arrival, never more than a hundred, and brings the first fifty back on the way up', async ({ page }) => {
  await register(page)
  const first = (await onScreen(page)).map(([t]) => t)
  expect(first).toHaveLength(50)
  const height = await scrollHeight(page)
  let leftTheTop = false
  for (let y = 0; y < height; y += 700) {
    await scrollTo(page, y)
    const drawn = (await onScreen(page)).map(([t]) => t)
    expect(drawn.length).toBeLessThanOrEqual(100)
    if (!drawn.includes(first[0])) leftTheTop = true
  }
  expect(leftTheTop).toBe(true)
  await scrollTo(page, 0)
  expect((await onScreen(page)).map(([t]) => t).slice(0, 50)).toEqual(first)
})

test('holds the rows still as blocks come and go', async ({ page }) => {
  await register(page)
  const height = await scrollHeight(page)
  /* Clear of the top of the page: the account's header shrinks once the page is
     scrolled at all, which moves every row by itself. Let it settle first. */
  await scrollTo(page, 400)
  await page.waitForTimeout(400)
  const step = 333
  const stops = [...Array(40).keys()].map(i => 400 + i * step).filter(y => y < height - 2000)
  expect(stops.length).toBeGreaterThan(10)
  const pairs = [...stops.slice(1).map((y, i) => [stops[i], y]), ...stops.slice(1).reverse().map((y, i, a) => [y, a[i + 1] ?? 400])]
  for (const [from, to] of pairs) {
    await scrollTo(page, from)
    const before = new Map(await onScreen(page))
    expect(Math.abs(await scrollTo(page, to) - to), `scrolled to ${to}`).toBeLessThanOrEqual(1)
    const after = new Map(await onScreen(page))
    const shared = [...before.keys()].filter(k => after.has(k))
    expect(shared.length).toBeGreaterThan(0)
    for (const k of shared) expect(Math.abs(after.get(k)! - (before.get(k)! - (to - from))), `${from} to ${to}`).toBeLessThanOrEqual(1)
  }
})

test('holds the columns still as blocks come and go', async ({ page }) => {
  await register(page)
  const widths = () => page.locator('thead th[data-tx-col]').evaluateAll(ths => ths.map(t => Math.round(t.getBoundingClientRect().width)))
  const height = await scrollHeight(page)
  let prev = await widths()
  for (let y = 700; y < height; y += 700) {
    await scrollTo(page, y)
    const now = await widths()
    now.forEach((w, i) => expect(w).toBeGreaterThanOrEqual(prev[i] - 1))
    prev = now
  }
})
