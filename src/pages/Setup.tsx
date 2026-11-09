import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Upload, Pencil, Sparkles, Wand2, Check, ArrowRight, FileSpreadsheet, ChevronRight, ChevronLeft, ChevronDown, Building2, Plus, Trash2, Search, Minus, HardHat, Wrench, Store, Truck, ShoppingCart, Briefcase, Megaphone, Scale, Utensils, Coffee, Wine, Cloud, Code, X, Info, Calendar, DollarSign, AlertTriangle, MoreVertical, Download, RotateCw, MapPin, CornerUpLeft, HeartPulse, Home, Factory, GraduationCap, Sprout, Plane, Dumbbell, Hotel, Landmark, Palette, Scissors, Camera, BookOpen, type LucideIcon } from 'lucide-react'
import { Button, Card, CardHeader, Input, Select, Banner, Badge, Toggle, ConfirmModal, Tooltip, Menu, MenuItem, RequiredMark, EmptyState } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { AccountTable, AccountTree, CategoryCell, ColumnFiltersBar, DEFAULT_COLUMNS, DEFAULT_COLUMN_ORDER, useTreeExpansion, HEADER_DEFS, uniqueColValues, blankFilter, type ColKey, type ColFilters, type ColumnConfig, type CreateRowPrefill } from '../components/AccountTable'
import { NumberingSchemeEditor } from '../components/NumberingSchemeEditor'
import { AccountNumberingStep, jumpToRangeProblem, schemeFromNumberWidth, schemeFromNumbering, numberWidthValid, categoryRangesValid, defaultCategoryRanges, NUMBERING_STEP_LABEL, NUMBERING_STEP_TITLE, NUMBERING_STEP_SUBTITLE } from '../components/AccountNumberingStep'
import { DimensionsEditor, DIMENSION_NOUN } from '../components/DimensionsEditor'
import { AccountDimensionsModal } from '../components/AccountDimensionsModal'
import { CoaTreeIllustration } from '../components/CoaTreeIllustration'
import { WizardChartTree } from '../components/WizardChartTree'
import { LEAVE_SETUP_PATH_CONFIRM, WizardChrome } from '../components/WizardChrome'
import { SCRATCH_ACCOUNTS_READING_ROOM, SCRATCH_NUMBER_LENGTH_READING_ROOM } from '../components/BuildEducation'
import { ReadingRoom, WalkthroughReplayRow } from '../components/walkthrough/ReadingRoom'
import { WalkthroughOverlay } from '../components/walkthrough/WalkthroughOverlay'
import { DimensionsWelcome } from '../components/walkthrough/dimensionsWelcome'
import { DIMENSIONS_CARDS, DIMENSIONS_DEMO, DIMENSIONS_LABEL, type DimensionsStep } from '../components/walkthrough/dimensionsCards'
import { takeFirstWalkthrough, WALKTHROUGH_OPEN_DELAY_MS } from '../components/walkthrough/walkthroughState'
import { ChartWelcome } from '../components/walkthrough/chartWelcome'
import { NumberingWelcome } from '../components/walkthrough/numberingWelcome'
import { NUMBERING_CARDS, NUMBERING_LABEL, type NumberingStep } from '../components/walkthrough/numberingCards'
import { chartCards, useColumnAnchors, CHART_COLUMN_ANCHORS, CHART_DEMO, CHART_LABEL, SCRATCH_CHART_PATH, type ChartStep } from '../components/walkthrough/chartCards'
import { DIMENSIONS_READING_ROOM } from './scratchReadingRoom'
import { WizardRightPane } from '../components/WizardRightPane'
import { FieldMappingTable } from '../components/FieldMappingTable'
import {
  downloadTemplate, MAPPING_COLUMNS, TEMPLATE_EXAMPLE_ROWS,
  REQUIRED_TEMPLATE_FIELDS, OPTIONAL_TEMPLATE_FIELDS, templateFieldSentence,
} from '../lib/importTemplate'
import { CreateAccountSlideOver } from './CreateAccount'
import { MoveUnderSummaryModal } from '../components/MoveUnderSummaryModal'
import { useDeleteWithUndo } from '../components/useDeleteWithUndo'
import { hiddenSearchHits, searchAccounts, type SearchContext } from '../lib/accountSearch'
import { SearchRevealNote, orderWithRevealed, useSearchReveal } from '../components/SearchReveal'
import { buildChartIndex } from '../lib/chartTree'
import { TYPE_TO_CODE, MASTER_CHART, MASTER_CHART_ROLES } from '../lib/masterChart'
import { FULL_CHART } from '../lib/fullChart'
import type { MasterChartEntry } from '../lib/masterChart'
import { EMPTY_ANSWERS, computeWizardChart, triggerMatches, getStepDiff, answersBeforeStep } from '../lib/wizardEngine'
import type { WizardAnswers, WizardStepId } from '../lib/wizardEngine'
import { seedCategoryAccounts } from '../lib/seed'
import { useStore, suggestNextNumberAgainst, defaultClassificationForCategory } from '../store'
import { ACCOUNT_TYPE_META, DEFAULT_NUMBER_WIDTH, AccountType, StatementClassification, CLASSIFICATIONS_BY_CATEGORY, DEFAULT_CLASSIFICATION_BY_CATEGORY, ALL_CLASSIFICATIONS, CATEGORY_OF_CLASSIFICATION, compareAccountNumbers, draftOf, Account, Dimension, JournalEntry, NumberingScheme, Transaction, WizardAccount } from '../types'
import { cn, fmtCurrency } from '../lib/utils'
import { uid } from '../lib/utils'

type Path = 'upload' | 'scratch' | 'wizard'

// =====================================================================
// Entry point, routes the wizard path to the new GuidedWizard and the
// upload / build-from-scratch paths to the legacy step flow. The wizard is
// one-time only: once setup is complete it can never be re-entered, even via
// a direct URL (Constraint 1).
// =====================================================================
export default function SetupPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const setupComplete = useStore(s => s.company.setupComplete)

  useEffect(() => {
    if (setupComplete) navigate('/chart-of-accounts', { replace: true })
  }, [setupComplete, navigate])

  if (setupComplete) return null

  // The first-time view links here with ?method=upload|scratch|wizard. `path`
  // is accepted as a legacy alias. When neither is present, LegacySetup falls
  // back to its in-page method selector.
  const param = (params.get('method') || params.get('path')) as Path | null
  // A recognized method lands the user directly on the matching flow, skipping
  // the in-page selector: wizard → guided questionnaire (Step 1 / Orientation),
  // upload → the upload UI, scratch → the build-from-scratch flow.
  if (param === 'wizard') return <GuidedWizard mode="wizard" />
  if (param === 'upload') return <GuidedWizard mode="upload" />
  if (param === 'scratch') return <GuidedWizard mode="scratch" />
  return <LegacySetup initialPath={param} />
}

// =====================================================================
// Guided wizard, branching, question-driven, two-pane experience.
// =====================================================================

const SECTIONS: { type: AccountType; label: string }[] = [
  { type: 'AST', label: 'Assets' },
  { type: 'LIA', label: 'Liabilities' },
  { type: 'EQT', label: 'Equity' },
  { type: 'REV', label: 'Revenue' },
  { type: 'EXP', label: 'Expenses' },
]

// Short, plain-language explanation of each account type, shown in a tooltip
// next to the type badge.
const TYPE_HELP: Record<AccountType, string> = {
  AST: 'Assets: resources the business owns',
  LIA: 'Liabilities: amounts the business owes',
  EQT: "Equity: the owners' stake in the business",
  REV: 'Revenue: income the business earns',
  EXP: 'Expenses: cost of goods sold, operating, and other costs',
}

// Static dot colours per section, a distinct hue per account type (literal
// classes so Tailwind keeps them; all from the existing token palette).
const SECTION_DOT: Record<AccountType, string> = {
  AST: 'bg-info-500',     // blue
  LIA: 'bg-warning-500',  // amber
  EQT: 'bg-violet',       // violet
  REV: 'bg-success-500',  // green
  EXP: 'bg-danger-500',   // red
}
// Matching header text colour per type (color-coded section labels).
const SECTION_TEXT: Record<AccountType, string> = {
  AST: 'text-info-600',
  LIA: 'text-warning-600',
  EQT: 'text-violet',
  REV: 'text-success-600',
  EXP: 'text-danger-600',
}

// Searchable industry list. Each entry maps to a category that drives the
// account set; everything outside the five specialised categories is treated
// as a balanced "General business".
const INDUSTRIES: { label: string; cat: string; icon: LucideIcon }[] = [
  { label: 'Construction', cat: 'construction', icon: HardHat },
  { label: 'General Contracting', cat: 'construction', icon: HardHat },
  { label: 'Trades (electrical, plumbing, HVAC)', cat: 'construction', icon: Wrench },
  { label: 'Retail', cat: 'retail', icon: Store },
  { label: 'Wholesale / Distribution', cat: 'retail', icon: Truck },
  { label: 'E-commerce', cat: 'retail', icon: ShoppingCart },
  { label: 'Professional Services', cat: 'services', icon: Briefcase },
  { label: 'Consulting', cat: 'services', icon: Briefcase },
  { label: 'Marketing / Creative Agency', cat: 'services', icon: Megaphone },
  { label: 'Legal / Accounting', cat: 'services', icon: Scale },
  { label: 'Restaurant', cat: 'restaurant', icon: Utensils },
  { label: 'Café / Bar', cat: 'restaurant', icon: Coffee },
  { label: 'Food & Beverage', cat: 'restaurant', icon: Wine },
  { label: 'SaaS / Subscription', cat: 'saas', icon: Cloud },
  { label: 'Software / Technology', cat: 'saas', icon: Code },
  { label: 'General business', cat: 'general', icon: Building2 },
]

// The guided-wizard Industry step's searchable options. Each maps to one of the
// five categories that actually drive the generated chart; the broader labels
// just help people recognise their business in search.
const WIZARD_INDUSTRIES: { label: string; cat: WizardAnswers['industry']; icon: LucideIcon }[] = [
  { label: 'Construction', cat: 'construction', icon: HardHat },
  { label: 'General Contracting', cat: 'construction', icon: HardHat },
  { label: 'Trades (electrical, plumbing, HVAC)', cat: 'construction', icon: Wrench },
  { label: 'Manufacturing', cat: 'construction', icon: Factory },
  { label: 'SaaS / Subscription', cat: 'saas', icon: Cloud },
  { label: 'Software / Technology', cat: 'saas', icon: Code },
  { label: 'Media / Photography', cat: 'saas', icon: Camera },
  { label: 'Retail', cat: 'retail', icon: Store },
  { label: 'E-commerce', cat: 'retail', icon: ShoppingCart },
  { label: 'Wholesale / Distribution', cat: 'retail', icon: Truck },
  { label: 'Restaurant', cat: 'retail', icon: Utensils },
  { label: 'Café / Bar', cat: 'retail', icon: Coffee },
  { label: 'Food & Beverage', cat: 'retail', icon: Wine },
  { label: 'Hospitality / Hotels', cat: 'retail', icon: Hotel },
  { label: 'Professional Services', cat: 'services', icon: Briefcase },
  { label: 'Consulting', cat: 'services', icon: Briefcase },
  { label: 'Marketing / Creative Agency', cat: 'services', icon: Megaphone },
  { label: 'Legal / Accounting', cat: 'services', icon: Scale },
  { label: 'Healthcare / Medical', cat: 'services', icon: HeartPulse },
  { label: 'Real Estate', cat: 'services', icon: Home },
  { label: 'Education / Training', cat: 'services', icon: GraduationCap },
  { label: 'Fitness / Wellness', cat: 'services', icon: Dumbbell },
  { label: 'Salon / Personal Care', cat: 'services', icon: Scissors },
  { label: 'Travel / Transportation', cat: 'services', icon: Plane },
  { label: 'Agriculture / Farming', cat: 'general', icon: Sprout },
  { label: 'Arts / Creative', cat: 'general', icon: Palette },
  { label: 'Nonprofit', cat: 'general', icon: Landmark },
  { label: 'General business', cat: 'general', icon: Building2 },
]

// Impact copy: the single source of truth for both the account `setupNote`
// and the live side-panel reason, so the two can never drift.
const COPY = {
  q1: (ind: string) => `We will pre-load the accounts that most ${ind} businesses use, so you do not begin from a blank page. You can remove any you do not need on the review step.`,
  q2_sole: "We will set up Owner's Capital and Owner's Draw. You will not have formal Retained Earnings; profit flows through to your personal return.",
  q2_partner: "We will create a capital account and a draw account for each partner, so you can track every owner's contributions and distributions.",
  q2_scorp: "We will add Common Stock, Additional Paid-in Capital, Shareholder Distributions, Retained Earnings, and a Shareholder Loan account.",
  q2_ccorp: "We will add Capital Stock, Additional Paid-in Capital, Retained Earnings, and Dividends Payable, with optional Preferred Stock.",
  q3_accrual: "We will add Accounts Receivable, Accounts Payable, Prepaid Expenses, and Accrued Liabilities, so your books reflect what you are owed and what you owe, not only cash.",
  q3_cash: "We will leave out receivables, payables, and accruals, so your chart of accounts stays lean.",
  q4_yes: "We will add an Inventory asset account and a Cost of Goods Sold account, so you can match product costs to sales.",
  q4_no: "No accounts are added; your chart of accounts stays service-only, with no inventory or cost-of-goods-sold accounts.",
  q5_yes: "We will add payroll expense and payroll-tax liability accounts, so wages and the taxes you withhold are tracked separately.",
  q5_no: "No accounts are added; there are no payroll or payroll-tax accounts.",
  q6_yes: "We will add a Sales Tax Payable account to hold the tax you collect until you remit it.",
  q6_no: "No accounts are added; there is no sales-tax liability account.",
  q7_yes: "We will add fixed-asset accounts, together with Accumulated Depreciation and Depreciation Expense, so you can capitalize and depreciate large purchases.",
  q7_no: "No accounts are added; there are no fixed-asset or depreciation accounts.",
  q8_yes: "We will add loan and interest accounts, so financing and the interest you pay are tracked.",
  q8_no: "No accounts are added; there are no loan or interest accounts.",
  q9_yes: "We will add foreign-exchange gain and loss accounts, and flag any account held in a non-base currency for revaluation.",
  q9_no: "No accounts are added; your books are single-currency, with no foreign-exchange gain or loss accounts.",
}

const QUESTIONS: { id: string; title: string; short: string }[] = [
  { id: 'q1', title: 'What does your business do?', short: 'Business' },
  { id: 'q2', title: 'How is your business structured for tax?', short: 'Tax setup' },
  { id: 'q3', title: 'What accounting method do you use?', short: 'Method' },
  { id: 'q4', title: 'Do you sell products and track inventory?', short: 'Inventory' },
  { id: 'q5', title: 'Do you run payroll or have employees?', short: 'Payroll' },
  { id: 'q6', title: 'Do you collect sales tax / VAT / GST?', short: 'Sales tax' },
  { id: 'q7', title: 'Do you own fixed assets (equipment, vehicles, property)?', short: 'Fixed assets' },
  { id: 'q8', title: 'Do you have loans, credit lines, or financing?', short: 'Financing' },
  { id: 'q9', title: 'Will you transact in more than one currency?', short: 'Currency' },
]

type Ctx = { taxCodeId?: string }

const mk = (
  key: string,
  accountName: string,
  accountType: AccountType,
  source: string,
  setupNote: string,
  extra: Partial<WizardAccount> = {},
): WizardAccount => ({ key, accountName, accountType, statementClassification: extra.statementClassification ?? DEFAULT_CLASSIFICATION_BY_CATEGORY[accountType], source, setupNote, checked: true, ...extra })

// Partner rows for the partnership / multi-member LLC equity setup. Each
// partner yields a capital and a draw account; the generated account names are
// editable (stored as overrides; blank falls back to the derived default).
interface PartnerRow { name: string; capital: string; draw: string }
function parsePartners(answers: Record<string, string>): PartnerRow[] {
  const raw = answers.q2_partner_rows
  if (raw) {
    try {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return arr.map((r: any) => ({ name: String(r.name ?? ''), capital: String(r.capital ?? ''), draw: String(r.draw ?? '') }))
    } catch { /* fall through to legacy names */ }
  }
  return (answers.q2_partners || '').split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name, capital: '', draw: '' }))
}
const partnerCapital = (r: PartnerRow) => r.capital.trim() || `${r.name} Capital`
const partnerDraw = (r: PartnerRow) => r.draw.trim() || `${r.name} Draw`

