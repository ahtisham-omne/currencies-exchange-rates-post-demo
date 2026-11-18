import type { RenderHelpers } from "../data-table/types";
import { CARD_SIZE_PADDING_XY } from "../data-table/types";
import { useState, useCallback, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Inbox, ChevronRight, CornerDownRight } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "../data-table/DataTable";
import { userRequests as initialRequests } from "../../data/user-requests-data";
import type { UserRequestRow } from "../../data/user-requests-data";
import {
  USER_REQUESTS_COLUMNS,
  USER_REQUESTS_QUICK_FILTERS,
  userRequestsSearchPredicate,
  userRequestsFilterPredicate,
  UserRequestsActionMenu,
} from "../../data/user-requests-table-config";
import { StatusBadge } from "../table-cells";
import { UserSummaryTooltip } from "../shared/UserSummaryTooltip";
import { PERMISSION_MODULES } from "../../data/permissions-data";
import { resolveUserAvatar, getAvatarTint, getInitials } from "../../lib/avatar";
import { UserRequestDetailModal } from "./UserRequestDetailModal";
import { useAccessMode } from "../access-mode";
import { isNewTenant } from "../../data/tenant";
import { CURRENT_USER } from "../../data/current-user";

/* Status palette + display labels, pixel-matched to the user-detail
 * Requested Permissions cards (RolesPermissionsTab) so both surfaces render
 * identical cards. */
const REQUEST_STATUS_MAP: Record<
  string,
  { bg: string; text: string; dot: string; border?: string }
> = {
  Accepted: { bg: "#ECFDF5", text: "#065F46", dot: "#059669", border: "#A7F3D0" },
  Pending: { bg: "#FFFBEB", text: "#92400E", dot: "#D97706", border: "#FDE68A" },
  Rejected: { bg: "#FEF2F2", text: "#991B1B", dot: "#EF4444", border: "#FECACA" },
};

const REQUEST_DISPLAY_LABELS: Record<string, string> = {
  Accepted: "Approved",
  Pending: "Pending",
  Rejected: "Rejected",
};

/* ── Resolve permission names from a request (with fallback for unmatched
 * modules), mirrors the helper in the user-detail Requested Permissions tab. */
function getRequestedPermissionNames(row: UserRequestRow): string[] {
  const mod = PERMISSION_MODULES.find((m) => m.name === row.requestedFor);
  const ids = row.requestedPermissionIds ?? [];
  if (mod) {
    const matched = ids
      .map((id) => mod.permissions.find((p) => p.id === id)?.name)
      .filter((n): n is string => !!n);
    if (matched.length > 0) return matched;
  }
  if (ids.length === 0) return [`Access ${row.requestedFor} Module`];
  const synthesized = [`Access ${row.requestedFor} Module`];
  const extras = ["Create and Edit Records", "Approve and Manage Workflow", "Export and Bulk Actions"];
  for (let i = 1; i < ids.length && i - 1 < extras.length; i++) {
    synthesized.push(extras[i - 1]);
  }
  return synthesized;
}

/** Current admin reviewing requests, in a real app this comes from the auth
 *  session: the sample's reviewer, or, for a company from onboarding, the
 *  person signed in. */
const currentReviewer = () => (isNewTenant() ? CURRENT_USER.name : "Andrea Davis");

