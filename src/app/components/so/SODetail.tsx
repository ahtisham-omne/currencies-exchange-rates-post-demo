/* SODetail — Sales Order detail view */
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSOStore } from "./store";
import { requiresNewDraftFirst } from "../../utils/versioningEngine";
import { usePersona } from "./PersonaContext";
import { SOStatusBadge, SO_STATUS_CSS_VAR } from "./StatusBadge";
import { SOLineGrid } from "./SOLineGrid";
import { SOSidebar } from "./SOSidebar";
import { AllocateInventoryModal } from "./AllocateInventoryModal";
import { AddLineItemDialog } from "./AddLineItemDialog";
import { ShipmentsTab } from "./ShipmentsTab";
import { InvoicingTab } from "./InvoicingTab";

import { LinkedTransactionsTab } from "./LinkedTransactionsTab";
import { AttachmentsTab } from "./AttachmentsTab";
import { DealInformationTab } from "./DealInformationTab";
import { VersionHistoryTab } from "./VersionHistoryTab";
import { SourcingProductionTab } from "./SourcingProductionTab";
import { CancellationModal } from "./CancellationModal";
import { AdvancedConfiguratorModal } from "./AdvancedConfiguratorModal";
import { ConfirmSOModal } from "./ConfirmSOModal";
import { StageTransitionOverlay } from "./StageTransitionOverlay";
import { FulfillmentModal } from "./FulfillmentModal";
import { ExportSOModal } from "./ExportSOModal";
import { ArchiveModal } from "./ArchiveModal";
import { printSalesOrder } from "./PrintSalesOrder";
import { VersionHistoryModal } from "./VersionHistoryModal";
import { AutoVersionConfirmModal } from "./AutoVersionConfirmModal";
import { SOVersionDropdown } from "./SOVersionDropdown";
import { AutoVersionOverlay } from "./AutoVersionOverlay";
import { SendToCustomerModal } from "./SendToCustomerModal";
import { ConfirmationModal } from "./ConfirmationModal";
import { DisabledCTATooltip } from "./DisabledCTATooltip";
import { toast } from "sonner";
import { StagePopover } from "./StagePopover";
import {
  Pencil, Clock, Archive, ArchiveRestore, ChevronLeft, FileText,
  GitBranch, ChevronDown, Flag, Check, Ban, Scissors,
  MessageSquare, AlertTriangle, Truck, Download, Copy, History,
  Package, ArrowUpRight, Receipt, Paperclip, Link2, Zap, DollarSign, Plus,
  Send, CheckCircle2, XCircle, Printer, RotateCcw,
} from "lucide-react";
import { DateEditModal, type SODateType, type DateConfig } from "./ui/DateEditModal";
import type { SOLine, CancellationReason, SOPriority } from "./types";
import { ARCHIVABLE_STATES } from "./types";

/* ── Inline editable description (Quotes-style) ── */
function DescriptionField({ soId, initialDescription }: { soId: string; initialDescription: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [desc, setDesc] = useState(initialDescription);
  if (isEditing) {
    return (
      <div className="flex items-center flex-1 min-w-0" style={{ height: 24, borderRadius: 4, backgroundColor: "#FFFFFF", border: "1px solid var(--primary)", padding: "0 8px", boxShadow: "0 0 0 2px rgba(10,119,255,0.1)" }}>
        <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => setIsEditing(false)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setIsEditing(false); }} placeholder="Add a description..." autoFocus className="bg-transparent text-foreground focus:outline-none w-full" style={{ fontSize: 11.5, lineHeight: "22px", padding: 0, border: "none" }} />
        <Pencil style={{ width: 10, height: 10, color: "#9CA3AF", flexShrink: 0, marginLeft: 6 }} />
      </div>
    );
  }
  if (desc) {
    return (
      <button onClick={() => setIsEditing(true)} className="group/desc inline-flex items-center min-w-0" style={{ height: 24, border: "none", background: "none", padding: "0 6px", borderRadius: 4, cursor: "pointer", transition: "all 150ms", gap: 4, maxWidth: "100%" }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.06)"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
        <span style={{ fontSize: 11.5, color: "inherit", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: "22px" }}>{desc}</span>
        <Pencil className="shrink-0 text-foreground/25 group-hover/desc:text-primary transition-all" style={{ width: 10, height: 10 }} />
      </button>
    );
  }
  return (
    <button onClick={() => setIsEditing(true)} className="group/desc flex items-center min-w-0" style={{ height: 24, border: "1px dashed #D5D8DC", background: "none", padding: "0 8px", borderRadius: 4, cursor: "pointer", transition: "all 150ms", gap: 5 }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = "#B0B5BC"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.borderColor = "#D5D8DC"; }}>
      <span style={{ fontSize: 11.5, color: "#B0B5BC", whiteSpace: "nowrap", lineHeight: "22px" }}>Add description...</span>
      <Pencil style={{ width: 10, height: 10, color: "#B0B5BC", flexShrink: 0 }} />
    </button>
  );
}

const TABS = [
  { id: "lines", label: "Line Items" },
  { id: "deal", label: "Deal Information" },
  { id: "sourcing", label: "Sourcing & Procurement" },
  { id: "shipping", label: "Shipping" },
  { id: "invoicing", label: "Invoicing" },
  { id: "attachments", label: "Attachments" },
  { id: "linked", label: "Linked Transactions" },
  { id: "comms", label: "Communications" },
  { id: "activity", label: "Activity" },
  { id: "versions", label: "Versions" },
];

