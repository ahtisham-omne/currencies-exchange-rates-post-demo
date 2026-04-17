import React, { useState, useMemo, useCallback, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../ui/utils";
import { ShippingMethodChipsRow } from "./ShippingMethodChipsRow";
import { ExpandableTextarea } from "./ExpandableTextarea";
import fedexLogo from "@/assets/carriers/fedex.png";
import dhlLogo from "@/assets/carriers/dhl.png";
import upsLogo from "@/assets/carriers/ups.png";
import tcsLogo from "@/assets/carriers/tcs.png";
import sfLogo from "@/assets/carriers/sf.png";
import uspsLogo from "@/assets/carriers/usps.png";
import aramexLogo from "@/assets/carriers/aramex.png";
import maerskLogo from "@/assets/carriers/maersk.png";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Slider } from "../ui/slider";
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
  Search,
  X,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Pencil,
  Globe,
  MapPin,
  Phone,
  Users,
  Truck,
  ShoppingCart,
  Store,
  Wrench,
  Cog,
  Info,
  CreditCard,
  DollarSign,
  Receipt,
  ChartColumn,
  Ship,
  UserPlus,
  Building2,
  ExternalLink,
  Plus,
  Settings2,
  Eye,
  Maximize2,
  Minimize2,
  Paperclip,
  Upload,
  FileText,
  FolderOpen,
  Trash2,
  Briefcase,
  Handshake,
  HeartHandshake,
  UserCheck,
  Landmark,
  Banknote,
  Wallet,
  CircleDollarSign,
  Clock,
  Copy,
  Tag,
  Sparkles,
  ChevronLeft,
  Mail,
  PhoneCall,
  ChevronsLeft,
  ChevronsRight,
  Camera,
  Star,
  AlertTriangle,
  Zap,
  Package,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CalendarDays,
  Trash,
  Lock,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Archive,
  SlidersHorizontal,
  MoreHorizontal,
  BarChart3,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../ui/tooltip";
import { InfoTooltip } from "../ui/info-tooltip";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "../ui/hover-card";
import { getAvatarTint } from "../../utils/avatarTints";
import { GroupChipsRow } from "./GroupChipsRow";
import { FilterPills } from "./FilterPills";
import { PaymentTermDetailModal } from "./PaymentTermDetailModal";
import { PricingRuleDetailModal, presetToPricingRule, type PricingRule } from "./PricingRulesTab";
import { PaymentTermCard } from "./PaymentTermCard";
import { PaymentMethodsSection, PhoneFieldWithCountry, DEFAULT_FORMAT } from "./PaymentMethodsSection";
import {
  PillOption,
  RadioOption,
  IconCardOption,
  SearchablePartnerDropdown,
  CurrencyDropdown,
  FundedByDropdown,
  createEmptyPaymentEntry,
} from "./config-helpers";
import {
  type PartnerGroup,
  type GroupVendor,
  type VendorSubType,
  type ConfigSection,
  type PartnerLocationItem,
  type PaymentMethodType,
  type PaymentTypeCategory,
  type PaymentTermPreset,
  type PaymentTermCategory,
  type PricingRuleCategory,
  type PricingRuleBasis,
  type PricingRuleTier,
  type PricingRulePreset,
  type PaymentMethodEntry,
  PARTNER_GROUPS,
  GROUP_VENDORS,
  VENDOR_SUB_TYPES,
  CUSTOMER_SUB_TYPES,
  VENDOR_CONFIG_SECTIONS,
  CUSTOMER_CONFIG_SECTIONS,
  PARTNER_LOCATION_ITEMS,
  FUNDED_BY_ITEMS,
  CURRENCY_OPTIONS,
  PAYMENT_TYPE_CARDS,
  PAYMENT_TERM_PRESETS,
  CREATE_PT_TYPES,
  CREATE_PT_TRIGGERS,
  CREATE_PT_DURATIONS,
  CREATE_PT_DISCOUNT_PERIODS,
  PRICING_RULE_PRESETS,
  CONTACT_DICTIONARY,
  COUNTRY_CURRENCY_MAP,
  type ContactPerson,
} from "./partnerConstants";
import { SelectPocDictionaryModal, CreatePocModal } from "./PocModals";
import { PocPillsRow } from "./PocPillComponents";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { SearchableUserPicker } from "./SearchableUserPicker";

/** Props for multi-step partner creation modal */
interface CreatePartnerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPartnerCreated?: (data: Record<string, unknown>) => void;
  /** Auto-navigate to a specific vendor profile on open (e.g. "carrier") */
  initialProfile?: string;
  /** When true, the modal opens in "Edit Partner" mode with pre-populated data */
  editMode?: boolean;
  /** The vendor object to pre-populate when in edit mode */
  editVendor?: Record<string, unknown> | null;
}

