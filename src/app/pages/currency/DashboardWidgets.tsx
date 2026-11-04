// The currency dashboard's insight catalogue (KPI tiles and widgets) and the two
// chart widget bodies, in CoA's widget recipe (useWidgetChartH, RangeHeader,
// WidgetStatRow, chartKit axes / grid / tooltip).
import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeftRight, BarChart3, TrendingUp, Wallet } from 'lucide-react'
import { CHART_PALETTE, WidgetStatRow, useWidgetChartH, useWidgetSize, widgetBarSize, type DetailKpiDef, type DetailWidgetDef } from '../../coa/components/DetailInsights'
import { RangeHeader, type RangeValue } from '../../coa/components/PeriodBar'
import { AXIS_PROPS, CHART_MARGIN, CM_TT_STYLE, ChartEmpty, GRID_PROPS, SERIES, areaGradient, isoLabel, tickInterval, windowSeries, windowSeriesBetween } from '../../coa/components/chartKit'
import { LAST_SYNC } from '../../data/exchangeRates'
import { BASE, DOC_TYPES, money, type LinkedDoc } from './model'

export const CURRENCY_KPIS: DetailKpiDef[] = [
  { key: 'mid', label: 'Mid-market rate', description: 'One unit of this currency in the base currency, at the provider\'s mid-market rate.', category: 'Rates' },
  { key: 'corporate', label: 'Corporate rate', description: 'The fixed rate your team set for this currency against the base currency.', category: 'Rates' },
  { key: 'change', label: 'Change (24h)', description: 'How far the mid-market rate moved over the last 24 hours.', category: 'Rates' },
  { key: 'open', label: 'Open documents', description: 'Open invoices and orders in this currency. Each one keeps it from being deactivated.', category: 'Usage' },
  { key: 'value', label: 'Total linked value', description: 'The sum of every active document booked in this currency, in its own units.', category: 'Usage' },
  { key: 'last', label: 'Last transaction', description: 'The most recent document in this currency.', category: 'Usage' },
  { key: 'inverse', label: 'Inverse rate', description: 'How much one unit of the base currency buys in this currency.', category: 'Rates' },
  { key: 'variance', label: 'Corporate variance', description: 'How far the corporate rate sits from the current mid-market rate.', category: 'Rates' },
  { key: 'lifetime', label: 'Documents in 12 months', description: 'Every document booked in this currency over the past 12 months.', category: 'Usage' },
]
export const CURRENCY_KPI_DEFAULT = ['mid', 'corporate', 'change', 'open', 'value', 'last']

export const CURRENCY_WIDGETS: DetailWidgetDef[] = [
  { key: 'converter', label: 'Live exchange rate converter', description: 'Convert between this currency and any other active currency, at the mid-market or the corporate rate.', category: 'Tools', icon: ArrowLeftRight, previewType: 'list' },
  { key: 'trend', label: 'Rate trend', description: 'The mid-market rate against the base currency over time, with the corporate rate marked when one is set.', category: 'Charts', icon: TrendingUp, iconBg: '#ECFDF5', iconColor: '#059669', previewType: 'area' },
  { key: 'docs', label: 'Linked documents by type', description: 'Open documents in this currency, by document type.', category: 'Charts', icon: BarChart3, previewType: 'bar' },
]
export const CURRENCY_WIDGET_DEFAULT = ['converter', 'trend', 'docs']

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
const pad = (n: number) => String(n).padStart(2, '0')

/** A deterministic daily series of the mid-market rate, landing on today's rate at the last sync. */
export function rateSeries(code: string, rate: number, days = 400): { date: string; rate: number }[] {
  const end = new Date(`${LAST_SYNC.slice(0, 10)}T00:00:00`)
  let h = hash(code)
  let v = rate * (0.92 + (h % 80) / 1000)
  const out: { date: string; rate: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1103515245) >>> 0
    v *= 1 + ((h % 1000) / 1000 - 0.48) * 0.006
    const d = new Date(end)
    d.setDate(d.getDate() - i)
    out.push({ date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, rate: v })
  }
  const k = rate / out[out.length - 1].rate
  return out.map(p => ({ ...p, rate: p.rate * k }))
}

const TREND_RANGES = [{ key: '7', label: '7d' }, { key: '30', label: '30d' }, { key: '90', label: '90d' }, { key: '365', label: '1y' }]
const TREND_LONG: Record<string, string> = { '7': 'Last 7 days', '30': 'Last 30 days', '90': 'Last 90 days', '365': 'Last 12 months' }

