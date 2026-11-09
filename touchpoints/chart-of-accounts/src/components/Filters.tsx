import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, ChevronDown, ChevronUp, Check, SlidersHorizontal } from 'lucide-react'
import { Account, AccountStatus, AccountCategory, GLAccountType, GL_ACCOUNT_TYPES, ACCOUNT_TYPE_META, CATEGORY_ORDER } from '../types'
import { AnchoredPopover, clickIsOutside, CrossedRangeNote, FILTER_INPUT_CLS, modifiedAtOf, modifiedByOf } from './AccountTable'
import { personText } from './AuditCells'
import { Avatar } from './Avatar'
import { currencyMeta } from '../lib/currencies'
import { DateField } from './DateField'
import { cn, fmtNumber, invertedDates, invertedRange, localDayOf } from '../lib/utils'
import { CurrencyFlag } from './CurrencyFlag'

// DEPRECATED (Section 2, item 2): there is intentionally NO Subcategory / sub-type
// picker in these filters. The create flow no longer routes through Subcategory -
// it branches on `glAccountType` (Posting or Summary) instead - so the
// list filters below deliberately omit any Subcategory selector. Do not reintroduce
// a Subcategory picker here; the `Subcategory` type is retained in types.ts only for
// backward compatibility.
export interface FilterState {
  statuses: AccountStatus[]
  /* The five GAAP buckets. Named for what they are: this panel used to head them
     "Account type", which is what the chart calls Posting and Summary, so the
     one filter offered Asset and Liability and the reader looking for Summary
     accounts found the wrong control and no other. */
  categories: AccountCategory[]
  /* Posting or Summary: whether the account takes entries or totals the ones
     under it. The single most common thing a reader wants a chart cut by, and
     until now the only way to it was the GL type column's own filter. */
  glTypes: GLAccountType[]
  /* Which values of a dimension to keep, by dimension id. Values inside one
     dimension widen the set and dimensions narrow each other, so Location
     London or Manchester, Department Marketing reads as "the Marketing accounts
     in either city" - which is the way a reader says it out loud. An id absent
     or holding no values asks nothing of the account. */
  dimensionValues: Record<string, string[]>
  hasTransactions: ('yes' | 'no')[]
  /* Whether the account came in through a file import. Here as well as on the
     hidden column because the two get reached for at different moments: the
     column is for reading a chart, and this is for pulling up the part of it
     that was migrated - the question someone asks in the weeks after a move,
     when what they want is every row the import touched and nothing else. */
  arrivedByImport: ('yes' | 'no')[]
  currencies: string[]         // ISO codes an account may be denominated in
  balanceMin: string
  balanceMax: string
  effectiveFrom: string
  effectiveTo: string
  subsidiaryIds: string[]
  /* Who added the account and when, and who changed it last and when - by the
     name the grid shows, and by calendar day. Design review, 2026-10-02: Eli
     wanted the accounts he had made, and the grids had no way to ask. */
  createdBy: string[]
  createdFrom: string
  createdTo: string
  updatedBy: string[]
  updatedFrom: string
  updatedTo: string
}

export const EMPTY_FILTERS: FilterState = {
  statuses: [], categories: [], glTypes: [], dimensionValues: {},
  hasTransactions: [], arrivedByImport: [], currencies: [], balanceMin: '', balanceMax: '',
  effectiveFrom: '', effectiveTo: '', subsidiaryIds: [],
  createdBy: [], createdFrom: '', createdTo: '', updatedBy: [], updatedFrom: '', updatedTo: '',
}

/* What the Filters button carries on its badge, and what its Clear all empties.
   Dimensions are counted separately by `countDimensionsActive` because they have
   their own button on the toolbar now: a badge that counted a facet this panel
   does not show, and a Clear all that silently emptied it, would both read as
   bugs. `applyFilters` still applies every facet, dimensions included - they are
   one filter set, edited from two controls. */
export function countFiltersActive(f: FilterState) {
  return f.statuses.length + f.categories.length + f.glTypes.length +
    f.hasTransactions.length + f.arrivedByImport.length + f.currencies.length + f.subsidiaryIds.length +
    (f.balanceMin ? 1 : 0) + (f.balanceMax ? 1 : 0) +
    (f.effectiveFrom ? 1 : 0) + (f.effectiveTo ? 1 : 0) +
    f.createdBy.length + (f.createdFrom ? 1 : 0) + (f.createdTo ? 1 : 0) +
    f.updatedBy.length + (f.updatedFrom ? 1 : 0) + (f.updatedTo ? 1 : 0)
}

