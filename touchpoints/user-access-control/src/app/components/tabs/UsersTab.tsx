import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "lucide-react";
import { DataTable } from "../data-table/DataTable";
import type { UserRow } from "../../data/users-data";
import {
  USERS_COLUMNS,
  USERS_QUICK_FILTERS,
  usersSearchPredicate,
  usersFilterPredicate,
  usersMeModePredicate,
  UsersActionMenu,
  buildUsersAdvancedFilter,
} from "../../data/users-table-config";
import { updateUserRowState, useResolvedUsersData } from "../../data/users-row-store";
import type { RenderHelpers } from "../data-table/types";
import { UserCard } from "./UserCard";
import { UsersBulkActions } from "./UsersBulkActions";
import { removeUserFromAllRoles } from "../../data/uac-derived";
import { isAccountOwner } from "../../data/account-owner";

interface UsersTabProps {
  insightsSlot?: React.ReactNode;
  /** Notifies parent of live filter state (so the page-header Export button can read filtered/total counts). */
  onListStatsChange?: (info: { filteredCount: number; totalCount: number }) => void;
  /** Notifies parent of the filtered/sorted row data (so Export can ship the visible rows). */
  onFilteredRowsChange?: (rows: UserRow[]) => void;
  /** Export modal scope actions, forwarded to the table. */
  tableCommand?: { kind: "clearFilters" | "selectAll"; seq: number };
  /** Notifies parent of live column visibility (so the Export modal can pre-check visible columns). */
  onColumnVisibilityChange?: (visibility: Record<string, boolean>) => void;
  /** Called when the bulk action bar's Export button is clicked, with the currently selected rows. */
  onBulkExport?: (selectedRows: UserRow[]) => void;
}

export function UsersTab({ insightsSlot, onListStatsChange, onFilteredRowsChange, tableCommand, onColumnVisibilityChange, onBulkExport }: UsersTabProps) {
  const navigate = useNavigate();
  const tableUsers = useResolvedUsersData();
  const advancedFilter = useMemo(() => buildUsersAdvancedFilter(tableUsers), [tableUsers]);

  const getRowId = useCallback((row: UserRow) => row.id, []);
  const renderActions = useCallback(
    (row: UserRow) => <UsersActionMenu row={row} />,
    []
  );

  const handleRowClick = useCallback(
    (row: UserRow) => {
      const requestedTab = sessionStorage.getItem("uac_open_tab");
      if (requestedTab) return;
      navigate(`/company-settings/user-access-control/user/${row.id}`);
    },
    [navigate]
  );

  const renderCard = useCallback(
    (row: UserRow, helpers: RenderHelpers) => (
      <UserCard
        row={row}
        onRowClick={handleRowClick}
        renderActions={renderActions}
        bulkActive={helpers.selectionActive}
        size={helpers.cardSize}
      />
    ),
    [handleRowClick, renderActions]
  );

  const bulkActionsSlot = useCallback(
    (selectedCount: number, selectedIds: Set<number | string>, onCancel: () => void, activeFilters: Set<string>) => (
      <UsersBulkActions
        selectedCount={selectedCount}
        selectedIds={selectedIds}
        onCancel={onCancel}
        // Archived users only appear under the Archived filter. There, no bulk
        // action applies: archived users are never exported or changed in bulk.
        archivedContext={activeFilters.has("archived")}
        // Defensive: never ship archived users to the export flow even if a
        // selection somehow spans them.
        onExport={() => onBulkExport?.(tableUsers.filter((u) => selectedIds.has(u.id) && u.status !== "Archived"))}
        onDeactivateSelected={() => {
          tableUsers
            // Account Owners (any holder) are excluded from bulk status
            // changes, their status can't be changed by another user.
            //
            // Only an Active user can be deactivated (ERP-5203, ruled 18 Sep
            // 2026), so a selection spanning drafts and invited users deactivates
            // the active ones and leaves the rest where they are. Without this
            // the bulk bar could produce a Deactivated draft, which the single
            // Actions menu no longer offers.
            .filter(
              (user) =>
                selectedIds.has(user.id) &&
                !isAccountOwner(user.id) &&
                user.status === "Active",
            )
            .forEach((user) => updateUserRowState(user.id, { status: "Inactive" }));
        }}
        onArchiveSelected={() => {
          tableUsers
            .filter((user) => selectedIds.has(user.id) && !isAccountOwner(user.id))
            .forEach((user) => {
              removeUserFromAllRoles(user.id);
              updateUserRowState(user.id, { status: "Archived" });
            });
        }}
      />
    ),
    [tableUsers, onBulkExport]
  );

  return (
    <DataTable<UserRow>
      data={tableUsers}
      columns={USERS_COLUMNS}
      getRowId={getRowId}
      searchPlaceholder="Search by name, role, or email..."
      searchPredicate={usersSearchPredicate}
      quickFilters={USERS_QUICK_FILTERS}
      filterPredicate={usersFilterPredicate}
      showMeMode
      meModePredicate={usersMeModePredicate}
      meModeTooltip="Show only users you created, last edited, or invited."
      emptyIcon={<User className="w-8 h-8" />}
      emptyMessage="No users found"
      renderActions={renderActions}
      renderCard={renderCard}
      entityLabel="users"
      onRowClick={handleRowClick}
      insightsSlot={insightsSlot}
      bulkActionsSlot={bulkActionsSlot}
      advancedFilter={advancedFilter}
      persistKey="uac:users-list"
      onFilteredCountChange={onListStatsChange}
      onFilteredRowsChange={onFilteredRowsChange}
      tableCommand={tableCommand}
      onColumnVisibilityChange={onColumnVisibilityChange}
      // Archived users are never counted or exported, regardless of the active
      // filter. They still display under the Archived pill (that uses filteredData).
      excludeFromExport={(row) => row.status === "Archived"}
    />
  );
}
