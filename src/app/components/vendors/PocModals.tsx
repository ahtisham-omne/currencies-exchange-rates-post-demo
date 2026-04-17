import React, { useState, useCallback, useRef } from "react";
import { PocDataTable } from "./PocDataTable";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Search,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Maximize2,
  Minimize2,
  Users,
  UserPlus,
  Phone,
  PhoneCall,
  Mail,
  Globe,
  Briefcase,
  Building2,
  Smartphone,
  Hash,
  Camera,
  Linkedin,
  ChevronDown,
  Twitter,
  Trash2,
  Sparkles,
} from "lucide-react";
import { Textarea } from "../ui/textarea";
import type { ContactPerson } from "./partnerConstants";

const POC_PER_PAGE = 20;

const DEPT_COLORS: Record<string, { bg: string; text: string; accent: string; border: string }> = {
  "Sales": { bg: "#F0F4FF", text: "#3B6FC2", accent: "#4B83DB", border: "#D6E2F5" },
  "Supply Chain Management": { bg: "#ECFDF5", text: "#1B7A52", accent: "#34B77A", border: "#C6F0DA" },
  "Finance": { bg: "#FFF8ED", text: "#B05E10", accent: "#E58E2A", border: "#FADCB0" },
};

const AVATAR_TINTS: Record<string, { bg: string; text: string }> = {
  "#0A77FF": { bg: "#EBF3FF", text: "#0A77FF" },
  "#7C3AED": { bg: "#F0EBFF", text: "#7C3AED" },
  "#059669": { bg: "#E8FAF3", text: "#059669" },
  "#D97706": { bg: "#FEF5E7", text: "#B45D04" },
};

function getAvatarTint(color: string) {
  return AVATAR_TINTS[color] || { bg: "#F0F4FF", text: color };
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.trim().length === 0) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-transparent px-0.5 rounded-sm" style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}>{part}</mark>
    ) : (
      part
    )
  );
}

// ═══════════════════════════════════════════════════
// POC Section UI — shared between location + partner
// ═══════════════════════════════════════════════════

interface PocSectionProps {
  selectedContacts: ContactPerson[];
  onRemove: (id: string) => void;
  onOpenSelect: () => void;
  onOpenCreate: () => void;
  emptyDescription: string;
  isGlobal?: boolean;
}

