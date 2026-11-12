import { Fragment, cloneElement, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ElementType, type ReactElement, type ReactNode } from 'react'
import { useRememberedState } from '../lib/rememberedState'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { MoreHorizontal, Lock, Pencil, ListFilter, CircleSlash, Archive, ArchiveRestore, Merge, Eye, EyeOff, Power, ArrowUp, ArrowDown, ArrowUpDown, ArrowLeftRight, Info, GripVertical, Plus, Minus, ChevronDown, ChevronRight, Filter, ChevronLeft, Search, X, Check, Wallet, BookPlus, CreditCard, Landmark, TrendingUp, TrendingDown, Snowflake, User, Trash2, CornerDownRight, FolderTree, GitBranch, Layers, BetweenHorizontalStart, BetweenHorizontalEnd } from 'lucide-react'
import { Account, AccountStatus, AccountType, StatementClassification, ACCOUNT_TYPE_META, categoryFirstNumber, CLASSIFICATIONS_BY_CATEGORY, CLASSIFICATION_DESCRIPTIONS, CLASSIFICATION_SPANS_CATEGORY, ALL_CLASSIFICATIONS, isCategoryRoot, GLAccountType, SELECTABLE_GL_ACCOUNT_TYPES, ALL_ACCOUNT_ROLES, isNumericAccountNumber, numberProtectionOn, classificationOverride } from '../types'

// The filter/sort stand-in for an account with no role. Roles are optional, so
// "unclassified" has to be a selectable facet value rather than an absence.
const NO_ROLE_LABEL = 'No role'
import { Badge, Marked, Menu, MenuItem, Tooltip, Select } from './ui'
import { DateField } from './DateField'
import { cn, fmtCurrency, invertedDates, invertedRange, localDayOf } from '../lib/utils'
import { AUDIT_HELP, GridComfort, PersonCell, StampCell, peopleIn, PERSON_PAD, personText } from './AuditCells'
import { ME_MODE } from '../lib/features'
import { currencyMeta, bookedFromBase, currentOwnBalanceOf, fxStanding, formatRate, PEGGED_TO_BASE, RATE_SOURCE, RATE_AS_OF, REVALUED_ON } from '../lib/currencies'
import { useStore, usePeriodScopedAccounts, lifecycleCtx, useAccountNumberText } from '../store'
import { actionToward, canDeleteAccount, planLifecycle, showsSummaryTotal, statusesFor, statusMeaningLines } from '../lib/accountLifecycle'
import type { LifecycleAction } from '../lib/accountLifecycle'
import { manualPostingLock } from '../lib/journalEntry'
import { byAccountNumber, buildChartIndex, type ChartIndex, type ChartFigures } from '../lib/chartTree'
import { NORMAL_BALANCE_HELP } from '../lib/normalBalanceCopy'
import { accountRange, formatRange, numberBeside } from '../lib/numberRange'
import { INTERNAL_ID_HELP, INTERNAL_ID_LABEL, internalIdSeq } from '../lib/internalId'
import { rowNumberGutter, type ColumnSizing, type TreeStyle } from './tableLook'
import { CurrencyFlag } from './CurrencyFlag'
import { FxAlert, FxHead, FxInset, FxLine, FxLines, FxNote, FxRateType } from './FxCard'
import { useColumnDragReorder, DragGhost, draggedHeaderStyle, DragBar } from './tableColumns'

// Frozen columns (Partner vendors pattern): Number + Name stay pinned to the
// left on horizontal scroll. They reorder only with each other; all other
// columns reorder among themselves and can't move into the frozen zone.
const FROZEN_KEYS: ColKey[] = ['number', 'name']
// A column the reader can neither hide nor unpin: the pair that names the row. Both
// views ask the same question of a column, so its header menu answers the same
// either way. Opening balance used to be locked too, as the figure the others are
// read against; design review, 2026-10-02 - Eli tried to drag it off and asked
// *"Why is it not letting you hide opening balance?"* It hides like any figure now.
export const isLockedCol = (k: ColKey) => k === 'number' || k === 'name'
// Name used to size itself from a responsive class in tree view and from a fixed
// pin width in list view, so the one column of the one listing came out a different
// width depending on which way you were looking at it. Both views now start from
// this number and both let the reader drag it, which is a better answer to a narrow
// scrollport than a breakpoint guessing on the reader's behalf.
const NAME_W_DEFAULT = 392
const FROZEN_W: Record<string, number> = { number: 76, name: NAME_W_DEFAULT }
// The widest the Number column sizes itself to before the numbers in it start
// clipping. Past this it is eating the Name column to show digits nobody is
// reading; the reader can still drag it wider.
const NUMBER_W_MAX = 168

/**
 * A default width for the Number column, taken from the numbers it actually
 * holds. 76px fits the four digits a chart usually numbers in, and an imported
 * chart that kept its own glued codes (100-1000-000) needs closer to three
 * times that - given the narrow default, every number wrapped onto three lines.
 * A width the reader drags still wins over this.
 */
function numberColWidth(accounts: Account[]): number {
  let longest = 0
  for (const a of accounts) longest = Math.max(longest, a.accountNumber.length)
  // 8px per character at text-sm tabular-nums, plus the cell's own padding.
  return Math.min(NUMBER_W_MAX, Math.max(FROZEN_W.number, longest * 8 + 18))
}
// Width of the leading selection (checkbox + "me" marker) column when the table
// is selectable. It pins flush against the left, shifting the frozen columns
// right by this amount.
const SELECT_W = 52
// Width a column keeps once pinned, so it stays roughly its natural size (a
// fixed width is required so following pinned columns stack flush). Each is at
// or above the column's min-width so the header and body cells stay aligned.
const FROZEN_FALLBACK_W: Record<string, number> = {
  type: 280, glType: 150, openingBalance: 150,
  runningBalance: 150,
  fxBalance: 160, currency: 110, status: 120,
  description: 240, effectiveDate: 120, posting: 120, dimensions: 160,
}
const isFrozenCol = (k: ColKey) => FROZEN_KEYS.includes(k)
const sameDragGroup = (a: ColKey, b: ColKey) => isFrozenCol(a) === isFrozenCol(b)

// ── Frozen (non-scrolling) regions ─────────────────────────────────────────
// Three regions never take part in horizontal scroll: GL account no. and GL
// account name pin to the left, Actions pins to the right. Everything between
// them scrolls. Pinning is applied as an inline style on those specific cells
// rather than through :first-child / :last-child selectors, because the
// full-width colSpan rows (insert handles, "Add row", the list's category band)
// are simultaneously the first AND last cell of their row, so positional
// selectors pinned them by accident.
//
// Stacking tiers. Within a row a frozen cell must outrank its scrolling
// siblings, or those cells paint over it as they pass underneath - which is what
// made the pinned number disappear once a category row stuck (the stuck-row rule
// raised every cell to one z-index, so DOM order decided the winner).
const Z_FROZEN = 2
const Z_INSERT = 5
const Z_STUCK = 6
const Z_STUCK_FROZEN = 7
const Z_HEAD_FROZEN = 9
// Opaque header fill (muted/30 composited over white) so a sticky header cell
// never shows columns scrolling underneath it.
//
// A flat colour, and it has to stay one. The layered form this used to take
// (a gradient over white) is a `background-image`, and the Row numbers gutter
// paints its rule and its row line into that same channel; a header cell
// wearing the stack would have lost them both.
const HEADER_FILL = 'color-mix(in srgb, hsl(var(--muted)) 30%, #ffffff)'
const LEFT_EDGE_SHADOW = 'inset -2px 0 0 0 hsl(var(--border)), 6px 0 8px -8px rgba(15,23,42,0.18)'
const RIGHT_EDGE_SHADOW = 'inset 1px 0 0 0 hsl(var(--border)), -6px 0 8px -6px rgba(15,23,42,0.12)'

interface PinOpts {
  header?: boolean
  z?: number
  background?: string
}

// Pins a cell to the left of the scrollport. `left` is the cumulative width of
// the frozen columns before it, so a fixed `width` is required on every pinned
// column except the last of the run.
function leftPinStyle({ left, width, edge, header, z, background }: PinOpts & {
  left: number
  width?: number
  // Separator + scroll shadow, drawn on the last column of the pinned run.
  edge?: boolean
}): CSSProperties {
  return {
    position: 'sticky',
    left,
    zIndex: z ?? (header ? Z_HEAD_FROZEN : Z_FROZEN),
    // The longhand, never the `background` shorthand: the shorthand resets
    // background-image, and that is where the Row numbers gutter draws.
    backgroundColor: background ?? (header ? HEADER_FILL : 'inherit'),
    // Match the row's background transition so frozen cells fade in step with
    // the rest of the row.
    transition: 'background-color 200ms ease-out',
    ...(width != null ? { width, minWidth: width, maxWidth: width } : null),
    boxShadow: edge ? LEFT_EDGE_SHADOW : undefined,
  }
}

// Pins the trailing Actions cell to the right. Nothing stacks beyond it, so it
// needs no fixed width.
/* The empty column in front of Actions. A table narrower than its frame - few
   columns showing, on a wide screen - has spare width to put somewhere, and the
   browser gave it to whichever columns had no fixed width. With every other
   column hidden that was Actions alone, which came out 1,700px wide on a 45-inch
   screen. Design review, 2026-10-02 - Nophil: *"action column should have a max
   length ... I don't need this much length on it."* This column holds nothing
   and takes the spare width instead, so Actions keeps the width of its button and
   stays pinned to the right edge. When the columns fill the frame it is zero
   wide. Counted in every full-width row's colSpan, as Actions is. */
/* How the spare width is steered. Actions asks for as little as it can and
   comes out the width of what it holds; the empty column asks for all of it,
   which the table grants out of whatever the real columns leave - so it is
   zero wide whenever they fill the frame, and the table still scrolls exactly
   as before when they overflow it. A column that asks for no width at all is
   handed a share of the spare in proportion to its content, which is how
   Status came out 1,700px wide once the empty column was there and Actions
   was not. */
const ACTIONS_HEAD_W = 1
const FILLER_W: CSSProperties = { width: '100%' }
/* Equal sizing lays the table out from its header widths alone and splits the
   frame evenly between the columns. The empty column steps out of the split,
   and Actions is held to the width of its buttons rather than an even share of
   a wide screen - one kebab, or a delete beside it on a chart being drafted. */
const EQUAL_FILLER_W: CSSProperties = { width: 0 }
const ACTIONS_EQUAL_W = 64
const ACTIONS_EQUAL_W_DRAFT = 96
const ACTIONS_FILLER_ATTR = 'data-actions-filler'
const fillerProps = { [ACTIONS_FILLER_ATTR]: '', 'aria-hidden': true, className: 'p-0' } as const

function rightPinStyle({ header, z, background }: PinOpts = {}): CSSProperties {
  return {
    position: 'sticky',
    right: 0,
    zIndex: z ?? (header ? Z_HEAD_FROZEN : Z_FROZEN),
    backgroundColor: background ?? (header ? HEADER_FILL : 'inherit'),
    transition: 'background-color 200ms ease-out',
    boxShadow: RIGHT_EDGE_SHADOW,
  }
}


// Type order for the tree's top-level groups.
const TYPE_ORDER_TREE: AccountType[] = ['AST', 'LIA', 'EQT', 'REV', 'EXP']

// Row order, shared with the chart index so a row's position in this table and
// its position in the tree can never disagree.
const byNumberThenName = byAccountNumber

export type Density = 'comfortable' | 'condensed'

/* ── What the Configure Visuals switches ask of the table ────────────────────
   Most of the look is drawn in `index.css` and reaches the table as one string
   of `fr-report--*` classes. These four cannot be: two of them change what is
   rendered, and two change the geometry the pinned columns are computed from.
   Everything here is optional, and left out the table draws as it always did. */
export interface TableLookProps {
  /** The `fr-report--*` modifiers, from `useTableLook().lookClass`. */
  className?: string
  /** `lines` is the disc-and-elbow this module has always drawn; `arrows` swaps
   *  it for plain chevrons and changes nothing else. */
  treeStyle?: TreeStyle
  /** `fit` and `equal` hand every width to the layout engine, which stands the
   *  drag handles, the drag widths and the frozen offsets down with them. */
  columnSizing?: ColumnSizing
  /** Opens the counter's gutter out of the first cell's left border, so that
   *  cell has to be that much wider. */
  rowNumbers?: boolean
  /** Lets the category heads pin under the column headings. Off, they scroll
   *  away like any other row. */
  pinGroups?: boolean
}

export interface ColumnConfig {
  number: boolean
  name: boolean
  numberRange: boolean
  type: boolean
  classification: boolean
  glType: boolean
  role: boolean
  normalBalance: boolean
  currency: boolean
  openingBalance: boolean
  fxBalance: boolean
  runningBalance: boolean
  status: boolean
  description: boolean
  dimensions: boolean
  effectiveDate: boolean
  posting: boolean
  internalId: boolean
  originalNumber: boolean
  imported: boolean
  restricted: boolean
  createdBy: boolean
  createdAt: boolean
  updatedBy: boolean
  updatedAt: boolean
}

export const DEFAULT_COLUMNS: ColumnConfig = {
  // Category (`type`) is hidden by default: in the tree view the sticky
  // per-category header rows already make each account's category obvious, so
  // repeating it on every row is redundant. Still available in the Columns panel.
  //
  // Statement classification is on, and for the opposite reason: nothing else on
  // the row says whether an asset is current or not, and it is the field that
  // decides which line of the statement the account prints on. A reader who does
  // not want it can switch it off like any other column.
  // The number range is its own column rather than a second line under the
  // number: a reservation is a fact about a summary, and stacked under the
  // number it could not be sorted, filtered, hidden or exported like one.
  number: true, name: true, numberRange: true, type: false, classification: true,
  // Role and Normal balance are both on: an account set up on the wrong side, or
  // classified as the wrong kind, throws off every statement it feeds, and the
  // only place a reader can catch that is a column they can scan.
  glType: true, role: true, normalBalance: true, currency: false, openingBalance: true, fxBalance: true,
  runningBalance: true, status: true,
  // Restricted is on: Eli asked for it on the main grid (2026-10-06).
  restricted: true, description: false, dimensions: false, effectiveDate: false, posting: false,
  // The internal ID and provenance, off until asked for. See DEFAULT_COLUMN_ORDER.
  internalId: false, originalNumber: false, imported: false,
  // Who added and last changed each account, and when. Off until asked for, like
  // the provenance pair: a question asked of the chart now and then, not a fact
  // read on every row. Still one switch away, and filterable from the Filters
  // panel without showing them at all.
  createdBy: false, createdAt: false, updatedBy: false, updatedAt: false,
}

/* What the two provenance columns read, kept here so the cell, the sort and the
   column filter cannot answer the same question three ways.

   An account can have arrived through an import and still have no code to show:
   a summary the file implied rather than stated. That is why `importedText` is
   not `arrivalCodeText(a) ? 'Yes' : 'No'` - the code answers "as what", and
   only the flag answers "did it". */
export const arrivalCodeText = (a: Account) => a.originalCode ?? ''
export const importedText = (a: Account) => (a.arrivedByImport ? 'Yes' : 'No')
export const restrictedText = (a: Account) => (a.restricted ? 'Yes' : 'No')
export const RESTRICTED_HELP = "Restricted accounts can only be seen by people with permission to view restricted accounts."

/* Who last changed an account, and when. An account nobody has touched since it
   was made was last changed when it was made, which is the answer the detail
   page's card gives too - a blank here would read as "never existed". */
export const modifiedByOf = (a: Account) => a.updatedBy || a.createdBy
export const modifiedAtOf = (a: Account) => a.updatedAt || a.createdAt

// Where a row sorts in the Number range column. An account reserving nothing
// sorts last ascending, the way an unclassified role does, so the column leads
// with the rows it can answer for.
const rangeSortValue = (a: Account) => accountRange(a)?.start ?? Number.MAX_SAFE_INTEGER

