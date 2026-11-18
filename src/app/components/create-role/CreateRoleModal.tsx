import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import {
  X,
  ChevronRight,
  Check,
  Save,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../ui/tooltip";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Step1RoleBasicInfo, checkRoleNameUnique } from "./Step1RoleBasicInfo";
import { Step2RolePermissions } from "./Step2RolePermissions";
import { Step3AssignUsers } from "./Step3AssignUsers";
import { Step4ReviewConfirm } from "./Step4ReviewConfirm";
import type { CreateRoleFormData } from "./types";
import { EMPTY_ROLE_FORM } from "./types";
import { PERMISSION_MODULES, buildEmptyToggles, buildDefaultToggles } from "../../data/permissions-data";
import type { RoleTemplate } from "./role-templates";
import { registerNewRole } from "../../data/roles-data";
import { applyRolePermissions } from "../../data/roles-row-store";
import { users as ALL_USERS } from "../../data/users-data";
import { ModalShell } from "../shared/ModalShell";
import { DiscardDialog } from "../user-detail/DiscardDialog";
import {
  InactiveOrUnlicensedWarningModal,
  findAtRiskUsers,
} from "../shared/InactiveOrUnlicensedWarningModal";
import { UpgradeLicenseModal } from "../shared/LicenseModals";
import { computeRoleTier, findUnderLicensedUsers } from "../../lib/permission-tier";

const STEP_DEFS = [
  { number: 1, label: "Basic Details", shortLabel: "Basics" },
  { number: 2, label: "Permissions", shortLabel: "Permissions" },
  { number: 3, label: "Assign Users", shortLabel: "Users" },
  { number: 4, label: "Review & Confirm", shortLabel: "Review" },
];

interface CreateRoleModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill form data when duplicating an existing role */
  initialData?: Partial<CreateRoleFormData>;
  /** Pre-fill permission toggles when duplicating */
  initialPermissions?: string[];
  /** Source role name for duplication context */
  sourceRoleName?: string;
}

const stepTransition = { duration: 0.2, ease: "easeOut" as const };

