import { test, expect, type Page } from '@playwright/test'
import { settle, view } from './glPage'

/* The Journal entries tab, as the design review of 2026-09-28 left it.

   - An Amount column on the entry's own row, so a collapsed list says how big
     each entry is. It stays on the entry row when the entry opens.
   - Debit and Credit beside the account, with Amount leading them.
   - The first entry open on arrival; a search opens the entries whose lines it
     matched.
   - The amount range on the toolbar, asking about the entry's total.
   - Plain-English (i) tooltips on the columns people asked about.
   - A Line description column for each line's own note.
   - No pages (Mahad, 2026-11-03): every entry in one scroll, drawn fifty at a
     time and never more than a hundred at once.
   - Print as an entry action, not a column. */

const headers = (page: Page) =>
  page.$$eval('thead tr th', ths => ths.map(t => (t as HTMLElement).innerText.trim().split('\n')[0]).filter(Boolean))

async function entries(page: Page) {
  await settle(page, '/general-ledger')
  await view(page, 'Journal entries').click()
  await page.locator('tr.gl-je-parent').first().waitFor()
}

const cellUnder = async (page: Page, row: ReturnType<Page['locator']>, header: string) => {
  const idx = await page.locator('thead th').evaluateAll((ths, h) =>
    ths.findIndex(t => (t as HTMLElement).innerText.trim().split('\n')[0] === h), header)
  return row.locator('td').nth(idx)
}

const money = (text: string) => Number(text.replace(/[^\d.]/g, '') || 0)

test.describe('the collapsed list says what each entry is worth', () => {
  // Decision 98: Amount between Memo and Debit (module review, 2026-10-06, COA-29).
  test('puts Memo, then Amount, Debit and Credit, beside the account', async ({ page }) => {
    await entries(page)
    const h = await headers(page)
    const at = (l: string) => h.indexOf(l)
    expect(at('Memo')).toBe(at('Account') + 1)
    expect(at('Amount')).toBe(at('Memo') + 1)
    expect(at('Debit')).toBe(at('Amount') + 1)
    expect(at('Credit')).toBe(at('Debit') + 1)
  })

  test('shows the entry total on the entry row, equal to its debits and its credits', async ({ page }) => {
    await entries(page)
    const entry = page.locator('tr.gl-je-parent').first()
    const amount = money(await (await cellUnder(page, entry, 'Amount')).innerText())
    expect(amount).toBeGreaterThan(0)
    // The first entry is open on arrival: its lines add up to the amount, each side.
    const lines = page.locator('tr.gl-je-child')
    let debits = 0, credits = 0
    for (const line of await lines.all()) {
      debits += money(await (await cellUnder(page, line, 'Debit')).innerText())
      credits += money(await (await cellUnder(page, line, 'Credit')).innerText())
      // The lines leave the entry's amount to the entry.
      expect((await (await cellUnder(page, line, 'Amount')).innerText()).trim()).toBe('')
    }
    expect(debits).toBe(amount)
    expect(credits).toBe(amount)
  })

  test('sorts by Amount', async ({ page }) => {
    await entries(page)
    await page.locator('thead th').filter({ hasText: 'Amount' }).first().click({ position: { x: 12, y: 10 } })
    await page.getByText('Sort descending', { exact: true }).click()
    const amounts = await Promise.all((await page.locator('tr.gl-je-parent').all()).slice(0, 5)
      .map(async r => money(await (await cellUnder(page, r, 'Amount')).innerText())))
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts)
  })
})

