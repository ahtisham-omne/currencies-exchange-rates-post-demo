import { test, expect, type Page, type Locator } from '@playwright/test'
import { settle, view } from './glPage'

/* Drag a header up off the top of its table and let go: the column hides.
   Mahad, 2026-10-01: *"for the columns that are draggable, if you drag them
   upwards to the top and release them outside, that specific column you dragged
   should be hidden."* A real drag in a real browser, as columnDrag.spec.ts says
   it has to be: native drag and drop cannot be faked below one. */

const headers = (page: Page) =>
  page.$$eval('thead tr th', ths => ths.map(t => (t as HTMLElement).innerText.trim().split('\n')[0]).filter(Boolean))
const th = (page: Page, label: string) => page.locator('thead th').filter({ hasText: new RegExp(`^${label}`) }).first()
/* The drag chip. Since 2026-10-01 (Mahad: *"when we drag it away from the table
   it just becomes like red"*) it turns red off the top of the table, in place of
   a separate "Release to hide" card. */
const hint = (page: Page) => page.locator('[data-drag-ghost="hide"]')

/* The line a header turns into a hide at: the top of the table's toolbar, just
   under the period row. Mahad, 2026-10-13: *"as soon as it is dragged up
   slightly - at least reaching the Accounting Period row - it should trigger that
   hiding feedback."* */
const hideEdge = (page: Page) => page.locator('[data-col-hide-edge]').first().evaluate(el => el.getBoundingClientRect().top)

/* Press on the header, move off it far enough to be a drag, then travel up to
   `toY` - by default just past the toolbar, into the period row - and release.
   Reports what the hint said at the top, before letting go. */
async function dragUp(page: Page, header: Locator, toY?: number) {
  const box = (await header.boundingBox())!
  const x = box.x + box.width / 2, y = box.y + box.height / 2
  const target = toY ?? (await hideEdge(page)) - 6
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 4, y, { steps: 5 })
  await page.mouse.move(x - 4, target, { steps: 15 })
  // What the chip says once red, or null when it never turned.
  const said = (await hint(page).count()) ? (await hint(page).innerText()).trim() : null
  await page.mouse.up()
  return said
}

test.describe('on the chart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
    await page.locator('tbody tr').first().waitFor()
  })

  test('turns red off the top, and hides the column on release', async ({ page }) => {
    expect(await headers(page)).toContain('Statement classification')
    const said = await dragUp(page, th(page, 'Statement classification'))
    expect(said).toBe('Statement classification')
    await expect.poll(() => headers(page)).not.toContain('Statement classification')
    await expect(hint(page)).toHaveCount(0)
  })

  test('keeps a locked column, and offers no hide for it', async ({ page }) => {
    const said = await dragUp(page, th(page, 'GL account name'))
    expect(said).toBeNull()
    expect(await headers(page)).toContain('GL account name')
  })

  test('a release just above the header hides nothing', async ({ page }) => {
    const header = th(page, 'Statement classification')
    const said = await dragUp(page, header, (await header.boundingBox())!.y - 8)
    expect(said).toBeNull()
    expect(await headers(page)).toContain('Statement classification')
  })

  test('over the toolbar it is still a move, not a hide', async ({ page }) => {
    // The search and filters row, and the pills under it, are below the line.
    const said = await dragUp(page, th(page, 'Statement classification'), (await hideEdge(page)) + 12)
    expect(said).toBeNull()
    expect(await headers(page)).toContain('Statement classification')
  })

  test('hides from a table scrolled down its rows, without leaving the card', async ({ page }) => {
    /* The line used to be the <table>'s own top, which a scrolled card carries
       far above the screen: no drag could reach it. */
    await page.locator('tbody').first().evaluate(el => {
      let sc: HTMLElement | null = el as HTMLElement
      while (sc && !(sc.scrollHeight > sc.clientHeight + 5 && getComputedStyle(sc).overflowY !== 'visible')) sc = sc.parentElement
      sc!.scrollTop = 600
    })
    const table = (await page.locator('table').first().boundingBox())!
    expect(table.y).toBeLessThan(0)
    const said = await dragUp(page, th(page, 'Statement classification'))
    expect(said).toBe('Statement classification')
    await expect.poll(() => headers(page)).not.toContain('Statement classification')
  })

  test('a drop on another header still reorders, and hides nothing', async ({ page }) => {
    const before = await headers(page)
    const from = (await th(page, 'GL account type').boundingBox())!
    const to = (await th(page, 'Statement classification').boundingBox())!
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(from.x + from.width / 2 - 24, from.y + from.height / 2, { steps: 5 })
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 })
    await page.mouse.up()
    const after = await headers(page)
    expect(after.length).toBe(before.length)
    expect(after.indexOf('GL account type')).toBeLessThan(after.indexOf('Statement classification'))
  })
})