// Category cell: a colored, icon-led chip naming the account's Category.
export const CAT_CHIP: Record<string, { bg: string; text: string; border: string }> = {
  purple:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200' },
  warning: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200' },
  success: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  danger:  { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200' },
  info:    { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200' },
  brand:   { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  neutral: { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-200' },
}
export const CAT_ICON: Record<string, typeof Wallet> = {
  AST: Wallet, LIA: CreditCard, EQT: Landmark, REV: TrendingUp, EXP: TrendingDown,
}

/* Account role, as plain text. A chip would compete with the Category and GL
   type chips beside it for no gain: a role is a single value read straight down
   the column, not a status worth a colour. Only posting accounts can carry one,
   so a summary renders nothing at all rather than a dash - the blank reads as
   "not applicable", where an unclassified posting reads as "none set yet".
 *
 * Nothing on hover. It used to raise the full role card, which is the right thing
 * where a role is being chosen and the wrong thing in a column being scanned: a
 * pointer crossing the chart on its way anywhere threw a card over the rows
 * beneath it, and the reader who wanted the explanation was not the one who
 * triggered it. The card still opens where it is asked for - the role picker in
 * the create form, and the role field on the account. */
export function RoleCell({ account, q = '' }: { account: Account; q?: string }) {
  if (account.glAccountType !== 'Posting') return null
  if (!account.accountRole) return <span className="text-sm text-fg-subtle">-</span>
  return <span className="text-sm text-slate-700 whitespace-nowrap"><Marked text={account.accountRole} q={q} /></span>
}

// Normal balance: the side the account grows on. Never typed in on this screen -
// it comes from the category and flips when the account is marked contra. The
// column earns its width by making a backwards account visible in a scan,
// before it quietly skews a statement.
export function NormalBalanceCell({ account, q = '' }: { account: Account; q?: string }) {
  const nb = account.normalBalance
  if (nb === 'n/a') return <span className="text-xs text-fg-subtle/50">-</span>
  const tone = nb === 'Debit'
    ? 'border-sky-200 bg-sky-50 text-sky-700'
    : 'border-violet-200 bg-violet-50 text-violet-700'
  const cat = ACCOUNT_TYPE_META[account.accountType]?.label ?? 'account'
  return (
    <Tooltip content={account.isContra
      ? `${nb}, the opposite of the usual side for ${cat.toLowerCase()} accounts, because this one is marked contra.`
      : `${cat} accounts grow with ${nb.toLowerCase()}s, so their normal balance is ${nb}.`}>
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap align-middle cursor-help', tone)}>
        <Marked text={nb} q={q} />
      </span>
    </Tooltip>
  )
}

export function CategoryCell({ meta, q = '' }: {
  meta: (typeof ACCOUNT_TYPE_META)[AccountType]
  q?: string
}) {
  const c = CAT_CHIP[meta.color] ?? CAT_CHIP.neutral
  const Icon = CAT_ICON[meta.code] ?? Wallet
  return (
    /* `shrink-0` because the badge is a label, not a length. Mahad, 2026-09-21:
       *"I dont think the badge should cut off. Keep the badge as is in smaller
       screens. You can trunkate the Bold text next to it only."* On the category
       band row the badge shares the name cell with the account name, and a flex
       item that is allowed to shrink and clips its overflow will: narrow the
       window and "Asset" became "Asse", which names no category at all. The name
       beside it truncates to a name still recognisable, so the squeeze goes
       there. `max-w-full` stays as the floor, for a cell narrower than the badge
       alone. */
    <span className={cn('inline-flex shrink-0 items-stretch rounded-md border overflow-hidden text-xs max-w-full align-middle', c.border)}>
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 font-medium whitespace-nowrap', c.bg, c.text)}>
        <Icon className="w-3 h-3 shrink-0" />
        <Marked text={meta.label} q={q} />
      </span>
    </span>
  )
}

/* Statement classification cell. Plain text, because the column sits beside
   Category and a second chip of the same shape would make the pair read as one
   control rather than two facts.

   A category root is the one row that carries no answer here. It totals its
   whole category, and assets span current and non-current, so the value stored
   on it would be a statement line that lies. The cell reads as a dash, the same
   as every other column with nothing to say on a row - a sentence in a column
   of statement lines reads as one of them. What it spans is on hover, and on
   the account's own page. */
/* The override flag (decision 3; module review, 2026-10-06, COA-13): a child
   may print on another statement line than its parent's, and the chart says
   so beside the classification rather than leaving a reader to find it. */
export function ClassificationCell({ account, parent, q = '' }: { account: Account; parent?: Account; q?: string }) {
  if (isCategoryRoot(account)) {
    return (
      <Tooltip content={CLASSIFICATION_SPANS_CATEGORY[account.accountType]}>
        <span className="text-sm text-fg-subtle cursor-help">-</span>
      </Tooltip>
    )
  }
  const override = !!parent && classificationOverride(parent, account.statementClassification)
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      <Tooltip content={CLASSIFICATION_DESCRIPTIONS[account.statementClassification]}>
        <span className="block truncate text-sm text-slate-700 cursor-help"><Marked text={account.statementClassification} q={q} /></span>
      </Tooltip>
      {override && (
        <Tooltip content={`An override: its parent, ${parent!.accountNumber} ${parent!.accountName}, is ${parent!.statementClassification.toLowerCase()}.`}>
          <span data-classification-override className="shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-2xs leading-none bg-warning-50 text-warning-700 border border-warning-100 cursor-help" style={{ fontWeight: 600 }}>Override</span>
        </Tooltip>
      )}
    </span>
  )
}

// Small blue "New" pill shown next to the name of an account created during the
// current session (tracked in store.newAccountIds). Self-subscribes so it clears
// automatically when the id leaves that set.
export function NewBadge({ id }: { id: string }) {
  const isNew = useStore(s => s.newAccountIds.includes(id))
  if (!isNew) return null
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-semibold leading-none bg-info-50 text-info-700 border border-info-100 shrink-0">
      New
    </span>
  )
}

// A distinct chip colour per Account Type (glType) so the structural role is
// scannable. These tones are deliberately kept off the Category palette
// (purple / amber / teal / green / red / neutral) so the two columns never
// share a colour.
// Match the Partner Management vendors table's "type" column chip exactly
// (rounded-full border px-2.5 py-0.5 text-xs, natural height). Our shared
// `.chip` base is smaller (px-2, fixed h-[22px], text-2xs), so override those
// dimensions per-instance with important utilities for the Category and
// Account Type column chips.
export const PARTNER_CHIP_CLS = '!px-2.5 !py-0.5 !h-auto !text-xs !rounded-md'

export const GL_TYPE_TONE: Record<GLAccountType, 'info' | 'indigo'> = {
  'Posting': 'info',
  'Summary': 'indigo',
}

// Given the full chart and the ids of the rows a search/filter matched, return
// the ids of every summary account above each match, so a narrowed view still
// shows each match in its place rather than stranded at the top level.
export function ancestorGroupIds(all: Account[], matchedIds: Set<string>): Set<string> {
  const index = buildChartIndex(all)
  const keep = new Set<string>()
  for (const id of matchedIds) {
    for (const p of index.ancestorsOf(id)) keep.add(p.id)
  }
  return keep
}

/* The matches, plus the summaries above them, in one array for the tree to draw.
   The ancestors are context and never results: they are appended rather than
   folded in, and the caller keeps the match array it passed in to count, aggregate
   and export from.
 *
 * Searching PAYROLL used to hand one array to everything, so three matching
 * accounts and their nine ancestors reported "12 results" - and the flat List
 * view, which has no hierarchy to place anything in, drew all nine as though they
 * had matched too. */
export function withAncestorContext(all: Account[], matches: Account[], includeArchived: boolean): Account[] {
  const matchedIds = new Set(matches.map(a => a.id))
  const ancestors = ancestorGroupIds(all, matchedIds)
  const extras = all.filter(a => ancestors.has(a.id) && !matchedIds.has(a.id) && (includeArchived || a.status !== 'Archived'))
  return extras.length ? [...matches, ...extras] : matches
}

// Prefill payload handed to the parent when an inline "+ row" escalates to the
// full Create Account modal (July 9 spec §3). Carries everything typed/derived
// inline - number, name, the Category, the GL Account Type, and the derived
// classification - so the modal opens pre-filled and the user only completes the rest.
export interface CreateRowPrefill {
  accountNumber?: string
  accountName?: string
  accountType?: AccountType
  glAccountType?: GLAccountType
  statementClassification?: StatementClassification
  // The summary the click landed inside, so the create modal opens with the
  // parent already chosen.
  parentId?: string | null
}

// The summary an insertion point falls inside: clicking under a summary row puts
// the new account in it, and clicking anywhere else puts it beside the row it
// landed on. Null only above the statement divisions, which have no parent.
export function enclosingGroupId(prev: Account | null, next: Account | null): string | null {
  const anchor = prev ?? next
  if (!anchor) return null
  return anchor.glAccountType === 'Summary' ? anchor.id : anchor.parentId ?? null
}

// Auto-number heuristic for a between-row insertion (spec §2). Picks a free
// number in the gap between the neighbouring rows' numbers; at a category edge
// it steps off the single neighbour, and with no neighbours it falls back to the
// category's own classification band. Correctness over cleverness: the result never
// collides with the immediate visible neighbours when a gap exists.
export function suggestNumberBetween(prev: Account | null, next: Account | null, category: AccountType, all: Account[]): string {
  /* Every neighbour read here has to be a number, because the whole suggestion is
     arithmetic. A lettered neighbour is skipped rather than stripped down to its
     digits, which would step off a number nobody has. */
  const numeric = (a: Account | null) => (a && isNumericAccountNumber(a.accountNumber) ? a.accountNumber : null)
  const width = (numeric(prev) ?? numeric(next) ?? '0000').length || 4
  const pad = (n: number) => String(Math.max(0, Math.round(n))).padStart(width, '0')
  const N = (a: Account | null) => { const v = numeric(a); return v == null ? null : parseInt(v, 10) }
  const n1 = N(prev), n2 = N(next)
  const raw = (() => {
    if (n1 != null && n2 != null) return n2 - n1 >= 2 ? Math.floor((n1 + n2) / 2) : n1 + 1
    if (n1 != null) return n1 + 10
    if (n2 != null) return Math.max(1, n2 - 10)
    const catNums = all
      .filter(a => a.accountType === category && isNumericAccountNumber(a.accountNumber))
      .map(a => parseInt(a.accountNumber, 10))
    if (catNums.length) return Math.max(...catNums) + 10
    return categoryFirstNumber(category, width)
  })()
  /* Being in use is the only way the suggestion can be wrong. The summary it
     lands under reserves no block, so there is no band to keep it inside. */
  const taken = new Set(all.filter(a => isNumericAccountNumber(a.accountNumber)).map(a => parseInt(a.accountNumber, 10)))
  for (let n = raw; n < raw + 1000; n++) if (!taken.has(n)) return pad(n)
  return pad(raw)
}

// classification preset for a between-row insertion: prefer a same-category neighbour's
// section, else the category's first section. Shown to the modal, never inline.
function classificationBetween(prev: Account | null, next: Account | null, category: AccountType): StatementClassification {
  if (prev && prev.accountType === category) return prev.statementClassification
  if (next && next.accountType === category) return next.statementClassification
  return CLASSIFICATIONS_BY_CATEGORY[category][0]
}

// Inline draft row (spec §2). A lightweight editable row placed AT the chosen
// insertion point: free-text Name, an auto-populated but editable Number, a
// GL-Account-Type select (defaults to Posting), and a read-only Category chip
// preset from the insertion context. Confirming (Create button / Enter) always
// escalates to the Create Account modal pre-filled with everything
// entered/derived (via onCreateRow); there is no direct inline-save path.
// Per-column horizontal padding for the column-aligned inline draft row, kept in
// step with AccountRow's cells so an empty draft cell lines up under its header.
const DRAFT_COL_PAD: Record<ColKey, string> = {
  name: 'pr-4', number: 'pl-2 pr-0', numberRange: 'px-4', type: 'px-4', classification: 'px-4', glType: 'pl-6 pr-3', role: 'px-4',
  normalBalance: 'px-4', posting: 'px-4', currency: 'px-4',
  openingBalance: 'pl-4 pr-4',
  runningBalance: 'pl-4 pr-4',
  fxBalance: 'pl-2 pr-2', status: 'px-4', description: 'px-4', dimensions: 'px-4', effectiveDate: 'px-4',
  internalId: 'px-4', originalNumber: 'px-4', imported: 'px-4', restricted: 'px-4',
  createdBy: 'px-4', createdAt: 'px-4', updatedBy: 'px-4', updatedAt: 'px-4',
}

function InlineDraftRow({ colSpan, indent, prev, next, category, allAccounts, density, onCreateRow, onCancel, order, selectable, readOnly, numberW = FROZEN_W.number, nameW = FROZEN_W.name }: {
  colSpan: number
  indent: number
  prev: Account | null
  next: Account | null
  category: AccountType
  allAccounts: Account[]
  density: Density
  onCreateRow?: (prefill: CreateRowPrefill) => void
  onCancel: () => void
  // When supplied (list view), the draft renders as real per-column <td> cells
  // aligned to this column order + AccountRow's leading select / trailing action
  // cells. Absent (tree view), it falls back to the single-cell flex layout.
  order?: ColKey[]
  selectable?: boolean
  readOnly?: boolean
  /** Resolved widths of the two pinned columns, so the draft's cells line up with
   *  the rows around it once the reader has dragged either one. */
  numberW?: number
  nameW?: number
}) {
  const meta = ACCOUNT_TYPE_META[category]
  const [num, setNum] = useState(() => suggestNumberBetween(prev, next, category, allAccounts))
  const [name, setName] = useState('')
  const [glType, setGlType] = useState<GLAccountType>('Posting')
  const section = classificationBetween(prev, next, category)
  const padCls = density === 'condensed' ? 'py-1.5' : 'py-2'
  // Column-aligned draft cells get extra top padding so the row breathes below
  // the insertion point (more space above the inputs than a normal data row).
  const draftPad = density === 'condensed' ? 'pt-3.5 pb-1.5' : 'pt-5 pb-2'
  // Inline validation: require a number and a name before escalating to the
  // modal. Errors surface only after a submit attempt.
  const [attempted, setAttempted] = useState(false)
  const numErr = attempted && !num.trim()
  const nameErr = attempted && !name.trim()
  const submit = () => {
    if (!num.trim() || !name.trim()) { setAttempted(true); return }
    onCreateRow?.({
      accountNumber: num.trim() || undefined,
      accountName: name.trim() || undefined,
      accountType: category,
      glAccountType: glType,
      statementClassification: section,
      parentId: enclosingGroupId(prev, next),
    })
    onCancel()
  }
  // preventDefault on Enter so an inline submit never triggers a native form
  // submit / full-page reload.
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); submit() }
    if (e.key === 'Escape') onCancel()
  }
  const errCls = 'border-red-400 focus:ring-red-300'
  // Create escalates to the full Create Account modal, pre-filled with
  // everything entered/derived so far. An account can only be created from
  // inside the modal - there is no direct inline-save path.
  const actions = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={submit}
        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
      >
        <Check size={13} /> Create
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-fg-subtle hover:bg-bg-subtle transition-colors"
        aria-label="Cancel"
      >
        <X size={14} />
      </button>
    </div>
  )

  // Column-aligned layout (list view): real <td> cells matching AccountRow.
  if (order) {
    const inputCls = 'h-8 w-full rounded-md border border-border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
    // The draft row's tint is translucent, and a pinned cell must be opaque or
    // the columns sliding beneath it show through - so use the tint pre-composited
    // over white (#F0F7FF at 70%) instead of inheriting the row's background.
    const draftFill = '#F5F9FF'
    const selectLeft = selectable ? SELECT_W : 0
    const cell = (k: ColKey) => {
      switch (k) {
        case 'number': return (
          <td key={k} className={cn('pl-2 pr-0 align-top', draftPad)} style={leftPinStyle({ left: selectLeft, width: numberW, background: draftFill })}>
            <input
              value={num}
              onChange={e => { setNum(e.target.value); if (attempted) setAttempted(false) }}
              onKeyDown={onKey}
              aria-label="Account number"
              aria-invalid={numErr || undefined}
              className={cn(inputCls, 'tabular-nums px-1.5', numErr && errCls)}
            />
            <span className={cn('block mt-0.5 text-[9px] leading-tight whitespace-nowrap', numErr ? 'text-red-500' : 'text-fg-subtle')}>{numErr ? 'Required' : 'Next suggested'}</span>
          </td>
        )
        case 'name': return (
          <td key={k} className={cn('pr-4 align-top', draftPad)} style={{ ...leftPinStyle({ left: selectLeft + numberW, width: nameW, edge: true, background: draftFill }), paddingLeft: 12 }}>
            <input
              autoFocus
              value={name}
              onChange={e => { setName(e.target.value); if (attempted) setAttempted(false) }}
              onKeyDown={onKey}
              placeholder="Account name"
              aria-label="Account name"
              aria-invalid={nameErr || undefined}
              className={cn(inputCls, nameErr && errCls)}
            />
            {nameErr && <span className="block mt-0.5 text-[10px] leading-tight text-red-500">Enter an account name</span>}
          </td>
        )
        // Category - preset from context, read-only chip (not editable inline).
        case 'type': return <td key={k} className={cn('px-4 align-top', draftPad)}><CategoryCell meta={meta} /></td>
        case 'classification': return <td key={k} className={cn('px-4 align-top text-sm text-slate-500', draftPad)}>{classificationBetween(prev, next, category)}</td>
        case 'glType': return (
          <td key={k} className={cn('pl-6 pr-3 align-top', draftPad)}>
            <Select
              searchable
              openDown
              searchPlaceholder="Search types…"
              aria-label="GL account type"
              value={glType}
              onChange={e => setGlType(e.target.value as GLAccountType)}
            >
              {SELECTABLE_GL_ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </td>
        )
        default: return <td key={k} className={cn(DRAFT_COL_PAD[k], 'align-top', draftPad)} />
      }
    }
    return (
      <tr className="border-y border-primary/30 bg-[#F0F7FF]/70" onClick={e => e.stopPropagation()}>
        {selectable && (
          <td
            className={cn('pl-4 pr-1 align-top', draftPad)}
            style={leftPinStyle({ left: 0, width: SELECT_W, background: draftFill })}
          />
        )}
        {order.map(k => cell(k))}
        {!readOnly && <td {...fillerProps} style={FILLER_W} />}
        {!readOnly && (
          <td className={cn('px-2 align-top', draftPad)} style={rightPinStyle({ background: draftFill })}>{actions}</td>
        )}
      </tr>
    )
  }

  // Fallback single-cell layout (tree view / non-column contexts).
  return (
    <tr className="border-y border-primary/30 bg-[#F0F7FF]/70">
      <td colSpan={colSpan} className={cn('px-4', padCls)} style={{ paddingLeft: indent }} onClick={e => e.stopPropagation()}>
        {/* Full-width cell: keep the editor beside the pinned columns instead of
            letting it scroll off with the middle columns. */}
        <div className="flex items-center gap-2 flex-wrap" style={{ position: 'sticky', left: 0, width: 'max-content' }}>
          {/* Category - preset from context, read-only chip (not editable inline). */}
          <CategoryCell meta={meta} />
          <input
            value={num}
            onChange={e => { setNum(e.target.value); if (attempted) setAttempted(false) }}
            onKeyDown={onKey}
            placeholder="Number"
            aria-label="Account number"
            aria-invalid={numErr || undefined}
            className={cn('h-8 w-24 rounded-md border border-border px-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30', numErr && errCls)}
          />
          <input
            autoFocus
            value={name}
            onChange={e => { setName(e.target.value); if (attempted) setAttempted(false) }}
            onKeyDown={onKey}
            placeholder="Account name"
            aria-label="Account name"
            aria-invalid={nameErr || undefined}
            className={cn('h-8 w-56 rounded-md border border-border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30', nameErr && errCls)}
          />
          <div className="w-40">
            <Select
              searchable
              openDown
              searchPlaceholder="Search types…"
              aria-label="GL account type"
              value={glType}
              onChange={e => setGlType(e.target.value as GLAccountType)}
            >
              {SELECTABLE_GL_ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          {actions}
        </div>
      </td>
    </tr>
  )
}

// Between-row insertion affordance (spec §1). Collapsed it's a thin insertion
// line with a small "+" that reveals on hover, straddling the gap between two
// adjacent rows without taking layout space (a zero-height row whose control is
// absolutely centred on the boundary). Clicking it opens the InlineDraftRow at
// that position. When `active`, it renders that draft row instead of the handle.
function InsertRow({ colSpan, indent, active, onActivate, onCancel, prev, next, category, allAccounts, density, onCreateRow, order, selectable, readOnly, directCreate, numberW, nameW }: {
  colSpan: number
  indent: number
  active: boolean
  onActivate: () => void
  onCancel: () => void
  prev: Account | null
  next: Account | null
  category: AccountType
  allAccounts: Account[]
  density: Density
  onCreateRow?: (prefill: CreateRowPrefill) => void
  // Threaded through to the expanded draft so the list view can render
  // per-column cells; the collapsed handle below always spans full width.
  order?: ColKey[]
  selectable?: boolean
  readOnly?: boolean
  // When set, clicking the "+" skips the inline draft editor and opens the
  // full Create GL Account modal straight away (pre-filled with the derived
  // number / category / section). Used by the Build-from-Scratch flow.
  directCreate?: boolean
  numberW?: number
  nameW?: number
}) {
  // No creation handler wired → no inline insert affordance at all (avoids a
  // dead "+" / Create button in read-only or non-wired tables).
  if (!onCreateRow) return null
  // Only offer an insertion point where a number actually fits between the two
  // neighbours. Consecutive numbers (e.g. 1199 → 1200) leave no room, so the
  // hover affordance is hidden entirely; a gap (e.g. 1210 → 1215) shows it.
  // Group boundaries (prev/next null) always allow an insert.
  /* A lettered number names no point on the number line, so there is no gap to
     measure against it and the affordance is offered as it is at a boundary. */
  const numOfAcc = (a: Account | null) =>
    a && isNumericAccountNumber(a.accountNumber) ? parseInt(a.accountNumber, 10) : null
  const prevNum = numOfAcc(prev), nextNum = numOfAcc(next)
  if (prevNum != null && nextNum != null && nextNum - prevNum < 2) return null
  const openDirect = () => onCreateRow({
    accountNumber: suggestNumberBetween(prev, next, category, allAccounts),
    accountType: category,
    glAccountType: 'Posting',
    statementClassification: classificationBetween(prev, next, category),
    parentId: enclosingGroupId(prev, next),
  })
  if (active && !directCreate) {
    return <InlineDraftRow colSpan={colSpan} indent={indent} prev={prev} next={next} category={category} allAccounts={allAccounts} density={density} onCreateRow={onCreateRow} onCancel={onCancel} order={order} selectable={selectable} readOnly={readOnly} numberW={numberW} nameW={nameW} />
  }
  return (
    // The handle straddles the boundary between the previous and next rows via a
    // negative top on a zero-height row. The next row is later in the DOM and
    // paints over static content, so the cell is raised (Z_INSERT) to sit above
    // adjacent body rows - including their pinned cells - so the reveal is never
    // clipped.
    <tr aria-hidden>
      <td colSpan={colSpan} className="p-0 relative" style={{ zIndex: Z_INSERT }}>
        <div className="relative h-0">
          <div
            onClick={directCreate ? openDirect : onActivate}
            title="Insert account here"
            className="group/ins absolute inset-x-0 -top-[9px] h-[18px] flex items-center cursor-pointer"
          >
            <span
              className="absolute h-px bg-primary/70 opacity-0 group-hover/ins:opacity-100 transition-opacity"
              style={{ left: indent, right: 8 }}
            />
            {/* Badge lives in this full-width cell (never clipped by a column
                edge); clamp its left so it stays fully visible near the gutter.
                The zero-width sticky wrapper keeps it in view while the columns
                scroll horizontally underneath. */}
            <span style={{ position: 'sticky', left: Math.max(4, indent - 8), width: 0 }}>
              <span
                className="absolute top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white shadow-sm ring-2 ring-white opacity-0 group-hover/ins:opacity-100 transition-opacity"
                style={{ left: 0 }}
              >
                <Plus size={11} />
              </span>
            </span>
          </div>
        </div>
      </td>
    </tr>
  )
}

// Inline "+ row" insertion control (July 9 spec §1). Collapsed, it's a "+ Add
// row" affordance at an insertion point. Expanded, it becomes an editable row
// with GL number + name inputs and a "Create account" button that opens the
// creation modal pre-filled with what was typed (via the optional onCreateRow
// callback the parent wires up).
function AddRowControl({ colSpan, indent = 14, onCreateRow, accountType, density, directCreate }: {
  colSpan: number
  indent?: number
  onCreateRow?: (prefill: CreateRowPrefill) => void
  accountType?: AccountType
  density: Density
  // Open the Create GL Account modal directly instead of the inline editor.
  directCreate?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [num, setNum] = useState('')
  const [name, setName] = useState('')
  const padCls = density === 'condensed' ? 'py-1' : 'py-2'
  const reset = () => { setNum(''); setName(''); setEditing(false) }
  const create = () => {
    onCreateRow?.({ accountNumber: num.trim() || undefined, accountName: name.trim() || undefined, accountType })
    reset()
  }
  return (
    <tr className="border-b border-border-subtle bg-white hover:bg-[#F0F7FF]/40 transition-colors">
      <td colSpan={colSpan} className={cn('px-4', padCls)} style={{ paddingLeft: indent }} onClick={e => e.stopPropagation()}>
        {/* Full-width cell: keep its content beside the pinned columns instead of
            letting it scroll off with the middle columns. */}
        <div style={{ position: 'sticky', left: 0, width: 'max-content' }}>
        {!editing ? (
          <button
            type="button"
            onClick={() => directCreate ? onCreateRow?.({ accountType }) : setEditing(true)}
            className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-primary hover:underline whitespace-nowrap"
            style={{ fontWeight: 500 }}
          >
            <Plus size={13} /> Add row
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              autoFocus
              value={num}
              onChange={e => setNum(e.target.value)}
              placeholder="Number"
              className="h-8 w-24 rounded-md border border-border px-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') reset() }}
              placeholder="Account name"
              className="h-8 w-56 rounded-md border border-border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={create}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Check size={13} /> Create account
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md text-fg-subtle hover:bg-bg-subtle transition-colors"
              aria-label="Cancel"
            >
              <X size={14} />
            </button>
          </div>
        )}
        </div>
      </td>
    </tr>
  )
}

// Whether postings may be entered directly (Fields spec "Direct Posting"): a
// summary account holds the total of what is under it, so it never takes an
// entry of its own.
export function isDirectPosting(a: Account): boolean {
  return a.glAccountType === 'Posting'
}

// Absolute amount with thousands separators and two decimals: "5,000.00".
function fmtAmount(n: number) {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Money cell: the negative sign precedes the symbol, then a space, then the
// amount - "-$ 5,000.00" / "$ 10,000.00" (matches the data-table convention).
function fmtMoney(n: number, symbol: string) {
  const sign = n < 0 ? '-' : ''
  return `${sign}${symbol} ${fmtAmount(n)}`
}

function fmtBalance(_a: Account, value: number, base: string) {
  // Balances are in the tenant base currency, so use its symbol (e.g. "$").
  return fmtMoney(value, symbolFor(base))
}

/** What a figure column prints for an account, as text - read by the cell and by
 *  the search alike, so a search finds the figure the reader sees. Empty where
 *  the cell prints a dash or nothing. */
export function chartFigureText(k: 'openingBalance' | 'runningBalance' | 'fxBalance', a: Account, index: ChartIndex, base: string): string {
  if (k === 'fxBalance') return a.currencyCode !== base ? fmtMoney(currentOwnBalanceOf(a), symbolFor(a.currencyCode)) : ''
  const vals = chartRowValues(a, index)
  if (!vals) return ''
  return fmtBalance(a, k === 'openingBalance' ? vals.balance - vals.netChange : vals.current, base)
}

// Currency symbol for the FX Balance column (the account's own currency).
const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', HKD: 'HK$', JPY: '¥', CNY: 'CN¥', INR: '₹', PKR: '₨', AED: 'AED' }
const symbolFor = (code: string) => CURRENCY_SYMBOL[code] ?? code

// Signed amount for a movement whose direction is worth reading: "+$ 724.87".
// Separate from fmtMoney, which leaves a positive bare because a balance is not
// a movement.
function fmtMoneySigned(n: number, symbol: string) {
  return `${n < 0 ? '-' : '+'}${symbol} ${fmtAmount(n)}`
}

// Card header shared by the balance and posting cards: flag, full name, and the
// reminder that this is the account's currency rather than the company's. The
// parts come from FxCard, the currency card every module shares.
function FxCardHeader({ code }: { code: string }) {
  const m = currencyMeta(code)
  return <FxHead flag={<CurrencyFlag meta={m} className="text-[15px] leading-none" />} name={m.name} code={m.code} role="account currency" />
}

// The rate a figure was struck at, "1 USD = £0.7862 GBP".
const fxRate = (base: string, code: string, rate: number) => `1 ${base} = ${symbolFor(code)}${formatRate(rate)} ${code}`

/* Hover card for the converted Running balance on a foreign-currency account.

   It hung off the Foreign balance column, which is the one figure on the row
   that no rate was applied to - the account's own balance, stated as the
   account holds it. The card explains a conversion, so it belongs on the
   converted figure.

   Three figures, in the order an accountant reads them: the balance in the
   account's own currency, the base-currency value actually booked - with the
   rate and date it was struck at - and only then what today's rate would make
   of it.

   The booked leg comes first because it is the figure the ledger carries and
   the one every total adds up. The indicative leg is fenced into its own block
   and says outright that the difference has not reached FX Gain/Loss: an
   unrealized movement shown beside a booked figure is otherwise read as money
   that has already been posted. */
export function FxBalanceTooltip({ code, base, booked, own, children }: { code: string; base: string; booked: number; /** The balance in its own currency, where it differs from the restatement. */ own?: number; children: React.ReactNode }) {
  const fx = fxStanding(booked, code, own)
  const card = (
    <div className="p-[12px] whitespace-nowrap">
      <FxCardHeader code={code} />
      <FxLines>
        <FxLine label={`Balance in ${code}`} value={`${fmtMoney(fx.own, symbolFor(code))} ${code}`} />
      </FxLines>
      <FxInset>
        <FxLine strong label={`Booked in ${base}`} value={`${fmtMoney(fx.booked, symbolFor(base))} ${base}`} />
        <FxNote>Revalued at {fxRate(base, code, fx.bookedRate)} · {REVALUED_ON}</FxNote>
        <FxNote small>Carried in the ledger. Column totals add this figure.</FxNote>
      </FxInset>
      {PEGGED_TO_BASE.has(code) ? (
        /* A peg has no unrealized movement to report, and an "Unrealized $ 0.00"
           line would read as a revaluation waiting to be posted rather than as a
           rate that cannot move. */
        <div className="mt-[8px]">
          <FxNote>{code} is pegged to {base} at {symbolFor(code)}{formatRate(fx.rate)}, so there is no unrealized difference.</FxNote>
        </div>
      ) : (
        <FxInset tone="amber">
          <FxLine label="At today's rate" value={`${fmtMoney(fx.indicative, symbolFor(base))} ${base}`} />
          {/* Deliberately not coloured as a gain or a loss. Whether a rise in the
              base value is one or the other depends on which side of the balance
              sheet the account sits, and the cell does not know. */}
          <FxLine label="Unrealized difference" value={`${fmtMoneySigned(fx.difference, symbolFor(base))} ${base}`} />
          <FxAlert>Not yet posted to FX Gain/Loss</FxAlert>
          <FxNote>{fxRate(base, code, fx.rate)}</FxNote>
          <FxRateType type="mid" label="Mid-market" source={RATE_SOURCE} />
          <FxNote small>Indicative only, as of {RATE_AS_OF}</FxNote>
        </FxInset>
      )}
    </div>
  )
  return <Tooltip rich align="right" side="top" content={card}>{children}</Tooltip>
}

/* Hover card for a single posting on a foreign-currency account.

   Deliberately shorter than the balance card: a posting is booked once, at the
   rate in force that day, and is never revalued - only the balance it rolls
   into is. Offering it an unrealized difference would invent a revaluation that
   does not apply to it. */
export function FxPostingTooltip({ code, base, booked, children }: { code: string; base: string; booked: number; children: React.ReactNode }) {
  const fx = fxStanding(booked, code)
  const card = (
    <div className="p-[12px] whitespace-nowrap">
      <FxCardHeader code={code} />
      <FxInset>
        <FxLine strong label={`Booked in ${base}`} value={`${fmtMoney(fx.booked, symbolFor(base))} ${base}`} />
        <FxNote>At {fxRate(base, code, fx.bookedRate)} · {REVALUED_ON}</FxNote>
        <FxNote small>The rate this posting was booked at, not today's.</FxNote>
      </FxInset>
    </div>
  )
  return <Tooltip rich align="right" side="top" content={card}>{children}</Tooltip>
}

/* Hover card for a base-currency figure on a foreign-currency account - the
   Opening balance column and the matching KPI.

   It used to say the figure had been "converted from EUR at the mid-market
   rate", which describes a conversion this app performs rather than the entry
   the ledger holds, and contradicted the Foreign balance card one column over.
   The figure is the booked base value; the account's own currency is the second
   reading of that same entry, at the rate it was struck at. Both legs come from
   fxStanding, so the two cards cannot quote different numbers for one row. */
function bookedBaseCard(code: string, base: string, booked: number) {
  const fx = fxStanding(booked, code)
  return (
    <div className="p-[12px] whitespace-nowrap">
      <FxCardHeader code={code} />
      <FxLines>
        <FxLine label={`In ${code}`} value={`${fmtMoney(fx.own, symbolFor(code))} ${code}`} />
      </FxLines>
      <FxInset>
        <FxLine strong label={`Booked in ${base}`} value={`${fmtMoney(fx.booked, symbolFor(base))} ${base}`} />
        <FxNote>Revalued at {fxRate(base, code, fx.bookedRate)} · {REVALUED_ON}</FxNote>
      </FxInset>
    </div>
  )
}

// Small leading marker before a base-currency amount on a foreign-currency
// account. It carries no tooltip of its own - the wrapping BookedBaseTooltip
// covers both the icon and the number, so hovering either opens the card.
export function BookedMarker({ code }: { code: string }) {
  return <span className="shrink-0 text-fg-subtle/70" aria-label={`Booked from ${code}`}><ArrowLeftRight size={12} /></span>
}

// Wraps an amount (marker + number) so hovering anywhere on it shows the booked
// card.
export function BookedBaseTooltip({ code, base, booked, children }: { code: string; base: string; booked: number; children: ReactNode }) {
  return <Tooltip rich align="right" side="top" content={bookedBaseCard(code, base, booked)}>{children}</Tooltip>
}

// Currency cell, flag + code chip. The full name lives in the title tooltip
// rather than the cell, keeping the column compact.
export function CurrencyCell({ code, q = '' }: { code: string; q?: string }) {
  const m = currencyMeta(code)
  return (
    <div className="flex items-center gap-1.5 min-w-0" title={m.name}>
      <CurrencyFlag meta={m} className="text-base leading-none shrink-0" />
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-info-50 text-info-700 text-2xs font-semibold border border-info-100 shrink-0"><Marked text={m.code} q={q} /></span>
    </div>
  )
}

/* The number the account was imported as, on a row. Tabular so a scan down the
   column lines up against the current numbers beside it, and titled with the
   full text because a code that survived a renumber is long by nature - the
   segments are what made the number worth rewriting.

   A dash rather than "None" when there is nothing: the account either arrived
   with a code or the question does not apply to it, and the Imported column
   next door is the one that distinguishes those. */
export function ArrivalCodeCell({ account, q = '' }: { account: Account; q?: string }) {
  const text = arrivalCodeText(account)
  if (!text) return <span className="text-fg-subtle">-</span>
  return <span className="block truncate text-sm text-slate-700 tabular-nums" title={text}><Marked text={text} q={q} /></span>
}

/** An account's dimension values as one string, for sorting by the column. */
const dimensionSortText = (a: Account) => a.defaultDimensionValues.map(v => v.value).join(' ')

/* The ID the system issued the account. Every account has one, so there is no
   dash case. Tabular for the same reason the number is: a scan down the column
   has to line the digits up.

   Search finds an account by it, so a match is marked here the way it is on the
   name and number - Mahad, 2026-09-30: *"make sure that the internal ID is
   searchable and is highlighted in yellow when we search."* */
export function InternalIdCell({ account, q = '' }: { account: Account; q?: string }) {
  return <span className="text-sm text-slate-700 tabular-nums whitespace-nowrap">{account.internalId ? <Marked text={account.internalId} q={q} /> : '-'}</span>
}

/* The block of numbers a summary reserves.

   Every row without one reads as a dash, postings included, the way the empty
   Description cell does. The two silences are not the same thing - a posting is
   a leaf and could never reserve anything, while a summary without a range has
   a gap somebody could fill - but a column that goes blank on most of its rows
   reads as a rendering fault rather than as an answer, and the distinction is
   already on the row in the GL account type column. */
export function NumberRangeCell({ account, q = '' }: { account: Account; q?: string }) {
  const range = accountRange(account)
  if (!range) return <span className="text-fg-subtle">-</span>
  // Typed with a hyphen, a range is printed with an en dash; mark the numbers either way.
  return <span className="text-sm text-slate-700 tabular-nums"><Marked text={formatRange(range)} q={q.replace('-', '–')} /></span>
}

/* Whether the account came in through an import. Both answers are chipped, in
   the same shape, differing only in tone. Chipping one and setting the other as
   plain text made them read as an answer and an absence of one, when they are
   two answers to the same question - and the column already sorts and filters
   on both, so it was never true that only one of them was interesting. */
export function ImportedCell({ account }: { account: Account }) {
  return account.arrivedByImport
    ? <Badge tone="info" className={PARTNER_CHIP_CLS}>Yes</Badge>
    : <Badge tone="neutral" className={PARTNER_CHIP_CLS}>No</Badge>
}

/* Whether the account is restricted, chipped both ways like Imported. */
export function RestrictedCell({ account }: { account: Account }) {
  return account.restricted
    ? <Badge tone="warning" className={PARTNER_CHIP_CLS}>Yes</Badge>
    : <Badge tone="neutral" className={PARTNER_CHIP_CLS}>No</Badge>
}

// Pastel avatar tints from the Partner listing (consistent tint per name).
const AVATAR_TINTS = [
  { bg: 'hsl(var(--accent))' }, // blue
  { bg: '#F0FDF4' }, // green
  { bg: '#FFF7ED' }, // orange
  { bg: '#F5F3FF' }, // violet
  { bg: '#ECFEFF' }, // cyan
  { bg: '#FFF1F2' }, // rose
  { bg: '#FEF9C3' }, // amber
  { bg: '#F0FDFA' }, // teal
  { bg: '#FDF2F8' }, // pink
  { bg: '#EFF6FF' }, // indigo
  { bg: '#F5F5F4' }, // stone
]
export function avatarTint(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length]
}
// Partner-listing LogoAvatar equivalent: 32px rounded-lg tile, pastel tint,
// hairline border. Shows the account number when given (the chart's natural
// identifier); falls back to bold two-letter initials.
export function AccountAvatar({ name, number }: { name: string; number?: string }) {
  // Two LETTER initials only - split on anything non-alphanumeric so symbols
  // ("/", "&", "-") in names never leak into the monogram.
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean)
  const initials = (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? 'A').slice(0, 2)).toUpperCase()
  return (
    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1]" style={{ backgroundColor: avatarTint(name).bg }}>
      <span className={cn('text-slate-700', number && 'tabular-nums', number ? 'text-[8px]' : 'text-[10px]')} style={{ fontWeight: 700 }}>{number || initials}</span>
    </span>
  )
}

// Status chip matching the Partners table Status column: a rounded-full pill,
// emerald for Active / amber for Inactive, no dot.
const STATUS_CHIP: Record<Account['status'], { bg: string; text: string; border: string }> = {
  Active: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  Inactive: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  Archived: { bg: '#FEF2F2', text: '#9F1239', border: '#FECDD3' },
}
export function StatusChip({ status, chevron, label, q = '' }: {
  status: Account['status']
  chevron?: boolean
  /** A table search, marked in the chip. */
  q?: string
  /** Overrides the text while keeping the state's colours, so an option can read
   *  as the verb it performs ("Deactivate") and the chip as the state it is. */
  label?: string
}) {
  const c = STATUS_CHIP[status]
  // The chevron is the whole difference between a chip that states the status and
  // one that changes it, so it decides the element too: a control is a button and
  // a label is not. As a span the interactive chip took a click but no Tab stop,
  // which left the status menu reachable by mouse alone.
  const Tag = chevron ? 'button' : 'span'
  return (
    <Tag
      {...(chevron ? { type: 'button' as const, 'aria-haspopup': 'menu' as const, 'aria-label': `Status: ${status}. Change status` } : {})}
      className={cn(
        // Fixed 22px height matching .chip so the status pill sits flush with
        // the other header chips (py + 12px text rendered slightly taller).
        'inline-flex items-center justify-center rounded-full border px-2.5 h-[22px] text-xs whitespace-nowrap shrink-0 gap-1',
        // Interactive variant (Partner detail StatusPill): chevron inside the
        // pill + hover ring affordance on the whole chip.
        chevron && 'cursor-pointer transition-all duration-150 hover:ring-2 hover:ring-offset-1 hover:ring-border',
      )}
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border, fontWeight: 500 }}
    >
      <Marked text={label ?? status} q={q} />
      {chevron && <ChevronDown className="w-3 h-3" />}
    </Tag>
  )
}

/* The status cell as a control, the way User Access Control offers one: all three
   states on show with what each one means, so the reader picks the state instead
   of hunting for the verb in the row menu. Every pick goes out through onAction,
   so it meets the same rules and the same confirmations as the menu does - this
   is a second way in, not a second set of rules. */
