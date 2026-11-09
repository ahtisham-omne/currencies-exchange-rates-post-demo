import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerUpLeft, Info, Layers, Lock, Plus, Search, X } from 'lucide-react'
import { useStore } from '../store'
import { ACCOUNT_TYPE_META, DEFAULT_NUMBER_WIDTH, draftOf, type Account } from '../types'
import {
  EMPTY_GUIDED_ANSWERS, GUIDED_LOCKED_NUMBERS, visibleGuidedQuestions,
  computeGuidedChart, guidedEntryToAccount, guidedIndustryLabel, guidedPreviewAccounts, guidedText, isGuidedAnswered, optionAdditions,
  type GuidedAnswers, type GuidedEntry,
} from '../lib/guidedSetup'
import { LEAVE_SETUP_PATH_CONFIRM, WizardChrome } from '../components/WizardChrome'
import { WizardRightPane } from '../components/WizardRightPane'
import { AccountTree, CAT_CHIP, CAT_ICON, ColumnFiltersBar, DEFAULT_COLUMN_ORDER, useTreeExpansion, HEADER_DEFS, uniqueColValues, blankFilter, type ColKey, type ColFilters, type ColumnConfig, type CreateRowPrefill } from '../components/AccountTable'
import { CreateAccountSlideOver } from './CreateAccount'
import { DIMENSIONS_DEMO_DIMENSIONS, SCRATCH_DIMENSIONS_COPY, SCRATCH_DIMENSIONS_LABEL, SETUP_NO_MATCH_DESCRIPTION, useSetupAccountSearch } from './Setup'
import { DimensionsEditor, DIMENSION_NOUN } from '../components/DimensionsEditor'
import { AccountDimensionsModal } from '../components/AccountDimensionsModal'
import { DIMENSIONS_CARDS, DIMENSIONS_DEMO, DIMENSIONS_LABEL } from '../components/walkthrough/dimensionsCards'
import { DimensionsWelcome } from '../components/walkthrough/dimensionsWelcome'
import { DIMENSIONS_READING_ROOM } from './scratchReadingRoom'
import { Banner, Button, Card, EmptyState, OptionCard, Tooltip } from '../components/ui'
import { jumpToError } from '../lib/formErrors'
import { CountryCombobox } from '../components/CountryCombobox'
import { AccountNumberingStep, jumpToRangeProblem, schemeFromNumberWidth, schemeFromNumbering, numberWidthValid, categoryRangesValid, defaultCategoryRanges, NUMBERING_STEP_LABEL, NUMBERING_STEP_TITLE, NUMBERING_STEP_SUBTITLE } from '../components/AccountNumberingStep'
import { useDeleteWithUndo } from '../components/useDeleteWithUndo'
import { deriveModuleChecklist } from '../components/ModuleSetupChecklist'
import { GUIDED_ACCOUNTS_READING_ROOM, GUIDED_NUMBER_LENGTH_READING_ROOM, GUIDED_YOUR_BUSINESS_READING_ROOM } from '../components/BuildEducation'
import { ReadingRoom, WalkthroughReplayRow } from '../components/walkthrough/ReadingRoom'
import { WalkthroughOverlay } from '../components/walkthrough/WalkthroughOverlay'
import { NumberingWelcome } from '../components/walkthrough/numberingWelcome'
import { ChartWelcome } from '../components/walkthrough/chartWelcome'
import { NUMBERING_CARDS, NUMBERING_LABEL } from '../components/walkthrough/numberingCards'
import { GUIDED_CHART_CARDS, GUIDED_NUMBERING_WELCOME, GUIDED_QUESTION_CARDS, GUIDED_QUESTIONS_LABEL, GUIDED_QUESTIONS_WELCOME } from '../components/walkthrough/guidedCards'
import { CHART_COLUMN_ANCHORS, CHART_LABEL, useColumnAnchors } from '../components/walkthrough/chartCards'
import { takeFirstWalkthrough, WALKTHROUGH_OPEN_DELAY_MS } from '../components/walkthrough/walkthroughState'

// Each tour here stands on one screen, so it has nowhere to move to and nothing to demo.
const noop = () => {}

/* Dimensions before the accounts, as Build from scratch has them: an account can
   carry dimension values, so they have to exist first (Mahad, 2026-10-08: *"The
   guided setup in our first-time view is missing a dimension. Just like we
   added dimensions in Build from Scratch, we need to add dimensions here as
   well."*). Skippable, as there. */
const PHASE_LABELS = [NUMBERING_STEP_LABEL, 'Your business', SCRATCH_DIMENSIONS_LABEL, 'Add your accounts']
const PHASE_ORDER = ['numbering', 'question', 'dimensions', 'preview'] as const

// Same reduced column set the build-from-scratch accounts step uses, so the
// guided preview table matches it exactly.
const PREVIEW_COLUMNS: ColumnConfig = {
  number: true, name: true, type: true, classification: false,
  // The wizard builds a chart from a template; nothing in it has reserved a
  // block of numbers yet, so the column would print a dash on every summary.
  numberRange: false,
  glType: true, role: false, normalBalance: false, currency: false, openingBalance: false,
  fxBalance: false, runningBalance: false, status: false, description: false, dimensions: false, effectiveDate: false, posting: false,
  // Nothing in this wizard was imported, so neither provenance column has an
  // answer worth a column here.
  internalId: false, originalNumber: false, imported: false, restricted: false,
  // Nobody has created these yet: they are a chart still being drafted.
  createdBy: false, createdAt: false, updatedBy: false, updatedAt: false,
}

