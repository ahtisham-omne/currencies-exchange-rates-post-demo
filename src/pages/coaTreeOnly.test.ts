import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useStore } from '../store'

/* The Chart of Accounts is drawn one way: nested. It used to carry a Tree/List
   switcher, and List drew every account in one flat run - a second answer to a
   question that has one, since the chart *is* a hierarchy and a flat reading of
   it loses the only thing the page is for. The switcher is gone, not defaulted:
   a control that always lands on the same setting is a control worth removing.

   The General Ledger's own Tree/List pair is a different thing wearing the same
   words - there it names which of two tabs is open, Postings or Journal entries
   - and is untouched. */

const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8')

describe('the chart is drawn nested, and only nested', () => {
  const coa = read('pages', 'ChartOfAccounts.tsx')

  it('renders the tree with no layout branch around it', () => {
    expect(coa).toMatch(/<AccountTree /)
    expect(coa).not.toMatch(/<AccountTable /)
    expect(coa).not.toMatch(/view === 'list'/)
    expect(coa).not.toMatch(/view === 'tree'/)
  })

  it('offers no control for choosing a layout', () => {
    expect(coa).not.toContain('Every account in one flat run')
    expect(coa).not.toContain('Accounts nested under their parents')
    expect(coa).not.toMatch(/setView\(/)
  })

  it('holds no layout preference to choose, on the page or in the store', () => {
    expect(coa).not.toMatch(/s\.coaView/)
    expect(read('store.ts')).not.toMatch(/coaView\b/)
    expect('coaView' in useStore.getState()).toBe(false)
  })

  it('leaves the General Ledger its own pair of tabs', () => {
    // Same two words, a different question: which tab is open, not how a table
    // is laid out. Retiring one must not retire the other.
    expect(useStore.getState().glView).toBe('tree')
    expect(read('pages', 'GeneralLedger.tsx')).toMatch(/s\.glView/)
  })

  /* Expand all / Collapse all was hidden while the flat list was showing, since
     a flat run has nothing to fold. With one layout left it is always on offer. */
  it('always offers the expand control, now nothing can be flat', () => {
    const control = coa.match(/Expand scope[\s\S]{0,600}/)![0]
    expect(control).toContain('Expand all')
    expect(control).not.toMatch(/view === /)
  })

  /* Import used to end by dropping the reader into the flat list, which was how
     it showed them rows that would otherwise be nested out of sight. With no
     flat list to switch to, it opens the tree instead - the same intent, kept. */
  it('still reveals what an import just landed', () => {
    const handler = coa.match(/onViewImported=\{[^}]*\}/)![0]
    expect(handler).toContain("setAllExpanded('expanded')")
    expect(handler).toContain('EMPTY_FILTERS')
  })
})

/* AccountTable is the flat table the List layout drew. It is not deleted: the
   setup wizard still renders it read-only to preview a chart being built, where
   there is no hierarchy to show yet. What went is the listing's option to use
   it, not the component. */
describe('the flat table survives where it is still the right shape', () => {
  it('is still what the setup previews render', () => {
    expect(read('pages', 'Setup.tsx')).toMatch(/<AccountTable /)
  })

  it('is read-only there, so no row menu comes with it', () => {
    for (const m of read('pages', 'Setup.tsx').match(/<AccountTable [\s\S]{0,400}?\/>/g) ?? []) {
      expect(m).toContain('readOnly')
    }
  })
})
