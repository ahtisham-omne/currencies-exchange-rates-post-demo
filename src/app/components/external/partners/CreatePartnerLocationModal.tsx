import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ExpandableTextarea } from "./ExpandableTextarea";
import { useVendors } from "./VendorContext";
import {
  SHIPPING_CARRIER_CATALOG,
  SHIPPING_CARRIER_METHODS,
  ShippingMethodCarrierCard,
  type ShippingCarrierEntry,
} from "./ShippingCarrierCard";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../ui/popover";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import {
  Search,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Maximize2,
  Minimize2,
  AlertTriangle,
  MapPin,
  Info,
  Camera,
  Users,
  UserPlus,
  Paperclip,
  FileText,
  Trash2,
  Upload,
  Settings2,
  Receipt,
  Truck,
  Pencil,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import {
  CONTACT_DICTIONARY,
  type ContactPerson,
} from "./partnerConstants";
import { SelectPocDictionaryModal, CreatePocModal } from "./PocModals";
import { PocPillsRow } from "./PocPillComponents";
import { AddressAutocomplete } from "./AddressAutocomplete";

interface CreatePartnerLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationCreated?: (data: Record<string, unknown>) => void;
  vendorName?: string;
  editData?: {
    locationName?: string;
    phone?: string;
    email?: string;
    address?: string;
    status?: "Active" | "Inactive";
    description?: string;
    image?: string;
    /** Pre-select these POC ids in the "Add point of contact" section. */
    pocIds?: string[];
  } | null;
}

const COUNTRY_CODES = [
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
];

const MOCK_ADDRESS_SUGGESTIONS = [
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
  { main: "Rua Augusta 274", secondary: "S\u00e3o Paulo, SP 01305-000, Brazil" },
  { main: "100 Universal City Plaza", secondary: "Universal City, CA 91608, USA" },
];

const AVATAR_COLORS = [
  "var(--primary)", "var(--violet)", "var(--success)", "var(--destructive)", "var(--warning)",
  "#0891B2", "#4F46E5", "#BE185D", "#65A30D", "#EA580C",
];

const POC_PER_PAGE = 20;

