import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/* Clicking a journal entry on a posting account's register opens the quick
   view: the whole entry in a panel over the register - both sides, the status,
   and the totals that prove it balances - with "Open full entry" one click
   further on for anyone who wants the page.

   It was briefly tried the other way, unrolling the other side of the posting
   under the row in the register's own columns. That answered "what was the
   other side?" and nothing else: no totals, no status, no proof the entry
   balanced, and the register's columns are shaped for one account's postings
   rather than for a whole entry. The panel says all of it at once, and the
   register underneath keeps its filters, sort and scroll either way.

   These lock the shape: the register opens the panel and nothing unrolls in
   the grid; and the Source column names the kind of thing that produced the
   row, so a reader can tell a bill from a manual entry without opening
   anything. */

const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8')

describe('the register opens an entry in the quick view', () => {
  const detail = read('pages', 'AccountDetail.tsx')
  const register = detail.match(/function RegisterTab\([\s\S]*?\n}\n/)![0]

  it('opens the panel from the row and from the entry number', () => {
    expect(register).toMatch(/const \[quickJe, setQuickJe\]/)
    expect(register).toMatch(/onClick=\{\(\) => setQuickJe\(t\.jeNumber\)\}/)
    const entryCell = register.match(/case 'entry': return[\s\S]{0,700}/)![0]
    expect(entryCell).toMatch(/onClick=\{\(\) => setQuickJe\(t\.jeNumber\)\}/)
  })

  it('mounts the panel inside the register, wired to its own state', () => {
    expect(register).toMatch(/<JournalEntryQuickView jeNumber=\{quickJe\} onClose=\{\(\) => setQuickJe\(null\)\}/)
  })

  /* The reader opened this from one account, and an entry has two sides or
     more. Marking their own line is how the panel says which of them they were
     looking at - without it they have to find their own account in the list. */
  it('tells the panel which account the reader came from', () => {
    expect(register).toMatch(/<JournalEntryQuickView[\s\S]{0,120}highlightAccountId=\{accountId\}/)
    const quick = read('components', 'JournalEntryQuickView.tsx')
    expect(quick).toMatch(/l\.accountId === highlightAccountId/)
    expect(quick).toContain('THIS ACCOUNT')
  })

  it('states the totals, which is what the register cannot', () => {
    // A register row is one side of an entry. The panel is the whole entry, so
    // it can show that the debits and the credits agree.
    const quick = read('components', 'JournalEntryQuickView.tsx')
    expect(quick).toMatch(/<td colSpan=\{2\}>Totals<\/td>/)
    expect(quick).toMatch(/entry\.totalDebit/)
    expect(quick).toMatch(/entry\.totalCredit/)
  })

  it('offers the full page rather than replacing it', () => {
    const quick = read('components', 'JournalEntryQuickView.tsx')
    expect(quick).toContain('openLabel="Open full entry"')
    expect(quick).toMatch(/navigate\(`\/general-ledger\/entry\//)
  })

  /* Nothing unrolls in the grid any more, so the pieces that served it are
     gone rather than left behind unread: the expansion component, the toggle
     state, and the chevron gutter that used to sit ahead of the first column. */
  it('leaves nothing of the inline expansion behind', () => {
    expect(detail).not.toMatch(/RegisterEntryExpansion/)
    expect(detail).not.toMatch(/toggleExpansion|expandedJes|closingJes/)
    expect(detail).not.toMatch(/REGISTER_CHEV_W/)
    expect(detail).not.toMatch(/'Collapse entry'/)
  })

  it('leaves the linked document to the column that already carries it', () => {
    // Clickable from the register's own cell, with the click stopped short of
    // the row so it opens the document rather than the entry behind it.
    expect(register).toMatch(/case 'reference': return[\s\S]{0,200}onClick=\{e => e\.stopPropagation\(\)\}[\s\S]{0,300}LinkedDocLink/)
  })
})

describe('the source of a posting shows in the grid', () => {
  const detail = read('pages', 'AccountDetail.tsx')
  const gl = read('pages', 'GeneralLedger.tsx')

  it('is a column on both grids, not only on the entry detail', () => {
    /* A reader scanning the register for a bill they can pay versus a manual
       entry someone wrote should not need to open each row to tell them apart.
       The kind of thing that produced the posting rides alongside the entry
       number. */
    expect(detail).toMatch(/key: 'source', label: 'Source'/)
    expect(gl).toMatch(/key: 'source', label: 'Source'/)
  })

  it('reads the label off the SOURCE_DOC map, not the raw source key', () => {
    // "vendor invoice" reads like something; "AP Bill" reads like a field.
    expect(detail).toMatch(/sourceDocLabel\(t\.source\)/)
    // The ledger searches and prints a source as its column writes it
    // (sourceDocName, which reads SOURCE_DOC), never as the raw key.
    expect(gl).toMatch(/source: \(\{ t \}\) => sourceDocName\(t\.source\)/)
    expect(gl).toMatch(/<Marked text=\{sourceDocName\(t\.source\)\}/)
  })
})

describe('the amount filter names its own rule', () => {
  it('says it matches on size, not on sign, on both grids', () => {
    // The comparator was already magnitude-based; what changed is that the
    // rule now reads on screen instead of only in the code.
    const detail = read('pages', 'AccountDetail.tsx').match(/Amount range[\s\S]{0,500}/)![0]
    // In Mahad's copy of 2026-10-12.
    expect(detail).toMatch(/Matches debits and credits alike, so \$1,000 finds either one\./)
    /* The ledger's range moved out of Filters onto the toolbar (design review,
       2026-09-28), and says the same rule in its own popover. */
    const ledger = read('pages', 'GeneralLedger.tsx').match(/function AmountRangeControl[\s\S]{0,3000}/)![0]
    expect(ledger).toMatch(/Matches on size/)
    expect(ledger).toMatch(/1,000 finds both a \$1,000 debit and a \$1,000 credit/)
  })
})

describe('the amount range stands with the quick-filter pills', () => {
  const page = read('pages', 'GeneralLedger.tsx')
  const control = page.match(/function AmountRangeControl[\s\S]{0,3000}/)![0]

  it('sits inside the pill row ahead of the divider, not beside Filters', () => {
    // Mahad, 2026-09-29: *"Dont you think this filter be next to see all pill?
    // Similar to what we did here in the COA listing page"*. It slices the rows
    // the category pills slice, so it stands where the chart's Dimensions does -
    // ahead of the divider, with Show All first on the other side of it.
    // Measured against the pill row's own opening tag, not against Show All:
    // beside Filters it was already earlier in the file than Show All, so source
    // order alone cannot tell the two placements apart.
    const pillRow = page.indexOf('<div className="flex items-center gap-1.5 overflow-x-auto')
    const amount = page.indexOf('<AmountRangeControl')
    const divider = page.indexOf('<div className="w-px h-5 bg-border shrink-0 mx-0.5" />')
    const showAll = page.indexOf('label="Show All"')
    expect(pillRow).toBeGreaterThan(-1)
    expect(amount).toBeGreaterThan(pillRow)
    expect(divider).toBeGreaterThan(amount)
    expect(showAll).toBeGreaterThan(divider)
    expect(page.indexOf('<FiltersButton')).toBeLessThan(pillRow)
  })

  it('wears the quick-filter pill\'s own shape and tint, as Dimensions does', () => {
    expect(control).toContain('px-3 py-1.5 rounded-full border text-xs')
    expect(control).toContain("'border-primary bg-accent hover:bg-[#DBEAFE] active:bg-[#BFDBFE]'")
  })

  it('holds on both tabs, so the entries tab keeps a pill row of its own', () => {
    // The row used to be General ledger only, because the category pills cannot
    // filter an entry without unbalancing it. Amount asks about the entry's own
    // total, so the row renders either way and only the categories are gated.
    expect(page).not.toMatch(/\{view === 'tree' && \(\s*<div className="flex items-center gap-1\.5 overflow-x-auto/)
    const row = page.match(/<div className="flex items-center gap-1\.5 overflow-x-auto[\s\S]{0,1400}/)![0]
    expect(row.indexOf('<AmountRangeControl')).toBeLessThan(row.indexOf("view === 'tree'"))
  })
})

describe('the period selector reads as a control, with a delayed hint', () => {
  const strip = read('components', 'PeriodStrip.tsx')

  it('carries the hint on the picker itself, not on a separate info icon', () => {
    // The old shape put the hint on an Info dot to the right of the strip.
    // A reader wondering what the picker does would not have looked there
    // first, and the icon was noise for everyone who already knew.
    expect(strip).not.toContain('<Info')
    expect(strip).toMatch(/Tooltip delayMs=\{600\}[\s\S]{0,400}AccountingPeriodPicker/)
  })

  it('explains what the control changes, page by page, in plain English', () => {
    expect(strip).toContain("export const LEDGER_PERIOD_HINT = 'Accounting period to view, set to the current period by default.'")
    expect(strip).toContain('but not the running balance.')
    expect(strip).not.toMatch(/re-strikes/i)
  })
})