// Deterministically rebuild the entire working set from the current answers.
// Re-answering a prior question recomputes from scratch (no orphans).
function buildWorkingSet(answers: Record<string, string>, ctx: Ctx): WizardAccount[] {
  const list: WizardAccount[] = []
  const q1 = answers.q1
  const industryLabel = answers.q1_label || 'general business'

  // ---- Always-included base accounts ----
  const coreNote = 'A core operating expense that most businesses carry.'
  list.push(mk('base_cash', 'Operating Cash', 'AST', 'base',
    'Every chart of accounts needs at least one cash or bank account; this is where day-to-day money received and paid is recorded.', { isCashBank: true }))
  list.push(mk('base_sales', 'Sales Revenue', 'REV', 'base',
    'A general revenue account, so you always have a place to record income, whatever your business sells.'))
  list.push(mk('base_rent', 'Rent', 'EXP', 'base', coreNote, { coreExpense: 'Rent' }))
  list.push(mk('base_util', 'Utilities', 'EXP', 'base', coreNote, { coreExpense: 'Utilities' }))
  list.push(mk('base_supplies', 'Office Supplies', 'EXP', 'base', coreNote, { coreExpense: 'Office Supplies' }))
  list.push(mk('base_bankfees', 'Bank Fees', 'EXP', 'base', coreNote, { coreExpense: 'Bank Fees' }))

  // ---- Q1, industry ----
  if (q1) {
    const n = COPY.q1(industryLabel)
    if (q1 === 'construction') {
      list.push(mk('q1_wip', 'Work in Process', 'AST', 'q1', n))
      list.push(mk('q1_jobmat', 'Job Materials', 'AST', 'q1', n))
      list.push(mk('q1_contrev', 'Contract Revenue', 'REV', 'q1', n))
      list.push(mk('q1_cos', 'Cost of Sales', 'EXP', 'q1', n, { statementClassification: 'Cost of goods sold' }))
    } else if (q1 === 'retail') {
      list.push(mk('q1_inv', 'Inventory', 'AST', 'q1', n))
      list.push(mk('q1_cogs', 'Cost of Goods Sold', 'EXP', 'q1', n, { statementClassification: 'Cost of goods sold' }))
      list.push(mk('q1_returns', 'Sales Returns', 'REV', 'q1', n, { isContra: true }))
    } else if (q1 === 'services') {
      list.push(mk('q1_svc', 'Service Revenue', 'REV', 'q1', n))
      list.push(mk('q1_reimb', 'Reimbursable Expenses', 'EXP', 'q1', n))
    } else if (q1 === 'restaurant') {
      list.push(mk('q1_fbcogs', 'Food & Beverage COGS', 'EXP', 'q1', n, { statementClassification: 'Cost of goods sold' }))
      list.push(mk('q1_tips', 'Tips Payable', 'LIA', 'q1', n))
    } else if (q1 === 'saas') {
      list.push(mk('q1_subrev', 'Subscription Revenue', 'REV', 'q1', n))
      list.push(mk('q1_defrev', 'Deferred Revenue', 'LIA', 'q1', n))
    }
    // 'general' → base set only
  }

  // ---- Q2, equity (shapes the equity section) ----
  const q2 = answers.q2
  if (q2 === 'sole') {
    list.push(mk('q2_owncap', "Owner's Capital", 'EQT', 'q2', COPY.q2_sole))
    list.push(mk('q2_owndraw', "Owner's Draw", 'EQT', 'q2', COPY.q2_sole))
  } else if (q2 === 'partnership' || q2 === 'mmllc') {
    parsePartners(answers).filter(p => p.name.trim()).forEach((p, i) => {
      list.push(mk(`q2_pcap_${i}`, partnerCapital(p), 'EQT', 'q2', COPY.q2_partner))
      list.push(mk(`q2_pdraw_${i}`, partnerDraw(p), 'EQT', 'q2', COPY.q2_partner))
    })
  } else if (q2 === 'scorp' || q2 === 'llc_scorp') {
    list.push(mk('q2_common', 'Common Stock', 'EQT', 'q2', COPY.q2_scorp))
    list.push(mk('q2_apic', 'Additional Paid-in Capital', 'EQT', 'q2', COPY.q2_scorp))
    list.push(mk('q2_distr', 'Shareholder Distributions', 'EQT', 'q2', COPY.q2_scorp))
    list.push(mk('q2_re', 'Retained Earnings', 'EQT', 'q2', COPY.q2_scorp))
    list.push(mk('q2_shloan', 'Shareholder Loan', 'LIA', 'q2', COPY.q2_scorp))
  } else if (q2 === 'ccorp') {
    list.push(mk('q2_capstock', 'Capital Stock', 'EQT', 'q2', COPY.q2_ccorp))
    list.push(mk('q2_apic', 'Additional Paid-in Capital', 'EQT', 'q2', COPY.q2_ccorp))
    list.push(mk('q2_re', 'Retained Earnings', 'EQT', 'q2', COPY.q2_ccorp))
    list.push(mk('q2_divpay', 'Dividends Payable', 'LIA', 'q2', COPY.q2_ccorp))
    if (answers.q2_preferred === 'yes') list.push(mk('q2_pref', 'Preferred Stock', 'EQT', 'q2', COPY.q2_ccorp))
  }

  // ---- Q3, accounting method ----
  if (answers.q3 === 'accrual') {
    list.push(mk('q3_ar', 'Accounts Receivable', 'AST', 'q3', COPY.q3_accrual))
    list.push(mk('q3_ap', 'Accounts Payable', 'LIA', 'q3', COPY.q3_accrual))
    list.push(mk('q3_prepaid', 'Prepaid Expenses', 'AST', 'q3', COPY.q3_accrual))
    list.push(mk('q3_accrued', 'Accrued Liabilities', 'LIA', 'q3', COPY.q3_accrual))
    if (q1 === 'saas') list.push(mk('q3_defrev', 'Deferred Revenue', 'LIA', 'q3', COPY.q3_accrual))
  }

  // ---- Q4, inventory ----
  if (answers.q4 === 'yes') {
    list.push(mk('q4_inv', 'Inventory', 'AST', 'q4', COPY.q4_yes))
    list.push(mk('q4_cogs', 'Cost of Goods Sold', 'EXP', 'q4', COPY.q4_yes, { statementClassification: 'Cost of goods sold' }))
    list.push(mk('q4_invadj', 'Inventory Adjustments', 'EXP', 'q4', COPY.q4_yes, { statementClassification: 'Cost of goods sold' }))
  }

  // ---- Q5, payroll ----
  if (answers.q5 === 'yes') {
    list.push(mk('q5_wages', 'Wages & Salaries Expense', 'EXP', 'q5', COPY.q5_yes))
    list.push(mk('q5_ptax', 'Payroll Taxes Payable', 'LIA', 'q5', COPY.q5_yes))
    list.push(mk('q5_benefits', 'Employee Benefits Expense', 'EXP', 'q5', COPY.q5_yes))
    if (answers.q2 === 'scorp' || answers.q2 === 'llc_scorp') {
      list.push(mk('q5_officer', 'Officer / Shareholder Salary', 'EXP', 'q5', COPY.q5_yes))
    }
  }

  // ---- Q6, sales tax ----
  if (answers.q6 === 'yes') {
    list.push(mk('q6_taxpay', 'Sales Tax Payable', 'LIA', 'q6', COPY.q6_yes, { taxCodeId: ctx.taxCodeId, taxCodeMapped: true }))
  }

  // ---- Q7, fixed assets ----
  if (answers.q7 === 'yes') {
    list.push(mk('q7_fa', 'Fixed Assets', 'AST', 'q7', COPY.q7_yes))
    list.push(mk('q7_accdep', 'Accumulated Depreciation', 'AST', 'q7', COPY.q7_yes, { isContra: true }))
    list.push(mk('q7_depexp', 'Depreciation Expense', 'EXP', 'q7', COPY.q7_yes))
  }

  // ---- Q8, financing ----
  if (answers.q8 === 'yes') {
    list.push(mk('q8_loans', 'Current Loans and Notes Payable', 'LIA', 'q8', COPY.q8_yes))
    list.push(mk('q8_ltdebt', 'Long-Term Debt', 'LIA', 'q8', COPY.q8_yes))
    list.push(mk('q8_cc', 'Credit Card Payable', 'LIA', 'q8', COPY.q8_yes))
    list.push(mk('q8_int', 'Interest Expense', 'EXP', 'q8', COPY.q8_yes))
  }

  // ---- Q9, multi-currency ----
  if (answers.q9 === 'yes') {
    list.push(mk('q9_fxr', 'Realized FX Gain/Loss', 'REV', 'q9', COPY.q9_yes))
    list.push(mk('q9_fxu', 'Unrealized FX Gain/Loss', 'REV', 'q9', COPY.q9_yes))
  }

  // Dedupe by name (first occurrence wins, earlier, more specific sources).
  const seen = new Set<string>()
  return list.filter(a => {
    const k = a.accountName.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// Merge a freshly-built set with the prior one so review-step edits (checked
// state, renames, ad-hoc accounts) survive a recompute.
function reconcile(base: WizardAccount[], prev: WizardAccount[]): WizardAccount[] {
  const prevByKey = new Map(prev.map(a => [a.key, a]))
  const merged = base.map(b => {
    const p = prevByKey.get(b.key)
    if (!p) return b
    return { ...b, checked: p.checked, accountName: p.renamed ? p.accountName : b.accountName, renamed: p.renamed }
  })
  const customs = prev.filter(a => a.custom)
  return [...merged, ...customs]
}

function impactReason(qid: string, answers: Record<string, string>): string {
  const v = answers[qid]
  if (!v) return ''
  switch (qid) {
    case 'q1': return COPY.q1(answers.q1_label || 'general business')
    case 'q2':
      return v === 'sole' ? COPY.q2_sole
        : v === 'partnership' || v === 'mmllc' ? COPY.q2_partner
        : v === 'scorp' || v === 'llc_scorp' ? COPY.q2_scorp
        : v === 'ccorp' ? COPY.q2_ccorp : ''
    case 'q3': return v === 'accrual' ? COPY.q3_accrual : COPY.q3_cash
    case 'q4': return v === 'yes' ? COPY.q4_yes : COPY.q4_no
    case 'q5': return v === 'yes' ? COPY.q5_yes : COPY.q5_no
    case 'q6': return v === 'yes' ? COPY.q6_yes : COPY.q6_no
    case 'q7': return v === 'yes' ? COPY.q7_yes : COPY.q7_no
    case 'q8': return v === 'yes' ? COPY.q8_yes : COPY.q8_no
    case 'q9': return v === 'yes' ? COPY.q9_yes : COPY.q9_no
    default: return ''
  }
}

function requiredMissing(checked: WizardAccount[]): string[] {
  const missing: string[] = []
  if (!checked.some(a => a.isCashBank)) missing.push('a Cash/Bank account')
  if (!checked.some(a => a.accountType === 'EQT')) missing.push('an Equity account')
  if (!checked.some(a => a.accountType === 'REV')) missing.push('a Revenue account')
  ;['Rent', 'Utilities', 'Office Supplies', 'Bank Fees'].forEach(name => {
    if (!checked.some(a => a.coreExpense === name)) missing.push(name)
  })
  return missing
}

// =====================================================================
// Guided wizard, four clubbed question screens that generate a chart from the
// master chart (computeWizardChart), then a Review & publish step.
// =====================================================================
const WIZARD_STEP_LABELS = ['Overview', 'Industry', 'Entity', 'Method', 'Operations', 'Expenses', 'Balances', 'Review']

// When "Lean" expense detail is chosen, these optional operating-expense and
// miscellaneous leaves are pre-unchecked on review (the user can re-check).
const LEAN_EXCLUDE = new Set(['6130', '6240', '6320', '6330', '6430', '6510', '6800', '6810', '6900', '4900', '7900', '8900', '1450', '1400', '1030', '1060'])

/* Which statement classification a wizard row groups under. The master chart
   states one on every row, so read it there rather than guessing from the
   number - the number places nothing. A custom account the user typed isn't in
   the catalogue, so it falls back to its category's first classification. */
const classificationOf = (num: string, cat?: AccountType): StatementClassification =>
  MASTER_CHART.find(e => e.number === num)?.statementClassification
  ?? DEFAULT_CLASSIFICATION_BY_CATEGORY[cat ?? 'AST']

// Which side an opening balance posts on. Asset / Expense / COGS are
// debit-normal; everything else is credit-normal. Contra accounts post on the
// opposite side of their type's normal balance.
const postsDebit = (type: MasterChartEntry['type'], isContra?: boolean) => {
  const code = TYPE_TO_CODE[type]
  const typeDebit = code === 'AST' || code === 'EXP'
  return isContra ? !typeDebit : typeDebit
}
// "Jun 2026"-style period label from the fiscal-year-start date.
const periodLabel = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

// True when `value` fully matches the configured numbering scheme's segment
// pattern (e.g. 4 flat digits, or 3-4-2 segmented). Partially-typed numbers
// return false so validation doesn't fire mid-edit.
const numberComplete = (scheme: NumberingScheme, value: string) => {
  const pattern = scheme.segments.map((s, i) => `\\d{${s.length}}` + (i < scheme.segments.length - 1 ? s.separator : '')).join('')
  return new RegExp(`^${pattern}$`).test(value)
}
// Project the user's staged accounts into a MasterChartEntry[] working set,
// ordered parents-first so the publish step can resolve hierarchy. Account.type
// is already an AccountType code, matching MasterChartEntry.type.
function deriveScratchChart(accounts: Account[]): MasterChartEntry[] {
  const numById = new Map(accounts.map(a => [a.id, a.accountNumber]))
  const entries: MasterChartEntry[] = accounts.map(a => ({
    number: a.accountNumber,
    name: a.accountName,
    type: a.accountType,
    statementClassification: a.statementClassification,
    isContra: a.isContra,
    parentNumber: a.parentId ? numById.get(a.parentId) ?? null : null,
    posting: a.isPosting ? 'Posting' : 'Summary',
    wizardTrigger: 'Always',
    description: a.description ?? '',
  }))
  const byNum = new Map(entries.map(e => [e.number, e]))
  const depth = (e: MasterChartEntry) => { let d = 0, cur = e.parentNumber; while (cur) { d++; cur = byNum.get(cur)?.parentNumber ?? null } return d }
  return entries.sort((a, b) => depth(a) - depth(b) || a.number.localeCompare(b.number, undefined, { numeric: true }))
}

/* Inline-editable account-number field used on the Cash & Revenue and Review
   steps. A duplicate is the only thing a number can be, now: no category owns a
   block, so there is no range to be outside of and nothing to warn about. */
function AccountNumberInput({ value, selfId, scheme, numbers, onCommit, readOnly }: {
  value: string
  selfId: string
  scheme: NumberingScheme
  numbers: { id: string; number: string; name: string }[]
  onCommit: (v: string) => void
  readOnly?: boolean
}) {
  const [draft, setDraft] = useState(value)
  const [dupName, setDupName] = useState<string | null>(null)

  useEffect(() => { setDraft(value) }, [value])

  // Debounced duplicate check (BR-001): exact match against the working set,
  // skipping the row's own current number.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!numberComplete(scheme, draft)) { setDupName(null); return }
      const conflict = numbers.find(n => n.id !== selfId && n.number === draft)
      setDupName(conflict ? conflict.name : null)
    }, 200)
    return () => clearTimeout(t)
  }, [draft, numbers, selfId, scheme])

  if (readOnly) return <span className="text-xs text-fg-muted">{value}</span>

  return (
    <span className="inline-flex flex-col items-end">
      <input
        value={draft}
        onFocus={e => { e.currentTarget.select() }}
        onChange={e => { setDraft(e.target.value); onCommit(e.target.value) }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        className={cn('h-8 w-20 px-2 text-right text-xs bg-white border rounded-md focus:outline-none focus:ring-2 transition-all',
          dupName ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/10'
            : 'border-border focus:border-fg/40 focus:ring-fg/5')}
      />
      {dupName && <span className="text-2xs text-danger-700 mt-1 text-right max-w-[200px]">Number {draft} already used by {dupName}.</span>}
    </span>
  )
}

const STEP = { OVERVIEW: 0, BUSINESS: 1, OPERATIONS: 2, CASH: 3, EXTRAS: 4, BALANCES: 5, REVIEW: 6, PREVIEW: 7, PUBLISHING: 8, TABLE: 9 }

// Per-step left-pane heading copy. Drives the "Step N" chip + big heading +
// subtitle that opens every wizard step (the inner screens no longer carry
// their own heading). Overview copy varies by path; everything else is shared.
const OVERVIEW_COPY: Record<'wizard' | 'upload' | 'scratch', { title: string; subtitle: string }> = {
  wizard: { title: 'Build your chart of accounts', subtitle: 'Answer a brief questionnaire and we will generate a chart of accounts for you' },
  upload: { title: 'Bring in your chart of accounts', subtitle: 'Import your existing chart, then map fields, set balances, and review.' },
  scratch: { title: 'Build your chart from scratch', subtitle: 'Add accounts and review.' },
}
/* The scratch flow's dimensions step. Named and worded here rather than
   inline because the step label is also the tab label, and the two must not
   drift.

   The noun is the module's, and the same one the import flow asks with, so a
   reader who builds a chart here and imports one later meets one concept rather
   than two. */
export const SCRATCH_DIMENSIONS_LABEL = 'Dimensions'
export const SCRATCH_DIMENSIONS_COPY = {
  title: 'What do you want to report by?',
  subtitle: 'Add the things your company wants to organize and filter accounts by, such as Location or Department.',
  skipHint: 'You can skip this and add dimensions later.',
  emptyHint: 'Add a dimension, such as Location, and list its values. You\'ll pick these values when you create each account.',
}

/* The trail the scratch reader sees along the top. Named because the walkthrough
   recites it on its first card, and a stepper the tour reads back wrongly is
   worse than a tour that never mentions it. */
export const SCRATCH_STEP_LABELS = [NUMBERING_STEP_LABEL, SCRATCH_DIMENSIONS_LABEL, 'Accounts']

/* What the walkthrough stands in the editor while it runs. The step opens empty,
   so two of the cards would otherwise point at an empty box and explain the box.
   The real editor holding an example, not a diagram of one - the same trade the
   import's tour makes with `walkthroughExample.tsx`.

   The same two filters and the same values the Learn panel and the cards use, so
   the reader meets one worked example rather than three. Never written to the
   store: the tour is a reading of the step, and a reader who takes it should
   arrive at an editor as empty as they left it. */
export const DIMENSIONS_DEMO_DIMENSIONS: Dimension[] = [
  { id: '__demo-location', name: 'Location', values: ['USA', 'Hong Kong', 'Singapore', 'United Kingdom'], status: 'Active', createdAt: '', updatedAt: '' },
  { id: '__demo-department', name: 'Department', values: ['Business', 'Design', 'Engineering', 'Sales', 'Operations'], status: 'Active', createdAt: '', updatedAt: '' },
]

const STEP_COPY: Record<string, { title: string; subtitle: string }> = {
  Business: { title: 'Tell us about your business', subtitle: 'Your industry, entity type, and accounting method shape the core of your chart.' },
  Industry: { title: 'What industry are you in?', subtitle: 'We pre-load the accounts most businesses in your industry use, so you do not start from a blank page.' },
  Entity: { title: "What's your entity type?", subtitle: 'Your legal structure shapes your equity and owner accounts.' },
  Method: { title: 'Which accounting method?', subtitle: 'Cash or accrual determines when income and expenses are recorded.' },
  Operations: { title: 'What your business does', subtitle: 'Toggle the activities that apply so we add the right accounts.' },
  Expenses: { title: 'Expense detail and extras', subtitle: 'Choose how granular your expense accounts should be.' },
  // "Enter", as the account's own Actions menu says it. One verb for one thing,
  // or setup and the chart name the same job differently.
  Balances: { title: 'Enter opening balances', subtitle: 'The figure each posting account starts from.' },
  Review: { title: 'Review your chart of accounts', subtitle: 'Check the accounts, numbers, and names before publishing.' },
  'Upload file': { title: 'Upload your file', subtitle: 'Choose your existing chart of accounts file to import.' },
  'Field mapping': { title: 'Confirm field mapping', subtitle: 'Match each column in your file to a chart-of-accounts field.' },
  [NUMBERING_STEP_LABEL]: { title: NUMBERING_STEP_TITLE, subtitle: NUMBERING_STEP_SUBTITLE },
  [SCRATCH_DIMENSIONS_LABEL]: { title: SCRATCH_DIMENSIONS_COPY.title, subtitle: SCRATCH_DIMENSIONS_COPY.subtitle },
  Accounts: { title: 'Add your accounts', subtitle: 'Add the accounts your business uses.' },
}
function stepCopy(mode: 'wizard' | 'upload' | 'scratch', label: string) {
  if (label === 'Overview') return OVERVIEW_COPY[mode]
  return STEP_COPY[label] ?? { title: label, subtitle: '' }
}

// The left-pane heading block: a "Step N" chip, a large heading, and a subtitle.
function WizardStepHeader({ stepIndex, title, subtitle, showStep = true }: { stepIndex: number; title: string; subtitle?: string; showStep?: boolean }) {
  return (
    <div className="mb-8">
      {showStep && <span className="inline-block text-2xs uppercase tracking-wider text-primary bg-brand-50 px-2.5 py-1 rounded font-semibold">Step {stepIndex + 1}</span>}
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg">{title}</h1>
      {subtitle && <p className="mt-2 text-base text-fg-muted max-w-2xl leading-relaxed">{subtitle}</p>}
    </div>
  )
}

