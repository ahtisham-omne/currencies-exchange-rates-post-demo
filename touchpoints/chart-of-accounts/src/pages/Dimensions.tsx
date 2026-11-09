import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Layers, Plus, Pencil, Trash2, MoreHorizontal, Check, ArrowUp, ArrowDown, ArrowUpDown, BookOpen, CircleSlash, CircleCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Button, Card, ConfirmModal, EmptyState, Marked, Menu, MenuItem } from '../components/ui'
import { OverflowCard, OVERFLOW_PILL, StatusChip } from '../components/AccountTable'
import { TableToolbar, type ToolbarDensity } from '../components/TableToolbar'
import { lookSections, useTableLook } from '../components/tableLook'
import { DimensionFormModal, DIMENSION_NOUN, type DimensionDraft } from '../components/DimensionsEditor'
import { ReadingRoom } from '../components/walkthrough/ReadingRoom'
import { DIMENSIONS_PAGE_READING_ROOM } from './scratchReadingRoom'
import { useStore } from '../store'
import { cn, localDayOf } from '../lib/utils'
import { PersonCell, StampCell, peopleIn, PERSON_PAD, personText, stampText } from '../components/AuditCells'
import { searchMatcher } from '../lib/tableSearch'
import { AuditFacet, FDivider, FiltersModal, Section } from '../components/Filters'
import type { Dimension } from '../types'
import { describeUse, dimensionUse, inUse, valuesInUse } from '../lib/dimensionDefaults'

/* Dimensions outlive any one import or setup run, so they get a page of their
   own rather than living only inside a wizard. Reached from the Chart of Accounts
   Actions menu and kept out of the sidebar, like Numbering and Merge: it is a
   thing you configure, not a thing you visit daily. That is also why the header
   carries a Back control - nothing in the sidebar is lit, so without one the way
   out is the browser's.
 *
 * The list is the module's own table rather than a stack of rows in a card. A
 * dimension is a record with a state, and every other list of records in the
 * app is read in a table; being the one that was not made its status pill and
 * its row menu read as decoration on a settings panel. It carries the chart
 * listing's toolbar for the same reason: this is a standing table of records, so
 * the reader should not have to learn that search and density work here but are
 * spelled differently. What it leaves off is the two controls that need a table
 * this one will never be - a Columns picker over a handful of columns, and paging
 * over a set the count already states in full.
 *
 * Who added each dimension and who changed it last, and when, are columns and a
 * Filters panel, as on every grid (design review, 2026-10-02, Eli: *"created by
 * and last modified should be surfacable in every grid"*). Shown rather than
 * hidden: a list this narrow has the room, and with no Columns picker a hidden
 * column would have no way on.
 *
 * Everything here writes straight to the store, so there is no save button. The
 * two moves that repeating will not undo - deactivating, removing - are
 * confirmed first. */