type Phase = (typeof PHASE_ORDER)[number]

// The question step names the baseline first, so answering nothing still reads as
// a chart rather than an empty one, and says what skipping costs: the accounts for
// what you do, not correctness. It deliberately does not promise a guess for the
// questions left blank - the reader would then wonder what was guessed.
export const QUESTION_STEP_INTRO = "Every business starts with a standard set of core accounts. Answer the questions below and we'll add the extra accounts for what you do. Skip anything that doesn't apply, and you can rename, add, or remove any account on Add your accounts."
export const QUESTION_STEP_EMPTY_HINT = "Your core accounts are already set. Answer a question to see what else we'll add."

// The last step before a chart exists. Grouping is offered here rather than
// earlier because it can only be decided once the accounts are on the page: the
// questions produce a flat chart that posts fine but reads poorly, and whether
// cash accounts or payroll costs want a subtotal is a question about the rows
// the reader is now looking at. It stays optional - a chart of twenty accounts
// needs no structure built over it.
export const PREVIEW_STEP_INTRO = 'Grouped by category and pre-filled from your answers, with summary accounts already made so related accounts roll up into a subtotal on your reports. Rename, renumber, or remove any row. Locked system accounts stay put.'

// The "why" behind a label, as an icon beside the words it explains rather than
// pinned to the row's far edge: in a column this wide that left every icon an inch
// away from what it was about. It swallows its own clicks, so reading the help
// inside an option button never picks that option.
//
// `rich` so the text can be a readable column - the plain tooltip caps at 240px,
// which turns these into a ribbon. `align="left"` hangs it rightward, since the
// trigger sits near the left of the page.
function WhyTooltip({ label, explainer }: { label: string; explainer: string }) {
  return (
    <Tooltip
      rich
      align="left"
      content={<p className="w-[320px] px-3.5 py-3 text-xs text-fg-muted leading-relaxed">{explainer}</p>}
    >
      <span
        onClick={e => { e.stopPropagation(); e.preventDefault() }}
        aria-label={label}
        className="inline-flex shrink-0 cursor-help text-fg-subtle/60 hover:text-fg-subtle"
      >
        <Info size={12} />
      </span>
    </Tooltip>
  )
}

/* What an answer adds, as a card rather than a paragraph. Design review,
   2026-10-02 - Eli, on these hovers: *"this is a lot of text, and it's kind of
   hard to read ... I look like I'm looking at a wall of text."* So the card
   lists the accounts the answer adds, each with the one line that says what it
   is for, and nothing after them - Mahad, 2026-10-07: *"we can only show the
   accounts that will be added. No need to show the bottom text."* An answer
   that adds nothing - a method, a "not yet" - has no list to show, so it reads
   its explainer, which for those is short.

   Each account leads with the module's own list marker, the icon tile a hover
   card's rows carry (OverflowCard), holding its category's icon in its
   category's colours - the Category badge's, so Asset reads violet here as it
   does in the chart (Mahad, 2026-10-07: *"can we populate the colors in the
   tooltips?"*). It replaced a bare coloured dot. */