const STATUS_VERB: Record<AccountStatus, string> = {
  Active: 'Activate', Inactive: 'Deactivate', Archived: 'Archive',
}

export function StatusMenu({ a, onPick, q = '' }: {
  a: Account
  onPick: (action: LifecycleAction, a: Account) => void
  q?: string
}) {
  /* A category row has no lifecycle to offer, so its chip is a chip. Leaving the
     chevron on made this the one way back into Deactivate and Archive after the
     row menu stopped offering them, and every pick led to the same refusal. */
  if (isCategoryRoot(a)) return <StatusChip status={a.status} q={q} />
  return (
    // The row opens the account on click, and choosing a status is not that.
    <span onClick={e => e.stopPropagation()} className="inline-flex">
      {/* `flush` because the inset below is the panel's only padding: an option
          carries a background, so the space around the group has to read as one
          number on all four sides rather than the panel's 4px stacked on top of
          it vertically and nothing horizontally. */}
      <Menu align="left" flush trigger={<StatusChip status={a.status} chevron q={q} />}>
        {close => (
          /* Never wider than the window it opens in, so a narrow viewport
             shrinks the panel rather than pushing it off the edge. Wide enough
             to hold each state's two lines at one line apiece. */
          <div className="w-[min(440px,calc(100vw-32px))] p-2 space-y-0.5">
            {/* Only the states this kind of account has. A summary is offered
                Active and Archived - it never takes a posting, so there is
                nothing for Inactive to close it to. */}
            {statusesFor(a).map(s => {
              const current = s === a.status
              const action = actionToward(s, a.status)
              return (
                <button
                  key={s}
                  onClick={() => { close(); if (action) onPick(action, a) }}
                  /* One padding on all four sides. An option is a card the width
                     of the panel, so an inset that differs by edge shows up as
                     the chip sitting closer to the top than to the left. */
                  className={cn('w-full text-left rounded-md border p-3 transition-colors',
                    current ? 'bg-accent border-[#D0E3F7] cursor-default' : 'border-transparent hover:bg-bg-subtle')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <StatusChip status={s} label={current ? s : STATUS_VERB[s]} />
                    {current && <Check className="w-3.5 h-3.5 text-fg-subtle shrink-0" />}
                  </div>
                  {/* A line per kind of account, since the state means a
                      different thing to each. Separate paragraphs rather than
                      one run of prose: the reader is looking for the one line
                      that is about their account. */}
                  <div className="mt-1.5 space-y-1">
                    {statusMeaningLines(s).map(line => (
                      <p key={line} className="text-xs leading-[17px] text-fg-muted">{line}</p>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Menu>
    </span>
  )
}

// Nested-row expand/collapse control: a circular +/− button (size-5, border-2)
// that says whether the row is open the way a quick filter pill says whether it
// is on - open takes the accent fill with a primary border and glyph, closed is
// a plain outline in muted grey. Filled primary read as a row that had been
// picked rather than one that had been opened, and a nested table shows a whole
// column of these, so the page was at its loudest where nothing was chosen.
//
// The ::after pad widens only the click target - the circle itself keeps its
// size and position. It reaches left into the cell's own padding and right
// across the gap before the account name, so a near miss still toggles instead
// of opening the row. The 4px vertical reach is kept small on purpose: rows are
// ~24px tall at condensed density, and a taller pad would swallow clicks meant
// for the row above or below.
export function ExpandToggle({ expanded, onClick, arrows }: { expanded: boolean; onClick: (e: React.MouseEvent) => void; arrows?: boolean }) {
  /* Arrows is the other half of Tree layout (spec §7): the same toggle in the
     same place, drawn as a bare chevron instead of the disc, and the guide lines
     stand down with it. */
  if (arrows) return (
    <button
      onClick={onClick}
      aria-label={expanded ? 'Collapse' : 'Expand'}
      className="relative flex items-center justify-center size-5 rounded-md transition-colors duration-200 ease-out cursor-pointer shrink-0 text-muted-foreground hover:bg-bg-subtle hover:text-foreground after:content-[''] after:absolute after:-inset-y-1 after:-left-2 after:-right-1.5"
    >
      {expanded ? <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} /> : <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />}
    </button>
  )
  return (
    <button
      onClick={onClick}
      aria-label={expanded ? 'Collapse' : 'Expand'}
      className="relative flex items-center justify-center size-5 rounded-full transition-all duration-200 ease-out cursor-pointer border-2 shrink-0 active:scale-90 hover:ring-2 hover:ring-primary/25 after:content-[''] after:absolute after:-inset-y-1 after:-left-2 after:-right-1.5"
      style={{
        backgroundColor: expanded ? 'hsl(var(--accent))' : '#FFFFFF',
        // Grey at the weight the pills use on hover, not `--border`: that token is
        // tuned for a 1px rule under text and all but disappears as a 2px ring 20px
        // across, which is the whole affordance here.
        borderColor: expanded ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--muted-foreground) / 0.3)',
        color: expanded ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
      }}
    >
      {expanded ? <Minus className="w-2 h-2" strokeWidth={2.5} /> : <Plus className="w-2 h-2" strokeWidth={2.5} />}
    </button>
  )
}

export function AccountTable({
  accounts, query, density, columns, onAction, onStatusChange, onOpen, onAddChild, readOnly, order: orderProp, onOrderChange, colFilters: colFiltersProp, onColFiltersChange, onHideColumn, hideHeader, bodyScroll = true, frozenCols, onToggleFreeze,
  selectable, selectedIds, onToggleSelect, onToggleAll, onCreateRow, directCreate, noInlineInsert, omitOpeningBalance, rowBadge, emptyState, look, onColumnDrag,
}: {
  accounts: Account[]
  query: string
  density: Density
  columns: ColumnConfig
  onAction: (action: 'edit' | 'deactivate' | 'activate' | 'archive' | 'delete' | 'merge' | 'openingBalance' | 'journalEntry', a: Account) => void
  // Turns the Status cell into the three-state control. Opt-in, and deliberately
  // not folded into `onAction`: there "delete" means archive on the listing and
  // discard-this-draft-row in the setup builders, so a status pick routed through
  // it would throw away accounts on the surfaces that are still building a chart.
  onStatusChange?: (action: LifecycleAction, a: Account) => void
  /* Where a row goes when it is clicked. Omitting it makes the rows inert: no
     pointer, no hover tint, no "New" badge. That is what a preview of a chart
     wants, and it is not the same as `readOnly`, which only drops the actions
     column - a published chart can be uneditable here and still be a way
     through to the account. */
  onOpen?: (a: Account) => void
  /* The row's child request. On a summary that means a sub-account under it; on
     a posting account, which takes none, it means a new summary in that row's
     place. The caller decides which, since only it knows how to write. Omitted,
     the row menu hides the item. */
  onAddChild?: (parent: Account) => void
  readOnly?: boolean
  // Optional controlled column order (so the Columns side panel and the header
  // drag stay in sync). Falls back to internal state when not provided.
  order?: ColKey[]
  onOrderChange?: (order: ColKey[]) => void
  // Optional controlled column filters (shared with the ActiveFilters chips
  // bar), plus the header menu's Hide action. Internal fallback when absent.
  colFilters?: ColFilters
  onColFiltersChange?: (f: ColFilters) => void
  onHideColumn?: (k: ColKey) => void
  // User-frozen columns (in addition to the permanent Number + Name pair); they
  // pin to the left, just right of Name. `onToggleFreeze` flips one on/off.
  frozenCols?: ColKey[]
  onToggleFreeze?: (k: ColKey) => void
  // Suppress the column-header row - used when stacking the table inside a
  // grouped Views section so the header shows once at the top, not per group.
  hideHeader?: boolean
  // When false, the table doesn't create its own scroll container - the parent
  // scrolls instead, so the sticky header can pin to the parent's scroll.
  bodyScroll?: boolean
  // Bulk selection (list view): a leading frozen checkbox column + select-all.
  selectable?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onToggleAll?: (ids: string[], checked: boolean) => void
  // Inline "+ row" insertion (July 9 spec §1). When editable, a between-row
  // insertion affordance shows at every gap (plus the bottom "Add row"); its
  // draft row escalates to the creation modal pre-filled with the typed/derived
  // fields. Optional and no-op by default so existing callers behave unchanged.
  onCreateRow?: (prefill: CreateRowPrefill) => void
  // When set, add-row affordances (hover "+" between rows and the bottom "Add
  // row") open the Create GL Account modal directly instead of the inline draft
  // editor.
  directCreate?: boolean
  // Drops every add-row affordance: the between-row hover "+" and the "Add row"
  // under the last row. The chart listing sets it. Building a chart and reading
  // one are different jobs, and an account is created from the toolbar rather
  // than by typing into the gap between two rows that already exist.
  noInlineInsert?: boolean
  /* Leaves "Enter opening balance" to the account's own page. Set by the chart
     listing: stating where an account started is work done on that account, and
     it is the one action the two menus are allowed to differ on. Everything
     else the row menu offers, the account's page offers, item for item. */
  omitOpeningBalance?: boolean
  // Optional per-row chip after the account name. Same seam and same name as
  // AccountTree's, so a badge earned on one view of the chart can be shown on
  // the other without being written twice.
  rowBadge?: (a: Account) => ReactNode
  /* What to draw instead of rows when nothing survived the narrowing. Passed in
     rather than written here because only the caller knows what did the
     narrowing - a search term, the Filters modal, a quick pill - and only the
     caller can undo it. Omitted, an empty table is still an empty table. */
  emptyState?: ReactNode
  /** How the rows are drawn, from `useTableLook`. What the stylesheet can answer
   *  arrives as `look.className`; the column widths, the gutter and the pinned
   *  bands the table has to honour itself. */
  look?: TableLookProps
  /** A column edge was dragged, which takes Column widths to `custom`. */
  onColumnDrag?: () => void
}) {
  // Condensed keeps rows tight (py-0.5 bodies, header h-7); comfort uses py-3
  // (header h-10), matching the Partner Management vendors table.
  const padCls = density === 'condensed' ? 'py-0.5' : 'py-3'
  const base = useStore(s => s.company.baseCurrency)
  // Period-scoped rather than the raw store chart: a summary row re-sums the
  // accounts beneath it, so reading them as-of-now would print a total that
  // disagrees with the posting rows underneath.
  const storeAccounts = usePeriodScopedAccounts()
  // Structure and rolled-up figures resolve against the full account set. During
  // build-from-scratch the draft rows aren't in the store yet, so merge any
  // rendered rows the store doesn't know about. For the COA listing every
  // rendered row is already in the store, so this returns the same reference -
  // zero behavior change and no extra re-renders there.
  const allAccounts = useMemo(() => {
    const ids = new Set(storeAccounts.map(a => a.id))
    const extra = accounts.filter(a => !ids.has(a.id))
    return extra.length ? [...storeAccounts, ...extra] : storeAccounts
  }, [storeAccounts, accounts])
  const index = buildChartIndex(allAccounts)
  const amounts = useMemo(() => amountSortMap(accounts, allAccounts), [accounts, allAccounts])

  // null = default number ordering with NO visual sort indicator; the blue
  // sorted-header treatment only appears after an explicit user sort.
  const [sort, setSort] = useState<SortState | null>(null)
  const onSortDir = (k: SortKey, dir: 'asc' | 'desc' | null) => setSort(dir ? { key: k, dir } : null)
  // The active between-row insertion boundary (spec §1): 'start' = above the
  // first row, otherwise the id of the row the draft is inserted AFTER. null =
  // no draft open. Only one insertion draft is open at a time.
  const [insertAt, setInsertAt] = useState<string | null>(null)
  const [internalColFilters, setInternalColFilters] = useState<ColFilters>({})
  const colFilters = colFiltersProp ?? internalColFilters
  const setColFilters = onColFiltersChange ?? setInternalColFilters
  const parentNum = (x: Account) => (x.parentId ? allAccounts.find(p => p.id === x.parentId)?.accountNumber ?? '' : '')
  const byNumber = byNumberThenName
  const dir = sort?.dir === 'desc' ? -1 : 1
  const sorted = [...accounts].sort((a, b) => {
    let c = 0
    switch (sort?.key ?? 'number') {
      case 'number': c = byNumber(a, b); break
      case 'numberRange': c = rangeSortValue(a) - rangeSortValue(b); break
      case 'name': c = a.accountName.localeCompare(b.accountName); break
      case 'type': c = ACCOUNT_TYPE_META[a.accountType].label.localeCompare(ACCOUNT_TYPE_META[b.accountType].label); break
      case 'classification': c = ALL_CLASSIFICATIONS.indexOf(a.statementClassification) - ALL_CLASSIFICATIONS.indexOf(b.statementClassification); break
      case 'glType': c = a.glAccountType.localeCompare(b.glAccountType); break
      // Unclassified accounts sort last ascending, so a role sort surfaces the
      // classified ones first.
      case 'role': c = (a.accountRole ?? '￿').localeCompare(b.accountRole ?? '￿'); break
      case 'normalBalance': c = a.normalBalance.localeCompare(b.normalBalance); break
      case 'openingBalance': c = (amounts.get(a.id)?.opening ?? 0) - (amounts.get(b.id)?.opening ?? 0); break
      case 'posting': c = Number(a.isPosting) - Number(b.isPosting); break
      case 'currency': c = a.currencyCode.localeCompare(b.currencyCode); break
      // The cell shows the balance converted into the account's own currency, so
      // the sort has to convert too - comparing the USD figures ordered the
      // column by numbers it was not displaying.
      case 'fxBalance': c = currentOwnBalanceOf(a) - currentOwnBalanceOf(b); break
      case 'runningBalance': c = (amounts.get(a.id)?.running ?? 0) - (amounts.get(b.id)?.running ?? 0); break
      case 'status': c = a.status.localeCompare(b.status); break
      case 'description': c = (a.description ?? '').localeCompare(b.description ?? ''); break
      case 'effectiveDate': c = a.effectiveDate.localeCompare(b.effectiveDate); break
      // An account with no arrival code sorts last ascending, the way an
      // unclassified role does, so the column leads with the rows it can answer for.
      case 'internalId': c = internalIdSeq(a.internalId) - internalIdSeq(b.internalId); break
      // By the values the cell shows; an account carrying none sorts last ascending.
      case 'dimensions': c = (dimensionSortText(a) || '￿').localeCompare(dimensionSortText(b) || '￿'); break
      case 'originalNumber': c = (arrivalCodeText(a) || '￿').localeCompare(arrivalCodeText(b) || '￿'); break
      case 'imported': c = Number(!!a.arrivedByImport) - Number(!!b.arrivedByImport); break
      case 'restricted': c = Number(!!a.restricted) - Number(!!b.restricted); break
      case 'createdBy': c = personText(a.createdBy).localeCompare(personText(b.createdBy)); break
      case 'createdAt': c = a.createdAt.localeCompare(b.createdAt); break
      case 'updatedBy': c = personText(modifiedByOf(a)).localeCompare(personText(modifiedByOf(b))); break
      case 'updatedAt': c = modifiedAtOf(a).localeCompare(modifiedAtOf(b)); break
    }
    return (c !== 0 ? c : byNumber(a, b)) * dir
  })

  // Column order is user-reorderable by dragging headers (the first column,
  // Account name, is pinned and never moves). Both the header row and every
  // body row render from this single ordered key list so they stay aligned.
  const [internalOrder, setInternalOrder] = useState<ColKey[]>(DEFAULT_COLUMN_ORDER)
  const order = orderProp ?? internalOrder
  const setOrder = (next: ColKey[]) => (onOrderChange ?? setInternalOrder)(next)
  // Reorder only within the same group (frozen pair vs. the rest), so the
  // Number/Name pair can swap with each other but not leave the frozen zone.
  const listOrderRef = useRef(order)
  listOrderRef.current = order
  const listDrag = useColumnDragReorder({
    order,
    setOrder: next => setOrder((typeof next === 'function' ? next(listOrderRef.current) : next) as ColKey[]),
    canSwap: (a, b) => sameDragGroup(a as ColKey, b as ColKey),
    onHide: onHideColumn ? k => onHideColumn(k as ColKey) : undefined,
    canHide: k => !isLockedCol(k as ColKey),
  })
  const dragKey = listDrag.draggingKey as ColKey | null
  const makeDnd = (key: ColKey): DnDProps => dragProps(key, listDrag)
  const sizing = look?.columnSizing ?? 'default'
  const engineSized = sizing === 'fit' || sizing === 'equal'
  const { widths, onResizeStart } = useColumnWidths(sizing, onColumnDrag)
  // A column is frozen when it's the permanent Number/Name pair or the user has
  // pinned it via the header menu's Freeze action.
  const userFrozen = frozenCols ?? []
  const isFrozen = (k: ColKey) => k === 'number' || k === 'name' || userFrozen.includes(k)
  const visibleOrder = order.filter(k => (columns as any)[k])
  // Frozen columns lead (Number + Name, then any user-pinned columns in order);
  // the rest follow. Each frozen column has a fixed width so the next pins flush.
  const frozenOrder = visibleOrder.filter(isFrozen)
  const colOrder = [...frozenOrder, ...visibleOrder.filter(k => !isFrozen(k))]
  // A width the reader dragged wins over the default. Reading FROZEN_W first meant
  // the Name and Number grips moved the header and nothing else, because the body
  // cells kept pinning at the default.
  // Number is the one column whose default comes off the data; see numberColWidth.
  const numberW = widths.number ?? numberColWidth(allAccounts)
  /* The Row numbers gutter is a transparent border-left on whichever cell leads
     the row, so that column declares itself that much wider or its content is
     squeezed by the gutter instead of moved by it. Everything downstream is a
     sum of these widths, so the rest of the pinned run follows on its own. */
  const gutter = look?.rowNumbers ? rowNumberGutter(accounts.length) : 0
  const selW = selectable ? SELECT_W + gutter : 0
  const leadCol = selectable ? null : frozenOrder[0]
  const frozenW = (k: ColKey) => (k === 'number' ? numberW : widths[k] ?? FROZEN_W[k] ?? FROZEN_FALLBACK_W[k] ?? 160) + (k === leadCol ? gutter : 0)
  const frozenStyle = (k: ColKey, header?: boolean): CSSProperties | undefined => {
    // Fit and Equal hand the widths to the layout engine, and a frozen offset is
    // a sum of widths, so the whole run stands down with them (spec §8).
    if (engineSized) return undefined
    const idx = frozenOrder.indexOf(k)
    if (idx === -1) return undefined
    const left = selW + frozenOrder.slice(0, idx).reduce((s, c) => s + frozenW(c), 0)
    return leftPinStyle({ left, width: frozenW(k), edge: idx === frozenOrder.length - 1, header })
  }

  const visibleRows = sorted.filter(a => matchesColFilters(a, colFilters, allAccounts))
  // Every row is a real account now, so every row can be ticked. A summary that is
  // ticked carries the accounts under it along; planBulk works that out.
  const allSelected = selectable && visibleRows.length > 0 && visibleRows.every(a => selectedIds?.has(a.id))
  // Partners shows the header checkbox as checked whenever any row is selected
  // (partial or full), not an indeterminate dash.
  const anySelected = selectable && visibleRows.some(a => selectedIds?.has(a.id))
  const headerSelectStyle: CSSProperties = { position: 'sticky', left: 0, zIndex: Z_HEAD_FROZEN, backgroundColor: 'inherit', width: selW, minWidth: selW, maxWidth: selW }

  // Actions and the spare-width column in front of it (see fillerProps).
  const dividerColSpan = (selectable ? 1 : 0) + colOrder.length + (readOnly ? 0 : 2)
  /* A full-width row takes no gutter of its own (Rules §5.10), so it has to add
     that width back to its indent or it would sit left of every row above it. */
  const insertIndent = (selectable ? selW : gutter) + 14

  // ── Sticky category badge bands ────────────────────────────────────────────
  // Only when rows read in category order (default number sort); other sorts
  // interleave categories, so a pinned band would be misleading.
  const groupByCategory = !sort || sort.key === 'number'
  const listTableRef = useRef<HTMLTableElement>(null)
  const listTheadRef = useRef<HTMLTableSectionElement>(null)
  const [listCatTop, setListCatTop] = useState(40)
  useLayoutEffect(() => {
    const el = listTheadRef.current
    if (!el) return
    const measure = () => setListCatTop(Math.floor(el.getBoundingClientRect().height))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [density])
  // The frontmost pinned category (its <tbody> straddles the pin line) carries
  // the drop shadow, so it reads as pinned only while actually stuck on scroll.
  const [listActiveCat, setListActiveCat] = useState<string | null>(null)
  useEffect(() => {
    if (!groupByCategory) return
    const findScrollParent = (node: HTMLElement | null): HTMLElement | null => {
      let el = node?.parentElement ?? null
      while (el) {
        const oy = getComputedStyle(el).overflowY
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return el
        el = el.parentElement
      }
      return null
    }
    const update = () => {
      const table = listTableRef.current
      if (!table) return
      const sp = findScrollParent(table)
      const pinY = (sp ? sp.getBoundingClientRect().top : 0) + listCatTop
      const scrolled = (sp ? sp.scrollTop : window.scrollY) > 0
      if (!scrolled) { setListActiveCat(null); return }
      let active: string | null = null
      table.querySelectorAll(':scope > tbody[data-cat]').forEach(tb => {
        const r = tb.getBoundingClientRect()
        if (r.top <= pinY + 1 && r.bottom > pinY + 1) active = tb.getAttribute('data-cat')
      })
      setListActiveCat(active)
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update) }
  }, [groupByCategory, listCatTop])

  // Contiguous category runs; each run's own root summary (e.g. "1000 ASSETS")
  // heads it as the sticky band. Null when not in category order (one flat tbody).
  const rowIndex = useMemo(() => new Map(visibleRows.map((a, i) => [a.id, i])), [visibleRows])
  const listGroups = useMemo(() => {
    if (!groupByCategory) return null
    const gs: { cat: AccountType; accts: Account[]; anchorId?: string }[] = []
    for (const a of visibleRows) {
      let g = gs[gs.length - 1]
      if (!g || g.cat !== a.accountType) { g = { cat: a.accountType, accts: [] }; gs.push(g) }
      g.accts.push(a)
    }
    // Undefined when a filter has hidden the division itself, and then the run
    // simply reads without a band rather than promoting an arbitrary row into one.
    gs.forEach(g => { g.anchorId = g.accts.find(a => a.parentId === null && a.glAccountType === 'Summary')?.id })
    return gs
  }, [groupByCategory, visibleRows])

  // The list indents to the same scale as the tree and drops a vertical guide per
  // level, so the two views read as one chart. It draws no elbows: the tree branches
  // into a row because that row can be expanded, and the elbow is what points at the
  // toggle. Nothing in the list expands, so the vertical line alone marks the level.
  //
  // Both the indent and the guides come from the rows actually rendered, not from the
  // whole chart: under a search that hides a summary, the accounts under it read at
  // the level they appear at and no guide points at a row that is not on screen. The
  // tree re-roots the same way.
  //
  // A parent's line carries on past a row only while it has another child further
  // down the list, and closes on its last child. Order-derived, so it stays truthful
  // under whatever sort the reader chose.
  const listStructure = useMemo(() => {
    const shown = new Set(visibleRows.map(r => r.id))
    // Outermost first, and only the ancestors the reader can actually see.
    const chainOf = (id: string) => index.ancestorsOf(id).filter(p => shown.has(p.id)).reverse()
    const lastChild = new Map<string, string>()
    for (const r of visibleRows) {
      const chain = chainOf(r.id)
      const parent = chain[chain.length - 1]
      if (parent) lastChild.set(parent.id, r.id)
    }
    const out = new Map<string, { depth: number; trunks: boolean[] }>()
    for (const r of visibleRows) {
      const chain = chainOf(r.id)
      out.set(r.id, {
        depth: chain.length,
        trunks: chain.map((p, i) => lastChild.get(p.id) !== (chain[i + 1] ?? r).id),
      })
    }
    return out
  }, [visibleRows, index])

  // Renders one body row plus, when editable, the between-row insert affordance
  // beneath it.
  const renderRow = (a: Account, anchorId?: string, cat?: AccountType, count?: number) => {
    const gi = rowIndex.get(a.id) ?? -1
    const next = visibleRows[gi + 1] ?? null
    const st = listStructure.get(a.id)
    const rowEl = (
      <AccountRow
        key={a.id} a={a} q={query} order={colOrder} padCls={padCls} base={base} index={index}
        depth={st?.depth ?? 0} trunks={st?.trunks}
        onAction={onAction} onStatusChange={onStatusChange} onOpen={onOpen} onAddChild={onAddChild} readOnly={readOnly}
        rowBadge={rowBadge} omitOpeningBalance={omitOpeningBalance}
        frozenStyle={frozenStyle} selectable={selectable} selectW={selW} selected={!!selectedIds?.has(a.id)} onToggleSelect={onToggleSelect}
        band={a.id === anchorId && cat ? { meta: ACCOUNT_TYPE_META[cat], count: count ?? 0, top: listCatTop, pinned: !!look?.pinGroups, stuck: !!look?.pinGroups && listActiveCat === cat } : undefined}
      />
    )
    if (readOnly || noInlineInsert) return rowEl
    return (
      <Fragment key={a.id}>
        {rowEl}
        <InsertRow
          colSpan={dividerColSpan} indent={insertIndent}
          active={insertAt === a.id} onActivate={() => setInsertAt(a.id)} onCancel={() => setInsertAt(null)}
          prev={a} next={next}
          category={a.accountType ?? next?.accountType ?? 'AST'}
          allAccounts={allAccounts} density={density} onCreateRow={onCreateRow}
          order={colOrder} selectable={selectable} readOnly={readOnly} directCreate={directCreate}
          numberW={numberW} nameW={frozenW('name')}
        />
      </Fragment>
    )
  }

  return (
    <div className={cn(bodyScroll && 'overflow-auto scrollbar-thin')}>
      <DragGhost ghostRef={listDrag.ghostRef} label={dragKey ? HEADER_DEFS[dragKey].label : null} hiding={listDrag.hiding} caps={false} />
      <GridComfort.Provider value={density === 'comfortable'}>
      <table
        ref={listTableRef}
        /* Default and custom leave the widths where they were. Fit lets the
           table grow to its content and spills the spare width to the right;
           Equal splits the frame between the columns that are showing. */
        className={cn('text-sm coa-frozen-2 border-separate border-spacing-0',
          sizing === 'equal' ? 'w-full' : 'min-w-full w-max', look?.className)}
        style={{
          ...(gutter ? { ['--fr-rownum-w' as string]: `${gutter}px` } : null),
          tableLayout: sizing === 'equal' ? 'fixed' : 'auto',
        } as CSSProperties}
      >
        {!hideHeader && (
        <thead ref={listTheadRef}>
          {/* Header row - Partner table chrome: opaque muted/30 fill (composited
              over white so the sticky header doesn't show rows scrolling under),
              13px normal-weight muted-foreground labels (set per-cell). */}
          <tr data-grid-head-row className={cn('border-b border-border bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)] text-muted-foreground text-xs', density === 'condensed' && '[&>th]:!h-7')}>
            {selectable && (
              <th style={headerSelectStyle} className="align-middle pl-4 pr-1">
                <div className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    className="coa-check"
                    checked={!!allSelected}
                    ref={el => { if (el) el.indeterminate = !!anySelected && !allSelected }}
                    onChange={e => onToggleAll?.(visibleRows.map(a => a.id), e.target.checked)}
                  />
                </div>
              </th>
            )}
            {colOrder.map(k => {
              const lockedCol = isLockedCol(k)
              return (
              <HeaderCell key={k} colKey={k} sort={sort} onSortDir={onSortDir}
                dnd={makeDnd(k)}
                dragging={dragKey === k} hiding={dragKey === k && listDrag.hiding}
                width={engineSized ? undefined : (frozenStyle(k) ? frozenW(k) : widths[k])} onResizeStart={onResizeStart?.(k)}
                indent={k === 'name'}
                stickyStyle={frozenStyle(k, true)}
                onHide={!lockedCol && onHideColumn ? () => onHideColumn(k) : undefined}
                onToggleFreeze={!lockedCol && onToggleFreeze ? () => onToggleFreeze(k) : undefined}
                frozen={isFrozen(k)}
                filter={colFilters[k] ?? blankFilter(k)}
                onFilterChange={(f) => setColFilters({ ...colFilters, [k]: f })}
                uniqueValues={uniqueColValues(k, accounts)} />
              )
            })}
            {!readOnly && <th {...fillerProps} style={sizing === 'equal' ? EQUAL_FILLER_W : FILLER_W} />}
            {!readOnly && <Th data-actions-cell className="text-right !px-2" style={{ ...rightPinStyle({ header: true }), width: sizing === 'equal' ? ACTIONS_EQUAL_W : ACTIONS_HEAD_W }}>Actions</Th>}
          </tr>
        </thead>
        )}
        {(() => {
          const startInsert = !readOnly && !noInlineInsert && (
            <InsertRow
              colSpan={dividerColSpan} indent={insertIndent}
              active={insertAt === 'start'} onActivate={() => setInsertAt('start')} onCancel={() => setInsertAt(null)}
              prev={null} next={visibleRows[0] ?? null}
              category={visibleRows[0]?.accountType ?? 'AST'}
              allAccounts={allAccounts} density={density} onCreateRow={onCreateRow}
              order={colOrder} selectable={selectable} readOnly={readOnly} directCreate={directCreate}
              numberW={numberW} nameW={frozenW('name')}
            />
          )
          const endAdd = !readOnly && !noInlineInsert && (
            <AddRowControl colSpan={dividerColSpan} density={density} onCreateRow={onCreateRow} indent={insertIndent} directCreate={directCreate} />
          )
          if (emptyState && visibleRows.length === 0) {
            return (
              <tbody>
                <tr><td colSpan={dividerColSpan}>{emptyState}</td></tr>
              </tbody>
            )
          }
          if (!listGroups) {
            return (
              <tbody>
                {startInsert}
                {visibleRows.map(a => renderRow(a))}
                {endAdd}
              </tbody>
            )
          }
          return listGroups.map((g, gi) => (
            <tbody key={`${g.cat}-${gi}`} data-cat={g.cat}>
              {gi === 0 && startInsert}
              {g.accts.map(a => renderRow(a, g.anchorId, g.cat, g.accts.length))}
              {gi === listGroups.length - 1 && endAdd}
            </tbody>
          ))
        })()}
      </table>
      </GridComfort.Provider>
    </div>
  )
}

/* The drag handlers spread onto a header <th>: Partners' mouse drag
   (useColumnDragReorder), which reorders live as the header passes its
   neighbours and hides the column when dropped off the top of the table. */
interface DnDProps {
  'data-col-drag-key': string
  onMouseDown: (e: React.MouseEvent) => void
  onClickCapture: (e: React.MouseEvent) => void
}
const dragProps = (key: ColKey, drag: ReturnType<typeof useColumnDragReorder>): DnDProps => ({
  'data-col-drag-key': key,
  onMouseDown: e => drag.onHeaderMouseDown(e, key),
  // The release that ends a drag would otherwise land as a click and sort.
  onClickCapture: e => { if (drag.suppressClick()) { e.stopPropagation(); e.preventDefault() } },
})


// Every reorderable column, in default order. 'name' is pinned first.
export type ColKey = 'name' | 'number' | 'numberRange' | 'type' | 'classification' | 'glType' | 'role' | 'normalBalance' | 'posting' | 'currency' | 'openingBalance' | 'runningBalance' | 'fxBalance' | 'status' | 'description' | 'dimensions' | 'effectiveDate' | 'internalId' | 'originalNumber' | 'imported' | 'restricted' | 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt'
// The money block reads opening → running → foreign running, so the base figure
// and its foreign-currency counterpart sit next to each other. Normal balance
// trails Role because both describe how the account behaves, and it reads next
// to the figures it governs the sign of.
/* Dimensions sit directly after the name because they are no longer a detail
   about an account - they are part of which account it is. A chart read out of
   glued numbers holds 71100 once per department, and this column is the only
   thing on the row that says which one you are looking at. */
/* The two provenance columns trail everything, and both ship hidden. Where an
   account came from is a migration question, not a daily one: it matters
   intensely for the weeks after a chart is moved across and then almost never,
   and it cannot live up front by default without displacing the pinned pair. */
/* Number range trails the identity block, as close to the number it qualifies as
   the pinned pair allows: Number and Name are frozen together, so the first
   movable slot is the one Dimensions has already earned. */
export const DEFAULT_COLUMN_ORDER: ColKey[] = ['number', 'name', 'dimensions', 'numberRange', 'type', 'classification', 'glType', 'role', 'normalBalance', 'openingBalance', 'runningBalance', 'fxBalance', 'currency', 'status', 'restricted', 'description', 'internalId', 'originalNumber', 'imported', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt']

// Header definition per column. `sortKey` present → sortable; otherwise plain.
// Labels follow the Fields-spec listing columns (Category, and so on).
export const HEADER_DEFS: Record<ColKey, { label: string; sortKey?: SortKey; align?: 'right'; className?: string; info?: string; infoRich?: ReactNode }> = {
  // Width comes from the pin geometry in both views, not from a class.
  name: { label: 'GL account name', sortKey: 'name' },
  number: { label: 'GL account no.', sortKey: 'number', className: '!pl-2 !pr-0' },
  numberRange: { label: 'Number range', sortKey: 'numberRange', className: 'min-w-[130px]', info: 'The range of account numbers reserved for a summary account.' },
  type: { label: 'GL account category', sortKey: 'type', className: 'min-w-[180px]', info: "Asset, liability, equity, revenue, or expense. Sets which statement the account appears on, and its normal balance." },
  classification: { label: 'Statement classification', sortKey: 'classification', className: 'min-w-[190px]', info: 'The section of the financial statement where the account appears, e.g. Current asset or Non-current asset.' },
  glType: { label: 'GL account type', sortKey: 'glType', className: 'min-w-[180px]', info: 'Defines whether the account is a Summary account or a Posting account.' },
  role: { label: 'Account role', sortKey: 'role', className: 'min-w-[168px]', info: 'The account role tells Omne how and where the account is used. For example, an Accounts Payable account can be used for Vendor Invoicing.' },
  // The shared constant, not a retyping of it: the create form's card opens on
  // this same sentence and then goes on to say when to change the side, which is
  // a question only a reader who can change it is asking.
  normalBalance: { label: 'Normal balance', sortKey: 'normalBalance', className: 'min-w-[140px]', info: NORMAL_BALANCE_HELP },
  posting: { label: 'Posting', sortKey: 'posting' },
  currency: { label: 'Currency', sortKey: 'currency' },
  openingBalance: { label: 'Opening balance', sortKey: 'openingBalance', align: 'right', className: 'pl-4 pr-4 min-w-[132px]', info: 'The account balance at the start of the selected period, before any transactions are recorded for that period.' },
  // Second sentence kept from the old copy: it is the only place on the listing
  // that says the column is signed against the account's own side, without which
  // a six-figure contra revenue balance reads as a bug.
  runningBalance: { label: 'Running balance', sortKey: 'runningBalance', align: 'right', className: 'pl-4 pr-4 min-w-[132px]', info: "The account balance after each transaction, showing the current balance as transactions are posted. Every figure is read on its category's side: positive for an account adding to its category, negative for one reducing it. So a contra account, such as Sales Returns at -$110,000, reads negative because it is a deduction, not an error." },
  fxBalance: { label: 'Foreign balance', sortKey: 'fxBalance', align: 'right', className: 'pl-2 pr-2', info: "The account balance shown in the account's foreign currency instead of the company's base currency." },
  status: { label: 'Status', sortKey: 'status' },
  description: { label: 'Description', sortKey: 'description', className: 'min-w-[200px]' },
  /* Sortable like every other column, so its header carries the same up-down
     hint on hover rather than a chevron no other header shows. Mahad,
     2026-10-01: *"Why is there a chevron icon in the dimensions column header? I
     think we are using this icon everywhere else."* */
  dimensions: { label: 'Dimensions', sortKey: 'dimensions', info: 'A dimension is something your company organizes or filters accounts by, such as Location or Department.' },
  effectiveDate: { label: 'Effective', sortKey: 'effectiveDate' },
  /* "Prior" rather than "Original": the number an account arrived as, not a
     record of it having been renumbered here. Original read as the before half of
     a change made in this chart, which is a different fact and one the audit log
     already answers. */
  internalId: { label: INTERNAL_ID_LABEL, sortKey: 'internalId', className: 'min-w-[130px]', info: INTERNAL_ID_HELP },
  originalNumber: { label: 'Prior account number', sortKey: 'originalNumber', className: 'min-w-[150px]', info: 'The number this account came in as when it was imported. Renumbering the account here does not change it, and searching for it finds this account.' },
  restricted: { label: 'Restricted', sortKey: 'restricted', className: 'min-w-[120px]', info: RESTRICTED_HELP },
  imported: { label: 'Imported', sortKey: 'imported', className: 'min-w-[110px]', info: 'Whether this account came into the chart through a file import, rather than being added here.' },
  // The audit four, last: see DEFAULT_COLUMNS.
  createdBy: { label: 'Created by', sortKey: 'createdBy', className: 'min-w-[170px]', info: AUDIT_HELP.createdBy },
  createdAt: { label: 'Created on', sortKey: 'createdAt', className: 'min-w-[170px]', info: AUDIT_HELP.createdAt },
  updatedBy: { label: 'Last updated by', sortKey: 'updatedBy', className: 'min-w-[170px]', info: AUDIT_HELP.updatedBy },
  updatedAt: { label: 'Last updated on', sortKey: 'updatedAt', className: 'min-w-[170px]', info: AUDIT_HELP.updatedAt },
}

function HeaderCell({ colKey, sort, onSortDir, dnd, dragging, hiding, width, onResizeStart, filter, onFilterChange, uniqueValues, onHide, onToggleFreeze, frozen, indent, stickyStyle }: {
  colKey: ColKey
  sort: SortState | null; onSortDir: (k: SortKey, dir: 'asc' | 'desc' | null) => void
  dnd?: DnDProps; dragging?: boolean; hiding?: boolean
  width?: number; onResizeStart?: (e: React.MouseEvent) => void
  filter: ColFilter; onFilterChange: (f: ColFilter) => void; uniqueValues: string[]
  onHide?: () => void
  onToggleFreeze?: () => void
  frozen?: boolean
  // Slight extra left indent (list-view name column); keeps header aligned with
  // the indented body cell.
  indent?: boolean
  // Sticky positioning for a frozen column (Number / Name); the header sits
  // above body cells, so it gets a higher z-index and an opaque header bg.
  stickyStyle?: CSSProperties
}) {
  const def = HEADER_DEFS[colKey]
  const heading = def.label
  const active = !!def.sortKey && sort?.key === def.sortKey
  const hasFilter = filterActive(filter)
  const baseWidthStyle = stickyStyle ? {} : (width ? { width, minWidth: width, maxWidth: width } : undefined)
  // Frozen header cells need an opaque fill (sticky cells can't be transparent);
  // `leftPinStyle`/`rightPinStyle` supply it, and the caller keeps control of the
  // stacking tier.
  const thStyle = stickyStyle ? { backgroundColor: HEADER_FILL, ...stickyStyle } : baseWidthStyle
  /* Being dragged, drawn as Partners draws it: a wash and a 2px top bar, blue
     while it moves and red once a release off the top would hide it. */
  const dragStyle = dragging ? { ...thStyle, ...draggedHeaderStyle(!!hiding) } : thStyle
  return (
    <th {...dnd} data-col-head={colKey} style={dragStyle}
      className={cn('relative group/col h-10 pr-2 align-middle font-normal text-muted-foreground whitespace-nowrap select-none', indent ? 'pl-6' : 'pl-4', def.align === 'right' ? 'text-right' : 'text-left', dnd && 'cursor-grab', !dragging && hasFilter && 'bg-primary/[0.03]', def.className)}>
      {dragging && <DragBar hiding={!!hiding} />}
      {dnd && <GripVertical size={12} className={cn('absolute left-1 top-1/2 -translate-y-1/2 transition-opacity pointer-events-none', dragging ? (hiding ? 'opacity-100 text-danger-600' : 'opacity-100 text-primary') : 'text-fg-subtle/50 opacity-0 group-hover/col:opacity-100')} />}
      <HeaderMenu
        label={heading}
        sortable={!!def.sortKey}
        currentSort={active ? sort!.dir : null}
        onSortDir={(dir) => def.sortKey && onSortDir(def.sortKey, dir)}
        filter={filter}
        onFilterChange={onFilterChange}
        uniqueValues={uniqueValues}
        align={def.align}
        onHide={onHide}
        onToggleFreeze={onToggleFreeze}
        frozen={frozen}
      >
        {/* Sorted / filtered headers go primary blue (Partner pattern) -
            never darker; idle sortable headers reveal a faint ⇅ on hover.
            Label inherits the row's text-xs: Partners' TableHead is exactly
            text-xs font-normal text-muted-foreground with no size override. */}
        <span style={active || hasFilter ? { color: 'hsl(var(--primary))' } : undefined}>{heading}</span>
        {(def.info || def.infoRich) && (
          <Tooltip rich={!!def.infoRich} content={def.infoRich ?? def.info} side="bottom" align={def.align === 'right' ? 'right' : 'left'}>
            {/* Info icon goes primary blue when the header is active (sorted/filtered). */}
            <span onClick={e => e.stopPropagation()} className={cn('inline-flex cursor-help', active || hasFilter ? 'text-primary' : 'text-fg-subtle/60 hover:text-fg-subtle')}><Info size={12} /></span>
          </Tooltip>
        )}
        {hasFilter && !active && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'hsl(var(--primary))' }} />}
        {active && sort?.dir === 'asc' && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: 'hsl(var(--primary))' }} />}
        {active && sort?.dir === 'desc' && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: 'hsl(var(--primary))' }} />}
        {!active && !hasFilter && !!def.sortKey && <ArrowUpDown className="coa-col-hint w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/col:opacity-100 transition-opacity" />}
        {/* A column that cannot be sorted still opens a menu (filter, hide,
            freeze), so it gets a hint too rather than none. */}
        {!active && !hasFilter && !def.sortKey && <ChevronDown className="coa-col-hint w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/col:opacity-100 transition-opacity" />}
      </HeaderMenu>
      {onResizeStart && <ResizeHandle onResizeStart={onResizeStart} />}
    </th>
  )
}

// Right-edge resize grip rendered inside a header cell.
function ResizeHandle({ onResizeStart }: { onResizeStart: (e: React.MouseEvent) => void }) {
  return (
    <span
      onMouseDown={onResizeStart}
      onClick={e => e.stopPropagation()}
      title="Drag to resize"
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize select-none opacity-0 group-hover/col:opacity-100 bg-primary/20 hover:bg-primary/50 transition-opacity"
    />
  )
}

// Column-width state + mouse-drag resizing, shared by the list and tree
// header rows. Widths apply per column key via the th's inline style.
//
// `sizing` is the Column widths card. Fit and Equal hand every width to the
// layout engine, so while either is on the drag widths are withheld and the
// handles are not offered; picking any card clears the hand widths, so Default
// is the grid's own defaults and not the last session's drags. A drag itself
// goes the other way, telling the host the view is now `custom`.
function useColumnWidths(sizing: ColumnSizing = 'default', onDrag?: () => void, rememberAs?: string) {
  const [widths, setWidths] = useRememberedState<Partial<Record<ColKey, number>>>(rememberAs, {})
  const engineSized = sizing === 'fit' || sizing === 'equal'
  useEffect(() => {
    if (sizing !== 'custom') setWidths(prev => (Object.keys(prev).length ? {} : prev))
  }, [sizing])
  const onResizeStart = (key: ColKey) => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const th = (e.currentTarget as HTMLElement).closest('th')
    const startX = e.clientX
    // Off the BORDER box minus its left border: the Row numbers gutter is that
    // border, and counting it in would have added itself again on the next
    // render and walked the column wider on every drag.
    const startW = th
      ? th.getBoundingClientRect().width - parseFloat(getComputedStyle(th).borderLeftWidth || '0')
      : 120
    onDrag?.()
    const move = (ev: MouseEvent) => {
      const w = Math.max(60, Math.round(startW + (ev.clientX - startX)))
      setWidths(prev => ({ ...prev, [key]: w }))
    }
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }
  return {
    widths: engineSized ? EMPTY_WIDTHS : widths,
    onResizeStart: engineSized ? undefined : onResizeStart,
  }
}
const EMPTY_WIDTHS: Partial<Record<ColKey, number>> = {}

function Th({ children, className, dnd, dragging, dragOver, width, onResizeStart, style, ...rest }: { children?: React.ReactNode; className?: string; dnd?: DnDProps; dragging?: boolean; dragOver?: boolean; grip?: boolean; width?: number; onResizeStart?: (e: React.MouseEvent) => void; style?: CSSProperties } & React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th {...rest} {...dnd} style={{ ...(width ? { width, minWidth: width, maxWidth: width } : null), ...style }} className={cn('relative group/col h-10 pl-4 pr-2 align-middle text-left font-normal text-muted-foreground whitespace-nowrap', dnd && 'cursor-grab', dragging && 'opacity-40', dragOver && 'bg-primary/5', className)}>
      {dnd && <GripVertical size={12} className="absolute left-1 top-1/2 -translate-y-1/2 text-fg-subtle/50 opacity-0 group-hover/col:opacity-100 transition-opacity pointer-events-none" />}
      {children}
      {onResizeStart && <ResizeHandle onResizeStart={onResizeStart} />}
    </th>
  )
}