export default function DimensionsPage() {
  const navigate = useNavigate()
  const dimensions = useStore(s => s.dimensions)
  const addDimension = useStore(s => s.addDimension)
  const updateDimension = useStore(s => s.updateDimension)
  const deleteDimension = useStore(s => s.deleteDimension)
  const accounts = useStore(s => s.accounts)
  const transactions = useStore(s => s.transactions)

  // `null` is closed; a string id is editing that one; 'new' is creating.
  const [editing, setEditing] = useState<string | null>(null)
  const [initial, setInitial] = useState<DimensionDraft>(BLANK)
  const [confirmOff, setConfirmOff] = useState<Dimension | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Dimension | null>(null)

  const [query, setQuery] = useState('')
  /* Flat rows and three columns, so of the four blocks the density menu can
     hold this table can honestly offer two: the densities, and Column widths.
     There is no nesting here to restyle. */
  const { look, set: setLook } = useTableLook()
  const density: ToolbarDensity = look.density === 'comfort' ? 'comfortable' : 'condensed'
  const engineSized = look.columnSizing === 'fit' || look.columnSizing === 'equal'
  const [sort, setSort] = useState<Sort>({ key: 'name', dir: 'asc' })
  const [guideOpen, setGuideOpen] = useState(false)
  const [filters, setFilters] = useState<AuditFilters>(NO_AUDIT_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const openNew = () => { setInitial(BLANK); setEditing('new') }
  /* What uses the dimension being removed, and the values of the one being
     edited - read only while a dialog is open, since each is a pass over every
     posting. */
  const deleteUse = useMemo(
    () => (confirmDelete ? dimensionUse(confirmDelete.id, accounts, transactions) : null),
    [confirmDelete, accounts, transactions],
  )
  const editingInUse = useMemo(() => {
    const d = editing && editing !== 'new' ? dimensions.find(x => x.id === editing) : undefined
    return d ? valuesInUse(d.id, d.values, accounts, transactions) : undefined
  }, [editing, dimensions, accounts, transactions])
  const openEdit = (d: Dimension) => {
    setInitial({ name: d.name, values: [...d.values], status: d.status })
    setEditing(d.id)
  }

  /* Search reads every column as it prints - the name, every value (the reader
     is more likely to remember that "Dublin" is in there somewhere than which
     dimension they filed it under), the status, and who made and last changed
     it and when. Mahad, 2026-10-05: *"the search should have everything in
     it."* One matcher, the pattern the marks are drawn with. */
  const searched = useMemo(() => {
    if (!query.trim()) return dimensions
    const found = searchMatcher(query)
    return dimensions.filter(d => [
      d.name, ...d.values, d.status,
      personText(d.createdBy), stampText(d.createdAt),
      personText(modifiedByOf(d)), stampText(modifiedAtOf(d)),
    ].some(found))
  }, [dimensions, query])

  const shown = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1
    return searched.filter(d => matchesAudit(d, filters)).sort((a, b) => {
      const cmp = sort.key === 'values' ? a.values.length - b.values.length
        : sort.key === 'status' ? a.status.localeCompare(b.status)
        : sort.key === 'createdBy' ? personText(a.createdBy).localeCompare(personText(b.createdBy))
        : sort.key === 'createdAt' ? a.createdAt.localeCompare(b.createdAt)
        : sort.key === 'updatedBy' ? personText(modifiedByOf(a)).localeCompare(personText(modifiedByOf(b)))
        : sort.key === 'updatedAt' ? modifiedAtOf(a).localeCompare(modifiedAtOf(b))
        : a.name.localeCompare(b.name)
      // Name breaks every tie, so equal counts and equal states still land in a
      // stable, readable order rather than the store's insertion order.
      return cmp !== 0 ? dir * cmp : a.name.localeCompare(b.name)
    })
  }, [searched, sort, filters])

  const filterCount = countAuditFilters(filters)
  const filtered = query.trim().length > 0 || filterCount > 0

  return (
    /* The card reaches the bottom of the window however few dimensions there
       are, as every listing's does (Partners parity, Mahad 2026-10-09); the page
       scrolls once the list outgrows it. */
    <div className="flex-1 flex flex-col pb-6">
      <PageHeader
        onBack={() => navigate('/chart-of-accounts')}
        backTitle="Back to Chart of Accounts"
        icon={<Layers size={18} />}
        title="Dimensions"
        secondaryActions={
          <Button variant="secondary" icon={<BookOpen size={14} />} onClick={() => setGuideOpen(true)}>Learn</Button>
        }
        primaryAction={<Button icon={<Plus size={14} />} onClick={openNew}>Add dimension</Button>}
      />

      <div className="px-6 lg:px-8 pt-5 flex-1 flex flex-col">
        <Card className="overflow-visible flex-1 flex flex-col">
          <TableToolbar
            search={{ value: query, onChange: setQuery, placeholder: 'Search by name or value' }}
            filters={{ activeCount: filterCount, onClick: () => setFiltersOpen(true), onClear: () => setFilters(NO_AUDIT_FILTERS) }}
            count={{ shown: shown.length, total: dimensions.length, noun: DIMENSION_NOUN.many }}
            density={{
              value: density,
              onChange: d => setLook('density', d === 'comfortable' ? 'comfort' : 'condensed'),
              sections: lookSections({
                widths: { value: look.columnSizing, onChange: v => setLook('columnSizing', v) },
              }),
            }}
          />

          <div className="overflow-x-auto">
            {/* Default is the width the grid defines, Fit hugs the content and
                collects the spare width at the right, Equal splits the frame
                between the columns (spec §7). Nothing here is hand-draggable, so
                `custom` is never reached. */}
            <table
              className={cn('text-sm', look.columnSizing === 'fit' ? 'w-max min-w-full' : 'w-full')}
              style={{ tableLayout: look.columnSizing === 'equal' ? 'fixed' : 'auto' }}
            >
              <thead>
                {/* The listing's header fill, composited over white rather than
                    left as an alpha, so it reads the same here as it does over a
                    scrolling body. */}
                <tr className="border-y border-border bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)] text-muted-foreground">
                  <SortTh k="name" label="Dimension" sort={sort} onSort={setSort} density={density} />
                  <SortTh k="values" label="Values" sort={sort} onSort={setSort} density={density} />
                  {/* Fit and Equal hand every width to the layout engine, so the
                      two columns that name one stand down with the rest (§8). */}
                  <SortTh k="status" label="Status" sort={sort} onSort={setSort} density={density} className={engineSized ? undefined : 'w-[140px]'} />
                  <SortTh k="createdBy" label="Created by" sort={sort} onSort={setSort} density={density} />
                  <SortTh k="createdAt" label="Created on" sort={sort} onSort={setSort} density={density} />
                  <SortTh k="updatedBy" label="Last updated by" sort={sort} onSort={setSort} density={density} />
                  <SortTh k="updatedAt" label="Last updated on" sort={sort} onSort={setSort} density={density} />
                  <th className={cn(th(density), !engineSized && 'w-[60px]', '!pl-2')}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {dimensions.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMN_COUNT}>
                      <EmptyState
                        icon={<Layers size={20} />}
                        title="No dimensions yet"
                        description="Add a dimension to get started."
                        action={<Button icon={<Plus size={14} />} onClick={openNew}>Add dimension</Button>}
                      />
                    </td>
                  </tr>
                ) : shown.length === 0 ? (
                  /* Nothing defined and nothing matching are different problems,
                     so they get different ways out: one offers the form, the
                     other offers the search box back. */
                  <tr>
                    <td colSpan={COLUMN_COUNT}>
                      <EmptyState
                        icon={<Layers size={20} />}
                        title="No dimensions match"
                        description={query.trim() ? 'No dimension here matches what you searched for.' : 'No dimension here matches your filters.'}
                        action={<Button variant="secondary" onClick={() => { setQuery(''); setFilters(NO_AUDIT_FILTERS) }}>{query.trim() && filterCount ? 'Clear search and filters' : query.trim() ? 'Clear search' : 'Clear filters'}</Button>}
                      />
                    </td>
                  </tr>
                ) : shown.map(d => (
                  <tr
                    key={d.id}
                    onClick={() => openEdit(d)}
                    className="border-b border-border-subtle last:border-0 bg-white hover:bg-[#F0F7FF] transition-colors cursor-pointer"
                  >
                    <td className={td(density)}>
                      <span className="block text-[13px] text-fg truncate" style={{ fontWeight: 500 }}><Marked text={d.name} q={query} /></span>
                    </td>
                    <td className={td(density)}>
                      <ValuesCell values={d.values} q={query} />
                    </td>
                    {/* The row opens the editor on click, and setting a status is
                        not that. Same for the row menu beside it. */}
                    <td className={td(density)} onClick={e => e.stopPropagation()}>
                      <StatusPicker
                        status={d.status}
                        q={query}
                        onPick={s => { if (s === 'Inactive') setConfirmOff(d); else updateDimension(d.id, { status: 'Active' }) }}
                      />
                    </td>
                    <td className={cn('pl-4 pr-2 align-middle max-w-[220px]', PERSON_PAD)}><PersonCell name={d.createdBy} comfort={density === 'comfortable'} q={query} /></td>
                    <td className={td(density)}><StampCell at={d.createdAt} q={query} /></td>
                    <td className={cn('pl-4 pr-2 align-middle max-w-[220px]', PERSON_PAD)}><PersonCell name={modifiedByOf(d)} comfort={density === 'comfortable'} q={query} /></td>
                    <td className={td(density)}><StampCell at={modifiedAtOf(d)} q={query} /></td>
                    <td className={cn(td(density), '!pl-2 text-right')} onClick={e => e.stopPropagation()}>
                      <Menu align="right" trigger={
                        <button aria-label={`Actions for ${d.name}`} className="btn-icon text-fg-subtle"><MoreHorizontal size={16} /></button>
                      }>
                        {close => (
                          <>
                            <MenuItem icon={<Pencil size={14} />} onClick={() => { close(); openEdit(d) }}>Edit dimension</MenuItem>
                            {d.status === 'Active'
                              ? <MenuItem icon={<CircleSlash size={14} />} onClick={() => { close(); setConfirmOff(d) }}>Deactivate</MenuItem>
                              : <MenuItem icon={<CircleCheck size={14} />} onClick={() => { close(); updateDimension(d.id, { status: 'Active' }) }}>Activate</MenuItem>}
                            <MenuItem icon={<Trash2 size={14} />} danger onClick={() => { close(); setConfirmDelete(d) }}>Remove</MenuItem>
                          </>
                        )}
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        {/* Only while something is hidden, so the reader is never told a number
            they can already see is the whole number. */}
        {filtered && shown.length > 0 && (
          <p className="mt-2.5 text-xs text-fg-muted">
            Showing {shown.length} of {dimensions.length} {dimensions.length === 1 ? DIMENSION_NOUN.one : DIMENSION_NOUN.many}.
          </p>
        )}
      </div>

      <DimensionAuditFilters
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        dimensions={searched}
        filters={filters}
        setFilters={setFilters}
      />

      <DimensionFormModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        dimensions={dimensions}
        editing={editing === 'new' ? null : editing}
        initial={initial}
        valuesInUse={editingInUse}
        onSubmit={draft => {
          if (editing === 'new') addDimension(draft)
          else if (editing) updateDimension(editing, { name: draft.name, values: draft.values, status: draft.status })
        }}
      />

      {/* Deactivating is the reversible move and says so. What it does not do is
          reach back into postings that already carry the dimension. */}
      <ConfirmModal
        open={!!confirmOff}
        tone="warning"
        badge="Deactivate"
        title={`Deactivate ${confirmOff?.name ?? ''}?`}
        description={[
          'It stops being offered on new accounts and new journal entries.',
          'Entries that already carry it keep it, and reports over past periods are unchanged. You can turn it back on at any time.',
        ]}
        confirmLabel="Deactivate"
        dismissLabel="Keep it active"
        onConfirm={() => { if (confirmOff) updateDimension(confirmOff.id, { status: 'Inactive' }); setConfirmOff(null) }}
        onDismiss={() => setConfirmOff(null)}
      />

      {/* Remove is refused while anything uses the dimension (decision 89;
          module review, 2026-10-06, COA-02). Removing Location had left four
          bank accounts showing a dimension that no longer existed. Deactivate
          is offered in its place: nothing new picks it, and everything that
          has it keeps it. */}
      <ConfirmModal
        open={!!confirmDelete && !!deleteUse && inUse(deleteUse)}
        tone="warning"
        badge="In use"
        title={`${confirmDelete?.name ?? ''} can't be removed`}
        description={[
          `It is used by ${deleteUse ? describeUse(deleteUse) : ''}. Removing it would leave them pointing at a dimension that no longer exists.`,
          confirmDelete?.status === 'Active'
            ? 'Deactivate it instead. It stops being offered on new accounts and new journal entries, and everything that already carries it keeps it.'
            : 'It is already inactive, so nothing new can pick it. Everything that already carries it keeps it.',
        ]}
        confirmLabel={confirmDelete?.status === 'Active' ? 'Deactivate' : 'Got it'}
        dismissLabel={confirmDelete?.status === 'Active' ? 'Cancel' : undefined}
        onConfirm={() => { if (confirmDelete?.status === 'Active') updateDimension(confirmDelete.id, { status: 'Inactive' }); setConfirmDelete(null) }}
        onDismiss={() => setConfirmDelete(null)}
      />

      <ConfirmModal
        open={!!confirmDelete && !(deleteUse && inUse(deleteUse))}
        tone="danger"
        badge="Remove"
        title={`Remove ${confirmDelete?.name ?? ''}?`}
        description={[
          `This deletes the dimension and its ${confirmDelete?.values.length ?? 0} value${confirmDelete?.values.length === 1 ? '' : 's'}.`,
          'No account or posting uses it, so nothing else changes.',
        ]}
        confirmLabel="Remove dimension"
        dismissLabel="Cancel"
        onConfirm={() => { if (confirmDelete) deleteDimension(confirmDelete.id); setConfirmDelete(null) }}
        onDismiss={() => setConfirmDelete(null)}
      />

      {/* The reading room positions itself against the nearest positioned
          ancestor, because everywhere else it opens it is inside a wizard's own
          full-screen chrome. A page has no such box, and a fixed layer in the
          page tree does not make one: the shell wraps every route in
          `animate-page-in`, whose transform sticks (fill-mode both) and becomes
          the containing block, so the sheet came out the height of the content
          area and stopped short of the fold. Portaled to <body> for the same
          reason every other overlay in the module is. Mounted only while open,
          or an empty layer would swallow every click on the page underneath. */}
      {guideOpen && createPortal(
        <div className="fixed inset-0 z-50">
          <ReadingRoom
            open
            onClose={() => setGuideOpen(false)}
            config={DIMENSIONS_PAGE_READING_ROOM}
          />
        </div>,
        document.body,
      )}
    </div>
  )
}

