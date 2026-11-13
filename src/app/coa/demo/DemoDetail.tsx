// CoA kit demo: the detail page - DetailHeaderCard with tabs and status menu,
// KPI tiles + Add Insights, two chart widgets, right-rail DashInfoCards,
// Linked transactions table tab, Notes / Attachments / Activity, a ConfirmModal
// (lifecycle) and a FormModal, toasts.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import {
  Activity, ArrowLeftRight, BarChart3, ChevronDown, CircleSlash, Coins, Download, FileText, MessageSquare,
  Pencil, Power, TrendingUp, Wallet, Calendar,
} from 'lucide-react'
import { CoaPage } from '../components/CoaPage'
import { DetailHeaderCard } from '../components/DetailHeaderCard'
import { DetailPageLayout, DashboardGrid, useDetailFullView, useDetailTab, DetailNotFound, InfoGrid, InfoAuditGrid, InfoValue, InfoPerson } from '../components/DetailPageLayout'
import { DetailInsightsSection, useWidgetChartH, useWidgetSize, widgetBarSize, WidgetStatRow, type DetailKpiDef, type DetailWidgetDef } from '../components/DetailInsights'
import { DashInfoCard, DashInfoLabel } from '../components/DashInfoCard'
import { InternalIdField } from '../components/InternalIdField'
import { Badge, Button, FormModal, Input, Marked, Menu, MenuItem, RequiredMark, Textarea, Tooltip } from '../components/ui'
import { DateField } from '../components/DateField'
import { StatusMenu } from '../components/StatusChip'
import { NotesTab, useRecordNotes } from '../components/NotesTab'
import { RecordAttachmentsTab, useRecordAttachmentCount, type AttachmentFile } from '../components/AttachmentsTab'
import { PlaceholderTab } from '../components/PlaceholderTab'
import { ChartWidgetCard } from '../components/ChartWidgetCard'
import { ActivityFeed, type ActivityFeedItem } from '../components/ActivityFeed'
import { PeriodBar, RangeToggle, RangeHeader, describeRange, type RangeValue } from '../components/PeriodBar'
import { CoaTableCard, PillRow, TableEmptyState } from '../components/TableCard'
import { TableToolbar } from '../components/TableToolbar'
import { CoaDataTable, useCoaTable, type CoaColumn } from '../components/CoaDataTable'
import { QuickFilterPill } from '../components/Filters'
import { OverflowPills, PARTNER_CHIP_CLS } from '../components/cells'
import { SectionCard, LockedField } from '../components/formKit'
import { AXIS_PROPS, areaGradient, CHART_MARGIN, CM_TT_STYLE, GRID_PROPS, isoLabel, tickInterval, ChartEmpty } from '../components/chartKit'
import { recordKey, type RecordNote } from '../lib/recordStore'
import { pushToast } from '../lib/toast'
import { fmtDate, fmtNumber, fmtDateTime } from '../lib/utils'
import { FlagImage } from '../components/FlagImage'
import { BASE, demoDocs, demoRates, rateSeries, type DemoDoc } from './demoData'
import { CURRENCY_STATUS_OPTIONS, useCurrencyLifecycle, useDemoCurrencies } from './DemoList'

const TABS = ['dashboard', 'linked', 'notes', 'attachments', 'communications', 'activity'] as const
type Tab = typeof TABS[number]

const KPIS: DetailKpiDef[] = [
  { key: 'mid', label: 'Mid-market rate', description: 'One unit in the base currency at the provider\'s mid-market rate.', category: 'Rates' },
  { key: 'corporate', label: 'Corporate rate', description: 'The rate your company set for this currency.', category: 'Rates' },
  { key: 'change', label: 'Change', description: 'Movement of the mid-market rate over the last day.', category: 'Rates' },
  { key: 'open', label: 'Open documents', description: 'Documents in this currency that are still open.', category: 'Usage' },
  { key: 'value', label: 'Total linked value', description: 'The sum of every open document in this currency.', category: 'Usage' },
  { key: 'last', label: 'Last transaction', description: 'The most recent document in this currency.', category: 'Usage' },
]
const WIDGETS: DetailWidgetDef[] = [
  { key: 'trend', label: 'Rate trend', description: 'The mid-market rate against the base currency over time.', category: 'Charts', icon: TrendingUp, iconBg: '#ECFDF5', iconColor: '#059669', previewType: 'area' },
  { key: 'docs', label: 'Linked documents by type', description: 'Open documents in this currency, by document type.', category: 'Charts', icon: BarChart3, previewType: 'bar' },
]

