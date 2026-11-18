import { useState } from "react";
import { ChevronDown, Check, Lock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { DeactivateUserModal, ArchiveUserModal } from "./ActionModals";
import { DeactivateRoleModal } from "./DeactivateRoleModal";
import { UnarchiveUserModal, type UnarchiveModalMode } from "../user-detail/UnarchiveUserModal";
import { getRoleDetail } from "../../data/role-detail-data";
import { roles } from "../../data/roles-data";

/* ─── Status visual config ───
   Note: The "Inactive" status displays as "Deactivated" on the chip
   (the action verb "Deactivate" is used in dropdown options).
   `hoverBorder` is used by interactive chips to deepen the stroke on hover. */
export const STATUS_VISUAL: Record<string, { color: string; bg: string; border: string; hoverBorder: string; label: string }> = {
  Active:           { color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", hoverBorder: "#10B981", label: "Active" },         // green-500
  Inactive:         { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", hoverBorder: "#F59E0B", label: "Deactivated" },    // amber-500
  "Invite Sent":    { color: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE", hoverBorder: "#3B82F6", label: "Invite Sent" },    // blue-500
  "Invite Expired": { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", hoverBorder: "#F59E0B", label: "Invite Expired" }, // amber-500
  Archived:         { color: "#E87171", bg: "#FEF2F2", border: "#FECACA", hoverBorder: "#EF4444", label: "Archived" },       // red-500
  "Pending Setup":  { color: "#64748B", bg: "#F8FAFC", border: "#E2E8F0", hoverBorder: "#94A3B8", label: "Draft" },          // slate-400
  Draft:            { color: "#64748B", bg: "#F8FAFC", border: "#E2E8F0", hoverBorder: "#94A3B8", label: "Draft" },          // slate-400
};

/* ─── Dropdown options use ACTION VERBS (present tense) ───
   - Currently-selected option label reflects the resulting STATE
     (Active / Deactivated / Archived) so the chip reads naturally.
   - Non-selected options read as actions (Activate / Deactivate / Archive). */
const USER_DROPDOWN_OPTIONS = [
  { key: "Active", actionLabel: "Activate", stateLabel: "Active", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", description: "User has system access and can sign in. All assigned roles, permissions, and MFA settings are in effect." },
  { key: "Inactive", actionLabel: "Deactivate", stateLabel: "Deactivated", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", description: "User cannot sign in and has no system access. License is removed and the user is no longer included in billing. All roles, permissions, and MFA settings are preserved on the user record. Reactivating the user restores all previous assignments. A license will need to be reassigned." },
  { key: "Archived", actionLabel: "Archive", stateLabel: "Archive", color: "#E87171", bg: "#FEF2F2", border: "#FECACA", description: "User is archived and removed from the active user listing. System access is revoked, license is removed, and all roles, permissions, and MFA settings are cleared from the user record. Unarchiving the user restores their profile, but roles, permissions, license, and MFA will need to be set up again." },
];

const ROLE_DROPDOWN_OPTIONS = [
  { key: "Active", actionLabel: "Activate", stateLabel: "Active", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", description: "Role is active and available for assignment. Users can be assigned to this role and will receive all associated permissions." },
  { key: "Inactive", actionLabel: "Deactivate", stateLabel: "Deactivated", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", description: "Role is deactivated. All current users will be unassigned from this role and will lose the permissions it grants. The role's permission set is preserved. Reactivating the role restores it with all its permissions intact, but previously assigned users are not automatically reassigned." },
  { key: "Archived", actionLabel: "Archive", stateLabel: "Archive", color: "#E87171", bg: "#FEF2F2", border: "#FECACA", description: "Role is archived and removed from the active roles listing. All current users and owners will be unassigned. The role's permission set is kept, and unarchiving restores the role with those permissions, ready to reassign users and owners." },
];

// Detail page context: "This user/role" copy
const USER_DETAIL_OPTIONS = [
  { key: "Active", actionLabel: "Activate", stateLabel: "Active", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", description: "This user has system access and can sign in. All assigned roles, permissions, and MFA settings are in effect." },
  { key: "Inactive", actionLabel: "Deactivate", stateLabel: "Deactivated", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", description: "This user cannot sign in and has no system access. Their license has been removed and they are not included in billing. All roles, permissions, and MFA settings are preserved on this record. Reactivating this user will restore all previous assignments. A license will need to be reassigned." },
  { key: "Archived", actionLabel: "Archive", stateLabel: "Archive", color: "#E87171", bg: "#FEF2F2", border: "#FECACA", description: "This user is archived and only appears when the Archived filter is applied. System access is revoked, license is removed, and all roles, permissions, and MFA settings have been cleared from this record. Unarchiving this user will restore their profile, but roles, permissions, license, and MFA will need to be set up again." },
];

const ROLE_DETAIL_OPTIONS = [
  { key: "Active", actionLabel: "Activate", stateLabel: "Active", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", description: "This role is active and available for assignment. Users assigned to this role receive all associated permissions." },
  { key: "Inactive", actionLabel: "Deactivate", stateLabel: "Deactivated", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", description: "This role is deactivated. It is not available for assignment and does not appear in the default roles listing. All previously assigned users have been unassigned. The role's permission set is preserved. Reactivating this role will restore it with all its permissions intact, but users will need to be reassigned manually." },
  { key: "Archived", actionLabel: "Archive", stateLabel: "Archive", color: "#E87171", bg: "#FEF2F2", border: "#FECACA", description: "This role is archived. It is not available for assignment and only appears when the Archived filter is applied. All previously assigned users and owners have been unassigned. The role's permission set is kept, and unarchiving restores the role with those permissions, ready to reassign users and owners." },
];

interface StatusDropdownProps {
  status: string;
  userName: string;
  onStatusChange: (newStatus: string) => void;
  /** Compact mode for table cells */
  compact?: boolean;
  /** Entity type for confirmation dialog text (default: "user") */
  entityType?: "user" | "role";
  /** When true, uses detail-page copy ("This user/role is...") */
  isDetailPage?: boolean;
  /** Current user license, drives Deactivate modal copy/choice. Users only. */
  userLicense?: string;
  /** Optional license change callback, fired when admin removes license alongside deactivation. */
  onLicenseChange?: (license: string) => void;
  /** User id, required so Deactivate/Archive modals can resolve owned-roles & affected assignments. */
  userId?: number;
  /** When set, the status is locked (no dropdown). Renders a static chip with
   *  a small lock icon and this text as the tooltip. Used for the protected
   *  role's holder, whose status can't be changed. */
  lockedReason?: string;
  /** When true, the locked chip is subtly greyed to signal it is excluded from
   *  the active bulk action (e.g. a protected user during bulk status changes). */
  dimmed?: boolean;
  /** When true, the locked chip omits the small lock icon (still non-interactive,
   *  still shows the tooltip). Used for predefined roles, where the row already
   *  carries a lock badge and a second lock reads as clutter. */
  hideLockIcon?: boolean;
  /** Users only. Hands the Reactivate / Unarchive flow to a caller that owns
   *  those modals itself (the detail page, which also records the invite
   *  context the restore leaves behind). Without it the chip runs the flow. */
  onRestoreRequest?: (mode: UnarchiveModalMode) => void;
}

export function StatusDropdown({ status, userName, onStatusChange, compact = false, entityType = "user", isDetailPage = false, userLicense, onLicenseChange, userId, lockedReason, dimmed = false, hideLockIcon = false, onRestoreRequest }: StatusDropdownProps) {
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreMode, setRestoreMode] = useState<UnarchiveModalMode>("reactivate");
  const [hovered, setHovered] = useState(false);

  const vis = STATUS_VISUAL[status] || STATUS_VISUAL.Active;

  /* Choosing Active on a Deactivated or Archived user is a restore, not a
   * status flip: it runs the same Reactivate / Unarchive stepper as the
   * actions menu, so the license and roles are confirmed first. Reactivate
   * then lands at Active, Unarchive at Invite Sent or Draft (ERP-5203,
   * 18 Sep and 1 Oct 2026). The modal is built once so it can outlive the
   * dropdown, since a finished restore turns this chip static. */
  /* The chip's modals portal out of the DOM but not out of the React tree, so
   * a click inside one (the backdrop, say) still bubbles to the listing row
   * and opens the user. Every modal below sits behind this boundary. */
  const stopRowClick = (e: React.MouseEvent) => e.stopPropagation();

  const restoreModal =
    entityType === "user" && userId !== undefined && !onRestoreRequest ? (
      <UnarchiveUserModal
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        userId={userId}
        wasInvitePending={false}
        onStatusChange={onStatusChange}
        onLicenseChange={onLicenseChange}
        mode={restoreMode}
      />
    ) : null;

  // Locked: protected last-holder, show the status but block any change.
  if (lockedReason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] cursor-not-allowed select-none"
            style={{
              fontWeight: 600,
              backgroundColor: vis.bg,
              color: vis.color,
              borderColor: vis.border,
              opacity: dimmed ? 0.45 : 1,
              transition: "opacity 180ms ease",
            }}
          >
            {vis.label}
            {!hideLockIcon && (
              <Lock className="w-2.5 h-2.5" style={{ color: vis.color, opacity: 0.7 }} />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="max-w-[300px] bg-white text-foreground">
          {lockedReason}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Draft (roles): system-managed, non-interactive. It can't be set by hand,
  // it flips to Active the moment the role is given permissions. Explain that
  // in a tooltip so the gray chip doesn't read as a dead end.
  if (status === "Draft") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] cursor-help select-none"
            style={{ fontWeight: 600, backgroundColor: vis.bg, color: vis.color, borderColor: vis.border }}
          >
            {vis.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="max-w-[280px] bg-white text-foreground">
          This role has no permissions yet, so it can't be used. It becomes Active automatically once you set up its permissions.
        </TooltipContent>
      </Tooltip>
    );
  }

  // Non-interactive statuses: show static badge
  const isStatic = status === "Pending Setup" || status === "Invite Expired" || status === "Invite Sent";
  if (isStatic) {
    return (
      <>
        <span
          className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px]"
          style={{ fontWeight: 600, backgroundColor: vis.bg, color: vis.color, borderColor: vis.border }}
        >
          {vis.label}
        </span>
        <span className="contents" onClick={stopRowClick}>{restoreModal}</span>
      </>
    );
  }

  const restoreFrom: UnarchiveModalMode | null =
    entityType !== "user" ? null
    : status === "Inactive" ? "reactivate"
    : status === "Archived" ? "unarchive"
    : null;

  const handleSelect = (key: string) => {
    if (key === "Active" && restoreFrom) {
      if (onRestoreRequest) {
        onRestoreRequest(restoreFrom);
      } else {
        setRestoreMode(restoreFrom);
        setRestoreOpen(true);
      }
    } else if (key === "Inactive") {
      setShowDeactivate(true);
    } else if (key === "Archived") {
      setShowArchive(true);
    } else {
      onStatusChange(key);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={`inline-flex items-center gap-1 rounded-full border cursor-pointer ${compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-[11px]"}`}
            style={{
              fontWeight: 600,
              backgroundColor: vis.bg,
              color: vis.color,
              borderColor: hovered ? vis.hoverBorder : vis.border,
              // 0.5px outer ring on hover stacks with the 1px border to read as a 1.5px stroke,
              // without changing border-width (which would shift the chip's position).
              boxShadow: hovered ? `0 0 0 0.5px ${vis.hoverBorder}` : "none",
              transition: "border-color 180ms ease, box-shadow 180ms ease",
            }}
          >
            {vis.label}
            <ChevronDown className="w-3 h-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[320px] p-1.5 space-y-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {(entityType === "role"
            ? (isDetailPage ? ROLE_DETAIL_OPTIONS : ROLE_DROPDOWN_OPTIONS)
            : (isDetailPage ? USER_DETAIL_OPTIONS : USER_DROPDOWN_OPTIONS)
          ).map((opt) => {
            const isSelected = status === opt.key;
            return (
              <DropdownMenuItem
                key={opt.key}
                className="flex flex-col items-start gap-1 px-3 py-2.5 cursor-pointer rounded-md border transition-all focus:bg-transparent data-[highlighted]:bg-transparent"
                style={{
                  backgroundColor: isSelected ? "#F8FBFF" : "transparent",
                  borderColor: isSelected ? "#D0E3F7" : "transparent",
                }}
                onSelect={() => handleSelect(opt.key)}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "#F8FAFC";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                  }
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className="inline-flex items-center rounded-full border px-2 py-px text-[13px]"
                    style={{ fontWeight: 600, backgroundColor: opt.bg, color: opt.color, borderColor: opt.border }}
                  >
                    {isSelected ? opt.stateLabel : opt.actionLabel}
                  </span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#64748B" }} />
                  )}
                </div>
                <p className="text-[13px] leading-[18px]" style={{ color: "#64748B", fontWeight: 400 }}>
                  {opt.description}
                </p>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation modals */}
      <span className="contents" onClick={stopRowClick}>
        {entityType === "role" ? (
          <DeactivateRoleModal
            open={showDeactivate}
            onClose={() => setShowDeactivate(false)}
            roleName={userName}
            usersCount={(() => {
              const r = roles.find((ro) => ro.roleName === userName);
              return r?.usersCount ?? 0;
            })()}
            assignedUserIds={(() => {
              const r = roles.find((ro) => ro.roleName === userName);
              if (!r) return [];
              return getRoleDetail(r.id)?.assignedUserIds ?? [];
            })()}
            onConfirm={() => {
              setShowDeactivate(false);
              onStatusChange("Inactive");
            }}
          />
        ) : (
          <DeactivateUserModal
            open={showDeactivate}
            onClose={() => setShowDeactivate(false)}
            userName={userName}
            userId={userId}
            userLicense={userLicense}
            onConfirm={(removeLicense) => {
              setShowDeactivate(false);
              onStatusChange("Inactive");
              if (removeLicense) onLicenseChange?.("No License");
            }}
          />
        )}
        {entityType === "role" ? (
          <DeactivateRoleModal
            open={showArchive}
            onClose={() => setShowArchive(false)}
            roleName={userName}
            usersCount={(() => {
              const r = roles.find((ro) => ro.roleName === userName);
              return r?.usersCount ?? 0;
            })()}
            assignedUserIds={(() => {
              const r = roles.find((ro) => ro.roleName === userName);
              if (!r) return [];
              return getRoleDetail(r.id)?.assignedUserIds ?? [];
            })()}
            onConfirm={() => {
              setShowArchive(false);
              onStatusChange("Archived");
            }}
            variant="archive"
          />
        ) : (
          <ArchiveUserModal
            open={showArchive}
            onClose={() => setShowArchive(false)}
            userName={userName}
            userId={userId}
            userLicense={userLicense}
            isDeactivated={status === "Inactive"}
            onConfirm={() => {
              setShowArchive(false);
              onStatusChange("Archived");
              // Archiving a user always revokes their license, no opt-out.
              onLicenseChange?.("No License");
            }}
          />
        )}
        {restoreModal}
      </span>
    </>
  );
}
