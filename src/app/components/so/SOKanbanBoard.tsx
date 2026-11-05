// @ts-nocheck
/* SOKanbanBoard — Kanban view for Sales Orders
   Adapted from Quotes KanbanView with persona-aware drag-drop */
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { summarizeSO } from "./summarizeSO";
import { useNavigate } from "react-router-dom";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import type { SalesOrder, SOStatus } from "./types";
import { SOStatusBadge, SO_STATUS_CSS_VAR } from "./StatusBadge";
import { usePersona } from "./PersonaContext";
import { VersionBadge } from "./VersionBadge";
import { VersionHistoryModal } from "./VersionHistoryModal";
import { ConfirmSOModal } from "./ConfirmSOModal";
import { InactiveItemsWarningModal } from "../shared/InactiveItemsWarningModal";
import { isItemInactive } from "../shared/inactiveItems";
import { getLineItemImage } from "./lineItemImage";
import { ReactivateSOModal } from "./ReactivateSOModal";
import { SO_TRANSITION_VISUALS } from "./StageTransitionOverlay";
import { StateTransitionOverlay } from "@/app/components/shared/StateTransitionOverlay";
import { HighlightText } from "@/app/components/shared/HighlightText";
import {
  Search, ArrowUpDown, GripVertical, Check, CheckCircle, Clock,
  CalendarDays, MoreHorizontal, X, Package, Truck, Box, ArrowUpRight, Send,
  ChevronDown, ChevronRight, ArrowRight, Eye, EyeOff, AlertTriangle, Ban,
  Minimize2,
} from "lucide-react";
import { FIELD_RULES } from "@/app/components/shared/fieldRequirements";

/* ═══ Kanban column definitions — persona-aware ═══ */
const CREATOR_COLUMNS: { status: SOStatus; label: string; dotColor: string; tint: string; tintBorder: string; matchStatuses?: SOStatus[] }[] = [
  { status: "Draft", label: "Draft", dotColor: "#6B7280", tint: "#F9FAFB", tintBorder: "#E5E7EB" },
  { status: "Pending Review", label: "Pending Review", dotColor: "#D97706", tint: "#FFFBEB", tintBorder: "#FDE68A" },
  { status: "Cleared", label: "Released", dotColor: "#1E40AF", tint: "#F8FAFF", tintBorder: "#E8EEFB" },
  { status: "Partially Shipped", label: "Partially Shipped", dotColor: "#7C3AED", tint: "#F5F3FF", tintBorder: "#DDD6FE" },
  { status: "Shipped", label: "Shipped", dotColor: "#16A34A", tint: "#F0FDF4", tintBorder: "#BBF7D0" },
  { status: "Rejected", label: "Rejected", dotColor: "#DC2626", tint: "#FEF2F2", tintBorder: "#FECACA" },
  { status: "Cancelled", label: "Cancelled", dotColor: "#DC2626", tint: "#FEF2F2", tintBorder: "#FECACA", matchStatuses: ["Cancelled", "Partially Cancelled"] },
  { status: "Archived", label: "Archived", dotColor: "#DC2626", tint: "#FEF2F2", tintBorder: "#FECACA" },
];
const OPS_COLUMNS: { status: SOStatus; label: string; dotColor: string; tint: string; tintBorder: string; matchStatuses?: SOStatus[] }[] = [
  { status: "Draft", label: "Draft", dotColor: "#6B7280", tint: "#F9FAFB", tintBorder: "#E5E7EB" },
  { status: "Pending Review", label: "Pending Review", dotColor: "#D97706", tint: "#FFFBEB", tintBorder: "#FDE68A" },
  { status: "Cleared", label: "Released", dotColor: "#1E40AF", tint: "#F8FAFF", tintBorder: "#E8EEFB" },
  { status: "Partially Shipped", label: "Partially Shipped", dotColor: "#7C3AED", tint: "#F5F3FF", tintBorder: "#DDD6FE" },
  { status: "Shipped", label: "Shipped", dotColor: "#16A34A", tint: "#F0FDF4", tintBorder: "#BBF7D0" },
  { status: "Rejected", label: "Rejected", dotColor: "#DC2626", tint: "#FEF2F2", tintBorder: "#FECACA" },
  { status: "Cancelled", label: "Cancelled", dotColor: "#DC2626", tint: "#FEF2F2", tintBorder: "#FECACA", matchStatuses: ["Cancelled", "Partially Cancelled"] },
  { status: "Archived", label: "Archived", dotColor: "#DC2626", tint: "#FEF2F2", tintBorder: "#FECACA" },
  
];

const ALL_CREATOR_STATUSES = CREATOR_COLUMNS.map(c => c.status);

/* ═══ Sort options ═══ */
type SortOption = "Last Updated" | "SO Value" | "Creation Date" | "Line Items";
const SORT_OPTIONS: SortOption[] = ["Last Updated", "SO Value", "Creation Date", "Line Items"];

