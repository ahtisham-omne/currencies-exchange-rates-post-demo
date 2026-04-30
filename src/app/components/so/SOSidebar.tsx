import { useState, useRef, useEffect, type CSSProperties, type ReactNode } from "react";
import {
  Pencil, ChevronDown, Users, DollarSign, MapPinned, CalendarDays,
  CreditCard, Truck, Clock, AlertCircle, X,
  UserCircle, Search, Star,
} from "lucide-react";
import type { SalesOrder, SalesRep, SOStatus } from "./types";
import { useSOStore } from "./store";
import { InvoiceSidebarSummary } from "./InvoicingTab";
import { PricingRulesManageModal } from "./PricingRulesManageModal";
import { ManageAdjustmentsModal } from "./ManageAdjustmentsModal";
import { AddressSelectionModal } from "./AddressSelectionModal";
import { RecipientsSelectionModal } from "./RecipientsSelectionModal";
import { PaymentTermsLibrary } from "./PaymentTermsLibrary";
import { PaymentMethodSelectionModal } from "./PaymentMethodSelectionModal";
import { DateEditModal, type SODateType } from "./ui/DateEditModal";
import { toast } from "sonner";
import {
  BASE_CURRENCY,
  convertBetween,
  getLibraryCurrency,
  rateTypeLabel,
  formatRate,
} from "@/app/data/currencyLibrary";
import { useRateContext } from "@/app/context/RateContext";
import { CurrencyFlag } from "../currency/CurrencyFlag";
import { RATE_TYPE_COLORS } from "../currency/MarketCorporateToggle";
import { OrderMoney } from "../currency/OrderMoney";

/* ── Currency block at the top of Order Summary — mirrors the Quotes module's
 * summary FX section. Shows rate-type pill, customer-currency line, base-
 * currency line, the active rate, and a link to the configurator.
 * ─────────────────────────────────────────────────────────────────────── */