const RANGES = [
  { key: '1d', label: '1D' }, { key: '5d', label: '5D' }, { key: '1m', label: '1M' },
  { key: '1y', label: '1Y' }, { key: '5y', label: '5Y' }, { key: 'max', label: 'Max' },
]
const RANGE_DAYS: Record<string, number> = { '1d': 2, '5d': 5, '1m': 30, '1y': 365, '5y': 400, max: 400 }
const RANGE_LONG: Record<string, string> = { '1d': 'Over last day', '5d': 'Over last 5 days', '1m': 'Over last 30 days', '1y': 'Over last year', '5y': 'Over last 5 years', max: 'Over full history' }

export function DemoDetail({ code }: { code: string }) {
  const navigate = useNavigate()
  const [rows, setRows] = useDemoCurrencies()
  const lifecycle = useCurrencyLifecycle(setRows)
  const c = rows.find(r => r.code === code)
  const [tab, setTab] = useDetailTab<Tab>(TABS, code)
  const [fullscreen, toggleFullscreen] = useDetailFullView('coaKit:detail.fullView', tab, { linked: true })
  const [editOpen, setEditOpen] = useState(false)
  const key = recordKey('currency', code)
  const derivedNotes = useMemo<RecordNote[]>(() => [
    { id: `${code}-n1`, text: `Rates for ${code} are reviewed on the first business day of each month.`, author: 'Marcus Lee (Accountant)', at: '2026-10-01T09:12:00' },
    { id: `${code}-n2`, text: 'Treasury asked for the corporate rate to be revisited after the quarter closes.', author: 'Ahtisham Ahmad (Controller)', at: '2026-09-18T15:40:00', tag: 'Plan Note' },
  ], [code])
  const noteCount = useRecordNotes(key, derivedNotes).length
  const seedFiles = (): AttachmentFile[] => [
    { id: `${code}-a1`, name: `${code} rate policy.pdf`, size: '240 KB', date: '2026-09-02', type: 'pdf', uploadedBy: 'Marcus Lee (Accountant)' },
    { id: `${code}-a2`, name: `${code} revaluation Q3.xlsx`, size: '1.1 MB', date: '2026-10-04', type: 'xlsx', uploadedBy: 'Ahtisham Ahmad (Controller)' },
  ]
  const attachmentCount = useRecordAttachmentCount(key, seedFiles)
  const docs = useMemo(() => demoDocs(code, c && c.inUse > 0 ? 42 : 0), [code, c])

  if (!c) {
    return (
      <CoaPage crumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'CoA kit', to: '/accounting/coa-kit' }, { label: code }]}>
        <DetailNotFound icon={<Coins size={20} />} title="Currency not found" onBack={() => navigate('/accounting/coa-kit')} backLabel="Back to the kit demo" />
      </CoaPage>
    )
  }

  const rate = demoRates(rows).find(r => r.code === code)
  const fillsWindow = tab === 'linked'

  return (
    <CoaPage crumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'CoA kit', to: '/accounting/coa-kit' }, { label: code }]}>
      <DetailPageLayout
        fullscreen={fullscreen}
        fillsWindow={fillsWindow}
        header={
          <DetailHeaderCard
            fullscreen={fullscreen}
            onToggleFullscreen={toggleFullscreen}
            onBack={() => navigate('/accounting/coa-kit')}
            backTitle="Back to the kit demo"
            numberLabel={c.code}
            title={c.name}
            tone={c.status === 'Inactive' ? 'warning' : 'default'}
            typeLine={`${c.country} · ${c.decimals} decimal places`}
            description="A detail page assembled from the kit: header card, tabs, dashboard with insights and widgets, and the record tabs every detail page ends with."
            titleBadges={
              <>
                <StatusMenu status={c.status} options={CURRENCY_STATUS_OPTIONS} onPick={next => lifecycle.request(next, c)} />
                <Tooltip side="bottom" content={`${c.name} (${c.code})`}><span className="inline-flex"><Badge tone="neutral">{c.symbol}</Badge></span></Tooltip>
                {c.isBase && <Badge tone="brand">Base currency</Badge>}
              </>
            }
            actions={
              <>
                <Menu trigger={
                  <button type="button" aria-label="Currency actions" className="h-9 px-3.5 text-[13px] rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm" style={{ fontWeight: 500 }}>
                    Actions
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                }>
                  {close => (
                    <>
                      <MenuItem icon={<ArrowLeftRight size={14} />} onClick={() => { close(); setEditOpen(true) }}>Set corporate rate</MenuItem>
                      <MenuItem icon={<Download size={14} />} onClick={() => { close(); pushToast('Rate history exported', 'success', `${code}, CSV`) }}>Export</MenuItem>
                      {c.status === 'Active'
                        ? <MenuItem icon={<CircleSlash size={14} />} warning onClick={() => { close(); lifecycle.request('Inactive', c) }}>Deactivate currency</MenuItem>
                        : <MenuItem icon={<Power size={14} />} onClick={() => { close(); lifecycle.request('Active', c) }}>Activate currency</MenuItem>}
                    </>
                  )}
                </Menu>
                <button onClick={() => setEditOpen(true)} className="h-9 px-4 text-[13px] rounded-lg bg-primary hover:bg-[#0862D0] text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm" style={{ fontWeight: 600 }}>
                  <Pencil className="w-3.5 h-3.5" />
                  Update rate
                </button>
              </>
            }
            tabs={[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'linked', label: 'Linked transactions', count: docs.length },
              { id: 'notes', label: 'Notes', count: noteCount },
              { id: 'attachments', label: 'Attachments', count: attachmentCount },
              { id: 'communications', label: 'Communications' },
              { id: 'activity', label: 'Activity' },
            ]}
            activeTab={tab}
            onTabChange={id => setTab(id as Tab)}
          />
        }
        overlays={
          <>
            <RateFormModal open={editOpen} onClose={() => setEditOpen(false)} code={c.code} name={c.name} mid={rate?.rate ?? 1} />
            {lifecycle.modal}
          </>
        }
      >
        {tab === 'dashboard' && <DashboardTab c={c} rate={rate?.rate ?? 1} change={rate?.change24h ?? 0} corporate={rate?.corporate} docs={docs} />}
        {tab === 'linked' && <LinkedTab docs={docs} code={c.code} />}
        {tab === 'notes' && <NotesTab noteKey={key} noun="currency" derived={derivedNotes} />}
        {tab === 'attachments' && <RecordAttachmentsTab recordKey={key} seed={seedFiles} document={{ recordLabel: `${c.code} ${c.name}`, recordKind: 'currency' }} />}
        {tab === 'communications' && <PlaceholderTab label="Communications" description={`Emails and chats about ${c.code} will appear here.`} icon={MessageSquare} />}
        {tab === 'activity' && (
          <ChartWidgetCard title="Activity Timeline" icon={Activity}>
            <ActivityFeed items={activityFor(c.code, c.name, c.updatedBy, c.updatedAt, c.status)} />
          </ChartWidgetCard>
        )}
      </DetailPageLayout>
    </CoaPage>
  )
}