test.describe('what opens by itself', () => {
  test('the first entry, and no other', async ({ page }) => {
    await entries(page)
    await expect(page.getByRole('button', { name: 'Collapse entry' })).toHaveCount(1)
  })

  test('a search opens the entries whose lines it matched', async ({ page }) => {
    await entries(page)
    // An account number is on the lines, never on the entry's own row.
    await page.getByPlaceholder('Search entries').fill('11110')
    await expect.poll(() => page.locator('tr.gl-je-parent').count()).toBeGreaterThan(0)
    const found = await page.locator('tr.gl-je-parent').count()
    await expect(page.getByRole('button', { name: 'Collapse entry' })).toHaveCount(found)
    await expect(page.locator('tr.gl-je-child', { hasText: '11110' }).first()).toBeVisible()
  })

  test('a search that names the entry itself leaves it closed', async ({ page }) => {
    await entries(page)
    const je = (await page.locator('tr.gl-je-parent').nth(3).getByRole('button', { name: /^JE-/ }).innerText()).trim()
    await page.getByPlaceholder('Search entries').fill(je)
    await expect(page.locator('tr.gl-je-parent')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Collapse entry' })).toHaveCount(0)
  })
})

test.describe('the amount range', () => {
  test('is on the toolbar, not in Filters, and asks about the entry total', async ({ page }) => {
    await entries(page)
    await page.getByRole('button', { name: /^Filters/ }).first().click()
    const modal = page.locator('body > div.fixed.inset-0').last()
    await expect(modal.getByText('Posting side')).toBeVisible()
    await expect(modal.getByText('Amount range')).toHaveCount(0)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: /^Amount range/ }).click()
    await page.locator('[data-amount-range] input[type="number"]').first().fill('1000')
    await expect(page.getByRole('button', { name: /^Amount range: \$ 1,000 or more/ })).toBeVisible()
    for (const row of (await page.locator('tr.gl-je-parent').all()).slice(0, 8)) {
      expect(money(await (await cellUnder(page, row, 'Amount')).innerText())).toBeGreaterThanOrEqual(1000)
    }
  })
})

/* No Period facet in Filters on either tab: the period strip above the table
   already scopes every row to one accounting period. Mahad, 2026-10-09: *"remove
   this filter from general ledger and journal entries."* */
test('Filters asks no period on either tab', async ({ page }) => {
  await settle(page, '/general-ledger')
  for (const tab of ['General ledger', 'Journal entries'] as const) {
    await view(page, tab).click()
    await page.getByRole('button', { name: /^Filters/ }).first().click()
    const modal = page.locator('body > div.fixed.inset-0').last()
    await expect(modal.getByText('Posting side')).toBeVisible()
    await expect(modal.getByText('Period', { exact: true })).toHaveCount(0)
    await expect(modal.getByText('All periods')).toHaveCount(0)
    await page.keyboard.press('Escape')
  }
})

