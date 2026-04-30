// @ts-nocheck
/* SOKanbanBoard — Kanban view for Sales Orders
   Adapted from Quotes KanbanView with persona-aware drag-drop */
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import type { SalesOrder, SOStatus } from "./types";
import { SOStatusBadge, SO_STATUS_CSS_VAR } from "./StatusBadge";
import { usePersona } from "./PersonaContext";
import { VersionBadge } from "./VersionBadge";
import { VersionHistoryModal } from "./VersionHistoryModal";
import { ConfirmSOModal } from "./ConfirmSOModal";
import { ReactivateSOModal } from "./ReactivateSOModal";
import {
  Search, ArrowUpDown, GripVertical, Check, CheckCircle, Clock,
  CalendarDays, MoreHorizontal, X, Package, Truck, Box, ArrowUpRight, Send,
  ChevronDown, ChevronRight, ArrowRight, Eye, EyeOff, AlertTriangle, Ban,
  Minimize2,
} from "lucide-react";

/* ═══ Kanban column definitions — persona-aware ═══ */
const CREATOR_COLUMNS: { status: SOStatus; label: string; dotColor: string; tint: string; tintBorder: string; matchStatuses?: SOStatus[] }[] = [
  { status: "Draft", label: "Draft", dotColor: "#6B7280", tint: "#F9FAFB", tintBorder: "#E5E7EB" },
  { status: "Pending Review", label: "Pending Review", dotColor: "#D97706", tint: "#FFFBEB", tintBorder: "#FDE68A" },
  { status: "Cleared", label: "Cleared by Ops", dotColor: "#1E40AF", tint: "#F8FAFF", tintBorder: "#E8EEFB" },
  { status: "Partially Shipped", label: "Partially Shipped", dotColor: "#7C3AED", tint: "#F5F3FF", tintBorder: "#DDD6FE" },
  { status: "Shipped", label: "Shipped", dotColor: "#16A34A", tint: "#F0FDF4", tintBorder: "#BBF7D0" },
  { status: "Cancelled", label: "Cancelled", dotColor: "#DC2626", tint: "#FEF2F2", tintBorder: "#FECACA", matchStatuses: ["Cancelled", "Partially Cancelled"] },
  { status: "Archived", label: "Archived", dotColor: "#DC2626", tint: "#FEF2F2", tintBorder: "#FECACA" },
];
const OPS_COLUMNS: { status: SOStatus; label: string; dotColor: string; tint: string; tintBorder: string; matchStatuses?: SOStatus[] }[] = [
  { status: "Draft", label: "Draft", dotColor: "#6B7280", tint: "#F9FAFB", tintBorder: "#E5E7EB" },
  { status: "Pending Review", label: "Pending Review", dotColor: "#D97706", tint: "#FFFBEB", tintBorder: "#FDE68A" },
  { status: "Cleared", label: "Cleared by Ops", dotColor: "#1E40AF", tint: "#F8FAFF", tintBorder: "#E8EEFB" },
  { status: "Partially Shipped", label: "Partially Shipped", dotColor: "#7C3AED", tint: "#F5F3FF", tintBorder: "#DDD6FE" },
  { status: "Shipped", label: "Shipped", dotColor: "#16A34A", tint: "#F0FDF4", tintBorder: "#BBF7D0" },
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
  if (diff === 1) return "1d ago";
  if (diff < 30) return `${diff}d ago`;
  return `${Math.floor(diff / 30)}mo ago`;
}