function formatToday(): string {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

export function UserRequestsTab() {
  const access = useAccessMode();
  const [requests, setRequests] = useState<UserRequestRow[]>(initialRequests);
  const [selectedRequest, setSelectedRequest] = useState<UserRequestRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<UserRequestRow | null>(null);

  const getRowId = useCallback((row: UserRequestRow) => row.id, []);

  const updateRequestStatus = useCallback(
    (id: string, nextStatus: "Accepted" | "Rejected") => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: nextStatus,
                reviewedBy: currentReviewer(),
                reviewedOn: formatToday(),
              }
            : r
        )
      );
      // Keep the open modal in sync if the same row is currently selected
      setSelectedRequest((cur) =>
        cur && cur.id === id
          ? { ...cur, status: nextStatus, reviewedBy: currentReviewer(), reviewedOn: formatToday() }
          : cur
      );
    },
    []
  );

  const handleApprove = useCallback(
    (row: UserRequestRow) => {
      updateRequestStatus(row.id, "Accepted");
      toast.success("Permission request approved", {
        description: `Access to ${row.requestedFor} granted to ${row.requestedBy}.`,
      });
    },
    [updateRequestStatus]
  );

  const handleReject = useCallback((row: UserRequestRow) => {
    setRejectTarget(row);
  }, []);

  const confirmReject = useCallback(() => {
    if (!rejectTarget) return;
    updateRequestStatus(rejectTarget.id, "Rejected");
    toast.error("Permission request rejected", {
      description: `Access to ${rejectTarget.requestedFor} denied for ${rejectTarget.requestedBy}.`,
    });
    setRejectTarget(null);
  }, [rejectTarget, updateRequestStatus]);

  const renderActions = useCallback(
    (row: UserRequestRow) => (
      <UserRequestsActionMenu
        row={row}
        onApprove={handleApprove}
        onReject={handleReject}
        onViewDetails={setSelectedRequest}
      />
    ),
    [handleApprove, handleReject]
  );

  const handleRowClick = useCallback((row: UserRequestRow) => {
    setSelectedRequest(row);
  }, []);

  /* Card, pixel-matched to the user-detail Requested Permissions cards
   * (RolesPermissionsTab.renderRequestCard). The one addition here is the
   * requesting user's avatar + name, since this UAC list aggregates requests
   * across many users. */
  const renderCard = useCallback(
    (row: UserRequestRow, helpers: RenderHelpers): ReactNode => {
      /* "Review Request" promises a decision the persona may not be able to
       * make, so it degrades to "View Details". */
      const isPending = row.status === "Pending" && access.canApproveRequests;
      const permNames = getRequestedPermissionNames(row);
      const firstPerm = permNames[0];
      const extra = Math.max(0, permNames.length - 1);

      // Subtle status gradient (barely-there tint at the bottom)
      const gradientByStatus: Record<string, string> = {
        Pending:  "linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 70%, rgba(254, 243, 199, 0.22) 100%)",
        Accepted: "linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 70%, rgba(209, 250, 229, 0.22) 100%)",
        Rejected: "linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 70%, rgba(254, 226, 226, 0.22) 100%)",
      };

      const resolvedAvatar = resolveUserAvatar({ name: row.requestedBy });
      const tint = getAvatarTint(row.requestedBy);
      const initials = getInitials(row.requestedBy);

      return (
        <div
          className={`group border border-border rounded-xl ${CARD_SIZE_PADDING_XY[helpers.cardSize]} cursor-pointer hover:border-[#007FFF]/20 transition-all h-full flex flex-col`}
          style={{
            minHeight: 128,
            background: gradientByStatus[row.status] ?? "#FFFFFF",
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 6px -2px rgba(15, 23, 42, 0.06)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.boxShadow =
              "0 2px 4px rgba(15, 23, 42, 0.06), 0 6px 14px -4px rgba(15, 23, 42, 0.10)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.boxShadow =
              "0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 6px -2px rgba(15, 23, 42, 0.06)";
          }}
          onClick={() => setSelectedRequest(row)}
        >
          {/* Top row: module title + status badge */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <span
              className="text-[14px] truncate"
              style={{ color: "#0F172A", fontWeight: 500 }}
            >
              {row.requestedFor}
            </span>
            <StatusBadge
              status={row.status}
              configMap={REQUEST_STATUS_MAP}
              displayLabel={REQUEST_DISPLAY_LABELS[row.status]}
            />
          </div>

          {/* Requesting user: avatar + name (unique to the aggregated UAC list) */}
          <UserSummaryTooltip userName={row.requestedBy}>
            <div className="flex items-center gap-1.5 mb-2 min-w-0 w-fit">
              {resolvedAvatar ? (
                <img
                  src={resolvedAvatar}
                  alt={row.requestedBy}
                  className="w-5 h-5 rounded-md object-cover shrink-0"
                />
              ) : (
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[9px]"
                  style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 600 }}
                >
                  {initials}
                </div>
              )}
              <span
                className="text-[12px] truncate min-w-0"
                style={{ color: "#64748B", fontWeight: 500 }}
              >
                {row.requestedBy}
              </span>
            </div>
          </UserSummaryTooltip>

          {/* Middle: permission with inline "+N more" */}
          <div className="flex-1 flex items-start min-w-0">
            <div className="flex items-start gap-1.5 min-w-0 w-full">
              <CornerDownRight className="w-3.5 h-3.5 shrink-0 mt-[1px]" style={{ color: "#64748B" }} />
              <span className="text-[12px] leading-snug truncate min-w-0" style={{ color: "#334155" }}>
                {firstPerm}
                {extra > 0 && (
                  <span className="ml-1" style={{ color: "#0A77FF", fontWeight: 500 }}>
                    +{extra} more
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Footer: date + CTA. Negative margins pull the top divider to the
              card edges (edge-to-edge), while px-4 keeps the content aligned. */}
          <div
            className="flex items-center justify-between mt-2 pt-2 -mx-4 px-4"
            style={{ borderTop: "0.5px solid #E2E8F0" }}
          >
            <span className="text-[11px]" style={{ color: "#475569", fontWeight: 400 }}>
              {row.requestedOn}
            </span>
            {/* CTA: gray chevron by default; on card hover the label reveals and
                both label + chevron turn blue. Label differs by pending state. */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSelectedRequest(row); }}
              className="inline-flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0 shrink-0"
            >
              <span className="text-[12px] font-medium whitespace-nowrap text-[#0A77FF] opacity-0 -translate-x-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0">
                {isPending ? "Review Request" : "View Details"}
              </span>
              <ChevronRight className="w-4 h-4 shrink-0 text-[#475569] transition-colors duration-150 group-hover:text-[#0A77FF]" />
            </button>
          </div>
        </div>
      );
    },
    []
  );

  // Memoise to keep DataTable identity stable
  const data = useMemo(() => requests, [requests]);

  return (
    <>
      <DataTable<UserRequestRow>
        data={data}
        columns={USER_REQUESTS_COLUMNS}
        getRowId={getRowId}
        searchPlaceholder="Search by name, module, or reason..."
        searchPredicate={userRequestsSearchPredicate}
        quickFilters={USER_REQUESTS_QUICK_FILTERS}
        filterPredicate={userRequestsFilterPredicate}
        showMeMode={false}
        emptyIcon={<Inbox className="w-8 h-8" />}
        /* Short phrases: the empty state renders these as a heading. */
        emptyMessage="No Permission Requests"
        emptyFilterMessage={(filterLabel) => `No ${filterLabel} Requests`}
        emptySearchMessage="No Requests Match Your Search"
        renderActions={renderActions}
        renderCard={renderCard}
        cardGridClassName={(size) =>
          size === "large"
            ? "grid gap-4 grid-cols-2 min-[1600px]:grid-cols-3"
            : size === "small"
              ? "grid gap-3 grid-cols-4 min-[1600px]:grid-cols-6"
              : "grid gap-4 grid-cols-3 min-[1600px]:grid-cols-4"
        }
        entityLabel="requests"
        onRowClick={handleRowClick}
        defaultDensity="card"
        persistKey="uac:user-requests-list"
      />

      {selectedRequest && (
        <UserRequestDetailModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {/* Reject Confirmation Modal */}
      {rejectTarget &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[80] bg-black/30"
              onClick={() => setRejectTarget(null)}
            />
            <div
              className="fixed z-[80] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl border border-gray-200 overflow-hidden"
              style={{
                width: 440,
                maxWidth: "calc(100vw - 48px)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 pt-5 pb-4 border-b border-[#F1F5F9]">
                <h3 style={{ fontSize: "15px", fontWeight: 650, color: "#0F172A" }}>
                  Reject Request?
                </h3>
              </div>
              <div className="px-5 py-5 space-y-3">
                <p style={{ fontSize: "13.5px", color: "#334155", lineHeight: "1.6" }}>
                  Rejecting this request will deny {rejectTarget.requestedBy}'s access to{" "}
                  {rejectTarget.requestedFor}. You can reverse this decision at any time.
                </p>
              </div>
              <div
                className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t"
                style={{ borderColor: "#F1F5F9", backgroundColor: "#FAFBFC" }}
              >
                <button
                  onClick={() => setRejectTarget(null)}
                  className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] text-[#334155] cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmReject}
                  className="h-9 px-4 rounded-[8px] text-[13px] text-white cursor-pointer transition-colors"
                  style={{ backgroundColor: "#DC2626", fontWeight: 600 }}
                >
                  Reject Request
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
