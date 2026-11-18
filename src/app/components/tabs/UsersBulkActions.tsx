import { useState, useMemo } from "react";
import { isNewTenant } from "../../data/tenant";
import { companyDailySpend } from "../../lib/license-billing";
import {
  KeyRound,
  Ban,
  Archive,
  ChevronDown,
  ArrowUpCircle,
  ArrowDownCircle,
  MinusCircle,
  Download,
  Info,
  Shield,
  ShieldAlert,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../components/ui/tooltip";
import { DestructiveConfirmModal } from "../shared/DestructiveConfirmModal";
import { DeactivateUserModal, ArchiveUserModal } from "../shared/ActionModals";
import { UpgradeLicenseModal } from "../shared/LicenseModals";
import { DeactivateUserWizard } from "../user-detail/DeactivateUserWizard";
import { users as allUsers } from "../../data/users-data";
import { updateUserRowState } from "../../data/users-row-store";
import { ACCOUNT_OWNER_COPY, isAccountOwner } from "../../data/account-owner";
import { resolveUserAvatar, getAvatarTint, getInitials } from "../../lib/avatar";
import { useAccessMode, useGate, useShownGate } from "../access-mode";

interface UsersBulkActionsProps {
  selectedCount: number;
  selectedIds: Set<number | string>;
  onCancel: () => void;
  onExport?: () => void;
  onDeactivateSelected?: () => void;
  onArchiveSelected?: () => void;
  /** When true (Archived filter active), no bulk actions are offered. Archived
   *  users are never exported or changed in bulk, so the bar shows an
   *  explanatory note instead of action buttons. */
  archivedContext?: boolean;
}

export function UsersBulkActions({ selectedCount, selectedIds, onCancel, onExport, onDeactivateSelected, onArchiveSelected, archivedContext = false }: UsersBulkActionsProps) {
  const access = useAccessMode();
  const gate = useGate();
  const shownGate = useShownGate();
  const [resetOpen, setResetOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const [pendingDeactivateRemoveLicense, setPendingDeactivateRemoveLicense] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const [nonBillableOpen, setNonBillableOpen] = useState(false);
  const [sendInviteOpen, setSendInviteOpen] = useState(false);

  // Compute license counts from selected users, all users are eligible for any license change
  const { upgradeCount, downgradeCount, nonBillableCount, upgradeUsers, downgradeUsers, nonBillableUsers, upgradeIds, downgradeIds, nonBillableIds, licensedSelectedCount, statusEligibleIds, statusEligibleCount, statusLicensedCount, deactivateEligibleIds, deactivateEligibleCount, deactivateLicensedCount, nonActiveExcludedCount, excludedProtectedUsers, licenseExcludedOwners, draftUsers, draftIds, draftCount } = useMemo(() => {
    const selected = allUsers.filter((u) => selectedIds.has(u.id));
    // Account Owners (any holder) can't have their status changed by another
    // user, so bulk Deactivate/Archive skip them and their counts
    // (ERP-5171 AC18, ERP-5173 AC14).
    const statusEligible = selected.filter((u) => !isAccountOwner(u.id));
    const excludedProtected = selected.filter((u) => isAccountOwner(u.id));
    // Draft users (Pending Setup): profile created but no invitation sent yet.
    // They're the only ones the bulk "Send invitation" action targets.
    const draft = selected.filter((u) => u.status === "Pending Setup");
    const toUpgrade = selected.filter((u) => u.license !== "Full Access");
    // Only an Active user can be deactivated (ERP-5203), so bulk Deactivate
    // leaves out everyone else in the selection, and says how many.
    const deactivateEligible = statusEligible.filter((u) => u.status === "Active");
    // Only the Account Owner lowers or removes their own license, so bulk
    // Downgrade and Remove License leave every owner out (ERP-5184 AC8,
    // ERP-5186 AC8). Upgrading an owner stays open to anyone (ERP-5184 AC9).
    const licenseLowerable = selected.filter((u) => !isAccountOwner(u.id));
    const toDowngrade = licenseLowerable.filter((u) => u.license !== "Field User");
    const toNonBillable = licenseLowerable.filter((u) => u.license !== "No License");
    const licensed = selected.filter((u) => u.license && u.license !== "No License");

    return {
      upgradeCount: toUpgrade.length,
      downgradeCount: toDowngrade.length,
      nonBillableCount: toNonBillable.length,
      upgradeUsers: toUpgrade.map((u) => ({ name: u.fullName, email: u.email })),
      downgradeUsers: toDowngrade.map((u) => ({ name: u.fullName, email: u.email })),
      nonBillableUsers: toNonBillable.map((u) => ({ name: u.fullName, email: u.email })),
      upgradeIds: toUpgrade.map((u) => u.id),
      downgradeIds: toDowngrade.map((u) => u.id),
      nonBillableIds: toNonBillable.map((u) => u.id),
      licensedSelectedCount: licensed.length,
      statusEligibleIds: statusEligible.map((u) => u.id),
      statusEligibleCount: statusEligible.length,
      statusLicensedCount: statusEligible.filter((u) => u.license && u.license !== "No License").length,
      deactivateEligibleIds: deactivateEligible.map((u) => u.id),
      deactivateEligibleCount: deactivateEligible.length,
      deactivateLicensedCount: deactivateEligible.filter((u) => u.license && u.license !== "No License").length,
      nonActiveExcludedCount: statusEligible.length - deactivateEligible.length,
      excludedProtectedUsers: excludedProtected.map((u) => ({ id: u.id, name: u.fullName })),
      licenseExcludedOwners: excludedProtected
        .filter((u) => u.license !== "No License")
        .map((u) => u.fullName),
      draftUsers: draft.map((u) => ({ id: u.id, name: u.fullName, email: u.email })),
      draftIds: draft.map((u) => u.id),
      draftCount: draft.length,
    };
  }, [selectedIds]);

  const hasDraftSelected = draftCount > 0;

  const handleConfirmSendInvite = () => {
    draftIds.forEach((id) => updateUserRowState(id, { status: "Invite Sent" }));
    toast.success(
      `Invitation sent to ${draftCount} user${draftCount !== 1 ? "s" : ""}`,
    );
    onCancel();
  };

  const hasExcluded = excludedProtectedUsers.length > 0;

  /* ─── Access gating ───
   *
   * Declared before the button definitions below, which read `gDeactivate` and
   * `gArchive`. Each
   * action passes its selection/status half and its capability half separately,
   * so an ineligible selection always hides the button while a capability
   * denial follows the header's hidden/disabled setting. */
  const gLicense = gate(true, access.canBulkEdit && access.canBulkLicense);
  const gReset = gate(true, access.canBulkEdit && access.canResetCredentials);
  /* Export needs only Bulk Export Users and Roles, not the bulk master switch
   * (ERP-5550 AC5), and is shown disabled without it rather than hidden (AC3). */
  const gExport = shownGate(true, access.canExportUsers);
  const gInvite = gate(hasDraftSelected, access.canBulkEdit && access.canInvite);
  /* Deactivate and Archive are separate catalogue permissions since ERP-5550
   * (ur-bulk-deactivate-users and ur-bulk-archive), so they gate separately: a
   * level may hold one without the other. */
  const gDeactivate = gate(true, access.canBulkEdit && access.canBulkDeactivateUsers);
  const gArchive = gate(true, access.canBulkEdit && access.canBulkArchive);
  const showBulkLicense = gLicense.render;
  const showBulkReset = gReset.render;
  const showBulkExport = gExport.render;
  const showBulkInvite = gInvite.render;
  const showBulkDeactivate = gDeactivate.render;
  const showBulkArchive = gArchive.render;
  const hasAnyBulkAction =
    showBulkLicense || showBulkReset || showBulkExport || showBulkInvite ||
    showBulkDeactivate || showBulkArchive;

  // Rich hover card (styled like the storage-pool popover) explaining which
  // protected users are skipped from a bulk status change and why.
  const renderExcludedCard = (action: "deactivated" | "archived") => {
    const owners = excludedProtectedUsers.length;
    const nonActive = action === "deactivated" ? nonActiveExcludedCount : 0;
    const n = owners + nonActive;
    return (
      <div className="w-[300px] -mx-3 -my-1.5 text-left">
        {/* Header */}
        <div className="flex items-start gap-2.5 px-3.5 py-3 border-b border-border/60">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#FEF3C7" }}>
            <ShieldAlert className="w-4 h-4" style={{ color: "#B45309" }} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-foreground leading-tight">
              {n === 1 ? "1 user can't be " : `${n} users can't be `}{action}
            </div>
            <div className="text-[12px] text-muted-foreground leading-tight mt-0.5">
              {owners > 0 ? "Account Owners are protected" : "Only Active users can be deactivated"}
            </div>
          </div>
        </div>
        {/* Body */}
        <div className="px-3.5 py-3">
          {owners > 0 && (
          <p className="text-[12px] leading-[17px] text-muted-foreground">
            An Account Owner's status can't be changed by another user, so the following {owners === 1 ? "user is" : "users are"} left out of this action:
          </p>
          )}
          <div className="mt-2.5 space-y-1.5">
            {excludedProtectedUsers.map((u) => {
              const avatar = resolveUserAvatar({ userId: u.id, name: u.name });
              const tint = getAvatarTint(u.name);
              return (
                <div key={u.id} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2" style={{ backgroundColor: "#F8FAFC" }}>
                  {avatar ? (
                    <img src={avatar} alt={u.name} className="w-7 h-7 rounded-md object-cover shrink-0" />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[10px]"
                      style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 600 }}
                    >
                      {getInitials(u.name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium text-foreground truncate">{u.name}</div>
                    <div className="text-[11px] text-muted-foreground leading-tight">Account Owner</div>
                  </div>
                </div>
              );
            })}
          </div>
          {nonActive > 0 && (
            <p className={`text-[12px] leading-[17px] text-muted-foreground ${owners > 0 ? "mt-2.5" : ""}`}>
              {nonActive === 1 ? "1 user isn't" : `${nonActive} users aren't`} Active, and only an Active user can be deactivated, so they are left out too.
            </p>
          )}
        </div>
      </div>
    );
  };

  const handleConfirmReset = () => {
    toast.success(`${selectedCount} users sent password reset links`);
    onCancel();
  };

  const handleConfirmDeactivate = (removeLicense: boolean) => {
    setPendingDeactivateRemoveLicense(removeLicense);
    setDeactivateConfirmOpen(true);
  };

  // Bulk archive confirmation handled inline in the ArchiveUserModal onConfirm.


  // Upgrade needs no reassignment, apply Full Access to every eligible user.
  const handleConfirmUpgrade = () => {
    upgradeIds.forEach((id) => updateUserRowState(id, { license: "Full Access" }));
    toast.success(`${upgradeCount} user${upgradeCount !== 1 ? "s" : ""} upgraded to Full Access`);
    onCancel();
  };

  // Billing calculations: Omne daily-rate model
  const FULL_DAILY = 5.0;
  const FIELD_DAILY = 0.5;
  const DAILY_DIFF = FULL_DAILY - FIELD_DAILY; // $4.50
  const CYCLE_DAYS = 30;
  const DAYS_REMAINING = 15; // mock: 22nd of cycle
  /* The sample company's spend; a company from onboarding is priced from the
   * seats it actually has. */
  const currentMonthlyBase = isNewTenant()
    ? companyDailySpend() * CYCLE_DAYS
    : 870; // (5×$5 + 8×$0.50) × 30 = $870

  const upgradeBilling = {
    currentMonthly: currentMonthlyBase,
    newMonthly: currentMonthlyBase + upgradeCount * DAILY_DIFF * CYCLE_DAYS,
    perUserDailyRate: FULL_DAILY,
    dailyRateDiff: DAILY_DIFF,
    daysRemaining: DAYS_REMAINING,
    cycleDays: CYCLE_DAYS,
  };
  // Downgrade & Remove now route through the reassignment wizard (no billing modal).

  // Status-change buttons. Rendered once here so they can be used bare or wrapped
  // in the excluded-users hover card. aria-disabled (not `disabled`) keeps hover
  // working so the card still explains why when only protected users are selected.
  /* Two independent reasons a status button can be inert: nothing eligible is
   * selected (status), or this level may not take that action in bulk
   * (capability). The capability half differs per button now that deactivate
   * and archive are separate permissions. */
  const noneEligible = statusEligibleCount === 0;
  const deactivateDisabled = deactivateEligibleCount === 0 || gDeactivate.disabled;
  const deactivateHasExcluded = hasExcluded || nonActiveExcludedCount > 0;
  const archiveDisabled = noneEligible || gArchive.disabled;
  const deactivateButton = (
    <button
      onClick={() => { if (!deactivateDisabled) setDeactivateOpen(true); }}
      aria-disabled={deactivateDisabled}
      className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-[6px] border text-[12px] transition-colors"
      style={{ fontWeight: 500, color: "#B45309", borderColor: "#FCD34D", backgroundColor: "white", opacity: deactivateDisabled ? 0.45 : 1, cursor: deactivateDisabled ? "not-allowed" : "pointer" }}
      onMouseEnter={(e) => { if (!deactivateDisabled) e.currentTarget.style.backgroundColor = "#FFFBEB"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "white"; }}
    >
      <Ban className="w-3.5 h-3.5" style={{ color: "#B45309" }} />
      Deactivate
      {/* Shield when Account Owners are left out (ERP-5171 AC18); Info when
          only non-Active users are. */}
      {hasExcluded ? (
        <Shield className="w-3.5 h-3.5 ml-0.5" style={{ color: "#B45309", opacity: 0.8 }} aria-label="Some users are left out" />
      ) : nonActiveExcludedCount > 0 ? (
        <Info className="w-3.5 h-3.5 ml-0.5" style={{ color: "#B45309", opacity: 0.7 }} />
      ) : null}
    </button>
  );
  const archiveButton = (
    <button
      onClick={() => { if (!archiveDisabled) setArchiveOpen(true); }}
      aria-disabled={archiveDisabled}
      className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-[6px] border text-[12px] transition-colors"
      style={{ fontWeight: 500, color: "#DC2626", borderColor: "#FECACA", backgroundColor: "white", opacity: archiveDisabled ? 0.45 : 1, cursor: archiveDisabled ? "not-allowed" : "pointer" }}
      onMouseEnter={(e) => { if (!archiveDisabled) e.currentTarget.style.backgroundColor = "#FEF2F2"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "white"; }}
    >
      <Archive className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
      Archive
      {hasExcluded && <Shield className="w-3.5 h-3.5 ml-0.5" style={{ color: "#DC2626", opacity: 0.8 }} aria-label="Some users are left out" />}
    </button>
  );

  /* ─── Access gating ───
   *
   * Each bulk action is `capability && selectionAllows`. When the persona can
   * run none of them the action group is replaced by one explanatory line —
   * the same treatment the archived-filter context already uses — rather than
   * leaving an empty strip. The selection count and Cancel stay so the rows
   * can still be deselected. */

  return (
    <>
      <div
        className="flex items-center gap-2 px-4 pb-3 shrink-0"
        style={{ background: "linear-gradient(to top, #F0F7FF 0%, #FFFFFF 100%)" }}
      >
        {/* Left: action buttons */}
        <div className="flex items-center gap-1.5">
          {archivedContext ? (
            <span
              className="inline-flex items-center gap-1.5 text-[12px]"
              style={{ color: "#64748B", fontWeight: 500 }}
            >
              <Info className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
              Archived users can't be exported or changed in bulk.
            </span>
          ) : !hasAnyBulkAction ? (
            <span
              className="inline-flex items-center gap-1.5 text-[12px]"
              style={{ color: "#64748B", fontWeight: 500 }}
            >
              <Info className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
              {access.label} can't change users in bulk.
            </span>
          ) : (
          <>
          <>
          {/* Change License dropdown */}
          {showBulkLicense && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-[6px] border text-[12px] transition-colors cursor-pointer"
                style={{
                  fontWeight: 500,
                  color: "#334155",
                  borderColor: "#CBD5E1",
                  backgroundColor: "white",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F1F5F9"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "white"; }}
              >
                Change License
                <ChevronDown className="w-3 h-3" style={{ color: "#94A3B8" }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[280px] p-1">
              <DropdownMenuItem
                className="cursor-pointer gap-2 justify-between"
                disabled={upgradeCount === 0}
                onClick={() => upgradeCount > 0 && setUpgradeOpen(true)}
              >
                <div className="flex items-center gap-2">
                  <ArrowUpCircle className="w-3.5 h-3.5" style={{ color: upgradeCount > 0 ? "#7C3AED" : "#CBD5E1" }} />
                  <span style={{ color: upgradeCount > 0 ? "#7C3AED" : "#CBD5E1", fontWeight: 500 }}>
                    Upgrade to Full Access
                  </span>
                </div>
                <span
                  className="text-[11px]"
                  style={{ color: upgradeCount > 0 ? "#94A3B8" : "#CBD5E1", fontWeight: 450 }}
                >
                  {upgradeCount} user{upgradeCount !== 1 ? "s" : ""}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 justify-between"
                disabled={downgradeCount === 0}
                onClick={() => downgradeCount > 0 && setDowngradeOpen(true)}
              >
                <div className="flex items-center gap-2">
                  <ArrowDownCircle className="w-3.5 h-3.5" style={{ color: downgradeCount > 0 ? "#64748B" : "#CBD5E1" }} />
                  <span style={{ fontWeight: 500, color: downgradeCount > 0 ? "#334155" : "#CBD5E1" }}>
                    Downgrade to Field User
                  </span>
                </div>
                <span className="inline-flex items-center gap-1">
                  {licenseExcludedOwners.length > 0 && <OwnersLeftOutShield names={licenseExcludedOwners} />}
                  <span
                    className="text-[11px]"
                    style={{ color: downgradeCount > 0 ? "#94A3B8" : "#CBD5E1", fontWeight: 450 }}
                  >
                    {downgradeCount} user{downgradeCount !== 1 ? "s" : ""}
                  </span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 justify-between"
                disabled={nonBillableCount === 0}
                onClick={() => nonBillableCount > 0 && setNonBillableOpen(true)}
              >
                <div className="flex items-center gap-2">
                  <MinusCircle className="w-3.5 h-3.5" style={{ color: nonBillableCount > 0 ? "#64748B" : "#CBD5E1" }} />
                  <span style={{ fontWeight: 500, color: nonBillableCount > 0 ? "#334155" : "#CBD5E1" }}>
                    Remove License
                  </span>
                </div>
                <span className="inline-flex items-center gap-1">
                  {licenseExcludedOwners.length > 0 && <OwnersLeftOutShield names={licenseExcludedOwners} />}
                  <span
                    className="text-[11px]"
                    style={{ color: nonBillableCount > 0 ? "#94A3B8" : "#CBD5E1", fontWeight: 450 }}
                  >
                    {nonBillableCount} user{nonBillableCount !== 1 ? "s" : ""}
                  </span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}

          {/* Reset Password */}
          {showBulkReset && (
          <button
            onClick={() => { if (!gReset.disabled) setResetOpen(true); }}
            aria-disabled={gReset.disabled}
            title={gReset.reason || undefined}
            className={`inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-[6px] border text-[12px] transition-colors ${gReset.disabled ? "opacity-45 cursor-not-allowed" : "cursor-pointer"}`}
            style={{
              fontWeight: 500,
              color: "#334155",
              borderColor: "#CBD5E1",
              backgroundColor: "white",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F1F5F9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "white"; }}
          >
            <KeyRound className="w-3.5 h-3.5" style={{ color: "#64748B" }} />
            Reset Password
          </button>
          )}
          </>

          {/* Export */}
          {showBulkExport && (
          <button
            onClick={() => { if (!gExport.disabled) onExport?.(); }}
            aria-disabled={gExport.disabled}
            title={gExport.reason || undefined}
            className={`inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-[6px] border text-[12px] transition-colors ${gExport.disabled ? "opacity-45 cursor-not-allowed" : "cursor-pointer"}`}
            style={{
              fontWeight: 500,
              color: "#334155",
              borderColor: "#CBD5E1",
              backgroundColor: "white",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F1F5F9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "white"; }}
          >
            <Download className="w-3.5 h-3.5" style={{ color: "#64748B" }} />
            Export
          </button>
          )}

          {/* Send invitation, only when a Draft (Pending Setup) user is in the
            * selection. Styled like Deactivate but in the brand blue. */}
          {showBulkInvite && (
            <button
              onClick={() => setSendInviteOpen(true)}
              className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-[6px] border text-[12px] transition-colors cursor-pointer"
              style={{ fontWeight: 500, color: "#0A77FF", borderColor: "#BFDBFE", backgroundColor: "white" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#EDF4FF"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "white"; }}
            >
              <Send className="w-3.5 h-3.5" style={{ color: "#0A77FF" }} />
              Send Invitation
            </button>
          )}

          {/* Deactivate (protected users are excluded; hover shows who + why) */}
          {showBulkDeactivate && (deactivateHasExcluded ? (
            <Tooltip>
              <TooltipTrigger asChild>{deactivateButton}</TooltipTrigger>
              <TooltipContent side="top" align="start" sideOffset={8} className="p-3 bg-white text-foreground border border-border/60 shadow-lg rounded-xl">
                {renderExcludedCard("deactivated")}
              </TooltipContent>
            </Tooltip>
          ) : deactivateButton)}

          {/* Archive (protected users are excluded; hover shows who + why) */}
          {showBulkArchive && (hasExcluded ? (
            <Tooltip>
              <TooltipTrigger asChild>{archiveButton}</TooltipTrigger>
              <TooltipContent side="top" align="start" sideOffset={8} className="p-3 bg-white text-foreground border border-border/60 shadow-lg rounded-xl">
                {renderExcludedCard("archived")}
              </TooltipContent>
            </Tooltip>
          ) : archiveButton)}
          </>
          )}
        </div>

        <div className="flex-1" />

        {/* Right: count + cancel */}
        <div className="flex items-center gap-2.5">
          <span
            className="text-[13px]"
            style={{ fontWeight: 600, color: "#007FFF" }}
          >
            {selectedCount} selected
          </span>
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] border text-[12px] transition-colors cursor-pointer"
            style={{
              fontWeight: 500,
              color: "#64748B",
              borderColor: "#CBD5E1",
              backgroundColor: "white",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#94A3B8"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#CBD5E1"; }}
          >
            ✕ Cancel
          </button>
        </div>
      </div>

      {/* Bulk confirmation modals, shown AFTER the reassignment wizard, when the user clicks the final Deactivate/Archive button. */}
      <DestructiveConfirmModal
        open={deactivateConfirmOpen}
        onClose={() => setDeactivateConfirmOpen(false)}
        badge="BULK DEACTIVATE"
        title={`Deactivate ${deactivateEligibleCount} user${deactivateEligibleCount !== 1 ? "s" : ""}?`}
        description={`You are about to deactivate ${deactivateEligibleCount} user${deactivateEligibleCount !== 1 ? "s" : ""}${pendingDeactivateRemoveLicense ? " and remove their licenses" : ""}. Deactivated users will lose system access immediately. You can reactivate them later if needed.`}
        confirmLabel={`Deactivate ${deactivateEligibleCount} User${deactivateEligibleCount !== 1 ? "s" : ""}`}
        tone="warning"
        onConfirm={() => {
          setDeactivateOpen(false);
          onDeactivateSelected?.();
          onCancel();
        }}
      />
      <DestructiveConfirmModal
        open={archiveConfirmOpen}
        onClose={() => setArchiveConfirmOpen(false)}
        badge="BULK ARCHIVE"
        title={`Archive ${statusEligibleCount} users?`}
        description={`You are about to archive ${statusEligibleCount} users. Archived users will lose all system access and their accounts will be permanently deactivated. This action cannot be undone.`}
        confirmLabel={`Archive ${statusEligibleCount} User${statusEligibleCount !== 1 ? "s" : ""}`}
        tone="danger"
        onConfirm={() => {
          setArchiveOpen(false);
          onArchiveSelected?.();
          onCancel();
        }}
      />

      {/* Send invitation confirmation, lists the Draft users who will be invited. */}
      <DestructiveConfirmModal
        open={sendInviteOpen}
        onClose={() => setSendInviteOpen(false)}
        badge="SEND INVITATION"
        title={`Send invitation to ${draftCount} user${draftCount !== 1 ? "s" : ""}?`}
        description={`An invitation will be sent to the following ${draftCount} user${draftCount !== 1 ? "s" : ""}. Once sent, each moves from Draft to Invite Sent.`}
        confirmLabel={`Send ${draftCount} Invitation${draftCount !== 1 ? "s" : ""}`}
        tone="brand"
        icon={Send}
        onConfirm={handleConfirmSendInvite}
        extra={
          <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
            <div className="max-h-[200px] overflow-y-auto divide-y divide-[#F1F5F9]">
              {draftUsers.map((u) => {
                const avatar = resolveUserAvatar({ userId: u.id, name: u.name });
                const tint = getAvatarTint(u.name);
                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-2.5 px-3 py-2"
                    style={{ backgroundColor: "#FFFFFF" }}
                  >
                    {avatar ? (
                      <img src={avatar} alt={u.name} className="w-7 h-7 rounded-md object-cover shrink-0" />
                    ) : (
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[10px]"
                        style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 600 }}
                      >
                        {getInitials(u.name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium text-foreground truncate">{u.name}</div>
                      <div className="text-[11px] text-muted-foreground leading-tight truncate">{u.email}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        }
      />

      {/* Confirmation modals */}
      <DestructiveConfirmModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset Passwords"
        badge="RESET"
        description={`Reset passwords for ${selectedCount} users? Each user will receive a password reset link at their system email.`}
        confirmLabel="Reset Passwords"
        onConfirm={handleConfirmReset}
      />
      <DeactivateUserModal
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        userName=""
        bulkCount={deactivateEligibleCount}
        bulkLicensedCount={deactivateLicensedCount}
        bulkUserIds={deactivateEligibleIds}
        onConfirm={handleConfirmDeactivate}
      />
      <ArchiveUserModal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        userName=""
        bulkCount={statusEligibleCount}
        bulkLicensedCount={statusLicensedCount}
        bulkUserIds={statusEligibleIds}
        onConfirm={() => {
          setArchiveConfirmOpen(true);
        }}
      />


      {/* License modals */}
      {/* Upgrade: billing confirmation summary, no reassignment. */}
      <UpgradeLicenseModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        users={upgradeUsers}
        billing={upgradeBilling}
        onConfirm={handleConfirmUpgrade}
      />
      {/* Downgrade: routes through the reassignment wizard (bulk). The wizard
          downgrades every eligible user, unassigns Full-Access roles for the
          affected ones, and toasts; we just clear the selection on confirm. */}
      {downgradeOpen && (
        downgradeIds.length > 1 ? (
          <DeactivateUserWizard
            open={downgradeOpen}
            onClose={() => setDowngradeOpen(false)}
            mode="downgrade-license"
            userName=""
            targetLicense="Field User"
            bulkUserIds={downgradeIds}
            onConfirm={() => onCancel()}
            onSelectionEmpty={() => { setDowngradeOpen(false); onCancel(); }}
          />
        ) : (
          <DeactivateUserWizard
            open={downgradeOpen}
            onClose={() => setDowngradeOpen(false)}
            mode="downgrade-license"
            userName={downgradeUsers[0]?.name ?? ""}
            userId={downgradeIds[0]}
            userLicense="Full Access"
            targetLicense="Field User"
            onConfirm={() => onCancel()}
          />
        )
      )}
      {/* Remove License: routes through the reassignment wizard (bulk). */}
      {nonBillableOpen && (
        nonBillableIds.length > 1 ? (
          <DeactivateUserWizard
            open={nonBillableOpen}
            onClose={() => setNonBillableOpen(false)}
            mode="remove-license"
            userName=""
            bulkUserIds={nonBillableIds}
            onConfirm={() => onCancel()}
            onSelectionEmpty={() => { setNonBillableOpen(false); onCancel(); }}
          />
        ) : (
          <DeactivateUserWizard
            open={nonBillableOpen}
            onClose={() => setNonBillableOpen(false)}
            mode="remove-license"
            userName={nonBillableUsers[0]?.name ?? ""}
            userId={nonBillableIds[0]}
            onConfirm={() => onCancel()}
          />
        )
      )}
    </>
  );
}

/* Account Owners left out of a bulk license change: a small shield beside the
 * count, naming them on hover (ERP-5184 AC8, ERP-5186 AC8). */
function OwnersLeftOutShield({ names }: { names: string[] }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex" aria-label="Account Owners left out">
          <Shield className="w-3 h-3" style={{ color: "#B45309" }} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[260px] text-xs">
        Left out: {names.join(", ")}. {ACCOUNT_OWNER_COPY.otherLicense}
      </TooltipContent>
    </Tooltip>
  );
}
