// The "Live exchange rate converter" widget body, rebuilt in the kit's look: two
// sides (currency picker + amount), a swap that flips which side is anchored to
// 1, a Mid-market / Corporate rate toggle, the corporate empty state and the
// adaptive footer. Every behaviour of the old converter is kept. The sides are
// top-level components now, so an amount box keeps its focus while you type.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, Check, ChevronDown, Info, Plus, Search, X } from 'lucide-react'
import { useCurrencies } from '../../context/CurrencyContext'
import { useExchangeRates } from '../../context/ExchangeRateContext'
import { API_PROVIDER, LAST_SYNC } from '../../data/exchangeRates'
import type { Currency } from '../../data/currencies'
import { CONVERTER_SUBTITLE, CONVERTER_TOGGLE_TOOLTIPS, INVERSE_BADGE_TOOLTIP } from '../../utils/rateCopy'
import { Badge, Banner, Button, Marked, Tooltip, useEscapeToClose } from '../../coa/components/ui'
import { FlagImage } from '../../coa/components/FlagImage'
import { useWidgetSize } from '../../coa/components/DetailInsights'
import { cn, fmtDateTime } from '../../coa/lib/utils'
import { BASE, flagOf } from './model'

type RateMode = 'mid' | 'std'

/* ── Currency picker ──────────────────────────────────────────────────────
   Looks like an input (flag, code, name) and opens a portalled list with a
   search box, the kit Select's popover recipe. Only active currencies are offered. */
