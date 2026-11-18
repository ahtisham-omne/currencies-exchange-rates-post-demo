import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { ModalShell } from "../shared/ModalShell";
import { OwnerChip } from "../shared/OwnerChip";
import { DestructiveConfirmModal } from "../shared/DestructiveConfirmModal";
import {
  X,
  ExternalLink,
  BookOpen,
  Shield,
  Users,
  ChevronDown,
  Search,
  Check,
  Plus,
  Maximize2,
  Minimize2,
  Eye,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  Info,
  Gauge,
  Pencil,
  Link,
  User,
  Lock,
  Crown,
} from "lucide-react";
import { cn } from "../ui/utils";
import { Checkbox } from "../ui/checkbox";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
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
} from "../ui/dropdown-menu";
import {
  type PermissionModule,
  type Permission,
  type ThresholdConfig,
  PERMISSION_MODULES,
} from "../../data/permissions-data";
import { AddRolesModal } from "../user-detail/AddRolesModal";
import { RecommendedPermissionsCard } from "./RecommendedPermissionsCard";
import { LinkedPermissionsCard } from "./LinkedPermissionsCard";
import {
  getLinkedGroup,
  getLinkedPermissionRefs,
  type LinkedPermissionRef,
} from "../../data/linked-permissions";
import {
  SHOW_RECOMMENDED_PERMISSIONS_BANNER,
  SHOW_PERMISSION_THRESHOLDS,
  SHOW_VIEW_IN_MODULE_CONTENT,
} from "../../lib/feature-flags";
import { ViewInModuleModal } from "./ViewInModuleModal";
import { VIEW_IN_MODULE_DATA } from "../../data/view-in-module-data";
import { prefetchImages } from "../../lib/image-prefetch";
import { DataTable } from "../data-table/DataTable";
import { highlightMatch } from "../../lib/highlight-text";
import { users } from "../../data/users-data";
import type { UserRow } from "../../data/users-data";
import { roles, sortRolesCustomFirst, roleGroupFn, ROLE_GROUP_LABELS } from "../../data/roles-data";
import type { RoleRow } from "../../data/roles-data";
import {
  USERS_COLUMNS,
  USERS_QUICK_FILTERS,
  usersSearchPredicate,
  usersFilterPredicate,
} from "../../data/users-table-config";
import {
  ROLES_COLUMNS,
  ROLES_QUICK_FILTERS,
  rolesSearchPredicate,
  rolesFilterPredicate,
} from "../../data/roles-table-config";
import type { ColumnDef, QuickFilterDef } from "../data-table/types";
import { AvatarCell, StatusBadge, LicenseBadge } from "../table-cells";
import { RoleUsersPopover } from "../shared/RoleUsersPopover";
import { applyRoleLicenseTier } from "../../data/role-detail-data";
import { getUsersForRole, getUniqueUserCountForRoles } from "../../data/uac-derived";
import {
  getRolesWithPermission,
  getUsersWithPermission,
  getPermissionSourceForUser,
} from "../../data/permission-holders";
import { UpgradeLicenseModal, UpgradeRoleLicenseModal } from "../shared/LicenseModals";
import { updateUserRowState } from "../../data/users-row-store";
import { SystemRoleLock } from "../shared/SystemRoleBadge";
import { getAvatarTint, getInitials } from "../../lib/avatar";
import { toast } from "sonner";
import { OverflowTooltip } from "../shared/OverflowTooltip";
import { USER_AVATAR_MAP } from "../../data/user-avatars";
import { ConfigureManageRolesModal } from "./ConfigureManageRolesModal";
import { AddManageRolesRolesModal } from "./AddManageRolesRolesModal";
import { AddManageRolesUsersModal } from "./AddManageRolesUsersModal";
import {
  getManageRolesConfig,
  getOwnedRoleIds,
  removeManagedRoleForUser,
  subscribeManageRolesScope,
} from "../../data/manage-roles-scope-data";
import { useSyncExternalStore } from "react";
import { getUserDetail } from "../../data/user-detail-data";
import { LicenseRequirementChip } from "../shared/LicenseRequirementChip";
import { LinkedRoleName } from "../shared/LinkedRoleName";
import { permissionRequiresFullAccess } from "../../lib/permission-tier";
import {
  ReadingRoomProvider,
  ReadingRoomButton,
  type ReadingRoomConfig,
} from "../ui/reading-room";
void permissionRequiresFullAccess;


// ─── Reading Room content (Manage Roles "How This Works") ─────────────────

const MANAGE_ROLES_READING_ROOM: ReadingRoomConfig = {
  title: "Understanding Role Management and Role Ownership",
  sections: [
    {
      title: "Manage Access vs Role Ownership",
      body: (
        <>
          <p style={{ margin: 0 }}>
            The Manage Roles permission allows a user to control who is assigned to specific roles. Depending on how you configure it, you can grant two levels of authority: manage access and role ownership. These serve different purposes and are designed for different situations.
          </p>
          <p style={{ margin: "10px 0 0 0" }}>
            Manage access lets a user add and remove other users from the selected roles. Tasks and workflows associated with those roles do not route to the managing user. The managing user only decides who belongs to the role.
          </p>
          <p style={{ margin: "10px 0 0 0" }}>
            Role ownership includes everything that manage access provides, plus the authority to approve or deny permission requests for the role. Like manage access, role ownership does not cause tasks to route to the owner. The owner controls who does the work and approves access requests, but the system does not treat the owner as a member of the role unless they are also explicitly assigned to it.
          </p>
        </>
      ),
    },
    {
      title: "Role Owner vs Role Member",
      body: (
        <>
          <p style={{ margin: 0 }}>
            When a user is assigned to a role, two things happen: they receive the permissions bundled in that role, and workflows associated with those permissions route to them. The role defines both what they can do and what the system sends their way.
          </p>
          <p style={{ margin: "10px 0 0 0" }}>
            A role owner, by contrast, does not receive the role's permissions and does not have tasks routed to them through that role. Their authority is administrative. They decide who belongs to the role and whether incoming access requests for that role should be approved or denied.
          </p>
          <p style={{ margin: "10px 0 0 0" }}>
            A user can be both an owner and a member of the same role. In that case, they have full administrative control and also receive routed tasks. But the two are independent, and assigning ownership does not automatically grant membership.
          </p>
        </>
      ),
    },
    {
      title: "Example: Cycle Counting",
      body: (
        <>
          <p style={{ margin: 0 }}>
            The Cycle Count module has three levels of authority. There is someone who sets up a count plan, someone who executes the count by recording physical quantities, and if there is a discrepancy, a separate permission for approving the inventory adjustment because that is a balance sheet transaction. These are distinct permissions assigned through roles, and the person who does one is not necessarily the person who does the others.
          </p>
          <p style={{ margin: "10px 0 0 0" }}>
            A warehouse operations manager needs to control which associates are assigned to the counting team and approve access requests when someone new joins. But she does not do the counting herself and should not receive count tasks in her queue. In this case, she is configured as a role owner for the cycle counting role. She manages who belongs to the role and approves requests, but because she is not a member of the role, the system does not route execution tasks to her. If she also needs visibility into count records, she would hold a separate role that grants module access without execution routing.
          </p>
        </>
      ),
    },
  ],
};


// ─── Toggle Switch (green on / gray off) ───────────────────────────────────

function ModalSwitch({
  checked,
  onCheckedChange,
  disabled,
  className,
  showLockIcon,
}: {
  checked: boolean;
  onCheckedChange: (val: boolean) => void;
  disabled?: boolean;
  className?: string;
  /** Show a small lock icon centered in the thumb to indicate inherited permission */
  showLockIcon?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-[2px] transition-colors duration-200 outline-none cursor-pointer",
        checked ? "bg-green-500" : "bg-gray-200",
        // Locked (inherited) toggles keep the green fill at full opacity.
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none flex items-center justify-center h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-100 will-change-transform",
          checked ? "translate-x-[16px]" : "translate-x-0"
        )}
      >
        {showLockIcon && (
          <Lock className="w-[9px] h-[9px] text-gray-400" strokeWidth={2.5} />
        )}
      </span>
    </button>
  );
}

// ─── Platform surface (label only) ─────────────────────────────────────────
// A permission surfaces on web, on mobile, or on both. Web and the mobile apps
// run on the same API, so the consolidated modules (Cycle Count, Physical
// Inventory, Inventory Movement, and the shared Receiving permissions) tag their
// permissions platform: "both", one permission, one card, spanning both
// surfaces with no separate mobile toggle. A "web"-only (or untagged) permission
// has no mobile effect. This drives the header chip label, never a control.
function permissionSurfaces(permission: Permission): { web: boolean; mobile: boolean } {
  if (permission.platform === "both") return { web: true, mobile: true };
  if (permission.platform === "mobile") return { web: false, mobile: true };
  return { web: true, mobile: false };
}

/** Platform chip shown in the selected-permission header, a text-only label in
 *  the same slate chip treatment as the "Requires Field User" license chip.
 *  Label only, never a control. */