export function RateTrendBody({ code, rate, corporate }: { code: string; rate: number | null; corporate: number | null }) {
  const chartH = useWidgetChartH()
  const [range, setRange] = useState<RangeValue>({ kind: 'preset', key: '30' })
  const series = useMemo(() => (rate ? rateSeries(code, rate) : []), [code, rate])
  if (code === BASE) return <ChartEmpty icon={TrendingUp} title={`${BASE} is your base currency`} description="Every exchange rate is quoted against it, so it has no rate of its own to chart." />
  if (!rate || series.length < 2) return <ChartEmpty icon={TrendingUp} title="No rate history" description="Synced rates will chart here once there are two or more." />
  const data = range.kind === 'preset' ? windowSeries(series, Number(range.key)) : windowSeriesBetween(series, range.from, range.to)
  const first = data[0].rate, last = data[data.length - 1].rate
  const change = ((last - first) / first) * 100
  const id = `cur-trend-${code}`
  const dp = rate < 1 ? 6 : 4
  return (
    <>
      <RangeHeader value={range} onChange={setRange} options={TREND_RANGES} longLabels={TREND_LONG} />
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={CHART_MARGIN}>
            {areaGradient(id, SERIES.blue)}
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="date" tickFormatter={isoLabel} {...AXIS_PROPS} interval={tickInterval(data.length)} />
            <YAxis tickFormatter={(v: number) => v.toFixed(rate < 1 ? 4 : 2)} {...AXIS_PROPS} width={54} domain={['auto', 'auto']} />
            <RTooltip contentStyle={CM_TT_STYLE} labelFormatter={(l: string) => isoLabel(l)} formatter={(v: number) => [`${v.toFixed(dp)} ${BASE}`, 'Mid-market']} />
            {corporate != null && <ReferenceLine y={corporate} stroke={SERIES.amber} strokeDasharray="4 4" ifOverflow="extendDomain" label={{ value: 'Corporate', position: 'insideTopRight', fontSize: 10, fill: '#B45309' }} />}
            <Area type="monotone" dataKey="rate" stroke={SERIES.blue} strokeWidth={2} fill={`url(#${id})`} dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <WidgetStatRow stats={[
        { label: 'Open', value: first.toFixed(dp) },
        { label: 'Latest', value: last.toFixed(dp) },
        { label: 'Change', value: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`, color: change >= 0 ? '#059669' : '#DC2626' },
        { label: 'High', value: Math.max(...data.map(p => p.rate)).toFixed(dp) },
      ]} />
    </>
  )
}

export function LinkedDocsBody({ docs, symbol, decimals }: { docs: LinkedDoc[]; symbol: string; decimals: number }) {
  const chartH = useWidgetChartH()
  const size = useWidgetSize()
  if (!docs.length) return <ChartEmpty icon={Wallet} title="No open documents" description="Open documents in this currency will chart here by type." />
  // Payments chart only once a currency has any, so four bars are not crowded by two empty ones.
  const hasPayments = docs.some(d => d.type === 'vendorPayment' || d.type === 'customerPayment')
  const data = DOC_TYPES
    .filter(t => hasPayments || (t.key !== 'vendorPayment' && t.key !== 'customerPayment'))
    .map(t => ({ type: t.label, short: t.short, n: docs.filter(d => d.type === t.key).length }))
  const total = docs.reduce((s, d) => s + d.amount, 0)
  return (
    <>
      <p className="text-[11px] text-muted-foreground pb-2">Open documents</p>
      <div style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="short" {...AXIS_PROPS} interval={0} />
            <YAxis allowDecimals={false} {...AXIS_PROPS} width={30} />
            <RTooltip contentStyle={CM_TT_STYLE} cursor={{ fill: 'rgba(148,163,184,0.08)' }} labelFormatter={(_: string, p) => (p?.[0]?.payload as { type?: string } | undefined)?.type ?? ''} formatter={(v: number) => [v, 'Documents']} />
            <Bar dataKey="n" radius={[4, 4, 0, 0]} maxBarSize={widgetBarSize(size, 32)}>
              {data.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <WidgetStatRow stats={[
        { label: 'Documents', value: docs.length.toLocaleString('en-US') },
        { label: 'Types', value: data.filter(d => d.n).length },
        { label: 'Total value', value: money(symbol, total, decimals) },
      ]} />
    </>
  )
}
