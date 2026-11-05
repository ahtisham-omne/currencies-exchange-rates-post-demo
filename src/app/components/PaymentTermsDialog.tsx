import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Search,
  Check,
  ChevronRight,
  Plus,
  ArrowUpDown,
  CalendarClock,
} from "lucide-react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";

import { FONT } from "./designTokens";
import { PAYMENT_TERM_PRESETS } from "./paymentTermPresets";

/* ═══════════════════════════════════════════════════════════════
   TYPOGRAPHY — CSS-variable bound, Inter only
   ═══════════════════════════════════════════════════════════════ */

const st = {
  dialogTitle: {
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,
  categoryGroup: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
    letterSpacing: "0.02em",
  } as React.CSSProperties,
  categoryItem: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,
  categoryItemActive: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,
  cardTitle: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  cardTag: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.3",
    fontFamily: FONT,
  } as React.CSSProperties,
  cardDesc: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,
  cardMeta: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  badge: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.3",
    fontFamily: FONT,
    letterSpacing: "0.02em",
  } as React.CSSProperties,
  btnLabel: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  sortLabel: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  searchInput: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,
  tiny: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.3",
    fontFamily: FONT,
  } as React.CSSProperties,
};

/* ═══════════════════════════════════════════════════════════════
   PAYMENT TERM DATA MODEL
   ═══════════════════════════════════════════════════════════════ */

export type PaymentTermType = "NET" | "Pre" | "Split";

export interface PaymentTermTemplate {
  id: string;
  name: string;
  type: PaymentTermType;
  triggerEvent: string;
  description: string;
  vendorsApplied: number;
  recentlyUsed?: boolean;
  createdBy?: "system" | "me" | "others";
}

/* ── Badge color per type ── */
const TYPE_BADGE: Record<PaymentTermType, { bg: string; text: string; label: string }> = {
  NET: { bg: "bg-primary/12", text: "text-primary", label: "NET" },
  Pre: { bg: "bg-[hsl(var(--chart-4))]/12", text: "text-[hsl(var(--chart-4))]", label: "Pre" },
  Split: { bg: "bg-[hsl(var(--chart-3))]/12", text: "text-[hsl(var(--chart-3))]", label: "Split" },
};

/* ── Mock vendor avatars for the cards ── */
const VENDOR_AVATARS = [
  { initials: "GM", bg: "var(--avatar-1-bg)", color: "var(--avatar-1-text)" },
  { initials: "TM", bg: "var(--avatar-2-bg)", color: "var(--avatar-2-text)" },
  { initials: "FM", bg: "var(--avatar-3-bg)", color: "var(--avatar-3-text)" },
  { initials: "OW", bg: "var(--avatar-4-bg)", color: "var(--avatar-4-text)" },
];

