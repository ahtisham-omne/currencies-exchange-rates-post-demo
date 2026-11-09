import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, ChevronRight, Info, Layers } from 'lucide-react'
import { FormModal, Button, Badge, Banner, Input, HowItWorksButton } from './ui'
import { ReadingRoom } from './walkthrough/ReadingRoom'
import { NumberRangeCard } from './NumberRangeCard'
import { PARTNER_CHIP_CLS, PreviewChartTable, type PreviewRow } from './AccountTable'
import { LockedField, SectionCard } from '../pages/CreateAccount'
import { buildChartIndex } from '../lib/chartTree'
import { checkPlacement, offerBlocks, parseRangeInputs } from '../lib/numberRange'
import { placementPreview, DRAFT_ID } from '../lib/placementPreview'
import { MOVE_UNDER_SUMMARY_GUIDE } from '../lib/moveUnderSummaryGuide'
import { buildAccount, useAccountNumberText, useStore } from '../store'
import { numberProtectionOn, type Account, type AccountDraft } from '../types'
import { cn, fmtCurrency, todayIso } from '../lib/utils'

/* ───────────────── Move under a new summary account ─────────────────
   A new summary is what the move creates, so it is asked for the way the
   create flow asks for a summary: the same modal, the same step tabs, the same
   Type and GL account details cards with the number range card, and the same
   placement preview as the last step. Only what the move settles is different,
   and it is shown settled - the type is Summary, the parent is the account's
   current parent, and the account is what moves under it.

   Design review, 2026-09-24, asked for the tree (current parent, the new
   summary, the account under it) and for the mechanism to be explained. The
   tree is the preview step, drawn by `placementPreview` with the account one
   level in under the new summary. The explanation is How it works, in the
   Reading Room, rather than on the form: Mahad, 2026-09-29, *"there is just too
   much information and my eye isn't resting anywhere ... all these details can
   go into the How it works side sheet."*

   The rule is unchanged: the summary is created inside the account's current
   parent and the account moves under it and nowhere else. Number and block come
   from the same `offerBlocks` and `checkPlacement` the create form uses.

   Design review, 2026-09-30, reshaped the last part. The locked Parent and
   "Moves under it" fields were a halfway tree that stopped Eli: *"either show it
   all here or take it out completely and then just show it in the next
   screen."* So Details asks only for the summary, and Preview opens on the move
   itself, played out: the account where it sits, the new summary opening in its
   place, the account dropping in under it. *"It went from here, dropped into
   here, it did the thing."* The title names the account, so the reader never
   loses which one they started from.

   Works on the live chart, or on a staged one (the guided setup), where the
   summary is handed back through `onCreate` for the caller to file with the move. */
type Step = 'details' | 'preview'
const STEPS: { id: Step; label: string }[] = [{ id: 'details', label: 'Details' }, { id: 'preview', label: 'Preview' }]

