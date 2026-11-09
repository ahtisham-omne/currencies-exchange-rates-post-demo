import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Check, Info, ChevronDown, AlertTriangle, Maximize2, Minimize2, ChevronRight, ArrowLeft, Layers, Search, Wallet, CreditCard, Landmark, TrendingUp, TrendingDown, Handshake, Zap, Unlink, PiggyBank, Lock, ListFilter, Plus, PencilLine, X } from 'lucide-react'
import { FormModal, ConfirmModal, Button, Input, Select, Banner, Badge, Tooltip, Toggle, AmountInput, EmptyState } from '../components/ui'
import { ConnectBankModal } from '../components/ConnectBankModal'
import { BankInstitutionCombobox } from '../components/BankInstitutionCombobox'
import { BankLogo } from '../components/BankLogo'
import { BANK_INSTITUTIONS } from '../lib/bankInstitutions'
import { SetUpAsPartnerModal, PartnerInlineForm, LinkedExistingPartnerCard } from '../components/SetUpAsPartnerModal'
import { emptyPartnerDraft, findMatchingPartner, type PartnerDraft } from '../lib/partners'
import { useStore, lifecycleCtx, buildAccount, deriveNormalBalance, deriveContra, validateAccountAgainst, defaultClassificationForCategory } from '../store'
import { actionToward, planLifecycle } from '../lib/accountLifecycle'
import type { ConfirmSpec, LifecycleAction } from '../lib/accountLifecycle'
import { LifecycleConfirm } from './AccountActions'
import { Account, ACCOUNT_TYPE_META, categoryFirstNumber, AccountType, AccountCategory, StatementClassification, CLASSIFICATIONS_BY_CATEGORY, CLASSIFICATION_DESCRIPTIONS, CLASSIFICATIONS_FOR_ROLE, isCategoryRoot, NumberingScheme, Dimension, GLAccountType, SELECTABLE_GL_ACCOUNT_TYPES, AccountStatus, AccountRole, ACCOUNT_ROLE_DESCRIPTIONS, normalBalanceForRole, rolesForClassification, roleNamedByClassification, roleIsReconcilable, roleHoldsOwnCurrency, CURRENCY_LOCKED_REASON, displayAccountNumber, numberProtectionOn } from '../types'
import { cn, currencySymbol } from '../lib/utils'
import { DimensionValuePicker } from '../components/DimensionValuePicker'
import { missingDefaults, normaliseDefaults, type DimensionPair } from '../lib/dimensionDefaults'
import { CURRENCIES } from '../lib/currencies'
import { buildChartIndex, eligibleParents } from '../lib/chartTree'
import { placementPreview, DRAFT_ID } from '../lib/placementPreview'
import { jumpToError } from '../lib/formErrors'
import { accountRange, checkPlacement, formatRange, numberLengthWarning, problemText, offerBlocks, parseRangeInputs, suggestPostingNumber, type BlockOffer } from '../lib/numberRange'
import { NumberRangeCard, RangeMessage } from '../components/NumberRangeCard'
import { RoleFieldTooltip } from '../lib/accountRoleCopy'
import { GL_TYPE_DESCRIPTION, GLTypeLegend } from '../lib/glAccountTypeCopy'
import { NormalBalanceHelp } from '../lib/normalBalanceCopy'
import { StatusChip, GL_TYPE_TONE, PARTNER_CHIP_CLS, PreviewChartTable, type PreviewRow, RESTRICTED_HELP } from '../components/AccountTable'
import { NotifyRecipientsPicker, describePicked, type PickerCopy } from '../components/NotifyRecipientsPicker'
import { ACCESS_IS_CUSTOM, ACCESS_IS_DEFAULT, ACCOUNT_OWNER_ACCESS, DEFAULT_RESTRICTED_ACCESS, RESTRICTED_EXPLAINER, sameAccess } from '../lib/restrictedAccess'
import { DimensionFormModal, EMPTY_DRAFT, type DimensionDraft } from '../components/DimensionsEditor'
import { CurrencyFlag } from '../components/CurrencyFlag'

// ── Section 2, item 11: four creation-modal layout VARIANTS behind a flag, so
// the four candidate designs can be compared without a rebuild.
//   1 = stepped wizard (the existing polished flow - default)
//   2 = single-scroll spec form (number → name → description → the four posting
//       questions → currency → status, with a context panel below)
//   3 = two-pane (spec form on the left, live context panel pinned on the right)
//   4 = compact, context/preview strip on top, spec form beneath
// Variants 2–4 all render the same spec-ordered `flatForm`; only the wrapper
// layout differs, so all four compile and render. Override per call with the
// `variant` prop, or globally with this module constant.
export type CreateModalVariant = 1 | 2 | 3 | 4
export const CREATE_MODAL_VARIANT: CreateModalVariant = 1

// Stepped-wizard steps. 'banking' is only present for bank/card posting
// accounts, and 'dimensions' only once the tenant has defined at least one;
// the ordered list is derived from both per render.
type WizardStep = 'classification' | 'details' | 'banking' | 'dimensions' | 'preview'
export const STEP_LABEL: Record<WizardStep, string> = {
  classification: 'Classification',
  /* The tab is named for the step, not for the section inside it. "GL account
     details" is the card the step opens with, and printing it twice - once on
     the tab and once over the fields - read as two headings for one thing.
     Mahad, 2026-09-22: *"rename the first step simply to 'Details'."* */
  details: 'Details',
  banking: 'Bank details',
  dimensions: 'Dimensions',
  /* An edit ends on what saving will change rather than on where the account
     lands: it already sits where it sits, and the reader is about to commit a
     diff, not a placement. See `previewStep`. */
  preview: 'Preview',
}
export const EDIT_PREVIEW_STEP_LABEL = 'Review changes'

/* The banking step asks two different sets of questions, so it is named for the
   one it is about to ask. A card issuer, a limit and a card number under a tab
   reading "Bank details" reads as the wrong step rather than as a step about
   cards. */
export const CARD_BANKING_STEP_LABEL = 'Credit card details'

// Card-based picker for the "Bank account type" field. Each option carries an
// icon, a one-line description, and the ledger category it maps to. Asset
// subtypes surface for bank accounts; the credit-card subtype for liabilities.
type BankTypeOption = {
  value: string
  title: string
  desc: string
  icon: typeof Wallet
  classifications: StatementClassification[]
}
/* The kinds of bank account this control offers. Every one is an asset - the
   field only appears under the Bank role, which itself only exists under Asset -
   so the options carry no category badge. A credit card is not listed here: it
   has its own role (Liability → Credit Card) and its own field set.

   Which of them can be offered is decided by the statement classification, and
   only the certificate of deposit spans: cash a business can spend this year is
   current by definition, but a deposit locked for a fixed term maturing beyond
   the year is not. That is the whole reason Bank is one of the three roles that
   does not settle its own classification. */
const BANK_TYPE_OPTIONS: BankTypeOption[] = [
  { value: 'Checking', title: 'Checking', desc: 'Everyday operating cash for payroll, bills, and spending.', icon: Wallet, classifications: ['Current asset'] },
  { value: 'Savings', title: 'Savings', desc: 'Interest-bearing cash held in reserve.', icon: PiggyBank, classifications: ['Current asset'] },
  { value: 'Money Market', title: 'Money market', desc: 'Higher-yield savings with check-writing access.', icon: TrendingUp, classifications: ['Current asset'] },
  { value: 'Certificate of Deposit', title: 'Certificate of deposit', desc: 'Cash locked for a fixed term and rate.', icon: Lock, classifications: ['Current asset', 'Non-current asset'] },
]

// The bank account types on offer for a classification, and the line that says
// why the list is as short as it is when only one thing is left on it.
export function bankTypesFor(classification: StatementClassification): BankTypeOption[] {
  return BANK_TYPE_OPTIONS.filter(o => o.classifications.includes(classification))
}

/* The spend ceiling on a card, in the account's own currency. Money goes
   through `AmountInput` like every other amount in the app, so this only adds
   the label and error chrome that `Input` would otherwise carry. Optional: a
   limit is renegotiated over the life of a card, and refusing to create the
   account until someone looks it up would be asking for a guess. */
function CreditLimitField({ value, onChange, currency, error }: {
  value: string
  onChange: (next: string) => void
  currency: string
  error?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="label">Credit limit</label>
      <AmountInput
        value={value}
        onChange={onChange}
        symbol={currencySymbol(currency)}
        placeholder="e.g. 25,000"
        className={cn('input', error && 'border-danger-500 ring-4 ring-danger-100 focus:border-danger-500 focus:ring-4 focus:ring-danger-100')}
      />
      {error ? <p data-field-error className="text-xs text-danger-600">{error}</p> : <p className="text-2xs text-fg-subtle">The agreed ceiling on this card, in {currency}.</p>}
    </div>
  )
}