function activityFor(code: string, name: string, by: string, at: string, status: string): ActivityFeedItem[] {
  return [
    { id: 'a3', type: status === 'Active' ? 'apply' : 'delete', user: by.replace(/\s*\(.*\)/, ''), verb: status === 'Active' ? 'activated' : 'marked as inactive', target: `${code} ${name}`, date: fmtDateTime(at) },
    { id: 'a2', type: 'edit', user: 'Marcus Lee', verb: 'updated the corporate rate for', target: code, date: fmtDateTime('2026-10-01T09:30:00') },
    { id: 'a1', type: 'create', user: 'System', verb: 'added the currency', target: `${code} ${name}`, date: fmtDateTime('2025-01-01T00:00:00') },
  ]
}

function DashboardTab({ c, rate, change, corporate, docs }: {
  c: ReturnType<typeof useDemoCurrencies>[0][number]
  rate: number
  change: number
  corporate?: number
  docs: DemoDoc[]
}) {
  const [range, setRange] = useState<RangeValue>({ kind: 'preset', key: '1m' })
  const series = useMemo(() => rateSeries(c.code, rate), [c.code, rate])
  const openDocs = docs.filter(d => d.status !== 'Paid')
  const total = openDocs.reduce((s, d) => s + d.amount, 0)
  const last = docs[0]
  const kpiValue = (key: string) => {
    switch (key) {
      case 'mid': return { value: rate.toFixed(4), subDetail: `${BASE} per ${c.code}` }
      case 'corporate': return { value: corporate ? corporate.toFixed(4) : 'Not set', subDetail: corporate ? 'Effective Apr 1, 2026' : undefined }
      case 'change': return { value: <span className={change > 0 ? 'text-success-700' : change < 0 ? 'text-danger-700' : ''}>{change > 0 ? '+' : ''}{change.toFixed(2)}%</span> }
      case 'open': return { value: fmtNumber(openDocs.length) }
      case 'value': return { value: `${c.symbol} ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}` }
      case 'last': return { value: last ? fmtDate(last.date) : '-', subDetail: last ? last.number : 'No documents yet' }
      default: return { value: '-' }
    }
  }
  const kpiPreview = (key: string) => {
    const v = kpiValue(key).value
    return typeof v === 'string' ? v : `${change > 0 ? '+' : ''}${change.toFixed(2)}%`
  }
  const days = range.kind === 'preset' ? RANGE_DAYS[range.key] : 400
  const windowed = range.kind === 'custom' ? series.filter(p => p.date >= range.from && p.date <= range.to) : series.slice(-Math.max(2, days))

  return (
    <DashboardGrid
      main={
        <>
          <PeriodBar variant="standalone" label="Range" icon={<Calendar size={13} className="text-fg-subtle shrink-0" />}
            right={<span className="text-11 text-muted-foreground">{range.kind === 'preset' ? RANGE_LONG[range.key] : describeRange(range, RANGES)}</span>}>
            <RangeToggle options={RANGES} value={range} onChange={setRange} />
          </PeriodBar>
          <DetailInsightsSection
            storageKey={`fx.coaKit.${c.code}.insights.v1`}
            kpis={KPIS}
            widgets={WIDGETS}
            kpiValue={kpiValue}
            kpiPreview={kpiPreview}
            noun="currency"
            renderWidget={k => (k === 'trend' ? <TrendBody series={windowed} code={c.code} /> : <DocsBody docs={openDocs} />)}
          />
        </>
      }
      rail={
        <>
          <DashInfoCard title="Currency information" icon={FileText}>
            <InfoGrid>
              <div className="min-w-0"><DashInfoLabel>Currency code</DashInfoLabel><InfoValue strong>{c.code}</InfoValue></div>
              <div className="min-w-0"><DashInfoLabel>Symbol</DashInfoLabel><InfoValue strong>{c.symbol}</InfoValue></div>
            </InfoGrid>
            <div className="mb-2.5 min-w-0"><DashInfoLabel>Currency name</DashInfoLabel><InfoValue>{c.name}</InfoValue></div>
            <InfoGrid>
              <div className="min-w-0"><DashInfoLabel tooltip="The ISO 4217 three-digit code.">Numeric code</DashInfoLabel><InfoValue>{c.numericCode}</InfoValue></div>
              <div className="min-w-0"><DashInfoLabel align="right" tooltip="Digits after the decimal point that amounts carry.">Decimal places</DashInfoLabel><InfoValue>{c.decimals}</InfoValue></div>
              <div className="min-w-0"><DashInfoLabel>Format preview</DashInfoLabel><InfoValue>{c.symbol} {(1000).toLocaleString(undefined, { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals })}</InfoValue></div>
              <div className="min-w-0"><DashInfoLabel align="right">Base currency</DashInfoLabel><div className="mt-0.5"><Badge tone={c.isBase ? 'warning' : 'neutral'} className={PARTNER_CHIP_CLS}>{c.isBase ? 'Yes' : 'No'}</Badge></div></div>
            </InfoGrid>
            <div className="mb-2.5 min-w-0">
              <DashInfoLabel>Countries / regions</DashInfoLabel>
              <div className="mt-0.5"><OverflowPills category="Countries / Regions" values={c.countries.map((n, i) => ({ name: n, icon: i === 0 ? <FlagImage code={c.flag} className="text-[12px]" /> : undefined }))} /></div>
            </div>
            <InfoAuditGrid>
              <div className="min-w-0"><DashInfoLabel>Created by</DashInfoLabel><InfoPerson name={c.createdBy} /></div>
              <div className="min-w-0"><DashInfoLabel align="right">Created on</DashInfoLabel><InfoValue>{fmtDate(c.createdAt)}</InfoValue></div>
              <div className="min-w-0"><DashInfoLabel>Last updated by</DashInfoLabel><InfoPerson name={c.updatedBy} /></div>
              <InternalIdField id={c.internalId} help="The system's ID for this currency. Quote it when you contact support." />
            </InfoAuditGrid>
          </DashInfoCard>
          <DashInfoCard title="Exchange rate" icon={ArrowLeftRight}>
            <InfoGrid>
              <div className="min-w-0"><DashInfoLabel>Mid-market rate</DashInfoLabel><InfoValue strong className="tabular-nums">{rate.toFixed(4)}</InfoValue></div>
              <div className="min-w-0"><DashInfoLabel align="right">Inverse rate</DashInfoLabel><InfoValue className="tabular-nums">{(1 / rate).toFixed(6)}</InfoValue></div>
              <div className="min-w-0"><DashInfoLabel>Corporate rate</DashInfoLabel>{corporate ? <InfoValue className="tabular-nums">{corporate.toFixed(4)}</InfoValue> : <InfoValue empty>Not set</InfoValue>}</div>
              <div className="min-w-0"><DashInfoLabel align="right">Source</DashInfoLabel><InfoValue>Open Exchange Rates</InfoValue></div>
            </InfoGrid>
            <div className="min-w-0"><DashInfoLabel>Last sync</DashInfoLabel><InfoValue>Apr 10, 2026, 2:30 PM</InfoValue></div>
          </DashInfoCard>
        </>
      }
    />
  )
}