test.describe('columns explain themselves', () => {
  /* One plain line on every column, both tabs. Mahad, 2026-10-14: *"Can we have
     one liners for tooltips for all columns? Please write them in plain simple
     english that is easy to understand."* */
  // Mahad's copy of 2026-10-14 where he wrote it; the plain one-liners elsewhere.
  const ONE_LINERS: Record<string, string> = {
    'Date': 'Date the entry posts to the ledger.',
    'Account': 'GL account each line of the entry posts to.',
    'GL category': 'The type of account: asset, liability, equity, revenue or expense.',
    'Journal entry number': 'Reference number that identifies this entry across Omne.',
    'Journal entry ID': 'Internal system ID for the entry.',
    'Source': 'Module that originated the entry, or Manual journal entry for entries created directly in the general ledger.',
    'Linked document': 'Transaction in the source module that generated this entry, such as a vendor payment or payroll run.',
    'Memo': 'Note that describes the journal entry as a whole.',
    'Line description': 'Note that describes this specific line.',
    'Dimensions': 'Reporting labels, such as location or department, taken from the account.',
    'Tags': 'Labels used to group and filter entries in reports.',
    'Created by': 'The person who posted the entry.',
    'Created on': 'When the entry was posted.',
    'Last updated by': 'The person who last changed the entry.',
    'Last updated on': 'When the entry was last changed.',
    'Currency': 'Currency the transaction was recorded in.',
    'Amount': 'Entry total, which equals the sum of its debits.',
    'Amount (foreign currency)': "Original amount in the transaction currency, shown only when it isn't the base currency.",
    'Debit': 'Amount debited to the account, in base currency.',
    'Credit': 'Amount credited to the account, in base currency.',
    'Running balance': 'Account balance after this posting, in base currency.',
  }
  // The General ledger tab groups postings under each account, and says so.
  const ON_LEDGER_TAB: Record<string, string> = {
    'Account': 'GL account number and name, with every posting to it grouped underneath.',
  }

  test('every column on both tabs has a one-line tooltip', async ({ page }) => {
    await settle(page, '/general-ledger')
    for (const tab of ['General ledger', 'Journal entries'] as const) {
      await view(page, tab).click()
      await page.locator('tbody tr').first().waitFor()
      const labels = await headers(page)
      expect(labels.length, tab).toBeGreaterThan(5)
      for (const label of labels) {
        const line = (tab === 'General ledger' && ON_LEDGER_TAB[label]) || ONE_LINERS[label]
        expect(line, `${tab}: ${label} has no line`).toBeTruthy()
        await page.getByLabel(`About ${label}`, { exact: true }).hover()
        await expect(page.getByText(line, { exact: true }).first(), `${tab}: ${label}`).toBeVisible()
        await page.mouse.move(0, 0)
      }
    }
  })

  for (const [column, words] of [
    ['Source', 'Module that originated the entry'],
    ['Linked document', 'Transaction in the source module that generated this entry'],
    ['Amount', 'Entry total, which equals the sum of its debits.'],
  ] as const) {
    test(`${column} has a plain-English tooltip`, async ({ page }) => {
      await entries(page)
      // Exact: "About Amount" is also the start of "About Amount (foreign currency)".
      await page.getByLabel(`About ${column}`, { exact: true }).hover()
      await expect(page.getByText(words, { exact: false }).first()).toBeVisible()
    })
  }

  /* No Description column. Mahad, 2026-09-30: *"Please remove description
     entirly, we will only have memo and line description."* The Journal Entry ID
     takes its place beside the entry number. */
  test('has Memo and Line description, no Description, and the Journal Entry ID beside the number', async ({ page }) => {
    await entries(page)
    const h = await headers(page)
    expect(h).not.toContain('Description')
    expect(h).toContain('Memo')
    expect(h).toContain('Line description')
    expect(h.indexOf('Journal entry ID')).toBe(h.indexOf('Journal entry number') + 1)
    expect(h).not.toContain('Internal ID')
  })

  // The entry row used to leave Source blank, so the column was empty all the way down.
  test('says where each entry came from', async ({ page }) => {
    await entries(page)
    for (const row of (await page.locator('tr.gl-je-parent').all()).slice(0, 6)) {
      expect((await (await cellUnder(page, row, 'Source')).innerText()).trim().length).toBeGreaterThan(0)
    }
  })

  test('each line carries its own description, under the entry memo', async ({ page }) => {
    await entries(page)
    expect(await headers(page)).toContain('Line description')
    const line = page.locator('tr.gl-je-child').first()
    const entryRow = page.locator('tr.gl-je-parent').first()
    // The entry row has no line description; the lines have no memo.
    expect((await (await cellUnder(page, entryRow, 'Line description')).innerText()).trim()).toBe('')
    expect((await (await cellUnder(page, line, 'Memo')).innerText()).trim()).toBe('')
  })
})

/* Mahad, 2026-11-03: no pagination. The tab scrolls through every entry, fifty
   drawn on arrival, the next fifty as the reader scrolls down, never more than a
   hundred at once; a block scrolled past leaves the DOM and comes back on the way
   up - and none of it may jerk the rows on screen. */
