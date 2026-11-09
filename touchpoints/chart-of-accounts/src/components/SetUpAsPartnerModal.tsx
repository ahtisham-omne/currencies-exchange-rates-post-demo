import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronDown, Clock,
  ExternalLink, Globe, Handshake, Layers, Phone, Receipt, ShoppingCart,
  TrendingUp, Truck, Users,
} from 'lucide-react'
import { FormModal, Button, Select } from './ui'
import { FlagImage, flagEmojiCode } from './FlagImage'
import { useStore } from '../store'
import { cn } from '../lib/utils'
import {
  OTHER_PARTNER_GROUP_ID, PARTNER_GROUPS, emptyPartnerDraft, findMatchingPartner,
  getPartnerGroup, type Partner, type PartnerDraft, type PartnerKind,
} from '../lib/partners'

// COA translation of Cash Management's "Set up as partner" step (Step3Partner +
// PartnerInlineSection). Optional, skippable nudge shown when a bank/credit-card
// GL account is created: setting the institution up as a partner lets its fees
// post against it. Three views - linked (existing match, no duplicate), choice
// (set up / skip), form (inline create). Backed by the local partners store.
type View = 'choice' | 'form'

export function SetUpAsPartnerModal({
  open, onClose, bankName, isCard = false, onProceed,
}: {
  open: boolean
  /** Abort: user cancelled the partner step (X / overlay / Cancel). The account
   *  is NOT created; the create form stays open. */
  onClose: () => void
  bankName: string
  isCard?: boolean
  /** Continue: the partner decision is made (created / skipped / linked to an
   *  existing partner). The caller should now create the account. */
  onProceed: (partner?: Partner) => void
}) {
  const partners = useStore(s => s.partners)
  const addPartner = useStore(s => s.addPartner)
  const pushToast = useStore(s => s.pushToast)

  const [view, setView] = useState<View>('choice')
  const [draft, setDraft] = useState<PartnerDraft>(emptyPartnerDraft(bankName))
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (!open) return
    setView('choice')
    setDraft(emptyPartnerDraft(bankName))
    setShowErrors(false)
  }, [open, bankName])

  const institutionLabel = bankName.trim() || (isCard ? 'this issuer' : 'this bank')
  const accountKind = isCard ? 'card' : 'account'
  const matched = useMemo(() => findMatchingPartner(bankName, partners), [bankName, partners])

  const patch = (p: Partial<PartnerDraft>) => setDraft(d => ({ ...d, ...p }))

  const submit = () => {
    if (!draft.groupId) { setShowErrors(true); return }
    const partner = addPartner({
      name: draft.name.trim() || bankName,
      kinds: draft.kinds,
      phone: draft.phone || undefined,
      website: draft.website || undefined,
      address: draft.address || undefined,
      description: draft.description || undefined,
      groupId: draft.groupId,
    })
    pushToast(`${partner.name} added as a partner`, 'success', 'Fees you record against it now roll up to this partner.')
    onProceed(partner)
  }

  const header = (
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-semibold text-fg">Add {institutionLabel} as a partner?</h3>
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-2xs border border-border bg-bg-subtle text-fg-muted font-semibold">Optional</span>
    </div>
  )
  const purpose = (
    <p className="text-xs text-fg-muted mt-1 leading-relaxed">
      Setting up {institutionLabel} as a partner lets its fees, like wire, monthly, and FX charges,
      post against it and shows your total spend with them.
    </p>
  )

  const footer = matched ? (
    <>
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button onClick={() => onProceed(matched)} iconRight={<ArrowRight size={14} />}>Link and continue</Button>
    </>
  ) : view === 'form' ? (
    <>
      <Button variant="ghost" className="mr-auto" icon={<ArrowLeft size={14} />} onClick={() => { setView('choice'); setShowErrors(false) }}>Back</Button>
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button onClick={submit} icon={<Handshake size={14} />}>Add partner</Button>
    </>
  ) : (
    <Button variant="ghost" onClick={onClose}>Cancel</Button>
  )

  return (
    <FormModal
      open={open}
      onClose={onClose}
      hideFullView
      icon={<Handshake size={18} />}
      title="Set up as partner"
      subtitle="Track fees and spend against the institution behind this account."
      footer={footer}
    >
      <div className="p-6 space-y-4">
        <div>{header}{purpose}</div>

        {matched ? (
          <LinkedExistingPartnerCard partner={matched} accountKind={accountKind} />
        ) : view === 'form' ? (
          <>
            <button
              type="button"
              onClick={() => { setView('choice'); setShowErrors(false) }}
              className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg transition-colors font-medium"
            >
              <ArrowLeft size={14} /> Back to choice
            </button>
            <div className="rounded-lg border border-border bg-white">
              <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 bg-bg-subtle/50 rounded-t-lg">
                <span className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0"><Handshake size={13} className="text-primary" /></span>
                <span className="text-[13px] text-fg font-semibold">New partner: {institutionLabel}</span>
              </div>
              <div className="px-4 py-4">
                <PartnerInlineForm draft={draft} onChange={patch} bankName={bankName} showGroupError={showErrors} />
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ChoiceCard
              accent="blue"
              icon={Handshake}
              title="Set up as partner"
              subtitle={`Record fees and track spend against ${institutionLabel}.`}
              bullets={[
                { icon: Receipt, label: 'Record fees as bills' },
                { icon: TrendingUp, label: 'Track total spend with this provider' },
                { icon: Check, label: 'Included in reports' },
              ]}
              ctaLabel="Set up as partner"
              onClick={() => setView('form')}
            />
            <ChoiceCard
              accent="slate"
              icon={Clock}
              title="Skip for now"
              subtitle="Add this later from Partners."
              bullets={[
                { icon: Check, label: 'No partner created' },
                { icon: Check, label: 'No effect on your books' },
                { icon: Check, label: 'Available at any time' },
              ]}
              ctaLabel="Skip and continue"
              onClick={() => onProceed()}
            />
          </div>
        )}
      </div>
    </FormModal>
  )
}

