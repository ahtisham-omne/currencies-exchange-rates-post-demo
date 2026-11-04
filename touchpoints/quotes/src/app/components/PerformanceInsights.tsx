// @ts-nocheck
/**
 * PerformanceInsights — Insight cards for Quotes listing
 * Pattern: Physical Inventory Web InsightKPICard (icon, label, value, hover remove, time range dropdown)
 * Drawer: Partner Management KpiInsightsPanel (2-col grid, category headers, toggle circles)
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  FileText, AlertTriangle, Send, DollarSign, BarChart3, Timer,
  X, Plus, Check, Clock, ChevronDown, Trash2, Search,
  ToggleLeft, ToggleRight, TrendingUp, Percent, Package,
} from 'lucide-react';

/* ── Metric definitions ── */
interface InsightMetric {
  key: string;
  label: string;
  category: string;
  icon: typeof FileText;
  value: string;
  subtitle?: string;
}

const ALL_METRICS: InsightMetric[] = [
  // Pipeline
  { key: 'total', label: 'Total Quotes', category: 'Pipeline', icon: FileText, value: '750', subtitle: 'All quotes in system' },
  { key: 'awaiting', label: 'Awaiting Response', category: 'Pipeline', icon: Send, value: '200', subtitle: 'Sent, pending confirmation' },
  { key: 'expiring', label: 'Expiring Soon', category: 'Pipeline', icon: AlertTriangle, value: '18', subtitle: 'Within 7 days' },
  // Financial
  { key: 'value', label: 'Pipeline Value', category: 'Financial', icon: DollarSign, value: '$3.2M', subtitle: 'Active quotes total' },
  { key: 'avg_deal', label: 'Avg Deal Size', category: 'Financial', icon: TrendingUp, value: '$42K', subtitle: 'Per quote average' },
  // Performance
  { key: 'conversion', label: 'Conversion Rate', category: 'Performance', icon: BarChart3, value: '34%', subtitle: 'Quotes → SO' },
  { key: 'avg_cycle', label: 'Avg. Cycle Time', category: 'Performance', icon: Timer, value: '12d', subtitle: 'Average days to close' },
  { key: 'win_rate', label: 'Win Rate', category: 'Performance', icon: Percent, value: '67%', subtitle: 'Won vs lost' },
];

const DEFAULT_ACTIVE = new Set(['total', 'awaiting', 'expiring']);

/* ── Time Range Dropdown (Physical Inventory pattern) ── */
const TIME_RANGES = [
  { key: 'yesterday', label: 'Yesterday', desc: 'Previous day' },
  { key: 'last_7', label: 'Last 7 Days', desc: 'Rolling 7 days' },
  { key: 'last_30', label: 'Last 30 Days', desc: 'Rolling 30 days' },
  { key: 'this_quarter', label: 'This Quarter', desc: 'Q1 2026' },
  { key: 'this_year', label: '2026', desc: 'Jan 1 – Today' },
];

