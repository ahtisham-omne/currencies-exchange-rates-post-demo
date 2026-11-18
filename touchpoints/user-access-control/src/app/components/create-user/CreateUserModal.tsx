import { useState, useCallback, useEffect } from "react";
import { getUserDetail, setUserOverrides } from "../../data/user-detail-data";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import {
  X,
  ChevronRight,
  Check,
  Send,
  ArrowLeft,
  UserPlus,
  Maximize2,
  Minimize2,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { deriveUserLicense } from "../../lib/permission-tier";
import { setDirectPermissionIds } from "../../data/user-direct-permissions-data";
import { Step1BasicInfo } from "./Step1BasicInfo";
import { Step2RolesPermissions } from "./Step2RolesPermissions";
import { Step3ReviewConfirm } from "./Step3ReviewConfirm";
import { AdditionalDetailsModal } from "./AdditionalDetailsModal";
import type { CreateUserFormData, AdditionalDetails } from "./types";
import { AVAILABLE_ROLES } from "./types";
import { ModalShell } from "../shared/ModalShell";
import { DiscardDialog } from "../user-detail/DiscardDialog";
import { users } from "../../data/users-data";
import { CURRENT_USER } from "../../data/current-user";
import { isNewTenant } from "../../data/tenant";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../ui/tooltip";

const STEP_DEFS = [
  { number: 1, label: "Basic Information", shortLabel: "Basics" },
  { number: 2, label: "Roles & Permissions", shortLabel: "Roles" },
  { number: 3, label: "Review & Confirm", shortLabel: "Review" },
];

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
}

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

