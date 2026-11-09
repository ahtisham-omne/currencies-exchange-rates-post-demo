import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Upload, FileSpreadsheet, X, Check, CheckCircle2, Loader2,
  ArrowRight, Download, Info, Ban, Search, Hash, ListFilter, Eye,
} from 'lucide-react'
import { FormModal, Button, ConfirmModal, Tooltip, Select, Banner, OptionCard, Quoted, HowItWorksButton, useResponsiveIconSize } from '../components/ui'
import { StepIndicator } from '../components/WizardChrome'
import { schemeFromNumberWidth } from '../components/AccountNumberingStep'
import { useStore, deriveNormalBalance, defaultClassificationForCategory } from '../store'
import { runUploadValidation, buildExistingIndex, parentsFirst, importRowOf, type ParsedRow } from '../lib/uploadValidation'
import { parseWorkbook, WorkbookError } from '../lib/workbook'
import { buildChartIndex } from '../lib/chartTree'
import {
  TEMPLATE_FIELDS, templateExampleRows,
  readTemplateCsv, readTemplateGrid, type GridReading,
  csvGrid, TEMPLATE_COLUMNS, type RowField,
  downloadTemplate as downloadTemplateFile, TEMPLATE_FILENAME,
} from '../lib/importTemplate'
import { ACCOUNT_TYPE_META, ALL_CLASSIFICATIONS, CATEGORY_OF_CLASSIFICATION, CATEGORY_ORDER, ALL_ACCOUNT_ROLES, DEFAULT_NUMBER_WIDTH, needsBankDetails, displayAccountNumber, numberProtectionOn, type Account, type AccountRole, type AccountStatus, type Dimension, type NumberingScheme } from '../types'
import {
  detectFileShape, readRows, unsupportedReason, maxAccountIdx, suggestAccountSlot,
  slotValueCounts, distinctSlotValues, slotQuestions, VALUE_MEANS_NOTHING,
  patternFit, slotTally, rowsWithoutDimensions,
  type RowReading, type SlotDimensionMapping, type UnsupportedReason,
  type SlotChoices, type SlotQuestion, type PatternFit, type SlotTally,
} from '../lib/codeMapper'
import { labelProgress } from '../lib/valueLabels'
import { splitRows, type SlotMeaning, isSummary } from '../lib/importSplit'
import { WalkthroughOverlay } from '../components/walkthrough/WalkthroughOverlay'
import {
  EXAMPLE_SPLIT, EXAMPLE_DIMENSIONS, EXAMPLE_LABELS, EXAMPLE_REVIEW,
} from '../components/walkthrough/walkthroughExample'
import { takeFirstWalkthrough } from '../components/walkthrough/walkthroughState'
import { WALKTHROUGH_CARDS, type WalkthroughStep } from '../components/walkthrough/walkthroughCards'
import { SPECIMEN_PARTS } from '../components/walkthrough/walkthroughArt'
import { WalkthroughWelcome } from '../components/walkthrough/walkthroughWelcome'
import { ReadingRoom, WalkthroughReplayRow } from '../components/walkthrough/ReadingRoom'
import { importGuideFor } from './importReadingRoom'
import { ExpandToggle, PreviewChartTable, type PreviewColKey, type PreviewRow, type Density } from '../components/AccountTable'
import { DimensionValuesCell } from '../components/DimensionValues'
import { ReviewGrid } from './importReview/ReviewGrid'
import { REVIEW_COLUMN_BY_KEY, dimensionColumns, dimensionKey, type ReviewField, type ReviewRowView } from './importReview/reviewColumns'
import { countByStatus, type ReviewCounts, type ReviewFilter } from './importReview/reviewDerive'
import { cn } from '../lib/utils'
import { chartConflicts } from '../lib/numberRange'
import { AccountPill } from '../components/NumberRangeCard'

// =====================================================================================
// Import accounts - modeled 1:1 on the User Access Control "Actions > Import" flow.
// Upload → Review and fix → Importing → Complete, with up to three steps about
// numbers that hold dimensions in between when the file has them. Terms adapted
// from users to chart-of-accounts fields. Validation reuses the shared engine.
// =====================================================================================

/* Nobody is asked anything about their file that can be worked out from it.
   Which row holds the column names and which of our fields each column fills are
   both read off the header text without asking, so there is no step between the
   upload and what the file turned out to say.

   'split' asks the one question, of everyone: do the numbers hold dimensions?
   Yes goes on to 'dimensions' and then 'labels'; no imports the numbers as they
   are. A file with nothing to split never sees any of them.

   'dimensions' and 'labels' are two steps rather than one because they are two
   different jobs, done at different moments and by different people. Deciding
   which part is the account and what the others are takes a minute and has to
   be right. Naming forty codes takes an afternoon and is optional - the code
   imports as itself. Asking both at once made the second look mandatory and the
   first look bigger than it is. 'labels' is skipped entirely when every part
   turned out to be the account number or to mean nothing.

   There is no longer a step offering to shorten the number. A number is stored
   exactly as the file spelled it, so there is no scheme to reconcile it with.

   'preview' comes after the write, not before it: the reader has just been told
   four numbers about their chart and the next thing they want is to look at the
   chart. It is reached from the summary rather than by pressing Next, but it is
   still a step of the trail: it is the last screen of the import, and the trail
   is also how the reader gets back to the grid from it. */
type Step = 'upload' | 'split' | 'dimensions' | 'labels' | 'review' | 'importing' | 'done' | 'preview'

/* What the import promises once there is a file to import. Uploading is not one
   of them: it is what you do to get here, and a trail that opens with a step
   already behind you is counting the wrong thing.
   Exported so a test can pin them. */
/* A numbered piece of a number is a segment; a dimension is one thing a segment
   can become (Mahad, 2026-10-02). The second step is named for what it asks
   about, so it is Segments. */
/* The count-up shown while an import writes. Cosmetic - the writes happen up
   front - so it is held to about a second whatever the size of the file. It used
   to take at least 220ms an account, so 58 accounts sat on the overlay for
   thirteen seconds (Mahad, 2026-10-02: *"It's really slow to import"*). At most
   twenty steps, over 900ms, then a short beat on the full count before the done
   screen. Returns its own cancel. */
export const IMPORT_COUNT_UP_MS = 900
export function countUp(total: number, onStep: (n: number) => void, onDone: () => void): () => void {
  const timers: ReturnType<typeof setTimeout>[] = []
  const steps = Math.max(1, Math.min(total, 20))
  for (let i = 1; i <= steps; i++) {
    const n = i === steps ? total : Math.round((total * i) / steps)
    timers.push(setTimeout(() => onStep(n), (IMPORT_COUNT_UP_MS * i) / steps))
  }
  timers.push(setTimeout(onDone, IMPORT_COUNT_UP_MS + 250))
  return () => timers.forEach(clearTimeout)
}

export const IMPORT_STEPS = ['Structure', 'Segments', 'Values', 'Review', 'Preview']

/* Where the reader is in that trail, and which of it their own answers have
   made unnecessary. Two of the four are conditional - saying the numbers are
   one number retires both dimension steps, and calling nothing a filter retires
   the labelling - so they are marked skipped rather than dropped: the trail said
   four when it appeared, and it has to still be answerable for four.
   A step is only skipped once it has actually been passed. Standing on the gate
   with the default "no" in state is not the same as having answered it. */
export function importTrail(step: Step, holdsDimensions: boolean, hasLabels: boolean): { index: number; skipped: number[] } {
  const index = step === 'split' ? 0 : step === 'dimensions' ? 1 : step === 'labels' ? 2 : step === 'preview' ? 4 : 3
  if (step === 'upload' || step === 'split') return { index, skipped: [] }
  if (!holdsDimensions) return { index, skipped: [1, 2] }
  if (index >= 3 && !hasLabels) return { index, skipped: [2] }
  return { index, skipped: [] }
}

/* What one dimension of the number turns out to be. Three answers, because a
   piece of an account number can only be three things.
   - 'unmapped' is the honest starting state: not answered yet. It blocks the
     step, which is the point - a dimension nobody has looked at is not the same
     as one someone decided to ignore.
   - 'account' is the GL account number itself.
   - 'filter' carries the label the customer typed, and becomes something the
     chart can be filtered by.
   - 'ignore' is answered: the digits stay in the arrival number and nothing else
     is stored. */
type SlotTarget =
  | { kind: 'unmapped' }
  | { kind: 'account' }
  | { kind: 'ignore' }
  | { kind: 'filter'; name: string }

/* `labels` renames a dimension's raw codes ("200" → "Fire Suppression"), or marks
   one as meaning nothing. Kept when the dimension's answer changes, so answering
   one way and then another does not lose the naming. */
export interface SlotDecision { target: SlotTarget; labels: Record<string, string> }

// The answer as a Select value. The dropdown needs a string; the decision needs
// to carry the typed label with it.
const targetToValue = (t: SlotTarget): string => (t.kind === 'unmapped' ? '' : t.kind)

/* Every step before the review grid stands the same height, so the button you
   are reaching for does not move as you go from one step to the next - and so a
   step that outgrows it (a dimension with thirty values to name) scrolls rather
   than pushing the footer down the screen. The scrolling is the modal's own
   body, not a second scroller inside the step: two of them nested put a
   scrollbar on the panel for content that fits inside it.

   480 is the height on a roomy window. The modal caps itself at 78vh, and once
   the step trail sits in its header the header plus 480 plus the footer runs
   past that cap on a laptop, so the panel clamps and shows a scrollbar over a
   step that is mostly empty. The height gives way before that happens: it is the
   smaller of 480 and what is left of 78vh once the chrome is out, so on a short
   window every step shrinks together - still the same height as each other, just
   a shorter same - and none of them reaches the cap.

   The subtracted figure is the tallest chrome any step wears, not the average:
   it has to cover the gate, whose subtitle runs a line longer than the rest
   because it is where the word "dimension" gets defined. Sized for the shortest
   step instead, the panel would clamp on exactly the one step that needed the
   room. */
const WIZARD_BODY_H = 'min(480px, calc(78vh - 268px))'

/* The uploaded card counts the columns the template asks for. A file can also
   carry a Normal Balance, which we still read but stopped asking for, so
   counting every match would report more matched than the template has. */
const ASKED_FOR_FIELDS = new Set<RowField>(TEMPLATE_COLUMNS.map(c => c.field))
const countMatched = (matched: RowField[]) => matched.filter(f => ASKED_FOR_FIELDS.has(f)).length


// How long the file is shown being read. Short enough not to be a wait, long
// enough that the card is seen at all.
const UPLOAD_DURATION_MS = 850

interface UploadingFile { name: string; size: number; progress: number }
// A cancellable read: the flag is checked at every point where the read could
// still land, so a cancel during the window leaves nothing behind.
interface UploadToken { cancelled: boolean; raf: number; timer: ReturnType<typeof setTimeout> | undefined }

export const isSpreadsheetName = (name: string) => /\.(xlsx|csv)$/i.test(name)

export function fileSizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/* What an untouched description field falls back to: the file's own name, minus
   the extension. */
export const descriptionFromFileName = (name: string) => name.replace(/\.[^.]+$/, '')

const ROLE_BY_LABEL = new Map(ALL_ACCOUNT_ROLES.map(r => [r.toLowerCase(), r]))
const CATEGORY_BY_LABEL = new Map(CATEGORY_ORDER.map(c => [ACCOUNT_TYPE_META[c].label.toLowerCase(), c]))
const CLASSIFICATION_BY_LABEL = new Map(ALL_CLASSIFICATIONS.map(c => [c.toLowerCase(), c]))

/**
 * A review cell changed after the import, read back as the change it makes to
 * the account that row wrote.
 *
 * Only what actually moved: a cell opened, retyped the same and closed is not a
 * change, and an account with nothing changed is not one of the accounts
 * updated. `before` is the row as it was written, not as the file first said it,
 * so a fix made before the import is not counted a second time after it.
 *
 * Two rules the chart keeps and a spreadsheet cell cannot be allowed to break:
 * `isPosting` mirrors the Summary / Posting answer, and the normal balance is
 * decided by the category and the contra flag rather than read off the file. Both
 * are recomputed here whenever what they derive from moves.
 */
export function accountPatchFromEdit(
  edit: Partial<ParsedRow>,
  before: Partial<ParsedRow>,
  account: Account,
  chart: Account[],
): Partial<Account> {
  const patch: Partial<Account> = {}
  const value = (f: keyof ParsedRow) => String(edit[f] ?? '').trim()
  const changed = (f: keyof ParsedRow) => f in edit && value(f) !== String(before[f] ?? '').trim()

  // Blank means leave alone on the fields an account cannot be without. A
  // spreadsheet has no way to say "clear this", so an emptied cell reads as one
  // nobody meant to answer rather than as an instruction.
  if (changed('number') && value('number')) patch.accountNumber = value('number')
  if (changed('name') && value('name')) patch.accountName = value('name')
  if (changed('currency') && value('currency')) patch.currencyCode = value('currency').toUpperCase()
  // A description is the one field whose blank is an answer.
  if (changed('description')) patch.description = value('description')

  /* Active and Inactive, and nothing else. Archiving decides where a balance and
     its postings go, which is a question with its own dialog and not something a
     cell can answer on the way past. */
  if (changed('status')) {
    const status = value('status').toLowerCase()
    if (status === 'active' || status === 'inactive') {
      patch.status = (status === 'active' ? 'Active' : 'Inactive') as AccountStatus
    }
  }

  if (changed('role')) {
    const role = ROLE_BY_LABEL.get(value('role').toLowerCase())
    if (role) patch.accountRole = role as AccountRole
    else if (!value('role')) patch.accountRole = undefined
  }

  /* A parent named as a number the chart does not hold is left where it is
     rather than read as "no parent": a number nobody recognises is a typo, and
     unnesting an account is not what a typo asked for. */
  if (changed('parent')) {
    const number = value('parent')
    const parent = number ? chart.find(a => a.accountNumber === number && a.id !== account.id) : null
    if (parent) patch.parentId = parent.id
    else if (!number) patch.parentId = null
  }

  if (changed('glType')) {
    const gl = value('glType').toLowerCase()
    if (gl === 'summary' || gl === 'posting') {
      patch.glAccountType = gl === 'summary' ? 'Summary' : 'Posting'
      patch.isPosting = gl === 'posting'
    }
  }

  const category = changed('type') ? CATEGORY_BY_LABEL.get(value('type').toLowerCase()) : undefined
  if (category) {
    patch.accountType = category
    patch.statementClassification = defaultClassificationForCategory(category)
  }
  /* After the category, so retyping both cells at once ends on what was asked
     for rather than on the new category's default. Taken only when it belongs to
     the category the row now carries: the two cells sit side by side and a
     classification from another category is the half of the pair left behind. */
  if (changed('classification')) {
    const found = CLASSIFICATION_BY_LABEL.get(value('classification').toLowerCase())
    if (found && CATEGORY_OF_CLASSIFICATION[found] === (category ?? account.accountType)) {
      patch.statementClassification = found
    }
  }
  const contra = changed('contra') ? /^y/i.test(value('contra')) : !!account.isContra
  if (changed('contra')) patch.isContra = contra
  if (category || changed('contra')) {
    patch.normalBalance = deriveNormalBalance(category ?? account.accountType, contra)
  }
  return patch
}

