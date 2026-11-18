import { useState, useCallback, useEffect } from "react";
import { DiscardDialog } from "./user-detail/DiscardDialog";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";
import { ModalShell } from "./shared/ModalShell";
import { X, Check, Send, Zap, ShieldCheck, ChevronRight, Loader2, Info, AlertTriangle, Maximize2, Minimize2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { users } from "../data/users-data";
import { Step2RolesPermissions } from "./create-user/Step2RolesPermissions";
import { AVAILABLE_ROLES, type CreateUserFormData } from "./create-user/types";

interface QuickInviteModalProps {
  open: boolean;
  onClose: () => void;
}

/* Mirrors the Create New User flow (Step1BasicInfo): amber inline warning
 * when the entered email already belongs to an existing user. */
function FuzzyMatchAlert({ message }: { message: string }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0, y: -4 }}
        animate={{ opacity: 1, height: "auto", y: 0 }}
        exit={{ opacity: 0, height: 0, y: -4 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="mt-1.5"
      >
        <div className="flex items-start gap-2 px-3 py-2 rounded-[8px] bg-[#FEF3C7] border border-[#F59E0B]/30">
          <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] shrink-0 mt-0.5" />
          <span className="text-xs text-[#92400E] leading-snug" style={{ fontWeight: 500 }}>
            {message}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function checkEmailUnique(email: string): string | null {
  if (!email.trim()) return null;
  const lower = email.trim().toLowerCase();
  const match = users.find((u) => u.email.toLowerCase() === lower);
  if (match) return `This email is already in use by ${match.fullName}. Each user must have a unique Primary System Email.`;
  return null;
}

const EXPIRY_OPTIONS = [
  "24 hours",
  "3 days",
  "7 days",
  "14 days",
  "30 days",
];

const inputClass =
  "w-full h-9 sm:h-10 px-3.5 border border-[#E2E8F0] rounded-[8px] text-sm text-[#0F172A] bg-white shadow-xs focus:outline-none focus:ring-1 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all placeholder:text-[#94A3B8]";

/* ── Role + Permissions modal overlay ──
 *
 * Reuses the exact `Step2RolesPermissions` component from the Create New User
 * flow so this surface stays in lock-step with that wizard, same cards,
 * filters, fuzzy search, permissions tab, and primary-role behaviour. We mount
 * it inside a slim shell that provides a header, the standard footer, and a
 * `formData` adapter built from props (the wizard reads `assignedRoles` /
 * `primaryRole`; everything else on `CreateUserFormData` is stubbed since it
 * isn't read by Step 2). */
function RoleSelectionModal({
  assignedRoles,
  primaryRole,
  onAssignedRolesChange,
  onPrimaryRoleChange,
  onClose,
}: {
  assignedRoles: string[];
  primaryRole: string;
  onAssignedRolesChange: (next: string[]) => void;
  onPrimaryRoleChange: (next: string) => void;
  onClose: () => void;
}) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  /* Direct (non-role) permission toggles live here rather than in the grid so
   * they survive a switch back to the Roles tab, which unmounts it. Quick
   * Invite doesn't persist them anywhere, but losing them mid-edit would still
   * read as a bug. */
  const [directPermissions, setDirectPermissions] = useState<Record<string, boolean>>({});
  /* Stub the rest of the wizard form, Step 2 only reads assignedRoles,
   * primaryRole and directPermissions, so the remaining fields can be empty
   * defaults. */
  const formData: CreateUserFormData = {
    firstName: "",
    middleName: "",
    lastName: "",
    username: "",
    primaryEmail: "",
    gender: "",
    dateOfBirth: "",
    jobTitle: "",
    inviteLinkExpiry: "",
    additionalDetails: {
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
    },
    assignedRoles,
    primaryRole,
    directPermissions,
    profilePicture: null,
  };

  const handleFieldChange = <K extends keyof CreateUserFormData>(key: K, value: CreateUserFormData[K]) => {
    if (key === "assignedRoles") onAssignedRolesChange(value as string[]);
    else if (key === "primaryRole") onPrimaryRoleChange(value as string);
    else if (key === "directPermissions") setDirectPermissions(value as Record<string, boolean>);
    /* other fields aren't editable from inside the role selection modal */
  };

  return (
    <>
      {/* Overlay backdrop */}
      <motion.div
        className="fixed inset-0 z-[60]"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.25)",
          backdropFilter: "blur(2px)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[61] flex items-center justify-center" style={{ pointerEvents: "none" }}>
        <motion.div
          className={`flex flex-col bg-white transition-[width,height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            isFullScreen
              ? "w-[calc(100vw-1.5rem)] h-[calc(100vh-1.5rem)] rounded-2xl lg:w-[calc(100vw-2rem)] lg:h-[calc(100vh-2rem)]"
              : "rounded-xl"
          }`}
          style={{
            ...(isFullScreen
              ? {}
              : {
                  width: "min(70vw, 1320px)",
                  maxWidth: "calc(100vw - 48px)",
                  height: "85vh",
                  maxHeight: "calc(100vh - 48px)",
                }),
            boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
            pointerEvents: "auto",
          }}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ type: "spring", duration: 0.25, bounce: 0.1 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="shrink-0 px-5 pt-5 pb-4 border-b border-[#E2E8F0] bg-white rounded-t-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 style={{ fontSize: "15px", fontWeight: 620, color: "#0F172A", letterSpacing: "-0.1px" }}>
                  Assign Roles & Permissions
                </h3>
                <p className="text-[12.5px] mt-0.5" style={{ color: "#64748B", fontWeight: 400 }}>
                  Choose roles to assign and review the resulting permissions.
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
                  className="flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-300 transition-colors shrink-0 cursor-pointer"
                >
                  <X size={15} strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>

          {/* Body: Step 2 fills the available space. `flush` drops its own
           *  bordered card wrapper since the modal frame already supplies it. */}
          <div className="flex-1 min-h-0 flex flex-col">
            <Step2RolesPermissions
              formData={formData}
              errors={{}}
              onFieldChange={handleFieldChange}
              flush
            />
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 py-3.5 border-t border-[#E2E8F0] bg-white rounded-b-xl flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center h-9 px-5 rounded-[8px] border border-[#E2E8F0] bg-white text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center h-9 px-5 rounded-[8px] bg-[#007FFF] hover:bg-[#0066D6] active:bg-[#005BBF] text-white shadow-sm transition-colors cursor-pointer text-[13px]"
              style={{ fontWeight: 600 }}
            >
              Confirm
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}

export function QuickInviteModal({ open, onClose }: QuickInviteModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  /* Role IDs from AVAILABLE_ROLES (string keys like "warehouse_manager") so
   * we can hand the same shape to Step2RolesPermissions that the Create User
   * wizard uses. */
  const [assignedRoles, setAssignedRoles] = useState<string[]>([]);
  const [primaryRole, setPrimaryRole] = useState<string>("");
  const [expiry, setExpiry] = useState("7 days");
  const [sendAnother, setSendAnother] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rolesDropdownOpen, setRolesDropdownOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  useEffect(() => {
    if (open) resetForm();
  }, [open]);

  const isFormDirty = !!(firstName.trim() || lastName.trim() || email.trim() || assignedRoles.length > 0);

  const handleAttemptClose = useCallback(() => {
    if (isFormDirty) {
      setShowDiscardDialog(true);
    } else {
      onClose();
    }
  }, [isFormDirty, onClose]);

  const handleForceClose = useCallback(() => {
    setShowDiscardDialog(false);
    onClose();
  }, [onClose]);

  useUnsavedChangesGuard(open && isFormDirty, () => setShowDiscardDialog(true));

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (rolesDropdownOpen) {
          setRolesDropdownOpen(false);
        } else {
          handleAttemptClose();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, rolesDropdownOpen, handleAttemptClose]);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setAssignedRoles([]);
    setPrimaryRole("");
    setExpiry("7 days");
    setSendAnother(false);
    setErrors({});
    setRolesDropdownOpen(false);
    setIsSending(false);
  };

  const clearError = (key: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const emailDup = checkEmailUnique(email);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!firstName.trim()) newErrors.firstName = "First name is required";
    if (!lastName.trim()) newErrors.lastName = "Last name is required";
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = "Enter a valid email address";
    else if (emailDup)
      newErrors.email = "This email is already in use";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /* Clear the "roles" error whenever the user picks/removes anything in the
   * role selection modal. Step2RolesPermissions doesn't expose a toggle
   * callback directly, so we just react to the array changing. */
  useEffect(() => {
    if (assignedRoles.length > 0) clearError("roles");
  }, [assignedRoles.length]);

  const handleSend = async () => {
    if (!validate()) return;
    setIsSending(true);
    await new Promise((r) => setTimeout(r, 1500));
    setIsSending(false);

    const roleNames = assignedRoles
      .map((id) => AVAILABLE_ROLES.find((r) => r.id === id)?.name)
      .filter(Boolean);

    toast.success("Invitation sent", {
      description: roleNames.length > 0
        ? `Invitation sent to ${email} with ${roleNames.length} role${roleNames.length !== 1 ? "s" : ""} assigned.`
        : `Invitation sent to ${email} with no roles assigned.`,
    });

    if (sendAnother) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setAssignedRoles([]);
      setPrimaryRole("");
      setExpiry("7 days");
      setErrors({});
      setRolesDropdownOpen(false);
      // keep sendAnother true
    } else {
      onClose();
    }
  };

  const selectedRoleNames = assignedRoles
    .map((id) => AVAILABLE_ROLES.find((r) => r.id === id)?.name)
    .filter(Boolean) as string[];

  return (
    <>
      <ModalShell open={open} onClose={handleAttemptClose} z={40}>
        <div
          className="bg-white rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] flex flex-col"
          style={{
            width: 640,
            maxWidth: "calc(100vw - 48px)",
            maxHeight: "calc(100vh - 48px)",
          }}
        >
          <AnimatePresence mode="wait">
            {isSending ? (
              <motion.div
                key="sending"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center justify-center py-20 px-5"
              >
                <Loader2 className="w-8 h-8 animate-spin mb-4" style={{ color: "#007FFF" }} />
                <p className="text-[15px] text-[#0F172A]" style={{ fontWeight: 580 }}>
                  Sending invitation...
                </p>
                <p className="text-[13px] mt-1" style={{ color: "#64748B", fontWeight: 400 }}>
                  This will only take a moment
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col flex-1"
              >
          {/* Header */}
          <div className="shrink-0 bg-white border-b border-gray-200 px-5 py-4 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#EDF4FF" }}
                >
                  <Zap
                    className="w-[17px] h-[17px]"
                    style={{ color: "#007FFF" }}
                  />
                </div>
                <div className="min-w-0">
                  <h2
                    className="text-gray-900"
                    style={{
                      fontSize: "17px",
                      fontWeight: 630,
                      letterSpacing: "-0.2px",
                    }}
                  >
                    Quick Invite
                  </h2>
                   <p
                    className="text-gray-500 text-sm mt-0.5"
                    style={{ fontWeight: 400 }}
                  >
                    Send an invitation email to set up a new account.
                  </p>
                </div>
              </div>
              <button
                onClick={handleAttemptClose}
                className="flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-300 transition-colors shrink-0 cursor-pointer"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5" style={{ backgroundColor: "#F8FAFC" }}>
            {/* First Name + Last Name */}
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label
                  className="block text-sm mb-1.5"
                  style={{ fontWeight: 500, color: "#0F172A" }}
                >
                  First Name{" "}
                  <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    clearError("firstName");
                  }}
                  placeholder="Enter first name"
                  className={`${inputClass} ${errors.firstName ? "!border-red-400 !ring-1 !ring-red-100" : ""}`}
                />
                {errors.firstName && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: "#EF4444", fontWeight: 400 }}
                  >
                    {errors.firstName}
                  </p>
                )}
              </div>
              <div>
                <label
                  className="block text-sm mb-1.5"
                  style={{ fontWeight: 500, color: "#0F172A" }}
                >
                  Last Name{" "}
                  <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    clearError("lastName");
                  }}
                  placeholder="Enter last name"
                  className={`${inputClass} ${errors.lastName ? "!border-red-400 !ring-1 !ring-red-100" : ""}`}
                />
                {errors.lastName && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: "#EF4444", fontWeight: 400 }}
                  >
                    {errors.lastName}
                  </p>
                )}
              </div>
            </div>

            {/* Primary Email + Invitation Link Expiry */}
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label
                  className="block text-sm mb-1.5"
                  style={{ fontWeight: 500, color: "#0F172A" }}
                >
                  Primary Email{" "}
                  <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearError("email");
                  }}
                  placeholder="Enter email address"
                  className={`${inputClass} ${emailDup ? "!border-[#F59E0B] focus:!ring-1 focus:!ring-[#F59E0B]/20 focus:!border-[#F59E0B]" : errors.email ? "!border-red-400 !ring-1 !ring-red-100" : ""}`}
                />
                {emailDup && <FuzzyMatchAlert message={emailDup} />}
                {errors.email && !emailDup && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: "#EF4444", fontWeight: 400 }}
                  >
                    {errors.email}
                  </p>
                )}
              </div>
              <div>
                <label
                  className="block text-sm mb-1.5"
                  style={{ fontWeight: 500, color: "#0F172A" }}
                >
                  Invitation Link Expiry
                </label>
                <div className="relative">
                  <select
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className={`${inputClass} appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center] cursor-pointer`}
                  >
                    {EXPIRY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Assign Roles & Permissions */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <label
                  className="block text-sm"
                  style={{ fontWeight: 500, color: "#0F172A" }}
                >
                  Assign Roles & Permissions
                </label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3.5 h-3.5 text-[#94A3B8] cursor-help shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
                      Assigning a role grants system access and activates all associated permissions immediately upon the user accepting their invitation. If this user is not starting yet, leave this blank and assign a role once they are ready to begin.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div
                className={`rounded-xl border p-4 flex items-center gap-3 transition-colors cursor-pointer shadow-xs hover:border-[#007FFF]/20 ${errors.roles ? "border-[#EF4444]/40" : assignedRoles.length > 0 ? "border-[#007FFF]/30 bg-[#FAFCFF]" : "border-[#E2E8F0]"}`}
                style={{ backgroundColor: assignedRoles.length > 0 ? undefined : "white" }}
                onClick={() => setRolesDropdownOpen(true)}
              >
                {assignedRoles.length === 0 && (
                  <div
                    className="w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "#EDF4FF" }}
                  >
                    <ShieldCheck className="w-5 h-5" style={{ color: "#007FFF" }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-[13.5px] text-gray-900" style={{ fontWeight: 580 }}>
                    {assignedRoles.length > 0 ? `${assignedRoles.length} Role${assignedRoles.length !== 1 ? "s" : ""} Assigned` : "No Roles Assigned Yet"}
                  </h4>
                  {assignedRoles.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {selectedRoleNames.map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: "#EDF4FF", color: "#007FFF", fontWeight: 500 }}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12.5px] text-gray-500 mt-0.5" style={{ fontWeight: 400 }}>
                      Select roles to define what this user can access
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[13px]" style={{ fontWeight: 520, color: "#007FFF" }}>
                    {assignedRoles.length > 0 ? "Edit" : "Assign"}
                  </span>
                  <ChevronRight className="w-4 h-4" style={{ color: "#007FFF" }} />
                </div>
              </div>
              {errors.roles && (
                <p
                  className="text-xs mt-1"
                  style={{ color: "#EF4444", fontWeight: 400 }}
                >
                  {errors.roles}
                </p>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="shrink-0 bg-white border-t border-gray-200 px-5 py-3.5 flex items-center justify-between rounded-b-xl">
            {/* Left: send another checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button
                type="button"
                onClick={() => setSendAnother((p) => !p)}
                className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors cursor-pointer ${
                  sendAnother
                    ? "border-[#007FFF] bg-[#007FFF]"
                    : "border-[#CBD5E1] bg-white hover:border-[#94A3B8]"
                }`}
              >
                {sendAnother && <Check className="w-3 h-3 text-white" />}
              </button>
              <span
                className="text-sm"
                style={{ color: "#334155", fontWeight: 400 }}
              >
                Send Another Invite After This One
              </span>
            </label>

            {/* Right: Send Invite button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-[8px] shadow-sm text-white transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#007FFF" }}
            >
              <Send className="w-3.5 h-3.5" />
              <span className="text-sm" style={{ fontWeight: 600 }}>
                Send Invitation
              </span>
            </button>
          </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ModalShell>

      {/* Role Selection Modal Overlay */}
      <AnimatePresence>
        {rolesDropdownOpen && (
          <RoleSelectionModal
            assignedRoles={assignedRoles}
            primaryRole={primaryRole}
            onAssignedRolesChange={setAssignedRoles}
            onPrimaryRoleChange={setPrimaryRole}
            onClose={() => setRolesDropdownOpen(false)}
          />
        )}
      </AnimatePresence>

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
