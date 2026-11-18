import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  X,
  Shield,
  Mail,
  KeyRound,
  Archive,
  Ban,
  Copy as CopyIcon,
  User as UserIcon,
} from "lucide-react";
import { ModalShell } from "./ModalShell";
import { DeactivateUserWizard } from "../user-detail/DeactivateUserWizard";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { DestructiveConfirmModal } from "./DestructiveConfirmModal";
import { DataTable } from "../data-table/DataTable";
import { AvatarCell, LicenseBadge } from "../table-cells";
import { users as allUsersForPicker, type UserRow } from "../../data/users-data";
import {
  USERS_COLUMNS,
  USERS_QUICK_FILTERS,
  usersSearchPredicate,
  usersFilterPredicate,
} from "../../data/users-table-config";

/** Slim column set for the assignee picker: matches Step3 / AssignUsersModal. */
const PICKER_ALLOWED_KEYS = new Set(["full_name", "assigned_roles", "license", "email", "status"]);

/* ═══════════════════════════════════════════
   Base confirmation modal shell
   ═══════════════════════════════════════════ */
interface BaseModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  children: React.ReactNode;
  confirmLabel: string;
  confirmVariant?: "danger" | "primary" | "warning";
  onConfirm: () => void;
  disabled?: boolean;
  /** Override default 440px max width */
  maxWidth?: number;
}

