import type { RenderHelpers } from "../data-table/types";
import { cardShellClass } from "../data-table/types";
import { useCallback, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Inbox, X, Clock, CheckCircle2, XCircle, FileText, User, Calendar, Shield, MessageSquare, Check } from "lucide-react";
import { DataTable } from "../data-table/DataTable";
import type { PermissionRequestRow } from "../../data/user-permission-requests-data";
import type { ColumnDef } from "../data-table/types";
import {
  USER_REQUESTS_QUICK_FILTERS,
  userRequestsSearchPredicate,
  userRequestsFilterPredicate,
} from "../../data/user-requests-table-config";
import { SmallAvatarCell, StatusBadge } from "../table-cells";
import { UserSummaryTooltip } from "../shared/UserSummaryTooltip";
import { getUserPermissionRequests } from "../../data/user-permission-requests-data";
import type { UserDetail } from "../../data/user-detail-data";
import { getAvatarTint, getInitials, resolveUserAvatar } from "../../lib/avatar";
import { useAccessMode } from "../access-mode";
import { isNewTenant } from "../../data/tenant";
import { CURRENT_USER } from "../../data/current-user";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

/* The sample's reviewer, or, for a company from onboarding, the person
 * signed in. */
const currentReviewer = () => (isNewTenant() ? CURRENT_USER.name : "Andrea Davis");

function formatToday(): string {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

const REQUEST_STATUS_MAP: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  Accepted: { bg: "#ECFDF5", text: "#059669", dot: "#10B981" },
  Pending: { bg: "#FFFBEB", text: "#D97706", dot: "#F59E0B" },
  Rejected: { bg: "#FEF2F2", text: "#DC2626", dot: "#EF4444" },
};

/* ─── Module chip (matches the one in user-requests-table-config) ─── */
function ModuleChip({ name }: { name: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs border"
      style={{
        backgroundColor: "#EDF4FF",
        color: "#007FFF",
        borderColor: "#B4D7FF",
        fontWeight: 500,
      }}
    >
      {name}
    </span>
  );
}

/* ─── Custom columns: "Requested For" as first sticky column, no "Requested By" ─── */
const USER_PERM_REQUEST_COLUMNS: ColumnDef<PermissionRequestRow>[] = [
  {
    key: "requested_for",
    label: "Requested For",
    width: 200,
    stickyLeft: true,
    render: (row) => <ModuleChip name={row.requestedFor} />,
  },
  {
    key: "reason",
    label: "Reason",
    width: 360,
    render: (row, { highlightText }) => (
      <span
        className="text-sm truncate block max-w-[340px]"
        style={{ color: "#64748B" }}
      >
        {highlightText(row.reason)}
      </span>
    ),
  },
  {
    key: "requested_on",
    label: "Requested On",
    width: 150,
    render: (row) => (
      <span className="text-sm" style={{ color: "#475569" }}>
        {row.requestedOn}
      </span>
    ),
  },
  {
    key: "status",
    label: "Status",
    width: 130,
    render: (row) => (
      <StatusBadge status={row.status} configMap={REQUEST_STATUS_MAP} />
    ),
  },
];

/* ═══════════════════════════════════════════
   Permission Request Detail Modal
   ═══════════════════════════════════════════ */
