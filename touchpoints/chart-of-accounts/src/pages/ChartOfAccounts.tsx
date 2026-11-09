import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ReadingRoom } from '../components/walkthrough/ReadingRoom'
import { CHART_READING_ROOM } from '../components/BuildEducation'
import { hiddenSearchHits, searchHits, type SearchContext } from '../lib/accountSearch'
import { SearchRevealNote, orderWithRevealed, useSearchReveal } from '../components/SearchReveal'
import { buildChartIndex } from '../lib/chartTree'
import { useRememberedState } from '../lib/rememberedState'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus, Upload, Download, Search, AlertTriangle, Layers, Pencil, Merge, Wallet, Users, User, ChevronDown, Sparkles, Wand2, Check, BarChart3, Columns3, X, DollarSign, Sprout, ArrowRightFromLine, Sliders, UnfoldVertical, FoldVertical, Trash2, CircleCheck, CircleSlash, ChevronRight, Landmark, Info } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { Button, Banner, Card, CardHeader, ConfirmModal, EmptyState, HowItWorksButton, Menu, MenuItem, Pill, Tooltip, useResponsiveIconSize } from '../components/ui'
import { AccountTree, ColumnConfig, ColKey, DEFAULT_COLUMNS, DEFAULT_COLUMN_ORDER, useTreeExpansion, ColumnFiltersBar, ColFilters, matchesColFilters, filterActive, withAncestorContext, HEADER_DEFS, uniqueColValues, blankFilter } from '../components/AccountTable'
import { applyFilters, clearPanelFilters, countFiltersActive, countNarrowing, EMPTY_FILTERS, FilterState, FiltersButton, FiltersSlideOver, offTheListing, QuickFilterPill } from '../components/Filters'
import { DimensionsPicker } from '../components/DimensionsPicker'
import { ColumnSelector } from '../components/ColumnSelector'
import { DensityMenu } from '../components/DensityMenu'
import { COUNT_BADGE, TOOL_BTN, TOOL_BTN_ACTIVE, lookSections, useCrosshair, useTableLook } from '../components/tableLook'
import { BulkActionBar, type BulkAction } from '../components/BulkActionBar'
import { ViewTabs, ViewsMenu, ViewBuilderModal, ViewAggBar } from '../components/CoaViews'
import { CoaView, DEFAULT_VIEWS, ALL_VIEW } from '../lib/coaViews'
import { roleKpiAccounts, roleKpiBalance } from '../lib/coaKpis'
import { FiscalYearLockInfo, FiscalYearPicker } from '../components/FiscalYearPicker'
import { useStore, usePeriodScopedAccounts, useSelectedPeriod, useAccountNumberText, defaultClassificationForCategory } from '../store'
import { Account, AccountType, StatementClassification, GLAccountType, ACCOUNT_TYPE_META, CATEGORY_ORDER, CLASSIFICATIONS_BY_CATEGORY, CompanyConfig, needsBankDetails } from '../types'
import { cn, fmtCurrency, fmtNumber, todayIso, uid } from '../lib/utils'
import { ME_MODE } from '../lib/features'
import { lastEndedPeriod, monthlyBalanceAsOf } from '../lib/monthlyLedger'
import { PeriodStrip } from '../components/PeriodStrip'
import { CreateAccountSlideOver } from './CreateAccount'
import { MoveUnderSummaryModal } from '../components/MoveUnderSummaryModal'
import { useAccountLifecycle } from './AccountActions'
import { ImportAccountsModal } from './ImportAccounts'
import { ExportAccountsModal, type ExportScope } from './ExportAccounts'
import { NewJournalEntryModal } from '../components/NewJournalEntryModal'
import { GuidedWizard, StepTabs } from './Setup'
import { GuidedSetupWizard } from './GuidedSetupWizard'
import { PerformanceInsights, KpiInsightsPanel, DEFAULT_COA_KPIS, activeCoaKpiDefs } from '../components/CoaInsights'

// First-time three-path onboarding cards: the guided-wizard / upload /
// build-from-scratch landing, reachable via the "View as first-time user" button.
const FIRST_TIME_SETUP_ENABLED = true

/* A bank or credit card account still missing the details no import template
   carries. It is the one chip on the listing that does something when clicked,
   and it earns that: the account cannot be reconciled until it is answered, and
   the form that answers it is otherwise two clicks deep in the row menu.

   The import grid states the same fact as "Needs details". Here it is named for
   what is left to do rather than for what is absent, because an account already
   on the chart is asking to be acted on rather than read. */
function NeedsActionChip({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip
      side="bottom"
      content={
        <span className="block max-w-[240px]">
          This account is missing the bank details it needs before it can be reconciled. Click to add them.
        </span>
      }
    >
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onClick() }}
        className="badge-warning shrink-0 whitespace-nowrap hover:bg-warning-100 transition-colors"
      >
        <Landmark size={10} className="shrink-0" />
        Needs action
      </button>
    </Tooltip>
  )
}

/* Columns offered in the Columns side panel. The table's own default order is
   the panel's order too - they were two identical lists, kept a hundred lines
   and one file apart. Labels come from HEADER_DEFS so the panel and the table
   header cannot drift apart either. */
const COLUMN_SPECS: { key: keyof ColumnConfig; label: string }[] =
  DEFAULT_COLUMN_ORDER.map(k => ({ key: k, label: HEADER_DEFS[k].label }))
// GL Account No. and GL Account Name stay pinned so the row is always
// identifiable, even with everything else hidden. See `isLockedCol`.
const LOCKED_COLUMNS = ['number', 'name']

// Per-type entries for the Collapse / Expand dropdown (tree view).
const COLLAPSE_MENU_TYPES: { code: AccountType; label: string }[] = [
  { code: 'AST', label: 'Assets' },
  { code: 'LIA', label: 'Liability' },
  { code: 'REV', label: 'Revenue' },
  { code: 'EQT', label: 'Equity' },
  { code: 'EXP', label: 'Expense' },
]


// Mahad's copy, 2026-10-11.
const PERIOD_HINT = 'The accounting period this page reports on. Changing it updates the opening balance and period KPIs. Current KPIs and running balance don’t change with it.'

