import { useRef, useState, useCallback } from "react";
import {
  UserPen,
  ChevronRight,
  Phone,
  MapPin,
  Mail,
  CheckCircle2,
  Info,
  Camera,
  AlertTriangle,
  Globe,
  User,
  Languages,
  AtSign,
  BadgeCheck,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { CreateUserFormData, AdditionalDetails } from "./types";
import { GENDER_OPTIONS, EXPIRY_OPTIONS } from "./types";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../ui/tooltip";
import { DatePickerInput } from "./DatePickerInput";
import { users } from "../../data/users-data";
import { formatFullPhone } from "../../lib/phone-format";
import { getUserDetail } from "../../data/user-detail-data";

interface Step1Props {
  formData: CreateUserFormData;
  errors: Record<string, string>;
  onFieldChange: <K extends keyof CreateUserFormData>(key: K, value: CreateUserFormData[K]) => void;
  onOpenAdditionalDetails: () => void;
  touchedFields: Set<string>;
  onFieldBlur: (field: string) => void;
  /** When true, skip username/email duplication checks (used in Unarchive flow where the
   *  archived user already owns these values). */
  disableUniquenessChecks?: boolean;
  /** Optional slot rendered as the trailing (bottom-right) cell of the details
   *  grid, next to Job Title. Currently unused: it carried the User Status
   *  toggle in the Unarchive flow until that toggle was removed (ERP-5203,
   *  18 Sep 2026). Restoring a user never sets a status here: Reactivate
   *  always lands at Active, and Unarchive's CTA at Review & Confirm picks
   *  Invite Sent or Draft. */
  trailingFieldSlot?: React.ReactNode;
}

const inputClass =
  "w-full h-9 sm:h-10 px-3.5 border rounded-[8px] text-sm text-[#0F172A] bg-white shadow-xs focus:outline-none focus:ring-1 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all placeholder:text-[#94A3B8]";
const labelClass = "block text-xs sm:text-[13px] text-[#0F172A] mb-1.5";
const errorClass = "text-[#EF4444] text-xs mt-1";

function FieldLabel({ label, required, tooltip }: { label: string; required?: boolean; tooltip?: string }) {
  return (
    <span className={labelClass} style={{ fontWeight: 500 }}>
      {label}
      {required && <span className="text-[#EF4444] ml-0.5">*</span>}
      {tooltip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="inline-flex items-center justify-center ml-1.5 align-middle cursor-help" tabIndex={-1}>
              <Info className="w-3.5 h-3.5 text-[#94A3B8] hover:text-[#64748B] transition-colors" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="max-w-[240px]">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}

/* ─── Uniqueness helpers ─── */
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

function checkUsernameUnique(username: string): string | null {
  if (!username.trim()) return null;
  const lower = username.trim().toLowerCase();
  for (const u of users) {
    const detail = getUserDetail(u.id);
    if (detail && detail.username && detail.username.toLowerCase() === lower) {
      return `This username is already taken by ${u.fullName}. Please choose a different username.`;
    }
  }
  return null;
}

interface MiniCardEntry {
  value: string;
  meta?: string;
  incomplete?: boolean;
}

interface MiniCardData {
  key: string;
  icon: LucideIcon;
  label: string;
  entries: MiniCardEntry[];
  incomplete?: boolean;
}

function getAdditionalDetailsTotal(d: AdditionalDetails): number {
  let count = 0;
  if (d.nickname) count++;
  if (d.pronouns) count++;
  count += d.languages.length;
  count += d.additionalEmails.length;
  count += d.phones.length;
  count += d.addresses.length;
  count += d.emergencyContacts.length;
  count += d.citizenships.length;
  return count;
}

function buildAdditionalDetailsMiniCards(d: AdditionalDetails): MiniCardData[] {
  const cards: MiniCardData[] = [];

  if (d.nickname) {
    cards.push({ key: "nickname", icon: BadgeCheck, label: "NICKNAME", entries: [{ value: d.nickname }] });
  }
  if (d.pronouns) {
    cards.push({ key: "pronouns", icon: AtSign, label: "PRONOUNS", entries: [{ value: d.pronouns }] });
  }
  if (d.languages.length > 0) {
    const entries = d.languages.map((l) => {
      const incomplete = !l.language.trim();
      return {
        value: l.language || "Unspecified language",
        meta: l.proficiency || undefined,
        incomplete,
      };
    });
    cards.push({
      key: "languages",
      icon: Languages,
      label: d.languages.length > 1 ? "LANGUAGES" : "LANGUAGE",
      entries,
      incomplete: entries.some((e) => e.incomplete),
    });
  }
  if (d.additionalEmails.length > 0) {
    const entries = d.additionalEmails.map((e) => {
      const incomplete = !e.email.trim();
      return {
        value: e.email || "Email not entered",
        meta: e.type || undefined,
        incomplete,
      };
    });
    cards.push({
      key: "emails",
      icon: Mail,
      label: d.additionalEmails.length > 1 ? "EMAILS" : "EMAIL",
      entries,
      incomplete: entries.some((e) => e.incomplete),
    });
  }
  if (d.phones.length > 0) {
    const entries = d.phones.map((p) => {
      const incomplete = !p.number.trim();
      const value = incomplete ? "Phone number not entered" : formatFullPhone(p.countryCode, p.number);
      return {
        value,
        meta: p.type || undefined,
        incomplete,
      };
    });
    cards.push({
      key: "phones",
      icon: Phone,
      label: d.phones.length > 1 ? "PHONES" : "PHONE",
      entries,
      incomplete: entries.some((e) => e.incomplete),
    });
  }
  if (d.addresses.length > 0) {
    const entries = d.addresses.map((a) => {
      const incomplete = !a.address.trim();
      return {
        value: a.address || "Address not entered",
        meta: a.type || undefined,
        incomplete,
      };
    });
    cards.push({
      key: "addresses",
      icon: MapPin,
      label: d.addresses.length > 1 ? "ADDRESSES" : "ADDRESS",
      entries,
      incomplete: entries.some((e) => e.incomplete),
    });
  }
  if (d.emergencyContacts.length > 0) {
    const entries = d.emergencyContacts.map((c) => {
      const phone = c.phone.trim() ? `${c.countryCode} ${c.phone}`.trim() : "";
      const metaParts = [c.relationship, phone].filter(Boolean);
      const incomplete = !c.fullName.trim() || !c.phone.trim() || !c.relationship.trim();
      return {
        value: c.fullName || "Unnamed contact",
        meta: metaParts.join(" · ") || undefined,
        incomplete,
      };
    });
    cards.push({
      key: "emergency",
      icon: User,
      label: d.emergencyContacts.length > 1 ? "EMERGENCY CONTACTS" : "EMERGENCY CONTACT",
      entries,
      incomplete: entries.some((e) => e.incomplete),
    });
  }
  if (d.citizenships.length > 0) {
    const entries = d.citizenships.map((c) => {
      const incomplete = !c.country.trim();
      return {
        value: c.country || "Country not selected",
        meta: c.isPrimary ? "Primary" : "Secondary",
        incomplete,
      };
    });
    cards.push({
      key: "citizenships",
      icon: Globe,
      label: d.citizenships.length > 1 ? "CITIZENSHIPS" : "CITIZENSHIP",
      entries,
      incomplete: entries.some((e) => e.incomplete),
    });
  }

  return cards;
}

function MiniCard({ icon: Icon, label, entries, incomplete }: MiniCardData) {
  const showCount = entries.length > 1;
  return (
    <div
      className="rounded-[8px] border p-3"
      style={{
        borderColor: incomplete ? "#FCD34D" : "#E2E8F0",
        backgroundColor: incomplete ? "#FFFBEB" : "#F8FAFC",
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: incomplete ? "#D97706" : "#94A3B8" }} />
        <span
          className="text-[10.5px] uppercase tracking-[0.06em]"
          style={{ color: incomplete ? "#92400E" : "#94A3B8", fontWeight: 600 }}
        >
          {label}
        </span>
        {incomplete && (
          <span
            aria-label="Incomplete"
            title="Incomplete: some fields need attention"
            className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: "#F59E0B" }}
          />
        )}
        {showCount && (
          <span
            className="ml-auto text-[10px] px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: incomplete ? "#FEF3C7" : "#E2E8F0",
              color: incomplete ? "#92400E" : "#64748B",
              fontWeight: 600,
            }}
          >
            {entries.length}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {entries.map((entry, i) => (
          <div
            key={i}
            className="min-w-0 break-words text-[13px] flex items-center gap-1.5"
            style={{
              color: entry.incomplete ? "#92400E" : "#0F172A",
              fontWeight: 500,
              lineHeight: "1.6",
            }}
          >
            {entry.incomplete && (
              <span
                className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: "#F59E0B" }}
              />
            )}
            <span
              className="min-w-0 break-words"
              style={entry.incomplete ? { fontStyle: "italic" } : undefined}
            >
              {entry.value}
              {entry.meta && (
                <>
                  {" "}
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] align-middle"
                    style={{
                      backgroundColor: entry.incomplete ? "#FEF3C7" : "#E2E8F0",
                      color: entry.incomplete ? "#92400E" : "#64748B",
                      fontWeight: 500,
                    }}
                  >
                    {entry.meta}
                  </span>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Step1BasicInfo({ formData, errors, onFieldChange, onOpenAdditionalDetails, touchedFields, onFieldBlur, disableUniquenessChecks = false, trailingFieldSlot }: Step1Props) {
  const usernameDup = disableUniquenessChecks ? null : checkUsernameUnique(formData.username);
  const emailDup = disableUniquenessChecks ? null : checkEmailUnique(formData.primaryEmail);
  const additionalMiniCards = buildAdditionalDetailsMiniCards(formData.additionalDetails);
  const additionalTotalCount = getAdditionalDetailsTotal(formData.additionalDetails);
  const hasAdditionalDetails = additionalTotalCount > 0;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profilePreview, setProfilePreview] = useState<string | null>(formData.profilePicture ?? null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback((file: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) return;
    if (file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setProfilePreview(dataUrl);
      onFieldChange("profilePicture", dataUrl);
    };
    reader.readAsDataURL(file);
  }, [onFieldChange]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div className="space-y-4">
      {/* User Details Card */}
      <div className="rounded-[8px] border border-[#E2E8F0] bg-white overflow-visible shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center gap-2 bg-[#FAFBFC]">
          <div className="w-6 h-6 rounded-md bg-[#007FFF]/8 flex items-center justify-center shrink-0">
            <Info className="w-3.5 h-3.5 text-[#007FFF]" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>User Details</span>
            <span className="text-[9px] sm:text-[10px] text-[#94A3B8] tracking-wider uppercase hidden min-[480px]:inline" style={{ fontWeight: 500 }}>Required</span>
          </div>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3 sm:gap-4">
        {/* Left: Profile Picture Upload */}
        <div className="hidden sm:flex flex-col items-center w-[120px]">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div
                onClick={() => !profilePreview && fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative w-full aspect-square rounded-xl cursor-pointer group transition-all ${
                  profilePreview
                    ? "ring-2 ring-[#E2E8F0] hover:ring-[#007FFF]/30"
                    : isDragging
                    ? "border-2 border-dashed border-[#007FFF] bg-[#EDF4FF]"
                    : "border-2 border-dashed border-[#CBD5E1] hover:border-[#007FFF]/50 bg-[#F8FAFC] hover:bg-[#EDF4FF]/50"
                }`}
              >
                {profilePreview ? (
                  <>
                    <img
                      src={profilePreview}
                      alt="Profile"
                      className="w-full h-full rounded-xl object-cover"
                    />
                    <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                    <div className="w-10 h-10 rounded-[8px] bg-[#F1F5F9] group-hover:bg-[#EDF4FF] flex items-center justify-center transition-colors">
                      <Camera className="w-5 h-5 text-[#94A3B8] group-hover:text-[#007FFF] transition-colors" />
                    </div>
                    <span className="text-[11px] text-[#94A3B8] group-hover:text-[#007FFF] transition-colors" style={{ fontWeight: 500 }}>Upload Photo</span>
                    <span className="text-[9px] text-[#CBD5E1]">Max 5 MB</span>
                  </div>
                )}
              </div>
              {profilePreview && (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] text-[#007FFF] hover:text-[#0862D0] transition-colors cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    Change
                  </button>
                  <span className="text-[#E2E8F0] text-[11px]">·</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProfilePreview(null);
                      onFieldChange("profilePicture", null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-[11px] text-[#EF4444] hover:text-[#DC2626] transition-colors cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Mobile: Compact profile photo row */}
            <div className="flex sm:hidden items-center gap-3 mb-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`relative w-14 h-14 rounded-xl cursor-pointer shrink-0 transition-all ${
                  profilePreview
                    ? "ring-2 ring-[#E2E8F0]"
                    : "border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC]"
                }`}
              >
                {profilePreview ? (
                  <img src={profilePreview} alt="Profile" className="w-full h-full rounded-xl object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera className="w-5 h-5 text-[#94A3B8]" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#0F172A]" style={{ fontWeight: 500 }}>
                  {profilePreview ? "Profile photo" : "Add a photo"}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] text-[#007FFF]"
                    style={{ fontWeight: 500 }}
                  >
                    {profilePreview ? "Change" : "Upload"}
                  </button>
                  {profilePreview && (
                    <>
                      <span className="text-[#E2E8F0] text-[11px]">·</span>
                      <button
                        type="button"
                        onClick={() => {
                          setProfilePreview(null);
                          onFieldChange("profilePicture", null);
                        }}
                        className="text-[11px] text-[#EF4444]"
                        style={{ fontWeight: 500 }}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: all fields in a 2-column grid */}
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-2.5 sm:gap-y-3">
              {/* Row 1: Full Name (spans 2 cols) */}
              <div className="col-span-1 min-[480px]:col-span-2">
                <FieldLabel label="Full Name" required />
                <div
                  className={`flex items-center rounded-[8px] border overflow-hidden shadow-xs transition-all focus-within:ring-1 focus-within:ring-[#007FFF]/20 focus-within:border-[#007FFF] ${
                    errors.firstName || errors.lastName ? "border-[#EF4444]" : "border-[#E2E8F0]"
                  }`}
                >
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => onFieldChange("firstName", e.target.value)}
                    onBlur={() => onFieldBlur("firstName")}
                    placeholder="First Name *"
                    className="flex-1 h-9 sm:h-10 px-3.5 text-sm text-[#0F172A] bg-white focus:outline-none placeholder:text-[#94A3B8] min-w-0"
                  />
                  <div className="w-px self-stretch bg-[#E2E8F0] shrink-0" />
                  <input
                    type="text"
                    value={formData.middleName}
                    onChange={(e) => onFieldChange("middleName", e.target.value)}
                    placeholder="Middle Name"
                    className="flex-1 h-9 sm:h-10 px-3.5 text-sm text-[#0F172A] bg-white focus:outline-none placeholder:text-[#94A3B8] min-w-0"
                  />
                  <div className="w-px self-stretch bg-[#E2E8F0] shrink-0" />
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => onFieldChange("lastName", e.target.value)}
                    onBlur={() => onFieldBlur("lastName")}
                    placeholder="Last Name *"
                    className="flex-1 h-9 sm:h-10 px-3.5 text-sm text-[#0F172A] bg-white focus:outline-none placeholder:text-[#94A3B8] min-w-0"
                  />
                </div>
                {(errors.firstName || errors.lastName) && (
                  <p className={errorClass}>{errors.firstName || errors.lastName}</p>
                )}
              </div>

              {/* Row 2 Left: Username */}
              <div>
                <FieldLabel label="Username" tooltip="Optional. If left blank, the user will be prompted to set their own username when they log in for the first time." />
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => onFieldChange("username", e.target.value)}
                  placeholder="Enter username"
                  className={`${inputClass} ${usernameDup ? "border-[#F59E0B] focus:ring-[#F59E0B]/20 focus:border-[#F59E0B]" : errors.username ? "border-[#EF4444] focus:ring-red-200 focus:border-[#EF4444]" : "border-[#E2E8F0]"}`}
                />
                {usernameDup && (
                  <FuzzyMatchAlert message={usernameDup} />
                )}
                {errors.username && <p className={errorClass}>{errors.username}</p>}
              </div>

              {/* Row 2 Right: Gender */}
              <div>
                <FieldLabel label="Gender" tooltip="Optional. Can be filled in now if available or left for the user to add when they first log in." />
                <select
                  value={formData.gender}
                  onChange={(e) => onFieldChange("gender", e.target.value)}
                  className={`${inputClass} border-[#E2E8F0] appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]`}
                >
                  <option value="">Select gender...</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {/* Row 3 Left: Primary System Email */}
              <div>
                <FieldLabel label="Primary System Email" required tooltip="The Primary System Email is editable by admins only from the user's profile edit form. It cannot be edited by the user themselves." />
                <input
                  type="email"
                  value={formData.primaryEmail}
                  onChange={(e) => onFieldChange("primaryEmail", e.target.value)}
                  onBlur={() => onFieldBlur("primaryEmail")}
                  placeholder="e.g. john@company.com"
                  className={`${inputClass} ${emailDup ? "border-[#F59E0B] focus:ring-[#F59E0B]/20 focus:border-[#F59E0B]" : errors.primaryEmail ? "border-[#EF4444] focus:ring-red-200 focus:border-[#EF4444]" : "border-[#E2E8F0]"}`}
                />
                {emailDup && (
                  <FuzzyMatchAlert message={emailDup} />
                )}
                {errors.primaryEmail && <p className={errorClass}>{errors.primaryEmail}</p>}
              </div>

              {/* Row 3 Right: Invitation Link Expiry */}
              <div>
                <FieldLabel label="Invitation Link Expiry" />
                <select
                  value={formData.inviteLinkExpiry}
                  onChange={(e) => onFieldChange("inviteLinkExpiry", e.target.value)}
                  className={`${inputClass} border-[#E2E8F0] appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]`}
                >
                  {EXPIRY_OPTIONS.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>

              {/* Row 4 Left: Date of Birth */}
              <div>
                <FieldLabel label="Date of Birth" />
                <DatePickerInput
                  value={formData.dateOfBirth}
                  onChange={(val) => onFieldChange("dateOfBirth", val)}
                  placeholder="MM/DD/YYYY"
                  className={`${inputClass} border-[#E2E8F0] pr-10`}
                />
              </div>

              {/* Row 4 Right: Job Title */}
              <div>
                <FieldLabel label="Job Title" />
                <input
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) => onFieldChange("jobTitle", e.target.value)}
                  placeholder="Enter job title"
                  className={`${inputClass} border-[#E2E8F0]`}
                />
              </div>

              {/* Row 5 Left: Optional slot (e.g. User Status in Unarchive flow) */}
              {trailingFieldSlot && <div>{trailingFieldSlot}</div>}
        </div>
        </div>
      </div>
      </div>

      {/* Additional Details Card: read-only summary; clicking anywhere opens the modal */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpenAdditionalDetails}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenAdditionalDetails();
          }
        }}
        className="group rounded-xl border bg-white shadow-xs cursor-pointer transition-colors hover:bg-[#FAFBFC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007FFF]/30"
        style={{ borderColor: hasAdditionalDetails ? "#007FFF30" : "#E2E8F0" }}
      >
        {/* Header row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className="w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0"
            style={{ backgroundColor: hasAdditionalDetails ? "#DCFCE7" : "#F1F5F9" }}
          >
            {hasAdditionalDetails ? (
              <CheckCircle2 className="w-5 h-5" style={{ color: "#16A34A" }} />
            ) : (
              <UserPen className="w-5 h-5" style={{ color: "#64748B" }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h4 className="text-[13.5px] text-gray-900" style={{ fontWeight: 580 }}>
                Additional Details
              </h4>
              {hasAdditionalDetails && (
                <span
                  className="text-[10.5px] px-1.5 py-0.5 rounded shrink-0"
                  style={{ backgroundColor: "#F1F5F9", color: "#64748B", fontWeight: 600 }}
                >
                  {additionalTotalCount} {additionalTotalCount === 1 ? "item" : "items"}
                </span>
              )}
            </div>
            {!hasAdditionalDetails && (
              <span
                className="block text-[12.5px] text-gray-500 truncate mt-0.5"
                style={{ fontWeight: 400 }}
              >
                No Additional Details Added Yet
              </span>
            )}
          </div>
          <span
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] border border-[#007FFF] bg-white shadow-xs shrink-0 text-sm transition-colors group-hover:bg-[#EDF4FF]"
            style={{ fontWeight: 500, color: "#007FFF" }}
          >
            <span>{hasAdditionalDetails ? "Edit" : "Add"}</span>
            <ChevronRight className="w-4 h-4" />
          </span>
        </div>

        {/* Divider + mini-card grid, only when we have data */}
        {hasAdditionalDetails && (
          <>
            <div className="border-t border-[#EEF2F6]" />
            <div
              className={`p-4 grid gap-3 ${
                additionalMiniCards.length === 1
                  ? "grid-cols-1"
                  : "grid-cols-1 sm:grid-cols-2"
              }`}
            >
              {additionalMiniCards.map((card) => (
                <MiniCard key={card.key} {...card} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
