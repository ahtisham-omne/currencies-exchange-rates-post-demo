import React, { useState } from "react";
import {
  Search, X, Check, Plus, BarChart3,
  FileText, DollarSign, Clock, Globe,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { FONT, typography as s } from "./designTokens";
import { BaseCurrencyKPI } from "./currency/BaseCurrencyKPI";

/* ═══════════════════════════════════════════════════════════════
   INSIGHTS DRAWER — Add/remove KPI insight cards
   Right-side drawer matching the reference design with
   section icons, metric values inside cards, and active state
   with blue tint + checkmark.
   ═══════════════════════════════════════════════════════════════ */

export interface InsightCard {
  id: string;
  label: string;
  value: string;
  section: string;
  financial?: boolean;
  pkrValue?: number;
}

interface InsightSection {
  title: string;
  icon: React.ElementType;
  items: InsightCard[];
}

const INSIGHT_SECTIONS: InsightSection[] = [
  {
    title: "ORDER OVERVIEW",
    icon: FileText,
    items: [
      { id: "total-orders", label: "Total Orders", value: "20", section: "ORDER OVERVIEW" },
      { id: "pending-approval", label: "Pending Approval", value: "5", section: "ORDER OVERVIEW" },
      { id: "overdue-deliveries", label: "Overdue Deliveries", value: "6", section: "ORDER OVERVIEW" },
    ],
  },
  {
    title: "FINANCIAL",
    icon: DollarSign,
    items: [
      { id: "total-value", label: "Total Value", value: "", financial: true, pkrValue: 6_120_800, section: "FINANCIAL" },
      { id: "avg-order-value", label: "Avg Order Value", value: "", financial: true, pkrValue: 306_040, section: "FINANCIAL" },
      { id: "outstanding-balance", label: "Outstanding Balance", value: "", financial: true, pkrValue: 2_270_500, section: "FINANCIAL" },
      { id: "total-spent", label: "Total Spent", value: "", financial: true, pkrValue: 4_590_200, section: "FINANCIAL" },
      { id: "avg-line-items", label: "Avg Line Items", value: "3.2", section: "FINANCIAL" },
      { id: "discount-total", label: "Total Discounts", value: "", financial: true, pkrValue: 116_295, section: "FINANCIAL" },
    ],
  },
  {
    title: "STATUS",
    icon: Clock,
    items: [
      { id: "active-orders", label: "Active Orders", value: "15", section: "STATUS" },
      { id: "completed-orders", label: "Completed Orders", value: "12", section: "STATUS" },
      { id: "cancelled-orders", label: "Cancelled Orders", value: "2", section: "STATUS" },
    ],
  },
  {
    title: "OPERATIONAL",
    icon: Globe,
    items: [
      { id: "avg-delivery-time", label: "Avg Delivery Time", value: "14 days", section: "OPERATIONAL" },
      { id: "on-time-rate", label: "On-Time Rate", value: "87.5%", section: "OPERATIONAL" },
      { id: "vendor-count", label: "Vendor Count", value: "10", section: "OPERATIONAL" },
    ],
  },
];

interface InsightsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeInsightIds: string[];
  onToggleInsight: (id: string) => void;
}

