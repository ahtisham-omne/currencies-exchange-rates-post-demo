import { test, expect, type Page } from '@playwright/test'
import { settle, view } from './glPage'

/* One tab, one unit. A quick filter option's number answers the question clicking it asks -
   how many of the rows this tab lists does it keep - so clicking one has to
   leave the tally agreeing with it. That is asserted here instead of the figures
   themselves: the seed clamps its postings to today (SEED_TX_END), so every
   absolute count on this page drifts with the calendar.

   The pill row used to be shared by both tabs and had to recount as the reader
   switched, which is how it came to state one base while the tally beside it
   stated another. Both tabs draw chips again (the entries tab by source, since
   2026-09-29), but each tab now offers its own set and counts them in its own
   unit - postings on the General ledger tab, entries on the entries tab - so
   nothing recounts on a switch. Both bases are asserted below.

   Read in a browser because neither figure is a claim the source can make. Both
   are computed, and the tally already read in the right unit while the pills
   beside it did not. */

const CATEGORIES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']

// "892 of 1,204 postings" → { shown: 892, total: 1204, unit: 'postings' }
async function tally(page: Page) {
  const text = await page.locator('span')
    .filter({ hasText: /^[\d,]+ of [\d,]+ (entries|postings)$/ }).first().innerText()
  const m = /^([\d,]+) of ([\d,]+) (entries|postings)$/.exec(text.trim())!
  return { shown: Number(m[1].replace(/,/g, '')), total: Number(m[2].replace(/,/g, '')), unit: m[3] }
}

// The count on one category pill, or null when the period holds none of it.
async function pillCount(page: Page, label: string): Promise<number | null> {
  const pill = page.getByRole('button', { name: new RegExp(`^${label}\\b`) }).first()
  const text = await pill.innerText()
  const m = /([\d,]+)\s*$/.exec(text.trim())
  return m ? Number(m[1].replace(/,/g, '')) : null
}

/* Source is vendor invoicing's dropdown since 2026-09-30: a trigger reading
   "Source: All", opening onto a checkbox per value with its count. Category
   stays a row of pills. */
const trigger = (page: Page, label: string) => page.getByRole('button', { name: new RegExp(`^${label}:`) })
const menu = (page: Page, label: string) => page.getByRole('menu', { name: label })

async function openFilter(page: Page, label: string) {
  await trigger(page, label).click()
  await expect(menu(page, label)).toBeVisible()
  return menu(page, label)
}

// Each option's label and count, as the dropdown states them.
async function optionCounts(page: Page, label: string) {
  return menu(page, label).getByRole('menuitemcheckbox').evaluateAll(els => els.map(el => {
    const spans = el.querySelectorAll('span')
    const count = spans[spans.length - 1]?.textContent?.trim() ?? ''
    return { label: spans[1]?.textContent?.trim() ?? '', count: Number(count.replace(/,/g, '')) }
  }))
}

/* Ticking an option alone has to leave the tally at the option's count, and
   unticking it has to give the rows back. */
async function eachOptionKeepsItsCount(page: Page, label: string, unit: 'postings' | 'entries') {
  const m = await openFilter(page, label)
  let checked = 0
  for (const { label: name, count } of await optionCounts(page, label)) {
    if (!count) continue
    const option = m.getByRole('menuitemcheckbox').filter({ hasText: name }).first()
    await option.click()
    const t = await tally(page)
    expect(t.shown, `${name} keeps the rows its option counts`).toBe(count)
    expect(t.unit).toBe(unit)
    checked++
    await option.click()
  }
  return checked
}

test('every pill on General ledger counts in postings', async ({ page }) => {
  await settle(page, '/general-ledger')
  await view(page, 'General ledger').click()
  expect((await tally(page)).unit).toBe('postings')

  let checked = 0
  for (const label of CATEGORIES) {
    const count = await pillCount(page, label)
    if (count === null || count === 0) continue
    await page.getByRole('button', { name: new RegExp(`^${label}\\b`) }).first().click()
    const t = await tally(page)
    expect(t.shown, `${label} keeps the rows its pill counts`).toBe(count)
    expect(t.unit).toBe('postings')
    checked++
    await page.getByRole('button', { name: 'Show All', exact: true }).click()
  }
  // Or the loop above passed over a pill row that states nothing.
  expect(checked, 'the period holds at least one category').toBeGreaterThan(0)
})

