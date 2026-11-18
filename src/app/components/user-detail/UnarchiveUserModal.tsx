import { useState, useCallback, useEffect, useMemo } from "react";
import {
  X,
  ChevronRight,
  Check,
  ArrowLeft,
  ArchiveRestore,
  Maximize2,
  Minimize2,
  User,
  Shield,
  CreditCard,
  FileText,
  Info,
  AlertTriangle,
  Pencil,
  Send,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Step1BasicInfo } from "../create-user/Step1BasicInfo";
import { Step2RolesPermissions } from "../create-user/Step2RolesPermissions";
import { AdditionalDetailsModal } from "../create-user/AdditionalDetailsModal";
import type { CreateUserFormData, AdditionalDetails } from "../create-user/types";
import { ASSIGN_STEP_ROLES, type RoleOption } from "../create-user/types";
import { ModalShell } from "../shared/ModalShell";
import { DiscardDialog } from "./DiscardDialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { DetailCard } from "./DetailCard";
import { FieldPair } from "../shared/FieldPair";
import { SystemRoleLock } from "../shared/SystemRoleBadge";
import { LicenseBadge } from "../table-cells";
import { getUserDetail, setUserRoles } from "../../data/user-detail-data";
import { updateUserRowState } from "../../data/users-row-store";
import { getRestoreConfig } from "../../data/restore-snapshots";
import { PERMISSION_MODULES } from "../../data/permissions-data";

const STEP_DEFS = [
  { number: 1, label: "Review Profile", shortLabel: "Profile" },
  { number: 2, label: "Assign License", shortLabel: "License" },
  { number: 3, label: "Assign Roles", shortLabel: "Roles" },
  { number: 4, label: "Review & Confirm", shortLabel: "Review" },
];

const stepTransition = { duration: 0.2, ease: "easeOut" as const };

const EMPTY_ADDITIONAL: AdditionalDetails = {
  nickname: "",
  pronouns: "",
  languages: [],
  additionalEmails: [],
  phones: [],
  addresses: [],
  emergencyContacts: [],
  citizenships: [],
  notes: "",
  attachments: [],
};

type LicenseChoice = "Full Access" | "Field User" | "No License";

export type UnarchiveModalMode = "unarchive" | "reactivate";

interface UnarchiveUserModalProps {
  open: boolean;
  onClose: () => void;
  userId: number;
  /** True if user was Invite Sent / Invite Expired before archive, controls re-invite path */
  wasInvitePending?: boolean;
  /** Notify caller of new status so they can sync local state */
  onStatusChange?: (status: string) => void;
  /** Notify caller of new license so they can sync local state */
  onLicenseChange?: (license: string) => void;
  /**
   * Variant of the flow. "unarchive" (default) restores an Archived user;
   * "reactivate" restores an Inactive user. Both share the same stepper and
   * components. They differ in the status the user lands at (Reactivate:
   * Active, from its single CTA; Unarchive: Invite Sent or Draft, from its
   * two), what pre-fills (see getRestoreConfig), and copy.
   */
  mode?: UnarchiveModalMode;
}

const LICENSE_OPTIONS: {
  key: LicenseChoice;
  label: string;
  description: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  {
    key: "Full Access",
    label: "Full Access",
    description:
      "Complete access to all modules and features. Required for administrative and management roles.",
    color: "#5B21B6",
    bg: "#EDE9FE",
    border: "#C4B5FD",
  },
  {
    key: "Field User",
    label: "Field User",
    description:
      "Limited access for operational and floor-level tasks. Ideal for field staff and technicians.",
    color: "#475569",
    bg: "#F1F5F9",
    border: "#CBD5E1",
  },
  {
    key: "No License",
    label: "No License",
    description:
      "No sign-in access. The user is restored without a license and is not included in billing. They can still be invited and set up their account, they just cannot sign in until a license is assigned.",
    color: "#475569",
    bg: "#FFFFFF",
    border: "#CBD5E1",
  },
];

