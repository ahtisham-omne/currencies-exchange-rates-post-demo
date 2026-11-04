import { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { ResponsiveContainer } from 'recharts'
import { Tooltip } from './ui'

// Ported from Partner Management - Vendors' dashboard widget chrome
// (VendorDetailsPage ContentCard + chartBox + statRow + ttStyle): the chart
// widget card with an accent icon tile, 13px/600 title, info tooltip,
// border-b border-muted header, and a stat-row footer (10px slate-400 labels
// over 13px/700 values) separated by a hairline. Use for every dashboard
// chart so account pages read like sibling boards of the Partner detail.

export function ChartWidgetCard({ title, icon: Icon, tooltip, headerExtras, action, children }: {
  title: string
  icon?: React.ElementType
  tooltip?: string
  /* Inline node rendered after the title (e.g. a range-pill strip). */
  headerExtras?: ReactNode
  /* Right-aligned header controls. */
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="group/widget rounded-xl border border-border bg-white overflow-hidden h-full flex flex-col transition-[box-shadow,border-color] duration-300 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-muted flex items-center justify-between shrink-0 select-none gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-primary" />
            </div>
          )}
          <span className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{title}</span>
          {tooltip && (
            <Tooltip content={tooltip} side="bottom">
              <button type="button" className="inline-flex shrink-0" tabIndex={-1}>
                <Info className="w-3 h-3 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors" />
              </button>
            </Tooltip>
          )}
          {headerExtras && <span className="ml-2 flex items-center min-w-0">{headerExtras}</span>}
        </div>
        {/* Header controls slide in on card hover, like the Partner widget's
            Small / Medium / Large size toggle. */}
        {action && (
          <div className="flex items-center gap-2 shrink-0 transition-all duration-200 ease-out opacity-0 translate-x-2 pointer-events-none group-hover/widget:opacity-100 group-hover/widget:translate-x-0 group-hover/widget:pointer-events-auto">
            {action}
          </div>
        )}
      </div>
      {/* Body */}
      <div className="p-4 flex-1 flex flex-col">{children}</div>
    </div>
  )
}

/* ── Shared chart canvas: fixed height, hugs the card's left edge ── */
export function ChartBox({ height, children }: { height: number; children: ReactNode }) {
  return (
    <div style={{ height }} className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">{children as any}</ResponsiveContainer>
    </div>
  )
}

/* ── Footer stat row: labels over bold values, optional trailing node ── */
export function ChartStatRow({ stats, trailing }: {
  stats: { label: string; value: string; color?: string }[]
  trailing?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 mt-3 pt-3 border-t border-muted">
      <div className="flex items-start flex-wrap gap-x-6 gap-y-2 min-w-0">
        {stats.map((s, i) => (
          <div key={i}>
            <p className="text-[10.5px] text-slate-400" style={{ fontWeight: 500 }}>{s.label}</p>
            <p className="text-[13px] tabular-nums" style={{ fontWeight: 700, color: s.color || '#334155' }}>{s.value}</p>
          </div>
        ))}
      </div>
      {trailing && <div className="shrink-0 pb-px">{trailing}</div>}
    </div>
  )
}

/* ── Legend dot (used in stat-row trailing slots) ── */
export function ChartLegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[10.5px] text-slate-500" style={{ fontWeight: 500 }}>{label}</span>
    </div>
  )
}

/* ── Recharts tooltip + palette tokens, same as the Partner dashboard ── */
export const CHART_TT_STYLE = { borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }
export const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--violet))', 'hsl(var(--success))', '#94A3B8']
