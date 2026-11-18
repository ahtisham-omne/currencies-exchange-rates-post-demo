import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Lock,
  Clock,
  Check,
  Crown,
  Inbox,
  Plus,
  Star,
  ChevronRight,
  CornerDownRight,
  AlertTriangle,
  MoreHorizontal,
  Eye,
  Trash2,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { RemoveOwnershipModal } from "./RemoveOwnershipModal";
import { getOwnershipGrantedVia } from "../../data/uac-derived";
import { useAccountOwnerRules } from "../../data/account-owner";
import { isProtectedRoleId } from "../../data/roles-data";
import type { OwnedRoleRow } from "./RoleOwnershipTab";
import { toast } from "sonner";
import type { UserDetail } from "../../data/user-detail-data";
import type { RoleRow } from "../../data/roles-data";
import type { UserRequestRow } from "../../data/user-requests-data";
import { roles, sortRolesCustomFirst, roleGroupFn, ROLE_GROUP_LABELS } from "../../data/roles-data";
import { userRequests } from "../../data/user-requests-data";
import { PERMISSION_MODULES } from "../../data/permissions-data";
import {
  ROLES_COLUMNS,
  ROLES_QUICK_FILTERS,
  rolesSearchPredicate,
  rolesFilterPredicate,
  buildRolesAdvancedFilter,
} from "../../data/roles-table-config";
import {
  USER_REQUESTS_QUICK_FILTERS,
  userRequestsSearchPredicate,
  userRequestsFilterPredicate,
} from "../../data/user-requests-table-config";
import { DataTable } from "../data-table/DataTable";
import { StatusBadge, LicenseBadge } from "../table-cells";
import { SystemRoleLock } from "../shared/SystemRoleBadge";
import { AssignedPermissionsTab } from "./AssignedPermissionsTab";
import { getRolesOwnedByUser, subscribeRoleOwners } from "../../data/role-owners-data";
import { removeRoleFromUser, addRolesToUser } from "../../data/user-detail-data";
import { useSyncExternalStore } from "react";
import { UserRequestDetailModal } from "../tabs/UserRequestDetailModal";
import { RemoveRoleWizard } from "./RemoveRoleWizard";
import { SelfRemoveAccountOwnerModal } from "../shared/SelfRemoveAccountOwnerModal";
import { BulkActionBar } from "../data-table/BulkActionBar";
import { AddRolesModal } from "./AddRolesModal";
import { isRoleOwner, getRoleOwners, removeRoleOwner } from "../../data/role-owners-data";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../ui/tooltip";
import type { ColumnDef, RenderHelpers } from "../data-table/types";
import { CARD_SIZE_PADDING, CARD_SIZE_PADDING_XY } from "../data-table/types";

interface Props {
  user: UserDetail;
  liveLicense?: UserDetail["license"];
  liveStatus?: UserDetail["status"];
}

/* ── KPI Card: pixel-match with PerformanceInsights ── */
const KPI_ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Shield, Lock, Clock, Check, Crown,
};

function KpiCard({ label, value, iconName }: { label: string; value: string | number; iconName?: string }) {
  const Icon = iconName ? KPI_ICON_MAP[iconName] : Shield;
  return (
    <div className="border rounded-[8px] bg-white group relative min-w-0 transition-all duration-200 overflow-hidden border-[#E2E8F0] hover:-translate-y-[1px] hover:border-[#93B8F7] hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]">
      <div className="px-3 py-2">
        <div className="flex items-center justify-between gap-1 mb-1">
          <p className="text-[10.5px] whitespace-nowrap" style={{ fontWeight: 500, color: "#64748B" }}>{label}</p>
          {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "#90A5BA" }} />}
        </div>
        <p className="text-[15px] tracking-tight whitespace-nowrap" style={{ fontWeight: 600, lineHeight: 1.2, color: "#0F172A" }}>
          {value}
        </p>
      </div>
    </div>
  );
}

/* ── Sub-tab types ── */
type SubTab = "roles" | "permissions" | "requests";

/* Each sub-tab carries its own accent colour, surfaced ONLY when the tab is
 * active. Inactive tabs render in neutral slate. Matches the segmented-control
 * pattern used by the Partner Details items-tabs (see attached reference). */
import { SegmentedTabs, type SegmentedTabDef } from "../shared/SegmentedTabs";
import {
  isRoleInScope,
  useAccessMode,
  useRoleInScope,
  SCOPE_DENIED_BULK_REASON,
} from "../access-mode";

const SUB_TABS: SegmentedTabDef<SubTab>[] = [
  { key: "roles",       label: "Assigned Roles",        color: "#0A77FF" }, // blue
  { key: "permissions", label: "Assigned Permissions",  color: "#059669" }, // green
  /* Locked: the sub-tab keeps its label and pending badge, but takes no click. */
  { key: "requests",    label: "Requested Permissions", color: "#D97706", disabled: true, disabledTooltip: "Coming Soon" }, // amber
];