export function CreateRoleModal({ open, onClose, initialData, initialPermissions, sourceRoleName }: CreateRoleModalProps) {
  const navigate = useNavigate();
  const isDuplicate = !!initialData;
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<CreateRoleFormData>({
    ...EMPTY_ROLE_FORM,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [highestVisited, setHighestVisited] = useState(1);

  /* ─── Permission toggles state ─── A fresh role starts from the catalog
     baseline: every permission flagged `defaultEnabled` in permissions-data is
     toggled on, because a role without them cannot do anything at all (module
     access and the core day-to-day actions inside those modules). The admin can
     switch any of them off. Picking a Step 1 template swaps in that template's
     explicit bundle instead, and duplicating a role seeds from the source
     role's set. ─── */
  const [permissionToggles, setPermissionToggles] = useState<Record<string, boolean>>(() => buildDefaultToggles());

  /* The map the wizard was last seeded with. The dirty check compares against
     this, so the baseline defaults on their own never trip the discard prompt. */
  const seededToggles = useRef<Record<string, boolean>>(permissionToggles);

  /* True once the admin has toggled a permission in Step 2 themselves. Picking
     a template while this is true warns before it overwrites their work. */
  const [permissionsHandEdited, setPermissionsHandEdited] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setFormData({ ...EMPTY_ROLE_FORM, assignedUsers: [], ...initialData });
      setErrors({});
      setIsFullScreen(false);
      setShowDiscardModal(false);
      setHighestVisited(1);
      // A fresh role seeds from the catalog baseline (the essential permissions
      // flagged defaultEnabled). Picking a Step 1 template replaces that with
      // the template's bundle via onTemplateChange, and duplicating an existing
      // role seeds from that role's exact set instead.
      const seed = initialPermissions
        ? buildEmptyToggles(initialPermissions)
        : buildDefaultToggles();
      seededToggles.current = seed;
      setPermissionToggles(seed);
      setPermissionsHandEdited(false);
    }
  }, [open]);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") attemptClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  /* ─── Dirty check ─── Permissions count as edited only when they differ from
     the seed the wizard opened with, otherwise the baseline defaults would make
     an untouched modal look dirty and always prompt to discard on close. */
  const arePermissionsEdited = useMemo(() => {
    const seed = seededToggles.current;
    return Object.keys(permissionToggles).some(
      (id) => permissionToggles[id] !== (seed[id] === true)
    );
  }, [permissionToggles]);

  const isFormDirty = useMemo(() => {
    return (
      formData.roleName.trim() !== "" ||
      formData.description.trim() !== "" ||
      formData.licenseType !== "" ||
      formData.assignedUsers.length > 0 ||
      arePermissionsEdited
    );
  }, [formData, arePermissionsEdited]);

  /* ─── Unsaved changes guard (browser back / tab close) ─── */
  useUnsavedChangesGuard(open && isFormDirty, () => setShowDiscardModal(true));

  const attemptClose = useCallback(() => {
    if (isFormDirty) {
      setShowDiscardModal(true);
    } else {
      onClose();
    }
  }, [isFormDirty, onClose]);

  const updateField = useCallback(
    <K extends keyof CreateRoleFormData>(
      key: K,
      value: CreateRoleFormData[K]
    ) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    []
  );

  /* Selecting a Step 1 template checks its permission set in Step 2
   * (everything else off). Clearing the template falls back to the catalog
   * baseline, the same set a no-template role starts with.
   *
   * Applying or clearing a template also resets the hand-edited flag: whatever
   * the admin had toggled has just been replaced, so the next template pick
   * starts from a clean sheet and does not warn about edits that no longer
   * exist. */
  const handleTemplateChange = useCallback((template: RoleTemplate | null) => {
    setPermissionToggles(
      template ? buildEmptyToggles(template.permissionIds) : buildDefaultToggles()
    );
    setPermissionsHandEdited(false);
  }, []);

  /* Toggling a permission in Step 2 by hand. Tracked separately from
   * `arePermissionsEdited` (which compares against the seed and drives the
   * discard prompt) because the template-overwrite warning must fire on the
   * ACT of editing, even if the admin happened to toggle a permission back to
   * where it started. */
  const handlePermissionTogglesChange = useCallback(
    (next: Record<string, boolean>) => {
      setPermissionToggles(next);
      setPermissionsHandEdited(true);
    },
    []
  );

  const validateStep1 = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    /* Mirrors the Create User primary-email chain: required first, then
     * uniqueness. A name that collides blocks Next, so the amber inline alert
     * in Step 1 can never be walked past. */
    if (!formData.roleName.trim()) newErrors.roleName = "Role name is required";
    else if (checkRoleNameUnique(formData.roleName))
      newErrors.roleName = "This role name is already in use";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleNext = useCallback(() => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep < 4) {
      const next = currentStep + 1;
      setCurrentStep(next);
      setHighestVisited((prev) => Math.max(prev, next));
    }
  }, [currentStep, validateStep1]);

  const handleBack = useCallback(() => {
    if (currentStep === 1) {
      attemptClose();
    } else {
      setCurrentStep((s) => s - 1);
      setErrors({});
    }
  }, [currentStep, attemptClose]);

  const [warningOpen, setWarningOpen] = useState(false);
  const [licenseUpgradeOpen, setLicenseUpgradeOpen] = useState(false);
  /** When true, advancing past the warning(s) moves Step 3 → Step 4 (Continue).
   *  When false, advancing finalizes role creation (Create Role on Step 4). */
  const [warningTarget, setWarningTarget] = useState<"continue" | "finalize">("continue");

  /* Determine the role's required license tier. Prefer the toggled
   * permissions; fall back to the licenseType selection from Step 1
   * (if the admin explicitly picked one). */
  const requiredLicense = useMemo(() => {
    const fromPerms = computeRoleTier(permissionToggles);
    if (fromPerms === "Full Access") return "Full Access" as const;
    if (formData.licenseType === "Full Access") return "Full Access" as const;
    return "Field User" as const;
  }, [permissionToggles, formData.licenseType]);

  /* All assigned users as full UserRow records */
  const assignedUserRows = useMemo(() => {
    const assignedSet = new Set(formData.assignedUsers);
    return ALL_USERS.filter((u) => assignedSet.has(u.id));
  }, [formData.assignedUsers]);

  /* At-risk users (Inactive or No License), drives Modal A */
  const atRiskAssignedUsers = useMemo(
    () => findAtRiskUsers(assignedUserRows),
    [assignedUserRows]
  );

  /* Under-licensed users for a Full-Access role, drives Modal B.
   * Excludes users already covered by Modal A (per spec: prefer A, append note). */
  const atRiskIds = useMemo(
    () => new Set(atRiskAssignedUsers.map((u) => u.id)),
    [atRiskAssignedUsers]
  );
  const underLicensedUsers = useMemo(
    () =>
      findUnderLicensedUsers(assignedUserRows, requiredLicense).filter(
        (u) => !atRiskIds.has(u.id)
      ),
    [assignedUserRows, requiredLicense, atRiskIds]
  );

  /* Subset of at-risk users that also need a license upgrade, surfaces
   * the inline note inside Modal A so admin doesn't see Modal B for them. */
  const atRiskAlsoNeedingLicenseIds = useMemo(
    () =>
      findUnderLicensedUsers(atRiskAssignedUsers, requiredLicense).map(
        (u) => u.id
      ),
    [atRiskAssignedUsers, requiredLicense]
  );

  const finalizeCreateRole = useCallback(() => {
    const newId = registerNewRole({
      roleName: formData.roleName,
      description: formData.description,
      licenseRequired: requiredLicense,
      usersCount: formData.assignedUsers.length,
    });
    /* A new role is registered as Draft. If permissions were assigned in the
     * wizard, apply them, which stores the set and graduates it to Active.
     * With none assigned it stays Draft, so the roles listing shows the same
     * amber nudge as an imported draft. */
    const activePermissionIds = Object.keys(permissionToggles).filter((id) => permissionToggles[id]);
    if (activePermissionIds.length > 0) {
      applyRolePermissions(newId, activePermissionIds);
    }
    setWarningOpen(false);
    setLicenseUpgradeOpen(false);
    onClose();
    navigate(`/company-settings/user-access-control/role/${newId}`);
    toast.success(`${formData.roleName} created successfully`);
  }, [onClose, formData, navigate, requiredLicense, permissionToggles]);

  /** Run the warning chain. Returns true if a warning was opened
   *  (caller should bail; the warning's onContinue resumes the flow). */
  const runWarningsThen = useCallback(
    (target: "continue" | "finalize"): boolean => {
      setWarningTarget(target);
      if (atRiskAssignedUsers.length > 0) {
        setWarningOpen(true);
        return true;
      }
      if (underLicensedUsers.length > 0) {
        setLicenseUpgradeOpen(true);
        return true;
      }
      return false;
    },
    [atRiskAssignedUsers.length, underLicensedUsers.length]
  );

  /** Called after Modal A's Continue. Chain into Modal B if needed,
   *  otherwise resolve the original target action. */
  const advancePastWarningA = useCallback(() => {
    setWarningOpen(false);
    if (underLicensedUsers.length > 0) {
      setLicenseUpgradeOpen(true);
      return;
    }
    if (warningTarget === "continue") {
      setCurrentStep((s) => Math.max(s, 4));
      setHighestVisited((prev) => Math.max(prev, 4));
    } else {
      finalizeCreateRole();
    }
  }, [underLicensedUsers.length, warningTarget, finalizeCreateRole]);

  /** Called after Modal B's "Confirm Upgrade", proceeds with the original
   *  target action. (Mock: real license upgrades happen on save in production.) */
  const advancePastWarningB = useCallback(() => {
    setLicenseUpgradeOpen(false);
    if (warningTarget === "continue") {
      setCurrentStep((s) => Math.max(s, 4));
      setHighestVisited((prev) => Math.max(prev, 4));
      toast.success(
        `${underLicensedUsers.length} user license${underLicensedUsers.length !== 1 ? "s" : ""} will be upgraded on role creation.`
      );
    } else {
      finalizeCreateRole();
    }
  }, [warningTarget, underLicensedUsers.length, finalizeCreateRole]);

  /** Skip license upgrade: assign role without upgrading licenses. */
  const skipUpgradeAndContinue = useCallback(() => {
    setLicenseUpgradeOpen(false);
    if (warningTarget === "continue") {
      setCurrentStep((s) => Math.max(s, 4));
      setHighestVisited((prev) => Math.max(prev, 4));
    } else {
      finalizeCreateRole();
    }
  }, [warningTarget, finalizeCreateRole]);

  /** Step 3 → Step 4 transition. Intercept with warnings if needed. */
  const handleContinueFromAssignUsers = useCallback(() => {
    if (runWarningsThen("continue")) return;
    setCurrentStep(4);
    setHighestVisited((prev) => Math.max(prev, 4));
  }, [runWarningsThen]);

  const handleCreateRole = useCallback(() => {
    finalizeCreateRole();
  }, [finalizeCreateRole]);

  const handleEditStep = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  /** Check if a step's required fields are satisfied (without setting errors) */
  const isStepValid = useCallback((stepNum: number): boolean => {
    /* The stepper's own reachability check has to agree with validateStep1, or
     * a duplicate name would let the user jump ahead by clicking a later step. */
    if (stepNum === 1) return !!formData.roleName.trim() && !checkRoleNameUnique(formData.roleName);
    // Steps 2, 3 have no required fields
    return true;
  }, [formData]);

  /** Can we navigate to this target step? */
  const canNavigateToStep = useCallback((targetStep: number): boolean => {
    if (targetStep <= currentStep) return true;
    // Allow forward navigation if all intermediate steps are valid
    for (let s = Math.min(currentStep, targetStep); s < targetStep; s++) {
      if (!isStepValid(s)) return false;
    }
    return true;
  }, [currentStep, isStepValid]);

  const handleStepClick = useCallback((targetStep: number) => {
    if (targetStep === currentStep) return;
    if (canNavigateToStep(targetStep)) {
      if (targetStep > currentStep && currentStep === 1 && !validateStep1()) return;
      setCurrentStep(targetStep);
      setErrors({});
    }
  }, [currentStep, canNavigateToStep, validateStep1]);

  const stepStatus = (num: number) =>
    currentStep > num ? "complete" : currentStep === num ? "active" : "upcoming";

  return (
    <>
      <ModalShell open={open} onClose={attemptClose} z={40}>
        <div
          className={`bg-white flex flex-col overflow-hidden transition-[max-width,max-height,width,height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            isFullScreen
              ? "w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] h-[calc(100vh-1.5rem)] max-h-[calc(100vh-1.5rem)] rounded-2xl lg:w-[calc(100vw-2rem)] lg:max-w-[calc(100vw-2rem)] lg:h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-2rem)]"
              : "w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] max-h-[100dvh] rounded-none sm:w-[min(70vw,1320px)] sm:max-w-[min(70vw,1320px)] sm:h-[90vh] sm:max-h-none sm:rounded-2xl"
          }`}
          style={{
            boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
          }}
        >
          {/* Header */}
          <div className="px-4 lg:px-5 pt-4 pb-0 shrink-0 bg-white border-b border-[#EEF2F6]" style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] sm:text-[17px] text-[#0F172A]" style={{ fontWeight: 700 }}>
                  {isDuplicate ? `Duplicate ${sourceRoleName || "Role"}` : "Create New Role"}
                </h2>
                <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5" style={{ fontWeight: 400 }}>
                  {isDuplicate
                    ? `Creating a copy of ${sourceRoleName || "this role"} with inherited permissions.`
                    : "Define a new role with permissions and assign users."}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {isFullScreen ? "Exit full" : "Full view"}
                </button>
                <button
                  onClick={attemptClose}
                  className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Horizontal step tabs */}
            <div className="flex items-center gap-4 sm:gap-6 mt-3 sm:mt-3.5 overflow-x-auto -mb-px">
              {STEP_DEFS.map((step) => {
                const status = stepStatus(step.number);
                const canClick = step.number !== currentStep && canNavigateToStep(step.number);
                const isBlocked = step.number > currentStep && !canClick;

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
                      {status === "complete" ? <Check className="w-3 h-3" /> : step.number}
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
                  let blockingStep = currentStep;
                  for (let s = currentStep; s < step.number; s++) {
                    if (!isStepValid(s)) { blockingStep = s; break; }
                  }
                  return (
                    <Tooltip key={step.number}>
                      <TooltipTrigger asChild>
                        {stepEl}
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={4} className="text-[11px]">
                        Complete Step {blockingStep} to proceed
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return stepEl;
              })}
            </div>
          </div>

          {/* Body */}
          <div
            className={`flex-1 min-h-0 bg-[#FAFBFC] relative ${
              currentStep === 3 ? "flex flex-col" : "overflow-y-auto"
            }`}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={stepTransition}
                className={currentStep === 3 ? "flex-1 min-h-0 flex flex-col" : ""}
              >
                {currentStep === 3 ? (
                  <div className="flex-1 min-h-0 flex flex-col px-4 lg:px-5 py-4 lg:py-5">
                    <Step3AssignUsers
                      formData={formData}
                      errors={errors}
                      onFieldChange={updateField}
                    />
                  </div>
                ) : (
                  <div className="px-4 lg:px-5 py-4 lg:py-5">
                    {currentStep === 1 && (
                      <Step1RoleBasicInfo
                        formData={formData}
                        errors={errors}
                        onFieldChange={updateField}
                        hideTemplates={isDuplicate}
                        onTemplateChange={handleTemplateChange}
                        permissionsHandEdited={permissionsHandEdited}
                        /* Duplicate arrives with everything inherited except the
                           name, so flag the empty field immediately. */
                        requireOwnName={isDuplicate}
                      />
                    )}
                    {currentStep === 2 && (
                      <Step2RolePermissions
                        permissionToggles={permissionToggles}
                        onPermissionTogglesChange={handlePermissionTogglesChange}
                      />
                    )}
                    {currentStep === 4 && (
                      <Step4ReviewConfirm
                        formData={formData}
                        permissionToggles={permissionToggles}
                        permissionModules={PERMISSION_MODULES}
                        onEditStep={handleEditStep}
                      />
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Bottom fade overlay: edge-to-edge, 40px tall, white → transparent (bottom → top).
                Only earns its place when the template grid is there to fade out of. In the
                Duplicate flow templates are hidden, so Step 1 is short and the fade would sit
                as a flat white band over the grey body. */}
            {currentStep === 1 && !isDuplicate && (
              <div
                className="sticky bottom-0 left-0 right-0 h-[72px] -mt-[72px] pointer-events-none"
                style={{
                  background:
                    "linear-gradient(to top, #FFFFFF 0%, rgba(255,255,255,0) 100%)",
                }}
              />
            )}
          </div>

          {/* Footer */}
          <div
            className="shrink-0 border-t border-[#EEF2F6] bg-white px-4 lg:px-5 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-2.5"
            style={{ borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}
          >
            {/* Left: Back button (steps 2+) */}
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


            {/* Right: Cancel + Primary */}
            <button
              onClick={attemptClose}
              className="inline-flex items-center justify-center px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] border border-[#E2E8F0] bg-white text-xs sm:text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              onClick={
                currentStep === 4
                  ? handleCreateRole
                  : currentStep === 3
                  ? handleContinueFromAssignUsers
                  : handleNext
              }
              disabled={currentStep !== 4 && !isStepValid(currentStep)}
              className="inline-flex items-center gap-1.5 px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] bg-[#007FFF] hover:bg-[#0066D6] active:bg-[#005BBF] text-white shadow-sm transition-colors cursor-pointer text-xs sm:text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontWeight: 600 }}
            >
              {currentStep === 4 ? "Create Role" : "Continue"}
              {currentStep === 4 ? (
                <Save className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </ModalShell>

      {/* Discard Changes Modal */}
      {showDiscardModal && (
        <DiscardDialog
          title="Discard Changes?"
          description="This role has not been saved. All progress in this session will be lost."
          onKeepEditing={() => setShowDiscardModal(false)}
          onDiscard={() => {
            setShowDiscardModal(false);
            onClose();
          }}
        />
      )}

      {/* Inactive / no-license assignment warning (Modal A) */}
      <InactiveOrUnlicensedWarningModal
        open={warningOpen}
        users={atRiskAssignedUsers}
        assignmentLabel={formData.roleName || "this role"}
        assignmentType="role"
        licenseDeficientIds={atRiskAlsoNeedingLicenseIds}
        onContinue={advancePastWarningA}
        onGoBack={() => setWarningOpen(false)}
      />

      {/* License upgrade for under-licensed assigned users (Modal B) */}
      {underLicensedUsers.length === 1 ? (
        <UpgradeLicenseModal
          open={licenseUpgradeOpen}
          onClose={() => setLicenseUpgradeOpen(false)}
          userName={underLicensedUsers[0].fullName}
          userEmail={underLicensedUsers[0].email}
          onConfirm={advancePastWarningB}
          onAssignWithoutUpgrade={skipUpgradeAndContinue}
        />
      ) : (
        <UpgradeLicenseModal
          open={licenseUpgradeOpen}
          onClose={() => setLicenseUpgradeOpen(false)}
          users={underLicensedUsers.map((u) => ({ name: u.fullName, email: u.email }))}
          onConfirm={advancePastWarningB}
          onAssignWithoutUpgrade={skipUpgradeAndContinue}
        />
      )}
    </>
  );
}