function TrendBody({ series, code }: { series: { date: string; rate: number }[]; code: string }) {
  const chartH = useWidgetChartH()
  const [r, setR] = useState<RangeValue>({ kind: 'preset', key: '30' })
  const opts = [{ key: '7', label: '7d' }, { key: '14', label: '14d' }, { key: '30', label: '30d' }, { key: '90', label: '90d' }]
  const data = r.kind === 'preset' ? series.slice(-Number(r.key)) : series.filter(p => p.date >= r.from && p.date <= r.to)
  if (data.length < 2) return <ChartEmpty icon={TrendingUp} title="No rate history" description="Synced rates will chart here once there are two or more." />
  const first = data[0].rate, lastV = data[data.length - 1].rate
  const id = `kitTrend-${code}`
  return (
    <>
      <RangeHeader value={r} onChange={setR} options={opts} longLabels={{ '7': 'Last 7 days', '14': 'Last 14 days', '30': 'Last 30 days', '90': 'Last 90 days' }} />
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={CHART_MARGIN}>
            {areaGradient(id, "#059669")}
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="date" tickFormatter={isoLabel} {...AXIS_PROPS} interval={tickInterval(data.length)} />
            <YAxis tickFormatter={(v: number) => v.toFixed(2)} {...AXIS_PROPS} width={50} domain={['auto', 'auto']} />
            <RTooltip contentStyle={CM_TT_STYLE} labelFormatter={(l: string) => isoLabel(l)} formatter={(v: number) => [v.toFixed(4), 'Mid-market']} />
            <Area type="monotone" dataKey="rate" stroke="#059669" strokeWidth={2} fill={`url(#${id})`} dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <WidgetStatRow stats={[
        { label: 'Open', value: first.toFixed(4) },
        { label: 'Latest', value: lastV.toFixed(4) },
        { label: 'Change', value: `${lastV >= first ? '+' : ''}${(((lastV - first) / first) * 100).toFixed(2)}%`, color: lastV >= first ? '#059669' : '#DC2626' },
        { label: 'High', value: Math.max(...data.map(p => p.rate)).toFixed(4) },
      ]} />
    </>
  )
}