const BLANK: DimensionDraft = { name: '', values: [], status: 'Active' }

/* No Columns control here. The name cannot be hidden without leaving rows told
   apart by nothing, and the rest fit the width a list this short is given.
   Sorting is offered on every column, which is the part of column control that
   earns its place. */
type SortKey = 'name' | 'values' | 'status' | 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt'
// Every column, the row menu included, for the empty states that span them.
const COLUMN_COUNT = 8

/* A dimension nobody has changed since it was added was last changed then. A
   dimension saved before anyone was stamped on it has no person to name. */
const modifiedByOf = (d: Dimension) => d.updatedBy || d.createdBy
const modifiedAtOf = (d: Dimension) => d.updatedAt || d.createdAt

/* Who and when, the two facets this list's Filters panel holds - the same two
   the chart of accounts' panel ends on, asked the same way. */
interface AuditFilters {
  createdBy: string[]; createdFrom: string; createdTo: string
  updatedBy: string[]; updatedFrom: string; updatedTo: string
}
const NO_AUDIT_FILTERS: AuditFilters = { createdBy: [], createdFrom: '', createdTo: '', updatedBy: [], updatedFrom: '', updatedTo: '' }
const countAuditFilters = (f: AuditFilters) =>
  f.createdBy.length + (f.createdFrom ? 1 : 0) + (f.createdTo ? 1 : 0) +
  f.updatedBy.length + (f.updatedFrom ? 1 : 0) + (f.updatedTo ? 1 : 0)