const EMPTY_FORM: CreateUserFormData = {
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

const stepTransition = { duration: 0.2, ease: "easeOut" as const };

export function CreateUserModal({ open, onClose }: CreateUserModalProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<CreateUserFormData>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [highestVisited, setHighestVisited] = useState(1);

  /* ─── Unsaved changes guard (browser back / tab close) ─── */
  const dirtyCheck = !!(
    formData.firstName.trim() ||
    formData.lastName.trim() ||
    formData.primaryEmail.trim() ||
    formData.middleName.trim() ||
    formData.username.trim() ||
    formData.gender ||
    formData.dateOfBirth ||
    formData.assignedRoles.length > 0 ||
    Object.values(formData.directPermissions).some(Boolean)
  );
  useUnsavedChangesGuard(open && dirtyCheck, () => setShowDiscardDialog(true));

  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setFormData({ ...EMPTY_FORM, additionalDetails: { ...EMPTY_ADDITIONAL }, directPermissions: {} });
      setErrors({});
      setIsFullScreen(false);
      setTouchedFields(new Set());
      setHighestVisited(1);
    }
  }, [open]);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAdditionalDetails) {
          setShowAdditionalDetails(false);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, showAdditionalDetails]);

  const isFormDirty = useCallback(() => {
    return !!(
      formData.firstName.trim() ||
      formData.lastName.trim() ||
      formData.primaryEmail.trim() ||
      formData.middleName.trim() ||
      formData.username.trim() ||
      formData.gender ||
      formData.dateOfBirth ||
      formData.assignedRoles.length > 0 ||
      Object.values(formData.directPermissions).some(Boolean)
    );
  }, [formData]);

  const handleClose = useCallback(() => {
    if (isFormDirty()) {
      setShowDiscardDialog(true);
      return;
    }
    onClose();
  }, [onClose, isFormDirty]);

  const handleForceClose = useCallback(() => {
    setShowDiscardDialog(false);
    onClose();
  }, [onClose]);

  const updateField = useCallback(<K extends keyof CreateUserFormData>(key: K, value: CreateUserFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    // Real-time validation for touched fields
    setTouchedFields((prev) => {
      // If field had content before and now being cleared, mark as touched
      // We just re-validate below if already touched
      return prev;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // Real-time validation when fields change (for touched fields)
  const validateFieldRealtime = useCallback((field: string, data: CreateUserFormData) => {
    const newErrors: Record<string, string> = {};
    if (field === "firstName" || field === "lastName") {
      const missingFirst = !data.firstName.trim();
      const missingLast = !data.lastName.trim();
      if (missingFirst && missingLast) {
        newErrors.firstName = "First and Last name is required";
      } else if (missingFirst) {
        newErrors.firstName = "First name is required";
      } else if (missingLast) {
        newErrors.lastName = "Last name is required";
      }
    }
    if (field === "primaryEmail") {
      if (!data.primaryEmail.trim()) {
        newErrors.primaryEmail = "Primary system email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.primaryEmail)) {
        newErrors.primaryEmail = "Please enter a valid email address";
      }
    }
    return newErrors;
  }, []);

  const handleFieldBlur = useCallback((field: string) => {
    setTouchedFields((prev) => {
      const next = new Set(prev);
      next.add(field);
      return next;
    });
    // Validate immediately on blur
    setFormData((current) => {
      const fieldErrors = validateFieldRealtime(field, current);
      setErrors((prev) => {
        const next = { ...prev };
        // Clear previous error for related fields
        if (field === "firstName" || field === "lastName") {
          delete next.firstName;
          delete next.lastName;
        } else {
          delete next[field];
        }
        return { ...next, ...fieldErrors };
      });
      return current; // don't modify formData
    });
  }, [validateFieldRealtime]);

  // Also validate on change for already-touched fields
  const updateFieldWithValidation = useCallback(<K extends keyof CreateUserFormData>(key: K, value: CreateUserFormData[K]) => {
    setFormData((prev) => {
      const updated = { ...prev, [key]: value };
      // If field is touched, validate in real-time
      setTouchedFields((touched) => {
        if (touched.has(key)) {
          const fieldErrors = validateFieldRealtime(key, updated);
          setErrors((prevErrors) => {
            const next = { ...prevErrors };
            if (key === "firstName" || key === "lastName") {
              delete next.firstName;
              delete next.lastName;
            } else {
              delete next[key];
            }
            return { ...next, ...fieldErrors };
          });
        } else {
          // Clear submit-time error when user types
          setErrors((prevErrors) => {
            const next = { ...prevErrors };
            delete next[key];
            return next;
          });
        }
        return touched;
      });
      return updated;
    });
  }, [validateFieldRealtime]);

  const validateStep1 = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    const missingFirst = !formData.firstName.trim();
    const missingLast = !formData.lastName.trim();
    if (missingFirst && missingLast) {
      newErrors.firstName = "First and Last name is required";
    } else if (missingFirst) {
      newErrors.firstName = "First name is required";
    } else if (missingLast) {
      newErrors.lastName = "Last name is required";
    }
    if (!formData.primaryEmail.trim()) newErrors.primaryEmail = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.primaryEmail))
      newErrors.primaryEmail = "Enter a valid email";
    else if (users.some((u) => u.email.toLowerCase() === formData.primaryEmail.trim().toLowerCase()))
      newErrors.primaryEmail = "This email is already in use";

    if (formData.username.trim()) {
      const lower = formData.username.trim().toLowerCase();
      const taken = users.some((u) => {
        const d = getUserDetail(u.id);
        return d && d.username && d.username.toLowerCase() === lower;
      });
      if (taken) newErrors.username = "This username is already taken";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const validateStep2 = useCallback((): boolean => {
    return true;
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep < 3) {
      const next = currentStep + 1;
      setCurrentStep(next);
      setHighestVisited((prev) => Math.max(prev, next));
    }
  }, [currentStep, validateStep1, validateStep2]);

  const handleBack = useCallback(() => {
    if (currentStep === 1) {
      handleClose();
    } else {
      setCurrentStep((s) => s - 1);
      setErrors({});
    }
  }, [currentStep, handleClose]);

  const addUserToMockData = useCallback((status: "Pending Setup" | "Invite Sent") => {
    const newId = Math.max(...users.map((u) => u.id)) + 1;
    const fullName = `${formData.firstName} ${formData.lastName}`.trim();
    /* No fallback role. Creating a user is an identity action, not an access
     * grant, so an account created with nothing selected is created with
     * nothing: no roles, no direct permissions, and a seat that costs nothing.
     * The seat then follows whatever access was actually chosen, with roles and
     * direct grants weighed together. */
    const directPermissionIds = Object.keys(formData.directPermissions).filter(
      (id) => formData.directPermissions[id],
    );
    const roleLicenses = formData.assignedRoles
      .map((id) => AVAILABLE_ROLES.find((r) => r.id === id)?.license)
      .filter((l): l is "Full Access" | "Field User" => !!l);
    const derivedLicense = deriveUserLicense(roleLicenses, formData.directPermissions);
    users.unshift({
      id: newId,
      fullName,
      assignedRoles: formData.assignedRoles,
      license: derivedLicense,
      email: formData.primaryEmail,
      phone: formData.additionalDetails?.phones?.[0]?.number ?? "",
      lastLogon: "-",
      status,
      /* The sample's inviter; for a company from onboarding, whoever is
       * signed in, since nobody from the sample is in its directory. */
      invitedBy: isNewTenant() ? CURRENT_USER.name : "Andrea Davis",
      invitedOn: new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
      inviteAcceptedOn: "-",
    });
    // Persist the optional profile fields entered in Step 1 onto the new
    // user's detail record. Trimmed values pass through verbatim; a blank
    // field is stored as "" so the detail page renders it as a dash rather
    // than falling back to the generated default (e.g. "General").
    setUserOverrides(newId, {
      jobTitle: formData.jobTitle.trim(),
    });
    // Permissions granted outside a role travel with the user, so the detail
    // page's Assigned Permissions tab shows them as Directly Assigned.
    setDirectPermissionIds(newId, directPermissionIds);
    return newId;
  }, [formData]);

  const handleCreateUser = useCallback(() => {
    const newId = addUserToMockData("Pending Setup");
    const fullName = `${formData.firstName} ${formData.lastName}`.trim();
    toast.success(`${fullName} has been created successfully`);
    onClose();
    navigate(`/company-settings/user-access-control/user/${newId}`);
  }, [formData, onClose, navigate, addUserToMockData]);

  const handleCreateAndSendInvite = useCallback(() => {
    const newId = addUserToMockData("Invite Sent");
    const fullName = `${formData.firstName} ${formData.lastName}`.trim();
    toast.success(`${fullName} has been created and an invitation has been sent`);
    onClose();
    navigate(`/company-settings/user-access-control/user/${newId}`);
  }, [formData, onClose, navigate, addUserToMockData]);

  const handlePrimaryEmailChange = useCallback((email: string) => {
    setFormData((prev) => ({ ...prev, primaryEmail: email }));
  }, []);

  const handleSaveAdditionalDetails = useCallback((details: AdditionalDetails) => {
    setFormData((prev) => ({ ...prev, additionalDetails: details }));
    setShowAdditionalDetails(false);
  }, []);

  /** Check if a step's required fields are satisfied (without setting errors) */
  const isStepValid = useCallback((stepNum: number): boolean => {
    if (stepNum === 1) {
      const hasFirst = !!formData.firstName.trim();
      const hasLast = !!formData.lastName.trim();
      const hasEmail = !!formData.primaryEmail.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.primaryEmail);
      return hasFirst && hasLast && hasEmail;
    }
    // Step 2 has no required fields
    return true;
  }, [formData]);

  /** Can we navigate to this target step? */
  const canNavigateToStep = useCallback((targetStep: number): boolean => {
    if (targetStep <= currentStep) return true; // always go back
    // Allow forward navigation if all intermediate steps are valid
    for (let s = Math.min(currentStep, targetStep); s < targetStep; s++) {
      if (!isStepValid(s)) return false;
    }
    return true;
  }, [currentStep, isStepValid]);

  const handleStepClick = useCallback((targetStep: number) => {
    if (targetStep === currentStep) return;
    if (canNavigateToStep(targetStep)) {
      // Validate current step if going forward
      if (targetStep > currentStep) {
        if (currentStep === 1 && !validateStep1()) return;
        if (currentStep === 2 && !validateStep2()) return;
      }
      setCurrentStep(targetStep);
      setErrors({});
    }
  }, [currentStep, canNavigateToStep, validateStep1, validateStep2]);

  const stepStatus = (num: number) =>
    currentStep > num ? "complete" : currentStep === num ? "active" : "upcoming";

  return (
    <>
      <ModalShell open={open} onClose={handleClose} z={40}>
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
                  Create New User
                </h2>
                <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5" style={{ fontWeight: 400 }}>
                  Set up a new user account and send an invitation.
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
                  onClick={handleClose}
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
                      style={{ fontWeight: status === "active" || status === "complete" ? 600 : 500 }}
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
                  // Find which step blocks navigation
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
                  />
                )}
                {currentStep === 2 && (
                  <Step2RolesPermissions
                    formData={formData}
                    errors={errors}
                    onFieldChange={updateField}
                  />
                )}
                {currentStep === 3 && (
                  <Step3ReviewConfirm
                    formData={formData}
                    onEditStep={(step) => setCurrentStep(step)}
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
            {currentStep === 3 ? (
              <>
                <button
                  onClick={handleCreateAndSendInvite}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] border border-[#007FFF] bg-white text-xs sm:text-[13px] text-[#007FFF] hover:bg-[#F0F7FF] transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  <Send className="w-3.5 h-3.5 text-[#007FFF]" />
                  Create &amp; Send Invite
                </button>
                <button
                  onClick={handleCreateUser}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-5 h-8 sm:h-9 rounded-[8px] bg-[#007FFF] hover:bg-[#0066D6] active:bg-[#005BBF] text-white shadow-sm transition-colors cursor-pointer text-xs sm:text-[13px]"
                  style={{ fontWeight: 600 }}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Create User
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

      {/* Discard unsaved changes dialog */}
      {showDiscardDialog && (
        <DiscardDialog
          title="Discard Changes?"
          description="All information entered in this form will be lost. This action cannot be undone."
          onKeepEditing={() => setShowDiscardDialog(false)}
          onDiscard={handleForceClose}
        />
      )}
    </>
  );
}
