import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Ban, Archive, Download, KeyRound, AlertTriangle, Info } from "lucide-react";

import { DataTable } from "../data-table/DataTable";
import { RoleUsersPopover } from "../shared/RoleUsersPopover";
import { BulkActionBar } from "../data-table/BulkActionBar";
import { BulkDeactivateRolesModal } from "../shared/BulkDeactivateRolesModal";
import { BulkArchiveRolesModal } from "../shared/BulkArchiveRolesModal";
import { sortRolesCustomFirst, roleGroupFn, ROLE_GROUP_LABELS } from "../../data/roles-data";
import type { RoleRow } from "../../data/roles-data";
import {
  ROLES_COLUMNS,
  ROLES_QUICK_FILTERS,
  rolesSearchPredicate,
  rolesFilterPredicate,
  rolesMeModePredicate,
  RolesActionMenu,
  buildRolesAdvancedFilter,
} from "../../data/roles-table-config";
import { updateRoleRowState, useResolvedRolesData } from "../../data/roles-row-store";
import { StatusBadge, LicenseBadge } from "../table-cells";
import { SystemRoleLock } from "../shared/SystemRoleBadge";
import { openAssignPermissions } from "../assign-permissions/assignPermissionsStore";
import { useAccessMode, useGate, useShownGate, isRoleInScope, SCOPE_DENIED_BULK_REASON } from "../access-mode";
import type { RenderHelpers } from "../data-table/types";
import { cardShellClass } from "../data-table/types";

interface RolesTabProps {
  insightsSlot?: React.ReactNode;
  /** Notifies parent of live filter state (so the page-header Export button can read filtered/total counts). */
  onListStatsChange?: (info: { filteredCount: number; totalCount: number }) => void;
  /** Notifies parent of the filtered/sorted row data (so Export can ship the visible rows). */
  onFilteredRowsChange?: (rows: RoleRow[]) => void;
  /** Export modal scope actions, forwarded to the table. */
  tableCommand?: { kind: "clearFilters" | "selectAll"; seq: number };
  /** Notifies parent of live column visibility (so the Export modal can pre-check visible columns). */
  onColumnVisibilityChange?: (visibility: Record<string, boolean>) => void;
  /** Called when the bulk action bar's Export button is clicked, with the currently selected rows. */
  onBulkExport?: (selectedRows: RoleRow[]) => void;
}

