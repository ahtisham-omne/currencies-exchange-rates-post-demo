import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search, X, Check, Plus, Sliders, ToggleLeft, ToggleRight,
  FileText, DollarSign, Clock, Globe, ChartColumn,
} from "lucide-react";
import { FONT } from "./designTokens";

/* ═══════════════════════════════════════════════════════════════
   INSIGHTS DRAWER — Customize Widgets panel matching Partners'
   KpiInsightsPanel: custom slide-in drawer with toggle-all,
   search, category sections, and 2-col card grid.
   ═══════════════════════════════════════════════════════════════ */

export interface InsightCard {
  id: string;
  label: string;
  value: string;
  category: string;
  /** Optional help text — rendered as a tooltip on the KPI card
      (both here in the widget picker and on the listing strip). */
  tooltip?: string;
  /** Optional supporting-metric line under the value ("of 47 items
      in scope", "91 vendors · vs prior 30 days", etc.). Displayed on
      the listing-strip card; the widget picker ignores it. */
  sub?: string;
  /** Optional period-over-period delta prefix rendered inline with
      the value. */
  delta?: {
    text: string;
    tone: "positive" | "negative" | "neutral";
  };
}

/* Buyer 2026-07-31: trimmed the KPI list to the five status
   snapshots that matter for the listing strip. Financial /
   Operational / broader Order Overview widgets are parked (host
   still passes activeInsightIds so re-adding a widget is a one-line
   append). Placeholder values here are illustrative; the listing
   computes real counts in `kpiStats`. */
const INSIGHT_DEFINITIONS: InsightCard[] = [
  { id: "total-orders",                label: "Total Orders",              value: "20", category: "Order Status" },
  { id: "cancelled-orders",            label: "Cancelled Orders",          value: "2",  category: "Order Status" },
  { id: "active-with-cancellations",   label: "Active with Cancellations", value: "3",  category: "Order Status" },
  { id: "closed-with-cancellations",   label: "Closed with Cancellations", value: "1",  category: "Order Status" },
  { id: "fully-received-orders",       label: "Fully Received",            value: "12", category: "Order Status" },
];

function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case "Order Status":   return <Clock className="w-4 h-4 text-muted-foreground" />;
    case "Order Overview": return <FileText className="w-4 h-4 text-muted-foreground" />;
    case "Financial":      return <DollarSign className="w-4 h-4 text-muted-foreground" />;
    case "Status":         return <Clock className="w-4 h-4 text-muted-foreground" />;
    case "Operational":    return <Globe className="w-4 h-4 text-muted-foreground" />;
    default:               return <ChartColumn className="w-4 h-4 text-muted-foreground" />;
  }
}

interface InsightsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeInsightIds: string[];
  onToggleInsight: (id: string) => void;
  /** Per-caller list of insights. When omitted the drawer falls back
      to the built-in PO listing set so PurchaseOrdersListing keeps
      working with zero changes. Procurement Planning + PR flows pass
      their own definitions. */
  definitions?: InsightCard[];
}

