import { cloneElement, createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ElementType, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { Link, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Sector, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronRight, Pencil, ChevronDown, AlertTriangle, TrendingUp, TrendingDown, Wallet, Activity, ArrowRight, ArrowUpRight, Building2, MapPin, Tag, BadgeCheck, Merge, Calendar, Lock, FileText, ExternalLink, Settings2, Sparkles, RefreshCw, Check, GripVertical, BarChart3, BookOpen, Search, X, Columns3, Plus, Info, Copy, ArrowUp, ArrowDown, ArrowUpDown, Star, ListFilter, PieChart as PieChartIcon, UnfoldVertical, FoldVertical, RotateCcw, MousePointerClick, MessageSquare } from 'lucide-react'
import { useStore, usePeriodScopedAccounts, usePeriodScopedChart, useAccountNumberText, useSelectedPeriod } from '../store'
import { isRetainedEarnings, isRetainedEarningsAdjustments, showsSummaryTotal, type LifecycleAction, isReadOnlyAccount, ARCHIVED_READ_ONLY } from '../lib/accountLifecycle'
import { PRIOR_PERIOD_EXCEPTION_LINE, RETAINED_EARNINGS_ADJUSTMENTS_LINE, RETAINED_EARNINGS_LOCK_LINE, retainedEarningsAdjustmentsOf, retainedEarningsRedirectLine } from '../lib/journalEntry'
import { GuideSheet } from '../components/GuideSheet'
import { RETAINED_EARNINGS_GUIDE, SYSTEM_ACCOUNTS_GUIDE } from '../lib/journalGuides'
import { classificationTrail, type ChartIndex } from '../lib/chartTree'
import { auditFieldLabel } from '../lib/auditFieldLabels'
import { accountRange, formatRange } from '../lib/numberRange'
import { INTERNAL_ID_HELP } from '../lib/internalId'
import { InternalIdField } from '../components/InternalIdField'
import { useColumnDragReorder, DragGhost, draggedHeaderStyle, DragBar } from '../components/tableColumns'
import { isInSelection } from '../lib/periodSelection'
import { sourceDocLabel, sourceDocName } from '../lib/seed'
import { reconstructEntry, type ReconstructedEntry } from '../lib/journalEntry'
import { NormalBalanceHelp } from '../lib/normalBalanceCopy'
import { ACCOUNT_TYPE_META, AccountType, Transaction, Account, AccountRole, CLASSIFICATION_DESCRIPTIONS, isCategoryRoot, CONTROL_ACCOUNT_LOCK_LINE, isControlAccountRole, type Period, numberProtectionOn } from '../types'
import { cn, fmtCurrency, fmtCurrencyExact, fmtDate, fmtNumber, relativeTime, todayIso, withinMagnitude } from '../lib/utils'
import { Badge, Button, Card, CardHeader, Menu, Banner, Select, Modal, FormModal, ConfirmModal, Marked, EmptyState, Tooltip as UITooltip } from '../components/ui'
import { DetailHeaderCard, detailContainerCls } from '../components/DetailHeaderCard'
import { DashInfoCard, DashInfoLabel } from '../components/DashInfoCard'
import { ChartWidgetCard, ChartBox, ChartLegendDot, CHART_TT_STYLE, PIE_COLORS } from '../components/ChartWidgetCard'
import { ActivityFeed, ActivityFeedItem, ActivityFeedItemType } from '../components/ActivityFeed'
import { PlaceholderTab } from '../components/PlaceholderTab'
import { NotesTab, useRecordNotes } from '../components/NotesTab'
import { accountNotes, noteKey } from '../lib/notes'
import { CommsTab, useCommsCount } from '../components/CommsTab'
import { createdHere } from '../lib/comms'
import { AttachmentsTab, type AttachmentFile } from '../components/AttachmentsTab'
import { bookedFromBase, currencyMeta, ownBalanceOf, currentOwnBalanceOf, ownSide, typedCorrection, typedIn } from '../lib/currencies'
import { CurrencyFlag } from '../components/CurrencyFlag'
import { withCode } from '../components/FxCard'
import { earningsPostings, isCurrentYearEarnings } from '../lib/currentYearEarnings'
import { monthlyBalancesThrough, runningBalanceLedger, normalSideDelta, comparePostingOrder } from '../lib/monthlyLedger'
import { balanceStruckLabel } from '../lib/balanceStruckCopy'
import { PeriodStrip, ACCOUNT_PERIOD_HINT } from '../components/PeriodStrip'
import { GL_TYPE_DESCRIPTION, GLTypeLegend } from '../lib/glAccountTypeCopy'
import { FDivider, Section, RangeMinMax, QuickFilterPill, DateRangeFromTo, SearchableDropdownSelect, orderPeriodsRecentFirst, FiltersButton, FiltersSlideOver, EMPTY_FILTERS, countFiltersActive, applyFilters, clearPanelFilters, carriesPeriodFigures, offTheListing, type FilterState } from '../components/Filters'
import { InsightsPanel, type InsightsPanelItem, KpiStatCard, KPI_CARD_RESTING, KPI_CARD_OVER } from '../components/CoaInsights'
import { useAccountLifecycle } from './AccountActions'
import { CreateAccountSlideOver } from './CreateAccount'
import { AccountDimensionsModal } from '../components/AccountDimensionsModal'
import { defaultValueOf, missingDefaults, valuesByDimension } from '../lib/dimensionDefaults'
import { MoveUnderSummaryModal } from '../components/MoveUnderSummaryModal'
import { NewJournalEntryModal } from '../components/NewJournalEntryModal'
import { AdjustmentAccountModal } from '../components/AdjustmentAccountModal'
import { StatusChip, StatusMenu, HeaderMenu, AccountActionItems, filterActive, ColumnFiltersBar, FxPostingTooltip, FxBalanceTooltip, CurrencyHeldCard, BookedBaseTooltip, BookedMarker, CurrencyCell, avatarTint, chartRowValues, ColFilter, ColFilterType, GL_TYPE_TONE, CategoryCell, DimensionPills, AccountTree, isLockedCol, DEFAULT_COLUMNS, DEFAULT_COLUMN_ORDER, useTreeExpansion, withAncestorContext, matchesColFilters, uniqueColValues, blankFilter, HEADER_DEFS, besidePrefill, RESTRICTED_HELP, type ColumnConfig, type ColKey, type ColFilters, type CreateRowPrefill } from '../components/AccountTable'
import { describePicked } from '../components/NotifyRecipientsPicker'
import { ACCOUNT_OWNER_ACCESS, DEFAULT_RESTRICTED_ACCESS } from '../lib/restrictedAccess'
import { ColumnSelector } from '../components/ColumnSelector'
import { DensityMenu } from '../components/DensityMenu'
import { COUNT_BADGE, TOOL_BTN, TOOL_BTN_ACTIVE, lookSections, useCrosshair, useTableLook } from '../components/tableLook'
import { LinkedDocLink } from '../components/LinkedDoc'
import { JournalEntryQuickView } from '../components/JournalEntryQuickView'
import { useBlockWindow } from '../components/useBlockWindow'
import { BLOCK_SIZE } from '../lib/blockWindow'
import {
  PeriodSelector, resolvePeriod, describePeriod, readStored, PRESET_MONTHS,
  DEFAULT_PERIOD, toIsoDay, WidgetContentCard, DraggableKpiCard, DraggableWidgetCard,
  WidgetPeriodHeader, WidgetStatRow, DetailInsightsPanel, CHART_PALETTE,
  useWidgetSize, useWidgetChartH, useWidgetPie, widgetBarSize,
  type PeriodValue, type WidgetSize, type DetailWidgetDef, type DetailKpiDef,
} from '../components/DetailInsights'
import { useRememberedState } from '../lib/rememberedState'
import { hiddenSearchHits, searchHits, type SearchContext } from '../lib/accountSearch'
import { SearchRevealNote, orderWithRevealed, useSearchReveal } from '../components/SearchReveal'
import { searchMatcher } from '../lib/tableSearch'

// The detail page a GL account type maps to (spec: gl-account-detail-pages.md).
// A page matches what the account can do: a Posting holds transactions of its
// own, a Summary shows the total of the accounts under it. Every account has a
// page - there is no type left that only labels.
type DetailTemplate = 'transaction' | 'rollup'
const templateOf = (a: Account): DetailTemplate =>
  a.glAccountType === 'Posting' ? 'transaction' : 'rollup'

// Where the account sits, said in one pill: the summary account directly above
// it. That is the narrowest true statement about the account, and it implies the
// rest - Cash and Cash Equivalents is already a current asset. The wider chain is
// still one click away through the parent link below.
//
// Read from the parent chain, so it costs nothing to store and cannot disagree
// with where the row sits on the chart. An account with no parent has nothing
// narrower to say, so it falls back to its category.
function ClassificationBadge({ account, index }: { account: Account; index: ChartIndex }) {
  const meta = ACCOUNT_TYPE_META[account.accountType]
  const trail = classificationTrail(index, account.id)
  const parent = trail[trail.length - 1]
  return <Badge tone={meta.color}>{parent ? parent.accountName : meta.label}</Badge>
}

/* A posting account's balance, on the right of the header. Mahad, 2026-11-14:
   *"Account detail page, header: show the account's currency, and the balance
   in both the foreign and the base currency."* As it stands today, whatever
   period the page is scoped to - the figure the chart's Running balance and
   Foreign balance read. An account held in another currency leads with its own
   amount, as typed where it was typed, with the base value the ledger carries
   under it, and hovering either opens the chart's balance card. An account in
   the base currency has the one figure. On scroll it keeps the headline alone,
   as the header keeps the title alone. */
function HeaderBalance({ account, base, compact }: { account: Account; base: string; compact: boolean }) {
  const booked = account.currentBalance ?? account.balance
  const code = account.currencyCode
  const nonBase = code !== base
  const own = currentOwnBalanceOf(account)
  const headline = (
    <span
      className={cn('text-foreground tabular-nums whitespace-nowrap transition-all duration-250', nonBase && 'underline decoration-dotted decoration-[#CBD5E1] underline-offset-2')}
      style={{ fontSize: compact ? 13 : 14, fontWeight: 600, lineHeight: '18px' }}
    >
      {withCode(fmtCurrencyExact(nonBase ? own : booked, nonBase ? code : base), nonBase ? code : base)}
    </span>
  )
  return (
    <div data-header-balance>
      {!compact && (
        <div className="flex justify-end leading-[12px]">
          <DashInfoLabel align="right" tooltip="The account's balance as it stands today, whatever period is picked on the page.">Balance</DashInfoLabel>
        </div>
      )}
      {/* A flex row rather than a line of text, so the card's inline trigger
          adds no line box and the block stays the back button's height. */}
      <div className="flex justify-end">
        {nonBase ? (
          <FxBalanceTooltip code={code} base={base} booked={booked} own={own}>
            <span className="cursor-help flex flex-col items-end">
              {headline}
              {!compact && <span className="text-[11px] leading-[14px] text-slate-500 tabular-nums whitespace-nowrap">{withCode(fmtCurrencyExact(booked, base), base)} · base currency</span>}
            </span>
          </FxBalanceTooltip>
        ) : headline}
      </div>
    </div>
  )
}

// The one account this one sits directly under, as it is written everywhere else
// a parent is named: number, then name. A link, because a summary account has a
// page of its own to go to.
function ParentField({ account, index, className }: { account: Account; index: ChartIndex; className?: string }) {
  const parent = index.parentOf(account.id)
  const numberText = useAccountNumberText()
  return (
    <div className={cn('min-w-0', className)}>
      <DashInfoLabel tooltip="The account this one is nested under. It determines the account's position in the chart, and this account's balance is included in the parent's total.">Parent</DashInfoLabel>
      {parent ? (
        <Link
          to={`/chart-of-accounts/${parent.id}`}
          className="text-[12px] text-primary hover:underline truncate block mt-0.5"
          style={{ fontWeight: 500 }}
          title={`${parent.accountNumber} · ${parent.accountName}`}
        >
          <span className="tabular-nums">{numberText(parent.accountNumber)}</span> · {parent.accountName}
        </Link>
      ) : (
        <p className="text-[12px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Top level</p>
      )}
    </div>
  )
}

/* Where this account came from, and the number it came with.

   Renders on every account, including the ones that answer No. A yes/no that
   only appears when the answer is yes is not a yes/no: a reader finding nothing
   here could not tell an account that was typed in from one whose provenance the
   page simply failed to state.

   The number underneath is what makes the field worth its space. A dimensional
   import collapses 01-71100-40 into 71100, and someone who has typed the long one
   for years needs this page to confirm it is the same account. */
/* Whether the account is restricted: set on Create GL account, shown on the chart
   and here, with what it means on hover (COA discussion, 2026-10-06). */
function RestrictedField({ account, className }: { account: Account; className?: string }) {
  const restrictedDefault = useStore(st => st.company.restrictedAccessDefault) ?? DEFAULT_RESTRICTED_ACCESS
  return (
    <div className={cn('min-w-0', className)} data-restricted-field>
      <DashInfoLabel tooltip={RESTRICTED_HELP}>Restricted</DashInfoLabel>
      <div className="mt-0.5">
        {account.restricted ? <Badge tone="warning">Yes</Badge> : <Badge tone="neutral">No</Badge>}
      </div>
      {/* Who it is open to: the account owner always, then the account's own
          list, or the company default where it has none (design review,
          2026-10-08; lib/restrictedAccess). */}
      {account.restricted && (
        <p className="mt-1 text-[12px] text-fg-muted leading-snug" data-restricted-access-list>
          Open to {[ACCOUNT_OWNER_ACCESS.name, ...describePicked(account.restrictedAccess?.length ? account.restrictedAccess : restrictedDefault)].join(', ')}
        </p>
      )}
    </div>
  )
}

function ProvenanceField({ account, className }: { account: Account; className?: string }) {
  const code = account.originalCode
  return (
    <div className={cn('min-w-0', className)}>
      <DashInfoLabel tooltip="Whether this account came into the chart through a file import, rather than being added here. The prior account number it came in with is kept unchanged when the account is renumbered, and searching for it finds this account.">Imported</DashInfoLabel>
      <p className="text-[12px] text-slate-700 mt-0.5" style={{ fontWeight: 500 }}>{account.arrivedByImport ? 'Yes' : 'No'}</p>
      {account.arrivedByImport && code && (
        <>
          {/* The listing's own column name, not a phrase of this page's own.
              Mahad: *"arrived as should be renamed to prior account number"* -
              a reader who turned the column on and then opened the account has
              to be able to see they are reading the same fact twice. */}
          <p className="text-[11px] text-slate-400 mt-1.5">Prior account number</p>
          <div className="mt-1">
            <span className="inline-flex items-center rounded border border-border bg-bg-subtle/60 px-1.5 py-0.5 text-[11.5px] text-slate-700 tabular-nums" style={{ fontWeight: 500 }}>{code}</span>
          </div>
        </>
      )}
    </div>
  )
}

/* The ID the system knows the account by. In the rail's bottom block, beside
   who made the account and when, because it is the same kind of fact: issued by
   the system, never typed, and read only when someone needs to trace the
   account. Eli, 2026-09-24: *"put it at the bottom in a bottom card, something
   out of the way. I don't care, but it's there. It's findable."*

   Copyable, since the reason to read it is to quote it somewhere else. */
/* The dimension values this account carries, the default marked where a
   dimension holds more than one - the value its postings take - and the one place on the page
   where the account is edited in place rather than through the create form.

   Defaults belong on the detail page because that is where you are when you find
   out you need one: reading the account's entries, noticing every one of them is
   being tagged by hand. Sending that reader back through the edit form to change
   one dropdown - past the number, the name, the classification, all of which are
   fine - is the long way round to a small change.

   Creating the dimension itself is offered here for the same reason. What you
   notice reading an account is not usually "this should be East", it is "these
   should be split by region", and the dimension does not exist yet. */
function DefaultDimensionsCard({ account }: { account: Account }) {
  const dimensions = useStore(s => s.dimensions)
  const updateAccount = useStore(s => s.updateAccount)
  const [editing, setEditing] = useState(false)

  const set = account.defaultDimensionValues
  const nameOf = (id: string) => dimensions.find(d => d.id === id)?.name ?? id
  // Read live from the account, so archiving or unarchiving it on this page
  // takes effect at once, not on the next load.
  const readOnly = isReadOnlyAccount(account)

  // One row per dimension, its values together, the default marked where there is a choice.
  const byDimension = [...valuesByDimension(set)]
  const open = () => setEditing(true)
  const save = (values: Account['defaultDimensionValues']) => {
    updateAccount(account.id, { defaultDimensionValues: values }, 'Changed the account\u2019s dimensions')
    setEditing(false)
  }

  return (
    <>
      {/* Named for what it holds. That these are what a posting starts with is
          the editor's own column, and the rail said it twice. */}
      <DashInfoCard title="Dimensions" icon={ListFilter} count={byDimension.length || undefined}>
        {/* The dimensions this account has, and nothing else. The line that used
            to close the list ("Postings start with these. Every entry can change
            them.") explained the feature to a reader who had already found it. */}
        {set.length ? (
          <div className="space-y-2.5">
            {byDimension.map(([id, values]) => {
              const def = values.length > 1 ? defaultValueOf(set, id) : null
              return (
                <div key={id} className="min-w-0" data-dimension-row={nameOf(id)}>
                  <DashInfoLabel tooltip={values.length > 1 ? 'A journal line on this account takes the default value.' : undefined}>{nameOf(id)}</DashInfoLabel>
                  <p className="text-[12px] text-slate-700 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5" style={{ fontWeight: 500 }}>
                    {values.map((v, i) => (
                      <span key={v} className="inline-flex items-center gap-1">
                        {v}
                        {v === def && <span className="text-[10px] text-primary bg-primary/10 rounded px-1 leading-4" style={{ fontWeight: 600 }}>Default</span>}
                        {i < values.length - 1 && <span className="text-slate-400 -ml-1">,</span>}
                      </span>
                    ))}
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          /* An empty state, not a sentence about the emptiness. The rail is why
             `EmptyState` has a small size at all - it used to be built for the
             width of a table and nothing else. No `action`: the card's Add
             dimension button sits below in both states. */
          <EmptyState size="sm" icon={<ListFilter size={15} />} title="No dimensions" />
        )}
        {readOnly ? (
          <p className={cn('mt-2.5 text-[11px] text-fg-subtle', !set.length && 'text-center')} data-dimensions-read-only>{ARCHIVED_READ_ONLY}</p>
        ) : (
        <div className={cn('mt-2.5', !set.length && 'text-center')}>
          <button
            type="button"
            onClick={open}
            className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline"
            style={{ fontWeight: 600 }}
          >
            {/* One label in both states: "Edit" and "Set" were two names for
                opening the same table of every dimension. */}
            <Plus size={11} className="shrink-0" />
            Add dimension
          </button>
        </div>
        )}
      </DashInfoCard>

      {/* The rail is too narrow for the three-column editor, and the editor is
          the thing that reads well - so the card states the answers and the
          modal is where they are given. Same editor the create form uses, so a
          default set here and one set at creation are set the same way. */}
      <AccountDimensionsModal
        open={editing && !readOnly}
        account={account}
        value={account.defaultDimensionValues}
        onClose={() => setEditing(false)}
        onSave={save}
        allowNewDimension
      />
    </>
  )
}

/* The tabs, by what the account is, then the four every record carries.

   A summary produces a figure (Overview) out of the accounts under it
   (Accounts). A posting account has its own figures (Dashboard), the postings
   behind them (Transactions) and the records pointing at it (Where used).

   Then Notes, Attachments, Communication and Activity, on both, last and in
   that order. Eli, 2026-09-24: *"Every detailed view of every object should have
   notes, activity, attachments and communications ... they're always there and
   they're always at the end."* Activity is called Activity on both; the posting
   page used to say "Recent activity" for the same timeline.

   Exported so the two sets can be read without mounting the page, which needs a
   router, a store and a chart index to say anything. */
export const RECORD_TABS = ['notes', 'attachments', 'comms', 'activity'] as const

export function detailTabs(template: 'rollup' | 'transaction', commsCount: number, attachmentCount = 0, noteCount = 0) {
  const record = [
    { id: 'notes', label: 'Notes', count: noteCount },
    { id: 'attachments', label: 'Attachments', count: attachmentCount },
    // What was said about the account, kept against the account. Every reclass
    // gets questioned somewhere, and today that somewhere is a thread nobody
    // reading the chart can see.
    { id: 'comms', label: 'Communications', count: commsCount },
    // The change history behind the account itself - the same timeline on both.
    { id: 'activity', label: 'Activity' },
  ]
  if (template === 'rollup') {
    return [
      { id: 'overview', label: 'Overview' },
      { id: 'accounts', label: 'Accounts' },
      ...record,
    ]
  }
  return [
    { id: 'overview', label: 'Dashboard' },
    { id: 'register', label: 'Transactions' },
    /* Placeholder for the Where used view: the records configured to post here
       and the documents holding it down. Only posting accounts get it; nothing
       is ever configured to post to a summary, so the tab would answer nothing
       on one. */
    { id: 'source', label: 'Where used' },
    ...record,
  ]
}

type DetailTab = 'overview' | 'accounts' | 'register' | 'source' | (typeof RECORD_TABS)[number]

/* Which tabs open in full view. Eli, 2026-09-24, on the summary's Accounts tab:
   *"whenever you're doing something like this that has a lot of columns in a
   table, you're going to want to use up as much of a screen as you can ...
   deciding whether a UI should be default expanded or not is something that we
   should decide for the user."* Transactions opened collapsed at first - Eli, the
   same day: *"this is not a very big table"* - until it grew the ledger's
   columns, and Mahad, 2026-09-30, asked for it to open like Accounts: *"Similar
   to the accounts tab in summery accounts detail page, please make sure when the
   transaction tab is clicked in the posting accounts details page it gets
   expanded."*

   So the page decides per tab, but only until the reader decides. Design
   review, 2026-09-30 - Eli: *"If I've manually expanded, then it should stay
   expanded for all of the tabs. And if I've manually contracted, it should be
   contracted ... This is the only one, the default state of opening it."* One
   choice, then, for every tab, kept for the session. */
export const OPENS_IN_FULL_VIEW: Partial<Record<DetailTab, boolean>> = { accounts: true, register: true }

export default function AccountDetailPage() {
  const { id } = useParams()
  const numberText = useAccountNumberText()
  const navigate = useNavigate()
  const store = useStore()
  const scopedAccounts = usePeriodScopedAccounts()
  // The page reads the account's whole parent chain, not just the account, so it
  // can state the full classification and name the parent.
  const chartIndex = usePeriodScopedChart()
  const account = scopedAccounts.find(a => a.id === id)
  const [tab, setTab] = useState<DetailTab>('overview')
  /* The date range the Transactions tab opens on when a widget hands it one -
     the Posting activity bar a reader asked to see in full. Cleared whenever the
     reader picks a tab themselves, so the tab otherwise opens on its own default. */
  const [registerRange, setRegisterRange] = useState<PeriodValue | null>(null)
  const openRegister = useCallback((range: PeriodValue) => { setRegisterRange(range); setTab('register') }, [])
  const [editOpen, setEditOpen] = useState(false)
  const [addChildOpen, setAddChildOpen] = useState(false)
  /* "Create account above" and "below": what the create form opens on, a
     sibling of this account numbered in the gap on that side. The row's menu on
     the listing offers the same pair, so the page does too. */
  const [besideDefaults, setBesideDefaults] = useState<CreateRowPrefill | null>(null)
  const protection = useStore(s => numberProtectionOn(s.company))
  // Building a summary in this posting account's place and moving it underneath.
  // A summary has no use for it - it is already one - so only the Actions menu
  // on a posting account offers it.
  const [wrapOpen, setWrapOpen] = useState(false)
  const [jeOpen, setJeOpen] = useState(false)
  // What the reader chose, once they have, over OPENS_IN_FULL_VIEW's default.
  const [fullViewChoice, setFullViewChoice] = useRememberedState<boolean | null>('accountDetail.fullView', null)
  const fullscreen = fullViewChoice ?? OPENS_IN_FULL_VIEW[tab] ?? false
  const setFullscreen = (next: (v: boolean) => boolean) => setFullViewChoice(next(fullscreen))
  const lifecycle = useAccountLifecycle()

  /* The listing's row menu hands its picks to the page it sits on; here the page
     is this one, so the same picks land here. Opening balance is not built yet
     and says so, rather than being a menu item that swallows the click.

     The lifecycle picks go out through the same `useAccountLifecycle` the listing
     uses, so they meet the same plans and the same confirmations - one set of
     rules, asked from two places. A delete leaves nothing to come back to, so it
     returns to the chart. */
  const onMenuAction = (action: string, a: Account) => {
    if (action === 'edit') setEditOpen(true)
    else if (action === 'journalEntry') setJeOpen(true)
    else if (action === 'openingBalance') {
      useStore.getState().pushToast(`Opening balance for ${numberText(a.accountNumber)} is not set up yet.`, 'info',
        'Post the starting figure as a journal entry for now.')
    } else if (action === 'delete') lifecycle.request('delete', a, () => navigate('/chart-of-accounts'))
    else lifecycle.request(action as LifecycleAction, a)
  }

  // A posting account's request for a child can only mean a summary above it, so
  // the two flows differ by which dialog opens, not by which item is offered.
  const onAddChild = (a: Account) => {
    if (a.glAccountType === 'Posting') setWrapOpen(true)
    else setAddChildOpen(true)
  }

  /* Read before the not-found return, because the thread is a hook and an account
     that arrives a render late must not reorder them. Nothing is seeded against an
     empty id, so a missing account simply has no thread. */
  const commsSubject = {
    subjectId: account?.id ?? '',
    kind: 'account' as const,
    label: account ? `${account.accountNumber} ${account.accountName}` : '',
    anchorIso: account?.createdAt ?? '',
    fresh: createdHere(account?.createdBy),
  }
  // Messages, not threads. A record with one thread of nine messages has had
  // nine things said about it, and the badge is answering "how much is here".
  const commsCount = useCommsCount(commsSubject)
  const attachmentCount = useStore(s => (account ? s.accountAttachments[account.id]?.length : 0) ?? 0)
  // The notes the account opens with, read by its tab and its tab's count alike.
  const derivedNotes = useMemo(() => accountNotes(account), [account?.id, account?.accountName, account?.accountType, account?.glAccountType, account?.arrivedByImport, account?.createdAt, account?.createdBy]) // eslint-disable-line react-hooks/exhaustive-deps
  const noteCount = useRecordNotes(noteKey('account', account?.id ?? ''), derivedNotes).length

  // Different templates expose different tabs, so reset to Overview whenever the
  // account changes - otherwise a tab valid for the previous account (e.g. a
  // posting's "Transactions") would leave a rollup/stub page blank.
  useEffect(() => { setTab('overview') }, [id])

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <Wallet className="w-10 h-10 opacity-30" />
        <p className="text-[14px]" style={{ fontWeight: 500 }}>Account not found</p>
        <Button variant="secondary" size="sm" onClick={() => navigate('/chart-of-accounts')}>Back to Chart of Accounts</Button>
      </div>
    )
  }

  // Which of the three page templates this account maps to (see templateOf).
  const template = templateOf(account)
  const typeLine = GL_TYPE_DESCRIPTION[account.glAccountType]
  /* Current Year Earnings is moved by every revenue and expense posting as well
     as its own, so those are its activity (lib/currentYearEarnings). */
  const transactions = useMemo(
    () => isCurrentYearEarnings(account)
      ? earningsPostings(account, store.accounts, store.transactions)
      : store.transactions.filter(t => t.accountId === account.id),
    [store.transactions, store.accounts, account])
  const audit = useMemo(() => store.auditLog.filter(a => a.accountId === account.id), [store.auditLog, account.id])

  /* A table tab's card reaches the bottom of the window however few rows it
     holds, as the Partners listing's does, so the Columns panel docked in it
     opens at full height instead of being cut off under a short table (Mahad,
     2026-10-09). The page still scrolls once the rows outgrow the window. */
  const fillsWindow = tab === 'register' || tab === 'accounts'

  return (
    <div className={cn('flex-1 flex flex-col', fillsWindow ? 'pb-1' : 'pb-12')}>
      {/* Sticky morphing header - full-bleed wrapper with its own centered
          container (CM parity). Its `detailContainerCls` matches the body
          below exactly so the card and content stay pixel-aligned. */}
      <DetailHeaderCard
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen(v => !v)}
          onBack={() => navigate('/chart-of-accounts')}
          backTitle="Back to Chart of Accounts"
          numberLabel={numberText(account.accountNumber)}
          title={account.accountName}
          typeLine={typeLine}
          tone={account.status === 'Archived' ? 'danger' : account.status === 'Inactive' ? 'warning' : 'default'}
          description={account.description}
          titleBadges={
            <>
              {/* Status leads the chip row; the remaining chips are static
                  metadata so the one interactive control sits leftmost. Same
                  control as the listing's Status cell, so the page an account is
                  opened from does not offer a different set of states than the
                  page it opens onto. */}
              <StatusMenu a={account} onPick={lifecycle.request} />
              {/* Classification / account type read plainly, so they carry no hover tooltip.
                  Not on the five category accounts: with no parent to name, the
                  badge fell back to the category ("Asset"), which the rail's
                  GL account category already states. Mahad, 2026-09-30: *"Remove
                  these pills ... but only from the 5 category accounts only."* */}
              {!isCategoryRoot(account) && <ClassificationBadge account={account} index={chartIndex} />}
              <Badge tone={GL_TYPE_TONE[account.glAccountType] ?? 'neutral'}>{account.glAccountType}</Badge>
              {/* The currency the account is held in, on every account, its
                  balance beside the actions. Back in the header since Mahad,
                  2026-11-14: *"Account detail page, header: show the account's
                  currency, and the balance in both the foreign and the base
                  currency."* It came out on 2026-10-09 (*"remove currency from
                  header in the detail pages"*); the rail's Currency field stays. */}
              <UITooltip rich align="left" content={<CurrencyHeldCard code={account.currencyCode} base={store.company.baseCurrency} hint={false} />}>
                <Badge tone="info" className="cursor-help"><CurrencyFlag meta={currencyMeta(account.currencyCode)} className="text-[11px] leading-none" />{account.currencyCode}</Badge>
              </UITooltip>
              {account.defaultDimensionValues.slice(0, 3).map((tv) => {
                const name = store.dimensions.find(t => t.id === tv.dimensionId)?.name ?? tv.dimensionId
                return (
                  <UITooltip key={tv.dimensionId} side="bottom" content={`Default dimension. Postings to this account start with ${name} set to ${tv.value}, editable per entry.`}>
                    <Badge tone="neutral"><Tag size={10} /> {name}: {tv.value}</Badge>
                  </UITooltip>
                )
              })}
              {account.defaultDimensionValues.length > 3 && (
                <UITooltip side="bottom" content={account.defaultDimensionValues.slice(3).map(tv => `${store.dimensions.find(t => t.id === tv.dimensionId)?.name ?? tv.dimensionId}: ${tv.value}`).join(', ')}>
                  <Badge tone="neutral">+{account.defaultDimensionValues.length - 3} more</Badge>
                </UITooltip>
              )}
            </>
          }
          actions={
            <>
              {/* The same menu the listing's row kebab draws, from the same
                  component, on every kind of account. It used to be a posting
                  account's menu only, holding the two actions the row withheld,
                  with the lifecycle reachable from the status chip, Delete
                  standing outside as its own button, and a summary offering a
                  "New account" button instead of a menu at all - so the verbs an
                  account had depended on which page you asked from and what kind
                  of account it was. Every one of those is an item here now. */}
              <Menu trigger={
                <button type="button" aria-label="Account actions" className="h-9 px-3.5 text-[13px] rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm" style={{ fontWeight: 500 }}>
                  Actions
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
              }>
                {(close) => (
                  <AccountActionItems a={account} onAction={onMenuAction} onAddChild={onAddChild} onCreateBeside={(a, side) => setBesideDefaults(besidePrefill(a, side, scopedAccounts, protection))} parent={chartIndex.parentOf(account.id)} close={close} />
                )}
              </Menu>
              {/* An archived account is read-only (module review, 2026-10-06,
                  COA-21), so its page offers no edit. */}
              {account.status !== 'Archived' && (
              <button onClick={() => setEditOpen(true)} className="h-9 px-4 text-[13px] rounded-lg bg-primary hover:bg-[#0862D0] text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm" style={{ fontWeight: 600 }}>
                <Pencil className="w-3.5 h-3.5" />
                Edit Account
              </button>
              )}
            </>
          }
          figure={template === 'transaction' ? (compact => <HeaderBalance account={account} base={store.company.baseCurrency} compact={compact} />) : undefined}
          tabs={detailTabs(template, commsCount, attachmentCount, noteCount)}
          activeTab={tab}
          onTabChange={(v) => { setRegisterRange(null); setTab(v as any) }}
        />

      {/* Body - same centered container as the header, widening in lock-step
          when fullscreen is toggled. */}
      <div className={cn(detailContainerCls(fullscreen), 'w-full flex-1 flex flex-col pt-3 pb-5 space-y-4')}>
        {template === 'rollup' && tab === 'overview' && <RollupOverview account={account} />}
        {template === 'rollup' && tab === 'accounts' && <RollupAccountsTab account={account} />}
        {template === 'transaction' && tab === 'overview' && (
          <OpenRegisterContext.Provider value={openRegister}>
            <OverviewTab key={account.id} account={account} transactions={transactions} />
          </OpenRegisterContext.Provider>
        )}
        {template === 'transaction' && tab === 'register' && <RegisterTab transactions={transactions} currency={account.currencyCode} statistical={false} accountId={account.id} initialRange={registerRange ?? undefined} />}
        {template === 'transaction' && tab === 'source' && <WhereUsedTab />}
        {tab === 'notes' && <NotesTab noteKey={noteKey('account', account.id)} noun="account" derived={derivedNotes} />}
        {tab === 'attachments' && <AccountAttachmentsTab account={account} />}
        {tab === 'comms' && <CommsTab {...commsSubject} />}
        {tab === 'activity' && <HistoryTab audit={audit} account={account} />}
      </div>

      {editOpen && <CreateAccountSlideOver open onClose={() => setEditOpen(false)} editAccount={account} />}
      {addChildOpen && <CreateAccountSlideOver open onClose={() => setAddChildOpen(false)} parentAccount={account} />}
      {besideDefaults && <CreateAccountSlideOver open onClose={() => setBesideDefaults(null)} defaults={besideDefaults} />}
      {wrapOpen && <MoveUnderSummaryModal account={account} onClose={() => setWrapOpen(false)} />}
      {jeOpen && <NewJournalEntryModal open onClose={() => setJeOpen(false)} prefillAccountId={account.id} />}
      {lifecycle.confirmModal}

    </div>
  )
}

// =========================
// Overview
// =========================
// The dashboard's KPI tiles, togglable via Customize Insights. The page-level
// Insights period scopes the KPI strip only - each chart widget below owns its
// own period selector (the CM AccountInsights split).
const KPI_CATALOG: DetailKpiDef[] = [
  // The live daily running total: the fiscal-year opening moved by every
  // posting's normal-side delta - the continuous curve the Running Balance Trend
  // chart draws, updated with each posting rather than snapped to a month.
  { key: 'running', label: 'Running balance', description: 'Shows the account balance after each transaction.', category: 'Balance' },
  { key: 'openingBalance', label: 'Opening balance', description: 'Shows the account balance at the start of the selected period.', category: 'Balance' },
  { key: 'fxBalance', label: 'Foreign balance', description: "Shows the account balance in the account's currency.", category: 'Balance' },
  { key: 'txCount', label: 'Transactions', description: 'The number of transactions posted to this account this period.', category: 'Activity' },
  { key: 'largest', label: 'Largest posting', description: 'The single biggest entry this period. Select it to open that journal entry in the General Ledger.', category: 'Activity' },
  { key: 'lastTx', label: 'Last transaction', description: 'The date of the most recent posting to this account.', category: 'Activity' },
]
// Closing Balance and Net Change are inherently per-month values, so they live
// in the analytics widgets (Closing Balance Trend, Net Change Trend) rather
// than the KPI strip, which is reserved for current-state snapshots.
const DEFAULT_KPIS = ['running', 'openingBalance', 'txCount', 'largest', 'lastTx']
const DEFAULT_KPIS_FX = ['running', 'openingBalance', 'txCount', 'fxBalance', 'largest', 'lastTx']

// The dashboard's chart widgets, togglable via Customize Insights (CM
// account-detail widget catalog pattern: icon tile + preview SVG per entry).
const WIDGET_CATALOG: DetailWidgetDef[] = [
  { key: 'running', label: 'Running balance trend', description: 'Shows the trend of the account balance over the selected period.', category: 'Charts', icon: Activity, iconBg: '#F5F3FF', iconColor: '#7C3AED', previewType: 'area' },
  { key: 'balance', label: 'Closing balance trend', description: "The account's closing balance at the end of each closed accounting period. The current period is excluded until it closes.", category: 'Charts', icon: TrendingUp, previewType: 'area' },
  { key: 'fx', label: 'Foreign closing balance trend', description: "Closing balance over time in the account's own currency, shown only for non-base-currency accounts.", category: 'Charts', icon: TrendingUp, iconBg: '#ECFDF5', iconColor: '#059669', previewType: 'line' },
  { key: 'netChangeTrend', label: 'Net change trend', description: 'Shows the trend of the net change, calculated as the closing balance minus the opening balance for each period.', category: 'Charts', icon: TrendingUp, iconBg: '#EFF6FF', iconColor: '#0A77FF', previewType: 'bar' },
  { key: 'activity', label: 'Posting activity', description: 'Shows all debits and credits recorded during the selected period.', category: 'Charts', icon: BarChart3, previewType: 'bar' },
]

// Windows anchor presets on the data's latest date (not the wall clock) so
// demo data dated in the future still slices sensibly; custom ranges compare
// the picked absolute dates.
function windowTxByPeriod(items: Transaction[], period: PeriodValue): Transaction[] {
  if (period.kind === 'custom') {
    const f = toIsoDay(period.from), t = toIsoDay(period.to)
    return items.filter(x => { const d = x.date.slice(0, 10); return d >= f && d <= t })
  }
  if (period.preset === 'all' || items.length === 0) return items
  const { days } = resolvePeriod(period)
  const last = items.reduce((m, x) => Math.max(m, +new Date(x.date)), 0)
  return items.filter(x => +new Date(x.date) >= last - days * 86400000)
}
// Same anchor-on-latest-data behaviour as windowTxByPeriod, but for the
// per-month rows the balance/net-change trends chart on.
function windowMonthlyByPeriod<T extends { period: { startDate: string; endDate: string } }>(rows: T[], period: PeriodValue): T[] {
  if (rows.length === 0) return rows
  if (period.kind === 'custom') {
    const f = toIsoDay(period.from), t = toIsoDay(period.to)
    return rows.filter(r => r.period.endDate >= f && r.period.startDate <= t)
  }
  if (period.preset === 'all') return rows
  /* A month preset asks for a number of rows, not a span of days. These rows are
     one per accounting period, so "3 months" is the last three of them however
     long each month happens to be - a fixed 92-day cutoff would keep or drop a
     fourth depending on which months the reader is standing in. */
  const months = PRESET_MONTHS[period.preset]
  if (months) return rows.slice(-months)
  const { days } = resolvePeriod(period)
  const lastEnd = rows[rows.length - 1].period.endDate
  const cutoff = new Date(lastEnd)
  cutoff.setDate(cutoff.getDate() - (days - 1))
  const cutoffIso = toIsoDay(cutoff)
  return rows.filter(r => r.period.endDate >= cutoffIso)
}
function windowSeriesByPeriod(series: { date: string; balance: number }[], period: PeriodValue) {
  if (series.length < 2) return series
  if (period.kind === 'custom') {
    const f = toIsoDay(period.from), t = toIsoDay(period.to)
    const w = series.filter(p => p.date >= f && p.date <= t)
    return w.length > 1 ? w : series.slice(-2)
  }
  if (period.preset === 'all') return series
  const { days } = resolvePeriod(period)
  const last = +new Date(series[series.length - 1].date)
  const w = series.filter(p => +new Date(p.date) >= last - days * 86400000)
  return w.length > 1 ? w : series.slice(-2)
}
// Axis label for an ISO date, CM-style ("Jul 24").
const MONTHS_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const isoLabel = (iso: string) => `${MONTHS_S[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}`
// Compact currency for chart ticks (CM fmtCompact: $1.2M / $3.4K / $12).
function fmtCompactMoney(n: number, symbol = '$') {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(1)}K`
  return `${sign}${symbol}${abs.toFixed(0)}`
}
// CM Recharts tooltip chrome.
const CM_TT_STYLE = { fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' } as const

// Day math on ISO date strings, done in UTC so a local timezone offset can't
// nudge a bucket into the neighbouring day.
const isoToUtc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
function isoAddDays(iso: string, n: number): string {
  const d = new Date(isoToUtc(iso) + n * 86400000)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
}
const isoDayDiff = (a: string, b: string) => Math.round((isoToUtc(a) - isoToUtc(b)) / 86400000)

function OverviewTab({ account, transactions }: { account: Account; transactions: Transaction[] }) {
  const store = useStore()
  const navigate = useNavigate()
  const chartIndex = usePeriodScopedChart()
  const base = store.company.baseCurrency
  const nonBase = account.currencyCode !== base
  const periods = store.periods
  const fiscalYearStart = store.company.fiscalYearStart
  const today = todayIso()

  const [adjustmentOpen, setAdjustmentOpen] = useState(false)
  // The long explanation behind a system account's lock, from its Learn more.
  const [guide, setGuide] = useState<'retained-earnings' | 'control' | null>(null)
  const reAdjustments = retainedEarningsAdjustmentsOf(useStore(s => s.accounts))

  // The foreign-currency insights have nothing to restate on an account held in
  // the base currency, so they're absent from the catalogue there rather than
  // rendering an em dash.
  const kpiCatalog = useMemo(() => (nonBase ? KPI_CATALOG : KPI_CATALOG.filter(k => k.key !== 'fxBalance')), [nonBase])
  const widgetCatalog = useMemo(() => (nonBase ? WIDGET_CATALOG : WIDGET_CATALOG.filter(w => w.key !== 'fx')), [nonBase])
  const defaultKpis = nonBase ? DEFAULT_KPIS_FX : DEFAULT_KPIS
  const defaultWidgets = useMemo(() => widgetCatalog.map(w => w.key), [widgetCatalog])

  // Per-account persistence, mirroring CM's `cash.account.${id}.insights.v6.*`
  // scheme. The enabled arrays double as the display order.
  const storageBase = `coa.account.${account.id}.insights.v6`
  const [activeKpis, setActiveKpis] = useState<string[]>(() => readStored<string[]>(`${storageBase}.activeKpis`, defaultKpis))
  const [activeWidgets, setActiveWidgets] = useState<string[]>(() => readStored<string[]>(`${storageBase}.activeWidgets`, defaultWidgets))
  const [widgetSizes, setWidgetSizes] = useState<Record<string, WidgetSize>>(() => readStored<Record<string, WidgetSize>>(`${storageBase}.widgetSizes`, {}))
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => { try { localStorage.setItem(`${storageBase}.activeKpis`, JSON.stringify(activeKpis)) } catch { /* ignore */ } }, [activeKpis, storageBase])
  useEffect(() => { try { localStorage.setItem(`${storageBase}.activeWidgets`, JSON.stringify(activeWidgets)) } catch { /* ignore */ } }, [activeWidgets, storageBase])
  useEffect(() => { try { localStorage.setItem(`${storageBase}.widgetSizes`, JSON.stringify(widgetSizes)) } catch { /* ignore */ } }, [widgetSizes, storageBase])

  const toggleKpi = (key: string) => setActiveKpis(p => (p.includes(key) ? p.filter(k => k !== key) : [...p, key]))
  const toggleWidget = (key: string) => setActiveWidgets(p => (p.includes(key) ? p.filter(k => k !== key) : [...p, key]))
  const resetInsights = () => { setActiveKpis(defaultKpis); setActiveWidgets(defaultWidgets); setWidgetSizes({}) }
  const isDefault =
    activeKpis.length === defaultKpis.length && activeKpis.every((k, i) => k === defaultKpis[i]) &&
    activeWidgets.length === defaultWidgets.length && activeWidgets.every((k, i) => k === defaultWidgets[i]) &&
    Object.keys(widgetSizes).length === 0

  const moveKpi = useCallback((from: number, to: number) => setActiveKpis(prev => {
    const next = [...prev]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    return next
  }), [])
  const moveWidget = useCallback((from: number, to: number) => setActiveWidgets(prev => {
    const next = [...prev]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    return next
  }), [])
  const setWidgetSize = useCallback((key: string, size: WidgetSize) => setWidgetSizes(prev => ({ ...prev, [key]: size })), [])

  const enabledKpiDefs = useMemo(
    () => activeKpis.map(k => kpiCatalog.find(c => c.key === k)).filter(Boolean) as typeof KPI_CATALOG,
    [activeKpis, kpiCatalog])
  const enabledWidgetKeys = useMemo(
    () => activeWidgets.filter(k => widgetCatalog.some(w => w.key === k)),
    [activeWidgets, widgetCatalog])

  // Running closing balance, one point per posting date. Anchor the series so
  // its final point equals account.balance (the closing tile): start from the
  // implied opening (closing less the net of every posting) and accumulate
  // forward. Starting at account.balance and adding on top double-counts and
  // makes the chart footer disagree with the KPI tiles. Falls back to a
  // two-point line so a barely-posted account still draws something.
  const balanceSeries = useMemo(() => {
    const out: { date: string; balance: number }[] = []
    // Normal-side, because it is anchored to account.balance, which is stored that
    // way. Debit less credit walked a credit-normal account's curve backwards from
    // an endpoint that was right, so the line disagreed with its own last point.
    const totalDelta = transactions.reduce((s, t) => s + normalSideDelta(account, t), 0)
    let bal = account.balance - totalDelta
    const sorted = [...transactions].sort((a, b) => +new Date(a.date) - +new Date(b.date))
    sorted.forEach(t => {
      bal += normalSideDelta(account, t)
      out.push({ date: t.date.slice(0, 10), balance: bal })
    })
    // The fallback spans the fiscal year start to today, never to a fixed date: a
    // hardcoded end pins the axis to whatever the calendar was when it was written,
    // and once real today passes it the chart plots into the future.
    return out.length > 1 ? out : [{ date: fiscalYearStart, balance: account.balance * 0.7 }, { date: today, balance: account.balance }]
  }, [transactions, account, fiscalYearStart, today])

  // The daily running-balance curve from the normal-side read-model
  // (lib/monthlyLedger), anchored at the account's fiscal-year opening so it
  // reconciles to account.balance.
  const seededOpening = store.seedQ1Openings[account.id] ?? 0
  const runningSeries = useMemo(() => {
    const pts = runningBalanceLedger(account, transactions, seededOpening)
    const out = pts.map(p => ({ date: p.transaction.date.slice(0, 10), balance: p.runningBalance }))
    // Same rule as balanceSeries. This one ended on the fiscal year's last day, so
    // an account with one posting or none drew a flat line running months past
    // today and labelled the axis with it.
    return out.length > 1 ? out : [{ date: fiscalYearStart, balance: seededOpening }, { date: today, balance: out[0]?.balance ?? seededOpening }]
  }, [account, transactions, seededOpening, fiscalYearStart, today])
  // The current running total: the fiscal-year opening moved by every posting's
  // normal-side delta - the last point of the running curve.
  const runningTotal = useMemo(
    () => seededOpening + transactions.reduce((s, t) => s + normalSideDelta(account, t), 0),
    [account, transactions, seededOpening])

  /* The activity KPIs - transaction count and largest posting - read against the
     accounting period stated at the top of the page, like every other figure on
     it. There used to be a second, independent lookback beside the "Insights"
     heading, and the two sat inches apart saying different things about the same
     tiles: the strip said Sep FY2026 and the picker said Last 30 days, and the
     count underneath was the picker's. Mahad: *"I dont think this makes sence in
     the account detail page. As, the KPIs change from the accounting period bar
     up top."* Each chart widget still owns its own lookback in its own header,
     which is a window over a trend rather than a second answer to "when". */
  const selectedPeriod = useSelectedPeriod()
  const periodTx = useMemo(
    () => transactions.filter(t => isInSelection(t.date, selectedPeriod)),
    [transactions, selectedPeriod])
  /* Opening balance is an accounting figure, so it reads against the accounting
     period, never the Insights picker - driving it off the picker turned "Last 7
     days" into a silent redefinition of what Opening Balance means.

     Signed, like every other figure on the page. It used to print through
     Math.abs, on the reasoning that a balance is a magnitude and net change
     carries the direction. That holds until a balance is genuinely negative on
     the account's own normal side, which is what a contra account is: 1085 read
     +19,429 here and -19,429 in the listing, off one stored figure. */
  /* The balance on the first day of the period picked in the strip, read off
     the same period-scoped chart the listing and the export print it from.
     It used to be the opening of the month today falls in, whatever the strip
     said, so the three disagreed on any other month. Mahad, 2026-10-10: *"The
     opening balance should always be the balance on the first day of the
     selected month, on every screen."* */
  const openingBalance = useMemo(() => {
    const f = chartRowValues(account, chartIndex)
    return f ? f.balance - f.netChange : 0
  }, [account, chartIndex])
  const largest = useMemo(() => [...periodTx].sort((a, b) => Math.max(b.debit, b.credit) - Math.max(a.debit, a.credit))[0], [periodTx])
  const lastTx = useMemo(
    () => (transactions.length ? [...transactions].sort((a, b) => +new Date(b.date) - +new Date(a.date))[0] : undefined),
    [transactions])

  // On a non-base account the base-currency figures are converted - prefix the
  // conversion marker whose hover explains the rate (Account Listing parity).
  const withConv = (usdValue: number, node: ReactNode): ReactNode => nonBase
    ? <BookedBaseTooltip code={account.currencyCode} base={base} booked={usdValue}><span className="cursor-help inline-flex items-center gap-1"><BookedMarker code={account.currencyCode} />{node}</span></BookedBaseTooltip>
    : node

  const kpiValue = (key: string): { value: ReactNode; subDetail?: ReactNode } => {
    switch (key) {
      case 'running':
        return {
          value: fmtCurrency(runningTotal, base),
          subDetail: balanceStruckLabel(lastTx && fmtDate(lastTx.date), runningTotal),
        }
      case 'openingBalance':
        return {
          value: withConv(openingBalance, fmtCurrency(openingBalance, base)),
          subDetail: selectedPeriod.startDate ? `As of ${fmtDate(selectedPeriod.startDate)}` : undefined,
        }
      case 'fxBalance':
        return {
          value: fmtCurrency(currentOwnBalanceOf(account), account.currencyCode),
          subDetail: `Restated in ${account.currencyCode}`,
        }
      case 'txCount':
        return { value: fmtNumber(periodTx.length), subDetail: selectedPeriod.label }
      case 'largest':
        return {
          value: largest ? fmtCurrency(Math.max(largest.debit, largest.credit), base) : '-',
          // The entry number rather than `via ${source}`: the tile opens the entry
          // in the General Ledger, so it has to name what it will open. Styled as a
          // link but not a nested button - the whole tile carries the navigation.
          subDetail: largest
            ? (
              <span className="inline-flex items-center gap-1 max-w-full">
                <span className="truncate underline decoration-dotted decoration-[#CBD5E1] underline-offset-2 group-hover:text-[#64748B] group-hover:decoration-[#94A3B8] transition-colors">{largest.jeNumber}</span>
                <ArrowUpRight className="w-2.5 h-2.5 shrink-0" />
              </span>
            )
            : undefined,
        }
      case 'lastTx':
        return {
          value: lastTx ? fmtDate(lastTx.date) : '-',
          subDetail: lastTx ? `${fmtCurrency(ownSide(lastTx, 'debit', account.currencyCode) - ownSide(lastTx, 'credit', account.currencyCode), account.currencyCode)} · ${relativeTime(lastTx.date)}` : 'No postings yet',
        }
      default:
        return { value: '-' }
    }
  }
  // Plain-string mirror of the headline figure, shown on each drawer tile.
  const kpiPreview = (key: string): string => {
    switch (key) {
      case 'running': return fmtCurrency(runningTotal, base)
      case 'openingBalance': return fmtCurrency(openingBalance, base)
      case 'fxBalance': return fmtCurrency(currentOwnBalanceOf(account), account.currencyCode)
      case 'txCount': return fmtNumber(periodTx.length)
      case 'largest': return largest ? fmtCurrency(Math.max(largest.debit, largest.credit), base) : '-'
      case 'lastTx': return lastTx ? fmtDate(lastTx.date) : '-'
      default: return '-'
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 items-start">
      {/* LEFT - CM AccountInsights: header row, KPI grid, widget grid */}
      <div className="min-w-0 space-y-3">
        {/* The one control that says what these figures are read against. The
            Insights heading below used to carry a second one. */}
        <PeriodStrip periods={periods} fiscalYearStart={fiscalYearStart} variant="standalone" hint={ACCOUNT_PERIOD_HINT} />
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Insights</h4>
          <button
            onClick={() => setPanelOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] text-primary hover:bg-accent transition-colors cursor-pointer shrink-0"
            style={{ fontWeight: 500 }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Insights
          </button>
        </div>

        {(enabledKpiDefs.length > 0 || enabledWidgetKeys.length > 0) && (
          <DndProvider backend={HTML5Backend}>
            {enabledKpiDefs.length > 0 && (
              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
                {enabledKpiDefs.map((kpi, i) => {
                  const { value, subDetail } = kpiValue(kpi.key)
                  return (
                    <DraggableKpiCard
                      key={kpi.key}
                      index={i}
                      kpiKey={kpi.key}
                      label={kpi.label}
                      value={value}
                      // Only the two balance tiles carry a date, and each states
                      // the one its own figure is struck on. Largest posting is the
                      // exception: its sub-line names the entry the tile opens.
                      subDetail={kpi.key === 'running' || kpi.key === 'openingBalance' || kpi.key === 'largest' ? subDetail : undefined}
                      tooltip={kpi.description}
                      moveCard={moveKpi}
                      onClick={kpi.key === 'largest' && largest ? () => navigate(`/general-ledger/entry/${encodeURIComponent(largest.jeNumber)}`) : undefined}
                      onRemove={() => toggleKpi(kpi.key)}
                    />
                  )
                })}
              </div>
            )}

            {/* Laid out the way the Partners dashboard lays its widgets out:
                a wrapping flex row where each card carries its own width, not a
                grid where each card claims a column. The two look the same at
                rest and behave differently the moment a size changes - `col-span`
                snaps, a width animates, and resizing a card is the one thing this
                row exists to let a reader do. Half is `calc(50% - 6px)` because
                `gap-3` puts 12px between the pair. */}
            {enabledWidgetKeys.length > 0 && (
              <div className="flex flex-wrap gap-3 items-stretch min-w-0">
                {enabledWidgetKeys.map((wKey, i) => {
                  const meta = widgetCatalog.find(w => w.key === wKey)
                  if (!meta) return null
                  const sz: WidgetSize = widgetSizes[wKey] ?? 'md'
                  return (
                    <div
                      key={wKey}
                      style={{ width: sz === 'lg' ? '100%' : 'calc(50% - 6px)' }}
                      className="transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] h-auto self-stretch"
                    >
                      <DraggableWidgetCard widgetKey={wKey} index={i} moveWidget={moveWidget}>
                        {(isDragging, isOver) => (
                          <WidgetContentCard
                            title={meta.label}
                            tooltip={meta.description}
                            icon={meta.icon}
                            iconBg={meta.iconBg}
                            iconColor={meta.iconColor}
                            currentSize={sz}
                            onSizeChange={s => setWidgetSize(wKey, s)}
                            onRemove={() => toggleWidget(wKey)}
                            isDragging={isDragging}
                            isOver={isOver}
                          >
                            {wKey === 'running' && <RunningBalanceBody series={runningSeries} base={base} />}
                            {wKey === 'balance' && <BalanceTrendBody account={account} transactions={transactions} base={base} />}
                            {wKey === 'fx' && <FxTrendBody series={balanceSeries} transactions={transactions} account={account} />}
                            {wKey === 'netChangeTrend' && <NetChangeTrendBody account={account} transactions={transactions} base={base} />}
                            {wKey === 'activity' && <PostingActivityBody transactions={transactions} base={base} account={account} />}
                          </WidgetContentCard>
                        )}
                      </DraggableWidgetCard>
                    </div>
                  )
                })}
              </div>
            )}
          </DndProvider>
        )}

        {enabledKpiDefs.length === 0 && enabledWidgetKeys.length === 0 && (
          <div className="border border-dashed border-border rounded-lg py-8 px-4 text-center bg-white">
            <p className="text-sm text-muted-foreground mb-2">No insights enabled.</p>
            <button
              onClick={() => setPanelOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] text-white bg-primary hover:bg-[#0862D0] transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              <Plus className="w-3.5 h-3.5" /> Add insight
            </button>
          </div>
        )}

        <DetailInsightsPanel
          open={panelOpen}
          onOpenChange={setPanelOpen}
          kpis={kpiCatalog}
          widgets={widgetCatalog}
          activeKpis={activeKpis}
          activeWidgets={activeWidgets}
          onToggleKpi={toggleKpi}
          onToggleWidget={toggleWidget}
          onReset={resetInsights}
          isDefault={isDefault}
          kpiPreview={kpiPreview}
        />
        </div>
        {/* RIGHT - info rail, like the Partner detail's Partner Information /
            Financial Summary column. Sticks below the morphing header. */}
        <div className="space-y-3.5 min-w-0 overflow-hidden xl:sticky xl:top-[160px]">
        {/* Account Information - Partner Information card structure: icon-tile
            header with chevron + separator, label-above-value fields in
            two-column grids, hairline footer separator. */}
        <DashInfoCard title="GL account information" icon={FileText}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-2.5">
            <div className="min-w-0">
              {/* Deliberately the stored number, not the shortened reading of it: a
                  chart that shortened its numbers promised the original was kept,
                  and this card is where a reader comes to see it. */}
              <DashInfoLabel>GL account no.</DashInfoLabel>
              <p className="text-[12.5px] text-slate-700 truncate" style={{ fontWeight: 600 }}>{account.accountNumber}</p>
            </div>
            <div className="min-w-0">
              <DashInfoLabel>GL account category</DashInfoLabel>
              <div className="mt-0.5"><CategoryCell meta={ACCOUNT_TYPE_META[account.accountType as AccountType]} /></div>
            </div>
          </div>
          {/* The category, this, and the parent read as one narrowing: which
              statement, which line of it, and where in that line. Full width
              because the longest value ("Non-current liability") and the line
              under it both need the whole rail. */}
          <div className="mb-2.5 min-w-0">
            {/* The classification's own description moved into the tooltip
                rather than out of the product: the listing already offers it
                that way (`AccountTable`), and the page it was printed on states
                the classification in one line. */}
            <DashInfoLabel tooltip={`Which line of the statement this account prints on. A summary and the accounts under it always agree, so moving an account moves this too. ${CLASSIFICATION_DESCRIPTIONS[account.statementClassification]}`}>Statement classification</DashInfoLabel>
            <p className="text-[12.5px] text-slate-700 mt-0.5" style={{ fontWeight: 600 }}>{account.statementClassification}</p>
          </div>
          {/* Directly below the classification, because the three answer the same
              question at three widths. Full width rather than sharing a row - a
              name like "Cash and Cash Equivalents" has nowhere to go in half of
              this rail. */}
          <ParentField account={account} index={chartIndex} className="mb-2.5" />
          <ProvenanceField account={account} className="mb-2.5" />
          <RestrictedField account={account} className="mb-2.5" />
          {/* Type and role pair up: each is a single chip, and both answer what the
              account may do. Account role is posting accounts only - they are the
              accounts that hold balances and receive transactions, so only they can
              carry one - which leaves the type chip a half-width column of its own
              on a summary account rather than a lonely full-width row. */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-2.5">
            <div className="min-w-0">
              <DashInfoLabel rich tooltip={<GLTypeLegend />}>GL account type</DashInfoLabel>
              <div className="mt-0.5"><Badge tone={GL_TYPE_TONE[account.glAccountType] ?? 'neutral'}>{account.glAccountType}</Badge></div>
            </div>
            {account.glAccountType === 'Posting' && (
              <div className="min-w-0">
                {/* align right: this rail is the page's right column, so the card has
                    to hang leftward off the icon rather than off the viewport. */}
                <DashInfoLabel
                  align="right"
                  tooltip="Marks the account as a recognized kind, such as Accounts Receivable or Bank, so other modules use it correctly."
                >Account role</DashInfoLabel>
                {account.accountRole
                  ? <div className="mt-0.5"><Badge tone="info">{account.accountRole}</Badge></div>
                  : <p className="text-[12px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>No role</p>}
              </div>
            )}
          </div>
          {/* The restrictions a role brings, and nothing else. What the role
              *stops the reader doing* has to be on the page, because this page is
              where they come to ask why the journal entry picker would not take
              the account.

              So the block renders for the two roles that refuse a posting, not
              for every role - an ordinary role has nothing to say here. */}
          {account.accountRole && (isControlAccountRole(account.accountRole as AccountRole) || isRetainedEarnings(account) || isRetainedEarningsAdjustments(account)) && (
            <div className="mb-2.5">
              {isControlAccountRole(account.accountRole as AccountRole) && (
                <>
                  {/* No top margin: with the role's description gone this is the
                      first thing in the block, and the block already carries the
                      gap below the pair above it. */}
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Lock size={10} className="shrink-0" />
                    {CONTROL_ACCOUNT_LOCK_LINE}
                  </p>
                  {/* The same exception retained earnings carries, because it is
                      the same door: a declared adjustment reaches every account
                      the system owns. Stating it on one lock and not the other
                      would read as two different rules. */}
                  <p className="text-[11px] text-slate-400 mt-1 pl-[14px] leading-relaxed">
                    {PRIOR_PERIOD_EXCEPTION_LINE}{' '}
                    <button type="button" onClick={() => setGuide('control')} className="text-primary hover:underline" style={{ fontWeight: 600 }}>Learn more</button>
                  </p>
                  {/* The way out for an ordinary posting, offered where the
                      refusal is explained. A reader who came here to ask why the
                      journal entry picker would not take this account has just
                      been told; the next thing they need is the account that
                      will, since a correction is not what most of them want. */}
                  <button
                    onClick={() => setAdjustmentOpen(true)}
                    className="text-[11px] text-primary hover:underline mt-1 flex items-center gap-1"
                    style={{ fontWeight: 600 }}
                  >
                    <Plus size={10} className="shrink-0" />
                    Add an adjustment account beside it
                  </button>
                </>
              )}
              {/* Retained earnings' lock, in the same place and for the same
                  reason. Where the chart has the manual adjustments account, the
                  way through is that account, so the line names it; a chart with
                  only this one keeps it open to a correction with a reason. */}
              {isRetainedEarnings(account) && (
                <>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Lock size={10} className="shrink-0" />
                    {reAdjustments ? RETAINED_EARNINGS_LOCK_LINE : 'The year-end close posts here'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 pl-[14px] leading-relaxed">
                    {reAdjustments ? retainedEarningsRedirectLine(reAdjustments) : PRIOR_PERIOD_EXCEPTION_LINE}{' '}
                    <button type="button" onClick={() => setGuide('retained-earnings')} className="text-primary hover:underline" style={{ fontWeight: 600 }}>Learn more</button>
                  </p>
                </>
              )}
              {/* The manual half: not locked, so no padlock - it says what it is for. */}
              {isRetainedEarningsAdjustments(account) && (
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {RETAINED_EARNINGS_ADJUSTMENTS_LINE}{' '}
                  <button type="button" onClick={() => setGuide('retained-earnings')} className="text-primary hover:underline" style={{ fontWeight: 600 }}>Learn more</button>
                </p>
              )}
              <GuideSheet open={!!guide} onClose={() => setGuide(null)} config={guide === 'control' ? SYSTEM_ACCOUNTS_GUIDE : RETAINED_EARNINGS_GUIDE} />
            </div>
          )}
          {/* Which side the account grows on. The Contra badge stays on the page,
              because it is a fact about this account that its value alone does
              not give; what contra *means* and which way to read the page's
              signed figures are both in the tooltip now, which is given this
              account's own two facts so it can still say them. */}
          {account.glAccountType === 'Posting' && (
            <div className="mb-2.5 min-w-0">
              <DashInfoLabel rich tooltip={<NormalBalanceHelp normalBalance={account.normalBalance} isContra={account.isContra} />}>Normal balance</DashInfoLabel>
              <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                <span className="text-[12.5px] text-slate-700" style={{ fontWeight: 600 }}>{account.normalBalance}</span>
                {account.isContra && <Badge tone="warning">Contra</Badge>}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-2.5">
            <div className="min-w-0">
              <DashInfoLabel>Currency</DashInfoLabel>
              <div className="mt-0.5"><CurrencyCell code={account.currencyCode} /></div>
            </div>
            <div className="min-w-0">
              {/* `createdAt`, which is what the Activity tab's Create entry is
                  written from. It used to read `effectiveDate` - a different
                  fact under the same label, and one the whole chart shares, so
                  every account claimed the same birthday and none of them
                  matched their own history. Effective from is its own column on
                  the listing and stays there. */}
              <DashInfoLabel>Created on</DashInfoLabel>
              <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{fmtDate(account.createdAt)}</p>
            </div>
          </div>
          {account.setupNote && (
            <div className="mb-2.5">
              <DashInfoLabel>Why included</DashInfoLabel>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{account.setupNote}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-2.5 border-t border-muted">
            <div className="min-w-0">
              <DashInfoLabel>Created by</DashInfoLabel>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] shrink-0" style={{ backgroundColor: avatarColor(account.createdBy), fontWeight: 600 }}>
                  {initialsOf(account.createdBy)}
                </div>
                <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{cleanName(account.createdBy)}</span>
              </div>
            </div>
            <div className="min-w-0">
              <DashInfoLabel>Last updated</DashInfoLabel>
              <p className="text-[12px] text-slate-700 mt-0.5 truncate" style={{ fontWeight: 500 }}>{fmtDate(account.updatedAt)}</p>
            </div>
            {account.updatedBy && (
              <div className="min-w-0">
                <DashInfoLabel>Last updated by</DashInfoLabel>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] shrink-0" style={{ backgroundColor: avatarColor(account.updatedBy), fontWeight: 600 }}>
                    {initialsOf(account.updatedBy)}
                  </div>
                  <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{cleanName(account.updatedBy)}</span>
                </div>
              </div>
            )}
            <InternalIdField id={account.internalId} help={INTERNAL_ID_HELP} />
          </div>
        </DashInfoCard>

        {/* Bank Account Information - shown only for accounts that carry bank
            details (excludes pure cash and non-bank accounts). */}
        {account.bankName && (
          <DashInfoCard title="Bank account information" icon={Building2}>
            <div className="space-y-2.5">
              <div>
                <DashInfoLabel>Setup</DashInfoLabel>
                <div className="mt-1">
                  <span className="inline-flex items-center gap-1.5 px-2 h-[22px] rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-2xs" style={{ fontWeight: 600 }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected
                  </span>
                </div>
              </div>
              {account.bankNickname && (
                <div>
                  <DashInfoLabel>Nickname</DashInfoLabel>
                  <p className="text-[12px] text-slate-700 mt-0.5" style={{ fontWeight: 500 }}>{account.bankNickname}</p>
                </div>
              )}
              <div>
                <DashInfoLabel>Bank name</DashInfoLabel>
                <p className="text-[12px] text-slate-700 mt-0.5" style={{ fontWeight: 500 }}>{account.bankName || '-'}</p>
              </div>
              <div>
                <DashInfoLabel>Account title</DashInfoLabel>
                <p className="text-[12px] text-slate-700 mt-0.5" style={{ fontWeight: 500 }}>{account.bankAccountTitle || '-'}</p>
              </div>
              {/* Bank setup asks for the type and marks it required, so the record
                  has to carry it back. Without this row the reader picks Checking,
                  saves, and the account never says so again. */}
              <div>
                <DashInfoLabel>{account.accountRole === 'Credit Card' ? 'Card type' : 'Bank account type'}</DashInfoLabel>
                <p className="text-[12px] text-slate-700 mt-0.5" style={{ fontWeight: 500 }}>{account.bankAccountType || '-'}</p>
              </div>
              <div className="grid grid-cols-2 gap-x-4 pt-2.5 border-t border-muted">
                <div className="min-w-0">
                  <DashInfoLabel>Bank account number</DashInfoLabel>
                  <p className="text-[12px] text-slate-700 mt-0.5 tabular-nums truncate" style={{ fontWeight: 500 }}>{account.bankAccountNumber ? `•••• ${account.bankAccountNumber.slice(-4)}` : '-'}</p>
                </div>
                <div className="min-w-0">
                  <DashInfoLabel>Routing number</DashInfoLabel>
                  <p className="text-[12px] text-slate-700 mt-0.5 tabular-nums truncate" style={{ fontWeight: 500 }}>{account.bankRouting || '-'}</p>
                </div>
              </div>
            </div>
          </DashInfoCard>
        )}

        <DefaultDimensionsCard account={account} />

        </div>
      </div>

      <AdjustmentAccountModal
        open={adjustmentOpen}
        onClose={() => setAdjustmentOpen(false)}
        target={account}
        onCreated={a => navigate(`/accounts/${a.id}`)}
      />
    </div>
  )
}

// =========================
// Overview widget bodies
// =========================
// CM pattern: every chart widget owns its own period state - local, not
// persisted, and independent of the page-level Insights period - surfaced by
// the WidgetPeriodHeader row above the chart.

// The daily running balance - a single continuous, normal-side curve (every
// posting nudges it up or down), distinct from the closing-balance trend which
// re-anchors to account.balance. The curve is the whole widget: both ends of the
// window and the change between them are already read off the axes and the KPI
// tiles above, so no figures are restated beneath it.
function RunningBalanceBody({ series, base }: {
  series: { date: string; balance: number }[]
  base: string
}) {
  const chartH = useWidgetChartH()
  const [period, setPeriod] = useState<PeriodValue>(DEFAULT_PERIOD)
  const data = useMemo(() => windowSeriesByPeriod(series, period), [series, period])
  return (
    <>
      <WidgetPeriodHeader period={period} onChange={setPeriod} presets={['7d', '14d', '30d', '90d']} />
      {data.length === 0 ? (
        <ChartEmpty icon={Activity} title="No running balance" description="Each posting moves this account's running balance; postings will chart here." />
      ) : (
        <>
          <div style={{ height: chartH }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="coaRunTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="date" tickFormatter={isoLabel} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => fmtCompactMoney(v)} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip contentStyle={CM_TT_STYLE} labelFormatter={(l: string) => isoLabel(l)} formatter={(v: number) => [fmtCurrency(v, base), 'Running Balance']} />
                <Area type="monotone" dataKey="balance" stroke="#7C3AED" strokeWidth={2} fill="url(#coaRunTrendGrad)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </>
  )
}

// Closing Balance Trend - a monthly-only area chart of the account's closing
// balance at the end of each accounting period. Closing balance is a single
// value per month, and it only exists once the period closes, so the current
// still-Open period is left off entirely: plotting it would chart a figure the
// month can still move. The chart therefore ends at the last closed month.
function BalanceTrendBody({ account, transactions, base }: { account: Account; transactions: Transaction[]; base: string }) {
  const chartH = useWidgetChartH()
  const periods = useStore(s => s.periods)
  const seededOpening = useStore(s => s.seedQ1Openings[account.id] ?? 0)
  const [period, setPeriod] = useState<PeriodValue>({ kind: 'preset', preset: '12m' })
  const today = todayIso()
  const closedRows = useMemo(() => {
    const { rows, provisionalPeriodId } = monthlyBalancesThrough(account, transactions, seededOpening, periods, today)
    return rows.filter(r => r.period.id !== provisionalPeriodId)
  }, [account, transactions, seededOpening, periods, today])
  const rows = useMemo(() => windowMonthlyByPeriod(closedRows, period), [closedRows, period])
  const data = useMemo(() => rows.map(r => ({ period: r.period.label, closing: r.closing })), [rows])
  return (
    <>
      <WidgetPeriodHeader period={period} onChange={setPeriod} presets={['3m', '6m', '12m']} granularity="month" />
      {rows.length === 0 ? (
        <ChartEmpty icon={TrendingUp} title="No balance history" description="Once a period closes, its ending balance will chart here." />
      ) : (
        <>
          {/* Fills the card rather than taking a fixed 200px. This widget has no
              footer stats, so the card body's `justify-between` had nothing to
              push against and dropped the whole chart to the bottom, leaving the
              gap under the period header. Growing into that space puts the chart
              directly beneath the header, where the neighbouring trend cards start
              theirs. The floor keeps it plottable in the small card size. */}
          <div className="flex-1" style={{ minHeight: chartH }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="coaBalTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0A77FF" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#0A77FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(data.length / 8) - 1)} />
                <YAxis tickFormatter={(v: number) => fmtCompactMoney(v)} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={54} />
                <Tooltip
                  contentStyle={CM_TT_STYLE}
                  formatter={(v: number) => [fmtCurrency(v, base), 'Closing Balance']}
                />
                <Area
                  type="monotone"
                  dataKey="closing"
                  stroke="#0A77FF"
                  strokeWidth={2}
                  fill="url(#coaBalTrendGrad)"
                  activeDot={{ r: 4 }}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* No footer stats. A Start / End / Change row restated the two ends of
              a curve the reader is already looking at, and its Change was the sum
              of the Net change trend's bars - so it earned no space of its own. */}
        </>
      )}
    </>
  )
}

function FxTrendBody({ series, transactions, account }: { series: { date: string; balance: number }[]; transactions: Transaction[]; account: Account }) {
  const code = account.currencyCode
  const chartH = useWidgetChartH()
  const [period, setPeriod] = useState<PeriodValue>(DEFAULT_PERIOD)
  // Each point counts what was typed in the account's own currency up to its day
  // as typed (lib/currencies, typedCorrection).
  const data = useMemo(
    () => windowSeriesByPeriod(series, period).map(p => ({ ...p, balance: bookedFromBase(p.balance, code) + typedCorrection(account, transactions, p.date) })),
    [series, period, code, account, transactions])
  // Same KPI-consistent definition as the base-currency trend, restated into
  // the holding currency (the net is a linear delta, so it converts directly).
  const conv = (v: number) => bookedFromBase(v, code)
  // Normal-side, because `end` comes from the normal-side series. Debit less
  // credit here put Change on the opposite sign to the curve it annotated.
  const windowed = useMemo(() => windowTxByPeriod(transactions, period), [transactions, period])
  const netUsd = useMemo(() => windowed.reduce((s, t) => s + normalSideDelta(account, t), 0), [windowed, account])
  const end = data.length ? data[data.length - 1].balance : ownBalanceOf(account)
  const change = conv(netUsd) + typedCorrection(account, windowed)
  // Not abs: Start has to be End less Change, or the three figures in the row
  // below the chart do not reconcile with each other.
  const start = end - change
  return (
    <>
      <WidgetPeriodHeader period={period} onChange={setPeriod} presets={['7d', '14d', '30d', '90d']} />
      {data.length === 0 ? (
        <ChartEmpty icon={TrendingUp} title="No balance history" description="Postings to this account will chart their running closing balance here." />
      ) : (
        <>
          <div style={{ height: chartH }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="coaFxTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="date" tickFormatter={isoLabel} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => fmtCompactMoney(v, '')} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip contentStyle={CM_TT_STYLE} labelFormatter={(l: string) => isoLabel(l)} formatter={(v: number) => [fmtCurrency(v, code), 'Foreign Closing Balance']} />
                <Area type="monotone" dataKey="balance" stroke="#059669" strokeWidth={2} fill="url(#coaFxTrendGrad)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <WidgetStatRow
            stats={[
              { label: 'Start', value: fmtCurrency(start, code) },
              { label: 'End', value: fmtCurrency(end, code), color: '#059669' },
              { label: 'Change', value: `${change >= 0 ? '+' : '-'}${fmtCurrency(Math.abs(change), code)}`, color: change >= 0 ? '#059669' : '#DC2626' },
              { label: 'Currency', value: code },
            ]}
          />
        </>
      )}
    </>
  )
}

type ActivityBucket = 'day' | 'week' | 'month'
/* How wide a bucket is, decided by how many bars the window would otherwise ask
   for. A month of daily buckets is thirty pairs of bars across a card five hundred
   points wide, which draws them as hairlines - a shape that appears nowhere else in
   the suite, and not in Partners, whose bars are a fixed 14-36px and whose charts
   pick a coarser bucket rather than a thinner bar.

   Every bucket here draws a *pair*, so the count that matters is half what a
   single-series chart could carry: at this width nine buckets is where a bar stops
   reaching 20px, and that is the ceiling the thresholds keep under. A week and a
   half stays daily, a quarter stays weekly, and anything longer goes monthly -
   which is the floor, since a year is twelve bars however it is cut. */
const activityBucketFor = (span: number): ActivityBucket => (span <= 9 ? 'day' : span <= 63 ? 'week' : 'month')
// The chart's window has to be anchored the same way windowTxByPeriod anchors
// its filter - on the latest posting, not on today - or demo data dated away
// from today would render an axis with no bars under it.
function activityWindow(items: Transaction[], period: PeriodValue): { from: string; to: string } | null {
  if (period.kind === 'custom') return { from: toIsoDay(period.from), to: toIsoDay(period.to) }
  if (items.length === 0) return null
  const days = items.map(x => x.date.slice(0, 10))
  const to = days.reduce((m, d) => (d > m ? d : m), days[0])
  if (period.preset === 'all') return { from: days.reduce((m, d) => (d < m ? d : m), days[0]), to }
  return { from: isoAddDays(to, -resolvePeriod(period).days), to }
}

// The selected bar's entries, so a spike leads to its source in the ledger. A
// bucket is a day only inside a week and a half - beyond that it's a week or a
// month (activityBucketFor) - so every row carries its own date rather than
// borrowing the bucket's label, and the list is capped so a busy month can't
// outgrow the chart above it.
//
// The five most recent, and the rest one click away on the Transactions tab,
// opened on the bar's own dates. Mahad, 2026-10-15: *"if there are 10 or 20
// entries, only six are visible, and the rest are hidden behind 'X more in this
// bar.' The issue is that users can't even view those hidden entries ... having
// a 'See more,' 'View more,' or 'View all entries' link is better - clicking it
// redirects to the Transactions tab, applies the same date range filter, and
// displays all the transactions they need to see."*
const ACTIVITY_LIST_MAX = 5

/** Opens the account's Transactions tab on a date range. Provided by the page. */
const OpenRegisterContext = createContext<((range: PeriodValue) => void) | null>(null)

const fromIsoDay = (iso: string) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))

function ActivityEntryPanel({ label, txs, from, to, base, account, onOpenJe, onClose }: {
  label: string
  txs: Transaction[]
  /** The days the bar covers, which the Transactions tab opens on. */
  from: string
  to: string
  base: string
  // Signs each row the way the Net above it is signed. Debit less credit would
  // print a credit-normal account's every increase as a negative.
  account: Account
  onOpenJe: (jeNumber: string) => void
  onClose: () => void
}) {
  const openRegister = useContext(OpenRegisterContext)
  const shown = [...txs].sort((a, b) => comparePostingOrder(b, a)).slice(0, ACTIVITY_LIST_MAX)
  return (
    <div className="mt-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] overflow-hidden coa-entry-panel-in">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-[#E2E8F0]">
        <span className="text-[12px] text-fg" style={{ fontWeight: 600 }}>{label}</span>
        <span className="text-[10.5px] text-[#94A3B8]">{txs.length} {txs.length === 1 ? 'entry' : 'entries'}</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-[#94A3B8] hover:text-fg transition-colors cursor-pointer shrink-0"
          title="Close"
        >
          <X size={13} />
        </button>
      </div>
      {shown.map(t => {
        const delta = normalSideDelta(account, t)
        return (
        <div key={t.id} className="px-3 py-1.5 flex items-center gap-2 bg-white border-b border-[#F1F5F9] last:border-b-0 hover:bg-accent/60 transition-colors">
          <button
            type="button"
            onClick={() => onOpenJe(t.jeNumber)}
            className="inline-flex items-center gap-1 tabular-nums text-[12px] text-primary hover:text-[#0862D0] hover:underline underline-offset-2 transition-colors cursor-pointer shrink-0"
            style={{ fontWeight: 600 }}
            title="Quick view - see both sides of this entry"
          >
            <FileText size={11} className="text-primary/60 shrink-0" />
            {t.jeNumber}
          </button>
          <span className="text-[11px] text-muted-foreground truncate min-w-0">{t.reference || '-'}</span>
          <span className="text-[10.5px] text-[#94A3B8] tabular-nums shrink-0 ml-auto">{fmtDate(t.date)}</span>
          <span className="text-[12px] tabular-nums shrink-0 w-[92px] text-right" style={{ fontWeight: 600, color: delta >= 0 ? '#0A77FF' : '#F59E0B' }}>
            {fmtCurrency(delta, base)}
          </span>
        </div>
        )
      })}
      {txs.length > shown.length && openRegister && (
        <div className="px-3 py-1.5 bg-white">
          <button
            type="button"
            data-view-all-entries
            onClick={() => openRegister({ kind: 'custom', from: fromIsoDay(from), to: fromIsoDay(to) })}
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-[#0862D0] hover:underline underline-offset-2 transition-colors cursor-pointer"
            style={{ fontWeight: 600 }}
          >
            View all {txs.length} entries
            <ArrowRight size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

/* Takes the account, not only its id, for the one figure the postings cannot
   supply on their own: Net is a movement, and which way a movement counts
   depends on the side the account grows on. */
function PostingActivityBody({ transactions, base, account }: { transactions: Transaction[]; base: string; account: Account }) {
  const accountId = account.id
  const size = useWidgetSize()
  const chartH = useWidgetChartH()
  const [period, setPeriod] = useState<PeriodValue>(DEFAULT_PERIOD)
  // The register's quick view lives in a sibling tab, so this widget carries its
  // own instance rather than reaching for that one.
  const [quickJe, setQuickJe] = useState<string | null>(null)
  // Which bucket's entries are pinned open, by axis label.
  const [selected, setSelected] = useState<string | null>(null)
  const data = useMemo(() => {
    const win = activityWindow(transactions, period)
    if (!win) return [] as { period: string; debit: number; credit: number; txs: Transaction[]; from: string; to: string }[]
    const span = Math.max(1, isoDayDiff(win.to, win.from) + 1)
    const bucket = activityBucketFor(span)
    // Buckets run continuously across the window so quiet stretches stay visible
    // on the axis instead of the busy days closing ranks.
    const labels: string[] = []
    const monthKeys: string[] = []
    // The days each bar covers, inside the window, for handing a bar to the
    // Transactions tab as its date range.
    const spans: { from: string; to: string }[] = []
    if (bucket === 'month') {
      let y = +win.from.slice(0, 4), m = +win.from.slice(5, 7) - 1
      const endY = +win.to.slice(0, 4), endM = +win.to.slice(5, 7) - 1
      while (y < endY || (y === endY && m <= endM)) {
        const key = `${y}-${String(m + 1).padStart(2, '0')}`
        monthKeys.push(key)
        labels.push(`${MONTHS_S[m]} ${String(y).slice(2)}`)
        const last = new Date(y, m + 1, 0).getDate()
        spans.push({ from: `${key}-01` < win.from ? win.from : `${key}-01`, to: `${key}-${String(last).padStart(2, '0')}` > win.to ? win.to : `${key}-${String(last).padStart(2, '0')}` })
        m += 1
        if (m > 11) { m = 0; y += 1 }
      }
    } else {
      const step = bucket === 'week' ? 7 : 1
      for (let d = 0; d < span; d += step) {
        labels.push(isoLabel(isoAddDays(win.from, d)))
        const end = isoAddDays(win.from, d + step - 1)
        spans.push({ from: isoAddDays(win.from, d), to: end > win.to ? win.to : end })
      }
    }
    // The last bar takes anything the clamp below pushes into it.
    if (spans.length) spans[spans.length - 1].to = win.to
    // Each bucket keeps its own postings, not just their sums, so the hover can
    // name the entries behind the bar.
    const rows = labels.map((label, i) => ({ period: label, debit: 0, credit: 0, txs: [] as Transaction[], ...spans[i] }))
    windowTxByPeriod(transactions, period).forEach(t => {
      const day = t.date.slice(0, 10)
      const raw = bucket === 'month' ? monthKeys.indexOf(day.slice(0, 7)) : Math.floor(isoDayDiff(day, win.from) / (bucket === 'week' ? 7 : 1))
      const i = Math.min(rows.length - 1, Math.max(0, raw))
      rows[i].debit += t.debit
      rows[i].credit += t.credit
      rows[i].txs.push(t)
    })
    rows.forEach(r => r.txs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)))
    return rows
  }, [transactions, period])
  const totalDebit = data.reduce((s, p) => s + p.debit, 0)
  const totalCredit = data.reduce((s, p) => s + p.credit, 0)
  const netMovement = data.reduce((sum, p) => sum + normalSideDelta(account, p), 0)
  const active = data.filter(p => p.debit !== 0 || p.credit !== 0).length
  // Changing the window relabels the buckets, so a pin from the old one no longer
  // resolves and simply drops.
  const selectedRow = data.find(r => r.period === selected)
  /* Clicking the bar that is already open closes it, so the same gesture both
     asks the question and puts it away. The handler has to sit on the chart, not
     on each Bar: the chart clones its graphical children while laying them out
     and an `onClick` given to a Bar does not survive the clone. */
  const pick = (state: { activeLabel?: string }) => {
    const label = state?.activeLabel
    if (!label) return
    setSelected(prev => (prev === label ? null : label))
  }
  return (
    <>
      <WidgetPeriodHeader period={period} onChange={setPeriod} presets={['7d', '14d', '30d', '90d']} />
      {active === 0 ? (
        <ChartEmpty icon={BarChart3} title="No activity in this window" description="Widen the period, or add entries that post to this account." />
      ) : (
        <>
          <div style={{ height: chartH }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 5, right: 8, left: 0, bottom: 5 }}
                /* The pair sits tight and the gap goes between the buckets, so
                   the debit and its credit read as one reading rather than as two
                   series that happen to be adjacent. Left to its defaults Recharts
                   spends the same space on both. */
                barGap={2}
                barCategoryGap="28%"
                // Selecting a bar pins its entries below the chart. The hover stays
                // the plain debit/credit read - an entry list is too much to carry
                // on a passing cursor.
                onClick={pick}
                className="cursor-pointer"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(data.length / 8) - 1)} />
                <YAxis tickFormatter={(v: number) => fmtCompactMoney(v)} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip contentStyle={CM_TT_STYLE} formatter={(v: number) => fmtCurrency(v, base)} />
                <Bar dataKey="debit" fill="#0A77FF" radius={[4, 4, 0, 0]} maxBarSize={widgetBarSize(size)} name="Debits" />
                <Bar dataKey="credit" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={widgetBarSize(size)} name="Credits" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {selectedRow && selectedRow.txs.length > 0 && (
            <ActivityEntryPanel
              // Keyed on the bucket so moving from one bar to the next replays the
              // open rather than swapping the rows inside a panel that never moved.
              key={selectedRow.period}
              label={selectedRow.period}
              txs={selectedRow.txs}
              from={selectedRow.from}
              to={selectedRow.to}
              base={base}
              account={account}
              onOpenJe={setQuickJe}
              onClose={() => setSelected(null)}
            />
          )}
          {/* The footer answers whichever question is on screen: the window's
              totals, or - once a bar is picked - that bar's. Same three slots in
              the same order, so the reader watches one row be rewritten instead
              of hunting for a second set of figures somewhere else. */}
          <WidgetStatRow
            swapKey={selectedRow ? selectedRow.period : 'all'}
            stats={[
              { label: selectedRow ? 'Debits' : 'Total debits', value: fmtCurrency(selectedRow ? selectedRow.debit : totalDebit, base), color: '#0A77FF' },
              { label: selectedRow ? 'Credits' : 'Total credits', value: fmtCurrency(selectedRow ? selectedRow.credit : totalCredit, base), color: '#F59E0B' },
              /* Debits less credits is not the net movement of an account, it is
                 the net movement of a debit-normal account. Trade Payables read
                 Net -17,309 in a period its balance rose by exactly that, because
                 a liability grows on the credit side. */
              { label: 'Net', value: fmtCurrency(selectedRow ? normalSideDelta(account, selectedRow) : netMovement, base) },
            ]}
            trailing={size === 'sm' ? undefined : selectedRow ? (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-fg transition-colors cursor-pointer"
              >
                <RotateCcw size={11} className="shrink-0" />
                Back to totals
              </button>
            ) : (
              /* Nothing on the chart says a bar can be clicked, and a reader who
                 never tries it never learns the widget has a second half. */
              <span className="inline-flex items-center gap-1 text-[10.5px] text-[#94A3B8]">
                <MousePointerClick size={11} className="shrink-0" />
                Click a bar for its entries
              </span>
            )}
          />
        </>
      )}
      <JournalEntryQuickView jeNumber={quickJe} onClose={() => setQuickJe(null)} highlightAccountId={accountId} />
    </>
  )
}

// The Net change trend's hover card. A bar's height is a difference, which on its
// own a reader has to take on trust, so the card shows the two balances it came
// from and then the subtraction itself - closing less opening, with the actual
// figures - so the bar can be checked rather than believed.
//
// Recharts injects `active`, `payload` and `label`; `base` is ours. It needs
// custom content rather than a `formatter` because a formatter renders one line
// per series and this is four lines about a single series.
interface NetChangeTipDatum { period: string; movement: number; opening: number; closing: number }
function NetChangeTooltip({ base, active, payload }: {
  base: string
  active?: boolean
  payload?: { payload: NetChangeTipDatum }[]
}) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  return (
    <div className="rounded-lg border border-border bg-white shadow-md px-3 py-2.5 text-[12px]">
      <p className="text-fg" style={{ fontWeight: 600 }}>{d.period}</p>
      <div className="mt-2 space-y-1">
        <div className="flex items-baseline justify-between gap-6">
          <span className="text-fg-muted">Opening balance</span>
          <span className="tabular-nums text-fg" style={{ fontWeight: 500 }}>{fmtCurrency(d.opening, base)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-6">
          <span className="text-fg-muted">Closing balance</span>
          <span className="tabular-nums text-fg" style={{ fontWeight: 500 }}>{fmtCurrency(d.closing, base)}</span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-border flex items-baseline justify-between gap-6">
        <span className="text-fg-muted">Net change</span>
        <span className="tabular-nums" style={{ fontWeight: 600, color: d.movement > 0 ? '#059669' : d.movement < 0 ? '#DC2626' : undefined }}>
          {fmtCurrency(d.movement, base)}
        </span>
      </div>
      {/* The identity spelled out. Sign-aware wording is not worth it here: the
          figures are right there, so "closing less opening" reads correctly even
          when both are negative. */}
      <div className="mt-1 text-[11px] text-fg-subtle tabular-nums">
        {fmtCurrency(d.closing, base)} − {fmtCurrency(d.opening, base)}
      </div>
    </div>
  )
}

// Net Change Trend - a monthly-only bar chart of the account's net movement
// each accounting period. Net change is a single value per month (closing minus
// opening), which makes it inherently a time series rather than a snapshot -
// hence a trend widget rather than a KPI. Bars carry sign colour (green when
// the account moved in its natural direction, red when it moved against).
// Months after the current one are not charted at all, so the last bar is
// always month-to-date rather than a short month standing next to full ones.
function NetChangeTrendBody({ account, transactions, base }: { account: Account; transactions: Transaction[]; base: string }) {
  const size = useWidgetSize()
  const chartH = useWidgetChartH()
  const periods = useStore(s => s.periods)
  const seededOpening = useStore(s => s.seedQ1Openings[account.id] ?? 0)
  const [period, setPeriod] = useState<PeriodValue>({ kind: 'preset', preset: '12m' })
  const today = todayIso()
  const { rows: allRows } = useMemo(
    () => monthlyBalancesThrough(account, transactions, seededOpening, periods, today),
    [account, transactions, seededOpening, periods, today],
  )
  const rows = useMemo(() => windowMonthlyByPeriod(allRows, period), [allRows, period])
  const data = useMemo(
    () => rows.map(r => ({
      period: r.period.label,
      movement: r.movement,
      // Carried for the tooltip only - the bar is the movement. They are what
      // makes the movement checkable: closing less opening is the bar's height.
      opening: r.opening,
      closing: r.closing,
      // Positive = account moved in its natural direction (green); negative =
      // moved against it (red). A zero month uses the muted slate rest colour
      // so the empty bar reads as "flat" rather than either polarity.
      fill: r.movement > 0 ? '#059669' : r.movement < 0 ? '#DC2626' : '#CBD5E1',
    })),
    [rows],
  )
  const positiveMonths = data.filter(d => d.movement > 0).length
  const negativeMonths = data.filter(d => d.movement < 0).length
  const anyMovement = data.some(d => d.movement !== 0)
  return (
    <>
      <WidgetPeriodHeader period={period} onChange={setPeriod} presets={['3m', '6m', '12m']} granularity="month" />
      {rows.length === 0 || !anyMovement ? (
        <ChartEmpty icon={TrendingUp} title="No monthly movement yet" description="Once postings land in a period, that month's net change will chart here." />
      ) : (
        <>
          <div style={{ height: chartH }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.ceil(data.length / 8) - 1)} />
                <YAxis tickFormatter={(v: number) => fmtCompactMoney(v)} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={54} />
                <ReferenceLine y={0} stroke="#94A3B8" strokeDasharray="2 4" />
                <Tooltip content={<NetChangeTooltip base={base} />} />
                {/* Wider than the debit/credit chart's bar because one series
                    has the row to itself, but it thins at Small on the same
                    rule. */}
                <Bar dataKey="movement" radius={[4, 4, 4, 4]} maxBarSize={widgetBarSize(size, 32)}>
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <WidgetStatRow
            stats={[
              { label: 'Positive months', value: fmtNumber(positiveMonths), color: '#059669' },
              { label: 'Negative months', value: fmtNumber(negativeMonths), color: '#DC2626' },
            ]}
          />
        </>
      )}
    </>
  )
}

// Rich empty state for the chart widgets - an accent icon tile, a bold title,
// and a muted description, matching the Partner module's "No payment methods"
// empty card. Fills the card body so the chrome stays consistent.
function ChartEmpty({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8">
      <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h4 className="text-sm font-semibold text-fg">{title}</h4>
      <p className="mt-1 text-xs text-fg-subtle max-w-[260px] leading-relaxed">{description}</p>
    </div>
  )
}

// Strip a parenthetical like "(You)" and derive up-to-2-letter initials.
const cleanName = (name: string) => name.replace(/\s*\(.*?\)\s*/g, '').trim() || name
const initialsOf = (name: string) => {
  // Alphanumeric words only, so symbols ("/", "&") never become an initial.
  const parts = cleanName(name).split(/[^A-Za-z0-9]+/).filter(Boolean)
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0] ?? 'U').slice(0, 2)).toUpperCase()
}
// Partner-detail avatar palette, a deterministic colour per name.
const AVATAR_COLORS = ['#0A77FF', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2', '#4F46E5', '#BE185D', '#15803D', '#9333EA']
const avatarColor = (name: string) => {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}


// =========================
// Summary account
// =========================
// A summary account holds nothing itself. Its figure is the total of the
// accounts under it, so its analytics are the aggregate of every posting account
// anywhere beneath it (the analytics spec).
interface RollupGroup {
  /** The span of numbers the accounts under this one occupy. */
  rangeFrom: string
  rangeTo: string | null
  /** Every account beneath, at any depth, summaries included. */
  members: Account[]
  /** Every posting account beneath, at any depth. */
  postingMembers: Account[]
  counts: { postings: number }
  totalOpening: number
  totalClosing: number
  /** The running balance: the total as it stands today, whatever the period. */
  totalCurrent: number
}

// Membership and figures both come from the one chart index, so this page cannot
// disagree with the chart about what rolls into the row. The totals are read off
// the index rather than re-summed here for exactly that reason.
function useRollupGroup(account: Account): RollupGroup {
  const index = usePeriodScopedChart()
  return useMemo(() => {
    const beneath = index.descendantsOf(account.id)
    // What the total sums: every account beneath, an archived one included for
    // the period it still has figures in (see computeChartIndex). One with none
    // adds nothing, and is left off the list as the chart leaves it off.
    const postingMembers = beneath.filter(a => a.isPosting && !(a.status === 'Archived' && !carriesPeriodFigures(a)))
    const { balance, netChange, current } = index.figuresOf(account.id)
    /* Read off what the summary actually totals. It reserves no block of numbers,
       so there is nothing else this span could be. */
    const numbers = beneath.map(d => d.accountNumber).sort()
    return {
      rangeFrom: numbers[0] ?? account.accountNumber,
      rangeTo: numbers.length > 1 ? numbers[numbers.length - 1] : null,
      members: beneath,
      postingMembers,
      counts: { postings: postingMembers.length },
      totalOpening: balance - netChange,
      totalClosing: balance,
      totalCurrent: current,
    }
  }, [index, account])
}

// The summary detail page shares the posting Dashboard's insights strip: a
// period selector plus a customizable KPI/widget set. There is one kind of
// rollup line now, so both catalogues are module constants rather than functions
// of the line's own type.
const ROLLUP_KPI_CATALOG: DetailKpiDef[] = [
  /* No Number range tile. Mahad, 2026-09-22: *"remove number range KPI."* The
     span is stated in the rail a few inches to the right, and it is not a figure
     the page is read for - the tiles are what this line totals, and a range is
     not a total. */
  // Labelled "Total …" because every figure here is the sum across the posting
  // accounts beneath, not a balance the line itself holds. Net change is one
  // value per period, so it belongs to the trend widget rather than a tile.
  { key: 'balance', label: 'Total running balance', description: 'Shows the combined running balance of all accounts.', category: 'Balance' },
  { key: 'opening', label: 'Total opening balance', description: 'Shows the combined opening balance of all accounts at the start of the selected period.', category: 'Balance' },
  /* No Posting accounts tile. The count is not a figure this page is read for -
     it sits in the Running Balance by account widget's footer, beside the total
     it counts the parts of, and the Accounts tab lists the accounts themselves.
     A tile of its own made it a headline the page never earned. */
]
const ROLLUP_DEFAULT_KPIS = ROLLUP_KPI_CATALOG.map(k => k.key)

const ROLLUP_WIDGET_CATALOG: DetailWidgetDef[] = [
  { key: 'trend', label: 'Total running balance trend', description: 'Shows the trend of the combined running balance of all accounts over the selected period.', category: 'Charts', icon: TrendingUp, previewType: 'area' },
  // Where the total sits, account by account. The old "Accounts in this total"
  // list moved to the Accounts tab, which draws the full nested chart; the widget
  // keeps only the thing a chart says better than a list - which account carries
  // the most - so the two surfaces answer different questions instead of the same
  // one twice.
  { key: 'contribution', label: 'Running Balance by account', description: 'Shows each posting account’s share of the total, highlighting the one that holds the most.', category: 'Charts', icon: PieChartIcon, iconBg: '#F5F3FF', iconColor: '#7C3AED', previewType: 'pie' },
]
const ROLLUP_DEFAULT_WIDGETS = ROLLUP_WIDGET_CATALOG.map(w => w.key)

// Slice/legend colour by rank: the largest takes the primary so it reads as the
// answer to "which holds the most", the rest rotate the shared chart palette.
// Kept in one place so the ring and its legend can never disagree on a colour.
const pieSliceColor = (rank: number) =>
  rank === 0 ? 'hsl(var(--primary))' : CHART_PALETTE[(rank + 1) % CHART_PALETTE.length]

/* Each posting account's share of the total, as a donut with its legend beside
   it - the same shape the Partners spend-by-category widget uses: ring on the
   left with the total in its hole, a colour-keyed list on the right reading the
   accounts largest-first. The largest takes the primary colour and leads the
   list, so "which holds the most" is answered by the chart itself rather than a
   separate callout.

   A body rather than a card of its own: the widget row frames it, so it resizes
   with the reader's Small/Medium/Large the way every other widget in the module
   does. The ring reads its square off `WIDGET_PIE` for the same reason a trend
   reads its height off `WIDGET_CHART_H`. */
function RollupContributionBody({ group, index, base }: { group: RollupGroup; index: ChartIndex; base: string }) {
  const size = useWidgetSize()
  const pie = useWidgetPie()
  const small = size === 'sm'
  const { slices, spread } = useMemo(() => {
    // Share is taken on magnitude, as the retired list took it: a contra account
    // pulls the total down, and a negative slice reads as a fault rather than a
    // fact. The signed figure still rides the stat row, so nothing is hidden.
    const items = group.postingMembers
      .map(a => ({ account: a, balance: index.figuresOf(a.id).current }))
      .filter(x => Math.abs(x.balance) > 0.005)
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
    const spread = items.reduce((s, x) => s + Math.abs(x.balance), 0)
    /* Every account under the line gets its own slice and its own row. Mahad,
       2026-09-22: *"there is no such thing as a smaller accounts. We need full
       list as now we have a scroll."* The tail used to ride together as one grey
       slice because the legend could not grow; the list scrolls now, and a row
       named "31 smaller accounts" is a row the reader cannot open or check. */
    const slices = items.map(x => ({
      id: x.account.id,
      number: x.account.accountNumber,
      name: x.account.accountName,
      value: Math.abs(x.balance),
      balance: x.balance,
    }))
    return { slices, spread }
  }, [group.postingMembers, index])

  /* One hovered slice, set from either side: the ring pushes its sector out and
     the legend row behind it lights up, and hovering the row does the same thing
     from the other end. With the list scrolling, a row can sit off-screen from
     the slice it names, so the pairing has to be pointable in both directions. */
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const legendRef = useRef<HTMLUListElement>(null)

  /* A slice hovered on the ring can name a row that is scrolled out of the list,
     and a highlight nobody can see is no answer. The list is brought to the row
     rather than the page to the list - scrollIntoView would take the whole page
     with it. */
  const highlightFromRing = useCallback((i: number) => {
    setActiveIdx(i)
    const ul = legendRef.current
    const row = ul?.children[i] as HTMLElement | undefined
    if (!ul || !row) return
    const r = row.getBoundingClientRect(), u = ul.getBoundingClientRect()
    if (r.top < u.top) ul.scrollTop -= u.top - r.top
    else if (r.bottom > u.bottom) ul.scrollTop += r.bottom - u.bottom
  }, [])

  /* Every prop the ring is given has to keep its identity between renders, or it
     never animates in. The chart compares its children shallowly and, when they
     differ, hands the Pie a fresh animationId; the Pie reads that as "the data
     moved", copies the sectors it already drew into prevSectors, finds them
     equal to the ones it is about to draw and renders the ring statically. An
     inline arrow is enough to trip that, so the first stray re-render after
     mount - the store finishing its read, the widget row measuring itself -
     silently swallowed the sweep. */
  const ringLeave = useCallback(() => setActiveIdx(null), [])
  const ringEnter = useCallback((_: unknown, i: number) => highlightFromRing(i), [highlightFromRing])
  const ringActiveShape = useCallback(
    // The pushed-out sector reaches into the 2px the ring gave up above, so the
    // highlight never crosses the square's edge.
    (p: any) => <Sector {...p} outerRadius={p.outerRadius + 4} />,
    [],
  )

  if (slices.length === 0 || spread === 0) {
    return <ChartEmpty icon={PieChartIcon} title="No balances to chart yet" description="No posting account under this one carries a balance yet. Each account’s share of the total will chart here once they do." />
  }

  // A share under ten needs the decimal place to stay distinguishable from the
  // one beside it; over ten the decimal is noise. Same rule as the Cash
  // Management donut. The floor is the part this page needed: with every account
  // listed, the smallest round to "0.0%" - a share of nothing, printed beside a
  // balance that is plainly something.
  const pct = (v: number) => {
    const n = (v / spread) * 100
    if (n >= 10) return `${n.toFixed(0)}%`
    return n < 0.05 ? '<0.1%' : `${n.toFixed(1)}%`
  }
  return (
    <>
      {/* The chart takes the slack: it centres in whatever height the card is
          stretched to beside the taller trend widget, leaving the stat row to
          sit flush at the bottom rather than floating under a gap. */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="flex items-center gap-4">
          {/* Ring on the left, its hole carrying the total the slices add up to. A
              fixed square with an overlaid centre, the way the Partners donut is
              drawn, rather than a responsive box a legend would have to share. */}
          <div className="shrink-0 relative" style={{ width: pie.box, height: pie.box }}>
            <PieChart width={pie.box} height={pie.box}>
              <Pie
                data={slices} dataKey="value" nameKey="name" cx="50%" cy="50%"
                innerRadius={pie.inner} outerRadius={pie.outer}
                /* The gap has to come out of the ring, so it cannot stay fixed
                   once every account has a slice: 1.5° across forty of them is a
                   sixth of the circle spent on gaps, and the small slices vanish
                   into them. It closes as the list grows. */
                paddingAngle={Math.min(1.5, 24 / slices.length)} stroke="none"
                isAnimationActive
                animationDuration={700}
                animationBegin={0}
                activeIndex={activeIdx ?? undefined}
                activeShape={ringActiveShape}
                onMouseEnter={ringEnter}
                onMouseLeave={ringLeave}
              >
                {slices.map((s, i) => (<Cell key={s.id} fill={pieSliceColor(i)} />))}
              </Pie>
              {/* No hover tooltip: the legend beside the ring already names the
                  account and states its balance and share, and the highlight
                  pairs the row with its slice. A tooltip would repeat all three
                  and cover the list it was repeating. */}
            </PieChart>
            {/* Inert, so a hover falls through to the ring underneath and the
                slice's tooltip still opens over the centre. */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-1">
              {/* The hole empties at Small. It is 60px across there and the total
                  runs to eleven characters, so the figure spilled over its own
                  ring - and the rule below forbids shortening it to fit. Nothing
                  is lost: the stat row under the ring leads with Total at every
                  size, so Small states it once instead of twice. */}
              {!small && <span className="text-[9px] uppercase tracking-wide text-slate-400" style={{ fontWeight: 600 }}>Total</span>}
              {/* The figure in full, the way the Total running balance KPI states
                  it above. Mahad, 2026-09-21: *"The current running balance should
                  match the total in the balance by account."* It used to be
                  compacted to fit the hole, so the same total read $1.9M here and
                  $1,927,800 a few inches up the page - two figures a reader has to
                  reconcile before trusting either. The hole is sized to the
                  number now, rather than the number to the hole. */}
              {!small && <span className="text-[11px] text-slate-700 tabular-nums whitespace-nowrap" style={{ fontWeight: 700 }}>{fmtCurrency(group.totalCurrent, base)}</span>}
            </div>
          </div>
          {/* Legend on the right, largest-first. The lead row - the account holding
              the most - carries the primary colour and a heavier weight, so the
              highlight lives in the reading order, not a banner of its own.

              Mahad, 2026-09-22: *"the percentages dont make any sense, we need
              acctual numbers (money) to be displayed there."* A share read on its
              own says nothing a reader can check against the rest of the page, so
              the balance leads and the percentage trails it, muted - the shape the
              Cash Management spend donut already uses. */}
          {/* As tall as the ring beside it, whatever size that is, so the pair
              reads as one block and the scroll starts where the ring ends. */}
          <ul ref={legendRef} className="flex-1 min-w-0 space-y-0.5 overflow-y-auto pr-1" style={{ maxHeight: pie.box }}>
            {slices.map((s, i) => (
              <li
                key={s.id}
                className={cn('flex items-center justify-between gap-2 rounded px-1 py-0.5 transition-colors', activeIdx === i && 'bg-slate-50')}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(null)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pieSliceColor(i) }} />
                  <span className={cn('text-[11px] truncate', i === 0 ? 'text-slate-700' : 'text-muted-foreground')} style={{ fontWeight: i === 0 ? 600 : 500 }}
                        title={s.number ? `${s.number} ${s.name}` : s.name}>
                    {s.number ? <><span className="tabular-nums">{s.number}</span> {s.name}</> : s.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={cn('text-[11px] tabular-nums', i === 0 ? 'text-primary' : 'text-slate-600')} style={{ fontWeight: i === 0 ? 700 : 600 }}>{fmtCurrency(s.balance, base)}</span>
                  <span className="text-[10px] tabular-nums text-slate-400 w-9 text-right" style={{ fontWeight: 500 }}>{pct(s.value)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {/* Mahad, 2026-09-21: *"remove largest from this widget."* The legend already
          reads largest-first, in the primary colour, with the account's name beside
          its share - a stat repeating its number said the same thing worse. */}
      <WidgetStatRow
        stats={[
          { label: 'Total', value: fmtCurrency(group.totalCurrent, base) },
          { label: 'Posting accounts', value: fmtNumber(group.counts.postings) },
        ]}
      />
    </>
  )
}

/* The combined running balance over time. A body rather than a card for the same
   reason the donut beside it is one: the row frames both, so both answer the
   reader's Small/Medium/Large. Its chart was pinned at 184px, which is neither
   of the three heights the toggle offers. */
function RollupTrendBody({ empty, period, onPeriod, data }: {
  empty: boolean
  period: PeriodValue
  onPeriod: (next: PeriodValue) => void
  data: { date: string; balance: number }[]
}) {
  const chartH = useWidgetChartH()
  if (empty) {
    return <ChartEmpty icon={TrendingUp} title="No accounts roll up yet" description="No posting accounts sit under this one yet. The total will chart here once they're added." />
  }
  return (
    <>
      <WidgetPeriodHeader period={period} onChange={onPeriod} presets={['7d', '14d', '30d', '90d']} />
      <ChartBox height={chartH}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs><linearGradient id="rollupTrendGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.01} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={isoLabel} />
          <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`} />
          <Tooltip contentStyle={CHART_TT_STYLE} labelFormatter={(l: string) => isoLabel(l)} formatter={(val: number) => [fmtCurrency(val), 'Total running balance']} />
          <Area type="monotone" dataKey="balance" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#rollupTrendGrad)" />
        </AreaChart>
      </ChartBox>
    </>
  )
}

