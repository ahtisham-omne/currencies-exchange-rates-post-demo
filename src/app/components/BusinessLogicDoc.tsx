import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  GitBranch,
  ShieldCheck,
  Database,
  Workflow,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  FileText,
  Send,
  PackageCheck,
  Package,
  Lock,
  Check,
  ShoppingCart,
  Zap,
  ClipboardList,
  ArrowRight,
  CircleDot,
  LinkIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { FONT } from "./designTokens";
import { PX, PAGE_HEADER_FLEX } from "../../config/responsive-guidelines";

/* ═══════════════════════════════════════════════════════════════
   TYPOGRAPHY — CSS variable-bound, Inter only
   ═══════════════════════════════════════════════════════════════ */

const s = {
  pageTitle: {
    fontSize: "var(--text-h3)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  pageSubtitle: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.55",
    fontFamily: FONT,
  } as React.CSSProperties,
  sectionNumber: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1",
    fontFamily: FONT,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: "var(--text-h4)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,
  sectionDesc: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.6",
    fontFamily: FONT,
  } as React.CSSProperties,
  subsectionTitle: {
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.45",
    fontFamily: FONT,
  } as React.CSSProperties,
  bodyText: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.7",
    fontFamily: FONT,
  } as React.CSSProperties,
  bodyBold: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.7",
    fontFamily: FONT,
  } as React.CSSProperties,
  tableHeader: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,
  tableCell: {
    fontSize: "13px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.55",
    fontFamily: FONT,
  } as React.CSSProperties,
  tableCellBold: {
    fontSize: "13px",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.55",
    fontFamily: FONT,
  } as React.CSSProperties,
  codeMono: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.5",
    fontFamily: FONT,
  } as React.CSSProperties,
  stepLabel: {
    fontSize: "13px",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,
  stepDesc: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.6",
    fontFamily: FONT,
  } as React.CSSProperties,
  tocLink: {
    fontSize: "13px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.5",
    fontFamily: FONT,
  } as React.CSSProperties,
  badge: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1",
    fontFamily: FONT,
  } as React.CSSProperties,
  label: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.45",
    fontFamily: FONT,
  } as React.CSSProperties,
  tiny: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.45",
    fontFamily: FONT,
  } as React.CSSProperties,
};

