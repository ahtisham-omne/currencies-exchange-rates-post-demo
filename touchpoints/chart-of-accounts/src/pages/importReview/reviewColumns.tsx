import {
  ACCOUNT_TYPE_META, CATEGORY_ORDER, ALL_ACCOUNT_ROLES, ROLES_BY_CATEGORY,
  ALL_CLASSIFICATIONS, CLASSIFICATIONS_BY_CATEGORY,
} from '../../types'
import type { ParsedRow } from '../../lib/uploadValidation'

// The review grid's columns, in one table. Key, label, width, editor and sort
// accessor all live here, so a column is added once rather than in a header row,
// a body row and a sort switch.

/* Every column the file carries, named as it is on ParsedRow. `type` is the
   category, which the file calls "GL Account Category". */
export type ReviewField =
  | 'number' | 'name' | 'type' | 'classification' | 'glType' | 'parent'
  | 'normalBalance' | 'contra' | 'role'
  | 'currency' | 'status' | 'description'

/* A column the file did not carry: one dimension read out of the account
   numbers. Prefixed rather than keyed on the bare name so a dimension the
   customer calls Status cannot shadow the file's own Status column. */
export type DimensionKey = `dim:${string}`
export const dimensionKey = (name: string): DimensionKey => `dim:${name}`
export const isDimensionKey = (key: string): key is DimensionKey => key.startsWith('dim:')

/** Everything the grid can draw a column for: the file's own fields, then the dimensions. */
export type ColumnKey = ReviewField | DimensionKey

export type ReviewStatus = 'ready' | 'warning' | 'error'

/** What the Result column's verdict chip prints. Held here, beside the columns,
 *  because the search reads it as well as the chip. */
export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = { ready: 'Ready', warning: 'Warning', error: 'Error' }
/** The Result column's other two chips, as they print. */
export const NEEDS_DETAILS_LABEL = 'Needs details'
export const mergedChipText = (from: string[]) => `stated ${from.length} times`

/* A parsed row with everything the grid needs to draw it: the verdict, which
   cells earned it, and the sentence explaining it. */
export interface ReviewRowView extends ParsedRow {
  /* One entry per dimension the customer defined, flattened onto the row because
     that is the only shape the grid reads cells in. */
  [key: DimensionKey]: string | undefined
  /* Named apart from `status`, which is the file's own Active / Inactive column.
     Sharing the name had the verdict overwrite it in every row. */
  verdict: ReviewStatus
  flagged: Set<ColumnKey>
  message: string
  /* A bank or credit card account, which holds an issuer and an account number
     no import template carries. It imports and is listed as unfinished, which is
     neither an error nor a warning. */
  needsDetails: boolean
  excluded: boolean
  /* Every code this summary was stated as, when the file stated it more than
     once. Only a summary can have this: a posting row is its own account however
     many rows share its number. Empty on a row stated once. */
  mergedFrom?: string[]
}

/* How a cell is edited. `text` is free entry, `enum` a fixed list, `parent` an
   autocomplete over the accounts a row could actually sit under. */
export type EditorKind = 'text' | 'enum' | 'parent'

export interface ReviewColumn {
  key: ColumnKey
  label: string
  defaultWidth: number
  editor: EditorKind
  /** The values an enum column offers, exactly as validation expects them. */
  options?: string[]
  mono?: boolean
  /** What this column means, shown in the header tooltip. */
  description: string
  /* Shown but not typed into. A dimension value is read off the account number
     and the name the customer gave that code, so editing one cell would leave
     the number saying 40 and the column saying Marketing. */
  readOnly?: boolean
  /* An optional column the engine answers when the file leaves it blank. The
     cell shows what the account will be created with, so a blank in the file
     does not read as a blank on the account - and, since that value was nobody's
     edit, it wears no edited corner. */
  filledIn?: boolean
}

const CATEGORY_LABELS = CATEGORY_ORDER.map(c => ACCOUNT_TYPE_META[c].label)

export const REVIEW_COLUMNS: ReviewColumn[] = [
  { key: 'number', label: 'GL account no.', defaultWidth: 140, editor: 'text', mono: true, description: 'The account number, taken exactly as you type it. It only has to be one no other row uses.' },
  { key: 'name', label: 'GL account name', defaultWidth: 220, editor: 'text', description: 'What the account is called on reports.' },
  { key: 'type', label: 'GL account category', defaultWidth: 160, editor: 'enum', options: CATEGORY_LABELS, description: 'Asset, Liability, Equity, Revenue or Expense.' },
  { key: 'classification', label: 'Statement classification', defaultWidth: 180, editor: 'enum', options: [...ALL_CLASSIFICATIONS], filledIn: true, description: 'Which line of the statement the account prints on, one step narrower than its category. Left blank in your file, it is worked out from the role, the parent summary, or the category, and shown here as it will be created.' },
  { key: 'glType', label: 'GL account type', defaultWidth: 140, editor: 'enum', options: ['Summary', 'Posting'], description: 'Posting accounts take entries. Summary accounts total the accounts under them.' },
  { key: 'parent', label: 'Parent account no.', defaultWidth: 150, editor: 'parent', mono: true, description: 'The summary account this one sits under. Left blank, one is inferred from the number.' },
  { key: 'normalBalance', label: 'Normal balance', defaultWidth: 140, editor: 'enum', options: ['Debit', 'Credit'], description: 'The side the account normally carries. Opposite its category means a contra account.' },
  { key: 'contra', label: 'Contra', defaultWidth: 100, editor: 'enum', options: ['Yes', 'No'], description: 'A contra account reduces the accounts it sits with rather than adding to them.' },
  { key: 'role', label: 'Account role', defaultWidth: 170, editor: 'enum', options: [...ALL_ACCOUNT_ROLES], description: 'What the account is for. A role a subledger owns cannot be posted to by hand.' },
  { key: 'currency', label: 'Currency', defaultWidth: 110, editor: 'text', mono: true, description: 'Blank means the base currency.' },
  { key: 'status', label: 'Status', defaultWidth: 110, editor: 'enum', options: ['Active', 'Inactive'], description: 'An inactive account is created but cannot be posted to.' },
  { key: 'description', label: 'Description', defaultWidth: 240, editor: 'text', description: 'Optional note carried onto the account.' },
]

