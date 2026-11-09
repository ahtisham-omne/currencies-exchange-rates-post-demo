import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { SCRATCH_DIMENSIONS_LABEL, SCRATCH_DIMENSIONS_COPY } from './Setup'
import { DimensionsEditor, DIMENSION_NOUN } from '../components/DimensionsEditor'
import { DIMENSION_STATES } from './Dimensions'
import type { Dimension } from '../types'

// The dimensions step is the only place a build-from-scratch customer meets
// the concept, and it arrives with nothing on screen to infer it from. So the
// words are the step. They are pinned here because the step body is a shared
// editor that says nothing about why the reader is looking at it.

const scratchEditor = (dimensions: Dimension[]) => renderToStaticMarkup(createElement(DimensionsEditor, {
  dimensions, onCreate: () => {}, onUpdate: () => {}, onDelete: () => {},
  emptyHint: SCRATCH_DIMENSIONS_COPY.emptyHint,
}))

describe('build-from-scratch dimensions step', () => {
  it('asks what the reader wants, not what the system stores', () => {
    // "Set up dimensions" would name our word for it and ask the reader to
    // already know what it means. The question is answerable without the noun.
    expect(SCRATCH_DIMENSIONS_COPY.title).toBe('What do you want to report by?')
    expect(SCRATCH_DIMENSIONS_COPY.title).not.toMatch(/dimension/i)
  })

  // Mahad's copy, 2026-10-02.
  it('says what to add, with the two examples', () => {
    expect(SCRATCH_DIMENSIONS_COPY.subtitle).toBe('Add the things your company wants to organize and filter accounts by, such as Location or Department.')
  })

  it('says the step is optional, because nothing on it is required', () => {
    // The button is never disabled here, so the footer has to account for itself.
    expect(SCRATCH_DIMENSIONS_COPY.skipHint).toBe('You can skip this and add dimensions later.')
    expect(SCRATCH_DIMENSIONS_COPY.skipHint).toMatch(/skip/)
  })

  it('labels the step with the noun, since a tab has no room to explain', () => {
    expect(SCRATCH_DIMENSIONS_LABEL).toBe('Dimensions')
    expect(SCRATCH_DIMENSIONS_LABEL.endsWith('.')).toBe(false)
  })

/* One noun, module-wide. These surfaces used to say "group filter" and keep the
   word "dimension" out of the reader's way deliberately; that split is gone, and
   the retired word must not come back through a card nobody re-read. */
  it('calls it a dimension everywhere the reader can see', () => {
    for (const line of Object.values(SCRATCH_DIMENSIONS_COPY)) {
      expect(line, line).not.toMatch(/group.filter/i)
    }
    const html = scratchEditor([])
    expect(html).not.toMatch(/group.filter/i)
    expect(html).toContain('No dimensions yet')
    expect(html).toContain('Add dimension')
  })

  /* Nothing the customer has not typed. The step used to open on the demo's
     three, which read as ours rather than theirs and had the reader deleting
     before they defined. */
  it('opens empty, and says what a dimension is before there is an example', () => {
    const html = scratchEditor([])
    expect(html).not.toContain('Miscellaneous')
    // The apostrophe in "You'll" is escaped in the markup, so the first sentence stands for the line.
    expect(html).toContain('Add a dimension, such as Location, and list its values.')
    expect(SCRATCH_DIMENSIONS_COPY.emptyHint).toContain('Location')
  })

  /* The standing page carries the same noun as the step. Read off the source
     because the page mounts a router and a portal, neither of which this
     environment has. */
  it('says dimension on the standing page too, and never group filter', () => {
    const page = readFileSync(join(__dirname, 'Dimensions.tsx'), 'utf8')
    for (const line of page.match(/(?<=title=|subtitle=|description=|confirmLabel=|dismissLabel=|badge=|backTitle=)"[^"]+"/g) ?? []) {
      expect(line, line).not.toMatch(/group.filter/i)
    }
    expect(page).toContain('title="Dimensions"')
    expect(page).toContain('Add dimension')
    expect(page).toContain('No dimensions yet')
  })

  /* One constant, not a prop each surface passes. The editor took a `noun` so
     the setup flows could say "group filter" while the standing page said
     "dimension"; with one word there is nothing left to override, and a hook for
     a second word is how a second word gets back in. */
  it('offers one word for the thing, and no way to pass another', () => {
    expect(DIMENSION_NOUN).toEqual({ one: 'dimension', many: 'dimensions' })
    expect(readFileSync(join(__dirname, '..', 'components', 'DimensionsEditor.tsx'), 'utf8'))
      .not.toMatch(/noun\?:/)
  })

  /* The Chart of Accounts sends the reader to the standing page rather than
     opening a form of its own. It used to carry a "Create dimension" button
     beside Create GL account, which put the same job in two places and left the
     one on the listing unable to show what was already defined. */
  it('reaches dimensions from the chart of accounts through the Actions menu', () => {
    const coa = readFileSync(join(__dirname, 'ChartOfAccounts.tsx'), 'utf8')
    expect(coa).toContain("navigate('/dimensions')")
    expect(coa).toContain('>Dimensions<')
    expect(coa).not.toContain('Create dimension')
    expect(coa).not.toContain('DimensionFormModal')
  })

  /* Nothing is posted during setup, so a dimension defined there cannot need
     the softer move that Deactivate exists to be: every one the reader has just
     typed is Active, and a column of one repeated word is not a column. Removing
     it takes the actions with it, since a status you cannot see is not one to
     change. The standing page is where a status is worth having, and it has its
     own table for it. */
  it('shows no status on the setup step, and a picker on the standing page', () => {
    const dims: Dimension[] = [
      { id: 'd1', name: 'Location', values: ['London'], status: 'Active', createdAt: '', updatedAt: '' },
      { id: 'd2', name: 'Department', values: [], status: 'Inactive', createdAt: '', updatedAt: '' },
    ]
    const setup = renderToStaticMarkup(createElement(DimensionsEditor, {
      dimensions: dims, onCreate: () => {}, onUpdate: () => {}, onDelete: () => {},
    }))

    /* The row menu is closed, so Deactivate / Activate cannot be read off the
       markup and asserting their absence here would pass for the wrong reason.
       The column and the badges are what the eye meets. */
    expect(setup).not.toContain('Status')
    expect(setup).not.toContain('Active')
    expect(setup).not.toContain('Inactive')
    // The dimensions themselves are untouched - only the column is gone.
    expect(setup).toContain('Location')
    expect(setup).toContain('Department')

    /* Two states, and no Archived: an account is archived so its balance and its
       postings stay readable, and a dimension has neither. Removing one is a
       separate move, and it is the one that asks first. */
    expect(DIMENSION_STATES.map(s => s.status)).toEqual(['Active', 'Inactive'])
    for (const s of DIMENSION_STATES) {
      expect(s.meaning, s.meaning).not.toMatch(/dimension/i)
      expect(s.meaning, s.meaning).not.toContain('—')
      expect(s.meaning.endsWith('.'), s.meaning).toBe(true)
    }
  })

  it('keeps every line in the house voice', () => {
    for (const line of Object.values(SCRATCH_DIMENSIONS_COPY)) {
      expect(line, line).not.toContain('—')
      expect(line, line).not.toContain('–')
      expect(line, line).not.toContain('’')
      expect(line, line).not.toMatch(/\bwe('|’)?ll\b/i)
      // Retired General Ledger vocabulary: dimensions do not "slice".
      expect(line, line).not.toMatch(/\bslice/i)
    }
    // Sentences end. The title is a question, which ends too.
    expect(SCRATCH_DIMENSIONS_COPY.title.endsWith('?')).toBe(true)
    expect(SCRATCH_DIMENSIONS_COPY.subtitle.endsWith('.')).toBe(true)
    expect(SCRATCH_DIMENSIONS_COPY.skipHint.endsWith('.')).toBe(true)
    expect(SCRATCH_DIMENSIONS_COPY.emptyHint.endsWith('.')).toBe(true)
  })

  /* The explanation is a sheet you open, not a block you scroll past. It used to
     be a card above the table, restating in two columns what the reading room
     already says at length - so the page opened on an essay and the long answer
     sat behind a button inside it. One surface now, reached from a Learn button
     beside Add dimension, which is where a reader looks for it on every other
     page in the module. */
  it('offers the explanation as a sheet from the header, not as a block above the table', () => {
    const page = readFileSync(join(__dirname, 'Dimensions.tsx'), 'utf8')
    expect(page).toContain('<ReadingRoom')
    expect(page).toContain('>Learn</Button>')
    expect(page).toContain('secondaryActions=')
    expect(page).not.toContain('DimensionsExplainer')
    expect(page).not.toContain('Learn more')

    /* And it runs the full height of the window. The sheet places itself against
       the nearest positioned ancestor, and the shell's page-in transform is one,
       so mounted in the page tree it came out the height of the content area and
       stopped short of the fold. Portaled to <body>, like every other overlay in
       the module. */
    expect(page).toContain('document.body')

    // Nothing the card said is lost: the definition it led with is the module's
    // one sentence for the word, and it has to be in the sheet that replaced it.
    const room = readFileSync(join(__dirname, 'scratchReadingRoom.tsx'), 'utf8')
    expect(room).toContain('A dimension is something your company wants to organize or filter accounts by')
  })

  /* The standing page is a table of records, so it carries the chart listing's
     toolbar rather than a second set of controls spelled differently. It adopts
     the shared component instead of copying its markup, which is what the
     listing itself did and why the two drifted. */
  it('wears the shared toolbar on the standing page, not a hand-rolled one', () => {
    const page = readFileSync(join(__dirname, 'Dimensions.tsx'), 'utf8')
    expect(page).toContain("from '../components/TableToolbar'")
    expect(page).toContain('<TableToolbar')
    // Search, count and density all come from it, so none are rebuilt.
    expect(page).toContain('density={{')
    expect(page).not.toContain('placeholder="Search')
  })

  /* Filters for who and when, and nothing else. Mahad, 2026-09-22: *"Can we
     remove Filters from the Dimensions page?"* The panel had one facet, Status,
     over a column that is sortable and printed on every row of a list this short.
     It came back on 2026-10-02 holding only Created and Last modified - Eli:
     *"created by and last modified should be surfacable in every grid"*, columns
     and filters both - so what is pinned is that Status stayed gone. */
  it('offers filters for who and when only, with no Status facet', () => {
    const page = readFileSync(join(__dirname, 'Dimensions.tsx'), 'utf8')
    expect(page).toContain('FiltersModal')
    expect(page).toContain('title="Created"')
    expect(page).toContain('title="Last updated"')
    expect(page).not.toContain('title="Status"')
    expect(page).not.toContain('setStatuses')
  })

  /* A handful of columns, the first of which cannot be hidden without leaving
     rows told apart by nothing, and all of which fit. A picker would be a menu
     whose whole job is to turn off a column you can already see, so the toolbar
     is asked for no `columns` and renders no button. Sorting is the part of
     column control that survives at this width, and it is offered on every one. */
  it('leaves the columns picker off, and still sorts every column', () => {
    const page = readFileSync(join(__dirname, 'Dimensions.tsx'), 'utf8')
    expect(page).not.toContain('columns={{')
    expect(page).not.toContain('ColumnSelector')
    for (const k of ['name', 'values', 'status', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt']) expect(page).toContain(`<SortTh k="${k}"`)
  })

  /* Nothing defined and nothing matching are different problems and get
     different ways out - one offers the form, the other offers the search box
     back. Showing the "add your first" copy to someone who has five and mistyped
     a search is the failure this guards. */
  it('separates the empty table from the empty search', () => {
    const page = readFileSync(join(__dirname, 'Dimensions.tsx'), 'utf8')
    expect(page).toContain('No dimensions yet')
    expect(page).toContain('No dimensions match')
    // Search is the only thing that can narrow this table now, so the way out
    // names that and nothing else.
    expect(page).toContain('Clear search')
  })
})
