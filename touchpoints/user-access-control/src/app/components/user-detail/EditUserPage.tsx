import { useState, useMemo, useRef, useEffect } from "react";
import { TypeSelector } from "../shared/TypeSelector";
import { useParams, useNavigate } from "react-router-dom";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import { toast } from "sonner";
import {
  User,
  Phone,
  MapPin,
  Languages,
  
  ChevronLeft,
  X,
  Check,
  Save,
  Plus,
  Trash2,
  Mail,
  Copy,
  Heart,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { getUserDetail, setUserOverrides } from "../../data/user-detail-data";
import { getAvatarTint, getInitials } from "../../lib/avatar";
import { USER_AVATAR_MAP } from "../../data/user-avatars";
import { LicenseBadge } from "../table-cells";
import {
  buildFormData,
  formDataEquals,
  countChanges,
} from "../../lib/edit-form-utils";
import type { UserEditFormData } from "./edit-types";
import type { LanguageEntry, CitizenshipEntry } from "../../types/shared";
import type { AdditionalEmailEntry } from "../create-user/types";
import { DiscardDialog } from "./DiscardDialog";
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

/* ─── Section definitions ─── */
const SECTIONS = [
  { id: "basic", label: "Basic Information", icon: User },
  { id: "contact", label: "Contact Information", icon: Phone },
  { id: "address", label: "Addresses", icon: MapPin },
  { id: "emergency", label: "Emergency Contacts", icon: Heart },
  { id: "legal", label: "Legal & Compliance", icon: Scale },
  { id: "preferences", label: "Personal Preferences", icon: User },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/* ─── Shared classes (matching Create flow exactly) ─── */
const inputClass =
  "w-full h-9 sm:h-10 px-3.5 border border-[#E2E8F0] rounded-[8px] text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all placeholder:text-[#94A3B8]";
const selectClass = `${inputClass} appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]`;
const selectFlexClass = selectClass.replace("w-full", "flex-1 min-w-0");

const COUNTRY_FLAG_MAP: Record<string, string> = {
  "United States": "🇺🇸", "United Kingdom": "🇬🇧", "India": "🇮🇳",
  "Germany": "🇩🇪", "France": "🇫🇷", "Japan": "🇯🇵", "China": "🇨🇳",
  "Australia": "🇦🇺", "United Arab Emirates": "🇦🇪", "Brazil": "🇧🇷",
  "Canada": "🇨🇦", "Mexico": "🇲🇽", "South Korea": "🇰🇷",
  "Italy": "🇮🇹", "Spain": "🇪🇸",
};

/* ─── Shared sub-components (matching Create/AdditionalDetails flow) ─── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-xs sm:text-[13px] text-[#0F172A] mb-1.5" style={{ fontWeight: 500 }}>
      {children}
    </span>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[13px] mt-2 transition-colors cursor-pointer hover:underline"
      style={{ fontWeight: 520, color: "#007FFF" }}
    >
      <Plus size={14} strokeWidth={2.5} />
      {label}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-10 h-10 shrink-0 rounded-[8px] flex items-center justify-center transition-colors cursor-pointer"
      style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#FEE2E2"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FEF2F2"; }}
      title="Remove"
    >
      <Trash2 size={15} />
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: typeof Phone;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div
      className="rounded-xl border border-dashed p-6 flex flex-col items-center text-center"
      style={{ borderColor: "#CBD5E1", backgroundColor: "#FAFBFC" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
        style={{ backgroundColor: "#EDF4FF" }}
      >
        <Icon size={18} style={{ color: "#007FFF" }} />
      </div>
      <p className="text-[13px] mb-1" style={{ fontWeight: 560, color: "#1E293B" }}>
        {title}
      </p>
      <p className="text-[12px] max-w-[320px] mb-3.5" style={{ fontWeight: 400, color: "#64748B", lineHeight: "1.5" }}>
        {description}
      </p>
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[8px] border text-[12.5px] transition-all cursor-pointer hover:shadow-sm"
        style={{ fontWeight: 560, color: "#007FFF", borderColor: "#007FFF", backgroundColor: "#EFF6FF" }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#DBEAFE"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#EFF6FF"; }}
      >
        <Plus size={13} strokeWidth={2.5} />
        {actionLabel}
      </button>
    </div>
  );
}
/* Inline address type with custom "Other" support */
function AddressTypeInlineEdit({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const presets = ["Home", "Work", "Mailing"];
  const isPreset = presets.includes(value);
  const [editing, setEditing] = useState(false);
  const [customText, setCustomText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = customText.trim();
    onChange(trimmed || "Other");
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={customText}
        onChange={(e) => setCustomText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="h-full px-3 text-sm text-[#0F172A] bg-transparent border-none outline-none w-[90px]"
        style={{ fontWeight: 500 }}
        placeholder="Label..."
      />
    );
  }

  if (!isPreset && value) {
    return (
      <button
        type="button"
        onClick={() => { setCustomText(value); setEditing(true); }}
        className="h-full px-3 text-sm text-[#0F172A] bg-transparent border-none outline-none cursor-pointer shrink-0 hover:bg-[#F8FAFC] transition-colors"
        style={{ fontWeight: 500 }}
        title="Click to edit"
      >
        {value}
      </button>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__other__") {
          setCustomText("Other");
          setEditing(true);
          onChange("Other");
        } else {
          onChange(e.target.value);
        }
      }}
      className="h-full px-3 text-sm text-[#0F172A] bg-transparent border-none outline-none appearance-none cursor-pointer shrink-0 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_4px_center] pr-6"
      style={{ fontWeight: 500 }}
    >
      {presets.map((p) => (
        <option key={p} value={p}>{p}</option>
      ))}
      <option value="__other__">Other…</option>
    </select>
  );
}

export function EditUserPage() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const user = useMemo(() => {
    const id = parseInt(userId ?? "0", 10);
    return getUserDetail(id);
  }, [userId]);

  const [formData, setFormData] = useState<UserEditFormData>(() =>
    user ? buildFormData(user) : ({} as UserEditFormData)
  );
  const originalFormData = useRef<UserEditFormData>(
    user ? buildFormData(user) : ({} as UserEditFormData)
  );

  const [activeSection, setActiveSection] = useState<SectionId>("basic");
  const [isSaving, setIsSaving] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isDirtyEarly = user ? !formDataEquals(formData, originalFormData.current) : false;
  useUnsavedChangesGuard(isDirtyEarly, () => setShowDiscardDialog(true));

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => setIsScrolled(el.scrollTop > 10);
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full font-['Inter',sans-serif]">
        <div className="text-center space-y-3">
          <p className="text-sm" style={{ color: "#64748B" }}>User Not Found</p>
          <button
            onClick={() => navigate("/company-settings/user-access-control")}
            className="text-sm cursor-pointer hover:underline"
            style={{ color: "#007FFF", fontWeight: 500 }}
          >
            Back to User Access Control
          </button>
        </div>
      </div>
    );
  }

  const tint = getAvatarTint(user.fullName);
  const initials = getInitials(user.fullName);
  const isDirty = !formDataEquals(formData, originalFormData.current);
  const changeCount = countChanges(originalFormData.current, formData);

  const displayName = [formData.firstName, formData.middleName, formData.lastName]
    .filter(Boolean)
    .join(" ") || user.fullName;

  /* ─── Handlers ─── */
  const handleFieldChange = <K extends keyof UserEditFormData>(
    key: K,
    value: UserEditFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    // Real-time validation for touched fields
    if (touchedFields.has(key)) {
      const updated = { ...formData, [key]: value };
      const errs: Record<string, string> = {};
      if ((key === "firstName" || key === "lastName")) {
        if (!updated.firstName.trim()) errs.firstName = "First name is required";
        if (!updated.lastName.trim()) errs.lastName = "Last name is required";
      }
      if (key === "primaryEmail") {
        if (!updated.primaryEmail.trim()) errs.primaryEmail = "Primary system email is required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updated.primaryEmail)) errs.primaryEmail = "Please enter a valid email address";
      }
      setFieldErrors((prev) => {
        const next = { ...prev };
        if (key === "firstName" || key === "lastName") { delete next.firstName; delete next.lastName; }
        else delete next[key];
        return { ...next, ...errs };
      });
    } else {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
    }
  };

  const handleFieldBlur = (field: string) => {
    setTouchedFields((prev) => { const next = new Set(prev); next.add(field); return next; });
    const errs: Record<string, string> = {};
    if (field === "firstName" && !formData.firstName.trim()) errs.firstName = "First name is required";
    if (field === "lastName" && !formData.lastName.trim()) errs.lastName = "Last name is required";
    if (field === "primaryEmail") {
      if (!formData.primaryEmail.trim()) errs.primaryEmail = "Primary system email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.primaryEmail)) errs.primaryEmail = "Please enter a valid email address";
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (field === "firstName" || field === "lastName") { delete next.firstName; delete next.lastName; }
      else delete next[field];
      return { ...next, ...errs };
    });
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      navigate(`/company-settings/user-access-control/user/${userId}`);
    }
  };

  const handleDiscard = () => {
    setShowDiscardDialog(false);
    navigate(`/company-settings/user-access-control/user/${userId}`);
  };

  const handleSave = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error("First name and last name are required");
      setActiveSection("basic");
      return;
    }
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 800));

    const id = parseInt(userId ?? "0", 10);
    const fullName = [formData.firstName, formData.middleName, formData.lastName]
      .filter(Boolean)
      .join(" ");
    // Serialize additionalEmails back to string[] for UserDetail compatibility
    const emailStrings = formData.additionalEmails.map((e) => e.email).filter(Boolean);
    setUserOverrides(id, {
      ...formData,
      additionalEmails: emailStrings,
      fullName,
      email: formData.primaryEmail,
    } as any);

    setIsSaving(false);
    toast.success("Profile updated", {
      description: `${changeCount} field${changeCount !== 1 ? "s" : ""} updated for ${user.fullName}.`,
    });
    navigate(`/company-settings/user-access-control/user/${userId}`);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(user.email);
    setEmailCopied(true);
    toast.success("Email copied to clipboard");
    setTimeout(() => setEmailCopied(false), 2000);
  };

  const scrollToSection = (id: SectionId) => {
    setActiveSection(id);
    const el = sectionRefs.current[id];
    const container = scrollContainerRef.current;
    const header = headerRef.current;
    if (el && container) {
      const headerHeight = header ? header.getBoundingClientRect().height : 0;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const targetTop = container.scrollTop + (elRect.top - containerRect.top) - headerHeight - 20;
      container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    }
  };

  /* ─── Array item handlers ─── */
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
    handleFieldChange("emergencyContacts", [
      ...formData.emergencyContacts,
      { fullName: "", relationship: "", countryCode: "+1", phone: "", isPrimary: formData.emergencyContacts.length === 0 },
    ]);
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

  /* ─── Status config ─── */
  const statusConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
    Active: { color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", label: "Active" },
    Inactive: { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", label: "Deactivated" },
    "Invite Sent": { color: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE", label: "Invite Sent" },
    "Invite Expired": { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", label: "Invite Expired" },
    Archived: { color: "#E87171", bg: "#FEF2F2", border: "#FECACA", label: "Archived" },
    "Pending Setup": { color: "#64748B", bg: "#F8FAFC", border: "#E2E8F0", label: "Draft" },
  };
  const currentStatus = statusConfig[user.status] || statusConfig.Active;

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 flex flex-col bg-[#F8FAFC] font-['Inter',sans-serif] overflow-y-auto"
    >
      {/* ════════ HEADER ════════ */}
      <div
        ref={headerRef}
        className="shrink-0 sticky top-0 z-20 relative"
        style={{ paddingTop: isScrolled ? "6px" : "10px", transition: "padding-top 200ms ease" }}
      >
        <div
          style={{
            position: "absolute", inset: "-12px 0 -6px 0",
            background: "linear-gradient(180deg, #F8FAFC 0%, #F8FAFC calc(100% - 6px), transparent 100%)",
            pointerEvents: "none", zIndex: -1,
          }}
        />
        <div className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-4 lg:px-6 xl:px-8">
          <div
            className={`bg-white border border-[#E2E8F0] transition-all duration-200 ${
              isScrolled
                ? "rounded-[8px] shadow-[0_1px_2px_0_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.06)]"
                : "rounded-xl shadow-sm"
            }`}
          >
            <div
              className={`flex items-center justify-between gap-4 px-4 lg:px-5 transition-all duration-200 ${
                isScrolled ? "py-1.5" : "py-3"
              }`}
            >
              {/* Left: Back + Avatar + Info */}
              <div className={`flex items-center min-w-0 transition-all duration-200 ${isScrolled ? "gap-2.5" : "gap-3"}`}>
                <button
                  onClick={handleCancel}
                  className={`rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] flex items-center justify-center shrink-0 transition-all duration-200 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] ${
                    isScrolled ? "w-8 h-8" : "w-11 h-11"
                  }`}
                >
                  <ChevronLeft className={`text-[#94A3B8] transition-all duration-200 ${isScrolled ? "w-4 h-4" : "w-5 h-5"}`} />
                </button>

                {USER_AVATAR_MAP[user.id] ? (
                  <img
                    src={USER_AVATAR_MAP[user.id]}
                    alt={user.fullName}
                    className={`rounded-xl object-cover shrink-0 border border-white transition-all duration-200 ${
                      isScrolled ? "w-8 h-8" : "w-11 h-11"
                    }`}
                    style={{
                      boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 0 0 2px rgba(10,119,255,0.10)",
                    }}
                  />
                ) : (
                  <div
                    className={`rounded-xl flex items-center justify-center shrink-0 border border-white transition-all duration-200 ${
                      isScrolled ? "w-8 h-8" : "w-11 h-11"
                    }`}
                    style={{
                      backgroundColor: tint.bg, color: tint.fg,
                      fontSize: isScrolled ? "10px" : "14px", fontWeight: 700,
                      boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06), 0 0 0 2px rgba(10,119,255,0.10)",
                      transition: "width 200ms, height 200ms, font-size 200ms",
                    }}
                  >
                    {initials}
                  </div>
                )}

                <div className="min-w-0">
                  <div className={`flex items-center flex-wrap transition-all duration-200 ${isScrolled ? "gap-1.5" : "gap-2"}`}>
                    <h1
                      className="text-[#0F172A] truncate"
                      style={{
                        fontSize: isScrolled ? "13px" : "16px",
                        fontWeight: isScrolled ? 600 : 700,
                        lineHeight: isScrolled ? "18px" : "22px",
                        transition: "font-size 200ms, line-height 200ms, font-weight 200ms",
                      }}
                    >
                      Edit &middot; {displayName}
                    </h1>

                    <span
                      className={`inline-flex items-center gap-1 rounded-md border transition-all duration-200 ${
                        isScrolled ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-[11px]"
                      }`}
                      style={{
                        fontWeight: 600, backgroundColor: currentStatus.bg,
                        color: currentStatus.color, borderColor: currentStatus.border,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentStatus.color }} />
                      {currentStatus.label}
                    </span>

                    {!isScrolled && <LicenseBadge license={user.license} />}
                  </div>

                  {!isScrolled && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-[#94A3B8] shrink-0" style={{ fontWeight: 500 }}>
                        @{user.username || user.email.split("@")[0]}
                      </span>
                      <span className="text-[#CBD5E1]">&middot;</span>
                      <button
                        onClick={handleCopyEmail}
                        className="inline-flex items-center gap-1 text-[12px] text-[#64748B] hover:text-[#334155] cursor-pointer transition-colors group"
                        style={{ fontWeight: 400 }}
                      >
                        <Mail className="w-3 h-3 text-[#94A3B8]" />
                        {user.email}
                        {emailCopied ? (
                          <Check className="w-3 h-3" style={{ color: "#10B981" }} />
                        ) : (
                          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Cancel + Save */}
              <div className={`flex items-center shrink-0 transition-all duration-200 ${isScrolled ? "gap-1.5" : "gap-2"}`}>
                <button
                  type="button"
                  onClick={handleCancel}
                  className={`rounded-[8px] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#334155] inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${
                    isScrolled ? "h-8 px-3 text-[12px]" : "h-9 px-3.5 text-[13px]"
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  <X className={`transition-all duration-200 ${isScrolled ? "w-3 h-3" : "w-3.5 h-3.5"}`} />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!isDirty || isSaving || Object.keys(fieldErrors).length > 0}
                  className={`rounded-[8px] bg-[#007FFF] hover:bg-[#0066D6] text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                    isScrolled ? "h-8 px-3.5 text-[12px]" : "h-9 px-4 text-[13px]"
                  }`}
                  style={{ fontWeight: 600 }}
                >
                  {isSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className={`transition-all duration-200 ${isScrolled ? "w-3 h-3" : "w-3.5 h-3.5"}`} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Edit mode indicator bar */}
            <div className="flex items-center gap-2 px-4 lg:px-5 py-2 border-t border-[#F1F5F9]" style={{ backgroundColor: "#F0F7FF" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-[#007FFF]" />
              <span className="text-[11.5px]" style={{ color: "#007FFF", fontWeight: 550 }}>Editing Mode</span>
              {isDirty && (
                <>
                  <span className="text-[#93C5FD]">&middot;</span>
                  <span className="text-[11px]" style={{ color: "#3B82F6", fontWeight: 500 }}>
                    {changeCount} unsaved change{changeCount !== 1 ? "s" : ""}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ════════ BODY: Sidebar + Content ════════ */}
      <div className="flex-1 min-h-0">
        <div className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-4 lg:px-6 xl:px-8 py-5">
          <div className="flex gap-6 items-start">
            {/* ── Left Sidebar ── */}
            <div className="w-[220px] shrink-0 sticky top-[110px] hidden lg:block">
              <nav className="space-y-0.5">
                {SECTIONS.map((section) => {
                  const isActive = activeSection === section.id;
                  const Icon = section.icon;
                  // Per-section dirty detection
                  const orig = originalFormData.current;
                  let isSectionDirty = false;
                  switch (section.id) {
                    case "basic":
                      isSectionDirty =
                        formData.firstName !== orig.firstName ||
                        formData.middleName !== orig.middleName ||
                        formData.lastName !== orig.lastName ||
                        formData.username !== orig.username ||
                        formData.gender !== orig.gender ||
                        formData.dateOfBirth !== orig.dateOfBirth;
                      break;
                    case "contact":
                      isSectionDirty =
                        formData.primaryEmail !== orig.primaryEmail ||
                        JSON.stringify(formData.additionalEmails) !== JSON.stringify(orig.additionalEmails) ||
                        JSON.stringify(formData.phones) !== JSON.stringify(orig.phones);
                      break;
                    case "address":
                      isSectionDirty = JSON.stringify(formData.addresses) !== JSON.stringify(orig.addresses);
                      break;
                    case "emergency":
                      isSectionDirty = JSON.stringify(formData.emergencyContacts) !== JSON.stringify(orig.emergencyContacts);
                      break;
                    case "legal":
                      isSectionDirty = JSON.stringify(formData.citizenships) !== JSON.stringify(orig.citizenships);
                      break;
                    case "preferences":
                      isSectionDirty =
                        formData.nickname !== orig.nickname ||
                        formData.pronouns !== orig.pronouns ||
                        JSON.stringify(formData.languages) !== JSON.stringify(orig.languages);
                      break;
                  }
                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] text-left transition-all cursor-pointer ${
                        isActive ? "bg-[#EDF4FF]" : "bg-transparent hover:bg-[#F8FAFC]"
                      }`}
                    >
                      <Icon
                        className="w-4 h-4 shrink-0"
                        style={{ color: isActive ? "#007FFF" : "#94A3B8" }}
                      />
                      <span
                        className="text-[13px] flex-1"
                        style={{ fontWeight: isActive ? 600 : 450, color: isActive ? "#007FFF" : "#475569" }}
                      >
                        {section.label}
                      </span>
                      {isSectionDirty && (
                        <span
                          className="w-[7px] h-[7px] rounded-full shrink-0"
                          style={{ backgroundColor: "#007FFF" }}
                          title="Unsaved changes"
                        />
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* ── Right Content ── */}
            <div className="flex-1 min-w-0 space-y-6 pb-8">

              {/* ── Basic Information ── */}
              <div ref={(el) => { sectionRefs.current["basic"] = el; }}>
                <SectionCard title="Basic Information" subtitle="Personal details and identification">
                  <div className="space-y-4">
                    {/* Full Name: unified 3-part input */}
                    <div>
                      <SectionLabel>Full Name <span className="text-[#EF4444] ml-0.5">*</span></SectionLabel>
                      <div className={`flex items-center rounded-[8px] border overflow-hidden shadow-xs transition-all focus-within:ring-1 focus-within:ring-[#007FFF]/20 focus-within:border-[#007FFF] ${fieldErrors.firstName || fieldErrors.lastName ? "border-[#EF4444]" : "border-[#E2E8F0]"}`}>
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => handleFieldChange("firstName", e.target.value)}
                          onBlur={() => handleFieldBlur("firstName")}
                          placeholder="First Name"
                          className="flex-1 h-9 sm:h-10 px-3.5 text-sm text-[#0F172A] bg-white focus:outline-none placeholder:text-[#94A3B8] min-w-0"
                        />
                        <div className="w-px self-stretch bg-[#E2E8F0] shrink-0" />
                        <input
                          type="text"
                          value={formData.middleName}
                          onChange={(e) => handleFieldChange("middleName", e.target.value)}
                          placeholder="Middle Name"
                          className="flex-1 h-9 sm:h-10 px-3.5 text-sm text-[#0F172A] bg-white focus:outline-none placeholder:text-[#94A3B8] min-w-0"
                        />
                        <div className="w-px self-stretch bg-[#E2E8F0] shrink-0" />
                        <input
                          type="text"
                          value={formData.lastName}
                          onChange={(e) => handleFieldChange("lastName", e.target.value)}
                          onBlur={() => handleFieldBlur("lastName")}
                          placeholder="Last Name"
                          className="flex-1 h-9 sm:h-10 px-3.5 text-sm text-[#0F172A] bg-white focus:outline-none placeholder:text-[#94A3B8] min-w-0"
                        />
                      </div>
                      {(fieldErrors.firstName || fieldErrors.lastName) && (
                        <p className="text-[#EF4444] text-[12px] mt-1">{fieldErrors.firstName || fieldErrors.lastName}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {/* Username */}
                      <div>
                        <SectionLabel>Username</SectionLabel>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => handleFieldChange("username", e.target.value)}
                          placeholder="Enter username"
                          className={`${inputClass} border-[#E2E8F0]`}
                        />
                      </div>
                      {/* Gender */}
                      <div>
                        <SectionLabel>Gender</SectionLabel>
                        <select
                          value={formData.gender}
                          onChange={(e) => handleFieldChange("gender", e.target.value)}
                          className={`${inputClass} border-[#E2E8F0] appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]`}
                        >
                          <option value="">Select gender...</option>
                          {GENDER_OPTIONS.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                      {/* Primary Email */}
                      <div>
                        <SectionLabel>Primary System Email <span className="text-[#EF4444] ml-0.5">*</span></SectionLabel>
                        <input
                          type="email"
                          value={formData.primaryEmail}
                          onChange={(e) => handleFieldChange("primaryEmail", e.target.value)}
                          onBlur={() => handleFieldBlur("primaryEmail")}
                          placeholder="e.g. john@company.com"
                          className={`${inputClass} ${fieldErrors.primaryEmail ? "border-[#EF4444]" : "border-[#E2E8F0]"}`}
                        />
                        {fieldErrors.primaryEmail && (
                          <p className="text-[#EF4444] text-[12px] mt-1">{fieldErrors.primaryEmail}</p>
                        )}
                      </div>
                      {/* Date of Birth */}
                      <div>
                        <SectionLabel>Date of Birth</SectionLabel>
                        <DatePickerInput
                          value={formData.dateOfBirth}
                          onChange={(val) => handleFieldChange("dateOfBirth", val)}
                          placeholder="MM/DD/YYYY"
                          className={`${inputClass} border-[#E2E8F0] pr-10`}
                        />
                      </div>
                      {/* Job Title */}
                      <div>
                        <SectionLabel>Job Title</SectionLabel>
                        <input
                          type="text"
                          value={formData.jobTitle}
                          onChange={(e) => handleFieldChange("jobTitle", e.target.value)}
                          placeholder="Enter job title"
                          className={`${inputClass} border-[#E2E8F0]`}
                        />
                      </div>
                      {/* Timezone */}
                      <div>
                        <SectionLabel>Timezone</SectionLabel>
                        <input
                          type="text"
                          value={formData.timezone}
                          onChange={(e) => handleFieldChange("timezone", e.target.value)}
                          placeholder="e.g. America/New_York (UTC-5)"
                          className={`${inputClass} border-[#E2E8F0]`}
                        />
                      </div>
                      {/* Timezone */}
                      <div>
                        <SectionLabel>Timezone</SectionLabel>
                        <input
                          type="text"
                          value={formData.timezone}
                          onChange={(e) => handleFieldChange("timezone", e.target.value)}
                          placeholder="e.g. America/New_York (UTC-5)"
                          className={`${inputClass} border-[#E2E8F0]`}
                        />
                      </div>
                    </div>
                  </div>
                </SectionCard>
              </div>

              {/* ── Contact Information ── */}
              <div ref={(el) => { sectionRefs.current["contact"] = el; }}>
                <SectionCard title="Contact Information" subtitle="Additional email addresses and phone numbers for this user">
                  <div className="space-y-6">
                    {/* Additional Emails */}
                    {formData.additionalEmails.length === 0 ? (
                      <EmptyState
                        icon={Mail}
                        title="No Additional Email Addresses Added Yet."
                        description="Add alternate email addresses for notifications, calendar invites, or account recovery options."
                        actionLabel="Add email"
                        onAction={addEmail}
                      />
                    ) : (
                      <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: "#F8FAFC" }}>
                        <div className="text-[12px] text-[#64748B] tracking-wider" style={{ fontWeight: 600 }}>
                          Additional Emails
                        </div>
                        {formData.additionalEmails.map((entry, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-xl p-3" style={{ backgroundColor: "white", boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)" }}>
                            <TypeSelector
                              value={entry.type}
                              onChange={(val) => updateEmail(i, { type: val })}
                              options={["Work", "Personal"]}
                              selectClassName={`${selectClass} !w-[120px] shrink-0`}
                              className="shrink-0"
                            />
                            <div className="relative flex-1">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                              <input
                                type="email"
                                value={entry.email}
                                onChange={(e) => updateEmail(i, { email: e.target.value })}
                                placeholder="e.g. john.secondary@company.com"
                                className={`${inputClass} pl-9`}
                              />
                            </div>
                            <RemoveButton onClick={() => removeEmail(i)} />
                          </div>
                        ))}
                        <AddButton label="Add Email Address" onClick={addEmail} />
                      </div>
                    )}

                    {/* Phone Numbers */}
                    {formData.phones.length === 0 ? (
                      <EmptyState
                        icon={Phone}
                        title="No Phone Numbers"
                        description="Phone numbers enable SMS alerts, multi-factor authentication, and direct contact when it matters most."
                        actionLabel="Add phone number"
                        onAction={addPhone}
                      />
                    ) : (
                      <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: "#F8FAFC" }}>
                        <div className="text-[12px] text-[#64748B] tracking-wider" style={{ fontWeight: 600 }}>
                          Phone Numbers
                        </div>
                        {formData.phones.map((phone, i) => (
                          <div key={i} className="flex items-center gap-2 min-w-0 rounded-xl p-3" style={{ backgroundColor: "white", boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)" }}>
                            <TypeSelector
                              value={phone.type}
                              onChange={(val) => updatePhone(i, { type: val })}
                              options={["Mobile", "Home", "Work"]}
                              selectClassName={`${selectClass} !w-[110px] shrink-0`}
                              className="shrink-0"
                            />
                            <PhoneInput
                              countryCode={phone.countryCode}
                              number={phone.number}
                              onCountryCodeChange={(code) => updatePhone(i, { countryCode: code })}
                              onNumberChange={(num) => updatePhone(i, { number: num })}
                              className="flex-1 min-w-0"
                            />
                            <RemoveButton onClick={() => removePhone(i)} />
                          </div>
                        ))}
                        <AddButton label="Add Phone Number" onClick={addPhone} />
                      </div>
                    )}
                  </div>
                </SectionCard>
              </div>

              {/* ── Addresses ── */}
              <div ref={(el) => { sectionRefs.current["address"] = el; }}>
                <SectionCard title="Addresses" subtitle="Home, work, and mailing addresses for this user">
                  {formData.addresses.length === 0 ? (
                    <EmptyState
                      icon={MapPin}
                      title="No Addresses on File"
                      description="Addresses are used for shipping, tax compliance, and office location assignments. Add one to get started."
                      actionLabel="Add address"
                      onAction={addAddress}
                    />
                  ) : (
                    <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: "#F8FAFC" }}>
                      <div className="text-[12px] text-[#64748B] tracking-wider" style={{ fontWeight: 600 }}>
                        Addresses
                      </div>
                      {formData.addresses.map((addr, i) => (
                        <div key={i} className="relative flex items-center gap-2 min-w-0 rounded-xl p-3" style={{ backgroundColor: "white", boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)" }}>
                          <div className="flex-1 min-w-0 flex items-center h-10 border border-[#E2E8F0] rounded-[8px] bg-white focus-within:ring-1 focus-within:ring-[#007FFF]/20 focus-within:border-[#007FFF] transition-all">
                            <AddressTypeInlineEdit
                              value={addr.type}
                              onChange={(val) => updateAddress(i, { type: val })}
                            />
                            <div className="w-px h-5 bg-[#E2E8F0] shrink-0" />
                            <AddressAutocomplete
                              value={addr.address}
                              onChange={(val) => updateAddress(i, { address: val })}
                              placeholder="Search or enter address..."
                              className="flex-1 min-w-0"
                            />
                          </div>
                          <RemoveButton onClick={() => removeAddress(i)} />
                        </div>
                      ))}
                      <AddButton label="Add Address" onClick={addAddress} />
                    </div>
                  )}
                </SectionCard>
              </div>

              {/* ── Emergency Contacts ── */}
              <div ref={(el) => { sectionRefs.current["emergency"] = el; }}>
                <SectionCard title="Emergency Contacts" subtitle="People to contact in an emergency">
                  {formData.emergencyContacts.length === 0 ? (
                    <EmptyState
                      icon={Heart}
                      title="No Emergency Contacts"
                      description="Emergency contacts ensure the right people are reached quickly when it matters. We recommend adding at least one."
                      actionLabel="Add emergency contact"
                      onAction={addEmergencyContact}
                    />
                  ) : (
                    <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: "#F8FAFC" }}>
                      {formData.emergencyContacts.map((contact, i) => (
                        <div
                          key={i}
                          className="rounded-xl p-4 space-y-3"
                          style={{ backgroundColor: "white", boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)" }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] text-[#64748B] tracking-wider" style={{ fontWeight: 600 }}>
                                Contact {i + 1}
                              </span>
                              {contact.isPrimary && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] bg-[#EDF4FF] text-[#007FFF]" style={{ fontWeight: 600 }}>
                                  Primary
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateEmergencyContact(i, { isPrimary: !contact.isPrimary })}
                                className={`relative inline-flex items-center h-6 w-11 rounded-full shrink-0 cursor-pointer transition-colors duration-200 ${
                                  contact.isPrimary ? "bg-[#007FFF]" : "bg-[#E2E8F0]"
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
                                    contact.isPrimary ? "translate-x-[22px]" : "translate-x-1"
                                  }`}
                                />
                              </button>
                              <span className="text-[11.5px] shrink-0" style={{ fontWeight: 500, color: contact.isPrimary ? "#007FFF" : "#94A3B8" }}>
                                Primary
                              </span>
                              <RemoveButton onClick={() => removeEmergencyContact(i)} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <SectionLabel>Full Name <span className="text-red-500">*</span></SectionLabel>
                              <input
                                type="text"
                                value={contact.fullName}
                                onChange={(e) => updateEmergencyContact(i, { fullName: e.target.value })}
                                placeholder="e.g. Jane Smith"
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <SectionLabel>Relationship <span className="text-red-500">*</span></SectionLabel>
                              <select
                                value={contact.relationship}
                                onChange={(e) => updateEmergencyContact(i, { relationship: e.target.value })}
                                className={selectClass}
                              >
                                <option value="">Select relationship...</option>
                                {RELATIONSHIP_OPTIONS.map((r) => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div>
                            <SectionLabel>Phone Number <span className="text-red-500">*</span></SectionLabel>
                            <PhoneInput
                              countryCode={contact.countryCode}
                              number={contact.phone}
                              onCountryCodeChange={(code) => updateEmergencyContact(i, { countryCode: code })}
                              onNumberChange={(num) => updateEmergencyContact(i, { phone: num })}
                            />
                          </div>
                        </div>
                      ))}
                      <AddButton label="Add Emergency Contact" onClick={addEmergencyContact} />
                    </div>
                  )}
                </SectionCard>
              </div>

              {/* ── Legal & Compliance ── */}
              <div ref={(el) => { sectionRefs.current["legal"] = el; }}>
                <SectionCard title="Legal & Compliance" subtitle="Citizenship records for tax and work authorization">
                  {formData.citizenships.length === 0 ? (
                    <EmptyState
                      icon={ShieldCheck}
                      title="No Citizenships Recorded"
                      description="Citizenship records support tax compliance, benefits eligibility, and work authorization verification."
                      actionLabel="Add citizenship"
                      onAction={addCitizenship}
                    />
                  ) : (
                    <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: "#F8FAFC" }}>
                      <div className="text-[12px] text-[#64748B] tracking-wider" style={{ fontWeight: 600 }}>
                        Citizenships
                      </div>
                      {formData.citizenships.map((cit, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-xl p-3" style={{ backgroundColor: "white", boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)" }}>
                          <select
                            value={cit.country}
                            onChange={(e) => updateCitizenship(i, { country: e.target.value })}
                            className={selectFlexClass}
                          >
                            <option value="">Select country...</option>
                            {COUNTRY_OPTIONS.map((c) => (
                              <option key={c} value={c}>{COUNTRY_FLAG_MAP[c] ? `${COUNTRY_FLAG_MAP[c]} ${c}` : c}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => updateCitizenship(i, { isPrimary: !cit.isPrimary })}
                            className={`relative inline-flex items-center h-6 w-11 rounded-full shrink-0 cursor-pointer transition-colors duration-200 ${
                              cit.isPrimary ? "bg-[#007FFF]" : "bg-[#E2E8F0]"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
                                cit.isPrimary ? "translate-x-[22px]" : "translate-x-1"
                              }`}
                            />
                          </button>
                          <span className="text-[11.5px] shrink-0" style={{ fontWeight: 500, color: cit.isPrimary ? "#007FFF" : "#94A3B8" }}>
                            Primary
                          </span>
                          <RemoveButton onClick={() => removeCitizenship(i)} />
                        </div>
                      ))}
                      <AddButton label="Add Citizenship" onClick={addCitizenship} />
                    </div>
                  )}
                </SectionCard>
              </div>

              {/* ── Personal Preferences ── */}
              <div ref={(el) => { sectionRefs.current["preferences"] = el; }}>
                <SectionCard title="Personal Preferences" subtitle="Nickname, pronouns, and spoken languages">
                  <div className="space-y-6">
                    {/* Identity group */}
                    <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "#F8FAFC" }}>
                      <div className="text-[12px] text-[#64748B] tracking-wider" style={{ fontWeight: 600 }}>
                        Identity
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <SectionLabel>Preferred Name / Nickname</SectionLabel>
                          <input
                            type="text"
                            value={formData.nickname}
                            onChange={(e) => handleFieldChange("nickname", e.target.value)}
                            placeholder="e.g. Johnny"
                            className={inputClass}
                          />
                          <p className="text-[11px] text-[#64748B] mt-1" style={{ fontWeight: 400 }}>
                            How this person prefers to be addressed.
                          </p>
                        </div>
                        <div>
                          <SectionLabel>Pronouns</SectionLabel>
                          <select
                            value={formData.pronouns}
                            onChange={(e) => handleFieldChange("pronouns", e.target.value)}
                            className={selectClass}
                          >
                            <option value="">Select pronouns...</option>
                            {PRONOUN_OPTIONS.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Languages */}
                    {formData.languages.length === 0 ? (
                      <EmptyState
                        icon={Languages}
                        title="No Languages Added"
                        description="Languages help teammates communicate effectively and connect across global offices and time zones."
                        actionLabel="Add language"
                        onAction={addLanguage}
                      />
                    ) : (
                      <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: "#F8FAFC" }}>
                        <div className="text-[12px] text-[#64748B] tracking-wider" style={{ fontWeight: 600 }}>
                          Languages
                        </div>
                        {formData.languages.map((entry, i) => (
                          <div key={i} className="flex items-center gap-2 min-w-0 rounded-xl p-3" style={{ backgroundColor: "white", boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.04)" }}>
                            <div className="flex-1 min-w-0">
                              <select
                                value={entry.language}
                                onChange={(e) => updateLanguage(i, { language: e.target.value })}
                                className={selectClass}
                              >
                                <option value="">Select language...</option>
                                {LANGUAGE_OPTIONS.map((lang) => (
                                  <option key={lang.name} value={lang.name}>
                                    {lang.flag} {lang.name} ({lang.native})
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="w-[160px] shrink-0">
                              <select
                                value={entry.proficiency}
                                onChange={(e) => updateLanguage(i, { proficiency: e.target.value })}
                                className={selectClass}
                              >
                                {PROFICIENCY_OPTIONS.map((p) => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                              </select>
                            </div>
                            <RemoveButton onClick={() => removeLanguage(i)} />
                          </div>
                        ))}
                        <AddButton label="Add Language" onClick={addLanguage} />
                      </div>
                    )}
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Discard Dialog ─── */}
      {showDiscardDialog && (
        <DiscardDialog
          changeCount={changeCount}
          onKeepEditing={() => setShowDiscardDialog(false)}
          onDiscard={handleDiscard}
        />
      )}
    </div>
  );
}

/* ── Section Card ── */
function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden"
      style={{ boxShadow: "0 1px 3px 0 rgba(15,23,42,0.04), 0 1px 2px -1px rgba(15,23,42,0.04)" }}
    >
      <div className="px-6 pt-5 pb-4 border-b border-[#F1F5F9]">
        <h2 className="text-[15px]" style={{ fontWeight: 650, color: "#0F172A" }}>
          {title}
        </h2>
        <p className="text-[12.5px] mt-0.5" style={{ color: "#94A3B8", fontWeight: 400 }}>
          {subtitle}
        </p>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}