function BankAccountTypeCards({ value, onChange, error, classification }: {
  value: string
  onChange: (value: string) => void
  error?: string
  classification: StatementClassification
}) {
  const options = bankTypesFor(classification)
  const selected = options.find(o => o.value === value)
  /* What the reader needs told about the term, and only where it changes an
     answer. On a current asset it is the escape hatch for a long deposit; on a
     non-current one it says why the list has one entry. */
  const termNote = classification === 'Non-current asset'
    ? 'A certificate of deposit is the only cash account that can be non-current, and only while its term runs beyond a year.'
    : selected?.value === 'Certificate of Deposit'
      ? 'If the term ends more than a year from now, set the statement classification to non-current asset.'
      : null
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null)

  const place = () => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    const estimated = Math.min(320, options.length * 68 + 12)
    const below = r.bottom + estimated <= window.innerHeight || r.top < estimated
    setBox(below
      ? { left: r.left, width: r.width, top: r.bottom + 4 }
      : { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4 })
  }
  useLayoutEffect(() => { if (open) place() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || popRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onScroll = (e: Event) => {
      if (popRef.current && e.target instanceof Node && popRef.current.contains(e.target)) return
      place()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-1.5">
      <label className="label block">Bank account type<span className="text-danger-600"> *</span></label>
      <button
        type="button"
        ref={triggerRef}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={cn('input pr-9 relative flex items-center gap-2 text-left cursor-pointer',
          error && 'border-danger-500 ring-4 ring-danger-100 focus:border-danger-500 focus:ring-4 focus:ring-danger-100')}
      >
        {selected ? (
          <>
            <span className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <selected.icon size={14} />
            </span>
            <span className="flex-1 min-w-0 truncate text-fg">{selected.title}</span>
          </>
        ) : (
          <span className="flex-1 text-fg-subtle">Select account type</span>
        )}
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle/60 pointer-events-none" />
      </button>
      {error && <p data-field-error className="text-xs text-danger-600">{error}</p>}
      {!error && termNote && <p className="text-2xs text-fg-subtle">{termNote}</p>}

      {open && box && createPortal(
        <div
          ref={popRef}
          role="listbox"
          className="fixed z-[80] bg-white border border-border rounded-lg shadow-lg p-1.5 max-h-[320px] overflow-auto scrollbar-thin"
          style={{ left: box.left, width: box.width, top: box.top, bottom: box.bottom }}
        >
          {options.map(o => {
            const active = value === o.value
            const Icon = o.icon
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={cn('w-full flex items-start gap-2.5 py-2 px-2 rounded-md text-left transition-colors',
                  active ? 'bg-primary/[0.06]' : 'hover:bg-bg-subtle')}
              >
                <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', active ? 'bg-primary/10 text-primary' : 'bg-bg-subtle text-fg-muted')}>
                  <Icon size={16} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className={cn('block text-[13px] truncate', active ? 'text-primary font-semibold' : 'text-fg font-medium')}>{o.title}</span>
                  <span className="block text-2xs text-fg-muted mt-0.5 leading-snug">{o.desc}</span>
                </span>
                {active && <Check size={15} className="text-primary shrink-0 mt-1" />}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}

// Per-type descriptions shown together in the GL account type field's (i)
// tooltip, so the user can compare the roles while choosing.
const GL_TYPE_TOOLTIP = <GLTypeLegend />

/* What a field is, said once and read by both the live control and its locked
   twin. Written out at each use before, which is how the same sentence came to
   stand beside a field on one screen and not on another. */
const CLASSIFICATION_INFO = 'Which line of the statement this account prints on. It also narrows the account roles on offer.'

/* A settled field answers two different questions, and they belong to two
   different icons.

   Mahad, 2026-09-24: *"Why does the edit flow show different UX copy in the
   tooltips? They should be the same as in the creation flow."* Because the (i)
   beside the label was being overwritten with the reason for the lock, so the
   same icon on the same field explained Summary versus Posting on a create and
   said "an account cannot be changed from one to the other" on an edit. It now
   carries the field's own explanation in both, and where the create offers none
   it offers none here either.

   The padlock takes the reason. It is the icon the lock put there, so it is the
   one that owes an answer for it. */
export function LockedField({ label, info, infoRich, why, children }: {
  label: string
  info?: ReactNode
  infoRich?: boolean
  why: ReactNode
  children: ReactNode
}) {
  return (
    <>
      <label className="label flex items-center gap-1 mb-1.5">
        {label}
        {info && (
          <Tooltip rich={infoRich} content={info} side="top" align={infoRich ? 'left' : 'center'}>
            <span className="inline-flex cursor-help text-fg-subtle/60 hover:text-fg-subtle"><Info size={12} /></span>
          </Tooltip>
        )}
      </label>
      <div className="input flex items-center justify-between gap-2 bg-bg-subtle/60 text-fg-muted cursor-default select-none">
        {children}
        <Tooltip content={why} side="top" align="right">
          <span className="inline-flex shrink-0 cursor-help text-fg-subtle/60 hover:text-fg-subtle"><Lock size={13} /></span>
        </Tooltip>
      </div>
    </>
  )
}

// Icon + colour for the Account Category cards, keyed off the category code /
// ACCOUNT_TYPE_META.color (matches the Category chip in the listing table).
const CATEGORY_ICON: Record<string, typeof Wallet> = {
  AST: Wallet, LIA: CreditCard, EQT: Landmark, REV: TrendingUp, EXP: TrendingDown,
}
// Per-category accent tuple for the classification cards - the icon tile and the
// statement chip share one tint so each card reads as a unit. Mirrors the accent
// shape Cash Management's account-type cards use.
type CategoryAccent = {
  chipBg: string; chipText: string; chipBorder: string
  tileBg: string; tileBgIdle: string; iconColor: string
}
const CATEGORY_ACCENT: Record<AccountCategory, CategoryAccent> = {
  AST: { chipBg: '#F5F3FF', chipText: '#6D28D9', chipBorder: '#DDD6FE', tileBg: '#EDE9FE', tileBgIdle: '#F5F3FF', iconColor: '#7C3AED' },
  LIA: { chipBg: '#FFFBEB', chipText: '#B45309', chipBorder: '#FDE68A', tileBg: '#FEF3C7', tileBgIdle: '#FFFBEB', iconColor: '#B45309' },
  EQT: { chipBg: '#F0F9FF', chipText: '#0369A1', chipBorder: '#BAE6FD', tileBg: '#E0F2FE', tileBgIdle: '#F0F9FF', iconColor: '#0284C7' },
  REV: { chipBg: '#ECFDF5', chipText: '#047857', chipBorder: '#A7F3D0', tileBg: '#D1FAE5', tileBgIdle: '#ECFDF5', iconColor: '#059669' },
  EXP: { chipBg: '#FFF1F2', chipText: '#BE123C', chipBorder: '#FECDD3', tileBg: '#FFE4E6', tileBgIdle: '#FFF1F2', iconColor: '#E11D48' },
}

// The one reconcilable role each category offers, i.e. what the "Set as bank
// account" checkbox switches on. Null for categories that have neither.
function reconcilableRoleFor(category: AccountCategory): AccountRole | null {
  if (category === 'AST') return 'Bank'
  if (category === 'LIA') return 'Credit Card'
  return null
}

// Classification card - the Cash Management account-type card, retargeted at the
// GAAP category. Elevation tiers (idle / hover / selected), the top-right
// selection dot, the tinted icon tile, and the footer chip all match, so the two
// flows read as the same product.
/* One grid for both rows of cards on the classification step, so a classification
   card is exactly as wide as the category card above it and lines up with its
   left and right edges. Shared rather than repeated because the gap is part of
   the geometry: auto-fill decides how many columns fit from the gap as well as
   the minimum, so two grids with the same minimum and gaps two pixels apart land
   on different column widths and the two rows stop agreeing. */
// A posting account reserves nothing, so there is nothing to offer it.
const NO_OFFER: BlockOffer = { parentRange: null, blockSize: null, inParent: [], recommended: null, outside: [] }

const CHOICE_GRID_GAP = 'gap-2.5'
const CHOICE_GRID_COLUMNS = 'repeat(auto-fill, minmax(240px, 1fr))'

/* Both questions on the classification step are pick-one-of-a-few, so they have
   to read as the same kind of control. The shell and the tick live here rather
   than in each card, because the last time they were written out twice they
   drifted: one grew a check circle and a shadow and the other kept a bare tint,
   and the second question stopped looking selectable at all. */
function choiceShell(selected: boolean, locked?: boolean) {
  return cn(
    'group relative text-left rounded-lg border transition-all duration-150',
    selected
      ? 'border-primary bg-[#F5F9FF] shadow-[0_0_0_1px_rgba(10,119,255,0.15),0_1px_3px_rgba(10,119,255,0.06)]'
      : 'border-border bg-white',
    locked
      ? 'opacity-60 cursor-not-allowed'
      : !selected && 'cursor-pointer hover:border-slate-300 hover:bg-[#FAFCFF] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]',
  )
}

/* `sm` is the subordinate size, for the second question narrowing the first.

   Both states set a display, and the empty one has to: a bare inline span drops
   its width and height and collapses to a grey vertical sliver, its own two side
   borders touching. A `<button>` can hold no `<div>`, so this cannot go back to
   the block element it was before it was shared. */
function ChoiceTick({ selected, locked, sm }: { selected: boolean; locked?: boolean; sm?: boolean }) {
  const box = cn(sm ? 'w-4 h-4' : 'w-5 h-5', 'inline-flex items-center justify-center shrink-0 rounded-full')
  if (selected) {
    return (
      <span className={cn(box, 'bg-primary')}>
        <Check className={sm ? 'w-2.5 h-2.5' : 'w-3 h-3'} strokeWidth={3} style={{ color: '#FFFFFF' }} />
      </span>
    )
  }
  return (
    <span className={cn(box, 'border-[1.5px] border-slate-300 bg-white transition-colors',
      !locked && 'group-hover:border-[#93C5FD]')} />
  )
}

function CategoryCard({ category, selected, locked, onSelect }: {
  category: AccountCategory
  selected: boolean
  locked?: boolean
  onSelect: () => void
}) {
  const m = ACCOUNT_TYPE_META[category]
  const accent = CATEGORY_ACCENT[category]
  const Icon = CATEGORY_ICON[m.code] ?? Wallet
  return (
    <button
      type="button"
      disabled={locked}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(choiceShell(selected, locked), 'flex flex-col h-full p-2.5 sm:p-3')}
    >
      <div className="absolute top-2.5 right-2.5 z-10">
        <ChoiceTick selected={selected} locked={locked} />
      </div>

      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center mb-1.5 transition-colors"
        style={{ backgroundColor: selected ? accent.tileBg : accent.tileBgIdle }}
      >
        <Icon className="w-4 h-4" style={{ color: accent.iconColor }} />
      </div>

      <p className="text-[13px] text-fg pr-8 break-words" style={{ fontWeight: selected ? 600 : 500 }}>
        {m.label}
      </p>
      <p className="text-[11px] text-[#94A3B8] mt-0.5 line-clamp-2 pr-2 break-words min-h-[30px]">
        {m.notes}
      </p>

      <div className="mt-auto pt-1.5">
        <span
          className="inline-flex items-center px-1.5 py-px rounded-md border text-[10px]"
          style={{ fontWeight: 600, backgroundColor: accent.chipBg, color: accent.chipText, borderColor: accent.chipBorder }}
        >
          {m.statement}
        </span>
      </div>
    </button>
  )
}

interface FormState {
  // Spec Step 1 "Account Category" - the GAAP bucket (AST/LIA/EQT/REV/EXP).
  accountType: AccountCategory
  // The account's recognized identity for other modules (Accounts Receivable,
  // Bank, Inventory, …). '' = unclassified, which is a valid resting state.
  // Scoped to the category, and offered for Posting accounts only. Picking Bank
  // or Credit Card is what reveals the Bank-details block - there is no separate
  // "is a bank account" flag.
  accountRole: AccountRole | ''
  // Structural role: Posting (a leaf that holds transactions) or Summary (a
  // parent whose figure is the total of what hangs beneath it).
  // '' = not yet chosen (required before continuing).
  glAccountType: GLAccountType | ''
  // Normal balance - an editable Debit/Credit field, prefilled from the account
  // category (AST/EXP → Debit; LIA/EQT/REV → Credit) and freely changeable.
  // Contra status is derived from this, never entered directly.
  normalBalance: Account['normalBalance']
  statementClassification: StatementClassification
  accountNumber: string
  accountName: string
  // DEPRECATED (Section 2, item 2): the Subcategory / sub-type is no longer part
  // of the create flow - creation now branches on `glAccountType` instead. This
  // field is retained only so existing callers and edit-mode seeding keep
  // compiling; nothing in the UI writes to it and it is never surfaced as a
  // picker. Do not reintroduce a Subcategory selector here.
  subType: string
  // Spec Step 2 "Bank details" - name · account title · number · account type.
  bankAccountType: string
  // Spend ceiling, asked instead of Bank account type when the role is Credit Card.
  creditLimit: string
  bankName: string
  // Institution id when the bank was picked from the shared catalogue; '' for a
  // free-typed name. Carries the selection forward into the connect-feed flow.
  selectedInstitutionId: string
  bankAccountTitle: string
  // Nickname / routing are no longer asked for in this flow. They are still
  // carried through so editing an account that has them doesn't wipe them.
  bankNickname: string
  bankRouting: string
  bankAccountNumber: string
  subsidiaryId: string
  currencyCode: string
  effectiveDate: string
  // Only people allowed to view restricted accounts see it (decision of 2026-10-06).
  restricted: boolean
  // Who it is open to, while restricted: roles and people from the Notify picker.
  restrictedAccess: string[]
  description: string
  // Spec Step 2 "Status" - Active / Inactive (defaults to Active).
  status: AccountStatus
  // Default dimension values that auto-apply to every posting on this account. Each
  // entry is a dimension and the value to stamp; the value is editable per posting.
  defaultDimensionValues: { dimensionId: string; value: string }[]
  // The Summary this account hangs under. Structure is declared, not inferred
  // from numbers, so this is what actually places the account on the chart.
  // Seeded from defaults / parentAccount; picked in-form otherwise.
  parentId?: string | null
  /* The block of numbers this Summary reserves, if any. Held as strings while
     the form is open, because a half-typed range is not yet a range and forcing
     the field through a number would blank the reader's typing on every keystroke.
     Parsed and validated on save; unused on Posting accounts. */
  numberRangeStart: string
  numberRangeEnd: string
}

// Accounts created before Account role existed carry bank details but no role.
// Read the role back off those details so editing one still opens the banking
// block instead of appearing to have lost its bank setup.
function inferRoleFromBankDetails(a: Account): AccountRole | '' {
  if (a.glAccountType !== 'Posting') return ''
  if (!(a.bankName || a.bankAccountNumber || a.bankAccountType)) return ''
  if (a.accountType === 'LIA') return 'Credit Card'
  return a.accountType === 'AST' ? 'Bank' : ''
}

/* Move the form to a statement classification. A role can be stranded by the
   move - Accounts Receivable is not offered under non-current assets - so a role
   that no longer belongs is dropped, and the normal balance it was holding is
   released back to the category's own side.

   Where the line and the role are the same words, choosing the line has already
   answered the role, so it arrives filled in instead of asked again. A role the
   reader chose themselves is never overwritten, a Summary carries none, and the
   pre-selected one clears like any other: this is a head start, not a lock. */
function withClassification(f: FormState, c: StatementClassification): FormState {
  const roleFits = !!f.accountRole && CLASSIFICATIONS_FOR_ROLE[f.accountRole].includes(c)
  const named = f.glAccountType === 'Summary' ? undefined : roleNamedByClassification(c)
  const role = roleFits ? f.accountRole : (named ?? '')
  return {
    ...f,
    statementClassification: c,
    accountRole: role,
    normalBalance: role ? normalBalanceForRole(role) : deriveNormalBalance(f.accountType),
  }
}


export type CreateAccountSlideOverProps = {
  open: boolean
  onClose: () => void
  defaults?: Partial<FormState>
  // Section 2, item 11: which of the four layout variants to render. Defaults
  // to the module constant CREATE_MODAL_VARIANT when omitted (backward-compatible).
  variant?: CreateModalVariant
  // The summary account this one is being created under, when opened via an
  // "add sub-account" affordance. It fixes the category and the placement, so
  // both are locked in the form.
  parentAccount?: Account
  /* "Move under a new summary account" is not this form any more: it has its
     own dialog, MoveUnderSummaryModal, which draws the tree the move makes
     (design review, 2026-09-24). */
  // When staging accounts before they are committed to the store (e.g. the
  // Build-from-Scratch setup flow), pass the draft scheme + local account list
  // so validation and number suggestion run against them, and onCreate to
  // receive the built Account instead of writing to the store.
  scheme?: NumberingScheme
  accountsOverride?: Account[]
  onCreate?: (account: Account) => void
  // When provided, the modal opens in "Edit account" mode: fields are seeded
  // from this account, what its posted entries name is locked, and Save writes
  // via updateAccount.
  editAccount?: Account
  /* Open on the bank details alone: no step trail, no classification, no group
     filters, no preview, and Save instead of Continue.

     Used where the reader clicked something that already named the one missing
     thing. An imported bank account is missing its bank details and nothing
     else, so the whole account form is the wrong answer to that click: it puts
     four steps they have no reason to visit around the one they do, and asks
     them to restate what the import already said. */
  bankDetailsOnly?: boolean
}

/* One form for both kinds of account, on a create and on an edit alike.

   A summary used to open a modal of its own - `EditSummaryAccount`, three live
   fields over a read-only list of facts - on the grounds that a summary edit
   through this form would be eight disabled controls around three live ones.
   Mahad, 2026-09-22, having seen it: *"replace the cramped/weird UI with the
   spacious GL Account Details view framework ... remove confusing helper text
   such as 'what you can change' or 'set by the chart'"*, and the locking he
   wants is a state rather than a kind - *"unused: all fields fully editable ...
   in use: structural parameters locked"* - which is the same rule on both.

   So the split is gone. What differs between a summary and a posting account is
   which fields apply (a summary reserves a number range and carries no role,
   side or dimensions) and what counts as being in use - see `inUse`. Neither is
   a reason for a second form, and a second form is how the two drift.

   Bank details keep their own door: that one is opened on a posting account and
   names the single field it came for. */
/* The access list's words for the shared picker dialog. */
const ACCESS_COPY: PickerCopy = {
  title: 'Who has access',
  subtitle: 'Select the roles or people who can see this account',
  add: 'Choose who has access',
  one: 'person',
  many: 'people',
  icon: Lock,
}
const accessText = (ids?: string[]) => (ids && ids.length ? describePicked(ids).join(', ') : '-')

export function CreateAccountSlideOver({ open, onClose, defaults, scheme, accountsOverride, onCreate, editAccount, variant, parentAccount, bankDetailsOnly }: CreateAccountSlideOverProps) {
  const store = useStore()
  const restrictedDefault = store.company.restrictedAccessDefault ?? DEFAULT_RESTRICTED_ACCESS
  const navigate = useNavigate()
  const staged = !!onCreate
  const isEdit = !!editAccount
  // Only ever an edit: an account has to exist before it can be short of one field.
  const bankOnly = !!bankDetailsOnly && isEdit
  /* Dimensions whose defaults a posting account can set. Active only; a
     value-less one still shows, because the picker can create its first value
     inline and hiding it would leave no way in. Staged setup flows pass their
     draft set. */
  const availableDimensions = store.dimensions.filter(t => t.status === 'Active')
  // Both types are user-choosable: nothing on the chart is system-generated any
  // more, so there is no read-only type to make room for.
  const glTypeOptions: GLAccountType[] = SELECTABLE_GL_ACCOUNT_TYPES
  // Which layout variant to render (prop wins, else the module default).
  const activeVariant: CreateModalVariant = variant ?? CREATE_MODAL_VARIANT
  const activeScheme = scheme ?? store.numberingScheme
  const activeAccounts = accountsOverride ?? store.accounts
  /* Every create opens on step 1, Classification, wherever it was started
     (Mahad, 2026-10-09: *"instead of skipping directly to Step 2, we must show
     the Classification step as Step 1 first, and this logic needs to be
     implemented system-wide"*). It used to open on Details whenever the request
     already carried the category - a summary's Create GL account, Create account
     above or below, a category's Add row - and so never showed the statement
     classification, which the category alone does not settle.

     What the request did settle is the category: the summary it was started
     from, or the category it was added in. That is locked on step 1 - *"the
     'What kind of account is this?' field should be locked ... but the
     Statement Classification should remain editable"*. The parent comes as
     `parentAccount` from an account's page and as `defaults.parentId` from a
     row; both lock the same way. */
  const requestParent: Account | undefined = isEdit
    ? undefined
    : parentAccount ?? (defaults?.parentId ? activeAccounts.find(a => a.id === defaults.parentId) : undefined)
  const categoryFixed = !isEdit && (!!requestParent || !!defaults?.accountType)
  /* What a parent handed over as `parentAccount` alone implies for the form:
     its category, and its statement line as the starting one - a category root
     spans its category, so it starts on the category's default line instead.
     A row's request states these itself in `defaults`. Without this, a child
     started from a liability's page opened as an asset. */
  const fromParent: Partial<FormState> = parentAccount && !isEdit
    ? {
      accountType: parentAccount.accountType,
      statementClassification: isCategoryRoot(parentAccount)
        ? defaultClassificationForCategory(parentAccount.accountType)
        : parentAccount.statementClassification,
    }
    : {}
  const initial: FormState = editAccount ? {
    accountType: editAccount.accountType,
    accountRole: editAccount.accountRole ?? inferRoleFromBankDetails(editAccount),
    glAccountType: editAccount.glAccountType,
    normalBalance: editAccount.normalBalance === 'n/a'
      ? deriveNormalBalance(editAccount.accountType)
      : editAccount.normalBalance,
    statementClassification: editAccount.statementClassification,
    accountNumber: editAccount.accountNumber,
    accountName: editAccount.accountName,
    subType: editAccount.subType ?? '',
    bankAccountType: editAccount.bankAccountType ?? '',
    creditLimit: editAccount.creditLimit ?? '',
    bankName: editAccount.bankName ?? '',
    selectedInstitutionId: editAccount.selectedInstitutionId ?? '',
    bankAccountTitle: editAccount.bankAccountTitle ?? '',
    bankNickname: editAccount.bankNickname ?? '',
    bankRouting: editAccount.bankRouting ?? '',
    bankAccountNumber: editAccount.bankAccountNumber ?? '',
    subsidiaryId: editAccount.subsidiaryId ?? 'sub_main',
    currencyCode: editAccount.currencyCode,
    effectiveDate: editAccount.effectiveDate,
    description: editAccount.description ?? '',
    restricted: !!editAccount.restricted,
    restrictedAccess: editAccount.restrictedAccess ?? [],
    status: editAccount.status,
    defaultDimensionValues: (editAccount.defaultDimensionValues ?? []).map(tv => ({ ...tv })),
    parentId: editAccount.parentId ?? null,
    numberRangeStart: typeof editAccount.numberRangeStart === 'number' ? String(editAccount.numberRangeStart) : '',
    numberRangeEnd: typeof editAccount.numberRangeEnd === 'number' ? String(editAccount.numberRangeEnd) : '',
  } : {
    accountType: 'AST',
    accountRole: '',
    glAccountType: '',
    accountNumber: '',
    accountName: '',
    subType: '',
    bankAccountType: '',
    creditLimit: '',
    bankName: '',
    selectedInstitutionId: '',
    bankAccountTitle: '',
    bankNickname: '',
    bankRouting: '',
    bankAccountNumber: '',
    subsidiaryId: 'sub_main',
    currencyCode: store.company.baseCurrency,
    effectiveDate: store.company.fiscalYearStart,
    description: '',
    restricted: false,
    restrictedAccess: [],
    status: 'Active',
    defaultDimensionValues: [],
    parentId: parentAccount?.id ?? null,
    numberRangeStart: '',
    numberRangeEnd: '',
    ...fromParent,
    ...defaults,
    /* The side follows the category the form opens on, not the Asset the blank
       form starts from. It used to stay Debit whatever category a row handed
       over, and contra is read off the side - so a row added under Liability,
       Equity or Revenue opened as a contra account. Design review, 2026-10-02 -
       Eli: *"Why did this default to a contra? Shouldn't the default always be
       the not contra?"* A caller that names a side keeps it. */
    normalBalance: defaults?.normalBalance ?? deriveNormalBalance(defaults?.accountType ?? fromParent.accountType ?? 'AST'),
    /* And the statement line starts on one of the category's own. A request that
       named only the category - a category's Add row - left it on the blank
       form's Current asset, so a liability opened with no line picked. */
    statementClassification: defaults?.statementClassification ?? fromParent.statementClassification
      ?? defaultClassificationForCategory(defaults?.accountType ?? fromParent.accountType ?? 'AST'),
  }
  const [form, setForm] = useState<FormState>(initial)
  // The Summary this account hangs under, picked in-form. Seeded from the click
  // location (defaults.parentId) when the create flow was opened from an inline
  // insert. An explicit `parentAccount` prop overrides it.
  const [parentPick, setParentPick] = useState<string>(typeof initial.parentId === 'string' ? initial.parentId : '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [discardOpen, setDiscardOpen] = useState(false)
  const [descTall, setDescTall] = useState(false)
  // Section 2, item 7: optional description is collapsed by default in the flat
  // variants; the user opens it on demand.
  const [descOpen, setDescOpen] = useState(false)
  // Stepped flow: pick the category, fill in the GL account type and details,
  // then preview where the account lands in the Chart of Accounts. A bank or card
  // account inserts a Bank details step before the preview. Edit mode walks the
  // same steps with category / section / number locked.
  const [step, setStep] = useState<WizardStep>(editAccount ? 'details' : 'classification')
  /* The furthest step reached on this create, so a step the reader has already
     been through stays clickable after they go back. Reset when the form opens. */
  const [furthest, setFurthest] = useState(0)
  // "Add as Partner" interstitial for Bank / Credit Card accounts, shown once
  // when Create account is pressed; the ref records that it has been answered
  // so the next press proceeds straight to creation. (Flat variants only - the
  // stepped flow sets the partner up inline on the banking step instead.)
  const [partnerPromptOpen, setPartnerPromptOpen] = useState(false)
  const partnerAckRef = useRef(false)
  /* The Status field changes an account's state, and every other way into that
     says what it means first. Same shape as the partner prompt above: Save opens
     it, the ref records the answer, and the next press goes through. */
  const [statusConfirm, setStatusConfirm] = useState<{ action: LifecycleAction; spec: ConfirmSpec } | null>(null)
  const statusAckRef = useRef(false)
  // Inline "set up as partner" on the banking step: a toggle plus a draft that
  // is turned into a real partner when the account is created.
  const [partnerEnabled, setPartnerEnabled] = useState(false)
  const [partnerDraft, setPartnerDraft] = useState<PartnerDraft>(emptyPartnerDraft(''))
  // "Connect a bank feed" wizard (Cash Management-style), opened from Bank details.
  const [connectBankOpen, setConnectBankOpen] = useState(false)
  // Set once the bank feed has been connected via the wizard.
  const [bankFeedConnected, setBankFeedConnected] = useState(false)
  // Confirmation before tearing down a live bank-feed connection.
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  // Inline duplicate error (debounced). A number outside some band is no longer
  // a thing that can be wrong, so a duplicate is the only number problem left.
  const [dupError, setDupError] = useState<string | null>(null)
  const parentTouchedRef = useRef(false)   // user hand-picked the parent (stop re-defaulting it)
  const rangeTouchedRef = useRef(false)    // user typed a range (stop re-offering the free block); a picked pill does not count
  /* User typed a number: stop suggesting one, and stop stating one. State rather
     than a ref because it is read while rendering - it decides whether the field
     is a box or an input - and a ref changing would not redraw it. */
  const [numberTouched, setNumberTouched] = useState(false)
  /* Whether a summary reserves a block. On by default for a new one - Eli,
     2026-09-24: *"the default structure should be with the toggle on"* - and on
     an edit, whatever the account already does. Held apart from the two range
     fields so switching it off and on again gives the reader back a block
     rather than two empty boxes. */
  const [reserving, setReserving] = useState<boolean>(() => editAccount ? accountRange(editAccount) !== null : true)

  // How wide a suggested number is written. A formatting preference, not a rule:
  // the customer can type any width they like over it.
  const numberWidth = activeScheme.segments[0]?.length ?? 4
  const isSummaryType = form.glAccountType === 'Summary'
  const chartIndex = useMemo(() => buildChartIndex(activeAccounts), [activeAccounts])

  /* The case where Posting or Summary is not a question, and what to say in
     place of the field. An edit is answered for good, in both directions - a posting account turned summary hands its balance to children it
     does not have, and a summary turned posting account starts taking entries on a
     figure that was only ever the sum of other rows. Either is safe only at zero
     transactions, and at zero transactions the account can be deleted and made
     again, so the conversion buys nothing that delete does not. */
  /* One rule behind most of the locks on an edit, and one sentence for it.

     A posted line quotes the account it landed on: the number it was posted
     under, whether the account takes entries at all, which side it posts on,
     what the account is recognized as, and the statement line it prints on.
     Every report already run quotes them too. So once anything has posted,
     those are what the entries name and the form holds them; the name and the
     status, which no entry quotes, stay open.

     The lock is the transactions, not the edit. Before anything posts, all of
     them are as editable as the name, so the form never claims a history the
     account may not have. Mahad: *"lock account role for me after I have
     transactions against this account"*, and the same for the rest.

     Said once, here, rather than a note under each of the five fields it
     settles: five notes for one rule was most of what made the step read
     cluttered. The fields carry a padlock and nothing else. */
  const posted = isEdit && !!editAccount?.hasTransactions
  // What the padlock on a posted bank account's or card's details says.
  const bankLockWhy = `Entries have posted to this ${editAccount?.accountRole === 'Credit Card' ? 'card' : 'bank account'}, so its ${editAccount?.accountRole === 'Credit Card' ? 'card' : 'bank'} details can't be changed.`
  // Which bank fields that padlock sits on: those the posted account was saved
  // with a value in. A blank one stays open to be filled.
  const bankLocked = {
    bankName: posted && !!editAccount?.bankName?.trim(),
    bankAccountNumber: posted && !!editAccount?.bankAccountNumber?.trim(),
    bankAccountTitle: posted && !!editAccount?.bankAccountTitle?.trim(),
    bankAccountType: posted && !!editAccount?.bankAccountType?.trim(),
  }
  // The logo and the type icon the open fields show, kept on the locked ones.
  const lockedInstitution = form.selectedInstitutionId ? BANK_INSTITUTIONS.find(b => b.id === form.selectedInstitutionId) : undefined
  const lockedBankType = bankTypesFor(form.statementClassification).find(o => o.value === form.bankAccountType)

  /* Whether the account is in use, which is what decides the structural locks
     rather than the fact of editing. Mahad, 2026-09-22: an account with no
     transactions, no payments and - on a summary - no accounts filed under it is
     *"fully editable, including Account Type, Statement Classification, and
     Currency"*; one with any of those has its *"structural parameters locked"*.

     Two conditions, not one, because the two kinds of account are used in
     different ways. A posting account is used by being posted to. A summary
     holds no figures of its own, so nothing ever posts to it - what it is used
     by is the accounts filed beneath it, which take their category and their
     statement line from it. So a summary with children is as settled as a
     posting account with entries, and an empty one is as open as a fresh one. */
  const childCount = isEdit && editAccount ? chartIndex.childrenOf(editAccount.id).length : 0
  const inUse = posted || childCount > 0
  // Which of the two it is, because they lock the same fields for different
  // reasons and a padlock that cannot say why is just a greyed-out control.
  const IN_USE_WHY = posted
    ? 'Entries have posted to this account, and they were filed under this.'
    : 'Accounts are filed under this summary, and they take it from here.'
  const POSTED_LOCK_NOTE = posted
    ? 'Entries have posted to this account, and they name its number, GL account type, normal balance, account role and statement classification. Its name and status can still change.'
    : 'Accounts are filed under this summary, and they take its category and its statement line from it. Its name, number range and description can still change.'

  // The one account the lifecycle is withheld from rather than refused, in the
  // menu and so on this field too. See the Status field for why.
  const statusLocked = isEdit && !!editAccount && isCategoryRoot(editAccount)

  /* A summary's status is a live pick like any account's: decision 53 lets one
     be deactivated once every account under it is inactive, and Save runs the
     same plan the Actions menu does, so a summary with active accounts under it
     is refused there with the reason (decision 52; module review, 2026-10-06,
     COA-21). It used to be padlocked on Active - a summary was archive-only. */

  const glTypeLock = isEdit
      ? {
        value: form.glAccountType || 'Posting',
        /* Locked on every edit, not only once entries exist: the conversion is
           unsafe in both directions, and at zero transactions the account can
           be deleted and made again, so it buys nothing delete does not. */
        why: 'A posting account and a summary hold their figures differently, so an account cannot be changed from one to the other.',
      }
      : null

  /* The number is settled by use, not by the edit. Saved reports, exports and
     every other module name this account by its number, and none of them are
     re-pointed by an edit here - so a renumber leaves them quoting an account
     that has moved. That is the same argument `internalId` exists to answer,
     from the other side.

     But nothing quotes an account nothing has landed in. Mahad, 2026-09-22:
     *"when I create a new account and there are no transactions in it ... then I
     should be able to change everything. In the edit view, the things we have
     locked were done solely because for accounts where transactions have already
     taken place."* So this reads `inUse`, like the rest of the structural locks -
     a number typed wrong an hour ago is a correction, not a renumber.

     Same shape as `glTypeLock`: the padlock and the tooltip say it, and the
     field itself states nothing but its value.

     The lock itself is built further down, once the typed range is known: a
     summary being created is numbered by the block it reserves, which is this
     form's second reason to state the field rather than ask it. See
     `numberLock`. */
  const numberInUseLock = inUse
    ? {
      why: `${IN_USE_WHY} Saved reports, exports and other modules name this account by its number.`,
    }
    : null

  // ── Parent (picked in-form) ──
  // Every account hangs under a Summary, and that parent is the primary
  // structural control on this form: it decides where the account lands, and its
  // own number is what a segmented suggestion is patterned on. The dependency
  // runs one way only - parent to number, never number back to parent - so the
  // two fields cannot chase each other.
  //
  // The candidates come from `eligibleParents`, the same rule the store's
  // validator reads, so a parent offered here is never a parent the save
  // rejects: a Summary of this category, still on the chart, and never the
  // account itself or anything already beneath it.
  const parentOptions = useMemo(
    () => eligibleParents(activeAccounts, form.accountType, editAccount?.id),
    [activeAccounts, form.accountType, editAccount],
  )
  // The effective parent: an explicit prop wins (opened from a parent's ＋),
  // then the in-form pick, then the parent the account already has.
  //
  // That last fallback only holds while the account's own parent is still on
  // offer. A category is a live question on an unused account now, and the
  // summaries a category offers are its own - so switching category and falling
  // back to the old parent would file the account under a summary from the
  // category it just left. The pick clears with the category; this follows it.
  //
  // An account in use keeps the unconditional fallback, because there the field
  // states a fact rather than offering a choice: its parent may be archived, and
  // so absent from the options, and the field must still name it.
  const existingParent = isEdit && editAccount ? chartIndex.parentOf(editAccount.id) : undefined
  const pickedParent: Account | null = parentAccount
    ?? parentOptions.find(a => a.id === parentPick)
    ?? (existingParent && (inUse || parentOptions.some(a => a.id === existingParent.id)) ? existingParent : undefined)
    ?? null

  /* Once the account is in use the field states where it sits and offers no
     move. Mahad: *"Parent field should be locked as well in edit flow. The only
     way an account can have another parent is from this option"* - "Move under a
     new summary account", in the Actions menu. A picker here would be a second,
     quieter route to the same change, and only one of the two builds the summary
     the move is named for.

     That route exists because moving a settled account moves its figures with
     it, which is a thing to be walked through rather than typed into a form.
     Nothing has landed in an account nothing has posted to, so there is nothing
     to walk through: Mahad, 2026-09-22, *"it's a completely fresh new account -
     then I should be able to change everything."* Filing a new account in the
     wrong summary is the mistake this form is most likely to make, and until it
     is in use, correcting it is a re-pick rather than a move.

     A category root resolves to 'None' through the same expression: it sits at
     the top of its category by definition, so `pickedParent` finds nothing. */
  const parentLock: { value: string } | null =
    isEdit && inUse
      ? { value: pickedParent ? `${pickedParent.accountNumber} · ${pickedParent.accountName}` : 'None' }
      : null

  /* The three cases where the statement classification is not a question, and
     what to say in place of the field.

     A summary prints as a single line, and everything under it is inside that
     line, so a summary that is not a category root settles the classification of
     what hangs beneath it - there is nothing left to ask. The five category roots
     are the exception: assets span current and non-current, so a row under
     "Assets" still has to say which.

     An account that has posted keeps the line it posted on: the figures it has already landed in
     were filed under it, and moving the line now would move them. See
     `inUse` - before anything lands, the line is a live choice on an edit
     exactly as it is on a create.

     The category above it settles the same way, one step earlier: it decides
     which statement the account prints on at all. It used to be locked on every
     edit - now it is locked by use, so a fresh account can still be corrected
     without being deleted and made again. */
  /* The parent sets the classification's starting value, not its only one.
     Decision 3: *"Its statement section defaults from the parent; an override is
     allowed but flagged."* Module review, 2026-10-06 (COA-13): picking 12100
     Property, Plant & Equipment as the parent silently turned a chosen Current
     asset into a Non-current one. Now the reader's own choice stays, and the
     chart flags it as an override. Only use locks it, as it locks the number. */
  const classificationParent = pickedParent && !isCategoryRoot(pickedParent) ? pickedParent : null
  const parentClassification = classificationParent?.statementClassification ?? null
  const classificationLock: { value: StatementClassification; why: string } | null =
    inUse
      ? {
        value: form.statementClassification,
        why: `${IN_USE_WHY} It cannot be moved to another statement line.`,
      }
      : null
  // Picked by hand: a parent chosen afterwards no longer resets it. An edit
  // opens on the account's own choice.
  const classificationTouchedRef = useRef(isEdit)
  /* Leaving the Classification step settles it too. The step opens on a
     preselected line - Current asset for an asset - and moving on from it is the
     reader choosing that line, whether or not they clicked it. Retest,
     2026-10-07 (COA-13 still open): Current asset kept as offered, then 12100
     picked as the parent on Details, saved as Non-current with no flag. */
  const confirmClassification = () => { classificationTouchedRef.current = true }
  const classificationOverride = !!parentClassification && form.statementClassification !== parentClassification
  const overrideNote = classificationOverride && classificationParent
    ? `Its parent, ${classificationParent.accountNumber} ${classificationParent.accountName}, is ${parentClassification!.toLowerCase()}. This account keeps ${form.statementClassification.toLowerCase()}, and the chart flags it as an override.`
    : null

  /* The category settles one step before the classification, and by the same two
     things - the parent, then the use. The parent settles it by arithmetic: an
     account under a summary is inside that summary's total, so it is in the
     summary's category. This holds a step higher than `classificationParent`
     does, because a category row pins the category of everything beneath it even
     though it leaves the statement line open.

     But it only settles it for as long as the parent itself is settled. On an
     account nothing has landed in the parent is a live pick (see `parentLock`),
     so the category is a live pick too, and the two move together: choosing a
     category clears the parent and the summaries of that category are then what
     the parent field offers. Locking the category to a parent the reader is free
     to change would be a padlock on the first half of a decision whose second
     half is open - and it is what made a fresh account read as fixed. */
  const categoryLock: { why: string } | null =
    !isEdit || !inUse
      ? null
      : pickedParent
        ? { why: `This account is inside ${pickedParent.accountNumber} ${pickedParent.accountName}, so it falls in the same category.` }
        : { why: `${IN_USE_WHY} It cannot be moved to another category.` }

  /* Hold the field on whatever the parent settles, including when the parent is
     changed after the fact - picking a new parent moves the account to a
     different line on the statement, and the field has to follow. */
  useEffect(() => {
    if (!parentClassification || classificationTouchedRef.current) return
    setForm(f => f.statementClassification === parentClassification ? f : withClassification(f, parentClassification))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentClassification])

  /* The reader's typed range as the store would see it - two integers or an
     explanation why not. Kept together so the field can show one error at a
     time and doCreate can hand the numbers over without re-parsing. */
  const rangeParsed = useMemo(() => parseRangeInputs(form.numberRangeStart, form.numberRangeEnd), [form.numberRangeStart, form.numberRangeEnd])
  /* Number protection, the module setting. On unless the chart's owner turned it
     off - see lib/numberRange.ts for what it keeps. */
  const protection = numberProtectionOn(store.company)
  const reservesBlock = isSummaryType && reserving
  const rangeFromForm = reservesBlock && rangeParsed.kind === 'range'
    ? { numberRangeStart: rangeParsed.range.start, numberRangeEnd: rangeParsed.range.end }
    : { numberRangeStart: undefined, numberRangeEnd: undefined }

  /* The typed range of the summary being created, which is the block its own
     number has to land in. Only a summary has one: a posting reserves nothing. */
  const ownRange = reservesBlock && rangeParsed.kind === 'range' ? rangeParsed.range : null

  /* The blocks a new summary here could reserve, and the one to recommend. */
  const offer: BlockOffer = useMemo(() => isSummaryType
    ? offerBlocks({
      parent: pickedParent ?? null,
      chart: activeAccounts,
      protection,
      accountId: editAccount?.id,
    })
    : NO_OFFER,
  [isSummaryType, pickedParent, activeAccounts, protection, editAccount?.id])

  /* Where the number and the block may sit, read against every reservation on
     the chart (design review, 2026-09-24): a reservation keeps every account that
     is not under the summary out of its block, but does not keep the summary's
     own accounts in - so a number outside the parent's block is fine, and a
     number inside somebody else's is not. With number protection on, the stretch
     from each summary to its last account is kept for its accounts too.

     Held beside the fields rather than inside `validate()` for the same reason
     the duplicate check is: the refusal comes from the chart rather than from
     the field, so it has to hold the reader on this step instead of letting them
     walk on to a review of a number the save would reject. */
  const placement = useMemo(() => {
    if (!form.glAccountType) return null
    if (reservesBlock && rangeParsed.kind === 'error') return null
    return checkPlacement({
      accountId: editAccount?.id,
      accountNumber: form.accountNumber,
      accountName: form.accountName,
      glAccountType: isSummaryType ? 'Summary' : 'Posting',
      parentId: pickedParent?.id ?? null,
      range: ownRange,
      chart: activeAccounts,
      protection,
    })
  }, [form.glAccountType, form.accountNumber, form.accountName, reservesBlock, rangeParsed, isSummaryType, editAccount?.id, pickedParent, ownRange, activeAccounts, protection])
  /* Which field hears about it. A summary reserving a block is told on the block,
     because the block is what it just chose - unless the complaint is its own
     number sitting outside that block, which is the number field's. */
  const placementOnRange = !!placement && !!ownRange && !placement.onNumber
  const rangeError: ReactNode = reservesBlock && rangeParsed.kind === 'error'
    ? rangeParsed.error
    : placementOnRange ? <RangeMessage problem={placement!} /> : null
  const numberRangeError: ReactNode = placement && !placementOnRange ? <RangeMessage problem={placement} /> : null

  /* The reserve switch. Off clears the block and, if the number was only ever
     the block's first number, the number with it - Eli, 2026-09-24: *"if you
     haven't reserved anything, then it shouldn't pre-populate anything"*. On
     gives back what the account had, or lets the recommendation fill in again. */
  const toggleReserving = (on: boolean) => {
    setReserving(on)
    rangeTouchedRef.current = false
    if (!on) {
      setForm(f => ({ ...f, numberRangeStart: '', numberRangeEnd: '', accountNumber: numberTouched || isEdit ? f.accountNumber : '' }))
      return
    }
    const had = editAccount ? accountRange(editAccount) : null
    if (had) setForm(f => ({ ...f, numberRangeStart: String(had.start), numberRangeEnd: String(had.end) }))
  }
  // One field, one message, nearest cause first: a number already in use is a
  // plainer fault than a number in the wrong block.
  const numberError = dupError ?? numberRangeError ?? errors.accountNumber
  /* A number of another length is allowed, with a soft warning that never
     blocks (decisions 26 and 40; module review, 2026-10-06, COA-07). */
  const numberLengthNote = !numberError ? numberLengthWarning(form.accountNumber, activeAccounts, editAccount?.id) : null

  /* A summary being created is numbered with the first number of the block it
     reserves. Mahad, 2026-09-23: *"For summary accounts, the GL number should
     default to the first number in the range, with a tooltip explaining why.
     Decide between locking the GL number to the range start or letting people
     edit both and auto-correcting with a message. I'm fine either way, so just
     pick one."*

     Locked, for three reasons. The chart already reads this way - all 138 seeded
     accounts have it, every summary's number being its range start - so the lock
     describes the convention rather than imposing a new one. It leaves one number
     to choose instead of two that can disagree, and the range card above is where
     that choice is already made, against a picture of what is taken and what is
     free. And auto-correcting would mean rewriting a field under the reader's
     hand, which is the exact fault the old number guess was removed for.

     The number stays fully editable, through the range start rather than through
     this field - so this is a lock in the sense that a derived field is locked,
     not in the sense the Status field was. It holds on a create only: an imported
     summary whose number sits somewhere else in its block is a fact about the
     customer's chart, and opening its edit form is no occasion to renumber it
     silently. Releasing when the range is cleared follows from the same thing -
     with no block there is no first number for the field to be stating.

     And it yields to a number already typed, because *"default"* is what Mahad
     asked for and a default is what you get in the absence of an answer. The
     case is a reader who numbered the account and then decided it was a summary:
     taking the lock at its word there would overwrite what they typed, which is
     the very fault it was chosen over. They keep their number in a field they can
     still edit, and `numberRangeError` tells them if it falls outside the block
     they have just reserved. */
  const numberFollowsRange = !isEdit && !numberInUseLock && !numberTouched && !!ownRange
  const numberLock = numberInUseLock
    ?? (numberFollowsRange
      ? { why: 'A summary is numbered with the first number of the block it reserves, so the account and its block open on the same number. Change the start of the range to change it.' }
      : null)

  /* The number the form opens holding, which is nothing unless an inline draft
     row handed one over. Mahad, on a create pre-filled with 1370: *"I am not
     exactly sure why it is doing this ... I think we shouldn't pre-populate it
     at all. We can just leave the field blank and let the user enter the number
     manually themselves."*

     The guess he was looking at read the category's highest number and added
     ten, which is why every new asset arrived as 1370 whatever he was making and
     wherever he was filing it. A number is read off the parent's block again
     now, but it is offered under the field rather than written into it - see
     `numberSuggestion`. The field is required, so a blank one is refused by
     `validate` rather than saved. */
  const handedNumber = (defaults?.accountNumber ?? '').trim()

  // Has the user entered anything in a fresh Create flow? Used to gate the
  // "Discard account creation?" confirmation on close (mirrors Create Partner).
  const createDirty = !isEdit && (
    form.accountName.trim() !== '' ||
    form.description.trim() !== '' ||
    form.defaultDimensionValues.length > 0 ||
    form.bankAccountNumber.trim() !== '' ||
    // Against what the form opened with, not against a blank one: a request that
    // arrives already classified - a category card, a draft row - is not
    // work the reader would want a discard prompt over.
    form.glAccountType !== initial.glAccountType ||
    form.accountType !== initial.accountType ||
    form.accountNumber !== handedNumber
  )
  // Intercept close (Cancel / backdrop / Escape / ✕): confirm if work is in
  // progress, otherwise close immediately.
  const requestClose = () => {
    if (createDirty) { setDiscardOpen(true); return }
    onClose()
  }

  // Reset on open: in edit mode seed from the account, in create mode from the
  // request, whose number is blank unless a draft row supplied one.
  useEffect(() => {
    if (!open) return
    if (isEdit) {
      setForm(initial)
      // The picker opens on where the account already sits; the effect below
      // never re-points it on an edit, so this is the only thing that seeds it.
      setParentPick(typeof initial.parentId === 'string' ? initial.parentId : '')
      parentTouchedRef.current = true
      setReserving(!!initial.numberRangeStart && !!initial.numberRangeEnd)
      // An edit has no classification step - see `wizardSteps`.
      setErrors({}); setDupError(null); setStep(bankOnly ? 'banking' : 'details'); setFurthest(0)
      setPartnerEnabled(false); setPartnerDraft(emptyPartnerDraft(initial.bankName ?? ''))
      return
    }
    setParentPick(typeof initial.parentId === 'string' ? initial.parentId : '')
    parentTouchedRef.current = typeof initial.parentId === 'string' && !!initial.parentId
    rangeTouchedRef.current = false
    setReserving(true)
    // A number handed over by a draft row counts as typed: it came from the
    // reader, so the suggestion has nothing to add and no business overwriting it.
    setNumberTouched(!!handedNumber)
    partnerAckRef.current = false
    setPartnerPromptOpen(false)
    setBankFeedConnected(false)
    setPartnerEnabled(false); setPartnerDraft(emptyPartnerDraft(''))
    setForm({ ...initial, accountNumber: handedNumber })
    setErrors({}); setDupError(null); setStep('classification'); setFurthest(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  /* No parent is picked for the reader (Mahad, 2026-10-08: *"Should not
     pre-populate parent for you"*). It used to default to the category's first
     summary, which filed an account the reader had not placed. One opened from a
     place in the chart - a parent's +, a row's Create account above or below -
     still arrives with that place's parent, because the click chose it. */

  /* The range opens on the recommended block: the next clean block, one zero
     smaller than the parent's, after everything the parent already holds. Eli,
     2026-09-24: *"it will default to the next available block that's the same
     number of digits that I would normally have in that part of the tree."* It
     replaced the whole leftover gap, which took the tail of the parent's block
     (1500-1999) and left nothing for the next summary.

     Only while the reserve switch is on. Re-seeds when the parent changes,
     because the blocks it divides have changed, and stops the moment the reader
     types into either end. A block picked from the pills is not typed: it was
     one of the old parent's blocks, so it is replaced like the recommendation
     would be - kept, it sat in the fields as a range the new parent refuses. Where nothing clean is left it offers nothing rather
     than guessing. */
  useEffect(() => {
    if (isEdit || !isSummaryType || !reserving || rangeTouchedRef.current) return
    const next = offer.recommended
    const start = next ? String(next.start) : ''
    const end = next ? String(next.end) : ''
    setForm(f => (f.numberRangeStart === start && f.numberRangeEnd === end
      ? f
      : { ...f, numberRangeStart: start, numberRangeEnd: end }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, isSummaryType, reserving, pickedParent?.id, offer.recommended?.start, offer.recommended?.end])

  /* A summary's number follows the start of its block, which is the other half of
     `numberFollowsRange` - the lock states the value and this is what puts it
     there. Writes through `setForm` rather than through the field, so it never
     marks the number as touched. */
  useEffect(() => {
    if (!numberFollowsRange || !ownRange) return
    const n = String(ownRange.start)
    setForm(f => (f.accountNumber === n ? f : { ...f, accountNumber: n }))
  }, [numberFollowsRange, ownRange?.start])

  /* The lowest number still free under the parent, offered below the field rather
     than written into it - Mahad, 2026-09-24: *"Do not pre-populate with the
     account number. It should be an option below to select. Something like a
     suggestion that this is the next available account number."*

     Read off the block the parent actually reserves, which is what makes it worth
     offering at all: the guess this descends from read the category's highest
     number and added ten, so every new asset arrived as 1370 whatever was being
     made and wherever it was filed - a number no reservation covered. Mahad had
     that one removed outright (*"I think we shouldn't pre-populate it at all"*),
     and writing a better number into the same box kept the half he objected to
     rather than the half he corrected: a number the reader did not choose still
     has to be read, checked and usually cleared, and one sitting in the box reads
     as one they entered. Offered, the same arithmetic is a shortcut instead.

     Posting accounts only - Mahad, 2026-09-24: *"This wont be the case for
     summary accounts... Only account number suggestion will be for posting
     account."* A summary is numbered from the block it reserves, and the range
     card above is where that block is chosen; offering a number underneath the
     field too would be a second source competing for the same box, and the
     number it offers is not a block start. The states this reached were the two
     where `numberFollowsRange` is off - a summary with no valid range yet, and
     one whose number the reader typed before deciding it was a summary - and a
     number counted along the free line is the wrong one to hand either.

     Null where there is nothing to read - a parent reserving no block leaves no
     line to count along - and null once the field holds it already, which would
     otherwise print the same number twice a line apart. */
  const numberSuggestion = useMemo(() => {
    if (isEdit || isSummaryType || !pickedParent) return null
    /* A number the form was opened with was picked for a place - between two
       rows, above or below one - and "next recommended" would answer a question
       the reader did not ask: where the end of the branch is. It comes back once
       they change the number. */
    if (handedNumber && form.accountNumber.trim() === handedNumber) return null
    // Next after the siblings, on their step, stepping over any child summary's
    // block - see `suggestPostingNumber`.
    const n = suggestPostingNumber({ parent: pickedParent, chart: activeAccounts, protection })
    return n === null || String(n) === form.accountNumber.trim() ? null : String(n)
  }, [isEdit, isSummaryType, pickedParent, activeAccounts, form.accountNumber, protection, handedNumber])

  // Duplicate check (BR-001), debounced ~200ms, against every account in scope.
  useEffect(() => {
    const t = setTimeout(() => {
      const v = form.accountNumber
      if (!v) { setDupError(null); return }
      const conflict = activeAccounts.find(a => a.accountNumber === v && a.id !== editAccount?.id)
      setDupError(conflict ? `GL account number ${v} already exists (${conflict.accountName}).` : null)
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.accountNumber, activeAccounts])

  // ── Conditional field logic ──
  // Contra, the role and the currency are all posting-only. Treat "not yet
  // chosen" as posting so the form opens on the fuller of the two shapes.
  const isPostingType = form.glAccountType === 'Posting' || form.glAccountType === ''
  /* Account role applies to posting accounts only, and its options are scoped by
     the statement classification rather than the whole category: a reader who
     has said "non-current asset" is not offered receivables, because a
     receivable is never one. This is the third question narrowed by the second,
     which is why classification is asked before the role. */
  const roleApplies = form.glAccountType === 'Posting'
  const roleOptions = rolesForClassification(form.statementClassification, { keep: form.accountRole })
  const pickClassification = (c: StatementClassification) => { classificationTouchedRef.current = true; setForm(f => withClassification(f, c)) }
  // Picking a role sets the normal balance and locks it, so the two fields can
  // never disagree. Clearing the role releases it to the category default rather
  // than leaving whatever the last role happened to impose.
  const pickRole = (role: AccountRole | '') => setForm(f => ({
    ...f,
    accountRole: role,
    normalBalance: role ? normalBalanceForRole(role) : deriveNormalBalance(f.accountType),
  }))
  // The Bank-details block is unlocked by the Bank / Credit Card role - the one
  // source of truth for "this is a reconcilable account".
  const isBankSub = roleIsReconcilable(form.accountRole) && isPostingType
  // A credit card reconciles like a bank account but is described differently: an
  // issuing bank and a credit limit instead of a bank account type. This splits
  // the banking block into its two shapes.
  const isCardSub = isBankSub && form.accountRole === 'Credit Card'
  /* Ordered wizard steps. Two of them are conditional: a bank or card account
     inserts Bank details, and Dimensions appears only once the tenant has
     defined one. A step whose only content is an explanation of a feature the
     customer declined is a step in the way of the button. */
  const wizardSteps: WizardStep[] = bankOnly ? ['banking'] : [
    /* The category and the statement line open a create, because a new account
       is nothing until they are answered, and the card grids that ask them are
       worth a screen of their own. An edit skips the step: the account already
       is something, so both move down onto Details, stated where they are
       settled and asked where they are not. Mahad, 2026-09-22: *"rename the
       first step simply to 'Details' for both Summary and Posting account
       edits"* - which is what this leaves it as. */
    ...(isEdit ? [] : ['classification' as const]),
    'details',
    ...(isBankSub ? ['banking' as const] : []),
    /* Dimensions are carried by the accounts that post. A summary is a total of
       the accounts under it and holds no entries of its own, so there is nothing
       on it to tag - Mahad: *"we don't assign dimensions to summary accounts;
       dimensions are only meant for posting accounts."* */
    ...(availableDimensions.length > 0 && !isSummaryType ? ['dimensions' as const] : []),
    'preview',
  ]
  const stepIndex = Math.max(0, wizardSteps.indexOf(step))
  const stepAfter = (s: WizardStep): WizardStep => wizardSteps[wizardSteps.indexOf(s) + 1] ?? 'preview'
  useEffect(() => { setFurthest(f => Math.max(f, stepIndex)) }, [stepIndex])
  // If the bank checkbox is cleared while parked on the banking step, fall back to
  // the details step so we never render a step that no longer exists.
  useEffect(() => {
    if (!bankOnly && !wizardSteps.includes(step)) setStep('details')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBankSub])
  // The two shapes describe the account differently, so keep the one that isn't
  // showing from being saved. A card's type is implied by its role (the picker no
  // longer offers it), so set it here.
  useEffect(() => {
    if (!isBankSub) return
    setForm(f => isCardSub
      ? { ...f, bankAccountType: 'Credit Card' }
      : { ...f, creditLimit: '', bankAccountType: f.bankAccountType === 'Credit Card' ? '' : f.bankAccountType })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.accountRole])
  /* Moving a bank account to non-current leaves only the certificate of deposit
     on offer, so a checking account already picked has to go rather than sit
     there unlisted and still be saved. */
  useEffect(() => {
    if (!isBankSub || isCardSub) return
    const offered = bankTypesFor(form.statementClassification).map(o => o.value)
    setForm(f => f.bankAccountType && !offered.includes(f.bankAccountType) ? { ...f, bankAccountType: '' } : f)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.statementClassification, isBankSub, isCardSub])
  // An existing partner whose name matches the typed bank - linking avoids a
  // duplicate. Drives the inline partner section's "already in Partners" state.
  const partnerMatch = isBankSub ? findMatchingPartner(form.bankName, store.partners) : undefined
  // A bank account can also be tracked as a Partner; this drives the "Add as
  // Partner" interstitial on Create. null = no prompt.
  const partnerPromptKind: 'bank account' | 'credit card' | null = isBankSub ? (form.accountType === 'LIA' ? 'credit card' : 'bank account') : null
  // Currency is choosable only for the posting accounts that hold cash: bank and
  // cash on hand. Every other account - including other posting accounts - stays
  // in the base currency.
  const currencyEditable = roleHoldsOwnCurrency(form.accountRole) && isPostingType

  // When the Currency picker is unavailable, the account is held in the base
  // currency - clear any non-base pick left over from a previous selection.
  useEffect(() => {
    if (!currencyEditable && form.currencyCode !== store.company.baseCurrency) {
      setForm(f => ({ ...f, currencyCode: store.company.baseCurrency }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencyEditable])

  // A summary account holds no balance, so it can't carry a role.
  useEffect(() => {
    setForm(f => ({ ...f, accountRole: f.glAccountType === 'Posting' ? f.accountRole : '' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.glAccountType])
  const multipleSubsidiaries = store.company.subsidiaries.length > 1

  const validate = () => {
    const errs: Record<string, string> = {}
    const list = validateAccountAgainst(activeScheme, activeAccounts, store.company, {
      accountNumber: form.accountNumber,
      accountName: form.accountName,
      accountType: form.accountType,
      statementClassification: form.statementClassification,
      // Passed so the validator can check the classification against the summary
      // above it. The form locks the field to the parent's, so this is a backstop
      // for a parent that moved while the form was open.
      parentId: pickedParent?.id ?? null,
      subType: form.subType,      effectiveDate: form.effectiveDate,
      bankRouting: form.bankRouting,
      bankAccountNumber: form.bankAccountNumber,
    }, editAccount?.id)
    list.forEach(e => { errs[e.field] = e.message })
    if (!form.glAccountType) errs.glAccountType = 'Select a GL account type.'
    // Account role is deliberately optional. It tells other modules how to treat
    // the account (Bank enables reconciliation, Receivable is the AR control),
    // but an account that no other module needs to recognise is still a valid
    // account, and forcing a role would push readers into picking a wrong one.
    /* Every account hangs under a Summary, so a parent must be chosen whenever
       there is one to hang under. Nothing to require when the field states the
       parent rather than asking for one - see `parentLock`.

       On an edit the requirement is only as strong as the account's own filing:
       an account that already sits at the top of its category is not made
       invalid by an edit, so it is asked for a parent only if it had one. */
    const wantsParent = !parentLock && !parentAccount && parentOptions.length > 0
      && (!isEdit || !!editAccount?.parentId)
    if (wantsParent && !parentPick && !pickedParent) {
      errs.parentGroup = 'Pick a parent.'
    }
    // Bank-field validation: for a bank account, only Bank Name and Account
    // Number are required to save (they link it to the banking section for
    // reconciliation). Account title and type are optional and can be completed
    // later when connecting a live feed. A card is identified by its issuer
    // alone; the limit and the card number can both be filled in later.
    if (isCardSub) {
      if (!form.bankName.trim()) errs.bankName = 'Enter the issuing bank.'
      const limit = form.creditLimit.trim()
      if (limit && !(Number(limit) > 0)) errs.creditLimit = 'Enter a credit limit greater than zero.'
      const card = form.bankAccountNumber.trim()
      if (card && !/^\d{12,19}$/.test(card)) errs.bankAccountNumber = 'Card number must be 12 to 19 digits.'
    } else if (isBankSub) {
      if (!form.bankName.trim()) errs.bankName = 'Enter the bank name.'
      const acc = form.bankAccountNumber.trim()
      if (!acc) errs.bankAccountNumber = 'Enter the account number.'
      else if (!/^\d{4,17}$/.test(acc)) errs.bankAccountNumber = 'Account number must be 4 to 17 digits.'
    }
    if (isBankSub) {
      // Setting up as a partner requires a partner group (unless it links to an
      // existing partner, which carries the group over).
      if (partnerEnabled && !partnerMatch && !partnerDraft.groupId) {
        errs.partnerGroup = 'Select a partner group.'
      }
    }
    /* A dimension holding two values or more has to say which one a journal
       line takes (Mahad, 2026-10-02). Owned by the step the editor is on, so the
       details step does not refuse over a field it does not show. */
    if (missingDefaults(form.defaultDimensionValues).length) errs.defaultDimensionValues = DEFAULT_VALUE_REQUIRED
    return errs
  }

  /* A message stops being shown once the field it names is answered. Mahad,
     2026-09-24, on a form with a type, a parent, a name and a number in it, all
     four still flagged: *"I did enter all the details... Why isn't the error
     states going away?"*

     Errors were only ever written at the gates - Continue, Save, Create - so
     every message was a photograph of the moment one was pressed, and stayed
     under a field long after the reader had answered it. A form they had fully
     filled in went on reading as four failures, which leaves nothing to
     distinguish the complaints they have dealt with from the ones they have not.

     Pruned against `validate()` rather than cleared field by field: the
     validator is the only thing that knows what an answer to each field is, and
     clearing inside twenty-odd onChange handlers is a list that silently stops
     covering the next field anyone adds.

     Only ever removes. Typing a name must not raise a fresh complaint about a
     number the reader has not reached yet - when to start asking is the gates'
     decision, and this runs on every keystroke. `status` is kept whatever
     `validate()` says, because it does not come from there: it is the store
     refusing a transition, not a field left empty.

     Costs nothing on a form with no errors on it, which is the usual case, and
     runs until the last one is gone on a form that has. */
  useEffect(() => {
    if (!Object.keys(errors).length) return
    const live = validate()
    setErrors(shown => {
      const kept = Object.keys(shown).filter(k => k === 'status' || live[k])
      return kept.length === Object.keys(shown).length
        ? shown
        : Object.fromEntries(kept.map(k => [k, shown[k]]))
    })
  })

  // Error keys owned by the Banking Details step; everything else belongs to the
  // Information step. Used to scope per-step validation as the user advances.
  const isBankingErrorKey = (k: string) =>
    k === 'bankName' || k === 'bankAccountNumber' || k === 'bankAccountType' || k === 'creditLimit' || k === 'partnerGroup'

  const doCreate = () => {
    const input = {
      accountNumber: form.accountNumber,
      accountName: form.accountName,
      accountType: form.accountType,
      glAccountType: (form.glAccountType || 'Posting') as GLAccountType,
      accountRole: form.accountRole || undefined,
      statementClassification: form.statementClassification,
      subType: form.subType || undefined,
      // Derived, never stored twice: the type is the single fact.
      isPosting: !isSummaryType,
      isContra: derivedContra,
      subsidiaryId: form.subsidiaryId,
      currencyCode: form.currencyCode,
      status: form.status,
      effectiveDate: form.effectiveDate,
      postingRestrictions: {},
      defaultDimensionValues: form.defaultDimensionValues,
      description: form.description,
      restricted: form.restricted || undefined,
      restrictedAccess: form.restricted && form.restrictedAccess.length ? form.restrictedAccess : undefined,
      bankAccountType: form.bankAccountType || undefined,
      creditLimit: form.creditLimit || undefined,
      bankName: form.bankName || undefined,
      selectedInstitutionId: form.selectedInstitutionId || undefined,
      bankAccountTitle: form.bankAccountTitle || undefined,
      bankNickname: form.bankNickname || undefined,
      bankRouting: form.bankRouting,
      bankAccountNumber: form.bankAccountNumber,
      parentId: pickedParent?.id ?? form.parentId ?? null,
      balance: 0,
      hasTransactions: false,
      /* Ranges are Summary-only, and this gate is what enforces it. The fields
         are no longer empty by default - picking Summary offers the free block
         under the parent - so a reader who tries Summary and settles on Posting
         leaves numbers behind in the form that a leaf must not be saved with. */
      ...(isSummaryType ? rangeFromForm : {}),
    } as Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'normalBalance'>

    /* When the reader opted to set the institution up as a partner (and it isn't
       already one), create it locally so it lands in the Partners directory.

       Runs on edit as well as on create, because the toggle is offered on both
       and a toggle that does nothing is worse than no toggle. It is the only way
       in from the bank-details-only modal, where adding the partner is one of
       the three things the reader came to do. */
    const maybeAddPartner = () => {
      if (!isBankSub || !partnerEnabled || partnerMatch) return
      const name = partnerDraft.name.trim() || form.bankName.trim()
      if (!name) return
      const p = store.addPartner({
        name,
        kinds: partnerDraft.kinds,
        phone: partnerDraft.phone.trim() || undefined,
        website: partnerDraft.website.trim() || undefined,
        address: partnerDraft.address.trim() || undefined,
        description: partnerDraft.description.trim() || undefined,
        groupId: partnerDraft.groupId,
      })
      store.pushToast(`${p.name} added to Partners`, 'success')
    }

    if (isEdit && editAccount) {
      const edits = {
        accountName: form.accountName,
        /* One field is deliberately absent, along with its `isPosting` mirror:
           the GL account type, which is settled at creation on every account and
           has no unlocked case to carry. See `glTypeLock`. */
        accountRole: form.accountRole || undefined,
        /* The rest are all live until the account is in use, and all locked to
           its own values after - so carrying them is a no-op on a settled
           account rather than a risk, and `updateAccount` logs only what it
           finds changed. See `categoryLock`, `classificationLock`, `numberLock`
           and `parentLock`. */
        accountNumber: form.accountNumber,
        parentId: pickedParent?.id ?? null,
        accountType: form.accountType,
        statementClassification: form.statementClassification,
        /* The block of numbers a summary reserves. An emptied range clears the
           reservation rather than keeping the old one: the reader deleted the
           numbers, which is the only way to say "no block". */
        ...rangeFromForm,
        subType: form.subType || undefined,
        isContra: derivedContra,
        normalBalance: deriveNormalBalance(form.accountType, derivedContra),
        subsidiaryId: form.subsidiaryId,
        currencyCode: form.currencyCode,
        /* Status is absent from the patch and applied below instead. It is not
           a field on the account so much as the outcome of a lifecycle plan,
           which holds back a summary while accounts under it are not as far
           along and a posting account with open entries. Patched straight in it
           would bypass both gates; run as the plan, this field and the Actions
           menu refuse the same accounts. */
        effectiveDate: form.effectiveDate,
        defaultDimensionValues: form.defaultDimensionValues,
        description: form.description,
        restricted: form.restricted,
        restrictedAccess: form.restricted && form.restrictedAccess.length ? form.restrictedAccess : undefined,
        bankAccountType: form.bankAccountType || undefined,
        creditLimit: form.creditLimit || undefined,
        bankName: form.bankName || undefined,
        selectedInstitutionId: form.selectedInstitutionId || undefined,
        bankAccountTitle: form.bankAccountTitle || undefined,
        bankNickname: form.bankNickname || undefined,
        bankRouting: form.bankRouting,
        bankAccountNumber: form.bankAccountNumber,
      }
      // Staged flows (Build-from-scratch, Guided setup) hold their edits in a
      // local list, not the store, so route the update through onCreate - keeping
      // the account's id and any setup metadata - instead of store.updateAccount.
      if (staged && onCreate) {
        // Nothing has posted to a staged account and there is no store to run a
        // plan against, so the status travels with the rest of the edits.
        const saved = { ...editAccount, ...edits, status: form.status, updatedAt: new Date().toISOString() }
        maybeAddPartner()
        onCreate(saved)
        onClose()
        return
      }
      /* The status first, because it is the one edit the store can refuse. Its
         refusal is the same sentence the Actions menu shows, put on the field
         that asked for it, and nothing is saved past it. */
      if (form.status !== editAccount.status) {
        /* And what it *does* is confirmed before it is done, in the dialog the
           status chip and the Actions menu already raise. Mahad, 2026-09-24:
           *"when we do this same thing in the edit flow, we don't get anything,
           so it should appear in the edit flow as well."* The field shadows a
           menu action, so it cannot be the one way in that takes an account out
           of service without saying what that means.

           Asked here, at Save, rather than when the reader picks Inactive: the
           form writes nothing until Save, so a dialog at the pick would be
           confirming something that had not happened yet - and Cancel would
           have had to undo a field the reader had just set. Cancel here leaves
           the form exactly as it was, with the save not made.

           `allowed` first, because a refused plan still carries a confirm: the
           lines describing what deactivating does exist whether or not this
           account may be. A refusal belongs on the field, which is where the
           store's answer below puts it. */
        const action = actionToward(form.status, editAccount.status)
        const plan = action && planLifecycle(action, editAccount, lifecycleCtx(store))
        if (plan && plan.allowed && plan.confirm && !statusAckRef.current) {
          setStatusConfirm({ action: plan.action, spec: plan.confirm })
          return
        }
        const change = form.status === 'Active'
          ? store.activateAccount(editAccount.id)
          : store.deactivateAccount(editAccount.id)
        if (!change.ok) {
          setErrors(e => ({ ...e, status: change.error ?? 'This account cannot change status.' }))
          // Save can be pressed from the preview, where the field the message
          // belongs to is two steps back.
          setStep('details')
          return
        }
        // The answer was to this change. A reader who keeps the form open and
        // turns the account back on is being asked about a different one.
        statusAckRef.current = false
      }
      store.updateAccount(editAccount.id, edits)
      maybeAddPartner()
      store.pushToast(`${form.accountName} updated successfully`, 'success')
      onClose()
      return
    }

    if (staged && onCreate) {
      maybeAddPartner()
      const built = buildAccount(input)
      onCreate(built)
      onClose()
      return
    }
    const created = store.createAccount(input)
    store.pushToast(`${created.accountName} created successfully`, 'success')
    maybeAddPartner()
    onClose()
    navigate(`/chart-of-accounts/${created.id}`)
  }

  const onSave = () => {
    const errs = validate()
    setErrors(errs)
    if (dupError || Object.keys(errs).length > 0) return
    // Bank / Credit Card accounts: offer to also register them as a Partner
    // before creating. Shown once per create session; the next press proceeds.
    if (!isEdit && partnerPromptKind && !partnerAckRef.current) {
      setPartnerPromptOpen(true)
      return
    }
    doCreate()
  }

  // Called when the "Set up as partner" gate resolves (created / skipped /
  // linked). Records the acknowledgement and continues the create path.
  const proceedAfterPartner = () => {
    partnerAckRef.current = true
    setPartnerPromptOpen(false)
    doCreate()
  }

  // Advance from the GL account details step. Only the fields that step owns are
  // gated here - bank fields are entered on a later step - so whatever comes
  // next in the list is where a valid form lands.
  /* Each gate says whether its step may be left, showing its errors when not.
     Shared by Continue and by a click on a step tab ahead, so the tabs are never
     a way round a check Continue makes. */
  /* The error standard (decision 120; module review, 2026-10-06, COA-28): a
     step that won't move on says what is wrong and how many things are, in one
     summary that stays on screen until each is fixed, and takes the reader to
     the first. `attemptedStep` is the step Continue (or Create) was refused on;
     the list is read from what the fields show, so it shrinks as they are fixed. */
  const [attemptedStep, setAttemptedStep] = useState<WizardStep | null>(null)
  const textOfRangeError = rangeParsed.kind === 'error' && reservesBlock ? rangeParsed.error : placementOnRange && placement ? problemText(placement) : null
  const stepProblems = (at: WizardStep): string[] => {
    if (at === 'details') {
      const infoErrs = Object.entries(errors).filter(([k]) => !isBankingErrorKey(k) && k !== 'defaultDimensionValues').map(([, v]) => v)
      const numberMsg = dupError ?? (placement && !placementOnRange ? problemText(placement) : null)
      return [...(numberMsg ? [numberMsg] : []), ...(textOfRangeError ? [textOfRangeError] : []), ...infoErrs.filter(m => m !== numberMsg)]
    }
    if (at === 'banking') return Object.entries(errors).filter(([k]) => isBankingErrorKey(k)).map(([, v]) => v)
    if (at === 'dimensions') return dimensionsPass ? [] : [DEFAULT_VALUE_REQUIRED]
    return []
  }
  /* The message under each field in error, in the order the form shows them.
     Read from the page rather than kept in a list, because the two layouts
     (compact and Full view) put the same fields in a different order. Retest,
     2026-10-07: the jump took the red asterisk of a required label for an
     error - a label holds nothing to focus, so focus stayed on Continue - and
     the summary listed number, name, type while the form read type, name,
     number. Field errors carry `data-field-error`; a step whose messages are
     drawn another way (the dimension defaults) falls back to its red text. */
  const fieldErrorsShown = (): HTMLElement[] => {
    const body = '[data-create-step-body]'
    const tagged = [...document.querySelectorAll<HTMLElement>(`${body} [data-field-error]`)]
    const list = tagged.length ? tagged : [...document.querySelectorAll<HTMLElement>(`${body} p.text-danger-600, ${body} p.text-danger-700`)]
    return list.filter(el => !el.closest('[data-step-summary]'))
  }
  const refuse = (at: WizardStep) => {
    setAttemptedStep(at)
    window.setTimeout(() => {
      const first = fieldErrorsShown()[0]
      jumpToError(first?.parentElement ?? null)
    }, 0)
  }
  const detailsPasses = () => {
    const errs = validate()
    const infoErrs = Object.fromEntries(Object.entries(errs).filter(([k]) => !isBankingErrorKey(k) && k !== 'defaultDimensionValues'))
    setErrors(infoErrs)
    /* The range is held here rather than at the end. It is the one field on this
       step whose error comes from outside the form - another summary already
       reserves the numbers - so it is not in `validate()`, and without this the
       reader walks on to a review of a change the Save button will refuse. */
    return !(dupError || rangeError || numberRangeError || Object.keys(infoErrs).length > 0)
  }
  const goFromDetails = () => {
    if (!detailsPasses()) { refuse('details'); return }
    setStep(stepAfter('details'))
  }

  /* Save from the bank-details-only modal. Gated on the bank fields alone: the
     rest of the account came off the chart and the reader was never shown it, so
     an error they cannot see and have no way to reach would be a dead end. The
     one field they might have broken is the account number, and that is a bank
     field. */
  const saveBankDetails = () => {
    const errs = validate()
    const bankErrs = Object.fromEntries(Object.entries(errs).filter(([k]) => isBankingErrorKey(k)))
    setErrors(bankErrs)
    if (Object.keys(bankErrs).length > 0) return
    doCreate()
  }

  // Advance from the Bank details step once the bank fields (and the inline
  // partner section, if enabled) validate.
  const bankingPasses = () => {
    const errs = validate()
    const bankErrs = Object.fromEntries(Object.entries(errs).filter(([k]) => isBankingErrorKey(k)))
    setErrors(bankErrs)
    return Object.keys(bankErrs).length === 0
  }
  const goFromBanking = () => {
    if (!bankingPasses()) { refuse('banking'); return }
    setStep(stepAfter('banking'))
  }

  /* A click on a step tab. Back is always open. Forward reaches any step already
     been through - Mahad, 2026-10-01: *"we should be able to navigate from there
     as well because I've already filled out everything in the previous step"* -
     but only through the gates Continue would pass, so a step changed since and
     no longer complete stops the walk on itself, showing why. */
  const jumpTo = (target: WizardStep) => {
    const to = wizardSteps.indexOf(target)
    if (step === 'classification' && to > stepIndex) confirmClassification()
    // An edit's steps are open at all times, and Save re-validates (see below).
    if (isEdit || to <= stepIndex) { setStep(target); return }
    for (let i = stepIndex; i < to; i++) {
      const at = wizardSteps[i]
      const ok = at === 'details' ? detailsPasses() : at === 'banking' ? bankingPasses() : at === 'dimensions' ? dimensionsPass : true
      if (!ok) { setStep(at); refuse(at); return }
    }
    setStep(target)
  }

  /* Dimensions are optional, but a dimension given two values or more must name
     its default, so the step holds until it does. */
  const dimensionsPass = missingDefaults(form.defaultDimensionValues).length === 0
  // The summary lists the problems in the order their fields sit on the page.
  const [fieldOrder, setFieldOrder] = useState<string[]>([])
  useLayoutEffect(() => {
    if (attemptedStep !== step) return
    const order = fieldErrorsShown().map(el => el.textContent ?? '')
    setFieldOrder(prev => (prev.length === order.length && prev.every((t, i) => t === order[i]) ? prev : order))
  })
  // A range message is drawn with its figures marked up, so its text is matched loosely.
  const placeOf = (msg: string) => {
    const i = fieldOrder.findIndex(t => t === msg || (!!t && (t.includes(msg) || msg.includes(t))))
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  const shownProblems = attemptedStep === step
    ? stepProblems(step).map((p, i) => ({ p, i })).sort((a, b) => placeOf(a.p) - placeOf(b.p) || a.i - b.i).map(x => x.p)
    : []
  const stepSummary = shownProblems.length > 0 && (
    <div data-step-summary>
      <Banner tone="danger" title={`${shownProblems.length} ${shownProblems.length === 1 ? 'issue' : 'issues'}`}>
        <ul className="mt-1.5 space-y-1 list-disc pl-4 marker:text-danger-400">
          {shownProblems.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      </Banner>
    </div>
  )

  // Continue routes to whichever gate the current step owns. Classification is a
  // single pre-selected choice, so it has nothing to validate.
  const goNext = () => {
    if (step === 'classification') { confirmClassification(); setStep('details'); return }
    if (step === 'details') { goFromDetails(); return }
    if (step === 'banking') { goFromBanking(); return }
    // The editor says which dimension still needs its default.
    if (step === 'dimensions' && !dimensionsPass) { refuse('dimensions'); return }
    setStep(stepAfter(step))
  }

  // Final "Create account" from the Preview step. Re-validates everything and,
  // on error, jumps back to the step that owns the first problem.
  const onCreateFinal = () => {
    const errs = validate()
    setErrors(errs)
    if (dupError || Object.keys(errs).length > 0) {
      const keys = Object.keys(errs)
      if (!dupError && keys.length === 1 && keys[0] === 'defaultDimensionValues' && wizardSteps.includes('dimensions')) {
        setStep('dimensions'); refuse('dimensions')
      } else if (isBankSub && keys.some(isBankingErrorKey) && !keys.some(k => !isBankingErrorKey(k))) {
        setStep('banking'); refuse('banking')
      } else {
        setStep('details'); refuse('details')
      }
      return
    }
    doCreate()
  }

  // ── Partner-style step tabs, across the header of both the create and the edit ──
  const stepTabs = (
    <div className="flex items-center gap-6 overflow-x-auto">
      {wizardSteps.map((id, i) => {
        const active = step === id
        const completed = i < stepIndex
        /* A step ahead of the current one is closed on a create, where it would
           be a preview of an account that has no name yet. An edit has no such
           state - every field opens holding the saved account's value, and the
           review step has something to diff from the first moment - so Mahad,
           2026-09-24: *"Only while editing an account, please make sure that the
           modal steppers are clickable at all times."*

           It costs nothing to allow: Save re-validates and lands the reader back
           on the step that owns the first problem, so reaching Review changes
           past a bad number is a look rather than a way around the gate. */
        /* On a create, any step already reached stays open - forward too, through
           the same gates Continue uses (`jumpTo`). Mahad, 2026-10-01. */
        const reachable = isEdit || i <= Math.max(furthest, stepIndex)
        return (
        <button
          key={id}
          type="button"
          disabled={!reachable}
          aria-current={active ? 'step' : undefined}
          className={cn('relative flex items-center gap-2 pb-3', reachable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50')}
          onClick={() => jumpTo(id)}
        >
          <div
            className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[12px] shrink-0 transition-all duration-200',
              completed ? 'bg-emerald-500 text-white' : active ? 'bg-primary text-white' : 'border-[1.5px] border-slate-300 text-slate-500 bg-white')}
            style={{ fontWeight: 600 }}
          >
            {completed ? <Check className="w-3 h-3" /> : i + 1}
          </div>
          <span
            className={cn('text-[13px] whitespace-nowrap transition-colors', active ? 'text-primary' : completed ? 'text-emerald-500' : 'text-slate-700')}
            style={{ fontWeight: active || completed ? 600 : 500 }}
          >
            {id === 'banking' && isCardSub ? CARD_BANKING_STEP_LABEL
              : id === 'preview' && isEdit ? EDIT_PREVIEW_STEP_LABEL
                : STEP_LABEL[id]}
          </span>
          {(active || completed) && (
            <div className={cn('absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full', completed ? 'bg-emerald-500' : 'bg-primary')} />
          )}
        </button>
        )
      })}
    </div>
  )

  // Normal balance is now user-set on the form; contra status is derived from it
  // (opposite side to the category's natural balance). Used in the Preview list
  // and written back on save so downstream contra badges stay accurate.
  const derivedContra = deriveContra(form.accountType, form.normalBalance)

  // ── Step 1: classification - the GAAP category, as cards. Mirrors the Cash
  // Management "What account are you adding?" step: one decision per screen,
  // with everything it implies (statement, normal balance) derived. ──
  const classificationStep = (
    <div className="p-6">
      {/* Create only. An edit has no classification step: the two questions move
          down onto Details, where they are stated when the account is in use and
          asked when it is not. The subtitle that used to stand here on an edit -
          "the category is set when the account is created, delete the account
          and create it again" - went with the step. */}
      <div className="mb-3 sm:mb-4">
        <h2 className="text-base mb-1 text-fg" style={{ fontWeight: 600 }}>
          What kind of account is this?
        </h2>
        <p className="text-[12px] text-slate-500">
          Sets which statement the account appears on, and its normal balance.
        </p>
      </div>

      {requestParent && (
        <Banner tone="info" className="mb-3" title={`Set by ${requestParent.accountNumber} · ${requestParent.accountName}.`}>
          {isCategoryRoot(requestParent)
            ? 'An account sits in the same category as the summary it hangs under. Which statement line it prints on is still yours to choose, because a category anchor spans the whole category.'
            /* The line is a default, not a lock: decision 3, and Mahad,
               2026-10-09 - *"the Statement Classification should remain
               editable"*. Picking another is flagged as an override. */
            : `An account sits in the same category as the summary it hangs under. It starts on its statement classification, ${requestParent.statementClassification.toLowerCase()}, and you can pick another line.`}
        </Banner>
      )}

      <div className={cn('grid', CHOICE_GRID_GAP)} style={{ gridTemplateColumns: CHOICE_GRID_COLUMNS }}>
        {(Object.keys(ACCOUNT_TYPE_META) as AccountCategory[]).map(t => (
          <CategoryCard
            key={t}
            category={t}
            selected={form.accountType === t}
            // Settled by where the create was started: a summary's category, or
            // the category a row was added in. See `categoryFixed`.
            locked={categoryFixed}
            onSelect={() => {
              setParentPick('')
              setForm(f => ({ ...f, accountType: t, statementClassification: defaultClassificationForCategory(t), subType: '', normalBalance: deriveNormalBalance(t), accountRole: '' }))
            }}
          />
        ))}
      </div>

      {/* The second question, asked on the same screen as the first because it
          narrows it rather than following from it: the category says which
          statement, the classification says which line of it. The role list is
          then filtered by the answer, which is why both come before it. */}
      <div className="mt-5 pt-5 border-t border-border">
        {/* Given its own heading rather than a form label, because it is the
            step's second question and not a field hanging off the first. The
            sentence was the tooltip on an info icon; a reader deciding between
            two lines should not have to hover to be told what the choice does. */}
        <div className="mb-2.5">
          <h3 className="text-[13px] mb-0.5 text-fg" style={{ fontWeight: 600 }}>Statement classification</h3>
          <p className="text-[12px] text-slate-500">
            Which line of the statement this account prints on. It also narrows the account roles on offer.
          </p>
        </div>
        {/* Locked the way the category above it is locked: the same cards, dimmed,
            with the settled one ticked. It was a disabled input with a padlock,
            which made the step's two questions answer in two different shapes -
            and a reader who cannot change the line still gains from seeing which
            line was taken and what the alternative was. */}
        <div className={cn('grid', CHOICE_GRID_GAP)} style={{ gridTemplateColumns: CHOICE_GRID_COLUMNS }}>
          {CLASSIFICATIONS_BY_CATEGORY[form.accountType].map(c => {
            // Read off the lock rather than the form when there is one: the
            // effect that holds the form to it runs after this paint, and a grid
            // of dimmed cards with none ticked reads as a failure to load.
            const active = (classificationLock?.value ?? form.statementClassification) === c
            // The role this line names outright, and so fills in on the next
            // step. Said on the card, because a field that answers itself
            // without warning reads as a bug.
            const named = roleNamedByClassification(c)
            return (
              <button
                key={c}
                type="button"
                disabled={!!classificationLock}
                onClick={() => pickClassification(c)}
                aria-pressed={active}
                className={cn(choiceShell(active, !!classificationLock), 'flex items-start gap-2.5 h-full px-3 py-2.5')}
              >
                <span className="mt-px shrink-0 flex"><ChoiceTick selected={active} locked={!!classificationLock} sm /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-fg break-words" style={{ fontWeight: active ? 600 : 500 }}>{c}</span>
                  <span className="block text-[11px] text-[#94A3B8] mt-0.5 leading-relaxed break-words">{CLASSIFICATION_DESCRIPTIONS[c]}</span>
                  {named && (
                    <span className="mt-1.5 inline-flex items-center px-1.5 py-px rounded-md border border-border bg-bg-subtle text-[10px] text-fg-muted" style={{ fontWeight: 600 }}>
                      Account role: {named}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  // ── Step 2, upper block: the structural GL account type and everything scoped
  // to it (normal balance, the bank checkbox, the role, the parent). ──
  const glTypeBlock = (
    <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 items-start">
          {/* The two questions a create opens with, on an edit. They are asked
              here in the shape every other settled field on this step takes -
              the value, greyed, with a padlock - rather than as the create's
              card grids: Mahad, 2026-09-22, *"locked fields must remain visible
              but explicitly grayed out / read-only ... rather than hidden or
              replaced with custom text."* A grid of dimmed cards is a way of
              asking, and an account already in use is not being asked.

              Live when the account is not in use, because then it is a real
              question again - see `categoryLock` and `classificationLock`. */}
          {isEdit && (
            <div>
              {categoryLock ? (
                <LockedField label="GL account category" why={categoryLock.why}>
                  <span className="truncate">{ACCOUNT_TYPE_META[form.accountType].label}</span>
                </LockedField>
              ) : (
                <Select
                  label="GL account category"
                  openDown
                  value={form.accountType}
                  onChange={e => {
                    const t = e.target.value as AccountCategory
                    // The parent goes with it, exactly as on a create: the
                    // summaries on offer are the new category's, and the one
                    // held is the old category's.
                    setParentPick('')
                    parentTouchedRef.current = false
                    setForm(f => ({ ...f, accountType: t, statementClassification: defaultClassificationForCategory(t), subType: '', normalBalance: deriveNormalBalance(t), accountRole: '' }))
                  }}
                >
                  {(Object.keys(ACCOUNT_TYPE_META) as AccountCategory[]).map(t => (
                    <option key={t} value={t}>{ACCOUNT_TYPE_META[t].label}</option>
                  ))}
                </Select>
              )}
            </div>
          )}

          {isEdit && (
            <div>
              {classificationLock ? (
                <LockedField label="Statement classification" info={CLASSIFICATION_INFO} why={classificationLock.why}>
                  <span className="truncate">{classificationLock.value}</span>
                </LockedField>
              ) : (
                <Select
                  label="Statement classification"
                  info={CLASSIFICATION_INFO}
                  required
                  openDown
                  value={form.statementClassification}
                  onChange={e => pickClassification(e.target.value as StatementClassification)}
                  error={errors.statementClassification}
                >
                  {CLASSIFICATIONS_BY_CATEGORY[form.accountType].map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              )}
            </div>
          )}

          {/* Left column: the structural role - Posting or Summary, and the two
              cases where it is not a question. See `glTypeLock`. */}
          <div>
            {glTypeLock ? (
              <LockedField label="GL account type" info={GL_TYPE_TOOLTIP} infoRich why={glTypeLock.why}>
                {glTypeLock.value}
              </LockedField>
            ) : (
              <Select
                label="GL account type"
                info={GL_TYPE_TOOLTIP}
                infoRich
                required
                openDown
                placeholder="Select type"
                value={form.glAccountType}
                onChange={e => setForm(f => ({ ...f, glAccountType: e.target.value as GLAccountType | '' }))}
                error={errors.glAccountType}
              >
                {glTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            )}
          </div>

          {/* Normal balance - the companion field for a Posting account's side,
              prefilled from the category (Asset/Expense → Debit; Liability/
              Equity/Revenue → Credit). Once a role is chosen it locks: the role
              fixes the category and the category fixes the side, so every
              account of a role has to agree. Contra is derived, never entered,
              and so is unreachable while a role is set.
              A Summary has no side, so this cell is not rendered at all rather
              than left standing empty - otherwise Parent would skip to the far
              side of the row with a hole where the side would have been.

              Locked a second way once entries have posted: they went on one
              side, and which side is half of what each of them says. See
              `posted`. */}
          {form.glAccountType === 'Posting' && (
            <div>
              {posted || form.accountRole ? (
                <>
                  {/* The padlock carries why this one is settled, and the two
                      locks have different answers. */}
                  <LockedField
                    label="Normal balance"
                    info={<NormalBalanceHelp />}
                    infoRich
                    why={posted ? 'Entries have posted to this account on this side, so it cannot be changed.' : 'Determined by the selected account role and cannot be changed.'}
                  >
                    {form.accountRole ? normalBalanceForRole(form.accountRole) : form.normalBalance}
                  </LockedField>
                  {!posted && <p className="text-2xs text-slate-400 mt-1.5">Set by the account role. Locked.</p>}
                </>
              ) : (
                <Select
                  label="Normal balance"
                  info={<NormalBalanceHelp />}
                  infoRich
                  openDown
                  value={form.normalBalance}
                  onChange={e => setForm(f => ({ ...f, normalBalance: e.target.value as Account['normalBalance'] }))}
                >
                  {(['Debit', 'Credit'] as const).map(side => (
                    <option key={side} value={side}>
                      {deriveContra(form.accountType, side)
                        ? <span className="inline-flex items-center gap-2">{side}<Badge tone="info">Contra</Badge></span>
                        : side}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          )}

          {/* Parent - the summary account this one hangs under. Structure is
              declared here, not inferred from the number, so on a create this is
              the control that actually places the account on the chart. On an
              edit it states where the account already sits - see `parentLock`.
              Hidden only when the ＋ on a summary already named the parent in the
              act of opening the form. */}
          {!parentAccount && !!form.glAccountType && (parentLock || parentOptions.length > 0) && (
            <div>
              {parentLock ? (
                <>
                  <label className="label block mb-1.5">Parent</label>
                  <div className="input flex items-center justify-between gap-2 bg-bg-subtle/60 text-fg-muted cursor-default select-none">
                    <span className="truncate">{parentLock.value}</span>
                    <Lock size={13} className="shrink-0 text-fg-subtle/60" />
                  </div>
                </>
              ) : (
                <Select
                  label="Parent"
                  required
                  error={errors.parentGroup}
                  info="Select the summary account under which this account will be created."
                  openDown
                  searchable
                  searchPlaceholder="Search summary accounts…"
                  menuMinWidth={460}
                  value={parentPick}
                  onChange={e => { parentTouchedRef.current = true; setParentPick(e.target.value) }}
                >
                  {parentOptions.map(a => (
                    <option key={a.id} value={a.id} data-depth={chartIndex.depthOf(a.id)}>
                      {a.accountNumber} · {a.accountName}
                    </option>
                  ))}
                </Select>
              )}
              {overrideNote && <p data-classification-override className="text-2xs text-warning-700 mt-1.5">{overrideNote}</p>}
            </div>
          )}

          {/* Account role - the account's recognized identity for other modules.
              Optional: it only matters to modules that need to single this account
              out. Bank and Credit Card are two of the roles; picking one unlocks
              the bank details step.

              A dropdown, not a row of pills. Design review, 2026-09-24 - Eli:
              *"There is more than six here ... It's not going to be a pill. It's
              going to want to be a drop-down."* Each option carries its one-line
              description under the name, and nothing explains a role on hover,
              which Mahad took off the roles on 2026-09-21.

              A cell of the grid like every other field of the Type card. The menu
              is widened past the cell the way Parent's is, because the options
              carry a description line the column has no room for.

              PLACEHOLDER: the role list is settled next sprint. */}
          {roleApplies && (
            <div>
              {posted ? (
                /* Settled once anything has posted, in the shape every other
                   settled field takes: the value, greyed, with a padlock. What an
                   account is recognized as is what the modules reading it have
                   been treating its entries as. */
                <LockedField label="Account role" info={<RoleFieldTooltip />} infoRich why="Entries have posted to this account under this role, so it cannot be changed.">
                  {form.accountRole || 'No role'}
                </LockedField>
              ) : (
                <Select
                  label="Account role"
                  info={<RoleFieldTooltip />}
                  infoRich
                  searchable
                  openDown
                  menuMinWidth={460}
                  placeholder="Select a role"
                  searchPlaceholder="Search roles…"
                  value={form.accountRole}
                  onChange={e => pickRole(e.target.value as AccountRole | '')}
                >
                  {/* The way back out: a role is optional, and an ordinary
                      account carries none. */}
                  <option value="" data-desc="An ordinary account. Nothing outside the ledger treats it specially.">No role</option>
                  {(roleOptions as AccountRole[]).map(r => (
                    <option key={r} value={r} data-desc={ACCOUNT_ROLE_DESCRIPTIONS[r]}>{r}</option>
                  ))}
                </Select>
              )}
            </div>
          )}
        </div>

        {isSummaryType && (
          <NumberRangeCard
            reserving={reserving}
            onReservingChange={toggleReserving}
            startValue={form.numberRangeStart}
            endValue={form.numberRangeEnd}
            onChange={(a, b, how) => { rangeTouchedRef.current = how === 'typed'; setForm(f => ({ ...f, numberRangeStart: a, numberRangeEnd: b })) }}
            parent={pickedParent ?? null}
            offer={offer}
            error={rangeError}
          />
        )}

    </div>
  )

  /* What saving will change, field by field, with both sides of each. This is
     the last step of an edit, in place of the placement preview a create ends
     on: an account being edited already sits where it sits, and drawing its
     branch again answers a question nobody asked on the way here.

     Every field the save writes is compared, not a chosen few - a diff that
     missed one would report "nothing has changed" over an edit that had, and
     take the Save button with it. */
  const editChanges = (() => {
    if (!editAccount) return []
    const range = (a: Pick<Account, 'numberRangeStart' | 'numberRangeEnd'>) => {
      const r = accountRange(a)
      return r ? formatRange(r) : 'Not set'
    }
    const dims = (vals: { dimensionId: string; value: string }[]) => vals
      .map(v => `${store.dimensions.find(d => d.id === v.dimensionId)?.name ?? v.dimensionId}: ${v.value}`)
      .sort().join(', ') || 'None'
    const text = (v: string | undefined | null) => (v ?? '').toString().trim() || 'Not set'
    /* Raw, not `displayAccountNumber`: a scheme showing one segment can render
       two different numbers the same, and this row exists to say they differ.
       It is also what the field the reader typed in holds. */
    const named = (a: Account | null | undefined) => (a ? `${a.accountNumber} · ${a.accountName}` : 'None')
    const rows: { label: string; from: string; to: string }[] = [
      { label: 'GL account no.', from: editAccount.accountNumber, to: form.accountNumber.trim() },
      { label: 'GL account name', from: editAccount.accountName, to: form.accountName.trim() },
      { label: 'GL account category', from: ACCOUNT_TYPE_META[editAccount.accountType].label, to: ACCOUNT_TYPE_META[form.accountType].label },
      { label: 'Parent', from: named(existingParent), to: named(pickedParent) },
      { label: 'Statement classification', from: editAccount.statementClassification, to: form.statementClassification },
      ...(isSummaryType ? [{ label: 'Number range', from: range(editAccount), to: range(rangeFromForm) }] : []),
      ...(roleApplies ? [
        { label: 'Account role', from: text(editAccount.accountRole), to: text(form.accountRole) },
        { label: 'Normal balance', from: editAccount.normalBalance, to: deriveNormalBalance(form.accountType, derivedContra) },
      ] : []),
      { label: 'Currency', from: editAccount.currencyCode, to: form.currencyCode },
      { label: 'Status', from: editAccount.status, to: form.status },
      { label: 'Restricted', from: editAccount.restricted ? 'Yes' : 'No', to: form.restricted ? 'Yes' : 'No' },
      { label: 'Who has access', from: accessText(editAccount.restricted ? editAccount.restrictedAccess : undefined), to: accessText(form.restricted ? form.restrictedAccess : undefined) },
      { label: 'Description', from: text(editAccount.description), to: text(form.description) },
      ...(isBankSub ? [
        { label: isCardSub ? 'Card issuer' : 'Bank name', from: text(editAccount.bankName), to: text(form.bankName) },
        { label: isCardSub ? 'Card type' : 'Bank account type', from: text(editAccount.bankAccountType), to: text(form.bankAccountType) },
        { label: 'Account title', from: text(editAccount.bankAccountTitle), to: text(form.bankAccountTitle) },
        { label: 'Nickname', from: text(editAccount.bankNickname), to: text(form.bankNickname) },
        { label: 'Routing number', from: text(editAccount.bankRouting), to: text(form.bankRouting) },
        { label: isCardSub ? 'Card number' : 'Bank account number', from: text(editAccount.bankAccountNumber), to: text(form.bankAccountNumber) },
        ...(isCardSub ? [{ label: 'Credit limit', from: text(editAccount.creditLimit), to: text(form.creditLimit) }] : []),
      ] : []),
      ...(availableDimensions.length > 0 && !isSummaryType
        ? [{ label: 'Dimension defaults', from: dims(editAccount.defaultDimensionValues ?? []), to: dims(form.defaultDimensionValues) }]
        : []),
    ]
    return rows.filter(r => r.from !== r.to)
  })()

  const editPreviewStep = (
    <div className="p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-fg">{EDIT_PREVIEW_STEP_LABEL}</h3>
        <p className="text-xs text-fg-muted mt-0.5">
          What saving will change on <span className="text-fg" style={{ fontWeight: 600 }}>{editAccount ? `${displayAccountNumber(activeScheme, editAccount.accountNumber)} · ${editAccount.accountName}` : ''}</span>.
        </p>
      </div>

      {editChanges.length === 0 ? (
        /* Reachable from the moment the form opens, now that an edit's steps are
           all pressable - so this is the first thing a reader sees about as often
           as it is the last. Framed, because it stands where the table of changes
           would, and pointed back at Details, because that is where a change gets
           made. */
        <EmptyState
          framed
          icon={<PencilLine size={20} />}
          title="No changes to review"
          description="This account still matches what was saved, so there is nothing to compare and nothing to save."
          action={
            <Button variant="secondary" size="sm" icon={<ArrowLeft size={14} />} onClick={() => setStep('details')}>
              Back to details
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-white overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-bg-subtle/50">
                <th className="h-9 px-4 text-left align-middle font-normal text-muted-foreground whitespace-nowrap w-[200px]">Field</th>
                <th className="h-9 px-4 text-left align-middle font-normal text-muted-foreground whitespace-nowrap">Current</th>
                <th className="h-9 px-4 text-left align-middle font-normal text-muted-foreground whitespace-nowrap">New</th>
              </tr>
            </thead>
            <tbody>
              {editChanges.map((c, i) => (
                <tr key={c.label} className={cn(i > 0 && 'border-t border-border')}>
                  <td className="px-4 py-3 align-top text-[13px] text-fg" style={{ fontWeight: 500 }}>{c.label}</td>
                  <td className="px-4 py-3 align-top text-[13px] text-slate-400 line-through whitespace-pre-wrap break-words">{c.from}</td>
                  <td className="px-4 py-3 align-top text-[13px] text-fg whitespace-pre-wrap break-words" style={{ fontWeight: 600 }}>{c.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  // ── Final step of a create: placement preview - the branch of the Chart of
  // Accounts the new account lands on. What rows that is, and the counts for
  // what the window leaves out, are `placementPreview`; this step only paints
  // them. ──
  const previewStep = (() => {
    // A synthetic stand-in for the account being placed, carrying whatever has
    // been typed so far.
    const draft = {
      id: DRAFT_ID,
      accountNumber: form.accountNumber || '',
      accountName: form.accountName || 'New account',
      accountType: form.accountType,
      glAccountType: form.glAccountType as GLAccountType,
      currencyCode: form.currencyCode,
      status: form.status,
      statementClassification: form.statementClassification,
    } as Account

    /* Editing shows the children the account already has, one level in under it. */
    const { rows } = placementPreview({
      index: chartIndex,
      draft,
      parent: pickedParent ?? null,
      exclude: [editAccount?.id].filter((id): id is string => !!id),
      held: isEdit && editAccount ? chartIndex.childrenOf(editAccount.id) : [],
    })

    const numberText = (a: Account) => displayAccountNumber(activeScheme, a.accountNumber)
    const badgeFor = (a: Account) =>
      a.id === DRAFT_ID ? <><Badge tone="brand" className={cn(PARTNER_CHIP_CLS, 'shrink-0')}>{isEdit ? 'This account' : 'New'}</Badge>{form.restricted && <Badge tone="warning" className={cn(PARTNER_CHIP_CLS, 'shrink-0')}>Restricted</Badge>}</>
        : undefined
    const previewRows: PreviewRow[] = rows.map(r => r.account
      ? { ...r, highlight: r.account.id === DRAFT_ID, badge: badgeFor(r.account) }
      : r)

    return (
      <div className="p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-fg">Placement preview</h3>
          <p className="text-xs text-fg-muted mt-0.5">
            Where <span className="text-fg" style={{ fontWeight: 600 }}>{form.accountName || 'your new account'}</span> {isEdit ? 'appears' : 'will appear'} in your Chart of Accounts in <span className="text-fg" style={{ fontWeight: 600 }}>{form.statementClassification}</span>.{classificationOverride && <> <span data-classification-override className="text-warning-700">An override: its parent is {parentClassification!.toLowerCase()}.</span></>}
          </p>
        </div>

        {/* No breadcrumb of the branch above the table: the table's own curved
            guides draw the same path. Mahad, 2026-10-01: *"Everywhere in the
            preview, can we remove this."* */}
        <PreviewChartTable
          rows={previewRows}
          columns={['number', 'name', 'glType', 'currency', 'status']}
          numberText={numberText}
        />
      </div>
    )
  })()

  // ── Section 2, item 9: context panel - where the account lands in the tree
  // (category / section / the parent it hangs under) plus a live single-row
  // preview of the account before confirm. Used by variants 2–4. ──
  const contextPanel = (
    <div className="rounded-xl border border-border bg-white p-4 space-y-3">
      <h3 className="text-sm font-semibold text-fg">Where this account lands</h3>
      <div className="text-[13px] text-slate-600 space-y-1.5">
        <div>Category <span className="text-fg" style={{ fontWeight: 600 }}>{ACCOUNT_TYPE_META[form.accountType].label}</span> · Statement classification <span className="text-fg" style={{ fontWeight: 600 }}>{form.statementClassification}</span></div>
        {pickedParent ? (
          <div>Under <span className="text-fg" style={{ fontWeight: 600 }}>{pickedParent.accountNumber} · {pickedParent.accountName}</span></div>
        ) : (
          <div className="text-slate-400">Not under a summary account.</div>
        )}
      </div>
      {/* Live row preview */}
      <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 flex items-center gap-2 text-[13px]">
        <span className="tabular-nums text-brand-700 shrink-0" style={{ fontWeight: 600 }}>{form.accountNumber || '-'}</span>
        <span className="text-fg truncate min-w-0" style={{ fontWeight: 600 }}>{form.accountName || 'New account'}</span>
        {form.glAccountType && <Badge tone={GL_TYPE_TONE[form.glAccountType] ?? 'neutral'} className={cn(PARTNER_CHIP_CLS, 'shrink-0')}>{form.glAccountType}</Badge>}
        {form.restricted && <Badge tone="warning" className={cn(PARTNER_CHIP_CLS, 'shrink-0')}>Restricted</Badge>}
        <span className="ml-auto shrink-0"><StatusChip status={form.status} /></span>
      </div>
    </div>
  )

  // ── Section 2, items 6 & 7: the flat, spec-ordered form used by variants 2–4.
  // Field order top-to-bottom: number → name → optional description (collapsed)
  // → the four Posting questions in priority order (bank, contra, active,
  // currency-default) → currency → status. (Item 7 lists contra before bank as a
  // layout; item 6 fixes the *question* priority with bank first - we follow the
  // explicit item-6 priority order here.) A Summary branches to its block-end
  // input instead, since none of the four questions apply to it. ──
  const flatForm = (
    <div className="space-y-5">
      {/* Classify: GL account type (branches the flow) + category. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <Select
            label="GL account type"
            info={GL_TYPE_TOOLTIP}
            infoRich
            required
            searchable
            openDown
            placeholder="Select type"
            disabled={!!glTypeLock}
            value={glTypeLock ? glTypeLock.value : form.glAccountType}
            onChange={e => setForm(f => ({ ...f, glAccountType: e.target.value as GLAccountType | '' }))}
            error={errors.glAccountType}
          >
            {glTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          {form.glAccountType && GL_TYPE_DESCRIPTION[form.glAccountType] && (
            <p className="text-2xs text-slate-400 mt-1">{GL_TYPE_DESCRIPTION[form.glAccountType]}</p>
          )}
        </div>
        <Select
          label="GL account category"
          disabled={isEdit}
          value={form.accountType}
          onChange={e => { const t = e.target.value as AccountCategory; setForm(f => ({ ...f, accountType: t, statementClassification: defaultClassificationForCategory(t), subType: '', normalBalance: deriveNormalBalance(t), accountRole: '' })) }}
        >
          {(Object.keys(ACCOUNT_TYPE_META) as AccountCategory[]).map(t => <option key={t} value={t}>{ACCOUNT_TYPE_META[t].label}</option>)}
        </Select>
      </div>

      {/* Statement classification, asked after the category and before the role,
          because it is the category narrowed to a statement line and the role
          list is filtered by it. Locked when a summary above the account has
          already settled it - see `classificationLock`. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <Select
            label="Statement classification"
            info={CLASSIFICATION_INFO}
            required
            openDown
            disabled={!!classificationLock}
            value={classificationLock ? classificationLock.value : form.statementClassification}
            onChange={e => pickClassification(e.target.value as StatementClassification)}
            error={errors.statementClassification}
          >
            {CLASSIFICATIONS_BY_CATEGORY[form.accountType].map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          {/* What the chosen line means, which is the field's own value said in
              full - not an explanation of why it is locked. */}
          {!classificationLock && (
            <p className="text-2xs text-slate-400 mt-1">
              {CLASSIFICATION_DESCRIPTIONS[form.statementClassification]}
            </p>
          )}
        </div>
      </div>

      {/* Number → Name */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {numberLock ? (
          <div>
            <LockedField label="GL account no." why={numberLock.why}>
              <span className="truncate">{form.accountNumber}</span>
            </LockedField>
            {/* A stated field still has to say when its value is refused. The number
                is the range start rather than something typed, but it is the number
                the save will be given, so a clash with the chart holds the reader on
                this step - and a step that will not advance without saying why is a
                dead end. */}
            {numberError && <p data-field-error className="text-xs text-danger-600 mt-1">{numberError}</p>}
          </div>
        ) : (
          <div>
            <Input
              label="GL account no."
              required
              value={form.accountNumber}
              onChange={e => { setNumberTouched(true); setForm(f => ({ ...f, accountNumber: e.target.value })) }}
              onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
              error={numberError}
              placeholder={`e.g. ${categoryFirstNumber(form.accountType, numberWidth)}`}
              className={cn(numberError && 'border-danger-500 focus:border-danger-500')}
            />
            {numberLengthNote && <p data-number-length-warning className="text-2xs text-warning-700 mt-1.5">{numberLengthNote}</p>}
          </div>
        )}
        <Input
          label="GL account name"
          required
          value={form.accountName}
          onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))}
          placeholder="e.g. Office supplies"
          error={errors.accountName}
        />
      </div>

      {/* Optional description, collapsed by default */}
      <div>
        <button
          type="button"
          onClick={() => setDescOpen(o => !o)}
          className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:opacity-80"
          style={{ fontWeight: 500 }}
        >
          <ChevronRight size={14} className={cn('transition-transform', descOpen && 'rotate-90')} />
          {descOpen ? 'Hide description' : 'Add a description'} <span className="text-slate-400">(optional)</span>
        </button>
        {descOpen && (
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="What this account is used for"
            className="input px-3.5 py-2.5 resize-none min-h-[100px] mt-2"
          />
        )}
      </div>

      {/* Posting → four priority questions; Summary → what it totals. */}
      {form.glAccountType === 'Posting' ? (
        <div className="space-y-3">
          {/* Account role replaces the old "is this a bank account?" toggle: Bank
              and Credit Card are two of the roles, so one field covers both the
              classification and the reconciliation opt-in. */}
          <div className="flex items-start gap-3 rounded-xl border border-border bg-white px-3.5 py-3">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-accent text-primary text-[11px] flex items-center justify-center shrink-0" style={{ fontWeight: 600 }}>1</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-fg" style={{ fontWeight: 600 }}>Account role</div>
              {form.accountRole && (
                <p className="text-2xs text-slate-400 mt-0.5">{ACCOUNT_ROLE_DESCRIPTIONS[form.accountRole]}</p>
              )}
            </div>
            <div className="shrink-0 w-52 pt-0.5">
              <Select
                searchable
                openDown
                placeholder="Select a role…"
                searchPlaceholder="Search roles…"
                value={form.accountRole}
                onChange={e => pickRole(e.target.value as AccountRole | '')}
              >
                <option value="" data-desc="An ordinary account. Nothing outside the ledger treats it specially.">No role</option>
                {roleOptions.map(r => <option key={r} value={r} data-desc={ACCOUNT_ROLE_DESCRIPTIONS[r]}>{r}</option>)}
              </Select>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-white px-3.5 py-3">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-accent text-primary text-[11px] flex items-center justify-center shrink-0" style={{ fontWeight: 600 }}>2</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-fg flex items-center gap-1" style={{ fontWeight: 600 }}>
                Normal balance
                <Tooltip rich content={<NormalBalanceHelp />} side="top">
                  <span className="inline-flex cursor-help text-fg-subtle/60 hover:text-fg-subtle"><Info size={12} /></span>
                </Tooltip>
              </div>
              <p className="text-2xs text-slate-400 mt-0.5">
                {form.accountRole
                  ? `Locked by the ${form.accountRole} role, so every ${form.accountRole} account posts the same way.`
                  : `Pre-set from ${ACCOUNT_TYPE_META[form.accountType].label} (${deriveNormalBalance(form.accountType, false)}). Change it if this account posts the other way.`}
              </p>
            </div>
            {form.accountRole ? (
              <div className="shrink-0 flex items-center gap-1.5 pt-0.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-subtle/60 px-2.5 py-1 text-[12px] text-fg-muted select-none" style={{ fontWeight: 600 }}>
                  {normalBalanceForRole(form.accountRole)}
                  <Lock size={12} className="shrink-0 text-fg-subtle/60" />
                </span>
              </div>
            ) : (
              <div className="shrink-0 flex items-center gap-1.5 pt-0.5">
                {(['Debit', 'Credit'] as const).map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, normalBalance: opt }))}
                    aria-pressed={form.normalBalance === opt}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-[12px] transition-colors',
                      form.normalBalance === opt ? 'border-primary bg-primary/10 text-primary' : 'border-border text-fg hover:bg-bg-subtle/60',
                    )}
                    style={form.normalBalance === opt ? { fontWeight: 600 } : undefined}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
          <QuestionRow n={3} label="Is this account active?" hint="Inactive accounts stay in the chart but can't be posted to." checked={form.status === 'Active'} onChange={v => setForm(f => ({ ...f, status: v ? 'Active' : 'Inactive' }))} />
          {/* Read-only when the role can't hold its own currency: the toggle used
              to move off the base currency with no picker to follow it, leaving a
              non-base code set on an account that can't carry one. */}
          <QuestionRow
            n={4}
            label="Is the currency the default?"
            hint={currencyEditable ? `The default is ${store.company.baseCurrency}. Turn this off to choose another currency.` : CURRENCY_LOCKED_REASON}
            checked={form.currencyCode === store.company.baseCurrency}
            onChange={v => setForm(f => ({ ...f, currencyCode: v ? store.company.baseCurrency : (f.currencyCode === store.company.baseCurrency ? 'EUR' : f.currencyCode) }))}
            readOnly={!currencyEditable}
            readOnlyValue={store.company.baseCurrency}
          />
          {form.currencyCode !== store.company.baseCurrency && currencyEditable && (
            <div className="pl-8">
              <label className="label block mb-1.5">Currency</label>
              <CurrencyField value={form.currencyCode} onChange={code => setForm(f => ({ ...f, currencyCode: code }))} />
            </div>
          )}
          <div className="rounded-xl border border-border bg-white px-3.5 py-3">
            <div className="text-[13px] text-fg" style={{ fontWeight: 600 }}>Dimensions <span className="text-slate-400" style={{ fontWeight: 400 }}>(optional)</span></div>
            <p className="text-2xs text-slate-400 mt-0.5 mb-2.5">A journal line on this account starts on each dimension’s default value, and can switch to the account’s others.</p>
            <DimensionDefaultsEditor
              dimensions={availableDimensions}
              value={form.defaultDimensionValues}
              onChange={next => setForm(f => ({ ...f, defaultDimensionValues: next }))}
              onAddValue={(id, v) => {
                const d = store.dimensions.find(x => x.id === id)
                if (d) store.updateDimension(id, { values: [...d.values, v] })
              }}
              onCreateDimension={draft => store.addDimension(draft)}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[13px] text-slate-500">{form.glAccountType && GL_TYPE_DESCRIPTION[form.glAccountType]}</p>
          <NumberRangeCard
            reserving={reserving}
            onReservingChange={toggleReserving}
            startValue={form.numberRangeStart}
            endValue={form.numberRangeEnd}
            onChange={(a, b, how) => { rangeTouchedRef.current = how === 'typed'; setForm(f => ({ ...f, numberRangeStart: a, numberRangeEnd: b })) }}
            parent={pickedParent ?? null}
            offer={offer}
            error={rangeError}
          />
        </div>
      )}

      {/* Banking details, revealed by the Bank / Credit Card role. A card is
          described by its issuer and limit; a bank account by its account type,
          so the two shapes ask for different things. */}
      {isBankSub && (
        <div className="rounded-xl border border-border bg-white p-4">
          <h3 className="text-sm font-semibold text-fg mb-3">{isCardSub ? 'Credit card details' : 'Banking details'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <BankInstitutionCombobox
              label={isCardSub ? 'Issuing bank' : 'Bank name'}
              required
              value={form.bankName}
              selectedInstitutionId={form.selectedInstitutionId || null}
              onSelectInstitution={inst => setForm(f => ({ ...f, bankName: inst.name, selectedInstitutionId: inst.id }))}
              onSelectCustom={name => setForm(f => ({ ...f, bankName: name, selectedInstitutionId: '' }))}
              error={errors.bankName}
              placeholder={isCardSub ? 'e.g. Capital One' : 'e.g. First National Bank'}
            />
            {isCardSub ? (
              <>
                <CreditLimitField value={form.creditLimit} onChange={v => setForm(f => ({ ...f, creditLimit: v }))} currency={form.currencyCode} error={errors.creditLimit} />
                <Input label="Card number" value={form.bankAccountNumber} onChange={e => setForm(f => ({ ...f, bankAccountNumber: e.target.value }))} error={errors.bankAccountNumber} placeholder="e.g. 4147 2029 1833 6" />
              </>
            ) : (
              <>
                <Input label="Account title" required value={form.bankAccountTitle} onChange={e => setForm(f => ({ ...f, bankAccountTitle: e.target.value }))} error={errors.bankAccountTitle} placeholder="Name on the account" />
                <BankAccountTypeCards value={form.bankAccountType} onChange={v => setForm(f => ({ ...f, bankAccountType: v }))} error={errors.bankAccountType} classification={form.statementClassification} />
                <Input label="Account number" required value={form.bankAccountNumber} onChange={e => setForm(f => ({ ...f, bankAccountNumber: e.target.value }))} error={errors.bankAccountNumber} placeholder="e.g. 4 to 17 digits" />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )

  // The footer used by the flat variants: single-page, so Create/Save appears
  // straight away (creation completes fully on confirm - Section 2, item 10).
  const flatFooter = (
    <>
      <Button variant="ghost" onClick={requestClose}>Cancel</Button>
      <Button onClick={onSave} disabled={!!dupError || !!rangeError || !!numberRangeError || !form.glAccountType || !form.accountName.trim() || !form.accountNumber.trim()}>
        {isEdit ? 'Save changes' : 'Create account'}
      </Button>
    </>
  )

  // ── Section 2, item 11: variants 2–4 render the flat spec form in three
  // different layouts. Variant 1 (and edit mode) fall through to the stepped
  // wizard below. ──
  if (activeVariant !== 1 && !isEdit) {
    const flatTitle = 'Create GL account'
    const flatSubtitle = 'Classify the account, answer the key questions, and preview where it lands.'
    let body: React.ReactNode
    if (activeVariant === 2) {
      // Single-scroll: form, then context panel beneath.
      body = <div className="p-6 space-y-5">{flatForm}{contextPanel}</div>
    } else if (activeVariant === 3) {
      // Two-pane: form on the left, context panel pinned on the right.
      body = (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 p-6">
          <div>{flatForm}</div>
          <div className="lg:sticky lg:top-2 h-fit">{contextPanel}</div>
        </div>
      )
    } else {
      // Variant 4 - compact: context / live preview strip on top, form beneath.
      body = <div className="p-6 space-y-5">{contextPanel}{flatForm}</div>
    }
    return (
      <>
        <FormModal open={open} onClose={requestClose} title={flatTitle} subtitle={flatSubtitle} footer={flatFooter}>
          {body}
        </FormModal>

        <SetUpAsPartnerModal
          open={partnerPromptOpen}
          onClose={() => setPartnerPromptOpen(false)}
          bankName={form.bankName}
          isCard={form.accountType === 'LIA'}
          onProceed={proceedAfterPartner}
        />

        <ConnectBankModal
          open={connectBankOpen}
          onClose={() => setConnectBankOpen(false)}
          initialBankName={form.bankName}
          selectedInstitutionId={form.selectedInstitutionId || undefined}
          accountType={form.bankAccountType}
          accountNumber={form.bankAccountNumber}
          accountTitle={form.bankAccountTitle}
          currencyCode={form.currencyCode}
          glAccountLabel={form.accountNumber && form.accountName ? `${form.accountNumber} · ${form.accountName}` : form.accountName || undefined}
          onConnected={() => setBankFeedConnected(true)}
        />

        <ConfirmModal
          open={discardOpen}
          tone="danger"
          badge="Discard"
          title="Discard account creation?"
          description={["All the information you’ve entered will be lost.", 'This action cannot be undone.']}
          confirmLabel="Discard changes"
          dismissLabel="Continue editing"
          onConfirm={() => { setDiscardOpen(false); onClose() }}
          onDismiss={() => setDiscardOpen(false)}
        />
      </>
    )
  }

  return (
    <>
    <FormModal
      open={open}
      onClose={requestClose}
      /* The wrap builds a summary, but that is how it does the job rather than
         what the reader came for - they came to move an account. So it is named
         for the action they picked, word for word: the menu item, the modal and
         the account's Actions menu all say the same thing. */
      title={bankOnly ? (isCardSub ? CARD_BANKING_STEP_LABEL : STEP_LABEL.banking)
        : isEdit ? 'Edit GL account' : 'Create GL account'}
      /* No subtitle on create: it only restated the step names sitting right
         below it. The bank-details modal names the account instead, because it
         is opened from a row and nothing else on it says which row. */
      subtitle={bankOnly
        ? (form.accountNumber && form.accountName ? `${form.accountNumber} · ${form.accountName}` : form.accountName || undefined)
        : isEdit ? 'Update the details and settings for this account.' : undefined}
      // One question, one screen: no trail to show and nothing to expand into.
      headerExtra={bankOnly ? undefined : stepTabs}
      hideFullView={bankOnly}
      /* The details step is the tallest thing here; at the shared 78vh cap it
         scrolls on a laptop, which puts Continue above fields nobody has seen.
         Every step is then held at that same height rather than sizing to its own
         content: dimensions is two lines and a chip, and letting the panel
         collapse to it moved Continue most of the way up the screen between one
         step and the next.

         Capped in pixels as well as in vh, the way WizardChrome caps itself. A
         plain 90vh is a promise about the viewport rather than about the form:
         on a tall monitor it drew a modal the height of the screen with the
         footer stranded hundreds of pixels below the last field. 760px is where
         the details step stops needing more.

         The bank-details modal takes neither. It is one short step with no
         siblings to stay level with, so it sizes to its content. */
      maxHeightClass={bankOnly ? undefined : 'sm:max-h-[min(90vh,760px)]'}
      fixedHeight={bankOnly ? undefined : 'sm:h-[min(90vh,760px)]'}
      footer={
        bankOnly ? (
          <>
            <Button variant="ghost" onClick={requestClose}>Cancel</Button>
            <Button onClick={saveBankDetails}>Save</Button>
          </>
        ) : step === 'preview' ? (
          <>
            {/* The empty state offers its own way back, and two buttons that do
                the same thing make the reader work out whether they do. The one
                inside the message wins, because it is the one that says why. */}
            {!(isEdit && editChanges.length === 0) && (
              <Button variant="ghost" className="mr-auto" icon={<ArrowLeft size={14} />} onClick={() => setStep(wizardSteps[stepIndex - 1])}>Back</Button>
            )}
            <Button variant="ghost" onClick={requestClose}>Cancel</Button>
            {/* An edit with nothing in it is not a save. The step says so above
                the button rather than leaving the reader to press it and watch
                a toast claim an update that wrote nothing. */}
            <Button onClick={onCreateFinal} disabled={!!dupError || !!rangeError || !!numberRangeError || !dimensionsPass || (isEdit && editChanges.length === 0)}>{isEdit ? 'Save changes' : 'Create account'}</Button>
          </>
        ) : (
          <>
            {stepIndex > 0 && <Button variant="ghost" className="mr-auto" icon={<ArrowLeft size={14} />} onClick={() => setStep(wizardSteps[stepIndex - 1])}>Back</Button>}
            <Button variant="ghost" onClick={requestClose}>Cancel</Button>
            <Button onClick={goNext} iconRight={<ChevronRight size={14} />}>Continue</Button>
          </>
        )
      }
    >
      {step === 'classification' ? classificationStep : step === 'details' ? (
      <div data-create-step-body>
        <div className="px-6 pt-5 pb-5 space-y-3.5">
        {/* The field keeps its red border and its one-line message; once
            Continue has been refused, the summary above lists them all. */}
        {stepSummary}

        {/* The lock, stated once for the step it applies across: the number is
            in the card below, the other four are in the card above it, and a
            note under each of the five was five copies of one sentence. A line
            rather than a banner - nothing has gone wrong, and the amber block
            this replaces on the step before was most of what made that step
            read bloated. */}
        {inUse && (
          <p className="text-2xs text-slate-500 leading-relaxed">{POSTED_LOCK_NOTE}</p>
        )}

        {/* ----- What kind of line this is, structurally ----- */}
        {/* No "Required" badge: the asterisks on the individual fields already
            mark what's required, and two signals for one rule is noise. */}
        <SectionCard icon={<Layers size={16} />} title="Type">
          {glTypeBlock}
        </SectionCard>

        {/* ----- Required essentials ----- */}
        <SectionCard
          icon={<Info size={16} />}
          title="GL account details"
        >
          {/* Identity row: Account name + number on the left, Description on the
              right so the account's descriptive context sits alongside its name. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="space-y-4">
              <div>
                <Input
                  label="GL account name"
                  required
                  value={form.accountName}
                  onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))}
                  placeholder="e.g. Office supplies"
                  error={errors.accountName}
                />
              </div>

              {/* Locked once the account is in use - see `numberLock`. The locked box rather
                  than a disabled Input, because that is how the other settled
                  fields on this form read, and a greyed input with no padlock is
                  the one shape a reader takes for a field still loading. */}
              {numberLock ? (
                <div>
                  <LockedField label="GL account no." why={numberLock.why}>
                    <span className="truncate">{form.accountNumber}</span>
                  </LockedField>
                  {numberError && <p data-field-error className="text-xs text-danger-600 mt-1">{numberError}</p>}
                </div>
              ) : (
                <div>
                  <Input
                    label="GL account no."
                    required
                    value={form.accountNumber}
                    onChange={e => { setNumberTouched(true); setForm(f => ({ ...f, accountNumber: e.target.value })) }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
                    error={numberError}
                    placeholder={`e.g. ${categoryFirstNumber(form.accountType, numberWidth)}`}
                    className={cn(numberError && 'border-danger-500 focus:border-danger-500')}
                  />
                  {numberLengthNote && <p data-number-length-warning className="text-2xs text-warning-700 mt-1.5">{numberLengthNote}</p>}
                  {/* Posting accounts only - a summary takes its number from the
                      block it reserves. Taking the offer counts as typing it. */}
                  {numberSuggestion && (
                    <p className="text-2xs text-slate-400 mt-1.5 flex items-center gap-1.5 flex-wrap">
                      {/* Recommended, not available: the offer steps in tens on purpose, so
                          the numbers between are free but left for later. Design review,
                          2026-09-30 - Eli: *"It's not next available. It's next
                          recommended"*, with an info button saying why. */}
                      Next recommended under {pickedParent!.accountNumber} {pickedParent!.accountName}
                      <Tooltip rich side="top" content={<NumberStepHelp />}>
                        <span className="inline-flex cursor-help text-fg-subtle/60 hover:text-fg-subtle" aria-label="Why this number"><Info size={12} /></span>
                      </Tooltip>
                      <button
                        type="button"
                        onClick={() => { setNumberTouched(true); setForm(f => ({ ...f, accountNumber: numberSuggestion })) }}
                        className="chip tabular-nums border bg-brand-50 text-brand-700 border-brand-100 hover:bg-brand-100 hover:border-brand-200 transition-colors"
                        style={{ fontWeight: 600 }}
                      >
                        {numberSuggestion}
                      </button>
                    </p>
                  )}
                </div>
              )}

            </div>

            {/* Description, alongside the identity fields. */}
            <div>
              <label className="label block mb-1.5">Description</label>
              <div className="relative">
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What this account is used for"
                  className={cn('input px-3.5 py-2.5 pr-10 resize-none transition-[min-height] duration-150 ease-out', descTall ? 'min-h-[220px]' : 'min-h-[110px]')}
                />
                <button
                  type="button"
                  onClick={() => setDescTall(t => !t)}
                  title={descTall ? 'Collapse' : 'Expand'}
                  className="absolute top-2.5 right-2.5 text-fg-subtle hover:text-fg transition-colors"
                >
                  {descTall ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Classification (category / account type) is chosen in the cards
              above on this same screen. Whether the account is postable is
              derived from the Account Type, so this section only asks for the
              lifecycle Status. */}
          {/* On a create, Currency stands only where there is a choice to make:
              a bank or cash on hand account holds its own currency, and every
              other account is base currency by definition, so a locked box in
              its place said the same thing while inviting the reader to argue
              with it. Status is alone in the row the rest of the time.

              An edit shows it either way. Mahad, 2026-09-22: *"Currency must
              also be a locked/disabled field ... locked fields must remain
              visible but explicitly grayed out."* On a form the reader opened to
              change something, a field that is simply absent cannot be told from
              one that was never built - which is not the reading a create has,
              where nothing is being withheld. */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {currencyEditable && !inUse ? (
              <div>
                <label className="label block mb-1.5">Currency</label>
                <CurrencyField value={form.currencyCode} onChange={code => setForm(f => ({ ...f, currencyCode: code }))} />
                {form.currencyCode === store.company.baseCurrency && (
                  <p className="text-2xs text-slate-400 mt-1.5">Your organization's default currency.</p>
                )}
              </div>
            ) : isEdit && (
              <div>
                <LockedField
                  label="Currency"
                  why={currencyEditable ? `${IN_USE_WHY} They are held in this currency.` : CURRENCY_LOCKED_REASON}
                >
                  <span className="truncate">{form.currencyCode}</span>
                </LockedField>
              </div>
            )}
            {/* Status is editable here on an edit as well as on a create. It
                used to be a padlocked box reading "Changed from the Actions
                menu, not here." - Mahad: *"If an action is accessible from one
                place, it should be accessible from everywhere"*. The gate it
                was protecting is not the field, it is the lifecycle plan, and
                the save runs that plan from here too, so the menu and this
                field refuse the same accounts for the same reasons.

                A category row is the one account the menu withholds the
                lifecycle from outright - see `LifecycleMenuItems` - so it is
                the one the field withholds too. Everywhere else the two agree
                by running the same plan; here they agree by both declining to
                offer it. */}
            <div>
              {statusLocked ? (
                <>
                  <label className="label block mb-1.5">Status</label>
                  <div className="input flex items-center justify-between gap-2 bg-bg-subtle/60 text-fg-muted cursor-default select-none">
                    {form.status}
                    <Lock size={13} className="shrink-0 text-fg-subtle/60" />
                  </div>
                  <p className="text-2xs text-slate-400 mt-1.5">A category row is the chart's fixed spine, so nothing takes one out of service.</p>
                </>
              ) : (
                <Select
                  label="Status"
                  openDown
                  value={form.status}
                  error={errors.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as AccountStatus }))}
                >
                  {(['Active', 'Inactive'] as const).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              )}
            </div>
          </div>
          {/* Restricted: a flag on the account, set here and shown on the chart
              and the account's page (COA discussion, 2026-10-06). Turning it on
              offers who it is open to, beside the switch, in the Notify picker's
              dialog (Mahad, 2026-10-08). */}
          {/* Design review, 2026-10-08: the list starts from the company's
              default and overrides it for this account only; the account owner
              is always on it; Manage stays a button; and the switch says in
              full what restricted means (lib/restrictedAccess). */}
          <div className="mt-4" data-restricted-toggle>
            <Toggle
              checked={form.restricted}
              onChange={v => setForm(f => ({ ...f, restricted: v, restrictedAccess: v && !f.restrictedAccess.length ? [...restrictedDefault] : f.restrictedAccess }))}
              label="Restricted account"
              info={RESTRICTED_EXPLAINER}
            />
          </div>
          {/* Under the switch, full width, in the Partners picker's own selected
              list: a white card per role or person and a dashed Manage button
              (Mahad, 2026-10-08). */}
          {form.restricted && (
            <div className="mt-3" data-restricted-access>
              <p className="text-[12px] text-slate-700 mb-2" style={{ fontWeight: 600 }}>Who has access</p>
              <NotifyRecipientsPicker
                list
                label=""
                copy={ACCESS_COPY}
                locked={[ACCOUNT_OWNER_ACCESS]}
                selectedIds={new Set(form.restrictedAccess)}
                onSelectionChange={ids => setForm(f => ({ ...f, restrictedAccess: [...ids] }))}
              />
              <p className="mt-2 text-2xs text-fg-subtle" data-access-source>
                {sameAccess(form.restrictedAccess, restrictedDefault) ? ACCESS_IS_DEFAULT : (
                  <>
                    {ACCESS_IS_CUSTOM}{' '}
                    <button type="button" className="text-primary font-semibold hover:underline" onClick={() => setForm(f => ({ ...f, restrictedAccess: [...restrictedDefault] }))}>Use default</button>
                  </>
                )}
              </p>
            </div>
          )}
        </SectionCard>

        {/* No "Reason for change" field. It asked the reader to explain an edit
            the log already records field by field, with the before and after
            values and who made it - Mahad: *"As long as the change is being
            captured and reflected in the audit log, it is perfectly fine. The
            reason requirement feels a bit ambiguous and unnecessary"*. The
            store still takes a reason, and the edits it is worth stating one
            for supply their own. */}
        </div>
      </div>
      ) : step === 'banking' ? (
      <div data-create-step-body className="px-6 pt-6 pb-6 space-y-4">
        {stepSummary}

        {/* ----- Bank details ----- a first-class section (like GL account details)
            shown for bank accounts and credit cards; never collapsed or hidden. A
            card asks for its issuer and limit instead of an account type. */}
        <SectionCard icon={isCardSub ? <CreditCard size={16} /> : <Landmark size={16} />} title={isCardSub ? 'Credit card details' : 'Bank details'}
          titleExtra={bankFeedConnected && (
            <span className="inline-flex items-center gap-1.5 px-2 h-[22px] rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-2xs" style={{ fontWeight: 600 }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected
            </span>
          )}>
          {/* Locked once anything has posted, like the structural fields on
              Details: the postings already on the ledger came from this bank
              account or card, and rewriting which one it is would make them say
              so of another. Mahad, 2026-10-11: *"Bank and credit card details
              should also lock after first transaction."* Each field locks on the
              value it was saved with, so a posted account that never had one
              (the Needs bank details chip) can still be told it once. The credit
              limit stays editable: a card's limit changes while it is the same
              card. */}
          <div className="grid grid-cols-2 gap-4" data-bank-details-locked={bankLocked.bankName || bankLocked.bankAccountNumber || undefined}>
            {bankLocked.bankName ? (
              <div>
                <LockedField label={isCardSub ? 'Issuing bank' : 'Bank name'} why={bankLockWhy}>
                  <span className="flex items-center gap-2 min-w-0">
                    <BankLogo bankName={form.bankName} domain={lockedInstitution?.domain} initials={lockedInstitution?.initials} color={lockedInstitution?.primaryColor} size={20} rounded="rounded-sm" />
                    <span className="truncate">{form.bankName}</span>
                  </span>
                </LockedField>
              </div>
            ) : (
              <BankInstitutionCombobox
                label={isCardSub ? 'Issuing bank' : 'Bank name'}
                required
                value={form.bankName}
                selectedInstitutionId={form.selectedInstitutionId || null}
                onSelectInstitution={inst => setForm(f => ({ ...f, bankName: inst.name, selectedInstitutionId: inst.id }))}
                onSelectCustom={name => setForm(f => ({ ...f, bankName: name, selectedInstitutionId: '' }))}
                error={errors.bankName}
                placeholder={isCardSub ? 'e.g. Capital One' : 'e.g. First National Bank'}
              />
            )}
            {isCardSub ? (
              <>
                <CreditLimitField value={form.creditLimit} onChange={v => setForm(f => ({ ...f, creditLimit: v }))} currency={form.currencyCode} error={errors.creditLimit} />
                {bankLocked.bankAccountNumber ? (
                  <div>
                    <LockedField label="Card number" why={bankLockWhy}>
                      <span className="truncate tabular-nums">{form.bankAccountNumber}</span>
                    </LockedField>
                  </div>
                ) : (
                  <Input label="Card number" value={form.bankAccountNumber} onChange={e => setForm(f => ({ ...f, bankAccountNumber: e.target.value }))} error={errors.bankAccountNumber} placeholder="e.g. 4147 2029 1833 6" />
                )}
              </>
            ) : (
              <>
                {bankLocked.bankAccountNumber ? (
                  <div>
                    <LockedField label="Account number" why={bankLockWhy}>
                      <span className="truncate tabular-nums">{form.bankAccountNumber}</span>
                    </LockedField>
                  </div>
                ) : (
                  <Input label="Account number" required value={form.bankAccountNumber} onChange={e => setForm(f => ({ ...f, bankAccountNumber: e.target.value }))} error={errors.bankAccountNumber} placeholder="e.g. 4 to 17 digits" />
                )}
                {bankLocked.bankAccountTitle ? (
                  <div>
                    <LockedField label="Account title" why={bankLockWhy}>
                      <span className="truncate">{form.bankAccountTitle}</span>
                    </LockedField>
                  </div>
                ) : (
                  <Input label="Account title" value={form.bankAccountTitle} onChange={e => setForm(f => ({ ...f, bankAccountTitle: e.target.value }))} error={errors.bankAccountTitle} placeholder="Name on the account" />
                )}
                {bankLocked.bankAccountType ? (
                  <div>
                    <LockedField label="Bank account type" why={bankLockWhy}>
                      <span className="flex items-center gap-2 min-w-0">
                        {lockedBankType && (
                          <span className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <lockedBankType.icon size={14} />
                          </span>
                        )}
                        <span className="truncate">{lockedBankType?.title ?? form.bankAccountType}</span>
                      </span>
                    </LockedField>
                  </div>
                ) : (
                  <BankAccountTypeCards value={form.bankAccountType} onChange={v => setForm(f => ({ ...f, bankAccountType: v }))} error={errors.bankAccountType} classification={form.statementClassification} />
                )}
              </>
            )}
          </div>
        </SectionCard>

        {/* ----- Set up as partner ----- optional; when enabled, mirrors the Cash
            Management inline partner experience (linked-existing or inline form). */}
        <SectionCard icon={<Handshake size={16} />} title="Set up as partner" badge="Optional">
          <Toggle
            checked={partnerEnabled}
            onChange={setPartnerEnabled}
            label={`Also add ${form.accountType === 'LIA' ? 'this card issuer' : 'this bank'} as a partner`}
            hint={`Track payments, statements, and contact details for ${form.accountType === 'LIA' ? 'this card issuer' : 'this bank'}.`}
          />
          {partnerEnabled && (
            <div className="mt-4">
              {partnerMatch ? (
                <LinkedExistingPartnerCard partner={partnerMatch} accountKind={form.accountType === 'LIA' ? 'credit card' : 'bank account'} />
              ) : (
                <PartnerInlineForm
                  draft={partnerDraft}
                  onChange={p => setPartnerDraft(d => ({ ...d, ...p }))}
                  bankName={form.bankName}
                  showGroupError={!!errors.partnerGroup}
                />
              )}
            </div>
          )}
        </SectionCard>

        {/* ----- Connect a bank feed ----- a prominent CTA so automatic import is
            discoverable; enabled once every required bank field is filled. */}
        <div className={cn('rounded-xl border p-4 flex items-center gap-4 transition-colors',
          bankFeedConnected ? 'border-emerald-200 bg-emerald-50/50' : 'border-primary/30 bg-accent/40')}>
          <span className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
            bankFeedConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-primary/10 text-primary')}>
            {bankFeedConnected ? <Check size={20} strokeWidth={2.5} /> : <Zap size={20} />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-fg">{bankFeedConnected ? 'Bank feed connected' : 'Connect a bank feed'}</p>
            <p className="text-2xs text-fg-muted mt-0.5">
              {bankFeedConnected
                ? 'Transactions import automatically. You can manage the connection later in Banking.'
                : form.selectedInstitutionId
                  ? 'Securely link this account to import transactions automatically.'
                  : bankLocked.bankName
                    ? 'A manually typed bank name can’t be connected.'
                    : 'Pick your bank from the list above to link a feed. A manually typed bank name can’t be connected.'}
            </p>
          </div>
          {bankFeedConnected ? (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                icon={<Unlink size={14} />}
                onClick={() => setDisconnectOpen(true)}
              >
                Disconnect
              </Button>
              <Button variant="secondary" onClick={() => setConnectBankOpen(true)}>Manage connection</Button>
            </div>
          ) : (
            <Button variant="primary" disabled={!form.selectedInstitutionId} onClick={() => setConnectBankOpen(true)} icon={<Zap size={14} />} className="shrink-0">
              Connect
            </Button>
          )}
        </div>
      </div>
      ) : step === 'dimensions' ? (
      <div data-create-step-body className="px-6 pt-5 pb-5 space-y-3.5">
        {stepSummary}
        <SectionCard icon={<ListFilter size={16} />} title="Dimensions" badge="Optional">
          <div className="text-2xs text-slate-400 -mt-0.5 mb-3 space-y-1.5 leading-relaxed">
            {/* Said the way How it works says it (Mahad, 2026-10-08): what a
                dimension is, then picking values and a default. */}
            <p>
              A dimension is something your company wants to organize or filter accounts by, such as
              Location or Department. Select one or more values for each dimension. If you select
              more than one, mark one as the default.
            </p>
            <p>
              For example: select USA and Singapore under Location, with USA as the default. You can
              then filter your chart of accounts by Location &rarr; USA to find this account, and a
              journal entry line on it starts on USA.
            </p>
          </div>
          <DimensionDefaultsEditor
            dimensions={availableDimensions}
            value={form.defaultDimensionValues}
            onChange={next => setForm(f => ({ ...f, defaultDimensionValues: next }))}
            onAddValue={(id, v) => {
              const d = store.dimensions.find(x => x.id === id)
              if (d) store.updateDimension(id, { values: [...d.values, v] })
            }}
            onCreateDimension={draft => store.addDimension(draft)}
          />
        </SectionCard>
      </div>
      ) : isEdit ? editPreviewStep : previewStep}
    </FormModal>

    <ConfirmModal
      open={disconnectOpen}
      tone="danger"
      badge="Disconnect feed"
      icon={<Unlink size={22} />}
      title="Disconnect this bank feed?"
      description="Transactions will stop importing automatically for this account."
      confirmLabel="Disconnect"
      dismissLabel="Keep connected"
      onConfirm={() => {
        setDisconnectOpen(false)
        setBankFeedConnected(false)
        store.pushToast('Bank feed disconnected', 'info', 'Transactions will no longer import automatically for this account.')
      }}
      onDismiss={() => setDisconnectOpen(false)}
    />

    <ConnectBankModal
      open={connectBankOpen}
      onClose={() => setConnectBankOpen(false)}
      initialBankName={form.bankName}
      selectedInstitutionId={form.selectedInstitutionId || undefined}
      accountType={form.bankAccountType}
      accountNumber={form.bankAccountNumber}
      accountTitle={form.bankAccountTitle}
      currencyCode={form.currencyCode}
      glAccountLabel={form.accountNumber && form.accountName ? `${form.accountNumber} · ${form.accountName}` : form.accountName || undefined}
      onConnected={() => setBankFeedConnected(true)}
    />

    <ConfirmModal
      open={discardOpen}
      tone="danger"
      badge="Discard"
      title="Discard account creation?"
      description={["All the information you’ve entered will be lost.", 'This action cannot be undone.']}
      confirmLabel="Discard changes"
      dismissLabel="Continue editing"
      onConfirm={() => { setDiscardOpen(false); onClose() }}
      onDismiss={() => setDiscardOpen(false)}
    />

    {/* The same dialog the status chip and the Actions menu raise, from the same
        plan, so the three ways of taking an account out of service say one thing.
        Cancel leaves the form standing with the save not made - the reader is
        back at the field they set, free to put it back. */}
    {statusConfirm && (
      <LifecycleConfirm
        action={statusConfirm.action}
        spec={statusConfirm.spec}
        onConfirm={() => { statusAckRef.current = true; setStatusConfirm(null); doCreate() }}
        onDismiss={() => setStatusConfirm(null)}
      />
    )}
    </>
  )
}

// =========================
// Currency picker - a rich dropdown (flag + bold code + full name) with a
// search box, in place of a bare <select>. The trigger shows the selected
// currency as a card; the popover lists every currency, filterable by code or
// name. Closes on outside click / Escape / selection.
// =========================
function CurrencyField({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  // Fixed-position box for the portalled menu, so it's never clipped by the
  // SectionCard's overflow-hidden. Mirrors the shared Select component.
  const [box, setBox] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null)
  const sel = CURRENCIES.find(c => c.code === value) ?? { code: value, name: value, flag: '🏳️' }

  // Always open downward (the menu's own 280px list scrolls internally), so the
  // currency picker behaves like the other searchable dropdowns.
  const place = () => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    setBox({ left: r.left, width: r.width, top: r.bottom + 6 })
  }

  useLayoutEffect(() => { if (open) place() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || popRef.current?.contains(e.target as Node)) return
      setOpen(false); setQ('')
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setQ('') } }
    const onScroll = (e: Event) => {
      if (popRef.current && e.target instanceof Node && popRef.current.contains(e.target)) return
      place()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const query = q.trim().toLowerCase()
  const list = query ? CURRENCIES.filter(c => c.code.toLowerCase().includes(query) || c.name.toLowerCase().includes(query)) : CURRENCIES

  return (
    <div className="relative">
      {/* Trigger card: flag + bold code + full name */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn('input pr-9 relative flex items-center gap-2 text-left cursor-pointer',
          open && 'border-primary ring-2 ring-primary/10')}
      >
        <CurrencyFlag meta={sel} className="text-base leading-none shrink-0" />
        <span className="text-sm text-fg shrink-0" style={{ fontWeight: 600 }}>{sel.code}</span>
        <span className="text-sm text-fg-muted truncate min-w-0">{sel.name}</span>
        <ChevronDown className={cn('w-4 h-4 text-fg-subtle absolute right-3 top-1/2 -translate-y-1/2 transition-transform', open && 'rotate-180')} />
      </button>

      {open && box && createPortal(
        <div
          ref={popRef}
          className="fixed z-[80] bg-white rounded-xl border border-border shadow-xl overflow-hidden"
          style={{ left: box.left, width: box.width, top: box.top, bottom: box.bottom }}
        >
          {/* Search */}
          <div className="p-2.5 border-b border-border/60">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle/60 pointer-events-none" />
              <input
                autoFocus
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search by code, name, or country..."
                className="h-9 w-full pl-9 pr-3 text-sm bg-white rounded-lg border border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>
          </div>
          {/* List */}
          <div className="max-h-[280px] overflow-y-auto scrollbar-thin py-1">
            {list.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-fg-subtle">No currencies match “{q}”.</div>
            ) : list.map(c => {
              const selected = c.code === value
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => { onChange(c.code); setOpen(false); setQ('') }}
                  className={cn('w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-bg-subtle', selected && 'bg-accent/40')}
                >
                  <CurrencyFlag meta={c} className="text-xl leading-none shrink-0" />
                  <span className="text-sm text-fg w-12 shrink-0" style={{ fontWeight: 700 }}>{c.code}</span>
                  <span className="text-sm text-fg-muted truncate flex-1 min-w-0">{c.name}</span>
                  {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// One of the four priority-ordered Posting questions (Section 2, item 6): a
// numbered prompt with a hint and a right-aligned toggle. Kept simple so the
// flat variants can list them top-to-bottom.
// =========================
function QuestionRow({ n, label, hint, info, checked, onChange, readOnly, readOnlyValue }: { n: number; label: string; hint?: string; info?: string; checked: boolean; onChange: (v: boolean) => void; readOnly?: boolean; readOnlyValue?: string }) {
  if (readOnly) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-bg-subtle/40 px-3.5 py-3">
        <span className="mt-0.5 w-5 h-5 rounded-full bg-bg-muted text-fg-subtle text-[11px] flex items-center justify-center shrink-0" style={{ fontWeight: 600 }}>{n}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-fg-muted" style={{ fontWeight: 600 }}>{label}</div>
          {hint && <p className="text-2xs text-slate-400 mt-0.5">{hint}</p>}
        </div>
        <div className="shrink-0 pt-0.5 text-[13px] text-fg-muted" style={{ fontWeight: 500 }}>{readOnlyValue}</div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-white px-3.5 py-3">
      <span className="mt-0.5 w-5 h-5 rounded-full bg-accent text-primary text-[11px] flex items-center justify-center shrink-0" style={{ fontWeight: 600 }}>{n}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-fg flex items-center gap-1" style={{ fontWeight: 600 }}>
          {label}
          {info && (
            <Tooltip content={info} side="top">
              <span className="inline-flex cursor-help text-fg-subtle/60 hover:text-fg-subtle"><Info size={12} /></span>
            </Tooltip>
          )}
        </div>
        {hint && <p className="text-2xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0 pt-1"><Toggle checked={checked} onChange={onChange} /></div>
    </div>
  )
}

/* What the default picker says while it is empty. One line, shared by the
   field and the form's gate, so the two cannot come to say different things. */
export const DEFAULT_VALUE_REQUIRED = 'Choose which value a journal line on this account starts on.'

/* Dimension defaults: a card per dimension this account carries, each naming the
   dimension and the value every posting on the account starts with.

   Mahad, 2026-09-29: *"the current UI doesn't look good; it feels very clunky,
   and the layout isn't intuitive"* - pointing at the Partners module's Freight &
   Logistics modal as the shape to take. A numbered card per thing, two fields
   inside it, and one dashed button that adds another.

   What it replaced was a table of every dimension the tenant has ever defined,
   answered or not, split into "Set on this account" and "Available, not
   applied". That split existed to answer a real complaint - defining a dimension
   from one account makes it offered on every account, and the table made that
   read as applied to every account. Cards answer it outright instead of
   labelling around it: only what this account carries is drawn, so there is no
   second group to mistake for one. What is merely available is inside the
   Dimension dropdown, which is where a list of things you could pick belongs. */
export function DimensionDefaultsEditor({ dimensions, value, onChange, onAddValue, onCreateDimension }: {
  dimensions: Dimension[]
  value: { dimensionId: string; value: string }[]
  onChange: (next: { dimensionId: string; value: string }[]) => void
  /* Adds a value to the dimension itself, so a value nobody thought of at
     setup time can be created at the moment it is first needed. Absent in flows
     whose dimensions are a draft the caller owns. */
  onAddValue?: (dimensionId: string, value: string) => void
  /* Defines a whole dimension, from here. The moment you notice you want to
     report this account by something is the moment you are answering for it,
     and that moment used to end at a sentence naming a menu on another page -
     which cost the account you were part-way through creating. Same form the
     standing page uses, so the two are the same record. Returns what it made, so
     the card that asked for it can select it without the reader going and
     finding it in a list they have just come from. */
  onCreateDimension?: (draft: DimensionDraft) => Dimension
}) {
  /* A card can be half-answered - a dimension picked with no value yet, or a
     blank card just added - and neither is something the account carries. So the
     cards are held here and only the finished ones are pushed up. */
  /* A card holds every value the account takes for its dimension - one account
     can be used in Singapore and in the USA. Design review, 2026-09-30 - Eli:
     *"the drop-down in the value for the account and the dimensions should be a
     multi-select."* Up above they are still one pair per value, so filtering by
     either finds the account. */
  /* With two values or more, one is the default - the value a journal line takes
     when the account is picked, because one amount lands in one place (Mahad,
     2026-10-02). Held on the card, and written out as the pair's `isDefault`. */
  type Card = { key: string; dimensionId: string; values: string[]; defaultValue?: string }
  const nextKey = useRef(0)
  const card = (dimensionId = '', values: string[] = [], defaultValue?: string): Card => ({ key: `d${nextKey.current++}`, dimensionId, values, defaultValue })
  // One card per dimension, holding its values in the order they were given.
  const toCards = (xs: DimensionPair[]) => {
    const by = new Map<string, string[]>()
    const marked = new Map<string, string>()
    xs.forEach(x => {
      by.set(x.dimensionId, [...(by.get(x.dimensionId) ?? []), x.value])
      if (x.isDefault) marked.set(x.dimensionId, x.value)
    })
    // No mark on record: the first value is the default, as the picker assigns it.
    return [...by].map(([id, vs]) => card(id, vs, marked.get(id) ?? vs[0]))
  }
  const [cards, setCards] = useState<Card[]>(() => toCards(value))

  const finished = (cs: Card[]): DimensionPair[] => normaliseDefaults(cs.flatMap(c => (c.dimensionId
    ? c.values.map(v => ({ dimensionId: c.dimensionId, value: v, ...(v === c.defaultValue ? { isDefault: true } : {}) }))
    : [])))
  const sig = (xs: DimensionPair[]) => xs.map(x => `${x.dimensionId}=${x.value}${x.isDefault ? '*' : ''}`).join('|')
  /* Re-seeded only when the answer above disagrees with the finished cards -
     which is a caller replacing the draft (the account page reopening its
     modal), not our own push coming back. Comparing against the finished set
     rather than against every card is what lets a half-answered card survive:
     it is absent from both sides, so it reads as agreement. */
  useEffect(() => {
    if (sig(value) !== sig(finished(cards))) setCards(toCards(value))
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (next: Card[]) => { setCards(next); onChange(finished(next)) }
  const patch = (key: string, next: Partial<Card>) => commit(cards.map(c => (c.key === key ? { ...c, ...next } : c)))

  /* The card that asked for a new dimension, so the form can hand it back to the
     one that opened it. `null` while shut; a key while open. */
  const [definingFor, setDefiningFor] = useState<string | null>(null)
  // What the reader had typed into the dropdown when they gave up on finding it.
  const [definingName, setDefiningName] = useState('')
  const openDefine = (key: string | null, name: string) => { setDefiningFor(key); setDefiningName(name); setDefining(true) }
  const [defining, setDefining] = useState(false)

  const used = new Set(cards.map(c => c.dimensionId).filter(Boolean))
  const spare = dimensions.filter(d => !used.has(d.id))

  const defineModal = onCreateDimension && (
    <DimensionFormModal
      open={defining}
      onClose={() => setDefining(false)}
      dimensions={dimensions}
      initial={{ ...EMPTY_DRAFT, name: definingName }}
      onSubmit={draft => {
        const made = onCreateDimension(draft)
        /* Straight onto the card that asked, with its value cleared - the
           dimension is new, so whatever was there belonged to another one. A
           card of its own when the ask came from the empty state. */
        if (definingFor) patch(definingFor, { dimensionId: made.id, values: [], defaultValue: undefined })
        else commit([...cards, card(made.id)])
      }}
    />
  )

  /* The value row stands whether or not anything has been typed, the same as the
     dimension row above it - Mahad, 2026-09-29: *"there should be an option to
     add new value on the go... similar to create new dimension"*. Typed, it has
     the whole record already and just makes it. Untyped it has no name, and the
     one thing it must not do is answer the click with nothing, so it asks. */
  const [namingFor, setNamingFor] = useState<{ key: string; dimensionId: string } | null>(null)
  const [newValue, setNewValue] = useState('')
  const namingDim = dimensions.find(d => d.id === namingFor?.dimensionId)
  const takenValue = !!namingDim?.values.some(v => v.trim().toLowerCase() === newValue.trim().toLowerCase())

  const addValue = (key: string, dimensionId: string, v: string) => {
    onAddValue?.(dimensionId, v)
    const c = cards.find(x => x.key === key)
    const values = [...(c?.values ?? []).filter(x => x !== v), v]
    patch(key, { values, defaultValue: c?.defaultValue ?? values[0] })
  }

  const valueModal = namingDim && namingFor && (
    <FormModal
      open
      onClose={() => setNamingFor(null)}
      icon={<ListFilter size={16} />}
      title={`Add a ${namingDim.name.toLowerCase()} value`}
      subtitle="It joins the dimension, and lands on this account."
      widthClass="max-w-[440px]"
      hideFullView
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => setNamingFor(null)}>Cancel</Button>
          <Button
            disabled={!newValue.trim() || takenValue}
            onClick={() => { addValue(namingFor.key, namingFor.dimensionId, newValue.trim()); setNamingFor(null) }}
          >
            Add value
          </Button>
        </div>
      }
    >
      {/* FormModal's body carries no padding of its own. px-6 to match the
          footer under it, and the dimension form this one stands beside. */}
      <div className="px-6 py-5">
        <Input
          label="Value"
          required
          autoFocus
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          placeholder={namingDim.values[0] ? `e.g. ${namingDim.values[0]}` : 'e.g. London'}
          error={takenValue ? `${namingDim.name} already has this value.` : undefined}
        />
      </div>
    </FormModal>
  )

  const addButton = (label: string) => (
    <button
      type="button"
      onClick={() => commit([...cards, card()])}
      className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-dashed border-border-strong bg-white text-2xs text-primary hover:bg-accent hover:border-primary/40 transition-colors"
      style={{ fontWeight: 600 }}
    >
      <Plus size={14} className="shrink-0" />
      {label}
    </button>
  )

  // Nothing defined anywhere and no way to define one: the step can only explain
  // itself. With a way, the empty state below carries it instead.
  if (!dimensions.length && !onCreateDimension) {
    return (
      <p className="text-2xs text-slate-400">
        No dimensions are set up yet. Define one, such as Location or Department, from Dimensions on the
        Chart of Accounts, and its values become pickable here.
      </p>
    )
  }

  if (!cards.length) {
    return (
      <>
        {/* One offer, not two: the dashed button is the same act, so it stays
            off until there is a card for it to follow. */}
        <EmptyState
          size="sm"
          icon={<ListFilter size={15} />}
          title="No dimensions on this account"
          /* The title alone once dimensions exist. Design review, 2026-09-30 -
             Eli: *"I think it should just read No Dimensions on this account."* */
          description={dimensions.length
            ? undefined
            : 'A dimension is something you want to report by, such as Location or Department. Define one and its values become pickable here.'}
          action={
            <Button
              variant="secondary"
              icon={<Plus size={14} />}
              onClick={() => (dimensions.length ? commit([card()]) : openDefine(null, ''))}
            >
              Add a dimension
            </Button>
          }
        />
        {defineModal}
      </>
    )
  }

  return (
    <div className="space-y-2.5">
      {cards.map((c, i) => {
        const dim = dimensions.find(d => d.id === c.dimensionId)
        // A list of one needs no numbering; the badge only earns its place once
        // there is a second card to tell it from.
        const numbered = cards.length > 1
        // Standing in until one is picked. It counts only where the badge does;
        // a lone card reading "Dimension 1" numbers a list of one.
        const naming = dim?.name ?? (numbered ? `Dimension ${i + 1}` : 'Dimension')
        return (
          <div key={c.key} className="rounded-lg border border-border bg-white overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border-subtle bg-bg-subtle/60">
              <div className="flex items-center gap-2 min-w-0">
                {numbered && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 text-primary text-[11px] shrink-0 tabular-nums" style={{ fontWeight: 700 }}>
                    {i + 1}
                  </span>
                )}
                <ListFilter size={14} className="shrink-0 text-fg-subtle/70" />
                <span className="text-13 text-fg truncate" style={{ fontWeight: 600 }}>
                  {naming}
                </span>
              </div>
              {/* Always offered, unlike the carrier it is drawn from: an account
                  with no dimensions is a legal account, so the last card has to
                  be removable. */}
              <button
                type="button"
                onClick={() => commit(cards.filter(x => x.key !== c.key))}
                aria-label={`Remove ${naming}`}
                className="w-6 h-6 rounded-md flex items-center justify-center text-fg-subtle hover:text-danger-600 hover:bg-danger-50 transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </div>
            <div className="px-4 py-3.5 grid grid-cols-2 gap-3">
              <Select
                label="Dimension"
                /* Every card repeats these two labels, and a <label> cannot name
                   a button anyway, so each trigger says which card it is on. */
                ariaLabel={dim ? `Dimension: ${dim.name}` : `Dimension ${i + 1}`}
                required
                searchable
                placeholder="Select a dimension"
                searchPlaceholder="Search dimensions…"
                value={c.dimensionId}
                // A new dimension answers for this card, so whatever value was
                // there belonged to the one being replaced.
                onChange={e => patch(c.key, { dimensionId: e.target.value, values: [], defaultValue: undefined })}
                /* Mahad: *"Inside that dropdown, there should be an option to
                   'Create New Dimension'."* Standing whether or not anything has
                   been typed, because a dimension is a name and a list of values
                   and the form is where both are given - so there is somewhere
                   to send the reader either way. Anything typed rides along as
                   the name. */
                onCreate={onCreateDimension && (name => openDefine(c.key, name))}
                createAlways={!!onCreateDimension}
                createNoun="dimension"
              >
                {/* This card's own dimension, plus the ones no other card has
                    taken - two cards for Location would be two answers to one
                    question. */}
                {dim && <option value={dim.id}>{dim.name}</option>}
                {spare.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
              {/* One field holds every value the account takes for this
                  dimension, ticked in the list and shown inside the field as
                  chips; the first picked is the default a journal line takes,
                  and moves from the list or a chip (Mahad, 2026-10-02). */}
              <DimensionValuePicker
                label="Values for this account"
                ariaLabel={dim ? `${dim.name} value for this account` : `Value for dimension ${i + 1}`}
                disabled={!dim}
                placeholder={!dim ? 'Pick a dimension first' : 'Select values'}
                searchPlaceholder={dim ? `Search or type a new ${dim.name.toLowerCase()} value…` : undefined}
                options={dim?.values ?? []}
                values={c.values}
                defaultValue={c.defaultValue}
                onChange={(values, defaultValue) => patch(c.key, { values, defaultValue })}
                /* Creating a value here adds it to the dimension for everyone,
                   then ticks it, because the reason you named it is that you
                   want it. Typed, that is the whole record and it is made on the
                   spot; untyped, the row has no name to make one from and opens
                   the little form instead. */
                onCreate={dim && onAddValue ? (v => {
                  if (v.trim()) addValue(c.key, dim.id, v.trim())
                  else { setNewValue(''); setNamingFor({ key: c.key, dimensionId: dim.id }) }
                }) : undefined}
                createAlways={!!dim && !!onAddValue}
                createNoun={dim ? `${dim.name} value` : 'value'}
              />
            </div>
          </div>
        )
      })}
      {/* Nothing left to add, and no way to define one: the button would open a
          dropdown holding only its own create row. */}
      {(spare.length > 0 || !!onCreateDimension) && addButton('Add another dimension')}
      {defineModal}
      {valueModal}
    </div>
  )
}

// =========================
// Section card, a titled block with a light header strip, an optional leading
// icon, and a small uppercase badge (e.g. "Required"). Mirrors the reference
// Create New User layout.
// =========================
export function SectionCard({ icon, title, badge, titleExtra, children }: { icon?: React.ReactNode; title: string; badge?: string; titleExtra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-bg-subtle/50">
        {icon && <span className="text-primary shrink-0">{icon}</span>}
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {badge && <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-slate-300">{badge}</span>}
        {titleExtra}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// True when `value` fully matches the configured numbering scheme's segment
// pattern. Partial / incomplete numbers return false so neither check fires.
function numberComplete(scheme: NumberingScheme, value: string) {
  const pattern = scheme.segments.map((s, i) => `\\d{${s.length}}` + (i < scheme.segments.length - 1 ? s.separator : '')).join('')
  return new RegExp(`^${pattern}$`).test(value)
}

/* Why the offered posting number steps in tens. Drawn as the module's rich
   tooltips are - a rich Tooltip supplies only the white card and shadow, so the
   content carries the chrome, as NormalBalanceHelp and GLTypeLegend do: a
   300px card, 11px muted text on a relaxed line. Without it the text fell back
   to the page's 16px - Mahad, 2026-10-01: *"what is this UI??? Please match the
   same as we have in our UI patterns."* */
function NumberStepHelp() {
  return (
    <div className="w-[300px] p-3.5 text-left">
      <p className="text-[12px] text-fg leading-snug" style={{ fontWeight: 600 }}>Why we recommend this number</p>
      <p className="mt-1.5 text-11 text-fg-muted leading-relaxed">We number accounts in steps of 10, such as 11110, 11120, 11130, so there is room between them.</p>
      <p className="mt-2 text-11 text-fg-muted leading-relaxed">If you later need an account in the middle, say a second bank account between 11120 and 11130, it can take 11125 and sit in order, without renumbering anything.</p>
      <p className="mt-2 text-11 text-fg-muted leading-relaxed">You can still type any number that fits.</p>
    </div>
  )
}