function RollupOverview({ account }: { account: Account }) {
  const chartIndex = usePeriodScopedChart()
  const base = useStore(s => s.company.baseCurrency)
  const allTx = useStore(s => s.transactions)
  const periods = useStore(s => s.periods)
  const fiscalYearStart = useStore(s => s.company.fiscalYearStart)
  const g = useRollupGroup(account)
  const today = todayIso()
  // The opening of the period picked in the strip, as the listing prints it for
  // this summary. g.totalOpening is the fiscal-year opening - it anchors the
  // closing balance trend and is a different figure, so the tile can't borrow it
  // without contradicting the period strip.
  const selectedPeriod = useSelectedPeriod()
  const totalPeriodOpening = useMemo(() => {
    const f = chartRowValues(account, chartIndex)
    return f ? f.balance - f.netChange : 0
  }, [account, chartIndex])
  const createdBy = account.createdBy || '-'
  /* The reservation wins over the observation. A summary that reserves 1000-1999
     is stating what belongs on it - so the field reads that, whether the
     accounts inside occupy all of it or half of it. The span the descendants
     actually cover is the fallback, for a summary that reserves nothing. */
  const reservedRange = accountRange(account)
  /* With number protection on, the span a summary with no range occupies is not
     just observed - it is kept for its accounts (design review, 2026-09-24). */
  const protectedSpan = useStore(s => numberProtectionOn(s.company))
  const rangeText = reservedRange
    ? formatRange(reservedRange)
    : g.rangeTo ? `${g.rangeFrom}–${g.rangeTo}` : g.rangeFrom

  // Total closing balance trend - a running total built by walking every posting inside the
  // group, anchored on the group's opening balance so it ends at the closing
  // subtotal. Falls back to two synthetic points when there's no history.
  const [trendPeriod, setTrendPeriod] = useState<PeriodValue>(DEFAULT_PERIOD)
  // One point per calendar day carrying that day's *ending* subtotal, so days
  // with several postings collapse to a single step instead of jittering the
  // curve. Transactions are walked in date order and the last write for a day
  // wins (Map keeps insertion/chronological order).
  const subtotalSeries = useMemo(() => {
    // Each posting counts on its own account's normal side, not the summary's: a
    // summary spans accounts that grow on different sides, and its opening and
    // closing are already the normal-side rollup this curve has to land on.
    const members = new Map(g.postingMembers.map(a => [a.id, a]))
    const tx = allTx.filter(t => members.has(t.accountId)).sort((a, b) => +new Date(a.date) - +new Date(b.date))
    const byDay = new Map<string, number>()
    let bal = g.totalOpening
    tx.forEach(t => { bal += normalSideDelta(members.get(t.accountId)!, t); byDay.set(t.date.slice(0, 10), bal) })
    const out = [...byDay.entries()].map(([date, balance]) => ({ date, balance }))
    // Fiscal year start to today, never fixed dates - the same reason as the posting
    // page's two series fallbacks: a literal end date silently becomes a future one.
    return out.length > 1 ? out : [{ date: fiscalYearStart, balance: g.totalOpening }, { date: today, balance: g.totalClosing }]
  }, [allTx, g.postingMembers, g.totalOpening, g.totalClosing, fiscalYearStart, today])
  const trendDisplay = useMemo(() => windowSeriesByPeriod(subtotalSeries, trendPeriod), [subtotalSeries, trendPeriod])

  // Insights strip state - period + customizable KPI/widget set, persisted per
  // account, mirroring the posting Dashboard so both detail templates match.
  // v3: Total Net Change was removed from the catalogue (it's one value per month,
  // so the trend widget is its home). v4: Composition was parked. v5: Composition
  // was back. v6: Composition removed for good. v7: Number range removed. v8:
  // Composition back, listing the accounts rather than charting them. v9: Number
  // range back. v10: the account list left for its own tab and the widget became
  // a Balance-by-account donut (key 'composition' -> 'contribution'). v11: the
  // Posting accounts tile was retired. v12: the Number range tile went the same
  // way, and the widgets gained a Small/Medium/Large of their own. Each bump
  // retires stored orders so the new default is what a reader actually sees -
  // without it a returning reader keeps a retired key in their saved set, which
  // renders nothing but leaves Reset lit as though they had customised the page,
  // and never meets a key added since.
  const storageBase = `coa.account.${account.id}.rollupInsights.v12`
  const [activeKpis, setActiveKpis] = useState<string[]>(() => readStored<string[]>(`${storageBase}.activeKpis`, ROLLUP_DEFAULT_KPIS))
  const [activeWidgets, setActiveWidgets] = useState<string[]>(() => readStored<string[]>(`${storageBase}.activeWidgets`, ROLLUP_DEFAULT_WIDGETS))
  const [widgetSizes, setWidgetSizes] = useState<Record<string, WidgetSize>>(() => readStored<Record<string, WidgetSize>>(`${storageBase}.widgetSizes`, {}))
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => { try { localStorage.setItem(`${storageBase}.activeKpis`, JSON.stringify(activeKpis)) } catch { /* ignore */ } }, [activeKpis, storageBase])
  useEffect(() => { try { localStorage.setItem(`${storageBase}.activeWidgets`, JSON.stringify(activeWidgets)) } catch { /* ignore */ } }, [activeWidgets, storageBase])
  useEffect(() => { try { localStorage.setItem(`${storageBase}.widgetSizes`, JSON.stringify(widgetSizes)) } catch { /* ignore */ } }, [widgetSizes, storageBase])

  const toggleKpi = (key: string) => setActiveKpis(p => (p.includes(key) ? p.filter(k => k !== key) : [...p, key]))
  const toggleWidget = (key: string) => setActiveWidgets(p => (p.includes(key) ? p.filter(k => k !== key) : [...p, key]))
  const resetInsights = () => { setActiveKpis(ROLLUP_DEFAULT_KPIS); setActiveWidgets(ROLLUP_DEFAULT_WIDGETS); setWidgetSizes({}) }
  const isDefault =
    activeKpis.length === ROLLUP_DEFAULT_KPIS.length && activeKpis.every((k, i) => k === ROLLUP_DEFAULT_KPIS[i]) &&
    activeWidgets.length === ROLLUP_DEFAULT_WIDGETS.length && activeWidgets.every((k, i) => k === ROLLUP_DEFAULT_WIDGETS[i]) &&
    Object.keys(widgetSizes).length === 0
  const moveKpi = useCallback((from: number, to: number) => setActiveKpis(prev => {
    const next = [...prev]; const [m] = next.splice(from, 1); next.splice(to, 0, m); return next
  }), [])
  const moveWidget = useCallback((from: number, to: number) => setActiveWidgets(prev => {
    const next = [...prev]; const [m] = next.splice(from, 1); next.splice(to, 0, m); return next
  }), [])
  const setWidgetSize = useCallback((key: string, size: WidgetSize) => setWidgetSizes(prev => ({ ...prev, [key]: size })), [])

  const enabledWidgetKeys = useMemo(
    () => activeWidgets.filter(k => ROLLUP_WIDGET_CATALOG.some(w => w.key === k)),
    [activeWidgets])

  const enabledKpiDefs = useMemo(
    () => activeKpis.map(k => ROLLUP_KPI_CATALOG.find(c => c.key === k)).filter(Boolean) as typeof ROLLUP_KPI_CATALOG,
    [activeKpis])

  // The balance tiles carry the date they're actually struck on, which the
  // Insights picker has no say in: the running total is as at the last posting
  // anywhere inside the line, the opening as at the accounting period's start.
  // Deriving these from the picker made the caption move while the number stayed
  // put.
  const lastGroupTx = useMemo(() => {
    const ids = new Set(g.postingMembers.map(a => a.id))
    return allTx.filter(t => ids.has(t.accountId)).reduce<Transaction | undefined>(
      (best, t) => (!best || t.date > best.date ? t : best), undefined)
  }, [allTx, g.postingMembers])
  const runningAsOf = balanceStruckLabel(lastGroupTx && fmtDate(lastGroupTx.date), g.totalCurrent)
  const openingAsOf = selectedPeriod.startDate ? `As of ${fmtDate(selectedPeriod.startDate)}` : undefined
  const kpiValue = (key: string): { value: ReactNode; subDetail?: string } => {
    switch (key) {
      case 'balance': return { value: fmtCurrency(g.totalCurrent, base), subDetail: runningAsOf }
      case 'opening': return { value: fmtCurrency(totalPeriodOpening, base), subDetail: openingAsOf }
      default: return { value: '-' }
    }
  }
  const kpiPreview = (key: string): string => {
    switch (key) {
      case 'balance': return fmtCurrency(g.totalCurrent, base)
      case 'opening': return fmtCurrency(totalPeriodOpening, base)
      default: return '-'
    }
  }
  return (
    <div className="space-y-3">
      {/* A summary that is no longer active has stopped totalling, so the chart
          prints no figure on its row. Saying so here stops the page's own tiles
          reading as a data error. */}
      {!showsSummaryTotal(account) && (
        <Banner tone="warning" title={`This account is ${account.status.toLowerCase()}, so it shows no total in the chart.`}>
          The figures below are what it would total if it were active. The accounts in {rangeText} keep posting normally.
        </Banner>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 items-start">
        {/* LEFT - KPIs and the subtotal trend */}
        <div className="min-w-0 space-y-3">
          {/* The one control that says what these figures are read against, as on
              the posting template. */}
          <PeriodStrip periods={periods} fiscalYearStart={fiscalYearStart} variant="standalone" hint={ACCOUNT_PERIOD_HINT} />
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Insights</h4>
            <button
              onClick={() => setPanelOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] text-primary hover:bg-accent transition-colors cursor-pointer shrink-0"
              style={{ fontWeight: 500 }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Insights
            </button>
          </div>

          {/* One provider for both rows. Two HTML5Backend instances in a single
              tree throw, and the KPI row and the widget row each drag. */}
          <DndProvider backend={HTML5Backend}>
            {enabledKpiDefs.length > 0 && (
              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {enabledKpiDefs.map((kpi, i) => {
                  const { value, subDetail } = kpiValue(kpi.key)
                  return (
                    <DraggableKpiCard
                      key={kpi.key}
                      index={i}
                      kpiKey={kpi.key}
                      label={kpi.label}
                      value={value}
                      subDetail={kpi.key === 'balance' || kpi.key === 'opening' ? subDetail : undefined}
                      tooltip={kpi.description}
                      moveCard={moveKpi}
                      onRemove={() => toggleKpi(kpi.key)}
                    />
                  )
                })}
              </div>
            )}

            {/* The same row the posting template uses: two half-width widgets
                side by side, either taking the full row at Large. The trend
                reads the total over time, the donut reads where that total sits
                right now, and a reader comparing them wants both on one line. */}
            {enabledWidgetKeys.length > 0 && (
              <div className="flex flex-wrap gap-3 items-stretch min-w-0 mt-3">
                {enabledWidgetKeys.map((wKey, i) => {
                  const meta = ROLLUP_WIDGET_CATALOG.find(w => w.key === wKey)
                  if (!meta) return null
                  const sz: WidgetSize = widgetSizes[wKey] ?? 'md'
                  return (
                    <div
                      key={wKey}
                      style={{ width: sz === 'lg' ? '100%' : 'calc(50% - 6px)' }}
                      className="transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] h-auto self-stretch"
                    >
                      <DraggableWidgetCard widgetKey={wKey} index={i} moveWidget={moveWidget}>
                        {(isDragging, isOver) => (
                          <WidgetContentCard
                            title={meta.label}
                            tooltip={meta.description}
                            icon={meta.icon}
                            iconBg={meta.iconBg}
                            iconColor={meta.iconColor}
                            currentSize={sz}
                            onSizeChange={s => setWidgetSize(wKey, s)}
                            onRemove={() => toggleWidget(wKey)}
                            isDragging={isDragging}
                            isOver={isOver}
                          >
                            {wKey === 'trend' && (
                              <RollupTrendBody
                                empty={g.postingMembers.length === 0}
                                period={trendPeriod}
                                onPeriod={setTrendPeriod}
                                data={trendDisplay}
                              />
                            )}
                            {wKey === 'contribution' && (
                              <RollupContributionBody group={g} index={chartIndex} base={base} />
                            )}
                          </WidgetContentCard>
                        )}
                      </DraggableWidgetCard>
                    </div>
                  )
                })}
              </div>
            )}
          </DndProvider>

          <DetailInsightsPanel
            open={panelOpen}
            onOpenChange={setPanelOpen}
            kpis={ROLLUP_KPI_CATALOG}
            widgets={ROLLUP_WIDGET_CATALOG}
            activeKpis={activeKpis}
            activeWidgets={activeWidgets}
            onToggleKpi={toggleKpi}
            onToggleWidget={toggleWidget}
            onReset={resetInsights}
            isDefault={isDefault}
            kpiPreview={kpiPreview}
          />
        </div>

        {/* RIGHT - GL Account Information rail */}
        <div className="space-y-3.5 min-w-0 overflow-hidden xl:sticky xl:top-[160px]">
          <DashInfoCard title="GL account information" icon={FileText}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-2.5">
              <div className="min-w-0">
                <DashInfoLabel>GL account no.</DashInfoLabel>
                <p className="text-[12.5px] text-slate-700 truncate" style={{ fontWeight: 600 }}>{account.accountNumber}</p>
              </div>
              <div className="min-w-0">
                <DashInfoLabel>GL account category</DashInfoLabel>
                <div className="mt-0.5"><CategoryCell meta={ACCOUNT_TYPE_META[account.accountType as AccountType]} /></div>
              </div>
            </div>
            {/* Stated here as well as on the header badge, which is what the
                posting account's rail does - and the listing ships the column on,
                so a reader who scanned it there has to find it here. Not on a
                category account: it spans both sides of the current line, so it
                has no one classification, and the row saying so was dropped.
                Mahad, 2026-09-30: *"Remove ... this but only from the 5 category
                accounts only."* */}
            {!isCategoryRoot(account) && (
              <div className="mb-2.5 min-w-0">
                <DashInfoLabel tooltip={`Which line of the statement this account prints on. A summary and the accounts under it always agree, so moving an account moves this too. ${CLASSIFICATION_DESCRIPTIONS[account.statementClassification]}`}>Statement classification</DashInfoLabel>
                <p className="text-[12.5px] text-slate-700 mt-0.5" style={{ fontWeight: 600 }}>{account.statementClassification}</p>
              </div>
            )}
            {/* Same placement as the posting account's rail: category, then the
                account this one sits under. */}
            <ParentField account={account} index={chartIndex} className="mb-2.5" />
            <ProvenanceField account={account} className="mb-2.5" />
            <RestrictedField account={account} className="mb-2.5" />
            <div className="mb-2.5">
              <DashInfoLabel>GL account name</DashInfoLabel>
              <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{account.accountName}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-2.5">
              <div className="min-w-0">
                <DashInfoLabel rich tooltip={<GLTypeLegend />}>GL account type</DashInfoLabel>
                <div className="mt-0.5"><Badge tone={GL_TYPE_TONE[account.glAccountType] ?? 'neutral'}>{account.glAccountType}</Badge></div>
              </div>
              <div className="min-w-0">
                <DashInfoLabel>Status</DashInfoLabel>
                <div className="mt-0.5"><StatusChip status={account.status} /></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-2.5">
              <div className="min-w-0">
                <DashInfoLabel tooltip={protectedSpan
                  ? "The block of numbers this account reserves. With none reserved, number protection keeps the span from this account to its last one for its own accounts. Set a range on the edit form."
                  : "The block of numbers this account reserves, or the span its accounts happen to occupy when it reserves none. Set it on the edit form."}>Number range</DashInfoLabel>
                <p className="text-[12px] text-slate-700 truncate tabular-nums" style={{ fontWeight: 500 }}>{rangeText}{!reservedRange && <span className="ml-1.5 text-[11px] text-slate-400" style={{ fontWeight: 400 }}>{protectedSpan ? "kept by number protection" : "observed"}</span>}</p>
              </div>
              {/* A summary takes its side from its category the same way a posting
                  account does, and the listing ships the column on for both. It
                  was on the posting rail only, so the one page that could not
                  answer "which side does this total grow on" was the totals page. */}
              <div className="min-w-0">
                <DashInfoLabel rich align="right" tooltip={<NormalBalanceHelp normalBalance={account.normalBalance} isContra={account.isContra} />}>Normal balance</DashInfoLabel>
                <p className="text-[12.5px] text-slate-700 mt-0.5" style={{ fontWeight: 600 }}>{account.normalBalance}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-2.5">
              <div className="min-w-0">
                {/* "Currency", as the listing column and the posting account's
                    rail both call it. "Base currency" named the company's
                    reporting currency somewhere else in the app, and this is the
                    account's own. */}
                <DashInfoLabel>Currency</DashInfoLabel>
                <div className="mt-0.5"><CurrencyCell code={account.currencyCode} /></div>
              </div>
              <div className="min-w-0">
                {/* See the posting card: `createdAt`, the field the Activity
                    tab reads, not the effective date. */}
                <DashInfoLabel>Created on</DashInfoLabel>
                <p className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{account.createdAt ? fmtDate(account.createdAt) : '-'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-2.5 border-t border-muted">
              <div className="min-w-0">
                <DashInfoLabel>Created by</DashInfoLabel>
                {account.createdBy ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] shrink-0" style={{ backgroundColor: avatarColor(createdBy), fontWeight: 600 }}>{initialsOf(createdBy)}</div>
                    <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{cleanName(createdBy)}</span>
                  </div>
                ) : <p className="text-[12px] text-slate-400 mt-0.5">-</p>}
              </div>
              <div className="min-w-0">
                <DashInfoLabel>Last updated</DashInfoLabel>
                <p className="text-[12px] text-slate-700 mt-0.5 truncate" style={{ fontWeight: 500 }}>{account.updatedAt ? fmtDate(account.updatedAt) : '-'}</p>
              </div>
              {account.updatedBy && (
                <div className="min-w-0">
                  <DashInfoLabel>Last updated by</DashInfoLabel>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] shrink-0" style={{ backgroundColor: avatarColor(account.updatedBy), fontWeight: 600 }}>{initialsOf(account.updatedBy)}</div>
                    <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{cleanName(account.updatedBy)}</span>
                  </div>
                </div>
              )}
              <InternalIdField id={account.internalId} help={INTERNAL_ID_HELP} />
            </div>
          </DashInfoCard>
        </div>
      </div>
    </div>
  )
}


