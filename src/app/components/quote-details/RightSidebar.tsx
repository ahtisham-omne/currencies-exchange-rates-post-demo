// @ts-nocheck
import React, { useState, useEffect, useCallback, useLayoutEffect, useMemo, useRef, CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Pencil,
  BadgePercent,
  ArrowRight,
  CreditCard,
  Truck,
  Clock,
  ChevronDown,
  Users,
  DollarSign,
  MapPinned,
  CalendarDays,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Plus,
  UserCircle,
  Briefcase,
  Tag,
  Send,
  Check,
  CheckCircle2,
  Calendar,
  CalendarCheck,
  FilePlus,
  MapPin,
  User as UserIcon,
} from 'lucide-react';
import { RelativeDateValue } from '@/app/components/shared/RelativeDateValue';
import { TagStrip } from '@/app/components/shared/EntityTagChip';
import { DateEditModal } from '../quote-creation/DateEditModal';
import { AddressSelectionModal } from '../quote-creation/AddressSelectionModal';
import { PaymentTermsLibrary } from '../quote-creation/PaymentTermsLibrary';
import { PaymentMethodSelectionModal } from '../quote-creation/PaymentMethodSelectionModal';
import { ShipmentMethodModal, DEFAULT_SHIPMENT, describeShipment, getShipmentDates, type ShipmentConfig } from '../quote-creation/ShipmentMethodModal';
import { FreightBreakdownModal, type FreightLine } from '../shared/FreightBreakdownModal';
import { RecipientsSelectionModal } from '../quote-creation/RecipientsSelectionModal';
import { LocationSelectionModal } from '../quote-creation/LocationSelectionModal';
import { SearchOverlay } from '../quote-creation/SearchOverlay';
import type { CreatedCustomerPayload } from '../external/partners/CreateCustomerModal';
import type { CreatedContactPayload } from '../external/partners/CreateContactModal';
import { openPartnerTab } from '../external/partners/openPartnerTab';
import StateTransitionOverlay from '../shared/StateTransitionOverlay';
import { MOCK_CUSTOMERS, MOCK_CONTACTS } from '../quote-creation/Step1CustomerSelection';
import { QuoteLifecycleStatus } from './ModernStatusStepper';
import { ManageAdjustmentsModal, AddQuoteLevelAdjustmentModal } from './ManageAdjustmentsModal';
import { PricingRulesManageModal } from './PricingRulesManageModal';
import { SalesRepSelector, SelectedSalesRep, SalesRepOption } from '../shared/SalesRepSelector';
import { DashInfoCard, DashInfoLabel } from '../shared/DashInfoCard';
import {
  PrimaryContactCard,
  SidebarEmptyValue,
  SecondaryContactsToggle,
  LocationCard,
  PaymentTermCard,
  PaymentMethodCard,
  InnerAccordion,
  CustomerIdentityRow,
} from '../shared/SidebarPrimitives';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { BaseModal, ModalSecondaryButton } from '../shared/BaseModal';
import { ConfirmDiscardModal } from '../shared/ConfirmDiscardModal';
import { Avatar } from '../shared/Avatar';
import { CustomerSwitchOverlay } from '../shared/CustomerSwitchOverlay';
import { getCustomerDefaults, isSparseCustomer } from '../shared/customerDefaults';
import { FIELD_RULES } from '../shared/fieldRequirements';
import { SALES_REP_ROSTER, findRosterRep } from '../shared/salesRepRoster';
import { toast } from 'sonner';

/* Sidebar reps come from the shared roster so a rep picked during
   creation (Step 2) maps to the same id the picker checks against
   here. Was a parallel local list whose ids drifted (`rep1` meant
   different people in creation vs sidebar), which is why the rep
   showed up as Unassigned with nothing checked in the modal. */
const SIDEBAR_SALES_REPS: SalesRepOption[] = SALES_REP_ROSTER.map((r) => ({
  id: r.id,
  name: r.name,
  initials: r.initials,
  isCurrentUser: !!r.isCurrentUser,
  isCustomerDefault: false,
}));

