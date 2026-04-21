import React, { useState, useCallback, useRef } from "react";
import { ContactsDirectoryPage } from "../../pages/ContactsDirectoryPage";
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
  Paperclip,
  Upload,
} from "lucide-react";
import { Textarea } from "../ui/textarea";
import type { ContactPerson } from "./partnerConstants";
import { useVendors } from "../../context/VendorContext";

const POC_PER_PAGE = 20;

const DEPT_COLORS: Record<string, { bg: string; text: string; accent: string; border: string }> = {
  "Sales": { bg: "#F0F4FF", text: "#3B6FC2", accent: "#4B83DB", border: "#D6E2F5" },
  "Supply Chain Management": { bg: "#ECFDF5", text: "#1B7A52", accent: "#34B77A", border: "#C6F0DA" },
  "Finance": { bg: "#FFF8ED", text: "#B05E10", accent: "#E58E2A", border: "#FADCB0" },
};

const AVATAR_TINTS: Record<string, { bg: string; text: string }> = {
  "hsl(var(--primary))": { bg: "#EBF3FF", text: "hsl(var(--primary))" },
  "hsl(var(--violet))": { bg: "#F0EBFF", text: "hsl(var(--violet))" },
  "hsl(var(--success))": { bg: "#E8FAF3", text: "hsl(var(--success))" },
  "hsl(var(--warning))": { bg: "#FEF5E7", text: "#B45D04" },
};