export default function InsightsDrawer({
  open,
  onOpenChange,
  activeInsightIds,
  onToggleInsight,
  definitions,
}: InsightsDrawerProps) {
  const defs = definitions ?? INSIGHT_DEFINITIONS;
  const [searchQuery, setSearchQuery] = useState("");

  const categories = useMemo(() => {
    const cats: { name: string; items: InsightCard[] }[] = [];
    const catMap = new Map<string, InsightCard[]>();
    for (const item of defs) {
      const matches =
        !searchQuery ||
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      if (matches) {
        if (!catMap.has(item.category)) catMap.set(item.category, []);
        catMap.get(item.category)!.push(item);
      }
    }
    catMap.forEach((items, name) => cats.push({ name, items }));
    return cats;
  }, [searchQuery, defs]);

  const activeCount = activeInsightIds.length;
  const totalCount = defs.length;
  const allActive = defs.every((k) => activeInsightIds.includes(k.id));
  const noneActive = activeCount === 0;

  /* Smooth mount / unmount with CSS transitions */
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      timeoutRef.current = setTimeout(() => setMounted(false), 280);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [open]);

  if (!mounted) return null;

  const handleToggleAll = () => {
    const allKeys = defs.map((k) => k.id);
    if (allActive) {
      activeInsightIds.forEach((id) => onToggleInsight(id));
    } else {
      allKeys.filter((id) => !activeInsightIds.includes(id)).forEach((id) => onToggleInsight(id));
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] transition-opacity duration-[250ms] ease-in-out"
        style={{
          backgroundColor: visible ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0)",
          pointerEvents: visible ? "auto" : "none",
        }}
        onClick={() => onOpenChange(false)}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-[200] w-full max-w-[400px] bg-white flex flex-col shadow-2xl transition-transform duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          transform: visible ? "translateX(0)" : "translateX(100%)",
          fontFamily: FONT,
        }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-0 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: "hsl(var(--accent))" }}
              >
                <Sliders className="w-5 h-5" style={{ color: "hsl(var(--primary))" }} />
              </div>
              <div>
                <h2 className="text-base text-foreground" style={{ fontWeight: 600 }}>
                  Customize Widgets
                </h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  Manage your dashboard KPI widgets.
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer -mt-0.5 -mr-1"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Toggle-all row */}
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
              {activeCount} of {totalCount} widgets active
            </span>
            <button
              onClick={handleToggleAll}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                allActive
                  ? "bg-[#EBF3FF] border-primary/25 text-primary hover:bg-[#DCEAFF] hover:border-primary/40 shadow-sm shadow-primary/10"
                  : noneActive
                  ? "bg-slate-50 border-border text-slate-400 hover:bg-muted hover:border-slate-300 hover:text-slate-500"
                  : "bg-slate-50 border-border text-slate-500 hover:bg-[#EBF3FF] hover:border-primary/25 hover:text-primary"
              }`}
              style={{ fontWeight: 600 }}
            >
              {/* "Disable All" when every widget is on, otherwise "Enable All"
                  — same toggle copy as Partners, UOM and the rest of the app. */}
              {allActive ? (
                <>
                  <ToggleRight className="w-4 h-4 text-primary" />
                  <span>Disable All</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4" />
                  <span>Enable All</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 pt-3.5 pb-0 shrink-0">
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

        {/* Separator */}
        <div className="border-b border-muted mt-3 shrink-0" />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
          {categories.length === 0 && (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Search className="w-5 h-5 mb-2 opacity-40" />
              <p className="text-xs text-muted-foreground/60">No metrics found</p>
            </div>
          )}

          {categories.map((cat) => (
            <div key={cat.name} className="mt-5 first:mt-4">
              {/* Category header */}
              <div className="flex items-center gap-1.5 mb-2">
                <CategoryIcon category={cat.name} />
                <span
                  className="text-[12px] text-muted-foreground/70 uppercase tracking-wide"
                  style={{ fontWeight: 600 }}
                >
                  {cat.name}
                </span>
              </div>

              {/* 2-col card grid */}
              <div className="grid grid-cols-2 gap-2">
                {cat.items.map((item) => {
                  const isActive = activeInsightIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => onToggleInsight(item.id)}
                      className={`relative text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer group ${
                        isActive
                          ? "border-primary/25 bg-primary/[0.04] shadow-[0_0_0_1px_rgba(10,119,255,0.08)]"
                          : "border-border/60 bg-white hover:border-border hover:bg-muted/20 hover:shadow-sm"
                      }`}
                    >
                      {/* Top row: label + toggle icon */}
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[11.5px] truncate transition-colors ${
                            isActive ? "text-primary" : "text-muted-foreground/70"
                          }`}
                          style={{ fontWeight: 500 }}
                          title={item.tooltip ?? item.label}
                        >
                          {item.label}
                        </span>
                        <div className="shrink-0">
                          {isActive ? (
                            <Check className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
                          ) : (
                            <Plus className="w-3.5 h-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />
                          )}
                        </div>
                      </div>

                      {/* Value */}
                      <p
                        className={`text-[15px] mt-1 transition-colors ${
                          isActive ? "text-foreground" : "text-foreground/80"
                        }`}
                        style={{ fontWeight: 550 }}
                      >
                        {item.value}
                      </p>
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