function matchesAudit(d: Dimension, f: AuditFilters): boolean {
  if (f.createdBy.length && !f.createdBy.includes(personText(d.createdBy))) return false
  const created = localDayOf(d.createdAt)
  if (f.createdFrom && created < f.createdFrom) return false
  if (f.createdTo && created > f.createdTo) return false
  if (f.updatedBy.length && !f.updatedBy.includes(personText(modifiedByOf(d)))) return false
  const updated = localDayOf(modifiedAtOf(d))
  if (f.updatedFrom && updated < f.updatedFrom) return false
  if (f.updatedTo && updated > f.updatedTo) return false
  return true
}

function DimensionAuditFilters({ open, onClose, dimensions, filters, setFilters }: {
  open: boolean
  onClose: () => void
  dimensions: Dimension[]
  filters: AuditFilters
  setFilters: (f: AuditFilters) => void
}) {
  const [draft, setDraft] = useState<AuditFilters>(filters)
  const [wasOpen, setWasOpen] = useState(open)
  // Start from what is applied each time the panel opens.
  if (open !== wasOpen) { setWasOpen(open); if (open) setDraft(filters) }

  const countBy = (names: (string | undefined)[]) => {
    const m: Record<string, number> = {}
    for (const n of names) { const p = personText(n); if (p) m[p] = (m[p] ?? 0) + 1 }
    return m
  }
  const creators = countBy(dimensions.map(d => d.createdBy))
  const modifiers = countBy(dimensions.map(modifiedByOf))
  const toggle = (key: 'createdBy' | 'updatedBy', name: string) => setDraft(d => ({
    ...d, [key]: d[key].includes(name) ? d[key].filter(x => x !== name) : [...d[key], name],
  }))
  const live = dimensions.filter(d => matchesAudit(d, draft)).length

  return (
    <FiltersModal
      open={open}
      onClose={onClose}
      activeCount={countAuditFilters(draft)}
      onClear={() => setDraft(NO_AUDIT_FILTERS)}
      onApply={() => { setFilters(draft); onClose() }}
      applyLabel={`Show ${live} ${live === 1 ? DIMENSION_NOUN.one : DIMENSION_NOUN.many}`}
    >
      <Section title="Created" desc="Who added the dimension, and when.">
        <AuditFacet
          people={peopleIn(dimensions.map(d => d.createdBy))}
          selected={draft.createdBy}
          onToggle={name => toggle('createdBy', name)}
          onAll={() => setDraft(d => ({ ...d, createdBy: [] }))}
          getCount={name => creators[name] ?? 0}
          from={draft.createdFrom}
          to={draft.createdTo}
          onFromChange={v => setDraft(d => ({ ...d, createdFrom: v }))}
          onToChange={v => setDraft(d => ({ ...d, createdTo: v }))}
        />
      </Section>
      <FDivider />
      <Section title="Last updated" desc="Who last changed the dimension, and when.">
        <AuditFacet
          people={peopleIn(dimensions.map(modifiedByOf))}
          selected={draft.updatedBy}
          onToggle={name => toggle('updatedBy', name)}
          onAll={() => setDraft(d => ({ ...d, updatedBy: [] }))}
          getCount={name => modifiers[name] ?? 0}
          from={draft.updatedFrom}
          to={draft.updatedTo}
          onFromChange={v => setDraft(d => ({ ...d, updatedFrom: v }))}
          onToChange={v => setDraft(d => ({ ...d, updatedTo: v }))}
        />
      </Section>
    </FiltersModal>
  )
}
type Sort = { key: SortKey; dir: 'asc' | 'desc' }

