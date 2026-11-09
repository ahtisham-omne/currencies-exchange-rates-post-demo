import { useState, Fragment, type ReactNode } from 'react'
import { Layers, Plus, ListFilter, ChevronDown, ChevronRight, X, Trash2, Info, Sigma, Pencil, MoreVertical } from 'lucide-react'
import { Account, AccountType, ACCOUNT_TYPE_META } from '../types'
import { Button, Modal, Menu, MenuItem, Badge, RequiredMark } from './ui'
import { cn, fmtCurrency } from '../lib/utils'
import { AccountAvatar, StatusChip, CurrencyCell, FxBalanceTooltip } from './AccountTable'
import { ownBalanceOf } from '../lib/currencies'
import { showsSummaryTotal } from '../lib/accountLifecycle'
import { useStore, usePeriodScopedChart, useAccountNumberText } from '../store'
import {
  CoaView, VIEW_TYPE_ORDER,
  rowsForView, sumBalance, lensLabel, buildTempView, groupRows, autoNameView,
} from '../lib/coaViews'

// Dot colour per type, matching the chips used elsewhere in the app.
const TYPE_DOT: Record<string, string> = {
  success: 'bg-success-500', warning: 'bg-warning-500', danger: 'bg-danger-500',
  info: 'bg-info-500', brand: 'bg-brand-500', purple: 'bg-purple-500', teal: 'bg-teal-500', neutral: 'bg-fg-subtle',
}

// ── View tab strip (spec §5.1) ──
export function ViewTabs({ views, activeId, tempView, onSelect, onCloseTemp, onEditTemp, onSaveTemp }: {
  views: CoaView[]
  activeId: string
  tempView: CoaView | null
  onSelect: (id: string) => void
  onCloseTemp: () => void
  // Clicking the unsaved (temporary) tab re-opens the Create view modal to edit
  // its details; the in-tab Save view button persists & shares it.
  onEditTemp: () => void
  onSaveTemp: () => void
}) {
  const tempActive = activeId === '__temp'
  // Rounded pill chips matching the quick-filter pills (Me mode / Asset / …).
  return (
    <div className="flex items-center gap-1.5 min-w-max overflow-x-auto scrollbar-hide">
      {views.map(v => {
        const active = v.id === activeId
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v.id)}
            className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0',
              active ? 'border-primary bg-accent text-primary font-medium' : 'border-border text-fg-muted hover:bg-bg-subtle hover:text-fg')}
          >
            {v.kind === 'all'
              ? <ListFilter size={13} className={cn('shrink-0', active ? 'text-primary' : 'text-fg-subtle')} />
              : <Layers size={13} className={cn('shrink-0', active ? 'text-primary' : 'text-fg-subtle')} />}
            <span>{v.name}</span>
          </button>
        )
      })}
      {/* Temporary (unsaved) chip - its name section is clickable to edit, and
          carries the Save view action + a close affordance. A pill-shaped
          container (not a single <button>) so it can nest the controls. */}
      {tempView && (
        <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs whitespace-nowrap shrink-0',
          tempActive ? 'border-primary bg-accent' : 'border-border')}>
          <button
            type="button"
            onClick={onEditTemp}
            title="Edit view details"
            className={cn('inline-flex items-center gap-1.5 transition-colors',
              tempActive ? 'text-primary font-medium' : 'text-fg-muted hover:text-fg')}
          >
            <Layers size={13} className={cn('shrink-0', tempActive ? 'text-primary' : 'text-fg-subtle')} />
            <span>{tempView.name}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          </button>
          {/* Save view - a text link so the chip height matches the other pills. */}
          <button
            type="button"
            onClick={onSaveTemp}
            className="text-primary font-medium hover:underline"
          >
            Save view
          </button>
          <button
            type="button"
            onClick={onCloseTemp}
            title="Discard view"
            className="w-4 h-4 inline-flex items-center justify-center rounded-full text-fg-subtle hover:bg-danger-50 hover:text-danger-600 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Views dropdown menu (spec §5.2) ──