function PlatformChip({ web, mobile }: { web: boolean; mobile: boolean }) {
  const label =
    web && mobile ? "Web & Mobile Permission" : mobile ? "Mobile Permission" : "Web Permission";
  return (
    <span
      className="inline-flex items-center gap-1 rounded border whitespace-nowrap px-2 py-0.5 text-xs"
      style={{ fontWeight: 500, backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#CBD5E1" }}
    >
      {label}
    </span>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────

export type PermissionModalContext = "permissions-tab" | "create-flow" | "user-detail" | "role-detail";
export type PermissionModalMode = "readonly" | "editable";

interface PermissionDetailModalProps {
  module: PermissionModule;
  onClose: () => void;
  context?: PermissionModalContext;
  mode?: PermissionModalMode;
  userId?: number;
  initialToggles?: Record<string, boolean>;
  onSave?: (toggles: Record<string, boolean>) => void;
  /** Set of permission IDs inherited from assigned roles */
  inheritedPermissions?: Set<string>;
  /** Map of permission ID → role names that grant it */
  inheritedSources?: Record<string, string[]>;
  /** Hide Direct/Inherited source chips and Granted Via section.
   *  Used in role-scoped contexts (Create Role, Role Detail) where
   *  the direct/inherited concept doesn't apply, every permission
   *  is simply "on the role". */
  hideSourceChips?: boolean;
  /** When provided, opens the modal with this permission pre-selected in the right panel. */
  initialActivePermissionId?: string;
  /** Resolves on/off state for permissions in other modules, so the
   *  recommendations card can hide chips for ones already on. */
  isPermissionEnabled?: (permissionId: string) => boolean;
  /** Open another module's modal on a specific permission. Used by the
   *  recommendations card for cross-module chips. Omit to render those chips as
   *  plain labels. */
  onNavigateToModulePermission?: (moduleId: string, permissionId: string) => void;
  /** Commit linked-permission changes that land OUTSIDE this module (see
   *  data/linked-permissions.ts). Called on Save with permission id → value for
   *  every staged cross-module cascade; the owner merges them into the right
   *  modules' toggle maps. Without it, cross-module cascades are dropped on
   *  save, so every editable surface should provide one. */
  onApplyLinkedToggles?: (updates: Record<string, boolean>) => void;
}

/** Subtle crossfade wrapper, fades in new content when `key` changes */
function CrossFadeWrapper({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Start invisible, then fade in on next frame
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 180ms ease-in-out",
      }}
    >
      {children}
    </div>
  );
}

/* ─── Inherited-sources tooltip ──────────────────────────────────────────
   Hangs off the "Inherited" chip. It used to be one line of prose that
   truncated to "…and N more", which hid exactly the roles an admin needs to
   see: the ones they would have to open to change anything. Every granting
   role is listed now, each in its own card, with the list scrolling rather
   than truncating if a user holds a lot of roles.

   Panel shape (header + divider + card list) follows the storage-pool popover
   pattern. The header icon is deliberately slate, not blue, so the one blue
   thing in the panel is the role cards themselves. */
function InheritedSourcesTooltip({ sources }: { sources: string[] }) {
  const count = sources.length;
  /* Sized to the subtext: 14 padding + 32 icon + 10 gap + 224 text + 14
     padding. It is the longest line in the panel, so this is the narrowest
     the tooltip can be without wrapping it. Role names truncate to fit. */
  return (
    <div className="w-[296px]">
      <div className="flex items-start gap-2.5 px-3.5 py-3">
        <div
          className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0"
          style={{ backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0" }}
        >
          <Shield className="w-4 h-4" style={{ color: "#475569" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A", lineHeight: "1.3" }}>
            Inherited From {count} {count === 1 ? "Role" : "Roles"}
          </p>
          {/* Says the thing that is not obvious: one role is enough to keep it
              on, which is why it cannot be switched off from the user. */}
          <p className="mt-0.5 whitespace-nowrap" style={{ fontSize: "11.5px", fontWeight: 400, color: "#64748B", lineHeight: "1.45" }}>
            {count === 1
              ? "Stays on while this role grants it."
              : "Stays on while any one of these grants it."}
          </p>
        </div>
      </div>
      <div className="border-t" style={{ borderColor: "#F1F5F9" }} />
      <div className="px-3.5 py-3 space-y-1.5 max-h-[230px] overflow-y-auto">
        {sources.map((roleName) => {
          const role = roles.find((r) => r.roleName === roleName);
          const label = (
            <span
              className="truncate flex-1 min-w-0"
              style={{ fontSize: "12px", fontWeight: 500, color: "#007FFF", lineHeight: "1.4" }}
            >
              {roleName}
            </span>
          );
          /* A role with no record behind it has nowhere to open, so it renders
             as a plain card rather than a link that goes nowhere. */
          if (!role) {
            return (
              <div
                key={roleName}
                className="flex items-center px-2.5 py-1.5 rounded-[8px] border border-[#DBEAFE] bg-[#EFF6FF]"
              >
                {label}
              </div>
            );
          }
          return (
            <a
              key={roleName}
              href={`/company-settings/user-access-control/role/${role.id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Open ${roleName} in a new tab`}
              className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-[#DBEAFE] bg-[#EFF6FF] hover:bg-[#DEEBFF] hover:border-[#BFDBFE] transition-colors cursor-pointer"
            >
              {label}
              {/* Slides in from the left edge of its own box on hover. */}
              <ChevronRight
                className="w-3.5 h-3.5 shrink-0 opacity-0 -translate-x-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0"
                style={{ color: "#007FFF" }}
              />
            </a>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Shared bits for the role-granted redirect flow ────────────────────── */

/** Granted Via row: role name + "View Role" external link. Reused by the
 *  redirect modal so the admin can open any granting role. */
function GrantedViaRoleRow({ roleName }: { roleName: string }) {
  const role = roles.find((r) => r.roleName === roleName);
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC]">
      <div className="flex items-center gap-2 min-w-0">
        <Shield className="w-3.5 h-3.5 shrink-0" style={{ color: "#64748B" }} />
        <span className="truncate" style={{ fontSize: "13px", fontWeight: 550, color: "#0F172A" }}>{roleName}</span>
      </div>
      {role && (
        <a
          href={`/company-settings/user-access-control/role/${role.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[#007FFF] hover:underline shrink-0"
          style={{ fontSize: "12px", fontWeight: 500 }}
          onClick={(e) => e.stopPropagation()}
        >
          View Role <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

/** Primary (non-destructive) confirm button. */
function PrimaryConfirmButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-9 px-4 rounded-[8px] text-[13px] text-white cursor-pointer transition-colors shadow-sm"
      style={{ backgroundColor: "#007FFF", fontWeight: 600 }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#0066D6")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#007FFF")}
    >
      {label}
    </button>
  );
}

function GhostCancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] text-[#334155] cursor-pointer hover:bg-[#F8FAFC] transition-colors"
      style={{ fontWeight: 500 }}
    >
      Cancel
    </button>
  );
}

/* ── Collapsible section, mirrors the export modal's "File format" subsection
 *  (white card, slate-50 header with icon + title, divider, content). */
function RedirectAccordion({
  icon: Icon,
  iconColor,
  title,
  titleColor = "#0F172A",
  borderColor = "#E2E8F0",
  headerTint = "#F8FAFC",
  badge,
  defaultOpen = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconColor: string;
  title: string;
  /** Header title color, defaults to slate; the colored sections match the icon. */
  titleColor?: string;
  /** Card + divider border color, defaults to neutral; colored sections match the icon. */
  borderColor?: string;
  /** Header wash while the section is open, the palest step of the card's own
   *  shade (indigo/amber/slate). Closed headers stay white so the open one
   *  reads as the section you are in. Defaults to slate. */
  headerTint?: string;
  /** Optional count chip shown next to the title (e.g. "2 roles"). */
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [hover, setHover] = useState(false);
  /* Resolved inline because an inline background beats Tailwind's hover:
   * variant, which is why the old `hover:bg-[#F8FAFC]` class never fired. */
  const headerBg = open ? headerTint : hover ? "#F8FAFC" : "#FFFFFF";
  return (
    <div
      className="rounded-[12px] border bg-white overflow-hidden"
      style={{ borderColor, boxShadow: "0 1px 2px 0 rgba(15,23,42,0.05)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-expanded={open}
        className="w-full px-4 py-3 flex items-center gap-2.5 cursor-pointer transition-colors"
        style={{ backgroundColor: headerBg }}
      >
        <Icon className="w-4 h-4 shrink-0" style={{ color: iconColor }} />
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <h3 className="text-[14px] text-left" style={{ color: titleColor, fontWeight: 600 }}>
            {title}
          </h3>
          {badge && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] border shrink-0"
              style={{ fontWeight: 500, backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#CBD5E1" }}
            >
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className="w-4 h-4 shrink-0 transition-transform duration-200"
          style={{ color: "#94A3B8", transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>
      {open && (
        <>
          <div className="border-t" style={{ borderColor }} />
          <div className="px-4 py-3.5">{children}</div>
        </>
      )}
    </div>
  );
}

/* ─── Role-granted redirect modal: both user-scoped entry points ────────────
   Opens whenever an admin attempts to turn off a permission inherited from a
   role. Inherited permissions can no longer be turned off for a single user, so
   this modal explains why and points to the role as the place to make the
   change. Standard modal pattern: white header, slate-50 content with the blue,
   amber, and Granted Via accordions, white footer with a single "Got it" button.
   It is purely informational, confirming changes nothing. */
function RoleGrantedRedirectModal({
  open,
  user,
  permission,
  sources,
  onClose,
}: {
  open: boolean;
  user: string;
  permission: string;
  sources: string[];
  onClose: () => void;
}) {
  if (!open) return null;
  const multiRole = sources.length > 1;
  const permEmphasis = <span style={{ fontWeight: 600, color: "#334155" }}>{permission}</span>;
  const roleName = sources[0] ?? "assigned";

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-auto">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* 936px = 780 + 20%. */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-[936px] w-full mx-6 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header (white) */}
        <div className="px-6 py-5 shrink-0 bg-white">
          <div className="flex items-start gap-3.5">
            {/* Slate, not blue: the coloured accents in this modal belong to
                the accordions, and a blue header icon competed with them. */}
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0" }}
            >
              <Info className="w-5 h-5" style={{ color: "#475569" }} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-foreground" style={{ fontSize: "17px", fontWeight: 650 }}>
                This Permission Is Granted by a Role
              </h3>
              <p className="text-muted-foreground mt-1" style={{ fontSize: "13.5px", fontWeight: 400, lineHeight: "1.55" }}>
                {multiRole ? (
                  <>
                    {user} gets {permEmphasis} from several roles, all listed under Granted Via
                    below. An exception is not available, so the permission cannot be turned off
                    for {user} from here. It is granted by those roles, and that is where the
                    change is made.
                  </>
                ) : (
                  <>
                    {user} gets {permEmphasis} from the {roleName} role. An exception is not
                    available, so the permission cannot be turned off for {user} from here. It is
                    granted by the role, and that is where the change is made.
                  </>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 -mr-1.5 -mt-1 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content (slate-50), collapsible sections */}
        <div
          className="flex-1 overflow-y-auto px-6 py-5 space-y-3"
          style={{ backgroundColor: "#F8FAFC", borderTop: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9" }}
        >
          <RedirectAccordion icon={BookOpen} iconColor="#4339CA" titleColor="#4339CA" borderColor="#C6D2FF" headerTint="#F5F6FF" title="Consider Editing the Role Instead" defaultOpen>
            <p style={{ fontSize: "12.5px", color: "#475569", lineHeight: "1.6" }}>
              If {permission} does not belong with the job itself, turn it off in the role and every member of the role loses it together. If it is only {user} who should not have it, leave the role as it is, duplicate it, turn the permission off in the copy, and assign that copy to {user}. Every role that currently grants {permission} is listed under Granted Via, so you can open any of them from there.
            </p>
          </RedirectAccordion>

          <RedirectAccordion icon={Shield} iconColor="#B45309" titleColor="#B45309" borderColor="#F5D78E" headerTint="#FFFCF2" title="Why You Cannot Turn It Off Here" defaultOpen>
            <ul className="space-y-2">
              {[
                `${permission} reaches ${user} through a role, not through a direct assignment to ${user}, so it can only be changed on the role.`,
                `Turning it off for one user is deliberately not supported, because a role is meant to grant the same access to every member.`,
                `To change what ${user} can do, edit the role or duplicate it, as described above.`,
                `A direct assignment, if ${user} has one, is the only thing that can be removed from here, in Granted Via.`,
              ].map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-2.5"
                  style={{ fontSize: "12.5px", color: "#475569", lineHeight: "1.55" }}
                >
                  <span className="mt-[6px] w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#D97706" }} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </RedirectAccordion>

          <RedirectAccordion
            icon={Link}
            iconColor="#64748B"
            title="Granted Via"
            badge={`${sources.length} role${sources.length !== 1 ? "s" : ""}`}
          >
            <div className="space-y-1.5">
              {sources.map((r) => (
                <GrantedViaRoleRow key={r} roleName={r} />
              ))}
            </div>
          </RedirectAccordion>
        </div>

        {/* Footer (white), single "Got it" button; closes and changes nothing. */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 shrink-0 bg-white">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-[8px] text-[13px] cursor-pointer transition-colors"
            style={{ color: "#007FFF", border: "1px solid #007FFF", fontWeight: 600, backgroundColor: "white" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F0F7FF")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "white")}
          >
            Got It
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function PermissionDetailModal({
  module,
  onClose,
  context = "permissions-tab",
  mode = "readonly",
  userId,
  initialToggles,
  onSave,
  inheritedPermissions,
  inheritedSources,
  hideSourceChips,
  initialActivePermissionId,
  isPermissionEnabled,
  onNavigateToModulePermission,
  onApplyLinkedToggles,
}: PermissionDetailModalProps) {
  const [activePermId, setActivePermId] = useState(
    initialActivePermissionId &&
      module.permissions.some((p) => p.id === initialActivePermissionId)
      ? initialActivePermissionId
      : module.permissions[0]?.id ?? ""
  );
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    if (initialToggles) return { ...initialToggles };
    const init: Record<string, boolean> = {};
    module.permissions.forEach((p) => {
      init[p.id] = p.defaultEnabled;
    });
    return init;
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Redirect modal state, opened when an admin clicks the toggle on a
  // role-inherited permission. Inherited permissions cannot be turned off for a
  // single user; the modal explains where to make the change and changes nothing.
  const [inheritedInfo, setInheritedInfo] = useState<{
    permId: string;
    permName: string;
    sources: string[];
  } | null>(null);

  // Display name of the user being edited, woven into the redirect modal copy.
  const userName = useMemo(
    () => (userId != null ? getUserDetail(userId)?.fullName : undefined) ?? "this user",
    [userId]
  );

  // Search, filter, bulk select state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Enabled" | "Disabled">("All");
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [checkedPermissions, setCheckedPermissions] = useState<string[]>([]);
  const [isListScrolled, setIsListScrolled] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  /** Left-list rows by permission id, so a recommendation chip can scroll to one. */
  const permItemRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Enable All warning modal state
  const [showEnableAllWarning, setShowEnableAllWarning] = useState(false);

  // Filtered permissions. Every permission in the module is listed together;
  // there is no surface switching, each permission carries a label-only
  // platform icon driven by its own module surface.
  const filteredPermissions = useMemo(() => {
    return module.permissions.filter((perm) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!perm.name.toLowerCase().includes(q)) return false;
      }
      if (statusFilter === "Enabled" && !(toggles[perm.id] ?? false)) return false;
      if (statusFilter === "Disabled" && (toggles[perm.id] ?? false)) return false;
      return true;
    });
  }, [module.permissions, searchQuery, statusFilter, toggles]);

  const isReadonly = mode === "readonly";
  const isBulkMode = !isReadonly && checkedPermissions.length >= 1;

  const activePerm = module.permissions.find((p) => p.id === activePermId);

  /* Select a permission in this module and bring it into view in the left list.
   * Used by the recommendations card, which navigates only, it never toggles.
   * Filters are cleared only when they would hide the target, otherwise the
   * admin's search stays as they left it. */
  const navigateToPermission = useCallback(
    (permId: string) => {
      if (!module.permissions.some((p) => p.id === permId)) return;
      const hiddenByFilters = !filteredPermissions.some((p) => p.id === permId);
      if (hiddenByFilters) {
        setSearchQuery("");
        setStatusFilter("All");
      }
      setActivePermId(permId);
      // Two frames: one for the selection, one more for a filter reset to have
      // put the row back in the DOM before scrolling to it.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          permItemRefs.current
            .get(permId)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      });
    },
    [module.permissions, filteredPermissions]
  );


  /* ─── Linked permissions (data/linked-permissions.ts) ────────────────────
     Most permissions are standalone: toggling one never enables or disables
     another. The exception is a linked group, several permissions across
     modules that edit the same backend entity, which the UI keeps in lockstep.
     Toggling a linked permission first opens a confirmation modal; confirming
     flips the whole group. Members of the open module flip in local toggle
     state, members of other modules are staged in `pendingLinkedUpdates` and
     committed on Save through `onApplyLinkedToggles` (Cancel drops them along
     with everything else). */
  const [pendingLinkedUpdates, setPendingLinkedUpdates] = useState<Record<string, boolean>>({});
  const [linkConfirm, setLinkConfirm] = useState<{
    permId: string;
    permName: string;
    val: boolean;
    entity: string;
    linked: LinkedPermissionRef[];
  } | null>(null);

  /** Flip one permission plus every member of its linked group. */
  const applyLinkedToggle = useCallback(
    (id: string, val: boolean) => {
      const linked = getLinkedPermissionRefs(id);
      setToggles((prev) => {
        const next = { ...prev, [id]: val };
        linked.forEach((ref) => {
          if (ref.moduleId === module.id) next[ref.permissionId] = val;
        });
        return next;
      });
      const cross: Record<string, boolean> = {};
      linked.forEach((ref) => {
        if (ref.moduleId !== module.id) cross[ref.permissionId] = val;
      });
      if (Object.keys(cross).length > 0) {
        setPendingLinkedUpdates((prev) => ({ ...prev, ...cross }));
      }
      setHasChanges(true);
    },
    [module.id]
  );

  const handleToggle = useCallback(
    (id: string, val: boolean) => {
      const linked = getLinkedPermissionRefs(id);
      if (linked.length > 0) {
        const perm = module.permissions.find((p) => p.id === id);
        setLinkConfirm({
          permId: id,
          permName: perm?.name ?? id,
          val,
          entity: getLinkedGroup(id)?.entity ?? "record",
          linked,
        });
        return;
      }
      if (val) {
        // Auto-focus this permission in the right panel when toggled ON
        setActivePermId(id);
      }
      setToggles((prev) => ({ ...prev, [id]: val }));
      setHasChanges(true);
    },
    [module.permissions]
  );

  const handleConfirmLinkedToggle = useCallback(() => {
    if (!linkConfirm) return;
    if (linkConfirm.val) setActivePermId(linkConfirm.permId);
    applyLinkedToggle(linkConfirm.permId, linkConfirm.val);
    toast.success(
      `${linkConfirm.permName} and ${linkConfirm.linked.length} linked permission${
        linkConfirm.linked.length === 1 ? "" : "s"
      } turned ${linkConfirm.val ? "on" : "off"}.`
    );
    setLinkConfirm(null);
  }, [linkConfirm, applyLinkedToggle]);

  const handleSave = useCallback(() => {
    setHasChanges(false);
    setCheckedPermissions([]);
    toast.success(`${module.name} permissions saved.`);
    if (onSave) {
      onSave(toggles);
    }
    // Commit staged cross-module linked cascades alongside this module's save.
    if (Object.keys(pendingLinkedUpdates).length > 0) {
      onApplyLinkedToggles?.(pendingLinkedUpdates);
    }
    onClose();
  }, [module.name, onClose, onSave, toggles, pendingLinkedUpdates, onApplyLinkedToggles]);

  /** Cross-module linked cascade for a batch of same-value changes. Batch
   *  actions (bulk edit, Enable All, Disable All) skip the per-toggle
   *  confirmation modal and cascade silently, keeping every group in lockstep. */
  const stageLinkedCascade = useCallback(
    (ids: string[], val: boolean) => {
      const cross: Record<string, boolean> = {};
      ids.forEach((id) => {
        getLinkedPermissionRefs(id).forEach((ref) => {
          if (ref.moduleId !== module.id) cross[ref.permissionId] = val;
        });
      });
      if (Object.keys(cross).length > 0) {
        setPendingLinkedUpdates((prev) => ({ ...prev, ...cross }));
      }
    },
    [module.id]
  );

  // Bulk enable/disable. Role-inherited permissions cannot be turned off for a
  // single user, so disabling only flips the direct-assignment layer; an
  // inherited permission stays on regardless.
  const handleBulkEnable = useCallback((enable: boolean) => {
    setToggles((prev) => {
      const next = { ...prev };
      checkedPermissions.forEach((id) => {
        next[id] = enable;
        // Same-module halves of any linked group move with the batch.
        getLinkedPermissionRefs(id).forEach((ref) => {
          if (ref.moduleId === module.id) next[ref.permissionId] = enable;
        });
      });
      return next;
    });
    stageLinkedCascade(checkedPermissions, enable);
    setHasChanges(true);
  }, [checkedPermissions, module.id, stageLinkedCascade]);

  // Enable/Disable All applies to every permission in the module.
  const platformPermissions = useMemo(
    () => module.permissions,
    [module.permissions]
  );

  const allPermissionsEnabled = useMemo(
    () => platformPermissions.every((p) => toggles[p.id]),
    [platformPermissions, toggles]
  );

  const handleToggleAllPermissions = useCallback(() => {
    if (allPermissionsEnabled) {
      // Disable all: no warning needed
      setToggles((prev) => {
        const next = { ...prev };
        platformPermissions.forEach((p) => {
          next[p.id] = false;
        });
        return next;
      });
      stageLinkedCascade(platformPermissions.map((p) => p.id), false);
      setHasChanges(true);
      toast.success("All permissions disabled");
    } else {
      // Show warning modal before enabling
      setShowEnableAllWarning(true);
    }
  }, [allPermissionsEnabled, platformPermissions, stageLinkedCascade]);

  const handleConfirmEnableAll = useCallback(() => {
    setToggles((prev) => {
      const next = { ...prev };
      platformPermissions.forEach((p) => {
        next[p.id] = true;
      });
      return next;
    });
    stageLinkedCascade(platformPermissions.map((p) => p.id), true);
    setHasChanges(true);
    setShowEnableAllWarning(false);
    toast.success(`All ${module.name} permissions enabled.`);
  }, [platformPermissions, module.name, stageLinkedCascade]);

  // Bulk select helpers
  const toggleCheckPermission = useCallback((id: string) => {
    setCheckedPermissions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const toggleAll = useCallback(() => {
    if (filteredPermissions.length > 0 && filteredPermissions.every((p) => checkedPermissions.includes(p.id))) {
      setCheckedPermissions((prev) => prev.filter((id) => !filteredPermissions.some((p) => p.id === id)));
    } else {
      setCheckedPermissions((prev) => {
        const newIds = filteredPermissions.map((p) => p.id).filter((id) => !prev.includes(id));
        return [...prev, ...newIds];
      });
    }
  }, [filteredPermissions, checkedPermissions]);

  const allFilteredChecked = filteredPermissions.length > 0 && filteredPermissions.every((p) => checkedPermissions.includes(p.id));
  const someFilteredChecked = checkedPermissions.some((id) => filteredPermissions.some((p) => p.id === id));

  /* On/off resolver layered over the caller's: unsaved local edits win for
   * this module's permissions, staged linked cascades win for cross-module
   * ones, and everything else falls through to the caller. Keeps the linked
   * and recommended cards' status honest while edits are still unsaved. */
  const resolvePermissionEnabled = useCallback(
    (permissionId: string): boolean => {
      if (module.permissions.some((p) => p.id === permissionId)) {
        if (inheritedPermissions?.has(permissionId)) return true;
        return toggles[permissionId] ?? false;
      }
      if (permissionId in pendingLinkedUpdates) return pendingLinkedUpdates[permissionId];
      return isPermissionEnabled?.(permissionId) ?? false;
    },
    [module.permissions, inheritedPermissions, toggles, pendingLinkedUpdates, isPermissionEnabled]
  );

  // Handle list scroll for sticky header shadow
  const handleListScroll = useCallback(() => {
    if (listRef.current) {
      setIsListScrolled(listRef.current.scrollTop > 0);
    }
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <ModalShell open={true} onClose={onClose} backdropClose={true}>
        <div
          className="relative bg-white rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden"
          style={{
            width: "calc(100vw - 48px)",
            height: "calc(100vh - 48px)",
            maxWidth: 1320,
            maxHeight: 900,
          }}
          onClick={(e) => e.stopPropagation()}
      >
        <ReadingRoomProvider modalBorderRadius={12}>
        {/* ──�� Header ──────────────── */}
        <div className="h-[60px] shrink-0 border-b border-gray-200 bg-white flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <h2
              className="text-gray-900 tracking-tight"
              style={{ fontSize: "18px", fontWeight: 700 }}
            >
              {module.name}
            </h2>
            {isReadonly && context !== "permissions-tab" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="flex items-center gap-1 rounded-full border px-2 py-0.5 cursor-default"
                    style={{
                      backgroundColor: "#F1F5F9",
                      borderColor: "#E2E8F0",
                      color: "#64748B",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    <Eye className="w-3 h-3" />
                    View only
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] z-[9999]">
                  {/* On a profile, only an Account Owner's window opens read
                      only (ERP-5529 AC22), so it gives the owner reason. */}
                  <p className="text-xs">
                    {context === "user-detail"
                      ? ACCOUNT_OWNER_COPY.permissionsFixed
                      : "You can see everything this role gives access to, but you can't change it here. Predefined roles come with a fixed set of permissions."}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="flex items-center gap-4">
            {!isReadonly && context === "permissions-tab" && (
              <button
                onClick={handleToggleAllPermissions}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border transition-colors cursor-pointer",
                  allPermissionsEnabled
                    ? "text-red-600 hover:text-red-700 border-red-200 bg-red-50 hover:bg-red-100"
                    : "text-green-600 hover:text-green-700 border-green-200 bg-green-50 hover:bg-green-100"
                )}
                style={{ fontSize: "13px", fontWeight: 500 }}
              >
                {allPermissionsEnabled ? (
                  <>
                    <X className="w-3.5 h-3.5" />
                    Disable All
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Enable All
                  </>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-[8px] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ─── Body ─────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden bg-[#F5F6F8]">
          {/* Left Panel */}
          <div className="w-[352px] shrink-0 bg-[#F5F6F8] flex flex-col relative z-20">
            {/* Sticky header: Search + Filter + Bulk Select */}
            <div
              className={cn(
                "p-4 pb-2 space-y-3 sticky top-0 bg-[#F5F6F8] transition-shadow duration-300 z-10",
                isListScrolled && "shadow-sm border-b border-gray-100"
              )}
            >
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search permission"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-[8px] text-sm focus:outline-none focus:border-[#0E69E2] focus:ring-2 focus:ring-[#0E69E2]/20 transition-all"
                />
              </div>

              {/* Filters, only in editable mode */}
              {!isReadonly && (
                <div className="flex items-center gap-2">
                  {/* Status Filter */}
                  <div className="relative">
                    <button
                      onClick={() => setIsStatusFilterOpen(!isStatusFilterOpen)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                        statusFilter !== "All"
                          ? "bg-[#0E69E2]/10 border-[#0E69E2]/30 text-[#0E69E2]"
                          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      {statusFilter === "All" ? "Status" : statusFilter} <ChevronDown size={12} />
                    </button>
                    {isStatusFilterOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsStatusFilterOpen(false)} />
                        <div className="absolute top-full mt-1 left-0 w-32 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20 flex flex-col max-h-[280px] overflow-y-auto">
                          {(["All", "Enabled", "Disabled"] as const).map((status) => (
                            <button
                              key={status}
                              onClick={() => {
                                setStatusFilter(status);
                                setIsStatusFilterOpen(false);
                              }}
                              className={cn(
                                "text-left px-3 py-2 text-sm hover:bg-gray-50 whitespace-nowrap",
                                statusFilter === status ? "font-medium text-[#0E69E2] bg-[#0E69E2]/10" : "text-gray-700"
                              )}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Bulk Select Row, only in editable mode */}
              {!isReadonly && (
                <div className="flex items-center gap-3 py-1">
                  <Checkbox
                    checked={allFilteredChecked ? true : someFilteredChecked ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                  />
                  <span className="text-sm text-gray-600" style={{ fontWeight: 500 }}>
                    {checkedPermissions.length > 0
                      ? `Selected ${checkedPermissions.length} Permission${checkedPermissions.length !== 1 ? "s" : ""}`
                      : `Showing ${filteredPermissions.length} Permission${filteredPermissions.length !== 1 ? "s" : ""}`}
                  </span>
                </div>
              )}
            </div>

            {/* Permission Groups List */}
            <div
              ref={listRef}
              onScroll={handleListScroll}
              className="flex-1 overflow-y-auto px-4 pt-2 pb-4 flex flex-col gap-2.5"
            >
              {filteredPermissions.map((perm) => {
                const isActive = perm.id === activePermId && !isBulkMode;
                const isChecked = checkedPermissions.includes(perm.id);

                // Determine permission source state
                const isInherited = inheritedPermissions?.has(perm.id) ?? false;
                const sources = inheritedSources?.[perm.id] ?? [];
                const isDirectToggle = toggles[perm.id] ?? false;
                // Effective "on" state: inherited OR direct
                const isEnabled = isInherited || isDirectToggle;
                // Source states
                const isInheritedOnly = isInherited && !isDirectToggle;
                const isDirectOnly = !isInherited && isDirectToggle;
                const isBothSources = isInherited && isDirectToggle;


                return (
                  <div
                    key={perm.id}
                    ref={(el) => {
                      permItemRefs.current.set(perm.id, el);
                    }}
                    className="relative"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (isBulkMode) {
                          toggleCheckPermission(perm.id);
                        } else {
                          setActivePermId(perm.id);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (isBulkMode) {
                            toggleCheckPermission(perm.id);
                          } else {
                            setActivePermId(perm.id);
                          }
                        }
                      }}
                      className={cn(
                        "w-full relative flex items-start gap-3 px-3.5 py-4 rounded-lg text-left transition-all duration-200 cursor-pointer border",
                        isActive
                          ? "bg-[#F0F7FF] border-[#0E69E2]/40 shadow-sm"
                          : isChecked
                          ? "bg-[#F0F7FF] border-[#0E69E2]/30 shadow-sm"
                          : isReadonly
                          ? "bg-white border-gray-200 shadow-sm hover:bg-gray-50"
                          : isEnabled
                          ? "bg-white border-gray-200 shadow-sm hover:bg-gray-50"
                          : "bg-[#FCFDFD] border-gray-300 border-dashed shadow-sm"
                      )}
                    >
                      {/* Checkbox, editable only, top-aligned with the title */}
                      {!isReadonly && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="pt-0.5 shrink-0"
                        >
                          <CheckboxPrimitive.Root
                            checked={isChecked}
                            onCheckedChange={() => toggleCheckPermission(perm.id)}
                            className={cn(
                              "w-[18px] h-[18px] border rounded flex items-center justify-center transition-colors",
                              isChecked ? "bg-[#0E69E2] border-[#0E69E2]" : "bg-white border-gray-300"
                            )}
                          >
                            <CheckboxPrimitive.Indicator className="text-white">
                              <Check size={12} strokeWidth={3} />
                            </CheckboxPrimitive.Indicator>
                          </CheckboxPrimitive.Root>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div
                          className={cn(
                            "flex items-center gap-1.5 text-[13px] font-semibold leading-tight",
                            !isReadonly && "mb-2.5",
                            isActive || isChecked || isReadonly || isEnabled
                              ? "text-gray-900"
                              : "text-gray-500"
                          )}
                        >
                          <span className="min-w-0">{highlightMatch(perm.name, searchQuery)}</span>
                        </div>
                        {/* Bottom row, source indicators / OFF on the left, toggle on the right.
                            Mirrors the alerts modal card: checkbox top-aligned, toggle bottom-aligned. */}
                        {!isReadonly && (
                          <div className="flex items-center justify-between h-6">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            {(isInheritedOnly || isBothSources) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs border cursor-default"
                                    style={{
                                      fontWeight: 500,
                                      backgroundColor: "#EDF4FF",
                                      color: "#007FFF",
                                      borderColor: "#B4D7FF",
                                    }}
                                  >
                                    Inherited
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" align="start" className="p-0 w-auto max-w-none z-[9999]">
                                  <InheritedSourcesTooltip sources={sources} />
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {(isDirectOnly || isBothSources) && !hideSourceChips && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs border cursor-default"
                                    style={{
                                      fontWeight: 500,
                                      backgroundColor: "#ECFDF5",
                                      color: "#059669",
                                      borderColor: "#A7F3D0",
                                    }}
                                  >
                                    Directly Assigned
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-[220px] z-[9999]">
                                  <p className="text-xs">Manually assigned to this user</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {!isEnabled ? (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs border"
                                style={{
                                  fontWeight: 500,
                                  backgroundColor: "#F1F5F9",
                                  color: "#475569",
                                  borderColor: "#CBD5E1",
                                }}
                              >
                                Disabled
                              </span>
                            ) : (
                              /* Enabled chip, shown only when no source chip already
                                 conveys the on-state (e.g. role edit mode). */
                              !((isInheritedOnly || isBothSources) || ((isDirectOnly || isBothSources) && !hideSourceChips)) && (
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs border"
                                  style={{
                                    fontWeight: 500,
                                    backgroundColor: "#EDF4FF",
                                    color: "#007FFF",
                                    borderColor: "#B4D7FF",
                                  }}
                                >
                                  Enabled
                                </span>
                              )
                            )}
                            </div>

                            {/* Toggle, bottom-right, aligned with the card baseline */}
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="shrink-0"
                            >
                          {isInheritedOnly ? (
                            /* Inherited-only: locked green toggle with a hover tooltip naming the
                               granting role(s). Clicking opens the role-granted redirect modal;
                               the permission never turns off. Standard popover timing (200ms open). */
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger asChild>
                                <div>
                                  <ModalSwitch
                                    checked={true}
                                    showLockIcon
                                    onCheckedChange={() => {
                                      setInheritedInfo({ permId: perm.id, permName: perm.name, sources });
                                    }}
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[260px] z-[9999]">
                                <p className="text-xs">
                                  {sources.length === 1
                                    ? `Granted by the ${sources[0]} role. Edit it in the role, or use Add direct assignment.`
                                    : `Granted by ${sources.length} roles. Edit it in those roles, or use Add direct assignment.`}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ) : isBothSources ? (
                            /* Combined inherited + direct: the toggle stays locked ON, inheritance
                               wins for removal. The direct layer is managed in Granted Via (Remove
                               Direct Assignment), which never turns the permission off while a role
                               still grants it. Clicking the toggle opens the Cannot Remove modal. */
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger asChild>
                                <div>
                                  <ModalSwitch
                                    checked={true}
                                    showLockIcon
                                    onCheckedChange={() => {
                                      setInheritedInfo({ permId: perm.id, permName: perm.name, sources });
                                    }}
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[260px] z-[9999]">
                                <p className="text-xs">
                                  {sources.length === 1
                                    ? `Granted by the ${sources[0]} role and assigned directly. Edit the role, or remove the direct assignment in Granted Via.`
                                    : `Granted by ${sources.length} roles and assigned directly. Edit those roles, or remove the direct assignment in Granted Via.`}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            /* Direct only or OFF: normal toggle */
                            <ModalSwitch
                              checked={isDirectToggle}
                              onCheckedChange={(val) => handleToggle(perm.id, val)}
                            />
                          )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Arrow indicator pointing to right panel */}
                    {isActive && !isBulkMode && (
                      <div className="absolute -right-[7px] top-1/2 -translate-y-1/2 z-10">
                        <div
                          className="w-3.5 h-3.5 bg-[#eff6ff] border-t border-r border-[#0E69E2]/40 rotate-45"
                          style={{ backgroundColor: "#f0f7ff" }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredPermissions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search className="w-8 h-8 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500" style={{ fontWeight: 500 }}>No Permissions Found</p>
                  <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filter</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel */}
          <div className="flex-1 min-w-0 bg-white flex flex-col min-h-0 border-l border-gray-200">
            <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
              {isBulkMode ? (
                <BulkEditView
                  permissions={module.permissions}
                  checkedIds={checkedPermissions}
                  toggles={toggles}
                  onUncheck={(id) => setCheckedPermissions((prev) => prev.filter((x) => x !== id))}
                  onBulkEnable={handleBulkEnable}
                  context={context}
                />
              ) : activePerm ? (
                <CrossFadeWrapper key={activePerm.id}>
                  <PermissionDetailView
                    permission={activePerm}
                    enabled={toggles[activePerm.id] ?? false}
                    onToggle={(val) => handleToggle(activePerm.id, val)}
                    context={context}
                    mode={mode}
                    userId={userId}
                    module={module}
                    inheritedPermissions={inheritedPermissions}
                    inheritedSources={inheritedSources}
                    hideSourceChips={hideSourceChips}
                    toggles={toggles}
                    onShowInheritedInfo={(permId, permName, sources) => setInheritedInfo({ permId, permName, sources })}
                    userName={userName}
                    isPermissionEnabled={resolvePermissionEnabled}
                    onNavigateToPermission={navigateToPermission}
                    onNavigateToModulePermission={onNavigateToModulePermission}
                  />
                </CrossFadeWrapper>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-gray-400 p-8">
                  Select a Permission to View Details
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Footer ──────────────── */}
        <div className="h-[64px] shrink-0 border-t border-gray-200 bg-white flex items-center justify-end gap-3 px-6">
          {isReadonly ? (
            <button
              onClick={onClose}
              className="w-[100px] px-4 py-2 rounded-[8px] border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
              style={{ fontSize: "14px", fontWeight: 500 }}
            >
              Close
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="w-[100px] px-4 py-2 rounded-[8px] border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                style={{ fontSize: "14px", fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                disabled={!hasChanges}
                className={cn(
                  "w-[100px] px-4 py-2 rounded-[8px] transition-all shadow-sm",
                  hasChanges
                    ? "bg-[#0E69E2] text-white hover:bg-[#0E69E2]/90 cursor-pointer"
                    : "bg-gray-300 text-white cursor-not-allowed"
                )}
                style={{ fontSize: "14px", fontWeight: 500 }}
                onClick={handleSave}
              >
                Save
              </button>
            </>
          )}
        </div>
        </ReadingRoomProvider>
        </div>

        {/* Enable All Warning Modal */}
        {/* Linked-toggle confirmation. Confirming flips the whole linked group:
            this module's members locally, other modules' staged until Save. */}
        {linkConfirm && (
          <DestructiveConfirmModal
            open
            onClose={() => setLinkConfirm(null)}
            badge="Linked Permissions"
            icon={Link}
            tone={linkConfirm.val ? "brand" : "warning"}
            title={`Turn ${linkConfirm.val ? "On" : "Off"} ${linkConfirm.linked.length + 1} Linked Permissions?`}
            description={
              <>
                <span style={{ fontWeight: 600, color: "#334155" }}>{linkConfirm.permName}</span>{" "}
                edits the same {linkConfirm.entity} on the back end as{" "}
                {linkConfirm.linked.length === 1 ? (
                  <>
                    <span style={{ fontWeight: 600, color: "#334155" }}>
                      {linkConfirm.linked[0].permissionName}
                    </span>{" "}
                    in {linkConfirm.linked[0].moduleName}
                  </>
                ) : (
                  <>
                    {linkConfirm.linked.length} linked permissions in{" "}
                    {linkConfirm.linked
                      .map((ref) => ref.moduleName)
                      .join(", ")
                      .replace(/, ([^,]*)$/, ", and $1")}
                  </>
                )}
                , so they stay in sync. Turning it {linkConfirm.val ? "on" : "off"} turns{" "}
                {linkConfirm.linked.length === 1 ? "both" : "all of them"}{" "}
                {linkConfirm.val ? "on" : "off"}.
              </>
            }
            confirmLabel={`Turn ${linkConfirm.val ? "On" : "Off"}`}
            cancelLabel="Cancel"
            onConfirm={handleConfirmLinkedToggle}
            maxWidth={480}
            /* Above the permission modal's shell, alongside the other overlays. */
            z={110}
          />
        )}

        {showEnableAllWarning && (
           <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-auto">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowEnableAllWarning(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-[480px] w-full mx-6 p-6 space-y-4">
              <h3 className="text-foreground" style={{ fontSize: "17px", fontWeight: 650 }}>
                Enable All {module.name} Permissions?
              </h3>
              <p className="text-muted-foreground" style={{ fontSize: "13.5px", fontWeight: 400, lineHeight: "1.55" }}>
                This will turn on all {module.permissions.length} permissions in {module.name} for this user. Some of these permissions are off by default because they grant elevated access to sensitive data or high-impact actions. Review each permission individually after saving to confirm the configuration is appropriate for this user.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowEnableAllWarning(false)}
                  className="px-4 py-2 rounded-[8px] border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                  style={{ fontSize: "14px", fontWeight: 500 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmEnableAll}
                  className="px-4 py-2 rounded-[8px] bg-[#0E69E2] text-white hover:bg-[#0E69E2]/90 transition-colors cursor-pointer shadow-sm"
                  style={{ fontSize: "14px", fontWeight: 500 }}
                >
                  Enable All
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Inherited permission, role-granted redirect modal. Clicking the
            locked toggle opens this; it explains where to make the change and
            turns nothing off. */}
        <RoleGrantedRedirectModal
          open={!!inheritedInfo}
          user={userName}
          permission={inheritedInfo?.permName ?? "this permission"}
          sources={inheritedInfo?.sources ?? []}
          onClose={() => setInheritedInfo(null)}
        />

    </ModalShell>
  );
}

// ─── Threshold Configuration Card ───────────────────────────────────────────

function ThresholdCard({
  config,
  mode,
  disabled,
}: {
  config: ThresholdConfig;
  mode: "readonly" | "editable";
  disabled?: boolean;
}) {
  const [value, setValue] = useState(config.defaultValue ?? "");
  const [noLimit, setNoLimit] = useState(!config.defaultValue);

  const isDescriptive = config.type === "descriptive";
  const isEditable = mode === "editable" && !isDescriptive && !disabled;

  return (
    <div>
      <div
        className={cn(
          "rounded-xl border overflow-hidden",
          disabled && "opacity-60"
        )}
        style={{
          borderColor: "#E2E8F0",
          backgroundColor: "#F8FAFC",
          boxShadow: "0 1px 2px 0 rgba(71,85,105,0.04)",
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          <div
            className="w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0 shadow-sm"
            style={{
              backgroundColor: "white",
              border: "1px solid rgba(203,213,225,0.5)",
            }}
          >
            <Gauge className="w-[18px] h-[18px]" style={{ color: isEditable ? "#007FFF" : "#475569" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="text-[#334155]"
              style={{ fontSize: "13.5px", fontWeight: 700, lineHeight: "1.3" }}
            >
              {config.label}
            </h3>
            <p
              className="text-[#334155] opacity-90 mt-0.5"
              style={{ fontSize: "12.5px", fontWeight: 400, lineHeight: "1.45" }}
            >
              {config.description}
            </p>
          </div>
        </div>

        {/* Input area, only for non-descriptive types */}
        {!isDescriptive && (
          <div className={cn("px-4 pb-4", disabled && "pointer-events-none")}>
            {isEditable ? (
              <div className="space-y-3">
                {/* No limit toggle */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={noLimit}
                    onClick={() => {
                      setNoLimit(!noLimit);
                      if (!noLimit) setValue("");
                    }}
                    className={cn(
                      "relative inline-flex h-[20px] w-[36px] shrink-0 items-center rounded-full transition-colors duration-200 outline-none cursor-pointer",
                      noLimit ? "bg-[#007FFF]" : "bg-gray-200"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none block h-[16px] w-[16px] rounded-full bg-white shadow-sm transition-transform duration-200",
                        noLimit ? "translate-x-[18px]" : "translate-x-[2px]"
                      )}
                    />
                  </button>
                  <span
                    className="text-[12.5px]"
                    style={{ fontWeight: 500, color: noLimit ? "#334155" : "#64748B" }}
                  >
                    No limit
                  </span>
                </label>

                {/* Numeric input, hidden when "No limit" is checked */}
                {!noLimit && (
                  <div className="relative">
                    {config.unitPosition === "prefix" && (
                      <span
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px]"
                        style={{ fontWeight: 500, color: "#475569" }}
                      >
                        {config.unit}
                      </span>
                    )}
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9,.]/g, "");
                        setValue(raw);
                      }}
                      className={cn(
                        "w-full h-10 border rounded-[8px] text-[13px] text-[#0F172A] bg-white shadow-xs focus:outline-none focus:ring-2 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all",
                        config.unitPosition === "prefix" ? "pl-7 pr-3.5" : "pl-3.5 pr-14"
                      )}
                      style={{ fontWeight: 550, borderColor: "#CBD5E1" }}
                      placeholder="Enter value"
                    />
                    {config.unitPosition === "suffix" && (
                      <span
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px]"
                        style={{ fontWeight: 500, color: "#475569" }}
                      >
                        {config.unit}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Read-only display */
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-[8px] border"
                style={{ backgroundColor: "white", borderColor: "#CBD5E1" }}
              >
                <span
                  className="text-[13px]"
                  style={{ fontWeight: 550, color: "#334155" }}
                >
                  {config.defaultValue
                    ? formatThresholdValue(config.defaultValue, config)
                    : "No limit"}
                </span>
              </div>
            )}

            {/* Helper text */}
            <p
              className="mt-2.5 text-[11.5px]"
              style={{ fontWeight: 400, color: "#64748B", lineHeight: "1.45" }}
            >
              {config.helperText}
            </p>
          </div>
        )}
      </div>
      {disabled && (
        <p
          className="mt-2 text-[12px]"
          style={{ fontWeight: 450, color: "#94A3B8", lineHeight: "1.45" }}
        >
          Threshold configuration is available after saving.
        </p>
      )}
    </div>
  );
}

// ─── Permission Threshold Container (per-permission, in detail view) ─────────
/* Renders an editable (role-detail) or view-only (user-detail) threshold panel
   for a permission that carries a thresholdConfig (e.g. "Create and edit
   purchase orders" → Maximum PO Value). Role-detail opens the shared
   EditThresholdModal; user-detail explains the threshold is governed by the
   granting role and links to it. */
function PermissionThresholdContainer({
  permission,
  context,
  roleId,
  inheritedSources,
}: {
  permission: Permission;
  context: PermissionModalContext;
  /** role-detail: the role being edited. user-detail: the viewing user's id. */
  roleId?: number;
  /** user-detail: role names that grant this permission. */
  inheritedSources?: Record<string, string[]>;
}) {
  const config = permission.thresholdConfig;
  const isRoleDetail = context === "role-detail";

  const initialValue =
    isRoleDetail && roleId != null && config
      ? getRoleThresholdValue(roleId, permission.id, config) ?? ""
      : config?.defaultValue ?? "";

  const [value, setValue] = useState<string>(initialValue);
  const [editOpen, setEditOpen] = useState(false);

  if (!config || config.type === "descriptive") return null;
  if (context !== "role-detail" && context !== "user-detail") return null;

  const formatted = formatThresholdValue(value, config);
  const isNoLimit = !value;
  const roleName =
    roleId != null ? roles.find((r) => r.id === roleId)?.roleName ?? "this role" : "this role";

  // user-detail: resolve the granting role(s) so we can link out to them.
  const grantingRoleNames = inheritedSources?.[permission.id] ?? [];
  const grantingRoles = grantingRoleNames
    .map((name) => roles.find((r) => r.roleName === name))
    .filter((r): r is (typeof roles)[number] => !!r);
  const primaryRole = grantingRoles[0];

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        borderColor: "#E2E8F0",
        backgroundColor: "#FFFFFF",
        boxShadow: "0 1px 2px 0 rgba(71,85,105,0.04)",
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div
          className="w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0 shadow-sm"
          style={{ backgroundColor: "white", border: "1px solid rgba(203,213,225,0.5)" }}
        >
          <Gauge className="w-[18px] h-[18px]" style={{ color: isRoleDetail ? "#007FFF" : "#475569" }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[#0F172A]" style={{ fontSize: "13.5px", fontWeight: 700, lineHeight: "1.3" }}>
            {config.label}
          </h3>
          <p className="text-[#475569] mt-0.5" style={{ fontSize: "12.5px", fontWeight: 400, lineHeight: "1.45" }}>
            {config.description}
          </p>
        </div>
      </div>

      {/* Value + action */}
      <div className="px-4 pb-4">
        <div
          className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-[8px] border"
          style={{ backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
        >
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide" style={{ fontWeight: 600, color: "#94A3B8" }}>
              Current threshold
            </p>
            <p
              className="text-[14px] mt-0.5 truncate"
              style={{
                fontWeight: 600,
                color: isNoLimit ? "#64748B" : "#059669",
                fontStyle: isNoLimit ? "italic" : "normal",
              }}
            >
              {formatted}
            </p>
          </div>

          {isRoleDetail ? (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] border border-[#007FFF] bg-white text-[13px] hover:bg-[#EDF4FF] transition-colors cursor-pointer"
              style={{ color: "#007FFF", fontWeight: 600 }}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit Threshold
            </button>
          ) : (
            <span
              className="shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] border"
              style={{ backgroundColor: "#F1F5F9", color: "#64748B", borderColor: "#E2E8F0", fontWeight: 600 }}
            >
              <Lock className="w-3 h-3" />
              View only
            </span>
          )}
        </div>

        {/* Educational note, user-detail only */}
        {!isRoleDetail && (
          <div
            className="flex items-start gap-2.5 mt-3 px-3.5 py-2.5 rounded-[8px] border"
            style={{ backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }}
          >
            <Info className="w-4 h-4 shrink-0 mt-px" style={{ color: "#2563EB" }} />
            <p className="text-[12.5px]" style={{ color: "#1E40AF", fontWeight: 400, lineHeight: "1.5" }}>
              This threshold is inherited from{" "}
              {primaryRole ? (
                <>
                  the{" "}
                  <LinkedRoleName
                    roleId={primaryRole.id}
                    className="font-semibold"
                    style={{ color: "#1D4ED8" }}
                  >
                    {primaryRole.roleName}
                  </LinkedRoleName>{" "}
                  role
                </>
              ) : (
                "the granting role"
              )}
              . To change it, edit the threshold on
              {primaryRole ? " that role" : " the role that grants this permission"}.
            </p>
          </div>
        )}

        {/* Helper text */}
        <p className="mt-2.5 text-[11.5px]" style={{ fontWeight: 400, color: "#64748B", lineHeight: "1.45" }}>
          {config.helperText}
        </p>
      </div>

      {isRoleDetail && (
        <EditThresholdModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          entityName={roleName}
          entityType="role"
          config={config}
          currentValue={value}
          onSave={(newValue) => setValue(newValue)}
        />
      )}
    </div>
  );
}

// ─── Permission Detail View (Right Panel Content) ───────────────────────────

function PermissionDetailView({
  permission,
  enabled,
  onToggle,
  context,
  mode = "readonly",
  userId,
  module,
  inheritedPermissions,
  inheritedSources,
  hideSourceChips,
  toggles,
  onShowInheritedInfo,
  userName,
  isPermissionEnabled,
  onNavigateToPermission,
  onNavigateToModulePermission,
}: {
  permission: Permission;
  enabled: boolean;
  onToggle: (val: boolean) => void;
  context: PermissionModalContext;
  mode?: PermissionModalMode;
  userId?: number;
  module: PermissionModule;
  inheritedPermissions?: Set<string>;
  inheritedSources?: Record<string, string[]>;
  hideSourceChips?: boolean;
  toggles?: Record<string, boolean>;
  onShowInheritedInfo?: (permId: string, permName: string, sources: string[]) => void;
  /** Display name of the user being edited (for Remove Direct Assignment copy). */
  userName?: string;
  /** Resolves on/off state for permissions outside the open module. */
  isPermissionEnabled?: (permissionId: string) => boolean;
  /** Select another permission in this module and scroll the left list to it. */
  onNavigateToPermission: (permissionId: string) => void;
  /** Open another module's modal on a specific permission. */
  onNavigateToModulePermission?: (moduleId: string, permissionId: string) => void;
}) {
  const [viewInModuleOpen, setViewInModuleOpen] = useState(false);
  /* Head-shake refusal on the disabled View in Module button. Reset on
     animationend so every click can retrigger it. */
  const [vimRefuseShake, setVimRefuseShake] = useState(false);

  /* Warm this permission's View-in-Module screenshots the moment it is
     selected. The user reads the grant/restrict copy for a few seconds before
     clicking View in Module, which is enough runway to download and decode
     both shots — so the modal opens onto a ready bitmap instead of a blank
     frame. ~240KB per permission, bounded by the prefetcher's cache cap. */
  useEffect(() => {
    if (!SHOW_VIEW_IN_MODULE_CONTENT) return; // previews stashed, nothing to warm
    const vim = VIEW_IN_MODULE_DATA[permission.id];
    if (vim) prefetchImages(vim.imageOn, vim.imageOff);
  }, [permission.id]);

  const [callout, setCallout] = useState<{ text: string; type: "info" | "warning" } | null>(null);
  const [confirmRemoveDirect, setConfirmRemoveDirect] = useState(false);
  const calloutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isReadonly = mode === "readonly";

  // Compute source state for this permission
  const isInherited = inheritedPermissions?.has(permission.id) ?? false;
  const sources = useMemo(() => inheritedSources?.[permission.id] ?? [], [inheritedSources, permission.id]);
  const isDirectToggle = toggles?.[permission.id] ?? false;
  const isInheritedOnly = isInherited && !isDirectToggle;
  const isBothSources = isInherited && isDirectToggle;
  const isEffectivelyOn = isInherited || isDirectToggle;

  // Handle toggle with callout feedback
  const handleToggleWithCallout = useCallback((val: boolean) => {
    if (calloutTimer.current) clearTimeout(calloutTimer.current);

    if (!val && isInherited && isDirectToggle) {
      // Scenario 1: removing direct while inherited remains
      setCallout({
        text: `Direct assignment removed. This permission remains active, still inherited from ${sources.join(", ")}.`,
        type: "info",
      });
    } else if (!val && !isInherited && isDirectToggle && context === "create-flow") {
      // Scenario 3: removing the last source. Only the create flow gets a
      // callout; the "will deactivate for this user" warning it used to show
      // elsewhere was dropped as noise, the toggle itself says enough.
      setCallout({ text: "Permission removed.", type: "warning" });
    }
    // Scenario 4: toggling on fresh, no callout

    calloutTimer.current = setTimeout(() => setCallout(null), 4000);
    onToggle(val);
  }, [isInherited, isDirectToggle, sources, context, onToggle]);

  // Handle "+ Add Direct Assignment" from Granted Via section
  const handleAddDirect = useCallback(() => {
    toast.success(
      "Direct assignment added. This permission is now granted via both direct assignment and role inheritance.",
      { position: "top-right" }
    );
    onToggle(true);
  }, [onToggle]);

  // Handle "Remove Direct Assignment" from Granted Via section, confirm first,
  // since this branches on whether a role also grants the permission.
  const handleRemoveDirect = useCallback(() => {
    setConfirmRemoveDirect(true);
  }, []);

  const confirmRemoveDirectAssignment = useCallback(() => {
    if (calloutTimer.current) clearTimeout(calloutTimer.current);
    setCallout({
      text: `Direct assignment removed. This permission remains active, still inherited from ${sources.join(", ")}.`,
      type: "info",
    });
    calloutTimer.current = setTimeout(() => setCallout(null), 4000);
    onToggle(false);
    setConfirmRemoveDirect(false);
  }, [sources, onToggle]);

  // Clear callout timer on unmount
  useEffect(() => {
    return () => {
      if (calloutTimer.current) clearTimeout(calloutTimer.current);
    };
  }, []);

  // Required license tier: rule-based classification of THIS permission.
  const requiredTier: "Full Access" | "Field User" =
    permissionRequiresFullAccess(permission) ? "Full Access" : "Field User";

  return (
    <div className="px-7 py-6 space-y-7">
      {/* Permission heading + toggle */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className="text-foreground"
              style={{ fontSize: "20px", fontWeight: 600, lineHeight: "1.3" }}
            >
              {permission.name}
            </h3>
            <PlatformChip {...permissionSurfaces(permission)} />
            <LicenseRequirementChip tier={requiredTier} />
          </div>
          <p
            className="text-muted-foreground mt-1.5"
            style={{ fontSize: "13.5px", fontWeight: 400, lineHeight: "1.55" }}
          >
            {permission.description}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          {permission.id === "ur-manage-roles" && (
            <ReadingRoomButton config={MANAGE_ROLES_READING_ROOM} />
          )}
          {!isReadonly && (
            <>
              {isInheritedOnly ? (
                /* Inherited-only: locked toggle + hover tooltip naming the granting role(s).
                   Clicking opens the role-granted redirect modal; nothing turns off. */
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <div>
                      <ModalSwitch
                        checked={true}
                        showLockIcon
                        onCheckedChange={() => {
                          if (onShowInheritedInfo) onShowInheritedInfo(permission.id, permission.name, sources);
                        }}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px] z-[9999]">
                    <p className="text-xs">
                      {sources.length === 1
                        ? `Granted by the ${sources[0]} role. Edit it in the role, or use Add direct assignment.`
                        : `Granted by ${sources.length} roles. Edit it in those roles, or use Add direct assignment.`}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : isBothSources ? (
                /* Combined inherited + direct: toggle stays locked ON (inheritance wins for
                   removal). Direct layer is managed via Remove Direct Assignment in Granted Via. */
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <div>
                      <ModalSwitch
                        checked={true}
                        showLockIcon
                        onCheckedChange={() => {
                          if (onShowInheritedInfo) onShowInheritedInfo(permission.id, permission.name, sources);
                        }}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px] z-[9999]">
                    <p className="text-xs">
                      {sources.length === 1
                        ? `Granted by the ${sources[0]} role and assigned directly. Edit the role, or remove the direct assignment in Granted Via.`
                        : `Granted by ${sources.length} roles and assigned directly. Edit those roles, or remove the direct assignment in Granted Via.`}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                /* Direct only or OFF: normal toggle */
                <ModalSwitch
                  checked={isDirectToggle}
                  onCheckedChange={handleToggleWithCallout}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Toggle callout */}
      {callout && (
        <div
          className={cn(
            "flex items-start gap-2 px-4 py-3 rounded-xl border text-[12.5px]",
            callout.type === "info"
              ? "bg-blue-50 border-blue-200 text-blue-700"
              : "bg-amber-50 border-amber-200 text-amber-700"
          )}
          style={{ fontWeight: 450, lineHeight: "1.45" }}
        >
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{callout.text}</span>
          <button
            onClick={() => setCallout(null)}
            className="shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}


      {/* Content always readable regardless of toggle state */}
      <div className="space-y-7">
        {/* What it grants / When to restrict, always visible (no collapsible wrapper) */}
        <div>
          <div className="space-y-4">
              {/* "What it grants" */}
              <div className="flex items-start justify-between p-4 bg-[#F1F5FF] rounded-xl border border-[#C6D2FF] gap-5">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 bg-white rounded-[8px] flex items-center justify-center shrink-0 text-[#4339CA] shadow-sm border border-[#C6D2FF]/30">
                    <BookOpen className="w-[18px] h-[18px]" />
                  </div>
                  <div className="flex-1">
                    <h3
                      className="text-[#4339CA]"
                      style={{ fontSize: "13.5px", fontWeight: 500, lineHeight: "1.3" }}
                    >
                      What It Grants
                    </h3>
                    <p
                      className="text-[#475569] mt-0.5"
                      style={{
                        fontSize: "12.5px",
                        fontWeight: 400,
                        lineHeight: "1.5",
                      }}
                    >
                      {permission.whatItGrants}
                    </p>
                  </div>
                </div>

                {SHOW_VIEW_IN_MODULE_CONTENT ? (
                  <button
                    onClick={() => setViewInModuleOpen(true)}
                    className="shrink-0 flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 shadow-sm rounded-[8px] text-sm text-gray-700 hover:text-gray-900 hover:border-gray-300 transition-all hover:shadow cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    <Eye size={16} />
                    View in Module
                  </button>
                ) : (
                  /* Previews stashed (see lib/feature-flags.ts): the button is
                     disabled with a plain Coming Soon tooltip. The span carries
                     the hover and the click, since a disabled button swallows
                     pointer events; clicking answers with a quick head shake. */
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <span
                        className="shrink-0 inline-block cursor-not-allowed"
                        onClick={() => setVimRefuseShake(true)}
                        onAnimationEnd={() => setVimRefuseShake(false)}
                        style={vimRefuseShake ? { animation: "headShake 0.45s ease-in-out" } : undefined}
                      >
                        <button
                          disabled
                          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 shadow-sm rounded-[8px] text-sm text-gray-400 pointer-events-none"
                          style={{ fontWeight: 500 }}
                        >
                          <Eye size={16} />
                          View in Module
                        </button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="z-[9999]">
                      <p className="text-xs">Coming Soon</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* "When you'd restrict this" */}
              <div className="flex items-start justify-between p-4 bg-[#FFFBEB] rounded-xl border border-[#F5D78E] gap-5">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 bg-white rounded-[8px] flex items-center justify-center shrink-0 text-[#B45309] shadow-sm border border-[#F5D78E]/30">
                    <Shield className="w-[18px] h-[18px]" />
                  </div>
                  <div className="flex-1">
                    <h3
                      className="text-[#92400E]"
                      style={{ fontSize: "13.5px", fontWeight: 500, lineHeight: "1.3" }}
                    >
                      When to Restrict This
                    </h3>
                    <p
                      className="text-[#475569] mt-0.5"
                      style={{
                        fontSize: "12.5px",
                        fontWeight: 400,
                        lineHeight: "1.45",
                      }}
                    >
                      {permission.whenToRestrict}
                    </p>
                  </div>
                </div>
              </div>

              {/* "Linked permissions": the recommended-permissions banner
                  repurposed for linked groups (data/linked-permissions.ts).
                  Renders only for permissions that share a backend entity with
                  permissions in other modules; the chips carry live On/Off dots
                  and navigate, the cascade itself lives behind the linked-toggle
                  confirmation modal. */}
              <LinkedPermissionsCard
                permissionId={permission.id}
                moduleId={module.id}
                canNavigateCrossModule={!!onNavigateToModulePermission}
                onNavigate={(permissionId, targetModuleId) => {
                  if (targetModuleId === module.id) {
                    onNavigateToPermission(permissionId);
                  } else {
                    onNavigateToModulePermission?.(targetModuleId, permissionId);
                  }
                }}
              />

              {/* "Recommended permissions to turn on", renders only when this
                  permission has recommendations that are still off.
                  Currently hidden behind SHOW_RECOMMENDED_PERMISSIONS_BANNER —
                  see lib/feature-flags.ts to switch it back on. */}
              {SHOW_RECOMMENDED_PERMISSIONS_BANNER && (
                <RecommendedPermissionsCard
                  permissionId={permission.id}
                  moduleId={module.id}
                  toggles={toggles}
                  inheritedPermissions={inheritedPermissions}
                  isPermissionEnabled={isPermissionEnabled}
                  canNavigateCrossModule={!!onNavigateToModulePermission}
                  onNavigate={(permissionId, targetModuleId) => {
                    if (targetModuleId === module.id) {
                      onNavigateToPermission(permissionId);
                    } else {
                      onNavigateToModulePermission?.(targetModuleId, permissionId);
                    }
                  }}
                />
              )}

              {/* Per-permission threshold, editable in role-detail, view-only in user-detail.
                  Hidden behind SHOW_PERMISSION_THRESHOLDS, see lib/feature-flags.ts. */}
              {SHOW_PERMISSION_THRESHOLDS &&
                (context === "role-detail" || context === "user-detail") &&
                permission.thresholdConfig &&
                permission.thresholdConfig.type !== "descriptive" && (
                  <PermissionThresholdContainer
                    permission={permission}
                    context={context}
                    roleId={userId}
                    inheritedSources={inheritedSources}
                  />
                )}
            </div>
        </div>

        {/* Role scope: role-level Manage Roles configuration */}
        {permission.id === "ur-manage-roles" && context === "role-detail" && userId != null && isEffectivelyOn && (
          <RoleManageScopeSection roleId={userId} />
        )}

        {/* Manage Roles: per-user scope summary (independent of Additional Details accordion) */}
        {permission.id === "ur-manage-roles" && context === "user-detail" && userId != null && isEffectivelyOn && (
          <ManageRolesScopeSummary userId={userId} readOnly={isInheritedOnly} />
        )}

        {/* Granted Via / Assign Roles & Users, only when permission is active.
            Hidden entirely in role-scoped contexts (Create Role / Role Detail) where
            direct vs. inherited doesn't apply. */}
        {isReadonly ? (
          context === "user-detail" && userId != null ? (
            enabled && !hideSourceChips && (
              <GrantedViaSection
                permissionId={permission.id}
                inheritedSources={inheritedSources}
                isDirectToggle={isDirectToggle}
                enabled={enabled}
              />
            )
          ) : (
            /* "Roles & Users with This Permission" only makes sense in the
               system-wide UAC Permissions tab. It is intentionally omitted when
               the modal is opened from an individual role's detail page. */
            (!context || context === "permissions-tab") && (
              <AssignRolesAndUsers
                permissionId={permission.id}
                thresholdConfig={permission.thresholdConfig}
              />
            )
          )
        ) : (
          (context === "user-detail" || context === "create-flow") && isEffectivelyOn && !hideSourceChips && (
            <GrantedViaSection
              permissionId={permission.id}
              inheritedSources={inheritedSources}
              isDirectToggle={isDirectToggle}
              enabled={isEffectivelyOn}
              onAddDirect={handleAddDirect}
              onRemoveDirect={handleRemoveDirect}
            />
          )
        )}
      </div>

      <ViewInModuleModal
        open={viewInModuleOpen}
        onClose={() => setViewInModuleOpen(false)}
        permissionId={permission.id}
        module={module}
      />

      {/* Remove Direct Assignment, both directly assigned and inherited
          (this Granted Via action only appears in the direct+role case). */}
      {confirmRemoveDirect && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-auto">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmRemoveDirect(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-[480px] w-full mx-6 overflow-hidden flex flex-col">
            <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: "#F1F5F9" }}>
              <h3 className="text-foreground" style={{ fontSize: "15px", fontWeight: 650 }}>
                Remove the Direct Assignment?
              </h3>
            </div>
            <div className="px-5 py-5">
              <p style={{ fontSize: "13.5px", color: "#334155", lineHeight: "1.6" }}>
                {userName ?? "This user"} has {permission.name} both directly and through an assigned role, so removing the direct assignment will not change {userName ?? "this user"}'s access, because the role still grants it. The roles that grant this permission are listed under Granted Via.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t" style={{ borderColor: "#F1F5F9", backgroundColor: "#FAFBFC" }}>
              <GhostCancelButton onClick={() => setConfirmRemoveDirect(false)} />
              <PrimaryConfirmButton label="Remove Direct Assignment" onClick={confirmRemoveDirectAssignment} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── License type mapping for role cards ────────────────────────────────────

// ─── Granted Via Section ────────────────────────────────────────────────────

function GrantedViaSection({
  permissionId,
  inheritedSources,
  isDirectToggle,
  enabled,
  onAddDirect,
  onRemoveDirect,
}: {
  permissionId: string;
  inheritedSources?: Record<string, string[]>;
  isDirectToggle: boolean;
  enabled: boolean;
  onAddDirect?: () => void;
  onRemoveDirect?: () => void;
}) {
  const roleNames = inheritedSources?.[permissionId] ?? [];
  const hasRoles = roleNames.length > 0;
  const hasDirect = isDirectToggle;
  const hasSources = hasDirect || hasRoles;
  const isInheritedOnly = hasRoles && !hasDirect;

  const highestTooltip = hasDirect
    ? "Direct assignments override role inheritance and are applied first during permission evaluation."
    : "This role has the highest priority for granting this permission. Removing it may revoke access unless another source exists.";

  return (
    <div
      className="rounded-xl border bg-white overflow-hidden"
      style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 2px 0 rgba(15,23,42,0.03)" }}
    >
      {/* Header, slate-50 */}
      <div
        className="px-5 py-3 flex items-center justify-between gap-2"
        style={{ backgroundColor: "#F8FAFC" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Link className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
          <h3 className="text-[14px]" style={{ color: "#0F172A", fontWeight: 600 }}>
            Granted Via
          </h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-default">
                <Info className="w-3.5 h-3.5 text-[#94A3B8]" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] z-[9999]">
              <p className="text-xs">Shows all roles granting this permission. The permission stays active as long as at least one role still grants it.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isInheritedOnly && onAddDirect && (
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Plain blue text at rest, a filled card on hover. Padding
                    and a transparent border are always present so nothing
                    shifts when the fill appears, and negative margins cancel
                    that padding out of the layout, so the hover card grows
                    outwards without making the header any taller. */}
                <button
                  onClick={onAddDirect}
                  className="-my-1 -mx-2.5 inline-flex items-center gap-1 py-1 px-2.5 rounded-[8px] border border-transparent text-[#007FFF] hover:text-[#0066D6] hover:bg-[#EDF4FF] hover:border-[#C9DEFB] hover:shadow-sm transition-all cursor-pointer"
                  style={{ fontSize: "12.5px", fontWeight: 500 }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add as Direct Assignment
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" align="end" className="max-w-[280px] z-[9999]">
                <p className="text-xs">Grants this permission to the user directly, on top of the role. It stays even if their roles change, and can be removed here without editing any role.</p>
              </TooltipContent>
            </Tooltip>
          )}
          {/* Remove lives on the Directly Assigned card itself now, so the
              action sits on the thing it acts on rather than in the header. */}
        </div>
      </div>
      {/* Divider */}
      <div className="border-t" style={{ borderColor: "#E2E8F0" }} />

      {/* Source cards, two per row */}
      {hasSources && (
        <div className="px-5 py-4">
          <div className="grid grid-cols-2 gap-2.5">
            {/* Same two-row shape as the role cards below, so the grid rows
                line up. No open-in-new-tab affordance here: a direct
                assignment has no role page to open. */}
            {hasDirect && (
              <div
                className="flex flex-col gap-2 rounded-[8px] border border-[#BBF7D0] hover:border-[#86EFAC] px-3.5 py-3 shadow-sm bg-gradient-to-b from-white to-[#F0FDF4] hover:to-[#DCFCE7] transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate min-w-0" style={{ fontSize: "13px", fontWeight: 600, color: "#1E293B" }}>
                    Directly Assigned
                  </span>
                  {hasRoles && onRemoveDirect && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={onRemoveDirect}
                          className="shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-[6px] text-[#DC2626] hover:text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                          style={{ fontSize: "12px", fontWeight: 500 }}
                        >
                          <X className="w-3 h-3" />
                          Remove
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="end" className="max-w-[260px] z-[9999]">
                        <p className="text-xs">
                          Removes the direct assignment only. The permission stays on, because the
                          roles listed here still grant it.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {hasRoles && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs border cursor-default"
                          style={{ fontWeight: 500, backgroundColor: "#ECFDF5", color: "#059669", borderColor: "#A7F3D0" }}
                        >
                          Highest Priority
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px] text-center" style={{ fontSize: "12px", fontWeight: 450, lineHeight: "1.45" }}>
                        {highestTooltip}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>
            )}

            {roleNames.map((roleName, i) => {
              const isHighest = !hasDirect && i === 0 && roleNames.length > 1;
              const role = roles.find((r) => r.roleName === roleName);
              const roleType = role?.isSystem ? "Predefined" : "Custom";
              return (
                <div
                  key={roleName}
                  className="flex flex-col gap-2 rounded-[8px] border border-[#E2E8F0] hover:border-[#CBD5E1] px-3.5 py-3 shadow-sm bg-gradient-to-b from-white to-[#F8FAFC] hover:to-[#F1F5F9] transition-colors"
                >
                  {/* Row 1: the role name gets the full width, minus the open
                      icon. Dropping the old max-w cap means names like
                      "System Configuration Manager" only truncate when the
                      card genuinely runs out of room. */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate min-w-0" style={{ fontSize: "13px", fontWeight: 600, color: "#1E293B" }}>
                      {roleName}
                    </span>
                    {role && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={`/company-settings/user-access-control/role/${role.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`View ${roleName} role details`}
                            className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-[6px] text-[#007FFF] hover:text-[#0066D6] hover:bg-[#EDF4FF] transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="end" className="z-[9999]">
                          <p className="text-xs">View role details</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  {/* Row 2: the chips take the line the role description used
                      to occupy. The description is gone: it repeated what the
                      role page says and pushed the cards to three lines. */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isHighest && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs border cursor-default"
                            style={{ fontWeight: 500, backgroundColor: "#ECFDF5", color: "#059669", borderColor: "#A7F3D0" }}
                          >
                            Highest Priority
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[240px] text-center" style={{ fontSize: "12px", fontWeight: 450, lineHeight: "1.45" }}>
                          {highestTooltip}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs border"
                      style={{ fontWeight: 500, backgroundColor: "#F1F5F9", color: "#475569", borderColor: "#CBD5E1" }}
                    >
                      {roleType}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}
    </div>
  );
}

// ─── Inheritance data helper ────────────────────────────────────────────────

type GrantedVia = {
  type: "role" | "direct" | "both";
  roles: string[];
};

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** How a user actually holds the permission: through the roles they are in,
 *  directly, or both. Same derivation as the Assigned Roles listing beside it,
 *  so the two can never disagree. */
function getGrantedVia(userId: number, permissionId: string): GrantedVia {
  return getPermissionSourceForUser(userId, permissionId);
}

// ─── Threshold mock data helper ─────────────────────────────────────────────

const THRESHOLD_VALUES_BY_TYPE: Record<string, string[]> = {
  monetary: ["25,000", "50,000", "100,000", "250,000", ""],
  percentage: ["5", "10", "15", "25", ""],
  quantity: ["5", "10", "25", "50", ""],
};

function getRoleThresholdValue(
  roleId: number,
  permissionId: string,
  config: ThresholdConfig
): string | null {
  if (config.type === "descriptive") return null;
  const h = hashCode(`${roleId}-${permissionId}-threshold`);
  const values = THRESHOLD_VALUES_BY_TYPE[config.type] || [""];
  const val = values[h % values.length];
  return val; // empty string means "No limit"
}

function getUserEffectiveThreshold(
  userId: number,
  permissionId: string,
  config: ThresholdConfig
): string | null {
  if (config.type === "descriptive") return null;
  const h = hashCode(`${userId}-${permissionId}-user-threshold`);
  const values = THRESHOLD_VALUES_BY_TYPE[config.type] || [""];
  const val = values[h % values.length];
  return val;
}

function formatThresholdValue(val: string, config: ThresholdConfig): string {
  if (!val) return "No limit";
  if (config.unitPosition === "prefix") return `${config.unit}${val}`;
  return `${val} ${config.unit}`;
}

/** Override store key for an edited threshold (role/user × permission). */
function thresholdOverrideKey(
  entityType: "role" | "user",
  entityId: number,
  permissionId: string
): string {
  return `${entityType}-${entityId}-${permissionId}`;
}

type ThresholdOverrides = Record<string, string>;
type EditThresholdFn = (
  entityName: string,
  entityType: "role" | "user",
  currentValue: string,
  entityId: number
) => void;

// ─── Edit Threshold Modal ───────────────────────────────────────────────────

interface EditThresholdModalProps {
  open: boolean;
  onClose: () => void;
  entityName: string;
  entityType: "role" | "user";
  config: ThresholdConfig;
  currentValue: string;
  onSave: (newValue: string) => void;
}

function EditThresholdModal({
  open,
  onClose,
  entityName,
  entityType,
  config,
  currentValue,
  onSave,
}: EditThresholdModalProps) {
  const [value, setValue] = useState(currentValue);
  const [noLimit, setNoLimit] = useState(!currentValue);

  useEffect(() => {
    if (open) {
      setValue(currentValue);
      setNoLimit(!currentValue);
    }
  }, [open, currentValue]);

  if (!open) return null;

  const handleSave = () => {
    onSave(noLimit ? "" : value);
    onClose();
    toast.success(entityType === "role" ? "Threshold saved." : "Override saved.");
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[80] bg-black/30"
        onClick={onClose}
      />
      <div
        className="fixed z-[80] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl border border-gray-200 overflow-hidden"
        style={{
          width: 500,
          maxWidth: "calc(100vw - 48px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header, white fill */}
        <div className="px-5 pt-5 pb-4 border-b border-[#E2E8F0] bg-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#EFF6FF" }}
              >
                <Gauge className="w-[18px] h-[18px]" style={{ color: "#007FFF" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "15px", fontWeight: 650, color: "#0F172A" }}>
                  Edit Threshold
                </h3>
                <p className="text-[12.5px] mt-0.5" style={{ color: "#64748B", fontWeight: 400 }}>
                  {entityType === "role" ? "Role" : "User"}: {entityName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-[8px] flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" style={{ color: "#64748B" }} />
            </button>
          </div>
        </div>

        {/* Body, slate-50 fill */}
        <div className="px-5 py-5 space-y-4" style={{ backgroundColor: "#F8FAFC" }}>
          <div>
            <p className="text-[13px] mb-1" style={{ fontWeight: 600, color: "#0F172A" }}>
              {config.label}
            </p>
            <p className="text-[12.5px]" style={{ color: "#475569", fontWeight: 400, lineHeight: "1.5" }}>
              {config.description}
            </p>
          </div>

          {/* No limit toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={noLimit}
              onClick={() => {
                setNoLimit(!noLimit);
                if (!noLimit) setValue("");
              }}
              className={cn(
                "relative inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-full transition-colors duration-200 outline-none cursor-pointer",
                noLimit ? "bg-[#007FFF]" : "bg-gray-200"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none block h-[16px] w-[16px] rounded-full bg-white shadow-sm transition-transform duration-200",
                  noLimit ? "translate-x-[20px]" : "translate-x-[2px]"
                )}
              />
            </button>
            <span
              className="text-[13px]"
              style={{ fontWeight: 500, color: noLimit ? "#0F172A" : "#475569" }}
            >
              No limit
            </span>
          </label>

          {/* Value input, kept visible at all times; disabled (not removed)
              while "No limit" is on. */}
          <div className="relative">
            {config.unitPosition === "prefix" && (
              <span
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px]"
                style={{ fontWeight: 500, color: noLimit ? "#94A3B8" : "#475569" }}
              >
                {config.unit}
              </span>
            )}
            <input
              type="text"
              value={noLimit ? "" : value}
              disabled={noLimit}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9,.]/g, "");
                setValue(raw);
              }}
              className={cn(
                "w-full h-11 border rounded-[8px] text-[14px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all",
                config.unitPosition === "prefix" ? "pl-8 pr-3.5" : "pl-3.5 pr-14",
                noLimit && "cursor-not-allowed"
              )}
              style={{
                fontWeight: 550,
                borderColor: "#CBD5E1",
                backgroundColor: noLimit ? "#F1F5F9" : "#FFFFFF",
                color: noLimit ? "#94A3B8" : "#0F172A",
              }}
              placeholder={noLimit ? "No limit" : "Enter value"}
              autoFocus={!noLimit}
            />
            {config.unitPosition === "suffix" && (
              <span
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px]"
                style={{ fontWeight: 500, color: noLimit ? "#94A3B8" : "#475569" }}
              >
                {config.unit}
              </span>
            )}
          </div>

          {/* Helper text */}
          <p
            className="text-[12px]"
            style={{ fontWeight: 400, color: "#64748B", lineHeight: "1.5" }}
          >
            {config.helperText}
          </p>
        </div>

        {/* Footer, white fill */}
        <div
          className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t"
          style={{ borderColor: "#E2E8F0", backgroundColor: "#FFFFFF" }}
        >
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] text-[#334155] cursor-pointer hover:bg-[#F8FAFC] transition-colors"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="h-9 px-4 rounded-[8px] text-[13px] text-white cursor-pointer transition-colors"
            style={{ backgroundColor: "#007FFF", fontWeight: 600 }}
          >
            Save Threshold
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Interactive Threshold Cell ─────────────────────────────────────────────

function ThresholdCell({
  value,
  config,
  entityName,
  entityType,
  entityId,
  onEdit,
}: {
  value: string | null;
  config: ThresholdConfig;
  entityName: string;
  entityType: "role" | "user";
  entityId: number;
  onEdit: EditThresholdFn;
}) {
  if (value === null) return null;
  const formatted = formatThresholdValue(value, config);
  const isNoLimit = !value;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onEdit(entityName, entityType, value, entityId);
      }}
      className="group/thresh flex items-center gap-1.5 px-2 py-1 -mx-2 -my-1 rounded-md hover:bg-[#ECFDF5] transition-all cursor-pointer text-left w-full"
    >
      <span
        className="text-sm flex-1 min-w-0 truncate"
        style={{
          fontWeight: isNoLimit ? 400 : 500,
          color: isNoLimit ? "#94A3B8" : "#059669",
          fontStyle: isNoLimit ? "italic" : "normal",
        }}
      >
        {formatted}
      </span>
      <Pencil
        className="w-3 h-3 shrink-0 opacity-0 group-hover/thresh:opacity-100 transition-opacity"
        style={{ color: "#059669" }}
      />
    </button>
  );
}

function UserThresholdCell({
  value,
  config,
  entityName,
  entityType,
  entityId,
  onEdit,
}: {
  value: string | null;
  config: ThresholdConfig;
  entityName: string;
  entityType: "role" | "user";
  entityId: number;
  onEdit: EditThresholdFn;
}) {
  if (value === null) return null;
  const formatted = formatThresholdValue(value, config);
  const isNoLimit = !value;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onEdit(entityName, entityType, value, entityId);
      }}
      className="group/thresh flex items-center gap-1.5 px-2 py-1 -mx-2 -my-1 rounded-md hover:bg-[#ECFDF5] transition-all cursor-pointer text-left w-full"
    >
      <span
        className="text-sm flex-1 min-w-0 truncate"
        style={{
          fontWeight: isNoLimit ? 400 : 500,
          color: isNoLimit ? "#94A3B8" : "#059669",
          fontStyle: isNoLimit ? "italic" : "normal",
        }}
      >
        {formatted}
      </span>
      <Pencil
        className="w-3 h-3 shrink-0 opacity-0 group-hover/thresh:opacity-100 transition-opacity"
        style={{ color: "#059669" }}
      />
    </button>
  );
}

// ─── Per-permission subset helper ───────────────���───────────────────────────

/**
 * Who actually holds a permission, for the "Roles & Users with This Permission"
 * panel. Derivation lives in data/permission-holders.ts, which reads the real
 * role bundles, role memberships, and direct grants. This used to pick 3 to 5
 * roles and 8 to 14 users from a hash of the permission id, so the panel listed
 * holders that did not hold it and contradicted the role detail page one click
 * away.
 */
function getAssignedSubsets(permissionId: string): {
  assignedRoles: RoleRow[];
  assignedUsers: UserRow[];
} {
  return {
    assignedRoles: getRolesWithPermission(permissionId),
    assignedUsers: getUsersWithPermission(permissionId),
  };
}

// ─── Inline Granted Via cell (flat list with overflow) ───────────────────────

function RoleHoverPopover({ roleName }: { roleName: string }) {
  const role = roles.find((r) => r.roleName === roleName);
  if (!role) return <span className="inline-flex items-center shrink-0 px-2 py-0.5 rounded-md border border-[#E2E8F0] bg-[#F8FAFC]" style={{ fontSize: "12px", fontWeight: 480, color: "#475569", lineHeight: "1.4" }}>{roleName}</span>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center shrink-0 px-2 py-0.5 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] cursor-pointer hover:border-[#CBD5E1] hover:bg-[#F1F5F9] transition-colors"
          style={{ fontSize: "12px", fontWeight: 480, color: "#475569", lineHeight: "1.4" }}
        >
          {roleName}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        sideOffset={4}
        className="p-0 w-[240px]"
      >
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>{role.roleName}</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full border"
              style={
                role.isSystem
                  ? { fontWeight: 550, backgroundColor: "#F5F3FF", color: "#5B21B6", borderColor: "#DDD6FE" }
                  : { fontWeight: 550, backgroundColor: "#EDF4FF", color: "#007FFF", borderColor: "#B4D7FF" }
              }
            >
              {role.isSystem ? "System" : "Custom"}
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "#64748B", fontWeight: 400 }}>
            {role.usersCount} user{role.usersCount !== 1 ? "s" : ""} assigned
          </p>
          <a
            href={`/company-settings/user-access-control/role/${role.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[#007FFF] hover:underline"
            style={{ fontSize: "12px", fontWeight: 500 }}
            onClick={(e) => e.stopPropagation()}
          >
            View Role <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function InlineGrantedViaCell({
  grantedVia,
}: {
  grantedVia: GrantedVia;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState<number | null>(null);

  const allSources = useMemo(() => {
    const sources: { label: string; isDirect: boolean }[] = [];
    if (grantedVia.type === "direct" || grantedVia.type === "both") {
      sources.push({ label: "Direct Assignment", isDirect: true });
    }
    const sortedRoles = [...grantedVia.roles].sort((a, b) => a.localeCompare(b));
    sortedRoles.forEach((r) => sources.push({ label: r, isDirect: false }));
    return sources;
  }, [grantedVia]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const children = el.querySelectorAll<HTMLElement>("[data-chip]");
      if (children.length === 0) {
        setVisibleCount(allSources.length);
        return;
      }

      const containerRight = el.getBoundingClientRect().right;
      const reservedSpace = 70;
      let count = 0;

      for (let i = 0; i < children.length; i++) {
        const chipRight = children[i].getBoundingClientRect().right;
        if (chipRight <= containerRight - (i < allSources.length - 1 ? reservedSpace : 0)) {
          count++;
        } else {
          break;
        }
      }

      setVisibleCount(Math.max(1, count));
    };

    requestAnimationFrame(measure);
  }, [allSources]);

  const shown = visibleCount ?? allSources.length;
  const overflowItems = allSources.slice(shown);

  return (
    <div ref={containerRef} className="flex items-center gap-1.5 min-w-0 overflow-hidden py-0.5">
      {allSources.map((source, i) => (
        source.isDirect ? (
          <Tooltip key="direct">
            <TooltipTrigger asChild>
              <span
                data-chip
                className="inline-flex items-center shrink-0 px-2 py-0.5 rounded-md border cursor-default"
                style={{
                  fontSize: "12px",
                  fontWeight: 580,
                  color: "#007FFF",
                  lineHeight: "1.4",
                  borderColor: "#B4D7FF",
                  backgroundColor: "#EDF4FF",
                  display: visibleCount !== null && i >= shown ? "none" : undefined,
                }}
              >
                Direct Assignment
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" sideOffset={4} className="max-w-[260px] z-[9999]">
              <p className="text-xs">
                Granted to this user directly, not through a role. It stays even if their roles change, and is removed from the Users tab.
              </p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span
            key={source.label}
            data-chip
            style={{ display: visibleCount !== null && i >= shown ? "none" : undefined }}
          >
            <RoleHoverPopover roleName={source.label} />
          </span>
        )
      ))}
      {overflowItems.length > 0 && (
        <OverflowTooltip
          items={overflowItems.map((s) => ({ id: s.label, name: s.label }))}
          category="Sources"
        >
          <span
            className="inline-flex items-center shrink-0 px-2 py-0.5 rounded-md cursor-pointer hover:bg-[#EDF4FF] transition-colors"
            style={{
              fontSize: "12px",
              fontWeight: 520,
              color: "#007FFF",
              lineHeight: "1.4",
              border: "1px solid #B4D7FF",
              backgroundColor: "#F0F7FF",
            }}
          >
            +{overflowItems.length} more
          </span>
        </OverflowTooltip>
      )}
    </div>
  );
}

/** Can this permission be removed from this role from the listing?
 *  Only custom roles: a predefined role's permission set is system-managed.
 *  Archived roles are excluded because `rolesFilterPredicate` hides them from
 *  every quick filter, so they are never a row anyone can act on. */
function isRoleRemovable(role: RoleRow): boolean {
  return !role.isSystem && role.status !== "Archived";
}

// ─── Remove-permission action: red X icon with a white tooltip ─────────────

function RemovePermissionAction({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label={label}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="bg-white text-[#334155] border border-[#E2E8F0] shadow-md text-xs z-[9999]"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function UserRowActions({
  user,
  onRemove,
}: {
  user: UserRow;
  onRemove?: (user: UserRow) => void;
}) {
  /* An Account Owner's permissions are fixed for everyone, the owner
   * included (UAC Spec, Roles, Section 11, Rule 3; ERP-5164 AC8), so the
   * permission side offers no way to remove one either. */
  if (isAccountOwner(user.id)) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-label={ACCOUNT_OWNER_COPY.permissionsFixed}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-[#CBD5E1] cursor-not-allowed"
          >
            <Lock className="w-3.5 h-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[260px] bg-white text-[#334155] border border-[#E2E8F0] shadow-md text-xs z-[9999]"
        >
          {ACCOUNT_OWNER_COPY.permissionsFixed}
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <RemovePermissionAction
      label="Remove Permission"
      onRemove={() =>
        onRemove
          ? onRemove(user)
          : toast.success(`Permission removed from ${user.fullName}.`)
      }
    />
  );
}

/* Predefined roles are system-managed: their permission set can't be changed,
 * so there is no row action to offer. A muted dash keeps the column aligned
 * and reads as "nothing to do here" instead of dangling a blocked button. */
function RoleRowActions({ role, onRemove }: { role: RoleRow; onRemove?: (role: RoleRow) => void }) {
  if (!isRoleRemovable(role)) {
    return (
      <span
        className="inline-flex items-center justify-center h-8 w-8 text-[13px] select-none text-muted-foreground/50"
        aria-label="No actions available"
      >
        –
      </span>
    );
  }
  return (
    <RemovePermissionAction
      label="Remove Permission"
      onRemove={() =>
        onRemove
          ? onRemove(role)
          : toast.success(`Permission removed from ${role.roleName}.`)
      }
    />
  );
}

// ─── User Detail Popout (inheritance chain) ──────��─────────────────���────────

function UserDetailPopout({
  user,
  grantedVia,
  onClose,
}: {
  user: UserRow;
  grantedVia: GrantedVia;
  onClose: () => void;
}) {
  const tint = getAvatarTint(user.fullName);
  const initials = getInitials(user.fullName);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[80]" onClick={onClose} />
      <div
        className="fixed z-[80] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl border border-gray-200 shadow-xl p-0 overflow-hidden"
        style={{ width: 420, maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 text-xs"
              style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 600 }}
            >
              {initials}
            </div>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A" }}>{user.fullName}</p>
              <p style={{ fontSize: "12px", fontWeight: 400, color: "#64748B" }}>{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4">
          {/* Inheritance Chain */}
          <div>
            <h4
              className="text-gray-500 mb-3"
              style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}
            >
              Permission Inheritance
            </h4>
            <div className="space-y-2">
              {/* Direct Assignment first, it always takes highest priority */}
              {(grantedVia.type === "direct" || grantedVia.type === "both") && (
                <div className="flex items-center gap-3 p-3 bg-[#FFF7ED] rounded-[8px] border border-[#FED7AA]">
                  <div className="w-8 h-8 rounded-[8px] bg-white flex items-center justify-center shrink-0 border border-[#FED7AA]/50">
                    <Users className="w-4 h-4 text-[#C2410C]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: "13px", fontWeight: 550, color: "#9A3412" }}>Direct Assignment</p>
                    <p style={{ fontSize: "11.5px", fontWeight: 400, color: "#C2410C" }}>Highest priority, overrides role inheritance</p>
                  </div>
                  <span
                    className="shrink-0 px-2 py-0.5 rounded"
                    style={{ fontSize: "11px", fontWeight: 600, backgroundColor: "#EEF2FF", color: "#6366F1" }}
                  >
                    Highest Priority
                  </span>
                </div>
              )}
              {grantedVia.roles.map((role) => (
                <div
                  key={role}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-[8px] border border-gray-100"
                >
                  <div className="w-8 h-8 rounded-[8px] bg-[#EDF4FF] flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-[#007FFF]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: "13px", fontWeight: 550, color: "#1E293B" }}>{role}</p>
                    <p style={{ fontSize: "11.5px", fontWeight: 400, color: "#94A3B8" }}>Inherited via role</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span style={{ fontSize: "12.5px", fontWeight: 500, color: "#64748B" }}>License</span>
              <LicenseBadge license={user.license} />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span style={{ fontSize: "12.5px", fontWeight: 500, color: "#64748B" }}>Status</span>
              <StatusBadge status={user.status} />
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Inline table for assigned roles/users in permission detail ─────────────

/** Compact quick filters for roles tables inside the permission modal */
const PERM_ROLES_QUICK_FILTERS: QuickFilterDef[] = [
  { key: "all", label: "Show All", showCount: false },
  { key: "system", label: "Predefined", showCount: true },
  { key: "custom", label: "Custom", showCount: true },
];

/** Quick filters for users tables inside the permission modal: source type */
const PERM_USERS_QUICK_FILTERS: QuickFilterDef[] = [
  { key: "all", label: "Show All", showCount: false },
  { key: "direct", label: "Direct Assignment", showCount: true },
  { key: "inherited", label: "Inherited", showCount: true },
];

// Simplified roles columns for permission context
// ─── Scope cell (Manage Roles permission) ─────────────────────────────────
function getScopeDecorationColor(mode: "all" | "selected", roleIds: number[]): string {
  if (mode === "all") return "#059669";
  if (!roleIds || roleIds.length === 0) return "#DC2626";
  return "#007FFF";
}

function RoleScopeCell({ roleId }: { roleId: number }) {
  const cfg = useSyncExternalStore(
    subscribeRoleManageScope,
    () => getRoleManageScope(roleId),
    () => getRoleManageScope(roleId),
  );
  const [open, setOpen] = useState(false);
  const roleName = roles.find((r) => r.id === roleId)?.roleName;
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="text-left max-w-full hover:underline cursor-pointer"
        style={{ textDecorationColor: getScopeDecorationColor(cfg.mode, cfg.manageRoleIds) }}
      >
        <ManageScopeDisplay mode={cfg.mode} roleIds={cfg.manageRoleIds} />
      </button>
      <ConfigureRoleScopeModal
        open={open}
        onClose={() => setOpen(false)}
        roleId={roleId}
        roleName={roleName}
      />
    </>
  );
}

function UserScopeCell({ userId }: { userId: number }) {
  const cfg = useSyncExternalStore(
    subscribeManageRolesScope,
    () => getManageRolesConfig(userId),
    () => getManageRolesConfig(userId),
  );
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="text-left max-w-full hover:underline cursor-pointer"
        style={{ textDecorationColor: getScopeDecorationColor(cfg.mode, cfg.manageRoleIds) }}
      >
        <ManageScopeDisplay mode={cfg.mode} roleIds={cfg.manageRoleIds} />
      </button>
      <ConfigureManageRolesModal
        open={open}
        onClose={() => setOpen(false)}
        userId={userId}
        assignedRoleIds={[]}
      />
    </>
  );
}

function ManageScopeDisplay({ mode, roleIds }: { mode: "all" | "selected"; roleIds: number[] }) {
  if (mode === "all") {
    return (
      <span className="text-[13px]" style={{ fontWeight: 600, color: "#059669" }}>
        All roles
      </span>
    );
  }
  if (!roleIds || roleIds.length === 0) {
    return (
      <span className="text-[13px]" style={{ fontWeight: 500, color: "#DC2626" }}>
        Not configured
      </span>
    );
  }
  const named = roleIds
    .map((id) => roles.find((r) => r.id === id))
    .filter((r): r is RoleRow => Boolean(r));
  if (named.length === 0) {
    return (
      <span className="text-[13px]" style={{ fontWeight: 500, color: "#DC2626" }}>
        Not configured
      </span>
    );
  }
  const first = named[0];
  const overflow = named.slice(1);
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span
        className="text-[13px] truncate max-w-[150px]"
        style={{ fontWeight: 500, color: "#1E293B" }}
      >
        {first.roleName}
      </span>
      {overflow.length > 0 && (
        <OverflowTooltip
          items={overflow.map((r) => ({ id: String(r.id), name: r.roleName, href: `/company-settings/user-access-control/role/${r.id}` }))}
          category="Roles"
        >
          <span
            className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded-md text-[12px]"
            style={{ fontWeight: 500, color: "#007FFF" }}
          >
            +{overflow.length} more
          </span>
        </OverflowTooltip>
      )}
    </div>
  );
}

function getPermissionRolesColumns(
  permissionId?: string,
  thresholdConfig?: ThresholdConfig,
  onEditThreshold?: EditThresholdFn,
  thresholdOverrides?: ThresholdOverrides
): ColumnDef<RoleRow>[] {
  const isManageRoles = permissionId === "ur-manage-roles";
  const cols: ColumnDef<RoleRow>[] = [
    {
      key: "role_name",
      label: "Role Name",
      width: 200,
      stickyLeft: true,
      render: (row, { highlightText, density }) => (
        <div className="flex items-center gap-1.5 min-w-0">
          {row.isSystem && <SystemRoleLock size={13} />}
          <LinkedRoleName
            roleId={row.id}
            className={`${density === "comfort" ? "text-[13.5px]" : "text-sm"} truncate max-w-[170px] block`}
            style={{ fontWeight: 500, color: "#1E293B" }}
          >
            {highlightText(row.roleName)}
          </LinkedRoleName>
        </div>
      ),
    },
    {
      key: "users",
      label: "Users",
      width: 100,
      render: (row, { density }) => (
        <RoleUsersPopover roleId={row.id} usersCount={row.usersCount} comfort={density === "comfort"} />
      ),
    },
    ...(isManageRoles
      ? [
          {
            key: "scope",
            label: "Scope",
            width: 220,
            render: (row: RoleRow) => <RoleScopeCell roleId={row.id} />,
          } as ColumnDef<RoleRow>,
        ]
      : []),
    {
      key: "license_required",
      label: "License Required",
      width: 140,
      render: (row) => <LicenseBadge license={row.licenseRequired} />,
    },
  ];

  // Threshold column, editable values when config exists, "-" otherwise.
  // Hidden behind SHOW_PERMISSION_THRESHOLDS, see lib/feature-flags.ts.
  if (SHOW_PERMISSION_THRESHOLDS && thresholdConfig && thresholdConfig.type !== "descriptive" && permissionId) {
    const pId = permissionId;
    const tConfig = thresholdConfig;
    cols.push({
      key: "threshold",
      label: (
        <span className="inline-flex items-center gap-1.5">
          <Gauge className="w-3 h-3" style={{ color: "#059669" }} />
          Threshold
        </span>
      ),
      width: 150,
      render: (row) => {
        const oKey = thresholdOverrideKey("role", row.id, pId);
        const val = thresholdOverrides && oKey in thresholdOverrides
          ? thresholdOverrides[oKey]
          : getRoleThresholdValue(row.id, pId, tConfig);
        if (onEditThreshold) {
          return (
            <ThresholdCell
              value={val}
              config={tConfig}
              entityName={row.roleName}
              entityType="role"
              entityId={row.id}
              onEdit={onEditThreshold}
            />
          );
        }
        if (val === null) return null;
        const formatted = formatThresholdValue(val, tConfig);
        const isNoLimit = !val;
        return (
          <span
            className="text-sm"
            style={{
              fontWeight: isNoLimit ? 400 : 500,
              color: isNoLimit ? "#94A3B8" : "#059669",
              fontStyle: isNoLimit ? "italic" : "normal",
            }}
          >
            {formatted}
          </span>
        );
      },
    });
  }

  cols.push({
    key: "status",
    label: "Status",
    width: 120,
    render: (row) => (
      <StatusBadge
        status={row.status}
        configMap={{
          Active: { bg: "#ECFDF5", text: "#059669", dot: "#10B981" },
          Inactive: { bg: "#FFFBEB", text: "#D97706", dot: "#F59E0B", label: "Deactivated" },
          Draft: { bg: "#F8FAFC", text: "#64748B", dot: "#94A3B8" },
          Archived: { bg: "#FEF2F2", text: "#DC2626", dot: "#EF4444" },
        }}
      />
    ),
  });

  return cols;
}

// Simplified users columns for permission context: just Full Name + Granted Via + optional Threshold
function getPermissionUsersColumns(
  permissionId: string,
  thresholdConfig?: ThresholdConfig,
  onEditThreshold?: EditThresholdFn,
  thresholdOverrides?: ThresholdOverrides
): ColumnDef<UserRow>[] {
  const isManageRoles = permissionId === "ur-manage-roles";
  const cols: ColumnDef<UserRow>[] = [
    {
      key: "full_name",
      label: "Full Name",
      width: 220,
      stickyLeft: true,
      render: (row, { highlightText, density }) => (
        <AvatarCell
          name={row.fullName}
          nameNode={highlightText(row.fullName)}
          avatarUrl={USER_AVATAR_MAP[row.id]}
          userId={row.id}
          comfort={density === "comfort"}
        />
      ),
    },
    {
      key: "granted_via",
      label: "Granted Via",
      width: 300,
      render: (row) => {
        const gv = getGrantedVia(row.id, permissionId);
        return <InlineGrantedViaCell grantedVia={gv} />;
      },
    },
    ...(isManageRoles
      ? [
          {
            key: "scope",
            label: "Scope",
            width: 220,
            render: (row: UserRow) => <UserScopeCell userId={row.id} />,
          } as ColumnDef<UserRow>,
        ]
      : []),
  ];

  // Threshold column for users, editable values when config exists, "-" otherwise.
  // Hidden behind SHOW_PERMISSION_THRESHOLDS, see lib/feature-flags.ts.
  if (SHOW_PERMISSION_THRESHOLDS && thresholdConfig && thresholdConfig.type !== "descriptive") {
    const tConfig = thresholdConfig;
    const pId = permissionId;
    cols.push({
      key: "threshold",
      label: (
        <span className="inline-flex items-center gap-1.5">
          <Gauge className="w-3 h-3" style={{ color: "#059669" }} />
          Threshold
        </span>
      ),
      width: 160,
      render: (row) => {
        const oKey = thresholdOverrideKey("user", row.id, pId);
        const val = thresholdOverrides && oKey in thresholdOverrides
          ? thresholdOverrides[oKey]
          : getUserEffectiveThreshold(row.id, pId, tConfig);
        if (onEditThreshold) {
          return (
            <UserThresholdCell
              value={val}
              config={tConfig}
              entityName={row.fullName}
              entityType="user"
              entityId={row.id}
              onEdit={onEditThreshold}
            />
          );
        }
        if (val === null) return null;
        const formatted = formatThresholdValue(val, tConfig);
        const isNoLimit = !val;
        return (
          <span
            className="text-sm"
            style={{
              fontWeight: isNoLimit ? 400 : 500,
              color: isNoLimit ? "#94A3B8" : "#059669",
              fontStyle: isNoLimit ? "italic" : "normal",
            }}
          >
            {formatted}
          </span>
        );
      },
    });
  }

  return cols;
}

// ─── (ActivityLogAction removed, now part of 3-dot DropdownMenu) ───────────

// ─── Expanded View Modal ────────────────────────────────────────────────────

function ExpandedListModal({
  open,
  onClose,
  mode,
  permissionId,
  rolesData,
  usersData,
  thresholdConfig,
  onEditThreshold,
  thresholdOverrides,
  onRemoveRole,
  onRemoveUser,
  onBulkRemove,
}: {
  open: boolean;
  onClose: () => void;
  mode: "roles" | "users";
  permissionId: string;
  rolesData: RoleRow[];
  usersData: UserRow[];
  thresholdConfig?: ThresholdConfig;
  onEditThreshold?: EditThresholdFn;
  thresholdOverrides?: ThresholdOverrides;
  /* Removal is owned by the parent so the full-screen list and the inline
   * list share one confirmation flow and one source of truth. Without these
   * the expanded list only toasted and the row stayed put. */
  onRemoveRole?: (role: RoleRow) => void;
  onRemoveUser?: (user: UserRow) => void;
  onBulkRemove?: (target: "roles" | "users", ids: number[], clearSelection: () => void) => void;
}) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  useEffect(() => {
    if (open) {
      setIsClosing(false);
    }
  }, [open]);

  const getRoleRowId = useCallback((row: RoleRow) => row.id, []);
  const getUserRowId = useCallback((row: UserRow) => row.id, []);

  const expandedUsersFilterPredicate = useCallback((row: UserRow, filterKey: string) => {
    const gv = getGrantedVia(row.id, permissionId);
    if (filterKey === "direct") return gv.type === "direct" || gv.type === "both";
    if (filterKey === "inherited") return gv.type === "role" || gv.type === "both";
    return true;
  }, [permissionId]);

  const permRolesColumns = useMemo(
    () => getPermissionRolesColumns(permissionId, thresholdConfig, onEditThreshold, thresholdOverrides),
    [permissionId, thresholdConfig, onEditThreshold, thresholdOverrides]
  );
  const permUsersColumns = useMemo(
    () => getPermissionUsersColumns(permissionId, thresholdConfig, onEditThreshold, thresholdOverrides),
    [permissionId, thresholdConfig, onEditThreshold, thresholdOverrides]
  );

  const renderRoleAction = useCallback(
    (row: RoleRow) => <RoleRowActions role={row} onRemove={onRemoveRole} />,
    [onRemoveRole]
  );
  const renderUserAction = useCallback(
    (row: UserRow) => <UserRowActions user={row} onRemove={onRemoveUser} />,
    [onRemoveUser]
  );

  /* Mirrors the inline list: predefined roles are system-managed, so removal
   * only ever applies to the custom subset of the selection. */
  const rolesRemovable = useMemo(() => rolesData.some(isRoleRemovable), [rolesData]);

  const expandedRolesBulkSlot = useCallback(
    (selectedCount: number, selectedIds: Set<number | string>, onCancel: () => void) => {
      const selected = rolesData.filter((r) => selectedIds.has(r.id));
      const eligible = selected.filter(isRoleRemovable);
      const predefinedCount = selected.length - eligible.length;
      const disabled = eligible.length === 0;
      const tooltip = disabled
        ? "Predefined roles can't have permissions removed. Their permissions are managed by the system and can't be changed."
        : predefinedCount > 0
          ? `${predefinedCount} predefined role${predefinedCount !== 1 ? "s" : ""} will be excluded. Predefined role permissions are managed by the system and can't be changed; only the ${eligible.length} eligible role${eligible.length !== 1 ? "s" : ""} will have this permission removed.`
          : undefined;

      const removeButton = (
        <button
          onClick={() => {
            if (disabled) return;
            onBulkRemove?.("roles", eligible.map((r) => r.id), onCancel);
          }}
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-[6px] border text-[12px] transition-colors",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
          )}
          style={{ fontWeight: 500, color: "#DC2626", borderColor: "#FECACA", backgroundColor: "white" }}
          onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = "#FEF2F2"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "white"; }}
        >
          <Trash2 className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
          Remove Permission
          {predefinedCount > 0 && (
            <Info className="w-3.5 h-3.5 ml-0.5" style={{ color: "#DC2626", opacity: 0.7 }} />
          )}
        </button>
      );

      return (
        <div
          className="flex items-center gap-2 px-4 pb-3 shrink-0"
          style={{ background: "linear-gradient(to top, #F0F7FF 0%, #FFFFFF 100%)" }}
        >
          <div className="flex items-center gap-1.5">
            {tooltip ? (
              <Tooltip>
                {/* Disabled buttons swallow pointer events, so the trigger
                    wraps the button in a span that still receives hover. */}
                <TooltipTrigger asChild>
                  <span className="inline-flex">{removeButton}</span>
                </TooltipTrigger>
                {/* The tooltip portals to the body while this bar lives inside
                    a z-[60]/z-[70] modal, so it needs to outrank it or it
                    renders behind the modal and never appears. */}
                <TooltipContent
                  side="top"
                  sideOffset={6}
                  className="bg-white text-[#334155] border border-[#E2E8F0] shadow-md text-xs z-[9999] max-w-[320px] leading-relaxed"
                >
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            ) : (
              removeButton
            )}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2.5">
            <span className="text-[13px]" style={{ fontWeight: 600, color: "#007FFF" }}>{selectedCount} selected</span>
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] border text-[12px] transition-colors cursor-pointer"
              style={{ fontWeight: 500, color: "#64748B", borderColor: "#CBD5E1", backgroundColor: "white" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#94A3B8"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#CBD5E1"; }}
            >
              ✕ Cancel
            </button>
          </div>
        </div>
      );
    },
    [rolesData, onBulkRemove]
  );

  const expandedUsersBulkSlot = useCallback(
    (selectedCount: number, selectedIds: Set<number | string>, onCancel: () => void, activeFilters: Set<string>) => {
      const directOnly = activeFilters.has("direct");
      return (
        <div
          className="flex items-center gap-2 px-4 pb-3 shrink-0"
          style={{ background: "linear-gradient(to top, #F0F7FF 0%, #FFFFFF 100%)" }}
        >
          <div className="flex items-center gap-1.5">
            {directOnly ? (
              <button
                onClick={() =>
                  onBulkRemove?.(
                    "users",
                    Array.from(selectedIds).map((v) => Number(v)),
                    onCancel
                  )
                }
                className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-[6px] border text-[12px] transition-colors cursor-pointer"
                style={{ fontWeight: 500, color: "#DC2626", borderColor: "#FECACA", backgroundColor: "white" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#FEF2F2"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "white"; }}
              >
                <Trash2 className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
                Remove Users
              </button>
            ) : (
              <span className="text-[12px]" style={{ fontWeight: 450, color: "#94A3B8" }}>
                No Bulk Actions Available
              </span>
            )}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2.5">
            <span className="text-[13px]" style={{ fontWeight: 600, color: "#007FFF" }}>{selectedCount} selected</span>
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] border text-[12px] transition-colors cursor-pointer"
              style={{ fontWeight: 500, color: "#64748B", borderColor: "#CBD5E1", backgroundColor: "white" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#94A3B8"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#CBD5E1"; }}
            >
              ✕ Cancel
            </button>
          </div>
        </div>
      );
    },
    [onBulkRemove]
  );

  if (!open && !isClosing) return null;

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-200 ${isClosing ? "opacity-0" : "opacity-100"}`}
        style={{ backgroundColor: "rgba(0, 0, 0, 0.35)", backdropFilter: "blur(4px)" }}
        onClick={handleClose}
      />
      <div
        className={`fixed inset-0 z-[70] flex items-center justify-center transition-all duration-200 ${
          isClosing ? "opacity-0 scale-[0.97]" : "opacity-100 scale-100"
        }`}
        style={{ pointerEvents: isClosing ? "none" : "auto" }}
      >
        <div
          className="bg-white flex flex-col overflow-hidden"
          style={{
            width: "100%",
            height: "100%",
            maxWidth: "calc(100% - 2rem)",
            maxHeight: "calc(100% - 2rem)",
            borderRadius: "16px",
            boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-5 pt-4 pb-3 shrink-0 bg-white border-b border-[#EEF2F6] flex items-center justify-between"
          >
            <div className="min-w-0">
              <h2 className="text-[17px] text-[#0F172A]" style={{ fontWeight: 700 }}>
                All {mode === "roles" ? "Roles" : "Users"}
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5" style={{ fontWeight: 400 }}>
                {mode === "roles"
                  ? `${rolesData.length} roles have this permission`
                  : `${usersData.length} users have this permission`}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {mode === "roles" ? (
              <DataTable<RoleRow>
                data={rolesData}
                columns={permRolesColumns}
                getRowId={getRoleRowId}
                searchPlaceholder="Search by role name..."
                searchPredicate={rolesSearchPredicate}
                quickFilters={PERM_ROLES_QUICK_FILTERS}
                filterPredicate={rolesFilterPredicate}
                showMeMode={false}
                emptyIcon={<Shield className="w-8 h-8" />}
                emptyMessage="No roles found"
                renderActions={rolesRemovable ? renderRoleAction : undefined}
                entityLabel="roles"
                hideDensity
                hideColumnSelector
                sortFn={sortRolesCustomFirst}
                rowGroupFn={roleGroupFn}
                rowGroupLabels={ROLE_GROUP_LABELS}
                hideSelection={!rolesRemovable}
                bulkActionsSlot={rolesRemovable ? expandedRolesBulkSlot : undefined}
                onRowClick={(row) => {
                  onClose();
                  window.location.href = `/company-settings/user-access-control/role/${row.id}`;
                }}
              />
            ) : (
              <DataTable<UserRow>
                data={usersData}
                columns={permUsersColumns}
                getRowId={getUserRowId}
                searchPlaceholder="Search by name..."
                searchPredicate={usersSearchPredicate}
                quickFilters={PERM_USERS_QUICK_FILTERS}
                filterPredicate={expandedUsersFilterPredicate}
                showMeMode={false}
                emptyIcon={<Users className="w-8 h-8" />}
                emptyMessage="No users found"
                renderActions={renderUserAction}
                entityLabel="users"
                hideDensity
                hideColumnSelector
                defaultDensity="condensed"
                bulkActionsSlot={expandedUsersBulkSlot}
                onRowClick={(row) => {
                  onClose();
                  window.location.href = `/company-settings/user-access-control/user/${row.id}`;
                }}
              />
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Add Roles/Users Modal (stacked overlay) ────────────────────────────────

function AddRolesUsersModal({
  open,
  onClose,
  mode,
  onAdd,
  excludeUserIds,
}: {
  open: boolean;
  onClose: () => void;
  mode: "roles" | "users";
  /** Called with the selected row ids when the user confirms Add. */
  onAdd?: (ids: (number | string)[]) => void;
  /** User ids already assigned to this permission, hidden from the picker so
   *  only not-yet-assigned users can be added. */
  excludeUserIds?: (number | string)[];
}) {
  const [isClosing, setIsClosing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<(number | string)[]>([]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  useEffect(() => {
    if (open) {
      setIsClosing(false);
      setIsFullScreen(false);
      setSelectedIds([]);
    }
  }, [open]);

  const getRoleRowId = useCallback((row: RoleRow) => row.id, []);
  const getUserRowId = useCallback((row: UserRow) => row.id, []);

  /* Slimmed, read-only column set for the Add Users picker: only the columns
     relevant to choosing a user, with License/Status as plain (non-interactive)
     chips, no chevron, no dropdown. */
  const addUsersColumns = useMemo(() => {
    const keep = new Set(["full_name", "assigned_roles", "license", "email", "status"]);
    return USERS_COLUMNS.filter((c) => keep.has(c.key)).map((c) => {
      if (c.key === "license") {
        return { ...c, render: (row: UserRow) => <LicenseBadge license={row.license} showNoLicense /> };
      }
      if (c.key === "status") {
        return { ...c, render: (row: UserRow) => <StatusBadge status={row.status} /> };
      }
      return c;
    });
  }, []);

  /* Addable users: exclude users already assigned to this permission, and never
   *  surface invite-expired or archived users in the picker. Account Owners are
   *  left out too: their permissions are fixed (ERP-5164 AC8). */
  const addableUsers = useMemo(() => {
    const excluded = new Set(excludeUserIds ?? []);
    return users.filter(
      (u) =>
        !excluded.has(u.id) &&
        u.status !== "Invite Expired" &&
        u.status !== "Archived" &&
        !isAccountOwner(u.id)
    );
  }, [excludeUserIds]);

  /* Drop the Invite Expired / Archived status chips, those users are never shown. */
  const addUsersQuickFilters = useMemo(
    () => USERS_QUICK_FILTERS.filter((f) => f.key !== "invite_expired" && f.key !== "archived"),
    []
  );

  if (!open && !isClosing) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-200 ${isClosing ? "opacity-0" : "opacity-100"}`}
        style={{ backgroundColor: "rgba(0, 0, 0, 0.35)", backdropFilter: "blur(4px)" }}
        onClick={handleClose}
      />
      {/* Modal */}
      <div
        className={`fixed inset-0 z-[70] flex items-center justify-center transition-all duration-200 ${
          isClosing ? "opacity-0 scale-[0.97]" : "opacity-100 scale-100"
        }`}
        style={{ pointerEvents: isClosing ? "none" : "auto" }}
      >
        <div
          className="bg-white flex flex-col overflow-hidden transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            width: "100%",
            height: "100%",
            maxWidth: isFullScreen ? "calc(100% - 2rem)" : "1320px",
            maxHeight: isFullScreen ? "calc(100% - 2rem)" : "min(900px, calc(100vh - 48px))",
            borderRadius: "16px",
            boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-4 lg:px-5 pt-4 pb-3 shrink-0 bg-white border-b border-[#EEF2F6] flex items-center justify-between"
            style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
          >
            <div className="min-w-0">
              <h2 className="text-[15px] sm:text-[17px] text-[#0F172A]" style={{ fontWeight: 700 }}>
                {mode === "roles" ? "Add Roles" : "Add Users"}
              </h2>
              <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5" style={{ fontWeight: 400 }}>
                {mode === "roles"
                  ? "Select roles to assign this permission to."
                  : "Select users to grant this permission to."}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {isFullScreen ? "Exit full" : "Full view"}
              </button>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body, full DataTable */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {mode === "roles" ? (
              <DataTable<RoleRow>
                data={roles}
                columns={ROLES_COLUMNS}
                getRowId={getRoleRowId}
                searchPlaceholder="Search by role name or description..."
                searchPredicate={rolesSearchPredicate}
                quickFilters={ROLES_QUICK_FILTERS}
                filterPredicate={rolesFilterPredicate}
                showMeMode={false}
                emptyIcon={<Shield className="w-8 h-8" />}
                emptyMessage="No roles found"
                entityLabel="roles"
                sortFn={sortRolesCustomFirst}
                rowGroupFn={roleGroupFn}
                rowGroupLabels={ROLE_GROUP_LABELS}
                selectedIds={selectedIds}
                onSelectedIdsChange={setSelectedIds}
              />
            ) : (
              <DataTable<UserRow>
                data={addableUsers}
                columns={addUsersColumns}
                getRowId={getUserRowId}
                searchPlaceholder="Search by name, type, or email..."
                searchPredicate={usersSearchPredicate}
                quickFilters={addUsersQuickFilters}
                filterPredicate={usersFilterPredicate}
                showMeMode
                emptyIcon={<Users className="w-8 h-8" />}
                emptyMessage="No users found"
                entityLabel="users"
                hideColumnSelector
                selectOnRowClick
                hideBulkBar
                selectedIds={selectedIds}
                onSelectedIdsChange={setSelectedIds}
              />
            )}
          </div>

          {/* Footer */}
          <div
            className="shrink-0 border-t border-[#EEF2F6] bg-white px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5"
            style={{ borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}
          >
            <button
              onClick={handleClose}
              className="inline-flex items-center justify-center px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] border border-[#E2E8F0] bg-white text-xs sm:text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onAdd?.(selectedIds);
                const n = selectedIds.length;
                toast.success(
                  mode === "roles"
                    ? `${n || ""} role${n === 1 ? "" : "s"} assigned successfully.`.trim()
                    : `${n || ""} user${n === 1 ? "" : "s"} assigned successfully.`.trim()
                );
                handleClose();
              }}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center gap-1.5 px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] bg-[#007FFF] hover:bg-[#0066D6] active:bg-[#005BBF] text-white shadow-sm transition-all cursor-pointer text-xs sm:text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontWeight: 600 }}
            >
              {mode === "roles" ? "Add Roles" : "Add Users"}
              {selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Assign Roles & Users ─────────────────────────────────────��─────────────

type AssignTab = "roles" | "users";

function AssignRolesAndUsers({
  title = "Roles & Users with This Permission",
  permissionId,
  showEmpty = false,
  thresholdConfig,
}: {
  title?: string;
  permissionId?: string;
  showEmpty?: boolean;
  thresholdConfig?: ThresholdConfig;
}) {
  const [activeTab, setActiveTab] = useState<AssignTab>("roles");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalMode, setAddModalMode] = useState<"roles" | "users">("roles");
  const [expandedMode, setExpandedMode] = useState<"roles" | "users" | null>(null);
  /* When a Full-Access permission is granted to Field User / No License users,
     prompt to upgrade their license (reuses the user-listing UpgradeLicenseModal). */
  const [pendingLicenseUpgrade, setPendingLicenseUpgrade] = useState<UserRow[] | null>(null);
  // Role-granted redirect modal target. Set when an admin tries to remove a
  // permission a user holds only through a role, the permission cannot be turned
  // off from here, so the modal points to the role. `sources` are the granting
  // role names shown under Granted Via.
  const [redirectTarget, setRedirectTarget] = useState<{ user: UserRow; sources: string[] } | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    type: "remove-role" | "remove-user-direct" | "remove-user-direct-role" | "role-granted" | "system-blocked" | "bulk-remove-roles" | "bulk-remove-users";
    roleName?: string;
    userName?: string;
    userRoles?: string[];
    usersCount?: number;
    bulkCount?: number;
    bulkAffectedUsers?: string[];
    permissionName?: string;
  } | null>(null);

  /* ─── Remove-Permission confirmation (new destructive-modal flow) ───
   * Used for both single-row remove and bulk remove on the Roles and Users
   * tabs. Distinct from the legacy `confirmModal` above, which still
   * handles informational/blocked edge cases (system role, inherited via
   * role, both direct+role). */
  const [permRemovalModal, setPermRemovalModal] = useState<{
    target: "roles" | "users";
    ids: number[];
    /** Captured DataTable onCancel so we can clear the selection after
     *  confirming a bulk action. Optional for per-row calls. */
    clearSelection?: () => void;
  } | null>(null);

  /* ─── Track removed rows locally so they disappear from the tab and the
   *     tab count updates after confirmation. Reset when the user navigates
   *     to a different permission. ─── */
  const [removedRoleIds, setRemovedRoleIds] = useState<Set<number>>(() => new Set());
  const [removedUserIds, setRemovedUserIds] = useState<Set<number>>(() => new Set());

  /* Roles/users added through the Add modals appear immediately in the tab. */
  const [addedRoleIds, setAddedRoleIds] = useState<Set<number>>(() => new Set());
  const [addedUserIds, setAddedUserIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setRemovedRoleIds(new Set());
    setRemovedUserIds(new Set());
    setAddedRoleIds(new Set());
    setAddedUserIds(new Set());
  }, [permissionId]);

  // Threshold editing state
  const [thresholdEditOpen, setThresholdEditOpen] = useState(false);
  const [thresholdEditEntity, setThresholdEditEntity] = useState<{
    id: number;
    name: string;
    type: "role" | "user";
    value: string;
  } | null>(null);
  // Saved threshold edits, keyed by entityType-entityId-permissionId.
  const [thresholdOverrides, setThresholdOverrides] = useState<ThresholdOverrides>({});

  const handleEditThreshold = useCallback<EditThresholdFn>(
    (entityName, entityType, currentValue, entityId) => {
      setThresholdEditEntity({ id: entityId, name: entityName, type: entityType, value: currentValue });
      setThresholdEditOpen(true);
    },
    []
  );

  // Get per-permission subsets
  const subsets = useMemo(() => {
    if (!permissionId) return null;
    return getAssignedSubsets(permissionId);
  }, [permissionId]);

  const baseDisplayedRoles = showEmpty ? [] : (subsets?.assignedRoles ?? roles);
  const baseDisplayedUsers = showEmpty ? [] : (subsets?.assignedUsers ?? users);
  const displayedRoles = useMemo(() => {
    const base = baseDisplayedRoles.filter((r) => !removedRoleIds.has(r.id));
    if (addedRoleIds.size === 0) return base;
    const baseIds = new Set(base.map((r) => r.id));
    const added = roles.filter((r) => addedRoleIds.has(r.id) && !baseIds.has(r.id));
    return [...added, ...base];
  }, [baseDisplayedRoles, removedRoleIds, addedRoleIds]);
  const displayedUsers = useMemo(() => {
    const base = baseDisplayedUsers.filter((u) => !removedUserIds.has(u.id));
    if (addedUserIds.size === 0) return base;
    const baseIds = new Set(base.map((u) => u.id));
    const added = users.filter((u) => addedUserIds.has(u.id) && !baseIds.has(u.id));
    return [...added, ...base];
  }, [baseDisplayedUsers, removedUserIds, addedUserIds]);

  /* Removing this permission is only ever possible on a custom role: a
   * predefined role's permission set is system-managed. When every role in the
   * list is predefined there is nothing to act on at all, so the row actions,
   * the selection checkboxes and the bulk bar are all withheld rather than
   * shown as permanently blocked controls. */
  const rolesRemovable = useMemo(
    () => displayedRoles.some(isRoleRemovable),
    [displayedRoles]
  );

  const getRoleRowId = useCallback((row: RoleRow) => row.id, []);
  const getUserRowId = useCallback((row: UserRow) => row.id, []);

  /** Filter predicate for source-type quick filters on users table */
  const permUsersFilterPredicate = useCallback((row: UserRow, filterKey: string) => {
    if (!permissionId) return true;
    const gv = getGrantedVia(row.id, permissionId);
    if (filterKey === "direct") return gv.type === "direct" || gv.type === "both";
    if (filterKey === "inherited") return gv.type === "role" || gv.type === "both";
    return true;
  }, [permissionId]);

  const permRolesColumns = useMemo(
    () => getPermissionRolesColumns(permissionId, thresholdConfig, handleEditThreshold, thresholdOverrides),
    [permissionId, thresholdConfig, handleEditThreshold, thresholdOverrides]
  );
  const permissionDisplayName = useMemo(
    () =>
      (permissionId
        ? PERMISSION_MODULES.flatMap((m) => m.permissions).find((p) => p.id === permissionId)?.name
        : null) ?? "this permission",
    [permissionId]
  );
  const permUsersColumns = useMemo(
    () => getPermissionUsersColumns(permissionId ?? "", thresholdConfig, handleEditThreshold, thresholdOverrides),
    [permissionId, thresholdConfig, handleEditThreshold, thresholdOverrides]
  );

  const handleOpenAddModal = useCallback((mode: "roles" | "users") => {
    setAddModalMode(mode);
    setAddModalOpen(true);
  }, []);

  const isManageRolesPermission = permissionId === "ur-manage-roles";

  // Permission name used in the grant-to-roles toasts.
  const permissionName = useMemo(
    () =>
      permissionId
        ? PERMISSION_MODULES.flatMap((m) => m.permissions).find((p) => p.id === permissionId)?.name ?? "this permission"
        : "this permission",
    [permissionId]
  );
  /* Role names that already hold this permission, excluded from the Add Roles
     list so it only offers roles that don't have it yet. */
  const rolesWithPermission = useMemo(
    () => new Set(baseDisplayedRoles.map((r) => r.roleName)),
    [baseDisplayedRoles]
  );

  // Does this permission require a Full Access license?
  const permRequiresFullAccess = useMemo(() => {
    if (!permissionId) return false;
    const perm = PERMISSION_MODULES.flatMap((m) => m.permissions).find((p) => p.id === permissionId);
    return perm ? permissionRequiresFullAccess(perm) : false;
  }, [permissionId]);

  // Field-User roles granted a Full-Access permission must be promoted to Full
  // Access. Queue them so the Upgrade Role License modal is shown one role at a
  // time (it is single-role). Reset whenever the active permission changes.
  const [roleUpgradeQueue, setRoleUpgradeQueue] = useState<RoleRow[]>([]);
  useEffect(() => {
    setRoleUpgradeQueue([]);
  }, [permissionId]);

  // Add the granted roles to the visible list immediately. If this permission
  // requires Full Access, queue any Field-User roles for a license upgrade.
  const applyGrantedRoles = useCallback((roleNames: string[]) => {
    const set = new Set(roleNames);
    const granted = roles.filter((r) => set.has(r.roleName));
    const ids = granted.map((r) => r.id);
    if (ids.length) setAddedRoleIds((prev) => new Set([...prev, ...ids]));
    if (permRequiresFullAccess) {
      const fieldRoles = granted.filter((r) => r.licenseRequired === "Field User");
      if (fieldRoles.length) setRoleUpgradeQueue((prev) => [...prev, ...fieldRoles]);
    }
  }, [permRequiresFullAccess]);

  // Add directly-assigned users to the visible list immediately. If the
  // permission requires Full Access, prompt to upgrade any under-licensed picks.
  const applyAddedUsers = useCallback((ids: (number | string)[]) => {
    const numIds = ids.map((id) => Number(id)).filter((n) => !Number.isNaN(n));
    if (numIds.length) setAddedUserIds((prev) => new Set([...prev, ...numIds]));
    if (permRequiresFullAccess) {
      const underLicensed = numIds
        .map((id) => users.find((u) => u.id === id))
        .filter((u): u is UserRow => !!u && u.license !== "Full Access");
      if (underLicensed.length) setPendingLicenseUpgrade(underLicensed);
    }
  }, [permRequiresFullAccess]);

  const handleConfirmLicenseUpgrade = useCallback(() => {
    const list = pendingLicenseUpgrade ?? [];
    list.forEach((u) => updateUserRowState(u.id, { license: "Full Access" }));
    const n = list.length;
    toast.success(`License upgraded to Full Access for ${n} user${n > 1 ? "s" : ""}.`);
    setPendingLicenseUpgrade(null);
  }, [pendingLicenseUpgrade]);

  // Add Roles → grant the current permission to the selected roles.
  const handleGrantRolesAssign = useCallback(
    (roleNames: string[]) => {
      if (roleNames.length === 0) return;
      applyGrantedRoles(roleNames);
      const n = roleNames.length;
      toast.success(`${permissionName} granted to ${n} role${n > 1 ? "s" : ""}.`);
    },
    [permissionName, applyGrantedRoles]
  );

  // Toolbar actions: fullscreen icon + Add button
  const rolesToolbarAction = useMemo(
    () => (
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setExpandedMode("roles")}
              className="inline-flex items-center justify-center w-9 h-9 rounded-[8px] border border-[#CBD5E1] bg-white text-[#64748B] hover:bg-[#F8FAFC] hover:border-[#94A3B8] transition-all cursor-pointer shadow-sm"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>View in Full Screen</TooltipContent>
        </Tooltip>
        <button
          onClick={() => handleOpenAddModal("roles")}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-[8px] border border-[#CBD5E1] bg-white text-xs text-[#334155] hover:bg-[#F8FAFC] hover:border-[#94A3B8] transition-all cursor-pointer shadow-sm"
          style={{ fontWeight: 500 }}
        >
          <Plus className="w-3.5 h-3.5" style={{ color: "#64748B" }} />
          Add Roles
        </button>
      </div>
    ),
    [handleOpenAddModal]
  );

  const usersToolbarAction = useMemo(
    () => (
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setExpandedMode("users")}
              className="inline-flex items-center justify-center w-9 h-9 rounded-[8px] border border-[#CBD5E1] bg-white text-[#64748B] hover:bg-[#F8FAFC] hover:border-[#94A3B8] transition-all cursor-pointer shadow-sm"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>View in Full Screen</TooltipContent>
        </Tooltip>
        <button
          onClick={() => handleOpenAddModal("users")}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-[8px] border border-[#CBD5E1] bg-white text-xs text-[#334155] hover:bg-[#F8FAFC] hover:border-[#94A3B8] transition-all cursor-pointer shadow-sm"
          style={{ fontWeight: 500 }}
        >
          <Plus className="w-3.5 h-3.5" style={{ color: "#64748B" }} />
          Add Users
        </button>
      </div>
    ),
    [handleOpenAddModal]
  );

  const handleRemoveRole = useCallback((role: RoleRow) => {
    if (role.isSystem) {
      setConfirmModal({ type: "system-blocked", roleName: role.roleName });
    } else {
      setPermRemovalModal({ target: "roles", ids: [role.id] });
    }
  }, []);

  const handleRemoveUser = useCallback((user: UserRow) => {
    if (!permissionId) return;
    // Route by how the user holds the permission. An inherited permission cannot
    // be turned off for one user, so it opens the redirect modal; a direct
    // assignment is the only thing removable from here.
    const gv = getGrantedVia(user.id, permissionId);
    if (gv.type === "role") {
      // Inherited only: nothing to remove here; explain and point to the role.
      setRedirectTarget({ user, sources: gv.roles });
    } else if (gv.type === "both") {
      // Direct + role: only the direct assignment can be removed, and doing so
      // does not change access because the role still grants it.
      setConfirmModal({
        type: "remove-user-direct-role",
        userName: user.fullName,
        permissionName: permissionDisplayName,
      });
    } else {
      // Direct only: clean removal turns the permission off on confirm.
      setConfirmModal({
        type: "remove-user-direct",
        userName: user.fullName,
        permissionName: permissionDisplayName,
      });
    }
  }, [permissionId, permissionDisplayName]);

  /* Shared by both bulk bars (inline list and full-screen list) so a removal
   * started from either one runs through the same confirmation and the same
   * removedRoleIds/removedUserIds state that drives the visible lists. */
  const handleBulkRemove = useCallback(
    (target: "roles" | "users", ids: number[], clearSelection: () => void) => {
      if (ids.length === 0) return;
      setPermRemovalModal({ target, ids, clearSelection });
    },
    []
  );

  const renderRoleAction = useCallback(
    (row: RoleRow) => <RoleRowActions role={row} onRemove={handleRemoveRole} />,
    [handleRemoveRole]
  );
  const renderUserAction = useCallback(
    (row: UserRow) => <UserRowActions user={row} onRemove={handleRemoveUser} />,
    [handleRemoveUser]
  );

  const rolesBulkActionsSlot = useCallback(
    (selectedCount: number, selectedIds: Set<number | string>, onCancel: () => void) => {
      /* Predefined roles can be selected (the checkbox column is shared) but
       * never removed, so the action runs on the custom subset only. Mixed
       * selection keeps the button live and explains the exclusion; an
       * all-predefined selection has nothing left to act on and disables it.
       * Same split the Deactivate/Archive chips use in the role listing. */
      const selected = displayedRoles.filter((r) => selectedIds.has(r.id));
      const eligibleIds = selected.filter(isRoleRemovable).map((r) => r.id);
      const predefinedCount = selected.length - eligibleIds.length;
      const disabled = eligibleIds.length === 0;
      const tooltip = disabled
        ? "Predefined roles can't have permissions removed. Their permissions are managed by the system and can't be changed."
        : predefinedCount > 0
          ? `${predefinedCount} predefined role${predefinedCount !== 1 ? "s" : ""} will be excluded. Predefined role permissions are managed by the system and can't be changed; only the ${eligibleIds.length} eligible role${eligibleIds.length !== 1 ? "s" : ""} will have this permission removed.`
          : undefined;

      const removeButton = (
        <button
          onClick={() => {
            if (disabled) return;
            setPermRemovalModal({ target: "roles", ids: eligibleIds, clearSelection: onCancel });
          }}
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-[6px] border text-[12px] transition-colors",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
          )}
          style={{
            fontWeight: 500,
            color: "#DC2626",
            borderColor: "#FECACA",
            backgroundColor: "white",
          }}
          onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = "#FEF2F2"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "white"; }}
        >
          <Trash2 className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
          Remove Permission
          {predefinedCount > 0 && (
            <Info className="w-3.5 h-3.5 ml-0.5" style={{ color: "#DC2626", opacity: 0.7 }} />
          )}
        </button>
      );

      return (
        <div
          className="flex items-center gap-2 px-4 pb-3 shrink-0"
          style={{ background: "linear-gradient(to top, #F0F7FF 0%, #FFFFFF 100%)" }}
        >
          <div className="flex items-center gap-1.5">
            {tooltip ? (
              <Tooltip>
                {/* Disabled buttons swallow pointer events, so the trigger
                    wraps the button in a span that still receives hover. */}
                <TooltipTrigger asChild>
                  <span className="inline-flex">{removeButton}</span>
                </TooltipTrigger>
                {/* The tooltip portals to the body while this bar lives inside
                    a z-[60]/z-[70] modal, so it needs to outrank it or it
                    renders behind the modal and never appears. */}
                <TooltipContent
                  side="top"
                  sideOffset={6}
                  className="bg-white text-[#334155] border border-[#E2E8F0] shadow-md text-xs z-[9999] max-w-[320px] leading-relaxed"
                >
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            ) : (
              removeButton
            )}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2.5">
            <span className="text-[13px]" style={{ fontWeight: 600, color: "#007FFF" }}>
              {selectedCount} selected
            </span>
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] border text-[12px] transition-colors cursor-pointer"
              style={{ fontWeight: 500, color: "#64748B", borderColor: "#CBD5E1", backgroundColor: "white" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#94A3B8"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#CBD5E1"; }}
            >
              ✕ Cancel
            </button>
          </div>
        </div>
      );
    },
    [displayedRoles]
  );

  const usersBulkActionsSlot = useCallback(
    (selectedCount: number, selectedIds: Set<number | string>, onCancel: () => void) => {
      return (
        <div
          className="flex items-center gap-2 px-4 pb-3 shrink-0"
          style={{ background: "linear-gradient(to top, #F0F7FF 0%, #FFFFFF 100%)" }}
        >
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const ids = Array.from(selectedIds).map((v) => Number(v));
                setPermRemovalModal({ target: "users", ids, clearSelection: onCancel });
              }}
              className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-[6px] border text-[12px] transition-colors cursor-pointer"
              style={{
                fontWeight: 500,
                color: "#DC2626",
                borderColor: "#FECACA",
                backgroundColor: "white",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#FEF2F2"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "white"; }}
            >
              <Trash2 className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
              Remove Permission
            </button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2.5">
            <span className="text-[13px]" style={{ fontWeight: 600, color: "#007FFF" }}>
              {selectedCount} selected
            </span>
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] border text-[12px] transition-colors cursor-pointer"
              style={{ fontWeight: 500, color: "#64748B", borderColor: "#CBD5E1", backgroundColor: "white" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#94A3B8"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#CBD5E1"; }}
            >
              ✕ Cancel
            </button>
          </div>
        </div>
      );
    },
    []
  );

  return (
    <div className="min-w-0 w-full">
      <h4
        className="text-foreground mb-1.5"
        style={{ fontSize: "15px", fontWeight: 600, lineHeight: "1.3" }}
      >
        {title}
      </h4>
      <p
        className="text-muted-foreground mb-4"
        style={{ fontSize: "13px", fontWeight: 400, lineHeight: "1.55" }}
      >
        Permissions are managed through roles. To keep each role consistent, role permissions are edited only from the role's detail page. Selecting a role below opens it. Direct user assignments can be granted or removed from the Users tab.
      </p>

      <div className="rounded-xl border border-border overflow-hidden bg-card min-w-0">
        {/* Tabs */}
        <div className="flex items-center gap-0 border-b border-border px-5 bg-slate-50">
          <button
            onClick={() => setActiveTab("roles")}
            className={cn(
              "flex items-center gap-2 px-1 py-3 text-[13.5px] transition-colors relative cursor-pointer mr-5",
              activeTab === "roles"
                ? "text-[#007FFF]"
                : "text-gray-500 hover:text-gray-700"
            )}
            style={{ fontWeight: activeTab === "roles" ? 600 : 450 }}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Roles</span>
            <span
              className="inline-flex items-center justify-center rounded-full px-1.5 text-[11px]"
              style={{
                backgroundColor: activeTab === "roles" ? "#EDF4FF" : "#F1F5F9",
                color: activeTab === "roles" ? "#007FFF" : "#64748B",
                fontWeight: 500,
                minWidth: 20,
                height: 18,
              }}
            >
              {displayedRoles.length}
            </span>
            {activeTab === "roles" && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#007FFF] rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={cn(
              "flex items-center gap-2 px-1 py-3 text-[13.5px] transition-colors relative cursor-pointer",
              activeTab === "users"
                ? "text-[#007FFF]"
                : "text-gray-500 hover:text-gray-700"
            )}
            style={{ fontWeight: activeTab === "users" ? 600 : 450 }}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users</span>
            <span
              className="inline-flex items-center justify-center rounded-full px-1.5 text-[11px]"
              style={{
                backgroundColor: activeTab === "users" ? "#EDF4FF" : "#F1F5F9",
                color: activeTab === "users" ? "#007FFF" : "#64748B",
                fontWeight: 500,
                minWidth: 20,
                height: 18,
              }}
            >
              {displayedUsers.length}
            </span>
            {activeTab === "users" && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#007FFF] rounded-t-full" />
            )}
          </button>
        </div>

        {/* Content */}
        {showEmpty ? (
          /* Empty state placeholder for bulk mode */
          <div className="py-14 px-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              {activeTab === "roles" ? (
                <Shield className="w-6 h-6 text-gray-400" />
              ) : (
                <Users className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <p
              className="text-gray-900 mb-1.5"
              style={{ fontSize: "15px", fontWeight: 600 }}
            >
              {activeTab === "roles" ? "No roles assigned" : "No users assigned"}
            </p>
            <p
              className="text-gray-500 mb-5 max-w-[320px]"
              style={{ fontSize: "13px", fontWeight: 400, lineHeight: "1.5" }}
            >
              {activeTab === "roles"
                ? "This permission has not been assigned to any roles. Add roles to grant this permission to all users who hold those roles."
                : "No users currently hold this permission. Add users to grant it by direct assignment, or assign this permission to a role."}
            </p>
            <button
              onClick={() => handleOpenAddModal(activeTab === "roles" ? "roles" : "users")}
              className="inline-flex items-center gap-1.5 text-[#007FFF] hover:text-[#0856b8] transition-colors cursor-pointer"
              style={{ fontSize: "14px", fontWeight: 600 }}
            >
              <Plus className="w-4 h-4" />
              {activeTab === "roles" ? "+ Add Roles" : "+ Add Users"}
            </button>
          </div>
        ) : (
          /* Normal DataTable content */
          <>
            <div className="min-w-0 overflow-hidden" style={{ display: activeTab === "roles" ? "block" : "none" }}>
              <DataTable<RoleRow>
                data={displayedRoles}
                columns={permRolesColumns}
                getRowId={getRoleRowId}
                searchPlaceholder="Search by role name..."
                searchPredicate={rolesSearchPredicate}
                quickFilters={PERM_ROLES_QUICK_FILTERS}
                filterPredicate={rolesFilterPredicate}
                showMeMode={false}
                emptyIcon={<Shield className="w-8 h-8" />}
                emptyMessage="No roles found"
                renderActions={rolesRemovable ? renderRoleAction : undefined}
                actionsColWidth={56}
                entityLabel="roles"
                hideDensity
                hideColumnSelector
                defaultDensity="condensed"
                toolbarAction={rolesToolbarAction}
                sortFn={sortRolesCustomFirst}
                rowGroupFn={roleGroupFn}
                rowGroupLabels={ROLE_GROUP_LABELS}
                hideSelection={!rolesRemovable}
                bulkActionsSlot={rolesRemovable ? rolesBulkActionsSlot : undefined}
                onRowClick={(row) => {
                  window.location.href = `/company-settings/user-access-control/role/${row.id}`;
                }}
              />
            </div>
            <div className="min-w-0 overflow-hidden" style={{ display: activeTab === "users" ? "block" : "none" }}>
              <DataTable<UserRow>
                data={displayedUsers}
                columns={permUsersColumns}
                getRowId={getUserRowId}
                searchPlaceholder="Search by name..."
                searchPredicate={usersSearchPredicate}
                quickFilters={PERM_USERS_QUICK_FILTERS}
                filterPredicate={permUsersFilterPredicate}
                showMeMode={false}
                emptyIcon={<Users className="w-8 h-8" />}
                emptyMessage="No users found"
                renderActions={renderUserAction}
                actionsColWidth={56}
                entityLabel="users"
                hideDensity
                hideColumnSelector
                toolbarAction={usersToolbarAction}
                defaultDensity="condensed"
                bulkActionsSlot={usersBulkActionsSlot}
                onRowClick={(row) => {
                  window.location.href = `/company-settings/user-access-control/user/${row.id}`;
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Add Roles/Users Modal */}
      {isManageRolesPermission ? (
        <>
          <AddManageRolesRolesModal
            open={addModalOpen && addModalMode === "roles"}
            onClose={() => setAddModalOpen(false)}
          />
          <AddManageRolesUsersModal
            open={addModalOpen && addModalMode === "users"}
            onClose={() => setAddModalOpen(false)}
          />
        </>
      ) : (
        <>
          {/* Add Roles → grant THIS permission to roles that don't have it.
              Reuses the user-detail Add Roles card-grid modal. Custom roles only. */}
          <AddRolesModal
            open={addModalOpen && addModalMode === "roles"}
            onClose={() => setAddModalOpen(false)}
            z={70}
            userName=""
            assignedRoleNames={rolesWithPermission}
            hasExistingPrimary
            customOnly
            hidePrimary
            hideTypeFilters
            suppressToast
            heading="Add Roles"
            subtitle={`Grant "${permissionName}" to roles that don't have it yet. Everyone in the selected roles will receive this permission.`}
            onAssign={(roleNames) => handleGrantRolesAssign(roleNames)}
          />
          <AddRolesUsersModal
            open={addModalOpen && addModalMode === "users"}
            onClose={() => setAddModalOpen(false)}
            mode="users"
            onAdd={applyAddedUsers}
            excludeUserIds={displayedUsers.map((u) => u.id)}
          />
        </>
      )}

      {/* License upgrade prompt, when a Full Access permission is granted to
          under-licensed users. Reuses the user-listing UpgradeLicenseModal. */}
      {pendingLicenseUpgrade && pendingLicenseUpgrade.length > 0 && (
        <UpgradeLicenseModal
          open
          z={120}
          onClose={() => setPendingLicenseUpgrade(null)}
          userName={pendingLicenseUpgrade.length === 1 ? pendingLicenseUpgrade[0].fullName : undefined}
          userEmail={pendingLicenseUpgrade.length === 1 ? pendingLicenseUpgrade[0].email : undefined}
          users={
            pendingLicenseUpgrade.length > 1
              ? pendingLicenseUpgrade.map((u) => ({ name: u.fullName, email: u.email }))
              : undefined
          }
          onConfirm={handleConfirmLicenseUpgrade}
        />
      )}

      {/* Role license upgrade, granting a Full-Access permission to a Field-User
          role promotes the whole role to Full Access. Shown one role at a time. */}
      {roleUpgradeQueue.length > 0 && (() => {
        const role = roleUpgradeQueue[0];
        const members = getUsersForRole(role.id);
        const toMember = (u: UserRow) => ({ id: u.id, name: u.fullName, email: u.email });
        const dequeue = () => setRoleUpgradeQueue((q) => q.filter((r) => r.id !== role.id));
        return (
          <UpgradeRoleLicenseModal
            open
            z={120}
            roleName={role.roleName}
            permissionName={permissionName}
            affectedUsers={members.filter((u) => u.license === "Field User").map(toMember)}
            alreadyFullUsers={members.filter((u) => u.license === "Full Access").map(toMember)}
            onClose={dequeue}
            onConfirm={() => {
              applyRoleLicenseTier(role.id, "Full Access");
              toast.success(`${role.roleName} upgraded to Full Access.`);
              dequeue();
            }}
          />
        );
      })()}

      {/* Expanded List Modal */}
      <ExpandedListModal
        open={expandedMode !== null}
        onClose={() => setExpandedMode(null)}
        mode={expandedMode ?? "roles"}
        permissionId={permissionId ?? ""}
        rolesData={displayedRoles}
        usersData={displayedUsers}
        thresholdConfig={thresholdConfig}
        onEditThreshold={handleEditThreshold}
        thresholdOverrides={thresholdOverrides}
        onRemoveRole={handleRemoveRole}
        onRemoveUser={handleRemoveUser}
        onBulkRemove={handleBulkRemove}
      />

      {/* Edit Threshold Modal. Unreachable while SHOW_PERMISSION_THRESHOLDS is
          off (nothing renders the column that opens it), gated anyway so the
          flag is the single switch. */}
      {SHOW_PERMISSION_THRESHOLDS && thresholdConfig && thresholdConfig.type !== "descriptive" && thresholdEditEntity && (
        <EditThresholdModal
          open={thresholdEditOpen}
          onClose={() => {
            setThresholdEditOpen(false);
            setThresholdEditEntity(null);
          }}
          entityName={thresholdEditEntity.name}
          entityType={thresholdEditEntity.type}
          config={thresholdConfig}
          currentValue={thresholdEditEntity.value}
          onSave={(newValue) => {
            const ent = thresholdEditEntity;
            if (!ent || !permissionId) return;
            const key = thresholdOverrideKey(ent.type, ent.id, permissionId);
            setThresholdOverrides((prev) => ({ ...prev, [key]: newValue }));
          }}
        />
      )}

      {/* ─── Confirmation Modals ─── */}
      {confirmModal && createPortal(
        <>
          <div
            className="fixed inset-0 z-[90] bg-black/30"
            onClick={() => setConfirmModal(null)}
          />
          <div
            className="fixed z-[90] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl border border-gray-200 overflow-hidden"
            style={{
              width: 460,
              maxWidth: "calc(100vw - 48px)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 border-b border-[#F1F5F9]">
              {/* Blue info icon for role-granted modal */}
              {confirmModal.type === "role-granted" && (
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#EDF4FF" }}>
                    <Info className="w-4.5 h-4.5" style={{ color: "#007FFF" }} />
                  </div>
                </div>
              )}
              <h3 style={{ fontSize: "15px", fontWeight: 650, color: "#0F172A" }}>
                {confirmModal.type === "remove-role" && "Remove Role"}
                {confirmModal.type === "remove-user-direct" && `Remove ${confirmModal.permissionName ?? "Permission"} from ${confirmModal.userName ?? "User"}?`}
                {confirmModal.type === "remove-user-direct-role" && "Remove the Direct Assignment?"}
                {confirmModal.type === "role-granted" && "Cannot Remove Inherited Permission"}
                {confirmModal.type === "system-blocked" && "Predefined Role Cannot Be Modified"}
                {confirmModal.type === "bulk-remove-roles" && `Remove ${confirmModal.bulkCount} Roles from Permission`}
                {confirmModal.type === "bulk-remove-users" && `Remove ${confirmModal.bulkCount} Users from Permission`}
              </h3>
            </div>

            <div className="px-5 py-5 space-y-3">
              {confirmModal.type === "remove-role" && (
                <>
                  <p style={{ fontSize: "13.5px", color: "#334155", lineHeight: "1.6" }}>
                    {(confirmModal.usersCount ?? 0) > 1
                      ? `Removing ${confirmModal.roleName} from this permission will revoke access for all ${confirmModal.usersCount} users assigned to this role. Users who hold this permission through a different role will not be affected.`
                      : (confirmModal.usersCount ?? 0) === 1
                      ? `Removing ${confirmModal.roleName} from this permission will revoke access for 1 user assigned to this role.`
                      : `No users are currently assigned to ${confirmModal.roleName}. Removing this role will not affect any user's access.`}
                  </p>
                  <p style={{ fontSize: "12.5px", color: "#64748B", lineHeight: "1.5" }}>
                    To restore access, re-add the role to this permission.
                  </p>
                </>
              )}

              {confirmModal.type === "remove-user-direct" && (
                <p style={{ fontSize: "13.5px", color: "#334155", lineHeight: "1.6" }}>
                  {confirmModal.userName ?? "This user"} has {confirmModal.permissionName ?? "this permission"} assigned directly rather than through any role, so removing it turns the permission off for {confirmModal.userName ?? "this user"} right away. If you need to grant it again later, you can assign it directly once more or include it in one of {confirmModal.userName ?? "this user"}'s roles.
                </p>
              )}

              {confirmModal.type === "remove-user-direct-role" && (
                <p style={{ fontSize: "13.5px", color: "#334155", lineHeight: "1.6" }}>
                  {confirmModal.userName ?? "This user"} has {confirmModal.permissionName ?? "this permission"} both directly and through an assigned role, so removing the direct assignment will not change {confirmModal.userName ?? "this user"}'s access, because the role still grants it. The roles that grant this permission are listed under Granted Via.
                </p>
              )}

              {confirmModal.type === "role-granted" && (
                <>
                  <p style={{ fontSize: "13.5px", color: "#334155", lineHeight: "1.6" }}>
                    This permission is granted to {confirmModal.userName ?? "this user"} through the following roles and cannot be removed from this screen.
                  </p>

                  {/* Source roles with links */}
                  <div className="space-y-1.5 mt-2">
                    <p style={{ fontSize: "12px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>Granted via</p>
                    {confirmModal.userRoles?.map((roleName) => {
                      const role = roles.find((r) => r.roleName === roleName);
                      return (
                        <div key={roleName} className="flex items-center justify-between px-3 py-2 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC]">
                          <div className="flex items-center gap-2">
                            <Shield className="w-3.5 h-3.5" style={{ color: "#64748B" }} />
                            <span style={{ fontSize: "13px", fontWeight: 550, color: "#0F172A" }}>{roleName}</span>
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full border"
                              style={
                                role?.isSystem
                                  ? { fontWeight: 550, backgroundColor: "#F5F3FF", color: "#5B21B6", borderColor: "#DDD6FE" }
                                  : { fontWeight: 550, backgroundColor: "#EDF4FF", color: "#007FFF", borderColor: "#B4D7FF" }
                              }
                            >
                              {role?.isSystem ? "System" : "Custom"}
                            </span>
                          </div>
                          {role && (
                            <a
                              href={`/company-settings/user-access-control/role/${role.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#007FFF] hover:underline"
                              style={{ fontSize: "12px", fontWeight: 500 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              View Role <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {confirmModal.type === "system-blocked" && (
                <p style={{ fontSize: "13.5px", color: "#334155", lineHeight: "1.6" }}>
                  Permissions assigned to {confirmModal.roleName} are defined by the system and cannot be changed from this screen. To manage access, create a custom role with the required permissions.
                </p>
              )}

              {confirmModal.type === "bulk-remove-roles" && (
                <>
                  <p style={{ fontSize: "13.5px", color: "#334155", lineHeight: "1.6" }}>
                    Removing these roles will revoke this permission from users who hold it only through these roles. Users who hold this permission through a role not included in this selection will not be affected.
                  </p>
                  {(confirmModal.bulkAffectedUsers?.length ?? 0) > 0 && (
                    <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.5" }}>
                      {(confirmModal.bulkAffectedUsers?.length ?? 0) <= 5
                        ? `The following users will lose access: ${confirmModal.bulkAffectedUsers?.join(", ")}.`
                        : `${confirmModal.bulkAffectedUsers?.length} users will lose access.`}
                    </p>
                  )}
                </>
              )}

              {confirmModal.type === "bulk-remove-users" && (
                <p style={{ fontSize: "13.5px", color: "#334155", lineHeight: "1.6" }}>
                  Removing {confirmModal.bulkCount} user{(confirmModal.bulkCount ?? 0) > 1 ? "s" : ""} will revoke their direct assignment to this permission. Users who also hold this permission through a role will retain access through that role.
                </p>
              )}
            </div>

            <div
              className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t"
              style={{ borderColor: "#F1F5F9", backgroundColor: "#FAFBFC" }}
            >
              {(confirmModal.type === "role-granted" || confirmModal.type === "system-blocked") ? (
                <button
                  onClick={() => setConfirmModal(null)}
                  className="h-9 px-4 rounded-[8px] text-[13px] bg-white cursor-pointer transition-colors hover:bg-[#F0F7FF]"
                  style={{ color: "#007FFF", border: "1px solid #007FFF", fontWeight: 600 }}
                >
                  Got It
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setConfirmModal(null)}
                    className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] text-[#334155] cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (confirmModal.type === "remove-role") {
                        toast.success("Role removed.");
                      } else if (confirmModal.type === "remove-user-direct") {
                        toast.success("Direct assignment removed.");
                      } else if (confirmModal.type === "remove-user-direct-role") {
                        toast.success("Direct assignment removed.");
                      } else if (confirmModal.type === "bulk-remove-roles") {
                        toast.success(`${confirmModal.bulkCount} roles removed.`);
                      } else if (confirmModal.type === "bulk-remove-users") {
                        toast.success(`${confirmModal.bulkCount} users removed.`);
                      }
                      setConfirmModal(null);
                    }}
                    className="h-9 px-4 rounded-[8px] text-[13px] text-white cursor-pointer transition-colors"
                    style={{
                      backgroundColor: confirmModal.type === "remove-user-direct-role" ? "#007FFF" : "#DC2626",
                      fontWeight: 600,
                    }}
                  >
                    {confirmModal.type === "remove-role" && "Remove Role"}
                    {confirmModal.type === "remove-user-direct" && "Remove Permission"}
                    {confirmModal.type === "remove-user-direct-role" && "Remove Direct Assignment"}
                    {confirmModal.type === "bulk-remove-roles" && `Remove ${confirmModal.bulkCount} Roles`}
                    {confirmModal.type === "bulk-remove-users" && `Remove ${confirmModal.bulkCount} Users`}
                  </button>
                </>
              )}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ─── Remove-Permission confirmation (destructive shell) ─── */}
      {(() => {
        if (!permRemovalModal) return null;
        const permName =
          (permissionId
            ? PERMISSION_MODULES.flatMap((m) => m.permissions).find(
                (p) => p.id === permissionId
              )?.name
            : null) ?? "this permission";

        const isRoles = permRemovalModal.target === "roles";
        /* Resolved against what the list currently shows, not the base subset,
         * so rows added through the Add modals are named in the dialog too. */
        const selectedRoles = isRoles
          ? displayedRoles.filter((r) => permRemovalModal.ids.includes(r.id))
          : [];
        const selectedUsers = !isRoles
          ? displayedUsers.filter((u) => permRemovalModal.ids.includes(u.id))
          : [];
        const n = isRoles ? selectedRoles.length : selectedUsers.length;
        /* People, not role assignments: a user who holds three of the selected
         * roles loses the permission once and counts once here. */
        const totalAffectedUsers = getUniqueUserCountForRoles(
          selectedRoles.map((r) => r.id)
        );

        const noun = isRoles ? "role" : "user";
        const title = `Remove ${permName} from ${n} ${noun}${n === 1 ? "" : "s"}?`;
        const description = isRoles
          ? "This will revoke this permission for all users assigned to these roles. Users who rely on this permission will lose access to the associated functionality."
          : "This will revoke this permission for the selected user. Users who rely on this permission will lose access to the associated functionality.";

        const list = (
          <div className="space-y-3">
            <div
              className="rounded-[10px] border bg-white overflow-hidden"
              style={{ borderColor: "#E2E8F0" }}
            >
              <div
                className="max-h-[180px] overflow-y-auto divide-y"
                style={{ borderColor: "#F1F5F9" }}
              >
                {isRoles
                  ? selectedRoles.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Shield
                            className="w-3.5 h-3.5 shrink-0"
                            style={{ color: "#64748B" }}
                          />
                          <span
                            className="text-[13px] truncate"
                            style={{ fontWeight: 550, color: "#0F172A" }}
                          >
                            {r.roleName}
                          </span>
                        </div>
                        <span
                          className="text-[12px] shrink-0 ml-3"
                          style={{ color: "#64748B" }}
                        >
                          {r.usersCount} user{r.usersCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    ))
                  : selectedUsers.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-2 px-3 py-2"
                      >
                        <User
                          className="w-3.5 h-3.5 shrink-0"
                          style={{ color: "#64748B" }}
                        />
                        <span
                          className="text-[13px] truncate"
                          style={{ fontWeight: 550, color: "#0F172A" }}
                        >
                          {u.fullName}
                        </span>
                      </div>
                    ))}
              </div>
            </div>

            {isRoles && (
              <div
                className="flex items-center justify-between px-3 py-2 rounded-[8px]"
                style={{ backgroundColor: "#F8FAFC" }}
              >
                <span
                  className="text-[12.5px]"
                  style={{ fontWeight: 500, color: "#475569" }}
                >
                  Total Users Affected
                </span>
                <span
                  className="text-[13px]"
                  style={{ fontWeight: 650, color: "#0F172A" }}
                >
                  {totalAffectedUsers}
                </span>
              </div>
            )}

          </div>
        );

        return (
          <DestructiveConfirmModal
            open={true}
            onClose={() => setPermRemovalModal(null)}
            badge="REMOVE"
            title={title}
            description={description}
            extra={list}
            confirmLabel="Remove Permission"
            cancelLabel="Cancel"
            maxWidth={460}
            /* Above the full-screen list (z-70), which can also open this. */
            z={90}
            onConfirm={() => {
              if (isRoles) {
                setRemovedRoleIds((prev) => {
                  const next = new Set(prev);
                  permRemovalModal.ids.forEach((id) => next.add(id));
                  return next;
                });
                toast.success(
                  `${permName} removed from ${n} role${n === 1 ? "" : "s"}`
                );
              } else {
                setRemovedUserIds((prev) => {
                  const next = new Set(prev);
                  permRemovalModal.ids.forEach((id) => next.add(id));
                  return next;
                });
                toast.success(
                  `${permName} removed from ${n} user${n === 1 ? "" : "s"}`
                );
              }
              permRemovalModal.clearSelection?.();
              setPermRemovalModal(null);
            }}
          />
        );
      })()}

      {/* Role-granted redirect modal, opens when an admin tries to remove a
          permission a user holds only through a role. It cannot be turned off
          from here, so the modal points to the role; nothing changes. */}
      <RoleGrantedRedirectModal
        open={!!redirectTarget}
        user={redirectTarget?.user.fullName ?? "this user"}
        permission={permissionDisplayName}
        sources={redirectTarget?.sources ?? []}
        onClose={() => setRedirectTarget(null)}
      />
    </div>
  );
}

// ─── Bulk Edit View (Right Panel Content) ───────────────────────────────────

function BulkEditView({
  permissions,
  checkedIds,
  toggles,
  onUncheck,
  onBulkEnable,
  context,
}: {
  permissions: Permission[];
  checkedIds: string[];
  toggles: Record<string, boolean>;
  onUncheck: (id: string) => void;
  onBulkEnable: (enable: boolean) => void;
  context?: string;
}) {
  const selectedPerms = permissions.filter((p) => checkedIds.includes(p.id));
  const allSelectedEnabled = selectedPerms.every((p) => toggles[p.id]);
  const noneSelectedEnabled = selectedPerms.every((p) => !toggles[p.id]);
  /* The roles/users assignment card is only part of bulk edit in the
     system-wide permissions view, so the intro only promises it there. */
  const showRolesAndUsers = !context || context === "permissions-tab";

  return (
    <div className="px-7 py-6">
      {/* Header */}
      <div className="mb-4">
        <h3
          className="text-gray-900 flex items-center gap-3"
          style={{ fontSize: "20px", fontWeight: 700, lineHeight: "1.3" }}
        >
          Bulk Edit Mode
          <span
            className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full"
            style={{ fontWeight: 400 }}
          >
            {checkedIds.length} Permissions Selected
          </span>
        </h3>
        <p
          className="text-gray-500 mt-2"
          style={{ fontSize: "13.5px", fontWeight: 400, lineHeight: "1.55" }}
        >
          {showRolesAndUsers
            ? "Changes here apply to all selected permissions. Setting the status enables or disables every one of them, and any role or user you add or remove is granted or revoked across all of them. Anything you don't change stays as it is."
            : "Changes here apply to all selected permissions. Setting the status enables or disables every one of them. Anything you don't change stays as it is."}
        </p>
      </div>

      {/* Selected Chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {selectedPerms.map((perm) => (
          <div
            key={perm.id}
            className="inline-flex items-center gap-2 bg-[#0E69E2]/10 border border-[#0E69E2]/20 text-[#0E69E2] px-3 py-1.5 rounded-[8px] text-sm"
          >
            <span className="truncate max-w-[200px]">{perm.name}</span>
            <button
              onClick={() => onUncheck(perm.id)}
              className="hover:bg-[#0E69E2]/20 rounded p-0.5 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="h-px bg-gray-200 w-full mb-8" />

      {/* Bulk Controls */}
      <div className="space-y-8">
        {/* Permission Status */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <h3 className="text-gray-900" style={{ fontSize: "15px", fontWeight: 600 }}>
              Permission Status
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Set status for all selected permissions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onBulkEnable(true)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-[8px] text-sm border transition-colors cursor-pointer",
                allSelectedEnabled
                  ? "bg-green-50 border-green-300 text-green-700 ring-1 ring-green-500/30"
                  : "bg-white border-green-300 text-green-600 hover:bg-green-50 hover:border-green-400"
              )}
              style={{ fontWeight: 500 }}
            >
              <Check
                size={16}
                strokeWidth={2.5}
                className={allSelectedEnabled ? "text-green-600" : "text-green-400"}
              />
              Enable All
            </button>
            <button
              onClick={() => onBulkEnable(false)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-[8px] text-sm border transition-colors cursor-pointer",
                noneSelectedEnabled
                  ? "bg-red-50 border-red-300 text-red-700 ring-1 ring-red-500/30"
                  : "bg-white border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
              )}
              style={{ fontWeight: 500 }}
            >
              <X
                size={16}
                strokeWidth={2.5}
                className={noneSelectedEnabled ? "text-red-600" : "text-red-400"}
              />
              Disable All
            </button>
          </div>
        </div>

        {/* Roles & Users with These Permissions, only in system-wide permissions tab */}
        {showRolesAndUsers && (
          <AssignRolesAndUsers
            title="Roles & Users with These Permissions"
            showEmpty
          />
        )}
      </div>
    </div>
  );
}

// ─── Manage Roles Scope Summary (Configure entry point) ─────────────────────

function ManageRolesScopeSummary({ userId, readOnly = false }: { userId: number; readOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const cfg = useSyncExternalStore(
    subscribeManageRolesScope,
    () => getManageRolesConfig(userId),
    () => getManageRolesConfig(userId),
  );
  const ownedIds = useSyncExternalStore(
    subscribeManageRolesScope,
    () => getOwnedRoleIds(userId),
    () => getOwnedRoleIds(userId),
  );

  const allRoles = roles;
  const managedRoleIds =
    cfg.mode === "all"
      ? allRoles.map((r) => r.id)
      : Array.from(new Set([...cfg.manageRoleIds, ...ownedIds]));
  const managedRoles = allRoles.filter((r) => managedRoleIds.includes(r.id));
  const count = managedRoles.length;

  const assignedRoleIds = useMemo(() => {
    const detail = getUserDetail(userId);
    if (!detail) return [] as number[];
    return detail.roleAssignments
      .map((ra) => roles.find((r) => r.roleName === ra.name)?.id)
      .filter((x): x is number => typeof x === "number");
  }, [userId]);

  const isAll = cfg.mode === "all";
  const isEmpty = !isAll && count === 0;

  const variant = isEmpty
    ? { bg: "#F8FAFC", border: "#E2E8F0", iconBg: "#F1F5F9", iconColor: "#64748B", titleColor: "#0F172A", textColor: "#64748B", Icon: AlertTriangle }
    : isAll
      ? { bg: "#ECFDF5", border: "#A7F3D0", iconBg: "#D1FAE5", iconColor: "#059669", titleColor: "#065F46", textColor: "#065F46", Icon: GlobeIcon }
      : { bg: "#EFF6FF", border: "#BFDBFE", iconBg: "#DBEAFE", iconColor: "#1D4ED8", titleColor: "#1E40AF", textColor: "#1E40AF", Icon: ListChecksIcon };

  const title = isEmpty
    ? "No roles configured"
    : isAll
      ? "All roles"
      : `Manages ${count} role${count === 1 ? "" : "s"} · Owner of ${ownedIds.length}`;
  const desc = isEmpty
    ? "This user won't be able to manage any roles until you set the scope."
    : isAll
      ? "This user can manage every role in the system."
      : "This user can manage the roles listed below.";
  const ctaLabel = isEmpty ? "Configure" : "Edit Configurations";

  return (
    <div>
      <div className="mb-3">
        <h4 className="text-foreground" style={{ fontSize: "13.5px", fontWeight: 700, lineHeight: "1.3" }}>
          Role Scope
        </h4>
        <p className="text-muted-foreground mt-0.5" style={{ fontSize: "12.5px", fontWeight: 400, lineHeight: "1.45" }}>
          Define which roles this user can manage and own.
        </p>
      </div>

      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: variant.bg, borderColor: variant.border }}
      >
        <div className="flex items-center justify-between p-4 gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 shadow-sm"
              style={{ backgroundColor: variant.iconBg, color: variant.iconColor }}
            >
              <variant.Icon className="w-[16px] h-[16px]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 style={{ fontSize: "13.5px", fontWeight: 700, lineHeight: "1.3", color: variant.titleColor }}>
                {title}
              </h3>
              <p className="mt-0.5" style={{ fontSize: "12.5px", fontWeight: 400, lineHeight: "1.45", color: variant.textColor, opacity: isEmpty ? 1 : 0.9 }}>
                {desc}
              </p>
            </div>
          </div>
          {!readOnly && (
            <button
              onClick={() => setOpen(true)}
              className={`self-center shrink-0 h-8 px-3 rounded-[8px] bg-white border text-[12.5px] transition-colors cursor-pointer ${isEmpty ? "border-[#007FFF] shadow-sm hover:bg-[#EDF4FF]" : "hover:opacity-90"}`}
              style={{ fontWeight: 600, color: isEmpty ? "#007FFF" : variant.iconColor, borderColor: isEmpty ? undefined : variant.border }}
            >
              {ctaLabel}
            </button>
          )}
        </div>


        {/* Selected role chips with X removal */}
        {!isAll && !isEmpty && (
          <div
            className="px-4 py-3 border-t flex flex-wrap gap-1.5 bg-white"
            style={{ borderColor: variant.border }}
          >
            {managedRoles.map((r) => {
              const setHover = (el: HTMLElement, on: boolean) => {
                el.style.backgroundColor = on ? "#DBEAFE" : "#FFFFFF";
                el.style.borderColor = on ? "#007FFF" : "#BFDBFE";
                el.style.color = on ? "#007FFF" : "#1E293B";
              };
              return (
                <span
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  title={`Open ${r.roleName} in a new tab`}
                  onMouseEnter={(e) => setHover(e.currentTarget, true)}
                  onMouseLeave={(e) => setHover(e.currentTarget, false)}
                  onClick={() =>
                    window.open(
                      `/company-settings/user-access-control/role/${r.id}?tab=permissions`,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                  className={`inline-flex items-center gap-1 ${readOnly ? "px-2" : "pl-2 pr-1"} py-0.5 rounded-md text-[11.5px] border transition-colors cursor-pointer`}
                  style={{ color: "#1E293B", backgroundColor: "#FFFFFF", borderColor: "#BFDBFE", fontWeight: 500 }}
                >
                  {r.roleName}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeManagedRoleForUser(userId, r.id); }}
                      className="ml-0.5 w-4 h-4 inline-flex items-center justify-center rounded hover:bg-white/70 cursor-pointer"
                      aria-label={`Remove ${r.roleName}`}
                    >
                      <X className="w-3 h-3" style={{ color: "#64748B" }} />
                    </button>
                  )}
                </span>
              );
            })}
          </div>

        )}

      </div>

      <ConfigureManageRolesModal
        open={open}
        onClose={() => setOpen(false)}
        userId={userId}
        assignedRoleIds={assignedRoleIds}
      />
    </div>
  );
}

// Crown icon import, reuse lucide-react
// eslint-disable-next-line react-refresh/only-export-components
export { ManageRolesScopeSummary as _ManageRolesScopeSummaryInternal };

// ─── Role-Level Manage Roles Scope Section ──────────────────────────────────

import { AlertTriangle, Globe as GlobeIcon, ListChecks as ListChecksIcon } from "lucide-react";
import {
  getRoleManageScope,
  removeRoleFromManageScope,
  restoreRoleManageScope,
  subscribeRoleManageScope,
} from "../../data/role-manage-scope-data";
import { ConfigureRoleScopeModal } from "./ConfigureRoleScopeModal";
import { ACCOUNT_OWNER_COPY, isAccountOwner } from "../../data/account-owner";

export function RoleManageScopeSection({ roleId }: { roleId: number }) {
  const [open, setOpen] = useState(false);
  // On mount (permission was just toggled ON or modal opened with perm on):
  // try to restore previously saved scope; if nothing to restore, auto-open the modal.
  useEffect(() => {
    const restored = restoreRoleManageScope(roleId);
    if (!restored) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cfg = useSyncExternalStore(
    subscribeRoleManageScope,
    () => getRoleManageScope(roleId),
    () => getRoleManageScope(roleId),
  );
  const allRoles = roles;
  const selectedRoles = cfg.mode === "all"
    ? allRoles
    : allRoles.filter((r) => cfg.manageRoleIds.includes(r.id));
  const count = selectedRoles.length;

  // Three states
  const isAll = cfg.mode === "all";
  const isEmpty = !isAll && count === 0;

  const variant = isEmpty
    ? { bg: "#F8FAFC", border: "#E2E8F0", iconBg: "#F1F5F9", iconColor: "#64748B", titleColor: "#0F172A", textColor: "#64748B", Icon: AlertTriangle }
    : isAll
      ? { bg: "#ECFDF5", border: "#A7F3D0", iconBg: "#D1FAE5", iconColor: "#059669", titleColor: "#065F46", textColor: "#065F46", Icon: GlobeIcon }
      : { bg: "#EFF6FF", border: "#BFDBFE", iconBg: "#DBEAFE", iconColor: "#1D4ED8", titleColor: "#1E40AF", textColor: "#1E40AF", Icon: ListChecksIcon };

  const title = isEmpty ? "No roles configured" : isAll ? "All roles" : `${count} selected role${count === 1 ? "" : "s"}`;
  const desc = isEmpty
    ? "Users with this permission won't be able to manage any roles until you set the scope."
    : isAll
      ? "Users in this role can manage every role in the system."
      : "Users in this role can only manage the roles listed below.";
  const ctaLabel = isEmpty ? "Configure" : "Edit Configurations";

  return (
    <>
      <div>
        <div className="mb-3">
          <h4 className="text-foreground" style={{ fontSize: "13.5px", fontWeight: 700, lineHeight: "1.3" }}>
            Role Scope
          </h4>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "12.5px", fontWeight: 400, lineHeight: "1.45" }}>
            Define which roles users in this role can manage.
          </p>
        </div>

        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: variant.bg, borderColor: variant.border }}
        >
          <div className="flex items-center justify-between p-4 gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div
                className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 shadow-sm"
                style={{ backgroundColor: variant.iconBg, color: variant.iconColor }}
              >
                <variant.Icon className="w-[16px] h-[16px]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 style={{ fontSize: "13.5px", fontWeight: 700, lineHeight: "1.3", color: variant.titleColor }}>
                  {title}
                </h3>
                <p className="mt-0.5" style={{ fontSize: "12.5px", fontWeight: 400, lineHeight: "1.45", color: variant.textColor, opacity: isEmpty ? 1 : 0.9 }}>
                  {desc}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(true)}
              className={`self-center shrink-0 h-8 px-3 rounded-[8px] bg-white border text-[12.5px] transition-colors cursor-pointer ${isEmpty ? "border-[#007FFF] shadow-sm hover:bg-[#EDF4FF]" : "hover:opacity-90"}`}
              style={{ fontWeight: 600, color: isEmpty ? "#007FFF" : variant.iconColor, borderColor: isEmpty ? undefined : variant.border }}
            >
              {ctaLabel}
            </button>
          </div>

          {/* Selected role chips */}
          {!isAll && !isEmpty && (
            <div
              className="px-4 py-3 border-t flex flex-wrap gap-1.5 bg-white"
              style={{ borderColor: variant.border }}
            >
              {selectedRoles.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-[11.5px] bg-white border"
                  style={{ color: "#1E293B", borderColor: "#BFDBFE", fontWeight: 500 }}
                >
                  {r.roleName}
                  <button
                    type="button"
                    onClick={() => removeRoleFromManageScope(roleId, r.id)}
                    className="ml-0.5 w-4 h-4 inline-flex items-center justify-center rounded hover:bg-[#EFF6FF] cursor-pointer"
                    aria-label={`Remove ${r.roleName}`}
                  >
                    <X className="w-3 h-3" style={{ color: "#64748B" }} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfigureRoleScopeModal
        open={open}
        onClose={() => setOpen(false)}
        roleId={roleId}
        roleName={allRoles.find((r) => r.id === roleId)?.roleName}
      />
    </>
  );
}


