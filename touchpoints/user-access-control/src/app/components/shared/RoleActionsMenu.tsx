import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Users,
  Ban,
  ToggleRight,
  CopyPlus,
  Archive,
  ArchiveRestore,
  Pencil,
} from "lucide-react";
import { UnarchiveRoleModal } from "../role-detail/UnarchiveRoleModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { DeactivateRoleModal } from "./DeactivateRoleModal";
import { EditRoleModal } from "../role-detail/EditRoleModal";
import { CreateRoleModal } from "../create-role/CreateRoleModal";
import type { CreateRoleFormData } from "../create-role/types";
import { getRoleDetail } from "../../data/role-detail-data";
import { useAccessMode, useGate } from "../access-mode";
import {
  getRoleIdByName,
  ROLE_PERMISSION_MAP,
} from "../../data/role-permissions-map";

/* ─── Shape of role data the menu needs ─── */
export interface RoleActionsRole {
  id: number;
  roleName: string;
  description: string;
  licenseRequired: string;
  status: string;
  isSystem?: boolean;
  usersCount: number;
}

interface RoleActionsMenuProps {
  role: RoleActionsRole;
  /** When true, render an inline "Action ▼" pill trigger (detail page).
   *  When false (default), render a 3-dot icon trigger (table). */
  variant?: "icon" | "pill";
  /** Optional custom trigger override */
  trigger?: ReactNode;
  /** For the detail page: navigate to the Users tab in-page */
  onAssignedUsersClick?: () => void;
  /** Override Edit Role action (e.g., parent owns the EditRoleModal) */
  onEditClick?: () => void;
  /** Called when status flips to Inactive (e.g. detail page local state) */
  onDeactivated?: () => void;
  /** Called when status changes (used by table/detail shared state) */
  onStatusChange?: (status: string) => void;
  /** Whether this menu is rendered inside a clickable row, stops propagation */
  stopRowPropagation?: boolean;
}

/* ─── Build initial data for duplication ─── */
function buildDuplicateData(
  role: RoleActionsRole
): Partial<CreateRoleFormData> {
  return {
    /* Deliberately blank. A "(Copy)" suffix reads as a finished name, so it
     * survives to production as clutter and collides on a second duplicate.
     * The creator names their own role, and Step 1 flags the empty field the
     * same way the template flow does. */
    roleName: "",
    description: role.description,
    licenseType: role.licenseRequired as CreateRoleFormData["licenseType"],
    status: "Draft",
  };
}

