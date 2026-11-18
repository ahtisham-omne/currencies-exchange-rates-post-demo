/* ═══════════════════════════════════════════════════════════════════
   Deactivate / Archive / Remove-License Wizard
   ───────────────────────────────────────────────────────────────────
   Four-step adaptive wizard that mirrors the Create New User modal
   stepper exactly (numbered circles, green-check completed, blue
   active, Back / Cancel / Continue footer, Full view affordance).

   Steps:
     1. License configuration              (deactivate flow only)
     2. Reassign active assignments        (skipped if 0 items)
     3. Reassign role ownership            (skipped if 0 owned roles)
     4. Review and confirm                 (always present)

   Modes:
     - "deactivate"      → all four steps eligible
     - "archive"         → skips Step 1 (license auto-cleared)
     - "remove-license"  → skips Step 1 (license already chosen)
   ═══════════════════════════════════════════════════════════════════ */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  X,
  Check,
  ArrowLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertTriangle,
  Crown,
  Search as SearchIcon,
  ChevronDown as ChevronDownIcon,
  Users as UsersIcon,
  Info,
  MapPin,
  Calendar,
  ShieldCheck,
  Package,
} from "lucide-react";
import { ModalShell } from "../shared/ModalShell";
import { LicenseReviewBody } from "../shared/LicenseReviewBody";
import { DestructiveConfirmModal } from "../shared/DestructiveConfirmModal";
import { UserSummaryTooltip } from "../shared/UserSummaryTooltip";
import { LinkedUserName } from "../shared/LinkedUserName";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import {
  getActiveAssignmentsForUser,
  getActiveAssignmentsForUsers,
  getEligibleAssignees,
  assignmentRequiresFullAccess,
  roleRequiresFullAccess,
  applyLicenseDowngrade,
  hasFullAccessDependentWork,
  ASSIGNMENT_TYPE_ORDER,
  type AssignmentType,
  type UserAssignment,
} from "../../data/user-assignments-data";
import {
  getRolesOwnedByUser,
  getRoleOwners,
} from "../../data/role-owners-data";
import { roles as allRoles, isProtectedRoleId } from "../../data/roles-data";
import { users as allUsers } from "../../data/users-data";
import { updateUserRowState } from "../../data/users-row-store";
import { resolveUserAvatar, getAvatarTint, getInitials } from "../../lib/avatar";
import { LicenseRequirementChip, type LicenseTier } from "../shared/LicenseRequirementChip";
import { highlightMatch } from "../../lib/highlight-text";