// Density changes the row's breathing room, not its type sizes - the toolbar
// offers two spacings, not two themes.
const th = (d: ToolbarDensity) =>
  cn('pl-4 pr-2 align-middle text-left text-[13px] font-normal whitespace-nowrap', d === 'condensed' ? 'h-8' : 'h-10')
const td = (d: ToolbarDensity) =>
  cn('pl-4 pr-2 align-middle', d === 'condensed' ? 'py-1.5' : 'py-3')

/* Sorted headers go primary blue and idle ones reveal a faint arrow pair on
   hover, which is how the chart listing's headers behave. Same affordance, so a
   header reads the same wherever the reader meets one. */
function SortTh({ k, label, sort, onSort, density, className }: {
  k: SortKey
  label: string
  sort: Sort
  onSort: (next: (s: Sort) => Sort) => void
  density: ToolbarDensity
  className?: string
}) {
  const active = sort.key === k
  return (
    <th className={cn(th(density), className)}>
      <button
        onClick={() => onSort(s => ({ key: k, dir: s.key === k && s.dir === 'asc' ? 'desc' : 'asc' }))}
        className="group/col inline-flex items-center gap-1.5 cursor-pointer"
      >
        <span style={active ? { color: 'hsl(var(--primary))' } : undefined}>{label}</span>
        {active && sort.dir === 'asc' && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: 'hsl(var(--primary))' }} />}
        {active && sort.dir === 'desc' && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: 'hsl(var(--primary))' }} />}
        {!active && <ArrowUpDown className="coa-col-hint w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/col:opacity-100 transition-opacity" />}
      </button>
    </th>
  )
}