function sortSOs(items: SalesOrder[], sortBy: SortOption): SalesOrder[] {
  const sorted = [...items];
  switch (sortBy) {
    case "Last Updated":
      return sorted.sort((a, b) => {
        const dateA = a.activityLog.length > 0 ? new Date(a.activityLog[a.activityLog.length - 1].timestamp).getTime() : 0;
        const dateB = b.activityLog.length > 0 ? new Date(b.activityLog[b.activityLog.length - 1].timestamp).getTime() : 0;
        return dateB - dateA;
      });
    case "SO Value": return sorted.sort((a, b) => b.total - a.total);
    case "Creation Date":
      return sorted.sort((a, b) => {
        const pa = a.createdDate.split("/").map(Number);
        const pb = b.createdDate.split("/").map(Number);
        return new Date(pb[0], pb[1] - 1, pb[2]).getTime() - new Date(pa[0], pa[1] - 1, pa[2]).getTime();
      });
    case "Line Items": return sorted.sort((a, b) => b.lines.length - a.lines.length);
    default: return sorted;
  }
}

/* ═══ Current user constant ═══ */
const CURRENT_USER_REP = "Adrian User";

/* ═══ Persona-aware drag rules ═══ */
function canDropToColumn(fromStatus: SOStatus, toStatus: SOStatus, isCreator: boolean, isReviewer: boolean, soSalesRep?: string): boolean {
  if (fromStatus === toStatus) return false;
  
  if (toStatus === "Shipped" || toStatus === "Partially Shipped" || toStatus === "Archived") return false;
  if (toStatus === "Draft") return true;
  if (toStatus === "Cancelled") return fromStatus !== "Archived";

  // ── Creator (Sales View) rules ──
  if (isCreator && !isReviewer) {
    // Creators can submit Draft → Pending Review (but not their own orders)
    if (fromStatus === "Draft" && toStatus === "Pending Review") {
      return soSalesRep !== CURRENT_USER_REP;
    }
    return false;
  }

  // ── Reviewer (Ops View) rules ──
  if (isReviewer) {
    // Reviewers should not drop into Pending Review
    if (toStatus === "Pending Review") return false;
    if ((fromStatus === "Pending Review" || fromStatus === "Draft") && toStatus === "Cleared") {
      return soSalesRep !== CURRENT_USER_REP;
    }
    return false;
  }

  return false;
}

/* ═══ Status Transition Overlay ═══ */
interface TransitionInfo {
  soNumber: string;
  fromLabel: string;
  toLabel: string;
  fromColor: string;
  toColor: string;
}