// A dimension counts once per value asked for, the way a status does.
export function countDimensionsActive(f: FilterState) {
  return Object.values(f.dimensionValues).reduce((n, values) => n + values.length, 0)
}

// Everything narrowing the chart, from either control.
export const countNarrowing = (f: FilterState) => countFiltersActive(f) + countDimensionsActive(f)

// Clearing the Filters panel leaves the dimension picks standing: they belong to
// the button beside it, and clearing a control from another control's Clear all
// is how a reader loses work they cannot see they had.
export const clearPanelFilters = (f: FilterState): FilterState =>
  ({ ...EMPTY_FILTERS, dimensionValues: f.dimensionValues })

export function applyFilters(list: Account[], f: FilterState) {
  return list.filter(a => {
    if (f.statuses.length && !f.statuses.includes(a.status)) return false
    if (f.categories.length && !f.categories.includes(a.accountType)) return false
    if (f.glTypes.length && !f.glTypes.includes(a.glAccountType)) return false
    // Running balance is the balance today, whatever the period, as the column
    // prints it - the same figure the running balance column filter in
    // AccountTable reads.
    const running = a.currentBalance ?? a.balance
    if (f.balanceMin !== '' && running < Number(f.balanceMin)) return false
    if (f.balanceMax !== '' && running > Number(f.balanceMax)) return false
    for (const [id, values] of Object.entries(f.dimensionValues)) {
      if (!values.length) continue
      if (!a.defaultDimensionValues.some(dv => dv.dimensionId === id && values.includes(dv.value))) return false
    }
    if (f.hasTransactions.length) {
      const wantsYes = f.hasTransactions.includes('yes')
      const wantsNo = f.hasTransactions.includes('no')
      if (a.hasTransactions && !wantsYes) return false
      if (!a.hasTransactions && !wantsNo) return false
    }
    if (f.arrivedByImport.length) {
      const wantsYes = f.arrivedByImport.includes('yes')
      const wantsNo = f.arrivedByImport.includes('no')
      if (a.arrivedByImport && !wantsYes) return false
      if (!a.arrivedByImport && !wantsNo) return false
    }
    if (f.currencies.length && !f.currencies.includes(a.currencyCode)) return false
    if (f.effectiveFrom && a.effectiveDate < f.effectiveFrom) return false
    if (f.effectiveTo && a.effectiveDate > f.effectiveTo) return false
    if (f.subsidiaryIds.length && !f.subsidiaryIds.includes(a.subsidiaryId ?? '')) return false
    if (f.createdBy.length && !f.createdBy.includes(personText(a.createdBy))) return false
    if (f.createdFrom || f.createdTo) {
      const day = localDayOf(a.createdAt)
      if (f.createdFrom && day < f.createdFrom) return false
      if (f.createdTo && day > f.createdTo) return false
    }
    if (f.updatedBy.length && !f.updatedBy.includes(personText(modifiedByOf(a)))) return false
    if (f.updatedFrom || f.updatedTo) {
      const day = localDayOf(modifiedAtOf(a))
      if (f.updatedFrom && day < f.updatedFrom) return false
      if (f.updatedTo && day > f.updatedTo) return false
    }
    return true
  })
}

/* An archived account is off the chart, so the listing leaves it out until the
   Status facet asks for it by name. The rule lives beside `applyFilters` rather
   than on the page because the panel's Apply button forecasts the same set, and a
   button reading "Show 138 accounts" over a listing that then draws 136 has quoted
   the chart's total as though it were the result. */
export const hidesArchived = (f: FilterState) => !f.statuses.includes('Archived')
/* Except in the period it left in. An archived account that still has figures in
   the period on screen - the balance it opened with, or the move that emptied it -
   stays listed under its parent, so the parent's total is the rows beneath it and
   the chart agrees with the General ledger, which lists it for that month too
   (retest, 2026-10-07; see lib/chartTree). Read off the period-scoped account. */
export const carriesPeriodFigures = (a: Account) => (a.balance || 0) !== 0 || (a.netChange ?? 0) !== 0
export const offTheListing = (a: Account, f: FilterState) =>
  hidesArchived(f) && a.status === 'Archived' && !carriesPeriodFigures(a)
export const listedUnderFilters = (list: Account[], f: FilterState) =>
  applyFilters(list.filter(a => !offTheListing(a, f)), f)

/* The way back out of an applied filter set, sitting next to whatever applied it.
   Divider plus text link is the Partners active-filter-bar recipe, which
   `ColumnFiltersBar` already uses - so where a toolbar carries both a Filters
   button and a column-filter bar, the two clears read as one pattern instead of
   two inventions.

   Renders nothing when nothing is filtered. A disabled control would hold space
   on every table for a state most readers never reach, and the Filters button
   beside it already says "no filters" by showing no badge. */
