// Currency pair detail (/accounting/exchange-rates/:code?type=mid|std), rebuilt on
// the CoA kit's detail skeleton: sticky DetailHeaderCard with status and rate
// type, Dashboard (range bar, insights tiles and chart widgets, rail cards),
// Rate history as a table tab, then Notes, Attachments, Communications, Activity.
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Activity, Archive, ArchiveRestore, ArrowLeftRight, Check, ChevronDown, Download, FileText, Pencil, Plus, Star,
} from 'lucide-react'
import { useExchangeRates } from '../context/ExchangeRateContext'
import { useCurrencies } from '../context/CurrencyContext'
import { API_PROVIDER } from '../data/exchangeRates'
import { CoaPage } from '../coa/components/CoaPage'
import { DetailHeaderCard } from '../coa/components/DetailHeaderCard'
import {
  DetailPageLayout, DashboardGrid, DetailNotFound, InfoAuditGrid, InfoGrid, InfoPerson, InfoValue, useDetailFullView, useDetailTab,
} from '../coa/components/DetailPageLayout'
import { DetailInsightsSection, type DetailKpiFace } from '../coa/components/DetailInsights'
import { DashInfoCard, DashInfoLabel } from '../coa/components/DashInfoCard'
import { InternalIdField } from '../coa/components/InternalIdField'
import { Menu, MenuItem } from '../coa/components/ui'
import { StatusChip, StatusMenu } from '../coa/components/StatusChip'
import { NotesTab, useRecordNotes } from '../coa/components/NotesTab'
import { RecordAttachmentsTab, useRecordAttachmentCount } from '../coa/components/AttachmentsTab'
import { CommsTab, useCommsCount, type Subject } from '../coa/components/CommsTab'
import { ChartWidgetCard } from '../coa/components/ChartWidgetCard'
import { ActivityFeed } from '../coa/components/ActivityFeed'
import type { RangeValue } from '../coa/components/PeriodBar'
import { InsightsRangeMenu, type InsightsRange } from './exchange/InsightsRangeMenu'
import { parseISO, subMonths } from 'date-fns'
import { recordKey } from '../coa/lib/recordStore'
import { useCommsDirectorySync } from '../coa/store'
import { cn, fmtDate, fmtDateTime, fmtNumber, todayIso } from '../coa/lib/utils'
import { RATE_TOOLTIPS } from '../utils/rateCopy'
import { fmtCompactMoney } from '../coa/components/chartKit'
import {
  BASE, BASE_NAME, LAST_SYNC_DATE, LAST_SYNC_DAY, LAST_SYNC_TIME, SYNC_LINE, daysSince, fmtInverse, fmtRate, fmtSignedPct,
  varianceColor, variancePct, pairPath,
} from './exchange/rateModel'
import {
  DEFAULT_RANGE, buildPairSeries, corporateRecordFor, pairFacts, rangeLabel, rangeMetrics,
  rateHistory, windowRange,
} from './exchange/pairData'
import {
  DEFAULT_MID_KPIS, DEFAULT_MID_WIDGETS, DEFAULT_STD_KPIS, DEFAULT_STD_WIDGETS, MID_KPI_KEYS, MID_WIDGET_KEYS, PAIR_KPIS,
  STD_KPI_KEYS, STD_WIDGET_KEYS, pairWidgets, renderPairWidget,
} from './exchange/pairInsights'
import { CORPORATE_STATUS_OPTIONS, MID_STATUS_OPTIONS, useCorporateRateLifecycle } from './exchange/rateLifecycle'
import { useCorporateRateForm } from './exchange/CorporateRateForm'
import { PairInverter } from './exchange/PairInverter'
import { RateHistoryTab } from './exchange/RateHistoryTab'
import { exportRows } from './exchange/rateExport'
import { corporatePairActivity, isSeededRate, midPairActivity, pairAttachments, pairNotes } from './exchange/recordSamples'
import { commsAnchorIso } from './currency/recordSamples'
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
  useCommsDirectorySync(currencies, midMarketRates, standardRates)
  const lifecycle = useCorporateRateLifecycle()
  const form = useCorporateRateForm()

  const mid = midMarketRates.find(m => m.sourceCurrency === code)
  const isBase = code === BASE
  const isStd = params.get('type') === 'std' && !isBase
  const type = isStd ? 'std' : 'mid'
  const record = corporateRecordFor(code, standardRates)
  const active = record?.status === 'active' ? record : undefined

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
  /* Read before the not-found return, because the thread is a hook. A corporate
     rate set up in this session has nothing said about it yet. */
  const commsSubject: Subject = {
    subjectId: mid ? key : '',
    kind: isStd ? 'corporate' : 'mid',
    label: `${code}/${BASE} ${isStd ? 'corporate rate' : 'mid-market rate'}`,
    anchorIso: commsAnchorIso(),
    fresh: isStd && !isSeededRate(record),
  }
  const commsCount = useCommsCount(commsSubject)

  const series = useMemo(() => (mid ? buildPairSeries(mid, rateAudit) : []), [mid, rateAudit])
  // The range calendar opens on the month before the last sync, where the data is.
  const rangeMonth = useMemo(() => (series.length ? subMonths(parseISO(series[series.length - 1].date), 1) : undefined), [series])
  const history = useMemo(() => rateHistory(code, series, rateAudit), [code, series, rateAudit])
  const facts = useMemo(() => pairFacts(code, series, rateAudit), [code, series, rateAudit])
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
  const hasCorpHistory = series.some(p => p.corp != null) || !!active
  const variance = active ? variancePct(active.standardRate, mid.rate) : null
  const historyType = isStd ? 'Corporate' : 'Mid-market'

  /* ── KPI tiles ── */
  const colored = (text: string, color?: string) => <span style={color ? { color } : undefined}>{text}</span>
  const face = (k: string): DetailKpiFace & { text: string } => {
    switch (k) {
      case 'current_mid': {
        const c = mid.change24h >= 0 ? '#059669' : '#DC2626'
        return { text: fmtRate(mid.rate), value: fmtRate(mid.rate), subDetail: <>{colored(fmtSignedPct(mid.change24h), c)} · as of {LAST_SYNC_DATE}</> }
      }
      case 'current_std':
        return active
          ? { text: fmtRate(active.standardRate), value: fmtRate(active.standardRate), subDetail: `Effective ${fmtDate(active.effectiveDate)}` }
          : { text: 'Not set', value: 'Not set', subDetail: record ? 'Last rate archived' : undefined }
      case 'range_change': {
        const t = fmtSignedPct(metrics.change)
        return { text: t, value: colored(t, metrics.change >= 0 ? '#059669' : '#DC2626'), subDetail: label }
      }
      case 'range_high_low': {
        const f = (n: number) => (n < 1 ? n.toFixed(4) : n.toFixed(2))
        const t = `${f(metrics.high)} / ${f(metrics.low)}`
        return { text: t, value: t, subDetail: `Spread ${fmtRate(metrics.high - metrics.low)} · ${label}` }
      }
      case 'range_volatility': {
        const v = metrics.volatility
        const level = v < 0.3 ? 'Low' : v < 0.8 ? 'Moderate' : 'High'
        const c = v < 0.3 ? '#059669' : v < 0.8 ? '#D97706' : '#DC2626'
        return { text: `${v.toFixed(3)}%`, value: <>{v.toFixed(3)}% <span className="text-[12px]" style={{ color: c, fontWeight: 600 }}>{level}</span></>, subDetail: label }
      }
      case 'range_avg_rate':
        return { text: fmtRate(metrics.avg), value: fmtRate(metrics.avg), subDetail: label }
      case 'variance':
        return variance == null
          ? { text: 'N/A', value: 'N/A', subDetail: 'No corporate rate in effect' }
          : { text: fmtSignedPct(variance), value: colored(fmtSignedPct(variance), varianceColor(variance)), subDetail: 'vs current mid-market' }
      case 'days_since_update': {
        if (!active) return { text: 'N/A', value: 'N/A' }
        if (active.effectiveDate > todayIso()) return { text: '0 days', value: '0 days', subDetail: `Takes effect ${fmtDate(active.effectiveDate)}` }
        const d = daysSince(active.effectiveDate)
        const t = `${fmtNumber(d)} ${d === 1 ? 'day' : 'days'}`
        return { text: t, value: t, subDetail: `Since ${fmtDate(active.effectiveDate)}` }
      }
      case 'corp_transactions_30d': {
        const t = active ? fmtNumber(Math.floor(facts.transactions30d * 0.7)) : '0'
        return { text: t, value: t, subDetail: active ? undefined : 'No corporate rate in effect' }
      }
      case 'fx_exposure_30d': {
        const total = Math.round(facts.transactions30d * facts.avg30 * 1200)
        const t = `${BASE} ${total.toLocaleString('en-US')}`
        return { text: t, value: <span title={t}>{fmtCompactMoney(total, `${BASE} `)}</span>, subDetail: `Across ${fmtNumber(facts.transactions30d)} documents` }
      }
      case 'max_variance_30d':
      case 'avg_variance_30d': {
        const vs = facts.variances30
        if (!vs.length) return { text: 'N/A', value: 'N/A', subDetail: 'No corporate rate in the last 30 synced days' }
        const v = k === 'max_variance_30d' ? vs.reduce((m, x) => (Math.abs(x) > Math.abs(m) ? x : m), 0) : vs.reduce((s, x) => s + x, 0) / vs.length
        return { text: fmtSignedPct(v), value: colored(fmtSignedPct(v), varianceColor(v)), subDetail: `Over ${vs.length} synced ${vs.length === 1 ? 'day' : 'days'}` }
      }
      case 'change_count_30d': {
        const t = fmtNumber(facts.changes30)
        return { text: t, value: t, subDetail: 'Last 30 days', onClick: () => setTab('activity') }
      }
      default: return { text: '-', value: '-' }
    }
  }

  const kpiKeys = isStd ? STD_KPI_KEYS : MID_KPI_KEYS
  const kpis = PAIR_KPIS.filter(k => kpiKeys.includes(k.key)).sort((a, b) => kpiKeys.indexOf(a.key) - kpiKeys.indexOf(b.key))
  const widgetKeys = (isStd ? STD_WIDGET_KEYS : MID_WIDGET_KEYS).filter(k => k !== 'variance_trend' || hasCorpHistory)
  const widgets = pairWidgets(isStd).filter(w => widgetKeys.includes(w.key)).sort((a, b) => widgetKeys.indexOf(a.key) - widgetKeys.indexOf(b.key))
  const bodyProps = {
    code, points, label, isStd, lastDay: LAST_SYNC_DAY, avg30: facts.avg30,
    corporate: active ? { rate: active.standardRate, effectiveDate: active.effectiveDate } : null,
  }

  /* ── Header pieces ── */
  const switchTo = (t: 'mid' | 'std') => navigate(pairPath(code, t))
  const rateTypeChip = (() => {
    const cls = isStd ? 'badge-orange' : 'badge-purple'
    const Icon = isStd ? Star : Activity
    const text = isStd ? 'Corporate rate' : 'Mid-market rate'
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
              <span className="flex-1">Mid-market rate</span>{!isStd && <Check size={14} className="text-primary ml-2" />}
            </MenuItem>
            <MenuItem icon={<Star size={14} />} active={isStd} onClick={() => { close(); if (!isStd) switchTo('std') }}>
              <span className="flex-1">Corporate rate</span>{isStd && <Check size={14} className="text-primary ml-2" />}
            </MenuItem>
          </>
        )}
      </Menu>
    )
  })()

  const statusBadge: ReactNode = isStd
    ? record
      ? <StatusMenu status={record.status === 'archived' ? 'Archived' : 'Active'} options={CORPORATE_STATUS_OPTIONS} onPick={next => lifecycle.request(next, record)} />
      : <StatusChip status="Not set" tone="neutral" />
    : <StatusMenu status="Active" options={MID_STATUS_OPTIONS} onPick={() => {}} readOnly />

  const exportHistory = () => {
    const rows = history.filter(r => r.type === historyType)
    void exportRows({
      fileBase: `${code.toLowerCase()}_${isStd ? 'corporate' : 'mid_market'}_rate_history`,
      sheetName: 'Rate history',
      title: `${pair} ${isStd ? 'corporate' : 'mid-market'} rate history`,
      noun: 'entries', one: 'entry',
      headers: ['Effective date', 'Rate type', 'Event', 'Rate value', 'Inverse rate', 'Change', 'Variance vs mid', 'Set by', 'Source', 'Note'],
      rows: rows.map(r => [r.effectiveDate, r.type, r.event, fmtRate(r.rate), fmtInverse(r.rate), r.changePct == null ? '' : fmtSignedPct(r.changePct, 3), r.variance == null ? '' : fmtSignedPct(r.variance), r.by, r.source, r.note]),
      widths: [14, 12, 10, 12, 12, 10, 14, 18, 20, 30],
    }, 'csv')
  }

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
                {isStd ? 'View mid-market rate' : 'View corporate rate'}
              </MenuItem>
            )}
            {!isStd && !isBase && (active
              ? <MenuItem icon={<Pencil size={14} />} onClick={() => { close(); form.openUpdate(active.id) }}>Update corporate rate</MenuItem>
              : <MenuItem icon={<Plus size={14} />} onClick={() => { close(); form.openAdd(code) }}>Set corporate rate</MenuItem>)}
            <MenuItem icon={<Download size={14} />} onClick={() => { close(); exportHistory() }}>Export rate history</MenuItem>
            {isStd && active && <MenuItem icon={<Archive size={14} />} danger onClick={() => { close(); lifecycle.archive(active) }}>Archive rate</MenuItem>}
            {isStd && archived && record && <MenuItem icon={<ArchiveRestore size={14} />} onClick={() => { close(); lifecycle.restore(record) }}>Restore rate</MenuItem>}
          </>
        )}
      </Menu>
      {isStd && active && (
        <button type="button" onClick={() => form.openUpdate(active.id)} className={PRIMARY_BTN} style={{ fontWeight: 600 }}>
          <Pencil className="w-3.5 h-3.5" />
          Update rate
        </button>
      )}
      {isStd && !active && (
        <button type="button" onClick={() => form.openAdd(code)} className={PRIMARY_BTN} style={{ fontWeight: 600 }}>
          <Plus className="w-3.5 h-3.5" />
          Set corporate rate
        </button>
      )}
    </>
  )

  /* ── Rail ── */
  const shownRate = isStd ? (record?.standardRate ?? null) : mid.rate
  const rail = (
    <>
      <DashInfoCard title="Rate information" icon={FileText}>
        <InfoGrid>
          <div className="min-w-0"><DashInfoLabel>Pair</DashInfoLabel><InfoValue strong>{code} / {BASE}</InfoValue></div>
          <div className="min-w-0"><DashInfoLabel align="right" tooltip={isStd ? RATE_TOOLTIPS.corporate : RATE_TOOLTIPS.midMarket}>Rate type</DashInfoLabel><InfoValue>{isStd ? 'Corporate rate' : 'Mid-market rate'}</InfoValue></div>
          <div className="min-w-0">
            <DashInfoLabel>{archived ? 'Rate (archived)' : 'Rate'}</DashInfoLabel>
            {shownRate != null ? <InfoValue strong className="tabular-nums">{fmtRate(shownRate)} {BASE}</InfoValue> : <InfoValue empty>Not set</InfoValue>}
          </div>
          <div className="min-w-0">
            <DashInfoLabel align="right" tooltip={RATE_TOOLTIPS.inverse}>Inverse rate</DashInfoLabel>
            {shownRate != null ? <InfoValue className="tabular-nums">{fmtInverse(shownRate)} {code}</InfoValue> : <InfoValue empty>-</InfoValue>}
          </div>
          <div className="min-w-0"><DashInfoLabel>Source</DashInfoLabel><InfoValue>{isStd ? 'Set by your team' : API_PROVIDER}</InfoValue></div>
          <div className="min-w-0">
            <DashInfoLabel align="right" tooltip={isStd ? RATE_TOOLTIPS.effectiveDate : undefined}>Effective date</DashInfoLabel>
            {isStd ? (record ? <InfoValue>{fmtDate(record.effectiveDate)}</InfoValue> : <InfoValue empty>-</InfoValue>) : <InfoValue>{fmtDate(mid.effectiveDate)}</InfoValue>}
          </div>
          {isStd ? (
            <>
              <div className="min-w-0"><DashInfoLabel tooltip={RATE_TOOLTIPS.midMarket}>Mid-market rate</DashInfoLabel><InfoValue className="tabular-nums">{fmtRate(mid.rate)} {BASE}</InfoValue></div>
              <div className="min-w-0">
                <DashInfoLabel align="right" tooltip={RATE_TOOLTIPS.variance}>Variance</DashInfoLabel>
                {variance != null ? <InfoValue className="tabular-nums"><span style={{ color: varianceColor(variance) }}>{fmtSignedPct(variance)}</span></InfoValue> : <InfoValue empty>-</InfoValue>}
              </div>
            </>
          ) : (
            <>
              <div className="min-w-0">
                <DashInfoLabel tooltip={RATE_TOOLTIPS.change24h}>Change (24h)</DashInfoLabel>
                <InfoValue className="tabular-nums"><span style={{ color: mid.change24h > 0 ? '#059669' : mid.change24h < 0 ? '#DC2626' : undefined }}>{fmtSignedPct(mid.change24h)}</span></InfoValue>
              </div>
              <div className="min-w-0"><DashInfoLabel align="right" tooltip={SYNC_LINE}>Last sync</DashInfoLabel><InfoValue>{LAST_SYNC_DATE}, {LAST_SYNC_TIME} PKT</InfoValue></div>
            </>
          )}
        </InfoGrid>
        {isStd && record?.notes && (
          <div className="mb-2.5 min-w-0"><DashInfoLabel>Notes</DashInfoLabel><p className="text-[12px] text-slate-700 mt-0.5 leading-relaxed" style={{ fontWeight: 500 }}>{record.notes}</p></div>
        )}
        {(!isStd || record) && (
        <InfoAuditGrid>
          <div className="min-w-0"><DashInfoLabel>Created by</DashInfoLabel><InfoPerson name={isStd && record ? record.createdBy : 'System'} /></div>
          <div className="min-w-0"><DashInfoLabel align="right">{isStd ? 'Created on' : 'Last synced on'}</DashInfoLabel><InfoValue>{isStd && record ? fmtDate(record.createdAt) : LAST_SYNC_DATE}</InfoValue></div>
          {isStd && record && <div className="min-w-0"><DashInfoLabel>Last updated</DashInfoLabel><InfoValue>{fmtDateTime(record.updatedAt)}</InfoValue></div>}
          <InternalIdField id={(isStd && record ? record.id : mid.id).toUpperCase()} help="The system's ID for this rate. Quote it when you contact support." />
        </InfoAuditGrid>
        )}
      </DashInfoCard>
      <DashInfoCard title="Pair converter" icon={ArrowLeftRight} tooltip="One unit of either currency at this rate. Swap to read the inverse.">
        {shownRate != null ? (
          <PairInverter layout="stack" code={code} name={mid.sourceCurrencyName} rate={isStd && active ? active.standardRate : isStd && record ? record.standardRate : mid.rate}
            inverted={inverted} onToggle={() => setInverted(v => !v)} note={isStd ? (archived ? 'At the archived corporate rate' : 'At the corporate rate') : 'At the mid-market rate'} />
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
              { id: 'history', label: 'Rate history', count: history.filter(r => r.type === historyType).length },
              { id: 'notes', label: 'Notes', count: noteCount },
              { id: 'attachments', label: 'Attachments', count: attachmentCount },
              { id: 'communications', label: 'Communications', count: commsCount },
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
                    <InsightsRangeMenu
                      range={range.kind === 'custom' ? 'custom' : (range.key as InsightsRange)}
                      onRangeChange={k => { if (k !== 'custom') setRange({ kind: 'preset', key: k }) }}
                      customFrom={range.kind === 'custom' ? range.from : ''}
                      customTo={range.kind === 'custom' ? range.to : ''}
                      onCustomChange={(from, to) => setRange({ kind: 'custom', from, to })}
                      defaultMonth={rangeMonth}
                    />
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
        {tab === 'history' && <RateHistoryTab rows={history} code={code} defaultType={historyType} />}
        {tab === 'notes' && <NotesTab noteKey={key} noun="rate" derived={derivedNotes} />}
        {tab === 'attachments' && (
          <RecordAttachmentsTab recordKey={key} seed={seedFiles} document={{ recordLabel: `${pair} ${isStd ? 'corporate rate' : 'mid-market rate'}`, recordKind: 'exchange rate' }} />
        )}
        {tab === 'communications' && <CommsTab {...commsSubject} />}
        {tab === 'activity' && (
          <ChartWidgetCard title="Activity Timeline" icon={Activity}>
            {isStd ? (
              <ActivityFeed items={corporatePairActivity(code, rateAudit, record, mid.rate)} />
            ) : (
              <>
                <ActivityFeed items={midPairActivity(code, series)} />
                <p className="mt-4 pt-3 border-t border-muted text-[12px] text-slate-400">
                  Mid-market rates are sourced from {API_PROVIDER}; manual changes are tracked on the Corporate rate detail.
                </p>
              </>
            )}
          </ChartWidgetCard>
        )}
      </DetailPageLayout>
    </CoaPage>
  )
}
