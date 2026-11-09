import { test, expect, type Page } from '@playwright/test'

/* The accounting period's two ends are fields, not a sentence of text, so the
   span can be set in place. That makes the strip a control with two ways in, and
   the two have to agree: naming a period fills the ends, and setting an end by
   hand is a span the calendar has no name for, so the picker relabels itself
   "Custom". Both halves are pointer work inside a portalled calendar, which a
   source-text test cannot see at all.

   Nothing here hardcodes a month. The seeded chart opens on whichever period
   covers today, so a spec that named one would start failing on its own. */

const trigger = (page: Page) => page.getByRole('button', { name: 'Change accounting period' })
/* A month row, by the only thing that tells one apart from the pane's other
   buttons: it opens with a month written out in full. The rows used to carry the
   fiscal year too - "Mar FY2026" - and no longer do, so the strip's own label and
   the row naming the same month now agree only on their first three letters. */
const MONTH_ROW = /^(January|February|March|April|May|June|July|August|September|October|November|December)/
const from = (page: Page) => page.getByRole('button', { name: 'Period from' })
const to = (page: Page) => page.getByRole('button', { name: 'Period to' })

// The day-of-month a field is currently showing, from its own text ("Sep 1, 2026").
const dayOf = async (field: ReturnType<typeof from>) =>
  (await field.innerText()).match(/\s(\d{1,2}),/)![1]

// Picks a day in the calendar the field opens. The grid also carries the
// neighbouring months' spill-over days, which are real dates and pickable, so
// the wanted day is matched inside the popover exactly once.
async function pickDay(page: Page, field: ReturnType<typeof from>, day: string) {
  await field.click()
  const cal = page.locator('[data-date-popover]')
  await cal.waitFor()
  await cal.getByRole('button', { name: day, exact: true }).first().click()
  await expect(cal).toBeHidden()
}

test.beforeEach(async ({ page }) => {
  /* Settled, not merely painted: the KPI cards land after the table and push it
     down the page, and a field clicked before that lands on whatever slid into
     its place. */
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('thead th')
  await expect(from(page)).not.toHaveText('Earliest')
})

test.describe('the accounting period states its two ends', () => {
  test('opens on a named period with both ends filled', async ({ page }) => {
    // The default selection is the period covering today, so neither end is the
    // unbounded placeholder and the picker is not showing a hand-picked range.
    await expect(trigger(page)).not.toHaveText('Custom')
    await expect(from(page)).toContainText(/\w+ \d{1,2}, \d{4}/)
    await expect(to(page)).toContainText(/\w+ \d{1,2}, \d{4}/)
  })

  test('relabels itself Custom when the From end is set by hand', async ({ page }) => {
    const end = await to(page).innerText()
    // Mid-month, so it is inside the period on both sides and cannot drag the
    // far end along - this pins the relabel on its own.
    const day = await dayOf(from(page)) === '12' ? '13' : '12'
    await pickDay(page, from(page), day)

    await expect(trigger(page)).toHaveText('Custom')
    await expect(from(page)).toContainText(`${day},`)
    // The end the reader did not touch stays where it was.
    await expect(to(page)).toHaveText(end)
  })

  test('refills both ends when a period is named again', async ({ page }) => {
    await pickDay(page, from(page), '12')
    await expect(trigger(page)).toHaveText('Custom')

    await trigger(page).click()
    const panel = page.locator('body > div').filter({ hasText: 'Fiscal year' }).last()
    await panel.getByText('Month', { exact: true }).click()
    const named = panel.locator('button', { hasText: MONTH_ROW }).first()
    const label = (await named.innerText()).split('\n')[0].trim()
    await named.click()

    // The row names the month, the strip names the month and its fiscal year, so
    // they are checked against each other on the part they still share.
    await expect(trigger(page)).toHaveText(new RegExp(`^${label.slice(0, 3)}`))
    // A named month runs first-to-last, which is the proof the ends were refilled
    // from the period rather than left on the hand-picked range.
    await expect(from(page)).toContainText(' 1,')
  })

  test('leaves a named period alone when its own day is re-picked', async ({ page }) => {
    /* Opening a field and clicking the day it already shows changes nothing, so
       it must not relabel a named period "Custom" and claim a hand-picked span.
       Reaching for a field to check the date is a normal thing to do. */
    const label = await trigger(page).innerText()
    await pickDay(page, from(page), await dayOf(from(page)))

    await expect(trigger(page)).toHaveText(label)
  })

  test('drags the far end rather than inverting the span', async ({ page }) => {
    // A period that ends before it starts covers nothing, and would read as an
    // empty chart rather than as a range typed in the wrong order.
    await pickDay(page, from(page), '20')
    await pickDay(page, to(page), '10')

    await expect(from(page)).toContainText('10,')
    await expect(to(page)).toContainText('10,')
  })
})