function PermissionRequestDetailModal({
  open,
  onClose,
  request,
  onApprove,
  onReject,
}: {
  open: boolean;
  onClose: () => void;
  request: PermissionRequestRow | null;
  onApprove?: (request: PermissionRequestRow) => void;
  onReject?: (request: PermissionRequestRow) => void;
}) {
  const access = useAccessMode();
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setIsClosing(false);
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  if ((!open && !isClosing) || !request) return null;

  const statusConfig = REQUEST_STATUS_MAP[request.status] ?? REQUEST_STATUS_MAP.Pending;
  const StatusIcon =
    request.status === "Accepted"
      ? CheckCircle2
      : request.status === "Rejected"
      ? XCircle
      : Clock;

  const tint = getAvatarTint(request.requestedBy);
  const initials = getInitials(request.requestedBy);
  /* Viewing the queue and acting on it are separate capabilities, so a
   * read-only reviewer sees the detail without the decision footer. */
  const isPending = request.status === "Pending" && access.canApproveRequests;

  /* Reviewer metadata: set when the row was approved/rejected, otherwise null */
  const reviewedBy = request.reviewedBy ?? null;
  const reviewedOn = request.reviewedOn ?? null;

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-180 ${
          isClosing ? "opacity-0" : "opacity-100"
        }`}
        style={{ backgroundColor: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
        onClick={handleClose}
      />
      <div
        className={`fixed inset-0 z-[61] flex items-center justify-center transition-all duration-180 ${
          isClosing ? "opacity-0 scale-[0.97]" : "opacity-100 scale-100"
        }`}
        style={{ pointerEvents: isClosing ? "none" : "auto" }}
      >
        <div
          className="bg-white rounded-2xl w-full max-w-[520px] mx-4 overflow-hidden font-['Inter',sans-serif]"
          style={{
            boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-start gap-3 px-5 pt-5 pb-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#EDF4FF" }}
            >
              <FileText className="w-5 h-5" style={{ color: "#007FFF" }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className="text-[15px] text-[#0F172A]"
                style={{ fontWeight: 650 }}
              >
                Permission Request Details
              </h3>
              <p className="text-[12px] text-[#94A3B8] mt-0.5" style={{ fontWeight: 400 }}>
                {request.id}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-all cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="px-5 pt-4 pb-5 space-y-4">
            {/* Status banner */}
            <div
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[8px] border"
              style={{
                backgroundColor: statusConfig.bg,
                borderColor: statusConfig.dot + "33",
              }}
            >
              <StatusIcon className="w-4 h-4 shrink-0" style={{ color: statusConfig.text }} />
              <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                <span
                  className="text-[13px]"
                  style={{ fontWeight: 600, color: statusConfig.text }}
                >
                  {request.status === "Accepted"
                    ? "Request Approved"
                    : request.status === "Rejected"
                    ? "Request Denied"
                    : "Awaiting Review"}
                </span>
                {reviewedBy && (
                  <>
                    <span className="text-[11px]" style={{ color: statusConfig.text, opacity: 0.75 }}>
                      &middot; {request.status === "Accepted" ? "Approved" : "Rejected"} by
                    </span>
                    <UserSummaryTooltip userName={reviewedBy}>
                      <span className="cursor-default">
                        <SmallAvatarCell name={reviewedBy} />
                      </span>
                    </UserSummaryTooltip>
                  </>
                )}
              </div>
            </div>

            {/* Info rows */}
            <div
              className="rounded-xl border border-[#E2E8F0] overflow-hidden divide-y divide-[#F1F5F9]"
              style={{ backgroundColor: "#FAFBFC" }}
            >
              {/* Requested By */}
              <div className="flex items-center gap-3 px-4 py-3">
                <User className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
                <span className="text-[12px] shrink-0" style={{ color: "#64748B", fontWeight: 500, minWidth: 100 }}>
                  Requested By
                </span>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {resolveUserAvatar({ name: request.requestedBy }) ? (
                    <img
                      src={resolveUserAvatar({ name: request.requestedBy })}
                      alt={request.requestedBy}
                      className="w-6 h-6 rounded-md object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[9px]"
                      style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 600 }}
                    >
                      {initials}
                    </div>
                  )}
                  <span className="text-[13px] truncate" style={{ color: "#1E293B", fontWeight: 500 }}>
                    {request.requestedBy}
                  </span>
                </div>
              </div>

              {/* Requested For */}
              <div className="flex items-center gap-3 px-4 py-3">
                <Shield className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
                <span className="text-[12px] shrink-0" style={{ color: "#64748B", fontWeight: 500, minWidth: 100 }}>
                  Module
                </span>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-xs border"
                  style={{
                    backgroundColor: "#EDF4FF",
                    color: "#007FFF",
                    borderColor: "#B4D7FF",
                    fontWeight: 500,
                  }}
                >
                  {request.requestedFor}
                </span>
              </div>

              {/* Requested On */}
              <div className="flex items-center gap-3 px-4 py-3">
                <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
                <span className="text-[12px] shrink-0" style={{ color: "#64748B", fontWeight: 500, minWidth: 100 }}>
                  Requested On
                </span>
                <span className="text-[13px]" style={{ color: "#1E293B", fontWeight: 400 }}>
                  {request.requestedOn}
                </span>
              </div>

              {/* Reviewed On: only if reviewed */}
              {reviewedOn && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
                  <span className="text-[12px] shrink-0" style={{ color: "#64748B", fontWeight: 500, minWidth: 100 }}>
                    Reviewed
                  </span>
                  <span className="text-[13px]" style={{ color: "#1E293B", fontWeight: 400 }}>
                    {reviewedOn}
                  </span>
                </div>
              )}
            </div>

            {/* Reason section */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
                <span className="text-[12px]" style={{ color: "#64748B", fontWeight: 600 }}>
                  Reason
                </span>
              </div>
              <div
                className="rounded-[8px] border border-[#E2E8F0] px-3.5 py-3"
                style={{ backgroundColor: "#FAFBFC" }}
              >
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "#334155", fontWeight: 400 }}
                >
                  {request.reason}
                </p>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#EEF2F6] bg-[#FAFBFC]">
            {isPending ? (
              <>
                <button
                  onClick={handleClose}
                  className="text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer mr-auto"
                  style={{ fontWeight: 500 }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (onReject && request) onReject(request);
                    handleClose();
                  }}
                  className="h-9 px-4 rounded-[8px] text-[13px] text-white transition-all cursor-pointer shadow-sm"
                  style={{ backgroundColor: "#DC2626", fontWeight: 600 }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#B91C1C")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#DC2626")}
                >
                  Reject
                </button>
                <button
                  onClick={() => {
                    if (onApprove && request) onApprove(request);
                    handleClose();
                  }}
                  className="h-9 px-4 rounded-[8px] text-[13px] text-white transition-all cursor-pointer shadow-sm inline-flex items-center gap-1.5"
                  style={{ backgroundColor: "#059669", fontWeight: 600 }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#047857")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#059669")}
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve Request
                </button>
              </>
            ) : (
              <button
                onClick={handleClose}
                className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

/* ═══════════════════════════════════════════
   Inline approve/reject action menu (Pending only)
   ═══════════════════════════════════════════ */
function PermissionRequestActionMenu({
  row,
  onApprove,
  onReject,
}: {
  row: PermissionRequestRow;
  onApprove: (row: PermissionRequestRow) => void;
  onReject: (row: PermissionRequestRow) => void;
}) {
  const access = useAccessMode();
  /* `capability && statusAllows`. The spacer keeps the row height stable so
     the column doesn't jump between actionable and non-actionable rows. */
  if (row.status !== "Pending" || !access.canApproveRequests) return <div className="h-7" />;
  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors cursor-pointer hover:bg-[#ECFDF5]"
              style={{ color: "#10B981" }}
              onClick={(e) => { e.stopPropagation(); onApprove(row); }}
            >
              <Check className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Approve Request</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors cursor-pointer hover:bg-[#FEF2F2]"
              style={{ color: "#EF4444" }}
              onClick={(e) => { e.stopPropagation(); onReject(row); }}
            >
              <X className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Reject Request</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

/* ═══════════════════════════════════════════
   Requested Permissions Tab
   ═══════════════════════════════════════════ */
export function RequestedPermissionsTab({ user }: { user: UserDetail }) {
  const [requests, setRequests] = useState<PermissionRequestRow[]>(() => getUserPermissionRequests(user.id));
  const [selectedRequest, setSelectedRequest] = useState<PermissionRequestRow | null>(null);

  const getRowId = useCallback((row: PermissionRequestRow) => row.id, []);

  const updateStatus = useCallback((id: string, next: "Accepted" | "Rejected") => {
    const reviewedOn = formatToday();
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: next, reviewedBy: currentReviewer(), reviewedOn } : r))
    );
    setSelectedRequest((cur) =>
      cur && cur.id === id ? { ...cur, status: next, reviewedBy: currentReviewer(), reviewedOn } : cur
    );
  }, []);

  const handleApprove = useCallback((row: PermissionRequestRow) => {
    updateStatus(row.id, "Accepted");
    toast.success("Permission request approved", {
      description: `Access to ${row.requestedFor} granted.`,
    });
  }, [updateStatus]);

  const handleReject = useCallback((row: PermissionRequestRow) => {
    updateStatus(row.id, "Rejected");
    toast.error("Permission request rejected", {
      description: `Access to ${row.requestedFor} denied.`,
    });
  }, [updateStatus]);

  const renderActions = useCallback(
    (row: PermissionRequestRow) => (
      <PermissionRequestActionMenu row={row} onApprove={handleApprove} onReject={handleReject} />
    ),
    [handleApprove, handleReject]
  );

  const handleRowClick = useCallback((row: PermissionRequestRow) => {
    setSelectedRequest(row);
  }, []);

  const renderCard = useCallback(
    (row: PermissionRequestRow, helpers: RenderHelpers) => (
      <div
        className={cardShellClass(helpers.cardSize)}
        onClick={() => setSelectedRequest(row)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <ModuleChip name={row.requestedFor} />
          </div>
          <div className="shrink-0 ml-2">
            <PermissionRequestActionMenu row={row} onApprove={handleApprove} onReject={handleReject} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <StatusBadge status={row.status} configMap={REQUEST_STATUS_MAP} />
        </div>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Reason</span>
            <span className="text-foreground truncate max-w-[60%] text-right">{row.reason}</span>
          </div>
          <div className="flex justify-between">
            <span>Requested On</span>
            <span className="text-foreground">{row.requestedOn}</span>
          </div>
        </div>
      </div>
    ),
    [handleApprove, handleReject]
  );

  return (
    <>
      <div
        className="rounded-xl bg-card overflow-clip flex flex-1 min-h-0 flex-col"
        style={{
          boxShadow: "0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)",
          border: "1px solid #E2E8F0",
        }}
      >
        <DataTable<PermissionRequestRow>
          data={requests}
          columns={USER_PERM_REQUEST_COLUMNS}
          getRowId={getRowId}
          searchPlaceholder="Search by module or reason..."
          searchPredicate={userRequestsSearchPredicate}
          quickFilters={USER_REQUESTS_QUICK_FILTERS}
          filterPredicate={userRequestsFilterPredicate}
          showMeMode={false}
          emptyIcon={<Inbox className="w-8 h-8" />}
          emptyMessage="No permission requests found"
          renderActions={renderActions}
          renderCard={renderCard}
          onRowClick={handleRowClick}
          entityLabel="requests"
          persistKey="user-detail:requested-permissions"
        />
      </div>

      <PermissionRequestDetailModal
        open={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        request={selectedRequest}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </>
  );
}