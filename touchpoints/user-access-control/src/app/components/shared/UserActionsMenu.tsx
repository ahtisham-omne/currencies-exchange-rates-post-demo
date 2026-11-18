import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  MoreHorizontal,
  ArrowUpCircle,
  ArrowDownCircle,
  Shield,
  KeyRound,
  Ban,
  Archive,
  Send,
  ShieldOff,
  ToggleRight,
  MailX,
  Pencil,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  ResetPasswordModal,
  DeactivateUserModal,
  ArchiveUserModal,
  RemoveLicenseModal,
  DowngradeUserModal,
  CancelInvitationModal,
} from "./ActionModals";
import {
  UpgradeLicenseModal,
} from "./LicenseModals";
import { UnarchiveUserModal } from "../user-detail/UnarchiveUserModal";
import { ResetMfaModal } from "./ResetMfaModal";
import { EditUserModal } from "../user-detail/EditUserModal";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { useAccountOwnerLicenseGate } from "./AccountOwnerLicenseGate";
import { LockedMenuItem } from "./LockedMenuItem";
import { useAccessMode, useGate } from "../access-mode";

/* ─── Shape of user data the menu needs ─── */
export interface UserActionsUser {
  id: number;
  fullName: string;
  email: string;
  license: string;
  status: string;
}

interface UserActionsMenuProps {
  user: UserActionsUser;
  /** Render mode: "icon" = 3-dot button (table), "pill" = "Actions ▼" pill (detail page) */
  variant?: "icon" | "pill";
  /** Custom trigger override */
  trigger?: ReactNode;
  /** Show license management actions (Upgrade / Downgrade / Remove) */
  showLicenseActions?: boolean;
  /** Show Archive item (table only, detail page omits it) */
  showArchive?: boolean;
  /** Show "Resend Invitation" for invite-pending users (table listing only,
   *  the detail page has a dedicated resend button instead). */
  showResendInvite?: boolean;
  /** Show "Edit User's Details" (table listing only, the detail page has its
   *  own dedicated Edit button, so it omits this menu item). */
  showEditDetails?: boolean;
  /** "Manage roles" handler, table navigates, detail page switches tab */
  onManageRoles?: () => void;
  /** Status change callbacks (detail page local state) */
  onStatusChange?: (status: string) => void;
  /** License change callback (table cell local state) */
  onLicenseChange?: (license: string) => void;
  /** Whether to stop propagation on row clicks */
  stopRowPropagation?: boolean;
}