/* One pill and a count, the way the listing's own dimension column reads a
   cell holding several values. The values are what a report will offer, so the
   first one is on the row; the rest are a hover away rather than a run of text
   that makes every row two lines tall. */
function ValuesCell({ values, q = '' }: { values: string[]; q?: string }) {
  if (!values.length) return <span className="text-[13px] text-fg-subtle">No values yet</span>
  /* A search that found a value behind the "+N" leads with it, so the value that
     answered is the one on show and marked rather than folded away. */
  const found = q.trim() ? searchMatcher(q) : null
  const lead = found ? Math.max(0, values.findIndex(v => found(v))) : 0
  const [first, ...rest] = lead ? [values[lead], ...values.filter((_, i) => i !== lead)] : values
  return (
    <div className="flex items-center gap-1">
      <span className={cn(OVERFLOW_PILL, 'px-2 min-w-0 max-w-[220px] truncate')} style={{ fontWeight: 500 }} title={first}>
        <Marked text={first} q={q} />
      </span>
      {rest.length > 0 && (
        <OverflowCard category="Values" items={rest.map(v => ({ name: v }))}>
          <span className={cn(OVERFLOW_PILL, 'px-1.5')} style={{ fontWeight: 600 }}>+{rest.length}</span>
        </OverflowCard>
      )}
    </div>
  )
}

