import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  arrivalCodeText, importedText, blankFilter, matchesColFilters, uniqueColValues,
  DEFAULT_COLUMNS, DEFAULT_COLUMN_ORDER, HEADER_DEFS, type ColFilters,
} from './AccountTable'
import { applyFilters, countFiltersActive, EMPTY_FILTERS } from './Filters'
import { useStore } from '../store'
import type { Account } from '../types'

/* Two questions that look like one and are not: "did this account come in
   through an import" and "what number did it come in as". A migration answers
   the first for a whole branch and the second only for the rows the file
   actually states - the parent summaries it implies get no code at all.

   Everything here exists to stop the two collapsing back into each other. Read
   the codes as the flag and half an imported branch reports itself as
   hand-made, which is exactly the reassurance a customer mid-migration is
   looking for and exactly the wrong answer to give them. */

const seed = useStore.getState().accounts[0]
const account = (id: string, provenance: Partial<Account>): Account => ({ ...seed, id, ...provenance })

const TYPED_IN = account('typed', { arrivedByImport: undefined, originalCode: undefined })
const IMPORTED = account('imported', { arrivedByImport: true, originalCode: '10200-00' })
const IMPLIED_PARENT = account('implied', { arrivedByImport: true, originalCode: undefined })
const COLLAPSED = account('collapsed', { arrivedByImport: true, originalCode: '12000' })

const CHART = [TYPED_IN, IMPORTED, IMPLIED_PARENT, COLLAPSED]

describe('the flag and the arrival code answer different questions', () => {
  it('reports an imported account with no code of its own as imported', () => {
    expect(importedText(IMPLIED_PARENT)).toBe('Yes')
    expect(arrivalCodeText(IMPLIED_PARENT)).toBe('')
  })

  it('reports a hand-created account as not imported', () => {
    expect(importedText(TYPED_IN)).toBe('No')
  })

  /* One number, never a list. Mahad, 2026-09-22: *"prior account number is
     always one number that was imported."* A summary a file states once per
     group keeps the statement that landed; the others are named as folded on the
     review grid, not stacked into this field. */
  it('states one code for a summary several rows folded into', () => {
    expect(arrivalCodeText(COLLAPSED)).toBe('12000')
  })
})

describe('the Origin filter', () => {
  const ids = (arrivedByImport: ('yes' | 'no')[]) =>
    applyFilters(CHART, { ...EMPTY_FILTERS, arrivedByImport }).map(a => a.id)

  it('asks nothing when neither value is picked', () => {
    expect(ids([])).toEqual(['typed', 'imported', 'implied', 'collapsed'])
  })

  it('pulls up the whole imported branch, including the parent with no code', () => {
    expect(ids(['yes'])).toEqual(['imported', 'implied', 'collapsed'])
  })

  it('pulls up only what was added here', () => {
    expect(ids(['no'])).toEqual(['typed'])
  })

  it('counts toward the Filters badge', () => {
    expect(countFiltersActive({ ...EMPTY_FILTERS, arrivedByImport: ['yes'] })).toBe(1)
  })
})

describe('the column filters', () => {
  const asking = (f: ColFilters) => CHART.filter(a => matchesColFilters(a, f, CHART)).map(a => a.id)

  it('finds an account by part of the number it arrived as', () => {
    expect(asking({ originalNumber: { ...blankFilter('originalNumber'), text: '10200' } })).toEqual(['imported'])
  })

  it('finds a collapsed summary by the code it arrived as', () => {
    expect(asking({ originalNumber: { ...blankFilter('originalNumber'), text: '12000' } })).toEqual(['collapsed'])
  })

  it('picks imported accounts by the yes/no value the cell shows', () => {
    expect(asking({ imported: { ...blankFilter('imported'), values: ['Yes'] } })).toEqual(['imported', 'implied', 'collapsed'])
    expect(asking({ imported: { ...blankFilter('imported'), values: ['No'] } })).toEqual(['typed'])
  })

  /* Offered whichever way the chart happens to lean. A facet that vanishes on a
     wholly imported chart reads as a broken filter, not as an empty answer. */
  it('offers both values whatever the chart holds', () => {
    expect(uniqueColValues('imported', [TYPED_IN])).toEqual(['Yes', 'No'])
    expect(uniqueColValues('imported', [IMPORTED])).toEqual(['Yes', 'No'])
  })
})