test('a summary\'s Accounts tab hides a column dragged off the top', async ({ page }) => {
  await page.goto('/chart-of-accounts/acct_11000', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Accounts/ }).first().click()
  await page.locator('tbody tr').first().waitFor()
  await dragUp(page, th(page, 'Statement classification'))
  await expect.poll(() => headers(page)).not.toContain('Statement classification')
})

test('the account register hides a column dragged off the top', async ({ page }) => {
  await page.goto('/chart-of-accounts/acct_11130', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Transactions', exact: true }).first().click()
  await page.locator('tbody tr').first().waitFor()
  const said = await dragUp(page, th(page, 'Source'))
  expect(said).toBe('Source')
  await expect.poll(() => headers(page)).not.toContain('Source')
})

test.describe('on the ledger', () => {
  test('hides a column dragged off the top, on both tabs', async ({ page }) => {
    await settle(page, '/general-ledger')
    for (const tab of ['General ledger', 'Journal entries'] as const) {
      await view(page, tab).click()
      await page.locator('tbody tr').first().waitFor()
      // A column within reach on each tab: Source sits under the pinned Actions
      // column on Journal entries, where the mouse would grab something else.
      const label = tab === 'General ledger' ? 'Source' : 'Currency'
      const said = await dragUp(page, th(page, label))
      expect(said, tab).toBe(label)
      await expect.poll(() => headers(page)).not.toContain(label)
      // Back on for the next tab, which shares the setting.
      await page.getByRole('button', { name: /^Columns/ }).first().click()
      await page.getByRole('button', { name: 'Reset' }).first().click()
      await page.getByRole('button', { name: /^Columns/ }).first().click()
    }
  })

  test('keeps a column it always shows', async ({ page }) => {
    await settle(page, '/general-ledger')
    await view(page, 'General ledger').click()
    const said = await dragUp(page, th(page, 'Debit'))
    expect(said).toBeNull()
    expect(await headers(page)).toContain('Debit')
  })
})

// Off the top, the chip, the header and the column's cells all turn red.
test('reddens the chip, the header and the column while a release would hide', async ({ page }) => {
  await page.goto('/chart-of-accounts', { waitUntil: 'networkidle' })
  await page.locator('tbody tr').first().waitFor()
  const header = th(page, 'Statement classification')
  const box = (await header.boundingBox())!
  const x = box.x + box.width / 2, y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 4, y, { steps: 3 })
  await page.mouse.move(x - 4, (await hideEdge(page)) - 6, { steps: 15 })

  await expect(hint(page)).toHaveCount(1)
  // The border eases to red over 120ms.
  await expect.poll(() => hint(page).evaluate(el => getComputedStyle(el).borderTopColor)).toBe('rgba(220, 38, 38, 0.35)')
  expect(await header.getAttribute('style')).toContain('220, 38, 38')
  const cell = page.locator('tbody tr').first().locator('td').nth(await header.evaluate(el => (el as HTMLTableCellElement).cellIndex))
  expect(await cell.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(220, 38, 38, 0.06)')

  await page.mouse.up()
  await expect(page.locator('[data-drag-ghost]')).toHaveCount(0)
})
