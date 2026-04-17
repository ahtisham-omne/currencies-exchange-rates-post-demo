import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ExpandableTextarea } from "./ExpandableTextarea";
import {
  Check,
  Search,
  X,
  Star,
  MapPin,
  Globe,
  Users,
  Truck,
  ShoppingCart,
  Settings2,
  Info,
  UserPlus,
  Camera,
  Pencil,
  ChevronDown,
  Paperclip,
  Upload,
  Trash2,
} from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import {
  type PartnerGroup,
  type ContactPerson,
  CONTACT_DICTIONARY,
} from "./partnerConstants";
import { GroupChipsRow } from "./GroupChipsRow";
import { PocPillsRow } from "./PocPillComponents";
import { SelectPocDictionaryModal, CreatePocModal } from "./PocModals";
import { AddressAutocomplete } from "./AddressAutocomplete";

// ── Step 2: Partner Form (restructured) ──
export function Step2PartnerForm({
  selectedGroup,
  allSelectedGroups,
  primaryGroupId,
  onEditGroup,
  partnerName,
  onPartnerNameChange,
  partnerPhone,
  onPartnerPhoneChange,
  phoneCountryCode,
  onPhoneCountryCodeChange,
  website,
  onWebsiteChange,
  address,
  onAddressChange,
  profileImage,
  onProfileImageChange,
  selectedPartnerTypes,
  onPartnerTypeChange,
  selectedVendorSubTypes,
  onToggleVendorSubType,
  selectedCustomerSubTypes,
  onToggleCustomerSubType,
  onOpenConfigure,
  errors,
}: {
  selectedGroup: PartnerGroup | null;
  allSelectedGroups: PartnerGroup[];
  primaryGroupId: string | null;
  onEditGroup: () => void;
  partnerName: string;
  onPartnerNameChange: (val: string) => void;
  partnerPhone: string;
  onPartnerPhoneChange: (val: string) => void;
  phoneCountryCode: string;
  onPhoneCountryCodeChange: (val: string) => void;
  website: string;
  onWebsiteChange: (val: string) => void;
  address: string;
  onAddressChange: (val: string) => void;
  profileImage: string | null;
  onProfileImageChange: (val: string | null) => void;
  selectedPartnerTypes: Set<string>;
  onPartnerTypeChange: (type: "vendor" | "customer") => void;
  selectedVendorSubTypes: Set<string>;
  onToggleVendorSubType: (id: string) => void;
  selectedCustomerSubTypes: Set<string>;
  onToggleCustomerSubType: (id: string) => void;
  onOpenConfigure: (type: "vendor" | "customer") => void;
  errors: Record<string, string>;
}) {
  // Local state for fields not yet lifted to parent
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  const [description, setDescription] = useState("");
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [addressFocused, setAddressFocused] = useState(false);
  const [addressSelected, setAddressSelected] = useState(false);
  const addressRef = useRef<HTMLDivElement>(null);
  const addressInputWrapRef = useRef<HTMLDivElement>(null);
  const [addrDropdownPos, setAddrDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const addrInteractingRef = useRef(false);
  const addrDropdownRef = useRef<HTMLDivElement>(null);

  // ── Global Point of Contact (partner-level) ──
  const [globalPocContactDictionary, setGlobalPocContactDictionary] = useState<ContactPerson[]>([...CONTACT_DICTIONARY]);
  const [showSelectGlobalPocModal, setShowSelectGlobalPocModal] = useState(false);
  const [showCreateGlobalPocModal, setShowCreateGlobalPocModal] = useState(false);
  const [globalPocSearch, setGlobalPocSearch] = useState("");
  const [globalPocCategoryFilter, setGlobalPocCategoryFilter] = useState<"all" | "Sales" | "Supply Chain Management" | "Finance">("all");
  const [globalPocPage, setGlobalPocPage] = useState(1);
  const [globalPocTempSelected, setGlobalPocTempSelected] = useState<Set<string>>(new Set());
  const [selectedGlobalPocIds, setSelectedGlobalPocIds] = useState<Set<string>>(new Set());
  // Create new POC form state (for global POC)
  const [gNewPocName, setGNewPocName] = useState("");
  const [gNewPocDepartment, setGNewPocDepartment] = useState<string>("Sales");
  const [gNewPocRole, setGNewPocRole] = useState("");
  const [gNewPocLandline, setGNewPocLandline] = useState("");
  const [gNewPocLandlineCode, setGNewPocLandlineCode] = useState("+1");
  const [gNewPocExt, setGNewPocExt] = useState("");
  const [gNewPocMobile, setGNewPocMobile] = useState("");
  const [gNewPocMobileCode, setGNewPocMobileCode] = useState("+1");
  const [gNewPocEmail, setGNewPocEmail] = useState("");
  const [gSaveAndCreateAnother, setGSaveAndCreateAnother] = useState(false);

  const AVATAR_COLORS_G = useMemo(() => [
    "#0A77FF", "#7C3AED", "#059669", "#DC2626", "#D97706",
    "#0891B2", "#4F46E5", "#BE185D", "#65A30D", "#EA580C",
  ], []);

  const globalPocDeptCounts = useMemo(() => {
    const counts: Record<string, number> = { Sales: 0, "Supply Chain Management": 0, Finance: 0 };
    globalPocContactDictionary.forEach((c) => { counts[c.department] = (counts[c.department] || 0) + 1; });
    return counts;
  }, [globalPocContactDictionary]);

  const filteredGlobalPocContacts = useMemo(() => {
    let list = globalPocContactDictionary;
    if (globalPocCategoryFilter !== "all") list = list.filter((c) => c.department === globalPocCategoryFilter);
    if (globalPocSearch.trim()) {
      const q = globalPocSearch.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.company.toLowerCase().includes(q));
    }
    return list;
  }, [globalPocCategoryFilter, globalPocSearch, globalPocContactDictionary]);

  const GPOC_PER_PAGE = 20;
  const globalPocTotalPages = Math.max(1, Math.ceil(filteredGlobalPocContacts.length / GPOC_PER_PAGE));
  const globalPocPagedContacts = filteredGlobalPocContacts.slice((globalPocPage - 1) * GPOC_PER_PAGE, globalPocPage * GPOC_PER_PAGE);

  const selectedGlobalPocContacts = useMemo(() => {
    return globalPocContactDictionary.filter((c) => selectedGlobalPocIds.has(c.id));
  }, [selectedGlobalPocIds, globalPocContactDictionary]);

  const handleOpenSelectGlobalPoc = useCallback(() => {
    setGlobalPocTempSelected(new Set(selectedGlobalPocIds));
    setGlobalPocSearch("");
    setGlobalPocCategoryFilter("all");
    setGlobalPocPage(1);
    setShowSelectGlobalPocModal(true);
  }, [selectedGlobalPocIds]);

  const handleConfirmGlobalPocSelection = useCallback(() => {
    setSelectedGlobalPocIds(new Set(globalPocTempSelected));
    setShowSelectGlobalPocModal(false);
  }, [globalPocTempSelected]);

  const handleToggleGlobalPocTemp = useCallback((id: string) => {
    setGlobalPocTempSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleRemoveGlobalPoc = useCallback((id: string) => {
    setSelectedGlobalPocIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }, []);

  const resetGlobalNewPocForm = useCallback(() => {
    setGNewPocName(""); setGNewPocDepartment(""); setGNewPocRole("");
    setGNewPocLandline(""); setGNewPocLandlineCode("+1"); setGNewPocExt("");
    setGNewPocMobile(""); setGNewPocMobileCode("+1"); setGNewPocEmail("");
  }, []);

  const handleOpenCreateGlobalPoc = useCallback(() => {
    resetGlobalNewPocForm();
    setGSaveAndCreateAnother(false);
    setShowCreateGlobalPocModal(true);
  }, [resetGlobalNewPocForm]);

  const handleSaveGlobalNewPoc = useCallback(() => {
    if (!gNewPocName.trim()) return;
    const newId = `C-GNEW-${Date.now()}`;
    const avatarColor = AVATAR_COLORS_G[globalPocContactDictionary.length % AVATAR_COLORS_G.length];
    const newContact: ContactPerson = {
      id: newId, name: gNewPocName.trim(), company: partnerName || "New Partner",
      department: gNewPocDepartment, phone: gNewPocLandline ? `${gNewPocLandlineCode} ${gNewPocLandline}` : "",
      phoneExt: gNewPocExt, secondaryPhone: gNewPocMobile ? `${gNewPocMobileCode} ${gNewPocMobile}` : "",
      secondaryPhoneExt: "", email: gNewPocEmail, avatarColor,
    };
    setGlobalPocContactDictionary((prev) => [newContact, ...prev]);
    setGlobalPocTempSelected((prev) => { const next = new Set(prev); next.add(newId); return next; });
    setSelectedGlobalPocIds((prev) => { const next = new Set(prev); next.add(newId); return next; });
    if (gSaveAndCreateAnother) { resetGlobalNewPocForm(); } else { setShowCreateGlobalPocModal(false); }
  }, [gNewPocName, gNewPocDepartment, gNewPocLandline, gNewPocLandlineCode, gNewPocExt, gNewPocMobile, gNewPocMobileCode, gNewPocEmail, partnerName, gSaveAndCreateAnother, resetGlobalNewPocForm, globalPocContactDictionary, AVATAR_COLORS_G]);

  // Profile picture (state lifted to parent; only local UI state here)
  const profileInputRef = useRef<HTMLInputElement>(null);
  const [profileDragOver, setProfileDragOver] = useState(false);

  const handleProfileFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return; // 5MB limit
    const reader = new FileReader();
    reader.onload = (e) => onProfileImageChange(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const COUNTRY_CODES = useMemo(() => [
    { code: "+1", flag: "\u{1F1FA}\u{1F1F8}", country: "United States" },
    { code: "+1", flag: "\u{1F1E8}\u{1F1E6}", country: "Canada" },
    { code: "+44", flag: "\u{1F1EC}\u{1F1E7}", country: "United Kingdom" },
    { code: "+49", flag: "\u{1F1E9}\u{1F1EA}", country: "Germany" },
    { code: "+33", flag: "\u{1F1EB}\u{1F1F7}", country: "France" },
    { code: "+81", flag: "\u{1F1EF}\u{1F1F5}", country: "Japan" },
    { code: "+86", flag: "\u{1F1E8}\u{1F1F3}", country: "China" },
    { code: "+91", flag: "\u{1F1EE}\u{1F1F3}", country: "India" },
    { code: "+61", flag: "\u{1F1E6}\u{1F1FA}", country: "Australia" },
    { code: "+55", flag: "\u{1F1E7}\u{1F1F7}", country: "Brazil" },
    { code: "+971", flag: "\u{1F1E6}\u{1F1EA}", country: "UAE" },
    { code: "+65", flag: "\u{1F1F8}\u{1F1EC}", country: "Singapore" },
    { code: "+82", flag: "\u{1F1F0}\u{1F1F7}", country: "South Korea" },
    { code: "+52", flag: "\u{1F1F2}\u{1F1FD}", country: "Mexico" },
    { code: "+31", flag: "\u{1F1F3}\u{1F1F1}", country: "Netherlands" },
    { code: "+46", flag: "\u{1F1F8}\u{1F1EA}", country: "Sweden" },
    { code: "+41", flag: "\u{1F1E8}\u{1F1ED}", country: "Switzerland" },
    { code: "+34", flag: "\u{1F1EA}\u{1F1F8}", country: "Spain" },
    { code: "+39", flag: "\u{1F1EE}\u{1F1F9}", country: "Italy" },
    { code: "+48", flag: "\u{1F1F5}\u{1F1F1}", country: "Poland" },
  ], []);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRY_CODES;
    const q = countrySearch.toLowerCase();
    return COUNTRY_CODES.filter(
      (c) => c.country.toLowerCase().includes(q) || c.code.includes(q)
    );
  }, [countrySearch, COUNTRY_CODES]);

  const selectedCountry = useMemo(() => {
    return COUNTRY_CODES.find((c) => c.code === phoneCountryCode) || COUNTRY_CODES[0];
  }, [phoneCountryCode, COUNTRY_CODES]);

  const MOCK_ADDRESS_SUGGESTIONS = useMemo(() => [
    { main: "350 Fifth Avenue", secondary: "New York, NY 10118, USA" },
    { main: "1600 Amphitheatre Parkway", secondary: "Mountain View, CA 94043, USA" },
    { main: "1 Apple Park Way", secondary: "Cupertino, CA 95014, USA" },
    { main: "One Microsoft Way", secondary: "Redmond, WA 98052, USA" },
    { main: "410 Terry Ave North", secondary: "Seattle, WA 98109, USA" },
    { main: "1 Hacker Way", secondary: "Menlo Park, CA 94025, USA" },
    { main: "Unter den Linden 77", secondary: "10117 Berlin, Germany" },
    { main: "1-7-1 Konan, Minato-ku", secondary: "Tokyo 108-0075, Japan" },
    { main: "221B Baker Street", secondary: "London, NW1 6XE, United Kingdom" },
    { main: "1 Infinite Loop", secondary: "Cupertino, CA 95014, USA" },
    { main: "30 Hudson Yards", secondary: "New York, NY 10001, USA" },
    { main: "233 S Wacker Dr", secondary: "Chicago, IL 60606, USA" },
    { main: "4 Privet Drive", secondary: "Little Whinging, Surrey, UK" },
    { main: "1313 Disneyland Dr", secondary: "Anaheim, CA 92802, USA" },
    { main: "11 Wall Street", secondary: "New York, NY 10005, USA" },
    { main: "1 World Trade Center", secondary: "New York, NY 10007, USA" },
    { main: "500 Terry A Francois Blvd", secondary: "San Francisco, CA 94158, USA" },
    { main: "2300 Traverwood Dr", secondary: "Ann Arbor, MI 48105, USA" },
    { main: "8 Rue du Faubourg", secondary: "75008 Paris, France" },
    { main: "Marienplatz 1", secondary: "80331 Munich, Germany" },
    { main: "1 Harbourside Crescent", secondary: "Sydney, NSW 2000, Australia" },
    { main: "Via Roma 28", secondary: "00184 Rome, Italy" },
    { main: "Rua Augusta 274", secondary: "S\u00E3o Paulo, SP 01305-000, Brazil" },
    { main: "100 Universal City Plaza", secondary: "Universal City, CA 91608, USA" },
  ], []);

  const addressSuggestions = useMemo(() => {
    if (!address.trim() || address.length < 2 || addressSelected) return [];
    const words = address.toLowerCase().split(/\s+/).filter(Boolean);
    return MOCK_ADDRESS_SUGGESTIONS.filter((s) => {
      const full = `${s.main} ${s.secondary}`.toLowerCase();
      return words.every(w => full.includes(w));
    }).slice(0, 6);
  }, [address, addressSelected, MOCK_ADDRESS_SUGGESTIONS]);

  // Close address dropdown when clicking outside (checks both input area and portal dropdown)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (addressRef.current?.contains(target)) return;
      if (addrDropdownRef.current?.contains(target)) return;
      setAddressFocused(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
  }, []);

  // Address dropdown portal position
  useEffect(() => {
    if (!addressFocused || !addressInputWrapRef.current) { setAddrDropdownPos(null); return; }
    const updatePos = () => { const el = addressInputWrapRef.current; if (!el) return; const r = el.getBoundingClientRect(); setAddrDropdownPos({ top: r.bottom, left: r.left, width: r.width }); };
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => { window.removeEventListener("scroll", updatePos, true); window.removeEventListener("resize", updatePos); };
    return () => { window.removeEventListener("scroll", updatePos, true); window.removeEventListener("resize", updatePos); };
  }, []);

  const statusConfig = {
    Active: { color: "#10B981", bg: "#ECFDF5", label: "Active" },
    Inactive: { color: "#EF4444", bg: "#FEF2F2", label: "Inactive" },
  } as const;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* ── Selected Partner Groups Banner — sticky at top ── */}
      {allSelectedGroups.length > 0 && (
        <div className="sticky top-0 z-10 bg-[#FAFBFC] pb-2 -mt-1">
          <div className="rounded-lg bg-white border border-[#0A77FF]/25 shadow-[0_1px_4px_rgba(10,119,255,0.06),0_4px_12px_-2px_rgba(0,0,0,0.06)] overflow-hidden">
            {/* Header row */}
            <div className="flex items-center justify-between gap-2 px-2.5 sm:px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-md bg-[#0A77FF]/8 flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5 text-[#0A77FF]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>
                      {allSelectedGroups.length} Group{allSelectedGroups.length !== 1 ? "s" : ""} Selected
                    </span>
                    {selectedGroup && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-[#0A77FF]/8 text-[#0A77FF]" style={{ fontWeight: 600 }}>
                        <Star className="w-2.5 h-2.5 fill-[#0A77FF]" />
                        Primary: {selectedGroup.name}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">
                    Configuration inherits from the primary group
                  </p>
                </div>
              </div>
              <button
                onClick={onEditGroup}
                className="group inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:border-[#0A77FF] hover:text-[#0A77FF] hover:bg-[#EDF4FF] transition-all shrink-0 text-[11px] sm:text-xs cursor-pointer"
                style={{ fontWeight: 600 }}
              >
                <Pencil className="w-3 h-3" />
                <span className="hidden min-[400px]:inline">Edit Groups</span>
              </button>
            </div>
            {/* Group chips row — single line with +N more overflow */}
            <GroupChipsRow
              allSelectedGroups={allSelectedGroups}
              primaryGroupId={primaryGroupId}
            />
          </div>
        </div>
      )}

      {/* ── Partner Details — boxed card ── */}
      <div className="rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center gap-2 bg-[#FAFBFC] rounded-t-lg">
          <div className="w-6 h-6 rounded-md bg-[#0A77FF]/8 flex items-center justify-center shrink-0">
            <Info className="w-3.5 h-3.5 text-[#0A77FF]" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>Partner Details</span>
            <span className="text-[9px] sm:text-[10px] text-[#94A3B8] tracking-wider uppercase hidden min-[480px]:inline" style={{ fontWeight: 500 }}>Required</span>
          </div>
        </div>
        <div className="px-2.5 sm:px-3 pt-2 sm:pt-2.5 pb-1.5 sm:pb-2">

          {/* Mobile: Compact profile photo row */}
          <div className="flex sm:hidden items-center gap-3 mb-3">
            <input
              ref={profileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleProfileFile(file);
                e.target.value = "";
              }}
            />
            <div
              onClick={() => profileInputRef.current?.click()}
              className={`relative w-14 h-14 rounded-xl cursor-pointer shrink-0 transition-all ${
                profileImage
                  ? "ring-2 ring-[#E2E8F0]"
                  : "border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC]"
              }`}
            >
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="w-full h-full rounded-xl object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Camera className="w-5 h-5 text-[#94A3B8]" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[#0F172A]" style={{ fontWeight: 500 }}>
                {profileImage ? "Profile photo" : "Add a photo"}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  type="button"
                  onClick={() => profileInputRef.current?.click()}
                  className="text-[11px] text-[#0A77FF]"
                  style={{ fontWeight: 500 }}
                >
                  {profileImage ? "Change" : "Upload"}
                </button>
                {profileImage && (
                  <>
                    <span className="text-[#E2E8F0] text-[11px]">&middot;</span>
                    <button
                      type="button"
                      onClick={() => onProfileImageChange(null)}
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

          {/* Photo on left, all fields in 2-col grid on right */}
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3 sm:gap-4">
            {/* Left — Profile Picture Upload (square, LinkedIn-style) — desktop only */}
            <div className="hidden sm:flex flex-col items-center w-[120px]">
              <input
                ref={profileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleProfileFile(file);
                  e.target.value = "";
                }}
              />
              <div
                onClick={() => profileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setProfileDragOver(true); }}
                onDragLeave={() => setProfileDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setProfileDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleProfileFile(file);
                }}
                className={`relative w-full aspect-square rounded-xl cursor-pointer group transition-all ${
                  profileImage
                    ? "ring-2 ring-[#E2E8F0] hover:ring-[#0A77FF]/30"
                    : profileDragOver
                    ? "border-2 border-dashed border-[#0A77FF] bg-[#EDF4FF]"
                    : "border-2 border-dashed border-[#CBD5E1] hover:border-[#0A77FF]/50 bg-[#F8FAFC] hover:bg-[#EDF4FF]/50"
                }`}
              >
                {profileImage ? (
                  <>
                    <img
                      src={profileImage}
                      alt="Partner profile"
                      className="w-full h-full rounded-xl object-cover"
                    />
                    <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                    <div className="w-10 h-10 rounded-lg bg-[#F1F5F9] group-hover:bg-[#EDF4FF] flex items-center justify-center transition-colors">
                      <Camera className="w-5 h-5 text-[#94A3B8] group-hover:text-[#0A77FF] transition-colors" />
                    </div>
                    <span className="text-[11px] text-[#94A3B8] group-hover:text-[#0A77FF] transition-colors" style={{ fontWeight: 500 }}>Upload photo</span>
                    <span className="text-[9px] text-[#CBD5E1]">Max 5 MB</span>
                  </div>
                )}
              </div>
              {profileImage && (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => profileInputRef.current?.click()}
                    className="text-[11px] text-[#0A77FF] hover:text-[#0862D0] transition-colors cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    Change
                  </button>
                  <span className="text-[#E2E8F0] text-[11px]">&middot;</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onProfileImageChange(null); }}
                    className="text-[11px] text-[#EF4444] hover:text-[#DC2626] transition-colors cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Right — all fields in a 2-column grid */}
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-2.5 sm:gap-y-3">
              {/* Row 1 Left: Partner Name */}
              <div>
                <Label htmlFor="create-partner-name" className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 500 }}>
                  Partner Name<span className="text-[#EF4444]">*</span>
                </Label>
                <Input
                  id="create-partner-name"
                  placeholder="e.g. Acme Supply Co."
                  value={partnerName}
                  onChange={(e) => onPartnerNameChange(e.target.value)}
                  className="mt-1 rounded-lg border-[#E2E8F0] bg-white !h-10 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20"
                />
                {errors.partnerName && (
                  <p className="text-[#EF4444] text-xs mt-1">{errors.partnerName}</p>
                )}
              </div>

              {/* Row 1 Right: Status */}
              <div>
                <Label className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 500 }}>Status</Label>
                <Select value={status} onValueChange={(val: string) => setStatus(val as "Active" | "Inactive")}>
                  <SelectTrigger className="mt-1 !h-10 rounded-lg border-[#E2E8F0] bg-white text-sm hover:border-[#CBD5E1] transition-colors focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20 [&>svg]:text-[#94A3B8]">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusConfig[status].color }} />
                        <span className="text-[#0F172A]">{statusConfig[status].label}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="z-[250] rounded-lg">
                    <SelectItem value="Active">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                        Active
                      </div>
                    </SelectItem>
                    <SelectItem value="Inactive">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
                        Inactive
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Row 2 Left: Phone Number */}
              <div>
                <Label htmlFor="create-partner-phone" className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 500 }}>
                  Phone Number
                </Label>
                <div className="flex items-center gap-0 mt-1">
                  <Popover open={countryPickerOpen} onOpenChange={setCountryPickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 pl-2.5 pr-1.5 !h-10 rounded-l-lg border border-r-0 border-[#E2E8F0] bg-white text-sm shrink-0 cursor-pointer hover:border-[#CBD5E1] transition-colors focus:outline-none focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20"
                      >
                        <span className="text-base leading-none">{selectedCountry.flag}</span>
                        <span className="text-xs text-[#334155]" style={{ fontWeight: 600 }}>{phoneCountryCode}</span>
                        <ChevronDown className="w-3 h-3 text-[#94A3B8]" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0 z-[200] rounded-xl shadow-lg border border-[#E2E8F0]" align="start" sideOffset={4}>
                      <div className="p-2 border-b border-[#F1F5F9]">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
                          <input
                            type="text"
                            placeholder="Search country..."
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-[#E2E8F0] bg-white text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20"
                          />
                        </div>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto p-1">
                        {filteredCountries.map((c, i) => (
                          <button
                            key={`${c.code}-${c.country}-${i}`}
                            type="button"
                            onClick={() => {
                              onPhoneCountryCodeChange(c.code);
                              setCountryPickerOpen(false);
                              setCountrySearch("");
                            }}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                              phoneCountryCode === c.code && selectedCountry.country === c.country
                                ? "bg-[#EDF4FF] text-[#0A77FF]"
                                : "hover:bg-[#F8FAFC] text-[#334155]"
                            }`}
                          >
                            <span className="text-base">{c.flag}</span>
                            <span className="text-sm flex-1 truncate" style={{ fontWeight: 500 }}>{c.country}</span>
                            <span className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>{c.code}</span>
                            {phoneCountryCode === c.code && selectedCountry.country === c.country && (
                              <Check className="w-3.5 h-3.5 text-[#0A77FF] shrink-0" />
                            )}
                          </button>
                        ))}
                        {filteredCountries.length === 0 && (
                          <p className="text-xs text-[#94A3B8] text-center py-4">No countries found</p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Input
                    id="create-partner-phone"
                    placeholder="(555) 123-4567"
                    value={partnerPhone}
                    onChange={(e) => onPartnerPhoneChange(e.target.value)}
                    className="rounded-l-none rounded-r-lg border-[#E2E8F0] bg-white !h-10 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20"
                  />
                </div>
              </div>

              {/* Row 2 Right: Website */}
              <div>
                <Label htmlFor="create-partner-website" className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 500 }}>
                  Website
                </Label>
                <Input
                  id="create-partner-website"
                  placeholder="https://example.com"
                  value={website}
                  onChange={(e) => onWebsiteChange(e.target.value)}
                  className="mt-1 rounded-lg border-[#E2E8F0] bg-white !h-10 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20"
                />
              </div>

              {/* Row 3 Left: Address */}
              <AddressAutocomplete id="create-partner-address" value={address} onChange={onAddressChange} />

              {/* Row 3 Right: Description */}
              <ExpandableTextarea
                label="Description"
                value={description}
                onChange={setDescription}
                placeholder="Brief summary of partner purpose or context."
                maxLength={500}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Partner Type Selection ── */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-6 h-6 rounded-md bg-[#0A77FF]/8 flex items-center justify-center shrink-0">
            <Users className="w-3.5 h-3.5 text-[#0A77FF]" />
          </div>
          <div>
            <span className="text-xs sm:text-[13px] text-[#0F172A] block" style={{ fontWeight: 600 }}>Partner Type</span>
            <span className="text-[10px] sm:text-[11px] text-[#94A3B8] block mt-px">Select one or more partner classifications</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Vendor Card */}
          <div
            onClick={() => onPartnerTypeChange("vendor")}
            className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
              selectedPartnerTypes.has("vendor")
                ? "border-[#93C5FD]/70 bg-white shadow-[0_1px_4px_rgba(10,119,255,0.06)]"
                : "border-[#E2E8F0] bg-white hover:border-[#BFDBFE] hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.12)]"
            }`}
          >
            <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
              selectedPartnerTypes.has("vendor")
                ? "bg-gradient-to-br from-[#EFF6FF]/50 to-transparent"
                : "bg-gradient-to-br from-[#EDF4FF]/0 to-[#EDF4FF]/0 group-hover:from-[#EDF4FF]/60 group-hover:to-transparent"
            }`} />
            <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
              <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                selectedPartnerTypes.has("vendor")
                  ? "bg-gradient-to-br from-[#DBEAFE] to-[#BFDBFE] text-[#2563EB]"
                  : "bg-gradient-to-br from-[#EDF4FF] to-[#DBEAFE] text-[#0A77FF] group-hover:scale-105"
              }`}>
                <Truck className="w-[18px] h-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] transition-colors duration-150 ${
                  selectedPartnerTypes.has("vendor") ? "text-[#1E40AF]" : "text-[#0F172A] group-hover:text-[#1E293B]"
                }`} style={{ fontWeight: 600 }}>Vendor</p>
                <p className={`text-[11px] mt-0.5 truncate transition-colors duration-150 ${
                  selectedPartnerTypes.has("vendor") ? "text-[#60A5FA]" : "text-[#94A3B8]"
                }`}>Supplies goods or services</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {selectedPartnerTypes.has("vendor") && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenConfigure("vendor");
                    }}
                    className="inline-flex items-center gap-1 px-2 py-[5px] rounded-md bg-white/80 border border-[#93C5FD]/40 text-[#2563EB] text-[11px] hover:bg-white hover:border-[#93C5FD]/70 hover:shadow-sm transition-all duration-150 shrink-0"
                    style={{ fontWeight: 500 }}
                  >
                    <Settings2 className="w-3 h-3" />
                    <span className="hidden min-[480px]:inline">Configure</span>
                  </button>
                )}
                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                  selectedPartnerTypes.has("vendor")
                    ? "bg-[#3B82F6] shadow-[0_0_0_2px_rgba(59,130,246,0.15)]"
                    : "border-[1.5px] border-[#D1D5DB] bg-white group-hover:border-[#93C5FD]"
                }`}>
                  {selectedPartnerTypes.has("vendor") && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                </div>
              </div>
            </div>
          </div>

          {/* Customer Card */}
          <div
            onClick={() => onPartnerTypeChange("customer")}
            className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
              selectedPartnerTypes.has("customer")
                ? "border-[#C4B5FD]/70 bg-white shadow-[0_1px_4px_rgba(139,92,246,0.06)]"
                : "border-[#E2E8F0] bg-white hover:border-[#D5D3EC] hover:shadow-[0_4px_16px_-4px_rgba(124,58,237,0.10)]"
            }`}
          >
            <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
              selectedPartnerTypes.has("customer")
                ? "bg-gradient-to-br from-[#F5F3FF]/50 to-transparent"
                : "bg-gradient-to-br from-[#F5F3FF]/0 to-[#F5F3FF]/0 group-hover:from-[#F5F3FF]/60 group-hover:to-transparent"
            }`} />
            <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
              <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                selectedPartnerTypes.has("customer")
                  ? "bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] text-[#7C3AED]"
                  : "bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] text-[#8B5CF6] group-hover:scale-105"
              }`}>
                <ShoppingCart className="w-[18px] h-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] transition-colors duration-150 ${
                  selectedPartnerTypes.has("customer") ? "text-[#5B21B6]" : "text-[#0F172A] group-hover:text-[#1E293B]"
                }`} style={{ fontWeight: 600 }}>Customer</p>
                <p className={`text-[11px] mt-0.5 truncate transition-colors duration-150 ${
                  selectedPartnerTypes.has("customer") ? "text-[#A78BFA]" : "text-[#94A3B8]"
                }`}>Purchases goods or services</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {selectedPartnerTypes.has("customer") && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenConfigure("customer");
                    }}
                    className="inline-flex items-center gap-1 px-2 py-[5px] rounded-md bg-white/80 border border-[#C4B5FD]/40 text-[#7C3AED] text-[11px] hover:bg-white hover:border-[#C4B5FD]/70 hover:shadow-sm transition-all duration-150 shrink-0"
                    style={{ fontWeight: 500 }}
                  >
                    <Settings2 className="w-3 h-3" />
                    <span className="hidden min-[480px]:inline">Configure</span>
                  </button>
                )}
                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                  selectedPartnerTypes.has("customer")
                    ? "bg-[#8B5CF6] shadow-[0_0_0_2px_rgba(139,92,246,0.15)]"
                    : "border-[1.5px] border-[#D1D5DB] bg-white group-hover:border-[#C4B5FD]"
                }`}>
                  {selectedPartnerTypes.has("customer") && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Global Point of Contact (Partner-Level) — compact card ── */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-6 h-6 rounded-md bg-[#0A77FF]/8 flex items-center justify-center shrink-0">
            <Globe className="w-3.5 h-3.5 text-[#0A77FF]" />
          </div>
          <div>
            <span className="text-xs sm:text-[13px] text-[#0F172A] block" style={{ fontWeight: 600 }}>Point of Contact</span>
            <span className="text-[10px] sm:text-[11px] text-[#94A3B8] block mt-px">Assign partner-level contacts across all locations</span>
          </div>
        </div>
        {selectedGlobalPocContacts.length > 0 ? (
          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden relative">
            <PocPillsRow contacts={selectedGlobalPocContacts} onManage={handleOpenSelectGlobalPoc} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Select from Contact Directory */}
            <button
              onClick={handleOpenSelectGlobalPoc}
              className="group relative rounded-xl overflow-hidden border border-[#E2E8F0] bg-white text-left transition-all duration-200 hover:border-[#BFDBFE] hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.12)] cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#EDF4FF]/0 to-[#EDF4FF]/0 group-hover:from-[#EDF4FF]/60 group-hover:to-transparent transition-all duration-300 pointer-events-none" />
              <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-[#EDF4FF] to-[#DBEAFE] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                  <Users className="w-[18px] h-[18px] text-[#0A77FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>Select from Contact Directory</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5 truncate">Browse and pick from saved contacts</p>
                </div>
              </div>
            </button>
            {/* Create new contact */}
            <button
              onClick={handleOpenCreateGlobalPoc}
              className="group relative rounded-xl overflow-hidden border border-[#E2E8F0] bg-white text-left transition-all duration-200 hover:border-[#D5D3EC] hover:shadow-[0_4px_16px_-4px_rgba(124,58,237,0.10)] cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#F5F3FF]/0 to-[#F5F3FF]/0 group-hover:from-[#F5F3FF]/60 group-hover:to-transparent transition-all duration-300 pointer-events-none" />
              <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                  <UserPlus className="w-[18px] h-[18px] text-[#7C3AED]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>Create new contact</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5 truncate">Add a new point of contact directly</p>
                </div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Select Global POC Modal */}
      <SelectPocDictionaryModal
        open={showSelectGlobalPocModal}
        onOpenChange={setShowSelectGlobalPocModal}
        contactDictionary={globalPocContactDictionary}
        pocSearch={globalPocSearch}
        onPocSearchChange={(v) => { setGlobalPocSearch(v); setGlobalPocPage(1); }}
        pocCategoryFilter={globalPocCategoryFilter}
        onPocCategoryFilterChange={(v) => { setGlobalPocCategoryFilter(v); setGlobalPocPage(1); }}
        pocDepartmentCounts={globalPocDeptCounts}
        pocPagedContacts={globalPocPagedContacts}
        pocPage={globalPocPage}
        pocTotalPages={globalPocTotalPages}
        onPocPageChange={setGlobalPocPage}
        pocTempSelected={globalPocTempSelected}
        onTogglePocTemp={handleToggleGlobalPocTemp}
        onConfirm={handleConfirmGlobalPocSelection}
        onOpenCreatePoc={handleOpenCreateGlobalPoc}
        contextLabel="this partner"
      />

      {/* Create Global POC Modal */}
      <CreatePocModal
        open={showCreateGlobalPocModal}
        onOpenChange={setShowCreateGlobalPocModal}
        contextName={partnerName}
        newPocName={gNewPocName}
        onNewPocNameChange={setGNewPocName}
        newPocDepartment={gNewPocDepartment}
        onNewPocDepartmentChange={setGNewPocDepartment}
        newPocRole={gNewPocRole}
        onNewPocRoleChange={setGNewPocRole}
        newPocLandline={gNewPocLandline}
        onNewPocLandlineChange={setGNewPocLandline}
        newPocLandlineCode={gNewPocLandlineCode}
        onNewPocLandlineCodeChange={setGNewPocLandlineCode}
        newPocExt={gNewPocExt}
        onNewPocExtChange={setGNewPocExt}
        newPocMobile={gNewPocMobile}
        onNewPocMobileChange={setGNewPocMobile}
        newPocMobileCode={gNewPocMobileCode}
        onNewPocMobileCodeChange={setGNewPocMobileCode}
        newPocEmail={gNewPocEmail}
        onNewPocEmailChange={setGNewPocEmail}
        saveAndCreateAnother={gSaveAndCreateAnother}
        onSaveAndCreateAnotherChange={setGSaveAndCreateAnother}
        onSave={handleSaveGlobalNewPoc}
      />

      {/* ── Attachments ── */}
      <AttachmentsSection />
    </div>
  );
}

// ── Partner Type Card ──
export function PartnerTypeCard({
  type,
  label,
  description,
  icon,
  isSelected,
  onSelect,
  onConfigure,
}: {
  type: "vendor" | "customer";
  label: string;
  description: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
  onConfigure: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`rounded-lg border transition-all cursor-pointer ${
        isSelected
          ? "border-[#0A77FF] bg-[#F8FAFF] shadow-[0_0_0_3px_rgba(10,119,255,0.06)]"
          : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:bg-[#FAFBFC]"
      }`}
    >
      <div className="flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-2.5 sm:py-2.5">
        <div
          className={`w-[18px] h-[18px] rounded flex items-center justify-center border-[1.5px] transition-all duration-150 shrink-0 ${
            isSelected ? "border-[#0A77FF] bg-[#0A77FF] shadow-[0_0_0_2px_rgba(10,119,255,0.12)]" : "border-[#CBD5E1] bg-white"
          }`}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 ${
          isSelected ? "bg-[#D6E8FF] text-[#0A77FF]" : "bg-[#F1F5F9] text-[#64748B]"
        }`}>
          {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4 sm:w-5 sm:h-5" })}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <p className={`text-xs sm:text-[13px] ${isSelected ? "text-[#0A77FF]" : "text-[#0F172A]"}`} style={{ fontWeight: 600 }}>{label}</p>
            {isSelected && (
              <span className="inline-flex items-center px-1.5 py-px rounded-full bg-[#EDF4FF] text-[#0A77FF] text-[9px] sm:text-[10px]" style={{ fontWeight: 600 }}>
                Selected
              </span>
            )}
          </div>
          <p className="text-[10px] sm:text-[11px] text-[#64748B] mt-px hidden min-[400px]:block">{description}</p>
        </div>
        {isSelected && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfigure();
            }}
            className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md border border-[#E2E8F0] text-[#0F172A] bg-white text-[11px] sm:text-xs hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors shrink-0"
            style={{ fontWeight: 500 }}
          >
            <Settings2 className="w-3 h-3 text-[#64748B]" />
            <span className="hidden min-[480px]:inline">Configure</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Attachments Section ──
function AttachmentsSection() {
  const [files, setFiles] = useState<{ id: string; name: string; size: string; type: string }[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles = Array.from(fileList).map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: f.name,
      size: formatFileSize(f.size),
      type: f.type,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleRemove = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return "\u{1F5BC}\u{FE0F}";
    if (type.includes("pdf")) return "\u{1F4C4}";
    if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) return "\u{1F4CA}";
    if (type.includes("word") || type.includes("document")) return "\u{1F4DD}";
    return "\u{1F4CE}";
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-6 h-6 rounded-md bg-[#0A77FF]/8 flex items-center justify-center shrink-0">
          <Paperclip className="w-3.5 h-3.5 text-[#0A77FF]" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>Attachments</span>
          {files.length > 0 && (
            <span className="text-[10px] text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.5 rounded-full" style={{ fontWeight: 500 }}>{files.length}</span>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-lg border-2 border-dashed p-3 sm:p-4 text-center cursor-pointer transition-all ${
          dragActive
            ? "border-[#0A77FF] bg-[#EDF4FF]/30"
            : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:bg-[#FAFBFC]"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-2">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            dragActive ? "bg-[#D6E8FF] text-[#0A77FF]" : "bg-[#F1F5F9] text-[#94A3B8]"
          }`}>
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-[#0F172A]" style={{ fontWeight: 500 }}>
              <span className="text-[#0A77FF]">Click to upload</span><span className="hidden sm:inline"> or drag and drop</span>
            </p>
            <p className="text-[10px] sm:text-xs text-[#94A3B8] mt-0.5">PDF, DOC, XLS, PNG, JPG up to 10MB</p>
          </div>
        </div>
      </div>

      {/* Uploaded files list */}
      {files.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-[#E2E8F0] bg-white hover:bg-[#FAFBFC] transition-colors group"
            >
              <span className="text-base">{getFileIcon(file.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#0F172A] truncate" style={{ fontWeight: 500 }}>{file.name}</p>
                <p className="text-[11px] text-[#94A3B8]">{file.size}</p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(file.id)}
                className="w-7 h-7 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