describe('where the two columns sit', () => {
  it('ships both hidden, because provenance is a migration question and not a daily one', () => {
    expect(DEFAULT_COLUMNS.originalNumber).toBe(false)
    expect(DEFAULT_COLUMNS.imported).toBe(false)
  })

  it('still offers both, so hidden does not mean absent', () => {
    expect(DEFAULT_COLUMN_ORDER).toContain('originalNumber')
    expect(DEFAULT_COLUMN_ORDER).toContain('imported')
  })

  /* "Prior", not "Original", and spelled out as a number rather than a code.
     Original named the before half of a change - Mahad: *"Original account number
     reads as though the number was changed, not imported"* - which is what the
     audit log answers, not this column. */
  it('names the number the account arrived with as a prior one', () => {
    expect(HEADER_DEFS.originalNumber.label).toBe('Prior account number')
    expect(HEADER_DEFS.originalNumber.label).not.toMatch(/original/i)
    expect(HEADER_DEFS.imported.label).toBe('Imported')
  })

  /* And the detail page calls it the same thing. Mahad: *"The information in the
     details page of the accounts should match the listing page columns. E.g.
     arrived as should be renamed to prior account number"* - the rail said
     "Arrived as", a phrase of its own for a fact the listing already had a name
     for, so a reader who turned the column on and then opened the account could
     not tell they were reading it twice.

     Read off `HEADER_DEFS` rather than retyped, because a rename there has to
     carry, and a second literal here would just be the same drift with a test
     over it. */
  it('is what the account detail rail calls it too', () => {
    const detail = readFileSync(join(__dirname, '..', 'pages', 'AccountDetail.tsx'), 'utf8')
    expect(detail).toContain(HEADER_DEFS.originalNumber.label)
    expect(detail).not.toContain('Arrived as')
    // Singular, and no branch left that could make it plural again.
    expect(detail).not.toContain('Prior account numbers')
  })

  /* The tooltip carried the misreading too, opening on the renumber rather than
     on the import. Renumbering still earns a mention, as the thing that does not
     rewrite this, but it cannot come first. */
  it('explains the column by the import, not by a renumber', () => {
    const info = HEADER_DEFS.originalNumber.info!
    expect(info).toMatch(/^The number this account came in as when it was imported\./)
    expect(info.indexOf('imported')).toBeLessThan(info.indexOf('Renumbering'))
  })
})

/* Provenance is asked for from the Columns panel and answered in a column, and
   that is the only place it is answered.

   Two things were tried beside the name first. A switch by the quick-filter
   pills that turned the original-number column on and chipped every imported
   row; then, once the switch went, just the chip, gated on that column being on.
   Both are gone. The Imported column answers the question for every row and in
   both directions, so a chip next to the name was restating a cell a few columns
   over - Mahad: *"now that we have this column, I think it's meaningless to show
   case an imported pill next to the GL account name"*. What is left beside a name
   is Needs action, which is a thing to go and do rather than a fact to read. */
describe('provenance is asked for from the Columns panel', () => {
  const coa = readFileSync(join(__dirname, '..', 'pages', 'ChartOfAccounts.tsx'), 'utf8')
  const badge = () => coa.match(/const rowBadge = [\s\S]{0,700}?\n\n/)![0]

  it('offers no switch of its own on the listing', () => {
    expect(coa).not.toMatch(/importedView|toggleImportedView|orderWithArrivalBesideNumber/)
    expect(coa).not.toMatch(/label="Imported"/)
  })

  it('says nothing about provenance beside the account name', () => {
    expect(badge()).not.toContain('arrivedByImport')
    expect(badge()).not.toContain('Imported')
  })

  it('still carries Needs action, which is a thing to go and do', () => {
    expect(badge()).toContain('needsBankDetails')
    expect(badge()).toContain('NeedsActionChip')
  })

  it('still ships the columns, so the question is still answerable', () => {
    expect(DEFAULT_COLUMN_ORDER).toContain('originalNumber')
    expect(DEFAULT_COLUMN_ORDER).toContain('imported')
  })

  /* Both answers wear the same chip, differing only in tone. One chipped and one
     as plain text read as an answer and a blank, when they are two answers - and
     the column sorts and filters on both. */
  it('chips Yes and No alike in the Imported column', () => {
    const table = readFileSync(join(__dirname, 'AccountTable.tsx'), 'utf8')
    const cell = table.match(/export function ImportedCell[\s\S]{0,400}?\n\}/)![0]
    expect(cell).toContain('<Badge tone="info" className={PARTNER_CHIP_CLS}>Yes</Badge>')
    expect(cell).toContain('<Badge tone="neutral" className={PARTNER_CHIP_CLS}>No</Badge>')
  })
})