/* ── Predefined Payment Terms ── */
const PAYMENT_TERMS: PaymentTermTemplate[] = [
  {
    id: "net-10",
    name: "Net 10",
    type: "NET",
    triggerEvent: "Invoice Date",
    description: "Payment is due 10 days after the invoice date.",
    vendorsApplied: 5,
    recentlyUsed: true,
    createdBy: "system",
  },
  {
    id: "net-15",
    name: "Net 15",
    type: "NET",
    triggerEvent: "Invoice Date",
    description: "Payment is due 15 days after the invoice date.",
    vendorsApplied: 4,
    recentlyUsed: true,
    createdBy: "system",
  },
  {
    id: "net-20",
    name: "Net 20",
    type: "NET",
    triggerEvent: "Invoice Date",
    description: "Payment is due 20 days after the invoice date.",
    vendorsApplied: 3,
    createdBy: "system",
  },
  {
    id: "net-30",
    name: "Net 30",
    type: "NET",
    triggerEvent: "Invoice Date",
    description: "Payment is due 30 days after the invoice date.",
    vendorsApplied: 8,
    recentlyUsed: true,
    createdBy: "system",
  },
  {
    id: "net-30-shipping",
    name: "Net 30 Post Shipping",
    type: "NET",
    triggerEvent: "Shipping",
    description: "Full payment is due 30 days after the goods are shipped.",
    vendorsApplied: 4,
    createdBy: "system",
  },
  {
    id: "net-45",
    name: "Net 45 Post Delivery",
    type: "NET",
    triggerEvent: "Delivery",
    description: "Payment is due 45 days after goods are delivered.",
    vendorsApplied: 3,
    createdBy: "system",
  },
  {
    id: "net-60",
    name: "Net 60 Post Production End",
    type: "NET",
    triggerEvent: "Production End",
    description: "Payment is due 60 days after production is completed.",
    vendorsApplied: 2,
    createdBy: "system",
  },
  {
    id: "pre-order",
    name: "Full Advance Payment: Order Confirmation",
    type: "Pre",
    triggerEvent: "Order Confirmation",
    description: "100% of the total amount is paid when the order is confirmed.",
    vendorsApplied: 3,
    createdBy: "system",
  },
  {
    id: "pre-production",
    name: "Full Advance Payment: Production Begins",
    type: "Pre",
    triggerEvent: "Production Start",
    description: "A (X)% prepayment is required when production begins.",
    vendorsApplied: 2,
    createdBy: "system",
  },
  {
    id: "split-30-70",
    name: "30/70 Split: Production Start & Delivery",
    type: "Split",
    triggerEvent: "Production Start",
    description: "30% is due at production start, 70% on delivery.",
    vendorsApplied: 4,
    createdBy: "system",
  },
  {
    id: "split-50-50",
    name: "50/50 Split: Order & Delivery",
    type: "Split",
    triggerEvent: "Order Confirmation",
    description: "50% upon order confirmation, 50% upon delivery.",
    vendorsApplied: 2,
    recentlyUsed: true,
    createdBy: "system",
  },
  {
    id: "net-due-receipt",
    name: "Due on Receipt",
    type: "NET",
    triggerEvent: "Invoice Date",
    description: "Payment is due immediately upon receipt of invoice.",
    vendorsApplied: 6,
    recentlyUsed: true,
    createdBy: "system",
  },
  {
    id: "2-10-net-30",
    name: "2/10 Net 30",
    type: "NET",
    triggerEvent: "Invoice Date",
    description: "2% discount if paid within 10 days, otherwise net 30 days.",
    vendorsApplied: 3,
    createdBy: "me",
  },
  {
    id: "pre-50-production",
    name: "50% Advance: Production Start",
    type: "Pre",
    triggerEvent: "Production Start",
    description: "50% prepayment required when production begins.",
    vendorsApplied: 1,
    createdBy: "me",
  },
  {
    id: "split-40-60",
    name: "40/60 Split: Shipping & Delivery",
    type: "Split",
    triggerEvent: "Shipping",
    description: "40% due at shipping, 60% upon delivery confirmation.",
    vendorsApplied: 2,
    createdBy: "others",
  },
];

/* ── Helper: lookup term info by name ──
   Resolution order:
     1. Legacy `PAYMENT_TERMS` library (this file's seed list — the original
        16 system terms that pre-date the Browse Templates modal port).
     2. `PAYMENT_TERM_PRESETS` (the canonical Partners-aligned dataset that
        backs the new Browse Templates modal, ~17 entries including custom
        templates and names like "2/10 Net 30 Post Shipping" / "Net 25 Post
        Production End" / "20/30/50 Split: …" that aren't in the legacy
        list). Preset shape is adapted to `PaymentTermTemplate` so the
        single downstream renderer (POSidebarSections' `PaymentTermCard`)
        works for either source.
   This shim exists so that when a user applies any term from the Browse
   Templates modal — including newly added preset names — the rich card
   renders in the Payment Terms accordion instead of falling back to the
   plain-text FieldRow ("string"-only) row. */