export function LinkedExistingPartnerCard({ partner, accountKind }: { partner: Partner; accountKind: string }) {
  const kindsLabel = partner.kinds.map(k => (k === 'vendor' ? 'Vendor' : 'Customer')).join(' · ')
  return (
    <div className="rounded-lg border border-emerald-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-emerald-100 bg-emerald-50/50 flex items-center gap-2.5">
        <span className="w-7 h-7 rounded-md bg-emerald-100 flex items-center justify-center shrink-0"><CheckCircle2 size={16} className="text-emerald-600" /></span>
        <div className="min-w-0">
          <p className="text-[13px] text-fg font-semibold">Already in your Partners</p>
          <p className="text-[11.5px] text-fg-muted mt-0.5">We'll link this {accountKind} to the existing partner - no duplicate created.</p>
        </div>
      </div>
      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Handshake size={16} className="text-primary" /></span>
          <div className="min-w-0">
            <p className="text-[13.5px] text-fg font-semibold truncate">{partner.name}</p>
            <p className="text-[11.5px] text-fg-muted mt-0.5 flex items-center gap-1.5">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-2xs border border-border bg-bg-subtle text-fg-muted font-medium">{kindsLabel || 'Partner'}</span>
              {partner.website && <span className="truncate">{partner.website}</span>}
            </p>
          </div>
        </div>
        <a href="#" onClick={e => e.preventDefault()} className="shrink-0 inline-flex items-center gap-1 text-[11.5px] text-primary hover:text-primary/80 font-semibold">
          View partner <ExternalLink size={12} />
        </a>
      </div>
    </div>
  )
}