/** Title-case helper: capitalize each word, preserve separators. */
function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s+|\/|-)/)
    .map((part) => (part.match(/^[a-z]/) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join("");
}

/** A downgrade drops every Full-Access role except Account Owner, which the
 *  owner keeps (ERP-5186 AC8), so only the others need their ownership moved. */
function losesRoleOnDowngrade(roleId: number): boolean {
  return roleRequiresFullAccess(roleId) && !isProtectedRoleId(roleId);
}

/* ─── Types ───────────────────────────────────────────────────────── */
export type WizardMode = "deactivate" | "archive" | "remove-license" | "downgrade-license";
type LicenseChoice = "keep" | "remove";
type AssignmentResolution = { kind: "user"; userId: number } | { kind: "unassigned" };

interface WizardProps {
  open: boolean;
  onClose: () => void;
  mode: WizardMode;
  /** Single-user name (or unused in bulk mode). */
  userName: string;
  /** Single-user id. Required when bulkUserIds is not provided. */
  userId?: number;
  userLicense?: string;
  /** Target tier for the downgrade flow (e.g. "Field User"). Drives copy/toast. */
  targetLicense?: string;
  /** When provided with length > 1, wizard runs in bulk mode. */
  bulkUserIds?: Array<number | string>;
  /** Called on confirm. removeLicense = true when the license should be cleared. */
  onConfirm?: (opts: { removeLicense: boolean }) => void;
  /** Bulk only, fired when removing users from the selected-users panel empties
   *  the working selection. The host should dismiss the modal and clear the
   *  underlying listing selection (same end state as Cancel + clear). */
  onSelectionEmpty?: () => void;
}

/* ─── Module pill colors (re-used from ActionModals' palette) ─────── */
const TYPE_CHIP_COLORS: Record<AssignmentType, { bg: string; color: string; border: string }> = {
  "Cycle Count": { bg: "#EDF4FF", color: "#1D4ED8", border: "#BFDBFE" },
  "Movement": { bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0" },
  "Shipment": { bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
  "Sales Order": { bg: "#FCE7F3", color: "#9D174D", border: "#FBCFE8" },
  "Role Ownership": { bg: "#EDE9FE", color: "#5B21B6", border: "#C4B5FD" },
};

/* Tier billing, kept in sync with UnarchiveUserModal */
const LICENSE_BILLING: Record<string, { daily: number; monthly: number }> = {
  "Full Access": { daily: 5.0, monthly: 150.0 },
  "Field User": { daily: 0.5, monthly: 15.0 },
  "No License": { daily: 0, monthly: 0 },
};

const ELI_EMPTY_ACTIVE_ASSIGNMENT_ASSIGNEE_USER_ID = 4;

/* ─── Mock-data padding helpers ───────────────────────────────────── */
/** Pad assignments so Step 2 demonstrates 30+ rows for stress-testing. */
function padAssignmentsForDemo(items: UserAssignment[], userId: number): UserAssignment[] {
  /* A user who holds no work is left holding none. The padding exists to show
   * a long reassignment list on users who do have open work; fabricating rows
   * for someone with zero would put the reassignment step in front of a Draft
   * user who has never signed in (ERP-5203, ruled 17 Sep 2026) and would also
   * override the fixtures that deliberately model a clean deactivation. */
  if (items.length === 0) return items;
  if (items.length >= 12) return items;
  const padded = [...items];
  const types: AssignmentType[] = ["Cycle Count", "Movement", "Shipment", "Sales Order"];
  const ownerId = userId;
  // Ensure at least 12 mixed rows
  let i = 0;
  while (padded.length < 12) {
    const t = types[i % types.length];
    const seq = 6000 + i + userId * 7;
    const id = `${prefixFor(t)}-${String(seq).padStart(4, "0")}`;
    padded.push({
      id,
      type: t,
      label: `${labelFor(t)} #${id}`,
      ownerId,
    });
    i++;
  }
  return padded;
}
function prefixFor(t: AssignmentType): string {
  switch (t) {
    case "Cycle Count": return "CC";
    case "Movement": return "MV";
    case "Shipment": return "SH";
    case "Sales Order": return "SO";
    case "Role Ownership": return "RO";
  }
}
function labelFor(t: AssignmentType): string {
  switch (t) {
    case "Cycle Count": return "Cycle Count Task";
    case "Movement": return "Movement Task";
    case "Shipment": return "Shipment / Picking Task";
    case "Sales Order": return "Sales Order";
    case "Role Ownership": return "Role Owner";
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Main Wizard
   ═══════════════════════════════════════════════════════════════════ */
export function DeactivateUserWizard({
  open,
  onClose,
  mode,
  userName,
  userId,
  userLicense,
  targetLicense = "Field User",
  bulkUserIds,
  onConfirm,
  onSelectionEmpty,
}: WizardProps) {
  const isBulk = (bulkUserIds?.length ?? 0) > 1;
  const bulkCount = bulkUserIds?.length ?? 0;
  const firstName = userName.split(" ")[0] || userName;

  /* Subset of the selected users that actually has work to reassign.
   *   • downgrade-license → users with Full-Access-dependent tasks/roles
   *   • remove-license     → users with any active task or owned role
   *   • deactivate/archive → all selected (existing behavior)
   * Only these "affected" users get an accordion in the reassignment steps. */
  const [affectedUserIds, setAffectedUserIds] = useState<number[]>([]);

  /* The full working bulk selection (all selected users). Mutable within the
   * modal, the selected-users panel can remove users from it without touching
   * the underlying listing selection until the modal closes. */
  const [workingUserIds, setWorkingUserIds] = useState<number[]>([]);

  /* Bulk source-user objects (id + fullName + license) for accordions,
   * scoped to the affected users only. */
  const sourceUsers = useMemo(() => {
    if (!isBulk) return undefined;
    return affectedUserIds
      .map((id) => allUsers.find((u) => u.id === id))
      .filter(Boolean)
      .map((u) => ({ id: u!.id, fullName: u!.fullName, license: u!.license }));
  }, [isBulk, affectedUserIds]);

  /* Every selected user (affected or not), drives the selected-users panel
   * and the Review step billing math. */
  const allSelectedUsers = useMemo(
    () =>
      workingUserIds
        .map((id) => allUsers.find((u) => u.id === id))
        .filter(Boolean)
        .map((u) => ({ id: u!.id, fullName: u!.fullName, license: u!.license })),
    [workingUserIds],
  );

  /* Whether the "License configuration" step applies. In bulk, show it
   * if any user in the batch carries a billable license. */
  const hasLicenseChoice = useMemo(() => {
    if (mode !== "deactivate") return false;
    if (isBulk) {
      return (sourceUsers ?? []).some((u) => u.license && u.license !== "No License");
    }
    return !!userLicense && userLicense !== "No License";
  }, [mode, isBulk, sourceUsers, userLicense]);

  /* ─── Source data: recomputed when modal opens ─── */
  const [assignments, setAssignments] = useState<UserAssignment[]>([]);
  const [ownedRoleIds, setOwnedRoleIds] = useState<number[]>([]);

  /* ─── Wizard state ─── */
  const [licenseChoice, setLicenseChoice] = useState<LicenseChoice>("keep");
  const [resolutions, setResolutions] = useState<Record<string, AssignmentResolution>>({});
  const [ownerAssignments, setOwnerAssignments] = useState<Record<number, number | undefined>>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const commitPendingRef = useRef<(() => void) | null>(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  /* Derive affected users + their tasks/owned-roles from a working selection.
   * Reused on open and whenever a user is removed from the selected-users panel. */
  const computeBulkData = useCallback(
    (ids: number[]) => {
      const affected =
        mode === "downgrade-license"
          ? ids.filter(hasFullAccessDependentWork)
          : mode === "remove-license"
          ? ids.filter(
              (id) =>
                getActiveAssignmentsForUser(id).some((a) => a.type !== "Role Ownership") ||
                getRolesOwnedByUser(id).length > 0,
            )
          : ids; // deactivate / archive, all selected
      let asg = affected.flatMap((id) => getActiveAssignmentsForUser(id));
      if (mode === "downgrade-license") asg = asg.filter(assignmentRequiresFullAccess);
      const ownedSet = new Set<number>();
      affected.forEach((id) => {
        getRolesOwnedByUser(id).forEach((rid) => {
          if (mode === "downgrade-license" && !losesRoleOnDowngrade(rid)) return;
          ownedSet.add(rid);
        });
      });
      return { affected, assignments: asg, ownedRoleIds: Array.from(ownedSet) };
    },
    [mode],
  );

  useEffect(() => {
    if (!open) return;
    if (isBulk && bulkUserIds) {
      const allIds = bulkUserIds.map(Number);
      setWorkingUserIds(allIds);
      const data = computeBulkData(allIds);
      setAffectedUserIds(data.affected);
      setAssignments(data.assignments);
      setOwnedRoleIds(data.ownedRoleIds);
    } else if (userId != null) {
      const raw = getActiveAssignmentsForUser(userId);
      if (mode === "downgrade-license") {
        // Downgrade only breaks what depended on the higher tier, show
        // exactly those Full-Access-dependent tasks and owned roles.
        setAssignments(raw.filter(assignmentRequiresFullAccess));
        setOwnedRoleIds(getRolesOwnedByUser(userId).filter(losesRoleOnDowngrade));
      } else {
        setAssignments(padAssignmentsForDemo(raw, userId));
        setOwnedRoleIds(getRolesOwnedByUser(userId));
      }
    }
    setLicenseChoice("keep");
    setResolutions({});
    setOwnerAssignments({});
    setStepIdx(0);
    setIsFullScreen(false);
  }, [open, userId, isBulk, bulkUserIds, mode, computeBulkData]);

  /* Remove a user from the working bulk selection (selected-users panel X).
   * Recomputes affected users / tasks / owned roles and prunes any now-stale
   * task & ownership resolutions. Emptying the selection dismisses the modal. */
  const handleRemoveUser = useCallback(
    (id: number) => {
      const next = workingUserIds.filter((x) => x !== id);
      if (next.length === 0) {
        (onSelectionEmpty ?? onClose)();
        return;
      }
      setWorkingUserIds(next);
      const data = computeBulkData(next);
      setAffectedUserIds(data.affected);
      setAssignments(data.assignments);
      setOwnedRoleIds(data.ownedRoleIds);
      const taskIds = new Set(data.assignments.map((a) => a.id));
      setResolutions((prev) => {
        const out: Record<string, AssignmentResolution> = {};
        for (const k in prev) if (taskIds.has(k)) out[k] = prev[k];
        return out;
      });
      const ownedSet = new Set(data.ownedRoleIds);
      setOwnerAssignments((prev) => {
        const out: Record<number, number | undefined> = {};
        for (const k in prev) if (ownedSet.has(Number(k))) out[Number(k)] = prev[Number(k)];
        return out;
      });
    },
    [workingUserIds, computeBulkData, onClose, onSelectionEmpty],
  );

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  /* ─── Adaptive step list (Title Case) ─── */
  /* Task-only assignments for Step 2 (exclude Role Ownership, that belongs in Step 3) */
  const taskAssignments = useMemo(
    () => assignments.filter((a) => a.type !== "Role Ownership"),
    [assignments],
  );

  const steps = useMemo(() => {
    const s: { key: "license" | "assignments" | "ownership" | "review"; label: string }[] = [];
    if (hasLicenseChoice) s.push({ key: "license", label: "License Configuration" });
    if (taskAssignments.length > 0) s.push({ key: "assignments", label: "Reassign Active Assignments" });
    if (ownedRoleIds.length > 0) s.push({ key: "ownership", label: "Reassign Role Ownership" });
    // Every mode ends on Review & Confirm, the way the Remove-License flow does:
    // Deactivate and Archive used to jump straight from the last reassignment
    // step to the destructive action with nothing summarizing it.
    s.push({ key: "review", label: "Review & Confirm" });
    return s;
  }, [hasLicenseChoice, taskAssignments.length, ownedRoleIds.length]);

  const currentStep = steps[stepIdx] ?? steps[steps.length - 1];

  // Steps can disappear when users are removed from the panel, keep stepIdx valid.
  useEffect(() => {
    if (stepIdx > steps.length - 1) setStepIdx(Math.max(0, steps.length - 1));
  }, [steps.length, stepIdx]);

  /* ─── Validation per step ─── */
  /* Sole-owner roles are now "recommended", never block Continue. */
  const ownershipReady = true;

  const continueDisabled = false;

  /* ─── Modal title / subtitle / primary CTA per mode (Title Case) ─── */
  const subjectLabel = isBulk ? `${bulkCount} Users` : userName;
  const title =
    mode === "archive"
      ? `Archive ${subjectLabel}`
      : mode === "remove-license"
      ? `Remove License from ${subjectLabel}`
      : mode === "downgrade-license"
      ? `Downgrade ${subjectLabel} to ${targetLicense}`
      : `Deactivate ${subjectLabel}`;
  /* There is nothing to reassign when the subject holds no open work and owns
   * no role, which is the normal case for a Draft user: the subtitle should not
   * promise a step the flow is about to skip. */
  const hasWorkToReassign = taskAssignments.length > 0 || ownedRoleIds.length > 0;
  const subtitle =
    mode === "archive"
      ? isBulk
        ? hasWorkToReassign
          ? "Archive these users and reassign their work."
          : "Archive these users."
        : hasWorkToReassign
        ? "Archive this user and reassign their work."
        : "Archive this user."
      : mode === "remove-license"
      ? isBulk
        ? "Removing the license will revoke system access. Reassign their open work or leave it unassigned to handle later."
        : "Removing the license will revoke system access. Reassign their open work or leave it unassigned to handle later."
      : mode === "downgrade-license"
      ? "Downgrading removes Full Access permissions. Reassign the work that needs them, or leave it for later."
      : isBulk
      ? "Pause access for these users and reassign their work."
      : "Pause access and reassign their work.";
  const primaryLabel =
    mode === "archive"
      ? isBulk ? `Archive ${bulkCount} Users` : "Archive User"
      : mode === "remove-license"
      ? isBulk ? `Confirm Removal (${workingUserIds.length} users)` : "Confirm Removal"
      : mode === "downgrade-license"
      ? isBulk ? `Confirm Downgrade (${workingUserIds.length} users)` : "Confirm Downgrade"
      : isBulk ? `Deactivate ${bulkCount} Users` : "Deactivate User";

  /* Review step: the amber consequence banner and the bulk panel's summary
   * noun. The license flows keep LicenseReviewBody's own copy. */
  const reviewWarning =
    mode === "archive"
      ? isBulk
        ? "Archiving clears each user's roles, permissions, and MFA settings, and removes their license. The accounts leave the active listing and only appear under the Archived filter."
        : "Archiving clears this user's roles, permissions, and MFA settings, and removes their license. The account leaves the active listing and only appears under the Archived filter."
      : mode === "deactivate"
      ? isBulk
        ? "Deactivated users lose system access immediately. Their roles and permissions are preserved and you can reactivate them later."
        : "This user loses system access immediately. Their roles and permissions are preserved and you can reactivate them later."
      : undefined;
  const reviewScopeNoun =
    mode === "archive"
      ? "archiving"
      : mode === "deactivate"
      ? "deactivation"
      : mode === "remove-license"
      ? "removal"
      : "downgrade";

  const handleConfirm = useCallback(() => {
    // Single-user downgrade: unassign the Full-Access roles the user can no
    // longer hold, persisting any ownership the admin reassigned first.
    if (mode === "downgrade-license" && !isBulk && userId != null) {
      applyLicenseDowngrade(userId, ownerAssignments);
    }

    // Bulk license changes mutate every selected user's license directly so
    // the listing updates; affected users also get their Full-Access roles
    // unassigned (downgrade). Deactivate/archive keep routing through their
    // own confirm + parent callbacks (handled via onConfirm below).
    if (isBulk && (mode === "downgrade-license" || mode === "remove-license")) {
      // Only the users still in the working selection are affected, any
      // removed via the selected-users panel are left untouched.
      if (mode === "downgrade-license") {
        affectedUserIds.forEach((id) => applyLicenseDowngrade(id, ownerAssignments));
        workingUserIds.forEach((id) => updateUserRowState(id, { license: "Field User" }));
      } else {
        workingUserIds.forEach((id) => updateUserRowState(id, { license: "No License" }));
      }
    }

    const removeLicense =
      mode === "deactivate"
        ? hasLicenseChoice && licenseChoice === "remove"
        : mode === "downgrade-license"
        ? false
        : true;
    onConfirm?.({ removeLicense });
    const bulkN = workingUserIds.length;
    if (isBulk) {
      if (mode === "downgrade-license") toast.success(`${bulkN} users downgraded to ${targetLicense}`);
      else if (mode === "remove-license") toast.success(`${bulkN} users had their license removed`);
      else if (mode === "archive") toast.success(`${bulkCount} users were archived.`);
      else toast.success(`${bulkCount} users are deactivated.`);
    } else {
      if (mode === "downgrade-license") toast.success(`${userName} downgraded to ${targetLicense}`);
      else if (mode === "archive") toast.success(`${userName} was archived.`);
      else if (mode === "remove-license") toast.success(`License removed from ${userName}.`);
      else toast.success(`${userName} is deactivated.`);
    }
    onClose();
  }, [mode, hasLicenseChoice, licenseChoice, onConfirm, onClose, userName, isBulk, bulkCount, workingUserIds, userId, affectedUserIds, ownerAssignments, targetLicense]);

  /* ─── Step navigation ─── */
  const handleNext = () => {
    // Smart continue: commit any pending selections before navigating
    commitPendingRef.current?.();
    if (stepIdx < steps.length - 1) setStepIdx((s) => s + 1);
    else if (isBulk && (mode === "deactivate" || mode === "archive")) setShowBulkConfirm(true);
    else handleConfirm();
  };
  const handleBack = () => {
    if (stepIdx === 0) onClose();
    else setStepIdx((s) => s - 1);
  };
  const handleStepClick = (targetIdx: number) => {
    if (targetIdx === stepIdx) return;
    // Allow free backward navigation
    if (targetIdx < stepIdx) {
      setStepIdx(targetIdx);
      return;
    }
    // Forward: block if any intermediate step (including current) blocks Continue.
    // Currently only the ownership step can block.
    for (let i = stepIdx; i < targetIdx; i++) {
      if (steps[i]?.key === "ownership" && !ownershipReady) return;
    }
    setStepIdx(targetIdx);
  };

  /* Drives the body's scroll strategy: the reassignment steps manage their own
   * internal scrolling, everything else scrolls the whole body. */
  const isWideStep = currentStep.key === "assignments" || currentStep.key === "ownership";

  /* Geometry only. Review inherits the size of the step it follows so the modal
   * does not shrink when you advance into it. With no preceding step there is
   * nothing to match, so it keeps the default width. */
  const sizingKey =
    currentStep.key === "review" && stepIdx > 0 ? steps[stepIdx - 1].key : currentStep.key;
  const isWideLayout = sizingKey === "assignments" || sizingKey === "ownership";

  return (
    <>
    <ModalShell open={open} onClose={onClose} z={40}>
      <div
        className="bg-white flex flex-col overflow-hidden transition-[max-width,max-height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          width: "100vw",
          height: "100vh",
          maxWidth: isFullScreen ? "calc(100vw - 2rem)" : isWideLayout ? "1280px" : "960px",
          maxHeight: isFullScreen ? "calc(100vh - 2rem)" : isWideLayout ? "min(860px, calc(100vh - 48px))" : "min(720px, calc(100vh - 48px))",
          borderRadius: 16,
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* ─── Header (matches Create New User Modal exactly) ─── */}
        <div
          className={`px-4 lg:px-5 pt-4 shrink-0 bg-white border-b border-[#EEF2F6] ${steps.length > 1 ? "pb-0" : "pb-4"}`}
          style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[15px] sm:text-[17px] text-[#0F172A]" style={{ fontWeight: 700 }}>
                {title}
              </h2>
              <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5" style={{ fontWeight: 400 }}>
                {subtitle}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsFullScreen((v) => !v)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {isFullScreen ? "Exit full" : "Full view"}
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stepper, hidden when only one step applies (modal collapses to a single screen). */}
          {steps.length > 1 && (
          <div className="flex items-center gap-4 sm:gap-6 mt-3 sm:mt-3.5 overflow-x-auto -mb-px">
            {steps.map((step, i) => {
              const status = i < stepIdx ? "complete" : i === stepIdx ? "active" : "upcoming";
              const canNavigate =
                i !== stepIdx &&
                (i < stepIdx ||
                  steps.slice(stepIdx, i).every((s) => s.key !== "ownership" || ownershipReady));
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => handleStepClick(i)}
                  disabled={!canNavigate}
                  className={`relative flex items-center gap-2 pb-2.5 sm:pb-3 shrink-0 bg-transparent border-0 p-0 ${
                    canNavigate ? "cursor-pointer" : "cursor-default"
                  }`}
                >
                  <div
                    className={`w-[22px] h-[22px] sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-[12px] shrink-0 transition-all duration-200 ${
                      status === "complete"
                        ? "bg-[#10B981] text-white"
                        : status === "active"
                        ? "bg-[#007FFF] text-white"
                        : "border-[1.5px] border-[#CBD5E1] text-[#64748B] bg-white"
                    }`}
                    style={{ fontWeight: 600 }}
                  >
                    {status === "complete" ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <span
                    className={`text-[12px] sm:text-[13px] whitespace-nowrap transition-colors ${
                      status === "active"
                        ? "text-[#007FFF]"
                        : status === "complete"
                        ? "text-[#10B981]"
                        : "text-[#334155]"
                    }`}
                    style={{ fontWeight: status === "active" || status === "complete" ? 600 : 500 }}
                  >
                    {step.label}
                  </span>
                  {(status === "active" || status === "complete") && (
                    <div
                      className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full ${
                        status === "complete" ? "bg-[#10B981]" : "bg-[#007FFF]"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
          )}
        </div>

        {/* ─── Body ─── */}
        <div className={`flex-1 min-h-0 bg-[#FAFBFC] ${isWideStep ? "overflow-hidden" : "overflow-y-auto"}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep.key}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`${isWideStep ? "px-4 lg:px-6 py-4 lg:py-5 h-full" : "px-4 lg:px-6 py-4 lg:py-5 min-h-full"}`}
            >
              {currentStep.key === "license" && (
                <LicenseStep
                  userName={subjectLabel}
                  userLicense={userLicense ?? "Field User"}
                  choice={licenseChoice}
                  onChange={setLicenseChoice}
                  isBulk={isBulk}
                  bulkCount={bulkCount}
                />
              )}
              {currentStep.key === "assignments" && (
                <AssignmentsStep
                  userName={subjectLabel}
                  assignments={taskAssignments}
                  resolutions={resolutions}
                  onResolutionsChange={setResolutions}
                  sourceUsers={sourceUsers}
                  excludeUserIds={bulkUserIds ? bulkUserIds.map(Number) : userId ? [userId] : []}
                  commitPendingRef={commitPendingRef}
                  bulkScope={
                    isBulk
                      ? {
                          affectedCount: sourceUsers?.length ?? 0,
                          selectedCount: workingUserIds.length,
                          mode,
                          users: allSelectedUsers,
                          onRemoveUser: handleRemoveUser,
                        }
                      : undefined
                  }
                />
              )}
              {currentStep.key === "ownership" && (
                <OwnershipStep
                  userName={subjectLabel}
                  userId={userId ?? -1}
                  ownedRoleIds={ownedRoleIds}
                  selections={ownerAssignments}
                  onChange={setOwnerAssignments}
                  sourceUsers={sourceUsers}
                  commitPendingRef={commitPendingRef}
                  bulkScope={isBulk ? { affectedCount: sourceUsers?.length ?? 0, selectedCount: workingUserIds.length, mode } : undefined}
                />
              )}
              {currentStep.key === "review" && (
                /* One review body for all four modes: the Remove-License
                   layout (identity → consequence → rate change → billing note
                   → company-wide impact → full breakdown). Deactivate/Archive
                   differ only in the consequence copy and, when the admin
                   chose "Keep license", a rate change that nets to zero. */
                <LicenseReviewBody
                  action={mode === "downgrade-license" ? "downgrade" : "remove"}
                  keepLicense={mode === "deactivate" && licenseChoice === "keep"}
                  warning={reviewWarning}
                  users={isBulk ? allSelectedUsers : undefined}
                  identitySlot={
                    isBulk ? (
                      <SelectedUsersPanel
                        users={allSelectedUsers}
                        summary={`${workingUserIds.length} users selected for ${reviewScopeNoun}`}
                        onRemoveUser={handleRemoveUser}
                      />
                    ) : undefined
                  }
                  user={
                    isBulk
                      ? undefined
                      : {
                          id: userId,
                          name: userName,
                          email: allUsers.find((u) => u.id === userId)?.email ?? "",
                          license: userLicense ?? "Full Access",
                        }
                  }
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ─── Footer ─── */}
        <div
          className="shrink-0 border-t border-[#EEF2F6] bg-white px-4 lg:px-5 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-2.5"
          style={{ borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}
        >
          {stepIdx > 0 && (
            <button
              onClick={handleBack}
              className="inline-flex items-center justify-center px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] text-xs sm:text-[13px] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Back
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] border border-[#E2E8F0] bg-white text-xs sm:text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          {stepIdx < steps.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={continueDisabled}
              className="inline-flex items-center gap-1.5 px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] bg-[#007FFF] hover:bg-[#0066D6] active:bg-[#005BBF] text-white shadow-sm transition-colors cursor-pointer text-xs sm:text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontWeight: 600 }}
            >
              Continue
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              className={`inline-flex items-center gap-1.5 px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] text-white shadow-sm transition-colors cursor-pointer text-xs sm:text-[13px] ${
                mode === "deactivate"
                  ? "bg-[#D97706] hover:bg-[#B45309] active:bg-[#92400E]"
                  : "bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B]"
              }`}
              style={{ fontWeight: 600 }}
            >
              {primaryLabel}
            </button>
          )}
        </div>
      </div>
    </ModalShell>

      {/* Bulk confirmation modal */}
      {isBulk && (
        <DestructiveConfirmModal
          open={showBulkConfirm}
          onClose={() => setShowBulkConfirm(false)}
          badge={mode === "archive" ? "Archive" : "Deactivate"}
          title={
            mode === "archive"
              ? `Archive ${bulkCount} users?`
              : `Deactivate ${bulkCount} users?`
          }
          description={
            mode === "archive"
              ? `You are about to archive ${bulkCount} users. Archived users will lose all system access and their accounts will be permanently deactivated. This action cannot be undone.`
              : `You are about to deactivate ${bulkCount} users. Deactivated users will lose system access immediately. You can reactivate them later if needed.`
          }
          confirmLabel={
            mode === "archive"
              ? `Archive ${bulkCount} Users`
              : `Deactivate ${bulkCount} Users`
          }
          cancelLabel="Go back"
          onConfirm={handleConfirm}
          tone={mode === "archive" ? "danger" : "warning"}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Step 1: License Configuration
   ═══════════════════════════════════════════════════════════════════ */
function LicenseStep({
  userName,
  userLicense,
  choice,
  onChange,
  isBulk = false,
  bulkCount = 0,
}: {
  userName: string;
  userLicense: string;
  choice: LicenseChoice;
  onChange: (next: LicenseChoice) => void;
  isBulk?: boolean;
  bulkCount?: number;
}) {
  const billing = LICENSE_BILLING[userLicense] ?? LICENSE_BILLING["Field User"];
  const subjectPossessive = isBulk ? `these ${bulkCount} users'` : `${userName}'s`;
  const subjectPronoun = isBulk ? "They" : userName;
  return (
    <div className="w-full space-y-4">
      <StepInfoBanner>
        Choose what happens to {subjectPossessive} license{isBulk ? "s" : ""} while deactivated. You can change this later.
      </StepInfoBanner>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <LicenseDecisionCard
          selected={choice === "keep"}
          onSelect={() => onChange("keep")}
          intent="keep"
          pillLabel="Keep License"
          dailyDisplay={isBulk ? "Per-user rate continues" : `$${billing.daily.toFixed(2)}/day`}
          dailySubtitle="continues"
          monthly={isBulk ? "Same monthly cost" : `~$${billing.monthly.toFixed(2)}/mo`}
          description={
            <>
              Good for short pauses like parental leave or a security hold. {subjectPronoun} keep{isBulk ? "" : "s"} the license so you can reactivate in one step.
            </>
          }
        />
        <LicenseDecisionCard
          selected={choice === "remove"}
          onSelect={() => onChange("remove")}
          intent="remove"
          pillLabel="Remove License"
          dailyDisplay="$0.00/day"
          dailySubtitle="next cycle"
          monthly="~$0.00/mo"
          description={
            <>
              Good when you do not know if they are coming back. {subjectPronoun} {isBulk ? "are" : "is"} excluded from billing starting the next cycle.
            </>
          }
        />
      </div>
    </div>
  );
}

function LicenseDecisionCard({
  selected,
  onSelect,
  intent,
  pillLabel,
  dailyDisplay,
  dailySubtitle,
  monthly,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  intent: "keep" | "remove";
  pillLabel: string;
  dailyDisplay: string;
  dailySubtitle: string;
  monthly: string;
  description: React.ReactNode;
}) {
  // Gentle tints, much subtler than the unarchive purple
  const accent = intent === "keep" ? "#16A34A" : "#DC2626";
  const gradient =
    intent === "keep"
      ? "linear-gradient(135deg, #FFFFFF 0%, #F4FBF6 100%)"
      : "linear-gradient(135deg, #FFFFFF 0%, #FDF6F6 100%)";
  const pillBg = intent === "keep" ? "#DCFCE7" : "#FEE2E2";
  const pillColor = intent === "keep" ? "#15803D" : "#B91C1C";
  const pillBorder = intent === "keep" ? "#BBF7D0" : "#FECACA";
  const defaultBorder = intent === "keep" ? "#DCFCE7" : "#FEE2E2";

  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative text-left rounded-[12px] p-4 transition-all cursor-pointer flex flex-col gap-2.5"
      style={{
        background: gradient,
        border: `${selected ? "1.5px" : "1px"} solid ${selected ? accent : defaultBorder}`,
        boxShadow: selected ? "none" : "0 1px 3px rgba(15,23,42,0.05), 0 1px 2px rgba(15,23,42,0.03)",
      }}
    >
      {/* Pill + radio */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[12px] px-2.5 py-1 rounded-full border"
          style={{ fontWeight: 600, backgroundColor: pillBg, color: pillColor, borderColor: pillBorder }}
        >
          {pillLabel}
        </span>
        <div
          className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors"
          style={{ borderColor: selected ? accent : "#CBD5E1" }}
        >
          {selected && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />}
        </div>
      </div>
      {/* Price */}
      <p className="text-[22px] tracking-tight" style={{ fontWeight: 700, color: "#0F172A", lineHeight: 1.15 }}>
        {dailyDisplay}
      </p>
      {/* Description */}
      <p className="text-[12.5px] leading-snug" style={{ color: "#475569", fontWeight: 420 }}>
        {description}
      </p>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Step 2: Reassign Active Assignments  (two-column redesign)
   ═══════════════════════════════════════════════════════════════════ */

/* Deterministic mock meta (location + due date) per task id */
const MOCK_LOCATIONS = [
  "Warehouse A · Aisle 3",
  "Warehouse B · Dock 2",
  "Distribution Center · Zone 7",
  "Plant 4 · Floor 1",
  "Cold Storage · Bay 12",
  "Yard 9 · Lane B",
];
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function mockLocation(id: string) {
  return MOCK_LOCATIONS[hashStr(id) % MOCK_LOCATIONS.length];
}
function mockDueDate(id: string) {
  const day = (hashStr(id) % 27) + 1;
  const month = (hashStr(id + "m") % 3) + 5; // May–Jul 2026
  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/2026`;
}

/* Module filter chip categories */
const MODULE_FILTERS: { key: AssignmentType; label: string }[] = [
  { key: "Cycle Count", label: "Cycle Counts" },
  { key: "Shipment", label: "Shipments" },
  { key: "Movement", label: "Movement Tasks" },
  { key: "Sales Order", label: "Sales Orders" },
];

/* ─── Empty state for right-column user picker ─── */
function NoEligibleUsersEmpty({ roleId }: { roleId?: number }) {
  const role = roleId != null ? allRoles.find((r) => r.id === roleId) : null;
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center gap-4">
      {/* Icon container matching reference style */}
      <div className="relative">
        <div
          className="flex items-center justify-center rounded-2xl"
          style={{ width: 72, height: 72, backgroundColor: "#F1F5F9" }}
        >
          <UsersIcon className="w-8 h-8" style={{ color: "#94A3B8" }} />
        </div>
        <div
          className="absolute flex items-center justify-center rounded-full"
          style={{
            width: 24,
            height: 24,
            backgroundColor: "#F8FAFC",
            border: "2px solid white",
            bottom: -4,
            right: -4,
          }}
        >
          <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
        </div>
      </div>
      <div>
        <p className="text-[14px] font-semibold" style={{ color: "#1E293B" }}>
          No Eligible Users
        </p>
        <p className="text-[12.5px] mt-1.5 mx-auto leading-relaxed" style={{ color: "#94A3B8", maxWidth: 280 }}>
          There are no other users with the required role or permissions. You can assign users from the role's detail page after completing this step.
        </p>
      </div>
      <a
        href={role ? `/company-settings/user-access-control/role/${role.id}` : `/company-settings/user-access-control?tab=roles`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[12.5px] font-medium hover:underline"
        style={{ color: "#007FFF" }}
      >
        View Role
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

/* ─── Accordion header helpers (bulk license flows) ─── */
function UserAvatarSmall({ userId, name }: { userId: number; name: string }) {
  const photo = resolveUserAvatar({ userId, name });
  const tint = getAvatarTint(name);
  return (
    <span
      className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[10.5px] shrink-0"
      style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 700 }}
    >
      {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : getInitials(name)}
    </span>
  );
}

/* ─── Step info banner ───
 * Replaces the old in-content step title + paragraph. The stepper already names
 * the step, so the body only carries a single-line white informational banner. */
function StepInfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-[8px] border bg-white"
      style={{ borderColor: "#E2E8F0" }}
    >
      <Info className="w-4 h-4 shrink-0 mt-px" style={{ color: "#94A3B8" }} />
      <p className="text-[12.5px]" style={{ color: "#475569", fontWeight: 420, lineHeight: 1.5 }}>
        {children}
      </p>
    </div>
  );
}

/** Amber "[N] left" when items remain for a user, green "All set" otherwise. */
function StatusPill({ leftN, allSet }: { leftN: number; allSet: boolean }) {
  if (allSet) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] shrink-0"
        style={{ backgroundColor: "#DCFCE7", color: "#15803D", border: "1px solid #BBF7D0", fontWeight: 600 }}
      >
        <Check className="w-3 h-3" />
        All set
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] shrink-0"
      style={{ backgroundColor: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A", fontWeight: 600 }}
    >
      {leftN} left
    </span>
  );
}

/* ─── Selected-user chip (bulk selected-users panel) ───
 * Three independent hit areas: avatar (hover popover, click does nothing),
 * name (blue link → detail page in a new tab), X (remove from selection). */
function SelectedUserChip({
  userId,
  fullName,
  onRemove,
}: {
  userId: number;
  fullName: string;
  onRemove: () => void;
}) {
  const photo = resolveUserAvatar({ userId, name: fullName });
  const tint = getAvatarTint(fullName);
  return (
    <span
      className="group inline-flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-full border bg-[#F8FAFC] transition-colors hover:bg-[#F1F5F9]"
      style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 2px 0 rgba(15,23,42,0.06)" }}
    >
      {/* Avatar, existing hover popover; clicking does nothing */}
      <UserSummaryTooltip userName={fullName}>
        <span
          className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[10.5px]"
          style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 700 }}
        >
          {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : getInitials(fullName)}
        </span>
      </UserSummaryTooltip>
      {/* Name, primary blue link treatment; opens detail page in a new tab */}
      <LinkedUserName userId={userId} className="text-[12.5px]" style={{ color: "#334155", fontWeight: 500 }}>
        {fullName}
      </LinkedUserName>
      {/* Remove, turns red when the chip is hovered */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${fullName}`}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[#94A3B8] transition-colors cursor-pointer group-hover:text-[#DC2626] hover:bg-[#FEE2E2]"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

/* ─── Selected-users accordion panel (shared by the Reassign step and the
 *     Review & confirm identity area). White card, collapsible, chip cluster. */
function SelectedUsersPanel({
  users,
  summary,
  onRemoveUser,
  defaultExpanded = false,
}: {
  users: { id: number; fullName: string }[];
  summary: string;
  onRemoveUser?: (id: number) => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className="rounded-[10px] border bg-white overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`w-full flex items-center gap-2 px-3.5 py-2.5 text-left transition-colors cursor-pointer ${expanded ? "" : "hover:bg-[#F8FAFC]"}`}
        style={{ backgroundColor: expanded ? "#F8FAFC" : undefined }}
      >
        <UsersIcon className="w-4 h-4 shrink-0" style={{ color: "#64748B" }} />
        <span className="flex-1 text-[12.5px]" style={{ color: "#334155", fontWeight: 600, lineHeight: 1.5 }}>
          {summary}
        </span>
        <ChevronDownIcon
          className="w-4 h-4 shrink-0 transition-transform"
          style={{ color: "#94A3B8", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {expanded && (
        <div className="px-3.5 pt-2.5 pb-3 flex flex-wrap gap-1.5 border-t" style={{ borderColor: "#EEF2F6" }}>
          {users.map((u) => (
            <SelectedUserChip
              key={u.id}
              userId={u.id}
              fullName={u.fullName}
              onRemove={() => onRemoveUser?.(u.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AssignmentsStep({
  userName,
  assignments,
  resolutions,
  onResolutionsChange,
  sourceUsers,
  excludeUserIds = [],
  commitPendingRef,
  bulkScope,
}: {
  userName: string;
  assignments: UserAssignment[];
  resolutions: Record<string, AssignmentResolution>;
  onResolutionsChange: (next: Record<string, AssignmentResolution>) => void;
  /** When provided (>1), enables bulk-deactivation source filtering. */
  sourceUsers?: { id: number; fullName: string; license?: string }[];
  /** User IDs to exclude from the assignee pool (the users being deactivated/archived). */
  excludeUserIds?: number[];
  /** Ref for the wizard to call to commit pending selections before navigating. */
  commitPendingRef?: React.MutableRefObject<(() => void) | null>;
  /** Bulk license flow, when set, the left column groups tasks into a
   *  per-affected-user accordion and shows the selected-users panel. */
  bulkScope?: {
    affectedCount: number;
    selectedCount: number;
    mode: WizardMode;
    /** Every selected user (affected or not), chips in the panel. */
    users?: { id: number; fullName: string }[];
    /** Remove a user from the working bulk selection. */
    onRemoveUser?: (id: number) => void;
  };
}) {
  const isBulk = (sourceUsers?.length ?? 0) > 1 || !!bulkScope;
  /* Accordion mode: license-bulk flows group tasks per affected user. */
  const accordionMode = !!bulkScope;

  /* No pre-assignment, start with a clean slate. */

  const [taskQuery, setTaskQuery] = useState("");
  /* Accordion expand state, first affected user open by default. */
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(
    () => new Set(sourceUsers && sourceUsers.length > 0 ? [sourceUsers[0].id] : []),
  );
  const toggleUserExpanded = (uid: number) =>
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  /* Multi-select filter sets. Empty = "Show All". */
  const [userFilterSet, setUserFilterSet] = useState<Set<number>>(new Set());
  const [moduleFilterSet, setModuleFilterSet] = useState<Set<AssignmentType>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [userQuery, setUserQuery] = useState("");
  const [pickedUserId, setPickedUserId] = useState<number | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: assignments.length };
    assignments.forEach((a) => {
      c[a.type] = (c[a.type] ?? 0) + 1;
    });
    return c;
  }, [assignments]);

  /* Filter & search the task list */
  const visible = useMemo(() => {
    return assignments.filter((a) => {
      if (moduleFilterSet.size > 0 && !moduleFilterSet.has(a.type)) return false;
      if (isBulk && userFilterSet.size > 0 && !userFilterSet.has(a.ownerId)) return false;
      if (taskQuery.trim()) {
        const q = taskQuery.toLowerCase();
        if (!a.label.toLowerCase().includes(q) && !a.id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [assignments, moduleFilterSet, taskQuery, isBulk, userFilterSet]);

  const showAllActive = userFilterSet.size === 0 && moduleFilterSet.size === 0;
  const handleShowAll = () => {
    setUserFilterSet(new Set());
    setModuleFilterSet(new Set());
  };

  /* All rows are selectable. Right-column picker is disabled when every task is assigned.
   * If the current selection contains assigned tasks, show a red "Unassign all" text CTA. */
  const allAssigned = assignments.length > 0 && Object.values(resolutions).filter((r) => r.kind === "user").length === assignments.length;

  const selectableIds = useMemo(
    () => visible.map((a) => a.id),
    [visible]
  );

  const selectedAssignedIds = useMemo(
    () => Array.from(selectedIds).filter((id) => resolutions[id]?.kind === "user"),
    [selectedIds, resolutions]
  );
  const selectedUnassignedIds = useMemo(
    () => Array.from(selectedIds).filter((id) => resolutions[id]?.kind !== "user"),
    [selectedIds, resolutions]
  );

  const headerState: "checked" | "indeterminate" | "unchecked" = useMemo(() => {
    if (selectableIds.length === 0) return "unchecked";
    const allSel = selectableIds.every((id) => selectedIds.has(id));
    if (allSel) return "checked";
    const anySel = selectableIds.some((id) => selectedIds.has(id));
    return anySel ? "indeterminate" : "unchecked";
  }, [selectableIds, selectedIds]);

  const toggleAll = () => {
    if (headerState === "checked") {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        selectableIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        selectableIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };
  const toggleRow = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* Right-column user pool, only populated when tasks are selected */
  const userPool = useMemo(() => {
    if (!isBulk && excludeUserIds[0] === ELI_EMPTY_ACTIVE_ASSIGNMENT_ASSIGNEE_USER_ID) return [];
    const types = new Set<AssignmentType>();
    const sourceIds = selectedIds.size > 0 ? Array.from(selectedIds) : assignments.map((a) => a.id);
    sourceIds.forEach((id) => {
      const a = assignments.find((x) => x.id === id);
      if (a) types.add(a.type);
    });
    const seen = new Map<number, { id: number; fullName: string; email: string }>();
    types.forEach((t) => getEligibleAssignees(t, excludeUserIds).forEach((u) => seen.set(u.id, u)));
    return Array.from(seen.values());
  }, [selectedIds, assignments, excludeUserIds, isBulk]);

  /* Suggested = users who share at least one role with the source user(s).
   * Single-user: the user named in `userName`. Bulk: any affected source user. */
  const suggested = useMemo(() => {
    const refRoles = new Set<string>();
    if (isBulk && sourceUsers) {
      sourceUsers.forEach((su) => {
        allUsers.find((u) => u.id === su.id)?.assignedRoles.forEach((r) => refRoles.add(r.toLowerCase()));
      });
    } else {
      (allUsers.find((u) => u.fullName === userName)?.assignedRoles ?? []).forEach((r) =>
        refRoles.add(r.toLowerCase()),
      );
    }
    return userPool.filter((u) => {
      const r = allUsers.find((x) => x.id === u.id);
      return r?.assignedRoles.some((role) => refRoles.has(role.toLowerCase()));
    });
  }, [userPool, userName, isBulk, sourceUsers]);

  const filteredPool = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return userPool;
    return userPool.filter((u) => {
      const r = allUsers.find((x) => x.id === u.id);
      const roles = (r?.assignedRoles ?? []).join(" ").toLowerCase();
      return u.fullName.toLowerCase().includes(q) || roles.includes(q);
    });
  }, [userPool, userQuery]);
  const filteredSuggested = filteredPool.filter((u) => suggested.some((s) => s.id === u.id));
  const filteredAll = filteredPool.filter((u) => !suggested.some((s) => s.id === u.id));

  const total = assignments.length;
  const assignedCount = Object.values(resolutions).filter((r) => r.kind === "user").length;
  const remainingCount = total - assignedCount;
  /* Affected-user count for the select-all bar, reflects the Users filter. */
  const affectedInFilter = (sourceUsers ?? []).filter(
    (u) => userFilterSet.size === 0 || userFilterSet.has(u.id),
  ).length;

  const handleAssignBatch = useCallback(() => {
    if (pickedUserId == null || selectedIds.size === 0) return;
    const next = { ...resolutions };
    selectedIds.forEach((id) => {
      next[id] = { kind: "user", userId: pickedUserId };
    });
    onResolutionsChange(next);
    setSelectedIds(new Set());
    setPickedUserId(null);
    setUserQuery("");
  }, [pickedUserId, selectedIds, resolutions, onResolutionsChange]);

  // Wire up commitPendingRef so the wizard can auto-assign on Continue
  useEffect(() => {
    if (commitPendingRef) {
      commitPendingRef.current = () => {
        if (pickedUserId != null && selectedIds.size > 0) {
          handleAssignBatch();
        }
      };
    }
    return () => { if (commitPendingRef) commitPendingRef.current = null; };
  }, [commitPendingRef, pickedUserId, selectedIds, handleAssignBatch]);
  const handleClearAssignment = (id: string) => {
    const next = { ...resolutions };
    delete next[id];
    onResolutionsChange(next);
  };
  const handleUnassignBatch = () => {
    if (selectedIds.size === 0) return;
    const next = { ...resolutions };
    selectedIds.forEach((id) => { delete next[id]; });
    onResolutionsChange(next);
    setSelectedIds(new Set());
    setPickedUserId(null);
  };

  const pickedUser = pickedUserId != null ? allUsers.find((u) => u.id === pickedUserId) : null;
  const rightActive = selectedUnassignedIds.length > 0 && !allAssigned;
  const showUnassignCta = selectedAssignedIds.length > 0;

  const handleUnassignSelected = () => {
    if (selectedAssignedIds.length === 0) return;
    const next = { ...resolutions };
    selectedAssignedIds.forEach((id) => { delete next[id]; });
    onResolutionsChange(next);
    setSelectedIds(new Set());
  };

  // Dynamic assign button label
  const assignBtnLabel = useMemo(() => {
    if (selectedUnassignedIds.length > 0 && pickedUser) {
      return `Assign ${selectedUnassignedIds.length} task${selectedUnassignedIds.length === 1 ? "" : "s"} to ${pickedUser.fullName}`;
    }
    return "Assign tasks";
  }, [selectedUnassignedIds.length, pickedUser]);
  const assignBtnDisabled = selectedUnassignedIds.length === 0 || pickedUserId == null || allAssigned;

  /* ─── Single task card (identical markup for flat list + accordion bodies) ─── */
  const renderTaskCard = (item: UserAssignment) => {
    const choice = resolutions[item.id];
    const isAssigned = choice?.kind === "user";
    const isSelected = selectedIds.has(item.id);
    const chip = TYPE_CHIP_COLORS[item.type];
    const sourceUser = isBulk && !accordionMode ? sourceUsers!.find((u) => u.id === item.ownerId) : null;
    return (
      <div
        key={item.id}
        onClick={() => toggleRow(item.id)}
        className="rounded-[10px] p-2.5 transition-colors"
        style={{
          cursor: "pointer",
          border: `${isSelected ? "1.5px" : "1px"} solid ${
            isSelected ? "#007FFF" : isAssigned ? "#BBF7D0" : "#E2E8F0"
          }`,
          backgroundColor: isSelected ? "#EFF6FF" : isAssigned ? "#F0FDF4" : "#FFFFFF",
        }}
      >
        <div className="flex items-start gap-2.5">
          <div className="pt-0.5">
            <TriCheckbox
              state={isSelected ? "checked" : "unchecked"}
              onClick={() => toggleRow(item.id)}
              tone="primary"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10.5px]"
                style={{ backgroundColor: chip.bg, color: chip.color, border: `1px solid ${chip.border}`, fontWeight: 600 }}
              >
                {item.type}
              </span>
              <span className="text-[11px] font-mono" style={{ color: "#64748B" }}>
                {highlightMatch(item.id, taskQuery)}
              </span>
            </div>
            <p className="text-[13px] mt-1 truncate" style={{ color: "#0F172A", fontWeight: 500 }}>
              {highlightMatch(item.label, taskQuery)}
            </p>
            <div className="flex items-center gap-3 mt-1 text-[11.5px]" style={{ color: "#64748B" }}>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {mockLocation(item.id)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Due {mockDueDate(item.id)}
              </span>
            </div>
            {sourceUser && (
              <div className="mt-2">
                <SourcePill name={sourceUser.fullName} userId={sourceUser.id} />
              </div>
            )}
          </div>
          {isAssigned && (
            <div className="shrink-0 self-center">
              <AssignedPill
                userId={(choice as { kind: "user"; userId: number }).userId}
                onChange={() => handleClearAssignment(item.id)}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ─── Per-affected-user grouping for the bulk accordion ─── */
  const userGroups = (sourceUsers ?? [])
    .map((u) => {
      const all = assignments.filter((a) => a.ownerId === u.id);
      const userVisible = visible.filter((a) => a.ownerId === u.id);
      const assignedN = all.filter((a) => resolutions[a.id]?.kind === "user").length;
      return { user: u, all, visible: userVisible, assignedN, leftN: all.length - assignedN };
    })
    .filter((g) => g.visible.length > 0);

  /* Selected-users panel summary copy. */
  const panelSummary = bulkScope ? `${bulkScope.selectedCount} users selected` : null;

  return (
    <div className="w-full flex flex-col h-full">
      <div className="shrink-0 pb-3">
        <StepInfoBanner>
          {/* Verb agrees with the subject, not the item count: userName is a
              single person here and "N Users" in bulk. */}
          {userName} {isBulk ? "have" : "has"} {total} open item{total === 1 ? "" : "s"}. Anything left unassigned can be reassigned later.
        </StepInfoBanner>
      </div>

      {/* Selected-users panel (bulk license flows) */}
      {bulkScope && (
        <div className="shrink-0 mb-3">
          <SelectedUsersPanel
            users={bulkScope.users ?? []}
            summary={panelSummary ?? ""}
            onRemoveUser={bulkScope.onRemoveUser}
            defaultExpanded
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-3 flex-1 min-h-0">
        {/* ─── LEFT: tasks ─── */}
        <div className="rounded-[12px] border bg-white flex flex-col overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
          {/* Search + count */}
          <div className="px-3 pt-3 pb-2 flex items-center gap-2 shrink-0">
            <div className="flex-1 flex items-center gap-2 px-3 h-9 rounded-[8px] border bg-white" style={{ borderColor: "#E2E8F0" }}>
              <SearchIcon className="w-4 h-4 text-[#94A3B8]" />
              <input
                value={taskQuery}
                onChange={(e) => setTaskQuery(e.target.value)}
                placeholder="Search tasks by ID or title…"
                className="flex-1 outline-none text-[13px] bg-transparent placeholder:text-[#94A3B8]"
              />
            </div>
          </div>

          {/* Filter chips */}
          <div className="px-3 pb-2 flex items-center gap-1.5 flex-wrap shrink-0">
            <FilterChipButton
              label="Show All"
              count={assignments.length}
              active={showAllActive}
              onClick={handleShowAll}
            />
            {isBulk && (
              <MultiSelectFilterChip
                label="Users"
                summaryMode="options"
                items={(sourceUsers ?? []).map((u) => ({ key: u.id, label: u.fullName }))}
                selected={userFilterSet as Set<string | number>}
                onChange={(next) => setUserFilterSet(new Set(Array.from(next).map((v) => Number(v))))}
                getCount={(key) => assignments.filter((a) => a.ownerId === key).length}
              />
            )}
            <MultiSelectFilterChip
              label="Modules"
              items={MODULE_FILTERS.map((m) => ({ key: m.key, label: m.label }))}
              selected={moduleFilterSet as Set<string | number>}
              onChange={(next) => setModuleFilterSet(new Set(Array.from(next).map((v) => String(v) as AssignmentType)))}
              getCount={(key) => counts[String(key)] ?? 0}
            />
          </div>

          {/* Select-all bar / bulk progress summary */}
          <div className="px-3 py-2 border-t border-b flex items-center gap-2 shrink-0" style={{ borderColor: "#EEF2F6", backgroundColor: "#FAFBFC" }}>
            <TriCheckbox state={headerState} onClick={toggleAll} tone="primary" />
            <span className="text-[12px]" style={{ color: "#475569", fontWeight: 500 }}>
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
            </span>
            {accordionMode && bulkScope && (
              <span className="text-[11.5px]" style={{ color: "#94A3B8", fontWeight: 500 }}>
                · {affectedInFilter} user{affectedInFilter === 1 ? "" : "s"} affected
              </span>
            )}
            <div className="flex-1" />
            {showUnassignCta ? (
              <button
                onClick={handleUnassignSelected}
                className="inline-flex items-center gap-1 text-[12px] cursor-pointer transition-opacity hover:opacity-80"
                style={{ color: "#DC2626", fontWeight: 600 }}
              >
                <X className="w-3.5 h-3.5" />
                Unassign all ({selectedAssignedIds.length})
              </button>
            ) : (
              <span className="text-[11.5px]" style={{ color: "#64748B" }}>
                {accordionMode
                  ? `${assignedCount} of ${total} assigned · ${remainingCount} remaining`
                  : `${assignedCount} assigned · ${remainingCount} remaining`}
              </span>
            )}
          </div>

          {/* Task list, flat (single user) or per-user accordion (bulk) */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5" style={{ minHeight: 0 }}>
            {visible.length === 0 ? (
              <div className="px-4 py-12 text-center text-[12.5px] flex flex-col items-center gap-1.5" style={{ color: "#94A3B8" }}>
                {accordionMode && assignments.length === 0 ? (
                  <>
                    <CheckCircle2 className="w-7 h-7" style={{ color: "#CBD5E1" }} />
                    <span>No remaining users have work to reassign.</span>
                  </>
                ) : (
                  "No tasks match the current filter."
                )}
              </div>
            ) : accordionMode ? (
              userGroups.map((g) => {
                const expanded = expandedUsers.has(g.user.id);
                const allSet = g.leftN === 0;
                return (
                  <div key={g.user.id} className="rounded-[10px] border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
                    {/* Accordion header */}
                    <button
                      type="button"
                      onClick={() => toggleUserExpanded(g.user.id)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-[#F8FAFC]"
                      style={{ backgroundColor: expanded ? "#F8FAFC" : "#FFFFFF" }}
                    >
                      <ChevronDownIcon
                        className="w-4 h-4 shrink-0 transition-transform"
                        style={{ color: "#94A3B8", transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
                      />
                      <UserAvatarSmall userId={g.user.id} name={g.user.fullName} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] truncate" style={{ color: "#0F172A", fontWeight: 600 }}>
                          {g.user.fullName}
                        </p>
                        <p className="text-[11px]" style={{ color: "#94A3B8" }}>
                          {g.all.length} open item{g.all.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <StatusPill leftN={g.leftN} allSet={allSet} />
                    </button>
                    {/* Accordion body, that user's task cards (unchanged) */}
                    {expanded && (
                      <div className="p-2 space-y-1.5 border-t" style={{ borderColor: "#EEF2F6", backgroundColor: "#FAFBFC" }}>
                        {g.visible.map((item) => renderTaskCard(item))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              visible.map((item) => renderTaskCard(item))
            )}
          </div>
        </div>

        {/* ─── RIGHT: user picker ─── */}
        <div
          className="rounded-[12px] bg-white flex flex-col overflow-hidden transition-[box-shadow,border-color] relative"
          style={{
            border: rightActive ? "2px solid #007FFF" : "1px solid #E2E8F0",
            boxShadow: rightActive ? "0 0 0 4px rgba(0,127,255,0.08)" : "none",
            opacity: allAssigned ? 0.55 : 1,
          }}
        >
          {/* Header: search only */}
          <div className="px-3 pt-3 pb-2 flex items-center gap-2 shrink-0">
            <div className="flex-1 flex items-center gap-2 px-3 h-9 rounded-[8px] border bg-white" style={{ borderColor: "#E2E8F0" }}>
              <SearchIcon className="w-4 h-4 text-[#94A3B8]" />
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Search users by name or role…"
                disabled={allAssigned}
                className="flex-1 outline-none text-[13px] bg-transparent placeholder:text-[#94A3B8] disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* User list, scrollable */}
          <div className="flex-1 overflow-y-auto px-2" style={{ minHeight: 0, pointerEvents: allAssigned ? "none" : undefined }}>
            {filteredSuggested.length > 0 && (
              <UserPickerSection title="Suggested" users={filteredSuggested} pickedId={pickedUserId} onPick={setPickedUserId} query={userQuery} />
            )}
            {filteredAll.length > 0 && (
              <UserPickerSection title="All Eligible Users" users={filteredAll} pickedId={pickedUserId} onPick={setPickedUserId} query={userQuery} />
            )}
            {filteredSuggested.length === 0 && filteredAll.length === 0 && userPool.length > 0 && (
              <div className="px-4 py-12 text-center text-[12.5px]" style={{ color: "#94A3B8" }}>
                No Matching Users.
              </div>
            )}
            {userPool.length === 0 && (
              <NoEligibleUsersEmpty />
            )}
          </div>

          {/* Footer: assign button, slides in when a user is picked */}
          <div
            className="shrink-0 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{
              maxHeight: pickedUserId != null ? 52 : 0,
              opacity: pickedUserId != null ? 1 : 0,
            }}
          >
            <div className="px-3 pb-3 pt-2 border-t" style={{ borderColor: "#EEF2F6" }}>
              <button
                onClick={handleAssignBatch}
                disabled={assignBtnDisabled}
                className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-[8px] text-white text-[13px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: "#16A34A", fontWeight: 600 }}
              >
                <Check className="w-3.5 h-3.5" />
                {assignBtnLabel}
              </button>
            </div>
          </div>

          {allAssigned && (
            <div
              className="absolute left-3 right-3 top-[60px] px-3 py-2 rounded-[8px] text-[12px] text-center pointer-events-none"
              style={{ backgroundColor: "#F1F5F9", color: "#475569", border: "1px solid #E2E8F0", fontWeight: 500 }}
            >
              All Tasks Assigned
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

/* ─── Helper: assigned-state pill (filled dark green) with avatar + remove (X) ─── */
function AssignedPill({ userId, onChange }: { userId: number; onChange: () => void }) {
  const u = allUsers.find((x) => x.id === userId);
  if (!u) return null;
  const photo = resolveUserAvatar({ userId, name: u.fullName });
  return (
    <div
      className="inline-flex items-center gap-2 pl-1 pr-1.5 py-1 rounded-full"
      style={{ backgroundColor: "#15803D" }}
    >
      <UserSummaryTooltip userName={u.fullName} clickToNavigate>
        <span className="inline-flex items-center gap-2">
          <span
            className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center text-[9.5px]"
            style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#FFFFFF", fontWeight: 700 }}
          >
            {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : getInitials(u.fullName)}
          </span>
          <span className="text-[11.5px]" style={{ color: "#FFFFFF", fontWeight: 600 }}>
            {u.fullName}
          </span>
        </span>
      </UserSummaryTooltip>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onChange();
        }}
        aria-label="Remove assignee"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full cursor-pointer transition-colors hover:bg-white/20"
        style={{ color: "#FFFFFF" }}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

/* ─── Helper: small source-user pill for bulk-mode tasks ─── */
function SourcePill({ name, userId }: { name: string; userId: number }) {
  const tint = getAvatarTint(name);
  const photo = resolveUserAvatar({ userId, name });
  return (
    <UserSummaryTooltip userName={name} clickToNavigate>
      <span
        className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full border transition-colors hover:border-[#94A3B8]"
        style={{ backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
      >
        <span className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center text-[9.5px]" style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 700 }}>
          {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : name.charAt(0)}
        </span>
        <span className="text-[11.5px]" style={{ color: "#334155", fontWeight: 600 }}>
          {name.split(" ")[0]}
        </span>
      </span>
    </UserSummaryTooltip>
  );
}

/* ─── Helper: tri-state checkbox (with disabled support) ─── */
function TriCheckbox({
  state,
  onClick,
  disabled,
  tone = "primary",
}: {
  state: "checked" | "indeterminate" | "unchecked";
  onClick: () => void;
  disabled?: boolean;
  tone?: "primary" | "danger";
}) {
  const checked = state === "checked";
  const indeterminate = state === "indeterminate";
  const fill = tone === "danger" ? "#DC2626" : "#007FFF";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      className="w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors"
      style={{
        backgroundColor: checked || indeterminate ? fill : "#FFFFFF",
        borderColor: checked || indeterminate ? fill : "#CBD5E1",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {indeterminate ? (
        <svg width="10" height="10" viewBox="0 0 10 10">
          <rect x="1.5" y="4.25" width="7" height="1.5" rx="0.75" fill="white" />
        </svg>
      ) : checked ? (
        <Check className="w-3 h-3 text-white" />
      ) : null}
    </button>
  );
}

/* ─── Helper: user picker section (Suggested / All) with radio cards ─── */
function UserPickerSection({
  title,
  users,
  pickedId,
  onPick,
  groupBadge,
  query = "",
}: {
  title: string;
  users: { id: number; fullName: string; email: string }[];
  pickedId: number | null;
  onPick: (id: number | null) => void;
  groupBadge?: { label: string; bg: string; color: string; border: string };
  query?: string;
}) {
  return (
    <div className="mt-2">
      <p className="px-2 pt-1 pb-1.5 text-[10.5px] uppercase tracking-wide" style={{ color: "#64748B", fontWeight: 600, letterSpacing: "0.04em" }}>
        {title}
      </p>
      <div className="space-y-1">
        {users.map((u) => {
          const full = allUsers.find((x) => x.id === u.id);
          const role = full?.assignedRoles?.[0] ?? "-";
          const license = full?.license ?? "Field User";
          const tint = getAvatarTint(u.fullName);
          const photo = resolveUserAvatar({ userId: u.id, name: u.fullName });
          const picked = pickedId === u.id;
          return (
            <div
              key={u.id}
              role="button"
              tabIndex={0}
              onClick={() => onPick(picked ? null : u.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPick(picked ? null : u.id);
                }
              }}
              className="group/pickcard w-full text-left px-2 py-2 rounded-[8px] flex items-center gap-3 transition-colors hover:bg-[#EFF6FF]"
              style={{
                border: `${picked ? "1.5px" : "1px"} solid ${picked ? "#007FFF" : "#EEF2F6"}`,
                backgroundColor: picked ? "#EFF6FF" : "#FFFFFF",
                cursor: "pointer",
              }}
            >
              <div
                className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                style={{ borderColor: picked ? "#007FFF" : "#CBD5E1" }}
              >
                {picked && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#007FFF" }} />}
              </div>
              <span className="flex items-center gap-2.5 flex-1 min-w-0">
                <UserSummaryTooltip userName={u.fullName} clickToNavigate>
                  <span
                    className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[10.5px] shrink-0"
                    style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 700 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : getInitials(u.fullName)}
                  </span>
                </UserSummaryTooltip>
                <span className="flex-1 min-w-0 inline-block text-left">
                  <span className="flex items-center gap-1.5">
                    <LinkedUserName
                      userId={u.id}
                      className="text-[12.5px] truncate"
                      style={{ color: "#0F172A", fontWeight: 600 }}
                    >
                      {highlightMatch(u.fullName, query)}
                    </LinkedUserName>
                    {groupBadge && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9.5px] shrink-0"
                        style={{ backgroundColor: groupBadge.bg, color: groupBadge.color, border: `1px solid ${groupBadge.border}`, fontWeight: 600 }}
                      >
                        {groupBadge.label}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 mt-0.5 min-w-0">
                    <span className="text-[11.5px] truncate" style={{ color: "#64748B", fontWeight: 450 }}>
                      {highlightMatch(toTitleCase(role), query)}
                    </span>
                  </span>
                </span>
              </span>
              <div className="shrink-0 ml-auto self-center">
                <LicenseRequirementChip
                  tier={(license === "Full Access" ? "Full Access" : "Field User") as LicenseTier}
                  variant="bare"
                  size="xs"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Step 3: Reassign Role Ownership  (two-column redesign)
   ═══════════════════════════════════════════════════════════════════ */
export function OwnershipStep({
  userName,
  userId,
  ownedRoleIds,
  selections,
  onChange,
  sourceUsers,
  commitPendingRef,
  bulkScope,
}: {
  userName: string;
  userId: number;
  ownedRoleIds: number[];
  selections: Record<number, number | undefined>;
  onChange: (next: Record<number, number | undefined>) => void;
  sourceUsers?: { id: number; fullName: string; license?: string }[];
  commitPendingRef?: React.MutableRefObject<(() => void) | null>;
  /** Bulk license flow, group owned roles into a per-affected-user accordion. */
  bulkScope?: { affectedCount: number; selectedCount: number; mode: WizardMode };
}) {
  const accordionMode = !!bulkScope;
  const isBulk = (sourceUsers?.length ?? 0) > 1 || accordionMode;
  const sourceUserIds = useMemo(() => new Set((sourceUsers ?? []).map((u) => u.id)), [sourceUsers]);
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(
    () => new Set(sourceUsers && sourceUsers.length > 0 ? [sourceUsers[0].id] : []),
  );
  const toggleUserExpanded = (uid: number) =>
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  /* Identify which roles are "Recommended" (sole-owner) vs "Optional" (co-owned).
   * Compute `owningUserIds` (which deactivating users own this role) for bulk chip. */
  const roleMeta = useMemo(
    () =>
      ownedRoleIds.map((rid) => {
        const owners = getRoleOwners(rid);
        const owningUserIds = isBulk
          ? owners.map((o) => o.userId).filter((id) => sourceUserIds.has(id))
          : [userId];
        const otherOwners = owners.filter((o) => !owningUserIds.includes(o.userId)).length;
        return { roleId: rid, isRecommended: otherOwners === 0, otherOwners, owningUserIds };
      }),
    [ownedRoleIds, userId, isBulk, sourceUserIds]
  );

  const [filter, setFilter] = useState<"all" | "recommended" | "optional">("all");
  const [userFilterSet, setUserFilterSet] = useState<Set<number>>(new Set());
  const [roleQuery, setRoleQuery] = useState("");
  const [activeRoleId, setActiveRoleId] = useState<number | null>(
    ownedRoleIds.length === 1 ? ownedRoleIds[0] : null,
  );
  const [userQuery, setUserQuery] = useState("");
  const [pickedUserId, setPickedUserId] = useState<number | null>(null);

  useEffect(() => {
    setPickedUserId(null);
    setUserQuery("");
  }, [activeRoleId]);

  const counts = {
    all: roleMeta.length,
    recommended: roleMeta.filter((m) => m.isRecommended).length,
    optional: roleMeta.filter((m) => !m.isRecommended).length,
  };

  const visibleRoles = useMemo(() => {
    return roleMeta.filter((m) => {
      if (filter === "recommended" && !m.isRecommended) return false;
      if (filter === "optional" && m.isRecommended) return false;
      if (isBulk && userFilterSet.size > 0 && !m.owningUserIds.some((id) => userFilterSet.has(id))) return false;
      if (roleQuery.trim()) {
        const r = allRoles.find((x) => x.id === m.roleId);
        if (!r?.roleName.toLowerCase().includes(roleQuery.toLowerCase())) return false;
      }
      return true;
    });
  }, [roleMeta, filter, roleQuery, isBulk, userFilterSet]);

  const activeRole = activeRoleId != null ? allRoles.find((r) => r.id === activeRoleId) : null;
  const activeOwners = activeRoleId != null ? getRoleOwners(activeRoleId) : [];
  const activeOwnerIds = new Set(activeOwners.map((o) => o.userId));

  /* Eligibility groups for the active role */
  const eligibility = useMemo(() => {
    if (!activeRole) return { coOwners: [], holdsRole: [], hasManage: [] };
    const excludeIds = isBulk ? sourceUserIds : new Set([userId]);
    const roleNameLower = activeRole.roleName.toLowerCase();
    const holders = allUsers.filter(
      (u) =>
        !excludeIds.has(u.id) &&
        u.status === "Active" &&
        u.assignedRoles.some((r) => r.toLowerCase() === roleNameLower)
    );
    const coOwners = holders.filter((u) => activeOwnerIds.has(u.id));
    const holdsRole = holders.filter((u) => !activeOwnerIds.has(u.id));
    const managers = holders.length > 0
      ? allUsers
          .filter(
            (u) =>
              !excludeIds.has(u.id) &&
              u.status === "Active" &&
              u.license === "Full Access" &&
              u.assignedRoles.some((r) => /admin|manager|director|head|lead/.test(r.toLowerCase())) &&
              !holders.some((h) => h.id === u.id)
          )
          .slice(0, 6)
      : [];
    return {
      coOwners: coOwners.map((u) => ({ id: u.id, fullName: u.fullName, email: u.email })),
      holdsRole: holdsRole.map((u) => ({ id: u.id, fullName: u.fullName, email: u.email })),
      hasManage: managers.map((u) => ({ id: u.id, fullName: u.fullName, email: u.email })),
    };
  }, [activeRole, userId, activeOwnerIds, isBulk, sourceUserIds]);

  const matchesQuery = (name: string) => !userQuery.trim() || name.toLowerCase().includes(userQuery.toLowerCase());
  const fCo = eligibility.coOwners.filter((u) => matchesQuery(u.fullName));
  const fHolds = eligibility.holdsRole.filter((u) => matchesQuery(u.fullName));
  const fMgr = eligibility.hasManage.filter((u) => matchesQuery(u.fullName));

  const handleAssign = useCallback(() => {
    if (activeRoleId == null || pickedUserId == null) return;
    onChange({ ...selections, [activeRoleId]: pickedUserId });
    /* Auto-advance to the next unresolved required role */
    const next = roleMeta.find((m) => m.roleId !== activeRoleId && !selections[m.roleId] && m.isRecommended);
    const fallback = roleMeta.find((m) => m.roleId !== activeRoleId && !selections[m.roleId]);
    setActiveRoleId(next?.roleId ?? fallback?.roleId ?? null);
    setPickedUserId(null);
    setUserQuery("");
  }, [activeRoleId, pickedUserId, selections, onChange, roleMeta]);

  // Wire up commitPendingRef so the wizard can auto-assign on Continue
  useEffect(() => {
    if (commitPendingRef) {
      commitPendingRef.current = () => {
        if (activeRoleId != null && pickedUserId != null) {
          handleAssign();
        }
      };
    }
    return () => { if (commitPendingRef) commitPendingRef.current = null; };
  }, [commitPendingRef, activeRoleId, pickedUserId, handleAssign]);

  const pickedUser = pickedUserId != null ? allUsers.find((u) => u.id === pickedUserId) : null;
  const rightActive = activeRoleId != null;

  // Dynamic assign button label
  const assignBtnLabel = useMemo(() => {
    if (activeRoleId != null && pickedUser) {
      return `Assign ${pickedUser.fullName} as owner`;
    }
    return "Assign owner";
  }, [activeRoleId, pickedUser]);
  const assignBtnDisabled = activeRoleId == null || pickedUserId == null;

  // Counts for footer
  const assignedOwnerCount = ownedRoleIds.filter((rid) => selections[rid] != null).length;
  const remainingOwnerCount = ownedRoleIds.length - assignedOwnerCount;

  /* ─── Single role card (identical markup for flat list + accordion bodies) ─── */
  const renderRoleCard = (m: (typeof roleMeta)[number]) => {
    const r = allRoles.find((x) => x.id === m.roleId);
    const isActive = activeRoleId === m.roleId;
    const assignedNewOwner = selections[m.roleId];
    const isAssigned = assignedNewOwner != null;
    const roleCard = (
      <button
        key={m.roleId}
        type="button"
        onClick={() => setActiveRoleId(m.roleId)}
        className="w-full text-left rounded-[10px] p-2.5 transition-colors"
        style={{
          cursor: "pointer",
          border: `${isActive ? "1.5px" : "1px"} solid ${
            isAssigned ? "#BBF7D0" : isActive ? "#007FFF" : m.isRecommended ? "#FDE68A" : "#E2E8F0"
          }`,
          backgroundColor: isAssigned ? "#F0FDF4" : isActive ? "#EFF6FF" : m.isRecommended ? "#FFFBEB" : "#FFFFFF",
        }}
      >
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0" style={{ backgroundColor: "#EDE9FE", color: "#5B21B6" }}>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px]" style={{ color: "#0F172A", fontWeight: 600 }}>
                {r?.roleName ? highlightMatch(r.roleName, roleQuery) : `Role #${m.roleId}`}
              </span>
              {m.isRecommended && (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px]"
                  style={{ backgroundColor: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A", fontWeight: 600 }}
                >
                  Recommended
                </span>
              )}
              {isBulk && !accordionMode &&
                m.owningUserIds.map((oid) => {
                  const ou = (sourceUsers ?? []).find((s) => s.id === oid);
                  return ou ? <SourcePill key={oid} name={ou.fullName} userId={ou.id} /> : null;
                })}
            </div>
            {r?.description && (
              <p className="text-[11.5px] mt-0.5 line-clamp-1 break-words" style={{ color: "#64748B" }} title={r.description}>
                {r.description}
              </p>
            )}
            <p className="text-[11px] mt-1" style={{ color: "#64748B" }}>
              {r?.usersCount ?? 0} user{(r?.usersCount ?? 0) === 1 ? "" : "s"} in role ·{" "}
              {m.isRecommended ? "Sole owner" : `${m.otherOwners} other owner${m.otherOwners === 1 ? "" : "s"}`}
            </p>
          </div>
          {isAssigned && (
            <div className="shrink-0 self-center">
              <AssignedPill
                userId={assignedNewOwner!}
                onChange={() => {
                  const next = { ...selections };
                  delete next[m.roleId];
                  onChange(next);
                  setActiveRoleId(m.roleId);
                }}
              />
            </div>
          )}
        </div>
      </button>
    );
    return m.isRecommended ? (
      <Tooltip key={m.roleId}>
        <TooltipTrigger asChild>{roleCard}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px]">
          This role has no other owner. If left unassigned, no one will be able to manage it.
        </TooltipContent>
      </Tooltip>
    ) : (
      roleCard
    );
  };

  /* ─── Per-affected-user grouping for the bulk accordion ─── */
  const roleGroups = (sourceUsers ?? [])
    .map((u) => {
      const all = roleMeta.filter((m) => m.owningUserIds.includes(u.id));
      const userVisible = visibleRoles.filter((m) => m.owningUserIds.includes(u.id));
      const assignedN = all.filter((m) => selections[m.roleId] != null).length;
      return { user: u, all, visible: userVisible, assignedN, leftN: all.length - assignedN };
    })
    .filter((g) => g.visible.length > 0);

  /* Scope banner copy (mirrors the assignments step). */
  const scopeBanner = (() => {
    if (!bulkScope) return null;
    const { affectedCount, selectedCount, mode } = bulkScope;
    if (mode === "remove-license") {
      return `${selectedCount} user${selectedCount === 1 ? "" : "s"} will lose access. Reassign owned roles below, or leave them to handle later.`;
    }
    const other = selectedCount - affectedCount;
    const base = `${affectedCount} of ${selectedCount} selected user${selectedCount === 1 ? "" : "s"} ${affectedCount === 1 ? "has" : "have"} work that needs reassignment.`;
    return other > 0 ? `${base} The other ${other} will be downgraded with no changes.` : base;
  })();

  return (
    <div className="w-full flex flex-col h-full">
      <div className="shrink-0 pb-3">
        <StepInfoBanner>
          {/* Verb agrees with the subject, not the role count. */}
          {userName} {isBulk ? "own" : "owns"} {ownedRoleIds.length} role{ownedRoleIds.length === 1 ? "" : "s"}. Roles marked recommended have no other owner.
        </StepInfoBanner>
      </div>

      {/* Scope banner (bulk license flows) */}
      {scopeBanner && (
        <div
          className="shrink-0 mb-3 flex items-start gap-2.5 px-3.5 py-2.5 rounded-[10px] border"
          style={{ backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }}
        >
          <UsersIcon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#2563EB" }} />
          <p className="text-[12.5px]" style={{ color: "#1E40AF", fontWeight: 450, lineHeight: 1.5 }}>
            {scopeBanner}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-3 flex-1 min-h-0">
        {/* ─── LEFT: roles ─── */}
        <div className="rounded-[12px] border bg-white flex flex-col overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
          <div className="px-3 pt-3 pb-2 flex items-center gap-2 shrink-0">
            <div className="flex-1 flex items-center gap-2 px-3 h-9 rounded-[8px] border bg-white" style={{ borderColor: "#E2E8F0" }}>
              <SearchIcon className="w-4 h-4 text-[#94A3B8]" />
              <input
                value={roleQuery}
                onChange={(e) => setRoleQuery(e.target.value)}
                placeholder="Search roles…"
                className="flex-1 outline-none text-[13px] bg-transparent placeholder:text-[#94A3B8]"
              />
            </div>
          </div>

          <div className="px-3 pb-2 flex items-center gap-1.5 flex-wrap shrink-0">
            <FilterChipButton
              label="Show All"
              count={counts.all}
              active={filter === "all" && (!isBulk || userFilterSet.size === 0)}
              onClick={() => { setFilter("all"); setUserFilterSet(new Set()); }}
            />
            {isBulk && (
              <MultiSelectFilterChip
                label="Users"
                summaryMode="options"
                items={(sourceUsers ?? [])
                  .filter((u) => roleMeta.some((m) => m.owningUserIds.includes(u.id)))
                  .map((u) => ({ key: u.id, label: u.fullName }))}
                selected={userFilterSet as Set<string | number>}
                onChange={(next) => setUserFilterSet(new Set(Array.from(next).map((v) => Number(v))))}
                getCount={(key) => roleMeta.filter((m) => m.owningUserIds.includes(Number(key))).length}
              />
            )}
            <FilterChipButton
              label="Recommended"
              count={counts.recommended}
              active={filter === "recommended"}
              onClick={() => setFilter(filter === "recommended" ? "all" : "recommended")}
            />
            <FilterChipButton
              label="Optional"
              count={counts.optional}
              active={filter === "optional"}
              onClick={() => setFilter(filter === "optional" ? "all" : "optional")}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 border-t" style={{ borderColor: "#EEF2F6", minHeight: 0 }}>
            {visibleRoles.length === 0 ? (
              <div className="px-4 py-12 text-center text-[12.5px]" style={{ color: "#94A3B8" }}>
                No Roles Match the Current Filter.
              </div>
            ) : accordionMode ? (
              roleGroups.map((g) => {
                const expanded = expandedUsers.has(g.user.id);
                const allSet = g.leftN === 0;
                return (
                  <div key={g.user.id} className="rounded-[10px] border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
                    <button
                      type="button"
                      onClick={() => toggleUserExpanded(g.user.id)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-[#F8FAFC]"
                      style={{ backgroundColor: expanded ? "#F8FAFC" : "#FFFFFF" }}
                    >
                      <ChevronDownIcon
                        className="w-4 h-4 shrink-0 transition-transform"
                        style={{ color: "#94A3B8", transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
                      />
                      <UserAvatarSmall userId={g.user.id} name={g.user.fullName} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] truncate" style={{ color: "#0F172A", fontWeight: 600 }}>
                          {g.user.fullName}
                        </p>
                        <p className="text-[11px]" style={{ color: "#94A3B8" }}>
                          {g.all.length} owned role{g.all.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <StatusPill leftN={g.leftN} allSet={allSet} />
                    </button>
                    {expanded && (
                      <div className="p-2 space-y-1.5 border-t" style={{ borderColor: "#EEF2F6", backgroundColor: "#FAFBFC" }}>
                        {g.visible.map((m) => renderRoleCard(m))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              visibleRoles.map((m) => renderRoleCard(m))
            )}
          </div>
        </div>

        {/* ─── RIGHT: owner picker ─── */}
        <div
          className="rounded-[12px] bg-white flex flex-col overflow-hidden transition-[box-shadow,border-color]"
          style={{
            border: rightActive ? "2px solid #007FFF" : "1px solid #E2E8F0",
            boxShadow: rightActive ? "0 0 0 4px rgba(0,127,255,0.08)" : "none",
          }}
        >
          {/* Header: search only */}
          <div className="px-3 pt-3 pb-2 flex items-center gap-2 shrink-0">
            <div className="flex-1 flex items-center gap-2 px-3 h-9 rounded-[8px] border bg-white" style={{ borderColor: "#E2E8F0" }}>
              <SearchIcon className="w-4 h-4 text-[#94A3B8]" />
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Search candidate owners…"
                className="flex-1 outline-none text-[13px] bg-transparent placeholder:text-[#94A3B8]"
              />
            </div>
          </div>

          {/* User list, scrollable */}
          <div className="flex-1 overflow-y-auto px-2" style={{ minHeight: 0 }}>
            {!activeRole ? (
              <div className="px-4 py-12 text-center text-[12.5px]" style={{ color: "#94A3B8" }}>
                Select a role on the left to view eligible owners.
              </div>
            ) : (
              <>
                {fCo.length > 0 && (
                  <UserPickerSection
                    title="Co-owners"
                    users={fCo}
                    pickedId={pickedUserId}
                    onPick={setPickedUserId}
                    query={userQuery}
                    groupBadge={{ label: "Co-owner", bg: "#DCFCE7", color: "#15803D", border: "#BBF7D0" }}
                  />
                )}
                {fHolds.length > 0 && <UserPickerSection title="Holds the Role" users={fHolds} pickedId={pickedUserId} onPick={setPickedUserId} query={userQuery} />}
                {fMgr.length > 0 && <UserPickerSection title="Has Manage Permissions" users={fMgr} pickedId={pickedUserId} onPick={setPickedUserId} query={userQuery} />}
                {fCo.length === 0 && fHolds.length === 0 && fMgr.length === 0 && (
                  (eligibility.coOwners.length + eligibility.holdsRole.length + eligibility.hasManage.length) > 0 ? (
                    <div className="px-4 py-12 text-center text-[12.5px]" style={{ color: "#94A3B8" }}>
                      No Matching Candidates.
                    </div>
                  ) : (
                    <NoEligibleUsersEmpty roleId={activeRoleId ?? undefined} />
                  )
                )}
              </>
            )}
          </div>

          {/* Footer: assign button, slides in when a user is picked */}
          <div
            className="shrink-0 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{
              maxHeight: pickedUserId != null ? 52 : 0,
              opacity: pickedUserId != null ? 1 : 0,
            }}
          >
            <div className="px-3 pb-3 pt-2 border-t" style={{ borderColor: "#EEF2F6" }}>
              <button
                onClick={handleAssign}
                disabled={assignBtnDisabled}
                className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-[8px] text-white text-[13px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: "#16A34A", fontWeight: 600 }}
              >
                <Check className="w-3.5 h-3.5" />
                {assignBtnLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Filter chip helpers (matches DataTableFilterPills styling)
   ═══════════════════════════════════════════════════════════════════ */

/** Static "Show All / Required / Optional" style chip with count badge. */
function FilterChipButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
        active
          ? "border-[#0A77FF] bg-[#EDF4FF] hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
          : "border-border bg-white text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
      }`}
      style={{ fontWeight: active ? 500 : 400, color: active ? "#0A77FF" : undefined }}
    >
      {label}
      <span
        className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${
          active ? "bg-[#0A77FF]/10" : "bg-muted"
        }`}
        style={{ fontWeight: 600, color: active ? "#0A77FF" : "#475569" }}
      >
        {count}
      </span>
    </button>
  );
}

/** Multi-select dropdown chip used for the "Users" and "Modules" filters.
 *  Matches DataTableFilterPills look but renders a popover with checkboxes. */
function MultiSelectFilterChip({
  label,
  items,
  selected,
  onChange,
  getCount,
  summaryMode = "sum",
}: {
  label: string;
  items: { key: string | number; label: string }[];
  selected: Set<string | number>;
  onChange: (next: Set<string | number>) => void;
  getCount?: (key: string | number) => number;
  /** Badge when nothing is selected: "sum" of item counts (Modules) or the
   *  number of "options", e.g. how many users (Users filter). */
  summaryMode?: "sum" | "options";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const active = selected.size > 0;
  const totalCount = items.reduce((acc, i) => acc + (getCount?.(i.key) ?? 0), 0);
  const summary = active ? selected.size : summaryMode === "options" ? items.length : totalCount;

  /* Fuzzy-search the option list; matches are highlighted in the labels. */
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query]);

  const toggle = (key: string | number) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap cursor-pointer ${
          active
            ? "border-[#0A77FF] bg-[#EDF4FF] hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
            : "border-border bg-white text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
        }`}
        style={{ fontWeight: active ? 500 : 400, color: active ? "#0A77FF" : undefined }}
      >
        {label}
        <span
          className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${
            active ? "bg-[#0A77FF]/10" : "bg-muted"
          }`}
          style={{ fontWeight: 600, color: active ? "#0A77FF" : "#475569" }}
        >
          {summary}
        </span>
        <ChevronDownIcon className="w-3 h-3" style={{ color: active ? "#0A77FF" : "#94A3B8" }} />
      </button>
      {open && (
        <>
          {/* Click-away */}
          <div className="fixed inset-0 z-30" onClick={() => { setOpen(false); setQuery(""); }} />
          <div
            className="absolute z-40 mt-1.5 left-0 min-w-[240px] rounded-[10px] border bg-white pt-1.5 overflow-hidden"
            style={{ borderColor: "#E2E8F0", boxShadow: "0 12px 32px -8px rgba(15,23,42,0.15), 0 0 0 1px rgba(15,23,42,0.04)" }}
          >
            {/* Search field */}
            <div className="px-2 pb-1.5">
              <div className="flex items-center gap-1.5 px-2 h-8 rounded-[8px] border bg-white" style={{ borderColor: "#E2E8F0" }}>
                <SearchIcon className="w-3.5 h-3.5 text-[#94A3B8]" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  className="flex-1 min-w-0 outline-none text-[12px] bg-transparent placeholder:text-[#94A3B8]"
                />
              </div>
            </div>
            <div className="max-h-[260px] overflow-y-auto pb-1.5">
            {filteredItems.length === 0 ? (
              <div className="px-3 py-3 text-center text-[12px]" style={{ color: "#94A3B8" }}>
                No {label.toLowerCase()} match.
              </div>
            ) : (
              filteredItems.map((item) => {
              const checked = selected.has(item.key);
              const cnt = getCount?.(item.key) ?? 0;
              return (
                <button
                  key={String(item.key)}
                  type="button"
                  onClick={() => toggle(item.key)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] hover:bg-[#F1F5F9] cursor-pointer"
                  style={{ color: "#0F172A" }}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      backgroundColor: checked ? "#007FFF" : "#FFFFFF",
                      borderColor: checked ? "#007FFF" : "#CBD5E1",
                    }}
                  >
                    {checked && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  <span className="flex-1 text-left truncate">{highlightMatch(item.label, query)}</span>
                  {getCount && (
                    <span className="text-[10.5px] shrink-0" style={{ color: "#94A3B8", fontWeight: 500 }}>
                      {cnt}
                    </span>
                  )}
                </button>
              );
            })
            )}
            </div>
            {/* Footer: clear all, only when 2+ are selected */}
            {selected.size >= 2 && (
              <div
                className="border-t px-3 py-2"
                style={{ borderColor: "#EEF2F6", backgroundColor: "#F8FAFC" }}
              >
                <button
                  type="button"
                  onClick={() => onChange(new Set())}
                  className="text-[12px] cursor-pointer hover:underline"
                  style={{ color: "#0A77FF", fontWeight: 500 }}
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