test.describe('scrolling through every entry', () => {
  async function wholeYear(page: Page) {
    await entries(page)
    await page.getByRole('button', { name: 'Change accounting period' }).click()
    const panel = page.locator('body > div').filter({ hasText: 'Fiscal year' }).last()
    await panel.getByText('Fiscal year', { exact: true }).first().click()
    await panel.locator('button', { hasText: /^FY2026/ }).first().click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Change accounting period' })).toHaveText(/FY2026/)
    await page.locator('tr.gl-je-parent').first().waitFor()
  }
  const frame = (page: Page) => page.locator('table').first().locator('xpath=ancestor::div[contains(@class,"overflow-auto")][1]')
  // Scroll the frame, then wait two frames for the scroll handler and the render.
  const scrollTo = (page: Page, top: number) => frame(page).evaluate(async (el, y) => {
    el.scrollTop = y
    el.dispatchEvent(new Event('scroll'))
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  }, top)
  const drawnEntries = (page: Page) => page.locator('tr.gl-je-parent').evaluateAll(rows =>
    rows.map(r => [...r.querySelectorAll('button')].map(b => b.textContent?.trim() ?? '').find(t => t.startsWith('JE-')) ?? ''))
  // Where each drawn entry sits on screen, by its number.
  const onScreen = (page: Page) => page.locator('tr.gl-je-parent').evaluateAll(rows =>
    Object.fromEntries(rows.map(r => [[...r.querySelectorAll('button')].map(b => b.textContent?.trim() ?? '').find(t => t.startsWith('JE-')) ?? '', r.getBoundingClientRect().top])))

  test('has no pages', async ({ page }) => {
    await entries(page)
    await expect(page.locator('select[aria-label="Entries per page"]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Next/ })).toHaveCount(0)
  })

  test('draws fifty on arrival, never more than a hundred, and brings the first fifty back on the way up', async ({ page }) => {
    await wholeYear(page)
    const first = await drawnEntries(page)
    expect(first).toHaveLength(50)
    const height = await frame(page).evaluate(el => el.scrollHeight)
    let leftTheTop = false
    for (let y = 0; y < Math.min(height, 40_000); y += 700) {
      await scrollTo(page, y)
      const drawn = await drawnEntries(page)
      expect(drawn.length).toBeLessThanOrEqual(100)
      if (!drawn.includes(first[0])) leftTheTop = true
    }
    expect(leftTheTop).toBe(true)
    await scrollTo(page, 0)
    expect((await drawnEntries(page)).slice(0, 50)).toEqual(first)
  })

  for (const open of [false, true]) {
    test(`holds the rows still as blocks come and go${open ? ', with every entry open' : ''}`, async ({ page }) => {
      await wholeYear(page)
      if (open) {
        await page.getByRole('button', { name: /^(Expand|Collapse) all$/ }).first().click()
        await page.getByText('Show the postings under every entry').click()
        await page.locator('tr.gl-je-child').nth(10).waitFor()
      }
      const height = await frame(page).evaluate(el => el.scrollHeight)
      // Down past several block boundaries and back up, a step at a time: every
      // entry on screen before a step and after it moved by the step, exactly.
      const step = 333
      const stops = [...Array(30).keys()].map(i => i * step).filter(y => y < height - 2000)
      for (const [from, to] of [...stops.slice(1).map((y, i) => [stops[i], y]), ...stops.slice(1).reverse().map((y, i, a) => [y, a[i + 1] ?? 0])]) {
        await scrollTo(page, from)
        const before = await onScreen(page)
        await scrollTo(page, to)
        const after = await onScreen(page)
        const shared = Object.keys(before).filter(je => je in after)
        expect(shared.length).toBeGreaterThan(0)
        for (const je of shared) expect(Math.abs(after[je] - (before[je] - (to - from)))).toBeLessThanOrEqual(1)
      }
    })
  }

  test('holds the columns still as blocks come and go', async ({ page }) => {
    await wholeYear(page)
    const widths = () => page.locator('thead th').evaluateAll(ths => ths.map(t => Math.round(t.getBoundingClientRect().width)))
    await scrollTo(page, 0)
    let prev = await widths()
    for (let y = 700; y < 20_000; y += 700) {
      await scrollTo(page, y)
      const now = await widths()
      // A column may widen for a longer value it has not drawn yet; it never narrows.
      now.forEach((w, i) => expect(w).toBeGreaterThanOrEqual(prev[i] - 1))
      prev = now
    }
  })
})

test('prints an entry from its actions menu', async ({ page }) => {
  await entries(page)
  // A real print dialog holds the page until it is dismissed, which a test
  // cannot do; the window it opens is what is checked, so its print is a no-op.
  await page.evaluate(() => {
    const open = window.open.bind(window)
    window.open = (...args: Parameters<typeof window.open>) => {
      const w = open(...args)
      if (w) w.print = () => {}
      return w
    }
  })
  const row = page.locator('tr.gl-je-parent').first()
  const je = (await row.getByRole('button', { name: /^JE-/ }).innerText()).trim()
  await row.getByRole('button', { name: `Actions for ${je}` }).click()
  const popup = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Print entry' }).click()
  const printed = await popup
  await expect(printed.locator('h1')).toHaveText(`Journal entry ${je}`)
  await expect(printed.locator('tfoot')).toContainText('Total')
})