export function resolvePaymentTermByName(name: string): PaymentTermTemplate | undefined {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return undefined;

  // 1. Legacy library
  const legacy = PAYMENT_TERMS.find(
    (t) => t.name === trimmed || t.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (legacy) return legacy;

  // 2. Browse Templates presets (PAYMENT_TERM_PRESETS)
  const preset = PAYMENT_TERM_PRESETS.find(
    (p) => p.name === trimmed || p.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (!preset) return undefined;

  const type: PaymentTermType =
    preset.typeBadge === "Pre"
      ? "Pre"
      : preset.typeBadge === "Split"
        ? "Split"
        : "NET";

  return {
    id: preset.id,
    name: preset.name,
    type,
    triggerEvent: preset.trigger,
    description: preset.description,
    vendorsApplied: preset.vendorsApplied,
    createdBy: preset.id.startsWith("pt-custom-") ? "me" : "system",
  };
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR CATEGORIES
   ══════════════════════════════════════════════════════════════ */

type CategoryId =
  | "recently-used"
  | "all"
  | "net"
  | "prepayment"
  | "split"
  | "vendors-applied"
  | "created-by-me"
  | "created-by-others";

interface CategoryItem {
  id: CategoryId;
  label: string;
  group: "recent" | "predefined" | "custom";
}

const CATEGORIES: CategoryItem[] = [
  { id: "recently-used", label: "Recently used", group: "recent" },
  { id: "all", label: "All Terms", group: "predefined" },
  { id: "net", label: "NET Terms", group: "predefined" },
  { id: "prepayment", label: "Prepayment Terms", group: "predefined" },
  { id: "split", label: "Split Terms", group: "predefined" },
  { id: "vendors-applied", label: "Vendors Applied", group: "custom" },
  { id: "created-by-me", label: "Created by me", group: "custom" },
  { id: "created-by-others", label: "Created by others", group: "custom" },
];

/* ═══════════════════════════════════════════════════════════════
   CATEGORY SIDEBAR — Left panel
   ═══════════════════════════════════════════════════════════════ */

function CategorySidebar({
  activeCategory,
  onSelect,
}: {
  activeCategory: CategoryId;
  onSelect: (id: CategoryId) => void;
}) {
  const recent = CATEGORIES.filter((c) => c.group === "recent");
  const predefined = CATEGORIES.filter((c) => c.group === "predefined");
  const custom = CATEGORIES.filter((c) => c.group === "custom");

  const renderItem = (cat: CategoryItem) => {
    const isActive = cat.id === activeCategory;
    return (
      <button
        key={cat.id}
        className={`w-full text-left flex items-center justify-between py-1.5 px-2 rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
          isActive
            ? "text-primary"
            : "text-foreground/70 hover:text-foreground hover:bg-secondary/50"
        }`}
        style={isActive ? st.categoryItemActive : st.categoryItem}
        onClick={() => onSelect(cat.id)}
      >
        <span className="truncate">{cat.label}</span>
        <ChevronRight className={`size-3 shrink-0 ${isActive ? "text-primary" : "text-foreground/20"}`} />
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4 py-3 px-3" style={{ fontFamily: FONT }}>
      {/* Recently used */}
      <div className="flex flex-col gap-0.5">
        {recent.map(renderItem)}
      </div>

      {/* Predefined Templates */}
      <div className="flex flex-col gap-0.5">
        <span className="text-foreground px-2 mb-1" style={st.categoryGroup}>
          Predefined Templates
        </span>
        <div className="flex flex-col gap-0.5 relative">
          {predefined.map((cat) => {
            const isActive = cat.id === activeCategory;
            return (
              <div key={cat.id} className="relative flex items-center">
                {/* Active left accent bar */}
                {isActive && (
                  <div
                    className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-primary"
                  />
                )}
                <button
                  className={`w-full text-left flex items-center justify-between py-1.5 px-2 rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
                    isActive
                      ? "text-primary"
                      : "text-foreground/70 hover:text-foreground hover:bg-secondary/50"
                  }`}
                  style={isActive ? st.categoryItemActive : st.categoryItem}
                  onClick={() => onSelect(cat.id)}
                >
                  <span className="truncate">{cat.label}</span>
                  <ChevronRight className={`size-3 shrink-0 ${isActive ? "text-primary" : "text-foreground/20"}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Made by FR Conversions */}
      <div className="flex flex-col gap-0.5">
        <span className="text-foreground px-2 mb-1" style={st.categoryGroup}>
          Made by FR Conversions
        </span>
        {custom.map(renderItem)}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAYMENT TERM CARD — Grid card in the right panel
   ═══════════════════════════════════════════════════════════════ */

function PaymentTermCard({
  term,
  isSelected,
  onSelect,
}: {
  term: PaymentTermTemplate;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const badge = TYPE_BADGE[term.type];
  const showCount = Math.min(term.vendorsApplied, 3);
  const overflow = term.vendorsApplied - showCount;

  return (
    <button
      className={`w-full text-left flex flex-col rounded-[var(--radius-md)] border p-3.5 transition-all cursor-pointer ${
        isSelected
          ? "border-primary bg-primary-tint shadow-[var(--elevation-card)]"
          : "border-border bg-card hover:border-foreground/15 hover:shadow-[var(--elevation-card)]"
      }`}
      style={{ fontFamily: FONT, minHeight: "140px" }}
      onClick={onSelect}
    >
      {/* Top row: Type badge + Name */}
      <div className="flex items-start gap-2.5">
        {/* Type badge */}
        <div
          className={`flex items-center justify-center px-2 py-1 rounded-[var(--radius-sm)] shrink-0 ${badge.bg}`}
        >
          <span className={badge.text} style={st.badge}>{badge.label}</span>
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-foreground block" style={st.cardTitle}>
            {term.name}
          </span>
          {/* Trigger event tag */}
          <span
            className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-secondary text-muted-foreground"
            style={st.cardTag}
          >
            {term.triggerEvent}
          </span>
        </div>
      </div>

      {/* Description */}
      <p
        className="text-muted-foreground mt-2.5 flex-1 line-clamp-2"
        style={st.cardDesc}
      >
        {term.description}
      </p>

      {/* Footer: Vendors Applied */}
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/40">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground" style={st.cardMeta}>Vendors Applied</span>
          <div
            className="size-1 rounded-full bg-foreground/10"
          />
        </div>

        {/* Avatar stack */}
        <div className="flex items-center">
          {VENDOR_AVATARS.slice(0, showCount).map((av, idx) => (
            <div
              key={idx}
              className="flex items-center justify-center size-5 rounded-full border border-card -ml-1 first:ml-0"
              style={{
                backgroundColor: av.bg,
                fontFamily: FONT,
              }}
            >
              <span
                style={{
                  fontSize: "7px",
                  fontWeight: "var(--font-weight-medium)",
                  fontFamily: FONT,
                  color: av.color,
                }}
              >
                {av.initials}
              </span>
            </div>
          ))}
          {overflow > 0 && (
            <div
              className="flex items-center justify-center size-5 rounded-full border border-card bg-secondary -ml-1"
            >
              <span className="text-muted-foreground" style={{ fontSize: "7px", fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}>
                +{overflow}
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAYMENT TERMS DIALOG — Main exported dialog

   Two-panel layout:
   ┌────────────────────────────────────────────────────┐
   │  X   Select payment terms                          │
   ├──────────────┬─────────────────────────────────────┤
   │ + Create     │  Q Search payment terms...          │
   │              │                                     │
   │ Recently used│  All Terms              Sort by ▾   │
   │              │  ┌────────┐ ┌────────┐ ┌────────┐  │
   │ Predefined   │  │NET│Net10│ │NET│Net15│ │NET│Net20│  │
   │  All Terms  >│  │ desc...│ │ desc...│ │ desc...│  │
   │  NET Terms   │  │Vendors │ │Vendors │ │Vendors │  │
   │  Prepayment  │  └────────┘ └────────┘ └────────┘  │
   │  Split       │                                     │
   │              │  ...more cards...                   │
   │ Made by      │                                     │
   │  Vendors App │                                     │
   │  Created me  │                                     │
   │  Created oth │                                     │
   └──────────────┴─────────────────────────────────────┘
   ═══════════════════════════════════════════════════════════════ */

interface PaymentTermsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentTermName: string;
  onSelect: (termName: string) => void;
}

export default function PaymentTermsDialog({
  open,
  onOpenChange,
  currentTermName,
  onSelect,
}: PaymentTermsDialogProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [sortAsc, setSortAsc] = useState(true);

  /* Initialize on open */
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setActiveCategory("all");
      // Try to find current term
      const found = PAYMENT_TERMS.find(
        (t) => t.name === currentTermName || t.name.toLowerCase() === currentTermName.toLowerCase()
      );
      setSelectedTermId(found?.id || "");
    }
  }, [open, currentTermName]);

  /* Filter terms based on category + search */
  const filteredTerms = useMemo(() => {
    let terms = [...PAYMENT_TERMS];

    // Category filter
    switch (activeCategory) {
      case "recently-used":
        terms = terms.filter((t) => t.recentlyUsed);
        break;
      case "net":
        terms = terms.filter((t) => t.type === "NET");
        break;
      case "prepayment":
        terms = terms.filter((t) => t.type === "Pre");
        break;
      case "split":
        terms = terms.filter((t) => t.type === "Split");
        break;
      case "vendors-applied":
        terms = terms.filter((t) => t.vendorsApplied > 0).sort((a, b) => b.vendorsApplied - a.vendorsApplied);
        break;
      case "created-by-me":
        terms = terms.filter((t) => t.createdBy === "me");
        break;
      case "created-by-others":
        terms = terms.filter((t) => t.createdBy === "others");
        break;
      case "all":
      default:
        break;
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      terms = terms.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.triggerEvent.toLowerCase().includes(q) ||
          t.type.toLowerCase().includes(q)
      );
    }

    // Sort
    if (activeCategory !== "vendors-applied") {
      terms.sort((a, b) =>
        sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      );
    }

    return terms;
  }, [activeCategory, searchQuery, sortAsc]);

  const categoryLabel = CATEGORIES.find((c) => c.id === activeCategory)?.label || "All Terms";

  const handleConfirm = () => {
    const term = PAYMENT_TERMS.find((t) => t.id === selectedTermId);
    if (term) {
      onSelect(term.name);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[960px] p-0 gap-0 overflow-hidden flex flex-col"
        style={{ fontFamily: FONT, height: "min(90vh, 680px)" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center justify-center size-8 rounded-[var(--radius-md)] bg-primary-tint shrink-0">
            <CalendarClock className="size-3.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle style={st.dialogTitle} className="text-foreground">
              Select payment terms
            </DialogTitle>
            <DialogDescription className="sr-only">
              Choose a payment term template for this purchase order
            </DialogDescription>
          </div>
        </div>

        {/* ── Two-panel body ── */}
        <div className="flex flex-1 min-h-0">
          {/* LEFT: Create button + Categories */}
          <div className="w-[210px] shrink-0 flex flex-col border-r border-border min-w-0">
            {/* Create button */}
            <div className="px-3 pt-3 pb-1 shrink-0">
              <Button
                size="sm"
                className="h-8 w-full gap-1.5 cursor-pointer"
                style={st.btnLabel}
              >
                <Plus className="size-3.5" />
                Create Payment Terms
              </Button>
            </div>

            {/* Category list */}
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              <CategorySidebar
                activeCategory={activeCategory}
                onSelect={setActiveCategory}
              />
            </div>
          </div>

          {/* RIGHT: Search + Grid */}
          <div className="flex-1 min-w-0 flex flex-col bg-secondary/10">
            {/* Search bar */}
            <div className="px-4 pt-3 pb-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/40" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search payment terms..."
                  className="h-8 pl-8 border-border/70"
                  style={st.searchInput}
                />
              </div>
            </div>

            {/* Sub-header: Category label + Sort */}
            <div className="flex items-center justify-between px-4 pb-2 shrink-0">
              <span className="text-foreground" style={st.sectionTitle}>
                {categoryLabel}
              </span>
              <button
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                style={st.sortLabel}
                onClick={() => setSortAsc((v) => !v)}
              >
                Sort by
                <ArrowUpDown className="size-3" />
              </button>
            </div>

            {/* Card grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ scrollbarWidth: "thin" }}>
              {filteredTerms.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredTerms.map((term) => (
                    <PaymentTermCard
                      key={term.id}
                      term={term}
                      isSelected={term.id === selectedTermId}
                      onSelect={() => setSelectedTermId(term.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <Search className="size-6 text-muted-foreground/20" />
                  <span className="text-muted-foreground/60" style={st.cardDesc}>
                    No payment terms match your search
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 cursor-pointer"
            style={st.btnLabel}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 px-4 cursor-pointer"
            style={st.btnLabel}
            onClick={handleConfirm}
            disabled={!selectedTermId}
          >
            <Check className="size-3.5" />
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}