/* The tenant carries three fiscal years, so the month list is thirty-odd rows in
   a pane that shows seven. Which seven it opens on is a scroll position, which no
   source-text test can see. */
test.describe('the period list opens where the reader is', () => {
  const panel = (page: Page) => page.locator('body > div').filter({ hasText: 'Fiscal year' }).last()
  const pane = (page: Page, name: string) => panel(page).getByText(name, { exact: true })

  test('shows the period in force without being scrolled to it', async ({ page }) => {
    const label = await trigger(page).innerText()
    await trigger(page).click()
    // In the viewport, not merely in the DOM: the whole list is rendered, and the
    // row for the current month sits at the bottom of it.
    await expect(panel(page).locator('button', { hasText: new RegExp(`^${label.slice(0, 3)}`) })
      .first()).toBeInViewport()
  })

  test('opens the quarter pane on this quarter, though nothing there is chosen', async ({ page }) => {
    /* A reader with a month selected has chosen no quarter, so there is no
       committed row to open on - and the top of the list is three years back. */
    await trigger(page).click()
    await pane(page, 'Quarter').click()
    await expect(panel(page).getByText('Current').first()).toBeInViewport()
  })

  /* Mahad, 2026-09-22: *"We will not be showing future Fiscal Years."* A period the
     books have not reached reads as an empty page, and the months after today are
     defined - a tenant opens its books a year at a time. */
  test('offers nothing the books have not reached yet', async ({ page }) => {
    const label = await trigger(page).innerText()
    await trigger(page).click()
    const last = panel(page).locator('button', { hasText: MONTH_ROW }).last()
    await expect(last).toContainText('Current')
    await expect(last).toHaveText(new RegExp(`^${label.slice(0, 3)}`))
  })
})

/* Mahad, 2026-09-22: *"only the month names ... should be displayed without
   unnecessary extra labels"*, and a Fiscal Year dropdown *"on the top-right
   corner"* offering *"FY 2025, FY 2024, etc."*

   The two halves are one change. Bare month names only tell a reader which March
   they are looking at because the year has moved out of the rows and into a
   control above them, so each half is asserted against the other: the rows carry
   no year, and the dropdown says which year they are. */
test.describe('the month list is filtered to one fiscal year', () => {
  const panel = (page: Page) => page.locator('body > div').filter({ hasText: 'Fiscal year' }).last()
  const fyPicker = (page: Page) => panel(page).getByRole('button', { name: 'Change fiscal year' })

  test('names the months and nothing else', async ({ page }) => {
    await trigger(page).click()
    const rows = panel(page).locator('button', { hasText: MONTH_ROW })
    /* Twelve at most, where the whole tenant is thirty-odd: the pane is showing
       one year, not all of them under a new label. Floored as well as capped -
       a locator that matches nothing satisfies "at most twelve", and did, until
       the row text turned out to run straight into the range beside it. */
    const n = await rows.count()
    expect(n).toBeGreaterThan(1)
    expect(n).toBeLessThanOrEqual(12)
    for (const r of await rows.all()) {
      await expect(r).not.toContainText('FY')
    }
  })

  test('says which year, opposite the heading', async ({ page }) => {
    await trigger(page).click()
    await expect(fyPicker(page)).toHaveText(/FY\d{4}/)
  })

  test('steps back a year and lists that year instead', async ({ page }) => {
    await trigger(page).click()
    const opened = await fyPicker(page).innerText()
    await fyPicker(page).click()
    /* The year before the one in force - the list is newest first, so it is the
       row after the current one. Found by accessible name, which is the one thing
       that separates an option from the trigger above it: the trigger is labelled
       for what it does, the options for the year they name. */
    const older = panel(page).getByRole('button', { name: /^FY\d{4}$/ }).nth(1)
    const name = (await older.innerText()).trim()
    expect(name).not.toBe(opened.trim())
    await older.click()

    await expect(fyPicker(page)).toHaveText(new RegExp(name))
    // A year gone by is twelve whole months; only the year in force is cut short
    // at today, and no row in a past year is the current one.
    const rows = panel(page).locator('button', { hasText: MONTH_ROW })
    await expect(rows).toHaveCount(12)
    // Read off the rows, not the panel: the footer carries a "Reset to current
    // period" button that says the word too.
    await expect(rows.filter({ hasText: 'Current' })).toHaveCount(0)
  })
})