function BaseModal({
  open,
  onClose,
  title,
  icon,
  iconBg,
  children,
  confirmLabel,
  confirmVariant = "primary",
  onConfirm,
  disabled,
  maxWidth = 440,
}: BaseModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const btnColors =
    confirmVariant === "danger"
      ? "bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white"
      : confirmVariant === "warning"
      ? "bg-[#D97706] hover:bg-[#B45309] active:bg-[#92400E] text-white"
      : "bg-[#007FFF] hover:bg-[#0066D6] active:bg-[#005BBF] text-white";

  return (
    <ModalShell open={open} onClose={onClose}>
      <div
        className="bg-white rounded-2xl w-full mx-4 overflow-hidden"
        style={{
          maxWidth,
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: iconBg }}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="text-[15px] text-[#0F172A]"
              style={{ fontWeight: 650 }}
            >
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pt-3 pb-5">{children}</div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#EEF2F6] bg-[#FAFBFC]">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            disabled={disabled}
            className={`h-9 px-4 rounded-[8px] text-[13px] transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${btnColors}`}
            style={{ fontWeight: 600 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ══════════════════════════════════════════
   User: Reset Password Modal
   ═══════════════════════════════════════════ */
export function ResetPasswordModal({
  open,
  onClose,
  email,
  userName,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
  userName: string;
}) {
  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={`Reset password for ${userName}?`}
      icon={<KeyRound className="w-5 h-5" style={{ color: "#007FFF" }} />}
      iconBg="#EDF4FF"
      confirmLabel="Send Reset Link"
      confirmVariant="primary"
      onConfirm={() => {
        toast.success("Password reset email sent", {
          description: `A password reset link was sent to ${email}.`,
        });
      }}
    >
      <p className="text-[13px] text-[#475569]" style={{ fontWeight: 420, lineHeight: 1.6 }}>
        A password reset link will be sent to <span style={{ fontWeight: 550 }}>{email}</span>.
      </p>
    </BaseModal>
  );
}

/* ═══════════════════════════════════════════
   User: Resend Invite Modal
   ───────────────────────────────────────────
   Three-region layout matching the Create New User modal: a bordered white
   header (icon + title + intro), a slate content area, and a white footer.
   ═══════════════════════════════════════════ */
export function ResendInviteModal({
  open,
  onClose,
  email,
  userName,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
  userName: string;
}) {
  const [editedEmail, setEditedEmail] = useState(email);

  useEffect(() => {
    if (open) setEditedEmail(email);
  }, [open, email]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const disabled = !editedEmail.trim();

  const handleConfirm = () => {
    if (disabled) return;
    toast.success("Invitation resent", {
      description: `A new invitation link was sent to ${editedEmail}.`,
    });
    onClose();
  };

  return (
    <ModalShell open={open} onClose={onClose}>
      <div
        className="bg-white rounded-2xl w-full mx-4 overflow-hidden flex flex-col"
        style={{
          maxWidth: 560,
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* Header */}
        <div className="shrink-0 bg-white border-b border-[#EEF2F6] px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] text-[#0F172A]" style={{ fontWeight: 650 }}>
                Resend Invitation to {userName}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4 bg-[#FAFBFC]">
          <label className="block text-[12px] text-[#334155] mb-1.5" style={{ fontWeight: 500 }}>
            Primary Email
          </label>
          {/* View-only: the invite always goes to the user's registered
              email, so the field can't be clicked, focused, or edited, it
              just shows the not-allowed cursor. Kept visually identical. */}
          <input
            type="email"
            value={editedEmail}
            readOnly
            tabIndex={-1}
            aria-readonly="true"
            onMouseDown={(e) => e.preventDefault()}
            className="w-full h-9 px-3.5 border border-[#E2E8F0] rounded-[8px] text-[13px] text-[#0F172A] bg-white shadow-xs focus:outline-none focus:ring-1 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all placeholder:text-[#94A3B8] cursor-not-allowed"
            style={{ fontWeight: 450 }}
          />
          <p className="text-[12px] mt-2.5" style={{ color: "#7C8CA2", fontWeight: 400, lineHeight: 1.5, whiteSpace: "nowrap" }}>
            A new invitation link will be generated. Any previous invite links will be invalidated.
          </p>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#EEF2F6] bg-white">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={disabled}
            className="h-9 px-4 rounded-[8px] text-[13px] text-white bg-[#007FFF] hover:bg-[#0066D6] active:bg-[#005BBF] transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontWeight: 600 }}
          >
            Resend Invite
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   User: Cancel Invitation Modal
   ───────────────────────────────────────────
   The destructive counterpart to ResendInviteModal. Uses the shared
   DestructiveConfirmModal in its red "danger" tone, the same shell the
   discard-changes dialog uses.

   Copy note: the dismiss button says "Keep Invitation", not "Cancel". A
   "Cancel" button sitting under a "Cancel Invitation" button is ambiguous
   about which cancel it means, so both buttons name their outcome instead.
   ═══════════════════════════════════════════ */
export function CancelInvitationModal({
  open,
  onClose,
  userName,
  email,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  userName: string;
  email: string;
  onConfirm?: () => void;
}) {
  /* The banner and the listing both speak of the user by first name once the
   * title has introduced them in full. */
  const firstName = userName.trim().split(/\s+/)[0] || userName;

  return (
    <DestructiveConfirmModal
      open={open}
      onClose={onClose}
      badge="Cancel Invite"
      title={`Cancel invitation for ${userName}?`}
      description={
        <>
          The invitation link sent to{" "}
          <span style={{ fontWeight: 550, color: "#334155" }}>{email}</span> will
          stop working. {firstName} moves back to Draft, where you can send a new
          invitation later.
        </>
      }
      confirmLabel="Cancel Invitation"
      cancelLabel="Keep Invitation"
      maxWidth={440}
      onConfirm={() => {
        toast.success("Invitation cancelled", {
          description: `The link sent to ${email} no longer works.`,
        });
        onConfirm?.();
      }}
    />
  );
}

/* ═══════════════════════════════════════════
   User: Deactivate / Archive Modal
   ───────────────────────────────────────────
   Combined two-section modal:
     1. License decision (keep / remove)
     2. Active assignments resolution
   The two decisions are independent. The primary CTA is gated only
   by the assignment list, never by the license radio.
   Reused for archive flow via `mode="archive"`.
   ═══════════════════════════════════════════ */
import {
  getActiveAssignmentsForUser,
  getActiveAssignmentsForUsers,
  getEligibleAssignees,
  getOwnerName,
  hasFullAccessDependentWork,
  applyLicenseDowngrade,
  ASSIGNMENT_TYPE_ORDER,
  type AssignmentType,
  type UserAssignment,
} from "../../data/user-assignments-data";
import { removeUserFromAllRoles } from "../../data/uac-derived";
import { DowngradeLicenseModal } from "./LicenseModals";
import { DAILY_RATE, CYCLE_DAYS, DAYS_REMAINING, formatCurrency, companyDailySpend } from "../../lib/license-billing";
import { ChevronDown as ChevronDownIcon, ChevronUp as ChevronUpIcon, HelpCircle, CheckCircle2, Info as InfoIcon, Crown, ArrowRight } from "lucide-react";
import { OwnerChip } from "./OwnerChip";

type ResolutionChoice = { kind: "user"; userId: number } | { kind: "unassigned" };

interface CombinedModalProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  /** When set, modal targets a single user. */
  userId?: number;
  /** Current license: drives whether the keep/remove choice is shown. */
  userLicense?: string;
  /** Confirm callback. removeLicense=true when admin removed license. */
  onConfirm?: (removeLicense: boolean) => void;
  /** Bulk mode (>1 users). */
  bulkCount?: number;
  bulkLicensedCount?: number;
  /** IDs of selected users for bulk mode (used to compute aggregated assignments). */
  bulkUserIds?: Array<number | string>;
  /** "deactivate" (default) or "archive". */
  mode?: "deactivate" | "archive";
}

function CombinedDeactivateArchiveModal({
  open,
  onClose,
  userName,
  userId,
  userLicense,
  onConfirm,
  bulkCount,
  bulkLicensedCount,
  bulkUserIds,
  mode = "deactivate",
}: CombinedModalProps) {
  const isBulk = !!bulkCount && bulkCount > 1;
  const isArchive = mode === "archive";
  const licensedInBulk = bulkLicensedCount ?? bulkCount ?? 0;
  const hasLicense = isBulk
    ? licensedInBulk > 0
    : !!userLicense && userLicense !== "No License";

  const [keepLicense, setKeepLicense] = useState(true);
  const [resolutions, setResolutions] = useState<Record<string, ResolutionChoice>>({});

  // Aggregate assignments: recomputed when modal opens
  const assignments: UserAssignment[] = useMemoAssignments(open, isBulk, userId, bulkUserIds);

  useEffect(() => {
    if (open) {
      setKeepLicense(true);
      setResolutions({});
    }
  }, [open]);

  // Group assignments by type, in canonical order
  const grouped = ASSIGNMENT_TYPE_ORDER
    .map((t) => ({ type: t, items: assignments.filter((a) => a.type === t) }))
    .filter((g) => g.items.length > 0);

  const total = assignments.length;
  const resolvedCount = Object.keys(resolutions).length;
  const allResolved = total === 0 || resolvedCount === total;

  const verb = isArchive ? "Archive" : "Deactivate";
  const verbed = isArchive ? "Archiving" : "Deactivating";

  const subjectLabel = isBulk ? `${bulkCount} users` : userName;

  const handleConfirm = () => {
    const removeLicense = hasLicense && !keepLicense;
    onConfirm?.(removeLicense);
    if (isArchive) {
      toast.success(
        isBulk
          ? `${bulkCount} users were archived.`
          : `${userName} was archived.`
      );
    } else if (isBulk) {
      if (!hasLicense) {
        toast.success(`${bulkCount} users are deactivated.`);
      } else if (removeLicense) {
        toast.success(
          `${bulkCount} users are deactivated and their licenses have been removed.`
        );
      } else {
        toast.success(
          `${bulkCount} users are deactivated. Their licenses are still on the record.`
        );
      }
    } else if (!hasLicense) {
      toast.success(`${userName} is deactivated.`);
    } else if (removeLicense) {
      toast.success(
        `${userName} is deactivated and their license has been removed.`
      );
    } else {
      toast.success(
        `${userName} is deactivated. Their license is still on the record.`
      );
    }
  };

  const primaryLabel = isBulk
    ? isArchive ? "Archive Users" : "Deactivate Users"
    : isArchive ? "Archive User" : "Deactivate User";

  const primaryClasses = isArchive
    ? "bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white"
    : "bg-[#D97706] hover:bg-[#B45309] active:bg-[#92400E] text-white";

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <ModalShell open={open} onClose={onClose}>
      <div
        className="bg-white rounded-2xl w-full mx-4 overflow-hidden flex flex-col"
        style={{
          maxWidth: isBulk ? 880 : 760,
          maxHeight: "88vh",
          boxShadow:
            "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#EEF2F6] bg-white">
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] text-[#0F172A]" style={{ fontWeight: 650 }}>
              {isBulk ? `${verb} ${bulkCount} Users?` : `${verb} ${userName}?`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div
          className="overflow-y-auto flex-1 px-5 py-4 bg-[#F8FAFC] space-y-4"
          style={{ minHeight: 0 }}
        >
          {/* Slate info banner: moved from header subtitle */}
          <div
            className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg border"
            style={{ backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" }}
          >
            <InfoIcon
              className="w-4 h-4 shrink-0 mt-0.5"
              style={{ color: "#475569" }}
            />
            <p
              className="text-[12.5px] leading-[1.55]"
              style={{ color: "#334155", fontWeight: 450 }}
            >
              {isArchive
                ? <>Archiving {isBulk ? "these users" : "this user"} will clear all assigned roles, permissions, and MFA settings from {isBulk ? "their" : "the"} user record. {isBulk ? "They are" : "The user is"} removed from the active user listing and will only appear when the Archived filter is applied.</>
                : <>{verbed} pauses {isBulk ? "these users" : "this user"}. They will not be able to sign in, and they will not show up in active user lists. Their roles, permissions, and profile{isBulk ? "s" : ""} stay on the record so you can bring them back later.</>
              }
            </p>
          </div>

          {/* Section 1: License (collapsible), deactivate only */}
          {!isArchive && hasLicense && (
            <LicenseAccordion
              keepLicense={keepLicense}
              onChange={setKeepLicense}
              isBulk={isBulk}
              subjectLabel={subjectLabel}
            />
          )}

          {/* Section 2: Active assignments accordion */}
          <ActiveAssignmentsAccordion
            assignments={assignments}
            grouped={grouped}
            resolutions={resolutions}
            isBulk={isBulk}
            verbing={isArchive ? "archiving" : "deactivating"}
            onChoose={(itemId, choice) =>
              setResolutions((prev) =>
                choice
                  ? { ...prev, [itemId]: choice }
                  : (() => {
                      const next = { ...prev };
                      delete next[itemId];
                      return next;
                    })()
              )
            }
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#EEF2F6] bg-white">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          {/* Secondary: proceed without resolving (always enabled) */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    handleConfirm();
                    onClose();
                  }}
                  className="h-9 px-4 rounded-[8px] border text-[13px] transition-colors cursor-pointer bg-white"
                  style={{
                    fontWeight: 600,
                    color: isArchive ? "#DC2626" : "#D97706",
                    borderColor: isArchive ? "#FCA5A5" : "#FCD34D",
                  }}
                >
                  {`${verb} without resolving conflicts`}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[300px]" style={{ zIndex: 100 }}>
                Proceeding without reassignment will leave these items unassigned. They can be reassigned later from each item's detail page.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* Primary: gated until all resolved */}
          <button
            onClick={() => {
              handleConfirm();
              onClose();
            }}
            disabled={!allResolved}
            className={`h-9 px-4 rounded-[8px] text-[13px] transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${primaryClasses}`}
            style={{ fontWeight: 600 }}
          >
            {`${verb} and resolve conflicts`}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/** Helper hook: recompute assignments only when modal opens or scope changes. */
function useMemoAssignments(
  open: boolean,
  isBulk: boolean,
  userId?: number,
  bulkUserIds?: Array<number | string>
): UserAssignment[] {
  const [items, setItems] = useState<UserAssignment[]>([]);
  useEffect(() => {
    if (!open) return;
    if (isBulk && bulkUserIds) {
      setItems(getActiveAssignmentsForUsers(bulkUserIds));
    } else if (userId != null) {
      setItems(getActiveAssignmentsForUser(userId));
    } else {
      setItems([]);
    }
  }, [open, isBulk, userId, bulkUserIds]);
  return items;
}

/* ─── License accordion (mirrors Active Assignments accordion styling) ─── */
function LicenseAccordion({
  keepLicense,
  onChange,
  isBulk,
  subjectLabel,
}: {
  keepLicense: boolean;
  onChange: (next: boolean) => void;
  isBulk: boolean;
  subjectLabel: string;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <section>
      <div
        className="rounded-[10px] border bg-white overflow-hidden"
        style={{ borderColor: "#E2E8F0" }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left cursor-pointer hover:bg-[#F8FAFC] transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="text-[14px] text-[#0F172A] truncate"
              style={{ fontWeight: 600 }}
            >
              License Configuration
            </span>
          </div>
          <span
            className="flex items-center gap-1 text-[12px] shrink-0"
            style={{ color: "#007FFF", fontWeight: 500 }}
          >
            {expanded ? (
              <>Hide <ChevronUpIcon className="w-3 h-3" /></>
            ) : (
              <>Show <ChevronDownIcon className="w-3 h-3" /></>
            )}
          </span>
        </button>
        {expanded && (
          <div
            className="border-t px-3.5 py-3 grid grid-cols-2 gap-2"
            style={{ borderColor: "#E2E8F0" }}
          >
            <DeactivateLicenseChoice
              selected={keepLicense}
              onSelect={() => onChange(true)}
              label={isBulk ? "Keep their licenses" : "Keep their license"}
              description={
                <>Good for short pauses, like parental leave or a security hold. {subjectLabel} keep{isBulk ? "" : "s"} the license so you can reactivate in one step.</>
              }
            />
            <DeactivateLicenseChoice
              selected={!keepLicense}
              onSelect={() => onChange(false)}
              label={isBulk ? "Remove their licenses" : "Remove their license"}
              description={
                <>Good when you do not know when or if they are coming back. The license is freed up for someone else.</>
              }
            />
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Active Assignments accordion (single collapsible card) ─── */
function ActiveAssignmentsAccordion({
  assignments,
  grouped,
  resolutions,
  isBulk,
  verbing,
  onChoose,
}: {
  assignments: UserAssignment[];
  grouped: { type: AssignmentType; items: UserAssignment[] }[];
  resolutions: Record<string, ResolutionChoice>;
  isBulk: boolean;
  verbing: string;
  onChoose: (itemId: string, choice: ResolutionChoice | undefined) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const total = assignments.length;
  const resolvedCount = Object.keys(resolutions).filter((k) =>
    assignments.some((a) => a.id === k)
  ).length;
  const remaining = total - resolvedCount;

  if (total === 0) {
    return (
      <section>
        <h4
          className="text-[12px] uppercase tracking-wide text-[#64748B] mb-2.5"
          style={{ fontWeight: 600, letterSpacing: "0.04em" }}
        >
          Active Assignments
        </h4>
        <div
          className="rounded-[10px] border border-[#E2E8F0] bg-white px-3.5 py-3 text-[13px] text-[#64748B]"
          style={{ fontWeight: 450 }}
        >
          No active assignments. You're good to {verbing.replace(/ing$/, "e")}.
        </div>
      </section>
    );
  }

  return (
    <section>
      <div
        className="rounded-[10px] border bg-white overflow-hidden"
        style={{ borderColor: "#E2E8F0" }}
      >
        {/* Accordion header */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left cursor-pointer hover:bg-[#F8FAFC] transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="text-[14px] text-[#0F172A] truncate"
              style={{ fontWeight: 600 }}
            >
              Resolve Active Assignments
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] shrink-0"
              style={{
                backgroundColor: "#FFFBEB",
                color: "#92400E",
                fontWeight: 600,
                border: "1px solid #FDE68A",
              }}
            >
              {remaining > 0 ? `${remaining} to resolve` : `${total} resolved`}
            </span>
          </div>
          <span
            className="flex items-center gap-1 text-[12px] shrink-0"
            style={{ color: "#007FFF", fontWeight: 500 }}
          >
            {expanded ? (
              <>Hide <ChevronUpIcon className="w-3 h-3" /></>
            ) : (
              <>Show <ChevronDownIcon className="w-3 h-3" /></>
            )}
          </span>
        </button>

        {/* Expanded table */}
        {expanded && (
          <div
            className="border-t bg-white overflow-y-auto"
            style={{ borderColor: "#E2E8F0", maxHeight: 380 }}
          >
            <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
              {isBulk && (
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                    <th className="px-3 py-2 w-6"></th>
                    <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-[#64748B]" style={{ fontWeight: 600, letterSpacing: "0.04em" }}>Assignment</th>
                    <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-[#64748B]" style={{ fontWeight: 600, letterSpacing: "0.04em" }}>User</th>
                    <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-[#64748B]" style={{ fontWeight: 600, letterSpacing: "0.04em" }}>Type</th>
                    <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-[#64748B]" style={{ fontWeight: 600, letterSpacing: "0.04em" }}>Action</th>
                  </tr>
                </thead>
              )}
              <tbody>
                {assignments.map((item, idx) => (
                  <AssignmentRow
                    key={item.id}
                    item={item}
                    choice={resolutions[item.id]}
                    onChoose={(c) => onChoose(item.id, c)}
                    showOwner={isBulk}
                    isLast={idx === assignments.length - 1}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Type chip ─── */
const TYPE_CHIP_COLORS: Record<AssignmentType, { bg: string; color: string; border: string }> = {
  "Cycle Count": { bg: "#EDF4FF", color: "#1D4ED8", border: "#BFDBFE" },
  "Movement": { bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0" },
  "Shipment": { bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
  "Sales Order": { bg: "#FCE7F3", color: "#9D174D", border: "#FBCFE8" },
  "Role Ownership": { bg: "#EDE9FE", color: "#5B21B6", border: "#C4B5FD" },
};

/* Single assignment table row */
function AssignmentRow({
  item,
  choice,
  onChoose,
  showOwner,
  isLast,
}: {
  item: UserAssignment;
  choice: ResolutionChoice | undefined;
  onChoose: (choice: ResolutionChoice | undefined) => void;
  showOwner: boolean;
  isLast: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const eligible = useMemoEligible(item.type, item.ownerId);
  const resolved = !!choice;
  const chip = TYPE_CHIP_COLORS[item.type];

  const choiceLabel = !choice
    ? "Select Assignee"
    : choice.kind === "unassigned"
    ? "Left unassigned"
    : eligible.find((e) => e.id === choice.userId)?.fullName ?? "Selected";

  return (
    <>
      <tr
        style={{
          borderBottom: isLast ? "none" : "1px solid #F1F5F9",
          backgroundColor: resolved ? "#F0FDF4" : "transparent",
        }}
      >
        <td className="px-3 py-2.5 w-6 align-middle">
          {resolved ? (
            <CheckCircle2 className="w-4 h-4" style={{ color: "#16A34A" }} />
          ) : (
            <HelpCircle className="w-4 h-4" style={{ color: "#D97706" }} />
          )}
        </td>
        <td className="px-3 py-2.5 align-middle">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="text-[#0F172A] truncate text-[13px]"
              style={{ fontWeight: 500 }}
            >
              {item.label}
            </span>
          </div>
        </td>
        {showOwner && (
          <td className="px-3 py-2.5 align-middle min-w-[180px]">
            <AvatarCell name={getOwnerName(item.ownerId)} userId={item.ownerId} />
          </td>
        )}
        <td className="px-3 py-2.5 whitespace-nowrap align-middle">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px]"
            style={{
              backgroundColor: chip.bg,
              color: chip.color,
              borderColor: chip.border,
              border: `1px solid ${chip.border}`,
              fontWeight: 600,
            }}
          >
            {item.type}
          </span>
        </td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap align-middle">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="text-[12.5px] cursor-pointer transition-colors"
            style={{
              color: resolved ? "#15803D" : "#007FFF",
              fontWeight: 600,
              fontStyle: choice?.kind === "unassigned" ? "italic" : "normal",
            }}
          >
            {choiceLabel}
          </button>
        </td>
      </tr>
      <SelectAssigneeModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        item={item}
        eligible={eligible}
        currentChoice={choice}
        onSelect={(c) => {
          onChoose(c);
          setPickerOpen(false);
        }}
      />
    </>
  );
}

/* ─── Select Assignee secondary modal ─── 
 * Reuses the same DataTable-based picker as the Role Detail "Assign Users"
 * modal (single-select variant for assignment reassignment).
 */
function SelectAssigneeModal({
  open,
  onClose,
  item,
  eligible,
  currentChoice,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  item: UserAssignment;
  eligible: ReturnType<typeof getEligibleAssignees>;
  currentChoice: ResolutionChoice | undefined;
  onSelect: (choice: ResolutionChoice) => void;
}) {
  const eligibleIds = useMemo(() => new Set(eligible.map((e) => e.id)), [eligible]);
  const eligibleUsers = useMemo(
    () => allUsersForPicker.filter((u) => eligibleIds.has(u.id)),
    [eligibleIds]
  );

  const [selectedIds, setSelectedIds] = useState<number[]>(() =>
    currentChoice?.kind === "user" ? [currentChoice.userId] : []
  );

  useEffect(() => {
    if (open) {
      setSelectedIds(currentChoice?.kind === "user" ? [currentChoice.userId] : []);
    }
  }, [open, currentChoice]);

  const slimColumns = useMemo(
    () => USERS_COLUMNS.filter((c) => PICKER_ALLOWED_KEYS.has(c.key)),
    []
  );
  const eligibleQuickFilters = useMemo(
    () =>
      USERS_QUICK_FILTERS.filter(
        (f) =>
          f.key !== "invite_sent" &&
          f.key !== "invite_expired" &&
          f.key !== "archived"
      ),
    []
  );

  const getRowId = useCallback((row: UserRow) => row.id, []);

  if (!open) return null;

  const handleConfirm = () => {
    if (selectedIds.length === 1) {
      onSelect({ kind: "user", userId: selectedIds[0] });
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} z={70}>
      <div
        className="bg-white rounded-xl shadow-xl flex flex-col w-full max-w-[1400px] h-[88vh] mx-4 overflow-hidden"
        style={{ border: "1px solid #E2E8F0" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] shrink-0">
          <div className="min-w-0">
            <h2 className="text-[16px] text-[#0F172A]" style={{ fontWeight: 600 }}>
              Select Assignee
            </h2>
            <p className="text-[13px] text-[#64748B] mt-0.5 truncate">
              Reassign <span style={{ fontWeight: 500 }}>{item.label}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[#F1F5F9] flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4 text-[#64748B]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col p-5 bg-[#F8FAFC]">
          <div
            className="rounded-xl border overflow-hidden bg-white flex-1 min-h-0 flex flex-col"
            style={{ borderColor: "#E2E8F0" }}
          >
            <DataTable<UserRow>
              data={eligibleUsers}
              columns={slimColumns}
              getRowId={getRowId}
              searchPlaceholder="Search by name, type, or email..."
              searchPredicate={usersSearchPredicate}
              quickFilters={eligibleQuickFilters}
              filterPredicate={usersFilterPredicate}
              showMeMode={false}
              emptyIcon={<UserIcon className="w-8 h-8" />}
              emptyMessage="No eligible users"
              entityLabel="users"
              selectedIds={selectedIds}
              onSelectedIdsChange={(ids) => {
                // Single-select: keep only the most recently chosen id
                const arr = ids as number[];
                setSelectedIds(arr.length ? [arr[arr.length - 1]] : []);
              }}
              selectOnRowClick
              hideBulkBar
              hideDensity
              hideColumnSelector
              defaultDensity="condensed"
              defaultActiveFilters={["active", "full", "field"]}
              persistKey={`assignee-picker:${item.type}`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-[#E2E8F0] shrink-0 bg-white rounded-b-xl">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] text-[#334155] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedIds.length !== 1}
            className="h-9 px-4 rounded-[8px] bg-[#007FFF] text-white text-[13px] hover:bg-[#0066D6] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontWeight: 500 }}
          >
            Assign
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function useMemoEligible(type: AssignmentType, ownerId: number) {
  const [list, setList] = useState<ReturnType<typeof getEligibleAssignees>>([]);
  useEffect(() => {
    setList(getEligibleAssignees(type, [ownerId]));
  }, [type, ownerId]);
  return list;
}

/* Public single-user deactivation modal: routes single-user flows
 * through the new 4-step DeactivateUserWizard; bulk flows continue to
 * use the legacy combined modal. */
export function DeactivateUserModal(props: {
  open: boolean;
  onClose: () => void;
  userName: string;
  userId?: number;
  userLicense?: string;
  onConfirm?: (removeLicense: boolean) => void;
  bulkCount?: number;
  bulkLicensedCount?: number;
  bulkUserIds?: Array<number | string>;
}) {
  const isBulk = !!props.bulkCount && props.bulkCount > 1;
  if (isBulk) {
    return (
      <DeactivateUserWizard
        open={props.open}
        onClose={props.onClose}
        mode="deactivate"
        userName=""
        bulkUserIds={props.bulkUserIds}
        onConfirm={({ removeLicense }) => props.onConfirm?.(removeLicense)}
      />
    );
  }
  if (props.userId != null) {
    return (
      <DeactivateUserWizard
        open={props.open}
        onClose={props.onClose}
        mode="deactivate"
        userName={props.userName}
        userId={props.userId}
        userLicense={props.userLicense}
        onConfirm={({ removeLicense }) => props.onConfirm?.(removeLicense)}
      />
    );
  }
  return <CombinedDeactivateArchiveModal {...props} mode="deactivate" />;
}

/* Public single-user remove-license modal: uses the wizard with the
 * license step suppressed (license removal is the implicit decision). */
export function RemoveLicenseModal(props: {
  open: boolean;
  onClose: () => void;
  userName: string;
  userId: number;
  userLicense?: string;
  onConfirm?: () => void;
}) {
  return (
    <DeactivateUserWizard
      open={props.open}
      onClose={props.onClose}
      mode="remove-license"
      userName={props.userName}
      userId={props.userId}
      userLicense={props.userLicense}
      onConfirm={() => props.onConfirm?.()}
    />
  );
}

/* ═══════════════════════════════════════════
   User: Downgrade License (Full Access → lower tier)
   ───────────────────────────────────────────
   Fourth entry point into the reassignment wizard. When a Full Access
   user has Full-Access-dependent tasks or owned roles, the downgrade
   routes through the same DeactivateUserWizard shell (downgrade variant)
   so that work can be reassigned. Otherwise it falls back to the simple
   billing-focused downgrade confirmation.
   ═══════════════════════════════════════════ */
export function DowngradeUserModal({
  open,
  onClose,
  userName,
  userEmail,
  userId,
  userLicense,
  targetLicense = "Field User",
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  userName: string;
  userEmail?: string;
  userId?: number;
  userLicense?: string;
  targetLicense?: string;
  onConfirm?: () => void;
}) {
  // Reassignment only applies to a true downgrade from Full Access that
  // actually orphans Full-Access-dependent work.
  const useWizard =
    userId != null &&
    userLicense === "Full Access" &&
    hasFullAccessDependentWork(userId);

  if (useWizard) {
    return (
      <DeactivateUserWizard
        open={open}
        onClose={onClose}
        mode="downgrade-license"
        userName={userName}
        userId={userId}
        userLicense={userLicense}
        targetLicense={targetLicense}
        onConfirm={() => onConfirm?.()}
      />
    );
  }

  return (
    <DowngradeLicenseModal
      open={open}
      onClose={onClose}
      userName={userName}
      userEmail={userEmail}
      onConfirm={() => {
        // Full Access → lower tier still unassigns Full-Access roles, even
        // when there was no reassignable work to surface.
        if (userId != null && userLicense === "Full Access") {
          applyLicenseDowngrade(userId);
        }
        onConfirm?.();
        toast.success(`${userName} downgraded to ${targetLicense}`);
      }}
    />
  );
}

/* Radio card used inside DeactivateUserModal */
function DeactivateLicenseChoice({
  selected,
  onSelect,
  label,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  description: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full h-full text-left rounded-[10px] border px-3.5 py-3 transition-all cursor-pointer flex items-start gap-3 bg-[#F8FAFC] shadow-sm hover:shadow-md hover:bg-[#F1F5F9] ${
        selected
          ? "border-[#007FFF] ring-1 ring-[#007FFF]/30"
          : "border-[#E2E8F0] hover:border-[#CBD5E1]"
      }`}
    >
      <div
        className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
          selected ? "border-[#007FFF]" : "border-[#CBD5E1]"
        }`}
      >
        {selected && <div className="w-2 h-2 rounded-full bg-[#007FFF]" />}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px]"
          style={{ fontWeight: 600, color: "#0F172A" }}
        >
          {label}
        </p>
        <p
          className="text-[12.5px] mt-1"
          style={{ color: "#475569", fontWeight: 420, lineHeight: 1.55 }}
        >
          {description}
        </p>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════
   Compact billing summary for the archive confirmation
   ───────────────────────────────────────────
   The wizard's Rate Change and Company-Wide Impact panels answer two
   questions: what this seat costs now versus after, and what that does to the
   company total. When there is no work to reassign those two panels are the
   entire flow, and a full-width stepper around two numbers reads as ceremony.
   So the seat's own change is stated once, on the surface, in the license
   chips the user listing already uses, and the company arithmetic is folded
   into two collapsed sections below it: the same Company-Wide Impact and Full
   Breakdown panels the review step shows, at the confirmation's scale, inside
   the one billing container. Rates come from app/lib/license-billing so this
   and the wizard's panels bill off one table.
   ═══════════════════════════════════════════ */
function ArchiveBillingSummary({ license }: { license: string }) {
  const [impactOpen, setImpactOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const seatDaily = DAILY_RATE[license] ?? 0;
  const seatMonthly = seatDaily * CYCLE_DAYS;
  const companyDaily = companyDailySpend();
  const newCompanyDaily = companyDaily - seatDaily;
  const companyMonthly = companyDaily * CYCLE_DAYS;
  const newCompanyMonthly = companyMonthly - seatMonthly;

  /* Accordion header: same anatomy as the review panel's section cards
   * (16px icon, semibold title, chevron), shrunk to the confirmation's scale
   * and carrying a top divider because they stack inside one container. */
  const sectionHeader = (open: boolean, toggle: () => void, title: string) => (
    <button
      type="button"
      onClick={toggle}
      className={`flex items-center gap-2 w-full px-3.5 py-2.5 cursor-pointer transition-colors border-t ${
        open ? "bg-[#F8FAFC] hover:bg-[#F1F5F9]" : "bg-white hover:bg-[#F8FAFC]"
      }`}
      style={{ borderColor: "#EEF2F6" }}
    >
      <span className="text-[12px]" style={{ fontWeight: 600, color: "#475569" }}>
        {title}
      </span>
      <ChevronDownIcon
        className="w-3.5 h-3.5 ml-auto shrink-0 transition-transform duration-200"
        style={{ color: "#64748B", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
      />
    </button>
  );

  const impactRow = (label: string, value: string, strong = false) => (
    <div className="flex items-center justify-between">
      <span className="text-[12px]" style={{ color: "#64748B", fontWeight: 420 }}>{label}</span>
      <span
        className="text-[12px] tabular-nums"
        style={{ color: strong ? "#0F172A" : "#334155", fontWeight: strong ? 620 : 520 }}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div className="rounded-[10px] border border-[#E2E8F0] overflow-hidden bg-white">
      <div
        className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-[#EEF2F6]"
        style={{ backgroundColor: "#F8FAFC" }}
      >
        <span className="text-[12px]" style={{ fontWeight: 600, color: "#475569" }}>
          Billing
        </span>
        <span
          className="text-[11.5px] px-2 py-0.5 rounded-full tabular-nums border"
          style={{ fontWeight: 600, backgroundColor: "#ECFDF5", color: "#047857", borderColor: "#BBF7D0" }}
        >
          -{formatCurrency(seatMonthly)}/mo
        </span>
      </div>

      {/* The seat's own change, stated with the same license chips the user
       * listing uses so the before/after reads as the same object. */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-3">
        <span className="text-[12px] shrink-0" style={{ fontWeight: 600, color: "#475569" }}>Impact on License</span>
        <span className="flex items-center gap-2 shrink-0">
          <LicenseBadge license={license} />
          <ArrowRight className="w-3.5 h-3.5 shrink-0" style={{ color: "#94A3B8" }} />
          <LicenseBadge license="No License" showNoLicense />
        </span>
      </div>

      {/* Company-Wide Impact and the full breakdown, the same two panels the
       * reassignment review shows, folded away here: the seat row answers the
       * question, these two are for the admin who wants the arithmetic. */}
      {sectionHeader(impactOpen, () => setImpactOpen((v) => !v), "View Company-Wide Impact")}
      {impactOpen && (
        <div className="px-3.5 pt-3 pb-3.5 space-y-1.5 border-t border-[#EEF2F6]">
          {impactRow("Current Daily Spend", `${formatCurrency(companyDaily)}/day`)}
          {impactRow("New Daily Spend", `${formatCurrency(newCompanyDaily)}/day`)}
          <div className="h-px my-1" style={{ backgroundColor: "#E2E8F0" }} />
          {impactRow("Current Monthly Estimate", `${formatCurrency(companyMonthly)}/mo`)}
          {impactRow("New Monthly Estimate", `${formatCurrency(newCompanyMonthly)}/mo`, true)}
          <div className="flex items-center justify-end pt-0.5">
            <span
              className="text-[11.5px] px-1.5 py-0.5 rounded tabular-nums border"
              style={{ fontWeight: 600, color: "#059669", backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }}
            >
              -{formatCurrency(seatMonthly)}/mo
            </span>
          </div>
        </div>
      )}

      {sectionHeader(breakdownOpen, () => setBreakdownOpen((v) => !v), "View Full Breakdown")}
      {breakdownOpen && (
        <div className="border-t" style={{ borderColor: "#EEF2F6" }}>
          {[
            { label: `Current daily rate (${license})`, value: `${formatCurrency(seatDaily)}/user/day` },
            { label: "New daily rate (No License)", value: `${formatCurrency(0)}/user/day` },
            { label: "Rate Difference", value: `${formatCurrency(seatDaily)}/day` },
            { label: "Users Affected", value: "1" },
            { label: "Days Remaining This Cycle", value: `${DAYS_REMAINING}` },
            { label: "Next Full Cycle Savings", value: `-${formatCurrency(seatMonthly)}/mo` },
            { label: "Current Monthly Estimate", value: `${formatCurrency(companyMonthly)}/mo` },
            { label: "New Monthly Estimate", value: `${formatCurrency(newCompanyMonthly)}/mo`, isLast: true },
          ].map((r, i) => (
            <div
              key={r.label}
              className="flex items-center justify-between gap-3 px-3.5"
              style={{
                backgroundColor: r.isLast || i % 2 === 0 ? "#fff" : "#F8FAFC",
                borderTop: r.isLast ? "1px solid #E2E8F0" : "none",
                paddingTop: r.isLast ? 9 : 7,
                paddingBottom: r.isLast ? 9 : 7,
              }}
            >
              <span className="text-[12px]" style={{ color: "#334155", fontWeight: r.isLast ? 600 : 400 }}>{r.label}</span>
              <span
                className="text-[12px] tabular-nums shrink-0"
                style={{ color: "#0F172A", fontWeight: r.isLast ? 700 : 500 }}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   User: Archive Modal
   ───────────────────────────────────────────
   Wraps CombinedDeactivateArchiveModal in archive mode so admins
   resolve the same active assignments before archiving.
   ═══════════════════════════════════════════ */
export function ArchiveUserModal({
  open,
  onClose,
  userName,
  userId,
  userLicense,
  isDeactivated = false,
  onConfirm,
  bulkCount,
  bulkLicensedCount,
  bulkUserIds,
}: {
  open: boolean;
  onClose: () => void;
  userName: string;
  userId?: number;
  userLicense?: string;
  /** When true, user is already deactivated; license is already removed. */
  isDeactivated?: boolean;
  onConfirm?: (removeLicense?: boolean) => void;
  bulkCount?: number;
  bulkLicensedCount?: number;
  bulkUserIds?: Array<number | string>;
}) {
  const isBulkArchive = !!bulkCount && bulkCount > 1;

  /* Archiving clears the user's roles, as every archive confirmation says it
   * will. Bulk archive clears them where it commits, in UsersTab, after the
   * Account Owners are filtered out of the selection. */
  const confirmArchive = (removeLicense?: boolean) => {
    if (!isBulkArchive && userId != null) removeUserFromAllRoles(userId);
    onConfirm?.(removeLicense);
  };

  /* The stepper is built around reassigning work: its steps, its width, and
   * its side-by-side rate panels are all sized for a user who has tasks and
   * owned roles to hand over. With nothing to reassign it collapses to two
   * billing readouts, and that much chrome around two numbers reads as
   * ceremony rather than a decision.
   *
   * So the split is drawn on work, not on license. No work to hand over means
   * the centered confirmation, with the billing facts kept but condensed into
   * ArchiveBillingSummary. A licensed user still sees what the seat costs, what
   * it drops to, and what the company total becomes; a No License user has no
   * billing change to show, so the block is left out entirely. */
  const holdsLicense = !!userLicense && userLicense !== "No License";
  const hasWorkToHandOver =
    userId != null && getActiveAssignmentsForUser(userId).length > 0;
  if (!isBulkArchive && !hasWorkToHandOver) {
    return (
      <DestructiveConfirmModal
        open={open}
        onClose={onClose}
        badge="Archive"
        title={`Archive ${userName}?`}
        description={
          <>
            {holdsLicense
              ? "Archiving clears all assigned roles, permissions, and MFA settings from the user record, and releases their license. "
              : `${
                  isDeactivated
                    ? "This user is already deactivated, so there is no license or billing change. "
                    : "This user holds no license, so there is no billing change. "
                }Archiving clears all assigned roles, permissions, and MFA settings from the user record. `}
            The user is removed from the active user listing and will only
            appear when the Archived filter is applied.
          </>
        }
        extra={holdsLicense ? <ArchiveBillingSummary license={userLicense!} /> : undefined}
        /* The billing block's two disclosures would otherwise push the modal
         * past the fold when both are open, so it scrolls at one height. */
        extraMaxHeight={holdsLicense ? 280 : undefined}
        confirmLabel="Archive User"
        cancelLabel="Cancel"
        maxWidth={500}
        onConfirm={() => {
          confirmArchive(true);
          toast.success(`${userName} was archived.`);
        }}
      />
    );
  }

  if (isBulkArchive) {
    return (
      <DeactivateUserWizard
        open={open}
        onClose={onClose}
        mode="archive"
        userName=""
        bulkUserIds={bulkUserIds}
        onConfirm={({ removeLicense }) => onConfirm?.(removeLicense)}
      />
    );
  }
  if (userId != null) {
    return (
      <DeactivateUserWizard
        open={open}
        onClose={onClose}
        mode="archive"
        userName={userName}
        userId={userId}
        userLicense={userLicense}
        onConfirm={({ removeLicense }) => confirmArchive(removeLicense)}
      />
    );
  }
  return (
    <CombinedDeactivateArchiveModal
      open={open}
      onClose={onClose}
      userName={userName}
      userId={userId}
      userLicense={userLicense}
      bulkCount={bulkCount}
      bulkLicensedCount={bulkLicensedCount}
      bulkUserIds={bulkUserIds}
      mode="archive"
      onConfirm={(removeLicense) => onConfirm?.(removeLicense)}
    />
  );
}

/* ═══════════════════════════════════════════
   User: Remove Role, Ownership Accordion
   ───────────────────────────────────────────
   Visual twin of LicenseAccordion: collapsible card with two
   side-by-side choice cards using DeactivateLicenseChoice. Shown only
   when the user being removed is a role owner. Includes an inline
   amber warning under "Remove from role and ownership" when the user
   is the only owner of the role.
   ═══════════════════════════════════════════ */
type OwnerRemovalChoice = "role-only" | "role-and-ownership";

function RoleOwnershipAccordion({
  choice,
  onChange,
  firstName,
  isOnlyOwner,
  roleId,
  onCloseModal,
}: {
  choice: OwnerRemovalChoice;
  onChange: (next: OwnerRemovalChoice) => void;
  firstName: string;
  isOnlyOwner: boolean;
  roleId: number;
  onCloseModal: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const navigate = useNavigate();

  const showOnlyOwnerWarning = choice === "role-and-ownership";

  return (
    <section>
      <div
        className="rounded-[10px] border bg-white overflow-hidden"
        style={{ borderColor: "#E2E8F0" }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left cursor-pointer hover:bg-[#F8FAFC] transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="text-[14px] text-[#0F172A] truncate"
              style={{ fontWeight: 600 }}
            >
              Role Ownership
            </span>
          </div>
          <span
            className="flex items-center gap-1 text-[12px] shrink-0"
            style={{ color: "#007FFF", fontWeight: 500 }}
          >
            {expanded ? (
              <>Hide <ChevronUpIcon className="w-3 h-3" /></>
            ) : (
              <>Show <ChevronDownIcon className="w-3 h-3" /></>
            )}
          </span>
        </button>
        {expanded && (
          <div
            className="border-t px-3.5 py-3 space-y-2.5"
            style={{ borderColor: "#E2E8F0" }}
          >
            <div className="grid grid-cols-2 gap-2">
              <DeactivateLicenseChoice
                selected={choice === "role-only"}
                onSelect={() => onChange("role-only")}
                label="Remove from Role Only"
                description={
                  <>{firstName} will lose the permissions in this role but will continue to manage it as an owner.</>
                }
              />
              <DeactivateLicenseChoice
                selected={choice === "role-and-ownership"}
                onSelect={() => onChange("role-and-ownership")}
                label="Remove from Role and Ownership"
                description={
                  <>{firstName} will be fully removed from this role in both capacities.</>
                }
              />
            </div>

            {/* Inline only-owner warning */}
            {showOnlyOwnerWarning && (
              <div
                className="flex items-start gap-2 px-3 py-2.5 rounded-md border"
                style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }}
              >
                <InfoIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#B45309" }} />
                <div className="text-[12px] leading-[1.55]" style={{ color: "#92400E", fontWeight: 450 }}>
                  {firstName} is the only owner of this role. Proceeding will leave this role without an owner. Permission requests and role management tasks for this role will have no designated recipient until a new owner is assigned and will be routed to the Tenant Admin only.
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onCloseModal();
                      navigate(`/company-settings/user-access-control/role/${roleId}?tab=owners`);
                    }}
                    className="ml-1 underline cursor-pointer inline-flex items-center gap-0.5 align-baseline"
                    style={{ color: "#B45309", fontWeight: 600, fontSize: "12px", lineHeight: "1.55" }}
                  >
                    Assign a new role owner
                    <ArrowRight className="w-3 h-3" style={{ color: "#B45309" }} />
                  </button>
                  .
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   User: Remove Role Modal
   ───────────────────────────────────────────
   Triggered when an admin removes a role from a user. Pixel-mirrors
   the Deactivate User modal: optional Role Ownership accordion (when
   the user is a role owner), followed by the Resolve Active
   Assignments accordion. Footer keeps the red CTAs.
   ═══════════════════════════════════════════ */
export function RemoveRoleModal({
  open,
  onClose,
  userId,
  userName,
  roleName,
  roleId,
  isOwner = false,
  isOnlyOwner = false,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  userId: number;
  userName: string;
  roleName: string;
  /** Role ID: required when the user is an owner so we can deep-link to Owners tab. */
  roleId?: number;
  /** Whether the user is currently a role owner (drives the ownership accordion). */
  isOwner?: boolean;
  /** Whether the user is the sole owner (drives the inline warning). */
  isOnlyOwner?: boolean;
  onConfirm?: (opts: { ownershipAlsoRemoved: boolean; leavesRoleWithoutOwner: boolean }) => void;
}) {
  const [resolutions, setResolutions] = useState<Record<string, ResolutionChoice>>({});
  const [ownerChoice, setOwnerChoice] = useState<OwnerRemovalChoice>("role-only");
  const assignments = useMemoAssignments(open, false, userId, undefined);
  const firstName = userName.split(" ")[0] || userName;

  useEffect(() => {
    if (open) {
      setResolutions({});
      setOwnerChoice("role-only");
    }
  }, [open]);

  const grouped = ASSIGNMENT_TYPE_ORDER
    .map((t) => ({ type: t, items: assignments.filter((a) => a.type === t) }))
    .filter((g) => g.items.length > 0);

  const total = assignments.length;
  const resolvedCount = Object.keys(resolutions).length;
  const allResolved = total === 0 || resolvedCount === total;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleConfirm = () => {
    const ownershipAlsoRemoved = isOwner && ownerChoice === "role-and-ownership";
    const leavesRoleWithoutOwner = ownershipAlsoRemoved && isOnlyOwner;
    onConfirm?.({ ownershipAlsoRemoved, leavesRoleWithoutOwner });
    if (ownershipAlsoRemoved) {
      const base = `${userName} has been removed from ${roleName} and is no longer an owner of this role.`;
      toast.success(
        leavesRoleWithoutOwner ? `${base} This role currently has no owner.` : base,
      );
    } else {
      toast.success(`${roleName} was removed from ${userName}.`);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose}>
      <div
        className="bg-white rounded-2xl w-full mx-4 overflow-hidden flex flex-col"
        style={{
          maxWidth: 760,
          maxHeight: "88vh",
          boxShadow:
            "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#EEF2F6] bg-white">
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] text-[#0F172A] flex items-center gap-1.5 flex-wrap" style={{ fontWeight: 650 }}>
              <span>Remove {roleName} from {userName}?</span>
              {isOwner && <OwnerChip size="xs" />}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div
          className="overflow-y-auto flex-1 px-5 py-4 bg-[#F8FAFC] space-y-4"
          style={{ minHeight: 0 }}
        >
          {/* Slate info banner */}
          <div
            className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg border"
            style={{ backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" }}
          >
            <InfoIcon
              className="w-4 h-4 shrink-0 mt-0.5"
              style={{ color: "#475569" }}
            />
            <p
              className="text-[12.5px] leading-[1.55]"
              style={{ color: "#334155", fontWeight: 450 }}
            >
              {isOwner ? (
                <>
                  <span style={{ fontWeight: 600 }}>{firstName}</span> is an owner of <span style={{ fontWeight: 600 }}>{roleName}</span>. Removing them will revoke the permissions granted by this role. Choose whether to also remove their ownership, then reassign their active assignments below to avoid orphaned work.
                </>
              ) : (
                <>
                  Removing <span style={{ fontWeight: 600 }}>{roleName}</span> revokes the permissions this role grants to {userName}. They will immediately lose access to any tasks, records, or modules tied to those permissions. Reassign their active assignments below to avoid orphaned work.
                </>
              )}
            </p>
          </div>

          {/* Role Ownership accordion (only when user is an owner) */}
          {isOwner && roleId != null && (
            <RoleOwnershipAccordion
              choice={ownerChoice}
              onChange={setOwnerChoice}
              firstName={firstName}
              isOnlyOwner={isOnlyOwner}
              roleId={roleId}
              onCloseModal={onClose}
            />
          )}

          {/* Active assignments accordion */}
          <ActiveAssignmentsAccordion
            assignments={assignments}
            grouped={grouped}
            resolutions={resolutions}
            isBulk={false}
            verbing="removing"
            onChoose={(itemId, choice) =>
              setResolutions((prev) =>
                choice
                  ? { ...prev, [itemId]: choice }
                  : (() => {
                      const next = { ...prev };
                      delete next[itemId];
                      return next;
                    })()
              )
            }
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#EEF2F6] bg-white">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          {/* Secondary: proceed without resolving (red outline) */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    handleConfirm();
                    onClose();
                  }}
                  className="h-9 px-4 rounded-[8px] border text-[13px] transition-colors cursor-pointer bg-white"
                  style={{
                    fontWeight: 600,
                    color: "#DC2626",
                    borderColor: "#FCA5A5",
                  }}
                >
                  Remove without Resolving Conflicts
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[300px]" style={{ zIndex: 100 }}>
                Proceeding without reassignment will leave these items unassigned. They can be reassigned later from each item's detail page.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* Primary: gated until all resolved (red filled) */}
          <button
            onClick={() => {
              handleConfirm();
              onClose();
            }}
            disabled={!allResolved}
            className="h-9 px-4 rounded-[8px] text-[13px] transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white"
            style={{ fontWeight: 600 }}
          >
            Remove and Resolve Conflicts
          </button>
        </div>
      </div>
    </ModalShell>
  );
}


/* ═══════════════════════════════════════════
   Role: Deactivate Role Modal, re-exported from dedicated file
   ═══════════════════════════════════════════ */
export { DeactivateRoleModal } from "./DeactivateRoleModal";

/* ═══════════════════════════════════════════
   Role: Duplicate Role Modal
   ═══════════════════════════════════════════ */
export function DuplicateRoleModal({
  open,
  onClose,
  roleName,
}: {
  open: boolean;
  onClose: () => void;
  roleName: string;
}) {
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setNewName(`${roleName} (Copy)`);
      setTimeout(() => inputRef.current?.select(), 100);
    }
  }, [open, roleName]);

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title="Duplicate Role"
      icon={<CopyIcon className="w-5 h-5" style={{ color: "#007FFF" }} />}
      iconBg="#EDF4FF"
      confirmLabel="Create Duplicate"
      confirmVariant="primary"
      onConfirm={() => {
        toast.success(`${roleName} was duplicated. A copy has been added to your role list.`);
      }}
      disabled={!newName.trim()}
    >
      <p className="text-[13px] text-[#475569]" style={{ fontWeight: 420, lineHeight: 1.6 }}>
        Create a new role based on <span style={{ fontWeight: 600 }}>{roleName}</span>.
        The new role will inherit the full permission set as a starting point.
      </p>
      <div className="mt-3">
        <label className="block text-[12px] text-[#334155] mb-1.5" style={{ fontWeight: 500 }}>
          New Role Name
        </label>
        <input
          ref={inputRef}
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="w-full h-9 px-3.5 border border-[#E2E8F0] rounded-[8px] text-[13px] text-[#0F172A] bg-white shadow-xs focus:outline-none focus:ring-1 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all placeholder:text-[#94A3B8]"
          style={{ fontWeight: 500 }}
          placeholder="Enter role name"
        />
      </div>
      <div
        className="mt-2.5 flex items-center gap-2 px-3 py-2 rounded-[8px] border"
        style={{ backgroundColor: "#EDF4FF", borderColor: "#007FFF20" }}
      >
        <Shield className="w-3.5 h-3.5" style={{ color: "#007FFF" }} />
        <span className="text-[12px] text-[#007FFF]" style={{ fontWeight: 480 }}>
          All permissions from "{roleName}" will be copied. No users will be assigned.
        </span>
      </div>
    </BaseModal>
  );
}

/* ═══════════════════════════════════════════
   Role: Archive Role Modal
   ═══════════════════════════════════════════ */
export function ArchiveRoleModal({
  open,
  onClose,
  roleName,
  usersCount,
}: {
  open: boolean;
  onClose: () => void;
  roleName: string;
  usersCount: number;
}) {
  const desc = usersCount > 0
    ? `Archiving ${roleName} is permanent. All ${usersCount} assigned user${usersCount !== 1 ? "s" : ""} will lose access granted by this role immediately. Role data, permissions, and activity history are preserved for audit purposes. This action cannot be undone.`
    : `Archiving ${roleName} is permanent. This role will be removed from active use and cannot be assigned to new users. Role data, permissions, and activity history are preserved for audit purposes. This action cannot be undone.`;

  return (
    <DestructiveConfirmModal
      open={open}
      onClose={onClose}
      badge="Archive"
      title="Archive Role?"
      description={desc}
      confirmLabel="Archive Role"
      cancelLabel="Cancel"
      onConfirm={() => {
        toast.success(`${roleName} was archived.`);
      }}
    />
  );
}