export function GuidedWizard({ mode = 'wizard', presentation = 'page', onClose }: { mode?: 'wizard' | 'upload' | 'scratch'; presentation?: 'page' | 'modal'; onClose?: () => void }) {
  const navigate = useNavigate()
  const isUpload = mode === 'upload'
  const isScratch = mode === 'scratch'
  // `modal` is the compact stepper chrome + direct-publish behavior, floating
  // over whatever opened it and expandable to full view from its own header.
  // `page` is the route-based full wizard with its own Preview / Publishing /
  // Table stages.
  const isModal = presentation === 'modal'
  const chromeVariant: 'modal' | 'fullscreen' = isModal ? 'modal' : 'fullscreen'
  // Build-from-scratch takes the wider measure on its single-column steps: its
  // steps are a numbering scheme, a dimensions list and an accounts table, and a
  // table read at the reading measure of a paragraph is a table with its columns
  // crushed. A width belongs to what is on the step, so it does not change when
  // the reader expands or shrinks the panel around it.
  const wide = isScratch
  // Mode-aware step indices. Every object carries every key (absent steps map
  // to -1) so `STEP.X` is always type-safe and never matches the live step.
  // Build-from-scratch drops the Overview step entirely (its guidance moved to
  // the "Learn" sheet), so it starts on Numbering: a number cannot be suggested
  // before its width is known, so the scheme is this flow's own first step rather
  // than something the landing settles for all three paths.
  const STEP = isUpload
    ? { OVERVIEW: 0, UPLOAD: 1, MAPPING: 2, BALANCES: 3, REVIEW: 4, PREVIEW: 5, PUBLISHING: 6, TABLE: 7, BUSINESS: -1, INDUSTRY: -1, ENTITY: -1, METHOD: -1, OPERATIONS: -1, CASH: -1, EXTRAS: -1, NUMBERING: -1, RULES: -1, DIMENSIONS: -1, ACCOUNTS: -1 }
    : isScratch
    // Scratch is now a single Accounts page: the Review step is hidden for now
    // (kept in code, just skipped) → REVIEW/PREVIEW: -1. The "Create" CTA
    // publishes straight from Accounts into the Publishing stage.
    // Dimensions come before Accounts because an account can carry group
    // filter defaults, so they have to exist before the accounts do. The step is
    // skippable: a chart that reports by nothing is a valid chart.
    ? { NUMBERING: 0, DIMENSIONS: 1, ACCOUNTS: 2, PUBLISHING: 3, TABLE: 4, PREVIEW: -1, REVIEW: -1, OVERVIEW: -1, BALANCES: -1, RULES: -1, BUSINESS: -1, INDUSTRY: -1, ENTITY: -1, METHOD: -1, OPERATIONS: -1, CASH: -1, EXTRAS: -1, UPLOAD: -1, MAPPING: -1 }
    // Guided wizard: the business profile is split into three per-question steps
    // (Industry, Entity, Method) before Operations.
    : { OVERVIEW: 0, INDUSTRY: 1, ENTITY: 2, METHOD: 3, OPERATIONS: 4, EXTRAS: 5, BALANCES: 6, REVIEW: 7, PREVIEW: 8, PUBLISHING: 9, TABLE: 10, BUSINESS: -1, CASH: -1, UPLOAD: -1, MAPPING: -1, NUMBERING: -1, RULES: -1, DIMENSIONS: -1, ACCOUNTS: -1 }
  const STEP_LABELS = isUpload
    ? ['Overview', 'Upload file', 'Field mapping', 'Balances', 'Review']
    : isScratch
    ? SCRATCH_STEP_LABELS
    : WIZARD_STEP_LABELS
  const company = useStore(s => s.company)
  const dimensions = useStore(s => s.dimensions)
  const addDimension = useStore(s => s.addDimension)
  const updateDimension = useStore(s => s.updateDimension)
  const deleteDimension = useStore(s => s.deleteDimension)
  const [step, setStep] = useState(0)
  const [maxStep, setMaxStep] = useState(0)
  // The "Learn" guide, opened from the wizard header.
  const [learnOpen, setLearnOpen] = useState(false)

  /* ──── The dimensions walkthrough ────────────────────────────────────
     Offered once a session, the first time a scratch build reaches the group
     filters step. That step is the only place a customer building from nothing
     meets the idea, and it opens on an empty editor, so there is nothing on
     screen to read the concept off. See `dimensionsCards.tsx`.

     Two pieces of state: whether it is up, and whether the active card wants the
     editor stood up with something in it. There is no step to remember, because
     the tour never leaves the one it opened on. */
  const [walkthrough, setWalkthrough] = useState(false)
  const [walkthroughDemo, setWalkthroughDemo] = useState<string | null>(null)

  useEffect(() => {
    if (!isScratch || !isModal || step !== STEP.DIMENSIONS) return
    /* The panel is mid-move as this fires: it springs its own height and the
       step's body paints inside it. The delay waits for the room to settle and
       then knocks.

       The session flag is spent when the timer FIRES, not when it is armed.
       Spending it up here would mean the tour never opened at all under Strict
       Mode, which mounts, unmounts and remounts every effect: the first pass
       would take the flag, the cleanup would cancel its timer, and the second
       pass would find the flag already gone. */
    const t = window.setTimeout(() => {
      if (!takeFirstWalkthrough('dimensions')) return
      setWalkthrough(true)
    }, WALKTHROUGH_OPEN_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [isScratch, isModal, step, STEP.DIMENSIONS])

  /* The door back in, from the bottom of the Learn panel. The panel is closed on
     the way through: it covers most of the modal, and every card points at
     something behind it. */
  const startWalkthrough = useCallback(() => {
    setLearnOpen(false)
    setWalkthrough(true)
  }, [])
  const closeWalkthrough = useCallback(() => {
    setWalkthrough(false)
    setWalkthroughDemo(null)
  }, [])
  /* Every card is about this one step, so there is nowhere for the tour to take
     the wizard. Both are here because the overlay is shared with a tour that does
     move, and stable identities matter: it keys its navigation effect on them. */
  const walkthroughStep: DimensionsStep = 'dimensions'
  const walkthroughGoToStep = useCallback(() => {}, [])
  const setDemo = useCallback((d: string | null) => setWalkthroughDemo(d), [])

  /* ──── The account numbers walkthrough ──────────────────────────────
     Offered once a session, the first time the Number length step is reached -
     the first step of the build, which had no introduction of its own until the
     design review of 2026-10-02. See `numberingCards.tsx`. Nothing to demo:
     the step is never empty. */
  const [numberTour, setNumberTour] = useState(false)
  useEffect(() => {
    if (!isScratch || !isModal || step !== STEP.NUMBERING) return
    const t = window.setTimeout(() => {
      if (!takeFirstWalkthrough('numbering-scratch')) return
      setNumberTour(true)
    }, WALKTHROUGH_OPEN_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [isScratch, isModal, step, STEP.NUMBERING])
  const startNumberTour = useCallback(() => {
    setLearnOpen(false)
    setNumberTour(true)
  }, [])
  const closeNumberTour = useCallback(() => setNumberTour(false), [])
  const numberTourStep: NumberingStep = 'numbering'
  const noDemo = useCallback(() => {}, [])

  /* ──── The chart of accounts walkthrough ─────────────────────────────
     Offered once a session, the first time the Accounts step is reached, the
     way the dimensions tour is on its step. Build from scratch only: Guided
     setup has no walkthrough (Mahad, 2026-10-02). See `chartCards.tsx`. The
     demo stands three example accounts under Assets while a card wants rows to
     point at. */
  const [chartTour, setChartTour] = useState(false)
  const [chartTourDemo, setChartTourDemo] = useState<string | null>(null)
  useEffect(() => {
    if (!isScratch || !isModal || step !== STEP.ACCOUNTS) return
    const t = window.setTimeout(() => {
      if (!takeFirstWalkthrough('chart')) return
      setChartTour(true)
    }, WALKTHROUGH_OPEN_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [isScratch, isModal, step, STEP.ACCOUNTS])
  const startChartTour = useCallback(() => {
    setLearnOpen(false)
    setChartTour(true)
  }, [])
  const closeChartTour = useCallback(() => {
    setChartTour(false)
    setChartTourDemo(null)
  }, [])
  const chartTourStep: ChartStep = 'accounts'
  const setChartDemo = useCallback((d: string | null) => setChartTourDemo(d), [])
  // Fiscal-year step: seeded from the company value; committed to the store when
  // the user advances past the step.
  // Upload-flow state: the chosen file and its parsed/imported working set.
  const [uploadedFile, setUploadedFile] = useState<string | null>(null)
  // Field-mapping selections (Upload step 2), lifted here so the step can be
  // gated until every column is mapped.
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const mappingComplete = MAPPING_COLUMNS.every(c => !!columnMapping[c])
  const importedChart = useMemo(
    () => (uploadedFile ? computeWizardChart({ ...EMPTY_ANSWERS, entity: 'llc', accountingMethod: 'accrual', payroll: true, fixedAssets: true, salesTax: true }) : []),
    [uploadedFile],
  )
  // Build-from-Scratch state: the draft numbering scheme, tenant defaults, the
  // accounts staged on the Accounts step, and the Add/Edit slide-over.
  // The scheme is edited on this flow's first step and committed at publish, so
  // everything downstream (number suggestions, the five category anchors) reads
  // the draft rather than the store.
  const [numbering, setNumbering] = useState(DEFAULT_NUMBER_WIDTH)
  /* The block each category keeps, set on the same step (2026-10-01). While a
     block is mid-edit and does not read, the anchors keep the width's defaults;
     Continue waits for it either way. */
  const [categoryRanges, setCategoryRanges] = useState(() => defaultCategoryRanges(DEFAULT_NUMBER_WIDTH))
  const rangesValid = categoryRangesValid(categoryRanges, numbering)
  const [rangesAttempted, setRangesAttempted] = useState(false)
  const schemeDraft = useMemo(
    () => (isScratch && rangesValid ? schemeFromNumbering(numbering, categoryRanges) : schemeFromNumberWidth(numbering)),
    [isScratch, rangesValid, numbering, categoryRanges])
  // The former Rules step is gone; these defaults are hard-coded to sensible
  // values. Hard rules (BR-001..BR-014) are always enforced in the store;
  // auto-suggest and required effective date are part of normal account
  // creation. Revisiting them post-publish belongs to the Numbering settings
  // page (out of scope here).
  const scratchDefaults = { allowNonBaseCurrency: false, autoSuggestNumbers: true, requireEffectiveDate: true }
  // Build-from-Scratch is type-driven: seed the five GAAP category anchors up
  // front so the user starts from Asset / Liability / Equity / Revenue / Expense
  // and adds types down the tree, instead of a blank chart.
  const [localAccounts, setLocalAccounts] = useState<Account[]>(
    () => (isScratch ? seedCategoryAccounts(schemeDraft, { currencyCode: company.baseCurrency, effectiveDate: company.fiscalYearStart }) : []),
  )
  // The anchors are numbered in the width the scheme asks for, so editing the
  // scheme has to rebuild them. Their ids are derived from the category code, so
  // replacing them keeps every account the user added underneath.
  useEffect(() => {
    if (!isScratch) return
    const anchors = seedCategoryAccounts(schemeDraft, { currencyCode: company.baseCurrency, effectiveDate: company.fiscalYearStart })
    setLocalAccounts(prev => [...anchors, ...prev.filter(a => !anchors.some(x => x.id === a.id))])
  }, [schemeDraft])
  const { requestDelete: requestScratchDelete, confirmModal: scratchDeleteModal, lastDelete: scratchLastDelete } = useDeleteWithUndo(localAccounts, setLocalAccounts)
  /* The account whose dimensions a row's "Add dimensions" opened, the same
     action Guided setup's accounts step offers (Mahad, 2026-10-08). Offered
     only once a dimension exists: a build that skipped the Dimensions step has
     nothing to link, as its account form shows no Dimensions step. */
  const [scratchDimsFor, setScratchDimsFor] = useState<Account | null>(null)
  const scratchHasDimensions = dimensions.some(d => d.status === 'Active')
  const [createOpen, setCreateOpen] = useState(false)
  const [createDefaults, setCreateDefaults] = useState<any>(undefined)
  // The group a new account is being added under, so the slide-over opens with it
  // already chosen as the parent. Null for top-level.
  const [createParent, setCreateParent] = useState<Account | null>(null)
  // The posting account a new summary is being built above. Null for an ordinary
  // add; the two are never both set.
  const [wrapAcct, setWrapAcct] = useState<Account | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const { expanded: scratchExpanded, setExpanded: setScratchExpanded } = useTreeExpansion(localAccounts)
  // Accounts-step toolbar state (search + density), mirroring the Warehouse
  // Locations nested-table controls.
  const [scratchQuery, setScratchQuery] = useState('')
  // Accounts-step table state, so the flat COA-style listing supports the same
  // column reorder / filter / freeze / hide interactions as the main Chart of
  // Accounts page (state lives here so it survives step navigation).
  const [scratchColumns, setScratchColumns] = useState<ColumnConfig>(ACCOUNTS_STEP_COLUMNS)
  const [scratchColOrder, setScratchColOrder] = useState<ColKey[]>(DEFAULT_COLUMN_ORDER)
  const [scratchColFilters, setScratchColFilters] = useState<ColFilters>({})
  const [scratchFrozen, setScratchFrozen] = useState<ColKey[]>([])
  /* The column earns its place: a chart with no dimensions has nothing to put
     in it, and a column of empty cells is worse than no column. */
  useEffect(() => {
    if (!isScratch) return
    const on = dimensions.length > 0
    setScratchColumns(prev => prev.dimensions === on ? prev : { ...prev, dimensions: on })
  }, [isScratch, dimensions.length])
  // Layout toggle for the Accounts step, mirroring the main Chart of Accounts
  // page. Defaults to the nested Tree so the category grouping is visible.
  // Review-step toolbar state, same nested-table controls.
  const [reviewQuery, setReviewQuery] = useState('')
  // Reveal a freshly-created sub-account by opening the parent it landed under.
  // useTreeExpansion already opens each new summary; this covers the case where
  // the new row is a posting and its parent was collapsed.
  const seenAccountIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    const fresh = localAccounts.filter(a => !seenAccountIds.current.has(a.id))
    seenAccountIds.current = new Set(localAccounts.map(a => a.id))
    const parents = fresh.map(a => a.parentId).filter((id): id is string => !!id)
    if (parents.length) setScratchExpanded(prev => new Set([...prev, ...parents]))
  }, [localAccounts])
  const sourceByNumber = useMemo(() => new Map(localAccounts.map(a => [a.accountNumber, a])), [localAccounts])
  const handleCreate = (acc: Account) => {
    if (editingId) {
      setLocalAccounts(prev => prev.map(x => x.id === editingId ? { ...acc, id: editingId } : x))
      setEditingId(null)
      return
    }
    // A wrap lands the new summary and moves the account it stands above under
    // it in the same write, so the draft chart is never left with the summary
    // sitting beside the account it was created to total.
    setLocalAccounts(prev => {
      const next = [...prev, isScratch ? nestUnderCategory(acc) : acc]
      return wrapAcct ? next.map(x => x.id === wrapAcct.id ? { ...x, parentId: acc.id } : x) : next
    })
    setEditingId(null)
    setWrapAcct(null)
  }
  const [answers, setAnswers] = useState<WizardAnswers>(EMPTY_ANSWERS)
  const setA = <K extends keyof WizardAnswers>(k: K, v: WizardAnswers[K]) => setAnswers(a => ({ ...a, [k]: v }))
  // The specific industry label the user picked (e.g. "E-commerce"), which maps
  // to one of the five categories stored in answers.industry. Cosmetic, drives
  // the active pill on the Industry step.
  const [industryLabel, setIndustryLabel] = useState<string | null>(null)
  const [partnerInput, setPartnerInput] = useState('2')
  const partnerValid = (() => { const n = Number(partnerInput); return Number.isInteger(n) && n >= 2 && n <= 10 })()
  // Debounce the partner-count input into the answers so typing "23" doesn't
  // momentarily render 23 partners.
  useEffect(() => {
    if (!partnerValid) return
    const t = setTimeout(() => setAnswers(a => ({ ...a, partnerCount: Number(partnerInput) })), 300)
    return () => clearTimeout(t)
  }, [partnerInput, partnerValid])
  const [expenseDetail, setExpenseDetail] = useState<'detailed' | 'lean' | null>(null)
  // Opening balances entered on the Balances step, keyed by account number.
  const [balances, setBalances] = useState<Record<string, number>>({})
  const setBalance = (num: string, amount: number) => setBalances(b => ({ ...b, [num]: amount }))
  // Opening balances start at zero for every posting account; the user fills in
  // any values on the Balances step. (No dummy pre-population.)
  const [overrides, setOverrides] = useState<Record<string, { checked?: boolean; name?: string; number?: string }>>({})
  const [extraAccts, setExtraAccts] = useState<{ key: string; number: string; name: string; type: MasterChartEntry['type'] }[]>([])
  const committed = useRef(false)

  const onReview = step === STEP.REVIEW

  const chart = useMemo(
    () => (isUpload ? importedChart : isScratch ? deriveScratchChart(localAccounts) : computeWizardChart(answers)),
    [isUpload, isScratch, importedChart, localAccounts, answers],
  )

  const screen4Done = expenseDetail !== null
  const canAdvance = (s: number) => {
    if (isUpload) return s === STEP.UPLOAD ? !!uploadedFile : s === STEP.MAPPING ? mappingComplete : true
    if (isScratch) return s === STEP.NUMBERING ? numberWidthValid(numbering) && rangesValid : true
    if (s === STEP.INDUSTRY) return answers.industry !== null
    if (s === STEP.ENTITY) return answers.entity !== null && (!(answers.entity === 'partnership' || answers.entity === 'llc') || partnerValid)
    if (s === STEP.METHOD) return answers.accountingMethod !== null
    if (s === STEP.EXTRAS) return screen4Done
    return true
  }

  const isChecked = (e: MasterChartEntry) => {
    const o = overrides[e.number]
    if (o?.checked !== undefined) return o.checked
    if (e.posting === 'Summary') return true
    if (expenseDetail === 'lean' && LEAN_EXCLUDE.has(e.number)) return false
    return true
  }
  const nameOf = (e: MasterChartEntry) => overrides[e.number]?.name ?? e.name
  // Effective (possibly user-edited) account number, keyed by the master number.
  const numberOf = (e: MasterChartEntry) => overrides[e.number]?.number ?? e.number
  const setOverride = (num: string, patch: { checked?: boolean; name?: string; number?: string }) =>
    setOverrides(o => ({ ...o, [num]: { ...o[num], ...patch } }))
  const scheme = isScratch ? schemeDraft : useStore.getState().numberingScheme

  const go = (s: number) => { setStep(s); setMaxStep(m => Math.max(m, s)) }
  const exit = () => { if (onClose) { onClose(); return } navigate('/chart-of-accounts') }

  // Memoized so the right-pane tree's animation effect only fires on real change.
  const selected = useMemo(() => chart.filter(e => isChecked(e)), [chart, overrides, expenseDetail])
  const total = selected.length

  // The full working set of account numbers (effective values + custom rows),
  // used for duplicate detection across the Cash & Revenue and Review steps.
  const workingNumbers = useMemo(() => ([
    ...selected.map(e => ({ id: e.number, number: numberOf(e), name: nameOf(e) })),
    ...extraAccts.map(x => ({ id: x.key, number: x.number, name: x.name })),
  ]), [selected, overrides, extraAccts])
  // Any complete number used by two or more accounts blocks advancing (BR-001).
  const numberConflict = useMemo(() => {
    const counts = new Map<string, number>()
    workingNumbers.forEach(n => { if (numberComplete(scheme, n.number)) counts.set(n.number, (counts.get(n.number) ?? 0) + 1) })
    return Array.from(counts.values()).some(c => c > 1)
  }, [workingNumbers, scheme])
  const depthOf = useMemo(() => {
    const byNum = new Map(chart.map(e => [e.number, e]))
    return (e: MasterChartEntry) => { let d = 0, cur = e.parentNumber; while (cur) { d++; cur = byNum.get(cur)?.parentNumber ?? null } return d }
  }, [chart])

  // Required account types (BR): an account counts when a posting account of
  // that type is in the working set. Drives the Review required-types warning
  // (the single source of truth across all setup paths).
  const missingTypes = useMemo(() => {
    const present = new Set<string>([
      ...selected.filter(e => e.posting === 'Posting').map(e => TYPE_TO_CODE[e.type]),
      ...extraAccts.map(x => TYPE_TO_CODE[x.type]),
    ])
    return (['AST', 'LIA', 'EQT', 'REV', 'EXP'] as AccountType[]).filter(c => !present.has(c)).map(c => ACCOUNT_TYPE_META[c].label)
  }, [selected, extraAccts])

  const resetRecommended = () => { setOverrides({}); setExpenseDetail('detailed') }

  // Synthesize Account[] from the selected entries for the read-only preview.
  const previewAccounts = useMemo<Account[]>(() => {
    const fromMaster: Account[] = selected.map(e => {
      // In scratch mode the user's source account holds the real structural type
      // - carry it through so the preview chips match.
      const src = isScratch ? sourceByNumber.get(e.number) : undefined
      return {
      // A preview of the chart the setup would create, not the chart. Internal ids
      // are issued at publish, so nothing here burns one.
      id: `acct_${e.number}`, internalId: '', accountNumber: numberOf(e), accountName: nameOf(e), accountType: TYPE_TO_CODE[e.type], statementClassification: e.statementClassification,
      glAccountType: src?.glAccountType ?? (e.posting === 'Summary' ? 'Summary' : 'Posting'),
      isPosting: e.posting === 'Posting',
      normalBalance: ['AST', 'EXP'].includes(TYPE_TO_CODE[e.type]) ? 'Debit' : 'Credit',
      currencyCode: src?.currencyCode ?? company.baseCurrency, status: 'Active', effectiveDate: company.fiscalYearStart,
      postingRestrictions: {}, defaultDimensionValues: [], isContra: src?.isContra ?? e.isContra ?? false,
      parentId: e.parentNumber ? `acct_${e.parentNumber}` : null, subsidiaryId: 'sub_main',
      balance: balances[e.number] ?? 0, hasTransactions: false,
      description: e.description, createdAt: '', updatedAt: '', createdBy: '', updatedBy: '',
    }})
    const fromExtras: Account[] = extraAccts.map(x => {
      const code = TYPE_TO_CODE[x.type]
      return {
        id: `acct_${x.number}`, internalId: '', accountNumber: x.number, accountName: x.name, accountType: code,
        statementClassification: defaultClassificationForCategory(code),
        glAccountType: 'Posting',
        isPosting: true,
        normalBalance: ['AST', 'EXP'].includes(code) ? 'Debit' : 'Credit', isContra: false,
        currencyCode: company.baseCurrency, status: 'Active', effectiveDate: company.fiscalYearStart,
        postingRestrictions: {}, defaultDimensionValues: [],
        parentId: `acct_${x.number[0]}000`, subsidiaryId: 'sub_main', balance: balances[x.number] ?? 0, hasTransactions: false,
        description: 'Custom account you added', createdAt: '', updatedAt: '', createdBy: '', updatedBy: '',
      }
    })
    return [...fromMaster, ...fromExtras]
  }, [selected, extraAccts, balances, overrides, company.baseCurrency, company.fiscalYearStart, isScratch, sourceByNumber])

  // Commit: create accounts (master numbers, hierarchy, pendingReview) and
  // opening balances into 3500. Runs once at publish.
  const commit = () => {
    if (committed.current) return
    committed.current = true
    const store = useStore.getState()
    // Build from Scratch commits the draft numbering scheme atomically with the
    // accounts and balances.
    if (isScratch) store.setNumberingScheme(schemeDraft)
    const idByNumber = new Map<string, string>()
    let obePlug = 0
    // Opening-balance journal lines (one per posting account with a non-zero
    // balance), gathered as accounts are created.
    const obLines: { number: string; isContra?: boolean; type: MasterChartEntry['type']; amount: number }[] = []
    selected.forEach(e => {
      const code = TYPE_TO_CODE[e.type]
      const opening = balances[e.number] ?? 0
      if (e.number !== '3500' && opening) {
        obePlug += postsDebit(e.type, e.isContra) ? opening : -opening
        obLines.push({ number: e.number, isContra: e.isContra, type: e.type, amount: opening })
      }
      // In scratch mode the rich detail (sub-type, currency, bank, dimensions) is
      // carried on the source account the user built.
      const src = isScratch ? sourceByNumber.get(e.number) : undefined
      const created = store.createAccount({
        /* A scratch account arrives whole, and what follows is the part publish
           decides for itself: where it sits, what it is numbered, what it opens
           at. Listing the rest by hand is how a bank account reached the chart
           without the name, title and type it was built with. */
        ...(src ? draftOf(src) : {}),
        accountNumber: numberOf(e), accountName: nameOf(e), accountType: code, statementClassification: e.statementClassification,
        // Scratch accounts carry the exact structural type the user picked.
        // Only the wizard path infers it from the master chart's own role.
        glAccountType: src?.glAccountType ?? (e.posting === 'Summary' ? 'Summary' : 'Posting'),
        accountRole: src ? src.accountRole : (e.posting === 'Posting' ? MASTER_CHART_ROLES[e.number] : undefined),
        parentId: e.parentNumber ? idByNumber.get(e.parentNumber) ?? null : null,
        isPosting: e.posting === 'Posting', subsidiaryId: src?.subsidiaryId ?? 'sub_main',
        currencyCode: src?.currencyCode ?? company.baseCurrency, status: 'Active', effectiveDate: src?.effectiveDate ?? company.fiscalYearStart,
        postingRestrictions: {}, defaultDimensionValues: src?.defaultDimensionValues ?? [], isContra: src?.isContra ?? e.isContra ?? false,
        balance: e.number === '3500' ? 0 : opening, hasTransactions: false, pendingReview: true,
        description: e.description, wizardTrigger: e.wizardTrigger, masterChartRef: e.number,
      } as any)
      idByNumber.set(e.number, created.id)
    })
    // Custom accounts the user added on the Cash & Revenue / Review steps.
    extraAccts.forEach(x => {
      const opening = balances[x.number] ?? 0
      if (opening) {
        obePlug += postsDebit(x.type) ? opening : -opening
        obLines.push({ number: x.number, type: x.type, amount: opening })
      }
      const created = store.createAccount({
        accountNumber: x.number, accountName: x.name, accountType: TYPE_TO_CODE[x.type], statementClassification: defaultClassificationForCategory(TYPE_TO_CODE[x.type]), subType: undefined,
        glAccountType: 'Posting',
        parentId: idByNumber.get(`${x.number[0]}000`) ?? null,
        isPosting: true, subsidiaryId: 'sub_main', currencyCode: company.baseCurrency,
        status: 'Active', effectiveDate: company.fiscalYearStart, postingRestrictions: {}, defaultDimensionValues: [],
        balance: opening, hasTransactions: false, pendingReview: true, masterChartRef: x.number,
      } as any)
      idByNumber.set(x.number, created.id)
    })

    // Record opening balances as a single balancing journal entry (JE-OB-001),
    // with the imbalance absorbed by Opening Balance Equity (3500). No entry is
    // created when every account was left at 0.00.
    if (obLines.length > 0) {
      const date = company.fiscalYearStart
      const period = periodLabel(date)
      const jeLines: JournalEntry['lines'] = []
      const txns: Transaction[] = []
      obLines.forEach(l => {
        const id = idByNumber.get(l.number)
        if (!id) return
        const debit = postsDebit(l.type, l.isContra) ? l.amount : 0
        const credit = debit ? 0 : l.amount
        jeLines.push({ accountId: id, debit, credit })
        txns.push({
          id: uid('txn'), accountId: id, date, source: 'Opening balance', jeNumber: 'JE-OB-001', reference: '', entryType: 'Compound',
          description: 'Opening balances from setup wizard', debit, credit, runningBalance: l.amount,
          dimensionValues: [], period,
        })
      })
      // Balancing line to 3500 Opening Balance Equity for any net difference.
      const obeId = idByNumber.get('3500')
      if (obeId && obePlug) {
        store.updateAccount(obeId, { balance: obePlug })
        const debit = obePlug < 0 ? -obePlug : 0
        const credit = obePlug > 0 ? obePlug : 0
        jeLines.push({ accountId: obeId, debit, credit })
        txns.push({
          id: uid('txn'), accountId: obeId, date, source: 'Opening balance', jeNumber: 'JE-OB-001', reference: '', entryType: 'Compound',
          description: 'Opening balances from setup wizard', debit, credit, runningBalance: Math.abs(obePlug),
          dimensionValues: [], period,
        })
      }
      // Each account was created with its opening as its balance already, so the
      // entry only records the postings - it must not move the balance again.
      store.addJournalEntry({
        id: uid('je'), date, reference: 'JE-OB-001',
        description: 'Opening balances from setup wizard', status: 'Posted', lines: jeLines,
      }, txns, undefined, { skipBalanceUpdate: true })
    }
    store.setCompany({ setupComplete: true, industry: answers.industry ?? company.industry, wizardDraft: undefined, ...(isScratch ? { defaults: scratchDefaults } : {}) })
  }

  // Entering the publish phase (Preview / Publishing / Preview Table) jumps the
  // viewport to the top, the user often clicks Publish from the scrolled
  // bottom of Review.
  useEffect(() => {
    if (step === STEP.PREVIEW || step === STEP.PUBLISHING || step === STEP.TABLE) window.scrollTo({ top: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // ---- Publish-preview stages (full width) ----
  if (step === STEP.PUBLISHING) {
    return <PublishingStage count={total} onCommit={commit} onDone={() => { useStore.getState().pushToast('Chart of accounts published successfully', 'success'); go(STEP.TABLE) }} />
  }
  if (step === STEP.PREVIEW) {
    return <PreviewStage accounts={previewAccounts} onBack={() => setStep(STEP.REVIEW)} onPublish={() => go(STEP.PUBLISHING)} />
  }
  if (step === STEP.TABLE) {
    const welcome = 'Welcome to your Chart of Accounts. Your accounts are marked Pending Review.'
    return <PreviewTableStage onExit={() => { useStore.getState().pushToast(welcome); navigate('/chart-of-accounts') }} />
  }

  // ---- Chrome wiring ----
  const subtitle = isUpload ? 'Import existing chart' : isScratch ? 'Build from scratch' : 'Setup wizard'
  // Single-pane steps: the table / review is the content, no preview pane. The
  // Single-pane steps have no side illustration/preview: the Balances grid and
  // the Review table span the full width. Every other step keeps the two-column
  // layout (content left, live preview right) in both the full-page and modal
  // presentations - the modal is wide enough (up to 1320px) to host it.
  // The scratch Accounts step now shows the full-width COA-style listing table
  // (no right-hand preview tree), so it joins the single-pane steps.
  const single = step === STEP.BALANCES || onReview || (isScratch && (step === STEP.ACCOUNTS || step === STEP.NUMBERING || step === STEP.DIMENSIONS))
  const { title, subtitle: stepSubtitle } = stepCopy(mode, STEP_LABELS[step] ?? '')
  // The close button only confirms once the user has made progress past the
  // first step (scratch has no Overview, so any advance counts as progress).
  const hasProgress = isScratch ? maxStep > 0 : (step > STEP.OVERVIEW || maxStep > STEP.OVERVIEW)

  // Scratch is a single Accounts page: its "Create" CTA publishes directly (no
  // Review/Preview steps). In the modal it commits and closes; on the full page
  // it drops into the Publishing stage.
  const scratchCreate = isScratch && step === STEP.ACCOUNTS
  /* A range problem on the numbering step no longer greys Continue out: pressing
     it lists every problem and goes to the first (decision 120; module review,
     2026-10-06, COA-28). */
  const rangesBlocked = isScratch && step === STEP.NUMBERING && !canAdvance(step)
  const onNext = () => {
    if (rangesBlocked) { setRangesAttempted(true); jumpToRangeProblem(); return }
    if (scratchCreate) {
      if (isModal) { commit(); useStore.getState().pushToast('Chart of accounts published successfully', 'success'); exit(); return }
      go(STEP.PUBLISHING); return
    }
    if (onReview) {
      // In the modal presentation there are no full-page Preview/Publishing/Table
      // stages: publish commits directly and closes, dropping the user into the
      // now-populated Chart of Accounts (setupComplete flips the render gate).
      if (isModal) { commit(); useStore.getState().pushToast('Chart of accounts published successfully', 'success'); exit(); return }
      go(STEP.PREVIEW); return
    }
    go(step + 1)
  }
  /* The dimensions step is skippable, and the button says so while it is
     still empty. Continue over an empty step leaves the reader wondering what
     they just agreed to; Skip names the choice they are actually making, and
     turns back into Continue the moment they define one. */
  const skippingDimensions = isScratch && step === STEP.DIMENSIONS && dimensions.length === 0
  const nextLabel = scratchCreate ? 'Publish' : onReview ? 'Publish' : skippingDimensions ? 'Skip' : (isModal ? 'Continue' : 'Next')
  const nextDisabled = onReview ? (numberConflict || missingTypes.length > 0) : (!canAdvance(step) && !rangesBlocked)

  const footerMessage = onReview
    ? (numberConflict
        ? <span className="text-2xs text-danger-700">Resolve invalid numbers to publish.</span>
        : missingTypes.length > 0
        ? <span className="text-2xs text-warning-700">Add the missing GL account categories: {missingTypes.join(', ')}.</span>
        : <span className="text-sm text-fg-muted"><strong className="text-fg font-semibold">{total}</strong> accounts ready</span>)
    : (!canAdvance(step) && !rangesBlocked
        ? <span className="text-2xs text-warning-700">{
            isUpload && step === STEP.MAPPING ? 'Map every column to continue.'
            : isScratch && step === STEP.NUMBERING ? 'Fix the number ranges marked in red to continue.'
            : 'Answer every question to continue.'
          }</span>
        // Nothing is required on the dimensions step, so the footer says so
        // rather than leaving the reader to wonder what the button is waiting
        // for.
        : isScratch && step === STEP.DIMENSIONS
        ? <span className="text-sm text-fg-muted">{dimensions.length === 0 ? SCRATCH_DIMENSIONS_COPY.skipHint : `${dimensions.length} ${dimensions.length === 1 ? DIMENSION_NOUN.one : DIMENSION_NOUN.many} defined`}</span>
        : null)

  const footerExtra = null

  // Left-pane screen for the current step (heading is supplied by the chrome).
  const leftScreen = (
    <>
      {step === STEP.OVERVIEW && <OverviewScreen mode={mode} fiscalYearStart={company.fiscalYearStart} />}
      {step === STEP.UPLOAD && <UploadFileScreen uploadedFile={uploadedFile} setUploadedFile={setUploadedFile} />}
      {step === STEP.MAPPING && <FieldMappingScreen fileName={uploadedFile} mapping={columnMapping} setMapping={setColumnMapping} />}
      {/* Ranges are set only where the flow builds the chart. An import brings
          its own, so there the step states the defaults and offers no edit. */}
      {step === STEP.NUMBERING && (isScratch
        ? <AccountNumberingStep digits={numbering} onChange={setNumbering} ranges={categoryRanges} onRangesChange={setCategoryRanges} attempted={rangesAttempted} />
        : <AccountNumberingStep digits={numbering} onChange={setNumbering} />)}
      {step === STEP.DIMENSIONS && (
        /* Written straight to the store rather than held as a draft, unlike the
           numbering scheme. A dimension is not part of the chart being built,
           so abandoning the run should not un-define it, and the account
           slide-over on the next step reads the store to offer defaults.

           `data-walkthrough` is on the wrapper rather than inside the editor: the
           editor is shared with the standing dimensions page, which has no tour. */
        <div data-walkthrough="dimensions">
          {walkthroughDemo === DIMENSIONS_DEMO && dimensions.length === 0 ? (
            <DimensionsEditor
              dimensions={DIMENSIONS_DEMO_DIMENSIONS}
              onCreate={() => {}}
              onUpdate={() => {}}
              onDelete={() => {}}
              emptyHint={SCRATCH_DIMENSIONS_COPY.emptyHint}
            />
          ) : (
            <DimensionsEditor
              dimensions={dimensions}
              onCreate={draft => addDimension(draft)}
              onUpdate={updateDimension}
              onDelete={deleteDimension}
              emptyHint={SCRATCH_DIMENSIONS_COPY.emptyHint}
            />
          )}
        </div>
      )}
      {step === STEP.ACCOUNTS && <ScratchAccountsScreen tour={chartTour} accounts={chartTourDemo === CHART_DEMO ? [...localAccounts, ...chartDemoAccounts(localAccounts)] : localAccounts} expanded={chartTourDemo === CHART_DEMO ? new Set([...scratchExpanded, ...CHART_DEMO_OPEN]) : scratchExpanded} setExpanded={setScratchExpanded} query={scratchQuery} setQuery={setScratchQuery} columns={scratchColumns} columnOrder={scratchColOrder} onOrderChange={setScratchColOrder} colFilters={scratchColFilters} onColFiltersChange={setScratchColFilters} frozenCols={scratchFrozen} onToggleFreeze={k => setScratchFrozen(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])} onHideColumn={k => setScratchColumns(prev => ({ ...prev, [k]: false }))} onOpenAdd={() => { setEditingId(null); setCreateParent(null); setWrapAcct(null); setCreateDefaults(undefined); setCreateOpen(true) }} onCreateRow={prefill => { setEditingId(null); setCreateParent(null); setWrapAcct(null); setCreateDefaults(prefill); setCreateOpen(true) }} onEdit={a => { setEditingId(a.id); setCreateParent(null); setWrapAcct(null); setCreateDefaults(scratchFormDefaults(a)); setCreateOpen(true) }} onAddChild={parent => {
        setEditingId(null)
        // A posting account cannot take a child, so the same request builds a
        // summary in its place and moves it underneath instead.
        const wraps = parent.glAccountType === 'Posting'
        setCreateParent(wraps ? null : parent)
        setWrapAcct(wraps ? parent : null)
        setCreateDefaults(wraps ? undefined : { accountType: parent.accountType, statementClassification: parent.statementClassification, parentId: parent.id })
        // The move has its own dialog; only an ordinary child opens the form.
        setCreateOpen(!wraps)
      }} onAddDimensions={scratchHasDimensions ? a => setScratchDimsFor(a) : undefined} onRemove={requestScratchDelete} lastDelete={scratchLastDelete} />}
      {step === STEP.INDUSTRY && <IndustryScreen selectedLabel={industryLabel} onPick={(cat, label) => { setA('industry', cat); setIndustryLabel(label) }} />}
      {step === STEP.ENTITY && <EntityScreen answers={answers} setA={setA} partnerInput={partnerInput} setPartnerInput={setPartnerInput} partnerValid={partnerValid} />}
      {step === STEP.METHOD && <AccountingMethodScreen answers={answers} setA={setA} />}
      {step === STEP.OPERATIONS && <OperationsScreen answers={answers} setA={setA} />}
      {step === STEP.EXTRAS && <ExtrasScreen answers={answers} setA={setA} expenseDetail={expenseDetail} setExpenseDetail={setExpenseDetail} />}
      {step === STEP.BALANCES && <BalancesScreen chart={chart} isChecked={isChecked} nameOf={nameOf} extraAccts={extraAccts} balances={balances} setBalance={setBalance} baseCurrency={company.baseCurrency} stepNum={step + 1} stepTotal={STEP_LABELS.length} />}
      {step === STEP.REVIEW && (
        isScratch ? (
          // Build-from-Scratch review mirrors the Preview step: the real
          // chart-of-accounts table, where clicking an account name reopens the
          // Edit Account slide-over for further edits.
          <div className="space-y-4">
            <p className="text-sm text-fg-muted max-w-lg">Review your chart of accounts. Click any account name to edit it before publishing.</p>
            {missingTypes.length > 0 && (
              <Banner tone="warning">Add the missing required types before publishing: {missingTypes.join(', ')}.</Banner>
            )}
            {/* Same search toolbar as the Accounts step. Every table in this
                module is condensed, so there is no density control. */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
                <input
                  value={reviewQuery}
                  onChange={e => setReviewQuery(e.target.value)}
                  placeholder="Search accounts…"
                  className="h-9 w-64 pl-9 pr-8 rounded-lg border border-border bg-white text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
                {reviewQuery && (
                  <button onClick={() => setReviewQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-bg-muted text-fg-subtle hover:text-fg">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <Card className="overflow-hidden">
              <AccountTree
                accounts={localAccounts}
                query={reviewQuery}
                density="condensed"
                columns={ACCOUNTS_STEP_COLUMNS}
                expanded={scratchExpanded}
                onToggle={(id, on) => setScratchExpanded(prev => { const n = new Set(prev); const should = on ?? !n.has(id); if (should) n.add(id); else n.delete(id); return n })}
                onOpen={a => { setEditingId(a.id); setCreateDefaults(scratchFormDefaults(a)); setCreateOpen(true) }}
                onAction={() => {}}
                readOnly
              />
            </Card>
          </div>
        ) : (
          <WizardReview
            chart={chart} isChecked={isChecked} nameOf={nameOf} setOverride={setOverride}
            extraAccts={extraAccts} setExtraAccts={setExtraAccts}
            numberOf={numberOf} setNumber={(n, v) => setOverride(n, { number: v })} scheme={scheme} numbers={workingNumbers}
            missing={missingTypes}
          />
        )
      )}
    </>
  )

  // Right-pane content. Wizard data steps show the focused step diff; other
  // steps keep their bespoke preview. All sit on the dotted-grid surface.
  const rightPane = (() => {
    if (single) return null
    if (step === STEP.OVERVIEW) return <CoaTreeIllustration />
    if (isUpload && step === STEP.UPLOAD) return <UploadHintCard />
    if (!isUpload && !isScratch && (step === STEP.INDUSTRY || step === STEP.ENTITY || step === STEP.METHOD || step === STEP.OPERATIONS || step === STEP.EXTRAS)) {
      const stepId: WizardStepId =
        step === STEP.INDUSTRY ? 'industry'
        : step === STEP.ENTITY ? 'entity'
        : step === STEP.METHOD ? 'method'
        : step === STEP.OPERATIONS ? 'operations'
        : 'extras'
      const before = computeWizardChart(answersBeforeStep(stepId, answers))
      const priorCount = before.filter(e => e.posting === 'Posting').length
      const diff = getStepDiff(stepId, answers).filter(e => isChecked(e))
      const hint =
        stepId === 'industry' ? 'Pick your industry on the left to see the accounts it adds.'
        : stepId === 'entity' ? 'Pick your entity type on the left to see the equity accounts it adds.'
        : stepId === 'method' ? 'Choose your accounting method on the left to see the accounts it adds.'
        : stepId === 'operations' ? 'Toggle what your business does on the left to see accounts appear here.'
        : 'Choose your expense detail on the left to see the accounts here.'
      return <WizardRightPane newEntries={diff} priorCount={priorCount} fullAccounts={previewAccounts} emptyHint={hint} />
    }
    return <WizardChartTree entries={selected} placeholder={false} balances={balances} baseCurrency={company.baseCurrency} />
  })()

  /* One Learn surface for the whole scratch flow. What changes between steps is
     the subject, not the panel: each step has its own guide, about the screen
     in front of the reader, and offers the way back into its own tour. */
  const onDimensions = isScratch && step === STEP.DIMENSIONS
  const onAccounts = isScratch && step === STEP.ACCOUNTS
  const onNumbers = isScratch && step === STEP.NUMBERING
  const scratchLearn = isScratch && isModal ? (
    <ReadingRoom
      open={learnOpen}
      onClose={() => setLearnOpen(false)}
      // Each step has a guide of its own, read from the top - Guided setup's,
      // tailored (Mahad, 2026-10-08).
      config={onDimensions ? DIMENSIONS_READING_ROOM : onAccounts ? SCRATCH_ACCOUNTS_READING_ROOM : SCRATCH_NUMBER_LENGTH_READING_ROOM}
      tail={onDimensions
        ? <WalkthroughReplayRow onStart={startWalkthrough} count={DIMENSIONS_CARDS.length} title="Take the walkthrough" subtitle={`${DIMENSIONS_CARDS.length} short cards`} />
        : onAccounts
        ? <WalkthroughReplayRow onStart={startChartTour} count={SCRATCH_CHART_CARDS.length} title="Take the walkthrough" subtitle={`${SCRATCH_CHART_CARDS.length} short cards`} />
        : onNumbers
        ? <WalkthroughReplayRow onStart={startNumberTour} count={NUMBERING_CARDS.length} title="Take the walkthrough" subtitle={`${NUMBERING_CARDS.length} short cards`} />
        : undefined}
    />
  ) : undefined

  return (
    <>
      <WizardChrome
        variant={chromeVariant}
        subtitle={subtitle}
        stepIndex={step}
        stepLabels={STEP_LABELS}
        maxStep={maxStep}
        /* Any step already reached, forward as well as back (Mahad, 2026-10-01),
           but only through steps that would still pass Continue: a step changed
           since and no longer complete stops the walk on itself. */
        onJump={i => {
          if (i > maxStep) return
          for (let s = step; s < i; s++) if (!canAdvance(s)) { setStep(s); return }
          setStep(i)
        }}
        confirmOnClose={hasProgress}
        onDiscard={exit}
        discardCopy={
          // onClose is passed only when this wizard was opened from "Choose how
          // to begin", which is exactly when leaving it lands the reader back on
          // that choice. Routed straight to, there is no path to choose again.
          onClose ? LEAVE_SETUP_PATH_CONFIRM : undefined
        }
        onLearn={isModal ? () => setLearnOpen(o => !o) : undefined}
        learnOpen={learnOpen}
        /* Build from scratch runs a short step past a long one, and a panel that
           resized between them moved the footer while the reader was heading for
           it. Held at the tallest step, which is Accounts. */
        fixedHeight={isScratch}
        onPrev={() => go(step - 1)}
        prevDisabled={step <= 0}
        onNext={onNext}
        nextDisabled={nextDisabled}
        nextLabel={nextLabel}
        footerMessage={footerMessage}
        footerExtra={footerExtra}
        overlay={scratchLearn}
      >
        {isModal ? (
          single ? (
            <div className={cn('mx-auto w-full space-y-5', wide ? 'max-w-[1200px]' : 'max-w-3xl')}>
              <div>
                <h2 className="text-xl text-fg" style={{ fontWeight: 500 }}>{title}</h2>
                {stepSubtitle && <p className="text-sm text-fg-muted mt-1 leading-relaxed">{stepSubtitle}</p>}
              </div>
              {leftScreen}
            </div>
          ) : (
            <div className={cn('mx-auto w-full grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6 lg:gap-8 items-start max-w-[1200px]')}>
              <div className="min-w-0 space-y-5">
                <div>
                  <h2 className="text-xl text-fg" style={{ fontWeight: 500 }}>{title}</h2>
                  {stepSubtitle && <p className="text-sm text-fg-muted mt-1 leading-relaxed">{stepSubtitle}</p>}
                </div>
                {leftScreen}
              </div>
              <div className="lg:sticky lg:top-0 min-w-0">
                <div className="wizard-right-pane rounded-lg p-6 min-h-[420px] overflow-auto scrollbar-thin">{rightPane}</div>
              </div>
            </div>
          )
        ) : single ? (
          // The numbering step is two questions and a short table, not a table
          // of accounts, so it takes a narrower pane. Capping the card instead
          // would leave it sitting left of centre with the step heading reaching
          // past its right edge.
          <div className={cn('px-6 py-6 lg:px-24 lg:py-8 mx-auto', step === STEP.NUMBERING ? 'max-w-[960px]' : 'max-w-[1100px]')}>
            <WizardStepHeader stepIndex={step} title={title} subtitle={stepSubtitle} showStep={STEP_LABELS.length > 1} />
            {leftScreen}
          </div>
        ) : (
          <div className="px-6 py-6 lg:px-24 lg:py-8 max-w-[1500px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-8 lg:gap-10 items-start">
            <div className="min-w-0">
              <WizardStepHeader stepIndex={step} title={title} subtitle={stepSubtitle} />
              {leftScreen}
            </div>
            <div className="lg:sticky lg:top-0 min-w-0">
              <div className="wizard-right-pane rounded-lg p-8 min-h-[480px] overflow-auto scrollbar-thin">{rightPane}</div>
            </div>
          </div>
        )}
      </WizardChrome>

      {/* A sibling of the chrome rather than a child of it: the overlay portals to
          the body and has to sit above the panel, and a spotlight nested inside
          the box it is cutting a hole in would be clipped by it. */}
      {walkthrough && (
        <WalkthroughOverlay
          cards={DIMENSIONS_CARDS}
          label={DIMENSIONS_LABEL}
          welcome={p => <DimensionsWelcome {...p} />}
          currentStep={walkthroughStep}
          onGoToStep={walkthroughGoToStep}
          onDemo={setDemo}
          onClose={closeWalkthrough}
          skipLabel="Skip tour"
        />
      )}
      {numberTour && (
        <WalkthroughOverlay
          cards={NUMBERING_CARDS}
          label={NUMBERING_LABEL}
          welcome={p => <NumberingWelcome {...p} />}
          currentStep={numberTourStep}
          onGoToStep={walkthroughGoToStep}
          onDemo={noDemo}
          onClose={closeNumberTour}
          skipLabel="Skip tour"
        />
      )}
      {chartTour && (
        <WalkthroughOverlay
          cards={SCRATCH_CHART_CARDS}
          label={CHART_LABEL}
          welcome={p => <ChartWelcome {...p} />}
          currentStep={chartTourStep}
          onGoToStep={walkthroughGoToStep}
          onDemo={setChartDemo}
          onClose={closeChartTour}
          skipLabel="Skip tour"
        />
      )}

      {isScratch && (
        <CreateAccountSlideOver
          open={createOpen}
          onClose={() => { setCreateOpen(false); setEditingId(null); setCreateParent(null); setWrapAcct(null) }}
          defaults={createDefaults}
          scheme={schemeDraft}
          parentAccount={createParent ?? undefined}
          editAccount={editingId ? localAccounts.find(a => a.id === editingId) : undefined}
          accountsOverride={editingId ? localAccounts.filter(a => a.id !== editingId) : localAccounts}
          onCreate={handleCreate}
        />
      )}
      {isScratch && wrapAcct && (
        <MoveUnderSummaryModal account={wrapAcct} accountsOverride={localAccounts} onCreate={handleCreate} onClose={() => setWrapAcct(null)} />
      )}
      {isScratch && scratchDimsFor && (
        <AccountDimensionsModal
          open
          account={scratchDimsFor}
          value={scratchDimsFor.defaultDimensionValues}
          onClose={() => setScratchDimsFor(null)}
          onSave={values => {
            setLocalAccounts(prev => prev.map(x => x.id === scratchDimsFor.id ? { ...x, defaultDimensionValues: values } : x))
            setScratchDimsFor(null)
          }}
        />
      )}
      {scratchDeleteModal}
    </>
  )
}

// Stage 1, read-only preview of the chart before publishing.
function PreviewStage({ accounts, onBack, onPublish }: { accounts: Account[]; onBack: () => void; onPublish: () => void }) {
  const categories = new Set(accounts.filter(a => !a.parentId).map(a => a.id)).size
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(accounts.filter(a => !a.isPosting).map(a => a.id)))
  const toggle = (id: string, on?: boolean) => setExpanded(prev => { const n = new Set(prev); const should = on ?? !n.has(id); if (should) n.add(id); else n.delete(id); return n })
  // Start the Preview at the top, the real scroll container is the AppShell
  // main area (not the window), so scroll the stage root into view.
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => { topRef.current?.scrollIntoView({ block: 'start' }) }, [])
  return (
    <div ref={topRef} className="pb-28 mx-auto w-full max-w-5xl px-6 pt-8">
      <div className="text-center mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Preview your chart of accounts</h1>
        <p className="text-sm text-fg-muted mt-1.5">Here's what we'll create. Take one more look before we publish.</p>
        <p className="text-xs text-fg-subtle mt-1">Showing {accounts.length} accounts across {categories} categories.</p>
      </div>
      <Card className="overflow-hidden">
        {/* No onOpen: these rows go nowhere, so they carry no pointer, no hover
            and no "New" badge. The chart is not published yet, which is the one
            thing a picture of it has to keep saying. */}
        <AccountTree accounts={accounts} query="" density="condensed" columns={DEFAULT_COLUMNS} expanded={expanded} onToggle={toggle} onAction={() => {}} readOnly />
      </Card>
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-white px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-sm text-fg-muted">Ready to publish? This will create all {accounts.length} accounts.</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={<ChevronLeft size={14} />} onClick={onBack}>Back to review</Button>
            <Button onClick={onPublish} iconRight={<ArrowRight size={14} />}>Publish now</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Stage 2, publishing checklist + progress (2.5–3.5s); commits on mount.
const PUBLISH_STEPS = [
  'Creating numbering configuration',
  'Setting up the account hierarchy',
  'Publishing accounts to the General Ledger',
  'Recording opening balances',
  'Preparing dimensions for your General Ledger',
  'Finalizing setup',
]
function PublishingStage({ count, onCommit, onDone }: { count: number; onCommit: () => void; onDone: () => void }) {
  const [active, setActive] = useState(0)
  useEffect(() => {
    onCommit()
    const per = 500
    const timers: number[] = []
    PUBLISH_STEPS.forEach((_, i) => timers.push(window.setTimeout(() => setActive(i + 1), per * (i + 1))))
    timers.push(window.setTimeout(onDone, per * PUBLISH_STEPS.length + 400))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const pct = Math.round((active / PUBLISH_STEPS.length) * 100)
  return (
    <div className="mx-auto w-full max-w-md px-6 pt-20 text-center">
      <h1 className="text-lg font-semibold">Building your chart of accounts</h1>
      <div className="mt-8 space-y-3 text-left">
        {PUBLISH_STEPS.map((label, i) => {
          const done = i < active, inProg = i === active
          return (
            <div key={i} className="flex items-center gap-3">
              <span className={cn('w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                done ? 'bg-success-100 text-success-700' : inProg ? 'bg-primary text-white animate-pulse' : 'bg-bg-muted text-fg-subtle')}>
                {done ? <Check size={12} /> : inProg ? <span className="w-1.5 h-1.5 rounded-full bg-white" /> : <span className="w-1.5 h-1.5 rounded-full bg-fg-subtle" />}
              </span>
              <span className={cn('text-sm', done ? 'text-fg' : inProg ? 'text-fg font-medium' : 'text-fg-subtle')}>
                {label.includes('Publishing accounts') ? `Publishing ${count} accounts to the General Ledger` : label}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-8 h-2 rounded-full bg-bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 text-xs text-fg-muted">{pct}%</div>
    </div>
  )
}

// Stage 3, celebratory read-only table of the published chart, with Exit.
function PreviewTableStage({ onExit }: { onExit: () => void }) {
  const accounts = useStore(s => s.accounts)
  const categories = new Set(accounts.filter(a => !a.parentId).map(a => a.id)).size
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => { topRef.current?.scrollIntoView({ block: 'start' }) }, [])
  return (
    <div ref={topRef} className="pb-28 mx-auto w-full max-w-5xl px-6 pt-8">
      <div className="text-center mb-5">
        <div className="w-12 h-12 rounded-full bg-success-100 text-success-700 flex items-center justify-center mx-auto"><Check size={24} /></div>
        <h1 className="text-2xl font-semibold tracking-tight mt-3">Your chart of accounts is ready</h1>
        <p className="text-sm text-fg-muted mt-1.5">{accounts.length} accounts published across {categories} categories.</p>
      </div>
      <Card className="overflow-hidden">
        <AccountTable accounts={accounts} query="" density="condensed" columns={DEFAULT_COLUMNS} onAction={() => {}} readOnly />
      </Card>
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-white px-6 py-3">
        <div className="max-w-5xl mx-auto flex justify-end">
          <Button onClick={onExit} iconRight={<ArrowRight size={14} />}>Exit to Chart of Accounts</Button>
        </div>
      </div>
    </div>
  )
}

// Shared horizontal step tabs with a full-width baseline and a per-step
// underline bar (the Partners "Create" stepper look). Reused by the guided
// wizard, Build-from-Scratch, and Upload flows.
export function StepTabs({ steps, current, maxStep, onJump }: { steps: string[]; current: number; maxStep?: number; onJump?: (i: number) => void }) {
  const reach = maxStep ?? current
  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-5 sm:gap-7 overflow-x-auto scrollbar-thin -mb-px">
        {steps.map((label, i) => {
          const completed = i < current
          const active = i === current
          const clickable = !!onJump && i <= reach
          return (
            <button
              key={label}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onJump!(i)}
              className={cn('relative flex items-center gap-2 pb-3 shrink-0', clickable ? 'cursor-pointer' : 'cursor-default')}
            >
              <span className={cn('w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 transition-all',
                completed ? 'bg-[#10B981] text-white' : active ? 'bg-primary text-white' : 'border-[1.5px] border-border-strong text-fg-muted bg-white')}>
                {completed ? <Check size={12} /> : i + 1}
              </span>
              <span className={cn('text-[13px] whitespace-nowrap transition-colors',
                active ? 'text-primary font-semibold' : completed ? 'text-[#10B981] font-semibold' : 'text-fg-muted font-medium')}>
                {label}
              </span>
              {(active || completed) && (
                <span className={cn('absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full', completed ? 'bg-[#10B981]' : 'bg-primary')} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WizardProgress({ step, maxStep, onJump }: { step: number; maxStep: number; onJump: (s: number) => void }) {
  return <StepTabs steps={WIZARD_STEP_LABELS} current={step} maxStep={maxStep} onJump={onJump} />
}

function OverviewScreen({ mode = 'wizard', fiscalYearStart }: { mode?: 'wizard' | 'upload' | 'scratch'; fiscalYearStart?: string }) {
  return (
    <Banner tone="warning" title="One-time setup" className="!border-0">
      This setup runs only once per organization. After it is complete, accounts can be added, edited, or imported at any time from the Chart of Accounts.
    </Banner>
  )
}

// Upload-flow step 1, choose the file. (Prototype: the picker stages a mock
// file name; downstream the imported working set is derived from it.)
function UploadFileScreen({ uploadedFile, setUploadedFile }: { uploadedFile: string | null; setUploadedFile: (v: string | null) => void }) {
  return (
    <Card className="p-6 space-y-4">
      {uploadedFile ? (
        <AttachmentPreviewCard name={uploadedFile} onRemove={() => setUploadedFile(null)} />
      ) : (
        <div className="border-2 border-dashed border-border rounded-lg p-10 text-center bg-bg-subtle/40">
          <Upload size={28} className="mx-auto text-fg-subtle mb-2" />
          <div className="text-sm font-medium">Drop your file here, or browse</div>
          <div className="text-2xs text-fg-subtle mt-1">CSV or XLSX · max 5 MB</div>
          {/* The import template lives here, right beside the file request, so
              the download is available at the exact moment the file is asked for. */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button variant="secondary" icon={<Upload size={14} />} onClick={() => setUploadedFile('accounts-export.csv')}>Choose file</Button>
            <Button variant="ghost" icon={<Download size={14} />} onClick={downloadImportTemplate}>Download template</Button>
          </div>
        </div>
      )}
      <p className="text-2xs text-fg-subtle">
        The file should include columns for {templateFieldSentence(REQUIRED_TEMPLATE_FIELDS)}. {templateFieldSentence(OPTIONAL_TEMPLATE_FIELDS)} are optional.
      </p>
    </Card>
  )
}

// The same CSV the post-setup Import modal hands out: the shipped file.
function downloadImportTemplate() {
  void downloadTemplate('csv')
}

/* Upload-flow step 2, mapping each of the file's columns to one of our fields.
   A stub, and the whole of this path is: UploadFileScreen never opens the file
   it is handed, and the table below lists plausible foreign column names rather
   than the ones the file carries. The real import in ImportAccounts opens the
   file and matches its columns on header text without asking, so this screen has
   no equivalent there and the path needs replacing rather than rewiring. */
function FieldMappingScreen({ fileName, mapping, setMapping }: { fileName: string | null; mapping: Record<string, string>; setMapping: React.Dispatch<React.SetStateAction<Record<string, string>>> }) {
  return (
    <Card className="p-6 space-y-4">
      <FieldMappingTable mapping={mapping} setMapping={setMapping} fileName={fileName} />
    </Card>
  )
}

// Right pane on the Upload step, a compact reminder of the expected columns
// (no live tree until the file is parsed).
export function UploadHintCard() {
  return (
    <div className="card p-4">
      <div className="text-sm font-semibold text-fg">What we expect</div>
      <p className="text-xs text-fg-muted mt-0.5">A CSV or XLSX with at least these columns:</p>
      {/* Column and example both come off the template definition, so this card
          asks for the file the importer knows how to read. */}
      <div className="mt-3 rounded-lg border border-border overflow-hidden text-2xs">
        <div className="grid grid-cols-2 bg-bg-subtle text-fg-muted px-2 py-1.5 font-medium"><span>Column</span><span>Example</span></div>
        {REQUIRED_TEMPLATE_FIELDS.map(field => (
          <div key={field} className="grid grid-cols-2 gap-2 px-2 py-1.5 border-t border-border-subtle">
            <span className="text-fg">{field}</span>
            <span className="truncate text-fg-muted">{TEMPLATE_EXAMPLE_ROWS[0][field]}</span>
          </div>
        ))}
      </div>
      <p className="text-2xs text-fg-subtle mt-3">Optional: {OPTIONAL_TEMPLATE_FIELDS.join(', ')}.</p>
    </div>
  )
}

function OptionRow({ active, onClick, title, hint, badge }: { active: boolean; onClick: () => void; title: string; hint?: string; badge?: number }) {
  return (
    <button onClick={onClick} className={cn('text-left px-3.5 py-2.5 rounded-lg border-2 transition-all bg-white min-h-[60px] flex flex-col justify-center',
      active ? 'border-primary shadow-sm' : 'border-border hover:border-border-strong')}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium">{title}</div>
        {typeof badge === 'number' && badge > 0 && (
          <span className={cn('shrink-0 text-2xs font-semibold rounded-full px-1.5 py-0.5', active ? 'bg-primary/10 text-primary' : 'bg-bg-muted text-fg-muted')}>+{badge}</span>
        )}
      </div>
      {hint && <div className="text-2xs text-fg-muted mt-0.5">{hint}</div>}
    </button>
  )
}

// How many accounts a single answer choice adds beyond the always-on baseline.
// Shared by the three business-profile question screens.
const wizardBaseCount = MASTER_CHART.filter(e => triggerMatches(e.wizardTrigger, EMPTY_ANSWERS)).length
const wizardDelta = (patch: Partial<WizardAnswers>) =>
  MASTER_CHART.filter(e => triggerMatches(e.wizardTrigger, { ...EMPTY_ANSWERS, ...patch } as WizardAnswers)).length - wizardBaseCount

// Business profile, split into three per-question steps (Industry, Entity,
// Accounting method).
function IndustryScreen({ selectedLabel, onPick }: {
  selectedLabel: string | null
  onPick: (cat: WizardAnswers['industry'], label: string) => void
}) {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const filtered = q ? WIZARD_INDUSTRIES.filter(i => i.label.toLowerCase().includes(q)) : WIZARD_INDUSTRIES
  return (
    <Card className="p-6">
      <label className="label block mb-2">Industry<RequiredMark show /></label>
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search industries…"
          className="h-10 w-full pl-9 pr-8 text-sm bg-white rounded-lg border border-border shadow-xs focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-bg-muted text-fg-subtle hover:text-fg">
            <X size={14} />
          </button>
        )}
      </div>
      {/* Stacked, equal-size pills */}
      <div className="mt-3 flex flex-col gap-2 max-h-[360px] overflow-y-auto scrollbar-thin pr-1">
        {filtered.map(i => {
          const Icon = i.icon
          const active = selectedLabel === i.label
          const badge = wizardDelta({ industry: i.cat })
          return (
            <button
              key={i.label}
              onClick={() => onPick(i.cat, i.label)}
              className={cn('w-full h-12 flex items-center gap-3 px-3.5 rounded-lg border-2 bg-white text-left transition-all',
                active ? 'border-primary shadow-sm' : 'border-border hover:border-border-strong')}
            >
              <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', active ? 'bg-primary/10 text-primary' : 'bg-bg-muted text-fg-muted')}>
                <Icon size={16} />
              </span>
              <span className="text-sm font-medium text-fg flex-1 min-w-0 truncate">{i.label}</span>
              {badge > 0 && (
                <span className={cn('shrink-0 text-2xs font-semibold rounded-full px-1.5 py-0.5', active ? 'bg-primary/10 text-primary' : 'bg-bg-muted text-fg-muted')}>+{badge}</span>
              )}
              {active && <Check size={16} className="text-primary shrink-0" />}
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-fg-subtle py-6 text-center">No matches. Try “General business”.</p>
        )}
      </div>
    </Card>
  )
}

function EntityScreen({ answers, setA, partnerInput, setPartnerInput, partnerValid }: {
  answers: WizardAnswers; setA: <K extends keyof WizardAnswers>(k: K, v: WizardAnswers[K]) => void
  partnerInput: string; setPartnerInput: (v: string) => void; partnerValid: boolean
}) {
  const showPartners = answers.entity === 'partnership' || answers.entity === 'llc'
  return (
    <Card className="p-6">
      <label className="label block mb-1.5">Entity type<RequiredMark show /></label>
      <div className="grid sm:grid-cols-3 gap-2">
        {[['sole', 'Sole proprietor'], ['partnership', 'Partnership'], ['llc', 'LLC'], ['scorp', 'S-corp'], ['ccorp', 'C-corp']].map(([v, l]) => (
          <OptionRow key={v} active={answers.entity === v} onClick={() => setA('entity', v as WizardAnswers['entity'])} title={l} badge={wizardDelta({ entity: v as WizardAnswers['entity'] })} />
        ))}
      </div>
      {showPartners && (
        <div className="mt-2.5 max-w-xs">
          <Input label="Number of partners" type="number" min={2} max={10} value={partnerInput} onChange={e => setPartnerInput(e.target.value)} placeholder="2"
            hint="We create a Capital and Draw account for each partner." />
          {!partnerValid && <p className="text-2xs text-warning-700 mt-1">Enter a whole number between 2 and 10.</p>}
        </div>
      )}
    </Card>
  )
}

function AccountingMethodScreen({ answers, setA }: {
  answers: WizardAnswers; setA: <K extends keyof WizardAnswers>(k: K, v: WizardAnswers[K]) => void
}) {
  return (
    <Card className="p-6">
      <label className="label block mb-1.5">Accounting method<RequiredMark show /></label>
      <div className="grid sm:grid-cols-2 gap-2">
        <OptionRow active={answers.accountingMethod === 'cash'} onClick={() => setA('accountingMethod', 'cash')} title="Cash" hint="Record income and expenses when money changes hands." badge={wizardDelta({ accountingMethod: 'cash' })} />
        <OptionRow active={answers.accountingMethod === 'accrual'} onClick={() => setA('accountingMethod', 'accrual')} title="Accrual" hint="Record income and expenses when earned or incurred." badge={wizardDelta({ accountingMethod: 'accrual' })} />
      </div>
      {answers.entity === 'ccorp' && answers.accountingMethod !== 'accrual' && (
        <Banner tone="info" title="A recommendation" className="mt-2.5">
          Accrual accounting is generally expected for C corporations. We recommend Accrual; the choice is yours.
        </Banner>
      )}
    </Card>
  )
}

function ToggleRow({ on, onChange, label, hint, children }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string; children?: React.ReactNode }) {
  return (
    <div className={cn('rounded-lg border p-3.5 transition-colors', on ? 'border-brand-200 bg-brand-50/40' : 'border-border')}>
      <Toggle checked={on} onChange={onChange} label={label} hint={hint} />
      {on && children && <div className="mt-3 pl-12">{children}</div>}
    </div>
  )
}

function OperationsScreen({ answers, setA }: {
  answers: WizardAnswers; setA: <K extends keyof WizardAnswers>(k: K, v: WizardAnswers[K]) => void
}) {
  return (
    <Card className="p-6 space-y-4">
      <ToggleRow on={answers.inventory} onChange={v => setA('inventory', v)} label="We hold inventory" hint="Adds inventory assets, COGS, shipping income, and sales returns." />
      <ToggleRow on={answers.payroll} onChange={v => setA('payroll', v)} label="We run payroll" hint="Adds payroll bank, payroll liabilities, wages, payroll tax and benefits." />
      <ToggleRow on={answers.salesTax} onChange={v => setA('salesTax', v)} label="We collect sales tax / VAT / GST" hint="Adds a Sales Tax payable liability." />
      <ToggleRow on={answers.fixedAssets} onChange={v => setA('fixedAssets', v)} label="We own fixed assets" hint="Adds fixed-asset categories, accumulated depreciation, and depreciation expense.">
        <div className="text-2xs text-fg-muted">Categories: land, buildings, equipment, vehicles, furniture, computers, intangibles.</div>
      </ToggleRow>
      <ToggleRow on={answers.financing} onChange={v => setA('financing', v)} label="We have loans or financing" hint="Adds credit cards, loans, mortgage, leases, and interest expense.">
        <div className="text-2xs text-fg-muted">Types: credit cards, term loans, mortgage, line of credit, leases.</div>
      </ToggleRow>
      <ToggleRow on={answers.multiCurrency} onChange={v => setA('multiCurrency', v)} label="We transact in more than one currency" hint="Adds realized and unrealized FX gain / loss accounts." />
    </Card>
  )
}

export interface ExtraAcct { key: string; number: string; name: string; type: MasterChartEntry['type'] }

function CashRevenueScreen({ chart, isChecked, nameOf, setOverride, extraAccts, setExtraAccts, numberOf, setNumber, scheme, numbers }: {
  chart: MasterChartEntry[]
  answers: WizardAnswers
  isChecked: (e: MasterChartEntry) => boolean
  nameOf: (e: MasterChartEntry) => string
  setOverride: (n: string, p: { checked?: boolean; name?: string }) => void
  extraAccts: ExtraAcct[]
  setExtraAccts: React.Dispatch<React.SetStateAction<ExtraAcct[]>>
  numberOf: (e: MasterChartEntry) => string
  setNumber: (masterNum: string, value: string) => void
  scheme: NumberingScheme
  numbers: { id: string; number: string; name: string }[]
}) {
  const cash = chart.filter(e => e.posting === 'Posting' && e.number >= '1020' && e.number <= '1060')
  const revenue = chart.filter(e => e.type === 'REV' && e.posting === 'Posting' && e.number < '5000' && !e.isContra)
  // Pre-populate a new custom account with the next number up from the highest
  // its category already uses, derived from the current working set.
  const addExtra = (type: MasterChartEntry['type']) => {
    const synthetic = numbers.map(n => ({ accountNumber: n.number })) as any
    const number = suggestNextNumberAgainst(scheme, synthetic, defaultClassificationForCategory(type))
    setExtraAccts(x => [...x, { key: uid('xa'), number, name: type === 'AST' ? 'New cash account' : 'New revenue account', type }])
  }
  const updExtra = (key: string, name: string) => setExtraAccts(x => x.map(a => a.key === key ? { ...a, name } : a))
  const updExtraNum = (key: string, number: string) => setExtraAccts(x => x.map(a => a.key === key ? { ...a, number } : a))
  const rmExtra = (key: string) => setExtraAccts(x => x.filter(a => a.key !== key))

  const typeCell = (t: MasterChartEntry['type']) => {
    const meta = ACCOUNT_TYPE_META[TYPE_TO_CODE[t]]
    return <CategoryCell meta={meta} />
  }

  const renderSection = (title: string, items: MasterChartEntry[], extras: ExtraAcct[], onAdd: () => void) => (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-sm font-semibold text-fg">{title}</div>
        <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={onAdd}>Add another</Button>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-subtle/30 text-fg-muted text-xs border-b border-border">
              <th className="w-9 px-3 py-2" />
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-right font-medium w-32 whitespace-nowrap">Account number</th>
              <th className="px-3 py-2 text-left font-medium w-32">GL account category</th>
            </tr>
          </thead>
          <tbody>
            {items.map(e => (
              <tr key={e.number} className="border-b border-border-subtle last:border-0 align-middle">
                <td className="px-3 py-2"><input type="checkbox" checked={isChecked(e)} onChange={ev => setOverride(e.number, { checked: ev.target.checked })} className="accent-primary" /></td>
                <td className="px-3 py-2"><Input value={nameOf(e)} onChange={ev => setOverride(e.number, { name: ev.target.value })} placeholder="Account name" /></td>
                <td className="px-3 py-2 text-right">
                  <AccountNumberInput value={numberOf(e)} selfId={e.number} scheme={scheme} numbers={numbers} onCommit={v => setNumber(e.number, v)} />
                </td>
                <td className="px-3 py-2">{typeCell(e.type)}</td>
              </tr>
            ))}
            {extras.map(x => (
              <tr key={x.key} className="border-b border-border-subtle last:border-0 align-middle">
                <td className="px-3 py-2"><input type="checkbox" checked readOnly className="accent-primary" /></td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Input value={x.name} onChange={ev => updExtra(x.key, ev.target.value)} placeholder="Account name" className="input flex-1" />
                    <button onClick={() => rmExtra(x.key)} className="btn-icon text-danger-700 shrink-0"><X size={13} /></button>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <AccountNumberInput value={x.number} selfId={x.key} scheme={scheme} numbers={numbers} onCommit={v => updExtraNum(x.key, v)} />
                </td>
                <td className="px-3 py-2">{typeCell(x.type)}</td>
              </tr>
            ))}
            {items.length === 0 && extras.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-2xs text-fg-subtle">None yet, added from your earlier answers, or add one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <Card className="p-6 space-y-6">
      <div>
        <div className="text-2xs uppercase tracking-wider text-fg-subtle font-semibold">Step 3 of 4</div>
        <h3 className="text-base font-semibold mt-1">Cash & revenue</h3>
        <p className="text-sm text-fg-muted mt-0.5">Rename the suggested accounts to match your real business, uncheck any you don't need, or add your own.</p>
      </div>
      {renderSection('Bank & cash accounts', cash, extraAccts.filter(x => x.type === 'AST'), () => addExtra('AST'))}
      {renderSection('Revenue streams', revenue, extraAccts.filter(x => x.type === 'REV'), () => addExtra('REV'))}
    </Card>
  )
}

function ExtrasScreen({ answers, setA, expenseDetail, setExpenseDetail }: {
  answers: WizardAnswers; setA: <K extends keyof WizardAnswers>(k: K, v: WizardAnswers[K]) => void
  expenseDetail: 'detailed' | 'lean' | null; setExpenseDetail: (v: 'detailed' | 'lean') => void
}) {
  return (
    <Card className="p-6 space-y-5">
      <div>
        <label className="label block mb-1.5">Level of expense detail<RequiredMark show /></label>
        <div className="grid sm:grid-cols-2 gap-2">
          <OptionRow active={expenseDetail === 'detailed'} onClick={() => setExpenseDetail('detailed')} title="Detailed" hint="The full operating-expense tree, grouped by category." />
          <OptionRow active={expenseDetail === 'lean'} onClick={() => setExpenseDetail('lean')} title="Lean" hint="A reduced set of the most common expense accounts." />
        </div>
      </div>
    </Card>
  )
}

// Step 5, opening balances. One row per posting account (plus custom
// accounts), grouped into collapsible section cards, with a live summary and a
// balancing-entry preview for Opening Balance Equity. No skip button.
function BalancesScreen({ chart, isChecked, nameOf, extraAccts, balances, setBalance, baseCurrency, stepNum = 5, stepTotal = 7 }: {
  chart: MasterChartEntry[]
  isChecked: (e: MasterChartEntry) => boolean
  nameOf: (e: MasterChartEntry) => string
  extraAccts: ExtraAcct[]
  balances: Record<string, number>
  setBalance: (num: string, amount: number) => void
  baseCurrency: string
  stepNum?: number
  stepTotal?: number
}) {
  type Row = { number: string; name: string; type: MasterChartEntry['type']; isContra?: boolean; description?: string }
  const rows: Row[] = [
    // Opening Balance Equity (3500) absorbs the imbalance automatically, so it
    // doesn't get a manual row here.
    ...chart.filter(e => e.posting === 'Posting' && e.number !== '3500' && isChecked(e)).map(e => ({ number: e.number, name: nameOf(e), type: e.type, isContra: e.isContra, description: e.description })),
    ...extraAccts.map(x => ({ number: x.number, name: x.name, type: x.type as MasterChartEntry['type'], isContra: false, description: 'Custom account you added' })),
  ]
  const groups = ALL_CLASSIFICATIONS
    .map(sec => ({ sec, rows: rows.filter(r => classificationOf(r.number, TYPE_TO_CODE[r.type]) === sec).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })) }))
    .filter(g => g.rows.length > 0)

  const amount = (num: string) => balances[num] ?? 0
  const sectionTotal = (gr: Row[]) => gr.reduce((s, r) => s + amount(r.number), 0)
  const total = rows.reduce((s, r) => s + amount(r.number), 0)
  let debits = 0, credits = 0
  rows.forEach(r => { const v = amount(r.number); if (!v) return; if (postsDebit(r.type, r.isContra)) debits += v; else credits += v })
  const diff = debits - credits
  // Single flat table: every posting account in one list, ordered by number.
  const flatRows = [...rows].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))

  return (
    <div className="space-y-4">

      {/* Single flat table, same styling as the Chart of Accounts table used by
          the Review / Preview Table stages. Name / Number / Type read-only;
          Balance editable. Renders at natural height (no internal vertical
          scroll); only overflows horizontally on very narrow widths. */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-subtle/30 text-fg-muted text-xs">
                <th className="px-4 py-2 text-left font-medium">Account Name</th>
                <th className="px-4 py-2 text-left font-medium">Number</th>
                <th className="px-4 py-2 text-left font-medium whitespace-nowrap min-w-[150px]">GL account category</th>
                <th className="px-4 py-2 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {flatRows.map(r => {
                const meta = ACCOUNT_TYPE_META[TYPE_TO_CODE[r.type]]
                return (
                  <tr key={r.number} className="border-b border-border-subtle last:border-0 hover:bg-bg-subtle/60 align-middle">
                    <td className="px-4 py-3">
                      <div className="font-medium text-fg inline-flex items-center gap-1.5">{r.name}{r.isContra && <Badge tone="neutral">contra</Badge>}</div>
                      {r.description && <div className="text-2xs text-fg-subtle truncate max-w-md">{r.description}</div>}
                      {r.isContra && <div className="text-2xs text-fg-subtle">Enter as a positive number, we'll record it as a reduction to the parent.</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-muted whitespace-nowrap">{r.number}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><CategoryCell meta={meta} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-2xs text-fg-subtle">{baseCurrency}</span>
                        <input
                          type="number" step="0.01" min={0}
                          value={amount(r.number) === 0 ? '' : String(amount(r.number))}
                          onChange={e => setBalance(r.number, e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                          placeholder="0.00"
                          className="h-8 w-32 px-2 text-right bg-white border border-border rounded-md focus:outline-none focus:border-fg/40 focus:ring-2 focus:ring-fg/5 transition-all"
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Live summary, sits below the table in normal document flow (not
          sticky). The running total updates live as Balance inputs change. */}
      <Card className="p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-fg">Total opening balance</span>
          <span className="font-semibold text-fg">{fmtCurrency(total, baseCurrency)}</span>
        </div>
        <div className="mt-3 space-y-1">
          {groups.map(g => (
            <div key={g.sec} className="flex items-center justify-between text-2xs">
              <span className="text-fg-muted">{g.sec}</span>
              <span className="text-fg-muted">{fmtCurrency(sectionTotal(g.rows), baseCurrency)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs pt-4 mt-4 border-t border-border">
          <span className="text-fg-muted">Balancing entry to Opening Balance Equity</span>
          {diff === 0 ? (
            <span className="inline-flex items-center gap-1 text-success-700"><Check size={12} className="text-success-600" /> {fmtCurrency(0, baseCurrency)}</span>
          ) : (
            <span className="text-warning-700 font-medium">{fmtCurrency(Math.abs(diff), baseCurrency)}</span>
          )}
        </div>
        {diff !== 0 && <p className="text-2xs text-warning-700 mt-1">Will post to Opening Balance Equity on publish.</p>}
      </Card>
    </div>
  )
}

function WizardSummary({ chart, selected }: { chart: MasterChartEntry[]; selected: MasterChartEntry[] }) {
  void chart
  const counts = ALL_CLASSIFICATIONS
    .map(sec => ({ sec, n: selected.filter(e => classificationOf(e.number, TYPE_TO_CODE[e.type]) === sec).length }))
    .filter(c => c.n > 0)
  return (
    <Card>
      <CardHeader title="Your chart so far" subtitle={`${selected.length} accounts will be created`} />
      <div className="p-4 space-y-1.5">
        {counts.map(c => (
          <div key={c.sec} className="flex items-center justify-between text-xs">
            <span className="text-fg-muted">{c.sec}</span>
            <span className="font-semibold text-fg">{c.n}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function WizardReview({ chart, isChecked, nameOf, setOverride, extraAccts, setExtraAccts, numberOf, setNumber, scheme, numbers, missing = [] }: {
  chart: MasterChartEntry[]
  isChecked: (e: MasterChartEntry) => boolean
  nameOf: (e: MasterChartEntry) => string
  setOverride: (n: string, p: { checked?: boolean; name?: string }) => void
  extraAccts: ExtraAcct[]
  setExtraAccts: React.Dispatch<React.SetStateAction<ExtraAcct[]>>
  numberOf: (e: MasterChartEntry) => string
  setNumber: (masterNum: string, value: string) => void
  scheme: NumberingScheme
  numbers: { id: string; number: string; name: string }[]
  missing?: string[]
}) {
  // Track the just-added custom account so we can scroll it into view.
  // The most recently added account (its name field starts empty and gets a
  // brief highlight). Cleared after the highlight fades.
  const [addedKey, setAddedKey] = useState<string | null>(null)
  const addExtra = (type: MasterChartEntry['type']) => {
    const synthetic = numbers.map(n => ({ accountNumber: n.number })) as any
    const number = suggestNextNumberAgainst(scheme, synthetic, defaultClassificationForCategory(type))
    const key = uid('xa')
    setExtraAccts(x => [...x, { key, number, name: '', type }])
    setAddedKey(key)
  }
  const updExtra = (key: string, name: string) => setExtraAccts(x => x.map(a => a.key === key ? { ...a, name } : a))
  const updExtraNum = (key: string, number: string) => setExtraAccts(x => x.map(a => a.key === key ? { ...a, number } : a))
  const rmExtra = (key: string) => setExtraAccts(x => x.filter(a => a.key !== key))

  // After choosing a type and creating the account, scroll it into view and
  // focus its (empty) name field, then clear the highlight after a moment.
  useEffect(() => {
    if (!addedKey) return
    const el = document.querySelector<HTMLElement>(`[data-extra-key="${addedKey}"]`)
    if (el) {
      const reduce = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
      el.querySelector('input')?.focus()
    }
    const t = setTimeout(() => setAddedKey(null), 1500)
    return () => clearTimeout(t)
  }, [addedKey])

  const typeCell = (t: MasterChartEntry['type']) => {
    const meta = ACCOUNT_TYPE_META[TYPE_TO_CODE[t]]
    return <CategoryCell meta={meta} />
  }

  // Group the posting accounts by section, mirroring the Cash & revenue step
  // (which lists posting accounts only, headers are structural). Custom
  // accounts the user added land in the section that matches their number.
  const posting = chart.filter(e => e.posting === 'Posting')
  const sections = ALL_CLASSIFICATIONS
    .map(sec => ({
      sec,
      items: posting.filter(e => classificationOf(e.number, TYPE_TO_CODE[e.type]) === sec),
      extras: extraAccts.filter(x => classificationOf(x.number, TYPE_TO_CODE[x.type]) === sec),
    }))
    .filter(s => s.items.length > 0 || s.extras.length > 0)

  const renderSection = (sec: string, items: MasterChartEntry[], extras: ExtraAcct[]) => (
    <div key={sec}>
      <div className="text-sm font-semibold text-fg mb-2.5">{sec}</div>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-subtle/30 text-fg-muted text-xs border-b border-border">
              <th className="w-9 px-3 py-2" />
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-right font-medium w-32 whitespace-nowrap">Account number</th>
              <th className="px-3 py-2 text-left font-medium w-32">GL account category</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map(e => (
              <tr key={e.number} className="border-b border-border-subtle last:border-0 align-middle">
                <td className="px-3 py-2"><input type="checkbox" checked={isChecked(e)} onChange={ev => setOverride(e.number, { checked: ev.target.checked })} className="accent-primary" /></td>
                <td className="px-3 py-2"><Input value={nameOf(e)} onChange={ev => setOverride(e.number, { name: ev.target.value })} placeholder="Account name" /></td>
                <td className="px-3 py-2 text-right">
                  <AccountNumberInput value={numberOf(e)} selfId={e.number} scheme={scheme} numbers={numbers} onCommit={v => setNumber(e.number, v)} />
                </td>
                <td className="px-3 py-2">{typeCell(e.type)}</td>
                <td className="px-3 py-2" />
              </tr>
            ))}
            {extras.map(x => (
              <tr key={x.key} data-extra-key={x.key} className="border-b border-border-subtle last:border-0 align-middle">
                <td className="px-3 py-2"><input type="checkbox" checked readOnly className="accent-primary" /></td>
                <td className="px-3 py-2"><Input value={x.name} onChange={ev => updExtra(x.key, ev.target.value)} placeholder="Account name" className={cn('input transition-all duration-300', addedKey === x.key && 'ring-2 ring-primary/40 border-primary bg-accent/40')} /></td>
                <td className="px-3 py-2 text-right">
                  <AccountNumberInput value={x.number} selfId={x.key} scheme={scheme} numbers={numbers} onCommit={v => updExtraNum(x.key, v)} />
                </td>
                <td className="px-3 py-2">{typeCell(x.type)}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => rmExtra(x.key)} title="Delete account" className="btn-icon text-fg-subtle hover:text-danger-700 shrink-0"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const ADD_TYPES: MasterChartEntry['type'][] = ['AST', 'LIA', 'EQT', 'REV', 'EXP']
  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-fg-muted max-w-md">Rename the suggested accounts to match your real business, uncheck any you don't need, or add your own.</p>
        <Menu align="right" trigger={
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} iconRight={<ChevronDown size={14} className="text-fg-subtle/60" />}>Add account</Button>
        }>
          {(c) => (
            <>
              {ADD_TYPES.map(t => (
                <MenuItem key={t} onClick={() => { c(); addExtra(t) }}>
                  <span className="inline-flex items-center gap-2"><CategoryCell meta={ACCOUNT_TYPE_META[TYPE_TO_CODE[t]]} /></span>
                </MenuItem>
              ))}
            </>
          )}
        </Menu>
      </div>
      {missing.length > 0 && (
        <Banner tone="warning" title="Add the required GL account categories">
          A chart of accounts needs at least one account in each of these GL account categories: {missing.join(', ')}. Add {missing.length === 1 ? 'it' : 'them'} above to publish.
        </Banner>
      )}
      {sections.map(s => renderSection(s.sec, s.items, s.extras))}
    </Card>
  )
}

// ---- Question bodies ----
function QuestionBody({ qid, answers, setAnswer, industrySearch, setIndustrySearch }: {
  qid: string
  answers: Record<string, string>
  setAnswer: (k: string, v: string) => void
  industrySearch: string
  setIndustrySearch: (v: string) => void
}) {
  if (qid === 'q1') {
    const filtered = INDUSTRIES.filter(i => i.label.toLowerCase().includes(industrySearch.toLowerCase()))
    return (
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input
            value={industrySearch}
            onChange={e => setIndustrySearch(e.target.value)}
            placeholder="Search industries…"
            className="input pl-9"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-auto scrollbar-thin pr-1">
          {filtered.map(i => {
            const Icon = i.icon
            return (
              <OptionButton
                key={i.label}
                active={answers.q1_label === i.label}
                onClick={() => { setAnswer('q1', i.cat); setAnswer('q1_label', i.label) }}
                title={i.label}
                icon={<Icon size={16} />}
              />
            )
          })}
          {filtered.length === 0 && <p className="text-sm text-fg-subtle py-2">No matches. Please select "General business".</p>}
        </div>
      </div>
    )
  }

  if (qid === 'q2') {
    const opts = [
      { v: 'sole', label: 'Sole proprietor' },
      { v: 'partnership', label: 'Partnership' },
      { v: 'mmllc', label: 'Multi-member LLC' },
      { v: 'llc_scorp', label: 'LLC taxed as S-corp' },
      { v: 'scorp', label: 'S-corp' },
      { v: 'ccorp', label: 'C-corp' },
    ]
    return (
      <div className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-2">
          {opts.map(o => (
            <OptionButton key={o.v} active={answers.q2 === o.v} onClick={() => setAnswer('q2', o.v)} title={o.label} />
          ))}
        </div>
        {(answers.q2 === 'partnership' || answers.q2 === 'mmllc') && (
          <PartnerNamesInput answers={answers} setAnswer={setAnswer} />
        )}
        {answers.q2 === 'ccorp' && (
          <div className="pt-1">
            <Toggle
              checked={answers.q2_preferred === 'yes'}
              onChange={v => setAnswer('q2_preferred', v ? 'yes' : 'no')}
              label="Also add Preferred Stock"
              hint="Optional; select this only if you have issued preferred shares."
            />
          </div>
        )}
      </div>
    )
  }

  if (qid === 'q3') {
    return (
      <div className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-2">
          <OptionButton active={answers.q3 === 'cash'} onClick={() => setAnswer('q3', 'cash')} title="Cash" desc="Record income and expenses when money is actually received or paid." />
          <OptionButton active={answers.q3 === 'accrual'} onClick={() => setAnswer('q3', 'accrual')} title="Accrual" desc="Record income and expenses when they are earned or incurred." />
        </div>
        {answers.q2 === 'ccorp' && answers.q3 !== 'accrual' && (
          <Banner tone="info" title="A recommendation">
            Accrual accounting is generally required for C corporations and larger companies. We recommend Accrual; the choice, however, is yours.
          </Banner>
        )}
      </div>
    )
  }

  // Yes / No questions
  const yesNoDesc: Record<string, { yes: string; no: string }> = {
    q4: { yes: 'You hold stock and track product costs.', no: 'Service-only; no inventory.' },
    q5: { yes: 'You pay wages and withhold payroll taxes.', no: 'No employees on payroll.' },
    q6: { yes: 'You collect tax on sales and remit it later.', no: 'You do not collect sales tax.' },
    q7: { yes: 'You own equipment, vehicles, or property.', no: 'No capitalized assets.' },
    q8: { yes: 'You carry loans, credit lines, or financing.', no: 'No debt or financing.' },
    q9: { yes: 'You transact in more than one currency.', no: 'Single-currency books.' },
  }
  const d = yesNoDesc[qid] ?? { yes: 'Yes', no: 'No' }
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      <OptionButton active={answers[qid] === 'yes'} onClick={() => setAnswer(qid, 'yes')} title="Yes" desc={d.yes} />
      <OptionButton active={answers[qid] === 'no'} onClick={() => setAnswer(qid, 'no')} title="No" desc={d.no} />
    </div>
  )
}

// Partner editor: add each partner, then fine-tune the capital and draw
// account names generated for them (editable; blank reverts to the default
// "<name> Capital" / "<name> Draw"). Persists both a parsed rows JSON and a
// comma-separated name list so the working-set builder and the proceed-gate
// stay in sync.
function PartnerNamesInput({ answers, setAnswer }: { answers: Record<string, string>; setAnswer: (k: string, v: string) => void }) {
  const partners = parsePartners(answers)
  const write = (rows: PartnerRow[]) => {
    setAnswer('q2_partner_rows', JSON.stringify(rows))
    setAnswer('q2_partners', rows.map(r => r.name.trim()).filter(Boolean).join(', '))
  }
  const update = (i: number, patch: Partial<PartnerRow>) => write(partners.map((r, k) => k === i ? { ...r, ...patch } : r))
  const remove = (i: number) => write(partners.filter((_, k) => k !== i))
  const add = () => write([...partners, { name: '', capital: '', draw: '' }])

  return (
    <div className="space-y-2">
      <label className="label block">Partners<span className="text-danger-600 ml-0.5">*</span></label>
      <p className="text-2xs text-fg-subtle">Each partner gets a capital and a draw account. You can rename the generated accounts below.</p>
      <div className="space-y-2.5">
        {partners.map((p, i) => (
          <div key={i} className="rounded-lg border border-border p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <Input value={p.name} onChange={e => update(i, { name: e.target.value })} placeholder="Partner name" className="flex-1" />
              <button type="button" onClick={() => remove(i)} className="btn-icon text-danger-700 shrink-0" aria-label="Remove partner"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 pl-0.5">
              <div>
                <label className="text-2xs text-fg-subtle block mb-0.5">Capital account name</label>
                <Input value={p.capital || (p.name ? `${p.name} Capital` : '')} onChange={e => update(i, { capital: e.target.value })} placeholder="Capital account" />
              </div>
              <div>
                <label className="text-2xs text-fg-subtle block mb-0.5">Draw account name</label>
                <Input value={p.draw || (p.name ? `${p.name} Draw` : '')} onChange={e => update(i, { draw: e.target.value })} placeholder="Draw account" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={add}>Add partner</Button>
    </div>
  )
}

function OptionButton({ active, onClick, title, desc, icon }: { active: boolean; onClick: () => void; title: string; desc?: string; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn('text-left px-4 py-3 rounded-lg border-2 transition-all bg-white',
        active ? 'border-primary shadow-sm' : 'border-border hover:border-border-strong')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2.5 min-w-0">
          {icon && <span className={cn('shrink-0', active ? 'text-primary' : 'text-fg-muted')}>{icon}</span>}
          <span className="font-medium text-sm truncate">{title}</span>
        </span>
        {active && <Check size={14} className="text-primary shrink-0" />}
      </div>
      {desc && <p className="text-2xs text-fg-muted mt-1">{desc}</p>}
    </button>
  )
}

// ---- Live impact side panel ----
function ImpactPanel({ isOrientation, onReview, currentQids, answers, workingAccounts }: {
  isOrientation: boolean
  onReview: boolean
  currentQids: string[]
  answers: Record<string, string>
  workingAccounts: WizardAccount[]
}) {
  const total = workingAccounts.filter(a => a.checked).length
  return (
    <Card>
      <CardHeader title="How this shapes your chart of accounts" subtitle="Updates as you answer" />
      <div className="p-4 space-y-3 text-sm">
        {isOrientation && (
          <p className="text-fg-muted text-xs leading-relaxed">
            We start from a small, always-included base: a cash account, a revenue account, and your core operating expenses. We then add further accounts based on your answers.
          </p>
        )}

        {currentQids.length > 0 && (() => {
          // Accounts contributed by any question in the current step (a single
          // question, or all of the combined Operations questions).
          const added = workingAccounts.filter(a => currentQids.includes(a.source))
          const single = currentQids.length === 1 ? currentQids[0] : null
          const reason = single ? impactReason(single, answers) : ''
          const anyAnswered = currentQids.some(q => answers[q])
          return (
            <>
              {single && (reason
                ? <p className="text-fg-muted text-xs leading-relaxed">{reason}</p>
                : <p className="text-fg-subtle text-xs">Select an option to see how it shapes your chart of accounts.</p>)}
              {added.length > 0 ? (
                <div className="space-y-1.5 pt-1">
                  <div className="text-2xs uppercase tracking-wider text-fg-subtle font-semibold">Adds {added.length} account{added.length === 1 ? '' : 's'}</div>
                  {added.map(a => <ImpactRow key={a.key} a={a} />)}
                </div>
              ) : anyAnswered ? (
                <div className="text-2xs text-fg-subtle pt-1 flex items-center gap-1.5"><Minus size={12} /> No new accounts added in this step.</div>
              ) : null}
            </>
          )
        })()}

        {onReview && (
          <p className="text-fg-muted text-xs leading-relaxed">
            This is the full chart of accounts we have assembled. Every account is selected by default; clear anything you do not need, rename an account inline, or add your own before publishing.
          </p>
        )}

        <div className="pt-3 mt-1 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xs uppercase tracking-wider text-fg-subtle font-semibold">In your chart of accounts</span>
            <span className="text-2xs text-fg-subtle">{total} account{total === 1 ? '' : 's'}</span>
          </div>
          <ChartTree workingAccounts={workingAccounts} highlightSources={currentQids} />
        </div>
      </div>
    </Card>
  )
}

// Compact, read-only tree of the accounts assembled so far, grouped by
// section, names only. Accounts contributed by the current question are
// highlighted so the user sees exactly where their last answer landed.
function ChartTree({ workingAccounts, highlightSources }: { workingAccounts: WizardAccount[]; highlightSources: string[] }) {
  const checked = workingAccounts.filter(a => a.checked)
  return (
    <div className="-mx-1 px-1">
      {SECTIONS.map(sec => {
        const rows = checked.filter(a => a.accountType === sec.type)
        // Every type header is always shown (even with no accounts yet), so the
        // full structure is visible from the start.
        return (
          <div key={sec.type} className="mb-2 last:mb-0">
            <div className="flex items-center gap-1.5 py-0.5">
              <span className={cn('w-1.5 h-1.5 rounded-full inline-block', SECTION_DOT[sec.type])} />
              <span className={cn('text-2xs font-semibold', SECTION_TEXT[sec.type])}>{sec.label}</span>
            </div>
            <div className="ml-[3px]">
              {rows.map((a, i) => {
                const last = i === rows.length - 1
                const active = highlightSources.includes(a.source)
                return (
                  <div key={a.key} className="tree-row-in relative flex items-center min-h-[22px]" style={{ animationDelay: `${Math.min(i, 8) * 90}ms` }}>
                    {/* vertical spine, stops at the elbow on the last child */}
                    <span className="absolute left-0 top-0 w-px bg-border-strong" style={{ height: last ? '50%' : '100%' }} />
                    {/* horizontal elbow connecting the spine to the account */}
                    <span className="absolute left-0 top-1/2 w-2.5 h-px bg-border-strong" />
                    <span className={cn('pl-4 text-xs truncate transition-colors', active ? 'text-primary font-medium' : 'text-fg-muted')}>
                      {a.accountName}{a.isContra && <span className="text-2xs text-fg-subtle"> · contra</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ImpactRow({ a }: { a: WizardAccount }) {
  const meta = ACCOUNT_TYPE_META[a.accountType]
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-bg-subtle transition-opacity">
      <span className="text-xs font-medium truncate">{a.accountName}</span>
      <Badge tone={meta.color}>
        {meta.label}{a.isContra ? ' · contra' : ''}
        <Tooltip content={TYPE_HELP[a.accountType]} align="right">
          <Info size={11} className="opacity-50 hover:opacity-100 cursor-help" />
        </Tooltip>
      </Badge>
    </div>
  )
}

// Right-pane publish summary shown on the review step: live count, per-section
// breakdown, validation status, and the publish / back actions.
function PublishSummary({ workingAccounts, missing, onBack, onPublish }: {
  workingAccounts: WizardAccount[]
  missing: string[]
  onBack: () => void
  onPublish: () => void
}) {
  const checked = workingAccounts.filter(a => a.checked)
  const bySection = SECTIONS.map(s => ({ ...s, count: checked.filter(a => a.accountType === s.type).length })).filter(s => s.count > 0)
  const ok = missing.length === 0
  return (
    <Card>
      <CardHeader title="Ready to publish" subtitle="Confirm the summary, then publish" />
      <div className="p-4 space-y-4">
        <div>
          <div className="text-2xl font-semibold leading-none">{checked.length}</div>
          <div className="text-xs text-fg-muted mt-1">accounts ready</div>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs">
          {bySection.map(s => (
            <span key={s.type} className="inline-flex items-center gap-1.5 text-fg-muted">
              <span className={cn('w-1.5 h-1.5 rounded-full', SECTION_DOT[s.type])} />
              {s.label} · <span className="font-semibold text-fg">{s.count}</span>
            </span>
          ))}
        </div>
        <div className={cn('flex items-start gap-1.5 text-xs rounded-md px-2.5 py-2', ok ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700')}>
          {ok ? <Check size={14} className="shrink-0 mt-px" /> : <AlertTriangle size={14} className="shrink-0 mt-px" />}
          <span>{ok ? 'All required types covered' : `Missing required: ${missing.join(', ')}`}</span>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <Button onClick={onPublish} disabled={!ok} iconRight={<ArrowRight size={14} />}>Publish chart of accounts</Button>
          <Button variant="secondary" icon={<ChevronLeft size={14} />} onClick={onBack}>Back</Button>
        </div>
      </div>
    </Card>
  )
}

// ---- Review & adjust ----
function ReviewPane({ workingAccounts, setWorkingAccounts, missing }: {
  workingAccounts: WizardAccount[]
  setWorkingAccounts: React.Dispatch<React.SetStateAction<WizardAccount[]>>
  missing: string[]
}) {
  const [collapsed, setCollapsed] = useState<Set<AccountType>>(new Set())
  const [pendingRemove, setPendingRemove] = useState<WizardAccount | null>(null)
  const company = useStore(s => s.company)

  // Stretch: preview the next-available auto-number for each checked account.
  const previewNumbers = useMemo(() => {
    const checked = workingAccounts.filter(a => a.checked)
    const counts: Record<string, WizardAccount[]> = {}
    checked.forEach(a => { (counts[a.accountType] ??= []).push(a) })
    const map: Record<string, string> = {}
    ;(Object.keys(counts) as AccountType[]).forEach(t => {
      const nums = useStore.getState().allocateNumbers(t, counts[t].length)
      counts[t].forEach((a, i) => { map[a.key] = nums[i] })
    })
    return map
  }, [workingAccounts])

  const setAccount = (key: string, patch: Partial<WizardAccount>) =>
    setWorkingAccounts(list => list.map(a => a.key === key ? { ...a, ...patch } : a))
  // Unchecking the crucial cash/bank account is guarded by a warning that
  // explains why it matters; every other toggle applies immediately.
  const onToggleAccount = (a: WizardAccount, v: boolean) => {
    if (!v && a.isCashBank) setPendingRemove(a)
    else setAccount(a.key, { checked: v })
  }
  const addCustom = (type: AccountType) =>
    setWorkingAccounts(list => [...list, mk(uid('wiz'), 'New account', type, 'custom', 'Added manually during setup.', { custom: true, renamed: true })])
  // Add a correctly-typed account to satisfy a required-account rule. Unlike a
  // bare "Add account", this carries the right type and markers (e.g. cash/bank
  // or a named core expense) so the validation actually clears.
  const addRequired = (type: AccountType, name: string, extra: Partial<WizardAccount> = {}) =>
    setWorkingAccounts(list => [...list, mk(uid('wiz'), name, type, 'custom', 'Added during review to meet a required-account rule. Rename it if you like.', { custom: true, renamed: true, ...extra })])

  // One-click remedies for whatever required accounts are currently missing.
  const checkedAccounts = workingAccounts.filter(a => a.checked)
  const remedies: { label: string; make: () => void }[] = [
    ...(!checkedAccounts.some(a => a.isCashBank) ? [{ label: 'Cash account', make: () => addRequired('AST', 'Operating Cash', { isCashBank: true }) }] : []),
    ...(!checkedAccounts.some(a => a.accountType === 'EQT') ? [{ label: 'Equity account', make: () => addRequired('EQT', "Owner's Equity") }] : []),
    ...(!checkedAccounts.some(a => a.accountType === 'REV') ? [{ label: 'Revenue account', make: () => addRequired('REV', 'Sales Revenue') }] : []),
    ...['Rent', 'Utilities', 'Office Supplies', 'Bank Fees']
      .filter(name => !checkedAccounts.some(a => a.coreExpense === name))
      .map(name => ({ label: name, make: () => addRequired('EXP', name, { coreExpense: name }) })),
  ]

  const toggleSection = (t: AccountType) => setCollapsed(prev => {
    const next = new Set(prev)
    next.has(t) ? next.delete(t) : next.add(t)
    return next
  })

  // Sections that currently hold at least one account (empty ones are hidden).
  const visibleSections = SECTIONS.filter(sec => workingAccounts.some(a => a.accountType === sec.type))

  return (
    <div className="space-y-4">
      {/* Company-managed settings, shown as compact chips under the heading. */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral"><Calendar size={11} className="text-fg-subtle" /> Fiscal year: {company.fiscalYearStart}</Badge>
        <Badge tone="neutral"><DollarSign size={11} className="text-fg-subtle" /> Base currency: {company.baseCurrency}</Badge>
        <span className="text-2xs text-fg-subtle/70">This was configured for the organization in Company Setup</span>
      </div>

      {visibleSections.map(sec => {
        const rows = workingAccounts.filter(a => a.accountType === sec.type)
        const isCollapsed = collapsed.has(sec.type)
        return (
          <Card key={sec.type} className="overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <button onClick={() => toggleSection(sec.type)} className="flex items-center gap-2 text-left">
                <ChevronRight size={14} className={cn('text-fg-subtle transition-transform', !isCollapsed && 'rotate-90')} />
                <Badge tone={ACCOUNT_TYPE_META[sec.type].color}>{sec.label}</Badge>
                <span className="text-2xs text-fg-subtle">{rows.filter(r => r.checked).length} / {rows.length}</span>
              </button>
              <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => addCustom(sec.type)}>Add account</Button>
            </div>
            {!isCollapsed && (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-9" />
                    <col className="w-[58%]" />
                    <col />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-border bg-bg-subtle/30 text-fg-muted text-xs">
                      <th className="px-3 py-2" />
                      <th className="px-3 py-2 text-left font-medium">Account Name</th>
                      <th className="px-3 py-2 text-left font-medium">Account number</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(a => (
                      <tr key={a.key} className="border-b border-border-subtle last:border-0 hover:bg-bg-subtle/50">
                        <td className="px-3 py-2.5 align-middle"><Checkbox checked={a.checked} onChange={v => onToggleAccount(a, v)} /></td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <input
                              value={a.accountName}
                              onChange={e => setAccount(a.key, { accountName: e.target.value, renamed: true })}
                              size={Math.max(6, a.accountName.length)}
                              className="text-sm font-medium bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none min-w-0 max-w-full"
                            />
                            {a.isContra && <Badge tone="neutral">contra</Badge>}
                            {a.custom && <Badge tone="info">custom</Badge>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-fg-subtle whitespace-nowrap">{previewNumbers[a.key] ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )
      })}

      {/* Add accounts to sections that aren't shown (declined during the questions). */}
      <Menu align="left" trigger={<Button variant="secondary" icon={<Plus size={14} />}>Add other accounts</Button>}>
        {(close) => (
          <>
            {SECTIONS.map(s => (
              <MenuItem key={s.type} onClick={() => { close(); addCustom(s.type) }}>Add {s.label} account</MenuItem>
            ))}
          </>
        )}
      </Menu>

      <ConfirmModal
        open={!!pendingRemove}
        tone="warning"
        badge="Required account"
        title={pendingRemove ? `Remove ${pendingRemove.accountName}?` : ''}
        description="This is a crucial account, and most businesses cannot keep their books without it."
        reasonsTitle="Why this account is important"
        reasons={[
          'Every chart of accounts must have at least one cash or bank account.',
          'It records the money your business receives and pays, and it is what you reconcile against your bank statements.',
          'You will not be able to publish until a cash or bank account is back in your chart of accounts.',
        ]}
        confirmLabel="Remove anyway"
        dismissLabel="Keep account"
        onConfirm={() => { if (pendingRemove) setAccount(pendingRemove.key, { checked: false }); setPendingRemove(null) }}
        onDismiss={() => setPendingRemove(null)}
      />
    </div>
  )
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="mt-0.5 shrink-0" role="checkbox" aria-checked={checked}>
      <span className={cn('w-4 h-4 rounded border flex items-center justify-center', checked ? 'bg-primary border-primary' : 'border-border-strong bg-white')}>
        {checked && <Check size={12} className="text-white" />}
      </span>
    </button>
  )
}

function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-wider text-fg-subtle font-medium">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value || '-'}</div>
      {hint && <div className="text-[10px] text-fg-subtle/70 mt-0.5">{hint}</div>}
    </div>
  )
}

// Step indicator styled like the Partner Creation stepper: a row of labelled
// tabs, each with a numbered / checked circle and a 2px underline bar
// (green for completed, blue for the active step).
function WizardSteps({ steps, stepIdx, reviewStep, maxStep, onJump }: {
  steps: { index: number; label: string }[]
  stepIdx: number
  reviewStep: number
  maxStep: number
  onJump: (i: number) => void
}) {
  return (
    <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto scrollbar-thin border-b border-border">
      {steps.map(s => {
        const completed = s.index < stepIdx
        const active = s.index === stepIdx
        const reachable = s.index <= maxStep
        return (
          <button
            key={s.index}
            disabled={!reachable}
            onClick={() => reachable && onJump(s.index)}
            className={cn('relative flex items-center gap-2 pb-2.5 pt-1 shrink-0',
              reachable && !active ? 'cursor-pointer' : 'cursor-default')}
          >
            <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-2xs font-semibold shrink-0 transition-all',
              completed ? 'bg-success-500 text-white'
                : active ? 'bg-primary text-white'
                : 'border-[1.5px] border-border-strong text-fg-subtle bg-white')}
            >
              {completed
                ? <Check size={12} />
                : s.index === 0 ? <Sparkles size={11} />
                : s.index === reviewStep ? <Check size={11} />
                : s.index}
            </span>
            <span className={cn('text-xs whitespace-nowrap transition-colors',
              active ? 'text-primary font-semibold'
                : completed ? 'text-success-700 font-medium'
                : 'text-fg-muted font-medium')}
            >
              {s.label}
            </span>
            {(active || completed) && (
              <div className={cn('absolute left-0 right-0 h-[2px] rounded-t-full -bottom-px', completed ? 'bg-success-500' : 'bg-primary')} />
            )}
          </button>
        )
      })}
    </div>
  )
}

// =====================================================================
// Legacy setup, Upload & Build-from-scratch paths (unchanged behaviour).
// =====================================================================
type Step = 'method' | 'configure' | 'review' | 'publish'

function LegacySetup({ initialPath }: { initialPath: Path | null }) {
  const navigate = useNavigate()
  const store = useStore()
  // Read the method param on mount. A recognized method (upload / scratch /
  // wizard) skips the in-page selector and lands directly on Configure (Step 2
  // of 4); a missing or unrecognized value falls back to the Method step. The
  // pre-selected card always matches the param.
  const method = initialPath && (['upload', 'scratch', 'wizard'] as Path[]).includes(initialPath) ? initialPath : null
  const [step, setStep] = useState<Step>(method ? 'configure' : 'method')
  const [path, setPath] = useState<Path>(method ?? 'wizard')
  const [fiscalYearStart, setFiscalYearStart] = useState(store.company.fiscalYearStart)
  const [industry, setIndustry] = useState(store.company.industry ?? 'Manufacturing')
  const [subsidiaries, setSubsidiaries] = useState(store.company.subsidiaries.map(s => s.name).join(', '))
  const [uploadedFile, setUploadedFile] = useState<string | null>(null)
  // Review working set, mirrors the guided wizard's review. Seeded from the
  // imported accounts (empty for a fresh upload), editable in the ReviewPane.
  const [reviewAccounts, setReviewAccounts] = useState<WizardAccount[]>([])
  useEffect(() => {
    if (step === 'review' && reviewAccounts.length === 0 && store.accounts.length > 0) {
      setReviewAccounts(store.accounts.map(a => ({ key: a.id, accountName: a.accountName, accountType: a.accountType, statementClassification: a.statementClassification, setupNote: '', source: 'import', checked: true })))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])
  const reviewChecked = reviewAccounts.filter(a => a.checked)
  const reviewMissing = requiredMissing(reviewChecked)

  const goto = (s: Step) => setStep(s)

  // Publish exactly like the wizard: auto-number and create any staged accounts
  // not already in the store, then mark setup complete.
  const publishUpload = () => {
    const existing = new Set(store.accounts.map(a => a.id))
    const newOnes = reviewChecked.filter(a => !existing.has(a.key))
    const counts: Record<string, WizardAccount[]> = {}
    newOnes.forEach(a => { (counts[a.accountType] ??= []).push(a) })
    const numbers: Record<string, string[]> = {}
    ;(Object.keys(counts) as AccountType[]).forEach(t => { numbers[t] = store.allocateNumbers(t, counts[t].length) })
    const cursor: Record<string, number> = {}
    newOnes.forEach(a => {
      const i = cursor[a.accountType] ?? 0
      cursor[a.accountType] = i + 1
      store.createAccount({
        accountNumber: numbers[a.accountType][i], accountName: a.accountName, accountType: a.accountType, statementClassification: a.statementClassification,
        glAccountType: 'Posting',
        parentId: null, isPosting: true, subsidiaryId: 'sub_main',
        currencyCode: store.company.baseCurrency, status: 'Active', effectiveDate: fiscalYearStart,
        postingRestrictions: {}, defaultDimensionValues: [], balance: 0, hasTransactions: false, pendingReview: true,
      })
    })
    store.setCompany({ fiscalYearStart, industry, setupComplete: true })
    store.pushToast('Chart of accounts published.')
    goto('publish')
  }

  // Once a method is chosen (any step past the selector), describe that path
  // instead of the generic three-option summary.
  const subtitle = step === 'method'
    ? 'Set up your account structure: upload an existing file, build from scratch, or use the guided wizard.'
    : path === 'upload'
      ? 'Upload an existing chart of accounts file. We will validate it against your numbering configuration before publishing.'
      : 'Build your chart of accounts from scratch by defining your numbering configuration and adding accounts manually.'

  return (
    <div className="pb-12">
      <PageHeader
        icon={<Sparkles size={18} />}
        title="Chart of Accounts setup"
        subtitle={subtitle}
        secondaryActions={<Button variant="ghost" onClick={() => navigate('/chart-of-accounts')}>Skip for now</Button>}
      />
      <div className="mx-auto w-full max-w-[1440px] 2xl:max-w-[1600px]">
      <div className="px-6 pt-4 space-y-1.5">
        <div className="text-xs text-fg-muted">Step {(['method', 'configure', 'review', 'publish'] as Step[]).indexOf(step) + 1} of 4</div>
        <StepIndicator current={step} />
      </div>

      <div className="px-6 mt-5">
        {step === 'method' && (
          <div className="grid md:grid-cols-3 gap-4">
            <PathCard active={path === 'wizard'} onClick={() => setPath('wizard')} icon={<Wand2 size={18} />} title="Guided wizard"
              best="Best for new / smaller companies"
              desc="Answer a short questionnaire; we build a tailored chart of accounts with a plain-language explanation on every account."
            />
            <PathCard active={path === 'upload'} onClick={() => setPath('upload')} icon={<Upload size={18} />} title="Upload your chart of accounts"
              best="Best for migrating from another system"
              desc="Upload a CSV or XLSX file. We will validate numbering and type mapping, then present an itemized error report for any invalid rows."
            />
            <PathCard active={path === 'scratch'} onClick={() => setPath('scratch')} icon={<Pencil size={18} />} title="Build from scratch"
              best="Best for advanced / manual setup"
              desc="Define how your numbers are built, set rules, hierarchy and restrictions, then build accounts manually."
            />
            <div className="md:col-span-3 flex justify-end">
              <Button
                onClick={() => {
                  if (path === 'wizard') navigate('/chart-of-accounts/setup?method=wizard')
                  else if (path === 'scratch') navigate('/chart-of-accounts/setup?method=scratch')
                  else goto('configure')
                }}
                iconRight={<ArrowRight size={14} />}
              >Next</Button>
            </div>
          </div>
        )}

        {step === 'configure' && (
          <div className="max-w-5xl space-y-4">
            {path === 'upload' && (
              <Card className="p-6">
                <h3 className="text-base font-semibold mb-1">Upload your chart of accounts file</h3>
                <p className="text-sm text-fg-muted mb-4">CSV or XLSX. We'll validate numbering and type mapping before showing the review screen.</p>
                {uploadedFile ? (
                  <AttachmentPreviewCard name={uploadedFile} onRemove={() => setUploadedFile(null)} />
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-10 text-center bg-bg-subtle/40">
                    <FileSpreadsheet size={36} className="mx-auto text-fg-subtle mb-2" />
                    <div className="text-sm font-medium">Drop your file here, or browse</div>
                    <div className="text-2xs text-fg-subtle mt-1">CSV, XLSX · max 5 MB</div>
                    <Button className="mt-4" variant="secondary" icon={<Upload size={14} />} onClick={() => setUploadedFile('accounts-export.csv')}>Choose file</Button>
                  </div>
                )}
              </Card>
            )}
            {path === 'scratch' && (
              <Card className="p-6">
                <h3 className="text-base font-semibold mb-1">Numbering configuration</h3>
                <p className="text-sm text-fg-muted mb-4">Define the parts your numbers are made of before building accounts.</p>
                <div className="grid grid-cols-3 gap-3">
                  {store.numberingScheme.segments.map((s, i) => (
                    <div key={i} className="p-3 border border-border rounded-md">
                      <div className="text-2xs uppercase tracking-wider text-fg-subtle font-semibold">Part {i + 1}</div>
                      <div className="text-sm font-medium mt-1">{s.meaning}</div>
                      <div className="text-2xs text-fg-muted mt-0.5">Length {s.length} · Separator "{s.separator || '-'}"</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            <div className="flex justify-between">
              <Button variant="ghost" icon={<ChevronLeft size={14} />} onClick={() => goto('method')}>Back</Button>
              <Button onClick={() => goto('review')} iconRight={<ArrowRight size={14} />}>Next</Button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="max-w-4xl space-y-4">
            <div>
              <h3 className="text-base font-semibold">Review your chart of accounts</h3>
              <p className="text-sm text-fg-muted mt-0.5">Uncheck anything you don't need, rename inline, or add accounts before publishing.</p>
            </div>
            <ReviewPane workingAccounts={reviewAccounts} setWorkingAccounts={setReviewAccounts} missing={[]} />
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" icon={<ChevronLeft size={14} />} onClick={() => goto('configure')}>Back</Button>
              <Button onClick={publishUpload} iconRight={<ArrowRight size={14} />}>Publish chart of accounts</Button>
            </div>
          </div>
        )}

        {step === 'publish' && (
          <div className="space-y-4 max-w-4xl">
            <Card className="p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-success-100 text-success-700 flex items-center justify-center mx-auto"><Check size={26} /></div>
              <h3 className="text-lg font-semibold mt-4">Chart of accounts published</h3>
              <p className="text-sm text-fg-muted mt-1">{store.accounts.length} account{store.accounts.length === 1 ? '' : 's'} are now live across Accounts Payable, Accounts Receivable, Inventory, and the General Ledger.</p>
              <div className="mt-5 flex items-center gap-2 justify-center">
                <Button variant="secondary" onClick={() => navigate('/numbering')}>Review numbering</Button>
                <Button onClick={() => navigate('/chart-of-accounts')}>Open Chart of Accounts</Button>
              </div>
            </Card>
            {store.accounts.length > 0 && (
              <Card className="overflow-hidden">
                <CardHeader title="Your published chart of accounts" subtitle={`${store.accounts.length} accounts`} />
                {/* readOnly: the chart is published, so this is a receipt rather
                    than an editor. Without it the rows carried a live kebab
                    whose Edit and lifecycle items silently did nothing. Managing
                    the chart happens through Open Chart of Accounts above. */}
                <AccountTable accounts={store.accounts} query="" density="condensed" columns={DEFAULT_COLUMNS} readOnly
                  onOpen={(a) => navigate(`/chart-of-accounts/${a.id}`)} onAction={() => {}} />
              </Card>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

// =====================================================================
// Build-from-Scratch, four-step flow: Numbering → Rules → Accounts → Review
// =====================================================================
type ScratchStep = 'numbering' | 'rules' | 'accounts' | 'review'
const SCRATCH_STEPS: { id: ScratchStep; label: string }[] = [
  { id: 'numbering', label: 'Numbering' },
  { id: 'rules', label: 'Rules' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'review', label: 'Review' },
]
const REQUIRED_TYPES: AccountType[] = ['AST', 'LIA', 'EQT', 'REV', 'EXP']
const TYPE_ORDER: AccountType[] = ['AST', 'LIA', 'EQT', 'REV', 'EXP']

// Columns for the read-only skeleton table on the Accounts step: Name, Number,
// GL type. The GL Account Category is dropped here since the sticky category
// anchor rows already carry the color-coded category badge.
const ACCOUNTS_STEP_COLUMNS: ColumnConfig = {
  number: true, name: true, type: false, classification: false,
  // Skeleton table: it is here to show the shape of the chart being built, and
  // a reservation is set on the account rather than seen from outside it.
  numberRange: false,
  glType: true, role: false, normalBalance: false, currency: false, openingBalance: false,
  fxBalance: false, runningBalance: false, status: false, description: false, dimensions: false, effectiveDate: false, posting: false,
  // A chart being built from scratch has nothing that arrived from anywhere.
  internalId: false, originalNumber: false, imported: false, restricted: false,
  // Nobody has created these yet: they are a chart still being drafted.
  createdBy: false, createdAt: false, updatedBy: false, updatedAt: false,
}

const SUGGESTED_STARTERS: { name: string; type: AccountType }[] = [
  { name: 'Operating Cash – HBL', type: 'AST' },
  { name: 'Accounts Receivable', type: 'AST' },
  { name: 'Accounts Payable', type: 'LIA' },
  { name: 'Retained Earnings', type: 'EQT' },
  { name: 'Sales Revenue', type: 'REV' },
  { name: 'Salaries & Wages Expense', type: 'EXP' },
  { name: 'Rent', type: 'EXP' },
]
/* Shown under "Always enforced", so each of these has to be a rule the code
   actually applies. The first two used to claim otherwise: a number no longer
   has to be unique on its own, because a chart read out of segmented codes holds
   71100 once per set of dimension values, and a number is no longer held to the
   numbering scheme's shape at all. Both are as
   validateAccountNumberAgainst in store.ts has them. */
const HARD_RULES: [string, string][] = [
  ['BR-001', 'No two accounts share a number and the same dimension values'],
  ['BR-002', 'An account number is letters, numbers and dashes, up to 100 characters'],
  ['BR-003', 'Child account type must match parent'],
  ['BR-004', 'Non-posting accounts cannot be posted to directly'],
  ['BR-008', 'Effective date cannot precede the fiscal year start'],
  ['BR-009', 'Bank / cash accounts require routing and account number'],
  ['BR-010', 'Currency is required on multi-currency tenants'],
  ['BR-013', 'All structural changes are audited'],
  ['BR-014', 'Hard-locked periods block tenant edits'],
]

// ---- Build-from-Scratch path-specific screens (used by GuidedWizard mode="scratch") ----

function scratchFormDefaults(a: Account) {
  return {
    accountType: a.accountType, accountNumber: a.accountNumber, accountName: a.accountName,
    glAccountType: a.glAccountType,
    accountRole: a.accountRole ?? '',
    statementClassification: a.statementClassification, isPosting: a.isPosting, parentId: a.parentId ?? '',
    bankRouting: a.bankRouting ?? '', bankAccountNumber: a.bankAccountNumber ?? '',
    subsidiaryId: a.subsidiaryId ?? 'sub_main', currencyCode: a.currencyCode, effectiveDate: a.effectiveDate,
    description: a.description ?? '', defaultDimensionValues: a.defaultDimensionValues ?? [], status: a.status,
  }
}
// Nest a freshly-added scratch account under its category anchor (seed_cat_<TYPE>)
// so the five GAAP categories (Asset/Liability/Equity/Revenue/Expense) act as the
// collapsible parents in the tree. Accounts that already carry an explicit parent
// (e.g. a hand-picked sub-account) keep it; the category anchors themselves are
// left at the root.
function nestUnderCategory(acc: Account): Account {
  const anchorId = `seed_cat_${acc.accountType}`
  if (acc.parentId || acc.id === anchorId) return acc
  return { ...acc, parentId: anchorId }
}
/* The tour's cards for this path, built once. */
const SCRATCH_CHART_CARDS = chartCards(SCRATCH_CHART_PATH)

/* Three example accounts stood under Assets while a chart tour card wants rows
   to point at: one summary keeping a block, and two posting accounts in it.
   Numbered off the Assets account itself, so a four digit chart reads 1100, 1110
   and 1120 rather than five digit numbers it could never hold. Never written to
   the draft; the step drops them when the card changes. */
const CHART_DEMO_IDS = { summary: '__demo-chart-summary', cash: '__demo-chart-cash', ar: '__demo-chart-ar' }
const CHART_DEMO_OPEN = ['seed_cat_AST', CHART_DEMO_IDS.summary]
function chartDemoAccounts(accounts: Account[]): Account[] {
  const root = accounts.find(a => a.id === 'seed_cat_AST')
  if (!root || !/^\d+$/.test(root.accountNumber)) return []
  const width = root.accountNumber.length
  const block = 10 ** Math.max(width - 2, 1)
  const start = Number(root.accountNumber) + block
  const num = (n: number) => String(n).padStart(width, '0')
  const posting = (id: string, n: number, name: string): Account => ({
    ...root, id, parentId: CHART_DEMO_IDS.summary, accountNumber: num(n), accountName: name,
    glAccountType: 'Posting', isPosting: true, numberRangeStart: undefined, numberRangeEnd: undefined,
  })
  return [
    { ...root, id: CHART_DEMO_IDS.summary, parentId: root.id, accountNumber: num(start), accountName: 'Current Assets',
      glAccountType: 'Summary', isPosting: false, numberRangeStart: start, numberRangeEnd: start + block - 1 },
    posting(CHART_DEMO_IDS.cash, start + block / 10, 'Cash'),
    posting(CHART_DEMO_IDS.ar, start + (2 * block) / 10, 'Accounts Receivable'),
  ]
}

/* The search on a setup Accounts step, read the way the chart listing reads
   its own: every column by the text it prints, shown or hidden, with figures
   and dimension names, and the hidden columns it matched in brought out after
   the name while it runs, under the note that says so. Mahad, 2026-10-05: *"can
   we have that on all searchable tables in the COA module?"* Shared by Build
   from scratch and Guided setup, which draw the same tree. */
export function useSetupAccountSearch(accounts: Account[], query: string, columns: ColumnConfig, columnOrder: ColKey[]) {
  const dimensions = useStore(s => s.dimensions)
  const base = useStore(s => s.company.baseCurrency)
  // The tree's figures roll up through the accounts it is handed as its chart.
  const ctx = useMemo<SearchContext>(() => {
    const names = new Map(dimensions.map(d => [d.id, d.name]))
    return { dimensionName: id => names.get(id), index: buildChartIndex(accounts), base }
  }, [dimensions, accounts, base])
  const matches = useMemo(() => searchAccounts(accounts, query, ctx), [accounts, query, ctx])
  const { revealed, hide } = useSearchReveal(query, useMemo(() => {
    const hits = hiddenSearchHits(matches, query, k => !!columns[k], ctx)
    return columnOrder.filter(k => hits.includes(k))
  }, [matches, query, columns, columnOrder, ctx]))
  const shownColumns = useMemo(
    () => (revealed.length ? { ...columns, ...Object.fromEntries(revealed.map(k => [k, true])) } : columns),
    [columns, revealed])
  const shownOrder = useMemo(() => orderWithRevealed(columnOrder, revealed, 'name'), [columnOrder, revealed])
  const note = <SearchRevealNote labels={revealed.map(k => HEADER_DEFS[k].label)} />
  return { matches, shownColumns, shownOrder, hide, note }
}

/** What a setup step says when its search finds nothing. The search reads every
 *  column now, so it no longer names three of them. */
export const SETUP_NO_MATCH_DESCRIPTION = 'Nothing in this chart carries that in any of its columns.'

function ScratchAccountsScreen({ tour = false, accounts, expanded, setExpanded, query, setQuery, columns, columnOrder, onOrderChange, colFilters, onColFiltersChange, frozenCols, onToggleFreeze, onHideColumn, onOpenAdd, onCreateRow, onEdit, onAddChild, onAddDimensions, onRemove, lastDelete }: {
  /** The chart tour is up: tag the columns its cards light. */
  tour?: boolean
  accounts: Account[]
  expanded: Set<string>; setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>
  query: string; setQuery: (v: string) => void
  columns: ColumnConfig; columnOrder: ColKey[]; onOrderChange: (o: ColKey[]) => void
  colFilters: ColFilters; onColFiltersChange: (f: ColFilters) => void
  frozenCols: ColKey[]; onToggleFreeze: (k: ColKey) => void; onHideColumn: (k: ColKey) => void
  onOpenAdd: () => void; onCreateRow: (prefill: CreateRowPrefill) => void; onEdit: (a: Account) => void
  onAddChild: (parent: Account) => void; onRemove: (a: Account) => void
  /** "Add dimensions" in a row's menu; absent until a dimension exists. */
  onAddDimensions?: (a: Account) => void
  lastDelete: { restore: () => void } | null
}) {
  const onToggle = (id: string, on?: boolean) => setExpanded(prev => { const n = new Set(prev); const should = on ?? !n.has(id); if (should) n.add(id); else n.delete(id); return n })
  const onAction = (action: string, a: Account) => { if (action === 'edit') onEdit(a); else if (action === 'delete') onRemove(a) }
  const tableRef = useRef<HTMLDivElement>(null)
  useColumnAnchors(tour, tableRef, CHART_COLUMN_ANCHORS)
  const search = useSetupAccountSearch(accounts, query, columns, columnOrder)
  return (
    <div className="space-y-4">
      {/* Toolbar: search + density toggle (left) and the primary actions (right),
          mirroring the Warehouse Locations nested-table controls. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search accounts…"
              className="h-9 w-64 pl-9 pr-8 rounded-lg border border-border bg-white text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-bg-muted text-fg-subtle hover:text-fg">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        {/* Skip-link target for keyboard users + the primary actions. */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Only after a delete: the toast's Undo has faded by the time someone
              has looked at the result, and this is the same restore. */}
          {lastDelete && (
            <Button size="sm" variant="secondary" icon={<CornerUpLeft size={14} />} onClick={lastDelete.restore}>
              Undo delete
            </Button>
          )}
          <Button id="scratch-add-account" data-walkthrough="chart-add" size="sm" icon={<Plus size={14} />} onClick={onOpenAdd}>Add account</Button>
        </div>
      </div>
      <a href="#scratch-add-account" className="sr-only focus:not-sr-only focus:inline-block focus:mb-1 text-xs text-primary underline">Skip to Add account</a>
      <Card data-walkthrough="chart-table" className="overflow-hidden">
        {/* Active column-filter chips, same bar as the Chart of Accounts
            listing - the tree behaves identically on every surface. */}
        <ColumnFiltersBar
          filters={colFilters}
          onChange={onColFiltersChange}
          availableColumns={columnOrder.filter(k => k !== 'name' && (columns as unknown as Record<string, boolean>)[k])}
          labelOf={k => HEADER_DEFS[k].label}
          uniqueValuesOf={k => uniqueColValues(k, accounts)}
          blankFilterOf={blankFilter}
        />
        {search.note}
        <div ref={tableRef} data-walkthrough-clip className="overflow-auto scrollbar-thin max-h-[calc(100vh-320px)]">
          <AccountTree accounts={search.matches} chart={accounts} query={query} density="condensed" columns={search.shownColumns} order={search.shownOrder} onOrderChange={onOrderChange} colFilters={colFilters} onColFiltersChange={onColFiltersChange} expanded={expanded} onToggle={onToggle} onOpen={onEdit} onAction={onAction} onCreateRow={onCreateRow} onAddChild={onAddChild} onAddDimensions={onAddDimensions} bodyScroll={false} draftMenu directCreate
                  /* Only what matched, as the listing does (Mahad, 2026-10-02), and the
                  listing's own answer when nothing does. */
                  emptyState={<EmptyState icon={<Search size={20} />} title={`No accounts match "${query.trim()}"`} description={SETUP_NO_MATCH_DESCRIPTION} action={<Button onClick={() => setQuery('')}>Clear search</Button>} />} />
        </div>
      </Card>
    </div>
  )
}

function ScratchSetup() {
  const navigate = useNavigate()
  const store = useStore()
  const [step, setStep] = useState<ScratchStep>('numbering')

  // Draft scheme, seeded from the default, edited locally, committed on publish.
  const [scheme, setScheme] = useState<NumberingScheme>(store.numberingScheme)
  // Tenant-configurable defaults (Step 2).
  const multiCurrency = store.company.subsidiaries.length > 1
  const [defaults, setDefaults] = useState({
    allowNonBaseCurrency: multiCurrency,
    autoSuggestNumbers: true,
    requireEffectiveDate: true,
  })
  // Locally-staged accounts (Accounts step), not committed until publish.
  const [localAccounts, setLocalAccounts] = useState<Account[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [createDefaults, setCreateDefaults] = useState<any>(undefined)
  const [editingId, setEditingId] = useState<string | null>(null)
  const { expanded, toggle: toggleExpanded } = useTreeExpansion(localAccounts)

  const countsByType = TYPE_ORDER.map(t => ({ type: t, label: ACCOUNT_TYPE_META[t].label, count: localAccounts.filter(a => a.accountType === t).length }))
  const remainingSuggestions = SUGGESTED_STARTERS.filter(s => !localAccounts.some(a => a.accountName.toLowerCase() === s.name.toLowerCase()))

  const fromAccount = (a: Account) => ({
    accountType: a.accountType, accountNumber: a.accountNumber, accountName: a.accountName,
    subType: a.subType ?? '', isPosting: a.isPosting, parentId: a.parentId ?? '',
    bankRouting: a.bankRouting ?? '', bankAccountNumber: a.bankAccountNumber ?? '',
    subsidiaryId: a.subsidiaryId ?? 'sub_main', currencyCode: a.currencyCode, effectiveDate: a.effectiveDate,
    description: a.description ?? '', defaultDimensionValues: a.defaultDimensionValues ?? [], taxCodeId: a.taxCodeId ?? '',
  })

  const openAdd = () => { setEditingId(null); setCreateDefaults(undefined); setCreateOpen(true) }
  const openAddSuggested = (s: { name: string; type: AccountType }) => { setEditingId(null); setCreateDefaults({ accountName: s.name, accountType: s.type }); setCreateOpen(true) }
  const openEdit = (a: Account) => { setEditingId(a.id); setCreateDefaults(fromAccount(a)); setCreateOpen(true) }
  // Inline between-row "+" → open the create modal pre-filled with the number /
  // name / Category / GL type the user entered in the draft row.
  const onCreateRow = (prefill: any) => { setEditingId(null); setCreateDefaults(prefill); setCreateOpen(true) }

  const handleCreate = (acc: Account) => {
    setLocalAccounts(prev => editingId ? prev.map(x => x.id === editingId ? { ...acc, id: editingId } : x) : [...prev, acc])
    setEditingId(null)
  }
  const { requestDelete, confirmModal } = useDeleteWithUndo(localAccounts, setLocalAccounts)
  const onAction = (action: string, a: Account) => {
    if (action === 'edit' || action === 'open') openEdit(a)
    else if (action === 'delete') requestDelete(a)
  }

  const publish = () => {
    store.setNumberingScheme(scheme)
    // Commit accounts parents-first, remapping local ids to the new store ids.
    const idMap = new Map<string, string>()
    const remaining = [...localAccounts]
    let guard = 0
    while (remaining.length && guard < 2000) {
      guard++
      for (let i = 0; i < remaining.length; i++) {
        const a = remaining[i]
        if (!a.parentId || idMap.has(a.parentId)) {
          // The account whole. Only its parent is decided here, because the id it
          // was staged under is not the id the store just issued.
          const created = store.createAccount({
            ...draftOf(a),
            parentId: a.parentId ? idMap.get(a.parentId)! : null,
          })
          idMap.set(a.id, created.id)
          remaining.splice(i, 1); i--
        }
      }
    }
    store.setCompany({ defaults, setupComplete: true })
    store.pushToast('Chart of accounts published.')
    navigate('/chart-of-accounts')
  }

  return (
    <div className="pb-12">
      <PageHeader
        icon={<Pencil size={18} />}
        title="Chart of Accounts setup"
        subtitle="Build your chart of accounts from scratch: define the numbering configuration, confirm the rules, add accounts, then review and publish."
        secondaryActions={<Button variant="ghost" onClick={() => navigate('/chart-of-accounts')}>Skip for now</Button>}
      />
      <div className="mx-auto w-full max-w-[1440px] 2xl:max-w-[1600px]">
      <div className="px-6 pt-4">
        <ScratchStepIndicator current={step} />
      </div>

      <div className="px-6 mt-5">
        {/* ---------- Step 1, Numbering ---------- */}
        {step === 'numbering' && (
          <div className="max-w-5xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Define the numbering configuration</h3>
              <button onClick={() => setScheme(store.numberingScheme)} className="text-xs text-brand-700 hover:underline">Use sensible defaults</button>
            </div>
            <NumberingSchemeEditor scheme={scheme} onChange={setScheme} />
            <Banner tone="info" title="What this decides">
              This settles the shape of the numbers Omne suggests. It is not a rule about what a number may be: no category owns a block of numbers, nothing is reserved, and you can number any account whatever you like.
            </Banner>
            <div className="flex justify-between">
              <Button variant="ghost" icon={<ChevronLeft size={14} />} onClick={() => navigate('/chart-of-accounts')}>Back to setup methods</Button>
              <Button onClick={() => setStep('rules')} iconRight={<ArrowRight size={14} />}>Continue to rules</Button>
            </div>
          </div>
        )}

        {/* ---------- Step 2, Rules ---------- */}
        {step === 'rules' && (
          <div className="max-w-5xl space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader title="Hard rules" subtitle="Always enforced. Shown here for transparency." />
                <div className="p-4 divide-y divide-border text-sm">
                  {HARD_RULES.map(([id, txt]) => (
                    <div key={id} className="py-2.5 flex items-start gap-3">
                      <span className="badge-neutral shrink-0">{id}</span>
                      <span className="text-fg-muted">{txt}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <CardHeader title="Tenant defaults" subtitle="Applied to new accounts. You can change these later." />
                <div className="p-4 space-y-4">
                  <Toggle checked={defaults.allowNonBaseCurrency} onChange={v => setDefaults(d => ({ ...d, allowNonBaseCurrency: v }))} label="Allow non-base currency accounts" hint="Permit accounts denominated in a currency other than the tenant base currency." />
                  <div className="border-t border-border" />
                  <Toggle checked={defaults.autoSuggestNumbers} onChange={v => setDefaults(d => ({ ...d, autoSuggestNumbers: v }))} label="Suggest the next number" hint="Offer the lowest number still free under the parent, under the number field." />
                  <div className="border-t border-border" />
                  <Toggle checked={defaults.requireEffectiveDate} onChange={v => setDefaults(d => ({ ...d, requireEffectiveDate: v }))} label="Require an effective date" hint="Every new account must carry an effective date on or after the fiscal year start." />
                </div>
              </Card>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" icon={<ChevronLeft size={14} />} onClick={() => setStep('numbering')}>Back to numbering</Button>
              <Button onClick={() => setStep('accounts')} iconRight={<ArrowRight size={14} />}>Continue to accounts</Button>
            </div>
          </div>
        )}

        {/* ---------- Step 3, Accounts ---------- */}
        {step === 'accounts' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
              <div className="lg:col-span-3">
                <Card>
                  <CardHeader title="Your chart of accounts" subtitle={`${localAccounts.length} account${localAccounts.length === 1 ? '' : 's'} added`} />
                  {localAccounts.length === 0 ? (
                    <div className="p-10 text-center">
                      <p className="text-sm font-medium text-fg">No accounts yet</p>
                      <p className="text-xs text-fg-muted mt-1 max-w-sm mx-auto">Use the panel on the right to add your first account, typically a top-level Asset or a Cash / Bank account.</p>
                    </div>
                  ) : (
                    <AccountTree accounts={localAccounts} chart={localAccounts} query="" density="condensed" columns={DEFAULT_COLUMNS} expanded={expanded} onToggle={toggleExpanded} onOpen={openEdit} onAction={onAction} onCreateRow={onCreateRow} />
                  )}
                </Card>
              </div>

              <div className="lg:sticky lg:top-4">
                <Card className="p-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-fg">Add an account</h4>
                    <Button className="mt-2.5 w-full justify-center" icon={<Plus size={14} />} onClick={openAdd}>Add account</Button>
                  </div>
                  {remainingSuggestions.length > 0 && (
                    <div className="border-t border-border pt-3">
                      <div className="text-2xs uppercase tracking-wider font-semibold text-fg-subtle mb-2">Suggested next</div>
                      <div className="space-y-1">
                        {remainingSuggestions.map(s => (
                          <div key={s.name} className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate text-fg-muted">{s.name} <span className="text-fg-subtle">· {ACCOUNT_TYPE_META[s.type].label}</span></span>
                            <button onClick={() => openAddSuggested(s)} className="text-brand-700 hover:underline shrink-0 text-xs font-medium">Add</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="border-t border-border pt-3">
                    <div className="text-2xs uppercase tracking-wider font-semibold text-fg-subtle mb-2">Accounts by type</div>
                    <div className="space-y-1 text-xs">
                      {countsByType.map(c => (
                        <div key={c.type} className="flex items-center justify-between">
                          <span className="text-fg-muted">{c.label}</span>
                          <span className={cn('font-medium', REQUIRED_TYPES.includes(c.type) && c.count === 0 ? 'text-danger-600' : 'text-fg')}>{c.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" icon={<ChevronLeft size={14} />} onClick={() => setStep('rules')}>Back to rules</Button>
              <Button onClick={() => setStep('review')} iconRight={<ArrowRight size={14} />}>Continue to review</Button>
            </div>
          </div>
        )}

        {/* ---------- Step 4, Review ---------- */}
        {step === 'review' && (
          <div className="max-w-4xl space-y-4">
            <Banner tone="info" title="Review your chart before publishing">
              Once published, your numbering configuration is locked and existing numbers will not be silently re-mapped. Changes to the number's parts after publish require an audited migration.
            </Banner>
            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold">Ready to publish</h3>
                  <p className="text-sm text-fg-muted mt-1"><strong className="text-fg">{localAccounts.length}</strong> account{localAccounts.length === 1 ? '' : 's'} across {countsByType.filter(c => c.count > 0).length} types.</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Badge tone="neutral"><Calendar size={11} className="text-fg-subtle" /> Fiscal year: {store.company.fiscalYearStart}</Badge>
                  <Badge tone="neutral"><DollarSign size={11} className="text-fg-subtle" /> Base currency: {store.company.baseCurrency}</Badge>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {countsByType.map(c => (
                  <div key={c.type} className="flex items-center justify-between px-3 py-2 rounded-md bg-bg-subtle text-xs">
                    <span className="text-fg-muted">{c.label}</span>
                    <span className="font-semibold">{c.count}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader title="Account hierarchy" subtitle="Rename inline or remove any account before publishing." />
              <AccountTree accounts={localAccounts} chart={localAccounts} query="" density="condensed" columns={DEFAULT_COLUMNS} expanded={expanded} onToggle={toggleExpanded} onOpen={openEdit} onAction={onAction} onCreateRow={onCreateRow} />
            </Card>
            <div className="flex justify-between">
              <Button variant="ghost" icon={<ChevronLeft size={14} />} onClick={() => setStep('accounts')}>Back to accounts</Button>
              <Button onClick={publish} iconRight={<ArrowRight size={14} />}>Publish chart</Button>
            </div>
          </div>
        )}
      </div>

      <CreateAccountSlideOver
        open={createOpen}
        onClose={() => { setCreateOpen(false); setEditingId(null) }}
        defaults={createDefaults}
       scheme={scheme}
        accountsOverride={editingId ? localAccounts.filter(a => a.id !== editingId) : localAccounts}
        onCreate={handleCreate}
      />
      {confirmModal}
      </div>
    </div>
  )
}

function ScratchStepIndicator({ current }: { current: ScratchStep }) {
  return <StepTabs steps={SCRATCH_STEPS.map(s => s.label)} current={SCRATCH_STEPS.findIndex(s => s.id === current)} />
}

const LEGACY_STEPS: { id: Step; label: string }[] = [
  { id: 'method', label: 'Method' },
  { id: 'configure', label: 'Configure' },
  { id: 'review', label: 'Review and confirm' },
  { id: 'publish', label: 'Publish' },
]
function StepIndicator({ current }: { current: Step }) {
  return <StepTabs steps={LEGACY_STEPS.map(s => s.label)} current={LEGACY_STEPS.findIndex(s => s.id === current)} />
}

function PathCard({ active, onClick, icon, title, best, desc }: any) {
  return (
    <button onClick={onClick} className={cn('text-left p-5 rounded-lg border-2 transition-all bg-white',
      active ? 'border-primary shadow-sm' : 'border-border hover:border-border-strong')}>
      <div className={cn('w-9 h-9 rounded-md flex items-center justify-center mb-3', active ? 'bg-primary text-white' : 'bg-bg-muted text-fg-muted')}>{icon}</div>
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-2xs text-fg-subtle mt-0.5">{best}</div>
      <p className="text-xs text-fg-muted mt-3">{desc}</p>
      {active && <div className="mt-3 inline-flex items-center gap-1 text-xs text-primary font-medium"><Check size={12} /> Selected</div>}
    </button>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-wider text-fg-subtle font-medium">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  )
}

// =========================
// Attachment preview card (upload flow)
// =========================
// Card-style preview of the chosen file, modeled on the document-library card:
// a clipped thumbnail at the top, a source chip, then the filename, timestamp,
// and size · uploader line. For spreadsheets the thumbnail renders the
// top-left corner of Sheet 1 from cell A1 (the first several rows / columns).
export function AttachmentPreviewCard({ name, onRemove }: { name: string; onRemove: () => void }) {
  const ext = name.split('.').pop()?.toUpperCase() || 'CSV'
  const isSheet = ext === 'CSV' || ext === 'XLSX'
  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-white shadow-xs">
      {/* Thumbnail */}
      <div className="relative bg-bg-subtle/40 border-b border-border-subtle rounded-t-xl overflow-hidden">
        {isSheet ? <SpreadsheetThumb /> : (
          <div className="h-52 flex items-center justify-center"><FileSpreadsheet size={40} className="text-fg-subtle" /></div>
        )}
        <span className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded-md bg-white border border-border text-2xs font-semibold text-success-700 shadow-xs">{ext}</span>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
      </div>
      {/* Meta */}
      <div className="px-4 pt-3 pb-4">
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-subtle border border-border text-2xs text-fg-muted mb-2.5">
          <FileSpreadsheet size={11} /> Chart of accounts import
        </span>
        <div className="flex items-start justify-between gap-2">
          <div className="text-base font-semibold text-fg break-all leading-snug">{name}</div>
          <Menu align="right" trigger={<button className="btn-icon shrink-0"><MoreVertical size={16} /></button>}>
            {(c) => (
              <>
                <MenuItem icon={<Download size={14} />} onClick={c}>Download</MenuItem>
                <MenuItem icon={<X size={14} />} danger onClick={() => { c(); onRemove() }}>Remove file</MenuItem>
              </>
            )}
          </Menu>
        </div>
        <div className="text-xs text-fg-subtle mt-1.5">Selected just now</div>
        <div className="text-xs text-fg-subtle mt-0.5">42 KB · Ahtisham Ahmad</div>
      </div>
    </div>
  )
}

// Spreadsheet thumbnail: top-left of Sheet 1 starting at A1, showing the first
// rows / columns with a lettered column header and numbered row gutter, clipped
// to a roughly 1:1.4 portrait aspect ratio.
function SpreadsheetThumb() {
  const cols = ['A', 'B', 'C', 'D', 'E']
  const data = [
    ['Number', 'Name', 'Type', 'Parent', 'Status'],
    ['1000-0000-00', 'Assets', 'Asset', '', 'Active'],
    ['1010-0000-00', 'Cash and Bank', 'Asset', 'Assets', 'Active'],
    ['1010-1000-00', 'Operating Account', 'Asset', 'Cash and Bank', 'Active'],
    ['1100-0000-00', 'Accounts Receivable', 'Asset', 'Assets', 'Active'],
    ['2000-0000-00', 'Liabilities', 'Liability', '', 'Active'],
    ['2010-0000-00', 'Accounts Payable', 'Liability', 'Liabilities', 'Active'],
    ['3000-0000-00', 'Equity', 'Equity', '', 'Active'],
    ['4000-0000-00', 'Revenue', 'Revenue', '', 'Active'],
    ['5000-0000-00', 'Cost of Goods Sold', 'Cost of Goods Sold', '', 'Active'],
    ['6000-0000-00', 'Operating Expenses', 'Expense', '', 'Active'],
    ['6010-0000-00', 'Salaries and Wages', 'Expense', 'Operating Expenses', 'Active'],
  ]
  const cell = 'border-r border-b border-border-subtle px-1.5 h-5 text-left align-middle truncate text-[9px] leading-none text-fg-muted'
  return (
    <div className="h-56 overflow-hidden bg-white">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <th className="w-6 bg-bg-subtle border-r border-b border-border-subtle h-4" />
            {cols.map(c => (
              <th key={c} className="bg-bg-subtle border-r border-b border-border-subtle h-4 text-[9px] font-medium text-fg-subtle">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, r) => (
            <tr key={r}>
              <td className="w-6 bg-bg-subtle border-r border-b border-border-subtle text-center text-[9px] text-fg-subtle font-medium h-5">{r + 1}</td>
              {cols.map((_, c) => (
                <td key={c} className={cn(cell, r === 0 && 'font-semibold text-fg bg-bg-subtle/40')}>{row[c]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function hierarchyPreview(accounts: any[]) {
  const lines: { number: string; name: string; depth: number }[] = []
  const byParent = new Map<string | null, any[]>()
  accounts.forEach(a => {
    const k = a.parentId ?? null
    if (!byParent.has(k)) byParent.set(k, [])
    byParent.get(k)!.push(a)
  })
  function walk(parent: string | null, depth: number) {
    const list = (byParent.get(parent) ?? []).slice().sort((a, b) => compareAccountNumbers(a.accountNumber, b.accountNumber))
    for (const a of list) {
      lines.push({ number: a.accountNumber, name: a.accountName, depth })
      if (lines.length > 40) return
      walk(a.id, depth + 1)
    }
  }
  walk(null, 0)
  return lines
}
