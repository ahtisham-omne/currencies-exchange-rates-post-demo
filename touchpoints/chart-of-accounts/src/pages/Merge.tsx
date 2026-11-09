import { useMemo, useState } from 'react'
import { Merge, ArrowRight, AlertTriangle, Check, Search, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader, Button, Badge, Banner, Input, Marked, Select, ConfirmModal } from '../components/ui'
import { useStore } from '../store'
import { ACCOUNT_TYPE_META, Account, AccountType } from '../types'
import { fmtCurrency, fmtNumber } from '../lib/utils'
import { searchMatcher } from '../lib/tableSearch'

export default function MergePage() {
  const navigate = useNavigate()
  const store = useStore()
  const [params] = useSearchParams()
  const initialSource = params.get('source')
  const [step, setStep] = useState<'select' | 'preview' | 'done'>('select')
  const [type, setType] = useState<AccountType>(
    initialSource ? store.accounts.find(a => a.id === initialSource)?.accountType ?? 'EXP' : 'EXP'
  )
  const [sources, setSources] = useState<string[]>(initialSource ? [initialSource] : [])
  const [target, setTarget] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Postings per account, counted once rather than once per row drawn.
  const txCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of store.transactions) m.set(t.accountId, (m.get(t.accountId) ?? 0) + 1)
    return m
  }, [store.transactions])
  const txsOf = (id: string) => txCount.get(id) ?? 0

  /* Every column the table prints - number, name, balance and transactions - by
     the text it prints, and marked where it matched. Mahad, 2026-10-05: *"the
     search should have everything in it."* The survivor list beside it shows the
     same four facts, so it is found and marked the same way. */
  const candidates = useMemo(() => {
    const found = searchMatcher(search)
    return store.accounts.filter(a => a.accountType === type && a.isPosting && a.status === 'Active' && (
      !search.trim() || [a.accountNumber, a.accountName, fmtCurrency(a.balance), String(txCount.get(a.id) ?? 0)].some(found)
    ))
  }, [store.accounts, type, search, txCount])

  const sourceAccounts = sources.map(id => store.accounts.find(a => a.id === id)).filter(Boolean) as Account[]
  const targetAccount = target ? store.accounts.find(a => a.id === target) : null
  const totalTxs = sources.reduce((s, id) => s + txsOf(id), 0)
  const resultBalance = (targetAccount?.balance ?? 0) + sourceAccounts.reduce((s, a) => s + a.balance, 0)

  const confirmMerge = () => {
    if (!target) return
    const targetName = targetAccount?.accountName ?? ''
    const n = sources.length
    const r = store.mergeAccounts(sources, target)
    if (!r.ok) { setConfirmOpen(false); store.pushToast(r.error ?? 'Merge failed', 'danger'); return }
    setConfirmOpen(false)
    store.pushToast(`${n} source account(s) deactivated. ${fmtNumber(totalTxs)} transactions reassigned to ${targetName}.`, 'success')
    navigate(`/chart-of-accounts/${target}`)
  }

  return (
    <div className="pb-12">
      <PageHeader
        icon={<Merge size={18} />}
        title="Merge accounts"
        subtitle="Consolidate duplicate accounts. Historical transactions move to the surviving account so reporting stays continuous. Audited and not reversible."
        secondaryActions={<Button variant="ghost" icon={<X size={14} />} onClick={() => navigate('/chart-of-accounts')}>Exit</Button>}
      />

      <div className="px-6 pt-4">
        <Banner tone="warning" title="Merging is not reversible">
          Sources are deactivated and their balances and transactions reassign to the target. Same account type only. The full action is logged to the audit trail.
        </Banner>
      </div>

      <div className="px-6 mt-5">
        {step === 'select' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader
                title="1 · Select sources to merge"
                subtitle="Selected accounts will be deactivated and their history reassigned to the target."
                action={
                  <div className="flex items-center gap-2">
                    <Select value={type} onChange={e => { setType(e.target.value as AccountType); setSources([]); setTarget(null) }} className="!h-8 !text-xs !w-40">
                      {(Object.keys(ACCOUNT_TYPE_META) as AccountType[]).map(t => <option key={t} value={t}>{ACCOUNT_TYPE_META[t].label}</option>)}
                    </Select>
                    <div className="relative">
                      <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-fg-subtle" />
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="input h-8 text-xs pl-7 w-44" />
                    </div>
                  </div>
                }
              />
              <div className="max-h-[480px] overflow-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead className="bg-bg-subtle text-xs text-fg-muted sticky top-0">
                    <tr><th className="px-3 py-2 text-left w-10"></th><th className="px-3 py-2 text-left">Number</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-right">Balance</th><th className="px-3 py-2 text-right">Txs</th></tr>
                  </thead>
                  <tbody>
                    {candidates.map(a => {
                      const isSrc = sources.includes(a.id)
                      const isTarget = target === a.id
                      return (
                        <tr key={a.id} className="border-b border-border-subtle hover:bg-bg-subtle/60">
                          <td className="px-3 py-2">
                            <input type="checkbox" disabled={isTarget} checked={isSrc} onChange={e => {
                              if (e.target.checked) setSources(s => [...s, a.id])
                              else setSources(s => s.filter(x => x !== a.id))
                            }} />
                          </td>
                          <td className="px-3 py-2 text-xs"><Marked text={a.accountNumber} q={search} /></td>
                          <td className="px-3 py-2"><Marked text={a.accountName} q={search} /> {isTarget && <Badge tone="brand" className="ml-1">Target</Badge>}</td>
                          <td className="px-3 py-2 text-right"><Marked text={fmtCurrency(a.balance)} q={search} /></td>
                          <td className="px-3 py-2 text-right text-fg-muted"><Marked text={String(txsOf(a.id))} q={search} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardHeader title="2 · Select survivor" subtitle="The target receives all transactions and combined balance." />
              <div className="p-4 space-y-2 max-h-[480px] overflow-auto scrollbar-thin">
                {candidates.filter(a => !sources.includes(a.id)).map(a => (
                  <button key={a.id} onClick={() => setTarget(a.id)}
                    className={"w-full text-left p-3 rounded-md border " + (target === a.id ? 'border-brand-500 bg-brand-50' : 'border-border hover:bg-bg-subtle')}>
                    <div className="text-xs text-fg-subtle"><Marked text={a.accountNumber} q={search} /></div>
                    <div className="text-sm font-medium"><Marked text={a.accountName} q={search} /></div>
                    <div className="text-2xs text-fg-muted mt-0.5">Balance <Marked text={fmtCurrency(a.balance)} q={search} /> · <Marked text={String(txsOf(a.id))} q={search} /> transactions</div>
                  </button>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-border">
                <Button disabled={!target || sources.length === 0} onClick={() => setStep('preview')}>Preview merge →</Button>
              </div>
            </Card>
          </div>
        )}

        {step === 'preview' && targetAccount && (
          <div className="max-w-5xl space-y-4">
            <Card>
              <CardHeader title="3 · Preview" subtitle="Review what will happen before confirming." />
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <div className="text-2xs uppercase tracking-wider text-fg-subtle font-semibold mb-2">Sources ({sources.length})</div>
                  <div className="space-y-2">
                    {sourceAccounts.map(a => (
                      <div key={a.id} className="p-3 border border-border rounded-md bg-bg-subtle">
                        <div className="text-sm font-medium">{a.accountNumber} · {a.accountName}</div>
                        <div className="text-2xs text-fg-muted mt-0.5">Balance {fmtCurrency(a.balance)} · {store.transactions.filter(t => t.accountId === a.id).length} txs · will be deactivated</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-2xs uppercase tracking-wider text-fg-subtle font-semibold mb-2">Survivor</div>
                  <div className="p-3 border-2 border-brand-500 rounded-md bg-brand-50">
                    <div className="text-sm font-semibold">{targetAccount.accountNumber} · {targetAccount.accountName}</div>
                    <div className="text-xs text-fg-muted mt-1">After merge:</div>
                    <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white rounded p-2 border border-brand-200">
                        <div className="text-2xs text-fg-subtle">Combined balance</div>
                        <div className="font-semibold text-fg">{fmtCurrency(resultBalance)}</div>
                      </div>
                      <div className="bg-white rounded p-2 border border-brand-200">
                        <div className="text-2xs text-fg-subtle">Transactions to reassign</div>
                        <div className="font-semibold text-fg">{fmtNumber(totalTxs)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('select')}>← Back</Button>
              <Button onClick={() => setConfirmOpen(true)} icon={<Merge size={14} />}>Confirm merge</Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <Card className="p-10 text-center max-w-2xl">
            <div className="w-16 h-16 rounded-full bg-success-100 text-success-700 flex items-center justify-center mx-auto"><Check size={28} /></div>
            <h3 className="text-lg font-semibold mt-4">Merge complete</h3>
            <p className="text-sm text-fg-muted mt-1">{sources.length} source account(s) deactivated. {fmtNumber(totalTxs)} transactions reassigned to <strong>{targetAccount?.accountName}</strong>.</p>
            <div className="mt-5 flex justify-center gap-2">
              <Button variant="secondary" onClick={() => { setStep('select'); setSources([]); setTarget(null) }}>Merge another</Button>
              <Button onClick={() => navigate('/chart-of-accounts')}>Back to Chart of Accounts</Button>
            </div>
          </Card>
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        tone="danger"
        badge="Merge"
        title="Confirm merge"
        description={[
          `This reassigns ${fmtNumber(totalTxs)} transactions from ${sources.length} source(s) into ${targetAccount?.accountName ?? 'the target account'}.`,
          'The action is audited and cannot be reversed by your tenant.',
        ]}
        confirmLabel="Merge now"
        dismissLabel="Cancel"
        onConfirm={confirmMerge}
        onDismiss={() => setConfirmOpen(false)}
      />
    </div>
  )
}
