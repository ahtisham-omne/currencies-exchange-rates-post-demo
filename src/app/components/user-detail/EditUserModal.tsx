import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { TypeSelector } from "../shared/TypeSelector";
import { toast } from "sonner";
import {
  User,
  Phone,
  MapPin,
  X,
  Plus,
  Trash2,
  Mail,
  Heart,
  ShieldCheck,
  Camera,
  Maximize2,
  Minimize2,
  Lock,
} from "lucide-react";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getUserDetail, setUserOverrides } from "../../data/user-detail-data";
import { users } from "../../data/users-data";
import { USER_AVATAR_MAP } from "../../data/user-avatars";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../ui/tooltip";
import {
  buildFormData,
  formDataEquals,
  countChanges,
} from "../../lib/edit-form-utils";
import type { UserEditFormData } from "./edit-types";
import type { LanguageEntry, CitizenshipEntry } from "../../types/shared";
import type { AdditionalEmailEntry } from "../create-user/types";
import {
  GENDER_OPTIONS,
  PRONOUN_OPTIONS,
  LANGUAGE_OPTIONS,
  PROFICIENCY_OPTIONS,
  COUNTRY_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from "../create-user/types";
import { PhoneInput } from "../shared/PhoneInput";
import { AddressAutocomplete } from "../shared/AddressAutocomplete";
import { DatePickerInput } from "../create-user/DatePickerInput";
import { ACCOUNT_OWNER_COPY, useAccountOwnerRules } from "../../data/account-owner";

/* ─── Shared classes ─── */
const inputCls =
  "w-full h-10 px-3.5 border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all placeholder:text-[#94A3B8]";
const selectCls = `${inputCls} appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]`;
const selectFlexCls = selectCls.replace("w-full", "flex-1 min-w-0");

const COUNTRY_FLAG_MAP: Record<string, string> = {
  "United States": "🇺🇸", "United Kingdom": "🇬🇧", "India": "🇮🇳",
  "Germany": "🇩🇪", "France": "🇫🇷", "Japan": "🇯🇵", "China": "🇨🇳",
  "Australia": "🇦🇺", "United Arab Emirates": "🇦🇪", "Brazil": "🇧🇷",
  "Canada": "🇨🇦", "Mexico": "🇲🇽", "South Korea": "🇰🇷",
  "Italy": "🇮🇹", "Spain": "🇪🇸",
};

/* ─── Sub-components ─── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs sm:text-[13px] text-[#0F172A] mb-1 block" style={{ fontWeight: 500 }}>{children}</label>;
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-[13px] mt-2 transition-colors cursor-pointer hover:underline" style={{ fontWeight: 520, color: "#007FFF" }}>
      <Plus size={14} strokeWidth={2.5} />
      {label}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-colors cursor-pointer" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#FEE2E2"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FEF2F2"; }}
      title="Remove"
    >
      <Trash2 size={14} />
    </button>
  );
}

/* Inline address type with custom "Other" support */
function AddressTypeInlineEdit({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const presets = ["Home", "Work", "Mailing"];
  const isPreset = presets.includes(value);
  const [editing, setEditing] = useState(false);
  const [customText, setCustomText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);
  const commit = () => { onChange(customText.trim() || "Other"); setEditing(false); };
  if (editing) return <input ref={inputRef} type="text" value={customText} onChange={(e) => setCustomText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }} className="h-full px-3 text-sm text-[#0F172A] bg-transparent border-none outline-none w-[90px]" style={{ fontWeight: 500 }} placeholder="Label..." />;
  if (!isPreset && value) return <button type="button" onClick={() => { setCustomText(value); setEditing(true); }} className="h-full px-3 text-sm text-[#0F172A] bg-transparent border-none outline-none cursor-pointer shrink-0 hover:bg-[#F8FAFC] transition-colors" style={{ fontWeight: 500 }} title="Click to edit">{value}</button>;
  return (
    <select value={value} onChange={(e) => { if (e.target.value === "__other__") { setCustomText("Other"); setEditing(true); onChange("Other"); } else { onChange(e.target.value); } }}
      className="h-full px-3 text-sm text-[#0F172A] bg-transparent border-none outline-none appearance-none cursor-pointer shrink-0 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_4px_center] pr-6" style={{ fontWeight: 500 }}
    >
      {presets.map((p) => <option key={p} value={p}>{p}</option>)}
      <option value="__other__">Other…</option>
    </select>
  );
}

/* Lock beside a field only the Account Owner can change (ERP-5163 AC9), or,
 * on the owner's own primary email, one they change elsewhere (AC10). */
function FieldLock({ reason = ACCOUNT_OWNER_COPY.lockedField }: { reason?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex align-middle ml-1.5 cursor-help" aria-label={reason}>
          <Lock className="w-3 h-3 text-[#94A3B8]" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}

/* Read-only treatment for a locked input: it keeps its value and layout. */
const lockedCls = "!bg-[#F8FAFC] !text-[#64748B] cursor-not-allowed";

/* ─── Section Card for modal body ─── */
function ModalSectionCard({ title, icon: Icon, required, trailing, children }: { title: string; icon: React.ElementType; required?: boolean; trailing?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center gap-2 bg-[#FAFBFC]">
        <div className="w-6 h-6 rounded-md bg-[#0A77FF]/8 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-[#0A77FF]" />
        </div>
        <span className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>{title}</span>
        {required && <span className="text-[9px] sm:text-[10px] text-[#94A3B8] tracking-wider uppercase hidden min-[480px]:inline" style={{ fontWeight: 500 }}>Required</span>}
        {trailing}
      </div>
      <div className="px-3 sm:px-4 py-3 sm:py-4">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* EditUserModal                               */
/* ═══════════════════════════════════════════ */

interface EditUserModalProps {
  open: boolean;
  onClose: () => void;
  userId: number;
}

export function EditUserModal({ open, onClose, userId }: EditUserModalProps) {
  const user = useMemo(() => getUserDetail(userId), [userId]);

  const [formData, setFormData] = useState<UserEditFormData>(() =>
    user ? buildFormData(user) : ({} as UserEditFormData)
  );
  const originalFormData = useRef<UserEditFormData>(
    user ? buildFormData(user) : ({} as UserEditFormData)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [isFullScreen, setIsFullScreen] = useState(false);

  /* Account Owner (ERP-5163 AC9 and AC10, ERP-5161 AC8, ERP-5162 AC7): name,
   * username, primary email and phones are read-only to everyone but the
   * owner, signed in as themselves. Every other field stays editable. The
   * owner editing themselves still can't change their primary email: that
   * moves from General Settings, where it is confirmed from both addresses. */
  const owner = useAccountOwnerRules(userId);
  const keyLocked = !owner.lockedFields.allowed;
  const emailLocked = !owner.primaryEmail.allowed;

  /* ─── Avatar upload ─── */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    USER_AVATAR_MAP[userId] ?? null
  );
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback((file: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) return;
    if (file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (e) => setAvatarPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  // Reset form when modal opens with new user
  useEffect(() => {
    if (open && user) {
      const data = buildFormData(user);
      setFormData(data);
      originalFormData.current = data;
      setFieldErrors({});
      setTouchedFields(new Set());
      setIsSaving(false);
      setIsFullScreen(false);
      setAvatarPreview(USER_AVATAR_MAP[userId] ?? null);
    }
  }, [open, userId]);

  if (!user) return null;

  const isDirty = !formDataEquals(formData, originalFormData.current);
  const changeCount = countChanges(originalFormData.current, formData);

  /* ─── Validation: mirrors the Create User modal (Step 1) exactly ─── */
  const emailInUse = (email: string) =>
    users.some(
      (u) => u.id !== userId && u.email.toLowerCase() === email.trim().toLowerCase()
    );

  const validateFieldRealtime = (field: string, data: UserEditFormData): Record<string, string> => {
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
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.primaryEmail)) newErrors.primaryEmail = "Please enter a valid email address";
      else if (emailInUse(data.primaryEmail)) newErrors.primaryEmail = "This email is already in use";
    }
    return newErrors;
  };

  /* ─── Handlers ─── */
  const handleFieldChange = <K extends keyof UserEditFormData>(key: K, value: UserEditFormData[K]) => {
    const updated = { ...formData, [key]: value };
    setFormData(updated);
    if (touchedFields.has(key)) {
      const errs = validateFieldRealtime(key as string, updated);
      setFieldErrors((prev) => { const next = { ...prev }; if (key === "firstName" || key === "lastName") { delete next.firstName; delete next.lastName; } else delete next[key as string]; return { ...next, ...errs }; });
    } else {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[key as string]; return next; });
    }
  };

  const handleFieldBlur = (field: string) => {
    setTouchedFields((prev) => { const next = new Set(prev); next.add(field); return next; });
    const errs = validateFieldRealtime(field, formData);
    setFieldErrors((prev) => { const next = { ...prev }; if (field === "firstName" || field === "lastName") { delete next.firstName; delete next.lastName; } else delete next[field]; return { ...next, ...errs }; });
  };

  /* Required-fields satisfied (without setting errors), drives Save enablement. */
  /* Locked fields can't be changed here, so they never hold Save back. */
  const isFormValid =
    keyLocked ||
    (!!formData.firstName.trim() &&
      !!formData.lastName.trim() &&
      (emailLocked ||
        (!!formData.primaryEmail.trim() &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.primaryEmail) &&
          !emailInUse(formData.primaryEmail))));

  /* Reason the Save button is disabled (shown in a tooltip on hover). */
  const saveDisabledReason: string | null = !isFormValid
    ? "Complete all required fields with valid values to save."
    : !isDirty
    ? "No changes to save yet."
    : null;

  const handleSave = async () => {
    if (!isFormValid) {
      toast.error("Complete all required fields before saving");
      return;
    }
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    const fullName = [formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(" ");
    const emailStrings = formData.additionalEmails.map((e) => e.email).filter(Boolean);
    setUserOverrides(userId, { ...formData, additionalEmails: emailStrings, fullName, email: formData.primaryEmail } as any);
    setIsSaving(false);
    toast.success("Profile updated", { description: `${changeCount} field${changeCount !== 1 ? "s" : ""} updated for ${user.fullName}.` });
    onClose();
  };

  /* ─── Array handlers ─── */
  const addPhone = () => handleFieldChange("phones", [...formData.phones, { type: "Mobile", countryCode: "+1", number: "" }]);
  const removePhone = (i: number) => handleFieldChange("phones", formData.phones.filter((_, idx) => idx !== i));
  const updatePhone = (i: number, partial: Partial<import("../../types/shared").PhoneEntry>) =>
    handleFieldChange("phones", formData.phones.map((p, idx) => (idx === i ? { ...p, ...partial } : p)));

  const addEmail = () => handleFieldChange("additionalEmails", [...formData.additionalEmails, { email: "", type: "Work" as const }]);
  const removeEmail = (i: number) => handleFieldChange("additionalEmails", formData.additionalEmails.filter((_, idx) => idx !== i));
  const updateEmail = (i: number, partial: Partial<AdditionalEmailEntry>) =>
    handleFieldChange("additionalEmails", formData.additionalEmails.map((e, idx) => (idx === i ? { ...e, ...partial } : e)));

  const addAddress = () => handleFieldChange("addresses", [...formData.addresses, { type: "Home" as const, address: "" }]);
  const removeAddress = (i: number) => handleFieldChange("addresses", formData.addresses.filter((_, idx) => idx !== i));
  const updateAddress = (i: number, partial: Partial<import("../../types/shared").AddressEntry>) =>
    handleFieldChange("addresses", formData.addresses.map((a, idx) => (idx === i ? { ...a, ...partial } : a)));

  const addEmergencyContact = () =>
    handleFieldChange("emergencyContacts", [...formData.emergencyContacts, { fullName: "", relationship: "", countryCode: "+1", phone: "", isPrimary: formData.emergencyContacts.length === 0 }]);
  const removeEmergencyContact = (i: number) => {
    const next = formData.emergencyContacts.filter((_, idx) => idx !== i);
    if (next.length > 0 && !next.some((c) => c.isPrimary)) next[0].isPrimary = true;
    handleFieldChange("emergencyContacts", next);
  };
  const updateEmergencyContact = (i: number, partial: Partial<import("../../types/shared").EmergencyContact>) =>
    handleFieldChange("emergencyContacts", formData.emergencyContacts.map((c, idx) => {
      if (idx === i) return { ...c, ...partial };
      if (partial.isPrimary) return { ...c, isPrimary: false };
      return c;
    }));

  const addLanguage = () => handleFieldChange("languages", [...formData.languages, { language: "", proficiency: "Intermediate", flag: "" }]);
  const removeLanguage = (i: number) => handleFieldChange("languages", formData.languages.filter((_, idx) => idx !== i));
  const updateLanguage = (i: number, partial: Partial<LanguageEntry>) => {
    handleFieldChange("languages", formData.languages.map((l, idx) => {
      if (idx !== i) return l;
      if (partial.language !== undefined) {
        const found = LANGUAGE_OPTIONS.find((o) => o.name === partial.language);
        return { ...l, ...partial, flag: found?.flag ?? "" };
      }
      return { ...l, ...partial };
    }));
  };

  const addCitizenship = () =>
    handleFieldChange("citizenships", [...formData.citizenships, { country: "", isPrimary: formData.citizenships.length === 0 }]);
  const removeCitizenship = (i: number) => {
    const next = formData.citizenships.filter((_, idx) => idx !== i);
    if (next.length > 0 && !next.some((c) => c.isPrimary)) next[0].isPrimary = true;
    handleFieldChange("citizenships", next);
  };
  const updateCitizenship = (i: number, partial: Partial<CitizenshipEntry>) =>
    handleFieldChange("citizenships", formData.citizenships.map((c, idx) => {
      if (idx === i) return { ...c, ...partial };
      if (partial.isPrimary) return { ...c, isPrimary: false };
      return c;
    }));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogPortal>
        <DialogOverlay
          className="backdrop-blur-[6px]"
          style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
        />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] flex flex-col p-0 gap-0 overflow-hidden border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          style={{
            width: isFullScreen ? "calc(100vw - 2rem)" : "70vw",
            maxWidth: isFullScreen ? "calc(100vw - 2rem)" : "70vw",
            maxHeight: isFullScreen ? "calc(100vh - 2rem)" : "88vh",
            borderRadius: 16,
            boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
          }}
        >
        <DialogTitle className="sr-only">Edit User</DialogTitle>
        <DialogDescription className="sr-only">Edit user details for {user.fullName}</DialogDescription>

        {/* ── Header ── */}
        <div className="px-5 pt-4 pb-3 shrink-0 bg-white border-b border-[#E2E8F0] rounded-t-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[15px] sm:text-[17px] text-[#0F172A]" style={{ fontWeight: 700 }}>
                Edit {user.fullName}
              </h2>
              <p className="text-[12px] text-[#64748B] mt-0.5">
                Update profile details and contact information.
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
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 pt-3 pb-4 bg-[#FAFBFC] scrollbar-hide space-y-3">

          {keyLocked && (
            <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border" style={{ backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" }}>
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#7C3AED" }} />
              <p className="text-[12.5px] leading-[18px]" style={{ color: "#5B21B6", fontWeight: 450 }}>
                {user.fullName} is an Account Owner. Only they can change their name, username, primary email, and phone numbers. Everything else here stays editable.
              </p>
            </div>
          )}

          {/* ── Basic Information ── */}
          <ModalSectionCard title="Basic Information" icon={User} required>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
            {/* Photo column + field grid, side by side.
                The photo is deliberately NOT a row-spanning cell of the field
                grid: as a cell it stretched the first two rows to fit its own
                height (83px and 81px against the 60px a field row needs), which
                read as wildly uneven spacing between Full Name, Primary Email,
                and Primary Email while the last two rows sat at the real 12px.
                As its own column the field rows are all one height with one
                gap, matching the Create User step. Space below the photo stays
                empty so every field aligns right. */}
            <div className="flex gap-x-3">
              {/* Avatar uploader */}
              <div className="w-[150px] shrink-0 flex flex-col gap-2">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative w-full aspect-square rounded-xl cursor-pointer group transition-all overflow-hidden ${
                    avatarPreview
                      ? "ring-2 ring-[#E2E8F0] hover:ring-[#007FFF]/40"
                      : isDragging
                      ? "border-2 border-dashed border-[#007FFF] bg-[#EDF4FF]"
                      : "border-2 border-dashed border-[#CBD5E1] hover:border-[#007FFF] bg-[#F8FAFC] hover:bg-[#EDF4FF]"
                  }`}
                >
                  {avatarPreview ? (
                    <>
                      <img src={avatarPreview} alt={user.fullName} className="w-full h-full rounded-xl object-cover" />
                      <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 py-4">
                      <div className="w-10 h-10 rounded-[8px] bg-[#F1F5F9] group-hover:bg-[#E0EDFF] flex items-center justify-center transition-colors">
                        <Camera className="w-5 h-5 text-[#94A3B8] group-hover:text-[#007FFF] transition-colors" />
                      </div>
                      <span className="text-[12px] text-[#94A3B8] group-hover:text-[#007FFF] transition-colors" style={{ fontWeight: 500 }}>Upload Photo</span>
                      <span className="text-[10px] text-[#CBD5E1]">Max 5 MB</span>
                    </div>
                  )}
                </div>
                {avatarPreview && (
                  <div className="flex items-center justify-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[12px] text-[#007FFF] hover:text-[#0066D6] transition-colors cursor-pointer"
                      style={{ fontWeight: 500 }}
                    >
                      Change
                    </button>
                    <span className="text-[#E2E8F0] text-[11px]">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarPreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="text-[12px] text-[#EF4444] hover:text-[#DC2626] transition-colors cursor-pointer"
                      style={{ fontWeight: 500 }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Fields: one grid, one row height, one gap */}
              <div className="flex-1 min-w-0 grid grid-cols-1 min-[480px]:grid-cols-2 gap-x-3 gap-y-3">
              {/* Full Name spans both columns */}
              <div className="min-[480px]:col-span-2">
                <SectionLabel>Full Name <span className="text-[#EF4444]">*</span>{keyLocked && <FieldLock />}</SectionLabel>
                <div className={`flex items-center rounded-lg border overflow-hidden transition-all focus-within:ring-1 focus-within:ring-[#007FFF]/20 focus-within:border-[#007FFF] ${fieldErrors.firstName || fieldErrors.lastName ? "border-[#EF4444]" : "border-[#E2E8F0]"}`}>
                  <input type="text" value={formData.firstName} onChange={(e) => handleFieldChange("firstName", e.target.value)} onBlur={() => handleFieldBlur("firstName")} placeholder="First Name *" readOnly={keyLocked} className={`flex-1 h-10 px-3.5 text-sm text-[#0F172A] bg-white focus:outline-none placeholder:text-[#94A3B8] min-w-0 ${keyLocked ? lockedCls : ""}`} />
                  <div className="w-px self-stretch bg-[#E2E8F0] shrink-0" />
                  <input type="text" value={formData.middleName} onChange={(e) => handleFieldChange("middleName", e.target.value)} placeholder="Middle" readOnly={keyLocked} className={`flex-1 h-10 px-3.5 text-sm text-[#0F172A] bg-white focus:outline-none placeholder:text-[#94A3B8] min-w-0 ${keyLocked ? lockedCls : ""}`} />
                  <div className="w-px self-stretch bg-[#E2E8F0] shrink-0" />
                  <input type="text" value={formData.lastName} onChange={(e) => handleFieldChange("lastName", e.target.value)} onBlur={() => handleFieldBlur("lastName")} placeholder="Last Name *" readOnly={keyLocked} className={`flex-1 h-10 px-3.5 text-sm text-[#0F172A] bg-white focus:outline-none placeholder:text-[#94A3B8] min-w-0 ${keyLocked ? lockedCls : ""}`} />
                </div>
                {(fieldErrors.firstName || fieldErrors.lastName) && <p className="text-[#EF4444] text-[12px] mt-1">{fieldErrors.firstName || fieldErrors.lastName}</p>}
              </div>

              {/* Primary Email */}
              <div>
                <SectionLabel>Primary Email <span className="text-[#EF4444]">*</span>{emailLocked && <FieldLock reason={owner.primaryEmail.reason} />}</SectionLabel>
                <input type="email" readOnly={emailLocked} value={formData.primaryEmail} onChange={(e) => handleFieldChange("primaryEmail", e.target.value)} onBlur={() => handleFieldBlur("primaryEmail")} placeholder="e.g. john@company.com" className={`${inputCls} ${fieldErrors.primaryEmail ? "border-[#EF4444]" : ""} ${emailLocked ? lockedCls : ""}`} />
                {fieldErrors.primaryEmail && <p className="text-[#EF4444] text-[12px] mt-1">{fieldErrors.primaryEmail}</p>}
              </div>

              {/* Username */}
              <div>
                <SectionLabel>Username{keyLocked && <FieldLock />}</SectionLabel>
                <input type="text" readOnly={keyLocked} value={formData.username} onChange={(e) => handleFieldChange("username", e.target.value)} placeholder="Enter username" className={`${inputCls} ${keyLocked ? lockedCls : ""}`} />
              </div>

              <div>
                <SectionLabel>Job Title</SectionLabel>
                <input type="text" value={formData.jobTitle} onChange={(e) => handleFieldChange("jobTitle", e.target.value)} placeholder="Enter job title" className={inputCls} />
              </div>
              <div>
                <SectionLabel>Gender</SectionLabel>
                <select value={formData.gender} onChange={(e) => handleFieldChange("gender", e.target.value)} className={selectCls}>
                  <option value="">Select gender...</option>
                  {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <SectionLabel>Date of Birth</SectionLabel>
                <DatePickerInput value={formData.dateOfBirth} onChange={(val) => handleFieldChange("dateOfBirth", val)} placeholder="MM/DD/YYYY" className={`${inputCls} pr-10`} />
              </div>
              </div>
            </div>
          </ModalSectionCard>

          {/* ── Phone Numbers ── */}
          <ModalSectionCard title="Phone Numbers" icon={Phone} trailing={keyLocked ? <FieldLock /> : undefined}>
            {keyLocked ? (
              <div className="space-y-2.5">
                {formData.phones.length === 0 && (
                  <p className="text-[13px] text-[#94A3B8]">No phone numbers.</p>
                )}
                {formData.phones.map((phone, i) => (
                  <div key={i} className={`${inputCls} ${lockedCls} flex items-center gap-3`}>
                    <span className="w-[86px] shrink-0" style={{ fontWeight: 500 }}>{phone.type}</span>
                    <span className="truncate">{[phone.countryCode, phone.number].filter(Boolean).join(" ")}</span>
                  </div>
                ))}
              </div>
            ) : (
            <div className="space-y-2.5">
              {formData.phones.map((phone, i) => (
                <div key={i} className="flex items-center gap-2 min-w-0">
                  <TypeSelector value={phone.type} onChange={(val) => updatePhone(i, { type: val })} options={["Mobile", "Home", "Work"]} selectClassName={`${selectCls} !w-[110px] shrink-0`} className="shrink-0" />
                  <PhoneInput countryCode={phone.countryCode} number={phone.number} onCountryCodeChange={(code) => updatePhone(i, { countryCode: code })} onNumberChange={(num) => updatePhone(i, { number: num })} className="flex-1 min-w-0" />
                  <RemoveButton onClick={() => removePhone(i)} />
                </div>
              ))}
              <AddButton label="Add Another Number" onClick={addPhone} />
            </div>
            )}
          </ModalSectionCard>

          {/* ── Email Addresses ── */}
          <ModalSectionCard title="Email Addresses" icon={Mail}>
            <div className="space-y-2.5">
              {formData.additionalEmails.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                  <TypeSelector value={entry.type} onChange={(val) => updateEmail(i, { type: val })} options={["Work", "Personal"]} selectClassName={`${selectCls} !w-[120px] shrink-0`} className="shrink-0" />
                  <input type="email" value={entry.email} onChange={(e) => updateEmail(i, { email: e.target.value })} placeholder="e.g. john@company.com" className={`${inputCls} flex-1`} />
                  <RemoveButton onClick={() => removeEmail(i)} />
                </div>
              ))}
              <AddButton label="Add Another Email" onClick={addEmail} />
            </div>
          </ModalSectionCard>

          {/* ── Addresses ── */}
          <ModalSectionCard title="Addresses" icon={MapPin}>
            <div className="space-y-2.5">
              {formData.addresses.map((addr, i) => (
                <div key={i} className="flex items-center gap-2 min-w-0">
                  <div className="flex-1 min-w-0 flex items-center h-10 border border-[#E2E8F0] rounded-lg bg-white focus-within:ring-1 focus-within:ring-[#007FFF]/20 focus-within:border-[#007FFF] transition-all">
                    <AddressTypeInlineEdit value={addr.type} onChange={(val) => updateAddress(i, { type: val })} />
                    <div className="w-px h-5 bg-[#E2E8F0] shrink-0" />
                    <AddressAutocomplete value={addr.address} onChange={(val) => updateAddress(i, { address: val })} placeholder="Search or enter address..." className="flex-1 min-w-0" />
                  </div>
                  <RemoveButton onClick={() => removeAddress(i)} />
                </div>
              ))}
              <AddButton label="Add Address" onClick={addAddress} />
            </div>
          </ModalSectionCard>

          {/* ── Emergency Contacts ── */}
          <ModalSectionCard title="Emergency Contacts" icon={Heart}>
            <div className="space-y-3">
              {formData.emergencyContacts.map((contact, i) => (
                <div key={i} className="rounded-lg border border-[#E2E8F0] p-3 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-[#64748B]" style={{ fontWeight: 600 }}>Contact {i + 1}</span>
                      {contact.isPrimary && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-[#EDF4FF] text-[#007FFF]" style={{ fontWeight: 600 }}>Primary</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => updateEmergencyContact(i, { isPrimary: !contact.isPrimary })} className={`relative inline-flex items-center h-5 w-9 rounded-full shrink-0 cursor-pointer transition-colors duration-200 ${contact.isPrimary ? "bg-[#007FFF]" : "bg-[#E2E8F0]"}`}>
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${contact.isPrimary ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                      </button>
                      <RemoveButton onClick={() => removeEmergencyContact(i)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <SectionLabel>Full Name <span className="text-red-500">*</span></SectionLabel>
                      <input type="text" value={contact.fullName} onChange={(e) => updateEmergencyContact(i, { fullName: e.target.value })} placeholder="e.g. Jane Smith" className={inputCls} />
                    </div>
                    <div>
                      <SectionLabel>Relationship <span className="text-red-500">*</span></SectionLabel>
                      <select value={contact.relationship} onChange={(e) => updateEmergencyContact(i, { relationship: e.target.value })} className={selectCls}>
                        <option value="">Select...</option>
                        {RELATIONSHIP_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <SectionLabel>Phone <span className="text-red-500">*</span></SectionLabel>
                    <PhoneInput countryCode={contact.countryCode} number={contact.phone} onCountryCodeChange={(code) => updateEmergencyContact(i, { countryCode: code })} onNumberChange={(num) => updateEmergencyContact(i, { phone: num })} />
                  </div>
                </div>
              ))}
              <AddButton label="Add Emergency Contact" onClick={addEmergencyContact} />
            </div>
          </ModalSectionCard>

          {/* ── Legal & Compliance ── */}
          <ModalSectionCard title="Legal & Compliance" icon={ShieldCheck}>
            <div className="space-y-2.5">
              {formData.citizenships.map((cit, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={cit.country} onChange={(e) => updateCitizenship(i, { country: e.target.value })} className={selectFlexCls}>
                    <option value="">Select country...</option>
                    {COUNTRY_OPTIONS.map((c) => <option key={c} value={c}>{COUNTRY_FLAG_MAP[c] ? `${COUNTRY_FLAG_MAP[c]} ${c}` : c}</option>)}
                  </select>
                  <button type="button" onClick={() => updateCitizenship(i, { isPrimary: !cit.isPrimary })} className={`relative inline-flex items-center h-5 w-9 rounded-full shrink-0 cursor-pointer transition-colors duration-200 ${cit.isPrimary ? "bg-[#007FFF]" : "bg-[#E2E8F0]"}`}>
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${cit.isPrimary ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                  </button>
                  <span className="text-[11px] shrink-0" style={{ fontWeight: 500, color: cit.isPrimary ? "#007FFF" : "#94A3B8" }}>Primary</span>
                  <RemoveButton onClick={() => removeCitizenship(i)} />
                </div>
              ))}
              <AddButton label="Add Citizenship" onClick={addCitizenship} />
            </div>
          </ModalSectionCard>

          {/* ── Personal Preferences ── */}
          <ModalSectionCard title="Personal Preferences" icon={User}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <SectionLabel>Preferred Name / Nickname</SectionLabel>
                  <input type="text" value={formData.nickname} onChange={(e) => handleFieldChange("nickname", e.target.value)} placeholder="e.g. Johnny" className={inputCls} />
                </div>
                <div>
                  <SectionLabel>Pronouns</SectionLabel>
                  <select value={formData.pronouns} onChange={(e) => handleFieldChange("pronouns", e.target.value)} className={selectCls}>
                    <option value="">Select pronouns...</option>
                    {PRONOUN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Languages */}
              <div className="space-y-2.5">
                <span className="text-[12px] text-[#64748B]" style={{ fontWeight: 600 }}>Languages</span>
                {formData.languages.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 min-w-0">
                    <select value={entry.language} onChange={(e) => updateLanguage(i, { language: e.target.value })} className={selectFlexCls}>
                      <option value="">Select language...</option>
                      {LANGUAGE_OPTIONS.map((lang) => <option key={lang.name} value={lang.name}>{lang.flag} {lang.name}</option>)}
                    </select>
                    <select value={entry.proficiency} onChange={(e) => updateLanguage(i, { proficiency: e.target.value })} className={`${selectCls} !w-[140px] shrink-0`}>
                      {PROFICIENCY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <RemoveButton onClick={() => removeLanguage(i)} />
                  </div>
                ))}
                <AddButton label="Add Language" onClick={addLanguage} />
              </div>
            </div>
          </ModalSectionCard>
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 px-5 py-3 border-t border-[#E2E8F0] bg-white rounded-b-2xl flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[13px] text-[#334155] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          {(() => {
            const saveBtn = (
              <button
                type="button"
                onClick={handleSave}
                disabled={!isFormValid || !isDirty || isSaving || Object.keys(fieldErrors).length > 0}
                className="h-9 px-5 rounded-lg bg-[#007FFF] hover:bg-[#0066D6] text-white text-[13px] inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontWeight: 600 }}
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            );
            // When disabled for a known reason, wrap with a tooltip explaining why.
            if (saveDisabledReason && !isSaving) {
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="inline-flex">{saveBtn}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={4} className="text-[11px]">
                    {saveDisabledReason}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return saveBtn;
          })()}
        </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
