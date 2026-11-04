import { useEffect, useMemo, useRef, useState } from 'react';
import { Sliders, X, Search, Check, Plus, ToggleLeft, ToggleRight, LayoutGrid } from 'lucide-react';
import type { ReadyRow } from '@/app/data/ar/arBilling';
import {
  ALL_READY_INVOICE_KPI_DEFINITIONS as ALL_READY_KPI_DEFINITIONS,
  computeReadyInvoiceKpi as computeReadyKpi,
  type ReadyInvoiceKpiDefinition as ReadyKpiDefinition,
  type ReadyInvoiceKpiContext as ReadyKpiContext,
} from '@/app/components/customer/readyToInvoiceKpis';
import { highlightText } from '@/app/components/InvoiceDataTable';

// Customize drawer for the Customer Invoices "Ready to Invoice" insights: a
// verbatim fork of the vendor ReadyToPayInsightsPanel, reading the AR
// ready-row KPI catalogue. Only the data binding and copy differ.
interface ReadyToInvoiceInsightsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeKpis: string[];
  onToggleKpi: (key: string) => void;
  ready: ReadyRow[];
  ctx: ReadyKpiContext;
}

export function ReadyToInvoiceInsightsPanel({ open, onOpenChange, activeKpis, onToggleKpi, ready, ctx }: ReadyToInvoiceInsightsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const categories = useMemo(() => {
    const catMap = new Map<string, ReadyKpiDefinition[]>();
    for (const kpi of ALL_READY_KPI_DEFINITIONS) {
      const matches =
        !searchQuery ||
        kpi.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kpi.category.toLowerCase().includes(searchQuery.toLowerCase());
      if (matches) {
        if (!catMap.has(kpi.category)) catMap.set(kpi.category, []);
        catMap.get(kpi.category)!.push(kpi);
      }
    }
    return Array.from(catMap.entries()).map(([name, kpis]) => ({ name, kpis }));
  }, [searchQuery]);

  const activeCount = activeKpis.length;

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

  const allActive = ALL_READY_KPI_DEFINITIONS.every((k) => activeKpis.includes(k.key));

  return (
    <>
      <div
        className="fixed inset-0 z-[200] transition-opacity duration-[250ms] ease-in-out"
        style={{ backgroundColor: visible ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0)', pointerEvents: visible ? 'auto' : 'none' }}
        onClick={() => onOpenChange(false)}
      />
      <div
        className="fixed right-0 top-0 bottom-0 z-[200] w-full max-w-[400px] bg-white flex flex-col shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ transform: visible ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <div className="px-5 pt-5 pb-0 bg-white shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'hsl(var(--accent))' }}>
                <Sliders className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>Customize Insights</h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">Choose which KPI cards show in Ready to Invoice insights.</p>
              </div>
            </div>
            <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
              {activeCount} of {ALL_READY_KPI_DEFINITIONS.length} widgets active
            </span>
            <button
              onClick={() => {
                const allKeys = ALL_READY_KPI_DEFINITIONS.map((k) => k.key);
                if (allActive) activeKpis.forEach((k) => onToggleKpi(k));
                else allKeys.filter((k) => !activeKpis.includes(k)).forEach((k) => onToggleKpi(k));
              }}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                allActive
                  ? 'bg-blue-50 border-primary/25 text-primary hover:bg-blue-100 hover:border-primary/40 shadow-sm shadow-primary/10'
                  : activeKpis.length === 0
                    ? 'bg-slate-50 border-border text-slate-400 hover:bg-muted hover:border-slate-300 hover:text-slate-500'
                    : 'bg-slate-50 border-border text-slate-500 hover:bg-blue-50 hover:border-primary/25 hover:text-primary'
              }`}
              style={{ fontWeight: 600 }}
            >
              {allActive ? (<><ToggleRight className="w-4 h-4 text-primary" /><span>All On</span></>)
                : activeKpis.length === 0 ? (<><ToggleLeft className="w-4 h-4" /><span>All Off</span></>)
                  : (<><ToggleLeft className="w-4 h-4" /><span>Enable All</span></>)}
            </button>
          </div>
        </div>

        <div className="px-5 pt-3.5 pb-3 bg-white border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
            <input
              placeholder="Search metrics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors"
            />
          </div>
        </div>


        <div className="flex-1 overflow-y-auto px-4 pb-4 bg-slate-50 scrollbar-hide">
          {categories.length === 0 && (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Search className="w-5 h-5 mb-2 opacity-40" />
              <p className="text-xs text-muted-foreground/60">No metrics found</p>
            </div>
          )}
          {categories.map((cat) => (
            <div key={cat.name} className="mt-5 first:mt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <LayoutGrid className="w-3 h-3 text-muted-foreground/50" />
                <span className="text-[12px] text-muted-foreground/70 tracking-wide" style={{ fontWeight: 600 }}>{highlightText(cat.name, searchQuery)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {cat.kpis.map((kpi) => {
                  const isActive = activeKpis.includes(kpi.key);
                  const { value } = computeReadyKpi(kpi.key, ready, ctx);
                  return (
                    <button
                      key={kpi.key}
                      onClick={() => onToggleKpi(kpi.key)}
                      className={`relative text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer group ${
                        isActive
                          ? 'border-primary/25 bg-white shadow-[0_0_0_1px_rgba(10,119,255,0.08)]'
                          : 'border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-[11px] truncate transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground/70'}`} style={{ fontWeight: 500 }} title={kpi.label}>
                          {highlightText(kpi.label, searchQuery)}
                        </span>
                        <div className="shrink-0">
                          {isActive ? <Check className="w-3.5 h-3.5" style={{ color: 'hsl(var(--primary))' }} /> : <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />}
                        </div>
                      </div>
                      <p className={`text-[15px] mt-1 transition-colors ${isActive ? 'text-foreground' : 'text-foreground/80'}`} style={{ fontWeight: 600 }}>{value}</p>
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
