// Pair detail: the KPI and chart catalogues (the currency app's own, in CoA's
// DetailKpiDef / DetailWidgetDef shapes) and the chart widget bodies, drawn with
// CoA's Recharts recipe (chartKit) inside WidgetContentCard.
import { useMemo, useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts'
import { Activity, BarChart3, Banknote, TrendingUp } from 'lucide-react'
import type { DetailKpiDef, DetailWidgetDef } from '../../coa/components/DetailInsights'
import { useWidgetChartH, useWidgetSize, widgetBarSize } from '../../coa/components/DetailInsights'
import { AXIS_PROPS, CHART_MARGIN, CM_TT_STYLE, ChartEmpty, ChartTooltipCard, GRID_PROPS, ZERO_LINE_PROPS, areaGradient, tickInterval } from '../../coa/components/chartKit'
import { ChartLegendDot } from '../../coa/components/ChartWidgetCard'
import { fmtDate, fmtNumber } from '../../coa/lib/utils'
import { BASE, fmtRate, fmtSignedPct, variancePct } from './rateModel'
import { bucketBy, grainFor, rateTick, thin, tickLabelFor, transactionsOn, type PairPoint } from './pairData'

/* ── Catalogues ─────────────────────────────────────────────────────────── */

/** The KPI catalogue; descriptions name the pair's currency (`code`) against the base. */
export const pairKpis = (code: string): DetailKpiDef[] => [
  { key: 'current_mid', label: 'Current Mid-Market Rate', category: 'Rates', description: `The latest market rate. Example: 280.0000 means 1 ${code} = 280 ${BASE}.` },
  { key: 'current_std', label: 'Current Corporate Rate', category: 'Rates', description: 'The corporate rate in effect for this pair.' },
  { key: 'range_change', label: 'Mid-Market Change', category: 'Performance', description: 'How much the rate moved in the selected period. Example: 275 to 280 is +1.82%.' },
  { key: 'range_volatility', label: 'Mid-Market Volatility', category: 'Analytics', description: 'How much the rate usually moves in a day. Low means steady, high means big swings.' },
  { key: 'variance', label: 'Corporate Variance', category: 'Rates', description: 'How far the corporate rate sits from the current mid-market rate.' },
  { key: 'days_since_update', label: 'Days Since Rate Updated', category: 'Operational', description: 'Days since the corporate rate in effect took effect.' },
  // Keyed fx_exposure_30d still, so layouts readers saved keep the tile.
  { key: 'fx_exposure_30d', label: 'FX Exposure', category: 'Operational', description: 'The value of open transactions in this currency, converted at today’s mid-market rate.' },
]

export const MID_KPI_KEYS = ['current_mid', 'range_change', 'range_volatility', 'fx_exposure_30d']
export const STD_KPI_KEYS = ['current_std', 'variance', 'days_since_update', 'fx_exposure_30d']
export const DEFAULT_MID_KPIS = ['current_mid', 'range_change', 'range_volatility', 'fx_exposure_30d']
export const DEFAULT_STD_KPIS = ['current_std', 'variance', 'days_since_update', 'fx_exposure_30d']

const GREEN = { iconBg: '#ECFDF5', iconColor: '#059669' }
const VIOLET = { iconBg: '#F5F3FF', iconColor: '#7C3AED' }

/** The chart catalogue; titles differ by rate type, as they did. */
export function pairWidgets(isStd: boolean, code: string): DetailWidgetDef[] {
  return [
    {
      key: 'rate_over_time', category: 'Charts', icon: TrendingUp, previewType: 'line',
      label: isStd ? 'Corporate Rate over Time' : 'Rate over Time',
      description: 'The daily rate over the selected period. If a corporate rate is set, it shows as a second line.',
    },
    {
      key: 'daily_change', category: 'Charts', icon: Activity, previewType: 'area', ...VIOLET,
      label: 'Daily % Change',
      description: 'How much the rate moved each day compared with the day before.',
    },
    {
      key: 'cumulative_return', category: 'Charts', icon: TrendingUp, previewType: 'area', ...GREEN,
      label: 'Cumulative Return',
      description: 'How far the rate has moved since the start of the selected period.',
    },
    {
      key: 'conversion_trend', category: 'Charts', icon: Banknote, previewType: 'area',
      label: isStd ? 'Corporate Conversion Trend' : 'Conversion Trend',
      description: `What a fixed ${code} amount was worth in ${BASE} each day.`,
    },
    {
      key: 'transaction_volume', category: 'Charts', icon: BarChart3, previewType: 'bar',
      label: isStd ? 'Corporate Transactions' : 'Transaction Volume',
      description: 'Bar chart of daily transaction count priced using this corporate rate.',
    },
  ]
}
export const MID_WIDGET_KEYS = ['rate_over_time', 'daily_change', 'cumulative_return', 'conversion_trend']
export const STD_WIDGET_KEYS = ['rate_over_time', 'transaction_volume', 'conversion_trend']
export const DEFAULT_MID_WIDGETS = ['rate_over_time', 'daily_change']
export const DEFAULT_STD_WIDGETS = ['rate_over_time']

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
}