export function ClearFiltersLink({ onClear, label = 'Clear all' }: { onClear: () => void; label?: string }) {
  return (
    <>
      <div className="w-px h-5 bg-border/60 shrink-0" />
      <button
        type="button"
        onClick={onClear}
        title="Remove every filter applied to this table"
        className="text-[12px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors whitespace-nowrap shrink-0"
        style={{ fontWeight: 500 }}
      >
        {label}
      </button>
    </>
  )
}

/* The Filters trigger, shared by every table in the module so the toolbars cannot
   drift apart. `count` is how many filters are applied; it drives the badge, the
   primary tint, and whether Clear appears.

   Clear sits beside the button rather than only in the modal footer, because the
   footer is two clicks away and a reader who can see the badge should be able to
   act on it. It clears exactly what the badge counts - the filters behind this
   button - and deliberately not the search box or the column filters, which sit
   elsewhere in the toolbar and carry their own clear affordances. Scoping the
   clear to the count it sits beside is what keeps it predictable. */
export function FiltersButton({ count, onOpen, onClear, iconSize = 14 }: {
  count: number
  onOpen: () => void
  onClear: () => void
  iconSize?: number
}) {
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <button
        onClick={onOpen}
        className={cn('inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border bg-white shadow-xs hover:bg-bg-subtle transition-colors shrink-0 text-sm font-medium',
          count > 0 ? 'text-primary border-primary/30' : 'text-fg border-border')}
      >
        <SlidersHorizontal size={iconSize} className={count > 0 ? 'text-primary' : 'text-fg-subtle'} />
        Filters
        {count > 0 && <span className="ml-0.5 min-w-[18px] h-5 rounded-full text-2xs flex items-center justify-center px-1.5 bg-primary text-white font-semibold">{count}</span>}
      </button>
      {count > 0 && <ClearFiltersLink onClear={onClear} />}
    </div>
  )
}

/* The Filters modal's chrome, shared by every table that offers filtering: the
   portal, the overlay, the centred card, the header with its active count, the
   scrolling body and the Clear all / apply footer. Extracted so the second table
   to want filters does not get a second hand-built copy of all that - which is
   exactly how the toolbar came to have two versions of itself.
 *
 * The panel edits a draft and applies on the footer button. Filtering a table is
 * a sentence the reader composes before it is read back to them, and a panel
 * that reruns the table under the reader's hands cannot say "Show 12" on the
 * button, which is the part that tells them what they just asked for. */