function CurrencyPicker({ value, onChange, options, all, ariaLabel }: {
  value: string
  onChange: (code: string) => void
  options: Currency[]
  /** Every currency, so a selected inactive one still names itself. */
  all: Currency[]
  ariaLabel: string
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [box, setBox] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null)
  const selected = all.find(c => c.code === value) ?? null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))
  }, [options, query])

  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.min(Math.max(r.width, 300), window.innerWidth - 16)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - 8 - width))
    const h = 320
    const below = r.bottom + h <= window.innerHeight || r.top < h
    setBox(below ? { left, width, top: r.bottom + 4 } : { left, width, bottom: window.innerHeight - r.top + 4 })
  }
  useLayoutEffect(() => { if (open) place() }, [open])
  useEffect(() => {
    if (!open) { setQuery(''); return }
    requestAnimationFrame(() => searchRef.current?.focus())
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    const onScroll = (e: Event) => { if (!(e.target instanceof Node && popRef.current?.contains(e.target))) place() }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])
  useEscapeToClose(open, () => { setOpen(false); triggerRef.current?.focus() })

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn('input !h-10 pr-8 relative flex items-center gap-2 text-left cursor-pointer', open && '!border-primary ring-2 ring-primary/10')}
      >
        {selected ? (
          <>
            <span className="inline-flex shrink-0 text-[16px] leading-none" aria-hidden><FlagImage code={flagOf(selected.code)} /></span>
            <span className="min-w-0 flex-1 flex flex-col leading-tight">
              <span className="text-[13px] text-fg tabular-nums truncate" style={{ fontWeight: 600 }}>{selected.code}</span>
              <span className="text-[11px] text-fg-subtle truncate" title={selected.name}>{selected.name}</span>
            </span>
          </>
        ) : (
          <span className="coa-placeholder truncate">Select currency</span>
        )}
        <ChevronDown size={16} className={cn('absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtle/60 pointer-events-none transition-transform', open && 'rotate-180')} />
      </button>
      {open && box && createPortal(
        <div
          ref={popRef}
          role="listbox"
          className="fixed z-[80] bg-white border border-border rounded-lg shadow-lg max-h-80 flex flex-col overflow-hidden animate-popover-down"
          style={{ left: box.left, width: box.width, top: box.top, bottom: box.bottom }}
        >
          <div className="p-1.5 border-b border-border shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search currency, code, or country..."
                className="w-full h-8 pl-8 pr-7 rounded-md border border-border text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
              {query && (
                <button type="button" onClick={() => { setQuery(''); searchRef.current?.focus() }} aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-fg-subtle hover:text-fg hover:bg-bg-muted">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
          <div className="py-1.5 overflow-auto scrollbar-thin">
            {filtered.map(c => {
              const isSel = c.code === value
              return (
                <button
                  key={c.code}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onClick={() => { onChange(c.code); setOpen(false) }}
                  className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors', isSel ? 'bg-primary/[0.06] text-primary' : 'text-fg hover:bg-bg-subtle')}
                >
                  <span className="w-[22px] shrink-0 text-[16px] leading-none inline-flex justify-center" aria-hidden><FlagImage code={flagOf(c.code)} /></span>
                  <span className="tabular-nums shrink-0" style={{ fontWeight: 600 }}><Marked text={c.code} q={query} /></span>
                  <span className={cn('truncate min-w-0', isSel ? 'text-primary/80' : 'text-fg-muted')}><Marked text={c.name} q={query} /></span>
                  {isSel && <Check size={15} className="ml-auto text-primary shrink-0" />}
                </button>
              )
            })}
            {filtered.length === 0 && <div className="px-3 py-3 text-sm text-fg-subtle text-center">No currencies match your search.</div>}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

/* ── Rate type toggle ─────────────────────────────────────────────────────
   The widget size toggle's segmented recipe, with each side's explainer. */
function RateTypeToggle({ mode, onChange, corporateAvailable }: { mode: RateMode; onChange: (m: RateMode) => void; corporateAvailable: boolean }) {
  const seg = (active: boolean, disabled?: boolean) => cn(
    'h-7 px-2.5 rounded-md text-[12px] inline-flex items-center gap-1 transition-all duration-150 border',
    active ? 'bg-white text-primary shadow-sm border-border' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60 border-transparent',
    disabled ? 'opacity-60 cursor-not-allowed hover:bg-transparent hover:text-slate-500' : 'cursor-pointer',
  )
  return (
    <div className="flex items-center h-8 rounded-lg border border-border bg-slate-50 p-0.5 gap-0.5 shrink-0" role="tablist" aria-label="Rate type">
      <Tooltip content={CONVERTER_TOGGLE_TOOLTIPS.midMarket} side="top">
        <button type="button" role="tab" aria-selected={mode === 'mid'} onClick={() => onChange('mid')} className={seg(mode === 'mid')} style={{ fontWeight: mode === 'mid' ? 600 : 500 }}>
          Mid-market rate
          <Info className="w-3 h-3 text-fg-subtle/70" />
        </button>
      </Tooltip>
      <Tooltip content={corporateAvailable ? CONVERTER_TOGGLE_TOOLTIPS.corporate : 'No corporate rate is defined for this pair.'} side="top" align="right">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'std'}
          aria-disabled={!corporateAvailable || undefined}
          onClick={corporateAvailable ? () => onChange('std') : undefined}
          className={seg(mode === 'std' && corporateAvailable, !corporateAvailable)}
          style={{ fontWeight: mode === 'std' ? 600 : 500 }}
        >
          Corporate rate
          <Info className="w-3 h-3 text-fg-subtle/70" />
        </button>
      </Tooltip>
    </div>
  )
}

/* ── One side of the converter ────────────────────────────────────────────
   Declared at module level (it was declared inside the converter's render, so
   every keystroke remounted it and could drop the amount box's focus). */
function ConverterSide({ side, code, setCode, amount, onAmountChange, noRate, options, all }: {
  side: 'From' | 'To'
  code: string
  setCode: (c: string) => void
  amount: string
  onAmountChange: (v: string) => void
  noRate: boolean
  options: Currency[]
  all: Currency[]
}) {
  return (
    <div className="flex-1 min-w-0 rounded-lg border border-border bg-bg-subtle/60 p-3">
      <div className="flex items-end gap-2.5">
        <div className="flex-1 min-w-0 space-y-1.5">
          <span className="label block">{side === 'From' ? 'Convert from' : 'Convert to'}</span>
          <CurrencyPicker value={code} onChange={setCode} options={options} all={all} ariaLabel={`Change ${side.toLowerCase()} currency`} />
        </div>
        <div className="w-[42%] min-w-[110px] max-w-[180px] shrink-0 space-y-1.5">
          <span className="label block text-right">Amount</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={e => onAmountChange(e.target.value)}
            placeholder={noRate ? 'No rate' : '0'}
            disabled={noRate}
            aria-label={`${side} amount`}
            className="input !h-10 text-right tabular-nums text-[15px] focus:!border-primary focus:!ring-primary/10"
            style={{ fontWeight: 600 }}
          />
        </div>
      </div>
    </div>
  )
}

export function CurrencyConverter({ detail }: { detail: Currency }) {
  const navigate = useNavigate()
  const size = useWidgetSize()
  const wide = size === 'lg'
  const { currencies } = useCurrencies()
  const { midMarketRates, standardRates } = useExchangeRates()
  const activeCurrencies = useMemo(() => currencies.filter(c => c.status === 'active'), [currencies])

  // Every rate is quoted against the base: "1 X = rate[X] PKR".
  const midFor = (code: string): number | null => (code === BASE ? 1 : midMarketRates.find(r => r.sourceCurrency === code)?.rate ?? null)
  const stdRecordFor = (code: string) => standardRates.find(r => r.sourceCurrency === code && r.status === 'active') ?? null
  const stdFor = (code: string): number | null => (code === BASE ? 1 : stdRecordFor(code)?.standardRate ?? null)

  // From = the page's currency; To = the base, or USD when the page is the base.
  const defaultTo = detail.code === BASE ? (activeCurrencies.find(c => c.code === 'USD')?.code ?? BASE) : BASE
  const [fromCode, setFromCode] = useState(detail.code)
  const [toCode, setToCode] = useState(defaultTo)
  const [rateMode, setRateMode] = useState<RateMode>('mid')
  const [isSwapped, setIsSwapped] = useState(false)
  const [lastEdited, setLastEdited] = useState<'from' | 'to'>('from')
  const [fromAmount, setFromAmount] = useState('1')
  const [toAmount, setToAmount] = useState('')

  const fromCurrency = currencies.find(c => c.code === fromCode) ?? detail
  const toCurrency = currencies.find(c => c.code === toCode) ?? detail

  const hasCorporate =
    (fromCode === BASE || stdFor(fromCode) !== null) &&
    (toCode === BASE || stdFor(toCode) !== null) &&
    !(fromCode === BASE && toCode === BASE)
  // Corporate picked but none for the pair: convert at mid, and say so below.
  const effectiveMode: RateMode = rateMode === 'std' && hasCorporate ? 'std' : 'mid'
  const rate = useMemo(() => {
    const f = effectiveMode === 'std' ? stdFor(fromCode) : midFor(fromCode)
    const t = effectiveMode === 'std' ? stdFor(toCode) : midFor(toCode)
    return f === null || t === null ? null : f / t
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCode, toCode, effectiveMode, midMarketRates, standardRates])

  // The currency's own precision, widened (up to 8 places) for sub-unit values.
  const fmt = (n: number, c: Currency) => {
    const abs = Math.abs(n)
    if (abs > 0 && abs < Math.pow(10, -c.decimalPlaces)) {
      const dp = Math.min(8, Math.floor(-Math.log10(abs)) + 4)
      return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
    }
    return n.toLocaleString('en-US', { minimumFractionDigits: c.decimalPlaces, maximumFractionDigits: c.decimalPlaces })
  }

  // Recompute whichever side was not typed in when the pair or rate changes.
  useEffect(() => {
    if (rate === null) {
      if (lastEdited === 'from') setToAmount(''); else setFromAmount('')
      return
    }
    if (lastEdited === 'from') {
      const n = Number(fromAmount.replace(/,/g, ''))
      setToAmount(fromAmount.trim() !== '' && Number.isFinite(n) ? fmt(n * rate, toCurrency) : '')
    } else {
      const n = Number(toAmount.replace(/,/g, ''))
      setFromAmount(toAmount.trim() !== '' && Number.isFinite(n) ? fmt(n / rate, fromCurrency) : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate, fromCode, toCode])

  const onFromChange = (v: string) => {
    setFromAmount(v)
    setLastEdited('from')
    if (rate === null) return
    const n = Number(v.replace(/,/g, ''))
    setToAmount(Number.isFinite(n) && v.trim() !== '' ? fmt(n * rate, toCurrency) : '')
  }
  const onToChange = (v: string) => {
    setToAmount(v)
    setLastEdited('to')
    if (rate === null) return
    const n = Number(v.replace(/,/g, ''))
    setFromAmount(Number.isFinite(n) && v.trim() !== '' ? fmt(n / rate, fromCurrency) : '')
  }
  const pickFrom = (c: string) => { setFromCode(c); setIsSwapped(false) }
  const pickTo = (c: string) => { setToCode(c); setIsSwapped(false) }

  // Swap keeps the currencies where they are and flips which side reads 1:
  // From = 1, To = rate; inverse: To = 1, From = 1 / rate.
  const swap = () => {
    const next = !isSwapped
    setIsSwapped(next)
    if (rate === null) return
    if (next) { setToAmount('1'); setFromAmount(fmt(1 / rate, fromCurrency)); setLastEdited('to') }
    else { setFromAmount('1'); setToAmount(fmt(rate, toCurrency)); setLastEdited('from') }
  }

  // The pair's non-base side names the rate; a cross pair falls back to From.
  const pairCode = fromCode === BASE ? toCode : toCode === BASE ? fromCode : fromCode
  const stdRecord = stdRecordFor(pairCode)
  const midRecord = midMarketRates.find(r => r.sourceCurrency === pairCode) ?? null
  const rateDisplay = rate === null ? 'rate unavailable' : isSwapped
    ? `1 ${toCode} = ${(1 / rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${fromCode}`
    : `1 ${fromCode} = ${rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${toCode}`
  const showCorporateEmpty = rateMode === 'std' && !hasCorporate

  const sides = { options: activeCurrencies, all: currencies, noRate: rate === null }

  return (
    <div className="flex flex-col gap-3">
      <div className={cn('flex gap-3', wide ? 'items-center justify-between' : 'flex-col items-start')}>
        <p className="text-[11px] text-muted-foreground max-w-[560px] leading-relaxed">{CONVERTER_SUBTITLE}</p>
        <RateTypeToggle mode={rateMode} onChange={setRateMode} corporateAvailable={hasCorporate} />
      </div>

      <div className={cn('flex gap-2.5', wide ? 'items-stretch' : 'flex-col')}>
        <ConverterSide side="From" code={fromCode} setCode={pickFrom} amount={fromAmount} onAmountChange={onFromChange} {...sides} />
        <div className="flex items-center justify-center">
          <Tooltip content={isSwapped ? 'Inverse direction. Click to restore.' : 'Swap direction'} side="top">
            <button
              type="button"
              onClick={swap}
              aria-pressed={isSwapped}
              aria-label="Swap from and to currencies"
              className={cn('w-9 h-9 rounded-full flex items-center justify-center border shadow-xs transition-colors cursor-pointer',
                isSwapped ? 'bg-primary text-white border-primary hover:bg-[#0862D0]' : 'bg-white text-fg-muted border-border hover:text-primary hover:border-primary/40')}
            >
              <ArrowLeftRight className={cn('w-4 h-4', !wide && 'rotate-90')} />
            </button>
          </Tooltip>
        </div>
        <ConverterSide side="To" code={toCode} setCode={pickTo} amount={toAmount} onAmountChange={onToChange} {...sides} />
      </div>

      {showCorporateEmpty && (
        <Banner
          tone="warning"
          title="No corporate rate has been set for this currency pair yet."
          action={<Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => navigate(`/accounting/exchange-rates?addCorp=${encodeURIComponent(pairCode)}`)}>Set corporate rate</Button>}
        >
          The mid-market rate is being used by default.
        </Banner>
      )}

      <div className="flex items-center gap-1.5 flex-wrap text-[12px] text-fg-muted leading-relaxed">
        <span>
          Using <span className="text-fg" style={{ fontWeight: 600 }}>{effectiveMode === 'std' ? 'corporate rate' : 'mid-market rate'}</span>
          {' · '}<span className={cn('tabular-nums', rate !== null && 'text-fg')} style={{ fontWeight: rate !== null ? 600 : 400 }}>{rateDisplay}</span>
          {effectiveMode === 'mid' && midRecord && <>{' · '}Auto-synced from {API_PROVIDER}{' · '}Last updated {fmtDateTime(LAST_SYNC)}</>}
          {effectiveMode === 'std' && stdRecord && <>{' · '}Manually set by {stdRecord.createdBy} on {fmtDateTime(stdRecord.updatedAt || stdRecord.effectiveDate)}</>}
        </span>
        {isSwapped && (
          <Tooltip content={INVERSE_BADGE_TOOLTIP} side="top">
            <span className="inline-flex cursor-help" tabIndex={0}>
              <Badge tone="info"><ArrowLeftRight className="w-2.5 h-2.5 mr-1" />Inverse rate</Badge>
            </span>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