// ── Column sorting ──
export type SortKey = 'number' | 'numberRange' | 'name' | 'dimensions' | 'type' | 'classification' | 'glType' | 'role' | 'normalBalance' | 'openingBalance' | 'posting' | 'currency' | 'fxBalance' | 'runningBalance' | 'status' | 'description' | 'effectiveDate' | 'internalId' | 'originalNumber' | 'imported' | 'restricted' | 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt'
export interface SortState { key: SortKey; dir: 'asc' | 'desc' }

// ── Column filters (Partner ColumnHeaderMenu port) ──
// Clicking a header opens Filter / Sort ascending / Sort descending; Filter
// switches the popover to an inline per-type editor.
export type ColFilterType = 'text' | 'multiselect' | 'range' | 'date'
export interface ColFilter { type: ColFilterType; values: string[]; text: string; min: string; max: string; from: string; to: string }
export type ColFilters = Partial<Record<ColKey, ColFilter>>
const FILTER_TYPE: Record<ColKey, ColFilterType> = {
  name: 'text', number: 'text', numberRange: 'range', type: 'multiselect', classification: 'multiselect',
  glType: 'multiselect', role: 'multiselect', normalBalance: 'multiselect',
  posting: 'multiselect', currency: 'multiselect', openingBalance: 'range',
  runningBalance: 'range', fxBalance: 'range',
  status: 'multiselect', description: 'text', dimensions: 'text', effectiveDate: 'date',
  // The original number is filtered by typing, like the current one. Imported is
  // two values, so it picks.
  originalNumber: 'text', imported: 'multiselect', restricted: 'multiselect',
  internalId: 'text',
  // People pick from the names in the chart; moments filter by day.
  createdBy: 'multiselect', createdAt: 'date', updatedBy: 'multiselect', updatedAt: 'date',
}
export const blankFilter = (k: ColKey): ColFilter => ({ type: FILTER_TYPE[k], values: [], text: '', min: '', max: '', from: '', to: '' })
export const filterActive = (f?: ColFilter | null) => !!f && (f.values.length > 0 || f.text.trim() !== '' || f.min !== '' || f.max !== '' || f.from !== '' || f.to !== '')

// Row predicate for the active column filters.
export function matchesColFilters(a: Account, filters: ColFilters, _allAccounts: Account[]): boolean {
  for (const k of Object.keys(filters) as ColKey[]) {
    const f = filters[k]
    if (!f || !filterActive(f)) continue
    const text = f.text.trim().toLowerCase()
    switch (k) {
      case 'name': if (text && !a.accountName.toLowerCase().includes(text)) return false; break
      case 'number': if (text && !a.accountNumber.toLowerCase().includes(text)) return false; break
      /* Filtered by overlap, not by the two endpoints separately. The question a
         reader brings to this column is "who has 5200?", and typing 5200 into
         both ends answers it - an endpoint match would only find the summary
         whose block happens to begin or end there. Rows reserving nothing are
         out as soon as the filter is on: they are what the reader is filtering
         away. */
      case 'numberRange': {
        const r = accountRange(a)
        if (!r) return false
        if (f.min !== '' && r.end < Number(f.min)) return false
        if (f.max !== '' && r.start > Number(f.max)) return false
        break
      }
      case 'type': if (f.values.length && !f.values.includes(ACCOUNT_TYPE_META[a.accountType].label)) return false; break
      case 'classification': if (f.values.length && !f.values.includes(a.statementClassification)) return false; break
      case 'glType': if (f.values.length && !f.values.includes(a.glAccountType)) return false; break
      // Unclassified accounts filter under the explicit "No role" value, so the
      // facet can be used to find the accounts still needing one.
      case 'role': if (f.values.length && !f.values.includes(a.accountRole ?? NO_ROLE_LABEL)) return false; break
      case 'normalBalance': if (f.values.length && !f.values.includes(a.normalBalance)) return false; break
      case 'posting': if (f.values.length && !f.values.includes(a.isPosting ? 'Posting' : 'Summary')) return false; break
      case 'currency': if (f.values.length && !f.values.includes(a.currencyCode)) return false; break
      case 'openingBalance': {
        const v = a.balance - (a.netChange ?? 0)
        if (f.min !== '' && v < Number(f.min)) return false
        if (f.max !== '' && v > Number(f.max)) return false
        break
      }
      case 'fxBalance': {
        const v = currentOwnBalanceOf(a)
        if (f.min !== '' && v < Number(f.min)) return false
        if (f.max !== '' && v > Number(f.max)) return false
        break
      }
      case 'runningBalance': {
        // Running balance is the balance today, whatever the period, so the
        // filter reads the figure the column prints.
        const v = a.currentBalance ?? a.balance
        if (f.min !== '' && v < Number(f.min)) return false
        if (f.max !== '' && v > Number(f.max)) return false
        break
      }
      case 'status': if (f.values.length && !f.values.includes(a.status)) return false; break
      case 'description': if (text && !(a.description ?? '').toLowerCase().includes(text)) return false; break
      case 'dimensions': if (text && !a.defaultDimensionValues.map(tv => `${tv.dimensionId} ${tv.value}`).join(' ').toLowerCase().includes(text)) return false; break
      case 'effectiveDate': {
        if (f.from && a.effectiveDate < f.from) return false
        if (f.to && a.effectiveDate > f.to) return false
        break
      }
      case 'internalId': if (text && !a.internalId.toLowerCase().includes(text)) return false; break
      case 'originalNumber': if (text && !arrivalCodeText(a).toLowerCase().includes(text)) return false; break
      case 'imported': if (f.values.length && !f.values.includes(importedText(a))) return false; break
      case 'restricted': if (f.values.length && !f.values.includes(restrictedText(a))) return false; break
      case 'createdBy': if (f.values.length && !f.values.includes(personText(a.createdBy))) return false; break
      case 'updatedBy': if (f.values.length && !f.values.includes(personText(modifiedByOf(a)))) return false; break
      case 'createdAt':
      case 'updatedAt': {
        const day = localDayOf(k === 'createdAt' ? a.createdAt : modifiedAtOf(a))
        if (f.from && day < f.from) return false
        if (f.to && day > f.to) return false
        break
      }
    }
  }
  return true
}

// Unique values for the multiselect filter editors.
export function uniqueColValues(k: ColKey, accounts: Account[]): string[] {
  switch (k) {
    case 'type': return Array.from(new Set(accounts.map(a => ACCOUNT_TYPE_META[a.accountType].label)))
    // In statement order, not first-seen or alphabetical: current assets before
    // non-current, cost of sales before operating expenses. The facet then reads
    // in the same order as the statement the column describes.
    case 'classification': return ALL_CLASSIFICATIONS.filter(c => accounts.some(a => a.statementClassification === c))
    case 'glType': return Array.from(new Set(accounts.map(a => a.glAccountType)))
    // Roles in canonical category order, not first-seen order, and only the ones
    // actually present. "No role" trails the list.
    case 'role': {
      const present = new Set(accounts.map(a => a.accountRole ?? NO_ROLE_LABEL))
      return [...ALL_ACCOUNT_ROLES.filter(r => present.has(r)), ...(present.has(NO_ROLE_LABEL) ? [NO_ROLE_LABEL] : [])]
    }
    // Debit before Credit, the order a ledger is read in, rather than alphabetical.
    case 'normalBalance': return (['Debit', 'Credit', 'n/a'] as const).filter(v => accounts.some(a => a.normalBalance === v))
    case 'currency': return Array.from(new Set(accounts.map(a => a.currencyCode))).sort()
    case 'status': return Array.from(new Set(accounts.map(a => a.status))).sort()
    case 'posting': return ['Posting', 'Summary']
    // Both offered whatever the chart holds, so "No" is still pickable on a
    // chart that was imported whole and "Yes" on one that never was. A facet
    // that disappears reads as a broken filter rather than an empty answer.
    case 'imported': return ['Yes', 'No']
    case 'restricted': return ['Yes', 'No']
    case 'createdBy': return peopleIn(accounts.map(a => a.createdBy))
    case 'updatedBy': return peopleIn(accounts.map(modifiedByOf))
    default: return []
  }
}

// The header popover itself - column-name box, Filter, Sort ascending /
// descending, plus the inline filter editor (text / multiselect / range /
// date), styled exactly like the Partner table's ColumnHeaderMenu.
export const FILTER_INPUT_CLS = 'w-full h-8 px-3 text-[13px] border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#D6E8FF] focus:border-[#ADD1FF]'
// DateField trigger dressed as a FILTER_INPUT_CLS field, so the date filter's
// From/To read as inputs alongside the text and number ones.
const FILTER_DATE_TRIGGER_CLS = 'w-full h-8 px-2.5 text-[13px] border border-border rounded-md bg-white hover:border-primary/50 transition-colors'

// Popover portaled to <body> with fixed positioning, so it can never be
// clipped by the table's overflow-auto scroller or the chips bar's
// overflow-x-auto. Repositions on scroll/resize and clamps to the viewport.
// Outside-click handlers must also allow clicks inside [data-col-popover].
export function AnchoredPopover({ anchor, open, align = 'left', width, className, children }: {
  anchor: React.RefObject<HTMLElement | HTMLDivElement | null>
  open: boolean
  align?: 'left' | 'right'
  width: number
  className?: string
  children: React.ReactNode
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useEffect(() => {
    if (!open) { setPos(null); return }
    const update = () => {
      const r = anchor.current?.getBoundingClientRect()
      if (!r) return
      let left = align === 'right' ? r.right - width : r.left
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
      setPos({ top: r.bottom + 6, left })
    }
    update()
    window.addEventListener('resize', update)
    document.addEventListener('scroll', update, true)
    return () => { window.removeEventListener('resize', update); document.removeEventListener('scroll', update, true) }
  }, [open, align, width, anchor])
  if (!open || !pos) return null
  return createPortal(
    <div
      data-col-popover
      style={{ position: 'fixed', top: pos.top, left: pos.left, width, transformOrigin: align === 'right' ? 'top right' : 'top left' }}
      className={cn('z-[60] bg-white rounded-lg shadow-lg border border-border/80 text-left font-normal normal-case cursor-default animate-popover-down motion-reduce:animate-none', className)}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      draggable={false}
      onDragStart={e => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}

// Outside-click predicate shared by the popover owners: a click counts as
// "outside" only when it's outside both the trigger and any portaled popover.
export const clickIsOutside = (e: MouseEvent, trigger: HTMLElement | null) => {
  const t = e.target as Element | null
  if (!t) return true
  if (trigger && trigger.contains(t)) return false
  // [data-date-popover] is the DateField calendar, which portals out of the
  // filter popover - picking a day must not read as a click away.
  if (typeof t.closest === 'function' && t.closest('[data-col-popover],[data-date-popover]')) return false
  return true
}

// The per-type filter editor (multiselect / text / range / date), shared by
// the column-header menu and the ActiveFilters chips so editing feels the
// same from either entry point - exactly like the Partner table.
/* What a crossed range says, and the one click out of it. A swap rather than a
   clear: both ends are ones the reader typed on purpose, and the order is the
   only thing wrong with them.
 *
 * Lives here rather than in Filters.tsx because Filters imports this module, and
 * both the modal's Minimum / Maximum pair and the column popover's Min / Max
 * pair have to say it the same way. */
export function CrossedRangeNote({ what, onSwap }: { what: string; onSwap: () => void }) {
  return (
    <p className="text-[12px] text-danger-600 mt-2">
      {what}
      <button
        type="button"
        onClick={onSwap}
        className="ml-1.5 underline underline-offset-2 hover:no-underline cursor-pointer"
        style={{ fontWeight: 500 }}
      >
        Swap them
      </button>
    </p>
  )
}

function FilterEditorBody({ label, filter, onFilterChange, uniqueValues }: {
  label: string
  filter: ColFilter
  onFilterChange: (f: ColFilter) => void
  uniqueValues: string[]
}) {
  const [search, setSearch] = useState('')
  const clear = () => onFilterChange({ ...filter, values: [], text: '', min: '', max: '', from: '', to: '' })
  const visibleValues = uniqueValues.filter(v => v.toLowerCase().includes(search.trim().toLowerCase()))
  return (
    <>
      {filter.type === 'multiselect' && (
        <div>
          {uniqueValues.length > 5 && (
            <div className="px-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" autoFocus className={cn(FILTER_INPUT_CLS, 'pl-8 pr-3')} />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground cursor-pointer"><X className="w-3 h-3" /></button>
                )}
              </div>
            </div>
          )}
          <div className="border-t border-border/40" />
          <div className="max-h-[240px] overflow-y-auto py-1 px-1">
            {visibleValues.length === 0
              ? <div className="px-3 py-4 text-center text-[13px] text-muted-foreground">No options found</div>
              : visibleValues.map(v => {
                  const selected = filter.values.includes(v)
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => onFilterChange({ ...filter, values: selected ? filter.values.filter(x => x !== v) : [...filter.values, v] })}
                      className={cn('flex items-center gap-2.5 w-full px-2.5 py-[6px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/50', selected && 'bg-primary/5')}
                    >
                      <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', selected ? 'bg-primary border-primary' : 'border-border-strong bg-white')}>
                        {selected && <Check size={11} className="text-white" />}
                      </span>
                      <span className="text-foreground" style={{ fontWeight: selected ? 500 : 400 }}>{v}</span>
                    </button>
                  )
                })}
          </div>
          {filter.values.length > 0 && (
            <>
              <div className="border-t border-border/40" />
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground">{filter.values.length} selected</span>
                <button type="button" onClick={clear} className="text-[12px] cursor-pointer transition-colors hover:text-primary" style={{ fontWeight: 500, color: 'hsl(var(--primary))' }}>Clear selection</button>
              </div>
            </>
          )}
        </div>
      )}
      {filter.type === 'text' && (
        <div className="px-3 pb-3">
          <input type="text" value={filter.text} onChange={e => onFilterChange({ ...filter, text: e.target.value })} placeholder={`Filter by ${label.toLowerCase()}`} autoFocus className={FILTER_INPUT_CLS} />
        </div>
      )}
      {filter.type === 'range' && (() => {
        // Same reading, and the same one click out of it, as the Filters modal's
        // Minimum / Maximum pair. A crossed range asks for nothing, and this
        // popover has no footer count to hint at that.
        const crossed = invertedRange(filter.min, filter.max)
        const cls = cn(FILTER_INPUT_CLS, 'px-2.5 tabular-nums', crossed && 'border-danger-500 ring-4 ring-danger-100')
        return (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>Min</label>
                <input type="number" value={filter.min} onChange={e => onFilterChange({ ...filter, min: e.target.value })} placeholder="0" autoFocus aria-invalid={crossed || undefined} className={cls} />
              </div>
              <span className="text-muted-foreground/30 mt-4">–</span>
              <div className="flex-1">
                <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>Max</label>
                <input type="number" value={filter.max} onChange={e => onFilterChange({ ...filter, max: e.target.value })} placeholder="∞" aria-invalid={crossed || undefined} className={cls} />
              </div>
            </div>
            {crossed && (
              <CrossedRangeNote
                what="Min is above Max, so nothing can fall between them."
                onSwap={() => onFilterChange({ ...filter, min: filter.max, max: filter.min })}
              />
            )}
          </div>
        )
      })()}
      {filter.type === 'date' && (() => {
        const crossed = invertedDates(filter.from, filter.to)
        const cls = cn(FILTER_DATE_TRIGGER_CLS, crossed && 'border-danger-500 ring-4 ring-danger-100')
        return (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>From</label>
                <DateField clearable value={filter.from} placeholder="Any" triggerClassName={cls}
                  onChange={iso => onFilterChange({ ...filter, from: iso })} />
              </div>
              <span className="text-muted-foreground/30 mt-4">–</span>
              <div className="flex-1 min-w-0">
                <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>To</label>
                <DateField clearable value={filter.to} placeholder="Any" triggerClassName={cls}
                  onChange={iso => onFilterChange({ ...filter, to: iso })} />
              </div>
            </div>
            {crossed && (
              <CrossedRangeNote
                what="From is after To, so no day falls between them."
                onSwap={() => onFilterChange({ ...filter, from: filter.to, to: filter.from })}
              />
            )}
          </div>
        )
      })()}
    </>
  )
}

