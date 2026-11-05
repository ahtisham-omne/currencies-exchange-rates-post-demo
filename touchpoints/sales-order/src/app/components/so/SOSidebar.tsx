import { useState, useRef, useEffect, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/app/components/shared/Avatar";
import { TagStrip } from "@/app/components/shared/EntityTagChip";
import {
  Pencil, ChevronDown, Users, DollarSign, MapPinned, CalendarDays,
  CreditCard, Truck, Clock, AlertCircle, AlertTriangle, Info, X, Plus,
  UserCircle, Search, Star, Briefcase,
  Calendar, FilePlus, Check, CheckCircle2, Send, Tag,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/app/components/ui/tooltip";
import type { SalesOrder, SalesRep, SOStatus } from "./types";
import { useSOStore } from "./store";
import { InvoiceSidebarSummary } from "./InvoicingTab";
import { PricingRulesManageModal } from "./PricingRulesManageModal";
import { ManageAdjustmentsModal, AddOrderLevelAdjustmentModal } from "./ManageAdjustmentsModal";
import { AddressSelectionModal } from "./AddressSelectionModal";
import { RecipientsSelectionModal } from "./RecipientsSelectionModal";
import { PaymentTermsLibrary } from "./PaymentTermsLibrary";
import { PaymentMethodSelectionModal } from "./PaymentMethodSelectionModal";
import { ShipmentMethodModal, DEFAULT_SHIPMENT, describeShipment, getShipmentDates, type ShipmentConfig, type ShipmentMethodId } from "./ShipmentMethodModal";
import { FreightBreakdownModal, type FreightLine } from "@/app/components/shared/FreightBreakdownModal";
import { DateEditModal, type SODateType } from "./ui/DateEditModal";
import { DashInfoCard, DashInfoLabel } from "@/app/components/shared/DashInfoCard";
import {
  PrimaryContactCard,
  SecondaryContactsToggle,
  LocationCard,
  PaymentTermCard,
  PaymentMethodCard,
  InnerAccordion,
  CustomerIdentityRow,
} from "@/app/components/shared/SidebarPrimitives";
import { ChangeCustomerModal } from "./ChangeCustomerModal";
import type { CreatedCustomerPayload } from "@/app/components/external/partners/CreateCustomerModal";
import type { CreatedContactPayload } from "@/app/components/external/partners/CreateContactModal";
import { openPartnerTab } from "@/app/components/external/partners/openPartnerTab";
import StateTransitionOverlay from "@/app/components/shared/StateTransitionOverlay";
import { LocationSelectionModal } from "./LocationSelectionModal";
import { summarizeSO } from "./summarizeSO";
import type { Customer as MockCustomer, CustomerLocation } from "./CreateSOModal";
import { MOCK_CUSTOMERS } from "./CreateSOModal";
import { ConfirmDiscardModal } from "@/app/components/shared/ConfirmDiscardModal";
import { CustomerSwitchOverlay } from "@/app/components/shared/CustomerSwitchOverlay";
import { getCustomerDefaults, isSparseCustomer } from "@/app/components/shared/customerDefaults";
import { FIELD_RULES, isMissing } from "@/app/components/shared/fieldRequirements";
import { SO_SALES_REP_ROSTER } from "./salesRepRoster";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════════════════════
 *  Props
 * ═══════════════════════════════════════════════════════════════════════════ */
interface Props {
  so: SalesOrder;
  onOpenInvoicing?: () => void;
  /** Fires whenever a pricing-rule or one-time-adjustment change inside the
   *  sidebar's Manage modals constitutes a material change. SODetail wires
   *  this into the auto-version-prompt flow so post-draft mutations gate
   *  behind a new-version confirmation. */
  onMaterialEvent?: (description: string, onRevert?: () => void) => void;
  /** Shared pricing-rules state from SODetail. Forwarded to the
   *  PricingRulesManageModal so summary + configurator stay in lockstep. */
  pricingAPI: import('./usePricingRules').PricingRulesAPI;
  /** Shared one-time-adjustments state from SODetail. Forwarded to the
   *  ManageAdjustmentsModal so summary + configurator stay in lockstep. */
  adjustmentsAPI: import('./useAdjustments').AdjustmentsAPI;
  /** True after a Release attempt was blocked. Fields that block
   *  release (Ship to) then render red with their missing message
   *  until filled. Set by SODetail. */
  releaseAttempted?: boolean;
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
          className={`absolute right-[10px] top-1/2 -translate-y-1/2 flex items-center justify-center transition-all text-primary ${hovered ? "opacity-100" : "opacity-0"}`}
          aria-hidden
        >
          <Pencil style={{ width: 12, height: 12 }} />
        </div>
      )}
    </div>
  );
}

// (SectionHeader replaced by `<DashInfoCard>` from src/app/components/shared.)

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
/* Active-state count link inside the Summary card. Inherits the colour
   of the value on the right — green for discounts, purple for premiums
   — so the row + its sub-link read as one semantic group. Falls back
   to primary blue when no colour is supplied so generic / empty-state
   callers still get a link feel. */
