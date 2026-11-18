import { Info } from "lucide-react";
import { USER_AVATAR_MAP } from "./user-avatars";
import {
  AvatarCell,
  SmallAvatarCell,
  SystemStatusColumnHeader,
  RolesCell,
  StatusBadge,
  LicenseBadge,
  statusDisplayLabel,
} from "../components/table-cells";
import { StatusDropdown } from "../components/shared/StatusDropdown";
import { LicenseDropdown } from "../components/shared/LicenseDropdown";
import { Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";

import { UserActionsMenu } from "../components/shared/UserActionsMenu";
import { ProtectedUserBadge } from "../components/shared/SystemRoleBadge";
import { ACCOUNT_OWNER_COPY, isAccountOwner, useAccountOwnerRules } from "./account-owner";
import type { ColumnDef, QuickFilterDef, AdvancedFilterConfig } from "../components/data-table/types";
import { users, type UserRow } from "./users-data";
import { setRowState, useRowState } from "./users-row-store";
import { getLicenseInaccessibleRoles, toTitleCase } from "../lib/role-license";
import { isMe } from "./current-user";

/* ─── Header with info-tooltip: shared by Created By and Invited By so users
 *  can hover to learn the distinction between the two adjacent columns. */
function ColumnHeaderWithInfo({ label, info }: { label: string; info: string }) {
  return (
    <div className="flex items-center gap-1">
      <span>{label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-default">
            <Info className="w-3 h-3" style={{ color: "#94A3B8" }} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="max-w-[280px] text-[12px]">
          {info}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/* ─── Listing store ─── Lives in users-row-store.ts (see the note there on
 * why it imports no UI). Re-exported so existing imports keep working. */
export {
  type ImportNotice,
  type ImportUserUpdate,
  setImportNotice,
  dismissImportNotice,
  useImportNotice,
  updateUserRowState,
  makeImportedUserId,
  addImportedUsers,
  getCurrentUserEmails,
  getCurrentRoleNames,
  upsertImportedUsers,
  useImportedUsers,
  useResolvedUsersData,
} from "./users-row-store";

/* ─── Status dropdown cell for table ─── */
export function StatusDropdownCell({ row, bulkActive = false }: { row: UserRow; bulkActive?: boolean }) {
  const { status, license } = useRowState(row);
  /* Any Account Owner's status is locked: to other users, and to the owner
   * themselves while they hold the role (Section 11, Rules 1 and 6). */
  const owner = useAccountOwnerRules(row.id);
  return (
    <StatusDropdown
      status={status}
      userName={row.fullName}
      userId={row.id}
      userLicense={license}
      onStatusChange={(s) => setRowState(row.id, { status: s })}
      onLicenseChange={(l) => setRowState(row.id, { license: l })}
      compact
      dimmed={owner.isOwner && bulkActive}
      lockedReason={
        owner.status.allowed
          ? undefined
          : bulkActive
            ? ACCOUNT_OWNER_COPY.bulkStatus
            : owner.status.reason
      }
    />
  );
}

/* ─── License dropdown cell for table ─── */
export function LicenseDropdownCell({ row }: { row: UserRow }) {
  const { license, status } = useRowState(row);
  return (
    <LicenseDropdown
      license={license}
      userName={row.fullName}
      userEmail={row.email}
      userId={row.id}
      userStatus={status}
      onLicenseChange={(l) => setRowState(row.id, { license: l })}
    />
  );
}

/* ─── Read-only license / status cells ───
 *
 * Same row-state source as the two dropdown cells above, so a change made in
 * the main listing is still reflected here, but with no affordance to start a
 * change flow: no chevron, no lock, nothing clickable.
 *
 * For pickers, where the table exists to choose people rather than to
 * administer them. `showNoLicense` keeps the chip visible for unlicensed
 * users, matching LicenseDropdown, which renders one rather than a blank cell.
 */
export function LicenseBadgeCell({ row, comfort = false }: { row: UserRow; comfort?: boolean }) {
  const { license } = useRowState(row);
  return <LicenseBadge license={license} comfort={comfort} showNoLicense />;
}

export function StatusBadgeCell({ row, comfort = false }: { row: UserRow; comfort?: boolean }) {
  const { status } = useRowState(row);
  return <StatusBadge status={status} comfort={comfort} />;
}

/* ─── Column definitions ─── */
export const USERS_COLUMNS: ColumnDef<UserRow>[] = [
  {
    key: "full_name",
    label: "Full Name",
    width: 200,
    stickyLeft: true,
    sortable: true,
    sortValue: (row) => row.fullName,
    filter: { type: "text", getValue: (row) => row.fullName },
    render: (row, { highlightText, density }) => {
      const isComfort = density === "comfort";
      const owner = isAccountOwner(row.id);
      return (
        <AvatarCell
          name={row.fullName}
          nameNode={highlightText(row.fullName)}
          subtitle={isComfort ? row.email : undefined}
          subtitleNode={isComfort ? highlightText(row.email) : undefined}
          comfort={isComfort}
          avatarUrl={USER_AVATAR_MAP[row.id]}
          userId={row.id}
          trailing={owner ? <ProtectedUserBadge /> : undefined}
        />
      );
    },
  },
  {
    key: "assigned_roles",
    label: "Assigned Roles",
    width: 220,
    filter: { type: "multiselect", getValue: (row) => row.assignedRoles, formatLabel: toTitleCase, filterLabel: "Assigned Roles" },
    render: (row, { highlightText, density, searchQuery }) => {
      const inaccessible = getLicenseInaccessibleRoles(row.license, row.assignedRoles);
      const alertNames = new Set(inaccessible.map((r) => r.toLowerCase()));
      const firstName = row.fullName.split(" ")[0] || row.fullName;
      const tooltip =
        row.license === "No License"
          ? `${firstName} currently has no license. ${inaccessible.length} of the assigned role${inaccessible.length === 1 ? "" : "s"} will not take effect until a license is assigned.`
          : `${firstName} currently has a Field User license. ${inaccessible.length} of the assigned role${inaccessible.length === 1 ? "" : "s"} require${inaccessible.length === 1 ? "s" : ""} a Full Access license. The permissions in ${inaccessible.length === 1 ? "this role" : "these roles"} will not take effect until the license is upgraded.`;
      const titleCasedFirst = toTitleCase(row.assignedRoles[0] ?? "");
      const titleCasedAll = row.assignedRoles.map(toTitleCase);
      return (
        <RolesCell
          roles={titleCasedAll}
          firstRoleNode={highlightText(titleCasedFirst)}
          comfort={density === "comfort"}
          searchQuery={searchQuery}
          userId={row.id}
          licenseAlertNames={alertNames}
          licenseAlertTooltip={inaccessible.length > 0 ? tooltip : undefined}
        />
      );
    },
  },
  {
    key: "license",
    label: "License",
    width: 130,
    sortable: true,
    sortValue: (row) => row.license,
    filter: { type: "multiselect", getValue: (row) => row.license },
    render: (row) => (
      <LicenseDropdownCell row={row} />
    ),
  },
  {
    key: "email",
    label: "Email",
    width: 200,
    hideInComfort: true,
    sortable: true,
    sortValue: (row) => row.email,
    filter: { type: "text", getValue: (row) => row.email },
    render: (row, { highlightText, density }) => (
      <span className={`${density === "comfort" ? "text-[13.5px]" : "text-sm"} text-muted-foreground truncate block min-w-0`}>
        {highlightText(row.email)}
      </span>
    ),
  },
  {
    key: "last_logon",
    label: "Last Sign In",
    width: 170,
    sortable: true,
    sortValue: (row) => row.lastLogon,
    filter: { type: "text", getValue: (row) => row.lastLogon, filterLabel: "Last Sign In" },
    render: (row, { density }) => (
      <span className={density === "comfort" ? "text-[13.5px]" : "text-sm"} style={{ color: "#475569" }}>
        {row.lastLogon}
      </span>
    ),
  },
  {
    key: "status",
    label: <SystemStatusColumnHeader />,
    width: 170,
    sortable: true,
    sortValue: (row) => row.status,
    filter: {
      type: "multiselect",
      getValue: (row) => row.status,
      formatLabel: statusDisplayLabel,
      filterLabel: "System Status",
    },
    render: (row, { selectionActive }) => (
      <StatusDropdownCell row={row} bulkActive={selectionActive} />
    ),
  },
  {
    key: "created_by",
    label: (
      <ColumnHeaderWithInfo
        label="Created By"
        info="The admin who created this user record. This stays the same even if someone else sends the invitation later."
      />
    ),
    width: 160,
    filter: { type: "multiselect", getValue: (row) => row.createdBy ?? row.invitedBy ?? "", filterLabel: "Created By" },
    render: (row, { density }) => {
      /* Created By is always populated. When the record was created via the
       * "Create & Send Invite" path we don't store a separate creator, so we
       * fall back to the inviter for that case. */
      const creatorName = row.createdBy ?? row.invitedBy;
      if (!creatorName) return <span style={{ color: "#94A3B8" }}>{"-"}</span>;
      const creator = users.find((u) => u.fullName === creatorName);
      return (
        <SmallAvatarCell name={creatorName} userId={creator?.id} comfort={density === "comfort"} />
      );
    },
  },
  {
    key: "invited_by",
    label: (
      <ColumnHeaderWithInfo
        label="Invited By"
        info="The admin who sent the invitation email. Stays empty until an invite goes out, and can be a different person than the one who created the user."
      />
    ),
    width: 160,
    filter: { type: "multiselect", getValue: (row) => row.invitedBy ?? "", filterLabel: "Invited By" },
    render: (row, { density }) => {
      if (!row.invitedBy) return <span style={{ color: "#94A3B8" }}>{"-"}</span>;
      const inviter = users.find((u) => u.fullName === row.invitedBy);
      return (
        <SmallAvatarCell name={row.invitedBy} userId={inviter?.id} comfort={density === "comfort"} />
      );
    },
  },
  {
    key: "invited_on",
    label: "Invited On",
    width: 130,
    sortable: true,
    sortValue: (row) => row.invitedOn,
    filter: { type: "text", getValue: (row) => row.invitedOn },
    render: (row, { density }) => (
      <span className={density === "comfort" ? "text-[13.5px]" : "text-sm"} style={{ color: "#475569" }}>
        {row.invitedOn}
      </span>
    ),
  },
  {
    key: "invite_accepted_on",
    label: "Invite Accepted On",
    width: 180,
    sortable: true,
    sortValue: (row) => row.inviteAcceptedOn,
    filter: { type: "text", getValue: (row) => row.inviteAcceptedOn },
    render: (row, { density }) => (
      <span className={density === "comfort" ? "text-[13.5px]" : "text-sm"} style={{ color: "#475569" }}>
        {row.inviteAcceptedOn}
      </span>
    ),
  },
];

/* ─── Quick filter definitions ─── */
export const USERS_QUICK_FILTERS: QuickFilterDef[] = [
  { key: "all", label: "Show All", showCount: true },
  { key: "full", label: "Full Access", showCount: true, group: "license" },
  { key: "field", label: "Field Users", showCount: true, group: "license" },
  { key: "non_billable", label: "No License", showCount: true, group: "license" },
  { key: "active", label: "Active", showCount: true, group: "status" },
  { key: "invite_sent", label: "Invite Sent", showCount: true, group: "status" },
  { key: "draft", label: "Draft", showCount: true, group: "status" },
  { key: "invite_expired", label: "Invite Expired", showCount: true, group: "status" },
  { key: "inactive", label: "Deactivated", showCount: true, group: "status" },
  { key: "archived", label: "Archived", showCount: true, group: "status", variant: "danger" },
];

/* ─── Search predicate ─── */
export function usersSearchPredicate(row: UserRow, query: string): boolean {
  return (
    row.fullName.toLowerCase().includes(query) ||
    row.email.toLowerCase().includes(query) ||
    row.assignedRoles.some((r) => r.toLowerCase().includes(query))
  );
}

/* ─── Me Mode predicate ─── */
/** Keep a user row when the logged-in user created the record, was the last
 *  to edit it, or sent the invitation. OR semantics, any match qualifies. */
export function usersMeModePredicate(row: UserRow): boolean {
  return isMe(row.createdBy) || isMe(row.lastEditedBy) || isMe(row.invitedBy);
}

/* ─── Filter predicate ─── */
/* Archived users are hidden everywhere except when the Archived pill is the
 * active filter. Because the status pills are single-select OR logic, that
 * means archived users are either hidden (default + every other filter) or
 * shown exclusively (Archived selected), never mixed in. Mirrors the
 * established Roles listing behavior (see rolesFilterPredicate). */
export function usersFilterPredicate(row: UserRow, filterKey: string): boolean {
  switch (filterKey) {
    case "active":
      return row.status === "Active";
    case "invite_sent":
      return row.status === "Invite Sent";
    case "draft":
      // "Draft" is the listing-facing label for the Pending Setup status: the
      // profile exists but no invitation has been sent yet.
      return row.status === "Pending Setup";
    case "invite_expired":
      return row.status === "Invite Expired";
    case "inactive":
      return row.status === "Inactive";
    case "full":
      return row.license === "Full Access" && row.status !== "Archived";
    case "field":
      return row.license === "Field User" && row.status !== "Archived";
    case "non_billable":
      return row.license === "No License" && row.status !== "Archived";
    case "archived":
      return row.status === "Archived";
    default:
      // "Show All" / default (no filter): exclude archived users. They surface
      // only when the Archived filter is explicitly selected, so the default
      // view, and its total count, never includes them.
      return row.status !== "Archived";
  }
}

/* ─── Advanced filters config (toolbar "Filters" panel) ───
 * Partner-style panel over the same UAC-native fields as the quick pills.
 * Counts come from the live resolved dataset passed in. */
export function buildUsersAdvancedFilter(data: UserRow[]): AdvancedFilterConfig<UserRow> {
  const roleSet = new Set<string>();
  data.forEach((u) => u.assignedRoles.forEach((r) => roleSet.add(r)));
  const roles = Array.from(roleSet).sort();
  const countStatus = (s: string) => data.filter((u) => u.status === s).length;
  const countLicense = (l: string) => data.filter((u) => u.license === l).length;
  const countRole = (r: string) => data.filter((u) => u.assignedRoles.includes(r)).length;

  return {
    sections: [
      {
        key: "license",
        title: "License",
        kind: "segmented",
        options: [
          { value: "Full Access", label: "Full Access" },
          { value: "Field User", label: "Field User" },
          { value: "No License", label: "No License" },
        ],
        getCount: countLicense,
      },
      {
        key: "status",
        title: "Status",
        kind: "pills",
        options: [
          { value: "Active", label: "Active" },
          { value: "Invite Sent", label: "Invite Sent" },
          { value: "Invite Expired", label: "Invite Expired" },
          { value: "Inactive", label: "Deactivated" },
          { value: "Archived", label: "Archived" },
        ],
        getCount: countStatus,
      },
      {
        key: "roles",
        title: "Assigned Roles",
        subtitle: "Show users assigned to any of the selected roles.",
        kind: "searchable",
        placeholder: "Search roles…",
        options: roles.map((r) => ({ value: r, label: toTitleCase(r) })),
        getCount: countRole,
      },
    ],
    predicate: (row, v) => {
      const status = v.status ?? [];
      if (status.length && !status.includes(row.status)) return false;
      const license = v.license ?? [];
      if (license.length && !license.includes(row.license)) return false;
      const sel = v.roles ?? [];
      if (sel.length && !sel.some((r) => row.assignedRoles.includes(r))) return false;
      return true;
    },
  };
}

/* ─── Actions renderer: delegates to shared UserActionsMenu ─── */
export function UsersActionMenu({ row }: { row: UserRow }) {
  const { status, license } = useRowState(row);
  return (
    <UserActionsMenu
      user={{
        id: row.id,
        fullName: row.fullName,
        email: row.email,
        license,
        status,
      }}
      variant="icon"
      showLicenseActions
      showArchive
      showResendInvite
      showEditDetails
      stopRowPropagation
      onLicenseChange={(l) => setRowState(row.id, { license: l })}
      onStatusChange={(s) => setRowState(row.id, { status: s })}
    />
  );
}