export function FiltersModal({
  open, onClose, activeCount, onClear, onApply, applyLabel, children,
}: {
  open: boolean
  onClose: () => void
  activeCount: number
  onClear: () => void
  onApply: () => void
  applyLabel: React.ReactNode
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null

  // Portal to <body>: the app shell wraps every page in an animate-page-in
  // div whose transform persists (fill-mode both), making it the containing
  // block for fixed children - so an in-tree overlay would be clipped to the
  // content area and leave the sidebar and top bar uncovered.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 coa-scrim animate-overlay-in" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-[680px] max-h-[85vh] flex flex-col overflow-hidden animate-modal-in">
        {/* Header - centered title + active count, circular X at left (Partner FiltersModal) */}
        <div className="flex items-center justify-center relative px-6 h-12 border-b border-border/60 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <span className="text-[14px]" style={{ fontWeight: 600 }}>Filters</span>
          {activeCount > 0 && (
            <span className="ml-2 min-w-[20px] h-5 rounded-full text-[11px] flex items-center justify-center px-1.5 text-white" style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 600 }}>
              {activeCount}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
          {children}
        </div>

        {/* Sticky footer - underlined Clear all (left) · primary Show N (right) */}
        <div className="flex items-center justify-between px-6 h-14 border-t border-border/60 shrink-0">
          <button
            type="button"
            onClick={onClear}
            className="text-[13px] text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-foreground/50 transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onApply}
            className="inline-flex items-center justify-center h-9 px-5 rounded-lg text-white text-[13px] cursor-pointer transition-colors hover:opacity-90"
            style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 600 }}
          >
            {applyLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function FiltersSlideOver({
  open, onClose, filters, setFilters, accounts, subsidiaries,
}: {
  open: boolean
  onClose: () => void
  filters: FilterState
  setFilters: (f: FilterState) => void
  accounts: Account[]
  subsidiaries: { id: string; name: string }[]
}) {
  const [draft, setDraft] = useState<FilterState>(filters)
  // Reflect the applied filters whenever the modal is (re)opened. Escape is the
  // shell's job, since every filter panel closes the same way.
  useEffect(() => {
    if (!open) return
    setDraft(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {}
    const byType: Record<string, number> = {}
    const byGlType: Record<string, number> = {}
    const byTx = { yes: 0, no: 0 }
    const byImport = { yes: 0, no: 0 }
    const bySub: Record<string, number> = {}
    const byCurrency: Record<string, number> = {}
    const byCreator: Record<string, number> = {}
    const byModifier: Record<string, number> = {}
    accounts.forEach(a => {
      const creator = personText(a.createdBy)
      const modifier = personText(modifiedByOf(a))
      if (creator) byCreator[creator] = (byCreator[creator] ?? 0) + 1
      if (modifier) byModifier[modifier] = (byModifier[modifier] ?? 0) + 1
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
      byType[a.accountType] = (byType[a.accountType] ?? 0) + 1
      byGlType[a.glAccountType] = (byGlType[a.glAccountType] ?? 0) + 1
      if (a.hasTransactions) byTx.yes++; else byTx.no++
      if (a.arrivedByImport) byImport.yes++; else byImport.no++
      if (a.subsidiaryId) bySub[a.subsidiaryId] = (bySub[a.subsidiaryId] ?? 0) + 1
      byCurrency[a.currencyCode] = (byCurrency[a.currencyCode] ?? 0) + 1
    })
    return { byStatus, byType, byGlType, byTx, byImport, bySub, byCurrency, byCreator, byModifier }
  }, [accounts])

  // Only posting accounts carry a balance of their own; a summary's figure is the
  // sum of the postings beneath it, so including them would skew the extent.
  const balances = useMemo(() => accounts.filter(a => a.isPosting).map(a => a.balance), [accounts])
  // Currencies present in the account set, sorted by code, for the filter pills.
  const currencyCodes = useMemo(() => Object.keys(counts.byCurrency).sort(), [counts])
  const creators = useMemo(() => Object.keys(counts.byCreator).sort((a, b) => a.localeCompare(b)), [counts])
  const modifiers = useMemo(() => Object.keys(counts.byModifier).sort((a, b) => a.localeCompare(b)), [counts])

  const liveCount = listedUnderFilters(accounts, draft).length

  const toggle = <K extends keyof FilterState>(key: K, value: any) => {
    setDraft(d => {
      const arr = d[key] as any[]
      const has = arr.includes(value)
      return { ...d, [key]: has ? arr.filter(x => x !== value) : [...arr, value] }
    })
  }

  return (
    <FiltersModal
      open={open}
      onClose={onClose}
      activeCount={countFiltersActive(draft)}
      onClear={() => setDraft(clearPanelFilters(draft))}
      onApply={() => { setFilters(draft); onClose() }}
      applyLabel={`Show ${liveCount.toLocaleString()} account${liveCount !== 1 ? 's' : ''}`}
    >
        {/* Time period moved out to the Chart of Accounts toolbar. */}
        <Section title="Status">
          <PillGrid>
            <AllPill active={draft.statuses.length === 0} onClick={() => setDraft(d => ({ ...d, statuses: [] }))} />
            {(['Active', 'Inactive', 'Archived'] as AccountStatus[]).map(s => (
              <FilterPill key={s} active={draft.statuses.includes(s)} onClick={() => toggle('statuses', s)} count={counts.byStatus[s] ?? 0}>{s}</FilterPill>
            ))}
          </PillGrid>
        </Section>

        <FDivider />

        <Section title="Category" desc="Show accounts in the categories you pick.">
          <PillGrid>
            <AllPill active={draft.categories.length === 0} onClick={() => setDraft(d => ({ ...d, categories: [] }))} />
            {CATEGORY_ORDER.map(t => (
              <FilterPill key={t} active={draft.categories.includes(t)} onClick={() => toggle('categories', t)} count={counts.byType[t] ?? 0}>
                {ACCOUNT_TYPE_META[t].label}
              </FilterPill>
            ))}
          </PillGrid>
        </Section>

        <FDivider />

        <Section title="GL account type" desc="Posting accounts hold entries. Summary accounts add up the accounts under them.">
          <PillGrid>
            <AllPill active={draft.glTypes.length === 0} onClick={() => setDraft(d => ({ ...d, glTypes: [] }))} />
            {GL_ACCOUNT_TYPES.map(t => (
              <FilterPill key={t} active={draft.glTypes.includes(t)} onClick={() => toggle('glTypes', t)} count={counts.byGlType[t] ?? 0}>
                {t}
              </FilterPill>
            ))}
          </PillGrid>
        </Section>

        {/* Dimensions used to sit here, above the built-in facets. They are a
            `DimensionsPicker` on the quick-filter pill row now - they are the
            reader's own way of slicing their own chart, and three sections down a
            modal was the wrong place to keep the filter most worth reaching for.
            This panel does not edit them, so it does not count or clear them
            either. */}

        <FDivider />

        <Section title="Running balance" desc="Show accounts whose balance today is in this range. Leave a box empty for no limit.">
          <RangeMinMax
            values={balances}
            min={draft.balanceMin}
            max={draft.balanceMax}
            onMinChange={v => setDraft(d => ({ ...d, balanceMin: v }))}
            onMaxChange={v => setDraft(d => ({ ...d, balanceMax: v }))}
          />
        </Section>

        <FDivider />

        <Section title="Transactions" desc="Show accounts that have entries, or accounts that don't.">
          <PillGrid>
            <AllPill active={draft.hasTransactions.length === 0} onClick={() => setDraft(d => ({ ...d, hasTransactions: [] }))} />
            <FilterPill active={draft.hasTransactions.includes('yes')} onClick={() => toggle('hasTransactions', 'yes')} count={counts.byTx.yes}>With transactions</FilterPill>
            <FilterPill active={draft.hasTransactions.includes('no')} onClick={() => toggle('hasTransactions', 'no')} count={counts.byTx.no}>No transactions</FilterPill>
          </PillGrid>
        </Section>

        <FDivider />

        <Section title="Origin" desc="Show accounts imported from a file, or added by hand.">
          <PillGrid>
            <AllPill active={draft.arrivedByImport.length === 0} onClick={() => setDraft(d => ({ ...d, arrivedByImport: [] }))} />
            <FilterPill active={draft.arrivedByImport.includes('yes')} onClick={() => toggle('arrivedByImport', 'yes')} count={counts.byImport.yes}>Imported</FilterPill>
            <FilterPill active={draft.arrivedByImport.includes('no')} onClick={() => toggle('arrivedByImport', 'no')} count={counts.byImport.no}>Added here</FilterPill>
          </PillGrid>
        </Section>

        <FDivider />

        <Section title="Currency" desc="Show accounts held in the currencies you pick.">
          <PillSection
            options={currencyCodes.map(code => ({
              value: code,
              label: (
                <>
                  <CurrencyFlag meta={currencyMeta(code)} className="text-base leading-none" />
                  {code}
                </>
              ),
            }))}
            selected={draft.currencies}
            onToggle={code => toggle('currencies', code)}
            getCount={code => counts.byCurrency[code] ?? 0}
            leading={<AllPill active={draft.currencies.length === 0} onClick={() => setDraft(d => ({ ...d, currencies: [] }))} />}
          />
        </Section>

        <FDivider />

        <Section title="Created" desc="Who added the account, and when.">
          <AuditFacet
            people={creators}
            selected={draft.createdBy}
            onToggle={name => toggle('createdBy', name)}
            onAll={() => setDraft(d => ({ ...d, createdBy: [] }))}
            getCount={name => counts.byCreator[name] ?? 0}
            from={draft.createdFrom}
            to={draft.createdTo}
            onFromChange={v => setDraft(d => ({ ...d, createdFrom: v }))}
            onToChange={v => setDraft(d => ({ ...d, createdTo: v }))}
          />
        </Section>

        <FDivider />

        <Section title="Last updated" desc="Who last changed the account, and when.">
          <AuditFacet
            people={modifiers}
            selected={draft.updatedBy}
            onToggle={name => toggle('updatedBy', name)}
            onAll={() => setDraft(d => ({ ...d, updatedBy: [] }))}
            getCount={name => counts.byModifier[name] ?? 0}
            from={draft.updatedFrom}
            to={draft.updatedTo}
            onFromChange={v => setDraft(d => ({ ...d, updatedFrom: v }))}
            onToChange={v => setDraft(d => ({ ...d, updatedTo: v }))}
          />
        </Section>
    </FiltersModal>
  )
}

/* Who, then when: the people as pills, the way every other facet here picks,
   and the days as a From/To pair under them. Shared by the chart's panel and
   the ledger's, so "Created" asks its question the same way in both. */
export function AuditFacet({ people, selected, onToggle, onAll, getCount, from, to, onFromChange, onToChange }: {
  people: string[]
  selected: string[]
  onToggle: (name: string) => void
  onAll: () => void
  getCount: (name: string) => number
  from: string
  to: string
  onFromChange: (iso: string) => void
  onToChange: (iso: string) => void
}) {
  return (
    <div className="space-y-3">
      <PillSection
        options={people.map(name => ({ value: name, label: <><Avatar name={name} size={16} />{name}</> }))}
        selected={selected}
        onToggle={onToggle}
        getCount={getCount}
        leading={<AllPill active={selected.length === 0} onClick={onAll} />}
      />
      <DateRangeFromTo from={from} to={to} onFromChange={onFromChange} onToChange={onToChange} />
    </div>
  )
}

// Section wrapper + inset divider - exact Partner FiltersModal metrics
// (px-6 py-4, 14px/600 title, 12px muted subtitle, mx-6 hairline).
export function FDivider() {
  return <div className="border-t border-border/50 mx-6" />
}
export function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-4">
      <h4 className="text-[14px] mb-0.5" style={{ fontWeight: 600 }}>{title}</h4>
      {desc && <p className="text-[12px] text-muted-foreground mb-3">{desc}</p>}
      {!desc && <div className="mb-3" />}
      {children}
    </div>
  )
}
export function PillGrid({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>
}
// Pill chip for multiselect - Partner FiltersModal Pill: 30px tall, 13px,
// weight 400 (500 when selected), bare 11px count (no boxed chip).
export function FilterPill({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full border text-[13px] cursor-pointer transition-all select-none shrink-0',
        active ? 'border-primary/30 text-primary' : 'bg-white text-foreground border-border hover:border-muted-foreground/40 hover:bg-muted/30')}
      style={{ fontWeight: active ? 500 : 400, backgroundColor: active ? 'hsl(var(--accent))' : undefined }}
    >
      {children}
      {count !== undefined && (
        <span className={cn('text-[11px] tabular-nums', active ? 'text-primary/60' : 'text-muted-foreground/50')}>{count}</span>
      )}
    </button>
  )
}
// Preselected "All" pill: active (clears the group) by default. No count. It
// says All rather than Any because the pill is what the group reads as when
// nothing is picked, and what the table then shows is all of them - "Any" named
// the rule the filter applies, which is not what the reader is looking at.
export function AllPill({ active, onClick }: { active: boolean; onClick: () => void }) {
  return <FilterPill active={active} onClick={onClick}>All</FilterPill>
}

