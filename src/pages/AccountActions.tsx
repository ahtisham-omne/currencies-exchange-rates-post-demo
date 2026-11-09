import { useState, type ReactNode } from 'react'
import { Archive, ArchiveRestore, ArrowRight, CircleSlash, FileText, Power, Trash2 } from 'lucide-react'
import { ConfirmModal, Quoted, Select } from '../components/ui'
import { OverflowCard } from '../components/AccountTable'
import { useStore, lifecycleCtx } from '../store'
import { balanceMoveImpact, describeAccount, moveSummary, planBulk, planDelete, planLifecycle } from '../lib/accountLifecycle'
import type { AccountAction, BalanceMove, BalanceMoveImpact, ConfirmSpec, LifecycleAction, RefusalSpec } from '../lib/accountLifecycle'
import { Account } from '../types'
import { fmtCurrencyExact } from '../lib/utils'

/* One path for every lifecycle action, on every surface. The COA list, the tree,
   the bulk bar and an account's detail page all call request() / requestBulk()
   from useAccountLifecycle, so none of them can offer an action the rules refuse
   or skip a confirmation the rules ask for. What the dialog says comes from the
   plan, not from the component. */

/* The named accounts, and the rest of them behind the listing's own overflow
   card rather than a count. A dialog that exists to say which accounts to go and
   deal with cannot end on "and 41 more" - that names none of the 41 and leaves
   the reader to find them by hand. The card scrolls past five rows, so a branch
   holding four hundred reads the same as one holding nine. */
/* An account a dialog names, "11130 Operating - Chase Bank", with its number in
   the pill a number takes inside a sentence (`Quoted`), so it reads apart from
   the name and the words around it. Mahad, 2026-10-08: *"Can you display the
   account number in this alert dialog in a pill for better readability?"* The
   plan writes plain strings - the rules have no business with markup - so the
   dialog finds each account it holds by the label the plan gave it. */
function withNumberPills(line: string, accounts: Account[]): ReactNode {
  const named = accounts.filter(a => line.includes(describeAccount(a)))
  if (!named.length) return line
  // Longest first, so "1100 Cash" never claims the start of "11000 Cash and ...".
  named.sort((a, b) => describeAccount(b).length - describeAccount(a).length)
  const byLabel = new Map(named.map(a => [describeAccount(a), a]))
  const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = line.split(new RegExp(`(${[...byLabel.keys()].map(escape).join('|')})`))
  return (
    <>
      {parts.map((part, i) => {
        const a = byLabel.get(part)
        return a ? <span key={i}><Quoted>{a.accountNumber}</Quoted> {a.accountName}</span> : <span key={i}>{part}</span>
      })}
    </>
  )
}

function namedBox(title: string | undefined, named: ReactNode[] | undefined, rest: string[] | undefined): ReactNode[] | undefined {
  if (!named?.length) return undefined
  if (!rest?.length) return named
  return [
    ...named,
    <OverflowCard key="rest" category={title ?? 'Accounts'} icon={FileText}
      items={rest.map(name => ({ name }))}>
      <span className="underline decoration-dotted underline-offset-2">and {rest.length} more</span>
    </OverflowCard>,
  ]
}
const affectedReasons = (spec: { affectedTitle?: string; affected?: string[]; affectedRest?: string[] }, accounts: Account[]) =>
  namedBox(spec.affectedTitle, spec.affected?.map(l => withNumberPills(l, accounts)), spec.affectedRest)

const ICON: Record<AccountAction, (cls: string) => JSX.Element> = {
  deactivate: cls => <CircleSlash size={26} className={cls} />,
  activate: cls => <Power size={26} className={cls} />,
  archive: cls => <Archive size={26} className={cls} />,
  unarchive: cls => <ArchiveRestore size={26} className={cls} />,
  delete: cls => <Trash2 size={26} className={cls} />,
}

export function LifecycleConfirm({ action, spec, picker, onConfirm, onDismiss }: {
  action: AccountAction
  spec: ConfirmSpec
  /** Rendered under the description when the action needs an answer first. */
  picker?: { node: JSX.Element; impact?: BalanceMoveImpact; answered: boolean }
  onConfirm: () => void
  onDismiss: () => void
}) {
  const accounts = useStore(s => s.accounts)
  return (
    <ConfirmModal
      open
      tone={spec.tone}
      icon={ICON[action](spec.tone === 'danger' ? 'text-danger-600' : 'text-warning-600')}
      title={spec.title}
      description={spec.description.map(l => withNumberPills(l, accounts))}
      reasonsTitle={picker ? undefined : spec.affectedTitle}
      reasons={picker ? undefined : affectedReasons(spec, accounts)}
      asideTitle={spec.stayedTitle}
      aside={namedBox(spec.stayedTitle, spec.stayed?.map(l => withNumberPills(l, accounts)), spec.stayedRest)}
      confirmLabel={spec.confirmLabel}
      confirmDisabled={picker ? !picker.answered : undefined}
      dismissLabel="Cancel"
      onConfirm={onConfirm}
      onDismiss={onDismiss}
    >
      {picker && (
        <div className="space-y-3">
          {picker.node}
          {picker.impact && <GlImpactPanel impact={picker.impact} />}
        </div>
      )}
    </ConfirmModal>
  )
}