/* ── Row actions menu (3-dot) ── */
function RemoveRoleAction({ row, user }: { row: RoleRow; user: UserDetail }) {
  const access = useAccessMode();
  /* A role the user already holds that sits outside the viewer's Manage Roles
   * scope stays in this list — hiding it would make the roles summary wrong,
   * which is worse than showing something you can't act on. What goes is the
   * ability to remove it. Marked with the same disabled-item-plus-tooltip
   * treatment the protected-last-holder rule already uses below, so both
   * "you may not do this" cases read identically.
   *
   * This one is deliberately always disabled rather than following the Denied
   * actions setting: hiding it would leave a menu that looks complete while
   * quietly omitting the reason this row can't be acted on. */
  const inScope = useRoleInScope(row.id);
  const outOfScopeTooltip =
    "This role isn't in your Manage Roles scope, so you can't remove it from this user.";
  const [removeOpen, setRemoveOpen] = useState(false);
  const [selfRemoveOpen, setSelfRemoveOpen] = useState(false);
  const [ownershipOpen, setOwnershipOpen] = useState(false);

  const userIdNum = Number(user.id);
  const userIsOwner = isRoleOwner(row.id, userIdNum);
  const ownerIds = getRoleOwners(row.id).map((o) => o.userId);
  const ownerCount = ownerIds.length;
  const isOnlyOwner = userIsOwner && ownerCount === 1;

  /* Account Owner protection (ERP-5164 AC9): only the owner removes the role
   *  from themselves, and never as its last holder. */
  const ownerRules = useAccountOwnerRules(userIdNum);
  const isProtectedRoleLocked =
    !!row.isProtected && !ownerRules.removeOwnerRole.allowed;
  const protectedTooltip = ownerRules.removeOwnerRole.reason;
  /* The owner removing themselves gets the owner warning in place of the
   * generic Remove Role wizard (ERP-5164 AC9, ERP-7648 AC6). */
  const isSelfOwnerRemoval = !!row.isProtected && ownerRules.isSelf;

  const ownedRow: OwnedRoleRow | null = userIsOwner
    ? {
        ...row,
        grantedVia: getOwnershipGrantedVia(row.id, userIdNum),
        ownerCount,
        isSoleOwner: isOnlyOwner,
        ownerUserIds: ownerIds,
      }
    : null;

  const roleDetailUrl = `/company-settings/user-access-control/role/${row.id}`;

  return (
    <>
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
        <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => window.open(roleDetailUrl, "_blank", "noopener,noreferrer")}
          >
            <Eye className="w-4 h-4 mr-2" />
            View Role Details
          </DropdownMenuItem>
          {userIsOwner && ownedRow && access.canManageRoleOwners && (
            inScope ? (
              <DropdownMenuItem
                className="cursor-pointer"
                style={{ color: "#B45309" }}
                onSelect={() => setOwnershipOpen(true)}
              >
                <Crown className="w-4 h-4 mr-2" style={{ color: "#B45309" }} />
                Remove Ownership
              </DropdownMenuItem>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <DropdownMenuItem
                      disabled
                      className="cursor-not-allowed opacity-50"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      Remove Ownership
                    </DropdownMenuItem>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[280px] text-xs">
                  This role isn&rsquo;t in your Manage Roles scope, so you can&rsquo;t change its
                  owners.
                </TooltipContent>
              </Tooltip>
            )
          )}
          {!access.canAssignRoles ? null : !inScope ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <DropdownMenuItem
                    disabled
                    className="cursor-not-allowed opacity-50"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove Role
                  </DropdownMenuItem>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[280px] text-xs">
                {outOfScopeTooltip}
              </TooltipContent>
            </Tooltip>
          ) : isProtectedRoleLocked ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <DropdownMenuItem
                    disabled
                    className="cursor-not-allowed opacity-50"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove Role
                  </DropdownMenuItem>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[280px] text-xs">
                {protectedTooltip}
              </TooltipContent>
            </Tooltip>
          ) : (
            <DropdownMenuItem
              className="cursor-pointer"
              style={{ color: "#DC2626" }}
              onSelect={() => (isSelfOwnerRemoval ? setSelfRemoveOpen(true) : setRemoveOpen(true))}
            >
              <Trash2 className="w-4 h-4 mr-2" style={{ color: "#DC2626" }} />
              Remove Role
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <RemoveRoleWizard
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        userId={userIdNum}
        userName={user.fullName}
        roleName={row.roleName}
        roleId={row.id}
        isOwner={userIsOwner}
        isOnlyOwner={isOnlyOwner}
        onConfirm={({ ownershipAlsoRemoved }) => {
          if (ownershipAlsoRemoved) {
            removeRoleOwner(row.id, userIdNum);
          }
          removeRoleFromUser(userIdNum, row.roleName);
        }}
      />

      {isSelfOwnerRemoval && (
        <SelfRemoveAccountOwnerModal
          open={selfRemoveOpen}
          onClose={() => setSelfRemoveOpen(false)}
          userId={userIdNum}
          onConfirm={() => {
            removeRoleFromUser(userIdNum, row.roleName);
            toast.success(`${user.fullName} has been removed from ${row.roleName}.`);
          }}
        />
      )}

      {ownedRow && (
        <RemoveOwnershipModal
          open={ownershipOpen}
          onClose={() => setOwnershipOpen(false)}
          row={ownedRow}
          userId={userIdNum}
          userName={user.fullName}
        />
      )}
    </>
  );
}

