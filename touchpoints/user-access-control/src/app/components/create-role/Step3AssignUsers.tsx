import type { RenderHelpers } from "../data-table/types";
import { cardShellClass } from "../data-table/types";
import { useCallback, useMemo } from "react";
import { User } from "lucide-react";
import { DataTable } from "../data-table/DataTable";
import { users } from "../../data/users-data";
import type { UserRow } from "../../data/users-data";
import {
  USERS_COLUMNS,
  USERS_QUICK_FILTERS,
  usersSearchPredicate,
  usersFilterPredicate,
  LicenseBadgeCell,
  StatusBadgeCell,
} from "../../data/users-table-config";
import { AvatarCell, StatusBadge, LicenseBadge } from "../table-cells";
import type { CreateRoleFormData } from "./types";

/** Slim column set for the assign-users step: name, roles, license, email, status. */
const ALLOWED_KEYS = new Set(["full_name", "assigned_roles", "license", "email", "status"]);

interface Step3Props {
  formData: CreateRoleFormData;
  onFieldChange: <K extends keyof CreateRoleFormData>(
    key: K,
    value: CreateRoleFormData[K]
  ) => void;
  errors: Record<string, string>;
}

export function Step3AssignUsers({
  formData,
  onFieldChange,
  errors,
}: Step3Props) {
  const getRowId = useCallback((row: UserRow) => row.id, []);
  /* License and System Status render as plain chips here. This step is for
   * picking who gets the role, so the listing's dropdowns would offer to start
   * a change-license or change-status flow from inside a half-finished wizard.
   * Sorting and filtering on both columns are untouched. */
  const slimColumns = useMemo(
    () =>
      USERS_COLUMNS.filter((c) => ALLOWED_KEYS.has(c.key)).map((col) => {
        if (col.key === "license") {
          return {
            ...col,
            render: (row: UserRow, { density }: RenderHelpers) => (
              <LicenseBadgeCell row={row} comfort={density === "comfort"} />
            ),
          };
        }
        if (col.key === "status") {
          return {
            ...col,
            render: (row: UserRow, { density }: RenderHelpers) => (
              <StatusBadgeCell row={row} comfort={density === "comfort"} />
            ),
          };
        }
        return col;
      }),
    []
  );

  /* Exclude users who can't take on a new role: invited (not yet accepted),
   * expired invite, or archived. Inactive users remain eligible, admins
   * may want to pre-assign roles before reactivating them. */
  const eligibleUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.status !== "Invite Sent" &&
          u.status !== "Invite Expired" &&
          u.status !== "Archived"
      ),
    []
  );

  /* Hide status chips that no longer apply to the eligible set.
   * Keep "inactive" so admins can opt-in to view inactive users. */
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
    (
      row: UserRow,
      helpers: RenderHelpers
    ) => (
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

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">

      {/* Users DataTable, fills remaining space, scrolls internally */}
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
          selectedIds={formData.assignedUsers}
          onSelectedIdsChange={(ids) =>
            onFieldChange("assignedUsers", ids as number[])
          }
          selectOnRowClick
          hideBulkBar
          defaultDensity="condensed"
          /* Default: only Active + licensed users (Full Access OR Field User).
           * "Show All" remains an explicit opt-in pill. */
          defaultActiveFilters={["active", "full", "field"]}
          persistKey="create-role:assign-users"
          countOverride={({ selectedCount }) => (
            <>
              <span style={{ color: "#007FFF", fontWeight: 600 }}>{selectedCount}</span>
              <span style={{ color: "#007FFF" }}> user{selectedCount === 1 ? "" : "s"} selected</span>
            </>
          )}
        />
      </div>
      {errors.assignedUsers && (
        <p className="text-[#EF4444] text-xs shrink-0">{errors.assignedUsers}</p>
      )}
    </div>
  );
}