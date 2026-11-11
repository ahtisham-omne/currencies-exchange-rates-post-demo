// Currency pair detail (/accounting/exchange-rates/:code?type=mid|std), rebuilt on
// the CoA kit's detail skeleton: sticky DetailHeaderCard with status and rate
// type, Dashboard (range bar, insights tiles and chart widgets, rail cards),
// Rate history as a table tab, then Notes, Attachments, Communications, Activity.
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Activity, Archive, ArchiveRestore, ArrowLeftRight, Check, ChevronDown, FileText, History, MessageSquare, Pencil, Plus, Star,
} from 'lucide-react'
import { useExchangeRates } from '../context/ExchangeRateContext'
import { useCurrencies } from '../context/CurrencyContext'
import { API_PROVIDER, isRateInEffect, upcomingRateOf } from '../data/exchangeRates'
import { CoaPage } from '../coa/components/CoaPage'
import { DetailHeaderCard } from '../coa/components/DetailHeaderCard'
import {
  DetailPageLayout, DashboardGrid, DetailNotFound, InfoAuditGrid, InfoGrid, InfoPerson, InfoValue, useDetailFullView, useDetailTab,
} from '../coa/components/DetailPageLayout'
import { DetailInsightsSection, type DetailKpiFace } from '../coa/components/DetailInsights'
import { DashInfoCard, DashInfoLabel } from '../coa/components/DashInfoCard'
import { Badge, Menu, MenuItem } from '../coa/components/ui'
import { StatusChip, StatusMenu } from '../coa/components/StatusChip'
import { useRecordNotes } from '../coa/components/NotesTab'
import { RecordAttachmentsTab, useRecordAttachmentCount } from '../coa/components/AttachmentsTab'
import type { RangeValue } from '../coa/components/PeriodBar'
import { InsightsRangeMenu, InsightsRangeReset, type InsightsRange } from './exchange/InsightsRangeMenu'
import { parseISO, subMonths } from 'date-fns'
import { recordKey } from '../coa/lib/recordStore'
import { cn, fmtDate, fmtDateTime, fmtNumber, todayIso } from '../coa/lib/utils'
import { RATE_TOOLTIPS, inverseRateTooltip } from '../utils/rateCopy'
import {
  BASE, BASE_NAME, LAST_SYNC_AT, LAST_SYNC_DATE, LAST_SYNC_DAY, daysSince, decimalsOf, fmtInverse, fmtRate, fmtSignedPct,
  varianceColor, variancePct, pairPath,
} from './exchange/rateModel'
import {
  DEFAULT_RANGE, buildPairSeries, corporateRecordFor, isDefaultRange, rangeAverageLabel, rangeLabel, rangeMetrics,
  rateHistory, windowRange,
} from './exchange/pairData'
import {
  DEFAULT_MID_KPIS, DEFAULT_MID_WIDGETS, DEFAULT_STD_KPIS, DEFAULT_STD_WIDGETS, MID_KPI_KEYS, MID_WIDGET_KEYS,
  STD_KPI_KEYS, STD_WIDGET_KEYS, pairKpis, pairWidgets, renderPairWidget,
} from './exchange/pairInsights'
import { CORPORATE_STATUS_OPTIONS, MID_STATUS_OPTIONS, useCorporateRateLifecycle } from './exchange/rateLifecycle'
import { useCorporateRateForm } from './exchange/CorporateRateForm'
import { PairInverter } from './exchange/PairInverter'
import { RateHistoryTab } from './exchange/RateHistoryTab'
import { pairAttachments, pairNotes } from './exchange/recordSamples'
import { RecordNotesTab } from './recordTabs/NotesTab'
import { ComingSoonTab } from './recordTabs/ComingSoonTab'
import { linkedDocs } from './currency/model'
import { CX_TITLE } from './CurrencyExchangeHeader'