// ── Quick-filter pill: the toolbar row above a table, not the modal ──
// Ported from the Partners module's FilterPills.tsx, the canonical version of a
// recipe its list pages duplicate. Distinct from FilterPill above, which is the
// 30px chip *inside* the Filters modal. Weight carries the state - 400 idle,
// 500 active - so a selected pill reads without relying on colour alone.
export function QuickFilterPill({ label, count, active, onClick, icon, tone = 'default' }: {
  label: React.ReactNode
  count?: number
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
  tone?: 'default' | 'danger'
}) {
  const danger = tone === 'danger'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer',
        danger
          ? (active
            ? 'border-rose-300 bg-rose-50 hover:bg-rose-100 active:bg-rose-200'
            : 'border-rose-200 hover:bg-rose-50 hover:border-rose-300 active:bg-rose-100')
          : (active
            ? 'border-primary bg-accent hover:bg-[#DBEAFE] active:bg-[#BFDBFE]'
            : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted'))}
      style={{
        fontWeight: active ? 500 : 400,
        color: danger ? 'hsl(var(--destructive))' : active ? 'hsl(var(--primary))' : undefined,
      }}
    >
      {icon}
      {label}
      {typeof count === 'number' && (
        <span
          className={cn('text-10 rounded-full px-1.5 py-px min-w-[18px] text-center tabular-nums',
            danger ? (active ? 'bg-rose-100' : 'bg-rose-50') : active ? 'bg-primary/10' : 'bg-muted')}
          style={{
            fontWeight: 600,
            color: danger ? 'hsl(var(--destructive))' : active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
          }}
        >
          {fmtNumber(count)}
        </span>
      )}
    </button>
  )
}

