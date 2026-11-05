/* ═══════════════════════════════════════════════════════════════
   Purchase Request — 3-step wizard modal

   Design language ported verbatim from Banking's "Add Account"
   wizard (see `/tmp/banking-add-account-audit.md`). Every touch-
   point — modal chrome, stepper, section cards, field styling,
   footer buttons — is aligned with `AddAccountWizard.tsx` /
   `Step2AccountInformation.tsx` / `LinkStep3PickAccounts.tsx` from
   that repo.

   Step model:
     1  Pick items          → multi-select list from CATALOG,
                              styled like LinkStep3PickAccounts
                              (divide-y rows w/ checkbox + icon
                              tile + name/# + chips + right meta).
                              "+ Request a new item" appends an
                              inline new-item draft row.
     2  Fill in each item   → one banking-style Section card per
                              picked row. Body holds an item-state
                              banner (ATP/min/max) + a 2-col grid
                              (Qty / UOM / Estimated price /
                              Preferred vendor).
     3  Details             → shared submission fields (Need by,
                              Urgency, Reason, Reference doc,
                              Attachments) in two Section cards.

   Config-flag alt branch: opt-in per-item from Step 2's card ("Flag
   a configuration issue instead of purchasing"). When entered, all
   other selection is dropped and the wizard collapses to a single
   config-flag submit — same shape the flow had before.
   ═══════════════════════════════════════════════════════════════ */

"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardEdit,
  Package,
  Calendar,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Info,
  Paperclip,
  Link as LinkIcon,
  Plus,
  Search,
  Upload,
  X,
  Wrench,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { FONT, typography } from "./designTokens";
import { CATALOG, getVendorSuggestions, type CatalogItem, type VendorInfo } from "./catalogData";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import {
  CURRENT_USER,
  URGENCY_META,
  addPR,
  findRecentDuplicates,
  suggestUrgency,
  type PRUrgency,
  type PRConfigFlag,
  type PRAttachment,
  type PRLineItem,
} from "./prData";

/* ═══════════════════════════════════════════════════════════════
   Local types
   ═══════════════════════════════════════════════════════════════ */

interface NewItemDraft {
  /** Local id, prefixed `new-…`, used as the row key everywhere. */
  id: string;
  name: string;
  vendorNotes: string;
  referenceLink: string;
}

interface ItemFields {
  quantity: string;
  uom: string;
  estimatedPrice: string;
  preferredVendor: string;
}

type StepId = 1 | 2 | 3;

const EMPTY_FIELDS: ItemFields = {
  quantity: "",
  uom: "EA",
  estimatedPrice: "",
  preferredVendor: "",
};

/* ═══════════════════════════════════════════════════════════════
   Category tinting for item icon tiles — mirrors banking's
   subtype colour palette on `LinkStep3PickAccounts`. Cycles a
   small palette over category name so distinct categories render
   different accents without needing an explicit map for every
   value the CATALOG throws at us.
   ═══════════════════════════════════════════════════════════════ */

const CATEGORY_PALETTES: Array<{ bg: string; iconBg: string; iconColor: string; chipBg: string; chipFg: string }> = [
  { bg: "#EFF6FF", iconBg: "#DBEAFE", iconColor: "#1D4ED8", chipBg: "#EFF6FF", chipFg: "#1D4ED8" },
  { bg: "#ECFDF5", iconBg: "#D1FAE5", iconColor: "#047857", chipBg: "#ECFDF5", chipFg: "#047857" },
  { bg: "#F5F3FF", iconBg: "#EDE9FE", iconColor: "#6D28D9", chipBg: "#F5F3FF", chipFg: "#6D28D9" },
  { bg: "#FFFBEB", iconBg: "#FEF3C7", iconColor: "#A16207", chipBg: "#FFFBEB", chipFg: "#A16207" },
  { bg: "#FDF2F8", iconBg: "#FCE7F3", iconColor: "#BE185D", chipBg: "#FDF2F8", chipFg: "#BE185D" },
  { bg: "#F0F9FF", iconBg: "#E0F2FE", iconColor: "#0369A1", chipBg: "#F0F9FF", chipFg: "#0369A1" },
];

function categoryPalette(category: string) {
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) | 0;
  return CATEGORY_PALETTES[Math.abs(hash) % CATEGORY_PALETTES.length];
}

/* ═══════════════════════════════════════════════════════════════
   Design primitives — verbatim from Banking's AddAccountWizard
   (see /tmp/banking-add-account-audit.md §5).
   ═══════════════════════════════════════════════════════════════ */

/* ── SectionCard — the "GL Account Details" / "Bank details" shell.
       Header strip on `#FAFBFC` with a 24×24 `bg-primary/8` icon
       tile, 13/600 title, optional "Required" uppercase eyebrow.
       Body is `px-3 sm:px-4 py-3 sm:py-4` unless `bodyPadded={false}`
       so consumers can hang custom layouts flush. Optional action
       slot mirrors banking's "Edit Classification" small button. */

interface SectionCardProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  bodyPadded?: boolean;
  toneBorderColor?: string;
  toneHeaderBg?: string;
  toneTitleColor?: string;
  toneIconBg?: string;
  toneIconColor?: string;
  /** Item-card variant — when any of these are set, the header expands
      into a two-column layout (48×48 thumbnail on the left, stacked
      title / subtitle / description on the right). Used by the Step-2
      per-item card so buyers see part# + name + description together. */
  image?: string;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  /** Render `title` in a monospace face — part numbers read better in
      mono at any zoom level. */
  titleMono?: boolean;
}

function SectionCard({
  icon: Icon,
  title,
  eyebrow,
  action,
  children,
  bodyPadded = true,
  toneBorderColor,
  toneHeaderBg,
  toneTitleColor,
  toneIconBg,
  toneIconColor,
  image,
  subtitle,
  description,
  titleMono,
}: SectionCardProps) {
  /* Item-card variant kicks in as soon as the caller supplies any of
     the item-oriented props. Otherwise we stay on the compact single-
     line header (used by the section-title cards elsewhere in the
     wizard: "Describe the new item", "When do you need it?", …). */
  const itemVariant = Boolean(image) || Boolean(subtitle) || Boolean(description);
  return (
    <section
      className="rounded-lg border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
      style={{ borderColor: toneBorderColor ?? "hsl(var(--border))", fontFamily: FONT }}
    >
      <header
        className={`${itemVariant ? "px-3 sm:px-4 py-3 sm:py-3.5" : "px-3 sm:px-4 py-2 sm:py-2.5"} border-b flex items-start gap-3 rounded-t-lg`}
        style={{
          borderColor: toneBorderColor ?? "#EEF2F6",
          backgroundColor: toneHeaderBg ?? "#FAFBFC",
        }}
      >
        {itemVariant ? (
          <div
            className="w-11 h-11 rounded-md flex items-center justify-center shrink-0 overflow-hidden"
            style={{ backgroundColor: toneIconBg ?? "rgba(10, 119, 255, 0.08)" }}
          >
            {image ? (
              <img src={image} alt="" className="w-full h-full object-cover" />
            ) : (
              <Icon className="w-4 h-4" style={{ color: toneIconColor ?? "hsl(var(--primary))" }} />
            )}
          </div>
        ) : (
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: toneIconBg ?? "rgba(10, 119, 255, 0.08)" }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: toneIconColor ?? "hsl(var(--primary))" }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <span
            className={`${itemVariant ? "text-[14px]" : "text-[13px]"} block truncate`}
            style={{
              fontWeight: 600,
              color: toneTitleColor ?? "hsl(var(--foreground))",
              fontFamily: titleMono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
            }}
          >
            {title}
          </span>
          {subtitle && (
            <span
              className="text-[12px] block truncate mt-0.5"
              style={{ color: "hsl(var(--muted-foreground))", fontWeight: 500 }}
            >
              {subtitle}
            </span>
          )}
          {description && (
            <span
              className="text-[11.5px] block mt-1 leading-snug"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              {description}
            </span>
          )}
        </div>
        {eyebrow && (
          <span
            className="text-[9px] sm:text-[10px] text-slate-400 tracking-wider uppercase hidden min-[480px]:inline shrink-0 mt-0.5"
            style={{ fontWeight: 500, letterSpacing: "0.08em" }}
          >
            {eyebrow}
          </span>
        )}
        {action}
      </header>
      <div className={bodyPadded ? "px-3 sm:px-4 py-3 sm:py-4" : ""}>{children}</div>
    </section>
  );
}

/* ── FieldLabel — banking's 13/500 label with red `*` for required,
       grey `Optional` pill or accent `Recommended` pill, and a
       muted helper line beneath. */

function FieldLabel({
  htmlFor,
  label,
  required,
  optional,
  recommended,
  hint,
}: {
  htmlFor?: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  recommended?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label
        htmlFor={htmlFor}
        className="text-xs sm:text-[13px] text-foreground block"
        style={{ fontWeight: 500, fontFamily: FONT }}
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {optional && (
          <span
            className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] border align-middle"
            style={{
              borderColor: "hsl(var(--border))",
              backgroundColor: "#F8FAFC",
              color: "hsl(var(--muted-foreground))",
              fontWeight: 500,
              fontFamily: FONT,
            }}
          >
            Optional
          </span>
        )}
        {recommended && (
          <span
            className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] border align-middle"
            style={{
              borderColor: "hsl(var(--primary))",
              backgroundColor: "hsl(var(--accent))",
              color: "hsl(var(--primary))",
              fontWeight: 500,
              fontFamily: FONT,
            }}
          >
            Recommended
          </span>
        )}
      </label>
      {hint && (
        <p className="text-[11px] text-slate-500" style={{ fontFamily: FONT }}>
          {hint}
        </p>
      )}
    </div>
  );
}

/* ── Input class helper — banking's `!h-10 rounded-lg` recipe with
       red border/ring when in error, primary border/ring on focus
       otherwise. Consumers append their own inline `type`, `value`,
       `onChange`, etc. */