/* ═══ Avatar palette ═══ */
const AVATAR_TINTS = [
  { bg: "#EDF4FF", fg: "#0A77FF" },
  { bg: "#F0FDF4", fg: "#16A34A" },
  { bg: "#FFF7ED", fg: "#EA580C" },
  { bg: "#F5F3FF", fg: "#7C3AED" },
  { bg: "#ECFEFF", fg: "#0891B2" },
  { bg: "#FFF1F2", fg: "#E11D48" },
  { bg: "#FEF9C3", fg: "#A16207" },
  { bg: "#F0FDFA", fg: "#0D9488" },
];
function getCardAvatarTint(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

const POC_NAMES = ["Meredith", "Toby", "Robert", "Ryan", "Kevin", "Pam", "Holly", "Creed"];
const POC_EXTRA_MAP = [2, 0, 3, 1, 2, 0, 1, 3];

/* ═══ Helpers ═══ */
function daysAgo(dateStr: string): string {
  const parts = dateStr.split("/").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const now = new Date(2026, 2, 9);
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "1 day ago";
  if (diff < 30) return `${diff} days ago`;
  if (diff < 365) {
    const months = Math.floor(diff / 30);
    return `${months} ${months === 1 ? "month" : "months"} ago`;
  }
  const years = Math.floor(diff / 365);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

type SortDir = "asc" | "desc";

/* Sort comparator — compute the "natural descending" delta for the
   chosen criterion, then flip its sign when ascending. Keeping the
   direction multiplier external means criterion and direction stay
   independent (per spec) and we don't duplicate the comparator twice. */
function sortSOs(items: SalesOrder[], sortBy: SortOption, sortDir: SortDir = "desc"): SalesOrder[] {
  const sorted = [...items];
  const dirMul = sortDir === "asc" ? -1 : 1;
  return sorted.sort((a, b) => {
    let delta = 0;
    switch (sortBy) {
      case "Last Updated": {
        const dateA = a.activityLog.length > 0 ? new Date(a.activityLog[a.activityLog.length - 1].timestamp).getTime() : 0;
        const dateB = b.activityLog.length > 0 ? new Date(b.activityLog[b.activityLog.length - 1].timestamp).getTime() : 0;
        delta = dateB - dateA;
        break;
      }
      case "SO Value":
        delta = summarizeSO(b).grandTotal - summarizeSO(a).grandTotal;
        break;
      case "Creation Date": {
        const pa = a.createdDate.split("/").map(Number);
        const pb = b.createdDate.split("/").map(Number);
        delta = new Date(pb[0], pb[1] - 1, pb[2]).getTime() - new Date(pa[0], pa[1] - 1, pa[2]).getTime();
        break;
      }
      case "Line Items":
        delta = b.lines.length - a.lines.length;
        break;
    }
    return delta * dirMul;
  });
}

/* ═══ Current user constant ═══ */
const CURRENT_USER_REP = "Adrian User";

/* ═══ Persona-aware drag rules ═══ */
/**
 * SO kanban drag-drop matrix.
 *
 * Rows = origin status, cols = destination status.
 *   Draft           → Pending Review (Yes)
 *                     Cleared (Yes, w/ clearance modal)
 *                     Cancelled (Yes, w/ cancel modal)
 *   Pending Review  → Cleared (Yes, w/ clearance modal)
 *                     Cancelled (Yes, w/ cancel modal)
 *   Cleared         → Cancelled (Yes, w/ cancel modal)
 *   Partially Shipped → Cancelled (Yes, w/ partial-cancel modal)
 *   Shipped         → nothing (terminal — fulfillment-driven only)
 *   Cancelled       → Draft (Yes, w/ reopen modal)
 *
 * Partially Shipped + Shipped are reached via fulfillment events, not
 * drag-drop, so they are never valid drop targets here. Role gating
 * (creator-only Draft → Pending Review, reviewer-only → Cleared) is
 * preserved from the previous implementation.
 */
function canDropToColumn(fromStatus: SOStatus, toStatus: SOStatus, isCreator: boolean, isReviewer: boolean, soSalesRep?: string): boolean {
  if (fromStatus === toStatus) return false;

  // Fulfillment-driven destinations are never valid drag-drop targets.
  if (toStatus === "Shipped" || toStatus === "Partially Shipped" || toStatus === "Archived") return false;

  // Draft can only be reached as a re-open from Cancelled / Partially Cancelled.
  if (toStatus === "Draft") {
    return fromStatus === "Cancelled" || fromStatus === "Partially Cancelled";
  }

  // Pending Review is reachable only from Draft (and only by creators
  // submitting someone else's order).
  if (toStatus === "Pending Review") {
    if (fromStatus !== "Draft") return false;
    // Reviewer-only persona shouldn't be submitting orders.
    if (isReviewer && !isCreator) return false;
    return soSalesRep !== CURRENT_USER_REP;
  }

  // Cleared is reachable from Draft or Pending Review by a reviewer who
  // didn't author the order.
  if (toStatus === "Cleared") {
    if (fromStatus !== "Draft" && fromStatus !== "Pending Review") return false;
    if (isCreator && !isReviewer) return false;
    return soSalesRep !== CURRENT_USER_REP;
  }

  // Cancelled is reachable from any pre-terminal active state, including
  // Partially Shipped (which routes through the partial-cancel modal).
  if (toStatus === "Cancelled") {
    return fromStatus === "Draft"
        || fromStatus === "Pending Review"
        || fromStatus === "Cleared"
        || fromStatus === "Partially Shipped";
  }

  return false;
}

/* ═══ Status Transition Overlay info ═══
   Shape consumed by the unified StateTransitionOverlay for SO kanban
   drag-drop transitions. Color-by-status is resolved through
   SO_TRANSITION_VISUALS so we stay consistent with the detail page. */
interface TransitionInfo {
  soNumber: string;
  fromStatus: SOStatus;
  toStatus: SOStatus;
}

/* ═══════════════════════════════════════════════════════
   Board Column Config Sidebar
   ═══════════════════════════════════════════════════════ */
interface BoardColumnConfigSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  visibleColumns: SOStatus[];
  onSave: (columns: SOStatus[]) => void;
  allColumns: typeof CREATOR_COLUMNS;
}

export function BoardColumnConfigSidebar({ isOpen, onClose, visibleColumns, onSave, allColumns }: BoardColumnConfigSidebarProps) {
  const [selected, setSelected] = useState<SOStatus[]>(visibleColumns);
  useEffect(() => { setSelected(visibleColumns); }, [visibleColumns]);
  if (!isOpen) return null;
  const toggle = (s: SOStatus) => setSelected(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const visibleCount = selected.length;

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose} />
      <div className="fixed top-0 right-0 h-full bg-white shadow-2xl z-50 flex flex-col" style={{ width: 384, borderLeft: "1px solid #E5E7EB" }}>
        <div className="flex-shrink-0" style={{ padding: "20px 24px", borderBottom: "1px solid #E5E7EB" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1F2937" }}>Configure Board Columns</h3>
            <button onClick={onClose} className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#F3F4F6")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <X style={{ width: 18, height: 18, color: "#6B7280" }} />
            </button>
          </div>
          <p style={{ fontSize: 12, color: "#6B7280", lineHeight: "1.5" }}>{visibleCount} of {allColumns.length} columns visible · Toggle to show or hide</p>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ padding: "16px 24px", scrollbarWidth: "thin" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {allColumns.map(col => {
              const isActive = selected.includes(col.status);
              return (
                <button key={col.status} onClick={() => toggle(col.status)} style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 12px",
                  borderRadius: 8, cursor: "pointer",
                  border: isActive ? "1px solid transparent" : "1px dashed #E5E7EB",
                  backgroundColor: isActive ? "#F7F8F9" : "#FFFFFF", transition: "all 150ms",
                }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = isActive ? "#EFF6FF" : "#F9FAFB"; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = isActive ? "#F7F8F9" : "#FFFFFF"; }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: isActive ? "none" : "2px solid #D1D5DB",
                    backgroundColor: isActive ? col.dotColor : "transparent", transition: "all 150ms",
                  }}>
                    {isActive && <Check style={{ width: 12, height: 12, color: "#FFFFFF" }} />}
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: col.dotColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: isActive ? "#1F2937" : "#6B7280", flex: 1, textAlign: "left" }}>{col.label}</span>
                  {isActive ? <Eye style={{ width: 14, height: 14, color: "#9CA3AF", flexShrink: 0 }} /> : <EyeOff style={{ width: 14, height: 14, color: "#D1D5DB", flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-shrink-0" style={{ padding: "16px 24px", borderTop: "1px solid #E5E7EB" }}>
          <div className="flex items-center justify-between">
            <button onClick={() => setSelected(allColumns.map(c => c.status))} style={{ fontSize: 12, color: "#1B6EF3", fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Select All</button>
            <div className="flex items-center" style={{ gap: 8 }}>
              <button onClick={onClose} style={{ height: 32, padding: "0 16px", fontSize: 13, fontWeight: 500, color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: 6, backgroundColor: "#FFFFFF", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#F9FAFB"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#FFFFFF"; }}
              >Cancel</button>
              <button onClick={() => { onSave(selected); onClose(); }} style={{ height: 32, padding: "0 16px", fontSize: 13, fontWeight: 500, color: "#FFFFFF", border: "none", borderRadius: 6, backgroundColor: "#1B6EF3", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#0D5ED7")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#1B6EF3")}
              >Apply</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   SOKanbanBoard — Main Component
   ═══════════════════════════════════════════════════════ */
interface Props {
  salesOrders: SalesOrder[];
  search: string;
  columnVisibility?: Record<string, boolean>;
  groupBy?: "none" | "salesRep" | "customer" | "priority";
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onStatusChange?: (soId: string, fromStatus: SOStatus, toStatus: SOStatus) => void;
  onCancelRequest?: (so: SalesOrder) => void;
}

export function SOKanbanBoard({ salesOrders, search, columnVisibility = {}, groupBy: groupByProp = "none", isFullscreen = false, onToggleFullscreen, onStatusChange, onCancelRequest }: Props) {
  const navigate = useNavigate();
  const { isCreator, isReviewer } = usePersona();
  const KANBAN_COLUMNS = isReviewer ? OPS_COLUMNS : CREATOR_COLUMNS;

  const [versionHistorySO, setVersionHistorySO] = useState<SalesOrder | null>(null);
  const [transitionInfo, setTransitionInfo] = useState<TransitionInfo | null>(null);

  // Confirm SO modal for clearing ops
  const [confirmSO, setConfirmSO] = useState<SalesOrder | null>(null);
  /* Inactive-items guard for dragging a Draft forward: to Pending Review
     (a submit) or to Cleared (a release). Same modal and rule as the
     detail page, so a drag can't skip the warning a click would show. */
  const [inactiveGuard, setInactiveGuard] = useState<{ so: SalesOrder; mode: "submit" | "release"; run: () => void } | null>(null);
  // Reactivation modal for terminal → Draft
  const [reactivateSO, setReactivateSO] = useState<{ so: SalesOrder; variant: 'cancelled' | 'archived' } | null>(null);

  const groupBy = groupByProp;

  // Column config sidebar
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  // Derive visible columns from parent columnVisibility prop (keys are SOStatus strings)
  const HIDDEN_BY_DEFAULT: SOStatus[] = ["Archived"];
  const visibleColumns = useMemo(() => {
    const hasAnyKey = Object.keys(columnVisibility).some(k => KANBAN_COLUMNS.some(c => c.status === k));
    if (!hasAnyKey) return KANBAN_COLUMNS.filter(c => !HIDDEN_BY_DEFAULT.includes(c.status)).map(c => c.status);
    return KANBAN_COLUMNS.filter(c => columnVisibility[c.status] === true || (!HIDDEN_BY_DEFAULT.includes(c.status) && columnVisibility[c.status] !== false)).map(c => c.status);
  }, [columnVisibility, KANBAN_COLUMNS]);




  const getColumnMeta = useCallback((status: SOStatus) => {
    const col = KANBAN_COLUMNS.find(c => c.status === status);
    return col ? { label: col.label, color: col.dotColor } : { label: status, color: "#6B7280" };
  }, [KANBAN_COLUMNS]);

  const handleDrop = useCallback((soId: string, fromStatus: SOStatus, toStatus: SOStatus) => {
    if (fromStatus === toStatus) return;
    const so = salesOrders.find(s => s.id === soId);
    if (!so) return;

    // If dropping to Cancelled, show cancellation modal via parent
    if (toStatus === "Cancelled") {
      onCancelRequest?.(so);
      return;
    }

    const draftHasInactive = fromStatus === "Draft" && so.lines.some((l) => !l.cancelled && isItemInactive(l.itemCode));

    // If clearing for ops, show confirm modal
    if (toStatus === "Cleared") {
      if (draftHasInactive) setInactiveGuard({ so, mode: "release", run: () => setConfirmSO(so) });
      else setConfirmSO(so);
      return;
    }

    // If dragging terminal states back to Draft, show reactivation modal
    if (toStatus === "Draft" && (fromStatus === "Cancelled" || fromStatus === "Partially Cancelled" || fromStatus === "Archived")) {
      const variant = fromStatus === "Archived" ? "archived" : "cancelled";
      setReactivateSO({ so, variant });
      return;
    }

    // For other transitions (e.g. Draft → Pending Review), call parent and show overlay
    const advance = () => {
      onStatusChange?.(soId, fromStatus, toStatus);
      setTransitionInfo({ soNumber: so.soNumber, fromStatus, toStatus });
    };
    if (draftHasInactive && toStatus === "Pending Review") setInactiveGuard({ so, mode: "submit", run: advance });
    else advance();
  }, [salesOrders, onStatusChange, onCancelRequest]);

  const filtered = useMemo(() => {
    let list = salesOrders;
    const q = search.toLowerCase();
    if (q) list = list.filter(so => so.soNumber.toLowerCase().includes(q) || (so.customer || "").toLowerCase().includes(q) || (so.salesRep || "").toLowerCase().includes(q));
    return list;
  }, [salesOrders, search]);


  const containerStyle: React.CSSProperties = {
    display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 0,
    // `overflow: hidden` keeps the wrapper itself viewport-bound; without
    // this the flex item happily grows to fit all columns and the inner
    // `overflow-x-auto` scrollbar never appears. Matches the Quote kanban
    // outer wrapper exactly.
    overflow: "hidden",
    // Gray board surface — matches Quote kanban (`#F7F8F9`). Sets the
    // colour behind the column cards so the columns read as floating
    // panels on a neutral backdrop.
    backgroundColor: "#F7F8F9",
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div style={containerStyle}>


        {/* Kanban board surface — viewport-locked architecture
            (mirrors Quotes KanbanView for cross-module parity).
            Horizontal scroll lives here; vertical scroll lives inside
            each column's body. `items-stretch` forces full column
            height so footers anchor at the bottom of empty columns. */}
        <div
          className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#D1D5DB #F3F4F6" }}
        >
          <div className="flex items-stretch h-full" style={{ padding: "20px", gap: 14 }}>
            {KANBAN_COLUMNS.filter(col => visibleColumns.includes(col.status)).map(column => {
              const matchStatuses = column.matchStatuses || [column.status];
              let items = filtered.filter(so => matchStatuses.includes(so.status));
              return (
                <KanbanColumn
                  key={column.status}
                  status={column.status}
                  label={column.label}
                  dotColor={column.dotColor}
                  tint={column.tint}
                  tintBorder={column.tintBorder}
                  orders={items}
                  allOrders={filtered}
                  groupBy={groupBy}
                  onDrop={handleDrop}
                  onOrderClick={(id) => navigate(`/sales-orders/${id}`)}
                  search={search}
                  isCreator={isCreator}
                  isReviewer={isReviewer}
                  onVersionHistory={setVersionHistorySO}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Transition overlay — unified across modules */}
      {transitionInfo && (() => {
        const visual = SO_TRANSITION_VISUALS[transitionInfo.toStatus];
        return (
          <StateTransitionOverlay
            isActive={true}
            fromLabel={transitionInfo.fromStatus}
            toLabel={visual?.label ?? transitionInfo.toStatus}
            tone={visual?.tone ?? "neutral"}
            Icon={visual?.Icon}
            heading={visual?.heading}
            meta={transitionInfo.soNumber}
            onComplete={() => setTransitionInfo(null)}
          />
        );
      })()}

      <InactiveItemsWarningModal
        open={!!inactiveGuard}
        mode={inactiveGuard?.mode ?? "submit"}
        lines={(inactiveGuard?.so.lines ?? [])
          .filter((l) => !l.cancelled)
          .map((l) => ({ id: l.id, code: l.itemCode, name: l.itemName, image: getLineItemImage(l.itemCode) }))}
        noun="sales order"
        onClose={() => setInactiveGuard(null)}
        onConfirm={() => {
          const pending = inactiveGuard;
          setInactiveGuard(null);
          pending?.run();
        }}
      />

      {/* Confirm SO modal for clearing */}
      {confirmSO && (
        <ConfirmSOModal
          so={confirmSO}
          onClose={() => setConfirmSO(null)}
          onConfirm={() => {
            onStatusChange?.(confirmSO.id, confirmSO.status, "Cleared");
            setTransitionInfo({ soNumber: confirmSO.soNumber, fromStatus: confirmSO.status, toStatus: "Cleared" });
            setConfirmSO(null);
          }}
        />
      )}

      {/* Reactivation modal for terminal → Draft */}
      {reactivateSO && (
        <ReactivateSOModal
          soNumber={reactivateSO.so.soNumber}
          customerName={reactivateSO.so.customer}
          currentVersion={reactivateSO.so.version?.number ?? 1}
          previousStatus={reactivateSO.so.status}
          variant={reactivateSO.variant}
          onClose={() => setReactivateSO(null)}
          onConfirm={() => {
            onStatusChange?.(reactivateSO.so.id, reactivateSO.so.status, "Draft");
            setTransitionInfo({ soNumber: reactivateSO.so.soNumber, fromStatus: reactivateSO.so.status, toStatus: "Draft" });
            setReactivateSO(null);
          }}
        />
      )}

      {versionHistorySO && <VersionHistoryModal soNumber={versionHistorySO.soNumber} currentVersion={versionHistorySO.version?.number ?? 1} onClose={() => setVersionHistorySO(null)} />}

      {/* Column Config Sidebar */}
      <BoardColumnConfigSidebar isOpen={showColumnConfig} onClose={() => setShowColumnConfig(false)} visibleColumns={visibleColumns} onSave={() => {}} allColumns={KANBAN_COLUMNS} />
    </DndProvider>
  );
}

/* ═══════════════════════════════════════════════════════
   KanbanColumn — with drop zone
   ═══════════════════════════════════════════════════════ */
interface KanbanColumnProps {
  status: SOStatus;
  label: string;
  dotColor: string;
  tint: string;
  tintBorder: string;
  orders: SalesOrder[];
  allOrders: SalesOrder[];
  groupBy: "none" | "salesRep" | "customer" | "priority";
  onDrop: (soId: string, fromStatus: SOStatus, toStatus: SOStatus) => void;
  onOrderClick: (id: string) => void;
  search: string;
  isCreator: boolean;
  isReviewer: boolean;
  onVersionHistory: (so: SalesOrder) => void;
}

function KanbanColumn({ status, label, dotColor, tint, tintBorder, orders, allOrders, groupBy, onDrop, onOrderClick, search, isCreator, isReviewer, onVersionHistory }: KanbanColumnProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [showSort, setShowSort] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("Last Updated");
  /* Direction is independent of the criterion — picking Asc/Desc never
     clears the criterion and vice versa. Descending is the default per
     the design spec, matching Quote KanbanColumn. */
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // Load-more pagination — applies to every column. Each column starts with
  // the first 40 cards visible; clicking "Show N more" reveals 40 more,
  // until everything is in view. Same pattern as the Quote KanbanView so
  // long pipelines stay scrollable on both sides.
  const PAGE_SIZE = 40;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const toggleGroupCollapse = (name: string) => {
    setCollapsedGroups(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  };

  const [{ isOver, canDrop: canDropHere }, drop] = useDrop(() => ({
    accept: "SO_CARD",
    drop: (item: { soId: string; currentStatus: SOStatus; salesRep: string }) => {
      if (item.currentStatus !== status) onDrop(item.soId, item.currentStatus, status);
    },
    canDrop: (item: { soId: string; currentStatus: SOStatus; salesRep: string }) => canDropToColumn(item.currentStatus, status, isCreator, isReviewer, item.salesRep),
    collect: (monitor) => ({ isOver: monitor.isOver(), canDrop: monitor.canDrop() }),
  }), [status, isCreator, isReviewer, onDrop]);

  /* Column total = sum of grand totals so the Kanban header agrees
     with the SO listing's grand-total column for the same records. */
  const totalValue = orders.reduce((s, so) => s + summarizeSO(so).grandTotal, 0);

  let processedOrders = orders;
  const activeSearch = localSearch || search;
  if (activeSearch) {
    const q = activeSearch.toLowerCase();
    processedOrders = orders.filter(so => so.soNumber.toLowerCase().includes(q) || (so.customer || "").toLowerCase().includes(q) || (so.salesRep || "").toLowerCase().includes(q));
  }
  processedOrders = sortSOs(processedOrders, sortBy, sortDir);

  const groupedOrders = (() => {
    if (groupBy === "none") return { All: processedOrders };
    const acc = processedOrders.reduce((m, so) => {
      const key = groupBy === "salesRep"
        ? (so.salesRep || FIELD_RULES.salesRep.emptyLabel)
        : groupBy === "customer"
          ? so.customer
          : (so.priority ?? "Standard");
      if (!m[key]) m[key] = [];
      m[key].push(so);
      return m;
    }, {} as Record<string, SalesOrder[]>);

    /* Priority groupings have a canonical lifecycle order
       (Low → Standard → High, ascending). Object insertion order is
       preserved in modern JS, so we rebuild the bucket in that order
       and let `sortDir` flip it when descending. Non-canonical
       buckets (if data ever surfaces them) are appended at the end so
       no rows are dropped. */
    if (groupBy === "priority") {
      const order = ["Low", "Standard", "High"];
      const ordered: Record<string, SalesOrder[]> = {};
      const keys = (sortDir === "desc" ? [...order].reverse() : order)
        .filter(k => acc[k]);
      keys.forEach(k => { ordered[k] = acc[k]; });
      Object.keys(acc).forEach(k => { if (!ordered[k]) ordered[k] = acc[k]; });
      return ordered;
    }
    return acc;
  })();

  const isDropHighlight = isOver && canDropHere;

  return (
    <div ref={drop} className="flex-shrink-0 flex flex-col h-full" style={{ width: 308, minWidth: 308 }}>
      {/* Column Header — pinned to the top of the column. Lives OUTSIDE
          the scrollable body so it never moves when cards scroll. The
          board's outer wrapper owns horizontal scroll; the body below
          owns vertical scroll. */}
      <div className="shrink-0" style={{
        backgroundColor: "#FFFFFF",
        borderTop: `1px solid ${isDropHighlight ? dotColor : "#E5E7EB"}`,
        borderLeft: `1px solid ${isDropHighlight ? dotColor : "#E5E7EB"}`,
        borderRight: `1px solid ${isDropHighlight ? dotColor : "#E5E7EB"}`,
        borderRadius: "10px 10px 0 0", padding: "12px 14px",
        transition: "border-color 200ms ease",
      }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: dotColor }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1F2937" }}>{label}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", backgroundColor: "#F3F4F6", borderRadius: 10, padding: "1px 8px", lineHeight: "1.6" }}>{orders.length}</span>
          </div>
          <div className="flex items-center" style={{ gap: 2 }}>
            <button onClick={() => setShowSearch(!showSearch)} className="w-7 h-7 flex items-center justify-center transition-colors" style={{ borderRadius: 4, backgroundColor: showSearch ? "#F3F4F6" : "transparent", border: "none", cursor: "pointer" }}
              onMouseEnter={e => !showSearch && (e.currentTarget.style.backgroundColor = "#F3F4F6")}
              onMouseLeave={e => !showSearch && (e.currentTarget.style.backgroundColor = "transparent")}
            ><Search style={{ width: 14, height: 14, color: "#9CA3AF" }} /></button>
            <div className="relative">
              <button onClick={() => setShowSort(!showSort)} className="w-7 h-7 flex items-center justify-center transition-colors" style={{ borderRadius: 4, backgroundColor: showSort ? "#F3F4F6" : "transparent", border: "none", cursor: "pointer" }}
                onMouseEnter={e => !showSort && (e.currentTarget.style.backgroundColor = "#F3F4F6")}
                onMouseLeave={e => !showSort && (e.currentTarget.style.backgroundColor = "transparent")}
              ><ArrowUpDown style={{ width: 14, height: 14, color: (sortBy !== "Last Updated" || sortDir !== "desc") ? "#0A77FF" : "#9CA3AF" }} /></button>
              {showSort && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSort(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[#E5E7EB] shadow-lg z-20 py-1" style={{ borderRadius: 8 }}>
                    <div className="px-3 py-2 text-[11px] text-[#6B7280] uppercase tracking-wide" style={{ fontWeight: 500 }}>Sort By</div>
                    {SORT_OPTIONS.map(opt => (
                      /* Criterion click only updates the criterion — the
                         direction selection (below the divider) is kept
                         intact. Dropdown stays open so the user can pick
                         both in one pass. */
                      <button key={opt} onClick={() => setSortBy(opt)}
                        className="w-full px-3 py-2 text-left text-[13px] hover:bg-[#F9FAFB] transition-colors flex items-center justify-between"
                        style={{ color: sortBy === opt ? "#1B6EF3" : "#374151", border: "none", backgroundColor: "transparent", cursor: "pointer" }}
                      >{opt}{sortBy === opt && <span style={{ color: "#1B6EF3" }}>✓</span>}</button>
                    ))}
                    {/* Divider between criterion options and direction options */}
                    <div className="my-1 h-px bg-[#E5E7EB]" />
                    {([
                      { value: "desc", label: "Descending" },
                      { value: "asc",  label: "Ascending" },
                    ] as const).map(opt => (
                      <button key={opt.value} onClick={() => setSortDir(opt.value)}
                        className="w-full px-3 py-2 text-left text-[13px] hover:bg-[#F9FAFB] transition-colors flex items-center justify-between"
                        style={{ color: sortDir === opt.value ? "#1B6EF3" : "#374151", border: "none", backgroundColor: "transparent", cursor: "pointer" }}
                      >{opt.label}{sortDir === opt.value && <span style={{ color: "#1B6EF3" }}>✓</span>}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button className="w-7 h-7 flex items-center justify-center transition-colors cursor-grab active:cursor-grabbing" style={{ borderRadius: 4, border: "none", backgroundColor: "transparent" }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#F3F4F6")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
            ><GripVertical style={{ width: 14, height: 14, color: "#9CA3AF" }} /></button>
          </div>
        </div>

        {showSearch && (
          <div style={{ marginBottom: 10 }}>
            <input type="text" value={localSearch} onChange={e => setLocalSearch(e.target.value)}
              placeholder="Search orders..." autoFocus
              className="w-full h-8 px-3 text-[13px] border border-[#E5E7EB] focus:outline-none focus:border-[#1B6EF3] bg-white transition-colors"
              style={{ borderRadius: 6 }}
            />
          </div>
        )}

        <div className="flex items-center justify-between" style={{ padding: "8px 12px", backgroundColor: "#F9FAFB", borderRadius: 6 }}>
          <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>Total Value</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1F2937" }}>${totalValue.toLocaleString()}</span>
        </div>
      </div>

      {/* Column Body — owns vertical scroll independently. `flex-1
          min-h-0` lets it fill the column's remaining height; cards
          scroll without dragging the header off-screen.
          `overscrollBehaviorY: contain` keeps VERTICAL over-scroll
          from bubbling out, while leaving the X axis on `auto` so a
          horizontal trackpad swipe / shift-wheel inside the column
          still pans the board. The previous shorthand `contain` also
          contained the X axis and caused horizontal kinetic scroll
          to dead-end on the column. */}
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        style={{
          position: "relative", zIndex: 0,
          backgroundColor: isDropHighlight ? `${dotColor}08` : tint,
          borderLeft: `1px solid ${isDropHighlight ? dotColor : tintBorder}`,
          borderRight: `1px solid ${isDropHighlight ? dotColor : tintBorder}`,
          borderBottom: `1px solid ${isDropHighlight ? dotColor : tintBorder}`,
          borderRadius: "0 0 10px 10px", padding: 8,
          transition: "background-color 250ms ease, border-color 200ms ease",
          scrollbarWidth: "thin",
          scrollbarColor: "#D1D5DB transparent",
          overscrollBehaviorY: "contain",
          overscrollBehaviorX: "auto",
        }}
        onWheel={(e) => {
          /* Belt-and-suspenders: if the wheel event carries a
             horizontal delta, forward it to the board's nearest
             `overflow-x: auto` ancestor. See KanbanView.tsx for the
             rationale. */
          if (!e.deltaX || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
          let node: HTMLElement | null = e.currentTarget.parentElement;
          while (node) {
            const cs = window.getComputedStyle(node);
            if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && node.scrollWidth > node.clientWidth) {
              node.scrollLeft += e.deltaX;
              break;
            }
            node = node.parentElement;
          }
        }}
      >
        {(() => {
          // Apply the global per-column visible cap by slicing each group
          // off the running offset, so the last visible group anchors the
          // "Show N more" button.
          const totalCards = processedOrders.length;
          const cap = Math.min(visibleCount, totalCards);
          const remaining = Math.max(0, totalCards - cap);
          const groupEntries = Object.entries(groupedOrders);
          let runningOffset = 0;
          return (
            <>
              {groupEntries.map(([groupName, groupItems], gIdx) => {
                const isCollapsed = collapsedGroups.has(groupName);
                const groupOffset = runningOffset;
                runningOffset += groupItems.length;
                const groupBudget = Math.max(0, cap - groupOffset);
                const displayItems = groupItems.slice(0, groupBudget);
                const isLastGroup = gIdx === groupEntries.length - 1;
                const nextChunk = Math.min(PAGE_SIZE, remaining);
                return (
                  <div key={groupName} style={{ marginBottom: groupBy !== "none" ? 8 : 0 }}>
                    {groupBy !== "none" && (
                      <button onClick={() => toggleGroupCollapse(groupName)} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        width: "100%", padding: "7px 10px", marginBottom: isCollapsed ? 0 : 6,
                        cursor: "pointer", background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 6,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)", transition: "all 150ms",
                      }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)"; e.currentTarget.style.borderColor = "#D1D5DB"; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"; e.currentTarget.style.borderColor = "#E5E7EB"; }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{groupName}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", backgroundColor: "#F3F4F6", borderRadius: 10, padding: "1px 6px", lineHeight: "1.5", flexShrink: 0 }}>{groupItems.length}</span>
                        </div>
                        <ChevronRight style={{ width: 12, height: 12, color: "#9CA3AF", flexShrink: 0, transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)", transition: "transform 150ms ease" }} />
                      </button>
                    )}
                    {!isCollapsed && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {displayItems.map((so, idx) => (
                          <SOKanbanCard key={so.id} so={so} soIdx={idx} columnStatus={status} accentColor={dotColor} onOrderClick={onOrderClick} search={activeSearch} isCreator={isCreator} isReviewer={isReviewer} onVersionHistory={onVersionHistory} />
                        ))}
                        {isLastGroup && remaining > 0 && (
                          <button
                            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                              width: "100%", padding: "10px 12px",
                              background: "rgba(255,255,255,0.85)", border: "1px dashed #D1D5DB", borderRadius: 8,
                              cursor: "pointer", transition: "all 150ms",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = "#9CA3AF"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,1)"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.85)"; }}
                          >
                            <ChevronDown style={{ width: 14, height: 14, color: "#6B7280" }} />
                            <span style={{ fontSize: 12, fontWeight: 500, color: "#6B7280" }}>
                              Show {nextChunk} more {nextChunk === 1 ? "order" : "orders"}
                            </span>
                          </button>
                        )}
                        {isLastGroup && visibleCount > PAGE_SIZE && (
                          <button
                            onClick={() => setVisibleCount(PAGE_SIZE)}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center",
                              width: "100%", padding: "6px 12px",
                              background: "transparent", border: "none", borderRadius: 8, cursor: "pointer",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.7)"; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
                          >
                            <span style={{ fontSize: 11, fontWeight: 500, color: "#9CA3AF" }}>Show less</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          );
        })()}
        {processedOrders.length === 0 && (
          <div className="flex items-center justify-center py-12 text-[13px] text-[#9CA3AF]">
            {activeSearch ? "No matching orders" : "No orders in this stage"}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SOKanbanCard — draggable card with hover-expand
   ═══════════════════════════════════════════════════════ */
interface SOKanbanCardProps {
  so: SalesOrder;
  soIdx: number;
  columnStatus: SOStatus;
  accentColor: string;
  onOrderClick: (id: string) => void;
  search: string;
  isCreator: boolean;
  isReviewer: boolean;
  onVersionHistory: (so: SalesOrder) => void;
}

function SOKanbanCard({ so, soIdx, columnStatus, accentColor, onOrderClick, search, isCreator, isReviewer, onVersionHistory }: SOKanbanCardProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "SO_CARD",
    item: { soId: so.id, currentStatus: so.status, salesRep: so.salesRep },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }));

  const [isHovered, setIsHovered] = useState(false);
  const [versionBadgeHovered, setVersionBadgeHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setIsHovered(true), 60);
  };
  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(false);
  };
  useEffect(() => { return () => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); }; }, []);

  const custTint = getCardAvatarTint(so.customer);
  const repTint = getCardAvatarTint(so.salesRep);
  const repInitials = (so.salesRep || "").split(" ").map(w => w[0]).join("").slice(0, 2);
  const versionNum = so.version?.number ?? 1;
  const priority = so.priority ?? "Standard";

  const activeLines = so.lines.filter(l => !l.cancelled);
  const totalOrdered = activeLines.reduce((s, l) => s + l.orderedQty, 0);
  const totalAllocated = activeLines.reduce((s, l) => s + l.allocatedQty, 0);
  const totalShippedVal = activeLines.reduce((s, l) => s + l.shippedQty, 0);

  const dueDate = (() => {
    const parts = so.requestedDeliveryDate?.split("/").map(Number);
    if (!parts || parts.length < 3) return "—";
    try { return `${String(parts[1]).padStart(2, "0")}/${String(parts[2]).padStart(2, "0")}/${parts[0]}`; } catch { return "—"; }
  })();

  /* Real contacts when the record carries them (an empty list means
     none on file); the demo names only for records that predate
     `pocs`. */
  const recordPocs = so.pocs;
  const recordPrimary = recordPocs?.find(p => p.id === so.primaryPocId) ?? recordPocs?.find(p => p.isPrimary) ?? recordPocs?.[0];
  const pocName = recordPocs ? (recordPrimary?.name ?? "") : POC_NAMES[soIdx % POC_NAMES.length];
  const extraPocNames = recordPocs
    ? recordPocs.filter(p => p !== recordPrimary).slice(0, 2).map(p => p.name)
    : Array.from({ length: POC_EXTRA_MAP[soIdx % POC_EXTRA_MAP.length] }, (_, i) => POC_NAMES[(soIdx + i + 1) % POC_NAMES.length]);
  const pocExtraCount = recordPocs
    ? Math.max(0, recordPocs.length - 1 - extraPocNames.length)
    : extraPocNames.length;

  // Status footer
  const getStatusFooter = () => {
    const daysSince = daysAgo(so.orderDate);
    if (columnStatus === "Shipped") return { icon: <CheckCircle style={{ width: 11, height: 11 }} />, text: `Shipped ${daysSince}`, color: "#16A34A" };
    if (columnStatus === "Cancelled") return { icon: <Ban style={{ width: 11, height: 11 }} />, text: `Cancelled ${daysSince}`, color: "#DC2626" };
    if (columnStatus === "Pending Review") return { icon: <Clock style={{ width: 11, height: 11 }} />, text: `Submitted ${daysSince}`, color: "#D97706" };
    if (columnStatus === "Cleared") return { icon: <CheckCircle style={{ width: 11, height: 11 }} />, text: `Cleared ${daysSince}`, color: "#1E40AF" };
    if (columnStatus === "Draft") {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const parts = so.orderDate?.split("/").map(Number);
      const d = parts && parts.length >= 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : null;
      const text = d && !isNaN(d.getTime())
        ? `Created on ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
        : "Created";
      return { icon: <Clock style={{ width: 11, height: 11 }} />, text, color: "#6B7280" };
    }
    return { icon: <Clock style={{ width: 11, height: 11 }} />, text: `Created ${daysSince}`, color: "#6B7280" };
  };
  const footer = getStatusFooter();

  return (
    <div
      ref={drag}
      className={`cursor-move ${isDragging ? "opacity-30 scale-95" : ""}`}
      style={{
        position: "relative", backgroundColor: isHovered ? "#FAFBFC" : "#FFFFFF",
        borderRadius: 10, border: `1px solid ${isHovered ? "#CBD5E1" : "#E2E8F0"}`,
        boxShadow: isHovered ? "0 6px 16px -4px rgba(15,23,42,0.10), 0 2px 4px rgba(15,23,42,0.04)" : "0 1px 2px rgba(15,23,42,0.04)",
        transform: isHovered && !isDragging ? "translateY(-1px)" : "translateY(0)",
        transition: "all 200ms ease",
        overflow: "hidden",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      /* Tap anywhere on the card opens the SO detail page. Interactive
         children (version badge, action menus, etc.) early-return below
         so inline controls still work. */
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest('button, input, select, a, [role="button"], [data-no-card-click]')) return;
        if (isDragging) return;
        onOrderClick(so.id);
      }}
    >
      <div style={{ height: 2, backgroundColor: accentColor, opacity: isHovered ? 1 : 0.4, transition: "opacity 200ms ease" }} />
      <div style={{ padding: 14 }}>
        {/* Row 1: SO# + Version */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: "#9CA3AF", lineHeight: "1", letterSpacing: "0.2px" }}>
            <HighlightText text={so.soNumber} searchTerm={search} />
          </span>
          <div onClick={(e) => e.stopPropagation()}>
            {/* Always reserve arrow space — pill no longer resizes on hover.
                Matches Quote kanban + listing parity. */}
            <VersionBadge version={versionNum} compact showExpandIcon onClick={(e) => { e.stopPropagation(); onVersionHistory(so); }} />
          </div>
        </div>

        {/* Row 2: Customer + description */}
        <div style={{ cursor: "pointer", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: custTint.bg, color: custTint.fg, fontSize: 9, fontWeight: 600 }}>
              {(so.customer || "").split(" ").map(w => w[0]).join("").slice(0, 2)}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: "1.4" }}>
              <HighlightText text={so.customer} searchTerm={search} />
            </span>
          </div>
          {so.description && <div style={{ fontSize: "11.5px", color: "#9CA3AF", lineHeight: "1.4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}><HighlightText text={so.description} searchTerm={search} /></div>}
        </div>

        {/* Row 3: Value + Priority */}
        <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            {/* Order Value on the card = grand total, same number the
                listing's `Order Value` column and the detail sidebar's
                Grand Total tile render. */}
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1F2937", lineHeight: "1.2" }}>${summarizeSO(so).grandTotal.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 400, marginTop: 2, lineHeight: "1" }}>Order Value</div>
          </div>
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "2px 10px", borderRadius: 999, fontSize: 10, fontWeight: 500,
              backgroundColor: priority === "High" ? "#FEF2F2" : priority === "Standard" ? "#EFF6FF" : "#F1F5F9",
              color: priority === "High" ? "#991B1B" : priority === "Standard" ? "#1E40AF" : "#475569",
              border: `1px solid ${priority === "High" ? "#FECACA" : priority === "Standard" ? "#BFDBFE" : "#E2E8F0"}`,
            }}>{priority}</span>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 400, marginTop: 2, lineHeight: "1" }}>Priority</div>
          </div>
        </div>

        {/* Row 4: Fulfillment Progress — minimal stacked */}
        <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 10, marginBottom: 4, display: "flex", alignItems: "flex-start", gap: 16 }}>
          {(() => {
            const totalPicked = activeLines.reduce((s, l) => s + l.pickedQty, 0);
            const stats = [
              { label: "ALLOCATED", value: totalAllocated, color: "#1E40AF" },
              { label: "PICKED", value: totalPicked, color: "#D97706" },
              { label: "SHIPPED", value: totalShippedVal, color: "#16A34A" },
            ];
            return stats.map(st => (
              <div key={st.label} style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 500, color: "#B0B5BD", textTransform: "uppercase" as const, letterSpacing: "0.4px", lineHeight: 1 }}>{st.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: st.color, lineHeight: 1 }} className="tabular-nums">{st.value}<span style={{ fontSize: 10, fontWeight: 400, color: "#B0B5BD" }}>/{totalOrdered}</span></span>
              </div>
            ));
          })()}
        </div>

        {/* Row 5: Footer — status context */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #F1F5F9", paddingTop: 10, marginTop: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: footer.color }}>{footer.icon}<span style={{ fontSize: 11, fontWeight: 500 }}>{footer.text}</span></div>
        </div>

        {/* Row 5: Hover expand — Sales Rep + PoCs */}
        {isHovered && (
          <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 10, marginTop: 10, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 500, lineHeight: "1" }}>Sales Representative</span>
              {so.salesRep ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: repTint.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: repTint.fg, flexShrink: 0 }}>{repInitials}</div>
                <span style={{ fontSize: 11, color: "#374151", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <HighlightText text={so.salesRep} searchTerm={search} />
                </span>
              </div>
              ) : (
                <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>{FIELD_RULES.salesRep.emptyLabel}</span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end", flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 500, lineHeight: "1" }}>Point of Contacts</span>
              {!pocName ? (
                <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>{FIELD_RULES.poc.emptyLabel}</span>
              ) : (
              <div style={{ display: "flex", alignItems: "center" }}>
                <div title={pocName} style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "#1E40AF", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, border: "2px solid #FFFFFF", position: "relative", zIndex: 5, flexShrink: 0 }}>{pocName.charAt(0)}</div>
                {extraPocNames.map((name, i) => {
                  const t = getCardAvatarTint(name);
                  return (
                    <div key={i} title={name} style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: t.bg, color: t.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, border: "2px solid #FFFFFF", marginLeft: -6, position: "relative", zIndex: 4 - i, flexShrink: 0 }}>{name.charAt(0)}</div>
                  );
                })}
                {pocExtraCount > 0 && (
                  <div title={`${pocExtraCount} more`} style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "#F59E0B", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, border: "2px solid #FFFFFF", marginLeft: -6, position: "relative", zIndex: 0, flexShrink: 0 }}>+{pocExtraCount}</div>
                )}
              </div>
              )}
            </div>
          </div>
        )}

        {/* Sub-status badge */}
        {so.status !== columnStatus && <div style={{ marginTop: 8 }}><SOStatusBadge status={so.status} /></div>}
      </div>
    </div>
  );
}
