import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSyncExternalStore } from "react";
import { Crown, Info, MoreHorizontal, Eye, UserMinus, ShieldOff } from "lucide-react";
import { RemoveOwnershipModal } from "./RemoveOwnershipModal";
import { users as allUsers } from "../../data/users-data";
import { OverflowTooltip, type OverflowItem } from "../shared/OverflowTooltip";
import { USER_AVATAR_MAP } from "../../data/user-avatars";
import { getInitials, getAvatarTint } from "../../lib/avatar";
import type { UserDetail } from "../../data/user-detail-data";
import type { RoleRow } from "../../data/roles-data";
import { roles } from "../../data/roles-data";
import {
  getRolesOwnedByUser,
  getRoleOwners,
  subscribeRoleOwners,
} from "../../data/role-owners-data";
import { getOwnershipGrantedVia, type OwnershipGrantedVia } from "../../data/uac-derived";
import { DataTable } from "../data-table/DataTable";
import { StatusBadge } from "../table-cells";
import { RoleUsersPopover } from "../shared/RoleUsersPopover";
import { LinkedRoleName } from "../shared/LinkedRoleName";
import { LinkedUserName } from "../shared/LinkedUserName";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import type { ColumnDef, QuickFilterDef, RenderHelpers } from "../data-table/types";
import { CARD_SIZE_PADDING } from "../data-table/types";

interface Props {
  user: UserDetail;
}

/* ── Row shape for the Role Ownership table ── */
export interface OwnedRoleRow extends RoleRow {
  grantedVia: OwnershipGrantedVia;
  ownerCount: number;
  isSoleOwner: boolean;
  ownerUserIds: number[];
}

/* ── Chip configMaps: reuse the system-wide StatusBadge styling
 *    (rounded-full pill, border, fontWeight 500). Keeps these chips
 *    visually consistent with status pills used elsewhere. ── */
const GRANTED_VIA_MAP = {
  "role-assignment": {
    bg: "#F1F5F9",
    text: "#475569",
    dot: "#94A3B8",
    border: "#E2E8F0",
    label: "Role Assignment",
  },
  "manage-roles": {
    bg: "#EDF4FF",
    text: "#0A77FF",
    dot: "#0A77FF",
    border: "#B4D7FF",
    label: "Manage Roles",
  },
} as const;


/* ── Quick filters for ownership table ── */
const OWNERSHIP_QUICK_FILTERS: QuickFilterDef[] = [
  { key: "all", label: "Show All", showCount: false },
  { key: "sole", label: "Sole Owner", showCount: true, group: "ownership" },
  { key: "shared", label: "Shared", showCount: true, group: "ownership" },
];

function ownershipSearchPredicate(row: OwnedRoleRow, query: string): boolean {
  const q = query.toLowerCase();
  return (
    row.roleName.toLowerCase().includes(q) ||
    row.description.toLowerCase().includes(q)
  );
}

function ownershipFilterPredicate(row: OwnedRoleRow, key: string): boolean {
  if (key === "sole") return row.isSoleOwner;
  if (key === "shared") return !row.isSoleOwner;
  return true;
}