function inputClass(hasError?: boolean, extra?: string): string {
  const base =
    "mt-1 w-full rounded-lg bg-white !h-10 px-3 text-sm text-foreground placeholder:text-slate-400 transition-colors focus:outline-none border";
  const state = hasError
    ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
    : "border-border focus:border-primary focus:ring-1 focus:ring-primary/20";
  return [base, state, extra].filter(Boolean).join(" ");
}

/* ── ErrorLine — 11px red helper under a field. */

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-red-500 text-[11px] mt-1" style={{ fontFamily: FONT }}>
      {children}
    </p>
  );
}

/* ── InfoCallout — banking's blue tip strip beneath the GL number
       field. Use for hints that need more prominence than the
       11px helper. */

function InfoCallout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border px-3 py-2.5 flex items-start gap-2"
      style={{ borderColor: "rgba(10, 119, 255, 0.25)", backgroundColor: "#EFF6FF" }}
    >
      <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
      <p className="text-[11.5px] leading-snug" style={{ color: "#475569", fontFamily: FONT }}>
        {children}
      </p>
    </div>
  );
}

/* ── StepTab — banking's numbered tab-stepper with active blue /
       completed emerald / inactive slate states. Underline sits on
       the header's bottom border via `-mb-px`. Completed steps
       are clickable so buyers can jump back; forward jumps are
       gated by the parent through `clickable`. */

