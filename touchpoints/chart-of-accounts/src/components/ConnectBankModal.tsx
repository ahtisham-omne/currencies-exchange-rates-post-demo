import { useEffect, useMemo, useState } from 'react'
import { Search, Check, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Lock, Unlink, Landmark, Wallet, PiggyBank, TrendingUp, Link2, Loader2 } from 'lucide-react'
import { FormModal, Button } from './ui'
import { BankLogo } from './BankLogo'
import { useStore } from '../store'
import { cn } from '../lib/utils'
import type { BankInstitution } from '../lib/bankInstitutions'
import { BANK_INSTITUTIONS, searchInstitutions, getInstitution, getInstitutionByName } from '../lib/bankInstitutions'
import type { FeedAccount, FeedAccountSubtype } from '../lib/mockBankSync'
import { getInstitutionFeedAccounts, getFeedSubtypeLabel } from '../lib/mockBankSync'

// =============================================================
// ConnectBankModal
// =============================================================
// A self-contained "Connect a bank" wizard that mirrors the Cash Management
// banking flow (1 Bank → 2 Sign in → 3 Connect account). Opened from the
// "Connect a bank feed" link in Create Account's Bank details section. When the
// user has already picked an institution (via the combobox), the picker step is
// skipped and the wizard opens straight on Sign in; the picker only appears as a
// fallback when the typed bank name matches nothing in the catalogue.

