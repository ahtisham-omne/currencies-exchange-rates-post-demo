// Pair detail: the KPI and chart catalogues (the currency app's own, in CoA's
// DetailKpiDef / DetailWidgetDef shapes) and the chart widget bodies, drawn with
// CoA's Recharts recipe (chartKit) inside WidgetContentCard.
import { useMemo, useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts'
import { Activity, ArrowDownRight, BarChart3, Banknote, TrendingUp } from 'lucide-react'
import type { DetailKpiDef, DetailWidgetDef } from '../../coa/components/DetailInsights'
import { useWidgetChartH, useWidgetSize, widgetBarSize, WidgetStatRow } from '../../coa/components/DetailInsights'
import { AXIS_PROPS, CHART_MARGIN, CM_TT_STYLE, ChartEmpty, ChartTooltipCard, GRID_PROPS, ZERO_LINE_PROPS, areaGradient, tickInterval } from '../../coa/components/chartKit'
import { ChartLegendDot } from '../../coa/components/ChartWidgetCard'
import { fmtDate, fmtNumber } from '../../coa/lib/utils'
import { BASE, fmtRate, fmtSignedPct, varianceColor, variancePct } from './rateModel'
import { bucketBy, grainFor, rateTick, thin, tickLabelFor, transactionsOn, type PairPoint } from './pairData'

/* ── Catalogues ─────────────────────────────────────────────────────────── */

const VOLATILITY_TIP = 'Standard deviation of daily rate changes within the selected range. Low: under 0.3%, a stable pair. Moderate: 0.3 to 0.8%, normal movement. High: over 0.8%, elevated risk.'

export const PAIR_KPIS: DetailKpiDef[] = [
  { key: 'current_mid', label: 'Current mid-market rate', category: 'Rates', description: 'The latest synced mid-market rate, and its change over the last 24 hours.' },
  { key: 'current_std', label: 'Current corporate rate', category: 'Rates', description: 'The corporate rate in effect for this pair.' },
  { key: 'range_change', label: 'Mid-market change', category: 'Performance', description: 'Percentage change in the mid-market rate over the currently selected range.' },
  { key: 'range_high_low', label: 'Mid-market high / low', category: 'Analytics', description: 'Highest and lowest mid-market rates within the selected range.' },
  { key: 'range_volatility', label: 'Mid-market volatility', category: 'Analytics', description: VOLATILITY_TIP },
  { key: 'range_avg_rate', label: 'Mid-market average rate', category: 'Analytics', description: 'Average mid-market rate within the selected range.' },
  { key: 'variance', label: 'Corporate variance', category: 'Rates', description: 'How far the corporate rate sits from the current mid-market rate.' },
  { key: 'days_since_update', label: 'Days since rate updated', category: 'Operational', description: 'Days since the corporate rate in effect took effect.' },
  { key: 'corp_transactions_30d', label: 'Corporate transactions (30d)', category: 'Operational', description: 'Transactions priced using the corporate rate in the last 30 days.' },
  { key: 'fx_exposure_30d', label: 'FX exposure (30d)', category: 'Operational', description: 'Total absolute value of all transactions denominated in this currency pair over the last 30 days, expressed in the base currency.' },
  { key: 'max_variance_30d', label: 'Max corporate variance (30d)', category: 'Analytics', description: 'The widest daily gap between the corporate and mid-market rates over the last 30 synced days.' },
  { key: 'avg_variance_30d', label: 'Average corporate variance (30d)', category: 'Analytics', description: 'The average daily gap between the corporate and mid-market rates over the last 30 synced days.' },
  { key: 'change_count_30d', label: 'Corporate rate changes (30d)', category: 'Operational', description: 'Times the corporate rate was set, updated, archived or restored in the last 30 days.' },
]

export const MID_KPI_KEYS = ['current_mid', 'range_change', 'range_high_low', 'range_volatility', 'range_avg_rate', 'fx_exposure_30d']
export const STD_KPI_KEYS = ['current_std', 'variance', 'days_since_update', 'corp_transactions_30d', 'fx_exposure_30d', 'max_variance_30d', 'avg_variance_30d', 'change_count_30d']
export const DEFAULT_MID_KPIS = ['current_mid', 'range_change', 'range_high_low', 'range_volatility', 'fx_exposure_30d']
export const DEFAULT_STD_KPIS = ['current_std', 'variance', 'days_since_update', 'corp_transactions_30d', 'fx_exposure_30d']

const GREEN = { iconBg: '#ECFDF5', iconColor: '#059669' }
const VIOLET = { iconBg: '#F5F3FF', iconColor: '#7C3AED' }
const RED = { iconBg: '#FEF2F2', iconColor: '#DC2626' }
const AMBER = { iconBg: '#FFFBEB', iconColor: '#D97706' }

/** The chart catalogue; titles differ by rate type, as they did. */
export function pairWidgets(isStd: boolean): DetailWidgetDef[] {
  return [
    {
      key: 'rate_over_time', category: 'Charts', icon: TrendingUp, previewType: 'line',
      label: isStd ? 'Corporate rate over time' : 'Rate over time',
      description: 'Shows both rates side by side over time. The market rate is the live line; your corporate rate is the stepped line. Hover any date to see both values and the gap between them.',
    },
    {
      key: 'variance_trend', category: 'Charts', icon: BarChart3, previewType: 'bar', ...AMBER,
      label: 'Corporate variance trend',
      description: 'How far your corporate rate sits from the market each day. Colour bands: green within ±1%, amber 1 to 3%, red beyond 3%.',
    },
    {
      key: 'daily_change', category: 'Charts', icon: Activity, previewType: 'area', ...VIOLET,
      label: 'Daily % change',
      description: 'Shows how much the mid-market rate moved each day, up or down. Tall swings mean big moves that day.',
    },
    {
      key: 'cumulative_return', category: 'Charts', icon: TrendingUp, previewType: 'area', ...GREEN,
      label: 'Cumulative return',
      description: 'Shows the total movement of the mid-market rate since the start of the selected period. Answers: "how much has this rate moved overall?"',
    },
    {
      key: 'conversion_trend', category: 'Charts', icon: Banknote, previewType: 'area',
      label: isStd ? 'Corporate conversion trend' : 'Conversion trend',
      description: isStd
        ? 'Historical trend of corporate rates set by your team for this currency pair.'
        : 'Historical mid-market rate movement sourced from your configured provider.',
    },
    {
      key: 'drawdown_from_peak', category: 'Charts', icon: ArrowDownRight, previewType: 'area-red', ...RED,
      label: 'Drawdown from peak',
      description: "Shows how far the mid-market rate has fallen from its recent high. 0% means it's at a new high; -2% means it's 2% below the highest point in the selected period.",
    },
    {
      key: 'transaction_volume', category: 'Charts', icon: BarChart3, previewType: 'bar',
      label: isStd ? 'Corporate transactions' : 'Transaction volume',
      description: 'Bar chart of daily transaction count priced using this corporate rate.',
    },
  ]
}
export const MID_WIDGET_KEYS = ['rate_over_time', 'daily_change', 'cumulative_return', 'conversion_trend', 'drawdown_from_peak', 'variance_trend']
export const STD_WIDGET_KEYS = ['rate_over_time', 'variance_trend', 'transaction_volume', 'conversion_trend']
export const DEFAULT_MID_WIDGETS = ['rate_over_time', 'daily_change']
export const DEFAULT_STD_WIDGETS = ['rate_over_time', 'variance_trend']

/* ── Shared body pieces ─────────────────────────────────────────────────── */

const MID_C = '#0A77FF'
const CORP_C = '#F59E0B'

export interface BodyProps {
  code: string
  points: PairPoint[]
  label: string
  isStd: boolean
  /** The corporate rate in effect now (the active record), if any. */
  corporate: { rate: number; effectiveDate: string } | null
  /** The last synced day; a corporate rate dated after it is not on the charts yet. */
  lastDay: string
  avg30: number
}

function Caption({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap pb-2">
      <p className="text-[11px] text-muted-foreground">{children}</p>
      {right}
    </div>
  )
}

const spanOf = (points: { date: string }[]) =>
  points.length < 2 ? 1 : Math.round((+new Date(points[points.length - 1].date) - +new Date(points[0].date)) / 86400000)

function useAxis(points: { date: string }[]) {
  const span = spanOf(points)
  // Half-width cards fit about six labels; a Large one keeps CoA's eight.
  const wide = useWidgetSize() === 'lg'
  return { tickFormatter: tickLabelFor(span), interval: wide ? tickInterval(points.length) : Math.max(0, Math.ceil(points.length / 6) - 1) }
}

const pendingNote = (corporate: BodyProps['corporate'], lastDay: string) =>
  corporate && corporate.effectiveDate > lastDay
    ? <span className="text-[10.5px] text-[#94A3B8]">{fmtRate(corporate.rate)} takes effect {fmtDate(corporate.effectiveDate)}, after the last sync</span>
    : null

/* ── Bodies ─────────────────────────────────────────────────────────────── */

export function RateOverTimeBody({ code, points, label, isStd, corporate, lastDay }: BodyProps) {
  const chartH = useWidgetChartH()
  const data = useMemo(() => thin(points), [points])
  const axis = useAxis(data)
  const hasCorp = data.some(p => p.corp != null)
  const latest = points[points.length - 1]
  const gap = corporate && latest ? variancePct(corporate.rate, latest.mid) : null
  return (
    <>
      <Caption right={pendingNote(corporate, lastDay)}>{label}</Caption>
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="date" {...AXIS_PROPS} tickFormatter={axis.tickFormatter} interval={axis.interval} />
            <YAxis {...AXIS_PROPS} width={56} domain={['auto', 'auto']} tickFormatter={rateTick} />
            <RTooltip content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload as PairPoint | undefined
              if (!p) return null
              const v = p.corp != null ? variancePct(p.corp, p.mid) : null
              return (
                <ChartTooltipCard title={fmtDate(p.date)} rows={[
                  { label: 'Mid-market', value: `${fmtRate(p.mid)} ${BASE}` },
                  { label: 'Corporate', value: p.corp != null ? `${fmtRate(p.corp)} ${BASE}` : 'Not set' },
                  ...(v != null ? [{ label: 'Gap', value: fmtSignedPct(v) }] : []),
                ]} />
              )
            }} />
            <Line type="monotone" dataKey="mid" name="Mid-market" stroke={MID_C} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            {hasCorp && <Line type="stepAfter" dataKey="corp" name="Corporate" stroke={CORP_C} strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} connectNulls={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <WidgetStatRow
        stats={[
          { label: 'Mid-market', value: latest ? fmtRate(latest.mid) : '-' },
          { label: 'Corporate', value: corporate ? fmtRate(corporate.rate) : 'Not set', color: corporate ? undefined : '#94A3B8' },
          { label: 'Gap', value: gap != null ? fmtSignedPct(gap) : '-', color: varianceColor(gap) },
        ]}
        trailing={<div className="flex items-center gap-3"><ChartLegendDot color={MID_C} label="Mid-market" />{(hasCorp || isStd) && <ChartLegendDot color={CORP_C} label="Corporate" />}</div>}
        swapKey={code}
      />
    </>
  )
}

