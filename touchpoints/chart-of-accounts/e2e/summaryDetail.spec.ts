import { test, expect, type Page } from '@playwright/test'

/* Three claims about what a summary account's page puts on screen, all of them
   claims only a browser can settle: a figure that has to agree with another
   figure, a chip row that has to survive a narrow column, and a fact that has to
   be present rather than merely seeded. Mahad, 2026-09-21. */

const SUMMARY = 'Cash and Cash Equivalents'

async function openSummary(page: Page, width = 1600) {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.getByText(SUMMARY, { exact: true }).first().click()
  await page.getByText('Running Balance by account').first().waitFor()
}

/* *"The current running balance should match the total in the balance by
   account."* The widget used to compact the figure to fit the donut's hole, so
   the same total read $1.9M there and $1,927,800 in the KPI a few inches above -
   two figures a reader has to reconcile before trusting either. */
// The widget's own text: its title down to the field rail underneath it.
const widgetText = (body: string) =>
  body.split('Running Balance by account')[1].split('GL account information')[0]

test('states one total, the same way, everywhere on the page', async ({ page }) => {
  await openSummary(page)
  const body = await page.locator('body').innerText()
  const money = /\$\s?[\d,.]+[KM]?/g
  const kpi = body.split('Total running balance')[1].match(money)![0].replace(/\s/g, '')

  /* Both places the widget states its own total: the figure in the donut's hole
     and the Total stat under it. Taken off the two "Total" labels rather than off
     the widget's whole text, because the legend beside the ring states a balance
     per account - those are other figures answering another question. */
  const figures = new Set(await page.getByText('Total', { exact: true })
    .evaluateAll(els => els.map(el => (el.parentElement?.innerText ?? '').match(/\$\s?[\d,.]+[KM]?/)?.[0] ?? '')
      .map(s => s.replace(/\s/g, ''))))
  expect(figures.size, `widget states ${[...figures].join(' and ')}`).toBe(1)
  // A compacted $1.9M would land here as a second figure, which is the shape
  // this took: the same total written two ways on one screen.
  expect([...figures][0]).toBe(kpi)
})

// *"Also remove largest from this widget."* The legend already reads
// largest-first in the primary colour, so a stat repeating its number said the
// same thing worse.
test('names no largest account beside the total', async ({ page }) => {
  await openSummary(page)
  const widget = widgetText(await page.locator('body').innerText())
  expect(widget).toContain('Posting accounts')
  expect(widget).not.toContain('Largest')
})

/* *"Prior account number should be there for imported accounts. Remove 'No
   number of its own'."* An account that arrived by import arrived as something.

   One of them. Mahad, 2026-09-22: *"prior account number is always one number
   that was imported."* This summary used to stack every old header it answers
   for; the statement that landed is the one it keeps, and the rest are named as
   folded into it on the review grid. */
test('shows an imported account the one number it arrived as', async ({ page }) => {
  await openSummary(page)
  const body = await page.locator('body').innerText()
  expect(body).toContain('Prior account number')
  expect(body).not.toContain('Prior account numbers')
  expect(body).not.toContain('No number of its own')
  // The old chart's four-digit codes; read as whole numbers, so 11010 cannot pass for 1010.
  expect(body).toMatch(/\b1010\b/)
  for (const dropped of [/\b1020\b/, /\b1030\b/]) expect(body).not.toMatch(dropped)
})

/* *"when I load this page, for some reason the pie chart animation is no more.
   Can we bring that back please?"* The ring had stopped sweeping in, and nothing
   in this repo said so: the prop was still `isAnimationActive`, and Recharts
   chose its static branch silently. The cause is a re-render after mount handing
   the Pie a new animationId, which it reads as "the data moved" and answers by
   comparing the sectors it already drew against the ones it is about to draw -
   finding them equal, it draws them once. Any prop that loses its identity
   between renders is enough to trigger that, so this is asserted on the only
   evidence that cannot be faked: the sector's own geometry, sampled every frame
   from before the page is opened. */
test('sweeps the ring in on load', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })

  await page.evaluate(() => {
    const seen = new Set<string>()
    let frames = 0
    const tick = () => {
      const p = document.querySelector('.recharts-pie path.recharts-sector')
      if (p) seen.add(p.getAttribute('d') || '')
      // Enough frames to cover the mount and the 700ms sweep, and few enough
      // that the loop is always finished before the assertion reads it.
      if (++frames < 300) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    ;(window as any).__sectorPaths = seen
  })

  await page.getByText(SUMMARY, { exact: true }).first().click()
  await page.getByText('Running Balance by account').first().waitFor()
  await page.waitForTimeout(2500)

  const distinct = await page.evaluate(() => (window as any).__sectorPaths.size as number)
  // A ring that is drawn once holds exactly one geometry for its whole life.
  expect(distinct, 'the first sector never changed shape, so the ring was drawn static').toBeGreaterThan(1)
})

/* *"I dont think the badge should cut off. Keep the badge as is in smaller
   screens. You can trunkate the Bold text next to it only."* On the Accounts tab
   the category badge shares the pinned name column with the account name, and a
   flex item that may shrink and clips its overflow will: the badge read "Asse",
   which names no category at all. Measured rather than eyeballed, at the widths
   that squeezed it. */
test('keeps the category badge whole and truncates the name instead', async ({ page }) => {
  for (const width of [1600, 1280, 1024]) {
    await openSummary(page, width)
    await page.getByRole('button', { name: /^Accounts$/ }).first().click()
    await page.locator('span.inline-flex.items-stretch').first().waitFor()
    const measured = await page.evaluate(() => {
      const badge = Array.from(document.querySelectorAll('td span.inline-flex.items-stretch'))
        .find(b => /^(Asset|Liability|Equity|Revenue|Expense)$/.test((b.textContent || '').trim())) as HTMLElement | undefined
      if (!badge) return null
      // The name is a button where the row opens and a span where it does not, so
      // it is found by being the cell's own truncating child rather than by tag.
      const name = badge.parentElement?.querySelector(':scope > .truncate') as HTMLElement | null
      return {
        label: (badge.textContent || '').trim(),
        clipped: badge.scrollWidth > badge.clientWidth + 1,
        nameTruncates: !!name && name.scrollWidth > name.clientWidth + 1,
      }
    })
    expect(measured, `no category badge in the name cell at ${width}px`).not.toBeNull()
    expect(measured!.clipped, `badge "${measured!.label}" cut off at ${width}px`).toBe(false)
    // The squeeze has to land somewhere, and the name is where it was asked to.
    expect(measured!.nameTruncates, `nothing truncated at ${width}px, so the cell was never squeezed`).toBe(true)
  }
})