function OrderSummaryCurrencyBlock({
  customerCurrency,
  lockedRate,
  onOpenConfig,
}: {
  customerCurrency?: string;
  lockedRate?: number;
  onOpenConfig?: () => void;
}) {
  const { rateType } = useRateContext();
  const code = (customerCurrency || BASE_CURRENCY).toUpperCase();
  if (code === BASE_CURRENCY) return null;

  const colors = RATE_TYPE_COLORS[rateType];
  const cur = getLibraryCurrency(code);
  const baseCur = getLibraryCurrency(BASE_CURRENCY)!;
  const ratePerUnit = typeof lockedRate === "number"
    ? lockedRate
    : convertBetween(1, code, BASE_CURRENCY);
  const customerSym = cur?.symbol ?? code;
  const baseSym = baseCur.symbol ?? BASE_CURRENCY;

  return (
    <div
      style={{
        padding: "10px 0 12px",
        borderBottomWidth: 1,
        borderBottomStyle: "dashed",
        borderBottomColor: "#E5E7EB",
        marginBottom: 4,
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Currency
        </span>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${colors.hex}10`, color: colors.hex, border: `1px solid ${colors.hex}30`, fontSize: 10, fontWeight: 600 }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.hex }} />
          {rateTypeLabel(rateType)}
        </span>
      </div>

      <div className="flex flex-col" style={{ gap: 6 }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 400 }}>Customer pays in</span>
          <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12, color: "#1F2937", fontWeight: 600 }}>
            {cur && <CurrencyFlag currency={cur} size={14} />}
            {customerSym} {code}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 400 }}>Base equivalent</span>
          <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12, color: "#1F2937", fontWeight: 600 }}>
            <CurrencyFlag currency={baseCur} size={14} />
            {baseSym} {BASE_CURRENCY}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 400 }}>Rate</span>
          <span style={{ fontSize: 12, color: "#1F2937", fontWeight: 600 }} className="tabular-nums">
            1 {code} = {baseSym} {formatRate(ratePerUnit)} {BASE_CURRENCY}
          </span>
        </div>
      </div>

      {onOpenConfig && (
        <button
          type="button"
          onClick={onOpenConfig}
          className="mt-2 text-[11px] cursor-pointer transition-colors"
          style={{ color: "var(--primary)", border: "none", background: "transparent", padding: 0, fontWeight: 500 }}
        >
          View configuration →
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Props
 * ═══════════════════════════════════════════════════════════════════════════ */
interface Props {
  so: SalesOrder;
  /** Page-level Base ↔ Customer view toggle, threaded from SODetail so the
   * sidebar's totals flip in lockstep with the rest of the page. */
  viewMode?: "base" | "customer";
  onOpenInvoicing?: () => void;
  /** Open the order's Currency Configuration modal (managed in SODetail). */
  onOpenCurrencyConfig?: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Shared primitives  (mirrors Quote sidebar patterns, CSS-variable only)
 * ═══════════════════════════════════════════════════════════════════════════ */

// ── Hover-edit row — pencil always visible, blue hover highlight ──────────
function HoverEditRow({
  children, onEdit, editable = true, style,
}: {
  children: ReactNode; onEdit?: () => void; editable?: boolean; style?: CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  // Decompose any shorthand `border` from style to avoid React warnings
  // when we conditionally set borderColor on hover
  const { border, ...restStyle } = style || {};
  let baseBorderWidth = "0px";
  let baseBorderStyle: string = "solid";
  let baseBorderColor = "transparent";
  if (border) {
    const parts = String(border).split(" ");
    if (parts.length >= 1) baseBorderWidth = parts[0];
    if (parts.length >= 2) baseBorderStyle = parts[1];
    if (parts.length >= 3) baseBorderColor = parts.slice(2).join(" ");
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => editable && onEdit?.()}
      className={`relative transition-all ${editable ? "cursor-pointer" : ""}`}
      style={{
        ...restStyle,
        borderWidth: baseBorderWidth,
        borderStyle: baseBorderStyle,
        borderColor: hovered && editable ? "var(--ring)" : baseBorderColor,
      }}
    >
      {/* Translucent blue hover overlay */}
      <div
        className={`absolute inset-0 rounded-[inherit] transition-colors pointer-events-none ${hovered && editable ? "bg-primary/5" : ""}`}
      />
      <div className="relative">{children}</div>
      {editable && (
        <div
          className={`absolute right-[10px] top-1/2 -translate-y-1/2 flex items-center justify-center transition-all ${hovered ? "text-primary opacity-100" : "text-foreground/25 opacity-100"}`}
        >
          <Pencil style={{ width: 12, height: 12 }} />
        </div>
      )}
    </div>
  );
}

// ── Section header — PO-style: minimal height, full-width bottom stroke ──
function SectionHeader({
  icon: Icon, label, collapsed, onToggle,
}: {
  icon: React.ComponentType<{ style?: CSSProperties; className?: string }>;
  label: string; collapsed?: boolean; onToggle?: () => void;
}) {
  const isCollapsible = onToggle !== undefined;
  return (
    <>
      <button
        onClick={isCollapsible ? onToggle : undefined}
        className={`w-full flex items-center justify-between hover:bg-secondary/30 transition-colors ${isCollapsible ? "cursor-pointer" : ""}`}
        style={{
          gap: 8,
          minHeight: 42,
          padding: "8px 0",
          border: "none",
          background: "none",
        }}
      >
        <div className="flex items-center" style={{ gap: 8, minHeight: 24 }}>
          <div className="flex items-center justify-center shrink-0" style={{
            width: 24, height: 24, borderRadius: 6,
            backgroundColor: "rgba(10,119,255,0.08)",
          }}>
            <Icon style={{ width: 13, height: 13, color: "#3B82F6" }} />
          </div>
          <span style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 600, color: "#1F2937", lineHeight: 1.2 }}>
            {label}
          </span>
        </div>
        {isCollapsible && (
          <ChevronDown
            className="shrink-0 text-muted-foreground transition-transform duration-200"
            style={{ width: 14, height: 14, transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}
          />
        )}
      </button>
      <div style={{ borderBottom: "1px solid var(--border)" }} />
    </>
  );
}

function SubsectionHeader({
  icon: Icon,
  label,
  expanded,
  onToggle,
}: {
  icon: React.ComponentType<{ style?: CSSProperties; className?: string; strokeWidth?: string | number }>;
  label: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between bg-transparent border-none cursor-pointer hover:bg-secondary/20 transition-colors"
      style={{
        minHeight: 36,
        padding: "8px 0",
        gap: 8,
      }}
    >
      <div className="flex items-center min-w-0" style={{ gap: 8 }}>
        <Icon style={{ width: 13, height: 13, color: "var(--muted-foreground)", flexShrink: 0 }} strokeWidth={1.5} />
        <span
          className="truncate"
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--foreground)",
            letterSpacing: "0.01em",
            lineHeight: 1.2,
          }}
        >
          {label}
        </span>
      </div>
      <ChevronDown
        style={{
          width: 12,
          height: 12,
          color: "var(--muted-foreground)",
          transition: "transform 200ms",
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          flexShrink: 0,
        }}
      />
    </button>
  );
}

// ── Summary info row with pencil (for Order Summary card) ─────────────────
function SummaryInfoRow({ label, onClick }: { label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`flex items-center transition-all border-none cursor-pointer ${hovered ? "bg-primary/5" : "bg-transparent"}`}
      style={{ gap: 4, marginTop: 6, padding: "3px 6px", marginLeft: -6, borderRadius: 4 }}
    >
      <span className={`transition-colors ${hovered ? "text-primary" : "text-foreground/40"}`} style={{ fontSize: "var(--text-small)", lineHeight: 1 }}>
        {label}
      </span>
      <Pencil
        className={`shrink-0 transition-all ${hovered ? "text-primary opacity-100" : "text-foreground/20 opacity-0"}`}
        style={{ width: 10, height: 10 }}
      />
    </button>
  );
}

/* ── Avatar palette — explicit rgba because CSS vars are hex/rgba, not raw HSL channels ── */
const AVATAR_PALETTE = [
  { bg: "rgba(87, 78, 250, 0.18)", textColor: "rgba(67, 56, 230, 1)" },   // chart-4 purple (stronger)
  { bg: "rgba(255, 69, 58, 0.16)", textColor: "rgba(220, 38, 38, 1)" },   // chart-5 red (stronger)
  { bg: "rgba(239, 162, 47, 0.18)", textColor: "rgba(180, 83, 9, 1)" },   // chart-3 amber (darker)
  { bg: "rgba(39, 185, 115, 0.16)", textColor: "rgba(5, 150, 80, 1)" },   // accent green (darker)
  { bg: "rgba(10, 119, 255, 0.16)", textColor: "rgba(29, 78, 216, 1)" },  // primary blue (darker)
];

function getAvatarPastel(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function AvatarCircle({ name, size = 24, fontSize, borderColor }: { name: string; size?: number; fontSize?: string; borderColor?: string }) {
  const pal = getAvatarPastel(name);
  return (
    <span
      className="rounded-full flex items-center justify-center shrink-0"
      style={{
        width: size, height: size,
        backgroundColor: pal.bg,
        color: pal.textColor,
        fontSize: fontSize || "var(--text-micro)",
        fontWeight: "var(--font-weight-semibold)",
        ...(borderColor ? { borderWidth: 2, borderStyle: "solid", borderColor } : {}),
      }}
    >
      {getInitials(name)}
    </span>
  );
}

/* ── Timeline date row with dot + connector ── */
interface TimelineEntry {
  key: string; label: string; value: string; color: string; dotColor: string; dotFill?: boolean; editable?: boolean;
}

function TimelineDateRow({ entry, onEdit, isLast }: {
  entry: TimelineEntry; onEdit: (key: string) => void; isLast: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const isEditable = entry.editable !== false;
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => isEditable && onEdit(entry.key)}
      className={`flex items-center transition-colors ${isEditable ? "cursor-pointer" : ""} ${hovered && isEditable ? "bg-primary/5" : ""}`}
      style={{ gap: 10, padding: "5px 6px", margin: "0 -6px", borderRadius: 5 }}
    >
      {/* Dot column with connector line */}
      <div className="relative shrink-0" style={{ width: 11, height: 11 }}>
        <div
          className="relative rounded-full"
          style={{
            width: 11, height: 11,
            backgroundColor: entry.dotFill ? entry.dotColor : "var(--card)",
            borderWidth: "2.5px", borderStyle: "solid", borderColor: entry.dotColor,
            zIndex: 1,
          }}
        />
        {!isLast && (
          <div
            className="absolute bg-border"
            style={{ left: "50%", top: 11, transform: "translateX(-50%)", width: 1.5, height: 16 }}
          />
        )}
      </div>
      {/* Content — label + value + pencil */}
      <div className="flex items-center justify-between flex-1 min-w-0" style={{ gap: 8 }}>
        <span className="text-foreground/40 whitespace-nowrap" style={{ fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)", lineHeight: 1 }}>
          {entry.label}
        </span>
        <div className="flex items-center">
          <span className="whitespace-nowrap text-right" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)", lineHeight: 1, color: entry.color }}>
            {entry.value}
          </span>
          <div className="shrink-0 flex justify-end" style={{ width: 17 }}>
            {isEditable && (
              <Pencil
                className={`shrink-0 transition-all ${hovered ? "text-primary opacity-100" : "text-foreground/15 opacity-0"}`}
                style={{ width: 11, height: 11 }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  All available sales reps
 * ═══════════════════════════════════════════════════════════════════════════ */
const ALL_SALES_REPS = [
  { name: "Sarah Chen", isYou: true, customerDefault: false },
  { name: "Mike Johnson", isYou: false, customerDefault: false },
  { name: "Emily Williams", isYou: false, customerDefault: true },
  { name: "David Chen", isYou: false, customerDefault: false },
  { name: "Sarah Lindquist", isYou: false, customerDefault: false },
  { name: "Michael Tran", isYou: false, customerDefault: false },
  { name: "Emily Rios", isYou: false, customerDefault: false },
  { name: "Robert Navarro", isYou: false, customerDefault: false },
  { name: "Amanda Chen", isYou: false, customerDefault: false },
  { name: "Jessica Mbeki", isYou: false, customerDefault: false },
];

/* ═══════════════════════════════════════════════════════════════════════════
 *  Sales Rep Selector Drop-up (SO-specific, with store integration)
 * ═══════════════════════════════════════════════════════════════════════════ */
function SalesRepSelectorDropup({ so }: { so: SalesOrder }) {
  const store = useSOStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) { setOpen(false); setSearch(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const assignedReps = so.salesReps ?? [{ name: so.salesRep, primary: true }];
  const primaryRep = assignedReps.find(r => r.primary) || assignedReps[0];
  const otherAssigned = assignedReps.filter(r => r.name !== primaryRep?.name);
  const filteredReps = ALL_SALES_REPS.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
  const isAssigned = (name: string) => assignedReps.some(r => r.name === name);
  const isPrimary = (name: string) => assignedReps.some(r => r.name === name && r.primary);

  const toggleRep = (name: string) => {
    let newReps: SalesRep[];
    if (isAssigned(name)) {
      if (assignedReps.length <= 1) return;
      newReps = assignedReps.filter(r => r.name !== name);
      if (isPrimary(name) && newReps.length > 0) newReps[0] = { ...newReps[0], primary: true };
    } else {
      newReps = [...assignedReps, { name, primary: false }];
    }
    store.updateSO(so.id, { salesReps: newReps, salesRep: newReps.find(r => r.primary)?.name || newReps[0]?.name || so.salesRep });
  };

  const setPrimary = (name: string) => {
    const newReps = assignedReps.map(r => ({ ...r, primary: r.name === name }));
    store.updateSO(so.id, { salesReps: newReps, salesRep: name });
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger — matches Quote sidebar with subtle stroke */}
      <HoverEditRow editable onEdit={() => setOpen(!open)} style={{ padding: "6px 10px", borderRadius: 6, margin: "0 -4px", backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        {(() => {
          if (!primaryRep) return null;
          return (
            <div className="flex items-center min-w-0" style={{ gap: 6, paddingRight: 28 }}>
              <AvatarCircle name={primaryRep.name} size={22} borderColor="var(--primary)" />
              <span className="text-foreground truncate min-w-0" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)", lineHeight: 1 }}>
                {primaryRep.name}{ALL_SALES_REPS.find(r => r.name === primaryRep.name)?.isYou ? " (You)" : ""}
              </span>
              {otherAssigned.length > 0 && (
                <>
                  <span className="text-foreground/15 shrink-0" style={{ fontSize: "var(--text-micro)", lineHeight: 1 }}>·</span>
                  <div className="flex items-center shrink-0">
                    {otherAssigned.slice(0, 3).map((rep, idx) => (
                      <AvatarCircle key={rep.name} name={rep.name} size={18} fontSize="7px" />
                    ))}
                  </div>
                  {otherAssigned.length > 0 && (
                    <span className="text-foreground/40 whitespace-nowrap shrink-0" style={{ fontSize: "var(--text-micro)", lineHeight: 1 }}>
                      +{otherAssigned.length} more
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })()}
      </HoverEditRow>

      {/* Drop-up panel */}
      {open && (
        <div
          className="absolute bottom-full left-[-4px] right-[-4px] bg-card rounded-lg border border-border overflow-hidden"
          style={{ marginBottom: 4, maxHeight: 380, zIndex: "var(--z-overlay)" as any, boxShadow: "var(--elevation-sm)" }}
        >
          <div style={{ padding: "12px 12px 8px" }}>
            <div className="flex items-center border border-border rounded-md bg-input-background" style={{ gap: 8, padding: "8px 12px" }}>
              <Search className="w-3.5 h-3.5 text-foreground/30 shrink-0" />
              <input
                type="text" placeholder="Search sales representatives..." value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-foreground placeholder:text-foreground/35 outline-none"
                style={{ fontSize: "var(--text-caption)" }} autoFocus
              />
            </div>
          </div>

          <div style={{ padding: "0 12px 8px" }}>
            <div className="text-foreground/40" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.04em", marginBottom: 6 }}>
              ASSIGNED ({assignedReps.length})
            </div>
            <div className="flex flex-wrap" style={{ gap: 6 }}>
              {assignedReps.map(rep => (
                <div key={rep.name} className="flex items-center bg-secondary rounded-full" style={{ gap: 6, padding: "4px 6px" }}>
                  <AvatarCircle name={rep.name} size={20} fontSize="var(--text-micro)" />
                  <span className="text-foreground" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}>{rep.name.split(" ")[0]}</span>
                  {rep.primary && <span className="text-primary rounded" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", padding: "1px 6px", backgroundColor: "rgba(10, 119, 255, 0.1)" }}>Primary</span>}
                  {!rep.primary && assignedReps.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); toggleRep(rep.name); }} className="text-foreground/30 hover:text-foreground/60 transition-colors"><X className="w-3 h-3" /></button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border" />

          <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
            {filteredReps.map(rep => {
              const assigned = isAssigned(rep.name);
              const primary = isPrimary(rep.name);
              return (
                <div key={rep.name} className={`flex items-center hover:bg-secondary transition-colors cursor-pointer ${assigned ? "bg-primary/3" : ""}`} style={{ gap: 10, padding: "8px 12px" }} onClick={() => toggleRep(rep.name)}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${assigned ? "bg-primary border-primary" : "border-border"}`}>
                    {assigned && <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <AvatarCircle name={rep.name} size={28} fontSize="var(--text-caption)" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center" style={{ gap: 6 }}>
                      <span className="text-foreground" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}>{rep.name}</span>
                      {rep.isYou && <span className="text-foreground/40" style={{ fontSize: "var(--text-caption)" }}>(You)</span>}
                    </div>
                    {rep.customerDefault && <span className="text-primary/70" style={{ fontSize: "var(--text-caption)" }}>Customer Default</span>}
                  </div>
                  {assigned && (
                    <button onClick={(e) => { e.stopPropagation(); setPrimary(rep.name); }} className="shrink-0" title={primary ? "Primary rep" : "Set as primary"}>
                      <Star className={`w-4 h-4 transition-colors ${primary ? "text-chart-3 fill-chart-3" : "text-foreground/15 hover:text-chart-3/50"}`} />
                    </button>
                  )}
                </div>
              );
            })}
            {filteredReps.length === 0 && <div className="text-center text-foreground/35" style={{ padding: "16px 12px", fontSize: "var(--text-caption)" }}>No matching representatives</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Timeline helpers (SO-specific stages)
 * ═══════════════════════════════════════════════════════════════════════════ */
function addDays(dateStr: string, days: number): string {
  const parts = dateStr.split("/").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + days);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatDateDisplay(dateStr: string): string {
  const parts = dateStr.split("/").map(Number);
  return `${String(parts[1]).padStart(2, "0")}/${String(parts[2]).padStart(2, "0")}/${parts[0]}`;
}

function buildSOTimelineEntries(so: SalesOrder): TimelineEntry[] {
  const isFromQuote = !!so.sourceQuoteRef;
  const createdDate = so.createdDate;
  const statusOrder: SOStatus[] = ["Draft", "Pending Review", "Cleared", "Partially Shipped", "Shipped"];
  const statusIdx = statusOrder.indexOf(so.status);
  const isClearedPlus = statusIdx >= 2;
  const isShippedPlus = statusIdx >= 4;
  const entries: TimelineEntry[] = [];

  // Created
  entries.push({
    key: "created", label: "Created On", value: formatDateDisplay(createdDate),
    color: "var(--foreground)", dotColor: "var(--border)", dotFill: true, editable: false,
  });

  // Converted/Ordered On
  entries.push({
    key: "converted", label: isFromQuote ? "Converted On" : "Ordered On",
    value: addDays(createdDate, isFromQuote ? 3 : 0),
    color: so.status === "Pending Review" ? "var(--primary)" : "var(--foreground)",
    dotColor: so.status === "Pending Review" ? "var(--primary)" : statusIdx > 1 ? "var(--border)" : "var(--foreground)",
    dotFill: statusIdx >= 1, editable: false,
  });

  // Cleared by Ops
  if (isClearedPlus) {
    entries.push({
      key: "cleared", label: "Cleared by Ops", value: addDays(createdDate, isFromQuote ? 5 : 2),
      color: so.status === "Cleared" ? "var(--primary)" : "var(--foreground)",
      dotColor: so.status === "Cleared" ? "var(--primary)" : "var(--border)",
      dotFill: true, editable: false,
    });
  }

  // Ship By — highlight if approaching
  const shipByDate = addDays(createdDate, 30);
  const today = new Date();
  const shipByParts = shipByDate.split("/").map(Number);
  const shipByD = new Date(+shipByParts[0] || 2026, (shipByParts[0] > 12 ? shipByParts[1] : shipByParts[0]) - 1, shipByParts[2] || 1);
  const shipByDiff = Math.ceil((shipByD.getTime() - today.getTime()) / 86400000);
  const shipByNear = shipByDiff >= 0 && shipByDiff <= 14;
  const shipByPast = shipByDiff < 0;
  entries.push({
    key: "shipBy", label: "Ship By", value: shipByDate,
    color: shipByPast ? "var(--destructive)" : shipByNear ? "var(--chart-3)" : "var(--foreground)",
    dotColor: shipByPast ? "var(--destructive)" : shipByNear ? "var(--chart-3)" : "var(--border)",
    editable: true,
  });

  // Expected Delivery
  const deliveryDate = so.requestedDeliveryDate ? formatDateDisplay(so.requestedDeliveryDate) : addDays(createdDate, 45);
  entries.push({
    key: "delivery", label: "Expected Delivery", value: deliveryDate,
    color: so.status === "Shipped" ? "var(--primary)" : "var(--foreground)",
    dotColor: isShippedPlus ? "var(--accent)" : "var(--border)",
    dotFill: isShippedPlus, editable: true,
  });

  return entries;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Status pill (SO-specific)
 * ═══════════════════════════════════════════════════════════════════════════ */
function getStatusPill(so: SalesOrder): { text: string; color: string; bg: string; icon: "clock" | "alert" } | null {
  if (so.status === "Shipped") return null;
  if (so.status === "Cleared" || so.status === "Pending Review") {
    return { text: "Ship date approaching — allocate and ship soon", color: "var(--chart-3)", bg: "var(--chart-3)", icon: "alert" };
  }
  if (so.status === "Partially Shipped") {
    return { text: "Partial shipment in progress — complete remaining items", color: "var(--chart-4)", bg: "var(--chart-4)", icon: "clock" };
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Mock address data
 * ═══════════════════════════════════════════════════════════════════════════ */
const MOCK_ADDRESSES = {
  billing: { label: "Headquarters", street: "6145 Logistics Center Blvd", city: "Rockford", state: "IL", zip: "61101" },
  shipping: { label: "Main Depot", street: "4200 Industrial Blvd, Suite 300", city: "Houston", state: "TX", zip: "77073" },
};

/* ═══════════════════════════════════════════════════════════════════════════
 *  Card wrapper (matches Quote sidebar card style)
 * ═══════════════════════════════════════════════════════════════════════════ */
const cardStyle: CSSProperties = {
  backgroundColor: "var(--card)",
  borderRadius: "var(--radius-xl)",
  borderWidth: 1, borderStyle: "solid", borderColor: "var(--border)",
  boxShadow: "var(--elevation-1)",
  padding: "0 18px",
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  WebkitFontSmoothing: "antialiased" as any,
  MozOsxFontSmoothing: "grayscale" as any,
};

/* ═══════════════════════════════════════════════════════════════════════════
 *  MAIN SIDEBAR COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════ */
export function SOSidebar({ so, viewMode = "base", onOpenInvoicing, onOpenCurrencyConfig }: Props) {
  /* ── Collapse state ── */
  const [customerCollapsed, setCustomerCollapsed] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [infoCollapsed, setInfoCollapsed] = useState(false);
  const [showAddressDetail, setShowAddressDetail] = useState(false);
  const [showPaymentShipping, setShowPaymentShipping] = useState(false);
  const [showPricingRules, setShowPricingRules] = useState(false);
  const [showAdjustments, setShowAdjustments] = useState(false);
  
  /* ── Sidebar editing modal state ── */
  const [addressModalType, setAddressModalType] = useState<"billing" | "shipping" | null>(null);
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [showPaymentTermsModal, setShowPaymentTermsModal] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [editingDateKey, setEditingDateKey] = useState<string | null>(null);

  /* ── Editable state ── */
  const [billingAddress, setBillingAddress] = useState(MOCK_ADDRESSES.billing);
  const [shippingAddress, setShippingAddress] = useState(MOCK_ADDRESSES.shipping);
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [paymentMethod, setPaymentMethod] = useState("ACH/Direct Deposit");

  /* ── SO-specific data ── */
  const subtotal = so.lines.reduce((s, l) => s + l.orderedQty * l.unitPrice, 0);
  const pricingRulesAmount = Math.round(subtotal * 0.085);
  const discountsPremiums = Math.round(subtotal * 0.0195);
  const grandTotal = subtotal - pricingRulesAmount + discountsPremiums;
  const timelineEntries = buildSOTimelineEntries(so);
  const statusPill = getStatusPill(so);
  const createdBy = "Sarah Chen";

  /* ── Contacts ── */
  const primaryContact = { name: "Sarah Moore", title: "Procurement Manager" };
  const otherContacts = [
    { id: "c2", name: "Tom Mitchell", initials: "TM", title: "Fleet Manager" },
    { id: "c3", name: "Ben Parker", initials: "BP", title: "Procurement Officer" },
    { id: "c4", name: "Lisa Huang", initials: "LH", title: "Finance Director" },
    { id: "c5", name: "Anna Kim", initials: "AK", title: "Operations" },
    { id: "c6", name: "David Chen", initials: "DC", title: "Engineering" },
  ];

  /* ── Formatters — display amounts in the base currency (PKR). The conversion
   * to the customer currency is surfaced via OrderMoney's built-in hover. ── */

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* ═══════ 1. CUSTOMER INFORMATION ═══════ */}
      <div style={cardStyle}>
        <SectionHeader icon={Users} label="Customer Information" collapsed={customerCollapsed} onToggle={() => setCustomerCollapsed(!customerCollapsed)} />

        {!customerCollapsed && <div style={{ padding: "10px 0 12px" }}>
          {/* Customer tile */}
          <HoverEditRow editable onEdit={() => {}}
            style={{ padding: "8px 10px", borderRadius: 6, margin: "0 0 8px", border: "1px solid transparent" }}
          >
            <div className="flex items-center" style={{ gap: 10, paddingRight: 28 }}>
              <AvatarCircle name={so.customer} size={36} fontSize="var(--text-caption)" />
              <div className="flex-1 min-w-0">
                <div className="truncate" style={{ fontSize: 13, fontWeight: 600, color: "#1F2937", lineHeight: 1.2 }}>
                  {so.customer}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1, marginTop: 3 }}>Customer</div>
              </div>
            </div>
          </HoverEditRow>

          {/* Point of Contacts heading */}
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase" as const, letterSpacing: "0.4px", marginBottom: 8 }}>
            Point of Contacts
          </div>

          {/* Primary + secondary contacts */}
          <HoverEditRow editable onEdit={() => setShowRecipientsModal(true)}
            style={{ padding: "8px 10px", borderRadius: 6, margin: "0 0 8px", backgroundColor: "var(--secondary)", border: "1px solid var(--secondary)" }}
          >
            <div className="flex items-center" style={{ gap: 8, paddingRight: 28 }}>
              <AvatarCircle name={primaryContact.name} size={28} borderColor="var(--primary)" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center" style={{ gap: 6 }}>
                  <span className="truncate" style={{ fontSize: 12, fontWeight: 600, color: "#1F2937", lineHeight: 1 }}>
                    {primaryContact.name}
                  </span>
                  <span
                    className="shrink-0"
                    style={{ fontSize: 9, fontWeight: 600, color: "#1E40AF", backgroundColor: "#DBEAFE", padding: "1px 5px", borderRadius: 3, lineHeight: 1.4, textTransform: "uppercase" as const, letterSpacing: "0.3px" }}
                  >
                    Primary
                  </span>
                </div>
                {/* Secondary contact avatars stacked */}
                {otherContacts.length > 0 && (
                  <div className="flex items-center" style={{ gap: 0, marginTop: 5 }}>
                    {otherContacts.slice(0, 3).map((poc, idx) => (
                      <span
                        key={poc.id}
                        title={`${poc.name} · ${poc.title}`}
                        className="rounded-full flex items-center justify-center shrink-0"
                        style={{
                          width: 20, height: 20, fontSize: "8px", fontWeight: "var(--font-weight-semibold)",
                          backgroundColor: getAvatarPastel(poc.name).bg,
                          color: getAvatarPastel(poc.name).textColor,
                          borderWidth: 1.5, borderStyle: "solid", borderColor: "var(--card)",
                          marginLeft: idx > 0 ? -4 : 0, position: "relative", zIndex: 5 - idx,
                        }}
                      >
                        {poc.initials}
                      </span>
                    ))}
                    {otherContacts.length > 3 && (
                      <span
                        className="rounded-full flex items-center justify-center shrink-0"
                        style={{
                          width: 20, height: 20, fontSize: "8px", fontWeight: "var(--font-weight-semibold)",
                          backgroundColor: "#E5E7EB", color: "#6B7280",
                          borderWidth: 1.5, borderStyle: "solid", borderColor: "var(--card)",
                          marginLeft: -4, position: "relative", zIndex: 0,
                        }}
                      >
                        +{otherContacts.length - 3}
                      </span>
                    )}
                    <span className="text-foreground/40 whitespace-nowrap" style={{ fontSize: "var(--text-small)", lineHeight: 1, marginLeft: 5 }}>
                      +{otherContacts.length} more
                    </span>
                  </div>
                )}
              </div>
            </div>
          </HoverEditRow>

          {/* Separator */}
          <div style={{ borderBottom: "1px solid var(--border)", margin: "8px 0 0" }} />

          {/* ── Addresses — collapsible sub-expander (PO-style: compact, stroke all the way, regular caps) ── */}
          <SubsectionHeader
            icon={MapPinned}
            label="Shipping / Billing Locations"
            expanded={showAddressDetail}
            onToggle={() => setShowAddressDetail(!showAddressDetail)}
          />

          {showAddressDetail && (
          <div className="flex flex-col" style={{ gap: 8, padding: "8px 0 4px 0" }}>
              {/* Bill To — Partner Management style: label + avatar + map link */}
              <HoverEditRow editable onEdit={() => setAddressModalType("billing")}
                style={{ borderRadius: 12, border: "1px solid var(--border)", padding: "10px 12px", overflow: "hidden" }}
              >
                <div className="flex flex-col" style={{ paddingRight: 20 }}>
                  {/* Header: icon + label + info */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <CreditCard style={{ width: 13, height: 13, color: "#94A3B8", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 500, color: "#64748B" }}>Bill To</span>
                    <span style={{ fontSize: 10, color: "#CBD5E1" }}>ⓘ</span>
                  </div>
                  {/* Avatar + Name */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#FFF" }}>{billingAddress.label.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
                    </div>
                    <span className="text-[13px] text-foreground truncate" style={{ fontWeight: 600, maxWidth: 140 }} title={billingAddress.label}>{billingAddress.label}</span>
                  </div>
                  {/* Address — clickable to Google Maps */}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${billingAddress.street}, ${billingAddress.city}, ${billingAddress.state} ${billingAddress.zip}`)}`}
                    target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-start gap-1.5 text-[11px] text-[#64748B] hover:text-[#0A77FF] hover:underline transition-colors leading-snug"
                  >
                    <MapPinned style={{ width: 12, height: 12, flexShrink: 0, marginTop: 2, color: "#94A3B8" }} />
                    <span>{billingAddress.street}, {billingAddress.city}, {billingAddress.state} {billingAddress.zip}</span>
                  </a>
                </div>
              </HoverEditRow>

              {/* Ship To — Partner Management style */}
              <HoverEditRow editable onEdit={() => setAddressModalType("shipping")}
                style={{ borderRadius: 12, border: "1px solid var(--border)", padding: "10px 12px", overflow: "hidden" }}
              >
                <div className="flex flex-col" style={{ paddingRight: 20 }}>
                  {/* Header: icon + label + info */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <Truck style={{ width: 13, height: 13, color: "#94A3B8", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 500, color: "#64748B" }}>Ship To</span>
                    <span style={{ fontSize: 10, color: "#CBD5E1" }}>ⓘ</span>
                  </div>
                  {/* Avatar + Name */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#FFF" }}>{shippingAddress.label.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
                    </div>
                    <span className="text-[13px] text-foreground truncate" style={{ fontWeight: 600, maxWidth: 140 }} title={shippingAddress.label}>{shippingAddress.label}</span>
                  </div>
                  {/* Address — clickable to Google Maps */}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shippingAddress.street}, ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zip}`)}`}
                    target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-start gap-1.5 text-[11px] text-[#64748B] hover:text-[#0A77FF] hover:underline transition-colors leading-snug"
                  >
                    <MapPinned style={{ width: 12, height: 12, flexShrink: 0, marginTop: 2, color: "#94A3B8" }} />
                    <span>{shippingAddress.street}, {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}</span>
                  </a>
                </div>
              </HoverEditRow>
            </div>
          )}

          {/* Separator */}
          <div style={{ borderBottom: "1px solid var(--border)", margin: "0" }} />

          {/* ── Payment & Shipping — collapsible sub-expander (PO-style compact) ── */}
          <SubsectionHeader
            icon={CreditCard}
            label="Payment & Shipping"
            expanded={showPaymentShipping}
            onToggle={() => setShowPaymentShipping(!showPaymentShipping)}
          />

          {showPaymentShipping && (
            <div className="flex flex-col" style={{ gap: 0, padding: "4px 0 2px 0" }}>
              {/* Shipping Method — first per convention */}
              <HoverEditRow editable onEdit={() => {}}
                style={{ padding: "8px 10px", margin: "0 -4px", borderRadius: 6, border: "1px solid transparent" }}
              >
                <div style={{ paddingRight: 28 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "#9CA3AF", lineHeight: 1, marginBottom: 5 }}>Shipping Method</div>
                  <div className="flex items-center overflow-hidden" style={{ gap: 5 }}>
                    <Truck className="text-primary shrink-0" style={{ width: 12, height: 12 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1F2937", lineHeight: 1 }} className="truncate">Standard Ground</span>
                    <span className="shrink-0" style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1 }}>· {so.freightMethod}</span>
                  </div>
                </div>
              </HoverEditRow>
              <div className="bg-secondary" style={{ height: 1, margin: "0 6px" }} />

              {/* Payment Terms */}
              <HoverEditRow editable onEdit={() => setShowPaymentTermsModal(true)}
                style={{ padding: "8px 10px", margin: "0 -4px", borderRadius: 6, border: "1px solid transparent" }}
              >
                <div style={{ paddingRight: 28 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "#9CA3AF", lineHeight: 1, marginBottom: 5 }}>Payment Terms</div>
                  <div className="truncate" style={{ fontSize: 13, fontWeight: 600, color: "#1F2937", lineHeight: 1 }}>{paymentTerms}</div>
                </div>
              </HoverEditRow>
              <div className="bg-secondary" style={{ height: 1, margin: "0 6px" }} />

              {/* Freight Method */}
              <HoverEditRow editable onEdit={() => setShowPaymentMethodModal(true)}
                style={{ padding: "8px 10px", margin: "0 -4px", borderRadius: 6, border: "1px solid transparent" }}
              >
                <div style={{ paddingRight: 28 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "#9CA3AF", lineHeight: 1, marginBottom: 5 }}>Payment Method</div>
                  <div className="flex items-center overflow-hidden" style={{ gap: 5 }}>
                    <CreditCard className="text-primary shrink-0" style={{ width: 12, height: 12 }} />
                    <span className="truncate" style={{ fontSize: 13, fontWeight: 600, color: "#1F2937", lineHeight: 1 }}>{paymentMethod}</span>
                  </div>
                </div>
              </HoverEditRow>
            </div>
          )}
        </div>}
      </div>

      {/* ═══════ 2. ORDER SUMMARY ═══════ */}
      <div style={cardStyle}>
        <SectionHeader icon={DollarSign} label="Order Summary" collapsed={summaryCollapsed} onToggle={() => setSummaryCollapsed(!summaryCollapsed)} />

        {!summaryCollapsed && <div className="flex flex-col" style={{ padding: "10px 0 12px" }}>
          {/* Currency block — surfaces the FX context that drives all the totals below. */}
          <OrderSummaryCurrencyBlock
            customerCurrency={so.currency}
            lockedRate={so.lockedRate}
            onOpenConfig={onOpenCurrencyConfig}
          />
          {/* Subtotal */}
          <div className="flex justify-between items-center" style={{ padding: "10px 0", borderBottomWidth: 1, borderBottomStyle: "dashed", borderBottomColor: "#E5E7EB" }}>
            <span style={{ fontSize: 13, color: "#1F2937", fontWeight: 500, lineHeight: 1 }}>
              Subtotal <span style={{ fontWeight: 400, color: "#9CA3AF" }}>({so.lines.length} items)</span>
            </span>
            <span style={{ fontSize: 13, color: "#1F2937", fontWeight: 600, lineHeight: 1 }}>
              <OrderMoney valuePKR={subtotal} customerCurrency={so.currency} view={viewMode} lockedRate={so.lockedRate} lockedAt={so.lockedAt} />
            </span>
          </div>

          {/* Pricing Rules Applied */}
          <div style={{ padding: "12px 0", borderBottomWidth: 1, borderBottomStyle: "dashed", borderBottomColor: "#E5E7EB" }}>
            <div className="flex justify-between items-center">
              <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 400, lineHeight: 1 }}>Pricing Rules Applied</span>
              <span style={{ fontSize: 13, color: "#059669", fontWeight: 500, lineHeight: 1 }}>
                <OrderMoney valuePKR={-pricingRulesAmount} customerCurrency={so.currency} view={viewMode} lockedRate={so.lockedRate} lockedAt={so.lockedAt} />
              </span>
            </div>
            <SummaryInfoRow label={`3 rules · applied to ${so.lines.length} items`} onClick={() => setShowPricingRules(true)} />
          </div>

          {/* One-Time Discounts/Premiums */}
          <div style={{ padding: "12px 0" }}>
            <div className="flex justify-between items-center">
              <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 400, lineHeight: 1 }}>One-Time Discounts/Premiums</span>
              <span style={{ fontSize: 13, color: "#DC2626", fontWeight: 500, lineHeight: 1 }}>
                +<OrderMoney valuePKR={discountsPremiums} customerCurrency={so.currency} view={viewMode} lockedRate={so.lockedRate} lockedAt={so.lockedAt} />
              </span>
            </div>
            <SummaryInfoRow label="4 discounts/premiums · 2 order-level" onClick={() => setShowAdjustments(true)} />
          </div>

          {/* Grand Total */}
          <div className="flex justify-between items-center" style={{ paddingTop: 14, marginTop: 4, borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "#E5E7EB" }}>
            <span style={{ fontSize: 14, color: "#1F2937", fontWeight: 600, lineHeight: 1 }}>Grand Total</span>
            <span style={{ fontSize: 16, color: "#1F2937", fontWeight: 700, lineHeight: 1 }}>
              <OrderMoney valuePKR={grandTotal} customerCurrency={so.currency} view={viewMode} lockedRate={so.lockedRate} lockedAt={so.lockedAt} />
            </span>
          </div>

          {/* Invoice Summary — SO specific */}
          <div className="border-t border-border" style={{ paddingTop: 10, marginTop: 10 }}>
            <InvoiceSidebarSummary so={so} viewMode={viewMode} onOpenInvoicing={onOpenInvoicing} />
          </div>
        </div>}
      </div>

      {/* ═══════ 3. TIMELINE ═══════ */}
      <div style={cardStyle}>
        <SectionHeader icon={CalendarDays} label="Timeline" collapsed={timelineCollapsed} onToggle={() => setTimelineCollapsed(!timelineCollapsed)} />

        {!timelineCollapsed && <div style={{ padding: "10px 0 12px" }}>
          <div className="flex flex-col" style={{ gap: 6 }}>
            {timelineEntries.map((entry, idx) => (
              <TimelineDateRow
                key={entry.key}
                entry={entry}
                onEdit={(key) => { if (entry.editable) setEditingDateKey(key); }}
                isLast={idx === timelineEntries.length - 1}
              />
            ))}
          </div>

          {/* Status pill — styled as inline alert */}
          {statusPill && (
            <div
              style={{
                display: "flex", alignItems: "center", gap: 8,
                marginTop: 10, padding: "8px 12px", borderRadius: 6,
                backgroundColor: statusPill.icon === "alert" ? "rgba(245, 158, 11, 0.08)" : "rgba(124, 58, 237, 0.06)",
              }}
            >
              {statusPill.icon === "alert"
                ? <AlertCircle className="shrink-0" style={{ width: 13, height: 13, color: "rgba(180, 83, 9, 0.7)" }} />
                : <Clock className="shrink-0" style={{ width: 13, height: 13, color: "rgba(109, 40, 217, 0.7)" }} />
              }
              <span style={{
                fontSize: "var(--text-small)", fontWeight: 500, lineHeight: 1.3,
                color: statusPill.icon === "alert" ? "#92400E" : "#6D28D9",
              }}>
                {statusPill.text}
              </span>
            </div>
          )}
        </div>}
      </div>

      {/* ═══════ 4. OWNERSHIP & HISTORY ═══════ */}
      <div style={cardStyle}>
        <SectionHeader icon={UserCircle} label="Ownership & History" collapsed={infoCollapsed} onToggle={() => setInfoCollapsed(!infoCollapsed)} />

        {!infoCollapsed && <div style={{ padding: "10px 0 12px" }}>
          <div className="flex flex-col" style={{ gap: 16 }}>
            <div style={{ padding: "0 6px" }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "#9CA3AF", lineHeight: 1, marginBottom: 6 }}>Created On</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#1F2937", lineHeight: 1 }}>
                {formatDateDisplay(so.createdDate)}
              </div>
            </div>
            <div style={{ padding: "0 6px" }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "#9CA3AF", lineHeight: 1, marginBottom: 6 }}>Created By</div>
              <div className="flex items-center" style={{ gap: 6 }}>
                <AvatarCircle name={createdBy} size={20} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#1F2937", lineHeight: 1 }}>{createdBy}</span>
              </div>
            </div>
          </div>

          <div style={{ height: 18 }} />

          <div style={{ fontSize: 11, fontWeight: 500, color: "#9CA3AF", lineHeight: 1, marginBottom: 8, padding: "0 6px" }}>
            Sales Representatives
          </div>

          <SalesRepSelectorDropup so={so} />
        </div>}
      </div>
    </div>
    <PricingRulesManageModal isOpen={showPricingRules} onClose={() => setShowPricingRules(false)} />
    <ManageAdjustmentsModal isOpen={showAdjustments} onClose={() => setShowAdjustments(false)} />
    {addressModalType && (
      <AddressSelectionModal
        isOpen
        onClose={() => setAddressModalType(null)}
        onSelect={(address, _partner) => {
          if (addressModalType === "billing") {
            setBillingAddress({ label: address.label, street: address.street, city: address.city, state: address.state, zip: address.zip });
          } else {
            setShippingAddress({ label: address.label, street: address.street, city: address.city, state: address.state, zip: address.zip });
          }
          toast.success(`${addressModalType === "billing" ? "Billing" : "Shipping"} address updated`);
          setAddressModalType(null);
        }}
        type={addressModalType}
        customerName={so.customer}
        currentCustomer={{ id: "cust-1", name: so.customer, type: "Customer", location: "Rockford, IL" }}
        currentAddress={null}
      />
    )}
    {showRecipientsModal && (
      <RecipientsSelectionModal
        isOpen
        onClose={() => setShowRecipientsModal(false)}
        onSelect={(recipients) => {
          toast.success(`${recipients.length} contact(s) updated`);
          setShowRecipientsModal(false);
        }}
        currentCustomerId="cust-1"
        currentCustomerName={so.customer}
      />
    )}
    {showPaymentTermsModal && (
      <PaymentTermsLibrary
        isOpen
        onClose={() => setShowPaymentTermsModal(false)}
        onSelect={(term) => {
          setPaymentTerms(term.name);
          toast.success(`Payment terms set to ${term.name}`);
          setShowPaymentTermsModal(false);
        }}
        customerName={so.customer}
      />
    )}
    {showPaymentMethodModal && (
      <PaymentMethodSelectionModal
        isOpen
        onClose={() => setShowPaymentMethodModal(false)}
        onSelect={(method) => {
          setPaymentMethod(method.name);
          toast.success(`Payment method set to ${method.name}`);
          setShowPaymentMethodModal(false);
        }}
        customerName={so.customer}
      />
    )}
    {editingDateKey && (
      <DateEditModal
        type={editingDateKey === "shipBy" ? "estShip" : "dueDelivery"}
        isOpen
        onClose={() => setEditingDateKey(null)}
        onSave={() => {
          toast.success("Date updated");
          setEditingDateKey(null);
        }}
        initialConfig={{ dateType: "absolute", absoluteValue: "", relativeValue: "20", relativeUnit: "days" }}
      />
    )}
    </>
  );
}