export function VarianceTrendBody({ points, label, corporate, lastDay }: BodyProps) {
  const chartH = useWidgetChartH()
  const size = useWidgetSize()
  const days = points.filter(p => p.corp != null).map(p => ({ date: p.date, v: variancePct(p.corp!, p.mid) ?? 0 }))
  const grain = grainFor(days.length)
  const data = bucketBy(days, grain).map(b => ({ date: b.date, v: +(b.items.reduce((s, x) => s + x.v, 0) / b.items.length).toFixed(2) }))
  const axis = useAxis(data)
  if (!days.length) {
    return (
      <>
        <Caption right={pendingNote(corporate, lastDay)}>{label}</Caption>
        <ChartEmpty icon={BarChart3} title="No corporate rate in this range" description={corporate ? `The corporate rate took effect on ${fmtDate(corporate.effectiveDate)}. Pick a range that reaches it.` : 'Set a corporate rate to see how far it sits from the market each day.'} />
      </>
    )
  }
  const avg = days.reduce((s, d) => s + d.v, 0) / days.length
  const widest = days.reduce((m, d) => (Math.abs(d.v) > Math.abs(m) ? d.v : m), 0)
  const beyond = days.filter(d => Math.abs(d.v) > 1).length
  return (
    <>
      <Caption right={pendingNote(corporate, lastDay)}>{label}{grain !== 'day' ? ` · ${grain === 'week' ? 'weekly' : 'monthly'} averages` : ''}</Caption>
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="date" {...AXIS_PROPS} tickFormatter={axis.tickFormatter} interval={axis.interval} />
            <YAxis {...AXIS_PROPS} width={44} tickFormatter={(v: number) => `${v}%`} />
            <ReferenceLine {...ZERO_LINE_PROPS} />
            <ReferenceLine y={1} stroke="#94A3B8" strokeDasharray="2 4" />
            <ReferenceLine y={-1} stroke="#94A3B8" strokeDasharray="2 4" />
            <ReferenceLine y={3} stroke="#DC2626" strokeDasharray="2 4" strokeOpacity={0.6} />
            <ReferenceLine y={-3} stroke="#DC2626" strokeDasharray="2 4" strokeOpacity={0.6} />
            <RTooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload as { date: string; v: number } | undefined
              if (!p) return null
              return <ChartTooltipCard title={fmtDate(p.date)} rows={[{ label: grain === 'day' ? 'Variance' : 'Average variance', value: fmtSignedPct(p.v) }]} />
            }} />
            <Bar dataKey="v" radius={[4, 4, 4, 4]} maxBarSize={widgetBarSize(size, 32)}>
              {data.map((d, i) => <Cell key={i} fill={varianceColor(d.v)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <WidgetStatRow stats={[
        { label: 'Average', value: fmtSignedPct(avg), color: varianceColor(avg) },
        { label: 'Widest', value: fmtSignedPct(widest), color: varianceColor(widest) },
        { label: 'Days beyond ±1%', value: fmtNumber(beyond) },
      ]} />
    </>
  )
}

export function DailyChangeBody({ code, points, label }: BodyProps) {
  const chartH = useWidgetChartH()
  const all = useMemo(() => points.slice(1).map((p, i) => ({ date: p.date, change: +(((p.mid - points[i].mid) / points[i].mid) * 100).toFixed(3) })), [points])
  const data = useMemo(() => thin(all), [all])
  const axis = useAxis(data)
  if (all.length < 1) return <><Caption>{label}</Caption><ChartEmpty icon={Activity} title="Not enough history" description="Pick a range of two days or more to see the daily moves." /></>
  const up = all.filter(d => d.change > 0).length
  const down = all.filter(d => d.change < 0).length
  const biggest = all.reduce((m, d) => (Math.abs(d.change) > Math.abs(m) ? d.change : m), 0)
  const id = `fxDaily-${code}`
  return (
    <>
      <Caption>{label}</Caption>
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={CHART_MARGIN}>
            {areaGradient(id, '#7C3AED')}
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="date" {...AXIS_PROPS} tickFormatter={axis.tickFormatter} interval={axis.interval} />
            <YAxis {...AXIS_PROPS} width={44} tickFormatter={(v: number) => `${v}%`} />
            <ReferenceLine {...ZERO_LINE_PROPS} />
            <RTooltip contentStyle={CM_TT_STYLE} labelFormatter={(l: string) => fmtDate(l)} formatter={(v: number) => [fmtSignedPct(v, 3), 'Daily change']} />
            <Area type="monotone" dataKey="change" stroke="#7C3AED" strokeWidth={2} fill={`url(#${id})`} dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <WidgetStatRow stats={[
        { label: 'Up days', value: fmtNumber(up), color: '#059669' },
        { label: 'Down days', value: fmtNumber(down), color: '#DC2626' },
        { label: 'Biggest move', value: fmtSignedPct(biggest, 3) },
      ]} />
    </>
  )
}

export function CumulativeReturnBody({ code, points, label }: BodyProps) {
  const chartH = useWidgetChartH()
  const first = points[0]?.mid ?? 1
  const all = useMemo(() => points.map(p => ({ date: p.date, ret: +(((p.mid - first) / first) * 100).toFixed(3) })), [points, first])
  const data = useMemo(() => thin(all), [all])
  const axis = useAxis(data)
  const end = all[all.length - 1]?.ret ?? 0
  const color = end >= 0 ? '#059669' : '#DC2626'
  const id = `fxCum-${code}`
  return (
    <>
      <Caption>{label}</Caption>
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={CHART_MARGIN}>
            {areaGradient(id, color)}
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="date" {...AXIS_PROPS} tickFormatter={axis.tickFormatter} interval={axis.interval} />
            <YAxis {...AXIS_PROPS} width={44} tickFormatter={(v: number) => `${v}%`} />
            <ReferenceLine {...ZERO_LINE_PROPS} />
            <RTooltip contentStyle={CM_TT_STYLE} labelFormatter={(l: string) => fmtDate(l)} formatter={(v: number) => [fmtSignedPct(v, 3), 'Cumulative return']} />
            <Area type="monotone" dataKey="ret" stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <WidgetStatRow stats={[
        { label: 'Start', value: fmtRate(first) },
        { label: 'End', value: points.length ? fmtRate(points[points.length - 1].mid) : '-' },
        { label: 'Return', value: fmtSignedPct(end), color },
      ]} />
    </>
  )
}

export function ConversionTrendBody({ code, points, label, isStd, corporate, avg30 }: BodyProps) {
  const chartH = useWidgetChartH()
  const [amount, setAmount] = useState('1000')
  const amt = Number(amount) > 0 ? Number(amount) : 0
  const data = useMemo(() => thin(points).map(p => ({ date: p.date, mid: +(amt * p.mid).toFixed(2), corp: p.corp != null ? +(amt * p.corp).toFixed(2) : null })), [points, amt])
  const axis = useAxis(data)
  const showCorp = isStd && data.some(d => d.corp != null)
  const latest = points[points.length - 1]
  const currentRate = isStd && corporate ? corporate.rate : latest?.mid ?? 0
  const money = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${BASE}`
  const id = `fxConv-${code}`
  return (
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap pb-2">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground" onMouseDown={e => e.stopPropagation()}>
          Amount
          <input
            type="number"
            min="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            aria-label={`Amount in ${code}`}
            className="w-[96px] h-7 px-2 rounded-md border border-border bg-white text-11 text-fg tabular-nums hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-colors"
          />
          <span className="text-fg-subtle">{code}</span>
        </label>
      </div>
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={CHART_MARGIN}>
            {areaGradient(id, MID_C)}
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="date" {...AXIS_PROPS} tickFormatter={axis.tickFormatter} interval={axis.interval} />
            <YAxis {...AXIS_PROPS} width={56} domain={['auto', 'auto']} tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0))} />
            <RTooltip contentStyle={CM_TT_STYLE} labelFormatter={(l: string) => fmtDate(l)}
              formatter={(v: number, name: string) => [money(v), name === 'corp' ? 'At corporate rate' : 'At mid-market rate']} />
            <Area type="monotone" dataKey="mid" stroke={MID_C} strokeWidth={2} fill={`url(#${id})`} dot={false} activeDot={{ r: 4 }} />
            {showCorp && <Area type="stepAfter" dataKey="corp" stroke={CORP_C} strokeWidth={2} strokeDasharray="4 4" fill="none" dot={false} activeDot={{ r: 4 }} connectNulls={false} />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <WidgetStatRow
        stats={[
          { label: 'Current', value: money(amt * currentRate), color: '#059669' },
          { label: '30d avg', value: money(amt * avg30) },
          { label: 'Range high', value: points.length ? money(amt * Math.max(...points.map(p => p.mid))) : '-' },
        ]}
        trailing={showCorp ? <div className="flex items-center gap-3"><ChartLegendDot color={MID_C} label="Mid-market" /><ChartLegendDot color={CORP_C} label="Corporate" /></div> : undefined}
      />
    </>
  )
}

export function DrawdownBody({ code, points, label }: BodyProps) {
  const chartH = useWidgetChartH()
  const all = useMemo(() => {
    let peak = 0
    return points.map(p => { peak = Math.max(peak, p.mid); return { date: p.date, dd: peak > 0 ? +((-(peak - p.mid) / peak) * 100).toFixed(3) : 0, peak } })
  }, [points])
  const data = useMemo(() => thin(all), [all])
  const axis = useAxis(data)
  const worst = all.reduce((m, d) => Math.min(m, d.dd), 0)
  const now = all[all.length - 1]
  const id = `fxDd-${code}`
  return (
    <>
      <Caption>{label}</Caption>
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={CHART_MARGIN}>
            {areaGradient(id, '#DC2626')}
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="date" {...AXIS_PROPS} tickFormatter={axis.tickFormatter} interval={axis.interval} />
            <YAxis {...AXIS_PROPS} width={44} domain={['auto', 0]} tickFormatter={(v: number) => `${v}%`} />
            <RTooltip contentStyle={CM_TT_STYLE} labelFormatter={(l: string) => fmtDate(l)} formatter={(v: number) => [`${v.toFixed(3)}%`, 'From peak']} />
            <Area type="monotone" dataKey="dd" stroke="#DC2626" strokeWidth={2} fill={`url(#${id})`} dot={false} activeDot={{ r: 4 }} baseValue={0} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <WidgetStatRow stats={[
        { label: 'Deepest', value: `${worst.toFixed(2)}%`, color: worst < 0 ? '#DC2626' : undefined },
        { label: 'Now', value: now ? `${now.dd.toFixed(2)}%` : '-' },
        { label: 'Peak', value: now ? fmtRate(now.peak) : '-' },
      ]} />
    </>
  )
}

export function TransactionVolumeBody({ code, points, label }: BodyProps) {
  const chartH = useWidgetChartH()
  const size = useWidgetSize()
  const days = useMemo(() => points.map(p => ({ date: p.date, n: transactionsOn(code, p.date) })), [points, code])
  const grain = grainFor(days.length)
  const data = useMemo(() => bucketBy(days, grain).map(b => ({ date: b.date, n: b.items.reduce((s, x) => s + x.n, 0) })), [days, grain])
  const axis = useAxis(data)
  const total = days.reduce((s, d) => s + d.n, 0)
  const busiest = days.reduce((m, d) => (d.n > m.n ? d : m), days[0] ?? { date: '', n: 0 })
  return (
    <>
      <Caption>{label}{grain !== 'day' ? ` · ${grain === 'week' ? 'weekly' : 'monthly'} totals` : ''}</Caption>
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="date" {...AXIS_PROPS} tickFormatter={axis.tickFormatter} interval={axis.interval} />
            <YAxis {...AXIS_PROPS} width={36} allowDecimals={false} />
            <RTooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} contentStyle={CM_TT_STYLE} labelFormatter={(l: string) => fmtDate(l)} formatter={(v: number) => [fmtNumber(v), 'Transactions']} />
            <Bar dataKey="n" fill={MID_C} radius={[4, 4, 0, 0]} maxBarSize={widgetBarSize(size, 32)} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <WidgetStatRow stats={[
        { label: 'Transactions', value: fmtNumber(total) },
        { label: 'Daily average', value: days.length ? (total / days.length).toFixed(1) : '-' },
        { label: 'Busiest day', value: busiest.date ? `${fmtNumber(busiest.n)} · ${fmtDate(busiest.date)}` : '-' },
      ]} />
    </>
  )
}

export function renderPairWidget(key: string, props: BodyProps) {
  switch (key) {
    case 'rate_over_time': return <RateOverTimeBody {...props} />
    case 'variance_trend': return <VarianceTrendBody {...props} />
    case 'daily_change': return <DailyChangeBody {...props} />
    case 'cumulative_return': return <CumulativeReturnBody {...props} />
    case 'conversion_trend': return <ConversionTrendBody {...props} />
    case 'drawdown_from_peak': return <DrawdownBody {...props} />
    case 'transaction_volume': return <TransactionVolumeBody {...props} />
    default: return null
  }
}