export function RolesTab({
  insightsSlot,
  onListStatsChange,
  onFilteredRowsChange,
  tableCommand,
  onColumnVisibilityChange,
  onBulkExport,
}: RolesTabProps) {
  const navigate = useNavigate();
  const access = useAccessMode();
  const tableRoles = useResolvedRolesData();
  const advancedFilter = useMemo(() => buildRolesAdvancedFilter(tableRoles), [tableRoles]);

  /* Draft roles (imported/created but not yet given permissions) grant nothing
   * and can't be used. A flush amber banner sits above the column headers as a
   * persistent nudge, mirroring the Partner Details items-tab banner. It clears
   * itself as each role is set up. */
  const draftRoleIds = useMemo(
    () => tableRoles.filter((r) => r.status === "Draft").map((r) => r.id),
    [tableRoles],
  );

  const headerBanner = useMemo(() => {
    if (draftRoleIds.length === 0) return undefined;
    /* The banner is a call to action, not information — its only affordance is
     * opening the permission set-up flow. A persona that can't author
     * permissions would be shown a dead end, so the banner is withheld. */
    if (!access.canManagePermissions) return undefined;
    const count = draftRoleIds.length;
    const lead =
      count === 1
        ? "1 role has no permissions yet and can't be used."
        : `${count} roles have no permissions yet and can't be used.`;
    // The whole banner is a single clickable target that opens the set-up flow.
    return (
      <button
        type="button"
        onClick={() => openAssignPermissions(draftRoleIds, "listing")}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors cursor-pointer hover:bg-[#FEF3C7]"
        style={{
          backgroundColor: "#FFFBEB",
          borderBottom: "1px solid #FCD34D",
          color: "#92400E",
        }}
      >
        <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#D97706" }} aria-hidden />
        <span className="flex-1 min-w-0 text-[12.5px] leading-snug" style={{ fontWeight: 500 }}>
          {lead}{" "}
          <span
            style={{
              fontWeight: 600,
              textDecoration: "underline",
              textDecorationStyle: "dotted",
              textDecorationColor: "#D97706",
              textUnderlineOffset: "3px",
            }}
          >
            Click to set up permissions.
          </span>
        </span>
      </button>
    );
  }, [draftRoleIds, access.canManagePermissions]);

  const getRowId = useCallback((row: RoleRow) => row.id, []);
  const renderActions = useCallback(
    (row: RoleRow) => <RolesActionMenu row={row} />,
    []
  );

  const renderCard = useCallback(
    (
      row: RoleRow,
      helpers: RenderHelpers
    ) => (
      <div className={cardShellClass(helpers.cardSize)}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {row.isSystem && <SystemRoleLock size={13} />}
              <span
                className="text-sm block"
                style={{ fontWeight: 500, color: "#1E293B" }}
              >
                {row.roleName}
              </span>
            </div>
          </div>
          <div className="shrink-0 ml-2">
            <RolesActionMenu row={row} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <StatusBadge
            status={row.status}
            configMap={{
              Active: { bg: "#ECFDF5", text: "#059669", dot: "#10B981" },
              Inactive: { bg: "#FFFBEB", text: "#D97706", dot: "#F59E0B", label: "Deactivated" },
              Archived: { bg: "#FEF2F2", text: "#DC2626", dot: "#EF4444" },
              Draft: { bg: "#F8FAFC", text: "#64748B", dot: "#94A3B8" },
            }}
          />
          <LicenseBadge license={row.licenseRequired} />
        </div>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Description</span>
            <span className="text-foreground truncate max-w-[60%] text-right">
              {row.description}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>Users</span>
            <RoleUsersPopover roleId={row.id} usersCount={row.usersCount} />
          </div>
        </div>
      </div>
    ),
    []
  );

  const handleRowClick = useCallback(
    (row: RoleRow) => {
      navigate(`/company-settings/user-access-control/role/${row.id}`);
    },
    [navigate]
  );

  const bulkActionsSlot = useCallback(
    (selectedCount: number, selectedIds: Set<number | string>, onCancel: () => void, activeFilters: Set<string>) => {
      const selectedRoles = tableRoles.filter((r) => selectedIds.has(r.id));
      // Predefined (system) roles are managed by the system: their status can't
      // be changed, so bulk Deactivate/Archive skip them and their counts,
      // mirroring how protected users are excluded in the user listing. Draft
      // roles are skipped the same way: a Draft role leaves Draft only when a
      // permission is added (ERP-5520 AC3).
      const statusEligibleIds = selectedRoles
        .filter((r) => !r.isSystem && r.status !== "Draft")
        .map((r) => r.id);
      const predefinedSelectedCount = selectedRoles.filter((r) => r.isSystem).length;
      const draftExcludedCount = selectedRoles.filter((r) => !r.isSystem && r.status === "Draft").length;
      return (
        <RolesBulkActions
          selectedCount={selectedCount}
          onCancel={onCancel}
          archivedContext={activeFilters.has("archived")}
          // Ids of the selected roles that are still Draft (no permissions),
          // the only ones the "Set up permissions" bulk action targets.
          draftSelectedIds={selectedRoles
            .filter((r) => r.status === "Draft")
            .map((r) => r.id)}
          // Non-predefined selected roles, the only ones a bulk status change
          // applies to, plus the count of predefined roles excluded.
          statusEligibleIds={statusEligibleIds}
          predefinedSelectedCount={predefinedSelectedCount}
          draftExcludedCount={draftExcludedCount}
          // Every selected id, so the bar can scope-check the selection. Rows
          // outside the viewer's Manage Roles scope stay selectable for exactly
          // the reason predefined rows do: Export still applies to them.
          selectedRoleIds={selectedRoles.map((r) => r.id)}
          // Defensive: never ship archived roles to the export flow.
          onExport={() => onBulkExport?.(selectedRoles.filter((r) => r.status !== "Archived"))}
          onDeactivateSelected={() => {
            statusEligibleIds.forEach((id) => updateRoleRowState(id, { status: "Inactive" }));
          }}
          onArchiveSelected={() => {
            statusEligibleIds.forEach((id) => updateRoleRowState(id, { status: "Archived" }));
          }}
        />
      );
    },
    [tableRoles, onBulkExport]
  );

  return (
    <DataTable<RoleRow>
      data={tableRoles}
      columns={ROLES_COLUMNS}
      headerBanner={headerBanner}
      fixedLayout
      getRowId={getRowId}
      searchPlaceholder="Search by role name or description..."
      searchPredicate={rolesSearchPredicate}
      quickFilters={ROLES_QUICK_FILTERS}
      filterPredicate={rolesFilterPredicate}
      showMeMode
      meModePredicate={rolesMeModePredicate}
      meModeTooltip="Show only roles you created, last edited, own, or are assigned to."
      emptyIcon={<Shield className="w-8 h-8" />}
      emptyMessage="No roles found"
      renderActions={renderActions}
      renderCard={renderCard}
      entityLabel="roles"
      onRowClick={handleRowClick}
      insightsSlot={insightsSlot}
      bulkActionsSlot={bulkActionsSlot}
      advancedFilter={advancedFilter}
      persistKey="uac:roles-list"
      sortFn={sortRolesCustomFirst}
      rowGroupFn={roleGroupFn}
      rowGroupLabels={ROLE_GROUP_LABELS}
      onFilteredCountChange={onListStatsChange}
      onFilteredRowsChange={onFilteredRowsChange}
      tableCommand={tableCommand}
      onColumnVisibilityChange={onColumnVisibilityChange}
      // Archived roles are never counted or exported, regardless of the active
      // filter. They still display under the Archived pill (that uses filteredData).
      excludeFromExport={(row) => row.status === "Archived"}
    />
  );
}

/* ─── Roles Bulk Actions with confirmation modals ─── */

function RolesBulkActions({
  selectedCount,
  onCancel,
  onExport,
  onDeactivateSelected,
  onArchiveSelected,
  draftSelectedIds = [],
  statusEligibleIds = [],
  predefinedSelectedCount = 0,
  draftExcludedCount = 0,
  selectedRoleIds = [],
  archivedContext = false,
}: {
  selectedCount: number;
  onCancel: () => void;
  onExport?: () => void;
  onDeactivateSelected?: () => void;
  onArchiveSelected?: () => void;
  /** Selected role ids still in Draft; drives the "Set up permissions" action. */
  draftSelectedIds?: number[];
  /** Selected role ids whose status can actually change (non-predefined). The
   *  Deactivate/Archive modals only ever see these. */
  statusEligibleIds?: number[];
  /** How many selected roles are predefined (system) and thus excluded from a
   *  bulk status change. Drives the tooltip + disabled state on the buttons. */
  predefinedSelectedCount?: number;
  /** How many selected custom roles are still Draft and thus excluded from a
   *  bulk status change, alongside the predefined ones. */
  draftExcludedCount?: number;
  /** Every selected role id, scope-checked against the active level. Kept
   *  separate from `statusEligibleIds`: that is an ENTITY exclusion
   *  (predefined roles), this is a VIEWER boundary, and they disable different
   *  buttons for different reasons that must not collapse into one count. */
  selectedRoleIds?: number[];
  /** When true (Archived filter active), the Export action is withheld:
   *  archived roles are never exported, regardless of the active filter. */
  archivedContext?: boolean;
}) {
  const access = useAccessMode();
  const gate = useGate();
  const shownGate = useShownGate();
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  /* Scope exclusion. Only the scope-gated bulk action is affected: Set Up
   * Permissions writes a role's permission set, which is the scoped
   * ur-manage-roles grant. Deactivate, Archive and Export are capability- or
   * read-gated and carry no scope, so they stay enabled and keep obeying the
   * predefined and status rules already in place.
   *
   * Unlike the predefined split, this does NOT fall back to acting on the
   * in-scope subset: silently mutating part of what was selected is worse than
   * refusing, so the button disables outright and the tooltip says why. */
  const outOfScopeSelectedCount = useMemo(
    () => selectedRoleIds.filter((id) => !isRoleInScope(id, access)).length,
    [selectedRoleIds, access],
  );
  const scopeBlocked = outOfScopeSelectedCount > 0;

  // Predefined and Draft roles are excluded from bulk status changes. When
  // some are selected the buttons stay usable (they act on the eligible roles)
  // but carry an explanatory tooltip; when EVERY selected role is excluded
  // there's nothing to act on, so the buttons are disabled.
  const hasExcludedPredefined = predefinedSelectedCount > 0;
  const hasExcludedDraft = draftExcludedCount > 0;
  const hasExcluded = hasExcludedPredefined || hasExcludedDraft;
  const statusDisabled = statusEligibleIds.length === 0;
  const plural = (n: number, noun: string) => `${n} ${noun}${n !== 1 ? "s" : ""}`;
  const excludedTooltip = (verb: "deactivated" | "archived") => {
    if (statusDisabled) {
      if (hasExcludedPredefined && hasExcludedDraft) {
        return `Predefined and Draft roles can't be ${verb} in bulk. Predefined role status is managed by the system, and a Draft role leaves Draft only when a permission is added.`;
      }
      return hasExcludedDraft
        ? `Draft roles can't be ${verb}. A Draft role leaves Draft only when a permission is added.`
        : `Predefined roles can't be ${verb} in bulk. Their status is managed by the system and can't be changed.`;
    }
    const eligible = `only the ${plural(statusEligibleIds.length, "eligible role")} will be ${verb}.`;
    if (hasExcludedPredefined && hasExcludedDraft) {
      return `${plural(predefinedSelectedCount, "predefined role")} and ${plural(draftExcludedCount, "Draft role")} will be excluded. Predefined role status is managed by the system, and a Draft role leaves Draft only when a permission is added; ${eligible}`;
    }
    return hasExcludedDraft
      ? `${plural(draftExcludedCount, "Draft role")} will be excluded. A Draft role leaves Draft only when a permission is added; ${eligible}`
      : `${plural(predefinedSelectedCount, "predefined role")} will be excluded. Predefined role status is managed by the system and can't be changed in bulk; ${eligible}`;
  };

  /* ─── Access gating ───
   *
   * The actions are already a declarative array, so gating is a filter on it.
   * `canBulkEdit` is the master switch; each action then adds its own
   * capability. Actions are data, then filtered — the bar collapses to nothing
   * when the array empties, so the whole strip disappears instead of showing
   * an empty bordered row. */
  /* Each bulk action passes its selection/status half and its capability half
   * separately, so an ineligible selection always hides the button while a
   * capability denial follows the header's hidden/disabled setting. */
  const gSetup = gate(draftSelectedIds.length > 0, access.canBulkEdit && access.canManagePermissions);
  /* Export needs only Bulk Export Users and Roles, not the bulk master switch
   * (ERP-5550 AC5), and is shown disabled without it rather than hidden (AC3). */
  const gExport = shownGate(!archivedContext, access.canExportUsers);
  /* Bulk deactivate / archive is its own catalogue permission
   * (ur-bulk-roles-destructive), granted independently of the single-role
   * lifecycle pair, so it takes its own capability rather than borrowing
   * canManageRoleLifecycle: one may never imply the other. */
  const gLifecycle = gate(true, access.canBulkEdit && access.canBulkRoleLifecycle);

  const actions = [
    // Shown only when the selection includes Draft roles: sets up their
    // permissions in the guided flow, which activates them.
    ...(gSetup.render
      ? [
          {
            key: "setup-permissions",
            label: "Set Up Permissions",
            icon: <KeyRound className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} />,
            variant: "default" as const,
            disabled: gSetup.disabled || scopeBlocked,
            /* Capability denial keeps precedence: when the level can't author
               permissions at all, scope is not the reason to name. */
            tooltip: gSetup.reason || (scopeBlocked ? SCOPE_DENIED_BULK_REASON : undefined),
            trailing:
              !gSetup.disabled && scopeBlocked ? (
                <Info className="w-3.5 h-3.5 ml-0.5" style={{ color: "#0A77FF", opacity: 0.7 }} />
              ) : undefined,
            onClick: () => {
              openAssignPermissions(draftSelectedIds, "listing");
              onCancel();
            },
          },
        ]
      : []),
    // Export is omitted under the Archived filter, archived roles are
    // never exported.
    ...(gExport.render
      ? [
          {
            key: "export",
            label: "Export",
            icon: <Download className="w-3.5 h-3.5" style={{ color: "#64748B" }} />,
            variant: "default" as const,
            disabled: gExport.disabled,
            tooltip: gExport.reason || undefined,
            onClick: () => onExport?.(),
          },
        ]
      : []),
    ...(gLifecycle.render
      ? [
          {
            key: "deactivate",
            label: "Deactivate",
            icon: <Ban className="w-3.5 h-3.5" style={{ color: "#B45309" }} />,
            variant: "warning" as const,
            disabled: statusDisabled || gLifecycle.disabled,
            tooltip: gLifecycle.disabled
              ? gLifecycle.reason
              : hasExcluded
                ? excludedTooltip("deactivated")
                : undefined,
            trailing: hasExcluded ? (
              <Info className="w-3.5 h-3.5 ml-0.5" style={{ color: "#B45309", opacity: 0.7 }} />
            ) : undefined,
            onClick: () => setDeactivateOpen(true),
          },
          {
            key: "archive",
            label: "Archive",
            icon: <Archive className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />,
            variant: "danger" as const,
            disabled: statusDisabled || gLifecycle.disabled,
            tooltip: gLifecycle.disabled
              ? gLifecycle.reason
              : hasExcluded
                ? excludedTooltip("archived")
                : undefined,
            trailing: hasExcluded ? (
              <Info className="w-3.5 h-3.5 ml-0.5" style={{ color: "#DC2626", opacity: 0.7 }} />
            ) : undefined,
            onClick: () => setArchiveOpen(true),
          },
        ]
      : []),
  ];

  return (
    <>
      <BulkActionBar
        selectedCount={selectedCount}
        actions={actions}
        onCancel={onCancel}
        emptyNote={
          <span
            className="inline-flex items-center gap-1.5 text-[12px]"
            style={{ color: "#64748B", fontWeight: 500 }}
          >
            <Info className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
            {access.label} can't change roles in bulk.
          </span>
        }
      />
      <BulkDeactivateRolesModal
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        selectedRoleIds={statusEligibleIds}
        onConfirm={() => {
          onDeactivateSelected?.();
          setDeactivateOpen(false);
          onCancel();
        }}
      />
      <BulkArchiveRolesModal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        selectedRoleIds={statusEligibleIds}
        onConfirm={() => {
          onArchiveSelected?.();
          setArchiveOpen(false);
          onCancel();
        }}
      />
    </>
  );
}