export function UserActionsMenu({
  user,
  variant = "icon",
  trigger,
  showLicenseActions = false,
  showArchive = false,
  showResendInvite = false,
  showEditDetails = false,
  onManageRoles,
  onStatusChange,
  onLicenseChange,
  stopRowPropagation = false,
}: UserActionsMenuProps) {
  const navigate = useNavigate();
  const access = useAccessMode();
  const gate = useGate();
  const [resetOpen, setResetOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const [removeLicenseOpen, setRemoveLicenseOpen] = useState(false);
  const [unarchiveOpen, setUnarchiveOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [resetMfaOpen, setResetMfaOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelInviteOpen, setCancelInviteOpen] = useState(false);

  const stop = (e: React.MouseEvent | React.SyntheticEvent) => {
    if (stopRowPropagation) e.stopPropagation();
  };

  const handleManageRoles = () => {
    if (onManageRoles) {
      onManageRoles();
    } else {
      navigate(
        `/company-settings/user-access-control/user/${user.id}?tab=roles`
      );
    }
  };

  const defaultTrigger =
    variant === "pill" ? (
      <button
        type="button"
        className="rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#334155] inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm h-9 px-3.5 text-[13px]"
        style={{ fontWeight: 500 }}
      >
        Actions
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

  const isArchived = user.status === "Archived";
  const isDeactivated = user.status === "Inactive";
  const isInvitePending =
    user.status === "Invite Sent" || user.status === "Invite Expired";

  /* Account Owner (any holder): Deactivate / Archive stay visible but
   * disabled, with the reason on hover (ERP-5150 AC13). */
  const { owner, guard: licenseGuard, gateModal } = useAccountOwnerLicenseGate(user.id);
  const lifecycleLocked = !owner.lifecycle.allowed;
  const protectedTip = owner.lifecycle.reason;
  /* Downgrade and Remove License on an Account Owner (ERP-5150 AC15). */
  const licenseLocked = !owner.lowerLicense.allowed;

  /* ─── Access gating ───
   *
   * Visibility is never the capability alone, it is always
   * `capability && statusAllows`. Every item's flag is resolved up front so
   * `hasAnyAction` can collapse the trigger itself: when the persona may do
   * nothing to this user, the kebab / Actions pill disappears rather than
   * opening onto an empty panel.
   *
   * Note the status branches are mutually exclusive in the markup below, so
   * each flag carries its own branch condition and the three groups can be
   * OR-ed into one `hasAnyAction`. */
  const isActiveBranch = !isArchived && !isDeactivated;

  /* Each item passes its status half and its capability half separately, so a
   * state-forbidden item always disappears while a capability-forbidden one
   * follows the header's hidden/disabled setting. */
  const gUnarchive = gate(isArchived, access.canArchiveUser);

  const gReactivate = gate(isDeactivated, access.canArchiveUser);
  const gDeactivatedArchive = gate(isDeactivated && showArchive, access.canArchiveUser);
  const gDeactivatedRemoveLicense = gate(
    isDeactivated && showLicenseActions && user.license !== "No License",
    access.canManageLicenses,
  );
  const hasDeactivatedDestructive =
    gDeactivatedArchive.render || gDeactivatedRemoveLicense.render;

  /* An Account Owner who hasn't accepted yet is the company's only way to an
   * owner: cancelling their invitation drops them to Draft with nobody left
   * to claim, and their details are the owner's or Omne's to change. So
   * neither Edit nor Cancel Invitation is offered on that row (tenant
   * onboarding review, Fatima, Nov 10 2026). A wrong address is corrected
   * by the setup person from Home before the owner claims. */
  const pendingOwner = owner.isOwner && isInvitePending;
  const gEdit = gate(isActiveBranch && showEditDetails && !pendingOwner, access.canCreateEditUser);
  const gResend = gate(isActiveBranch && showResendInvite && isInvitePending, access.canInvite);
  /* Cancel Invitation is offered wherever an invite is actually outstanding,
   * so unlike Resend it carries no surface flag: the listing and the detail
   * page both show it. "Invite Expired" is deliberately excluded, that link is
   * already dead and Resend is the only useful move. */
  const gCancelInvite = gate(
    isActiveBranch && user.status === "Invite Sent" && !pendingOwner,
    access.canInvite,
  );
  const gUpgrade = gate(
    isActiveBranch && showLicenseActions && user.license !== "Full Access",
    access.canManageLicenses,
  );
  const gDowngrade = gate(
    isActiveBranch && showLicenseActions && user.license !== "Field User",
    access.canManageLicenses,
  );
  /* Manage Roles navigates to the role-assignment surface, so it belongs to
   * ur-assign-roles rather than to plain user editing. */
  const gManageRoles = gate(isActiveBranch, access.canAssignRoles);
  const gResetPassword = gate(isActiveBranch && !isInvitePending, access.canResetCredentials);
  const gSendInvite = gate(isActiveBranch && user.status === "Pending Setup", access.canInvite);
  /* Only an Active user can be deactivated (ERP-5203, ruled 18 Sep 2026).
   * Deactivated is a state you can only arrive at from Active: a user is
   * created, and restored, into Draft or Invite Sent alone, so offering
   * Deactivate on a Draft or invited user offers a transition the rest of the
   * product has no way to produce. */
  const gDeactivate = gate(user.status === "Active", access.canArchiveUser);
  const gActiveArchive = gate(isActiveBranch && showArchive, access.canArchiveUser);
  const gResetMfa = gate(isActiveBranch && !isInvitePending, access.canResetCredentials);
  const gRemoveLicense = gate(
    isActiveBranch && showLicenseActions && user.license !== "No License",
    access.canManageLicenses,
  );

  /* The separator only earns its place when something sits on both sides. */
  const hasActiveTopGroup =
    gEdit.render || gResend.render || gUpgrade.render || gDowngrade.render ||
    gManageRoles.render || gResetPassword.render || gSendInvite.render;
  const hasActiveBottomGroup =
    gCancelInvite.render || gDeactivate.render || gActiveArchive.render ||
    gResetMfa.render || gRemoveLicense.render;

  const hasAnyAction =
    gUnarchive.render ||
    gReactivate.render ||
    hasDeactivatedDestructive ||
    hasActiveTopGroup ||
    hasActiveBottomGroup;

  /* Collapse the whole container, not just its contents. Every modal below is
   * reachable only from an item above, so nothing is orphaned by returning
   * early here. */
  if (!hasAnyAction) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={stop}>
          {trigger ?? defaultTrigger}
        </DropdownMenuTrigger>
        {/* Items act from `onSelect` and never call preventDefault on it, so
            Radix closes the menu as the action fires and no dropdown is left
            hanging behind the modal it opened. The only preventDefault calls
            below sit on disabled items, which should keep the menu open so
            their explanatory tooltip stays readable. */}
        <DropdownMenuContent
          align="end"
          className="w-[230px]"
          onClick={stop}
        >
          {isArchived ? (
            gUnarchive.render && (
              <DropdownMenuItem
                className={gUnarchive.disabled ? "gap-2 cursor-not-allowed" : "cursor-pointer gap-2"}
                disabled={gUnarchive.disabled}
                title={gUnarchive.reason || undefined}
                onClick={() => setUnarchiveOpen(true)}
              >
                <Archive className="w-3.5 h-3.5" style={{ color: "#007FFF" }} />
                <span style={{ color: "#007FFF" }}>Unarchive User</span>
              </DropdownMenuItem>
            )
          ) : isDeactivated ? (
            <>
              {gReactivate.render && (
                <DropdownMenuItem
                  className={gReactivate.disabled ? "gap-2 cursor-not-allowed" : "cursor-pointer gap-2"}
                  disabled={gReactivate.disabled}
                  title={gReactivate.reason || undefined}
                  onClick={() => setReactivateOpen(true)}
                >
                  <ToggleRight className="w-3.5 h-3.5" style={{ color: "#007FFF" }} />
                  <span style={{ color: "#007FFF" }}>Reactivate User</span>
                </DropdownMenuItem>
              )}
              {gReactivate.render && hasDeactivatedDestructive && <DropdownMenuSeparator />}
              {gDeactivatedArchive.render && (lifecycleLocked ? (
                <LockedMenuItem reason={protectedTip}>
                  <Archive className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
                  Archive User
                </LockedMenuItem>
              ) : (
                <DropdownMenuItem
                  className={`gap-2 text-[#DC2626] focus:text-[#DC2626] ${gDeactivatedArchive.disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                  disabled={gDeactivatedArchive.disabled}
                  title={gDeactivatedArchive.reason || undefined}
                  onClick={() => setArchiveOpen(true)}
                >
                  <Archive className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
                  Archive User
                </DropdownMenuItem>
              ))}
              {gDeactivatedRemoveLicense.render && (licenseLocked ? (
                <LockedMenuItem reason={owner.lowerLicense.reason}>
                  <Ban className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
                  Remove License
                </LockedMenuItem>
              ) : (
                <DropdownMenuItem
                  className={`gap-2 text-[#DC2626] focus:text-[#DC2626] ${gDeactivatedRemoveLicense.disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                  disabled={gDeactivatedRemoveLicense.disabled}
                  title={gDeactivatedRemoveLicense.reason || undefined}
                  onClick={() => licenseGuard(() => setRemoveLicenseOpen(true))}
                >
                  <Ban className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
                  Remove License
                </DropdownMenuItem>
              ))}
            </>
          ) : (
          <>

          {/* Edit User's Details, table listing only. The detail page has its
              own dedicated Edit button, so it omits this. */}
          {gEdit.render && (
            <DropdownMenuItem
              disabled={gEdit.disabled}
              title={gEdit.reason || undefined}
              className={gEdit.disabled ? "gap-2 cursor-not-allowed" : "cursor-pointer gap-2"}
              onSelect={() => setEditOpen(true)}
            >
              <Pencil className="w-3.5 h-3.5 text-[#64748B]" />
              Edit User
            </DropdownMenuItem>
          )}

          {/* Resend Invitation, invite-pending users, table listing only.
              First action; same black-text theme as Manage Roles. */}
          {gResend.render && (
            <DropdownMenuItem
              disabled={gResend.disabled}
              title={gResend.reason || undefined}
              className={gResend.disabled ? "gap-2 cursor-not-allowed" : "cursor-pointer gap-2"}
              onClick={() => {
                toast.success(`Invitation resent to ${user.email}`);
                onStatusChange?.("Invite Sent");
              }}
            >
              <Send className="w-3.5 h-3.5 text-[#64748B]" />
              Resend Invitation
            </DropdownMenuItem>
          )}

          {/* License management, table only */}
          {gUpgrade.render && (
            <DropdownMenuItem
              disabled={gUpgrade.disabled}
              title={gUpgrade.reason || undefined}
              className={gUpgrade.disabled ? "gap-2 cursor-not-allowed" : "cursor-pointer gap-2"}
              onClick={() => setUpgradeOpen(true)}
            >
              <ArrowUpCircle
                className="w-3.5 h-3.5"
                style={{ color: "#7C3AED" }}
              />
              <span style={{ color: "#7C3AED" }}>Upgrade to Full Access</span>
            </DropdownMenuItem>
          )}
          {/* Downgrade from Full Access lowers the license: an Account Owner's
              is locked to other users (ERP-5150 AC15). From No License it is
              an upgrade and stays open. */}
          {gDowngrade.render && user.license === "Full Access" && licenseLocked ? (
            <LockedMenuItem reason={owner.lowerLicense.reason} className="gap-2 whitespace-nowrap">
              <ArrowDownCircle className="w-3.5 h-3.5 text-[#64748B]" />
              Downgrade to Field User
            </LockedMenuItem>
          ) : gDowngrade.render && (
            <DropdownMenuItem
              disabled={gDowngrade.disabled}
              title={gDowngrade.reason || undefined}
              className={`gap-2 whitespace-nowrap ${gDowngrade.disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
              onClick={() =>
                user.license === "Full Access"
                  ? licenseGuard(() => setDowngradeOpen(true))
                  : setDowngradeOpen(true)
              }
            >
              <ArrowDownCircle className="w-3.5 h-3.5 text-[#64748B]" />
              {user.license === "Full Access"
                ? "Downgrade to Field User"
                : "Change to Field User"}
            </DropdownMenuItem>
          )}
          {/* Manage Roles */}
          {gManageRoles.render && (
            <DropdownMenuItem
              disabled={gManageRoles.disabled}
              title={gManageRoles.reason || undefined}
              className={gManageRoles.disabled ? "gap-2 cursor-not-allowed" : "cursor-pointer gap-2"}
              onSelect={() => handleManageRoles()}
            >
              <Shield className="w-3.5 h-3.5 text-[#64748B]" />
              Manage Roles
            </DropdownMenuItem>
          )}

          {/* Reset Password, hidden for invite-pending users */}
          {gResetPassword.render && (
            <DropdownMenuItem
              disabled={gResetPassword.disabled}
              title={gResetPassword.reason || undefined}
              className={gResetPassword.disabled ? "gap-2 cursor-not-allowed" : "cursor-pointer gap-2"}
              onClick={() => setResetOpen(true)}
            >
              <KeyRound className="w-3.5 h-3.5 text-[#64748B]" />
              Reset Password
            </DropdownMenuItem>
          )}

          {/* Send invite, detail page only state */}
          {gSendInvite.render && (
            <DropdownMenuItem
              disabled={gSendInvite.disabled}
              title={gSendInvite.reason || undefined}
              className={gSendInvite.disabled ? "gap-2 cursor-not-allowed" : "cursor-pointer gap-2"}
              onClick={() => {
                toast.success(`Invitation sent to ${user.email}`);
                onStatusChange?.("Invite Sent");
              }}
            >
              <Send className="w-3.5 h-3.5 text-[#64748B]" />
              Send Invitation
            </DropdownMenuItem>
          )}

          {hasActiveTopGroup && hasActiveBottomGroup && <DropdownMenuSeparator />}

          {/* Cancel Invitation (red). Leads the destructive group: for an
              invited user it is the action most specific to their state, and
              it pairs with Resend Invitation above. */}
          {gCancelInvite.render && (
            <DropdownMenuItem
              disabled={gCancelInvite.disabled}
              title={gCancelInvite.reason || undefined}
              className={`gap-2 text-[#DC2626] focus:text-[#DC2626] ${gCancelInvite.disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
              onSelect={() => setCancelInviteOpen(true)}
            >
              <MailX className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
              Cancel Invitation
            </DropdownMenuItem>
          )}

          {/* Deactivate (amber). Disabled for an Account Owner. */}
          {gDeactivate.render && (lifecycleLocked ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <DropdownMenuItem
                    disabled
                    className="gap-2 opacity-50 cursor-not-allowed"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Ban className="w-3.5 h-3.5" style={{ color: "#D97706" }} />
                    Deactivate User
                  </DropdownMenuItem>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[280px] text-xs">
                {protectedTip}
              </TooltipContent>
            </Tooltip>
          ) : (
            <DropdownMenuItem
              disabled={gDeactivate.disabled}
              title={gDeactivate.reason || undefined}
              className={`gap-2 text-[#D97706] focus:text-[#D97706] ${gDeactivate.disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
              onClick={() => setDeactivateOpen(true)}
            >
              <Ban className="w-3.5 h-3.5" style={{ color: "#D97706" }} />
              Deactivate User
            </DropdownMenuItem>
          ))}

          {/* Archive (red, table only). Disabled for an Account Owner. */}
          {gActiveArchive.render && (
            lifecycleLocked ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <DropdownMenuItem
                      disabled
                      className="gap-2 opacity-50 cursor-not-allowed"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Archive className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
                      Archive User
                    </DropdownMenuItem>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[280px] text-xs">
                  {protectedTip}
                </TooltipContent>
              </Tooltip>
            ) : (
              <DropdownMenuItem
                disabled={gActiveArchive.disabled}
                title={gActiveArchive.reason || undefined}
                className={`gap-2 text-[#DC2626] focus:text-[#DC2626] ${gActiveArchive.disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                onClick={() => setArchiveOpen(true)}
              >
                <Archive className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
                Archive User
              </DropdownMenuItem>
            )
          )}

          {/* Reset MFA, red, hidden for invite-pending users */}
          {gResetMfa.render && (
            <DropdownMenuItem
              disabled={gResetMfa.disabled}
              title={gResetMfa.reason || undefined}
              className={`gap-2 text-[#DC2626] focus:text-[#DC2626] ${gResetMfa.disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
              onClick={() => setResetMfaOpen(true)}
            >
              <ShieldOff className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
              Reset MFA
            </DropdownMenuItem>
          )}

          {/* Remove License, red, below Archive */}
          {gRemoveLicense.render && (licenseLocked ? (
            <LockedMenuItem reason={owner.lowerLicense.reason}>
              <Ban className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
              Remove License
            </LockedMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={gRemoveLicense.disabled}
              title={gRemoveLicense.reason || undefined}
              className={`gap-2 text-[#DC2626] focus:text-[#DC2626] ${gRemoveLicense.disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
              onClick={() => licenseGuard(() => setRemoveLicenseOpen(true))}
            >
              <Ban className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
              Remove License
            </DropdownMenuItem>
          ))}
          </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ─── Modals ─── */}
      <ResetPasswordModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        email={user.email}
        userName={user.fullName}
      />
      <DeactivateUserModal
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        userName={user.fullName}
        userId={user.id}
        userLicense={user.license}
        onConfirm={(removeLicense) => {
          onStatusChange?.("Inactive");
          if (removeLicense) onLicenseChange?.("No License");
        }}
      />
      <ArchiveUserModal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        userName={user.fullName}
        userId={user.id}
        userLicense={user.license}
        isDeactivated={user.status === "Inactive"}
        onConfirm={(removeLicense) => {
          onStatusChange?.("Archived");
          if (removeLicense) onLicenseChange?.("No License");
        }}
      />

      {showLicenseActions && (
        <>
          <UpgradeLicenseModal
            open={upgradeOpen}
            onClose={() => setUpgradeOpen(false)}
            userName={user.fullName}
            userEmail={user.email}
            onConfirm={() => onLicenseChange?.("Full Access")}
          />
          <DowngradeUserModal
            open={downgradeOpen}
            onClose={() => setDowngradeOpen(false)}
            userName={user.fullName}
            userEmail={user.email}
            userId={user.id}
            userLicense={user.license}
            targetLicense="Field User"
            onConfirm={() => onLicenseChange?.("Field User")}
          />
          <RemoveLicenseModal
            open={removeLicenseOpen}
            onClose={() => setRemoveLicenseOpen(false)}
            userName={user.fullName}
            userId={user.id}
            userLicense={user.license}
            onConfirm={() => {
              // License and status are separate axes: the user keeps their
              // status and can no longer sign in (ERP-5184 AC4).
              onLicenseChange?.("No License");
            }}
          />
          {gateModal}
        </>
      )}

      <UnarchiveUserModal
        open={unarchiveOpen}
        onClose={() => setUnarchiveOpen(false)}
        userId={user.id}
        wasInvitePending={false}
        onStatusChange={(s) => onStatusChange?.(s)}
        onLicenseChange={(l) => onLicenseChange?.(l)}
      />

      <UnarchiveUserModal
        open={reactivateOpen}
        onClose={() => setReactivateOpen(false)}
        userId={user.id}
        wasInvitePending={false}
        onStatusChange={(s) => onStatusChange?.(s)}
        onLicenseChange={(l) => onLicenseChange?.(l)}
        mode="reactivate"
      />

      <CancelInvitationModal
        open={cancelInviteOpen}
        onClose={() => setCancelInviteOpen(false)}
        userName={user.fullName}
        email={user.email}
        onConfirm={() => onStatusChange?.("Pending Setup")}
      />

      <ResetMfaModal
        open={resetMfaOpen}
        onClose={() => setResetMfaOpen(false)}
        userName={user.fullName}
        userEmail={user.email}
        userId={user.id}
      />

      {showEditDetails && (
        <EditUserModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          userId={user.id}
        />
      )}
    </>
  );
}
