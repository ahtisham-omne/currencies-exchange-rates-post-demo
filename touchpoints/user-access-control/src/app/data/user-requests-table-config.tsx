import { Check, X, MoreHorizontal, Eye } from "lucide-react";
import { AvatarCell, StatusBadge } from "../components/table-cells";
import type { ColumnDef, QuickFilterDef } from "../components/data-table/types";
import type { UserRequestRow } from "./user-requests-data";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAccessMode } from "../components/access-mode";

/* ─── Module chip component ─── */
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

/* ─── Status config map ─── */
const REQUEST_STATUS_MAP: Record<
  string,
  { bg: string; text: string; dot: string; border?: string }
> = {
  Accepted: { bg: "#ECFDF5", text: "#065F46", dot: "#059669", border: "#A7F3D0" },
  Pending: { bg: "#FFFBEB", text: "#92400E", dot: "#D97706", border: "#FDE68A" },
  Rejected: { bg: "#FEF2F2", text: "#991B1B", dot: "#EF4444", border: "#FECACA" },
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  Accepted: "Approved",
  Pending: "Pending",
  Rejected: "Rejected",
};

/* ─── Column definitions ─── */
export const USER_REQUESTS_COLUMNS: ColumnDef<UserRequestRow>[] = [
  {
    key: "requested_by",
    label: "Requested By",
    width: 200,
    stickyLeft: true,
    render: (row, { highlightText, density }) => (
      <AvatarCell name={row.requestedBy} nameNode={highlightText(row.requestedBy)} comfort={density === "comfort"} />
    ),
  },
  {
    key: "requested_for",
    label: "Requested For",
    width: 160,
    render: (row, { highlightText, density }) => {
      const isComfort = density === "comfort";
      return (
        <span
          className={`inline-flex items-center ${isComfort ? "px-2.5 py-1" : "px-2 py-0.5"} rounded-md text-xs border`}
          style={{
            backgroundColor: "#EDF4FF",
            color: "#007FFF",
            borderColor: "#B4D7FF",
            fontWeight: 500,
          }}
        >
          {highlightText(row.requestedFor)}
        </span>
      );
    },
  },
  {
    key: "reason",
    label: "Reason",
    width: 320,
    render: (row, { highlightText, density }) => (
      <span
        className={`${density === "comfort" ? "text-[13.5px]" : "text-sm"} truncate block max-w-[300px]`}
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
    render: (row, { density }) => (
      <span className={density === "comfort" ? "text-[13.5px]" : "text-sm"} style={{ color: "#475569" }}>
        {row.requestedOn}
      </span>
    ),
  },
  {
    key: "status",
    label: "Status",
    width: 130,
    render: (row, { density }) => (
      <StatusBadge
        status={row.status}
        configMap={REQUEST_STATUS_MAP}
        displayLabel={REQUEST_STATUS_LABELS[row.status]}
        comfort={density === "comfort"}
      />
    ),
  },
];

/* ─── Quick filter definitions ─── */
export const USER_REQUESTS_QUICK_FILTERS: QuickFilterDef[] = [
  { key: "all", label: "Show All", showCount: false },
  { key: "accepted", label: "Approved", showCount: true },
  { key: "pending", label: "Pending", showCount: true },
  { key: "rejected", label: "Rejected", showCount: true },
];

/* ─── Search predicate ─── */
export function userRequestsSearchPredicate(
  row: UserRequestRow,
  query: string
): boolean {
  return (
    row.requestedBy.toLowerCase().includes(query) ||
    row.requestedFor.toLowerCase().includes(query) ||
    row.reason.toLowerCase().includes(query)
  );
}

/* ─── Filter predicate ─── */
export function userRequestsFilterPredicate(
  row: UserRequestRow,
  filterKey: string
): boolean {
  switch (filterKey) {
    case "accepted":
      return row.status === "Accepted";
    case "pending":
      return row.status === "Pending";
    case "rejected":
      return row.status === "Rejected";
    default:
      return true;
  }
}

/* ─── Actions renderer: 3-dot dropdown matching other listings.
   Pending rows expose Accept / Reject / View details; resolved rows
   (already approved or rejected) only expose View details. ─── */
export function UserRequestsActionMenu({
  row,
  onApprove,
  onReject,
  onViewDetails,
}: {
  row: UserRequestRow;
  onApprove?: (row: UserRequestRow) => void;
  onReject?: (row: UserRequestRow) => void;
  onViewDetails?: (row: UserRequestRow) => void;
}) {
  const access = useAccessMode();
  /* Approve / Reject are `capability && statusAllows` — viewing the queue and
   * acting on it stay separate capabilities, so a persona can reach a request
   * row and still be offered View details only. (Users and Roles v1.3 retired
   * both backing permissions when Permission Requests was deferred out of
   * Pioneer; the split lives on in `access-mode.tsx` alone.) */
  const isPending = row.status === "Pending";
  const showDecision = isPending && access.canApproveRequests;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
          aria-label="Row actions"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 z-[9999]" onClick={(e) => e.stopPropagation()}>
        {showDecision && (
          <>
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-[#059669] focus:text-[#059669] focus:bg-[#ECFDF5]"
              onSelect={() => {
                if (onApprove) {
                  onApprove(row);
                } else {
                  toast.success(`Request from ${row.requestedBy} approved.`);
                }
              }}
            >
              <Check className="w-4 h-4 text-[#059669]" />
              Accept
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-[#DC2626] focus:text-[#DC2626] focus:bg-[#FEF2F2]"
              onSelect={() => {
                if (onReject) {
                  onReject(row);
                } else {
                  toast.error(`Request from ${row.requestedBy} rejected.`);
                }
              }}
            >
              <X className="w-4 h-4 text-[#DC2626]" />
              Reject
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem
          className="cursor-pointer gap-2"
          onSelect={() => onViewDetails?.(row)}
        >
          <Eye className="w-4 h-4" />
          View details
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