// Pill section with a "Show all N" / "Show less" toggle for long option lists
// (Partner FiltersModal PillSection). Chips render with FilterPill; once the
// option count exceeds `threshold` (8), the overflow collapses behind the toggle.
export function PillSection({ options, selected, onToggle, getCount, threshold = 8, leading }: {
  options: { value: string; label: React.ReactNode }[]
  selected: string[]
  onToggle: (value: string) => void
  getCount: (value: string) => number
  threshold?: number
  /* Rendered as the first pill in the wrap - used to pass an <AllPill /> so it
     shares the row rather than sitting on a line of its own. */
  leading?: React.ReactNode
}) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? options : options.slice(0, threshold)
  const hasMore = options.length > threshold
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {leading}
        {visible.map(opt => (
          <FilterPill key={opt.value} active={selected.includes(opt.value)} onClick={() => onToggle(opt.value)} count={getCount(opt.value)}>
            {opt.label}
          </FilterPill>
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(s => !s)}
          className="inline-flex items-center gap-1 mt-2.5 text-[13px] cursor-pointer transition-colors hover:opacity-80"
          style={{ fontWeight: 500, color: 'hsl(var(--primary))' }}
        >
          {showAll ? 'Show less' : `Show all ${options.length}`}
          {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  )
}

// Period labels are "MMM YYYY", which sorts alphabetically by month name rather
// than chronologically, so rank them by their position in the company's own
// period list - newest first, the end a reader reaches for. This matters more
// than it looks: the dropdown list is scrolled rather than fully visible, so the
// ordering decides which periods are reachable without typing. Labels absent
// from the list (older archived periods) fall to the end rather than the front.
export function orderPeriodsRecentFirst(labels: string[], periods: { label: string }[]): string[] {
  const rank = new Map(periods.map((p, i) => [p.label, i]))
  return [...labels].sort((a, b) => (rank.get(b) ?? -1) - (rank.get(a) ?? -1))
}

// Multi-select dropdown for open-ended option lists. Pills - even searchable,
// height-capped ones - still spend the facet's whole width on options the reader
// probably isn't after; a closed dropdown spends one line and says what's picked.
// The panel reuses the column-header filter editor's recipe (search above a
// scrolling checkbox list, "N selected · Clear selection" footer) so editing a
// facet feels the same from the modal as from a column header.
export function SearchableDropdownSelect({ options, selected, onToggle, onClear, getCount, allLabel = 'All', searchPlaceholder = 'Search…' }: {
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
  onClear: () => void
  getCount: (value: string) => number
  /* Shown on the trigger while nothing is picked - i.e. the unfiltered state. */
  allLabel?: string
  searchPlaceholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [width, setWidth] = useState(320)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) { setSearch(''); return }
    if (ref.current) setWidth(ref.current.offsetWidth)
    const away = (e: MouseEvent) => { if (clickIsOutside(e, ref.current)) setOpen(false) }
    // Escape closes the dropdown without reaching the modal behind it, which
    // would otherwise dismiss the whole Filters panel and drop the draft.
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key, true)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key, true) }
  }, [open])

  const selectedSet = new Set(selected)
  const q = search.trim().toLowerCase()
  const visible = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options
  const summary = selected.length === 0
    ? allLabel
    : selected.length === 1
      ? (options.find(o => o.value === selected[0])?.label ?? selected[0])
      : `${selected.length} selected`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn('w-full h-9 px-3 flex items-center justify-between gap-2 text-[13px] border rounded-lg bg-white cursor-pointer transition-colors',
          open ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50')}
      >
        <span
          className={cn('truncate', selected.length ? 'text-foreground' : 'text-muted-foreground/60')}
          style={{ fontWeight: selected.length ? 500 : 400 }}
        >
          {summary}
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 text-muted-foreground/60 transition-transform', open && 'rotate-180')} />
      </button>

      <AnchoredPopover anchor={ref} open={open} width={width}>
        {options.length > 5 && (
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                autoFocus
                className={cn(FILTER_INPUT_CLS, 'pl-8 pr-8')}
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="border-t border-border/40 mt-2 -mx-3" />
          </div>
        )}
        <div className="max-h-[240px] overflow-y-auto overscroll-contain scrollbar-thin py-1 px-1">
          {visible.length === 0
            ? <div className="px-3 py-4 text-center text-[13px] text-muted-foreground">No options found</div>
            : visible.map(opt => {
                const on = selectedSet.has(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onToggle(opt.value)}
                    className={cn('flex items-center gap-2.5 w-full px-2.5 py-[6px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/50', on && 'bg-primary/5')}
                  >
                    <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', on ? 'bg-primary border-primary' : 'border-border-strong bg-white')}>
                      {on && <Check size={11} className="text-white" />}
                    </span>
                    <span className="text-foreground truncate" style={{ fontWeight: on ? 500 : 400 }}>{opt.label}</span>
                    <span className="ml-auto text-[11px] tabular-nums text-muted-foreground/50">{fmtNumber(getCount(opt.value))}</span>
                  </button>
                )
              })}
        </div>
        {selected.length > 0 && (
          <>
            <div className="border-t border-border/40" />
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">{selected.length} selected</span>
              <button type="button" onClick={onClear} className="text-[12px] cursor-pointer transition-colors hover:opacity-80" style={{ fontWeight: 500, color: 'hsl(var(--primary))' }}>Clear selection</button>
            </div>
          </>
        )}
      </AnchoredPopover>
    </div>
  )
}

