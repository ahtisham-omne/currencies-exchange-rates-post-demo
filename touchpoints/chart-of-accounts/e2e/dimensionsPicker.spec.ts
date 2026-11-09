import { test, expect, type Page } from '@playwright/test'

/* The dimension filters used to be three sections down the Filters modal, one
   closed dropdown per dimension. They are a dropdown of their own on the toolbar
   now, split the way the period picker is split: the dimensions down the left,
   the values of whichever one is in view down the right.

   Pinned against the running page because none of what matters here is visible
   in the source. Which pane the right side is showing, whether ticking a value
   actually narrows the chart, and whether Reset gives it back are all facts
   about a mounted, portalled panel. */

const panel = (page: Page) => page.locator('[data-dimensions-panel]')
const trigger = (page: Page) => page.getByRole('button', { name: 'Filter by dimension' })
const filtersBtn = (page: Page) => page.getByRole('button', { name: /filters/i }).first()

// The dimensions down the left rail. It is the panel's first column.
const rail = (page: Page) => panel(page).locator('div.border-r > button')
// The values of the dimension in view.
const values = (page: Page) => panel(page).locator('div.max-h-\\[264px\\] > button')
const rows = (page: Page) => page.locator('tbody tr')

// The header of the pane on the right, which says which dimension it belongs to.
const paneTitle = (page: Page) => panel(page).locator('div.flex-1 > div').first().locator('div').first()

async function open(page: Page) {
  await trigger(page).click()
  await expect(panel(page)).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.waitForSelector('tbody tr')
})

test.describe('dimensions filter from their own dropdown', () => {
  test('stands on the toolbar beside Filters, not inside it', async ({ page }) => {
    await expect(trigger(page)).toBeVisible()
    await expect(filtersBtn(page)).toBeVisible()

    // And it really did move: the Filters panel no longer carries the section.
    await filtersBtn(page).click()
    await expect(page.getByText('Filters', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Your own ways of grouping accounts')).toHaveCount(0)
  })

  test('opens split, with the dimensions down the left', async ({ page }) => {
    await open(page)
    await expect(rail(page)).toHaveText(['Location', 'Department'])
    // The first is in view without being asked for, so the panel opens onto
    // something rather than onto a prompt to pick a side.
    await expect(paneTitle(page)).toHaveText('Location')
    await expect(values(page).first()).toContainText('USA')
  })

  test('repopulates the right panel from the left', async ({ page }) => {
    await open(page)
    const locations = await values(page).allInnerTexts()
    await rail(page).filter({ hasText: 'Department' }).click()
    await expect(paneTitle(page)).toHaveText('Department')
    // A different dimension offers different values, which is the whole reason
    // the panel is split rather than one long list.
    await expect(values(page)).not.toHaveText(locations)
    await expect(values(page).first()).not.toContainText('USA')
  })

  test('narrows the chart on a tick, and says how many ticks it is holding', async ({ page }) => {
    const before = await rows(page).count()
    await open(page)
    await values(page).filter({ hasText: 'USA' }).click()
    await expect(trigger(page)).toContainText('1')
    await page.keyboard.press('Escape')
    const narrowed = await rows(page).count()
    expect(narrowed).toBeLessThan(before)

    /* A second value in the same dimension widens: USA or Singapore, not USA and
       Singapore. Nothing on the screen says so, and it is the part a reader gets
       wrong, so it is the part worth a test. */
    await open(page)
    await values(page).filter({ hasText: 'Singapore' }).click()
    await expect(trigger(page)).toContainText('2')
    await page.keyboard.press('Escape')
    expect(await rows(page).count()).toBeGreaterThan(narrowed)
  })

  test('holds a pick on one dimension while another is being ticked', async ({ page }) => {
    /* The left rail is a set of panes, not a set of choices: leaving Location to
       tick a Department has to keep the Location pick, or the split panel would
       only ever be able to filter on one dimension at a time. */
    await open(page)
    await values(page).filter({ hasText: 'USA' }).click()
    await rail(page).filter({ hasText: 'Department' }).click()
    await values(page).first().click()

    // Two ticks across two dimensions, and the rail says where each one sits.
    await expect(trigger(page)).toContainText('2')
    await expect(rail(page).filter({ hasText: 'Location' })).toContainText('1')
    await expect(rail(page).filter({ hasText: 'Department' })).toContainText('1')

    // Reopening comes back to the dimension that is asking something.
    await page.keyboard.press('Escape')
    await open(page)
    await expect(paneTitle(page)).toHaveText('Location')
    await expect(values(page).filter({ hasText: 'USA' }).locator('span').first()).toHaveClass(/bg-primary/)
  })

  test('gives the whole chart back from Reset, on every dimension at once', async ({ page }) => {
    const before = await rows(page).count()
    await open(page)
    await values(page).first().click()
    await rail(page).filter({ hasText: 'Department' }).click()
    await values(page).first().click()
    await expect(trigger(page)).toContainText('2')

    await panel(page).getByRole('button', { name: 'Reset', exact: true }).click()
    await expect(trigger(page)).not.toContainText('2')
    await page.keyboard.press('Escape')
    expect(await rows(page).count()).toBe(before)
  })

  test('leaves the dimension picks alone when the Filters panel is cleared', async ({ page }) => {
    /* Two controls over one filter set, so each has to clear only its own half.
       A Clear all that quietly emptied a control it does not even show is how a
       reader loses narrowing they cannot see they had.

       Cleared and then applied, because Clear all only empties the modal's draft
       - closing on Escape drops that draft and would hide the bug entirely. */
    await open(page)
    await values(page).filter({ hasText: 'USA' }).click()
    await page.keyboard.press('Escape')
    const narrowed = await rows(page).count()

    await filtersBtn(page).click()
    await page.getByRole('button', { name: /^Inactive/ }).first().click()
    await page.getByRole('button', { name: 'Clear all' }).click()
    // The Apply button counts what the draft would show. It reading the narrowed
    // figure rather than the whole chart is the assertion, before the click.
    const apply = page.getByRole('button', { name: /^Show \d/ })
    await expect(apply).toHaveText(`Show ${narrowed} accounts`)
    await apply.click()

    await expect(trigger(page)).toContainText('1')
    await expect(filtersBtn(page)).not.toContainText('1')
    // And the chart is still narrowed by it, not just the badge.
    expect(await rows(page).count()).toBe(narrowed)
  })
})