/* ═══════════════════════════════════════════════════════════════
   REUSABLE COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function SectionCard({
  id,
  number,
  icon: Icon,
  title,
  description,
  children,
  accentColor = "primary",
}: {
  id: string;
  number: string;
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  accentColor?: "primary" | "accent" | "chart-3" | "chart-4" | "destructive";
}) {
  const colorMap = {
    primary: { bg: "bg-primary/8", text: "text-primary", badge: "bg-primary text-primary-foreground" },
    accent: { bg: "bg-accent/10", text: "text-accent", badge: "bg-accent text-accent-foreground" },
    "chart-3": { bg: "bg-[color:var(--chart-3)]/10", text: "text-[color:var(--chart-3)]", badge: "bg-[color:var(--chart-3)] text-card" },
    "chart-4": { bg: "bg-[color:var(--chart-4)]/10", text: "text-[color:var(--chart-4)]", badge: "bg-[color:var(--chart-4)] text-card" },
    destructive: { bg: "bg-destructive/8", text: "text-destructive", badge: "bg-destructive text-destructive-foreground" },
  };
  const colors = colorMap[accentColor];

  return (
    <section id={id} className="rounded-[var(--radius-lg)] border border-border bg-card overflow-hidden scroll-mt-24">
      <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-border">
        <div className={`flex items-center justify-center size-9 rounded-[var(--radius-md)] ${colors.bg} shrink-0 mt-0.5`}>
          <Icon className={`size-4 ${colors.text}`} />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-[var(--radius-sm)] ${colors.badge}`} style={s.sectionNumber}>
              {number}
            </span>
            <span className="text-foreground" style={s.sectionTitle}>{title}</span>
          </div>
          <p className="text-muted-foreground" style={s.sectionDesc}>{description}</p>
        </div>
      </div>
      <div className="px-5 py-5 flex flex-col gap-6">
        {children}
      </div>
    </section>
  );
}

function FlowStep({
  step,
  title,
  description,
  details,
  isLast = false,
  icon: Icon,
  color = "primary",
}: {
  step: number;
  title: string;
  description: string;
  details?: string[];
  isLast?: boolean;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="flex gap-4">
      {/* Vertical connector line + circle */}
      <div className="flex flex-col items-center shrink-0">
        <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 border-2 border-primary shrink-0">
          <Icon className="size-3.5 text-primary" />
        </div>
        {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
      </div>
      {/* Content */}
      <div className={`flex flex-col gap-1.5 ${isLast ? "pb-0" : "pb-6"}`}>
        <div className="flex items-center gap-2">
          <span className="text-primary" style={s.badge}>STEP {step}</span>
          <span className="text-foreground" style={s.stepLabel}>{title}</span>
        </div>
        <p className="text-muted-foreground" style={s.stepDesc}>{description}</p>
        {details && details.length > 0 && (
          <ul className="flex flex-col gap-1 mt-1 ml-1">
            {details.map((d, i) => (
              <li key={i} className="flex items-start gap-2">
                <ChevronRight className="size-3 text-primary/40 shrink-0 mt-0.5" />
                <span className="text-foreground/70" style={s.stepDesc}>{d}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConditionRow({
  condition,
  action,
  severity = "info",
}: {
  condition: string;
  action: string;
  severity?: "critical" | "warning" | "info";
}) {
  const severityMap = {
    critical: { bg: "bg-destructive/8", text: "text-destructive", icon: AlertTriangle },
    warning: { bg: "bg-[color:var(--chart-3)]/10", text: "text-[color:var(--chart-3)]", icon: AlertTriangle },
    info: { bg: "bg-primary/8", text: "text-primary", icon: Info },
  };
  const sv = severityMap[severity];
  const SvIcon = sv.icon;

  return (
    <div className="flex items-start gap-3 p-3 rounded-[var(--radius-md)] bg-secondary/60">
      <div className={`flex items-center justify-center size-6 rounded-full ${sv.bg} shrink-0 mt-0.5`}>
        <SvIcon className={`size-3 ${sv.text}`} />
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <span className="text-foreground" style={s.tableCellBold}>IF: {condition}</span>
        <span className="text-muted-foreground" style={s.tableCell}>THEN: {action}</span>
      </div>
    </div>
  );
}

function StatusTransitionArrow({ from, to, trigger, guard }: { from: string; to: string; trigger: string; guard?: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] border border-border bg-card">
      <span className="px-2.5 py-1 rounded-[var(--radius-sm)] bg-secondary text-foreground/70 shrink-0" style={s.tableCellBold}>{from}</span>
      <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
        <ArrowRight className="size-4 text-primary" />
        <span className="text-primary truncate" style={s.tiny}>{trigger}</span>
        {guard && <span className="text-muted-foreground truncate" style={{ ...s.tiny, fontSize: "10px" }}>[{guard}]</span>}
      </div>
      <span className="px-2.5 py-1 rounded-[var(--radius-sm)] bg-primary/10 text-primary shrink-0" style={s.tableCellBold}>{to}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TABLE OF CONTENTS — Sidebar navigation
   ═══════════════════════════════════════════════════════════════ */

const TOC_ITEMS = [
  { id: "process-flow", label: "1. Process Flow", icon: Workflow },
  { id: "conditional-logic", label: "2. Conditional Logic", icon: GitBranch },
  { id: "field-validation", label: "3. Field Validation", icon: ShieldCheck },
  { id: "state-transitions", label: "4. State Transitions", icon: CircleDot },
  { id: "data-relationships", label: "5. Data Relationships", icon: Database },
];

function TableOfContents({ activeSection }: { activeSection: string }) {
  return (
    <nav className="flex flex-col gap-1">
      <span className="text-muted-foreground mb-2 px-3" style={{ ...s.badge, letterSpacing: "0.05em" }}>CONTENTS</span>
      {TOC_ITEMS.map((item) => {
        const isActive = activeSection === item.id;
        const TocIcon = item.icon;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-md)] transition-colors ${
              isActive
                ? "bg-primary/8 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
            style={s.tocLink}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <TocIcon className="size-3.5 shrink-0" />
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN DOCUMENTATION PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function BusinessLogicDoc() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("process-flow");

  // Track scroll position for TOC highlighting
  React.useEffect(() => {
    const handleScroll = () => {
      const sections = TOC_ITEMS.map((t) => document.getElementById(t.id));
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = sections[i];
        if (el && el.getBoundingClientRect().top <= 120) {
          setActiveSection(TOC_ITEMS[i].id);
          break;
        }
      }
    };
    const scrollContainer = document.getElementById("doc-scroll");
    scrollContainer?.addEventListener("scroll", handleScroll);
    return () => scrollContainer?.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-secondary overflow-hidden" style={{ fontFamily: FONT }}>
      {/* ── Header ── */}
      <div className="shrink-0 bg-card z-10 border-b border-border">
        <div className={`${PX} py-4`}>
          <div className={PAGE_HEADER_FLEX}>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5 shrink-0"
                style={s.label}
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="size-3.5" /> Back
              </Button>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-foreground" style={s.pageTitle}>Business Logic Documentation</span>
                  <span
                    className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-accent/10 text-accent"
                    style={s.badge}
                  >
                    v1.0
                  </span>
                </div>
                <p className="text-muted-foreground" style={s.pageSubtitle}>
                  Purchase Order Module  ---  Omne ERP  ---  Extracted from design specifications
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-muted-foreground" style={s.tiny}>Last updated: Feb 25, 2026</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content with sidebar TOC ── */}
      <div id="doc-scroll" className="flex-1 overflow-y-auto">
        <div className={`${PX} py-4 lg:py-8`}>
          <div className="max-w-[1440px] 2xl:max-w-[1800px] 3xl:max-w-full mx-auto flex gap-8 items-start">
            {/* Sticky TOC Sidebar — hidden on mobile */}
            <aside className="hidden lg:block w-[220px] shrink-0 sticky top-0 pt-1">
              <div className="rounded-[var(--radius-lg)] border border-border bg-card p-3">
                <TableOfContents activeSection={activeSection} />
              </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col gap-6 min-w-0">

              {/* ═══════════ SECTION 1: PROCESS FLOW ═══════════ */}
              <SectionCard
                id="process-flow"
                number="01"
                icon={Workflow}
                title="Process Flow"
                description="Step-by-step logic map of the complete user journey from Purchase Order creation through to completion and closure."
                accentColor="primary"
              >
                {/* 1A: Entry Points */}
                <div className="flex flex-col gap-3">
                  <span className="text-foreground" style={s.subsectionTitle}>1A. PO Entry Points</span>
                  <p className="text-muted-foreground" style={s.bodyText}>
                    The system provides three distinct entry points for creating a new Purchase Order, each optimized for different procurement scenarios.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      {
                        icon: ShoppingCart,
                        title: "Cart Checkout (Multi-Item)",
                        desc: "User browses Item Catalog, adds multiple items to cart via the OrderFlow dialog, configures quantities/shipping per item, then checks out per vendor. System groups items by vendor and creates one PO per vendor.",
                        route: "/purchase-orders/new",
                      },
                      {
                        icon: Zap,
                        title: "Buy Now (Single-Item Express)",
                        desc: "User selects a single item, completes the OrderFlow dialog in 'buy-now' mode including vendor contact selection and notes, then immediately creates a Draft PO and navigates to the detail page.",
                        route: "/purchase-orders/new",
                      },
                      {
                        icon: ClipboardList,
                        title: "From Search Modal / Homepage",
                        desc: "User launches the global Purchase Search modal, finds an item, and is routed to /purchase-orders/new with navigation state pre-populated (vendor filter or item ID + optional order details).",
                        route: "/purchase-orders/new",
                      },
                    ].map((ep) => (
                      <div key={ep.title} className="flex flex-col gap-2 p-4 rounded-[var(--radius-md)] border border-border bg-secondary/40">
                        <div className="flex items-center gap-2">
                          <ep.icon className="size-4 text-primary" />
                          <span className="text-foreground" style={s.stepLabel}>{ep.title}</span>
                        </div>
                        <p className="text-muted-foreground" style={s.stepDesc}>{ep.desc}</p>
                        <span className="text-primary/60" style={s.tiny}>Route: {ep.route}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* 1B: Full Lifecycle */}
                <div className="flex flex-col gap-4">
                  <span className="text-foreground" style={s.subsectionTitle}>1B. Full Lifecycle Journey</span>
                  <FlowStep
                    step={1}
                    icon={FileText}
                    title="PO Created (Draft)"
                    description="System generates a new PO with auto-incremented number (format: 395-XXXX), status set to 'Draft'. All line items inherit receivedQuantity = 0. Order date is set to current date."
                    details={[
                      "PO number auto-incremented from internal counter (e.g., 395-9901, 395-9902)",
                      "Vendor details auto-populated from VENDOR_DETAILS lookup by vendor name",
                      "Payment terms auto-populated from PAYMENT_DEFAULTS (vendor-specific: Net 15/30/45)",
                      "Shipping destination derived from first line item's inbound location",
                      "Shipping fee calculated as lineItems.length x $12.50",
                      "createdBy defaults to current user ('Areeb Tanvir')",
                    ]}
                  />
                  <FlowStep
                    step={2}
                    icon={FileText}
                    title="Draft Editing"
                    description="User can modify line items (quantities, pricing, dates), add/remove items, update vendor contact, and edit payment & delivery details. All mutations are Draft-only gated."
                    details={[
                      "Line item edits trigger automatic recalculation: subtotal, discountTotal, shippingFee, total",
                      "Add Item: prevented if duplicate itemNumber already exists on PO",
                      "Remove Item: removes line + recalculates totals",
                      "Recipient and Payment updates are gated: only allowed when status === 'Draft'",
                      "Attachment upload is available (images + documents)",
                    ]}
                  />
                  <FlowStep
                    step={3}
                    icon={Check}
                    title="Confirm Purchase Order"
                    description="User clicks 'Confirm Purchase Order' button. Status transitions to 'Confirmed'. confirmationDate is recorded as today's date."
                    details={[
                      "Button visible ONLY when status === 'Draft'",
                      "Confirmation date is set once (not overwritten on subsequent operations)",
                    ]}
                  />
                  <FlowStep
                    step={4}
                    icon={Send}
                    title="Send to Vendor"
                    description="User clicks 'Send to Vendor'. The sendPO() function gates on status === 'Confirmed' before transitioning to 'Sent'. sentDate is recorded."
                    details={[
                      "Button visible ONLY when status === 'Confirmed'",
                      "Guard: sendPO() returns early if status is not 'Confirmed'",
                      "sentDate is set once and persisted",
                    ]}
                  />
                  <FlowStep
                    step={5}
                    icon={PackageCheck}
                    title="Record Receiving"
                    description="User opens the Receiving Dialog and records quantities received per line item, along with condition (good/damaged/rejected) and notes. System auto-determines the resulting status."
                    details={[
                      "Button visible when status === 'Sent' OR 'Partially Received'",
                      "Per line item: quantity received (0 to ordered), condition assessment, notes",
                      "Records with quantityReceived <= 0 are skipped (not saved)",
                      "receivingStartDate is set on first-ever receiving event for this PO",
                      "Status auto-transitions: if all items fully received -> 'Fully Received'; if any received but not all -> 'Partially Received'",
                    ]}
                  />
                  <FlowStep
                    step={6}
                    icon={Package}
                    title="Fully Received"
                    description="When all line items have receivedQuantity >= ordered quantity, the system automatically sets the PO status to 'Fully Received'. The user can then proceed to close the order."
                    details={[
                      "Condition: po.lineItems.every(li => li.receivedQuantity >= li.quantity)",
                      "Close button becomes visible: 'Close Purchase Order'",
                    ]}
                  />
                  <FlowStep
                    step={7}
                    icon={Lock}
                    title="Close Purchase Order"
                    description="User clicks 'Close Purchase Order'. Status transitions to 'Closed'. closedDate is recorded. The PO becomes read-only — no further modifications are possible."
                    details={[
                      "Button visible ONLY when status === 'Fully Received'",
                      "closedDate set once, marks the terminal state",
                      "In the lifecycle tracker, 'Closed' shows all steps as completed",
                      "Header shows a locked badge with 'Closed' label",
                    ]}
                    isLast
                  />
                </div>
              </SectionCard>

              {/* ═══════════ SECTION 2: CONDITIONAL LOGIC ═══════════ */}
              <SectionCard
                id="conditional-logic"
                number="02"
                icon={GitBranch}
                title="Conditional Logic"
                description="All If/Then decision scenarios identified across the Purchase Order module, derived from the action buttons, guards, and UI visibility rules in the design."
                accentColor="chart-4"
              >
                {/* Status-Based Action Visibility */}
                <div className="flex flex-col gap-3">
                  <span className="text-foreground" style={s.subsectionTitle}>2A. Status-Based Action Visibility</span>
                  <p className="text-muted-foreground" style={s.bodyText}>
                    The header action buttons are conditionally rendered based on the current PO status. Only one primary action is visible at any given lifecycle stage.
                  </p>
                  <div className="flex flex-col gap-2.5">
                    <ConditionRow
                      condition="PO.status === 'Draft'"
                      action="Show 'Confirm Purchase Order' button. Enable line item editing, add/remove items, recipient edits, payment edits, attachment upload."
                      severity="info"
                    />
                    <ConditionRow
                      condition="PO.status === 'Confirmed'"
                      action="Show 'Send to Vendor' button (blue sky-600 accent). Disable all Draft-only edit operations."
                      severity="info"
                    />
                    <ConditionRow
                      condition="PO.status === 'Sent'"
                      action="Show 'Record Receiving' button. Initialize receiving dialog with all line items, zero quantities, 'good' conditions, empty notes."
                      severity="info"
                    />
                    <ConditionRow
                      condition="PO.status === 'Partially Received'"
                      action="Show 'Record More Receiving' button. Same receiving flow as 'Sent', but with accumulated quantities already tracked."
                      severity="warning"
                    />
                    <ConditionRow
                      condition="PO.status === 'Fully Received'"
                      action="Show 'Close Purchase Order' button (neutral-700 accent). No receiving actions available."
                      severity="info"
                    />
                    <ConditionRow
                      condition="PO.status === 'Closed'"
                      action="Show a static 'Closed' badge with lock icon. No action buttons available. PO is fully read-only."
                      severity="info"
                    />
                  </div>
                </div>

                <Separator />

                {/* Vendor Assignment Logic */}
                <div className="flex flex-col gap-3">
                  <span className="text-foreground" style={s.subsectionTitle}>2B. Vendor Assignment Logic</span>
                  <div className="flex flex-col gap-2.5">
                    <ConditionRow
                      condition="Item has no partnerLocation (unassigned vendor)"
                      action="Block Add-to-Cart and Buy-Now. Open the Assign Vendor modal instead. User must select a vendor before proceeding."
                      severity="critical"
                    />
                    <ConditionRow
                      condition="Item has a partnerLocation assigned"
                      action="Allow direct Add-to-Cart or Buy-Now flow. Open the OrderFlow dialog with the item's vendor pre-populated."
                      severity="info"
                    />
                    <ConditionRow
                      condition="Item unitPrice === 0 (unassigned vendor items)"
                      action="Display '$0.00' price with visual indicator. Vendor must be assigned before pricing becomes valid."
                      severity="warning"
                    />
                  </div>
                </div>

                <Separator />

                {/* Receiving Logic */}
                <div className="flex flex-col gap-3">
                  <span className="text-foreground" style={s.subsectionTitle}>2C. Receiving & Inventory Auto-Transitions</span>
                  <div className="flex flex-col gap-2.5">
                    <ConditionRow
                      condition="All line items: receivedQuantity >= ordered quantity"
                      action="Auto-set status to 'Fully Received'. This is computed after each receiving record is processed."
                      severity="info"
                    />
                    <ConditionRow
                      condition="Any line item has receivedQuantity > 0 BUT not all fully received"
                      action="Auto-set status to 'Partially Received'. Receiving can continue with 'Record More Receiving' button."
                      severity="warning"
                    />
                    <ConditionRow
                      condition="Receiving record has quantityReceived <= 0"
                      action="Skip this record entirely (not saved to receivingRecords array). Only positive quantities are persisted."
                      severity="info"
                    />
                    <ConditionRow
                      condition="First receiving event on this PO (receivingStartDate is null)"
                      action="Set receivingStartDate to today's date. This timestamp is set once and never overwritten."
                      severity="info"
                    />
                  </div>
                </div>

                <Separator />

                {/* Cart Logic */}
                <div className="flex flex-col gap-3">
                  <span className="text-foreground" style={s.subsectionTitle}>2D. Cart & Checkout Logic</span>
                  <div className="flex flex-col gap-2.5">
                    <ConditionRow
                      condition="Cart checkout triggered for a specific vendor"
                      action="Filter cart items by vendor, create a single PO via createPOFromVendorCheckout(), remove those items from cart, navigate to PO detail page."
                      severity="info"
                    />
                    <ConditionRow
                      condition="Adding item already in cart (same catalogItem.id)"
                      action="Replace the existing cart entry with updated quantities/shipping instead of creating a duplicate."
                      severity="info"
                    />
                    <ConditionRow
                      condition="Adding line item to PO where itemNumber already exists"
                      action="Block the addition (addLineItemToPO returns early). Prevents duplicate line items on the same PO."
                      severity="warning"
                    />
                    <ConditionRow
                      condition="Item has shortageDate set"
                      action="Default ship-by date is set to today + 3 days (expedited), due delivery to today + 10 days. Without shortage: today + 7 and + 14 respectively."
                      severity="critical"
                    />
                  </div>
                </div>

                <Separator />

                {/* PO Warnings */}
                <div className="flex flex-col gap-3">
                  <span className="text-foreground" style={s.subsectionTitle}>2E. PO Warnings & Alerts</span>
                  <div className="flex flex-col gap-2.5">
                    <ConditionRow
                      condition="Item.currentStock < Item.minQuantity"
                      action="Show CRITICAL warning: 'Below Minimum Stock Level'. Recommends immediate reorder."
                      severity="critical"
                    />
                    <ConditionRow
                      condition="Item.currentStock === 0"
                      action="Show CRITICAL warning: 'Zero Stock - Out of Inventory'. Flags potential production delays."
                      severity="critical"
                    />
                    <ConditionRow
                      condition="Item has an active shortageDate"
                      action="Show CRITICAL warning: 'Upcoming Shortage' with projected stock-out date, current stock, and minimum required levels."
                      severity="critical"
                    />
                    <ConditionRow
                      condition="Item has a vendor discount > 0%"
                      action="Show INFO notice: 'Active Volume Discount'. Suggests bulk ordering to maximize savings."
                      severity="info"
                    />
                  </div>
                </div>
              </SectionCard>

              {/* ═══════════ SECTION 3: FIELD VALIDATION ═══════════ */}
              <SectionCard
                id="field-validation"
                number="03"
                icon={ShieldCheck}
                title="Field Validation & Data Constraints"
                description="Required fields and data constraints derived from the OrderFlow dialog, PO creation functions, and line item data model."
                accentColor="accent"
              >
                {/* OrderFlow Required Fields */}
                <div className="flex flex-col gap-3">
                  <span className="text-foreground" style={s.subsectionTitle}>3A. OrderFlow Dialog — Required Fields</span>
                  <p className="text-muted-foreground" style={s.bodyText}>
                    The submit button (Add to Cart / Create PO) is disabled until all required fields pass validation. The guard condition is:
                  </p>
                  <div className="p-3 rounded-[var(--radius-md)] bg-secondary border border-border">
                    <code className="text-primary" style={s.codeMono}>
                      canSubmit = vendorQty &gt; 0 && shipByDate && shipmentMethod && dueDeliveryDate && inboundLocation
                    </code>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2.5 px-3 text-muted-foreground" style={s.tableHeader}>Field</th>
                          <th className="text-left py-2.5 px-3 text-muted-foreground" style={s.tableHeader}>Required</th>
                          <th className="text-left py-2.5 px-3 text-muted-foreground" style={s.tableHeader}>Type</th>
                          <th className="text-left py-2.5 px-3 text-muted-foreground" style={s.tableHeader}>Constraints</th>
                          <th className="text-left py-2.5 px-3 text-muted-foreground" style={s.tableHeader}>Default Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { field: "Vendor Qty", req: "Yes", type: "Integer", constraint: "Must be > 0. Minimum 1.", default: "1" },
                          { field: "Default Qty", req: "Computed", type: "Integer", constraint: "vendorQty x vendorUOMQty. Auto-calculated, not user-editable directly.", default: "1 x vendorUOMQty" },
                          { field: "Ship By Date", req: "Yes", type: "Date (YYYY-MM-DD)", constraint: "ISO date string. Must be a valid future date.", default: "Today + 7 days (or +3 if shortage)" },
                          { field: "Shipment Method", req: "Yes", type: "Enum", constraint: "One of: fedex-ground, fedex-express, fedex-freight, air-standard, air-express", default: "Vendor-specific default from VENDOR_DEFAULT_SHIPMENT" },
                          { field: "Due Delivery Date", req: "Yes", type: "Date (YYYY-MM-DD)", constraint: "ISO date string. Should be after Ship By Date.", default: "Today + 14 days (or +10 if shortage)" },
                          { field: "Inbound Location", req: "Yes", type: "Enum", constraint: "One of 6 warehouse locations (Warehouse A-F)", default: "Auto-mapped from item's location field" },
                          { field: "Vendor Contact", req: "Yes", type: "Selection", constraint: "Selected from vendor-specific contact directory", default: "First contact in vendor's POC list" },
                          { field: "Notes", req: "No", type: "Free text", constraint: "Optional. Persisted on PO as notes field.", default: "Empty string" },
                        ].map((row) => (
                          <tr key={row.field} className="border-b border-border/50">
                            <td className="py-2.5 px-3 text-foreground" style={s.tableCellBold}>{row.field}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-[var(--radius-sm)] ${
                                  row.req === "Yes" ? "bg-primary/10 text-primary" : row.req === "Computed" ? "bg-accent/10 text-accent" : "bg-secondary text-muted-foreground"
                                }`}
                                style={s.badge}
                              >{row.req}</span>
                            </td>
                            <td className="py-2.5 px-3 text-foreground/70" style={s.tableCell}>{row.type}</td>
                            <td className="py-2.5 px-3 text-foreground/70" style={s.tableCell}>{row.constraint}</td>
                            <td className="py-2.5 px-3 text-muted-foreground" style={s.tableCell}>{row.default}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <Separator />

                {/* PO Data Model Constraints */}
                <div className="flex flex-col gap-3">
                  <span className="text-foreground" style={s.subsectionTitle}>3B. PO Record — Data Constraints</span>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2.5 px-3 text-muted-foreground" style={s.tableHeader}>Field</th>
                          <th className="text-left py-2.5 px-3 text-muted-foreground" style={s.tableHeader}>Format</th>
                          <th className="text-left py-2.5 px-3 text-muted-foreground" style={s.tableHeader}>Constraint / Rule</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { field: "PO Number", format: "395-XXXX", rule: "Auto-generated. Prefix '395-' + (9900 + counter). Sequential, non-editable." },
                          { field: "Status", format: "Enum", rule: "One of: Draft | Confirmed | Sent | Partially Received | Fully Received | Closed. Forward-only transitions." },
                          { field: "Order Date", format: "YYYY-MM-DD", rule: "Set to current date at creation time. Non-editable." },
                          { field: "Delivery Date", format: "YYYY-MM-DD", rule: "Derived from first line item's dueDeliveryDate or defaults to today + 14 days." },
                          { field: "Subtotal", format: "USD (2 decimals)", rule: "SUM(unitPrice x quantity) for all line items. Auto-recalculated on any line change." },
                          { field: "Discount Total", format: "USD (2 decimals)", rule: "SUM(unitPrice x quantity x discount/100) for all line items." },
                          { field: "Shipping Fee", format: "USD (2 decimals)", rule: "lineItems.length x $12.50, rounded to 2 decimal places." },
                          { field: "Total", format: "USD (2 decimals)", rule: "subtotal - discountTotal + shippingFee. Auto-recalculated." },
                          { field: "Line Total (per item)", format: "USD (2 decimals)", rule: "unitPrice x quantity x (1 - discount/100)." },
                          { field: "Credit Limit", format: "USD", rule: "Hard-coded at $125,000. Credit utilization % = (total / creditLimit) x 100, capped at 100%." },
                          { field: "Dates (confirmation, sent, receiving, closed)", format: "YYYY-MM-DD | null", rule: "Set once on first occurrence of the corresponding status transition. Never overwritten." },
                        ].map((row) => (
                          <tr key={row.field} className="border-b border-border/50">
                            <td className="py-2.5 px-3 text-foreground" style={s.tableCellBold}>{row.field}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-secondary text-foreground/60" style={s.badge}>{row.format}</span>
                            </td>
                            <td className="py-2.5 px-3 text-foreground/70" style={s.tableCell}>{row.rule}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <Separator />

                {/* Receiving Record Constraints */}
                <div className="flex flex-col gap-3">
                  <span className="text-foreground" style={s.subsectionTitle}>3C. Receiving Record — Constraints</span>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2.5 px-3 text-muted-foreground" style={s.tableHeader}>Field</th>
                          <th className="text-left py-2.5 px-3 text-muted-foreground" style={s.tableHeader}>Type</th>
                          <th className="text-left py-2.5 px-3 text-muted-foreground" style={s.tableHeader}>Constraint</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { field: "Quantity Received", type: "Integer", rule: "Must be > 0 to be saved. Validated per-line-item. Accumulates across multiple receiving events." },
                          { field: "Condition", type: "Enum", rule: "'good' | 'damaged' | 'rejected'. Default: 'good'. Each line item gets its own assessment." },
                          { field: "Notes", type: "Free text", rule: "Optional. Per-line-item receiving notes." },
                          { field: "Received Date", type: "YYYY-MM-DD", rule: "Auto-set to current date. Non-editable." },
                          { field: "Received By", type: "String", rule: "Auto-set to current user. Non-editable." },
                          { field: "Record ID", type: "String", rule: "Auto-generated: 'rcv-{poId}-{counter}'. Sequential per PO." },
                        ].map((row) => (
                          <tr key={row.field} className="border-b border-border/50">
                            <td className="py-2.5 px-3 text-foreground" style={s.tableCellBold}>{row.field}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-secondary text-foreground/60" style={s.badge}>{row.type}</span>
                            </td>
                            <td className="py-2.5 px-3 text-foreground/70" style={s.tableCell}>{row.rule}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </SectionCard>

              {/* ═══════════ SECTION 4: STATE TRANSITIONS ═══════════ */}
              <SectionCard
                id="state-transitions"
                number="04"
                icon={CircleDot}
                title="State Transitions"
                description="How the PO 'Status' field changes based on user actions (buttons) and system-computed conditions. The lifecycle is strictly forward-only with no backward transitions."
                accentColor="chart-3"
              >
                {/* State Machine Diagram */}
                <div className="flex flex-col gap-3">
                  <span className="text-foreground" style={s.subsectionTitle}>4A. State Machine — Transitions</span>
                  <p className="text-muted-foreground" style={s.bodyText}>
                    Each transition is triggered by a specific user action or system computation. Guard conditions prevent invalid transitions.
                  </p>
                  <div className="flex flex-col gap-2.5">
                    <StatusTransitionArrow
                      from="Draft"
                      to="Confirmed"
                      trigger="Click 'Confirm Purchase Order'"
                      guard="status === 'Draft'"
                    />
                    <StatusTransitionArrow
                      from="Confirmed"
                      to="Sent"
                      trigger="Click 'Send to Vendor'"
                      guard="status === 'Confirmed'"
                    />
                    <StatusTransitionArrow
                      from="Sent"
                      to="Partially Received"
                      trigger="recordReceiving() — some items received"
                      guard="anyReceived && !allFullyReceived"
                    />
                    <StatusTransitionArrow
                      from="Sent"
                      to="Fully Received"
                      trigger="recordReceiving() — all items received"
                      guard="allFullyReceived"
                    />
                    <StatusTransitionArrow
                      from="Partially Received"
                      to="Partially Received"
                      trigger="recordReceiving() — more items, not all"
                      guard="anyReceived && !allFullyReceived"
                    />
                    <StatusTransitionArrow
                      from="Partially Received"
                      to="Fully Received"
                      trigger="recordReceiving() — all remaining items"
                      guard="allFullyReceived"
                    />
                    <StatusTransitionArrow
                      from="Fully Received"
                      to="Closed"
                      trigger="Click 'Close Purchase Order'"
                      guard="status === 'Fully Received'"
                    />
                  </div>
                </div>

                <Separator />

                {/* Status Details */}
                <div className="flex flex-col gap-3">
                  <span className="text-foreground" style={s.subsectionTitle}>4B. Status Definitions & Visual Indicators</span>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2.5 px-3 text-muted-foreground" style={s.tableHeader}>Status</th>
                          <th className="text-left py-2.5 px-3 text-muted-foreground" style={s.tableHeader}>Badge Style</th>
                          <th className="text-left py-2.5 px-3 text-muted-foreground" style={s.tableHeader}>Allowed Actions</th>
                          <th className="text-left py-2.5 px-3 text-muted-foreground" style={s.tableHeader}>Date Recorded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { status: "Draft", cssVars: { backgroundColor: "var(--status-draft-bg)", color: "var(--status-draft-text)" } as React.CSSProperties, token: "--status-draft-*", actions: "Edit items, add/remove items, edit recipient, edit payment, upload attachments, confirm", date: "orderDate (creation)" },
                          { status: "Confirmed", cssVars: { backgroundColor: "var(--status-confirmed-bg)", color: "var(--status-confirmed-text)" } as React.CSSProperties, token: "--status-confirmed-*", actions: "Send to vendor", date: "confirmationDate" },
                          { status: "Sent", cssVars: { backgroundColor: "var(--status-sent-bg)", color: "var(--status-sent-text)" } as React.CSSProperties, token: "--status-sent-*", actions: "Record Receiving", date: "sentDate" },
                          { status: "Partially Received", cssVars: { backgroundColor: "var(--status-partial-bg)", color: "var(--status-partial-text)" } as React.CSSProperties, token: "--status-partial-*", actions: "Record More Receiving", date: "receivingStartDate" },
                          { status: "Fully Received", cssVars: { backgroundColor: "var(--status-received-bg)", color: "var(--status-received-text)" } as React.CSSProperties, token: "--status-received-*", actions: "Close Purchase Order", date: "(auto-computed)" },
                          { status: "Closed", cssVars: { backgroundColor: "var(--status-closed-bg)", color: "var(--status-closed-text)" } as React.CSSProperties, token: "--status-closed-*", actions: "None (read-only)", date: "closedDate" },
                        ].map((row) => (
                          <tr key={row.status} className="border-b border-border/50">
                            <td className="py-2.5 px-3">
                              <span className="inline-flex px-2.5 py-1 rounded-[var(--radius-sm)] border border-transparent" style={{ ...s.tableCellBold, ...row.cssVars }}>{row.status}</span>
                            </td>
                            <td className="py-2.5 px-3 text-foreground/50" style={s.tableCell}>{row.token}</td>
                            <td className="py-2.5 px-3 text-foreground/70" style={s.tableCell}>{row.actions}</td>
                            <td className="py-2.5 px-3 text-muted-foreground" style={s.tableCell}>{row.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <Separator />

                {/* Lifecycle Tracker */}
                <div className="flex flex-col gap-3">
                  <span className="text-foreground" style={s.subsectionTitle}>4C. Lifecycle Tracker (Stepper UI)</span>
                  <p className="text-muted-foreground" style={s.bodyText}>
                    The horizontal stepper at the top of the PO detail page shows 5 visual steps. The "Closed" state is not a step — when a PO is Closed, all 5 steps display as completed with green checkmarks.
                  </p>
                  <div className="flex flex-col gap-2 p-4 rounded-[var(--radius-md)] border border-border bg-secondary/40">
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { label: "Draft", icon: FileText },
                        { label: "Confirmed", icon: Check },
                        { label: "Sent", icon: Send },
                        { label: "Partially Received", icon: PackageCheck },
                        { label: "Fully Received", icon: Package },
                      ].map((step, i) => (
                        <div key={step.label} className="contents">
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center justify-center size-7 rounded-full bg-primary/10 border border-primary/30">
                              <step.icon className="size-3 text-primary" />
                            </div>
                            <span className="text-foreground" style={s.stepDesc}>{step.label}</span>
                          </div>
                          {i < 4 && <div className="w-6 h-px bg-border" />}
                        </div>
                      ))}
                    </div>
                    <p className="text-muted-foreground mt-2" style={s.tiny}>
                      Visual states: completed = green accent bg + checkmark icon; current = primary bg + ring shadow + "Current" label; future = secondary bg + dimmed icon.
                    </p>
                  </div>
                </div>
              </SectionCard>

              {/* ═══════════ SECTION 5: DATA RELATIONSHIPS ═══════════ */}
              <SectionCard
                id="data-relationships"
                number="05"
                icon={Database}
                title="Data Relationships"
                description="Entity relationships between Line Items, Vendors, Inventory (Catalog), Receiving Records, and PO records as inferred from the data model and UI interactions."
                accentColor="destructive"
              >
                {/* Entity Relationships */}
                <div className="flex flex-col gap-3">
                  <span className="text-foreground" style={s.subsectionTitle}>5A. Core Entity Relationships</span>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* PO -> Line Items */}
                    <div className="flex flex-col gap-2 p-4 rounded-[var(--radius-md)] border border-border bg-secondary/40">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="size-4 text-primary" />
                        <span className="text-foreground" style={s.stepLabel}>PurchaseOrder &rarr; LineItems</span>
                      </div>
                      <span className="text-primary" style={s.badge}>1 : N (One-to-Many)</span>
                      <p className="text-muted-foreground" style={s.stepDesc}>
                        Each PO contains an array of POLineItem records. Line items are embedded (not normalized). Adding/removing items recalculates PO totals. Duplicate prevention by itemNumber.
                      </p>
                    </div>
                    {/* PO -> Vendor */}
                    <div className="flex flex-col gap-2 p-4 rounded-[var(--radius-md)] border border-border bg-secondary/40">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="size-4 text-accent" />
                        <span className="text-foreground" style={s.stepLabel}>PurchaseOrder &rarr; Vendor</span>
                      </div>
                      <span className="text-accent" style={s.badge}>N : 1 (Many-to-One)</span>
                      <p className="text-muted-foreground" style={s.stepDesc}>
                        Each PO is associated with exactly one vendor (POVendor). Vendor data is denormalized onto the PO at creation time from VENDOR_DETAILS lookup. Multiple POs can reference the same vendor.
                      </p>
                    </div>
                    {/* PO -> Receiving Records */}
                    <div className="flex flex-col gap-2 p-4 rounded-[var(--radius-md)] border border-border bg-secondary/40">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="size-4 text-[color:var(--chart-3)]" />
                        <span className="text-foreground" style={s.stepLabel}>PurchaseOrder &rarr; ReceivingRecords</span>
                      </div>
                      <span className="text-[color:var(--chart-3)]" style={s.badge}>1 : N (One-to-Many)</span>
                      <p className="text-muted-foreground" style={s.stepDesc}>
                        Each PO tracks an array of ReceivingRecord entries. Each record links to a specific lineItemId. Multiple receiving events can target the same line item (incremental receiving).
                      </p>
                    </div>
                    {/* Line Item -> Receiving Records */}
                    <div className="flex flex-col gap-2 p-4 rounded-[var(--radius-md)] border border-border bg-secondary/40">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="size-4 text-[color:var(--chart-4)]" />
                        <span className="text-foreground" style={s.stepLabel}>LineItem &rarr; ReceivingRecords</span>
                      </div>
                      <span className="text-[color:var(--chart-4)]" style={s.badge}>1 : N (One-to-Many)</span>
                      <p className="text-muted-foreground" style={s.stepDesc}>
                        Each line item's receivedQuantity is the running sum of all receiving records targeting that lineItemId. The receiving check computes: received &gt;= ordered for each line item.
                      </p>
                    </div>
                    {/* Vendor -> Contacts */}
                    <div className="flex flex-col gap-2 p-4 rounded-[var(--radius-md)] border border-border bg-secondary/40">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="size-4 text-destructive" />
                        <span className="text-foreground" style={s.stepLabel}>Vendor &rarr; Contacts (POC Directory)</span>
                      </div>
                      <span className="text-destructive" style={s.badge}>1 : N (One-to-Many)</span>
                      <p className="text-muted-foreground" style={s.stepDesc}>
                        Each vendor has 1-2 registered contacts in VENDOR_CONTACTS. The PO stores one selected contact as PORecipient. Contacts include name, role, email, and phone. Default fallback contact is provided for unknown vendors.
                      </p>
                    </div>
                    {/* Catalog Item -> Vendor Offers */}
                    <div className="flex flex-col gap-2 p-4 rounded-[var(--radius-md)] border border-border bg-secondary/40">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="size-4 text-primary" />
                        <span className="text-foreground" style={s.stepLabel}>CatalogItem &rarr; Vendor Offers</span>
                      </div>
                      <span className="text-primary" style={s.badge}>1 : N (One-to-Many)</span>
                      <p className="text-muted-foreground" style={s.stepDesc}>
                        Each catalog item can have multiple vendor offers (ItemVendorOffer) via getVendorOffersForItem(). Users can switch vendors on a card, updating partnerLocation, unitPrice, and discount in-memory.
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Vendor Data Structure */}
                <div className="flex flex-col gap-3">
                  <span className="text-foreground" style={s.subsectionTitle}>5B. Vendor Entity Model</span>
                  <p className="text-muted-foreground" style={s.bodyText}>
                    The system maintains three vendor entity collections for the PO sidebar's payment & delivery section:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { title: "Pay To Vendors", desc: "Financial entities for payment processing. Each has locations (HQ, branches), a primary contact with department info. Used in Payment & Delivery sidebar section.", count: "10 vendors" },
                      { title: "Shipped To Locations", desc: "Warehouse and distribution destinations. Each vendor entity has multiple location options with descriptions. Used to select delivery destination.", count: "10 vendors" },
                      { title: "Funded By Entities", desc: "Internal funding sources / cost centers. Typically the procurement organization. Used to track which budget or entity is funding the purchase.", count: "10 vendors" },
                    ].map((v) => (
                      <div key={v.title} className="flex flex-col gap-2 p-4 rounded-[var(--radius-md)] border border-border bg-secondary/40">
                        <span className="text-foreground" style={s.stepLabel}>{v.title}</span>
                        <p className="text-muted-foreground" style={s.stepDesc}>{v.desc}</p>
                        <span className="text-primary/60" style={s.tiny}>{v.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Inventory Integration */}
                <div className="flex flex-col gap-3">
                  <span className="text-foreground" style={s.subsectionTitle}>5C. Inventory (Catalog) Integration</span>
                  <p className="text-muted-foreground" style={s.bodyText}>
                    The Item Catalog serves as the source of truth for product data. When a PO is created, item data is snapshot-copied (denormalized) into the PO's line items.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2.5 px-3 text-muted-foreground" style={s.tableHeader}>Catalog Field</th>
                          <th className="text-left py-2.5 px-3 text-muted-foreground" style={s.tableHeader}>Copied to PO Line Item?</th>
                          <th className="text-left py-2.5 px-3 text-muted-foreground" style={s.tableHeader}>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { field: "itemNumber", copied: "Yes", note: "Unique identifier, used for duplicate prevention" },
                          { field: "descriptiveName", copied: "Yes", note: "Product display name" },
                          { field: "image", copied: "Yes", note: "Product image URL (Unsplash)" },
                          { field: "unitPrice", copied: "Yes", note: "Snapshot at time of PO creation. May differ from current catalog price if vendor was changed." },
                          { field: "vendorUOM / vendorUOMQty", copied: "Yes", note: "Vendor's unit of measure and quantity per UOM (e.g., 'Case' of 12)" },
                          { field: "defaultUOM", copied: "Yes", note: "Base unit of measure (e.g., 'Each', 'Piece')" },
                          { field: "discount", copied: "Yes", note: "Vendor discount %. Snapshot at creation time." },
                          { field: "currentStock / minQuantity", copied: "No", note: "Used only for warnings/alerts in OrderFlow. Not persisted on the PO." },
                          { field: "shortageDate", copied: "No", note: "Used to set expedited shipping defaults. Not persisted on the PO." },
                          { field: "partnerLocation", copied: "Indirectly", note: "Becomes the PO vendor name. The catalog item's vendor maps to VENDOR_DETAILS for full vendor info." },
                          { field: "category", copied: "Yes", note: "Product category (e.g., 'Hydraulics', 'Bearings')" },
                        ].map((row) => (
                          <tr key={row.field} className="border-b border-border/50">
                            <td className="py-2.5 px-3 text-foreground" style={s.tableCellBold}>{row.field}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-[var(--radius-sm)] ${
                                  row.copied === "Yes" ? "bg-accent/10 text-accent" : row.copied === "No" ? "bg-secondary text-muted-foreground" : "bg-primary/10 text-primary"
                                }`}
                                style={s.badge}
                              >{row.copied}</span>
                            </td>
                            <td className="py-2.5 px-3 text-foreground/70" style={s.tableCell}>{row.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <Separator />

                {/* UOM System */}
                <div className="flex flex-col gap-3">
                  <span className="text-foreground" style={s.subsectionTitle}>5D. Dual UOM System</span>
                  <p className="text-muted-foreground" style={s.bodyText}>
                    The system tracks quantities in two units of measure simultaneously. This dual-UOM model is central to how ordering works:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 rounded-[var(--radius-md)] border border-border bg-secondary/40 flex flex-col gap-2">
                      <span className="text-foreground" style={s.stepLabel}>Vendor UOM (Order Unit)</span>
                      <p className="text-muted-foreground" style={s.stepDesc}>
                        The unit the vendor sells in (e.g., Case, Box, Pack, Bundle). Each vendor UOM contains a fixed number of base units defined by <strong>vendorUOMQty</strong> (e.g., 1 Case = 12 units).
                      </p>
                      <span className="text-primary/60" style={s.tiny}>User adjusts: vendorQty (number of cases/boxes to order)</span>
                    </div>
                    <div className="p-4 rounded-[var(--radius-md)] border border-border bg-secondary/40 flex flex-col gap-2">
                      <span className="text-foreground" style={s.stepLabel}>Default UOM (Base Unit)</span>
                      <p className="text-muted-foreground" style={s.stepDesc}>
                        The base counting unit (e.g., Each, Piece, Unit, Bar). Computed as <strong>vendorQty x vendorUOMQty</strong>. This is the quantity tracked for receiving and inventory.
                      </p>
                      <span className="text-primary/60" style={s.tiny}>Auto-calculated: quantity = vendorQty x vendorUOMQty</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-[var(--radius-md)] bg-secondary border border-border">
                    <span className="text-muted-foreground" style={s.stepDesc}>
                      <strong>Example:</strong> User orders 5 Cases (vendorQty=5) of an item where each Case contains 10 Pieces (vendorUOMQty=10). The PO records: vendorQty=5, vendorUOM="Case", quantity=50, defaultUOM="Piece". Receiving tracks against the 50-piece quantity.
                    </span>
                  </div>
                </div>
              </SectionCard>

              {/* Footer */}
              <div className="flex items-center justify-center py-6">
                <span className="text-muted-foreground" style={s.tiny}>
                  Omne ERP  ---  Business Logic Documentation  ---  Generated from design specifications  ---  Feb 25, 2026
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