export function MoveUnderSummaryModal({ account, onClose, accountsOverride, onCreate }: {
  account: Account
  onClose: () => void
  /** A chart being built rather than the saved one. */
  accountsOverride?: Account[]
  /** Staged mode: receives the built summary; the caller moves the account under it. */
  onCreate?: (summary: Account) => void
}) {
  const navigate = useNavigate()
  const storeAccounts = useStore(s => s.accounts)
  const company = useStore(s => s.company)
  const createAccount = useStore(s => s.createAccount)
  const updateAccount = useStore(s => s.updateAccount)
  const pushToast = useStore(s => s.pushToast)
  const numberText = useAccountNumberText()
  const chart = accountsOverride ?? storeAccounts
  const idx = useMemo(() => buildChartIndex(chart), [chart])
  const parent = idx.parentOf(account.id) ?? null
  const protection = numberProtectionOn(company)
  const offer = useMemo(
    () => offerBlocks({ parent, chart, protection, adopts: [account.id] }),
    [parent, chart, protection, account.id])

  const [step, setStep] = useState<Step>('details')
  const [guideOpen, setGuideOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  /* The block and the number, as the create form holds them: reserving is on and
     opens on the recommended block, and the summary's number is the block's first. */
  const [reserving, setReserving] = useState(true)
  const [rangeStart, setRangeStart] = useState(offer.recommended ? String(offer.recommended.start) : '')
  const [rangeEnd, setRangeEnd] = useState(offer.recommended ? String(offer.recommended.end) : '')
  const [typedNumber, setTypedNumber] = useState('')
  const [attempted, setAttempted] = useState(false)

  const parsed = parseRangeInputs(rangeStart, rangeEnd)
  const range = reserving && parsed.kind === 'range' ? parsed.range : null
  const number = range ? String(range.start) : typedNumber.trim()
  const rangeError = reserving && parsed.kind === 'error' ? parsed.error : null

  const duplicate = !!number && chart.some(a => a.accountNumber === number)
  const placement = useMemo(() => number
    ? checkPlacement({
      accountNumber: number, accountName: name, glAccountType: 'Summary',
      parentId: parent?.id ?? null, range, adopts: [account.id], chart, protection,
    })
    : null, [number, name, parent, range, account.id, chart, protection])

  const nameError = attempted && !name.trim() ? 'Name the new summary account.' : undefined
  const numberError = !number
    ? (attempted ? 'Give the new summary account a number.' : undefined)
    : duplicate ? `${number} is already on the chart.` : placement?.text
  const ready = !!name.trim() && !!number && !duplicate && !placement && !rangeError

  const goPreview = () => {
    setAttempted(true)
    if (ready) setStep('preview')
  }

  const save = () => {
    if (!ready) { setStep('details'); setAttempted(true); return }
    const draft: AccountDraft = {
      accountNumber: number,
      accountName: name.trim(),
      accountType: account.accountType,
      glAccountType: 'Summary',
      // It prints on the line the account printed on: it stands in its place.
      statementClassification: account.statementClassification,
      isPosting: false,
      isContra: false,
      subsidiaryId: account.subsidiaryId,
      currencyCode: account.currencyCode,
      status: 'Active',
      effectiveDate: todayIso(),
      postingRestrictions: {},
      defaultDimensionValues: [],
      description: description.trim(),
      parentId: parent?.id ?? null,
      balance: 0,
      hasTransactions: false,
      numberRangeStart: range?.start,
      numberRangeEnd: range?.end,
    }
    if (onCreate) {
      onCreate(buildAccount(draft, chart))
      onClose()
      return
    }
    const created = createAccount(draft)
    // The one edit the move makes to the account. Everything else about it -
    // number, name, entries, dimensions - is left alone.
    updateAccount(account.id, { parentId: created.id },
      `Moved under new summary ${created.accountNumber} ${created.accountName}`)
    pushToast(`${account.accountName} now sits under ${created.accountName}`, 'success')
    onClose()
    navigate(`/chart-of-accounts/${created.id}`)
  }

  const stepIndex = STEPS.findIndex(s => s.id === step)
  // The create form's step tabs, as they are drawn there.
  const stepTabs = (
    <div className="flex items-center gap-6 overflow-x-auto">
      {STEPS.map((s, i) => {
        const active = step === s.id
        const completed = i < stepIndex
        // Forward too, once Details is complete: a filled-in form shouldn't make
        // the reader hunt for Continue to see the next step.
        const reachable = i <= stepIndex || ready
        return (
          <button key={s.id} type="button" disabled={!reachable} aria-current={active ? 'step' : undefined}
            className={cn('relative flex items-center gap-2 pb-3', reachable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50')}
            onClick={() => (s.id === 'preview' ? goPreview() : setStep(s.id))}>
            <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[12px] shrink-0 transition-all duration-200',
              completed ? 'bg-emerald-500 text-white' : active ? 'bg-primary text-white' : 'border-[1.5px] border-slate-300 text-slate-500 bg-white')}
              style={{ fontWeight: 600 }}>
              {completed ? <Check className="w-3 h-3" /> : i + 1}
            </div>
            <span className={cn('text-[13px] whitespace-nowrap transition-colors', active ? 'text-primary' : completed ? 'text-emerald-500' : 'text-slate-700')}
              style={{ fontWeight: active || completed ? 600 : 500 }}>{s.label}</span>
            {(active || completed) && (
              <div className={cn('absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full', completed ? 'bg-emerald-500' : 'bg-primary')} />
            )}
          </button>
        )
      })}
    </div>
  )

  /* The move, played out, at the end of the Details step - Mahad, 2026-10-01:
     *"Can we have this animation at the end of the detail step."* It plays as
     the dialog opens and names the summary as it is typed, so the reader sees
     what the form will do before they reach Preview, which keeps the placement
     table. */
  const playback = (
    <MovePlayback
      parentLabel={parent ? `${numberText(parent.accountNumber)} · ${parent.accountName}` : null}
      summaryLabel={`${numberText(number)} · ${name.trim() || 'New summary'}`}
      accountLabel={`${numberText(account.accountNumber)} · ${account.accountName}`}
      balance={fmtCurrency(account.balance ?? 0, account.currencyCode)}
      accountName={account.accountName}
    />
  )

  const details = (
    <div className="px-6 pt-5 pb-5 space-y-3.5" data-move-under-summary>
      {/* What the move means, said once above the form, with the way into the
          full explanation. Mahad, 2026-09-30: an informative banner above Type
          that points to How it works, which already explains the rest. */}
      <Banner tone="info" title={`A new summary takes ${account.accountName}'s place`}>
        <p>
          It is created inside {parent?.accountName ?? 'the chart'}, and {account.accountName} moves under it unchanged. The summary
          shows all of the account's history, and you can add new accounts beside it.{' '}
          <button type="button" onClick={() => setGuideOpen(true)} className="underline underline-offset-2 hover:opacity-80" style={{ fontWeight: 600 }}>
            See how it works
          </button>
        </p>
      </Banner>

      <SectionCard icon={<Layers size={16} />} title="Type">
        <div className="md:max-w-[calc(50%-8px)]">
          <LockedField label="GL account type" why={`A new summary is being created above ${account.accountName}, so it can only be a Summary.`}>
            <span>Summary</span>
          </LockedField>
        </div>
        <div className="mt-4">
          <NumberRangeCard
            reserving={reserving}
            onReservingChange={on => {
              setReserving(on)
              if (!on) { setRangeStart(''); setRangeEnd('') }
              else if (offer.recommended) { setRangeStart(String(offer.recommended.start)); setRangeEnd(String(offer.recommended.end)) }
            }}
            startValue={rangeStart}
            endValue={rangeEnd}
            onChange={(a, b) => { setRangeStart(a); setRangeEnd(b) }}
            parent={parent}
            offer={offer}
            error={rangeError}
          />
        </div>
      </SectionCard>

      <SectionCard icon={<Info size={16} />} title="GL account details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="space-y-4">
            <Input
              label="GL account name"
              aria-label="GL account name"
              required
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={`e.g. ${account.accountName} funds`}
              error={nameError}
            />
            {range ? (
              <div>
                <LockedField label="GL account no." why="A summary is numbered with the first number of the block it reserves. Change the start of the range to change it.">
                  <span className="truncate">{number}</span>
                </LockedField>
                {numberError && <p className="text-xs text-danger-600 mt-1">{numberError}</p>}
              </div>
            ) : (
              <Input
                label="GL account no."
                aria-label="GL account no."
                required
                value={typedNumber}
                onChange={e => setTypedNumber(e.target.value)}
                error={numberError}
                className={cn(numberError && 'border-danger-500 focus:border-danger-500')}
              />
            )}
          </div>
          <div>
            <label className="label block mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What this account is used for"
              className="input px-3.5 py-2.5 resize-none min-h-[110px]"
            />
          </div>
        </div>
      </SectionCard>

      {playback}
    </div>
  )

  /* The create form's placement preview, with the account drawn one level in
     under the new summary rather than in the sibling run it is leaving. */
  const preview = (() => {
    const draft = {
      id: DRAFT_ID,
      accountNumber: number,
      accountName: name.trim() || 'New summary',
      accountType: account.accountType,
      glAccountType: 'Summary',
      currencyCode: account.currencyCode,
      status: 'Active',
      statementClassification: account.statementClassification,
    } as Account
    const { chain, rows } = placementPreview({ index: idx, draft, parent, exclude: [account.id], held: [account] })
    const previewRows: PreviewRow[] = rows.map(r => r.account
      ? {
        ...r,
        highlight: r.account.id === DRAFT_ID,
        badge: r.account.id === DRAFT_ID ? <Badge tone="brand" className={cn(PARTNER_CHIP_CLS, 'shrink-0')}>New</Badge>
          : r.account.id === account.id ? <Badge tone="info" className={cn(PARTNER_CHIP_CLS, 'shrink-0')}>Moves here</Badge>
            : undefined,
      }
      : r)
    return (
      <div className="p-6 space-y-5" data-move-under-summary>
        <div>
          <h3 className="text-sm font-semibold text-fg">Placement preview</h3>
          <p className="text-xs text-fg-muted mt-0.5">Where it sits in your chart.</p>
        </div>
        <PreviewChartTable rows={previewRows} columns={['number', 'name', 'glType', 'currency', 'status']} numberText={a => numberText(a.accountNumber)} />
      </div>
    )
  })()

  return (
    <FormModal
      open
      onClose={onClose}
      title={`Move ${account.accountName} under a new summary account`}
      headerExtra={stepTabs}
      headerActions={<HowItWorksButton open={guideOpen} onClick={() => setGuideOpen(o => !o)} />}
      overlay={<ReadingRoom open={guideOpen} onClose={() => setGuideOpen(false)} config={MOVE_UNDER_SUMMARY_GUIDE} />}
      maxHeightClass="sm:max-h-[min(90vh,760px)]"
      fixedHeight="sm:h-[min(90vh,760px)]"
      // The create form's footer, button for button.
      footer={step === 'preview' ? (
        <>
          <Button variant="ghost" className="mr-auto" icon={<ArrowLeft size={14} />} onClick={() => setStep('details')}>Back</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Create and move</Button>
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={goPreview} iconRight={<ChevronRight size={14} />}>Continue</Button>
        </>
      )}
    >
      {step === 'details' ? details : preview}
    </FormModal>
  )
}

/* ───────────────── The move, played out ─────────────────
   Three rows and one change. It opens on Before - the parent with the account
   directly under it - then the new summary opens in the account's place and the
   account slides in one level under it, and the label turns to After. The
   balance on the new summary is the account's, which is the whole point: the
   summary adds up everything the account ever held.

   On a loop: it holds on After, then starts again. Design review, 2026-10-02 -
   Eli had not seen it play once: *"Just run the animation in a loop. It just
   shows it and then inserts it."* That retired the Replay button, which only
   ever asked the reader to start what now never stops. Reduced motion goes
   straight to After and stays there.

   It waits to be seen before it plays. At the end of the Details step it sits
   below the fold, and played on open it had finished before anyone scrolled
   down to it. */
type Phase = 'before' | 'summary' | 'after'
/* When each step lands, in ms from the start of a pass, and how long a pass
   is. After holds longest, because it is the state worth reading. */
const LOOP = { summaryAt: 700, afterAt: 1400, period: 4200 }

function MovePlayback({ parentLabel, summaryLabel, accountLabel, balance, accountName }: {
  parentLabel: string | null
  summaryLabel: string
  accountLabel: string
  balance: string
  accountName: string
}) {
  const still = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [phase, setPhase] = useState<Phase>(still ? 'after' : 'before')
  const box = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = box.current
    if (!el || seen) return
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold: 0.6 })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])
  useEffect(() => {
    if (still || !seen) return
    const timers: number[] = []
    const cycle = () => {
      setPhase('before')
      timers.push(window.setTimeout(() => setPhase('summary'), LOOP.summaryAt))
      timers.push(window.setTimeout(() => setPhase('after'), LOOP.afterAt))
      timers.push(window.setTimeout(cycle, LOOP.period))
    }
    cycle()
    return () => timers.forEach(t => window.clearTimeout(t))
  }, [still, seen])
  const shown = phase !== 'before'
  const moved = phase === 'after'
  const indent = parentLabel ? 1 : 0

  const row = (extra?: string) => cn(
    'flex items-center gap-2 h-10 pr-3 rounded-lg transition-all duration-500 ease-out', extra)

  return (
    <div ref={box} className="rounded-xl border border-border bg-white overflow-hidden" data-move-playback={phase}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg-subtle/60">
        <div className="text-[13px] text-fg" style={{ fontWeight: 600 }}>
          {moved ? 'After the move' : 'Before the move'}
        </div>
      </div>
      <div className="px-3 py-3">
        {parentLabel && (
          <div className={row()} style={{ paddingLeft: 12 }}>
            <span className="text-13 text-fg-muted truncate" style={{ fontWeight: 500 }}>{parentLabel}</span>
          </div>
        )}
        {/* The new summary, opening in the account's place. */}
        <div className={cn('overflow-hidden transition-all duration-500 ease-out', shown ? 'max-h-10 opacity-100' : 'max-h-0 opacity-0')}>
          <div className={row('bg-primary/[0.06]')} style={{ paddingLeft: 12 + indent * 20 }}>
            {indent > 0 && <span className="text-fg-subtle/50">└</span>}
            <span className="text-13 text-primary truncate" style={{ fontWeight: 600 }}>{summaryLabel}</span>
            <Badge tone="brand" className={cn(PARTNER_CHIP_CLS, 'shrink-0')}>New</Badge>
            <span className="ml-auto text-13 tabular-nums text-primary" style={{ fontWeight: 600 }}>{balance}</span>
          </div>
        </div>
        {/* The account, sliding in one level under it. */}
        <div className={row()} style={{ paddingLeft: 12 + (indent + (moved ? 1 : 0)) * 20 }}>
          {(indent > 0 || moved) && <span className="text-fg-subtle/50">└</span>}
          <span className="text-13 text-fg truncate" style={{ fontWeight: 500 }}>{accountLabel}</span>
          {moved && <Badge tone="info" className={cn(PARTNER_CHIP_CLS, 'shrink-0 coa-row-reveal')}>Moves here</Badge>}
          <span className="ml-auto text-13 tabular-nums text-slate-700">{balance}</span>
        </div>
      </div>
      <p className="px-4 py-2.5 border-t border-border-subtle text-2xs text-fg-muted">
        {accountName} keeps its number, balance and history. The new summary adds it all up.
      </p>
    </div>
  )
}