export function CreatePartnerLocationModal({
  open,
  onOpenChange,
  onLocationCreated,
  vendorName,
  editData,
}: CreatePartnerLocationModalProps) {
  const isEditMode = !!editData;
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);

  // Location Info
  const [locationName, setLocationName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+1");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  const [description, setDescription] = useState("");

  // Address (single-line Google Maps style)
  const [address, setAddress] = useState("");
  const [addressFocused, setAddressFocused] = useState(false);
  const [addressSelected, setAddressSelected] = useState(false);
  const addressRef = useRef<HTMLDivElement>(null);
  const addressInputWrapRef = useRef<HTMLDivElement>(null);
  const [addrDropdownPos, setAddrDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const addrInteractingRef = useRef(false);
  const addrDropdownRef = useRef<HTMLDivElement>(null);

  // Profile image
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const [profileDragOver, setProfileDragOver] = useState(false);

  // Phone country picker
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  // Point of Contact (vendor config pattern)
  const [showSelectPocModal, setShowSelectPocModal] = useState(false);
  const [showCreatePocModal, setShowCreatePocModal] = useState(false);
  const [contactDictionary, setContactDictionary] = useState<ContactPerson[]>([...CONTACT_DICTIONARY]);
  const [pocSearch, setPocSearch] = useState("");
  const [pocCategoryFilter, setPocCategoryFilter] = useState<"all" | "Sales" | "Supply Chain Management" | "Finance">("all");
  const [pocPage, setPocPage] = useState(1);
  const [pocTempSelected, setPocTempSelected] = useState<Set<string>>(new Set());
  const [selectedPocIds, setSelectedPocIds] = useState<Set<string>>(new Set());

  // Create new POC form
  const [newPocName, setNewPocName] = useState("");
  const [newPocDepartment, setNewPocDepartment] = useState("Sales");
  const [newPocRole, setNewPocRole] = useState("");
  const [newPocLandline, setNewPocLandline] = useState("");
  const [newPocLandlineCode, setNewPocLandlineCode] = useState("+1");
  const [newPocExt, setNewPocExt] = useState("");
  const [newPocMobile, setNewPocMobile] = useState("");
  const [newPocMobileCode, setNewPocMobileCode] = useState("+1");
  const [newPocEmail, setNewPocEmail] = useState("");
  const [saveAndCreateAnother, setSaveAndCreateAnother] = useState(false);

  // ── Configuration — location-level overrides per architecture lockdown.
  //    Pay To defaults to the partner's HQ; Ship To defaults to this location.
  //    Freight & Logistics rules can override the partner-level defaults.
  //    Pricing Rules / Payment Terms / Payment Methods / Credit Limit stay partner-only.
  //
  //    Selection model mirrors the partner creation form (CreatePartnerModal):
  //    pick a partner OR a specific location of a partner. null = inherit default.
  type ConfigTarget = { partnerId: string; partnerName: string; locationId: string | null; locationName: string | null; address: string | null };
  const [payToTarget, setPayToTarget] = useState<ConfigTarget | null>(null);
  const [shipToTarget, setShipToTarget] = useState<ConfigTarget | null>(null);

  // Picker modal state — opens "Select Pay To" / "Select Ship To" / "Add Freight & Logistics"
  // pickers, mirroring the partner Configure Vendor flow.
  const [payToPickerOpen, setPayToPickerOpen] = useState(false);
  const [shipToPickerOpen, setShipToPickerOpen] = useState(false);
  const [addFreightOpen, setAddFreightOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerExpandedPartners, setPickerExpandedPartners] = useState<Set<string>>(new Set());

  // Freight & Logistics — canonical model mirrors CreatePartnerModal:
  //   draft list (one card per carrier in modal) → saved list (rendered on
  //   Configuration card). carrierId / methodIds reference SHIPPING_CARRIER_CATALOG
  //   + SHIPPING_CARRIER_METHODS so labels + logos round-trip with the rest of
  //   the system. primaryMethodId tracks the method shown as primary on the
  //   saved card (mirrors partner detail Freight & Logistics tab).
  type FreightDraft = { id: string; carrierId: string; methodIds: string[]; primaryMethodId: string | null };
  type SavedFreight = { id: string; carrierId: string; methodIds: string[]; primaryMethodId: string | null; isDefault: boolean; inherited?: boolean };
  const [freightDrafts, setFreightDrafts] = useState<FreightDraft[]>([]);
  const [savedFreightCarriers, setSavedFreightCarriers] = useState<SavedFreight[]>([]);
  const [editingFreightId, setEditingFreightId] = useState<string | null>(null);
  // Track which carrier the user is about to remove so we can confirm before
  // dropping it. Avoids accidental clicks losing inherited defaults.
  const [freightToRemove, setFreightToRemove] = useState<SavedFreight | null>(null);
  const [freightCarrierDropdownOpen, setFreightCarrierDropdownOpen] = useState<Record<string, boolean>>({});
  const [freightMethodDropdownOpen, setFreightMethodDropdownOpen] = useState<Record<string, boolean>>({});
  const [freightCarrierSearches, setFreightCarrierSearches] = useState<Record<string, string>>({});
  const [freightMethodSearches, setFreightMethodSearches] = useState<Record<string, string>>({});

  // Vendor list for the Pay To / Ship To pickers (real partners from the data layer).
  const { vendors: allVendors } = useVendors();
  const togglePickerExpand = useCallback((partnerId: string) => {
    setPickerExpandedPartners((prev) => {
      const next = new Set(prev);
      if (next.has(partnerId)) next.delete(partnerId); else next.add(partnerId);
      return next;
    });
  }, []);
  const filteredPickerVendors = useMemo(() => {
    if (!pickerSearch.trim()) return allVendors;
    const q = pickerSearch.toLowerCase();
    return allVendors.filter((v) => {
      const matchPartner = v.displayName.toLowerCase().includes(q) || v.companyName.toLowerCase().includes(q);
      const matchLocation = (v.partnerLocations || []).some((l) => l.toLowerCase().includes(q));
      return matchPartner || matchLocation;
    });
  }, [allVendors, pickerSearch]);

  // Freight modal draft helpers — keep parity with CreatePartnerModal patterns.
  const openAddFreightModal = useCallback(() => {
    setEditingFreightId(null);
    setFreightDrafts([{ id: `fd-${Date.now()}`, carrierId: "", methodIds: [], primaryMethodId: null }]);
    setFreightCarrierDropdownOpen({});
    setFreightMethodDropdownOpen({});
    setFreightCarrierSearches({});
    setFreightMethodSearches({});
    setAddFreightOpen(true);
  }, []);
  // Open the same modal pre-seeded with a saved carrier's draft so users can
  // edit methods + primary in place. The Save handler replaces the carrier
  // when editingFreightId is set.
  const openEditFreightModal = useCallback((carrierId: string) => {
    const target = savedFreightCarriers.find((c) => c.id === carrierId);
    if (!target) return;
    setEditingFreightId(carrierId);
    setFreightDrafts([{
      id: target.id,
      carrierId: target.carrierId,
      methodIds: [...target.methodIds],
      primaryMethodId: target.primaryMethodId,
    }]);
    setFreightCarrierDropdownOpen({});
    setFreightMethodDropdownOpen({});
    setFreightCarrierSearches({});
    setFreightMethodSearches({});
    setAddFreightOpen(true);
  }, [savedFreightCarriers]);
  // Single-primary constraint across saved carriers — clicking the star on
  // one card promotes it and demotes any other primary.
  const toggleFreightCarrierPrimary = useCallback((carrierId: string) => {
    setSavedFreightCarriers((prev) => prev.map((c) => ({ ...c, isDefault: c.id === carrierId })));
  }, []);
  const updateFreightDraft = useCallback((id: string, updates: Partial<FreightDraft>) => {
    setFreightDrafts((prev) => prev.map((d) => d.id === id ? { ...d, ...updates } : d));
  }, []);
  const removeFreightDraft = useCallback((id: string) => {
    setFreightDrafts((prev) => prev.filter((d) => d.id !== id));
  }, []);
  const addAnotherFreightDraft = useCallback(() => {
    setFreightDrafts((prev) => [...prev, { id: `fd-${Date.now()}-${prev.length}`, carrierId: "", methodIds: [], primaryMethodId: null }]);
  }, []);
  const toggleFreightMethod = useCallback((draftId: string, methodId: string) => {
    setFreightDrafts((prev) => prev.map((d) => {
      if (d.id !== draftId) return d;
      const isRemoving = d.methodIds.includes(methodId);
      const next = isRemoving ? d.methodIds.filter((x) => x !== methodId) : [...d.methodIds, methodId];
      let nextPrimary = d.primaryMethodId;
      if (isRemoving && d.primaryMethodId === methodId) {
        nextPrimary = next[0] || null;
      } else if (!isRemoving && !d.primaryMethodId) {
        nextPrimary = methodId;
      }
      return { ...d, methodIds: next, primaryMethodId: nextPrimary };
    }));
  }, []);
  const setFreightPrimaryMethod = useCallback((draftId: string, methodId: string) => {
    setFreightDrafts((prev) => prev.map((d) => d.id === draftId ? { ...d, primaryMethodId: methodId } : d));
  }, []);
  const saveFreightDrafts = useCallback(() => {
    const valid = freightDrafts.filter((d) => d.carrierId && d.methodIds.length > 0);
    if (valid.length === 0) {
      toast.error("Pick a carrier and at least one method.");
      return;
    }
    if (editingFreightId) {
      const edited = valid[0];
      setSavedFreightCarriers((prev) => prev.map((c) => c.id === editingFreightId
        ? { ...c, carrierId: edited.carrierId, methodIds: [...edited.methodIds], primaryMethodId: edited.primaryMethodId, inherited: false }
        : c));
      toast.success("Carrier updated");
    } else {
      setSavedFreightCarriers((prev) => {
        const hasPrimary = prev.some((c) => c.isDefault);
        return [
          ...prev,
          ...valid.map((d, idx) => ({
            id: d.id,
            carrierId: d.carrierId,
            methodIds: [...d.methodIds],
            primaryMethodId: d.primaryMethodId,
            isDefault: !hasPrimary && idx === 0,
          })),
        ];
      });
      toast.success(`${valid.length} carrier${valid.length === 1 ? "" : "s"} added`);
    }
    setAddFreightOpen(false);
    setFreightDrafts([]);
    setEditingFreightId(null);
  }, [freightDrafts, editingFreightId]);

  // Attachments
  const [attachments, setAttachments] = useState<{ id: string; name: string; size: string; type: string }[]>([]);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [attachDragActive, setAttachDragActive] = useState(false);
  const handleAttachFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).map((f) => ({
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: f.name,
      size: f.size < 1024 ? `${f.size} B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(1)} KB` : `${(f.size / 1048576).toFixed(1)} MB`,
      type: f.type.split("/")[1]?.toUpperCase() || "FILE",
    }));
    setAttachments(prev => [...prev, ...newFiles]);
  }, []);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Populate fields when editing
  useEffect(() => {
    if (open && editData) {
      setLocationName(editData.locationName || "");
      setPhone(editData.phone?.replace(/^\+\d+\s*/, "") || "");
      setEmail(editData.email || "");
      setAddress(editData.address || "");
      setStatus((editData.status as "Active" | "Inactive") || "Active");
      setDescription(editData.description || "");
      if (editData.image) setProfileImage(editData.image);
      if (editData.pocIds && editData.pocIds.length > 0) {
        setSelectedPocIds(new Set(editData.pocIds));
      }
    }
  }, [open, editData]);

  // Seed Freight & Logistics defaults from the partner's inherited rules.
  // Per stakeholder spec: instead of an Inherit/Override toggle, surface the
  // partner's freight cards directly as Inherited defaults; user can remove
  // the ones that don't apply at this location, or stack more via Add Freight.
  useEffect(() => {
    if (!open) return;
    setSavedFreightCarriers((prev) => {
      if (prev.length > 0) return prev;
      const fedex = SHIPPING_CARRIER_METHODS["fedex"] || [];
      const dhl = SHIPPING_CARRIER_METHODS["dhl"] || [];
      const fedexAir = fedex.find((m) => m.id === "fedex-air");
      const fedexGround = fedex.find((m) => m.id === "fedex-ground");
      const dhlExpress = dhl.find((m) => m.id === "dhl-express");
      return [
        {
          id: "inh-fedex",
          carrierId: "fedex",
          methodIds: [fedexAir?.id, fedexGround?.id].filter(Boolean) as string[],
          primaryMethodId: fedexAir?.id || null,
          isDefault: true,
          inherited: true,
        },
        {
          id: "inh-dhl",
          carrierId: "dhl",
          methodIds: dhlExpress ? [dhlExpress.id] : [],
          primaryMethodId: dhlExpress?.id || null,
          isDefault: false,
          inherited: true,
        },
      ];
    });
  }, [open]);

  const statusConfig = {
    Active: { text: "#065F46", bg: "#ECFDF5", border: "#A7F3D0", label: "Active" },
    Inactive: { text: "#92400E", bg: "#FFFBEB", border: "#FDE68A", label: "Inactive" },
  } as const;

  const filteredPhoneCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRY_CODES;
    const q = countrySearch.toLowerCase();
    return COUNTRY_CODES.filter(
      (c) => c.country.toLowerCase().includes(q) || c.code.includes(q)
    );
  }, [countrySearch]);

  const selectedPhoneCountry = useMemo(() => {
    return COUNTRY_CODES.find((c) => c.code === phoneCountryCode) || COUNTRY_CODES[0];
  }, [phoneCountryCode]);

  // Address suggestions (Google Places-style mock — fuzzy match on all parts)
  const addressSuggestions = useMemo(() => {
    if (!address.trim() || address.length < 2 || addressSelected) return [];
    const words = address.toLowerCase().split(/\s+/).filter(Boolean);
    return MOCK_ADDRESS_SUGGESTIONS.filter((s) => {
      const full = `${s.main} ${s.secondary}`.toLowerCase();
      return words.every(w => full.includes(w));
    }).slice(0, 6);
  }, [address, addressSelected]);

  // Close address dropdown when clicking outside (checks both input area and portal dropdown)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (addressRef.current?.contains(target)) return;
      if (addrDropdownRef.current?.contains(target)) return;
      setAddressFocused(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute address dropdown position for portal rendering
  useEffect(() => {
    if (!addressFocused || !addressInputWrapRef.current) { setAddrDropdownPos(null); return; }
    const updatePos = () => {
      const el = addressInputWrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setAddrDropdownPos({ top: r.bottom, left: r.left, width: r.width });
    };
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => { window.removeEventListener("scroll", updatePos, true); window.removeEventListener("resize", updatePos); };
  }, [addressFocused, address]);

  const handleProfileFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (e) => setProfileImage(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  // POC logic
  const pocDepartmentCounts = useMemo(() => {
    const counts: Record<string, number> = { Sales: 0, "Supply Chain Management": 0, Finance: 0 };
    contactDictionary.forEach((c) => { counts[c.department] = (counts[c.department] || 0) + 1; });
    return counts;
  }, [contactDictionary]);

  const filteredPocContacts = useMemo(() => {
    let list = contactDictionary;
    if (pocCategoryFilter !== "all") {
      list = list.filter((c) => c.department === pocCategoryFilter);
    }
    if (pocSearch.trim()) {
      const q = pocSearch.toLowerCase();
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.company.toLowerCase().includes(q)
      );
    }
    return list;
  }, [pocCategoryFilter, pocSearch, contactDictionary]);

  const pocTotalPages = Math.max(1, Math.ceil(filteredPocContacts.length / POC_PER_PAGE));
  const pocPagedContacts = filteredPocContacts.slice((pocPage - 1) * POC_PER_PAGE, pocPage * POC_PER_PAGE);

  const selectedPocContacts = useMemo(() => {
    return contactDictionary.filter((c) => selectedPocIds.has(c.id));
  }, [selectedPocIds, contactDictionary]);

  function handleOpenSelectPoc() {
    setPocTempSelected(new Set(selectedPocIds));
    setPocSearch("");
    setPocCategoryFilter("all");
    setPocPage(1);
    setShowSelectPocModal(true);
  }

  function handleConfirmPocSelection() {
    setSelectedPocIds(new Set(pocTempSelected));
    setShowSelectPocModal(false);
    toast.success(`${pocTempSelected.size} point of contact${pocTempSelected.size !== 1 ? "s" : ""} selected`);
  }

  function handleTogglePocTemp(id: string) {
    setPocTempSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleRemovePoc(id: string) {
    setSelectedPocIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function resetNewPocForm() {
    setNewPocName("");
    setNewPocDepartment("");
    setNewPocRole("");
    setNewPocLandline("");
    setNewPocLandlineCode("+1");
    setNewPocExt("");
    setNewPocMobile("");
    setNewPocMobileCode("+1");
    setNewPocEmail("");
  }

  function handleOpenCreatePoc() {
    resetNewPocForm();
    setSaveAndCreateAnother(false);
    setShowCreatePocModal(true);
  }

  function handleSaveNewPoc() {
    if (!newPocName.trim()) {
      toast.error("Name is required");
      return;
    }
    const newId = `C-NEW-${Date.now()}`;
    const avatarColor = AVATAR_COLORS[contactDictionary.length % AVATAR_COLORS.length];
    const newContact: ContactPerson = {
      id: newId,
      name: newPocName.trim(),
      company: vendorName || "New Partner",
      department: newPocDepartment,
      phone: newPocLandline ? `${newPocLandlineCode} ${newPocLandline}` : "",
      phoneExt: newPocExt,
      secondaryPhone: newPocMobile ? `${newPocMobileCode} ${newPocMobile}` : "",
      secondaryPhoneExt: "",
      email: newPocEmail,
      avatarColor,
    };
    setContactDictionary((prev) => [newContact, ...prev]);
    setPocTempSelected((prev) => {
      const next = new Set(prev);
      next.add(newId);
      return next;
    });
    toast.success(`"${newContact.name}" added to Contact Directory`);
    if (saveAndCreateAnother) {
      resetNewPocForm();
    } else {
      setShowCreatePocModal(false);
    }
  }

  const handleDiscard = useCallback(() => {
    setIsFullScreen(false);
    setShowCancelConfirmation(false);
    setLocationName("");
    setPhone("");
    setPhoneCountryCode("+1");
    setEmail("");
    setStatus("Active");
    setDescription("");
    setAddress("");
    setAddressFocused(false);
    setAddressSelected(false);
    setProfileImage(null);
    setSelectedPocIds(new Set());
    setAttachments([]);
    setContactSearch("");
    setCountrySearch("");
    setCountryPickerOpen(false);
    setErrors({});
    onOpenChange(false);
  }, [onOpenChange]);

  // Alias for backward compat
  const [contactSearch, setContactSearch] = useState("");

  const hasAnyProgress = useMemo(() => {
    return (
      locationName.trim().length > 0 ||
      phone.trim().length > 0 ||
      email.trim().length > 0 ||
      address.length > 0 ||
      description.length > 0 ||
      selectedPocIds.size > 0
    );
  }, [locationName, phone, email, address, description, selectedPocIds]);

  const handleCancelAttempt = useCallback(() => {
    if (!hasAnyProgress) {
      handleDiscard();
      return;
    }
    setShowCancelConfirmation(true);
  }, [hasAnyProgress, handleDiscard]);

  const handleConfirmCancel = useCallback(() => {
    setShowCancelConfirmation(false);
    handleDiscard();
  }, [handleDiscard]);

  const handleOpenChange = useCallback(
    (val: boolean) => {
      if (!val) {
        if (!hasAnyProgress) {
          handleDiscard();
        } else {
          setShowCancelConfirmation(true);
        }
      } else {
        onOpenChange(val);
      }
    },
    [onOpenChange, hasAnyProgress, handleDiscard]
  );

  const handleSave = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!locationName.trim()) newErrors.locationName = "Location name is required";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const data = {
      locationName: locationName.trim(),
      phone: phone ? `${phoneCountryCode} ${phone}` : "",
      email,
      address,
      status,
      description,
      contacts: Array.from(selectedPocIds),
      profileImage: profileImage || "",
    };

    if (onLocationCreated) {
      onLocationCreated(data);
    }

    toast.success("Partner location created successfully");
    handleDiscard();
  }, [locationName, phone, phoneCountryCode, email, address, status, description, selectedPocIds, profileImage, onLocationCreated, handleDiscard]);

  // ── Helper: format VendorAddress to single-line string (used by pickers) ──
  const formatVendorAddress = useCallback((addr: { street: string; city: string; state: string; zipCode: string; country: string } | undefined | null): string | null => {
    if (!addr) return null;
    const parts = [addr.street, addr.city, [addr.state, addr.zipCode].filter(Boolean).join(" "), addr.country].filter(Boolean);
    return parts.join(", ");
  }, []);

  // ── Shared accordion target picker — mirrors renderPartnerSelectionDialog
  //    from CreatePartnerModal: header with icon-square + title + subtitle +
  //    close, search input, accordion list of partners with their locations
  //    expandable, Done button at bottom. Reused for both Pay To and Ship To.
  const renderTargetPicker = useCallback((args: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selected: ConfigTarget | null;
    onSelect: (target: ConfigTarget | null) => void;
    config: { icon: React.ReactNode; iconBg: string; title: string; description: string };
  }) => {
    const { open: pickerOpen, onOpenChange, selected, onSelect, config } = args;
    const hasSearch = pickerSearch.trim().length > 0;

    const close = () => { onOpenChange(false); setPickerSearch(""); setPickerExpandedPartners(new Set()); };

    return (
      <Dialog open={pickerOpen} onOpenChange={(o) => { if (!o) close(); else onOpenChange(true); }}>
        <DialogContent
          className="!max-w-[520px] p-0 gap-0 rounded-2xl border-0 overflow-hidden"
          style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
          hideCloseButton
        >
          <DialogTitle className="sr-only">{config.title}</DialogTitle>
          <DialogDescription className="sr-only">{config.description}</DialogDescription>
          <div className="px-5 pt-4 pb-3 border-b border-muted">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: config.iconBg }}>{config.icon}</div>
                <div>
                  <h3 className="text-sm text-foreground" style={{ fontWeight: 600 }}>{config.title}</h3>
                  <p className="text-[11px] text-slate-500">{config.description}</p>
                </div>
              </div>
              <button onClick={close} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all"><X className="w-4 h-4" /></button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search partners & locations..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {filteredPickerVendors.length === 0 ? (
              <div className="py-10 text-center">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500" style={{ fontWeight: 500 }}>No results found</p>
                <p className="text-xs text-slate-400 mt-0.5">Try a different search term</p>
              </div>
            ) : (
              <div className="py-1">
                {filteredPickerVendors.map((v) => {
                  const partnerInitials = v.displayName.split(/\s+/).map((p) => p.charAt(0)).slice(0, 2).join("").toUpperCase();
                  const partnerAddress = formatVendorAddress(v.billingAddress);
                  const isPartnerSelected = selected?.partnerId === v.id && !selected?.locationId;
                  const isExpanded = hasSearch ? true : pickerExpandedPartners.has(v.id);
                  const allLocs = v.partnerLocations || [];
                  const locsToShow = hasSearch
                    ? allLocs.filter((l) => l.toLowerCase().includes(pickerSearch.toLowerCase()))
                    : allLocs;
                  const hasLocs = locsToShow.length > 0;
                  return (
                    <div key={v.id} className="border-b border-slate-50 last:border-b-0">
                      <div className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50 ${isPartnerSelected ? "bg-accent/60" : ""}`}>
                        {hasLocs ? (
                          <button onClick={(e) => { e.stopPropagation(); togglePickerExpand(v.id); }} className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-500 hover:bg-muted transition-all shrink-0">
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        ) : <div className="w-5 h-5 shrink-0" />}
                        <div className="w-8 h-8 rounded-md flex items-center justify-center text-white text-[10px] shrink-0" style={{ fontWeight: 700, backgroundColor: "#1E293B" }}>{partnerInitials}</div>
                        <button
                          onClick={() => { onSelect({ partnerId: v.id, partnerName: v.displayName, locationId: null, locationName: null, address: partnerAddress }); close(); }}
                          className="flex flex-col min-w-0 flex-1 text-left"
                        >
                          <span className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{v.displayName}</span>
                          {partnerAddress && (
                            <span className="text-[11px] text-slate-500 truncate mt-0.5">{partnerAddress}</span>
                          )}
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          {hasLocs && <span className="text-[10px] text-slate-400 bg-slate-50 border border-[#E8ECF1] px-1.5 py-0.5 rounded" style={{ fontWeight: 500 }}>{locsToShow.length} loc{locsToShow.length !== 1 ? "s" : ""}</span>}
                          {isPartnerSelected && <Check className="w-4 h-4 text-primary" />}
                        </div>
                      </div>
                      {isExpanded && hasLocs && (
                        <div className="ml-9 border-l border-[#E8ECF1] bg-[#FAFBFC]/50">
                          {locsToShow.map((locName) => {
                            const isLocSelected = selected?.partnerId === v.id && selected?.locationName === locName;
                            return (
                              <button
                                key={`${v.id}-${locName}`}
                                onClick={() => { onSelect({ partnerId: v.id, partnerName: v.displayName, locationId: locName, locationName: locName, address: partnerAddress }); close(); }}
                                className={`w-full flex items-center gap-3 pl-4 pr-4 py-2 text-left transition-colors hover:bg-muted ${isLocSelected ? "bg-accent/60" : ""}`}
                              >
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{locName}</span>
                                </div>
                                {isLocSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="px-4 py-3 border-t border-muted bg-[#FAFBFC] flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              {selected ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] shrink-0" />
                  <span className="text-xs text-slate-700 truncate" style={{ fontWeight: 500 }}>Selected: <span style={{ fontWeight: 600 }}>{selected.locationName || selected.partnerName}</span></span>
                </>
              ) : (
                <span className="text-[11px] text-slate-500">Inherits partner default until you pick one.</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selected && (
                <button type="button" onClick={() => { onSelect(null); close(); }} className="h-8 px-3 rounded-lg border border-border bg-white text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer" style={{ fontWeight: 500 }}>Clear</button>
              )}
              <button onClick={close} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs hover:bg-[#0966DB] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>Done</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }, [pickerSearch, pickerExpandedPartners, filteredPickerVendors, formatVendorAddress, togglePickerExpand]);

  // Form-modal sizing standard — single-screen creation form, hugs content
  // vertically with width capped at 1320px on wide monitors.
  const modalBaseTransition = "transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";

  const modalSizeClass = isFullScreen
    ? `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl`
    : `!fixed !top-[50%] !left-[50%] !translate-x-[-50%] !translate-y-[-50%] !w-[calc(100%-2rem)] ${modalBaseTransition} !max-w-[100%] sm:!max-w-[min(70vw,1320px)] !max-h-[100dvh] sm:!max-h-[90vh] rounded-none sm:!rounded-2xl`;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className={`flex flex-col p-0 gap-0 border-0 sm:border ${modalSizeClass}`}
          hideCloseButton
          style={{
            boxShadow:
              "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
          }}
        >
          <DialogTitle className="sr-only">{isEditMode ? "Edit Partner Location" : "Create New Partner Location"}</DialogTitle>
          <DialogDescription className="sr-only">
            Configure the details for the new partner location.
          </DialogDescription>

          {/* Header */}
          <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-2.5 sm:pb-3 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2
                  className="text-[15px] sm:text-[17px] text-foreground"
                  style={{ fontWeight: 700 }}
                >
                  {isEditMode ? "Edit Partner Location" : "Create New Partner Location"}
                </h2>
                <p
                  className="text-[11px] sm:text-xs text-slate-500 mt-0.5"
                  style={{ fontWeight: 400 }}
                >
                  {vendorName
                    ? (isEditMode ? `Edit location details for ${vendorName}.` : `Add a new location for ${vendorName}.`)
                    : (isEditMode ? "Update the location details." : "Configure the details and address for the new location.")}
                </p>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <button
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
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
                  onClick={handleCancelAttempt}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto bg-[#FAFBFC] scrollbar-hide">
            <div className="px-4 py-4 transition-all duration-300 ease-out space-y-3 sm:space-y-4">

              {/* ── Location Details Card ── */}
              <div className="rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center gap-2 bg-[#FAFBFC] rounded-t-lg">
                  <div className="w-6 h-6 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
                    <Info className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>Location Details</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-400 tracking-wider uppercase hidden min-[480px]:inline" style={{ fontWeight: 500 }}>Required</span>
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
                          ? "ring-2 ring-border"
                          : "border-2 border-dashed border-slate-300 bg-slate-50"
                      }`}
                    >
                      {profileImage ? (
                        <img src={profileImage} alt="Profile" className="w-full h-full rounded-xl object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Camera className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-foreground" style={{ fontWeight: 500 }}>
                        {profileImage ? "Location photo" : "Add a photo"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <button
                          type="button"
                          onClick={() => profileInputRef.current?.click()}
                          className="text-[11px] text-primary"
                          style={{ fontWeight: 500 }}
                        >
                          {profileImage ? "Change" : "Upload"}
                        </button>
                        {profileImage && (
                          <>
                            <span className="text-border text-[11px]">&middot;</span>
                            <button
                              type="button"
                              onClick={() => setProfileImage(null)}
                              className="text-[11px] text-red-500"
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
                    {/* Left — Profile Picture Upload — desktop only */}
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
                            ? "ring-2 ring-border hover:ring-primary/30"
                            : profileDragOver
                            ? "border-2 border-dashed border-primary bg-accent"
                            : "border-2 border-dashed border-slate-300 hover:border-primary/50 bg-slate-50 hover:bg-accent/50"
                        }`}
                      >
                        {profileImage ? (
                          <>
                            <img
                              src={profileImage}
                              alt="Location"
                              className="w-full h-full rounded-xl object-cover"
                            />
                            <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                              <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                            <div className="w-10 h-10 rounded-lg bg-muted group-hover:bg-accent flex items-center justify-center transition-colors">
                              <Camera className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
                            </div>
                            <span className="text-[11px] text-slate-400 group-hover:text-primary transition-colors" style={{ fontWeight: 500 }}>Upload photo</span>
                            <span className="text-[9px] text-slate-300">Max 5 MB</span>
                          </div>
                        )}
                      </div>
                      {profileImage && (
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => profileInputRef.current?.click()}
                            className="text-[11px] text-primary hover:text-[#0862D0] transition-colors cursor-pointer"
                            style={{ fontWeight: 500 }}
                          >
                            Change
                          </button>
                          <span className="text-border text-[11px]">&middot;</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setProfileImage(null); }}
                            className="text-[11px] text-red-500 hover:text-destructive transition-colors cursor-pointer"
                            style={{ fontWeight: 500 }}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Right — all fields in a 2-column grid */}
                    <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-2.5 sm:gap-y-3">
                      {/* Row 1 Left: Location Name */}
                      <div>
                        <Label htmlFor="loc-name" className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                          Location Name<span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="loc-name"
                          placeholder="e.g. Toyota TTC"
                          value={locationName}
                          onChange={(e) => {
                            setLocationName(e.target.value);
                            if (errors.locationName) setErrors((p) => ({ ...p, locationName: "" }));
                          }}
                          className="mt-1 rounded-lg border-border bg-white !h-10 text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                        {errors.locationName && (
                          <p className="text-red-500 text-xs mt-1">{errors.locationName}</p>
                        )}
                      </div>

                      {/* Row 1 Right: Status */}
                      <div>
                        <Label className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>Status</Label>
                        <Select value={status} onValueChange={(val: string) => setStatus(val as "Active" | "Inactive")}>
                          <SelectTrigger className="mt-1 !h-10 rounded-lg border-border bg-white text-sm hover:border-slate-300 transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20 [&>svg]:text-slate-400">
                            <SelectValue>
                              <span
                                className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap"
                                style={{ fontWeight: 500, backgroundColor: statusConfig[status].bg, color: statusConfig[status].text, borderColor: statusConfig[status].border }}
                              >
                                {statusConfig[status].label}
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="z-[14250] rounded-lg">
                            <SelectItem value="Active">
                              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap" style={{ fontWeight: 500, backgroundColor: "#ECFDF5", color: "#065F46", borderColor: "#A7F3D0" }}>Active</span>
                            </SelectItem>
                            <SelectItem value="Inactive">
                              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap" style={{ fontWeight: 500, backgroundColor: "#FFFBEB", color: "#92400E", borderColor: "#FDE68A" }}>Inactive</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Row 2 Left: Phone Number */}
                      <div>
                        <Label htmlFor="loc-phone" className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                          Phone Number
                        </Label>
                        <div className="flex items-center gap-0 mt-1">
                          <Popover open={countryPickerOpen} onOpenChange={setCountryPickerOpen}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="flex items-center gap-1.5 pl-2.5 pr-1.5 !h-10 rounded-l-lg border border-r-0 border-border bg-white text-sm shrink-0 cursor-pointer hover:border-slate-300 transition-colors focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                              >
                                <span className="text-base leading-none">{selectedPhoneCountry.flag}</span>
                                <span className="text-xs text-slate-700" style={{ fontWeight: 600 }}>
                                  {phoneCountryCode}
                                </span>
                                <ChevronDown className="w-3 h-3 text-slate-400" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-64 p-0 z-[14200] rounded-xl shadow-lg border border-border"
                              align="start"
                              sideOffset={4}
                            >
                              <div className="p-2 border-b border-muted">
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                  <input
                                    type="text"
                                    placeholder="Search country..."
                                    value={countrySearch}
                                    onChange={(e) => setCountrySearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                                  />
                                </div>
                              </div>
                              <div className="max-h-[200px] overflow-y-auto p-1">
                                {filteredPhoneCountries.map((c, i) => (
                                  <button
                                    key={`${c.code}-${c.country}-${i}`}
                                    type="button"
                                    onClick={() => {
                                      setPhoneCountryCode(c.code);
                                      setCountryPickerOpen(false);
                                      setCountrySearch("");
                                    }}
                                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                                      phoneCountryCode === c.code && selectedPhoneCountry.country === c.country
                                        ? "bg-accent text-primary"
                                        : "hover:bg-slate-50 text-slate-700"
                                    }`}
                                  >
                                    <span className="text-base">{c.flag}</span>
                                    <span className="text-sm flex-1 truncate" style={{ fontWeight: 500 }}>
                                      {c.country}
                                    </span>
                                    <span className="text-xs text-slate-500" style={{ fontWeight: 500 }}>
                                      {c.code}
                                    </span>
                                    {phoneCountryCode === c.code && selectedPhoneCountry.country === c.country && (
                                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                                    )}
                                  </button>
                                ))}
                                {filteredPhoneCountries.length === 0 && (
                                  <p className="text-xs text-slate-400 text-center py-4">No countries found</p>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                          <Input
                            id="loc-phone"
                            placeholder="(555) 123-4567"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="rounded-l-none rounded-r-lg border-border bg-white !h-10 text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20"
                          />
                        </div>
                      </div>

                      {/* Row 2 Right: Email */}
                      <div>
                        <Label htmlFor="loc-email" className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                          Email
                        </Label>
                        <Input
                          id="loc-email"
                          type="email"
                          placeholder="support@toyota.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="mt-1 rounded-lg border-border bg-white !h-10 text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                      </div>

                      {/* Row 3 Left: Address */}
                      <AddressAutocomplete id="loc-address" value={address} onChange={setAddress} />

                      {/* Row 3 Right: Description */}
                      <ExpandableTextarea
                        label="Description"
                        value={description}
                        onChange={setDescription}
                        placeholder="Brief summary of this location."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Configuration — location-level overrides per architecture lockdown.
                   Card design + picker dialogs + freight empty state mirror the
                   partner creation form (CreatePartnerModal): same fieldCardBase
                   border + hover, same icon/label/pencil header, same accordion
                   picker, same freight empty state. Pricing Rules / Payment
                   Terms / Payment Methods / Credit Limit stay partner-only. */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-6 h-6 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
                    <Settings2 className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>Configuration</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-600 border border-slate-200" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Optional</span>
                </div>
                <p className="text-[11.5px] text-slate-500 leading-relaxed mb-3">
                  Defaults inherit from the partner. Override here only if this location bills, ships, or moves freight differently from the partner's HQ.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Pay To — pre-filled with partner HQ default when not overridden,
                       Inherited pill in header. Mirror Currency card pattern. */}
                  {(() => {
                    const isInherited = !payToTarget;
                    const displayName = payToTarget ? (payToTarget.locationName || payToTarget.partnerName) : (vendorName || "Partner HQ");
                    const subtitle = payToTarget?.locationName ? payToTarget.partnerName : (isInherited ? "Partner default · Tap to override" : null);
                    const initials = displayName.split(/\s+/).map((p) => p.charAt(0)).slice(0, 2).join("").toUpperCase();
                    return (
                      <div
                        className="group relative rounded-xl border border-[#E8ECF1] bg-white hover:border-slate-300 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] transition-all duration-200 cursor-pointer p-3 flex flex-col gap-2.5"
                        onClick={() => { setPickerSearch(""); setPickerExpandedPartners(new Set()); setPayToPickerOpen(true); }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Receipt className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Pay To</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" className="inline-flex shrink-0" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
                                  <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[14300]">The entity that receives payment for transactions at this location. Defaults to the partner's Pay To. Change this only if billing for this location should route to a different party, such as a regional billing entity or parent company.</TooltipContent>
                            </Tooltip>
                            {isInherited ? (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[9.5px] border bg-[#EEF2FF] text-[#4338CA] border-[#E0E7FF]"
                                style={{ fontWeight: 600 }}
                                title="Inherited from partner default"
                              >
                                <Check className="w-2.5 h-2.5" /> Inherited
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[9.5px] border bg-amber-50 text-amber-800 border-amber-200"
                                style={{ fontWeight: 600 }}
                                title="Overridden — click to change or clear back to partner default"
                              >
                                Overridden
                              </span>
                            )}
                          </div>
                          {!isInherited ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setPayToTarget(null); }}
                              className="text-[10px] text-primary hover:underline cursor-pointer shrink-0"
                              style={{ fontWeight: 500 }}
                            >
                              Revert
                            </button>
                          ) : (
                            <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[12px] shrink-0" style={{ fontWeight: 700, backgroundColor: "#1E293B" }}>
                            {initials || "—"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{displayName}</p>
                            {subtitle && <p className="text-[11px] text-slate-500 truncate mt-0.5">{subtitle}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Ship To — pre-filled with this location's data when not overridden,
                       Inherited pill in header. */}
                  {(() => {
                    const isInherited = !shipToTarget;
                    const displayName = shipToTarget ? (shipToTarget.locationName || shipToTarget.partnerName) : (locationName || "This location");
                    const displayAddress = shipToTarget ? shipToTarget.address : (address || null);
                    const initials = displayName.split(/\s+/).map((p) => p.charAt(0)).slice(0, 2).join("").toUpperCase();
                    return (
                      <div
                        className="group relative rounded-xl border border-[#E8ECF1] bg-white hover:border-slate-300 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] transition-all duration-200 cursor-pointer p-3 flex flex-col gap-2"
                        onClick={() => { setPickerSearch(""); setPickerExpandedPartners(new Set()); setShipToPickerOpen(true); }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Truck className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Ship To</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" className="inline-flex shrink-0" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
                                  <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[14300]">The default delivery destination for goods at this location. Defaults to this location's address. Change this only if shipments for this location are regularly delivered to a different address.</TooltipContent>
                            </Tooltip>
                            {isInherited ? (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[9.5px] border bg-[#EEF2FF] text-[#4338CA] border-[#E0E7FF]"
                                style={{ fontWeight: 600 }}
                                title="This location is the default Ship To address"
                              >
                                <Check className="w-2.5 h-2.5" /> Inherited
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[9.5px] border bg-amber-50 text-amber-800 border-amber-200"
                                style={{ fontWeight: 600 }}
                                title="Overridden — click to change or clear back to this location"
                              >
                                Overridden
                              </span>
                            )}
                          </div>
                          {!isInherited ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setShipToTarget(null); }}
                              className="text-[10px] text-primary hover:underline cursor-pointer shrink-0"
                              style={{ fontWeight: 500 }}
                            >
                              Revert
                            </button>
                          ) : (
                            <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                        <div className="flex items-start gap-2.5">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[12px] shrink-0" style={{ fontWeight: 700, backgroundColor: "#1E293B" }}>
                            {initials || "—"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{displayName}</p>
                            {displayAddress ? (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayAddress)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[11px] text-slate-500 hover:text-primary hover:underline flex items-start gap-1 mt-1 leading-snug transition-colors"
                              >
                                <MapPin className="w-3 h-3 shrink-0 text-slate-400 mt-[2px]" />
                                <span className="break-words">{displayAddress}</span>
                              </a>
                            ) : (
                              <p className="text-[11px] text-slate-400 mt-0.5">Set the address above to preview</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Freight & Logistics — full-width second row.
                      Defaults seeded from the partner's inherited rules so users
                      see something concrete instead of an empty state. Inherited
                      cards carry an Inherited pill; user can remove them or add
                      more carriers via the Add Freight modal. */}
                  <div className="rounded-xl border border-border bg-white sm:col-span-2 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[#EEF2F6] bg-[#FAFBFC]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center shrink-0">
                          <Truck className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-[12.5px] text-foreground" style={{ fontWeight: 600 }}>Freight &amp; Logistics</p>
                          <p className="text-[10.5px] text-slate-500 mt-px">{savedFreightCarriers.length === 0 ? "No carriers configured for this location" : `${savedFreightCarriers.length} carrier${savedFreightCarriers.length === 1 ? "" : "s"} configured`}</p>
                        </div>
                      </div>
                      {savedFreightCarriers.length > 0 && (
                        <button
                          type="button"
                          onClick={openAddFreightModal}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[12px] cursor-pointer shadow-sm transition-colors"
                          style={{ fontWeight: 600 }}
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Freight
                        </button>
                      )}
                    </div>
                    {savedFreightCarriers.length === 0 ? (
                      <div className="flex flex-col items-center text-center px-6 py-8">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                          <Truck className="w-5 h-5 text-primary" />
                        </div>
                        <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>No freight and shipping methods added</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-[340px] leading-relaxed">Choose freight and shipping methods for purchase orders and shipments at this location.</p>
                        <button
                          type="button"
                          onClick={openAddFreightModal}
                          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs transition-colors hover:bg-primary/90 shadow-sm cursor-pointer"
                          style={{ fontWeight: 600 }}
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Freight
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 items-stretch">
                        {savedFreightCarriers.map((sc) => {
                          const entry: ShippingCarrierEntry = {
                            id: sc.id,
                            carrier: sc.carrierId,
                            methods: sc.methodIds.join(","),
                            isDefault: sc.isDefault,
                            primaryMethod: sc.primaryMethodId || "",
                          };
                          return (
                            <ShippingMethodCarrierCard
                              key={sc.id}
                              entry={entry}
                              inherited={!!sc.inherited}
                              onEdit={() => openEditFreightModal(sc.id)}
                              onRemove={() => setFreightToRemove(sc)}
                              onSetPrimary={() => toggleFreightCarrierPrimary(sc.id)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Point of Contact Section — explicitly Optional. Stakeholder
                    feedback: section was reading as mandatory. Restructured
                    header label to "Add point of contact" + an Optional pill
                    so users know they can skip it. */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-6 h-6 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-[13px] text-foreground inline-flex items-center gap-1.5" style={{ fontWeight: 600 }}>
                      Add point of contact
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-600 border border-slate-200" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Optional
                      </span>
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 block mt-px">Skip this if you'd rather assign contacts later from the location detail page.</span>
                  </div>
                </div>
                {selectedPocContacts.length > 0 ? (
                  <div className="rounded-xl border border-border bg-white overflow-hidden relative">
                    <PocPillsRow contacts={selectedPocContacts} onManage={handleOpenSelectPoc} />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Select from Contact Directory */}
                    <button
                      onClick={handleOpenSelectPoc}
                      className="group relative rounded-xl overflow-hidden border border-border bg-white text-left transition-all duration-200 hover:border-blue-200 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.12)] cursor-pointer"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-accent/0 to-accent/0 group-hover:from-accent/60 group-hover:to-transparent transition-all duration-300 pointer-events-none" />
                      <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                        <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-accent to-blue-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                          <Users className="w-[18px] h-[18px] text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Select from Contact Directory</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">Browse and pick from saved contacts</p>
                        </div>
                      </div>
                    </button>
                    {/* Create new contact */}
                    <button
                      onClick={handleOpenCreatePoc}
                      className="group relative rounded-xl overflow-hidden border border-border bg-white text-left transition-all duration-200 hover:border-[#D5D3EC] hover:shadow-[0_4px_16px_-4px_rgba(124,58,237,0.10)] cursor-pointer"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-50/0 to-violet-50/0 group-hover:from-violet-50/60 group-hover:to-transparent transition-all duration-300 pointer-events-none" />
                      <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                        <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-violet-50 to-[#EDE9FE] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                          <UserPlus className="w-[18px] h-[18px] text-violet" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Create new contact</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">Add a new point of contact directly</p>
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* ── Attachments (matches partner creation form exactly) ── */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-6 h-6 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
                    <Paperclip className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>Attachments</span>
                    {attachments.length > 0 && (
                      <span className="text-[10px] text-slate-500 bg-muted px-1.5 py-0.5 rounded-full" style={{ fontWeight: 500 }}>{attachments.length}</span>
                    )}
                  </div>
                </div>
                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setAttachDragActive(true); }}
                  onDragLeave={() => setAttachDragActive(false)}
                  onDrop={(e) => { e.preventDefault(); setAttachDragActive(false); handleAttachFiles(e.dataTransfer.files); }}
                  onClick={() => attachInputRef.current?.click()}
                  className={`rounded-lg border-2 border-dashed p-3 sm:p-4 text-center cursor-pointer transition-all ${
                    attachDragActive
                      ? "border-primary bg-accent/30"
                      : "border-border bg-white hover:border-slate-300 hover:bg-[#FAFBFC]"
                  }`}
                >
                  <input ref={attachInputRef} type="file" multiple onChange={(e) => { handleAttachFiles(e.target.files); e.target.value = ""; }} className="hidden" />
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${attachDragActive ? "bg-[#D6E8FF] text-primary" : "bg-muted text-slate-400"}`}>
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-foreground" style={{ fontWeight: 500 }}>
                        <span className="text-primary">Click to upload</span><span className="hidden sm:inline"> or drag and drop</span>
                      </p>
                      <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">PDF, DOC, XLS, PNG, JPG up to 10MB</p>
                    </div>
                  </div>
                </div>
                {/* Uploaded files list */}
                {attachments.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    {attachments.map((att) => (
                      <div key={att.id} className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-border bg-white hover:bg-[#FAFBFC] transition-colors group">
                        <span className="text-base">{att.type.includes("PDF") ? "\uD83D\uDCC4" : att.type.includes("PNG") || att.type.includes("JPG") || att.type.includes("JPEG") ? "\uD83D\uDDBC\uFE0F" : att.type.includes("XLS") ? "\uD83D\uDCCA" : att.type.includes("DOC") ? "\uD83D\uDCDD" : "\uD83D\uDCCE"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate" style={{ fontWeight: 500 }}>{att.name}</p>
                          <p className="text-[11px] text-slate-400">{att.size}</p>
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setAttachments(prev => prev.filter(a => a.id !== att.id)); }} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors sm:opacity-0 sm:group-hover:opacity-100">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5 sm:rounded-b-2xl">
            <Button
              variant="outline"
              onClick={handleCancelAttempt}
              className="border-border text-slate-500 hover:text-foreground hover:border-slate-300 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm"
            >
              {isEditMode ? "Save Changes" : "Create Location"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Select Pay To / Ship To pickers — accordion design mirrors
           CreatePartnerModal renderPartnerSelectionDialog: partner list with
           expandable nested locations, Done button, optional Clear. ── */}
      {renderTargetPicker({
        open: payToPickerOpen,
        onOpenChange: setPayToPickerOpen,
        selected: payToTarget,
        onSelect: setPayToTarget,
        config: {
          icon: <Receipt className="w-4 h-4 text-violet-500" />,
          iconBg: "#F5F3FF",
          title: "Select Pay To",
          description: "Choose payment recipient",
        },
      })}
      {renderTargetPicker({
        open: shipToPickerOpen,
        onOpenChange: setShipToPickerOpen,
        selected: shipToTarget,
        onSelect: setShipToTarget,
        config: {
          icon: <Truck className="w-4 h-4 text-[#22C55E]" />,
          iconBg: "#ECFDF5",
          title: "Select Ship To",
          description: "Choose delivery destination",
        },
      })}

      {/* ── Add Freight & Logistics modal — mirrors CreatePartnerModal pattern.
           Header with Carrier · Methods chip, numbered Carrier 1/2 cards, each
           with carrier dropdown (logos + search) + methods dropdown (multi-select).
           "Add Another Carrier" CTA stacks more drafts; Cancel + Save Methods
           commit them to savedFreightCarriers. ── */}
      <Dialog open={addFreightOpen} onOpenChange={(open) => { if (!open) { setAddFreightOpen(false); setEditingFreightId(null); setFreightDrafts([]); } }}>
        <DialogContent
          className="!p-0 !gap-0 !bg-white overflow-hidden flex flex-col z-[14250] !border-border/60"
          style={{ maxWidth: "min(65vw, 720px)", width: "calc(100% - 2rem)", height: "auto", maxHeight: "90vh", borderRadius: 16, boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
          hideCloseButton
        >
          <DialogTitle className="sr-only">Add Freight &amp; Logistics</DialogTitle>
          <DialogDescription className="sr-only">Pick a carrier and the methods it offers. Add another carrier to stack multiple.</DialogDescription>

          {/* Header — title + chip + subtitle, close on the right */}
          <div className="px-5 pt-4 pb-3.5 shrink-0 bg-white rounded-t-2xl border-b border-[#EEF2F6]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-[16px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>{editingFreightId ? "Edit Freight & Logistics" : "Add Freight & Logistics"}</h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                    <Truck className="w-3 h-3" /> Carrier · Methods
                  </span>
                </div>
                <p className="text-[12px] text-slate-500 mt-1">{editingFreightId ? "Update this carrier's methods and primary." : "Pick a carrier and the methods it offers. Add another carrier below to stack multiple."}</p>
              </div>
              <button onClick={() => { setAddFreightOpen(false); setEditingFreightId(null); setFreightDrafts([]); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body — one card per draft */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-4 bg-[#FAFBFC]">
            <div className="space-y-3">
              {freightDrafts.map((draft, dIdx) => {
                const selectedCarrier = SHIPPING_CARRIER_CATALOG.find((c) => c.id === draft.carrierId);
                const carrierMethods = draft.carrierId ? (SHIPPING_CARRIER_METHODS[draft.carrierId] || []) : [];
                const carrierSearch = freightCarrierSearches[draft.id] || "";
                const methodSearch = freightMethodSearches[draft.id] || "";
                const filteredCarriers = carrierSearch.trim()
                  ? SHIPPING_CARRIER_CATALOG.filter((c) => c.name.toLowerCase().includes(carrierSearch.toLowerCase()))
                  : SHIPPING_CARRIER_CATALOG;
                const filteredMethods = methodSearch.trim()
                  ? carrierMethods.filter((m) => m.name.toLowerCase().includes(methodSearch.toLowerCase()) || (m.desc || "").toLowerCase().includes(methodSearch.toLowerCase()))
                  : carrierMethods;
                const isMulti = freightDrafts.length > 1;
                const isCarrierOpen = !!freightCarrierDropdownOpen[draft.id];
                const isMethodOpen = !!freightMethodDropdownOpen[draft.id];
                const selectedMethodEntries = carrierMethods.filter((m) => draft.methodIds.includes(m.id));

                return (
                  <div key={draft.id} className="rounded-lg bg-white border border-border overflow-hidden">
                    {/* Card header strip */}
                    <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-[#EEF2F6] bg-[#FAFBFC]">
                      <div className="flex items-center gap-2 min-w-0">
                        {selectedCarrier ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <img src={selectedCarrier.logoImg} alt={selectedCarrier.name} className="w-4 h-4 object-contain rounded shrink-0" />
                            <span className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{selectedCarrier.name}</span>
                          </div>
                        ) : (
                          <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Carrier {dIdx + 1}</span>
                        )}
                      </div>
                      {isMulti && (
                        <button
                          type="button"
                          onClick={() => removeFreightDraft(draft.id)}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                          aria-label="Remove carrier"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Card body */}
                    <div className="px-4 py-3.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Shipping Carrier */}
                        <div>
                          <Label className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Shipping Carrier<span className="text-destructive">*</span></Label>
                          <Popover open={isCarrierOpen} onOpenChange={(o) => { setFreightCarrierDropdownOpen((prev) => ({ ...prev, [draft.id]: o })); if (!o) setFreightCarrierSearches((prev) => ({ ...prev, [draft.id]: "" })); }}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="mt-1 w-full flex items-center justify-between !h-10 px-3 rounded-lg border border-border bg-white text-sm transition-colors hover:border-slate-300 cursor-pointer"
                              >
                                {selectedCarrier ? (
                                  <div className="flex items-center gap-2 min-w-0">
                                    <img src={selectedCarrier.logoImg} alt={selectedCarrier.name} className="w-6 h-6 rounded object-contain shrink-0" />
                                    <span className="text-foreground text-sm truncate">{selectedCarrier.name}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-sm">Select a carrier</span>
                                )}
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl border border-border shadow-lg z-[14300]" align="start" sideOffset={4}>
                              <div className="p-2.5 border-b border-muted">
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                  <input
                                    value={carrierSearch}
                                    onChange={(e) => setFreightCarrierSearches((prev) => ({ ...prev, [draft.id]: e.target.value }))}
                                    placeholder="Search carriers..."
                                    className="w-full h-8 pl-8 pr-2 rounded-md border border-border bg-white text-[12.5px] text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
                                    autoFocus
                                  />
                                </div>
                              </div>
                              {/* "+ Create New Carrier" pinned at top — mirrors canonical
                                   shipping-methods dropdown affordance. Wired up to a
                                   placeholder toast in the location-modal scope; carrier
                                   creation flow lives on the partner detail Carrier tab. */}
                              <button
                                type="button"
                                onClick={() => { toast.info("Carrier creation lives on the partner Freight & Logistics tab."); }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 border-b border-muted text-primary text-[12.5px] hover:bg-accent/40 transition-colors cursor-pointer"
                                style={{ fontWeight: 600 }}
                              >
                                <Plus className="w-3.5 h-3.5" /> Create New Carrier
                              </button>
                              <div className="max-h-[260px] overflow-y-auto py-1">
                                {filteredCarriers.length === 0 ? (
                                  <p className="text-center py-6 text-[12px] text-slate-400">No carriers match.</p>
                                ) : filteredCarriers.map((c) => {
                                  const isSelected = draft.carrierId === c.id;
                                  return (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => {
                                        updateFreightDraft(draft.id, { carrierId: c.id, methodIds: [], primaryMethodId: null });
                                        setFreightCarrierDropdownOpen((prev) => ({ ...prev, [draft.id]: false }));
                                        setFreightCarrierSearches((prev) => ({ ...prev, [draft.id]: "" }));
                                      }}
                                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50 ${isSelected ? "bg-accent/60" : ""}`}
                                    >
                                      <img src={c.logoImg} alt={c.name} className="w-7 h-7 rounded-md object-contain bg-white border border-[#E8ECF1] shrink-0" />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[12.5px] text-foreground truncate" style={{ fontWeight: 600 }}>{c.name}</p>
                                        <p className="text-[10.5px] text-slate-500 truncate">{c.desc}</p>
                                      </div>
                                      {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* Shipping Methods */}
                        <div>
                          <Label className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Shipping Methods<span className="text-destructive">*</span></Label>
                          <Popover open={isMethodOpen} onOpenChange={(o) => { if (!draft.carrierId) return; setFreightMethodDropdownOpen((prev) => ({ ...prev, [draft.id]: o })); if (!o) setFreightMethodSearches((prev) => ({ ...prev, [draft.id]: "" })); }}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                disabled={!draft.carrierId}
                                className="mt-1 w-full flex items-center justify-between !h-10 px-3 rounded-lg border border-border bg-white text-sm transition-colors hover:border-slate-300 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {draft.methodIds.length > 0 ? (
                                  <span className="text-foreground text-sm truncate">
                                    {draft.methodIds.length} method{draft.methodIds.length === 1 ? "" : "s"} selected
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-sm">Select methods</span>
                                )}
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl border border-border shadow-lg z-[14300]" align="start" sideOffset={4}>
                              <div className="p-2.5 border-b border-muted">
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                  <input
                                    value={methodSearch}
                                    onChange={(e) => setFreightMethodSearches((prev) => ({ ...prev, [draft.id]: e.target.value }))}
                                    placeholder="Search methods..."
                                    className="w-full h-8 pl-8 pr-2 rounded-md border border-border bg-white text-[12.5px] text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
                                    autoFocus
                                  />
                                </div>
                              </div>
                              {/* "+ Create Shipping Method" pinned at top — matches canonical pattern. */}
                              <button
                                type="button"
                                onClick={() => { toast.info("Method creation lives on the partner Freight & Logistics tab."); }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 border-b border-muted text-primary text-[12.5px] hover:bg-accent/40 transition-colors cursor-pointer"
                                style={{ fontWeight: 600 }}
                              >
                                <Plus className="w-3.5 h-3.5" /> Create Shipping Method
                              </button>
                              <div className="max-h-[260px] overflow-y-auto py-1">
                                {filteredMethods.length === 0 ? (
                                  <p className="text-center py-6 text-[12px] text-slate-400">No methods match.</p>
                                ) : filteredMethods.map((m) => {
                                  const checked = draft.methodIds.includes(m.id);
                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => toggleFreightMethod(draft.id, m.id)}
                                      className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50 ${checked ? "bg-accent/40" : ""}`}
                                    >
                                      <div className={`mt-0.5 w-4 h-4 rounded border-[1.5px] flex items-center justify-center shrink-0 ${checked ? "border-primary bg-primary" : "border-border bg-white"}`}>
                                        {checked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[12.5px] text-foreground" style={{ fontWeight: 600 }}>{m.name}</p>
                                        {m.desc && <p className="text-[10.5px] text-slate-500 mt-0.5 line-clamp-1">{m.desc}</p>}
                                      </div>
                                      <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px]" style={{ fontWeight: 600 }}>
                                        {m.minDays === m.maxDays ? `${m.minDays}d` : `${m.minDays}-${m.maxDays}d`}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      {/* Selected method chips with Primary toggle — mirrors
                           canonical pattern. Click chip body to set Primary,
                           hit X to remove. */}
                      {selectedMethodEntries.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {selectedMethodEntries.map((m) => {
                            const isPrimary = draft.primaryMethodId === m.id;
                            return (
                              <div
                                key={m.id}
                                className={`group/chip inline-flex items-center gap-1.5 rounded-md border pl-2 pr-1 py-1 text-[11.5px] transition-colors ${
                                  isPrimary
                                    ? "border-primary/40 bg-accent text-primary"
                                    : "border-border bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setFreightPrimaryMethod(draft.id, m.id)}
                                  className="inline-flex items-center gap-1.5 cursor-pointer"
                                  title={isPrimary ? "Primary method" : "Click to mark as primary"}
                                >
                                  <Star className={`w-3 h-3 ${isPrimary ? "text-primary fill-current" : "text-slate-300"}`} />
                                  <span style={{ fontWeight: 600 }}>{m.shortName || m.name}</span>
                                  <span className="text-slate-400">·</span>
                                  <span className="text-slate-500">{m.minDays === m.maxDays ? `${m.minDays}d` : `${m.minDays}-${m.maxDays}d`}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleFreightMethod(draft.id, m.id)}
                                  className="w-4 h-4 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                                  aria-label="Remove method"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add Another Carrier CTA — only in create mode */}
              {!editingFreightId && (
                <button
                  type="button"
                  onClick={addAnotherFreightDraft}
                  className="w-full rounded-lg border-2 border-dashed border-border bg-white py-3 flex items-center justify-center gap-1.5 text-primary text-[13px] hover:border-primary/40 hover:bg-accent/30 transition-colors cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="w-4 h-4" /> Add Another Carrier
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 bg-white shrink-0">
            <button type="button" onClick={() => { setAddFreightOpen(false); setEditingFreightId(null); setFreightDrafts([]); }} className="h-9 px-4 rounded-lg border border-border bg-white text-[13px] text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors" style={{ fontWeight: 500 }}>Cancel</button>
            <button
              type="button"
              onClick={saveFreightDrafts}
              className="h-9 px-4 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[13px] cursor-pointer transition-colors shadow-sm"
              style={{ fontWeight: 600 }}
            >
              {editingFreightId ? "Save Changes" : "Save Methods"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Select Point of Contact Modal ── */}
      <SelectPocDictionaryModal
        open={showSelectPocModal}
        onOpenChange={setShowSelectPocModal}
        contactDictionary={contactDictionary}
        pocSearch={pocSearch}
        onPocSearchChange={(v) => { setPocSearch(v); setPocPage(1); }}
        pocCategoryFilter={pocCategoryFilter}
        onPocCategoryFilterChange={(v) => { setPocCategoryFilter(v); setPocPage(1); }}
        pocDepartmentCounts={pocDepartmentCounts}
        pocPagedContacts={pocPagedContacts}
        pocPage={pocPage}
        pocTotalPages={pocTotalPages}
        onPocPageChange={setPocPage}
        pocTempSelected={pocTempSelected}
        onTogglePocTemp={handleTogglePocTemp}
        onConfirm={handleConfirmPocSelection}
        onOpenCreatePoc={handleOpenCreatePoc}
        contextLabel="this location"
      />

      {/* ── Create New Point of Contact Modal ── */}
      <CreatePocModal
        open={showCreatePocModal}
        onOpenChange={setShowCreatePocModal}
        contextName={vendorName}
        newPocName={newPocName}
        onNewPocNameChange={setNewPocName}
        newPocDepartment={newPocDepartment}
        onNewPocDepartmentChange={setNewPocDepartment}
        newPocRole={newPocRole}
        onNewPocRoleChange={setNewPocRole}
        newPocLandline={newPocLandline}
        onNewPocLandlineChange={setNewPocLandline}
        newPocLandlineCode={newPocLandlineCode}
        onNewPocLandlineCodeChange={setNewPocLandlineCode}
        newPocExt={newPocExt}
        onNewPocExtChange={setNewPocExt}
        newPocMobile={newPocMobile}
        onNewPocMobileChange={setNewPocMobile}
        newPocMobileCode={newPocMobileCode}
        onNewPocMobileCodeChange={setNewPocMobileCode}
        newPocEmail={newPocEmail}
        onNewPocEmailChange={setNewPocEmail}
        saveAndCreateAnother={saveAndCreateAnother}
        onSaveAndCreateAnotherChange={setSaveAndCreateAnother}
        onSave={handleSaveNewPoc}
      />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelConfirmation} onOpenChange={setShowCancelConfirmation}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 220 }}
          onInteractOutside={() => setShowCancelConfirmation(false)}
        >
          <div
            className="relative flex flex-col items-center pt-10 pb-6"
            style={{
              background:
                "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)",
            }}
          >
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25"
              style={{ backgroundColor: "#EF4444" }}
            />
            <div
              className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "#FEE2E2" }}
            >
              <AlertTriangle className="w-8 h-8" style={{ color: "var(--destructive)" }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{
                fontWeight: 600,
                backgroundColor: "#FEF2F2",
                color: "#991B1B",
                textTransform: "uppercase" as const,
                letterSpacing: "0.05em",
              }}
            >
              Discard
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle
                className="text-[18px] tracking-[-0.02em]"
                style={{ fontWeight: 600, color: "var(--foreground)" }}
              >
                Discard location creation?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription
              className="text-[13px] mt-2 max-w-[300px] mx-auto"
              style={{ color: "var(--muted-foreground)", lineHeight: "1.65" }}
            >
              All the information you've entered will be lost. This action cannot be undone.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={handleConfirmCancel}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "var(--destructive)", color: "#fff" }}
              >
                Discard changes
              </button>
              <button
                onClick={() => setShowCancelConfirmation(false)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "var(--muted)", color: "#334155" }}
              >
                Continue editing
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove-freight confirmation — guards both inherited defaults and
          user-added carriers behind an explicit confirm so a stray click on
          the hover X doesn't silently drop a carrier from the location. */}
      <AlertDialog open={!!freightToRemove} onOpenChange={(open) => { if (!open) setFreightToRemove(null); }}>
        <AlertDialogContent
          className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 240 }}
          onInteractOutside={() => setFreightToRemove(null)}
        >
          <div
            className="relative flex flex-col items-center pt-10 pb-6"
            style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}
          >
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25"
              style={{ backgroundColor: "#EF4444" }}
            />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <Truck className="w-8 h-8" style={{ color: "var(--destructive)" }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}
            >
              Remove
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "var(--foreground)" }}>
                Remove this carrier?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "var(--muted-foreground)", lineHeight: "1.65" }}>
              {(() => {
                const c = freightToRemove ? SHIPPING_CARRIER_CATALOG.find((x) => x.id === freightToRemove.carrierId) : null;
                const name = c?.name || "This carrier";
                return freightToRemove?.inherited
                  ? `${name} is inherited from the partner. It will be removed from this location only — you can add it back via Add Freight.`
                  : `${name} will be removed from this location's freight & logistics. You can add it back via Add Freight.`;
              })()}
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={() => {
                  if (!freightToRemove) return;
                  setSavedFreightCarriers((prev) => prev.filter((x) => x.id !== freightToRemove.id));
                  const c = SHIPPING_CARRIER_CATALOG.find((x) => x.id === freightToRemove.carrierId);
                  toast.success(`${c?.name || "Carrier"} removed`);
                  setFreightToRemove(null);
                }}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "var(--destructive)", color: "#fff" }}
              >
                Remove carrier
              </button>
              <button
                onClick={() => setFreightToRemove(null)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: "var(--muted)", color: "#334155" }}
              >
                Keep carrier
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}