/* The move stated as what it does to the ledger, not as a sentence about it. Two
   balances before and after, and the history changing hands - the reader is being
   asked to agree to a write across two accounts, and a line saying the money moves
   describes only the half of it they already knew. */
function GlImpactPanel({ impact }: { impact: BalanceMoveImpact }) {
  const money = (n: number) => fmtCurrencyExact(n, impact.currency)
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 h-8 bg-bg-subtle border-b border-border">
        <span className="text-2xs uppercase tracking-wider text-fg-muted" style={{ fontWeight: 700 }}>GL impact</span>
        <span className="text-2xs text-fg-muted tabular-nums">{money(impact.amount)}</span>
      </div>
      <ul className="divide-y divide-border-subtle">
        {impact.rows.map(r => (
          <li key={r.account.id} className="px-3 py-2">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-2xs text-fg-subtle tabular-nums shrink-0">{r.account.accountNumber}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-fg">{r.account.accountName}</span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5 text-[12px] tabular-nums">
              <span className="text-fg-subtle line-through">{money(r.from)}</span>
              <ArrowRight size={11} className="text-fg-subtle shrink-0 self-center" />
              <span className="text-slate-800" style={{ fontWeight: 600 }}>{money(r.to)}</span>
              {r.leaves && <span className="text-2xs text-fg-subtle ml-auto">leaves the chart</span>}
            </div>
          </li>
        ))}
      </ul>
      {/* The part that is not a number, and the thing a reader archiving an
          account most wants to know: the history stays. The move is a new entry
          dated today, not an edit to what was posted. */}
      {impact.postings > 0 && (
        <p className="px-3 py-2 border-t border-border bg-bg-subtle text-2xs leading-snug text-fg-muted">
          {impact.postings} {impact.postings === 1 ? 'posting stays' : 'postings stay'} under {impact.rows[0].account.accountNumber} {impact.rows[0].account.accountName} with the dates {impact.postings === 1 ? 'it was' : 'they were'} posted on. The balance moves as a new journal entry dated today.
        </p>
      )}
    </div>
  )
}

/* Where the money goes. Only offered when there is money to move, and only ever
   listing accounts the rules will accept, so a reader cannot pick a destination
   the store then refuses. The hint names where the list is drawn from: under the
   summary (Mahad, 2026-10-08), or any account with the same role (2026-10-10). */
function DestinationPicker({ move, source, value, onChange }: {
  move: BalanceMove
  source: Account
  value: string
  onChange: (id: string) => void
}) {
  const accounts = useStore(s => s.accounts)
  const summary = moveSummary(source, accounts)
  return (
    <Select label="Move balance to" value={value} onChange={e => onChange(e.target.value)}
      placeholder="Select account" searchable openDown
      hint={summary && (source.accountRole
        ? <>You can move it to an account under <Quoted>{summary.accountNumber}</Quoted> {summary.accountName}, or to any other {source.accountRole} account.</>
        : <>You can only move it to an account under <Quoted>{summary.accountNumber}</Quoted> {summary.accountName}.</>)}>
      {move.destinations.map(d => (
        <option key={d.id} value={d.id}>{d.accountNumber} {d.accountName}</option>
      ))}
    </Select>
  )
}

/* A refusal, said in the same place the action was asked for. One button, because
   there is nothing to decide: the reader is being told why the chart will not do
   this yet, and which accounts to deal with first. */
function RefusalAlert({ spec, onDismiss }: { spec: RefusalSpec; onDismiss: () => void }) {
  const accounts = useStore(s => s.accounts)
  return (
    <ConfirmModal
      open
      tone="warning"
      title={spec.title}
      description={spec.description.map(l => withNumberPills(l, accounts))}
      reasonsTitle={spec.affectedTitle}
      reasons={affectedReasons(spec, accounts)}
      confirmLabel={spec.dismissLabel ?? 'Close'}
      onConfirm={onDismiss}
      onDismiss={onDismiss}
    />
  )
}

const RUN: Record<AccountAction, (id: string, dest?: string) => { ok: boolean; error?: string }> = {
  deactivate: id => useStore.getState().deactivateAccount(id),
  activate: id => useStore.getState().activateAccount(id),
  archive: (id, dest) => useStore.getState().archiveAccount(id, dest),
  unarchive: id => useStore.getState().unarchiveAccount(id),
  delete: id => useStore.getState().deleteAccount(id),
}