function ChoiceCard({ accent, icon: Icon, title, subtitle, bullets, ctaLabel, onClick }: {
  accent: 'blue' | 'slate'
  icon: typeof Handshake
  title: string
  subtitle: string
  bullets: { icon: typeof Check; label: string }[]
  ctaLabel: string
  onClick: () => void
}) {
  const isBlue = accent === 'blue'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('group relative overflow-hidden rounded-xl border bg-white p-5 text-left transition-all',
        isBlue ? 'border-sky-300/60 hover:border-primary hover:shadow-md' : 'border-border hover:border-slate-300 hover:shadow-sm')}
    >
      <div className="relative flex items-start gap-3">
        <span className={cn('w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0', isBlue ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600')}>
          <Icon size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <h4 className={cn('text-sm font-semibold', isBlue ? 'text-sky-900' : 'text-fg')}>{title}</h4>
          <p className="text-xs text-fg-muted mt-0.5">{subtitle}</p>
        </div>
      </div>
      <ul className="relative mt-4 space-y-1.5">
        {bullets.map(b => (
          <li key={b.label} className="flex items-start gap-2 text-xs text-fg-muted">
            <b.icon size={14} className={cn('mt-0.5 shrink-0', isBlue ? 'text-emerald-500' : 'text-slate-400')} strokeWidth={2.5} />
            <span>{b.label}</span>
          </li>
        ))}
      </ul>
      <div className={cn('relative mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold', isBlue ? 'text-primary' : 'text-fg')}>
        {ctaLabel}
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}

export function PartnerInlineForm({ draft, onChange, bankName, showGroupError }: {
  draft: PartnerDraft
  onChange: (p: Partial<PartnerDraft>) => void
  bankName: string
  showGroupError: boolean
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const selectedSet = new Set<PartnerKind>(draft.kinds)
  const toggleKind = (kind: PartnerKind) => {
    const next = new Set(selectedSet)
    if (next.has(kind)) { if (next.size <= 1) return; next.delete(kind) } else next.add(kind)
    onChange({ kinds: Array.from(next) })
  }
  const group = getPartnerGroup(draft.groupId)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="label block">Partner name<span className="text-danger-600 ml-0.5">*</span></label>
        <input
          value={draft.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder={bankName || 'e.g. JPMorgan Chase'}
          className="input"
        />
        <p className="text-2xs text-fg-subtle">Defaults to the provider name.</p>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <span className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0"><Users size={13} className="text-primary" /></span>
          <div>
            <span className="text-[13px] text-fg font-semibold block">Partner type</span>
            <span className="text-2xs text-fg-subtle block mt-px">Banks are typically set up as a vendor, since they charge fees.</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <PartnerTypeTile label="Vendor" subtitle="Supplies goods or services to you." icon={Truck} palette="blue" active={selectedSet.has('vendor')} onClick={() => toggleKind('vendor')} />
          <PartnerTypeTile label="Customer" subtitle="Buys goods or services from you." icon={ShoppingCart} palette="violet" active={selectedSet.has('customer')} onClick={() => toggleKind('customer')} />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <span className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0"><Layers size={13} className="text-primary" /></span>
          <div>
            <span className="text-[13px] text-fg font-semibold block">Partner group<span className="text-danger-600 ml-0.5">*</span></span>
            <span className="text-2xs text-fg-subtle block mt-px">Groups this partner under a tier or region for reporting.</span>
          </div>
        </div>
        <Select
          value={draft.groupId ?? ''}
          onChange={e => onChange({ groupId: e.target.value || null })}
          placeholder="Assign a partner group…"
          error={showGroupError && !draft.groupId ? 'Select a partner group.' : undefined}
          searchable
        >
          {/* The group's flag as a picture, never the emoji, which Windows draws as two letters. */}
          {PARTNER_GROUPS.map(g => <option key={g.id} value={g.id} data-icon={<FlagImage code={flagEmojiCode(g.countryFlag)} />}>{`${g.name} · ${g.memberCount} members`}</option>)}
          <option value={OTHER_PARTNER_GROUP_ID}>Others · No specific group</option>
        </Select>
        {!showGroupError && group && <p className="text-2xs text-fg-subtle mt-1.5">{group.description}</p>}
      </div>

      <button
        type="button"
        onClick={() => setMoreOpen(v => !v)}
        className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-semibold"
      >
        <ChevronDown size={14} className={cn('transition-transform', moreOpen && 'rotate-180')} />
        {moreOpen ? 'Hide additional details' : 'Add more details'}
      </button>

      {moreOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-dashed border-border pt-4">
          <Field label="Phone" value={draft.phone} onChange={v => onChange({ phone: v })} placeholder="+1 (555) 010-0100" icon={Phone} />
          <Field label="Website" value={draft.website} onChange={v => onChange({ website: v })} placeholder="https://www.example.com" icon={Globe} />
          <div className="sm:col-span-2 space-y-1.5">
            <label className="label block">Address</label>
            <input value={draft.address} onChange={e => onChange({ address: e.target.value })} placeholder="Street address" className="input" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <label className="label block">Description</label>
            <textarea value={draft.description} onChange={e => onChange({ description: e.target.value })} placeholder="Brief summary of the partner's purpose or context." className="input min-h-[72px] py-2" />
          </div>
        </div>
      )}

      <div className="pt-3 border-t border-dashed border-border flex items-center justify-between gap-3 flex-wrap">
        <p className="text-2xs text-fg-muted">Need payment terms, pricing rules, or points of contact?</p>
        <button
          type="button"
          onClick={() => window.open('https://partner-management-module.lovable.app/vendors', '_blank', 'noopener,noreferrer')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-fg-muted hover:border-primary hover:text-primary hover:bg-accent transition-all text-xs font-semibold"
        >
          Configure in Partner Management <ArrowUpRight size={14} />
        </button>
      </div>
    </div>
  )
}

function PartnerTypeTile({ label, subtitle, icon: Icon, active, palette, onClick }: {
  label: string; subtitle: string; icon: typeof Truck; active: boolean; palette: 'blue' | 'violet'; onClick: () => void
}) {
  const isBlue = palette === 'blue'
  return (
    <div
      onClick={onClick}
      className={cn('group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer bg-white',
        active
          ? isBlue
            ? 'border-[#93C5FD]/70 shadow-[0_1px_4px_rgba(10,119,255,0.06)]'
            : 'border-[#C4B5FD]/70 shadow-[0_1px_4px_rgba(139,92,246,0.06)]'
          : 'border-border hover:border-blue-200 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.12)]')}
    >
      <div className={cn('absolute inset-0 transition-all duration-300 pointer-events-none',
        active
          ? isBlue ? 'bg-gradient-to-br from-blue-50/50 to-transparent' : 'bg-gradient-to-br from-violet-50/50 to-transparent'
          : 'bg-gradient-to-br from-accent/0 to-accent/0 group-hover:from-accent/60 group-hover:to-transparent')} />
      <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
        <span className={cn('w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200',
          active
            ? isBlue ? 'bg-gradient-to-br from-blue-100 to-blue-200 text-[#2563EB]' : 'bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] text-violet-600'
            : isBlue ? 'bg-gradient-to-br from-accent to-blue-100 text-primary group-hover:scale-105' : 'bg-gradient-to-br from-violet-50 to-[#EDE9FE] text-violet-500 group-hover:scale-105')}>
          <Icon size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <p className={cn('text-[13px] font-semibold transition-colors duration-150', active ? (isBlue ? 'text-blue-800' : 'text-[#5B21B6]') : 'text-fg')}>{label}</p>
          <p className={cn('text-2xs mt-0.5 truncate transition-colors duration-150', active ? (isBlue ? 'text-[#60A5FA]' : 'text-[#A78BFA]') : 'text-fg-subtle')}>{subtitle}</p>
        </div>
        <span className={cn('w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-200',
          active
            ? isBlue ? 'bg-[#3B82F6] shadow-[0_0_0_2px_rgba(59,130,246,0.15)]' : 'bg-[#8B5CF6] shadow-[0_0_0_2px_rgba(139,92,246,0.15)]'
            : 'border-[1.5px] border-[#D1D5DB] bg-white group-hover:border-[#93C5FD]')}>
          {active && <Check size={12} className="text-white" strokeWidth={2.5} />}
        </span>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, icon: Icon }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; icon?: typeof Phone
}) {
  return (
    <div className="space-y-1.5">
      <label className="label block">{label}</label>
      <div className="relative">
        {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />}
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cn('input', Icon && 'pl-9')} />
      </div>
    </div>
  )
}