export default function ChartOfAccountsPage() {
  const navigate = useNavigate()
  const { company, periods, journalEntries, transactions } = useStore()
  const fiscalYearStart = company.fiscalYearStart
  const seedQ1Openings = useStore(s => s.seedQ1Openings)
  // The chart read against the accounting period in force, so sorting by balance
  // or net change orders rows by the figures actually on screen. Structure
  // (numbers, names, parents, status) is untouched by the period.
  const accounts = usePeriodScopedAccounts()
  // The same accounts with their balances as they stand right now. The cards that
  // say "Current" mean today, not the period in force, so they read off this.
  const liveAccounts = useStore(s => s.accounts)
  const selectedPeriod = useSelectedPeriod()
  const numberText = useAccountNumberText()
  // The account a journal entry was asked for from its row. Held rather than a
  // boolean, because the form opens on that account's first line.
  const [jeAccount, setJeAccount] = useState<Account | null>(null)

  /* What the reader was looking at - the search, the category pill, the filters
     and the view - is remembered for when they come back from an account, rather
     than wiped when the page unmounts. See `useRememberedState`. */
  const [query, setQuery] = useRememberedState('coa:query', '')
  // Starts at the remembered search, so coming back does not flash the whole chart first.
  const [debouncedQ, setDebouncedQ] = useState(query)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const [sortPill, setSortPill] = useRememberedState<'all' | 'pending' | 'archived' | 'AST' | 'LIA' | 'EQT' | 'REV' | 'EXP'>('coa:pill', 'all')
  // Me mode - restrict the table to accounts created by the signed-in user.
  // Hidden for now (see ME_MODE): off, a remembered "on" is read as off.
  const [meModeSaved, setMeMode] = useRememberedState('coa:me', false)
  const meMode = ME_MODE && meModeSaved
  const [importOpen, setImportOpen] = useState(false)
  /* The guide that explains the chart, from the chart itself. It was reachable
     only inside setup, so once setup was done there was no way back to it.
     Decision 124; module review, 2026-10-06 (COA-20). */
  const [guideOpen, setGuideOpen] = useState(false)
  // The export opens from Actions (whatever the filters leave standing) or from
  // the bulk bar (the ticked rows). Both the scope banner and the rows written
  // are fixed at open time, so a filter changing behind the modal cannot move
  // the ground under a reader who is picking columns.
  const [exportOpen, setExportOpen] = useState(false)
  const [exportScope, setExportScope] = useState<ExportScope | null>(null)
  const [exportRows, setExportRows] = useState<Account[]>([])
  // Whether the toolbar last opened or closed the whole tree. Held rather than
  // derived: the reader is free to toggle single rows afterwards, and the menu
  // reports which of its own two options is in force, not a reading of the tree.
  const [expandMode, setExpandMode] = useState<'expanded' | 'collapsed'>('expanded')
  // Responsive chrome-icon sizes, scaled at the same breakpoints as the root font.
  const ic16 = useResponsiveIconSize(16)
  const ic14 = useResponsiveIconSize(14)
  // Running Balance is default-on for the COA listing only - the live daily
  // balance, updated with each posting rather than locked to a month.
  /* Dimensions is default-off across the app but on for a chart that carries
     them. Someone who has just split them out of their numbers is told the
     column exists by seeing it, not by hunting the column menu for it. The
     import is a modal over this page, so the page never remounts and the
     initialiser alone would never fire; the effect catches the moment the first
     values land, and the ref keeps it to that moment so hiding the column
     afterwards sticks. */
  const chartHasDimensions = useStore(s => s.accounts.some(a => a.defaultDimensionValues.length > 0))
  /* What search needs to read every column as it prints: dimension names for
     "Location: USA", and the period's chart and base currency for the figures. */
  const dimensions = useStore(s => s.dimensions)
  const searchCtx = useMemo<SearchContext>(() => {
    const names = new Map(dimensions.map(d => [d.id, d.name]))
    return { dimensionName: id => names.get(id), index: buildChartIndex(accounts), base: company.baseCurrency }
  }, [dimensions, accounts, company.baseCurrency])
  const [columns, setColumns] = useRememberedState<ColumnConfig>('coa:columns', () => ({ ...DEFAULT_COLUMNS, dimensions: chartHasDimensions }))
  const hadDimensions = useRef(chartHasDimensions)
  useEffect(() => {
    if (chartHasDimensions && !hadDimensions.current) setColumns(c => ({ ...c, dimensions: true }))
    hadDimensions.current = chartHasDimensions
  }, [chartHasDimensions])
  const [columnOrder, setColumnOrder] = useRememberedState<ColKey[]>('coa:columnOrder', DEFAULT_COLUMN_ORDER)
  // Columns the reader pinned from a header menu. Number and Name are pinned by
  // construction, and a locked column can be neither hidden nor unpinned, so
  // neither ever enters this list.
  const [frozenCols, setFrozenCols] = useRememberedState<ColKey[]>('coa:frozen', [])
  // Bulk selection, mirroring the Partners table.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = (ids: string[], checked: boolean) => setSelected(prev => {
    const n = new Set(prev)
    if (checked) ids.forEach(i => n.add(i)); else ids.forEach(i => n.delete(i))
    return n
  })
  const clearSelection = () => setSelected(new Set())
  // Bulk lifecycle actions, mirroring the Partners table: Activate acts on the
  // selected Inactive accounts, Deactivate on the selected Active ones. Each
  // button auto-hides when its target set is empty. Both route through the same
  // rules as a single row, so a posting account with open entries is skipped
  // rather than quietly flipped, and so is a summary account still holding active
  // accounts the reader did not also tick.
  const lifecycle = useAccountLifecycle()
  const selectedAccounts = useMemo(() => accounts.filter(a => selected.has(a.id)), [accounts, selected])
  // Anything not already open, so a selection made from the Archived pill has a
  // way back. Reopening is never refused, whatever state it is coming from.
  const markActiveTargets = useMemo(() => selectedAccounts.filter(a => a.status !== 'Active'), [selectedAccounts])
  const markInactiveTargets = useMemo(() => selectedAccounts.filter(a => a.status === 'Active'), [selectedAccounts])
  // No count badge: Export acts on the whole selection, so the bar's own "n
  // selected" already states the number and a second one beside it would not.
  const openBulkExport = () => {
    setExportScope({ kind: 'selected', selectedCount: selectedAccounts.length })
    setExportRows(selectedAccounts)
    setExportOpen(true)
  }
  const bulkActions: BulkAction[] = [
    { key: 'active', label: 'Activate', icon: CircleCheck, tone: 'success', count: markActiveTargets.length, onClick: () => lifecycle.requestBulk('activate', markActiveTargets.map(a => a.id), clearSelection) },
    { key: 'inactive', label: 'Deactivate', icon: CircleSlash, tone: 'warning', count: markInactiveTargets.length, onClick: () => lifecycle.requestBulk('deactivate', markInactiveTargets.map(a => a.id), clearSelection) },
    { key: 'export', label: 'Export', icon: Download, tone: 'neutral', onClick: openBulkExport },
  ]
  const [filters, setFilters] = useRememberedState<FilterState>('coa:filters', EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Column-header filters (the chip row beneath the toolbar), shared between the
  // header menus and the ActiveFilters bar so they stay in sync.
  const [colFilters, setColFilters] = useRememberedState<ColFilters>('coa:colFilters', {})

  // ── Saved Views (read-only lenses; see coa-views-spec.md) ──
  const fullView = useStore(s => s.fullView)
  const setFullView = useStore(s => s.setFullView)
  // Leave full view when navigating away so it never persists onto another page.
  useEffect(() => () => setFullView(false), [setFullView])
  const coaSavedViews = useStore(s => s.coaSavedViews)
  const addCoaView = useStore(s => s.addCoaView)
  const updateCoaView = useStore(s => s.updateCoaView)
  const removeCoaView = useStore(s => s.removeCoaView)
  const allViews = useMemo(() => [...DEFAULT_VIEWS, ...coaSavedViews], [coaSavedViews])
  const [activeViewId, setActiveViewId] = useRememberedState('coa:view', 'all')
  const [tempView, setTempView] = useRememberedState<CoaView | null>('coa:tempView', null)
  const [builderOpen, setBuilderOpen] = useState(false)
  // Seed values for the builder (null = blank "Create view"). When editingSavedId
  // is set, Apply updates that saved view in place; otherwise Apply creates a new
  // temporary view.
  const [builderInitial, setBuilderInitial] = useState<CoaView | null>(null)
  const [editingSavedId, setEditingSavedId] = useState<string | null>(null)
  const openCreateView = () => { setBuilderInitial(null); setEditingSavedId(null); setBuilderOpen(true) }
  // Saved view pending deletion - drives the confirm modal.
  const [deleteViewId, setDeleteViewId] = useState<string | null>(null)
  // Confirm before discarding an unsaved (temporary) view.
  const [discardOpen, setDiscardOpen] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const activeView: CoaView = (tempView && tempView.id === activeViewId)
    ? tempView
    : (allViews.find(v => v.id === activeViewId) ?? ALL_VIEW)
  const lensActive = activeView.kind !== 'all'
  // Clear the active view back to All accounts. When an unsaved temp view is
  // active, route through a "Discard view?" confirm first so work isn't lost.
  const clearView = () => { setTempView(null); setActiveViewId('all'); setCollapsedSections(new Set()); setDiscardOpen(false) }
  const requestClearView = () => { if (tempView && activeViewId === '__temp') setDiscardOpen(true); else clearView() }
  // Persist the active temporary view (named in the Create View modal) and share
  // it with the team - straight to a success toast, no extra naming modal.
  const saveTempView = () => {
    if (!tempView) return
    const v: CoaView = { ...tempView, id: `view_${uid()}`, shared: true, builtin: false, owner: 'Ahtisham Ahmad (You)' }
    addCoaView(v)
    setTempView(null); setActiveViewId(v.id)
    useStore.getState().pushToast(`"${v.name}" saved`, 'success')
  }
  // Open the Create view modal seeded from the active view. A saved view updates
  // in place on Apply; a temporary or built-in view applies as a new temp view.
  const editActiveView = () => {
    const savedId = (!activeView.builtin && activeViewId !== '__temp') ? activeView.id : null
    setBuilderInitial(activeView); setEditingSavedId(savedId); setBuilderOpen(true)
  }
  // Remove the active view: discard a temp (with confirm), delete a saved view
  // (with confirm), or simply exit a built-in lens.
  const removeActiveView = () => {
    if (activeViewId === '__temp') requestClearView()
    else if (!activeView.builtin) setDeleteViewId(activeView.id)
    else clearView()
  }
  const toggleSection = (key: string) => setCollapsedSections(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })
  const [columnsOpen, setColumnsOpen] = useState(false)
  /* How the chart is drawn. The listing offers everything there is to offer: its
     rows nest, so Tree layout is real, and they are grouped by category, so Pin
     group headings is too. */
  const { look, set: setLook, toggle: toggleVisual, lookClass } = useTableLook(undefined, 'coa:look')
  const tableScrollRef = useRef<HTMLDivElement>(null)
  useCrosshair(tableScrollRef, look.crosshair)
  // Performance Insights (Partners-parity): active KPI keys (ordered, draggable),
  // the drawer open state, and a refreshed timestamp.
  const [activeKpis, setActiveKpis] = useState<string[]>([...DEFAULT_COA_KPIS])
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false)
  const [lastInsightsRefreshed, setLastInsightsRefreshed] = useState(() => new Date())
  const toggleKpi = (key: string) => setActiveKpis(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])

  // Expansion, on the same hook every other surface that renders the tree uses.
  // Note the accounts here are period-scoped, so this array changes identity
  // whenever the reader picks another period - which the hook ignores, because
  // it tracks which summaries it has seen rather than the array.
  const { expanded, setExpanded, toggle } = useTreeExpansion(accounts)
  // Tree group (Type / classification header) collapse state, lifted here so Expand /
  // Collapse all can drive it alongside the account hierarchy. A key in the set
  // means that group is collapsed; an empty set means everything is expanded.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const toggleGroup = (key: string) => setCollapsedGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  const allGroupKeys = useMemo(() => {
    const keys = new Set<string>()
    accounts.forEach(a => keys.add(a.accountType))
    return keys
  }, [accounts])
  // Collapsing closes the category heads too, so the chart reads as five rows
  // rather than five rows plus whatever the reader had left open underneath.
  const setAllExpanded = (mode: 'expanded' | 'collapsed') => {
    if (mode === 'expanded') { setExpanded(new Set(accounts.filter(a => !a.isPosting).map(a => a.id))); setCollapsedGroups(new Set()) }
    else { setExpanded(new Set()); setCollapsedGroups(new Set(allGroupKeys)) }
    setExpandMode(mode)
  }

  const [createOpen, setCreateOpen] = useState(false)
  // Section 1: prefill for the create modal when it is opened from an inline
  // "+ row" in the table/tree (carries the number/name/type the user typed).
  const [createDefaults, setCreateDefaults] = useState<Partial<{ accountNumber: string; accountName: string; accountType: AccountType; glAccountType: GLAccountType; statementClassification: StatementClassification; parentId: string | null }> | undefined>(undefined)
  // Opens the create modal pre-filled with what was typed/derived on an inline
  // "+ row": number, name, Category, GL Account Type, and the derived classification.
  const onCreateRow = (prefill: { accountNumber?: string; accountName?: string; accountType?: AccountType; glAccountType?: GLAccountType; statementClassification?: StatementClassification; parentId?: string | null }) => {
    setWrapAcct(null)
    setCreateDefaults(prefill)
    setCreateOpen(true)
  }
  // The posting account a new summary is being built above, from the row menu's
  // "Move under a new summary account". Null for an ordinary add.
  const [wrapAcct, setWrapAcct] = useState<Account | null>(null)
  /* The row menu's one child request, answered by what the row can actually
     hold. A summary opens the create modal pre-parented to it, inheriting its
     Category and classification. A posting account has no room underneath, so it
     opens the move dialog instead, which builds a summary in that account's own
     place and moves the account under it. */
  const onAddChild = (parent: Account) => {
    if (parent.glAccountType === 'Posting') {
      setWrapAcct(parent)
      return
    }
    setWrapAcct(null)
    setCreateDefaults({ accountType: parent.accountType, statementClassification: parent.statementClassification, parentId: parent.id })
    setCreateOpen(true)
  }
  const [editAcct, setEditAcct] = useState<Account | null>(null)
  /* Whether the form opens as the bank details alone. Set when the reader
     clicked something that already named the problem, so what opens answers it
     rather than reopening the whole account. */
  const [editBankOnly, setEditBankOnly] = useState(false)
  const openEdit = (a: Account) => { setEditBankOnly(false); setEditAcct(a) }
  const openBankDetails = (a: Account) => { setEditBankOnly(true); setEditAcct(a) }

  /* Two readings of one narrowing, because the tree needs a third thing on screen
     that the reader did not ask for. `matches` is what answered the search and the
     filters: what the count says, what a view aggregates, what an export writes.
     `treeRows` is that plus the summaries above each match, so the tree can show an
     account in its place rather than floating under the wrong heading.
   *
   * They used to be one array, and searching PAYROLL reported twelve results for
   * three accounts and nine ancestors, because every ancestor drawn to place a
   * match was counted as one. */
  const { matches, treeRows } = useMemo(() => {
    let list = accounts

    // An archived account is off the chart, so it stays out of the listing until
    // asked for: by the Archived pill, which shows those and nothing else, or by
    // the Filters slide-over's Status section alongside everything else. The
    // exception is the period it was archived in, where it still has figures
    // (see `offTheListing`).
    if (sortPill === 'archived') list = list.filter(a => a.status === 'Archived')
    else list = list.filter(a => !offTheListing(a, filters))

    // Me mode - only accounts created by the signed-in user (createdBy is
    // stamped "… (You)" for accounts created in-app).
    if (meMode) list = list.filter(a => a.createdBy.includes('(You)'))

    // Quick-filter pills: only the account-type categories remain here; every
    // other facet (status, running balance, transactions, currency) lives in the
    // Filters slide-over. `pending` is a programmatic lens used after import.
    if (sortPill === 'pending') list = list.filter(a => a.pendingReview)
    if (['AST','LIA','EQT','REV','EXP'].includes(sortPill)) list = list.filter(a => a.accountType === sortPill as AccountType)

    // Search
    if (debouncedQ) {
      const q = debouncedQ
      // Every column's text, on or off - see COLUMN_SEARCH_TEXT. The numbers the
      // account arrived as are the case that started it: after a dimensional
      // import the number on screen is only part of what the customer has been
      // typing for years, so 01-71100-40 has to find 71100 with its column off.
      list = list.filter(a => searchHits(a, q, searchCtx).length > 0)
    }

    list = applyFilters(list, filters)

    // Saved View lens - the filter layer narrows to the view's account types.
    // This composes (AND) with search / pills / column filters; the lens is
    // presentational only and never writes to the accounts.
    if (activeView.types && activeView.types.length) {
      const types = activeView.types
      list = list.filter(a => types.includes(a.accountType))
    }

    // Column-header filters (the chip row).
    const activeCols = (Object.keys(colFilters) as ColKey[]).some(k => filterActive(colFilters[k]))
    if (activeCols) {
      const matchesCols = (a: Account) => matchesColFilters(a, colFilters, accounts)
      list = list.filter(matchesCols)
    }

    /* The summaries above each match, added for the tree alone: it shows an account
       in its place and heads each category with its own root rather than with the
       first survivor. They are context, not results, so they are not in `matches`. */
    /* Not for a search, though: a search answers with the rows that matched and
       nothing else. Design review, 2026-09-30 - Eli: *"If you're doing the
       search, then you're expecting the search to show you the specific line
       ... Just because I'm a child of a child of a child ... it makes searching
       very difficult."* A match whose parent is not drawn reads as a root at its
       own level, so it still sits under its category. */
    const treeRows = !debouncedQ && activeCols
      ? withAncestorContext(accounts, list, filters.statuses.includes('Archived'))
      : list

    return { matches: list, treeRows }
  }, [accounts, sortPill, debouncedQ, filters, meMode, colFilters, activeView, searchCtx, selectedPeriod, fiscalYearStart])

  /* The hidden columns a search matched in, shown while it runs. A row that
     answered because of its internal ID - every one of which starts ACC - used
     to arrive with nothing on screen saying why. Design review, 2026-09-30 -
     Eli: *"the whole point of our system is it's supposed to tell you what
     you're picking up on."* Only for this search: the reader's own column
     choice is untouched, and a column they hide again stays hidden until the
     search changes. */
  const { revealed: revealedCols, hide: unreveal } = useSearchReveal(
    debouncedQ,
    useMemo(() => {
      const hits = hiddenSearchHits(matches, debouncedQ, k => !!columns[k], searchCtx)
      return columnOrder.filter(k => hits.includes(k))
    }, [matches, debouncedQ, columns, searchCtx, columnOrder]),
  )
  const shownColumns = useMemo(
    () => revealedCols.length ? { ...columns, ...Object.fromEntries(revealedCols.map(k => [k, true])) } : columns,
    [columns, revealedCols])
  // Next to the name, where the eye already is: most of these columns live at
  // the far end of the table, off screen on anything but a wide monitor.
  const shownOrder = useMemo(() => orderWithRevealed(columnOrder, revealedCols, 'name'), [columnOrder, revealedCols])

  /* What the count reads "of": every account in the chart, archived included, in
     every state the page can be in. The denominator answers "how many accounts are
     there", which does not change when the reader opens a filter - only the
     numerator does. So an untouched page reads "136 of 138", and the Archived pill
     reads "2 of 138" rather than "2 of 136", and the two can be read against each
     other because they are shares of the same whole.

     This total used to drop the archived accounts unless Filters → Status asked for
     them, on the argument that an untouched page should not read as though the
     reader had already narrowed something. That moved the base instead: the same
     chart was 136 in one state and 138 in another, so the pill row, the Filters
     panel and the Archived view each counted against a different whole. */
  const totalAccounts = accounts.length

  const largeQueryWarn = matches.length > 500

  /* What the table says when the narrowing left nothing. An empty tbody under a
     full header row reads as a chart with no accounts in it, which is a different
     and much more alarming thing than a search that found none.
   *
   * The term is named, because "no results" does not tell the reader whether they
   * mistyped it. And the two ways out are offered separately: a reader who has set
   * up filters and then searched inside them wants their search back, not their
   * filters cleared out from under them. */
  const colFiltersActive = useMemo(
    () => (Object.keys(colFilters) as ColKey[]).some(k => filterActive(colFilters[k])),
    [colFilters])
  // Every narrowing that is not the search box, from either filter control: a
  // dimension pick holds accounts back exactly the way a status does, so the empty
  // state has to own up to it whichever button set it.
  const otherNarrowing = countNarrowing(filters) > 0 || colFiltersActive
  const clearNarrowing = () => { setFilters(EMPTY_FILTERS); setColFilters({}) }

  /* Actions → Export. The file is whatever the page is showing either way, so the
     banner's only job is to say whether the reader narrowed it. That is asked of
     the controls rather than of the count: an untouched chart holds its archived
     accounts back on its own, so `matches` is already short of `accounts` before
     anyone has touched a filter, and comparing the two reported every export as
     filtered. */
  const exportNarrowed = !!debouncedQ || otherNarrowing || meMode || sortPill !== 'all' || lensActive
  const openHeaderExport = () => {
    setExportScope(exportNarrowed
      ? { kind: 'filtered', filteredCount: matches.length, totalCount: totalAccounts }
      : { kind: 'all', totalCount: matches.length })
    setExportRows(matches)
    setExportOpen(true)
  }
  const noMatch = matches.length === 0 ? (
    <EmptyState
      icon={<Search size={20} />}
      title={debouncedQ ? `No accounts match "${debouncedQ}"` : 'No accounts match these filters'}
      description={debouncedQ
        ? `Nothing in the chart carries that in any of its columns.${otherNarrowing ? ' Filters are narrowing the chart as well, so an account that does match can still be held back by one.' : ''}`
        : 'Every account is held back by a filter. Widen one, or clear them to read the whole chart again.'}
      action={
        <div className="flex items-center justify-center gap-2">
          {debouncedQ && (
            <Button variant={otherNarrowing ? 'secondary' : 'primary'} onClick={() => setQuery('')}>
              {otherNarrowing ? 'Clear search, keep filters' : 'Clear search'}
            </Button>
          )}
          {otherNarrowing && (
            <Button variant="primary" onClick={debouncedQ ? () => { setQuery(''); clearNarrowing() } : clearNarrowing}>
              {debouncedQ ? 'Clear both' : 'Clear filters'}
            </Button>
          )}
        </div>
      }
    />
  ) : undefined

  /* A pill's number has to be the number of rows clicking it produces, and the
     pill filters on category alone, so summaries count too. Counting postings
     only made every pill read short of the table it opened.

     Which is why these follow the listing rather than the 138 the count reads
     "of": the two are shares of that whole, not rivals to it. The five category
     pills cover the 136 the page lists and the Archived pill holds the other 2,
     so the row adds up to the denominator beside it. */
  const pillCounts = useMemo(() => {
    const counted = accounts.filter(a => !offTheListing(a, filters))
    return Object.fromEntries(
      CATEGORY_ORDER.map(code => [code, counted.filter(a => a.accountType === code).length]),
    ) as Record<AccountType, number>
  }, [accounts, filters])

  const archivedCount = useMemo(() => accounts.filter(a => a.status === 'Archived').length, [accounts])

  // ===== KPI values =====
  const kpis = useMemo(() => {
    // Counts include summaries. A summary is a real account with a number that the
    // listing shows as a row, so a card headed "accounts" that silently omitted 37
    // of them could not be reconciled against the count under the table. The
    // `isPosting` guard belongs on figures, where a summary would double-count,
    // never on a headcount.
    const active = accounts.filter(a => a.status === 'Active').length
    const byType = (Object.keys(ACCOUNT_TYPE_META) as AccountType[]).map(t => ({
      type: t, count: accounts.filter(a => a.accountType === t).length,
    }))
    const headers = accounts.filter(a => !a.isPosting).length
    const dormant = accounts.filter(a => a.isPosting && a.balance === 0 && a.status === 'Active').length
    /* The accounting period in force, which is also the window the table's own
       figures are read against and the one the period strip below names. This
       used to be its own date-range menu in the insights header, a second period
       control on a page that already has one: it never agreed with the strip, and
       the cards on by default are balance snapshots that ignored it anyway. */
    const rangeFrom = new Date(selectedPeriod.startDate).getTime()
    const rangeTo = new Date(selectedPeriod.endDate).getTime() + 86400 * 1000 - 1
    const inRange = (d: string | number | Date) => { const t = new Date(d).getTime(); return t >= rangeFrom && t <= rangeTo }
    const recent = accounts.filter(a => inRange(a.updatedAt)).length
    const pending = accounts.filter(a => a.pendingReview).length
    const lockOpen = periods.filter(p => p.status === 'Open').length
    const lockSoft = periods.filter(p => p.status === 'Soft-Closed').length
    const lockHard = periods.filter(p => p.status === 'Hard-Locked').length

    // Activity within the selected window: total posting volume per account
    // drives "Top Account by Activity"; the largest net balance change per
    // account drives "Largest Movement".
    const inWindow = transactions.filter(t => inRange(t.date))
    const activityByAcct = new Map<string, number>()
    const netByAcct = new Map<string, number>()
    inWindow.forEach(t => {
      activityByAcct.set(t.accountId, (activityByAcct.get(t.accountId) ?? 0) + t.debit + t.credit)
      netByAcct.set(t.accountId, (netByAcct.get(t.accountId) ?? 0) + t.debit - t.credit)
    })
    let topAcctId = '', topActivity = 0
    activityByAcct.forEach((v, id) => { if (v > topActivity) { topActivity = v; topAcctId = id } })
    const topAccount = accounts.find(a => a.id === topAcctId)?.accountName ?? '-'
    let largestMovement = 0, largestMovementId = ''
    netByAcct.forEach((v, id) => { if (Math.abs(v) > largestMovement) { largestMovement = Math.abs(v); largestMovementId = id } })
    const lmAcct = accounts.find(a => a.id === largestMovementId)
    const largestMovementLabel = lmAcct ? `${lmAcct.accountNumber} ${lmAcct.accountName}` : '-'
    let periodNetChange = 0
    netByAcct.forEach(v => { periodNetChange += Math.abs(v) })

    /* Balance-driven KPIs, off the live accounts rather than the period-scoped
       ones. Every one of these cards is headed "Current", and current means today:
       moving the period strip back to March must not restate what the customers
       owe you now. The figures that do answer a period question - top account,
       largest movement, net change - are computed above from the window itself.

       Archived accounts are excluded because the listing beneath these cards hides
       them by default, and a card that quietly counts money from rows the table
       won't show can't be reconciled against it. Inactive accounts stay in - the
       listing shows those. Base currency throughout. */
    const posting = liveAccounts.filter(a => a.isPosting && a.status !== 'Archived')
    // Which accounts each card counts, and why a contra beside them counts too,
    // is settled once in lib/coaKpis so a card and the summary row under it
    // cannot state the same thing differently.
    const cashAccts = roleKpiAccounts(posting, ['Bank', 'Cash on Hand', 'Payments to Deposit'])
    const cashPosition = cashAccts.reduce((s, a) => s + (a.balance || 0), 0)
    let cashMovement = 0
    cashAccts.forEach(a => { cashMovement += netByAcct.get(a.id) ?? 0 })
    const receivables = roleKpiBalance(posting, 'Accounts Receivable')
    const payables = roleKpiBalance(posting, 'Accounts Payable')
    const inventoryValue = roleKpiBalance(posting, 'Inventory')
    const creditCardBalance = roleKpiBalance(posting, 'Credit Card')
    const currentAssets = posting.filter(a => a.statementClassification === 'Current asset').reduce((s, a) => s + (a.balance || 0), 0)
    const currentLiabilities = posting.filter(a => a.statementClassification === 'Current liability').reduce((s, a) => s + (a.balance || 0), 0)
    const workingCapital = currentAssets - currentLiabilities
    const multiCurrency = posting.filter(a => a.currencyCode !== company.baseCurrency).reduce((s, a) => s + Math.abs(a.balance || 0), 0)
    // Total value the business owns / owes (current snapshot, base currency).
    const totalAssets = posting.filter(a => a.accountType === 'AST').reduce((s, a) => s + (a.balance || 0), 0)
    const totalLiabilities = posting.filter(a => a.accountType === 'LIA').reduce((s, a) => s + (a.balance || 0), 0)
    const today = todayIso()

    // The monthly chain is walked once per account below, and walking it means
    // reading that account's own postings. Indexed here so the whole P&L costs
    // one pass over the ledger rather than one per account.
    const txByAccount = new Map<string, typeof transactions>()
    for (const t of transactions) {
      const list = txByAccount.get(t.accountId)
      if (list) list.push(t)
      else txByAccount.set(t.accountId, [t])
    }

    /* Performance figures add up one month only: the last month that has fully
       ended, never the part-finished current one - not the year to date, not all
       time, and not whatever period the strip has picked. Mahad, 2026-10-10:
       *"Net income and gross profit should add up one month only, the last
       closed month ... The card should name the month, for example 'August
       2026.'"* So each account counts its own movement inside that month, on the
       monthly ledger's opening → movement → closing chain. They used to read the
       closing total, which is the year so far. */
    const lastClosedMonth = lastEndedPeriod(periods, today)
    // Status is not filtered here, unlike the balance cards above. This states
    // what the books say for a month that is over, and archiving an account
    // afterwards does not un-earn the revenue it carried.
    let revenueTotal = 0, operatingRevenue = 0, expenseTotal = 0, costOfSales = 0
    if (lastClosedMonth) {
      for (const a of liveAccounts) {
        if (!a.isPosting || (a.accountType !== 'REV' && a.accountType !== 'EXP')) continue
        const mb = monthlyBalanceAsOf(a, txByAccount.get(a.id) ?? [], seedQ1Openings[a.id] ?? 0, periods, lastClosedMonth.endDate)
        if (!mb) continue
        if (a.accountType === 'REV') {
          // Normal-side, so contra revenue - returns, discounts - nets itself off:
          // a credit note reduces revenue instead of adding to it.
          revenueTotal += mb.movement
          // Gross profit is struck on what the business sells. Interest, rent and
          // a gain on selling a truck are income, and are in net income below,
          // but they are not sales and cannot bear a cost of sales.
          if (a.statementClassification !== 'Other income') operatingRevenue += mb.movement
        } else {
          expenseTotal += mb.movement
          // Only the direct cost of what was sold, which is the role saying so -
          // not every expense the month carried.
          if (a.accountRole === 'Cost of Goods Sold') costOfSales += mb.movement
        }
      }
    }
    const netIncome = revenueTotal - expenseTotal
    const grossProfit = operatingRevenue - costOfSales
    // The period's own label abbreviates ("Jul 2026"); the card spells the month
    // out, since that is the whole point of stamping it.
    const lastClosedMonthLabel = lastClosedMonth
      ? new Date(`${lastClosedMonth.startDate}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : ''

    // Month-anchored figure (lib/monthlyLedger): the accounting month containing
    // today, on the locked opening → net → closing chain, summed over the cash
    // accounts so it reads as "cash moved this much this month so far".
    let monthCashMovement = 0
    cashAccts.forEach(a => {
      const mb = monthlyBalanceAsOf(a, txByAccount.get(a.id) ?? [], seedQ1Openings[a.id] ?? 0, periods, today)
      if (mb) monthCashMovement += mb.movement
    })

    return { active, byType, headers, dormant, recent, pending, lockOpen, lockSoft, lockHard, topAccount, largestMovement, largestMovementId, largestMovementLabel, periodNetChange, cashPosition, cashMovement, receivables, payables, inventoryValue, creditCardBalance, workingCapital, multiCurrency, totalAssets, totalLiabilities, netIncome, grossProfit, lastClosedMonthLabel, monthCashMovement }
  }, [accounts, liveAccounts, periods, transactions, selectedPeriod, company.baseCurrency, seedQ1Openings, fiscalYearStart])

  /* Needs action is read off the account rather than off a flag set at import: an
     account that arrives complete is never chipped, and one somebody fills in
     stops being chipped the moment they save.

     Provenance used to ride here too, as an "Imported" chip shown while the
     Prior account number column was on. The Imported column answers that now,
     for every row and in both directions, so the chip was restating a cell a
     few columns over - and a badge beside the name is for something the reader
     has to act on. */
  const rowBadge = (a: Account) =>
    needsBankDetails(a) ? <NeedsActionChip onClick={() => openBankDetails(a)} /> : null

  /* Archive and delete are two different actions here, and used not to be: the
     kebab's Archive item raised 'delete', which this handler turned back into an
     archive. It read correctly on screen and there was no true delete behind it,
     so the published listing had no way to remove a row that was simply typed
     wrong. Both are now themselves, and each is gated by its own rule. */
  const onAction = (action: 'edit' | 'deactivate' | 'activate' | 'archive' | 'delete' | 'merge' | 'open' | 'openingBalance' | 'journalEntry', a: Account) => {
    if (action === 'edit') openEdit(a)
    else if (action === 'deactivate') lifecycle.request('deactivate', a)
    else if (action === 'activate') lifecycle.request(a.status === 'Archived' ? 'unarchive' : 'activate', a)
    else if (action === 'archive') lifecycle.request('archive', a)
    else if (action === 'delete') lifecycle.request('delete', a)
    else if (action === 'merge') navigate(`/merge?source=${a.id}`)
    else if (action === 'open') openDetail(a)
    /* The same form the General Ledger raises, opened on the row that asked. Not
       a chart-shaped copy of it: an entry written from here has to be the entry
       written anywhere, or the two drift and only one of them balances. */
    else if (action === 'journalEntry') setJeAccount(a)
    /* Not built. Said plainly rather than left as a menu item that swallows the
       click, which reads as a broken build rather than as an unfinished one. */
    else if (action === 'openingBalance') {
      useStore.getState().pushToast(`Opening balance for ${numberText(a.accountNumber)} is not set up yet.`, 'info',
        'Post the starting figure as a journal entry for now.')
    }
  }
  const openDetail = (a: Account) => navigate(`/chart-of-accounts/${a.id}`)
  const onOpen = openDetail


  // First-time users (setup not complete) get the full-page three-path setup
  // view instead of the account list, KPIs, and Add Account controls.
  // Temporarily DEACTIVATED - flip FIRST_TIME_SETUP_ENABLED back to true to
  // restore the three-path onboarding cards.
  if (FIRST_TIME_SETUP_ENABLED && !company.setupComplete) {
    return <FirstTimeSetup company={company} />
  }

  return (
    /* The page is the viewport, and the table is the only thing in it that
       scrolls. Everything above the table - the header, the checklist, the
       insight cards, the toolbar - is fixed chrome, so scrolling the page could
       only ever run the card off the bottom and show blank canvas under it. */
    <div className={cn('flex-1 flex flex-col min-h-0', fullView ? 'pb-0' : 'pb-6')}>
      {!fullView && (
      <PageHeader
        icon={<BookOpen size={16} />}
        title="Chart of Accounts"
        subtitle="The structured list of accounts your business uses to record and organize its finances."
        /* Dimensions is a button of its own, not an item under Actions. It is the
           way to the page the whole dimensional side of the chart is set up on,
           and a third item in a dropdown asked the reader to go looking for it.
           Import and Export stay behind Actions: each is a one-off job that ends
           where it started, where Dimensions leaves for somewhere else. */
        secondaryActions={
          <>
            <Menu trigger={<Button variant="secondary" iconRight={<ChevronDown size={ic14} className="text-fg-subtle/60" />}>Actions</Button>}>
              {(c) => (
                <>
                  <MenuItem icon={<Upload size={ic14} />} onClick={() => { c(); setImportOpen(true) }}>Import</MenuItem>
                  <MenuItem icon={<Download size={ic14} />} onClick={() => { c(); openHeaderExport() }}>Export</MenuItem>
                </>
              )}
            </Menu>
            <Button variant="secondary" icon={<Layers size={ic14} />} onClick={() => navigate('/dimensions')}>Dimensions</Button>
            {/* The last control before Create GL account, as the "i" icon.
                Design review, 2026-10-08 - Eli: *"I think it's the first button
                you see before the primary action."* */}
            <HowItWorksButton place="page" open={guideOpen} onClick={() => setGuideOpen(o => !o)} />
          </>
        }
        primaryAction={<Button icon={<Plus size={ic14} />} onClick={() => { setWrapAcct(null); setCreateDefaults(undefined); setCreateOpen(true) }}>Create GL account</Button>}
      />
      )}


      {guideOpen && createPortal(
        <div className="fixed inset-0 z-50">
          <ReadingRoom open onClose={() => setGuideOpen(false)} config={CHART_READING_ROOM} />
        </div>,
        document.body,
      )}

      {/* No "Finish setting up your modules" card here. Design review, 2026-10-02:
          it named modules this release does not set up from the chart, so it
          promised work nobody could do. Tracking the to-dos an import leaves -
          details a file could not carry - and showing how many are left is
          backlogged at Level 5. Guided setup still records the checklist on the
          company (`moduleSetupChecklist`) for when that lands; nothing shows it. */}

      {/* Performance Insights - Partners-parity KPI row: draggable cards and an
          "Add Insights" drawer. The window comes from the accounting period in
          force, so there is no date lens here to disagree with it. */}
      {!fullView && (
        <div className="px-6 lg:px-8 mt-4">
          <PerformanceInsights
            ctx={{ kpis, accounts }}
            activeKpis={activeKpis}
            setActiveKpis={setActiveKpis}
            onOpenPanel={() => setInsightsPanelOpen(true)}
            onReset={() => setActiveKpis([...DEFAULT_COA_KPIS])}
            lastRefreshed={lastInsightsRefreshed}
            onRefresh={() => setLastInsightsRefreshed(new Date())}
            onOpenAccount={(id) => navigate(`/chart-of-accounts/${id}`)}
          />
        </div>
      )}

      {/* Main panel - takes whatever height the chrome above it left. */}
      <div className={cn('flex-1 min-h-0 flex flex-col', fullView ? 'px-3 mt-3' : 'px-6 lg:px-8 mt-4')}>
        <Card className="overflow-visible flex-1 min-h-0 flex flex-col">
          {!fullView && <PeriodStrip periods={periods} fiscalYearStart={company.fiscalYearStart} hint={PERIOD_HINT} />}
          {/* Toolbar, row 1: search + filters (left) · count + insights + layout + columns (right).
              Its top edge is where a dragged header turns into a hide (tableColumns). */}
          <div data-col-hide-edge className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3.5 pb-2">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
              <div className="relative flex-1 max-w-xs">
                <Search size={ic16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search accounts"
                  className="h-9 w-full pl-9 pr-8 text-sm bg-white rounded-lg border border-border shadow-xs focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-bg-muted text-fg-subtle hover:text-fg">
                    <X size={14} />
                  </button>
                )}
              </div>
              <FiltersButton
                count={countFiltersActive(filters)}
                onOpen={() => setFiltersOpen(true)}
                onClear={() => setFilters(clearPanelFilters(filters))}
                iconSize={ic14}
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {/* Visible rows out of the full set, Partner-style: "100 of 143 accounts". */}
              {/* Count colours match the Partners table: dark shown · faint "of"
                  · muted total · grey label. */}
              <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                <span className="text-fg">{fmtNumber(matches.length)}</span>
                <span className="text-fg-muted/60"> of </span>
                <span className="text-fg-muted">{fmtNumber(totalAccounts)}</span>
                <span className="text-fg-muted/70"> accounts</span>
              </span>
              <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
              {/* Insights - opens the KPI toggle drawer (Partners parity). */}
              <button
                onClick={() => setInsightsPanelOpen(true)}
                className={cn('inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-xs transition-colors text-sm',
                  insightsPanelOpen ? 'border-primary/30 bg-primary/[0.04] text-fg' : 'border-border bg-white text-fg hover:bg-bg-subtle')}
                style={{ fontWeight: 500 }}
              >
                <BarChart3 className="w-[18px] h-[18px] text-muted-foreground/80" />
                <span className="hidden md:inline">Insights</span>
                {/* The cards actually on the shelf, so the badge and the drawer's
                    own counter cannot report two different numbers. */}
                <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-11 font-semibold bg-accent text-primary">{activeCoaKpiDefs(activeKpis, { kpis, accounts }).length}</span>
              </button>
              {/* Expand scope - opens or closes the whole tree. The same menu the
                  General Ledger carries, so the two pages read alike. */}
              {(() => {
                const opts = [
                  { val: 'expanded' as const, label: 'Expand all', Icon: UnfoldVertical,
                    desc: 'Show the accounts under every summary' },
                  { val: 'collapsed' as const, label: 'Collapse all', Icon: FoldVertical,
                    desc: 'Show the five category rows only' },
                ]
                const cur = opts.find(o => o.val === expandMode) ?? opts[0]
                return (
                  <Menu align="right" trigger={
                    <button className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-fg shadow-xs hover:bg-bg-subtle transition-colors text-sm font-medium">
                      <cur.Icon size={ic16} className="text-fg-subtle" />
                      <span className="hidden md:inline">{cur.label}</span>
                      <ChevronDown size={14} className="text-fg-subtle/60" />
                    </button>
                  }>
                    {(close) => (
                      <div className="w-[250px] p-1.5 -my-1">
                        {opts.map(o => {
                          const sel = expandMode === o.val
                          return (
                            <button key={o.val} onClick={() => { setAllExpanded(o.val); close() }}
                              className="w-full flex items-center gap-3 py-2.5 px-3 rounded-md text-left hover:bg-bg-subtle transition-colors">
                              <o.Icon size={20} className="text-fg-subtle shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-fg">{o.label}</div>
                                <div className="text-xs text-fg-muted">{o.desc}</div>
                              </div>
                              {sel && <Check size={14} className="text-primary shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </Menu>
                )
              })()}
              {/* Views menu - defaults + saved lenses + Create view. Hidden for
                  now (may return later); flip `false` to `true` to restore. */}
              {false && (
              <ViewsMenu
                views={allViews}
                activeId={activeViewId}
                accounts={accounts}
                onSelect={(id) => { setTempView(null); setActiveViewId(id); setCollapsedSections(new Set()) }}
                onCreate={openCreateView}
                ic={ic16}
              />
              )}
              {/* The toolbar pair, in this order and 6px apart (spec §1): how the
                  rows are drawn, then which columns are drawn at all. */}
              <div className="flex items-center" style={{ gap: 6 }}>
                <DensityMenu
                  value={look.density}
                  onChange={d => setLook('density', d)}
                  sections={lookSections({
                    tree: { value: look.treeStyle, onChange: v => setLook('treeStyle', v) },
                    // Picking a card clears every hand-dragged width (spec §7).
                    widths: { value: look.columnSizing, onChange: v => setLook('columnSizing', v) },
                  })}
                />
                <button
                  type="button"
                  onClick={() => setColumnsOpen(o => !o)}
                  className="fr-tool-btn"
                  data-active={columnsOpen}
                  aria-expanded={columnsOpen}
                  style={{ ...TOOL_BTN, ...(columnsOpen ? TOOL_BTN_ACTIVE : null) }}
                >
                  <Columns3 style={{ width: 18, height: 18, flexShrink: 0 }} />
                  <span className="hidden md:inline">Columns</span>
                  <span style={COUNT_BADGE}>{Object.values(columns).filter(Boolean).length}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Body row: table area (shrinks) + docked Columns side panel. */}
          {/* Stretched, not `items-start`: the row now has a height of its own, and
              both the table and the docked Columns panel scroll inside it rather
              than growing the page. */}
          <div className="flex items-stretch flex-1 min-h-0">
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {/* Row 2: the bulk-action bar replaces the quick-filter pills when
              rows are selected (same slot), exactly like the Partners table. Not
              gated on the layout: both views select, and the selection survives a
              switch between them, so hiding the bar in one would leave rows
              selected with no way to act on them or clear them. */}
          {selected.size > 0 ? (
          <div className="border-b border-border">
            <BulkActionBar count={selected.size} noun="account" actions={bulkActions} onClear={clearSelection} />
          </div>
          ) : (
          <div className="flex items-center gap-3 px-4 pb-3 border-b border-border">
            <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
              {/* Me mode pill - accounts created by the signed-in user (matches
                  the Partners table's Me mode). Hidden for now, see ME_MODE. */}
              {ME_MODE && (
                <QuickFilterPill
                  label="Me mode"
                  icon={<User className="w-3.5 h-3.5" />}
                  active={meMode}
                  onClick={() => setMeMode(m => !m)}
                />
              )}
              {/* Dimensions stands with Me mode, not with Filters. It is the
                  reader's own way of slicing their own chart, and it edits the
                  same `filters.dimensionValues` the Filters panel used to - one
                  filter set, two ways in. Beside Filters it read as a second
                  filter panel; beside the pills it reads as what it is. */}
              <DimensionsPicker
                filters={filters}
                setFilters={setFilters}
                accounts={accounts}
                iconSize={14}
              />
              <div className="w-px h-5 bg-border shrink-0" />
              <QuickFilterPill label="Show All" active={sortPill === 'all'} onClick={() => setSortPill('all')} />
              {CATEGORY_ORDER.map(code => (
                <QuickFilterPill
                  key={code}
                  label={ACCOUNT_TYPE_META[code].label}
                  active={sortPill === code}
                  onClick={() => setSortPill(code)}
                  count={pillCounts[code]}
                />
              ))}
              {/* Archived rows are the one set the listing hides, so the only way to
                  reach them was the Filters slide-over. This is the way back in, and
                  it sits with the other pills rather than behind a divider: it slices
                  the same chart, it just slices it by what is no longer on it. */}
              <QuickFilterPill
                label="Archived"
                tone="danger"
                active={sortPill === 'archived'}
                onClick={() => setSortPill(p => p === 'archived' ? 'all' : 'archived')}
                count={archivedCount}
              />
            </div>
          </div>
          )}

          {/* Active column-filter chips - appears only once a header filter
              exists, mirroring the Partners table's Active Filters Bar. */}
          <ColumnFiltersBar
            filters={colFilters}
            onChange={setColFilters}
            availableColumns={columnOrder.filter(k => k !== 'name' && (columns as unknown as Record<string, boolean>)[k])}
            labelOf={k => HEADER_DEFS[k].label}
            uniqueValuesOf={k => uniqueColValues(k, accounts)}
            blankFilterOf={blankFilter}
          />

          {/* View tab strip (spec §5.1) - CONTEXTUAL, not persistent. It renders
              only while a view is active; in the default "All accounts" state
              there is no second band of tabs under the quick-filter pills. The
              persistent entry point is the "Views ▾" button in the toolbar, so
              views stay discoverable. Selecting "All accounts" here clears the
              lens, which hides the strip again. Uses the app's flat underline
              tabs (same component style as the Partners table tabs). */}
          {lensActive && (
            <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border bg-white">
              <ViewTabs
                views={allViews}
                activeId={activeViewId}
                tempView={tempView}
                onSelect={(id) => { if (id !== '__temp') setTempView(null); setActiveViewId(id); setCollapsedSections(new Set()) }}
                onCloseTemp={requestClearView}
                onEditTemp={editActiveView}
                onSaveTemp={saveTempView}
              />
              {/* Create View + Clear views on the right. */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Create View - opens the builder; primary button. */}
                <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openCreateView}>Create View</Button>
                {/* Divider + Exit views, mirroring "Clear selection". */}
                <span className="w-px h-5 bg-border mx-0.5" />
                <Tooltip side="bottom" align="right" content="Exit views">
                  <button
                    onClick={requestClearView}
                    className="inline-flex items-center gap-1.5 h-8 px-2 rounded-lg text-[13px] font-medium text-fg-muted hover:text-fg hover:bg-bg-subtle transition-colors"
                  >
                    <X size={14} />
                    <span>Exit views</span>
                  </button>
                </Tooltip>
              </div>
            </div>
          )}

          <SearchRevealNote labels={revealedCols.map(k => HEADER_DEFS[k].label)} />

          {largeQueryWarn && (
            <div className="px-4 py-2 bg-warning-50 border-b border-warning-100 text-warning-700 text-xs flex items-center gap-2">
              <AlertTriangle size={14} />
              Large query: {fmtNumber(matches.length)} accounts match. Narrow filters or search for faster results.
            </div>
          )}

          {/* Table - the chart nests, so it is drawn nested. The columns are the
              same inside and outside a view: a view pins the aggregation bar on
              top and narrows the rows via its lens, it does not restyle them. */}
          <div ref={tableScrollRef} className="flex-1 min-h-0 overflow-auto scrollbar-thin">
            {lensActive && <ViewAggBar view={activeView} rows={matches} onEdit={editActiveView} onRemove={removeActiveView} />}
            <AccountTree accounts={treeRows} query={debouncedQ} density={look.density === 'comfort' ? 'comfortable' : 'condensed'} look={{ className: lookClass, treeStyle: look.treeStyle, columnSizing: look.columnSizing, rowNumbers: look.rowNumbers, pinGroups: look.pinGroups }} onColumnDrag={() => setLook('columnSizing', 'custom')} rememberWidthsAs="coa:widths" columns={shownColumns} order={shownOrder} onOrderChange={setColumnOrder} onAction={onAction} onStatusChange={lifecycle.request} onOpen={onOpen} onAddChild={onAddChild} expanded={expanded} onToggle={toggle} collapsedGroups={collapsedGroups} onToggleGroup={toggleGroup} colFilters={colFilters} onColFiltersChange={setColFilters} onHideColumn={k => { if (!unreveal(k)) setColumns(c => ({ ...c, [k]: false })) }} frozenCols={frozenCols} onToggleFreeze={k => setFrozenCols(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])} bodyScroll={false} selectable selectedIds={selected} onToggleSelect={toggleSelect} onToggleAll={toggleAll} onCreateRow={onCreateRow} directCreate noInlineInsert omitOpeningBalance rowBadge={rowBadge} emptyState={noMatch} />
          </div>
          </div>

          <ColumnSelector
            open={columnsOpen}
            onOpenChange={setColumnsOpen}
            columns={COLUMN_SPECS}
            columnOrder={columnOrder}
            columnVisibility={columns as unknown as Record<string, boolean>}
            lockedColumns={LOCKED_COLUMNS}
            onColumnOrderChange={(o) => setColumnOrder(o as ColKey[])}
            onColumnVisibilityChange={(v) => setColumns(v as unknown as ColumnConfig)}
            frozenColumns={frozenCols}
            onToggleFreeze={k => setFrozenCols(prev => prev.includes(k as ColKey) ? prev.filter(x => x !== k) : [...prev, k as ColKey])}
            canFreeze={k => !LOCKED_COLUMNS.includes(k)}
            visual={{ values: look, offers: { pinGroups: true }, onToggle: toggleVisual }}
            defaults={{ visibility: { ...DEFAULT_COLUMNS, dimensions: chartHasDimensions } as unknown as Record<string, boolean>, order: DEFAULT_COLUMN_ORDER }}
          />
          </div>
        </Card>
      </div>

      {/* Saved Views - builder (create temp view) + save (name & share). */}
      <ViewBuilderModal
        open={builderOpen}
        onClose={() => { setBuilderOpen(false); setBuilderInitial(null); setEditingSavedId(null) }}
        initial={builderInitial}
        onApply={(v) => {
          if (editingSavedId) {
            // Editing a saved view - update it in place and keep it active.
            updateCoaView(editingSavedId, { name: v.name, kind: v.kind, types: v.types, groupBy: v.groupBy, agg: v.agg })
            setTempView(null); setActiveViewId(editingSavedId); setCollapsedSections(new Set())
            useStore.getState().pushToast('View updated', 'success')
          } else {
            setTempView(v); setActiveViewId('__temp'); setCollapsedSections(new Set())
            useStore.getState().pushToast('Temporary view created, save it to share', 'info')
          }
        }}
      />
      {/* Confirm before deleting a saved (shared) view. */}
      <ConfirmModal
        open={!!deleteViewId}
        tone="danger"
        icon={<Trash2 size={26} className="text-danger-600" />}
        badge="Delete view"
        title={`Delete "${allViews.find(v => v.id === deleteViewId)?.name ?? 'this view'}"?`}
        description="This removes the saved view for everyone it was shared with. Your accounts and their data are not affected."
        confirmLabel="Delete view"
        dismissLabel="Cancel"
        onConfirm={() => {
          if (deleteViewId) {
            removeCoaView(deleteViewId)
            if (activeViewId === deleteViewId) setActiveViewId('all')
            useStore.getState().pushToast('View deleted', 'success')
          }
          setDeleteViewId(null)
        }}
        onDismiss={() => setDeleteViewId(null)}
      />
      {/* Confirm before discarding an unsaved temporary view (close or Clear). */}
      <ConfirmModal
        open={discardOpen}
        tone="warning"
        icon={<AlertTriangle size={26} className="text-warning-600" />}
        badge="Discard"
        title="Discard view?"
        description={["This temporary view hasn't been saved yet.", 'Discarding it returns you to All accounts.']}
        confirmLabel="Discard view"
        dismissLabel="Keep editing"
        onConfirm={clearView}
        onDismiss={() => setDiscardOpen(false)}
      />

      <FiltersSlideOver
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        setFilters={setFilters}
        accounts={accounts}
        subsidiaries={company.subsidiaries}
      />
      <KpiInsightsPanel
        open={insightsPanelOpen}
        onOpenChange={setInsightsPanelOpen}
        activeKpis={activeKpis}
        onToggleKpi={toggleKpi}
        onReset={() => setActiveKpis([...DEFAULT_COA_KPIS])}
        ctx={{ kpis, accounts }}
      />
      <CreateAccountSlideOver open={createOpen} onClose={() => setCreateOpen(false)} defaults={createDefaults} />
      {wrapAcct && <MoveUnderSummaryModal account={wrapAcct} onClose={() => setWrapAcct(null)} />}
      {editAcct && <CreateAccountSlideOver open onClose={() => setEditAcct(null)} editAccount={editAcct} bankDetailsOnly={editBankOnly} />}
      {/* Mounted on the request rather than kept open, so the form reads the
          account it was asked for while it is being built. */}
      {jeAccount && <NewJournalEntryModal open onClose={() => setJeAccount(null)} prefillAccountId={jeAccount.id} />}
      {lifecycle.confirmModal}
      {/* On "show me what I just imported": clear everything narrowing the chart,
          then open the tree. An imported account nested three deep under a
          collapsed summary is not shown by arriving at the page it is on. */}
      <ImportAccountsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onViewImported={() => { setFilters(EMPTY_FILTERS); setQuery(''); setSortPill('pending'); setAllExpanded('expanded') }}
      />
      <ExportAccountsModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        accounts={exportRows}
        scope={exportScope}
        columnVisibility={columns as unknown as Record<string, boolean>}
      />
    </div>
  )
}

// Full-page first-time setup view: three peer setup paths shown as equal
// first-class choices, replacing the account list until setup is complete.
//
// Each card says what the path does and who it is for, and nothing else. The
// "recommended for" line is the only one that helps a reader choose, so it carries
// the weight a feature list used to: three bullets per card described the same
// three steps in different words, which is nine lines that could not separate the
// paths from one another.
export const SETUP_PATHS: { method: 'upload' | 'scratch' | 'wizard'; icon: React.ReactNode; title: string; subtitle: string; recommendedFor: string; cta: string }[] = [
  {
    method: 'wizard',
    icon: <Sparkles size={18} />,
    title: 'Guided setup',
    subtitle: 'Answer a few questions and Omne builds it.',
    recommendedFor: 'Recommended for new businesses setting up their first chart.',
    cta: 'Start guided setup',
  },
  {
    method: 'upload',
    icon: <Upload size={18} />,
    title: 'Import from a file',
    subtitle: 'Bring in your chart from a CSV or XLSX.',
    recommendedFor: 'Recommended for businesses switching from another system.',
    cta: 'Upload file',
  },
  {
    method: 'scratch',
    icon: <Pencil size={18} />,
    title: 'Build from scratch',
    subtitle: 'Start empty and add each account yourself.',
    recommendedFor: 'Recommended for businesses wanting full control.',
    cta: 'Start building',
  },
]

// The lede under the heading. The second sentence is the one that lets a reader
// commit to a path without deliberating over it, so it is said before the choice
// rather than discovered after it. It names the accounts, not everything: the
// step before this one told the same reader their fiscal year settings lock.
// Exported so a test can pin it.
export const SETUP_PATH_LEDE = 'Pick how you want to create your chart of accounts. You can add, rename, and reorganize accounts anytime.'

const LANDING_STEPS = ['Fiscal year', 'Choose setup']

/* The reassuring half of what the lock means, said before the fields rather than
   after the lock bites: migrants arrive from ledgers where the fiscal year is a
   free setting. The surprising half is the page's own subtitle now, so this says
   only what stays possible.

   It used to name where, on the grounds that "anytime" on its own is a promise
   with nowhere to keep it. The where was the chart's Actions menu, and that entry
   is gone, so the directions went with it rather than being softened into a
   vaguer pointer at the same missing thing. Give the page an entry point again
   and this is the line that should name it. */
export const FISCAL_SETUP_BANNER = [
  'You can add earlier years anytime.',
]

function FirstTimeSetup({ company }: { company: CompanyConfig }) {
  const navigate = useNavigate()
  const setCompany = useStore(s => s.setCompany)
  const pushToast = useStore(s => s.pushToast)
  // Landing flow: 0 = fiscal year, 1 = choose a setup path. Account numbering is
  // not a step here: the paths that invent numbers ask for the scheme themselves,
  // and an import brings its own numbers, so it never asks.
  const [landingStep, setLandingStep] = useState(0)
  // The furthest step reached, so Choose setup stays open after going back.
  const [landingFurthest, setLandingFurthest] = useState(0)
  useEffect(() => { setLandingFurthest(f => Math.max(f, landingStep)) }, [landingStep])
  // The picker writes the year and its periods to the store as it is edited; this
  // only holds it to gate Continue.
  const [fiscalYear, setFiscalYear] = useState<string | null>(null)
  // First-time "Upload your chart of accounts" reuses the exact 4-step Actions
  // import flow (Upload → Review & Fix → Importing → Complete).
  const [uploadOpen, setUploadOpen] = useState(false)
  // Build-from-scratch opens as a modal over the landing (no route navigation).
  const [buildOpen, setBuildOpen] = useState(false)
  // Guided setup opens as a full-page overlay over the landing, same pattern.
  const [wizardOpen, setWizardOpen] = useState(false)

  return (
    <div className="px-6 py-6 md:py-8 lg:px-16">
      <div className={`mx-auto ${landingStep === 1 ? 'max-w-6xl' : 'max-w-4xl'}`}>
        {/* Step indicator - shared Partners-style stepper (circular badge +
            label + 2px underline), backward-clickable to completed steps. */}
        <div className="mb-6 flex justify-center">
          <StepTabs
            steps={LANDING_STEPS}
            current={landingStep}
            maxStep={Math.max(landingFurthest, landingStep)}
            /* Back always; forward to a step already reached, while the fiscal
               year it needs is still set - the gate its Continue keeps. */
            onJump={i => { if (i < landingStep || (i <= landingFurthest && fiscalYear)) setLandingStep(i) }}
          />
        </div>

        <div key={landingStep} className="animate-step-in">
        {/* Step 0 - fiscal year */}
        {landingStep === 0 && (
          <>
            <div className="text-center mb-6">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-fg">Set up your chart of accounts</h1>
              <p className="text-sm text-fg-muted mt-1.5 max-w-xl mx-auto">Fiscal year start month and first fiscal year lock once you post your first transaction.</p>
            </div>
            {/* The banner's own icon is the trigger for the full list of what
                freezes, so the three settings are one hover from the sentence
                that mentions them rather than a fourth line of prose. */}
            {/* As wide as the heading above and the card below, so its edges line
                up with theirs; it was 2xl and sat inset from both. */}
            <Banner
              tone="info"
              className="mb-6"
              icon={<FiscalYearLockInfo size={16} className="text-info-600 hover:text-info-700" />}
            >
              {FISCAL_SETUP_BANNER.map(line => <p key={line}>{line}</p>)}
            </Banner>
            <div className="mb-6">
              <FiscalYearPicker value={fiscalYear} onChange={setFiscalYear} />
            </div>
            <div className="flex justify-end">
              <Button disabled={!fiscalYear} iconRight={<ChevronRight size={16} />} onClick={() => setLandingStep(1)}>Continue</Button>
            </div>
          </>
        )}

        {/* Step 1 - choose a setup path */}
        {landingStep === 1 && (
          <>
            <div className="text-center mb-6">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-fg">Choose how to begin</h1>
              <p className="text-sm text-fg-muted mt-1.5 max-w-md mx-auto">{SETUP_PATH_LEDE}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 items-stretch">
              {SETUP_PATHS.map(p => (
                <div
                  key={p.method}
                  className="group relative flex flex-col text-left border border-border rounded-xl p-5 bg-white transition-all duration-150 hover:border-primary/40 hover:shadow-[0_2px_12px_-3px_rgba(10,119,255,0.18),0_1px_3px_rgba(0,0,0,0.04)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-primary to-[#0A5FCC] text-white shadow-sm transition-transform duration-150 group-hover:scale-105">{p.icon}</div>
                    <div className="min-w-0">
                      <h3 className="text-[15px] text-fg leading-snug" style={{ fontWeight: 600 }}>{p.title}</h3>
                      <p className="text-xs text-fg-muted mt-0.5 leading-relaxed">{p.subtitle}</p>
                    </div>
                  </div>
                  {/* Ruled off from the subtitle above it: one describes the path,
                      this one recommends it, and running them together as two
                      paragraphs would read as one longer description. */}
                  <p className="mt-4 mb-5 pt-3.5 border-t border-border-subtle text-[13px] text-fg-muted leading-relaxed">
                    {p.recommendedFor}
                  </p>
                  <Button
                    className="mt-auto w-full justify-center"
                    iconRight={<ChevronRight size={16} />}
                    onClick={() => p.method === 'upload' ? setUploadOpen(true) : p.method === 'wizard' ? setWizardOpen(true) : setBuildOpen(true)}
                  >
                    {p.cta}
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-center mt-6">
              <Button variant="ghost" onClick={() => setLandingStep(0)}>Back</Button>
            </div>
          </>
        )}
        </div>
      </div>

      {/* Reuse the Actions import flow for first-time upload; finishing marks
          setup complete and drops the user into the populated Chart of Accounts. */}
      <ImportAccountsModal
        open={uploadOpen}
        firstTime
        onClose={() => setUploadOpen(false)}
        onViewImported={() => {
          setCompany({ setupComplete: true })
          pushToast('Your chart of accounts is ready.', 'success', 'Imported accounts are now in your Chart of Accounts.')
          navigate('/chart-of-accounts')
        }}
      />

      {/* Build-from-scratch renders as a stepper modal over the landing, with
          full view a click away in its header. Cancel/close returns to the
          "Choose setup" step (landing stays mounted at step 1 behind it).
          Publishing flips setupComplete, which unmounts this whole first-time
          view. */}
      {buildOpen && <GuidedWizard mode="scratch" presentation="modal" onClose={() => setBuildOpen(false)} />}

      {/* Guided setup renders as a stepper modal over the landing. It commits
          accounts on "Publish chart" but holds setupComplete until the modules
          screen finishes, so the modal survives the publish. */}
      {wizardOpen && <GuidedSetupWizard onClose={() => setWizardOpen(false)} />}
    </div>
  )
}
