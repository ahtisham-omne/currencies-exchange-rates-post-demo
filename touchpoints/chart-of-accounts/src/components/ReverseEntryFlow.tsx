import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Undo2 } from 'lucide-react'
import { ConfirmModal, Textarea, Tooltip } from './ui'
import { DateField } from './DateField'
import { useStore } from '../store'
import { buildReversal, reconstructEntry, type ReversalPlan } from '../lib/journalEntry'
import type { Transaction } from '../types'
import { cn, fmtCurrencyExact, fmtDate, uid } from '../lib/utils'

/* ─────────────────────── Reversing an entry ───────────────────────
   One flow for every way into it: the entry's own page ("Reverse this entry")
   and a journal entry row's Actions menu ("Reverse entry", Mahad, 2026-10-08).
   Both open this, so the dialog, its checks and what gets posted are the same
   wherever the reader starts. Open while `jeNumber` is set. */
export function ReverseEntryFlow({ jeNumber, onClose }: { jeNumber: string | null; onClose: () => void }) {
  if (!jeNumber) return null
  // Keyed by the entry so each opening starts with nothing answered.
  return <ReverseEntryFlowFor key={jeNumber} jeNumber={jeNumber} onClose={onClose} />
}

function ReverseEntryFlowFor({ jeNumber, onClose }: { jeNumber: string; onClose: () => void }) {
  const navigate = useNavigate()
  const transactions = useStore(s => s.transactions)
  const accounts = useStore(s => s.accounts)
  const base = useStore(s => s.company.baseCurrency)
  const periods = useStore(s => s.periods)
  const journalEntries = useStore(s => s.journalEntries)
  const addJournalEntry = useStore(s => s.addJournalEntry)
  const pushToast = useStore(s => s.pushToast)
  const entry = useMemo(() => reconstructEntry(jeNumber, transactions, accounts), [jeNumber, transactions, accounts])

  /* Every number already handed out, read from both sides: a seeded posting can
     carry a number no entry record claims, and the ledger groups on the posting. */
  const issuedJeNumbers = useMemo(
    () => new Set([...journalEntries.map(e => e.reference), ...transactions.map(t => t.jeNumber)]),
    [journalEntries, transactions])
  /* What the reader answers in the reversal dialog: the day it posts on (null
     until they move it off the one offered) and why. */
  const [revDate, setRevDate] = useState<string | null>(null)
  const [revReason, setRevReason] = useState('')
  const reversal = useMemo(
    () => buildReversal(entry, periods, issuedJeNumbers, entry.reversalNo, revDate ?? undefined),
    [entry, periods, issuedJeNumbers, revDate])

  /* The reversal is decided by the time it is confirmed, so posting it is only a
     matter of writing it down. The lines carry the original's own descriptions,
     because the pair is one correction and reading the second half should not
     mean going back for the first. */
  const postReversal = () => {
    const reason = revReason.trim()
    if (reversal.blocked || reversal.dateProblem || !reason) return
    const createdAt = new Date().toISOString()
    const postings: Transaction[] = reversal.lines.map(l => ({
      id: uid('txn'), accountId: l.accountId, date: reversal.date, source: 'Manual JE',
      jeNumber: reversal.jeNumber, reference: '',
      entryType: reversal.lines.length > 2 ? 'Compound' : 'Simple',
      description: l.description, memo: reversal.memo,
      reversalReason: reason, createdAt, createdBy: 'Ahtisham Ahmad (You)',
      debit: l.debit, credit: l.credit,
      // A line written in another currency reverses in it, at its own rate.
      ...(l.currency ? { entryCurrency: l.currency, entryRate: l.rate, fxDebit: l.fxDebit, fxCredit: l.fxCredit } : {}),
      runningBalance: 0,
      // Where the original line posted, so the pair nets to nothing per value too.
      dimensionValues: l.dimensionValues,
      period: reversal.period,
    }))
    addJournalEntry(
      {
        id: uid('je'), date: reversal.date, reference: reversal.jeNumber, description: reversal.description,
        status: 'Posted',
        lines: reversal.lines.map(l => ({ accountId: l.accountId, debit: l.debit, credit: l.credit })),
      },
      postings,
      [],
    )
    onClose()
    pushToast(`Posted ${reversal.jeNumber}`, 'success', `Reverses ${entry.jeNumber} · ${fmtCurrencyExact(reversal.total, base)}`)
    navigate(`/general-ledger/entry/${encodeURIComponent(reversal.jeNumber)}`)
  }

  return (
    <ReverseEntryConfirm
      open
      onDismiss={onClose}
      onConfirm={postReversal}
      original={entry.jeNumber}
      plan={reversal}
      base={base}
      onDate={setRevDate}
      reason={revReason}
      onReason={setRevReason}
    />
  )
}