// =========================
// Accounts (the summary's subtree)
// =========================
/* The accounts that make up a summary's total, drawn the way the chart draws
   them: the same nested tree, the same columns, the same search / filters /
   column controls the main page carries, the summary itself heading its own
   subtree the way a category root heads its category on the main page.

   Two things it does not carry, on purpose: no Actions menu and no bulk select.
   One record keeps one action set, and that set lives on each account's own
   page, so a row here is a link into the account, not a place to act on it. */

// The columns the configurator offers - the same set and order the main chart
// offers. Number and name are the account's identity, so they are always drawn
// and never appear as things to turn off.
const ROLLUP_COLUMN_KEYS: ColKey[] = ['number', 'name', 'dimensions', 'numberRange', 'type', 'classification', 'glType', 'role', 'normalBalance', 'openingBalance', 'runningBalance', 'fxBalance', 'currency', 'status', 'restricted', 'description', 'internalId', 'originalNumber', 'imported', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt']
const ROLLUP_COLUMN_SPECS: { key: keyof ColumnConfig; label: string }[] = ROLLUP_COLUMN_KEYS.map(k => ({ key: k, label: HEADER_DEFS[k].label }))
const ROLLUP_LOCKED_COLUMNS = ['number', 'name']

// The badge that names the account whose page this is, sitting on its row in the
// hierarchy so the reader never loses which one they opened.
const ThisAccountBadge = () => (
  <Badge tone="brand" className="ml-2 shrink-0">This account</Badge>
)

function RollupAccountsTab({ account }: { account: Account }) {
  const navigate = useNavigate()
  const index = usePeriodScopedChart()
  const subsidiaries = useStore(s => s.company.subsidiaries)
  /* What search needs to read every column as it prints, as on the chart: the
     dimension names for "Location: USA", and the period's chart and base
     currency for the figures (the tree below draws off the same chart). */
  const dimensions = useStore(s => s.dimensions)
  const baseCurrency = useStore(s => s.company.baseCurrency)
  const searchCtx = useMemo<SearchContext>(() => {
    const names = new Map(dimensions.map(d => [d.id, d.name]))
    return { dimensionName: id => names.get(id), index, base: baseCurrency }
  }, [dimensions, index, baseCurrency])

  // The summary plus everything beneath it, at any depth, as one set. Passed
  // whole, the tree roots the summary (its parent is not in the set) and nests
  // the rest by parentId - the same shape the main chart draws, so figures roll
  // up against the whole chart, not just what is on screen.
  const subtree = useMemo(() => [account, ...index.descendantsOf(account.id)], [account, index])
  // Match the listing: the Dimensions column ships on when any account in view
  // carries a default, off otherwise - the same rule ChartOfAccounts applies to
  // the whole chart, scoped here to the subtree.
  const subtreeHasDimensions = useMemo(() => subtree.some(a => a.defaultDimensionValues.length > 0), [subtree])

  const [query, setQuery] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 150)
    return () => clearTimeout(t)
  }, [query])

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [colFilters, setColFilters] = useState<ColFilters>({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [columns, setColumns] = useState<ColumnConfig>(() => ({ ...DEFAULT_COLUMNS, dimensions: subtreeHasDimensions }))
  const [columnOrder, setColumnOrder] = useState<ColKey[]>(DEFAULT_COLUMN_ORDER)
  // Frozen from a header menu or from the Columns panel, as on the chart itself.
  const [frozenCols, setFrozenCols] = useState<ColKey[]>([])
  const toggleFreeze = (k: ColKey) => setFrozenCols(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [expandMode, setExpandMode] = useState<'expanded' | 'collapsed'>('expanded')
  /* The rollup is the chart listing over one branch, so it offers everything the
     listing does: its rows nest and they are grouped by category. */
  const { look, set: setLook, toggle: toggleVisual, lookClass } = useTableLook()
  const density = look.density === 'comfort' ? ('comfortable' as const) : ('condensed' as const)
  const rollupScrollRef = useRef<HTMLDivElement>(null)
  useCrosshair(rollupScrollRef, look.crosshair)

  const { expanded, setExpanded, toggle } = useTreeExpansion(subtree)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const toggleGroup = useCallback((key: string) => setCollapsedGroups(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n
  }), [])

  // Every category present among the roots - here just the summary's own, since
  // a child shares its parent's category. Collapsing shuts the head too, so the
  // subtree reads as one row rather than one row plus whatever was left open.
  const allGroupKeys = useMemo(() => new Set(subtree.map(a => a.accountType)), [subtree])
  const setAllExpanded = useCallback((mode: 'expanded' | 'collapsed') => {
    if (mode === 'expanded') { setExpanded(new Set(subtree.filter(a => !a.isPosting).map(a => a.id))); setCollapsedGroups(new Set()) }
    else { setExpanded(new Set()); setCollapsedGroups(new Set(allGroupKeys)) }
    setExpandMode(mode)
  }, [subtree, allGroupKeys, setExpanded])

  const noAction = useCallback(() => {}, [])

  // The same narrowing pipeline the main chart runs, scoped to the subtree:
  // search across every column's value, then the Filters panel, then the
  // column-header chips. Summaries that only match as ancestors of a hit are
  // added back so an account is still shown in its place, not orphaned.
  const { matches, treeRows } = useMemo(() => {
    let list = subtree
    // An archived account is off the chart, so it stays out of the rollup until
    // the Filters panel's Status section asks for it - the same default the main
    // listing keeps, so "N of M" counts the same set on both.
    list = list.filter(a => !offTheListing(a, filters))
    // Every column's text as it prints, on or off - the chart's own search
    // (lib/accountSearch), so a summary's rollup finds what the chart finds.
    if (debouncedQ) list = list.filter(a => searchHits(a, debouncedQ, searchCtx).length > 0)
    list = applyFilters(list, filters)
    const activeCols = (Object.keys(colFilters) as ColKey[]).some(k => filterActive(colFilters[k]))
    if (activeCols) list = list.filter(a => matchesColFilters(a, colFilters, subtree))
    const treeRows = (debouncedQ || activeCols)
      ? withAncestorContext(subtree, list, filters.statuses.includes('Archived'))
      : list
    return { matches: list, treeRows }
  }, [subtree, debouncedQ, filters, colFilters, searchCtx])

  // A hidden column the search matched in comes out for the search, after the
  // name, with the note above the table - as on the chart.
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
  const shownOrder = useMemo(() => orderWithRevealed(columnOrder, revealedCols, 'name'), [columnOrder, revealedCols])

  const totalAccounts = useMemo(
    () => subtree.filter(a => !offTheListing(a, filters)).length,
    [subtree, filters.statuses])

  const colFiltersActive = useMemo(
    () => (Object.keys(colFilters) as ColKey[]).some(k => filterActive(colFilters[k])),
    [colFilters])
  const otherNarrowing = countFiltersActive(filters) > 0 || colFiltersActive
  const clearNarrowing = () => { setFilters(EMPTY_FILTERS); setColFilters({}) }
  const noMatch = matches.length === 0 ? (
    <EmptyState
      icon={<Search size={20} />}
      title={debouncedQ ? `No accounts match "${debouncedQ}"` : 'No accounts match these filters'}
      description={debouncedQ
        ? `Nothing under this summary carries that in any of its columns.${otherNarrowing ? ' Filters are narrowing the accounts as well, so one that does match can still be held back.' : ''}`
        : 'Every account under this summary is held back by a filter. Widen one, or clear them to read the whole rollup again.'}
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

  const expandOpts = [
    { val: 'expanded' as const, label: 'Expand all', Icon: UnfoldVertical, desc: 'Show the accounts under every summary' },
    { val: 'collapsed' as const, label: 'Collapse all', Icon: FoldVertical, desc: 'Show the summary row only' },
  ]
  const curExpand = expandOpts.find(o => o.val === expandMode) ?? expandOpts[0]

  return (
    <Card className="overflow-visible flex-1 flex flex-col">
      {/* Toolbar: search + filters (left) · count + layout + columns (right). Its
          top edge is where a dragged header turns into a hide (tableColumns). */}
      <div data-col-hide-edge className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3.5 pb-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
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
            iconSize={14}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
            <span className="text-fg">{fmtNumber(matches.length)}</span>
            <span className="text-fg-muted/60"> of </span>
            <span className="text-fg-muted">{fmtNumber(totalAccounts)}</span>
            <span className="text-fg-muted/70"> accounts</span>
          </span>
          <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
          <Menu align="right" trigger={
            <button className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-fg shadow-xs hover:bg-bg-subtle transition-colors text-sm font-medium">
              <curExpand.Icon size={16} className="text-fg-subtle" />
              <span className="hidden md:inline">{curExpand.label}</span>
              <ChevronDown size={14} className="text-fg-subtle/60" />
            </button>
          }>
            {(close) => (
              <div className="w-[250px] p-1.5 -my-1">
                {expandOpts.map(o => (
                  <button key={o.val} onClick={() => { setAllExpanded(o.val); close() }}
                    className="w-full flex items-center gap-3 py-2.5 px-3 rounded-md text-left hover:bg-bg-subtle transition-colors">
                    <o.Icon size={20} className="text-fg-subtle shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-fg">{o.label}</div>
                      <div className="text-xs text-fg-muted">{o.desc}</div>
                    </div>
                    {expandMode === o.val && <Check size={14} className="text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </Menu>
          {/* The toolbar pair, in this order and 6px apart (spec §1). */}
          <div className="flex items-center" style={{ gap: 6 }}>
            <DensityMenu
              value={look.density}
              onChange={d => setLook('density', d)}
              sections={lookSections({
                tree: { value: look.treeStyle, onChange: v => setLook('treeStyle', v) },
                widths: { value: look.columnSizing, onChange: v => setLook('columnSizing', v) },
              })}
            />
            <button type="button" onClick={() => setColumnsOpen(o => !o)} className="fr-tool-btn"
              data-active={columnsOpen} aria-expanded={columnsOpen}
              style={{ ...TOOL_BTN, ...(columnsOpen ? TOOL_BTN_ACTIVE : null) }}>
              <Columns3 style={{ width: 18, height: 18, flexShrink: 0 }} />
              <span className="hidden md:inline">Columns</span>
              <span style={COUNT_BADGE}>{Object.values(columns).filter(Boolean).length}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Body: table area (shrinks) + docked Columns side panel. The card runs to
          the bottom of the window, so the panel stands the card's full height
          beside a short table rather than stopping where the rows do. */}
      <div className="flex flex-1 items-stretch border-t border-border">
        <div className="flex-1 min-w-0 flex flex-col">
          <ColumnFiltersBar
            filters={colFilters}
            onChange={setColFilters}
            availableColumns={columnOrder.filter(k => k !== 'name' && (columns as unknown as Record<string, boolean>)[k])}
            labelOf={k => HEADER_DEFS[k].label}
            uniqueValuesOf={k => uniqueColValues(k, subtree)}
            blankFilterOf={blankFilter}
          />
          <SearchRevealNote labels={revealedCols.map(k => HEADER_DEFS[k].label)} />
          <div ref={rollupScrollRef} className="overflow-auto scrollbar-thin max-h-[calc(100vh-320px)]">
            <AccountTree
              accounts={treeRows}
              query={debouncedQ}
              density={density}
              look={{
                className: lookClass,
                treeStyle: look.treeStyle,
                columnSizing: look.columnSizing,
                rowNumbers: look.rowNumbers,
                pinGroups: look.pinGroups,
              }}
              onColumnDrag={() => setLook('columnSizing', 'custom')}
              columns={shownColumns}
              order={shownOrder}
              onOrderChange={setColumnOrder}
              onAction={noAction}
              onOpen={(a) => navigate(`/chart-of-accounts/${a.id}`)}
              expanded={expanded}
              onToggle={toggle}
              collapsedGroups={collapsedGroups}
              onToggleGroup={toggleGroup}
              colFilters={colFilters}
              onColFiltersChange={setColFilters}
              frozenCols={frozenCols}
              // Hide from the header menu, or by dragging a header off the top -
              // as the chart's own listing offers.
              onHideColumn={k => { if (!unreveal(k)) setColumns(c => ({ ...c, [k]: false })) }}
              onToggleFreeze={toggleFreeze}
              readOnly
              reserveActionRowHeight
              bodyScroll={false}
              omitOpeningBalance
              rowBadge={(a) => a.id === account.id ? <ThisAccountBadge /> : null}
              emptyState={noMatch}
            />
          </div>
        </div>

        <ColumnSelector
          open={columnsOpen}
          onOpenChange={setColumnsOpen}
          columns={ROLLUP_COLUMN_SPECS}
          columnOrder={columnOrder}
          columnVisibility={columns as unknown as Record<string, boolean>}
          lockedColumns={ROLLUP_LOCKED_COLUMNS}
          onColumnOrderChange={(o) => setColumnOrder(o as ColKey[])}
          onColumnVisibilityChange={(v) => setColumns(v as unknown as ColumnConfig)}
          frozenColumns={frozenCols}
          onToggleFreeze={k => toggleFreeze(k as ColKey)}
          canFreeze={k => !isLockedCol(k as ColKey)}
          visual={{ values: look, offers: { pinGroups: true }, onToggle: toggleVisual }}
          defaults={{ visibility: { ...DEFAULT_COLUMNS, dimensions: subtreeHasDimensions } as unknown as Record<string, boolean>, order: DEFAULT_COLUMN_ORDER }}
        />
      </div>

      <FiltersSlideOver
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        setFilters={setFilters}
        accounts={subtree}
        subsidiaries={subsidiaries}
      />
    </Card>
  )
}


// =========================
// Register
// =========================
// Columns and their order match the General Ledger's GL_COLS (GeneralLedger.tsx)
// - this register is that same ledger scoped to one account, so the two views
// have to read identically. The ledger's Account and GL Account Category columns
// are dropped here: the page is already scoped to one account, so both would
// repeat the same value on every row.
/* A register row is one posting, so it carries the line's own text and not the
   entry's. Description and Memo are the Journal entries tab's; they came here on
   2026-09-30 and Mahad took them off again the same day: *"Can we remove
   Description and Memo from the transaction tab table."* */
const TX_COLS = [
  { key: 'date', label: 'Date' },
  { key: 'entry', label: 'Journal entry number' },
  /* What kind of thing produced the posting - a manual entry, a vendor bill,
     a payroll run. Filed after Journal entry because the two describe the
     same event: what its number is and what it is. */
  { key: 'source', label: 'Source' },
  { key: 'reference', label: 'Linked document' },
  { key: 'description', label: 'Line description' },
  { key: 'dimensions', label: 'Dimensions' },
  { key: 'debit', label: 'Debit' },
  { key: 'credit', label: 'Credit' },
  { key: 'balance', label: 'Running balance' },
] as const
type TxColKey = typeof TX_COLS[number]['key']
const TX_COL_LABEL = Object.fromEntries(TX_COLS.map(c => [c.key, c.label])) as Record<TxColKey, string>
const TX_COL_ORDER: TxColKey[] = TX_COLS.map(c => c.key)
// Per-column filter editor type, mirroring the Account table's FILTER_TYPE.
const TX_FILTER_TYPE: Record<TxColKey, ColFilterType> = {
  date: 'date', entry: 'text', source: 'text', reference: 'text', description: 'text', dimensions: 'text',
  debit: 'range', credit: 'range', balance: 'range',
}
const blankTxFilter = (k: TxColKey): ColFilter => ({ type: TX_FILTER_TYPE[k], values: [], text: '', min: '', max: '', from: '', to: '' })
const TX_RIGHT: TxColKey[] = ['debit', 'credit', 'balance']

/* What each register column prints for a posting, as text a search can find -
   every column, shown or hidden, read the way its cell prints it, so whatever a
   search finds on a row it can mark there (Mahad, 2026-10-05: *"the search
   should have everything in it ... for both active and hidden columns"*). A
   `Record`, so a column added here cannot be left out of search. */
interface TxTextCtx {
  /** The register's currency, which Debit, Credit and Running balance print in. */
  currency: string
  /** The running balance after a posting. */
  runBal: (id: string) => number
  /** The same, in the register's currency, typed amounts counted as typed. */
  ownRunBal: (id: string) => number
  /** A dimension's name by id, for the Dimensions pill's "Location: USA". */
  dimensionName: (id: string) => string | undefined
}
// A side as the account's own currency holds it: typed, where the entry was
// written in it, else restated (lib/currencies).
const txMoneyText = (t: Transaction, side: 'debit' | 'credit', currency: string) => (t[side] ? fmtCurrencyExact(ownSide(t, side, currency), currency) : '')
const TX_CELL_TEXT: Record<TxColKey, (t: Transaction, ctx: TxTextCtx) => string> = {
  date: t => fmtDate(t.date),
  entry: t => t.jeNumber,
  source: t => sourceDocName(t.source),
  reference: t => t.reference,
  description: t => t.description,
  dimensions: (t, ctx) => t.dimensionValues.map(v => `${ctx.dimensionName(v.dimensionId) ?? ''} ${v.value}`).join(' '),
  debit: (t, ctx) => txMoneyText(t, 'debit', ctx.currency),
  credit: (t, ctx) => txMoneyText(t, 'credit', ctx.currency),
  balance: (t, ctx) => fmtCurrencyExact(ctx.ownRunBal(t.id), ctx.currency),
}
// Same edge treatment the Chart of Accounts and the ledger give a frozen column: a
// thin border followed by a soft outward shadow, so the run reads as a held edge the
// scrolling columns pass under.
const TX_LEFT_EDGE_SHADOW = 'inset -2px 0 0 0 hsl(var(--border)), 6px 0 8px -8px rgba(15,23,42,0.18)'
// Only the first paint's fallback, before the run's widths have been measured.
const TX_FROZEN_W = 150

// Posting side lives in the toolbar's quick-filter row rather than the Filters
// modal: it is the one cut a reader reaches for constantly, and unlike the modal
// facets it is single-select - a posting is either a debit or a credit, so
// "both" is already what All means.
type TxSide = 'all' | 'debit' | 'credit'
const TX_SIDES: { key: TxSide; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'debit', label: 'Debit' },
  { key: 'credit', label: 'Credit' },
]
const matchesTxSide = (t: Transaction, side: TxSide) =>
  side === 'all' || (side === 'debit' ? t.debit > 0 : t.credit > 0)


// ── Register Filters modal state. Facets match the General Ledger's GLFilters
// (GeneralLedger.tsx), minus the account facet the page already scopes and the
// posting side, which is a quick-filter pill above the table instead. ──
interface TxFilterState {
  periods: string[]
  amountMin: string
  amountMax: string
  dateFrom: string
  dateTo: string
}
const EMPTY_TX_FILTERS: TxFilterState = { periods: [], amountMin: '', amountMax: '', dateFrom: '', dateTo: '' }
const countTxFiltersActive = (f: TxFilterState) =>
  f.periods.length +
  (f.amountMin || f.amountMax ? 1 : 0) +
  (f.dateFrom || f.dateTo ? 1 : 0)
function matchesTxFilterState(t: Transaction, f: TxFilterState) {
  if (f.periods.length && !f.periods.includes(t.period)) return false
  // Gross amount, as in the ledger - a posting is either a debit or a credit.
  const amount = Math.max(t.debit, t.credit)
  if (!withinMagnitude(amount, f.amountMin, f.amountMax)) return false
  if (f.dateFrom && t.date.slice(0, 10) < f.dateFrom) return false
  if (f.dateTo && t.date.slice(0, 10) > f.dateTo) return false
  return true
}

// The register's Filters modal - same chrome, sections, pills, and footer as
// the Chart of Accounts FiltersSlideOver (components/Filters.tsx).
function TxFiltersModal({ open, onClose, filters, setFilters, transactions }: {
  open: boolean
  onClose: () => void
  filters: TxFilterState
  setFilters: (f: TxFilterState) => void
  transactions: Transaction[]
}) {
  const [draft, setDraft] = useState<TxFilterState>(filters)
  const storePeriods = useStore(s => s.periods)
  useEffect(() => {
    if (!open) return
    setDraft(filters)
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const liveCount = transactions.filter(t => matchesTxFilterState(t, draft)).length
  const activeCount = countTxFiltersActive(draft)

  // Facet options and counts come from this account's own postings, so the
  // pills only ever offer periods that exist here.
  const periodCounts = transactions.reduce<Record<string, number>>((acc, t) => {
    acc[t.period] = (acc[t.period] ?? 0) + 1
    return acc
  }, {})
  const periods = orderPeriodsRecentFirst(Object.keys(periodCounts), storePeriods)
  const amountValues = transactions.map(t => Math.max(t.debit, t.credit))
  const toggleArr = (key: 'periods', value: string) => setDraft(d => {
    const arr = d[key] as string[]
    return { ...d, [key]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value] }
  })

  // Portaled to <body> so the overlay covers the sidebar and top bar - inside
  // the page tree the shell's animate-page-in transform is its containing
  // block, which would clip it to the content area.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 coa-scrim animate-overlay-in" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-[680px] max-h-[85vh] flex flex-col overflow-hidden animate-modal-in">
        {/* Header: centered title + active count, circular X at left */}
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
          {/* Mahad's copy, 2026-10-12. */}
          <Section title="Accounting period" desc="Show only transactions posted to this period.">
            {periods.length > 0 ? (
              <SearchableDropdownSelect
                options={periods.map(p => ({ value: p, label: p }))}
                selected={draft.periods}
                onToggle={p => toggleArr('periods', p)}
                onClear={() => setDraft(d => ({ ...d, periods: [] }))}
                getCount={p => periodCounts[p] ?? 0}
                allLabel="All periods"
                searchPlaceholder="Search periods"
              />
            ) : (
              <p className="text-[13px] text-muted-foreground/50">No postings to this account yet.</p>
            )}
          </Section>

          <FDivider />

          <Section title="Amount range" desc="Matches debits and credits alike, so $1,000 finds either one.">
            <RangeMinMax
              values={amountValues}
              min={draft.amountMin}
              max={draft.amountMax}
              onMinChange={v => setDraft(d => ({ ...d, amountMin: v }))}
              onMaxChange={v => setDraft(d => ({ ...d, amountMax: v }))}
              magnitude
              placeholders={{ min: 'Any', max: 'Any' }}
            />
          </Section>

          <FDivider />

          {/* Kept alongside the toolbar's date range because it can do what a
              range cannot: leave one end open, as in "anything before March". */}
          <Section title="Posting date" desc="Filters within the toolbar date range. Leave a date blank for no limit.">
            <DateRangeFromTo
              from={draft.dateFrom}
              to={draft.dateTo}
              onFromChange={iso => setDraft(d => ({ ...d, dateFrom: iso }))}
              onToChange={iso => setDraft(d => ({ ...d, dateTo: iso }))}
            />
          </Section>
        </div>

        {/* Sticky footer: underlined Clear all (left) · primary Show N (right) */}
        <div className="flex items-center justify-between px-6 h-14 border-t border-border/60 shrink-0">
          <button
            type="button"
            onClick={() => setDraft(EMPTY_TX_FILTERS)}
            className="text-[13px] text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-foreground/50 transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={() => { setFilters(draft); onClose() }}
            className="inline-flex items-center justify-center h-9 px-5 rounded-lg text-white text-[13px] cursor-pointer transition-colors hover:opacity-90"
            style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 600 }}
          >
            Show {liveCount.toLocaleString()} transaction{liveCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* Where the Transactions tab's date range opens. See RegisterTab. */
export const REGISTER_OPENS_ON = { kind: 'preset', preset: '30d' } as const satisfies PeriodValue

function RegisterTab({ transactions, currency, statistical, accountId, initialRange }: { transactions: Transaction[]; currency: string; statistical?: boolean; accountId?: string; initialRange?: PeriodValue }) {
  const base = useStore(s => s.company.baseCurrency)
  // The whole ledger, for reading an entry across the accounts it touches. The
  // `transactions` prop is this account's side of it and cannot answer that.
  const ledger = useStore(s => s.transactions)
  // Running balance is the continuous, normal-side curve for this account,
  // anchored at its fiscal-year opening - the same read-model the monthly card
  // and KPIs use (lib/monthlyLedger). It is computed over the FULL account
  // history so each row shows the true balance after that posting, regardless
  // of how the table is filtered or sorted.
  const account = useStore(s => (accountId ? s.accounts.find(a => a.id === accountId) : undefined))
  const seededOpening = useStore(s => (accountId ? (s.seedQ1Openings[accountId] ?? 0) : 0))
  const { balanceByTx, ownByTx } = useMemo(() => {
    const m = new Map<string, number>()
    const own = new Map<string, number>()
    let typed = 0
    if (account) for (const p of runningBalanceLedger(account, transactions, seededOpening)) {
      m.set(p.transaction.id, p.runningBalance)
      // The euro balance takes each typed posting at what was typed.
      typed += typedCorrection(account, [p.transaction])
      own.set(p.transaction.id, bookedFromBase(p.runningBalance, currency) + typed)
    }
    return { balanceByTx: m, ownByTx: own }
  }, [account, transactions, seededOpening, currency])
  const runBal = (id: string) => balanceByTx.get(id) ?? 0
  const ownRunBal = (id: string) => ownByTx.get(id) ?? 0
  const dimensions = useStore(s => s.dimensions)
  const dimensionNames = useMemo(() => new Map(dimensions.map(d => [d.id, d.name])), [dimensions])
  const txCtx: TxTextCtx = { currency, runBal, ownRunBal, dimensionName: id => dimensionNames.get(id) }
  // Toolbar chrome mirrors the Chart of Accounts table: search + Filters on
  // the left, count + density + columns on the right (per the Cash Management
  // Bank Transactions reference, sans KPIs).
  const [q, setQ] = useState('')
  const [side, setSide] = useState<TxSide>('all')
  // Date range sits on the toolbar rather than inside Filters: narrowing a ledger
  // to a span of dates is the first thing a reader reaches for, and it has to be
  // readable at a glance so no figure below is mistaken for the whole history.
  //
  // Opens on the last 30 days, not All time. Eli, 2026-09-24: *"Certain accounts
  // are going to be hit 8,000 times a day ... If you have to load 10,000
  // transactions in one shot because you did all time, that's going to become a
  // real problem ... My gut is telling me last 30 days."* The count beside the
  // toolbar still reads against the whole account, so the reader can see there
  // is more, and All time is one pick away.
  const [dateRange, setDateRange] = useState<PeriodValue>(initialRange ?? REGISTER_OPENS_ON)
  const [txFilters, setTxFilters] = useState<TxFilterState>(EMPTY_TX_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  /* A flat run of postings: no nesting to restyle and no bands to pin, so of the
     look controls the register offers the densities, Column widths, and the four
     visual switches that mean something on a flat table. */
  const { look, set: setLook, toggle: toggleVisual, lookClass } = useTableLook()
  const density = look.density === 'comfort' ? ('comfortable' as const) : ('condensed' as const)
  const engineSized = look.columnSizing === 'fit' || look.columnSizing === 'equal'
  const registerScrollRef = useRef<HTMLDivElement>(null)
  useCrosshair(registerScrollRef, look.crosshair)
  const [cols, setCols] = useState<Record<TxColKey, boolean>>(() => Object.fromEntries(TX_COLS.map(c => [c.key, true])) as Record<TxColKey, boolean>)
  const [columnsOpen, setColumnsOpen] = useState(false)
  // The register's rows, which `regWindow` measures.
  const registerBodyRef = useRef<HTMLTableSectionElement>(null)

  // Column order (drag-to-reorder), sort, and per-column filters - the same
  // header behaviour as the Account table (AccountTable.tsx).
  const [order, setOrder] = useState<TxColKey[]>(TX_COL_ORDER)
  // Columns the reader froze from a header menu, plus the measured widths their
  // sticky offsets are summed from.
  const [frozenCols, setFrozenCols] = useState<TxColKey[]>([])
  const [pinnedWidths, setPinnedWidths] = useState<Record<string, number>>({})
  const headRowRef = useRef<HTMLTableRowElement>(null)
  /* Partners' mouse drag: reorders live as the header passes its neighbours,
     and hides the column when dropped off the top of the table - red while a
     release would. Frozen headers hold their place. */
  const txDrag = useColumnDragReorder({
    order,
    setOrder: next => setOrder(prev => (typeof next === 'function' ? next(prev) : next) as TxColKey[]),
    locked: new Set(frozenCols),
    onHide: k => hideCol(k as TxColKey),
  })
  const dragKey = txDrag.draggingKey as TxColKey | null
  const makeDnd = (key: TxColKey) => ({
    'data-col-drag-key': key,
    onMouseDown: (e: React.MouseEvent) => txDrag.onHeaderMouseDown(e, key),
    onClickCapture: (e: React.MouseEvent) => { if (txDrag.suppressClick()) { e.stopPropagation(); e.preventDefault() } },
  })
  const [sort, setSort] = useState<{ key: TxColKey; dir: 'asc' | 'desc' } | null>(null)
  const [colFilters, setColFilters] = useState<Partial<Record<TxColKey, ColFilter>>>({})
  /* The entry a reader has asked to see, shown in the quick view over the
     register. The whole entry is worth a look at once here - both sides, the
     status, the totals that prove it balances - and a panel holds all of it
     without the register having to make room. "Open full entry" is one click
     further on for anyone who wants the page. */
  const [quickJe, setQuickJe] = useState<string | null>(null)

  const matchesTxFilters = (t: Transaction) => {
    for (const k of Object.keys(colFilters) as TxColKey[]) {
      const f = colFilters[k]
      if (!f || !filterActive(f)) continue
      const text = f.text.trim().toLowerCase()
      switch (k) {
        case 'date':
          if (f.from && t.date.slice(0, 10) < f.from) return false
          if (f.to && t.date.slice(0, 10) > f.to) return false
          break
        case 'entry': if (text && !t.jeNumber.toLowerCase().includes(text)) return false; break
        case 'source': if (text && !sourceDocLabel(t.source).toLowerCase().includes(text) && !t.source.toLowerCase().includes(text)) return false; break
        case 'reference': if (text && !t.reference.toLowerCase().includes(text)) return false; break
        case 'description': if (text && !t.description.toLowerCase().includes(text)) return false; break
        case 'dimensions': if (text && !t.dimensionValues.map(tv => tv.value).join(' ').toLowerCase().includes(text)) return false; break
        case 'debit':
          if (f.min !== '' && t.debit < Number(f.min)) return false
          if (f.max !== '' && t.debit > Number(f.max)) return false
          break
        case 'credit':
          if (f.min !== '' && t.credit < Number(f.min)) return false
          if (f.max !== '' && t.credit > Number(f.max)) return false
          break
        case 'balance': {
          const b = runBal(t.id)
          if (f.min !== '' && b < Number(f.min)) return false
          if (f.max !== '' && b > Number(f.max)) return false
          break
        }
      }
    }
    return true
  }

  // The toolbar's date range narrows the set every other control then works
  // against, so the side pills and Filters counts are all "within these dates".
  const dateScoped = useMemo(() => windowTxByPeriod(transactions, dateRange), [transactions, dateRange])
  /* The entry a row belongs to, whole: every line of it, down to the contra a
     seeded entry stores only one side of - read through `reconstructEntry`, as
     the entry's own page and the General ledger read it, so the search finds
     the lines the entry's own page shows. Grouped over the whole ledger on
     first use and kept, so a reader who never searches never pays for it. */
  const accounts = useStore(s => s.accounts)
  const entryOf = useMemo(() => {
    let byJe: Map<string, Transaction[]> | null = null
    const cache = new Map<string, ReconstructedEntry>()
    return (jeNumber: string): ReconstructedEntry => {
      const hit = cache.get(jeNumber)
      if (hit) return hit
      if (!byJe) {
        byJe = new Map()
        for (const t of ledger) {
          const list = byJe.get(t.jeNumber)
          if (list) list.push(t); else byJe.set(t.jeNumber, [t])
        }
      }
      const entry = reconstructEntry(jeNumber, byJe.get(jeNumber) ?? [], accounts)
      cache.set(jeNumber, entry)
      return entry
    }
  }, [ledger, accounts])
  /* The register searches the entry a row belongs to, not the one line of it
     that sits on this account: every line's account, number and narration, and
     the entry's memo. A reader tracing where petty cash went searches the expense
     it paid for - Office Supplies, or 52330 - and that line is on the other side
     of the entry, on another account's register. Module review, 2026-10-06
     (COA-17, decision 67). The rows that come back are still this account's -
     the search decides which entries, never which accounts. */
  const entryHaystack = useMemo(() => {
    const cache = new Map<string, string>()
    return (jeNumber: string) => {
      const hit = cache.get(jeNumber)
      if (hit !== undefined) return hit
      const e = entryOf(jeNumber)
      const text = [
        jeNumber, e.reference, e.memo,
        ...e.lines.map(l => `${l.account?.accountNumber ?? ''} ${l.account?.accountName ?? ''} ${l.description}`),
      ].join(' ')
      cache.set(jeNumber, text)
      return text
    }
  }, [entryOf])
  /* Rows no longer open in place onto the entry's lines (Mahad, 2026-10-08:
     "remove the row opening in the transactions tab"). The entry number opens
     the quick view, which shows both sides, and the way through to the entry. */
  /* And every column on the row itself, shown or hidden, as it prints - see
     TX_CELL_TEXT. One matcher for the query, the pattern the marks are drawn
     with, so a figure typed without its separators (1250) finds "$ 1,250.00". */
  const found = searchMatcher(q)
  const rowHits = (t: Transaction): TxColKey[] => (q.trim() ? TX_COL_ORDER.filter(k => found(TX_CELL_TEXT[k](t, txCtx))) : [])
  // Split in two so the side pills can count against everything *except*
  // themselves - otherwise picking Debit would show Credit as 0.
  const preSide = dateScoped.filter(t => {
    if (q.trim() && !found(entryHaystack(t.jeNumber)) && !rowHits(t).length) return false
    if (!matchesTxFilterState(t, txFilters)) return false
    return matchesTxFilters(t)
  })
  const sideCounts: Record<TxSide, number> = {
    all: preSide.length,
    debit: preSide.filter(t => t.debit > 0).length,
    credit: preSide.filter(t => t.credit > 0).length,
  }
  const filtered = preSide.filter(t => matchesTxSide(t, side))
  const dir = sort?.dir === 'desc' ? -1 : 1
  const sorted = sort ? [...filtered].sort((a, b) => {
    let c = 0
    switch (sort.key) {
      // Sorting by date is sorting by posting order - two entries on one day
      // are separated by the number they were issued, not left to the order the
      // rows happened to arrive in.
      case 'date': c = comparePostingOrder(a, b); break
      case 'entry': c = a.jeNumber.localeCompare(b.jeNumber, undefined, { numeric: true }); break
      case 'source': c = sourceDocLabel(a.source).localeCompare(sourceDocLabel(b.source)); break
      case 'reference': c = a.reference.localeCompare(b.reference, undefined, { numeric: true }); break
      case 'description': c = a.description.localeCompare(b.description); break
      case 'dimensions': c = a.dimensionValues.map(tv => tv.value).join(' ').localeCompare(b.dimensionValues.map(tv => tv.value).join(' ')); break
      case 'debit': c = a.debit - b.debit; break
      case 'credit': c = a.credit - b.credit; break
      case 'balance': c = runBal(a.id) - runBal(b.id); break
    }
    return (c !== 0 ? c : comparePostingOrder(a, b)) * dir
    /* Unsorted is newest first, in posting order - not the order the rows were
       stored in. The seed happens to store newest first, so it read right until
       something was posted here: that landed under the oldest row, and the
       running balance down the page jumped between two orders. */
  }) : [...filtered].sort((a, b) => comparePostingOrder(b, a))
  const filtersActive = countTxFiltersActive(txFilters)
  /* A hidden column the search matched in comes out for the search, after the
     entry number that names the row, with the note above the table. Read off the
     rows the search listed; hiding one again keeps it hidden until the search
     changes. */
  const hiddenHitKey = (() => {
    if (!q.trim()) return ''
    const hit = new Set<TxColKey>()
    for (const t of filtered) for (const k of rowHits(t)) if (!cols[k]) hit.add(k)
    return order.filter(k => hit.has(k)).join(',')
  })()
  const { revealed, hide: unreveal } = useSearchReveal(q, useMemo(() => (hiddenHitKey ? hiddenHitKey.split(',') as TxColKey[] : []), [hiddenHitKey]))
  const shownCols: Record<TxColKey, boolean> = revealed.length ? { ...cols, ...Object.fromEntries(revealed.map(k => [k, true])) } : cols
  // Hiding a column the search brought out puts it back down for this search
  // only; any other column is the reader's own to hide. A declaration, so the
  // header drag set up above can name it - it only runs on a drop.
  function hideCol(k: TxColKey) { if (!unreveal(k)) setCols(prev => ({ ...prev, [k]: false })) }
  // Marked once the reader has moved it off where the register opens.
  const dateRangeActive = !(dateRange.kind === 'preset' && dateRange.preset === REGISTER_OPENS_ON.preset)
  const visibleCols = TX_COLS.filter(c => cols[c.key])
  // A frozen column leads the row rather than pinning where it sits: a cell pinned
  // mid-table would let the columns before it slide underneath it.
  const leftPinRun = frozenCols.filter(k => shownCols[k])
  const shownOrder = orderWithRevealed(order, revealed, 'entry')
  const colOrder = [...leftPinRun, ...shownOrder.filter(k => shownCols[k] && !leftPinRun.includes(k))]
  /* No pages: the register scrolls through every posting, drawn BLOCK_SIZE at a
     time and never more than two blocks at once, as the Journal entries tab does
     (Mahad, 2026-11-03: *"Do the same for the transactions tab in the account
     detail pages as well."*). The page is what scrolls here, not the table's own
     frame; `useBlockWindow` follows either. */
  const regBlockSizes = Array.from({ length: Math.ceil(sorted.length / BLOCK_SIZE) }, (_, b) => Math.min(BLOCK_SIZE, sorted.length - b * BLOCK_SIZE))
  const regWindow = useBlockWindow({
    enabled: true,
    bodyRef: registerBodyRef,
    rowSelector: 'tr[data-tree-account]',
    sizes: regBlockSizes,
    keys: regBlockSizes.map((n, b) => `${sorted[b * BLOCK_SIZE].id}|${sorted[b * BLOCK_SIZE + n - 1].id}`),
    layoutKey: JSON.stringify([density, colOrder, look.columnSizing, look.rowNumbers]),
    resetKey: JSON.stringify([q, side, dateRange, txFilters, colFilters, sort]),
    colAttr: 'data-tx-col',
    floorCols: look.columnSizing !== 'equal',
  })
  // The run's offsets are summed from measured widths, because these columns size to
  // their content and an offset short by a few pixels leaves a seam or laps the
  // column before it. Width is what's measured, not position: a sticky cell's
  // `offsetLeft` carries the shift the pin itself applied.
  useLayoutEffect(() => {
    const row = headRowRef.current
    if (!row) return
    const next: Record<string, number> = {}
    for (const k of leftPinRun) {
      const th = row.querySelector<HTMLElement>(`th[data-tx-col="${k}"]`)
      if (th) next[k] = Math.round(th.getBoundingClientRect().width)
    }
    setPinnedWidths(prev => {
      const keys = Object.keys(next)
      const same = keys.length === Object.keys(prev).length && keys.every(k => prev[k] === next[k])
      return same ? prev : next
    })
  })
  const txPinStyle = (k: TxColKey, header = false): CSSProperties | undefined => {
    // A frozen offset is a sum of widths, so the whole run stands down with the
    // widths it was summed from (spec §8).
    if (engineSized) return undefined
    const idx = leftPinRun.indexOf(k)
    if (idx < 0) return undefined
    return {
      position: 'sticky',
      left: leftPinRun.slice(0, idx).reduce((sum, c) => sum + (pinnedWidths[c] ?? TX_FROZEN_W), 0),
      zIndex: header ? 40 : 20,
      // Only the last cell of the run draws the edge: it's the one the scrolling
      // columns pass under.
      boxShadow: idx === leftPinRun.length - 1 ? TX_LEFT_EDGE_SHADOW : undefined,
    }
  }
  // `bg-inherit` rather than a fixed colour, so a pinned cell stays opaque and still
  // follows the row's hover fill.
  const withTxPin = (cell: ReactElement, pin: CSSProperties | undefined): ReactElement => {
    if (!pin) return cell
    const props = cell.props as { style?: CSSProperties; className?: string }
    return cloneElement(cell as ReactElement<{ style?: CSSProperties; className?: string }>, {
      style: { ...pin, ...props.style },
      className: cn(props.className, 'bg-inherit'),
    })
  }

  // Statistical accounts track non-monetary quantities, so the journal never
  // posts transactions here - explain that instead of showing an empty table.
  if (statistical) {
    return (
      <Card>
        {/* Inside a Card, so no frame of its own. */}
        <EmptyState
          icon={<BarChart3 size={20} />}
          title="No transactions for statistical accounts"
          description="Statistical accounts track non-monetary quantities, like headcount or units. Journal entries never post to them - their balances are entered directly as memo figures."
        />
      </Card>
    )
  }

  return (
    <>
    {/* overflow-clip matches the Partners table wrapper - the full-bleed row
        dividers would otherwise square off the card's rounded corners. */}
    <Card className="overflow-clip flex-1 flex flex-col">
      <DragGhost ghostRef={txDrag.ghostRef} label={dragKey ? TX_COL_LABEL[dragKey] : null} hiding={txDrag.hiding} caps={false} />
      {/* Toolbar row 1: search + filters · count + density + columns. Its top edge
          is where a dragged header turns into a hide (tableColumns). */}
      <div data-col-hide-edge className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3.5 pb-2">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              /* Short enough to read whole. The long one ("Search description,
                 journal entry or document…") ran past the box and was cut off -
                 Eli: *"not particularly useful helper text if I can't even see
                 what's in the thing"*. The box searches every column, so the
                 hint no longer has to list them. */
              placeholder="Search transactions"
              aria-label="Search transactions"
              className="h-9 w-full pl-9 pr-8 text-sm bg-white rounded-lg border border-border shadow-xs focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
            />
            {q && (
              <button onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-bg-muted text-fg-subtle hover:text-fg">
                <X size={14} />
              </button>
            )}
          </div>
          <FiltersButton
            count={filtersActive}
            onOpen={() => setFiltersOpen(true)}
            onClear={() => setTxFilters(EMPTY_TX_FILTERS)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {/* Visible rows out of the full set, Partner-style count colours. */}
          <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
            <span className="text-fg">{fmtNumber(sorted.length)}</span>
            <span className="text-fg-muted/60"> of </span>
            <span className="text-fg-muted">{fmtNumber(transactions.length)}</span>
            <span className="text-fg-muted/70"> transactions</span>
          </span>
          <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
          {/* The toolbar pair, in this order and 6px apart (spec §1). Tree layout
              is not offered: this is a flat run of postings. */}
          <div className="flex items-center" style={{ gap: 6 }}>
            <DensityMenu
              value={look.density}
              onChange={d => setLook('density', d)}
              sections={lookSections({
                widths: { value: look.columnSizing, onChange: v => setLook('columnSizing', v) },
              })}
            />
            <button type="button" onClick={() => setColumnsOpen(o => !o)} className="fr-tool-btn"
              data-active={columnsOpen} aria-expanded={columnsOpen}
              style={{ ...TOOL_BTN, ...(columnsOpen ? TOOL_BTN_ACTIVE : null) }}>
              <Columns3 style={{ width: 18, height: 18, flexShrink: 0 }} />
              <span className="hidden md:inline">Columns</span>
              <span style={COUNT_BADGE}>{visibleCols.length}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar row 2: quick-filter pills, on the Partners rhythm
          (px-4 pt-3.5 pb-2 toolbar → px-4 pb-3 pills → border-t → table). */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
        {/* The date range leads the pill row, the way the ledger's Amount does:
            controls that open a panel on the left of the divider, the one-click
            filters on its right, and nothing standing beside Filters. Mahad,
            2026-09-30: *"add date filter next to the sorting pills ... as we have
            in other tables."* The shared insights picker (presets + two-month
            range calendar), drawn as the Amount pill is drawn. */}
        <PeriodSelector
          value={dateRange}
          onChange={setDateRange}
          variant="dropdown"
          presets={['7d', '30d', '90d', '365d', 'all']}
          triggerClassName={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer',
            dateRangeActive
              ? 'border-primary bg-accent text-primary font-medium hover:bg-[#DBEAFE] active:bg-[#BFDBFE]'
              : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted')}
        />
        <div className="w-px h-5 bg-border shrink-0 mx-0.5" />
        {TX_SIDES.map(s => (
          <QuickFilterPill
            key={s.key}
            label={s.label}
            count={sideCounts[s.key]}
            active={side === s.key}
            onClick={() => setSide(s.key)}
          />
        ))}
      </div>

      <div className="border-t border-border shrink-0" />

      {/* Active column-filter chips - without this a filter set from a column
          header menu is invisible and has no affordance to remove. Sits below
          the toolbar divider so its own border-b doesn't double up with it. */}
      <ColumnFiltersBar
        filters={colFilters}
        onChange={setColFilters}
        availableColumns={visibleCols.map(c => c.key)}
        labelOf={k => TX_COL_LABEL[k]}
        uniqueValuesOf={() => []}
        blankFilterOf={blankTxFilter}
      />
      <SearchRevealNote labels={revealed.map(k => TX_COL_LABEL[k])} />

      {/* Body row: filters + table area (shrinks) + docked Columns side panel. */}
      <div className="flex flex-1 items-stretch">
      <div className="flex-1 min-w-0 flex flex-col">
      <div ref={registerScrollRef} className="overflow-auto scrollbar-thin">
        {/* Default is the width the grid negotiates, Fit hugs the content and
            collects the spare width at the right, Equal splits the frame evenly
            between the visible columns (spec §7). */}
        <table
          className={cn('text-[13px]', look.columnSizing === 'fit' ? 'w-max min-w-full' : 'w-full', lookClass)}
          style={{ tableLayout: look.columnSizing === 'equal' ? 'fixed' : 'auto' }}
        >
          {/* Partners table chrome: sticky bg-muted/30 band with a hairline
              shadow, text-xs muted labels, [&>th]:h-8 condensed / h-10 comfort. */}
          <thead className="sticky top-0 z-30 bg-muted/30 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
            <tr ref={headRowRef} data-grid-head-row className={cn('border-b border-border bg-muted/30 hover:bg-muted/30 text-muted-foreground text-xs', density === 'condensed' ? '[&>th]:!h-8' : '[&>th]:!h-10')}>
              {colOrder.map(k => {
                const f = colFilters[k] ?? blankTxFilter(k)
                const hasFilter = filterActive(f)
                const active = sort?.key === k
                const right = TX_RIGHT.includes(k)
                // A frozen column's position is fixed by the run, so a drag on it
                // would only snap back.
                const frozen = leftPinRun.includes(k)
                const pin = txPinStyle(k, true)
                return (
                  <th key={k} data-tx-col={k} {...(frozen ? {} : makeDnd(k))} style={{ ...(regWindow.colFloor?.[k] ? { minWidth: regWindow.colFloor[k] } : null), ...pin, ...(dragKey === k ? draggedHeaderStyle(txDrag.hiding) : null) }}
                    className={cn('relative group/col h-10 pl-4 pr-2 align-middle font-normal text-muted-foreground whitespace-nowrap select-none',
                      // The header band is a 30% tint the thead and its row each paint
                      // translucently; a pinned cell has to resolve it to a solid
                      // colour of its own or scrolling columns show through it.
                      right ? 'text-right' : 'text-left',
                      frozen ? 'bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)]' : 'cursor-grab',
                      dragKey !== k && hasFilter && 'bg-primary/[0.03]')}>
                    {dragKey === k && <DragBar hiding={txDrag.hiding} />}
                    {!frozen && <GripVertical size={12} className={cn('absolute left-1 top-1/2 -translate-y-1/2 transition-opacity pointer-events-none', dragKey === k ? (txDrag.hiding ? 'opacity-100 text-danger-600' : 'opacity-100 text-primary') : 'text-fg-subtle/50 opacity-0 group-hover/col:opacity-100')} />}
                    <HeaderMenu
                      label={TX_COL_LABEL[k]}
                      sortable
                      currentSort={active ? sort!.dir : null}
                      onSortDir={d => setSort(d ? { key: k, dir: d } : null)}
                      filter={f}
                      onFilterChange={nf => setColFilters(prev => ({ ...prev, [k]: nf }))}
                      uniqueValues={[]}
                      align={right ? 'right' : undefined}
                      onHide={() => hideCol(k)}
                      onToggleFreeze={() => setFrozenCols(prev => prev.includes(k) ? prev.filter(c => c !== k) : [...prev, k])}
                      frozen={frozen}
                    >
                      <span style={active || hasFilter ? { color: 'hsl(var(--primary))' } : undefined}>{TX_COL_LABEL[k]}</span>
                      {hasFilter && !active && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'hsl(var(--primary))' }} />}
                      {active && sort?.dir === 'asc' && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: 'hsl(var(--primary))' }} />}
                      {active && sort?.dir === 'desc' && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: 'hsl(var(--primary))' }} />}
                      {!active && !hasFilter && <ArrowUpDown className="coa-col-hint w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/col:opacity-100 transition-opacity" />}
                    </HeaderMenu>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody ref={registerBodyRef}>
            {regWindow.first > 0 && (
              /* The blocks above the drawn ones: one row as tall as they are,
                 counting their rows so Row numbers below stay right. */
              <tr aria-hidden data-register-spacer="above" style={{ counterIncrement: `fr-row ${regWindow.rowsAbove}` }}>
                <td colSpan={colOrder.length} style={{ height: regWindow.spaceAbove, padding: 0 }} />
              </tr>
            )}
            {sorted.length === 0 && (
              <tr><td colSpan={colOrder.length} className="text-center py-10 text-fg-subtle text-[13px]">
                {/* An account that has been quiet for a month opens empty, and
                    has to say that is the dates rather than the account. */}
                {dateScoped.length === 0 && transactions.length > 0 ? (
                  <>
                    No transactions in {describePeriod(dateRange).replace(/^Last/, 'the last')}.{' '}
                    <button type="button" className="text-primary hover:underline" style={{ fontWeight: 600 }} onClick={() => setDateRange({ kind: 'preset', preset: 'all' })}>
                      Show all time
                    </button>
                  </>
                ) : 'No transactions match the filter.'}
              </td></tr>
            )}
            {sorted.slice(regWindow.first * BLOCK_SIZE, (regWindow.last + 1) * BLOCK_SIZE).map(t => {
              /* Money cell, shared by Debit and Credit. A non-base account gets
                 the posting card rather than the balance card: this is one line,
                 booked once at the rate of its day, and it is the balance it
                 rolls into that gets revalued - not the line. */
              const money = (side: 'debit' | 'credit') => {
                const v = t[side]
                if (!v) return <span className="text-fg-subtle">-</span>
                const label = <Marked text={txMoneyText(t, side, currency)} q={q} />
                // A line typed in this currency is the amount typed; there is no
                // booked restatement of it to explain.
                return currency !== base && !typedIn(t, currency)
                  ? <FxPostingTooltip code={currency} base={base} booked={v}><span className="cursor-help">{label}</span></FxPostingTooltip>
                  : label
              }
              const cell = (k: TxColKey) => {
                switch (k) {
                  case 'date': return (
                    <td key={k} className="text-[13px] text-muted-foreground whitespace-nowrap">
                      <Marked text={TX_CELL_TEXT.date(t, txCtx)} q={q} />
                    </td>
                  )
                  // The number opens the entry in the quick view: both sides, the
                  // status and the totals, without leaving the register the reader
                  // is working down. The panel's own "Open full entry" is the way
                  // through to the page for anyone who wants it.
                  case 'entry': return (
                    <td key={k} className="text-[13px] whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setQuickJe(t.jeNumber)}
                        className="inline-flex items-center gap-1.5 tabular-nums text-primary hover:text-[#0862D0] hover:underline underline-offset-2 transition-colors cursor-pointer"
                        style={{ fontWeight: 600 }}
                        title="Open journal entry"
                      >
                        <FileText size={12} className="text-primary/60 shrink-0" />
                        <Marked text={t.jeNumber} q={q} />
                      </button>
                    </td>
                  )
                  // The kind of thing that produced this posting. A reader
                  // scanning the register wants to know whether a $15,000 line
                  // came from a bill they can pay or a manual entry someone
                  // wrote - Source names that without an extra click.
                  case 'source': return (
                    <td key={k} className="text-[13px] text-slate-700 whitespace-nowrap">
                      <Marked text={sourceDocName(t.source)} q={q} />
                    </td>
                  )
                  case 'reference': return (
                    <td key={k} className="text-[13px] whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      {t.reference ? (
                        <LinkedDocLink source={t.source} reference={t.reference} q={q} />
                      ) : (
                        <span className="text-fg-subtle" title="Manual or adjusting entry - no source document">-</span>
                      )}
                    </td>
                  )
                  // Blank when the line carries no narration of its own; the
                  // entry's memo belongs to the entry, not to this row. One line,
                  // with the whole text on hover.
                  case 'description': return <td key={k} className="text-[13px] text-slate-800" style={{ fontWeight: 500 }}>{t.description ? <div className="truncate max-w-[340px]" title={t.description}><Marked text={t.description} q={q} /></div> : <span className="text-fg-subtle">-</span>}</td>
                  case 'dimensions': return <td key={k} className="text-[13px]"><DimensionPills dimensionValues={t.dimensionValues} q={q} /></td>
                  case 'debit': return <td key={k} className="text-[13px] text-right tabular-nums whitespace-nowrap text-slate-800">{money('debit')}</td>
                  case 'credit': return <td key={k} className="text-[13px] text-right tabular-nums whitespace-nowrap text-slate-800">{money('credit')}</td>
                  // Signed running balance after this posting - normal-side, so
                  // a negative reads as "below zero on this account's natural side".
                  case 'balance': return <td key={k} className="text-[13px] text-right tabular-nums whitespace-nowrap text-slate-900" style={{ fontWeight: 600 }}><Marked text={TX_CELL_TEXT.balance(t, txCtx)} q={q} /></td>
                }
              }
              // Row chrome copied from Cash Management's DataTable: #EFF6FF hover,
              // fixed per-density td height with zeroed padding, pl-4/pr-2 cells.
              return (
                <tr
                  key={t.id}
                  data-tree-account
                  data-export-row="leaf"
                  data-export-indent={0}
                  data-row-hover=""
                  className={cn('group border-b border-border-subtle bg-white hover:bg-[#F0F7FF] transition-colors duration-200 ease-out',
                    density === 'condensed'
                      ? '[&>td]:h-10 [&>td]:py-0 [&>td]:pl-4 [&>td]:pr-2'
                      : '[&>td]:h-12 [&>td]:py-0 [&>td]:pl-4 [&>td]:pr-2',
                  )}>
                  {colOrder.map(k => withTxPin(cell(k)!, txPinStyle(k)))}
                </tr>
              )
            })}
            {regWindow.spaceBelow > 0 && (
              <tr aria-hidden data-register-spacer="below">
                <td colSpan={colOrder.length} style={{ height: regWindow.spaceBelow, padding: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>

      <ColumnSelector
        open={columnsOpen}
        onOpenChange={setColumnsOpen}
        columns={TX_COLS.map(c => ({ key: c.key, label: c.label }))}
        columnOrder={order}
        columnVisibility={cols}
        onColumnOrderChange={o => setOrder(o as TxColKey[])}
        onColumnVisibilityChange={v => setCols(v as Record<TxColKey, boolean>)}
        defaults={{ visibility: Object.fromEntries(TX_COLS.map(c => [c.key, true])), order: TX_COL_ORDER }}
        frozenColumns={frozenCols}
        onToggleFreeze={k => setFrozenCols(prev => prev.includes(k as TxColKey) ? prev.filter(c => c !== k) : [...prev, k as TxColKey])}
        visual={{ values: look, offers: {}, onToggle: toggleVisual }}
      />
      </div>

      <TxFiltersModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={txFilters}
        setFilters={setTxFilters}
        transactions={transactions}
      />

      <JournalEntryQuickView jeNumber={quickJe} onClose={() => setQuickJe(null)} highlightAccountId={accountId} />
    </Card>
    </>
  )
}

// =========================
// Where used
// =========================
/* Placeholder. The old build read partners and items configured to post here,
   the open documents holding the account down, and a source breakdown. All of
   it was demo data - stand-in vendors from the partners store, deterministic
   fake invoice numbers, a role heuristic reading receivables/inventory out of
   the account's name - none of it wired to a real Where used graph.
   Kept the tab so a reader who opens the account tomorrow finds the shape of
   the answer where it will be, rather than having a tab appear later and read
   as a change of scope.

   Mahad, 2026-09-29: *"for the coming soon, we will be using this one"* - the
   Notes treatment. A tab waiting on a backend says so one way across the
   module, so this is `PlaceholderTab` like the rest and not an `EmptyState`,
   which is for a surface that works and happens to be empty. */
function WhereUsedTab() {
  return (
    <PlaceholderTab
      label="Where used"
      description="The partners, items and open documents pointing at this account will be listed here, so nothing that depends on it goes unseen before a change."
      icon={Search}
    />
  )
}

// =========================
// Notes and attachments - two of the four tabs every record carries
// =========================

/* The files kept against the account - its agreement, its signature card,
   whatever someone needs to find again (Eli: *"maybe it's the forming
   documents"*). The Partners attachments tab the journal entry page already
   uses, so a file reads the same on every record. */
function AccountAttachmentsTab({ account }: { account: Account }) {
  const files = useStore(s => s.accountAttachments[account.id])
  const setAccountAttachments = useStore(s => s.setAccountAttachments)
  return (
    <div className="flex flex-col">
      <AttachmentsTab
        files={files ?? NO_FILES}
        onFilesChange={next => setAccountAttachments(account.id, next.map(f => ({ ...f, id: String(f.id) })))}
        uploadedByName="Ahtisham Ahmad (You)"
        document={{ recordLabel: `${account.accountNumber} ${account.accountName}`, recordKind: 'account' }}
      />
    </div>
  )
}
const NO_FILES: AttachmentFile[] = []

// =========================
// Change history
// =========================
// Recent Activity - the Partner "Activity Timeline" card: circular icon +
// vertical rail feed, date on top, bold user + gray verb + blue target link.
function HistoryTab({ audit, account }: { audit: any[]; account: any }) {
  const accounts = useStore(s => s.accounts)
  const items: ActivityFeedItem[] = audit.map(a => {
    const type: ActivityFeedItemType =
      a.action === 'Create' ? 'create'
        : a.action === 'Edit' ? 'edit'
        : a.action === 'Merge' ? 'link'
        : a.action === 'Activate' || a.action === 'Deactivate' || a.action === 'Unarchive' ? 'apply'
        // 'Delete' only appears in the seeded log; archiving is 'Archive' now.
        : a.action === 'Delete' || a.action === 'Archive' ? 'delete'
        : 'info'
    let verb: string
    let target: string | undefined = account.accountName
    switch (a.action) {
      case 'Create': verb = 'created account'; break
      case 'Delete':
      case 'Archive': verb = 'archived the account'; target = undefined; break
      case 'Unarchive': verb = 'brought the account back from the archive'; target = undefined; break
      case 'Activate': verb = 'activated the account'; target = undefined; break
      case 'Deactivate': verb = 'marked the account as inactive'; target = undefined; break
      case 'Merge': verb = 'merged account'; break
      default: {
        // The parent is stored as an id, and an id is not a thing the reader can
        // look up. Said as the account it points at, the way every other entry
        // quotes a value they would recognise on the chart.
        const said = (v: unknown) => {
          if (String(a.field) !== 'parentId') return String(v)
          if (v === null || v === undefined || v === 'null') return 'none'
          const p = accounts.find(x => x.id === v)
          return p ? `${p.accountNumber} · ${p.accountName}` : String(v)
        }
        verb = a.field
          ? `updated ${auditFieldLabel(String(a.field))}${a.oldValue !== undefined ? ` (“${said(a.oldValue)}” → “${said(a.newValue)}”)` : ''} for`
          : 'updated the account profile'
      }
    }
    if (a.reason) verb += `: “${a.reason}”`
    return { id: a.id, type, user: cleanName(a.user), verb, target, date: fmtDate(a.timestamp) }
  })
  return (
    <ChartWidgetCard title="Activity Timeline" icon={Activity}>
      <ActivityFeed items={items} />
    </ChartWidgetCard>
  )
}
