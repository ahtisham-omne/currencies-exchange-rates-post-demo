import type { RenderHelpers } from "../data-table/types";
import { ACCOUNT_OWNER_COPY, getAccountOwnerRules } from "../../data/account-owner";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useViewerId } from "../../data/viewer";
import { LockedMenuItem } from "../shared/LockedMenuItem";
import { cardShellClass } from "../data-table/types";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { User, UserPlus, MoreHorizontal, ExternalLink, X, Crown } from "lucide-react";
import { toast } from "sonner";
import type { UserRow } from "../../data/users-data";
import type { RoleDetail } from "../../data/role-detail-data";
import { getAssignedUsers } from "../../data/role-detail-data";
import { DataTable } from "../data-table/DataTable";
import {
  USERS_COLUMNS,
  USERS_QUICK_FILTERS,
  usersSearchPredicate,
  usersFilterPredicate,
  buildUsersAdvancedFilter,
} from "../../data/users-table-config";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { DestructiveConfirmModal } from "../shared/DestructiveConfirmModal";
import { SelfRemoveAccountOwnerModal } from "../shared/SelfRemoveAccountOwnerModal";
import { removeRoleOwner } from "../../data/role-owners-data";
import { removeRoleFromUser } from "../../data/user-detail-data";

/** Slim column set: same as Create Role → Assign Users step. Actions column
 *  is rendered separately by DataTable via `renderActions`. */
const ALLOWED_KEYS = new Set([
  "full_name",
  "assigned_roles",
  "license",
  "email",
  "status",
]);
import { AvatarCell, StatusBadge, LicenseBadge, RolesCell } from "../table-cells";
import { USER_AVATAR_MAP } from "../../data/user-avatars";
import { AssignUsersModal } from "./AssignUsersModal";
import { getRoleOwnerUserIds } from "../../data/role-owners-data";
import { RoleOwnerCrown } from "./RoleOwnersTab";
import { useSyncExternalStore } from "react";
import { subscribeRoleOwners } from "../../data/role-owners-data";
import { getLicenseInaccessibleRoles, toTitleCase } from "../../lib/role-license";
import { AccessGate, useAccessMode, useRoleInScope, useScopedGate } from "../access-mode";

interface Props {
  role: RoleDetail;
}

/* ── Shared structured tooltip: grouped sections, repositions to whichever
 *    row marker is hovered. Mirrors the Import Review error-row tooltip. ── */
type TipTone = "amber" | "slate";
interface TipSection {
  header: string;
  tone: TipTone;
  lines: string[];
}
interface TipState {
  x: number;
  y: number;
  sections: TipSection[];
}

