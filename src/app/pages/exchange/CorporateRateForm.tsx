// Exchange Rates screens: the one Add / Update corporate rate form, used by the
// Exchange Rate Library and by the pair page. CoA FormModal + SectionCard field
// layout (spec-detail §6.2) over the currency app's rules: duplicate detection
// with "Update existing rate", the mid-market reference, live variance,
// backdating block / warn, notes (no length limit) and validation. A date after
// today saves the rate as Upcoming: the current rate stays in effect until then.
import { useMemo, useState } from 'react'
import { ArrowLeftRight, Info, Pencil, Plus, StickyNote, TrendingUp } from 'lucide-react'
import { useExchangeRates } from '../../context/ExchangeRateContext'
import { activeStandardRateFor, isRateInEffect, upcomingRateOf, type StandardRate } from '../../data/exchangeRates'
import { RATE_TOOLTIPS } from '../../utils/rateCopy'
import { Badge, Banner, Button, ConfirmModal, FormModal, Input, RequiredMark, Select, Textarea, Tooltip } from '../../coa/components/ui'
import { SectionCard, LockedField } from '../../coa/components/formKit'
import { DateField } from '../../coa/components/DateField'
import { FlagImage } from '../../coa/components/FlagImage'
import { pushToast } from '../../coa/lib/toast'
import { fmtDate, todayIso } from '../../coa/lib/utils'
import {
  ACTOR, BASE, BASE_NAME, LAST_SYNC_DATE, checkBackdate, flagOf, fmtRate, fmtSignedPct, variancePct,
} from './rateModel'

export type CorporateFormRequest = { mode: 'add'; code?: string } | { mode: 'update'; rateId: string }

/**
 * The form as a hook, the way CoA pages hold their modals: `openAdd(code?)`,
 * `openUpdate(rateId)`, and `modal` rendered once on the page.
 */
export function useCorporateRateForm(onSaved?: (rate: StandardRate, mode: 'add' | 'update') => void) {
  const [state, setState] = useState<{ seq: number; request: CorporateFormRequest } | null>(null)
  const [seq, setSeq] = useState(0)
  const open = (request: CorporateFormRequest) => { setSeq(s => s + 1); setState({ seq: seq + 1, request }) }
  return {
    openAdd: (code?: string) => open({ mode: 'add', code }),
    openUpdate: (rateId: string) => open({ mode: 'update', rateId }),
    isOpen: !!state,
    modal: state ? <CorporateRateFormModal key={state.seq} request={state.request} onClose={() => setState(null)} onSaved={onSaved} /> : null,
  }
}