/* ── Status config map (shared between table + cards) ── */
const REQUEST_STATUS_MAP: Record<string, { bg: string; text: string; dot: string; border?: string }> = {
  Accepted: { bg: "#ECFDF5", text: "#065F46", dot: "#059669", border: "#A7F3D0" },
  Pending:  { bg: "#FFFBEB", text: "#92400E", dot: "#D97706", border: "#FDE68A" },
  Rejected: { bg: "#FEF2F2", text: "#991B1B", dot: "#EF4444", border: "#FECACA" },
};
const REQUEST_STATUS_LABELS: Record<string, string> = {
  Accepted: "Approved",
  Pending: "Pending",
  Rejected: "Rejected",
};

/* ── Resolve permission names from a request (with fallback for unmatched modules) ── */
function getRequestedPermissionNames(row: UserRequestRow): string[] {
  const mod = PERMISSION_MODULES.find((m) => m.name === row.requestedFor);
  const ids = row.requestedPermissionIds ?? [];
  if (mod) {
    const matched = ids
      .map((id) => mod.permissions.find((p) => p.id === id)?.name)
      .filter((n): n is string => !!n);
    if (matched.length > 0) return matched;
  }
  // Fallback: synthesize realistic names from module + count so cards never show "-"
  if (ids.length === 0) return [`Access ${row.requestedFor} Module`];
  const synthesized = [`Access ${row.requestedFor} Module`];
  const extras = ["Create and Edit Records", "Approve and Manage Workflow", "Export and Bulk Actions"];
  for (let i = 1; i < ids.length && i - 1 < extras.length; i++) {
    synthesized.push(extras[i - 1]);
  }
  return synthesized;
}

/* ── Custom columns for the user-detail Requested Permissions table ── */
const USER_DETAIL_REQUESTS_COLUMNS: ColumnDef<UserRequestRow>[] = [
  {
    key: "requested_for",
    label: "Requested For",
    width: 240,
    stickyLeft: true,
    render: (row, { highlightText, density }) => {
      const isComfort = density === "comfort";
      const names = getRequestedPermissionNames(row);
      const firstPerm = names[0];
      const extra = Math.max(0, names.length - 1);
      return (
        <div className="flex flex-col gap-0.5 min-w-0 py-0.5">
          <span
            className={`inline-flex items-center w-fit ${isComfort ? "px-2.5 py-1" : "px-2 py-0.5"} rounded-md text-xs border`}
            style={{ backgroundColor: "#EDF4FF", color: "#007FFF", borderColor: "#B4D7FF", fontWeight: 500 }}
          >
            {highlightText(row.requestedFor)}
          </span>
          {firstPerm && (
            <span className="text-[11.5px] truncate" style={{ color: "#94A3B8", fontWeight: 400 }}>
              {firstPerm}{extra > 0 ? ` · +${extra} more` : ""}
            </span>
          )}
        </div>
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
    label: "Role's Status",
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

/* ── Inactive-role helpers (license-tier insufficient OR user deactivated) ── */
type InactiveCause = null | "user-state" | "license" | "no-license";

function getRoleInactiveCause(role: RoleRow, user: UserDetail): InactiveCause {
  // Archived users have all access revoked, every role is inaccessible regardless of license.
  if (user.status === "Archived") return "user-state";
  // Users with no license have ALL roles inaccessible.
  if (user.license === "No License") return "no-license";
  // Otherwise, a role is inaccessible only when the user's license is insufficient for it.
  // Deactivating a user without removing their license keeps role access intact,
  // they regain usage immediately upon reactivation.
  if (role.licenseRequired === "Full Access" && user.license !== "Full Access") return "license";
  return null;
}

function InactiveRoleIcon({ cause, firstName }: { cause: Exclude<InactiveCause, null>; firstName: string }) {
  const tooltip =
    cause === "license"
      ? `This role requires a Full Access license. ${firstName} currently has a Field User license. The permissions in this role will not take effect until the license is upgraded.`
      : cause === "no-license"
      ? `This role requires a license. ${firstName} currently has no license. The permissions in this role will not take effect until a license is assigned.`
      /* No "Inactive:" prefix. The word is the stored status value, never shown
       * to the user, and this cause is an archived user rather than a
       * deactivated one. The two license tooltips above carry no prefix either. */
      : "This user is archived. All role access has been revoked. Unarchive the user to restore access.";
  const isLicenseCause = cause === "license" || cause === "no-license";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center justify-center shrink-0 cursor-default leading-none"
          onClick={(e) => e.stopPropagation()}
          aria-label="Role inactive"
        >
          {isLicenseCause ? (
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#D97706" }} />
          ) : (
            <span style={{ fontSize: 13, lineHeight: 1 }}>🚫</span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-[320px]">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

/* ── Archived empty states ──
 *  Archived users have all access revoked: the assigned-roles and
 *  assigned-permissions sub-tabs render this read-only empty state instead of
 *  a data table (which removes row checkboxes, per-row menus, status chevrons
 *  and the filters control along with the data). */
function ArchivedAccessEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: "#F1F5F9" }}
      >
        <Shield className="w-6 h-6" style={{ color: "#94A3B8" }} />
      </div>
      <p className="text-[14px] mb-1" style={{ fontWeight: 600, color: "#334155" }}>
        No Roles or Permissions
      </p>
      <p className="text-[12.5px] max-w-[360px] leading-relaxed" style={{ color: "#64748B" }}>
        Access was cleared when this user was archived. Roles are reassigned during unarchive.
      </p>
    </div>
  );
}

function ArchivedRequestsEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: "#F1F5F9" }}
      >
        <Inbox className="w-6 h-6" style={{ color: "#94A3B8" }} />
      </div>
      <p className="text-[14px] mb-1" style={{ fontWeight: 600, color: "#334155" }}>
        No Permission Requests
      </p>
      <p className="text-[12.5px] max-w-[360px] leading-relaxed" style={{ color: "#64748B" }}>
        Pending requests were cleared when this user was archived.
      </p>
    </div>
  );
}