export function RoleOwnershipTab({ user }: Props) {
  const navigate = useNavigate();
  const userId = parseInt(user.id?.toString() ?? "0", 10);

  /* Subscribe to ownership store so changes elsewhere reflect here. */
  const ownedRoleIds = useSyncExternalStore(
    subscribeRoleOwners,
    () => getRolesOwnedByUser(userId),
    () => getRolesOwnedByUser(userId),
  );

  const ownedRoles = useMemo<OwnedRoleRow[]>(() => {
    return ownedRoleIds
      .map((rid): OwnedRoleRow | null => {
        const role = roles.find((r) => r.id === rid);
        if (!role) return null;
        const owners = getRoleOwners(rid);
        const ownerCount = owners.length;
        return {
          ...role,
          grantedVia: getOwnershipGrantedVia(rid, userId),
          ownerCount,
          isSoleOwner: ownerCount === 1,
          ownerUserIds: owners.map((o) => o.userId),
        };
      })
      .filter((r): r is OwnedRoleRow => r !== null);
  }, [ownedRoleIds, userId]);

  /* ── Columns ── */
  const columns = useMemo<ColumnDef<OwnedRoleRow>[]>(() => [
    {
      key: "role_name",
      label: "Role Name",
      width: 220,
      stickyLeft: true,
      render: (row, { highlightText, density }) => (
        <LinkedRoleName
          roleId={row.id}
          className={`${density === "comfort" ? "text-[13.5px]" : "text-sm"} truncate min-w-0 block`}
          style={{ fontWeight: 500, color: "#1E293B" }}
        >
          {highlightText(row.roleName)}
        </LinkedRoleName>
      ),
    },
    {
      key: "description",
      label: "Description",
      width: 320,
      render: (row, { highlightText, density }) => (
        <span
          className={`${density === "comfort" ? "text-[13.5px]" : "text-sm"} truncate block min-w-0`}
          style={{ color: "#64748B" }}
        >
          {highlightText(row.description)}
        </span>
      ),
    },
    {
      key: "granted_via",
      label: (
        <span className="inline-flex items-center gap-1.5">
          <span>Granted Via</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex items-center justify-center cursor-help"
                onClick={(e) => e.stopPropagation()}
                aria-label="Granted Via help"
              >
                <Info className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs max-w-[340px] leading-snug">
              <div className="space-y-1.5">
                <div>
                  <span style={{ fontWeight: 600, color: "#0F172A" }}>Role Assignment</span>
                  {": "}
                  <span style={{ color: "#475569" }}>
                    User was designated as owner from the role's detail page. They also hold this role.
                  </span>
                </div>
                <div>
                  <span style={{ fontWeight: 600, color: "#0F172A" }}>Manage Roles</span>
                  {": "}
                  <span style={{ color: "#475569" }}>
                    User has the system-level Manage Roles permission, which allows them to own and configure roles without being assigned to them.
                  </span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </span>
      ),
      width: 180,
      render: (row, { density }) => (
        <StatusBadge
          status={row.grantedVia}
          configMap={GRANTED_VIA_MAP as unknown as Record<string, { bg: string; text: string; dot: string; border?: string; label?: string }>}
          comfort={density === "comfort"}
        />
      ),
    },
    {
      key: "ownership",
      label: "Ownership",
      width: 220,
      render: (row, { density }) => {
        // Get all owner names, current user first
        const ownerUsers = row.ownerUserIds
          .map((uid) => allUsers.find((u) => u.id === uid))
          .filter(Boolean) as typeof allUsers;

        if (ownerUsers.length === 0) return <span style={{ color: "#94A3B8" }}>-</span>;

        // Show current user's name first if they're in the list
        const sorted = [...ownerUsers].sort((a, b) => {
          if (a.id === userId) return -1;
          if (b.id === userId) return 1;
          return 0;
        });

        const firstName = sorted[0].fullName;
        const moreCount = sorted.length - 1;
        const overflowUsers = sorted.slice(1);

        const overflowItems: OverflowItem[] = overflowUsers.map((u) => {
          const avatarUrl = USER_AVATAR_MAP[u.id];
          const initials = getInitials(u.fullName);
          const tint = getAvatarTint(u.fullName);
          return {
            id: String(u.id),
            name: u.fullName,
            initials: avatarUrl ? undefined : initials,
            avatarBg: avatarUrl ? undefined : tint.bg,
            avatarFg: avatarUrl ? undefined : tint.fg,
            href: `/company-settings/user-access-control/user/${u.id}`,
          };
        });

        const moreLabel = moreCount > 0 ? (
          <span
            className="shrink-0 leading-none cursor-pointer"
            style={{ fontSize: "11px", fontWeight: 600, color: "#085FCC" }}
          >
            +{moreCount} more
          </span>
        ) : null;

        return (
          <div className="flex items-center gap-1.5 min-w-0">
            <LinkedUserName
              userId={sorted[0].id}
              className={`${density === "comfort" ? "text-[13.5px]" : "text-sm"} truncate min-w-0`}
              style={{ color: "#334155" }}
            >
              {firstName}
            </LinkedUserName>
            {moreCount > 0 && (
              <OverflowTooltip items={overflowItems} category="Owners">
                {moreLabel}
              </OverflowTooltip>
            )}
          </div>
        );
      },
    },
    {
      key: "users",
      label: "Users",
      width: 100,
      render: (row, { density }) => (
        <RoleUsersPopover roleId={row.id} usersCount={row.usersCount} comfort={density === "comfort"} />
      ),
    },
  ], [userId]);

  const renderActions = useCallback(
    (row: OwnedRoleRow) => <RoleOwnershipActionsMenu row={row} userId={userId} userName={user.fullName} />,
    [userId, user.fullName],
  );

  const renderCard = useCallback(
    (row: OwnedRoleRow, h: RenderHelpers) => (
      <div
        className={`border border-border rounded-xl ${CARD_SIZE_PADDING[h.cardSize]} cursor-pointer hover:shadow-md hover:border-[#007FFF]/20 transition-all h-full bg-white`}
        onClick={() => navigate(`/company-settings/user-access-control/role/${row.id}`)}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-sm truncate" style={{ fontWeight: 500, color: "#1E293B" }}>
            {row.roleName}
          </span>
          {(() => {
            const ownerUsers = row.ownerUserIds
              .map((uid) => allUsers.find((u) => u.id === uid))
              .filter(Boolean) as typeof allUsers;
            const sorted = [...ownerUsers].sort((a, b) => {
              if (a.id === userId) return -1;
              if (b.id === userId) return 1;
              return 0;
            });
            const moreCount = sorted.length - 1;
            return (
              <span className="text-xs shrink-0" style={{ color: "#64748B" }}>
                {sorted[0]?.fullName}{moreCount > 0 && <span style={{ color: "#085FCC", fontWeight: 600 }}> +{moreCount} more</span>}
              </span>
            );
          })()}
        </div>
        <p className="text-xs mb-3 line-clamp-2" style={{ color: "#64748B" }}>
          {row.description}
        </p>
        <div className="flex items-center justify-between">
          <StatusBadge
            status={row.grantedVia}
            configMap={GRANTED_VIA_MAP as unknown as Record<string, { bg: string; text: string; dot: string; border?: string; label?: string }>}
          />
          <span className="text-xs" style={{ color: "#64748B" }}>
            {row.usersCount} users
          </span>
        </div>
      </div>
    ),
    [navigate, userId],
  );

  const getRowId = useCallback((row: OwnedRoleRow) => row.id, []);
  const handleRowClick = useCallback(
    (row: OwnedRoleRow) => navigate(`/company-settings/user-access-control/role/${row.id}`),
    [navigate],
  );

  if (ownedRoles.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
          style={{ backgroundColor: "#F1F5F9" }}
        >
          <Crown className="w-6 h-6" style={{ color: "#94A3B8" }} />
        </div>
        <p className="text-sm" style={{ color: "#0F172A", fontWeight: 600 }}>
          No Role Ownership
        </p>
        <p className="text-sm mt-1" style={{ color: "#64748B" }}>
          This user does not own any roles.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <DataTable<OwnedRoleRow>
        data={ownedRoles}
        columns={columns}
        getRowId={getRowId}
        searchPlaceholder="Search by role name or description..."
        searchPredicate={ownershipSearchPredicate}
        quickFilters={OWNERSHIP_QUICK_FILTERS}
        filterPredicate={ownershipFilterPredicate}
        showMeMode={false}
        emptyIcon={<Crown className="w-8 h-8" />}
        emptyMessage="No role ownership"
        renderActions={renderActions}
        renderCard={renderCard}
        entityLabel="roles"
        onRowClick={handleRowClick}
        hideColumnSelector
        persistKey="user-detail:role-ownership"
      />
    </TooltipProvider>
  );
}

