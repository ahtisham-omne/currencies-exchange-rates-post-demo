import { describe, it, expect } from 'vitest'
import { DEFAULT_COLUMNS, DEFAULT_COLUMN_ORDER, HEADER_DEFS } from '../components/AccountTable'
import { buildExportFields, exportOpensChecked, type ExportReaders } from './ExportAccounts'

/* Mahad, 2026-09-24: *"Open the column configurator and click Show All - only
   those columns should be present in the exports as well. By default only the
   ones that open by default in the Chart of Accounts should be checked."*

   Both halves are arithmetic over two catalogues, so they are pinned here rather
   than in a browser: the modal's own surface - the search, the drag-reorder, the
   locked name, the three writers - is already covered by `exportAccounts.spec.ts`,
   and what these tests answer is whether the two lists still line up, which no
   amount of clicking makes more visible than reading them side by side.

   The drift they exist to catch is not hypothetical. It has happened in both
   directions: Opening balance and Dimensions were on the listing and absent from
   the file entirely, the export opened ticked on Category, Currency and Direct
   Posting months after the listing had hidden all three, and the picker carried
   five fields - Net change, Income/Balance, Contra, Direct posting, Effective
   date - for facts no column on the listing states at all. */

/* The readers are what the fields do with a row, and nothing here asks a field to
   read one. Stubbed so the catalogue can be built without a chart to roll figures
   out of. */
const STUB: ExportReaders = {
  parentNumber: () => '',
  dimensions: () => '',
  figure: () => ({ text: () => '', number: () => null }),
  fx: { text: () => '', number: () => null },
}

const FIELDS = buildExportFields(STUB)

describe('the picker offers the Columns panel catalogue', () => {
  it('offers every column the panel offers, and one field per column', () => {
    const offered = new Set(FIELDS.map(f => f.key))
    for (const key of DEFAULT_COLUMN_ORDER) {
      expect(offered.has(key), `"${HEADER_DEFS[key].label}" can be shown but not exported`).toBe(true)
    }
  })

  it('offers nothing the panel does not, bar the parent a flat file needs', () => {
    /* Parent is not an exception to the rule so much as the rule applied to a
       file: the listing draws the tree by indenting it, and a file has only the
       parent's number to say the same thing. Anything else added here is a fact
       a reader cannot put on screen, which is the drift this test rejects. */
    const extra = FIELDS.map(f => f.key).filter(k => !DEFAULT_COLUMN_ORDER.includes(k as never))
    expect(extra).toEqual(['parent'])
  })

  it('names a column the way the listing header names it', () => {
    // Asserted by value so a rename on the listing fails here rather than
    // quietly leaving the file speaking the old vocabulary.
    for (const f of FIELDS) {
      if (f.key === 'parent') continue
      expect(f.label).toBe(HEADER_DEFS[f.key as keyof typeof HEADER_DEFS].label)
    }
  })

  it('writes a number range as a start and an end under one tick', () => {
    // "1000-1999" in a spreadsheet cell is text that has to be split before it
    // can be compared to anything - but the reader is choosing the reservation,
    // not two halves of it.
    const range = FIELDS.find(f => f.key === 'numberRange')!
    expect(range.columns.map(c => c.label)).toEqual(['Number range start', 'Number range end'])
    for (const f of FIELDS) {
      if (f.key !== 'numberRange') expect(f.columns).toHaveLength(1)
    }
  })
})

describe('what the picker opens ticked', () => {
  const opened = exportOpensChecked(DEFAULT_COLUMNS as unknown as Record<string, boolean>)

  it('is the listing default view, and the locked name', () => {
    expect([...opened].sort()).toEqual([
      'classification', 'fxBalance', 'glType', 'name', 'normalBalance', 'number',
      'numberRange', 'openingBalance', 'restricted', 'role', 'runningBalance', 'status',
    ])
  })

  it('leaves off the columns the listing ships hidden', () => {
    /* Category is hidden because the sticky per-category band already says it,
       and the two provenance columns because migration is a question asked for
       a fortnight and then never. The internal ID is off because it is looked
       up, not read down a column, and the four audit columns because who made
       an account and when is asked of the chart now and then, not read on every
       row. Parent is off for the same reason as anything
       the listing is not showing.

       Dimensions is in this list and ticked on the running page, which is not a
       disagreement: the listing ships the column off and switches it on when the
       chart it is drawing has dimensions in it. The export follows the listing,
       so it follows that too - see `exportAccounts.spec.ts`. */
    const off = FIELDS.map(f => f.key).filter(k => !opened.has(k))
    expect(off.sort()).toEqual(['createdAt', 'createdBy', 'currency', 'description', 'dimensions', 'imported', 'internalId', 'originalNumber', 'parent', 'type', 'updatedAt', 'updatedBy'])
  })

  it('follows the listing when the reader hides a column, rather than a list of its own', () => {
    const listing = { ...DEFAULT_COLUMNS, role: false, type: true } as unknown as Record<string, boolean>
    const next = exportOpensChecked(listing)
    expect(next.has('role')).toBe(false)
    // The half the old intersection got wrong: a column switched on in the
    // listing used to arrive unticked all the same.
    expect(next.has('type')).toBe(true)
  })
})

/* Mahad, 2026-09-29: *"Top-level accounts export a classification the screen
   doesn't show. In the export, ASSETS is 'Current asset' and EXPENSES is 'Cost of
   goods sold', while the screen shows '-' for both."* A category spans its
   classifications; the value stored on its root is only a default, so the file
   leaves the cell empty the way the listing prints a dash. */
describe('the classification column', () => {
  const read = FIELDS.find(f => f.key === 'classification')!.columns[0].text
  const row = (parentId: string | null, glAccountType: 'Summary' | 'Posting') =>
    ({ parentId, glAccountType, statementClassification: 'Current asset' }) as never

  it('writes nothing for a category row', () => {
    expect(read(row(null, 'Summary'))).toBe('')
  })

  it('writes the classification for every other account', () => {
    expect(read(row('acct_10000', 'Summary'))).toBe('Current asset')
    expect(read(row('acct_11100', 'Posting'))).toBe('Current asset')
  })
})