// Subtype icon + tint for each returned feed account - mirrors Cash Management.
const SUBTYPE_ICON: Record<FeedAccountSubtype, typeof Wallet> = {
  checking: Wallet,
  savings: PiggyBank,
  money_market: TrendingUp,
  operating: Landmark,
}
const SUBTYPE_TINT: Record<FeedAccountSubtype, { bg: string; color: string; iconBg: string; iconColor: string }> = {
  checking: { bg: '#EFF6FF', color: '#1D4ED8', iconBg: '#DBEAFE', iconColor: '#1D4ED8' },
  savings: { bg: '#ECFDF5', color: '#047857', iconBg: '#D1FAE5', iconColor: '#047857' },
  money_market: { bg: '#F5F3FF', color: '#6D28D9', iconBg: '#EDE9FE', iconColor: '#6D28D9' },
  operating: { bg: '#FFFBEB', color: '#A16207', iconBg: '#FEF3C7', iconColor: '#A16207' },
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
const money = (n: number, ccy = 'USD') => n.toLocaleString('en-US', { style: 'currency', currency: ccy })

// Resolve the institution the user already chose: by id first (from the
// combobox), then by matching the typed name against the catalogue.
function resolveInstitution(id?: string, name?: string): BankInstitution | null {
  return (id ? getInstitution(id) : undefined) ?? getInstitutionByName(name ?? '') ?? null
}

type Step = 'bank' | 'signin' | 'map'
type SignInPhase = 'intro' | 'login' | 'connecting' | 'connected'

export function ConnectBankModal({
  open, onClose, initialBankName, selectedInstitutionId, glAccountLabel, accountType, accountNumber, accountTitle, currencyCode = 'USD', onConnected,
}: {
  open: boolean
  onClose: () => void
  initialBankName?: string
  selectedInstitutionId?: string
  glAccountLabel?: string
  accountType?: string
  accountNumber?: string
  accountTitle?: string
  currencyCode?: string
  onConnected?: () => void
}) {
  const store = useStore()
  const [step, setStep] = useState<Step>('bank')
  const [query, setQuery] = useState('')
  const [popularOnly, setPopularOnly] = useState(false)
  const [selected, setSelected] = useState<BankInstitution | null>(null)
  const [signInPhase, setSignInPhase] = useState<SignInPhase>('intro')
  // Bank-side ids the user has chosen to bring in. In this flow the matched
  // account is pre-selected; other returned accounts render view-only.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // Whether the wizard opened straight on Sign in because the institution was
  // already known - controls the stepper and the Back target.
  const [skipBank, setSkipBank] = useState(false)

  useEffect(() => {
    if (!open) return
    const known = resolveInstitution(selectedInstitutionId, initialBankName)
    setSkipBank(!!known)
    setStep(known ? 'signin' : 'bank')
    setQuery('')
    setPopularOnly(false)
    setSelected(known)
    setSignInPhase('intro')
    setSelectedIds(new Set())
  }, [open, initialBankName, selectedInstitutionId])

  // Faux secure sign-in: Connecting… → Connected → advance to account mapping.
  useEffect(() => {
    if (signInPhase === 'connecting') {
      const t = setTimeout(() => setSignInPhase('connected'), 1500)
      return () => clearTimeout(t)
    }
    if (signInPhase === 'connected') {
      const t = setTimeout(() => { setStep('map'); setSignInPhase('intro') }, 1500)
      return () => clearTimeout(t)
    }
  }, [signInPhase])

  const counts = useMemo(() => ({
    All: BANK_INSTITUTIONS.length,
    Popular: BANK_INSTITUTIONS.filter(b => b.isPopular).length,
  }), [])

  const shown = useMemo(() => {
    return searchInstitutions(query)
      .filter(b => (popularOnly ? b.isPopular : true))
      .sort((a, b) => Number(b.isPopular) - Number(a.isPopular) || a.name.localeCompare(b.name))
  }, [query, popularOnly])

  const bank = selected
  // Steps shown in the header stepper - the picker is dropped when the bank was
  // already resolved before opening.
  const STEPS: { id: Step; label: string }[] = skipBank
    ? [{ id: 'signin', label: 'Sign in' }, { id: 'map', label: 'Connect account' }]
    : [{ id: 'bank', label: 'Bank' }, { id: 'signin', label: 'Sign in' }, { id: 'map', label: 'Connect account' }]

  // The accounts the institution "returns", auto-matched against the number the
  // user entered in Banking details. The matched row is pre-selected; the rest
  // render view-only for context.
  const acctLast4 = (accountNumber ?? '').replace(/\D/g, '').slice(-4)
  const feedAccounts = useMemo<FeedAccount[]>(
    () => (bank ? getInstitutionFeedAccounts(bank.id, acctLast4 || undefined) : []),
    [bank, acctLast4],
  )
  const autoMatchedId = feedAccounts[0]?.id ?? null

  // Pre-select the matched account whenever we arrive on the mapping step.
  useEffect(() => {
    if (step === 'map' && autoMatchedId) setSelectedIds(new Set([autoMatchedId]))
  }, [step, autoMatchedId])

  const toggleAccount = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const finish = () => {
    onConnected?.()
    store.pushToast(`Bank feed connected to ${selected?.name ?? 'your bank'}`, 'success', glAccountLabel ? `Transactions will import automatically into ${glAccountLabel}.` : undefined)
    onClose()
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      icon={<Landmark size={18} />}
      title="Connect a bank"
      subtitle="Connect your bank so transactions import automatically, with no manual entry."
      headerExtra={
        <div className="flex items-center gap-6 overflow-x-auto pb-px">
          {STEPS.map((s, i) => {
            const idx = STEPS.findIndex(x => x.id === step)
            const active = s.id === step
            const done = i < idx
            return (
              <div key={s.id} className="relative flex items-center gap-2 pb-3 whitespace-nowrap">
                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[12px] shrink-0',
                  done ? 'bg-emerald-500 text-white' : active ? 'bg-primary text-white' : 'border-[1.5px] border-slate-300 text-slate-500 bg-white')}
                  style={{ fontWeight: 600 }}>
                  {done ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className={cn('text-[13px]', active ? 'text-primary' : done ? 'text-emerald-600' : 'text-slate-600')}
                  style={{ fontWeight: active || done ? 600 : 500 }}>{s.label}</span>
                {(active || done) && <div className={cn('absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full', done ? 'bg-emerald-500' : 'bg-primary')} />}
              </div>
            )
          })}
        </div>
      }
      footer={
        step === 'bank' ? (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => { setSignInPhase('intro'); setStep('signin') }} disabled={!selected} iconRight={<ArrowRight size={14} />}>Continue</Button>
          </>
        ) : step === 'signin' ? (
          <>
            {!skipBank && <Button variant="ghost" className="mr-auto" icon={<ArrowLeft size={14} />} onClick={() => setStep('bank')}>Back</Button>}
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" className="mr-auto" icon={<ArrowLeft size={14} />} onClick={() => { setSignInPhase('intro'); setStep('signin') }}>Back</Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={finish} disabled={selectedIds.size === 0} icon={<Link2 size={14} />}>Connect account</Button>
          </>
        )
      }
    >
      {/* ---------- Step 1: pick the institution ---------- */}
      {step === 'bank' && (
        <div className="p-6">
          <h3 className="text-sm font-semibold text-fg">Which bank are you connecting?</h3>
          <p className="text-xs text-fg-muted mt-0.5">Search for the institution that holds your accounts. You'll sign in on their secure site next. We never see or store your login.</p>

          <div className="relative mt-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by bank name"
              className="h-10 w-full pl-9 pr-3 text-sm bg-white rounded-lg border border-border shadow-xs focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none" />
          </div>

          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            {([['All', false], ['Popular', true]] as const).map(([label, only]) => (
              <button key={label} onClick={() => setPopularOnly(only)}
                className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors',
                  popularOnly === only ? 'border-primary bg-accent text-primary font-medium' : 'border-border text-fg-muted hover:bg-bg-subtle hover:text-fg')}>
                {label}
                <span className={cn('text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center font-semibold', popularOnly === only ? 'bg-primary/10 text-primary' : 'bg-bg-muted text-fg-muted')}>{only ? counts.Popular : counts.All}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-4">
            {shown.map(b => {
              const isSel = selected?.id === b.id
              return (
                <button key={b.id} onClick={() => setSelected(b)}
                  className={cn('relative flex items-center gap-3 rounded-xl border p-3 text-left bg-white transition-all',
                    isSel ? 'border-primary ring-2 ring-primary/15 shadow-sm' : 'border-border hover:border-slate-300 hover:shadow-sm')}>
                  <BankLogo bankName={b.name} domain={b.domain} initials={b.initials} color={b.primaryColor} />
                  <span className="min-w-0">
                    <span className="block text-[13px] text-fg truncate" style={{ fontWeight: 600 }}>{b.name}</span>
                    {b.isPopular && <span className="block text-[11px] text-fg-muted">Popular</span>}
                  </span>
                  {isSel && <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center"><Check className="w-3 h-3" /></span>}
                </button>
              )
            })}
            {shown.length === 0 && <div className="col-span-full py-10 text-center text-sm text-fg-muted">No banks match "{query}".</div>}
          </div>
        </div>
      )}

      {/* ---------- Step 2: secure sign-in ---------- */}
      {step === 'signin' && bank && (
        <div className="p-6">
          <h3 className="text-sm font-semibold text-fg">Sign in with {bank.name}</h3>
          <p className="text-xs text-fg-muted mt-0.5">{bank.name} opens in a new window for you to sign in. You choose which accounts to share before anything connects.</p>

          <div className="mt-4 rounded-xl border border-border bg-white p-5 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <BankLogo bankName={bank.name} domain={bank.domain} initials={bank.initials} color={bank.primaryColor} size={40} />
                <div className="min-w-0">
                  <p className="text-[14px] text-fg" style={{ fontWeight: 600 }}>{bank.name}</p>
                  <p className="text-[12px] text-fg-muted">You'll be taken to their secure login page.</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-600 shrink-0" style={{ fontWeight: 500 }}><BadgeCheck size={14} /> Secure handoff</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-lg bg-bg-subtle flex items-center justify-center text-fg-muted shrink-0"><Lock size={16} /></span>
              <div>
                <p className="text-[14px] text-fg" style={{ fontWeight: 600 }}>Your sign-in stays private</p>
                <p className="text-[12px] text-fg-muted">You enter your details only on {bank.name}'s site. Omne never sees or stores them.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0"><Unlink size={16} /></span>
              <div>
                <p className="text-[14px] text-fg" style={{ fontWeight: 600 }}>Disconnect anytime</p>
                <p className="text-[12px] text-fg-muted">Once an account is connected, you can disconnect it anytime and we stop syncing right away.</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 pt-1">
              <button onClick={() => setSignInPhase('login')} className="inline-flex items-center gap-1.5 h-11 px-6 rounded-xl bg-primary hover:bg-[#0862D0] text-white text-sm transition-colors" style={{ fontWeight: 600 }}>
                Continue to {bank.name} <ArrowUpRight size={15} />
              </button>
              <span className="text-2xs text-fg-subtle">Secured by <span style={{ fontWeight: 600 }}>Plaid</span></span>
            </div>
          </div>

          {/* Secure sign-in popup, rendered as an overlay on top of the wizard. */}
          {(signInPhase === 'login' || signInPhase === 'connecting' || signInPhase === 'connected') && (
            <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
              <div className="absolute inset-0 coa-scrim animate-overlay-in" onClick={() => { if (signInPhase === 'login') setSignInPhase('intro') }} />
              <div className="relative w-full max-w-md rounded-xl border border-border bg-white shadow-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-3 h-9 border-b border-border bg-bg-subtle/60">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" /><span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" /><span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                  </div>
                  <div className="flex-1 flex items-center justify-center gap-1.5 text-2xs text-fg-muted bg-white rounded-md h-6 border border-border">
                    <Lock size={11} /> secure.{slug(bank.name)}.com/login
                  </div>
                </div>
                {signInPhase === 'login' ? (
                  <div className="px-7 py-6 flex flex-col items-center">
                    <BankLogo bankName={bank.name} domain={bank.domain} initials={bank.initials} color={bank.primaryColor} size={56} rounded="rounded-2xl" />
                    <p className="text-base text-fg mt-2.5" style={{ fontWeight: 700 }}>{bank.name}</p>
                    <p className="text-[13px] text-fg-muted mb-4">Sign in to your account</p>
                    <div className="w-full space-y-3">
                      <div>
                        <label className="block text-[12px] text-fg-muted mb-1">Username</label>
                        <input readOnly value="demo@yourcompany.com" className="w-full h-10 px-3 rounded-lg border border-border bg-bg-subtle/40 text-sm text-fg outline-none" />
                      </div>
                      <div>
                        <label className="block text-[12px] text-fg-muted mb-1">Password</label>
                        <input readOnly type="password" value="demopassword123" className="w-full h-10 px-3 rounded-lg border border-border bg-bg-subtle/40 text-sm text-fg outline-none" />
                      </div>
                      <button onClick={() => setSignInPhase('connecting')} className="w-full h-11 rounded-lg text-white text-sm" style={{ backgroundColor: bank.primaryColor, fontWeight: 600 }}>Sign in</button>
                      <button onClick={() => setSignInPhase('intro')} className="w-full text-center text-[13px] text-fg-muted hover:text-fg py-1">Cancel</button>
                    </div>
                  </div>
                ) : signInPhase === 'connecting' ? (
                  <div className="px-7 py-10 flex flex-col items-center">
                    <span className="w-16 h-16 rounded-full bg-bg-subtle text-primary flex items-center justify-center mb-3"><Loader2 size={28} className="animate-spin" /></span>
                    <p className="text-base text-fg" style={{ fontWeight: 700 }}>Connecting…</p>
                    <p className="text-[13px] text-fg-muted">Securely linking your {bank.name} account.</p>
                  </div>
                ) : (
                  <div className="px-7 py-10 flex flex-col items-center">
                    <span className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 animate-[pop_220ms_ease-out]"><Check size={30} /></span>
                    <p className="text-base text-fg" style={{ fontWeight: 700 }}>Connected</p>
                    <p className="text-[13px] text-fg-muted">Returning to Omne…</p>
                  </div>
                )}
                <div className="text-center text-2xs text-fg-subtle py-2.5 border-t border-border">Powered by <span style={{ fontWeight: 600 }}>Plaid</span></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------- Step 3: confirm the matched account ---------- */}
      {step === 'map' && bank && (
        <div className="p-6">
          <div className="mb-4">
            <h3 className="text-base text-fg" style={{ fontWeight: 600 }}>Confirm the account to connect</h3>
            <p className="text-sm text-fg-muted mt-1">
              We matched the account number you entered in step 2 and selected it below. Your other accounts at {bank.shortName} are shown as view only.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-white overflow-hidden">
            {/* Institution header */}
            <div className="px-4 py-3 border-b border-border bg-bg-subtle/60 flex items-center gap-2.5">
              <BankLogo bankName={bank.name} domain={bank.domain} initials={bank.initials} color={bank.primaryColor} size={32} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-fg truncate" style={{ fontWeight: 600 }}>{bank.name}</p>
                <p className="text-[11px] text-fg-muted mt-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected
                  <span className="mx-1 text-fg-subtle/50">·</span>
                  {feedAccounts.length} account{feedAccounts.length === 1 ? '' : 's'} found
                </p>
              </div>
            </div>

            {/* Account rows */}
            <div className="divide-y divide-border">
              {feedAccounts.map(acc => {
                const isMatched = acc.id === autoMatchedId
                const isSelected = selectedIds.has(acc.id)
                const isViewOnly = !isMatched
                const tint = SUBTYPE_TINT[acc.subtype]
                const SubtypeIcon = SUBTYPE_ICON[acc.subtype]
                return (
                  <div key={acc.id} className={cn('relative flex items-stretch gap-3 px-4 py-3.5 transition-colors',
                    isViewOnly ? 'opacity-70 bg-bg-subtle/30' : isSelected ? 'bg-[#F8FBFF]' : 'hover:bg-[#F8FBFF]/40')}>
                    {isSelected && <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected}
                      disabled={isViewOnly}
                      onClick={() => { if (!isViewOnly) toggleAccount(acc.id) }}
                      className={cn('flex items-center gap-3 flex-1 min-w-0 text-left', isViewOnly ? 'cursor-not-allowed' : 'cursor-pointer')}
                    >
                      {isViewOnly ? (
                        <span className="w-[18px] h-[18px] shrink-0" aria-hidden />
                      ) : (
                        <span className={cn('w-[18px] h-[18px] rounded-[4px] border flex items-center justify-center shrink-0', isSelected ? 'bg-primary border-primary text-white' : 'border-border bg-white')}>
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </span>
                      )}
                      <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: tint.iconBg }}>
                        <SubtypeIcon size={16} style={{ color: tint.iconColor }} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2 min-w-0 flex-wrap">
                          <span className="text-[13.5px] text-fg truncate" style={{ fontWeight: 600 }}>{acc.displayName}</span>
                          <span className="text-[13px] tabular-nums text-fg shrink-0" style={{ fontWeight: 600 }}>{money(acc.currentBalance, acc.currencyCode)}</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10.5px] shrink-0" style={{ backgroundColor: tint.bg, color: tint.color, fontWeight: 600 }}>
                            {getFeedSubtypeLabel(acc.subtype)}
                          </span>
                          {isMatched && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10.5px] shrink-0" style={{ fontWeight: 600 }}>
                              <Check size={10} strokeWidth={3} /> Matches the number you entered
                            </span>
                          )}
                          {isViewOnly && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-bg-muted text-fg-subtle text-[10.5px] shrink-0" style={{ fontWeight: 500 }} title="Shown for context. Not connected.">
                              View only
                            </span>
                          )}
                        </span>
                        <span className="block text-[11.5px] text-fg-muted mt-0.5 tabular-nums">{acc.accountNumberMasked} · {acc.currencyCode}</span>
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Balances freshness line */}
            <div className="px-4 py-2 border-t border-border bg-white">
              <p className="text-[11px] text-fg-muted">Balances are provided by {bank.shortName} via Plaid as of the latest sync.</p>
            </div>
          </div>
        </div>
      )}
    </FormModal>
  )
}