function getAvatarTint(color: string) {
  return AVATAR_TINTS[color] || { bg: "#F0F4FF", text: color };
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

/* ─── Named-avatar lookup, mirrors ContactsDirectoryPage ─── */
const PERSON_PHOTOS: Record<string, string> = {
  "Sarah": "https://randomuser.me/api/portraits/women/44.jpg",
  "Michael": "https://randomuser.me/api/portraits/men/32.jpg",
  "Emily": "https://randomuser.me/api/portraits/women/65.jpg",
  "David": "https://randomuser.me/api/portraits/men/75.jpg",
  "Rachel": "https://randomuser.me/api/portraits/women/28.jpg",
  "James": "https://randomuser.me/api/portraits/men/46.jpg",
  "Lisa": "https://randomuser.me/api/portraits/women/17.jpg",
  "Robert": "https://randomuser.me/api/portraits/men/22.jpg",
  "Amanda": "https://randomuser.me/api/portraits/women/56.jpg",
  "Kevin": "https://randomuser.me/api/portraits/men/64.jpg",
  "Maria": "https://randomuser.me/api/portraits/women/33.jpg",
  "Chris": "https://randomuser.me/api/portraits/men/85.jpg",
  "Jessica": "https://randomuser.me/api/portraits/women/91.jpg",
  "Andrew": "https://randomuser.me/api/portraits/men/41.jpg",
  "Nicole": "https://randomuser.me/api/portraits/women/72.jpg",
  "Thomas": "https://randomuser.me/api/portraits/men/55.jpg",
  "Stephanie": "https://randomuser.me/api/portraits/women/15.jpg",
  "Daniel": "https://randomuser.me/api/portraits/men/18.jpg",
  "Karen": "https://randomuser.me/api/portraits/women/48.jpg",
  "Brian": "https://randomuser.me/api/portraits/men/67.jpg",
};

function getPocPhoto(name: string): string {
  const firstName = name.split(" ")[0];
  if (PERSON_PHOTOS[firstName]) return PERSON_PHOTOS[firstName];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const a = Math.abs(hash);
  return `https://randomuser.me/api/portraits/${a % 2 === 0 ? "men" : "women"}/${(a % 99) + 1}.jpg`;
}

/** Small circular photo thumbnail with initials fallback.
 *  Applies the cross-module "photo + name in table" pattern so contacts look
 *  consistent wherever they're rendered (Linked Partners, POC cards, etc.). */
function PocAvatarThumb({ name, tintBg, tintText, size = 36 }: { name: string; tintBg: string; tintText: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const photo = getPocPhoto(name);
  if (!photo || failed) {
    return (
      <div
        className="rounded-xl flex items-center justify-center text-[10px] shrink-0 overflow-hidden"
        style={{ width: size, height: size, backgroundColor: tintBg, color: tintText, fontWeight: 700 }}
      >
        {getInitials(name)}
      </div>
    );
  }
  return (
    <div
      className="rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1]"
      style={{ width: size, height: size, backgroundColor: tintBg }}
    >
      <img src={photo} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
    </div>
  );
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
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/8 border border-primary/12">
                {isGlobal ? <Globe className="w-3 h-3 text-primary" /> : <Users className="w-3 h-3 text-primary" />}
                <span className="text-[11px] text-primary" style={{ fontWeight: 700 }}>
                  {selectedContacts.length}
                </span>
              </div>
              <span className="text-xs text-slate-500" style={{ fontWeight: 500 }}>
                {isGlobal ? "global " : ""}contact{selectedContacts.length !== 1 ? "s" : ""} assigned
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenSelect}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-primary hover:bg-accent transition-colors cursor-pointer"
                style={{ fontWeight: 600 }}
              >
                <Users className="w-3 h-3" />
                <span className="hidden min-[480px]:inline">Contact Directory</span>
              </button>
              <div className="w-px h-4 bg-border" />
              <button
                onClick={onOpenCreate}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-700 hover:bg-muted transition-colors cursor-pointer"
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
                <div key={contact.id} className="group relative rounded-xl border border-[#E8ECF1] bg-white transition-all duration-200 hover:border-blue-200 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)] overflow-hidden">
                  <button onClick={() => onRemove(contact.id)} className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white border border-muted text-slate-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 shadow-sm cursor-pointer z-10"><X className="w-3 h-3" /></button>
                  <div className="p-3.5">
                    <div className="flex items-center gap-3 pr-6">
                      <PocAvatarThumb name={contact.name} tintBg={at.bg} tintText={at.text} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{contact.name}</p>
                        <p className="text-[11px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{contact.department === "Supply Chain Management" ? "Supply Chain" : contact.department} <span className="text-slate-300">·</span> <span className="text-slate-400" style={{ fontWeight: 400 }}>{contact.company}</span></p>
                      </div>
                      <span className="inline-flex items-center text-[10px] px-2 py-[2px] rounded-full border shrink-0" style={{ fontWeight: 500, backgroundColor: "#ECFDF5", color: "#065F46", borderColor: "#A7F3D0" }}>Active</span>
                    </div>
                    <div className="mt-2.5 pt-2.5 border-t border-muted space-y-1">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Mail className="w-3 h-3 text-slate-400 shrink-0" /><span className="truncate">{contact.email}</span></div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Phone className="w-3 h-3 text-slate-400 shrink-0" /><span>{contact.phone}</span></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 leading-relaxed">
            {emptyDescription}
          </p>
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-2.5">
            <button
              onClick={onOpenSelect}
              className="group relative rounded-xl border border-border bg-white p-4 text-left transition-all duration-200 hover:border-blue-200 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.15)] cursor-pointer overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent/0 to-accent/0 group-hover:from-accent/60 group-hover:to-transparent transition-all duration-300 pointer-events-none" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-blue-100 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-200">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Select from Contact Directory</p>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Browse and pick from your saved contacts with search and filters.
                </p>
              </div>
            </button>
            <button
              onClick={onOpenCreate}
              className="group relative rounded-xl border border-border bg-white p-4 text-left transition-all duration-200 hover:border-[#D5D3EC] hover:shadow-[0_4px_16px_-4px_rgba(124,58,237,0.12)] cursor-pointer overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-50/0 to-violet-50/0 group-hover:from-violet-50/60 group-hover:to-transparent transition-all duration-300 pointer-events-none" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-50 to-[#EDE9FE] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-200">
                  <UserPlus className="w-5 h-5 text-violet" />
                </div>
                <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Create new contact</p>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
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
  pocTempSelected,
  onTogglePocTemp,
  onConfirm,
  onOpenCreatePoc,
  contextLabel,
}: SelectPocDictionaryModalProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);

  /** Bridge: the embedded directory exposes selection as a Set<string>; convert
   *  the new set into per-id toggle calls so the existing parent state stays in sync. */
  const handleSelectionChange = useCallback((nextIds: Set<string>) => {
    const removed = [...pocTempSelected].filter((id) => !nextIds.has(id));
    const added = [...nextIds].filter((id) => !pocTempSelected.has(id));
    removed.forEach(onTogglePocTemp);
    added.forEach(onTogglePocTemp);
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
        <div className="px-5 pt-4 pb-3 shrink-0 border-b border-border bg-white rounded-t-none sm:rounded-t-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>
                Select Point of Contact
              </h2>
              <p className="text-[12px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                Choose from your saved contacts or create a new one to assign to {contextLabel}.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {isFullScreen ? "Exit full" : "Full view"}
              </button>
              <button onClick={() => onOpenChange(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Contacts Directory — embedded, full-width edge-to-edge */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          <ContactsDirectoryPage
            embedded
            embeddedContacts={contactDictionary}
            selectable
            selectedIds={pocTempSelected}
            onSelectionChange={handleSelectionChange}
            embeddedToolbarRight={
              <button
                type="button"
                onClick={onOpenCreatePoc}
                className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg bg-primary text-white shadow-sm hover:bg-[#0960D9] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                style={{ fontWeight: 500 }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="text-sm">Create New</span>
              </button>
            }
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-white rounded-b-none sm:rounded-b-2xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/8 border border-primary/12">
              <Users className="w-3 h-3 text-primary" />
              <span className="text-[11px] text-primary" style={{ fontWeight: 700 }}>{pocTempSelected.size}</span>
            </div>
            <span className="text-[13px] text-slate-500" style={{ fontWeight: 500 }}>selected</span>
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={() => onOpenChange(false)} className="px-4 py-2 rounded-lg border border-border bg-white text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer" style={{ fontWeight: 500 }}>Cancel</button>
            <button onClick={onConfirm} className="px-5 py-2 rounded-lg bg-primary text-[13px] text-white hover:bg-[#0960D9] transition-colors shadow-sm cursor-pointer" style={{ fontWeight: 600 }}>Confirm Selection</button>
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
  "Sales": { bg: "#EBF3FF", text: "hsl(var(--primary))", ring: "#BFDBFE" },
  "Supply Chain Management": { bg: "#E8FAF3", text: "hsl(var(--success))", ring: "#A7F3D0" },
  "Finance": { bg: "#FEF5E7", text: "hsl(var(--warning))", ring: "#FDE68A" },
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
  editMode?: boolean;
  editContactName?: string;
  editContact?: ContactPerson | null;
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
  open, onOpenChange, contextName, editMode, editContactName, editContact,
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
  /** When the company value resolves to a vendor in the directory, we track
   *  its id so downstream save can persist the relationship link. */
  const [companyVendorId, setCompanyVendorId] = useState<string | null>(null);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const { vendors } = useVendors();
  const [notes, setNotes] = useState("");
  const [phoneRows, setPhoneRows] = useState<PhoneRow[]>([{ id: "ph-1", type: "Office", code: newPocLandlineCode, number: "", ext: "" }]);
  const [emailRows, setEmailRows] = useState<EmailRow[]>([{ id: "em-1", type: "Work", address: "" }]);
  const [socialRows, setSocialRows] = useState<SocialRow[]>([{ id: "sc-1", type: "LinkedIn", url: "" }]);
  const [deptSearch, setDeptSearch] = useState("");
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const [customDepts, setCustomDepts] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<{ id: string; name: string; size: string; type: string }[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const formatFileSize = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
  const handleFiles = (fileList: FileList | null) => { if (!fileList) return; setAttachedFiles((prev) => [...prev, ...Array.from(fileList).map((f) => ({ id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, name: f.name, size: formatFileSize(f.size), type: f.type }))]); };
  const getFileIcon = (type: string) => type.startsWith("image/") ? "🖼️" : type.includes("pdf") ? "📄" : type.includes("spreadsheet") || type.includes("excel") ? "📊" : type.includes("word") ? "📝" : "📎";

  // Reset/populate internal state when modal opens
  React.useEffect(() => {
    if (open) {
      setDeptSearch("");
      setDeptDropdownOpen(false);
      setAttachedFiles([]);

      if (editMode && editContact) {
        // Populate from contact data
        setProfileImage(editContact.profileImage || null);
        setCompany(editContact.company || "");
        // Match against existing partners to decide if this is a linked company
        // vs. a free-text one; downstream consumers use companyVendorId to
        // distinguish "linked to existing partner" from "ad-hoc company name".
        const matched = vendors.find(
          (v) => v.displayName === editContact.company || v.companyName === editContact.company
        );
        setCompanyVendorId(matched?.id || null);
        setNotes("");
        // Phones
        if (editContact.phones && editContact.phones.length > 0) {
          setPhoneRows(editContact.phones.map((p, i) => ({ id: `ph-${i + 1}`, type: p.type, code: p.code, number: p.number, ext: p.ext })));
        } else {
          setPhoneRows([{ id: "ph-1", type: "Office", code: "+1", number: editContact.phone || "", ext: editContact.phoneExt || "" },
            ...(editContact.secondaryPhone ? [{ id: "ph-2", type: "Mobile" as const, code: "+1", number: editContact.secondaryPhone, ext: editContact.secondaryPhoneExt || "" }] : [])
          ]);
        }
        // Emails
        if (editContact.emails && editContact.emails.length > 0) {
          setEmailRows(editContact.emails.map((e, i) => ({ id: `em-${i + 1}`, type: e.type, address: e.address })));
        } else {
          setEmailRows([{ id: "em-1", type: "Work", address: editContact.email || "" }]);
        }
        // Socials
        if (editContact.socials && editContact.socials.length > 0) {
          setSocialRows(editContact.socials.map((s, i) => ({ id: `sc-${i + 1}`, type: s.type, url: s.url })));
        } else {
          setSocialRows([{ id: "sc-1", type: "LinkedIn", url: "" }]);
        }
      } else {
        // Create mode — empty defaults
        setProfileImage(null);
        setCompany(contextName || "");
        // If the parent context passed a partner name, try to auto-link it to the vendor.
        const ctxMatch = contextName
          ? vendors.find((v) => v.displayName === contextName || v.companyName === contextName)
          : null;
        setCompanyVendorId(ctxMatch?.id || null);
        setNotes("");
        setPhoneRows([{ id: "ph-1", type: "Office", code: newPocLandlineCode || "+1", number: "", ext: "" }]);
        setEmailRows([{ id: "em-1", type: "Work", address: "" }]);
        setSocialRows([{ id: "sc-1", type: "LinkedIn", url: "" }]);
      }
    }
  }, [open]);

  const allDepts = [...DEFAULT_DEPARTMENTS, ...customDepts];
  const filteredDepts = deptSearch ? allDepts.filter((d) => d.toLowerCase().includes(deptSearch.toLowerCase())) : allDepts;
  const canCreateDept = deptSearch.trim() && !allDepts.some((d) => d.toLowerCase() === deptSearch.trim().toLowerCase());

  const initials = newPocName.trim() ? getInitials(newPocName.trim()) : "";
  const deptAvatarColor = DEPT_AVATAR_COLORS[newPocDepartment] || { bg: "hsl(var(--muted))", text: "#64748B", ring: "hsl(var(--border))" };
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

  const inputCls = "h-10 rounded-lg border-border bg-white text-sm text-foreground placeholder:text-[#B8C4D0] focus:border-primary focus:ring-1 focus:ring-primary/15";

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
                style={{ backgroundColor: initials ? deptAvatarColor.bg : "hsl(var(--muted))", color: initials ? deptAvatarColor.text : "#94A3B8", fontWeight: 700, fontSize: 13 }}>
                {initials || <UserPlus className="w-4.5 h-4.5" />}
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>{editMode ? "Edit Contact" : "Create New Contact"}</h2>
                <p className="text-[12px] text-slate-500 mt-0.5">{editMode ? <>Editing <span className="text-foreground" style={{ fontWeight: 500 }}>{editContactName || newPocName}</span></> : contextName ? <>For <span className="text-foreground" style={{ fontWeight: 500 }}>{contextName}</span></> : "Add a new point of contact to the directory."}</p>
              </div>
            </div>
            <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer shrink-0"><X className="w-4 h-4 text-slate-400" /></button>
          </div>
        </div>

        {/* Form body — matches partner creation form */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 pt-3 pb-4 bg-[#FAFBFC] scrollbar-hide space-y-3">

          {/* ── Contact Details — boxed card matching Partner Details ── */}
          <div className="rounded-lg border border-border bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center gap-2 bg-[#FAFBFC]">
              <div className="w-6 h-6 rounded-md bg-primary/8 flex items-center justify-center shrink-0"><Users className="w-3.5 h-3.5 text-primary" /></div>
              <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>Contact Details</span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 tracking-wider uppercase hidden min-[480px]:inline" style={{ fontWeight: 500 }}>Required</span>
            </div>
            <div className="px-2.5 sm:px-3 pt-2 sm:pt-2.5 pb-1.5 sm:pb-2">
              {/* Photo on left, fields in 2-col grid on right */}
              <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3 sm:gap-4">
                {/* Left — Profile Picture (full height) */}
                <div className="hidden sm:flex flex-col w-[120px]">
                  <input ref={profileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const reader = new FileReader(); reader.onload = (ev) => setProfileImage(ev.target?.result as string); reader.readAsDataURL(f); } e.target.value = ""; }} />
                  <div
                    onClick={() => profileInputRef.current?.click()}
                    className={`relative w-full h-full rounded-xl cursor-pointer group transition-all ${profileImage ? "ring-2 ring-border hover:ring-primary/30" : "border-2 border-dashed border-slate-300 hover:border-primary/50 bg-slate-50 hover:bg-accent/50"}`}
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
                        <span className="text-[9px] text-slate-400 group-hover:text-primary transition-colors" style={{ fontWeight: 500 }}>Change photo</span>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                        <div className="w-10 h-10 rounded-lg bg-muted group-hover:bg-accent flex items-center justify-center transition-colors">
                          <Camera className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
                        </div>
                        <span className="text-[10px] text-slate-400 group-hover:text-primary transition-colors" style={{ fontWeight: 500 }}>Upload photo</span>
                        <span className="text-[9px] text-slate-300">Max 5 MB</span>
                      </div>
                    )}
                  </div>
                  {profileImage && (
                    <div className="flex items-center justify-center gap-2 mt-1.5">
                      <button type="button" onClick={() => profileInputRef.current?.click()} className="text-[10px] text-primary hover:text-[#0862D0] cursor-pointer" style={{ fontWeight: 500 }}>Change</button>
                      <span className="text-border text-[10px]">·</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setProfileImage(null); }} className="text-[10px] text-red-500 hover:text-destructive cursor-pointer" style={{ fontWeight: 500 }}>Remove</button>
                    </div>
                  )}
                </div>
                {/* Right — fields in 2-col grid */}
                <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-2.5 sm:gap-y-3">
                  <div>
                    <label className="text-xs sm:text-[13px] text-foreground mb-1 block" style={{ fontWeight: 500 }}>Full Name<span className="text-red-500">*</span></label>
                    <Input value={newPocName} onChange={(e) => onNewPocNameChange(e.target.value)} placeholder="Enter full name" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs sm:text-[13px] text-foreground mb-1 block" style={{ fontWeight: 500 }}>
                      Company
                      <span className="text-[11px] text-slate-400 ml-1.5" style={{ fontWeight: 400 }}>(optional)</span>
                    </label>
                    {/*
                     * Company combo field — three modes:
                     *   1. Link to existing partner (select from vendor directory)
                     *   2. Create new (type a name that isn't in the directory — "Use …" row)
                     *   3. Leave blank (the field is optional)
                     * Mirrors the link-to-partner combo pattern used elsewhere (e.g. PO creation).
                     */}
                    <Popover open={companyOpen} onOpenChange={(o) => { setCompanyOpen(o); if (!o) setCompanySearch(""); }}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={`w-full h-10 rounded-lg border bg-white px-3 text-sm text-left flex items-center justify-between transition-colors cursor-pointer ${companyOpen ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-slate-300"}`}
                        >
                          <span className="flex items-center gap-2 min-w-0 flex-1">
                            {companyVendorId && (
                              <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                            )}
                            <span className={company ? "text-foreground truncate text-[13px]" : "text-[#B8C4D0] text-[13px]"}>
                              {company || "Search or type a company…"}
                            </span>
                            {companyVendorId && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] shrink-0 border" style={{ fontWeight: 500, backgroundColor: "hsl(var(--accent))", color: "hsl(var(--primary))", borderColor: "#BFDBFE" }}>Linked</span>
                            )}
                          </span>
                          <span className="flex items-center gap-1 shrink-0 ml-1">
                            {company && (
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); setCompany(""); setCompanyVendorId(null); }}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setCompany(""); setCompanyVendorId(null); } }}
                                className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:bg-muted hover:text-slate-700 cursor-pointer"
                                aria-label="Clear company"
                              >
                                <X className="w-3 h-3" />
                              </span>
                            )}
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="bottom"
                        align="start"
                        sideOffset={4}
                        className="w-[--radix-popover-trigger-width] p-0 z-[350] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border/80"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                        {/* Search */}
                        <div className="p-2 border-b border-muted">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                              value={companySearch}
                              onChange={(e) => setCompanySearch(e.target.value)}
                              placeholder="Search partners…"
                              className="w-full h-8 pl-8 pr-3 rounded-md border border-border bg-slate-50 text-[12px] focus:outline-none focus:border-primary"
                              autoFocus
                            />
                          </div>
                        </div>
                        {/* Existing partners list */}
                        <div className="max-h-[220px] overflow-y-auto py-1">
                          {(() => {
                            const q = companySearch.trim().toLowerCase();
                            const matches = q
                              ? vendors.filter(
                                  (v) =>
                                    v.displayName.toLowerCase().includes(q) ||
                                    v.companyName.toLowerCase().includes(q)
                                )
                              : vendors;
                            const shown = matches.slice(0, 50);
                            const hasExact =
                              !!q &&
                              matches.some(
                                (v) =>
                                  v.displayName.toLowerCase() === q ||
                                  v.companyName.toLowerCase() === q
                              );

                            return (
                              <>
                                {shown.length === 0 && !q && (
                                  <div className="px-3 py-4 text-[12px] text-slate-400 text-center">
                                    No partners yet. Type a company name to create one.
                                  </div>
                                )}
                                {shown.map((v) => {
                                  const isSelected = companyVendorId === v.id;
                                  return (
                                    <button
                                      key={v.id}
                                      type="button"
                                      onClick={() => {
                                        setCompany(v.displayName);
                                        setCompanyVendorId(v.id);
                                        setCompanyOpen(false);
                                        setCompanySearch("");
                                      }}
                                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors cursor-pointer ${isSelected ? "bg-accent" : ""}`}
                                    >
                                      <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[12.5px] text-foreground truncate" style={{ fontWeight: 500 }}>{v.displayName}</p>
                                        {v.companyName && v.companyName !== v.displayName && (
                                          <p className="text-[11px] text-slate-400 truncate">{v.companyName}</p>
                                        )}
                                      </div>
                                      {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                                    </button>
                                  );
                                })}
                                {/* Create-new row — appears only when search is non-empty
                                 *  AND no existing partner matches it exactly. */}
                                {q && !hasExact && (
                                  <>
                                    <div className="my-1 mx-2 border-t border-muted" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCompany(companySearch.trim());
                                        setCompanyVendorId(null);
                                        setCompanyOpen(false);
                                        setCompanySearch("");
                                      }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-green-50 transition-colors cursor-pointer group"
                                    >
                                      <div className="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center shrink-0">
                                        <Plus className="w-3.5 h-3.5 text-success" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[12.5px] text-foreground" style={{ fontWeight: 500 }}>Use "<span style={{ fontWeight: 600 }}>{companySearch.trim()}</span>"</p>
                                        <p className="text-[11px] text-slate-400">Create a new company (not linked to an existing partner)</p>
                                      </div>
                                    </button>
                                  </>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-xs sm:text-[13px] text-foreground mb-1 block" style={{ fontWeight: 500 }}>Role / Title</label>
                    <Input value={newPocRole} onChange={(e) => onNewPocRoleChange(e.target.value)} placeholder="e.g. Procurement Manager" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs sm:text-[13px] text-foreground mb-1 block" style={{ fontWeight: 500 }}>Department</label>
                    <Popover open={deptDropdownOpen} onOpenChange={setDeptDropdownOpen}>
                      <PopoverTrigger asChild>
                        <button type="button" className="w-full h-10 rounded-lg border border-border bg-white px-3 text-sm text-left flex items-center justify-between hover:border-slate-300 transition-colors cursor-pointer">
                          <span className={newPocDepartment ? "text-foreground" : "text-[#B8C4D0]"}>{newPocDepartment || "Select department"}</span>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent side="bottom" align="start" sideOffset={4} className="w-[--radix-popover-trigger-width] p-0 z-[350] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border/80" onOpenAutoFocus={(e) => e.preventDefault()}>
                        {/* Search */}
                        <div className="p-2 border-b border-muted">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input value={deptSearch} onChange={(e) => setDeptSearch(e.target.value)} placeholder="Search departments..." className="w-full h-8 pl-8 pr-3 rounded-md border border-border bg-slate-50 text-[12px] focus:outline-none focus:border-primary" autoFocus />
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
                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] transition-colors ${newPocDepartment === d ? "bg-accent/50 text-primary" : "text-slate-700 hover:bg-slate-50"}`}
                                style={{ fontWeight: newPocDepartment === d ? 600 : 400 }}>
                                <span className="flex-1">{label}</span>
                                {newPocDepartment === d && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                              </button>
                            );
                          })}
                          {filteredDepts.length === 0 && (
                            <p className="px-3 py-3 text-[12px] text-slate-400 text-center">No departments found</p>
                          )}
                        </div>
                        {/* Permanent create new CTA */}
                        <div className="border-t border-muted p-2">
                          <button type="button" onClick={() => {
                            if (deptSearch.trim() && canCreateDept) {
                              const newDept = deptSearch.trim();
                              setCustomDepts((p) => [...p, newDept]);
                              onNewPocDepartmentChange(newDept as any);
                              setDeptSearch("");
                            }
                            setDeptDropdownOpen(false);
                          }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-primary hover:bg-accent transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
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
          <div className="rounded-lg border border-border bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center justify-between bg-[#FAFBFC]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center shrink-0"><Phone className="w-3.5 h-3.5 text-success" /></div>
                <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>Phone Numbers</span>
              </div>
              <button type="button" onClick={addPhoneRow} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-primary hover:bg-accent border border-transparent hover:border-primary/15 transition-all cursor-pointer" style={{ fontWeight: 600 }}><Plus className="w-3 h-3" />Add another number</button>
            </div>
            <div className="px-3 sm:px-4 py-2.5 space-y-2">
              {phoneRows.map((row, idx) => (
                <div key={row.id} className="flex items-center gap-2">
                  <Select value={row.type} onValueChange={(v) => { setPhoneRows((p) => { const n = [...p]; n[idx] = { ...n[idx], type: v }; return n; }); }}>
                    <SelectTrigger className="!h-10 rounded-lg border-border text-xs w-[90px] shrink-0 [&>svg]:text-slate-400"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[350]">{PHONE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex items-center rounded-lg border border-border bg-white overflow-hidden h-10 flex-1 min-w-0 hover:border-slate-300 transition-colors">
                    <Select value={row.code} onValueChange={(v) => handlePhoneChange(idx, "code", v)}>
                      <SelectTrigger className="h-full border-0 border-r border-border rounded-none bg-[#FAFBFC] px-2 text-xs w-[68px] shrink-0 shadow-none focus:ring-0"><span className="text-[11px]">{getCountryFlag(row.code)} {row.code}</span></SelectTrigger>
                      <SelectContent className="z-[350]">{COUNTRY_CODES.map((cc) => <SelectItem key={cc.code} value={cc.code}><span className="flex items-center gap-1"><span>{cc.flag}</span>{cc.code}</span></SelectItem>)}</SelectContent>
                    </Select>
                    <input value={row.number} onChange={(e) => handlePhoneChange(idx, "number", e.target.value)} placeholder="Phone number" className="flex-1 h-full px-2.5 text-sm text-foreground outline-none bg-transparent placeholder:text-[#B8C4D0]" />
                  </div>
                  {(row.type === "Office" || row.type === "Landline") && <Input value={row.ext} onChange={(e) => handlePhoneChange(idx, "ext", e.target.value)} placeholder="Ext." className={`w-[70px] shrink-0 ${inputCls}`} />}
                  {phoneRows.length > 1 && <button onClick={() => removePhoneRow(row.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              ))}
            </div>
          </div>

          {/* ── Email Addresses — boxed card ── */}
          <div className="rounded-lg border border-border bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center justify-between bg-[#FAFBFC]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center shrink-0"><Mail className="w-3.5 h-3.5 text-primary" /></div>
                <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>Email Addresses</span>
              </div>
              <button type="button" onClick={addEmailRow} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-primary hover:bg-accent border border-transparent hover:border-primary/15 transition-all cursor-pointer" style={{ fontWeight: 600 }}><Plus className="w-3 h-3" />Add another email</button>
            </div>
            <div className="px-3 sm:px-4 py-2.5 space-y-2">
              {emailRows.map((row, idx) => (
                <div key={row.id} className="flex items-center gap-2">
                  <Select value={row.type} onValueChange={(v) => { setEmailRows((p) => { const n = [...p]; n[idx] = { ...n[idx], type: v }; return n; }); }}>
                    <SelectTrigger className="!h-10 rounded-lg border-border text-xs w-[100px] shrink-0 [&>svg]:text-slate-400"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[350]">{EMAIL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={row.address} onChange={(e) => handleEmailChange(idx, e.target.value)} placeholder="name@company.com" type="email" className={`flex-1 ${inputCls}`} />
                  {emailRows.length > 1 && <button onClick={() => removeEmailRow(row.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              ))}
            </div>
          </div>

          {/* ── Social Profiles — dynamic rows like phone/email ── */}
          <div className="rounded-lg border border-border bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center justify-between bg-[#FAFBFC]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-violet-50 flex items-center justify-center shrink-0"><Globe className="w-3.5 h-3.5 text-violet" /></div>
                <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>Social Profiles</span>
              </div>
              <button type="button" onClick={addSocialRow} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-primary hover:bg-accent border border-transparent hover:border-primary/15 transition-all cursor-pointer" style={{ fontWeight: 600 }}><Plus className="w-3 h-3" />Add social profile</button>
            </div>
            <div className="px-3 sm:px-4 py-2.5 space-y-2">
              {socialRows.map((row, idx) => (
                <div key={row.id} className="flex items-center gap-2">
                  <Select value={row.type} onValueChange={(v) => { setSocialRows((p) => { const n = [...p]; n[idx] = { ...n[idx], type: v }; return n; }); }}>
                    <SelectTrigger className="!h-10 rounded-lg border-border text-xs w-[110px] shrink-0 [&>svg]:text-slate-400"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[350]">{SOCIAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={row.url} onChange={(e) => { setSocialRows((p) => { const n = [...p]; n[idx] = { ...n[idx], url: e.target.value }; return n; }); }}
                    placeholder={row.type === "LinkedIn" ? "linkedin.com/in/username" : row.type === "Twitter / X" ? "@username" : row.type === "WhatsApp" ? "+1 555-123-4567" : "https://example.com"}
                    className={`flex-1 ${inputCls}`} />
                  {socialRows.length > 1 && <button onClick={() => removeSocialRow(row.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              ))}
            </div>
          </div>

          {/* ── Attachments — same as partner creation form ── */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-6 h-6 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
                <Paperclip className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>Attachments</span>
                {attachedFiles.length > 0 && (
                  <span className="text-[10px] text-slate-500 bg-muted px-1.5 py-0.5 rounded-full" style={{ fontWeight: 500 }}>{attachedFiles.length}</span>
                )}
              </div>
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef2.current?.click()}
              className={`rounded-lg border-2 border-dashed p-3 sm:p-4 text-center cursor-pointer transition-all ${
                dragActive ? "border-primary bg-accent/30" : "border-border bg-white hover:border-slate-300 hover:bg-[#FAFBFC]"
              }`}
            >
              <input ref={fileInputRef2} type="file" multiple onChange={(e) => handleFiles(e.target.files)} className="hidden" />
              <div className="flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dragActive ? "bg-[#D6E8FF] text-primary" : "bg-muted text-slate-400"}`}>
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-foreground" style={{ fontWeight: 500 }}><span className="text-primary">Click to upload</span><span className="hidden sm:inline"> or drag and drop</span></p>
                  <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">PDF, DOC, XLS, PNG, JPG up to 10MB</p>
                </div>
              </div>
            </div>
            {attachedFiles.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                {attachedFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-border bg-white hover:bg-[#FAFBFC] transition-colors group">
                    <span className="text-base">{getFileIcon(file.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate" style={{ fontWeight: 500 }}>{file.name}</p>
                      <p className="text-[11px] text-slate-400">{file.size}</p>
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setAttachedFiles((prev) => prev.filter((f) => f.id !== file.id)); }} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`shrink-0 border-t border-border bg-white px-5 py-3 flex items-center ${editMode ? "justify-end" : "justify-between"} sm:rounded-b-2xl`}>
          {!editMode && (
            <button onClick={() => onSaveAndCreateAnotherChange(!saveAndCreateAnother)} className="flex items-center gap-2 cursor-pointer select-none group/check">
              <div className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-all duration-150 ${saveAndCreateAnother ? "bg-primary border-primary" : "border-slate-300 bg-white group-hover/check:border-slate-400"}`}>
                {saveAndCreateAnother && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </div>
              <span className="text-[13px] text-muted-foreground group-hover/check:text-slate-700 transition-colors" style={{ fontWeight: 500 }}>Save and create another</span>
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <button onClick={() => onOpenChange(false)} className="px-4 py-2 rounded-lg border border-border bg-white text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer" style={{ fontWeight: 500 }}>{editMode ? "Cancel" : "Discard"}</button>
            <button onClick={onSave} disabled={!isValid}
              className={`px-5 py-2 rounded-lg text-[13px] text-white transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5 ${isValid ? "bg-primary hover:bg-[#0960D9]" : "bg-primary/40 cursor-not-allowed"}`}
              style={{ fontWeight: 600 }}>
              {editMode ? "Save Changes" : "Save Contact"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}