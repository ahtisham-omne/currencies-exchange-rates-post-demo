import { LicenseBadge, statusDisplayLabel } from "../components/table-cells";
import { StatusDropdown } from "../components/shared/StatusDropdown";
import { SystemRoleLock, ProtectedRoleBadge, NoPermissionsRoleBadge } from "../components/shared/SystemRoleBadge";
import { RoleActionsMenu } from "../components/shared/RoleActionsMenu";
import { LinkedRoleName } from "../components/shared/LinkedRoleName";
import { RoleUsersPopover } from "../components/shared/RoleUsersPopover";
import { Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";
import type { ColumnDef, QuickFilterDef, AdvancedFilterConfig } from "../components/data-table/types";
import { roles, roleNameToOptionId, type RoleRow } from "./roles-data";
import { setRoleState, updateRoleRowState, useRoleState } from "./roles-row-store";
import { ROLE_PERMISSION_MAP } from "./role-permissions-map";
import { isMe } from "./current-user";

/** Granted-permission count for the roles listing. All-access roles simply show
 *  their full count (the whole catalog), like any other role. */
function rolePermissionCount(row: RoleRow): number {
  return ROLE_PERMISSION_MAP[roleNameToOptionId(row.roleName)]?.length ?? 0;
}

/* ─── Column definitions ─── */
export const ROLES_COLUMNS: ColumnDef<RoleRow>[] = [
  {
    key: "role_name",
    label: "Role Name",
    width: 200,
    stickyLeft: true,
    sortable: true,
    sortValue: (row) => row.roleName,
    filter: { type: "text", getValue: (row) => row.roleName },
    render: (row, { highlightText, density }) => {
      const isComfort = density === "comfort";
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          {row.isSystem && <SystemRoleLock size={13} />}
          {row.isProtected && <ProtectedRoleBadge size={13} />}
          {row.status === "Draft" && <NoPermissionsRoleBadge size={13} />}
          <LinkedRoleName
            roleId={row.id}
            disabled={row.status === "Archived"}
            className={`${isComfort ? "text-[13.5px]" : "text-sm"} truncate min-w-0 max-w-full`}
            style={{ fontWeight: 500, color: "#1E293B" }}
          >
            {highlightText(row.roleName)}
          </LinkedRoleName>
        </div>
      );
    },
  },
  {
    key: "description",
    label: "Description",
    width: 240,
    flexible: true,
    filter: { type: "text", getValue: (row) => row.description },
    render: (row, { highlightText, density }) => {
      const textClass = density === "comfort" ? "text-[13.5px]" : "text-sm";
      const cell = (
        <span
          className={`${textClass} truncate block min-w-0`}
          style={{ color: "#64748B" }}
        >
          {highlightText(row.description)}
        </span>
      );
      if (!row.description) return cell;
      return (
        <Tooltip>
          <TooltipTrigger asChild>{cell}</TooltipTrigger>
          <TooltipContent
            side="top"
            sideOffset={4}
            className="max-w-[320px] text-[12px] leading-[1.5] whitespace-normal"
          >
            <span className="line-clamp-6 break-words">{row.description}</span>
          </TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    key: "permissions",
    label: "Permissions",
    width: 130,
    sortable: true,
    sortValue: (row) => rolePermissionCount(row),
    filter: { type: "range", getValue: (row) => rolePermissionCount(row), filterLabel: "Permissions" },
    render: (row, { density }) => (
      <span
        className={density === "comfort" ? "text-[13.5px]" : "text-sm"}
        style={{ color: "#475569", fontWeight: 400 }}
      >
        {rolePermissionCount(row)}
      </span>
    ),
  },
  {
    key: "users",
    label: "Users",
    width: 100,
    sortable: true,
    sortValue: (row) => row.usersCount,
    filter: { type: "range", getValue: (row) => row.usersCount, filterLabel: "Users" },
    render: (row, { density }) => (
      <RoleUsersPopover roleId={row.id} usersCount={row.usersCount} comfort={density === "comfort"} />
    ),
  },
  {
    key: "license_required",
    label: "License Required",
    width: 140,
    sortable: true,
    sortValue: (row) => row.licenseRequired,
    filter: { type: "multiselect", getValue: (row) => row.licenseRequired, filterLabel: "License Required" },
    render: (row, { density }) => (
      <LicenseBadge license={row.licenseRequired} comfort={density === "comfort"} />
    ),
  },
  {
    key: "status",
    label: "Status",
    width: 170,
    sortable: true,
    sortValue: (row) => row.status,
    filter: { type: "multiselect", getValue: (row) => row.status, formatLabel: statusDisplayLabel },
    render: (row, { selectionActive }) => (
      <RoleStatusDropdownCell row={row} bulkActive={selectionActive} />
    ),
  },
];

/* ─── Quick filter definitions ─── */
export const ROLES_QUICK_FILTERS: QuickFilterDef[] = [
  { key: "all", label: "Show All", showCount: true },
  { key: "system", label: "Predefined", showCount: true, group: "type" },
  { key: "custom", label: "Custom", showCount: true, group: "type" },
  { key: "full", label: "Full Access", showCount: true, group: "license" },
  { key: "field", label: "Field User", showCount: true, group: "license" },
  { key: "active", label: "Active", showCount: true, group: "status" },
  { key: "disabled", label: "Deactivated", showCount: true, group: "status" },
  { key: "draft", label: "Draft", showCount: true, group: "status" },
  { key: "archived", label: "Archived", showCount: true, group: "status", variant: "danger" },
];

/* ─── Listing store ─── Lives in roles-row-store.ts (see the note there on
 * why it imports no UI). Re-exported so existing imports keep working. */
export {
  type RolesImportNotice,
  setRolesImportNotice,
  dismissRolesImportNotice,
  useRolesImportNotice,
  getExistingRoleNames,
  isRoleNameTaken,
  roleNameCollisionMessage,
  getSystemRoleNamesLower,
  type ImportRoleUpdate,
  type ImportRoleCreate,
  makeImportedRoleId,
  upsertImportedRoles,
  applyRolePermissions,
  updateRoleRowState,
  useResolvedRolesData,
} from "./roles-row-store";

/* ─── Status dropdown cell for roles table ─── */
function RoleStatusDropdownCell({ row, bulkActive = false }: { row: RoleRow; bulkActive?: boolean }) {
  const { status } = useRoleState(row);
  return (
    <StatusDropdown
      status={status}
      userName={row.roleName}
      onStatusChange={(nextStatus) => setRoleState(row.id, { status: nextStatus })}
      entityType="role"
      compact
      // Predefined (system) roles are locked: they can be copied but never
      // edited, deactivated, or archived, so their status is read-only. During a
      // bulk selection the chip is also dimmed and the tooltip reframes to the
      // bulk context, mirroring the protected-user chip in the user listing.
      dimmed={!!row.isSystem && bulkActive}
      lockedReason={
        row.isSystem
          ? bulkActive
            ? "Predefined role: excluded from bulk status changes. Its status is managed by the system and can't be changed."
            : "System role. Its status is managed by the system and can't be changed."
          : undefined
      }
      hideLockIcon
    />
  );
}

/* ─── Search predicate ─── */
export function rolesSearchPredicate(row: RoleRow, query: string): boolean {
  return (
    row.roleName.toLowerCase().includes(query) ||
    row.description.toLowerCase().includes(query)
  );
}

/* ─── Me Mode predicate ─── */
/** Keep a role when the logged-in user created it, last edited it, owns it,
 *  or is one of its assigned members. OR semantics, any match qualifies. */
export function rolesMeModePredicate(row: RoleRow): boolean {
  return (
    isMe(row.createdBy) ||
    isMe(row.lastEditedBy) ||
    isMe(row.roleOwner) ||
    (row.assignedMembers?.some((name) => isMe(name)) ?? false)
  );
}

/* ─── Filter predicate ─── */
export function rolesFilterPredicate(row: RoleRow, filterKey: string): boolean {
  switch (filterKey) {
    case "active":
      return row.status === "Active";
    case "draft":
      return row.status === "Draft";
    case "disabled":
      return row.status === "Inactive";
    case "archived":
      return row.status === "Archived";
    case "full":
      return row.licenseRequired === "Full Access" && row.status !== "Archived";
    case "field":
      return row.licenseRequired === "Field User" && row.status !== "Archived";
    case "system":
      return row.isSystem === true && row.status !== "Archived";
    case "custom":
      return !row.isSystem && row.status !== "Archived";
    default:
      // "all" filter: exclude archived roles
      return row.status !== "Archived";
  }
}

/* ─── Advanced filters config (toolbar "Filters" panel) ───
 * Same filterable dimensions as the quick pills, in the Partner-style panel.
 * Counts come from the live resolved dataset passed in. */
export function buildRolesAdvancedFilter(data: RoleRow[]): AdvancedFilterConfig<RoleRow> {
  const countStatus = (s: string) => data.filter((r) => r.status === s).length;
  const countLicense = (l: string) => data.filter((r) => r.licenseRequired === l).length;
  const countType = (t: string) => data.filter((r) => (t === "system" ? r.isSystem : !r.isSystem)).length;

  return {
    sections: [
      {
        key: "type",
        title: "Role Type",
        subtitle: "Show predefined system roles or custom roles.",
        kind: "segmented",
        options: [
          { value: "system", label: "Predefined" },
          { value: "custom", label: "Custom" },
        ],
        getCount: countType,
      },
      {
        key: "status",
        title: "Status",
        kind: "pills",
        options: [
          { value: "Active", label: "Active" },
          { value: "Draft", label: "Needs Permissions" },
          { value: "Inactive", label: "Deactivated" },
          { value: "Archived", label: "Archived" },
        ],
        getCount: countStatus,
      },
      {
        key: "license",
        title: "Required License",
        kind: "pills",
        options: [
          { value: "Full Access", label: "Full Access" },
          { value: "Field User", label: "Field User" },
        ],
        getCount: countLicense,
      },
    ],
    predicate: (row, v) => {
      const type = v.type ?? [];
      if (type.length && !type.includes(row.isSystem ? "system" : "custom")) return false;
      const status = v.status ?? [];
      if (status.length && !status.includes(row.status)) return false;
      const license = v.license ?? [];
      if (license.length && !license.includes(row.licenseRequired)) return false;
      return true;
    },
  };
}

/* ─── Actions renderer: delegates to shared RoleActionsMenu ─── */
export function RolesActionMenu({ row }: { row: RoleRow }) {
  return (
    <RoleActionsMenu
      role={row}
      variant="icon"
      stopRowPropagation
      onStatusChange={(status) => updateRoleRowState(row.id, { status })}
    />
  );
}