// The General ledger tab keeps its pills; the dropdown is the entries tab's alone.
test('General ledger draws category pills, not a Category dropdown', async ({ page }) => {
  await settle(page, '/general-ledger')
  await view(page, 'General ledger').click()
  await expect(trigger(page, 'Category')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Show All', exact: true })).toHaveCount(1)
  for (const label of CATEGORIES) {
    await expect(page.getByRole('button', { name: new RegExp(`^${label}\\b`) }).first()).toBeVisible()
  }
})

/* The same rule for the entries tab's Source dropdown, and the easier half to
   get wrong: a source's postings outnumber its entries, so an option built from
   the posting counts already on the page would read 620 beside a tally of 145
   and still look plausible. */
test('every Source option on Journal entries counts in entries', async ({ page }) => {
  await settle(page, '/general-ledger')
  await view(page, 'Journal entries').click()
  expect((await tally(page)).unit).toBe('entries')
  expect(await eachOptionKeepsItsCount(page, 'Source', 'entries'), 'the period holds at least one source').toBeGreaterThan(0)
})

/* The General ledger tab draws the same dropdown since 2026-09-30 (Mahad: *"can
   we also have the source filter in general ledger listing page as well"*), and
   there each option counts in postings, the unit that tab lists. */
test('every Source option on General ledger counts in postings', async ({ page }) => {
  await settle(page, '/general-ledger')
  await view(page, 'General ledger').click()
  expect((await tally(page)).unit).toBe('postings')
  expect(await eachOptionKeepsItsCount(page, 'Source', 'postings'), 'the period holds at least one source').toBeGreaterThan(0)
})

// One list of sources on both tabs, each counted in its own unit.
test('offers the same sources on both tabs, fewer entries than postings', async ({ page }) => {
  await settle(page, '/general-ledger')
  await view(page, 'Journal entries').click()
  await openFilter(page, 'Source')
  const entries = await optionCounts(page, 'Source')
  await page.keyboard.press('Escape')
  await view(page, 'General ledger').click()
  await openFilter(page, 'Source')
  const postings = await optionCounts(page, 'Source')
  expect(postings.map(o => o.label)).toEqual(entries.map(o => o.label))
  for (let i = 0; i < entries.length; i++) {
    expect(postings[i].count, entries[i].label).toBeGreaterThanOrEqual(entries[i].count)
  }
})

// Several ticked at once narrow to their union, and the trigger says how many.
test('ticks more than one, and reads how many on the trigger', async ({ page }) => {
  await settle(page, '/general-ledger')
  await view(page, 'Journal entries').click()
  const m = await openFilter(page, 'Source')
  const [a, b] = (await optionCounts(page, 'Source')).filter(o => o.count)
  await m.getByRole('menuitemcheckbox').filter({ hasText: a.label }).click()
  await m.getByRole('menuitemcheckbox').filter({ hasText: b.label }).click()
  expect((await tally(page)).shown).toBe(a.count + b.count)
  await expect(trigger(page, 'Source')).toContainText('2 selected')
  // One click clears it, from the trigger itself.
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Clear Source filter', exact: true }).click()
  await expect(trigger(page, 'Source')).toContainText('All')
})

/* The two tabs list different things, so the same ledger has to come out as two
   different figures. Without this the tally could count postings on both tabs -
   the original bug - and each tab would still agree with itself. */
test('the entries tab counts fewer rows than the postings tab', async ({ page }) => {
  await settle(page, '/general-ledger')
  await view(page, 'Journal entries').click()
  const entries = await tally(page)
  await view(page, 'General ledger').click()
  const postings = await tally(page)
  expect(entries.total).toBeLessThan(postings.total)
})

/* Mahad, 2026-09-18: *"Remove 5 main categories as quick filters from journal
   entries screen."*

   An entries row is a whole journal entry assembled from the postings that
   survive the filters, so keeping one category strikes out the other half of
   every entry that crosses two - and the entry row above the survivors goes on
   printing a debit total against a credit total that no longer matches it. A
   tree row is a single posting, so the same filter is coherent there and the
   strip stays.

   Category is still a column filter on both tabs, which narrows the postings the
   same way but says so in a chip the reader can see and clear. */
test.describe('the entries tab offers no category quick filters', () => {
  /* The tab draws a strip of its own - the Amount range and the Source dropdown.
     What Mahad struck off is the five categories, and they are what must stay
     off: a source keeps whole entries, a category cannot. */
  test('offers no Category filter, though its Source dropdown is full', async ({ page }) => {
    await settle(page, '/general-ledger')
    await view(page, 'Journal entries').click()
    await expect(trigger(page, 'Category')).toHaveCount(0)
    await openFilter(page, 'Source')
    const options = await optionCounts(page, 'Source')
    expect(options.filter(o => CATEGORIES.includes(o.label)), 'a category offered as a source').toEqual([])
    expect(options.length).toBeGreaterThan(2)
  })

  /* A source used to stop filtering at the switch, because the General ledger
     tab drew no source control to show it or clear it from. It draws the same
     dropdown now, so a source holds on both tabs, as Amount does - and the tab
     switched to says so on its trigger and counts its option in its own unit. */
  test('carries a source across tabs, shown on the trigger of both', async ({ page }) => {
    await settle(page, '/general-ledger')
    await view(page, 'Journal entries').click()
    const m = await openFilter(page, 'Source')
    await m.getByRole('menuitemcheckbox').filter({ hasText: 'Payroll Run' }).click()
    await page.keyboard.press('Escape')
    const narrowed = await tally(page)
    // Or the switch below proves nothing, because nothing was filtered out.
    expect(narrowed.shown).toBeLessThan(narrowed.total)

    await view(page, 'General ledger').click()
    await expect(trigger(page, 'Source')).toContainText('Payroll Run')
    const after = await tally(page)
    expect(after.unit).toBe('postings')
    expect(after.shown).toBeLessThan(after.total)
    await openFilter(page, 'Source')
    const payroll = (await optionCounts(page, 'Source')).find(o => o.label === 'Payroll Run')!
    expect(after.shown, 'the ledger keeps the payroll postings its option counts').toBe(payroll.count)
  })

  /* The strip is hidden rather than unmounted per tab, so the state behind it
     survives the switch. It must stop filtering too, or a category chosen on the
     General ledger tab goes on narrowing the entries tab with no control showing
     it and nothing to clear it from. */
  test('does not carry a category chosen on the General ledger tab', async ({ page }) => {
    await settle(page, '/general-ledger')
    await view(page, 'Journal entries').click()
    const before = await tally(page)

    await view(page, 'General ledger').click()
    await page.getByRole('button', { name: /^Asset\b/ }).first().click()
    const narrowed = await tally(page)
    // Or the switch below proves nothing, because nothing was filtered out.
    expect(narrowed.shown).toBeLessThan(narrowed.total)

    await view(page, 'Journal entries').click()
    const after = await tally(page)
    expect(after.shown, 'the entries tab still lists every entry').toBe(before.shown)
  })

  /* One rule between the toolbar and the table, wherever it falls. The entries
     tab used to have no strip at all, so the search row carried it; since the
     Amount range moved down (2026-09-29) the tab has a strip of its own, and the
     strip is what closes the card off. What must not happen either way is two
     rules, or none. */
  test('keeps a rule under the toolbar', async ({ page }) => {
    await settle(page, '/general-ledger')
    await view(page, 'Journal entries').click()
    const { top, strip, stripHolds } = await page.getByPlaceholder('Search entries').evaluate(el => {
      const row = el.closest('div[class*="pt-3.5"]')!
      const next = row.nextElementSibling as HTMLElement | null
      return {
        top: row.className,
        strip: next?.className ?? '',
        stripHolds: !!next?.querySelector('button[aria-label^="Amount range"]'),
      }
    })
    expect(stripHolds, 'the strip under the search row is the Amount pill row').toBe(true)
    expect(strip, 'the strip closes the card off from the table').toContain('border-b')
    expect(top, 'and the search row does not rule it a second time').not.toContain('border-b')
  })
})