const operatorFor = (f: ColFilter) => (f.type === 'multiselect' ? 'is' : f.type === 'text' ? 'contains' : 'between')

export function HeaderMenu({ label, sortable, currentSort, onSortDir, filter, onFilterChange, uniqueValues, align, onHide, onToggleFreeze, frozen, children }: {
  label: string
  sortable: boolean
  currentSort: 'asc' | 'desc' | null
  onSortDir: (dir: 'asc' | 'desc' | null) => void
  filter: ColFilter
  onFilterChange: (f: ColFilter) => void
  uniqueValues: string[]
  align?: 'right'
  onHide?: () => void
  onToggleFreeze?: () => void
  frozen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'menu' | 'filter'>('menu')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (clickIsOutside(e, ref.current)) {
        setOpen(false)
        setTimeout(() => setView('menu'), 150)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  const hasActive = filterActive(filter)
  const clear = () => onFilterChange({ ...filter, values: [], text: '', min: '', max: '', from: '', to: '' })
  const handleSort = (dir: 'asc' | 'desc') => { onSortDir(currentSort === dir ? null : dir); setOpen(false) }
  const itemCls = 'flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] cursor-pointer transition-colors hover:bg-muted/60'
  return (
    /* The whole header cell opens the menu, not only its label. Design review,
       2026-09-24 - Eli: *"The whole column needs to be clickable."* The trigger's
       ::after stretches over the nearest positioned ancestor, which is the <th>
       (every header cell that holds this menu is `relative` or sticky), so this
       wrapper must stay unpositioned. The label and its info icon sit above the
       stretch so the icon's tooltip still answers to hover, and the resize grip
       sits above both. */
    <div ref={ref} className="inline-block">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setView('menu') }}
        className="inline-flex items-center gap-1 hover:text-fg transition-colors cursor-pointer select-none after:absolute after:inset-0 after:content-['']"
      >
        <span className="relative z-[1] inline-flex items-center gap-1">{children}</span>
      </button>
      {open && (
        <AnchoredPopover
          anchor={ref}
          open={open}
          align={align === 'right' ? 'right' : 'left'}
          width={view === 'filter' ? (filter.type === 'date' ? 340 : 260) : 220}
        >
          {view === 'menu' ? (
            <>
              {/* Column name display */}
              <div className="px-3 pt-3 pb-2">
                <div className="flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-muted/30">
                  <span className="text-xs text-muted-foreground" style={{ fontWeight: 500 }}>{label}</span>
                </div>
              </div>
              <div className="border-t border-border/60" />
              <div className="py-1 px-1">
                {/* Filter - also ensures the column's chip exists in the
                    ActiveFilters bar, like the Partner table. */}
                <button type="button" onClick={() => { setView('filter'); if (!hasActive) onFilterChange({ ...filter }) }} className={cn(itemCls, hasActive ? 'text-primary' : 'text-foreground')}>
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span style={{ fontWeight: 400 }}>Filter</span>
                  {hasActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                </button>
                {sortable && (
                  <>
                    <button type="button" onClick={() => handleSort('asc')} className={cn(itemCls, currentSort === 'asc' ? 'text-primary bg-primary/5' : 'text-foreground')}>
                      <ArrowUp className="w-4 h-4 text-muted-foreground" />
                      <span style={{ fontWeight: 400 }}>Sort ascending</span>
                      {currentSort === 'asc' && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                    </button>
                    <button type="button" onClick={() => handleSort('desc')} className={cn(itemCls, currentSort === 'desc' ? 'text-primary bg-primary/5' : 'text-foreground')}>
                      <ArrowDown className="w-4 h-4 text-muted-foreground" />
                      <span style={{ fontWeight: 400 }}>Sort descending</span>
                      {currentSort === 'desc' && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                    </button>
                  </>
                )}
                {(onToggleFreeze || onHide) && <div className="border-t border-border/60 my-1" />}
                {onHide && (
                  <button type="button" onClick={() => { onHide(); setOpen(false) }} className={cn(itemCls, 'text-foreground')}>
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                    <span style={{ fontWeight: 400 }}>Hide</span>
                  </button>
                )}
                {onToggleFreeze && (
                  <button type="button" onClick={() => { onToggleFreeze(); setOpen(false) }} className={cn(itemCls, frozen ? 'text-primary' : 'text-foreground')}>
                    <Snowflake className="w-4 h-4 text-muted-foreground" />
                    <span style={{ fontWeight: 400 }}>{frozen ? 'Unfreeze' : 'Freeze'}</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Inline filter view - back chevron, "<column> contains/is/between", Clear */}
              <div className="px-3 pt-2.5 pb-2">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setView('menu')} className="inline-flex items-center justify-center w-6 h-6 rounded-md cursor-pointer transition-colors hover:bg-muted/60 text-muted-foreground shrink-0">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1.5 text-[13px] min-w-0">
                    <span className="truncate" style={{ fontWeight: 500, color: 'hsl(var(--foreground))' }}>{label}</span>
                    <span className="text-muted-foreground/50 shrink-0">{operatorFor(filter)}</span>
                  </div>
                  {hasActive && (
                    <button type="button" onClick={clear} className="ml-auto text-[12px] cursor-pointer transition-colors hover:text-primary shrink-0" style={{ fontWeight: 500, color: 'hsl(var(--primary))' }}>Clear</button>
                  )}
                </div>
              </div>
              <FilterEditorBody label={label} filter={filter} onFilterChange={onFilterChange} uniqueValues={uniqueValues} />
            </>
          )}
        </AnchoredPopover>
      )}
    </div>
  )
}

// ── ActiveFilters bar (Partner ColumnFilterChip + ActiveFiltersBar port) ──
// Chips for every column with a filter (blank or active), each reopening the
// same editor; a dashed "+ Filter" picker; and Clear all.
function ColumnFilterChip({ label, filter, uniqueValues, onFilterChange, onRemove, autoOpen, onAutoOpened }: {
  label: string
  filter: ColFilter
  uniqueValues: string[]
  onFilterChange: (f: ColFilter) => void
  onRemove: () => void
  autoOpen?: boolean
  onAutoOpened?: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (clickIsOutside(e, ref.current)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  useEffect(() => {
    if (autoOpen) {
      const t = setTimeout(() => { setOpen(true); onAutoOpened?.() }, 60)
      return () => clearTimeout(t)
    }
  }, [autoOpen, onAutoOpened])
  const active = filterActive(filter)
  const clear = () => onFilterChange({ ...filter, values: [], text: '', min: '', max: '', from: '', to: '' })
  const summary = (() => {
    if (!active) return ''
    switch (filter.type) {
      case 'multiselect': return filter.values.length === 1 ? filter.values[0] : `${filter.values.length} selected`
      case 'text': return filter.text
      case 'range': {
        const parts: string[] = []
        if (filter.min) parts.push(`≥ ${filter.min}`)
        if (filter.max) parts.push(`≤ ${filter.max}`)
        return parts.join(' & ')
      }
      case 'date': {
        const parts: string[] = []
        if (filter.from) parts.push(`from ${filter.from}`)
        if (filter.to) parts.push(`to ${filter.to}`)
        return parts.join(' ')
      }
      default: return ''
    }
  })()
  return (
    <div ref={ref} className="flex items-center shrink-0 relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn('inline-flex items-center gap-1 h-[30px] pl-2.5 rounded-l-md border text-[13px] cursor-pointer transition-colors',
          active ? 'border-primary/30 bg-accent text-primary hover:bg-[#D6E8FF]' : 'border-border bg-white text-foreground hover:bg-muted/50',
          open && 'border-primary/40')}
        style={{ fontWeight: 500, borderRight: 'none' }}
      >
        {label}
        {active && summary && (
          <>
            <span className="text-muted-foreground/50 mx-0.5">·</span>
            <span className="text-[12px] max-w-[100px] truncate opacity-80">{summary}</span>
          </>
        )}
        <ChevronDown className="w-3 h-3 ml-0.5 mr-2 opacity-60" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className={cn('inline-flex items-center justify-center h-[30px] w-[28px] rounded-r-md border border-l-0 cursor-pointer transition-colors',
          active ? 'border-primary/30 bg-accent text-primary/60 hover:text-primary hover:bg-[#D6E8FF]' : 'border-border bg-white text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50')}
      >
        <X className="w-3 h-3" />
      </button>
      {open && (
        <AnchoredPopover anchor={ref} open={open} width={filter.type === 'date' ? 340 : 260}>
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <span style={{ fontWeight: 500 }}>{label}</span>
              <span className="text-muted-foreground/50">{operatorFor(filter)}</span>
              {active && (
                <button type="button" onClick={clear} className="ml-auto text-[12px] cursor-pointer transition-colors hover:text-primary" style={{ fontWeight: 500, color: 'hsl(var(--primary))' }}>Clear</button>
              )}
            </div>
          </div>
          <FilterEditorBody label={label} filter={filter} onFilterChange={onFilterChange} uniqueValues={uniqueValues} />
        </AnchoredPopover>
      )}
    </div>
  )
}

// Active column-filter chips + "+ Filter" picker + Clear all, mirroring the
// Partners table's Active Filters Bar. Generic over the column-key type so the
// General Ledger and register - whose keys aren't Account columns - share it.
export function ColumnFiltersBar<K extends string>({ filters, onChange, availableColumns, labelOf, uniqueValuesOf, blankFilterOf }: {
  filters: Partial<Record<K, ColFilter>>
  onChange: (f: Partial<Record<K, ColFilter>>) => void
  /* Visible, filterable columns offered by the "+ Filter" picker. */
  availableColumns: K[]
  labelOf: (k: K) => string
  uniqueValuesOf: (k: K) => string[]
  blankFilterOf: (k: K) => ColFilter
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [autoOpenKey, setAutoOpenKey] = useState<K | null>(null)
  const addRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!addOpen) return
    const h = (e: MouseEvent) => { if (clickIsOutside(e, addRef.current)) { setAddOpen(false); setAddSearch('') } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [addOpen])

  const keys = Object.keys(filters) as K[]
  if (keys.length === 0) return null

  const addable = availableColumns.filter(k => !filters[k])
  const filteredAddable = addSearch.trim()
    ? addable.filter(k => labelOf(k).toLowerCase().includes(addSearch.toLowerCase()))
    : addable
  const anyActive = keys.some(k => filterActive(filters[k]))

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border overflow-x-auto scrollbar-thin">
      {keys.map(k => (
        <ColumnFilterChip
          key={k}
          label={labelOf(k)}
          filter={filters[k]!}
          uniqueValues={uniqueValuesOf(k)}
          onFilterChange={f => onChange({ ...filters, [k]: f })}
          onRemove={() => { const next = { ...filters }; delete next[k]; onChange(next) }}
          autoOpen={autoOpenKey === k}
          onAutoOpened={() => setAutoOpenKey(null)}
        />
      ))}

      {/* + Filter picker */}
      {addable.length > 0 && (
        <div ref={addRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setAddOpen(o => !o)}
            className="inline-flex items-center gap-1 h-[30px] px-2.5 rounded-md border border-dashed border-border text-[13px] text-muted-foreground cursor-pointer transition-colors hover:bg-muted/50 hover:text-foreground hover:border-muted-foreground/40"
            style={{ fontWeight: 500 }}
          >
            <Plus className="w-3.5 h-3.5" />
            Filter
          </button>
          {addOpen && (
            <AnchoredPopover anchor={addRef} open={addOpen} width={220}>
              <div className="px-3 pt-3 pb-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                  <input type="text" value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Search columns" autoFocus className={cn(FILTER_INPUT_CLS, 'pl-8 pr-3')} />
                </div>
              </div>
              <div className="border-t border-border/40" />
              <div className="max-h-[240px] overflow-y-auto py-1 px-1">
                {filteredAddable.length === 0
                  ? <div className="px-3 py-4 text-center text-[13px] text-muted-foreground">No columns available</div>
                  : filteredAddable.map(k => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => { onChange({ ...filters, [k]: blankFilterOf(k) }); setAutoOpenKey(k); setAddOpen(false); setAddSearch('') }}
                        className="flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] text-foreground cursor-pointer transition-colors hover:bg-muted/50"
                      >
                        <Filter className="w-3.5 h-3.5 text-muted-foreground/60" />
                        <span style={{ fontWeight: 400 }}>{labelOf(k)}</span>
                      </button>
                    ))}
              </div>
            </AnchoredPopover>
          )}
        </div>
      )}

      {/* Clear all. Same markup as `ClearFiltersLink` in Filters.tsx, which the
          Filters button uses - kept as a local copy rather than imported because
          Filters.tsx already imports from this file, and the other direction
          would close the cycle. Change both together. */}
      {anyActive && (
        <>
          <div className="w-px h-5 bg-border/60 shrink-0" />
          <button
            type="button"
            onClick={() => onChange({})}
            className="text-[12px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors whitespace-nowrap shrink-0"
            style={{ fontWeight: 500 }}
          >
            Clear all
          </button>
        </>
      )}
    </div>
  )
}

function PostingChip({ a }: { a: Account }) {
  return a.isPosting
    ? <Badge tone="neutral">Posting</Badge>
    : <Badge tone="brand"><Lock size={10} /> Summary</Badge>
}

// The current balance and the movement behind it, for a row. A posting shows its
// own; a summary shows the sum of what is under it, taken from the shared chart
// index so the row and the tree can never print different totals. `netChange` is
// only there so Opening Balance can be derived as balance less movement.
//
// Read by the export too, which is why it leaves this file. A summary holds no
// balance of its own to store, so anything reading `a.balance` for one reads the
// zero that was never written to - the file used to, and said every summary
// account totalled nothing.
//
// Null means "print no figure": a summary that is no longer active has stopped
// totalling, which is exactly what its deactivate confirmation promised, so
// showing the live sum anyway would contradict it.
export function chartRowValues(a: Account, index: ChartIndex): ChartFigures | null {
  if (!showsSummaryTotal(a)) return null
  return index.figuresOf(a.id)
}

// The figures each row's amount columns actually display, keyed by id, so a sort
// orders rows by the numbers on screen. Sorting used to run off a separate
// roll-up whose movement was a raw debit − credit (inverted for credit-normal
// accounts) and which was built from the *filtered* rows rather than the whole
// chart, so with a filter active the order disagreed with every visible figure.
function amountSortMap(rows: Account[], allAccounts: Account[]) {
  const index = buildChartIndex(allAccounts)
  const m = new Map<string, { opening: number; running: number }>()
  rows.forEach(a => {
    const v = chartRowValues(a, index)
    // A summary that has stopped totalling sorts as zero rather than falling
    // back to a figure it is deliberately not showing.
    m.set(a.id, { opening: v ? v.balance - v.netChange : 0, running: v ? v.current : 0 })
  })
  return m
}

// Running balance cell, shared by the list and tree rows. The value is
// chartRowValues' current: a posting's balance as it stands today, or a summary's
// sum of what is under it - whatever the accounting period, matching the detail
// page's Running Balance KPI (Mahad, 2026-10-11). It
// carries no lock / "prov." marker: the period strip above the table already
// states the period and whether it is closed, and repeating that on every row
// would drown the figures.
function RunningBalanceCell({ k, a, base, v, structural, padCls, style, q = '' }: {
  k: ColKey; a: Account; base: string; v: number | null; structural?: boolean; padCls: string; style?: CSSProperties; q?: string
}) {
  if (v == null) return <td key={k} className={cn('pl-4 pr-4 text-right text-sm', padCls)} style={style}><span className="text-fg-subtle">-</span></td>
  const nonBase = a.currencyCode !== base
  return (
    <td key={k} className={cn('pl-4 pr-4 text-right text-sm font-medium whitespace-nowrap', nonBase ? 'text-slate-500' : 'text-slate-700', structural && 'font-semibold', padCls)} style={style}>
      {/* The converted figure is the one that needs the rate explained, because
          it is the only one on the row that a rate produced. The account's own
          balance is simply what the account holds. */}
      {nonBase
        ? <FxBalanceTooltip code={a.currencyCode} base={base} booked={v} own={a.isPosting ? currentOwnBalanceOf(a) : undefined}><span className="cursor-help inline-flex items-center justify-end gap-1"><BookedMarker code={a.currencyCode} /><Marked text={fmtBalance(a, v, base)} q={q} /></span></FxBalanceTooltip>
        : <Marked text={fmtBalance(a, v, base)} q={q} />}
    </td>
  )
}
const isStructuralRow = (a: Account) => a.glAccountType !== 'Posting'
// Per-level indent in the Name and GL account type columns. One scale for the
// list and the tree: both print the same chart, so a row two levels down has to
// read as two levels down in either view.
// 26, not 22, and the four extra pixels are the elbow's clearance: the gap before a
// row's toggle can only be taken out of the step, so a narrower step is what makes
// the branch lines stubby.
export const INDENT_STEP = 26
export const NAME_INDENT_BASE = 14
// Indent guides. A trunk drops from under a parent's toggle and branches into each
// of its children with a rounded elbow.
//
// The trunk for a level sits on the toggle centre of the parent one level above it,
// which is what makes the line look like it comes out of that toggle rather than
// floating near it. The elbow then reaches back toward the child's own indent, but
// stops GUIDE_GAP short of it, so the tip never touches the toggle or the label it
// points at. Only INDENT_STEP - TOGGLE_C pixels separate the trunk from the child's
// content, and the elbow plus that gap have to fit inside them.
const TOGGLE_C = 10       // toggle centre, from the row's own paddingLeft
const GUIDE_RISE = 8      // how far above the row's midline the elbow starts to turn
const GUIDE_R = 8         // corner radius, small enough to leave a straight run on both legs
const GUIDE_GAP = 4       // clear air between the elbow's tip and the row's toggle or label
const GUIDE_BRANCH = INDENT_STEP - TOGGLE_C - GUIDE_GAP
// What a row with nothing to expand puts where the toggle would be, on top of the
// row's own 6px flex gap. Every such row uses it, whatever its siblings do: holding
// the full 20px slot open on a name with no button beside it pushed the name clear
// of the elbow pointing at it, and a child then sat almost where a grandchild sits.
// It cannot go to zero either: the slot is exactly one indent step wide, so a row
// with no lead at all would print its name flush under its parent's and the nesting
// would read flat.
export const LEAF_LEAD = 6
const guideLeft = (depth: number) => NAME_INDENT_BASE + (depth - 1) * INDENT_STEP + TOGGLE_C

// One trunk per ancestor level, plus the elbow that hangs this row off the
// innermost of them. `trunks[i]` says whether the ancestor at level i+1 still has
// rows below this one: true draws a full-height line passing through, false means
// this row is that ancestor's last child so the line closes on the elbow.
// `openTrunk` continues the line downward out of an expanded row into its own
// children.
//
// Every nested row is branched into, summaries included. A summary is both a child
// of the row above it and a parent of the rows below, and it needs to read as both:
// the elbow says which trunk it hangs off, and the separate line dropping out of its
// own toggle says what hangs off it. Running the trunk straight through instead left
// the line stopping dead at a row edge on the last child, with nothing to say it had
// finished.
//
// `vertical` drops the elbows and keeps the lines, which is how the list reads: an
// elbow points at the toggle it branches into, and the list has no toggles. The
// closing line then has to end on the midline of the last child rather than short of
// it, or it leaves a stub pointing at nothing.
/* `openFrom` is where a trunk carried on down from this row starts: clear of
   the expand toggle in the listing, just under the name where a row has none
   (the placement preview). */
export function TreeGuides({ trunks, openTrunk, vertical, openFrom = 'calc(50% + 14px)' }: { trunks: boolean[]; openTrunk?: boolean; vertical?: boolean; openFrom?: string }) {
  if (trunks.length === 0 && !openTrunk) return null
  return (
    <>
      {trunks.map((carries, i) => {
        const left = guideLeft(i + 1)
        const innermost = i === trunks.length - 1
        // An outer level whose branch has already closed draws nothing at all -
        // drawing it short would leave a stub hanging in the indent with no row it
        // belongs to.
        if (!innermost) {
          return carries
            ? <span key={i} aria-hidden className="absolute w-px bg-slate-200 inset-y-0" style={{ left }} />
            : null
        }
        const closeAt = vertical ? '50%' : `calc(50% + ${GUIDE_RISE}px)`
        return (
          <Fragment key={i}>
            <span aria-hidden className="absolute w-px bg-slate-200" style={{ left, top: 0, bottom: carries ? 0 : closeAt }} />
            {!vertical && (
              <span aria-hidden className="absolute border-l border-b border-slate-200 rounded-bl-[8px]"
                style={{ left, top: `calc(50% - ${GUIDE_RISE}px)`, width: GUIDE_BRANCH, height: GUIDE_RISE, borderBottomLeftRadius: GUIDE_R }} />
            )}
          </Fragment>
        )
      })}
      {openTrunk && (
        // Starts clear of the toggle it hangs from (radius ~10px plus breathing room).
        <span aria-hidden className="absolute w-px bg-slate-200" style={{ left: guideLeft(trunks.length + 1), top: openFrom, bottom: 0 }} />
      )}
    </>
  )
}
// Fill for the row heading a category. It keeps the band weight the category
// dividers always had, but that band now sits on a real account row, so the fill
// has to be opaque - the row pins on scroll - and composited over white rather
// than translucent, or the rows sliding under it would show through.
const CAT_BAND_BG = 'color-mix(in srgb, hsl(var(--muted)) 30%, #fff)'

// The lifecycle block of a row's kebab, shared by the list and the tree so the
// two can never offer different actions. Labels come from the rules. An action
// the rules would refuse is still offered, and answers in a dialog naming what
// holds it up - a posting account with open entries, a summary account with
// accounts still active under it - because a greyed item with its reason behind a
// hover asks the reader to go looking at the one moment they will not. Only
// mounts while a menu is open, so the full-store subscription costs nothing per
// row.
//
// Delete is the one exception to "always offered", and the reason is in
// accountLifecycle: it is not a harsher archive, it is for a row that was a
// mistake, so it only exists while nothing has posted to the account. On every
// other row it is absent, with Archive above it saying what to do instead.
/* The two things a reader does *to* a posting account's balance, as opposed to
   the account record: state where it started, and move it.

   Only posting accounts, because a summary has no balance of its own - it is the
   total of the accounts under it, and setting an opening balance on one would be
   stating a figure the children then contradict. Both go out through `onAction`
   like everything else in this menu, so the row stays free of the modals.

   Disabled rather than hidden where an entry cannot reach the account. The
   reason is the same one the entry form's picker gives, and a missing item sends
   the reader hunting for a verb that is right there.

   `omitOpeningBalance` is the listing's, and only the listing's - the single
   sanctioned difference between the two menus. Stating where an account started
   is work done on that account, and it belongs on the page that is about it.
   Creating an entry is not, so it stays on the row. */
export function BalanceMenuItems({ a, onAction, close, size, omitOpeningBalance }: {
  a: Account; onAction: any; close: () => void; size: number; omitOpeningBalance?: boolean
}) {
  // Locked only where the entry's own picker does not offer the account at all:
  // archived and deactivated. Retained earnings is offered there since
  // 2026-10-09, so it is offered here too.
  if (a.glAccountType !== 'Posting') return null
  const lock = manualPostingLock(a)
  return (
    <>
      <MenuItem
        icon={<BookPlus size={size} />}
        disabled={!!lock}
        disabledReason={lock}
        onClick={() => { close(); onAction('journalEntry', a) }}
      >Create journal entry</MenuItem>
      {!omitOpeningBalance && (
      <MenuItem
        icon={<Wallet size={size} />}
        disabled={a.status === 'Archived'}
        disabledReason={a.status === 'Archived' ? 'This account is archived, so its opening balance is fixed.' : undefined}
        onClick={() => { close(); onAction('openingBalance', a) }}
      >Enter opening balance</MenuItem>
      )}
    </>
  )
}

/* The five category rows are the chart's fixed spine, and nothing takes one out
   of service: `neverArchivableReason` refuses every closing action on them, so
   offering Deactivate and Archive here only ever led to a refusal. The menu is
   the wrong place to argue - it stops offering them. Edit and Create GL account
   remain, which is everything a category row can actually do. */
export function LifecycleMenuItems({ a, onAction, close, size }: {
  a: Account; onAction: any; close: () => void; size: number
}) {
  const ctx = lifecycleCtx(useStore())
  if (isCategoryRoot(a)) return null
  const deact = planLifecycle('deactivate', a, ctx)
  const back = planLifecycle(a.status === 'Archived' ? 'unarchive' : 'activate', a, ctx)
  const arch = planLifecycle('archive', a, ctx)
  /* A summary is offered Deactivate too since decision 53, gated on the
     accounts under it all being inactive - checked on the click, with the
     reason, as decision 52 has every closing action checked. */
  const deactivates = a.status === 'Active'
  return (
    <>
      {deactivates && <MenuItem icon={<CircleSlash size={size} />} warning onClick={() => { close(); onAction('deactivate', a) }}>{deact.menuLabel}</MenuItem>}
      {a.status === 'Inactive' && <MenuItem icon={<Power size={size} />} onClick={() => { close(); onAction('activate', a) }}>{back.menuLabel}</MenuItem>}
      {a.status === 'Archived'
        ? <MenuItem icon={<ArchiveRestore size={size} />} onClick={() => { close(); onAction('activate', a) }}>{back.menuLabel}</MenuItem>
        : <MenuItem icon={<Archive size={size} />} danger onClick={() => { close(); onAction('archive', a) }}>{arch.menuLabel}</MenuItem>}
      {canDeleteAccount(a, ctx) && (
        <MenuItem icon={<Trash2 size={size} />} danger onClick={() => { close(); onAction('delete', a) }}>Delete account</MenuItem>
      )}
    </>
  )
}