function AnswerCard({ label, adds, explainer }: {
  label: string
  adds: GuidedEntry[]
  explainer?: string
}) {
  return (
    <div className="w-[380px] px-3.5 py-3 text-xs" data-answer-card>
      <div className="text-fg" style={{ fontWeight: 600 }}>{label}</div>
      {adds.length > 0 ? (
        <>
          <div className="mt-2 text-2xs uppercase tracking-[0.06em] text-fg-subtle" style={{ fontWeight: 600 }}>
            Adds {adds.length} account{adds.length === 1 ? '' : 's'}
          </div>
          {/* Name and purpose on one line: an answer like Manufacture products
              adds ten accounts, and two lines each ran the card off the screen. */}
          <ul className="mt-2 space-y-1.5">
            {adds.map(e => (
              <li key={e.number} className="flex gap-2 leading-snug">
                {(() => {
                  const Icon = CAT_ICON[e.type] ?? Layers
                  const tone = CAT_CHIP[ACCOUNT_TYPE_META[e.type]?.color ?? 'neutral'] ?? CAT_CHIP.neutral
                  return (
                    <span className={`w-5 h-5 -mt-[2px] rounded-md border flex items-center justify-center shrink-0 ${tone.bg} ${tone.text} ${tone.border}`} aria-hidden data-category-tile={e.type}>
                      <Icon className="w-3 h-3" />
                    </span>
                  )
                })()}
                <span className="min-w-0">
                  <span className="text-fg" style={{ fontWeight: 500 }}>{e.name}</span>
                  <span className="text-fg-muted"> &middot; {e.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : explainer && <p className="mt-1 text-fg-muted leading-relaxed">{explainer}</p>}
    </div>
  )
}

// The house option card, with this flow's hover beside the label: the terms a
// guided question uses are the terms it is teaching, so each one can explain
// itself where it is read.
function GuidedOptionCard({ card, label, walkthrough, ...rest }: {
  active: boolean; multi?: boolean; onClick: () => void
  label: string; description?: string
  card?: ReactNode
  /** The tour's key for this answer's info icon, on the one answer it points at. */
  walkthrough?: string
}) {
  return (
    <OptionCard
      {...rest}
      label={label}
      accessory={card && (
        <Tooltip rich align="left" content={card}>
          <span
            onClick={e => { e.stopPropagation(); e.preventDefault() }}
            data-walkthrough={walkthrough}
            aria-label={`What ${label} adds`}
            className="inline-flex shrink-0 cursor-help text-fg-subtle/60 hover:text-fg-subtle"
          >
            <Info size={12} />
          </span>
        </Tooltip>
      )}
    />
  )
}

/* The height a sticky panel can show at once: what the wizard's scrolling body
   shows, less its padding. Measured, because the modal and Full view are
   different heights and the modal is resized with the window. Undefined below
   the two-column breakpoint, where the panel stacks under the questions and the
   body's own scroll reaches it. */
function useStickyFit(ref: RefObject<HTMLElement | null>, active: boolean): number | undefined {
  const [fit, setFit] = useState<number>()
  useLayoutEffect(() => {
    const el = active ? ref.current : null
    let body = el?.parentElement ?? null
    while (body && !/(auto|scroll)/.test(getComputedStyle(body).overflowY)) body = body.parentElement
    if (!body) return
    const twoColumns = window.matchMedia('(min-width: 1024px)')
    const update = () => {
      if (!twoColumns.matches) return setFit(undefined)
      const cs = getComputedStyle(body!)
      setFit(Math.floor(body!.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(body)
    twoColumns.addEventListener('change', update)
    return () => { ro.disconnect(); twoColumns.removeEventListener('change', update) }
  }, [ref, active])
  return fit
}

export function GuidedSetupWizard({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const company = useStore(s => s.company)
  const ctx = useMemo(() => ({ baseCurrency: company.baseCurrency, fiscalYearStart: company.fiscalYearStart }), [company.baseCurrency, company.fiscalYearStart])

  const [answers, setAnswers] = useState<GuidedAnswers>(EMPTY_GUIDED_ANSWERS)
  const [phase, setPhase] = useState<Phase>('numbering')
  // The scheme is this flow's first question, because every account it generates
  // needs a number written in it. Held as a draft and written to the store with
  // the accounts at publish, so backing out leaves nothing set.
  const [numbering, setNumbering] = useState(DEFAULT_NUMBER_WIDTH)
  // The block each category keeps, set on the same step (2026-10-01).
  const [categoryRanges, setCategoryRanges] = useState(() => defaultCategoryRanges(DEFAULT_NUMBER_WIDTH))
  const rangesValid = categoryRangesValid(categoryRanges, numbering)
  const scheme = useMemo(
    () => (rangesValid ? schemeFromNumbering(numbering, categoryRanges) : schemeFromNumberWidth(numbering)),
    [rangesValid, numbering, categoryRanges])

  // Staged accounts for the preview/edit table - materialized when entering the
  // preview phase, then editable before publish.
  const [localAccounts, setLocalAccounts] = useState<Account[]>([])
  /* Written straight to the store, as Build from scratch writes them: a
     dimension is not part of the chart being drafted, and the account form on
     the next step reads the store to offer values. */
  const dimensions = useStore(s => s.dimensions)
  const addDimension = useStore(s => s.addDimension)
  const updateDimension = useStore(s => s.updateDimension)
  const deleteDimension = useStore(s => s.deleteDimension)
  const hasDimensions = dimensions.some(d => d.status === 'Active')
  // The account whose dimensions the row menu's "Add dimensions" opened.
  const [dimsFor, setDimsFor] = useState<Account | null>(null)
  // The tour's demo: an example dimension stood up while the editor is empty.
  const [dimensionsDemo, setDimensionsDemo] = useState<string | null>(null)
  /* The Dimensions column shows once there is something to put in it, as on
     Build from scratch's Accounts step. */
  const previewColumns = useMemo<ColumnConfig>(() => ({ ...PREVIEW_COLUMNS, dimensions: hasDimensions }), [hasDimensions])
  const { expanded, setExpanded, toggle: toggleExpanded } = useTreeExpansion(localAccounts)
  const [createOpen, setCreateOpen] = useState(false)
  const [createDefaults, setCreateDefaults] = useState<any>(undefined)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [columnOrder, setColumnOrder] = useState<ColKey[]>(DEFAULT_COLUMN_ORDER)
  const search = useSetupAccountSearch(localAccounts, query, previewColumns, columnOrder)
  const [colFilters, setColFilters] = useState<ColFilters>({})

  const stepIndex = PHASE_ORDER.indexOf(phase)
  /* The furthest step reached, so going back keeps the steps ahead clickable
     (Mahad, 2026-10-01). */
  const [furthest, setFurthest] = useState(0)
  useEffect(() => { setFurthest(f => Math.max(f, stepIndex)) }, [stepIndex])
  /* How it works: the same guide Build from scratch has on its Accounts step,
     because Add your accounts is the same table and the same form. No
     walkthrough here - Mahad, 2026-10-02: *"Please remove the walkthrough
     experience from the guided setup flow."* */
  const [learnOpen, setLearnOpen] = useState(false)
  /* Where the guide opens: the part about the screen the reader is on, or the
     section a question's Learn more names. */
  const [learnAt, setLearnAt] = useState<string | undefined>(undefined)
  const openGuide = (at?: string) => { setLearnAt(at); setLearnOpen(true) }

  /* ──── An introduction on each screen ────
     The account numbers tour, then the questions, then the chart, each offered
     once a session the first time its screen is reached and again from the
     bottom of How it works. See `guidedCards.tsx`. */
  const [tour, setTour] = useState<Phase | null>(null)
  useEffect(() => {
    const key = phase === 'numbering' ? 'numbering-guided' : phase === 'question' ? 'questions-guided' : phase === 'dimensions' ? 'dimensions-guided' : 'chart-guided'
    const t = window.setTimeout(() => {
      if (!takeFirstWalkthrough(key)) return
      setTour(phase)
    }, WALKTHROUGH_OPEN_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [phase])
  const startTour = () => { setLearnOpen(false); setTour(phase) }
  const tourCards = phase === 'numbering' ? NUMBERING_CARDS : phase === 'question' ? GUIDED_QUESTION_CARDS : phase === 'dimensions' ? DIMENSIONS_CARDS : GUIDED_CHART_CARDS
  const chartRef = useRef<HTMLDivElement>(null)
  // The Your business panel, held to the height the body shows.
  const addedRef = useRef<HTMLDivElement>(null)
  const addedFit = useStickyFit(addedRef, phase === 'question')
  useColumnAnchors(tour === 'preview', chartRef, CHART_COLUMN_ANCHORS)

  const answeredAny = Object.values(answers).some(isGuidedAnswered)
  // The questions this reader is asked: ownership and sales tax are US-only.
  const questions = visibleGuidedQuestions(answers)

  const setField = (field: keyof GuidedAnswers, value: string) => setAnswers(a => ({ ...a, [field]: value }))

  // Picking an option glides the user down to the next question, keeping the
  // one-question-at-a-time flow moving. We skip the auto-scroll when the choice
  // reveals an inline follow-up in the SAME block (partner count) so it isn't
  // scrolled past before it's seen, and respect reduced-motion preferences.
  const scrollToNext = (index: number) => {
    const next = questions[index + 1]
    if (!next) return
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() => {
      document.getElementById(`guided-q-${next.id}`)?.scrollIntoView({
        behavior: prefersReduced ? 'auto' : 'smooth', block: 'start',
      })
    })
  }
  const selectOption = (index: number, field: keyof GuidedAnswers, value: string) => {
    setField(field, value)
    // An answer that brings up a message stays put, so the message is read
    // rather than scrolled past: a country outside the US is told which
    // questions it skips.
    if (questions[index]?.notice?.({ ...answers, [field]: value })) return
    scrollToNext(index)
  }
  // A list answer never auto-advances: the whole point is that a second pick is
  // expected, and scrolling away invites the reader to stop at one.
  // An exclusive option ("None of these") clears every other choice, and any
  // other choice clears it.
  /* What "None of these" just cleared, so the question can say so and offer
     it back. Design review, 2026-10-02: Eli picked every answer to the assets
     question and found none of them recorded - the last one he picked was None
     of these, which clears the rest, and nothing on screen said it had. */
  const [cleared, setCleared] = useState<{ field: keyof GuidedAnswers; values: string[] } | null>(null)
  const toggleOption = (field: keyof GuidedAnswers, value: string, exclusive?: string) => {
    const current = answers[field] as string[]
    const clearing = value === exclusive && !current.includes(value) ? current.filter(v => v !== value) : []
    setCleared(clearing.length ? { field, values: clearing } : null)
    setAnswers(a => {
      const cur = a[field] as string[]
      const next = cur.includes(value)
        ? cur.filter(v => v !== value)
        : value === exclusive ? [value] : [...cur.filter(v => v !== exclusive), value]
      return { ...a, [field]: next }
    })
  }
  const undoClear = () => {
    if (!cleared) return
    setAnswers(a => ({ ...a, [cleared.field]: cleared.values }))
    setCleared(null)
  }

  // ---- Live right pane: the baseline is always present, so it forms the
  // "prior" count; everything the user's answers introduce is listed as added. ----
  const baselineEntries = useMemo(() => computeGuidedChart(EMPTY_GUIDED_ANSWERS, false), [])
  const baselineNumbers = useMemo(() => new Set(baselineEntries.map(e => e.number)), [baselineEntries])
  const priorCount = useMemo(() => baselineEntries.filter(e => e.posting === 'Posting').length, [baselineEntries])
  const fullChart = useMemo(() => computeGuidedChart(answers, false), [answers])
  const fullAccounts = useMemo(() => fullChart.map(e => guidedEntryToAccount(e, ctx)), [fullChart, ctx])
  const addedEntries = useMemo(() => fullChart.filter(e => !baselineNumbers.has(e.number)), [fullChart, baselineNumbers])

  // ---- Preview edit handlers (mirror the scratch flow's staged create/edit) ----
  // The five category anchors and the locked system accounts can't be renamed or
  // removed. Only the anchors are locked, not every summary: a summary the user
  // adds here is theirs to change.
  const isLocked = (a: Account) =>
    a.id.startsWith('seed_cat_')
    || GUIDED_LOCKED_NUMBERS.has(a.masterChartRef ?? a.accountNumber)

  const materializePreview = () => setLocalAccounts(guidedPreviewAccounts(scheme, answers, ctx))

  const fromAccount = (a: Account) => ({
    accountType: a.accountType, accountNumber: a.accountNumber, accountName: a.accountName,
    statementClassification: a.statementClassification, glAccountType: a.glAccountType, subType: a.subType ?? '',
    accountRole: a.accountRole ?? '',
    isPosting: a.isPosting, parentId: a.parentId ?? '',
    currencyCode: a.currencyCode, effectiveDate: a.effectiveDate, description: a.description ?? '',
  })
  const openEdit = (a: Account) => { if (isLocked(a)) return; setEditingId(a.id); setCreateDefaults(fromAccount(a)); setCreateOpen(true) }
  const openAdd = () => { setEditingId(null); setCreateDefaults(undefined); setCreateOpen(true) }
  const onCreateRow = (prefill: CreateRowPrefill) => { setEditingId(null); setCreateDefaults(prefill); setCreateOpen(true) }
  const handleCreate = (acc: Account) => {
    if (editingId) {
      setLocalAccounts(prev => prev.map(x => x.id === editingId ? { ...acc, id: editingId } : x))
      setEditingId(null)
      setExpanded(prev => new Set(prev).add(acc.id))
      return
    }
    setLocalAccounts(prev => [...prev, acc])
    setEditingId(null)
    setExpanded(prev => new Set(prev).add(acc.id))
  }
  const { requestDelete, confirmModal, lastDelete } = useDeleteWithUndo(localAccounts, setLocalAccounts)
  const onAction = (action: string, a: Account) => {
    if (action === 'edit' || action === 'open') openEdit(a)
    else if (action === 'delete') { if (!isLocked(a)) requestDelete(a) }
  }

  // ---- Publish. Commit accounts parents-first, seed the module checklist,
  // then finish and route to the chart. ----
  const createChart = () => {
    const store = useStore.getState()
    store.setNumberingScheme(scheme)
    const idMap = new Map<string, string>()
    const remaining = [...localAccounts]
    let guard = 0
    while (remaining.length && guard < 3000) {
      guard++
      for (let i = 0; i < remaining.length; i++) {
        const a = remaining[i]
        if (!a.parentId || idMap.has(a.parentId)) {
          // The account whole. Only its parent is decided here, because the id it
          // was staged under is not the id the store just issued.
          // No Current Year Earnings account on the chart it builds (design,
          // 2026-10-12), so none rides in with its first revenue account.
          const created = store.createAccount({
            ...draftOf(a),
            parentId: a.parentId ? idMap.get(a.parentId)! : null,
          }, { withoutEarnings: true })
          idMap.set(a.id, created.id)
          remaining.splice(i, 1); i--
        }
      }
    }
    const items = deriveModuleChecklist(localAccounts)
    store.setCompany({
      country: answers.country ?? undefined,
      industry: guidedIndustryLabel(answers),
      accountingMethod: answers.method ?? undefined,
      moduleSetupChecklist: { items, dismissed: false },
    })
    store.pushToast('Chart of accounts created.')
    finish()
  }

  const finish = () => {
    useStore.getState().setCompany({ setupComplete: true })
    navigate('/chart-of-accounts')
    onClose()
  }

  // Nothing is required. A question left alone either adds nothing or takes the
  // safe default `computeGuidedChart(_, true)` supplies at publish, which beats
  // making someone guess at a term to get past the screen.
  const skippedCount = questions.filter(q => !isGuidedAnswered(answers[q.field])).length
  // The accounting method is the one answer Continue waits for.
  const missingRequired = questions.filter(q => q.required && !isGuidedAnswered(answers[q.field]))
  /* Continue stays pressable without it, and says what is missing when pressed:
     the error standard (decision 120), not a disabled button explained in a
     footer. Design review, 2026-10-08 - Eli: *"This is violating my rules.
     Should never be a Hover State, can't proceed. Should be a, hey, this is what
     you did wrong, go do the thing."* */
  const [questionsAttempted, setQuestionsAttempted] = useState(false)
  const requiredMessage = (q: { field: string }) => (q.field === 'method' ? 'Choose an accounting method.' : 'Answer this question.')
  const refuseQuestions = () => {
    setPhase('question')
    setQuestionsAttempted(true)
    const first = missingRequired[0]
    window.setTimeout(() => jumpToError(document.getElementById(`guided-q-${first.id}`)?.querySelector<HTMLElement>('[data-guided-options]') ?? null), 0)
  }

  // ---- Navigation ----
  const numberingValid = numberWidthValid(numbering) && rangesValid
  // Continue was pressed over a range problem: the step lists them (decision 120).
  const [rangesAttempted, setRangesAttempted] = useState(false)
  /* The chart is built from the answers as the reader leaves the questions, not
     as they leave Dimensions: Back from the accounts to Dimensions and on again
     keeps the edits made to them. */
  const onNext = () => {
    if (phase === 'numbering') {
      if (!numberingValid) { setRangesAttempted(true); jumpToRangeProblem(); return }
      setPhase('question'); return
    }
    if (phase === 'question') {
      if (missingRequired.length) { refuseQuestions(); return }
      materializePreview(); setPhase('dimensions')
    }
    else if (phase === 'dimensions') setPhase('preview')
    else createChart()
  }
  const onPrev = () => {
    const at = PHASE_ORDER.indexOf(phase)
    if (at > 0) setPhase(PHASE_ORDER[at - 1])
  }

  const prevDisabled = phase === 'numbering'
  /* Skip while nothing is defined, as on Build from scratch: Continue over an
     empty step leaves the reader wondering what they agreed to. */
  const nextLabel = phase === 'numbering' ? 'Continue'
    : phase === 'question' ? 'Continue'
    : phase === 'dimensions' ? (dimensions.length === 0 ? 'Skip' : 'Review accounts')
    // Mahad, 2026-10-08: "Rename create chart button in guided wizard to publish chart".
    : 'Publish chart'
  const subtitle = phase === 'numbering'
    ? 'Set your account numbers'
    : phase === 'question'
    ? 'Answer what you know and skip the rest'
    : phase === 'dimensions'
    ? 'Choose what to report by'
    : 'Review and edit your accounts'

  return (
    <>
      <WizardChrome
        variant="modal"
        moduleName="Guided setup"
        /* One height on every step, as Build from scratch holds it, so a search
           that narrows the table to a row does not shrink the panel under it. */
        fixedHeight
        subtitle={subtitle}
        stepIndex={stepIndex}
        stepLabels={PHASE_LABELS}
        maxStep={Math.max(furthest, stepIndex)}
        /* Forward goes the way Next does: past the number length only while it
           reads, and into the review by building it from the answers, as
           "Review accounts" does. */
        onJump={i => {
          if (i === 0) { setPhase('numbering'); return }
          if (!numberingValid) { setPhase('numbering'); setRangesAttempted(true); jumpToRangeProblem(); return }
          if (i === 1) { setPhase('question'); return }
          if (missingRequired.length) { refuseQuestions(); return }
          // Leaving the questions builds the chart, however the reader leaves them.
          if (phase === 'numbering' || phase === 'question') materializePreview()
          setPhase(PHASE_ORDER[i])
        }}
        // Every step has a guide of its own, read from the top.
        onLearn={() => learnOpen ? setLearnOpen(false) : openGuide()}
        learnOpen={learnOpen}
        overlay={
          <ReadingRoom
            open={learnOpen}
            onClose={() => setLearnOpen(false)}
            // The Dimensions step reads the dimensions guide, as Build from scratch's does.
            config={phase === 'numbering' ? GUIDED_NUMBER_LENGTH_READING_ROOM
              : phase === 'question' ? GUIDED_YOUR_BUSINESS_READING_ROOM
              : phase === 'dimensions' ? DIMENSIONS_READING_ROOM
              : GUIDED_ACCOUNTS_READING_ROOM}
            openAt={learnAt}
            tail={<WalkthroughReplayRow onStart={startTour} count={tourCards.length} title="Take the walkthrough" subtitle={`${tourCards.length} short cards`} />}
          />
        }
        confirmOnClose={answeredAny || phase === 'dimensions' || phase === 'preview'}
        onDiscard={onClose}
        discardCopy={
          // Only ever opened from "Choose how to begin", so leaving always lands
          // the reader back on that choice.
          LEAVE_SETUP_PATH_CONFIRM
        }
        onPrev={onPrev}
        prevDisabled={prevDisabled}
        onNext={onNext}
        nextLabel={nextLabel}
        footerMessage={phase === 'numbering'
          ? undefined
          : phase === 'question' && skippedCount
          ? <span className="text-xs text-fg-muted">{skippedCount} skipped, and you can add any account on Add your accounts</span>
          // Nothing is required here, so the footer says so.
          : phase === 'dimensions'
          ? <span className="text-sm text-fg-muted">{dimensions.length === 0 ? SCRATCH_DIMENSIONS_COPY.skipHint : `${dimensions.length} ${dimensions.length === 1 ? DIMENSION_NOUN.one : DIMENSION_NOUN.many} defined`}</span>
          : undefined}
      >
        {/* The same frame Build from scratch gives this step (Mahad, 2026-10-02:
            *"The margins in these two are different ... Use build from
            scratch's one"*): full width up to 1200px, its spacing, its heading. */}
        {phase === 'numbering' && (
          <div className="mx-auto w-full max-w-[1200px] space-y-5">
            <div>
              <h2 className="text-xl text-fg" style={{ fontWeight: 500 }}>{NUMBERING_STEP_TITLE}</h2>
              <p className="text-sm text-fg-muted mt-1 leading-relaxed">{NUMBERING_STEP_SUBTITLE}</p>
            </div>
            <AccountNumberingStep digits={numbering} onChange={setNumbering} ranges={categoryRanges} onRangesChange={setCategoryRanges} attempted={rangesAttempted} />
          </div>
        )}

        {phase === 'dimensions' && (
          <div className="mx-auto w-full max-w-[1200px] space-y-5">
            <div>
              <h2 className="text-xl text-fg" style={{ fontWeight: 500 }}>{SCRATCH_DIMENSIONS_COPY.title}</h2>
              <p className="text-sm text-fg-muted mt-1 leading-relaxed">{SCRATCH_DIMENSIONS_COPY.subtitle}</p>
            </div>
            {/* The wrapper carries the tour's key, as on Build from scratch. */}
            <div data-walkthrough="dimensions">
              {dimensionsDemo === DIMENSIONS_DEMO && dimensions.length === 0 ? (
                <DimensionsEditor dimensions={DIMENSIONS_DEMO_DIMENSIONS} onCreate={() => {}} onUpdate={() => {}} onDelete={() => {}} emptyHint={SCRATCH_DIMENSIONS_COPY.emptyHint} />
              ) : (
                <DimensionsEditor dimensions={dimensions} onCreate={draft => addDimension(draft)} onUpdate={updateDimension} onDelete={deleteDimension} emptyHint={SCRATCH_DIMENSIONS_COPY.emptyHint} />
              )}
            </div>
          </div>
        )}

        {phase === 'question' && (
          <div className="mx-auto w-full max-w-[1200px] grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6 lg:gap-8 items-start">
            <div className="min-w-0 space-y-8" data-walkthrough="guided-questions">
              <div>
                <h2 className="text-xl text-fg" style={{ fontWeight: 500 }}>Tell us about your business</h2>
                <p className="text-sm text-fg-muted mt-1 leading-relaxed max-w-2xl">{QUESTION_STEP_INTRO}</p>
              </div>
              {questionsAttempted && missingRequired.length > 0 && (
                <div data-step-summary>
                  <Banner tone="danger" title={`You can't continue yet - ${missingRequired.length} ${missingRequired.length === 1 ? 'thing' : 'things'} to fix.`}>
                    <ul className="mt-1.5 space-y-1 list-disc pl-4 marker:text-danger-400">
                      {missingRequired.map(q => <li key={q.id}>{requiredMessage(q)}</li>)}
                    </ul>
                  </Banner>
                </div>
              )}
              {questions.map((question, i) => {
                const raw = answers[question.field]
                const picked = Array.isArray(raw) ? (raw as string[]) : raw == null ? [] : [raw as string]
                const notice = question.notice?.(answers)
                return (
                  <div key={question.id} id={`guided-q-${question.id}`} className="space-y-3 scroll-mt-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full text-2xs font-semibold flex items-center justify-center shrink-0 bg-brand-50 text-primary">{i + 1}</span>
                        <h3 className="text-base text-fg" style={{ fontWeight: 600 }}>{guidedText(question.title, answers)}</h3>
                        {question.explainer && <WhyTooltip label="Why we ask this" explainer={question.explainer} />}
                      </div>
                      {question.subtitle && (
                        <p className="text-sm text-fg-muted mt-1 leading-relaxed pl-[34px]">{guidedText(question.subtitle, answers)}</p>
                      )}
                      {question.learnMore && (
                        <button type="button" onClick={() => openGuide(question.learnMore!.section)} data-learn-more={question.id}
                          className="mt-1 ml-[34px] text-sm text-primary hover:underline underline-offset-2" style={{ fontWeight: 600 }}>
                          {question.learnMore.label} <span aria-hidden>&rarr;</span>
                        </button>
                      )}
                    </div>
                    <div className="space-y-2.5 pl-[34px]" data-guided-options>
                      {questionsAttempted && missingRequired.includes(question) && (
                        <p data-field-error className="text-xs text-danger-600">{requiredMessage(question)}</p>
                      )}
                      {question.input === 'country' ? (
                        <div className="max-w-sm">
                          <CountryCombobox
                            value={answers.country ?? ''}
                            onChange={code => selectOption(i, 'country', code)}
                          />
                        </div>
                      ) : question.options.map(opt => (
                        <Fragment key={opt.value}>
                        {/* The answer that clears the others stands apart from
                            them, so it does not read as one more to tick. */}
                        {question.exclusive === opt.value && (
                          <div className="flex items-center gap-2 pt-1 text-2xs text-fg-subtle" aria-hidden>
                            <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
                          </div>
                        )}
                        <GuidedOptionCard
                          active={picked.includes(opt.value)}
                          multi={question.multi}
                          onClick={() => question.multi
                            ? toggleOption(question.field, opt.value, question.exclusive)
                            : selectOption(i, question.field, opt.value)}
                          label={opt.label}
                          description={opt.description}
                          walkthrough={question.id === 'activities' && opt === question.options[0] ? 'guided-answer-info' : undefined}
                          card={(opt.explainer || optionAdditions(question, opt.value, answers).length > 0) && (
                            <AnswerCard label={opt.label} adds={optionAdditions(question, opt.value, answers)} explainer={opt.explainer} />
                          )}
                        />
                        </Fragment>
                      ))}
                      {cleared?.field === question.field && (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-subtle/60 px-3 py-2 text-xs text-fg-muted" data-cleared-note>
                          <span>{question.options.find(o => o.value === question.exclusive)?.label} cleared {cleared.values.length === 1 ? 'the answer' : `the ${cleared.values.length} answers`} you had picked.</span>
                          <button type="button" onClick={undoClear} className="shrink-0 text-primary hover:underline underline-offset-2" style={{ fontWeight: 600 }}>Undo</button>
                        </div>
                      )}
                      {notice && <Banner tone="info">{notice}</Banner>}
                    </div>
                  </div>
                )
              })}
            </div>
            <div ref={addedRef} className="lg:sticky lg:top-0 min-w-0">
              {/* Its own scroll, no taller than the body shows (Mahad,
                  2026-10-08): a long list scrolls under the pointer rather than
                  running off the bottom of a sticky panel, most of all in the
                  smaller modal. It keeps the scroll at its ends instead of
                  handing it to the questions. */}
              <div data-walkthrough="guided-added" data-added-pane
                className="wizard-right-pane rounded-lg p-6 overflow-auto overscroll-contain scrollbar-thin"
                style={{ maxHeight: addedFit, minHeight: Math.min(420, addedFit ?? 420) }}>
                <WizardRightPane
                  newEntries={addedEntries}
                  priorCount={priorCount}
                  fullAccounts={fullAccounts}
                  coreEntries={baselineEntries}
                  title="Adding from your answers"
                  footerSuffix="from your answers"
                  emptyHint={QUESTION_STEP_EMPTY_HINT}
                  hideChartChip
                />
              </div>
            </div>
          </div>
        )}

        {phase === 'preview' && (
          <div ref={chartRef} className="mx-auto w-full max-w-[1200px] space-y-5">
            <div>
              <h2 className="text-xl text-fg" style={{ fontWeight: 500 }}>Add your accounts</h2>
              <p className="text-sm text-fg-muted mt-1 leading-relaxed">{PREVIEW_STEP_INTRO}</p>
              {/* Guided setup ends by pointing to the guide (decision 124; module
                  review, 2026-10-06, COA-20), on the step itself rather than only
                  in the tour a reader may have skipped. It stays reachable from
                  the chart afterwards, beside Dimensions. */}
              <p data-guide-pointer className="text-sm text-fg-muted mt-1.5 leading-relaxed">
                The reasons behind the chart, with examples, are in How it works.{' '}
                <button type="button" onClick={() => openGuide()} className="text-primary hover:underline underline-offset-2" style={{ fontWeight: 600 }}>Read the guide</button>. It stays one click away on your chart once it&apos;s published.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
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
              <div className="flex items-center gap-2 shrink-0">
                {/* Only after a delete: the toast's Undo has faded by the time
                    someone has looked at the result, and this is the same restore. */}
                {lastDelete && (
                  <Button size="sm" variant="secondary" icon={<CornerUpLeft size={14} />} onClick={lastDelete.restore}>
                    Undo delete
                  </Button>
                )}
                <Button size="sm" data-walkthrough="chart-add" icon={<Plus size={14} />} onClick={openAdd}>Add account</Button>
              </div>
            </div>
            <Card className="overflow-hidden" data-walkthrough="chart-table">
              {/* Active column-filter chips, same bar as the Chart of Accounts
                  listing - the tree behaves identically on every surface. */}
              <ColumnFiltersBar
                filters={colFilters}
                onChange={setColFilters}
                availableColumns={columnOrder.filter(k => k !== 'name' && (previewColumns as unknown as Record<string, boolean>)[k])}
                labelOf={k => HEADER_DEFS[k].label}
                uniqueValuesOf={k => uniqueColValues(k, localAccounts)}
                blankFilterOf={blankFilter}
              />
              {search.note}
              <div className="overflow-auto scrollbar-thin max-h-[calc(100vh-320px)]">
                <AccountTree
                  accounts={search.matches} chart={localAccounts} query={query} density="condensed"
                  /* Only what matched, as the listing does (Mahad, 2026-10-02), and the
                  listing's own answer when nothing does. */
                  emptyState={<EmptyState icon={<Search size={20} />} title={`No accounts match "${query.trim()}"`} description={SETUP_NO_MATCH_DESCRIPTION} action={<Button onClick={() => setQuery('')}>Clear search</Button>} />}
                  columns={search.shownColumns} order={search.shownOrder} onOrderChange={setColumnOrder}
                  colFilters={colFilters} onColFiltersChange={setColFilters}
                  expanded={expanded} onToggle={toggleExpanded}
                  onOpen={openEdit} onAction={onAction} onCreateRow={onCreateRow}
                  bodyScroll={false} draftMenu directCreate
                  // Only once a dimension exists: a skipped Dimensions step offers nothing to link.
                  onAddDimensions={hasDimensions ? a => setDimsFor(a) : undefined}
                  canDelete={a => !isLocked(a)}
                  rowBadge={a => isLocked(a) && GUIDED_LOCKED_NUMBERS.has(a.masterChartRef ?? a.accountNumber)
                    ? <span className="inline-flex items-center gap-1 text-2xs text-fg-subtle bg-bg-muted rounded-full px-1.5 py-0.5"><Lock size={10} /> Locked</span>
                    : null}
                />
              </div>
            </Card>
          </div>
        )}
      </WizardChrome>

      {tour === 'numbering' && (
        <WalkthroughOverlay
          cards={NUMBERING_CARDS}
          label={NUMBERING_LABEL}
          welcome={p => <NumberingWelcome {...p} {...GUIDED_NUMBERING_WELCOME} startLabel="Start tour" />}
          currentStep="numbering"
          onGoToStep={noop}
          onDemo={noop}
          onClose={() => setTour(null)}
          skipLabel="Skip tour"
        />
      )}
      {tour === 'question' && (
        <WalkthroughOverlay
          cards={GUIDED_QUESTION_CARDS}
          label={GUIDED_QUESTIONS_LABEL}
          welcome={p => <ChartWelcome {...p} label={GUIDED_QUESTIONS_LABEL} {...GUIDED_QUESTIONS_WELCOME} startLabel="Start tour" />}
          currentStep="questions"
          onGoToStep={noop}
          onDemo={noop}
          onClose={() => setTour(null)}
          skipLabel="Skip tour"
        />
      )}
      {tour === 'dimensions' && (
        <WalkthroughOverlay
          cards={DIMENSIONS_CARDS}
          label={DIMENSIONS_LABEL}
          welcome={p => <DimensionsWelcome {...p} />}
          currentStep="dimensions"
          onGoToStep={noop}
          onDemo={setDimensionsDemo}
          onClose={() => { setTour(null); setDimensionsDemo(null) }}
          skipLabel="Skip tour"
        />
      )}
      {tour === 'preview' && (
        <WalkthroughOverlay
          cards={GUIDED_CHART_CARDS}
          label={CHART_LABEL}
          welcome={p => <ChartWelcome {...p} />}
          currentStep="accounts"
          onGoToStep={noop}
          onDemo={noop}
          onClose={() => setTour(null)}
          skipLabel="Skip tour"
        />
      )}

      <CreateAccountSlideOver
        open={createOpen}
        onClose={() => { setCreateOpen(false); setEditingId(null) }}
        defaults={createDefaults}
        scheme={scheme}
        editAccount={editingId ? localAccounts.find(a => a.id === editingId) : undefined}
        accountsOverride={editingId ? localAccounts.filter(a => a.id !== editingId) : localAccounts}
        onCreate={handleCreate}
      />
      {dimsFor && (
        <AccountDimensionsModal
          open
          account={dimsFor}
          value={dimsFor.defaultDimensionValues}
          onClose={() => setDimsFor(null)}
          onSave={values => {
            setLocalAccounts(prev => prev.map(x => x.id === dimsFor.id ? { ...x, defaultDimensionValues: values } : x))
            setDimsFor(null)
          }}
        />
      )}
      {confirmModal}
    </>
  )
}
