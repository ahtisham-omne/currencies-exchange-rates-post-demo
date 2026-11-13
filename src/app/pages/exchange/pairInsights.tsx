// Pair detail: the KPI and chart catalogues (the currency app's own, in CoA's
// DetailKpiDef / DetailWidgetDef shapes) and the chart widget bodies, drawn with
// CoA's Recharts recipe (chartKit) inside WidgetContentCard.
import { useMemo, useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts'
import { Banknote, TrendingUp } from 'lucide-react'
import type { DetailKpiDef, DetailWidgetDef } from '../../coa/components/DetailInsights'
import { useWidgetChartH, useWidgetSize, widgetBarSize } from '../../coa/components/DetailInsights'
import { AXIS_PROPS, CHART_MARGIN, CM_TT_STYLE, ChartEmpty, ChartTooltipCard, GRID_PROPS, ZERO_LINE_PROPS, areaGradient, tickInterval } from '../../coa/components/chartKit'
import { ChartLegendDot } from '../../coa/components/ChartWidgetCard'
import { fmtDate, fmtNumber } from '../../coa/lib/utils'
import { RATE_TOOLTIPS } from '../../utils/rateCopy'
import { BASE, decimalsOf, fmtPairRate, fmtRate, symbolOf } from './rateModel'
import { money as fmtMoney } from '../currency/model'
import { rateTick, thin, tickLabelFor, type PairPoint } from './pairData'

/* ── Catalogues ─────────────────────────────────────────────────────────── */

/** The KPI catalogue. Descriptions say "this currency" and "your base currency", never the codes. */
export const pairKpis = (code: string, isStd = false): DetailKpiDef[] => [
  { key: 'current_mid', label: 'Current Mid-Market Rate', category: 'Rates', description: 'Current mid-market rate for 1 unit of this currency in your base currency.' },
  { key: 'current_std', label: 'Current Corporate Rate', category: 'Rates', description: 'The corporate rate set by your company for 1 unit of this currency in your base currency.' },
  { key: 'range_change', label: 'Mid-Market Change', category: 'Performance', description: 'How much the mid-market rate moved over the selected period.' },
  { key: 'range_volatility', label: 'Mid-Market Volatility', category: 'Analytics', description: 'Average daily movement of the mid-market rate over the selected period.' },
  { key: 'variance', label: 'Corporate Variance', category: 'Rates', description: RATE_TOOLTIPS.variance },
  { key: 'days_since_update', label: 'Days Since Rate Updated', category: 'Operational', description: 'Days since the corporate rate was last updated.' },
  // Keyed fx_exposure_30d still, so layouts readers saved keep the tile.
  { key: 'fx_exposure_30d', label: 'FX Exposure', category: 'Operational', description: 'The total value of transactions in this currency over the selected period, shown in your base currency.' },
]

export const MID_KPI_KEYS = ['current_mid', 'range_change', 'range_volatility', 'fx_exposure_30d']
export const STD_KPI_KEYS = ['current_std', 'variance', 'days_since_update', 'fx_exposure_30d']
export const DEFAULT_MID_KPIS = ['current_mid', 'range_change', 'range_volatility', 'fx_exposure_30d']
export const DEFAULT_STD_KPIS = ['current_std', 'variance', 'days_since_update', 'fx_exposure_30d']

/** The chart catalogue; titles differ by rate type, as they did. */
export function pairWidgets(isStd: boolean, code: string): DetailWidgetDef[] {
  return [
    {
      key: 'rate_over_time', category: 'Charts', icon: TrendingUp, previewType: 'line',
      label: isStd ? 'Corporate Rate over Time' : 'Rate over Time',
      description: isStd
        ? 'Daily mid-market rate over the selected period, shown with the corporate rate.'
        : 'Daily mid-market rate over the selected period, shown with the corporate rate when one is set.',
    },
    {
      key: 'conversion_trend', category: 'Charts', icon: Banknote, previewType: 'area',
      label: isStd ? 'Corporate Conversion Trend' : 'Conversion Trend',
      description: isStd
        ? 'What the entered amount in this currency was worth in your base currency each day, at the mid-market and corporate rates.'
        : 'What the entered amount in this currency was worth in your base currency each day.',
    },
  ]
}
export const MID_WIDGET_KEYS = ['rate_over_time', 'conversion_trend']
export const STD_WIDGET_KEYS = ['rate_over_time', 'conversion_trend']
// Both charts on both pages, side by side.
export const DEFAULT_MID_WIDGETS = ['rate_over_time', 'conversion_trend']
export const DEFAULT_STD_WIDGETS = ['rate_over_time', 'conversion_trend']

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

/* A corporate rate that took effect after the last daily sync isn't on the chart
   yet: the chart ends at the sync. Said in full, so it doesn't read as a delay. */
const pendingNote = (code: string, corporate: BodyProps['corporate'], lastDay: string) =>
  corporate && corporate.effectiveDate > lastDay
    ? <span className="text-[10.5px] text-[#94A3B8]">The new rate, {fmtPairRate(code, corporate.rate)}, took effect {fmtDate(corporate.effectiveDate)}. It shows on the chart after the next daily update.</span>
    : null

/** A signed amount of the base currency to a rate's four decimals: "+0.4800 PKR". */
const signedRate = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtRate(Math.abs(n))} ${BASE}`

/** The days a corporate rate was set inside the window. Each is drawn at the
 *  first charted day on or after it (a long range thins the series and may skip
 *  the day itself) but labelled with the day it was really set. */
function setDatesIn(points: PairPoint[], data: PairPoint[]): { x: string; date: string }[] {
  const set = points.filter((p, i) => i > 0 && p.corp != null && p.corp !== points[i - 1].corp).map(p => p.date)
  const out: { x: string; date: string }[] = []
  for (const date of set) {
    const x = data.find(p => p.date >= date)?.date
    if (x && !out.some(m => m.x === x)) out.push({ x, date })
  }
  return out
}

/* ── Bodies ─────────────────────────────────────────────────────────────── */

export function RateOverTimeBody({ code, points, label, isStd, corporate, lastDay }: BodyProps) {
  const chartH = useWidgetChartH()
  const data = useMemo(() => thin(points), [points])
  const axis = useAxis(data)
  const hasCorp = data.some(p => p.corp != null)
  // Each day a corporate rate was set in the window, marked on the chart.
  const setDates = useMemo(() => (hasCorp ? setDatesIn(points, data) : []), [hasCorp, points, data])
  return (
    <>
      <Caption right={pendingNote(code, corporate, lastDay)}>{label}</Caption>
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="date" {...AXIS_PROPS} tickFormatter={axis.tickFormatter} interval={axis.interval} />
            <YAxis {...AXIS_PROPS} width={66} domain={['auto', 'auto']} tickFormatter={rateTick} />
            <RTooltip content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload as PairPoint | undefined
              if (!p) return null
              // The gap as an amount of the base currency, not a percentage.
              const gap = p.corp != null ? p.corp - p.mid : null
              return (
                <ChartTooltipCard title={fmtDate(p.date)} rows={[
                  { label: 'Mid-Market', value: `${fmtRate(p.mid)} ${BASE}` },
                  { label: 'Corporate', value: p.corp != null ? `${fmtRate(p.corp)} ${BASE}` : 'Not Set' },
                  ...(gap != null ? [{ label: 'Gap', value: signedRate(gap) }] : []),
                  ...setDates.filter(m => m.x === p.date).map(m => ({ label: 'Rate Set', value: fmtDate(m.date) })),
                ]} />
              )
            }} />
            {setDates.map(m => (
              // The label reads away from the nearer edge, so one late in the window isn't cut off.
              <ReferenceLine key={m.x} x={m.x} stroke={CORP_C} strokeDasharray="3 3" strokeOpacity={0.9}
                label={{ value: `Rate set ${fmtDate(m.date).replace(/, \d{4}$/, '')}`, position: data.findIndex(p => p.date === m.x) > data.length / 2 ? 'insideTopRight' : 'insideTopLeft', fill: '#B45309', fontSize: 10, fontWeight: 600 }} />
            ))}
            <Line type="monotone" dataKey="mid" name="Mid-Market" stroke={MID_C} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            {hasCorp && <Line type="stepAfter" dataKey="corp" name="Corporate" stroke={CORP_C} strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} connectNulls={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {(hasCorp || isStd) && <RateLegend />}
    </>
  )
}

export function ConversionTrendBody({ code, points, label, isStd }: BodyProps) {
  const chartH = useWidgetChartH()
  const [amount, setAmount] = useState('1000')
  const amt = Number(amount) > 0 ? Number(amount) : 0
  // In the base currency's own decimals, for the plotted values and their labels alike.
  const baseDp = decimalsOf(BASE)
  const data = useMemo(() => thin(points).map(p => ({ date: p.date, mid: +(amt * p.mid).toFixed(baseDp), corp: p.corp != null ? +(amt * p.corp).toFixed(baseDp) : null })), [points, amt, baseDp])
  const axis = useAxis(data)
  const showCorp = isStd && data.some(d => d.corp != null)
  // Amounts carry the symbol, as everywhere in the module: ₨ 278,520.00.
  const money = (n: number) => fmtMoney(symbolOf(BASE), n, baseDp)
  const id = `fxConv-${code}`
  return (
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap pb-2">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground" onMouseDown={e => e.stopPropagation()}>
          Amount
          <span className="text-fg-subtle">{symbolOf(code)}</span>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            aria-label={`Amount in ${code}`}
            className="w-[96px] h-7 px-2 rounded-md border border-border bg-white text-11 text-fg tabular-nums hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-colors"
          />
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

export function renderPairWidget(key: string, props: BodyProps) {
  switch (key) {
    case 'rate_over_time': return <RateOverTimeBody {...props} />
    case 'conversion_trend': return <ConversionTrendBody {...props} />
    default: return null
  }
}