/* The status cell as a control, the way the chart's own rows offer one: both
   states on show with what each one means, so the reader picks the state instead
   of hunting for the verb in the row menu. A dimension has two states rather
   than the three an account has, and no Archived - there is no balance and no
   history to keep once it is gone, which is why removal is a separate move. */
export const DIMENSION_STATES: { status: Dimension['status']; verb: string; meaning: string }[] = [
  { status: 'Active', verb: 'Activate', meaning: 'Offered on new accounts and new journal entries.' },
  { status: 'Inactive', verb: 'Deactivate', meaning: 'No longer offered on new accounts or new journal entries. Entries that already carry it keep it.' },
]

function StatusPicker({ status, onPick, q = '' }: {
  status: Dimension['status']
  onPick: (status: Dimension['status']) => void
  /** The table's search, marked in the chip. */
  q?: string
}) {
  return (
    <Menu align="left" flush trigger={<StatusChip status={status} chevron q={q} />}>
      {close => (
        <div className="w-[min(340px,calc(100vw-32px))] p-2 space-y-0.5">
          {DIMENSION_STATES.map(s => {
            const current = s.status === status
            return (
              <button
                key={s.status}
                onClick={() => { close(); if (!current) onPick(s.status) }}
                className={cn('w-full text-left rounded-md border p-3 transition-colors',
                  current ? 'bg-accent border-[#D0E3F7] cursor-default' : 'border-transparent hover:bg-bg-subtle')}
              >
                <div className="flex items-center justify-between gap-2">
                  <StatusChip status={s.status} label={current ? s.status : s.verb} />
                  {current && <Check className="w-3.5 h-3.5 text-fg-subtle shrink-0" />}
                </div>
                <p className="mt-1.5 text-xs leading-[17px] text-fg-muted">{s.meaning}</p>
              </button>
            )
          })}
        </div>
      )}
    </Menu>
  )
}
