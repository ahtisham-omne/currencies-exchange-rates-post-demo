import { useState, useCallback, useEffect, useMemo } from "react";
import {
  X,
  ChevronRight,
  Check,
  ArrowLeft,
  ArchiveRestore,
  Maximize2,
  Minimize2,
  Shield,
  FileText,
  Lock,
  Info,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { ModalShell } from "../shared/ModalShell";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { DetailCard } from "../user-detail/DetailCard";
import { FieldPair } from "../shared/FieldPair";
import { ExpandableDescription } from "../shared/ExpandableDescription";
import { LicenseBadge } from "../table-cells";
import { getRoleDetail, clearRoleAssignments, applyRoleEdits } from "../../data/role-detail-data";
import {
  updateRoleRowState,
  roleNameCollisionMessage,
  applyRolePermissions,
} from "../../data/roles-row-store";
import { clearRoleOwners } from "../../data/role-owners-data";
import { buildTogglesFromRoles, getRolePermissions } from "../../data/role-permissions-map";
import { roleNameToOptionId } from "../../data/roles-data";
import { Step2RolePermissions } from "../create-role/Step2RolePermissions";

const STEP_DEFS = [
  { number: 1, label: "Basic Details", shortLabel: "Basics" },
  { number: 2, label: "Permissions", shortLabel: "Permissions" },
  { number: 3, label: "Review & Confirm", shortLabel: "Confirm" },
];

const stepTransition = { duration: 0.2, ease: "easeOut" as const };

const inputCls =
  "w-full h-10 px-3.5 border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all placeholder:text-[#94A3B8]";

interface UnarchiveRoleModalProps {
  open: boolean;
  onClose: () => void;
  roleId: number;
  /** Notify caller of new status so they can sync local state */
  onStatusChange?: (status: string) => void;
}

interface RoleEditState {
  roleName: string;
  description: string;
}

export function UnarchiveRoleModal({
  open,
  onClose,
  roleId,
  onStatusChange,
}: UnarchiveRoleModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const role = useMemo(() => getRoleDetail(roleId), [roleId, open]);

  const [form, setForm] = useState<RoleEditState>(() => ({
    roleName: role?.roleName ?? "",
    description: role?.description ?? "",
  }));

  const [permissionToggles, setPermissionToggles] = useState<Record<string, boolean>>({});

  // Reset on open
  useEffect(() => {
    if (open && role) {
      setCurrentStep(1);
      setIsFullScreen(false);
      setErrors({});
      setForm({
        roleName: role.roleName,
        description: role.description,
      });
      /* Seed permissions from the role's OWN saved bundle, keyed the same way
       * every other role-scoped surface keys it (roleNameToOptionId), so the
       * toggles the admin sees here are exactly the ones the role held when it
       * was archived. Nothing is defaulted on: archiving retains the permission
       * set, so a default baseline would overwrite real configuration. */
      setPermissionToggles(buildTogglesFromRoles([roleNameToOptionId(role.roleName)]));
    }
  }, [open, role]);

  // Escape handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = useCallback(() => {
    // Closing mid-flow == cancel; role stays Archived
    onClose();
  }, [onClose]);

  /* ─── Name uniqueness ───
   *
   * Role names are unique regardless of status, so an unarchived role cannot
   * take a name something created while it sat in the archive is already using.
   * The role's own row is excluded, since it is itself in the listing as
   * Archived and keeping its current name has to stay valid.
   *
   * Checked live rather than on submit: the admin is looking at a name that was
   * fine when the role was archived, so the collision has to announce itself
   * before they try to move on. Same rule and same wording as Create Role. */
  const nameCollision = useMemo(
    () => roleNameCollisionMessage(form.roleName, roleId),
    [form.roleName, roleId],
  );

  const isStep1Valid = form.roleName.trim().length > 0 && !nameCollision;

  const handleNext = useCallback(() => {
    if (currentStep === 1) {
      if (!form.roleName.trim()) {
        setErrors({ roleName: "Role name is required" });
        return;
      }
      if (nameCollision) {
        setErrors({ roleName: nameCollision });
        return;
      }
      setErrors({});
      setCurrentStep(2);
      return;
    }
    if (currentStep === 2) {
      setCurrentStep(3);
    }
  }, [currentStep, form.roleName, nameCollision]);

  const handleBack = useCallback(() => {
    if (currentStep === 1) handleClose();
    else setCurrentStep((s) => s - 1);
  }, [currentStep, handleClose]);

  const handleStepClick = useCallback(
    (target: number) => {
      if (target === currentStep) return;
      if (target < currentStep) {
        setCurrentStep(target);
        return;
      }
      // Only forward if step 1 valid
      if (target > currentStep && isStep1Valid) {
        setCurrentStep(target);
      }
    },
    [currentStep, isStep1Valid]
  );

  const totalGranted = useMemo(
    () => Object.values(permissionToggles).filter(Boolean).length,
    [permissionToggles]
  );
  const totalPermissions = useMemo(
    () => Object.keys(permissionToggles).length,
    [permissionToggles]
  );

  const handleCommit = useCallback(() => {
    if (!role) return;
    /* Step 1 already blocks a colliding name and the step tabs will not jump
     * forward past it, so this cannot normally fire. Kept as the last gate
     * before the write: a duplicate name must never reach the listing, so send
     * the admin back to the field rather than commit one. */
    if (!form.roleName.trim() || nameCollision) {
      setErrors({ roleName: nameCollision ?? "Role name is required" });
      setCurrentStep(1);
      return;
    }
    /* Permission writes only happen when the admin actually changed something
     * on step 2. An untouched unarchive must leave ROLE_PERMISSION_MAP exactly
     * as the archive left it, so the role comes back with the same bundle (and
     * the same derived licence tier) it went in with. */
    const seededIds = getRolePermissions(roleNameToOptionId(role.roleName));
    const nextIds = Object.entries(permissionToggles)
      .filter(([, on]) => on)
      .map(([id]) => id);
    const permissionsEdited =
      nextIds.length !== seededIds.length ||
      new Set(nextIds).size !== new Set([...nextIds, ...seededIds]).size;

    // Apply any edits to name/description (this carries the permission bundle
    // across a rename), then clear users + owners
    applyRoleEdits(roleId, {
      roleName: form.roleName,
      description: form.description,
    });
    if (permissionsEdited) applyRolePermissions(roleId, nextIds);
    clearRoleAssignments(roleId);
    clearRoleOwners(roleId);
    updateRoleRowState(roleId, { status: "Active" });
    onStatusChange?.("Active");
    toast.success(
      `${form.roleName.trim() || role.roleName} has been unarchived`,
      {
        description:
          "Role is now Active under Custom Roles with zero users and owners. Reassign both via the standard flows.",
      }
    );
    onClose();
  }, [role, roleId, form.roleName, form.description, permissionToggles, nameCollision, onStatusChange, onClose]);

  const stepStatus = (num: number) =>
    currentStep > num ? "complete" : currentStep === num ? "active" : "upcoming";

  if (!role) return null;


  return (
    <ModalShell open={open} onClose={handleClose} z={40}>
      <div
        className="bg-white flex flex-col overflow-hidden transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          width: "100vw",
          height: "100vh",
          maxWidth: isFullScreen ? "calc(100vw - 2rem)" : "960px",
          maxHeight: isFullScreen
            ? "calc(100vh - 2rem)"
            : "min(760px, calc(100vh - 48px))",
          borderRadius: "16px",
          boxShadow:
            "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
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
                Unarchive Role
              </h2>
              <p
                className="text-[11px] sm:text-xs text-[#64748B] mt-0.5"
                style={{ fontWeight: 400 }}
              >
                Review role details and confirm to restore {role.roleName} to
                Active. Assigned users and role owners will need to be
                reassigned.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
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
                onClick={handleClose}
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Step tabs */}
          <div className="flex items-center gap-4 sm:gap-6 mt-3 sm:mt-3.5 overflow-x-auto -mb-px">
            {STEP_DEFS.map((step) => {
              const status = stepStatus(step.number);
              const canClick =
                step.number !== currentStep &&
                (step.number < currentStep || isStep1Valid);
              const isBlocked =
                step.number > currentStep && !isStep1Valid;

              const stepEl = (
                <div
                  key={step.number}
                  className="relative flex items-center gap-2 pb-2.5 sm:pb-3"
                  style={{ cursor: canClick ? "pointer" : "default" }}
                  onClick={() => handleStepClick(step.number)}
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
                    {status === "complete" ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      step.number
                    )}
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
                        status === "active" || status === "complete"
                          ? 600
                          : 500,
                    }}
                  >
                    <span className="hidden sm:inline">{step.label}</span>
                    <span className="sm:hidden">{step.shortLabel}</span>
                  </span>
                  {(status === "active" || status === "complete") && (
                    <div
                      className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full ${
                        status === "complete" ? "bg-[#10B981]" : "bg-[#007FFF]"
                      }`}
                    />
                  )}
                </div>
              );

              if (isBlocked) {
                return (
                  <Tooltip key={step.number}>
                    <TooltipTrigger asChild>{stepEl}</TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      sideOffset={4}
                      className="text-[11px]"
                    >
                      Complete Step {currentStep} to proceed
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return stepEl;
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-[#FAFBFC]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={stepTransition}
              className="px-4 lg:px-5 py-4 lg:py-5 min-h-full flex flex-col"
            >
              {currentStep === 1 && (
                <Step1BasicDetails
                  form={form}
                  errors={errors}
                  nameCollision={nameCollision}
                  onChange={(patch) => {
                    setForm((prev) => ({ ...prev, ...patch }));
                    if (patch.roleName !== undefined && errors.roleName) {
                      setErrors((e) => {
                        const n = { ...e };
                        delete n.roleName;
                        return n;
                      });
                    }
                  }}
                />
              )}
              {currentStep === 2 && (
                <Step2RolePermissions
                  permissionToggles={permissionToggles}
                  onPermissionTogglesChange={setPermissionToggles}
                  /* No baseline is applied here: the toggles are the role's own
                     retained set, so the create-flow "on by default" notice
                     would describe something that did not happen. */
                  showDefaultsBanner={false}
                />
              )}
              {currentStep === 3 && (
                <Step2ReviewConfirm
                  role={role}
                  form={form}
                  totalGranted={totalGranted}
                  totalPermissions={totalPermissions}
                  onEditStep={() => setCurrentStep(1)}
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
          {currentStep > 1 && (
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
          {currentStep === 3 ? (
            <>
              <button
                onClick={handleClose}
                className="inline-flex items-center justify-center px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] border border-[#E2E8F0] bg-white text-xs sm:text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={handleCommit}
                className="inline-flex items-center gap-1.5 px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] bg-[#007FFF] hover:bg-[#0066D6] active:bg-[#005BBF] text-white shadow-sm transition-colors cursor-pointer text-xs sm:text-[13px]"
                style={{ fontWeight: 600 }}
              >
                <ArchiveRestore className="w-3.5 h-3.5" />
                Unarchive
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleClose}
                className="inline-flex items-center justify-center px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] border border-[#E2E8F0] bg-white text-xs sm:text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={handleNext}
                disabled={!isStep1Valid}
                className="inline-flex items-center gap-1.5 px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] bg-[#007FFF] hover:bg-[#0066D6] active:bg-[#005BBF] text-white shadow-sm transition-colors cursor-pointer text-xs sm:text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontWeight: 600 }}
              >
                Continue
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

/* ─── Step 1: Basic Details ─── */
function Step1BasicDetails({
  form,
  errors,
  nameCollision,
  onChange,
}: {
  form: RoleEditState;
  errors: Record<string, string>;
  /** Live collision message for the name field, null when the name is free. */
  nameCollision: string | null;
  onChange: (patch: Partial<RoleEditState>) => void;
}) {
  return (
    <div className="space-y-4">
      <div
        className="flex items-start gap-2.5 rounded-[10px] border px-3.5 py-3"
        style={{ backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }}
      >
        <Info
          className="w-4 h-4 shrink-0 mt-0.5"
          style={{ color: "#2563EB" }}
        />
        <p
          className="text-[12.5px]"
          style={{ color: "#1E40AF", fontWeight: 480, lineHeight: 1.5 }}
        >
          Review the role's name and description. Edit if needed before
          restoring. On commit, the role returns as{" "}
          <span style={{ fontWeight: 600 }}>Active</span> with{" "}
          <span style={{ fontWeight: 600 }}>
            zero assigned users and zero role owners
          </span>:{" "}
          reassign both via the standard flows.
        </p>
      </div>

      <DetailCard title="Role Details" icon={Shield}>
        <div className="py-4 space-y-4">
          <div>
            <label
              className="text-xs sm:text-[13px] text-[#0F172A] mb-1 block"
              style={{ fontWeight: 500 }}
            >
              Role Name <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="text"
              value={form.roleName}
              onChange={(e) => onChange({ roleName: e.target.value })}
              placeholder="Enter role name"
              className={`${inputCls} ${
                nameCollision
                  ? "border-[#F59E0B] focus:border-[#F59E0B] focus:ring-[#F59E0B]/20"
                  : errors.roleName
                    ? "border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20"
                    : ""
              }`}
            />
            {nameCollision ? (
              <div className="mt-1.5 flex items-start gap-2 px-3 py-2 rounded-[8px] bg-[#FEF3C7] border border-[#F59E0B]/30">
                <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] shrink-0 mt-0.5" />
                <span
                  className="text-xs text-[#92400E] leading-snug"
                  style={{ fontWeight: 500 }}
                >
                  {nameCollision}
                </span>
              </div>
            ) : (
              errors.roleName && (
                <p
                  className="text-[11.5px] mt-1"
                  style={{ color: "#DC2626", fontWeight: 500 }}
                >
                  {errors.roleName}
                </p>
              )
            )}
          </div>

          <div>
            <label
              className="text-xs sm:text-[13px] text-[#0F172A] mb-1 block"
              style={{ fontWeight: 500 }}
            >
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Describe what this role is responsible for..."
              rows={3}
              className="w-full px-3.5 py-2.5 border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all placeholder:text-[#94A3B8] resize-none"
            />
          </div>
        </div>
      </DetailCard>
    </div>
  );
}

/* ─── Step 2: Review & Confirm ─── */
function Step2ReviewConfirm({
  role,
  form,
  totalGranted,
  totalPermissions,
  onEditStep,
}: {
  role: NonNullable<ReturnType<typeof getRoleDetail>>;
  form: RoleEditState;
  totalGranted: number;
  totalPermissions: number;
  onEditStep: () => void;
}) {
  const editBtn = (
    <button
      onClick={onEditStep}
      className="flex items-center gap-1 text-[12.5px] hover:underline transition-colors cursor-pointer"
      style={{ fontWeight: 520, color: "#007FFF" }}
    >
      <Pencil className="w-3 h-3" />
      Edit
    </button>
  );

  return (
    <div className="space-y-4">
      <div
        className="flex items-start gap-2.5 rounded-[10px] border px-3.5 py-3"
        style={{ backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }}
      >
        <Info
          className="w-4 h-4 shrink-0 mt-0.5"
          style={{ color: "#2563EB" }}
        />
        <div
          className="text-[12.5px]"
          style={{ color: "#1E40AF", fontWeight: 480, lineHeight: 1.55 }}
        >
          <p>
            On commit, this role returns to the Roles listing under{" "}
            <span style={{ fontWeight: 600 }}>Custom Roles</span> as{" "}
            <span style={{ fontWeight: 600 }}>Active</span>.
          </p>
          <ul className="mt-1.5 space-y-0.5 list-disc list-inside marker:text-[#2563EB]">
            {/* Thresholds are retained too, but the UI for them is hidden
                (SHOW_PERMISSION_THRESHOLDS), so naming them here would point
                at something the admin cannot see. */}
            <li>Permission set is retained.</li>
            <li>
              Assigned users and role owners are{" "}
              <span style={{ fontWeight: 600 }}>cleared</span>: reassign via
              the standard flows.
            </li>
            <li>Pre-archive history remains in the activity log.</li>
          </ul>
        </div>
      </div>

      <DetailCard title="Role Details" icon={Shield} action={editBtn}>
        <div className="py-3 space-y-4">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <FieldPair label="Role Name" value={form.roleName} />
            <FieldPair
              label="Required License"
              value={role.licenseRequired}
            />
            <FieldPair
              label="Role Type"
              value={role.isSystem ? "Predefined Role" : "Custom Role"}
            />
            <div className="flex items-start gap-2 pt-4">
              <LicenseBadge license={role.licenseRequired} />
            </div>
          </div>
          {form.description && (
            <div>
              <p
                className="mb-1"
                style={{
                  fontSize: "12px",
                  fontWeight: 450,
                  color: "#94A3B8",
                  lineHeight: "1.3",
                }}
              >
                Description
              </p>
              <ExpandableDescription
                text={form.description}
                lines={2}
                className="text-[13px]"
                style={{
                  fontWeight: 500,
                  color: "#1E293B",
                  lineHeight: "1.55",
                }}
              />
            </div>
          )}
        </div>
      </DetailCard>

      <DetailCard title="Permissions" icon={Lock} action={editBtn}>
        <div className="py-3">
          <div className="flex items-center gap-2">
            <span
              className="text-[12px] px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: "#ECFDF5",
                color: "#059669",
                fontWeight: 600,
              }}
            >
              {totalGranted} / {totalPermissions} permissions active
            </span>
            <span
              className="text-[12px] px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: "#F1F5F9",
                color: "#475569",
                fontWeight: 600,
              }}
            >
              {role.permissionGroups.length} module
              {role.permissionGroups.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p
            className="text-[12.5px] mt-2"
            style={{ color: "#64748B", fontWeight: 420 }}
          >
            Full permission set is retained from archive. Manage details from
            the role's Permissions tab after unarchive.
          </p>
        </div>
      </DetailCard>

      <DetailCard title="What's Cleared on Unarchive" icon={FileText}>
        <div className="py-3 grid grid-cols-2 gap-x-8 gap-y-3">
          <FieldPair label="Assigned Users" value="0 (reassign required)" />
          <FieldPair label="Role Owners" value="0 (reassign required)" />
        </div>
      </DetailCard>
    </div>
  );
}