function CorporateRateFormModal({ request, onClose, onSaved }: {
  request: CorporateFormRequest
  onClose: () => void
  onSaved?: (rate: StandardRate, mode: 'add' | 'update') => void
}) {
  const { midMarketRates, standardRates, addStandardRate, updateStandardRate, scheduleStandardRate } = useExchangeRates()
  const today = todayIso()

  // Mode can change once: "Update existing rate" turns an Add into an Update.
  const initialRecord = request.mode === 'update' ? standardRates.find(r => r.id === request.rateId) : undefined
  const [editing, setEditing] = useState<StandardRate | undefined>(initialRecord)
  const isUpdate = !!editing

  const startCode = request.mode === 'add' && request.code ? request.code.toUpperCase() : ''
  const validStart = startCode && startCode !== BASE && midMarketRates.some(m => m.sourceCurrency === startCode) ? startCode : ''
  const initial = useMemo(() => ({
    source: initialRecord?.sourceCurrency ?? validStart,
    rate: initialRecord ? fmtRate(initialRecord.standardRate) : '',
    date: today,
    // Each change carries its own note: the last one stays in the rate's history.
    notes: '',
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  const [source, setSource] = useState(initial.source)
  const [rate, setRate] = useState(initial.rate)
  const [date, setDate] = useState(initial.date)
  const [notes, setNotes] = useState(initial.notes)
  const [attempted, setAttempted] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)

  // The source picker never offers the base currency: a rate against itself is 1.
  const options = useMemo(
    () => midMarketRates
      .filter(m => m.sourceCurrency !== BASE && m.status === 'active')
      .map(m => ({ code: m.sourceCurrency, name: m.sourceCurrencyName }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    [midMarketRates],
  )

  const code = editing?.sourceCurrency ?? source
  const name = editing?.sourceCurrencyName ?? options.find(o => o.code === source)?.name ?? ''
  const mid = midMarketRates.find(m => m.sourceCurrency === code)
  const duplicate = !isUpdate && source ? activeStandardRateFor(source, standardRates) : undefined
  const existing = isUpdate ? editing : undefined
  // The rate in effect today, if the record has one (one added for a later date has not).
  const inEffect = existing && isRateInEffect(existing, today) ? existing : undefined
  const pending = existing ? upcomingRateOf(existing, today) : null
  // A later date keeps today's rate in effect and saves this one as Upcoming.
  const scheduling = !!inEffect && !!date && date > today
  const n = Number(rate)
  const rateValid = rate.trim() !== '' && Number.isFinite(n) && n > 0
  const variance = rateValid ? variancePct(n, mid?.rate) : null
  const backdate = checkBackdate(inEffect, date, today)

  const errors: { field: string; message: string }[] = []
  if (!code) errors.push({ field: 'source', message: 'Choose a source currency.' })
  if (!rateValid) errors.push({ field: 'rate', message: rate.trim() ? 'Enter a corporate rate above zero.' : 'Enter the corporate exchange rate.' })
  if (!date) errors.push({ field: 'date', message: 'Choose an effective date.' })
  else if (backdate?.kind === 'block') errors.push({ field: 'date', message: backdate.message })
  // A currency that already has a rate swaps the form for "Update existing rate":
  // an error from an earlier Save no longer applies there.
  const showErrors = attempted && !duplicate
  const errorOf = (f: string) => (showErrors ? errors.find(e => e.field === f)?.message : undefined)

  const dirty = source !== initial.source || rate !== initial.rate || date !== initial.date || notes !== initial.notes || editing !== initialRecord
  const requestClose = () => { if (dirty) setDiscardOpen(true); else onClose() }

  const save = () => {
    if (duplicate) return
    if (errors.length) { setAttempted(true); return }
    const midRate = mid?.rate ?? 0
    const v = variancePct(n, midRate) ?? 0
    if (editing && scheduling) {
      scheduleStandardRate(editing.id, { standardRate: n, effectiveDate: date, notes }, { by: ACTOR, reason: notes })
      pushToast(`Corporate rate for ${code} scheduled`, 'success', `${fmtRate(n)} ${BASE} from ${fmtDate(date)}. ${fmtRate(editing.standardRate)} stays in effect until then.`)
      onSaved?.(editing, 'update')
    } else if (editing) {
      updateStandardRate(editing.id, {
        standardRate: n, effectiveDate: date, notes, midMarketRate: midRate, variance: v,
      }, { by: ACTOR, reason: notes })
      pushToast(`Corporate rate for ${code} updated`, 'success', date > today ? `${fmtRate(n)} ${BASE}, upcoming from ${fmtDate(date)}.` : `${fmtRate(n)} ${BASE}, effective ${fmtDate(date)}.`)
      onSaved?.({ ...editing, standardRate: n, effectiveDate: date, notes }, 'update')
    } else {
      const created = addStandardRate({
        baseCurrency: BASE,
        sourceCurrency: code,
        sourceCurrencyName: name,
        standardRate: n,
        midMarketRate: midRate,
        variance: v,
        effectiveDate: date,
        createdBy: ACTOR,
        notes,
        status: 'active',
      }, { by: ACTOR, reason: notes })
      pushToast(`Corporate rate for ${code} created`, 'success', date > today ? `${fmtRate(n)} ${BASE}, upcoming from ${fmtDate(date)}.` : `${fmtRate(n)} ${BASE}, effective ${fmtDate(date)}.`)
      onSaved?.(created, 'add')
    }
    onClose()
  }

  const blocked = backdate?.kind === 'block'

  return (
    <>
      <FormModal
        open
        onClose={requestClose}
        icon={isUpdate ? <Pencil size={16} /> : <Plus size={16} />}
        title={isUpdate ? 'Update corporate rate' : 'Add corporate rate'}
        subtitle={isUpdate
          ? <>Update the corporate rate for <span className="text-fg" style={{ fontWeight: 600 }}>{code} / {BASE}</span>.</>
          : 'Define a new corporate rate for a currency pair.'}
        widthClass="max-w-[760px]"
        footer={
          <>
            <Button variant="ghost" onClick={requestClose}>Cancel</Button>
            {!duplicate && (
              <Button onClick={save} disabled={blocked} icon={isUpdate ? undefined : <Plus size={14} />}>
                {isUpdate ? 'Update rate' : 'Save rate'}
              </Button>
            )}
          </>
        }
      >
        <div className="px-6 pt-5 pb-5 space-y-3.5">
          {showErrors && errors.length > 0 && (
            <Banner tone="danger" title={`${errors.length} ${errors.length === 1 ? 'issue' : 'issues'}`}>
              <ul className="mt-1.5 space-y-1 list-disc pl-4 marker:text-danger-400">
                {errors.map(e => <li key={e.field}>{e.message}</li>)}
              </ul>
            </Banner>
          )}

          <SectionCard icon={<ArrowLeftRight size={16} />} title="Currency pair">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div>
                <LockedField label="Base currency" info={RATE_TOOLTIPS.baseCurrency} why="Every rate is quoted against the base currency. Change it in Company Settings.">
                  <span className="inline-flex items-center gap-2 min-w-0 truncate"><FlagImage code={flagOf(BASE)} />{BASE} · {BASE_NAME}</span>
                </LockedField>
              </div>
              <div>
                {isUpdate ? (
                  <LockedField label="Source currency" info={RATE_TOOLTIPS.sourceCurrency} why="The pair is fixed once its corporate rate exists.">
                    <span className="inline-flex items-center gap-2 min-w-0 truncate"><FlagImage code={flagOf(code)} />{code} · {name}</span>
                  </LockedField>
                ) : (
                  <Select
                    label="Source currency"
                    required
                    info={RATE_TOOLTIPS.sourceCurrency}
                    searchable
                    placeholder="Choose a currency"
                    searchPlaceholder="Search currency code or name"
                    value={source}
                    onChange={e => setSource(e.target.value)}
                    error={errorOf('source')}
                  >
                    {options.map(o => (
                      <option key={o.code} value={o.code} data-icon={<FlagImage code={flagOf(o.code)} />}>{`${o.code} · ${o.name}`}</option>
                    ))}
                  </Select>
                )}
              </div>
            </div>
          </SectionCard>

          {duplicate ? (
            <Banner tone="warning" title="A corporate rate already exists for this currency pair.">
              {isRateInEffect(duplicate, today)
                ? <p className="tabular-nums">Current rate: {fmtRate(duplicate.standardRate)} · Effective from {fmtDate(duplicate.effectiveDate)}</p>
                : <p className="tabular-nums">Upcoming rate: {fmtRate(duplicate.standardRate)} · From {fmtDate(duplicate.effectiveDate)}</p>}
              <p className="mt-0.5">Do you want to update it?</p>
              <div className="flex items-center gap-2 mt-2.5">
                <Button size="sm" icon={<Pencil size={13} />} onClick={() => { setEditing(duplicate); setRate(fmtRate(duplicate.standardRate)); setNotes(''); setAttempted(false) }}>
                  Update existing rate
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setSource('')}>Choose another currency</Button>
              </div>
            </Banner>
          ) : (
            <>
              <SectionCard icon={<TrendingUp size={16} />} title="Rate">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <div>
                    <LockedField label="Mid-market reference" info={RATE_TOOLTIPS.midMarket} why="Synced from the rate provider every 24 hours. It can't be edited here.">
                      {mid
                        ? <span className="tabular-nums truncate">{fmtRate(mid.rate)} {BASE} <span className="text-fg-subtle">· As of {LAST_SYNC_DATE}</span></span>
                        : <span className="text-fg-subtle truncate">Choose a currency to see its mid-market rate</span>}
                    </LockedField>
                  </div>
                  <Input
                    label="Corporate exchange rate"
                    required
                    info={RATE_TOOLTIPS.corporate}
                    type="number"
                    step="0.0001"
                    min="0"
                    inputMode="decimal"
                    placeholder="e.g., 279.0000"
                    value={rate}
                    onChange={e => setRate(e.target.value)}
                    error={errorOf('rate')}
                    hint={variance != null
                      ? `Variance from mid-market: ${fmtSignedPct(variance)}`
                      : code ? `1 ${code} in ${BASE}` : undefined}
                  />
                  <div className="space-y-1.5">
                    <label className="label flex items-center gap-1">
                      Effective date<RequiredMark show />
                      <Tooltip content={RATE_TOOLTIPS.effectiveDate} side="top">
                        <span className="inline-flex cursor-help text-fg-subtle/60 hover:text-fg-subtle"><Info size={12} /></span>
                      </Tooltip>
                    </label>
                    <DateField value={date} onChange={setDate} ariaLabel="Effective date" />
                    {backdate?.kind === 'block'
                      ? <p data-field-error className="text-xs text-danger-600">{backdate.message}</p>
                      : errorOf('date') && <p data-field-error className="text-xs text-danger-600">{errorOf('date')}</p>}
                  </div>
                  {existing && (
                    <div className="space-y-1.5">
                      <span className="label block">Current rate</span>
                      <div className="text-sm text-fg-muted tabular-nums min-h-9 flex flex-col justify-center">
                        <p>{inEffect ? <>{fmtRate(inEffect.standardRate)} {BASE} · effective {fmtDate(inEffect.effectiveDate)}</> : 'None in effect yet'}</p>
                        {pending && (
                          <p className="flex items-center gap-1.5 mt-0.5">
                            <Badge tone="info">Upcoming</Badge>
                            {fmtRate(pending.standardRate)} {BASE} from {fmtDate(pending.effectiveDate)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {backdate?.kind === 'warn' && (
                  <Banner tone="warning" className="mt-3">{backdate.message}</Banner>
                )}
                {date > today && rateValid && (
                  <Banner tone="info" className="mt-3" title="This rate is upcoming">
                    {scheduling
                      ? <>{fmtRate(inEffect!.standardRate)} {BASE} stays in effect until {fmtDate(date)}. This rate shows as Upcoming until then{pending ? `, and replaces the upcoming ${fmtRate(pending.standardRate)} ${BASE}` : ''}.</>
                      : <>It takes effect on {fmtDate(date)} and shows as Upcoming until then.</>}
                  </Banner>
                )}
              </SectionCard>

              <SectionCard icon={<StickyNote size={16} />} title="Notes" badge="Optional">
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add notes about this rate..."
                />
              </SectionCard>
            </>
          )}
        </div>
      </FormModal>

      <ConfirmModal
        open={discardOpen}
        tone="danger"
        badge="Discard"
        title="Discard changes?"
        description={['What you entered in this form will be lost.']}
        confirmLabel="Discard changes"
        dismissLabel="Continue editing"
        onConfirm={() => { setDiscardOpen(false); onClose() }}
        onDismiss={() => setDiscardOpen(false)}
      />
    </>
  )
}