// ─── Shared hover-edit row (SO V5 pattern — CSS-variable based) ──────────────
function HoverEditRow({
  children,
  onEdit,
  editable = true,
  style,
}: {
  children: ReactNode;
  onEdit?: () => void;
  editable?: boolean;
  style?: CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  const { border, ...restStyle } = style || {};

  let baseBorderWidth = '0px';
  let baseBorderStyle = 'solid';
  let baseBorderColor = 'transparent';
  if (border) {
    const parts = (border as string).split(' ');
    if (parts.length >= 1) baseBorderWidth = parts[0];
    if (parts.length >= 2) baseBorderStyle = parts[1];
    if (parts.length >= 3) baseBorderColor = parts[2];
  }

  return (
    <div
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
      aria-label={editable ? "Edit" : undefined}
      onKeyDown={(e) => { if (editable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onEdit?.(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (editable && onEdit) onEdit(); }}
      className={`relative transition-all ${editable ? 'cursor-pointer' : ''}`}
      style={{
        ...restStyle,
        borderWidth: baseBorderWidth,
        borderStyle: baseBorderStyle,
        borderColor: hovered && editable ? 'var(--ring)' : baseBorderColor,
      }}
    >
      {/* Translucent blue hover overlay */}
      <div
        className={`absolute inset-0 rounded-[inherit] transition-colors pointer-events-none ${hovered && editable ? 'bg-primary/5' : ''}`}
      />
      <div className="relative">{children}</div>
      {editable && (
        <div
          className={`absolute right-[10px] top-1/2 -translate-y-1/2 flex items-center justify-center transition-all text-primary ${hovered ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden
        >
          <Pencil style={{ width: 12, height: 12 }} />
        </div>
      )}
    </div>
  );
}

// ─── Section header (original Quote pattern that was already matching Partner) ─
function SectionHeader({
  icon: Icon,
  label,
  collapsed,
  onToggle,
}: {
  icon: React.ComponentType<{ style?: CSSProperties; className?: string }>;
  label: string;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const isCollapsible = onToggle !== undefined;
  return (
    <button
      onClick={isCollapsible ? onToggle : undefined}
      className={`w-full flex items-center justify-between hover:bg-secondary/30 transition-colors ${isCollapsible ? 'cursor-pointer' : ''}`}
      style={{
        gap: 8,
        minHeight: 44,
        padding: '10px 14px',
        border: 'none',
        background: 'none',
      }}
      aria-expanded={isCollapsible ? !collapsed : undefined}
    >
      <div className="flex items-center" style={{ gap: 8 }}>
        <div className="flex items-center justify-center shrink-0" style={{
          width: 24, height: 24, borderRadius: 'var(--radius-sm, 5px)',
          backgroundColor: 'rgba(10,119,255,0.08)',
        }}>
          <Icon style={{ width: 12, height: 12, color: 'var(--primary)' }} />
        </div>
        <span className="text-foreground" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
          {label}
        </span>
      </div>
      {isCollapsible && (
        <ChevronDown
          className="shrink-0 text-muted-foreground transition-transform duration-200"
          style={{ width: 14, height: 14, transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
        />
      )}
    </button>
  );
}

// ─── Subsection header (SO V5 pattern — compact collapsible) ─────────────────
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
        padding: '8px 0',
        gap: 8,
      }}
      aria-expanded={expanded}
    >
      <div className="flex items-center min-w-0" style={{ gap: 8 }}>
        <Icon style={{ width: 13, height: 13, color: 'var(--muted-foreground)', flexShrink: 0 }} strokeWidth={1.5} />
        <span
          className="truncate text-foreground"
          style={{
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '0.01em',
            lineHeight: 1.2,
          }}
        >
          {label}
        </span>
      </div>
      <ChevronDown
        className="text-muted-foreground"
        style={{
          width: 12,
          height: 12,
          transition: 'transform 200ms',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          flexShrink: 0,
        }}
      />
    </button>
  );
}

// ─── Summary info row with pencil (SO V5 pattern) ───────────────────────────
function SummaryInfoRow({ label, onClick, color }: { label: string; onClick: () => void; color?: string }) {
  /* Active-state count link inside the Summary card. Reads as a tappable
     section (Partner Management hover-background pattern: `bg-primary/5`
     tint on hover, no underline) rather than a textual link. The text
     inherits the colour of the value on the right — green for discounts,
     purple for premiums, slate-700 when neutral / zero — so the row + its
     sub-link read as one semantic group. The pencil deliberately stays
     in `text-muted-foreground/60` so it matches every other always-
     visible edit pencil in the sidebar. */
  const effectiveColor = color || '#334155';
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-1 transition-colors border-none bg-transparent hover:bg-primary/5 cursor-pointer"
      style={{ padding: '3px 6px', margin: '6px -6px 0', borderRadius: 5, fontSize: 11, fontWeight: 500, lineHeight: 1, fontFamily: 'Inter, system-ui, sans-serif', color: effectiveColor }}
    >
      <span>{label}</span>
      <Pencil className="shrink-0 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity" style={{ width: 10, height: 10 }} />
    </button>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────
type DateKey = 'created' | 'request' | 'respond' | 'effective' | 'expiry' | 'sentOn' | 'confirmedOn' | 'convertedOn' | 'shipBy' | 'delivery';

// ─── Timeline date row (SO V5 pattern — dot + connector + hover) ────────────
function TimelineDateRow({
  entry,
  datesEditable,
  onEdit,
  isLast,
}: {
  entry: {
    key: DateKey;
    label: string;
    value: string;
    color: string;
    dotColor: string;
    dotFill?: boolean;
    editable?: boolean;
    /** Step icon — when present the row renders a 22×22 icon circle
     *  (Purchase Order `Timeline` recipe). Falls back to the legacy
     *  11×11 dot when omitted so older entries stay supported. */
    icon?: React.ElementType;
    /** Always-on contextual hint (Partner-style Info icon + tooltip). */
    infoTooltip?: string;
    /** Conditional warning (Partner-style amber AlertTriangle + tooltip). */
    warningTooltip?: string;
    /** Relative date: the value renders with the blue asterisk and the
     *  shared hover card that explains the rule. */
    relative?: { rule: string; anchor: string; showResolved?: boolean };
  };
  datesEditable: boolean;
  onEdit: (key: DateKey) => void;
  isLast: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const isEditable = datesEditable && (entry.editable !== false);
  const StepIcon = entry.icon;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => isEditable && onEdit(entry.key)}
      className={`flex items-center transition-colors ${isEditable ? 'cursor-pointer' : ''} ${hovered && isEditable ? 'bg-primary/5' : ''}`}
      style={{ gap: 10, padding: '5px 6px', margin: '0 -6px', borderRadius: 5 }}
    >
      {/* Step indicator — Purchase Order `Timeline` recipe
          (`PurchaseOrderDraft.tsx:4037-4058`): a 22×22 rounded-full icon
          circle with a soft tinted bg + the step icon at full colour.
          When the entry doesn't define an icon (legacy paths), we fall
          back to the prior 11×11 dot for backwards compatibility. The
          vertical connector to the next step runs through the centre. */}
      {StepIcon ? (
        <div className="relative shrink-0" style={{ width: 22, height: 22 }}>
          <div
            className="relative z-10 rounded-full flex items-center justify-center"
            style={{
              width: 22, height: 22,
              backgroundColor: `color-mix(in srgb, ${entry.dotColor} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${entry.dotColor} 30%, transparent)`,
              transition: 'all 0.3s ease',
            }}
          >
            <StepIcon style={{ width: 11, height: 11, color: entry.dotColor, strokeWidth: 2.2 }} />
          </div>
          {!isLast && (
            <div
              className="absolute bg-border"
              style={{ left: '50%', top: 22, transform: 'translateX(-50%)', width: 1, height: 14 }}
            />
          )}
        </div>
      ) : (
        <div className="relative shrink-0" style={{ width: 11, height: 11 }}>
          <div
            className="relative rounded-full"
            style={{
              width: 11, height: 11,
              backgroundColor: entry.dotFill ? entry.dotColor : 'var(--card)',
              borderWidth: '2.5px', borderStyle: 'solid', borderColor: entry.dotColor,
              zIndex: 1,
            }}
          />
          {!isLast && (
            <div
              className="absolute bg-border"
              style={{ left: '50%', top: 11, transform: 'translateX(-50%)', width: 1.5, height: 16 }}
            />
          )}
        </div>
      )}
      {/* Content — label (+ info indicator) + value (+ warning indicator) + pencil */}
      <div className="flex items-center justify-between flex-1 min-w-0" style={{ gap: 8 }}>
        <div className="flex items-center" style={{ gap: 4, minWidth: 0 }}>
          <span className="text-muted-foreground whitespace-nowrap" style={{ fontSize: 11, fontWeight: 500, lineHeight: 1 }}>
            {entry.label}
          </span>
          {/* Info icon — standard white hover-card tooltip used elsewhere
              (matches SidebarInfoCard). Always visible when an info tooltip
              is configured (e.g. derived/read-only fields explain themselves). */}
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
              <TooltipContent side="top" sideOffset={6} className="max-w-[260px] z-[300]">
                {entry.infoTooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center">
          {/* Warning icon — amber, standard white hover-card tooltip. Rendered
              only when there's a divergence worth surfacing (e.g. line
              ship-by dates differ). */}
          {entry.warningTooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex shrink-0"
                  style={{ marginRight: 4 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <AlertTriangle className="w-3 h-3 cursor-help" style={{ color: '#D97706' }} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6} className="max-w-[260px] z-[300]">
                {entry.warningTooltip}
              </TooltipContent>
            </Tooltip>
          )}
          {(() => {
            /* Split a range value (e.g. "07/07/2026 – 07/09/2026") onto
               two right-aligned lines so a two-date row doesn't push
               against the label and blow out the timeline column
               width. Single-date entries stay on one line. */
            const parts = entry.value.split(' – ');
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
                {entry.relative
                  ? <RelativeDateValue display={entry.value} rule={entry.relative.rule} anchor={entry.relative.anchor} showResolved={entry.relative.showResolved} />
                  : entry.value}
              </span>
            );
          })()}
          <div className="shrink-0 flex justify-end" style={{ width: 17 }}>
            {isEditable && (
              <Pencil
                className={`shrink-0 text-primary transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}
                style={{ width: 11, height: 11 }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
// ─── POC colors ──────────────────────────────────────────────────────────────
const getPoCColor = (initials: string) => {
  const colors = [
    { bg: 'rgba(217, 119, 6, 0.3)', text: 'var(--warning)' }, { bg: 'var(--accent)', text: 'var(--primary)' },
    { bg: '#FED7AA', text: '#9A3412' }, { bg: '#C7D2FE', text: 'var(--primary)' },
    { bg: '#FCA5A5', text: 'var(--destructive)' }, { bg: 'rgba(5, 150, 105, 0.2)', text: 'var(--success)' },
    { bg: '#E9D5FF', text: 'var(--primary)' }, { bg: '#FBCFE8', text: '#831843' },
  ];
  const hash = initials.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// ─── Mock data ───────────────────────────────────────────────────────────────
const INITIAL_POCS = [
  { id: 'p1', initials: 'KR', name: 'Karen Rodriguez', title: 'EMS Division Chief' },
  { id: 'p2', initials: 'TM', name: 'Tom Mitchell', title: 'Fleet Manager' },
  { id: 'p3', initials: 'BP', name: 'Brian Park', title: 'Procurement Officer' },
  { id: 'p4', initials: 'LH', name: 'Lisa Huang', title: 'Finance Director' },
  { id: 'p5', initials: 'AK', name: 'Anna Kim', title: 'Operations' },
  { id: 'p6', initials: 'DC', name: 'David Chen', title: 'Engineering' },
];

// ─── Header ship-by derivation ──────────────────────────────────────────────
// The quote-header Ship By value is derived from the line items — it shows
// the earliest scheduled ship-by across the quote. When two or more lines
// disagree, the consumer surfaces a warning naming the line that drives
// the earliest date.
//
// Each line's ship-by comes from its `shipmentConfig`:
//   • Carrier methods (courier-pickup/dropby): the explicit `expectedShipDate`
//     when the user pinned one, else a method-based fallback.
//   • Customer Pickup: same field — the Pick Up Date IS the ship-by because
//     there's no carrier transit step (pickup = handoff).
// We delegate to `getShipmentDates` so the same logic the modal uses for
// the per-line dates feeds the header.
function computeLineShipBy(lines?: any[]): { hasDivergence: boolean; earliestLineName: string | null } {
  if (!lines || lines.length === 0) return { hasDivergence: false, earliestLineName: null };
  const today = new Date();
  const parsed: { ts: number; name: string }[] = [];
  for (const li of lines) {
    if (!li) continue;
    const cfg: ShipmentConfig | undefined = li.shipmentConfig;
    // Prefer the shipment-config-derived ship-by (handles both pickup +
    // courier methods). Fall back to any raw ship-by field a line might
    // carry directly for non-configurator-driven flows.
    let ts: number | null = null;
    if (cfg && cfg.method) {
      const { shipBy } = getShipmentDates(cfg, today);
      // Normalize to midnight so two lines with the same calendar day
      // don't count as divergent due to time drift.
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
    const name = li.itemName ?? li.productName ?? li.name ?? li.itemCode ?? li.partNumber ?? li.sku ?? 'this line';
    parsed.push({ ts, name });
  }
  if (parsed.length === 0) return { hasDivergence: false, earliestLineName: null };
  parsed.sort((a, b) => a.ts - b.ts);
  const distinct = new Set(parsed.map((p) => p.ts));
  return { hasDivergence: distinct.size >= 2, earliestLineName: parsed[0].name };
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface RightSidebarProps {
  subtotal?: number;
  pricingRules?: number;
  adjustments?: number;
  adjustmentCount?: number;
  pricingRuleCount?: number;
  grandTotal?: number;
  activeTab?: string;
  onNavigateToTab?: (tab: string) => void;
  quoteStatus?: QuoteLifecycleStatus;
  expiryDate?: Date;
  createdDate?: Date;
  readOnly?: boolean;
  customerName?: string;
  contactName?: string;
  quoteId?: string;
  salesRep?: string;
  /** Optional id of the primary rep — when provided, the sidebar
   *  resolves the picker selection against the shared roster so the
   *  modal opens with the correct row already checked. Without this,
   *  the sidebar can only match by name (fragile and the picker keys
   *  off id). */
  salesRepId?: string;
  /** Real PoC roster sourced from the quote record (Quote.primaryPoC +
   *  additionalPoCs). When provided, this overrides the placeholder
   *  INITIAL_POCS list so the sidebar matches the listing/kanban for
   *  the same record. */
  quotePrimaryPoC?: import('@/app/types/quote').PointOfContact;
  quoteAdditionalPoCs?: import('@/app/types/quote').PointOfContact[];
  /** Real sales-rep roster (Quote.salesRep + additionalSalesReps) so the
   *  sidebar doesn't fall back to the hardcoded "Sarah Chen / Mike
   *  Johnson / Emily Williams" trio. */
  quoteAdditionalSalesReps?: import('@/app/types/quote').SalesRep[];
  /** The quote record itself. When present, the sidebar seeds contacts,
   *  sales reps, Bill to, Ship to, payment terms and payment method
   *  from it, and an empty value renders its FIELD_RULES empty state
   *  instead of placeholder data. Absent only for the wizard preview. */
  quoteRecord?: import('@/app/types/quote').Quote;
  /** Headline `Quote.totalValue` — used as the grand-total baseline
   *  when the quote has no live line items, rules, or adjustments. */
  quoteGrandTotal?: number;
  /** Called when a material field changes (customer, ship to, bill to, expiry, payment terms) */
  onMaterialChange?: (fieldKey: string, fieldLabel: string, oldValue?: string, newValue?: string, onRevert?: () => void) => void;
  /** Called when a non-material field changes (sales rep, payment method, contact) */
  onNonMaterialChange?: (fieldKey: string, fieldLabel: string, oldValue?: string, newValue?: string) => void;
  /** Called when an attachment/instruction changes (prompt user) */
  /** `onRevert` lets the caller hand back a rollback for the change
   *  they just applied. The version prompt invokes it when the user
   *  discards the prompt, so a Confirmed-stage rejection actually
   *  undoes the mutation instead of leaving it in place. */
  onAskUserChange?: (fieldKey: string, fieldLabel: string, changeDescription: string, onRevert?: () => void) => void;
  /** Shared pricing-rules API from QuoteDetails — forwarded to the
   *  PricingRulesManageModal and (via ItemsTabTableClean) to the line
   *  item configurator so totals + activation stay in lockstep. */
  pricingAPI?: import('./usePricingRules').PricingRulesAPI;
  /** Shared one-time-adjustments API from QuoteDetails — forwarded to the
   *  ManageAdjustmentsModal so summary + configurator stay in lockstep. */
  adjustmentsAPI?: import('./useAdjustments').AdjustmentsAPI;
  /** Real quote line items. Threaded to the summary modal + adjustments
   *  so they all reflect the same data. */
  quoteLines?: any[];
  /** Per-line shipment costs (undefined when a line inherits the quote
   *  default). When any entry is numeric, the line totals replace the
   *  quote-level shipmentCost in the summary aggregation. Caller is
   *  the items table, which knows each line's shipmentConfig. */
  lineShipmentCosts?: Array<number | undefined>;
  /** Quote-level freight default. When provided, this is the single
   *  source of truth shared with the items table / configurator. The
   *  FreightBreakdownModal reads from and writes to this value. */
  quoteDefaultFreight?: number;
  onSetQuoteDefaultFreight?: (cost: number) => void;
  /** Per-line freight cost map keyed by line id. Drives the freight
   *  modal's per-line table and gets mutated by its toggle / edit
   *  callbacks so the modal and the configurator stay in sync. */
  lineFreightCosts?: Record<string, number>;
  onSetLineFreightCost?: (lineId: string, cost: number | undefined) => void;
  /** Called when the user collapses per-line freight back to a single
   *  quote-level charge — clears the entire per-line map. */
  onClearAllLineFreightCosts?: () => void;
}

export function RightSidebar({
  subtotal: subtotalProp,
  pricingRules = 0,
  adjustments = 0,
  adjustmentCount = 0,
  pricingRuleCount = 0,
  grandTotal: grandTotalProp,
  activeTab,
  onNavigateToTab,
  quoteStatus = 'sent',
  expiryDate: propExpiryDate,
  createdDate: propCreatedDate,
  readOnly = false,
  customerName: propCustomerName = 'Unknown Customer',
  contactName: propContactName = 'Unknown Contact',
  quoteId,
  salesRep: _propSalesRep,
  salesRepId: _propSalesRepId,
  quotePrimaryPoC,
  quoteAdditionalPoCs,
  quoteAdditionalSalesReps,
  quoteRecord,
  quoteGrandTotal,
  onMaterialChange,
  onNonMaterialChange,
  onAskUserChange,
  pricingAPI,
  adjustmentsAPI,
  quoteLines = [],
  lineShipmentCosts,
  quoteDefaultFreight,
  onSetQuoteDefaultFreight,
  lineFreightCosts,
  onSetLineFreightCost,
  onClearAllLineFreightCosts,
}: RightSidebarProps) {
  // ── Collapse state (sub-sections) ──
  const [showAddressDetail, setShowAddressDetail] = useState(false);
  const [showPaymentShipping, setShowPaymentShipping] = useState(false);
  const [showManageAdjustmentsModal, setShowManageAdjustmentsModal] = useState(false);

  // ── Sidebar card collapse state — owned by DashInfoCard now ──
  /* Tags on the record, edited in place from this card. */
  const [sidebarTags, setSidebarTags] = useState<string[]>(['Ambulance Build', 'grant-funded']);
  const [showPricingRulesManageModal, setShowPricingRulesManageModal] = useState(false);
  const [showAddQuoteLevelAdjModal, setShowAddQuoteLevelAdjModal] = useState(false);

  // ── Sidebar section highlight animation state ──
  const [highlightSection, setHighlightSection] = useState<string | null>(null);
  const highlightTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerHighlight = useCallback((section: string) => {
    setHighlightSection(section);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightSection(null), 2000);
  }, []);
  const getHighlightStyle = (section: string): CSSProperties => {
    if (highlightSection !== section) return {};
    return {
      animation: 'sidebarHighlight 2s ease-out',
      boxShadow: '0 0 0 2px rgba(59,130,246,0.15)',
      borderRadius: '6px',
    };
  };

  // ── Live pricing rules state ──
  /* Derive amount + count directly from `pricingAPI` when available so
     the sidebar reflects the same numbers the configurator + manage
     modal see on first paint. The previous implementation stored the
     value in component state seeded from the prop default (0), and
     only updated when PricingRulesManageModal's useEffect fired on
     mount — which is why opening + closing the modal "without doing
     anything" changed the displayed value from $0 to the real net.
     handlePricingRulesChange now just triggers the highlight pulse;
     the real numbers come from pricingAPI on every render. */
  const livePricingRulesAmount = pricingAPI
    ? (pricingAPI.totalDiscount - pricingAPI.totalPremium)
    : pricingRules;
  const livePricingRuleCount = pricingAPI ? pricingAPI.activeRuleCount : pricingRuleCount;
  const handlePricingRulesChange = useCallback((_totalAmount: number, _ruleCount: number) => {
    triggerHighlight('pricingRules');
  }, [triggerHighlight]);

  // ── Dates state ──
  const [requestDate, setRequestDate] = useState(new Date(2026, 0, 28));
  const [respondDate, setRespondDate] = useState(new Date(2026, 1, 16));
  // If quote has already been sent and no explicit effective date was set, resolve to sent date
  const [effectiveDate, setEffectiveDate] = useState<Date | null>(
    (quoteStatus === 'sent' || quoteStatus === 'confirmed' || quoteStatus === 'converted' || quoteStatus === 'expired')
      ? new Date(2026, 1, 10) // resolved from "When sent" to the sent date
      : null
  );
  // Track whether effective date was auto-resolved from "When sent"
  const [effectiveAutoResolved, setEffectiveAutoResolved] = useState(
    (quoteStatus === 'sent' || quoteStatus === 'confirmed' || quoteStatus === 'converted' || quoteStatus === 'expired')
  );
  const [expiryDate, setExpiryDate] = useState(propExpiryDate || new Date(2026, 1, 28));
  const [editingDateType, setEditingDateType] = useState<DateKey | null>(null);

  // ── Lifecycle milestone dates ──
  const [sentDate, setSentDate] = useState<Date | null>(
    (quoteStatus === 'sent' || quoteStatus === 'confirmed' || quoteStatus === 'converted' || quoteStatus === 'expired')
      ? new Date(2026, 1, 10) : null
  );
  const [confirmedDate, setConfirmedDate] = useState<Date | null>(
    (quoteStatus === 'confirmed' || quoteStatus === 'converted')
      ? new Date(2026, 1, 14) : null
  );
  const [convertedDate, setConvertedDate] = useState<Date | null>(
    quoteStatus === 'converted' ? new Date(2026, 1, 16) : null
  );
  const createdDate = propCreatedDate || new Date(2026, 1, 5);

  /* ── Quote-level shipment default (declared inline so the
     timeline dates below can read it). Per-line overrides live on
     each line item; this sidebar always reflects the quote default. */
  const [shipment, setShipment] = useState<ShipmentConfig>(DEFAULT_SHIPMENT);
  const shipmentDescribed = describeShipment(shipment);
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [showFreightBreakdown, setShowFreightBreakdown] = useState(false);

  /* Keep the sidebar's local shipmentCost in sync with the parent-owned
     quote default. Without this the description chip would lag whenever
     a non-modal surface (e.g., the configurator's split confirmation)
     changes the quote-level freight. */
  useEffect(() => {
    if (typeof quoteDefaultFreight !== 'number') return;
    setShipment((prev) =>
      prev.shipmentCost === quoteDefaultFreight ? prev : { ...prev, shipmentCost: quoteDefaultFreight }
    );
  }, [quoteDefaultFreight]);

  /* Timeline dates — pinned values from the Shipment modal take
     precedence over the prior hardcoded fallbacks. The delivery
     range collapses to a single date when the user has pinned
     Expected Delivery; otherwise it surfaces the carrier method's
     min/max transit window. */
  const _shipmentDates = getShipmentDates(shipment);
  const shipByDate = _shipmentDates.shipBy;
  const deliveryRangeStart = _shipmentDates.deliveryMin;
  const deliveryRangeEnd = _shipmentDates.deliveryMax;

  // Update milestone dates when status changes
  useEffect(() => {
    const now = new Date();
    if ((quoteStatus === 'sent' || quoteStatus === 'confirmed' || quoteStatus === 'converted' || quoteStatus === 'expired') && !sentDate) {
      setSentDate(now);
      // When sent, set effective date to now if it was "When sent"
      if (!effectiveDate) {
        setEffectiveDate(now);
        setEffectiveAutoResolved(true);
      }
    }
    if ((quoteStatus === 'confirmed' || quoteStatus === 'converted') && !confirmedDate) {
      setConfirmedDate(now);
    }
    if (quoteStatus === 'converted' && !convertedDate) {
      setConvertedDate(now);
    }
  }, [quoteStatus]);

  // ── Customer state ──
  const [customerName, setCustomerName] = useState(propCustomerName);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  // Inline create-customer for the change-customer flow. seedName is
  // the typed search query when the user hits "Create new customer …"
  // from the SearchOverlay; after creation we synthesize the same
  // pendingCustomerSelection a normal pick would set, so the rest of
  // the change flow (location → confirm) continues unchanged.
  /* Partner-tab handshake state — when the Partner Management new
     tab posts back a created customer / contact, we hold the payload
     here so the existing change-flow pipeline (setPendingCustomerSelection
     / setPendingPocOverride) still runs locally. */
  const [pendingCustomerCreation, setPendingCustomerCreation] = useState<CreatedCustomerPayload | null>(null);
  const [pendingContactCreation, setPendingContactCreation] = useState<CreatedContactPayload | null>(null);
  const [pendingCustomerSelection, setPendingCustomerSelection] = useState<{
    customerId: string;
    customerName: string;
    contactName: string;
    contactId?: string;
    contactInitials?: string;
    contactTitle?: string;
    locations: { id: string; name: string; city: string; address: string; isDefault: boolean }[];
    isSameCustomer: boolean;
  } | null>(null);
  const [pendingChange, setPendingChange] = useState<{
    newCustomerName: string;
    newLocation: string;
    newContactName: string;
    isSameCustomer: boolean;
  } | null>(null);
  /* Hold the candidate contact when the user picks a different POC
     for the SAME customer in the SearchOverlay. We surface a
     confirmation prompt before swapping the primary so the user
     can't lose context on the current primary by an accidental
     click. */
  const [pendingPocOverride, setPendingPocOverride] = useState<{
    id: string;
    name: string;
    initials: string;
    title: string;
  } | null>(null);
  /* Overlay shown after the user confirms the customer change. Holds
     the in-flight "from → to" pair so the overlay can label itself
     and the hydration block (run on `onDone`) can read the target
     name without race-conditions with state already moved on. */
  const [customerSwitchInFlight, setCustomerSwitchInFlight] = useState<{ from: string; to: string } | null>(null);

  // ── Contact / POC ──
  /* Seed `pocs` from the real quote record (`primaryPoC` +
     `additionalPoCs`) when the caller passes them. The previous
     implementation laminated the propContactName on top of
     INITIAL_POCS, which is the static six-person fallback list — so
     the secondary contacts on a quote in the sidebar never matched
     the additionalPoCs surfaced in the listing/kanban for the same
     quote. INITIAL_POCS is still used as a last-resort when no roster
     is passed (the wizard / brand-new quote case). */
  const initialPocs = useMemo(() => {
    const toRow = (p: { id: string; name: string; role?: string }) => ({
      id: p.id,
      initials: (p.name || '').split(' ').map((w) => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase(),
      name: p.name || '',
      title: p.role || 'Primary Contact',
    });
    if (quotePrimaryPoC?.name) {
      const rest = (quoteAdditionalPoCs ?? []).filter((p) => p?.name).map(toRow);
      return [toRow(quotePrimaryPoC), ...rest];
    }
    /* A real quote with no point of contact: start empty so the card
       shows its empty state, never the placeholder roster below. */
    if (quoteRecord) return [];
    const baseRoster = INITIAL_POCS;
    if (!propContactName || propContactName === 'Unknown Contact') return baseRoster;
    const existingIdx = baseRoster.findIndex((p) => p.name === propContactName);
    if (existingIdx >= 0) {
      const primary = baseRoster[existingIdx];
      const rest = baseRoster.filter((_, i) => i !== existingIdx);
      return [primary, ...rest];
    }
    const initials = propContactName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    return [
      { id: `primary-${propContactName.replace(/\s+/g, '-').toLowerCase()}`, initials, name: propContactName, title: 'Primary Contact' },
      ...baseRoster,
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [pocs, setPocs] = useState(initialPocs);
  const [primaryPocId, setPrimaryPocId] = useState(initialPocs[0]?.id ?? '');
  /* `contactName` is kept around for audit-log oldValue strings and
     cross-customer flows that still pass it through, but the visible
     "Primary" rendering must come from `pocs.find(... primaryPocId)`
     so the sidebar always reflects the single source of truth. */
  const [contactName, setContactName] = useState(propContactName);
  const primaryContact = pocs.find((p) => p.id === primaryPocId) ?? pocs[0];
  const otherContacts = pocs.filter((p) => p.id !== primaryContact?.id);
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [recipientsEditTarget, setRecipientsEditTarget] = useState<'primary' | 'pocs'>('primary');

  // ── Sales Rep ──
  /* Seed `selectedSalesReps` from the quote's real rep roster
     (`salesRep` + `additionalSalesReps`) when the caller passes them.
     The previous implementation hardcoded "Sarah Chen / Mike Johnson /
     Emily Williams" so the sidebar drifted from the listing's rep
     column for the same quote. */
  const initialSalesReps = useMemo<SelectedSalesRep[]>(() => {
    const toRow = (rep: { id: string; name: string }, isPrimary: boolean, isCustomerDefault: boolean): SelectedSalesRep => {
      /* Resolve against the shared roster so a rep stored with the
         creation flow's id (e.g. `rep-yn`) lights up the correct row
         in the picker. Fall back to a hash of the name when the
         stored entry isn't on the roster. */
      const roster = findRosterRep(rep.id, rep.name);
      return {
        id: roster?.id ?? rep.id,
        name: roster?.name ?? rep.name,
        initials: roster?.initials ?? rep.name.split(' ').map((w) => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase(),
        isPrimary,
        isCurrentUser: !!roster?.isCurrentUser,
        isCustomerDefault,
      };
    };
    if (_propSalesRep) {
      const primary = toRow({ id: _propSalesRepId ?? '', name: _propSalesRep }, true, true);
      const extras = (quoteAdditionalSalesReps ?? []).filter((r) => r?.name).map((r) => toRow(r, false, false));
      return [primary, ...extras];
    }
    /* A real quote with no sales rep is unassigned. */
    if (quoteRecord) return [];
    return [
      { id: 'rep1', name: 'Sarah Chen', initials: 'SC', isPrimary: true, isCurrentUser: true, isCustomerDefault: false },
      { id: 'rep2', name: 'Mike Johnson', initials: 'MJ', isPrimary: false, isCurrentUser: false, isCustomerDefault: false },
      { id: 'rep3', name: 'Emily Williams', initials: 'EW', isPrimary: false, isCurrentUser: false, isCustomerDefault: true },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selectedSalesReps, setSelectedSalesReps] = useState<SelectedSalesRep[]>(initialSalesReps);
  const [showSalesRepModal, setShowSalesRepModal] = useState(false);
  const salesRepTriggerRef = useRef<HTMLDivElement>(null);
  const [salesRepPanelPos, setSalesRepPanelPos] = useState<{ left: number; bottom: number; width: number } | null>(null);
  useLayoutEffect(() => {
    if (!showSalesRepModal || !salesRepTriggerRef.current) return;
    const rect = salesRepTriggerRef.current.getBoundingClientRect();
    setSalesRepPanelPos({ left: rect.left - 4, bottom: window.innerHeight - rect.top + 4, width: rect.width + 8 });
  }, [showSalesRepModal]);

  // ── Address ──
  /* Records created after the commercial fields existed carry them as
     strings ('' = not set). Older mock records have no field at all
     (undefined) and keep the legacy placeholder addresses. */
  const addressFromRecord = <T,>(value: string | undefined, id: string, fallback: T) => {
    if (value === undefined) return fallback;
    return { id, label: propCustomerName, street: value.trim(), city: '', state: '', zip: '', country: '', isDefault: false };
  };
  const [billingAddress, setBillingAddress] = useState(() => addressFromRecord(quoteRecord?.billingAddress, 'addr-bill-record', {
    id: 'addr1', label: 'Headquarters', street: '6145 Logistics Center Blvd', city: 'Rockford', state: 'IL', zip: '61101', country: 'United States', isDefault: true,
  }));
  const [shippingAddress, setShippingAddress] = useState(() => addressFromRecord(quoteRecord?.shippingAddress, 'addr-ship-record', {
    id: 'addr2', label: 'Main Depot', street: '4200 Industrial Blvd, Suite 300', city: 'Houston', state: 'TX', zip: '77073', country: 'United States', isDefault: false,
  }));
  /** One-line address that skips empty parts (record-sourced addresses
   *  carry the whole line in `street`). */
  const formatAddress = (a: { street?: string; city?: string; state?: string; zip?: string } | null | undefined) =>
    a ? [a.street, a.city, [a.state, a.zip].filter(Boolean).join(' ')].filter((x) => x && String(x).trim()).join(', ') : '';
  const [addressModalType, setAddressModalType] = useState<'billing' | 'shipping' | null>(null);

  // ── Payment ──
  const [paymentTerms, setPaymentTerms] = useState(() =>
    quoteRecord?.paymentTerms !== undefined
      ? { id: quoteRecord.paymentTerms ? 'record' : '', name: quoteRecord.paymentTerms }
      : { id: 'net30', name: 'Net 30' });
  const [showPaymentTermsModal, setShowPaymentTermsModal] = useState(false);
  /* Initial state aligns with the saved-methods library's default
     entry (pm-ach-1, "Main operating account") so the sidebar and the
     selection modal open in lockstep — both showing the same active
     method instead of a generic ACH placeholder that didn't match any
     real card. */
  const [paymentMethod, setPaymentMethod] = useState(() =>
    quoteRecord?.paymentMethod !== undefined
      ? { id: quoteRecord.paymentMethod ? 'record' : '', name: quoteRecord.paymentMethod, icon: 'CreditCard' as const }
      : { id: 'pm-ach-1', name: 'Main operating account', icon: 'CreditCard' as const });
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  /* Shipment state moved above with the timeline dates so the
     timeline reads the user-pinned values. (Originally declared here.) */

  // ── Derived ──
  const today = new Date(2026, 1, 16);
  const respondDiff = Math.ceil((respondDate.getTime() - today.getTime()) / 86400000);
  const expiryDiff = Math.ceil((expiryDate.getTime() - today.getTime()) / 86400000);
  const respondOverdue = respondDiff < 0;
  const respondDueToday = respondDiff === 0;
  const respondDueSoon = respondDiff > 0 && respondDiff <= 7;
  const expiryPast = expiryDiff < 0;
  const expiryDueSoon = expiryDiff >= 0 && expiryDiff <= 14;
  const shipByDiff = Math.ceil((shipByDate.getTime() - today.getTime()) / 86400000);
  const shipByNear = shipByDiff >= 0 && shipByDiff <= 14;
  const shipByPast = shipByDiff < 0;
  // Editable until Converted to SO (then read-only; can only duplicate or cancel)
  const canEdit = !readOnly && quoteStatus !== 'converted' && quoteStatus !== 'cancelled' && quoteStatus !== 'archived' && quoteStatus !== 'expired';
  const datesEditable = canEdit;

  // ── Formatters ──
  const fmtShort = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  const fmtFull = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  const pl = (n: number, w: string) => `${Math.abs(n)} ${w}${Math.abs(n) === 1 ? '' : 's'}`;

  // ── Status pill — context-aware, actionable copy ──
  const getStatusPill = (): { text: string; color: string; bg: string; icon: 'clock' | 'alert' } | null => {
    if (quoteStatus === 'confirmed' || quoteStatus === 'converted') return null;

    if (quoteStatus === 'expired') {
      return { text: `Quote expired ${pl(Math.abs(expiryDiff), 'day')} ago — reactivate to resume`, color: 'var(--warning)', bg: 'rgba(217, 119, 6, 0.2)', icon: 'alert' as const };
    }

    if (quoteStatus === 'draft') {
      if (respondDiff > 7) return { text: `Respond by ${fmtShort(respondDate)}`, color: 'var(--primary)', bg: 'var(--accent)', icon: 'clock' };
      if (respondDiff > 0) return { text: `Response due in ${pl(respondDiff, 'day')}`, color: 'var(--warning)', bg: 'rgba(217, 119, 6, 0.1)', icon: 'clock' };
      if (respondDueToday) return { text: 'Response due today — send now', color: '#EA580C', bg: '#FFF7ED', icon: 'alert' };
      return { text: `Response overdue by ${pl(respondDiff, 'day')}`, color: 'var(--destructive)', bg: 'rgba(220, 38, 38, 0.1)', icon: 'alert' };
    }

    // sent
    if (respondOverdue) return { text: `Response overdue by ${pl(respondDiff, 'day')}`, color: 'var(--destructive)', bg: 'rgba(220, 38, 38, 0.1)', icon: 'alert' };
    if (respondDueToday) return { text: 'Response due today', color: '#EA580C', bg: '#FFF7ED', icon: 'alert' };
    if (respondDueSoon) return { text: `Response due in ${pl(respondDiff, 'day')}`, color: 'var(--warning)', bg: 'rgba(217, 119, 6, 0.1)', icon: 'clock' };
    if (expiryPast) return { text: `Quote expired ${pl(expiryDiff, 'day')} ago`, color: 'var(--destructive)', bg: 'rgba(220, 38, 38, 0.1)', icon: 'alert' };
    if (expiryDiff <= 14) return { text: `Quote expires in ${pl(expiryDiff, 'day')}`, color: 'var(--warning)', bg: 'rgba(217, 119, 6, 0.1)', icon: 'clock' };
    return { text: `Valid for ${pl(expiryDiff, 'day')}`, color: 'var(--primary)', bg: 'var(--accent)', icon: 'clock' };
  };
  const statusPill = getStatusPill();

  // ── Date modal helpers ──
  const dateFmtForModal = (d: Date) => {
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  };

  const getModalConfig = (key: DateKey) => {
    const editableKeys: DateKey[] = ['request', 'respond', 'effective', 'expiry'];
    if (!editableKeys.includes(key)) return { dateType: 'absolute', absoluteValue: '', relativeValue: '7', relativeUnit: 'days', whenSent: false };
    const map: Record<string, Date | null> = { request: requestDate, respond: respondDate, effective: effectiveDate, expiry: expiryDate };
    const d = map[key];
    return {
      dateType: key === 'effective' && !d ? 'relative' : 'absolute',
      absoluteValue: d ? dateFmtForModal(d) : '',
      relativeValue: '7',
      relativeUnit: 'days',
      whenSent: key === 'effective' && !d,
    };
  };

  const handleDateSave = (key: DateKey, config: any) => {
    if (key === 'effective' && config.whenSent) {
      const fmtDate = (d: Date | null) => d ? `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}` : '—';
      const prevEffective = effectiveDate;
      const prevEffectiveAutoResolved = effectiveAutoResolved;
      setEffectiveDate(null);
      setEffectiveAutoResolved(false);
      setEditingDateType(null);
      toast.success('Effective date set to "When sent"', { position: 'top-right' });
      /* "When sent" is still a material change to Effective From —
         the resolved date shifts to the send timestamp. Provide a
         revert so a discarded version prompt restores the previous
         absolute date and auto-resolved flag. */
      onMaterialChange?.(
        'effective_from',
        'Effective From',
        fmtDate(prevEffective),
        'When sent',
        () => {
          setEffectiveDate(prevEffective);
          setEffectiveAutoResolved(prevEffectiveAutoResolved);
        },
      );
      return;
    }
    let nd: Date | null = null;
    if (config.absoluteValue) {
      const parts = config.absoluteValue.split(' ')[0].split('/');
      if (parts.length === 3) {
        nd = new Date(+parts[2], +parts[1] - 1, +parts[0]);
        if (isNaN(nd.getTime())) nd = null;
      }
    } else if (config.relativeValue && config.relativeUnit) {
      nd = new Date(today);
      const v = parseInt(config.relativeValue);
      if (config.relativeUnit === 'days') nd.setDate(nd.getDate() + v);
      else if (config.relativeUnit === 'weeks') nd.setDate(nd.getDate() + v * 7);
      else if (config.relativeUnit === 'months') nd.setMonth(nd.getMonth() + v);
    }
    if (nd) {
      const labels: Record<string, string> = { request: 'Request date', respond: 'Respond by date', effective: 'Effective date', expiry: 'Expires on date' };
      const fmtDate = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
      const oldDate = ({ request: requestDate, respond: respondDate, effective: effectiveDate, expiry: expiryDate } as any)[key];
      const prevEffectiveAutoResolved = effectiveAutoResolved;
      const setter = ({ request: setRequestDate, respond: setRespondDate, effective: setEffectiveDate, expiry: setExpiryDate } as any)[key];
      setter?.(nd);
      // Clear auto-resolved flag when user explicitly sets effective date
      if (key === 'effective') {
        setEffectiveAutoResolved(false);
      }
      toast.success(`${labels[key] || 'Date'} updated`, { position: 'top-right' });
      /* Material changes (per 4.2): Expiry Date, Respond-By, and
         Effective From. Each ships a revert callback so a discarded
         version prompt snaps the date back to its previous value
         (and the effective auto-resolved flag, when applicable). */
      const revert = () => {
        setter?.(oldDate);
        if (key === 'effective') setEffectiveAutoResolved(prevEffectiveAutoResolved);
      };
      if (key === 'expiry') {
        onMaterialChange?.('expiry_date', 'Expiration Date', oldDate ? fmtDate(oldDate) : '—', fmtDate(nd), revert);
      } else if (key === 'respond') {
        onMaterialChange?.('due_by_date', 'Respond-By Date', oldDate ? fmtDate(oldDate) : '—', fmtDate(nd), revert);
      } else if (key === 'effective') {
        onMaterialChange?.('effective_from', 'Effective From', oldDate ? fmtDate(oldDate) : '—', fmtDate(nd), revert);
      }
    }
    setEditingDateType(null);
  };

  // ── Customer visual ──
  const customerInitials = customerName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const custColor = getPoCColor(customerInitials);

  // ── Timeline entries — dynamic based on status ──
  const buildTimelineEntries = () => {
    const entries: { key: DateKey; label: string; value: string; color: string; dotColor: string; dotFill?: boolean; editable?: boolean; icon?: React.ElementType; infoTooltip?: string; warningTooltip?: string; relative?: { rule: string; anchor: string; showResolved?: boolean } }[] = [];

    // Request Date — customer requests before quote is created (earliest)
    entries.push({
      key: 'request', label: 'Request Date', value: fmtShort(requestDate),
      color: '#334155', dotColor: 'var(--muted-foreground)',
      icon: Calendar,
    });

    // Created — always shown, never editable
    entries.push({
      key: 'created', label: 'Created', value: fmtShort(createdDate),
      color: '#334155', dotColor: 'var(--muted-foreground)', editable: false,
      icon: FilePlus,
    });

    // Respond By — only shown in draft state (when sent, it's considered responded)
    if (quoteStatus === 'draft') {
      // Only highlight if due soon (≤7 days), due today, or overdue
      const respondNeedsAttention = respondOverdue || respondDueToday || respondDueSoon;
      entries.push({
        key: 'respond', label: 'Respond By',
        value: fmtShort(respondDate),
        color: respondOverdue ? 'var(--destructive)' : respondDueToday ? '#EA580C' : respondDueSoon ? 'var(--warning)' : 'var(--muted-foreground)',
        dotColor: respondNeedsAttention ? (respondOverdue ? 'var(--destructive)' : 'var(--warning)') : 'var(--muted-foreground)',
        icon: Clock,
      });
    }

    // Effective From — shown in draft/sent (but not when confirmed)
    if (quoteStatus === 'draft' || quoteStatus === 'sent') {
      /* "When sent" is a relative date, so it always shows a date with the
         asterisk: today's date while in draft (the day it lands on if sent
         today), the send date once sent. The hover card carries the rule. */
      entries.push({
        key: 'effective', label: 'Effective From',
        value: fmtShort(effectiveDate ?? new Date()),
        relative: !effectiveDate
          ? { rule: 'set to the day the quote is sent', anchor: 'the send date' }
          : effectiveAutoResolved
            /* Already the real send date, so no "Today" row in the hover. */
            ? { rule: 'set to the day the quote was sent', anchor: 'the send date', showResolved: false }
            : undefined,
        color: '#334155', dotColor: 'var(--muted-foreground)',
        icon: CalendarCheck,
      });
    }

    // Sent On — shown when status >= sent (historical milestone, no highlight)
    if (sentDate && (quoteStatus === 'sent' || quoteStatus === 'confirmed' || quoteStatus === 'converted' || quoteStatus === 'expired')) {
      entries.push({
        key: 'sentOn', label: 'Sent On', value: fmtShort(sentDate),
        color: '#334155', dotColor: 'var(--primary)', editable: false,
        icon: Send,
      });
    }

    // Confirmed On — shown when confirmed or converted (historical milestone)
    if (confirmedDate && (quoteStatus === 'confirmed' || quoteStatus === 'converted')) {
      entries.push({
        key: 'confirmedOn', label: 'Confirmed On', value: fmtShort(confirmedDate),
        color: '#334155', dotColor: 'var(--success)', editable: false,
        icon: Check,
      });
    }

    // Converted On — shown when converted (historical milestone)
    if (convertedDate && quoteStatus === 'converted') {
      entries.push({
        key: 'convertedOn', label: 'Converted On', value: fmtShort(convertedDate),
        color: '#334155', dotColor: 'var(--success)', editable: false,
        icon: CheckCircle2,
      });
    }

    // Ship By / Pick Up — when the shipment is set to customer pickup
    // the order never enters carrier transit, so the milestone is the
    // pickup appointment, not a ship-by. Label flips and the separate
    // delivery row drops because pickup = delivery same day.
    //
    // The header-level ship-by is a derived, read-only value: it reflects
    // the EARLIEST ship-by across the quote's line items (the first
    // shipment to leave the dock). An always-on Info icon explains this;
    // an amber AlertTriangle surfaces when 2+ lines have differing
    // ship-by dates and names the line driving the earliest date.
    const isCustomerPickup = shipment.method === 'customer-pickup';
    const lineShipInfo = computeLineShipBy(quoteLines);
    const infoText = isCustomerPickup
      ? "Earliest pickup date across all line items in this quote. Set manually by the user in each item's advanced configuration."
      : "Earliest ship-by date across all line items in this quote. Set manually by the user in each item's advanced configuration.";
    const warningText = lineShipInfo.hasDivergence && lineShipInfo.earliestLineName
      ? `Earliest ${isCustomerPickup ? 'pickup' : 'ship-by'} date, from ${lineShipInfo.earliestLineName}. Other items in this quote have later ${isCustomerPickup ? 'pickup' : 'ship-by'} dates.`
      : undefined;
    entries.push({
      key: 'shipBy', label: isCustomerPickup ? 'Pick Up' : 'Ship By', value: fmtShort(shipByDate),
      color: shipByPast ? 'var(--destructive)' : shipByNear ? 'var(--warning)' : 'var(--muted-foreground)',
      dotColor: shipByPast ? 'var(--destructive)' : shipByNear ? 'var(--warning)' : 'var(--muted-foreground)',
      editable: false,
      infoTooltip: infoText,
      warningTooltip: warningText,
      icon: Truck,
    });

    // Expected Delivery — shown when confirmed or converted, hidden
    // for customer pickup (same as the pickup date).
    if (!isCustomerPickup && (quoteStatus === 'confirmed' || quoteStatus === 'converted')) {
      entries.push({
        key: 'delivery', label: 'Est. Delivery',
        value: `${fmtShort(deliveryRangeStart)} – ${fmtShort(deliveryRangeEnd)}`,
        color: '#334155', dotColor: 'var(--muted-foreground)', editable: false,
        icon: MapPin,
      });
    }

    // Expires On — only highlight if near (≤14 days) or past
    entries.push({
      key: 'expiry', label: 'Expires On', value: fmtShort(expiryDate),
      color: expiryPast ? 'var(--destructive)' : expiryDueSoon ? 'var(--warning)' : 'var(--muted-foreground)',
      dotColor: expiryPast ? 'var(--destructive)' : expiryDueSoon ? 'var(--warning)' : 'var(--muted-foreground)',
      icon: Clock,
    });

    return entries;
  };

  const dateEntries = buildTimelineEntries();

  // ── Adjustment data-aware flags ──
  // Read from the shared adjustments API when wired so the sidebar
  // reflects live add/edit/delete + `%` math instead of stale prop
  // defaults. Falls back to the props only when the API isn't passed.
  const liveAdjustmentNet = adjustmentsAPI ? adjustmentsAPI.grandTotal.net : adjustments;
  const liveAdjustmentList = adjustmentsAPI ? adjustmentsAPI.adjustments : [];
  const liveAdjustmentCount = adjustmentsAPI ? liveAdjustmentList.length : adjustmentCount;
  const liveQuoteLevelAdjCount = adjustmentsAPI
    ? liveAdjustmentList.filter(a => a.scope === 'quote').length
    : 0;
  const hasAdjustments = liveAdjustmentCount > 0;
  const hasPricingRules = livePricingRuleCount > 0;

  // Net adjustment color: positive (premium) = red, negative (discount) = green
  const adjustmentNet = liveAdjustmentNet; // positive = premium net, displayed as +
  const pricingRulesNet = -livePricingRulesAmount; // pricing rules reduce price

  /* Resolved freight total. Lines without per-line costs inherit the
     quote default; as soon as any line carries an explicit cost, the
     sum across lines replaces the default. Mirrors the contract in
     ShipmentMethodModal.sumLineShipmentCosts.

     The per-line shipment configs aren't yet plumbed from the items
     table to this sidebar — when the wiring lands the `lineShipmentCosts`
     prop will supply them. For now the quote-level cost surfaces alone.
  */
  const lineCostsSum = (lineShipmentCosts && lineShipmentCosts.length > 0)
    ? lineShipmentCosts.reduce((a, c) => a + (typeof c === 'number' ? c : 0), 0)
    : undefined;
  const anyLineHasCost = (lineShipmentCosts ?? []).some((c) => typeof c === 'number');
  const resolvedShipmentTotal: number = anyLineHasCost
    ? (lineCostsSum ?? 0)
    : (typeof shipment.shipmentCost === 'number' ? shipment.shipmentCost : 0);

  /* Subtotal + grand total — when the caller passes explicit numbers
     they win (creation-flow / mid-edit cases). Otherwise we anchor on
     the quote record's `totalValue` so the sidebar always reads the
     same number as the listing/kanban for the same record. The
     hardcoded `87000 / 81275` defaults were the source of "$18k in
     listing, $81k in sidebar" drift reports. */
  const subtotal = subtotalProp ?? quoteGrandTotal ?? 0;
  /* Adjustment net comes from the live API: positive = net premium (adds
     to the grand total), negative = net discount (subtracts). When no
     live data is present, fall back to the quote's `totalValue` so
     listing and sidebar agree. */
  const computedGrandTotal = subtotal - livePricingRulesAmount + liveAdjustmentNet;
  const liveGrandTotal = grandTotalProp ?? (livePricingRulesAmount !== 0 || liveAdjustmentNet !== 0 ? computedGrandTotal : (quoteGrandTotal ?? subtotal));
  void resolvedShipmentTotal;

  return (
    <div
      className="flex flex-col gap-4 md:max-lg:grid md:max-lg:grid-cols-2 md:max-lg:items-start lg:sticky lg:top-6"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Stacked under the line items below lg (PO's breakpoint), the
          cards would stretch to the full page width though they are
          designed at 300px. Between md and lg they sit two across, close
          to that width; below md they stack one per row. Sticky only
          applies beside the body column, at lg and up. */}
      <style>{`
        @keyframes sidebarHighlight {
          0% { background-color: var(--accent); }
          30% { background-color: var(--accent); }
          100% { background-color: transparent; }
        }
      `}</style>

      {/* ═══════ 1. CUSTOMER INFORMATION ═══════
           Verbatim shape of Purchase Order's `Vendor Information` card
           (`POSidebarSections.tsx:428-960`):
             · Hero row (always visible): 40px gradient avatar + customer
               name + summary line "N contacts · N locations · Net 30".
             · `Contact` InnerAccordion (open by default) — bare PoC
               content (no surrounding box): 40px violet-gradient avatar
               with emerald online dot, name + blue Star, role, and an
               always-visible inline pencil; secondary contacts disclose
               below via `SecondaryContactsToggle`.
             · `Shipping & Billing` InnerAccordion — Bill To + Ship To
               LocationCards + compact Shipment Method info row.
             · `Payment Terms` InnerAccordion — full `PaymentTermCard`.
             · `Payment Method` InnerAccordion — full `PaymentMethodCard`. */}
      <DashInfoCard title="Customer Information" icon={Users}>
        <div className="px-0.5">
          <CustomerIdentityRow
            name={customerName}
            summary={(() => {
              /* Customer's primary address — reflects whichever
                 customer is selected (state resets from
                 `defaults.billingAddress` on customer change).
                 Contacts / locations / payment-terms are surfaced by
                 the accordions below (and by the avatar hover card),
                 so restating them here would be redundant. */
              if (!billingAddress?.street) return FIELD_RULES.customerAddress.emptyLabel;
              return formatAddress(billingAddress);
            })()}
            hoverInfo={(() => {
              /* Customer-level phone/email are not carried on the
                 Quote `Customer` shape, so derive deterministically
                 from the customer name (info@slug.com + hashed
                 corporate line). Counts come from MOCK_CUSTOMERS when
                 we can resolve the seed record; the local `pocs`
                 state is used as the fallback so freshly-created
                 customers still show a coherent number. */
              const cust = MOCK_CUSTOMERS.find(c => c.name === customerName);
              const slug = customerName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'customer';
              let h = 0;
              for (let i = 0; i < customerName.length; i++) h = (customerName.charCodeAt(i) + ((h << 5) - h)) | 0;
              const abs = Math.abs(h);
              const npa = 200 + (abs % 700);
              const exch = 200 + ((abs * 7) % 700);
              const num = 1000 + ((abs * 13) % 9000);
              /* Name-only customer: no phone or email on file, so none
                 is derived (the hover omits those rows). */
              const sparse = isSparseCustomer(customerName);
              return {
                phone: sparse ? undefined : `(${npa}) ${exch}-${num}`,
                email: sparse ? undefined : `info@${slug}.com`,
                contactsCount: cust?.totalContacts ?? pocs.length,
                locationsCount: cust?.locations?.length ?? [billingAddress, shippingAddress].filter(a => a?.street).length,
              };
            })()}
            onEdit={canEdit ? () => setShowCustomerModal(true) : undefined}
          />

          <div className="mt-3">
            <InnerAccordion title="Point of Contacts" defaultOpen={true}>
              {/* Look up phone + email for the primary PoC from
                  `MOCK_CONTACTS` (the same seed the recipients picker
                  and LocationSelectionModal read from), so the contact
                  rows match what the picker shows. The local `pocs`
                  state on the sidebar only carries id / name / title /
                  initials — phone + email live on the seeded record. */}
              {(() => {
                const id = primaryContact?.id;
                /* With a real record and no contact, stay empty: the card
                   renders "No primary contact" instead of "Unknown
                   Contact" with invented details. */
                const name = primaryContact?.name || (quoteRecord ? '' : contactName);
                if (!name) {
                  return (
                    <PrimaryContactCard
                      name=""
                      onEdit={canEdit ? () => { setRecipientsEditTarget('primary'); setShowRecipientsModal(true); } : undefined}
                    />
                  );
                }
                const seeded = MOCK_CONTACTS.find(c => c.id === id || (name && c.name === name));
                /* Always surface phone + email on the PoC card so the
                   sidebar reads the same for every quote. When the
                   seeded contact record is missing them (freshly-created
                   contacts, or contacts not in MOCK_CONTACTS), derive
                   deterministically off the contact + customer name so
                   the two rows still render with sensible values. */
                const slug = (customerName || 'company').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'company';
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
                    name={name}
                    role={primaryContact?.title}
                    phone={seeded?.phone || derivedPhone}
                    email={seeded?.email || derivedEmail}
                    onEdit={canEdit ? () => { setRecipientsEditTarget('primary'); setShowRecipientsModal(true); } : undefined}
                  />
                );
              })()}
              <SecondaryContactsToggle
                contacts={otherContacts.map(c => ({ name: c.name, role: c.title }))}
              />
            </InnerAccordion>

            <InnerAccordion title="Shipping & Billing" defaultOpen={false}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <LocationCard
                  label="Bill To"
                  icon={CreditCard}
                  tooltip="The customer location that receives the invoice. Defaults to the customer's primary billing address; override here when this quote bills somewhere else."
                  info={{
                    displayName: billingAddress?.street ? billingAddress.label : 'Not Set',
                    address: billingAddress?.street ? formatAddress(billingAddress) : '',
                    abbr: billingAddress.label
                      ? billingAddress.label.split(' ').map(w => w[0]).join('').slice(0, 2)
                      : 'BL',
                  }}
                  canEdit={canEdit}
                  onEdit={() => setAddressModalType('billing')}
                  emptyLabel={FIELD_RULES.billTo.emptyLabel}
                  showAddress
                />
                <LocationCard
                  label="Ship To"
                  icon={Truck}
                  tooltip="The destination the goods physically ship to. Defaults to the customer's primary shipping address; override per quote when applicable."
                  info={{
                    displayName: shippingAddress?.street ? shippingAddress.label : 'Not Set',
                    address: shippingAddress?.street ? formatAddress(shippingAddress) : '',
                    abbr: shippingAddress.label
                      ? shippingAddress.label.split(' ').map(w => w[0]).join('').slice(0, 2)
                      : 'SH',
                  }}
                  canEdit={canEdit}
                  onEdit={() => setAddressModalType('shipping')}
                  emptyLabel={FIELD_RULES.shipTo.emptyLabel}
                  showAddress
                />
                {/* Shipment Method — minimal info row inside Shipping &
                    Billing (PO has no equivalent card). */}
                <div
                  onClick={() => canEdit && setShowShipmentModal(true)}
                  className={`group rounded-xl border bg-white transition-all duration-200 ${canEdit ? 'cursor-pointer hover:border-slate-300 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]' : ''}`}
                  style={{ borderColor: '#E8ECF1', padding: 12 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Truck className="w-3.5 h-3.5 shrink-0" style={{ color: '#94A3B8' }} strokeWidth={2} />
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#64748B', lineHeight: 1.4 }}>
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
                  name: paymentTerms.name,
                  type: /split/i.test(paymentTerms.name) ? 'Split' : /^pre|^prepaid|deposit/i.test(paymentTerms.name) ? 'Pre' : 'NET',
                  triggerEvent: /shipping/i.test(paymentTerms.name) ? 'Post Shipping' : 'Post Invoice',
                }}
                onClick={canEdit ? () => setShowPaymentTermsModal(true) : undefined}
              />
            </InnerAccordion>

            <InnerAccordion title="Payment Method" defaultOpen={false}>
              {/* `isDefault` is deliberately omitted — Purchase Order
                  uses it to mark the preferred method when a vendor has
                  several on file, but a quote carries exactly one
                  payment method so the "primary among many" semantic
                  doesn't apply. Without it the card drops the 1.5px
                  blue ring + primary glow + "Primary" star pill and
                  reads as a regular detail card. */}
              <PaymentMethodCard
                method={{
                  type: /wire/i.test(paymentMethod.name) ? 'Wire Transfer' : /ach|operating/i.test(paymentMethod.name) ? 'ACH' : /check/i.test(paymentMethod.name) ? 'Check' : /card|credit/i.test(paymentMethod.name) ? 'Credit Card' : undefined,
                  bankName: paymentMethod.name,
                }}
                fallbackName={paymentMethod.name}
                onClick={canEdit ? () => setShowPaymentMethodModal(true) : undefined}
              />
            </InnerAccordion>
          </div>
        </div>
      </DashInfoCard>

      {/* ═══════ 2. QUOTE SUMMARY ═══════ */}
      <DashInfoCard title="Quote Summary" icon={DollarSign}>
        {/* Purchase Order `Order Summary` chrome (PO `PurchaseOrderDraft.tsx:3651-3706`):
            10/500 slate-400 hero label → 20px/700 currency total → 11/400
            caption, divider, then 10/500 label · 12/500 value breakdown
            rows in `space-y-2.5`. The redundant Grand Total row at the
            bottom is dropped because the hero already surfaces it.
            Pricing Rules + One-Time Discounts retain their full
            functionality (signed-delta values, Manage link when active,
            Manage / Add CTAs when empty) — only the visual rhythm
            changed to match PO. */}
        <div className="px-0.5">
          {/* Hero — Grand Total + item-count caption */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: "#64748B", fontFamily: "Inter, system-ui, sans-serif" }}>
              Grand Total
            </p>
            <p
              className="text-slate-700 tracking-tight tabular-nums"
              style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2, fontFamily: 'Inter, system-ui, sans-serif' }}
              title={fmtCurrency(liveGrandTotal)}
            >
              {fmtCurrency(liveGrandTotal)}
            </p>
            <p className="text-slate-500 mt-1 truncate" style={{ fontSize: 11, fontWeight: 400, fontFamily: 'Inter, system-ui, sans-serif' }}>
              5 items
            </p>
          </div>

          {/* Breakdown rows — PO's canonical recipe */}
          <div className="border-t border-muted pt-3" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Subtotal */}
            <div className="flex items-center justify-between">
              <p className="text-slate-400" style={{ fontSize: 10, fontWeight: 400, fontFamily: 'Inter, system-ui, sans-serif' }}>Subtotal</p>
              <p className="text-slate-700 tabular-nums" style={{ fontSize: 12, fontWeight: 500, fontFamily: 'Inter, system-ui, sans-serif' }} title={fmtCurrency(subtotal)}>
                {fmtCurrency(subtotal)}
              </p>
            </div>

            {/* Pricing Rules Applied — signed-delta value; PO chrome
                gives Discount a `text-success` colour, we extend the
                convention: + = purple premium, - = green discount,
                0 = slate-400. Always-visible Manage CTA below when
                empty + editable; SummaryInfoRow when rules are active. */}
            <div style={getHighlightStyle('pricingRules')}>
              <div className="flex items-center justify-between">
                <p style={{ fontSize: 11, fontWeight: 500, fontFamily: 'Inter, system-ui, sans-serif', color: '#64748B' }}>
                  Pricing Rules Applied
                </p>
                <p
                  className="tabular-nums"
                  style={{
                    fontSize: 12, fontWeight: 500, fontFamily: 'Inter, system-ui, sans-serif',
                    color: pricingRulesNet > 0 ? '#7C3AED' : pricingRulesNet < 0 ? 'var(--success)' : '#475569',
                  }}
                  title={`${pricingRulesNet > 0 ? '+' : pricingRulesNet < 0 ? '-' : ''}${fmtCurrency(Math.abs(pricingRulesNet))}`}
                >
                  {pricingRulesNet > 0 ? '+' : pricingRulesNet < 0 ? '-' : ''}{fmtCurrency(Math.abs(pricingRulesNet))}
                </p>
              </div>
              {hasPricingRules ? (
                <SummaryInfoRow
                  label={`${livePricingRuleCount} rules · applied to 5 items`}
                  onClick={() => setShowPricingRulesManageModal(true)}
                  color={pricingRulesNet > 0 ? '#7C3AED' : pricingRulesNet < 0 ? 'var(--success)' : undefined}
                />
              ) : canEdit ? (
                /* Empty-state CTA — colour matches the neutral $0 value
                   above (slate-700) so the row + link read as one
                   group. The same rule the active-state SummaryInfoRow
                   follows when its value is zero. */
                <button
                  type="button"
                  onClick={() => setShowPricingRulesManageModal(true)}
                  className="inline-flex items-center gap-1.5 mt-1.5 hover:underline underline-offset-2 cursor-pointer transition-colors"
                  style={{ fontSize: 11, fontWeight: 500, color: '#334155', fontFamily: 'Inter, system-ui, sans-serif' }}
                >
                  <Tag className="w-3 h-3 text-muted-foreground/60" />
                  Manage Pricing Rules
                </button>
              ) : null}
            </div>

            {/* One-Time Discounts/Premiums — same signed-delta + manage
                pattern. The "Add quote-level discount/premium" dashed
                button stays for the empty + editable case. */}
            <div style={getHighlightStyle('adjustments')}>
              <div className="flex items-center justify-between">
                <p style={{ fontSize: 11, fontWeight: 500, fontFamily: 'Inter, system-ui, sans-serif', color: '#64748B' }}>
                  One-Time Discounts/Premiums
                </p>
                <p
                  className="tabular-nums"
                  style={{
                    fontSize: 12, fontWeight: 500, fontFamily: 'Inter, system-ui, sans-serif',
                    color: adjustmentNet > 0 ? '#7C3AED' : adjustmentNet < 0 ? 'var(--success)' : '#475569',
                  }}
                  title={`${adjustmentNet > 0 ? '+' : adjustmentNet < 0 ? '-' : ''}${fmtCurrency(Math.abs(adjustmentNet))}`}
                >
                  {adjustmentNet > 0 ? '+' : adjustmentNet < 0 ? '-' : ''}{fmtCurrency(Math.abs(adjustmentNet))}
                </p>
              </div>
              {hasAdjustments ? (
                <SummaryInfoRow
                  label={`${liveAdjustmentCount} discount${liveAdjustmentCount === 1 ? '' : 's'}/premium${liveAdjustmentCount === 1 ? '' : 's'} · ${liveQuoteLevelAdjCount} quote-level`}
                  onClick={() => setShowManageAdjustmentsModal(true)}
                  color={adjustmentNet > 0 ? '#7C3AED' : adjustmentNet < 0 ? 'var(--success)' : undefined}
                />
              ) : canEdit ? (
                <button
                  onClick={() => setShowAddQuoteLevelAdjModal(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    marginTop: 7, padding: '5px 8px',
                    borderRadius: 6, cursor: 'pointer',
                    borderWidth: 1, borderStyle: 'dashed', borderColor: 'var(--accent)',
                    backgroundColor: 'var(--background)',
                    fontSize: 11, fontWeight: 500, color: 'var(--primary)',
                    lineHeight: 1, transition: 'all 150ms',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)'; e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--background)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                >
                  <Plus style={{ width: 11, height: 11 }} />
                  Add quote-level discount/premium
                </button>
              ) : null}
            </div>

            {/* Freight Charges — feature paused (kept for re-enablement).
                Saved values still live on `shipment.shipmentCost` + the
                `lineFreightCosts` map. */}
            {false && (
              <div className="flex items-center justify-between">
                <p style={{ fontSize: 11, fontWeight: 500, fontFamily: 'Inter, system-ui, sans-serif', color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Truck style={{ width: 11, height: 11 }} />
                  Freight Charges
                </p>
                <p
                  className="tabular-nums"
                  style={{
                    fontSize: 12, fontWeight: 500, fontFamily: 'Inter, system-ui, sans-serif',
                    color: resolvedShipmentTotal > 0 ? 'var(--destructive)' : '#475569',
                  }}
                >
                  {resolvedShipmentTotal > 0 ? '+' : ''}{fmtCurrency(resolvedShipmentTotal)}
                </p>
              </div>
            )}
          </div>
        </div>
      </DashInfoCard>

      {/* ═══════ 3. TIMELINE ═══════ */}
      <DashInfoCard title="Timeline" icon={CalendarDays}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {dateEntries.map((entry, idx) => (
            <TimelineDateRow
              key={entry.key}
              entry={entry}
              datesEditable={datesEditable}
              onEdit={(key) => {
                // Only open modal for editable date keys
                if (['request', 'respond', 'effective', 'expiry'].includes(key)) {
                  setEditingDateType(key);
                }
              }}
              isLast={idx === dateEntries.length - 1}
            />
          ))}
        </div>

        {/* Status pill — outline banner pattern (matches the overdue
            invoice banner in the SO Order Summary card + Purchase Order's
            timeline urgency banner). Tinted background at ~10%, border
            at ~25%, icon + caption in the semantic colour. */}
        {statusPill && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              marginTop: 10, padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: `color-mix(in srgb, ${statusPill.color} 8%, transparent)`,
              border: `1px solid color-mix(in srgb, ${statusPill.color} 25%, transparent)`,
            }}
          >
            {statusPill.icon === 'alert'
              ? <AlertCircle className="size-3.5 shrink-0" style={{ color: statusPill.color }} strokeWidth={2} />
              : <Clock className="size-3.5 shrink-0" style={{ color: statusPill.color }} strokeWidth={2} />}
            <span
              className="truncate"
              style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.4, color: statusPill.color, fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              {statusPill.text}
            </span>
          </div>
        )}
      </DashInfoCard>

      {/* ═══════ 4. QUOTE INFORMATION ═══════ */}
      <DashInfoCard title="Quote Information" icon={UserCircle}>

        {/* Sales Representatives — Purchase Order `Contact` accordion
            shape: bare `PrimaryContactCard` (no surrounding box) for the
            primary rep with always-visible inline pencil, followed by
            `SecondaryContactsToggle` for additional reps. Sales reps
            don't carry phone / email in our domain so those rows are
            omitted; the role line surfaces "(You)" when the rep is the
            signed-in user, otherwise their department / "Sales Rep". */}
        <div ref={salesRepTriggerRef} style={{ position: 'relative' }}>
          {(() => {
            const primary = selectedSalesReps.find(r => r.isPrimary) || selectedSalesReps[0];
            const others = selectedSalesReps.filter(r => r.id !== primary?.id);
            if (!primary) {
              return (
                <SidebarEmptyValue
                  icon={UserIcon}
                  emptyLabel={FIELD_RULES.salesRep.emptyLabel}
                  onClick={canEdit ? () => setShowSalesRepModal(true) : undefined}
                />
              );
            }
            return (
              <>
                <PrimaryContactCard
                  name={`${primary.name}${primary.isCurrentUser ? ' (You)' : ''}`}
                  role="Sales Representative"
                  onEdit={canEdit ? () => setShowSalesRepModal(true) : undefined}
                />
                <SecondaryContactsToggle
                  contacts={others.map(r => ({ name: r.name, role: 'Sales Rep' }))}
                  nounSingular="sales representative"
                  nounPlural="sales representatives"
                />
              </>
            );
          })()}
        </div>

        {/* Sales rep picker — centered BaseModal so it can never be clipped
            by the sidebar overflow (matches the SO module's pattern). */}
        <BaseModal
          isOpen={showSalesRepModal}
          onClose={() => setShowSalesRepModal(false)}
          title="Sales representatives"
          width="md"
          bodyClassName="p-0"
          footer={
            <ModalSecondaryButton onClick={() => setShowSalesRepModal(false)}>Done</ModalSecondaryButton>
          }
        >
          <SalesRepSelector
            availableReps={SIDEBAR_SALES_REPS}
            selectedReps={selectedSalesReps}
            onSelectedRepsChange={(newReps) => {
              const oldPrimary = selectedSalesReps.find(r => r.isPrimary)?.name || 'None';
              const newPrimary = newReps.find(r => r.isPrimary)?.name || newReps[0]?.name || 'None';
              setSelectedSalesReps(newReps);
              if (oldPrimary !== newPrimary || selectedSalesReps.length !== newReps.length) {
                onNonMaterialChange?.('assigned_salesperson', 'Sales Representative', oldPrimary, newPrimary);
              }
            }}
            renderDropdownOnly
            onClose={() => setShowSalesRepModal(false)}
            fullWidth
          />
        </BaseModal>

        {/* ── Created By + Last Updated — Partner DashInfoCard footer pattern ── */}
        <div className="grid grid-cols-2 gap-x-4 pt-2.5 mt-3 border-t border-muted">
          <div className="min-w-0">
            <DashInfoLabel>Created By</DashInfoLabel>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Avatar name="Sarah Chen" size={20} />
              <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>Sarah Chen</span>
            </div>
          </div>
          <div className="min-w-0">
            <DashInfoLabel>Last Updated</DashInfoLabel>
            <p className="text-[12px] text-slate-700 mt-0.5 truncate" style={{ fontWeight: 500 }}>{fmtFull(createdDate)}</p>
          </div>
        </div>

        {/* ── Tags ──
            They sit with the other created facts rather than in Deal
            Information: on a detail page a tag's job is search and grouping,
            not data entry, which is the placement the Cycle Count plan detail
            uses. Adding and removing still work, in the same strip. */}
        <div className="pt-2.5 mt-3 border-t border-muted">
          <DashInfoLabel>Tags</DashInfoLabel>
          <div className="mt-1">
            <TagStrip tags={sidebarTags} editable={!readOnly} onChange={readOnly ? undefined : setSidebarTags} />
          </div>
        </div>
      </DashInfoCard>

      {/* ═══════ MODALS ═══════ */}

      {/* Pricing Rules Manage Modal */}
      {showPricingRulesManageModal && pricingAPI && (
        <PricingRulesManageModal
          isOpen
          onClose={() => { setShowPricingRulesManageModal(false); triggerHighlight('pricingRules'); }}
          readOnly={readOnly}
          lines={quoteLines}
          pricingAPI={pricingAPI}
          /* Post-draft library mutations stage on the next version; the
             current quote stays untouched until the version prompt runs. */
          stageLibraryChanges={quoteStatus === 'sent' || quoteStatus === 'confirmed'}
          onRulesChange={handlePricingRulesChange}
          onMaterialEvent={(description, onRevert) =>
            onAskUserChange?.('pricing_rules', 'Pricing Rules', description, onRevert)
          }
          customerName={customerName}
          /* Quote ids ending in "-empty", "-002" (the second quote in
             the default list — empty-state reference), or whose customer
             is "No Rules Demo" start the modal with an empty rule list. */
          startEmpty={(quoteId ?? "").toLowerCase().endsWith("-empty") || (quoteId ?? "").endsWith("-002") || customerName === "No Rules Demo"}
        />
      )}

      {/* Manage Adjustments Modal */}
      {showManageAdjustmentsModal && adjustmentsAPI && (
        <ManageAdjustmentsModal
          isOpen
          onClose={() => { setShowManageAdjustmentsModal(false); triggerHighlight('adjustments'); }}
          readOnly={readOnly}
          lines={quoteLines}
          adjustmentsAPI={adjustmentsAPI}
          onMaterialEvent={(description, onRevert) =>
            onAskUserChange?.('one_time_adjustments', 'One-Time Discounts/Premiums', description, onRevert)
          }
        />
      )}

      {/* Add Quote-Level Adjustment Modal (direct add, not manage).
          Threads adjustmentsAPI so the save lands in the same store
          the sidebar's count + Manage modal read from — without this
          the shortcut used to fire a success toast but never persist,
          and the sidebar stayed on the "+ Add" affordance forever. */}
      <AddQuoteLevelAdjustmentModal
        isOpen={showAddQuoteLevelAdjModal}
        onClose={() => { setShowAddQuoteLevelAdjModal(false); triggerHighlight('adjustments'); }}
        adjustmentsAPI={adjustmentsAPI}
        onMaterialEvent={(description, onRevert) => onAskUserChange?.('one_time_adjustments', 'One-Time Discounts/Premiums', description, onRevert)}
      />

      {/* Per-date edit modals */}
      {editingDateType && ['request', 'respond', 'effective', 'expiry'].includes(editingDateType) && (
        <DateEditModal
          type={editingDateType as any}
          isOpen
          onClose={() => setEditingDateType(null)}
          onSave={(config) => handleDateSave(editingDateType, config)}
          initialConfig={getModalConfig(editingDateType)}
        />
      )}

      {/* Recipients / POC */}
      {showRecipientsModal && (
        <RecipientsSelectionModal isOpen onClose={() => setShowRecipientsModal(false)}
          onSelect={(recipients, primaryPoCId) => {
            /* Policy: changing the PoC roster (adding, removing, or
               re-picking the primary) is NOT a material change. Route
               through onNonMaterialChange only — never through
               onMaterialChange — so post-Sent / post-Confirmed edits
               don't fire the version prompt. */
            /* The recipients list must always have at least one
               contact — without a primary POC the quote has nobody
               addressable. */
            if (recipients.length === 0) {
              toast.error('Pick at least one contact to keep the quote addressable.', { position: 'top-right' });
              return;
            }
            const primary = recipients.find(r => r.id === primaryPoCId) || recipients[0];
            /* Reorder so the primary sits at index 0 — keeps the
               sidebar's "secondary avatars" slice from accidentally
               including the primary again. */
            const ordered = [primary, ...recipients.filter(r => r.id !== primary.id)];
            const newPocs = ordered.map(r => ({
              id: r.id,
              initials: r.initials || r.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
              name: r.name,
              title: r.role || r.department || 'Contact',
            }));
            setPocs(newPocs);
            setPrimaryPocId(primary.id);
            if (primary) setContactName(primary.name);
            toast.success(
              recipientsEditTarget === 'primary'
                ? `Primary contact updated to ${primary?.name || 'Unknown'}`
                : `Updated ${recipients.length} contacts`,
              { position: 'top-right' },
            );
            onNonMaterialChange?.('contact_person', 'Contact Person', contactName, primary?.name || 'Unknown');
            setShowRecipientsModal(false);
          }}
          currentCustomerId="cust1" currentCustomerName={customerName}
          /* Derive the quote's current location from the primary
             PoC's id in MOCK_CONTACTS — that's the same seed the
             creation overlay and the LocationSelectionModal read, so
             the recipients picker scopes "This location only" to the
             exact location the quote was created against, and the
             list matches across creation and details. */
          currentLocationId={(() => {
            const id = primaryPocId || pocs[0]?.id;
            const name = pocs.find(p => p.id === id)?.name;
            const seeded = MOCK_CONTACTS.find(c => c.id === id || (name && c.name === name));
            return seeded?.locationId;
          })()}
          /* Tell the modal which row is currently primary so it lands
             with the same Primary pill the sidebar shows. Without
             this the modal silently re-picked pocs[0]. */
          primaryPoCId={primaryPocId || pocs[0]?.id}
          selectedRecipients={pocs.map(p => ({
            id: p.id, name: p.name,
            email: `${p.name.toLowerCase().replace(' ', '.')}@company.com`,
            phone: '(555) 000-0000', role: p.title, department: '',
            initials: p.initials, avatarColor: 'var(--accent)',
          }))}
        />
      )}

      {/* Address */}
      {addressModalType && (
        <AddressSelectionModal isOpen onClose={() => setAddressModalType(null)}
          onSelect={(address, _p, _s) => {
            if (addressModalType === 'billing') {
              /* Snapshot the full pre-change address so a discarded
                 version prompt restores every field, not just the
                 label. */
              const prevAddress = billingAddress;
              setBillingAddress(address);
              toast.success(`Billing address updated to ${address.label}`, { position: 'top-right' });
              onMaterialChange?.(
                'bill_to',
                'Bill To',
                prevAddress.label,
                address.label,
                () => setBillingAddress(prevAddress),
              );
            } else {
              const prevAddress = shippingAddress;
              setShippingAddress(address);
              toast.success(`Shipping address updated to ${address.label}`, { position: 'top-right' });
              onMaterialChange?.(
                'ship_to',
                'Ship To',
                prevAddress.label,
                address.label,
                () => setShippingAddress(prevAddress),
              );
            }
            setAddressModalType(null);
          }}
          type={addressModalType} customerName={customerName}
          currentCustomer={{ id: 'partner1', name: customerName, type: 'Customer', location: [billingAddress?.city, billingAddress?.state].filter(Boolean).join(', ') }}
          currentAddress={addressModalType === 'billing' ? billingAddress : shippingAddress}
        />
      )}

      {/* Payment Terms */}
      {showPaymentTermsModal && (
        <PaymentTermsLibrary isOpen onClose={() => setShowPaymentTermsModal(false)}
          onSelect={(term, _s) => {
            /* Snapshot the full pre-change term (id + name) so a
               discarded version prompt restores both. */
            const prevTerms = paymentTerms;
            setPaymentTerms({ id: term.id, name: term.name });
            toast.success(`Payment terms updated to ${term.name}`, { position: 'top-right' });
            onMaterialChange?.(
              'payment_terms',
              'Payment Terms',
              prevTerms.name,
              term.name,
              () => setPaymentTerms(prevTerms),
            );
            setShowPaymentTermsModal(false);
          }}
          currentTermId={paymentTerms.name || paymentTerms.id} customerName={customerName} />
      )}

      {/* Payment Method */}
      {showPaymentMethodModal && (
        <PaymentMethodSelectionModal isOpen onClose={() => setShowPaymentMethodModal(false)}
          onSelect={(method, _s) => {
            const oldMethod = paymentMethod.name;
            setPaymentMethod({ id: method.id, name: method.name, icon: method.icon });
            toast.success(`Payment method updated to ${method.name}`, { position: 'top-right' });
            onNonMaterialChange?.('payment_method', 'Payment Method', oldMethod, method.name);
            setShowPaymentMethodModal(false);
          }}
          currentMethodId={paymentMethod.id} customerName={customerName} />
      )}

      {/* Shipment Method — quote-level default. */}
      {showShipmentModal && (
        <ShipmentMethodModal
          isOpen
          onClose={() => setShowShipmentModal(false)}
          value={shipment}
          onSave={(next) => {
            setShipment(next);
            toast.success('Quote shipment default updated', { position: 'top-right' });
          }}
          scopeLabel="Quote Default"
        />
      )}

      {/* Freight Charges breakdown — order default + per-line
          overrides with toggle. Both the quote-level default and the
          per-line costs come from parent state (QuoteDetails) so the
          freight modal, the items table, and the line configurator
          all read from and write to the same source of truth. */}
      {showFreightBreakdown && (
        <FreightBreakdownModal
          isOpen
          onClose={() => setShowFreightBreakdown(false)}
          scopeLabel="Quote Default"
          defaultCost={
            typeof quoteDefaultFreight === 'number'
              ? quoteDefaultFreight
              : (typeof shipment.shipmentCost === 'number' ? shipment.shipmentCost : 0)
          }
          onChangeDefault={(v) => {
            /* Always update local shipment so the sidebar's display
               narrative (carrier + method copy) stays consistent.
               When parent owns the freight value, mirror the change
               upward via the setter so the items table and
               configurator see the new default too. */
            setShipment((prev) => ({ ...prev, shipmentCost: v }));
            onSetQuoteDefaultFreight?.(v);
          }}
          defaultMethod={shipment.method}
          lines={(quoteLines ?? []).map((l, idx): FreightLine => {
            const lid = String(l?.id ?? idx);
            const lineMethod = (l as any)?.shipmentConfig?.method;
            return {
              id: lid,
              code: String(l?.productId ?? l?.code ?? `Line ${idx + 1}`),
              description: String(l?.productName ?? l?.description ?? ''),
              subtotal: Number(l?.subtotal ?? l?.total ?? 0),
              /* Parent map wins when present; the legacy
                 lineShipmentCosts array stays as a fallback for callers
                 still on the old contract. */
              overrideCost: lineFreightCosts?.[lid] ?? lineShipmentCosts?.[idx],
              /* Per-line method drives the disabled state for the
                 freight input — customer-pickup lines never bill. */
              shipmentMethod: lineMethod,
            };
          })}
          onToggleLine={(lineId, next) => {
            onSetLineFreightCost?.(lineId, next);
          }}
          onChangeLineCost={(lineId, next) => {
            onSetLineFreightCost?.(lineId, next);
          }}
        />
      )}

      {/* Change Customer — Step 1: Search overlay (no locations tab) */}
      {showCustomerModal && (
        <SearchOverlay
          isOpen
          onClose={() => setShowCustomerModal(false)}
          customers={MOCK_CUSTOMERS}
          contacts={MOCK_CONTACTS}
          currentCustomerName={customerName}
          hideLocationsTab
          onSelectCustomer={(selectedCust) => {
            const isSame = selectedCust.name === customerName;
            const custContacts = MOCK_CONTACTS.filter(c => c.customerId === selectedCust.id);
            const primaryContact = custContacts.find(c => c.isPrimary) || custContacts[0];
            if (isSame) {
              /* Re-picking the same customer routes through the
                 LocationSelectionModal so the user can switch
                 locations without changing customer. */
              setPendingCustomerSelection({
                customerId: selectedCust.id,
                customerName: selectedCust.name,
                contactName: primaryContact?.name || contactName,
                contactId: primaryContact?.id,
                contactInitials: primaryContact?.initials,
                contactTitle: primaryContact?.title,
                locations: selectedCust.locations,
                isSameCustomer: true,
              });
              setShowCustomerModal(false);
              return;
            }
            /* Different customer: skip the location-picker step. The
               new customer's default location is applied automatically
               via `getCustomerDefaults` during the switch, so making
               the user re-choose it was redundant. */
            const defaultLoc = selectedCust.locations.find(l => l.isDefault) ?? selectedCust.locations[0];
            setPendingChange({
              newCustomerName: selectedCust.name,
              newLocation: defaultLoc?.name || 'Default location',
              newContactName: primaryContact?.name || 'Unassigned',
              isSameCustomer: false,
            });
            setShowCustomerModal(false);
          }}
          onSelectContact={(contact) => {
            const isSame = contact.customerName === customerName;
            const selectedCustomer = MOCK_CUSTOMERS.find(c => c.id === contact.customerId);
            if (isSame) {
              /* Picking a different POC for the same customer is
                 a primary-override — route through a confirmation
                 prompt so the user can back out before we re-rank
                 the existing recipient list. If the picked contact
                 is already primary, no-op silently. */
              if (contact.id === primaryPocId) {
                setShowCustomerModal(false);
                return;
              }
              setPendingPocOverride({
                id: contact.id,
                name: contact.name,
                initials: contact.initials,
                title: contact.title,
              });
              setShowCustomerModal(false);
            } else {
              /* Different customer via contact pick: same short-cut
                 as `onSelectCustomer`. Skip the location step and
                 fall through to the change-customer confirmation
                 with the new customer's default location. */
              const defaultLoc = (selectedCustomer?.locations || []).find(l => l.isDefault) ?? selectedCustomer?.locations?.[0];
              setPendingChange({
                newCustomerName: contact.customerName,
                newLocation: defaultLoc?.name || 'Default location',
                newContactName: contact.name,
                isSameCustomer: false,
              });
              setShowCustomerModal(false);
            }
          }}
          onAddNew={async (tab, query) => {
            /* Both routes open the Partner Management new tab. On
               payload return the existing change-flow handlers
               consume the result. */
            if (tab === 'all' || tab === 'customers') {
              setShowCustomerModal(false);
              const result = await openPartnerTab<CreatedCustomerPayload>('create-customer', { seedName: query, origin: 'quote' });
              if (result) setPendingCustomerCreation(result.payload);
            } else if (tab === 'contacts') {
              setShowCustomerModal(false);
              const currentCust = MOCK_CUSTOMERS.find((c) => c.name === customerName);
              const result = await openPartnerTab<CreatedContactPayload>('create-poc', {
                seedName: query,
                customerId: currentCust?.id,
                customerName,
                origin: 'quote',
              });
              if (result) setPendingContactCreation(result.payload);
            }
          }}
        />
      )}

      {/* Continuation overlays for partner-tab payloads in the
          change-customer flow. The Partner Management tab plays its
          "Adding…" arc and closes; these cover the brief gap before
          the new record lands in the change-customer pipeline. */}
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
                const isSame = existing.name === customerName;
                const custContacts = MOCK_CONTACTS.filter((c) => c.customerId === existing.id);
                const primaryContact = custContacts.find((c) => c.isPrimary) || custContacts[0];
                if (isSame) {
                  setPendingCustomerSelection({
                    customerId: existing.id,
                    customerName: existing.name,
                    contactName: primaryContact?.name || customerName,
                    contactId: primaryContact?.id,
                    contactInitials: primaryContact?.initials,
                    contactTitle: primaryContact?.title,
                    locations: existing.locations,
                    isSameCustomer: true,
                  });
                } else {
                  /* Different customer: skip location step, use the
                     existing customer's default location. */
                  const defaultLoc = existing.locations.find(l => l.isDefault) ?? existing.locations[0];
                  setPendingChange({
                    newCustomerName: existing.name,
                    newLocation: defaultLoc?.name || 'Default location',
                    newContactName: primaryContact?.name || 'Unassigned',
                    isSameCustomer: false,
                  });
                }
                toast.success(`Using existing customer "${existing.name}"`, { position: 'top-right' });
              }
            } else {
              const payload = pendingCustomerCreation;
              const newId = `c_new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const defaultLocId = `${newId}_loc0`;
              const defaultLocation = {
                id: defaultLocId,
                name: 'Headquarters Main',
                city: payload.defaultAddress.cityState,
                address: payload.defaultAddress.full,
                isDefault: true,
              };
              const newCustomer = {
                id: newId,
                name: payload.name,
                logo: payload.logoLetter,
                status: 'Active' as const,
                locations: [defaultLocation],
                totalContacts: 0,
                recentQuote: '—',
              };
              (MOCK_CUSTOMERS as Array<typeof newCustomer>).unshift(newCustomer);
              /* Newly-created customer: skip location step (there's
                 only the one default location on the new record
                 anyway) and go straight to the confirmation. */
              setPendingChange({
                newCustomerName: newCustomer.name,
                newLocation: defaultLocation.name,
                newContactName: 'Unassigned',
                isSameCustomer: false,
              });
              toast.success(`Customer "${newCustomer.name}" added`, { position: 'top-right' });
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
            const targetCust = payload.companyId
              ? MOCK_CUSTOMERS.find((c) => c.id === payload.companyId)
              : MOCK_CUSTOMERS.find((c) => c.name === customerName);
            const newContact = {
              id: payload.id,
              name: payload.name,
              initials: payload.initials,
              email: payload.email,
              phone: payload.phone,
              mobile: payload.mobile,
              extension: payload.phoneExt,
              title: payload.role,
              department: payload.department,
              customerId: targetCust?.id || '',
              customerName: targetCust?.name || payload.companyName,
              customerLogo: targetCust?.logo || '',
              locationId: targetCust?.locations?.[0]?.id || '',
              locationName: targetCust?.locations?.[0]?.name || '',
              locationCity: targetCust?.locations?.[0]?.city || '',
              locationAddress: targetCust?.locations?.[0]?.address || '',
              isPrimary: false,
            };
            (MOCK_CONTACTS as Array<typeof newContact>).unshift(newContact);
            const isSameCustomer = targetCust?.name === customerName;
            if (isSameCustomer) {
              setPendingPocOverride({
                id: newContact.id,
                name: newContact.name,
                initials: newContact.initials,
                title: newContact.title,
              });
            } else if (targetCust) {
              /* Different customer via contact creation: skip the
                 location step and use the target customer's default. */
              const defaultLoc = targetCust.locations.find(l => l.isDefault) ?? targetCust.locations[0];
              setPendingChange({
                newCustomerName: targetCust.name,
                newLocation: defaultLoc?.name || 'Default location',
                newContactName: newContact.name,
                isSameCustomer: false,
              });
            }
            toast.success(`Contact "${newContact.name}" added`, { position: 'top-right' });
          }
          setPendingContactCreation(null);
        }}
      />

      {/* Change Customer — Step 2: Location selection */}
      {pendingCustomerSelection && (
        <LocationSelectionModal
          isOpen
          onClose={() => setPendingCustomerSelection(null)}
          onSelect={(location) => {
            if (pendingCustomerSelection.isSameCustomer) {
              toast.success(`Location updated to ${location.name.split('(')[0].trim()}`, { position: 'top-right' });
              setPendingCustomerSelection(null);
            } else {
              setPendingChange({
                newCustomerName: pendingCustomerSelection.customerName,
                newLocation: location.name,
                newContactName: pendingCustomerSelection.contactName,
                isSameCustomer: false,
              });
              setPendingCustomerSelection(null);
            }
          }}
          currentLocationId=""
          customerName={pendingCustomerSelection.customerName}
          locations={pendingCustomerSelection.locations}
        />
      )}

      {/* Customer change confirmation — Partner amber discard chrome.
          Wider chrome (520) so the side-by-side comparison fits without
          wrapping. Warning copy lists every field that will be replaced
          so the user can decide before hydration runs. */}
      {pendingChange && !pendingChange.isSameCustomer && (
        <ConfirmDiscardModal
          open
          onOpenChange={(o) => { if (!o) setPendingChange(null); }}
          variant="warning"
          badge="Change customer"
          title="Change customer?"
          description={`Switching to ${pendingChange.newCustomerName} will pull that customer's defaults from their partner record and replace the values on this quote.`}
          confirmLabel="Confirm & reset data"
          cancelLabel="Cancel"
          maxWidth={520}
          onConfirm={() => {
            /* Surface the overlay first; the actual hydration runs in
               its onDone so the UI matches what the user just saw
               marching through the checklist. */
            setCustomerSwitchInFlight({ from: customerName, to: pendingChange.newCustomerName });
            setPendingChange(null);
          }}
        >
          {/* Transition visual — old → new, side-by-side. Both cards
              get `min-w-0` so the truncation works inside the flex
              row, and `whitespace-nowrap` on the secondary line so
              long contact + location strings ellipsize cleanly. */}
          <div className="flex items-stretch gap-3">
            <div className="flex-1 px-3 py-2.5 rounded-lg border border-border bg-muted/50 min-w-0">
              <div className="text-[10px] uppercase tracking-widest mb-1" style={{ fontWeight: 600, color: 'var(--muted-foreground)', opacity: 0.7 }}>From</div>
              <div className="text-[12px] truncate" style={{ fontWeight: 600, color: 'var(--muted-foreground)', textDecoration: 'line-through' }}>{customerName}</div>
              <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>{contactName}</div>
            </div>
            <div className="flex items-center shrink-0">
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 px-3 py-2.5 rounded-lg border bg-[#FFFBEB] min-w-0" style={{ borderColor: '#FDE68A' }}>
              <div className="text-[10px] uppercase tracking-widest mb-1" style={{ fontWeight: 600, color: '#B45309', opacity: 0.85 }}>To</div>
              <div className="text-[12px] truncate" style={{ fontWeight: 600, color: '#92400E' }}>{pendingChange.newCustomerName}</div>
              <div className="text-[10px] mt-0.5 truncate" style={{ color: '#B45309', fontWeight: 500 }}>{pendingChange.newContactName} · {pendingChange.newLocation}</div>
            </div>
          </div>
          {/* Reset checklist — explicit list of every field that will
              be overwritten on confirm. Helps the user predict the
              blast radius before they hit Confirm. */}
          <div className="mt-4 px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50/40">
            <div className="text-[11px] uppercase tracking-widest mb-1.5" style={{ fontWeight: 600, color: '#92400E', letterSpacing: '0.06em' }}>Will be replaced</div>
            <ul className="text-[12px]" style={{ color: '#78350F', lineHeight: 1.55, paddingLeft: 16, margin: 0, listStyle: 'disc' }}>
              <li>Primary point of contact and recipient list</li>
              <li>Default sales rep</li>
              <li>Billing and shipping addresses</li>
              <li>Payment terms and payment method</li>
              <li>Pricing rules tied to the current customer</li>
            </ul>
          </div>
        </ConfirmDiscardModal>
      )}

      {/* Primary-POC override confirmation. Fires when the user picks
          a different contact for the SAME customer from the search
          overlay. Same chrome as the customer-change confirmation so
          the two prompts feel consistent. */}
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
            /* Same policy as the picker onSelect above: primary swaps
               are NOT material changes and must never fire the version
               prompt. This handler intentionally does not call
               onMaterialChange. */
            const next = pendingPocOverride;
            setContactName(next.name);
            setPocs((prev) => {
              const newPrimary = {
                id: next.id,
                initials: next.initials,
                name: next.name,
                title: next.title,
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
              <div className="text-[10px] uppercase tracking-widest mb-1" style={{ fontWeight: 600, color: 'var(--muted-foreground)', opacity: 0.7 }}>From</div>
              <div className="text-[12px] truncate" style={{ fontWeight: 600, color: 'var(--muted-foreground)', textDecoration: 'line-through' }}>{primaryContact?.name || contactName}</div>
              <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>Current primary</div>
            </div>
            <div className="flex items-center shrink-0">
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 px-3 py-2.5 rounded-lg border bg-[#FFFBEB] min-w-0" style={{ borderColor: '#FDE68A' }}>
              <div className="text-[10px] uppercase tracking-widest mb-1" style={{ fontWeight: 600, color: '#B45309', opacity: 0.85 }}>To</div>
              <div className="text-[12px] truncate" style={{ fontWeight: 600, color: '#92400E' }}>{pendingPocOverride.name}</div>
              <div className="text-[10px] mt-0.5 truncate" style={{ color: '#B45309', fontWeight: 500 }}>{pendingPocOverride.title || 'Contact'}</div>
            </div>
          </div>
        </ConfirmDiscardModal>
      )}

      {/* Overlay: brief checklist animation that walks through what's
          being hydrated, then commits the new defaults on `onDone`. */}
      {customerSwitchInFlight && (
        <CustomerSwitchOverlay
          fromCustomer={customerSwitchInFlight.from}
          toCustomer={customerSwitchInFlight.to}
          onDone={() => {
            /* Snapshot every piece of state the switch is about to
               overwrite. A customer change cascades through name,
               contact, recipients, billing / shipping addresses,
               payment terms / method, and the primary sales rep — a
               discarded version prompt has to put each one back. */
            const snap = {
              customerName,
              contactName,
              pocs,
              primaryPocId,
              billingAddress,
              shippingAddress,
              paymentTerms,
              paymentMethod,
              selectedSalesReps,
            };
            const defaults = getCustomerDefaults(customerSwitchInFlight.to);
            setCustomerName(customerSwitchInFlight.to);
            /* Customer switch seeds the quote with only the new
               customer's flagged primary as the SOLE recipient — the
               rest of that customer's POCs stay available behind the
               picker so the user opts them in intentionally. Matches
               the creation flow and avoids carrying over the prior
               customer's attached roster size. A sparse customer
               (name only, see customerDefaults) has no primary, so
               every field below lands empty and renders its empty
               state instead of crashing. */
            const nextPrimary = defaults.primaryPoC;
            setContactName(nextPrimary?.name ?? '');
            setPocs(nextPrimary ? [{
              id: nextPrimary.id,
              initials: nextPrimary.initials,
              name: nextPrimary.name,
              title: nextPrimary.role,
            }] : []);
            setPrimaryPocId(nextPrimary?.id ?? '');
            setBillingAddress(defaults.billingAddress);
            setShippingAddress(defaults.shippingAddress);
            setPaymentTerms(defaults.paymentTerms);
            setPaymentMethod(defaults.paymentMethod);
            setSelectedSalesReps(defaults.salesRep ? [
              { id: defaults.salesRep.id, name: defaults.salesRep.name, initials: defaults.salesRep.initials, isPrimary: true, isCurrentUser: false, isCustomerDefault: true },
            ] : []);
            const prev = customerSwitchInFlight.from;
            const next = customerSwitchInFlight.to;
            toast.success(
              `Customer changed to ${next}. Defaults pulled from partner record.`,
              { position: 'top-right', duration: 5000 },
            );
            onMaterialChange?.(
              'customer',
              'Customer / Partner',
              prev,
              next,
              () => {
                setCustomerName(snap.customerName);
                setContactName(snap.contactName);
                setPocs(snap.pocs);
                setPrimaryPocId(snap.primaryPocId);
                setBillingAddress(snap.billingAddress);
                setShippingAddress(snap.shippingAddress);
                setPaymentTerms(snap.paymentTerms);
                setPaymentMethod(snap.paymentMethod);
                setSelectedSalesReps(snap.selectedSalesReps);
              },
            );
            setCustomerSwitchInFlight(null);
          }}
        />
      )}
    </div>
  );
}