export default function InsightsDrawer({
  open,
  onOpenChange,
  activeInsightIds,
  onToggleInsight,
}: InsightsDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = INSIGHT_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((section) => section.items.length > 0);

  const activeCount = activeInsightIds.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[420px] sm:w-[460px] sm:max-w-[460px] p-0 gap-0 flex flex-col"
        style={{ fontFamily: FONT, backgroundColor: "var(--card)" }}
        aria-describedby={undefined}
      >
        {/* ── Header ── */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border gap-0 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center size-10 rounded-full shrink-0"
                style={{ backgroundColor: "var(--primary-tint)", color: "var(--primary)" }}
              >
                <BarChart3 className="size-[18px]" />
              </div>
              <div className="flex flex-col gap-0.5">
                <SheetTitle
                  className="text-foreground"
                  style={{
                    fontSize: "var(--text-base)",
                    fontWeight: "var(--font-weight-semibold)",
                    lineHeight: "24px",
                    fontFamily: FONT,
                  }}
                >
                  Add Insights
                </SheetTitle>
                <span
                  style={{ ...s.uiCaption, color: "var(--muted-foreground)" }}
                >
                  Customize your dashboard with relevant metrics.
                </span>
              </div>
            </div>
            <button
              className="flex items-center justify-center size-8 rounded-[var(--radius-sm)] hover:bg-secondary/80 transition-colors cursor-pointer shrink-0 -mt-0.5"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="size-4" style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>
        </SheetHeader>

        {/* ── Search ── */}
        <div className="px-5 py-3.5 shrink-0">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
              style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
            />
            <input
              type="text"
              placeholder="Search metrics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-[var(--radius)] border border-border pl-9 pr-8 text-foreground placeholder:text-foreground/30 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-ring/20"
              style={{ ...s.uiCaption, backgroundColor: "var(--input-background)" }}
            />
            {searchQuery && (
              <button
                className="absolute right-2.5 top-1/2 -translate-y-1/2 hover:text-foreground cursor-pointer transition-colors"
                style={{ color: "var(--muted-foreground)" }}
                onClick={() => setSearchQuery("")}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Sections ── */}
        <div
          className="flex-1 overflow-y-auto px-5 pb-5"
          style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border) transparent" }}
        >
          {filteredSections.map((section, sIdx) => {
            const SectionIcon = section.icon;
            return (
              <div key={section.title} className={sIdx > 0 ? "mt-6" : ""}>
                {/* Section header with icon */}
                <div className="flex items-center gap-2 mb-3">
                  <SectionIcon
                    className="size-4 shrink-0"
                    style={{ color: "var(--muted-foreground)", opacity: 0.6 }}
                  />
                  <span
                    style={{
                      ...s.sectionLabel,
                      color: "var(--muted-foreground)",
                    }}
                  >
                    {section.title}
                  </span>
                </div>

                {/* 2-col card grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  {section.items.map((item) => {
                    const isActive = activeInsightIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        className="flex flex-col rounded-[var(--radius)] border transition-all cursor-pointer text-left group relative"
                        style={{
                          backgroundColor: isActive ? "var(--primary-tint)" : "var(--card)",
                          borderColor: isActive ? "var(--primary)" : "var(--border)",
                          padding: "12px 14px",
                        }}
                        onClick={() => onToggleInsight(item.id)}
                      >
                        {/* Top row: label + icon */}
                        <div className="flex items-start justify-between w-full gap-2 mb-1">
                          <span
                            style={{
                              ...s.uiCaption,
                              color: isActive ? "var(--primary)" : "var(--muted-foreground)",
                            }}
                          >
                            {item.label}
                          </span>
                          {/* Toggle icon */}
                          <span
                            className="flex items-center justify-center shrink-0 rounded-full transition-all"
                            style={{
                              width: 20,
                              height: 20,
                              backgroundColor: isActive ? "var(--primary)" : "transparent",
                              color: isActive ? "var(--primary-foreground)" : "var(--muted-foreground)",
                              border: isActive ? "none" : "1.5px solid var(--border)",
                              opacity: isActive ? 1 : 0.6,
                            }}
                          >
                            {isActive ? (
                              <Check className="size-3" strokeWidth={2.5} />
                            ) : (
                              <Plus className="size-3" />
                            )}
                          </span>
                        </div>

                        {/* Value */}
                        <span
                          className="text-foreground"
                          style={{
                            fontSize: "var(--text-h4)",
                            fontWeight: "var(--font-weight-semibold)",
                            lineHeight: "28px",
                            fontFamily: FONT,
                          }}
                        >
                          {item.financial && typeof item.pkrValue === "number" ? (
                            <span onClick={(e) => e.stopPropagation()}>
                              <BaseCurrencyKPI valuePKR={item.pkrValue} />
                            </span>
                          ) : (
                            item.value
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div
          className="shrink-0 px-5 py-3.5 border-t border-border flex items-center justify-between"
          style={{ backgroundColor: "var(--card)" }}
        >
          <span style={{ ...s.uiCaption, color: "var(--muted-foreground)" }}>
            {activeCount} insights active
          </span>
          <span className="flex items-center gap-1.5" style={{ ...s.uiCaption, color: "var(--primary)" }}>
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: "var(--primary)" }}
            />
            {activeCount} active
          </span>
        </div>
      </SheetContent>
    </Sheet>
  );
}