export function RolesPermissionsTab({ user: userProp, liveLicense, liveStatus }: Props) {
  const access = useAccessMode();
  const navigate = useNavigate();
  // Effective user: override license/status with live values when provided so role
  // availability reacts immediately to changes from the header.
  const user = useMemo<UserDetail>(
    () => {
      const next = { ...userProp };
      if (liveLicense && liveLicense !== userProp.license) next.license = liveLicense;
      if (liveStatus && liveStatus !== userProp.status) next.status = liveStatus;
      return next;
    },
    [userProp, liveLicense, liveStatus]
  );
  /* Archived users have all access cleared, roles, permissions and requests
   * all render read-only empty states. Driven by the effective (live) status. */
  const isArchived = user.status === "Archived";
  const [subTab, setSubTab] = useState<SubTab>("roles");
  const [selectedRequest, setSelectedRequest] = useState<UserRequestRow | null>(null);
  const [addRolesOpen, setAddRolesOpen] = useState(false);
  const [inactiveBannerDismissed, setInactiveBannerDismissed] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<(number | string)[]>([]);
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false);
  const [primaryRoleName, setPrimaryRoleName] = useState<string>(
    () => user.roleAssignments[0]?.name || ""
  );

  /* Flash state: role IDs that just became available after a license upgrade. */
  const [flashRoleIds, setFlashRoleIds] = useState<Set<number | string>>(new Set());
  const prevLicenseRef = useRef<UserDetail["license"]>(user.license);

  const userId = parseInt(user.id?.toString() ?? "0", 10);
  /* Bulk Remove Roles leaves the Account Owner row out whenever the row menu
   * would block it (ERP-5164 AC9). */
  const ownerRules = useAccountOwnerRules(userId);
  const ownerRowLocked = !ownerRules.removeOwnerRole.allowed;
  /* The owner removing themselves in bulk confirms the owner warning first
   * (ERP-7648 AC6); the generic wizard then handles any other roles. */
  const [bulkSelfRemoveOpen, setBulkSelfRemoveOpen] = useState(false);

  /* Live set of role IDs this user owns (subscribes to mutations). */
  const ownedRoleIds = useSyncExternalStore(
    subscribeRoleOwners,
    () => getRolesOwnedByUser(userId),
    () => getRolesOwnedByUser(userId),
  );
  const ownedRoleIdSet = useMemo(() => new Set(ownedRoleIds), [ownedRoleIds]);

  // Get user's assigned role IDs from their roleAssignments
  const userRoleNames = useMemo(
    () => new Set(user.roleAssignments.map((r) => r.name)),
    [user.roleAssignments]
  );

  // Filter roles data to only user's assigned roles
  const userRoles = useMemo(
    () => roles.filter((r) => userRoleNames.has(r.roleName)),
    [userRoleNames]
  );
  const rolesAdvancedFilter = useMemo(() => buildRolesAdvancedFilter(userRoles), [userRoles]);

  // Selected roles → bulk-removal descriptors (membership + ownership facts).
  const selectedRoles = useMemo(
    () =>
      userRoles
        .filter((r) => selectedRoleIds.includes(r.id))
        // Account Owner never goes through the generic wizard: it's either
        // left out (locked) or handled by the owner warning (self).
        .filter((r) => !(r.isProtected && (ownerRowLocked || ownerRules.isSelf)))
        .map((r) => {
          const owns = isRoleOwner(r.id, userId);
          return {
            id: r.id,
            roleName: r.roleName,
            isOwner: owns,
            isOnlyOwner: owns && getRoleOwners(r.id).length === 1,
          };
        }),
    // ownedRoleIdSet keeps this fresh when ownership mutates.
    [userRoles, selectedRoleIds, userId, ownedRoleIdSet, ownerRowLocked, ownerRules.isSelf],
  );

  /* Inactive-roles banner: rendered flush above the table header (connects to
   *  the column-header row via a darker amber divider line). */
  const inactiveRoleBanner = useMemo(() => {
    if (user.status === "Archived") return null;
    if (inactiveBannerDismissed) return null;
    const inactiveRoles = userRoles.filter(
      (r) => getRoleInactiveCause(r, user) !== null,
    );
    if (inactiveRoles.length === 0) return null;
    const count = inactiveRoles.length;
    const noLicense = user.license === "No License";
    const message = noLicense
      ? `${count} assigned role${count === 1 ? "" : "s"} ${count === 1 ? "is" : "are"} inactive until a license is assigned.`
      : `${count} role${count === 1 ? "" : "s"} require a higher license tier and ${count === 1 ? "is" : "are"} inactive until the license is upgraded.`;
    return (
      <div
        className="flex items-center gap-2.5 px-4 py-2.5"
        style={{
          backgroundColor: "#FFFBEB",
          borderBottom: "1px solid #FCD34D",
          color: "#92400E",
        }}
        role="status"
      >
        <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#D97706" }} aria-hidden />
        <span className="text-[12.5px] leading-snug flex-1 min-w-0 truncate" style={{ fontWeight: 500 }}>
          {message}
        </span>
        <button
          type="button"
          onClick={() => setInactiveBannerDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 p-0.5 rounded-md transition-colors hover:bg-[#FDE68A]/50 cursor-pointer"
        >
          <X className="w-4 h-4" style={{ color: "#92400E" }} />
        </button>
      </div>
    );
  }, [user, userRoles, inactiveBannerDismissed]);

  // Filter requests to only this user's (use first 5 as mock). These are the
  // current user's own requests, so stamp the requester identity to the user
  // whose detail page we're on rather than the source row's placeholder name.
  const userRequests_ = useMemo(
    () =>
      userRequests.slice(0, 5).map((r) => ({
        ...r,
        requestedBy: user.fullName,
        email: user.email,
      })),
    [user.fullName, user.email],
  );

  /* Detect license upgrades that unlock previously license-blocked roles
     and flash the now-available rows green for visual feedback. */
  useEffect(() => {
    const prev = prevLicenseRef.current;
    const next = user.license;
    if (prev !== next && next === "Full Access" && prev !== "Full Access") {
      const unlocked = userRoles
        .filter((r) => r.licenseRequired === "Full Access")
        .map((r) => r.id);
      if (unlocked.length > 0 && user.status !== "Inactive" && user.status !== "Archived") {
        setFlashRoleIds(new Set(unlocked));
        const t = setTimeout(() => setFlashRoleIds(new Set()), 1600);
        prevLicenseRef.current = next;
        return () => clearTimeout(t);
      }
    }
    prevLicenseRef.current = next;
  }, [user.license, user.status, userRoles]);

  const totalPermissions = useMemo(() => {
    const seed = userId * 7 + 3;
    return 8 + (seed % 40);
  }, [userId]);

  const lastRoleChange = user.activityLog.find((a) => a.type === "role_change")?.timestamp?.split(" - ")[0] ?? "-";
  const pendingCount = isArchived
    ? 0
    : userRequests_.filter((r) => r.status === "Pending").length;

  /* ── Custom columns with primary badge + inactive-role treatment + Owner column ── */
  const userRoleColumns = useMemo((): ColumnDef<RoleRow>[] => {
    const transformed = ROLES_COLUMNS.map((col) => {
      if (col.key === "role_name") {
        return {
          ...col,
          render: (row, helpers) => {
            const isPrimary = primaryRoleName === row.roleName;
            const isComfort = helpers.density === "comfort";
            const inactiveCause = getRoleInactiveCause(row, user);
            const isInactive = inactiveCause !== null;
            return (
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {isInactive && <InactiveRoleIcon cause={inactiveCause!} firstName={user.firstName} />}
                  {row.isSystem && <SystemRoleLock size={13} />}
                  <span
                    className={`${isComfort ? "text-[13.5px]" : "text-sm"} truncate min-w-0`}
                    style={{ fontWeight: 500, color: "#1E293B" }}
                  >
                    {helpers.highlightText(row.roleName)}
                  </span>
                </div>
                {!isInactive && isPrimary && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="shrink-0 inline-flex items-center cursor-default">
                        <Star className="w-4 h-4" style={{ color: "#007FFF", fill: "#007FFF" }} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      Primary role for this user
                    </TooltipContent>
                  </Tooltip>
                )}
                {!isInactive && !isPrimary && access.canAssignRoles && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrimaryRoleName(row.roleName);
                          toast.success(`${row.roleName} set as primary role.`);
                        }}
                        className="shrink-0 opacity-0 group-hover/row:opacity-100 transition-all duration-150 p-1 rounded-md hover:bg-[#FFFBEB] cursor-pointer"
                      >
                        <Star className="w-4 h-4" style={{ color: "#F59E0B", fill: "transparent" }} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      Set as Primary
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            );
          },
        } as ColumnDef<RoleRow>;
      }
      return col;
    });

    const ownerColumn: ColumnDef<RoleRow> = {
      key: "owner",
      label: "Owner",
      width: 100,
      render: (row) => {
        const isOwner = ownedRoleIdSet.has(row.id);
        if (!isOwner) {
          return (
            <span className="text-[#94A3B8]" style={{ fontWeight: 400 }}>
              -
            </span>
          );
        }
        return (
          <span
            className="inline-flex items-center rounded border whitespace-nowrap px-2 py-0.5 text-xs"
            style={{
              fontWeight: 500,
              backgroundColor: "#FEF3C7",
              color: "#92400E",
              borderColor: "#FCD34D",
            }}
          >
            Owner
          </span>
        );
      },
    };

    const usersIdx = transformed.findIndex((c) => c.key === "users");
    if (usersIdx >= 0) {
      transformed.splice(usersIdx + 1, 0, ownerColumn);
    } else {
      transformed.push(ownerColumn);
    }
    return transformed;
  }, [primaryRoleName, ownedRoleIdSet, user]);

  const getRoleRowAccent = useCallback(
    (row: RoleRow) => {
      if (flashRoleIds.has(row.id)) return "#D1FAE5"; // flash green
      return getRoleInactiveCause(row, user) !== null ? "#FFFBEB" : null;
    },
    [user, flashRoleIds]
  );

  /* ── Roles tab callbacks ── */
  const getRoleRowId = useCallback((row: RoleRow) => row.id, []);
  const renderRoleActions = useCallback((row: RoleRow) => <RemoveRoleAction row={row} user={user} />, [user]);
  const handleRoleRowClick = useCallback(
    (row: RoleRow) => navigate(`/company-settings/user-access-control/role/${row.id}`),
    [navigate]
  );
  const renderRoleCard = useCallback(
    (row: RoleRow, helpers: RenderHelpers) => {
      const inactiveCause = getRoleInactiveCause(row, user);
      const isInactive = inactiveCause !== null;
      return (
        <div
          className={`border rounded-xl ${CARD_SIZE_PADDING[helpers.cardSize]} cursor-pointer hover:shadow-md hover:border-[#007FFF]/20 transition-all h-full`}
          style={{
            backgroundColor: isInactive ? "#FFFBEB" : undefined,
            borderColor: isInactive ? "#FDE68A" : undefined,
          }}
        >
          <div className="flex items-start justify-between mb-3 gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {isInactive && <InactiveRoleIcon cause={inactiveCause!} firstName={user.firstName} />}
                {row.isSystem && <SystemRoleLock size={13} />}
                <span
                  className="text-sm block truncate"
                  style={{ fontWeight: 500, color: "#1E293B" }}
                >
                  {row.roleName}
                </span>
              </div>
            </div>
            <div className="shrink-0">
              <RemoveRoleAction row={row} user={user} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <StatusBadge
              status={row.status}
              configMap={{
                Active: { bg: "#ECFDF5", text: "#059669", dot: "#10B981" },
                Inactive: { bg: "#FFFBEB", text: "#D97706", dot: "#F59E0B", label: "Deactivated" },
                Draft: { bg: "#F8FAFC", text: "#64748B", dot: "#94A3B8" },
                Archived: { bg: "#FEF2F2", text: "#DC2626", dot: "#EF4444" },
              }}
            />
            <LicenseBadge license={row.licenseRequired} />
          </div>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Description</span>
              <span className="text-foreground truncate max-w-[60%] text-right">{row.description}</span>
            </div>
            <div className="flex justify-between">
              <span>Users</span>
              <span className="text-foreground" style={{ fontWeight: 500 }}>{row.usersCount}</span>
            </div>
          </div>
        </div>
      );
    },
    [user]
  );

  /* ── Requests tab callbacks ── */
  const getRequestRowId = useCallback((row: UserRequestRow) => row.id, []);
  const handleRequestRowClick = useCallback((row: UserRequestRow) => setSelectedRequest(row), []);

  /* Inline "Review"/"View" link cell, replaces quick action buttons */
  const renderRequestActions = useCallback(
    (row: UserRequestRow) => {
      const isPending = row.status === "Pending";
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
          <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              className="cursor-pointer"
              style={isPending ? { color: "#007FFF" } : undefined}
              onSelect={() => setSelectedRequest(row)}
            >
              <Eye className="w-4 h-4 mr-2" style={isPending ? { color: "#007FFF" } : undefined} />
              {isPending ? "Review request" : "View details"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    []
  );

  /* Redesigned card: clean title, single bullet, status-tinted gradient */
  const renderRequestCard = useCallback(
    (row: UserRequestRow, helpers: RenderHelpers) => {
      const isPending = row.status === "Pending";
      const permNames = getRequestedPermissionNames(row);
      const firstPerm = permNames[0];
      const extra = Math.max(0, permNames.length - 1);

      // Subtle status gradient (much softer, barely-there tint at bottom)
      const gradientByStatus: Record<string, string> = {
        Pending:  "linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 70%, rgba(254, 243, 199, 0.22) 100%)",
        Accepted: "linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 70%, rgba(209, 250, 229, 0.22) 100%)",
        Rejected: "linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 70%, rgba(254, 226, 226, 0.22) 100%)",
      };

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
              displayLabel={REQUEST_STATUS_LABELS[row.status]}
            />
          </div>

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

  /* ── Add Role CTA: secondary blue-border style, mirrors the Quick Invite
   *  CTA on the Users tab. Lives in the segmented-control row when the Roles
   *  sub-tab is active. ── */
  const addRoleButton = (
    <button
      type="button"
      onClick={() => setAddRolesOpen(true)}
      className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[8px] border border-[#007FFF] bg-white shadow-xs hover:bg-[#EDF4FF] transition-colors cursor-pointer"
      style={{ color: "#007FFF" }}
    >
      <Plus className="w-4 h-4" />
      <span className="text-sm" style={{ fontWeight: 500 }}>Add Role</span>
    </button>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-5">
      {/* KPI Strip: hidden per design feedback (the segmented-control header
       *  below already conveys the active section; the four counts were
       *  redundant noise above the table). */}

      {/* Tabbed data table container */}
      <div className="border border-border rounded-xl bg-card overflow-clip flex flex-col flex-1 min-h-0">
        {/* Segmented control row: pixel match with the Partner Details
         *  items-tabs pattern: slate text by default, theme colour only on
         *  active, white pill background + soft shadow for the selected
         *  tab. No icons (per design feedback). */}
        <div className="flex items-center justify-between gap-3 px-4 pt-2.5 pb-2 border-b border-border shrink-0">
          <SegmentedTabs
            tabs={SUB_TABS.map((t) =>
              t.key === "requests"
                ? { ...t, badge: pendingCount }
                : t
            )}
            value={subTab}
            onChange={(k) => setSubTab(k as SubTab)}
          />
          {/* Contextual CTA: only the Roles sub-tab shows the Add Role button.
           *  Hidden for archived users (no access mutations allowed). */}
          {subTab === "roles" && !isArchived && access.canAssignRoles && addRoleButton}
        </div>

        {/* Archived users: every sub-tab is a read-only empty state. */}
        {isArchived && subTab === "roles" && <ArchivedAccessEmptyState />}
        {isArchived && subTab === "permissions" && <ArchivedAccessEmptyState />}
        {isArchived && subTab === "requests" && <ArchivedRequestsEmptyState />}

        {/* Tab content */}
        {!isArchived && subTab === "roles" && (
          <>
            <DataTable<RoleRow>
              headerBanner={inactiveRoleBanner}
              data={userRoles}
              columns={userRoleColumns}
              getRowId={getRoleRowId}
              searchPlaceholder="Search by role name or description..."
              searchPredicate={rolesSearchPredicate}
              quickFilters={ROLES_QUICK_FILTERS}
              filterPredicate={rolesFilterPredicate}
              showMeMode={false}
              emptyIcon={<Shield className="w-8 h-8" />}
              emptyMessage="No roles assigned"
              renderActions={renderRoleActions}
              renderCard={renderRoleCard}
              entityLabel="roles"
              onRowClick={handleRoleRowClick}
              hideColumnSelector
              sortFn={sortRolesCustomFirst}
              rowGroupFn={roleGroupFn}
              rowGroupLabels={ROLE_GROUP_LABELS}
              persistKey="user-detail:roles"
              advancedFilter={rolesAdvancedFilter}
              getRowAccent={getRoleRowAccent}
              selectedIds={selectedRoleIds}
              onSelectedIdsChange={setSelectedRoleIds}
              bulkActionsSlot={(count, ids, clear) => {
                /* The bulk path is the same removal the row menu just blocked,
                 * so it has to honour the same boundary or it becomes the way
                 * around it. Disabled with the selection-level reason, matching
                 * how the Roles listing bulk bar handles its own exclusions. */
                const bulkScopeBlocked = Array.from(ids).some(
                  (id) => !isRoleInScope(Number(id), access),
                );
                const ownerRowSelected =
                  ownerRowLocked &&
                  Array.from(ids).some((id) => isProtectedRoleId(Number(id)));
                const onlyOwnerRow = ownerRowSelected && count === 1;
                const selfOwnerRowSelected =
                  !ownerRowLocked &&
                  ownerRules.isSelf &&
                  Array.from(ids).some((id) => isProtectedRoleId(Number(id)));
                return (
                  <BulkActionBar
                    selectedCount={count}
                    onCancel={clear}
                    actions={[
                      {
                        key: "remove-roles",
                        label: count === 1 ? "Remove Role" : "Remove Roles",
                        icon: <Trash2 className="w-3.5 h-3.5" />,
                        variant: "danger",
                        disabled: bulkScopeBlocked || onlyOwnerRow,
                        tooltip: bulkScopeBlocked
                          ? SCOPE_DENIED_BULK_REASON
                          : ownerRowSelected
                            ? `Account Owner is left out. ${ownerRules.removeOwnerRole.reason}`
                            : undefined,
                        onClick: () =>
                          selfOwnerRowSelected ? setBulkSelfRemoveOpen(true) : setBulkRemoveOpen(true),
                      },
                    ]}
                  />
                );
              }}
            />
            <SelfRemoveAccountOwnerModal
              open={bulkSelfRemoveOpen}
              onClose={() => setBulkSelfRemoveOpen(false)}
              userId={userId}
              onConfirm={() => {
                const ownerRole = userRoles.find((r) => r.isProtected);
                if (ownerRole) removeRoleFromUser(userId, ownerRole.roleName);
                setSelectedRoleIds((prev) => prev.filter((id) => !isProtectedRoleId(Number(id))));
                if (selectedRoles.length > 0) setBulkRemoveOpen(true);
                else toast.success(`${user.fullName} has been removed from ${ownerRole?.roleName ?? "Account Owner"}.`);
              }}
            />
            {bulkRemoveOpen && (
              <RemoveRoleWizard
                open={bulkRemoveOpen}
                onClose={() => setBulkRemoveOpen(false)}
                userId={userId}
                userName={user.fullName}
                // single-role props unused in bulk mode
                roleId={0}
                roleName=""
                bulkRoles={selectedRoles}
                onConfirmBulk={({ removedRoleIds, ownedRoleIds: ownedToRemove }) => {
                  ownedToRemove.forEach((rid) => removeRoleOwner(rid, userId));
                  removedRoleIds.forEach((rid) => {
                    const role = userRoles.find((r) => r.id === rid);
                    if (role) removeRoleFromUser(userId, role.roleName);
                  });
                  setSelectedRoleIds([]);
                }}
              />
            )}
            <AddRolesModal
              open={addRolesOpen}
              onClose={() => setAddRolesOpen(false)}
              userName={user.fullName}
              assignedRoleNames={userRoleNames}
              hasExistingPrimary={!!primaryRoleName}
              onAssign={(roleNames, newPrimaryRoleName) => {
                addRolesToUser(userId, roleNames);
                if (newPrimaryRoleName) setPrimaryRoleName(newPrimaryRoleName);
              }}
            />
          </>
        )}

        {!isArchived && subTab === "permissions" && (
          <div className="p-4 flex-1 min-h-0 flex flex-col">
            <AssignedPermissionsTab user={user} />
          </div>
        )}

        {!isArchived && subTab === "requests" && (
          <>
            <DataTable<UserRequestRow>
              data={userRequests_}
              columns={USER_DETAIL_REQUESTS_COLUMNS}
              getRowId={getRequestRowId}
              searchPlaceholder="Search by module or reason..."
              searchPredicate={userRequestsSearchPredicate}
              quickFilters={USER_REQUESTS_QUICK_FILTERS}
              filterPredicate={userRequestsFilterPredicate}
              showMeMode={false}
              emptyIcon={<Inbox className="w-8 h-8" />}
              emptyMessage="No permission requests"
              emptyFilterMessage={(filterLabel) => `No ${filterLabel} Requests`}
              emptySearchMessage="No Requests Match Your Search"
              renderActions={renderRequestActions}
              renderCard={renderRequestCard}
              entityLabel="requests"
              onRowClick={handleRequestRowClick}
              defaultDensity="card"
              defaultActiveFilters={["pending"]}
              hideSelection
              hideBulkBar
              persistKey="user-detail:requests"
            />

            {selectedRequest && (
              <UserRequestDetailModal
                request={selectedRequest}
                onClose={() => setSelectedRequest(null)}
              />
            )}
          </>
        )}

      </div>
    </div>
  );
}