const TABS = ['dashboard', 'history', 'notes', 'attachments', 'communications', 'activity'] as const
type Tab = typeof TABS[number]

const ACTIONS_BTN = 'h-9 px-3.5 text-[13px] rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm'
const PRIMARY_BTN = 'h-9 px-4 text-[13px] rounded-lg bg-primary hover:bg-[#0862D0] text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm'

export function CurrencyPairDetailPage() {
  const { code: rawCode } = useParams<{ code: string }>()
  const code = (rawCode ?? '').toUpperCase()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { midMarketRates, standardRates, rateAudit } = useExchangeRates()
  const { currencies } = useCurrencies()
  const lifecycle = useCorporateRateLifecycle()
  const form = useCorporateRateForm()

  const mid = midMarketRates.find(m => m.sourceCurrency === code)
  const isBase = code === BASE
  const isStd = params.get('type') === 'std' && !isBase
  const type = isStd ? 'std' : 'mid'
  const record = corporateRecordFor(code, standardRates)
  const active = record?.status === 'active' ? record : undefined
  // The rate in effect today, and one dated for later (shown as Upcoming).
  const today = todayIso()
  const inEffect = active && isRateInEffect(active, today) ? active : undefined
  const upcoming = active ? upcomingRateOf(active, today) : null

  const [tab, setTab] = useDetailTab<Tab>(TABS, `${code}:${type}`)
  const [fullscreen, toggleFullscreen] = useDetailFullView('fx.pair.fullView', tab, { history: true })
  const [range, setRange] = useState<RangeValue>(DEFAULT_RANGE)
  const [inverted, setInverted] = useState(false)

  const key = recordKey('exchangeRate', `${code}:${type}`)
  // What the record tabs open with, derived from the pair and its rate type
  // (CoA's lib/notes and seeded attachments): the corporate record's own notes
  // carried over with a tag, plus the history a rate in use would carry.
  const derivedNotes = useMemo(() => pairNotes(code, type, record), [code, type, record])
  const seedFiles = useCallback(() => pairAttachments(code, type, record), [code, type, record])
  const noteCount = useRecordNotes(key, derivedNotes).length
  const attachmentCount = useRecordAttachmentCount(key, seedFiles)

  const series = useMemo(() => (mid ? buildPairSeries(mid, rateAudit) : []), [mid, rateAudit])
  // The range calendar opens on the month before the last sync, where the data is.
  const rangeMonth = useMemo(() => (series.length ? subMonths(parseISO(series[series.length - 1].date), 1) : undefined), [series])
  const history = useMemo(() => rateHistory(code, series, rateAudit), [code, series, rateAudit])
  const points = useMemo(() => windowRange(series, range), [series, range])
  const metrics = useMemo(() => rangeMetrics(points), [points])

  const crumbs = [{ label: 'Accounting', to: '/accounting' }, { label: CX_TITLE, to: '/accounting/exchange-rates' }, { label: code || 'Pair' }]

  if (!mid) {
    return (
      <CoaPage crumbs={crumbs}>
        <DetailNotFound icon={<ArrowLeftRight size={20} />} title="Currency pair not found" onBack={() => navigate('/accounting/exchange-rates')} backLabel="Back to Exchange Rates" />
      </CoaPage>
    )
  }

  const pair = `${code}/${BASE}`
  const label = rangeLabel(range)
  const archived = isStd && record?.status === 'archived'
  const variance = inEffect ? variancePct(inEffect.standardRate, mid.rate) : null
  const upcomingLine = upcoming ? `Upcoming ${fmtRate(upcoming.standardRate)} from ${fmtDate(upcoming.effectiveDate)}` : undefined
  // FX exposure: the open documents in this currency, valued in the base currency.
  const pairCurrency = currencies.find(c => c.code === code)
  const openDocs = pairCurrency ? linkedDocs(pairCurrency) : []

  /* ── KPI tiles ──
     Every tile answers for the selected period. Figures over the period (change,
     volatility, the average corporate variance) cover all of it; a rate a tile
     quotes is the one on the period's last day, which is the last sync for the
     presets and the chosen end day for a custom range. FX Exposure is about the
     transactions open today, and says so. */
  const colored = (text: string, color?: string) => <span style={color ? { color } : undefined}>{text}</span>
  const end = points[points.length - 1]
  const atLatest = !end || end.date === series[series.length - 1]?.date
  const before = end ? series[series.findIndex(p => p.date === end.date) - 1] : undefined
  const endChange = atLatest ? mid.change24h : end && before ? ((end.mid - before.mid) / before.mid) * 100 : 0
  const corpDays = points.filter(p => p.corp != null)
  const avgVariance = corpDays.length ? corpDays.reduce((s, p) => s + (variancePct(p.corp!, p.mid) ?? 0), 0) / corpDays.length : null
  const face = (k: string): DetailKpiFace & { text: string } => {
    switch (k) {
      case 'current_mid': {
        const rate = atLatest ? mid.rate : end.mid
        const c = endChange >= 0 ? '#059669' : '#DC2626'
        return { text: fmtRate(rate), value: fmtRate(rate), subDetail: <>{colored(fmtSignedPct(endChange), c)} · as of {atLatest ? LAST_SYNC_DATE : fmtDate(end.date)}</> }
      }
      case 'current_std':
        if (!atLatest) {
          return end.corp != null
            ? { text: fmtRate(end.corp), value: fmtRate(end.corp), subDetail: `As of ${fmtDate(end.date)}` }
            : { text: 'Not Set', value: 'Not Set', subDetail: `None in effect on ${fmtDate(end.date)}` }
        }
        return inEffect
          ? { text: fmtRate(inEffect.standardRate), value: fmtRate(inEffect.standardRate), subDetail: upcomingLine ?? `Effective ${fmtDate(inEffect.effectiveDate)}` }
          : { text: 'Not Set', value: 'Not Set', subDetail: upcomingLine ?? (record ? 'Last rate archived' : undefined) }
      case 'range_change': {
        const t = fmtSignedPct(metrics.change)
        return { text: t, value: colored(t, metrics.change >= 0 ? '#059669' : '#DC2626'), subDetail: label }
      }
      case 'range_volatility': {
        const v = metrics.volatility
        const level = v < 0.3 ? 'Low' : v < 0.8 ? 'Moderate' : 'High'
        const c = v < 0.3 ? '#059669' : v < 0.8 ? '#D97706' : '#DC2626'
        return { text: `${v.toFixed(3)}%`, value: <>{v.toFixed(3)}% <span className="text-[12px]" style={{ color: c, fontWeight: 600 }}>{level}</span></>, subDetail: label }
      }
      case 'variance':
        // Averaged over the days in the period a corporate rate was in effect.
        return avgVariance == null
          ? { text: 'N/A', value: 'N/A', subDetail: 'No corporate rate in this period' }
          : { text: fmtSignedPct(avgVariance), value: colored(fmtSignedPct(avgVariance), varianceColor(avgVariance)), subDetail: rangeAverageLabel(range) }
      case 'days_since_update': {
        if (!inEffect) return upcoming ? { text: '0 days', value: '0 days', subDetail: `Takes effect ${fmtDate(upcoming.effectiveDate)}` } : { text: 'N/A', value: 'N/A' }
        const d = daysSince(inEffect.effectiveDate)
        const t = `${fmtNumber(d)} ${d === 1 ? 'day' : 'days'}`
        return { text: t, value: t, subDetail: `Since ${fmtDate(inEffect.effectiveDate)}` }
      }
      case 'fx_exposure_30d': {
        // At the current mid-market rate: what moves with the market.
        // In full, to the base currency's own decimals.
        const dp = decimalsOf(BASE)
        const total = openDocs.reduce((s, d) => s + d.amount, 0) * mid.rate
        const t = `${BASE} ${total.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`
        return {
          text: t,
          value: <span title={t} className="whitespace-nowrap">{t}</span>,
          subDetail: openDocs.length ? `Today, across ${fmtNumber(openDocs.length)} open ${openDocs.length === 1 ? 'transaction' : 'transactions'}` : 'No open transactions today',
        }
      }
      default: return { text: '–', value: '–' }
    }
  }

  const kpiKeys = isStd ? STD_KPI_KEYS : MID_KPI_KEYS
  const kpis = pairKpis(code).filter(k => kpiKeys.includes(k.key)).sort((a, b) => kpiKeys.indexOf(a.key) - kpiKeys.indexOf(b.key))
  const widgetKeys = isStd ? STD_WIDGET_KEYS : MID_WIDGET_KEYS
  const widgets = pairWidgets(isStd, code).filter(w => widgetKeys.includes(w.key)).sort((a, b) => widgetKeys.indexOf(a.key) - widgetKeys.indexOf(b.key))
  const bodyProps = {
    code, points, label, isStd, lastDay: LAST_SYNC_DAY,
    corporate: inEffect ? { rate: inEffect.standardRate, effectiveDate: inEffect.effectiveDate } : null,
  }

  /* ── Header pieces ── */
  const switchTo = (t: 'mid' | 'std') => navigate(pairPath(code, t))
  const rateTypeChip = (() => {
    const cls = isStd ? 'badge-orange' : 'badge-purple'
    const Icon = isStd ? Star : Activity
    const text = isStd ? 'Corporate Rate' : 'Mid-Market Rate'
    if (!record || isBase) return <span className={cn(cls, 'gap-1')}><Icon className="w-3 h-3" />{text}</span>
    return (
      <Menu align="left" trigger={
        <button type="button" aria-haspopup="menu" aria-label={`Rate type: ${text}. Switch rate type`}
          className={cn(cls, 'gap-1 cursor-pointer transition-all duration-150 hover:ring-2 hover:ring-offset-1 hover:ring-border')}>
          <Icon className="w-3 h-3" />{text}<ChevronDown className="w-3 h-3" />
        </button>
      }>
        {close => (
          <>
            <MenuItem icon={<Activity size={14} />} active={!isStd} onClick={() => { close(); if (isStd) switchTo('mid') }}>
              <span className="flex-1">Mid-Market Rate</span>{!isStd && <Check size={14} className="text-primary ml-2" />}
            </MenuItem>
            <MenuItem icon={<Star size={14} />} active={isStd} onClick={() => { close(); if (!isStd) switchTo('std') }}>
              <span className="flex-1">Corporate Rate</span>{isStd && <Check size={14} className="text-primary ml-2" />}
            </MenuItem>
          </>
        )}
      </Menu>
    )
  })()

  const statusBadge: ReactNode = isStd
    ? record
      ? <StatusMenu status={record.status === 'archived' ? 'Archived' : 'Active'} options={CORPORATE_STATUS_OPTIONS} onPick={next => lifecycle.request(next, record)} />
      : <StatusChip status="Not Set" tone="neutral" />
    : <StatusMenu status="Active" options={MID_STATUS_OPTIONS} onPick={() => {}} readOnly />

  const actions = (
    <>
      <Menu trigger={
        <button type="button" aria-label="Rate actions" className={ACTIONS_BTN} style={{ fontWeight: 500 }}>
          Actions
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>
      }>
        {close => (
          <>
            {record && !isBase && (
              <MenuItem icon={<ArrowLeftRight size={14} />} onClick={() => { close(); switchTo(isStd ? 'mid' : 'std') }}>
                {isStd ? 'View Mid-Market Rate' : 'View Corporate Rate'}
              </MenuItem>
            )}
            {!isStd && !isBase && (active
              ? <MenuItem icon={<Pencil size={14} />} onClick={() => { close(); form.openUpdate(active.id) }}>Update Corporate Rate</MenuItem>
              : <MenuItem icon={<Plus size={14} />} onClick={() => { close(); form.openAdd(code) }}>Set Corporate Rate</MenuItem>)}
            {isStd && active && <MenuItem icon={<Archive size={14} />} danger onClick={() => { close(); lifecycle.archive(active) }}>Archive Rate</MenuItem>}
            {isStd && archived && record && <MenuItem icon={<ArchiveRestore size={14} />} onClick={() => { close(); lifecycle.restore(record) }}>Restore Rate</MenuItem>}
          </>
        )}
      </Menu>
      {isStd && active && (
        <button type="button" onClick={() => form.openUpdate(active.id)} className={PRIMARY_BTN} style={{ fontWeight: 600 }}>
          <Pencil className="w-3.5 h-3.5" />
          Update Rate
        </button>
      )}
      {isStd && !active && (
        <button type="button" onClick={() => form.openAdd(code)} className={PRIMARY_BTN} style={{ fontWeight: 600 }}>
          <Plus className="w-3.5 h-3.5" />
          Set Corporate Rate
        </button>
      )}
    </>
  )

  /* ── Rail ── */
  // A corporate rate shows the one in effect (or the archived one); a rate
  // added for a later date has none yet and shows only as Upcoming.
  const currentRecord = archived ? record : inEffect
  const shownRate = isStd ? (currentRecord?.standardRate ?? null) : mid.rate
  const rail = (
    <>
      <DashInfoCard title="Rate Information" icon={FileText}>
        <InfoGrid>
          <div className="min-w-0"><DashInfoLabel>Pair</DashInfoLabel><InfoValue strong>{code} / {BASE}</InfoValue></div>
          <div className="min-w-0"><DashInfoLabel align="right" tooltip={RATE_TOOLTIPS.rateType}>Rate Type</DashInfoLabel><InfoValue>{isStd ? 'Corporate Rate' : 'Mid-Market Rate'}</InfoValue></div>
          <div className="min-w-0">
            <DashInfoLabel>{archived ? 'Rate (Archived)' : 'Rate'}</DashInfoLabel>
            {shownRate != null ? <InfoValue strong className="tabular-nums">{fmtRate(shownRate)} {BASE}</InfoValue> : <InfoValue empty>{upcoming ? 'None in effect yet' : 'Not Set'}</InfoValue>}
          </div>
          <div className="min-w-0">
            <DashInfoLabel align="right" tooltip={shownRate != null ? inverseRateTooltip(code, BASE, fmtInverse(shownRate)) : RATE_TOOLTIPS.inverse}>Inverse Rate</DashInfoLabel>
            {shownRate != null ? <InfoValue className="tabular-nums">{fmtInverse(shownRate)} {code}</InfoValue> : <InfoValue empty>–</InfoValue>}
          </div>
          <div className="min-w-0"><DashInfoLabel>Source</DashInfoLabel><InfoValue>{isStd ? 'Set by your team' : API_PROVIDER}</InfoValue></div>
          <div className="min-w-0">
            <DashInfoLabel align="right" tooltip={isStd ? RATE_TOOLTIPS.effectiveDate : undefined}>Effective Date</DashInfoLabel>
            {isStd ? (currentRecord ? <InfoValue>{fmtDate(currentRecord.effectiveDate)}</InfoValue> : <InfoValue empty>–</InfoValue>) : <InfoValue>{fmtDate(mid.effectiveDate)}</InfoValue>}
          </div>
          {isStd ? (
            <>
              {upcoming && (
                <div className="min-w-0 col-span-2">
                  <DashInfoLabel tooltip={RATE_TOOLTIPS.upcoming}>Upcoming Rate</DashInfoLabel>
                  <InfoValue className="tabular-nums">
                    <span className="inline-flex items-center gap-1.5"><Badge tone="info">Upcoming</Badge>{fmtRate(upcoming.standardRate)} {BASE} from {fmtDate(upcoming.effectiveDate)}</span>
                  </InfoValue>
                </div>
              )}
              <div className="min-w-0"><DashInfoLabel tooltip={RATE_TOOLTIPS.midMarket}>Mid-Market Rate</DashInfoLabel><InfoValue className="tabular-nums">{fmtRate(mid.rate)} {BASE}</InfoValue></div>
              <div className="min-w-0">
                <DashInfoLabel align="right" tooltip={RATE_TOOLTIPS.variance}>Variance</DashInfoLabel>
                {variance != null ? <InfoValue className="tabular-nums"><span style={{ color: varianceColor(variance) }}>{fmtSignedPct(variance)}</span></InfoValue> : <InfoValue empty>–</InfoValue>}
              </div>
            </>
          ) : (
            <>
              <div className="min-w-0">
                <DashInfoLabel tooltip={RATE_TOOLTIPS.change24h}>Change (24h)</DashInfoLabel>
                <InfoValue className="tabular-nums"><span style={{ color: mid.change24h > 0 ? '#059669' : mid.change24h < 0 ? '#DC2626' : undefined }}>{fmtSignedPct(mid.change24h)}</span></InfoValue>
              </div>
              <div className="min-w-0"><DashInfoLabel align="right" tooltip={RATE_TOOLTIPS.lastSync}>Last Sync</DashInfoLabel><InfoValue>{LAST_SYNC_AT}</InfoValue></div>
            </>
          )}
        </InfoGrid>
        {isStd && record?.notes && (
          <div className="mb-2.5 min-w-0"><DashInfoLabel>Notes</DashInfoLabel><p className="text-[12px] text-slate-700 mt-0.5 leading-relaxed" style={{ fontWeight: 500 }}>{record.notes}</p></div>
        )}
        {/* Who set a corporate rate up and when. A mid-market rate is the
            provider's, already dated by Last Sync above, so it has no audit row. */}
        {isStd && record && (
        <InfoAuditGrid>
          <div className="min-w-0"><DashInfoLabel>Created By</DashInfoLabel><InfoPerson name={record.createdBy} /></div>
          <div className="min-w-0"><DashInfoLabel align="right">Created On</DashInfoLabel><InfoValue>{fmtDate(record.createdAt)}</InfoValue></div>
          <div className="min-w-0"><DashInfoLabel>Last Updated On</DashInfoLabel><InfoValue>{fmtDateTime(record.updatedAt)}</InfoValue></div>
        </InfoAuditGrid>
        )}
      </DashInfoCard>
      <DashInfoCard title="Pair Converter" icon={ArrowLeftRight} tooltip={`Converts an amount between ${code} and ${BASE} at this rate. Type an amount, or swap to convert the other way.`}>
        {shownRate != null ? (
          <PairInverter layout="stack" code={code} name={mid.sourceCurrencyName} rate={shownRate}
            inverted={inverted} onToggle={() => setInverted(v => !v)} note={isStd ? (archived ? 'At the archived corporate rate' : 'At the corporate rate') : 'At the mid-market rate'} />
        ) : isStd && upcoming ? (
          <PairInverter layout="stack" code={code} name={mid.sourceCurrencyName} rate={upcoming.standardRate}
            inverted={inverted} onToggle={() => setInverted(v => !v)} note={`At the upcoming corporate rate, from ${fmtDate(upcoming.effectiveDate)}`} />
        ) : (
          <p className="text-[12px] text-slate-400">No corporate rate is set for this pair yet.</p>
        )}
      </DashInfoCard>
    </>
  )

  return (
    <CoaPage crumbs={crumbs}>
      <DetailPageLayout
        fullscreen={fullscreen}
        fillsWindow={tab === 'history'}
        swapKey={tab}
        header={
          <DetailHeaderCard
            fullscreen={fullscreen}
            onToggleFullscreen={toggleFullscreen}
            onBack={() => navigate('/accounting/exchange-rates')}
            backTitle="Back to Exchange Rates"
            numberLabel={code}
            title={mid.sourceCurrencyName}
            tone={archived ? 'danger' : 'default'}
            typeLine={`Quoted against ${BASE} (${BASE_NAME})`}
            titleBadges={<>{statusBadge}{rateTypeChip}</>}
            actions={actions}
            tabs={[
              { id: 'dashboard', label: 'Dashboard' },
              // Every entry the tab holds, mid-market and corporate alike.
              { id: 'history', label: 'Rate History', count: history.length },
              { id: 'notes', label: 'Notes', count: noteCount },
              { id: 'attachments', label: 'Attachments', count: attachmentCount },
              { id: 'communications', label: 'Communications' },
              { id: 'activity', label: 'Activity' },
            ]}
            activeTab={tab}
            onTabChange={id => setTab(id as Tab)}
          />
        }
        overlays={<>{lifecycle.modal}{form.modal}</>}
      >
        {tab === 'dashboard' && (
          <DashboardGrid
            main={
              <>
                <DetailInsightsSection
                  titleExtra={
                    <>
                    <InsightsRangeMenu
                      range={range.kind === 'custom' ? 'custom' : (range.key as InsightsRange)}
                      onRangeChange={k => { if (k !== 'custom') setRange({ kind: 'preset', key: k }) }}
                      customFrom={range.kind === 'custom' ? range.from : ''}
                      customTo={range.kind === 'custom' ? range.to : ''}
                      onCustomChange={(from, to) => setRange({ kind: 'custom', from, to })}
                      defaultMonth={rangeMonth}
                    />
                    {/* Back to 1M, Vendor Invoicing's Reset recipe. */}
                    <InsightsRangeReset dirty={!isDefaultRange(range)} onReset={() => setRange(DEFAULT_RANGE)} />
                    </>
                  }
                  storageKey={`fx.pair.${code}.${type}.insights.v1`}
                  kpis={kpis}
                  widgets={widgets}
                  defaultKpis={isStd ? DEFAULT_STD_KPIS : DEFAULT_MID_KPIS}
                  defaultWidgets={(isStd ? DEFAULT_STD_WIDGETS : DEFAULT_MID_WIDGETS).filter(k => widgetKeys.includes(k))}
                  kpiValue={k => { const { text: _t, ...f } = face(k); return f }}
                  kpiPreview={k => face(k).text}
                  renderWidget={k => renderPairWidget(k, bodyProps)}
                  noun={isStd ? 'corporate rate' : 'exchange rate'}
                />
              </>
            }
            rail={rail}
          />
        )}
        {tab === 'history' && <RateHistoryTab rows={history} code={code} />}
        {tab === 'notes' && <RecordNotesTab noteKey={key} noun="exchange rate" derived={derivedNotes} />}
        {tab === 'attachments' && (
          <RecordAttachmentsTab recordKey={key} seed={seedFiles} document={{ recordLabel: `${pair} ${isStd ? 'corporate rate' : 'mid-market rate'}`, recordKind: 'exchange rate' }} />
        )}
        {/* Communications and Activity follow Vendor Invoicing, which shows these
            two as Coming Soon until their backends land. */}
        {tab === 'communications' && (
          <ComingSoonTab label="Communications" icon={MessageSquare}
            description="Message history for this exchange rate, with your team and partners, will live here. The shared communication surface keeps every conversation attached to the record it is about." />
        )}
        {tab === 'activity' && (
          <ComingSoonTab label="Activity" icon={History}
            description="A chronological audit trail of every action on this exchange rate: rate updates, archives and restores. The activity feed arrives with backend integration." />
        )}
      </DetailPageLayout>
    </CoaPage>
  )
}
