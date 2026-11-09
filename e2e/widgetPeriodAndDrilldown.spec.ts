import { test, expect, type Page } from '@playwright/test'

/* Two claims about a posting account's widget row that only a browser can
   settle: a period control that has to offer months rather than days, and a
   footer that has to answer the bar the reader just clicked. Mahad, 2026-09-22. */

const ACCOUNT = 'Operating - Chase Bank'

// A widget card, found by the title it carries rather than by its position in
// the row - the row is reorderable, so position is not an identity.
const cardFor = (page: Page, title: string) =>
  page.locator('div.rounded-xl.border.bg-white')
    .filter({ has: page.getByText(title, { exact: true }) })
    .first()

async function openAccount(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1400 })
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByText(ACCOUNT, { exact: true }).first().click()
  await page.getByText('Posting activity', { exact: true }).first().waitFor()
}

/* *"For these two widgets, there should be 3 months, 6 months, 12months, and
   custom."* Both chart one figure per accounting period, so a window measured in
   days was cutting a series it could never line up with. */
test('windows the per-period trends in months', async ({ page }) => {
  await openAccount(page)
  for (const title of ['Closing balance trend', 'Net change trend']) {
    const card = cardFor(page, title)
    for (const p of ['3m', '6m', '12m', 'Custom']) {
      await expect(card.getByRole('button', { name: p, exact: true }), `${title} offers no ${p}`).toBeVisible()
    }
    // The day presets these replaced. A window that no longer exists must not
    // still be offered beside the ones that do.
    for (const p of ['90d', '365d', 'All']) {
      await expect(card.getByRole('button', { name: p, exact: true }), `${title} still offers ${p}`).toHaveCount(0)
    }
    await expect(card).toContainText('Last 12 months')
  }
})

/* *"in custom, make sure we provide users months, not dates as this KPI will be
   filtered by months."* A calendar here offers a precision the chart then rounds
   away, so the picker is a grid of months and the label it writes back names
   months too. */
test('asks for months, not days, in the custom range', async ({ page }) => {
  await openAccount(page)
  const card = cardFor(page, 'Closing balance trend')
  await card.getByRole('button', { name: 'Custom', exact: true }).click()

  const panel = page.locator('[data-coa-month-range]')
  await panel.waitFor()
  await panel.getByRole('button', { name: 'Mar', exact: true }).click()
  await panel.getByRole('button', { name: 'Jun', exact: true }).click()
  await panel.getByRole('button', { name: 'Apply', exact: true }).click()

  // The range reads back as the months that were picked, not the days they span.
  await expect(card).toContainText(/Mar \d{4} – Jun \d{4}/)
})

/* *"as soon as we click on any of the bar graphs or bars ... the entry coming in
   replaces the 'total debits', 'total credits', and 'net' written below"* - and
   *"is there a way we can indicate to the user somewhere that clicking will
   reveal this details? I think there's a small opportunity on the right side"*. */
test('answers the clicked bar in the footer that stated the totals', async ({ page }) => {
  await openAccount(page)
  const card = cardFor(page, 'Posting activity')

  // At rest the footer states the window, and the right of that row says what a
  // click would do - the widget's second half is otherwise unadvertised.
  await expect(card).toContainText('Total debits')
  await expect(card).toContainText('Click a bar for its entries')

  /* Clicked by coordinate, so the bar has to be settled and on screen first: the
     card is scrolled to, then the bars are given their grow-in animation, which
     remounts each rectangle under a new key while it runs. */
  await card.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1500)
  const bar = card.locator('.recharts-bar-rectangle').nth(3)
  const bb = (await bar.boundingBox())!
  await page.mouse.click(bb.x + bb.width / 2, bb.y + 5)

  const panel = card.locator('.coa-entry-panel-in')
  await panel.waitFor()
  // Same three slots, now scoped to the bar: "Total" is what drops away.
  await expect(card).not.toContainText('Total debits')
  await expect(card).toContainText('Back to totals')
  await expect(card).not.toContainText('Click a bar for its entries')
  // The panel names the bucket it opened for, and the footer is now that bucket's.
  expect((await panel.innerText()).split('\n')[0].trim().length).toBeGreaterThan(0)

  await card.getByRole('button', { name: 'Back to totals' }).click()
  await expect(card).toContainText('Total debits')
  await expect(card.locator('.coa-entry-panel-in')).toHaveCount(0)
})

/* Mahad, 2026-10-15: *"show the top five most recent entries, and for the rest,
   there should be a link ... clicking it redirects to the Transactions tab,
   applies the same date range filter, and displays all the transactions."* */
test('shows a bar\'s five newest entries, and hands the rest to the Transactions tab', async ({ page }) => {
  await openAccount(page)
  const card = cardFor(page, 'Posting activity')
  await card.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1500)
  // The busiest bar, so there is more than five to hand over.
  const bars = card.locator('.recharts-bar-rectangle')
  const heights = await bars.evaluateAll(els => els.map(e => e.getBoundingClientRect().height))
  const bar = bars.nth(heights.indexOf(Math.max(...heights)))
  const bb = (await bar.boundingBox())!
  await page.mouse.click(bb.x + bb.width / 2, bb.y + 5)

  const panel = card.locator('.coa-entry-panel-in')
  await panel.waitFor()
  const total = Number((await panel.getByText(/^\d+ entr(y|ies)$/).innerText()).split(' ')[0])
  expect(total).toBeGreaterThan(5)
  const rows = panel.locator('button[title^="Quick view"]')
  await expect(rows).toHaveCount(5)
  // Newest first.
  const dates = await panel.locator('span.tabular-nums.ml-auto').allInnerTexts()
  const days = dates.map(d => +new Date(d))
  expect([...days].sort((a, b) => b - a)).toEqual(days)
  await expect(panel).not.toContainText('more in this bar')
  await panel.screenshot({ path: '/private/tmp/claude-501/-Users-mahad-Documents-Chart-of-Accounts-chart-of-accounts-v2-1/2c6fbcd7-160c-43c6-ac48-a99e1668ca44/scratchpad/activity-panel.png' })

  await panel.getByRole('button', { name: `View all ${total} entries` }).click()
  // The Transactions tab, on the bar's dates, listing exactly the bar's entries.
  await expect(page.getByPlaceholder('Search transactions')).toBeVisible()
  await expect(page.getByText(new RegExp(`^${total} of \\d+ transactions?$`))).toBeVisible()
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-mahad-Documents-Chart-of-Accounts-chart-of-accounts-v2-1/2c6fbcd7-160c-43c6-ac48-a99e1668ca44/scratchpad/activity-handoff.png', clip: { x: 60, y: 120, width: 1540, height: 260 } })

  // Picking the tab by hand opens it on its own default again.
  await page.getByRole('button', { name: 'Dashboard', exact: true }).first().click()
  await page.getByRole('button', { name: /^Transactions/ }).first().click()
  await expect(page.getByText('Last 30 days').first()).toBeVisible()
})