function SummaryInfoRow({ label, onClick, color }: { label: string; onClick: () => void; color?: string }) {
  /* Reads as a tappable section (Partner Management hover-background
     pattern: `bg-primary/5` tint on hover, no underline) rather than a
     textual link. Text inherits the value colour (green / purple /
     slate-700 neutral) so the row reads as one semantic group. Pencil
     stays in `text-muted-foreground/60` to match every other always-
     visible edit pencil in the sidebar. */
  const effectiveColor = color || "#334155";
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-1 transition-colors border-none bg-transparent hover:bg-primary/5 cursor-pointer"
      style={{ padding: "3px 6px", margin: "6px -6px 0", borderRadius: 5, fontSize: 11, fontWeight: 500, lineHeight: 1, fontFamily: "Inter, system-ui, sans-serif", color: effectiveColor }}
    >
      <span>{label}</span>
      <Pencil className="shrink-0 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity" style={{ width: 10, height: 10 }} />
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

/**
 * AvatarCircle — thin wrapper around the shared `<Avatar>` so existing call
 * sites (`<AvatarCircle name=… size=… borderColor=…/>`) keep working. New
 * code should import `Avatar` directly from `@/app/components/shared/Avatar`.
 */
function AvatarCircle({ name, size = 24, borderColor }: { name: string; size?: number; fontSize?: string; borderColor?: string }) {
  // `borderColor` is preserved as a prop for compatibility, but we map it
  // to the shared component's ring system: only the primary case is used.
  const ring = borderColor ? "primary" : "none";
  return <Avatar name={name} size={size} ring={ring} />;
}

/* ── Timeline date row with icon-circle + connector ── */
interface TimelineEntry {
  key: string; label: string; value: string; color: string; dotColor: string; dotFill?: boolean; editable?: boolean;
  /** Step icon — Purchase Order `Timeline` recipe. When present the
   *  row renders a 22×22 icon circle; legacy entries without an icon
   *  fall back to the prior 11×11 dot. */
  icon?: React.ElementType;
  /** Always-on contextual hint (Partner-style Info icon + tooltip). */
  infoTooltip?: string;
  /** Conditional warning (Partner-style amber AlertTriangle + tooltip). */
  warningTooltip?: string;
}

function TimelineDateRow({ entry, onEdit, isLast }: {
  entry: TimelineEntry; onEdit: (key: string) => void; isLast: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const isEditable = entry.editable !== false;
  const StepIcon = entry.icon;
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => isEditable && onEdit(entry.key)}
      className={`flex items-center transition-colors ${isEditable ? "cursor-pointer" : ""} ${hovered && isEditable ? "bg-primary/5" : ""}`}
      style={{ gap: 10, padding: "5px 6px", margin: "0 -6px", borderRadius: 5 }}
    >
      {/* Step indicator — Purchase Order `Timeline` icon-circle recipe
          (`PurchaseOrderDraft.tsx:4037-4058`). Falls back to the prior
          11×11 dot for legacy entries that don't set `icon`. */}
      {StepIcon ? (
        <div className="relative shrink-0" style={{ width: 22, height: 22 }}>
          <div
            className="relative z-10 rounded-full flex items-center justify-center"
            style={{
              width: 22, height: 22,
              backgroundColor: `color-mix(in srgb, ${entry.dotColor} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${entry.dotColor} 30%, transparent)`,
              transition: "all 0.3s ease",
            }}
          >
            <StepIcon style={{ width: 11, height: 11, color: entry.dotColor, strokeWidth: 2.2 }} />
          </div>
          {!isLast && (
            <div
              className="absolute bg-border"
              style={{ left: "50%", top: 22, transform: "translateX(-50%)", width: 1, height: 14 }}
            />
          )}
        </div>
      ) : (
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
      )}
      {/* Content — label (+ info indicator) + value (+ warning indicator) + pencil */}
      <div className="flex items-center justify-between flex-1 min-w-0" style={{ gap: 8 }}>
        <div className="flex items-center" style={{ gap: 4, minWidth: 0 }}>
          <span className="text-muted-foreground whitespace-nowrap" style={{ fontSize: "var(--text-small)", fontWeight: "var(--font-weight-medium)", lineHeight: 1 }}>
            {entry.label}
          </span>
          {entry.infoTooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
                </span>
              </TooltipTrigger>
              {/* Partner-style white hover card — overrides shadcn's
                  default dark `bg-primary text-primary-foreground`
                  tooltip with the same soft chrome we use on the PoC
                  scope-pill hover cards. */}
              <TooltipContent
                side="top"
                sideOffset={6}
                hideArrow
                className="max-w-[280px] z-[300] rounded-lg border border-border bg-white text-foreground p-3 text-[11.5px] leading-[1.5]"
                style={{ boxShadow: "0 8px 24px rgba(15, 23, 42, 0.10)", fontWeight: 400 }}
              >
                {entry.infoTooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center">
          {entry.warningTooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex shrink-0"
                  style={{ marginRight: 4 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <AlertTriangle className="w-3 h-3 cursor-help" style={{ color: "#D97706" }} />
                </span>
              </TooltipTrigger>
              {/* Partner-style white hover card with a warm-amber
                  accent on the leading edge so it still reads as a
                  warning, not an info note. */}
              <TooltipContent
                side="top"
                sideOffset={6}
                hideArrow
                className="max-w-[280px] z-[300] rounded-lg border bg-white text-foreground p-3 text-[11.5px] leading-[1.5]"
                style={{
                  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.10)",
                  fontWeight: 400,
                  borderColor: "rgba(217, 119, 6, 0.30)",
                  borderLeftWidth: 3,
                  borderLeftColor: "#D97706",
                }}
              >
                {entry.warningTooltip}
              </TooltipContent>
            </Tooltip>
          )}
          {(() => {
            /* Split a range value (e.g. "07/07/2026 – 07/09/2026") onto
               two right-aligned lines so a two-date row doesn't push
               against the label and blow out the timeline column
               width. Single-date entries stay on one line. */
            const parts = entry.value.split(" – ");
            if (parts.length === 2) {
              return (
                <div className="flex flex-col items-end" style={{ gap: 1 }}>
                  <span className="whitespace-nowrap text-right tabular-nums" style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.15, color: entry.color }}>
                    {parts[0]}
                  </span>
                  <span className="whitespace-nowrap text-right tabular-nums" style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.15, color: entry.color, opacity: 0.75 }}>
                    – {parts[1]}
                  </span>
                </div>
              );
            }
            return (
              <span className="whitespace-nowrap text-right tabular-nums" style={{ fontSize: 12, fontWeight: 500, lineHeight: 1, color: entry.color }}>
                {entry.value}
              </span>
            );
          })()}
          <div className="shrink-0 flex justify-end" style={{ width: 17 }}>
            {isEditable && (
              <Pencil
                className={`shrink-0 text-primary transition-opacity ${hovered ? "opacity-100" : "opacity-0"}`}
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
/* Sidebar rep roster comes from the shared module so the "you" rep
   matches the creation modal. Was a parallel list that flagged
   Sarah Chen as you while the creation modal flagged Yahya Naveed
   — after a fresh SO the sidebar saw a name not in its list and the
   picker rendered nothing as checked. */
const ALL_SALES_REPS = SO_SALES_REP_ROSTER.map((r) => ({
  name: r.name,
  isYou: !!r.isYou,
  customerDefault: false,
}));

/* ═══════════════════════════════════════════════════════════════════════════
 *  Sales Rep Selector Drop-up (SO-specific, with store integration)
 * ═══════════════════════════════════════════════════════════════════════════ */
/**
 * Sales-rep "trigger row" — read-only display of the assigned rep(s) for the
 * sidebar. Designed to be wrapped by a parent `HoverEditRow` so the *entire*
 * gray Sales Reps card is the click target (matches the PoC pattern).
 *
 * The picker UI itself is rendered as a centered, portaled modal —
 * `SalesRepPickerModal` below — so it can never be clipped by the sidebar's
 * overflow.
 */
function SalesRepTriggerRow({ so }: { so: SalesOrder }) {
  const assignedReps = getAssignedReps(so);
  const primaryRep = assignedReps.find(r => r.primary) || assignedReps[0];
  const otherAssigned = assignedReps.filter(r => r.name !== primaryRep?.name);

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
            {otherAssigned.slice(0, 3).map((rep) => (
              <AvatarCircle key={rep.name} name={rep.name} size={18} fontSize="7px" />
            ))}
          </div>
          <span className="text-muted-foreground whitespace-nowrap shrink-0" style={{ fontSize: "var(--text-micro)", lineHeight: 1 }}>
            +{otherAssigned.length} more
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Sales-rep picker — partner-style centered modal (header + search + list +
 * footer). Replaces the previous absolute-positioned drop-up that was being
 * clipped by the sidebar's `overflow: hidden`.
 */
function SalesRepPickerModal({ so, isOpen, onClose }: { so: SalesOrder; isOpen: boolean; onClose: () => void }) {
  const store = useSOStore();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const assignedReps = getAssignedReps(so);
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
    if (newReps.length > 0 && !newReps.some(r => r.primary)) newReps[0] = { ...newReps[0], primary: true };
    store.updateSO(so.id, { salesReps: newReps, salesRep: newReps.find(r => r.primary)?.name || newReps[0]?.name || so.salesRep });
  };

  const setPrimary = (name: string) => {
    const newReps = assignedReps.map(r => ({ ...r, primary: r.name === name }));
    store.updateSO(so.id, { salesReps: newReps, salesRep: name });
  };

  // Portal to document.body so the modal escapes the sidebar's stacking
  // context (the sidebar sits inside a sticky parent with overflow rules
  // that were clipping the backdrop blur — the overlay rendered with a
  // half-broken background until escaped).
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 12200, backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col bg-card overflow-hidden"
        style={{
          width: "min(480px, calc(100vw - 32px))",
          maxHeight: "min(560px, calc(100vh - 96px))",
          borderRadius: 16,
          boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>Sales representatives</h3>
          <button
            onClick={onClose}
            className="hover:bg-secondary"
            style={{ width: 32, height: 32, borderRadius: 8, border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            aria-label="Close"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 20px 8px" }}>
          <div className="flex items-center border border-border rounded-md bg-card" style={{ gap: 8, padding: "8px 12px" }}>
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search sales representatives..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
              style={{ fontSize: "var(--text-caption)" }}
            />
          </div>
        </div>

        {/* Assigned chips */}
        <div style={{ padding: "0 20px 12px" }}>
          <div className="text-muted-foreground" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", marginBottom: 6 }}>
            Assigned ({assignedReps.length})
          </div>
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {assignedReps.map((rep) => (
              <div key={rep.name} className="flex items-center bg-secondary rounded-full" style={{ gap: 6, padding: "4px 6px" }}>
                <AvatarCircle name={rep.name} size={20} fontSize="var(--text-micro)" />
                <span className="text-foreground" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}>{rep.name}</span>
                {rep.primary && (
                  <span className="text-primary rounded" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", padding: "1px 6px", backgroundColor: "rgba(10, 119, 255, 0.1)" }}>
                    Primary
                  </span>
                )}
                {!rep.primary && assignedReps.length > 1 && (
                  <button onClick={(e) => { e.stopPropagation(); toggleRep(rep.name); }} className="text-muted-foreground hover:text-foreground/60 transition-colors" aria-label={`Remove ${rep.name}`}>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="border-t border-border overflow-y-auto" style={{ flex: 1 }}>
          {filteredReps.map((rep) => {
            const assigned = isAssigned(rep.name);
            const primary = isPrimary(rep.name);
            return (
              <div
                key={rep.name}
                onClick={() => toggleRep(rep.name)}
                className={`flex items-center hover:bg-secondary transition-colors cursor-pointer ${assigned ? "bg-primary/[0.03]" : ""}`}
                style={{ gap: 10, padding: "10px 20px" }}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${assigned ? "bg-primary border-primary" : "border-border"}`}>
                  {assigned && (
                    <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <AvatarCircle name={rep.name} size={28} fontSize="var(--text-caption)" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center" style={{ gap: 6 }}>
                    <span className="text-foreground" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-medium)" }}>{rep.name}</span>
                    {rep.isYou && <span className="text-muted-foreground" style={{ fontSize: "var(--text-caption)" }}>(You)</span>}
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
          {filteredReps.length === 0 && (
            <div className="text-center text-muted-foreground" style={{ padding: "24px 20px", fontSize: "var(--text-caption)" }}>
              No matching representatives
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end" style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", gap: 8 }}>
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-card hover:bg-secondary text-foreground"
            style={{ height: 36, padding: "0 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Timeline helpers (SO-specific stages)
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Derive the header Ship By from line items. Returns whether 2+ lines have
 *  divergent ship-by dates and the name of the line driving the earliest.
 *
 *  Each line's ship-by comes from its `shipmentConfig`:
 *    • Carrier methods (courier-pickup/dropby): the explicit
 *      `expectedShipDate` when pinned, else a method-based fallback.
 *    • Customer Pickup: same field — the Pick Up Date IS the ship-by
 *      because there's no carrier transit step.
 *  We delegate to `getShipmentDates` so the same logic that drives the
 *  shipment modal's dates feeds the header. */
function computeLineShipBy(lines?: any[]): { hasDivergence: boolean; earliestLineName: string | null } {
  if (!lines || lines.length === 0) return { hasDivergence: false, earliestLineName: null };
  const today = new Date();
  const parsed: { ts: number; name: string }[] = [];
  for (const li of lines) {
    if (!li) continue;
    const cfg: ShipmentConfig | undefined = li.shipmentConfig;
    let ts: number | null = null;
    if (cfg && cfg.method) {
      const { shipBy } = getShipmentDates(cfg, today);
      const normalized = new Date(shipBy.getFullYear(), shipBy.getMonth(), shipBy.getDate());
      ts = normalized.getTime();
    } else {
      const raw = li.shipBy ?? li.shipByDate ?? li.estShipDate ?? li.shipDate;
      if (raw) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
          const normalized = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          ts = normalized.getTime();
        }
      }
    }
    if (ts === null) continue;
    const name = li.itemName ?? li.productName ?? li.name ?? li.itemCode ?? li.partNumber ?? li.sku ?? "this line";
    parsed.push({ ts, name });
  }
  if (parsed.length === 0) return { hasDivergence: false, earliestLineName: null };
  parsed.sort((a, b) => a.ts - b.ts);
  const distinct = new Set(parsed.map((p) => p.ts));
  return { hasDivergence: distinct.size >= 2, earliestLineName: parsed[0].name };
}

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

/* Format an ISO yyyy-mm-dd into the local mm/dd/yyyy used by the
   timeline rows. Returns empty when iso is empty/invalid. */
function isoToTimelineDate(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${y}`;
}

function buildSOTimelineEntries(
  so: SalesOrder,
  shipmentDates?: { shipByIso?: string; deliveryIso?: string; deliveryEndIso?: string; method?: ShipmentMethodId },
): TimelineEntry[] {
  const isFromQuote = !!so.sourceQuoteRef;
  const createdDate = so.createdDate;
  const statusOrder: SOStatus[] = ["Draft", "Pending Review", "Cleared", "Partially Shipped", "Shipped"];
  const statusIdx = statusOrder.indexOf(so.status);
  const isClearedPlus = statusIdx >= 2;
  const isShippedPlus = statusIdx >= 4;
  const entries: TimelineEntry[] = [];

  // Requested On — the customer-requested date (formerly "Order Date").
  // Sits first in the timeline because a request from the customer is what
  // kicks off the lifecycle before this SO gets created in the system.
  // Editable so an account manager can correct the requested date.
  const requestedDate = so.orderDate || createdDate;
  entries.push({
    key: "requested", label: "Requested On", value: formatDateDisplay(requestedDate),
    color: "var(--foreground)", dotColor: "var(--muted-foreground)", editable: true,
    icon: Calendar,
  });

  // Created
  entries.push({
    key: "created", label: "Created On", value: formatDateDisplay(createdDate),
    color: "var(--foreground)", dotColor: "var(--muted-foreground)", editable: false,
    icon: FilePlus,
  });

  /* "Converted On" was previously shown for quote-sourced SOs but
     was confusing next to "Created On" — the two dates were nearly
     identical and users read them as duplicates. Timeline now goes
     Requested On → Created On → Cleared → Ship By → Delivery for
     both direct and quote-sourced orders. */
  void isFromQuote;

  // Released
  if (isClearedPlus) {
    entries.push({
      key: "cleared", label: "Released", value: addDays(createdDate, isFromQuote ? 5 : 2),
      color: so.status === "Cleared" ? "var(--primary)" : "var(--foreground)",
      dotColor: so.status === "Cleared" ? "var(--primary)" : "var(--success)",
      editable: false,
      icon: Check,
    });
  }

  // Ship By / Pick Up — when the shipment is set to customer pickup
  // the order never enters carrier transit, so the milestone is the
  // pickup appointment, not a ship-by. Label flips and the separate
  // delivery row drops because pickup = delivery same day.
  //
  // Ship By at the header is a derived, read-only value: it reflects the
  // earliest ship-by across the SO's line items. An always-on Info icon
  // explains this; an amber AlertTriangle surfaces when 2+ lines have
  // differing ship-by dates and names the line driving the earliest one.
  const isCustomerPickup = shipmentDates?.method === "customer-pickup";
  const shipByDate = isoToTimelineDate(shipmentDates?.shipByIso) || addDays(createdDate, 30);
  const today = new Date();
  const shipByParts = shipByDate.split("/").map(Number);
  const shipByD = new Date(+shipByParts[0] || 2026, (shipByParts[0] > 12 ? shipByParts[1] : shipByParts[0]) - 1, shipByParts[2] || 1);
  const shipByDiff = Math.ceil((shipByD.getTime() - today.getTime()) / 86400000);
  const shipByNear = shipByDiff >= 0 && shipByDiff <= 14;
  const shipByPast = shipByDiff < 0;
  const lineShipInfo = computeLineShipBy(so.lines as any[] | undefined);
  const shipByInfoText = isCustomerPickup
    ? "Earliest pickup date across all line items in this order. Set manually by the user in each item's advanced configuration."
    : "Earliest ship-by date across all line items in this order. Set manually by the user in each item's advanced configuration.";
  const shipByWarningText = lineShipInfo.hasDivergence && lineShipInfo.earliestLineName
    ? `Earliest ${isCustomerPickup ? "pickup" : "ship-by"} date, from ${lineShipInfo.earliestLineName}. Other items in this order have later ${isCustomerPickup ? "pickup" : "ship-by"} dates.`
    : undefined;
  entries.push({
    key: "shipBy", label: isCustomerPickup ? "Pick Up" : "Ship By", value: shipByDate,
    color: shipByPast ? "var(--destructive)" : shipByNear ? "var(--chart-3)" : "var(--foreground)",
    dotColor: shipByPast ? "var(--destructive)" : shipByNear ? "var(--chart-3)" : "var(--muted-foreground)",
    editable: false,
    infoTooltip: shipByInfoText,
    warningTooltip: shipByWarningText,
    icon: Send,
  });

  // Expected Delivery — hidden for customer pickup (the customer
  // takes the goods at pickup, so delivery = pickup date). For all
  // other methods, prefer the Shipment modal value when set. The
  // Expected Delivery is a WINDOW (from → to) driven by the carrier's
  // transit days; we surface the range as two stacked lines in the
  // timeline via `TimelineDateRow`'s built-in " – " split renderer
  // (SOSidebar.tsx:362) — the start date sits on the first line and
  // the end date wraps beneath it prefixed with an en-dash, keeping
  // the row visually neat and matching the pattern already used by
  // other range dates in the SO sidebar. Collapses to a single line
  // when start === end (methods with a same-day promise).
  if (!isCustomerPickup) {
    const startDisplay =
      isoToTimelineDate(shipmentDates?.deliveryIso) ||
      (so.requestedDeliveryDate ? formatDateDisplay(so.requestedDeliveryDate) : addDays(createdDate, 45));
    const endDisplay = isoToTimelineDate(shipmentDates?.deliveryEndIso) || startDisplay;
    const deliveryDate = endDisplay && endDisplay !== startDisplay
      ? `${startDisplay} – ${endDisplay}`
      : startDisplay;
    entries.push({
      key: "delivery", label: "Expected Delivery", value: deliveryDate,
      color: so.status === "Shipped" ? "var(--primary)" : "var(--foreground)",
      dotColor: isShippedPlus ? "var(--success)" : "var(--muted-foreground)",
      editable: true,
      icon: Truck,
    });
  }

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

/* Reps assigned to an SO. An explicit `salesReps: []` or a blank
   `salesRep` means nobody is assigned; never fabricate a rep. */
function getAssignedReps(so: SalesOrder): SalesRep[] {
  if (so.salesReps) return so.salesReps.filter((r) => !isMissing(r.name));
  return isMissing(so.salesRep) ? [] : [{ name: so.salesRep, primary: true }];
}

type SidebarAddress = { label: string; street: string; city: string; state: string; zip: string };
const EMPTY_ADDRESS: SidebarAddress = { label: "", street: "", city: "", state: "", zip: "" };

/* Parse a record address ("street[, unit], city, ST zip") into the
   sidebar's shape. "" gives the empty address, so the card shows its
   empty state. */
function parseRecordAddress(raw: string | undefined, label: string): SidebarAddress {
  if (isMissing(raw)) return EMPTY_ADDRESS;
  const parts = (raw as string).split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return { label, street: parts.join(", "), city: "", state: "", zip: "" };
  const stateZip = parts[parts.length - 1].split(/\s+/);
  const zip = /\d/.test(stateZip[stateZip.length - 1] || "") ? stateZip.pop() as string : "";
  return {
    label,
    street: parts.slice(0, parts.length - 2).join(", "),
    city: parts[parts.length - 2],
    state: stateZip.join(" "),
    zip,
  };
}

function formatSidebarAddress(a: SidebarAddress): string {
  if (!a.street) return "";
  const tail = [a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return tail ? `${a.street}, ${tail}` : a.street;
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
// (cardStyle replaced by DashInfoCard. Card outer styling now lives in the
// shared primitive at src/app/components/shared/DashInfoCard.tsx.)

/* ═══════════════════════════════════════════════════════════════════════════
 *  Mock LINE_ITEMS IDs the summary modals seed internally — keep in sync
 *  with PricingRulesManageModal.tsx + ManageAdjustmentsModal.tsx. The Phase 2
 *  demo maps so.lines[i].shippedQty>0 to MOCK_LINE_IDS[i] so the lock UI
 *  has shippable demo data even though the real ids don't match.
 * ═══════════════════════════════════════════════════════════════════════════ */
const MOCK_LINE_IDS = [
  '501-100-001', '501-100-002', '501-100-003', '501-100-004',
  '501-100-005', '501-100-006', '501-100-007',
];

function deriveShippedMockIds(so: SalesOrder): string[] {
  /* Map each real so.lines entry by index onto the mock LINE_ITEMS id at
     the same position. Only lines with shippedQty > 0 (any partial ship
     counts) get locked — Partially Shipped scope per product spec. */
  const result: string[] = [];
  so.lines.forEach((line, idx) => {
    if (line.shippedQty > 0 && idx < MOCK_LINE_IDS.length) {
      result.push(MOCK_LINE_IDS[idx]);
    }
  });
  return result;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  MAIN SIDEBAR COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════ */
export function SOSidebar({ so, onOpenInvoicing, onMaterialEvent, pricingAPI, adjustmentsAPI, releaseAttempted = false }: Props) {
  /* Store handle — needed so the FreightBreakdownModal can write
     order-level + per-line freight directly back to the SO. */
  const store = useSOStore();
  /* ── Subsection collapse state (top-level cards now own their collapse via DashInfoCard) ── */
  const [showAddressDetail, setShowAddressDetail] = useState(false);
  const [showPaymentShipping, setShowPaymentShipping] = useState(false);
  const [showPricingRules, setShowPricingRules] = useState(false);
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [showAddOrderLevelAdj, setShowAddOrderLevelAdj] = useState(false);
  
  /* ── Sidebar editing modal state ── */
  const [addressModalType, setAddressModalType] = useState<"billing" | "shipping" | null>(null);
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [showSalesRepPicker, setShowSalesRepPicker] = useState(false);
  const [showPaymentTermsModal, setShowPaymentTermsModal] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [showFreightBreakdown, setShowFreightBreakdown] = useState(false);
  const [editingDateKey, setEditingDateKey] = useState<string | null>(null);

  /* ── Editable state ── */
  /* Seeded from the SO record. An explicit "" (e.g. a name-only
     customer) renders the field's empty state. Older mock records
     that predate `billingAddress` / `paymentMethod` keep the previous
     demo values so their sidebars do not change. */
  const [billingAddress, setBillingAddress] = useState<SidebarAddress>(() =>
    so.billingAddress !== undefined ? parseRecordAddress(so.billingAddress, "Billing address") : MOCK_ADDRESSES.billing);
  const [shippingAddress, setShippingAddress] = useState<SidebarAddress>(() =>
    so.shippingAddress !== undefined ? parseRecordAddress(so.shippingAddress, "Shipping address") : MOCK_ADDRESSES.shipping);
  const [paymentTerms, setPaymentTerms] = useState(so.paymentTerms ?? "Net 30");
  /* Default payment method comes from the saved-methods library —
     "Main operating account" (ACH) is flagged isDefault: true there so
     the sidebar opens already showing it as the active method, and the
     selection modal opens with that card pre-applied. */
  const [paymentMethodId, setPaymentMethodId] = useState<string>(so.paymentMethod === "" ? "" : "pm-ach-1");
  const [paymentMethod, setPaymentMethod] = useState(so.paymentMethod ?? "Main operating account · ACH/Direct Deposit");
  /* Sidebar edits are written back to the record so the release check
     (store.validateForConfirmation) and documents read the same value. */
  const persistField = (updates: Partial<SalesOrder>) => store.updateSO(so.id, updates);
  /* Order-level shipment default. Now hydrated from + persisted to
     the store (`so.shipmentConfig`) so the Freight & Logistics setup
     the user makes here becomes the source of truth the shipment
     tab, PDF, and any downstream reader can pull from. Falls back to
     `DEFAULT_SHIPMENT` for legacy fixtures that don't yet carry the
     field. */
  const [shipment, setShipment] = useState<ShipmentConfig>(
    (so as any).shipmentConfig ? { ...DEFAULT_SHIPMENT, ...((so as any).shipmentConfig as ShipmentConfig) } : DEFAULT_SHIPMENT
  );
  const shipmentDescribed = describeShipment(shipment);

  /* Rehydrate whenever the SO's persisted config changes (e.g. store
     mutation from another surface). */
  useEffect(() => {
    const persisted = (so as any).shipmentConfig as ShipmentConfig | undefined;
    if (!persisted) return;
    setShipment((prev) => {
      const merged = { ...DEFAULT_SHIPMENT, ...persisted };
      const same = prev.method === merged.method
        && prev.carrierId === merged.carrierId
        && prev.carrierMethodId === merged.carrierMethodId
        && JSON.stringify(prev.pickupLocation) === JSON.stringify(merged.pickupLocation);
      return same ? prev : merged;
    });
  }, [so]);

  /* Keep the sidebar's local shipmentCost in sync with the store's
     so.freightCost. Without this the description chip would lag
     whenever the configurator's split confirmation or another surface
     mutates the order-level freight through the store. */
  useEffect(() => {
    if (typeof so.freightCost !== "number") return;
    setShipment((prev) =>
      prev.shipmentCost === so.freightCost ? prev : { ...prev, shipmentCost: so.freightCost }
    );
  }, [so.freightCost]);

  /* ── SO-specific data ──
     Subtotal + tax + freight come from the shared summarizeSO helper
     so the sidebar's "Subtotal" / "Grand Total" tiles match the
     listing's `Total` column for the same SO. Previously the
     subtotal here excluded tax + freight while the listing's `total`
     included tax, which surfaced as "$60k in listing vs $55k in
     sidebar" reports. */
  const soSummary = summarizeSO(so);
  const subtotal = soSummary.subtotal + soSummary.tax;
  /* Pricing-rules amount + count come from the shared pricingAPI so
     the sidebar reads the same numbers the configurator + manage modal
     see on first paint. The previous `Math.round(subtotal * 0.085)`
     placeholder hardcoded 8.5% of subtotal, which never reflected what
     was actually applied to the SO. Sign convention: positive number =
     net discount (reduces grand total); negative = net premium. */
  const pricingRulesAmount = pricingAPI
    ? (pricingAPI.totalDiscount - pricingAPI.totalPremium)
    : 0;
  const pricingRuleCount = pricingAPI ? pricingAPI.activeRuleCount : 0;
  // Live one-time discount/premium impact from the shared API. Positive
  // = net premium (adds to the total), negative = net discount
  // (subtracts). Previously this was a hard-coded 1.95% of subtotal,
  // which meant the sidebar number never reflected what the user
  // actually entered in the Manage Adjustments modal.
  const adjustmentsNet = adjustmentsAPI.grandTotal.net;
  const adjustmentsList = adjustmentsAPI.adjustments;
  const adjustmentCount = adjustmentsList.length;
  const quoteLevelAdjCount = adjustmentsList.filter(a => a.scope === 'quote').length;

  /* Resolved freight total. The SOSidebar doesn't yet receive per-line
     shipment costs (the lines aren't carrying shipmentConfig yet on
     this branch), so we surface the order-level shipmentCost on its
     own. When per-line wiring lands, swap the constant for
     sumLineShipmentCosts(lineShipments) ?? shipment.shipmentCost. */
  const resolvedShipmentTotal = typeof shipment.shipmentCost === "number" ? shipment.shipmentCost : 0;
  /* Freight is pinned for later, so we don't add `resolvedShipmentTotal`
     to the grand total. The variable is still computed so the
     FreightBreakdownModal stays wired when the feature is re-enabled. */
  /* Grand total = subtotal (with tax) − rules + adjustments + freight.
     Falls back to the SO record's headline `total` when no live items
     are present so the listing and sidebar show the same number. */
  const grandTotal = subtotal - pricingRulesAmount + adjustmentsNet + soSummary.freight;
  void resolvedShipmentTotal;
  /* Pull the order-level shipment's ship-by + delivery dates into
     the timeline. When the user pins values via the Shipment modal
     they replace the hardcoded created+30 / created+45 fallbacks. */
  const { shipBy: _shipByD, deliveryMin: _deliveryD, deliveryMax: _deliveryEndD } = getShipmentDates(shipment);
  const shipByIso = shipment.expectedShipDate || `${_shipByD.getFullYear()}-${String(_shipByD.getMonth() + 1).padStart(2, "0")}-${String(_shipByD.getDate()).padStart(2, "0")}`;
  const deliveryIso = shipment.estimatedDeliveryDate || `${_deliveryD.getFullYear()}-${String(_deliveryD.getMonth() + 1).padStart(2, "0")}-${String(_deliveryD.getDate()).padStart(2, "0")}`;
  /* Delivery end of the window — Expected Delivery is a range in the
     data model (carrier method transit ~= min-max days). Falls back to
     `deliveryMax` from the resolved shipment when the SO doesn't pin an
     explicit end date. Only surfaced in the timeline when it differs
     from the start (single-day methods stay as a static date). */
  const deliveryEndIso = shipment.estimatedDeliveryDateEnd || `${_deliveryEndD.getFullYear()}-${String(_deliveryEndD.getMonth() + 1).padStart(2, "0")}-${String(_deliveryEndD.getDate()).padStart(2, "0")}`;
  const timelineEntries = buildSOTimelineEntries(so, { shipByIso, deliveryIso, deliveryEndIso, method: shipment.method });
  const statusPill = getStatusPill(so);
  const createdBy = "Sarah Chen";

  /* ── Contacts ──
     Sourced from the SO record when present (set by CreateSOModal) and
     falls back to a small seed for legacy mock orders that pre-date the
     `pocs` field. RecipientsSelectionModal still persists changes back
     into this local state; the next material event will need to bubble
     the updated list onto the SO record, but UI-wise this read path is
     the one the customer card reads. */
  /* Seed POCs from the customer's defaults so the fallback list
     carries the same area code + email domain as the rest of the SO
     record. Same-customer same-location ⇒ same NPA + same email
     provider (driven by hashName(so.customer) in customerDefaults). */
  const seedDefaults = getCustomerDefaults(so.customer);
  const SEEDED_POCS: Array<{ id: string; name: string; initials: string; title: string; email: string; phone: string }> = seedDefaults.pocs.map((p, i) => ({
    id: `seed-${i}-${p.id}`,
    name: p.name,
    initials: p.initials,
    title: p.role,
    email: p.email,
    phone: p.phone || '',
  }));
  /* Local POC state now includes `email` + `phone` so the bridge into
     RecipientsSelectionModal carries real values instead of empty
     strings (which made the picker table render every row with a bare
     "+1" placeholder). */
  /* `so.pocs: []` means the customer has no contact on file: render
     the empty state. Only records that predate `pocs` (undefined) get
     the seeded demo roster. */
  const initialPocs = so.pocs
    ? so.pocs.map(p => ({
        id: p.id,
        name: p.name,
        initials: p.initials,
        title: p.title,
        email: p.email,
        phone: p.phone || '',
      }))
    : SEEDED_POCS;
  const initialPrimaryId = so.primaryPocId
    || (so.pocs?.find(p => p.isPrimary)?.id)
    || initialPocs[0]?.id
    || "";
  const [pocs, setPocs] = useState<Array<{ id: string; name: string; initials: string; title: string; email: string; phone: string }>>(initialPocs);
  const [primaryPocId, setPrimaryPocId] = useState<string>(initialPrimaryId);
  /* Sales-rep roster — same derivation `SalesRepTriggerRow` /
     `SalesRepPickerModal` use internally, lifted to the parent so the
     Ownership & History card can render the primary + secondaries via
     `PrimaryContactCard` + `SecondaryContactsToggle`. */
  const assignedReps = getAssignedReps(so);
  /* Empty name = no contact on file; PrimaryContactCard renders its
     empty state for it. */
  const primaryContact = pocs.find((p) => p.id === primaryPocId) ?? pocs[0] ?? { id: "", name: "", initials: "", title: "", email: "", phone: "" };
  const otherContacts = pocs.filter((p) => p.id !== primaryContact.id);

  /* ── Change Customer flow (SO) ──
     Gating matches the rest of the SO material-change rules:
       · Draft → free change, no confirmation friction
       · Pending Review + Cleared (zero shipped lines) →
         confirmation modal; the swap is a material change and lands
         on the activity log
       · Partially Shipped / Shipped / any shippedQty > 0 → LOCKED
         (units have left the warehouse; customer is now baked in).
     Confirmation flow mirrors the Quote sidebar: pick → confirm →
     overlay → hydrate defaults. */
  const hasAnyShippedLine = so.lines.some(l => !l.cancelled && l.shippedQty > 0);
  const customerLocked = hasAnyShippedLine || so.status === "Shipped" || so.status === "Partially Shipped";
  /* `canEdit` — the same gate Quote uses on its sidebar, generalised
     for SO: post-shipment and post-cancellation lifecycle states stop
     editable affordances (LocationCard pencils, etc.) from rendering. */
  const canEdit = !["Shipped", "Cancelled", "Archived"].includes(so.status);
  /* Always surface the confirmation prompt before swapping the
     customer — even on Draft SOs. Quote behaves the same way: the
     blast-radius checklist (PoC + addresses + payment terms + sales
     rep + rules) is informative regardless of order status. Locked
     SOs (Partially Shipped / Shipped) are still blocked upstream by
     `customerLocked`. */
  const requiresConfirm = !customerLocked;
  /* Ship to is required at release (FIELD_RULES.shipTo). Before
     release it shows the muted hint; after a blocked release attempt
     it turns red until filled. */
  const shipToMissing = isMissing(shippingAddress.street);
  const preRelease = so.status === "Draft" || so.status === "Pending Review";
  const shipToError = releaseAttempted && shipToMissing ? FIELD_RULES.shipTo.missingMessage : undefined;
  const shipToHint = preRelease && shipToMissing ? FIELD_RULES.shipTo.laterHint : undefined;
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  /* Partner-tab handshake state — when the Partner Management new
     tab posts back a created customer / contact, we hold the payload
     here so the existing change-flow pipeline (setPendingCustomerSelection
     / setPendingPocOverride) still runs locally. */
  const [pendingCustomerCreation, setPendingCustomerCreation] = useState<CreatedCustomerPayload | null>(null);
  const [pendingContactCreation, setPendingContactCreation] = useState<CreatedContactPayload | null>(null);
  /* Holds a candidate customer (and optionally a pre-picked POC)
     between the search step and the location step. Once a location
     is picked we move on to `pendingCustomerChange` for the
     confirmation prompt. Mirrors Quote's `pendingCustomerSelection`. */
  const [pendingCustomerSelection, setPendingCustomerSelection] = useState<{
    customer: MockCustomer;
    contactId?: string;
  } | null>(null);
  const [pendingCustomerChange, setPendingCustomerChange] = useState<MockCustomer | null>(null);
  const [customerSwitchInFlight, setCustomerSwitchInFlight] = useState<{ from: string; to: MockCustomer } | null>(null);
  /* POC-override confirmation — fires when the user picks a different
     contact for the SAME customer in the change-customer search. Same
     chrome as the customer-change confirmation so the two prompts
     feel consistent. */
  const [pendingPocOverride, setPendingPocOverride] = useState<{
    id: string;
    name: string;
    initials: string;
    title: string;
    email: string;
    phone: string;
  } | null>(null);

  const applyCustomerChange = (next: MockCustomer) => {
    const defaults = getCustomerDefaults(next.name);
    /* On a customer switch we seed the SO with the new customer's
       flagged primary as the SOLE recipient — additional contacts
       remain available behind the picker so the user opts them in
       intentionally. Matches the SO creation flow's behaviour and
       avoids reusing the previous customer's attached roster. */
    const primaryRaw = next.pocs.find((p) => p.isPrimary) ?? next.pocs[0];
    const nextPocs = primaryRaw
      ? [{ id: primaryRaw.id, name: primaryRaw.name, initials: primaryRaw.initials, title: primaryRaw.role, email: primaryRaw.email, phone: primaryRaw.phone || '' }]
      : [];
    setPocs(nextPocs);
    setPrimaryPocId(primaryRaw?.id || '');
    /* A sparse customer (name only, see customerDefaults) has no
       addresses, terms, method or rep. Each lands empty and renders
       its empty state instead of throwing on `.street`. */
    const bill = defaults.billingAddress;
    const ship = defaults.shippingAddress;
    setBillingAddress(bill ? { label: bill.label, street: bill.street, city: bill.city, state: bill.state, zip: bill.zip } : EMPTY_ADDRESS);
    setShippingAddress(ship ? { label: ship.label, street: ship.street, city: ship.city, state: ship.state, zip: ship.zip } : EMPTY_ADDRESS);
    setPaymentTerms(defaults.paymentTerms?.name ?? '');
    setPaymentMethod(defaults.paymentMethod?.name ?? '');
    /* Persist customer change on the SO record. Only the new
       primary is committed to `pocs` so the picker opens with the
       same single-recipient state on next reopen. */
    store.updateSO(so.id, {
      customer: next.name,
      customerInitials: next.initials,
      customerId: next.id,
      pocs: primaryRaw
        ? [{ id: primaryRaw.id, name: primaryRaw.name, initials: primaryRaw.initials, title: primaryRaw.role, email: primaryRaw.email, phone: primaryRaw.phone || undefined, isPrimary: true }]
        : [],
      primaryPocId: primaryRaw?.id || '',
      paymentTerms: defaults.paymentTerms?.name ?? '',
      salesRep: defaults.salesRep?.name ?? '',
      shippingAddress: ship ? `${ship.street}, ${ship.city}, ${ship.state} ${ship.zip}` : '',
      billingAddress: bill ? `${bill.street}, ${bill.city}, ${bill.state} ${bill.zip}` : '',
      paymentMethod: defaults.paymentMethod?.name ?? '',
      salesReps: defaults.salesRep ? [{ name: defaults.salesRep.name, primary: true }] : [],
    });
  };

  const handleCustomerTileEdit = () => {
    if (customerLocked) {
      toast.info("Customer is locked once any units are shipped on this order.", { position: "top-right" });
      return;
    }
    setShowCustomerSearch(true);
  };

  /* Old single-callback `handleCustomerPicked` was inlined into the
     new ChangeCustomerModal's `onSelectCustomer` so the branching
     between customer + contact picks lives next to the modal. */

  /* ── Formatters ── */
  // Always render the full grouped currency string ($1,400,000) so users
  // can read every digit. Cells that are too narrow CSS-truncate with `…`
  // and surface the full value via the `title` attribute on the surrounding
  // span (see usage sites — each value carries a `title`).
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  return (
    <>
    <div
      className="flex flex-col gap-4 md:max-lg:grid md:max-lg:grid-cols-2 md:max-lg:items-start"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* Stacked under the line items below lg (PO's breakpoint), the
          cards would stretch to the full page width though they are
          designed at 300px. Between md and lg they sit two across, close
          to that width; below md they stack one per row. */}
      {/* ═══════ 1. CUSTOMER INFORMATION ═══════
           Verbatim shape of Purchase Order's `Vendor Information` card
           (`POSidebarSections.tsx:428-960`):
             · Hero row (always visible): 40px gradient avatar + name +
               summary line "N contacts · N locations · Net 30".
             · `Contact` InnerAccordion (open by default) — bare content,
               no surrounding box: PoC primary row (40px violet-gradient
               avatar with emerald online dot + Star marker) +
               always-visible inline pencil + secondary-contacts toggle.
             · `Shipping & Billing` InnerAccordion — two LocationCards
               + a compact Shipment Method info row.
             · `Payment Terms` InnerAccordion — full `PaymentTermCard`.
             · `Payment Method` InnerAccordion — full `PaymentMethodCard`.
           This replaces the prior structure (customer pill + boxed
           PoC tile + SubsectionHeader rows). */}
      <DashInfoCard title="Customer Information" icon={Users}>
        <div className="px-0.5">
          <CustomerIdentityRow
            name={so.customer}
            summary={(() => {
              /* Customer's primary address — reflects whichever
                 customer is selected. Contacts / locations /
                 payment-terms are surfaced by the accordions below
                 (and by the avatar hover card), so restating them
                 here would be redundant. */
              if (!billingAddress.street) return FIELD_RULES.customerAddress.emptyLabel;
              return formatSidebarAddress(billingAddress);
            })()}
            hoverInfo={(() => {
              /* SO's `Customer` shape already carries phone/email at
                 the corporate level (see `CreateSOModal.tsx:54`). Fall
                 back to a deterministic derivation for freshly-created
                 customers that haven't been seeded through the modal
                 yet, so the card always renders four rows. Counts read
                 the seed record first, then the local `pocs` state. */
              const cust = MOCK_CUSTOMERS.find(c => c.name === so.customer);
              /* A name-only customer has nothing to show: no derived
                 phone or email, zero locations and contacts. */
              if (isSparseCustomer(so.customer)) {
                return { contactsCount: pocs.length, locationsCount: cust?.locations?.length ?? 0 };
              }
              const slug = (so.customer || 'customer').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'customer';
              let h = 0;
              for (let i = 0; i < (so.customer || '').length; i++) h = ((so.customer || '').charCodeAt(i) + ((h << 5) - h)) | 0;
              const abs = Math.abs(h);
              const npa = 200 + (abs % 700);
              const exch = 200 + ((abs * 7) % 700);
              const num = 1000 + ((abs * 13) % 9000);
              return {
                phone: cust?.phone || `(${npa}) ${exch}-${num}`,
                email: cust?.email || `info@${slug}.com`,
                contactsCount: cust?.contactCount ?? pocs.length,
                locationsCount: cust?.locations?.length ?? [billingAddress, shippingAddress].filter(a => a.street).length,
              };
            })()}
            onEdit={canEdit ? handleCustomerTileEdit : undefined}
          />

          <div className="mt-3">
            <InnerAccordion title="Point of Contacts" defaultOpen={true}>
              {(() => {
                /* Always surface phone + email on the PoC card so the
                   sidebar reads the same for every SO. Derive
                   deterministic fallbacks from contact + customer name
                   when the underlying record is missing them. */
                const name = primaryContact.name || '';
                const slug = (so.customer || 'company').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'company';
                const nameParts = name.toLowerCase().split(/\s+/).filter(Boolean);
                const first = nameParts[0] || 'contact';
                const last = nameParts[nameParts.length - 1] || 'user';
                const derivedEmail = `${first}.${last}@${slug}.com`;
                let h = 0;
                for (let i = 0; i < name.length; i++) h = (name.charCodeAt(i) + ((h << 5) - h)) | 0;
                const abs = Math.abs(h);
                const npa = 200 + (abs % 700);
                const exch = 200 + ((abs * 7) % 700);
                const num = 1000 + ((abs * 13) % 9000);
                const derivedPhone = `(${npa}) ${exch}-${num}`;
                return (
                  <PrimaryContactCard
                    name={primaryContact.name}
                    role={primaryContact.title}
                    phone={primaryContact.name ? (primaryContact.phone || derivedPhone) : undefined}
                    email={primaryContact.name ? (primaryContact.email || derivedEmail) : undefined}
                    emptyLabel={FIELD_RULES.poc.emptyLabel}
                    onEdit={canEdit ? () => setShowRecipientsModal(true) : undefined}
                  />
                );
              })()}
              <SecondaryContactsToggle
                contacts={otherContacts.map(c => ({ name: c.name, role: c.title }))}
              />
            </InnerAccordion>

            <InnerAccordion title="Shipping & Billing" defaultOpen={false}>
              <div className="flex flex-col" style={{ gap: 8 }}>
                <LocationCard
                  label="Bill To"
                  icon={CreditCard}
                  tooltip="The customer location that receives the invoice. Defaults to the customer's primary billing address; override per order when applicable."
                  info={{
                    displayName: billingAddress.street ? (billingAddress.label || "Billing address") : "Not Set",
                    address: formatSidebarAddress(billingAddress),
                    abbr: billingAddress.label
                      ? billingAddress.label.split(" ").map((w: string) => w[0]).join("").slice(0, 2)
                      : "BL",
                  }}
                  canEdit={canEdit}
                  onEdit={() => setAddressModalType("billing")}
                  emptyLabel={FIELD_RULES.billTo.emptyLabel}
                  showAddress
                />
                <LocationCard
                  label="Ship To"
                  icon={Truck}
                  tooltip="The destination the goods physically ship to. Defaults to the customer's primary shipping address; override per order when applicable."
                  info={{
                    displayName: shippingAddress.street ? (shippingAddress.label || "Shipping address") : "Not Set",
                    address: formatSidebarAddress(shippingAddress),
                    abbr: shippingAddress.label
                      ? shippingAddress.label.split(" ").map((w: string) => w[0]).join("").slice(0, 2)
                      : "SH",
                  }}
                  canEdit={canEdit}
                  onEdit={() => setAddressModalType("shipping")}
                  emptyLabel={FIELD_RULES.shipTo.emptyLabel}
                  showAddress
                  hint={shipToHint}
                  error={shipToError}
                  dataField="shipTo"
                />
                {/* Shipment Method — minimal info row inside Shipping &
                    Billing (PO has no equivalent card, so this stays
                    lighter than the term / method cards below). */}
                <div
                  onClick={() => canEdit && setShowShipmentModal(true)}
                  className={`group rounded-xl border bg-white transition-all duration-200 ${canEdit ? "cursor-pointer hover:border-slate-300 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]" : ""}`}
                  style={{ borderColor: "#E8ECF1", padding: 12 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Truck className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} strokeWidth={2} />
                      <span style={{ fontSize: 11, fontWeight: 500, color: "#64748B", lineHeight: 1.4 }}>
                        Shipment Method
                      </span>
                    </div>
                    {canEdit && <Pencil className="w-3 h-3 text-muted-foreground/60 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={2} />}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 min-w-0">
                    <span className="text-foreground truncate" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>
                      {shipmentDescribed.primary}
                    </span>
                    {shipmentDescribed.secondary && (
                      <span className="text-muted-foreground truncate" style={{ fontSize: 11, fontWeight: 400 }}>
                        · {shipmentDescribed.secondary}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </InnerAccordion>

            <InnerAccordion title="Payment Terms" defaultOpen={false}>
              <PaymentTermCard
                term={{
                  name: paymentTerms,
                  type: /split/i.test(paymentTerms) ? "Split" : /^pre|^prepaid|deposit/i.test(paymentTerms) ? "Pre" : "NET",
                  triggerEvent: /shipping/i.test(paymentTerms) ? "Post Shipping" : "Post Invoice",
                }}
                onClick={canEdit ? () => setShowPaymentTermsModal(true) : undefined}
                emptyLabel={FIELD_RULES.paymentTerms.emptyLabel}
              />
            </InnerAccordion>

            <InnerAccordion title="Payment Method" defaultOpen={false}>
              {/* `isDefault` is deliberately omitted — Purchase Order
                  uses it to mark the preferred method when a vendor has
                  several on file, but an SO carries exactly one payment
                  method so the "primary among many" semantic doesn't
                  apply. Without it the card drops the 1.5px blue ring
                  + primary glow + "Primary" star pill and reads as a
                  regular detail card. */}
              <PaymentMethodCard
                method={paymentMethod ? {
                  type: /wire/i.test(paymentMethod) ? "Wire Transfer" : /ach/i.test(paymentMethod) ? "ACH" : /check/i.test(paymentMethod) ? "Check" : /card|credit/i.test(paymentMethod) ? "Credit Card" : undefined,
                  bankName: paymentMethod,
                } : null}
                emptyLabel={FIELD_RULES.paymentMethod.emptyLabel}
                onClick={canEdit ? () => setShowPaymentMethodModal(true) : undefined}
              />
            </InnerAccordion>
          </div>
        </div>
      </DashInfoCard>

      {/* ═══════ 2. ORDER SUMMARY ═══════
           Purchase Order `Order Summary` chrome (PO `PurchaseOrderDraft.tsx:3651-3706`):
           10/500 slate-400 hero label → 20px/700 currency total → 11/400
           caption, divider, then 10/500 label · 12/500 value breakdown
           rows in `space-y-2.5`. The redundant Grand Total row at the
           bottom is dropped because the hero already surfaces it.
           Pricing Rules + One-Time Discounts retain their full
           functionality (signed-delta values, Manage link when active,
           Add CTA when empty + editable). The SO-specific Invoice
           Summary panel is preserved verbatim below the breakdown. */}
      <DashInfoCard title="Order Summary" icon={DollarSign}>
        <div className="px-0.5">
          {/* Hero — Grand Total + item-count caption */}
          <div style={{ marginBottom: 12 }}>
            <p className="text-slate-400" style={{ fontSize: 10, fontWeight: 500, fontFamily: "Inter, system-ui, sans-serif" }}>
              Grand Total
            </p>
            <p
              className="text-slate-700 tracking-tight tabular-nums"
              style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2, fontFamily: "Inter, system-ui, sans-serif" }}
              title={fmtCurrency(grandTotal)}
            >
              {fmtCurrency(grandTotal)}
            </p>
            <p className="text-slate-500 mt-1 truncate" style={{ fontSize: 11, fontWeight: 400, fontFamily: "Inter, system-ui, sans-serif" }}>
              {so.lines.length} item{so.lines.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Breakdown rows — PO's canonical recipe */}
          <div className="border-t border-muted pt-3" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Subtotal */}
            <div className="flex items-center justify-between">
              <p style={{ fontSize: 11, fontWeight: 500, color: "#64748B", fontFamily: "Inter, system-ui, sans-serif" }}>Subtotal</p>
              <p className="tabular-nums" style={{ fontSize: 12, fontWeight: 600, color: "#334155", fontFamily: "Inter, system-ui, sans-serif" }} title={fmtCurrency(subtotal)}>
                {fmtCurrency(subtotal)}
              </p>
            </div>

            {/* Pricing Rules Applied */}
            <div>
              <div className="flex items-center justify-between">
                <p style={{ fontSize: 11, fontWeight: 500, color: "#64748B", fontFamily: "Inter, system-ui, sans-serif" }}>
                  Pricing Rules Applied
                </p>
                {(() => {
                  const pricingRulesNet = -pricingRulesAmount;
                  const sign = pricingRulesNet > 0 ? "+" : pricingRulesNet < 0 ? "-" : "";
                  const color = pricingRulesNet > 0 ? "#7C3AED" : pricingRulesNet < 0 ? "var(--success)" : "#475569";
                  return (
                    <p
                      className="tabular-nums"
                      style={{ fontSize: 12, fontWeight: 500, color, fontFamily: "Inter, system-ui, sans-serif" }}
                      title={`${sign}${fmtCurrency(Math.abs(pricingRulesNet))}`}
                    >
                      {sign}{fmtCurrency(Math.abs(pricingRulesNet))}
                    </p>
                  );
                })()}
              </div>
              {pricingRuleCount > 0 ? (() => {
                const pricingRulesNet = -pricingRulesAmount;
                const linkColor = pricingRulesNet > 0 ? "#7C3AED" : pricingRulesNet < 0 ? "var(--success)" : undefined;
                return (
                  <SummaryInfoRow
                    label={`${pricingRuleCount} rule${pricingRuleCount === 1 ? "" : "s"} · applied to ${so.lines.length} item${so.lines.length === 1 ? "" : "s"}`}
                    onClick={() => setShowPricingRules(true)}
                    color={linkColor}
                  />
                );
              })() : !["Shipped", "Cancelled", "Archived"].includes(so.status) ? (
                /* Empty-state CTA — colour matches the neutral $0 value
                   above (slate-700) so the row + link read as one group. */
                <button
                  type="button"
                  onClick={() => setShowPricingRules(true)}
                  className="inline-flex items-center gap-1.5 mt-1.5 hover:underline underline-offset-2 cursor-pointer transition-colors"
                  style={{ fontSize: 11, fontWeight: 500, color: "#334155", fontFamily: "Inter, system-ui, sans-serif" }}
                >
                  <Tag className="w-3 h-3 text-muted-foreground/60" />
                  Manage Pricing Rules
                </button>
              ) : null}
            </div>

            {/* One-Time Discounts/Premiums */}
            <div>
              <div className="flex items-center justify-between">
                <p style={{ fontSize: 11, fontWeight: 500, color: "#64748B", fontFamily: "Inter, system-ui, sans-serif" }}>
                  One-Time Discounts/Premiums
                </p>
                <p
                  className="tabular-nums"
                  style={{
                    fontSize: 12, fontWeight: 500,
                    color: adjustmentsNet > 0 ? "#7C3AED" : adjustmentsNet < 0 ? "var(--success)" : "#475569",
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                  title={`${adjustmentsNet > 0 ? "+" : adjustmentsNet < 0 ? "-" : ""}${fmtCurrency(Math.abs(adjustmentsNet))}`}
                >
                  {adjustmentsNet > 0 ? "+" : adjustmentsNet < 0 ? "-" : ""}{fmtCurrency(Math.abs(adjustmentsNet))}
                </p>
              </div>
              {adjustmentCount > 0 ? (
                <SummaryInfoRow
                  label={`${adjustmentCount} discount${adjustmentCount === 1 ? "" : "s"}/premium${adjustmentCount === 1 ? "" : "s"} · ${quoteLevelAdjCount} order-level`}
                  onClick={() => setShowAdjustments(true)}
                  color={adjustmentsNet > 0 ? "#7C3AED" : adjustmentsNet < 0 ? "var(--success)" : undefined}
                />
              ) : !["Shipped", "Cancelled", "Archived"].includes(so.status) ? (
                <button
                  onClick={() => setShowAddOrderLevelAdj(true)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    marginTop: 7, padding: "5px 8px",
                    borderRadius: 6, cursor: "pointer",
                    borderWidth: 1, borderStyle: "dashed", borderColor: "var(--accent)",
                    backgroundColor: "var(--background)",
                    fontSize: 11, fontWeight: 500, color: "var(--primary)",
                    lineHeight: 1, transition: "all 150ms",
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--accent)"; e.currentTarget.style.borderColor = "rgba(10, 119, 255, 0.4)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--background)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
                >
                  <Plus style={{ width: 11, height: 11 }} />
                  Add order-level discount/premium
                </button>
              ) : null}
            </div>

            {/* Freight Charges — feature paused (kept for re-enablement).
                Saved value lives on `shipment.shipmentCost` + each
                `SOLine.shipmentCost`. */}
            {false && (
              <div className="flex items-center justify-between">
                <p style={{ fontSize: 11, fontWeight: 500, color: "#64748B", fontFamily: "Inter, system-ui, sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                  <Truck style={{ width: 11, height: 11 }} />
                  Freight Charges
                </p>
                <p
                  className="tabular-nums"
                  style={{
                    fontSize: 12, fontWeight: 500,
                    color: resolvedShipmentTotal > 0 ? "var(--destructive)" : "#475569",
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                >
                  {resolvedShipmentTotal > 0 ? "+" : ""}{fmtCurrency(resolvedShipmentTotal)}
                </p>
              </div>
            )}
          </div>

          {/* Invoice Summary — SO-specific (no Quote equivalent). Sits
              below the breakdown with its own hairline divider. */}
          <div className="border-t border-border" style={{ paddingTop: 10, marginTop: 12 }}>
            <InvoiceSidebarSummary so={so} onOpenInvoicing={onOpenInvoicing} />
          </div>
        </div>
      </DashInfoCard>

      {/* ═══════ 3. TIMELINE ═══════ */}
      <DashInfoCard title="Timeline" icon={CalendarDays}>
        <div>
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
                fontSize: 11, fontWeight: 600, lineHeight: 1,
                color: statusPill.icon === "alert" ? "#92400E" : "#6D28D9",
              }}>
                {statusPill.text}
              </span>
            </div>
          )}
        </div>
      </DashInfoCard>

      {/* ═══════ 4. OWNERSHIP & HISTORY ═══════ */}
      <DashInfoCard title="Ownership & History" icon={UserCircle}>
        <div>
          {/* Sales Representatives — Purchase Order `Contact` accordion
              shape: bare `PrimaryContactCard` (no surrounding box) for
              the primary rep with always-visible inline pencil, followed
              by `SecondaryContactsToggle` for additional reps. Sales reps
              don't carry phone / email in our domain so those rows are
              omitted; the role line surfaces "Sales Rep". */}
          {(() => {
            const reps = assignedReps;
            const primary = reps.find(r => r.primary) || reps[0];
            const others = reps.filter(r => r.name !== primary?.name);
            return (
              <>
                <PrimaryContactCard
                  name={primary?.name ?? ""}
                  emptyLabel={FIELD_RULES.salesRep.emptyLabel}
                  role="Sales Representative"
                  onEdit={() => setShowSalesRepPicker(true)}
                />
                <SecondaryContactsToggle
                  contacts={others.map(r => ({ name: r.name, role: 'Sales Rep' }))}
                  nounSingular="sales representative"
                  nounPlural="sales representatives"
                />
              </>
            );
          })()}
          <SalesRepPickerModal so={so} isOpen={showSalesRepPicker} onClose={() => setShowSalesRepPicker(false)} />

          {/* Created By + Created On — 2-column grid footer (Quotes/Partner DashInfoCard pattern). */}
          <div className="grid grid-cols-2 gap-x-4 pt-2.5 mt-3 border-t border-muted">
            <div className="min-w-0">
              <DashInfoLabel>Created By</DashInfoLabel>
              <div className="flex items-center gap-1.5 mt-0.5">
                <AvatarCircle name={createdBy} size={20} />
                <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{createdBy}</span>
              </div>
            </div>
            <div className="min-w-0">
              <DashInfoLabel>Created On</DashInfoLabel>
              <p className="text-[12px] text-slate-700 mt-0.5 truncate" style={{ fontWeight: 500 }}>
                {formatDateDisplay(so.createdDate)}
              </p>
            </div>
          </div>

          {/* ── Tags ──
              With the other created facts rather than in Deal Information: on a
              detail page a tag's job is search and grouping, not data entry.
              Adding and removing still work, in the same strip. */}
          <div className="pt-2.5 mt-3 border-t border-muted">
            <DashInfoLabel>Tags</DashInfoLabel>
            <div className="mt-1">
              <TagStrip
                tags={so.tags ?? []}
                onChange={(next) => store.updateSO(so.id, { tags: next })}
              />
            </div>
          </div>
        </div>
      </DashInfoCard>
    </div>
    {/* Phase 2 shipment lock — the summary modals use a fixed 7-row
       mock LINE_ITEMS array. Real so.lines have different IDs, so for
       demo purposes we map shipped status by position: any so.line with
       shippedQty > 0 marks the same-index mock LINE_ITEMS id as locked.
       Shipped (global readOnly) supersedes this. */}
    {(() => null)()}
    <PricingRulesManageModal
      isOpen={showPricingRules}
      onClose={() => setShowPricingRules(false)}
      /* Hand the real SO lines in — drives the items sub-modal, rule
         applicability, and totals. The mock LINE_ITEMS constant the
         modal used to ship with is gone. */
      lines={so.lines}
      pricingAPI={pricingAPI}
      /* Terminal states (Shipped / Cancelled / Archived) → everything is
         locked but still viewable. Partially Shipped → only rules touching
         shipped lines lock (handled via shippedLineIds). */
      readOnly={["Shipped", "Cancelled", "Archived"].includes(so.status)}
      shippedLineIds={so.lines.filter((l) => l.shippedQty > 0).map((l) => l.id)}
      /* Post-draft library mutations stage on the new version; the
         current SO stays untouched until the user confirms the version
         prompt. Per-rule kebab and per-item toggles still apply locally. */
      stageLibraryChanges={so.status !== 'Draft'}
      customerName={so.customer}
      /* Phase 2: pricing-rule changes bubble up to SODetail so the
         auto-version prompt fires post-draft, matching the configurator
         and qty/price flows. */
      onMaterialEvent={(description, onRevert) => onMaterialEvent?.(description, onRevert)}
      /* SOs whose number ends in "-empty", "-002" (the second SO in the
         default list — chosen as the empty-state reference), or whose
         customer is named "No Rules Demo" start with no rules. */
      startEmpty={so.soNumber?.toLowerCase().endsWith("-empty") || so.soNumber?.endsWith("-002") || so.customer === "No Rules Demo"}
    />
    <ManageAdjustmentsModal
      isOpen={showAdjustments}
      onClose={() => setShowAdjustments(false)}
      readOnly={["Shipped", "Cancelled", "Archived"].includes(so.status)}
      shippedLineIds={so.lines.filter((l) => l.shippedQty > 0).map((l) => l.id)}
      lines={so.lines}
      adjustmentsAPI={adjustmentsAPI}
      onMaterialEvent={(description, onRevert) => onMaterialEvent?.(description, onRevert)}
    />
    {/* Quick-add for the sidebar's empty-state "+ Add order-level
        discount/premium" affordance. Threads adjustmentsAPI so the
        save lands in the same store the count + Manage modal read
        from — mirrors the Quote sidebar's wiring. */}
    <AddOrderLevelAdjustmentModal
      isOpen={showAddOrderLevelAdj}
      onClose={() => setShowAddOrderLevelAdj(false)}
      adjustmentsAPI={adjustmentsAPI}
      onMaterialEvent={(description, onRevert) => onMaterialEvent?.(description, onRevert)}
    />
    {addressModalType && (
      <AddressSelectionModal
        isOpen
        onClose={() => setAddressModalType(null)}
        onSelect={(address, _partner) => {
          /* Per 4.2, Bill To and Ship To are material changes —
             route through onMaterialEvent so post-Draft edits gate
             on the version prompt, and supply a revert callback so a
             discarded confirmation snaps the address back. */
          if (addressModalType === "billing") {
            const prev = billingAddress;
            const next = { label: address.label, street: address.street, city: address.city, state: address.state, zip: address.zip };
            setBillingAddress(next);
            persistField({ billingAddress: formatSidebarAddress(next) });
            toast.success("Billing address updated");
            onMaterialEvent?.(
              `Updated Bill To to "${address.label}"`,
              () => { setBillingAddress(prev); persistField({ billingAddress: formatSidebarAddress(prev) }); },
            );
          } else {
            const prev = shippingAddress;
            const next = { label: address.label, street: address.street, city: address.city, state: address.state, zip: address.zip };
            setShippingAddress(next);
            persistField({ shippingAddress: formatSidebarAddress(next) });
            toast.success("Shipping address updated");
            onMaterialEvent?.(
              `Updated Ship To to "${address.label}"`,
              () => { setShippingAddress(prev); persistField({ shippingAddress: formatSidebarAddress(prev) }); },
            );
          }
          setAddressModalType(null);
        }}
        type={addressModalType}
        customerName={so.customer}
        /* Address modal's seeded data is keyed by partner1/2/3/4 in
           MOCK_PARTNERS + PARTNER_ADDRESSES. The earlier "cust-1" id
           had no match in either, so scopedRows came back empty and
           every filter count showed 0. Pinning to "partner1" surfaces
           the four seeded addresses (Headquarters, Billing Office,
           Warehouse, East Coast Office) under this SO's customer.
           Same id-mismatch class as the POC modal fix earlier. */
        currentCustomer={{ id: "partner1", name: so.customer, type: "Customer", location: "Rockford, IL" }}
        currentAddress={null}
      />
    )}
    {showRecipientsModal && (
      <RecipientsSelectionModal
        isOpen
        onClose={() => setShowRecipientsModal(false)}
        /* `cust1` (no dash) matches RecipientsSelectionModal's seeded
           MOCK_CUSTOMERS[0]. Passing "cust-1" silently fell back to the
           wrong customer (Toyota Motor Manufacturing) so every filter +
           scope action operated on the wrong dataset. */
        currentCustomerId="cust1"
        currentCustomerName={so.customer}
        /* Derive the SO's location from MOCK_CUSTOMERS — same seed the
           creation overlay reads, so "This location only" scopes to
           the same office the SO was created against, and PoCs match
           across creation, customer-change, and the sidebar picker. */
        currentLocationId={(() => {
          const cust = MOCK_CUSTOMERS.find((c) => c.name === so.customer);
          return cust?.locations?.find((l) => l.isDefault)?.id ?? cust?.locations?.[0]?.id;
        })()}
        /* Hand the modal the SO's current contacts so the table opens
           with them pre-selected and the user's primary is highlighted.
           Without this the modal opened blank and every reopen lost
           the selection. */
        selectedRecipients={pocs.map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          phone: p.phone,
          role: p.title,
          department: '',
          initials: p.initials,
          avatarColor: 'var(--accent)',
        }))}
        primaryPoCId={primaryPocId}
        onSelect={(recipients, primaryPoCId) => {
          if (recipients.length === 0) {
            toast.error('Pick at least one contact to keep the SO addressable.');
            return;
          }
          const newPocs = recipients.map((r) => ({
            id: r.id,
            name: r.name,
            initials: r.initials || r.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
            title: r.role || r.department || 'Contact',
            email: r.email || '',
            phone: r.phone || '',
          }));
          /* Policy: changing the PoC roster (adding, removing, or
             re-picking the primary) is NOT a material change. It has no
             pricing / commitment impact and must never fire the version
             prompt on Cleared or later SOs. Do NOT call onMaterialEvent
             from this handler. */
          setPocs(newPocs);
          /* Default to the modal's primary; if that contact isn't in the
             selection (edge case), fall back to the first one. */
          const nextPrimary = newPocs.some((p) => p.id === primaryPoCId)
            ? primaryPoCId
            : newPocs[0].id;
          setPrimaryPocId(nextPrimary);
          const primary = newPocs.find((p) => p.id === nextPrimary)!;
          toast.success(`${newPocs.length} contact${newPocs.length !== 1 ? 's' : ''} updated — primary: ${primary.name}`);
          setShowRecipientsModal(false);
        }}
      />
    )}
    {showPaymentTermsModal && (
      <PaymentTermsLibrary
        isOpen
        onClose={() => setShowPaymentTermsModal(false)}
        onSelect={(term) => {
          /* Per 4.2, Payment Terms is a material change. Snapshot
             the previous value and supply a revert so a discarded
             version prompt restores it. */
          const prev = paymentTerms;
          setPaymentTerms(term.name);
          persistField({ paymentTerms: term.name });
          toast.success(`Payment terms set to ${term.name}`);
          onMaterialEvent?.(
            `Updated Payment Terms to "${term.name}"`,
            () => { setPaymentTerms(prev); persistField({ paymentTerms: prev }); },
          );
          setShowPaymentTermsModal(false);
        }}
        customerName={so.customer}
        currentTermId={paymentTerms || undefined}
      />
    )}
    {showPaymentMethodModal && (
      <PaymentMethodSelectionModal
        isOpen
        onClose={() => setShowPaymentMethodModal(false)}
        currentMethodId={paymentMethodId}
        onSelect={(method) => {
          setPaymentMethodId(method.id);
          setPaymentMethod(`${method.name} · ${method.subtitle}`);
          persistField({ paymentMethod: `${method.name} · ${method.subtitle}` });
          toast.success(`Payment method set to ${method.name}`);
          setShowPaymentMethodModal(false);
        }}
        customerName={so.customer}
      />
    )}
    {showShipmentModal && (
      <ShipmentMethodModal
        isOpen
        onClose={() => setShowShipmentModal(false)}
        value={shipment}
        onSave={(next) => {
          setShipment(next);
          /* Persist so the shipment tab, PDF, and any other reader
             can pull carrier / method / pickup warehouse from the
             single source of truth. Without this, changes here
             would live in local state and vanish on remount. */
          store.updateSO(so.id, { shipmentConfig: next } as any);
          toast.success("Order shipment default updated");
        }}
        scopeLabel="Order Default"
        pocs={pocs.map((p) => ({ id: p.id, name: p.name, role: p.title, phone: "" }))}
      />
    )}
    {showFreightBreakdown && (
      <FreightBreakdownModal
        isOpen
        onClose={() => setShowFreightBreakdown(false)}
        scopeLabel="Order Default"
        defaultCost={
          typeof so.freightCost === "number"
            ? so.freightCost
            : (typeof shipment.shipmentCost === "number" ? shipment.shipmentCost : 0)
        }
        onChangeDefault={(v) => {
          /* Persist the order-level freight on the SO so the
             configurator's split confirmation reads the same value
             via so.freightCost. Local shipment state stays in sync so
             the sidebar narrative (carrier copy) doesn't flicker. */
          store.updateSO(so.id, { freightCost: v });
          setShipment((prev) => ({ ...prev, shipmentCost: v }));
        }}
        defaultMethod={shipment.method}
        lines={so.lines.map((l): FreightLine => ({
          id: l.id,
          code: l.itemCode,
          description: l.itemName,
          subtotal: l.orderedQty * l.unitPrice,
          /* Read the per-line override straight off the SOLine — single
             source of truth for both freight modal and configurator. */
          overrideCost: l.shipmentCost,
          /* SOLine doesn't carry its own shipmentConfig yet — every
             line inherits the order-level method, so we don't pass a
             per-line method here. When the line-level wiring lands,
             surface l.shipmentConfig?.method here. */
        }))}
        onToggleLine={(lineId, next) => {
          store.updateSOLine(so.id, lineId, { shipmentCost: next });
        }}
        onChangeLineCost={(lineId, next) => {
          store.updateSOLine(so.id, lineId, { shipmentCost: next });
        }}
      />
    )}
    {editingDateKey && (() => {
      /* Build the Expected Delivery default by walking the shipBy +
         carrier transit window. getShipmentDates returns the resolved
         shipBy + min/max delivery dates already (using whatever the
         user pinned in the Freight modal, or computed from the
         carrier method); we surface them as "MM/dd/yyyy" strings. */
      const { shipBy, deliveryMin, deliveryMax } = getShipmentDates(shipment);
      const fmt = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
      const deliveryStartDefault = shipment.estimatedDeliveryDate
        ? fmt(new Date(shipment.estimatedDeliveryDate + "T00:00:00"))
        : fmt(deliveryMin);
      const deliveryEndDefault = shipment.estimatedDeliveryDateEnd
        ? fmt(new Date(shipment.estimatedDeliveryDateEnd + "T00:00:00"))
        : fmt(deliveryMax);
      void shipBy; // referenced for clarity even though we use the resolved range
      const initialConfig =
        editingDateKey === "requested"
          ? { dateType: "absolute" as const, absoluteValue: so.orderDate || "", relativeValue: "", relativeUnit: "days" }
          : editingDateKey === "delivery"
            ? {
                dateType: "absolute" as const,
                absoluteValue: deliveryStartDefault,
                absoluteEndValue: deliveryEndDefault,
                relativeValue: "",
                /* Disable the relative toggle so DateEditModal renders
                   the range UI only — picked up by the `__disable_relative__`
                   sentinel inside the modal. */
                relativeUnit: "__disable_relative__",
              }
            : { dateType: "absolute" as const, absoluteValue: "", relativeValue: "20", relativeUnit: "days" };
      return (
        <DateEditModal
          type={editingDateKey === "requested" ? "request" : editingDateKey === "shipBy" ? "estShip" : "dueDelivery"}
          isOpen
          onClose={() => setEditingDateKey(null)}
          onSave={(config) => {
            if (editingDateKey === "requested" && config.absoluteValue) {
              // Persist the new requested date back to the SO. orderDate is the
              // storage field for the customer-requested date (renamed to
              // "Requested On" in the UI).
              store.updateSO(so.id, { orderDate: config.absoluteValue });
            }
            toast.success("Date updated");
            setEditingDateKey(null);
          }}
          initialConfig={initialConfig}
        />
      );
    })()}

    {/* ─── Change Customer flow ───
        Matches the Quote sidebar: pick customer OR contact in the
        search overlay → branch on same/different customer → confirm
        before swap. */}
    <ChangeCustomerModal
      open={showCustomerSearch}
      currentCustomerName={so.customer}
      onClose={() => setShowCustomerSearch(false)}
      onSelectCustomer={(next) => {
        setShowCustomerSearch(false);
        if (next.name === so.customer) {
          /* Picking the same customer in the overlay re-opens the
             location step so the user can switch locations without
             changing customer. */
          setPendingCustomerSelection({ customer: next });
          return;
        }
        /* Different customer: skip the LocationSelectionModal step —
           `applyCustomerChange` seeds billing/shipping from the new
           customer's default location via `getCustomerDefaults`, so
           forcing the user through a picker just to re-choose the
           default is redundant. Go straight to the confirmation. */
        if (requiresConfirm) setPendingCustomerChange(next);
        else setCustomerSwitchInFlight({ from: so.customer, to: next });
      }}
      onSelectContact={(custOfContact, poc) => {
        setShowCustomerSearch(false);
        const isSame = custOfContact.name === so.customer;
        if (isSame) {
          /* Same-customer different-POC: route through the override
             confirmation. If the picked POC is already primary,
             no-op silently. */
          if (poc.id === primaryPocId) return;
          setPendingPocOverride({
            id: poc.id,
            name: poc.name,
            initials: poc.initials,
            title: poc.role,
            email: poc.email,
            phone: poc.phone || '',
          });
        } else {
          /* Different customer: skip the location step and go
             straight to the confirmation. The new customer's default
             location is applied automatically. */
          if (requiresConfirm) setPendingCustomerChange(custOfContact);
          else setCustomerSwitchInFlight({ from: so.customer, to: custOfContact });
        }
      }}
      onAddNew={async (tab, query) => {
        if (tab === 'all' || tab === 'customers') {
          setShowCustomerSearch(false);
          const result = await openPartnerTab<CreatedCustomerPayload>('create-customer', { seedName: query, origin: 'so' });
          if (result) setPendingCustomerCreation(result.payload);
        } else if (tab === 'contacts') {
          setShowCustomerSearch(false);
          const currentCust = MOCK_CUSTOMERS.find((c) => c.name === so.customer);
          const result = await openPartnerTab<CreatedContactPayload>('create-poc', {
            seedName: query,
            customerId: currentCust?.id,
            customerName: so.customer,
            origin: 'so',
          });
          if (result) setPendingContactCreation(result.payload);
        }
      }}
    />

    {/* Continuation overlays for partner-tab payloads in the
        change-customer flow. The Partner Management tab plays its
        own "Adding…" animation and self-closes; these cover the
        brief gap before the new record lands in the change pipeline. */}
    <StateTransitionOverlay
      isActive={pendingCustomerCreation !== null}
      heading="Adding customer"
      fromLabel="Partner Management"
      toLabel={pendingCustomerCreation?.name || 'Customer'}
      tone="success"
      meta="Continuing the change-customer flow"
      duration={1200}
      onComplete={() => {
        if (pendingCustomerCreation) {
          const ex = pendingCustomerCreation as unknown as { useExisting?: boolean; existingId?: string };
          if (ex.useExisting && ex.existingId) {
            const existing = MOCK_CUSTOMERS.find((c) => c.id === ex.existingId);
            if (existing) {
              setPendingCustomerSelection({ customer: existing });
              toast.success(`Using existing customer "${existing.name}"`, { position: "top-right" });
            }
          } else {
            const payload = pendingCustomerCreation;
            const newId = `c_new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const defaultLocId = `${newId}_loc0`;
            const defaultLocation = {
              id: defaultLocId,
              name: 'Headquarters Main',
              city: payload.defaultAddress.city || payload.defaultAddress.cityState,
              state: payload.defaultAddress.state || '',
              address: payload.defaultAddress.full,
              isDefault: true,
              pocCount: 0,
              primaryContact: '',
              primaryContactInitials: '—',
              status: 'active' as const,
              type: 'Customer' as const,
              phone: payload.phone || '',
            } as CustomerLocation;
            const newCustomer: MockCustomer = {
              id: newId,
              name: payload.name,
              initials: payload.logoLetter,
              contactCount: 0,
              address: payload.defaultAddress.full,
              phone: payload.phone || '',
              fax: '',
              email: '',
              status: ['Active'],
              pocs: [],
              locations: [defaultLocation],
            };
            (MOCK_CUSTOMERS as MockCustomer[]).unshift(newCustomer);
            setPendingCustomerSelection({ customer: newCustomer });
            toast.success(`Customer "${newCustomer.name}" added`, { position: "top-right" });
          }
        }
        setPendingCustomerCreation(null);
      }}
    />
    <StateTransitionOverlay
      isActive={pendingContactCreation !== null}
      heading="Adding contact"
      fromLabel="Partner Management"
      toLabel={pendingContactCreation?.name || 'Contact'}
      tone="success"
      meta="Continuing the change-customer flow"
      duration={1200}
      onComplete={() => {
        if (pendingContactCreation) {
          const payload = pendingContactCreation;
          const target = payload.companyId
            ? MOCK_CUSTOMERS.find((c) => c.id === payload.companyId)
            : MOCK_CUSTOMERS.find((c) => c.name === so.customer);
          if (target) {
            const newPoc = {
              id: payload.id,
              name: payload.name,
              initials: payload.initials,
              isPrimary: false,
              role: payload.role || 'Contact',
              phone: payload.phone || target.phone,
              extension: payload.phoneExt,
              email: payload.email || `${payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@${(target.email || '').split('@')[1] || 'company.com'}`,
            };
            target.pocs.push(newPoc as typeof target.pocs[number]);
            target.contactCount = target.contactCount + 1;
            const isSameCustomer = target.name === so.customer;
            if (isSameCustomer) {
              setPendingPocOverride({
                id: newPoc.id,
                name: newPoc.name,
                initials: newPoc.initials,
                title: newPoc.role,
                email: newPoc.email,
                phone: newPoc.phone || '',
              });
            } else {
              /* Different customer: skip the location step and go
                 straight to the confirmation. The new customer's
                 default location is applied automatically. */
              if (requiresConfirm) setPendingCustomerChange(target);
              else setCustomerSwitchInFlight({ from: so.customer, to: target });
            }
            toast.success(`Contact "${newPoc.name}" added`, { position: "top-right" });
          }
        }
        setPendingContactCreation(null);
      }}
    />

    {/* POC override confirmation — same chrome as the customer-change
        confirmation below so the two prompts feel like a family. */}
    {pendingPocOverride && (
      <ConfirmDiscardModal
        open
        onOpenChange={(o) => { if (!o) setPendingPocOverride(null); }}
        variant="warning"
        badge="Change primary contact"
        title="Replace primary contact?"
        description={`The recipient list keeps its other members — only the primary flag moves to ${pendingPocOverride.name}.`}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        maxWidth={520}
        onConfirm={() => {
          const next = pendingPocOverride;
          /* Move the picked POC to the front of the list while
             preserving the existing roster — matches Quote's same-
             customer override behaviour. Same policy as the picker's
             onSelect above: primary swaps are NOT material changes and
             must never fire the version prompt. */
          setPocs((prev) => {
            const newPrimary = {
              id: next.id,
              initials: next.initials,
              name: next.name,
              title: next.title,
              email: next.email,
              phone: next.phone,
            };
            const rest = prev.filter((p) => p.id !== next.id);
            return [newPrimary, ...rest];
          });
          setPrimaryPocId(next.id);
          toast.success(`Primary contact updated to ${next.name}`, { position: 'top-right' });
          setPendingPocOverride(null);
        }}
      >
        <div className="flex items-stretch gap-3">
          <div className="flex-1 px-3 py-2.5 rounded-lg border border-border bg-muted/50 min-w-0">
            <div className="text-[10px] uppercase tracking-widest mb-1" style={{ fontWeight: 600, color: "var(--muted-foreground)", opacity: 0.7 }}>From</div>
            <div className="text-[12px] truncate" style={{ fontWeight: 600, color: "var(--muted-foreground)", textDecoration: "line-through" }}>{primaryContact.name}</div>
            <div className="text-[10px] mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>Current primary</div>
          </div>
          <div className="flex items-center shrink-0">
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 px-3 py-2.5 rounded-lg border bg-[#FFFBEB] min-w-0" style={{ borderColor: "#FDE68A" }}>
            <div className="text-[10px] uppercase tracking-widest mb-1" style={{ fontWeight: 600, color: "#B45309", opacity: 0.85 }}>To</div>
            <div className="text-[12px] truncate" style={{ fontWeight: 600, color: "#92400E" }}>{pendingPocOverride.name}</div>
            <div className="text-[10px] mt-0.5 truncate" style={{ color: "#B45309", fontWeight: 500 }}>{pendingPocOverride.title || 'Contact'}</div>
          </div>
        </div>
      </ConfirmDiscardModal>
    )}

    {/* Location pick step — opens after the customer/contact is
        chosen in the search overlay. Same component the SO creation
        flow uses, fed the candidate customer's per-customer locations
        so each card shows that customer's primary POC + count. */}
    {pendingCustomerSelection && (
      <LocationSelectionModal
        isOpen
        onClose={() => setPendingCustomerSelection(null)}
        onSelect={(_loc) => {
          const sel = pendingCustomerSelection;
          if (!sel) return;
          setPendingCustomerSelection(null);
          if (sel.customer.name === so.customer) {
            /* Same-customer + new location: no defaults reset, just
               surface a toast. Customer change confirmation is
               unnecessary here. */
            toast.success(`Location updated to ${_loc.name}`, { position: 'top-right' });
            return;
          }
          /* Different customer path: stage the change so the
             confirmation prompt below can fire. */
          if (requiresConfirm) setPendingCustomerChange(sel.customer);
          else setCustomerSwitchInFlight({ from: so.customer, to: sel.customer });
        }}
        currentLocationId={
          pendingCustomerSelection.customer.name === so.customer
            ? (pendingCustomerSelection.customer.locations?.find(l => l.isDefault)?.id || '')
            : ''
        }
        customerName={pendingCustomerSelection.customer.name}
        locations={(pendingCustomerSelection.customer.locations || []).map((l: CustomerLocation) => ({
          id: l.id,
          name: l.name,
          address: l.address,
          city: l.city,
          state: l.state,
          isDefault: l.isDefault,
          pocCount: l.pocCount,
          contacts: l.pocCount,
          primaryContact: l.primaryContact,
          status: l.status,
          type: l.type,
          phone: l.phone,
          lastUpdated: l.lastUpdated,
        }))}
      />
    )}

    {/* Confirmation modal — shown for every customer swap (Draft +
        post-Draft) so the blast-radius checklist is always surfaced.
        Mirrors Quote's modal: horizontal from→to comparison, reset
        checklist, amber chrome. */}
    {pendingCustomerChange && (
      <ConfirmDiscardModal
        open
        onOpenChange={(o) => { if (!o) setPendingCustomerChange(null); }}
        variant="warning"
        badge="Change customer"
        title="Change customer?"
        description={`Switching to ${pendingCustomerChange.name} will pull that customer's defaults from their partner record and replace the values on this sales order.`}
        confirmLabel="Confirm & reset data"
        cancelLabel="Cancel"
        maxWidth={520}
        onConfirm={() => {
          const next = pendingCustomerChange;
          setPendingCustomerChange(null);
          setCustomerSwitchInFlight({ from: so.customer, to: next });
        }}
      >
        <div className="flex items-stretch gap-3">
          <div className="flex-1 px-3 py-2.5 rounded-lg border border-border bg-muted/50 min-w-0">
            <div className="text-[10px] uppercase tracking-widest mb-1" style={{ fontWeight: 600, color: "var(--muted-foreground)", opacity: 0.7 }}>From</div>
            <div className="text-[12px] truncate" style={{ fontWeight: 600, color: "var(--muted-foreground)", textDecoration: "line-through" }}>{so.customer}</div>
            <div className="text-[10px] mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>{primaryContact.name}</div>
          </div>
          <div className="flex items-center shrink-0">
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 px-3 py-2.5 rounded-lg border bg-[#FFFBEB] min-w-0" style={{ borderColor: "#FDE68A" }}>
            <div className="text-[10px] uppercase tracking-widest mb-1" style={{ fontWeight: 600, color: "#B45309", opacity: 0.85 }}>To</div>
            <div className="text-[12px] truncate" style={{ fontWeight: 600, color: "#92400E" }}>{pendingCustomerChange.name}</div>
            <div className="text-[10px] mt-0.5 truncate" style={{ color: "#B45309", fontWeight: 500 }}>
              {[
                pendingCustomerChange.pocs.find(p => p.isPrimary)?.name || pendingCustomerChange.pocs[0]?.name || FIELD_RULES.poc.emptyLabel,
                (pendingCustomerChange.address || "").split(",")[0] || FIELD_RULES.customerAddress.emptyLabel,
              ].join(" · ")}
            </div>
          </div>
        </div>
        <div className="mt-4 px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50/40">
          <div className="text-[11px] uppercase tracking-widest mb-1.5" style={{ fontWeight: 600, color: "#92400E", letterSpacing: "0.06em" }}>Will be replaced</div>
          <ul className="text-[12px]" style={{ color: "#78350F", lineHeight: 1.55, paddingLeft: 16, margin: 0, listStyle: "disc" }}>
            <li>Primary point of contact and recipient list</li>
            <li>Default sales rep</li>
            <li>Billing and shipping addresses</li>
            <li>Payment terms and payment method</li>
            <li>Pricing rules tied to the current customer</li>
          </ul>
          <div className="text-[11px] mt-2" style={{ color: "#92400E", fontWeight: 500 }}>
            {so.status === "Draft"
              ? "Customer stays editable until any units are shipped."
              : `Note: this order is in ${so.status}, so the change is logged as a material event on the activity log. Customer stays editable until any units are shipped.`}
          </div>
        </div>
      </ConfirmDiscardModal>
    )}

    {/* Overlay: brief checklist animation while defaults hydrate. */}
    {customerSwitchInFlight && (
      <CustomerSwitchOverlay
        fromCustomer={customerSwitchInFlight.from}
        toCustomer={customerSwitchInFlight.to.name}
        onDone={() => {
          const target = customerSwitchInFlight.to;
          /* Snapshot every field the switch is about to overwrite —
             both local sidebar state and store-side SO fields — so a
             discarded version prompt can restore them. Per 4.2 the
             customer change is itself a material event. */
          const localSnap = {
            pocs,
            primaryPocId,
            billingAddress,
            shippingAddress,
            paymentTerms,
            paymentMethod,
          };
          const storeSnap = {
            customer: so.customer,
            customerInitials: so.customerInitials,
            customerId: so.customerId,
            pocs: so.pocs,
            primaryPocId: so.primaryPocId,
            paymentTerms: so.paymentTerms,
            salesRep: so.salesRep,
          };
          applyCustomerChange(target);
          toast.success(
            `Customer changed to ${target.name}. Defaults pulled from partner record.`,
            { position: "top-right", duration: 5000 },
          );
          onMaterialEvent?.(
            `Customer changed from "${so.customer}" to "${target.name}"`,
            () => {
              setPocs(localSnap.pocs);
              setPrimaryPocId(localSnap.primaryPocId);
              setBillingAddress(localSnap.billingAddress);
              setShippingAddress(localSnap.shippingAddress);
              setPaymentTerms(localSnap.paymentTerms);
              setPaymentMethod(localSnap.paymentMethod);
              store.updateSO(so.id, storeSnap);
            },
          );
          setCustomerSwitchInFlight(null);
        }}
      />
    )}
    </>
  );
}