import { useState, useMemo, useCallback, useEffect } from "react";
import { X, User, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { users, type UserRow } from "../../data/users-data";
import { AvatarCell } from "../table-cells";
import { USER_AVATAR_MAP } from "../../data/user-avatars";
import { CURRENT_USER } from "../../data/current-user";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  assignRoleOwners,
  getRoleOwnerUserIds,
} from "../../data/role-owners-data";
import {
  getRoleDetail,
  addUsersToRole,
} from "../../data/role-detail-data";
import { DataTable } from "../data-table/DataTable";
import {
  USERS_COLUMNS,
  usersSearchPredicate,
} from "../../data/users-table-config";
import type {
  RenderHelpers,
  QuickFilterDef,
} from "../data-table/types";
import {
  ConfirmRoleOwnerAssignmentModal,
  type OwnerDecision,
} from "./ConfirmRoleOwnerAssignmentModal";
import {
  multiOwnerAssignedMessage,
  singleOwnerAssignedMessage,
} from "../../lib/role-owner-toasts";

interface Props {
  open: boolean;
  onClose: () => void;
  roleId: number;
  roleName: string;
  /** All users currently assigned to this role */
  assignedUserIds: number[];
}

/* Same trimmed column set used in Step3AssignUsers */
const ALLOWED_KEYS = new Set([
  "full_name",
  "assigned_roles",
  "license",
  "email",
  "status",
]);

const OWNER_QUICK_FILTERS: QuickFilterDef[] = [
  { key: "all", label: "Show All", showCount: false },
  { key: "already_on_role", label: "Already on This Role", showCount: true },
];