export const REVIEW_COLUMN_BY_KEY: Record<ReviewField, ReviewColumn> =
  Object.fromEntries(REVIEW_COLUMNS.map(c => [c.key, c])) as Record<ReviewField, ReviewColumn>

/* What a column offers on one particular row. Two columns narrow, and for the
   same reason: a role and a classification each live in exactly one category, so
   offering all seventeen roles or all thirteen classifications let the dropdown
   hand back a value that fails the row it was opened to fix. Both fall back to
   the whole list while the category is blank or unreadable, which is the only
   state where nothing better can be said. */
export function optionsFor(column: ReviewColumn, row: { type?: string }): string[] | undefined {
  if (column.key !== 'role' && column.key !== 'classification') return column.options
  const category = CATEGORY_ORDER.find(c => ACCOUNT_TYPE_META[c].label.toLowerCase() === (row.type ?? '').trim().toLowerCase())
  if (!category) return column.options
  return column.key === 'role' ? [...ROLES_BY_CATEGORY[category]] : [...CLASSIFICATIONS_BY_CATEGORY[category]]
}

/* The columns the file did not carry. What the customer answered on the mapper
   step is a claim about every row, and this is the only screen that shows the
   claim applied: 01-71100-40 said Department 40, and here is the row that came
   out of it. Without them the review is a review of half the import. */
export function dimensionColumns(names: string[]): ReviewColumn[] {
  return names.map(name => ({
    key: dimensionKey(name),
    label: name,
    defaultWidth: 160,
    editor: 'text',
    readOnly: true,
    description: `Read out of the account number. Blank means that number carried no ${name.toLowerCase()}, which stores nothing.`,
  }))
}

export const REVIEW_COLUMN_ORDER: ColumnKey[] = REVIEW_COLUMNS.map(c => c.key)

export const DEFAULT_COLUMN_WIDTHS: Record<string, number> =
  Object.fromEntries(REVIEW_COLUMNS.map(c => [c.key, c.defaultWidth]))

// Frozen column geometry. The row number, the checkbox and the verdict stay put
// while the data columns scroll, so a row stays identifiable.
export const ROW_NUM_WIDTH = 36
export const SELECT_COL_WIDTH = 40
/* Wide enough for the verdict plus one more chip beside it, which is the widest
   this cell ever gets: a restated summary carries its count next to the
   verdict. */
export const STATUS_COL_WIDTH = 186
export const ACTIONS_COL_WIDTH = 40
export const FROZEN_LEFT_WIDTH = ROW_NUM_WIDTH + SELECT_COL_WIDTH + STATUS_COL_WIDTH

// The narrowest and widest a column may be dragged. The maximum is seven times
// the 255 characters Excel allows in a cell, past which a column is scenery.
export const MIN_COL_WIDTH = 80
export const MAX_COL_WIDTH = 255 * 7

export const ROW_HEIGHT_COMFORT = 52
export const ROW_HEIGHT_CONDENSED = 36

/* What a frozen cell is filled with. A stuck cell keeps its place while the rest
   of the table slides beneath it, and the cells passing underneath paint on a
   lower layer of the same stacking context - so any alpha at all in a frozen
   fill lets their text through it. That is what made the Result column read
   "Result GL account no." mid-scroll.
 *
 * These are therefore the row and header tints already mixed down onto the
 * page's white rather than laid over it with an alpha channel. Same contract the
 * General Ledger's pinned columns keep through `--gl-row-bg` in index.css.
 *
 * Scrolling cells have nothing behind them but the page, so they keep their
 * Tailwind tints; both maps are keyed off one resolved tone so the two readings
 * of a row cannot drift apart. */
export type RowTone = 'active' | 'hover' | 'selected' | 'zebra' | 'plain'

export const ROW_BG_CLASS: Record<RowTone, string> = {
  active: 'bg-primary/[0.06]',
  hover: 'bg-bg-subtle',
  selected: 'bg-primary/[0.04]',
  zebra: 'bg-bg-subtle/50',
  plain: 'bg-white',
}

export const ROW_BG_OPAQUE: Record<RowTone, string> = {
  active: 'color-mix(in srgb, hsl(var(--primary)) 6%, #fff)',
  hover: 'hsl(var(--muted))',
  selected: 'color-mix(in srgb, hsl(var(--primary)) 4%, #fff)',
  zebra: 'color-mix(in srgb, hsl(var(--muted)) 50%, #fff)',
  plain: '#fff',
}

// The header is stuck to the top as well as, for the frozen columns, to the
// left, so it is opaque in both directions or rows smear under it as they pass.
export type HeaderTone = 'dragging' | 'sorted' | 'hover' | 'plain'

export const HEADER_BG_OPAQUE: Record<HeaderTone, string> = {
  dragging: 'color-mix(in srgb, hsl(var(--primary)) 5%, #fff)',
  sorted: 'color-mix(in srgb, hsl(var(--primary)) 6%, #fff)',
  hover: 'hsl(var(--muted))',
  plain: 'color-mix(in srgb, hsl(var(--muted)) 70%, #fff)',
}
