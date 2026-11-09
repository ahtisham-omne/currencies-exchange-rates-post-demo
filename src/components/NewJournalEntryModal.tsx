import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { DimensionPills } from './AccountTable'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus, Trash2, Scale, Check, AlertTriangle, Lock } from 'lucide-react'
import { FormModal, ConfirmModal, Button, Select, AmountInput, Badge, Banner, Textarea, HowItWorksButton, Tooltip, useMediaQuery } from './ui'
import { AttachmentDropzone, type AttachmentFile } from './AttachmentsTab'
import { DateField } from './DateField'
import { NotifyRecipientsPicker, notifyRecipients } from './NotifyRecipientsPicker'
import { TagInputField } from './EntityTagChip'
import { buildChartIndex } from '../lib/chartTree'
import { useStore } from '../store'
import { isRetainedEarningsAdjustments } from '../lib/accountLifecycle'
import { ACCOUNT_TYPE_META, type Account, type Transaction } from '../types'
import { adjustmentAccountNote, adjustmentKind, unpostableReason, dimensionsOfAccount, firstPostableDate, isPartialJeLine, journalEntryProblems, manualPostingLock, nextJeNumber, periodForDate, periodPostingBlock, toBaseLines, type AdjustmentKind } from '../lib/journalEntry'
import { defaultValueOf, valuesByDimension } from '../lib/dimensionDefaults'
import { CURRENCY_META, RATE_AS_OF, RATE_SOURCE, currencyMeta, formatRate } from '../lib/currencies'
import { ReadingRoom } from './walkthrough/ReadingRoom'
import { MANUAL_ENTRIES_GUIDE, RETAINED_EARNINGS_GUIDE, SYSTEM_ACCOUNTS_GUIDE } from '../lib/journalGuides'
import { jumpToError } from '../lib/formErrors'
import { cn, currencySymbol, fmtCurrency, fmtCurrencyExact, fmtDate, uid } from '../lib/utils'
import { CurrencyFlag } from './CurrencyFlag'

interface DraftLine { key: string; accountId: string; debit: string; credit: string; description: string; dimensionValues: { dimensionId: string; value: string }[] }
const blankLine = (): DraftLine => ({ key: uid('ln'), accountId: '', debit: '', credit: '', description: '', dimensionValues: [] })

const amt = (s: string) => Number(s) || 0
/* Which side a line sits on. Null while it's still blank, which is why an
   untouched line renders flush rather than guessing at an indent. */
const sideOf = (l: DraftLine): 'debit' | 'credit' | null =>
  amt(l.debit) > 0 ? 'debit' : amt(l.credit) > 0 ? 'credit' : null

