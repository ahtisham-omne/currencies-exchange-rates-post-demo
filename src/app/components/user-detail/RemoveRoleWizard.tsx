/* ═══════════════════════════════════════════════════════════════════
   Remove Role Wizard
   ───────────────────────────────────────────────────────────────────
   Two flows:
     • Non-owner  → single screen (Step 2 from the Deactivate wizard,
                    pixel-identical: AssignmentsStep).
     • Role owner → 2-step stepper (AssignmentsStep + OwnershipStep),
                    pixel-identical to Deactivate wizard steps 2 & 3.
   The wizard shell, header, stepper styling, and footer mirror
   DeactivateUserWizard exactly so the experience is consistent.
   ═══════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  X,
  Check,
  ArrowLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Crown,
} from "lucide-react";
import { ModalShell } from "../shared/ModalShell";
import { OwnerChip } from "../shared/OwnerChip";
import {
  AssignmentsStep,
  OwnershipStep,
} from "./DeactivateUserWizard";
import {
  getActiveAssignmentsForUser,
  type UserAssignment,
  type AssignmentType,
} from "../../data/user-assignments-data";
import { getRoleOwners } from "../../data/role-owners-data";

type AssignmentResolution =
  | { kind: "user"; userId: number }
  | { kind: "unassigned" };

/** A single role in a bulk removal. */
export interface BulkRemoveRole {
  id: number;
  roleName: string;
  /** Whether the user owns this role. */
  isOwner: boolean;
  /** Whether the user is the sole owner of this role. */
  isOnlyOwner: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  userId: number;
  userName: string;
  roleId: number;
  roleName: string;
  /** Whether the user is currently a role owner (drives the stepper). */
  isOwner?: boolean;
  /** Whether the user is the sole owner (for confirm message). */
  isOnlyOwner?: boolean;
  onConfirm?: (opts: {
    ownershipAlsoRemoved: boolean;
    leavesRoleWithoutOwner: boolean;
  }) => void;
  /** When provided, the wizard removes several roles at once (bulk mode).
   *  The assignments step reassigns the user's active work; the ownership
   *  step covers only the selected roles the user actually owns. */
  bulkRoles?: BulkRemoveRole[];
  /** Bulk confirm: parent applies the removals/ownership reassignments. */
  onConfirmBulk?: (opts: {
    removedRoleIds: number[];
    ownedRoleIds: number[];
    ownerReassignments: Record<number, number | undefined>;
  }) => void;
}

/* Pad assignments so the step has enough rows to demonstrate filtering. */
function padAssignments(items: UserAssignment[], userId: number): UserAssignment[] {
  if (items.length >= 12) return items;
  const padded = [...items];
  const types: AssignmentType[] = ["Cycle Count", "Movement", "Shipment", "Sales Order"];
  const prefixFor = (t: AssignmentType) =>
    t === "Cycle Count" ? "CC" : t === "Movement" ? "MV" : t === "Shipment" ? "SH" : "SO";
  const labelFor = (t: AssignmentType) =>
    t === "Cycle Count"
      ? "Cycle Count Task"
      : t === "Movement"
      ? "Movement Task"
      : t === "Shipment"
      ? "Shipment / Picking Task"
      : "Sales Order";
  let i = 0;
  while (padded.length < 12) {
    const t = types[i % types.length];
    const seq = 6000 + i + userId * 7;
    const id = `${prefixFor(t)}-${String(seq).padStart(4, "0")}`;
    padded.push({ id, type: t, label: `${labelFor(t)} #${id}`, ownerId: userId });
    i++;
  }
  return padded;
}

