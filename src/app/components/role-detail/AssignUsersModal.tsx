import { useState, useCallback, useMemo, useEffect } from "react";
import { X, User, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import { users } from "../../data/users-data";
import type { UserRow, LicenseType } from "../../data/users-data";
import { AvatarCell, StatusBadge, LicenseBadge } from "../table-cells";
import { DataTable } from "../data-table/DataTable";
import {
  USERS_COLUMNS,
  USERS_QUICK_FILTERS,
  usersSearchPredicate,
  usersFilterPredicate,
} from "../../data/users-table-config";
import type { RenderHelpers } from "../data-table/types";
import { cardShellClass } from "../data-table/types";
import {
  InactiveOrUnlicensedWarningModal,
  findAtRiskUsers,
} from "../shared/InactiveOrUnlicensedWarningModal";
import { UpgradeLicenseModal } from "../shared/LicenseModals";
import { addUsersToRole } from "../../data/role-detail-data";
import { findUnderLicensedUsers } from "../../lib/permission-tier";

interface Props {
  open: boolean;
  onClose: () => void;
  /** ID of the role users are being assigned to (drives the canonical mutation). */
  roleId: number;
  alreadyAssignedIds: number[];
  roleName: string;
  /** License tier required by the role being assigned. */
  roleLicenseRequired?: LicenseType;
}

/** Slim column set: must match Step3AssignUsers in the Create Role flow. */
const ALLOWED_KEYS = new Set(["full_name", "assigned_roles", "license", "email", "status"]);

export function AssignUsersModal({
  open,
  onClose,
  roleId,
  alreadyAssignedIds,
  roleName,
  roleLicenseRequired = "Field User",
}: Props) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [warningOpen, setWarningOpen] = useState(false);
  const [licenseUpgradeOpen, setLicenseUpgradeOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const getRowId = useCallback((row: UserRow) => row.id, []);

  const slimColumns = useMemo(
    () =>
      USERS_COLUMNS.filter((c) => ALLOWED_KEYS.has(c.key)).map((c) => {
        // In this assign flow License/Status are informational only, render
        // read-only badges instead of the interactive dropdowns.
        if (c.key === "license") {
          return { ...c, render: (row: UserRow) => <LicenseBadge license={row.license} showNoLicense /> };
        }
        if (c.key === "status") {
          return { ...c, render: (row: UserRow) => <StatusBadge status={row.status} /> };
        }
        return c;
      }),
    []
  );

  /* Eligible pool: exclude already-assigned plus users that can't take a role
   * (invited/expired/archived). Inactive + No-License users remain in pool and
   * trigger the warning modal on confirm (matches prior behavior). */
  const eligibleUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          !alreadyAssignedIds.includes(u.id) &&
          u.status !== "Invite Sent" &&
          u.status !== "Invite Expired" &&
          u.status !== "Archived"
      ),
    [alreadyAssignedIds]
  );

  /* Same quick-filter trim as Step3AssignUsers. */
  const eligibleQuickFilters = useMemo(
    () =>
      USERS_QUICK_FILTERS.filter(
        (f) =>
          f.key !== "invite_sent" &&
          f.key !== "invite_expired" &&
          f.key !== "archived"
      ),
    []
  );

  const renderCard = useCallback(
    (row: UserRow, helpers: RenderHelpers) => (
      <div className={cardShellClass(helpers.cardSize)}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <AvatarCell name={row.fullName} userId={row.id} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <StatusBadge status={row.status} />
          <LicenseBadge license={row.license} />
        </div>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Email</span>
            <span className="text-foreground truncate max-w-[60%] text-right">
              {row.email}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Roles</span>
            <span className="text-foreground" style={{ fontWeight: 500 }}>
              {row.assignedRoles.length} assigned
            </span>
          </div>
        </div>
      </div>
    ),
    []
  );

  const selectedUsers = useMemo(
    () => users.filter((u) => selectedIds.includes(u.id)),
    [selectedIds]
  );
  const atRiskUsers = useMemo(() => findAtRiskUsers(selectedUsers), [selectedUsers]);

  /* Under-licensed users for a Full Access role: drives Modal B (UpgradeLicenseModal).
   * Excludes users already covered by Modal A (Inactive / No License). */
  const atRiskIds = useMemo(() => new Set(atRiskUsers.map((u) => u.id)), [atRiskUsers]);
  const underLicensedUsers = useMemo(
    () =>
      findUnderLicensedUsers(selectedUsers, roleLicenseRequired).filter(
        (u) => !atRiskIds.has(u.id)
      ),
    [selectedUsers, roleLicenseRequired, atRiskIds]
  );

  /* Subset of at-risk users that also need a license upgrade: surfaces inline note. */
  const atRiskAlsoNeedingLicenseIds = useMemo(
    () =>
      findUnderLicensedUsers(atRiskUsers, roleLicenseRequired).map((u) => u.id),
    [atRiskUsers, roleLicenseRequired]
  );

  const finalizeAssign = useCallback(() => {
    // Persist to the canonical store, this updates the role's user list and
    // notifies subscribers so the Users tab re-renders with the new members.
    const added = addUsersToRole(roleId, selectedIds);
    const n = added.length;
    toast.success(`${n} user${n !== 1 ? "s" : ""} added to ${roleName}.`);
    setSelectedIds([]);
    setWarningOpen(false);
    setLicenseUpgradeOpen(false);
    onClose();
  }, [roleId, selectedIds, roleName, onClose]);

  /* Modal A → Modal B → finalize chain. */
  const advancePastWarningA = useCallback(() => {
    setWarningOpen(false);
    if (underLicensedUsers.length > 0) {
      setLicenseUpgradeOpen(true);
      return;
    }
    finalizeAssign();
  }, [underLicensedUsers.length, finalizeAssign]);

  const advancePastUpgrade = useCallback(() => {
    setLicenseUpgradeOpen(false);
    toast.success(
      `${underLicensedUsers.length} user license${underLicensedUsers.length !== 1 ? "s" : ""} will be upgraded on assignment.`
    );
    finalizeAssign();
  }, [underLicensedUsers.length, finalizeAssign]);

  const handleAssign = useCallback(() => {
    if (atRiskUsers.length > 0) {
      setWarningOpen(true);
      return;
    }
    if (underLicensedUsers.length > 0) {
      setLicenseUpgradeOpen(true);
      return;
    }
    finalizeAssign();
  }, [atRiskUsers.length, underLicensedUsers.length, finalizeAssign]);

  const handleClose = useCallback(() => {
    setSelectedIds([]);
    setWarningOpen(false);
    setLicenseUpgradeOpen(false);
    onClose();
  }, [onClose]);

  /* Reset selection whenever the modal is reopened. */
  useEffect(() => {
    if (open) {
      setSelectedIds([]);
      setIsFullScreen(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* Modal */}
      <div
        className={`relative bg-white shadow-xl flex flex-col mx-4 overflow-hidden transition-[max-width,max-height,width,height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isFullScreen
            ? "w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] rounded-2xl"
            : "w-full max-w-[1200px] h-[88vh] rounded-xl"
        }`}
        style={{ border: "1px solid #E2E8F0" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] shrink-0">
          <div>
            <h2 className="text-[16px] text-[#0F172A]" style={{ fontWeight: 600 }}>
              Add User
            </h2>
            <p className="text-[13px] text-[#64748B] mt-0.5">
              Select users to assign to <span style={{ fontWeight: 500 }}>{roleName}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {isFullScreen ? "Exit full" : "Full view"}
            </button>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg hover:bg-[#F1F5F9] flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4 text-[#64748B]" />
            </button>
          </div>
        </div>

        {/* Body: DataTable matches Step 3 of Create Role */}
        <div className="flex-1 min-h-0 flex flex-col p-5 bg-[#F8FAFC]">
          <div
            className="rounded-xl border overflow-hidden bg-white flex-1 min-h-0 flex flex-col"
            style={{ borderColor: "#E2E8F0" }}
          >
            <DataTable<UserRow>
              data={eligibleUsers}
              columns={slimColumns}
              getRowId={getRowId}
              searchPlaceholder="Search by name, type, or email..."
              searchPredicate={usersSearchPredicate}
              quickFilters={eligibleQuickFilters}
              filterPredicate={usersFilterPredicate}
              showMeMode={false}
              emptyIcon={<User className="w-8 h-8" />}
              emptyMessage="No users found"
              renderCard={renderCard}
              entityLabel="users"
              selectedIds={selectedIds}
              onSelectedIdsChange={(ids) => setSelectedIds(ids as number[])}
              selectOnRowClick
              hideBulkBar
              defaultDensity="condensed"
              defaultActiveFilters={["active", "full", "field"]}
              persistKey={`role-detail:assign-users:${roleName}`}
              countOverride={({ selectedCount }) => (
                <>
                  <span style={{ color: "#475569", fontWeight: 600 }}>{selectedCount}</span>
                  <span style={{ color: "#475569" }}> user{selectedCount === 1 ? "" : "s"} selected</span>
                </>
              )}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-[#E2E8F0] shrink-0 bg-white rounded-b-xl">
          <button
            onClick={handleClose}
            className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] text-[#334155] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={selectedIds.length === 0}
            className="h-9 px-4 rounded-[8px] bg-[#007FFF] text-white text-[13px] hover:bg-[#0066D6] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontWeight: 500 }}
          >
            Assign {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
          </button>
        </div>
      </div>

      {/* Inactive / no-license warning (Modal A) */}
      <InactiveOrUnlicensedWarningModal
        open={warningOpen}
        users={atRiskUsers}
        assignmentLabel={roleName}
        assignmentType="role"
        licenseDeficientIds={atRiskAlsoNeedingLicenseIds}
        onContinue={advancePastWarningA}
        onGoBack={() => setWarningOpen(false)}
      />

      {/* License upgrade modal (Modal B): single or bulk variant */}
      {underLicensedUsers.length === 1 ? (
        <UpgradeLicenseModal
          open={licenseUpgradeOpen}
          onClose={() => setLicenseUpgradeOpen(false)}
          userName={underLicensedUsers[0].fullName}
          userEmail={underLicensedUsers[0].email}
          onConfirm={advancePastUpgrade}
          onAssignWithoutUpgrade={finalizeAssign}
        />
      ) : (
        <UpgradeLicenseModal
          open={licenseUpgradeOpen}
          onClose={() => setLicenseUpgradeOpen(false)}
          users={underLicensedUsers.map((u) => ({ name: u.fullName, email: u.email }))}
          onConfirm={advancePastUpgrade}
          onAssignWithoutUpgrade={finalizeAssign}
        />
      )}
    </div>
  );
}
