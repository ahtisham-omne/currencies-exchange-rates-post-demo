// Ported from chart-of-accounts-v2.1/src/pages/AccountDetail.tsx (isoLabel, fmtCompactMoney, CM_TT_STYLE, ChartEmpty, windowSeriesByPeriod, the Recharts props every widget body repeats 1274-1834); adapted: exported as a kit, money formatter takes any symbol, series windowing reads a generic { date } series.
import type { ElementType } from 'react'

// Axis label for an ISO date, CM-style ("Jul 24").
const MONTHS_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const isoLabel = (iso: string) => `${MONTHS_S[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}`

// Compact figure for chart ticks (CM fmtCompact: $1.2M / $3.4K / $12).
export function fmtCompactMoney(n: number, symbol = '$') {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(1)}K`
  return `${sign}${symbol}${abs.toFixed(0)}`
}

// CM Recharts tooltip chrome.
export const CM_TT_STYLE = { fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' } as const

/* The props every CoA widget chart repeats, so a body cannot drift from them. */
export const CHART_MARGIN = { top: 5, right: 8, left: 0, bottom: 5 }
export const AXIS_TICK = { fontSize: 10, fill: '#94A3B8' }
export const AXIS_PROPS = { tick: AXIS_TICK, axisLine: false, tickLine: false } as const
export const GRID_PROPS = { strokeDasharray: '3 3', stroke: '#E2E8F0', vertical: false } as const
export const ZERO_LINE_PROPS = { y: 0, stroke: '#94A3B8', strokeDasharray: '2 4' } as const
/** Series colours: violet running, blue primary, green positive / FX, amber credits, red negative, flat. */
export const SERIES = { violet: '#7C3AED', blue: '#0A77FF', green: '#059669', amber: '#F59E0B', red: '#DC2626', flat: '#CBD5E1' }
/** Thin an axis to about eight labels. */
export const tickInterval = (n: number) => Math.max(0, Math.ceil(n / 8) - 1)

/** An area's fill: the series colour at 28% fading to nothing. Ids must be unique
 *  per widget. Call it, don't mount it: Recharts keeps only raw <defs> children, so
 *  `<AreaChart>{areaGradient(id, color)} ... <Area fill={'url(#' + id + ')'} /></AreaChart>`. */
export function areaGradient(id: string, color: string) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={0.28} />
        <stop offset="100%" stopColor={color} stopOpacity={0} />
      </linearGradient>
    </defs>
  )
}

// Rich empty state for the chart widgets - an accent icon tile, a bold title,
// and a muted description. Fills the card body so the chrome stays consistent.
export function ChartEmpty({ icon: Icon, title, description }: { icon: ElementType; title: string; description: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8">
      <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h4 className="text-sm font-semibold text-fg">{title}</h4>
      <p className="mt-1 text-xs text-fg-subtle max-w-[260px] leading-relaxed">{description}</p>
    </div>
  )
}

/** A multi-line tooltip body (NetChangeTooltip's recipe), for Recharts `content`. */
export function ChartTooltipCard({ title, rows, footnote }: { title: string; rows: { label: string; value: string }[]; footnote?: string }) {
  return (
    <div className="rounded-lg border border-border bg-white shadow-md px-3 py-2.5 text-[12px]">
      <p className="text-fg" style={{ fontWeight: 600 }}>{title}</p>
      <div className="mt-1.5 space-y-1">
        {rows.map(r => (
          <div key={r.label} className="flex items-baseline justify-between gap-6">
            <span className="text-fg-muted">{r.label}</span>
            <span className="tabular-nums" style={{ fontWeight: 500 }}>{r.value}</span>
          </div>
        ))}
      </div>
      {footnote && <p className="mt-2 pt-2 border-t border-border text-[11px] text-fg-subtle">{footnote}</p>}
    </div>
  )
}

/** The last `days` of a dated series, anchored on its latest point (not today), never under two points. */
export function windowSeries<P extends { date: string }>(series: P[], days: number | 'all'): P[] {
  if (series.length < 2 || days === 'all') return series
  const last = +new Date(series[series.length - 1].date)
  const w = series.filter(p => +new Date(p.date) >= last - days * 86400000)
  return w.length > 1 ? w : series.slice(-2)
}
/** A custom range of a dated series (ISO days, inclusive), never under two points. */
export function windowSeriesBetween<P extends { date: string }>(series: P[], from: string, to: string): P[] {
  const w = series.filter(p => p.date.slice(0, 10) >= from && p.date.slice(0, 10) <= to)
  return w.length > 1 ? w : series.slice(-2)
}
