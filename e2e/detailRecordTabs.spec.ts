import { test, expect, type Page } from '@playwright/test'

/* The account detail page as the design review of 2026-09-24 left it.

   - Notes, Attachments, Communication and Activity close every account page, in
     that order (Eli: *"they're always there and they're always at the end"*).
   - A wide table opens in full view, a small one does not (*"the default view
     should be expanded"* for the summary's Accounts; *"the default on this
     should be collapsed"* for Transactions).
   - Transactions opens on the last 30 days, not all time.
   - A widget grows taller as it grows wider (*"there needs to be a
     width-to-height ratio with these things"*).

   Demo facts: 11130 Operating - Chase Bank arrives with five files spanning the
   PDF/XLSX/DOC/PNG badges, 11110 Petty Cash with none; 11000 Current Assets is a
   summary. */

// The header card's tab bar: the row of buttons under its top border.
const tabNames = (page: Page) =>
  page.locator('div.border-t.border-muted.overflow-x-auto > button').allInnerTexts()

async function open(page: Page, id: string) {
  await page.goto(`/chart-of-accounts/${id}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Activity', exact: true }).first().waitFor()
}

const tab = (page: Page, name: RegExp | string) =>
  page.getByRole('button', { name, exact: typeof name === 'string' }).first()

test.describe('the four record tabs', () => {
  test('close a posting account\'s tabs, in order', async ({ page }) => {
    await open(page, 'acct_11130')
    const labels = (await tabNames(page)).map(t => t.replace(/\s*\d+$/, '').trim())
    const at = (l: string) => labels.indexOf(l)
    expect(at('Notes')).toBeGreaterThan(at('Where used'))
    expect(at('Attachments')).toBe(at('Notes') + 1)
    expect(at('Communications')).toBe(at('Attachments') + 1)
    expect(at('Activity')).toBe(at('Communications') + 1)
    expect(labels).not.toContain('Recent activity')
  })

  test('close a summary\'s tabs, in the same order', async ({ page }) => {
    await open(page, 'acct_11000')
    const labels = (await tabNames(page)).map(t => t.replace(/\s*\d+$/, '').trim())
    const at = (l: string) => labels.indexOf(l)
    expect(at('Notes')).toBe(at('Accounts') + 1)
    expect(at('Activity')).toBe(at('Communications') + 1)
  })

  /* Notes is built now (Mahad, 2026-10-06, supplying the design), replacing the
     Coming Soon state it carried since 2026-09-29, and the tab counts its notes
     as Attachments counts files. The tab itself is pinned in notesTab.spec.ts. */
  test('Notes takes a note, and the tab counts them', async ({ page }) => {
    await open(page, 'acct_11130')
    await expect(tab(page, /^Notes/)).toContainText('3')
    await tab(page, /^Notes/).click()
    await expect(page.getByText('Coming Soon')).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Add a note' })).toBeVisible()
  })

  test('Attachments lists the account\'s files and counts them on the tab', async ({ page }) => {
    await open(page, 'acct_11130')
    await expect(tab(page, /^Attachments/)).toContainText('5')
    await tab(page, /^Attachments/).click()
    await expect(page.getByText('Chase business account agreement.pdf')).toBeVisible()
    await expect(page.getByText('5 files', { exact: false })).toBeVisible()
  })

  /* The folder spreads across every kind the grid draws differently, so the tab
     is seen with its full badge set rather than a wall of PDFs. */
  test('Attachments badges each kind of file it holds', async ({ page }) => {
    await open(page, 'acct_11130')
    await tab(page, /^Attachments/).click()
    for (const badge of ['PDF', 'XLSX', 'DOC', 'PNG']) {
      await expect(page.getByText(badge, { exact: true }).first()).toBeVisible()
    }
  })

  test('Attachments takes an upload, and the tab counts it', async ({ page }) => {
    await open(page, 'acct_11110')
    await tab(page, /^Attachments/).click()
    await page.locator('input[type=file]').setInputFiles({ name: 'petty-cash-count.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') })
    await expect(page.getByText('petty-cash-count.pdf')).toBeVisible()
    await expect(tab(page, /^Attachments/)).toContainText('1')
  })
})

test.describe('how each tab opens', () => {
  test('opens a summary\'s Accounts table in full view, and its Overview not', async ({ page }) => {
    await open(page, 'acct_11000')
    await expect(page.getByRole('button', { name: 'Full screen' })).toBeVisible()
    await tab(page, 'Accounts').click()
    await expect(page.getByRole('button', { name: 'Exit full screen' })).toBeVisible()
    // The reader's own choice holds for the tab.
    await page.getByRole('button', { name: 'Exit full screen' }).click()
    await tab(page, 'Overview').click()
    await tab(page, 'Accounts').click()
    await expect(page.getByRole('button', { name: 'Full screen' })).toBeVisible()
  })

  /* A choice made by hand holds on every tab, not only the one it was made on.
     Design review, 2026-09-30 - Eli: *"if I've manually expanded, then it should
     stay expanded for all of the tabs."* */
  test('keeps a full view chosen on one tab for the others', async ({ page }) => {
    await open(page, 'acct_11000')
    await page.getByRole('button', { name: 'Full screen' }).click()
    await tab(page, 'Accounts').click()
    await expect(page.getByRole('button', { name: 'Exit full screen' })).toBeVisible()
    await tab(page, /^Notes/).click()
    await expect(page.getByRole('button', { name: 'Exit full screen' })).toBeVisible()
    await page.getByRole('button', { name: 'Exit full screen' }).click()
    await tab(page, 'Accounts').click()
    await expect(page.getByRole('button', { name: 'Full screen' })).toBeVisible()
  })

  /* In full view, as a summary's Accounts tab opens. Mahad, 2026-09-30: *"when the
     transaction tab is clicked in the posting accounts details page it gets
     expanded."* The Dashboard it was opened from stays as it was, and the
     reader's own choice holds for the tab. */
  test('opens Transactions in full view, on the last 30 days', async ({ page }) => {
    await open(page, 'acct_11130')
    await expect(page.getByRole('button', { name: 'Full screen' })).toBeVisible()
    await tab(page, 'Transactions').click()
    await expect(page.getByRole('button', { name: 'Exit full screen' })).toBeVisible()
    await page.getByRole('button', { name: 'Exit full screen' }).click()
    await tab(page, 'Dashboard').click()
    await expect(page.getByRole('button', { name: 'Full screen' })).toBeVisible()
    await tab(page, 'Transactions').click()
    await expect(page.getByRole('button', { name: 'Full screen' })).toBeVisible()
    await page.getByRole('button', { name: 'Full screen' }).click()
    await expect(page.getByRole('button', { name: /^Last 30 days/ })).toBeVisible()
    // The count still reads against the whole account, so the reader can see
    // there is more than the window shows.
    const count = await page.getByText(/ of [\d,]+ transactions$/).first().innerText()
    const [shown, all] = count.replace(/,/g, '').match(/\d+/g)!.map(Number)
    expect(shown).toBeLessThan(all)
  })

  /* Mahad, 2026-09-30: *"add date filter next to the sorting pills ... So the
     pattern is that we wont have any button next to the filters button."* The
     date range leads the pill row, then a divider, then All / Debit / Credit -
     the ledger's Amount pill, in the same place and the same shape. */
  test('puts the date range at the head of the pill row, and nothing beside Filters', async ({ page }) => {
    await open(page, 'acct_11130')
    await tab(page, 'Transactions').click()
    const date = page.getByRole('button', { name: /^Last 30 days/ })
    const all = page.getByRole('button', { name: /^All\s*\d/ }).first()
    const filters = page.getByRole('button', { name: /^Filters/ }).first()
    const [d, a, f] = await Promise.all([date, all, filters].map(l => l.boundingBox()))
    // On the pill row, left of the pills, and off the row Filters stands on.
    expect(Math.abs(d!.y + d!.height / 2 - (a!.y + a!.height / 2))).toBeLessThan(3)
    expect(d!.x).toBeLessThan(a!.x)
    expect(d!.y).toBeGreaterThan(f!.y + f!.height)
    // Drawn as a pill, as the pills beside it are.
    expect(await date.evaluate(el => getComputedStyle(el).borderRadius)).toBe(await all.evaluate(el => getComputedStyle(el).borderRadius))
    // Filters (its button and the clear beside it, in one wrapper) ends its group.
    expect(await filters.evaluate(el => el.parentElement!.nextElementSibling === null)).toBe(true)
  })

  test('says a quiet month is the dates, and offers all time', async ({ page }) => {
    await open(page, 'acct_11130')
    await tab(page, 'Transactions').click()
    await page.getByRole('button', { name: /^Last 30 days/ }).click()
    await page.getByText('Last 7 days', { exact: true }).last().click()
    // Seven days may or may not hold a posting on this account; if it does not,
    // the empty row has to name the dates and offer the way out.
    const empty = page.getByText(/No transactions in the last 7 days/)
    if (await empty.count()) {
      await page.getByRole('button', { name: 'Show all time' }).click()
      await expect(page.getByRole('button', { name: /^All time/ })).toBeVisible()
    }
  })

  test('the search box hint fits inside the box', async ({ page }) => {
    await open(page, 'acct_11130')
    await tab(page, 'Transactions').click()
    const box = page.getByPlaceholder('Search transactions')
    const fits = await box.evaluate((el: HTMLInputElement) => {
      const c = document.createElement('canvas').getContext('2d')!
      const cs = getComputedStyle(el)
      c.font = `${cs.fontSize} ${cs.fontFamily}`
      const text = c.measureText(el.placeholder).width
      return text < el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    })
    expect(fits).toBe(true)
  })
})

test.describe('widgets on a wide page', () => {
  const growthOf = (page: Page) =>
    page.locator('[data-widget-growth]').first().getAttribute('data-widget-growth').then(Number)
  const chartHeight = (page: Page) =>
    page.locator('[data-widget-growth] .recharts-responsive-container').first().evaluate(el => Math.round(el.getBoundingClientRect().height))

  test('keep their height on an ordinary page', async ({ page }) => {
    await open(page, 'acct_11130')
    await page.locator('[data-widget-growth]').first().waitFor()
    expect(await growthOf(page)).toBe(1)
  })

  test('grow taller, not only wider, in full view on a big screen', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1300 })
    await open(page, 'acct_11130')
    await page.locator('[data-widget-growth]').first().waitFor()
    const before = await chartHeight(page)
    await page.getByRole('button', { name: 'Full screen' }).click()
    await expect.poll(() => growthOf(page)).toBeGreaterThan(1.3)
    await expect.poll(() => chartHeight(page)).toBeGreaterThan(before + 40)
  })
})