export function RoleUsersTab({ role }: Props) {
  const access = useAccessMode();
  /* Rows are rendered from a callback, so the viewer is read once here and
   * each row's Account Owner verdict is computed against it. */
  const viewerId = useViewerId();
  /* Assign Users and Remove From Role are the scoped ur-manage-roles grant, so
   * out of scope the roster still renders in full and only those affordances
   * change. They follow the Denied actions setting, so a reviewer can see the
   * boundary either as absent or as disabled-with-a-reason. */
  const inScope = useRoleInScope(role.id);
  const scoped = useScopedGate();
  const gAssignUsers = scoped(true, access.canAssignRoles, inScope);
  const gRemoveFromRole = scoped(true, access.canAssignRoles, inScope);
  const gRemoveOwnership = scoped(true, access.canManageRoleOwners, inScope);
  const navigate = useNavigate();
  const [showAssignModal, setShowAssignModal] = useState(false);
  const assignedUsers = useMemo(
    () => getAssignedUsers(role.assignedUserIds),
    [role.assignedUserIds]
  );
  const usersAdvancedFilter = useMemo(() => buildUsersAdvancedFilter(assignedUsers), [assignedUsers]);
  /* Live owner IDs for this role: drives crown rendering on the Users tab */
  const ownerIds = useSyncExternalStore(
    subscribeRoleOwners,
    () => getRoleOwnerUserIds(role.id),
    () => getRoleOwnerUserIds(role.id),
  );
  const ownerIdSet = useMemo(() => new Set(ownerIds), [ownerIds]);

  /* Role owners always surface at the top of the list (stable within groups);
   * an interactive column sort still takes precedence when the user applies one. */
  const ownersFirstSort = useCallback(
    (a: UserRow, b: UserRow) =>
      Number(ownerIdSet.has(b.id)) - Number(ownerIdSet.has(a.id)),
    [ownerIdSet],
  );

  /* ── One shared tooltip instance, repositioned per hovered marker. ── */
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);

  const openTip = useCallback((el: HTMLElement, sections: TipSection[]) => {
    if (sections.length === 0) return;
    if (tipTimer.current) clearTimeout(tipTimer.current);
    // Standard table-row hover delay (200ms).
    tipTimer.current = setTimeout(() => {
      const r = el.getBoundingClientRect();
      setTip({ x: r.left + r.width / 2, y: r.top - 8, sections });
    }, 200);
  }, []);

  const closeTip = useCallback(() => {
    if (tipTimer.current) {
      clearTimeout(tipTimer.current);
      tipTimer.current = null;
    }
    setTip(null);
  }, []);

  useEffect(() => () => { if (tipTimer.current) clearTimeout(tipTimer.current); }, []);

  /* Per-row content for the shared tooltip. Only the license "Needs attention"
   *  warning surfaces here; a row with no blocking issue shows no tooltip. */
  const buildSections = useCallback(
    (row: UserRow): TipSection[] => {
      const sections: TipSection[] = [];

      const inaccessible = getLicenseInaccessibleRoles(row.license, row.assignedRoles);
      if (inaccessible.length > 0) {
        const firstName = row.fullName.split(" ")[0] || row.fullName;
        const line =
          row.license === "No License"
            ? `${firstName} currently has no license. ${inaccessible.length} of the assigned role${inaccessible.length === 1 ? "" : "s"} will not take effect until a license is assigned.`
            : `${firstName} currently has a Field User license. ${inaccessible.length} of the assigned role${inaccessible.length === 1 ? "" : "s"} require${inaccessible.length === 1 ? "s" : ""} a Full Access license. The permissions in ${inaccessible.length === 1 ? "this role" : "these roles"} will not take effect until the license is upgraded.`;
        sections.push({ header: "Needs Attention", tone: "amber", lines: [line] });
      }

      return sections;
    },
    []
  );

  /* Wrap the shared columns:
   *  • full_name: role-owner crown
   *  • assigned_roles: amber triangle defers to the shared tooltip */
  const slimColumns = useMemo(
    () =>
      USERS_COLUMNS.filter((c) => ALLOWED_KEYS.has(c.key)).map((col) => {
        if (col.key === "full_name") {
          return {
            ...col,
            render: (row: UserRow, helpers: RenderHelpers) => {
              const isComfort = helpers.density === "comfort";
              const isOwner = ownerIdSet.has(row.id);
              return (
                <AvatarCell
                  name={row.fullName}
                  nameNode={helpers.highlightText(row.fullName)}
                  trailing={isOwner ? <RoleOwnerCrown /> : undefined}
                  subtitle={isComfort ? row.email : undefined}
                  subtitleNode={isComfort ? helpers.highlightText(row.email) : undefined}
                  comfort={isComfort}
                  avatarUrl={USER_AVATAR_MAP[row.id]}
                  userId={row.id}
                />
              );
            },
          };
        }
        if (col.key === "assigned_roles") {
          return {
            ...col,
            render: (row: UserRow, helpers: RenderHelpers) => {
              const { highlightText, density, searchQuery } = helpers;
              const inaccessible = getLicenseInaccessibleRoles(row.license, row.assignedRoles);
              const alertNames = new Set(inaccessible.map((r) => r.toLowerCase()));
              const titleCasedFirst = toTitleCase(row.assignedRoles[0] ?? "");
              const titleCasedAll = row.assignedRoles.map(toTitleCase);
              const sections = buildSections(row);
              return (
                <RolesCell
                  roles={titleCasedAll}
                  firstRoleNode={highlightText(titleCasedFirst)}
                  comfort={density === "comfort"}
                  searchQuery={searchQuery}
                  userId={row.id}
                  licenseAlertNames={alertNames}
                  licenseAlertHover={
                    inaccessible.length > 0
                      ? {
                          onEnter: (el) => openTip(el, sections),
                          onLeave: closeTip,
                        }
                      : undefined
                  }
                />
              );
            },
          };
        }
        return col;
      }),
    [ownerIdSet, buildSections, openTip, closeTip],
  );

  const getRowId = useCallback((row: UserRow) => row.id, []);

  /* Confirmation modal state */
  const [removeFromRoleTarget, setRemoveFromRoleTarget] = useState<UserRow | null>(null);
  const [removeOwnershipTarget, setRemoveOwnershipTarget] = useState<UserRow | null>(null);

  const handleConfirmRemoveFromRole = useCallback(() => {
    if (!removeFromRoleTarget) return;
    const u = removeFromRoleTarget;
    if (ownerIdSet.has(u.id)) {
      removeRoleOwner(role.id, u.id);
    }
    removeRoleFromUser(u.id, role.roleName);
    toast.success(`${u.fullName} has been removed from ${role.roleName}.`);
    setRemoveFromRoleTarget(null);
  }, [removeFromRoleTarget, ownerIdSet, role.id, role.roleName]);

  const selfOwnerRemoval =
    !!role.isProtected && removeFromRoleTarget != null && removeFromRoleTarget.id === viewerId;

  const handleConfirmRemoveOwnership = useCallback(() => {
    if (!removeOwnershipTarget) return;
    const u = removeOwnershipTarget;
    removeRoleOwner(role.id, u.id);
    toast.success(`${u.fullName} is no longer an owner of ${role.roleName}.`);
    setRemoveOwnershipTarget(null);
  }, [removeOwnershipTarget, role.id, role.roleName]);

  const renderActions = useCallback(
    (row: UserRow) => {
      const isOwner = ownerIdSet.has(row.id);
      /* On the Account Owner role, only the holder removes themselves, and
       * never as its last holder (ERP-5510 AC15). */
      const ownerRemoval = role.isProtected
        ? getAccountOwnerRules(row.id, viewerId).removeOwnerRole
        : null;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="w-7 h-7 rounded-md hover:bg-[#F1F5F9] flex items-center justify-center cursor-pointer transition-colors"
            >
              <MoreHorizontal className="w-4 h-4 text-[#64748B]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              onClick={() => navigate(`/company-settings/user-access-control/user/${row.id}`)}
              className="cursor-pointer text-[13px]"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-2 text-[#64748B]" />
              User Details
            </DropdownMenuItem>
            {/* Radix's own `disabled`, so keyboard navigation skips the item;
                the reason rides along as `title` because a menu item can't host
                a tooltip. Same treatment the roles row menu already uses. */}
            {isOwner && gRemoveOwnership.render && (
              <DropdownMenuItem
                disabled={gRemoveOwnership.disabled}
                title={gRemoveOwnership.reason || undefined}
                onClick={() => setRemoveOwnershipTarget(row)}
                className={`text-[13px] text-[#D97706] focus:text-[#D97706] focus:bg-[#FFFBEB] ${
                  gRemoveOwnership.disabled ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <Crown className="w-3.5 h-3.5 mr-2" />
                Remove Ownership
              </DropdownMenuItem>
            )}
            {gRemoveFromRole.render && ownerRemoval && !ownerRemoval.allowed ? (
              <LockedMenuItem reason={ownerRemoval.reason} className="text-[13px] text-[#DC2626]">
                <X className="w-3.5 h-3.5 mr-2" />
                Remove From Role
              </LockedMenuItem>
            ) : gRemoveFromRole.render && (
              <DropdownMenuItem
                disabled={gRemoveFromRole.disabled}
                title={gRemoveFromRole.reason || undefined}
                onClick={() => setRemoveFromRoleTarget(row)}
                className={`text-[13px] text-[#DC2626] focus:text-[#DC2626] focus:bg-[#FEF2F2] ${
                  gRemoveFromRole.disabled ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <X className="w-3.5 h-3.5 mr-2" />
                Remove From Role
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    [navigate, ownerIdSet, gRemoveOwnership, gRemoveFromRole, role.isProtected, viewerId],
  );

  const renderCard = useCallback(
    (
      row: UserRow,
      helpers: RenderHelpers
    ) => {
      const isOwner = ownerIdSet.has(row.id);
      return (
        <div className={cardShellClass(helpers.cardSize)}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <AvatarCell
                name={row.fullName}
                trailing={isOwner ? <RoleOwnerCrown /> : undefined}
                userId={row.id}
                avatarUrl={USER_AVATAR_MAP[row.id]}
              />
            </div>
            <div className="shrink-0 ml-2">
              {renderActions(row)}
            </div>
          </div>
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <StatusBadge status={row.status} />
            <LicenseBadge license={row.license} />
          </div>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Email</span>
              <span className="text-foreground truncate max-w-[60%] text-right">{row.email}</span>
            </div>
            <div className="flex justify-between">
              <span>Roles</span>
              <span className="text-foreground" style={{ fontWeight: 500 }}>
                {row.assignedRoles.length} assigned
              </span>
            </div>
            <div className="flex justify-between">
              <span>Last Logon</span>
              <span className="text-foreground">{row.lastLogon}</span>
            </div>
            <div className="flex justify-between">
              <span>Invited On</span>
              <span className="text-foreground">{row.invitedOn}</span>
            </div>
          </div>
        </div>
      );
    },
    [renderActions, ownerIdSet]
  );

  const handleRowClick = useCallback(
    (row: UserRow) => {
      navigate(`/company-settings/user-access-control/user/${row.id}`);
    },
    [navigate]
  );

  /* Account Owner: nobody in the tenant adds holders, so Add Users stays
   * visible but disabled with the reason, whatever the Denied actions setting
   * (onboarding sets the first owner, then only OMNE changes who it is). */
  const lockedAddUsers = (primary: boolean) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <button
            type="button"
            disabled
            aria-disabled
            className={
              primary
                ? "inline-flex items-center gap-1.5 h-9 px-4 text-[13px] rounded-lg text-white opacity-50 cursor-not-allowed"
                : "inline-flex items-center gap-2 h-9 px-3.5 rounded-[8px] border border-[#007FFF] bg-white opacity-50 cursor-not-allowed"
            }
            style={primary ? { backgroundColor: "#007FFF", fontWeight: 600 } : { color: "#007FFF" }}
          >
            <UserPlus className={primary ? "w-3.5 h-3.5" : "w-4 h-4"} />
            <span className={primary ? undefined : "text-sm"} style={primary ? undefined : { fontWeight: 500 }}>Add Users</span>
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[260px] text-xs">
        {ACCOUNT_OWNER_COPY.assignRole}
      </TooltipContent>
    </Tooltip>
  );

  const assignUserButton = useMemo(
    () =>
      role.isProtected ? lockedAddUsers(false) :
      /* Role membership is an access grant, so a persona that can't assign
         roles — or a role outside its Manage Roles scope — loses the Add Users
         affordance. AccessGate renders it dimmed with the reason on hover when
         the Denied actions setting says "disabled", and drops it (collapsing
         the toolbar slot) when it says "hidden". */
      gAssignUsers.render ? (
        <AccessGate capability={!gAssignUsers.disabled} reason={gAssignUsers.reason}>
          <button
            type="button"
            onClick={() => setShowAssignModal(true)}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[8px] border border-[#007FFF] bg-white shadow-xs hover:bg-[#EDF4FF] transition-colors cursor-pointer"
            style={{ color: "#007FFF" }}
          >
            <UserPlus className="w-4 h-4" />
            <span className="text-sm" style={{ fontWeight: 500 }}>Add Users</span>
          </button>
        </AccessGate>
      ) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gAssignUsers, role.isProtected]
  );

  /* Empty-state CTA: a role with no members (a freshly unarchived one, say)
     has nothing to filter, so the table's Clear All Filters link has nothing
     to clear. The primary blue Add Users button takes that slot and opens the
     same AssignUsersModal as the toolbar affordance, behind the same gate. */
  const emptyStateAction = useMemo(
    () =>
      role.isProtected ? lockedAddUsers(true) :
      gAssignUsers.render ? (
        <AccessGate capability={!gAssignUsers.disabled} reason={gAssignUsers.reason}>
          <button
            type="button"
            onClick={() => setShowAssignModal(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] rounded-lg text-white shadow-sm transition-all duration-200 cursor-pointer hover:bg-[#0862D0]"
            style={{ backgroundColor: "#007FFF", fontWeight: 600 }}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add Users
          </button>
        </AccessGate>
      ) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gAssignUsers, role.isProtected]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* Full DataTable: pixel-perfect match with main Users tab */}
      <div
        className="rounded-xl bg-card overflow-clip flex flex-1 min-h-0 flex-col"
        style={{
          boxShadow:
            "0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)",
          border: "1px solid #E2E8F0",
        }}
      >
        <DataTable<UserRow>
          data={assignedUsers}
          columns={slimColumns}
          getRowId={getRowId}
          searchPlaceholder="Search by name, type, or email..."
          searchPredicate={usersSearchPredicate}
          quickFilters={USERS_QUICK_FILTERS}
          filterPredicate={usersFilterPredicate}
          sortFn={ownersFirstSort}
          showMeMode
          /* Scoped per role, matching the AssignUsersModal precedent: the
             membership you want to look at differs role to role. */
          persistKey={`role-detail:users:${role.id}`}
          emptyIcon={<User className="w-8 h-8" />}
          emptyMessage="No users found"
          emptyAction={emptyStateAction}
          renderActions={renderActions}
          renderCard={renderCard}
          entityLabel="users"
          onRowClick={handleRowClick}
          toolbarAction={assignUserButton}
          advancedFilter={usersAdvancedFilter}
        />
      </div>

      {/* Shared structured tooltip: single instance, repositions to the
          hovered marker; only one is ever visible. */}
      {tip && createPortal(
        <div
          style={{
            position: "fixed",
            left: tip.x,
            top: tip.y,
            transform: "translate(-50%, -100%)",
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          <div
            className="bg-white border rounded-lg overflow-hidden"
            style={{ borderColor: "#E2E8F0", boxShadow: "0 4px 12px rgba(0,0,0,0.10)", width: 300 }}
          >
            {tip.sections.map((s, i) => (
              <div
                key={s.header}
                className={i > 0 ? "px-3 py-2.5 border-t" : "px-3 py-2.5"}
                style={i > 0 ? { borderColor: "#E2E8F0" } : undefined}
              >
                <p
                  className="text-[11px] uppercase mb-1"
                  style={{
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    color: s.tone === "amber" ? "#B45309" : "#64748B",
                  }}
                >
                  {s.header}
                </p>
                {s.lines.map((line, j) => (
                  <p key={j} className="text-[12.5px]" style={{ color: "#334155", lineHeight: 1.5 }}>
                    {line}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      <AssignUsersModal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        roleId={role.id}
        alreadyAssignedIds={assignedUsers.map((u) => u.id)}
        roleName={role.roleName}
        roleLicenseRequired={role.licenseRequired}
      />

      {/* An Account Owner removing themselves gets the owner warning instead
          (ERP-5510 AC15, ERP-7648 AC6); nobody else can remove an owner. */}
      <SelfRemoveAccountOwnerModal
        open={selfOwnerRemoval}
        onClose={() => setRemoveFromRoleTarget(null)}
        userId={viewerId}
        onConfirm={handleConfirmRemoveFromRole}
      />

      {/* Remove from role: destructive (red) confirmation */}
      <DestructiveConfirmModal
        open={removeFromRoleTarget != null && !selfOwnerRemoval}
        onClose={() => setRemoveFromRoleTarget(null)}
        badge="Remove"
        title={`Remove ${removeFromRoleTarget?.fullName ?? ""} from ${role.roleName}?`}
        description={
          <>
            <span style={{ fontWeight: 600 }}>{removeFromRoleTarget?.fullName}</span> will lose all
            permissions granted by <span style={{ fontWeight: 600 }}>{role.roleName}</span>
            {removeFromRoleTarget && ownerIdSet.has(removeFromRoleTarget.id)
              ? " and will also be removed as a role owner."
              : "."}{" "}
            This action cannot be undone.
          </>
        }
        confirmLabel="Remove from Role"
        onConfirm={handleConfirmRemoveFromRole}
        tone="danger"
      />

      {/* Remove ownership: warning (amber) confirmation */}
      <DestructiveConfirmModal
        open={removeOwnershipTarget != null}
        onClose={() => setRemoveOwnershipTarget(null)}
        badge="Remove Ownership"
        title={`Remove ${removeOwnershipTarget?.fullName ?? ""} as Role Owner?`}
        description={
          <>
            <span style={{ fontWeight: 600 }}>{removeOwnershipTarget?.fullName}</span> will no
            longer be able to manage assignments or approve permission requests for{" "}
            <span style={{ fontWeight: 600 }}>{role.roleName}</span>. They&rsquo;ll remain
            assigned to this role as a regular user.
          </>
        }
        confirmLabel="Remove Ownership"
        onConfirm={handleConfirmRemoveOwnership}
        tone="warning"
      />
    </div>
  );
}