/* The plan for whichever of the five was asked for, in the one shape the dialogs
   read. Delete's plan is a different type because it lands on no status, but the
   parts a dialog needs - is it allowed, what does it say, what does it toast - are
   the same parts, so the branch is taken once here rather than at every use. */
const planFor = (action: AccountAction, account: Account) => {
  const ctx = lifecycleCtx(useStore.getState())
  if (action !== 'delete') return planLifecycle(action, account, ctx)
  const p = planDelete(account, ctx)
  return { ...p, needsConfirm: true, balanceMove: undefined }
}

export function useAccountLifecycle() {
  const [single, setSingle] = useState<{ action: AccountAction; account: Account; onDone?: () => void } | null>(null)
  const [bulk, setBulk] = useState<{ action: LifecycleAction; ids: string[]; onDone?: () => void } | null>(null)
  const [refused, setRefused] = useState<RefusalSpec | null>(null)
  const [dest, setDest] = useState('')

  const commit = (action: AccountAction, account: Account, moveTo?: string) => {
    const plan = planFor(action, account)
    const r = RUN[action](account.id, moveTo)
    const store = useStore.getState()
    if (r.ok) store.pushToast(plan.toast, 'success')
    else store.pushToast(r.error ?? 'Action not allowed', 'danger')
  }

  /* `onDone` runs after the action goes through, and only then. It is for a
     surface the action invalidates: the detail page of a deleted account has no
     account left to be the detail of, so it navigates away rather than falling
     through to "Account not found", which reads as a fault rather than as the
     thing the reader just asked for. */
  const request = (asked: AccountAction, account: Account, onDone?: () => void) => {
    /* An archived account comes back by unarchiving, whichever door asked. The
       menus offer "Activate" for both ways back, and read as activate an
       archived account skipped the unarchive confirmation and was logged as
       the wrong action. */
    const action: AccountAction = asked === 'activate' && account.status === 'Archived' ? 'unarchive' : asked
    const plan = planFor(action, account)
    // Every action is offered whatever the answer is, so a refusal is answered
    // here, in a dialog, rather than by a menu item that greys out and leaves the
    // reader to hover for the reason. Delete is the exception, and is absent from
    // the menu rather than refused; the refusal below is the safety net for a menu
    // opened before something posted to the account.
    if (!plan.allowed) { setRefused(plan.refusal!); return }
    if (plan.needsConfirm) { setDest(''); setSingle({ action, account, onDone }) }
    else { commit(action, account); onDone?.() }
  }

  const requestBulk = (action: LifecycleAction, ids: string[], onDone?: () => void) => {
    const plan = planBulk(action, ids, lifecycleCtx(useStore.getState()))
    if (!plan.needsConfirm) {
      // Nothing moved. The selection stays as it is, so the reader can act on
      // whatever the dialog named and try again without re-ticking every row.
      if (plan.refusal) { setRefused(plan.refusal); return }
      useStore.getState().pushToast(plan.toast, 'info')
      onDone?.()
      return
    }
    setBulk({ action, ids, onDone })
  }

  const singlePlan = single && planFor(single.action, single.account)
  const bulkPlan = bulk && planBulk(bulk.action, bulk.ids, lifecycleCtx(useStore.getState()))

  const confirmModal = (
    <>
      {single && singlePlan?.confirm && (
        <LifecycleConfirm
          action={single.action}
          spec={singlePlan.confirm}
          picker={singlePlan.balanceMove ? {
            node: <DestinationPicker move={singlePlan.balanceMove} source={single.account} value={dest} onChange={setDest} />,
            impact: balanceMoveImpact(
              singlePlan.balanceMove, single.account,
              singlePlan.balanceMove.destinations.find(d => d.id === dest),
              // Counted off the ledger rather than off `hasTransactions`, because
              // the reader is being told how many rows change hands.
              useStore.getState().transactions.filter(t => t.accountId === single.account.id).length,
            ),
            answered: !!dest,
          } : undefined}
          onConfirm={() => { commit(single.action, single.account, dest); setSingle(null); single.onDone?.() }}
          onDismiss={() => setSingle(null)}
        />
      )}
      {bulk && bulkPlan?.confirm && (
        <LifecycleConfirm
          action={bulk.action}
          spec={bulkPlan.confirm}
          onConfirm={() => {
            const r = useStore.getState().bulkLifecycle(bulk.action, bulk.ids)
            useStore.getState().pushToast(bulkPlan.toast, r.ok ? 'success' : 'danger')
            bulk.onDone?.()
            setBulk(null)
          }}
          onDismiss={() => setBulk(null)}
        />
      )}
      {refused && <RefusalAlert spec={refused} onDismiss={() => setRefused(null)} />}
    </>
  )

  return { request, requestBulk, confirmModal }
}