// Short number formatting for range-input placeholders (1.2K, 3.4M). Contra
// accounts hold a negative balance, so the magnitude is abbreviated and the sign
// put back afterwards.
const formatShort = (n: number) => {
  const sign = n < 0 ? '-' : ''
  const m = Math.abs(n)
  if (m >= 1_000_000) return `${sign}${(m / 1_000_000).toFixed(1)}M`
  if (m >= 1_000) return `${sign}${(m / 1_000).toFixed(m >= 10_000 ? 0 : 1)}K`
  return n.toLocaleString()
}

const RANGE_FIELD_CLS = 'w-full h-9 pl-7 pr-3 text-[13px] border rounded-lg bg-white focus:outline-none tabular-nums'
const RANGE_OK_CLS = 'border-border focus:ring-2 focus:ring-primary/20 focus:border-primary'
const RANGE_CROSSED_CLS = 'border-danger-500 ring-4 ring-danger-100 focus:border-danger-500'

// Min / Max numeric range inputs (Partner FiltersModal RangeHistogram): two
// labelled fields with a prefix glyph, placeholders drawn from the data extent.
export function RangeMinMax({ values, min, max, onMinChange, onMaxChange, prefix = '$', magnitude = false, placeholders }: {
  values: number[]
  min: string
  max: string
  onMinChange: (v: string) => void
  onMaxChange: (v: string) => void
  prefix?: string
  /* Set where the range bounds a size rather than a signed figure, so the
     crossed-range warning reads the pair the way the filter matches it: -100 to
     10 is inverted on an amount filter and is not on a balance one. */
  magnitude?: boolean
  /** Placeholder copy for the two fields, in place of the data's extent. */
  placeholders?: { min: string; max: string }
}) {
  const dataMin = useMemo(() => (values.length ? Math.min(...values) : 0), [values])
  const dataMax = useMemo(() => (values.length ? Math.max(...values) : 100), [values])
  const sliderMin = Math.floor(dataMin)
  const sliderMax = Math.ceil(dataMax) || 100
  const crossed = invertedRange(min, max, magnitude)
  const fieldCls = cn(RANGE_FIELD_CLS, crossed ? RANGE_CROSSED_CLS : RANGE_OK_CLS)
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>Minimum</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">{prefix}</span>
            <input
              type="number"
              placeholder={placeholders?.min ?? formatShort(sliderMin)}
              value={min}
              onChange={e => onMinChange(e.target.value)}
              aria-invalid={crossed || undefined}
              className={fieldCls}
            />
          </div>
        </div>
        <span className="text-muted-foreground/30 mt-5">–</span>
        <div className="flex-1">
          <label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>Maximum</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">{prefix}</span>
            <input
              type="number"
              placeholder={placeholders?.max ?? formatShort(sliderMax)}
              value={max}
              onChange={e => onMaxChange(e.target.value)}
              aria-invalid={crossed || undefined}
              className={fieldCls}
            />
          </div>
        </div>
      </div>
      {crossed && (
        <CrossedRangeNote
          what="The minimum is above the maximum, so nothing can fall between them."
          onSwap={() => { onMinChange(max); onMaxChange(min) }}
        />
      )}
    </div>
  )
}