/* The seeded chart carries a migrated cash and receivables branch, so the
   columns and the Origin filter have something to show before anyone runs an
   import. These guard the two rows shaped to exercise the awkward cases. */
describe('the seeded chart', () => {
  const accounts = useStore.getState().accounts
  const byNumber = (n: string) => accounts.find(a => a.accountNumber === n)!

  it('flags the migrated branch', () => {
    expect(byNumber('11130').arrivedByImport).toBe(true)
    expect(arrivalCodeText(byNumber('11130'))).toBe('1020-00')
  })

  /* Mahad, 2026-09-21: *"Prior account number should be there for imported
     accounts."* The seed used to hold one account back as the code-less case, and
     the rail answered it with "No number of its own". An account that arrived by
     import arrived as something, so the demo states it on every one of them. The
     model still allows the empty case (an import whose file has no arrival
     column) - it is the seeded chart that no longer shows it. */
  it('gives every imported account a number it arrived as', () => {
    const imported = accounts.filter(a => a.arrivedByImport)
    expect(imported.length).toBeGreaterThan(10)
    for (const a of imported) expect(arrivalCodeText(a), a.accountNumber).not.toBe('')
  })

  /* And exactly one, summaries included. Mahad, 2026-09-22: *"prior account
     number is always one number that was imported."* The two summaries here used
     to list every old header they answer for. */
  it('gives no account more than one number it arrived as', () => {
    for (const a of accounts) expect(a.originalCode ?? '', a.accountNumber).not.toContain(',')
    expect(arrivalCodeText(byNumber('11100'))).toBe('1010')
    expect(arrivalCodeText(byNumber('11300'))).toBe('1200')
  })

  /* The two columns sit side by side, so a legacy code shaped like a current
     number invites the reader to pair up rows that have nothing to do with each
     other: 11100-00 beside an account genuinely numbered 11100. The old chart is
     four digits and this one is five (it ran the other way round until the chart
     went to five digits on 2026-09-25), and that gap is what keeps the column
     answering one question instead of raising a second. */
  it('numbers the old chart where it cannot be read as this one', () => {
    const live = new Set(accounts.map(a => a.accountNumber))
    const codes = accounts.flatMap(a => (a.originalCode ? [a.originalCode] : []))
    expect(codes.length).toBeGreaterThan(10)
    for (const code of codes) {
      const natural = code.split('-')[0]
      expect(natural, code).toMatch(/^\d{4}$/)
      expect(live.has(natural), code).toBe(false)
      expect(live.has(code), code).toBe(false)
    }
  })

  /* An account's own history has to name the account it happened to. This entry
     read 1015 → 1020 on the account numbered 1030 - both of those are live
     numbers belonging to other rows in the same branch. */
  it('renumbers the operating bank to the number it actually carries', () => {
    const bank = byNumber('11130')
    const renumber = useStore.getState().auditLog
      .find(e => e.accountId === bank.id && e.field === 'accountNumber')!
    expect(renumber.newValue).toBe('11130')
    expect(accounts.some(a => a.accountNumber === renumber.oldValue)).toBe(false)
  })

  it('leaves the rest of the chart reporting that it was added here', () => {
    expect(byNumber('32000').arrivedByImport).toBe(false)
    expect(accounts.some(a => !a.arrivedByImport)).toBe(true)
  })
})