export function RoleActionsMenu({
  role,
  variant = "icon",
  trigger,
  onAssignedUsersClick,
  onEditClick,
  onDeactivated,
  onStatusChange,
  stopRowPropagation = false,
}: RoleActionsMenuProps) {
  const navigate = useNavigate();
  const access = useAccessMode();
  const gate = useGate();
  const [editOpen, setEditOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [unarchiveOpen, setUnarchiveOpen] = useState(false);

  const isActive = role.status === "Active";
  const isArchived = role.status === "Archived";
  const stop = (e: React.MouseEvent | React.SyntheticEvent) => {
    if (stopRowPropagation) e.stopPropagation();
  };

  const handleAssignedUsers = () => {
    if (onAssignedUsersClick) {
      onAssignedUsersClick();
    } else {
      navigate(
        `/company-settings/user-access-control/role/${role.id}?tab=users`
      );
    }
  };

  const defaultTrigger =
    variant === "pill" ? (
      <button
        type="button"
        className="rounded-[8px] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#334155] inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm h-9 px-3.5 text-[13px]"
        style={{ fontWeight: 500 }}
      >
        Action
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="#94A3B8"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    ) : (
      <button
        type="button"
        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
    );

  /* ─── Access gating ───
   *
   * `capability && statusAllows`, resolved up front so `hasAnyAction` can
   * collapse the trigger when the persona may do nothing to this role.
   *
   * `role.isSystem` is an ENTITY fact ("predefined roles can't be edited"),
   * not a viewer permission — the two are &&-ed, never conflated.
   *
   * SCOPE. Every item in this menu falls into one of the two groups that the
   * viewer's Manage Roles scope does NOT reach, so nothing here takes the
   * scope half:
   *
   *   Capability-gated, neither carries scope — Edit Role and Duplicate Role
   *   on ur-create-role; Deactivate, Reactivate, Archive, Unarchive on the
   *   role lifecycle pair (ur-deactivate-role, ur-archive-role), which the
   *   11 Aug catalogue split out of Create and edit roles. These stay
   *   available on a role outside the viewer's Manage Roles scope, because
   *   authoring a role is not the same grant as managing access to it.
   *
   *   Read-only, never gated — Assigned Users, which is a navigation to the
   *   role's Users tab, not the scoped "Assign Users" action.
   *
   * The scoped group (Assign Users, Manage Permissions, Add / Remove Role
   * Owner) is reached from the Role Detail tabs, which gate it there. Should a
   * scoped item ever be added to this menu, gate it with `useScopedGate()` and
   * add it to `hasAnyAction` below so the kebab still collapses correctly. */
  const gUnarchive = gate(isArchived, access.canManageRoleLifecycle);
  const gEdit = gate(!isArchived && !role.isSystem && variant !== "pill", access.canCreateEditRole);
  /* Assigned Users is a read navigation, so every level that can reach the
   * module keeps it — capability half is unconditionally true. */
  const gAssignedUsers = gate(!isArchived, true);
  const gDuplicate = gate(!isArchived, access.canCreateEditRole);
  /* A Draft role leaves Draft only when a permission is added, so it offers
   * no Reactivate or Archive (ERP-5520 AC3). */
  const isDraft = role.status === "Draft";
  const gLifecycle = gate(!isArchived && !isDraft && !role.isSystem, access.canManageRoleLifecycle);

  const hasAnyAction =
    gUnarchive.render || gEdit.render || gAssignedUsers.render ||
    gDuplicate.render || gLifecycle.render;

  /* Collapse the container itself rather than leaving an empty panel. */
  if (!hasAnyAction) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={stop}>
          {trigger ?? defaultTrigger}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[250px] whitespace-nowrap"
          onClick={stop}
        >
          {isArchived ? (
            gUnarchive.render && (
              <DropdownMenuItem
                disabled={gUnarchive.disabled}
                title={gUnarchive.reason || undefined}
                className={gUnarchive.disabled ? "gap-2 cursor-not-allowed" : "cursor-pointer gap-2"}
                onClick={() => setUnarchiveOpen(true)}
              >
                <ArchiveRestore className="w-3.5 h-3.5" style={{ color: "#007FFF" }} />
                <span style={{ color: "#007FFF" }}>Unarchive Role</span>
              </DropdownMenuItem>
            )
          ) : (
            <>
              {/* Edit Role, custom roles only. Hidden on the detail page
                  (pill variant), which has its own dedicated Edit button. */}
              {gEdit.render && (
                <DropdownMenuItem
                  disabled={gEdit.disabled}
                  title={gEdit.reason || undefined}
                  className={gEdit.disabled ? "gap-2 cursor-not-allowed" : "cursor-pointer gap-2"}
                  onClick={() => (onEditClick ? onEditClick() : setEditOpen(true))}
                >
                  <Pencil className="w-3.5 h-3.5 text-[#64748B]" />
                  Edit Role
                </DropdownMenuItem>
              )}

              {/* Assigned Users */}
              {gAssignedUsers.render && (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onClick={handleAssignedUsers}
                >
                  <Users className="w-3.5 h-3.5 text-[#64748B]" />
                  Assigned Users
                </DropdownMenuItem>
              )}

              {/* Copy / Duplicate, available for every role, including
                  predefined roles (their only path to an editable role). */}
              {gDuplicate.render && (
                <DropdownMenuItem
                  disabled={gDuplicate.disabled}
                  title={gDuplicate.reason || undefined}
                  className={gDuplicate.disabled ? "gap-2 cursor-not-allowed" : "cursor-pointer gap-2"}
                  onClick={() => setDuplicateOpen(true)}
                >
                  <CopyPlus className="w-3.5 h-3.5 text-[#64748B]" />
                  {role.isSystem ? "Copy to Create Custom Role" : "Duplicate Role"}
                </DropdownMenuItem>
              )}

              {gLifecycle.render && (
                <>
                  {(gEdit.render || gAssignedUsers.render || gDuplicate.render) && <DropdownMenuSeparator />}

                  {/* Deactivate (amber) / Reactivate (blue), matching the
                      Users actions menu exactly. */}
                  {isActive ? (
                    <DropdownMenuItem
                      disabled={gLifecycle.disabled}
                      title={gLifecycle.reason || undefined}
                      className={`gap-2 text-[#D97706] focus:text-[#D97706] ${gLifecycle.disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                      onClick={() => setDeactivateOpen(true)}
                    >
                      <Ban className="w-3.5 h-3.5" style={{ color: "#D97706" }} />
                      Deactivate Role
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      disabled={gLifecycle.disabled}
                      title={gLifecycle.reason || undefined}
                      className={gLifecycle.disabled ? "gap-2 cursor-not-allowed" : "cursor-pointer gap-2"}
                      onClick={() => {
                        onStatusChange?.("Active");
                        toast.success(`${role.roleName} was reactivated.`);
                      }}
                    >
                      <ToggleRight className="w-3.5 h-3.5" style={{ color: "#007FFF" }} />
                      <span style={{ color: "#007FFF" }}>Reactivate Role</span>
                    </DropdownMenuItem>
                  )}

                  {/* Archive Role, red */}
                  <DropdownMenuItem
                    disabled={gLifecycle.disabled}
                    title={gLifecycle.reason || undefined}
                    className={`gap-2 text-[#DC2626] focus:text-[#DC2626] ${gLifecycle.disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                    onClick={() => setArchiveOpen(true)}
                  >
                    <Archive className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
                    Archive Role
                  </DropdownMenuItem>
                </>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ─── Modals ─── */}
      {!role.isSystem && !onEditClick && (
        <EditRoleModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          roleId={role.id}
          onDeactivate={() => setDeactivateOpen(true)}
        />
      )}
      <DeactivateRoleModal
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        roleName={role.roleName}
        usersCount={role.usersCount}
        assignedUserIds={getRoleDetail(role.id)?.assignedUserIds ?? []}
        onConfirm={() => {
          onStatusChange?.("Inactive");
          onDeactivated?.();
        }}
      />
      <CreateRoleModal
        open={duplicateOpen}
        onClose={() => setDuplicateOpen(false)}
        sourceRoleName={role.roleName}
        initialData={buildDuplicateData(role)}
        initialPermissions={(() => {
          const roleKey = getRoleIdByName(role.roleName);
          return roleKey ? ROLE_PERMISSION_MAP[roleKey] || [] : [];
        })()}
      />
      <DeactivateRoleModal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        roleName={role.roleName}
        usersCount={role.usersCount}
        assignedUserIds={getRoleDetail(role.id)?.assignedUserIds ?? []}
        onConfirm={() => onStatusChange?.("Archived")}
        variant="archive"
      />
      <UnarchiveRoleModal
        open={unarchiveOpen}
        onClose={() => setUnarchiveOpen(false)}
        roleId={role.id}
        onStatusChange={(s) => onStatusChange?.(s)}
      />
    </>
  );
}