/* ── Actions menu: 3-dot trigger + "View role" + remove ownership items ── */
function RoleOwnershipActionsMenu({ row, userId, userName }: { row: OwnedRoleRow; userId: number; userName: string }) {
  const navigate = useNavigate();
  const [removeOpen, setRemoveOpen] = useState(false);

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
        <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem
            onSelect={() => navigate(`/company-settings/user-access-control/role/${row.id}`)}
            className="cursor-pointer"
          >
            <Eye className="w-4 h-4 mr-2" />
            View role
          </DropdownMenuItem>
          {row.grantedVia === "role-assignment" && (
            <DropdownMenuItem
              className="cursor-pointer"
              style={{ color: "#B45309" }}
              onSelect={() => setRemoveOpen(true)}
            >
              <UserMinus className="w-4 h-4 mr-2" style={{ color: "#B45309" }} />
              Remove role ownership
            </DropdownMenuItem>
          )}
          {row.grantedVia === "manage-roles" && (
            <DropdownMenuItem
              className="cursor-pointer"
              style={{ color: "#B45309" }}
              onSelect={() => setRemoveOpen(true)}
            >
              <ShieldOff className="w-4 h-4 mr-2" style={{ color: "#B45309" }} />
              Remove Manage Roles permission
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <RemoveOwnershipModal
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        row={row}
        userId={userId}
        userName={userName}
      />
    </>
  );
}