export function ViewsMenu({ views, activeId, accounts, onSelect, onCreate, ic = 14 }: {
  views: CoaView[]
  activeId: string
  accounts: Account[]
  onSelect: (id: string) => void
  onCreate: () => void
  ic?: number
}) {
  const builtins = views.filter(v => v.builtin)
  const saved = views.filter(v => !v.builtin)
  const item = (v: CoaView, close: () => void) => {
    const rows = rowsForView(v, accounts)
    const meta = v.kind === 'all' ? `${accounts.length}` : `${rows.length} rows`
    const active = v.id === activeId
    const iconCls = active ? 'text-primary' : 'text-fg-subtle'
    return (
      <MenuItem key={v.id} active={active} onClick={() => { onSelect(v.id); close() }}
        icon={v.kind === 'all' ? <ListFilter size={14} className={iconCls} /> : <Layers size={14} className={iconCls} />}>
        <span className="flex items-center gap-2 w-full">
          <span className="flex-1 truncate">{v.name}</span>
          <span className="text-2xs text-fg-subtle shrink-0">{meta}</span>
        </span>
      </MenuItem>
    )
  }
  return (
    <Menu align="right" trigger={
      <button className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-fg shadow-xs hover:bg-bg-subtle transition-colors text-sm font-medium">
        <ListFilter size={ic} className="text-fg-subtle" />
        <span className="hidden md:inline">Views</span>
        <ChevronDown size={ic - 2} className="text-fg-subtle/60" />
      </button>
    }>
      {(close) => (
        <div className="w-[280px] py-1">
          <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-fg-subtle/70 font-semibold">Default views</div>
          {builtins.map(v => item(v, close))}
          {saved.length > 0 && (
            <>
              <div className="my-1 border-t border-border" />
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-fg-subtle/70 font-semibold">Saved views</div>
              {saved.map(v => item(v, close))}
            </>
          )}
          <div className="my-1 border-t border-border" />
          <MenuItem onClick={() => { onCreate(); close() }} icon={<Plus size={14} className="text-primary" />}>
            <span className="text-primary font-semibold">Create view…</span>
          </MenuItem>
        </div>
      )}
    </Menu>
  )
}

