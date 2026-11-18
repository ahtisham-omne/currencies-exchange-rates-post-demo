import {
  useState,
  useMemo,
  useCallback,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import {
  Crown,
  Info,
  ChevronDown,
  ChevronRight,
  UserPlus,
  ExternalLink,
  Trash2,
  ShieldCheck,
  User,
  MoreVertical,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { AvatarCell, StatusBadge } from "../table-cells";
import { OwnerChip } from "../shared/OwnerChip";
import { USER_AVATAR_MAP } from "../../data/user-avatars";
import { users, type UserRow } from "../../data/users-data";
import { getOwnershipGrantedVia } from "../../data/uac-derived";
import type { RoleDetail } from "../../data/role-detail-data";
import {
  getRoleOwners,
  removeRoleOwner,
  subscribeRoleOwners,
} from "../../data/role-owners-data";
import { DestructiveConfirmModal } from "../shared/DestructiveConfirmModal";
import { AssignRoleOwnerModal } from "./AssignRoleOwnerModal";
import { AccessGate, useAccessMode, useRoleInScope, useScopedGate } from "../access-mode";
import { DataTable } from "../data-table/DataTable";
import {
  USERS_COLUMNS,
  usersSearchPredicate,
  buildUsersAdvancedFilter,
} from "../../data/users-table-config";
import type { RenderHelpers } from "../data-table/types";

interface Props {
  role: RoleDetail;
}

const COLLAPSE_KEY = "uac:role-owners-explainer-collapsed";

/* ─── "How This Works" glassy styling: mirrors ui/reading-room.tsx ─── */
const EXPLAINER_GRADIENT =
  "linear-gradient(178deg, #FBFCFF 0%, #F1F5FB 38%, #E7EDF6 100%)";

/* Glassy shell: the drawer's exact inset highlights + a soft blue lift
   (tuned down from the floating drawer's heavy drop for an inline card). */
const EXPLAINER_SHADOW = [
  "inset 0 1px 0 rgba(255, 255, 255, 0.95)",
  "inset 0 2px 6px -2px rgba(255, 255, 255, 0.85)",
  "inset 1px 0 0 rgba(255, 255, 255, 0.6)",
  "inset -1px 0 0 rgba(10, 119, 255, 0.04)",
  "inset 0 -1px 0 rgba(10, 119, 255, 0.06)",
  "0 1px 3px rgba(10, 119, 255, 0.10)",
  "0 8px 24px -12px rgba(10, 119, 255, 0.10)",
].join(", ");

/* Inner white "shade" section card: identical to the drawer's body cards. */
const EXPLAINER_CARD_STYLE: CSSProperties = {
  background: "rgba(255, 255, 255, 0.45)",
  border: "1px solid rgba(255, 255, 255, 0.45)",
  borderRadius: 12,
  padding: "16px 18px",
  boxShadow:
    "inset 0 1px 0 rgba(255, 255, 255, 0.75), 0 1px 2px rgba(15, 23, 42, 0.025), 0 2px 6px rgba(15, 23, 42, 0.025)",
};


/* Same trimmed column set used elsewhere on Role Detail */
const ALLOWED_KEYS = new Set([
  "full_name",
  "assigned_roles",
  "license",
  "email",
  "status",
]);

export function RoleOwnersTab({ role }: Props) {
  const navigate = useNavigate();
  /* Add and Remove Role Owner are the scoped ur-manage-roles grant. Out of
   * scope the owners list still renders in full; only those two affordances
   * change, and they follow the Denied actions setting. The tab itself is
   * already withheld from personas lacking the capability outright
   * (RoleDetailPage filters it out), so this handles the scope half only. */
  const access = useAccessMode();
  const inScope = useRoleInScope(role.id);
  const scoped = useScopedGate();
  const gOwnerWrite = scoped(true, access.canManageRoleOwners, inScope);

  /* ─── Subscribe to the owners store ─── */
  const owners = useSyncExternalStore(
    subscribeRoleOwners,
    () => getRoleOwners(role.id),
    () => getRoleOwners(role.id),
  );

  /* ─── Explainer collapsed state (per-user persistence) ─── */
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  });
  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  /* ─── Modals ─── */
  const [assignOpen, setAssignOpen] = useState(false);
  const [removeTargetId, setRemoveTargetId] = useState<number | null>(null);

  /* ─── Resolve owner records into full user rows ─── */
  const ownerUsers = useMemo<UserRow[]>(
    () =>
      owners
        .map((o) => users.find((u) => u.id === o.userId))
        .filter((u): u is UserRow => !!u),
    [owners],
  );

  const ownersAdvancedFilter = useMemo(() => buildUsersAdvancedFilter(ownerUsers), [ownerUsers]);

  /* ─── Granted Via chip config: mirrors User Detail → Role Ownership ─── */
  const GRANTED_VIA_MAP = useMemo(
    () => ({
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
    }),
    [],
  );

  /* ─── Slim columns w/ AvatarCell + Granted Via column appended ─── */
  const slimColumns = useMemo(
    () => {
      const base = USERS_COLUMNS.filter((c) => ALLOWED_KEYS.has(c.key)).map((col) => {
        if (col.key === "full_name") {
          return {
            ...col,
            render: (row: UserRow, helpers: RenderHelpers) => {
              const isComfort = helpers.density === "comfort";
              return (
                <AvatarCell
                  name={row.fullName}
                  nameNode={helpers.highlightText(row.fullName)}
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
        return col;
      });

      const grantedViaColumn = {
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
                  <div style={{ color: "#475569" }}>
                    How this user was made an owner of this role.
                  </div>
                  <div>
                    <span style={{ fontWeight: 600, color: "#0F172A" }}>Direct Assignment</span>
                    {": "}
                    <span style={{ color: "#475569" }}>
                      Ownership was granted from the permissions side, on this user's detail page or in the Permissions tab. The user does not need to hold this role to own it.
                    </span>
                  </div>
                  <div>
                    <span style={{ fontWeight: 600, color: "#0F172A" }}>Role Assignment</span>
                    {": "}
                    <span style={{ color: "#475569" }}>
                      Ownership was granted on this role's own page, in its Owners tab. A user made an owner this way also holds the role.
                    </span>
                  </div>
                </div>

              </TooltipContent>
            </Tooltip>
          </span>
        ),
        width: 180,
        render: (row: UserRow, helpers: RenderHelpers) => (
          <StatusBadge
            status={getOwnershipGrantedVia(role.id, row.id)}
            configMap={GRANTED_VIA_MAP as unknown as Record<string, { bg: string; text: string; dot: string; border?: string; label?: string }>}
            comfort={helpers.density === "comfort"}
          />
        ),
      } as (typeof base)[number];

      const idx = base.findIndex((c) => c.key === "assigned_roles");
      if (idx >= 0) {
        return [...base.slice(0, idx + 1), grantedViaColumn, ...base.slice(idx + 1)];
      }
      return [...base, grantedViaColumn];
    },
    [role.id, GRANTED_VIA_MAP],
  );

  const getRowId = useCallback((row: UserRow) => row.id, []);

  const handleOpenUser = useCallback(
    (userId: number) => {
      navigate(`/company-settings/user-access-control/user/${userId}`);
    },
    [navigate],
  );

  const renderActions = useCallback(
    (row: UserRow) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="w-7 h-7 rounded-md hover:bg-[#F1F5F9] flex items-center justify-center cursor-pointer transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-[#64748B]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={() => handleOpenUser(row.id)}
            className="cursor-pointer text-[13px]"
          >
            <ExternalLink className="w-3.5 h-3.5 mr-2 text-[#64748B]" />
            View profile
          </DropdownMenuItem>
          {gOwnerWrite.render && (
            <DropdownMenuItem
              disabled={gOwnerWrite.disabled}
              title={gOwnerWrite.reason || undefined}
              onClick={() => setRemoveTargetId(row.id)}
              className={`text-[13px] text-[#DC2626] focus:text-[#DC2626] focus:bg-[#FEF2F2] ${
                gOwnerWrite.disabled ? "cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Remove as Role Owner
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    [handleOpenUser, gOwnerWrite],
  );

  const handleConfirmRemove = useCallback(() => {
    if (removeTargetId == null) return;
    const u = users.find((user) => user.id === removeTargetId);
    removeRoleOwner(role.id, removeTargetId);
    toast.success(`${u?.fullName ?? "User"} removed as Role Owner.`);
    setRemoveTargetId(null);
  }, [removeTargetId, role.id]);

  const removeTargetName =
    users.find((u) => u.id === removeTargetId)?.fullName ?? "";

  const assignButton = useMemo(
    () =>
      gOwnerWrite.render ? (
        <AccessGate capability={!gOwnerWrite.disabled} reason={gOwnerWrite.reason}>
          <button
            type="button"
            onClick={() => setAssignOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-white border border-[#007FFF] text-[#007FFF] text-sm hover:bg-[#EDF4FF] transition-colors cursor-pointer shadow-sm"
            style={{ fontWeight: 500 }}
          >
            <UserPlus className="w-4 h-4" />
            Assign Role Owner
          </button>
        </AccessGate>
      ) : null,
    [gOwnerWrite],
  );

  /* ───────────────────────────────────────────── */
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-5">
      {/* ── Section 1: Explainer card (glassy blue, mirrors "How This Works" drawer) ── */}
      <div
        className="rounded-2xl border overflow-hidden shrink-0"
        style={{
          borderColor: "#CFDAEA",
          background: EXPLAINER_GRADIENT,
          boxShadow: EXPLAINER_SHADOW,
        }}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          className="w-full flex items-center gap-2.5 px-4 py-3 cursor-pointer hover:bg-white/40 transition-colors text-left"
        >
          <span
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            style={{
              backgroundColor: "#EDF4FF",
              border: "1px solid rgba(10, 119, 255, 0.12)",
            }}
          >
            <Crown className="w-3.5 h-3.5" style={{ fill: "#0A77FF", color: "#0A77FF" }} />
          </span>
          <span
            className="text-[13px] flex-1"
            style={{ color: "#0F172A", fontWeight: 600 }}
          >
            What Is a Role Owner?
          </span>
          {collapsed ? (
            <ChevronRight className="w-4 h-4" style={{ color: "#64748B" }} />
          ) : (
            <ChevronDown className="w-4 h-4" style={{ color: "#64748B" }} />
          )}
        </button>

        {!collapsed && (
          <div className="px-4 pb-4 pt-1 space-y-3">
            {/* Intro: plain subtext directly on the glassy shell */}
            <p
              style={{
                fontSize: 13.5,
                color: "rgb(51, 65, 85)",
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              A role owner maintains this role. They can add or remove users and
              approve access requests for it. They cannot change the permissions
              on the role, and they cannot assign the role to themselves. If they
              need this role, a system admin approves the request.
            </p>

            {/* "Who Makes a Good Role Owner": inner white shade container */}
            <div style={EXPLAINER_CARD_STYLE}>
              <div style={{ marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "rgb(100, 116, 139)",
                  }}
                >
                  Who Makes a Good Role Owner
                </span>
              </div>
              <div
                style={{
                  fontSize: 13.5,
                  color: "rgb(51, 65, 85)",
                  lineHeight: 1.65,
                }}
              >
                Sometimes it is someone who holds the role, like a senior
                customer support agent maintaining the Customer Support Agent
                role. Other times it is someone who does not hold the role at
                all, like an HR business partner or an operations lead who
                approves access requests for it. Pick whoever should be
                accountable for who gets this access, whether or not they do the
                job themselves.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 2: Owners list (same DataTable as Users tab) ── */}
      {ownerUsers.length === 0 ? (
        /* Empty state: mirrors the Carrier Profile empty state on the Partner
           Details page: a white card containing a floating gradient icon tile
           with a pulsating ping ring, title, description, two dot-legend hints,
           and a secondary CTA. */
        <div
          className="rounded-xl bg-white flex-1 min-h-0 flex items-center justify-center p-12"
          style={{
            border: "1px solid #E2E8F0",
            boxShadow:
              "0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div className="w-full max-w-md text-center">
            <div className="relative w-16 h-16 mx-auto mb-3">
              <div
                className="absolute inset-0 rounded-2xl animate-ping"
                style={{ backgroundColor: "rgba(0,127,255,0.06)", animationDuration: "3s" }}
              />
              <div
                className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-accent border border-border flex items-center justify-center shadow-sm"
                style={{ animation: "csFloat 4s ease-in-out infinite" }}
              >
                <Crown className="w-7 h-7 text-slate-400" />
              </div>
            </div>
            <h3 className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>
              No Role Owners Assigned
            </h3>
            <p className="text-[12px] text-slate-500 mt-1 max-w-[340px] mx-auto leading-relaxed">
              Role owners maintain this role: they manage user assignments and approve access requests. This role doesn&rsquo;t have any designated owners yet.
            </p>
            <div className="flex items-center justify-center gap-3 text-[10px] text-slate-400 mt-3">
              <span className="inline-flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Manages role assignments</span>
              <span className="inline-flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Approves access requests</span>
            </div>
            {gOwnerWrite.render && (
              <AccessGate capability={!gOwnerWrite.disabled} reason={gOwnerWrite.reason}>
                <button
                  type="button"
                  onClick={() => setAssignOpen(true)}
                  className="mt-5 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#007FFF] text-white text-xs hover:bg-[#0066D6] shadow-sm transition-colors cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  <UserPlus className="w-3.5 h-3.5" /> Assign Role Owner
                </button>
              </AccessGate>
            )}
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl bg-card overflow-clip flex flex-1 min-h-0 flex-col"
          style={{
            boxShadow:
              "0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)",
            border: "1px solid #E2E8F0",
          }}
        >
          <DataTable<UserRow>
            data={ownerUsers}
            columns={slimColumns}
            getRowId={getRowId}
            searchPlaceholder="Search by name, type, or email..."
            searchPredicate={usersSearchPredicate}
            defaultDensity="condensed"
            showMeMode
            persistKey={`role-detail:owners:${role.id}`}
            emptyIcon={<User className="w-8 h-8" />}
            emptyMessage="No role owners found"
            renderActions={renderActions}
            // Owners are removed one at a time from the row menu, so the tab
            // has no row selection or selected-count bar (ERP-5526).
            hideSelection
            hideBulkBar
            entityLabel="owners"
            onRowClick={(row) => handleOpenUser(row.id)}
            toolbarAction={assignButton}
            advancedFilter={ownersAdvancedFilter}
          />
        </div>
      )}

      {/* Assign modal */}
      <AssignRoleOwnerModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        roleId={role.id}
        roleName={role.roleName}
        assignedUserIds={role.assignedUserIds}
      />

      {/* Remove confirmation */}
      <DestructiveConfirmModal
        open={removeTargetId != null}
        onClose={() => setRemoveTargetId(null)}
        badge="Remove Owner"
        title={`Remove ${removeTargetName} as Role Owner?`}
        description={
          <>
            <span style={{ fontWeight: 600 }}>{removeTargetName}</span> will no
            longer be able to manage assignments or approve permission requests
            for this role. They&rsquo;ll remain assigned to this role as a
            regular user.
          </>
        }
        confirmLabel="Remove as Role Owner"
        onConfirm={handleConfirmRemove}
        tone="danger"
      />
    </div>
  );
}

/* ─── Owner chip w/ tooltip: shared visual identifier ─── */
export function RoleOwnerCrown(_props: { size?: number } = {}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center cursor-default shrink-0">
          <OwnerChip size="xs" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4} className="text-[11.5px]">
        Role Owner
      </TooltipContent>
    </Tooltip>
  );
}

/* Re-exported convenience: when used in User Detail → Roles, the tooltip
 * copy differs slightly. */
export function OwnedRoleCrown(_props: { size?: number } = {}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center cursor-default shrink-0">
          <OwnerChip size="xs" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4} className="text-[11.5px]">
        This user is a Role Owner for this role
      </TooltipContent>
    </Tooltip>
  );
}

/* Unused export silencer: kept for potential future use in headers */
export { ShieldCheck as _ShieldCheckIcon };