function StatusTransitionOverlay({ info, onDone }: { info: TransitionInfo; onDone: () => void }) {
  const [phase, setPhase] = useState<"enter" | "show" | "exit">("enter");
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("show"), 30);
    const t2 = setTimeout(() => setPhase("exit"), 2200);
    const t3 = setTimeout(onDone, 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);
  const opacity = phase === "enter" ? 0 : phase === "exit" ? 0 : 1;
  const translateY = phase === "enter" ? "12px" : phase === "exit" ? "-8px" : "0px";
  return ReactDOM.createPortal(
    <div style={{
      position: "fixed", top: "20px", left: "50%", transform: `translateX(-50%) translateY(${translateY})`,
      zIndex: 9999, opacity, transition: "opacity 300ms ease, transform 300ms ease", pointerEvents: "none",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "10px 20px", backgroundColor: "#FFFFFF",
        borderRadius: "10px", border: "1px solid #E5E7EB",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
        whiteSpace: "nowrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: info.fromColor }} />
          <span style={{ fontSize: "12px", fontWeight: 500, color: "#6B7280" }}>{info.fromLabel}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", position: "relative", width: 32, height: 20 }}>
          <div style={{ position: "absolute", left: 0, top: "50%", width: "100%", height: 1, backgroundColor: "#D1D5DB" }} />
          <ArrowRight style={{
            width: 14, height: 14, color: info.toColor,
            position: "absolute", right: -2, top: "50%", transform: "translateY(-50%)",
            animation: phase === "show" ? "kanbanArrowPulse 800ms ease-in-out infinite alternate" : "none",
          }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: info.toColor }} />
          <span style={{ fontSize: "13px", fontWeight: 600, color: info.toColor }}>{info.toLabel}</span>
        </div>
        <div style={{ width: 1, height: 16, backgroundColor: "#E5E7EB", margin: "0 2px" }} />
        <span style={{ fontSize: "11px", fontWeight: 500, color: "#9CA3AF", letterSpacing: "0.2px" }}>{info.soNumber}</span>
      </div>
      <style>{`@keyframes kanbanArrowPulse { from { transform: translateY(-50%) translateX(-2px); } to { transform: translateY(-50%) translateX(2px); } }`}</style>
    </div>,
    document.body
  );
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

    // If clearing for ops, show confirm modal
    if (toStatus === "Cleared") {
      setConfirmSO(so);
      return;
    }

    // If dragging terminal states back to Draft, show reactivation modal
    if (toStatus === "Draft" && (fromStatus === "Cancelled" || fromStatus === "Partially Cancelled" || fromStatus === "Archived")) {
      const variant = fromStatus === "Archived" ? "archived" : "cancelled";
      setReactivateSO({ so, variant });
      return;
    }

    // For other transitions (e.g. Draft → Pending Review), call parent and show overlay
    onStatusChange?.(soId, fromStatus, toStatus);
    const from = getColumnMeta(fromStatus);
    const to = getColumnMeta(toStatus);
    setTransitionInfo({ soNumber: so.soNumber, fromLabel: from.label, toLabel: to.label, fromColor: from.color, toColor: to.color });
  }, [salesOrders, getColumnMeta, onStatusChange, onCancelRequest]);

  const filtered = useMemo(() => {
    let list = salesOrders;
    const q = search.toLowerCase();
    if (q) list = list.filter(so => so.soNumber.toLowerCase().includes(q) || so.customer.toLowerCase().includes(q) || so.salesRep.toLowerCase().includes(q));
    return list;
  }, [salesOrders, search]);


  const containerStyle: React.CSSProperties = { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 };

  return (
    <DndProvider backend={HTML5Backend}>
      <div style={containerStyle}>


        {/* ── Kanban Columns ── */}
        <div className="relative flex-1 min-h-0">
          <div className="absolute inset-0 flex overflow-x-auto" style={{ padding: "20px", gap: 14, scrollbarWidth: "thin", scrollbarColor: "#D1D5DB #F3F4F6" }}>
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

      {/* Transition overlay */}
      {transitionInfo && <StatusTransitionOverlay info={transitionInfo} onDone={() => setTransitionInfo(null)} />}

      {/* Confirm SO modal for clearing */}
      {confirmSO && (
        <ConfirmSOModal
          so={confirmSO}
          onClose={() => setConfirmSO(null)}
          onConfirm={() => {
            onStatusChange?.(confirmSO.id, confirmSO.status, "Cleared");
            const from = getColumnMeta(confirmSO.status);
            const to = getColumnMeta("Cleared");
            setTransitionInfo({ soNumber: confirmSO.soNumber, fromLabel: from.label, toLabel: to.label, fromColor: from.color, toColor: to.color });
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
            const from = getColumnMeta(reactivateSO.so.status);
            const to = getColumnMeta("Draft");
            setTransitionInfo({ soNumber: reactivateSO.so.soNumber, fromLabel: from.label, toLabel: to.label, fromColor: from.color, toColor: to.color });
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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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

  const totalValue = orders.reduce((s, so) => s + so.total, 0);

  let processedOrders = orders;
  const activeSearch = localSearch || search;
  if (activeSearch) {
    const q = activeSearch.toLowerCase();
    processedOrders = orders.filter(so => so.soNumber.toLowerCase().includes(q) || so.customer.toLowerCase().includes(q) || so.salesRep.toLowerCase().includes(q));
  }
  processedOrders = sortSOs(processedOrders, sortBy);

  const groupedOrders = groupBy === "none"
    ? { All: processedOrders }
    : processedOrders.reduce((acc, so) => {
        const key = groupBy === "salesRep" ? so.salesRep : groupBy === "customer" ? so.customer : (so.priority ?? "Standard");
        if (!acc[key]) acc[key] = [];
        acc[key].push(so);
        return acc;
      }, {} as Record<string, SalesOrder[]>);

  const isDropHighlight = isOver && canDropHere;

  return (
    <div ref={drop} className="flex-shrink-0 flex flex-col" style={{ width: 290, minWidth: 290, height: "100%" }}>
      {/* Column Header */}
      <div style={{
        backgroundColor: "#FFFFFF",
        borderTop: `1px solid ${isDropHighlight ? dotColor : "#E5E7EB"}`,
        borderLeft: `1px solid ${isDropHighlight ? dotColor : "#E5E7EB"}`,
        borderRight: `1px solid ${isDropHighlight ? dotColor : "#E5E7EB"}`,
        borderRadius: "8px 8px 0 0", padding: "12px 14px",
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
              ><ArrowUpDown style={{ width: 14, height: 14, color: "#9CA3AF" }} /></button>
              {showSort && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSort(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[#E5E7EB] shadow-lg z-20 py-1" style={{ borderRadius: 8 }}>
                    <div className="px-3 py-2 text-[11px] text-[#6B7280] uppercase tracking-wide" style={{ fontWeight: 500 }}>Sort By</div>
                    {SORT_OPTIONS.map(opt => (
                      <button key={opt} onClick={() => { setSortBy(opt); setShowSort(false); }}
                        className="w-full px-3 py-2 text-left text-[13px] hover:bg-[#F9FAFB] transition-colors flex items-center justify-between"
                        style={{ color: sortBy === opt ? "#1B6EF3" : "#374151", border: "none", backgroundColor: "transparent", cursor: "pointer" }}
                      >{opt}{sortBy === opt && <span style={{ color: "#1B6EF3" }}>✓</span>}</button>
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

      {/* Column Body */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{
        backgroundColor: isDropHighlight ? `${dotColor}08` : tint,
        borderLeft: `1px solid ${isDropHighlight ? dotColor : tintBorder}`,
        borderRight: `1px solid ${isDropHighlight ? dotColor : tintBorder}`,
        borderBottom: `1px solid ${isDropHighlight ? dotColor : tintBorder}`,
        borderRadius: "0 0 8px 8px", padding: 6,
        scrollbarWidth: "thin", scrollbarColor: "#D1D5DB transparent",
        minHeight: 120, transition: "background-color 250ms ease, border-color 200ms ease",
      }}>
        {Object.entries(groupedOrders).map(([groupName, groupItems]) => {
          const isCollapsed = collapsedGroups.has(groupName);
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
                  {groupItems.map((so, idx) => (
                    <SOKanbanCard key={so.id} so={so} soIdx={idx} columnStatus={status} accentColor={dotColor} onOrderClick={onOrderClick} search={search} isCreator={isCreator} isReviewer={isReviewer} onVersionHistory={onVersionHistory} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
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
  const repInitials = so.salesRep.split(" ").map(w => w[0]).join("").slice(0, 2);
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

  const pocName = POC_NAMES[soIdx % POC_NAMES.length];
  const pocExtraCount = POC_EXTRA_MAP[soIdx % POC_EXTRA_MAP.length];
  const extraPocNames = Array.from({ length: pocExtraCount }, (_, i) => POC_NAMES[(soIdx + i + 1) % POC_NAMES.length]);

  // Status footer
  const getStatusFooter = () => {
    const daysSince = daysAgo(so.orderDate);
    if (columnStatus === "Shipped") return { icon: <CheckCircle style={{ width: 11, height: 11 }} />, text: `Shipped ${daysSince}`, color: "#16A34A" };
    if (columnStatus === "Cancelled") return { icon: <Ban style={{ width: 11, height: 11 }} />, text: `Cancelled ${daysSince}`, color: "#DC2626" };
    if (columnStatus === "Pending Review") return { icon: <Clock style={{ width: 11, height: 11 }} />, text: `Submitted ${daysSince}`, color: "#D97706" };
    if (columnStatus === "Cleared") return { icon: <CheckCircle style={{ width: 11, height: 11 }} />, text: `Cleared ${daysSince}`, color: "#1E40AF" };
    return { icon: <Clock style={{ width: 11, height: 11 }} />, text: `Created ${daysSince}`, color: "#6B7280" };
  };
  const footer = getStatusFooter();

  return (
    <div
      ref={drag}
      className={`cursor-move ${isDragging ? "opacity-30 scale-95" : ""}`}
      style={{
        position: "relative", backgroundColor: isHovered ? "#FAFBFC" : "#FFFFFF",
        borderRadius: 8, border: `1px solid ${isHovered ? "#D1D5DB" : "#E5E7EB"}`,
        boxShadow: isHovered ? "0 4px 12px rgba(0,0,0,0.08)" : "0 1px 2px rgba(0,0,0,0.04)",
        transform: isHovered && !isDragging ? "translateY(-1px)" : "translateY(0)",
        transition: "all 200ms ease",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onOrderClick(so.id)}
    >
      <div style={{ height: 2, backgroundColor: accentColor, borderRadius: "8px 8px 0 0", opacity: isHovered ? 1 : 0.4, transition: "opacity 200ms ease" }} />
      <div style={{ padding: 12 }}>
        {/* Row 1: SO# + Version */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: "#9CA3AF", lineHeight: "1", letterSpacing: "0.2px" }}>
            {so.soNumber}
          </span>
          <div onClick={(e) => e.stopPropagation()} onMouseEnter={() => setVersionBadgeHovered(true)} onMouseLeave={() => setVersionBadgeHovered(false)}>
            <VersionBadge version={versionNum} compact showExpandIcon={versionBadgeHovered} onClick={(e) => { e.stopPropagation(); onVersionHistory(so); }} />
          </div>
        </div>

        {/* Row 2: Customer + description */}
        <div style={{ cursor: "pointer", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: custTint.bg, color: custTint.fg, fontSize: 9, fontWeight: 600 }}>
              {so.customer.split(" ").map(w => w[0]).join("").slice(0, 2)}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: "1.4" }}>{so.customer}</span>
          </div>
          {so.description && <div style={{ fontSize: "11.5px", color: "#9CA3AF", lineHeight: "1.4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{so.description}</div>}
        </div>

        {/* Row 3: Value + Priority */}
        <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1F2937", lineHeight: "1.2" }}>${so.total.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 400, marginTop: 2, lineHeight: "1" }}>Order Value</div>
          </div>
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 500,
              backgroundColor: priority === "High" ? "#FEF2F2" : priority === "Standard" ? "#EFF6FF" : "#F1F5F9",
              color: priority === "High" ? "#991B1B" : priority === "Standard" ? "#1E40AF" : "#475569",
            }}>{priority}</span>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 400, marginTop: 2, lineHeight: "1" }}>Priority</div>
          </div>
        </div>

        {/* Row 4: Fulfillment Progress — minimal stacked */}
        <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 8, marginBottom: 2, display: "flex", alignItems: "flex-start", gap: 16 }}>
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #F3F4F6", paddingTop: 8, marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: footer.color }}>{footer.icon}<span style={{ fontSize: 11, fontWeight: 500 }}>{footer.text}</span></div>
        </div>

        {/* Row 5: Hover expand — Sales Rep + PoCs */}
        {isHovered && (
          <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 8, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 500, lineHeight: "1" }}>Sales Representative</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: repTint.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: repTint.fg, flexShrink: 0 }}>{repInitials}</div>
                <span style={{ fontSize: 11, color: "#374151", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{so.salesRep}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end", flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 500, lineHeight: "1" }}>Point of Contacts</span>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "#1E40AF", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, border: "2px solid #FFFFFF", position: "relative", zIndex: 5, flexShrink: 0 }}>{pocName.charAt(0)}</div>
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
            </div>
          </div>
        )}

        {/* Sub-status badge */}
        {so.status !== columnStatus && <div style={{ marginTop: 8 }}><SOStatusBadge status={so.status} /></div>}
      </div>
    </div>
  );
}