// ── View builder modal (spec §5.3) ──
export function ViewBuilderModal({ open, onClose, onApply, initial }: {
  open: boolean
  onClose: () => void
  onApply: (view: CoaView) => void
  // When editing an existing (unsaved) view, seed the fields from it so the
  // modal opens pre-populated; omit / null when creating a fresh view.
  initial?: CoaView | null
}) {
  const [types, setTypes] = useState<AccountType[]>([])
  const [count, setCount] = useState(true)
  const [sum, setSum] = useState(true)
  const [name, setName] = useState('')

  // Seed from `initial` when editing, else clear. Runs every time it opens.
  const reset = () => {
    if (initial) {
      setTypes(initial.types ?? [])
      setCount(initial.agg.count)
      setSum(initial.agg.sum)
      setName(initial.name)
    } else {
      setTypes([]); setCount(true); setSum(true); setName('')
    }
  }
  const toggleType = (t: AccountType) => setTypes(ts => ts.includes(t) ? ts.filter(x => x !== t) : [...ts, t])

  // Suggested name from the chosen layers; used as the placeholder and the
  // fallback when the user leaves the name blank.
  const autoName = autoNameView(types.length ? types : null, null)

  const apply = () => {
    const v = buildTempView(types, null, { count, sum })
    onApply({ ...v, name: name.trim() || autoName })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="xl"
      panelClassName="!max-w-[820px]"
      title="Create view"
      subtitle="A view is a saved lens. It filters or groups what you see; the underlying accounts never change."
      footerAlign="between"
      footer={
        <>
          <span className="text-2xs text-fg-subtle inline-flex items-center gap-1.5"><Plus size={12} /> This applies a temporary view to your chart of accounts, save it to share this with your team.</span>
          <span className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={apply}>Apply view</Button>
          </span>
        </>
      }
    >
      {/* Builder resets its fields whenever it (re)opens. */}
      <BuilderReset open={open} reset={reset} />
      <div className="space-y-4">
        {/* View name - defaults to the auto-suggested name if left blank. */}
        <SectionCard icon={<Info size={16} />} title="View details">
          <label className="label block mb-1.5">View name<RequiredMark show /></label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={autoName}
            className="input"
          />
          <p className="text-xs text-fg-subtle mt-1.5">Leave blank to use the auto-suggested name.</p>
        </SectionCard>

        {/* Step 1 - Filter by account type */}
        <SectionCard icon={<ListFilter size={16} />} title="Filter by account type">
          <div className="flex flex-wrap gap-1.5">
            {VIEW_TYPE_ORDER.map(t => {
              const m = ACCOUNT_TYPE_META[t]
              const on = types.includes(t)
              return (
                <button key={t} type="button" onClick={() => toggleType(t)}
                  className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
                    on ? 'border-primary bg-accent text-primary' : 'border-border bg-white text-fg-muted hover:bg-bg-subtle')}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', TYPE_DOT[m.color] ?? 'bg-fg-subtle')} />
                  {m.label}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-fg-subtle mt-2.5">
            {types.length ? <><span className="font-semibold text-fg-muted">{types.length} of {VIEW_TYPE_ORDER.length}</span> types included.</> : 'Leave all unselected to include every type.'}
          </p>
        </SectionCard>

        {/* Step 2 - Aggregation */}
        <SectionCard icon={<Sigma size={16} />} title="Aggregation">
          <div className="flex items-center gap-5">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={count} onChange={e => setCount(e.target.checked)} className="w-4 h-4 accent-[hsl(var(--primary))]" /> Count rows</label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={sum} onChange={e => setSum(e.target.checked)} className="w-4 h-4 accent-[hsl(var(--primary))]" /> Sum of balance</label>
          </div>
        </SectionCard>
      </div>
    </Modal>
  )
}

// Titled section card - a light header strip with a leading icon and a small
// uppercase badge, then the body. Mirrors the SectionCard used by the Create
// New Account modal so the Create view modal matches the app's other Create
// modals (colours, fonts, spacing, layout).
function SectionCard({ icon, title, badge, children }: { icon?: ReactNode; title: string; badge?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-bg-subtle/50">
        {icon && <span className="text-primary shrink-0">{icon}</span>}
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {badge && <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-fg-subtle">{badge}</span>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// Tiny helper: reset the builder's local state when it opens (kept out of the
// modal body so the hook order stays stable).
function BuilderReset({ open, reset }: { open: boolean; reset: () => void }) {
  const [seen, setSeen] = useState(false)
  if (open && !seen) { setSeen(true); reset() }
  if (!open && seen) setSeen(false)
  return null
}

// ── Lens table (spec §5.5) ──
// Renders the view's visible rows - flat, or as collapsible group sections with
// subtotals. Built from the app's existing cell components (avatar, type badge,
// status chip, currency) so it matches the main table without forcing arbitrary
// group-by into AccountTable's hierarchy. The "All accounts" view never uses
// this - it keeps the full AccountTable/AccountTree.

/* The FX figure restates each balance in the account's own currency, so a row set
   spanning several currencies has no total: adding GBP to EUR produces a number
   denominated in nothing. Only a single-currency set gets a figure, and it is
   labelled with that currency. Postings only, for the same reason as sumBalance.

   Each balance is restated at the rate it was booked at, so the subtotal is the
   sum of what the ledger carries. Re-converting at today's rate would total a
   set of figures that were never posted, and would drift from the Balance
   column's total by the unrealized movement. */
function sumFx(rows: Account[]): { total: number; code: string } | null {
  const posting = rows.filter(a => a.isPosting)
  const codes = new Set(posting.map(a => a.currencyCode))
  if (codes.size !== 1) return null
  const code = posting[0].currencyCode
  return { total: posting.reduce((s, a) => s + ownBalanceOf(a), 0), code }
}

// `balance` is passed in rather than read off the account: a summary account
// stores none, its figure being the total of the accounts beneath it. The lens is
// a flat list, so that total comes from the chart index and covers the whole
// branch, including accounts this view filters out.
function LensRow({ a, padY, base, balance, onOpen }: { a: Account; padY: string; base: string; balance: number; onOpen: (a: Account) => void }) {
  const m = ACCOUNT_TYPE_META[a.accountType]
  const nonBase = a.currencyCode !== base
  const summary = !a.isPosting
  const num = useAccountNumberText()(a.accountNumber)
  return (
    <tr className={cn('border-b border-border-subtle hover:bg-bg-subtle/60 cursor-pointer', summary && 'bg-slate-50/60')} onClick={() => onOpen(a)}>
      <td className={cn('px-4 text-slate-600 tabular-nums', padY)} title={a.accountNumber}>{num}</td>
      <td className={cn('px-4', padY)}>
        <span className="flex items-center gap-2.5 min-w-0">
          <AccountAvatar name={a.accountName} number={num} />
          <span className="text-[13px] truncate" style={{ fontWeight: summary ? 600 : 500, color: '#1E293B' }}>{a.accountName}</span>
        </span>
      </td>
      <td className={cn('px-4', padY)}><Badge tone={m.color}>{m.label}</Badge></td>
      <td className={cn('px-4 text-slate-600', padY)}>{a.statementClassification}</td>
      <td className={cn('px-4', padY)}>{summary ? <span className="text-fg-subtle">-</span> : <CurrencyCell code={a.currencyCode} />}</td>
      <td className={cn('px-4 text-right tabular-nums whitespace-nowrap', padY, balance < 0 ? 'text-slate-900' : 'text-success-700')} style={{ fontWeight: summary ? 600 : 500 }}>
        {showsSummaryTotal(a) ? fmtCurrency(balance) : <span className="text-fg-subtle">-</span>}
      </td>
      <td className={cn('px-4 text-right tabular-nums whitespace-nowrap', padY, balance < 0 ? 'text-slate-900' : 'text-success-700')} style={{ fontWeight: 500 }}>
        {!summary && nonBase
          ? <FxBalanceTooltip code={a.currencyCode} base={base} booked={balance} own={ownBalanceOf({ ...a, balance })}><span className="cursor-help">{fmtCurrency(ownBalanceOf({ ...a, balance }), a.currencyCode)}</span></FxBalanceTooltip>
          : <span className="text-fg-subtle">-</span>}
      </td>
      <td className={cn('px-4', padY)}><StatusChip status={a.status} /></td>
    </tr>
  )
}

export function CoaLensTable({ view, rows, density, collapsed, onToggleSection, onOpen }: {
  view: CoaView
  rows: Account[]
  density: 'condensed' | 'comfortable'
  collapsed: Set<string>
  onToggleSection: (key: string) => void
  onOpen: (a: Account) => void
}) {
  const padY = density === 'condensed' ? 'py-2' : 'py-3'
  const index = usePeriodScopedChart()
  const base = useStore(s => s.company.baseCurrency)
  const grouped = view.kind === 'group'
  const sections = grouped ? groupRows(rows, view.groupBy ?? 'type') : []
  return (
    <table className="w-full text-sm">
      <thead>
        {/* Header matches the main AccountTable exactly: fixed h-10 cells (h-8 in
            Condensed) so entering a View never changes the header height/size. */}
        <tr className={cn('border-b border-border bg-muted/30 text-muted-foreground text-xs [&>th]:h-10 [&>th]:px-4 [&>th]:text-left [&>th]:font-normal [&>th]:align-middle [&>th]:whitespace-nowrap', density === 'condensed' && '[&>th]:!h-8')}>
          <th style={{ width: 96 }}>Number</th>
          <th>Account</th>
          <th style={{ width: 120 }}>Type</th>
          <th>Statement classification</th>
          <th style={{ width: 110 }}>Currency</th>
          <th className="!text-right" style={{ width: 150 }}>Balance</th>
          <th className="!text-right" style={{ width: 150 }}>FX Balance</th>
          <th style={{ width: 110 }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr><td colSpan={9} className="text-center py-12 text-fg-subtle text-[13px]">No accounts match this view.</td></tr>
        )}
        {grouped
          ? sections.map(g => {
              const isCollapsed = collapsed.has(g.key)
              const fxSubtotal = sumFx(g.rows)
              const gCount = g.rows.reduce((n, a) => (a.isPosting ? n + 1 : n), 0)
              return (
                <Fragment key={g.key}>
                  <tr className="border-b border-border bg-bg-subtle/60 cursor-pointer select-none" onClick={() => onToggleSection(g.key)}>
                    <td colSpan={6} className={cn('px-4', padY)}>
                      <span className="inline-flex items-center gap-2 font-semibold text-fg">
                        <ChevronRight size={14} className={cn('text-fg-subtle transition-transform', !isCollapsed && 'rotate-90')} />
                        {g.key}
                        <span className="text-2xs font-medium text-fg-subtle">{gCount} account{gCount === 1 ? '' : 's'}</span>
                      </span>
                    </td>
                    <td className={cn('px-4 text-right tabular-nums font-semibold whitespace-nowrap', padY, g.subtotal < 0 ? 'text-slate-900' : 'text-success-700')}>
                      {fmtCurrency(g.subtotal)}
                    </td>
                    <td className={cn('px-4 text-right tabular-nums font-semibold whitespace-nowrap', padY, fxSubtotal && fxSubtotal.total < 0 ? 'text-slate-900' : 'text-success-700')}>
                      {fxSubtotal ? fmtCurrency(fxSubtotal.total, fxSubtotal.code) : <span className="font-normal text-fg-muted">Mixed currencies</span>}
                    </td>
                    <td className={cn('px-4', padY)} />
                  </tr>
                  {!isCollapsed && g.rows.map(a =>
                    <LensRow key={a.id} a={a} padY={padY} base={base} balance={index.figuresOf(a.id).balance} onOpen={onOpen} />)}
                </Fragment>
              )
            })
          : rows.map(a =>
              <LensRow key={a.id} a={a} padY={padY} base={base} balance={index.figuresOf(a.id).balance} onOpen={onOpen} />)}
      </tbody>
    </table>
  )
}

// ── Pinned aggregation bar (spec §5.4) ──
// `rows` are the rows actually visible in the view (after every active filter),
// so the totals reflect exactly what's on screen - "aggregation follows the lens".
export function ViewAggBar({ view, rows, onEdit, onRemove }: { view: CoaView; rows: Account[]; onEdit: () => void; onRemove: () => void }) {
  const total = sumBalance(rows)
  const fx = sumFx(rows)
  // Counts the same rows the sums cover, so the bar can be read as one statement:
  // N accounts holding this much. Subtotal rows are structure, not accounts.
  const acctCount = rows.reduce((n, a) => (a.isPosting ? n + 1 : n), 0)
  return (
    <div className="flex items-stretch bg-accent border-b border-border sticky top-0 z-10 min-h-[56px]">
      {/* Left: view name with the row count beneath it (sentence case). */}
      <div className="flex flex-col justify-center px-4 py-2.5">
        <div className="text-sm font-semibold text-fg">
          {view.name}
          {view.kind === 'group' && view.groupBy && <span className="font-normal text-fg-muted"> · {lensLabel(view)}</span>}
        </div>
        {view.agg.count && (
          <div className="text-xs text-fg-muted mt-0.5 tabular-nums">{acctCount} {acctCount === 1 ? 'account' : 'accounts'}</div>
        )}
      </div>
      {/* Right: Sum of balance + Sum of FX balance (labels styled like table
          header cells, values like balance cells) then the per-view actions. */}
      <div className="flex items-stretch ml-auto">
        {view.agg.sum && (
          <>
            <div className="flex flex-col justify-center px-4 py-2.5 border-l border-border text-right min-w-[150px]">
              <div className="text-xs font-normal text-muted-foreground">Sum of balance</div>
              <div className={cn('tabular-nums text-sm font-medium mt-0.5', total < 0 ? 'text-slate-900' : 'text-success-700')}>{fmtCurrency(total)}</div>
            </div>
            <div className="flex flex-col justify-center px-4 py-2.5 border-l border-border text-right min-w-[150px]">
              <div className="text-xs font-normal text-muted-foreground">Sum of FX balance</div>
              {fx ? (
                <div className={cn('tabular-nums text-sm font-medium mt-0.5', fx.total < 0 ? 'text-slate-900' : 'text-success-700')}>{fmtCurrency(fx.total, fx.code)}</div>
              ) : (
                <div className="text-xs text-fg-muted mt-0.5">Mixed currencies</div>
              )}
            </div>
          </>
        )}
        {/* Per-view actions: Edit View / Remove. */}
        <div className="flex items-center px-2 border-l border-border">
          <Menu align="right" trigger={
            <button className="w-7 h-7 inline-flex items-center justify-center rounded-md text-fg-subtle hover:bg-white/60 hover:text-fg transition-colors" title="View actions">
              <MoreVertical size={16} />
            </button>
          }>
            {(close) => (
              <div className="w-44 py-1">
                <MenuItem icon={<Pencil size={14} className="text-fg-subtle" />} onClick={() => { onEdit(); close() }}>Edit View</MenuItem>
                <MenuItem danger icon={<Trash2 size={14} />} onClick={() => { onRemove(); close() }}>Remove</MenuItem>
              </div>
            )}
          </Menu>
        </div>
      </div>
    </div>
  )
}