function TimeRangeDropdown({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const current = TIME_RANGES.find(t => t.key === value) || TIME_RANGES[2];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(v => !v)}
        className="flex items-center gap-1 rounded-full border transition-colors hover:bg-[hsl(213,100%,96%)]"
        style={{
          height: 26, paddingLeft: 10, paddingRight: 8,
          cursor: 'pointer',
          background: isOpen ? 'var(--primary-hover-bg)' : 'var(--card)',
          borderColor: isOpen ? 'var(--primary-border-soft)' : 'var(--border)',
          fontSize: 'var(--text-caption)', fontWeight: 'var(--font-weight-normal)',
          color: isOpen ? 'var(--primary)' : 'var(--muted-foreground)',
        }}
      >
        <Clock size={12} style={{ color: isOpen ? 'var(--primary)' : 'var(--muted-foreground)' }} />
        <span style={{ padding: '0 2px' }}>{current.label}</span>
        <ChevronDown size={12} style={{ color: isOpen ? 'var(--primary)' : 'var(--muted-foreground)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 30,
          minWidth: 220, background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', boxShadow: 'var(--elevation-2)',
          overflow: 'hidden', padding: 4,
        }}>
          {TIME_RANGES.map(opt => {
            const isSelected = value === opt.key;
            return (
              <button key={opt.key} onClick={() => { onChange(opt.key); setIsOpen(false); }}
                className="flex items-center w-full transition-colors"
                style={{
                  gap: 10, padding: '8px 10px', cursor: 'pointer',
                  background: isSelected ? 'var(--primary-hover-bg)' : 'transparent',
                  border: 'none', borderRadius: 'calc(var(--radius) - 2px)', textAlign: 'left',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--secondary)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="flex flex-col flex-1" style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 'var(--text-caption)', fontWeight: isSelected ? 600 : 500, color: isSelected ? 'var(--primary)' : 'var(--foreground)', lineHeight: 1.3 }}>{opt.label}</span>
                  <span style={{ fontSize: 'var(--text-micro)', fontWeight: 400, color: isSelected ? 'var(--primary)' : 'var(--muted-foreground)', lineHeight: 1.3 }}>{opt.desc}</span>
                </div>
                {isSelected && <Check size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── KPI Card — Physical Inventory InsightKPICard pattern ── */
function InsightKPICard({ metric, onRemove }: { metric: InsightMetric; onRemove: (key: string) => void }) {
  const Icon = metric.icon;
  return (
    <div
      className="relative group flex flex-col justify-between border border-border transition-colors hover:border-primary/30 hover:-translate-y-[1px]"
      style={{
        padding: '14px 16px',
        background: 'var(--card)',
        borderRadius: 'var(--radius)',
      }}
    >
      {/* Remove button — trash icon on hover */}
      <button
        onClick={() => onRemove(metric.key)}
        className="absolute bottom-2 right-2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ width: 22, height: 22, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 'calc(var(--radius) - 2px)' }}
        title={`Remove ${metric.label}`}
      >
        <Trash2 size={13} style={{ color: 'var(--destructive)' }} />
      </button>

      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 'var(--text-small)', fontWeight: 'var(--font-weight-medium)', color: 'var(--muted-foreground)' }}>
          {metric.label}
        </span>
        <Icon size={16} style={{ color: 'var(--muted-foreground)' }} />
      </div>
      <span style={{ fontSize: 'var(--text-h4)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--foreground)', lineHeight: 1.2 }}>
        {metric.value}
      </span>
      {metric.subtitle && (
        <span style={{ fontSize: 'var(--text-small)', fontWeight: 'var(--font-weight-normal)', color: 'var(--muted-foreground)', marginTop: 4 }}>
          {metric.subtitle}
        </span>
      )}
    </div>
  );
}

/* ── Insights Drawer — Partner Management KpiInsightsPanel pattern ── */
function InsightsDrawer({
  open,
  onOpenChange,
  activeKeys,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  activeKeys: Set<string>;
  onToggle: (key: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      timeoutRef.current = setTimeout(() => setMounted(false), 280);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [open]);

  if (!mounted) return null;

  const categories = (() => {
    const catMap = new Map<string, InsightMetric[]>();
    for (const m of ALL_METRICS) {
      if (searchQuery && !m.label.toLowerCase().includes(searchQuery.toLowerCase())) continue;
      if (!catMap.has(m.category)) catMap.set(m.category, []);
      catMap.get(m.category)!.push(m);
    }
    return Array.from(catMap.entries());
  })();

  const allKeys = ALL_METRICS.map(m => m.key);
  const allActive = allKeys.every(k => activeKeys.has(k));

  return (
    <>
      <div
        className="fixed inset-0 z-[200] transition-opacity duration-[250ms] ease-in-out"
        style={{ backgroundColor: visible ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0)', pointerEvents: visible ? 'auto' : 'none' }}
        onClick={() => onOpenChange(false)}
      />
      <div
        className="fixed right-0 top-0 bottom-0 z-[200] w-full max-w-[400px] bg-card flex flex-col shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: visible ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-0 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#EDF4FF' }}>
                <BarChart3 className="w-5 h-5" style={{ color: '#0A77FF' }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Add Insights</h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">Customize your dashboard with relevant metrics.</p>
              </div>
            </div>
            <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          {/* Toggle all */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
              {activeKeys.size} of {ALL_METRICS.length} insights active
            </span>
            <button
              onClick={() => {
                if (allActive) allKeys.forEach(k => onToggle(k));
                else allKeys.filter(k => !activeKeys.has(k)).forEach(k => onToggle(k));
              }}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                allActive
                  ? 'bg-[#EBF3FF] border-[#0A77FF]/25 text-[#0A77FF] hover:bg-[#DCEAFF]'
                  : activeKeys.size === 0
                  ? 'bg-secondary border-border text-muted-foreground hover:bg-muted'
                  : 'bg-secondary border-border text-muted-foreground hover:bg-[#EBF3FF] hover:border-[#0A77FF]/25 hover:text-[#0A77FF]'
              }`}
              style={{ fontWeight: 600 }}
            >
              {allActive ? <><ToggleRight className="w-4 h-4 text-[#0A77FF]" /><span>All On</span></> :
               activeKeys.size === 0 ? <><ToggleLeft className="w-4 h-4" /><span>All Off</span></> :
               <><ToggleLeft className="w-4 h-4" /><span>Enable All</span></>}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 pt-3.5 pb-1 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
            <input
              placeholder="Search metrics..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors"
            />
          </div>
        </div>

        {/* Scrollable Content — 2-col grid cards */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
          {categories.length === 0 && (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Search className="w-5 h-5 mb-2 opacity-40" />
              <p className="text-xs text-muted-foreground/60">No metrics found</p>
            </div>
          )}

          {categories.map(([catName, metrics]) => (
            <div key={catName} className="mt-5 first:mt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[12px] text-muted-foreground/70 uppercase tracking-wide" style={{ fontWeight: 600 }}>{catName}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {metrics.map(m => {
                  const isActive = activeKeys.has(m.key);
                  return (
                    <button
                      key={m.key}
                      onClick={() => onToggle(m.key)}
                      className={`relative text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer group ${
                        isActive
                          ? 'border-[#0A77FF]/25 bg-[#0A77FF]/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]'
                          : 'border-border/60 bg-card hover:border-border hover:bg-muted/20 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-[11.5px] truncate transition-colors ${isActive ? 'text-[#0A77FF]' : 'text-muted-foreground/70'}`} style={{ fontWeight: 500 }} title={m.label}>{m.label}</span>
                        <div className="shrink-0">
                          {isActive ? <Check className="w-3.5 h-3.5" style={{ color: '#0A77FF' }} /> : <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />}
                        </div>
                      </div>
                      <p className={`text-[15px] mt-1 truncate transition-colors ${isActive ? 'text-foreground' : 'text-foreground/80'}`} style={{ fontWeight: 550, margin: 0 }}>{m.value}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ═══ Main Export ═══ */
export function PerformanceInsights({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set(DEFAULT_ACTIVE));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [timeRange, setTimeRange] = useState('last_30');

  const toggle = useCallback((key: string) => {
    setActiveKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (!visible) return null;

  const activeMetrics = ALL_METRICS.filter(m => activeKeys.has(m.key));

  return (
    <>
      {activeMetrics.length > 0 && (
        <div style={{ padding: '16px 28px 16px' }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="text-foreground" style={{ fontSize: 13, fontWeight: 600 }}>Performance Insights</span>
              <TimeRangeDropdown value={timeRange} onChange={setTimeRange} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                onClick={() => setDrawerOpen(true)}
                className="text-primary hover:opacity-70 transition-opacity"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, height: 28, padding: '0 8px',
                  borderRadius: 6, border: 'none', backgroundColor: 'transparent',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}
              >
                <Plus style={{ width: 14, height: 14 }} />
                Insights
              </button>
              <button
                onClick={onDismiss}
                title="Hide insights"
                className="hover:bg-secondary transition-colors"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 6, border: 'none',
                  backgroundColor: 'transparent', color: 'var(--muted-foreground)',
                  cursor: 'pointer', opacity: 0.4,
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; }}
              >
                <X style={{ width: 15, height: 15 }} />
              </button>
            </div>
          </div>

          {/* Cards grid — Physical Inventory KPI card pattern */}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
            {activeMetrics.map(metric => (
              <InsightKPICard key={metric.key} metric={metric} onRemove={toggle} />
            ))}
          </div>
        </div>
      )}

      {/* Drawer */}
      <InsightsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        activeKeys={activeKeys}
        onToggle={toggle}
      />
    </>
  );
}