/* Asking a row for a child, on whichever view the reader asked from. A summary
   takes children, so it is offered one - and the item names what the child is,
   "Create GL account", the same words the page header uses, rather than naming
   the relationship. A posting account never takes a child - entries land on it,
   and a total cannot also be a line - so the same request is read as what it
   must mean instead: put a summary above this account. The item says so rather
   than offering a child and refusing it a click later.

   "Move under", not "Move to": the account is not going anywhere the reader has
   to go and find, it stays where it is and gains a parent. And "summary
   account" in full, matching what the save reports back - "Moved under new
   summary 1050 ...". Shared with the modal the item opens, which is titled the
   same: the reader picked an action, and a modal that renamed it would read as
   having landed somewhere else. */
export const WRAP_ACTION_LABEL = 'Move under a new summary account'

export function AddChildMenuItem({ a, onAddChild, close, size = 14 }: {
  a: Account; onAddChild: (a: Account) => void; close: () => void; size?: number
}) {
  const wraps = a.glAccountType === 'Posting'
  /* An archived summary is off the chart, so it is not a parent the save would
     accept. Only the parent case: wrapping an archived posting account builds
     the summary above it, which asks nothing of the archived record. */
  const closed = !wraps && a.status === 'Archived'
  return (
    <MenuItem
      icon={wraps ? <FolderTree size={size} /> : <CornerDownRight size={size} />}
      disabled={closed}
      disabledReason={closed ? 'This account is archived, so nothing new can be filed under it.' : undefined}
      onClick={() => { close(); onAddChild(a) }}
    >{wraps ? WRAP_ACTION_LABEL : 'Create GL account'}</MenuItem>
  )
}

/* What "Create account above" and "Create account below" open the create form
   on: a sibling of the row - same parent, category and classification - posting
   by default, as a row added between two others is, and numbered in the gap on
   that side (see `numberBeside`). Where the gap holds no number the field is
   left for the reader, with the form's recommendation under it. */
export function besidePrefill(a: Account, side: 'above' | 'below', chart: Account[], protection: boolean): CreateRowPrefill {
  const n = numberBeside({ account: a, side, chart, protection })
  return {
    accountNumber: n === null ? undefined : String(n),
    accountType: a.accountType,
    glAccountType: 'Posting',
    statementClassification: a.statementClassification,
    parentId: a.parentId,
  }
}

/* Design review, 2026-10-02. The setup tables let a reader add an account
   between two rows from a "+" that shows on hover, and Eli missed it - *"This
   hover state is completely lost to me until I accidentally looked at it"* - and
   went to the row's menu for it instead: *"I'm clicking on this, and I'm like, I
   want to create an account above it or below it."* So the menu says it, on
   every row that has a parent to share. A category's own row has none: the five
   categories are the chart's fixed spine, and nothing sits beside them. */
export function BesideMenuItems({ a, parent, onCreateBeside, close, size = 14 }: {
  a: Account
  /** The row's parent, to say why nothing can be filed beside an archived one. */
  parent?: Account
  onCreateBeside: (a: Account, side: 'above' | 'below') => void
  close: () => void
  size?: number
}) {
  if (!a.parentId) return null
  const closed = parent?.status === 'Archived'
  const reason = closed ? `${parent!.accountName} is archived, so nothing new can be filed under it.` : undefined
  return (
    <>
      <MenuItem icon={<BetweenHorizontalStart size={size} />} disabled={closed} disabledReason={reason}
        onClick={() => { close(); onCreateBeside(a, 'above') }}>Create account above</MenuItem>
      <MenuItem icon={<BetweenHorizontalEnd size={size} />} disabled={closed} disabledReason={reason}
        onClick={() => { close(); onCreateBeside(a, 'below') }}>Create account below</MenuItem>
    </>
  )
}

/* Everything a reader can do to an account, in one place, because the listing's
   row menu and the account's own page have to offer the same set. They used to
   be assembled separately and had drifted into three different answers: a
   posting row withheld "Move under a new summary account" and "Set opening
   balance", and the detail page withheld every lifecycle action - so which
   verbs an account had depended on which page you asked from.

   What each kind of account gets falls out of the pieces rather than out of a
   list here. A category root is the chart's fixed spine, so `LifecycleMenuItems`
   declines it; a summary has no balance of its own, so `BalanceMenuItems`
   declines it; and `AddChildMenuItem` reads a posting account's request for a
   child as the only thing it can mean, which is a summary above it.

   Order is one order for all three: the record, then the money, then where it is
   filed, then taking it out of service. `omitOpeningBalance` is the one
   difference between the two menus, and it is the listing's - see
   `BalanceMenuItems`. */
export function AccountActionItems({ a, onAction, onAddChild, onCreateBeside, parent, close, size = 14, omitOpeningBalance }: {
  a: Account
  onAction: (action: string, a: Account) => void
  onAddChild?: (a: Account) => void
  /** Offered where the table can open the create form; see BesideMenuItems. */
  onCreateBeside?: (a: Account, side: 'above' | 'below') => void
  parent?: Account
  close: () => void
  size?: number
  omitOpeningBalance?: boolean
}) {
  /* An archived account is read-only: off the chart, with its history kept.
     Its menu is Unarchive, and Delete where it never had a posting - nothing
     that edits it, files under it, moves it or posts to it. Module review,
     2026-10-06 (COA-21); Outline 05, chart row actions; Outline 09, archived
     rows. */
  if (a.status === 'Archived') return <LifecycleMenuItems a={a} onAction={onAction} close={close} size={size} />
  return (
    <>
      <MenuItem icon={<Pencil size={size} />} onClick={() => { close(); onAction('edit', a) }}>Edit account</MenuItem>
      <BalanceMenuItems a={a} onAction={onAction} close={close} size={size} omitOpeningBalance={omitOpeningBalance} />
      {onAddChild && <AddChildMenuItem a={a} onAddChild={onAddChild} close={close} size={size} />}
      {onCreateBeside && <BesideMenuItems a={a} parent={parent} onCreateBeside={onCreateBeside} close={close} size={size} />}
      <LifecycleMenuItems a={a} onAction={onAction} close={close} size={size} />
    </>
  )
}

// Every cell of an account row, keyed by column, shared by the flat list and the
// tree. There used to be one switch per view; they agreed on nothing but their
// intent, and the figures, chips and indentation drifted apart row by row. Only
// the Name column's leading controls differ between the views, and those arrive
// as `nameLead` / `nameTrail` rather than as a second copy of the switch.
//
// `cellStyle` is where a view states its own pinning: the list pins whichever
// columns the reader froze, the tree pins Number and Name and lifts them when a
// category anchor is stuck.
function rowCells({ a, q, order, padCls, comfort = false, base, depth, index, cellStyle, nameLead, nameTrail, trunks, openTrunk, verticalGuides, numberText, statusMenu, inert, bodyMinH, openRow }: {
  a: Account
  q: string
  order: ColKey[]
  padCls: string
  /** The grid is in Comfort density; read by the person cells, which pad themselves. */
  comfort?: boolean
  base: string
  /** Reserve the height the Actions kebab would set (its `btn-icon` is 32px), so
   *  a table that hides the Actions column still rides at the listing's row
   *  height instead of collapsing to its tallest chip. Off by default. */
  bodyMinH?: boolean
  /** How to write the number out; see useAccountNumberText. Defaults to the
   *  stored number so a caller that has no scheme in hand still reads right. */
  numberText?: (n: string) => string
  /** Nesting level within the rendered rows, not within the whole chart: a row
   *  whose parent is filtered out reads at the top level, which is where it is. */
  depth: number
  index: ChartIndex
  cellStyle?: (k: ColKey) => CSSProperties | undefined
  nameLead?: ReactNode
  nameTrail?: ReactNode
  /** One entry per ancestor level; see TreeGuides. Length is expected to equal
   *  `depth`, so a top-level row draws nothing. */
  trunks?: boolean[]
  /** Lines without elbows; see TreeGuides. */
  verticalGuides?: boolean
  openTrunk?: boolean
  /** Makes the Status cell a control rather than a label. Left out by the
   *  read-only surfaces (setup previews, the wizard), where a status shown is
   *  a fact about the chart being built and not something to change here. */
  statusMenu?: ReactNode
  /** The row opens nothing; see the note on the views' `onOpen`. Drops the "New"
   *  badge with the rest of the interaction: it answers "what have I added this
   *  session", which is not the question any preview is put on screen to
   *  answer. */
  inert?: boolean
  /** What the row opens, if anything. Given one, the name becomes a button so
   *  there is a keyboard route to it: the click lives on the whole `<tr>`, which
   *  no amount of Tab will ever reach. The name is the right carrier because it
   *  already says what the row is, so the button needs no label of its own. */
  openRow?: () => void
}): (ReactElement | null)[] {
  const meta = ACCOUNT_TYPE_META[a.accountType]
  const nonBase = a.currencyCode !== base
  const num = numberText ? numberText(a.accountNumber) : a.accountNumber
  const vals = chartRowValues(a, index)
  const structural = isStructuralRow(a)
  const st = (k: ColKey, own?: CSSProperties): CSSProperties | undefined => {
    const pin = cellStyle?.(k)
    return own || pin ? { ...own, ...pin } : undefined
  }
  const cell = (k: ColKey): ReactElement | null => {
    switch (k) {
      case 'name': return (
        <td key={k} className={cn('pr-4 relative', padCls)} style={st(k, { paddingLeft: NAME_INDENT_BASE + depth * INDENT_STEP })}>
          <TreeGuides trunks={trunks ?? []} openTrunk={openTrunk} vertical={verticalGuides} />
          <div className={cn('flex items-center gap-1.5 min-w-0', bodyMinH && 'min-h-8')}>
            {nameLead}
            {openRow ? (
              // Carries the row's own click so the two cannot say different
              // things, and stops it bubbling so the `<tr>` does not fire it a
              // second time. Styled to match the span exactly - this is the
              // keyboard's door to the row, not a link the design asked for.
              <button
                type="button"
                onClick={e => { e.stopPropagation(); openRow() }}
                className="text-sm truncate text-left min-w-0 bg-transparent p-0 m-0 border-0 cursor-pointer"
                style={{ fontWeight: structural ? 600 : 400, color: '#1E293B' }}
              ><Marked text={a.accountName} q={q} /></button>
            ) : (
              <span className="text-sm truncate" style={{ fontWeight: structural ? 600 : 400, color: '#1E293B' }}><Marked text={a.accountName} q={q} /></span>
            )}
            {!inert && <NewBadge id={a.id} />}
            {nameTrail}
          </div>
        </td>
      )
      // The column is pinned to a fixed width, so a number longer than it fits
      // clips with an ellipsis and keeps the full value in its tooltip. Left to
      // wrap, one long imported number (100-1000-000) set the height of every row
      // in the chart.
      case 'number': return (
        <td key={k} className={cn('pl-2 pr-0 text-sm text-slate-700 tabular-nums', padCls)} style={st(k)}>
          {/* The tooltip carries the whole stored number even when the cell is
              showing the account part alone, so a shortened chart never hides
              the number an account is really filed under. */}
          <span className="block truncate" title={a.accountNumber}><Marked text={num} q={q} /></span>
        </td>
      )
      case 'numberRange': return <td key={k} className={cn('px-4', padCls)} style={st(k)}><NumberRangeCell account={a} q={q} /></td>
      case 'type': return <td key={k} className={cn('px-4', padCls)} style={st(k)}><CategoryCell meta={meta} q={q} /></td>
      case 'classification': return <td key={k} className={cn('px-4 max-w-[220px]', padCls)} style={st(k)}><ClassificationCell account={a} parent={a.parentId ? index.parentOf(a.id) : undefined} q={q} /></td>
      case 'role': return <td key={k} className={cn('px-4', padCls)} style={st(k)}><RoleCell account={a} q={q} /></td>
      case 'normalBalance': return <td key={k} className={cn('px-4', padCls)} style={st(k)}><NormalBalanceCell account={a} q={q} /></td>
      // Not indented by depth. The Name column carries the tree, so stepping this
      // chip across as well only cost the column its scannability: a reader checking
      // which rows can be posted to wants one straight edge to run an eye down, not a
      // second copy of the hierarchy.
      case 'glType': return (
        <td key={k} className={cn('px-4', padCls)} style={st(k)}>
          {a.isContra ? (
            <Tooltip content="Posts opposite to its category and shows as a deduction (e.g. Accumulated Depreciation).">
              <span className="inline-flex items-stretch rounded-md border border-info-100 overflow-hidden text-xs align-middle cursor-help">
                <span className="inline-flex items-center px-2 py-0.5 font-medium whitespace-nowrap bg-info-50 text-info-700"><Marked text={a.glAccountType} q={q} /></span>
                <span className="inline-flex items-center px-2 py-0.5 bg-white text-sky-700 border-l border-info-100 whitespace-nowrap"><Marked text="Contra" q={q} /></span>
              </span>
            </Tooltip>
          ) : <Badge tone={GL_TYPE_TONE[a.glAccountType] ?? 'neutral'} className={PARTNER_CHIP_CLS}><Marked text={a.glAccountType} q={q} /></Badge>}
        </td>
      )
      case 'posting': return <td key={k} className={cn('px-4', padCls)} style={st(k)}><PostingChip a={a} /></td>
      case 'currency': return <td key={k} className={cn('px-4', padCls)} style={st(k)}><CurrencyCell code={a.currencyCode} q={q} /></td>
      case 'openingBalance': {
        if (!vals) return <td key={k} className={cn('pl-4 pr-4', padCls)} style={st(k)} />
        const ob = vals.balance - vals.netChange
        const obText = <Marked text={chartFigureText('openingBalance', a, index, base)} q={q} />
        return <td key={k} className={cn('pl-4 pr-4 text-right text-sm font-medium whitespace-nowrap', nonBase ? 'text-slate-500' : 'text-slate-700', structural && 'font-semibold', padCls)} style={st(k)}>{nonBase ? <BookedBaseTooltip code={a.currencyCode} base={base} booked={ob}><span className="cursor-help inline-flex items-center justify-end gap-1"><BookedMarker code={a.currencyCode} />{obText}</span></BookedBaseTooltip> : obText}</td>
      }
      case 'runningBalance': return <RunningBalanceCell key={k} k={k} a={a} base={base} v={vals ? vals.current : null} structural={structural} padCls={padCls} style={st(k)} q={q} />
      case 'fxBalance': return (
        <td key={k} className={cn('pl-2 pr-2 text-right text-sm font-medium whitespace-nowrap', (a.currentBalance ?? a.balance) < 0 ? 'text-slate-900' : 'text-success-700', padCls)} style={st(k)}>
          {nonBase
            ? <Marked text={chartFigureText('fxBalance', a, index, base)} q={q} />
            : <span className="text-fg-subtle">-</span>}
        </td>
      )
      case 'status': return <td key={k} className={cn('px-4', padCls)} style={st(k)}>{statusMenu ?? <StatusChip status={a.status} q={q} />}</td>
      case 'description': return <td key={k} className={cn('px-4 text-sm text-slate-600 max-w-[260px]', padCls)} style={st(k)}>{a.description ? <span className="block truncate" title={a.description}><Marked text={a.description} q={q} /></span> : <span className="text-fg-subtle">-</span>}</td>
      case 'dimensions': return <td key={k} className={cn('px-4', padCls)} style={st(k)}><DimensionPills dimensionValues={a.defaultDimensionValues} q={q} /></td>
      case 'effectiveDate': return <td key={k} className={cn('px-4 text-sm text-slate-700', padCls)} style={st(k)}>{a.effectiveDate}</td>
      case 'internalId': return <td key={k} className={cn('px-4', padCls)} style={st(k)}><InternalIdCell account={a} q={q} /></td>
      case 'originalNumber': return <td key={k} className={cn('px-4 max-w-[200px]', padCls)} style={st(k)}><ArrivalCodeCell account={a} q={q} /></td>
      case 'imported': return <td key={k} className={cn('px-4', padCls)} style={st(k)}><ImportedCell account={a} /></td>
      case 'restricted': return <td key={k} className={cn('px-4', padCls)} style={st(k)}><RestrictedCell account={a} /></td>
      case 'createdBy': return <td key={k} className={cn('px-4 max-w-[220px]', PERSON_PAD)} style={st(k)}><PersonCell name={a.createdBy} comfort={comfort} q={q} /></td>
      case 'createdAt': return <td key={k} className={cn('px-4', padCls)} style={st(k)}><StampCell at={a.createdAt} q={q} /></td>
      case 'updatedBy': return <td key={k} className={cn('px-4 max-w-[220px]', PERSON_PAD)} style={st(k)}><PersonCell name={modifiedByOf(a)} comfort={comfort} q={q} /></td>
      case 'updatedAt': return <td key={k} className={cn('px-4', padCls)} style={st(k)}><StampCell at={modifiedAtOf(a)} q={q} /></td>
      default: return null
    }
  }
  return order.map(cell)
}