function DocsBody({ docs }: { docs: DemoDoc[] }) {
  const chartH = useWidgetChartH()
  const size = useWidgetSize()
  const types = ['Vendor invoice', 'Customer invoice', 'Purchase order', 'Sales order', 'Vendor payment']
  const data = types.map(t => ({ type: t.replace(/ (invoice|order|payment)$/, m => m), short: t.split(' ').map(w => w[0].toUpperCase()).join(''), n: docs.filter(d => d.type === t).length }))
  const COLORS = ['#0A77FF', '#059669', '#EA580C', '#7C3AED', '#0891B2']
  if (!docs.length) return <ChartEmpty icon={Wallet} title="No open documents" description="Open documents in this currency will chart here by type." />
  return (
    <>
      <p className="text-[11px] text-muted-foreground pb-2">Open documents</p>
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="type" {...AXIS_PROPS} interval={0} tickFormatter={(t: string) => SHORT_TYPE[t] ?? t} />
            <YAxis allowDecimals={false} {...AXIS_PROPS} width={30} />
            <RTooltip contentStyle={CM_TT_STYLE} formatter={(v: number) => [v, 'Documents']} />
            <Bar dataKey="n" radius={[4, 4, 0, 0]} maxBarSize={widgetBarSize(size, 32)}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <WidgetStatRow stats={[{ label: 'Documents', value: fmtNumber(docs.length) }, { label: 'Types', value: data.filter(d => d.n).length }]} />
    </>
  )
}