export function AssignRoleOwnerModal({
  open,
  onClose,
  roleId,
  roleName,
  assignedUserIds,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<(number | string)[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  /* Reset on close */
  useEffect(() => {
    if (!open) {
      setSelectedIds([]);
      setConfirmOpen(false);
    }
  }, [open]);

  const existingOwnerIds = useMemo(
    () => {
      void open;
      return new Set(getRoleOwnerUserIds(roleId));
    },
    [roleId, open],
  );

  /* Live set of users currently on the role, used by the "Already on this role" filter
   * AND by the holder/non-holder split at confirmation time. */
  const holderIdSet = useMemo(
    () => {
      void open; // re-read live assignments whenever the modal reopens
      const live = getRoleDetail(roleId)?.assignedUserIds ?? assignedUserIds;
      return new Set(live);
    },
    [assignedUserIds, roleId, open],
  );

  /* Candidate pool: any Active or Invite Sent user who isn't already an owner.
   * Deactivated, Archived, and Invite Expired users are hidden from the modal entirely. */
  const candidateUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          !existingOwnerIds.has(u.id) &&
          (u.status === "Active" || u.status === "Invite Sent"),
      ),
    [existingOwnerIds],
  );

  const filterPredicate = useCallback(
    (row: UserRow, filterKey: string) => {
      if (filterKey === "already_on_role") return holderIdSet.has(row.id);
      return true;
    },
    [holderIdSet],
  );

  const getRowId = useCallback((row: UserRow) => row.id, []);

  /* Slim columns w/ avatar+email subtitle in comfort mode. No eligibility chip:
   * eligibility is no longer a concept for ownership. */
  const slimColumns = useMemo(
    () =>
      USERS_COLUMNS.filter((c) => ALLOWED_KEYS.has(c.key)).map((col) => {
        if (col.key !== "full_name") return col;
        return {
          ...col,
          render: (row: UserRow, helpers: RenderHelpers) => {
            const isComfort = helpers.density === "comfort";
            return (
              <AvatarCell
                name={row.fullName}
                nameNode={helpers.highlightText(row.fullName)}
                subtitle={isComfort ? row.email : undefined}
                subtitleNode={
                  isComfort ? helpers.highlightText(row.email) : undefined
                }
                comfort={isComfort}
                avatarUrl={USER_AVATAR_MAP[row.id]}
                userId={row.id}
              />
            );
          },
        };
      }),
    [],
  );

  /* "Not Sure Who to Pick?" inline help drawer/popover */
  const [helpOpen, setHelpOpen] = useState(false);
  const filterPillsAction = useMemo(
    () => (
      <Popover open={helpOpen} onOpenChange={setHelpOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onMouseEnter={() => setHelpOpen(true)}
            onMouseLeave={() => setHelpOpen(false)}
            onFocus={() => setHelpOpen(true)}
            onBlur={() => setHelpOpen(false)}
            className="inline-flex items-center gap-1 text-[12.5px] text-amber-600 underline decoration-dotted underline-offset-[3px] hover:text-amber-700 cursor-pointer transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Not Sure Who to Pick?
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onMouseEnter={() => setHelpOpen(true)}
          onMouseLeave={() => setHelpOpen(false)}
          className="w-[340px] p-4"
        >
          <p
            className="text-[12.5px] text-[#0F172A] mb-2"
            style={{ fontWeight: 600 }}
          >
            Not Sure Who to Pick?
          </p>
          <p className="text-[12px] text-[#475569] leading-[1.6]">
            A role owner does not have to hold the role themselves. Sometimes
            the best owner is someone who does hold the role, like a senior
            customer support agent maintaining the Customer Support Agent role.
            Other times the best owner is someone who does not hold the role at
            all, like an HR business partner or an operations lead who
            approves access for it. Pick whoever should be accountable for who
            gets this access.
          </p>
        </PopoverContent>
      </Popover>
    ),
    [helpOpen],
  );

  /* ─── Selection composition ─── */
  const numericSelectedIds = useMemo(
    () => selectedIds.map((id) => Number(id)),
    [selectedIds],
  );
  const holderSelectedIds = useMemo(
    () => numericSelectedIds.filter((id) => holderIdSet.has(id)),
    [numericSelectedIds, holderIdSet],
  );
  const nonHolderSelectedIds = useMemo(
    () => numericSelectedIds.filter((id) => !holderIdSet.has(id)),
    [numericSelectedIds, holderIdSet],
  );

  /* Append to the role's activity log */
  const appendActivity = useCallback(
    (entry: {
      title: string;
      description: string;
      type: "config_change" | "user_assigned";
    }) => {
      const detail = getRoleDetail(roleId);
      if (!detail) return;
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const yyyy = now.getFullYear();
      const hh = String(now.getHours()).padStart(2, "0");
      const min = String(now.getMinutes()).padStart(2, "0");
      detail.activityLog.unshift({
        id: `${roleId}-${entry.type}-${now.getTime()}-${Math.random()}`,
        type: entry.type,
        title: entry.title,
        description: entry.description,
        timestamp: `${mm}/${dd}/${yyyy} - ${hh}:${min}`,
        actor: CURRENT_USER.name,
      });
    },
    [roleId],
  );

  /* Finalise: for both the all-holders direct path and the post-confirm
   * compound path. `addedIds` is the subset that was newly added to the
   * role as part of this action. */
  const finalizeAssignment = useCallback(
    (addedIds: number[]) => {
      const allOwnerIds = numericSelectedIds;

      addedIds.forEach((id) => {
        const u = users.find((user) => user.id === id);
        appendActivity({
          type: "user_assigned",
          title: "User Added to Role",
          description: `${u?.fullName ?? "User"} was added to ${roleName} (compound owner assignment)`,
        });
      });

      assignRoleOwners(roleId, allOwnerIds);

      const ownerNames = allOwnerIds
        .map((id) => users.find((u) => u.id === id)?.fullName)
        .filter(Boolean)
        .join(", ");
      appendActivity({
        type: "config_change",
        title:
          allOwnerIds.length === 1
            ? "Role owner assigned"
            : "Role owners assigned",
        description:
          allOwnerIds.length === 1
            ? `${ownerNames} was designated as a Role Owner`
            : `${allOwnerIds.length} users were designated as Role Owners (${ownerNames})`,
      });

      /* Toast: spec wording */
      const totalOwners = allOwnerIds.length;
      const addedSet = new Set(addedIds);

      if (totalOwners === 1) {
        const uid = allOwnerIds[0];
        const u = users.find((user) => user.id === uid);
        toast.success(
          singleOwnerAssignedMessage({
            userName: u?.fullName ?? "User",
            roleName,
            wasHolder: holderIdSet.has(uid),
            alsoAddedToRole: addedSet.has(uid),
          }),
        );
      } else {
        toast.success(multiOwnerAssignedMessage(totalOwners, roleName));
      }

      setConfirmOpen(false);
      onClose();
    },
    [numericSelectedIds, roleId, roleName, appendActivity, onClose, holderIdSet],
  );

  const handlePrimaryClick = useCallback(() => {
    if (numericSelectedIds.length === 0) return;
    if (nonHolderSelectedIds.length > 0) {
      setConfirmOpen(true);
      return;
    }
    /* All holders: direct assignment. */
    finalizeAssignment([]);
  }, [numericSelectedIds, nonHolderSelectedIds, finalizeAssignment]);

  const handleConfirm = useCallback(
    (decisions: Record<string, OwnerDecision>) => {
      /* Per-user decision: add to role if "owner-and-add", else owner-only. */
      const idsToAdd = nonHolderSelectedIds.filter(
        (uid) => decisions[String(uid)] === "owner-and-add",
      );
      const addedIds = addUsersToRole(roleId, idsToAdd);
      finalizeAssignment(addedIds);
      void holderSelectedIds; // holderSelectedIds is implicit in numericSelectedIds
    },
    [roleId, nonHolderSelectedIds, holderSelectedIds, finalizeAssignment],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative bg-white rounded-xl shadow-xl flex flex-col w-full max-w-[1100px] h-[88vh]"
        style={{ border: "1px solid #E2E8F0" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] shrink-0">
          <div>
            <h2
              className="text-[16px] text-[#0F172A]"
              style={{ fontWeight: 600 }}
            >
              Assign a Role Owner
            </h2>
            <p className="text-[13px] text-[#64748B] mt-0.5">
              Pick the users you want to maintain{" "}
              <span style={{ fontWeight: 500 }}>{roleName}</span>. Role owners
              can add or remove users on this role and approve access requests
              for it.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[#F1F5F9] flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4 text-[#64748B]" />
          </button>
        </div>

        {/* DataTable: same component as Assign Users step */}
        <div className="flex-1 min-h-0 flex flex-col p-5">
          <div
            className="rounded-xl border overflow-hidden bg-white flex-1 min-h-0 flex flex-col"
            style={{ borderColor: "#E2E8F0" }}
          >
            <DataTable<UserRow>
              data={candidateUsers}
              columns={slimColumns}
              getRowId={getRowId}
              searchPlaceholder="Search by name, type, or email..."
              searchPredicate={usersSearchPredicate}
              quickFilters={OWNER_QUICK_FILTERS}
              filterPredicate={filterPredicate}
              showMeMode={false}
              emptyIcon={<User className="w-8 h-8" />}
              emptyMessage="No users available"
              entityLabel="users"
              selectedIds={selectedIds}
              onSelectedIdsChange={setSelectedIds}
              selectOnRowClick
              hideBulkBar
              defaultDensity="condensed"
              persistKey={`assign-role-owner:${roleId}`}
              filterPillsAction={filterPillsAction}
              countOverride={({ selectedCount }) => (
                <>
                  <span style={{ color: "#007FFF", fontWeight: 600 }}>
                    {selectedCount}
                  </span>
                  <span style={{ color: "#007FFF" }}>
                    {" "}
                    user{selectedCount === 1 ? "" : "s"} selected
                  </span>
                </>
              )}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#E2E8F0] shrink-0">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] text-[#334155] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={handlePrimaryClick}
            disabled={selectedIds.length === 0}
            className="h-9 px-4 rounded-[8px] bg-[#007FFF] text-white text-[13px] hover:bg-[#0066D6] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontWeight: 500 }}
          >
            Assign as Role Owner
          </button>
        </div>
      </div>

      {/* ── Compound action confirmation (modal-within-modal) ── */}
      <ConfirmRoleOwnerAssignmentModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        context={{
          kind: "single-role",
          roleName,
          ineligibleUserIds: nonHolderSelectedIds,
        }}
      />
    </div>
  );
}