function StepTab({
  n,
  step,
  label,
  shortLabel,
  clickable,
  onClick,
}: {
  n: 1 | 2 | 3;
  step: StepId;
  label: string;
  shortLabel: string;
  clickable: boolean;
  onClick: () => void;
}) {
  const active = step === n;
  const completed = step > n;
  return (
    <div
      className={`relative flex items-center gap-2 pb-2.5 sm:pb-3 shrink-0 ${
        clickable ? "cursor-pointer" : "cursor-default"
      }`}
      onClick={clickable ? onClick : undefined}
    >
      <div
        className="flex items-center justify-center rounded-full shrink-0 transition-all duration-200"
        style={{
          width: 22,
          height: 22,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: FONT,
          backgroundColor: completed ? "#10B981" : active ? "hsl(var(--primary))" : "#FFFFFF",
          color: completed || active ? "#FFFFFF" : "#64748B",
          border: completed || active ? "none" : "1.5px solid #CBD5E1",
        }}
      >
        {completed ? <Check className="w-3 h-3" strokeWidth={3} /> : n}
      </div>
      <span
        className="whitespace-nowrap"
        style={{
          fontSize: 12,
          fontFamily: FONT,
          fontWeight: active || completed ? 600 : 500,
          color: active ? "hsl(var(--primary))" : completed ? "#10B981" : "#334155",
        }}
      >
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{shortLabel}</span>
      </span>
      {(active || completed) && (
        <div
          className="absolute bottom-0 left-0 right-0 rounded-t-full"
          style={{ height: 2, backgroundColor: completed ? "#10B981" : "hsl(var(--primary))" }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Item pickers & row rendering
   ═══════════════════════════════════════════════════════════════ */

/* ── ItemPickRow — multi-select list row modelled on Banking's
       `LinkStep3PickAccounts`. Checkbox + 36×36 category-tinted
       tile + name (13.5/600) + item# + category chip + Below-Min
       warning chip on the left; right-side shows current stock &
       min. Selected rows get a `bg-[#F8FBFF]` wash and a 3px blue
       left stripe. */

interface ItemPickRowProps {
  item: CatalogItem;
  selected: boolean;
  onToggle: (id: string, next: boolean) => void;
  query: string;
}

function ItemPickRow({ item, selected, onToggle, query }: ItemPickRowProps) {
  const palette = categoryPalette(item.category);
  const belowMin = item.currentStock <= item.minQuantity;
  const noStock = item.currentStock === 0;
  const displayName = item.descriptiveName.split(" — ")[0];

  return (
    <div
      className={`relative flex items-stretch gap-3 px-3 sm:px-4 py-3 transition-colors ${
        selected ? "bg-[#F8FBFF]" : "hover:bg-[#F8FBFF]/40"
      }`}
    >
      {selected && (
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
      )}
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        onClick={() => onToggle(item.id, !selected)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
      >
        <Checkbox
          checked={selected}
          onCheckedChange={(next) => onToggle(item.id, next === true)}
          className="h-[18px] w-[18px] shrink-0 pointer-events-none"
        />
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
          style={{ backgroundColor: palette.iconBg }}
        >
          {item.image ? (
            <img src={item.image} alt="" className="w-full h-full object-cover" />
          ) : (
            <Package className="w-4 h-4" style={{ color: palette.iconColor }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {/* Part number takes the main-heading slot — mono for
                legibility, same 13.5/600 the item name previously
                occupied. Category + stock chips sit alongside so
                the row still reads as one scannable unit. */}
            <p
              className="text-[13.5px] truncate font-mono"
              style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}
            >
              {highlight(item.itemNumber, query)}
            </p>
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10.5px] shrink-0"
              style={{ backgroundColor: palette.chipBg, color: palette.chipFg, fontWeight: 600, fontFamily: FONT }}
            >
              {item.category}
            </span>
            {noStock && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10.5px] shrink-0"
                style={{ backgroundColor: "#FEF2F2", color: "#B91C1C", fontWeight: 600, fontFamily: FONT }}
              >
                Out of stock
              </span>
            )}
            {!noStock && belowMin && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10.5px] shrink-0"
                style={{ backgroundColor: "#FFFBEB", color: "#92400E", fontWeight: 600, fontFamily: FONT }}
              >
                <AlertTriangle className="w-2.5 h-2.5" strokeWidth={2.5} />
                Below min
              </span>
            )}
          </div>
          {/* Item name is now the sub-heading. Partner location keeps
              its slot on the same line, separated by a middle-dot. */}
          <p
            className="text-[11.5px] mt-0.5 truncate"
            style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
          >
            {highlight(displayName, query)}
            {item.partnerLocation && (
              <>
                <span className="mx-1 text-muted-foreground/50">·</span>
                <span>{item.partnerLocation}</span>
              </>
            )}
          </p>
        </div>
      </button>
      <div className="flex flex-col items-end justify-center shrink-0 pl-2">
        <span
          className="text-[13px] tabular-nums"
          style={{
            fontWeight: 600,
            fontFamily: FONT,
            color: belowMin ? "#B45309" : "hsl(var(--foreground))",
          }}
        >
          {item.currentStock} {item.defaultUOM}
        </span>
        <span
          className="text-[10px]"
          style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
        >
          on hand · min {item.minQuantity}
        </span>
      </div>
    </div>
  );
}

/* ── highlight — tiny helper that wraps matched substrings in a
       primary-tinted underlay so the search filter shows what's
       being matched inline. */

function highlight(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark style={{ backgroundColor: "rgba(10,119,255,0.14)", color: "inherit", padding: 0 }}>
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
}

/* ── VendorPicker — searchable list of qualified vendors + free-
       text fallback. Kept from the previous form because Banking
       has no direct analogue; restyled input chrome to match the
       banking `!h-10 rounded-lg` recipe. */

interface VendorPickerProps {
  value: string;
  onChange: (name: string) => void;
  primaryFor?: string;
  hasError?: boolean;
}

function VendorPicker({ value, onChange, primaryFor, hasError }: VendorPickerProps) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const allVendors = useMemo<VendorInfo[]>(() => getVendorSuggestions(), []);

  const results = useMemo(() => {
    const primaryFirst = primaryFor
      ? [
          ...allVendors.filter((v) => v.name === primaryFor),
          ...allVendors.filter((v) => v.name !== primaryFor),
        ]
      : allVendors;
    const needle = q.trim().toLowerCase();
    if (!needle) return primaryFirst.slice(0, 8);
    return primaryFirst
      .filter(
        (v) =>
          v.name.toLowerCase().includes(needle) ||
          v.abbr.toLowerCase().includes(needle) ||
          v.categories.some((c) => c.toLowerCase().includes(needle)),
      )
      .slice(0, 8);
  }, [allVendors, q, primaryFor]);

  const picked = useMemo(
    () => (value ? allVendors.find((v) => v.name === value) : undefined),
    [allVendors, value],
  );
  const showAsCustom = !!value && !picked;

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const hasCustomTypedValue =
    q.trim().length > 0 &&
    !allVendors.some((v) => v.name.toLowerCase() === q.trim().toLowerCase());

  if (picked || showAsCustom) {
    return (
      <div
        className={`flex items-center justify-between gap-3 rounded-lg border !h-10 px-3 bg-white mt-1 ${
          hasError ? "border-red-500" : "border-border"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{
              backgroundColor: "hsl(var(--accent))",
              color: "hsl(var(--primary))",
              fontFamily: FONT,
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {picked?.abbr ?? value.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0 leading-tight">
            <span
              className="truncate text-[13px]"
              style={{ fontFamily: FONT, color: "hsl(var(--foreground))", fontWeight: 500 }}
            >
              {value}
            </span>
            {picked ? (
              <span className="truncate text-[10.5px] text-slate-500" style={{ fontFamily: FONT }}>
                {picked.itemCount} item{picked.itemCount === 1 ? "" : "s"}
                {picked.categories.length > 0 && ` · ${picked.categories.slice(0, 2).join(" · ")}`}
              </span>
            ) : (
              <span className="truncate text-[10.5px] text-slate-500" style={{ fontFamily: FONT }}>
                Custom vendor — not in the qualified list
              </span>
            )}
          </div>
          {picked && primaryFor === picked.name && (
            <span
              className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px]"
              style={{
                backgroundColor: "hsl(var(--accent))",
                color: "hsl(var(--primary))",
                fontFamily: FONT,
                fontWeight: 600,
              }}
            >
              Primary
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onChange("");
            setQ("");
            setOpen(false);
          }}
          className="text-slate-400 hover:text-slate-600 shrink-0"
          aria-label="Clear vendor"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative mt-1">
      <div
        className={`flex items-center gap-2 rounded-lg border !h-10 px-3 bg-white focus-within:ring-1 ${
          hasError
            ? "border-red-500 focus-within:border-red-500 focus-within:ring-red-500/20"
            : "border-border focus-within:border-primary focus-within:ring-primary/20"
        }`}
      >
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search from qualified vendors…"
          className="flex-1 outline-none bg-transparent text-sm placeholder:text-slate-400"
          style={{ fontFamily: FONT }}
        />
      </div>
      {open && (
        <div
          className="absolute z-30 top-full left-0 right-0 mt-1 rounded-lg border bg-white shadow-lg overflow-hidden"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          {!q.trim() && (
            <div
              className="px-3 py-1.5"
              style={{
                backgroundColor: "hsl(var(--muted))",
                borderBottom: "1px solid hsl(var(--border))",
              }}
            >
              <span
                className="text-[10px] uppercase"
                style={{
                  color: "hsl(var(--muted-foreground))",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  fontFamily: FONT,
                }}
              >
                Suggested vendors
              </span>
            </div>
          )}
          <div className="max-h-[240px] overflow-y-auto">
            {results.length === 0 ? (
              <div
                className="px-3 py-4 text-center text-[13px] text-muted-foreground"
                style={{ fontFamily: FONT }}
              >
                No vendors match "{q}"
              </div>
            ) : (
              results.map((v) => {
                const isPrimary = primaryFor === v.name;
                return (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => {
                      onChange(v.name);
                      setOpen(false);
                    }}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-slate-50"
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: "hsl(var(--accent))",
                        color: "hsl(var(--primary))",
                        fontFamily: FONT,
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      {v.abbr}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="truncate text-[13px]"
                          style={{
                            fontFamily: FONT,
                            color: "hsl(var(--foreground))",
                            fontWeight: 500,
                          }}
                        >
                          {v.name}
                        </span>
                        {isPrimary && (
                          <span
                            className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px]"
                            style={{
                              backgroundColor: "hsl(var(--accent))",
                              color: "hsl(var(--primary))",
                              fontFamily: FONT,
                              fontWeight: 600,
                            }}
                          >
                            Primary
                          </span>
                        )}
                      </div>
                      <span
                        className="truncate text-[11px] text-slate-500"
                        style={{ fontFamily: FONT }}
                      >
                        {v.itemCount} item{v.itemCount === 1 ? "" : "s"}
                        {v.categories.length > 0 && ` · ${v.categories.slice(0, 2).join(" · ")}`}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          {hasCustomTypedValue && (
            <div
              className="border-t px-3 py-2"
              style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--muted))" }}
            >
              <button
                type="button"
                onClick={() => {
                  onChange(q.trim());
                  setQ("");
                  setOpen(false);
                }}
                className="text-[12px] inline-flex items-center gap-1.5"
                style={{ color: "hsl(var(--primary))", fontFamily: FONT, fontWeight: 600 }}
              >
                + Use "{q.trim()}" as a custom vendor
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── ItemStateBanner — reusable ATP / min / max strip. Renders as
       a slim h-9 pill inside the per-item Section card body so
       it doesn't compete with the fields below. Same shape as
       the previous form's banner. */

function ItemStateBanner({ item }: { item: CatalogItem }) {
  const atMin = item.currentStock <= item.minQuantity;
  const maxTarget = item.minQuantity * 5;
  return (
    <div
      className="rounded-lg border px-3 h-9 flex items-center gap-3 shrink-0"
      style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}
    >
      <div className="flex items-center gap-1.5 shrink-0">
        <Info className="w-3.5 h-3.5 text-slate-400" />
        <span
          className="text-[11px]"
          style={{ fontWeight: 600, color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
        >
          Current stock
        </span>
      </div>
      <div className="w-px h-4 bg-border shrink-0" />
      <div className="flex items-center gap-4 flex-1 min-w-0 overflow-hidden">
        <span className="text-[12px]" style={{ fontFamily: FONT, color: "hsl(var(--foreground))" }}>
          <span className="text-slate-500">ATP </span>
          <span style={{ fontWeight: 600, color: atMin ? "#B45309" : undefined }}>
            {item.currentStock} {item.defaultUOM}
          </span>
        </span>
        <span className="text-[12px]" style={{ fontFamily: FONT, color: "hsl(var(--foreground))" }}>
          <span className="text-slate-500">Min </span>
          <span style={{ fontWeight: 600 }}>
            {item.minQuantity} {item.defaultUOM}
          </span>
        </span>
        <span
          className="text-[12px] hidden sm:inline"
          style={{ fontFamily: FONT, color: "hsl(var(--foreground))" }}
        >
          <span className="text-slate-500">Max </span>
          <span style={{ fontWeight: 600 }}>
            {maxTarget} {item.defaultUOM}
          </span>
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Urgency picker + Config-flag block — kept from the previous
   form. Config-flag chrome updated to use InfoCallout instead of
   an inline amber card so it matches banking's callout recipe.
   ═══════════════════════════════════════════════════════════════ */

const CONFIG_OPTIONS: {
  key: PRConfigFlag["target"];
  label: string;
  currentFrom: (i?: CatalogItem) => string;
}[] = [
  { key: "min-stock", label: "Minimum stock level", currentFrom: (i) => (i ? `${i.minQuantity} ${i.defaultUOM}` : "—") },
  { key: "max-stock", label: "Maximum stock level", currentFrom: (i) => (i ? `${i.minQuantity * 5} ${i.defaultUOM}` : "—") },
  { key: "on-hand", label: "On-hand count", currentFrom: (i) => (i ? `${i.currentStock} ${i.defaultUOM}` : "—") },
  { key: "vendor-info", label: "Vendor information", currentFrom: (i) => i?.partnerLocation || "—" },
  { key: "other", label: "Other", currentFrom: () => "—" },
];

function UrgencyPicker({
  value,
  onChange,
  suggested,
}: {
  value: PRUrgency;
  onChange: (u: PRUrgency) => void;
  suggested: PRUrgency | null;
}) {
  const options: PRUrgency[] = ["high", "standard", "low"];
  return (
    <div className="flex flex-col gap-2 mt-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        {options.map((o) => {
          const meta = URGENCY_META[o];
          const active = value === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border transition-colors"
              style={{
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                backgroundColor: active ? meta.bg : "hsl(var(--card))",
                color: active ? meta.fg : "hsl(var(--muted-foreground))",
                borderColor: active ? meta.border : "hsl(var(--border))",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: active ? meta.fg : "hsl(var(--muted-foreground))" }}
              />
              {meta.label}
            </button>
          );
        })}
        {suggested && suggested !== value && (
          <button
            type="button"
            onClick={() => onChange(suggested)}
            className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-full"
            style={{
              backgroundColor: "hsl(var(--accent))",
              color: "hsl(var(--primary))",
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 600,
            }}
            title={`Based on your need-by date, ${URGENCY_META[suggested].label} is a better fit`}
          >
            <Sparkles className="w-3 h-3" />
            Suggest {URGENCY_META[suggested].label}
          </button>
        )}
      </div>
      <p className="text-[11px] text-slate-500" style={{ fontFamily: FONT }}>
        {URGENCY_META[value].hint}
      </p>
    </div>
  );
}

function ConfigFlagBlock({
  item,
  autoTriggered,
  value,
  onChange,
  showErrors,
}: {
  item?: CatalogItem;
  autoTriggered: boolean;
  value: PRConfigFlag;
  onChange: (v: PRConfigFlag) => void;
  showErrors: boolean;
}) {
  const [selectOpen, setSelectOpen] = useState(false);
  const currentDisplay =
    CONFIG_OPTIONS.find((o) => o.key === value.target)?.currentFrom(item) ?? "—";

  const correctError = showErrors && !value.correctValue.trim() ? "Enter the correct value." : null;
  const explanationError =
    showErrors && !value.explanation.trim() ? "Explain what's misconfigured." : null;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-lg border px-3 h-9 flex items-center gap-2 shrink-0"
        style={{ borderColor: "#FDE68A", backgroundColor: "rgba(254, 243, 199, 0.5)" }}
      >
        <Wrench className="w-3.5 h-3.5 shrink-0" style={{ color: "#B45309" }} />
        <p
          className="text-[11px] truncate flex-1 min-w-0"
          style={{ color: "#78350F", fontFamily: FONT }}
        >
          {autoTriggered ? (
            <>
              <span style={{ fontWeight: 600 }}>Purchase blocked.</span> This item is already
              flagged Below Minimum — file a configuration issue instead.
            </>
          ) : (
            <>
              <span style={{ fontWeight: 600 }}>Flag a configuration issue.</span> Tell the buyer
              what's misconfigured — this replaces the purchase ask.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <FieldLabel label="What is incorrect?" required />
          <div className="relative">
            <button
              type="button"
              onClick={() => setSelectOpen((v) => !v)}
              className="mt-1 w-full flex items-center justify-between rounded-lg border !h-10 px-3 bg-white text-left"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <span
                className="text-sm"
                style={{ color: "hsl(var(--foreground))", fontFamily: FONT }}
              >
                {CONFIG_OPTIONS.find((o) => o.key === value.target)?.label ?? "Select…"}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
            {selectOpen && (
              <div
                className="absolute z-30 top-full left-0 right-0 mt-1 rounded-lg border bg-white shadow-lg overflow-hidden"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                {CONFIG_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => {
                      onChange({ ...value, target: o.key });
                      setSelectOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span
                      className="text-sm"
                      style={{ color: "hsl(var(--foreground))", fontFamily: FONT }}
                    >
                      {o.label}
                    </span>
                    {value.target === o.key && (
                      <Check
                        className="w-3.5 h-3.5"
                        style={{ color: "hsl(var(--primary))" }}
                        strokeWidth={2.5}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3">
          <div>
            <FieldLabel label="What the system currently shows" />
            <div
              className="mt-1 rounded-lg border !h-10 px-3 bg-slate-50 flex items-center"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <span
                className="text-sm"
                style={{ color: "hsl(var(--foreground))", fontFamily: FONT }}
              >
                {currentDisplay}
              </span>
            </div>
          </div>
          <div>
            <FieldLabel label="What it should be" required />
            <input
              type="text"
              value={value.correctValue}
              onChange={(e) => onChange({ ...value, correctValue: e.target.value })}
              placeholder="Enter the correct value…"
              className={inputClass(!!correctError)}
              aria-invalid={!!correctError}
            />
            {correctError && <ErrorLine>{correctError}</ErrorLine>}
          </div>
        </div>

        <div>
          <FieldLabel label="Explanation" required />
          <textarea
            value={value.explanation}
            onChange={(e) => onChange({ ...value, explanation: e.target.value })}
            placeholder="Why is this configuration incorrect? What have you observed on the floor…"
            rows={3}
            className={`mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm text-foreground placeholder:text-slate-400 transition-colors focus:outline-none border resize-y ${
              explanationError
                ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
                : "border-border focus:border-primary focus:ring-1 focus:ring-primary/20"
            }`}
            style={{ fontFamily: FONT }}
            aria-invalid={!!explanationError}
          />
          {explanationError && <ErrorLine>{explanationError}</ErrorLine>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════════════ */

export interface PurchaseRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (prId: string) => void;
  /** Which Step-1 surface to show first when the modal opens.
      "catalog" (default) shows the catalogue picker; "new-item"
      opens with the new-item form already expanded so buyers who
      chose "New item (not on file)" upstream don't have to click
      through to it. */
  initialFocus?: "catalog" | "new-item";
  /** Catalogue item ids to preseed the picker with. Used when the
      buyer picked items in the PurchaseSearchModal upstream — we
      skip Step 1 entirely so they land on the fill-details step
      for their picks (see `initialStep`). Reset effect honours this
      on each `open` transition. */
  initialSelectedCatalogIds?: string[];
  /** Which step to open on. Defaults to 1. Callers that preseed
      picks via `initialSelectedCatalogIds` should pass 2. */
  initialStep?: 1 | 2 | 3;
}

export default function PurchaseRequestModal({
  open,
  onOpenChange,
  onSuccess,
  initialFocus = "catalog",
  initialSelectedCatalogIds,
  initialStep = 1,
}: PurchaseRequestModalProps) {
  /* ── Step 1 selection ─────────────────────────────────────── */
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<Set<string>>(new Set());
  const [newItemDrafts, setNewItemDrafts] = useState<NewItemDraft[]>([]);

  /* ── Per-row Step-2 fields — keyed by catalog id or new-item
        local id. Initialised lazily when a row is first opened
        (see `getRowFields`). Preserving state across step
        transitions means switching back to Step 1 doesn't wipe
        the fields the buyer already typed. */
  const [perRowFields, setPerRowFields] = useState<Record<string, ItemFields>>({});

  /* ── Step 1 UI ─────────────────────────────────────────────── */
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemDraft, setNewItemDraft] = useState({ name: "", vendorNotes: "", referenceLink: "" });

  /* ── Step 3 shared fields ───────────────────────────────── */
  const [needBy, setNeedBy] = useState("");
  const [urgency, setUrgency] = useState<PRUrgency>("standard");
  const [reason, setReason] = useState("");
  const [referenceDoc, setReferenceDoc] = useState("");
  const [attachments, setAttachments] = useState<PRAttachment[]>([]);

  /* ── Config-flag alt branch ────────────────────────────── */
  const [configFlagItemId, setConfigFlagItemId] = useState<string | null>(null);
  const [configFlag, setConfigFlag] = useState<PRConfigFlag>({
    target: "min-stock",
    currentValue: "",
    correctValue: "",
    explanation: "",
  });

  /* ── Wizard state ─────────────────────────────────────────── */
  const [step, setStep] = useState<StepId>(1);
  const [triedSteps, setTriedSteps] = useState<Set<StepId>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const inConfigMode = configFlagItemId !== null;
  const configFlagItem = useMemo(
    () => (configFlagItemId ? CATALOG.find((c) => c.id === configFlagItemId) : undefined),
    [configFlagItemId],
  );

  /* Reset on open — same guard as before, prevents stale state
     from leaking into a fresh request. */
  React.useEffect(() => {
    if (!open) return;
    setSelectedCatalogIds(new Set(initialSelectedCatalogIds ?? []));
    setNewItemDrafts([]);
    setPerRowFields({});
    setSearchQuery("");
    setShowNewItemForm(initialFocus === "new-item");
    setNewItemDraft({ name: "", vendorNotes: "", referenceLink: "" });
    setNeedBy("");
    setUrgency("standard");
    setReason("");
    setReferenceDoc("");
    setAttachments([]);
    setConfigFlagItemId(null);
    setConfigFlag({ target: "min-stock", currentValue: "", correctValue: "", explanation: "" });
    setStep(initialStep);
    setTriedSteps(new Set());
    setSubmitting(false);
  }, [open]);

  /* ── Derived data ─────────────────────────────────────────── */

  /* Preserve insertion order — Set iteration order is guaranteed
     in JS runtimes. `CATALOG` order is used as the fallback when
     nothing's picked yet (for the Step 1 render). */
  const selectedCatalogItems = useMemo(
    () =>
      Array.from(selectedCatalogIds)
        .map((id) => CATALOG.find((c) => c.id === id))
        .filter((x): x is CatalogItem => !!x),
    [selectedCatalogIds],
  );

  /* Step 2 iterates all rows: new-item drafts first, then catalog
     items in the order the buyer picked them. */
  const allRows = useMemo(
    () => [
      ...newItemDrafts.map((d) => ({ kind: "new" as const, id: d.id, draft: d })),
      ...selectedCatalogItems.map((c) => ({ kind: "catalog" as const, id: c.id, item: c })),
    ],
    [newItemDrafts, selectedCatalogItems],
  );

  const totalPicked = selectedCatalogIds.size + newItemDrafts.length;

  const filteredCatalog = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return CATALOG;
    return CATALOG.filter(
      (c) =>
        c.descriptiveName.toLowerCase().includes(needle) ||
        c.itemNumber.toLowerCase().includes(needle) ||
        c.category.toLowerCase().includes(needle) ||
        c.partnerLocation.toLowerCase().includes(needle),
    );
  }, [searchQuery]);

  const allFilteredSelected =
    filteredCatalog.length > 0 && filteredCatalog.every((c) => selectedCatalogIds.has(c.id));

  const getRowFields = (rowId: string): ItemFields => perRowFields[rowId] ?? EMPTY_FIELDS;

  const patchRowFields = (rowId: string, patch: Partial<ItemFields>) => {
    setPerRowFields((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] ?? EMPTY_FIELDS), ...patch },
    }));
  };

  const suggestedUrgency = useMemo(() => {
    const firstCat = selectedCatalogItems[0];
    return suggestUrgency({
      needByISO: needBy || undefined,
      currentStock: firstCat?.currentStock,
      minStock: firstCat?.minQuantity,
    });
  }, [needBy, selectedCatalogItems]);

  const duplicates = useMemo(() => {
    const items = selectedCatalogItems.slice(0, 1);
    if (items.length === 0) return [];
    return findRecentDuplicates(items[0].id);
  }, [selectedCatalogItems]);

  /* ── Validation ────────────────────────────────────────── */

  const step1Valid = inConfigMode ? true : totalPicked > 0;

  const step2Errors = useMemo(() => {
    if (inConfigMode) return {} as Record<string, { qty?: string; name?: string }>;
    const errors: Record<string, { qty?: string; name?: string }> = {};
    for (const row of allRows) {
      const f = getRowFields(row.id);
      const qtyNum = parseFloat(f.quantity);
      const rowErrors: { qty?: string; name?: string } = {};
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) rowErrors.qty = "Enter a quantity.";
      if (row.kind === "new" && !row.draft.name.trim())
        rowErrors.name = "Give the item a name.";
      if (rowErrors.qty || rowErrors.name) errors[row.id] = rowErrors;
    }
    return errors;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, perRowFields, inConfigMode, newItemDrafts]);

  const step2Valid = Object.keys(step2Errors).length === 0 && totalPicked > 0;

  const step3Errors = useMemo(() => {
    const errors: { needBy?: string; reason?: string } = {};
    if (!needBy) errors.needBy = "Pick when you need it.";
    if (reason.trim().length < 10) errors.reason = "Add a short reason — at least 10 characters.";
    return errors;
  }, [needBy, reason]);

  const step3Valid = Object.keys(step3Errors).length === 0;

  const configFlagValid =
    configFlag.correctValue.trim().length > 0 && configFlag.explanation.trim().length > 0;

  const canSubmit = inConfigMode
    ? configFlagValid
    : step1Valid && step2Valid && step3Valid;

  /* ── Mutators ─────────────────────────────────────────── */

  const toggleCatalog = (id: string, next: boolean) => {
    setSelectedCatalogIds((prev) => {
      const n = new Set(prev);
      if (next) n.add(id);
      else n.delete(id);
      return n;
    });
    /* Seed a fresh fields blank when first selected so the UOM
       shows through immediately on Step 2 — otherwise the UOM
       cell stays empty until the user tabs into another field. */
    if (next && !perRowFields[id]) {
      const item = CATALOG.find((c) => c.id === id);
      setPerRowFields((prev) => ({
        ...prev,
        [id]: {
          ...EMPTY_FIELDS,
          uom: item?.defaultUOM || "EA",
          preferredVendor: item?.partnerLocation || "",
        },
      }));
    }
  };

  const selectAllFiltered = () => {
    setSelectedCatalogIds((prev) => {
      const n = new Set(prev);
      filteredCatalog.forEach((c) => n.add(c.id));
      return n;
    });
    /* Seed fields for any newly-selected items so their UOM/vendor
       defaults surface on Step 2 without the user having to open
       each row first. */
    setPerRowFields((prev) => {
      const next = { ...prev };
      for (const c of filteredCatalog) {
        if (!next[c.id]) {
          next[c.id] = {
            ...EMPTY_FIELDS,
            uom: c.defaultUOM || "EA",
            preferredVendor: c.partnerLocation || "",
          };
        }
      }
      return next;
    });
  };

  const clearFiltered = () => {
    setSelectedCatalogIds((prev) => {
      const n = new Set(prev);
      filteredCatalog.forEach((c) => n.delete(c.id));
      return n;
    });
  };

  const commitNewItemDraft = () => {
    const name = newItemDraft.name.trim();
    if (!name) return;
    const id = `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setNewItemDrafts((prev) => [
      ...prev,
      {
        id,
        name,
        vendorNotes: newItemDraft.vendorNotes.trim(),
        referenceLink: newItemDraft.referenceLink.trim(),
      },
    ]);
    setPerRowFields((prev) => ({ ...prev, [id]: EMPTY_FIELDS }));
    setNewItemDraft({ name: "", vendorNotes: "", referenceLink: "" });
    // In "new-item" focus mode Step 1 has no catalogue picker to fall
    // back to — collapsing the form would leave the buyer looking at
    // an empty screen. Keep the form open so they can immediately
    // describe another new item; committed drafts render above.
    setShowNewItemForm(initialFocus === "new-item");
  };

  const removeNewItemDraft = (id: string) => {
    setNewItemDrafts((prev) => prev.filter((d) => d.id !== id));
    setPerRowFields((prev) => {
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
  };

  const removeRow = (rowId: string) => {
    if (rowId.startsWith("new-")) removeNewItemDraft(rowId);
    else toggleCatalog(rowId, false);
  };

  const flagItemAsConfig = (rowId: string) => {
    if (rowId.startsWith("new-")) return; // new items can't be flagged
    setConfigFlagItemId(rowId);
    setStep(1); // config flag is single-step
  };

  const exitConfigMode = () => {
    setConfigFlagItemId(null);
    setConfigFlag({ target: "min-stock", currentValue: "", correctValue: "", explanation: "" });
  };

  /* ── Step navigation ─────────────────────────────────── */

  const tryAdvance = () => {
    if (step === 1) {
      if (!step1Valid) {
        setTriedSteps((prev) => new Set(prev).add(1));
        toast.error("Pick at least one item to continue.");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!step2Valid) {
        setTriedSteps((prev) => new Set(prev).add(2));
        toast.error("Fill in every item's quantity to continue.");
        return;
      }
      setStep(3);
      return;
    }
  };

  const goBack = () => {
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  };

  /* ── Submit ─────────────────────────────────────────── */

  const handleSubmit = () => {
    if (!canSubmit) {
      /* Mark the current step tried so the user sees the inline
         errors that block them. */
      setTriedSteps((prev) => new Set(prev).add(step));
      if (inConfigMode) {
        toast.error("Fill in the flag details to submit.");
      } else if (!step1Valid) toast.error("Pick at least one item to continue.");
      else if (!step2Valid) toast.error("Fill in every item's quantity to continue.");
      else toast.error("Add a need-by date and short reason.");
      return;
    }
    setSubmitting(true);

    setTimeout(() => {
      if (inConfigMode) {
        const flagLineItem: PRLineItem = {
          id: `li-flag-${Date.now()}`,
          itemId: configFlagItem?.id,
          isNewItem: false,
          quantity: 0,
          uom: configFlagItem?.defaultUOM || "EA",
        };
        const record = addPR({
          lineItems: [flagLineItem],
          needBy: new Date().toISOString().slice(0, 10),
          urgency: "standard",
          reason: `Configuration flag raised: ${configFlag.explanation.trim()}`,
          attachments: [],
          configFlag,
        });
        toast.success("Configuration flag submitted", {
          description: `${record.id} sent to the buyer for review`,
          style: { fontFamily: FONT },
        });
        onOpenChange(false);
        onSuccess?.(record.id);
        return;
      }

      const lineItems: PRLineItem[] = allRows.map((row, idx) => {
        const f = getRowFields(row.id);
        if (row.kind === "new") {
          return {
            id: `li-new-${Date.now()}-${idx}`,
            isNewItem: true,
            newItemName: row.draft.name,
            newItemVendorNotes: row.draft.vendorNotes || undefined,
            referenceLinkOrFile: row.draft.referenceLink || undefined,
            quantity: parseFloat(f.quantity) || 0,
            uom: f.uom || "EA",
            estimatedUnitPrice: f.estimatedPrice ? parseFloat(f.estimatedPrice) : undefined,
            preferredVendor: f.preferredVendor || undefined,
          };
        }
        return {
          id: `li-cat-${row.id}-${idx}`,
          itemId: row.id,
          isNewItem: false,
          quantity: parseFloat(f.quantity) || 0,
          uom: f.uom || row.item.defaultUOM || "EA",
          estimatedUnitPrice: f.estimatedPrice ? parseFloat(f.estimatedPrice) : undefined,
          preferredVendor: f.preferredVendor || undefined,
        };
      });

      const record = addPR({
        lineItems,
        needBy,
        urgency,
        reason: reason.trim(),
        referenceDoc: referenceDoc.trim() || undefined,
        attachments,
      });
      toast.success(
        lineItems.length === 1
          ? "Purchase request submitted"
          : `Purchase request submitted with ${lineItems.length} items`,
        {
          description: `${record.id} is waiting for buyer review`,
          style: { fontFamily: FONT },
        },
      );
      onOpenChange(false);
      onSuccess?.(record.id);
    }, 250);
  };

  const handleAttach = (file: File) => {
    setAttachments((prev) => [
      ...prev,
      { id: `att-${Date.now()}`, filename: file.name, sizeKb: Math.round(file.size / 1024) },
    ]);
  };

  /* ═══════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════ */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[210] flex flex-col gap-0 overflow-hidden border-0 p-0 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.05)] [&>button.absolute]:hidden"
        style={{
          maxWidth: "min(70vw, 1040px)",
          width: "calc(100% - 2rem)",
          maxHeight: "min(90vh, 78vh)",
          borderRadius: 16,
          fontFamily: FONT,
          backgroundColor: "hsl(var(--card))",
        }}
      >
        <DialogTitle className="sr-only">Raise a Purchase Request</DialogTitle>
        <DialogDescription className="sr-only">
          Pick the items you need, tell the buyer how much and when — they'll take it from there.
        </DialogDescription>

        {/* ══════════ HEADER ══════════ */}
        <div
          className="px-4 sm:px-5 pt-4 pb-0 shrink-0 bg-card border-b"
          style={{ borderColor: "#EEF2F6" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                className="text-[15px] sm:text-[17px] text-foreground"
                style={{ fontWeight: 700, fontFamily: FONT }}
              >
                Raise a Purchase Request
              </h2>
              <p
                className="text-[11px] sm:text-xs text-slate-500 mt-0.5"
                style={{ fontFamily: FONT }}
              >
                {inConfigMode
                  ? "This item is already flagged — file a configuration issue instead."
                  : "Pick the items you need, tell the buyer how much and when — they'll take it from there."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!inConfigMode && (
            <div className="flex items-center gap-3 sm:gap-5 mt-3 sm:mt-3.5 overflow-x-auto -mb-px">
              <StepTab
                n={1}
                step={step}
                label="Pick items"
                shortLabel="Pick"
                clickable={step > 1}
                onClick={() => setStep(1)}
              />
              <StepTab
                n={2}
                step={step}
                label="Fill in each item"
                shortLabel="Fill in"
                clickable={step > 2}
                onClick={() => {
                  if (step > 2) setStep(2);
                }}
              />
              <StepTab
                n={3}
                step={step}
                label="Details"
                shortLabel="Details"
                clickable={false}
                onClick={() => {}}
              />
            </div>
          )}
        </div>

        {/* ══════════ BODY ══════════ */}
        <div
          className="flex-1 min-h-0 overflow-y-auto"
          style={{ backgroundColor: "#FAFBFC" }}
        >
          <div className="px-4 sm:px-5 lg:px-6 pt-4 pb-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={inConfigMode ? "config" : `step-${step}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex flex-col gap-3 sm:gap-4"
              >
                {inConfigMode ? (
                  <ConfigFlagStepBody
                    item={configFlagItem}
                    value={configFlag}
                    onChange={setConfigFlag}
                    showErrors={triedSteps.has(1)}
                    onExit={exitConfigMode}
                  />
                ) : step === 1 ? (
                  <Step1PickItems
                    focusMode={initialFocus}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    filteredCatalog={filteredCatalog}
                    selectedCatalogIds={selectedCatalogIds}
                    onToggle={toggleCatalog}
                    allFilteredSelected={allFilteredSelected}
                    onSelectAll={selectAllFiltered}
                    onClearAll={clearFiltered}
                    totalPicked={totalPicked}
                    newItemDrafts={newItemDrafts}
                    onRemoveNewItemDraft={removeNewItemDraft}
                    showNewItemForm={showNewItemForm}
                    onOpenNewItemForm={() => setShowNewItemForm(true)}
                    onCancelNewItemForm={() => {
                      setShowNewItemForm(false);
                      setNewItemDraft({ name: "", vendorNotes: "", referenceLink: "" });
                    }}
                    newItemDraft={newItemDraft}
                    onNewItemDraftChange={setNewItemDraft}
                    onCommitNewItemDraft={commitNewItemDraft}
                    showErrors={triedSteps.has(1)}
                  />
                ) : step === 2 ? (
                  <Step2FillItems
                    rows={allRows}
                    getFields={getRowFields}
                    patchFields={patchRowFields}
                    onRemoveRow={removeRow}
                    onFlagAsConfig={flagItemAsConfig}
                    errors={step2Errors}
                    showErrors={triedSteps.has(2)}
                    duplicates={duplicates}
                  />
                ) : (
                  <Step3Details
                    rows={allRows}
                    needBy={needBy}
                    onNeedByChange={setNeedBy}
                    urgency={urgency}
                    onUrgencyChange={setUrgency}
                    suggestedUrgency={suggestedUrgency}
                    reason={reason}
                    onReasonChange={setReason}
                    referenceDoc={referenceDoc}
                    onReferenceDocChange={setReferenceDoc}
                    attachments={attachments}
                    onAttach={handleAttach}
                    onRemoveAttachment={(id) =>
                      setAttachments((prev) => prev.filter((a) => a.id !== id))
                    }
                    errors={step3Errors}
                    showErrors={triedSteps.has(3)}
                    onEditItems={() => setStep(1)}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ══════════ FOOTER ══════════ */}
        <div
          className="shrink-0 border-t px-4 sm:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 bg-card sm:rounded-b-2xl"
          style={{ borderColor: "#EEF2F6" }}
        >
          {(step > 1 || inConfigMode) && (
            <button
              type="button"
              onClick={inConfigMode ? exitConfigMode : goBack}
              className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] text-slate-500 hover:text-foreground transition-colors mr-auto cursor-pointer"
              style={{ fontWeight: 500, fontFamily: FONT }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border text-slate-500 hover:text-foreground hover:border-slate-300 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9"
          >
            Cancel
          </Button>
          {inConfigMode ? (
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              {submitting ? "Submitting…" : "Submit flag"}
            </Button>
          ) : step < 3 ? (
            <Button
              onClick={tryAdvance}
              className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm"
            >
              Continue
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Step 1 body — multi-select pick list
   ═══════════════════════════════════════════════════════════════ */

interface Step1Props {
  /** "catalog" (default) shows both the catalogue picker and the
      new-item CTA. "new-item" collapses Step 1 to the new-item form
      only — the buyer arrived from the New Request → New item card
      and shouldn't be dropped back into the catalogue picker. */
  focusMode?: "catalog" | "new-item";
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filteredCatalog: CatalogItem[];
  selectedCatalogIds: Set<string>;
  onToggle: (id: string, next: boolean) => void;
  allFilteredSelected: boolean;
  onSelectAll: () => void;
  onClearAll: () => void;
  totalPicked: number;
  newItemDrafts: NewItemDraft[];
  onRemoveNewItemDraft: (id: string) => void;
  showNewItemForm: boolean;
  onOpenNewItemForm: () => void;
  onCancelNewItemForm: () => void;
  newItemDraft: { name: string; vendorNotes: string; referenceLink: string };
  onNewItemDraftChange: (v: { name: string; vendorNotes: string; referenceLink: string }) => void;
  onCommitNewItemDraft: () => void;
  showErrors: boolean;
}

function Step1PickItems(props: Step1Props) {
  const {
    focusMode = "catalog",
    searchQuery,
    onSearchChange,
    filteredCatalog,
    selectedCatalogIds,
    onToggle,
    allFilteredSelected,
    onSelectAll,
    onClearAll,
    totalPicked,
    newItemDrafts,
    onRemoveNewItemDraft,
    showNewItemForm,
    onOpenNewItemForm,
    onCancelNewItemForm,
    newItemDraft,
    onNewItemDraftChange,
    onCommitNewItemDraft,
    showErrors,
  } = props;

  const isNewItemMode = focusMode === "new-item";
  const nothingSelectedError = showErrors && totalPicked === 0;

  /* ── New-item focus mode ──
     Skip the catalogue picker entirely and land the buyer straight
     on the "Describe the new item" surface. Committed drafts render
     as a pinned list at the top so the buyer sees what they've
     already added; the form below stays permanently expanded. */
  if (isNewItemMode) {
    return (
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h3
            className="text-base"
            style={{ fontWeight: 600, fontFamily: FONT, color: "hsl(var(--foreground))" }}
          >
            Describe the new item
          </h3>
          <p className="text-[12px] text-slate-500 mt-0.5" style={{ fontFamily: FONT }}>
            The item isn't in the Items Master yet. Tell us what it is and any
            details you have — the request will be routed for review. You can
            add more items after each one is saved.
          </p>
        </div>

        {/* Pinned drafts summary — mirrors the pinned-row styling used
            in the catalogue variant so committed items feel identical
            across both modes. */}
        {newItemDrafts.length > 0 && (
          <div
            className={`border rounded-xl bg-card overflow-hidden ${
              nothingSelectedError ? "border-red-500" : "border-border"
            }`}
          >
            <div className="px-3 sm:px-4 py-2 border-b border-border bg-[#F8FAFC] flex items-center justify-between">
              <span
                className="text-[11.5px] uppercase tracking-wider text-slate-500"
                style={{ fontWeight: 600, fontFamily: FONT }}
              >
                Items on this request
              </span>
              <span
                className="text-[11.5px] text-primary"
                style={{ fontWeight: 600, fontFamily: FONT }}
              >
                {newItemDrafts.length} added
              </span>
            </div>
            <div className="divide-y divide-border">
              {newItemDrafts.map((d) => (
                <div
                  key={d.id}
                  className="relative flex items-stretch gap-3 px-3 sm:px-4 py-3 bg-[#F5F9FF]"
                >
                  <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--primary))" }}
                  >
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <p
                        className="text-[13.5px] truncate"
                        style={{ fontWeight: 600, fontFamily: FONT, color: "hsl(var(--foreground))" }}
                      >
                        {d.name}
                      </p>
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10.5px] shrink-0"
                        style={{
                          backgroundColor: "hsl(var(--accent))",
                          color: "hsl(var(--primary))",
                          fontWeight: 600,
                          fontFamily: FONT,
                        }}
                      >
                        New item
                      </span>
                    </div>
                    {(d.vendorNotes || d.referenceLink) && (
                      <p
                        className="text-[11.5px] mt-0.5 truncate"
                        style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
                      >
                        {d.vendorNotes || d.referenceLink}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveNewItemDraft(d.id)}
                    className="text-slate-400 hover:text-red-500 self-center shrink-0"
                    aria-label={`Remove ${d.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {nothingSelectedError && newItemDrafts.length === 0 && (
          <div className="px-3 sm:px-4 py-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] flex items-center gap-2 text-[#B91C1C]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <p className="text-[12px]" style={{ fontWeight: 500, fontFamily: FONT }}>
              Add at least one new item to continue.
            </p>
          </div>
        )}

        {/* Always-open new-item form (the same SectionCard used in the
            catalogue mode; no cancel/collapse in this mode). */}
        <SectionCard
          icon={Package}
          title={newItemDrafts.length > 0 ? "Add another new item" : "Describe the new item"}
          eyebrow={newItemDrafts.length > 0 ? "Optional" : "Required"}
        >
          <div className="flex flex-col gap-3">
            <div>
              <FieldLabel label="Item name / description" required />
              <input
                type="text"
                value={newItemDraft.name}
                onChange={(e) => onNewItemDraftChange({ ...newItemDraft, name: e.target.value })}
                placeholder="e.g. Hex bolts M6 · Stainless steel · 20mm"
                className={inputClass()}
                style={{ fontFamily: FONT }}
              />
            </div>
            <div>
              <FieldLabel label="Suggested vendor / notes" />
              <textarea
                value={newItemDraft.vendorNotes}
                onChange={(e) =>
                  onNewItemDraftChange({ ...newItemDraft, vendorNotes: e.target.value })
                }
                placeholder="Vendor you'd like to buy from, spec sheets, similar items on file…"
                rows={3}
                className={inputClass(false, "resize-none")}
                style={{ fontFamily: FONT }}
              />
            </div>
            <div>
              <FieldLabel label="Reference link" />
              <input
                type="text"
                value={newItemDraft.referenceLink}
                onChange={(e) =>
                  onNewItemDraftChange({ ...newItemDraft, referenceLink: e.target.value })
                }
                placeholder="https://…"
                className={inputClass()}
                style={{ fontFamily: FONT }}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                onClick={onCommitNewItemDraft}
                disabled={!newItemDraft.name.trim()}
                className="gap-1.5 rounded-lg text-[13px] h-9 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                {newItemDrafts.length > 0 ? "Add another" : "Add item"}
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Headline (matches banking's Step 1 pattern) */}
      <div>
        <h3
          className="text-base"
          style={{ fontWeight: 600, fontFamily: FONT, color: "hsl(var(--foreground))" }}
        >
          What do you need?
        </h3>
        <p className="text-[12px] text-slate-500 mt-0.5" style={{ fontFamily: FONT }}>
          Pick every item you want on this request. You can select as many as you need, and add
          items that aren't in the Items Master yet.
        </p>
      </div>

      {/* Search + list card */}
      <div
        className={`border rounded-xl bg-card overflow-hidden ${
          nothingSelectedError ? "border-red-500" : "border-border"
        }`}
      >
        {/* Search row */}
        <div
          className="px-3 sm:px-4 py-2.5 border-b border-border bg-[#F8FAFC] flex items-center gap-2.5"
        >
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search items by name, SKU, category, or vendor…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-slate-400"
            style={{ fontFamily: FONT }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="text-slate-400 hover:text-slate-600 shrink-0"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Toolbar */}
        <div className="px-3 sm:px-4 py-2 border-b border-border flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={allFilteredSelected ? onClearAll : onSelectAll}
            disabled={filteredCatalog.length === 0}
            className="text-[12px] px-2.5 py-1 rounded-md border border-border bg-white text-foreground hover:bg-muted/40 transition-colors cursor-pointer disabled:opacity-50"
            style={{ fontWeight: 500, fontFamily: FONT }}
          >
            {allFilteredSelected ? "Clear all" : "Select all"}
          </button>
          <span
            className={`text-[11.5px] ${totalPicked > 0 ? "text-primary" : "text-muted-foreground"}`}
            style={{ fontWeight: 600, fontFamily: FONT }}
          >
            {totalPicked} selected
          </span>
        </div>

        {/* Nothing-picked error banner */}
        {nothingSelectedError && (
          <div className="px-3 sm:px-4 py-2 border-b border-[#FECACA] bg-[#FEF2F2] flex items-center gap-2 text-[#B91C1C]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <p className="text-[12px]" style={{ fontWeight: 500, fontFamily: FONT }}>
              Pick at least one item to continue.
            </p>
          </div>
        )}

        {/* Custom (new-item) rows — rendered as pinned rows at the top of the list */}
        {newItemDrafts.length > 0 && (
          <div className="divide-y divide-border">
            {newItemDrafts.map((d) => (
              <div
                key={d.id}
                className="relative flex items-stretch gap-3 px-3 sm:px-4 py-3 bg-[#F5F9FF]"
              >
                <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--primary))" }}
                >
                  <Package className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <p
                      className="text-[13.5px] truncate"
                      style={{ fontWeight: 600, fontFamily: FONT, color: "hsl(var(--foreground))" }}
                    >
                      {d.name}
                    </p>
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10.5px] shrink-0"
                      style={{
                        backgroundColor: "hsl(var(--accent))",
                        color: "hsl(var(--primary))",
                        fontWeight: 600,
                        fontFamily: FONT,
                      }}
                    >
                      New item
                    </span>
                  </div>
                  {(d.vendorNotes || d.referenceLink) && (
                    <p
                      className="text-[11.5px] mt-0.5 truncate"
                      style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
                    >
                      {d.vendorNotes || d.referenceLink}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveNewItemDraft(d.id)}
                  className="text-slate-400 hover:text-red-500 self-center shrink-0"
                  aria-label={`Remove ${d.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Catalog rows */}
        {filteredCatalog.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground" style={{ fontFamily: FONT }}>
              No items match "{searchQuery}". Try a broader search, or request a new item below.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredCatalog.map((c) => (
              <ItemPickRow
                key={c.id}
                item={c}
                selected={selectedCatalogIds.has(c.id)}
                onToggle={onToggle}
                query={searchQuery}
              />
            ))}
          </div>
        )}
      </div>

      {/* Request-new-item CTA */}
      {!showNewItemForm ? (
        <button
          type="button"
          onClick={onOpenNewItemForm}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-dashed border-border bg-white px-3 py-2 text-[13px] text-primary hover:border-primary hover:bg-accent transition-colors cursor-pointer"
          style={{ fontWeight: 600, fontFamily: FONT }}
        >
          <Plus className="w-3.5 h-3.5" />
          Request a new item (not in Items Master)
        </button>
      ) : (
        <SectionCard icon={Package} title="Describe the new item" eyebrow="Required">
          <div className="flex flex-col gap-3">
            <div>
              <FieldLabel
                label="Item name / description"
                required
                hint="Include model number, spec, or any reference that helps the buyer source the right item."
              />
              <textarea
                value={newItemDraft.name}
                onChange={(e) =>
                  onNewItemDraftChange({ ...newItemDraft, name: e.target.value })
                }
                placeholder="Describe the item clearly enough for the buyer to identify it…"
                rows={3}
                className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm text-foreground placeholder:text-slate-400 transition-colors focus:outline-none border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 resize-y"
                style={{ fontFamily: FONT }}
              />
            </div>
            <div>
              <FieldLabel label="Vendor name and details" optional hint="Whatever you know about who could supply it." />
              <textarea
                value={newItemDraft.vendorNotes}
                onChange={(e) =>
                  onNewItemDraftChange({ ...newItemDraft, vendorNotes: e.target.value })
                }
                placeholder="Vendor name, contact, website, or any details you have…"
                rows={2}
                className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm text-foreground placeholder:text-slate-400 transition-colors focus:outline-none border border-border focus:border-primary focus:ring-1 focus:ring-primary/20 resize-y"
                style={{ fontFamily: FONT }}
              />
            </div>
            <div>
              <FieldLabel label="Reference link or attachment" optional hint="Spec sheet, product link, or image URL." />
              <div
                className="mt-1 flex items-center gap-2 rounded-lg border !h-10 px-3 bg-white focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <LinkIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={newItemDraft.referenceLink}
                  onChange={(e) =>
                    onNewItemDraftChange({ ...newItemDraft, referenceLink: e.target.value })
                  }
                  placeholder="Paste a URL or note a file to attach later"
                  className="flex-1 outline-none bg-transparent text-sm"
                  style={{ fontFamily: FONT }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end pt-1">
              <Button
                variant="outline"
                onClick={onCancelNewItemForm}
                className="border-border text-slate-500 hover:text-foreground hover:border-slate-300 rounded-lg px-3 text-[13px] h-8"
              >
                Cancel
              </Button>
              <Button
                onClick={onCommitNewItemDraft}
                disabled={!newItemDraft.name.trim()}
                className="gap-1.5 rounded-lg px-3 text-[13px] h-8 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add to request
              </Button>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Step 2 body — fill in each picked item
   ═══════════════════════════════════════════════════════════════ */

type Row =
  | { kind: "catalog"; id: string; item: CatalogItem }
  | { kind: "new"; id: string; draft: NewItemDraft };

interface Step2Props {
  rows: Row[];
  getFields: (id: string) => ItemFields;
  patchFields: (id: string, patch: Partial<ItemFields>) => void;
  onRemoveRow: (id: string) => void;
  onFlagAsConfig: (id: string) => void;
  errors: Record<string, { qty?: string; name?: string }>;
  showErrors: boolean;
  duplicates: ReturnType<typeof findRecentDuplicates>;
}

function Step2FillItems({
  rows,
  getFields,
  patchFields,
  onRemoveRow,
  onFlagAsConfig,
  errors,
  showErrors,
  duplicates,
}: Step2Props) {
  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div>
        <h3
          className="text-base"
          style={{ fontWeight: 600, fontFamily: FONT, color: "hsl(var(--foreground))" }}
        >
          Fill in each item
        </h3>
        <p className="text-[12px] text-slate-500 mt-0.5" style={{ fontFamily: FONT }}>
          Tell the buyer how much, what unit, and any pricing or vendor preference. Fields marked{" "}
          <span className="text-red-500">*</span> are required.
        </p>
      </div>

      {duplicates.length > 0 && (
        <InfoCallout>
          <span style={{ fontWeight: 600 }}>{duplicates[0].id} is still open</span> — submitted{" "}
          {new Date(duplicates[0].submittedAt).toLocaleDateString()}. You may want to follow up on
          that one first.
        </InfoCallout>
      )}

      {rows.map((row) => (
        <Step2ItemCard
          key={row.id}
          row={row}
          fields={getFields(row.id)}
          onFieldsChange={(patch) => patchFields(row.id, patch)}
          onRemove={() => onRemoveRow(row.id)}
          onFlagAsConfig={row.kind === "catalog" ? () => onFlagAsConfig(row.id) : undefined}
          errors={errors[row.id]}
          showErrors={showErrors}
        />
      ))}
    </div>
  );
}

interface Step2ItemCardProps {
  row: Row;
  fields: ItemFields;
  onFieldsChange: (patch: Partial<ItemFields>) => void;
  onRemove: () => void;
  onFlagAsConfig?: () => void;
  errors?: { qty?: string; name?: string };
  showErrors: boolean;
}

function Step2ItemCard({
  row,
  fields,
  onFieldsChange,
  onRemove,
  onFlagAsConfig,
  errors,
  showErrors,
}: Step2ItemCardProps) {
  const isCatalog = row.kind === "catalog";
  const item = isCatalog ? row.item : undefined;
  /* `descriptiveName` is stored as "Name — Description" (em-dash), so
     split it once and reuse: the head is the item's short display
     name, the tail is the long description shown under it on the card. */
  const [catalogName, catalogDesc] = React.useMemo(() => {
    if (!item) return ["", ""] as const;
    const parts = item.descriptiveName.split(" — ");
    return [parts[0] ?? "", parts.slice(1).join(" — ")] as const;
  }, [item]);
  const displayName = isCatalog ? catalogName : row.draft.name;
  const isBelowMin = item ? item.currentStock <= item.minQuantity : false;
  const palette = item ? categoryPalette(item.category) : null;

  const qtyError = showErrors ? errors?.qty : undefined;

  const headerAction = (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors text-[11px]"
      style={{ fontWeight: 500, fontFamily: FONT }}
      aria-label={`Remove ${displayName} from this request`}
    >
      <Trash2 className="w-3 h-3" />
      <span className="hidden sm:inline">Remove</span>
    </button>
  );

  return (
    <SectionCard
      icon={Package}
      /* Item cards use the item-card variant: 44×44 thumbnail on the
         left, part# as the main heading (mono), item name as subheading,
         and the long description underneath. Drops the redundant
         top-right eyebrow (part# was there before) since the part# is
         now the title. */
      image={isCatalog ? item?.image : undefined}
      title={isCatalog ? (item?.itemNumber ?? "") : "New item"}
      titleMono={isCatalog}
      subtitle={displayName}
      description={isCatalog && catalogDesc ? catalogDesc : undefined}
      action={headerAction}
      /* Below-Min rows keep the neutral card shell; the amber signal
         lives entirely in the inline warning banner below so the tint
         doesn't dominate the whole card. */
      toneIconBg={palette ? palette.iconBg : "rgba(10, 119, 255, 0.08)"}
      toneIconColor={palette ? palette.iconColor : "hsl(var(--primary))"}
    >
      <div className="flex flex-col gap-3">
        {item && <ItemStateBanner item={item} />}

        {isBelowMin && item && onFlagAsConfig && (
          <div
            className="rounded-lg border px-3 py-2 flex items-start gap-2"
            style={{ borderColor: "#FDE68A", backgroundColor: "rgba(254, 243, 199, 0.4)" }}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#B45309" }} />
            <div className="flex-1 min-w-0">
              <p className="text-[12px]" style={{ color: "#78350F", fontFamily: FONT }}>
                <span style={{ fontWeight: 600 }}>This item is Below Minimum.</span> Ordering more
                may be blocked until the config is checked.
              </p>
              <button
                type="button"
                onClick={onFlagAsConfig}
                className="mt-1 inline-flex items-center gap-1 text-[11.5px] hover:underline"
                style={{ color: "#B45309", fontWeight: 600, fontFamily: FONT }}
              >
                Flag as a configuration issue instead
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 min-[560px]:grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-3">
          <div>
            <FieldLabel label="Quantity" required />
            <div
              className={`mt-1 flex items-center rounded-lg border overflow-hidden !h-10 ${
                qtyError ? "border-red-500" : "border-border"
              } focus-within:ring-1 ${
                qtyError
                  ? "focus-within:border-red-500 focus-within:ring-red-500/20"
                  : "focus-within:border-primary focus-within:ring-primary/20"
              }`}
            >
              <input
                type="number"
                min={0}
                step="1"
                value={fields.quantity}
                onChange={(e) => onFieldsChange({ quantity: e.target.value })}
                placeholder="0"
                className="flex-1 h-full px-3 outline-none bg-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                style={{ fontFamily: FONT }}
                aria-invalid={!!qtyError}
              />
              <div
                className="h-full px-3 flex items-center border-l"
                style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--muted))" }}
              >
                <span
                  className="text-sm"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
                >
                  {fields.uom || item?.defaultUOM || "EA"}
                </span>
              </div>
            </div>
            {qtyError && <ErrorLine>{qtyError}</ErrorLine>}
          </div>
          <div>
            <FieldLabel label="Estimated unit price" optional />
            <div
              className="mt-1 flex items-center rounded-lg border overflow-hidden !h-10 border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20"
            >
              <span
                className="px-3 text-slate-400 text-sm"
                style={{ fontFamily: FONT }}
              >
                $
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={fields.estimatedPrice}
                onChange={(e) => onFieldsChange({ estimatedPrice: e.target.value })}
                placeholder="Enter amount"
                className="flex-1 h-full outline-none bg-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                style={{ fontFamily: FONT }}
              />
            </div>
          </div>
          <div className="min-[560px]:col-span-2">
            <FieldLabel
              label="Preferred vendor"
              optional
              hint={
                isCatalog && item?.partnerLocation
                  ? "Pre-filled with the item's primary vendor. Buyer isn't bound by this."
                  : "Pick from your qualified vendors or type a custom name."
              }
            />
            <VendorPicker
              value={fields.preferredVendor}
              onChange={(v) => onFieldsChange({ preferredVendor: v })}
              primaryFor={item?.partnerLocation}
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Step 3 body — shared details
   ═══════════════════════════════════════════════════════════════ */

interface Step3Props {
  rows: Row[];
  needBy: string;
  onNeedByChange: (v: string) => void;
  urgency: PRUrgency;
  onUrgencyChange: (u: PRUrgency) => void;
  suggestedUrgency: PRUrgency | null;
  reason: string;
  onReasonChange: (v: string) => void;
  referenceDoc: string;
  onReferenceDocChange: (v: string) => void;
  attachments: PRAttachment[];
  onAttach: (f: File) => void;
  onRemoveAttachment: (id: string) => void;
  errors: { needBy?: string; reason?: string };
  showErrors: boolean;
  onEditItems: () => void;
}

function Step3Details({
  rows,
  needBy,
  onNeedByChange,
  urgency,
  onUrgencyChange,
  suggestedUrgency,
  reason,
  onReasonChange,
  referenceDoc,
  onReferenceDocChange,
  attachments,
  onAttach,
  onRemoveAttachment,
  errors,
  showErrors,
  onEditItems,
}: Step3Props) {
  const firstRow = rows[0];
  const firstName =
    firstRow?.kind === "catalog"
      ? firstRow.item.descriptiveName.split(" — ")[0]
      : firstRow?.draft.name;

  const needByError = showErrors ? errors.needBy : undefined;
  const reasonError = showErrors ? errors.reason : undefined;

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div>
        <h3
          className="text-base"
          style={{ fontWeight: 600, fontFamily: FONT, color: "hsl(var(--foreground))" }}
        >
          Last details
        </h3>
        <p className="text-[12px] text-slate-500 mt-0.5" style={{ fontFamily: FONT }}>
          When do you need this by, and why? The buyer reads these when deciding whether to
          approve, deny, or defer.
        </p>
      </div>

      {/* Context strip — banking's "Classification set from Step 1" pattern */}
      <div
        className="rounded-lg border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(10, 119, 255, 0.08)" }}
        >
          <Package className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[13px]"
            style={{ fontWeight: 600, color: "hsl(var(--foreground))", fontFamily: FONT }}
          >
            You're requesting {rows.length} item{rows.length === 1 ? "" : "s"}
          </p>
          <p className="text-[11.5px] mt-0.5 truncate text-slate-500" style={{ fontFamily: FONT }}>
            {firstName}
            {rows.length > 1 && ` +${rows.length - 1} more`}
          </p>
        </div>
        <button
          type="button"
          onClick={onEditItems}
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border bg-white text-muted-foreground hover:border-primary hover:text-primary hover:bg-accent transition-all text-[11px] sm:text-[12px] shrink-0"
          style={{ fontWeight: 600, fontFamily: FONT, borderColor: "hsl(var(--border))" }}
        >
          Edit items
        </button>
      </div>

      {/* When + urgency card */}
      <SectionCard icon={Calendar} title="When do you need it?" eyebrow="Required">
        <div className="grid grid-cols-1 min-[560px]:grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-3">
          <div>
            <FieldLabel
              label="Need by date"
              required
              hint="Your stated date, not a committed delivery date."
            />
            <input
              type="date"
              value={needBy}
              onChange={(e) => onNeedByChange(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className={inputClass(!!needByError, "max-w-[240px]")}
              style={{ fontFamily: FONT }}
              aria-invalid={!!needByError}
            />
            {needByError && <ErrorLine>{needByError}</ErrorLine>}
          </div>
          <div>
            <FieldLabel label="Urgency" required />
            <UrgencyPicker value={urgency} onChange={onUrgencyChange} suggested={suggestedUrgency} />
          </div>
        </div>
      </SectionCard>

      {/* Reason + reference doc + attachments card */}
      <SectionCard icon={Info} title="Why do you need it?" eyebrow="Required">
        <div className="flex flex-col gap-3">
          <div>
            <FieldLabel
              label="Reason"
              required
              hint="Be specific enough that the buyer can act without following up. At least 10 characters."
            />
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Describe why this is needed and what it will be used for…"
              rows={4}
              className={`mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm text-foreground placeholder:text-slate-400 transition-colors focus:outline-none border resize-y ${
                reasonError
                  ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
                  : "border-border focus:border-primary focus:ring-1 focus:ring-primary/20"
              }`}
              style={{ fontFamily: FONT }}
              aria-invalid={!!reasonError}
            />
            <p className="text-[11px] text-slate-500 mt-1" style={{ fontFamily: FONT }}>
              {reason.trim().length}/10 minimum
            </p>
            {reasonError && <ErrorLine>{reasonError}</ErrorLine>}
          </div>
          <div>
            <FieldLabel
              label="Reference document"
              optional
              recommended
              hint="Link to a sales order, project, or work order."
            />
            <div
              className="mt-1 flex items-center gap-2 rounded-lg border !h-10 px-3 bg-white focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <LinkIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={referenceDoc}
                onChange={(e) => onReferenceDocChange(e.target.value)}
                placeholder="Link to SO, project, or work order"
                className="flex-1 outline-none bg-transparent text-sm placeholder:text-slate-400"
                style={{ fontFamily: FONT }}
              />
            </div>
          </div>
          <div>
            <FieldLabel
              label="Attachments"
              optional
              recommended
              hint="Spec sheets, quotations, reference images — PDF / PNG / JPG up to 10 MB each."
            />
            <label
              className="mt-1 rounded-lg border border-dashed !h-10 px-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span
                  className="text-[13px]"
                  style={{ fontFamily: FONT, color: "hsl(var(--foreground))", fontWeight: 500 }}
                >
                  Click to upload
                </span>
              </div>
              <span
                className="text-[11px] text-slate-400 shrink-0"
                style={{ fontFamily: FONT }}
              >
                or drop here
              </span>
              <input
                type="file"
                className="hidden"
                multiple
                accept="application/pdf,image/png,image/jpeg"
                onChange={(e) => {
                  Array.from(e.target.files ?? []).forEach(onAttach);
                  e.target.value = "";
                }}
              />
            </label>
            {attachments.length > 0 && (
              <ul className="flex flex-col gap-1.5 mt-2">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                    style={{ borderColor: "hsl(var(--border))", backgroundColor: "white" }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span
                        className="truncate text-[13px]"
                        style={{ fontFamily: FONT, color: "hsl(var(--foreground))", fontWeight: 500 }}
                      >
                        {a.filename}
                      </span>
                      <span
                        className="text-[11px] shrink-0"
                        style={{ color: "hsl(var(--muted-foreground))", fontFamily: FONT }}
                      >
                        {a.sizeKb} KB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(a.id)}
                      className="text-slate-400 hover:text-slate-600"
                      aria-label="Remove attachment"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Requester chip — banking has a similar bottom-of-form footer element on Step 3 */}
      <div
        className="flex items-center gap-2.5 rounded-lg border bg-white px-3 sm:px-4 py-2.5"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center text-white shrink-0"
          style={{
            backgroundColor: CURRENT_USER.avatarColor,
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 11,
          }}
        >
          {CURRENT_USER.initials}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span
            className="truncate text-[12.5px]"
            style={{ fontFamily: FONT, color: "hsl(var(--foreground))", fontWeight: 600 }}
          >
            Submitting as {CURRENT_USER.name}
          </span>
          <span
            className="truncate text-[11px]"
            style={{ fontFamily: FONT, color: "hsl(var(--muted-foreground))" }}
          >
            {CURRENT_USER.role} · pulled from your profile
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Config-flag body — single-step alt branch
   ═══════════════════════════════════════════════════════════════ */

function ConfigFlagStepBody({
  item,
  value,
  onChange,
  showErrors,
  onExit,
}: {
  item?: CatalogItem;
  value: PRConfigFlag;
  onChange: (v: PRConfigFlag) => void;
  showErrors: boolean;
  onExit: () => void;
}) {
  const itemName = item ? item.descriptiveName.split(" — ")[0] : "this item";
  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3
            className="text-base"
            style={{ fontWeight: 600, fontFamily: FONT, color: "hsl(var(--foreground))" }}
          >
            Flag a configuration issue
          </h3>
          <p className="text-[12px] text-slate-500 mt-0.5" style={{ fontFamily: FONT }}>
            Filing this against <span style={{ fontWeight: 600 }}>{itemName}</span>. This is
            separate from a purchase ask — the buyer will review the config, not the order.
          </p>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-foreground shrink-0"
          style={{ fontWeight: 500, fontFamily: FONT }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to items
        </button>
      </div>

      <SectionCard icon={Wrench} title="What's misconfigured?" eyebrow="Required">
        <ConfigFlagBlock
          item={item}
          autoTriggered={!!item && item.currentStock <= item.minQuantity}
          value={value}
          onChange={onChange}
          showErrors={showErrors}
        />
      </SectionCard>
    </div>
  );
}
