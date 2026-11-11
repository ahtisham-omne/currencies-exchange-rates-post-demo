// The Currency Library's bulk Activate / Deactivate dialog, in the module's alert
// dialog (the kit's ConfirmModal: tinted icon, centred question and consequence,
// stacked confirm / Cancel). Inside it, Vendor Invoicing's bulk-action body: a
// summary of what the selection splits into, then the currencies themselves -
// the ones that change, and the ones that stay as they are with the reason
// beside each - instead of five names and "and N more".
import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import type { Currency } from '../../data/currencies'
import { ConfirmModal } from '../../coa/components/ui'
import { FlagImage } from '../../coa/components/FlagImage'
import { lifecycleIcon } from '../../coa/lib/lifecycle'
import { fmtNumber } from '../../coa/lib/utils'
import { flagOf, plural } from './model'

export interface BulkStatusPlan {
  mode: 'activate' | 'deactivate'
  /** Everything the reader picked. */
  selected: number
  /** The currencies the action changes. */
  targets: Currency[]
  /** Picked, but staying as they are, each with the reason why. */
  stays: { currency: Currency; reason: string }[]
  /** Notes under the lists: why some stayed, in a sentence each. */
  notes: string[]
}

function Row({ c, reason }: { c: Currency; reason?: string }) {
  return (
    <li className="flex items-center gap-2.5 px-3 py-2 min-w-0">
      <FlagImage code={flagOf(c.code)} className="text-base shrink-0" />
      <span className="text-xs font-semibold text-fg tabular-nums w-9 shrink-0">{c.code}</span>
      <span className="text-sm text-fg-muted truncate flex-1 min-w-0">{c.name}</span>
      {reason && <span className="text-xs text-fg-subtle shrink-0 whitespace-nowrap">{reason}</span>}
    </li>
  )
}

function List({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-fg">{title}</span>
        <span className="text-xs text-fg-subtle tabular-nums">{fmtNumber(count)}</span>
      </div>
      {/* Every currency by name, scrolling past five rows rather than cut short. */}
      <ul className="rounded-lg border border-border divide-y divide-border max-h-[180px] overflow-y-auto scrollbar-thin">{children}</ul>
    </section>
  )
}

export function BulkStatusDialog({ plan, onConfirm, onClose }: {
  plan: BulkStatusPlan
  onConfirm: () => void
  onClose: () => void
}) {
  const { mode, selected, targets, stays, notes } = plan
  const n = targets.length
  const deactivating = mode === 'deactivate'
  const none = n === 0

  const stat = (label: string, value: number) => (
    <div className="min-w-0">
      <div className="text-2xs text-fg-muted mb-0.5">{label}</div>
      <div className="text-sm font-semibold text-fg tabular-nums">{fmtNumber(value)}</div>
    </div>
  )

  const body = (
    <div className="space-y-3.5">
      <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-bg-subtle p-3">
        {stat('Selected', selected)}
        {stat(deactivating ? 'Will Be Deactivated' : 'Will Be Activated', n)}
        {stat(deactivating ? 'Staying Active' : 'Already Active', stays.length)}
      </div>

      {n > 0 && (
        <List title={deactivating ? 'Will Be Deactivated' : 'Will Be Activated'} count={n}>
          {targets.map(c => <Row key={c.code} c={c} />)}
        </List>
      )}

      {/* Activating, the rest are simply active already: the summary's count says
          enough. Deactivating, each one that stays has its own reason. */}
      {deactivating && stays.length > 0 && (
        <List title="Staying Active" count={stays.length}>
          {stays.map(s => <Row key={s.currency.code} c={s.currency} reason={s.reason} />)}
        </List>
      )}

      {notes.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2.5">
          <Info size={13} className="text-fg-subtle mt-0.5 shrink-0" />
          <div className="text-xs text-fg-muted leading-snug space-y-1">{notes.map(t => <p key={t}>{t}</p>)}</div>
        </div>
      )}
    </div>
  )

  // Nothing can move: the alert's refusal form, one button and the reasons.
  if (none) {
    return (
      <ConfirmModal
        open
        tone="warning"
        title={deactivating ? 'No currencies to deactivate' : 'No currencies to activate'}
        description="Each currency you picked stays as it is, for the reason shown beside it."
        confirmLabel="Got It"
        widthClass="max-w-[480px]"
        onConfirm={onClose}
        onDismiss={onClose}
      >
        {body}
      </ConfirmModal>
    )
  }

  return (
    <ConfirmModal
      open
      tone="warning"
      icon={lifecycleIcon(deactivating ? 'deactivate' : 'activate')}
      title={`${deactivating ? 'Deactivate' : 'Activate'} ${plural(n, 'currency', 'currencies')}?`}
      description={deactivating
        ? (n === 1
          ? 'It will stop being offered on new transactions. Its rates and history are kept, and you can activate it again anytime.'
          : 'They will stop being offered on new transactions. Their rates and history are kept, and you can activate them again anytime.')
        : (n === 1
          ? 'It will be offered on new transactions, rates and reports again.'
          : 'They will be offered on new transactions, rates and reports again.')}
      confirmLabel={`${deactivating ? 'Deactivate' : 'Activate'} ${plural(n, 'Currency', 'Currencies')}`}
      dismissLabel="Cancel"
      widthClass="max-w-[480px]"
      onConfirm={onConfirm}
      onDismiss={onClose}
    >
      {body}
    </ConfirmModal>
  )
}