/* The lines of a reversal are decided - every one flips - so the dialog shows
   them rather than asks for them. What it does ask is the two things the entry
   being reversed cannot answer: the day the reversal posts on, offered as the
   original's own date (or the first open one, when that month is shut) and
   movable to any open day from the original on; and why it is being reversed,
   which is required and kept on the reversing entry. The blocked case lives here
   too rather than greying the action and leaving the reader to guess. */
function ReverseEntryConfirm({ open, onDismiss, onConfirm, original, plan, base, onDate, reason, onReason }: {
  open: boolean
  onDismiss: () => void
  onConfirm: () => void
  original: string
  plan: ReversalPlan
  base: string
  onDate: (iso: string | null) => void
  reason: string
  onReason: (v: string) => void
}) {
  const blocked = plan.blocked
  // Named once the reader has tried to post without one, not before.
  const [triedWithoutReason, setTriedWithoutReason] = useState(false)
  useEffect(() => { if (open) setTriedWithoutReason(false) }, [open])
  const missingReason = !reason.trim()
  const confirm = () => {
    if (missingReason) { setTriedWithoutReason(true); return }
    onConfirm()
  }
  return (
    <ConfirmModal
      open={open}
      onDismiss={onDismiss}
      onConfirm={confirm}
      tone={blocked ? 'danger' : 'info'}
      // Wider than a plain confirmation: it carries three fields and the GL
      // impact table (Mahad, 2026-10-09: *"Widen the reverse entry modal a bit"*).
      widthClass="max-w-md"
      icon={<Undo2 size={24} className={blocked ? 'text-danger-600' : 'text-info-600'} />}
      badge={blocked ? 'Cannot reverse' : 'Reverse entry'}
      title={blocked ? `${original} cannot be reversed` : `Reverse ${original}?`}
      /* Mahad's copy, 2026-10-08. The new entry's number is stated in its own
         locked field below rather than in this sentence. */
      description={blocked ? blocked : 'This posts a new entry with every debit and credit flipped. Both entries stay on the ledger and cancel each other out.'}
      confirmLabel={blocked ? 'Reverse entry' : `Post ${plan.jeNumber}`}
      confirmDisabled={!!blocked || !!plan.dateProblem}
      dismissLabel={blocked ? 'Close' : 'Cancel'}
      reasonsTitle={!blocked && plan.movedDate ? 'Posting date' : undefined}
      reasons={!blocked && plan.movedDate
        ? [<>The period {original} posts in is closed, so the reversal is offered {fmtDate(plan.offeredDate)} instead.</>]
        : undefined}
    >
      {!blocked && (
        <div className="space-y-3 mb-3 text-left">
          {/* Stated, not typed, as on New journal entry: the number the reversal
              posts under, locked, the padlock carrying the reason. */}
          <div>
            <label className="text-xs text-fg block mb-1.5" style={{ fontWeight: 600 }}>Journal entry number</label>
            <div aria-label="Journal entry number" className="input rounded-lg flex items-center justify-between gap-2 bg-bg-subtle/60 text-fg-muted cursor-default select-none tabular-nums">
              <span className="truncate">{plan.jeNumber}</span>
              <Tooltip content="Given by the system, the next in sequence for the entry's year." side="top" align="right">
                <span className="inline-flex shrink-0 cursor-help text-fg-subtle/60 hover:text-fg-subtle"><Lock size={13} /></span>
              </Tooltip>
            </div>
          </div>
          <div>
            <label className="text-xs text-fg block mb-1.5" style={{ fontWeight: 600 }}>
              Reversal date <span className="text-danger-600">*</span>
            </label>
            <DateField ariaLabel="Reversal date" value={plan.date || null} onChange={iso => onDate(iso)} placeholder="Select date"
              triggerClassName={cn('w-full h-9 px-3 rounded-lg border text-sm text-fg text-left transition-colors',
                plan.dateProblem ? 'border-danger-500' : 'border-border hover:border-primary/50')} />
            {plan.dateProblem
              ? <p className="mt-1.5 text-2xs leading-snug text-danger-600">{plan.dateProblem}</p>
              : plan.period && <p className="mt-1.5 text-2xs leading-snug text-fg-muted">Posting period: <span className="text-fg" style={{ fontWeight: 600 }}>{plan.period}</span></p>}
          </div>
          <div>
            <label className="text-xs text-fg block mb-1.5" style={{ fontWeight: 600 }}>
              Reason for reversal <span className="text-danger-600">*</span>
            </label>
            <Textarea autoGrow aria-label="Reason for reversal" value={reason} onChange={e => onReason(e.target.value)}
              placeholder="e.g. Posted to the wrong expense account"
              className={cn('rounded-lg focus:border-primary', triedWithoutReason && missingReason && 'border-danger-500')} />
            {triedWithoutReason && missingReason && <p className="mt-1 text-2xs text-danger-600">Enter a reason for the reversal.</p>}
          </div>
        </div>
      )}
      {!blocked && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 h-8 bg-bg-subtle border-b border-border">
            <span className="text-2xs uppercase tracking-wider text-fg-muted" style={{ fontWeight: 700 }}>GL impact</span>
            <span className="text-2xs text-fg-muted truncate">{fmtDate(plan.date)} · {plan.period}</span>
          </div>
          {/* Capped rather than left to grow, so a compound entry does not push
              the confirm button off the screen it is being confirmed on. */}
          <ul className="divide-y divide-border-subtle max-h-[168px] overflow-y-auto scrollbar-thin">
            {plan.lines.map((l, i) => (
              <li key={i} className="flex items-center gap-2 px-3 py-2">
                <span className="w-5 shrink-0 text-2xs uppercase tracking-wide text-fg-subtle" style={{ fontWeight: 700 }}>{l.debit ? 'Dr' : 'Cr'}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-fg">{l.account?.accountName ?? l.accountId}</span>
                {/* In the currency it was typed in, over the base figure, as the
                    entry's own lines read. */}
                <span className="shrink-0 text-right text-[12px] tabular-nums text-slate-700">
                  {l.currency
                    ? <>{fmtCurrencyExact(l.fxDebit || l.fxCredit || 0, l.currency)}<span className="block text-[11px] text-fg-muted">{fmtCurrencyExact(l.debit || l.credit, base)}</span></>
                    : fmtCurrencyExact(l.debit || l.credit, base)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between px-3 h-8 bg-bg-subtle border-t border-border">
            <span className="text-2xs uppercase tracking-wider text-fg-muted" style={{ fontWeight: 700 }}>Total</span>
            {/* The typed total only where every line is in one currency;
                amounts in different currencies cannot be added up. */}
            <span className="text-[12px] tabular-nums text-fg" style={{ fontWeight: 600 }}>
              {plan.entryCurrency
                ? <>{fmtCurrencyExact(Math.round(plan.lines.reduce((t, l) => t + (l.fxDebit ?? 0), 0) * 100) / 100, plan.entryCurrency)} <span className="text-fg-muted" style={{ fontWeight: 400 }}>· {fmtCurrencyExact(plan.total, base)}</span></>
                : fmtCurrencyExact(plan.total, base)}
            </span>
          </div>
        </div>
      )}
    </ConfirmModal>
  )
}