export function UnarchiveUserModal({
  open,
  onClose,
  userId,
  wasInvitePending,
  onStatusChange,
  onLicenseChange,
  mode = "unarchive",
}: UnarchiveUserModalProps) {
  const isReactivate = mode === "reactivate";
  const modalTitle = isReactivate ? "Reactivate User" : "Unarchive User";
  const primaryCtaLabel = isReactivate ? "Reactivate" : "Unarchive";
  const fromStatus = isReactivate ? "Inactive" : "Archived";
  const [currentStep, setCurrentStep] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [highestVisited, setHighestVisited] = useState(1);
  const [license, setLicense] = useState<LicenseChoice>("No License");

  const userDetail = useMemo(() => getUserDetail(userId), [userId, open]);

  /* Previous configuration to pre-select (license, roles, direct permissions).
   * Reactivate reads it from live state; unarchive returns empty (archiving
   * cleared the user's access, so nothing pre-fills). Recomputed on open. */
  const restore = useMemo(
    () => getRestoreConfig(userId, mode),
    [userId, mode, open],
  );

  const buildInitialForm = useCallback((): CreateUserFormData => {
    if (!userDetail) {
      return {
        firstName: "",
        middleName: "",
        lastName: "",
        username: "",
        primaryEmail: "",
        gender: "",
        dateOfBirth: "",
        jobTitle: "",
        inviteLinkExpiry: "7 days",
        additionalDetails: { ...EMPTY_ADDITIONAL },
        assignedRoles: [],
        primaryRole: "",
        directPermissions: {},
      };
    }
    return {
      firstName: userDetail.firstName ?? "",
      middleName: userDetail.middleName ?? "",
      lastName: userDetail.lastName ?? "",
      username: userDetail.username ?? "",
      primaryEmail: userDetail.email ?? "",
      gender: userDetail.gender ?? "",
      dateOfBirth: userDetail.dateOfBirth ?? "",
      jobTitle: userDetail.jobTitle ?? "",
      inviteLinkExpiry: userDetail.inviteLinkExpiry || "7 days",
      additionalDetails: {
        nickname: userDetail.nickname ?? "",
        pronouns: userDetail.pronouns ?? "",
        languages: userDetail.languages ?? [],
        additionalEmails: (userDetail.additionalEmails ?? []).map((e) =>
          typeof e === "string" ? { email: e, type: "Work" } : e
        ),
        phones: userDetail.phones ?? [],
        addresses: userDetail.addresses ?? [],
        emergencyContacts: userDetail.emergencyContacts ?? [],
        citizenships: userDetail.citizenships ?? [],
        notes: "",
        attachments: [],
      },
      // Pre-select the user's previous roles (restored from live state on
      // reactivate, or the historical snapshot on unarchive). Only roles that
      // still exist are included; the admin can adjust freely in step 3.
      assignedRoles: restore.roleOptionIds,
      primaryRole: restore.primaryRoleId,
      // Previously held direct grants, seeded on so the Permissions tab opens
      // showing the access this user is getting back.
      directPermissions: Object.fromEntries(
        restore.directPermissionIds.map((id) => [id, true]),
      ),
    };
  }, [userDetail, restore]);

  const [formData, setFormData] = useState<CreateUserFormData>(buildInitialForm);

  // Reset on open
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setErrors({});
      setIsFullScreen(false);
      setTouchedFields(new Set());
      setHighestVisited(1);
      // Pre-select the previously held license tier (null → leave at the
      // "No License" default so the admin chooses).
      setLicense(restore.license ?? "No License");
      setFormData(buildInitialForm());
    }
  }, [open, buildInitialForm, restore]);

  // Escape handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAdditionalDetails) setShowAdditionalDetails(false);
        else handleClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, showAdditionalDetails]);

  const handleClose = useCallback(() => {
    // Always treat closing mid-flow as cancel, user stays Archived
    onClose();
  }, [onClose]);

  const handleForceClose = useCallback(() => {
    setShowDiscardDialog(false);
    onClose();
  }, [onClose]);

  /* ─── Field updates (mirrors CreateUserModal) ─── */
  const validateFieldRealtime = useCallback(
    (field: string, data: CreateUserFormData) => {
      const newErrors: Record<string, string> = {};
      if (field === "firstName" || field === "lastName") {
        const missingFirst = !data.firstName.trim();
        const missingLast = !data.lastName.trim();
        if (missingFirst && missingLast) newErrors.firstName = "First and Last name is required";
        else if (missingFirst) newErrors.firstName = "First name is required";
        else if (missingLast) newErrors.lastName = "Last name is required";
      }
      if (field === "primaryEmail") {
        if (!data.primaryEmail.trim()) newErrors.primaryEmail = "Primary system email is required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.primaryEmail))
          newErrors.primaryEmail = "Please enter a valid email address";
      }
      return newErrors;
    },
    []
  );

  const handleFieldBlur = useCallback(
    (field: string) => {
      setTouchedFields((prev) => new Set(prev).add(field));
      setFormData((current) => {
        const fieldErrors = validateFieldRealtime(field, current);
        setErrors((prev) => {
          const next = { ...prev };
          if (field === "firstName" || field === "lastName") {
            delete next.firstName;
            delete next.lastName;
          } else delete next[field];
          return { ...next, ...fieldErrors };
        });
        return current;
      });
    },
    [validateFieldRealtime]
  );

  const updateField = useCallback(
    <K extends keyof CreateUserFormData>(key: K, value: CreateUserFormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    []
  );

  const updateFieldWithValidation = useCallback(
    <K extends keyof CreateUserFormData>(key: K, value: CreateUserFormData[K]) => {
      setFormData((prev) => {
        const updated = { ...prev, [key]: value };
        setTouchedFields((touched) => {
          if (touched.has(key as string)) {
            const fieldErrors = validateFieldRealtime(key as string, updated);
            setErrors((prevErrors) => {
              const next = { ...prevErrors };
              if (key === "firstName" || key === "lastName") {
                delete next.firstName;
                delete next.lastName;
              } else delete next[key as string];
              return { ...next, ...fieldErrors };
            });
          } else {
            setErrors((prevErrors) => {
              const next = { ...prevErrors };
              delete next[key as string];
              return next;
            });
          }
          return touched;
        });
        return updated;
      });
    },
    [validateFieldRealtime]
  );

  const handleSaveAdditionalDetails = useCallback((details: AdditionalDetails) => {
    setFormData((prev) => ({ ...prev, additionalDetails: details }));
    setShowAdditionalDetails(false);
  }, []);

  const handlePrimaryEmailChange = useCallback((email: string) => {
    setFormData((prev) => ({ ...prev, primaryEmail: email }));
  }, []);

  /* Seed the Permissions tab with the user's previously held direct (non-role)
   * permissions so they appear pre-selected alongside the role-inherited ones. */
  const initialDirectToggles = useCallback(
    (moduleId: string): Record<string, boolean> => {
      const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
      if (!mod) return {};
      const seeded = new Set(restore.directPermissionIds);
      const out: Record<string, boolean> = {};
      mod.permissions.forEach((p) => {
        if (seeded.has(p.id)) out[p.id] = true;
      });
      return out;
    },
    [restore],
  );

  /* ─── Validation per step ─── */
  const isStepValid = useCallback(
    (stepNum: number): boolean => {
      if (stepNum === 1) {
        const hasFirst = !!formData.firstName.trim();
        const hasLast = !!formData.lastName.trim();
        const hasEmail =
          !!formData.primaryEmail.trim() &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.primaryEmail);
        return hasFirst && hasLast && hasEmail;
      }
      // Steps 2 & 3 always valid (license has default, roles can be empty)
      return true;
    },
    [formData]
  );

  const validateStep1 = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    const missingFirst = !formData.firstName.trim();
    const missingLast = !formData.lastName.trim();
    if (missingFirst && missingLast) newErrors.firstName = "First and Last name is required";
    else if (missingFirst) newErrors.firstName = "First name is required";
    else if (missingLast) newErrors.lastName = "Last name is required";
    if (!formData.primaryEmail.trim()) newErrors.primaryEmail = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.primaryEmail))
      newErrors.primaryEmail = "Enter a valid email";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const canNavigateToStep = useCallback(
    (target: number): boolean => {
      if (target <= currentStep) return true;
      for (let s = Math.min(currentStep, target); s < target; s++) {
        if (!isStepValid(s)) return false;
      }
      return true;
    },
    [currentStep, isStepValid]
  );

  const handleStepClick = useCallback(
    (target: number) => {
      if (target === currentStep) return;
      if (canNavigateToStep(target)) {
        if (target > currentStep && currentStep === 1 && !validateStep1()) return;
        setCurrentStep(target);
        setErrors({});
      }
    },
    [currentStep, canNavigateToStep, validateStep1]
  );

  const handleNext = useCallback(() => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep < 4) {
      const next = currentStep + 1;
      setCurrentStep(next);
      setHighestVisited((prev) => Math.max(prev, next));
    }
  }, [currentStep, validateStep1]);

  const handleBack = useCallback(() => {
    if (currentStep === 1) handleClose();
    else {
      setCurrentStep((s) => s - 1);
      setErrors({});
    }
  }, [currentStep, handleClose]);

  /* ─── Commit ─── */
  const handleCommit = useCallback(
    (mode: "unarchive" | "invite") => {
      if (!userDetail) return;
      /* Reactivate lands at Active (ERP-5203, per the feature spec, confirmed
       * 1 Oct 2026). A deactivated user was Active before, so their account is
       * already set up and nothing is waiting on an invite, which is also why
       * Reactivate offers no "& Send Invite" CTA.
       * Unarchive keeps its two streams (ruled 18 Sep 2026), mirroring Create
       * New User, since archiving cleared the user's access:
       *   • "& Send Invite"  → invite now   → Invite Sent
       *   • primary restore  → invite later → Pending Setup (Draft), which
       *     surfaces the Send-Invitation banner on the profile.
       * Neither flow can land at Deactivated: that is reachable solely by
       * deactivating an Active user. */
      const finalStatus = isReactivate
        ? "Active"
        : mode === "invite"
        ? "Invite Sent"
        : "Pending Setup";
      /* The roles confirmed at Review become the user's roles. Unarchive starts
       * from none, since archiving cleared them; Reactivate starts from the
       * roles the user kept, so anything the admin deselected is removed. An
       * Account Owner keeps the role: its card stays picked (ERP-5172 AC13). */
      setUserRoles(
        userId,
        ASSIGN_STEP_ROLES.filter((r) => formData.assignedRoles.includes(r.id)).map((r) => r.name),
      );
      updateUserRowState(userId, { status: finalStatus, license });
      onStatusChange?.(finalStatus);
      onLicenseChange?.(license);
      const fullName = [formData.firstName, formData.middleName, formData.lastName]
        .filter(Boolean)
        .join(" ");
      if (mode === "invite") {
        toast.success(
          `${fullName} unarchived, fresh invitation sent to ${formData.primaryEmail}`
        );
      } else {
        toast.success(`${fullName} has been ${isReactivate ? "reactivated" : "unarchived"}`);
      }
      onClose();
    },
    [
      userDetail,
      userId,
      license,
      formData,
      onStatusChange,
      onLicenseChange,
      onClose,
      isReactivate,
    ]
  );

  const stepStatus = (num: number) =>
    currentStep > num ? "complete" : currentStep === num ? "active" : "upcoming";

  if (!userDetail) return null;

  const fullName = [formData.firstName, formData.middleName, formData.lastName]
    .filter(Boolean)
    .join(" ");
  const selectedRoles = ASSIGN_STEP_ROLES.filter((r) => formData.assignedRoles.includes(r.id));
  const hasFullAccessRole = selectedRoles.some((r) => r.license === "Full Access");

  return (
    <>
      <ModalShell open={open} onClose={handleClose} z={40}>
        <div
          className="bg-white flex flex-col overflow-hidden transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            width: "100vw",
            height: "100vh",
            maxWidth: isFullScreen
              ? "calc(100vw - 2rem)"
              : currentStep === 3
              ? "1280px"
              : "960px",
            maxHeight: isFullScreen
              ? "calc(100vh - 2rem)"
              : currentStep === 3
              ? "min(860px, calc(100vh - 48px))"
              : "min(720px, calc(100vh - 48px))",
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
                  {modalTitle}
                </h2>
                <p
                  className="text-[11px] sm:text-xs text-[#64748B] mt-0.5"
                  style={{ fontWeight: 400 }}
                >
                  {/* Reactivate returns the user to Active. Unarchive never does:
                      it lands at Invite Sent or Draft, picked at Review & Confirm. */}
                  {isReactivate ? (
                    <>
                      Review profile, assign a license and roles, then restore{" "}
                      {userDetail.fullName} to active.
                    </>
                  ) : (
                    <>
                      Review profile, assign a license and roles, then bring{" "}
                      {userDetail.fullName} back as an invited or draft user.
                    </>
                  )}
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
                  step.number !== currentStep && canNavigateToStep(step.number);
                const isBlocked = step.number > currentStep && !canClick;
                const isIncomplete =
                  status === "upcoming" &&
                  highestVisited >= step.number &&
                  !isStepValid(step.number);

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
                      style={{
                        fontWeight: status === "active" || status === "complete" ? 600 : 500,
                      }}
                    >
                      <span className="hidden sm:inline">{step.label}</span>
                      <span className="sm:hidden">{step.shortLabel}</span>
                    </span>
                    {isIncomplete && (
                      <span
                        className="inline-flex items-center rounded px-1.5 py-px text-[10px] shrink-0"
                        style={{
                          backgroundColor: "#FEF3C7",
                          color: "#92400E",
                          border: "1px solid #FDE68A",
                          fontWeight: 600,
                        }}
                      >
                        Incomplete
                      </span>
                    )}
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
                  <Step1BasicInfo
                    formData={formData}
                    errors={errors}
                    onFieldChange={updateFieldWithValidation}
                    onOpenAdditionalDetails={() => setShowAdditionalDetails(true)}
                    touchedFields={touchedFields}
                    onFieldBlur={handleFieldBlur}
                    disableUniquenessChecks
                  />
                )}
                {currentStep === 2 && (
                  <LicenseStep
                    selected={license}
                    onSelect={setLicense}
                    hasFullAccessRole={hasFullAccessRole}
                    previousUnavailable={restore.licenseUnavailable}
                    isReactivate={isReactivate}
                  />
                )}
                {currentStep === 3 && (
                  <>
                    {restore.hasPreselection && (
                      <div className="flex items-start gap-2 mb-3 shrink-0">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#94A3B8" }} />
                        <p className="text-[12.5px]" style={{ color: "#64748B", fontWeight: 450, lineHeight: 1.5 }}>
                          Roles from this user&apos;s previous configuration have been pre-selected. Review and adjust as needed.
                        </p>
                      </div>
                    )}
                    <Step2RolesPermissions
                      formData={formData}
                      errors={errors}
                      onFieldChange={updateField}
                      initialDirectToggles={initialDirectToggles}
                    />
                  </>
                )}
                {currentStep === 4 && (
                  <ReviewStep
                    formData={formData}
                    license={license}
                    selectedRoles={selectedRoles}
                    hasFullAccessRole={hasFullAccessRole}
                    wasInvitePending={!!wasInvitePending}
                    fromStatus={fromStatus}
                    onEditStep={(s) => setCurrentStep(s)}
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
            {currentStep === 4 ? (
              <>
                <button
                  onClick={handleClose}
                  className="inline-flex items-center justify-center px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] border border-[#E2E8F0] bg-white text-xs sm:text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  Cancel
                </button>
                {/* Reactivate has no invite CTA: the user returns to Active
                    with their account already set up, so there is nothing
                    for an invitation to do (1 Oct 2026). */}
                {!isReactivate && (
                  <button
                    onClick={() => handleCommit("invite")}
                    className="inline-flex items-center gap-1.5 px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] border border-[#007FFF] bg-white text-xs sm:text-[13px] text-[#007FFF] hover:bg-[#F0F7FF] transition-colors cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    <Send className="w-3.5 h-3.5 text-[#007FFF]" />
                    Unarchive &amp; Send Invite
                  </button>
                )}
                <button
                  onClick={() => handleCommit("unarchive")}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] bg-[#007FFF] hover:bg-[#0066D6] active:bg-[#005BBF] text-white shadow-sm transition-colors cursor-pointer text-xs sm:text-[13px]"
                  style={{ fontWeight: 600 }}
                >
                  <ArchiveRestore className="w-3.5 h-3.5" />
                  {primaryCtaLabel}
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
                  disabled={!isStepValid(currentStep)}
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

      {/* Additional Details stacked modal */}
      <AdditionalDetailsModal
        open={showAdditionalDetails}
        details={formData.additionalDetails}
        primaryEmail={formData.primaryEmail}
        onPrimaryEmailChange={handlePrimaryEmailChange}
        onSave={handleSaveAdditionalDetails}
        onClose={() => setShowAdditionalDetails(false)}
      />

      {showDiscardDialog && (
        <DiscardDialog
          title="Discard Changes?"
          description={`The user will remain ${isReactivate ? "deactivated" : "archived"} and any edits made in this flow will be lost.`}
          onKeepEditing={() => setShowDiscardDialog(false)}
          onDiscard={handleForceClose}
        />
      )}
    </>
  );
}

/* ─── License picker step ─── */
const LICENSE_BILLING: Record<LicenseChoice, { daily: number; monthly: number }> = {
  "Full Access": { daily: 5.0, monthly: 150.0 },
  "Field User": { daily: 0.5, monthly: 15.0 },
  "No License": { daily: 0, monthly: 0 },
};

function LicenseStep({
  selected,
  onSelect,
  hasFullAccessRole,
  previousUnavailable = false,
  isReactivate = false,
}: {
  selected: LicenseChoice;
  onSelect: (l: LicenseChoice) => void;
  hasFullAccessRole: boolean;
  /** True when the user's previously held license tier is no longer available. */
  previousUnavailable?: boolean;
  /** Reactivate sends no invitation, so the invitation copy is left out. */
  isReactivate?: boolean;
}) {
  return (
    <div className="space-y-4">
      <DetailCard title="Assign License" icon={CreditCard}>
        <div className="py-3 space-y-3">
          <p className="text-[12.5px]" style={{ color: "#64748B", fontWeight: 420 }}>
            Choose the license tier for this user. License determines billing and
            access scope. You can change it later from the user profile.
            {!isReactivate && (
              <>
                {" "}The license does not gate the invitation: you can send one at
                any tier, and the user can accept it and set up their account
                either way.
              </>
            )}
          </p>
          {previousUnavailable && (
            <p className="text-[12px]" style={{ color: "#94A3B8", fontWeight: 450 }}>
              Previous license is no longer available. Select a license to continue.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-1">
            {LICENSE_OPTIONS.map((opt) => {
              const isSelected = selected === opt.key;
              const billing = LICENSE_BILLING[opt.key];
              const isFull = opt.key === "Full Access";
              const isField = opt.key === "Field User";
              const isNone = opt.key === "No License";

              // Per-tier visual config
              const accent = isFull ? "#7C3AED" : isField ? "#475569" : "#334155";
              const gradient = isFull
                ? "linear-gradient(135deg, #FAF5FF 0%, #F3EBFF 100%)"
                : isField
                ? "linear-gradient(135deg, #F8FAFC 0%, #EEF2F7 100%)"
                : "linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)";
              const defaultBorder = isFull
                ? "#E9D5FF"
                : isField
                ? "#E2E8F0"
                : "#E2E8F0";

              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onSelect(opt.key)}
                  className="relative text-left rounded-[12px] p-3.5 transition-all cursor-pointer flex flex-col gap-2.5"
                  style={{
                    background: gradient,
                    border: `${isSelected ? "1.5px" : "1px"} solid ${
                      isSelected ? accent : defaultBorder
                    }`,
                    boxShadow: isSelected
                      ? "none"
                      : "0 1px 3px rgba(15,23,42,0.05), 0 1px 2px rgba(15,23,42,0.03)",
                  }}
                >
                  {/* Header row: tier chip + radio */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[10.5px] px-2 py-0.5 rounded-full border"
                      style={{
                        fontWeight: 600,
                        backgroundColor: opt.bg,
                        color: opt.color,
                        borderColor: opt.border,
                      }}
                    >
                      {opt.label}
                    </span>
                    <div
                      className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors"
                      style={{ borderColor: isSelected ? accent : "#CBD5E1" }}
                    >
                      {isSelected && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: accent }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Price */}
                  {isNone ? (
                    <div>
                      <p
                        className="text-[20px] tracking-tight"
                        style={{ fontWeight: 700, color: "#334155", lineHeight: 1.15 }}
                      >
                        Free
                      </p>
                      <p
                        className="text-[11.5px] mt-0.5"
                        style={{ fontWeight: 450, color: "#64748B" }}
                      >
                        Not included in billing
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p
                        className="text-[20px] tracking-tight"
                        style={{
                          fontWeight: 700,
                          color: isFull ? "#6D28D9" : "#334155",
                          lineHeight: 1.15,
                        }}
                      >
                        ${billing.daily.toFixed(2)}
                        <span className="text-[12px]" style={{ fontWeight: 500 }}>
                          /day
                        </span>
                      </p>
                      <p
                        className="text-[11.5px] mt-0.5"
                        style={{
                          fontWeight: 450,
                          color: isFull ? "#5B21B6" : "#64748B",
                        }}
                      >
                        ~${billing.monthly.toFixed(2)}/mo
                      </p>
                    </div>
                  )}

                  {/* Description */}
                  <p
                    className="text-[12px] leading-snug"
                    style={{ color: "#475569", fontWeight: 420 }}
                  >
                    {isNone && isReactivate
                      ? "No sign-in access. The user is reactivated without a license and is not included in billing. They cannot sign in until a license is assigned."
                      : opt.description}
                  </p>
                </button>
              );
            })}
          </div>

          {hasFullAccessRole && selected !== "Full Access" && (
            <div
              className="flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 border mt-1"
              style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#D97706" }} />
              <p
                className="text-[12.5px]"
                style={{ fontWeight: 480, color: "#92400E" }}
              >
                One or more selected roles require{" "}
                <span style={{ fontWeight: 600 }}>Full Access</span>. Consider
                upgrading the license.
              </p>
            </div>
          )}
        </div>
      </DetailCard>
    </div>
  );
}

/* ─── Review step ─── */
function ReviewStep({
  formData,
  license,
  selectedRoles,
  hasFullAccessRole,
  wasInvitePending,
  fromStatus,
  onEditStep,
}: {
  formData: CreateUserFormData;
  license: LicenseChoice;
  selectedRoles: RoleOption[];
  hasFullAccessRole: boolean;
  wasInvitePending: boolean;
  fromStatus: "Archived" | "Inactive";
  onEditStep: (s: number) => void;
}) {
  const fullName = [formData.firstName, formData.middleName, formData.lastName]
    .filter(Boolean)
    .join(" ");
  

  const editBtn = (step: number) => (
    <button
      onClick={() => onEditStep(step)}
      className="flex items-center gap-1 text-[12.5px] hover:underline transition-colors cursor-pointer"
      style={{ fontWeight: 520, color: "#007FFF" }}
    >
      <Pencil className="w-3 h-3" />
      Edit
    </button>
  );

  return (
    <div className="space-y-4">
      {wasInvitePending && (
        <div
          className="flex items-center gap-2.5 rounded-[10px] border px-3.5 py-3"
          style={{ backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }}
        >
          <Info className="w-4 h-4 shrink-0" style={{ color: "#2563EB" }} />
          <p className="text-[12.5px]" style={{ color: "#1E40AF", fontWeight: 480 }}>
            This user was previously{" "}
            <span style={{ fontWeight: 600 }}>Invite Sent / Expired</span>. Use{" "}
            <span style={{ fontWeight: 600 }}>Unarchive &amp; Send Invite</span> to email a fresh invitation.
          </p>
        </div>
      )}

      <DetailCard title="Basic Information" icon={User} action={editBtn(1)}>
        <div className="grid grid-cols-3 gap-x-8 gap-y-4 py-4">
          <FieldPair label="Full Name" value={fullName} />
          <FieldPair
            label="Username"
            value={formData.username ? `@${formData.username}` : undefined}
          />
          <FieldPair label="Primary Email" value={formData.primaryEmail} />
          <div className="flex flex-col gap-1.5">
            <span className="text-[11.5px] text-[#94A3B8]" style={{ fontWeight: 480 }}>
              License
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {license === "No License" ? (
                <span
                  className="inline-flex items-center rounded border px-2 py-0.5 text-xs"
                  style={{
                    fontWeight: 500,
                    backgroundColor: "#FFFFFF",
                    color: "#475569",
                    borderColor: "#CBD5E1",
                  }}
                >
                  No License
                </span>
              ) : (
                <LicenseBadge license={license} />
              )}
            </div>
          </div>
          <FieldPair label="Gender" value={formData.gender} />
          <FieldPair label="Date of Birth" value={formData.dateOfBirth} />
        </div>
      </DetailCard>


      <DetailCard title="Roles & Permissions" icon={Shield} action={editBtn(3)}>
        <div className="py-3">
          {selectedRoles.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {selectedRoles.map((role) => {
                  const isPrimary = formData.primaryRole === role.id;
                  return (
                    <span
                      key={role.id}
                      className="inline-flex items-center gap-2 text-[12.5px] px-3 py-1.5 rounded-[8px] border"
                      style={{
                        fontWeight: 500,
                        backgroundColor: "#F8FAFC",
                        borderColor: "#E2E8F0",
                        color: "#1E293B",
                      }}
                    >
                      {role.isSystem && <SystemRoleLock size={11} />}
                      {role.name}
                      {isPrimary && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-md"
                          style={{
                            fontWeight: 600,
                            backgroundColor: "#007FFF",
                            color: "#FFFFFF",
                          }}
                        >
                          Primary
                        </span>
                      )}
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full border"
                        style={
                          role.license === "Full Access"
                            ? {
                                fontWeight: 550,
                                backgroundColor: "#EDE9FE",
                                color: "#5B21B6",
                                borderColor: "#C4B5FD",
                              }
                            : {
                                fontWeight: 550,
                                backgroundColor: "#F1F5F9",
                                color: "#475569",
                                borderColor: "#CBD5E1",
                              }
                        }
                      >
                        {role.license}
                      </span>
                    </span>
                  );
                })}
              </div>

              {hasFullAccessRole && license !== "Full Access" && (
                <div
                  className="flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 border"
                  style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#D97706" }} />
                  <p className="text-[12.5px]" style={{ fontWeight: 480, color: "#92400E" }}>
                    One or more selected roles require{" "}
                    <span style={{ fontWeight: 600 }}>Full Access</span>. The user
                    may have limited functionality until upgraded.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 py-1">
              <Info className="w-4 h-4 shrink-0" style={{ color: "#94A3B8" }} />
              <p className="text-[13px]" style={{ fontWeight: 420, color: "#94A3B8" }}>
                No roles assigned. The user will be{" "}
                {fromStatus === "Inactive" ? "reactivated" : "unarchived"} without
                role assignments, you can add them later.
              </p>
            </div>
          )}
        </div>
      </DetailCard>

      <DetailCard title="What Happens on Commit" icon={FileText}>
        <div className="py-3 space-y-1.5 text-[12.5px]" style={{ color: "#475569" }}>
          {fromStatus === "Inactive" ? (
            <p>
              • User exits Deactivated and returns to the listing as{" "}
              <span style={{ fontWeight: 600, color: "#0F172A" }}>Active</span>, with
              their existing account. No invitation is needed.
            </p>
          ) : (
            /* Which of the two statuses the user lands on is the last thing the
               admin decides, here, with the two footer buttons. Naming both is
               the point: unarchiving never produces any third outcome. */
            <p>
              • User exits Archived and enters the listing as{" "}
              <span style={{ fontWeight: 600, color: "#0F172A" }}>Invite Sent</span>{" "}
              if you choose{" "}
              <span style={{ fontWeight: 600, color: "#0F172A" }}>Unarchive &amp; Send Invite</span>
              , or as <span style={{ fontWeight: 600, color: "#0F172A" }}>Draft</span>{" "}
              if you choose{" "}
              <span style={{ fontWeight: 600, color: "#0F172A" }}>Unarchive</span>
              , with the invitation sent later from their profile.
            </p>
          )}
          {license === "No License" &&
            (fromStatus === "Inactive" ? (
              <p>
                • At <span style={{ fontWeight: 600, color: "#0F172A" }}>No License</span>{" "}
                they are Active but cannot sign in until a license is assigned.
              </p>
            ) : (
              <p>
                • At <span style={{ fontWeight: 600, color: "#0F172A" }}>No License</span>{" "}
                the invitation still reaches them and they can set up their account.
                Signing in is what needs a license, and one can be assigned later.
              </p>
            ))}
          <p>• Profile edits from step 1 are saved to the user record.</p>
          <p>• MFA settings are cleared, user re-enrols on next sign-in.</p>
          <p>
            •{" "}
            {fromStatus === "Inactive"
              ? "Deactivation and reactivation"
              : "Archive and unarchive"}{" "}
            events are logged in activity history.
          </p>
        </div>
      </DetailCard>
    </div>
  );
}