export function SODetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useSOStore();
  
  const { isCreator, isReviewer } = usePersona();
  const so = store.salesOrders.find(s => s.id === id);

  const [activeTab, setActiveTab] = useState("lines");
  const [allocationLine, setAllocationLine] = useState<SOLine | null>(null);
  const [showAddLine, setShowAddLine] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [cancelModalMode, setCancelModalMode] = useState<"full" | "partial" | null>(null);
  const [cancelPreselectedLineIds, setCancelPreselectedLineIds] = useState<string[]>([]);
  const [configureLine, setConfigureLine] = useState<SOLine | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCTADropdown, setShowCTADropdown] = useState(false);
  const [showFulfillmentModal, setShowFulfillmentModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [showSendToCustomer, setShowSendToCustomer] = useState(false);
  const [isSendResend, setIsSendResend] = useState(false);
  const [sendModalMode, setSendModalMode] = useState<"send" | "print">("send");
  const ctaDropdownRef = useRef<HTMLDivElement>(null);
  const suppressNextTransitionRef = useRef(false);

  /* Scroll state for header compression */
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const el = contentScrollRef.current;
    if (!el) return;
    const handler = () => setIsScrolled(el.scrollTop > 10);
    el.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => el.removeEventListener("scroll", handler);
  }, []);

  /* Date state for editable date cards in detail header */
  const [editingDateType, setEditingDateType] = useState<SODateType | null>(null);
  const [detailDateConfigs, setDetailDateConfigs] = useState({
    request: { dateType: "absolute" as const, absoluteValue: so?.createdDate || "03/16/2026", relativeValue: "", relativeUnit: "days" },
    estShip: { dateType: "relative" as const, absoluteValue: "", relativeValue: "20", relativeUnit: "days after order" },
    dueDelivery: { dateType: "relative" as const, absoluteValue: "", relativeValue: "30", relativeUnit: "days after order" },
  });

  useEffect(() => {
    if (!showCTADropdown) return;
    const handler = (e: MouseEvent) => {
      if (ctaDropdownRef.current && !ctaDropdownRef.current.contains(e.target as Node)) setShowCTADropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCTADropdown]);

  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showAutoVersionConfirm, setShowAutoVersionConfirm] = useState(false);
  const [autoVersionField, setAutoVersionField] = useState("");
  const [showAutoVersionOverlay, setShowAutoVersionOverlay] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<SOPriority>(so?.priority ?? "Standard");

  // Pending change for auto-versioning: stores the action to apply after version draft is created
  const [pendingVersionChange, setPendingVersionChange] = useState<{
    fieldLabel: string;
    oldValue?: string;
    newValue?: string;
    action: () => void;
  } | null>(null);

  if (!so) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-foreground" style={{ fontSize: "var(--text-h4)", fontWeight: "var(--font-weight-semibold)" }}>Sales Order not found</h2>
          <button onClick={() => navigate("/sales-orders")} className="mt-3 text-primary" style={{ fontSize: "var(--text-caption)" }}>&larr; Back to list</button>
        </div>
      </div>
    );
  }

  const soShipments = store.shipments.filter(s => so.shipmentIds.includes(s.id));

  // ===== Action permissions =====
  const isDraft = so.status === "Draft";
  const isUnconfirmed = so.status === "Pending Review";
  const isShipped = so.status === "Shipped";
  const canAllocate = !["Cancelled", "Shipped", "Archived"].includes(so.status);
  const canCancel = !["Cancelled", "Archived", "Shipped"].includes(so.status);
  const canArchive = ARCHIVABLE_STATES.includes(so.status);
  const canUnarchive = so.status === "Archived";
  const canReactivate = ["Cancelled", "Partially Cancelled", "Archived"].includes(so.status);
  const isPostConfirmed = ["Cleared", "Partially Shipped", "Shipped"].includes(so.status);

  /* Cancellation mode availability for CTA dropdown */
  const hasAnyShippedLine = so.lines.some(l => !l.cancelled && l.shippedQty > 0);
  const cancellableLinesForCTA = so.lines.filter(l => !l.cancelled && l.shippedQty < l.orderedQty);
  const isPartialCancelMeaningless = cancellableLinesForCTA.length === 0 || (
    cancellableLinesForCTA.length === 1 &&
    (cancellableLinesForCTA[0].orderedQty - cancellableLinesForCTA[0].shippedQty - (cancellableLinesForCTA[0].cancelledQty || 0)) <= 1
  );
  const isFullCancelBlocked = hasAnyShippedLine;

  const handleMarkUnconfirmed = () => {
    store.markUnconfirmed(so.id);
  };

  const handleConfirm = () => {
    const result = store.confirmSO(so.id);
    if (result.valid) { setShowConfirmModal(false); }
    else result.errors.forEach(e => toast.error(e));
  };

  const handleCancelFull = (reason: CancellationReason, reasonText: string) => {
    store.cancelSO(so.id, reason, reasonText);
    // No toast — StageTransitionOverlay animation provides visual feedback
  };

  const handleCancelPartial = (lineIds: string[], cancelQtys: Record<string, number>, reason: CancellationReason, reasonText: string) => {
    store.cancelSOLines(so.id, lineIds, reason === "Other" && reasonText ? `${reason}: ${reasonText}` : reason, cancelQtys);
    // No toast — StageTransitionOverlay animation provides visual feedback
  };

  const handleArchive = () => {
    store.archiveSO(so.id);
    // No toast — StageTransitionOverlay animation provides visual feedback
  };
  const handleUnarchive = () => { store.unarchiveSO(so.id); toast.success("Sales Order unarchived"); };
  const handleReactivate = () => {
    store.reactivateSO(so.id);
    // No toast — StageTransitionOverlay animation provides visual feedback
  };
  const handleCancelLines = (lineIds: string[]) => {
    setCancelPreselectedLineIds(lineIds);
    setCancelModalMode("partial");
  };

  // ===== Stepper — icon-based, matching Quotes module =====
  const ALL_SO_STEPS = [
    { id: "Draft", label: "Draft", icon: FileText, fillColor: "#4B5563", ringColor: "#9CA3AF" },
    { id: "Pending Review", label: "Pending Review", icon: Send, fillColor: "#F59E0B", ringColor: "#FCD34D" },
    { id: "Cleared", label: "Cleared by Ops", icon: CheckCircle2, fillColor: "#0D9488", ringColor: "#5EEAD4" },
    { id: "Partially Shipped", label: "Partially Shipped", icon: Truck, fillColor: "#7C3AED", ringColor: "#C4B5FD" },
    { id: "Shipped", label: "Shipped", icon: Package, fillColor: "#047857", ringColor: "#34D399" },
  ];
  // Ops View: hide "Pending Review" only for SOs the ops user created themselves
  // (salesRep === "Current User" means self-created). Show it for SOs submitted by others.
  const isOwnSO = so.salesRep === "Current User";
  const SO_STEPS = isReviewer && isOwnSO
    ? ALL_SO_STEPS.filter(s => s.id !== "Pending Review")
    : ALL_SO_STEPS;
  const TERMINAL_STATES_MAP: Record<string, { label: string; icon: typeof XCircle; fillColor: string; ringColor: string }> = {
    Cancelled: { label: "Cancelled", icon: XCircle, fillColor: "#DC2626", ringColor: "#FCA5A5" },
    "Partially Cancelled": { label: "Partially Cancelled", icon: XCircle, fillColor: "#DC2626", ringColor: "#FCA5A5" },
    Archived: { label: "Archived", icon: Archive, fillColor: "#DC2626", ringColor: "#FCA5A5" },
  };
  const isTerminalStatus = !!TERMINAL_STATES_MAP[so.status];
  const terminalConfig = isTerminalStatus ? TERMINAL_STATES_MAP[so.status] : null;
  const currentStepIndex = (() => {
    return SO_STEPS.findIndex(s => s.id === so.status);
  })();
  const terminalBranchIndex = isTerminalStatus ? (() => {
    if (so.previousStatus) {
      const idx = SO_STEPS.findIndex(s => s.id === so.previousStatus);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  })() : -1;
  const resolvedStepIdx = isTerminalStatus ? terminalBranchIndex : currentStepIndex;
  const statusCssVar = SO_STATUS_CSS_VAR[so.status] || "var(--foreground)";

  const soVersion = so.version ?? { number: 1, label: "Latest" as const, date: so.createdDate };
  const soVersions = so.versions ?? [soVersion];
  const soPriority = so.priority ?? "Standard";

  const confirmedStatuses = ["Cleared", "Partially Shipped", "Shipped"];
  const isConfirmedOrBeyond = confirmedStatuses.includes(so.status);
  const displayVersionLabel = isConfirmedOrBeyond ? (soVersion.label === "Latest" ? "Last Approved" : soVersion.label) : "Latest";
  const displayVersionLabelColor = displayVersionLabel === "Latest" ? "bg-accent/10 text-accent" : displayVersionLabel === "Last Approved" ? "bg-primary/10 text-primary" : "bg-secondary text-foreground/50";


  const priorityConfig: Record<SOPriority, { cssVar: string; textColor: string; bgStyle: string }> = {
    Low: { cssVar: "#475569", textColor: "text-foreground/60", bgStyle: "bg-[#F1F5F9]" },
    Standard: { cssVar: "#1E40AF", textColor: "text-[#1E40AF]", bgStyle: "bg-[#EFF6FF]" },
    High: { cssVar: "#991B1B", textColor: "text-[#991B1B]", bgStyle: "bg-[#FEF2F2]" },
  };

  const sourcingCount = so.procurementOrders.length + so.backorders.length;
  const tabCounts: Record<string, number> = {
    lines: so.lines.length, linked: so.linkedTransactions.filter(t => !["Invoice", "Credit Memo", "Payment Receipt"].includes(t.type)).length,
    activity: so.activityLog.length, shipping: soShipments.length, attachments: so.attachments.length,
    sourcing: sourcingCount,
  };

  const statusMessage = getStatusMessage(so);

  /* ── Timeline date display helpers ── */
  const fmtNow = () => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
  };
  const getRequestDisplay = () => detailDateConfigs.request.absoluteValue || fmtNow();
  const getEstShipDisplay = () =>
    (detailDateConfigs.estShip as any).dateType === "absolute"
      ? detailDateConfigs.estShip.absoluteValue || fmtNow()
      : `${detailDateConfigs.estShip.relativeValue} ${detailDateConfigs.estShip.relativeUnit}`;
  const getDueDeliveryDisplay = () =>
    (detailDateConfigs.dueDelivery as any).dateType === "absolute"
      ? detailDateConfigs.dueDelivery.absoluteValue || fmtNow()
      : `${detailDateConfigs.dueDelivery.relativeValue} ${detailDateConfigs.dueDelivery.relativeUnit}`;

  /* Date configs are managed via the sidebar timeline card — see SOSidebar */

  /* ── Stepper uses resolvedStepIdx from above ── */

  return (
    <>
      <div className="bg-background flex flex-col" style={{ maxWidth: "var(--container-detail)", margin: "0 auto", height: "100%" }}>

        {/* Cancellation banner removed — cancellation is instant, no pending state */}

        {/* Archived banner removed — Reactivate CTA is in header */}

        {/* ═══════════════════════════════════════════════
            UNIFIED HEADER CARD — PO-style: full-height gradient, icon back, 4 action buttons
           ═══════════════════════════════════════════════ */}
        {(() => {
          const hdrBtnSize = isScrolled ? "w-7 h-7" : "w-8 h-8";
          const hdrBtnIconSize = isScrolled ? "w-3.5 h-3.5" : "w-4 h-4";

          // Compute total value from lines
          const totalValue = so.lines.reduce((sum: number, l: SOLine) => sum + (l.orderedQty * l.unitPrice), 0);

          // ── Full-height card gradient (PO pattern — bottom-up with linear overlay) ──
          const cardGradient = (() => {
            if (isTerminalStatus && terminalConfig) {
              const tc = terminalConfig.fillColor;
              return `radial-gradient(ellipse 110% 200% at 80% 100%, color-mix(in srgb, ${tc} 10%, transparent) 0%, color-mix(in srgb, ${tc} 5%, transparent) 30%, transparent 70%), linear-gradient(180deg, color-mix(in srgb, ${tc} 1%, transparent) 0%, color-mix(in srgb, ${tc} 3%, transparent) 100%)`;
            }
            if (currentStepIndex <= 0) return ""; // Draft = plain white
            const step = SO_STEPS[Math.min(currentStepIndex, SO_STEPS.length - 1)];
            const cx = Math.min(90, Math.max(10, Math.round((currentStepIndex / (SO_STEPS.length - 1)) * 100)));
            return `radial-gradient(
              ellipse 110% 200% at ${cx}% 100%,
              color-mix(in srgb, ${step.fillColor} 10%, transparent) 0%,
              color-mix(in srgb, ${step.fillColor} 8%, transparent) 25%,
              color-mix(in srgb, ${step.fillColor} 3%, transparent) 50%,
              color-mix(in srgb, ${step.fillColor} 1%, transparent) 72%,
              transparent 95%
            ), linear-gradient(180deg,
              color-mix(in srgb, ${step.fillColor} 1%, transparent) 0%,
              color-mix(in srgb, ${step.fillColor} 1.5%, transparent) 55%,
              color-mix(in srgb, ${step.fillColor} 3%, transparent) 100%
            )`;
          })();




          // ── Determine if PO-like "closed" dimmed state ──
          const isClosed = isTerminalStatus || isShipped;

          return (
            <div
              className="shrink-0 relative"
              style={{
                padding: `${isScrolled ? "4px" : "14px"} var(--space-page-x) ${isScrolled ? "0" : "6px"}`,
                transition: "padding 200ms ease",
                zIndex: 20,
              }}
            >
              <div
                className="relative transition-all duration-200"
                style={{
                  borderRadius: 12,
                  boxShadow: "var(--elevation-sm)",
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  background: cardGradient ? `${cardGradient}, var(--card)` : "var(--card)",
                  transition: "background 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                  overflow: "visible",
                }}
              >
                {/* ── Row 1: Back icon + SO# + Status + Version + Priority + spacer + 4 action btns + separator + CTA ── */}
                <div
                  className="flex items-center justify-between transition-all duration-200"
                  style={{ padding: isScrolled ? "6px 16px" : "16px 20px 12px", gap: 12 }}
                >
                  {/* Left: Back icon + separator + doc icon + SO number + version + priority */}
                  <div className={`flex items-center min-w-0 ${isScrolled ? "gap-2" : "gap-2.5"}`}>
                    {/* Icon-only back button — with outline matching other icon buttons */}
                    <button
                      onClick={() => navigate("/sales-orders")}
                      className="shrink-0 flex items-center justify-center rounded-lg transition-colors"
                      title="Back to Sales Orders"
                      style={{
                        width: isScrolled ? 28 : 32,
                        height: isScrolled ? 28 : 32,
                        backgroundColor: "#FFFFFF",
                        border: `1px solid ${isClosed ? "color-mix(in srgb, var(--muted-foreground) 18%, transparent)" : "var(--border)"}`,
                        cursor: "pointer",
                        color: isClosed ? "color-mix(in srgb, var(--muted-foreground) 55%, transparent)" : "var(--muted-foreground)",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--secondary)"; e.currentTarget.style.color = "var(--primary)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FFFFFF"; e.currentTarget.style.color = isClosed ? "color-mix(in srgb, var(--muted-foreground) 55%, transparent)" : "var(--muted-foreground)"; }}
                    >
                      <ChevronLeft style={{ width: isScrolled ? 16 : 18, height: isScrolled ? 16 : 18 }} />
                    </button>

                    {/* Separator after Back */}
                    <div className="shrink-0" style={{ width: 1, height: isScrolled ? 18 : 22, backgroundColor: isClosed ? "color-mix(in srgb, var(--muted-foreground) 18%, transparent)" : "var(--border)" }} />

                    {/* Document icon — gray with subtle outline (not blue) */}
                    <div className="shrink-0 flex items-center justify-center" style={{
                      width: isScrolled ? 24 : 32, height: isScrolled ? 24 : 32,
                      borderRadius: isScrolled ? 6 : 8,
                      backgroundColor: isClosed ? "color-mix(in srgb, var(--muted-foreground) 12%, transparent)" : "color-mix(in srgb, var(--muted-foreground) 8%, transparent)",
                      border: `1px solid ${isClosed ? "color-mix(in srgb, var(--muted-foreground) 20%, transparent)" : "color-mix(in srgb, var(--muted-foreground) 15%, transparent)"}`,
                      transition: "all 300ms ease",
                    }}>
                      <Receipt style={{ width: isScrolled ? 12 : 16, height: isScrolled ? 12 : 16, color: isClosed ? "var(--muted-foreground)" : "var(--muted-foreground)", transition: "color 300ms ease" }} />
                    </div>

                    {/* SO number — large like reference */}
                    <span className="text-foreground" style={{
                      fontSize: isScrolled ? 14 : 18, fontWeight: 700,
                      lineHeight: isScrolled ? "16px" : "22px", letterSpacing: "-0.01em",
                      color: isClosed ? "var(--muted-foreground)" : undefined,
                    }}>{so.soNumber}</span>

                    {/* Version dropdown — Quotes-matched design */}
                    <SOVersionDropdown
                      currentVersion={soVersion.number}
                      currentStatus={so.status}
                      onViewVersion={(v) => {
                        // TODO: hook up version viewing
                      }}
                      onEditAsDraft={(fromVersion) => {
                        setPendingVersionChange({ fieldLabel: `Revert to V${fromVersion}`, action: () => {} });
                        setAutoVersionField(`Revert to V${fromVersion}`);
                        setShowAutoVersionConfirm(true);
                      }}
                      materialChangesCount={0}
                      isScrolled={isScrolled}
                    />

                    {/* Priority dropdown — borderless, screenshot colors */}
                    <div className="relative">
                      <button
                        onClick={() => { setShowPriorityDropdown(!showPriorityDropdown); setShowVersionDropdown(false); }}
                        className={`flex items-center gap-1.5 transition-colors whitespace-nowrap ${priorityConfig[selectedPriority].bgStyle}`}
                        style={{ height: isScrolled ? 26 : 30, paddingLeft: isScrolled ? 8 : 10, paddingRight: isScrolled ? 6 : 8, borderRadius: 6 }}
                      >
                        <Flag className={`w-3 h-3 ${priorityConfig[selectedPriority].textColor}`} />
                        <span className={priorityConfig[selectedPriority].textColor} style={{ fontSize: 12, fontWeight: 600 }}>{selectedPriority}</span>
                        <ChevronDown className={`w-3 h-3 opacity-60 ${priorityConfig[selectedPriority].textColor}`} />
                      </button>
                      {showPriorityDropdown && (
                        <div className="absolute top-full left-0 mt-1 w-[140px] bg-card border border-border rounded-xl py-1" style={{ zIndex: "var(--z-dropdown)", boxShadow: "var(--elevation-sm)" }}>
                          {(["Low", "Standard", "High"] as SOPriority[]).map(p => (
                            <button key={p} onClick={() => { setSelectedPriority(p); setShowPriorityDropdown(false); store.updateSO(so.id, { priority: p }); }} className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary transition-colors ${p === selectedPriority ? "bg-secondary" : ""}`} style={{ fontSize: 12 }}>
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: priorityConfig[p].cssVar }} />
                              <span className="text-foreground" style={{ fontWeight: 500 }}>{p}</span>
                              {p === selectedPriority && <Check className="w-3 h-3 text-primary ml-auto" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Status badge — after priority */}
                    <SOStatusBadge status={so.status} />
                  </div>

                  {/* Right: 4 PO-style action buttons + separator + CTA */}
                  <div className={`flex items-center shrink-0 ${isScrolled ? "gap-1.5" : "gap-1.5"}`}>
                    {/* 4 icon-only action buttons: Print, Download, Duplicate, Archive/Delete */}
                    {([
                      { icon: Printer, onClick: () => { setSendModalMode("print"); setShowSendToCustomer(true); }, destructive: false, label: "Print", disabled: false },
                      { icon: Download, onClick: () => setShowExportModal(true), destructive: false, label: "Download", disabled: false },
                      { icon: Copy, onClick: () => setShowDuplicateConfirm(true), destructive: false, label: "Duplicate Sales Order", disabled: false },
                      ...(!isShipped && so.status !== "Archived" ? [{ icon: Archive, onClick: () => setShowArchiveModal(true), destructive: true, label: "Archive", disabled: isClosed }] : []),
                    ] as Array<{ icon: typeof Printer; onClick: () => void; destructive: boolean; label: string; disabled: boolean }>).map((btn, idx) => (
                      <button
                        key={idx}
                        onClick={btn.onClick}
                        title={btn.label}
                        disabled={btn.disabled}
                        className={`rounded-lg flex items-center justify-center shrink-0 transition-all duration-150 ${hdrBtnSize}`}
                        style={{
                          border: btn.destructive
                            ? `1px solid ${isClosed ? "color-mix(in srgb, var(--muted-foreground) 14%, transparent)" : "color-mix(in srgb, var(--destructive) 40%, transparent)"}`
                            : `1px solid ${isClosed ? "color-mix(in srgb, var(--muted-foreground) 18%, transparent)" : "var(--border)"}`,
                          backgroundColor: "#FFFFFF",
                          color: btn.destructive
                            ? (isClosed ? "color-mix(in srgb, var(--muted-foreground) 40%, transparent)" : "var(--destructive)")
                            : (isClosed ? "color-mix(in srgb, var(--muted-foreground) 55%, transparent)" : "var(--muted-foreground)"),
                          cursor: btn.disabled ? "not-allowed" : "pointer",
                          opacity: btn.disabled ? 0.5 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (btn.disabled) return;
                          if (btn.destructive && !isClosed) {
                            e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--destructive) 5%, var(--card))";
                            e.currentTarget.style.borderColor = "color-mix(in srgb, var(--destructive) 60%, transparent)";
                          } else {
                            e.currentTarget.style.backgroundColor = "var(--secondary)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (btn.disabled) return;
                          if (btn.destructive && !isClosed) {
                            e.currentTarget.style.backgroundColor = "#FFFFFF";
                            e.currentTarget.style.borderColor = "color-mix(in srgb, var(--destructive) 40%, transparent)";
                          } else {
                            e.currentTarget.style.backgroundColor = "#FFFFFF";
                          }
                        }}
                      >
                        <btn.icon className={hdrBtnIconSize} style={{ width: 15, height: 15 }} />
                      </button>
                    ))}

                    {/* Separator before CTA */}
                    <div className="shrink-0" style={{ width: 1, height: isScrolled ? 18 : 22, backgroundColor: isClosed ? "color-mix(in srgb, var(--muted-foreground) 18%, transparent)" : "var(--border)", margin: "0 2px" }} />

                    {/* CTA: Draft → Send to Customer (Creator) */}
                    {isDraft && isCreator && (
                      <div ref={!isUnconfirmed && !isPostConfirmed ? ctaDropdownRef : undefined} className="relative flex items-center ml-1">
                        <button onClick={() => { setIsSendResend(false); setSendModalMode("send"); setShowSendToCustomer(true); }} className={`flex items-center gap-1.5 text-white transition-colors ${canCancel ? "rounded-l-lg" : "rounded-lg"} ${isScrolled ? "h-7 pl-2.5 pr-2" : "h-9 pl-3.5 pr-3"}`} style={{ fontSize: 13, fontWeight: 600, backgroundColor: "#16A34A" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#15803D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#16A34A"; }}>
                          <Send className="w-3.5 h-3.5" />Send to Customer
                        </button>
                        {canCancel && (
                          <>
                            <div className={`w-px bg-white/20 ${isScrolled ? "h-7" : "h-9"}`} />
                            <button onClick={() => setShowCTADropdown(!showCTADropdown)} className={`flex items-center px-2 text-white rounded-r-lg transition-colors ${isScrolled ? "h-7" : "h-9"}`} style={{ backgroundColor: "#16A34A" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#15803D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#16A34A"; }}><ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCTADropdown ? "rotate-180" : ""}`} /></button>
                          </>
                        )}
                        {showCTADropdown && isDraft && (
                          <div className="absolute top-full right-0 mt-1 bg-card border border-border z-50" style={{ width: 280, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                            <div style={{ padding: 4 }}>
                              <button onClick={() => { handleMarkUnconfirmed(); setShowCTADropdown(false); }} className="flex items-center gap-3 w-full text-left transition-colors" style={{ padding: "8px 10px", borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Check style={{ width: 14, height: 14, color: "#1E40AF" }} /></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", lineHeight: 1, marginBottom: 5 }}>Submit for Review</div>
                                  <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1 }}>Submit directly for ops review without sending</div>
                                </div>
                              </button>
                              <button onClick={() => { setCancelModalMode("full"); setShowCTADropdown(false); }} className="flex items-center gap-3 w-full text-left transition-colors" style={{ padding: "8px 10px", borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ban style={{ width: 14, height: 14, color: "#991B1B" }} /></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "#991B1B", lineHeight: 1, marginBottom: 5 }}>Cancel Order</div>
                                  <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1 }}>Permanently cancel this sales order</div>
                                </div>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Draft view for reviewer (own SO) — Clear for Processing primary, Send to Customer in dropdown */}
                    {isDraft && isReviewer && isOwnSO && (
                      <div ref={ctaDropdownRef} className="relative flex items-center ml-1">
                        <button onClick={() => setShowConfirmModal(true)} className={`flex items-center gap-1.5 text-white transition-colors ${canCancel ? "rounded-l-lg" : "rounded-lg"} ${isScrolled ? "h-7 pl-2.5 pr-2" : "h-9 pl-3.5 pr-3"}`} style={{ fontSize: 13, fontWeight: 600, backgroundColor: "#16A34A" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#15803D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#16A34A"; }}>
                          <Check className="w-3.5 h-3.5" />Clear for Processing
                        </button>
                        {canCancel && (
                          <>
                            <div className={`w-px bg-white/20 ${isScrolled ? "h-7" : "h-9"}`} />
                            <button onClick={() => setShowCTADropdown(!showCTADropdown)} className={`flex items-center px-2 text-white rounded-r-lg transition-colors ${isScrolled ? "h-7" : "h-9"}`} style={{ backgroundColor: "#16A34A" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#15803D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#16A34A"; }}><ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCTADropdown ? "rotate-180" : ""}`} /></button>
                          </>
                        )}
                        {showCTADropdown && isDraft && (
                          <div className="absolute top-full right-0 mt-1 bg-card border border-border z-50" style={{ width: 280, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                            <div style={{ padding: 4 }}>
                              <button onClick={() => { setIsSendResend(false); setSendModalMode("send"); setShowSendToCustomer(true); setShowCTADropdown(false); }} className="flex items-center gap-3 w-full text-left transition-colors" style={{ padding: "8px 10px", borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Send style={{ width: 14, height: 14, color: "#1E40AF" }} /></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", lineHeight: 1, marginBottom: 5 }}>Send to Customer</div>
                                  <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1 }}>Send SO document for customer review</div>
                                </div>
                              </button>
                              <button onClick={() => { setCancelModalMode("full"); setShowCTADropdown(false); }} className="flex items-center gap-3 w-full text-left transition-colors" style={{ padding: "8px 10px", borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ban style={{ width: 14, height: 14, color: "#991B1B" }} /></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "#991B1B", lineHeight: 1, marginBottom: 5 }}>Cancel Order</div>
                                  <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1 }}>Permanently cancel this sales order</div>
                                </div>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Draft view for reviewer (other's SO) — Send to Customer primary, Clear in dropdown */}
                    {isDraft && isReviewer && !isOwnSO && (
                      <div ref={ctaDropdownRef} className="relative flex items-center ml-1">
                        <button onClick={() => { setIsSendResend(false); setSendModalMode("send"); setShowSendToCustomer(true); }} className={`flex items-center gap-1.5 text-white transition-colors ${canCancel ? "rounded-l-lg" : "rounded-lg"} ${isScrolled ? "h-7 pl-2.5 pr-2" : "h-9 pl-3.5 pr-3"}`} style={{ fontSize: 13, fontWeight: 600, backgroundColor: "#16A34A" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#15803D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#16A34A"; }}>
                          <Send className="w-3.5 h-3.5" />Send to Customer
                        </button>
                        {canCancel && (
                          <>
                            <div className={`w-px bg-white/20 ${isScrolled ? "h-7" : "h-9"}`} />
                            <button onClick={() => setShowCTADropdown(!showCTADropdown)} className={`flex items-center px-2 text-white rounded-r-lg transition-colors ${isScrolled ? "h-7" : "h-9"}`} style={{ backgroundColor: "#16A34A" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#15803D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#16A34A"; }}><ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCTADropdown ? "rotate-180" : ""}`} /></button>
                          </>
                        )}
                        {showCTADropdown && isDraft && (
                          <div className="absolute top-full right-0 mt-1 bg-card border border-border z-50" style={{ width: 280, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                            <div style={{ padding: 4 }}>
                              <button onClick={() => { setShowConfirmModal(true); setShowCTADropdown(false); }} className="flex items-center gap-3 w-full text-left transition-colors" style={{ padding: "8px 10px", borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><CheckCircle2 style={{ width: 14, height: 14, color: "#065F46" }} /></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", lineHeight: 1, marginBottom: 5 }}>Clear for Processing</div>
                                  <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1 }}>Approve and clear for fulfillment</div>
                                </div>
                              </button>
                              <button onClick={() => { setCancelModalMode("full"); setShowCTADropdown(false); }} className="flex items-center gap-3 w-full text-left transition-colors" style={{ padding: "8px 10px", borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ban style={{ width: 14, height: 14, color: "#991B1B" }} /></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "#991B1B", lineHeight: 1, marginBottom: 5 }}>Cancel Order</div>
                                  <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1 }}>Permanently cancel this sales order</div>
                                </div>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* CTA: Pending Review → Clear by Ops (Reviewer only) */}
                    {isUnconfirmed && isReviewer && (
                      <div ref={isUnconfirmed ? ctaDropdownRef : undefined} className="relative flex items-center ml-1">
                        <button onClick={() => setShowConfirmModal(true)} className={`flex items-center gap-1.5 text-white transition-colors ${canCancel ? "rounded-l-lg" : "rounded-lg"} ${isScrolled ? "h-7 pl-2.5 pr-2" : "h-9 pl-3.5 pr-3"}`} style={{ fontSize: 13, fontWeight: 600, backgroundColor: "#16A34A" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#15803D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#16A34A"; }}>
                          <Check className="w-3.5 h-3.5" />Clear for Processing
                        </button>
                        {canCancel && (
                          <>
                            <div className={`w-px bg-white/20 ${isScrolled ? "h-7" : "h-9"}`} />
                            <button onClick={() => setShowCTADropdown(!showCTADropdown)} className={`flex items-center px-2 text-white rounded-r-lg transition-colors ${isScrolled ? "h-7" : "h-9"}`} style={{ backgroundColor: "#16A34A" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#15803D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#16A34A"; }}><ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCTADropdown ? "rotate-180" : ""}`} /></button>
                          </>
                        )}
                        {showCTADropdown && isUnconfirmed && (
                          <div className="absolute top-full right-0 mt-1 bg-card border border-border z-50" style={{ width: 280, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                            <div style={{ padding: 4 }}>
                              <button onClick={() => { setIsSendResend(true); setSendModalMode("send"); setShowSendToCustomer(true); setShowCTADropdown(false); }} className="flex items-center gap-3 w-full text-left transition-colors" style={{ padding: "8px 10px", borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Send style={{ width: 14, height: 14, color: "#1E40AF" }} /></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", lineHeight: 1, marginBottom: 5 }}>Resend to Customer</div>
                                  <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1 }}>Send updated SO document to customer</div>
                                </div>
                              </button>
                              <button onClick={() => { setCancelModalMode("full"); setShowCTADropdown(false); }} className="flex items-center gap-3 w-full text-left transition-colors" style={{ padding: "8px 10px", borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ban style={{ width: 14, height: 14, color: "#991B1B" }} /></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "#991B1B", lineHeight: 1, marginBottom: 5 }}>Cancel Order</div>
                                  <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1 }}>Permanently cancel this sales order</div>
                                </div>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Pending Review — Cancel SO as primary CTA (Creator) with resend in dropdown */}
                    {isUnconfirmed && isCreator && (
                      <div ref={ctaDropdownRef} className="relative flex items-center ml-1">
                        <button onClick={() => setCancelModalMode("full")} className={`flex items-center gap-1.5 bg-card text-destructive border border-destructive/40 transition-colors hover:bg-destructive/8 hover:border-destructive/60 ${isScrolled ? "h-7 px-2.5 rounded-l-lg" : "h-9 px-3 rounded-l-lg"}`} style={{ fontSize: 13, fontWeight: 600 }}>
                          <Ban className="w-3.5 h-3.5" />Cancel SO
                        </button>
                        <div className={`w-px bg-destructive/20 ${isScrolled ? "h-7" : "h-9"}`} />
                        <button onClick={() => setShowCTADropdown(!showCTADropdown)} className={`flex items-center px-2 bg-card text-destructive border border-destructive/40 border-l-0 rounded-r-lg transition-colors hover:bg-destructive/8 ${isScrolled ? "h-7" : "h-9"}`}><ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCTADropdown ? "rotate-180" : ""}`} /></button>
                        {showCTADropdown && (
                          <div className="absolute top-full right-0 mt-1 bg-card border border-border z-50" style={{ width: 280, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                            <div style={{ padding: 4 }}>
                              <button onClick={() => { setIsSendResend(true); setSendModalMode("send"); setShowSendToCustomer(true); setShowCTADropdown(false); }} className="flex items-center gap-3 w-full text-left transition-colors" style={{ padding: "8px 10px", borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Send style={{ width: 14, height: 14, color: "#1E40AF" }} /></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", lineHeight: 1, marginBottom: 5 }}>Resend to Customer</div>
                                  <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1 }}>Send updated SO document to customer</div>
                                </div>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* CTA: Post-Confirmed → Cancel Sales Order */}
                    {isPostConfirmed && canCancel && !isShipped && (() => {
                      const noCancellableLines = cancellableLinesForCTA.length === 0;
                      return (
                        <div className="flex items-center ml-1">
                          <DisabledCTATooltip
                            disabled={noCancellableLines}
                            reason="All line items are fully shipped and cannot be cancelled."
                            action="Use Returns / RMA for shipped items."
                          >
                            <button
                              onClick={() => !noCancellableLines && setCancelModalMode(isFullCancelBlocked ? "partial" : "full")}
                              disabled={noCancellableLines}
                              className={`flex items-center gap-1.5 bg-card text-destructive border border-destructive/40 rounded-lg transition-colors ${isScrolled ? "h-7 px-2.5" : "h-9 px-3"} ${noCancellableLines ? "opacity-40 cursor-not-allowed" : "hover:bg-destructive/8 hover:border-destructive/60"}`}
                              style={{ fontSize: 12, fontWeight: 500 }}
                            >
                              <Ban className="w-3 h-3" />Cancel Sales Order
                            </button>
                          </DisabledCTATooltip>
                        </div>
                      );
                    })()}

                    {/* CTA: Shipped → Archive */}
                    {isShipped && canArchive && (
                      <div className="flex items-center ml-1.5">
                        <button onClick={() => setShowArchiveModal(true)} className={`flex items-center gap-1.5 bg-card text-destructive border border-destructive/40 rounded-lg transition-colors ${isScrolled ? "h-7 px-2.5" : "h-9 px-3"} hover:bg-destructive/8 hover:border-destructive/60`} style={{ fontSize: 13, fontWeight: 600 }}>
                          <Archive className="w-3.5 h-3.5" />Archive
                        </button>
                      </div>
                    )}

                    {/* CTA: Archived → Reactivate SO */}
                    {canUnarchive && (
                      <div className="flex items-center ml-1.5">
                        <button onClick={handleReactivate} className={`flex items-center gap-1.5 text-white rounded-lg transition-colors ${isScrolled ? "h-7 px-2.5" : "h-9 px-3"}`} style={{ fontSize: 13, fontWeight: 600, backgroundColor: "#16A34A" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#15803D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#16A34A"; }}>
                          <RotateCcw className="w-3.5 h-3.5" />Reactivate SO
                        </button>
                      </div>
                    )}

                    {/* CTA: Cancelled/Partially Cancelled → Reactivate SO */}
                    {!canUnarchive && canReactivate && (
                      <div className="flex items-center ml-1.5">
                        <button onClick={handleReactivate} className={`flex items-center gap-1.5 text-white rounded-lg transition-colors ${isScrolled ? "h-7 px-2.5" : "h-9 px-3"}`} style={{ fontSize: 13, fontWeight: 600, backgroundColor: "#16A34A" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#15803D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#16A34A"; }}>
                          <RotateCcw className="w-3.5 h-3.5" />Reactivate SO
                        </button>
                      </div>
                    )}

                    {canCancel && !isPostConfirmed && !isDraft && !isUnconfirmed && (
                      <button onClick={() => setCancelModalMode("full")} className={`flex items-center gap-1 ml-1 border border-destructive/30 text-destructive rounded-lg hover:bg-destructive/5 transition-colors ${isScrolled ? "h-7 px-2" : "h-9 px-2.5"}`} style={{ fontSize: 12, fontWeight: 500 }}>
                        <Ban className="w-3 h-3" />Cancel Order
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Row 2: Metadata bar — flat, compact, PO-matched ── */}
                {!isScrolled && (
                  <div
                    className="flex items-center justify-between"
                    style={{
                      margin: "4px 20px 0",
                      padding: "4px 10px",
                      borderRadius: 8,
                      backgroundColor: isClosed ? "color-mix(in srgb, var(--muted-foreground) 4%, transparent)" : "color-mix(in srgb, var(--foreground) 3%, transparent)",
                      border: "none",
                      gap: "0 10px",
                    }}
                  >
                    {/* Left: Description */}
                    <div className="flex items-center min-w-0 flex-1">
                      <DescriptionField soId={so.id} initialDescription={so.description || `Sales order for ${so.customer} — ${so.lines.length} line items`} />
                    </div>
                    {/* Right: Items count + Total */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span style={{ fontSize: 13, color: isClosed ? "color-mix(in srgb, var(--muted-foreground) 50%, transparent)" : "var(--muted-foreground)", lineHeight: 1.3 }}>
                        {so.lines.length} item{so.lines.length !== 1 ? "s" : ""}
                      </span>
                      <div style={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: "color-mix(in srgb, var(--muted-foreground) 25%, transparent)", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: isClosed ? "color-mix(in srgb, var(--muted-foreground) 75%, transparent)" : "var(--foreground)", lineHeight: 1.3 }}>
                        {totalValue >= 100000 ? `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(totalValue).toLowerCase()}` : `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </span>
                    </div>
                  </div>
                )}

                {/* ── Row 3: Lifecycle stepper — NO separate gradient, inherits card gradient ── */}
                {!isScrolled && (
                  <div className="relative" style={{ padding: "10px 20px 12px", overflow: "hidden", borderRadius: "0 0 12px 12px" }}>
                    <div className="relative" style={{ display: "flex", alignItems: "center", width: "100%", padding: "4px 0" }}>
                      {SO_STEPS.map((step, i) => {
                        const Icon = step.icon;
                        let state: "completed" | "current" | "pending" | "terminated" = "pending";
                        if (isTerminalStatus) {
                          if (i <= terminalBranchIndex) state = "completed";
                          else state = "terminated";
                        } else {
                          if (i < currentStepIndex) state = "completed";
                          else if (i === currentStepIndex) state = "current";
                        }
                        const isLast = i === SO_STEPS.length - 1;

                        const greenSolid = "var(--accent)";
                        const greenGlow = "color-mix(in srgb, var(--accent) 18%, transparent)";

                        const circleStyle: React.CSSProperties = state === "completed"
                          ? { backgroundColor: greenSolid, boxShadow: `0 2px 6px ${greenGlow}` }
                          : state === "current"
                            ? { backgroundColor: step.fillColor, boxShadow: `0 0 0 4px color-mix(in srgb, ${step.fillColor} 16%, transparent), 0 2px 8px color-mix(in srgb, var(--foreground) 8%, transparent)` }
                            : state === "terminated"
                              ? { backgroundColor: "transparent", border: "2px solid var(--border)" }
                              : { backgroundColor: "transparent", border: "2px solid var(--border)" };

                        const terminatedTextColor = isTerminalStatus ? "rgba(0,0,0,0.25)" : "var(--muted-foreground)";
                        const terminatedIconColor = isTerminalStatus ? "rgba(0,0,0,0.2)" : "var(--muted-foreground)";

                        return (
                          <div key={step.id} className="contents">
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, padding: "2px 4px" }}>
                              <div style={{
                                width: state === "current" ? 28 : state === "completed" ? 24 : 22,
                                height: state === "current" ? 28 : state === "completed" ? 24 : 22,
                                borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                                ...circleStyle,
                              }}>
                                {state === "completed"
                                  ? <Check style={{ width: 12, height: 12, color: "var(--primary-foreground)" }} strokeWidth={3} />
                                  : <Icon style={{ width: state === "current" ? 14 : 12, height: state === "current" ? 14 : 12, color: state === "current" ? "var(--primary-foreground)" : state === "terminated" ? terminatedIconColor : "var(--muted-foreground)", opacity: state === "pending" ? 0.35 : 1, strokeWidth: state === "current" ? 2.5 : 2 }} />
                                }
                              </div>
                              <span style={{
                                fontSize: 12, whiteSpace: "nowrap", lineHeight: 1, letterSpacing: "-0.01em",
                                fontWeight: state === "current" ? 600 : state === "completed" ? 500 : 450,
                                color: state === "completed" ? greenSolid
                                  : state === "current" ? "var(--foreground)"
                                  : state === "terminated" ? terminatedTextColor
                                  : "var(--muted-foreground)",
                                opacity: state === "pending" ? 0.5 : 1,
                                transition: "all 0.3s ease",
                              }}>
                                {step.label}
                              </span>
                            </div>
                            {!isLast && (
                              <div style={{ flex: "1 1 0%", margin: "0 10px", minWidth: 12, height: 4, position: "relative" }}>
                                {(state === "completed" && (i + 1 <= currentStepIndex || (isTerminalStatus && i + 1 <= terminalBranchIndex))) ? (
                                  <div style={{ position: "absolute", inset: 0, height: 2.5, top: "50%", transform: "translateY(-50%)", borderRadius: 2, backgroundColor: greenSolid }} />
                                ) : (
                                  <div style={{
                                    position: "absolute", inset: 0, height: 2, top: "50%", transform: "translateY(-50%)", borderRadius: 2,
                                    backgroundColor: state === "terminated" ? "rgba(0,0,0,0.08)" : "var(--border)",
                                    WebkitMaskImage: "repeating-linear-gradient(90deg, black 0px, black 5px, transparent 5px, transparent 10px)",
                                    maskImage: "repeating-linear-gradient(90deg, black 0px, black 5px, transparent 5px, transparent 10px)",
                                    opacity: 0.65,
                                  }} />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Terminal state badge */}
                      {isTerminalStatus && terminalConfig && (
                        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 8, padding: "2px 4px" }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                            backgroundColor: terminalConfig.fillColor, boxShadow: `0 2px 6px color-mix(in srgb, ${terminalConfig.fillColor} 18%, transparent)`,
                          }}>
                            <terminalConfig.icon style={{ width: 12, height: 12, color: "var(--primary-foreground)" }} strokeWidth={2.5} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: terminalConfig.fillColor, whiteSpace: "nowrap", lineHeight: 1, letterSpacing: "-0.01em" }}>{terminalConfig.label}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          );
        })()}

        {/* ── Version/Status Banner — above tabs, white bg with colored left accent (Quotes pattern) ── */}
        {statusMessage && (
          <div style={{ padding: "12px var(--space-page-x) 0" }}>
            <div style={{ display: "flex", alignItems: "stretch", borderRadius: 8, backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", overflow: "hidden" }}>
              <div style={{ width: 3, flexShrink: 0, backgroundColor: statusMessage.accentColor }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, padding: "10px 16px", gap: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <statusMessage.icon style={{ width: 13, height: 13, color: statusMessage.accentColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1F2937" }}>{statusMessage.title}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#6B7280", paddingLeft: 19 }}>{statusMessage.subtitle}</span>
                </div>
                {(statusMessage as any).cta && (
                  <button
                    onClick={() => {
                      setPendingVersionChange({ fieldLabel: "Manual Edit", action: () => {} });
                      setAutoVersionField("Manual Edit");
                      setShowAutoVersionConfirm(true);
                    }}
                    className="inline-flex items-center gap-1.5 shrink-0 rounded-lg transition-all"
                    style={{ height: 32, padding: "0 14px", fontSize: 13, fontWeight: 600, backgroundColor: "var(--primary)", color: "#FFFFFF", border: "none", cursor: "pointer" }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                  >
                    <Pencil style={{ width: 13, height: 13 }} /> {(statusMessage as any).cta.label}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab bar — plain underline style ── */}
        <div
          className="relative"
          style={{ padding: "0 var(--space-page-x)", marginTop: 16 }}
        >
          <div
            className="flex items-center overflow-x-auto hide-scrollbar border-b border-border"
            style={{ gap: 0, paddingLeft: 0 }}
          >
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center whitespace-nowrap shrink-0 transition-colors duration-150 relative"
                  style={{
                    gap: 5,
                    padding: "8px 16px 10px",
                    color: isActive ? "var(--primary)" : "var(--muted-foreground)",
                    fontSize: "var(--text-caption)",
                    fontWeight: isActive ? "var(--font-weight-semibold)" : "var(--font-weight-medium)",
                    lineHeight: 1,
                    cursor: "pointer",
                    background: "transparent",
                    border: "none",
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground)"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "var(--muted-foreground)"; }}
                >
                  {tab.label}
                  {tabCounts[tab.id] !== undefined && tabCounts[tab.id] > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        lineHeight: 1,
                        color: isActive ? "var(--primary)" : "var(--muted-foreground)",
                        backgroundColor: isActive ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "color-mix(in srgb, var(--muted-foreground) 10%, transparent)",
                        padding: "3px 6px",
                        borderRadius: 5,
                        minWidth: 18,
                        textAlign: "center" as const,
                      }}
                    >
                      {tabCounts[tab.id]}
                    </span>
                  )}
                  {/* Active underline */}
                  {isActive && (
                    <span className="absolute bottom-0 left-4 right-4" style={{ height: 2, backgroundColor: "var(--primary)", borderRadius: "1px 1px 0 0" }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Context Card moved inside scrollable body */}

        {/* Date Edit Modal */}
        {editingDateType && (
          <DateEditModal
            type={editingDateType}
            isOpen={true}
            onClose={() => setEditingDateType(null)}
            onSave={(config) => {
              setDetailDateConfigs(prev => ({ ...prev, [editingDateType]: config }));
              setEditingDateType(null);
            }}
            initialConfig={detailDateConfigs[editingDateType]}
          />
        )}

        {/* Content + Right Sidebar — connects to tab bar via border-top */}
        <div
          className="flex-1 min-h-0 overflow-y-auto hide-scrollbar"
          style={{ padding: "0 var(--space-page-x)", marginTop: 0 }}
          ref={contentScrollRef}
        >
          {/* Status Context Card now rendered above tabs — removed from here */}
          <div className="flex" style={{ alignItems: "flex-start", gap: "var(--space-card-padding)" }}>
          <div className="flex-1 min-w-0" style={{ paddingTop: 24, paddingBottom: "var(--space-page-x)" }}>
            {activeTab === "lines" && (
              <SOLineGrid so={so} onAddLine={() => {
                  if (requiresNewDraftFirst(so.status)) {
                    setPendingVersionChange({ fieldLabel: "Add Line Item", action: () => setShowAddLine(true) });
                    setAutoVersionField("Add Line Item");
                    setShowAutoVersionConfirm(true);
                  } else setShowAddLine(true);
                }} onAllocateLine={canAllocate ? setAllocationLine : undefined} onAllocateAll={canAllocate ? () => setShowAllocateModal(true) : undefined}
                onDeleteLine={(lineId) => {
                  const line = so.lines.find(l => l.id === lineId);
                  if (requiresNewDraftFirst(so.status)) {
                    setPendingVersionChange({ fieldLabel: "Delete Line Item", oldValue: line?.itemCode, action: () => { const ok = store.deleteSOLine(so.id, lineId); if (!ok) toast.error("Cannot delete line with shipped quantities"); else toast.success("Line removed"); } });
                    setAutoVersionField("Delete Line Item");
                    setShowAutoVersionConfirm(true);
                  } else {
                    const ok = store.deleteSOLine(so.id, lineId); if (!ok) toast.error("Cannot delete line with shipped quantities"); else toast.success("Line removed");
                  }
                }}
                onCancelLines={canCancel ? handleCancelLines : undefined} onConfigureLine={setConfigureLine}
                onUpdateLine={(lineId, updates) => {
                  const line = so.lines.find(l => l.id === lineId);
                  const isMaterial = updates.orderedQty !== undefined || updates.unitPrice !== undefined;
                  if (isMaterial && requiresNewDraftFirst(so.status)) {
                    const oldVal = updates.orderedQty !== undefined ? `Qty: ${line?.orderedQty}` : updates.unitPrice !== undefined ? `$${line?.unitPrice}` : undefined;
                    const newVal = updates.orderedQty !== undefined ? `Qty: ${updates.orderedQty}` : updates.unitPrice !== undefined ? `$${updates.unitPrice}` : undefined;
                    setPendingVersionChange({ fieldLabel: updates.orderedQty !== undefined ? "Quantity" : "Unit Price", oldValue: oldVal, newValue: newVal, action: () => store.updateSOLine(so.id, lineId, updates) });
                    setAutoVersionField(updates.orderedQty !== undefined ? "Quantity" : "Unit Price");
                    setShowAutoVersionConfirm(true);
                  } else {
                    store.updateSOLine(so.id, lineId, updates);
                  }
                }}
                onDuplicateLine={(line) => {
                  if (requiresNewDraftFirst(so.status)) {
                    setPendingVersionChange({ fieldLabel: "Duplicate Line Item", oldValue: line.itemCode, action: () => { store.addSOLine(so.id, { itemCode: line.itemCode, itemName: line.itemName, itemType: line.itemType, orderedQty: line.orderedQty, unitPrice: line.unitPrice, taxRate: line.taxRate }); toast.success(`Duplicated ${line.itemCode}`); } });
                    setAutoVersionField("Duplicate Line Item");
                    setShowAutoVersionConfirm(true);
                  } else {
                    store.addSOLine(so.id, { itemCode: line.itemCode, itemName: line.itemName, itemType: line.itemType, orderedQty: line.orderedQty, unitPrice: line.unitPrice, taxRate: line.taxRate });
                    toast.success(`Duplicated ${line.itemCode}`);
                  }
                }} />
            )}
            {activeTab === "deal" && <DealInformationTab so={so} />}
            {activeTab === "linked" && <LinkedTransactionsTab transactions={so.linkedTransactions} />}
            {activeTab === "comms" && (
              <div className="bg-card rounded-xl border border-border" style={{ padding: "48px var(--space-card-padding)", boxShadow: "var(--elevation-1)" }}>
                <div className="flex flex-col items-center justify-center" style={{ gap: "var(--space-inline-gap)" }}>
                  <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-foreground" style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" }}>Communications</div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-chart-3/10 text-chart-3" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>Coming Soon</span>
                  <div className="text-muted-foreground text-center max-w-[340px]" style={{ fontSize: "var(--text-caption)", lineHeight: 1.5 }}>
                    Track internal notes, customer emails, and external communications related to this sales order.
                  </div>
                </div>
              </div>
            )}
            {activeTab === "activity" && (
              <div className="bg-card rounded-xl border border-border" style={{ padding: "48px var(--space-card-padding)", boxShadow: "var(--elevation-1)" }}>
                <div className="flex flex-col items-center justify-center" style={{ gap: "var(--space-inline-gap)" }}>
                  <div className="w-11 h-11 rounded-lg bg-chart-4/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-chart-4" />
                  </div>
                  <div className="text-foreground" style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" }}>Activity</div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-chart-3/10 text-chart-3" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>Coming Soon</span>
                  <div className="text-muted-foreground text-center max-w-[340px]" style={{ fontSize: "var(--text-caption)", lineHeight: 1.5 }}>
                    View a detailed log of all changes, updates, and actions taken on this sales order.
                  </div>
                </div>
              </div>
            )}
            {activeTab === "shipping" && <ShipmentsTab shipments={soShipments} soId={so.id} so={so} />}
            {activeTab === "invoicing" && <InvoicingTab so={so} />}
            {activeTab === "attachments" && <AttachmentsTab attachments={so.attachments} lines={so.lines} />}
            {activeTab === "versions" && <VersionHistoryTab so={so} />}
            {activeTab === "sourcing" && <SourcingProductionTab so={so} />}
          </div>
          <div className="shrink-0 sticky top-0" style={{ width: 300, paddingTop: 24, paddingBottom: "var(--space-page-x)" }}>
            <SOSidebar so={so} onOpenInvoicing={() => setActiveTab("invoicing")} />
          </div>
          </div>{/* close flex row */}
        </div>
      </div>

      {/* Modals */}
      {allocationLine && <AllocateInventoryModal so={so} onClose={() => setAllocationLine(null)} initialLineId={allocationLine.id} singleLineMode />}
      {showAddLine && <AddLineItemDialog soId={so.id} onClose={() => setShowAddLine(false)} />}
      {showAllocateModal && <AllocateInventoryModal so={so} onClose={() => setShowAllocateModal(false)} />}
      {cancelModalMode && <CancellationModal so={so} mode={cancelModalMode} preselectedLineIds={cancelPreselectedLineIds} onConfirmFull={handleCancelFull} onConfirmPartial={handleCancelPartial} onClose={() => { setCancelModalMode(null); setCancelPreselectedLineIds([]); }} />}
      {configureLine && (
        <AdvancedConfiguratorModal line={configureLine} inventory={store.inventory} onClose={() => setConfigureLine(null)}
          readOnly={configureLine.cancelled}
          isPostDraft={!["Draft"].includes(so.status)}
          onSave={({ orderedQty, unitPrice }) => {
            if (requiresNewDraftFirst(so.status)) {
              const oldVal = `Qty: ${configureLine.orderedQty}, $${configureLine.unitPrice}`;
              const newVal = `Qty: ${orderedQty}, $${unitPrice}`;
              setPendingVersionChange({ fieldLabel: "Line Item Configuration", oldValue: oldVal, newValue: newVal, action: () => { store.updateSOLine(so.id, configureLine.id, { orderedQty, unitPrice }); toast.success(`${configureLine.itemCode} updated`); } });
              setAutoVersionField("Line Item Configuration");
              setConfigureLine(null);
              setShowAutoVersionConfirm(true);
            } else {
              store.updateSOLine(so.id, configureLine.id, { orderedQty, unitPrice }); toast.success(`${configureLine.itemCode} updated`); setConfigureLine(null);
            }
          }}
          onDelete={() => {
            if (requiresNewDraftFirst(so.status)) {
              setPendingVersionChange({ fieldLabel: "Delete Line Item", oldValue: configureLine.itemCode, action: () => { const ok = store.deleteSOLine(so.id, configureLine.id); if (ok) { toast.success(`${configureLine.itemCode} removed`); } else toast.error("Cannot delete line with shipped quantities"); } });
              setAutoVersionField("Delete Line Item");
              setConfigureLine(null);
              setShowAutoVersionConfirm(true);
            } else {
              const ok = store.deleteSOLine(so.id, configureLine.id); if (ok) { toast.success(`${configureLine.itemCode} removed`); setConfigureLine(null); } else toast.error("Cannot delete line with shipped quantities");
            }
          }} />
      )}
      {showConfirmModal && <ConfirmSOModal so={so} onConfirm={() => handleConfirm()} onClose={() => setShowConfirmModal(false)} />}
      {showFulfillmentModal && <FulfillmentModal
        open={showFulfillmentModal}
        so={so}
        onClose={() => setShowFulfillmentModal(false)}
        onConfirm={(deliveryQtys, proofFiles, invoiceNote) => {
          store.deliverSO(so.id, deliveryQtys);
          setShowFulfillmentModal(false);
          if (deliveryQtys) {
            const count = Object.values(deliveryQtys).reduce((s: number, v: any) => s + (v as number), 0);
            toast.success(`${count} unit(s) confirmed delivered — partial fulfillment`);
          } else {
            toast.success("All shipments confirmed delivered — order complete");
          }
          if (proofFiles && proofFiles.length > 0) {
            toast.info(`${proofFiles.length} proof of delivery file(s) attached`);
          }
          if (invoiceNote) {
            toast.info("Payment invoice generated");
          }
        }}
      />}
      {showExportModal && <ExportSOModal
        open={showExportModal}
        so={so}
        onClose={() => setShowExportModal(false)}
      />}
      {showArchiveModal && <ArchiveModal
        so={so}
        onClose={() => setShowArchiveModal(false)}
        onConfirm={() => { handleArchive(); setShowArchiveModal(false); }}
      />}

      {/* Duplicate SO Confirmation */}
      {showDuplicateConfirm && (
        <ConfirmationModal
          isOpen={showDuplicateConfirm}
          title="Duplicate Sales Order?"
          message={`This will create a new Draft Sales Order with all line items copied from ${so.soNumber}. Fulfillment quantities will be reset to zero.`}
          confirmText="Duplicate"
          cancelText="Cancel"
          onConfirm={() => {
            setShowDuplicateConfirm(false);
            const dupLines = so.lines.map(l => ({ ...l, allocatedQty: 0, pickedQty: 0, shippedQty: 0, deliveredQty: 0, cancelled: false, cancelledQty: 0, cancelledReason: undefined, cancelAction: undefined, allocations: [], readyToPick: false }));
            const dup = store.createSO({ customer: so.customer, customerInitials: so.customerInitials, description: `Copy of ${so.soNumber}`, lines: dupLines, warehouse: so.warehouse, currency: so.currency, paymentTerms: so.paymentTerms, shippingAddress: so.shippingAddress, salesRep: so.salesRep, salesReps: so.salesReps, tags: [...so.tags], freightMethod: so.freightMethod, sourceQuoteRef: so.sourceQuoteRef, rfqRef: so.rfqRef, warehouses: [...so.warehouses] });
            toast.success(`Duplicated ${so.soNumber} → ${dup.soNumber}`);
            navigate(`/sales-orders/${dup.id}`);
          }}
          onCancel={() => setShowDuplicateConfirm(false)}
          variant="blue"
          icon={<Copy className="w-6 h-6 text-white" />}
        />
      )}


      {/* Send to Customer Modal */}
      <SendToCustomerModal
        isOpen={showSendToCustomer}
        so={so}
        isResend={isSendResend}
        mode={sendModalMode}
        onClose={() => setShowSendToCustomer(false)}
        onSend={() => {
          setShowSendToCustomer(false);
          if (sendModalMode === "print") {
            // Print triggered — no toast needed
          } else if (isDraft && !isSendResend) {
            if (isReviewer && isOwnSO) {
              toast.success(`${so.soNumber} sent to customer`);
            } else {
              // The SendToCustomerModal already showed the glassmorphism overlay
              // with next state (Pending Review) — suppress StageTransitionOverlay
              suppressNextTransitionRef.current = true;
              store.markUnconfirmed(so.id);
            }
          } else {
            toast.success(`${so.soNumber} resent to customer`);
          }
        }}
      />

      <StageTransitionOverlay status={so.status} suppressNextRef={suppressNextTransitionRef} />

      {/* Version History Modal */}
      {showVersionModal && (
        <VersionHistoryModal
          soNumber={so.soNumber}
          currentVersion={soVersion.number}
          onClose={() => setShowVersionModal(false)}
        />
      )}

      {/* Auto Version Confirm Modal */}
      <AutoVersionConfirmModal
        isOpen={showAutoVersionConfirm}
        fieldLabel={autoVersionField}
        oldValue={pendingVersionChange?.oldValue}
        newValue={pendingVersionChange?.newValue}
        currentVersion={soVersion.number}
        fromStatus={so.status}
        onConfirm={() => {
          setShowAutoVersionConfirm(false);
          setShowAutoVersionOverlay(true);
          // Create the version draft in the store
          store.createVersionDraft(so.id);
          // Apply the pending change after a brief delay for the overlay to show
          const pendingAction = pendingVersionChange?.action;
          setPendingVersionChange(null);
          if (pendingAction) {
            setTimeout(() => pendingAction(), 300);
          }
        }}
        onDiscard={() => {
          setShowAutoVersionConfirm(false);
          setPendingVersionChange(null);
        }}
      />

      {/* Auto Version Overlay */}
      <AutoVersionOverlay
        show={showAutoVersionOverlay}
        newVersion={soVersion.number + 1}
        fromStatus={so.previousStatus || so.status}
        onComplete={() => {
          setShowAutoVersionOverlay(false);
          toast.success(`Version ${soVersion.number} draft created`);
        }}
      />
    </>
  );
}

/* ── Status message config ── */
function getStatusMessage(so: { status: string; cancellationReason?: string; cancellationReasonText?: string; previousStatus?: string; version?: { number: number } }) {
  type IconComponent = typeof Pencil;
  interface StatusMsg { icon: IconComponent; title: string; subtitle: string; accentColor: string; cta?: { label: string; action: string } }
  const v = so.version?.number ?? 1;
  const map: Record<string, StatusMsg | null> = {
    Draft: { icon: Pencil, title: `Editing Version ${v} draft`, subtitle: `Send when ready to finalize as V${v}`, accentColor: "var(--primary)" },
    "Pending Review": { icon: AlertTriangle, title: "Pending Review", subtitle: "Sales Order submitted — awaiting clearance.", accentColor: "var(--chart-3)" },
    Cleared: { icon: Check, title: `Version ${v} confirmed — current active version`, subtitle: `Edit to create V${v + 1} draft, or make a change — material edits auto-version`, accentColor: "var(--primary)", cta: { label: `Edit as V${v + 1}`, action: "createDraft" } },
    Shipped: { icon: Truck, title: `Version ${v} shipped — order complete`, subtitle: `Edit to create V${v + 1} draft, or make a change — material edits auto-version`, accentColor: "var(--accent)", cta: { label: `Edit as V${v + 1}`, action: "createDraft" } },
    "Partially Shipped": { icon: Truck, title: `Version ${v} active — partially shipped`, subtitle: `Edit to create V${v + 1} draft, or make a change — material edits auto-version`, accentColor: "var(--chart-4)", cta: { label: `Edit as V${v + 1}`, action: "createDraft" } },
    Cancelled: { icon: Ban, title: "Order cancelled", subtitle: so.cancellationReason ? `Reason: ${so.cancellationReason}${so.cancellationReasonText ? ` — ${so.cancellationReasonText}` : ""}` : "Already-shipped units remain shipped. Archive to finalize.", accentColor: "var(--destructive)" },
    "Partially Cancelled": { icon: Ban, title: "Line items marked as cancelled", subtitle: "Cancelled lines are frozen. Remaining active lines continue processing.", accentColor: "var(--chart-3)" },
    Archived: { icon: Archive, title: `Archived (previously ${so.previousStatus || "Shipped"})`, subtitle: "Hidden from default listing.", accentColor: "var(--destructive)" },
  };
  return map[so.status] || null;
}

export default SODetail;