export function CreatePartnerModal({ open, onOpenChange, onPartnerCreated, initialProfile, editMode = false, editVendor }: CreatePartnerModalProps) {
  // Steps: 1 = Partner Group Selection, 2 = Partner Form, 3 = Configuration Sub-page
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [configType, setConfigType] = useState<"vendor" | "customer">("vendor");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [initialProfileHandled, setInitialProfileHandled] = useState(false);
  const [editModeInitialized, setEditModeInitialized] = useState(false);

  // Auto-navigate to the specified profile (e.g. carrier) when modal opens
  useEffect(() => {
    if (open && initialProfile && !initialProfileHandled) {
      setInitialProfileHandled(true);
      // Skip to step 2 (partner info) then step 3 (config) with carrier enabled
      setSelectedPartnerTypes(new Set(["vendor"]));
      setSelectedVendorSubTypes(new Set(["seller_items", initialProfile]));
      setActiveSubTypeTab(initialProfile);
      setConfigType("vendor");
      setActiveConfigSection("shipping_methods");
      setStep(3);
    }
    if (!open) {
      setInitialProfileHandled(false);
      setEditModeInitialized(false);
    }
  }, [open, initialProfile, initialProfileHandled]);

  // Edit mode: pre-populate fields from vendor data
  useEffect(() => {
    if (open && editMode && editVendor && !editModeInitialized) {
      setEditModeInitialized(true);
      const v = editVendor as Record<string, unknown>;

      // Pre-populate step 1: partner groups
      const groupId = v.partnerGroup as string;
      if (groupId) {
        const grp = PARTNER_GROUPS.find((g) => g.id === groupId);
        if (grp) {
          setSelectedGroups([grp]);
          setPrimaryGroupId(grp.id);
        }
      }

      // Pre-populate step 2: partner info
      setPartnerName((v.displayName as string) || (v.companyName as string) || "");
      setWebsite((v.website as string) || "");
      setAddress((v.billingAddress as Record<string, string>)?.street || "");
      setProfileImage((v.profileImage as string) || null);

      // Partner types
      const types = (v.partnerTypes as string[]) || [];
      setSelectedPartnerTypes(new Set(types));

      // Sub-types — use labels from vendor data
      const vSubs = (v.vendorSubTypes as string[]) || [];
      const cSubs = (v.customerSubTypes as string[]) || [];
      // Map labels back to IDs for the sub-type selection
      const vSubIds = new Set<string>();
      vSubs.forEach((label) => {
        const found = VENDOR_SUB_TYPES.find((s) => s.label === label || s.id === label);
        if (found) vSubIds.add(found.id);
      });
      const cSubIds = new Set<string>();
      cSubs.forEach((label) => {
        const found = CUSTOMER_SUB_TYPES.find((s) => s.label === label || s.id === label);
        if (found) cSubIds.add(found.id);
      });
      setSelectedVendorSubTypes(vSubIds);
      setSelectedCustomerSubTypes(cSubIds);
      if (vSubIds.size > 0) setActiveSubTypeTab(Array.from(vSubIds)[0]);

      // Skip to step 2 (partner info form)
      setStep(2);
    }
  }, [open, editMode, editVendor, editModeInitialized]);

  // Step 1 state
  const [groupSearch, setGroupSearch] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<PartnerGroup[]>([]);
  const [primaryGroupId, setPrimaryGroupId] = useState<string | null>(null);

  // Derived: the primary group object (for downstream Step 2/3 references)
  const primaryGroup = useMemo(
    () => selectedGroups.find((g) => g.id === primaryGroupId) ?? selectedGroups[0] ?? null,
    [selectedGroups, primaryGroupId]
  );

  // Step 2 state
  const [partnerName, setPartnerName] = useState("");
  const [partnerPhone, setPartnerPhone] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+1");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [selectedPartnerTypes, setSelectedPartnerTypes] = useState<Set<string>>(new Set());
  const [selectedVendorSubTypes, setSelectedVendorSubTypes] = useState<Set<string>>(new Set());
  const [selectedCustomerSubTypes, setSelectedCustomerSubTypes] = useState<Set<string>>(new Set());
  const [activeConfigTab, setActiveConfigTab] = useState<"vendor" | "customer">("vendor");
  const [activeConfigSection, setActiveConfigSection] = useState<string>("billing_shipping");
  const [activeCustomerConfigSection, setActiveCustomerConfigSection] = useState<string>("customer_billing");
  const [activeSubTypeTab, setActiveSubTypeTab] = useState<string>("seller_items");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Ref for collecting Step 3 config data from ConfigPageContent
  const configDataRef = useRef<Record<string, unknown>>({});

  // Filter partner groups
  const filteredGroups = useMemo(() => {
    if (!groupSearch.trim()) return PARTNER_GROUPS;
    const q = groupSearch.toLowerCase();
    return PARTNER_GROUPS.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.id.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.country.toLowerCase().includes(q)
    );
  }, [groupSearch]);

  const handleSelectGroup = useCallback((group: PartnerGroup) => {
    setSelectedGroups((prev) => {
      const exists = prev.some((g) => g.id === group.id);
      if (exists) {
        const next = prev.filter((g) => g.id !== group.id);
        // If removed group was the primary, clear primary
        setPrimaryGroupId((pid) => (pid === group.id ? null : pid));
        return next;
      }
      const next = [...prev, group];
      // Auto-set primary if first selection
      if (next.length === 1) setPrimaryGroupId(group.id);
      return next;
    });
  }, []);

  const handleSetPrimaryGroup = useCallback((groupId: string) => {
    setPrimaryGroupId(groupId);
  }, []);

  const handleContinueToForm = useCallback(() => {
    if (!primaryGroupId || selectedGroups.length === 0) return;
    setStep(2);
  }, [selectedGroups, primaryGroupId]);

  const handleSkipGroup = useCallback(() => {
    setSelectedGroups([]);
    setPrimaryGroupId(null);
    setStep(2);
  }, []);

  const handleBackToGroupSelection = useCallback(() => {
    setStep(1);
  }, []);

  const handleToggleVendorSubType = useCallback((id: string) => {
    setSelectedVendorSubTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Seller can only be disabled if at least one other profile remains enabled
        if (id === "seller_items") {
          const othersEnabled = Array.from(next).filter(x => x !== "seller_items");
          if (othersEnabled.length === 0) return prev; // can't disable seller if it's the only one
        }
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleCustomerSubType = useCallback((id: string) => {
    setSelectedCustomerSubTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handlePartnerTypeToggle = useCallback((type: "vendor" | "customer") => {
    setSelectedPartnerTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleDiscard = useCallback(() => {
    // Reset all state
    setStep(1);
    setConfigType("vendor");
    setIsFullScreen(false);
    setShowCancelConfirmation(false);
    setGroupSearch("");
    setSelectedGroups([]);
    setPrimaryGroupId(null);
    setPartnerName("");
    setPartnerPhone("");
    setPhoneCountryCode("+1");
    setWebsite("");
    setAddress("");
    setProfileImage(null);
    setSelectedPartnerTypes(new Set());
    setSelectedVendorSubTypes(new Set());
    setSelectedCustomerSubTypes(new Set());
    setActiveConfigTab("vendor");
    setActiveConfigSection("billing_shipping");
    setActiveCustomerConfigSection("customer_billing");
    setActiveSubTypeTab("seller_items");
    setErrors({});
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSave = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!partnerName.trim()) newErrors.partnerName = "Partner name is required";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Build the first vendor sub-type label for vendorType
    const firstSubType = Array.from(selectedVendorSubTypes)[0] || "";
    const SUBTYPE_MAP: Record<string, string> = {
      seller_items: "Seller",
      carrier: "Carrier",
      online_vendor: "Online Vendor",
      in_store_vendor: "In-Store Vendor",
      sub_contractor: "Sub Contractor",
      service_provider: "Service Provider",
    };

    const data = {
      partnerGroup: primaryGroup?.id || "",
      partnerGroupName: primaryGroup?.name || "",
      partnerGroups: selectedGroups.map((g) => g.id),
      partnerName: partnerName.trim(),
      partnerPhone: partnerPhone ? `${phoneCountryCode} ${partnerPhone}` : "",
      website,
      address,
      profileImage,
      partnerTypes: Array.from(selectedPartnerTypes) as ("vendor" | "customer")[],
      vendorSubTypes: Array.from(selectedVendorSubTypes),
      customerSubTypes: Array.from(selectedCustomerSubTypes),
      vendorType: SUBTYPE_MAP[firstSubType] || "Seller",
      // Include Step 3 config data
      ...(configDataRef.current || {}),
    };

    if (onPartnerCreated) {
      onPartnerCreated(data);
    }

    // Reset and close
    handleDiscard();
  }, [partnerName, primaryGroup, selectedGroups, phoneCountryCode, partnerPhone, website, address, profileImage, selectedPartnerTypes, selectedVendorSubTypes, selectedCustomerSubTypes, onPartnerCreated, handleDiscard]);

  // Determine if user has made any progress worth protecting
  const hasAnyProgress = useMemo(() => {
    return selectedGroups.length > 0 || step > 1 || partnerName.trim().length > 0;
  }, [selectedGroups, step, partnerName]);

  const handleCancelAttempt = useCallback(() => {
    if (!hasAnyProgress) {
      // No selections made — close immediately without confirmation
      handleDiscard();
      return;
    }
    setShowCancelConfirmation(true);
  }, [hasAnyProgress, handleDiscard]);

  const handleConfirmCancel = useCallback(() => {
    setShowCancelConfirmation(false);
    handleDiscard();
  }, [handleDiscard]);

  const handleOpenChange = useCallback((val: boolean) => {
    if (!val) {
      if (!hasAnyProgress) {
        // No selections made — close immediately without confirmation
        handleDiscard();
      } else {
        setShowCancelConfirmation(true);
      }
    } else {
      onOpenChange(val);
    }
  }, [onOpenChange, hasAnyProgress, handleDiscard]);

  const handleOpenConfigure = useCallback((type: "vendor" | "customer") => {
    setConfigType(type);
    setActiveConfigSection("billing_shipping");
    setActiveCustomerConfigSection("customer_billing");
    // Auto-select default sub-type and set as active tab
    if (type === "vendor") {
      let firstSelected = "seller_items";
      setSelectedVendorSubTypes((prev) => {
        if (prev.size === 0) return new Set(["seller_items"]);
        firstSelected = Array.from(prev)[0];
        return prev;
      });
      setActiveSubTypeTab(firstSelected);
    } else {
      let firstSelected = "retail_buyer";
      setSelectedCustomerSubTypes((prev) => {
        if (prev.size === 0) return new Set(["retail_buyer"]);
        firstSelected = Array.from(prev)[0];
        return prev;
      });
      setActiveSubTypeTab(firstSelected);
    }
    setStep(3);
  }, []);

  const handleBackFromConfig = useCallback(() => {
    setStep(2);
  }, []);

  const modalBaseClass = "!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";

  const modalSizeClass = isFullScreen
    ? `${modalBaseClass} !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl`
    : `${modalBaseClass} !max-w-[100%] sm:!max-w-[960px] lg:!max-w-[1040px] !max-h-[100dvh] sm:!max-h-[88vh] rounded-none sm:!rounded-2xl`;

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={`flex flex-col p-0 gap-0 border-0 sm:border ${modalSizeClass}`}
        hideCloseButton
        style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
      >
        <DialogTitle className="sr-only">{editMode ? "Edit Partner" : "Create New Partner"}</DialogTitle>
        <DialogDescription className="sr-only">Configure the details and settings for the new partner.</DialogDescription>
        {step === 3 ? (
          /* ───────── Configuration Sub-page ───────── */
          <>
            {/* Config header bar — clean, no tabs */}
            <div className="shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
              <div className="px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <button
                    onClick={handleBackFromConfig}
                    className="w-8 h-8 rounded-lg border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4 text-[#64748B]" />
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-[15px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}>
                        Configure {configType === "vendor" ? "Vendor" : "Customer"}
                      </h3>
                      <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-[#F1F5F9] text-[10px] text-[#64748B] uppercase tracking-wide" style={{ fontWeight: 600 }}>
                        Step 3
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-[#94A3B8] mt-0.5 truncate hidden sm:block">
                      {primaryGroup
                        ? `Inheriting from ${primaryGroup.name}`
                        : "Select sub-types and configure details"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <button
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all"
                    style={{ fontWeight: 500 }}
                  >
                    {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    {isFullScreen ? "Exit full" : "Full view"}
                  </button>
                  <button
                    onClick={handleCancelAttempt}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Config body: unified sidebar + content */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col sm:flex-row bg-[#FAFBFC] relative">
              <ConfigUnifiedNav
                subTypes={configType === "vendor" ? VENDOR_SUB_TYPES : CUSTOMER_SUB_TYPES}
                sections={configType === "vendor" ? VENDOR_CONFIG_SECTIONS : CUSTOMER_CONFIG_SECTIONS}
                selectedSubTypes={configType === "vendor" ? selectedVendorSubTypes : selectedCustomerSubTypes}
                activeSubTypeTab={activeSubTypeTab}
                activeSection={configType === "vendor" ? activeConfigSection : activeCustomerConfigSection}
                onToggleSubType={configType === "vendor" ? handleToggleVendorSubType : handleToggleCustomerSubType}
                onSetActiveSubType={setActiveSubTypeTab}
                onActiveSectionChange={configType === "vendor" ? setActiveConfigSection : setActiveCustomerConfigSection}
              />
              {/* Content area */}
              <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAFBFC] relative">
                {(() => {
                  const isSubTypeEnabled = configType === "vendor" ? selectedVendorSubTypes.has(activeSubTypeTab) : selectedCustomerSubTypes.has(activeSubTypeTab);
                  const isSeller = activeSubTypeTab === "seller_items";
                  const subTypeLabel = (configType === "vendor" ? VENDOR_SUB_TYPES : CUSTOMER_SUB_TYPES).find(s => s.id === activeSubTypeTab)?.label;
                  const subTypeIcon = (configType === "vendor" ? VENDOR_SUB_TYPES : CUSTOMER_SUB_TYPES).find(s => s.id === activeSubTypeTab)?.icon;

                  // Educational descriptions for each sub-type profile
                  const subTypeInfo: Record<string, string> = {
                    seller_items: "Supplies products, goods, and inventory items to your organization. Configure purchasing terms, item catalogs, and pricing agreements.",
                    carrier: "Provides freight, shipping, and logistics services for transporting goods. Manage shipping methods, transit times, rate tables, and delivery terms.",
                    online_vendor: "Operates through digital channels and e-commerce platforms. Set up online ordering workflows, digital catalogs, and electronic invoicing.",
                    in_store_vendor: "Supplies goods through physical retail locations and storefronts. Configure in-store pickup schedules, local delivery zones, and walk-in purchasing terms.",
                    sub_contractor: "Provides specialized contract labor, project-based work, or outsourced manufacturing. Manage work orders, project milestones, and contract agreements.",
                    service_provider: "Delivers professional, managed, or recurring services to your organization. Configure service-level agreements, billing schedules, and performance metrics.",
                    retail_buyer: "Purchases products for personal use or small-scale retail operations. Manage consumer pricing, return policies, and loyalty programs.",
                    wholesale_buyer: "Purchases goods in bulk at negotiated wholesale rates. Configure volume-based pricing tiers, minimum order quantities, and wholesale payment terms.",
                    distributor: "Resells and distributes your products across markets and regions. Set up distribution agreements, territory mapping, and margin structures.",
                    end_consumer: "The final user of your products or services. Manage direct-to-consumer pricing, warranty terms, and after-sales support channels.",
                    b2b_client: "Business entity purchasing goods or services for commercial use. Configure enterprise agreements, purchase order workflows, and net payment terms.",
                    reseller: "Authorized partner that resells your products under defined terms. Manage reseller discount structures, certification requirements, and co-branding guidelines.",
                  };
                  const profileDesc = subTypeInfo[activeSubTypeTab] || `Configure the ${subTypeLabel} profile settings.`;

                  if (!isSubTypeEnabled) {
                    // State 1: Not enabled — rich empty state explaining the profile
                    const configCount = (configType === "vendor" ? VENDOR_CONFIG_SECTIONS : CUSTOMER_CONFIG_SECTIONS).length;
                    return (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#FAFBFC]">
                        <div className="flex flex-col items-center gap-5 text-center px-8 max-w-lg animate-coming-soon-in">
                          {/* Profile icon with lock indicator */}
                          <div className="relative">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F1F5F9] to-[#E2E8F0] border border-[#E2E8F0] flex items-center justify-center shadow-sm">
                              {subTypeIcon ? React.cloneElement(subTypeIcon as React.ReactElement, { className: "w-7 h-7 text-[#94A3B8]" }) : <Settings2 className="w-7 h-7 text-[#94A3B8]" />}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border-2 border-[#E2E8F0] flex items-center justify-center">
                              <Lock className="w-3 h-3 text-[#CBD5E1]" />
                            </div>
                          </div>

                          {/* Title + description */}
                          <div className="space-y-2">
                            <p className="text-[15px] text-[#0F172A]" style={{ fontWeight: 600 }}>{subTypeLabel} Profile</p>
                            <p className="text-[13px] text-[#64748B] leading-relaxed max-w-sm">
                              {profileDesc}
                            </p>
                          </div>

                          {/* What enabling unlocks */}
                          <div className="flex items-center gap-4 text-[11px] text-[#94A3B8]">
                            <span className="flex items-center gap-1">
                              <Settings2 className="w-3 h-3" />
                              {configCount} configuration sections
                            </span>
                            <span className="w-1 h-1 rounded-full bg-[#CBD5E1]" />
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              Auto-inherits group defaults
                            </span>
                          </div>

                          {/* Enable CTA */}
                          <button
                            onClick={() => {
                              const toggleFn = configType === "vendor" ? handleToggleVendorSubType : handleToggleCustomerSubType;
                              toggleFn(activeSubTypeTab);
                            }}
                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#0A77FF] text-white text-[13px] shadow-md hover:bg-[#0862D0] hover:shadow-lg transition-all"
                            style={{ fontWeight: 600 }}
                          >
                            <Zap className="w-3.5 h-3.5" />
                            Enable {subTypeLabel} Profile
                          </button>
                          <p className="text-[11px] text-[#CBD5E1]">You can disable this profile anytime</p>
                        </div>
                      </div>
                    );
                  }

                  if (!isSeller && activeSubTypeTab !== "carrier") {
                    // State 2: Enabled non-seller (except carrier) — Coming Soon with educational copy & Omne branding
                    return (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-white overflow-hidden">
                        {/* Orbiting rings in light blue tints */}
                        <div className="absolute w-[320px] h-[320px] rounded-full border border-[#0A77FF]/[0.08] animate-coming-soon-orbit">
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#0A77FF]/20" />
                        </div>
                        <div className="absolute w-[480px] h-[480px] rounded-full border border-[#0A77FF]/[0.05] animate-coming-soon-orbit" style={{ animationDirection: "reverse", animationDuration: "12s" }}>
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#3B9FFF]/20" />
                        </div>
                        {/* Pulse glow */}
                        <div className="absolute w-48 h-48 rounded-full bg-[#0A77FF]/[0.04] animate-coming-soon-pulse blur-3xl" />
                        {/* Content */}
                        <div className="relative flex flex-col items-center gap-5 text-center px-8 max-w-md animate-coming-soon-in">
                          <div className="w-16 h-16 rounded-2xl bg-[#EDF4FF] border border-[#DBEAFE] flex items-center justify-center">
                            {subTypeIcon ? React.cloneElement(subTypeIcon as React.ReactElement, { className: "w-7 h-7 text-[#0A77FF]" }) : <Settings2 className="w-7 h-7 text-[#0A77FF]" />}
                          </div>
                          <div>
                            <p className="text-[17px] text-[#0F172A] mb-2" style={{ fontWeight: 600 }}>Coming Soon</p>
                            <p className="text-[13px] text-[#64748B] leading-relaxed max-w-sm">
                              {profileDesc}
                            </p>
                          </div>
                          <div className="h-[3px] w-24 rounded-full overflow-hidden bg-[#EDF4FF]">
                            <div className="h-full w-full rounded-full bg-gradient-to-r from-[#0A77FF] via-[#3B9FFF] to-[#0A77FF] animate-coming-soon-shimmer" />
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // State 3: Seller or Carrier enabled — show full config
                  return (
                    <div className="p-4">
                      <ConfigPageContent
                        sectionId={configType === "vendor" ? activeConfigSection : activeCustomerConfigSection}
                        configType={configType}
                        selectedGroup={primaryGroup}
                        partnerName={partnerName}
                        configDataRef={configDataRef}
                      />
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Config footer */}
            <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5 sm:rounded-b-2xl">
              <button
                onClick={handleBackFromConfig}
                className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors mr-auto"
                style={{ fontWeight: 500 }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <Button variant="outline" onClick={handleCancelAttempt} className="border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] rounded-lg text-xs sm:text-[13px] px-3 sm:px-4 h-8 sm:h-9">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  toast.success("Configuration saved");
                  handleBackFromConfig();
                }}
                className="gap-1.5 rounded-lg text-xs sm:text-[13px] px-3 sm:px-4 h-8 sm:h-9 shadow-sm"
              >
                Save Configuration
              </Button>
            </div>
          </>
        ) : (
          /* ───────── Steps 1 & 2 ───────── */
          <>
            {/* Header */}
            <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-0 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
              {/* Title row */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[15px] sm:text-[17px] text-[#0F172A]" style={{ fontWeight: 700 }}>{editMode ? "Edit Partner" : "Create New Partner"}</h2>
                  <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5" style={{ fontWeight: 400 }}>
                    {editMode ? "Update the details and settings for this partner." : "Configure the details and settings for the new partner."}
                  </p>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <button
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all"
                    style={{ fontWeight: 500 }}
                  >
                    {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    {isFullScreen ? "Exit full" : "Full view"}
                  </button>
                  <button
                    onClick={handleCancelAttempt}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-all"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>

              {/* Step tabs */}
              <div className="flex items-center gap-4 sm:gap-6 mt-3 sm:mt-3.5 overflow-x-auto -mb-px">
                {[
                  { num: 1, label: "Partner Group Selection", shortLabel: "Group", active: step === 1, completed: step === 2 },
                  { num: 2, label: "Partner Information", shortLabel: "Details", active: step === 2, completed: false },
                ].map((tab) => (
                  <div
                    key={tab.num}
                    className={`relative flex items-center gap-2 pb-2.5 sm:pb-3 ${
                      tab.num < step || (tab.num === 2 && step === 1 && selectedGroups.length > 0 && primaryGroupId) ? "cursor-pointer" : "cursor-default"
                    }`}
                    onClick={() => {
                      if (tab.num < step) setStep(tab.num as 1 | 2);
                      if (tab.num === 2 && step === 1 && selectedGroups.length > 0 && primaryGroupId) setStep(2);
                    }}
                  >
                    <div
                      className={`w-[22px] h-[22px] sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-[12px] shrink-0 transition-all duration-200 ${
                        tab.completed
                          ? "bg-[#10B981] text-white"
                          : tab.active
                          ? "bg-[#0A77FF] text-white"
                          : "border-[1.5px] border-[#CBD5E1] text-[#64748B] bg-white"
                      }`}
                      style={{ fontWeight: 600 }}
                    >
                      {tab.completed ? <Check className="w-3 h-3" /> : tab.num}
                    </div>
                    <span
                      className={`text-[12px] sm:text-[13px] whitespace-nowrap transition-colors ${
                        tab.active
                          ? "text-[#0A77FF]"
                          : tab.completed
                          ? "text-[#10B981]"
                          : "text-[#334155]"
                      }`}
                      style={{ fontWeight: tab.active || tab.completed ? 600 : 500 }}
                    >
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.shortLabel}</span>
                    </span>
                    {(tab.active || tab.completed) && (
                      <div className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full ${tab.completed ? "bg-[#10B981]" : "bg-[#0A77FF]"}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-[#FAFBFC] scrollbar-hide">
              <div className={`px-4 pt-4 transition-all duration-300 ease-out ${step === 1 ? 'pb-0' : 'pb-4'}`}>
                {step === 1 && (
                  <Step1GroupSelection
                    search={groupSearch}
                    onSearchChange={setGroupSearch}
                    groups={filteredGroups}
                    selectedGroups={selectedGroups}
                    primaryGroupId={primaryGroupId}
                    onSelectGroup={handleSelectGroup}
                    onSetPrimary={handleSetPrimaryGroup}
                  />
                )}
                {step === 2 && (
                  <Step2PartnerForm
                    selectedGroup={primaryGroup}
                    allSelectedGroups={selectedGroups}
                    primaryGroupId={primaryGroupId}
                    onEditGroup={handleBackToGroupSelection}
                    partnerName={partnerName}
                    onPartnerNameChange={setPartnerName}
                    partnerPhone={partnerPhone}
                    onPartnerPhoneChange={setPartnerPhone}
                    phoneCountryCode={phoneCountryCode}
                    onPhoneCountryCodeChange={setPhoneCountryCode}
                    website={website}
                    onWebsiteChange={setWebsite}
                    address={address}
                    onAddressChange={setAddress}
                    profileImage={profileImage}
                    onProfileImageChange={setProfileImage}
                    selectedPartnerTypes={selectedPartnerTypes}
                    onPartnerTypeChange={handlePartnerTypeToggle}
                    selectedVendorSubTypes={selectedVendorSubTypes}
                    onToggleVendorSubType={handleToggleVendorSubType}
                    selectedCustomerSubTypes={selectedCustomerSubTypes}
                    onToggleCustomerSubType={handleToggleCustomerSubType}
                    onOpenConfigure={handleOpenConfigure}
                    errors={errors}
                  />
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5 sm:rounded-b-2xl">
              {step === 1 ? (
                <>
                  <Button variant="outline" onClick={handleCancelAttempt} className="border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9">
                    Cancel
                  </Button>
                  {!primaryGroupId ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className="inline-flex">
                          <Button disabled className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm pointer-events-none">
                            Continue
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={6} className="max-w-[220px] text-center">
                        {selectedGroups.length === 0
                          ? "Select at least one partner group and mark it as primary to continue"
                          : "Mark a partner group as primary to continue"}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button onClick={handleContinueToForm} className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm">
                      Continue
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={handleBackToGroupSelection}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors mr-auto"
                    style={{ fontWeight: 500 }}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Back</span>
                  </button>
                  <Button variant="outline" onClick={handleCancelAttempt} className="border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9">
                    Cancel
                  </Button>
                  <Button onClick={handleSave} className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm">
                    {editMode ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{editMode ? "Save Changes" : "Create Partner"}</span>
                    <span className="sm:hidden">{editMode ? "Save" : "Create"}</span>
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>

    {/* Cancel Confirmation Dialog — matches listing page modern centered layout */}
    <AlertDialog open={showCancelConfirmation} onOpenChange={setShowCancelConfirmation}>
      <AlertDialogContent
        className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
        style={{ zIndex: 220 }}
        onInteractOutside={() => setShowCancelConfirmation(false)}
      >
        {/* Colored glow header */}
        <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
            <AlertTriangle className="w-8 h-8" style={{ color: "#DC2626" }} />
          </div>
          <span
            className="mt-4 px-3 py-1 rounded-full text-[11px]"
            style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}
          >
            Discard
          </span>
        </div>
        {/* Body */}
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogHeader className="p-0 gap-0 text-center">
            <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "#0F172A" }}>
              {editMode ? "Discard changes?" : "Discard partner creation?"}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "#475569", lineHeight: "1.65" }}>
            {editMode ? "All unsaved changes will be lost. This action cannot be undone." : "All the information you've entered will be lost. This action cannot be undone."}
          </AlertDialogDescription>
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              onClick={handleConfirmCancel}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
              style={{ fontWeight: 600, backgroundColor: "#DC2626", color: "#fff" }}
            >
              Discard changes
            </button>
            <button
              onClick={() => setShowCancelConfirmation(false)}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
              style={{ fontWeight: 500, backgroundColor: "#F1F5F9", color: "#334155" }}
            >
              Continue editing
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

// ── Step Tab ──
function StepTab({
  stepNumber,
  label,
  shortLabel,
  isActive,
  isCompleted,
}: {
  stepNumber: number;
  label: string;
  shortLabel?: string;
  isActive: boolean;
  isCompleted: boolean;
}) {
  return (
    <div className={`relative flex items-center gap-2 px-0.5 pb-2.5 sm:pb-3 mr-5 sm:mr-7 cursor-default`}>
      {/* Circle indicator */}
      <div
        className={`w-5 h-5 sm:w-[22px] sm:h-[22px] rounded-full flex items-center justify-center text-[10px] sm:text-[11px] shrink-0 transition-all duration-200 ${
          isCompleted
            ? "bg-[#10B981] text-white shadow-[0_0_0_2px_rgba(16,185,129,0.15)]"
            : isActive
            ? "bg-[#0A77FF] text-white shadow-[0_0_0_2px_rgba(10,119,255,0.15)]"
            : "bg-[#EEF2F6] text-[#94A3B8]"
        }`}
        style={{ fontWeight: 700 }}
      >
        {isCompleted ? <Check className="w-3 h-3" /> : stepNumber}
      </div>
      {/* Label */}
      <span
        className={`text-xs sm:text-[13px] whitespace-nowrap transition-colors ${
          isCompleted
            ? "text-[#10B981]"
            : isActive
            ? "text-[#0F172A]"
            : "text-[#94A3B8]"
        }`}
        style={{ fontWeight: isActive || isCompleted ? 600 : 400 }}
      >
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{shortLabel || label}</span>
      </span>
      {/* Active underline bar */}
      {(isActive || isCompleted) && (
        <div className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full transition-all ${
          isCompleted ? "bg-[#10B981]" : "bg-[#0A77FF]"
        }`} />
      )}
    </div>
  );
}

// ── Step 1 Selected Chips Row — matches Step 2 GroupChipsRow design with remove buttons ──
const STEP1_MAX_VISIBLE = 3;

function Step1ChipWithPopover({
  group,
  isPrimary,
  onRemove,
}: {
  group: PartnerGroup;
  isPrimary: boolean;
  onRemove: (group: PartnerGroup) => void;
}) {
  const [open, setOpen] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => setOpen(false), 150);
  }, []);

  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
      <PopoverTrigger asChild>
        <div
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          className={`inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-[11px] border transition-colors cursor-default shrink-0 ${
            isPrimary
              ? "bg-[#EDF4FF] text-[#0A77FF] border-[#0A77FF]/25"
              : "bg-[#F8FAFC] text-[#475569] border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F1F5F9]"
          }`}
          style={{ fontWeight: 500 }}
        >
          {isPrimary && (
            <Star className="w-2.5 h-2.5 fill-[#0A77FF] text-[#0A77FF]" />
          )}
          {group.countryFlag} {group.name}
          <span
            className="text-[10px] text-[#94A3B8]"
            style={{ fontWeight: 400 }}
          >
            · {group.memberCount}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(group); }}
            className="w-4 h-4 rounded flex items-center justify-center hover:bg-black/10 transition-colors ml-0.5 cursor-pointer"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="p-0 w-auto border-0 shadow-none bg-transparent z-[200]"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="w-[280px] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E2E8F0]/60">
          <div className="bg-gradient-to-br from-[#1E293B] to-[#334155] px-3.5 py-3 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
            <div className="flex items-center justify-between relative">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">{group.countryFlag}</span>
                <span className="text-white text-[13px] truncate" style={{ fontWeight: 600 }}>
                  {group.name}
                </span>
              </div>
              {isPrimary && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[#0A77FF]/25 text-[#60A5FA] shrink-0" style={{ fontWeight: 600 }}>
                  <Star className="w-2.5 h-2.5 fill-[#60A5FA]" /> Primary
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-1.5 relative">
              {group.country} Region
            </p>
          </div>
          <div className="bg-white px-3.5 py-3 space-y-3">
            <p className="text-[12px] text-[#475569] leading-relaxed line-clamp-3">
              {group.description}
            </p>
            <div className="flex items-center gap-4 pt-2 border-t border-[#F1F5F9]">
              <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                <Users className="w-3 h-3 text-[#94A3B8]" />
                <span style={{ fontWeight: 500 }}>{group.memberCount} partners</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                <Globe className="w-3 h-3 text-[#94A3B8]" />
                <span style={{ fontWeight: 500 }}>{group.country}</span>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Step1OverflowChip({
  overflowGroups,
  primaryGroupId,
  onRemove,
}: {
  overflowGroups: PartnerGroup[];
  primaryGroupId: string | null;
  onRemove: (group: PartnerGroup) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hoveredGroup, setHoveredGroup] = useState<PartnerGroup | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => {
      setOpen(false);
      setHoveredGroup(null);
    }, 200);
  }, []);

  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) { setOpen(false); setHoveredGroup(null); } }}>
      <PopoverTrigger
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="inline-flex items-center px-2 py-1 rounded-lg text-[11px] border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#475569] hover:border-[#CBD5E1] transition-colors cursor-default shrink-0"
        style={{ fontWeight: 500 }}
      >
        +{overflowGroups.length} more
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="p-0 w-auto border-0 shadow-none bg-transparent z-[200]"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-start gap-2">
          <div className="w-[240px] rounded-xl border border-[#E2E8F0]/60 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden shrink-0">
            <div className="px-3 py-2 border-b border-[#F1F5F9] bg-[#FAFBFC]">
              <span className="text-[11px] text-[#64748B]" style={{ fontWeight: 600 }}>
                +{overflowGroups.length} more group{overflowGroups.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="max-h-[220px] overflow-y-auto py-1">
              {overflowGroups.map((g) => {
                const isPrimary = g.id === primaryGroupId;
                const isHovered = hoveredGroup?.id === g.id;
                return (
                  <div
                    key={g.id}
                    onMouseEnter={() => setHoveredGroup(g)}
                    className={`w-full flex items-center gap-2 px-3 py-2 transition-colors text-left cursor-default ${
                      isHovered ? "bg-[#EDF4FF]" : "hover:bg-[#F8FAFC]"
                    }`}
                  >
                    <span className="shrink-0">{g.countryFlag}</span>
                    <span
                      className={`text-[12px] truncate ${isHovered ? "text-[#0A77FF]" : "text-[#334155]"}`}
                      style={{ fontWeight: 500 }}
                    >
                      {g.name}
                    </span>
                    {isPrimary && (
                      <Star className="w-2.5 h-2.5 fill-[#0A77FF] text-[#0A77FF] shrink-0" />
                    )}
                    <span className="text-[10px] text-[#94A3B8] ml-auto shrink-0">
                      {g.memberCount}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemove(g); }}
                      className="w-4 h-4 rounded flex items-center justify-center hover:bg-black/10 transition-colors shrink-0 cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5 text-[#94A3B8]" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          {hoveredGroup && (
            <div className="shrink-0 animate-in fade-in-0 slide-in-from-left-2 duration-150">
              <div className="w-[280px] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E2E8F0]/60">
                <div className="bg-gradient-to-br from-[#1E293B] to-[#334155] px-3.5 py-3 relative overflow-hidden">
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                  <div className="flex items-center justify-between relative">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{hoveredGroup.countryFlag}</span>
                      <span className="text-white text-[13px] truncate" style={{ fontWeight: 600 }}>
                        {hoveredGroup.name}
                      </span>
                    </div>
                    {hoveredGroup.id === primaryGroupId && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[#0A77FF]/25 text-[#60A5FA] shrink-0" style={{ fontWeight: 600 }}>
                        <Star className="w-2.5 h-2.5 fill-[#60A5FA]" /> Primary
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#94A3B8] mt-1.5 relative">
                    {hoveredGroup.country} Region
                  </p>
                </div>
                <div className="bg-white px-3.5 py-3 space-y-3">
                  <p className="text-[12px] text-[#475569] leading-relaxed line-clamp-3">
                    {hoveredGroup.description}
                  </p>
                  <div className="flex items-center gap-4 pt-2 border-t border-[#F1F5F9]">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                      <Users className="w-3 h-3 text-[#94A3B8]" />
                      <span style={{ fontWeight: 500 }}>{hoveredGroup.memberCount} partners</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                      <Globe className="w-3 h-3 text-[#94A3B8]" />
                      <span style={{ fontWeight: 500 }}>{hoveredGroup.country}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Step1SelectedChipsRow({
  selectedGroups,
  primaryGroupId,
  onRemove,
}: {
  selectedGroups: PartnerGroup[];
  primaryGroupId: string | null;
  onRemove: (group: PartnerGroup) => void;
}) {
  const visibleGroups = selectedGroups.slice(0, STEP1_MAX_VISIBLE);
  const overflowGroups = selectedGroups.slice(STEP1_MAX_VISIBLE);

  return (
    <div className="flex items-center gap-1.5 mb-2 min-w-0 overflow-x-auto">
      {visibleGroups.map((g) => (
        <Step1ChipWithPopover
          key={g.id}
          group={g}
          isPrimary={g.id === primaryGroupId}
          onRemove={onRemove}
        />
      ))}
      {overflowGroups.length > 0 && (
        <Step1OverflowChip
          overflowGroups={overflowGroups}
          primaryGroupId={primaryGroupId}
          onRemove={onRemove}
        />
      )}
    </div>
  );
}

// ── Step 1: Partner Group Selection ──
function Step1GroupSelection({
  search,
  onSearchChange,
  groups,
  selectedGroups,
  primaryGroupId,
  onSelectGroup,
  onSetPrimary,
}: {
  search: string;
  onSearchChange: (val: string) => void;
  groups: PartnerGroup[];
  selectedGroups: PartnerGroup[];
  primaryGroupId: string | null;
  onSelectGroup: (group: PartnerGroup) => void;
  onSetPrimary: (groupId: string) => void;
}) {
  const [quickViewGroup, setQuickViewGroup] = useState<PartnerGroup | null>(null);
  const [groupPage, setGroupPage] = useState(1);
  const [groupsPerPage, setGroupsPerPage] = useState(20);

  // Reset page when search changes or groups list changes
  useEffect(() => {
    setGroupPage(1);
  }, [search, groups.length]);

  const totalGroupPages = Math.max(1, Math.ceil(groups.length / groupsPerPage));

  // Clamp page
  useEffect(() => {
    if (groupPage > totalGroupPages) {
      setGroupPage(totalGroupPages);
    }
  }, [groupPage, totalGroupPages]);

  const pagedGroups = useMemo(() => {
    const start = (groupPage - 1) * groupsPerPage;
    return groups.slice(start, start + groupsPerPage);
  }, [groups, groupPage, groupsPerPage]);

  const getGroupPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalGroupPages <= 7) {
      for (let i = 1; i <= totalGroupPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (groupPage > 3) pages.push("...");
      const start = Math.max(2, groupPage - 1);
      const end = Math.min(totalGroupPages - 1, groupPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (groupPage < totalGroupPages - 2) pages.push("...");
      pages.push(totalGroupPages);
    }
    return pages;
  };

  const handleOpenQuickView = useCallback((e: React.MouseEvent, group: PartnerGroup) => {
    e.stopPropagation();
    setQuickViewGroup(group);
  }, []);

  const selectedIds = useMemo(() => new Set(selectedGroups.map((g) => g.id)), [selectedGroups]);

  return (
    <div>
      {/* Sticky header: label + search + chips + results count */}
      <div className="sticky top-0 z-10 bg-[#FAFBFC] pb-2 -mx-3 sm:-mx-4 lg:-mx-5 px-3 sm:px-4 lg:px-5 pt-1">
        {/* Section label */}
        <div className="mb-2">
          <h4 className="text-[13px] sm:text-sm text-foreground" style={{ fontWeight: 600 }}>Select Partner Groups</h4>
          <p className="text-[11px] sm:text-xs text-[#94A3B8] mt-0.5">
            Choose one or more partner groups. Mark one as primary to inherit its configuration.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <Input
            placeholder="Search partner groups..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-white border-[#E2E8F0] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20 h-8 sm:h-9 text-sm"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Selected chips — single line with +N more overflow, matching Step 2 GroupChipsRow design */}
        {selectedGroups.length > 0 && (
          <Step1SelectedChipsRow
            selectedGroups={selectedGroups}
            primaryGroupId={primaryGroupId}
            onRemove={onSelectGroup}
          />
        )}

        {/* Results count */}
        <p className="text-xs text-muted-foreground">
          {search.trim()
            ? `${groups.length} result${groups.length !== 1 ? "s" : ""} for "${search}"`
            : `${groups.length} group${groups.length !== 1 ? "s" : ""} available`}
        </p>

        {/* Bottom edge line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-[#E2E8F0]/60" />
      </div>

      {/* Scrollable grid area */}
      <div className="pt-2 relative z-0">
        <div
          className="grid gap-1.5 sm:gap-2"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          }}
        >
          {pagedGroups.map((group) => {
            const isSelected = selectedIds.has(group.id);
            const isPrimary = group.id === primaryGroupId;
            return (
              <GroupCard
                key={group.id}
                group={group}
                isSelected={isSelected}
                isPrimary={isPrimary}
                searchQuery={search}
                onSelect={() => onSelectGroup(group)}
                onSetPrimary={() => onSetPrimary(group.id)}
                onQuickView={(e) => handleOpenQuickView(e, group)}
              />
            );
          })}
        </div>

        {/* End of page indicator */}
        {pagedGroups.length > 0 && (
          <div className="flex flex-col items-center pt-5 pb-4">
            <div className="flex items-center gap-2.5 w-full max-w-[200px]">
              <div className="flex-1 h-px bg-[#E2E8F0]" />
              <span className="text-[10px] text-[#94A3B8] whitespace-nowrap" style={{ fontWeight: 500 }}>
                End of page {groupPage} of {totalGroupPages}
              </span>
              <div className="flex-1 h-px bg-[#E2E8F0]" />
            </div>
          </div>
        )}

        {groups.length === 0 && (
          <div className="py-10 sm:py-14 text-center">
            <div className="w-11 h-11 rounded-xl bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
              <Search className="w-5 h-5 text-[#94A3B8]" />
            </div>
            <p className="text-[13px] text-[#334155]" style={{ fontWeight: 600 }}>No groups found</p>
            <p className="text-xs text-[#94A3B8] mt-1">
              Try adjusting your search terms.
            </p>
          </div>
        )}

        {/* Pagination */}
        {groups.length > 0 && (
          <div className="sticky bottom-0 z-10 flex flex-col sm:flex-row items-center justify-center px-3 py-1.5 border-t border-[#E2E8F0] bg-white gap-1.5 sm:gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
              <span>Per page</span>
              <Select
                value={String(groupsPerPage)}
                onValueChange={(val) => {
                  setGroupsPerPage(Number(val));
                  setGroupPage(1);
                }}
              >
                <SelectTrigger className="w-[52px] h-6 text-[11px] px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[250]">
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                disabled={groupPage === 1}
                onClick={() => setGroupPage(1)}
              >
                <ChevronsLeft className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 gap-0.5 text-[11px] text-muted-foreground"
                disabled={groupPage === 1}
                onClick={() => setGroupPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-3 h-3" />
                Prev
              </Button>

              {getGroupPageNumbers().map((page, idx) =>
                page === "..." ? (
                  <span key={`dots-${idx}`} className="px-0.5 text-[11px] text-muted-foreground">
                    ...
                  </span>
                ) : (
                  <Button
                    key={page}
                    variant={groupPage === page ? "default" : "ghost"}
                    size="sm"
                    className={`h-6 w-6 p-0 text-[11px] ${
                      groupPage === page
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                    onClick={() => setGroupPage(page as number)}
                  >
                    {page}
                  </Button>
                )
              )}

              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 gap-0.5 text-[11px] text-muted-foreground"
                disabled={groupPage === totalGroupPages}
                onClick={() => setGroupPage((p) => Math.min(totalGroupPages, p + 1))}
              >
                Next
                <ChevronRight className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                disabled={groupPage === totalGroupPages}
                onClick={() => setGroupPage(totalGroupPages)}
              >
                <ChevronsRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Quick View Overlay */}
      {quickViewGroup && (
        <GroupQuickViewOverlay
          group={quickViewGroup}
          onClose={() => setQuickViewGroup(null)}
        />
      )}
    </div>
  );
}

// ── Group Card with hover actions, multi-select checkmark, primary badge ──
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

// ── Pricing Rule Template Card (matches PricingRulesTab card with tiers) ──
function PrTemplateCardInner({
  rule,
  isApplied,
  searchText,
  onClick,
  onApply,
  onDuplicate,
}: {
  rule: PricingRulePreset;
  isApplied: boolean;
  searchText?: string;
  onClick: () => void;
  onApply: () => void;
  onDuplicate: () => void;
}) {
  const [activeTier, setActiveTier] = useState(0);
  const isDis = rule.category === "discount";
  const isMulti = rule.tierType === "multiple" && rule.tiers.length > 1;
  const shownTier = rule.tiers[isMulti ? activeTier : 0];
  const isCustom = rule.id.startsWith("pr-custom-");
  const pill = isDis
    ? { text: "#047857", bg: "#ECFDF5", border: "#D1FAE5" }
    : { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" };

  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-xl cursor-pointer group transition-all duration-200 flex flex-col relative ${
        isApplied
          ? "border-[#0A77FF]/25 shadow-[0_2px_12px_rgba(10,119,255,0.10)]"
          : "border-[#E8ECF1] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-[#BFDBFE] hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)]"
      }`}
    >
      {isApplied && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#0A77FF] flex items-center justify-center z-10 shadow-sm">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}

      <div className="p-3.5 flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Row 1: Type pill + Preset/Custom badge */}
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
          <span className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0" style={{ borderColor: pill.border }}>
            <span
              className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px]"
              style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg }}
            >
              {isDis ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
              {isDis ? "Discount" : "Premium"}
            </span>
            <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-[#64748B] border-l" style={{ fontWeight: 500, borderColor: pill.border }}>
              {rule.basis === "volume" ? "Volume" : "Value"}
            </span>
          </span>
          <span className={`inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md border text-[9px] shrink-0 ${
            isCustom
              ? "border-[#CBD5E1] bg-white text-[#475569]"
              : "bg-[#F1F5F9] border-[#CBD5E1] text-[#64748B]"
          }`} style={{ fontWeight: 600 }}>
            {isCustom ? "CUSTOM" : <><Lock className="w-2.5 h-2.5" /> TEMPLATE</>}
          </span>
        </div>

        {/* Row 2: Name */}
        <div className="shrink-0 mb-1">
          <p className="text-[13px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}>{highlightMatch(rule.name, searchText || "")}</p>
        </div>

        {/* Row 3: Description */}
        <div className="h-[32px] shrink-0 mb-2">
          <p className="text-[11px] text-[#64748B] line-clamp-2 leading-relaxed" style={{ fontWeight: 400 }}>{highlightMatch(rule.description, searchText || "")}</p>
        </div>

        {/* Row 4: Hero value + vendor count */}
        <div className="flex items-baseline justify-between shrink-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[22px] text-[#0F172A] tabular-nums leading-none tracking-tight" style={{ fontWeight: 600 }}>
              {rule.tiers[0]?.discount ?? "—"}
            </span>
            <span className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>
              {isDis ? "off" : "markup"}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] text-[#94A3B8]" style={{ fontWeight: 500 }}>
            <Building2 className="w-3 h-3" /> {rule.vendorsApplied} in use
          </span>
        </div>

        {/* Row 5: Tier selector + detail */}
        <div className="mt-auto pt-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className={`h-[24px] mb-1.5 ${isMulti ? "flex items-center gap-[3px]" : ""}`}>
            {isMulti && rule.tiers.map((_, i) => {
              const isActive = activeTier === i;
              return (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setActiveTier(i); }}
                  className={`h-[22px] rounded-md text-[10px] tabular-nums transition-all duration-200 cursor-pointer flex items-center justify-center px-2 ${
                    isActive
                      ? "shadow-sm"
                      : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"
                  }`}
                  style={{
                    fontWeight: isActive ? 600 : 500,
                    ...(isActive ? { backgroundColor: `${pill.text}18`, color: pill.text, boxShadow: `0 0 0 1px ${pill.text}40` } : {}),
                  }}
                >
                  T{i + 1}
                  {isActive && (
                    <span className="ml-1 text-[9px] opacity-60" style={{ fontWeight: 400 }}>
                      {shownTier?.discount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between px-3 py-[6px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] tabular-nums min-w-0">
            <div className="flex items-center gap-1.5 text-[#64748B] min-w-0">
              <span style={{ fontWeight: 400 }}>{shownTier?.minValue}</span>
              <span className="text-[#CBD5E1]">–</span>
              <span style={{ fontWeight: 400 }}>{shownTier?.maxValue}</span>
            </div>
            <span className="shrink-0 ml-2 text-[#0F172A]" style={{ fontWeight: 600 }}>{shownTier?.discount}</span>
          </div>
        </div>
      </div>

      {/* Footer — Apply + Duplicate */}
      <div className="grid grid-cols-2 border-t border-[#F1F5F9] shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onApply(); }}
          className="inline-flex items-center justify-center gap-1 py-2 text-[11px] text-[#64748B] hover:text-[#0A77FF] hover:bg-[#F8FAFC] transition-colors border-r border-[#F1F5F9]"
          style={{ fontWeight: 500 }}
        >
          <Check className="w-3 h-3" /> Apply
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          className="inline-flex items-center justify-center gap-1 py-2 text-[11px] text-[#64748B] hover:text-[#0A77FF] hover:bg-[#F8FAFC] transition-colors"
          style={{ fontWeight: 500 }}
        >
          <Copy className="w-3 h-3" /> Duplicate
        </button>
      </div>
    </div>
  );
}

function GroupCard({
  group,
  isSelected,
  isPrimary,
  searchQuery,
  onSelect,
  onSetPrimary,
  onQuickView,
}: {
  group: PartnerGroup;
  isSelected: boolean;
  isPrimary: boolean;
  searchQuery?: string;
  onSelect: () => void;
  onSetPrimary: () => void;
  onQuickView: (e: React.MouseEvent) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const handlePrimaryClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSelected) {
      // Select first, then make primary
      onSelect();
      // Small delay to let the select propagate, then set primary
      setTimeout(() => onSetPrimary(), 0);
    } else {
      onSetPrimary();
    }
  }, [isSelected, onSelect, onSetPrimary]);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative text-left p-2.5 sm:p-3 rounded-lg border transition-all duration-150"
      style={{
        borderColor: isSelected ? "#0A77FF" : isHovered ? "#CBD5E1" : "#E2E8F0",
        backgroundColor: isSelected ? "#F5F9FF" : isHovered ? "#FAFCFF" : "#FFFFFF",
        boxShadow: isSelected
          ? "0 0 0 1px rgba(10,119,255,0.15), 0 1px 3px rgba(10,119,255,0.06)"
          : isHovered
            ? "0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)"
            : "none",
      }}
    >
      {/* Top-right actions row */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
        {/* Hover actions for selected cards: eye, star, checkmark */}
        {isSelected && isHovered && (
          <>
            <div
              onClick={(e) => { e.stopPropagation(); onQuickView(e); }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-white/80 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
            </div>
            <div
              onClick={handlePrimaryClick}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isPrimary
                  ? "text-[#0A77FF] hover:bg-white/80"
                  : "text-[#94A3B8] hover:text-[#F59E0B] hover:bg-white/80"
              }`}
              title={isPrimary ? "Primary group" : "Set as primary"}
            >
              <Star className={`w-3.5 h-3.5 ${isPrimary ? "fill-[#0A77FF]" : ""}`} />
            </div>
          </>
        )}

        {/* Hover actions for unselected cards: eye + empty circle */}
        {!isSelected && isHovered && (
          <>
            <div
              onClick={(e) => { e.stopPropagation(); onQuickView(e); }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
            </div>
          </>
        )}

        {/* Primary badge (always visible when primary) */}
        {isPrimary && !isHovered && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#0A77FF] text-white text-[10px]" style={{ fontWeight: 600 }}>
            Primary
          </span>
        )}

        {/* Checkmark (always visible when selected) */}
        {isSelected && (
          <div className="w-5 h-5 rounded-full bg-[#0A77FF] flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}

        {/* Empty circle on hover for unselected */}
        {!isSelected && isHovered && (
          <div className="w-5 h-5 rounded-full border-2 border-[#CBD5E1] bg-white" />
        )}
      </div>

      {/* Icon */}
      <div className={`w-7 h-7 rounded-md flex items-center justify-center mb-1.5 transition-colors ${
        isSelected ? "bg-[#D6E8FF]" : "bg-[#F1F5F9]"
      }`}>
        <Building2 className={`w-4 h-4 transition-colors ${
          isSelected ? "text-primary" : "text-[#64748B]"
        }`} />
      </div>

      {/* Name — no truncation, always show full text */}
      <p className="text-[13px] text-foreground pr-16 break-words" style={{ fontWeight: isSelected ? 600 : 500 }}>{highlightMatch(group.name, searchQuery || "")}</p>

      {/* Description — allow wrapping, show up to 2 lines */}
      <p className="text-[11px] text-[#94A3B8] mt-0.5 line-clamp-2 pr-2 break-words">
        {highlightMatch(group.description, searchQuery || "")}
      </p>

      {/* Footer: partner count */}
      <div className="flex items-center gap-1 mt-1.5 text-[11px] text-[#94A3B8]">
        <Users className="w-3 h-3" />
        <span>{group.memberCount} partner{group.memberCount !== 1 ? "s" : ""}</span>
      </div>
    </button>
  );
}

// ── Quick View Overlay (Associated Vendors) ──
const STATUS_TABS = ["All", "Active", "Inactive"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const VENDOR_ROW_HEIGHT = 44;
const VENDOR_PAGE_SIZE = 50;

function GroupQuickViewOverlay({
  group,
  onClose,
}: {
  group: PartnerGroup;
  onClose: () => void;
}) {
  const allVendors = GROUP_VENDORS[group.id] || [];
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("All");
  const [visibleCount, setVisibleCount] = useState(VENDOR_PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allVendors.filter((v) => {
      if (statusTab !== "All" && v.status !== statusTab) return false;
      if (!q) return true;
      return (
        v.id.toLowerCase().includes(q) ||
        v.name.toLowerCase().includes(q) ||
        v.address.toLowerCase().includes(q)
      );
    });
  }, [allVendors, search, statusTab]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      setVisibleCount((prev) => Math.min(prev + VENDOR_PAGE_SIZE, filtered.length));
    }
  }, [filtered.length]);

  useEffect(() => {
    setVisibleCount(VENDOR_PAGE_SIZE);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [search, statusTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  const statusStyles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    Active: { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0", dot: "#059669" },
    Inactive: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A", dot: "#D97706" },
  };

  const getStatusStyle = (status: GroupVendor["status"]) =>
    statusStyles[status] ?? statusStyles["Inactive"];

  const counts = useMemo(() => {
    const c = { All: allVendors.length, Active: 0, Inactive: 0 };
    for (const v of allVendors) c[v.status]++;
    return c;
  }, [allVendors]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50">
      <div
        ref={overlayRef}
        className="bg-white rounded-xl shadow-2xl border border-[#E2E8F0] w-[calc(100%-1rem)] sm:w-full max-w-[700px] max-h-[85vh] sm:max-h-[600px] flex flex-col animate-modal-pop mx-auto"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[13px] sm:text-sm text-[#0F172A] truncate" style={{ fontWeight: 600 }}>
                {group.name} — Associated Vendors
              </h3>
              <p className="text-[11px] sm:text-xs text-[#94A3B8] mt-0.5">
                {allVendors.length} vendor{allVendors.length !== 1 ? "s" : ""} in this group
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#F1F5F9] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-[#94A3B8]" />
            </button>
          </div>

          {/* Search + Status Tabs */}
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8] pointer-events-none" />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                readOnly
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData.getData("text").trim();
                  if (text) setSearch(text);
                }}
                className="w-full h-8 pl-8 pr-8 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20 focus:outline-none transition-colors cursor-default"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#E2E8F0] hover:bg-[#CBD5E1] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-2.5 h-2.5 text-[#64748B]" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusTab(tab)}
                  className={`px-2 py-1 rounded-md text-[11px] border transition-colors cursor-pointer ${
                    statusTab === tab
                      ? "bg-[#EDF4FF] text-[#0A77FF] border-[#ADD1FF]"
                      : "bg-[#F8FAFC] text-[#64748B] border-transparent hover:bg-[#F1F5F9]"
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  {tab}
                  <span className="ml-1 opacity-75">{counts[tab]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table header */}
        <div className="shrink-0 border-y border-[#EEF2F6] bg-[#FAFBFC] px-4 sm:px-5">
          <div className="grid grid-cols-[72px_1fr_72px] sm:grid-cols-[80px_1.2fr_1.5fr_76px] gap-2 h-8 items-center">
            <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider" style={{ fontWeight: 600 }}>ID</span>
            <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider" style={{ fontWeight: 600 }}>Vendor Name</span>
            <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider hidden sm:block" style={{ fontWeight: 600 }}>Address</span>
            <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider text-right" style={{ fontWeight: 600 }}>Status</span>
          </div>
        </div>

        {/* Vendor list — scrollable */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto scrollbar-hide"
        >
          {visible.length > 0 ? (
            <div className="px-4 sm:px-5">
              {visible.map((vendor) => (
                <div
                  key={vendor.id}
                  className="grid grid-cols-[72px_1fr_72px] sm:grid-cols-[80px_1.2fr_1.5fr_76px] gap-2 items-center py-2.5 border-b border-[#F1F5F9] last:border-b-0 hover:bg-[#F8FAFC] transition-colors -mx-4 sm:-mx-5 px-4 sm:px-5"
                  style={{ minHeight: VENDOR_ROW_HEIGHT }}
                >
                  <span className="text-[11px] text-[#0A77FF] tabular-nums truncate" style={{ fontWeight: 600 }}>
                    {vendor.id}
                  </span>
                  <div className="min-w-0 flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[9px]"
                      style={{
                        fontWeight: 700,
                        backgroundColor: getAvatarTint(vendor.name).bg,
                        color: getAvatarTint(vendor.name).fg,
                      }}
                    >
                      {vendor.name.charAt(0)}
                    </div>
                    <span className="text-[12px] text-[#0F172A] truncate" style={{ fontWeight: 500 }}>
                      {vendor.name}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#64748B] truncate hidden sm:block">
                    {vendor.address}
                  </span>
                  <div className="flex justify-end">
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] shrink-0"
                      style={{
                        fontWeight: 500,
                        backgroundColor: getStatusStyle(vendor.status).bg,
                        color: getStatusStyle(vendor.status).text,
                        borderColor: getStatusStyle(vendor.status).border,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getStatusStyle(vendor.status).dot }} />
                      {vendor.status}
                    </span>
                  </div>
                </div>
              ))}
              {visibleCount < filtered.length && (
                <div className="py-3 text-center">
                  <span className="text-[11px] text-[#94A3B8]">
                    Showing {visibleCount} of {filtered.length} — scroll for more
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-10 text-center">
              <div className="w-10 h-10 rounded-xl bg-[#F1F5F9] flex items-center justify-center mx-auto mb-2.5">
                {search ? (
                  <Search className="w-5 h-5 text-[#94A3B8]" />
                ) : (
                  <Users className="w-5 h-5 text-[#94A3B8]" />
                )}
              </div>
              <p className="text-[13px] text-[#334155]" style={{ fontWeight: 600 }}>
                {search ? "No matching vendors" : "No vendors yet"}
              </p>
              <p className="text-xs text-[#94A3B8] mt-1">
                {search
                  ? "Try adjusting your search or filter."
                  : "This group doesn't have any associated vendors."}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[#EEF2F6] px-4 sm:px-5 py-2.5 flex items-center justify-between bg-[#FAFBFC] rounded-b-xl">
          <span className="text-[11px] text-[#94A3B8]">
            {filtered.length === allVendors.length
              ? `${allVendors.length} total`
              : `${filtered.length} of ${allVendors.length} shown`}
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs text-[#0F172A] bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Partner Form (restructured) ──
function Step2PartnerForm({
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
  const [gNewPocDepartment, setGNewPocDepartment] = useState("");
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
    { code: "+1", flag: "🇺🇸", country: "United States" },
    { code: "+1", flag: "🇨🇦", country: "Canada" },
    { code: "+44", flag: "🇬🇧", country: "United Kingdom" },
    { code: "+49", flag: "🇩🇪", country: "Germany" },
    { code: "+33", flag: "🇫🇷", country: "France" },
    { code: "+81", flag: "🇯🇵", country: "Japan" },
    { code: "+86", flag: "🇨🇳", country: "China" },
    { code: "+91", flag: "🇮🇳", country: "India" },
    { code: "+61", flag: "🇦🇺", country: "Australia" },
    { code: "+55", flag: "🇧🇷", country: "Brazil" },
    { code: "+971", flag: "🇦🇪", country: "UAE" },
    { code: "+65", flag: "🇸🇬", country: "Singapore" },
    { code: "+82", flag: "🇰🇷", country: "South Korea" },
    { code: "+52", flag: "🇲🇽", country: "Mexico" },
    { code: "+31", flag: "🇳🇱", country: "Netherlands" },
    { code: "+46", flag: "🇸🇪", country: "Sweden" },
    { code: "+41", flag: "🇨🇭", country: "Switzerland" },
    { code: "+34", flag: "🇪🇸", country: "Spain" },
    { code: "+39", flag: "🇮🇹", country: "Italy" },
    { code: "+48", flag: "🇵🇱", country: "Poland" },
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
    { main: "Rua Augusta 274", secondary: "São Paulo, SP 01305-000, Brazil" },
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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute address dropdown portal position
  useEffect(() => {
    if (!addressFocused || !addressInputWrapRef.current) { setAddrDropdownPos(null); return; }
    const updatePos = () => { const el = addressInputWrapRef.current; if (!el) return; const r = el.getBoundingClientRect(); setAddrDropdownPos({ top: r.bottom, left: r.left, width: r.width }); };
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => { window.removeEventListener("scroll", updatePos, true); window.removeEventListener("resize", updatePos); };
  }, []);

  const statusConfig = {
    Active: { text: "#065F46", bg: "#ECFDF5", border: "#A7F3D0", label: "Active" },
    Inactive: { text: "#92400E", bg: "#FFFBEB", border: "#FDE68A", label: "Inactive" },
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
                    <span className="text-[#E2E8F0] text-[11px]">·</span>
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
                  <span className="text-[#E2E8F0] text-[11px]">·</span>
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
                      <span
                        className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap"
                        style={{ fontWeight: 500, backgroundColor: statusConfig[status].bg, color: statusConfig[status].text, borderColor: statusConfig[status].border }}
                      >
                        {statusConfig[status].label}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="z-[250] rounded-lg">
                    <SelectItem value="Active">
                      <span
                        className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap"
                        style={{ fontWeight: 500, backgroundColor: "#ECFDF5", color: "#065F46", borderColor: "#A7F3D0" }}
                      >
                        Active
                      </span>
                    </SelectItem>
                    <SelectItem value="Inactive">
                      <span
                        className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap"
                        style={{ fontWeight: 500, backgroundColor: "#FFFBEB", color: "#92400E", borderColor: "#FDE68A" }}
                      >
                        Inactive
                      </span>
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
            {/* Gradient hover overlay */}
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
            {/* Gradient hover overlay */}
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
function PartnerTypeCard({
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
        {/* Checkbox */}
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

        {/* Compact Configure CTA — only visible when selected */}
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
    if (type.startsWith("image/")) return "🖼️";
    if (type.includes("pdf")) return "📄";
    if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) return "📊";
    if (type.includes("word") || type.includes("document")) return "📝";
    return "📎";
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

// ── Configuration Sub-page: Unified Sidebar Nav ──
function ConfigUnifiedNav({
  subTypes,
  sections,
  selectedSubTypes,
  activeSubTypeTab,
  activeSection,
  onToggleSubType,
  onSetActiveSubType,
  onActiveSectionChange,
}: {
  subTypes: VendorSubType[];
  sections: ConfigSection[];
  selectedSubTypes: Set<string>;
  activeSubTypeTab: string;
  activeSection: string;
  onToggleSubType: (id: string) => void;
  onSetActiveSubType: (id: string) => void;
  onActiveSectionChange: (id: string) => void;
}) {
  const enabledCount = subTypes.filter(s => selectedSubTypes.has(s.id)).length;

  // Check if seller can be disabled (only if another profile is enabled)
  const canDisableSeller = (id: string) => {
    if (id !== "seller_items") return true;
    return enabledCount > 1;
  };

  return (
    <>
      {/* Mobile: horizontal scrollable nav */}
      <div className="sm:hidden shrink-0 border-b border-[#EEF2F6] bg-white overflow-x-auto scrollbar-hide">
        <nav className="flex flex-col">
          <div className="px-3 pt-2 pb-1">
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider" style={{ fontWeight: 600 }}>
              Profiles · {enabledCount} active
            </p>
          </div>
          <div className="flex px-3 py-1.5 gap-1.5 min-w-max">
            {subTypes.map((subType) => {
              const isEnabled = selectedSubTypes.has(subType.id);
              const isActive = activeSubTypeTab === subType.id;
              return (
                <button
                  key={subType.id}
                  onClick={() => onSetActiveSubType(subType.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all whitespace-nowrap shrink-0 ${
                    isActive && isEnabled
                      ? "bg-[#EDF4FF] text-[#0A77FF] ring-1 ring-[#0A77FF]/20"
                      : isActive && !isEnabled
                      ? "bg-[#F8FAFC] text-[#475569] ring-1 ring-[#E2E8F0]"
                      : isEnabled
                      ? "text-[#475569] hover:bg-[#F8FAFC]"
                      : "text-[#94A3B8] hover:bg-[#F8FAFC]"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                    isActive && isEnabled ? "bg-[#0A77FF] text-white" : isEnabled ? "bg-[#DBEAFE] text-[#0A77FF]" : "bg-[#F1F5F9] text-[#CBD5E1]"
                  }`}>
                    {React.cloneElement(subType.icon as React.ReactElement, { className: "w-3.5 h-3.5" })}
                  </div>
                  <span className="text-xs" style={{ fontWeight: isActive ? 600 : 500 }}>{subType.label}</span>
                  {isEnabled && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-[#0A77FF]/10 text-[#0A77FF]" : "bg-[#DCFCE7] text-[#16A34A]"}`} style={{ fontWeight: 600 }}>ON</span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Mobile config section pills */}
          {selectedSubTypes.has(activeSubTypeTab) && (
            <div className="flex px-3 pb-2 gap-1 min-w-max overflow-x-auto scrollbar-hide border-t border-[#F1F5F9] pt-1.5">
              {sections.map((section) => {
                const isActive = section.id === activeSection;
                return (
                  <button
                    key={section.id}
                    onClick={() => onActiveSectionChange(section.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] transition-all whitespace-nowrap ${
                      isActive ? "bg-[#0A77FF] text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"
                    }`}
                    style={{ fontWeight: isActive ? 600 : 500 }}
                  >
                    {section.title}
                  </button>
                );
              })}
            </div>
          )}
        </nav>
      </div>

      {/* Desktop: redesigned profile sidebar */}
      <div className="hidden sm:flex sm:flex-col w-[252px] lg:w-[272px] shrink-0 border-r border-[#EEF2F6] bg-white overflow-y-auto">
        {/* Header */}
        <div className="px-3.5 pt-3.5 pb-2 border-b border-[#F1F5F9]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-[#64748B] uppercase tracking-wider" style={{ fontWeight: 600 }}>Profiles</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EDF4FF] text-[#0A77FF]" style={{ fontWeight: 600 }}>
              {enabledCount} of {subTypes.length} active
            </span>
          </div>
          <p className="text-[10px] text-[#94A3B8] mt-0.5">Enable profiles to configure vendor capabilities</p>
        </div>

        <nav className="flex flex-col px-1.5 py-2 flex-1 gap-0.5">
          {subTypes.map((subType) => {
            const isEnabled = selectedSubTypes.has(subType.id);
            const isActive = activeSubTypeTab === subType.id;
            const isSeller = subType.id === "seller_items";
            const canToggle = !isSeller || canDisableSeller(subType.id);

            return (
              <div key={subType.id}>
                {/* Profile card row */}
                <div
                  className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150 ${
                    isActive
                      ? isEnabled
                        ? "bg-[#EDF4FF] ring-1 ring-[#0A77FF]/15"
                        : "bg-[#F8FAFC] ring-1 ring-[#E2E8F0]"
                      : "hover:bg-[#F8FAFC]"
                  }`}
                  onClick={() => {
                    onSetActiveSubType(subType.id);
                    if (isEnabled) {
                      onActiveSectionChange(sections[0]?.id || activeSection);
                    }
                  }}
                >
                  {/* Profile icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150 ${
                    isActive && isEnabled
                      ? "bg-[#0A77FF] text-white shadow-sm"
                      : isEnabled
                      ? "bg-[#DBEAFE] text-[#0A77FF]"
                      : "bg-[#F1F5F9] text-[#94A3B8]"
                  }`}>
                    {React.cloneElement(subType.icon as React.ReactElement, { className: "w-4 h-4" })}
                  </div>

                  {/* Label + status */}
                  <div className="flex-1 min-w-0">
                    <span className={`block text-[13px] truncate transition-colors duration-150 ${
                      isActive
                        ? "text-[#0F172A]"
                        : isEnabled
                        ? "text-[#1E293B]"
                        : "text-[#64748B] group-hover:text-[#334155]"
                    }`} style={{ fontWeight: isActive ? 600 : isEnabled ? 500 : 400 }}>
                      {subType.label}
                    </span>
                    <span className={`text-[10px] ${
                      isEnabled ? "text-[#16A34A]" : "text-[#94A3B8]"
                    }`} style={{ fontWeight: 500 }}>
                      {isEnabled ? "Active" : "Inactive"}
                      {isSeller && isEnabled && enabledCount === 1 && (
                        <span className="text-[#CBD5E1] ml-1">· Default</span>
                      )}
                    </span>
                  </div>

                  {/* Toggle switch */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!canToggle && isEnabled) return; // Can't disable seller when it's the only one
                      onToggleSubType(subType.id);
                    }}
                    className="shrink-0"
                    title={!canToggle && isEnabled ? "Enable another profile before disabling Seller" : undefined}
                  >
                    <div className={`relative w-8 h-[18px] rounded-full transition-colors duration-200 cursor-pointer ${
                      isEnabled
                        ? "bg-[#0A77FF]"
                        : "bg-[#CBD5E1] hover:bg-[#94A3B8]"
                    } ${!canToggle && isEnabled ? "opacity-50 cursor-not-allowed" : ""}`}>
                      <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        isEnabled ? "left-[16px]" : "left-[2px]"
                      }`} />
                    </div>
                  </div>
                </div>

                {/* Nested config sections — shown for any enabled+active profile */}
                <div
                  className="overflow-hidden transition-all duration-200 ease-out"
                  style={{
                    maxHeight: isActive && isEnabled ? `${sections.length * 36 + 12}px` : "0px",
                    opacity: isActive && isEnabled ? 1 : 0,
                  }}
                >
                  <div className="ml-[20px] pl-[12px] border-l-[1.5px] border-[#E2E8F0] py-1 mt-0.5">
                    {sections.map((section) => {
                      const isSectionActive = isActive && isEnabled && section.id === activeSection;
                      return (
                        <button
                          key={section.id}
                          onClick={() => onActiveSectionChange(section.id)}
                          className={`group/item w-full flex items-center gap-2 px-2.5 py-[7px] rounded-md text-left transition-colors duration-150 ${
                            isSectionActive
                              ? "bg-[#EDF4FF]"
                              : "hover:bg-[#F1F5F9]/60"
                          }`}
                        >
                          <span className={`transition-colors duration-150 ${
                            isSectionActive
                              ? "text-[#0A77FF]"
                              : "text-[#94A3B8] group-hover/item:text-[#64748B]"
                          }`}>
                            {React.cloneElement(section.icon as React.ReactElement, { className: "w-3.5 h-3.5" })}
                          </span>
                          <span className={`text-[12.5px] truncate transition-colors duration-150 ${
                            isSectionActive
                              ? "text-[#0A77FF]"
                              : "text-[#475569] group-hover/item:text-[#1E293B]"
                          }`} style={{ fontWeight: isSectionActive ? 600 : 400 }}>
                            {section.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Sidebar footer hint */}
        <div className="px-3.5 py-2.5 border-t border-[#F1F5F9]">
          <p className="text-[10px] text-[#94A3B8] leading-relaxed">
            <Info className="w-3 h-3 inline mr-1 -mt-0.5" />
            Seller profile is always required. Enable additional profiles to expand capabilities.
          </p>
        </div>
      </div>
    </>
  );
}


// ── Configuration Sub-page: Content (matches reference image) ──
function ConfigPageContent({
  sectionId,
  configType,
  selectedGroup,
  partnerName,
  configDataRef,
}: {
  sectionId: string;
  configType: "vendor" | "customer";
  selectedGroup: PartnerGroup | null;
  partnerName: string;
  configDataRef: React.MutableRefObject<Record<string, unknown>>;
}) {
  const sections = configType === "vendor" ? VENDOR_CONFIG_SECTIONS : CUSTOMER_CONFIG_SECTIONS;
  const currentSection = sections.find((s) => s.id === sectionId) || sections[0];

  // Local interactive state for pill/radio selections
  const [billingType, setBillingType] = useState("domestic");
  const [shippingPref, setShippingPref] = useState("same_as_billing");
  const [enforcement, setEnforcement] = useState("none");
  const [thresholdAlertRecipients, setThresholdAlertRecipients] = useState<Set<string>>(new Set());
  const [softWarningRecipients, setSoftWarningRecipients] = useState<Set<string>>(new Set());
  const [hardBlockRecipients, setHardBlockRecipients] = useState<Set<string>>(new Set());
  
  const [paymentTerm, setPaymentTerm] = useState("net_30");
  const [pricingTier, setPricingTier] = useState("standard");
  const [shippingMethod, setShippingMethod] = useState("ground");

  // Payment Terms Presets state
  const [selectedPaymentTermId, setSelectedPaymentTermId] = useState<string | null>(null);
  const [paymentTermsModalOpen, setPaymentTermsModalOpen] = useState(false);
  const [ptTypeFilters, setPtTypeFilters] = useState<string>("net");
  const [ptStatusFilter, setPtStatusFilter] = useState("all");
  const [ptSearch, setPtSearch] = useState("");
  const [ptSortBy, setPtSortBy] = useState<"name" | "vendorsApplied" | "duration" | "category">("name");
  const [ptSortDir, setPtSortDir] = useState<"asc" | "desc">("asc");
  const [ptSortOpen, setPtSortOpen] = useState(false);
  const [previewPaymentTermId, setPreviewPaymentTermId] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState("items");
  const [ptFullscreen, setPtFullscreen] = useState(false);
  const [aboutPtOpen, setAboutPtOpen] = useState(true);
  const [vendorsPtOpen, setVendorsPtOpen] = useState(true);
  const [standalonePtDetailOpen, setStandalonePtDetailOpen] = useState(false);
  const [standalonePtDetailTerm, setStandalonePtDetailTerm] = useState<PaymentTermPreset | null>(null);

  // Create Payment Terms modal state
  const [createPtModalOpen, setCreatePtModalOpen] = useState(false);
  const [createPtFullscreen, setCreatePtFullscreen] = useState(false);
  const [createPtName, setCreatePtName] = useState("");
  const [createPtType, setCreatePtType] = useState<"net" | "prepayment" | "split">("net");
  const [createPtTrigger, setCreatePtTrigger] = useState("order_confirmation");
  const [createPtShipReceive, setCreatePtShipReceive] = useState<"ship" | "receive">("ship");
  const [createPtPrepayMode, setCreatePtPrepayMode] = useState<"percent" | "fixed">("percent");
  const [createPtDuration, setCreatePtDuration] = useState("30");
  const [createPtCustomDuration, setCreatePtCustomDuration] = useState("");
  const [createPtDescription, setCreatePtDescription] = useState("");
  const [createPtApplyDiscount, setCreatePtApplyDiscount] = useState(false);
  const [createPtDiscountPercent, setCreatePtDiscountPercent] = useState("");
  const [createPtDiscountMode, setCreatePtDiscountMode] = useState<"percent" | "fixed">("percent");
  const [createPtDiscountPeriod, setCreatePtDiscountPeriod] = useState("10");
  const [createPtCustomDiscountPeriod, setCreatePtCustomDiscountPeriod] = useState("");
  const [createPtStep, setCreatePtStep] = useState<1 | 2>(1);
  // Split payment events
  const [createPtSplitEvents, setCreatePtSplitEvents] = useState<Array<{ event: string; percent: string; fixRate: boolean }>>([
    { event: "order_confirmation", percent: "", fixRate: false },
    { event: "", percent: "", fixRate: false },
  ]);

  // Shipping Methods section states (must be at top level, not inside conditional)
  const [carrierSectionOpen, setCarrierSectionOpen] = useState(true);
  const [vendorPrefSectionOpen, setVendorPrefSectionOpen] = useState(true);
  const [carrierSearches, setCarrierSearches] = useState<Record<string, string>>({});
  const [carrierDropdownOpen, setCarrierDropdownOpen] = useState<Record<string, boolean>>({});
  const [methodDropdownOpen, setMethodDropdownOpen] = useState<Record<string, boolean>>({});
  const [methodSearches, setMethodSearches] = useState<Record<string, string>>({});
  const [recentlyUsedCarriers, setRecentlyUsedCarriers] = useState<string[]>(["fedex", "dhl", "ups"]);
  // Create Shipping Method modal state
  const [createShippingMethodOpen, setCreateShippingMethodOpen] = useState(false);
  const [createSmForEntry, setCreateSmForEntry] = useState<string>(""); // which vendor pref entry triggered it
  const [createSmForCarrier, setCreateSmForCarrier] = useState<string>(""); // carrier id
  const [createSmMethods, setCreateSmMethods] = useState<Array<{ id: string; name: string; description: string; minDuration: number; maxDuration: number; isDefault: boolean }>>([
    { id: `csm-1`, name: "", description: "", minDuration: 1, maxDuration: 30, isDefault: true },
  ]);
  const [recentlyUsedMethods, setRecentlyUsedMethods] = useState<Record<string, string[]>>({
    fedex: ["fedex-air", "fedex-ground"],
    dhl: ["dhl-express"],
    ups: ["ups-next-day"],
  });

  const TRIGGER_TOOLTIPS: Record<string, string> = {
    order_confirmation: "Payment clock starts when the purchase order is confirmed by both parties.",
    production_start: "Payment clock starts when goods enter production or manufacturing begins.",
    production_end: "Payment clock starts when production is completed and goods are ready.",
    shipping: "Payment clock starts when goods are shipped from the supplier's facility.",
    delivery: "Payment clock starts when goods are received at the destination.",
  };

  function resetCreatePtForm() {
    setCreatePtName("");
    setCreatePtType("net");
    setCreatePtTrigger("order_confirmation");
    setCreatePtDuration("30");
    setCreatePtCustomDuration("");
    setCreatePtDescription("");
    setCreatePtApplyDiscount(false);
    setCreatePtDiscountPercent("");
    setCreatePtDiscountMode("percent");
    setCreatePtDiscountPeriod("10");
    setCreatePtCustomDiscountPeriod("");
    setCreatePtStep(1);
    setCreatePtSplitEvents([
      { event: "order_confirmation", percent: "", fixRate: false },
      { event: "", percent: "", fixRate: false },
    ]);
  }

  function handleDuplicatePaymentTerm(term: PaymentTermPreset) {
    resetCreatePtForm();
    setCreatePtName(`duplicate-${term.name}`);
    const categoryToType = (c: PaymentTermCategory): "net" | "prepayment" | "split" =>
      c === "net" ? "net" : c === "prepayment" ? "prepayment" : "split";
    setCreatePtType(categoryToType(term.category));
    // Map trigger label back to id
    const triggerMatch = CREATE_PT_TRIGGERS.find((t) => t.label === term.trigger);
    if (triggerMatch) setCreatePtTrigger(triggerMatch.id);
    if (term.duration) setCreatePtDuration(term.duration);
    setCreatePtDescription(term.description);
    if (term.applyDiscount) {
      setCreatePtApplyDiscount(true);
      if (term.discountPercent) setCreatePtDiscountPercent(term.discountPercent);
      if (term.discountPeriod) setCreatePtDiscountPeriod(term.discountPeriod);
    }
    setPaymentTermsModalOpen(false);
    setCreatePtModalOpen(true);
  }

  function handleSaveNewPaymentTerm() {
    if (!createPtName.trim()) {
      toast.error("Please enter a payment term name.");
      return;
    }
    const typeLabel = createPtType === "net" ? "NET" : createPtType === "prepayment" ? "Pre" : "Split";
    const badgeColor = createPtType === "net" ? "#0A77FF" : createPtType === "prepayment" ? "#7C3AED" : "#D97706";
    const triggerLabel = CREATE_PT_TRIGGERS.find((t) => t.id === createPtTrigger)?.label || createPtTrigger;

    // Auto-generate a rich description if the user didn't provide one
    let autoDescription = "";
    if (createPtDescription.trim()) {
      autoDescription = createPtDescription.trim();
    } else {
      const durationLabel = CREATE_PT_DURATIONS.find((d) => d.id === createPtDuration)?.label || `${createPtDuration} days`;
      if (createPtType === "net") {
        autoDescription = `Payment is due ${durationLabel} after ${triggerLabel.toLowerCase()}.`;
      } else if (createPtType === "prepayment") {
        autoDescription = `Prepayment required within ${durationLabel} of ${triggerLabel.toLowerCase()}.`;
      } else {
        autoDescription = `Split payment term triggered on ${triggerLabel.toLowerCase()}.`;
      }
      if (createPtApplyDiscount && createPtDiscountPercent) {
        const resolvedPeriod = createPtDiscountPeriod === "custom" ? createPtCustomDiscountPeriod : createPtDiscountPeriod;
        const discPeriodLabel = `${resolvedPeriod} days`;
        const discValue = createPtDiscountMode === "fixed" ? `$${createPtDiscountPercent}` : `${createPtDiscountPercent}%`;
        autoDescription += ` ${discValue} discount if paid within ${discPeriodLabel}.`;
      }
    }

    const newPreset: PaymentTermPreset = {
      id: `pt-custom-${Date.now()}`,
      name: createPtName,
      category: createPtType === "net" ? "net" : createPtType === "prepayment" ? "prepayment" : "split",
      typeBadge: typeLabel,
      badgeColor,
      trigger: triggerLabel,
      description: autoDescription,
      vendorsApplied: 0,
      duration: createPtDuration,
      applyDiscount: createPtApplyDiscount,
      discountPercent: createPtApplyDiscount ? createPtDiscountPercent : undefined,
      discountMode: createPtApplyDiscount ? createPtDiscountMode : undefined,
      discountPeriod: createPtApplyDiscount ? (createPtDiscountPeriod === "custom" ? createPtCustomDiscountPeriod : createPtDiscountPeriod) : undefined,
    };
    setSelectedPaymentTermId(newPreset.id);
    // We store a reference to show the selected card
    customPaymentTermRef.current = newPreset;
    setCreatePtModalOpen(false);
    resetCreatePtForm();
    toast.success("Payment term created and applied.");
  }

  const customPaymentTermRef = useRef<PaymentTermPreset | null>(null);

  const selectedPaymentTermPreset = selectedPaymentTermId
    ? (customPaymentTermRef.current?.id === selectedPaymentTermId
        ? customPaymentTermRef.current
        : PAYMENT_TERM_PRESETS.find((p) => p.id === selectedPaymentTermId)) || null
    : null;

  const filteredPaymentTermPresets = useMemo(() => {
    let terms = PAYMENT_TERM_PRESETS;
    // Type filter (single-select tab)
    if (ptTypeFilters) terms = terms.filter((t) => t.category === ptTypeFilters);
    // Status filter (parallel)
    if (ptStatusFilter === "preset") terms = terms.filter((t) => !t.id.startsWith("pt-custom-"));
    else if (ptStatusFilter === "custom") terms = terms.filter((t) => t.id.startsWith("pt-custom-"));
    else if (ptStatusFilter === "created_by_me") terms = terms.filter((t) => t.id.startsWith("pt-custom-"));
    else if (ptStatusFilter === "in_use") terms = terms.filter((t) => t.vendorsApplied >= 1);
    if (ptSearch.trim()) {
      const q = ptSearch.toLowerCase();
      terms = terms.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }
    // Sort
    const sorted = [...terms].sort((a, b) => {
      let cmp = 0;
      if (ptSortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (ptSortBy === "vendorsApplied") cmp = a.vendorsApplied - b.vendorsApplied;
      else if (ptSortBy === "duration") {
        const da = parseInt(a.duration || a.name.match(/\d+/)?.[0] || "0", 10);
        const db = parseInt(b.duration || b.name.match(/\d+/)?.[0] || "0", 10);
        cmp = da - db;
      } else if (ptSortBy === "category") cmp = a.category.localeCompare(b.category);
      return ptSortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [ptTypeFilters, ptStatusFilter, ptSearch, ptSortBy, ptSortDir]);

  // Pricing Rules state
  const [selectedPricingRuleIds, setSelectedPricingRuleIds] = useState<string[]>([]);
  const [pricingRulesModalOpen, setPricingRulesModalOpen] = useState(false);
  const [prTypeFilters, setPrTypeFilters] = useState<string>("discount");
  const [prStatusFilter, setPrStatusFilter] = useState("all");
  const [prSearch, setPrSearch] = useState("");
  const [prSortBy, setPrSortBy] = useState<"name" | "vendorsApplied" | "category" | "basis">("name");
  const [prSortDir, setPrSortDir] = useState<"asc" | "desc">("asc");
  const [prSortOpen, setPrSortOpen] = useState(false);
  const [previewPricingRuleId, setPreviewPricingRuleId] = useState<string | null>(null);
  const [prPreviewTab, setPrPreviewTab] = useState("preview");
  const [prFullscreen, setPrFullscreen] = useState(false);
  const [createPrModalOpen, setCreatePrModalOpen] = useState(false);
  const [createPrFullscreen, setCreatePrFullscreen] = useState(false);
  const [createPrName, setCreatePrName] = useState("");
  const [createPrDescription, setCreatePrDescription] = useState("");
  const [createPrCategory, setCreatePrCategory] = useState<"discount" | "premium">("discount");
  const [createPrBasis, setCreatePrBasis] = useState<PricingRuleBasis>("value");
  const [createPrLimitDateRange, setCreatePrLimitDateRange] = useState(false);
  const [createPrValidFrom, setCreatePrValidFrom] = useState("");
  const [createPrValidTo, setCreatePrValidTo] = useState("");
  const [createPrStep, setCreatePrStep] = useState<1 | 2>(1);
  const [createPrItemsTab, setCreatePrItemsTab] = useState<"items" | "categories" | "attachments">("items");

  interface CpmTierState { discount: string; fixRate: boolean; qtyLimits: boolean; minQty: string; maxQty: string; }
  const makeCpmTier = (): CpmTierState => ({ discount: "", fixRate: false, qtyLimits: false, minQty: "", maxQty: "" });
  const [createPrTiers, setCreatePrTiers] = useState<CpmTierState[]>([makeCpmTier()]);
  function updateCpmTier(idx: number, patch: Partial<CpmTierState>) { setCreatePrTiers(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t)); }
  function addCpmTier() { setCreatePrTiers(prev => [...prev, makeCpmTier()]); }
  function removeCpmTier(idx: number) { setCreatePrTiers(prev => prev.filter((_, i) => i !== idx)); }

  const customPricingRulesRef = useRef<PricingRulePreset[]>([]);

  // ── Create PR modal: mode + items/categories/attachments state ──
  const [createPrMode, setCreatePrMode] = useState<"create" | "view">("create");
  const [editingPrRuleId, setEditingPrRuleId] = useState<string | null>(null);

  // ── Shared Pricing Rule Detail Modal (reuses PricingRulesTab's DetailModal) ──
  const [prDetailRule, setPrDetailRule] = useState<PricingRule | null>(null);
  const [prDetailOpen, setPrDetailOpen] = useState(false);
  interface CpmItemRow { id: string; partNo: string; description: string; category: string; itemType: string; status: "Active" | "Inactive"; }
  interface CpmCatRow { id: string; code: string; name: string; description: string; linkedItems: number; status: "Active" | "Inactive"; }
  interface CpmAttachment { id: string; name: string; size: string; type: string; uploadedAt: string; }

  const CPM_AVAILABLE_ITEMS: CpmItemRow[] = [
    { id: "cpm-i1", partNo: "100219-42", description: "Front bulkhead cabinet lower cover", category: "Electronics", itemType: "Parts", status: "Active" },
    { id: "cpm-i2", partNo: "100219-51", description: "Box walls inlay cabinet", category: "Hardware", itemType: "Parts", status: "Active" },
    { id: "cpm-i3", partNo: "100219-51-01", description: "Box walls inlay cabinet with defibrillator", category: "Cabinet", itemType: "Equipment + Capital", status: "Active" },
    { id: "cpm-i4", partNo: "100219-51-01RC", description: "Box walls inlay cabinet RC variant", category: "Electronics", itemType: "Equipment + Non-Capital", status: "Active" },
    { id: "cpm-i5", partNo: "100219-51-02", description: "Box walls inlay cabinet extended", category: "Hardware", itemType: "Parts", status: "Inactive" },
    { id: "cpm-i6", partNo: "100219-52", description: "Box closeout top cap inlay cabinet", category: "Electronics", itemType: "Equipment + Non-Capital", status: "Active" },
    { id: "cpm-i7", partNo: "100219-52-02", description: "Box closeout top cap inlay cabinet v2", category: "Cabinet", itemType: "Parts", status: "Active" },
    { id: "cpm-i8", partNo: "02901201000", description: "Foam padding RF1 - 3/8\" X 72\"", category: "Hardware", itemType: "Parts", status: "Active" },
    { id: "cpm-i9", partNo: "100120-79", description: "Toyota long cut, emergency brake", category: "Electronics", itemType: "Equipment + Non-Capital", status: "Active" },
    { id: "cpm-i10", partNo: "100120-70", description: "Toyota long cut, brake line bracket", category: "Hardware", itemType: "Parts", status: "Active" },
    { id: "cpm-i11", partNo: "100120-71", description: "Standard floor with kneeling system", category: "Cabinet", itemType: "Parts", status: "Active" },
    { id: "cpm-i12", partNo: "100150-20", description: "Phillips pan head screw steel black", category: "Fasteners", itemType: "Parts", status: "Active" },
  ];

  const CPM_AVAILABLE_CATS: CpmCatRow[] = [
    { id: "cpm-c1", code: "CAT-101", name: "Ram Pro Master 2500", description: "Ambulance parts", linkedItems: 24, status: "Active" },
    { id: "cpm-c2", code: "CAT-102", name: "Ram Pro Master 3500", description: "Electric platform", linkedItems: 18, status: "Active" },
    { id: "cpm-c3", code: "CAT-103", name: "Ford Transit", description: "Interior panels", linkedItems: 31, status: "Active" },
    { id: "cpm-c4", code: "CAT-104", name: "Sprinter Van", description: "Exterior panels", linkedItems: 12, status: "Active" },
    { id: "cpm-c5", code: "CAT-105", name: "Ram Pro Master Default", description: "Default configuration", linkedItems: 9, status: "Inactive" },
    { id: "cpm-c6", code: "CAT-106", name: "Toyota Chassis", description: "Chassis components", linkedItems: 22, status: "Active" },
    { id: "cpm-c7", code: "CAT-107", name: "Honda Civic Parts", description: "OEM parts", linkedItems: 15, status: "Active" },
    { id: "cpm-c8", code: "CAT-108", name: "BMW X Series", description: "Premium parts", linkedItems: 8, status: "Active" },
  ];

  const [cpmSelectedItems, setCpmSelectedItems] = useState<CpmItemRow[]>([]);
  const [cpmSelectedCats, setCpmSelectedCats] = useState<CpmCatRow[]>([]);
  const [cpmAttachments, setCpmAttachments] = useState<CpmAttachment[]>([]);
  const [cpmItemSearch, setCpmItemSearch] = useState("");
  const [cpmCatSearch, setCpmCatSearch] = useState("");
  const [cpmShowItemPicker, setCpmShowItemPicker] = useState(false);
  const [cpmShowCatPicker, setCpmShowCatPicker] = useState(false);
  const [cpmItemPickerSearch, setCpmItemPickerSearch] = useState("");
  const [cpmCatPickerSearch, setCpmCatPickerSearch] = useState("");

  const cpmFilteredSelectedItems = useMemo(() => {
    if (!cpmItemSearch.trim()) return cpmSelectedItems;
    const q = cpmItemSearch.toLowerCase();
    return cpmSelectedItems.filter(i => i.partNo.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
  }, [cpmSelectedItems, cpmItemSearch]);

  const cpmFilteredSelectedCats = useMemo(() => {
    if (!cpmCatSearch.trim()) return cpmSelectedCats;
    const q = cpmCatSearch.toLowerCase();
    return cpmSelectedCats.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [cpmSelectedCats, cpmCatSearch]);

  const cpmAvailableItemsFiltered = useMemo(() => {
    const selectedIds = new Set(cpmSelectedItems.map(i => i.id));
    let items = CPM_AVAILABLE_ITEMS.filter(i => !selectedIds.has(i.id));
    if (cpmItemPickerSearch.trim()) {
      const q = cpmItemPickerSearch.toLowerCase();
      items = items.filter(i => i.partNo.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    }
    return items;
  }, [cpmSelectedItems, cpmItemPickerSearch]);

  const cpmAvailableCatsFiltered = useMemo(() => {
    const selectedIds = new Set(cpmSelectedCats.map(c => c.id));
    let cats = CPM_AVAILABLE_CATS.filter(c => !selectedIds.has(c.id));
    if (cpmCatPickerSearch.trim()) {
      const q = cpmCatPickerSearch.toLowerCase();
      cats = cats.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
    }
    return cats;
  }, [cpmSelectedCats, cpmCatPickerSearch]);

  function cpmAddItem(item: CpmItemRow) { setCpmSelectedItems(prev => [...prev, item]); }
  function cpmRemoveItem(id: string) { setCpmSelectedItems(prev => prev.filter(i => i.id !== id)); }
  function cpmAddCat(cat: CpmCatRow) { setCpmSelectedCats(prev => [...prev, cat]); }
  function cpmRemoveCat(id: string) { setCpmSelectedCats(prev => prev.filter(c => c.id !== id)); }
  function cpmAddAttachment() {
    const names = ["Contract_Q4_2025.pdf", "Vendor_Agreement.pdf", "Pricing_Schedule.xlsx", "Approval_Form.docx", "Terms_Conditions.pdf"];
    const sizes = ["245 KB", "1.2 MB", "89 KB", "342 KB", "567 KB"];
    const types = ["PDF", "PDF", "XLSX", "DOCX", "PDF"];
    const idx = cpmAttachments.length % names.length;
    setCpmAttachments(prev => [...prev, { id: `att-${Date.now()}`, name: names[idx], size: sizes[idx], type: types[idx], uploadedAt: "Just now" }]);
    toast.success("File uploaded successfully");
  }
  function cpmRemoveAttachment(id: string) { setCpmAttachments(prev => prev.filter(a => a.id !== id)); }

  function handleOpenRuleDetails(rule: PricingRulePreset) {
    const converted = presetToPricingRule(rule);
    setPrDetailRule(converted);
    setPrDetailOpen(true);
  }

  // ── Preview-panel editable state ──
  const [prvCategory, setPrvCategory] = useState<"discount" | "premium">("discount");
  const [prvBasis, setPrvBasis] = useState<PricingRuleBasis>("value");
  const [prvName, setPrvName] = useState("");
  const [prvDesc, setPrvDesc] = useState("");
  const [prvLimitDate, setPrvLimitDate] = useState(true);
  const [prvValidFrom, setPrvValidFrom] = useState("2025-04-23");
  const [prvValidTo, setPrvValidTo] = useState("2025-04-23");
  const [prvDiscountPct, setPrvDiscountPct] = useState("");
  const [prvFixRate, setPrvFixRate] = useState(false);
  const [prvQtyLimits, setPrvQtyLimits] = useState(true);
  const [prvMinQty, setPrvMinQty] = useState("");
  const [prvMaxQty, setPrvMaxQty] = useState("");
  const [prvItemsSearch, setPrvItemsSearch] = useState("");
  const [prvItemsFilter, setPrvItemsFilter] = useState("All");
  const [prvItemsCollapsed, setPrvItemsCollapsed] = useState(false);
  const [prvItemsTab, setPrvItemsTab] = useState<"items" | "categories">("items");

  const prevPreviewIdRef = useRef<string | null>(null);

  function resetCreatePrForm() {
    setCreatePrName("");
    setCreatePrDescription("");
    setCreatePrCategory("discount");
    setCreatePrBasis("value");
    setCreatePrLimitDateRange(false);
    setCreatePrValidFrom("");
    setCreatePrValidTo("");
    setCreatePrStep(1);
    setCreatePrItemsTab("items");
    setCreatePrTiers([makeCpmTier()]);
    setCreatePrMode("create");
    setEditingPrRuleId(null);
    setCpmSelectedItems([]);
    setCpmSelectedCats([]);
    setCpmAttachments([]);
    setCpmItemSearch("");
    setCpmCatSearch("");
    setCpmShowItemPicker(false);
    setCpmShowCatPicker(false);
    setCpmItemPickerSearch("");
    setCpmCatPickerSearch("");
  }

  function handleSaveNewPricingRule() {
    if (!createPrName.trim()) return;
    const tierData = createPrTiers.map((t) => ({ minValue: t.minQty || "-", maxValue: t.maxQty || "-", discount: t.discount ? `${t.discount}${t.fixRate ? "$" : "%"}` : "-" }));
    if (editingPrRuleId) {
      // Update existing custom rule
      customPricingRulesRef.current = customPricingRulesRef.current.map((r) =>
        r.id === editingPrRuleId ? {
          ...r,
          name: createPrName,
          category: createPrCategory,
          basis: createPrBasis,
          tierType: createPrTiers.length > 1 ? "multiple" : "single",
          totalTiers: createPrTiers.length,
          description: createPrDescription || r.description,
          tiers: tierData,
          aboutText: createPrDescription || undefined,
        } : r
      );
      setCreatePrModalOpen(false);
      resetCreatePrForm();
      toast.success("Pricing rule updated successfully.");
    } else {
      const newPreset: PricingRulePreset = {
        id: `pr-custom-${Date.now()}`,
        name: createPrName,
        category: createPrCategory,
        basis: createPrBasis,
        tierType: createPrTiers.length > 1 ? "multiple" : "single",
        totalTiers: createPrTiers.length,
        description: createPrDescription || `${createPrCategory === "discount" ? "Discount" : "Premium"} rule: ${createPrName}`,
        tiers: tierData,
        vendorsApplied: 0,
        aboutText: createPrDescription || undefined,
      };
      customPricingRulesRef.current = [...customPricingRulesRef.current, newPreset];
      setSelectedPricingRuleIds((prev) => [...prev, newPreset.id]);
      setCreatePrModalOpen(false);
      resetCreatePrForm();
      toast.success("Pricing rule created and applied.");
    }
  }

  function handleDuplicatePricingRule(rule: PricingRulePreset) {
    resetCreatePrForm();
    setCreatePrName(`Copy of ${rule.name}`);
    setCreatePrDescription(rule.description);
    setCreatePrCategory(rule.category === "all" ? "discount" : rule.category);
    setCreatePrBasis(rule.basis);
    setPricingRulesModalOpen(false);
    setPreviewPricingRuleId(null);
    setPrPreviewTab("preview");
    setCreatePrModalOpen(true);
  }

  function removePricingRule(id: string) {
    setSelectedPricingRuleIds((prev) => prev.filter((r) => r !== id));
    customPricingRulesRef.current = customPricingRulesRef.current.filter((r) => r.id !== id);
  }

  const allPricingRulePresets = useMemo(() => {
    return [...PRICING_RULE_PRESETS, ...customPricingRulesRef.current];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPricingRuleIds]);

  // Sync preview state when a preset is selected (must be after allPricingRulePresets)
  if (previewPricingRuleId && previewPricingRuleId !== prevPreviewIdRef.current) {
    prevPreviewIdRef.current = previewPricingRuleId;
    const pr = allPricingRulePresets.find((r) => r.id === previewPricingRuleId);
    if (pr) {
      setPrvCategory(pr.category === "all" ? "discount" : pr.category);
      setPrvBasis(pr.basis);
      setPrvName(pr.name);
      setPrvDesc(pr.description);
      setPrvDiscountPct(pr.tiers[0]?.discount?.replace("%", "") || "10");
      setPrvMinQty(pr.tiers[0]?.minValue === "-" ? "" : pr.tiers[0]?.minValue || "");
      setPrvMaxQty(pr.tiers[0]?.maxValue === "-" ? "" : pr.tiers[0]?.maxValue || "");
      setPrvLimitDate(true);
      setPrvValidFrom("2025-04-23");
      setPrvValidTo("2025-04-23");
      setPrvFixRate(false);
      setPrvQtyLimits(true);
      setPrvItemsSearch("");
      setPrvItemsFilter("All");
      setPrvItemsCollapsed(false);
      setPrvItemsTab("items");
    }
  }
  if (!previewPricingRuleId && prevPreviewIdRef.current) {
    prevPreviewIdRef.current = null;
  }

  const filteredPricingRulePresets = useMemo(() => {
    let rules = allPricingRulePresets;
    // Type filter (single-select tab)
    if (prTypeFilters) rules = rules.filter((r) => r.category === prTypeFilters);
    // Status filter (parallel)
    if (prStatusFilter === "preset") rules = rules.filter((r) => !r.id.startsWith("pr-custom-"));
    else if (prStatusFilter === "custom") rules = rules.filter((r) => r.id.startsWith("pr-custom-"));
    else if (prStatusFilter === "created_by_me") rules = rules.filter((r) => r.id.startsWith("pr-custom-"));
    else if (prStatusFilter === "vendors_applied") rules = rules.filter((r) => r.vendorsApplied >= 3);
    if (prSearch.trim()) {
      const q = prSearch.toLowerCase();
      rules = rules.filter((r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
    }
    // Sort
    const sorted = [...rules].sort((a, b) => {
      let cmp = 0;
      if (prSortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (prSortBy === "vendorsApplied") cmp = a.vendorsApplied - b.vendorsApplied;
      else if (prSortBy === "category") cmp = a.category.localeCompare(b.category);
      else if (prSortBy === "basis") cmp = a.basis.localeCompare(b.basis);
      return prSortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [prTypeFilters, prStatusFilter, prSearch, allPricingRulePresets, prSortBy, prSortDir]);

  const selectedPricingRules = useMemo(() => {
    return selectedPricingRuleIds.map((id) =>
      allPricingRulePresets.find((r) => r.id === id)
    ).filter(Boolean) as PricingRulePreset[];
  }, [selectedPricingRuleIds, allPricingRulePresets]);

  // Billing & Shipping state
  const [currency, setCurrency] = useState(() => {
    if (selectedGroup?.country) {
      return COUNTRY_CURRENCY_MAP[selectedGroup.country] || "usd";
    }
    return "usd";
  });

  // Auto-set currency when selected partner group changes
  React.useEffect(() => {
    if (selectedGroup?.country) {
      const mapped = COUNTRY_CURRENCY_MAP[selectedGroup.country];
      if (mapped) setCurrency(mapped);
    }
  }, [selectedGroup?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [shipTo, setShipTo] = useState<string | null>("pl-1"); // FR Conversions, Westminster default
  const [payTo, setPayTo] = useState<string | null>("pl-3"); // Toyota International default
  const [fundedBy, setFundedBy] = useState<string | null>("pl-7"); // FR Conversions default
  const [allowAltFunding, setAllowAltFunding] = useState(false);
  const [shipToDialogOpen, setShipToDialogOpen] = useState(false);
  const [shipToSearch, setShipToSearch] = useState("");
  const [shipToFilterTab, setShipToFilterTab] = useState<"all" | "partners" | "locations">("all");
  const [currencyPopoverSearch, setCurrencyPopoverSearch] = useState("");
  const [payToPopoverSearch, setPayToPopoverSearch] = useState("");
  const [payToDialogOpen, setPayToDialogOpen] = useState(false);
  const [payToDialogSearch, setPayToDialogSearch] = useState("");
  const [fundedByDialogOpen, setFundedByDialogOpen] = useState(false);
  const [fundedByDialogSearch, setFundedByDialogSearch] = useState("");
  const [dialogExpandedPartners, setDialogExpandedPartners] = useState<Set<string>>(new Set());

  // Payment Methods state
  const [paymentEntries, setPaymentEntries] = useState<PaymentMethodEntry[]>([]);
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentMethodType>("ach");

  // Shipping Methods state
  const [shippingTab, setShippingTab] = useState<"carrier" | "vendor">("carrier");
  const [carrierServices, setCarrierServices] = useState<Array<{ id: string; name: string; description: string; minDuration: number; maxDuration: number; isDefault: boolean }>>([]);
  const [vendorShippingPrefs, setVendorShippingPrefs] = useState<Array<{ id: string; carrier: string; methods: string; isDefault: boolean }>>([]);
  const csCounter = useRef(1);
  const vspCounter = useRef(1);

  const activePaymentEntry = paymentEntries.find((e) => e.id === activePaymentId) || null;
  const savedPaymentEntries = paymentEntries.filter((e) => e.isSaved);

  function addPaymentEntry(type: PaymentMethodType) {
    const newEntry = createEmptyPaymentEntry(type);
    setPaymentEntries((prev) => [...prev, newEntry]);
    setActivePaymentId(newEntry.id);
    setIsEditingPayment(true);
  }

  function savePaymentEntry(id: string) {
    setPaymentEntries((prev) => prev.map((e) => (e.id === id ? { ...e, isSaved: true } : e)));
    setIsEditingPayment(false);
  }

  function editPaymentEntry(id: string) {
    setActivePaymentId(id);
    setIsEditingPayment(true);
  }

  function cancelPaymentEdit() {
    if (activePaymentEntry && !activePaymentEntry.isSaved) {
      setPaymentEntries((prev) => prev.filter((e) => e.id !== activePaymentEntry.id));
    }
    setIsEditingPayment(false);
    setActivePaymentId(savedPaymentEntries.length > 0 ? savedPaymentEntries[savedPaymentEntries.length - 1].id : null);
  }

  function removePaymentEntry(id: string) {
    setPaymentEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      if (activePaymentId === id) {
        const nextSaved = next.filter((e) => e.isSaved);
        setActivePaymentId(nextSaved.length > 0 ? nextSaved[nextSaved.length - 1].id : null);
        setIsEditingPayment(false);
      }
      return next;
    });
  }

  function updatePaymentEntry(id: string, updates: Partial<PaymentMethodEntry>) {
    setPaymentEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  }

  // ── Point of Contact state ──
  const [showSelectPocModal, setShowSelectPocModal] = useState(false);
  const [showCreatePocModal, setShowCreatePocModal] = useState(false);
  const [contactDictionary, setContactDictionary] = useState<ContactPerson[]>([...CONTACT_DICTIONARY]);
  const [pocSearch, setPocSearch] = useState("");
  const [pocCategoryFilter, setPocCategoryFilter] = useState<"all" | "Sales" | "Supply Chain Management" | "Finance">("all");
  const [pocPage, setPocPage] = useState(1);
  const [pocTempSelected, setPocTempSelected] = useState<Set<string>>(new Set());
  const [selectedPocIds, setSelectedPocIds] = useState<Set<string>>(new Set());
  const POC_PER_PAGE = 20;

  // Create New POC form state
  const [newPocName, setNewPocName] = useState("");
  const [newPocDepartment, setNewPocDepartment] = useState("");
  const [newPocRole, setNewPocRole] = useState("");
  const [newPocLandline, setNewPocLandline] = useState("");
  const [newPocLandlineCode, setNewPocLandlineCode] = useState("+1");
  const [newPocExt, setNewPocExt] = useState("");
  const [newPocMobile, setNewPocMobile] = useState("");
  const [newPocMobileCode, setNewPocMobileCode] = useState("+1");
  const [newPocEmail, setNewPocEmail] = useState("");
  const [saveAndCreateAnother, setSaveAndCreateAnother] = useState(false);

  const AVATAR_COLORS = ["#0A77FF", "#7C3AED", "#059669", "#DC2626", "#D97706", "#0891B2", "#4F46E5", "#BE185D", "#15803D", "#9333EA"];

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
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q)
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

  function getInitials(name: string) {
    return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
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
      company: partnerName || "New Partner",
      department: newPocDepartment,
      phone: newPocLandline ? `${newPocLandlineCode} ${newPocLandline}` : "",
      phoneExt: newPocExt,
      secondaryPhone: newPocMobile ? `${newPocMobileCode} ${newPocMobile}` : "",
      secondaryPhoneExt: "",
      email: newPocEmail,
      avatarColor,
    };
    setContactDictionary((prev) => [newContact, ...prev]);
    // Also auto-select in the temp selection if the select modal is open
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

  // ── Sync all config data to parent ref on every relevant state change ──
  useEffect(() => {
    const allSavedPayments = paymentEntries.filter((e) => e.isSaved).map((e) => ({
      id: e.id, type: e.type, typeLabel: PAYMENT_TYPE_CARDS.find((t) => t.id === e.type)?.label || e.type,
      bankName: e.bankName, accountNumber: e.accountNumber, routingNumber: e.routingNumber,
      cardNumber: e.cardNumber, walletProvider: e.walletProvider, walletId: e.walletId,
      nickname: e.nickname, isPrimary: e.isPrimary,
      discountPercent: e.applyDiscount && e.discountPercent ? parseFloat(e.discountPercent) : undefined,
      additionalChargesPercent: e.applyDiscount && e.additionalCharges ? parseFloat(e.additionalCharges) : undefined,
      isSaved: e.isSaved,
    }));
    const ptPreset = selectedPaymentTermPreset;
    const ptConfig = ptPreset ? {
      id: ptPreset.id, name: ptPreset.name, type: ptPreset.typeBadge, trigger: ptPreset.trigger,
      description: ptPreset.description, duration: ptPreset.duration,
      discountPercent: ptPreset.discountPercent, discountPeriod: ptPreset.discountPeriod,
    } : undefined;
    const allPricingRules = selectedPricingRuleIds.map((id) => {
      const preset = PRICING_RULE_PRESETS.find((p) => p.id === id) || customPricingRulesRef.current.find((p) => p.id === id);
      return preset ? { id: preset.id, name: preset.name, type: preset.category, basis: preset.basis || "value", description: preset.description } : null;
    }).filter(Boolean);
    const pocData = selectedPocContacts.map((c) => ({
      id: c.id, name: c.name, email: c.email, phone: c.phone,
      secondaryPhone: c.secondaryPhone, extension: c.phoneExt,
      department: c.department, avatarColor: c.avatarColor,
    }));
    const shippingData = {
      carrierServices: carrierServices.map((cs) => ({
        name: cs.name, description: cs.description, minDays: cs.minDuration, maxDays: cs.maxDuration, isDefault: cs.isDefault,
      })),
      vendorPreferences: vendorShippingPrefs.map((vp) => ({
        carrier: vp.carrier, methods: vp.methods ? vp.methods.split(",").map((m: string) => m.trim()) : [], isDefault: vp.isDefault,
      })),
    };
    configDataRef.current = {
      configPaymentMethods: allSavedPayments,
      configPaymentTerm: ptConfig,
      configPricingRules: allPricingRules,
      configPointsOfContact: pocData,
      configCreditLimit: { currency, enforcement },
      configShipping: shippingData,
      configBillingType: billingType,
    };
  }, [paymentEntries, selectedPaymentTermPreset, selectedPricingRuleIds, selectedPocContacts, carrierServices, vendorShippingPrefs, currency, enforcement, billingType, configDataRef]);

  if (sectionId === "billing_shipping" || sectionId === "customer_billing") {
    const currencyObj = CURRENCY_OPTIONS.find((c) => c.id === currency);
    const shipToObj = PARTNER_LOCATION_ITEMS.find((i) => i.id === shipTo);
    const payToObj = PARTNER_LOCATION_ITEMS.find((i) => i.id === payTo);
    const fundedByObj = FUNDED_BY_ITEMS.find((i) => i.id === fundedBy);

    // Visual flow nodes
    const flowNodes = [
      {
        icon: <DollarSign className="w-5 h-5" />,
        label: "Currency",
        sublabel: currencyObj ? currencyObj.id.toUpperCase() : null,
        active: !!currencyObj,
        color: "#0A77FF",
        bgActive: "#EFF6FF",
        dataKey: "currency" as const,
      },
      {
        icon: <Receipt className="w-5 h-5" />,
        label: "Pay To",
        sublabel: payToObj ? payToObj.name.split(",")[0] : null,
        active: !!payToObj,
        color: "#8B5CF6",
        bgActive: "#F5F3FF",
        dataKey: "payTo" as const,
      },
      {
        icon: <Truck className="w-5 h-5" />,
        label: "Ship To",
        sublabel: shipToObj ? shipToObj.name.split(",")[0] : null,
        active: !!shipToObj,
        color: "#22C55E",
        bgActive: "#ECFDF5",
        dataKey: "shipTo" as const,
      },
      {
        icon: <Landmark className="w-5 h-5" />,
        label: "Funded By",
        sublabel: fundedByObj ? fundedByObj.name.split(",")[0] : null,
        active: !!fundedByObj,
        color: "#F59E0B",
        bgActive: "#FFFBEB",
        dataKey: "fundedBy" as const,
      },
    ];

    // ── Helper: highlight search matches in text ──
    const highlightMatch = (text: string, query: string) => {
      if (!query.trim()) return text;
      const idx = text.toLowerCase().indexOf(query.toLowerCase());
      if (idx === -1) return text;
      return (
        <span>
          {text.slice(0, idx)}
          <span className="bg-[#FEF08A] text-[#0F172A] rounded-sm px-0.5" style={{ fontWeight: 600 }}>{text.slice(idx, idx + query.length)}</span>
          {text.slice(idx + query.length)}
        </span>
      );
    };

    // ── Helper: render partner logo with image or fallback initials ──
    const PartnerLogo = ({ item, size = 36, className: cls = "" }: { item: PartnerLocationItem; size?: number; className?: string }) => {
      const [imgErr, setImgErr] = useState(false);
      if (item.logoUrl && !imgErr) {
        return (
          <div className={`rounded-lg border border-[#E8ECF1] bg-white flex items-center justify-center shrink-0 overflow-hidden ${cls}`} style={{ width: size, height: size }}>
            <img src={item.logoUrl} alt={item.name} className="w-full h-full object-contain p-1" onError={() => setImgErr(true)} />
          </div>
        );
      }
      return (
        <div className={`rounded-lg flex items-center justify-center text-white shrink-0 ${cls}`} style={{ width: size, height: size, backgroundColor: item.logoColor, fontWeight: 700, fontSize: size * 0.3 }}>
          {item.logoText}
        </div>
      );
    };

    // ── Helper: group items as partners with nested locations ──
    const buildGroupedItems = (items: typeof PARTNER_LOCATION_ITEMS, searchQuery: string) => {
      const partners = items.filter(i => i.type === "partner");
      const locations = items.filter(i => i.type === "location");
      const q = searchQuery.toLowerCase().trim();
      const grouped = partners.map(p => {
        const pLocations = locations.filter(l => l.logoText === p.logoText && l.logoColor === p.logoColor);
        const partnerMatches = !q || p.name.toLowerCase().includes(q) || (p.location && p.location.toLowerCase().includes(q));
        const matchingLocations = !q ? pLocations : pLocations.filter(l => l.name.toLowerCase().includes(q) || (l.location && l.location.toLowerCase().includes(q)));
        const hasMatch = partnerMatches || matchingLocations.length > 0;
        return { partner: p, locations: pLocations, matchingLocations, partnerMatches: partnerMatches as boolean, hasMatch, expanded: !!q && hasMatch };
      });
      const groupedLocationIds = new Set(grouped.flatMap(g => g.locations.map(l => l.id)));
      const orphanLocations = locations.filter(l => !groupedLocationIds.has(l.id));
      const matchingOrphans = !q ? orphanLocations : orphanLocations.filter(l => l.name.toLowerCase().includes(q) || (l.location && l.location.toLowerCase().includes(q)));
      return { grouped: grouped.filter(g => !q || g.hasMatch), orphanLocations: !q ? orphanLocations : matchingOrphans };
    };

    // ── Accordion expand state for dialog ──
    const togglePartnerExpand = (partnerId: string) => {
      setDialogExpandedPartners(prev => {
        const next = new Set(prev);
        if (next.has(partnerId)) next.delete(partnerId); else next.add(partnerId);
        return next;
      });
    };

    // ── Shared partner selection dialog (accordion style) ──
    const renderPartnerSelectionDialog = (
      dialogOpen: boolean,
      setDialogOpen: (open: boolean) => void,
      dialogSearch: string,
      setDialogSearch: (s: string) => void,
      items: typeof PARTNER_LOCATION_ITEMS,
      selectedId: string | null,
      onSelect: (id: string) => void,
      config: { icon: React.ReactNode; iconBg: string; iconColor: string; title: string; description: string }
    ) => {
      const { grouped, orphanLocations } = buildGroupedItems(items, dialogSearch);
      const hasSearch = dialogSearch.trim().length > 0;

      return (
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setDialogSearch(""); setDialogExpandedPartners(new Set()); } }}>
          <DialogContent
            className="!max-w-[520px] p-0 gap-0 rounded-2xl border-0 overflow-hidden"
            style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
            hideCloseButton
          >
            <DialogTitle className="sr-only">{config.title}</DialogTitle>
            <DialogDescription className="sr-only">{config.description}</DialogDescription>
            <div className="px-5 pt-4 pb-3 border-b border-[#F1F5F9]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: config.iconBg }}>{config.icon}</div>
                  <div>
                    <h3 className="text-sm text-[#0F172A]" style={{ fontWeight: 600 }}>{config.title}</h3>
                    <p className="text-[11px] text-[#64748B]">{config.description}</p>
                  </div>
                </div>
                <button onClick={() => { setDialogOpen(false); setDialogSearch(""); setDialogExpandedPartners(new Set()); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-all"><X className="w-4 h-4" /></button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input value={dialogSearch} onChange={(e) => setDialogSearch(e.target.value)} placeholder="Search partners & locations..." className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A77FF] focus:ring-2 focus:ring-[#0A77FF]/10" autoFocus />
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {grouped.length === 0 && orphanLocations.length === 0 ? (
                <div className="py-10 text-center">
                  <Search className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
                  <p className="text-sm text-[#64748B]" style={{ fontWeight: 500 }}>No results found</p>
                  <p className="text-xs text-[#94A3B8] mt-0.5">Try a different search term</p>
                </div>
              ) : (
                <div className="py-1">
                  {grouped.map(({ partner, locations: allLocs, matchingLocations }) => {
                    const locsToShow = hasSearch ? matchingLocations : allLocs;
                    const isPartnerSelected = selectedId === partner.id;
                    const isExpanded = hasSearch ? true : dialogExpandedPartners.has(partner.id);
                    const hasLocs = locsToShow.length > 0;
                    return (
                      <div key={partner.id} className="border-b border-[#F8FAFC] last:border-b-0">
                        <div className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[#F8FAFC] ${isPartnerSelected ? "bg-[#EDF4FF]/60" : ""}`}>
                          {hasLocs ? (
                            <button onClick={(e) => { e.stopPropagation(); togglePartnerExpand(partner.id); }} className="w-5 h-5 flex items-center justify-center rounded text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-all shrink-0">
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          ) : <div className="w-5 h-5 shrink-0" />}
                          <PartnerLogo item={partner} size={32} />
                          <button onClick={() => { onSelect(partner.id); setDialogOpen(false); setDialogSearch(""); setDialogExpandedPartners(new Set()); }} className="flex flex-col min-w-0 flex-1 text-left">
                            <span className="text-[13px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}>{highlightMatch(partner.name, dialogSearch)}</span>
                          </button>
                          <div className="flex items-center gap-2 shrink-0">
                            {partner.isDefault && <span className="text-[9px] text-[#0A77FF] bg-[#EDF4FF] border border-[#0A77FF]/20 px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>Primary</span>}
                            {hasLocs && <span className="text-[10px] text-[#94A3B8] bg-[#F8FAFC] border border-[#E8ECF1] px-1.5 py-0.5 rounded" style={{ fontWeight: 500 }}>{locsToShow.length} loc{locsToShow.length !== 1 ? "s" : ""}</span>}
                            {isPartnerSelected && <Check className="w-4 h-4 text-[#0A77FF]" />}
                          </div>
                        </div>
                        {isExpanded && hasLocs && (
                          <div className="ml-9 border-l border-[#E8ECF1] bg-[#FAFBFC]/50">
                            {locsToShow.map((loc) => {
                              const isLocSelected = selectedId === loc.id;
                              return (
                                <button key={loc.id} onClick={() => { onSelect(loc.id); setDialogOpen(false); setDialogSearch(""); setDialogExpandedPartners(new Set()); }} className={`w-full flex items-center gap-3 pl-4 pr-4 py-2 text-left transition-colors hover:bg-[#F1F5F9] ${isLocSelected ? "bg-[#EDF4FF]/60" : ""}`}>
                                  <MapPin className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-[12px] text-[#334155] truncate" style={{ fontWeight: 500 }}>{highlightMatch(loc.name, dialogSearch)}</span>
                                    {loc.location && <span className="text-[10px] text-[#94A3B8] hover:text-[#0A77FF] hover:underline transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.location!)}`, "_blank"); }}>{highlightMatch(loc.location, dialogSearch)}</span>}
                                  </div>
                                  {isLocSelected && <Check className="w-4 h-4 text-[#0A77FF] shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {orphanLocations.length > 0 && (
                    <>
                      {grouped.length > 0 && <div className="border-t border-[#F1F5F9] my-1" />}
                      {orphanLocations.map((loc) => {
                        const isLocSelected = selectedId === loc.id;
                        return (
                          <button key={loc.id} onClick={() => { onSelect(loc.id); setDialogOpen(false); setDialogSearch(""); setDialogExpandedPartners(new Set()); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#F8FAFC] ${isLocSelected ? "bg-[#EDF4FF]/60" : ""}`}>
                            <div className="w-5 h-5 shrink-0" />
                            <PartnerLogo item={loc} size={32} />
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-[13px] text-[#0F172A] truncate" style={{ fontWeight: 500 }}>{highlightMatch(loc.name, dialogSearch)}</span>
                              {loc.location && <span className="text-[10px] text-[#94A3B8] hover:text-[#0A77FF] hover:underline transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.location!)}`, "_blank"); }}>{highlightMatch(loc.location, dialogSearch)}</span>}
                            </div>
                            {isLocSelected && <Check className="w-4 h-4 text-[#0A77FF] shrink-0" />}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
            {selectedId && (
              <div className="px-4 py-3 border-t border-[#F1F5F9] bg-[#FAFBFC] flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] shrink-0" />
                  <span className="text-xs text-[#334155] truncate" style={{ fontWeight: 500 }}>Selected: <span style={{ fontWeight: 600 }}>{items.find(i => i.id === selectedId)?.name || ""}</span></span>
                </div>
                <button onClick={() => { setDialogOpen(false); setDialogSearch(""); setDialogExpandedPartners(new Set()); }} className="px-3 py-1.5 rounded-lg bg-[#0A77FF] text-white text-xs hover:bg-[#0966DB] transition-colors" style={{ fontWeight: 600 }}>Done</button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      );
    };

    return (
      <div className="space-y-5">
        {/* ── Heading ── */}
        <div>
          <h4 className="text-sm text-[#0F172A]" style={{ fontWeight: 700 }}>Billing & Shipping</h4>
          <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
            Configure the currency, delivery destination, payment recipient, and funding source for all transactions with this vendor.
          </p>
        </div>

        {/* ── Visual Flow Header ── */}
        <div className="flex items-center justify-center py-5 px-2 relative" style={{ overflow: "visible" }}>
          {flowNodes.map((node, i) => {
            const partnerObj = node.dataKey === "shipTo" ? shipToObj : node.dataKey === "payTo" ? payToObj : node.dataKey === "fundedBy" ? fundedByObj : null;
            const isCurrency = node.dataKey === "currency";
            const hasData = isCurrency ? !!currencyObj : !!partnerObj;

            const renderFlowIcon = () => {
              if (isCurrency && currencyObj) {
                return <span className="text-[18px]" style={{ fontWeight: 700 }}>{currencyObj.symbol}</span>;
              }
              if (!isCurrency && partnerObj) {
                return (
                  <div
                    className="w-full h-full rounded-xl flex items-center justify-center text-white text-[12px]"
                    style={{ fontWeight: 700, backgroundColor: partnerObj.logoColor }}
                  >
                    {partnerObj.logoText}
                  </div>
                );
              }
              return node.icon;
            };

            const renderFlowHoverCard = () => {
              if (isCurrency && currencyObj) {
                const code = currencyObj.id.toUpperCase();
                const name = currencyObj.label.split(" — ")[1] || currencyObj.label;
                return (
                  <div className="w-[200px] bg-white rounded-xl border border-[#E8ECF1] shadow-lg p-3">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#0A77FF] text-[18px]" style={{ fontWeight: 700 }}>
                        {currencyObj.symbol}
                      </div>
                      <div>
                        <p className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>{code}</p>
                        <p className="text-[11px] text-[#64748B]">{name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#EFF6FF] rounded-md">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#0A77FF]" />
                      <span className="text-[10px] text-[#0A77FF]" style={{ fontWeight: 500 }}>Active transaction currency</span>
                    </div>
                  </div>
                );
              }
              if (!isCurrency && partnerObj) {
                const typeLabel = partnerObj.type === "location" ? "Location" : "Partner";
                const roleLabel = node.dataKey === "shipTo" ? "Delivery Address" : node.dataKey === "payTo" ? "Payment Recipient" : "Funding Source";
                return (
                  <div className="w-[260px] bg-white rounded-xl border border-[#E8ECF1] shadow-lg p-3">
                    <div className="flex items-start gap-2.5 mb-2.5">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[13px] shrink-0"
                        style={{ fontWeight: 700, backgroundColor: partnerObj.logoColor }}
                      >
                        {partnerObj.logoText}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>{partnerObj.name}</p>
                        {partnerObj.location && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(partnerObj.location)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-1 mt-1 text-[10px] text-[#64748B] hover:text-[#0A77FF] hover:underline leading-relaxed transition-colors"
                          >
                            <MapPin className="w-3 h-3 shrink-0 mt-0.5 text-[#94A3B8]" />
                            <span className="break-words">{partnerObj.location}</span>
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ backgroundColor: node.bgActive }}>
                      <span className="text-[10px]" style={{ fontWeight: 500, color: node.color }}>{roleLabel}</span>
                    </div>
                    {partnerObj.isDefault && (
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-[#F1F5F9]">
                        <Star className="w-3 h-3 text-[#F59E0B]" />
                        <span className="text-[10px] text-[#64748B]" style={{ fontWeight: 500 }}>Primary selection</span>
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            };

            return (
              <div key={node.label} className="flex items-center">
                {hasData ? (
                  <HoverCard openDelay={200} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <div className="relative flex flex-col items-center gap-1.5 cursor-pointer">
                        <div
                          className="w-[46px] h-[46px] rounded-xl flex items-center justify-center transition-all duration-200 overflow-hidden"
                          style={{
                            backgroundColor: node.active ? (isCurrency || !partnerObj ? node.bgActive : "transparent") : "#F8FAFC",
                            border: `1.5px solid ${node.active ? node.color + "30" : "#E8ECF1"}`,
                            color: node.active ? node.color : "#B0B8C4",
                          }}
                        >
                          {renderFlowIcon()}
                        </div>
                        {node.sublabel ? (
                          <span className="text-[10px] text-[#0F172A] max-w-[80px] truncate text-center" style={{ fontWeight: 600 }}>
                            {node.sublabel}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#94A3B8] max-w-[80px] truncate text-center" style={{ fontWeight: 500 }}>
                            {node.label}
                          </span>
                        )}
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent
                      side="bottom"
                      sideOffset={8}
                      align="center"
                      className="w-auto p-0 border-none bg-transparent shadow-none z-[300]"
                    >
                      {renderFlowHoverCard()}
                    </HoverCardContent>
                  </HoverCard>
                ) : (
                  <div className="relative flex flex-col items-center gap-1.5">
                    <div
                      className="w-[46px] h-[46px] rounded-xl flex items-center justify-center transition-all duration-200 overflow-hidden"
                      style={{
                        backgroundColor: "#F8FAFC",
                        border: `1.5px solid #E8ECF1`,
                        color: "#B0B8C4",
                      }}
                    >
                      {renderFlowIcon()}
                    </div>
                    <span className="text-[10px] text-[#94A3B8] max-w-[80px] truncate text-center" style={{ fontWeight: 500 }}>
                      {node.label}
                    </span>
                  </div>
                )}
                {i < flowNodes.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-[#CBD5E1] mx-3 sm:mx-5 shrink-0 -mt-4" />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Configuration Cards – 2×2 equal grid ── */}
        {(() => {
          const currObj = CURRENCY_OPTIONS.find((c) => c.id === currency);
          const stObj = PARTNER_LOCATION_ITEMS.find((i) => i.id === shipTo);
          const ptObj = PARTNER_LOCATION_ITEMS.find((i) => i.id === payTo);
          const fbObj = FUNDED_BY_ITEMS.find((i) => i.id === fundedBy);

          const currencyFiltered = CURRENCY_OPTIONS.filter((c) =>
            !currencyPopoverSearch.trim() || c.label.toLowerCase().includes(currencyPopoverSearch.toLowerCase())
          );

          const fieldCardBase = "group relative rounded-xl border border-[#E8ECF1] bg-white hover:border-[#CBD5E1] hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] transition-all duration-200 cursor-pointer";
          const disabledCardBase = "relative rounded-xl border border-dashed border-[#E2E8F0] bg-[#FAFBFC] transition-all duration-200";

          return (
            <div className="grid grid-cols-2 gap-2.5">
              {/* 1. Currency */}
              <Popover onOpenChange={(open) => { if (!open) setCurrencyPopoverSearch(""); }}>
                <PopoverTrigger asChild>
                  <div className={fieldCardBase + " p-3 flex flex-col gap-2.5"}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-[#94A3B8]" />
                        <span className="text-[11px] text-[#64748B]" style={{ fontWeight: 500 }}>Currency</span>
                        <InfoTooltip>The currency used for all transactions with this vendor, including purchase orders, invoices, and payments.</InfoTooltip>
                      </div>
                      <Pencil className="w-3 h-3 text-[#CBD5E1] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {currObj ? (
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] border border-[#0A77FF]/10 flex items-center justify-center shrink-0">
                          <span className="text-[16px] text-[#0A77FF]" style={{ fontWeight: 700 }}>{currObj.symbol}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}>{currObj.id.toUpperCase()}</p>
                          <p className="text-[11px] text-[#64748B] truncate">{(currObj.label.split(" — ")[1] || currObj.label)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-[#F8FAFC] border border-dashed border-[#CBD5E1] flex items-center justify-center shrink-0">
                          <DollarSign className="w-4 h-4 text-[#CBD5E1]" />
                        </div>
                        <p className="text-[12px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Select currency</p>
                      </div>
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 rounded-xl border border-[#E2E8F0] shadow-lg z-[250]" align="start" sideOffset={4}>
                  <div className="p-3 shrink-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                      <input
                        value={currencyPopoverSearch}
                        onChange={(e) => setCurrencyPopoverSearch(e.target.value)}
                        placeholder="Search currency..."
                        className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0A77FF] focus:ring-2 focus:ring-[#0A77FF]/10"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="border-t border-[#F1F5F9]" style={{ maxHeight: 280, overflowY: "auto" }}>
                    {currencyFiltered.length === 0 ? (
                      <div className="py-6 text-center text-xs text-[#94A3B8]">No results found</div>
                    ) : (
                      currencyFiltered.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setCurrency(c.id)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#F8FAFC] ${currency === c.id ? "bg-[#EDF4FF]/50" : ""}`}
                        >
                          <span className="text-base shrink-0">{(c as any).flag || ""}</span>
                          <span className="w-7 text-center text-[12px] text-[#64748B] shrink-0" style={{ fontWeight: 600 }}>{c.symbol}</span>
                          <span className="text-sm text-[#0F172A] truncate" style={{ fontWeight: 500 }}>{c.label}</span>
                          {currency === c.id && <Check className="w-4 h-4 text-[#0A77FF] ml-auto shrink-0" />}
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* 2. Pay To */}
              <div
                className={fieldCardBase + " p-3 flex flex-col gap-2.5"}
                onClick={() => setPayToDialogOpen(true)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-[#94A3B8]" />
                    <span className="text-[11px] text-[#64748B]" style={{ fontWeight: 500 }}>Pay To</span>
                    <InfoTooltip>The entity that receives payment for this vendor's transactions. Defaults to this vendor. Change this if payments go to a different party, such as a parent company or billing agent.</InfoTooltip>
                  </div>
                  <Pencil className="w-3 h-3 text-[#CBD5E1] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {ptObj ? (
                  <div className="flex items-center gap-2.5">
                    <PartnerLogo item={ptObj} size={36} />
                    <p className="text-[13px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}>{ptObj.name}</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-[#F8FAFC] border border-dashed border-[#CBD5E1] flex items-center justify-center shrink-0">
                      <Receipt className="w-4 h-4 text-[#CBD5E1]" />
                    </div>
                    <p className="text-[12px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Select recipient</p>
                  </div>
                )}
              </div>

              {/* 3. Ship To */}
              <div
                className={fieldCardBase + " p-3 flex flex-col gap-2"}
                onClick={() => setShipToDialogOpen(true)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#94A3B8]" />
                    <span className="text-[11px] text-[#64748B]" style={{ fontWeight: 500 }}>Ship To</span>
                    <InfoTooltip>The default delivery destination for goods ordered from this vendor. Defaults to your company. Change this if items are regularly shipped to a different location.</InfoTooltip>
                  </div>
                  <Pencil className="w-3 h-3 text-[#CBD5E1] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {stObj ? (
                  <div className="flex items-start gap-2.5">
                    <PartnerLogo item={stObj} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>{stObj.name}</p>
                      {stObj.location && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stObj.location)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] text-[#64748B] hover:text-[#0A77FF] hover:underline flex items-start gap-1 mt-1 leading-snug transition-colors"
                        >
                          <MapPin className="w-3 h-3 shrink-0 text-[#94A3B8] mt-[2px]" />
                          <span className="break-words">{stObj.location}</span>
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-[#F8FAFC] border border-dashed border-[#CBD5E1] flex items-center justify-center shrink-0">
                      <Truck className="w-4 h-4 text-[#CBD5E1]" />
                    </div>
                    <p className="text-[12px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Select destination</p>
                  </div>
                )}
              </div>

              {/* 4. Funded By */}
              <div className={`${allowAltFunding ? fieldCardBase : disabledCardBase} p-3 flex flex-col`} onClick={allowAltFunding ? () => setFundedByDialogOpen(true) : undefined}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Landmark className={`w-3.5 h-3.5 ${allowAltFunding ? "text-[#94A3B8]" : "text-[#CBD5E1]"}`} />
                    <span className={`text-[11px] ${allowAltFunding ? "text-[#64748B]" : "text-[#94A3B8]"}`} style={{ fontWeight: 500 }}>Funded By</span>
                    <InfoTooltip>The entity that funds purchases from this vendor. Defaults to your company. Change this only if another entity — such as a parent company or partner — is responsible for financing these transactions.</InfoTooltip>
                  </div>
                  <Pencil className={`w-3 h-3 text-[#CBD5E1] opacity-0 ${allowAltFunding ? "group-hover:opacity-100" : ""} transition-opacity`} />
                </div>
                {/* Selection */}
                <div className={`mt-2 ${allowAltFunding ? "" : "opacity-30"}`}>
                  {fbObj ? (
                    <div className="flex items-center gap-2.5">
                      <PartnerLogo item={fbObj} size={36} />
                      <p className={`text-[13px] truncate ${allowAltFunding ? "text-[#0F172A]" : "text-[#94A3B8]"}`} style={{ fontWeight: 600 }}>{fbObj.name}</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-[#F8FAFC] border border-dashed border-[#CBD5E1] flex items-center justify-center shrink-0">
                        <Landmark className="w-4 h-4 text-[#CBD5E1]" />
                      </div>
                      <p className="text-[12px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Select funding source</p>
                    </div>
                  )}
                </div>
                {/* Toggle at bottom */}
                <div className="flex items-center gap-2 mt-auto pt-2.5 mt-2.5 border-t border-[#F1F5F9]" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={allowAltFunding}
                    onCheckedChange={(val) => { setAllowAltFunding(val); if (!val) setFundedBy("pl-7"); }}
                  />
                  <span className={`text-[11px] ${allowAltFunding ? "text-[#64748B]" : "text-[#94A3B8]"}`} style={{ fontWeight: 500 }}>Allow Alternative Funding Source</span>
                </div>
              </div>

              {/* ── Ship To Dialog ── */}
              {renderPartnerSelectionDialog(
                shipToDialogOpen, setShipToDialogOpen,
                shipToSearch, setShipToSearch,
                PARTNER_LOCATION_ITEMS, shipTo, (id) => setShipTo(id),
                { icon: <Truck className="w-4 h-4 text-[#22C55E]" />, iconBg: "#ECFDF5", iconColor: "#22C55E", title: "Select Ship To", description: "Choose delivery destination" }
              )}

              {/* ── Pay To Dialog ── */}
              {renderPartnerSelectionDialog(
                payToDialogOpen, setPayToDialogOpen,
                payToDialogSearch, setPayToDialogSearch,
                PARTNER_LOCATION_ITEMS, payTo, (id) => setPayTo(id),
                { icon: <Receipt className="w-4 h-4 text-[#8B5CF6]" />, iconBg: "#F5F3FF", iconColor: "#8B5CF6", title: "Select Pay To", description: "Choose payment recipient" }
              )}

              {/* ── Funded By Dialog ── */}
              {renderPartnerSelectionDialog(
                fundedByDialogOpen, setFundedByDialogOpen,
                fundedByDialogSearch, setFundedByDialogSearch,
                FUNDED_BY_ITEMS, fundedBy, (id) => setFundedBy(id),
                { icon: <Landmark className="w-4 h-4 text-[#F59E0B]" />, iconBg: "#FFFBEB", iconColor: "#F59E0B", title: "Select Funded By", description: "Choose funding source" }
              )}
            </div>
          );
        })()}
      </div>
    );
  }

  if (sectionId === "payment_methods" || sectionId === "customer_payment") {
    return (
      <PaymentMethodsSection
        configType={configType}
        paymentEntries={paymentEntries}
        setPaymentEntries={setPaymentEntries}
        savedPaymentEntries={savedPaymentEntries}
        updatePaymentEntry={updatePaymentEntry}
        savePaymentEntry={savePaymentEntry}
        removePaymentEntry={removePaymentEntry}
        country={selectedGroup?.country}
      />
    );
  }

  /* Legacy payment methods code removed – now using PaymentMethodsSection component */
  if (false as const) { void(0); }
  if (false as const) {const typeLabel = (type: PaymentMethodType) => PAYMENT_TYPE_CARDS.find((t) => t.id === type)?.label || type;
    const typeIcon = (type: PaymentMethodType) => PAYMENT_TYPE_CARDS.find((t) => t.id === type)?.icon || CreditCard;
    const typeCategory = (type: PaymentMethodType) => PAYMENT_TYPE_CARDS.find((t) => t.id === type)?.category || "Other";
    const entry = activePaymentEntry;

    // Helper to render form fields for an entry
    const renderFormFields = (e: PaymentMethodEntry) => (
      <>
        {/* ACH / Wire Transfer fields */}
        {(e.type === "wire" || e.type === "ach") && (
          <>
            <div>
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Bank Name *</Label>
              <Input value={e.bankName} onChange={(ev) => updatePaymentEntry(e.id, { bankName: ev.target.value })} placeholder="e.g. Chase Bank" className="mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
            </div>
            <div>
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Account Title *</Label>
              <Input value={e.accountTitle} onChange={(ev) => updatePaymentEntry(e.id, { accountTitle: ev.target.value })} placeholder="Enter account holder name" className="mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
            </div>
            <div>
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>{e.type === "wire" ? "Account Number/IBAN *" : "Account Number *"}</Label>
              <Input value={e.accountNumber} onChange={(ev) => updatePaymentEntry(e.id, { accountNumber: ev.target.value })} placeholder={e.type === "wire" ? "Enter account number/IBAN" : "••••••••1234"} className="mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
            </div>
            {e.type === "ach" && (
              <div>
                <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Routing Number *</Label>
                <Input value={e.routingNumber} onChange={(ev) => updatePaymentEntry(e.id, { routingNumber: ev.target.value })} placeholder="e.g. 021000021" className="mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
              </div>
            )}
            {e.type === "wire" && (
              <div>
                <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Swift Code *</Label>
                <Input value={e.swiftCode} onChange={(ev) => updatePaymentEntry(e.id, { swiftCode: ev.target.value })} placeholder="Enter swift code" className="mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
              </div>
            )}
            <div>
              <PhoneFieldWithCountry e={e} updateEntry={(id, updates) => updatePaymentEntry(id, updates)} defaultFormat={DEFAULT_FORMAT} />
            </div>
            <div>
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Special Instructions</Label>
              <Input value={e.specialInstructions} onChange={(ev) => updatePaymentEntry(e.id, { specialInstructions: ev.target.value })} placeholder="Enter any special instructions or notes..." className="mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
            </div>
          </>
        )}

        {/* Check fields */}
        {e.type === "check" && (
          <>
            <div>
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Payee Name *</Label>
              <Input value={e.payeeName} onChange={(ev) => updatePaymentEntry(e.id, { payeeName: ev.target.value })} placeholder="Enter payee name" className="mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
            </div>
            <div>
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Check Mailing Address *</Label>
              <Input value={e.mailingAddress} onChange={(ev) => updatePaymentEntry(e.id, { mailingAddress: ev.target.value })} placeholder="Enter mailing address" className="mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
            </div>
            <div>
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Bank Name</Label>
              <Input value={e.bankName} onChange={(ev) => updatePaymentEntry(e.id, { bankName: ev.target.value })} placeholder="e.g. Chase Bank" className="mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
            </div>
            <div>
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Account Number *</Label>
              <Input value={e.accountNumber} onChange={(ev) => updatePaymentEntry(e.id, { accountNumber: ev.target.value })} placeholder="••••••••1234" className="mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
            </div>
          </>
        )}

        {/* Credit/Debit Card fields */}
        {e.type === "card" && (
          <>
            <div>
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Cardholder Name *</Label>
              <Input value={e.cardholderName} onChange={(ev) => updatePaymentEntry(e.id, { cardholderName: ev.target.value })} placeholder="Enter cardholder name" className="mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
            </div>
            <div>
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Card Number *</Label>
              <Input value={e.cardNumber} onChange={(ev) => updatePaymentEntry(e.id, { cardNumber: ev.target.value })} placeholder="Enter card number" className="mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
            </div>
            <div>
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Expiry Date *</Label>
              <Input value={e.expiryDate} onChange={(ev) => updatePaymentEntry(e.id, { expiryDate: ev.target.value })} placeholder="MM/YY" className="mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
            </div>
            <div>
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>CVV *</Label>
              <Input value={e.cvv} onChange={(ev) => updatePaymentEntry(e.id, { cvv: ev.target.value })} placeholder="Enter CVV" className="mt-1.5 rounded-lg border-[#E2E8F0] h-10 bg-white max-w-[140px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
            </div>
            <div>
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Billing Address</Label>
              <Input value={e.billingAddress} onChange={(ev) => updatePaymentEntry(e.id, { billingAddress: ev.target.value })} placeholder="Enter billing address" className="mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
            </div>
          </>
        )}

        {/* Digital Wallet fields */}
        {e.type === "digital_wallet" && (
          <>
            <div>
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Wallet Provider *</Label>
              <Input value={e.walletProvider} onChange={(ev) => updatePaymentEntry(e.id, { walletProvider: ev.target.value })} placeholder="e.g. PayPal, Venmo, Stripe" className="mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
            </div>
            <div>
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Wallet ID/Email *</Label>
              <Input value={e.walletId} onChange={(ev) => updatePaymentEntry(e.id, { walletId: ev.target.value })} placeholder="Enter wallet ID or email" className="mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
            </div>
            <div>
              <PhoneFieldWithCountry e={e} updateEntry={(id, updates) => updatePaymentEntry(id, updates)} defaultFormat={DEFAULT_FORMAT} />
            </div>
          </>
        )}

        {/* Cash fields */}
        {e.type === "cash" && (
          <>
            <div>
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Recipient Name *</Label>
              <Input value={e.recipientName} onChange={(ev) => updatePaymentEntry(e.id, { recipientName: ev.target.value })} placeholder="Enter recipient name" className="mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
            </div>
            <div>
              <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Collection Point *</Label>
              <Input value={e.collectionPoint} onChange={(ev) => updatePaymentEntry(e.id, { collectionPoint: ev.target.value })} placeholder="Enter collection point or location" className="mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
            </div>
            <div>
              <PhoneFieldWithCountry e={e} updateEntry={(id, updates) => updatePaymentEntry(id, updates)} defaultFormat={DEFAULT_FORMAT} />
            </div>
          </>
        )}

        {/* Special Instructions (for types that don't already show it) */}
        {(e.type === "card" || e.type === "digital_wallet" || e.type === "cash") && (
          <div>
            <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Special Instructions</Label>
            <Input value={e.specialInstructions} onChange={(ev) => updatePaymentEntry(e.id, { specialInstructions: ev.target.value })} placeholder="Enter any special instructions or notes..." className="mt-1.5 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
          </div>
        )}

        {/* Discount / Additional Charges checkbox */}
        <div className="pt-1 border-t border-[#E2E8F0]">
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none pt-3 group/disc"
            onClick={() => updatePaymentEntry(e.id, { applyDiscount: !e.applyDiscount })}
          >
            <div
              className={`w-[16px] h-[16px] rounded-[4px] flex items-center justify-center shrink-0 transition-colors ${
                e.applyDiscount ? "bg-[#0A77FF]" : "border-[1.5px] border-[#CBD5E1] bg-white group-hover/disc:border-[#94A3B8]"
              }`}
            >
              {e.applyDiscount && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
            </div>
            <span className="text-xs text-[#334155]" style={{ fontWeight: 500 }}>Apply Discount Terms or Additional Charges</span>
          </div>
        </div>

        {/* Discount fields */}
        {e.applyDiscount && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Discount</Label>
                <div className="inline-flex items-center h-[22px] rounded-full bg-[#F1F5F9] p-0.5">
                  <button
                    type="button"
                    onClick={() => updatePaymentEntry(e.id, { discountMode: "percent" })}
                    className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${(e.discountMode ?? "percent") === "percent" ? "bg-white text-[#0A77FF] shadow-sm" : "text-[#64748B] hover:text-[#334155]"}`}
                    style={{ fontWeight: 600 }}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePaymentEntry(e.id, { discountMode: "fixed" })}
                    className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${(e.discountMode ?? "percent") === "fixed" ? "bg-white text-[#0A77FF] shadow-sm" : "text-[#64748B] hover:text-[#334155]"}`}
                    style={{ fontWeight: 600 }}
                  >
                    $
                  </button>
                </div>
              </div>
              <div className="relative mt-1.5">
                {(e.discountMode ?? "percent") === "fixed" && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">$</span>
                )}
                <Input value={e.discountPercent} onChange={(ev) => updatePaymentEntry(e.id, { discountPercent: ev.target.value })} placeholder={`e.g. ${(e.discountMode ?? "percent") === "percent" ? "5" : "25.00"}`} className={`rounded-lg border-[#E2E8F0] h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20 ${(e.discountMode ?? "percent") === "fixed" ? "pl-7 pr-3" : "pr-8"}`} />
                {(e.discountMode ?? "percent") === "percent" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">%</span>
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>Add. Charges</Label>
                <div className="inline-flex items-center h-[22px] rounded-full bg-[#F1F5F9] p-0.5">
                  <button
                    type="button"
                    onClick={() => updatePaymentEntry(e.id, { additionalChargesMode: "percent" })}
                    className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${(e.additionalChargesMode ?? "percent") === "percent" ? "bg-white text-[#0A77FF] shadow-sm" : "text-[#64748B] hover:text-[#334155]"}`}
                    style={{ fontWeight: 600 }}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePaymentEntry(e.id, { additionalChargesMode: "fixed" })}
                    className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${(e.additionalChargesMode ?? "percent") === "fixed" ? "bg-white text-[#0A77FF] shadow-sm" : "text-[#64748B] hover:text-[#334155]"}`}
                    style={{ fontWeight: 600 }}
                  >
                    $
                  </button>
                </div>
              </div>
              <div className="relative mt-1.5">
                {(e.additionalChargesMode ?? "percent") === "fixed" && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">$</span>
                )}
                <Input value={e.additionalCharges} onChange={(ev) => updatePaymentEntry(e.id, { additionalCharges: ev.target.value })} placeholder={`e.g. ${(e.additionalChargesMode ?? "percent") === "percent" ? "2" : "50.00"}`} className={`rounded-lg border-[#E2E8F0] h-10 bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20 ${(e.additionalChargesMode ?? "percent") === "fixed" ? "pl-7 pr-3" : "pr-8"}`} />
                {(e.additionalChargesMode ?? "percent") === "percent" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">%</span>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );

    return (
      <div className="space-y-3">
        {/* ── Heading + Helper Copy ── */}
        <div className="mb-1">
          <h4 className="text-sm text-[#0F172A]" style={{ fontWeight: 700 }}>Payment Methods</h4>
          <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
            Add one or more payment methods for this vendor — such as bank transfer, credit card, or digital wallet. These will be available when processing payments.{" "}
            <span className="text-[#0A77FF] inline-flex items-center gap-0.5 cursor-pointer hover:underline" style={{ fontWeight: 500 }}>
              Learn More <ExternalLink className="w-3 h-3" />
            </span>
          </p>
        </div>

        {/* ── Two Column Layout ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* ���─ Left Column: Payment Type Cards ── */}
          <div className="rounded-lg border border-[#E8ECF1] bg-white p-3 space-y-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h5 className="text-xs text-[#64748B]" style={{ fontWeight: 600 }}>Select payment type</h5>

            {/* 6 Payment type interactive cards */}
            <div className="space-y-2">
              {PAYMENT_TYPE_CARDS.map((t) => {
                const Icon = t.icon;
                const isSelected = selectedPaymentType === t.id;
                const count = savedPaymentEntries.filter((pe) => pe.type === t.id).length;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedPaymentType(t.id);
                      // If not editing, show the first saved entry of this type or clear
                      if (!isEditingPayment) {
                        const firstOfType = savedPaymentEntries.find((pe) => pe.type === t.id);
                        setActivePaymentId(firstOfType?.id || null);
                      }
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                      isSelected
                        ? "bg-white border-[1.5px] border-[#0A77FF] shadow-[0_1px_4px_rgba(10,119,255,0.1)]"
                        : "bg-white border border-[#E8ECF1] hover:border-[#CBD5E1]"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${isSelected ? "bg-[#EDF4FF]" : "bg-[#F8FAFC]"}`}>
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-[#0A77FF]" : "text-[#64748B]"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] truncate ${isSelected ? "text-[#0A77FF]" : "text-[#0F172A]"}`} style={{ fontWeight: 600 }}>{t.label}</p>
                      <p className="text-[11px] text-[#94A3B8] truncate">{t.description}</p>
                    </div>
                    {count > 0 && (
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] shrink-0 ${
                        isSelected ? "bg-[#0A77FF] text-white" : "bg-[#F1F5F9] text-[#64748B]"
                      }`} style={{ fontWeight: 700 }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Saved methods for selected type */}
            {savedPaymentEntries.filter((pe) => pe.type === selectedPaymentType).length > 0 && (
              <div>
                <p className="text-[11px] text-[#64748B] mb-2" style={{ fontWeight: 600 }}>Saved — {typeLabel(selectedPaymentType)}</p>
                <div className="space-y-1.5">
                  {savedPaymentEntries
                    .filter((pe) => pe.type === selectedPaymentType)
                    .map((pe, idx) => {
                      const PeIcon = typeIcon(pe.type);
                      const isActive = pe.id === activePaymentId;
                      return (
                        <button
                          key={pe.id}
                          onClick={() => { setActivePaymentId(pe.id); setIsEditingPayment(false); }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                            isActive && !isEditingPayment
                              ? "bg-[#EDF4FF] border border-[#0A77FF]/30 shadow-[0_1px_4px_rgba(10,119,255,0.08)]"
                              : "bg-white border border-[#E8ECF1] hover:bg-[#F8FAFC]"
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${isActive && !isEditingPayment ? "bg-[#0A77FF]/10" : "bg-[#F1F5F9]"}`}>
                            <PeIcon className={`w-3.5 h-3.5 ${isActive && !isEditingPayment ? "text-[#0A77FF]" : "text-[#64748B]"}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className={`text-[12px] block truncate ${isActive && !isEditingPayment ? "text-[#0A77FF]" : "text-[#0F172A]"}`} style={{ fontWeight: 600 }}>
                              #{idx + 1} {pe.bankName || pe.payeeName || pe.cardholderName || pe.walletProvider || pe.recipientName || typeLabel(pe.type)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={(ev) => { ev.stopPropagation(); editPaymentEntry(pe.id); }}
                              className="p-1 rounded hover:bg-[#EDF4FF] transition-colors"
                            >
                              <Pencil className="w-3 h-3 text-[#94A3B8] hover:text-[#0A77FF]" />
                            </button>
                            <button
                              onClick={(ev) => { ev.stopPropagation(); removePaymentEntry(pe.id); }}
                              className="p-1 rounded hover:bg-[#FEF2F2] transition-colors"
                            >
                              <Trash2 className="w-3 h-3 text-[#94A3B8] hover:text-[#EF4444]" />
                            </button>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* ── Right Column: Details / Form ── */}
          <div className="rounded-lg border border-[#E8ECF1] bg-white p-3 space-y-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            {/* Editing / Adding new form */}
            {isEditingPayment && entry ? (
              <>
                <div className="flex items-center justify-between">
                  <h5 className="text-[13px] text-[#64748B]" style={{ fontWeight: 600 }}>
                    {entry.isSaved ? "Edit" : "New"} {typeLabel(entry.type)}
                  </h5>
                  <button onClick={cancelPaymentEdit} className="text-xs text-[#64748B] hover:text-[#0F172A]" style={{ fontWeight: 500 }}>Cancel</button>
                </div>
                {renderFormFields(entry)}

                {/* Save / Update CTA */}
                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => savePaymentEntry(entry.id)}
                    className="px-3.5 py-2 rounded-lg bg-[#0A77FF] text-white text-xs hover:bg-[#0960D0] transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    {entry.isSaved ? "Update" : "Save"}
                  </button>
                  <button
                    onClick={cancelPaymentEdit}
                    className="px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-xs text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : entry && entry.isSaved ? (
              /* Viewing a saved entry (read-only look) */
              <>
                <div className="flex items-center justify-between">
                  <h5 className="text-[13px] text-[#64748B]" style={{ fontWeight: 600 }}>
                    {typeLabel(entry.type)} details
                  </h5>
                  <button
                    onClick={() => editPaymentEntry(entry.id)}
                    className="flex items-center gap-1 text-[#0A77FF] text-xs hover:underline"
                    style={{ fontWeight: 600 }}
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                </div>

                {/* Summary fields */}
                <div className="space-y-3">
                  {(entry.type === "wire" || entry.type === "ach") && (
                    <>
                      {entry.bankName && <div><p className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Bank Name</p><p className="text-[13px] text-[#0F172A] mt-0.5" style={{ fontWeight: 500 }}>{entry.bankName}</p></div>}
                      {entry.accountTitle && <div><p className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Account Title</p><p className="text-[13px] text-[#0F172A] mt-0.5" style={{ fontWeight: 500 }}>{entry.accountTitle}</p></div>}
                      {entry.accountNumber && <div><p className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>{entry.type === "wire" ? "Account Number/IBAN" : "Account Number"}</p><p className="text-[13px] text-[#0F172A] mt-0.5" style={{ fontWeight: 500 }}>•��••{entry.accountNumber.slice(-4)}</p></div>}
                      {entry.type === "ach" && entry.routingNumber && <div><p className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Routing Number</p><p className="text-[13px] text-[#0F172A] mt-0.5" style={{ fontWeight: 500 }}>{entry.routingNumber}</p></div>}
                      {entry.type === "wire" && entry.swiftCode && <div><p className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Swift Code</p><p className="text-[13px] text-[#0F172A] mt-0.5" style={{ fontWeight: 500 }}>{entry.swiftCode}</p></div>}
                    </>
                  )}
                  {entry.type === "check" && (
                    <>
                      {entry.payeeName && <div><p className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Payee Name</p><p className="text-[13px] text-[#0F172A] mt-0.5" style={{ fontWeight: 500 }}>{entry.payeeName}</p></div>}
                      {entry.mailingAddress && <div><p className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Mailing Address</p><p className="text-[13px] text-[#0F172A] mt-0.5" style={{ fontWeight: 500 }}>{entry.mailingAddress}</p></div>}
                      {entry.accountNumber && <div><p className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Account Number</p><p className="text-[13px] text-[#0F172A] mt-0.5" style={{ fontWeight: 500 }}>••••{entry.accountNumber.slice(-4)}</p></div>}
                    </>
                  )}
                  {entry.type === "card" && (
                    <>
                      {entry.cardholderName && <div><p className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Cardholder</p><p className="text-[13px] text-[#0F172A] mt-0.5" style={{ fontWeight: 500 }}>{entry.cardholderName}</p></div>}
                      {entry.cardNumber && <div><p className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Card Number</p><p className="text-[13px] text-[#0F172A] mt-0.5" style={{ fontWeight: 500 }}>••••{entry.cardNumber.slice(-4)}</p></div>}
                      {entry.expiryDate && <div><p className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Expiry</p><p className="text-[13px] text-[#0F172A] mt-0.5" style={{ fontWeight: 500 }}>{entry.expiryDate}</p></div>}
                    </>
                  )}
                  {entry.type === "digital_wallet" && (
                    <>
                      {entry.walletProvider && <div><p className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Provider</p><p className="text-[13px] text-[#0F172A] mt-0.5" style={{ fontWeight: 500 }}>{entry.walletProvider}</p></div>}
                      {entry.walletId && <div><p className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Wallet ID/Email</p><p className="text-[13px] text-[#0F172A] mt-0.5" style={{ fontWeight: 500 }}>{entry.walletId}</p></div>}
                    </>
                  )}
                  {entry.type === "cash" && (
                    <>
                      {entry.recipientName && <div><p className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Recipient</p><p className="text-[13px] text-[#0F172A] mt-0.5" style={{ fontWeight: 500 }}>{entry.recipientName}</p></div>}
                      {entry.collectionPoint && <div><p className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Collection Point</p><p className="text-[13px] text-[#0F172A] mt-0.5" style={{ fontWeight: 500 }}>{entry.collectionPoint}</p></div>}
                    </>
                  )}
                  {entry.phone && <div><p className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Phone</p><p className="text-[13px] text-[#0F172A] mt-0.5" style={{ fontWeight: 500 }}>{entry.countryCode} {entry.phone}</p></div>}
                  {entry.applyDiscount && (
                    <div className="flex gap-4">
                      {entry.discountPercent && <div><p className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Discount</p><p className="text-[13px] text-[#0F172A] mt-0.5" style={{ fontWeight: 500 }}>{(entry.discountMode ?? "percent") === "fixed" ? "$" : ""}{entry.discountPercent}{(entry.discountMode ?? "percent") === "percent" ? "%" : ""}</p></div>}
                      {entry.additionalCharges && <div><p className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>Add. Charges</p><p className="text-[13px] text-[#0F172A] mt-0.5" style={{ fontWeight: 500 }}>{(entry.additionalChargesMode ?? "percent") === "fixed" ? "$" : ""}{entry.additionalCharges}{(entry.additionalChargesMode ?? "percent") === "percent" ? "%" : ""}</p></div>}
                    </div>
                  )}
                </div>

                {/* Add another */}
                <div className="pt-2 border-t border-[#E2E8F0]">
                  <button
                    onClick={() => addPaymentEntry(selectedPaymentType)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#EDF4FF] text-[#0A77FF] text-xs hover:bg-[#DBEAFE] transition-colors border border-[#DBEAFE]"
                    style={{ fontWeight: 600 }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Method
                  </button>
                </div>
              </>
            ) : (
              /* Empty state */
              <>
                <h5 className="text-xs text-[#64748B]" style={{ fontWeight: 600 }}>Payment details</h5>
                <div className="flex flex-col items-center justify-center py-5 text-center">
                  <div className="w-10 h-10 rounded-lg bg-[#F8FAFC] border border-[#E8ECF1] flex items-center justify-center mb-2">
                    <CreditCard className="w-5 h-5 text-[#94A3B8]" />
                  </div>
                  <p className="text-xs text-[#64748B]" style={{ fontWeight: 500 }}>No payment method added yet</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5 max-w-[220px]">Select a type on the left, then add details.</p>
                  <button
                    onClick={() => addPaymentEntry(selectedPaymentType)}
                    className="mt-3 px-3.5 py-2 rounded-lg bg-[#EDF4FF] text-[#0A77FF] text-xs hover:bg-[#DBEAFE] transition-colors flex items-center gap-1.5 border border-[#DBEAFE]"
                    style={{ fontWeight: 600 }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Method
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (sectionId === "credit_limit" || sectionId === "customer_credit") {
    const currencySymbol = currency === "eur" ? "€" : currency === "gbp" ? "£" : currency === "jpy" ? "¥" : "$";
    const currencyLabel = currency === "eur" ? "EUR" : currency === "gbp" ? "GBP" : currency === "jpy" ? "JPY" : "USD";

    return (
      <div className="space-y-4">
        {/* Section header */}
        <div>
          <h4 className="text-sm text-foreground" style={{ fontWeight: 700 }}>Credit Limit</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Set the maximum outstanding balance allowed with this vendor and choose how the system responds when that limit is reached.
          </p>
        </div>

        {/* ── Currency & Limit Row ── */}
        <div className="rounded-xl border border-border bg-card shadow-sm p-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Currency — reuse same dropdown as billing/shipping */}
            <div>
              <CurrencyDropdown selectedId={currency} onSelect={setCurrency} />
              <p className="text-[10px] text-muted-foreground mt-1">Synced from billing</p>
            </div>
            {/* Maximum Credit Limit */}
            <div>
              <Label className="text-xs text-foreground" style={{ fontWeight: 600 }}>Maximum credit limit</Label>
              <div className="relative mt-1.5">
                <div className="absolute left-0 top-0 bottom-0 w-10 rounded-l-lg bg-muted/60 border-r border-border flex items-center justify-center">
                  <span className="text-xs text-muted-foreground font-medium">{currencySymbol}</span>
                </div>
                <Input placeholder="50,000.00" className="pl-12 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm placeholder:text-[#94A3B8]" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Leave empty for unlimited credit</p>
            </div>
          </div>
        </div>

        {/* ── Enforcement Cards ── */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-foreground" style={{ fontWeight: 600 }}>Enforcement Policy</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* ── No Enforcement Card ── */}
            <button
              onClick={() => setEnforcement("none")}
              className={`text-left rounded-xl border transition-all flex flex-col overflow-hidden bg-white ${
                enforcement === "none"
                  ? "border-[#0A77FF]/30 shadow-sm"
                  : "border-[#E2E8F0] hover:border-[#0A77FF]/20 shadow-sm hover:shadow-md"
              }`}
            >
              <div className="p-3.5 flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    enforcement === "none" ? "bg-[#EDF4FF]" : "bg-[#F1F5F9]"
                  }`}>
                    <Info className={`w-4 h-4 ${enforcement === "none" ? "text-[#0A77FF]" : "text-[#94A3B8]"}`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] px-1.5 py-[1px] rounded-full bg-[#EDF4FF] text-[#0A77FF] border border-[#0A77FF]/15" style={{ fontWeight: 600 }}>Recommended</span>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      enforcement === "none" ? "border-[#0A77FF]/60" : "border-[#CBD5E1]"
                    }`}>
                      {enforcement === "none" && <div className="w-2 h-2 rounded-full bg-[#0A77FF]" />}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-[#0F172A]" style={{ fontWeight: 600 }}>No Enforcement</p>
                <p className="text-[10px] text-[#64748B] mt-0.5 leading-relaxed">No action when exceeded. A passive "Over Limit" label appears on the order as an indicator only.</p>
              </div>
            </button>

            {/* ── Soft Warning Card ── */}
            <button
              onClick={() => setEnforcement("soft_warning")}
              className={`text-left rounded-xl border transition-all flex flex-col overflow-hidden bg-white ${
                enforcement === "soft_warning"
                  ? "border-[#EAB308]/30 shadow-sm"
                  : "border-[#E2E8F0] hover:border-[#EAB308]/20 shadow-sm hover:shadow-md"
              }`}
            >
              <div className="p-3.5 flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    enforcement === "soft_warning" ? "bg-[#FEFCE8]" : "bg-[#F1F5F9]"
                  }`}>
                    <AlertTriangle className={`w-4 h-4 ${enforcement === "soft_warning" ? "text-[#CA8A04]" : "text-[#94A3B8]"}`} />
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    enforcement === "soft_warning" ? "border-[#EAB308]/60" : "border-[#CBD5E1]"
                  }`}>
                    {enforcement === "soft_warning" && <div className="w-2 h-2 rounded-full bg-[#EAB308]" />}
                  </div>
                </div>
                <p className="text-xs text-[#0F172A]" style={{ fontWeight: 600 }}>Soft Warning</p>
                <p className="text-[10px] text-[#64748B] mt-0.5 leading-relaxed">A confirmation prompt is shown before the order can proceed. The user must acknowledge to continue.</p>
              </div>
            </button>

            {/* ── Hard Block Card ── */}
            <button
              onClick={() => setEnforcement("hard_block")}
              className={`text-left rounded-xl border transition-all flex flex-col overflow-hidden bg-white ${
                enforcement === "hard_block"
                  ? "border-[#EF4444]/40 shadow-sm"
                  : "border-[#E2E8F0] hover:border-[#EF4444]/20 shadow-sm hover:shadow-md"
              }`}
            >
              <div className="p-3.5 flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    enforcement === "hard_block" ? "bg-[#FEF2F2]" : "bg-[#F1F5F9]"
                  }`}>
                    <Lock className={`w-4 h-4 ${enforcement === "hard_block" ? "text-[#EF4444]" : "text-[#94A3B8]"}`} />
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    enforcement === "hard_block" ? "border-[#EF4444]/60" : "border-[#CBD5E1]"
                  }`}>
                    {enforcement === "hard_block" && <div className="w-2 h-2 rounded-full bg-[#EF4444]" />}
                  </div>
                </div>
                <p className="text-xs text-[#0F172A]" style={{ fontWeight: 600 }}>Hard Block</p>
                <p className="text-[10px] text-[#64748B] mt-0.5 leading-relaxed">Orders cannot be placed when the limit is exceeded. Blocked until the balance is resolved.</p>
              </div>
            </button>
          </div>

          {/* ── Contextual settings for selected enforcement ── */}
          {enforcement === "hard_block" && (
            <div className="mt-3 rounded-xl border border-[#EF4444]/15 bg-white shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-[#EF4444]" />
                <span className="text-xs text-[#0F172A]" style={{ fontWeight: 600 }}>Hard Block Settings</span>
              </div>
              <SearchableUserPicker
                selectedIds={hardBlockRecipients}
                onSelectionChange={setHardBlockRecipients}
                accentColor="#EF4444"
                accentBg="#FEF2F2"
                accentBorder="#FECACA"
                accentText="#991B1B"
                label="Notify when credit limit is exceeded"
              />
            </div>
          )}

          {enforcement === "soft_warning" && (
            <div className="mt-3 rounded-xl border border-[#EAB308]/15 bg-white shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-[#CA8A04]" />
                <span className="text-xs text-[#0F172A]" style={{ fontWeight: 600 }}>Soft Warning Settings</span>
              </div>
              {/* Warning Threshold */}
              <div>
                <Label className="text-xs text-[#0F172A]" style={{ fontWeight: 600 }}>Warning threshold</Label>
                <div className="relative mt-1.5">
                  <div className="absolute left-0 top-0 bottom-0 w-10 rounded-l-lg bg-[#F8FAFC] border-r border-[#E2E8F0] flex items-center justify-center">
                    <span className="text-xs text-[#94A3B8] font-medium">%</span>
                  </div>
                  <Input placeholder="80" className="pl-12 rounded-lg border-[#E2E8F0] !h-10 bg-white text-sm placeholder:text-[#94A3B8]" />
                </div>
                <p className="text-[10px] text-[#94A3B8] mt-1">Alert triggers at this % of credit limit</p>
              </div>
              <SearchableUserPicker
                selectedIds={softWarningRecipients}
                onSelectionChange={setSoftWarningRecipients}
                accentColor="#CA8A04"
                accentBg="#FEFCE8"
                accentBorder="#FDE68A"
                accentText="#854D0E"
                label="Notify when warning threshold is reached"
              />
            </div>
          )}

          {enforcement === "none" && (
            <div className="mt-3 rounded-xl border border-[#0A77FF]/15 bg-white shadow-sm p-3.5">
              <div className="flex items-center gap-2.5">
                <Info className="w-3.5 h-3.5 text-[#0A77FF]" />
                <p className="text-xs text-[#64748B]">No action is taken when the credit limit is exceeded. An "Over Limit" label appears on the order as a passive indicator only.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-[10px] text-muted-foreground">All fields are optional. Leave empty if credit is not tracked for this {configType}.</p>
      </div>
    );
  }

  if (sectionId === "payment_terms") {
    const selectedTypeOption = CREATE_PT_TYPES.find((t) => t.id === createPtType);

    return (
      <div className="space-y-3">
        {/* ── Heading + Helper Copy ── */}
        <div className="mb-1">
          <h4 className="text-sm text-[#0F172A]" style={{ fontWeight: 700 }}>Payment Terms</h4>
          <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
            Set the default payment terms for this vendor. These will apply automatically to all associated purchase orders.{" "}
            <span className="text-[#0A77FF] inline-flex items-center gap-0.5 cursor-pointer hover:underline" style={{ fontWeight: 500 }}>
              Learn More <ExternalLink className="w-3 h-3" />
            </span>
          </p>
        </div>

        {/* ── Content: Empty state or Selected term ── */}
        {!selectedPaymentTermPreset ? (
          /* ── Empty State ── */
          <div className="rounded-lg border-2 border-dashed border-[#E2E8F0] bg-white py-6 px-4 flex flex-col items-center justify-center text-center">
            {/* Icon */}
            <div className="w-10 h-10 rounded-lg bg-[#F8FAFC] border border-[#E8ECF1] flex items-center justify-center mb-3">
              <Receipt className="w-5 h-5 text-[#94A3B8]" />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { resetCreatePtForm(); setCreatePtModalOpen(true); }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E2E8F0] bg-white text-xs text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
                style={{ fontWeight: 500 }}
              >
                <Plus className="w-3.5 h-3.5 text-[#64748B]" /> Create terms
              </button>
              <button
                onClick={() => { setPtTypeFilters("net"); setPtStatusFilter("all"); setPtSearch(""); setPaymentTermsModalOpen(true); }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] text-xs text-[#0A77FF] hover:bg-[#DBEAFE] transition-colors"
                style={{ fontWeight: 500 }}
              >
                <FileText className="w-3.5 h-3.5" /> Templates
              </button>
            </div>
          </div>
        ) : (
          /* ── Selected Payment Term Card — read-only, matches template modal style ── */
          <div className="max-w-[280px]">
            <PaymentTermCard
              term={selectedPaymentTermPreset}
              onClick={() => { setStandalonePtDetailTerm(selectedPaymentTermPreset); setStandalonePtDetailOpen(true); }}
              onRemove={() => { setSelectedPaymentTermId(null); customPaymentTermRef.current = null; }}
              showPresetBadge
            />
          </div>
        )}

        {/* ── Create New Payment Terms Modal ── */}
        <Dialog open={createPtModalOpen} onOpenChange={(open) => { setCreatePtModalOpen(open); if (!open) { resetCreatePtForm(); setCreatePtFullscreen(false); } }}>
          <DialogContent
            className="p-0 gap-0 overflow-hidden z-[210] flex flex-col transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)]"
            style={createPtFullscreen
              ? { maxWidth: "calc(100% - 1rem)", width: "calc(100% - 1rem)", height: "calc(100dvh - 1rem)", maxHeight: "calc(100dvh - 1rem)", borderRadius: 16 }
              : { maxWidth: 860, width: "92vw", height: "auto", maxHeight: "88vh", borderRadius: 16 }
            }
            hideCloseButton
          >
            <DialogTitle className="sr-only">Create New Payment Terms</DialogTitle>
            <DialogDescription className="sr-only">Fill in the form to create a new payment term.</DialogDescription>

            {/* Header — matches pricing rule creation style */}
            <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-3 sm:pb-4 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
              {/* Title row */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[15px] sm:text-[17px] text-[#0F172A]" style={{ fontWeight: 700 }}>Create New Payment Term</h2>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F1F5F9] text-[11px] text-[#64748B]" style={{ fontWeight: 500 }}>
                      <Receipt className="w-3 h-3" /> Payment Term
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5" style={{ fontWeight: 400 }}>
                    Select the structure of the payment arrangement with this vendor.
                  </p>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <button
                    onClick={() => setCreatePtFullscreen(!createPtFullscreen)}
                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    {createPtFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    {createPtFullscreen ? "Exit full" : "Full view"}
                  </button>
                  <button
                    onClick={() => { setCreatePtModalOpen(false); setCreatePtFullscreen(false); resetCreatePtForm(); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-all cursor-pointer"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-[#FAFBFC] scrollbar-hide">
              <div className="px-4 py-4 transition-all duration-300 ease-out">

                {/* Term Setup */}
                  <div className="space-y-5">
                    {/* Payment Term Type — card selector matching partner type style */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-sm text-[#0F172A]" style={{ fontWeight: 600 }}>Payment Term Type</span>
                        <Tooltip>
                          <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-[#CBD5E1] cursor-help" /></span></TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                            <p className="text-[#64748B]">Select a payment structure. Hover each card for details.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {CREATE_PT_TYPES.map((t) => {
                          const isActive = createPtType === t.id;
                          const icon = t.id === "net" ? <Clock className="w-[18px] h-[18px]" /> : t.id === "prepayment" ? <Banknote className="w-[18px] h-[18px]" /> : <ArrowUpDown className="w-[18px] h-[18px]" />;
                          const shortLabel = t.id === "net" ? "NET Terms" : t.id === "prepayment" ? "Prepayment" : "Split Payment";
                          const shortDesc = t.id === "net" ? "Pay after X days" : t.id === "prepayment" ? "Pay before delivery" : "Multiple installments";
                          const typeTooltip = t.id === "net"
                            ? { desc: "Full payment due after a set number of days from a trigger event.", example: "Net 30", exampleDesc: "— pay in full within 30 days of shipment." }
                            : t.id === "prepayment"
                            ? { desc: "Collect partial or full payment upfront before goods ship.", example: "50% Upfront", exampleDesc: "— half paid before dispatch." }
                            : { desc: "Split the total across multiple events, each with its own percentage.", example: "40/30/30", exampleDesc: "— order, shipment, delivery." };
                          const accentColor = t.id === "net" ? "#0A77FF" : t.id === "prepayment" ? "#7C3AED" : "#D97706";
                          const accentBg = t.id === "net" ? "#EFF6FF" : t.id === "prepayment" ? "#F5F3FF" : "#FFFBEB";
                          const accentBorder = t.id === "net" ? "#93C5FD" : t.id === "prepayment" ? "#C4B5FD" : "#FCD34D";
                          const activeBorderClass = t.id === "net" ? "border-[#93C5FD]/70" : t.id === "prepayment" ? "border-[#C4B5FD]/70" : "border-[#FCD34D]/70";
                          const hoverBorderClass = t.id === "net" ? "hover:border-[#BFDBFE]" : t.id === "prepayment" ? "hover:border-[#DDD6FE]" : "hover:border-[#FDE68A]";
                          const circleActiveBg = t.id === "net" ? "#3B82F6" : t.id === "prepayment" ? "#8B5CF6" : "#F59E0B";
                          const circleActiveShadow = t.id === "net" ? "rgba(59,130,246,0.15)" : t.id === "prepayment" ? "rgba(139,92,246,0.15)" : "rgba(245,158,11,0.15)";
                          const hoverCircleBorder = t.id === "net" ? "group-hover:border-[#93C5FD]" : t.id === "prepayment" ? "group-hover:border-[#C4B5FD]" : "group-hover:border-[#FCD34D]";
                          return (
                            <Tooltip key={t.id}>
                              <TooltipTrigger asChild>
                                <div
                                  onClick={() => { setCreatePtType(t.id as "net" | "prepayment" | "split"); if (t.id === "net" && createPtTrigger !== "shipping" && createPtTrigger !== "delivery") setCreatePtTrigger("shipping"); if (t.id === "prepayment" && (createPtTrigger === "delivery" || createPtTrigger === "shipping")) setCreatePtTrigger("order_confirmation"); }}
                                  className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
                                    isActive
                                      ? `${activeBorderClass} bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]`
                                      : `border-[#E2E8F0] bg-white ${hoverBorderClass} hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)]`
                                  }`}
                                >
                                  <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`} style={{ background: `linear-gradient(135deg, ${accentBg}80 0%, transparent 70%)` }} />
                                  <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                                    <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${isActive ? "" : "group-hover:scale-105"}`} style={{ background: `linear-gradient(135deg, ${accentBg}, ${accentBorder}40)`, color: accentColor }}>
                                      {icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-[13px] transition-colors duration-150 ${isActive ? "" : "text-[#0F172A] group-hover:text-[#1E293B]"}`} style={{ fontWeight: 600, color: isActive ? accentColor : undefined }}>{shortLabel}</p>
                                      <p className={`text-[11px] mt-0.5 truncate transition-colors duration-150`} style={{ color: isActive ? accentColor : "#94A3B8" }}>{shortDesc}</p>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                                      isActive
                                        ? ""
                                        : `border-[1.5px] border-[#D1D5DB] bg-white ${hoverCircleBorder}`
                                    }`} style={isActive ? { backgroundColor: circleActiveBg, boxShadow: `0 0 0 2px ${circleActiveShadow}` } : {}}>
                                      {isActive && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                                    </div>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                <p className="text-[#64748B]">{typeTooltip.desc}</p>
                                <div className="mt-2 px-2.5 py-2 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9]">
                                  <p className="text-[10px] text-[#94A3B8] tracking-wide" style={{ fontWeight: 600 }}>EXAMPLE</p>
                                  <p className="text-[11px] text-[#334155] mt-1"><span style={{ fontWeight: 600, color: accentColor }}>{typeTooltip.example}</span> {typeTooltip.exampleDesc}</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>

                    </div>

                    {/* Payment Term Details — compact grid like Partner Details section */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-sm text-[#0F172A]" style={{ fontWeight: 600 }}>Payment Term Details</span>
                        <Tooltip>
                          <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-[#CBD5E1] cursor-help" /></span></TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                            <p className="text-[#64748B]">Name, duration, and trigger shown on POs and invoices.</p>
                            <div className="mt-2 px-2.5 py-2 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9]">
                              <p className="text-[10px] text-[#94A3B8] tracking-wide" style={{ fontWeight: 600 }}>TIP</p>
                              <p className="text-[11px] text-[#334155] mt-1">Use clear names like <span className="text-[#0A77FF]" style={{ fontWeight: 600 }}>Net 30 Standard</span> or <span className="text-[#0A77FF]" style={{ fontWeight: 600 }}>50% Upfront</span>.</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          {/* Row 1: Name + (NET only: Trigger) / (others: Description) */}
                          <div>
                            <label className="text-[12px] text-[#0F172A] mb-1.5 block" style={{ fontWeight: 500 }}>
                              {createPtType === "net" ? "NET Term" : createPtType === "prepayment" ? "Prepayment Term" : "Split Term"} Name
                            </label>
                            <Input
                              value={createPtName}
                              onChange={(e) => setCreatePtName(e.target.value)}
                              placeholder={`e.g. ${createPtType === "net" ? "Net 30 Standard" : createPtType === "prepayment" ? "50% Upfront" : "3-Part Split"}`}
                              className="rounded-lg border-[#E2E8F0] bg-white h-9 text-[13px] text-[#0F172A] placeholder:text-[#94A3B8]"
                            />
                          </div>
                          {/* NET: Trigger next to name */}
                          {createPtType === "net" && (
                            <div>
                              <div className="flex items-center gap-1 mb-1.5">
                                <label className="text-[12px] text-[#0F172A]" style={{ fontWeight: 500 }}>Trigger Event</label>
                                <Tooltip>
                                  <TooltipTrigger asChild><span><Info className="w-3 h-3 text-[#CBD5E1] cursor-help" /></span></TooltipTrigger>
                                  <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                    <p className="text-[#64748B]">Event that starts the payment countdown.</p>
                                    <div className="mt-2 px-2.5 py-2 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9]">
                                      <p className="text-[10px] text-[#94A3B8] tracking-wide" style={{ fontWeight: 600 }}>EXAMPLE</p>
                                      <p className="text-[11px] text-[#334155] mt-1"><span className="text-[#0A77FF]" style={{ fontWeight: 600 }}>Shipping Date</span> — due 30 days after shipment.</p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <Select value={createPtTrigger} onValueChange={setCreatePtTrigger}>
                                <SelectTrigger className="h-9 rounded-lg border-[#E2E8F0] bg-white text-[13px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="z-[250] rounded-lg">
                                  {CREATE_PT_TRIGGERS.filter((t) => t.id === "shipping" || t.id === "delivery").map((t) => (
                                    <SelectItem key={t.id} value={t.id} className="py-2 px-3 text-sm">{t.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {/* Prepayment/Split: Description next to name */}
                          {createPtType !== "net" && (
                            <ExpandableTextarea
                              label="Description"
                              value={createPtDescription}
                              onChange={setCreatePtDescription}
                              placeholder="Brief summary of payment term purpose or context."
                            />
                          )}
                          {/* NET Row 2: Duration + Description */}
                          {createPtType === "net" && (
                            <>
                              <div>
                                <div className="flex items-center gap-1 mb-1.5">
                                  <label className="text-[12px] text-[#0F172A]" style={{ fontWeight: 500 }}>NET Duration (Days)</label>
                                  <Tooltip>
                                    <TooltipTrigger asChild><span><Info className="w-3 h-3 text-[#CBD5E1] cursor-help" /></span></TooltipTrigger>
                                    <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                      <p className="text-[#64748B]">Calendar days allowed after trigger. Common: 15, 30, 45, 60, or 90.</p>
                                      <div className="mt-2 px-2.5 py-2 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9]">
                                        <p className="text-[10px] text-[#94A3B8] tracking-wide" style={{ fontWeight: 600 }}>EXAMPLE</p>
                                        <p className="text-[11px] text-[#334155] mt-1"><span className="text-[#0A77FF]" style={{ fontWeight: 600 }}>Net 30</span> — pay in full within 30 days.</p>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <div className="relative">
                                  <Input
                                    value={createPtCustomDuration || createPtDuration}
                                    onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setCreatePtCustomDuration(v); setCreatePtDuration(v || "30"); }}
                                    placeholder="e.g. 30"
                                    className="h-9 rounded-lg border-[#E2E8F0] bg-white text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] pr-14"
                                    inputMode="numeric"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#94A3B8]" style={{ fontWeight: 500 }}>days</span>
                                </div>
                              </div>
                              <ExpandableTextarea
                                label="Description"
                                value={createPtDescription}
                                onChange={setCreatePtDescription}
                                placeholder="Brief summary of payment term purpose or context."
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Prepayment Configuration Card */}
                    {createPtType === "prepayment" && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-3">
                          <span className="text-sm text-[#0F172A]" style={{ fontWeight: 600 }}>Prepayment Configuration</span>
                          <Tooltip>
                            <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-[#CBD5E1] cursor-help" /></span></TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                              <p className="text-[#64748B]">Upfront payment before shipment — percentage or fixed amount.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                            {/* Value with % / $ toggle */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[12px] text-[#0F172A]" style={{ fontWeight: 500 }}>
                                  Prepayment {createPtPrepayMode === "fixed" ? "Amount" : "Value"}
                                </label>
                                <div className="inline-flex items-center h-[22px] rounded-full bg-[#F1F5F9] p-0.5">
                                  <button type="button" onClick={() => setCreatePtPrepayMode("percent")}
                                    className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${createPtPrepayMode === "percent" ? "bg-white text-[#0A77FF] shadow-sm" : "text-[#64748B] hover:text-[#334155]"}`}
                                    style={{ fontWeight: 600 }}
                                  >%</button>
                                  <button type="button" onClick={() => setCreatePtPrepayMode("fixed")}
                                    className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${createPtPrepayMode === "fixed" ? "bg-white text-[#0A77FF] shadow-sm" : "text-[#64748B] hover:text-[#334155]"}`}
                                    style={{ fontWeight: 600 }}
                                  >$</button>
                                </div>
                              </div>
                              <div className="relative">
                                {createPtPrepayMode === "fixed" && (
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#94A3B8]">$</span>
                                )}
                                <Input
                                  value={createPtCustomDuration || ""}
                                  onChange={(e) => setCreatePtCustomDuration(e.target.value)}
                                  placeholder={createPtPrepayMode === "percent" ? "e.g. 50" : "e.g. 5000.00"}
                                  className={`rounded-lg border-[#E2E8F0] bg-white text-[13px] h-9 placeholder:text-[#94A3B8] ${createPtPrepayMode === "fixed" ? "pl-7 pr-3" : "pr-8"}`}
                                />
                                {createPtPrepayMode === "percent" && (
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[#94A3B8]">%</span>
                                )}
                              </div>
                            </div>
                            {/* Trigger */}
                            <div>
                              <div className="flex items-center h-[22px] mb-1.5">
                                <label className="text-[12px] text-[#0F172A]" style={{ fontWeight: 500 }}>Trigger Event</label>
                              </div>
                              <Select value={createPtTrigger} onValueChange={setCreatePtTrigger}>
                                <SelectTrigger className="h-9 rounded-lg border-[#E2E8F0] bg-white text-[13px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="z-[250] rounded-lg">
                                  {CREATE_PT_TRIGGERS.filter((t) => t.id !== "delivery").map((t) => (
                                    <SelectItem key={t.id} value={t.id} className="py-2 px-3 text-sm">{t.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Split Payment Events */}
                    {createPtType === "split" && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-[#0F172A]" style={{ fontWeight: 600 }}>Payment Split Events</span>
                            <span className="text-[11px] text-[#94A3B8] bg-[#F1F5F9] px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>{createPtSplitEvents.length}</span>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          {createPtSplitEvents.map((evt, idx) => (
                            <div key={idx} className="rounded-xl border bg-white overflow-hidden transition-all" style={{ borderColor: "#E2E8F0" }}>
                              {/* Header — matches pricing rule tier card */}
                              <div className="flex items-center justify-between px-3.5 py-2 border-b border-[#F1F5F9]" style={{ backgroundColor: "#FFFBEB" }}>
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] text-white" style={{ fontWeight: 700, backgroundColor: "#D97706" }}>{idx + 1}</span>
                                  <span className="text-[12px] text-[#0F172A]" style={{ fontWeight: 600 }}>Split {idx + 1}</span>
                                </div>
                                {createPtSplitEvents.length > 2 && (
                                  <button
                                    onClick={() => setCreatePtSplitEvents(createPtSplitEvents.filter((_, i) => i !== idx))}
                                    className="w-6 h-6 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#EF4444] hover:bg-white/60 transition-all cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              {/* Body */}
                              <div className="px-3.5 py-3">
                                <div className="grid grid-cols-2 gap-3">
                                  {/* Split Value with % / $ toggle */}
                                  <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <label className="text-[12px] text-[#0F172A]" style={{ fontWeight: 500 }}>
                                        Split {evt.fixRate ? "Amount" : "Value"}
                                      </label>
                                      <div className="inline-flex items-center h-[22px] rounded-full bg-[#F1F5F9] p-0.5">
                                        <button type="button" onClick={() => { const u = [...createPtSplitEvents]; u[idx] = { ...u[idx], fixRate: false }; setCreatePtSplitEvents(u); }}
                                          className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${!evt.fixRate ? "bg-white text-[#0A77FF] shadow-sm" : "text-[#64748B] hover:text-[#334155]"}`}
                                          style={{ fontWeight: 600 }}>%</button>
                                        <button type="button" onClick={() => { const u = [...createPtSplitEvents]; u[idx] = { ...u[idx], fixRate: true }; setCreatePtSplitEvents(u); }}
                                          className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${evt.fixRate ? "bg-white text-[#0A77FF] shadow-sm" : "text-[#64748B] hover:text-[#334155]"}`}
                                          style={{ fontWeight: 600 }}>$</button>
                                      </div>
                                    </div>
                                    <div className="relative">
                                      {evt.fixRate && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#94A3B8]">$</span>}
                                      <Input
                                        value={evt.percent}
                                        onChange={(e) => { const u = [...createPtSplitEvents]; u[idx] = { ...u[idx], percent: e.target.value }; setCreatePtSplitEvents(u); }}
                                        placeholder={evt.fixRate ? "e.g. 5000.00" : "e.g. 50"}
                                        className={`rounded-lg border-[#E2E8F0] bg-white text-[13px] h-9 text-[#0F172A] placeholder:text-[#94A3B8] ${evt.fixRate ? "pl-7 pr-3" : "pr-8"}`}
                                      />
                                      {!evt.fixRate && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[#94A3B8]">%</span>}
                                    </div>
                                  </div>
                                  {/* Trigger Event dropdown */}
                                  <div>
                                    <div className="flex items-center h-[22px] mb-1.5">
                                      <label className="text-[12px] text-[#0F172A]" style={{ fontWeight: 500 }}>Trigger Event</label>
                                    </div>
                                    <Select
                                      value={evt.event}
                                      onValueChange={(v) => { const u = [...createPtSplitEvents]; u[idx] = { ...u[idx], event: v }; setCreatePtSplitEvents(u); }}
                                    >
                                      <SelectTrigger className="h-9 rounded-lg border-[#E2E8F0] bg-white text-[13px]">
                                        <SelectValue placeholder="Select trigger" />
                                      </SelectTrigger>
                                      <SelectContent className="z-[250] rounded-lg">
                                        {CREATE_PT_TRIGGERS.filter((t) => {
                                          const usedTriggers = createPtSplitEvents.filter((_, i) => i !== idx).map(e => e.event);
                                          return !usedTriggers.includes(t.id);
                                        }).map((t) => (
                                          <SelectItem key={t.id} value={t.id} className="py-2 px-3 text-sm">{t.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          <button
                            onClick={() => {
                              const usedTriggers = new Set(createPtSplitEvents.map(e => e.event));
                              const nextTrigger = CREATE_PT_TRIGGERS.find(t => !usedTriggers.has(t.id))?.id || "delivery";
                              setCreatePtSplitEvents([...createPtSplitEvents, { event: nextTrigger, percent: "", fixRate: false }]);
                            }}
                            disabled={createPtSplitEvents.length >= 5}
                            className="inline-flex items-center gap-1 text-[12px] text-[#D97706] hover:text-[#B45309] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ fontWeight: 600 }}
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Event {createPtSplitEvents.length >= 5 ? "(Max 5)" : ""}
                          </button>
                          {(() => {
                            const total = createPtSplitEvents.reduce((sum, e) => sum + (parseFloat(e.percent) || 0), 0);
                            return (
                              <span className={`text-[11px] ${Math.abs(total - 100) < 0.01 ? "text-[#10B981]" : "text-[#F59E0B]"}`} style={{ fontWeight: 600 }}>
                                Total: {total}%{Math.abs(total - 100) >= 0.01 ? " — must equal 100%" : " ✓"}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Early Payment Discount — collapsible card */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-sm text-[#0F172A]" style={{ fontWeight: 600 }}>Early Payment Discount</span>
                        <span className="text-[11px] text-[#94A3B8] bg-[#F1F5F9] px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>Optional</span>
                        <Tooltip>
                          <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-[#CBD5E1] cursor-help" /></span></TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                            <p className="text-[#64748B]">Encourage faster payment with an auto-applied discount within an eligible window.</p>
                            <div className="mt-2 px-2.5 py-2 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9]">
                              <p className="text-[10px] text-[#94A3B8] tracking-wide" style={{ fontWeight: 600 }}>EXAMPLE</p>
                              <p className="text-[11px] text-[#334155] mt-1"><span className="text-[#0A77FF]" style={{ fontWeight: 600 }}>2/10 Net 30</span> — 2% off if paid in 10 days, else full in 30.</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      <div className={`rounded-xl border p-4 transition-all duration-200 ${createPtApplyDiscount ? "border-[#0A77FF]/25 bg-white shadow-sm" : "border-[#E2E8F0] bg-white"}`}>
                        <div className="flex items-center gap-3">
                          <Switch checked={createPtApplyDiscount} onCheckedChange={(v) => setCreatePtApplyDiscount(v === true)} />
                          <div className="flex-1 min-w-0">
                            <h5 className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>Apply Early Payment Discount</h5>
                            <p className="text-[11px] text-[#64748B] mt-0.5">Incentivize faster payments by offering a percentage or fixed discount within a defined window.</p>
                          </div>
                        </div>

                        {createPtApplyDiscount && (
                          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-[#F1F5F9] items-end">
                            <div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                  <Label className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 500 }}>Discount</Label>
                                  <Tooltip>
                                    <TooltipTrigger asChild><span><Info className="w-3 h-3 text-[#CBD5E1] cursor-help" /></span></TooltipTrigger>
                                    <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                      <p className="text-[#64748B]">Amount deducted when paid within the eligible window. Choose % or fixed $.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <div className="inline-flex items-center h-[22px] rounded-full bg-[#F1F5F9] p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => setCreatePtDiscountMode("percent")}
                                    className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${createPtDiscountMode === "percent" ? "bg-white text-[#0A77FF] shadow-sm" : "text-[#64748B] hover:text-[#334155]"}`}
                                    style={{ fontWeight: 600 }}
                                  >
                                    %
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCreatePtDiscountMode("fixed")}
                                    className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${createPtDiscountMode === "fixed" ? "bg-white text-[#0A77FF] shadow-sm" : "text-[#64748B] hover:text-[#334155]"}`}
                                    style={{ fontWeight: 600 }}
                                  >
                                    $
                                  </button>
                                </div>
                              </div>
                              <div className="relative mt-1">
                                {createPtDiscountMode === "fixed" && (
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">$</span>
                                )}
                                <Input
                                  value={createPtDiscountPercent}
                                  onChange={(e) => setCreatePtDiscountPercent(e.target.value)}
                                  placeholder={createPtDiscountMode === "percent" ? "e.g. 5" : "e.g. 25.00"}
                                  className={`rounded-lg border-[#E2E8F0] bg-white !h-10 text-sm placeholder:text-[#94A3B8] ${createPtDiscountMode === "fixed" ? "pl-7 pr-3" : "pr-8"}`}
                                />
                                {createPtDiscountMode === "percent" && (
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">%</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-1">
                                <Label className="text-xs sm:text-[13px] text-[#0F172A]" style={{ fontWeight: 500 }}>Eligible Payment Period</Label>
                                <Tooltip>
                                  <TooltipTrigger asChild><span><Info className="w-3 h-3 text-[#CBD5E1] cursor-help" /></span></TooltipTrigger>
                                  <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                    <p className="text-[#64748B]">If paid within this window, the discount will be applied to the invoice total.</p>
                                    <div className="mt-2 px-2.5 py-2 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9]">
                                      <p className="text-[10px] text-[#94A3B8] tracking-wide" style={{ fontWeight: 600 }}>EXAMPLE</p>
                                      <p className="text-[11px] text-[#334155] mt-1"><span className="text-[#0A77FF]" style={{ fontWeight: 600 }}>2/10 Net 30</span> — 2% off if paid in 10 days, otherwise full payment in 30 days.</p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <div className="relative mt-1">
                                <Input
                                  value={createPtCustomDiscountPeriod || createPtDiscountPeriod}
                                  onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setCreatePtCustomDiscountPeriod(v); setCreatePtDiscountPeriod(v || "10"); }}
                                  placeholder="e.g. 10"
                                  className="!h-10 rounded-lg border-[#E2E8F0] bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] pr-14"
                                  inputMode="numeric"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#94A3B8]" style={{ fontWeight: 500 }}>days</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-3 sm:px-5 py-3 border-t border-[#EEF2F6] bg-white shrink-0 rounded-b-none sm:rounded-b-2xl">
              <button
                onClick={() => { setCreatePtModalOpen(false); resetCreatePtForm(); setCreatePtFullscreen(false); }}
                className="px-3 sm:px-5 py-2 rounded-lg border border-[#E2E8F0] text-xs sm:text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                style={{ fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewPaymentTerm}
                disabled={!createPtName.trim()}
                className="inline-flex items-center px-3 sm:px-5 py-2 rounded-lg bg-[#0A77FF] text-white text-xs sm:text-[13px] hover:bg-[#0862D0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                style={{ fontWeight: 600 }}
              >
                Save & Create
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Explore Presets Modal ── */}
        <Dialog open={paymentTermsModalOpen} onOpenChange={(v) => { setPaymentTermsModalOpen(v); if (!v) { setPreviewPaymentTermId(null); setPreviewTab("items"); setPtFullscreen(false); setAboutPtOpen(true); setVendorsPtOpen(true); } }}>
          <DialogContent
            className="z-[210] flex flex-col gap-0 overflow-hidden border-0 p-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={ptFullscreen
              ? { maxWidth: "calc(100% - 1rem)", width: "calc(100% - 1rem)", height: "calc(100dvh - 1rem)", maxHeight: "calc(100dvh - 1rem)", borderRadius: 16 }
              : { maxWidth: 980, width: "95vw", height: "85vh", maxHeight: "85vh", borderRadius: 16 }
            }
            hideCloseButton
          >
            
            <div className="flex items-center justify-between border-b border-[#EEF2F6] bg-card px-6 h-12 shrink-0">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>Payment Terms</h3>
                  <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Browse templates or create custom terms</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPtFullscreen(!ptFullscreen)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  {ptFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {ptFullscreen ? "Exit full" : "Full view"}
                </button>
                <button
                  onClick={() => setPaymentTermsModalOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">
                <div className="shrink-0 bg-white border-b border-[#EEF2F6] px-5 pt-4 pb-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                      <Input
                        value={ptSearch}
                        onChange={(e) => setPtSearch(e.target.value)}
                        placeholder="Search payment terms..."
                        className="pl-9 pr-8 rounded-lg border-[#D0D7E1] h-9 bg-white text-[13px] w-[220px] placeholder:text-[#94A3B8] shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus:border-[#0A77FF] focus:shadow-[0_0_0_3px_rgba(10,119,255,0.08)]"
                      />
                      {ptSearch && (
                        <button onClick={() => setPtSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Type toggle — inline with search */}
                    <div className="inline-flex items-center rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]/60 p-0.5 shrink-0">
                      {([
                        { key: "net", label: "NET", color: "#0A77FF", bg: "#EFF6FF", icon: Receipt },
                        { key: "prepayment", label: "Pre", color: "#7C3AED", bg: "#F5F3FF", icon: Clock },
                        { key: "split", label: "Split", color: "#D97706", bg: "#FFFBEB", icon: Copy },
                      ] as const).map((cat) => {
                        const active = ptTypeFilters === cat.key;
                        const count = PAYMENT_TERM_PRESETS.filter((t) => t.category === cat.key).length;
                        return (
                          <button
                            key={cat.key}
                            onClick={() => setPtTypeFilters(cat.key)}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[12px] transition-all cursor-pointer ${
                              active ? "shadow-sm" : "hover:bg-white/60"
                            }`}
                            style={{ fontWeight: active ? 600 : 500, color: active ? cat.color : "#334155", backgroundColor: active ? cat.bg : undefined }}
                          >
                            <cat.icon className="w-3.5 h-3.5" />
                            {cat.label}
                            <span
                              className="text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center"
                              style={{ fontWeight: 600, color: active ? cat.color : "#475569", backgroundColor: active ? `${cat.color}15` : "#E2E8F0" }}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex-1" />
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center justify-center min-w-[22px] h-[20px] px-1.5 rounded-md bg-primary/[0.04] text-[11px] text-[#64748B]" style={{ fontWeight: 600 }}>
                        {filteredPaymentTermPresets.length}
                      </span>
                    <Popover open={ptSortOpen} onOpenChange={setPtSortOpen}>
                      <PopoverTrigger asChild>
                        <button className={`inline-flex items-center gap-1 text-[12px] transition-colors px-2 py-1 rounded-md border ${ptSortOpen ? "text-[#0A77FF] bg-[#EFF6FF] border-[#DBEAFE]" : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] border-transparent hover:border-[#E2E8F0]"}`} style={{ fontWeight: 500 }}>
                          <ArrowUpDown className="w-3 h-3" />
                          {ptSortBy === "name" ? "Name" : ptSortBy === "vendorsApplied" ? "In Use" : ptSortBy === "duration" ? "Duration" : "Type"}
                          {ptSortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-[200px] p-1.5 rounded-lg z-[250]" sideOffset={6}>
                        <div className="space-y-0.5">
                          {([
                            { key: "name", label: "Name", icon: <ArrowUpDown className="w-3.5 h-3.5" /> },
                            { key: "vendorsApplied", label: "In Use", icon: <Building2 className="w-3.5 h-3.5" /> },
                            { key: "duration", label: "Duration", icon: <Clock className="w-3.5 h-3.5" /> },
                            { key: "category", label: "Type", icon: <Tag className="w-3.5 h-3.5" /> },
                          ] as const).map((opt) => {
                            const isActive = ptSortBy === opt.key;
                            return (
                              <button
                                key={opt.key}
                                onClick={() => {
                                  if (isActive) {
                                    setPtSortDir((d) => d === "asc" ? "desc" : "asc");
                                  } else {
                                    setPtSortBy(opt.key);
                                    setPtSortDir("asc");
                                  }
                                  setPtSortOpen(false);
                                }}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] transition-all ${
                                  isActive
                                    ? "bg-[#EFF6FF] text-[#0A77FF]"
                                    : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                                }`}
                                style={{ fontWeight: isActive ? 600 : 500 }}
                              >
                                <span className={isActive ? "text-[#0A77FF]" : "text-[#94A3B8]"}>{opt.icon}</span>
                                <span className="flex-1 text-left">{opt.label}</span>
                                {isActive && (
                                  ptSortDir === "asc"
                                    ? <ArrowUp className="w-3 h-3 text-[#0A77FF]" />
                                    : <ArrowDown className="w-3 h-3 text-[#0A77FF]" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button
                      onClick={() => { setPaymentTermsModalOpen(false); resetCreatePtForm(); setCreatePtModalOpen(true); }}
                      className="bg-primary text-primary-foreground shrink-0 h-8 px-3 text-[12px]"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Create New
                    </Button>
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center overflow-x-auto">
                    <FilterPills
                      options={(() => {
                        const base = ptTypeFilters
                          ? PAYMENT_TERM_PRESETS.filter((t) => t.category === ptTypeFilters)
                          : PAYMENT_TERM_PRESETS;
                        const presetCount = base.filter((t) => !t.id.startsWith("pt-custom-")).length;
                        const customCount = base.filter((t) => t.id.startsWith("pt-custom-")).length;
                        const createdByMeCount = base.filter((t) => t.id.startsWith("pt-custom-")).length;
                        return [
                          { key: "all", label: "All", count: base.length, showCount: true },
                          { key: "preset", label: "Template", count: presetCount, showCount: true },
                          { key: "custom", label: "Custom", count: customCount, showCount: true },
                          { key: "created_by_me", label: "Created by Me", count: createdByMeCount, showCount: true },
                          { key: "in_use", label: "In Use", count: base.filter((t) => t.vendorsApplied >= 1).length, showCount: true },
                        ];
                      })()}
                      activeKey={ptStatusFilter}
                      onSelect={(k) => setPtStatusFilter(k)}
                    />
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-5">
                  {filteredPaymentTermPresets.length === 0 ? (
                    <div className="py-20 text-center">
                      <div className="w-12 h-12 rounded-lg bg-[#F1F5F9] border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                        <Search className="w-5 h-5 text-[#94A3B8]" />
                      </div>
                      <p className="text-[13px] text-[#475569]" style={{ fontWeight: 600 }}>No payment terms found</p>
                      <p className="text-[12px] text-[#94A3B8] mt-1">Try adjusting your search or filter</p>
                    </div>
                  ) : (
                    <div className="@container/ptgrid">
                    <div className="grid grid-cols-1 @[400px]/ptgrid:grid-cols-2 @[750px]/ptgrid:grid-cols-3 auto-rows-fr gap-4">
                      {filteredPaymentTermPresets.map((term) => {
                        const isSelected = selectedPaymentTermId === term.id;

                        return (
                          <PaymentTermCard
                            key={term.id}
                            term={term}
                            isSelected={isSelected}
                            onClick={() => { setStandalonePtDetailTerm(term); setStandalonePtDetailOpen(true); }}
                            onApply={(t) => { setSelectedPaymentTermId(t.id); setPaymentTermsModalOpen(false); }}
                            onDuplicate={(t) => handleDuplicatePaymentTerm(t)}
                            searchText={ptSearch}
                            showPresetBadge
                          />
                        );
                      })}
                    </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Standalone Payment Term Detail Modal (from selected card "View") */}
        <PaymentTermDetailModal
          term={standalonePtDetailTerm}
          open={standalonePtDetailOpen}
          onClose={() => { setStandalonePtDetailOpen(false); setStandalonePtDetailTerm(null); }}
          mode="create"
          onApply={(t) => { setSelectedPaymentTermId(t.id); setPaymentTermsModalOpen(false); }}
          onDuplicate={(t) => handleDuplicatePaymentTerm(t)}
        />

        {/* Shared Pricing Rule Detail Modal (same as VendorDetailsPage) */}
        <PricingRuleDetailModal
          rule={prDetailRule}
          open={prDetailOpen}
          onClose={() => { setPrDetailOpen(false); setPrDetailRule(null); }}
          mode="create"
          onApply={(r) => {
            toast.success(`"${r.name}" applied to this partner.`);
            setPrDetailOpen(false);
          }}
          onDuplicate={(r) => {
            toast.info(`Duplicated "${r.name}"`);
            setPrDetailOpen(false);
          }}
          onDisable={(r) => {
            toast.success(`"${r.name}" has been disabled`);
            setPrDetailOpen(false);
          }}
        />
      </div>
    );
  }

  if (sectionId === "pricing_rules") {
    const PR_MOCK_ITEMS = [
      { partNo: "100219-42", desc: "Front bulkhead ca...", category: "Ram Pro Master 2500...", type: "Parts", typeBg: "#DBEAFE", typeColor: "#0A77FF", location: "Toyota Loca..." },
      { partNo: "100219-51", desc: "Box walls inlay ca...", category: "Hardware", type: "Parts", typeBg: "#DBEAFE", typeColor: "#0A77FF", location: "Toyota Tech..." },
      { partNo: "100219-51-01", desc: "Box walls inlay ca...", category: "Cabinet", type: "Equipment • Capital", typeBg: "#DBEAFE", typeColor: "#0A77FF", location: "Roseville To..." },
      { partNo: "100219-51-01RC", desc: "Box walls inlay ca...", category: "Electronics", type: "Equipment • Non-Capital", typeBg: "#FEF3C7", typeColor: "#D97706", location: "Right Toyota..." },
      { partNo: "100219-51-02", desc: "Box walls inlay ca...", category: "Hardware", type: "Parts", typeBg: "#DBEAFE", typeColor: "#0A77FF", location: "Maplewood..." },
      { partNo: "100219-52", desc: "Box closeout top...", category: "Electronics", type: "Equipment • Non-Capital", typeBg: "#FEF3C7", typeColor: "#D97706", location: "Peterson To..." },
      { partNo: "100219-52-02", desc: "Box closeout top...", category: "Cabinet", type: "Parts", typeBg: "#DBEAFE", typeColor: "#0A77FF", location: "Toyota of N..." },
      { partNo: "02901201000", desc: "Foam padding RF1...", category: "Hardware", type: "Parts", typeBg: "#DBEAFE", typeColor: "#0A77FF", location: "Toyota of C..." },
      { partNo: "100120-79", desc: "Toyota long cut, b...", category: "Electronics", type: "Equipment • Non-Capital", typeBg: "#FEF3C7", typeColor: "#D97706", location: "Toyota 101 (...)" },
    ];

    return (
      <div className="space-y-3">
        {/* Section header */}
        <div className="mb-1">
          <h4 className="text-sm text-[#0F172A]" style={{ fontWeight: 700 }}>Vendor Pricing Rules</h4>
          <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
            Attach a pricing rule to this vendor to automatically apply tier-based discounts or premiums on purchase and sales orders.{" "}
            <span className="text-[#0A77FF] inline-flex items-center gap-0.5 cursor-pointer hover:underline" style={{ fontWeight: 500 }}>
              Learn More <ExternalLink className="w-3 h-3" />
            </span>
          </p>
        </div>

        {/* CTA card — always on top */}
        <div className={`rounded-lg border-2 border-dashed border-[#E2E8F0] bg-white ${selectedPricingRules.length > 0 ? "py-4" : "py-6"} flex flex-col items-center justify-center gap-3`}>
          {selectedPricingRules.length === 0 && (
            <div className="w-10 h-10 rounded-lg bg-[#F8FAFC] border border-[#E8ECF1] flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#94A3B8]" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { resetCreatePrForm(); setCreatePrModalOpen(true); }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E2E8F0] bg-white text-xs text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
              style={{ fontWeight: 500 }}
            >
              <Plus className="w-3.5 h-3.5" /> Create rule
            </button>
            <button
              onClick={() => { setPrTypeFilters("discount"); setPrStatusFilter("all"); setPrSearch(""); setPreviewPricingRuleId(null); setPrPreviewTab("preview"); setPricingRulesModalOpen(true); }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] text-xs text-[#0A77FF] hover:bg-[#DBEAFE] transition-colors"
              style={{ fontWeight: 500 }}
            >
              <FileText className="w-3.5 h-3.5" /> Templates
            </button>
          </div>
        </div>

        {/* Selected pricing rules */}
        {selectedPricingRules.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {selectedPricingRules.map((rule) => {
              const isDis = rule.category === "discount";
              const pill = isDis
                ? { text: "#047857", bg: "#ECFDF5", border: "#D1FAE5" }
                : { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" };
              const isPreset = !rule.id.startsWith("pr-custom-");

              return (
                <div
                  key={rule.id}
                  onClick={() => handleOpenRuleDetails(rule)}
                  className="bg-white border border-[#E2E8F0] rounded-xl cursor-pointer group transition-all duration-200 flex flex-col relative"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#BFDBFE";
                    e.currentTarget.style.boxShadow = "0 4px 16px -4px rgba(10,119,255,0.10), 0 0 0 1px #BFDBFE";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#E2E8F0";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {/* Remove button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); removePricingRule(rule.id); }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors z-10"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  <div className="p-3.5 flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* Row 1: Type pill + preset/custom badge */}
                    <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
                      <span className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0" style={{ borderColor: pill.border }}>
                        <span
                          className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px]"
                          style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg }}
                        >
                          {isDis ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                          {isDis ? "Discount" : "Premium"}
                        </span>
                        <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-[#64748B] border-l" style={{ fontWeight: 500, borderColor: pill.border }}>
                          {rule.basis === "volume" ? "Volume" : "Value"}
                        </span>
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isPreset ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md bg-[#F1F5F9] border border-[#CBD5E1] text-[9px] text-[#64748B]" style={{ fontWeight: 600 }}>
                            <Lock className="w-2.5 h-2.5" /> TEMPLATE
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-[3px] rounded-md border border-[#CBD5E1] bg-white text-[9px] text-[#475569]" style={{ fontWeight: 600 }}>CUSTOM</span>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Name */}
                    <div className="shrink-0 mb-1">
                      <p className="text-[13px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}>{rule.name}</p>
                    </div>

                    {/* Row 3: Description */}
                    <div className="h-[32px] shrink-0 mb-2">
                      <p className="text-[11px] text-[#64748B] line-clamp-2 leading-relaxed" style={{ fontWeight: 400 }}>{rule.description}</p>
                    </div>

                    {/* Row 4: Hero value */}
                    <div className="flex items-baseline gap-2 shrink-0">
                      <span className="text-[22px] text-[#0F172A] tabular-nums leading-none tracking-tight" style={{ fontWeight: 600 }}>
                        {rule.tiers[0]?.discount ?? "—"}
                      </span>
                      <span className="text-[11px] text-[#94A3B8]" style={{ fontWeight: 500 }}>
                        {isDis ? "off" : "markup"}
                      </span>
                    </div>

                    {/* Row 5: Tier detail */}
                    <div className="mt-auto pt-2 shrink-0">
                      <div className="flex items-center justify-between px-3 py-[6px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] tabular-nums min-w-0">
                        <div className="flex items-center gap-1.5 text-[#64748B] min-w-0">
                          <span style={{ fontWeight: 400 }}>{rule.tiers[0]?.minValue || "-"}</span>
                          <span className="text-[#CBD5E1]">–</span>
                          <span style={{ fontWeight: 400 }}>{rule.tiers[0]?.maxValue || "-"}</span>
                        </div>
                        <span className="shrink-0 ml-2 text-[#0F172A]" style={{ fontWeight: 600 }}>{rule.tiers[0]?.discount || "-"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-[#F1F5F9] shrink-0">
                    <span className="inline-flex items-center gap-1 text-[10px] text-[#94A3B8]" style={{ fontWeight: 500 }}>
                      <Users className="w-3 h-3" /> {rule.vendorsApplied}
                    </span>
                    <span
                      className="ml-auto px-2 py-[2px] rounded-full text-[10px] border"
                      style={{ fontWeight: 500, color: "#059669", backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }}
                    >
                      Active
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}


        {/* ── Explore Pricing Rules Presets Modal ── */}
        <Dialog open={pricingRulesModalOpen} onOpenChange={(v) => { setPricingRulesModalOpen(v); if (!v) { setPrFullscreen(false); } }}>
          <DialogContent
            className="p-0 gap-0 overflow-hidden z-[210] border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col"
            style={prFullscreen
              ? { maxWidth: "calc(100% - 1rem)", width: "calc(100% - 1rem)", height: "calc(100dvh - 1rem)", maxHeight: "calc(100dvh - 1rem)", borderRadius: 16 }
              : { maxWidth: 980, width: "95vw", height: "85vh", maxHeight: "85vh", borderRadius: 16 }
            }
            hideCloseButton
          >
            <DialogTitle className="sr-only">Pricing rule presets library</DialogTitle>
            <DialogDescription className="sr-only">Browse and select pricing rule presets to apply to this vendor.</DialogDescription>

            {/* Header */}
            <div className="flex items-center justify-between px-6 h-12 border-b border-[#EEF2F6] bg-card shrink-0">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="text-[13px] text-[#0F172A]" style={{ fontWeight: 600 }}>Pricing Rule Presets</h3>
                  <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Browse and apply pricing rules to this vendor</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPrFullscreen(!prFullscreen)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all"
                  style={{ fontWeight: 500 }}
                >
                  {prFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {prFullscreen ? "Exit full" : "Full view"}
                </button>
                <button onClick={() => setPricingRulesModalOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* ── Main content (no sidebar) ── */}
              <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">
                {/* Sticky toolbar */}
                <div className="shrink-0 bg-white border-b border-[#EEF2F6] px-5 pt-4 pb-3 space-y-3">
                  {/* Search + type toggle + sort row */}
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                      <Input
                        value={prSearch}
                        onChange={(e) => setPrSearch(e.target.value)}
                        placeholder="Search pricing rules..."
                        className="pl-9 pr-8 rounded-lg border-[#D0D7E1] h-9 bg-white text-[13px] w-[220px] placeholder:text-[#94A3B8] shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus:border-[#0A77FF] focus:shadow-[0_0_0_3px_rgba(10,119,255,0.08)]"
                      />
                      {prSearch && (
                        <button onClick={() => setPrSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Type toggle — inline with search */}
                    <div className="inline-flex items-center rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]/60 p-0.5 shrink-0">
                      {([
                        { key: "discount", label: "Discounts", color: "#047857", bg: "#ECFDF5", icon: TrendingDown },
                        { key: "premium", label: "Premiums", color: "#7C3AED", bg: "#F5F3FF", icon: TrendingUp },
                      ] as const).map((cat) => {
                        const active = prTypeFilters === cat.key;
                        const count = allPricingRulePresets.filter((r) => r.category === cat.key).length;
                        return (
                          <button
                            key={cat.key}
                            onClick={() => setPrTypeFilters(cat.key)}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[12px] transition-all cursor-pointer ${
                              active ? "shadow-sm" : "hover:bg-white/60"
                            }`}
                            style={{ fontWeight: active ? 600 : 500, color: active ? cat.color : "#334155", backgroundColor: active ? cat.bg : undefined }}
                          >
                            <cat.icon className="w-3.5 h-3.5" />
                            {cat.label}
                            <span
                              className="text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center"
                              style={{ fontWeight: 600, color: active ? cat.color : "#475569", backgroundColor: active ? `${cat.color}15` : "#E2E8F0" }}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex-1" />
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center justify-center min-w-[22px] h-[20px] px-1.5 rounded-md bg-primary/[0.04] text-[11px] text-[#64748B]" style={{ fontWeight: 600 }}>
                        {filteredPricingRulePresets.length}
                      </span>
                    <Popover open={prSortOpen} onOpenChange={setPrSortOpen}>
                      <PopoverTrigger asChild>
                        <button className={`inline-flex items-center gap-1 text-[12px] transition-colors px-2 py-1 rounded-md border ${prSortOpen ? "text-[#0A77FF] bg-[#EFF6FF] border-[#DBEAFE]" : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] border-transparent hover:border-[#E2E8F0]"}`} style={{ fontWeight: 500 }}>
                          <ArrowUpDown className="w-3 h-3" />
                          {prSortBy === "name" ? "Name" : prSortBy === "vendorsApplied" ? "In Use" : prSortBy === "category" ? "Type" : "Basis"}
                          {prSortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-[200px] p-1.5 rounded-lg z-[250]" sideOffset={6}>
                        <div className="space-y-0.5">
                          {([
                            { key: "name", label: "Name", icon: <ArrowUpDown className="w-3.5 h-3.5" /> },
                            { key: "vendorsApplied", label: "In Use", icon: <Building2 className="w-3.5 h-3.5" /> },
                            { key: "category", label: "Type", icon: <Tag className="w-3.5 h-3.5" /> },
                            { key: "basis", label: "Basis", icon: <ChartColumn className="w-3.5 h-3.5" /> },
                          ] as const).map((opt) => {
                            const isActive = prSortBy === opt.key;
                            return (
                              <button
                                key={opt.key}
                                onClick={() => {
                                  if (isActive) {
                                    setPrSortDir((d) => d === "asc" ? "desc" : "asc");
                                  } else {
                                    setPrSortBy(opt.key);
                                    setPrSortDir("asc");
                                  }
                                  setPrSortOpen(false);
                                }}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] transition-all ${
                                  isActive
                                    ? "bg-[#EFF6FF] text-[#0A77FF]"
                                    : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                                }`}
                                style={{ fontWeight: isActive ? 600 : 500 }}
                              >
                                <span className={isActive ? "text-[#0A77FF]" : "text-[#94A3B8]"}>{opt.icon}</span>
                                <span className="flex-1 text-left">{opt.label}</span>
                                {isActive && (
                                  prSortDir === "asc"
                                    ? <ArrowUp className="w-3 h-3 text-[#0A77FF]" />
                                    : <ArrowDown className="w-3 h-3 text-[#0A77FF]" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button
                      onClick={() => { setPricingRulesModalOpen(false); resetCreatePrForm(); setCreatePrModalOpen(true); }}
                      className="bg-primary text-primary-foreground shrink-0 h-8 px-3 text-[12px]"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Create New
                    </Button>
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center overflow-x-auto">
                    <FilterPills
                      options={(() => {
                        const base = prTypeFilters
                          ? allPricingRulePresets.filter((r) => r.category === prTypeFilters)
                          : allPricingRulePresets;
                        const presetCount = base.filter((r) => !r.id.startsWith("pr-custom-")).length;
                        const customCount = base.filter((r) => r.id.startsWith("pr-custom-")).length;
                        const createdByMeCount = base.filter((r) => r.id.startsWith("pr-custom-")).length;
                        return [
                          { key: "all", label: "All", count: base.length, showCount: true },
                          { key: "preset", label: "Template", count: presetCount, showCount: true },
                          { key: "custom", label: "Custom", count: customCount, showCount: true },
                          { key: "created_by_me", label: "Created by Me", count: createdByMeCount, showCount: true },
                          { key: "vendors_applied", label: "In Use", count: base.filter((r) => r.vendorsApplied >= 3).length, showCount: true },
                        ];
                      })()}
                      activeKey={prStatusFilter}
                      onSelect={(k) => setPrStatusFilter(k)}
                    />
                  </div>
                </div>

                {/* Cards area */}
                <div className="flex-1 min-h-0 overflow-y-auto p-5">
                  {filteredPricingRulePresets.length === 0 ? (
                    <div className="py-20 text-center">
                      <div className="w-12 h-12 rounded-lg bg-[#F1F5F9] border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                        <Search className="w-5 h-5 text-[#94A3B8]" />
                      </div>
                      <p className="text-[13px] text-[#475569]" style={{ fontWeight: 600 }}>No pricing rules found</p>
                      <p className="text-[12px] text-[#94A3B8] mt-1">Try adjusting your search or filter</p>
                    </div>
                  ) : (
                    <div className="@container/prgrid">
                    <div className="grid grid-cols-1 @[400px]/prgrid:grid-cols-2 @[750px]/prgrid:grid-cols-3 auto-rows-fr gap-4">
                      {filteredPricingRulePresets.map((rule) => (
                        <PrTemplateCardInner
                          key={rule.id}
                          rule={rule}
                          isApplied={selectedPricingRuleIds.includes(rule.id)}
                          searchText={prSearch}
                          onClick={() => {
                            setPrDetailRule(presetToPricingRule(rule));
                            setPrDetailOpen(true);
                          }}
                          onApply={() => {
                            setSelectedPricingRuleIds((prev) => prev.includes(rule.id) ? prev : [...prev, rule.id]);
                            setPricingRulesModalOpen(false);
                            toast.success("Pricing rule applied.");
                          }}
                          onDuplicate={() => toast.success("Pricing rule duplicated.")}
                        />
                      ))}
                    </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Create New Pricing Rule Modal (multi-step) ── */}
        <Dialog open={createPrModalOpen} onOpenChange={(v) => { setCreatePrModalOpen(v); if (!v) { resetCreatePrForm(); setCreatePrFullscreen(false); } }}>
          <DialogContent
            className="p-0 gap-0 overflow-hidden z-[210] flex flex-col border-0 sm:border sm:!rounded-2xl transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={createPrFullscreen
              ? { position: "fixed" as const, inset: 0, maxWidth: "100%", width: "100%", height: "100dvh", maxHeight: "100dvh", borderRadius: 0 }
              : { maxWidth: 960, width: "95vw", height: "85vh", maxHeight: "85vh" }
            }
            hideCloseButton
          >
            <DialogTitle className="sr-only">{createPrMode === "view" ? "Pricing Rule Details" : "Create New Pricing Rule"}</DialogTitle>
            <DialogDescription className="sr-only">{createPrMode === "view" ? "View and edit pricing rule details." : "Create a new pricing rule for this vendor."}</DialogDescription>

            {/* Header — matching PricingRulesTab pattern */}
            <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-0 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
              {/* Title row */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[15px] sm:text-[17px] text-[#0F172A]" style={{ fontWeight: 700 }}>
                      {createPrMode === "view" ? (createPrName || "Pricing Rule Details") : "Create New Pricing Rule"}
                    </h2>
                    {createPrMode === "view" ? (
                      <>
                        <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wide ${
                          createPrCategory === "discount" ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-[#F5F3FF] text-[#7C3AED]"
                        }`} style={{ fontWeight: 600 }}>
                          {createPrCategory === "discount" ? "Discount" : "Premium"}
                        </span>
                        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[10px] text-[#64748B]" style={{ fontWeight: 500 }}>
                          {createPrBasis === "volume" ? "Volume" : "Value"}
                        </span>
                        {editingPrRuleId && !editingPrRuleId.startsWith("pr-custom-") && (
                          <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md bg-[#F1F5F9] border border-[#CBD5E1] text-[9px] text-[#64748B]" style={{ fontWeight: 600 }}>
                            <Lock className="w-2.5 h-2.5" /> TEMPLATE
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="hidden sm:inline-flex items-center px-1.5 py-[3px] rounded-md border border-[#CBD5E1] bg-white text-[9px] text-[#475569]" style={{ fontWeight: 600 }}>CUSTOM</span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5" style={{ fontWeight: 400 }}>
                    {createPrMode === "view"
                      ? (createPrDescription || "View and manage this pricing rule's configuration.")
                      : "Configure the type, tiers, and assign items for the new rule."
                    }
                  </p>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <button
                    onClick={() => setCreatePrFullscreen(!createPrFullscreen)}
                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    {createPrFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    {createPrFullscreen ? "Exit full" : "Full view"}
                  </button>
                  <button
                    onClick={() => { setCreatePrModalOpen(false); resetCreatePrForm(); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-all cursor-pointer"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>

              {/* Step tabs */}
              <div className="flex items-center gap-4 sm:gap-6 mt-3 sm:mt-3.5 overflow-x-auto -mb-px">
                {[
                  { num: 1 as const, label: "Rule Setup", shortLabel: "Setup", active: createPrStep === 1, completed: createPrStep === 2 },
                  { num: 2 as const, label: "Items & Attachments", shortLabel: "Items", active: createPrStep === 2, completed: false },
                ].map((tab) => (
                  <div
                    key={tab.num}
                    onClick={() => {
                      if (tab.num === 1 && createPrStep === 2) setCreatePrStep(1);
                      if (tab.num === 2 && createPrStep === 1 && (createPrMode === "view" || createPrName.trim())) setCreatePrStep(2);
                    }}
                    className={`relative flex items-center gap-2 pb-2.5 sm:pb-3 ${
                      (tab.num === 1 && createPrStep === 2) || (tab.num === 2 && createPrStep === 1 && (createPrMode === "view" || createPrName.trim()))
                        ? "cursor-pointer" : "cursor-default"
                    }`}
                  >
                    <div
                      className={`w-[22px] h-[22px] sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-[12px] shrink-0 transition-all duration-200 ${
                        tab.completed
                          ? "bg-[#10B981] text-white"
                          : tab.active
                          ? "bg-[#0A77FF] text-white"
                          : "border-[1.5px] border-[#CBD5E1] text-[#64748B] bg-white"
                      }`}
                      style={{ fontWeight: 600 }}
                    >
                      {tab.completed ? <Check className="w-3 h-3" /> : tab.num}
                    </div>
                    <span
                      className={`text-[12px] sm:text-[13px] whitespace-nowrap transition-colors ${
                        tab.active
                          ? "text-[#0A77FF]"
                          : tab.completed
                          ? "text-[#10B981]"
                          : "text-[#334155]"
                      }`}
                      style={{ fontWeight: tab.active || tab.completed ? 600 : 500 }}
                    >
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.shortLabel}</span>
                    </span>
                    {(tab.active || tab.completed) && (
                      <div className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full ${tab.completed ? "bg-[#10B981]" : "bg-[#0A77FF]"}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              {/* ─── Step 1: Rule Setup ─── */}
              {createPrStep === 1 && (() => {
                const isPresetReadOnly = createPrMode === "view" && editingPrRuleId != null && !editingPrRuleId.startsWith("pr-custom-");
                return (
                <div className="space-y-5">
                  {/* Preset read-only banner */}
                  {isPresetReadOnly && (
                    <div className="rounded-xl border border-[#FEF3C7] bg-[#FFFBEB] p-3 flex items-start gap-2.5">
                      <Lock className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[12px] text-[#92400E]" style={{ fontWeight: 600 }}>Preset Rule — Configuration Locked</p>
                        <p className="text-[11px] text-[#B45309] mt-0.5">This is a tenant-provided preset rule. You can view its configuration and add items, categories, and attachments, but you cannot modify the rule type, tiers, or names.</p>
                      </div>
                    </div>
                  )}
                  {/* Pricing Rule Type — gradient cards */}
                  <div className={isPresetReadOnly ? "opacity-60 pointer-events-none" : ""}>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm text-[#0F172A]" style={{ fontWeight: 600 }}>Pricing Rule Type</span>
                      <Tooltip>
                        <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-[#CBD5E1] cursor-help" /></span></TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                          <p className="text-[#64748B]">Discount lowers prices, Premium adds markup. Hover each card for details.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Discount card — green */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            onClick={() => setCreatePrCategory("discount")}
                            className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
                              createPrCategory === "discount"
                                ? "border-[#86EFAC]/70 bg-white shadow-[0_1px_4px_rgba(4,120,87,0.06)]"
                                : "border-[#E2E8F0] bg-white hover:border-[#BBF7D0] hover:shadow-[0_4px_16px_-4px_rgba(4,120,87,0.10)]"
                            }`}
                          >
                            <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
                              createPrCategory === "discount" ? "bg-gradient-to-br from-[#F0FDF4]/50 to-transparent" : "bg-gradient-to-br from-[#F0FDF4]/0 to-[#F0FDF4]/0 group-hover:from-[#F0FDF4]/60 group-hover:to-transparent"
                            }`} />
                            <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                              <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                                createPrCategory === "discount" ? "bg-gradient-to-br from-[#DCFCE7] to-[#BBF7D0] text-[#15803D]" : "bg-gradient-to-br from-[#F0FDF4] to-[#DCFCE7] text-[#16A34A] group-hover:scale-105"
                              }`}>
                                <TrendingDown className="w-[18px] h-[18px]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[13px] transition-colors duration-150 ${createPrCategory === "discount" ? "text-[#166534]" : "text-[#0F172A] group-hover:text-[#1E293B]"}`} style={{ fontWeight: 600 }}>Discount</p>
                                <p className={`text-[11px] mt-0.5 truncate transition-colors duration-150 ${createPrCategory === "discount" ? "text-[#22C55E]" : "text-[#94A3B8]"}`}>Lower price adjustment</p>
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 shrink-0 ${createPrCategory === "discount" ? "border-[#16A34A] bg-[#16A34A]" : "border-[#CBD5E1] group-hover:border-[#86EFAC]"}`}>
                                {createPrCategory === "discount" && <Check className="w-3 h-3 text-white" />}
                              </div>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                          <p className="text-[#64748B]">Reduce unit price when quantity or value thresholds are met.</p>
                          <div className="mt-2 px-2.5 py-2 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9]">
                            <p className="text-[10px] text-[#94A3B8] tracking-wide" style={{ fontWeight: 600 }}>EXAMPLE</p>
                            <p className="text-[11px] text-[#334155] mt-1"><span className="text-[#16A34A]" style={{ fontWeight: 600 }}>10% off</span> — orders over 500 units.</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      {/* Premium card — purple */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            onClick={() => setCreatePrCategory("premium")}
                            className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
                              createPrCategory === "premium"
                                ? "border-[#C4B5FD]/70 bg-white shadow-[0_1px_4px_rgba(124,58,237,0.06)]"
                                : "border-[#E2E8F0] bg-white hover:border-[#DDD6FE] hover:shadow-[0_4px_16px_-4px_rgba(124,58,237,0.10)]"
                            }`}
                          >
                            <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
                              createPrCategory === "premium" ? "bg-gradient-to-br from-[#F5F3FF]/50 to-transparent" : "bg-gradient-to-br from-[#F5F3FF]/0 to-[#F5F3FF]/0 group-hover:from-[#F5F3FF]/60 group-hover:to-transparent"
                            }`} />
                            <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                              <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                                createPrCategory === "premium" ? "bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] text-[#7C3AED]" : "bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] text-[#8B5CF6] group-hover:scale-105"
                              }`}>
                                <TrendingUp className="w-[18px] h-[18px]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[13px] transition-colors duration-150 ${createPrCategory === "premium" ? "text-[#5B21B6]" : "text-[#0F172A] group-hover:text-[#1E293B]"}`} style={{ fontWeight: 600 }}>Premium</p>
                                <p className={`text-[11px] mt-0.5 truncate transition-colors duration-150 ${createPrCategory === "premium" ? "text-[#8B5CF6]" : "text-[#94A3B8]"}`}>Higher price adjustment</p>
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 shrink-0 ${createPrCategory === "premium" ? "border-[#7C3AED] bg-[#7C3AED]" : "border-[#CBD5E1] group-hover:border-[#C4B5FD]"}`}>
                                {createPrCategory === "premium" && <Check className="w-3 h-3 text-white" />}
                              </div>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                          <p className="text-[#64748B]">Markup on base price for express or value-added services.</p>
                          <div className="mt-2 px-2.5 py-2 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9]">
                            <p className="text-[10px] text-[#94A3B8] tracking-wide" style={{ fontWeight: 600 }}>EXAMPLE</p>
                            <p className="text-[11px] text-[#334155] mt-1"><span className="text-[#7C3AED]" style={{ fontWeight: 600 }}>15% markup</span> — expedited + priority shipping.</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Pricing Rule Details */}
                  <div className={isPresetReadOnly ? "opacity-60 pointer-events-none" : ""}>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm text-[#0F172A]" style={{ fontWeight: 600 }}>Pricing Rule Details</span>
                      <Tooltip>
                        <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-[#CBD5E1] cursor-help" /></span></TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                          <p className="text-[#64748B]">Name and basis shown on POs and invoices.</p>
                          <div className="mt-2 px-2.5 py-2 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9]">
                            <p className="text-[10px] text-[#94A3B8] tracking-wide" style={{ fontWeight: 600 }}>TIP</p>
                            <p className="text-[11px] text-[#334155] mt-1">Use clear names like <span className="text-[#0A77FF]" style={{ fontWeight: 600 }}>Q4 Volume Discount</span> or <span className="text-[#0A77FF]" style={{ fontWeight: 600 }}>VIP Premium</span>.</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {/* Row 1: Name + Basis */}
                        <div>
                          <label className="text-[12px] text-[#0F172A] mb-1.5 block" style={{ fontWeight: 500 }}>{createPrCategory === "discount" ? "Discount" : "Premium"} Name</label>
                          <Input value={createPrName} onChange={(e) => setCreatePrName(e.target.value)} placeholder={`e.g. ${createPrCategory === "discount" ? "Volume Discount for Q4" : "Premium Markup for VIP"}`} className="h-9 rounded-lg border-[#E2E8F0] bg-white text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-1.5">
                            <label className="text-[12px] text-[#0F172A]" style={{ fontWeight: 500 }}>Calculation Basis</label>
                            <Tooltip>
                              <TooltipTrigger asChild><span><Info className="w-3 h-3 text-[#CBD5E1] cursor-help" /></span></TooltipTrigger>
                              <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                <p className="text-[#64748B]">Measure thresholds by units ordered or order value.</p>
                                <div className="mt-2 px-2.5 py-2 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9]">
                                  <p className="text-[10px] text-[#94A3B8] tracking-wide" style={{ fontWeight: 600 }}>EXAMPLE</p>
                                  <p className="text-[11px] text-[#334155] mt-1"><span className="text-[#0A77FF]" style={{ fontWeight: 600 }}>Volume</span> — 500+ units. <span className="text-[#0A77FF]" style={{ fontWeight: 600 }}>Value</span> — orders over $10K.</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="flex items-center gap-2">
                            {(["volume", "value"] as const).map((b) => (
                              <button
                                key={b}
                                onClick={() => setCreatePrBasis(b)}
                                className={`inline-flex items-center gap-1.5 flex-1 justify-center h-9 rounded-lg border text-[12px] transition-all cursor-pointer ${
                                  createPrBasis === b
                                    ? createPrCategory === "discount" ? "border-[#16A34A]/30 bg-[#F0FDF4] text-[#15803D]" : "border-[#7C3AED]/30 bg-[#F5F3FF] text-[#6D28D9]"
                                    : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
                                }`}
                                style={{ fontWeight: createPrBasis === b ? 600 : 500 }}
                              >
                                {b === "volume" ? <ChartColumn className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
                                {b === "volume" ? "Volume-Based" : "Value-Based"}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Row 2: Description (full width) */}
                        <div className="col-span-2">
                          <ExpandableTextarea
                            label="Description"
                            value={createPrDescription}
                            onChange={setCreatePrDescription}
                            placeholder="Brief summary of pricing rule purpose or context."
                          />
                        </div>
                      </div>
                      {/* Validity Period — inline toggle that expands within the card */}
                      <div className="mt-3">
                        <div className="flex items-center gap-2.5">
                          <Switch checked={createPrLimitDateRange} onCheckedChange={setCreatePrLimitDateRange} />
                          <span className="text-[13px] text-[#0F172A]" style={{ fontWeight: 500 }}>Set Validity Period</span>
                          <span className="text-[11px] text-[#94A3B8] bg-[#F1F5F9] px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>Optional</span>
                          <Tooltip>
                            <TooltipTrigger asChild><span><Info className="w-3 h-3 text-[#CBD5E1] cursor-help" /></span></TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                              <p className="text-[#64748B]">Set a date range. If off, rule applies indefinitely.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        {createPrLimitDateRange && (
                          <div className="grid grid-cols-2 gap-4 mt-3">
                            <div>
                              <div className="flex items-center gap-1 mb-1.5">
                                <label className="text-[12px] text-[#0F172A]" style={{ fontWeight: 500 }}>Valid From</label>
                                <Tooltip>
                                  <TooltipTrigger asChild><span><Info className="w-3 h-3 text-[#CBD5E1] cursor-help" /></span></TooltipTrigger>
                                  <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                    <p className="text-[#64748B]">Rule starts applying from this date.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <Input type="date" value={createPrValidFrom} onChange={(e) => setCreatePrValidFrom(e.target.value)} className="h-9 rounded-lg border-[#E2E8F0] bg-white text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1 mb-1.5">
                                <label className="text-[12px] text-[#0F172A]" style={{ fontWeight: 500 }}>Valid To</label>
                                <Tooltip>
                                  <TooltipTrigger asChild><span><Info className="w-3 h-3 text-[#CBD5E1] cursor-help" /></span></TooltipTrigger>
                                  <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                    <p className="text-[#64748B]">Rule auto-deactivates after this date.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <Input type="date" value={createPrValidTo} onChange={(e) => setCreatePrValidTo(e.target.value)} className="h-9 rounded-lg border-[#E2E8F0] bg-white text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tiers — multi-tier with add/remove */}
                  <div className={isPresetReadOnly ? "opacity-60 pointer-events-none" : ""}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-[#0F172A]" style={{ fontWeight: 600 }}>{createPrCategory === "discount" ? "Discount" : "Premium"} Tiers</span>
                        <span className="text-[11px] text-[#94A3B8] bg-[#F1F5F9] px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>{createPrTiers.length}</span>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {createPrTiers.map((tier, idx) => {
                        const isDis = createPrCategory === "discount";
                        const accent = isDis ? "#16A34A" : "#7C3AED";
                        const accentBg = isDis ? "#F0FDF4" : "#F5F3FF";
                        const accentBorder = isDis ? "#BBF7D0" : "#DDD6FE";
                        return (
                        <div key={idx} className="rounded-xl border bg-white overflow-hidden transition-all" style={{ borderColor: tier.qtyLimits ? accentBorder : "#E2E8F0" }}>
                          {/* Header */}
                          <div className="flex items-center justify-between px-3.5 py-2 border-b border-[#F1F5F9]" style={{ backgroundColor: accentBg }}>
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] text-white" style={{ fontWeight: 700, backgroundColor: accent }}>{idx + 1}</span>
                              <span className="text-[12px] text-[#0F172A]" style={{ fontWeight: 600 }}>Tier {idx + 1}</span>
                            </div>
                            {idx > 0 && (
                              <button
                                onClick={() => removeCpmTier(idx)}
                                className="w-6 h-6 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#EF4444] hover:bg-white/60 transition-all cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Body */}
                          <div className="px-3.5 py-3">
                            <div className="grid grid-cols-2 gap-3">
                              {/* Discount / Premium field */}
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-[12px] text-[#0F172A]" style={{ fontWeight: 500 }}>
                                    {isDis ? "Discount" : "Premium"} {tier.fixRate ? "Amount" : "Rate"}
                                  </label>
                                  <div className="inline-flex items-center h-[22px] rounded-full bg-[#F1F5F9] p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => updateCpmTier(idx, { fixRate: false })}
                                      className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${!tier.fixRate ? "bg-white text-[#0A77FF] shadow-sm" : "text-[#64748B] hover:text-[#334155]"}`}
                                      style={{ fontWeight: 600 }}
                                    >
                                      %
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => updateCpmTier(idx, { fixRate: true })}
                                      className={`px-2 h-[18px] rounded-full text-[10px] transition-all ${tier.fixRate ? "bg-white text-[#0A77FF] shadow-sm" : "text-[#64748B] hover:text-[#334155]"}`}
                                      style={{ fontWeight: 600 }}
                                    >
                                      $
                                    </button>
                                  </div>
                                </div>
                                <div className="relative">
                                  {tier.fixRate && (
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#94A3B8]">$</span>
                                  )}
                                  <Input value={tier.discount} onChange={(e) => updateCpmTier(idx, { discount: e.target.value })} placeholder={tier.fixRate ? "e.g. 25.00" : "e.g. 50"} className={`rounded-lg border-[#E2E8F0] bg-white text-[13px] h-9 text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20 ${tier.fixRate ? "pl-7 pr-3" : "pr-8"}`} />
                                  {!tier.fixRate && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[#94A3B8]">%</span>
                                  )}
                                </div>
                              </div>

                              {/* Quantity limits toggle */}
                              <div className="flex items-end h-full pb-[7px]">
                                <label
                                  className="flex items-center gap-2 cursor-pointer select-none"
                                  onClick={() => updateCpmTier(idx, { qtyLimits: !tier.qtyLimits })}
                                >
                                  <div className={`w-[16px] h-[16px] rounded-[4px] flex items-center justify-center shrink-0 transition-colors ${tier.qtyLimits ? "bg-[#0A77FF]" : "border-[1.5px] border-[#CBD5E1] bg-white hover:border-[#94A3B8]"}`}>
                                    {tier.qtyLimits && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                                  </div>
                                  <span className="text-[12px] text-[#334155]" style={{ fontWeight: 500 }}>Order Qty Limits</span>
                                </label>
                              </div>
                            </div>

                            {/* Expanded qty fields */}
                            {tier.qtyLimits && (
                              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#F1F5F9]">
                                <div>
                                  <label className="text-[12px] text-[#0F172A] mb-1.5 block" style={{ fontWeight: 500 }}>Min Qty</label>
                                  <Input value={tier.minQty} onChange={(e) => updateCpmTier(idx, { minQty: e.target.value })} placeholder="e.g. 100" className="rounded-lg border-[#E2E8F0] bg-white text-[13px] h-9 text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
                                </div>
                                <div>
                                  <label className="text-[12px] text-[#0F172A] mb-1.5 block" style={{ fontWeight: 500 }}>Max Qty</label>
                                  <Input value={tier.maxQty} onChange={(e) => updateCpmTier(idx, { maxQty: e.target.value })} placeholder="e.g. 500" className="rounded-lg border-[#E2E8F0] bg-white text-[13px] h-9 text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                    <button onClick={addCpmTier} className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg border border-dashed text-[12px] transition-all cursor-pointer w-full justify-center ${createPrCategory === "discount" ? "border-[#BBF7D0] text-[#16A34A] hover:bg-[#F0FDF4] hover:border-[#86EFAC]" : "border-[#DDD6FE] text-[#7C3AED] hover:bg-[#F5F3FF] hover:border-[#C4B5FD]"}`} style={{ fontWeight: 600 }}>
                      <Plus className="w-3.5 h-3.5" /> Add Tier
                    </button>
                  </div>
                </div>
                );
              })()}

              {/* ─── Step 2: Items, Categories & Attachments ─── */}
              {createPrStep === 2 && (
                <div className="space-y-5">
                  {/* Summary banner */}
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${createPrCategory === "discount" ? "bg-gradient-to-br from-[#DCFCE7] to-[#BBF7D0]" : "bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE]"}`}>
                      {createPrCategory === "discount" ? <TrendingDown className="w-4.5 h-4.5 text-[#15803D]" /> : <TrendingUp className="w-4.5 h-4.5 text-[#7C3AED]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}>{createPrName || "Untitled Rule"}</p>
                      <p className="text-[11px] text-[#64748B] truncate">
                        {createPrCategory === "discount" ? "Discount" : "Premium"} · {createPrBasis === "volume" ? "Volume-Based" : "Value-Based"} · {createPrTiers.length} tier{createPrTiers.length !== 1 ? "s" : ""}
                        {createPrTiers[0]?.discount ? ` · ${createPrTiers[0].discount}${createPrTiers[0].fixRate ? "$" : "%"}` : ""}
                      </p>
                    </div>
                    <button onClick={() => setCreatePrStep(1)} className="text-[11px] text-[#0A77FF] hover:text-[#0862D0] transition-colors cursor-pointer shrink-0" style={{ fontWeight: 600 }}>{createPrMode === "view" ? "View Setup" : "Edit Setup"}</button>
                  </div>

                  {/* Items, Categories & Attachments card */}
                  <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
                    <div className="flex items-center gap-0 border-b border-[#E2E8F0] px-4">
                      {([
                        { key: "items" as const, label: "Items", icon: Package, count: cpmSelectedItems.length },
                        { key: "categories" as const, label: "Categories", icon: FolderOpen, count: cpmSelectedCats.length },
                        { key: "attachments" as const, label: "Attachments", icon: Paperclip, count: cpmAttachments.length },
                      ]).map((t) => (
                        <button
                          key={t.key}
                          onClick={() => setCreatePrItemsTab(t.key)}
                          className={`relative px-3 py-2.5 text-[12px] flex items-center gap-1.5 transition-colors cursor-pointer ${createPrItemsTab === t.key ? "text-[#0A77FF]" : "text-[#64748B] hover:text-[#334155]"}`}
                          style={{ fontWeight: createPrItemsTab === t.key ? 600 : 500 }}
                        >
                          <t.icon className="w-3.5 h-3.5" />
                          {t.label}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${createPrItemsTab === t.key ? "bg-[#DBEAFE] text-[#0A77FF]" : "bg-[#F1F5F9] text-[#94A3B8]"}`} style={{ fontWeight: 700 }}>{t.count}</span>
                          {createPrItemsTab === t.key && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-[#0A77FF]" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Tab content — Items */}
                    {createPrItemsTab === "items" && (
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
                            <Input
                              value={cpmItemSearch}
                              onChange={(e) => setCpmItemSearch(e.target.value)}
                              placeholder="Search assigned items..."
                              className="pl-9 rounded-lg border-[#E2E8F0] bg-[#F8FAFC] text-[13px] h-9"
                            />
                          </div>
                          <button
                            onClick={() => { setCpmShowItemPicker(!cpmShowItemPicker); setCpmItemPickerSearch(""); }}
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#0A77FF] hover:bg-[#0862D0] text-white text-[12px] shadow-sm transition-colors cursor-pointer"
                            style={{ fontWeight: 600 }}
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Items
                          </button>
                        </div>

                        {/* Item picker dropdown */}
                        {cpmShowItemPicker && (
                          <div className="mb-4 rounded-xl border border-[#DBEAFE] bg-[#F8FBFF] p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[12px] text-[#0F172A]" style={{ fontWeight: 600 }}>Select items to add</span>
                              <button onClick={() => setCpmShowItemPicker(false)} className="w-6 h-6 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-white transition-colors cursor-pointer">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="relative mb-2">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
                              <Input
                                value={cpmItemPickerSearch}
                                onChange={(e) => setCpmItemPickerSearch(e.target.value)}
                                placeholder="Search by part number, description..."
                                className="pl-8 rounded-lg border-[#E2E8F0] bg-white text-[12px] h-8"
                              />
                            </div>
                            <div className="max-h-[200px] overflow-y-auto space-y-1">
                              {cpmAvailableItemsFiltered.length === 0 ? (
                                <p className="text-[11px] text-[#94A3B8] text-center py-4">No items available</p>
                              ) : (
                                cpmAvailableItemsFiltered.map((item) => (
                                  <div
                                    key={item.id}
                                    onClick={() => { cpmAddItem(item); toast.success(`Added ${item.partNo}`); }}
                                    className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-white hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)] cursor-pointer transition-all group"
                                  >
                                    <div className="w-7 h-7 rounded-md bg-[#F1F5F9] flex items-center justify-center shrink-0">
                                      <Package className="w-3.5 h-3.5 text-[#94A3B8]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[12px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}>{item.partNo}</p>
                                      <p className="text-[10px] text-[#64748B] truncate">{item.description}</p>
                                    </div>
                                    <span className="text-[10px] text-[#94A3B8] px-1.5 py-0.5 rounded bg-[#F1F5F9]">{item.category}</span>
                                    <Plus className="w-3.5 h-3.5 text-[#0A77FF] opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}

                        {/* Selected items list */}
                        {cpmSelectedItems.length > 0 ? (
                          <div className="space-y-1.5">
                            {cpmFilteredSelectedItems.map((item) => (
                              <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#E8ECF1] bg-white hover:border-[#CBD5E1] transition-all group">
                                <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${item.status === "Active" ? "bg-[#F0FDF4]" : "bg-[#FEF2F2]"}`}>
                                  <Package className={`w-3.5 h-3.5 ${item.status === "Active" ? "text-[#16A34A]" : "text-[#EF4444]"}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[12px] text-[#0F172A]" style={{ fontWeight: 600 }}>{item.partNo}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${item.status === "Active" ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-[#FEF2F2] text-[#EF4444]"}`} style={{ fontWeight: 600 }}>{item.status}</span>
                                  </div>
                                  <p className="text-[10px] text-[#64748B] truncate">{item.description}</p>
                                </div>
                                <span className="text-[10px] text-[#94A3B8] px-1.5 py-0.5 rounded bg-[#F1F5F9] hidden sm:inline">{item.category}</span>
                                <span className="text-[10px] text-[#64748B] px-1.5 py-0.5 rounded border border-[#E2E8F0] hidden sm:inline">{item.itemType}</span>
                                <button
                                  onClick={() => { cpmRemoveItem(item.id); toast("Item removed"); }}
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEF2F2] opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-8 text-center">
                            <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                              <Package className="w-5 h-5 text-[#94A3B8]" />
                            </div>
                            <p className="text-[13px] text-[#334155] mb-1" style={{ fontWeight: 600 }}>No items assigned yet</p>
                            <p className="text-[11px] text-[#94A3B8] max-w-[260px] mx-auto">Search and add items that should be affected by this pricing rule.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab content — Categories */}
                    {createPrItemsTab === "categories" && (
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
                            <Input
                              value={cpmCatSearch}
                              onChange={(e) => setCpmCatSearch(e.target.value)}
                              placeholder="Search assigned categories..."
                              className="pl-9 rounded-lg border-[#E2E8F0] bg-[#F8FAFC] text-[13px] h-9"
                            />
                          </div>
                          <button
                            onClick={() => { setCpmShowCatPicker(!cpmShowCatPicker); setCpmCatPickerSearch(""); }}
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#0A77FF] hover:bg-[#0862D0] text-white text-[12px] shadow-sm transition-colors cursor-pointer"
                            style={{ fontWeight: 600 }}
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Categories
                          </button>
                        </div>

                        {/* Category picker dropdown */}
                        {cpmShowCatPicker && (
                          <div className="mb-4 rounded-xl border border-[#DBEAFE] bg-[#F8FBFF] p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[12px] text-[#0F172A]" style={{ fontWeight: 600 }}>Select categories to add</span>
                              <button onClick={() => setCpmShowCatPicker(false)} className="w-6 h-6 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-white transition-colors cursor-pointer">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="relative mb-2">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
                              <Input
                                value={cpmCatPickerSearch}
                                onChange={(e) => setCpmCatPickerSearch(e.target.value)}
                                placeholder="Search by name, code..."
                                className="pl-8 rounded-lg border-[#E2E8F0] bg-white text-[12px] h-8"
                              />
                            </div>
                            <div className="max-h-[200px] overflow-y-auto space-y-1">
                              {cpmAvailableCatsFiltered.length === 0 ? (
                                <p className="text-[11px] text-[#94A3B8] text-center py-4">No categories available</p>
                              ) : (
                                cpmAvailableCatsFiltered.map((cat) => (
                                  <div
                                    key={cat.id}
                                    onClick={() => { cpmAddCat(cat); toast.success(`Added ${cat.name}`); }}
                                    className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-white hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)] cursor-pointer transition-all group"
                                  >
                                    <div className="w-7 h-7 rounded-md bg-[#F5F3FF] flex items-center justify-center shrink-0">
                                      <FolderOpen className="w-3.5 h-3.5 text-[#8B5CF6]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[12px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}>{cat.name}</p>
                                      <p className="text-[10px] text-[#64748B] truncate">{cat.code} · {cat.description}</p>
                                    </div>
                                    <span className="text-[10px] text-[#64748B]">{cat.linkedItems} items</span>
                                    <Plus className="w-3.5 h-3.5 text-[#0A77FF] opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}

                        {/* Selected categories list */}
                        {cpmSelectedCats.length > 0 ? (
                          <div className="space-y-1.5">
                            {cpmFilteredSelectedCats.map((cat) => (
                              <div key={cat.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#E8ECF1] bg-white hover:border-[#CBD5E1] transition-all group">
                                <div className="w-7 h-7 rounded-md bg-[#F5F3FF] flex items-center justify-center shrink-0">
                                  <FolderOpen className="w-3.5 h-3.5 text-[#8B5CF6]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[12px] text-[#0F172A]" style={{ fontWeight: 600 }}>{cat.name}</span>
                                    <span className="text-[10px] text-[#94A3B8] px-1.5 py-0.5 rounded bg-[#F1F5F9]">{cat.code}</span>
                                  </div>
                                  <p className="text-[10px] text-[#64748B] truncate">{cat.description} · {cat.linkedItems} linked items</p>
                                </div>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] ${cat.status === "Active" ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-[#FEF2F2] text-[#EF4444]"}`} style={{ fontWeight: 600 }}>{cat.status}</span>
                                <button
                                  onClick={() => { cpmRemoveCat(cat.id); toast("Category removed"); }}
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEF2F2] opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-8 text-center">
                            <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                              <FolderOpen className="w-5 h-5 text-[#94A3B8]" />
                            </div>
                            <p className="text-[13px] text-[#334155] mb-1" style={{ fontWeight: 600 }}>No categories assigned yet</p>
                            <p className="text-[11px] text-[#94A3B8] max-w-[260px] mx-auto">Assign categories to apply this pricing rule to all items within them.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab content — Attachments */}
                    {createPrItemsTab === "attachments" && (
                      <div className="p-4">
                        {cpmAttachments.length > 0 ? (
                          <div className="space-y-2 mb-4">
                            {cpmAttachments.map((att) => (
                              <div key={att.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#E8ECF1] bg-white hover:border-[#CBD5E1] transition-all group">
                                <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
                                  <FileText className="w-4 h-4 text-[#0A77FF]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}>{att.name}</p>
                                  <p className="text-[10px] text-[#94A3B8]">{att.size} · {att.type} · {att.uploadedAt}</p>
                                </div>
                                <button
                                  onClick={() => cpmRemoveAttachment(att.id)}
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEF2F2] opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <div className="py-6 text-center border-2 border-dashed border-[#E2E8F0] rounded-xl bg-[#FAFBFC]">
                          <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] border border-[#E8ECF1] border-dashed flex items-center justify-center mx-auto mb-3">
                            <Upload className="w-5 h-5 text-[#94A3B8]" />
                          </div>
                          <p className="text-[13px] text-[#334155] mb-1" style={{ fontWeight: 600 }}>
                            {cpmAttachments.length > 0 ? "Upload more files" : "No attachments yet"}
                          </p>
                          <p className="text-[11px] text-[#94A3B8] max-w-[280px] mx-auto mb-3">Upload supporting documents, contracts, or approval files for this pricing rule.</p>
                          <button
                            onClick={cpmAddAttachment}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[12px] text-[#334155] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                            style={{ fontWeight: 600 }}
                          >
                            <Upload className="w-3.5 h-3.5" /> Upload Files
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer — step-aware + mode-aware */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-[#E2E8F0] bg-white shrink-0">
              <div>
                {createPrStep === 2 && (
                  <button onClick={() => setCreatePrStep(1)} className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-[13px] text-[#475569] hover:bg-[#F8FAFC] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                    <ArrowLeft className="w-3.5 h-3.5 inline mr-1.5" />Back
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {createPrMode === "view" ? (
                  createPrStep === 1 ? (
                    <>
                      <button onClick={() => { setCreatePrModalOpen(false); resetCreatePrForm(); }} className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-[13px] text-[#475569] hover:bg-[#F8FAFC] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>Close</button>
                      {editingPrRuleId?.startsWith("pr-custom-") && (
                        <button onClick={() => { setCreatePrMode("create"); }} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] text-[13px] text-[#0A77FF] hover:bg-[#DBEAFE] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                          <Pencil className="w-3.5 h-3.5" /> Edit Rule
                        </button>
                      )}
                      <button onClick={() => setCreatePrStep(2)} className="px-4 py-2 rounded-lg bg-[#0A77FF] text-white text-[13px] hover:bg-[#0862D0] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                        View Items & Categories
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setCreatePrModalOpen(false); resetCreatePrForm(); }} className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-[13px] text-[#475569] hover:bg-[#F8FAFC] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>Close</button>
                      <button
                        onClick={() => {
                          toast.success(`Saved changes — ${cpmSelectedItems.length} items, ${cpmSelectedCats.length} categories, ${cpmAttachments.length} attachments`);
                          setCreatePrModalOpen(false);
                          resetCreatePrForm();
                        }}
                        className="px-4 py-2 rounded-lg bg-[#0A77FF] text-white text-[13px] hover:bg-[#0862D0] transition-colors cursor-pointer"
                        style={{ fontWeight: 600 }}
                      >
                        Save Changes
                      </button>
                    </>
                  )
                ) : (
                  createPrStep === 1 ? (
                    <>
                      <button onClick={() => { setCreatePrModalOpen(false); resetCreatePrForm(); }} className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-[13px] text-[#475569] hover:bg-[#F8FAFC] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>Cancel</button>
                      <button onClick={() => setCreatePrStep(2)} disabled={!createPrName.trim()} className="px-4 py-2 rounded-lg bg-[#0A77FF] text-white text-[13px] hover:bg-[#0862D0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" style={{ fontWeight: 600 }}>Continue</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setCreatePrModalOpen(false); resetCreatePrForm(); }} className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-[13px] text-[#475569] hover:bg-[#F8FAFC] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>Discard</button>
                      <button onClick={handleSaveNewPricingRule} disabled={!createPrName.trim()} className="px-4 py-2 rounded-lg bg-[#0A77FF] text-white text-[13px] hover:bg-[#0862D0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" style={{ fontWeight: 600 }}>
                        {editingPrRuleId ? "Save Changes" : "Save & Apply"}
                      </button>
                    </>
                  )
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Shared Pricing Rule Detail Modal (same as VendorDetailsPage) */}
        <PricingRuleDetailModal
          rule={prDetailRule}
          open={prDetailOpen}
          onClose={() => { setPrDetailOpen(false); setPrDetailRule(null); }}
          mode="create"
          onApply={(r) => {
            toast.success(`"${r.name}" applied to this partner.`);
            setPrDetailOpen(false);
          }}
          onDuplicate={(r) => {
            toast.info(`Duplicated "${r.name}"`);
            setPrDetailOpen(false);
          }}
          onDisable={(r) => {
            toast.success(`"${r.name}" has been disabled`);
            setPrDetailOpen(false);
          }}
        />
      </div>
    );
  }

  if (sectionId === "shipping_methods") {
    /* ── Carrier logos map ── */
    const CARRIER_CATALOG = [
      { id: "fedex", name: "FedEx Express", logoImg: fedexLogo, color: "#4D148C" },
      { id: "tcs", name: "TCS (Tranzum Courier Service)", logoImg: tcsLogo, color: "#D32F2F" },
      { id: "dhl", name: "DHL Express", logoImg: dhlLogo, color: "#FFCC00" },
      { id: "ups", name: "UPS (United Parcel Service)", logoImg: upsLogo, color: "#351C15" },
      { id: "sf", name: "SF Express", logoImg: sfLogo, color: "#1A1A1A" },
      { id: "usps", name: "USPS", logoImg: uspsLogo, color: "#004B87" },
      { id: "aramex", name: "Aramex", logoImg: aramexLogo, color: "#E65100" },
      { id: "maersk", name: "Maersk", logoImg: maerskLogo, color: "#0067A5" },
    ];
    const CARRIER_METHODS: Record<string, Array<{ id: string; name: string; desc: string; days: string; isDefault?: boolean }>> = {
      fedex: [
        { id: "fedex-air", name: "FedEx Express (Air)", desc: "Priority overnight & international air freight", days: "1-2 days", isDefault: true },
        { id: "fedex-ground", name: "FedEx Ground (Land)", desc: "Cost-effective ground shipping across regions", days: "5-7 days" },
        { id: "fedex-freight", name: "FedEx Freight", desc: "For larger shipments & palletized cargo", days: "7-14 days" },
        { id: "fedex-intl-priority", name: "FedEx International Priority", desc: "Fast customs-cleared international delivery", days: "1-2 days" },
        { id: "fedex-intl-econ", name: "FedEx International Economy", desc: "Budget-friendly international shipping", days: "14-20 days" },
      ],
      tcs: [
        { id: "tcs-overnight", name: "TCS Overnight", desc: "Next-day delivery within country", days: "1 day", isDefault: true },
        { id: "tcs-detain", name: "TCS Detain", desc: "Hold at destination for pickup", days: "2-3 days" },
      ],
      dhl: [
        { id: "dhl-express", name: "DHL Express Worldwide", desc: "Door-to-door international express", days: "1-3 days", isDefault: true },
        { id: "dhl-ecommerce", name: "DHL eCommerce", desc: "Lightweight parcel delivery", days: "5-10 days" },
        { id: "dhl-freight", name: "DHL Freight", desc: "Road & rail freight forwarding", days: "7-14 days" },
      ],
      ups: [
        { id: "ups-next-day", name: "UPS Next Day Air", desc: "Guaranteed next business day", days: "1 day", isDefault: true },
        { id: "ups-ground", name: "UPS Ground", desc: "Reliable ground shipping", days: "5-7 days" },
        { id: "ups-worldwide", name: "UPS Worldwide Economy", desc: "Most economical international option", days: "3-12 days" },
      ],
      sf: [
        { id: "sf-standard", name: "SF Standard Express", desc: "Standard domestic delivery", days: "2-4 days", isDefault: true },
        { id: "sf-international", name: "SF International", desc: "Cross-border parcel delivery", days: "5-10 days" },
      ],
      usps: [
        { id: "usps-priority", name: "USPS Priority Mail", desc: "Fast domestic delivery with tracking", days: "1-3 days", isDefault: true },
        { id: "usps-ground-adv", name: "USPS Ground Advantage", desc: "Affordable ground delivery", days: "2-5 days" },
      ],
      aramex: [
        { id: "aramex-express", name: "Aramex Priority Express", desc: "Time-definite international express", days: "1-3 days", isDefault: true },
        { id: "aramex-domestic", name: "Aramex Domestic Express", desc: "Fast local delivery", days: "1-2 days" },
      ],
      maersk: [
        { id: "maersk-ocean", name: "Maersk Ocean Freight", desc: "Full container sea freight", days: "20-45 days", isDefault: true },
        { id: "maersk-air", name: "Maersk Air Freight", desc: "Air cargo forwarding", days: "3-7 days" },
      ],
    };

    // ── Carrier Services CRUD ──
    function addCarrierService() {
      csCounter.current += 1;
      setCarrierServices((prev) => [
        ...prev,
        { id: `cs-${Date.now()}`, name: "", description: "", minDuration: 1, maxDuration: 30, isDefault: prev.length === 0 },
      ]);
    }
    function removeCarrierService(id: string) {
      setCarrierServices((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (next.length > 0 && !next.some((s) => s.isDefault)) next[0].isDefault = true;
        return next;
      });
    }
    function toggleCarrierDefault(id: string) {
      setCarrierServices((prev) => prev.map((s) => ({ ...s, isDefault: s.id === id })));
    }
    function updateCarrierService(id: string, updates: Partial<typeof carrierServices[0]>) {
      setCarrierServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    }

    // ── Vendor Shipping Preferences CRUD ──
    function addVendorShippingPref() {
      vspCounter.current += 1;
      setVendorShippingPrefs((prev) => [
        ...prev,
        { id: `vsp-${Date.now()}`, carrier: "", methods: "", isDefault: prev.length === 0 },
      ]);
    }
    function removeVendorShippingPref(id: string) {
      setVendorShippingPrefs((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (next.length > 0 && !next.some((s) => s.isDefault)) next[0].isDefault = true;
        return next;
      });
    }
    function toggleVendorDefault(id: string) {
      setVendorShippingPrefs((prev) => prev.map((s) => ({ ...s, isDefault: s.id === id })));
    }
    function updateVendorShippingPref(id: string, updates: Partial<typeof vendorShippingPrefs[0]>) {
      setVendorShippingPrefs((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    }

    // ── Tab-based UI matching pricing rules / payment terms style ──
    const shippingTabs = [
      { key: "carrier" as const, label: "Carrier Services", icon: Truck, count: carrierServices.length },
      { key: "vendor" as const, label: "Vendor Preferences", icon: Ship, count: vendorShippingPrefs.length },
    ];

    return (
      <div className="space-y-4">
        {/* ── Section Header ── */}
        <div>
          <h4 className="text-sm text-foreground" style={{ fontWeight: 700 }}>Shipping Methods</h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Set up the shipping services and delivery methods used with this vendor. These ensure accurate lead times and tracking on all related shipments.{" "}
            <span className="text-primary inline-flex items-center gap-0.5 cursor-pointer hover:underline" style={{ fontWeight: 500 }}>
              Learn More <ExternalLink className="w-3 h-3" />
            </span>
          </p>
        </div>

        {/* ── Type Tabs (like pricing rules Discount/Premium) ── */}
        <div className="flex items-center gap-0 border-b border-border">
          {shippingTabs.map((tab) => {
            const isActive = shippingTab === tab.key;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setShippingTab(tab.key)}
                className={`relative flex items-center gap-1.5 px-4 py-2.5 text-xs transition-colors cursor-pointer ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                style={{ fontWeight: isActive ? 600 : 400 }}
              >
                <TabIcon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-px rounded-full min-w-[18px] text-center ${
                      isActive ? "bg-primary/10 text-primary" : "bg-muted text-foreground"
                    }`}
                    style={{ fontWeight: 600 }}
                  >
                    {tab.count}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── TAB CONTENT: Carrier Services ── */}
        {shippingTab === "carrier" && (
          <div>
            {carrierServices.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mb-3">
                  <Truck className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>No carrier services yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">Add a carrier service to define the shipping methods available from this vendor.</p>
                <button
                  onClick={addCarrierService}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs transition-colors hover:bg-primary/90"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Carrier Service
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {carrierServices.map((entry, idx) => (
                  <div key={entry.id} className="rounded-lg border border-border bg-card shadow-sm">
                    {/* Card header */}
                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/30 border-b border-border">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 600 }}>#{idx + 1}</span>
                        <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                          {entry.name || "Untitled Method"}
                        </span>
                        {entry.isDefault && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20" style={{ fontWeight: 600 }}>Primary</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Switch
                            checked={entry.isDefault}
                            onCheckedChange={() => toggleCarrierDefault(entry.id)}
                            className="data-[state=checked]:bg-primary w-8 h-[18px]"
                          />
                          <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 500 }}>Primary</span>
                        </label>
                        <button
                          onClick={() => removeCarrierService(entry.id)}
                          className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/30 transition-colors"
                        >
                          <X className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                    {/* Card body */}
                    <div className="p-3.5 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[11px] text-[#0F172A]" style={{ fontWeight: 600 }}>Shipping Method Name<span className="text-destructive">*</span></Label>
                          <Input
                            value={entry.name}
                            onChange={(e) => updateCarrierService(entry.id, { name: e.target.value })}
                            placeholder="e.g. Economical Shipping"
                            className="mt-1 rounded-lg border-[#E2E8F0] bg-white !h-10 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-[#0F172A]" style={{ fontWeight: 600 }}>Description</Label>
                          <Input
                            value={entry.description}
                            onChange={(e) => updateCarrierService(entry.id, { description: e.target.value })}
                            placeholder="Brief description of this method"
                            className="mt-1 rounded-lg border-[#E2E8F0] bg-white !h-10 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20"
                          />
                        </div>
                      </div>

                      {/* Duration range */}
                      <div>
                        <Label className="text-[11px] text-[#0F172A]" style={{ fontWeight: 600 }}>Duration (calendar days)</Label>
                        <div className="mt-1.5 flex items-center gap-3 bg-white rounded-lg p-2.5 border border-[#E2E8F0]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-[#64748B]" style={{ fontWeight: 500 }}>Min</span>
                            <Input
                              type="number"
                              value={entry.minDuration}
                              onChange={(e) => {
                                const val = Math.max(1, Math.min(entry.maxDuration, parseInt(e.target.value) || 1));
                                updateCarrierService(entry.id, { minDuration: val });
                              }}
                              className="w-16 h-8 rounded-md border-[#E2E8F0] bg-white text-sm text-center text-[#0F172A] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20"
                            />
                          </div>
                          {/* Interactive dual-thumb slider */}
                          <Slider
                            value={[entry.minDuration, entry.maxDuration]}
                            min={1}
                            max={60}
                            step={1}
                            onValueChange={([min, max]: number[]) => {
                              updateCarrierService(entry.id, { minDuration: min, maxDuration: max });
                            }}
                            className="flex-1"
                          />
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              value={entry.maxDuration}
                              onChange={(e) => {
                                const val = Math.min(60, Math.max(entry.minDuration, parseInt(e.target.value) || 60));
                                updateCarrierService(entry.id, { maxDuration: val });
                              }}
                              className="w-16 h-8 rounded-md border-[#E2E8F0] bg-white text-sm text-center text-[#0F172A] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20"
                            />
                            <span className="text-[11px] text-[#64748B]" style={{ fontWeight: 500 }}>Max</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addCarrierService}
                  className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline mt-1"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Carrier Service
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB CONTENT: Vendor Shipping Preferences ── */}
        {shippingTab === "vendor" && (
          <div>
            {vendorShippingPrefs.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mb-3">
                  <Ship className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>No vendor preferences yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">Add a vendor preference to specify which carrier and shipping method this vendor uses by default.</p>
                <button
                  onClick={addVendorShippingPref}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs transition-colors hover:bg-primary/90"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Vendor Preference
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {vendorShippingPrefs.map((entry, idx) => {
                  const selectedCarrier = CARRIER_CATALOG.find((c) => c.id === entry.carrier);
                  const carrierMethods = entry.carrier ? (CARRIER_METHODS[entry.carrier] || []) : [];
                  const selectedMethodIds = entry.methods ? entry.methods.split(",").filter(Boolean) : [];
                  const searchVal = carrierSearches[entry.id] || "";
                  const filteredCarriers = searchVal.trim()
                    ? CARRIER_CATALOG.filter((c) => c.name.toLowerCase().includes(searchVal.toLowerCase()))
                    : CARRIER_CATALOG;

                  return (
                    <div key={entry.id} className="rounded-lg border border-border bg-card shadow-sm">
                      {/* Card header */}
                      <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/30 border-b border-border">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 600 }}>#{idx + 1}</span>
                          <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                            {selectedCarrier ? selectedCarrier.name : "Select a Carrier"}
                          </span>
                          {entry.isDefault && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20" style={{ fontWeight: 600 }}>Primary</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <Switch
                              checked={entry.isDefault}
                              onCheckedChange={() => toggleVendorDefault(entry.id)}
                              className="data-[state=checked]:bg-primary w-8 h-[18px]"
                            />
                            <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 500 }}>Primary</span>
                          </label>
                          <button
                            onClick={() => removeVendorShippingPref(entry.id)}
                            className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/30 transition-colors"
                          >
                            <X className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="p-3.5 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          {/* Carrier Selector */}
                          <div className="relative">
                            <Label className="text-[11px] text-[#0F172A]" style={{ fontWeight: 600 }}>Shipping Carrier</Label>
                            <button
                              onClick={() => setCarrierDropdownOpen((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }))}
                              className="mt-1 w-full flex items-center justify-between !h-10 px-3 rounded-lg border border-[#E2E8F0] bg-white text-sm hover:border-[#CBD5E1] transition-colors focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20"
                            >
                              {selectedCarrier ? (
                                <div className="flex items-center gap-2">
                                  <img src={selectedCarrier.logoImg} alt={selectedCarrier.name} className="w-6 h-6 rounded object-contain" />
                                  <span className="text-[#0F172A] text-sm truncate">{selectedCarrier.name}</span>
                                </div>
                              ) : (
                                <span className="text-[#94A3B8] text-sm">Select a shipping carrier</span>
                              )}
                              <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
                            </button>

                            {carrierDropdownOpen[entry.id] && (
                              <div className="absolute z-[260] top-full left-0 right-0 mt-1 rounded-lg border border-[#E2E8F0] bg-white shadow-lg max-h-[380px] overflow-hidden">
                                <div className="p-2 border-b border-[#F1F5F9]">
                                  <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
                                    <input
                                      value={searchVal}
                                      onChange={(e) => setCarrierSearches((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                                      placeholder="Search shipping carrier..."
                                      className="w-full h-8 pl-8 pr-3 rounded-md border border-[#E2E8F0] bg-white text-sm text-[#0F172A] outline-none focus:border-[#0A77FF] transition-colors placeholder:text-[#94A3B8]"
                                      autoFocus
                                    />
                                  </div>
                                </div>
                                {/* Create New Carrier */}
                                <div className="p-1.5 border-b border-[#F1F5F9]">
                                  <button
                                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors"
                                    style={{ fontWeight: 600 }}
                                    onClick={() => {
                                      setCarrierDropdownOpen((prev) => ({ ...prev, [entry.id]: false }));
                                      // Open new tab with partner creation pre-configured for carrier profile
                                      const url = `${window.location.origin}/vendors?createPartner=carrier`;
                                      window.open(url, "_blank");
                                    }}
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Create New Carrier
                                    <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                                  </button>
                                </div>
                                <div className="overflow-y-auto max-h-[260px]">
                                  {/* Recently Used section */}
                                  {!searchVal.trim() && recentlyUsedCarriers.length > 0 && (
                                    <div className="p-1.5 pb-0">
                                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-2.5 py-1" style={{ fontWeight: 600 }}>Recently Used</p>
                                      {recentlyUsedCarriers.slice(0, 3).map((cid) => {
                                        const c = CARRIER_CATALOG.find((x) => x.id === cid);
                                        if (!c) return null;
                                        const isActive = entry.carrier === c.id;
                                        return (
                                          <button
                                            key={`recent-${c.id}`}
                                            onClick={() => {
                                              updateVendorShippingPref(entry.id, { carrier: c.id, methods: "" });
                                              setCarrierDropdownOpen((prev) => ({ ...prev, [entry.id]: false }));
                                              setCarrierSearches((prev) => ({ ...prev, [entry.id]: "" }));
                                              // Track recently used
                                              setRecentlyUsedCarriers((prev) => [c.id, ...prev.filter((x) => x !== c.id)].slice(0, 5));
                                            }}
                                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors ${
                                              isActive ? "bg-primary/10" : "hover:bg-muted/60"
                                            }`}
                                          >
                                            <img src={c.logoImg} alt={c.name} className="w-6 h-6 rounded object-contain" />
                                            <span className="text-sm text-foreground flex-1 truncate" style={{ fontWeight: isActive ? 600 : 400 }}>{c.name}</span>
                                            {isActive && <Check className="w-4 h-4 text-primary" />}
                                          </button>
                                        );
                                      })}
                                      <div className="border-b border-[#F1F5F9] mx-2.5 my-1" />
                                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-2.5 py-1" style={{ fontWeight: 600 }}>All Carriers</p>
                                    </div>
                                  )}
                                  {/* All carriers list */}
                                  <div className="p-1.5 pt-0 space-y-0.5">
                                    {filteredCarriers.map((c) => {
                                      const isActive = entry.carrier === c.id;
                                      return (
                                        <button
                                          key={c.id}
                                          onClick={() => {
                                            updateVendorShippingPref(entry.id, { carrier: c.id, methods: "" });
                                            setCarrierDropdownOpen((prev) => ({ ...prev, [entry.id]: false }));
                                            setCarrierSearches((prev) => ({ ...prev, [entry.id]: "" }));
                                            setRecentlyUsedCarriers((prev) => [c.id, ...prev.filter((x) => x !== c.id)].slice(0, 5));
                                          }}
                                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors ${
                                            isActive ? "bg-primary/10" : "hover:bg-muted/60"
                                          }`}
                                        >
                                          <img src={c.logoImg} alt={c.name} className="w-6 h-6 rounded object-contain" />
                                          <span className="text-sm text-foreground flex-1 truncate" style={{ fontWeight: isActive ? 600 : 400 }}>{c.name}</span>
                                          {isActive && <Check className="w-4 h-4 text-primary" />}
                                        </button>
                                      );
                                    })}
                                    {filteredCarriers.length === 0 && (
                                      <p className="text-xs text-muted-foreground text-center py-3">No carriers found</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Shipping Methods multi-select */}
                          <div className="relative">
                            <Label className="text-[11px] text-[#0F172A]" style={{ fontWeight: 600 }}>Shipping Methods</Label>
                            <button
                              onClick={() => {
                                if (!entry.carrier) { toast.info("Please select a carrier first"); return; }
                                setMethodDropdownOpen((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }));
                              }}
                              className="mt-1 w-full flex items-center justify-between !h-10 px-3 rounded-lg border border-[#E2E8F0] bg-white text-sm hover:border-[#CBD5E1] transition-colors"
                            >
                              {selectedMethodIds.length > 0 ? (
                                <span className="text-[#0F172A] text-sm truncate">{selectedMethodIds.length} method{selectedMethodIds.length !== 1 ? "s" : ""} selected</span>
                              ) : (
                                <span className="text-[#94A3B8] text-sm">Select shipping methods</span>
                              )}
                              <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
                            </button>

                            {methodDropdownOpen[entry.id] && carrierMethods.length > 0 && (() => {
                              const mSearchVal = methodSearches[entry.id] || "";
                              const filteredMethods = mSearchVal.trim()
                                ? carrierMethods.filter((m) => m.name.toLowerCase().includes(mSearchVal.toLowerCase()) || m.desc.toLowerCase().includes(mSearchVal.toLowerCase()))
                                : carrierMethods;
                              const recentIds = recentlyUsedMethods[entry.carrier] || [];
                              const handleMethodToggle = (methodId: string) => {
                                const next = selectedMethodIds.includes(methodId)
                                  ? selectedMethodIds.filter((m) => m !== methodId)
                                  : [...selectedMethodIds, methodId];
                                updateVendorShippingPref(entry.id, { methods: next.join(",") });
                                // Track recently used
                                setRecentlyUsedMethods((prev) => ({
                                  ...prev,
                                  [entry.carrier]: [methodId, ...(prev[entry.carrier] || []).filter((x) => x !== methodId)].slice(0, 5),
                                }));
                              };
                              const renderMethodItem = (method: typeof carrierMethods[0]) => {
                                const isChecked = selectedMethodIds.includes(method.id);
                                return (
                                  <button
                                    key={method.id}
                                    onClick={() => handleMethodToggle(method.id)}
                                    className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors ${
                                      isChecked ? "bg-primary/5" : "hover:bg-muted/60"
                                    }`}
                                  >
                                    <div className={`mt-0.5 w-4 h-4 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
                                      isChecked ? "border-primary bg-primary" : "border-border bg-background"
                                    }`}>
                                      {isChecked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-foreground truncate" style={{ fontWeight: 500 }}>{method.name}</span>
                                        {method.isDefault && (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary" style={{ fontWeight: 600 }}>Primary</span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{method.desc}</p>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5" style={{ fontWeight: 500 }}>{method.days}</span>
                                  </button>
                                );
                              };
                              return (
                              <div className="absolute z-[260] top-full left-0 right-0 mt-1 rounded-lg border border-[#E2E8F0] bg-white shadow-lg max-h-[400px] overflow-hidden">
                                {/* Search */}
                                <div className="p-2 border-b border-[#F1F5F9]">
                                  <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
                                    <input
                                      value={mSearchVal}
                                      onChange={(e) => setMethodSearches((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                                      placeholder="Search shipping methods..."
                                      className="w-full h-8 pl-8 pr-3 rounded-md border border-[#E2E8F0] bg-white text-sm text-[#0F172A] outline-none focus:border-[#0A77FF] transition-colors placeholder:text-[#94A3B8]"
                                      autoFocus
                                    />
                                  </div>
                                </div>
                                {/* Create New Shipping Method */}
                                <div className="p-1.5 border-b border-[#F1F5F9]">
                                  <button
                                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors"
                                    style={{ fontWeight: 600 }}
                                    onClick={() => {
                                      setMethodDropdownOpen((prev) => ({ ...prev, [entry.id]: false }));
                                      setCreateSmForEntry(entry.id);
                                      setCreateSmForCarrier(entry.carrier);
                                      setCreateSmMethods([{ id: `csm-${Date.now()}`, name: "", description: "", minDuration: 1, maxDuration: 30, isDefault: true }]);
                                      setCreateShippingMethodOpen(true);
                                    }}
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Create New Shipping Method
                                  </button>
                                </div>
                                <div className="overflow-y-auto max-h-[260px]">
                                  {/* Recently Used section */}
                                  {!mSearchVal.trim() && recentIds.length > 0 && (
                                    <div className="p-1.5 pb-0">
                                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-2.5 py-1" style={{ fontWeight: 600 }}>Recently Used</p>
                                      {recentIds.slice(0, 3).map((mid) => {
                                        const method = carrierMethods.find((m) => m.id === mid);
                                        if (!method) return null;
                                        return renderMethodItem(method);
                                      })}
                                      <div className="border-b border-[#F1F5F9] mx-2.5 my-1" />
                                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-2.5 py-1" style={{ fontWeight: 600 }}>All Methods</p>
                                    </div>
                                  )}
                                  {/* All methods list */}
                                  <div className="p-1.5 pt-0 space-y-0.5">
                                    {filteredMethods.map((method) => renderMethodItem(method))}
                                    {filteredMethods.length === 0 && (
                                      <p className="text-xs text-muted-foreground text-center py-3">No methods found</p>
                                    )}
                                  </div>
                                </div>
                                <div className="border-t border-border p-2 flex justify-end">
                                  <button
                                    onClick={() => setMethodDropdownOpen((prev) => ({ ...prev, [entry.id]: false }))}
                                    className="px-3 py-1.5 rounded-md bg-foreground text-background text-xs"
                                    style={{ fontWeight: 600 }}
                                  >
                                    Done
                                  </button>
                                </div>
                              </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Selected methods chips — single row with overflow */}
                        {selectedMethodIds.length > 0 && (
                          <ShippingMethodChipsRow
                            methods={selectedMethodIds
                              .map((mid) => carrierMethods.find((m) => m.id === mid))
                              .filter(Boolean) as Array<{ id: string; name: string; desc: string; days: string; isDefault?: boolean }>}
                            onRemove={(mid) => {
                              const next = selectedMethodIds.filter((m) => m !== mid);
                              updateVendorShippingPref(entry.id, { methods: next.join(",") });
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}

                <button
                  onClick={addVendorShippingPref}
                  className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline mt-1"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Vendor Preference
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Create Shipping Method Modal ── */}
        <Dialog open={createShippingMethodOpen} onOpenChange={setCreateShippingMethodOpen}>
          <DialogContent
            className="p-0 gap-0 overflow-hidden border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)] flex flex-col z-[230]"
            style={{ maxWidth: 680, width: "95vw", maxHeight: "85vh", borderRadius: 16 }}
            hideCloseButton
            overlayClassName="z-[225]"
          >
            <DialogTitle className="sr-only">Create Shipping Methods</DialogTitle>
            <DialogDescription className="sr-only">Add new shipping methods for this carrier.</DialogDescription>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EEF2F6] bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-[15px] text-foreground leading-tight" style={{ fontWeight: 600 }}>Create Shipping Methods</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {(() => {
                      const carrier = CARRIER_CATALOG.find((c) => c.id === createSmForCarrier);
                      return carrier ? (
                        <span className="inline-flex items-center gap-1">
                          <img src={carrier.logoImg} alt={carrier.name} className="w-3.5 h-3.5 rounded-sm object-contain" />
                          {carrier.name}
                        </span>
                      ) : "Configure delivery options";
                    })()}
                  </p>
                </div>
              </div>
              <button onClick={() => setCreateShippingMethodOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-[#FAFBFC]">
              {createSmMethods.map((sm, idx) => (
                <div key={sm.id} className="rounded-xl border border-border bg-white shadow-sm relative">
                  {/* Card header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 600 }}>#{idx + 1}</span>
                      <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Shipping Method</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <Switch
                          checked={sm.isDefault}
                          onCheckedChange={() => {
                            setCreateSmMethods((prev) => prev.map((m) => ({ ...m, isDefault: m.id === sm.id })));
                          }}
                          className="data-[state=checked]:bg-primary w-8 h-[18px]"
                        />
                        <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 500 }}>Mark as Default</span>
                      </label>
                      {createSmMethods.length > 1 && (
                        <button
                          onClick={() => {
                            setCreateSmMethods((prev) => {
                              const next = prev.filter((m) => m.id !== sm.id);
                              if (next.length > 0 && !next.some((m) => m.isDefault)) next[0].isDefault = true;
                              return next;
                            });
                          }}
                          className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/30 transition-colors"
                        >
                          <X className="w-3 h-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Card body */}
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Shipping Method Name<span className="text-destructive">*</span></Label>
                        <Input
                          value={sm.name}
                          onChange={(e) => setCreateSmMethods((prev) => prev.map((m) => m.id === sm.id ? { ...m, name: e.target.value } : m))}
                          placeholder="Enter shipping method name"
                          className="mt-1 rounded-lg border-[#E2E8F0] bg-white !h-10 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Description</Label>
                        <Input
                          value={sm.description}
                          onChange={(e) => setCreateSmMethods((prev) => prev.map((m) => m.id === sm.id ? { ...m, description: e.target.value } : m))}
                          placeholder="Enter description"
                          className="mt-1 rounded-lg border-[#E2E8F0] bg-white !h-10 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Minimum (Days)</Label>
                        <div className="mt-1 relative">
                          <Input
                            type="number"
                            value={sm.minDuration}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(sm.maxDuration, parseInt(e.target.value) || 1));
                              setCreateSmMethods((prev) => prev.map((m) => m.id === sm.id ? { ...m, minDuration: val } : m));
                            }}
                            placeholder="Enter minimum delivery period"
                            className="rounded-lg border-[#E2E8F0] bg-white !h-10 text-sm text-foreground pr-12 placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/20"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground" style={{ fontWeight: 500 }}>days</span>
                        </div>
                      </div>
                      <div className="relative">
                        <Label className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Maximum (Days)</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground shrink-0" style={{ fontWeight: 500 }}>to</span>
                          <div className="relative flex-1">
                            <Input
                              type="number"
                              value={sm.maxDuration}
                              onChange={(e) => {
                                const val = Math.min(365, Math.max(sm.minDuration, parseInt(e.target.value) || 1));
                                setCreateSmMethods((prev) => prev.map((m) => m.id === sm.id ? { ...m, maxDuration: val } : m));
                              }}
                              placeholder="Enter maximum delivery period"
                              className="rounded-lg border-[#E2E8F0] bg-white !h-10 text-sm text-foreground pr-12 placeholder:text-muted-foreground/60 focus:border-primary focus:ring-1 focus:ring-primary/20"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground" style={{ fontWeight: 500 }}>days</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={() => {
                  setCreateSmMethods((prev) => [
                    ...prev,
                    { id: `csm-${Date.now()}`, name: "", description: "", minDuration: 1, maxDuration: 30, isDefault: prev.length === 0 },
                  ]);
                }}
                className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline"
                style={{ fontWeight: 600 }}
              >
                <Plus className="w-3.5 h-3.5" /> Add Shipping Method
              </button>
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-3 flex items-center justify-end gap-2 bg-white shrink-0">
              <Button
                variant="outline"
                onClick={() => setCreateShippingMethodOpen(false)}
                className="border-[#E2E8F0] text-muted-foreground rounded-lg text-[13px] px-4 h-9"
              >
                Discard
              </Button>
              <Button
                onClick={() => {
                  const validMethods = createSmMethods.filter((m) => m.name.trim());
                  if (validMethods.length === 0) {
                    toast.error("Please add at least one shipping method with a name");
                    return;
                  }
                  toast.success(`${validMethods.length} shipping method${validMethods.length > 1 ? "s" : ""} created successfully`);
                  setCreateShippingMethodOpen(false);
                }}
                className="rounded-lg text-[13px] px-4 h-9 shadow-sm"
              >
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (sectionId === "global_contact") {
    return (
      <div className="space-y-3">
        {/* Section header */}
        <div className="mb-1">
          <h4 className="text-sm text-[#0F172A]" style={{ fontWeight: 700 }}>Point of Contact</h4>
          <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
            Select contacts or create new ones for order communication.
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenSelectPoc}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#EDF4FF] text-[#0A77FF] text-xs hover:bg-[#DBEAFE] transition-colors border border-[#DBEAFE]"
            style={{ fontWeight: 600 }}
          >
            <Users className="w-3.5 h-3.5" />
            Select from Contact Directory
          </button>
          <button
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-[#334155] text-xs hover:bg-[#F8FAFC] transition-colors border border-[#E2E8F0]"
            style={{ fontWeight: 600 }}
            onClick={handleOpenCreatePoc}
          >
            <Plus className="w-3.5 h-3.5" />
            Create new contact
          </button>
        </div>

        {/* Selected contacts display */}
        {selectedPocContacts.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#0F172A]" style={{ fontWeight: 600 }}>
                {selectedPocContacts.length} contact{selectedPocContacts.length !== 1 ? "s" : ""} selected
              </span>
              <span className="text-[10px] text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.5 rounded-full" style={{ fontWeight: 500 }}>{selectedPocContacts.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {selectedPocContacts.map((contact) => (
                <div key={contact.id} className="rounded-lg border border-[#E8ECF1] bg-white p-3 relative group hover:border-[#BFDBFE] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <button
                    onClick={() => handleRemovePoc(contact.id)}
                    className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#FEF2F2] text-[#EF4444] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#FEE2E2]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs shrink-0"
                      style={{ backgroundColor: contact.avatarColor, fontWeight: 700 }}
                    >
                      {getInitials(contact.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[#0F172A] truncate" style={{ fontWeight: 600 }}>{contact.name}</p>
                      <p className="text-[11px] text-[#94A3B8] truncate">{contact.company}</p>
                      <div className="mt-2.5 space-y-1.5">
                        <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
                          <Phone className="w-3 h-3 text-[#94A3B8] shrink-0" />
                          <span className="truncate">{contact.phone}</span>
                          <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[10px] text-[#64748B] shrink-0" style={{ fontWeight: 500 }}>
                            <Users className="w-2.5 h-2.5" /> {contact.department}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
                          <PhoneCall className="w-3 h-3 text-[#94A3B8] shrink-0" />
                          <span className="truncate">{contact.secondaryPhone}</span>
                          {contact.secondaryPhoneExt && <span className="text-[#94A3B8]">Ext. {contact.secondaryPhoneExt}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
                          <Mail className="w-3 h-3 text-[#94A3B8] shrink-0" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-6 rounded-lg border-2 border-dashed border-[#E2E8F0] bg-white flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-lg bg-[#F8FAFC] border border-[#E8ECF1] flex items-center justify-center mb-2.5">
              <UserPlus className="w-5 h-5 text-[#94A3B8]" />
            </div>
            <p className="text-sm text-[#94A3B8]" style={{ fontWeight: 500 }}>No contacts selected</p>
            <p className="text-xs text-[#CBD5E1] mt-1.5 max-w-[280px]">
              Select contacts from your Contact Directory or create a new one to get started.
            </p>
          </div>
        )}

        {/* ── Select Point of Contact Modal ── */}
        <Dialog open={showSelectPocModal} onOpenChange={setShowSelectPocModal}>
          <DialogContent
            className="w-full max-w-none rounded-none sm:rounded-2xl sm:max-w-[960px] max-h-[100dvh] h-[100dvh] sm:h-[85vh] flex flex-col p-0 gap-0 sm:max-h-[92vh]"
            style={{ zIndex: 210 }}
            hideCloseButton
          >
            <DialogTitle className="sr-only">Select point of contact</DialogTitle>
            <DialogDescription className="sr-only">Choose contacts from the Contact Directory to associate with this partner.</DialogDescription>

            {/* Modal Header */}
            <div className="px-5 sm:px-6 pt-5 pb-4 shrink-0 border-b border-[#E2E8F0] bg-[#F8FAFC] rounded-t-none sm:rounded-t-2xl">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base sm:text-[17px] text-[#0F172A]" style={{ fontWeight: 700 }}>Select point of contact</h3>
                <button
                  onClick={() => setShowSelectPocModal(false)}
                  className="w-8 h-8 rounded-lg hover:bg-[#E2E8F0] flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-[#64748B]" />
                </button>
              </div>
              <p className="text-xs text-[#64748B] mb-4" style={{ fontWeight: 400 }}>
                Choose from your saved contacts or create a new one to assign to this partner.
              </p>

              {/* Search + Create CTA */}
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="relative w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                  <Input
                    value={pocSearch}
                    onChange={(e) => { setPocSearch(e.target.value); setPocPage(1); }}
                    placeholder="Search point of contact"
                    className="pl-9 h-9 rounded-lg border-[#E2E8F0] bg-white text-sm"
                  />
                </div>
                <button
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#EDF4FF] text-[#0A77FF] text-[13px] hover:bg-[#DBEAFE] transition-colors border border-[#DBEAFE] shrink-0"
                  style={{ fontWeight: 600 }}
                  onClick={handleOpenCreatePoc}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create New Point of Contact
                </button>
              </div>

              {/* Category filter tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                {([
                  { key: "all" as const, label: `All (${contactDictionary.length})` },
                  { key: "Sales" as const, label: `Sales (${pocDepartmentCounts["Sales"]})` },
                  { key: "Supply Chain Management" as const, label: `Supply Chain Management (${pocDepartmentCounts["Supply Chain Management"]})` },
                  { key: "Finance" as const, label: `Finance (${pocDepartmentCounts["Finance"]})` },
                ]).map((tab) => {
                  const isActive = pocCategoryFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => { setPocCategoryFilter(tab.key); setPocPage(1); }}
                      className={`px-3 py-1.5 rounded-full text-xs transition-colors border ${
                        isActive
                          ? "bg-white border-[#E2E8F0] text-[#0F172A] shadow-sm"
                          : "bg-transparent border-transparent text-[#64748B] hover:bg-white/60"
                      }`}
                      style={{ fontWeight: isActive ? 600 : 500 }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card Grid */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4">
              {pocPagedContacts.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-3">
                    <Search className="w-6 h-6 text-[#94A3B8]" />
                  </div>
                  <p className="text-sm text-[#94A3B8]" style={{ fontWeight: 500 }}>No contacts found</p>
                  <p className="text-xs text-[#CBD5E1] mt-1">Try adjusting your search or filter.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pocPagedContacts.map((contact) => {
                    const isSelected = pocTempSelected.has(contact.id);
                    return (
                      <button
                        key={contact.id}
                        onClick={() => handleTogglePocTemp(contact.id)}
                        className={`relative text-left rounded-xl border p-3.5 transition-all ${
                          isSelected
                            ? "border-[#0A77FF] bg-[#FAFCFF] shadow-[0_0_0_1px_#0A77FF]"
                            : "border-[#E2E8F0] bg-white hover:border-[#BFDBFE]"
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`absolute top-3 right-3 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          isSelected ? "bg-[#0A77FF] border-[#0A77FF]" : "border-[#D1D5DB] bg-white"
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>

                        {/* Avatar + Name */}
                        <div className="flex items-center gap-2.5 mb-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] shrink-0"
                            style={{ backgroundColor: contact.avatarColor, fontWeight: 700 }}
                          >
                            {getInitials(contact.name)}
                          </div>
                          <div className="min-w-0 pr-5">
                            <p className="text-[13px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}>{highlightMatch(contact.name, pocSearch)}</p>
                            <p className="text-[11px] text-[#94A3B8] truncate">{highlightMatch(contact.company, pocSearch)}</p>
                          </div>
                        </div>

                        {/* Contact details */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                            <Phone className="w-3 h-3 text-[#94A3B8] shrink-0" />
                            <span className="truncate">{contact.phone}</span>
                            <span className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[10px] text-[#64748B] shrink-0" style={{ fontWeight: 500 }}>
                              <Users className="w-2.5 h-2.5" />
                              {contact.department.length > 15 ? contact.department.slice(0, 15) + "..." : contact.department}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                            <PhoneCall className="w-3 h-3 text-[#94A3B8] shrink-0" />
                            <span className="truncate">{contact.secondaryPhone}</span>
                            {contact.secondaryPhoneExt && <span className="text-[#94A3B8]">Ext. {contact.secondaryPhoneExt}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                            <Mail className="w-3 h-3 text-[#94A3B8] shrink-0" />
                            <span className="truncate">{contact.email}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className="px-5 sm:px-6 py-3 border-t border-[#F1F5F9] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs text-[#64748B]">
                <span>Records per page</span>
                <span className="px-2 py-1 rounded border border-[#E2E8F0] text-xs text-[#0F172A]" style={{ fontWeight: 500 }}>{POC_PER_PAGE}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPocPage(1)} disabled={pocPage === 1} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F1F5F9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronsLeft className="w-4 h-4 text-[#64748B]" />
                </button>
                <button onClick={() => setPocPage(Math.max(1, pocPage - 1))} disabled={pocPage === 1} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F1F5F9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs text-[#64748B]">
                  <ChevronLeft className="w-4 h-4" />
                  <span className="ml-0.5">Prev</span>
                </button>
                {Array.from({ length: Math.min(pocTotalPages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (pocTotalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pocPage <= 3) {
                    pageNum = i + 1;
                  } else if (pocPage >= pocTotalPages - 2) {
                    pageNum = pocTotalPages - 4 + i;
                  } else {
                    pageNum = pocPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPocPage(pageNum)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-colors ${
                        pocPage === pageNum
                          ? "bg-[#0A77FF] text-white"
                          : "text-[#64748B] hover:bg-[#F1F5F9]"
                      }`}
                      style={{ fontWeight: pocPage === pageNum ? 600 : 400 }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button onClick={() => setPocPage(Math.min(pocTotalPages, pocPage + 1))} disabled={pocPage === pocTotalPages} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F1F5F9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs text-[#64748B]">
                  <span className="mr-0.5">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={() => setPocPage(pocTotalPages)} disabled={pocPage === pocTotalPages} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F1F5F9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronsRight className="w-4 h-4 text-[#64748B]" />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 sm:px-6 py-3.5 border-t border-[#E2E8F0] bg-[#FAFBFC] rounded-b-none sm:rounded-b-2xl flex items-center justify-between shrink-0">
              <p className="text-sm text-[#0F172A]">
                <span style={{ fontWeight: 700 }}>{pocTempSelected.size}</span>{" "}
                <span className="text-[#64748B]">point of contact{pocTempSelected.size !== 1 ? "s" : ""} selected</span>
              </p>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setShowSelectPocModal(false)}
                  className="px-5 py-2.5 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#334155] hover:bg-[#F8FAFC] transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPocSelection}
                  className="px-5 py-2.5 rounded-lg bg-[#0A77FF] text-sm text-white hover:bg-[#0960D9] transition-colors"
                  style={{ fontWeight: 600 }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Create New Point of Contact Modal ── */}
        <CreatePocModal
          open={showCreatePocModal}
          onOpenChange={setShowCreatePocModal}
          contextName={partnerName}
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
      </div>
    );
  }

  // Default fallback
  return (
    <div className="p-6 rounded-lg border-2 border-dashed border-[#E2E8F0] bg-white flex flex-col items-center justify-center text-center">
      <div className="w-10 h-10 rounded-lg bg-[#F8FAFC] border border-[#E8ECF1] flex items-center justify-center mb-2.5">
        <Settings2 className="w-5 h-5 text-[#94A3B8]" />
      </div>
      <p className="text-sm text-[#64748B]" style={{ fontWeight: 600 }}>No configuration set</p>
      <p className="text-xs text-[#94A3B8] mt-1.5 max-w-[300px]">
        Configure {currentSection.title.toLowerCase()} settings for this {configType}. These will be applied as defaults for all associated orders.
      </p>
      <button className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#334155] hover:bg-[#F8FAFC] transition-colors" style={{ fontWeight: 500 }}>
        <Plus className="w-3.5 h-3.5" />
        Add Configuration
      </button>
    </div>
  );
}