// One row of the flat list. A category's root summary (e.g. "1000 ASSETS") is the
// same row with `band` set: it carries its number, its name and its own total
// like any other, and only its fill and its pinning mark it out as the head of
// the category. It used to be a single full-width colSpan cell, which is why it
// could not carry figures at all.
function AccountRow({ a, q, order, padCls, base, index, onAction, onStatusChange, onOpen, onAddChild, readOnly, rowBadge, omitOpeningBalance, frozenStyle, selectable, selectW = SELECT_W, selected, onToggleSelect, depth, trunks, band }: {
  a: Account; q: string; order: ColKey[]; padCls: string; base: string; index: ChartIndex; onAction: any; onOpen?: any; onAddChild?: (parent: Account) => void; readOnly?: boolean
  rowBadge?: (a: Account) => ReactNode
  omitOpeningBalance?: boolean
  onStatusChange?: (action: LifecycleAction, a: Account) => void
  frozenStyle?: (k: ColKey, header?: boolean) => CSSProperties | undefined
  selectable?: boolean
  /** The checkbox column's width, which widens by the Row numbers gutter. */
  selectW?: number
  selected?: boolean
  onToggleSelect?: (id: string) => void
  depth: number
  trunks?: boolean[]
  // Head-of-category treatment: the row pins beneath the column header and shows
  // the category chip next to its name with a count of what is under it.
  /* `pinned` is the Pin group headings switch, which ships off (spec §7): the
     chip, the count and the fill are what make this row the head of its
     category, and they read the same whether or not it sticks. */
  band?: { meta: (typeof ACCOUNT_TYPE_META)[AccountType]; count: number; top: number; pinned: boolean; stuck: boolean }
}) {
  // Accounts created by the signed-in user carry "(You)" in createdBy; surface a
  // "me" marker next to the row's selection checkbox. Part of Me mode, and hidden
  // with it for now (see ME_MODE).
  const isMine = ME_MODE && a.createdBy.includes('(You)')
  const numberText = useAccountNumberText()
  // A sticky cell cannot be transparent, and a frozen cell has to outrank its
  // scrolling neighbours or DOM order lets a later column paint over the pinned
  // number. At rest the band stays on the frozen tier so the insert "+" handles
  // straddling the rows above and below it still paint on top.
  const bandStyle = (k: ColKey | null): CSSProperties | undefined => {
    if (!band) return undefined
    const frozen = !!k && !!frozenStyle?.(k)
    return {
      ...(band.pinned ? { position: 'sticky' as const, top: band.top } : null),
      zIndex: band.stuck ? (frozen ? Z_STUCK_FROZEN : Z_STUCK) : (frozen ? Z_FROZEN : 1),
      // The longhand: the shorthand would reset background-image, which is the
      // channel the Row numbers gutter paints its rule and row line into.
      backgroundColor: CAT_BAND_BG,
      // The pinned-row shadow is not set here. It comes from the same `is-stuck`
      // pseudo-element rule the tree uses, so the two views pin identically; an
      // inline box-shadow also overwrote the frozen column's own edge shadow, since
      // the band style is spread over the pin style.
    }
  }
  const cellStyle = (k: ColKey): CSSProperties | undefined => {
    const pin = frozenStyle?.(k)
    const bd = bandStyle(k)
    return pin || bd ? { ...pin, ...bd, ...(pin ? { left: pin.left, width: pin.width, minWidth: pin.minWidth, maxWidth: pin.maxWidth } : {}) } : undefined
  }
  const comfort = useContext(GridComfort)
  const cells = rowCells({
    a, q, order, padCls, comfort, base, depth, index, cellStyle, trunks, verticalGuides: true, numberText, inert: !onOpen,
    openRow: onOpen ? () => onOpen(a) : undefined,
    statusMenu: onStatusChange && <StatusMenu a={a} onPick={onStatusChange} q={q} />,
    // No `openTrunk`: the list has no expand toggle reserving space under the name,
    // so a line continuing downward from this row would cross its own label.
    nameLead: band ? <CategoryCell meta={band.meta} /> : undefined,
    nameTrail: (
      <>
        {rowBadge?.(a)}
        {band && <span className="text-2xs text-fg-subtle/60 shrink-0">({band.count})</span>}
      </>
    ),
  })
  return (
    <tr
      /* The markup contract the look stylesheet reads: every one of these rows
         is an account, so every one takes a stripe, a rule and a number. */
      data-tree-account
      data-export-row={band ? 'section' : 'leaf'}
      data-export-indent={depth}
      data-row-hover={onOpen ? '' : undefined}
      data-selected={selected ? '' : undefined}
      className={cn('border-b group transition-colors duration-200 ease-out',
        band ? 'border-border' : 'border-border-subtle',
        // Marks the row for the shared pinned-row shadow. The cells' sticky
        // positioning stays inline here, because the list measures its own offset.
        band?.pinned && 'coa-cat-sticky', band?.stuck && 'is-stuck',
        selected ? 'bg-[#F8FAFF]' : 'bg-white',
        // A row with nowhere to open does not offer to: the pointer and the hover
        // tint are the whole of the promise a row makes.
        onOpen && 'cursor-pointer hover:bg-[#F0F7FF]')}
      onClick={onOpen ? () => onOpen(a) : undefined}
    >
      {selectable && (
        <td
          className={cn('pl-4 pr-1 align-middle', padCls)}
          style={{ ...leftPinStyle({ left: 0, width: selectW }), ...bandStyle('name') }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-1">
            <input type="checkbox" className="coa-check" aria-label={`Select ${a.accountName}`} checked={!!selected} onChange={() => onToggleSelect?.(a.id)} />
            {isMine && (
              <Tooltip content="You created this account." side="top"><span className="text-primary ml-0.5"><User size={12} /></span></Tooltip>
            )}
          </div>
        </td>
      )}
      {cells}
      {!readOnly && <td {...fillerProps} style={{ ...FILLER_W, ...bandStyle(null) }} />}
      {!readOnly && (
        <td data-actions-cell className={cn('px-2', padCls)} style={{ ...rightPinStyle(), ...bandStyle('status') }} onClick={e => e.stopPropagation()}>
          <Menu trigger={<button type="button" aria-haspopup="menu" aria-label={`Actions for ${a.accountName}`} className="btn-icon text-fg-subtle"><MoreHorizontal size={16} /></button>}>
            {(close) => (
              <AccountActionItems a={a} onAction={onAction} onAddChild={onAddChild} close={close} omitOpeningBalance={omitOpeningBalance} />
            )}
          </Menu>
        </td>
      )}
    </tr>
  )
}


/* ──────── A list in one cell ────────
 * One pill and a count, which is what the Partners listing does with a column
 * holding several values. This column used to draw two pills and a "+1 more",
 * so an account carrying three dimensions put three chips in a cell and the
 * row read as a paragraph. A cell in a listing answers at a glance or it is not
 * worth its width, and three chips is a list nobody asked to see inline.
 *
 * What the count hides sits behind a hover card rather than a `title`, because
 * a native tooltip cannot be styled, waits about a second, and prints one run
 * of text where the point is that these are separate values, each belonging to
 * a different dimension.
 *
 * The alpha-carrying colours below are written as literal rgba rather than as
 * Tailwind's `/50` modifiers. The palette is declared as `hsl(var(--token))`
 * with no `<alpha-value>` slot, which Tailwind cannot take a channel out of, so
 * a `border-border/50` in this file would quietly render at full strength.
 */
const TIP_ROW_H = 44
const TIP_ROWS_VISIBLE = 5
/* Long enough that dragging the pointer across a column of them opens none.
   The close delay is the width of the gap between the pill and the card. */
const TIP_OPEN_MS = 180
const TIP_CLOSE_MS = 120

const tipWidth = () => {
  if (typeof window === 'undefined') return 280
  const w = window.innerWidth
  return w < 640 ? 220 : w < 1024 ? 250 : 280
}

export function OverflowCard({ category, items, icon: RowIcon = Layers, children }: {
  category: string
  /** A row's subtitle may be omitted where the category alone says what it is. */
  items: { name: string; subtitle?: string }[]
  /** What each row is one of. Defaults to the dimension this card was built for. */
  icon?: ElementType
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState({ top: 0, left: 0, width: 280, above: false })
  const trigger = useRef<HTMLSpanElement>(null)
  const openAt = useRef<number>()
  const closeAt = useRef<number>()

  /* Placed from an estimated height rather than a measured one: the card is
     positioned on the frame it first renders, and measuring would need it on
     screen already. Both terms are known - a header, and however many rows the
     scroll cap lets through. */
  const place = useCallback(() => {
    const el = trigger.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = tipWidth()
    const h = Math.min(items.length, TIP_ROWS_VISIBLE) * TIP_ROW_H + 40
    const above = r.bottom + h + 8 > window.innerHeight && r.top - h - 8 > 0
    setBox({
      top: above ? r.top - h - 6 : r.bottom + 6,
      left: Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8)),
      width,
      above,
    })
  }, [items.length])

  /* Captured, so the card follows its pill when the table scrolls under it
     rather than the listing's own scroll container being the one thing that
     can move a trigger without the card hearing about it. */
  useEffect(() => {
    if (!open) return
    const on = () => place()
    window.addEventListener('scroll', on, true)
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('scroll', on, true); window.removeEventListener('resize', on) }
  }, [open, place])

  useEffect(() => () => {
    window.clearTimeout(openAt.current)
    window.clearTimeout(closeAt.current)
  }, [])

  const enter = () => {
    window.clearTimeout(closeAt.current)
    openAt.current = window.setTimeout(() => { place(); setOpen(true) }, TIP_OPEN_MS)
  }
  const leave = () => {
    window.clearTimeout(openAt.current)
    closeAt.current = window.setTimeout(() => setOpen(false), TIP_CLOSE_MS)
  }

  const scrolls = items.length > TIP_ROWS_VISIBLE

  return (
    <>
      <span ref={trigger} onMouseEnter={enter} onMouseLeave={leave} className="shrink-0 cursor-default">
        {children}
      </span>

      {open && createPortal(
        /* The card takes the pointer too, so crossing the gap into it does not
           close it. Above every other layer, because the listing it sits over
           has a sticky header, frozen columns and its own portalled menus. */
        <div
          onMouseEnter={() => window.clearTimeout(closeAt.current)}
          onMouseLeave={leave}
          className="fixed z-[300]"
          style={{ top: box.top, left: box.left, width: box.width, animation: 'coaOverflowTipIn 120ms ease-out forwards' }}
        >
          <div className="absolute left-1/2 -translate-x-1/2" style={box.above ? { bottom: -4 } : { top: -4 }}>
            <div
              className="w-2 h-2 rotate-45 bg-white"
              style={box.above
                ? { borderBottom: '1px solid rgba(226, 232, 240, 0.5)', borderRight: '1px solid rgba(226, 232, 240, 0.5)' }
                : { borderTop: '1px solid rgba(226, 232, 240, 0.5)', borderLeft: '1px solid rgba(226, 232, 240, 0.5)' }}
            />
          </div>

          <div
            className="bg-white rounded-lg overflow-hidden"
            style={{ border: '1px solid rgba(226, 232, 240, 0.5)', boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
              <span className="text-[11px] tracking-wide uppercase" style={{ fontWeight: 600, color: 'rgba(71, 85, 105, 0.7)' }}>{category}</span>
              <span className="text-[10px] tabular-nums" style={{ color: 'rgba(71, 85, 105, 0.5)' }}>{items.length}</span>
            </div>

            {/* Scrolls inside itself past five rows, so a chart with a dozen
                dimensions gets a card the same height as one with two. */}
            <div
              className={cn('px-1.5 pb-1.5', scrolls && 'overflow-y-auto')}
              style={scrolls ? { maxHeight: TIP_ROWS_VISIBLE * TIP_ROW_H } : undefined}
            >
              {items.map((it, i) => (
                <div key={i} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-muted" style={{ color: '#64748B' }}>
                    <RowIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[12px] truncate block text-foreground" style={{ fontWeight: 500 }}>{it.name}</span>
                    {it.subtitle && <span className="text-[10px] block truncate" style={{ color: 'rgba(71, 85, 105, 0.6)' }}>{it.subtitle}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

/* Squared off rather than the module's own fully-rounded `chip`, because this
   is the listing's overflow pill and the listing is the one surface where these
   two shapes sit side by side: a pill that is a status reads as a badge, and a
   pill that is one of several values reads as an entry in a list. */
export const OVERFLOW_PILL = 'inline-flex items-center h-[22px] rounded-md text-xs border bg-muted text-muted-foreground border-border'

export function DimensionPills({ dimensionValues, q = '' }: { dimensionValues: { dimensionId: string; value: string }[]; q?: string }) {
  const dimensions = useStore(s => s.dimensions)
  if (!dimensionValues?.length) return <span className="text-2xs text-fg-subtle">-</span>
  const held = dimensionValues.map(tv => ({
    filter: dimensions.find(t => t.id === tv.dimensionId)?.name ?? tv.dimensionId,
    value: tv.value,
  }))
  const [first, ...rest] = held
  /* The pill names its filter as well as its value. The Partners column this is
     modelled on holds one kind of thing, so its header answers "one of what";
     this column holds one value from each of the reader's own dimensions, so
     a bare "London" would not say which of them it came from. */
  const label = first.value ? `${first.filter}: ${first.value}` : first.filter
  return (
    <div className="flex items-center gap-1">
      {/* Shrinks before the count does, so a narrow column truncates the value
          rather than pushing the "+2" out of the cell. */}
      <span className={cn(OVERFLOW_PILL, 'px-2 min-w-0 max-w-[180px] truncate')} style={{ fontWeight: 500 }} title={label}>
        <Marked text={label} q={q} />
      </span>
      {rest.length > 0 && (
        <OverflowCard
          category="Dimensions"
          items={rest.map(d => ({ name: d.value || d.filter, subtitle: d.filter.toUpperCase() }))}
        >
          <span className={cn(OVERFLOW_PILL, 'px-1.5')} style={{ fontWeight: 600 }}>+{rest.length}</span>
        </OverflowCard>
      )}
    </div>
  )
}

// The read-only "preview of the chart" table: a card-framed, inert, guide-lined
// list of accounts. Shared by the create/edit placement preview and the import
// preview so the two read as one picture of the same chart, rather than one of
// them borrowing the working listing's chrome. It draws the same vertical nesting
// guides the list view draws - no toggles, so no elbows - and it takes its rows
// already ordered and measured (which accounts, at what depth, with which trunks)
// because the two callers pick very different rows - one account among its
// siblings, or a whole imported chart - and only the painting is shared.
export type PreviewColKey = 'number' | 'name' | 'glType' | 'currency' | 'status' | 'dimensions'

export interface PreviewRow {
  key: string
  /** The account the row shows. Absent for a collapsed "N more" run. */
  account?: Account
  depth: number
  trunks: boolean[]
  /** For a collapsed run: the note shown in the Name column. */
  note?: string
  /** A chip shown just after the name (New / This account / Needs bank details). */
  badge?: ReactNode
  /** Brand-tinted row for the one account in focus, e.g. the draft being placed. */
  highlight?: boolean
}

const PREVIEW_HEAD: Record<PreviewColKey, string> = {
  number: 'No.', name: 'Name', glType: 'GL Account Type',
  currency: 'Currency', status: 'Status', dimensions: 'Dimensions',
}

export function PreviewChartTable({ rows, columns, numberText }: {
  rows: PreviewRow[]
  columns: PreviewColKey[]
  numberText: (a: Account) => string
}) {
  const th = 'h-9 px-3 text-left align-middle font-normal text-muted-foreground whitespace-nowrap'
  const td = 'px-3 py-2 align-middle'
  const head = (c: PreviewColKey) => PREVIEW_HEAD[c]
  /* The air the listing leaves between an elbow and a leaf's name (its lead plus
     the flex gap). No row here has a toggle, so without it the elbow ran into the
     name. Mahad, 2026-10-01: *"a bit more spacing of the text from the lines ...
     it feels too congested."* */
  const namePad = (depth: number) => NAME_INDENT_BASE + depth * INDENT_STEP + LEAF_LEAD + 6

  /* A row with the next row nested under it carries its trunk on down, as the
     listing's open summary does from its toggle, so each branch below hangs off
     the account above it rather than starting in mid-air at its own row. */
  const opensOnto = (r: PreviewRow) => {
    const next = rows[rows.indexOf(r) + 1]
    return !!next && next.depth > r.depth
  }

  const cell = (c: PreviewColKey, r: PreviewRow) => {
    const a = r.account!
    switch (c) {
      case 'number': return r.highlight
        ? (
          <td key={c} className={cn(td, 'text-xs text-brand-700 tabular-nums whitespace-nowrap w-[130px]')} style={{ fontWeight: 600 }} title={a.accountNumber}>
            <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />
            {numberText(a) || 'Not set'}
          </td>
        ) : (
          <td key={c} className={cn(td, 'text-xs text-slate-500 tabular-nums whitespace-nowrap w-[130px]')} title={a.accountNumber}>{numberText(a)}</td>
        )
      case 'name': return (
        <td key={c} className={cn(td, 'relative w-[320px] min-w-[320px]')} style={{ paddingLeft: namePad(r.depth) }}>
          {/* The listing's curved guides, branch and all. Mahad, 2026-10-01:
              *"can we have the curved horizontal lines in the preview as well? ...
              Exactly how we have them in the COA listing table."* */}
          <TreeGuides trunks={r.trunks} openTrunk={opensOnto(r)} openFrom="calc(50% + 9px)" />
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] truncate" style={{ fontWeight: a.glAccountType === 'Summary' || r.highlight ? 600 : 500, color: r.highlight ? undefined : '#1E293B' }}>{a.accountName}</span>
            {r.badge}
          </span>
        </td>
      )
      case 'glType': return <td key={c} className={td}>{a.glAccountType ? <Badge tone={GL_TYPE_TONE[a.glAccountType] ?? 'neutral'} className={PARTNER_CHIP_CLS}>{a.glAccountType}</Badge> : <span className="text-fg-subtle">-</span>}</td>
      case 'currency': return <td key={c} className={td}>{a.glAccountType === 'Summary' ? <span className="text-fg-subtle">-</span> : <CurrencyCell code={a.currencyCode} />}</td>
      case 'status': return <td key={c} className={td}><StatusChip status={a.status} /></td>
      case 'dimensions': return <td key={c} className={td}><DimensionPills dimensionValues={a.defaultDimensionValues} /></td>
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)] text-xs">
              {columns.map(c => <th key={c} className={th}>{head(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => r.account ? (
              <tr key={r.key} className={r.highlight ? 'relative border-b border-brand-200 bg-brand-50' : 'border-b border-border-subtle'}>
                {columns.map(c => cell(c, r))}
              </tr>
            ) : (
              // Collapsed "N more" run: the note sits in the Name column, indented
              // like the rows it stands in for, and the guide runs straight through.
              <tr key={r.key} className="border-b border-border-subtle">
                <td className={td} />
                <td className={cn(td, 'relative w-[320px] min-w-[320px]')} style={{ paddingLeft: namePad(r.depth) }}>
                  {/* Straight through, no branch: this row stands in for accounts
                      rather than being one. */}
                  <TreeGuides trunks={r.trunks} vertical />
                  {/* Not decoration: this row is the only thing saying the branch
                      runs past the window, so it has to be readable. */}
                  <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>{r.note ?? ''}</span>
                </td>
                <td className={td} colSpan={Math.max(columns.length - 2, 1)} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Expansion state for an AccountTree, shared by every surface that renders one
// so they all open the chart the same way.
//
// A summary starts open, and it has to: the accounts under a summary are that
// summary's own children now, so an empty set draws the five category rows and
// nothing else, which reads as an empty chart rather than a closed one.
//
// The rule is "open each summary the first time it appears", which gets three
// behaviours from one line. A chart that arrives after mount - materialized,
// published, imported - opens in full. A summary the reader collapsed stays
// collapsed when a sibling is added next to it. And re-scoping to another
// accounting period rebuilds the same accounts into a new array, which touches
// nothing.
export function useTreeExpansion(accounts: Account[]) {
  // Seeded from the first render rather than in the effect, so a chart that is
  // already there paints open instead of flashing five rows and then opening.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(accounts.filter(a => !a.isPosting).map(a => a.id)))
  const seen = useRef<Set<string>>()
  if (!seen.current) seen.current = new Set(accounts.map(a => a.id))
  useEffect(() => {
    const known = seen.current!
    const fresh = accounts.filter(a => !a.isPosting && !known.has(a.id)).map(a => a.id)
    accounts.forEach(a => known.add(a.id))
    if (fresh.length) setExpanded(prev => new Set([...prev, ...fresh]))
  }, [accounts])
  const toggle = (id: string, on?: boolean) => setExpanded(prev => {
    const next = new Set(prev)
    const should = on ?? !next.has(id)
    if (should) next.add(id); else next.delete(id)
    return next
  })
  return { expanded, setExpanded, toggle }
}

// =========================
// Tree view
// =========================
export function AccountTree({
  accounts: accountsProp, query, density, columns, onAction, onStatusChange, onOpen, expanded, onToggle, readOnly, skeleton, collapsedGroups, onToggleGroup, onAddInGroup, rowBadge, order: orderProp, onOrderChange, colFilters: colFiltersProp, onColFiltersChange, onHideColumn, frozenCols, onToggleFreeze, bodyScroll = true, onCreateRow, onAddChild, draftMenu, onAddDimensions, canDelete, directCreate, noInlineInsert, omitOpeningBalance,
  selectable, selectedIds, onToggleSelect, onToggleAll, emptyState, reserveActionRowHeight,
  look, onColumnDrag, chart: chartProp, rememberWidthsAs,
}: {
  accounts: Account[]
  /** Keep the widths the reader dragged for when the page comes back, under this
   *  key (see useRememberedState). Left out, they last as long as the table. */
  rememberWidthsAs?: string
  /** The whole chart the rows are part of, when they are a search's or a filter's
   *  share of it - what "Create account above" and "below" number against, so a
   *  gap is measured between the real neighbours and not the ones left showing.
   *  Defaults to the store's chart, or on a draft surface to the rows given. */
  chart?: Account[]
  query: string
  density: Density
  /** How the rows are drawn, from `useTableLook`. What the stylesheet can answer
   *  arrives as `look.className`; the rest - the nesting glyphs, the column
   *  widths, the gutter, the pinned bands - the table has to honour itself. */
  look?: TableLookProps
  /** A column edge was dragged, which takes Column widths to `custom`. */
  onColumnDrag?: () => void
  /** Reserve the height the Actions kebab sets on the listing (its `btn-icon` is
   *  32px), so a table that hides the Actions column - the account detail's
   *  mirror of the listing - still rides at the same row height instead of
   *  collapsing to its tallest chip. Off by default; the listing never needs it. */
  reserveActionRowHeight?: boolean
  columns: ColumnConfig
  onAction: any
  onStatusChange?: (action: LifecycleAction, a: Account) => void
  /** Omit to make the rows inert; see the note on AccountTable's own. */
  onOpen?: (a: Account) => void
  expanded: Set<string>
  onToggle: (id: string, on?: boolean) => void
  readOnly?: boolean
  // Optional controlled column order from the Columns side panel; the tree's
  // first (name) column is pinned, the rest follow this order.
  order?: ColKey[]
  onOrderChange?: (order: ColKey[]) => void
  // Optional controlled column filters, shared with the ActiveFilters chips bar
  // so the header menus and the bar stay in sync. Internal fallback when absent.
  colFilters?: ColFilters
  onColFiltersChange?: (f: ColFilters) => void
  /** Hide from a header menu, the same switch the Columns panel flips. */
  onHideColumn?: (k: ColKey) => void
  /** Columns the reader pinned from a header menu. Number and Name are pinned by
   *  construction here (one carries the tree, the other its identifier), so these
   *  join the run just after them. `onToggleFreeze` flips one on/off. */
  frozenCols?: ColKey[]
  onToggleFreeze?: (k: ColKey) => void
  // Optional per-row trailing badge (e.g. a "+ New" chip in the Import preview),
  // rendered after the account name.
  rowBadge?: (a: Account) => JSX.Element | null
  // Optional controlled Type/classification group collapse state, so the parent's
  // Expand all / Collapse all can drive the groups. Falls back to internal
  // state when not provided (other AccountTree usages).
  collapsedGroups?: Set<string>
  onToggleGroup?: (key: string) => void
  // Optional per-category "Add account" action shown in each group header row
  // (Build-from-Scratch), prefilling the create form with that category.
  onAddInGroup?: (type: AccountType) => void
  // Skeleton mode (Build-from-Scratch Accounts step): render every Type and
  // classification header even when empty, with an "(empty)" placeholder row and a
  // live "N accounts" count, so the table reads as a structure to fill in.
  skeleton?: boolean
  // When false, the parent owns scrolling so the sticky header can pin to it.
  bodyScroll?: boolean
  // Inline "+ row" insertion (July 9 spec §1). When editable, each category
  // shows between-row insertion affordances (plus a bottom "Add row"); the draft
  // escalates to the creation modal pre-filled with the typed/derived fields
  // (and the category). Optional / no-op by default.
  onCreateRow?: (prefill: CreateRowPrefill) => void
  /* The row's child request, as in the list view: a sub-account under a summary,
     a new summary in place of a posting account. */
  onAddChild?: (parent: Account) => void
  // Draft-context kebab (Build-from-Scratch): show Edit (plus the child request
  // when onAddChild is set) instead of the deactivate/activate/archive
  // lifecycle items, which don't apply to not-yet-published draft accounts.
  // Delete is a Trash icon beside the kebab rather than an item inside it.
  draftMenu?: boolean
  /* "Add dimensions" under Edit account in the draft menu, on posting accounts:
     the setup Accounts steps open the account's Dimensions modal on its own
     (Mahad, 2026-10-08). Passed only once a dimension exists, so a build that
     skipped the Dimensions step offers nothing to link. */
  onAddDimensions?: (a: Account) => void
  // Whether a draft row can be deleted. Guided setup locks the category anchors
  // and its system accounts, so without this the Trash icon would render on a row
  // whose delete silently no-ops.
  canDelete?: (a: Account) => boolean
  // Insert "+" opens the Create GL Account modal directly instead of the inline
  // draft editor. Build-from-Scratch uses this so every insert routes through
  // the full account form.
  directCreate?: boolean
  // Drops the between-row hover "+". See AccountTable's own note: the chart
  // listing sets it, the chart-building surfaces don't.
  noInlineInsert?: boolean
  // Leaves "Enter opening balance" to the account's page. See AccountTable's
  // note; nothing else may differ between the two menus.
  omitOpeningBalance?: boolean
  // What this table calls a column, where the surrounding flow has its own word
  // for it. See the note on `HeaderCell`'s `label`.
  // Row selection, identical to the list view's: a leading checkbox column and a
  // tri-state one in the header. `onToggleAll` is handed the rows the tree is
  // actually drawing, so a collapsed branch is never selected out of sight.
  selectable?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onToggleAll?: (ids: string[], checked: boolean) => void
  /** See AccountTable's own note: the caller owns this, because the caller narrowed. */
  emptyState?: ReactNode
}) {
  const base = useStore(s => s.company.baseCurrency)
  // See AccountTable's note: period-scoped so rollups agree with their postings.
  const allAccounts = usePeriodScopedAccounts()
  // Active between-row insertion boundary within a group (spec §1): `start-<cat>`
  // = above the first row of a category, otherwise the id of the row the draft is
  // inserted AFTER. null = no draft open.
  const [insertAt, setInsertAt] = useState<string | null>(null)
  // Per-column header filters apply before grouping so the tree only builds
  // groups for matching accounts. Controlled when the parent supplies them
  // (so the chips bar can drive them), internal otherwise.
  const [internalColFilters, setInternalColFilters] = useState<ColFilters>({})
  const colFilters = colFiltersProp ?? internalColFilters
  const setColFilters = onColFiltersChange ?? setInternalColFilters
  const accounts = accountsProp.filter(a => matchesColFilters(a, colFilters, allAccounts))
  // The whole chart these rows belong to, which is what a summary's total has to
  // be taken over. In the live app the rendered rows are already in the store; in
  // the Build-from-Scratch flow the draft accounts are not published yet, so fold
  // them in or a draft summary would report the total of nothing.
  const chartAccounts = useMemo(() => {
    const ids = new Set(allAccounts.map(a => a.id))
    const extra = accountsProp.filter(a => !ids.has(a.id))
    return extra.length ? [...allAccounts, ...extra] : allAccounts
  }, [allAccounts, accountsProp])
  const index = buildChartIndex(chartAccounts)
  const amounts = useMemo(() => amountSortMap(accounts, chartAccounts), [accounts, chartAccounts])
  /* Above and below open the create form on a sibling, so they are offered where
     this tree can open that form at all. A draft surface numbers against its own
     draft chart: the store there still holds whatever chart was there before. */
  const protection = numberProtectionOn(useStore(s => s.company))
  const besideChart = chartProp ?? (draftMenu ? accountsProp : chartAccounts)
  const onCreateBeside = !readOnly && onCreateRow
    ? (a: Account, side: 'above' | 'below') => onCreateRow(besidePrefill(a, side, besideChart, protection))
    : undefined

  // null = default number ordering with NO visual sort indicator.
  const [sort, setSort] = useState<SortState | null>(null)
  const onSortDir = (k: SortKey, sortDir: 'asc' | 'desc' | null) => setSort(sortDir ? { key: k, dir: sortDir } : null)
  // Rows that should play the reveal animation. Populated when a summary account
  // or a category group is expanded, then cleared once the animation has run so
  // the same row can animate again on the next expand.
  const [revealIds, setRevealIds] = useState<Set<string>>(new Set())
  const flashReveal = (ids: string[]) => {
    if (!ids.length) return
    setRevealIds(new Set(ids))
    window.setTimeout(() => setRevealIds(new Set()), 320)
  }
  /* A search opens what it found inside.

     `accounts` arrives already narrowed, with the summaries above each match
     appended as context (`withAncestorContext`), so under a query every row that
     has children on screen is there because something beneath it matched. A
     collapsed one is therefore hiding the answer: the chart would say "1 of 140
     accounts" and draw two closed summaries with no yellow anywhere, which reads
     as a search that found nothing.

     Mahad, 2026-09-29: *"if a row is collapsed and if the search results have
     something in the row, the row should open, showcasing the yellow highlight"*.
     Eli had asked for the same on the ledger - *"if you have results that are in
     the buried structure, then open those structures ... Don't surface them and
     force the user to open, open, open."*

     Held apart from `expanded` on purpose. That set is the reader's own, and
     clearing the box has to give it back exactly as it was, so what a search
     opens lives here and what they shut again during one is an exception to it. */
  const searching = !!query.trim()
  const [searchClosed, setSearchClosed] = useState<Set<string>>(new Set())
  useEffect(() => { setSearchClosed(prev => (prev.size ? new Set() : prev)) }, [query])
  const toggleSearchClosed = (key: string) => setSearchClosed(prev => {
    const n = new Set(prev)
    n.has(key) ? n.delete(key) : n.add(key)
    return n
  })
  const isRowOpen = (id: string) => (searching || expanded.has(id)) !== searchClosed.has(id)
  // What TreeNode reads. Same set while nothing is typed, so the reader's own
  // expansion is the only thing driving the tree until a search runs.
  const openIds = useMemo(
    () => (searching ? new Set(accounts.filter(a => !searchClosed.has(a.id)).map(a => a.id)) : expanded),
    [searching, accounts, searchClosed, expanded],
  )

  // Expanding a summary eases the accounts it uncovers in rather than snapping
  // them onto the page. The walk stops at a summary the reader left collapsed,
  // because those rows do not appear and animating them would promise a row that
  // never arrives. Collapsing plays nothing: a <tr> cannot animate its own height
  // away, so the row would have to stay mounted to fade, and a lingering row
  // under a summary that already reads as closed is worse than an instant close.
  const toggleRow = (id: string) => {
    if (!isRowOpen(id)) {
      const uncovered: string[] = []
      const walk = (pid: string) => index.childrenOf(pid).forEach(c => {
        uncovered.push(c.id)
        if (isRowOpen(c.id)) walk(c.id)
      })
      walk(id)
      flashReveal(uncovered)
    }
    // While a search is running the tree's disclosure is the search's to set, so
    // a click is recorded as an exception to it rather than written into the
    // reader's own expansion - which has to come back untouched when they clear
    // the box.
    if (searching) toggleSearchClosed(id)
    else onToggle(id)
  }
  const dir = sort?.dir === 'desc' ? -1 : 1
  const byNumber = byNumberThenName
  const cmp = (a: Account, b: Account) => {
    let c = 0
    switch (sort?.key ?? 'number') {
      case 'name': c = a.accountName.localeCompare(b.accountName); break
      case 'numberRange': c = rangeSortValue(a) - rangeSortValue(b); break
      case 'type': c = ACCOUNT_TYPE_META[a.accountType].label.localeCompare(ACCOUNT_TYPE_META[b.accountType].label); break
      case 'classification': c = ALL_CLASSIFICATIONS.indexOf(a.statementClassification) - ALL_CLASSIFICATIONS.indexOf(b.statementClassification); break
      case 'glType': c = a.glAccountType.localeCompare(b.glAccountType); break
      // Unclassified accounts sort last ascending, so a role sort surfaces the
      // classified ones first.
      case 'role': c = (a.accountRole ?? '￿').localeCompare(b.accountRole ?? '￿'); break
      case 'normalBalance': c = a.normalBalance.localeCompare(b.normalBalance); break
      case 'openingBalance': c = (amounts.get(a.id)?.opening ?? 0) - (amounts.get(b.id)?.opening ?? 0); break
      case 'posting': c = Number(a.isPosting) - Number(b.isPosting); break
      case 'currency': c = a.currencyCode.localeCompare(b.currencyCode); break
      // The cell shows the balance converted into the account's own currency, so
      // the sort has to convert too - comparing the USD figures ordered the
      // column by numbers it was not displaying.
      case 'fxBalance': c = currentOwnBalanceOf(a) - currentOwnBalanceOf(b); break
      case 'runningBalance': c = (amounts.get(a.id)?.running ?? 0) - (amounts.get(b.id)?.running ?? 0); break
      case 'status': c = a.status.localeCompare(b.status); break
      case 'description': c = (a.description ?? '').localeCompare(b.description ?? ''); break
      case 'effectiveDate': c = a.effectiveDate.localeCompare(b.effectiveDate); break
      case 'internalId': c = internalIdSeq(a.internalId) - internalIdSeq(b.internalId); break
      // By the values the cell shows; an account carrying none sorts last ascending.
      case 'dimensions': c = (dimensionSortText(a) || '￿').localeCompare(dimensionSortText(b) || '￿'); break
      case 'originalNumber': c = (arrivalCodeText(a) || '￿').localeCompare(arrivalCodeText(b) || '￿'); break
      case 'imported': c = Number(!!a.arrivedByImport) - Number(!!b.arrivedByImport); break
      case 'restricted': c = Number(!!a.restricted) - Number(!!b.restricted); break
      case 'createdBy': c = personText(a.createdBy).localeCompare(personText(b.createdBy)); break
      case 'createdAt': c = a.createdAt.localeCompare(b.createdAt); break
      case 'updatedBy': c = personText(modifiedByOf(a)).localeCompare(personText(modifiedByOf(b))); break
      case 'updatedAt': c = modifiedAtOf(a).localeCompare(modifiedAtOf(b)); break
      default: c = byNumber(a, b)
    }
    return (c !== 0 ? c : byNumber(a, b)) * dir
  }

  // Collapsible Type / classification group state (default expanded). Keyed by the Type
  // code and by `${type}:${section}`.
  const [internalCollapsed, setInternalCollapsed] = useState<Set<string>>(new Set())
  const collapsed = collapsedGroups ?? internalCollapsed
  const toggleGroup = onToggleGroup ?? ((key: string) => setInternalCollapsed(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n }))

  // Tight condensed rows (py-0.5) / comfort py-3. Every tree row type (Type,
  // classification, Sub-type, leaf) shares this, so all rows are the same height.
  const padCls = density === 'condensed' ? 'py-0.5' : 'py-3'
  // Visible non-name columns, in panel order. The name column is pinned first
  // (it carries the tree structure), every other column follows the Columns
  // side panel's visibility + order so toggles there apply to this view too.
  const [internalOrder, setInternalOrder] = useState<ColKey[]>(DEFAULT_COLUMN_ORDER)
  const colOrderFull = orderProp ?? internalOrder
  const setColOrder = (next: ColKey[]) => (onOrderChange ?? setInternalOrder)(next)
  // Number leads as a pinned flat column; Name is the indented hierarchy
  // column. Both are pulled out of the draggable key list so they hold their
  // positions, while everything else (colKeys) stays reorderable.
  const showNumber = !!(columns as any).number
  const scrollingKeys = colOrderFull.filter(k => k !== 'name' && k !== 'number' && (columns as any)[k]) as ColKey[]
  // A column the reader froze leads the rest, right behind the Number/Name pair
  // that is pinned here by construction. Leaving it in place would pin a cell in
  // the middle of the run and let the columns before it slide underneath.
  const frozenKeys = scrollingKeys.filter(k => (frozenCols ?? []).includes(k))
  const colKeys = [...frozenKeys, ...scrollingKeys.filter(k => !frozenKeys.includes(k))]
  const colCount = (showNumber ? 1 : 0) + 1 + colKeys.length + (readOnly ? 0 : 1)

  // Header drag-to-reorder + drag-to-resize, mirroring the flat list view.
  const treeOrderRef = useRef(colOrderFull)
  treeOrderRef.current = colOrderFull
  const treeDrag = useColumnDragReorder({
    order: colOrderFull,
    setOrder: next => setColOrder((typeof next === 'function' ? next(treeOrderRef.current) : next) as ColKey[]),
    onHide: onHideColumn ? k => onHideColumn(k as ColKey) : undefined,
    canHide: k => !isLockedCol(k as ColKey),
  })
  const dragKey = treeDrag.draggingKey as ColKey | null
  const makeDnd = (key: ColKey): DnDProps => dragProps(key, treeDrag)
  const sizing = look?.columnSizing ?? 'default'
  const engineSized = sizing === 'fit' || sizing === 'equal'
  const { widths, onResizeStart } = useColumnWidths(sizing, onColumnDrag, rememberWidthsAs)
  // The gutter comes out of the first cell's left border, so whichever column
  // leads has to hold that much more width. Which one leads depends on what the
  // table is showing, so the extra is added where it lands rather than baked
  // into any one constant.
  const gutter = look?.rowNumbers ? rowNumberGutter(accounts.length) : 0
  const selW = selectable ? SELECT_W + gutter : 0
  const nameW = (widths.name ?? FROZEN_W.name) + (!selectable && !showNumber ? gutter : 0)
  const numberW = (widths.number ?? numberColWidth(chartAccounts)) + (!selectable && showNumber ? gutter : 0)

  // Measure the column-header height so the sticky category rows can pin flush
  // beneath it (the header pins at top:0, categories at top:headerH). Re-measures
  // on density change / resize so both condensed and comfort stay aligned.
  const theadRef = useRef<HTMLTableSectionElement>(null)
  const [catTop, setCatTop] = useState(28)
  useLayoutEffect(() => {
    const el = theadRef.current
    if (!el) return
    // Floor (not round/ceil) so the category row pins flush under - or a
    // sub-pixel *behind* - the sticky header. A fractional or rounded-up value
    // leaves a <1px seam the header can't cover, letting body rows bleed through.
    const measure = () => setCatTop(Math.floor(el.getBoundingClientRect().height))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [density])

  // Every category's root summary pins at the same `catTop` and they stack one
  // atop another as you scroll. Each draws its own drop shadow, so letting every
  // pinned one stay "stuck" sums the shadows into an ever-darkening band. Track
  // the single frontmost pinned category instead - the group whose <tbody>
  // straddles the pin line - and let only that one carry the shadow.
  const tableRef = useRef<HTMLTableElement>(null)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  useEffect(() => {
    const findScrollParent = (node: HTMLElement | null): HTMLElement | null => {
      let el = node?.parentElement ?? null
      while (el) {
        const oy = getComputedStyle(el).overflowY
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return el
        el = el.parentElement
      }
      return null
    }
    const update = () => {
      const table = tableRef.current
      if (!table) return
      const sp = findScrollParent(table)
      const pinY = (sp ? sp.getBoundingClientRect().top : 0) + catTop
      const scrolled = (sp ? sp.scrollTop : window.scrollY) > 0
      if (!scrolled) { setActiveCat(null); return }
      let active: string | null = null
      table.querySelectorAll(':scope > tbody[data-cat]').forEach(tb => {
        const r = tb.getBoundingClientRect()
        if (r.top <= pinY + 1 && r.bottom > pinY + 1) active = tb.getAttribute('data-cat')
      })
      setActiveCat(active)
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update) }
  }, [catTop])

  // Group the tree by account category (Assets, Liabilities, Equity, Revenue,
  // Expenses). Each category is one <tbody>, headed by its own root summary.
  const byNum = (sort?.key ?? 'number') === 'number' && !skeleton
  type CatGroup = { key: AccountType; accts: Account[]; count: number }
  let groups = TYPE_ORDER_TREE
    .map(cat => {
      const list = accounts.filter(a => a.accountType === cat)
      if (list.length === 0 && !skeleton) return null
      return { key: cat, accts: [...list].sort(cmp), count: list.length }
    })
    .filter(Boolean) as CatGroup[]
  // Order the category groups by the canonical accounting sequence
  // (Asset → Liability → Equity → Revenue → Expense), matching the list view's
  // numeric order. Descending number sort still reverses the group order.
  if (byNum) {
    const orderIdx = (k: AccountType) => TYPE_ORDER_TREE.indexOf(k)
    groups = [...groups].sort((a, b) => (orderIdx(a.key) - orderIdx(b.key)) * dir)
  }

  const selLeft = selW
  // Where a frozen column pins, and how wide it holds itself. A pinned cell is out
  // of the table's own width negotiation, so each one needs a width of its own -
  // and the next one's offset is the sum of the widths before it. The edge shadow
  // belongs to the last of the run, which is Name until the reader freezes
  // something past it.
  const frozenW = (k: ColKey) => widths[k] ?? FROZEN_W[k] ?? FROZEN_FALLBACK_W[k] ?? 160
  const nameEdge = frozenKeys.length === 0
  const frozenPin = (k: ColKey) => {
    // Fit and Equal hand the widths to the layout engine, and a frozen offset is
    // a sum of widths, so the whole run stands down with them (spec §8).
    if (engineSized) return undefined
    const idx = frozenKeys.indexOf(k)
    if (idx === -1) return undefined
    const left = selLeft + (showNumber ? numberW : 0) + nameW
      + frozenKeys.slice(0, idx).reduce((s, c) => s + frozenW(c), 0)
    return { left, width: frozenW(k), edge: idx === frozenKeys.length - 1 }
  }
  const treeColSpan = (selectable ? 1 : 0) + (showNumber ? 1 : 0) + 1 + colKeys.length + (readOnly ? 0 : 2)
  // Left indent for the between-row insertion affordance, so the "+" sits under
  // the Name column at the level the row it creates will sit at, past the
  // leading Number column when shown.
  const insIndentAt = (level: number) =>
    selLeft + (showNumber ? numberW : 0) + NAME_INDENT_BASE + level * INDENT_STEP
  const canInsert = !readOnly && !skeleton && !onAddInGroup && !noInlineInsert

  // How each category renders: which rows are roots, which one heads the group,
  // and whether the whole thing is closed down to that head. Derived once here
  // rather than inside the row loop, because the header checkbox has to select
  // exactly the rows the loop goes on to draw.
  const shaped = groups.map(g => {
    // Nesting comes from parentId. Anything whose parent is not in the group -
    // filtered out, or genuinely top-level - reads as a root, so a filtered view
    // still shows every match at the level it can be seen.
    const idsInGroup = new Set(g.accts.map(x => x.id))
    const childMap = new Map<string, Account[]>()
    g.accts.forEach(x => {
      if (x.parentId && idsInGroup.has(x.parentId)) {
        const kids = childMap.get(x.parentId)
        if (kids) kids.push(x)
        else childMap.set(x.parentId, [x])
      }
    })
    const rootAccts = g.accts.filter(a => !a.parentId || !idsInGroup.has(a.parentId))
    // The category's own root summary (e.g. "1000 ASSETS") heads the group: it
    // pins on scroll, carries the count, and its toggle collapses the whole
    // category. Undefined when a filter has hidden it, and then the group reads
    // without a head rather than promoting some other row.
    const anchorId = rootAccts.find(a => a.glAccountType === 'Summary')?.id
    // A closed category hides matches exactly as a closed summary does, so a
    // search opens it on the same terms.
    const tCollapsed = searching ? searchClosed.has(g.key) : collapsed.has(g.key)
    return { g, childMap, rootAccts, anchorId, tCollapsed, collapseToAnchor: !!(anchorId && tCollapsed) }
  })
  // Every row on screen, in reading order. A collapsed category contributes only
  // its head and a collapsed summary contributes only itself, so selecting all
  // can never reach an account the reader cannot see.
  const visibleIds: string[] = []
  // Where a between-row insertion affordance goes, keyed by the row it sits
  // above: the two neighbours it straddles (which fix the suggested number and
  // the parent the new account lands under) and its indent. Read off the same
  // reading-order walk, because the gaps a reader can hover are the gaps between
  // the rows actually on screen - a collapsed subtree offers none inside it.
  // A category's first row gets no entry, so no affordance straddles two
  // categories.
  const insertBefore = new Map<string, { prev: Account; next: Account; indent: number }>()
  for (const s of shaped) {
    if (s.tCollapsed && !s.collapseToAnchor) continue
    const rows: { a: Account; depth: number }[] = []
    // Same rule TreeNode draws by: the category head follows the group state, every
    // other row its own. The two have to agree or the select-all checkbox and the
    // insertion points would describe rows that aren't on screen.
    const isOpen = (a: Account) => (a.id === s.anchorId ? !s.tCollapsed : isRowOpen(a.id))
    const walk = (a: Account, depth: number) => {
      rows.push({ a, depth })
      if (isOpen(a)) (s.childMap.get(a.id) ?? []).forEach(c => walk(c, depth + 1))
    }
    s.rootAccts.forEach(root => {
      if (s.collapseToAnchor) { if (root.id === s.anchorId) rows.push({ a: root, depth: 0 }) }
      else walk(root, 0)
    })
    for (const r of rows) visibleIds.push(r.a.id)
    if (!canInsert || s.collapseToAnchor) continue
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1], next = rows[i]
      // The new account lands under `prev` when `prev` is a summary and beside it
      // otherwise, so the "+" reads at the level of the row it will create.
      const level = prev.a.glAccountType === 'Summary' ? prev.depth + 1 : prev.depth
      insertBefore.set(next.a.id, { prev: prev.a, next: next.a, indent: insIndentAt(level) })
    }
  }
  // Handed to TreeNode as one callback rather than seven props: the recursion
  // only needs to know "is there an insert above this row", not how to build one.
  const renderInsert = canInsert
    ? (id: string) => {
        const at = insertBefore.get(id)
        if (!at) return null
        return (
          <InsertRow
            colSpan={treeColSpan} indent={at.indent}
            active={insertAt === id} onActivate={() => setInsertAt(id)} onCancel={() => setInsertAt(null)}
            prev={at.prev} next={at.next} category={at.prev.accountType}
            allAccounts={allAccounts} density={density} onCreateRow={onCreateRow} directCreate={directCreate}
          />
        )
      }
    : undefined
  const allSelected = selectable && visibleIds.length > 0 && visibleIds.every(id => selectedIds?.has(id))
  const anySelected = selectable && visibleIds.some(id => selectedIds?.has(id))

  return (
    <div className={cn(bodyScroll && 'overflow-auto scrollbar-thin')}>
      <DragGhost ghostRef={treeDrag.ghostRef} label={dragKey ? HEADER_DEFS[dragKey].label : null} hiding={treeDrag.hiding} caps={false} />
      <GridComfort.Provider value={density === 'comfortable'}>
      <table
        ref={tableRef}
        /* Default and custom leave the widths where they were. Fit lets the
           table grow to its content and spills the spare width to the right;
           Equal splits the frame between the columns that are showing. */
        className={cn('text-sm coa-frozen-first border-separate border-spacing-0',
          sizing === 'fit' ? 'w-max min-w-full' : 'w-full', look?.className)}
        style={{
          ['--coa-cat-top' as string]: `${catTop}px`,
          ...(gutter ? { ['--fr-rownum-w' as string]: `${gutter}px` } : null),
          tableLayout: sizing === 'equal' ? 'fixed' : 'auto',
        } as CSSProperties}
      >
        <thead ref={theadRef}>
          {/* Header row - opaque muted/30 fill so the sticky header doesn't show
              rows scrolling under it. */}
          <tr data-grid-head-row className={cn('border-b border-border bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)] text-muted-foreground text-xs', density === 'condensed' && '[&>th]:!h-7')}>
            {selectable && (
              <th style={{ position: 'sticky', left: 0, zIndex: Z_HEAD_FROZEN, backgroundColor: 'inherit', width: selW, minWidth: selW, maxWidth: selW }} className="align-middle pl-4 pr-1">
                <div className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    className="coa-check"
                    checked={!!allSelected}
                    ref={el => { if (el) el.indeterminate = !!anySelected && !allSelected }}
                    onChange={e => onToggleAll?.(visibleIds, e.target.checked)}
                  />
                </div>
              </th>
            )}
            {/* Both pinned columns resize. Number's width is also Name's `left`, so
                a drag has to feed the whole pin geometry rather than the one header -
                which is what `numberW` is, and why it is read here and in every cell
                below. */}
            {showNumber && (
              <HeaderCell colKey="number" sort={sort} onSortDir={onSortDir}
                width={engineSized ? undefined : numberW} onResizeStart={onResizeStart?.('number')}
                stickyStyle={engineSized ? undefined : leftPinStyle({ left: selLeft, width: numberW, header: true })}
                filter={colFilters.number ?? blankFilter('number')}
                onFilterChange={(f) => setColFilters({ ...colFilters, number: f })}
                uniqueValues={[]} />
            )}
            <HeaderCell colKey="name" sort={sort} onSortDir={onSortDir}
              width={engineSized ? undefined : nameW} onResizeStart={onResizeStart?.('name')}
              stickyStyle={engineSized ? undefined : leftPinStyle({ left: selLeft + (showNumber ? numberW : 0), width: nameW, edge: nameEdge, header: true })}
              filter={colFilters.name ?? blankFilter('name')}
              onFilterChange={(f) => setColFilters({ ...colFilters, name: f })}
              uniqueValues={[]} />
            {colKeys.map(k => {
              const pin = frozenPin(k)
              const lockedCol = isLockedCol(k)
              return (
              <HeaderCell key={k} colKey={k} sort={sort} onSortDir={onSortDir}
                dnd={makeDnd(k)}
                dragging={dragKey === k} hiding={dragKey === k && treeDrag.hiding}
                width={pin ? pin.width : widths[k]} onResizeStart={onResizeStart?.(k)}
                stickyStyle={pin && leftPinStyle({ ...pin, header: true })}
                onHide={!lockedCol && onHideColumn ? () => onHideColumn(k) : undefined}
                onToggleFreeze={!lockedCol && onToggleFreeze ? () => onToggleFreeze(k) : undefined}
                frozen={!!pin}
                filter={colFilters[k] ?? blankFilter(k)}
                onFilterChange={(f) => setColFilters({ ...colFilters, [k]: f })}
                uniqueValues={uniqueColValues(k, accountsProp)} />
              )
            })}
            {!readOnly && <th {...fillerProps} style={sizing === 'equal' ? EQUAL_FILLER_W : FILLER_W} />}
            {!readOnly && <Th data-actions-cell className="text-right !px-2" style={{ ...rightPinStyle({ header: true }), width: sizing === 'equal' ? (draftMenu ? ACTIONS_EQUAL_W_DRAFT : ACTIONS_EQUAL_W) : ACTIONS_HEAD_W }}>Actions</Th>}
          </tr>
        </thead>
        {emptyState && shaped.length === 0 ? (
          <tbody>
            <tr><td colSpan={treeColSpan}>{emptyState}</td></tr>
          </tbody>
        ) : shaped.map(({ g, childMap: groupChildMap, rootAccts, anchorId, tCollapsed, collapseToAnchor }) => {
            const meta = ACCOUNT_TYPE_META[g.key]
            return (
              <tbody key={g.key} data-cat={g.key}>
                {(!tCollapsed || collapseToAnchor) && rootAccts.map((root: Account) => {
                  // Collapsed, the head is the only row left: it carries the
                  // category's total, which is what the reader kept it for.
                  if (collapseToAnchor && root.id !== anchorId) return null
                  const isAnchor = root.id === anchorId
                  return (
                    <TreeNode key={root.id} a={root} depth={0} trunks={[]} numberW={numberW} nameW={nameW} nameEdge={nameEdge} frozenPin={frozenPin} childMap={groupChildMap} q={query} colKeys={colKeys} showNumber={showNumber} padCls={padCls} base={base} index={index} onOpen={onOpen} onAction={onAction} onStatusChange={onStatusChange} expanded={openIds} onToggle={toggleRow} readOnly={readOnly} rowBadge={rowBadge} omitOpeningBalance={omitOpeningBalance} onAddChild={onAddChild} onCreateBeside={onCreateBeside} draftMenu={draftMenu} onAddDimensions={onAddDimensions} canDelete={canDelete} animate={revealIds.has(root.id)} revealIds={revealIds} selectable={selectable} selectW={selW} selectedIds={selectedIds} onToggleSelect={onToggleSelect} renderInsert={renderInsert} reserveActionRowHeight={reserveActionRowHeight} treeStyle={look?.treeStyle} unpinned={engineSized} anchorCount={isAnchor ? g.count : undefined} sticky={isAnchor} pinned={!!look?.pinGroups} stuck={!!look?.pinGroups && isAnchor && activeCat === g.key} onToggleAnchor={isAnchor ? () => { if (tCollapsed) flashReveal(g.accts.map(a => a.id)); if (searching) toggleSearchClosed(g.key); else toggleGroup(g.key) } : undefined} anchorCollapsed={isAnchor ? tCollapsed : undefined} />
                  )
                })}
                {!tCollapsed && onAddInGroup && (
                  <tr className="border-b border-border-subtle bg-white hover:bg-[#F0F7FF] transition-colors">
                    {selectable && <td className={cn('px-4', padCls)} style={engineSized ? undefined : leftPinStyle({ left: 0, width: selW })} />}
                    {showNumber && <td className={cn('px-4', padCls)} style={engineSized ? undefined : leftPinStyle({ left: selLeft, width: numberW })} />}
                    <td className={cn('px-4', padCls)} style={{ ...(engineSized ? null : leftPinStyle({ left: selLeft + (showNumber ? numberW : 0), width: nameW, edge: true })), paddingLeft: NAME_INDENT_BASE + INDENT_STEP }}>
                      <button
                        type="button"
                        onClick={() => onAddInGroup(g.key)}
                        className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg hover:underline whitespace-nowrap"
                        style={{ fontWeight: 500 }}
                      >
                        <Plus size={13} /> Add {meta.label.toLowerCase()} account
                      </button>
                    </td>
                    <td colSpan={colKeys.length + (readOnly ? 0 : 2)} />
                  </tr>
                )}
                {/* Explicit "Add account" row only while the category holds nothing
                    but its own head; once it has accounts, users hover between rows
                    to insert - no persistent add row sitting between categories.
                    Never on the chart listing, which is for reading a chart that
                    already exists. Nor under a search, which shows its results and
                    nothing else (Mahad, 2026-10-02). */}
                {!tCollapsed && !readOnly && !skeleton && !onAddInGroup && !noInlineInsert && !query.trim() && g.accts.length <= 1 && (
                  <AddRowControl colSpan={treeColSpan} density={density} onCreateRow={onCreateRow} accountType={g.key} indent={NAME_INDENT_BASE + INDENT_STEP} directCreate={directCreate} />
                )}
              </tbody>
            )
          })}
      </table>
      </GridComfort.Provider>
    </div>
  )
}

function TreeNode({ a, depth, trunks, numberW, nameW, nameEdge = true, frozenPin, childMap, q, colKeys, showNumber, padCls, base, index, onOpen, onAction, onStatusChange, expanded, onToggle, readOnly, rowBadge, omitOpeningBalance, onAddChild, onCreateBeside, draftMenu, onAddDimensions, canDelete, animate, revealIds, anchorCount, sticky, pinned, stuck, onToggleAnchor, anchorCollapsed, selectable, selectW = SELECT_W, selectedIds, onToggleSelect, renderInsert, reserveActionRowHeight, treeStyle, unpinned }: {
  a: Account
  omitOpeningBalance?: boolean
  /** Reserve the Actions kebab's row height on a table that hides it, so it rides
   *  at the listing's height instead of collapsing to its tallest chip. */
  reserveActionRowHeight?: boolean
  /** Level within the rendered rows, not within the whole chart: the category's
   *  own root sits at 0, so a filtered view still reads at the level it shows. */
  depth: number
  /** One entry per ancestor level, so `trunks.length === depth`; see TreeGuides. */
  trunks: boolean[]
  /** Resolved widths of the pinned columns, so a dragged width reaches the body
   *  cells and not just the header. */
  numberW: number
  nameW: number
  /** False once the reader has frozen a column past Name, so the pinned run's
   *  edge shadow moves to whichever column now ends it. */
  nameEdge?: boolean
  /** Where a reader-frozen column pins and how wide it holds itself; see
   *  AccountTree's own. Undefined for a column that scrolls. */
  frozenPin?: (k: ColKey) => { left: number; width: number; edge: boolean } | undefined
  childMap: Map<string, Account[]>
  q: string
  colKeys: ColKey[]
  showNumber?: boolean
  padCls: string
  base: string
  index: ChartIndex
  onOpen?: (a: Account) => void
  onAction: any
  onStatusChange?: (action: LifecycleAction, a: Account) => void
  expanded: Set<string>
  onToggle: (id: string) => void
  readOnly?: boolean
  rowBadge?: (a: Account) => ReactNode
  onAddChild?: (parent: Account) => void
  onCreateBeside?: (a: Account, side: 'above' | 'below') => void
  draftMenu?: boolean
  onAddDimensions?: (a: Account) => void
  canDelete?: (a: Account) => boolean
  animate?: boolean
  revealIds?: Set<string>
  /** Set on the row heading its category: it shows the category chip and a count
   *  of everything beneath it, and its toggle collapses the whole category. */
  anchorCount?: number
  sticky?: boolean
  /** Pin group headings, which ships off (spec §7). A head still wears the chip,
   *  the count and the band fill when it is off; it simply scrolls away. */
  pinned?: boolean
  stuck?: boolean
  onToggleAnchor?: () => void
  anchorCollapsed?: boolean
  /** Tree lines draws the disc toggle and the guide lines; Arrows draws a bare
   *  chevron and no lines at all (spec §7). */
  treeStyle?: TreeStyle
  /** Fit and Equal hand the widths to the layout engine, so every frozen offset
   *  computed from those widths stands down with them (spec §8). */
  unpinned?: boolean
  selectable?: boolean
  /** The checkbox column's width, which widens by the Row numbers gutter. */
  selectW?: number
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  /** The hover-to-insert affordance sitting above this row, if there is one.
   *  Passed as a callback so the recursion carries one prop rather than the
   *  neighbours, indent and draft state each insertion point needs. */
  renderInsert?: (id: string) => ReactNode
}) {
  const children = childMap.get(a.id) ?? []
  const numberText = useAccountNumberText()
  const selected = !!selectedIds?.has(a.id)
  const selLeft = selectable ? selectW : 0
  const arrows = treeStyle === 'arrows'
  // A collapsed category hides everything under its head, whatever the reader's
  // per-account expansion says, and restores that expansion when reopened. The
  // two used to be independent because the head was a synthesized row and the
  // accounts under it were rendered flat, so hiding the category meant filtering
  // the row list; it is now this row's own subtree.
  //
  // The head keeps no expansion of its own: its toggle drives the group state, so
  // that is what its subtree has to read. Collapse all empties `expanded`, and
  // reading it here left a reopened head showing an open chevron over nothing.
  const isExp = anchorCollapsed !== undefined ? !anchorCollapsed : expanded.has(a.id)
  const structural = isStructuralRow(a)
  // A stuck category head lifts its whole row above the rows scrolling past it
  // (CSS `.is-stuck td`), so its pinned cells must clear that same tier or the
  // middle columns would paint over them.
  const fz = sticky && stuck ? Z_STUCK_FROZEN : Z_FROZEN
  // A pinned cell cannot be transparent, and the CSS paints sticky cells white;
  // restate the band fill inline so the head keeps it once pinned.
  const fbg = sticky ? CAT_BAND_BG : 'inherit'
  const cellStyle = (k: ColKey): CSSProperties | undefined => {
    // The longhand throughout: `background` would reset background-image, which
    // is where the Row numbers gutter draws its rule and its row line.
    if (unpinned) return sticky ? { backgroundColor: fbg } : undefined
    if (k === 'number') return leftPinStyle({ left: selLeft, width: numberW, z: fz, background: fbg })
    if (k === 'name') return leftPinStyle({ left: selLeft + (showNumber ? numberW : 0), width: nameW, edge: nameEdge, z: fz, background: fbg })
    const pin = frozenPin?.(k)
    if (pin) return leftPinStyle({ ...pin, z: fz, background: fbg })
    return sticky ? { backgroundColor: fbg } : undefined
  }
  const comfort = useContext(GridComfort)
  const cells = rowCells({
    a, q, order: [...(showNumber ? ['number' as ColKey] : []), 'name', ...colKeys], padCls, comfort, base, depth, index, cellStyle,
    trunks: arrows ? undefined : trunks, numberText, inert: !onOpen, bodyMinH: reserveActionRowHeight,
    openRow: onOpen ? () => onOpen(a) : undefined,
    statusMenu: onStatusChange && <StatusMenu a={a} onPick={onStatusChange} q={q} />,
    // The trunk out of an expanded row is drawn on the parent, not the child, so
    // it starts under the toggle it belongs to instead of at the child row's top.
    openTrunk: !arrows && children.length > 0 && isExp,
    nameLead: (
      <>
        {onToggleAnchor ? (
          // The category head's toggle collapses the ENTIRE category down to this
          // one row, unified with the Collapse-all group state.
          <ExpandToggle arrows={arrows} expanded={!anchorCollapsed} onClick={(e) => { e.stopPropagation(); onToggleAnchor() }} />
        ) : children.length > 0 ? (
          <ExpandToggle arrows={arrows} expanded={isExp} onClick={(e) => { e.stopPropagation(); onToggle(a.id) }} />
        ) : <span className="shrink-0" style={{ width: LEAF_LEAD }} />}
        {sticky && <CategoryCell meta={ACCOUNT_TYPE_META[a.accountType]} />}
      </>
    ),
    nameTrail: (
      <>
        {anchorCount != null && <span className="text-2xs text-fg-subtle/60 shrink-0">({anchorCount})</span>}
        {rowBadge?.(a)}
        {children.length > 0 && (
          <span className="inline-flex items-center gap-1 text-2xs text-primary ml-1.5 shrink-0" style={{ fontWeight: 600 }} title={`${children.length} sub-account${children.length === 1 ? '' : 's'}`}><GitBranch size={12} />{children.length}</span>
        )}
      </>
    ),
  })
  return (
    <>
      {renderInsert?.(a.id)}
      <tr
        /* The markup contract the look stylesheet reads: a Summary heading its
           category is still an account with a number of its own, so it takes a
           row number like any other (spec §8). */
        data-tree-account
        data-export-row={sticky ? 'section' : 'leaf'}
        data-export-indent={depth}
        data-row-hover={onOpen ? '' : undefined}
        data-selected={selected ? '' : undefined}
        className={cn('border-b group transition-colors duration-200 ease-out',
          selected ? 'bg-[#F8FAFF]' : 'bg-white',
          // A category head closes on the full border in both views; every other
          // row on the subtle one. `sticky` is set on exactly the category roots.
          sticky ? 'border-border' : 'border-border-subtle',
          animate && 'coa-row-reveal', sticky && pinned && 'coa-cat-sticky', sticky && stuck && 'is-stuck',
          // See AccountRow: a row that opens nothing must not look as though it
          // does. The expand toggle keeps its own click, so a preview still opens
          // and closes its branches.
          onOpen && 'cursor-pointer hover:bg-[#F0F7FF]')}
        onClick={onOpen ? () => onOpen(a) : undefined}
      >
        {selectable && (
          <td
            className={cn('pl-4 pr-1 align-middle', padCls)}
            style={unpinned ? { backgroundColor: fbg } : leftPinStyle({ left: 0, width: selectW, z: fz, background: fbg })}
            onClick={e => e.stopPropagation()}
          >
            {/* The list carries the "you created this" marker in this same cell,
                so the tree does too rather than losing it on a layout switch.
                Part of Me mode, and hidden with it for now (see ME_MODE). */}
            <div className="flex items-center gap-1">
              <input type="checkbox" className="coa-check" aria-label={`Select ${a.accountName}`} checked={selected} onChange={() => onToggleSelect?.(a.id)} />
              {ME_MODE && a.createdBy.includes('(You)') && (
                <Tooltip content="You created this account." side="top"><span className="text-primary ml-0.5"><User size={12} /></span></Tooltip>
              )}
            </div>
          </td>
        )}
        {cells}
        {!readOnly && <td {...fillerProps} style={{ ...FILLER_W, ...(sticky ? { backgroundColor: fbg } : null) }} />}
        {!readOnly && (
          <td data-actions-cell className={cn('px-2 text-right', padCls)} style={rightPinStyle({ z: fz, background: fbg })} onClick={e => e.stopPropagation()}>
            {/* Summaries get the same menu as postings: they are editable accounts,
                and list view has always offered it on every row, so gating tree
                view on isPosting made the two views of the one listing disagree.
                Draft surfaces are unchanged - a wizard's category anchors still
                only offer Create GL account, so they stay undeletable. */}
            {(!structural || !draftMenu) ? (
              <span className="inline-flex items-center gap-0.5">
              {/* On a draft surface, Delete sits on the row instead of inside the
                  kebab: a chart is built by adding and removing rows, so removal
                  is a primary action here in a way it never is on the published
                  listing, where the equivalent is Archive. */}
              {draftMenu && (canDelete ? canDelete(a) : true) && (
                <Tooltip content="Delete account" side="top" align="right">
                  <button
                    aria-label={`Delete ${a.accountName}`}
                    className="btn-icon text-fg-subtle hover:text-danger-700"
                    onClick={() => onAction('delete', a)}
                  ><Trash2 size={14} /></button>
                </Tooltip>
              )}
              <Menu trigger={<button type="button" aria-haspopup="menu" aria-label={`Actions for ${a.accountName}`} className="btn-icon text-fg-subtle"><MoreHorizontal size={14} /></button>}>
                {(close) => (
                  draftMenu ? (
                    <>
                      <MenuItem icon={<Pencil size={14} />} onClick={() => { close(); onAction('edit', a) }}>Edit account</MenuItem>
                      {/* A summary carries no dimensions of its own, so it is not offered one. */}
                      {onAddDimensions && a.glAccountType === 'Posting' && (
                        <MenuItem icon={<ListFilter size={14} />} onClick={() => { close(); onAddDimensions(a) }}>Add dimensions</MenuItem>
                      )}
                      {onAddChild && <AddChildMenuItem a={a} onAddChild={onAddChild} close={close} />}
                      {onCreateBeside && <BesideMenuItems a={a} parent={index.parentOf(a.id)} onCreateBeside={onCreateBeside} close={close} />}
                    </>
                  ) : (
                    <AccountActionItems a={a} onAction={onAction} onAddChild={onAddChild} onCreateBeside={onCreateBeside} parent={index.parentOf(a.id)} close={close} omitOpeningBalance={omitOpeningBalance} />
                  )
                )}
              </Menu>
              </span>
            ) : onAddChild ? (
              <Menu trigger={<button type="button" aria-haspopup="menu" aria-label={`Actions for ${a.accountName}`} className="btn-icon text-fg-subtle"><MoreHorizontal size={14} /></button>}>
                {(close) => (
                  <AddChildMenuItem a={a} onAddChild={onAddChild} close={close} />
                )}
              </Menu>
            ) : <span className="inline-block size-8 align-middle" />}
          </td>
        )}
      </tr>
      {isExp && children.map((c: Account, i: number) => (
        // The trunk at this new level carries on past the child only while the
        // child has siblings after it, which is what closes the branch with an
        // elbow on the last one instead of running the line off the bottom.
        <TreeNode key={c.id} a={c} depth={depth + 1} trunks={[...trunks, i < children.length - 1]} numberW={numberW} nameW={nameW} nameEdge={nameEdge} frozenPin={frozenPin} childMap={childMap} q={q} colKeys={colKeys} showNumber={showNumber} padCls={padCls} base={base} index={index} onOpen={onOpen} onAction={onAction} onStatusChange={onStatusChange} expanded={expanded} onToggle={onToggle} readOnly={readOnly} rowBadge={rowBadge} omitOpeningBalance={omitOpeningBalance} onAddChild={onAddChild} onCreateBeside={onCreateBeside} draftMenu={draftMenu} onAddDimensions={onAddDimensions} canDelete={canDelete} animate={animate || (revealIds ? revealIds.has(c.id) : false)} revealIds={revealIds} selectable={selectable} selectW={selectW} selectedIds={selectedIds} onToggleSelect={onToggleSelect} renderInsert={renderInsert} reserveActionRowHeight={reserveActionRowHeight} treeStyle={treeStyle} unpinned={unpinned} />
      ))}
    </>
  )
}