// From / To date range, the sibling of RangeMinMax: same 11px labels at mb-1.5
// and same 36px lg-radius field, so a modal stacking the two reads as one grid.
export function DateRangeFromTo({ from, to, onFromChange, onToChange, placeholder = 'Any' }: {
  from: string
  to: string
  onFromChange: (iso: string) => void
  onToChange: (iso: string) => void
  placeholder?: string
}) {
  const crossed = invertedDates(from, to)
  const triggerCls = cn(DATE_TRIGGER_CLS, crossed && 'border-danger-500 ring-4 ring-danger-100')
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>From</label>
          <DateField clearable value={from} placeholder={placeholder} triggerClassName={triggerCls} onChange={onFromChange} />
        </div>
        <div className="min-w-0">
          <label className="text-[11px] text-muted-foreground mb-1.5 block" style={{ fontWeight: 500 }}>To</label>
          <DateField clearable value={to} placeholder={placeholder} triggerClassName={triggerCls} onChange={onToChange} />
        </div>
      </div>
      {crossed && (
        <CrossedRangeNote
          what="The From date is after the To date, so no day falls between them."
          onSwap={() => { onFromChange(to); onToChange(from) }}
        />
      )}
    </div>
  )
}

const DATE_TRIGGER_CLS = 'w-full h-9 px-3 text-[13px] border border-border rounded-lg bg-white hover:border-primary/50 transition-colors'