const SHORT_TYPE: Record<string, string> = { 'Vendor invoice': 'Vendor inv.', 'Customer invoice': 'Customer inv.', 'Purchase order': 'PO', 'Sales order': 'SO', 'Vendor payment': 'Payment' }
const DOC_TONE: Record<DemoDoc['status'], 'info' | 'success' | 'danger' | 'neutral' | 'warning'> = { Open: 'info', Paid: 'success', Overdue: 'danger', Draft: 'neutral', Pending: 'warning' }

function LinkedTab({ docs, code }: { docs: DemoDoc[]; code: string }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<string>('all')
  const types = ['Vendor invoice', 'Customer invoice', 'Purchase order', 'Sales order', 'Vendor payment']
  const rows = type === 'all' ? docs : docs.filter(d => d.type === type)
  const columns = useMemo<CoaColumn<DemoDoc>[]>(() => [
    {
      key: 'number', label: 'Number', locked: true, width: 170,
      render: (d, ctx) => (
        <button type="button" onClick={e => { e.stopPropagation(); pushToast(`${d.number} would open in its quick view`, 'info') }}
          className="inline-flex items-center gap-1.5 tabular-nums text-primary hover:text-[#0862D0] hover:underline underline-offset-2" style={{ fontWeight: 600 }}>
          <FileText size={12} className="text-primary/60" /><MarkedText text={d.number} q={ctx.q} />
        </button>
      ),
      sortValue: d => d.number, searchText: d => d.number, filter: 'text',
    },
    { key: 'type', label: 'Type', headerClassName: 'min-w-[150px]', render: d => <Badge tone="neutral" className={PARTNER_CHIP_CLS}>{d.type}</Badge>, sortValue: d => d.type, searchText: d => d.type, filter: 'multiselect' },
    { key: 'party', label: 'Vendor / customer', headerClassName: 'min-w-[200px]', render: (d, ctx) => <span className="text-sm text-slate-700 block truncate"><MarkedText text={d.party} q={ctx.q} /></span>, sortValue: d => d.party, searchText: d => d.party, filter: 'multiselect' },
    { key: 'status', label: 'Status', render: d => <Badge tone={DOC_TONE[d.status]} className={PARTNER_CHIP_CLS}>{d.status}</Badge>, sortValue: d => d.status, searchText: d => d.status, filter: 'multiselect' },
    { key: 'date', label: 'Date', headerClassName: 'min-w-[120px]', render: d => <span className="text-sm text-slate-700 tabular-nums whitespace-nowrap">{fmtDate(d.date)}</span>, sortValue: d => d.date, searchText: d => fmtDate(d.date), filter: 'date', filterValue: d => d.date },
    { key: 'amount', label: 'Amount', align: 'right', cellClassName: 'pl-4 pr-4', headerClassName: 'min-w-[140px]', render: (d, ctx) => <span className="text-sm font-medium text-slate-700 tabular-nums whitespace-nowrap"><MarkedText text={`${code} ${d.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} q={ctx.q} /></span>, sortValue: d => d.amount, searchText: d => d.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }), filter: 'range' },
  ], [code])
  const table = useCoaTable<DemoDoc>({ columns, rows, query, getRowId: d => d.id, rememberAs: 'coaKit:linked', defaultSort: { key: 'date', dir: 'desc' } })
  return (
    <CoaTableCard
      table={table}
      className="min-h-[calc(100vh-260px)]"
      toolbar={
        <TableToolbar
          search={{ value: query, onChange: setQuery, placeholder: 'Search transactions' }}
          count={{ shown: table.rows.length, total: docs.length, noun: 'transactions' }}
          density={table.densityMenuProps}
          columns={{ open: table.columnsOpen, onToggle: () => table.setColumnsOpen(o => !o), count: table.visibleCount }}
        />
      }
      pills={
        <PillRow>
          <QuickFilterPill label="All" count={docs.length} active={type === 'all'} onClick={() => setType('all')} />
          {types.map(t => <QuickFilterPill key={t} label={`${t}s`} count={docs.filter(d => d.type === t).length} active={type === t} onClick={() => setType(t)} />)}
        </PillRow>
      }
    >
      <CoaDataTable
        table={table}
        emptyState={<TableEmptyState noun="transactions" query={query} filtersActive={type !== 'all'} onClearSearch={() => setQuery('')} onClearFilters={() => setType('all')} where="this currency" />}
      />
    </CoaTableCard>
  )
}

function MarkedText({ text, q }: { text: string; q: string }) { return <Marked text={text} q={q} /> }

/* The FormModal + SectionCard + LockedField recipe (spec-detail §6). */
function RateFormModal({ open, onClose, code, name, mid }: { open: boolean; onClose: () => void; code: string; name: string; mid: number }) {
  const [rate, setRate] = useState('')
  const [date, setDate] = useState('2026-11-04')
  const [notes, setNotes] = useState('')
  const n = Number(rate)
  const variance = rate && n > 0 ? ((n - mid) / mid) * 100 : null
  const save = () => {
    if (!(n > 0)) { pushToast('Enter a corporate rate above zero', 'danger'); return }
    onClose()
    pushToast(`Corporate rate for ${code} updated`, 'success', `${n.toFixed(4)} ${BASE}, effective ${fmtDate(date)}`)
  }
  return (
    <FormModal
      open={open}
      onClose={onClose}
      icon={<Pencil size={16} />}
      title={`Update corporate rate`}
      subtitle={<>Set the rate your company uses for <span className="text-fg" style={{ fontWeight: 600 }}>{code} / {BASE}</span>.</>}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save}>Update rate</Button></>}
    >
      <div className="px-6 pt-5 pb-5 space-y-3.5">
        <SectionCard icon={<ArrowLeftRight size={16} />} title="Currency pair">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div><LockedField label="Base currency" why="Every rate is quoted against the base currency.">{BASE} · Pakistani Rupee</LockedField></div>
            <div><LockedField label="Source currency" why="The pair is fixed once a rate exists.">{code} · {name}</LockedField></div>
          </div>
        </SectionCard>
        <SectionCard icon={<TrendingUp size={16} />} title="Rate">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <Input label="Corporate exchange rate" required type="number" step="0.0001" placeholder="e.g. 279.0000" value={rate} onChange={e => setRate(e.target.value)}
              hint={variance == null ? `Mid-market reference: ${mid.toFixed(4)}` : `Variance from mid-market: ${variance >= 0 ? '+' : ''}${variance.toFixed(2)}%`} />
            <div className="space-y-1.5">
              <label className="label flex items-center gap-1">Effective date<RequiredMark show /></label>
              <DateField value={date} onChange={setDate} ariaLabel="Effective date" />
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Notes" badge="Optional">
          <Textarea value={notes} maxLength={500} onChange={e => setNotes(e.target.value.slice(0, 500))} placeholder="Add notes about this rate..." hint={`${notes.length}/500`} />
        </SectionCard>
      </div>
    </FormModal>
  )
}