export function RemoveRoleWizard({
  open,
  onClose,
  userId,
  userName,
  roleId,
  roleName,
  isOwner = false,
  isOnlyOwner = false,
  onConfirm,
  bulkRoles,
  onConfirmBulk,
}: Props) {
  const [assignments, setAssignments] = useState<UserAssignment[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, AssignmentResolution>>({});
  const [ownerAssignments, setOwnerAssignments] = useState<Record<number, number | undefined>>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);

  /* Normalise single vs bulk into one list. */
  const isBulk = !!bulkRoles && bulkRoles.length > 0;
  const roleList: BulkRemoveRole[] = useMemo(
    () =>
      isBulk
        ? bulkRoles!
        : [{ id: roleId, roleName, isOwner, isOnlyOwner }],
    [isBulk, bulkRoles, roleId, roleName, isOwner, isOnlyOwner],
  );
  /* Owned roles among the set drive the ownership step. */
  const ownedRoleIds = useMemo(
    () => roleList.filter((r) => r.isOwner).map((r) => r.id),
    [roleList],
  );
  const hasOwnership = ownedRoleIds.length > 0;
  const roleCount = roleList.length;

  useEffect(() => {
    if (!open) return;
    const raw = getActiveAssignmentsForUser(userId);
    setAssignments(padAssignments(raw, userId));
    setResolutions({});
    setOwnerAssignments({});
    setStepIdx(0);
    setIsFullScreen(false);
  }, [open, userId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  /* Steps: only when the user is an owner do we get a stepper. */
  const steps = useMemo(() => {
    const s: { key: "assignments" | "ownership"; label: string }[] = [
      { key: "assignments", label: "Reassign Active Assignments" },
    ];
    if (hasOwnership) s.push({ key: "ownership", label: "Reassign Role Ownership" });
    return s;
  }, [hasOwnership]);

  const showStepper = steps.length > 1;
  const currentStep = steps[stepIdx] ?? steps[0];

  /* Reassignment is always optional, never block the action. */
  const ownershipReady = true;
  const continueDisabled = false;

  const handleConfirm = useCallback(() => {
    if (isBulk) {
      onConfirmBulk?.({
        removedRoleIds: roleList.map((r) => r.id),
        ownedRoleIds,
        ownerReassignments: ownerAssignments,
      });
      const orphaned = ownedRoleIds.filter(
        (rid) =>
          roleList.find((r) => r.id === rid)?.isOnlyOwner &&
          ownerAssignments[rid] == null,
      ).length;
      const base = `${roleCount} roles were removed from ${userName}.`;
      toast.success(
        orphaned > 0
          ? `${base} ${orphaned} ${orphaned === 1 ? "role is" : "roles are"} now without an owner.`
          : base,
      );
      onClose();
      return;
    }
    const ownershipAlsoRemoved = isOwner; // owner flow always reassigns/removes ownership
    const leavesRoleWithoutOwner =
      ownershipAlsoRemoved && isOnlyOwner && ownerAssignments[roleId] == null;
    onConfirm?.({ ownershipAlsoRemoved, leavesRoleWithoutOwner });
    if (ownershipAlsoRemoved) {
      const base = `${userName} has been removed from ${roleName} and is no longer an owner of this role.`;
      toast.success(
        leavesRoleWithoutOwner
          ? `${base} This role currently has no owner.`
          : base
      );
    } else {
      toast.success(`${roleName} was removed from ${userName}.`);
    }
    onClose();
  }, [isBulk, onConfirmBulk, roleList, ownedRoleIds, roleCount, isOwner, isOnlyOwner, ownerAssignments, roleId, onConfirm, userName, roleName, onClose]);

  const handleNext = () => {
    if (stepIdx < steps.length - 1) setStepIdx((s) => s + 1);
    else handleConfirm();
  };
  const handleBack = () => {
    if (stepIdx === 0) onClose();
    else setStepIdx((s) => s - 1);
  };
  const handleStepClick = (targetIdx: number) => {
    if (targetIdx === stepIdx) return;
    if (targetIdx < stepIdx) {
      setStepIdx(targetIdx);
      return;
    }
    for (let i = stepIdx; i < targetIdx; i++) {
      if (steps[i]?.key === "ownership" && !ownershipReady) return;
    }
    setStepIdx(targetIdx);
  };

  const title = (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span>
        {isBulk
          ? `Remove ${roleCount} role${roleCount === 1 ? "" : "s"} from ${userName}`
          : `Remove ${roleName} from ${userName}`}
      </span>
      {hasOwnership && <OwnerChip size="xs" />}
    </span>
  );
  const subtitle = hasOwnership
    ? `Reassign active assignments and role ownership before removing ${isBulk ? "these roles" : "this role"}.`
    : `Reassign active assignments before removing ${isBulk ? "these roles" : "this role"}.`;

  return (
    <ModalShell open={open} onClose={onClose} z={40}>
      <div
        className="bg-white flex flex-col overflow-hidden transition-[max-width,max-height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          width: "100vw",
          height: "100vh",
          // Both flows use the wide layout to mirror Step 2 / Step 3 widths.
          maxWidth: isFullScreen ? "calc(100vw - 2rem)" : "1280px",
          maxHeight: isFullScreen
            ? "calc(100vh - 2rem)"
            : "min(860px, calc(100vh - 48px))",
          borderRadius: 16,
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* Header */}
        <div
          className="px-4 lg:px-5 pt-4 pb-0 shrink-0 bg-white border-b border-[#EEF2F6]"
          style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                className="text-[15px] sm:text-[17px] text-[#0F172A]"
                style={{ fontWeight: 700 }}
              >
                {title}
              </h2>
              <p
                className="text-[11px] sm:text-xs text-[#64748B] mt-0.5"
                style={{ fontWeight: 400 }}
              >
                {subtitle}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsFullScreen((v) => !v)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {isFullScreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
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

          {/* Stepper: only when there are 2 steps */}
          {showStepper && (
            <div className="flex items-center gap-4 sm:gap-6 mt-3 sm:mt-3.5 overflow-x-auto -mb-px">
              {steps.map((step, i) => {
                const status =
                  i < stepIdx ? "complete" : i === stepIdx ? "active" : "upcoming";
                const canNavigate =
                  i !== stepIdx &&
                  (i < stepIdx ||
                    steps
                      .slice(stepIdx, i)
                      .every((s) => s.key !== "ownership" || ownershipReady));
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
                      style={{
                        fontWeight:
                          status === "active" || status === "complete" ? 600 : 500,
                      }}
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

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-[#FAFBFC]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep.key}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="px-4 lg:px-6 py-4 lg:py-5 min-h-full"
            >
              {currentStep.key === "assignments" && (
                <AssignmentsStep
                  userName={userName}
                  assignments={assignments}
                  resolutions={resolutions}
                  onResolutionsChange={setResolutions}
                />
              )}
              {currentStep.key === "ownership" && (
                <OwnershipStep
                  userName={userName}
                  userId={userId}
                  ownedRoleIds={ownedRoleIds}
                  selections={ownerAssignments}
                  onChange={setOwnerAssignments}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
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
              disabled={continueDisabled}
              className="inline-flex items-center gap-1.5 px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white shadow-sm transition-colors cursor-pointer text-xs sm:text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontWeight: 600 }}
            >
              {isBulk ? `Remove ${roleCount} Role${roleCount === 1 ? "" : "s"}` : "Remove Role"}
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