const AMOUNT_CLS = 'w-full h-8 pr-2 rounded-md border text-[13px] text-right tabular-nums outline-none transition-colors'

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Create a manual journal entry. The period is derived from the date rather than
// picked, so the two can never disagree - the same invariant the seed asserts.
// Balance is tracked continuously in a reconciliation strip modelled on Cash
// Management's split panel: it names the shortfall and the side that closes it,
// and Post is disabled until it clears. Every other problem (date, half-filled
// lines) is raised on press instead, so an entry still being typed isn't scolded.
export function NewJournalEntryModal({ open, onClose, prefillAccountId }: {
  open: boolean
  onClose: () => void
  /* An account to open the first line on, for the callers that ask for an entry
     from somewhere that already names one - the row menu on the chart, the
     account page. Read at mount, so the caller mounts this when the request is
     made rather than keeping it open and swapping the id underneath. */
  prefillAccountId?: string
}) {
  const navigate = useNavigate()
  const accounts = useStore(s => s.accounts)
  const dimensions = useStore(s => s.dimensions)
  // For naming a dimension where a line offers a choice of its values.
  const dimensionName = useMemo(() => new Map(dimensions.map(d => [d.id, d.name])), [dimensions])
  /* A deactivated dimension is not offered on a new line. The account keeps the
     value, and every posting already booked with it keeps it; a new posting
     just doesn't pick it up (decision 89; module review, 2026-10-06, COA-02). */
  const activeDimensionIds = useMemo(() => new Set(dimensions.filter(d => d.status === 'Active').map(d => d.id)), [dimensions])
  const lineDimensionsOf = (a?: Account) => dimensionsOfAccount(a).filter(v => activeDimensionIds.has(v.dimensionId))
  const withActiveDimensions = (a?: Account): Account | undefined =>
    a && { ...a, defaultDimensionValues: a.defaultDimensionValues.filter(v => activeDimensionIds.has(v.dimensionId)) }
  const periods = useStore(s => s.periods)
  const base = useStore(s => s.company.baseCurrency)
  const pushToast = useStore(s => s.pushToast)
  const addJournalEntry = useStore(s => s.addJournalEntry)
  const addCommThread = useStore(s => s.addCommThread)
  const setEntryTags = useStore(s => s.setEntryTags)
  const journalEntries = useStore(s => s.journalEntries)
  const transactions = useStore(s => s.transactions)
  /* Every number already handed out, read from both sides: a seeded posting can
     carry a number no entry record claims, and the ledger groups on the posting. */
  const issuedJeNumbers = useMemo(
    () => new Set([...journalEntries.map(e => e.reference), ...transactions.map(t => t.jeNumber)]),
    [journalEntries, transactions])

  const accountById = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts])
  const [reason, setReason] = useState('')
  /* Which guide is open, if any: journal entries in general from the header,
     or the one the adjustment flow's Learn more names. */
  const [guide, setGuide] = useState<'entries' | AdjustmentKind | null>(null)
  /* Who hears about the entry once it posts: people or roles, picked the way the
     rest of Omne picks notification recipients. Optional on any entry; offered
     with the adjustment flow's warning tint when the entry is an adjustment. */
  const [recipients, setRecipients] = useState<Set<string>>(new Set())

  /* The account picker mirrors the parent picker on the create form: summary
     accounts as non-selectable branch labels, posting accounts selectable and
     indented under the summary they hang from. Order and depth both come from the
     one chart index, so the tree here and in the Chart of Accounts cannot drift.
     Every account is listed, not just summaries and postings: leaving a level out
     drops the indent for everything below it.

     Only accounts in service are listed. A deactivated or archived account, and
     everything under one, is left out, and a deleted one no longer exists.
     Mahad, 2026-10-08: *"the dropdown shouldn't contain any archived, deactive,
     or delete accounts."* (They used to be listed greyed, with the reason.) A
     summary left with nothing selectable under it is dropped by the empty-branch
     pruning below.

     Of what is listed, only a summary is unselectable (Mahad, 2026-10-09: *"Only
     make summary accounts unselectable. all the others can be select, do not
     add any other validation here"*). Retained earnings' system account used to
     be listed locked to the year-end close; it is picked like any other now, and
     opens the adjustment flow as retained earnings always has. A summary's
     option says in its hover why it cannot be picked.

     Retained earnings and the control accounts are offered like any other, marked
     so they read apart. Picking one is what brings up the adjustment flow below
     the lines - see `adjustmentKind`. */
  const accountTree = useMemo(() => {
    const index = buildChartIndex(accounts)
    const inService = (a: Account) => a.status === 'Active' && index.ancestorsOf(a.id).every(p => p.status === 'Active')
    return index.roots
      .flatMap(r => [r, ...index.descendantsOf(r.id)])
      .filter(inService)
      .map(a => {
        const isGroup = !a.isPosting
        const note = isGroup ? undefined : adjustmentAccountNote(adjustmentKind(a), a)
        // Posting options carry their category too, so the right account can be
        // picked without leaving the field. Group labels stay short.
        const label = isGroup
          ? `${a.accountNumber} · ${a.accountName}`
          : [a.accountNumber, a.accountName, ACCOUNT_TYPE_META[a.accountType].label].join(' · ')
        // The mark rides as the option's second line, shown in the open list
        // only, so a picked line reads as the account and nothing more.
        // Why a summary greys out, for the option's hover; see `unpostableReason`.
        const why = isGroup ? unpostableReason(a) : undefined
        return { id: a.id, label, note, why, depth: index.depthOf(a.id), group: isGroup }
      })
  }, [accounts])

  /* Now that the period is derived, an empty date is a trap: today's date can
     easily fall outside every defined period, so the first thing the user tries
     is rejected. Open on a date that actually posts. Shared with the reversal,
     which has the same problem and no field to raise it in. */
  const defaultDate = useMemo(() => firstPostableDate(periods), [periods])

  const [date, setDate] = useState(defaultDate)
  const [memo, setMemo] = useState('')
  /* The currency the lines are typed in. Mahad, 2026-09-30: *"Field for currency
     on the journal entry"*, entered in that currency and posted in base at the
     rate. The ledger holds base figures only, so a foreign entry is converted as
     it posts (`toBaseLines`) and keeps the currency, the rate and the typed
     amounts on its postings. The rate is the spot rate the module carries -
     one rate per currency, as of RATE_AS_OF - and the form says so rather than
     passing it off as the rate of the entry's date. */
  const [currency, setCurrency] = useState(base)
  const foreign = currency !== base
  // Units of the entry's currency per one of base.
  const rate = currencyMeta(currency).rate / currencyMeta(base).rate
  const symbol = currencySymbol(currency)
  const [tags, setTags] = useState<string[]>([])
  /* Two lines, the first of them on the account the caller named. An account
     taken out of service is not prefilled: the picker does not offer it, and
     starting the entry already on it would open on a line that cannot post. The
     reader picks their way out from a blank one instead. Retained earnings is
     prefilled like any account, and opens on the adjustment flow. */
  const startingLines = (): DraftLine[] => {
    const first = blankLine()
    const a = prefillAccountId ? accounts.find(x => x.id === prefillAccountId) : undefined
    if (!a || !a.isPosting || manualPostingLock(a)) return [first, blankLine()]
    return [{ ...first, accountId: a.id, dimensionValues: lineDimensionsOf(a) }, blankLine()]
  }
  const [lines, setLines] = useState<DraftLine[]>(startingLines)
  /* Lines the user has left, so a half-filled row isn't scolded while it's
     still being typed into. */
  const [touched, setTouched] = useState<Set<string>>(new Set())
  // A laptop-sized window: narrower than 1280px or shorter than 760px.
  const compactScreen = useMediaQuery('(max-width: 1279px), (max-height: 759px)')
  /* Whether Post has been pressed. Nothing is listed before it is - an entry
     being filled in isn't wrong yet, it's unfinished. After it, the list stays
     and shrinks as each problem is fixed, so a reader working through three of
     them doesn't lose the other two the moment they touch the first. */
  const [attempted, setAttempted] = useState(false)
  /* Supporting documents staged with the entry - the invoice or schedule that
     justifies it. They travel with the post so the posted entry opens with its
     paper trail already attached. */
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])

  const reset = () => { setDate(defaultDate); setMemo(''); setCurrency(base); setTags([]); setLines(startingLines()); setTouched(new Set()); setAttempted(false); setAttachments([]); setReason(''); setRecipients(new Set()) }
  const close = () => { reset(); onClose() }
  /* Leaving an entry with anything typed into it asks first, as Create GL
     account does. Module review, 2026-10-06 (COA-27): one stray click on Cancel
     threw away a multi-line entry. An entry opened on an account and left as it
     opened has nothing to lose, so it closes at once. */
  const [discardOpen, setDiscardOpen] = useState(false)
  const opened = startingLines()
  const entryDirty = date !== defaultDate || memo.trim() !== '' || currency !== base || tags.length > 0
    || attachments.length > 0 || reason.trim() !== '' || recipients.size > 0
    || lines.length !== opened.length
    || lines.some((l, i) => l.accountId !== opened[i].accountId || l.debit !== '' || l.credit !== '' || l.description.trim() !== '')
  const requestClose = () => { if (entryDirty) { setDiscardOpen(true); return } close() }

  const setLine = (key: string, patch: Partial<DraftLine>) => setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l))
  /* Pick a posting account and its dimensions come with it. There is nothing to
     merge and nothing to preserve: the values belong to the account, so
     re-picking replaces them outright rather than leaving the previous account's
     behind. */
  const setLineAccount = (key: string, accountId: string) => setLines(prev => prev.map(l => {
    if (l.key !== key) return l
    return { ...l, accountId, dimensionValues: lineDimensionsOf(accounts.find(a => a.id === accountId)) }
  }))
  /* Another of the account's values for one dimension, on this line only. The
     account keeps its default; the next line on it starts there again. */
  const setLineDimension = (key: string, dimensionId: string, value: string) => setLines(prev => prev.map(l => {
    if (l.key !== key) return l
    const rest = l.dimensionValues.filter(d => d.dimensionId !== dimensionId)
    return { ...l, dimensionValues: value ? [...rest, { dimensionId, value }] : rest }
  }))
  const addLine = () => setLines(prev => [...prev, blankLine()])
  const removeLine = (key: string) => setLines(prev => prev.length > 2 ? prev.filter(l => l.key !== key) : prev)
  const touch = (key: string) => setTouched(prev => prev.has(key) ? prev : new Set(prev).add(key))

  const period = periodForDate(date, periods)
  const periodBlock = periodPostingBlock(date, periods)
  /* The number the entry will post under, shown before it does. Pre-filled and
     not editable for now (Mahad, 2026-09-30). The next in the year the date
     falls in, so it follows the date - and Post issues this same number. */
  const jeNumber = nextJeNumber(issuedJeNumbers, date)

  /* The accounts on this entry the system keeps, and so whether it is an
     adjustment at all. Read off the lines, so the flow comes and goes with the
     account: pick retained earnings and it appears, change the line and it goes. */
  const adjustedAccounts = lines
    .map(l => accountById.get(l.accountId))
    .filter((a): a is Account => !!a && !!adjustmentKind(a))
  const adjusting = adjustedAccounts.length > 0
  /* Brought into view when it first appears. It opens below the lines, and on a
     long entry that is below the fold, where a flow that appeared on its own
     would go unseen until Post refused the entry for it. */
  const adjustmentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (adjusting) adjustmentRef.current?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' })
  }, [adjusting])

  const totalDebit = lines.reduce((s, l) => s + amt(l.debit), 0)
  const totalCredit = lines.reduce((s, l) => s + amt(l.credit), 0)
  const difference = Number((totalDebit - totalCredit).toFixed(2))
  const balanced = Math.abs(difference) < 0.005 && totalDebit > 0
  // No amounts yet, so there's nothing to be out of balance about: the strip
  // stays neutral and silent until the first amount is typed.
  const untouchedTotals = totalDebit === 0 && totalCredit === 0
  const filledLines = lines.filter(l => l.accountId && (amt(l.debit) > 0 || amt(l.credit) > 0))

  // A row the user started but didn't finish. Shares its rule with the submit
  // check (isPartialJeLine) so a line's own red state and the submit banner can
  // never disagree about which lines are unfinished.
  const isPartialLine = (l: DraftLine) => isPartialJeLine({ accountId: l.accountId, debit: amt(l.debit), credit: amt(l.credit) })

  /* What each line still owes: its account, its amount, or both. A started line
     owes whichever half is missing. An entry short of two complete lines with
     none started owes them on its blank lines - the first one or two, as many as
     it is short - and those turn red too once Post is pressed. They used to stay
     white, so Post refused the entry and nothing on the lines said where the
     account was missing. Design review, 2026-10-02 - Eli: *"I don't have a second
     account here. So the red should be red around the, you know."* */
  const anyPartial = lines.some(isPartialLine)
  const blanksOwed = !anyPartial && filledLines.length < 2
    ? new Set(lines.filter(l => !l.accountId && !amt(l.debit) && !amt(l.credit)).slice(0, 2 - filledLines.length).map(l => l.key))
    : new Set<string>()
  const lineIssue = (l: DraftLine): 'account' | 'amount' | 'both' | null =>
    isPartialLine(l) ? (l.accountId ? 'amount' : 'account') : blanksOwed.has(l.key) ? 'both' : null


  /* Everything standing between this entry and the ledger, in the order the
     reader would work down the form, each naming the fix rather than the rule.
     Computed by the shared helper so the banner, the field states and the Post
     guard read one list; the field on each ties a message back to the control it
     belongs to, so the banner and that control's red state can't disagree.
     Balance isn't among them: the live bar under the lines states the shortfall
     and the side that closes it, and Post stays disabled until it clears. */
  const problems = journalEntryProblems({
    date,
    periodBlock: periodBlock || undefined,
    lines: lines.map(l => ({ accountId: l.accountId, debit: amt(l.debit), credit: amt(l.credit) })),
    adjustment: adjusting,
    reason,
  })

  /* Out of balance is one more thing to fix, not a reason to grey Post out: a
     dead button says nothing. Design review, 2026-09-30 - Eli: *"I shouldn't end
     up with a dead button here ... it should jump to the area."* Left out while
     no amount is typed, since the lines problem already says what is missing.

     In page order - the date, the lines, the totals under them, then the reason
     below - because Post takes the reader to the first of these, and the banner
     reads as the same list worked down the same page. */
  const imbalance = balanced || untouchedTotals
    ? []
    : [{ field: 'balance' as const, message: `Debits and credits must match. They are ${fmtCurrencyExact(Math.abs(difference), currency)} apart.` }]
  const blockers = [...problems.filter(p => p.field !== 'reason'), ...imbalance, ...problems.filter(p => p.field === 'reason')]

  const shown = attempted ? blockers : []
  const dateFlagged = shown.some(p => p.field === 'date')
  const reasonError = shown.find(p => p.field === 'reason')?.message

  /* A refused Post takes the reader to the first thing left to fix, in page
     order, and rings it - every press, the first one still wrong, so working
     down the form is pressing Post and fixing what it lands on. The design
     system's error rule; see lib/formErrors.ts. */
  const onPost = () => {
    if (!blockers.length) { doPost(); return }
    setAttempted(true)
    // Every row counts as left now, so the incomplete ones turn red alongside
    // the banner rather than waiting to be visited.
    setTouched(new Set(lines.map(l => l.key)))
    const first = blockers[0].field
    const owing = lines.find(l => lineIssue(l))
    const target = first === 'lines' && owing
      ? `line-${owing.key}-${lineIssue(owing) === 'amount' ? 'amount' : 'account'}`
      : first
    // After the render that turns the fields red, so the ring lands on them. A
    // timer rather than an animation frame, which a hidden tab never runs.
    window.setTimeout(() => jumpToError(document.querySelector<HTMLElement>(`[data-je-target="${target}"]`)), 0)
  }

  /* Drop the difference onto the side that's short. Reuses the last line when
     it's still blank, otherwise appends - so it's always a legal move, unlike
     filling in place when that side is already greyed out. */
  const balancingSide: 'debit' | 'credit' = difference > 0 ? 'credit' : 'debit'
  const addBalancingLine = () => {
    const value = Math.abs(difference).toFixed(2)
    setLines(prev => {
      const last = prev[prev.length - 1]
      const lastIsBlank = last && !last.accountId && !last.debit && !last.credit && !last.description
      if (lastIsBlank) return prev.map(l => l.key === last.key ? { ...l, [balancingSide]: value } : l)
      return [...prev, { ...blankLine(), [balancingSide]: value }]
    })
  }

  const doPost = () => {
    const periodLabel = period?.label ?? ''
    const entryType = filledLines.length > 2 ? 'Compound' : 'Simple'
    /* The reason travels on every posting, like the memo, so it is there
       wherever the entry is read - the entry page, its activity, a notification. */
    const adjustmentReason = adjusting ? reason.trim() : undefined
    const fullMemo = memo.trim()
    // The lines as typed, and the base figures they post at.
    const posted = toBaseLines(filledLines.map(l => ({ line: l, debit: amt(l.debit), credit: amt(l.credit) })), rate)
    const lineDefs = posted.map(p => ({ accountId: p.line.accountId, debit: p.baseDebit, credit: p.baseCredit }))
    // When it was written, apart from the date it is dated.
    const createdAt = new Date().toISOString()
    const entryTxns: Transaction[] = posted.map(({ line: l, debit, credit, baseDebit, baseCredit }) => ({
      createdAt, createdBy: 'Ahtisham Ahmad (You)',
      id: uid('txn'), accountId: l.accountId, date, source: 'Manual JE', jeNumber, reference: '', entryType,
      // The memo describes the entry and the description describes the line, so
      // a line the user left blank stays blank rather than parroting the memo.
      // Kept even when blank: a written entry's empty memo is not a seeded one's
      // missing memo, which borrows its narration (see `entryMemo`).
      // No entry title: the form stopped asking for one (see the fields below), so
      // the entry is named the way every untitled manual entry is.
      description: l.description, memo: fullMemo, adjustmentReason,
      debit: baseDebit, credit: baseCredit,
      ...(foreign ? { entryCurrency: currency, entryRate: rate, fxDebit: debit, fxCredit: credit } : {}),
      runningBalance: 0, dimensionValues: l.dimensionValues, period: periodLabel,
    }))
    addJournalEntry(
      { id: uid('je'), date, reference: jeNumber, description: 'Manual journal entry', status: 'Posted', lines: lineDefs },
      entryTxns,
      // Stamp the staged files with the entry's own date so the Attachments tab
      // dates them to the entry, not to the moment they were picked.
      attachments.map(f => ({ ...f, id: String(f.id), date, uploadedBy: 'Ahtisham Ahmad (You)' })),
    )
    if (tags.length) setEntryTags(jeNumber, tags)
    /* The notification goes out as an email on the entry itself, so it is on the
       entry's Communications tab for anyone who opens it later - who was told,
       and what they were told - not only in the recipients' inboxes. */
    const told = notifyRecipients(recipients)
    if (told.names.length) {
      const lineText = filledLines.map(l => {
        const a = accountById.get(l.accountId)
        const side = amt(l.debit) > 0 ? `debit ${fmtCurrencyExact(amt(l.debit), currency)}` : `credit ${fmtCurrencyExact(amt(l.credit), currency)}`
        return `- ${a ? `${a.accountNumber} ${a.accountName}` : 'Account'}: ${side}`
      })
      const body = [
        `A manual journal entry was posted to ${periodLabel || 'the ledger'}, dated ${fmtDate(date)}.`,
        '',
        `${fmtCurrencyExact(totalDebit, currency)}${foreign ? ` (${fmtCurrencyExact(lineDefs.reduce((t, l) => t + l.debit, 0), base)} at ${formatRate(rate)} ${currency} to the ${base})` : ''} across ${filledLines.length} lines:`,
        ...lineText,
        ...(memo.trim() ? ['', `Memo: ${memo.trim()}`] : []),
        ...(adjustmentReason ? ['', `It adjusts ${adjustedAccounts.map(a => `${a.accountNumber} ${a.accountName}`).join(' and ')}. Reason: ${adjustmentReason}`] : []),
      ].join('\n')
      addCommThread({
        id: uid('thread'),
        subjectId: jeNumber,
        entityType: 'Journal Entry',
        entityRef: jeNumber,
        entityLabel: jeNumber,
        subject: adjusting ? `Adjustment posted: ${jeNumber}` : `Journal entry ${jeNumber} posted`,
        lastSender: '', lastSenderEmail: '', bodyPreview: '', lastDate: '', dateIso: '',
        isUnread: false, hasAttachments: false, attachmentCount: 0,
        first: { channel: 'Email', to: told.names.join(', '), toEmail: told.emails.join(', '), body },
      })
    }
    const fileNote = attachments.length ? ` · ${attachments.length} ${attachments.length === 1 ? 'file' : 'files'}` : ''
    const toldNote = told.names.length ? ` · notified ${told.names.length === 1 ? told.names[0] : `${told.names.length} recipients`}` : ''
    pushToast(`Posted ${jeNumber}`, 'success', `${filledLines.length} lines · ${fmtCurrencyExact(totalDebit, currency)}${fileNote}${toldNote}`)
    close()
    navigate(`/general-ledger/entry/${encodeURIComponent(jeNumber)}`)
  }

  return (
    <>
    <FormModal
      open={open}
      onClose={requestClose}
      hideFullView
      widthClass="max-w-[820px]"
      /* Edge to edge on a laptop-sized screen, where the windowed form leaves the
         lines table squeezed. Design review, 2026-09-30 - Eli: *"on a smaller
         display, it's going to be full screen."* */
      autoFull={compactScreen}
      icon={<FileText size={17} />}
      title="New journal entry"
      subtitle="Record a journal entry. Your entry must balance before it can be posted."
      headerActions={<HowItWorksButton open={guide === 'entries'} onClick={() => setGuide(g => (g === 'entries' ? null : 'entries'))} />}
      overlay={
        <ReadingRoom
          open={!!guide}
          onClose={() => setGuide(null)}
          config={guide === 'retained-earnings' ? RETAINED_EARNINGS_GUIDE : guide === 'control' ? SYSTEM_ACCOUNTS_GUIDE : MANUAL_ENTRIES_GUIDE}
        />
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={requestClose}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onPost}
          >
            Post journal entry
          </Button>
        </>
      }
    >
      <div className="px-5 py-5 space-y-4">
        {/* Date, number and currency, then memo and tags. The period isn't a field -
            it follows from the date. There is no Description: an entry's text is its
            memo and its lines' descriptions (Mahad, 2026-09-30). Memo keeps the
            full width: narrower, its hint wraps and the box opens two lines tall. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div data-je-field="date">
            <label className="text-[10.5px] uppercase tracking-wide text-fg-muted block mb-1.5" style={{ fontWeight: 700, letterSpacing: '0.06em' }}>
              Date <span className="text-danger-600">*</span>
            </label>
            {/* The label above is not tied to the trigger - the trigger is a
                button, not an input - so it carries the name itself. */}
            <div data-je-target="date" className="rounded-lg">
              <DateField ariaLabel="Date" value={date || null} onChange={iso => setDate(iso)} placeholder="Select date"
                triggerClassName={cn('w-full h-9 px-3 rounded-lg border text-sm text-fg text-left transition-colors',
                  periodBlock || dateFlagged ? 'border-danger-500' : 'border-border hover:border-primary/50')} />
            </div>
            {/* The period the date lands in, stated rather than picked, so an
                entry can't be typed into the wrong month unnoticed. */}
            {period && !periodBlock && (
              <p className="mt-1.5 text-2xs leading-snug text-fg-muted">Posting period: <span className="text-fg" style={{ fontWeight: 600 }}>{period.label}</span></p>
            )}
            {periodBlock && <p className="mt-1.5 text-2xs leading-snug text-danger-600">{periodBlock}</p>}
          </div>
          <div>
            <label className="text-[10.5px] uppercase tracking-wide text-fg-muted block mb-1.5" style={{ fontWeight: 700, letterSpacing: '0.06em' }}>
              Journal entry number
            </label>
            {/* Stated, not typed: the module's locked-field look, the padlock
                carrying the reason, as the account form's locked fields do. */}
            <div aria-label="Journal entry number" className="input rounded-lg flex items-center justify-between gap-2 bg-bg-subtle/60 text-fg-muted cursor-default select-none tabular-nums">
              <span className="truncate">{jeNumber}</span>
              <Tooltip content="Given by the system, the next in sequence for the entry's year." side="top" align="right">
                <span className="inline-flex shrink-0 cursor-help text-fg-subtle/60 hover:text-fg-subtle"><Lock size={13} /></span>
              </Tooltip>
            </div>
          </div>
          <div>
            <label className="text-[10.5px] uppercase tracking-wide text-fg-muted block mb-1.5" style={{ fontWeight: 700, letterSpacing: '0.06em' }}>
              Currency <span className="text-danger-600">*</span>
            </label>
            <Select
              searchable
              ariaLabel="Currency"
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="!h-9 !rounded-lg"
              searchPlaceholder="Search currency"
            >
              {/* Flag first, as the chart's Currency column draws it, then the code and name.
                  The flag is a picture (CurrencyFlag), never the emoji, which Windows
                  draws as two letters. */}
              {Object.values(CURRENCY_META).map(c => <option key={c.code} value={c.code} data-icon={<CurrencyFlag meta={c} />}>{`${c.code} · ${c.name}`}</option>)}
            </Select>
            {/* The rate it posts at, and where the rate comes from. */}
            {foreign && (
              <p className="mt-1.5 text-2xs leading-snug text-fg-muted">
                Posts in {base} at <span className="text-fg tabular-nums" style={{ fontWeight: 600 }}>1 {base} = {formatRate(rate)} {currency}</span>. {RATE_SOURCE}, {RATE_AS_OF}.
              </p>
            )}
          </div>
          <div className="md:col-span-3">
            <label className="text-[10.5px] uppercase tracking-wide text-fg-muted flex items-baseline gap-1.5 mb-1.5" style={{ fontWeight: 700, letterSpacing: '0.06em' }}>
              Memo
              <span className="normal-case text-[10.5px] text-fg-subtle" style={{ fontWeight: 500, letterSpacing: 0 }}>optional</span>
            </label>
            {/* The design system's text box: an input's height to begin with, and
                growing with the text rather than scrolling inside itself once it
                runs past the width. Design review, 2026-09-28 - Eli: *"as I type
                in, if it expands, the box should expand with it."* */}
            <Textarea autoGrow aria-label="Memo" value={memo} onChange={e => setMemo(e.target.value)} placeholder="Notes for whoever reads this later: why it was posted, where the figures came from"
              className="rounded-lg focus:border-primary" />
          </div>
          <div className="md:col-span-3">
            <label className="text-[10.5px] uppercase tracking-wide text-fg-muted flex items-baseline gap-1.5 mb-1.5" style={{ fontWeight: 700, letterSpacing: '0.06em' }}>
              Tags
              <span className="normal-case text-[10.5px] text-fg-subtle" style={{ fontWeight: 500, letterSpacing: 0 }}>optional</span>
            </label>
            <TagInputField tags={tags} onChange={setTags} />
          </div>
        </div>

        {/* Lines */}
        <div data-je-field="lines" className="rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border bg-bg-subtle">
            <span className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Scale className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[12px] text-fg leading-tight" style={{ fontWeight: 600 }}>Journal lines</h3>
              <p className="text-[11px] text-fg-subtle mt-0.5 leading-snug">Each line can contain either a debit or a credit.</p>
            </div>
            {/* Live reconciliation chip, echoing Cash Management's header
                accessory - the running verdict rides at the top of the card so
                it's visible before scrolling down to the totals. Keyed on the
                verdict so it pops when it flips to balanced. */}
            {(totalDebit > 0 || totalCredit > 0) && (
              <span
                key={balanced ? 'balanced' : 'off'}
                className={cn('ml-auto shrink-0 inline-flex items-center gap-1.5 h-6 pl-2 pr-2.5 rounded-full border text-[11px] tabular-nums transition-colors',
                  !reducedMotion() && 'animate-[pop_220ms_ease-out]',
                  balanced ? 'border-success-200 bg-success-50 text-success-700' : 'border-danger-200 bg-danger-50 text-danger-700')}
                style={{ fontWeight: 600 }}>
                {balanced
                  ? <><Check className="w-3 h-3" /> Balanced</>
                  : <>Out of balance by {fmtCurrencyExact(Math.abs(difference), currency)} · add a {balancingSide}</>}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            {/* Fixed layout, so a long account name truncates in its picker
                instead of widening the column and pushing the amounts off the
                modal (Mahad, 2026-10-02). */}
            <table className="w-full table-fixed text-[13px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase text-fg-muted border-b border-border" style={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                  <th className="px-4 py-2 w-[44%]">Account</th>
                  <th className="px-3 py-2">Line description</th>
                  {/* The two amount columns are padded towards each other so
                      they read as one money pair rather than two lone columns
                      stranded at the right edge. */}
                  <th className="pl-3 pr-1.5 py-2 text-right w-[112px]">Debit</th>
                  <th className="pl-1.5 pr-3 py-2 text-right w-[112px]">Credit</th>
                  <th className="px-2 py-2 w-9" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const side = sideOf(l)
                  /* Red once the reader has left a started line, or once Post
                     has been pressed - then on every line that owes something. */
                  const issue = lineIssue(l)
                  const flagged = !!issue && (attempted || (touched.has(l.key) && isPartialLine(l)))
                  const accountFlag = flagged && issue !== 'amount'
                  const amountFlag = flagged && issue !== 'account'
                  /* This line's options: the shared tree, with any summary label
                     left with nothing under it dropped so no empty branch is
                     shown. An account already on another line is offered too:
                     nothing but a summary is held back (Mahad, 2026-10-09). */
                  const avail = accountTree
                  const accountRows = avail.filter((r, idx) => {
                    if (!r.group) return true
                    for (let j = idx + 1; j < avail.length; j++) {
                      if (avail[j].group && avail[j].depth <= r.depth) break
                      if (!avail[j].group) return true
                    }
                    return false
                  })
                  return (
                    <Fragment key={l.key}>
                    {/* coa-acct-in plays once per row mount - a soft slide-in on
                        open and whenever a line is added, staggered so the two
                        opening rows cascade rather than snap. */}
                    <tr
                      className={cn('group hover:bg-bg-subtle/40 transition-colors border-b border-border-subtle', !reducedMotion() && 'coa-acct-in')}
                      style={!reducedMotion() ? { animationDelay: `${Math.min(i, 6) * 40}ms` } : undefined}>
                      {/* Credit accounts are indented, the paper-journal
                          convention. The indent lives inside the cell so the
                          Debit/Credit columns stay aligned down the page. */}
                      <td className="px-4 py-2 align-top">
                        <div className={cn('min-w-0 transition-[padding] duration-200', side === 'credit' && 'pl-5')}>
                          <div data-je-target={`line-${l.key}-account`} className="rounded-md">
                          <Select
                            searchable
                            menuMinWidth={340}
                            placeholder="Search account by name or number"
                            searchPlaceholder="Search account by name or number"
                            className={cn('!h-8 !text-[13px] !pl-2 !pr-8 !rounded-md', accountFlag && '!border-danger-500')}
                            value={l.accountId}
                            onChange={e => setLineAccount(l.key, e.target.value)}
                          >
                            {accountRows.map(r => <option key={r.id} value={r.id} data-depth={r.depth} data-desc={r.note} data-tip={r.why} disabled={r.group}>{r.label}</option>)}
                          </Select>
                          </div>
                          {/* The amount is on the line but the account it posts to
                              is not, so the line has no account to move. Named on
                              the row rather than only in the banner, because the row
                              is where the fix is made. */}
                          {flagged && (
                            <p className="mt-1 text-[11px] text-danger-600 leading-snug">
                              {issue === 'account' ? 'Pick the account this line posts to.'
                                : issue === 'amount' ? 'Enter a debit or a credit for this line.'
                                : 'Pick an account and enter an amount for this line.'}
                            </p>
                          )}
                          {/* The dimension values this line takes, right under the
                              account they come from: one per dimension, because one
                              amount lands in one place (Mahad, 2026-10-02). */}
                          <LineDimensions
                            account={withActiveDimensions(accountById.get(l.accountId))}
                            chosen={l.dimensionValues}
                            nameOf={id => dimensionName.get(id) ?? id}
                            onChoose={(dimensionId, value) => setLineDimension(l.key, dimensionId, value)}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input value={l.description} onChange={e => setLine(l.key, { description: e.target.value })} placeholder="Optional, this line only"
                          className="w-full min-w-[120px] h-8 px-2 rounded-md border border-border text-[13px] outline-none focus:border-primary" />
                      </td>
                      {(['debit', 'credit'] as const).map(col => {
                        // Greyed rather than removed: the column still reads as a
                        // column, and clearing the other side re-enables it.
                        const off = !!side && side !== col
                        const other = col === 'debit' ? 'credit' : 'debit'
                        return (
                          // title sits on the cell, not the input - disabled
                          // inputs don't reliably surface their own tooltip.
                          <td key={col} className={cn('py-2 align-top', col === 'debit' ? 'pl-3 pr-1.5' : 'pl-1.5 pr-3')}
                            title={off ? `This line is a ${side}. Clear it to enter a ${col} instead.` : undefined}>
                            <AmountInput
                              value={l[col]}
                              // Dropped on the disabled side: a currency symbol
                              // there would invite typing into a dead field.
                              symbol={off ? undefined : symbol}
                              placeholder={off ? '-' : '0.00'}
                              disabled={off}
                              aria-label={col}
                              data-je-target={col === 'debit' ? `line-${l.key}-amount` : undefined}
                              onBlur={() => touch(l.key)}
                              onChange={v => setLine(l.key, { [col]: v, [other]: v ? '' : l[other] })}
                              className={cn(AMOUNT_CLS,
                                off
                                  ? 'pl-2 border-border-subtle bg-bg-subtle text-fg-subtle/40 cursor-not-allowed'
                                  : cn('bg-white focus:border-primary', amountFlag && !l[col] && !l[other] ? 'border-danger-500' : 'border-border'))}
                            />
                          </td>
                        )
                      })}
                      <td className="px-2 py-2 text-center align-top">
                        <button onClick={() => removeLine(l.key)} disabled={lines.length <= 2}
                          className="p-1 rounded hover:bg-danger-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-0 disabled:cursor-not-allowed"
                          title={lines.length <= 2 ? 'An entry needs at least two lines' : 'Remove line'}>
                          <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-danger-500" />
                        </button>
                      </td>
                    </tr>
                    </Fragment>
                  )
                })}
                <tr>
                  <td colSpan={5} className="px-4 pt-2.5 pb-3">
                    <button onClick={addLine} className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-dashed border-border bg-white text-13 text-primary hover:bg-primary/5 hover:border-primary/40 transition-colors" style={{ fontWeight: 500 }}>
                      <Plus className="w-3.5 h-3.5" /> Add another line
                    </button>
                  </td>
                </tr>
              </tbody>
              {/* Cash Management's reconciliation strip, adapted to a table: the
                  totals belong in the footer so each one sums straight down its
                  own column instead of asking the eye to jump sideways. Colour
                  carries the verdict; the difference is spelled out in prose. */}
              <tfoot>
                <tr className={cn('border-t transition-colors duration-300',
                  untouchedTotals ? 'border-border bg-bg-subtle'
                    : balanced ? 'border-success-100 bg-success-50' : 'border-danger-100 bg-danger-50')}>
                  <td colSpan={2} className="px-4 py-2.5">
                    <div data-je-target="balance" className="flex items-center gap-2.5 flex-wrap rounded-md">
                      {balanced ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-success-700" style={{ fontWeight: 600 }}>
                          <span key="chk" className={cn('inline-flex', !reducedMotion() && 'animate-[pop_260ms_ease-out]')}><Check className="w-3.5 h-3.5" /></span> Balanced
                        </span>
                      ) : !untouchedTotals && (
                        /* Two lines: the shortfall, then the move that closes it,
                           so the fix never has to be worked out from the number. */
                        <span className="text-[12px] text-danger-700" style={{ fontWeight: 600 }}>
                          Out of balance by {fmtCurrencyExact(Math.abs(difference), currency)}
                          <span className="block text-[11px]" style={{ fontWeight: 500 }}>
                            Add a {balancingSide} of {fmtCurrencyExact(Math.abs(difference), currency)} to balance this journal entry.
                          </span>
                        </span>
                      )}
                      {Math.abs(difference) >= 0.005 && (
                        <button type="button" onClick={addBalancingLine}
                          className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-danger-500/30 bg-white text-[11px] text-danger-700 hover:bg-danger-50 transition-colors" style={{ fontWeight: 500 }}>
                          <Plus className="w-3 h-3" /> Add balancing line
                        </button>
                      )}
                    </div>
                  </td>
                  {/* The totals are facts, not the verdict - only the prose above
                      carries colour, so a reader doesn't read a red total as a
                      wrong total. Stated to the cent, because these two are the
                      pair the reader compares: rounded, 12.34 and 12.33 are the
                      same number, and the form is then refusing an entry whose
                      own totals say it balances. */}
                  {([totalDebit, totalCredit] as const).map((total, i) => (
                    <td key={i} className={cn('py-2.5 text-right', i === 0 ? 'pl-3 pr-1.5' : 'pl-1.5 pr-3')}>
                      <div className="text-[10px] text-fg-muted leading-none mb-1" style={{ fontWeight: 600 }}>
                        {i === 0 ? 'Total debits' : 'Total credits'}
                      </div>
                      <span className="text-[13px] tabular-nums text-fg" style={{ fontWeight: 600 }}>
                        {fmtCurrencyExact(total, currency)}
                      </span>
                      {/* What it posts at, in base, once there is a total to convert. */}
                      {foreign && total > 0 && (
                        <div className="text-[10.5px] tabular-nums text-fg-muted mt-0.5">{fmtCurrencyExact(Math.round(total / rate * 100) / 100, base)}</div>
                      )}
                    </td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {adjusting && (
          <AdjustmentFlow
            anchorRef={adjustmentRef}
            accounts={adjustedAccounts}
            reason={reason}
            onReason={setReason}
            onLearnMore={setGuide}
            reasonError={reasonError}
            recipients={recipients}
            onRecipients={setRecipients}
          />
        )}

        {/* Supporting documents. Sits below the lines because it's the evidence
            for an entry the reader has already read, and it never blocks Post -
            not even on an adjustment, where the review left requiring one
            undecided (the flow above recommends it instead). */}
        <AttachmentDropzone
          files={attachments}
          onChange={setAttachments}
          /* No hint: the drop zone states what it takes, which is the same
             whatever the entry is. Naming the document a reader should be
             reaching for - an invoice here, an auditor letter on a prior period
             adjustment - was the zone explaining the entry back to them. */
        />

        {/* Anyone to tell, on an ordinary entry. On an adjustment the same picker
            sits in the flow above, in its warning tint, so it is offered once. */}
        {!adjusting && (
          <div className="rounded-xl border border-border p-3.5">
            {/* No line under it (Mahad, 2026-10-08). */}
            <NotifyRecipientsPicker selectedIds={recipients} onSelectionChange={setRecipients} label="Notify someone" />
          </div>
        )}

        {/* Why Post did nothing. A balanced entry can still be short an account -
            the totals reconcile whether or not a line names one - so pressing Post
            has to say what is left rather than appear to ignore the press. Each
            field is flagged in place too; this restates them together, next to the
            button, as the one list to work down. It stays until the last is fixed,
            so clearing one does not hide the rest. */}
        {shown.length > 0 && (
          <div data-je-field="problems">
          <Banner tone="danger" title={`This entry can't post yet - ${shown.length} ${shown.length === 1 ? 'thing' : 'things'} to fix.`}>
            <ul className="mt-1.5 space-y-1 list-disc pl-4 marker:text-danger-400">
              {shown.map((p, i) => <li key={i}>{p.message}</li>)}
            </ul>
          </Banner>
          </div>
        )}
      </div>
    </FormModal>
    <ConfirmModal
      open={open && discardOpen}
      tone="danger"
      badge="Discard"
      title="Discard this journal entry?"
      description={['All the information you’ve entered will be lost.', 'This action cannot be undone.']}
      confirmLabel="Discard entry"
      dismissLabel="Keep editing"
      onConfirm={() => { setDiscardOpen(false); close() }}
      onDismiss={() => setDiscardOpen(false)}
    />
    </>
  )
}

/* ───────────────── A line's dimension values ─────────────────
   Each dimension the line's account carries, under the account. A dimension
   with one value on the account has nothing to choose, so it is the chart's own
   pill, as the listing draws it. A dimension with several is a choice, on this
   line: it opens on the account's default and offers the account's other values
   for it, and no others.

   Design review, 2026-10-02 - Eli: *"in the journal entries, you will have the
   default dimension, but then you can actually select a different dimension if
   you want ... You can select amongst all that were configured for this
   account."* It used to be read-only, so an account carrying USA and Singapore
   could only ever post to its default, and the other value was there to filter
   by and never to post to. Splitting one line's amount across several values is
   backlogged, deliberately (Level 5), so a line still takes one value per
   dimension. */
function LineDimensions({ account, chosen, nameOf, onChoose }: {
  account?: Account
  chosen: { dimensionId: string; value: string }[]
  nameOf: (dimensionId: string) => string
  onChoose: (dimensionId: string, value: string) => void
}) {
  const offered = valuesByDimension(account?.defaultDimensionValues ?? [])
  if (!account || offered.size === 0) return null
  const fixed = chosen.filter(c => (offered.get(c.dimensionId)?.length ?? 0) < 2)
  const choices = [...offered].filter(([, values]) => values.length > 1)
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5" data-line-dimensions>
      {fixed.length > 0 && <DimensionPills dimensionValues={fixed} />}
      {choices.map(([dimensionId, values]) => {
        const name = nameOf(dimensionId)
        const fallback = defaultValueOf(account.defaultDimensionValues, dimensionId)
        return (
          <div key={dimensionId} className="flex items-center gap-1.5 min-w-0" data-line-dimension={dimensionId}>
            <span className="text-[11px] text-fg-muted shrink-0" style={{ fontWeight: 500 }}>{name}</span>
            <div className="w-[150px]">
              <Select
                ariaLabel={`${name} for this line`}
                value={chosen.find(c => c.dimensionId === dimensionId)?.value ?? ''}
                onChange={e => onChoose(dimensionId, e.target.value)}
                placeholder={`Pick a ${name.toLowerCase()}`}
                className="!h-7 !text-[12px] !pl-2 !pr-7 !rounded-md"
              >
                {values.map(v => <option key={v} value={v}>{v === fallback ? `${v} (default)` : v}</option>)}
              </Select>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ───────────────── The adjustment flow ─────────────────
   What an entry owes when a line lands on an account the system keeps. It
   replaces the always-visible "Prior period adjustment" switch, which asked
   every entry a question almost none of them are about. Design review,
   2026-09-28 - Eli: *"if it's, I need a book to explain this to me, then I
   definitely only want to surface it if it absolutely has to be."*

   Drawn the way the partners module draws its soft-warning card - a white card
   edged and glowing in amber, a titled header, the settings under it, the
   notification recipients last in the same tint - because the review asked for
   that flow's glow to follow into this one. The copy says in plain words what
   the account is, why it is normally left alone, and what posting to it asks
   for; Learn more opens the long explanation in the Reading Room. */
const ADJUSTMENT_COPY: Record<AdjustmentKind, string> = {
  // Mahad's copy, 2026-10-02.
  'retained-earnings': 'Retained earnings is a control account that the system normally posts to automatically as part of the year-end close. Manual entries to this account should only be used to correct a prior year that has already been closed.',
  control: 'A control account\'s balance comes from the invoices, bills or payments behind it, so an entry here by hand is only for fixing something those records can\'t.',
}

/* Where retained earnings is decision 101's pair, a hand-made entry can only
   reach the manual account - the system one is locked to the close - so the
   copy describes that account rather than the one the close posts to. Module
   review, 2026-10-06 (COA-06): the form called 32200 the account the system
   posts to at year-end close. Mahad's copy above stays for a chart with a
   single retained earnings account, which it describes. */
const RETAINED_EARNINGS_MANUAL_COPY = (name: string) =>
  `${name} is where corrections to retained earnings made by hand go. Only the year-end close posts to the system account, so a correction to a prior year that has already been closed lands here instead.`

function adjustmentCopy(kind: AdjustmentKind, accounts: Account[]): string {
  if (kind !== 'retained-earnings') return ADJUSTMENT_COPY[kind]
  const manual = accounts.find(a => isRetainedEarningsAdjustments(a))
  return manual ? RETAINED_EARNINGS_MANUAL_COPY(manual.accountName) : ADJUSTMENT_COPY[kind]
}

function adjustmentTitle(accounts: Account[]): string {
  const kinds = new Set(accounts.map(a => adjustmentKind(a)))
  if (kinds.size > 1) return 'You\'re adjusting accounts the system keeps'
  if (kinds.has('retained-earnings')) return 'You\'re adjusting retained earnings'
  return accounts.length === 1 ? `You're posting to ${accounts[0].accountName}, a control account` : 'You\'re posting to control accounts'
}

const AdjustmentFlow = ({ anchorRef, accounts, reason, onReason, onLearnMore, reasonError, recipients, onRecipients }: {
  /* Not `ref`: React keeps that prop for itself on a function component. */
  anchorRef: React.RefObject<HTMLDivElement>
  accounts: Account[]
  reason: string
  onReason: (text: string) => void
  onLearnMore: (kind: AdjustmentKind) => void
  reasonError?: string
  recipients: Set<string>
  onRecipients: (ids: Set<string>) => void
}) => {
  const kinds = [...new Set(accounts.map(a => adjustmentKind(a)).filter((k): k is AdjustmentKind => !!k))]
  return (
    <div ref={anchorRef} data-adjustment-flow data-je-field="reason" className="relative overflow-hidden rounded-xl border border-warning-500/20 bg-white shadow-sm p-4 space-y-3.5">
      <div className="absolute inset-x-0 top-0 h-24 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 90% 100% at 0% 0%, #F59E0B 0%, transparent 70%)', opacity: 0.1 }} />
      <div className="relative flex items-start gap-2.5">
        <span className="w-7 h-7 rounded-lg bg-warning-500/10 text-warning-600 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[13px] text-fg leading-tight" style={{ fontWeight: 600 }}>{adjustmentTitle(accounts)}</h3>
          <div className="mt-1 space-y-1 text-xs text-fg-muted leading-relaxed">
            {kinds.map(k => <p key={k}>{adjustmentCopy(k, accounts)}</p>)}
            <p>Because this changes figures that may already have been reported, a reason is required. We also recommend attaching supporting documentation.</p>
          </div>
          {/* The long answer, one press away rather than on the form: a worked
              example and the pitfalls, for whoever needs them. */}
          <div className="mt-1.5 flex flex-wrap gap-x-3">
            {kinds.map(k => (
              <button key={k} type="button" onClick={() => onLearnMore(k)} className="text-xs text-primary hover:underline underline-offset-2" style={{ fontWeight: 600 }}>
                {k === 'retained-earnings' ? 'Learn more about correcting retained earnings' : 'Learn more about accounts the system keeps'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="relative">
        <label className="text-xs text-fg flex items-baseline gap-1 mb-1.5" style={{ fontWeight: 600 }}>
          Why is this adjustment needed? <span className="text-danger-600">*</span>
        </label>
        <Textarea autoGrow aria-label="Reason for this adjustment" data-je-target="reason" value={reason} onChange={e => onReason(e.target.value)}
          placeholder="e.g. 2025 insurance expense was 3,000 short, so the prepaid balance is written down to match"
          className={cn('rounded-lg focus:border-primary', reasonError && 'border-danger-500')} />
        {reasonError && <p className="mt-1 text-[11px] text-danger-600">{reasonError}</p>}
      </div>
      <div className="relative pt-3 border-t border-warning-500/15">
        <NotifyRecipientsPicker selectedIds={recipients} onSelectionChange={onRecipients} tone="warning" label="Let someone know about this adjustment" />
      </div>
    </div>
  )
}