/** The key under a two-line chart: which line is the market and which is the corporate rate. */
function RateLegend() {
  return (
    <div className="flex items-center justify-end gap-3 mt-2">
      <ChartLegendDot color={MID_C} label="Mid-Market" />
      <ChartLegendDot color={CORP_C} label="Corporate" />
    </div>
  )
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

export function RateOverTimeBody({ points, label, isStd, corporate, lastDay }: BodyProps) {
  const chartH = useWidgetChartH()
  const data = useMemo(() => thin(points), [points])
  const axis = useAxis(data)
  const hasCorp = data.some(p => p.corp != null)
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
                  { label: 'Mid-Market', value: `${fmtRate(p.mid)} ${BASE}` },
                  { label: 'Corporate', value: p.corp != null ? `${fmtRate(p.corp)} ${BASE}` : 'Not Set' },
                  ...(v != null ? [{ label: 'Gap', value: fmtSignedPct(v) }] : []),
                ]} />
              )
            }} />
            <Line type="monotone" dataKey="mid" name="Mid-Market" stroke={MID_C} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            {hasCorp && <Line type="stepAfter" dataKey="corp" name="Corporate" stroke={CORP_C} strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} connectNulls={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {(hasCorp || isStd) && <RateLegend />}
    </>
  )
}

export function DailyChangeBody({ code, points, label }: BodyProps) {
  const chartH = useWidgetChartH()
  const all = useMemo(() => points.slice(1).map((p, i) => ({ date: p.date, change: +(((p.mid - points[i].mid) / points[i].mid) * 100).toFixed(3) })), [points])
  const data = useMemo(() => thin(all), [all])
  const axis = useAxis(data)
  if (all.length < 1) return <><Caption>{label}</Caption><ChartEmpty icon={Activity} title="Not enough history" description="Pick a range of two days or more to see the daily moves." /></>
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
            <RTooltip contentStyle={CM_TT_STYLE} labelFormatter={(l: string) => fmtDate(l)} formatter={(v: number) => [fmtSignedPct(v, 3), 'Daily Change']} />
            <Area type="monotone" dataKey="change" stroke="#7C3AED" strokeWidth={2} fill={`url(#${id})`} dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
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
            <RTooltip contentStyle={CM_TT_STYLE} labelFormatter={(l: string) => fmtDate(l)} formatter={(v: number) => [fmtSignedPct(v, 3), 'Cumulative Return']} />
            <Area type="monotone" dataKey="ret" stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

export function ConversionTrendBody({ code, points, label, isStd }: BodyProps) {
  const chartH = useWidgetChartH()
  const [amount, setAmount] = useState('1000')
  const amt = Number(amount) > 0 ? Number(amount) : 0
  const data = useMemo(() => thin(points).map(p => ({ date: p.date, mid: +(amt * p.mid).toFixed(2), corp: p.corp != null ? +(amt * p.corp).toFixed(2) : null })), [points, amt])
  const axis = useAxis(data)
  const showCorp = isStd && data.some(d => d.corp != null)
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
              formatter={(v: number, name: string) => [money(v), name === 'corp' ? 'At Corporate Rate' : 'At Mid-Market Rate']} />
            <Area type="monotone" dataKey="mid" stroke={MID_C} strokeWidth={2} fill={`url(#${id})`} dot={false} activeDot={{ r: 4 }} />
            {showCorp && <Area type="stepAfter" dataKey="corp" stroke={CORP_C} strokeWidth={2} strokeDasharray="4 4" fill="none" dot={false} activeDot={{ r: 4 }} connectNulls={false} />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {showCorp && <RateLegend />}
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
    </>
  )
}

export function renderPairWidget(key: string, props: BodyProps) {
  switch (key) {
    case 'rate_over_time': return <RateOverTimeBody {...props} />
    case 'daily_change': return <DailyChangeBody {...props} />
    case 'cumulative_return': return <CumulativeReturnBody {...props} />
    case 'conversion_trend': return <ConversionTrendBody {...props} />
    case 'transaction_volume': return <TransactionVolumeBody {...props} />
    default: return null
  }
}