export function ImportAccountsModal({ open, onClose, onViewImported, firstTime }: { open: boolean; onClose: () => void; onViewImported?: () => void; firstTime?: boolean }) {
  const createAccount = useStore(s => s.createAccount)
  const updateAccount = useStore(s => s.updateAccount)
  const storeScheme = useStore(s => s.numberingScheme)
  const setNumberingScheme = useStore(s => s.setNumberingScheme)
  const addDimension = useStore(s => s.addDimension)
  const updateDimension = useStore(s => s.updateDimension)
  const accounts = useStore(s => s.accounts)
  const base = useStore(s => s.company.baseCurrency)
  const pushToast = useStore(s => s.pushToast)
  const protection = useStore(s => numberProtectionOn(s.company))
  const setCompany = useStore(s => s.setCompany)

  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<number>(0)
  const [parsed, setParsed] = useState<ParsedRow[]>([])

  const dimensions = useStore(s => s.dimensions)

  // --- Reading the numbers ---------------------------------------------------
  /* The numbers the file's segments are read from: posting accounts only, since
     only a posting account can have dimensions (Mahad, 2026-10-02). A summary
     row stands in as blank, which every reading below skips, so a chart that
     writes its summaries 11000 over postings written 01-11100-40 is not told its
     summaries hold no separator. */
  const numbers = useMemo(() => parsed.map(r => (isSummary(r) ? '' : r.number)), [parsed])
  const shape = useMemo(() => detectFileShape(numbers), [numbers])
  /* What is picked on the split step, and what the pick committed to. They are
     held apart because the two answers lead to two different steps and the
     refusal below can turn one of them down: nothing about the rest of the
     import moves until Continue is pressed on an answer that stands.
     Saying no is always allowed: the numbers are kept whole, so splitting them
     later is supported. */
  const [gateAnswer, setGateAnswer] = useState<GateAnswer>(null)
  const [holdsDimensions, setHoldsDimensions] = useState(false)
  /* Set when yes was answered over a file that holds numbers with no dimensions
     in them. It is the answer that is refused, not the file, so it is raised on
     the press rather than pre-empting it with a disabled button. */
  const [gateRefused, setGateRefused] = useState(false)
  /* Saying no over a file whose numbers plainly do split is the one answer the
     file argues with, and it is the one answer nothing downstream can undo: the
     dimension steps are skipped and the parts are never named, so there is
     nothing to correct on a later screen. Asked once per answer rather than on
     every press, so walking back through the step does not re-litigate it. */
  const [gateWarning, setGateWarning] = useState(false)
  const [gateWarned, setGateWarned] = useState(false)
  const [slotDecisions, setSlotDecisions] = useState<SlotDecision[]>([])
  /* Where a code belongs when the evidence could not say. Keyed by the code, so
     answering settles every row carrying it at once. */
  const [slotChoices, setSlotChoices] = useState<SlotChoices>({})
  const splitting = !!shape && holdsDimensions

  /* A new file is read from scratch: the split from the file's own shape, the
     account part from which part is widest, and every other part left
     unanswered, because only the customer knows what they mean. */
  useEffect(() => {
    setGateRefused(false)
    setGateWarning(false)
    setGateWarned(false)
    if (!shape) { setHoldsDimensions(false); setSlotDecisions([]); setSlotChoices({}); return }
    const suggested = suggestAccountSlot(numbers, shape)
    setHoldsDimensions(true)
    setSlotChoices({})
    setSlotDecisions(Array.from({ length: shape.partCount }, (_, i) => ({
      target: i === suggested ? { kind: 'account' } : { kind: 'unmapped' },
      labels: {},
    })))
  }, [shape]) // eslint-disable-line react-hooks/exhaustive-deps

  // Which part is the account. -1 until it is answered, which blocks the step:
  // there is no sensible default for "none of these is the account".
  const accountIdx = slotDecisions.findIndex(d => d.target.kind === 'account')
  // The account has to exist in every row, so it cannot sit further right than
  // the shortest number reaches.
  const accountLimit = shape ? maxAccountIdx(shape) : 0
  const valueCounts = useMemo(() => (shape ? slotValueCounts(numbers, shape) : []), [numbers, shape])

  /* Every number, read against the chosen account position. Computed for the
     account position actually picked, so the refusal below is about a real
     reading rather than a hypothetical one. */
  const readings = useMemo<RowReading[]>(
    () => (splitting && shape && accountIdx >= 0 ? readRows(numbers, shape, accountIdx, slotChoices) : []),
    [splitting, shape, accountIdx, numbers, slotChoices],
  )
  /* Codes the reader could not place, folded so one code is one question. A
     guess is already in place for each, so these never block the step: they are
     an offer to correct a guess, not a demand. */
  const questions = useMemo(() => slotQuestions(readings), [readings])
  // A property of (file, chosen account part), so it moves as the picker moves.
  const refusal = useMemo(
    () => (splitting && shape && accountIdx >= 0 ? unsupportedReason(shape, accountIdx) : null),
    [splitting, shape, accountIdx],
  )
  // The rows the refusal is about, named so the panel can point at them rather
  // than describe them.
  const refusedRows = useMemo(
    () => (refusal ? readings.filter(r => r.unfit === 'parts').map(r => parsed[r.row]).filter(Boolean) : []),
    [refusal, readings, parsed],
  )

  /* A part's raw codes with the number of rows on each. Both the list to name and
     the evidence behind the answer already proposed for the part: two codes
     covering most of the file is a different naming job from twenty even ones. */
  const slotCodes = useCallback((slot: number) => slotTally(readings, slot), [readings])

  const setLabel = useCallback((slot: number, raw: string, label: string) => {
    setSlotDecisions(d => d.map((x, j) => j === slot ? { ...x, labels: { ...x.labels, [raw]: label } } : x))
  }, [])


  /* How much of the file splits the way it was read, and which numbers do not.
     What makes the reading confirmable: the count is checkable against the file,
     and the numbers that break the pattern are named rather than described. They
     are never padded to fit. */
  const fit = useMemo(() => (shape ? patternFit(numbers, shape) : null), [numbers, shape])
  /* The numbers the pattern does not hold for, as the customer wrote them. */
  const offPatternNumbers = useMemo(
    () => (fit?.offPattern ?? []).map(row => numbers[row]?.trim()).filter(Boolean).slice(0, 6),
    [fit, numbers],
  )
  /* Rows carrying a number with no dimensions in it. Answering yes says the file's
     numbers hold dimensions, and these are the rows that make that untrue, so they
     are named and the file is sent back to be fixed. */
  const withoutDimensions = useMemo(() => (shape ? rowsWithoutDimensions(numbers, shape) : []), [numbers, shape])
  const numbersWithoutDimensions = useMemo(
    () => withoutDimensions.map(row => numbers[row]?.trim()).filter(Boolean),
    [withoutDimensions, numbers],
  )
  /* Whether answering no is a claim the file argues with. A separator is the
     only evidence strong enough to say so: a fixed-width file is read as split
     on the block every number shares, and a shared leading block is what an
     ordinary numbering scheme looks like. Warning 5020, 5030, 5040 that they
     look dimensional would push the reader off the answer that is correct. */
  const gateContested = !!shape?.separator

  const [description, setDescription] = useState('')
  const [guideOpen, setGuideOpen] = useState(false)
  // The guide scoped to the step it is read on: the file guide on upload, the
  // dimension guide on the numbering step.
  const guideConfig = useMemo(() => importGuideFor(step), [step])
  // How many of our columns the file turned out to carry, so the card can say
  // what was understood rather than only that something was read.
  const [matched, setMatched] = useState(0)
  const [uploading, setUploading] = useState<UploadingFile | null>(null)
  const uploadRef = useRef<UploadToken | null>(null)
  // Hovering the blocked Continue button points at what is blocking it.
  const [blockerHovered, setBlockerHovered] = useState(false)

  // Per-row inline edits and per-row exclusions (error rows the user drops).
  const [edits, setEdits] = useState<Record<number, Partial<ParsedRow>>>({})
  const [excluded, setExcluded] = useState<Set<number>>(new Set())

  // Review controls.
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ReviewFilter>('all')
  const [density, setDensity] = useState<Density>('comfortable')

  // Importing progress + final tallies.
  const [processed, setProcessed] = useState(0)
  // Fixed when the import starts: the grid stays editable-looking underneath the
  // overlay, so a count re-derived from it would drift mid-import.
  const [importTotal, setImportTotal] = useState(0)
  const [summary, setSummary] = useState({ created: 0, updated: 0, skipped: 0, warnings: 0 })
  /* The grid the reader just checked, snapshotted the instant the import starts.
     Its rows validate against the live chart, and the import writes into that
     chart, so left live every account created would match itself and the whole
     grid would flip to "already exists" mid-import. Frozen, the rows on screen
     stay the rows that were reviewed. */
  const [frozen, setFrozen] = useState<{ rows: ReviewRowView[]; counts: ReviewCounts } | null>(null)
  /* Whether the accounts are in the chart. Told apart from `frozen`, which is
     set a beat earlier so the count-up has something to run over: between the
     two the write is happening, and a row edited then would be chasing an
     account that does not exist yet. */
  const [landed, setLanded] = useState(false)
  /* Which account each row of the file became. The reader who spots something
     in the preview goes back to the grid and fixes the row, and this is what
     carries that fix to the account the row wrote. Rows the import skipped are
     absent, so editing one changes nothing in the chart - correctly, since
     nothing in the chart came from it. */
  const [rowAccounts, setRowAccounts] = useState<Map<number, string>>(new Map())
  /* Cell edits made after the accounts landed. Held apart from `edits`, which
     feeds validation, because those rows now match accounts this same import
     wrote: re-read through validation the whole file would come back as already
     in the chart. These are applied to the frozen snapshot and to nothing else
     until the reader presses Update. */
  const [postEdits, setPostEdits] = useState<Record<number, Partial<ParsedRow>>>({})
  /* Three things can be lost by closing, and they are not the same thing: on the
     upload step it is the name and the file, on the review step it is the cell
     fixes, and after the import it is only the fixes made since - the accounts
     themselves are already in the chart and are not at risk. Naming the wrong
     one reads as a threat to work that is not going anywhere. */
  const [discardLevel, setDiscardLevel] = useState<'upload' | 'review' | 'updates' | null>(null)
  // Confirming the refusal panel's second route: drop the rows that cannot reach
  // the chosen account part, so the rest of the file can be read.
  const [confirmDropRefused, setConfirmDropRefused] = useState(false)
  const ic = useResponsiveIconSize(14)

  // Read + parse a chosen CSV or XLSX. Real validation runs against the parsed
  // rows, so both formats have to land on the same ParsedRow shape.
  async function readFile(f: File): Promise<{ reading: GridReading } | { error: [string, string] }> {
    let grid: string[][]
    try {
      grid = /\.xlsx$/i.test(f.name)
        ? await parseWorkbook(new Uint8Array(await f.arrayBuffer()))
        : csvGrid(await f.text())
    } catch (err) {
      return { error: ["Couldn't read this file", err instanceof WorkbookError ? err.message : "Make sure it's a valid Excel (.xlsx) or CSV (.csv) export."] }
    }
    const reading = readTemplateGrid(grid)
    // Two different failures, told apart by whether any header was ours: a file
    // from somewhere else entirely, versus our own template with nothing typed
    // into it yet. Saying "no data rows" to the first one sends the user looking
    // for rows in a file that was never going to work.
    if (!reading.matched.length) {
      return { error: ["Couldn't read this file", "This file doesn't match the import template. Download it again and copy your data in."] }
    }
    if (!reading.rows.length) {
      return { error: ["Couldn't read this file", 'This file has a header row but no accounts. Add at least one row and re-upload.'] }
    }
    return { reading }
  }

  // The read is usually instant, which makes a file appear to have been accepted
  // without being looked at. The progress window runs alongside the parse and
  // both settle together, so the file is seen being read and a slow read still
  // takes exactly as long as it takes.
  async function handleFile(f: File) {
    if (!isSpreadsheetName(f.name)) {
      pushToast('Unsupported file type', 'danger', 'Upload an Excel (.xlsx) or CSV (.csv) file.')
      return
    }
    cancelUpload()
    const token: UploadToken = { cancelled: false, raf: 0, timer: undefined }
    uploadRef.current = token
    setUploading({ name: f.name, size: f.size, progress: 0 })

    const startedAt = performance.now()
    const tick = (now: number) => {
      if (token.cancelled) return
      const ratio = Math.min(1, (now - startedAt) / UPLOAD_DURATION_MS)
      setUploading(u => (u ? { ...u, progress: Math.round(ratio * 100) } : u))
      if (ratio < 1) token.raf = requestAnimationFrame(tick)
    }
    token.raf = requestAnimationFrame(tick)

    const outcome = await readFile(f)
    if (token.cancelled) return
    token.timer = setTimeout(() => {
      if (token.cancelled) return
      uploadRef.current = null
      setUploading(null)
      if ('error' in outcome) { pushToast(outcome.error[0], 'danger', outcome.error[1]); return }
      setFile(f.name); setFileSize(f.size)
      setParsed(outcome.reading.rows)
      setMatched(countMatched(outcome.reading.matched))
      // An untouched description takes the file's own name, so the import is
      // identifiable later without asking for something already on the file.
      setDescription(d => (d.trim() ? d : descriptionFromFileName(f.name)))
      pushToast('File uploaded.', 'success', f.name)
    }, Math.max(0, UPLOAD_DURATION_MS - (performance.now() - startedAt)))
  }

  function cancelUpload() {
    const t = uploadRef.current
    if (t) { t.cancelled = true; cancelAnimationFrame(t.raf); clearTimeout(t.timer) }
    uploadRef.current = null
    setUploading(null)
  }
  function clearFile() {
    setFile(null); setFileSize(0); setMatched(0)
    setParsed([])
  }

  /* The files Mahad supplied, shipped as they are (2026-10-02). A test reads
     them against the column definitions this flow parses with, so the file
     handed out stays one the importer can read. */
  function downloadTemplate(format: 'excel' | 'csv') {
    void downloadTemplateFile(format)
    pushToast('Template downloaded', 'success', TEMPLATE_FILENAME[format])
    // The file is now open somewhere we cannot see, and the questions it raises
    // are all answered here, so the guide comes with it rather than waiting to
    // be found.
    setGuideOpen(true)
  }

  /* Every dimension that became a filter, named once so the row's values and the
     filter created at commit cannot disagree about it. */
  const meanings = useMemo<SlotMeaning[]>(() => slotDecisions.flatMap((d, slot) => {
    if (d.target.kind !== 'filter') return []
    const name = d.target.name.trim()
    return name ? [{ slot, name, labels: d.labels }] : []
  }), [slotDecisions])

  /* --- Splitting ------------------------------------------------------------
     One file row is one account. The number becomes the part the customer called
     the account, and every other answered part becomes a labelled attribute of
     it. Nothing is renamed and nothing is invented: 01-71100-40 and 01-71100-50
     stay two accounts, both numbered 71100, told apart by their dimensions.

     Summaries are the exception and fold, because a file that repeats its
     structure per entity states the same summary many times. */
  const split = useMemo(() => {
    if (!splitting || !shape || accountIdx < 0 || refusal) {
      return {
        rows: parsed,
        arrivals: new Map<number, string>(),
        folded: new Map<number, string[]>(),
        unsplit: new Set<number>(),
      }
    }
    return splitRows(parsed, readings, meanings, raw => readRows([raw], shape, accountIdx)[0].accountPart)
  }, [splitting, shape, accountIdx, refusal, readings, parsed, meanings])

  // Apply inline edits before validating so counts/statuses update live.
  const adjusted = useMemo(() => split.rows.map(r => ({ ...r, ...(edits[r.row] ?? {}) })), [split, edits])

  /* classification placement runs against the chart's own scheme. Nothing about the
     file changes it: a number is imported exactly as typed, so the scheme
     decides which section a row is grouped under and never how it is spelled. */
  const draftScheme = useMemo(() => schemeFromNumberWidth(DEFAULT_NUMBER_WIDTH), [])
  const scheme = useMemo<NumberingScheme>(() => (firstTime ? draftScheme : storeScheme), [firstTime, draftScheme, storeScheme])

  // Indexed once rather than per validation run: editing a cell revalidates the
  // whole file, and the chart it is validated against has not moved. Dimensions
  // come along because whether a row is already there is a question about the
  // number and its dimensions together.
  const existingIndex = useMemo(() => buildExistingIndex(accounts, dimensions), [accounts, dimensions])
  const result = useMemo(
    () => runUploadValidation(adjusted, accounts, base, existingIndex),
    [adjusted, accounts, base, existingIndex],
  )

  // Build a flat per-row view model with a Result (Ready / Warning / Error).
  const viewRows = useMemo<ReviewRowView[]>(() => {
    const invalidByRow = new Map(result.invalid.map(i => [i.row, i]))
    const warnByRow = new Map(result.warned.map(w => [w.row, w]))
    const unfinished = new Set(result.needDetails.map(n => n.row))
    /* What each row settled on for a column most files leave blank. Read off the
       accounts the engine built rather than worked out again here: the answer
       depends on the role and on the parent summary, and a second opinion about
       it is a second answer. A refused row has no account and stays blank. */
    const classificationByRow = new Map(
      result.newAccounts.map(a => [importRowOf(a), a.statementClassification]),
    )
    return adjusted.map(r => {
      const inv = invalidByRow.get(r.row)
      const wrn = warnByRow.get(r.row)
      const needsDetails = unfinished.has(r.row)
      const isExcluded = excluded.has(r.row)
      /* The other statements of this same summary. A summary is written once
         however many times the file repeats it, so this is worth saying rather
         than worth flagging. */
      const alsoWritten = split.folded.get(r.row)
      /* The split did not hold for this number, so it kept its whole code and
         carries no dimensions. A warning rather than an error: the number is
         still the one the file wrote, and padding it out to fit its neighbours
         would be inventing a code nobody typed. */
      const unsplit = split.unsplit.has(r.row)
      /* Needing details is not a verdict. The row is correct and imports; what
         it is missing is something the file was never asked for, so it carries
         its own chip and leaves Ready standing. */
      const verdict: ReviewRowView['verdict'] =
        isExcluded ? 'warning'
        : inv ? 'error'
        : wrn || unsplit ? 'warning'
        : 'ready'
      // The engine names the columns each message points at, so a cell is tinted
      // because validation said so rather than because a regex over the wording
      // happened to match. A message naming no column would leave the row flagged
      // with nothing to fix, so the number carries it.
      const named = inv ? inv.columns : wrn ? wrn.columns : unsplit ? ['number'] : []
      const flagged = new Set(named as ReviewField[])
      if (inv && flagged.size === 0) flagged.add('number')
      const message = isExcluded
        ? 'Excluded from this import. It stays on screen so it can still be fixed.'
        : inv ? inv.errors.join(' ')
        : wrn ? wrn.warnings.join(' ')
        : unsplit ? 'This number does not split the way the rest of your file does, so it imports whole and carries no dimensions.'
        : alsoWritten?.length ? `Your file states this summary ${alsoWritten.length + 1} times. A summary holds no balance, so it is imported once.`
        : needsDetails ? 'This account needs bank or card details before you can use it. Add them once the import is done.'
        : 'Ready to import.'
      return {
        ...r, verdict, flagged, message,
        /* Flattened onto the row because a cell is read as `row[key]`. A row that
           carries no value for a dimension has no key for it, which is what the
           grid draws as blank. */
        ...Object.fromEntries((r.dimensions ?? []).map(d => [dimensionKey(d.name), d.value])),
        classification: r.classification?.trim() || classificationByRow.get(r.row) || '',
        needsDetails, excluded: isExcluded,
        mergedFrom: alsoWritten?.length ? [r.number, ...alsoWritten] : undefined,
      }
    })
  }, [adjusted, result, excluded, scheme, split])

  /* One column per filter the customer defined, so the review shows the answers
     applied rather than only the columns the file already had. */
  const dimensionCols = useMemo(() => dimensionColumns(meanings.map(m => m.name)), [meanings])

  const counts = useMemo(() => countByStatus(viewRows), [viewRows])

  /* Accounts this file would put among another branch's numbers, read with
     number protection on - the setting from the design review of 2026-09-24.
     Only clashes a row in this file takes part in: a chart that was already out
     of place before the import is not this import's to answer for.

     Asked on the review step, where the numbers can still be changed in the grid,
     because the recommendation is to renumber (Eli: *"our recommendation is to
     force this ... to deprecate their prior account numbers"*) and the number
     each row arrived with stays on the account as its prior account number. A
     reader who keeps their numbers imports anyway, and protection is turned off
     for the chart as it lands - it could not hold them otherwise. */
  const numberConflicts = useMemo(() => {
    if (!protection) return []
    const excludedRows = new Set(viewRows.filter(r => r.excluded).map(r => r.row))
    const staged = result.newAccounts.filter(a => !excludedRows.has(importRowOf(a) ?? -1))
    const fresh = new Set(staged.map(a => a.id))
    return chartConflicts([...accounts, ...staged], true)
      .filter(c => fresh.has(c.accountId) || fresh.has(c.holderId))
  }, [protection, viewRows, result, accounts])

  /* The template's own example accounts, still in the file. Read off the rows on
     screen rather than off the parse, so excluding them puts the notice away. */
  const templateExamples = useMemo(
    () => templateExampleRows(viewRows.filter(r => !r.excluded)),
    [viewRows],
  )

  // The rows as the file gave them, so a cell can say what it used to hold.
  const originals = useMemo(() => new Map(parsed.map(r => [r.row, r])), [parsed])

  // What a row could be parented to: the summary accounts already in the chart,
  // plus the summary rows arriving in this same file.
  const parentCandidates = useMemo(() => {
    const fromChart = accounts
      .filter(a => a.glAccountType === 'Summary')
      .map(a => ({ number: a.accountNumber, name: a.accountName }))
    const fromFile = adjusted
      .filter(r => /summary/i.test(r.glType ?? '') && r.number.trim())
      .map(r => ({ number: r.number.trim(), name: r.name }))
    const seen = new Set<string>()
    return [...fromChart, ...fromFile].filter(c => !seen.has(c.number) && seen.add(c.number))
      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
  }, [accounts, adjusted])

  const currencyOptions = useMemo(() => {
    const seen = new Set<string>([base])
    for (const a of accounts) if (a.currencyCode) seen.add(a.currencyCode)
    for (const r of adjusted) if (r.currency?.trim()) seen.add(r.currency.trim().toUpperCase())
    return [...seen]
  }, [base, accounts, adjusted])

  // Reset all state when the modal closes.
  useEffect(() => {
    if (open) return
    setStep('upload')
    cancelUpload()
    setFile(null); setFileSize(0); setMatched(0)
    setParsed([]); setDescription(''); setGuideOpen(false)
    setHoldsDimensions(false); setSlotDecisions([])
    setEdits({}); setExcluded(new Set()); setQuery(''); setFilter('all'); setDensity('comfortable')
    setProcessed(0); setSummary({ created: 0, updated: 0, skipped: 0, warnings: 0 }); setFrozen(null)
    setLanded(false); setRowAccounts(new Map()); setPostEdits({})
    setDiscardLevel(null); setConfirmDropRefused(false)
    setWalkthrough(false); setWalkthroughDemo(null); stepBeforeWalkthrough.current = null
  }, [open])

  const dirty = !!file
  function attemptClose() {
    if (step === 'importing') return
    /* Once the accounts are in the chart, closing costs nothing except any fix
       made since that has not been applied yet. So the question is asked about
       those and only when there are some. */
    if (landed) {
      if (Object.keys(postEdits).length) { setDiscardLevel('updates'); return }
      onClose(); return
    }
    if (!dirty) { onClose(); return }
    setDiscardLevel(step === 'review' ? 'review' : 'upload')
  }

  /* One editor, two destinations. Before the write a cell edit is a fix to the
     file and re-validates; after it, the file is spent and the same keystroke is
     a change to an account, so it goes somewhere validation does not read. */
  const setEdit = useCallback((row: number, field: ReviewField, value: string) => {
    const apply = (e: Record<number, Partial<ParsedRow>>) => {
      if ((e[row]?.[field] ?? undefined) === value) return e
      return { ...e, [row]: { ...(e[row] ?? {}), [field]: value } }
    }
    if (landed) setPostEdits(apply); else setEdits(apply)
  }, [landed])

  const bulkSet = useCallback((rows: number[], field: ReviewField, value: string) => {
    const apply = (e: Record<number, Partial<ParsedRow>>) => {
      const next = { ...e }
      for (const row of rows) next[row] = { ...(next[row] ?? {}), [field]: value }
      return next
    }
    if (landed) setPostEdits(apply); else setEdits(apply)
  }, [landed])

  const excludeRows = useCallback((rows: number[]) => {
    if (rows.length === 0) return
    setExcluded(s => {
      const next = new Set(s)
      for (const r of rows) next.add(r)
      return next
    })
    pushToast(`${rows.length} row${rows.length === 1 ? '' : 's'} excluded from this import`, 'info',
      'They stay on screen so they can still be fixed. The valid rows import either way.')
  }, [pushToast])

  /* Deleting and excluding both change what gets imported, so they move the same
     three pieces of state together. Left apart, a deleted row could stay in
     `excluded` and the tally above the grid would stop matching the import. */
  const deleteRows = useCallback((rows: number[]) => {
    if (rows.length === 0) return
    const drop = new Set(rows)
    setParsed(p => p.filter(r => !drop.has(r.row)))
    setEdits(e => Object.fromEntries(Object.entries(e).filter(([k]) => !drop.has(Number(k)))))
    setExcluded(s => new Set([...s].filter(r => !drop.has(r))))
  }, [])

  /* The refusal's escape route: the rows too short to reach the chosen account
     part leave the file entirely, rather than being marked non-importable. The
     file's shape is read from the numbers that are in it, so a row merely
     excluded would still be shortening minPartCount and the refusal would stand.
     They are named in the confirm before this runs. */
  const excludeRefusedRows = useCallback(() => {
    const rows = refusedRows.map(r => r.row)
    if (!rows.length) return
    const drop = new Set(rows)
    setParsed(p => p.filter(r => !drop.has(r.row)))
    setEdits(e => Object.fromEntries(Object.entries(e).filter(([k]) => !drop.has(Number(k)))))
    setExcluded(s => new Set([...s].filter(r => !drop.has(r))))
    pushToast(`${rows.length} row${rows.length === 1 ? '' : 's'} removed from this import`, 'info',
      'Their numbers were too short to reach the segment you picked as the GL account number.')
  }, [refusedRows, pushToast])

  /* A duplicated row lands directly under its original with a cleared number,
     which is the field that has to differ for both to import. */
  const duplicateRow = useCallback((row: number) => {
    setParsed(p => {
      const idx = p.findIndex(r => r.row === row)
      if (idx === -1) return p
      const nextKey = p.reduce((m, r) => Math.max(m, r.row), 0) + 1
      const copy = { ...p[idx], ...(edits[row] ?? {}), row: nextKey, number: '' }
      return [...p.slice(0, idx + 1), copy, ...p.slice(idx + 1)]
    })
  }, [edits])

  const revertRow = useCallback((row: number) => {
    setEdits(e => {
      if (!(row in e)) return e
      const next = { ...e }
      delete next[row]
      return next
    })
  }, [])

  const cleanupRef = useRef<() => void>()
  useEffect(() => () => {
    cleanupRef.current?.()
    const t = uploadRef.current
    if (t) { t.cancelled = true; cancelAnimationFrame(t.raf); clearTimeout(t.timer) }
  }, [])

  function startImport() {
    /* A chart whose numbers hold dimensions rescues its meaning: each answered part
       becomes a dimension, and each account carries the values written into its
       own number. The account keeps the part the customer called the account, so
       a chart imported this way holds 71100 as many times as the file did.

       Nothing is written to the numbering scheme. A number is imported exactly as
       typed, so there is no width or shape for the file to impose. */
    const byRow = new Map<number, { dimensionId: string; value: string }[]>()
    if (splitting && accountIdx >= 0) {
      const ids = new Map<number, string>()
      slotDecisions.forEach((d, slot) => {
        if (d.target.kind !== 'filter') return
        const name = d.target.name.trim()
        // The filter is created with the names the customer gave the values, not
        // the digits they replace, so a report filters by "Fire Suppression"
        // rather than by 200. A value left unnamed keeps its digits.
        const values = distinctSlotValues(readings, slot, d.labels)
        /* A label the chart already has is that same filter, not a second one of
           the same name: the dropdown no longer lists what exists, so typing
           "Location" over a chart that has Location has to mean it. Its values
           are added to rather than replaced, because the file only knows about
           the ones it happens to carry. */
        const held = dimensions.find(x => x.status === 'Active' && x.name.trim().toLowerCase() === name.toLowerCase())
        if (held) {
          const fresh = values.filter(v => !held.values.includes(v))
          if (fresh.length) updateDimension(held.id, { values: [...held.values, ...fresh] })
          ids.set(slot, held.id)
        } else {
          ids.set(slot, addDimension({ name, values, status: 'Active' }).id)
        }
      })
      // The row's dimensions were read by name; the store stores ids. Matched on
      // the name the meaning was built from, so the two cannot drift apart.
      const idByName = new Map(meanings.flatMap(m => {
        const id = ids.get(m.slot)
        return id ? [[m.name.trim(), id] as const] : []
      }))
      for (const r of adjusted) {
        const values = (r.dimensions ?? []).flatMap(v => {
          const id = idByName.get(v.name.trim())
          return id ? [{ dimensionId: id, value: v.value }] : []
        })
        if (values.length) byRow.set(r.row, values)
      }
    } else if (firstTime) {
      setNumberingScheme(draftScheme)
    }
    // An excluded row validated cleanly, so it is still in newAccounts. Dropped
    // by the row it came from, because a number on its own no longer names one
    // account: the same number can arrive several times with different dimensions.
    const excludedRows = new Set(viewRows.filter(r => r.excluded).map(r => r.row))
    const toCreate = result.newAccounts.filter(a => !excludedRows.has(importRowOf(a) ?? -1))
    /* Kept as the file numbered them, so protection goes off - see
       numberConflicts. Said in a toast as well as on the review step, because
       this is the moment a chart-wide rule changes under the reader. */
    if (numberConflicts.length) {
      setCompany({ numberProtection: false })
      pushToast('Number protection turned off', 'info', "Your imported numbers sit among other branches' numbers, so the chart no longer keeps a branch's run of numbers for it.")
    }
    const total = toCreate.length
    const skipped = result.invalid.length + excludedRows.size
    const warnings = counts.warnings
    // Freeze the grid before the first write, so the overlay sits over the rows
    // as reviewed rather than over rows re-read as numbers this same import has
    // just put into the chart.
    setFrozen({ rows: viewRows, counts })
    setStep('importing')
    setProcessed(0)
    setImportTotal(total)

    // Perform the writes up front; the count-up is cosmetic.
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    // Validation points a row at its parent by the placeholder id it gave that
    // row, and the store mints its own on write. Left untranslated, every account
    // whose parent came from the same file landed at the top of the chart with no
    // one under it, so an imported chart read as a flat list.
    const inFile = new Set(toCreate.map(a => a.id))
    const realId = new Map<string, string>()
    // Which row made which account, kept so a fix made after the preview can be
    // carried back to the account rather than to the row that has already spent
    // itself writing one.
    const wroteAccount = new Map<number, string>()
    parentsFirst(toCreate).forEach(acc => {
      // `internalId` is dropped here on purpose. The preview carried a blank one;
      // the store issues the real one, and letting the blank through would put an
      // account in the chart with no handle to name it by.
      const { id, internalId, createdAt, updatedAt, createdBy, updatedBy, normalBalance, ...rest } = acc
      void internalId; void createdAt; void updatedAt; void createdBy; void updatedBy; void normalBalance
      const row = importRowOf(acc)
      const values = row === null ? undefined : byRow.get(row)
      const created = createAccount({
        ...rest,
        parentId: rest.parentId && inFile.has(rest.parentId) ? realId.get(rest.parentId) ?? null : rest.parentId,
        defaultDimensionValues: values?.length ? values : rest.defaultDimensionValues,
        /* The full code as the file wrote it, kept unchanged and searchable, so
           someone who still reads 01-71100-40 can find 71100 by it. One, always:
           a summary the file states once per group keeps the statement that
           landed, and the review grid is where the ones that folded into it are
           named. */
        originalCode: (row === null ? undefined : split.arrivals.get(row)) ?? acc.accountNumber,
        /* Set on everything this import writes, including a parent summary the
           file implied rather than stated: that one has no row, so no arrival
           code, and the codes on their own would report it as hand-made. */
        arrivedByImport: true,
        pendingReview: true,
        setupNote: `Imported from ${file} on ${date}`,
      })
      realId.set(id, created.id)
      if (row !== null) wroteAccount.set(row, created.id)
    })
    setRowAccounts(wroteAccount)

    cleanupRef.current = countUp(total, setProcessed, () => {
      setSummary({ created: total, updated: 0, skipped, warnings })
      setLanded(true)
      setStep('done')
    })
  }

  /* ──── The second pass ──────────────────────────────────────────────────
     The reader looked at their chart, went back to the grid and changed
     something. This carries those changes onto the accounts the rows wrote.

     It is an update rather than a re-import: the row already has an account, so
     the fix is applied to that account and nothing new is created. Rows the
     first pass skipped have no account to carry a fix to, and are left alone. */
  const pendingUpdates = useMemo(() => {
    if (!landed || !frozen) return []
    const written = new Map(frozen.rows.map(r => [r.row, r]))
    return Object.entries(postEdits).flatMap(([key, edit]) => {
      const row = Number(key)
      const id = rowAccounts.get(row)
      const before = written.get(row)
      if (!id || !before) return []
      const account = accounts.find(a => a.id === id)
      if (!account) return []
      const patch = accountPatchFromEdit(edit, before, account, accounts)
      return Object.keys(patch).length ? [{ row, id, patch }] : []
    })
  }, [landed, frozen, postEdits, rowAccounts, accounts])

  function commitUpdate() {
    const pending = pendingUpdates
    if (!pending.length) return
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    const total = pending.length
    setStep('importing')
    setProcessed(0)
    setImportTotal(total)
    for (const { id, patch } of pending) {
      updateAccount(id, { ...patch, pendingReview: true, setupNote: `Updated from ${file} on ${date}` },
        `Updated from ${file} on ${date}`)
    }
    /* The snapshot takes the changes it just wrote, so the grid the reader comes
       back to shows what is in the chart rather than what was in the file. The
       edits are then spent: leaving them would have the next Update re-apply
       changes the accounts already carry and count them a second time. */
    setFrozen(f => f && {
      rows: f.rows.map(r => (postEdits[r.row] ? { ...r, ...postEdits[r.row] } : r)),
      counts: f.counts,
    })
    setPostEdits({})

    cleanupRef.current = countUp(total, setProcessed, () => {
      // Created and skipped are facts about the first pass and do not move. The
      // update count is this pass only, not a running total: the reader pressed
      // Update on a set they can see, and that set is what the tile is about.
      setSummary(s => ({ ...s, updated: total }))
      setStep('done')
    })
  }

  /* ──── The walkthrough ──────────────────────────────────────────────────
     Offered once a session, as the upload step opens, because the reader's first
     question is what to upload and the template is the answer to it. See
     `walkthroughState.ts` for why the flag is not persisted, and
     `walkthroughCards.tsx` for what it says. The rest of its wiring is below;
     these two sit up here because the header reads them.

     Three pieces of state and no more: whether it is up, which example surface
     the active card wants mounted, and where the reader was standing when it
     opened. */
  const [walkthrough, setWalkthrough] = useState(false)
  const [walkthroughDemo, setWalkthroughDemo] = useState<string | null>(null)

  /* A step standing on the example is standing on a file that answers, so the
     header and footer answer with it. Left alone they would read the reader's
     empty draft in front of a card describing the example: the dimensions step
     would say "a maximum of 0 dimensions" over a table showing three, and the
     review card would end on "until you press Start import" pointing at a
     button greyed out because nothing was uploaded. Enabling those buttons
     changes nothing the reader can do, since the overlay's inert layer takes
     every click before the wizard sees it. */
  const onExample = walkthrough && walkthroughDemo !== null

  // ---- Header + footer per step --------------------------------------------------
  // Importing and Complete both happen in front of the grid rather than instead
  // of it, so the rows you just checked are still the thing on screen.
  const onReviewSurface = step === 'review' || step === 'importing' || step === 'done'
  // The preview is a chart, not a step to be typed into, but it wants the same
  // room the grid does: full width, its own scroller and no fixed body height.
  const onWideSurface = onReviewSurface || step === 'preview'
  /* Once the import is running or done, the grid shows the frozen snapshot, not a
     view that re-validates against the accounts this import just wrote - with
     any fix made since patched onto it, so a reader who changes a cell after the
     preview sees the change they made rather than the row as it was written. */
  const shownRows = useMemo(() => {
    if (!frozen) return viewRows
    const rows = Object.keys(postEdits)
    if (!rows.length) return frozen.rows
    return frozen.rows.map(r => (postEdits[r.row] ? { ...r, ...postEdits[r.row] } : r))
  }, [frozen, postEdits, viewRows])
  const shownCounts = frozen ? frozen.counts : counts
  const title = step === 'split' ? 'Do the account numbers have multiple segments?'
    : step === 'dimensions' ? 'What does each segment mean?'
    : step === 'labels' ? 'Label the values in your dimensions'
    : step === 'preview' ? 'Preview your chart of accounts'
    : onReviewSurface ? 'Review and fix your data'
    : 'Import accounts'
  /* Short enough that none of them can wrap to a second line, at any width the
     modal is windowed at. The steps before the review grid stand at one height,
     and a subtitle that wrapped on one step and not the next would move the
     footer by a line - which is the whole thing the fixed body height prevents.
     What is left out of these is carried by the step itself.
     The three steps about dimensions are the exception: they are the only ones
     whose vocabulary the customer may never have met before, and defining it is
     worth the extra lines there. The gate is the longest of them because it is
     where the word "dimension" is met for the first time, and it defines the word
     by taking a number apart in the sentence rather than by describing one. */
  const subtitle = step === 'upload' ? (firstTime ? 'Import your existing chart of accounts to finish setting up.' : 'Upload a spreadsheet to add accounts in bulk.')
    : step === 'split' ? (
      <>
        A segment is one part of a segmented account number. Each part may represent something
        different. For example, in <Quoted>01-100-5020</Quoted>, Omne recognises three parts:{' '}
        <Quoted>01</Quoted>, <Quoted>100</Quoted>, and <Quoted>5020</Quoted>. Each part is a segment
        that you can define and give a label.
      </>
    )
    : step === 'dimensions' ? `Your account numbers have a maximum of ${(onExample ? EXAMPLE_DIMENSIONS.decisions.length : shape?.partCount) ?? 0} segments. One of them is the GL account number. The rest can become dimensions you filter your accounts by, for example location or department, or be ignored.`
    : step === 'labels' ? '100 in your department dimension becomes "Operations", so you can filter reports and accounts by department instead of by number. Labelling is optional. Anything you skip shows as the number.'
    : step === 'preview' ? 'This is your chart with the imported accounts in it, including the dimensions they were filed under.'
    /* After the write the same grid is answering a different question. Before it,
       the reader is deciding what to import; after, they are looking at what was
       imported and deciding whether to change any of it. */
    : landed ? 'Your accounts are in the chart. Change any row here and press Update to apply it.'
    : onReviewSurface ? 'Check your accounts before importing. Rows with errors will not be imported until you fix them. Rows with warnings will import as they are.'
    : undefined

  /* What stops the dimensions step from continuing, in the order it has to be
     fixed. A part left unanswered is genuinely unfinished business: it is not
     the same as a part someone looked at and called meaningless. */
  const dimensionsBlocker = (() => {
    if (!splitting) return null
    if (accountIdx < 0) return 'Mark which segment is the GL account number.'
    if (refusal) return 'Some numbers do not reach the segment you picked as the GL account number.'
    const unanswered = slotDecisions.filter(d => d.target.kind === 'unmapped').length
    if (unanswered) return `${unanswered} segment${unanswered === 1 ? '' : 's'} still to define.`
    const unnamed = slotDecisions.filter(d => d.target.kind === 'filter' && !d.target.name.trim()).length
    if (unnamed) return `Label ${unnamed === 1 ? 'the dimension' : `all ${unnamed} dimensions`} to continue.`
    return null
  })()

  /* The step is answered by pressing Next, not by being allowed to press it: the
     button stays live and the unanswered dimensions mark themselves when it is
     pressed. Held rather than derived, so nothing is red before it has been
     asked for - and cleared on the way out so returning to the step is a clean
     sheet. The marks themselves read off current state, so each one goes as its
     dimension is answered rather than on the next press. */
  const [dimensionsTried, setDimensionsTried] = useState(false)
  const dimensionErrors = useMemo(() => {
    if (!dimensionsTried) return {}
    const errors: Record<number, { target?: string; label?: string }> = {}
    slotDecisions.forEach((d, slot) => {
      if (d.target.kind === 'unmapped') errors[slot] = { target: 'Choose what this segment is.' }
      else if (d.target.kind === 'filter' && !d.target.name.trim()) errors[slot] = { label: 'Name this dimension.' }
    })
    return errors
  }, [dimensionsTried, slotDecisions])

  const stepBeforeWalkthrough = useRef<Step | null>(null)

  /* ──── The welcome slide arrives with the modal, not after it ────
     No delay, because there is nothing here to wait for. The slide is a door:
     its own panel, its own scrim, no anchor to measure and nothing behind it
     that has to have settled first. Held back even half a second, it lands on a
     reader who has already started reading the upload step and reaches for the
     template - so what was meant as a greeting arrives as an interruption.

     The tours are not alike in this. The dimensions one in `Setup.tsx` opens
     as the reader steps INTO a step of a wizard already on screen, mid-gesture
     and mid-height-transition, and keeps its delay for that reason. This one
     opens as the modal itself does, so the two entrances play together. */
  useEffect(() => {
    if (!open || step !== 'upload') return
    if (!takeFirstWalkthrough('import')) return
    stepBeforeWalkthrough.current = 'upload'
    setWalkthrough(true)
  }, [open, step])

  /* The door back in, from the bottom of the reading room. The panel is closed
     on the way through: it covers most of the modal, and every card after the
     first points at something behind it.

     Where the reader is standing is taken as it is rather than assumed, because
     the room opens on two steps and a replay from the second has to hand the
     wizard back to the second. */
  const startWalkthrough = useCallback(() => {
    setGuideOpen(false)
    stepBeforeWalkthrough.current = step
    setWalkthrough(true)
  }, [step])

  /* ──── The tour drives the wizard, and the footer's gates do not apply ────
     A card about the dimensions table is read with the dimensions table behind
     it, so the tour moves the wizard to each card's step. It bypasses everything
     the footer checks on the way, deliberately: the reader is being shown the
     form, not asked to fill it in, and refusing to show them the review grid
     because they have not named a dimension yet would be answering a question
     nobody asked.

     Nothing is written to the draft by any of this. The step trail is left alone
     too - `trail.index` follows `step`, so the trail simply reads out where the
     tour is standing, which is the truth while it runs.

     Stable identities on all three, because the overlay keys its own navigation
     effect on them: a callback rebuilt every render would re-fire the navigation
     on every frame. */
  const walkthroughGoToStep = useCallback((s: WalkthroughStep) => {
    setDimensionsTried(false)
    setStep(s)
  }, [])
  const closeWalkthrough = useCallback(() => {
    setWalkthrough(false)
    setWalkthroughDemo(null)
    /* Back where they were standing when it let itself in, so pressing Done
       leaves the reader at the screen they were on with every answer untouched. */
    const back = stepBeforeWalkthrough.current
    stepBeforeWalkthrough.current = null
    if (back) { setDimensionsTried(false); setStep(back) }
  }, [])
  const setDemo = useCallback((d: string | null) => setWalkthroughDemo(d), [])

  /* Which of the five steps the tour is looking at. The other two values of
     `Step` are unreachable while it runs - the wizard is inert once it is up -
     so they read as the step it opened on rather than widening the overlay's
     vocabulary to carry them. */
  const walkthroughStep: WalkthroughStep =
    step === 'split' || step === 'dimensions' || step === 'labels' || step === 'review' ? step : 'upload'

  /* ──── Past the upload, every step the tour shows is the example file ────
     The tour opens before anything has been uploaded, so from the gate onwards
     there is no file to point at. Each card names the example surface it wants
     and the wizard mounts the real step component with the example's props, so
     the reader is looking at the control they are about to use rather than at a
     drawing of it. See `walkthroughExample.tsx`.

     A card without a `demo` gets the reader's own screen, which is what the
     three upload cards want: the template strip and the dropzone are theirs
     already. */
  const demoing = (surface: string) => walkthrough && walkthroughDemo === surface

  /* The trail rides in the modal header from the moment there is something to
     read. A file whose numbers hold no structure at all never meets the
     dimension steps, so it is not shown a trail promising them - it goes from
     the upload to the grid, and a four-step trail with three of them struck
     through would be describing a journey nobody is on.

     A step standing on the example has the example's file behind it, which does
     hold dimensions and does walk all four, so the trail rides there too and
     nothing is struck through while it does. The upload step is not one of the
     four and gets no trail either way: the tour is standing on the reader's own
     empty screen there, and a trail promising four steps over a file that does
     not exist yet is the wizard answering a question nobody has asked. */
  const trail = onExample ? importTrail(step, true, true) : importTrail(step, holdsDimensions, meanings.length > 0)
  /* The write keeps the trail, for the same reason it keeps the footer: the grid
     stays on screen behind the spinner, so this is the Review step busy, not a
     different screen. Take the trail away and the header reflows mid-write,
     which reads as the wizard having lost its place.

     Done keeps it for both of those reasons. The grid is still on screen behind
     the summary, so dropping the trail there reflows the header under a dialog
     the reader is still reading - and Preview is ahead of them rather than
     behind, offered by that dialog, so this is not a trail they have finished
     with. It goes inert instead of away; see the jump handler below. */
  const showTrail = onExample || (!!shape && step !== 'upload')

  const footer = (() => {
    // Importing keeps its buttons in place but inert: the grid stays on screen,
    // and swapping the footer out under it would read as a different screen.
    if (step === 'done') return undefined
    if (step === 'importing') {
      return (
        <>
          <div><Button variant="ghost" disabled>Back</Button></div>
          <div><Button disabled icon={<Loader2 size={ic} className="animate-spin" />}>{landed ? 'Updating…' : 'Importing…'}</Button></div>
        </>
      )
    }
    /* One button, because there is one thing to do here: leave. The way back to
       the rows is the Review step in the trail overhead, which is where every
       other step of this wizard is gone back to - a second control saying the
       same thing in the footer would be the wizard offering two doors to one
       room. Nothing here writes: the accounts are already in the chart, and this
       is a picture of them. */
    if (step === 'preview') {
      return (
        <div>
          <Button iconRight={<ArrowRight size={ic} />} onClick={() => { onClose(); onViewImported?.() }}>
            Go to chart of accounts
          </Button>
        </div>
      )
    }
    if (step === 'upload') {
      /* A button that cannot be used says so by being disabled, and says why on
         hover - rather than accepting the click and then explaining itself. It
         names the next screen once there is a file to read, and only then: with
         nothing uploaded there is no telling whether one is coming. */
      const next = (
        <Button
          iconRight={<ArrowRight size={ic} />}
          disabled={!file}
          onClick={() => setStep(shape ? 'split' : 'review')}
        >{file && !shape ? 'Review data' : 'Continue'}</Button>
      )
      return (
        <>
          <div><Button variant="secondary" onClick={attemptClose}>Cancel</Button></div>
          <div>
            {file ? next : (
              <Tooltip content="Upload a file to continue.">
                {/* The disabled button swallows its own pointer events, so the
                    hover has to be caught by the span around it. */}
                <span
                  className="inline-block cursor-not-allowed"
                  onMouseEnter={() => setBlockerHovered(true)}
                  onMouseLeave={() => setBlockerHovered(false)}
                >
                  <span style={{ pointerEvents: 'none' }}>{next}</span>
                </span>
              </Tooltip>
            )}
          </div>
        </>
      )
    }
    /* The gate is picked in the body and carried out here. No is never blocked,
       only questioned once when the file's own numbers contradict it. Yes is
       refused when the file holds numbers with no dimensions in them, and the
       refusal names them on the step. */
    if (step === 'split') {
      const next = (
        <Button
          iconRight={<ArrowRight size={ic} />}
          disabled={!gateAnswer && !onExample}
          onClick={() => {
            if (gateAnswer === 'no') {
              if (gateContested && !gateWarned) { setGateWarning(true); return }
              setGateRefused(false); setHoldsDimensions(false); setStep('review'); return
            }
            if (withoutDimensions.length) { setGateRefused(true); return }
            setGateRefused(false)
            setHoldsDimensions(true)
            setStep('dimensions')
          }}
        >Continue</Button>
      )
      return (
        <>
          <div><Button variant="ghost" onClick={() => setStep('upload')}>Back</Button></div>
          <div>
            {gateAnswer || onExample ? next : (
              <Tooltip content="Answer the question to continue.">
                {/* The disabled button swallows its own pointer events, so the
                    hover has to be caught by the span around it. */}
                <span className="inline-block cursor-not-allowed">
                  <span style={{ pointerEvents: 'none' }}>{next}</span>
                </span>
              </Tooltip>
            )}
          </div>
        </>
      )
    }
    if (step === 'dimensions') {
      /* Nothing called a dimension means nothing to label, so the labelling step
         is not shown at all rather than shown empty. Skipping it lands on the
         review grid, which is far enough from "next" to be worth naming. */
      const naming = meanings.length > 0
      return (
        <>
          {/* What is left to answer, said only once it has been asked for. Some
              of it cannot be pinned on a field - no dimension being the GL
              account number is a fact about the set, not about one row - so the
              line stays as the place those are stated. */}
          {dimensionsTried && <div className="text-13 text-danger-600">{dimensionsBlocker}</div>}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => { setDimensionsTried(false); setStep('split') }}>Back</Button>
            <Button
              iconRight={<ArrowRight size={ic} />}
              onClick={() => {
                if (dimensionsBlocker) { setDimensionsTried(true); return }
                setDimensionsTried(false)
                setStep(naming ? 'labels' : 'review')
              }}
            >{naming ? 'Next' : 'Review data'}</Button>
          </div>
        </>
      )
    }
    /* Labelling is optional, so nothing here blocks and nothing here counts. The
       footer used to tally how many codes were still unlabelled, which turned an
       optional step into one that looked unfinished on the way past it. The
       subtitle already says what an unlabelled code does. */
    if (step === 'labels') {
      return (
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setStep('dimensions')}>Back</Button>
          <Button iconRight={<ArrowRight size={ic} />} onClick={() => setStep('review')}>Review data</Button>
        </div>
      )
    }
    /* The grid after the write. Same rows, and the same double-click to change
       one, but Start import has already happened - so the button that was going
       to do it now applies what has been changed since instead. Nothing changed
       means nothing to apply, and the way on from here is the preview. */
    if (landed) {
      const pending = pendingUpdates.length
      const update = (
        <Button disabled={!pending} icon={<Check size={ic} />} onClick={commitUpdate}>
          {pending ? `Update ${pending} account${pending === 1 ? '' : 's'}` : 'Update'}
        </Button>
      )
      return (
        <>
          <div><Button variant="ghost" onClick={() => setStep('preview')}>Preview my chart</Button></div>
          <div>
            {pending ? update : (
              // The disabled button swallows its own pointer events, so the hover
              // has to be caught by the span around it.
              <Tooltip content="Change a row to update the account it imported.">
                <span className="inline-block cursor-not-allowed">
                  <span style={{ pointerEvents: 'none' }}>{update}</span>
                </span>
              </Tooltip>
            )}
          </div>
        </>
      )
    }
    // review
    const start = (
      <Button disabled={!onExample && (counts.errors > 0 || counts.ready === 0)} icon={<Check size={ic} />} onClick={startImport}>Start import</Button>
    )
    const blocked = onExample ? null
      : counts.errors > 0
      ? `Fix all errors before importing. ${counts.errors} error${counts.errors === 1 ? '' : 's'} remaining.`
      : counts.ready === 0 ? 'No rows are ready to import.' : null
    return (
      <>
        <div><Button variant="ghost" onClick={() => setStep(splitting ? (meanings.length ? 'labels' : 'dimensions') : shape ? 'split' : 'upload')}>Back</Button></div>
        <div>
          {blocked ? (
            // The disabled button swallows its own pointer events, so the hover
            // has to be caught by the span around it.
            <Tooltip content={blocked}>
              <span className="inline-block cursor-not-allowed">
                <span style={{ pointerEvents: 'none' }}>{start}</span>
              </span>
            </Tooltip>
          ) : start}
        </div>
      </>
    )
  })()

  return (
    <>
      <FormModal
        open={open}
        onClose={attemptClose}
        title={title}
        subtitle={subtitle}
        hideFullView={!onWideSurface}
        autoFull={onWideSurface}
        widthClass="max-w-[880px]"
        fillBody={onWideSurface}
        footer={footer}
        headerExtra={showTrail ? (
          <StepIndicator
            labels={IMPORT_STEPS}
            stepIndex={trail.index}
            skipped={trail.skipped}
            /* Backward only, and it keeps every answer: a step behind you is a
               question already answered, so going back to it is reading it
               again rather than starting it over. Forward is the footer's job -
               the gate's two answers lead to two different steps, which is not
               something a click on one tab can say.

               No jump at all while the write runs, and none once it has
               finished. Dropping the handler is what disables the tabs, so the
               trail goes inert the same way the footer does rather than
               accepting a click that walks the reader back out of a half
               written chart - or, once the accounts have landed, back into
               questions that can no longer change them. */
            onJump={step === 'importing' || step === 'done' ? undefined : i => {
              if (i >= trail.index) return
              setDimensionsTried(false)
              setStep(i === 0 ? 'split' : i === 1 ? 'dimensions' : i === 2 ? 'labels' : 'review')
            }}
          />
        ) : undefined}
        headerActions={step === 'upload' || step === 'split' ? (
          <HowItWorksButton labelled walkthrough="how-it-works" open={guideOpen} onClick={() => setGuideOpen(o => !o)} />
        ) : undefined}
        overlay={
          /* The half of the guide that matches the step. On the upload step the
             question is about the file, so the panel carries the file guide; on
             the numbering step it is about the account number, so it carries the
             dimension guide and nothing else. The walkthrough door hangs on
             both, because the tour starts on the upload step and covers the
             template and the file as well as the numbering. */
          <ReadingRoom
            open={(step === 'upload' || step === 'split') && guideOpen}
            onClose={() => setGuideOpen(false)}
            config={guideConfig}
            onStartWalkthrough={startWalkthrough}
            tail={<WalkthroughReplayRow onStart={startWalkthrough} />}
          />
        }
      >
        {step === 'upload' && (
          <UploadStep
            file={file} fileSize={fileSize} matched={matched}
            uploading={uploading} onCancelUpload={cancelUpload}
            onPick={handleFile} onRemove={clearFile}
            description={description} setDescription={setDescription}
            missing={blockerHovered && !file}
            onDownloadTemplate={downloadTemplate}
          />
        )}
        {step === 'split' && (demoing('split') ? <SplitStep {...EXAMPLE_SPLIT} /> : shape && (
          <SplitStep
            answer={gateAnswer}
            /* Re-answering clears the refusal: it was raised against the answer
               being changed, so leaving it up would refuse the new one. */
            onAnswer={a => { setGateRefused(false); setGateWarned(false); setGateAnswer(a) }}
            fit={fit}
            offPattern={offPatternNumbers}
            blocked={gateRefused ? numbersWithoutDimensions : []}
            onOpenGuide={() => setGuideOpen(true)}
          />
        ))}
        {step === 'dimensions' && (demoing('dimensions') ? <DimensionsStep {...EXAMPLE_DIMENSIONS} /> : (
          <DimensionsStep
            accountLimit={accountLimit}
            decisions={slotDecisions}
            setDecisions={setSlotDecisions}
            valueCounts={valueCounts}
            codes={slotCodes}
            refusal={refusal}
            refusedRows={refusedRows}
            onExcludeRefused={() => setConfirmDropRefused(true)}
            errors={dimensionErrors}
            questions={questions}
            choices={slotChoices}
            onChoose={(code, slot) => setSlotChoices(c => ({ ...c, [code]: slot }))}
          />
        ))}
        {step === 'labels' && (demoing('labels') ? <LabelsStep {...EXAMPLE_LABELS} /> : (
          <LabelsStep
            slots={meanings}
            setLabel={setLabel}
            codes={slotCodes}
          />
        ))}
        {step === 'preview' && <ChartPreviewStep accounts={accounts} scheme={scheme} onBackToReview={() => setStep('review')} />}
        {step === 'review' && !demoing('review') && numberConflicts.length > 0 && (
          <Banner
            tone="warning"
            className="mb-3"
            title={`${new Set(numberConflicts.map(c => c.accountId)).size === 1 ? 'One account sits' : `${new Set(numberConflicts.map(c => c.accountId)).size} accounts sit`} among another branch's numbers`}
          >
            <p>
              We recommend renumbering them in the grid so each branch keeps one run of numbers. The number each row came in with stays on
              the account as its prior account number, so you can still find it by that.
            </p>
            <p className="mt-1">
              If you import them as they are, number protection is turned off for your chart.
            </p>
            <ul className="mt-2 space-y-1">
              {numberConflicts.slice(0, 3).map(c => (
                <li key={`${c.accountId}-${c.holderId}`} className="flex items-center gap-1.5 flex-wrap">
                  <AccountPill account={c.account} /> sits among the numbers kept by <AccountPill account={c.holder} />
                </li>
              ))}
            </ul>
            {numberConflicts.length > 3 && <p className="mt-1">And {numberConflicts.length - 3} more.</p>}
          </Banner>
        )}
        {onReviewSurface && (
          <ReviewGrid
            {...(demoing('review')
              ? EXAMPLE_REVIEW
              : { rows: shownRows, counts: shownCounts, dimensionColumns: dimensionCols, originals, parentCandidates, currencyOptions })}
            query={query} setQuery={setQuery}
            filter={filter} setFilter={setFilter}
            density={density} setDensity={setDensity}
            onEdit={setEdit}
            onBulkSet={bulkSet}
            onDeleteRows={deleteRows}
            onDuplicateRow={duplicateRow}
            onRevertRow={revertRow}
            onExcludeRows={excludeRows}
            templateExamples={demoing('review') ? [] : templateExamples}
            onCancelImport={onClose}
            importing={step === 'importing' ? { processed, total: importTotal } : null}
          />
        )}
      </FormModal>

      {/* A sibling of the modal rather than a child of it: the overlay portals to
          the body and has to sit above the panel, and a spotlight nested inside
          the box it is cutting a hole in would be clipped by it. */}
      {walkthrough && (
        <WalkthroughOverlay
          cards={WALKTHROUGH_CARDS}
          label="Import accounts walkthrough"
          welcome={p => <WalkthroughWelcome {...p} />}
          currentStep={walkthroughStep}
          onGoToStep={walkthroughGoToStep}
          onDemo={setDemo}
          onClose={closeWalkthrough}
        />
      )}

      <ImportDoneDialog
        open={step === 'done'}
        summary={summary}
        firstTime={firstTime}
        onPreview={() => setStep('preview')}
        onViewImported={() => { onClose(); onViewImported?.() }}
      />

      <ConfirmModal
        open={discardLevel !== null}
        tone="danger"
        badge="Discard"
        title={discardLevel === 'updates' ? 'Close without updating?'
          : discardLevel === 'review' ? 'Close without importing?'
          : 'Discard this import?'}
        /* The accounts are in the chart by the time 'updates' can be reached, so
           this says what is at risk and what is not. Told the whole import was
           being discarded, a reader would go looking for accounts that are
           already there. */
        description={discardLevel === 'updates'
          ? 'Your accounts are already in your chart. The changes you made after importing have not been applied to them yet.'
          : discardLevel === 'review'
          ? 'Your fixes on this screen will not be saved.'
          : 'The name and file you added will not be saved.'}
        confirmLabel={discardLevel === 'updates' ? 'Discard changes' : 'Discard'}
        dismissLabel="Keep editing"
        onConfirm={() => { setDiscardLevel(null); onClose() }}
        onDismiss={() => setDiscardLevel(null)}
      />

      {/* Answering no is allowed over any file, and over most files it is simply
          true. Over a file whose numbers visibly come apart it is a claim the
          file contradicts, so the reading is put back to the reader once, with
          the answer they gave named beside it: what makes this worth stopping
          for is not that the file looks split but that they have just said it
          is not. */}
      {shape && gateContested && (
        <ConfirmModal
          open={gateWarning}
          tone="warning"
          title="Your account numbers contain multiple parts"
          description={
            <>
              <span className="block">
                {gateWarningText(shape.separator, (fit?.total ?? 0) - withoutDimensions.length, fit?.total ?? 0)}
              </span>
              <span className="block mt-1.5">
                You selected No, so Omne will import them as one number.
              </span>
            </>
          }
          confirmLabel="Import as one number"
          dismissLabel="Go back"
          onConfirm={() => {
            setGateWarning(false)
            setGateWarned(true)
            setGateRefused(false)
            setHoldsDimensions(false)
            setStep('review')
          }}
          onDismiss={() => setGateWarning(false)}
        />
      )}

      {/* The rows are named here, not just counted: this removes them from the
          import, and a count alone gives nobody a way to check it is the right
          rows. */}
      <ConfirmModal
        open={confirmDropRefused}
        tone="warning"
        badge="Remove"
        title={`Remove ${refusedRows.length} row${refusedRows.length === 1 ? '' : 's'} and continue?`}
        description={[
          'These numbers are too short to reach the segment you picked as the GL account number, so there is no way to tell what account they are.',
          'The rest of your file imports as normal. Nothing in your file is changed.',
        ]}
        reasonsTitle="Rows to remove"
        reasons={refusedRows.slice(0, 8).map(r => (
          <span key={r.row}>
            Row {r.row}: <span className="tabular-nums">{r.number || 'no number'}</span>{r.name ? ` · ${r.name}` : ''}
          </span>
        ))}
        confirmLabel="Remove and continue"
        dismissLabel="Keep them"
        onConfirm={() => { setConfirmDropRefused(false); excludeRefusedRows() }}
        onDismiss={() => setConfirmDropRefused(false)}
      />
    </>
  )
}