export function PocSectionContent({
  selectedContacts,
  onRemove,
  onOpenSelect,
  onOpenCreate,
  emptyDescription,
  isGlobal,
}: PocSectionProps) {
  return (
    <div className="px-3 sm:px-4 py-3 sm:py-4">
      {selectedContacts.length > 0 ? (
        <div className="space-y-3">
          {/* Header row: count + actions */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0A77FF]/8 border border-[#0A77FF]/12">
                {isGlobal ? <Globe className="w-3 h-3 text-[#0A77FF]" /> : <Users className="w-3 h-3 text-[#0A77FF]" />}
                <span className="text-[11px] text-[#0A77FF]" style={{ fontWeight: 700 }}>
                  {selectedContacts.length}
                </span>
              </div>
              <span className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>
                {isGlobal ? "global " : ""}contact{selectedContacts.length !== 1 ? "s" : ""} assigned
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenSelect}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-[#0A77FF] hover:bg-[#EDF4FF] transition-colors cursor-pointer"
                style={{ fontWeight: 600 }}
              >
                <Users className="w-3 h-3" />
                <span className="hidden min-[480px]:inline">Contact Directory</span>
              </button>
              <div className="w-px h-4 bg-[#E2E8F0]" />
              <button
                onClick={onOpenCreate}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-[#334155] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                style={{ fontWeight: 600 }}
              >
                <Plus className="w-3 h-3" />
                <span className="hidden min-[480px]:inline">New</span>
              </button>
            </div>
          </div>

          {/* Contact cards — standardized design */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {selectedContacts.map((contact) => {
              const at = getAvatarTint(contact.avatarColor);
              return (
                <div key={contact.id} className="group relative rounded-xl border border-[#E8ECF1] bg-white transition-all duration-200 hover:border-[#BFDBFE] hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)] overflow-hidden">
                  <button onClick={() => onRemove(contact.id)} className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white border border-[#F1F5F9] text-[#94A3B8] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-[#FEF2F2] hover:text-[#EF4444] hover:border-[#FECACA] shadow-sm cursor-pointer z-10"><X className="w-3 h-3" /></button>
                  <div className="p-3.5">
                    <div className="flex items-center gap-3 pr-6">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[10px] shrink-0" style={{ backgroundColor: at.bg, color: at.text, fontWeight: 700 }}>{getInitials(contact.name)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}>{contact.name}</p>
                        <p className="text-[11px] text-[#334155] truncate" style={{ fontWeight: 500 }}>{contact.department === "Supply Chain Management" ? "Supply Chain" : contact.department} <span className="text-[#CBD5E1]">·</span> <span className="text-[#94A3B8]" style={{ fontWeight: 400 }}>{contact.company}</span></p>
                      </div>
                      <span className="inline-flex items-center text-[10px] px-2 py-[2px] rounded-full border shrink-0" style={{ fontWeight: 500, backgroundColor: "#ECFDF5", color: "#065F46", borderColor: "#A7F3D0" }}>Active</span>
                    </div>
                    <div className="mt-2.5 pt-2.5 border-t border-[#F1F5F9] space-y-1">
                      <div className="flex items-center gap-2 text-[11px] text-[#475569]"><Mail className="w-3 h-3 text-[#94A3B8] shrink-0" /><span className="truncate">{contact.email}</span></div>
                      <div className="flex items-center gap-2 text-[11px] text-[#475569]"><Phone className="w-3 h-3 text-[#94A3B8] shrink-0" /><span>{contact.phone}</span></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[#64748B] leading-relaxed">
            {emptyDescription}
          </p>
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-2.5">
            <button
              onClick={onOpenSelect}
              className="group relative rounded-xl border border-[#E2E8F0] bg-white p-4 text-left transition-all duration-200 hover:border-[#BFDBFE] hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.15)] cursor-pointer overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#EDF4FF]/0 to-[#EDF4FF]/0 group-hover:from-[#EDF4FF]/60 group-hover:to-transparent transition-all duration-300 pointer-events-none" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EDF4FF] to-[#DBEAFE] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-200">
                  <Users className="w-5 h-5 text-[#0A77FF]" />
                </div>
                <p className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>Select from Contact Directory</p>
                <p className="text-[11px] text-[#94A3B8] mt-1 leading-relaxed">
                  Browse and pick from your saved contacts with search and filters.
                </p>
              </div>
            </button>
            <button
              onClick={onOpenCreate}
              className="group relative rounded-xl border border-[#E2E8F0] bg-white p-4 text-left transition-all duration-200 hover:border-[#D5D3EC] hover:shadow-[0_4px_16px_-4px_rgba(124,58,237,0.12)] cursor-pointer overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#F5F3FF]/0 to-[#F5F3FF]/0 group-hover:from-[#F5F3FF]/60 group-hover:to-transparent transition-all duration-300 pointer-events-none" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-200">
                  <UserPlus className="w-5 h-5 text-[#7C3AED]" />
                </div>
                <p className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>Create new contact</p>
                <p className="text-[11px] text-[#94A3B8] mt-1 leading-relaxed">
                  Add a brand-new point of contact directly from here.
                </p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Select from Dictionary Modal
// ═══════════════════════════════════════════════════

interface SelectPocDictionaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactDictionary: ContactPerson[];
  pocSearch: string;
  onPocSearchChange: (val: string) => void;
  pocCategoryFilter: "all" | "Sales" | "Supply Chain Management" | "Finance";
  onPocCategoryFilterChange: (val: "all" | "Sales" | "Supply Chain Management" | "Finance") => void;
  pocDepartmentCounts: Record<string, number>;
  pocPagedContacts: ContactPerson[];
  pocPage: number;
  pocTotalPages: number;
  onPocPageChange: (page: number) => void;
  pocTempSelected: Set<string>;
  onTogglePocTemp: (id: string) => void;
  onConfirm: () => void;
  onOpenCreatePoc: () => void;
  contextLabel: string;
}

export function SelectPocDictionaryModal({
  open,
  onOpenChange,
  contactDictionary,
  pocSearch,
  onPocSearchChange,
  pocCategoryFilter,
  onPocCategoryFilterChange,
  pocDepartmentCounts,
  pocPagedContacts,
  pocPage,
  pocTotalPages,
  onPocPageChange,
  pocTempSelected,
  onTogglePocTemp,
  onConfirm,
  onOpenCreatePoc,
  contextLabel,
}: SelectPocDictionaryModalProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);

  const handleSelectAll = useCallback((ids: string[]) => {
    const allSelected = ids.every((id) => pocTempSelected.has(id));
    if (allSelected) {
      ids.forEach((id) => onTogglePocTemp(id));
    } else {
      ids.filter((id) => !pocTempSelected.has(id)).forEach((id) => onTogglePocTemp(id));
    }
  }, [pocTempSelected, onTogglePocTemp]);

  const modalBaseClass =
    "!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";
  const modalSizeClass = isFullScreen
    ? `${modalBaseClass} !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl`
    : `${modalBaseClass} !max-w-[100%] sm:!max-w-[960px] lg:!max-w-[1040px] !max-h-[100dvh] sm:!max-h-[88vh] rounded-none sm:!rounded-2xl`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`flex flex-col p-0 gap-0 border-0 sm:border ${modalSizeClass}`}
        hideCloseButton
        overlayClassName="z-[205]"
        style={{ zIndex: 210, boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
      >
        <DialogTitle className="sr-only">Select point of contact</DialogTitle>
        <DialogDescription className="sr-only">Choose contacts from the contact directory to associate with {contextLabel}.</DialogDescription>

        {/* Header */}
        <div className="px-5 pt-4 pb-3 shrink-0 border-b border-[#E2E8F0] bg-white rounded-t-none sm:rounded-t-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[15px] sm:text-[17px] text-[#0F172A]" style={{ fontWeight: 700 }}>
                Select Point of Contact
              </h2>
              <p className="text-[12px] text-[#64748B] mt-0.5" style={{ fontWeight: 400 }}>
                Choose from your saved contacts or create a new one to assign to {contextLabel}.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {isFullScreen ? "Exit full" : "Full view"}
              </button>
              <button onClick={() => onOpenChange(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-all cursor-pointer">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>

        {/* PocDataTable — full-width edge-to-edge */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <PocDataTable
            contacts={pocPagedContacts}
            selectedIds={pocTempSelected}
            onToggleSelect={onTogglePocTemp}
            onSelectAll={handleSelectAll}
            searchQuery={pocSearch}
            onSearchChange={onPocSearchChange}
            categoryFilter={pocCategoryFilter}
            onCategoryFilterChange={onPocCategoryFilterChange}
            page={pocPage}
            totalPages={pocTotalPages}
            onPageChange={onPocPageChange}
            totalCount={contactDictionary.length}
            perPage={POC_PER_PAGE}
            onCreateNew={onOpenCreatePoc}
            selectable
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#E2E8F0] bg-white rounded-b-none sm:rounded-b-2xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0A77FF]/8 border border-[#0A77FF]/12">
              <Users className="w-3 h-3 text-[#0A77FF]" />
              <span className="text-[11px] text-[#0A77FF]" style={{ fontWeight: 700 }}>{pocTempSelected.size}</span>
            </div>
            <span className="text-[13px] text-[#64748B]" style={{ fontWeight: 500 }}>selected</span>
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={() => onOpenChange(false)} className="px-4 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-[#334155] hover:bg-[#F8FAFC] transition-colors cursor-pointer" style={{ fontWeight: 500 }}>Cancel</button>
            <button onClick={onConfirm} className="px-5 py-2 rounded-lg bg-[#0A77FF] text-[13px] text-white hover:bg-[#0960D9] transition-colors shadow-sm cursor-pointer" style={{ fontWeight: 600 }}>Confirm Selection</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════
// Create New POC Modal
// ═══════════════════════════════════════════════════

// Country code data for phone selectors
const COUNTRY_CODES = [
  { code: "+1", flag: "\u{1F1FA}\u{1F1F8}", label: "US" },
  { code: "+44", flag: "\u{1F1EC}\u{1F1E7}", label: "UK" },
  { code: "+91", flag: "\u{1F1EE}\u{1F1F3}", label: "IN" },
  { code: "+49", flag: "\u{1F1E9}\u{1F1EA}", label: "DE" },
  { code: "+33", flag: "\u{1F1EB}\u{1F1F7}", label: "FR" },
  { code: "+81", flag: "\u{1F1EF}\u{1F1F5}", label: "JP" },
  { code: "+86", flag: "\u{1F1E8}\u{1F1F3}", label: "CN" },
  { code: "+61", flag: "\u{1F1E6}\u{1F1FA}", label: "AU" },
  { code: "+971", flag: "\u{1F1E6}\u{1F1EA}", label: "AE" },
  { code: "+966", flag: "\u{1F1F8}\u{1F1E6}", label: "SA" },
];

function getCountryFlag(code: string) {
  return COUNTRY_CODES.find((c) => c.code === code)?.flag || "\u{1F1FA}\u{1F1F8}";
}

// Department tint colors for the avatar preview
const DEPT_AVATAR_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  "Sales": { bg: "#EBF3FF", text: "#0A77FF", ring: "#BFDBFE" },
  "Supply Chain Management": { bg: "#E8FAF3", text: "#059669", ring: "#A7F3D0" },
  "Finance": { bg: "#FEF5E7", text: "#D97706", ring: "#FDE68A" },
};

// ── Phone/Email row types ──
type PhoneRow = { id: string; type: string; code: string; number: string; ext: string };
type EmailRow = { id: string; type: string; address: string };
type SocialRow = { id: string; type: string; url: string };

const PHONE_TYPES = ["Office", "Mobile", "Landline", "Fax", "Other"];
const EMAIL_TYPES = ["Work", "Personal", "Secondary", "Other"];
const SOCIAL_TYPES = ["LinkedIn", "Twitter / X", "Website", "Skype", "WhatsApp", "Other"];
const DEFAULT_DEPARTMENTS = ["Sales", "Supply Chain Management", "Finance", "Operations", "Engineering", "Human Resources", "Legal", "Marketing", "IT", "Quality Assurance", "Logistics", "Procurement"];

interface CreatePocModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextName?: string;
  newPocName: string;
  onNewPocNameChange: (val: string) => void;
  newPocDepartment: string;
  onNewPocDepartmentChange: (val: string) => void;
  newPocRole: string;
  onNewPocRoleChange: (val: string) => void;
  newPocLandline: string;
  onNewPocLandlineChange: (val: string) => void;
  newPocLandlineCode: string;
  onNewPocLandlineCodeChange: (val: string) => void;
  newPocExt: string;
  onNewPocExtChange: (val: string) => void;
  newPocMobile: string;
  onNewPocMobileChange: (val: string) => void;
  newPocMobileCode: string;
  onNewPocMobileCodeChange: (val: string) => void;
  newPocEmail: string;
  onNewPocEmailChange: (val: string) => void;
  saveAndCreateAnother: boolean;
  onSaveAndCreateAnotherChange: (val: boolean) => void;
  onSave: () => void;
}

export function CreatePocModal({
  open, onOpenChange, contextName,
  newPocName, onNewPocNameChange, newPocDepartment, onNewPocDepartmentChange,
  newPocRole, onNewPocRoleChange,
  newPocLandline, onNewPocLandlineChange, newPocLandlineCode, onNewPocLandlineCodeChange,
  newPocExt, onNewPocExtChange, newPocMobile, onNewPocMobileChange,
  newPocMobileCode, onNewPocMobileCodeChange, newPocEmail, onNewPocEmailChange,
  saveAndCreateAnother, onSaveAndCreateAnotherChange, onSave,
}: CreatePocModalProps) {
  // Internal state for new fields
  const profileInputRef = useRef<HTMLInputElement>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [company, setCompany] = useState(contextName || "");
  const [notes, setNotes] = useState("");
  const [phoneRows, setPhoneRows] = useState<PhoneRow[]>([{ id: "ph-1", type: "Office", code: newPocLandlineCode, number: "", ext: "" }]);
  const [emailRows, setEmailRows] = useState<EmailRow[]>([{ id: "em-1", type: "Work", address: "" }]);
  const [socialRows, setSocialRows] = useState<SocialRow[]>([{ id: "sc-1", type: "LinkedIn", url: "" }]);
  const [deptSearch, setDeptSearch] = useState("");
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const [customDepts, setCustomDepts] = useState<string[]>([]);

  // Reset internal state when modal opens
  React.useEffect(() => {
    if (open) {
      setProfileImage(null);
      setCompany(contextName || "");
      setNotes("");
      setPhoneRows([{ id: "ph-1", type: "Office", code: newPocLandlineCode || "+1", number: "", ext: "" }]);
      setEmailRows([{ id: "em-1", type: "Work", address: "" }]);
      setSocialRows([]);
      setDeptSearch("");
      setDeptDropdownOpen(false);
    }
  }, [open]);

  const allDepts = [...DEFAULT_DEPARTMENTS, ...customDepts];
  const filteredDepts = deptSearch ? allDepts.filter((d) => d.toLowerCase().includes(deptSearch.toLowerCase())) : allDepts;
  const canCreateDept = deptSearch.trim() && !allDepts.some((d) => d.toLowerCase() === deptSearch.trim().toLowerCase());

  const initials = newPocName.trim() ? getInitials(newPocName.trim()) : "";
  const deptAvatarColor = DEPT_AVATAR_COLORS[newPocDepartment] || { bg: "#F1F5F9", text: "#64748B", ring: "#E2E8F0" };
  const isValid = newPocName.trim().length > 0;

  // Sync first phone/email row back to parent props
  const handlePhoneChange = (idx: number, field: keyof PhoneRow, val: string) => {
    setPhoneRows((prev) => { const n = [...prev]; n[idx] = { ...n[idx], [field]: val }; return n; });
    if (idx === 0) {
      if (field === "number") onNewPocLandlineChange(val);
      if (field === "code") onNewPocLandlineCodeChange(val);
      if (field === "ext") onNewPocExtChange(val);
    }
    if (idx === 1 && field === "number") onNewPocMobileChange(val);
  };
  const handleEmailChange = (idx: number, val: string) => {
    setEmailRows((prev) => { const n = [...prev]; n[idx] = { ...n[idx], address: val }; return n; });
    if (idx === 0) onNewPocEmailChange(val);
  };

  const addPhoneRow = () => setPhoneRows((p) => [...p, { id: `ph-${Date.now()}`, type: "Mobile", code: "+1", number: "", ext: "" }]);
  const addEmailRow = () => setEmailRows((p) => [...p, { id: `em-${Date.now()}`, type: "Personal", address: "" }]);
  const addSocialRow = () => setSocialRows((p) => [...p, { id: `sc-${Date.now()}`, type: "Website", url: "" }]);
  const removePhoneRow = (id: string) => setPhoneRows((p) => p.filter((r) => r.id !== id));
  const removeEmailRow = (id: string) => setEmailRows((p) => p.filter((r) => r.id !== id));
  const removeSocialRow = (id: string) => setSocialRows((p) => p.filter((r) => r.id !== id));

  const inputCls = "h-10 rounded-lg border-[#E2E8F0] bg-white text-sm text-[#0F172A] placeholder:text-[#B8C4D0] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/15";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col p-0 gap-0 overflow-hidden sm:rounded-2xl border-0 sm:border z-[215]"
        hideCloseButton
        overlayClassName="z-[212] bg-black/50"
        style={{ maxWidth: 720, width: "calc(100% - 2rem)", maxHeight: "88vh", borderRadius: 16, boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
      >
        <DialogTitle className="sr-only">Create New Point of Contact</DialogTitle>
        <DialogDescription className="sr-only">Create a new contact</DialogDescription>

        {/* Header */}
        <div className="px-5 pt-4 pb-3 shrink-0 bg-white border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300"
                style={{ backgroundColor: initials ? deptAvatarColor.bg : "#F1F5F9", color: initials ? deptAvatarColor.text : "#94A3B8", fontWeight: 700, fontSize: 13 }}>
                {initials || <UserPlus className="w-4.5 h-4.5" />}
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] sm:text-[17px] text-[#0F172A]" style={{ fontWeight: 700 }}>Create New Contact</h2>
                <p className="text-[12px] text-[#64748B] mt-0.5">{contextName ? <>For <span className="text-[#0F172A]" style={{ fontWeight: 500 }}>{contextName}</span></> : "Add a new point of contact to the directory."}</p>
              </div>
            </div>
            <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors cursor-pointer shrink-0"><X className="w-4 h-4 text-[#94A3B8]" /></button>
          </div>
        </div>

        {/* Form body — matches partner creation form */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 pt-3 pb-4 bg-[#FAFBFC] scrollbar-hide space-y-3">

          {/* ── Contact Details — boxed card matching Partner Details ── */}
          <div className="rounded-lg border border-[#E2E8F0] bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center gap-2 bg-[#FAFBFC]">
              <div className="w-6 h-6 rounded-md bg-[#0A77FF]/8 flex items-center justify-center shrink-0"><Users className="w-3.5 h-3.5 text-[#0A77FF]" /></div>
              <span className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>Contact Details</span>
              <span className="text-[9px] sm:text-[10px] text-[#94A3B8] tracking-wider uppercase hidden min-[480px]:inline" style={{ fontWeight: 500 }}>Required</span>
            </div>
            <div className="px-2.5 sm:px-3 pt-2 sm:pt-2.5 pb-1.5 sm:pb-2">
              {/* Photo on left, fields in 2-col grid on right */}
              <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3 sm:gap-4">
                {/* Left — Profile Picture (full height) */}
                <div className="hidden sm:flex flex-col w-[120px]">
                  <input ref={profileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const reader = new FileReader(); reader.onload = (ev) => setProfileImage(ev.target?.result as string); reader.readAsDataURL(f); } e.target.value = ""; }} />
                  <div
                    onClick={() => profileInputRef.current?.click()}
                    className={`relative w-full h-full rounded-xl cursor-pointer group transition-all ${profileImage ? "ring-2 ring-[#E2E8F0] hover:ring-[#0A77FF]/30" : "border-2 border-dashed border-[#CBD5E1] hover:border-[#0A77FF]/50 bg-[#F8FAFC] hover:bg-[#EDF4FF]/50"}`}
                  >
                    {profileImage ? (
                      <>
                        <img src={profileImage} alt="" className="w-full h-full rounded-xl object-cover" />
                        <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </>
                    ) : initials ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                        <span className="text-[28px]" style={{ fontWeight: 700, color: deptAvatarColor.text }}>{initials}</span>
                        <span className="text-[9px] text-[#94A3B8] group-hover:text-[#0A77FF] transition-colors" style={{ fontWeight: 500 }}>Change photo</span>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                        <div className="w-10 h-10 rounded-lg bg-[#F1F5F9] group-hover:bg-[#EDF4FF] flex items-center justify-center transition-colors">
                          <Camera className="w-5 h-5 text-[#94A3B8] group-hover:text-[#0A77FF] transition-colors" />
                        </div>
                        <span className="text-[10px] text-[#94A3B8] group-hover:text-[#0A77FF] transition-colors" style={{ fontWeight: 500 }}>Upload photo</span>
                        <span className="text-[9px] text-[#CBD5E1]">Max 5 MB</span>
                      </div>
                    )}
                  </div>
                  {profileImage && (
                    <div className="flex items-center justify-center gap-2 mt-1.5">
                      <button type="button" onClick={() => profileInputRef.current?.click()} className="text-[10px] text-[#0A77FF] hover:text-[#0862D0] cursor-pointer" style={{ fontWeight: 500 }}>Change</button>
                      <span className="text-[#E2E8F0] text-[10px]">·</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setProfileImage(null); }} className="text-[10px] text-[#EF4444] hover:text-[#DC2626] cursor-pointer" style={{ fontWeight: 500 }}>Remove</button>
                    </div>
                  )}
                </div>
                {/* Right — fields in 2-col grid */}
                <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-2.5 sm:gap-y-3">
                  <div>
                    <label className="text-xs sm:text-[13px] text-[#0F172A] mb-1 block" style={{ fontWeight: 500 }}>Full Name<span className="text-[#EF4444]">*</span></label>
                    <Input value={newPocName} onChange={(e) => onNewPocNameChange(e.target.value)} placeholder="Enter full name" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs sm:text-[13px] text-[#0F172A] mb-1 block" style={{ fontWeight: 500 }}>Company</label>
                    <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company or organization" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs sm:text-[13px] text-[#0F172A] mb-1 block" style={{ fontWeight: 500 }}>Role / Title</label>
                    <Input value={newPocRole} onChange={(e) => onNewPocRoleChange(e.target.value)} placeholder="e.g. Procurement Manager" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs sm:text-[13px] text-[#0F172A] mb-1 block" style={{ fontWeight: 500 }}>Department</label>
                    <Popover open={deptDropdownOpen} onOpenChange={setDeptDropdownOpen}>
                      <PopoverTrigger asChild>
                        <button type="button" className="w-full h-10 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-left flex items-center justify-between hover:border-[#CBD5E1] transition-colors cursor-pointer">
                          <span className={newPocDepartment ? "text-[#0F172A]" : "text-[#B8C4D0]"}>{newPocDepartment || "Select department"}</span>
                          <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent side="bottom" align="start" sideOffset={4} className="w-[--radix-popover-trigger-width] p-0 z-[350] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E2E8F0]/80" onOpenAutoFocus={(e) => e.preventDefault()}>
                        {/* Search */}
                        <div className="p-2 border-b border-[#F1F5F9]">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
                            <input value={deptSearch} onChange={(e) => setDeptSearch(e.target.value)} placeholder="Search departments..." className="w-full h-8 pl-8 pr-3 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] text-[12px] focus:outline-none focus:border-[#0A77FF]" autoFocus />
                          </div>
                        </div>
                        {/* Options with search highlight */}
                        <div className="max-h-[200px] overflow-y-auto py-1">
                          {filteredDepts.map((d) => {
                            // Highlight matching text
                            let label: React.ReactNode = d;
                            if (deptSearch.trim()) {
                              const regex = new RegExp(`(${deptSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
                              const parts = d.split(regex);
                              if (parts.length > 1) {
                                label = parts.map((p, i) => regex.test(p) ? <mark key={i} className="bg-transparent px-0.5 rounded-sm" style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}>{p}</mark> : <React.Fragment key={i}>{p}</React.Fragment>);
                              }
                            }
                            return (
                              <button key={d} type="button" onClick={() => { onNewPocDepartmentChange(d as any); setDeptDropdownOpen(false); setDeptSearch(""); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] transition-colors ${newPocDepartment === d ? "bg-[#EDF4FF]/50 text-[#0A77FF]" : "text-[#334155] hover:bg-[#F8FAFC]"}`}
                                style={{ fontWeight: newPocDepartment === d ? 600 : 400 }}>
                                <span className="flex-1">{label}</span>
                                {newPocDepartment === d && <Check className="w-3.5 h-3.5 text-[#0A77FF] shrink-0" />}
                              </button>
                            );
                          })}
                          {filteredDepts.length === 0 && (
                            <p className="px-3 py-3 text-[12px] text-[#94A3B8] text-center">No departments found</p>
                          )}
                        </div>
                        {/* Permanent create new CTA */}
                        <div className="border-t border-[#F1F5F9] p-2">
                          <button type="button" onClick={() => {
                            if (deptSearch.trim() && canCreateDept) {
                              const newDept = deptSearch.trim();
                              setCustomDepts((p) => [...p, newDept]);
                              onNewPocDepartmentChange(newDept as any);
                              setDeptSearch("");
                            }
                            setDeptDropdownOpen(false);
                          }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-[#0A77FF] hover:bg-[#EDF4FF] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                            <Plus className="w-3.5 h-3.5" />{canCreateDept ? <>Create "{deptSearch.trim()}"</> : "Create new department"}
                          </button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Phone Numbers — boxed card ── */}
          <div className="rounded-lg border border-[#E2E8F0] bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center justify-between bg-[#FAFBFC]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#ECFDF5] flex items-center justify-center shrink-0"><Phone className="w-3.5 h-3.5 text-[#059669]" /></div>
                <span className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>Phone Numbers</span>
              </div>
              <button type="button" onClick={addPhoneRow} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-[#0A77FF] hover:bg-[#EDF4FF] border border-transparent hover:border-[#0A77FF]/15 transition-all cursor-pointer" style={{ fontWeight: 600 }}><Plus className="w-3 h-3" />Add another number</button>
            </div>
            <div className="px-3 sm:px-4 py-2.5 space-y-2">
              {phoneRows.map((row, idx) => (
                <div key={row.id} className="flex items-center gap-2">
                  <Select value={row.type} onValueChange={(v) => { setPhoneRows((p) => { const n = [...p]; n[idx] = { ...n[idx], type: v }; return n; }); }}>
                    <SelectTrigger className="!h-10 rounded-lg border-[#E2E8F0] text-xs w-[90px] shrink-0 [&>svg]:text-[#94A3B8]"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[350]">{PHONE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex items-center rounded-lg border border-[#E2E8F0] bg-white overflow-hidden h-10 flex-1 min-w-0 hover:border-[#CBD5E1] transition-colors">
                    <Select value={row.code} onValueChange={(v) => handlePhoneChange(idx, "code", v)}>
                      <SelectTrigger className="h-full border-0 border-r border-[#E2E8F0] rounded-none bg-[#FAFBFC] px-2 text-xs w-[68px] shrink-0 shadow-none focus:ring-0"><span className="text-[11px]">{getCountryFlag(row.code)} {row.code}</span></SelectTrigger>
                      <SelectContent className="z-[350]">{COUNTRY_CODES.map((cc) => <SelectItem key={cc.code} value={cc.code}><span className="flex items-center gap-1"><span>{cc.flag}</span>{cc.code}</span></SelectItem>)}</SelectContent>
                    </Select>
                    <input value={row.number} onChange={(e) => handlePhoneChange(idx, "number", e.target.value)} placeholder="Phone number" className="flex-1 h-full px-2.5 text-sm text-[#0F172A] outline-none bg-transparent placeholder:text-[#B8C4D0]" />
                  </div>
                  {(row.type === "Office" || row.type === "Landline") && <Input value={row.ext} onChange={(e) => handlePhoneChange(idx, "ext", e.target.value)} placeholder="Ext." className={`w-[70px] shrink-0 ${inputCls}`} />}
                  {phoneRows.length > 1 && <button onClick={() => removePhoneRow(row.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#CBD5E1] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors cursor-pointer shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              ))}
            </div>
          </div>

          {/* ── Email Addresses — boxed card ── */}
          <div className="rounded-lg border border-[#E2E8F0] bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center justify-between bg-[#FAFBFC]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#EFF6FF] flex items-center justify-center shrink-0"><Mail className="w-3.5 h-3.5 text-[#0A77FF]" /></div>
                <span className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>Email Addresses</span>
              </div>
              <button type="button" onClick={addEmailRow} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-[#0A77FF] hover:bg-[#EDF4FF] border border-transparent hover:border-[#0A77FF]/15 transition-all cursor-pointer" style={{ fontWeight: 600 }}><Plus className="w-3 h-3" />Add another email</button>
            </div>
            <div className="px-3 sm:px-4 py-2.5 space-y-2">
              {emailRows.map((row, idx) => (
                <div key={row.id} className="flex items-center gap-2">
                  <Select value={row.type} onValueChange={(v) => { setEmailRows((p) => { const n = [...p]; n[idx] = { ...n[idx], type: v }; return n; }); }}>
                    <SelectTrigger className="!h-10 rounded-lg border-[#E2E8F0] text-xs w-[100px] shrink-0 [&>svg]:text-[#94A3B8]"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[350]">{EMAIL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={row.address} onChange={(e) => handleEmailChange(idx, e.target.value)} placeholder="name@company.com" type="email" className={`flex-1 ${inputCls}`} />
                  {emailRows.length > 1 && <button onClick={() => removeEmailRow(row.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#CBD5E1] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors cursor-pointer shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              ))}
            </div>
          </div>

          {/* ── Social Profiles — dynamic rows like phone/email ── */}
          <div className="rounded-lg border border-[#E2E8F0] bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center justify-between bg-[#FAFBFC]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#F5F3FF] flex items-center justify-center shrink-0"><Globe className="w-3.5 h-3.5 text-[#7C3AED]" /></div>
                <span className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>Social Profiles</span>
              </div>
              <button type="button" onClick={addSocialRow} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-[#0A77FF] hover:bg-[#EDF4FF] border border-transparent hover:border-[#0A77FF]/15 transition-all cursor-pointer" style={{ fontWeight: 600 }}><Plus className="w-3 h-3" />Add social profile</button>
            </div>
            <div className="px-3 sm:px-4 py-2.5 space-y-2">
              {socialRows.map((row, idx) => (
                <div key={row.id} className="flex items-center gap-2">
                  <Select value={row.type} onValueChange={(v) => { setSocialRows((p) => { const n = [...p]; n[idx] = { ...n[idx], type: v }; return n; }); }}>
                    <SelectTrigger className="!h-10 rounded-lg border-[#E2E8F0] text-xs w-[110px] shrink-0 [&>svg]:text-[#94A3B8]"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[350]">{SOCIAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={row.url} onChange={(e) => { setSocialRows((p) => { const n = [...p]; n[idx] = { ...n[idx], url: e.target.value }; return n; }); }}
                    placeholder={row.type === "LinkedIn" ? "linkedin.com/in/username" : row.type === "Twitter / X" ? "@username" : row.type === "WhatsApp" ? "+1 555-123-4567" : "https://example.com"}
                    className={`flex-1 ${inputCls}`} />
                  {socialRows.length > 1 && <button onClick={() => removeSocialRow(row.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#CBD5E1] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors cursor-pointer shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border bg-white px-5 py-3 flex items-center justify-between sm:rounded-b-2xl">
          <button onClick={() => onSaveAndCreateAnotherChange(!saveAndCreateAnother)} className="flex items-center gap-2 cursor-pointer select-none group/check">
            <div className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-all duration-150 ${saveAndCreateAnother ? "bg-[#0A77FF] border-[#0A77FF]" : "border-[#CBD5E1] bg-white group-hover/check:border-[#94A3B8]"}`}>
              {saveAndCreateAnother && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
            </div>
            <span className="text-[13px] text-[#475569] group-hover/check:text-[#334155] transition-colors" style={{ fontWeight: 500 }}>Save and create another</span>
          </button>
          <div className="flex items-center gap-2.5">
            <button onClick={() => onOpenChange(false)} className="px-4 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-[#334155] hover:bg-[#F8FAFC] transition-colors cursor-pointer" style={{ fontWeight: 500 }}>Discard</button>
            <button onClick={onSave} disabled={!isValid}
              className={`px-5 py-2 rounded-lg text-[13px] text-white transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5 ${isValid ? "bg-[#0A77FF] hover:bg-[#0960D9]" : "bg-[#0A77FF]/40 cursor-not-allowed"}`}
              style={{ fontWeight: 600 }}>
              Save Contact
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}