// =========================
// Upload. How many steps follow depends on the file, so these are named rather
// than numbered.
// =========================
function UploadStep({ file, fileSize, matched, uploading, onCancelUpload, onPick, onRemove, description, setDescription, missing, onDownloadTemplate }: {
  file: string | null; fileSize: number; matched: number
  uploading: UploadingFile | null; onCancelUpload: () => void
  onPick: (f: File) => void; onRemove: () => void
  description: string; setDescription: (v: string) => void
  missing: boolean
  onDownloadTemplate: (format: 'excel' | 'csv') => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const openPicker = () => inputRef.current?.click()
  const [dragging, setDragging] = useState(false)

  return (
    /* The body is tinted so the two things you act on, the dropzone and the note,
       read as white cards sitting on it rather than as outlines on a blank page.
       The height is fixed, so adding a file does not resize the modal around the
       cursor. */
    <div className="px-8 pt-6 pb-8 flex flex-col gap-5 bg-bg-subtle/60" style={{ height: WIZARD_BODY_H }}>
      {/* Download template */}
      <div data-walkthrough="template" className="flex items-center gap-3 rounded-xl border border-info-100 bg-info-50 px-4 py-3.5">
        <span className="shrink-0 w-9 h-9 rounded-lg bg-info-100 flex items-center justify-center text-info-600">
          <FileSpreadsheet size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-fg">Download the import template</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="secondary" icon={<Download size={13} />} onClick={() => onDownloadTemplate('excel')}>Excel</Button>
          <Button size="sm" variant="secondary" icon={<Download size={13} />} onClick={() => onDownloadTemplate('csv')}>CSV</Button>
        </div>
      </div>

      {/* Upload. The walkthrough's handle sits on the whole block rather than on
          the dropzone alone, so the card about adding a file lights the label,
          the zone and the card the file arrives as. */}
      <div data-walkthrough="dropzone">
        <div className="text-sm font-medium text-fg mb-1.5">Upload your file <span className="text-danger-600">*</span></div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = '' }}
        />
        <button
          type="button"
          onClick={openPicker}
          onDragEnter={e => { e.preventDefault(); setDragging(true) }}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          // Crossing into a child fires dragleave on the parent. Without this
          // the zone flickers off the moment the cursor reaches the icon.
          onDragLeave={e => { if (e.currentTarget.contains(e.relatedTarget as Node | null)) return; setDragging(false) }}
          onDrop={e => {
            e.preventDefault()
            setDragging(false)
            const f = e.dataTransfer.files?.[0]
            if (f) onPick(f)
          }}
          className={cn(
            'w-full flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 text-left transition-colors',
            missing ? 'border-danger-300 bg-danger-50/60'
              : dragging ? 'border-primary bg-primary/[0.06]'
              : 'border-border bg-white hover:border-primary/50 hover:bg-bg-subtle/40',
          )}
        >
          <span className={cn('shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center transition-colors',
            dragging ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-bg-subtle border-border text-fg-subtle')}>
            <Upload size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm">
              {file ? (
                <><span className="font-medium text-fg">1 file added.</span> <span className="text-primary font-medium">Add another</span></>
              ) : (
                <><span className="text-primary font-medium">Click to upload</span> <span className="text-fg-muted">or drag and drop</span></>
              )}
            </div>
            <div className={cn('text-2xs mt-0.5', missing ? 'text-danger-600' : 'text-fg-subtle')}>
              {missing ? 'Upload an Excel or CSV file to continue.' : 'Excel or CSV. Up to 10 MB.'}
            </div>
          </div>
        </button>
        {(uploading || file) && (
          <div style={CARD_GRID_STYLE}>
            {uploading
              ? <UploadingCard file={uploading} onCancel={onCancelUpload} />
              : file && <AttachmentCard name={file} size={fileSize} matched={matched} onRemove={onRemove} />}
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <div className="text-sm font-medium text-fg mb-1.5">Import description <span className="text-fg-subtle font-normal">(Optional)</span></div>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. Q2 2026 new expense accounts. A short note that helps you find this import later."
          className="input min-h-[100px] py-2"
        />
      </div>
    </div>
  )
}

// The uploaded file, shown as the thing it is. The preview is invented content
// in a real grid rather than grey bars, because a spreadsheet is recognisable at
// thumbnail size and a stack of bars is not. Cards sit in a fluid grid so a
// second file lands beside the first instead of under it.
const CARD_GRID_STYLE: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginTop: 10,
}
const PREVIEW_HEIGHT = 'clamp(94px, calc(10vw - 6px), 174px)'
const PREVIEW_SURFACE = '#EEF0F3'
const PREVIEW_COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
const PREVIEW_ROW_COUNT = 14
// Sparse, so the sheet reads as partly filled - a file someone is working on.
const PREVIEW_CELLS: Record<number, string[]> = {
  1: ['1000', 'Cash'],
  2: ['1010', 'Operating bank'],
  4: ['1400', 'Prepaid'],
  6: ['1690', 'Accum. depr.'],
  8: ['2000', 'Payables'],
  10: ['4000', 'Revenue'],
  12: ['5000', 'Salaries'],
}
const PREVIEW_BAND_ROWS = new Set([6])

function SheetPreview() {
  return (
    <table className="w-full border-collapse" style={{ fontSize: 5, lineHeight: '9px', tableLayout: 'fixed' }} aria-hidden>
      <thead>
        <tr>
          <th style={{ width: '9%', background: '#F8F9FA', border: '0.5px solid #E1E3E6', color: '#5F6368' }} />
          {PREVIEW_COLS.map(c => (
            <th key={c} style={{ background: '#F8F9FA', border: '0.5px solid #E1E3E6', color: '#5F6368', fontWeight: 600 }}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: PREVIEW_ROW_COUNT }, (_, i) => i + 1).map(r => {
          const cells = PREVIEW_CELLS[r] ?? []
          const bg = PREVIEW_BAND_ROWS.has(r) ? '#E8F0FE' : '#FFFFFF'
          return (
            <tr key={r}>
              <td style={{ background: '#F8F9FA', border: '0.5px solid #E1E3E6', color: '#5F6368', textAlign: 'center' }}>{r}</td>
              {PREVIEW_COLS.map((c, ci) => (
                <td key={c} style={{ background: bg, border: '0.5px solid #E1E3E6', color: '#3C4043', padding: '0 1px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {cells[ci] ?? ''}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function AttachmentCard({ name, size, matched, onRemove }: { name: string; size: number; matched: number; onRemove: () => void }) {
  const ext = name.split('.').pop()?.toUpperCase() ?? 'CSV'
  return (
    <div className="rounded-[10px] border border-border bg-white overflow-hidden transition-all hover:border-primary/50 hover:shadow-md">
      <div className="relative overflow-hidden" style={{ height: PREVIEW_HEIGHT, background: PREVIEW_SURFACE }}>
        <SheetPreview />
        {/* The sheet runs past the bottom of the card, so it fades out rather
            than stopping mid-row. */}
        <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: '40%', background: `linear-gradient(to bottom, rgba(238,240,243,0) 0%, ${PREVIEW_SURFACE} 80%)` }} />
        <span className="absolute bottom-1.5 left-1.5 rounded bg-white px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-fg-muted shadow-xs">{ext}</span>
        <button
          onClick={onRemove}
          aria-label="Remove file"
          className="absolute top-1.5 right-1.5 w-[22px] h-[22px] rounded-full bg-white/95 border border-border flex items-center justify-center text-fg-subtle hover:text-danger-600 hover:border-danger-200 shadow-sm transition-colors"
        >
          <X size={12} />
        </button>
      </div>
      <div className="px-2.5 py-2 border-t border-border">
        <div className="text-xs font-medium text-fg truncate" title={name}>{name}</div>
        <div className="text-2xs text-fg-subtle mt-0.5">{fileSizeLabel(size)} · {matched} of {TEMPLATE_FIELDS.length} columns matched</div>
      </div>
    </div>
  )
}

function UploadingCard({ file, onCancel }: { file: UploadingFile; onCancel: () => void }) {
  const r = 24
  const circumference = 2 * Math.PI * r
  return (
    <div className="rounded-[10px] border border-border bg-white overflow-hidden">
      <div className="relative flex items-center justify-center coa-att-shimmer" style={{ height: PREVIEW_HEIGHT }}>
        <svg width={56} height={56} viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={28} cy={28} r={r} fill="none" stroke="#E2E8F0" strokeWidth={4} />
          <circle
            cx={28} cy={28} r={r} fill="none" strokeWidth={4} strokeLinecap="round"
            className="stroke-primary"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - file.progress / 100)}
            style={{ transition: 'stroke-dashoffset 160ms linear' }}
          />
        </svg>
        <span className="absolute text-xs font-bold text-primary tabular-nums">{file.progress}%</span>
        <button
          onClick={onCancel}
          aria-label="Cancel upload"
          className="absolute top-1.5 right-1.5 w-[22px] h-[22px] rounded-full bg-white/95 border border-border flex items-center justify-center text-fg-subtle hover:text-danger-600 hover:border-danger-200 shadow-sm transition-colors"
        >
          <X size={12} />
        </button>
      </div>
      <div className="px-2.5 py-2 border-t border-border">
        <div className="text-xs font-medium text-fg truncate" title={file.name}>{file.name}</div>
        <div className="text-2xs text-fg-subtle mt-0.5">Reading… {fileSizeLabel(file.size)}</div>
      </div>
    </div>
  )
}

// =========================
// The gate. One question, asked of everyone: do the numbers hold dimensions? A
// yes goes on to have each dimension answered for; a no imports the numbers
// exactly as they are.
//
// The colour a dimension wears once it has an answer. One tone per kind of
// answer rather than one per dimension, so the mapper's numbered badges read
// down the column as which dimensions are settled and what they became.
// =========================
const PART_TONE = {
  account: 'bg-info-50 text-info-700 border-info-100',
  filter: 'bg-purple-50 text-purple-700 border-purple-100',
  ignore: 'bg-bg-muted text-fg-subtle border-border',
  unmapped: 'bg-white text-fg border-border-strong border-dashed',
} as const

const toneForTarget = (t: SlotTarget | undefined): keyof typeof PART_TONE =>
  !t || t.kind === 'unmapped' ? 'unmapped' : t.kind

/* The gate's worked example wears one tone per PIECE, which is the opposite of
   the rule above and deliberately so. The mapper's badges report answers, and
   two dimensions that became filters are the same answer twice. These three are
   not answers at all: they are one number taken apart, shown to define the word
   "dimension" before it is used. Painting two of them alike would say those two
   belong together and the third does not, which is the one thing the example
   must not say - the reader is being shown three peers. */
const EXAMPLE_TONE = {
  location: 'bg-purple-50 text-purple-700 border-purple-100',
  department: 'bg-warning-50 text-warning-700 border-warning-100',
  account: 'bg-info-50 text-info-700 border-info-100',
} as const

// One dimension of the worked example. Not a number from the file: the example
// is there to define what a dimension is, and a real number cannot do that until
// its dimensions have been named.
function ExamplePart({ children, tone }: { children: ReactNode; tone: keyof typeof EXAMPLE_TONE }) {
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2.5 py-1 text-13', EXAMPLE_TONE[tone])}
      style={{ fontWeight: 600 }}>
      {children}
    </span>
  )
}

const Dash = () => <span className="text-fg-subtle text-13">-</span>

/* The example number, hyphens and all. Never wraps: the pieces are only legible
   as pieces of one number while they stay on one line. */
function ExampleNumber({ parts }: { parts: string[] }) {
  return (
    <span className="flex items-center gap-1.5 text-13 text-fg tabular-nums" style={{ fontWeight: 600 }}>
      {parts.map((p, i) => (
        <Fragment key={p}>
          {i > 0 && <Dash />}
          <span>{p}</span>
        </Fragment>
      ))}
    </span>
  )
}

/* Names the number beside it. Without one, digits under a card's description
   read as something the file supplied, and nothing on this step has come from
   the file yet. Inline rather than a label over the block: the example is read
   left to right now, from the number as the reader has it to what its parts
   turn out to be. */
const ExampleLabel = () => (
  <span className="text-13 font-semibold text-fg-muted shrink-0">Example:</span>
)

/** Which shape the customer says their numbers have. Null until they say. */
type GateAnswer = 'yes' | 'no' | null

/* The separator the file turned out to use, named. The teaching copy elsewhere
   says "hyphen" because it is describing an example; this is describing the
   reader's own file, so it has to say the character actually found. */
const SEPARATOR_NAMES: Record<string, string> = {
  '-': 'a hyphen',
  '.': 'a full stop',
  '/': 'a slash',
  '\\': 'a backslash',
  '_': 'an underscore',
  ':': 'a colon',
  '|': 'a pipe',
  ' ': 'a space',
}

/* What the file says about itself, put back to a reader who has just said it
   says nothing. The separator is named off the file rather than assumed, and a
   file where only some numbers carry one is counted rather than swept into the
   plain sentence: "your account numbers contain a hyphen" over a file where
   eight of nine do is a warning the reader can catch us out on. Exported so a
   test can pin it. */
export function gateWarningText(separator: string, withDimensions: number, total: number): string {
  /* Every character that is not a letter or digit separates, so a file may use
     more than one, and each is named. */
  const names = [...separator].map(c => SEPARATOR_NAMES[c] ?? `a ${c}`)
  const sep = names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  if (withDimensions < total) {
    return `${withDimensions} of your ${total} account numbers contain ${sep}, so they may have multiple segments.`
  }
  return total > 1
    ? `Your account numbers contain ${sep}, so they may have multiple segments.`
    : `Your account number contains ${sep}, so it may have multiple segments.`
}

/* The gate. One question, asked of everyone, answered by picking one of the two
   shapes a number can have - each one drawn, because the difference between them
   is a difference in structure and a sentence describing a structure is harder to
   read than the structure itself.
   Both examples use the number the subtitle has just taken apart. The digits are
   only readable because that sentence went first, and reusing them here is what
   makes the two cards a choice between two readings of one number rather than
   two unrelated diagrams. Nothing here is from the file: naming the customer's
   own dimensions is the next step's whole job. */
function SplitStep({ answer, onAnswer, fit, offPattern, blocked, onOpenGuide }: {
  answer: GateAnswer
  onAnswer: (a: GateAnswer) => void
  fit: PatternFit | null
  offPattern: string[]
  onOpenGuide: () => void
  /* Numbers holding no dimensions at all, named only once Yes has been tried.
     Answering yes is a claim about the file, and these are the rows that make
     it untrue, so they are shown against the answer rather than in advance. */
  blocked: string[]
}) {
  return (
    <div className="px-8 py-5 space-y-3" style={{ height: WIZARD_BODY_H }}>
      {/* Stretched rather than top-aligned. Yes carries a longer description and
          a three-piece example, so left to their own heights the two answers
          would be two different sizes of card - and the taller one reads as the
          recommended one when the only difference between them is how much had
          to be said. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <OptionCard
          walkthrough="gate-yes"
          active={answer === 'yes'}
          onClick={() => onAnswer('yes')}
          label="Yes"
          descriptionClass="text-13 leading-[1.55]"
          description="The account number has multiple segments."
        >
          {/* The number, then what its parts turn out to be. One line, read the
              way the reader arrived: they have the digits in their file and are
              being told what those digits are. The digits are left plain, because
              colouring both sides would ask the reader to match them by hue when
              they already match by order. The arrow travels with the number, so a
              wrap puts the three names on their own line rather than orphaning
              the arrow at the end of the one above. */}
          <span className="mt-2.5 flex items-center gap-2 flex-wrap">
            <ExampleLabel />
            <span className="flex items-center gap-2 shrink-0">
              <ExampleNumber parts={SPECIMEN_PARTS} />
              <span className="text-fg-subtle text-13" aria-hidden>&rarr;</span>
            </span>
            <span className="flex items-center gap-1.5 flex-wrap">
              <ExamplePart tone="location">Location</ExamplePart>
              <ExamplePart tone="department">Department</ExamplePart>
              <ExamplePart tone="account">GL account number</ExamplePart>
            </span>
          </span>
        </OptionCard>
        <OptionCard
          walkthrough="gate-no"
          active={answer === 'no'}
          onClick={() => onAnswer('no')}
          label="No"
          descriptionClass="text-13 leading-[1.55]"
          description="The account number has one part and is treated as the GL account number."
        >
          {/* No arrow and nothing named, because there is nothing to point at.
              The description has already said what the whole number is, and a
              lone pill repeating it would suggest a part had been picked out of
              something with only one part in it. */}
          <span className="mt-2.5 flex items-center gap-2 flex-wrap">
            <ExampleLabel />
            <ExampleNumber parts={['5020']} />
          </span>
        </OptionCard>
      </div>

      {/* The two cards are the whole question, so what is left to say is where to
          go when neither of them is obviously yours. It opens the panel itself
          rather than naming the header button and leaving the reader to find it:
          a reader who is unsure is the one least able to spare a hunt, and the
          button stays where it is for everyone who was not. */}
      <div className="text-13 text-fg-muted">
        Not sure? Click{' '}
        <button type="button" onClick={onOpenGuide} className="text-primary font-medium hover:underline">How it works</button>{' '}
        to understand dimensions.
      </div>

      {/* The claim the file does not support, refused with the rows that refuse
          it. The fix is in the file, so the route out is a corrected upload
          rather than a reconciliation done here. */}
      {blocked.length > 0 && (
        <Banner tone="danger" title={`${blocked.length === 1 ? 'One number in your file holds' : `${blocked.length} numbers in your file hold`} no separator`}>
          <span className="block tabular-nums" style={{ fontWeight: 600 }}>{blocked.slice(0, 8).join('   ')}{blocked.length > 8 ? `   and ${blocked.length - 8} more` : ''}</span>
          <span className="block mt-1">
            Every number has to be built the same way for its segments to mean anything. Correct these in your
            spreadsheet and upload the file again, or answer No to import the numbers as they are.
          </span>
        </Banner>
      )}

      {/* Numbers the pattern does not hold for, named rather than described.
          These do hold dimensions, just not cleanly, so they are a warning
          rather than a refusal. Nothing is padded out to a shape nobody wrote. */}
      {offPattern.length > 0 && (
        <Banner tone="warning" title={`${offPattern.length === 1 ? 'One number does' : `${offPattern.length} numbers do`} not split this way`}>
          <span className="block tabular-nums" style={{ fontWeight: 600 }}>{offPattern.join('   ')}</span>
          <span className="block mt-1">
            These are kept exactly as they are and flagged for you on the next screen.
          </span>
        </Banner>
      )}

      {/* Fewer dimensions is ragged rather than wrong, so it is stated plainly:
          those rows simply carry fewer values. */}
      {!!fit?.short.length && (
        <Banner tone="info" title={`${fit.short.length === 1 ? 'One number has' : `${fit.short.length} numbers have`} fewer segments than the rest`}>
          They import with the segments they do have. Nothing is filled in for the ones they are missing.
        </Banner>
      )}
    </div>
  )
}

// The three things a dimension of the number can be, as dropdown values.
const SLOT_OPTION = { unanswered: '', account: 'account', filter: 'filter', ignore: 'ignore' } as const

/* The whole question, in one place. The dropdown only renders its options once
   it is open, so the answers are stated as data: it is the one form in which
   what is on offer can be read without opening anything. */
/* Each answer wears an icon naming what it does: the number sign for the
   account, a filter for the dimension, a strike for the part left out. All
   one grey - the icon says which answer, the colour is not carrying a second
   meaning on top of it. */
export const SLOT_ANSWERS = [
  { value: SLOT_OPTION.account, label: 'GL account number', icon: <Hash size={14} className="text-fg-subtle shrink-0" />, tip: 'The account itself. Kept as the account number, and nothing to name.' },
  { value: SLOT_OPTION.filter, label: 'Dimension', icon: <ListFilter size={14} className="text-fg-subtle shrink-0" />, tip: 'Becomes something you can filter and group your accounts by, once you give it a label.' },
  { value: SLOT_OPTION.ignore, label: 'Ignore', icon: <Ban size={14} className="text-fg-subtle shrink-0" />, tip: 'The digits stay in the arrival number, but nothing is stored and nothing can be reported by them.' },
] as const

/**
 * The naming step: every dimension the number turned out to carry, one collapsible
 * band of a nested table, opened to name its codes.
 *
 * A folded table rather than tabs or a plain list because the dimensions are one
 * list to work down and each holds a table of values: the band carries the
 * dimension name and how far its naming has got, and opens onto the Value / Used by
 * / Name rows beneath - the same collapse the account list is read by. Collapsed,
 * the card hugs its bands rather than framing an empty box.
 *
 * Nobody reads a report filtered by 40, so a code is worth more once it has a name
 * - but naming is optional and a code left alone imports as itself. There used to
 * be a paste route and a lift-from-a-column route beside the typing; both are
 * gone, machinery for a job nobody has to finish. What is left is the row count
 * per code, so fifty of them can be worked commonest first.
 */
export function LabelsStep({ slots, setLabel, codes }: {
  slots: SlotMeaning[]
  setLabel: (slot: number, raw: string, label: string) => void
  codes: (slot: number) => SlotTally[]
}) {
  // The first dimension opens so the step never lands empty; the rest are the
  // reader's to open. Keyed by slot so a dimension going away on the mapping step
  // does not carry its open state onto whatever falls into its old index.
  const [open, setOpen] = useState<Record<number, boolean>>(() =>
    slots.length ? { [slots[0].slot]: true } : {})
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const toggle = (slot: number) => setOpen(o => ({ ...o, [slot]: !o[slot] }))

  const groups = slots.map(({ slot, name, labels }) => {
    const lab = labels ?? {}
    const tally = codes(slot)
    const shown = q
      ? tally.filter(t => t.code.toLowerCase().includes(q) || (lab[t.code] ?? '').toLowerCase().includes(q))
      : tally
    // A search opens every band that has a hit, so a match is never hidden behind
    // a shut fold; with no search, the fold is only ever what was toggled.
    const expanded = q ? shown.length > 0 : !!open[slot]
    return { slot, name, lab, tally, shown, progress: labelProgress(tally.map(t => t.code), lab), expanded }
  })
  const anyMatch = groups.some(g => g.shown.length > 0)

  return (
    <div className="px-8 py-6 flex flex-col" style={{ height: WIZARD_BODY_H }}>
      {/* Finding a code among fifty is the one control always worth having above
          the table; the bulk routes that once sat here answered a job nobody has
          to finish. */}
      <div className="relative max-w-[300px] shrink-0">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search values"
          aria-label="Search values"
          className="input h-9 pl-9 text-13 bg-white"
        />
      </div>

      {/* The card hugs its bands and only scrolls once a dimension is opened wide:
          collapsed, it is a row of bands, not a framed empty box. */}
      <div className="mt-3 flex-1 min-h-0">
        <div className="max-h-full overflow-y-auto scrollbar-thin rounded-xl border border-border bg-white">
          <table className="w-full text-sm border-separate border-spacing-0">
            <colgroup>
              <col className="w-[168px]" />
              <col className="w-[128px]" />
              <col />
              <col className="w-[56px]" />
            </colgroup>
            {/* Header chrome copied straight from the account table: an opaque
                muted/30 fill composited over white so the sticky row never shows
                codes scrolling under it, with normal-weight muted-foreground
                labels. Borders live on the cells because the table is
                border-separate, the same as every table in the module. */}
            <thead className="sticky top-0 z-10">
              <tr>
                <th scope="col" className="h-10 pl-11 pr-4 text-left align-middle font-normal text-xs text-muted-foreground border-b border-border bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)]">Value</th>
                <th scope="col" className="h-10 px-4 text-left align-middle font-normal text-xs text-muted-foreground border-b border-border bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)]">Used by</th>
                <th scope="col" className="h-10 px-4 text-left align-middle font-normal text-xs text-muted-foreground border-b border-border bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)]">Name</th>
                <th scope="col" className="h-10 px-4 text-left align-middle font-normal text-xs text-muted-foreground border-b border-border bg-[color-mix(in_srgb,hsl(var(--muted))_30%,#fff)]"><span className="sr-only">Exclude</span></th>
              </tr>
            </thead>
            {q && !anyMatch ? (
              <tbody>
                <tr>
                  <td colSpan={4} className="border-b border-border px-4 py-6 text-center text-sm text-muted-foreground">No value matches that.</td>
                </tr>
              </tbody>
            ) : groups.map(g => (
              <tbody key={g.slot}>
                {/* The dimension band is the account table's parent row: a muted/22
                    tint that hovers to the same blue every row does, opening onto
                    its codes below. */}
                <tr
                  onClick={() => toggle(g.slot)}
                  className="cursor-pointer bg-[color-mix(in_srgb,hsl(var(--muted))_22%,#fff)] hover:bg-[#F0F7FF] transition-colors"
                >
                  <td colSpan={4} className="border-b border-border px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <ExpandToggle expanded={g.expanded} onClick={e => { e.stopPropagation(); toggle(g.slot) }} />
                      <span className="text-sm text-fg font-medium">{g.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">{g.progress.named} of {g.tally.length} named</span>
                    </div>
                  </td>
                </tr>
                {g.expanded && g.shown.map(({ code, rows }) => {
                  const nothing = g.lab[code] === VALUE_MEANS_NOTHING
                  const named = !nothing && !!g.lab[code]?.trim()
                  return (
                    <tr
                      key={code}
                      /* Keyed by which of the three answers this value is showing,
                         so the tour's card about naming lights a named row and the
                         card about excluding lights an excluded one. Over the
                         example file there is one row in each state; over a real
                         file a key may be worn by many rows, which is why the
                         cards stand on the example. */
                      data-walkthrough={nothing ? 'value-excluded' : named ? 'value-named' : 'value-blank'}
                      className="bg-white hover:bg-[#F0F7FF] transition-colors align-middle"
                    >
                      {/* Indented under the band's toggle, so the code reads as a
                          child of the dimension - the account tree's own indent. */}
                      <th scope="row" className="border-b border-border pl-11 pr-4 py-2 text-left font-normal text-sm text-slate-700 tabular-nums">{code}</th>
                      {/* How much of the file hangs on naming this one code. */}
                      <td className="border-b border-border px-4 py-2">
                        <Tooltip side="bottom" content={`On ${rows} row${rows === 1 ? '' : 's'} of your file.`}>
                          <span className="text-sm text-fg-subtle tabular-nums cursor-help">{rows} account{rows === 1 ? '' : 's'}</span>
                        </Tooltip>
                      </td>
                      <td className="border-b border-border px-4 py-2">
                        <input
                          value={nothing ? '' : g.lab[code] ?? ''}
                          onChange={e => setLabel(g.slot, code, e.target.value)}
                          placeholder={nothing ? 'Excluded' : 'Optional'}
                          aria-label={`Name for value ${code}`}
                          disabled={nothing}
                          className={cn('input w-full disabled:bg-bg-muted disabled:text-fg-subtle',
                            named ? 'bg-success-50/70 border-success-100' : 'bg-white')}
                        />
                      </td>
                      <td className="border-b border-border px-4 py-2">
                        <Tooltip
                          side="bottom"
                          content={nothing
                            ? 'Bring this value into Omne after all.'
                            : 'Exclude this value, so nothing at all is stored for it.'}
                        >
                          <button
                            type="button"
                            onClick={() => setLabel(g.slot, code, nothing ? '' : VALUE_MEANS_NOTHING)}
                            aria-pressed={nothing}
                            className={cn('inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors',
                              nothing ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-white text-fg-subtle hover:text-fg hover:bg-bg-subtle')}
                          >
                            <Ban size={12} />
                          </button>
                        </Tooltip>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </div>
  )
}

/**
 * What each dimension of the number is. One dropdown per dimension, over the
 * three things a piece of an account number can be: the GL account number, a
 * filter, or nothing.
 *
 * A dropdown rather than a three-way role control because there is a real
 * difference between a dimension nobody has answered for and one someone looked
 * at and chose to ignore. The old control could not express the first: it always
 * had one of three roles selected, so an unexamined dimension read as a decision.
 */
export function DimensionsStep({
  accountLimit, decisions, setDecisions,
  valueCounts, codes,
  refusal, refusedRows, onExcludeRefused,
  errors,
  questions, choices, onChoose,
}: {
  accountLimit: number
  decisions: SlotDecision[]
  setDecisions: (updater: (d: SlotDecision[]) => SlotDecision[]) => void
  valueCounts: number[]
  codes: (slot: number) => SlotTally[]
  refusal: UnsupportedReason | null
  refusedRows: ParsedRow[]
  onExcludeRefused: () => void
  /* Which dimensions were left unanswered when Next was pressed, keyed by slot.
     Empty until it has been pressed. */
  errors: Record<number, { target?: string; label?: string }>
  questions: SlotQuestion[]
  choices: SlotChoices
  onChoose: (code: string, slot: number) => void
}) {
  const setTarget = (slot: number, target: SlotTarget) => setDecisions(d => d.map((x, j) => {
    // Exactly one dimension can be the account. Taking the role means releasing
    // it from wherever it was, back to unanswered rather than to a guess: the
    // dropdown can say "not answered yet", so it says it.
    if (j === slot) return { ...x, target }
    if (target.kind === 'account' && x.target.kind === 'account') return { ...x, target: { kind: 'unmapped' } }
    return x
  }))

  /* How a dimension is named once there is an answer for it, so the slot picker
     below asks "Department or Cost centre" rather than "2 or 3". */
  const partLabel = (slot: number) => {
    const t = decisions[slot]?.target
    const named = t?.kind === 'filter' ? t.name.trim() : undefined
    return named ? `Segment ${slot + 1} · ${named}` : `Segment ${slot + 1}`
  }

  const onSelect = (slot: number, value: string) => {
    if (value === SLOT_OPTION.filter) { setTarget(slot, { kind: 'filter', name: '' }); return }
    if (value === SLOT_OPTION.account) { setTarget(slot, { kind: 'account' }); return }
    if (value === SLOT_OPTION.ignore) { setTarget(slot, { kind: 'ignore' }); return }
    setTarget(slot, { kind: 'unmapped' })
  }

  return (
    <div className="px-8 py-6 space-y-3" style={{ height: WIZARD_BODY_H }}>
      {/* The refusal takes the place of the table rather than sitting above it:
          with the account in a slot some rows never reach, there is nothing the
          table below could be answering. */}
      {refusal ? (
        <Banner
          tone="warning"
          title={`Segment ${refusal.accountIdx + 1} cannot be the GL account number`}
          action={
            <Button variant="secondary" onClick={onExcludeRefused} className="shrink-0">
              Remove {refusedRows.length} row{refusedRows.length === 1 ? '' : 's'}
            </Button>
          }
        >
          <span className="block">
            Some of your numbers have only {refusal.minPartCount} segment{refusal.minPartCount === 1 ? '' : 's'}, so they never reach segment {refusal.accountIdx + 1}. Every account has to have a number, so the GL account number has to sit in a segment every row has.
          </span>
          {refusedRows.length > 0 && (
            <span className="block mt-1.5 tabular-nums" style={{ fontWeight: 600 }}>
              {refusedRows.slice(0, 4).map(r => r.number).join('   ')}
              {refusedRows.length > 4 && `   +${refusedRows.length - 4} more`}
            </span>
          )}
          <span className="block mt-1.5">
            Pick one of the first {refusal.minPartCount} dimension{refusal.minPartCount === 1 ? '' : 's'} instead, remove those rows, or fix the file and upload it again.
          </span>
        </Banner>
      ) : (
        <div className="rounded-xl border border-border bg-white overflow-clip">
          <table className="w-full text-sm">
            {/* The dropdown is the only control, so it gets a fixed width it can
                hold its longest option in; the values column takes the rest,
                because how many there are is the evidence behind the answer. */}
            <colgroup>
              <col className="w-[210px]" />
              <col />
              <col className="w-[220px]" />
            </colgroup>
            <thead className="bg-bg-subtle text-xs text-fg-muted">
              <tr className="border-b border-border">
                <th scope="col" className="px-4 py-2.5 text-left font-medium uppercase tracking-wide">Segment</th>
                <th scope="col" className="px-3 py-2.5 text-left font-medium uppercase tracking-wide">Values found in your file</th>
                <th scope="col" className="px-4 py-2.5 text-left font-medium uppercase tracking-wide">What it is</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d, slot) => {
                const tally = codes(slot)
                const vals = tally.map(t => t.code)
                const count = valueCounts[slot] ?? 0
                // A dimension beyond where the shortest row reaches cannot be the
                // account, so the option is offered but not selectable, with the
                // reason on it.
                const accountBlocked = slot > accountLimit
                const err = errors[slot]
                return (
                  <tr
                    key={slot}
                    /* Keyed by the answer this row carries, not by its position,
                       because the tour has a card per answer and each one lights
                       the row where that answer is given. Over the example file
                       there is exactly one row per answer; over a real file a key
                       may be worn by several rows or none, which is why the cards
                       stand on the example. */
                    data-walkthrough={
                      d.target.kind === 'account' ? 'dimension-account'
                        : d.target.kind === 'filter' ? 'dimension-filter'
                          : d.target.kind === 'ignore' ? 'dimension-ignore'
                            : undefined
                    }
                    className="border-b border-border-subtle last:border-0 align-middle"
                  >
                    <th scope="row" className="px-4 py-3 text-left">
                      <span className="inline-flex items-center gap-2.5">
                        <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-md border text-13 tabular-nums',
                          PART_TONE[toneForTarget(d.target)])} style={{ fontWeight: 600 }}>{slot + 1}</span>
                        {/* A numbered piece of the number is a segment; "Dimension" is one
                            of the answers it can be given (Mahad, 2026-10-02: *"this should
                            be Segment 1, Segment 2, and so on"*). */}
                        <span className="text-13 text-fg" style={{ fontWeight: 600 }}>Segment {slot + 1}</span>
                      </span>
                    </th>
                    {/* How many distinct codes sit here, then the codes. The
                        count is the file's tally rather than the length of what
                        is listed, so it is passed rather than inferred. */}
                    <td className="px-3 py-3 text-13 text-fg-muted">
                      <DimensionValuesCell values={vals} count={count} />
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={targetToValue(d.target)}
                        onChange={e => onSelect(slot, e.target.value)}
                        placeholder="Choose"
                        /* Only ever set on a dimension with no answer at all, so
                           it can never land between the dropdown and the label
                           field joined to its bottom edge. */
                        error={err?.target}
                        className={cn(d.target.kind === 'filter' && 'rounded-b-none')}
                      >
                        {SLOT_ANSWERS.map(a => (
                          <option
                            key={a.value}
                            value={a.value}
                            disabled={a.value === SLOT_OPTION.account && accountBlocked}
                            data-tip={a.value === SLOT_OPTION.account && accountBlocked
                              ? `Some of your numbers do not reach dimension ${slot + 1}, so this cannot be the GL account number.`
                              : a.tip}
                          ><span className="inline-flex items-center gap-2">{a.icon}{a.label}</span></option>
                        ))}
                      </Select>
                      {/* Under the dropdown rather than in its own column, so the
                          label reads as the answer being finished rather than as
                          a fourth thing every row is asked. Joined to it on a
                          shared border seam and shorter than a full field, so the
                          answer grows into a second line rather than a separate
                          control landing under it. */}
                      {d.target.kind === 'filter' && (
                        <div className="coa-slot-label-in -mt-px">
                          <div className="overflow-hidden">
                            <input
                              value={d.target.name}
                              onChange={e => setTarget(slot, { kind: 'filter', name: e.target.value })}
                              placeholder={`Label, e.g. ${slot === 0 ? 'Location' : 'Department'}`}
                              aria-label={`Label for dimension ${slot + 1}`}
                              className={cn('input h-8 text-13 w-full bg-white rounded-t-none relative focus:z-10',
                                err?.label && 'border-danger-500 focus:border-danger-500 z-10')}
                              autoFocus
                            />
                          </div>
                          {err?.label && <p className="mt-1 text-2xs text-danger-700">{err.label}</p>}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Rows shorter than the rest leave a code over, and where the account is
          leftmost there can be more than one dimension it could have come from.
          The question is which one, asked once per code rather than once per row,
          because the same short shape recurs all the way down a file.

          A guess is already in place for every one of these, so the step is never
          blocked by them: this is an offer to correct a guess. */}
      {!refusal && questions.length > 0 && (
        <div className="rounded-xl border border-border bg-white overflow-clip">
          <div className="px-4 py-2.5 bg-warning-50/60 border-b border-border">
            <span className="block text-13 text-fg" style={{ fontWeight: 600 }}>
              Some numbers are missing a dimension, and we had to guess which one
            </span>
            <span className="block mt-0.5 text-11 text-fg-muted">
              These values could belong to more than one dimension. We used the first, which you can change. Nothing else in your file is affected.
            </span>
          </div>
          {questions.map((q, i) => (
            <div key={q.code} className={cn('px-4 py-2 flex items-center gap-3', i > 0 && 'border-t border-border')}>
              <span className="w-[64px] shrink-0 inline-flex items-center justify-center rounded-md border border-border-strong border-dashed bg-white px-2 py-0.5 text-13 text-fg tabular-nums" style={{ fontWeight: 600 }}>
                {q.code}
              </span>
              <span className="flex-1 min-w-0 text-13 text-fg-muted tabular-nums">
                on {q.rows.length} row{q.rows.length === 1 ? '' : 's'}
              </span>
              <div className="w-[220px] shrink-0">
                <Select
                  value={choices[q.code] === undefined ? '' : String(choices[q.code])}
                  onChange={e => onChoose(q.code, Number(e.target.value))}
                  placeholder={`${partLabel(q.slots[0])} (guessed)`}
                  aria-label={`Which dimension the value ${q.code} belongs to`}
                >
                  {q.slots.map(slot => (
                    <option key={slot} value={String(slot)}>{partLabel(slot)}</option>
                  ))}
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// =========================
// The chart, as imported
// =========================
/* A read-only look at the chart with the imported accounts in it. Reached from the
   summary, and the last stop before the reader leaves for the listing.

   It is drawn by the same PreviewChartTable the create and edit placement preview
   uses, so the two read as one picture of the same chart rather than this one
   borrowing the working listing's chrome - a toolbar, hover, kebabs - and reading
   as a second place to work. Every account is shown, laid out parents before their
   children with the list view's vertical nesting guides; nothing here collapses or
   is clickable.

   The dimensions column is the point of the screen: it is the one thing the
   reader answered three steps about and cannot check anywhere else in the flow, so
   a preview without it would be a picture of the easy half of the import. It is
   dropped only when no account carries one, where it would head an empty column. */

/* The pill on an account the import could not finish. Its twin on the chart
   listing reads "Needs action" and opens the form that answers it; this one
   cannot, because nothing on a preview is clickable, so it says what is missing
   instead of promising something to do about it. Every other marker the listing
   puts beside a name is left off: on a screen whose whole subject is a set of
   accounts that just arrived, a chip on each of them saying so says nothing. */
function NeedsBankDetailsPill() {
  return (
    <span className="badge-warning shrink-0 whitespace-nowrap">
      Needs bank details
    </span>
  )
}

function ChartPreviewStep({ accounts, scheme, onBackToReview }: { accounts: Account[]; scheme: NumberingScheme; onBackToReview: () => void }) {
  /* Rows already ordered and measured, the way the placement preview measures its
     own: the chart index lays parents out before their children, and each row's
     depth and nesting guides come from the rows on screen - which, here, is every
     account, because a preview does not collapse the thing it is a preview of. */
  const { rows, columns } = useMemo(() => {
    const index = buildChartIndex(accounts)
    const order = index.roots.flatMap(r => [r, ...index.descendantsOf(r.id)])
    // Whether each ancestor still has a row below this one: the trunk carries past
    // the row while it does and closes on its last child. Same rule the list view's
    // `listStructure` states, read off the chart index rather than a filtered view.
    const trunksFor = (a: Account): boolean[] => {
      const chain = [...index.ancestorsOf(a.id)].reverse()
      return chain.map((p, i) => {
        const kids = index.childrenOf(p.id)
        return kids[kids.length - 1]?.id !== (chain[i + 1] ?? a).id
      })
    }
    const rows: PreviewRow[] = order.map(a => ({
      key: a.id,
      account: a,
      depth: index.depthOf(a.id),
      trunks: trunksFor(a),
      badge: needsBankDetails(a) ? <NeedsBankDetailsPill /> : undefined,
    }))
    const withDimensions = accounts.some(a => a.defaultDimensionValues.length > 0)
    const columns: PreviewColKey[] = withDimensions
      ? ['number', 'name', 'glType', 'currency', 'status', 'dimensions']
      : ['number', 'name', 'glType', 'currency', 'status']
    return { rows, columns }
  }, [accounts])
  const numberText = (a: Account) => displayAccountNumber(scheme, a.accountNumber)
  return (
    <div className="flex flex-col flex-1 min-h-0 bg-bg-subtle/40">
      {/* Said in words above the table as well as by the step trail above that.
          A read-only copy of a screen the reader knows as an editable one is the
          one thing a picture cannot say about itself.

          The way back rides inside the sentence that explains why anyone would
          want it, rather than sitting in the footer as a second button beside
          the one thing there is to do here. It is also the only way back for a
          file whose numbers hold no structure: that file never met the dimension
          steps, so it is shown no trail to walk back up.

          Full width, like the chart listing's own warning band: a notice about
          the whole screen is not part of the table it sits above. */}
      <div className="shrink-0 flex items-center gap-2 border-b border-info-100 bg-info-50 px-4 py-2 text-xs text-info-700">
        <Eye size={14} className="shrink-0" />
        <span>
          Preview only. Nothing on this screen can be changed. To change an account,{' '}
          <button type="button" onClick={onBackToReview} className="underline underline-offset-2 hover:no-underline" style={{ fontWeight: 600 }}>
            go back to Review
          </button>.
        </span>
      </div>
      {/* The table is the same card the placement preview draws, scrolling inside
          the step. Nothing frames it further: it carries its own border and would
          only sit inside a second one. */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4">
        <PreviewChartTable rows={rows} columns={columns} numberText={numberText} />
      </div>
    </div>
  )
}


// =========================
// Import complete
// =========================
// Its own dialog rather than a step, so what the import did is stated in front
// of the grid it did it to. Mirrors ConfirmModal's construction (radial glow,
// tinted tile, stacked buttons) at the same z so it clears the FormModal.
/* The four tiles state and do not act. One of them used to be clickable and led
   to the chart of accounts, which is where the green button below it already
   goes: two controls, one destination, and the tile reading as a way to see the
   accounts it counts rather than as a second exit. What the reader actually
   wants after four numbers is to look at the chart, and that is a thing worth
   its own button - so it has one, above the exit rather than inside a tile.

   The order is deliberate: look first, leave second. The grey button is the one
   that keeps you here, and it is the one the reader is most likely to want. */
function ImportDoneDialog({ open, summary, onPreview, onViewImported, firstTime }: {
  open: boolean
  summary: { created: number; updated: number; skipped: number; warnings: number }
  onPreview: () => void
  onViewImported: () => void; firstTime?: boolean
}) {
  if (!open) return null
  const updated = summary.updated > 0
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
      <div className="absolute inset-0 coa-scrim animate-overlay-in" />
      <div className="relative w-full max-w-[460px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col items-center animate-modal-in">
        <div className="absolute inset-x-0 top-0 h-44 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 120% 60% at 50% 0%, #10B981 0%, transparent 70%)', opacity: 0.14 }} />
        <div className="relative flex flex-col items-center w-full px-8 pt-8 pb-5">
          <div className="flex items-center justify-center rounded-2xl w-16 h-16 mb-3 bg-success-500/10 text-success-600">
            <CheckCircle2 size={30} />
          </div>
          <div className="text-2xs font-semibold uppercase tracking-[0.08em] mb-3 text-success-700">Complete</div>
          {/* A second pass is a different event and says so. Standing on "Import
              complete" over a run whose only work was patching four accounts
              would have the reader looking for accounts nobody added. */}
          <h3 className="text-lg font-semibold text-fg text-center mb-1.5">{updated ? 'Update complete' : 'Import complete'}</h3>
          <p className="text-sm text-fg-muted text-center leading-relaxed">
            {updated
              ? `${summary.updated} account${summary.updated === 1 ? '' : 's'} in your chart ${summary.updated === 1 ? 'was' : 'were'} changed.`
              : `${summary.created} account${summary.created === 1 ? '' : 's'} ${summary.created === 1 ? 'was' : 'were'} added to your chart.`}
          </p>
        </div>
        <div className="relative w-full px-8">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Accounts created" value={summary.created} />
            <StatCard label="Accounts updated" value={summary.updated} />
            <StatCard label="Rows skipped" value={summary.skipped} />
            <StatCard label="Warnings" value={summary.warnings} />
          </div>
        </div>
        <div className="relative w-full px-8 pb-7 pt-5 space-y-2.5">
          <button
            onClick={onPreview}
            className="w-full h-11 rounded-xl text-sm font-semibold text-fg bg-bg-subtle border border-border hover:bg-bg-muted transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Eye size={15} className="text-fg-subtle" /> Preview my chart
          </button>
          <button
            onClick={onViewImported}
            className="w-full h-11 rounded-xl text-sm font-semibold text-white bg-success-600 hover:bg-success-700 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            {firstTime ? 'Go to chart of accounts' : 'View accounts listing'} <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* A number and what it counts. Not a button: every one of these is a fact about
   a run that has finished, and there is nothing left for a click to do to it. */
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border px-4 py-3 text-left">
      <span className="text-xs text-fg-muted">{label}</span>
      <div className="text-2xl font-semibold text-fg tabular-nums mt-1">{value}</div>
    </div>
  )
}
