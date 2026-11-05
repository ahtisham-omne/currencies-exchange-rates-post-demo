import React, { useState, useMemo, useCallback, useRef, useEffect, type ReactNode } from "react";
import { FlagImage, flagEmojiCode } from "../currency/FlagImage";
import { createPortal } from "react-dom";
import { cn } from "../ui/utils";
import { ShippingMethodChipsRow } from "./ShippingMethodChipsRow";
import {
  ShippingMethodCarrierCard,
  SHIPPING_CARRIER_CATALOG,
  SHIPPING_CARRIER_METHODS,
  CARRIER_MODE_LABELS,
  PACKAGE_TYPE_LABELS,
  type CarrierMethodEntry,
  type CarrierMode,
  type LeadTimeUnit,
  type PackageType,
} from "./ShippingCarrierCard";
import { CarrierSelfMethodCard } from "./CarrierSelfMethodCard";
import { usePaymentTermStatus } from "../../context/PaymentTermStatusContext";
import { usePricingRuleStatus } from "../../context/PricingRuleStatusContext";
import { ExpandableTextarea } from "./ExpandableTextarea";
import { PrimaryPill } from "./PrimaryPill";
import { UnlinkPartnerDialog } from "./UnlinkPartnerDialog";
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
  Minus,
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
  CircleSlash,
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
  Unlink2,
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
  SquareSplitHorizontal,
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
  Plane,
  Layers,
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
import { PctAmountToggle } from "./PctAmountToggle";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "../ui/hover-card";
import { getAvatarTint } from "../../utils/avatarTints";
import { STATUS_LABELS } from "../../data/vendors";
import { GroupChipsRow } from "./GroupChipsRow";
import { FilterPills } from "./FilterPills";
import {
  ColumnHeaderMenu,
  ActiveFiltersBar,
  createBlankFilter,
  isFilterActive,
  applyFilters,
  sortRows,
  getUniqueColumnValues,
  type CellAccessor,
  type ColumnFilterState,
  type FilterType,
  type SortConfig,
} from "./ColumnHeaderMenu";
import { PaymentTermDetailModal } from "./PaymentTermDetailModal";
import { PricingRuleDetailModal, ManageCategoriesModal, presetToPricingRule, RULE_CURRENCY, type PricingRule, type InventoryCategory } from "./PricingRulesTab";
import { AddItemModal, type PartnerItemData } from "./PartnerItemsTab";
import { ItemScopeToggle, AllItemsCoverage, AllItemsConfirmDialog, DEFAULT_ITEM_SCOPE, type PricingRuleItemScope } from "./PricingRuleItemScope";
import { PaymentTermCard } from "./PaymentTermCard";
import { PhoneFieldWithCountry, DEFAULT_FORMAT } from "./PaymentMethodsSection";
import {
  PillOption,
  RadioOption,
  IconCardOption,
  SearchablePartnerDropdown,
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
  GROUP_VENDOR_CONFIG_SECTIONS,
  GROUP_CUSTOMER_CONFIG_SECTIONS,
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
  type ContactPerson,
} from "./partnerConstants";
import { BASE_CURRENCY, getCurrency } from "@/app/currency/currencies";
import { currencyCodeOf, currencyIdOf } from "@/app/currency/partnerCurrency";
import { CurrencyFlag } from "../currency/CurrencyFlag";
import { CurrencySymbol } from "../currency/CurrencySymbol";
import { BaseCurrencyPreview } from "../currency/BaseCurrencyPreview";
import { RuleAmountPreview } from "../currency/RuleAmountPreview";
import { SelectPocDictionaryModal, CreatePocModal } from "./PocModals";
import { PocPillsRow } from "./PocPillComponents";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { SearchableUserPicker } from "./SearchableUserPicker";
import { useVendors } from "../../context/VendorContext";
import { usePartnerGroups } from "../../context/PartnerGroupsContext";

/** Props for multi-step partner creation modal */
interface CreatePartnerGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPartnerCreated?: (data: Record<string, unknown>) => void;
  /** Auto-navigate to a specific vendor profile on open (e.g. "carrier") */
  initialProfile?: string;
  /** When true, the modal opens in "Edit Partner" mode with pre-populated data */
  editMode?: boolean;
  /** The vendor object to pre-populate when in edit mode */
  editVendor?: Record<string, unknown> | null;
  /**
   * Configuration-only mode — opens directly at Step 3 (Template
   * Configuration), hides the Back-to-Step-2 affordances, and routes
   * Save Configuration through onPartnerCreated so the caller can
   * surface the Yes/No push-to-partners prompt. Used by the per-profile
   * editor on the Partner Group detail page.
   */
  configOnlyMode?: boolean;
}

export function CreatePartnerGroupModal({ open, onOpenChange, onPartnerCreated, initialProfile, editMode = false, editVendor, configOnlyMode = false }: CreatePartnerGroupModalProps) {
  // Steps:
  //   1 = (legacy) Partner Group Selection — does not apply to groups (a group
  //       can't belong to a parent group), so this step is bypassed in the
  //       group create flow. Code paths that reset to 1 are redirected to 2.
  //   2 = Group Identity (basic info — name, scope, sub-types, region hints)
  //   3 = Template Configuration (all templated settings)
  const [step, setStep] = useState<1 | 2 | 3>(2);
  const [configType, setConfigType] = useState<"vendor" | "customer">("vendor");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [initialProfileHandled, setInitialProfileHandled] = useState(false);
  const [editModeInitialized, setEditModeInitialized] = useState(false);

  // Vendor list — sourced early so the edit-init useEffect below can read
  // it when deriving fallback memberIds for groups whose seed memberIds
  // are placeholder strings.
  const { vendors } = useVendors();
  // All partner groups from the data layer — used to enforce unique group names.
  const { groups: allGroups } = usePartnerGroups();

  // Auto-navigate to the specified profile (e.g. carrier) when modal opens
  useEffect(() => {
    if (open && initialProfile && !initialProfileHandled) {
      setInitialProfileHandled(true);
      // In editMode the scope and sub-type sets are hydrated from the
      // record, so we leave them alone — only set the active sub-type
      // tab and the configType (which side of the sidebar to render).
      // The non-editMode path is the legacy "open create flow with
      // carrier preselected" entrypoint and keeps overriding the
      // selection sets for backward compat.
      const isVendorProfile = VENDOR_SUB_TYPES.some((s) => s.id === initialProfile);
      const isCustomerProfile = CUSTOMER_SUB_TYPES.some((s) => s.id === initialProfile);
      if (editMode) {
        setActiveSubTypeTab(initialProfile);
        if (isVendorProfile) setConfigType("vendor");
        else if (isCustomerProfile) setConfigType("customer");
        setActiveConfigSection("billing_shipping");
        setActiveCustomerConfigSection("customer_billing");
        setStep(3);
      } else {
        // Legacy create-flow entrypoint
        setSelectedPartnerTypes(new Set(["vendor"]));
        setSelectedVendorSubTypes(new Set(["vendor_rules", initialProfile]));
        setActiveSubTypeTab(initialProfile);
        setConfigType("vendor");
        setActiveConfigSection("shipping_methods");
        setStep(3);
      }
    }
    if (!open) {
      setInitialProfileHandled(false);
      setEditModeInitialized(false);
      // Clear Added-view session state so the next open starts clean.
      setEditAddedRemovalIds(new Set());
      setPendingEditRemove(null);
      setBulkPrimarySnapshotIds(null);
    }
  }, [open, initialProfile, initialProfileHandled, editMode]);

  // Edit mode: pre-populate fields from a Partner Group record. The
  // calling page hands us the live store record, so every field the
  // create flow collects round-trips here for editing — Identity step,
  // members, POCs, attachments, and the Step 3 template configuration.
  useEffect(() => {
    if (open && editMode && editVendor && !editModeInitialized) {
      setEditModeInitialized(true);
      const g = editVendor as Record<string, unknown>;

      // Identity (Step 2 / Group Identity)
      setPartnerName((g.name as string) || "");
      setGroupDescription((g.description as string) || "");
      setGroupCountry((g.country as string) || "");
      setGroupCountryFlag((g.countryFlag as string) || "");
      // Status comes in as "active" | "inactive" from the record; the
      // modal's local control uses capitalized variants.
      const statusRaw = (g.status as string) || "active";
      setGroupStatus(statusRaw === "inactive" || statusRaw === "Inactive" ? "Inactive" : "Active");

      // Scope (vendor / customer) and sub-type selections
      const scope = (g.scope as string[]) || [];
      setSelectedPartnerTypes(new Set(scope));
      const vSubIds = new Set<string>((g.defaultVendorSubTypes as string[]) || []);
      const cSubIds = new Set<string>((g.defaultCustomerSubTypes as string[]) || []);
      setSelectedVendorSubTypes(vSubIds);
      setSelectedCustomerSubTypes(cSubIds);
      if (vSubIds.size > 0) setActiveSubTypeTab(Array.from(vSubIds)[0]);
      else if (cSubIds.size > 0) setActiveSubTypeTab(Array.from(cSubIds)[0]);

      // POCs, members, attachments
      setSelectedPocIds(new Set((g.pocIds as string[]) || []));
      // Seeded memberIds in the partner-groups store are placeholder
      // strings (`mock-partner-N`) that don't resolve against the live
      // vendor list — when that's the case fall back to the same
      // deterministic slice the detail page uses for its Linked
      // Partners table, so editing a seeded group surfaces real rows
      // in the Add Partners step. Once the store carries real vendor
      // ids end-to-end, the fallback becomes a no-op.
      const seededIds = (g.memberIds as string[]) || [];
      const seededAsSet = new Set(seededIds);
      const seededMatchesAnyVendor = vendors.some((v) => seededAsSet.has(v.id));
      // Most seed groups carry a memberCount but no memberIds at all, so
      // an empty list only means "no members" when the count agrees.
      const memberCount = (g.memberCount as number | undefined) ?? seededIds.length;
      let memberIdSet: Set<string>;
      if (seededMatchesAnyVendor || memberCount === 0) {
        memberIdSet = seededAsSet;
      } else {
        const groupId = (g.id as string) || "";
        let h = 0;
        for (let i = 0; i < groupId.length; i++) h = groupId.charCodeAt(i) + ((h << 5) - h);
        // Same hashString() the detail page uses, so both pick the same partners.
        h = Math.abs(h);
        const shuffled = [...vendors];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.abs((h * 9301 + 49297 * (i + 1)) % (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const sliced = shuffled.slice(0, Math.min(shuffled.length, memberCount));
        memberIdSet = new Set(sliced.map((v) => v.id));
      }
      setSelectedMemberIds(memberIdSet);
      // Seed the primary markers with the members whose primary group IS
      // this group — the same deterministic rule the group details page
      // uses — so the Added Partners view shows their Primary pills (and
      // locks them) from the moment the edit modal opens.
      const editGroupId = (g.id as string) || "";
      setPrimaryMemberIds(new Set(
        Array.from(memberIdSet).filter((id) => editGroupId && isPartnerPrimaryLockedToGroup(id, editGroupId)),
      ));
      const atts = (g.attachments as { id: string; name: string; size: string; type: string }[] | undefined) || [];
      setGroupAttachments(atts);

      // Step 3 template configuration — restore the configData payload
      // verbatim so ConfigPageContent's local state reads its original
      // nested shape (configCreditLimit, configPaymentTerm,
      // configPricingRules, configPaymentMethods, configBillingType).
      const cfg = (g.configData as Record<string, unknown> | undefined) || {};
      configDataRef.current = { ...cfg };
      // A seeded group keeps its currency in its template, not configData:
      // start the currency there rather than at the base default.
      const tplCurrency = (g.template as { currency?: string } | undefined)?.currency;
      const savedCredit = cfg.configCreditLimit as Record<string, unknown> | undefined;
      if (tplCurrency && !savedCredit?.currency) {
        configDataRef.current.configCreditLimit = { ...(savedCredit ?? {}), currency: tplCurrency };
      }

      // configOnlyMode jumps straight to Step 3 (Template Configuration);
      // the standard edit flow lands on Step 2 (Group Identity).
      setStep(configOnlyMode ? 3 : 2);

      // Edit always opens the Add Partners step on the Added tab so
      // the user lands on existing membership; Browse is one click
      // away when they want to pick new partners.
      setMemberView("added");
    }
  }, [open, editMode, editVendor, editModeInitialized, configOnlyMode, vendors]);

  // Step 1 state
  const [groupSearch, setGroupSearch] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<PartnerGroup[]>([]);
  const [primaryGroupId, setPrimaryGroupId] = useState<string | null>(null);

  // Derived: the primary group object (for downstream Step 2/3 references)
  const primaryGroup = useMemo(
    () => selectedGroups.find((g) => g.id === primaryGroupId) ?? selectedGroups[0] ?? null,
    [selectedGroups, primaryGroupId]
  );

  // Step 2 (Group Identity) state — group-specific fields
  const [partnerName, setPartnerName] = useState(""); // reused as Group Name
  const [partnerPhone, setPartnerPhone] = useState(""); // unused for groups
  const [phoneCountryCode, setPhoneCountryCode] = useState("+1"); // unused for groups
  const [website, setWebsite] = useState(""); // unused for groups
  const [address, setAddress] = useState(""); // unused for groups
  const [profileImage, setProfileImage] = useState<string | null>(null); // unused for groups
  const [selectedPartnerTypes, setSelectedPartnerTypes] = useState<Set<string>>(new Set());
  const [selectedVendorSubTypes, setSelectedVendorSubTypes] = useState<Set<string>>(new Set());
  const [selectedCustomerSubTypes, setSelectedCustomerSubTypes] = useState<Set<string>>(new Set());
  // Group-specific identity state
  const [groupStatus, setGroupStatus] = useState<"Active" | "Inactive">("Active");
  const [groupCountry, setGroupCountry] = useState<string>("");
  const [groupCountryFlag, setGroupCountryFlag] = useState<string>("");
  const [groupCountrySearch, setGroupCountrySearch] = useState<string>("");
  const [groupDescription, setGroupDescription] = useState<string>("");
  const [selectedPocIds, setSelectedPocIds] = useState<Set<string>>(new Set());
  const [pocSearch, setPocSearch] = useState<string>("");
  const [groupAttachments, setGroupAttachments] = useState<{ id: string; name: string; size: string; type: string }[]>([]);
  // Step 1 (repurposed) — Add Partners (member selection)
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  // Add Partners view toggle — only rendered in edit mode (creation
  // is always "browse" since no partners exist on the group yet).
  // Defaults to "added" in edit mode so the user lands on the existing
  // members view; users explicitly switch to Browse to add new picks.
  const [memberView, setMemberView] = useState<"browse" | "added">(editMode ? "added" : "browse");
  // Members the user explicitly marks as having THIS group as their primary.
  // Distinct from selectedMemberIds because linking ≠ primary — picking a
  // partner only puts them in the group; primary has to be opted into row
  // by row, with a confirmation modal that surfaces the override risk.
  const [primaryMemberIds, setPrimaryMemberIds] = useState<Set<string>>(new Set());
  // Tracks which partners chose to INHERIT the group's template values
  // when promoted to primary (vs keeping their existing settings). Used
  // downstream so the save payload knows whether to push the template
  // onto each partner.
  const [primaryInheritIds, setPrimaryInheritIds] = useState<Set<string>>(new Set());
  // Holds the candidate the user just toggled primary on; the confirmation
  // dialog reads from it. Null = no dialog open.
  const [pendingPrimaryMember, setPendingPrimaryMember] = useState<{ id: string; name: string } | null>(null);
  // Controls the bulk "Set all as primary" confirmation dialog. Same
  // warning content as the per-row prompt, scaled to "N partners".
  const [bulkPrimaryConfirmOpen, setBulkPrimaryConfirmOpen] = useState(false);
  // Snapshot of partner ids the bulk-primary modal will operate on.
  // Captured at the moment "Set N as primary" is clicked so the modal
  // reads consistent counts even if the underlying selection set
  // diverges (e.g. Edit Added view's bulk-selection set differs from
  // the live membership set).
  const [bulkPrimarySnapshotIds, setBulkPrimarySnapshotIds] = useState<string[] | null>(null);
  // Edit flow / Added view — a SEPARATE bulk-selection set so the
  // checkboxes drive bulk operations (Set primary / Remove primary /
  // Remove from group) instead of toggling actual membership the way
  // they do in Browse view. Existing-member rows show unchecked by
  // default — matching the AddPartnersToGroupModal Added view.
  const [editAddedRemovalIds, setEditAddedRemovalIds] = useState<Set<string>>(new Set());
  // Unlink-from-group confirmation. Discriminated union so one
  // AlertDialog serves both the per-row X and the bulk "Remove N
  // partners" toolbar action.
  const [pendingEditRemove, setPendingEditRemove] = useState<
    | { kind: "single"; id: string; name: string }
    | { kind: "bulk"; ids: string[] }
    | null
  >(null);
  // Partners whose PRIMARY group is the group being edited (ERP-5770:
  // every partner keeps ≥1 group + a primary). They can't be unlinked or
  // un-primaried from this surface — same rule and guard prompts as the
  // group details page's Linked Partners tab.
  const editingGroupIdForLock = editMode ? ((editVendor as Record<string, unknown> | null | undefined)?.id as string | undefined) ?? null : null;
  const lockedPrimaryIds = useMemo(() => {
    const s = new Set<string>();
    if (!editingGroupIdForLock) return s;
    for (const v of vendors) {
      if (isPartnerPrimaryLockedToGroup(v.id, editingGroupIdForLock)) s.add(v.id);
    }
    return s;
  }, [editingGroupIdForLock, vendors]);
  const [memberSearch, setMemberSearch] = useState<string>("");
  const [activeConfigTab, setActiveConfigTab] = useState<"vendor" | "customer">("vendor");
  const [activeConfigSection, setActiveConfigSection] = useState<string>("billing_shipping");
  const [activeCustomerConfigSection, setActiveCustomerConfigSection] = useState<string>("customer_billing");
  const [activeSubTypeTab, setActiveSubTypeTab] = useState<string>("vendor_rules");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Clear the Edit Added view's bulk-selection set when switching to
  // Browse — mirrors the AddPartnersToGroupModal pattern so the next
  // time the user lands on Added it starts unchecked.
  useEffect(() => {
    if (memberView === "browse") setEditAddedRemovalIds(new Set());
  }, [memberView]);

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
    // Group create has no parent-group selection step; from "Add Partners" go
    // back to "Group Identity"; from "Group Identity" stay put.
    setStep(2);
  }, []);

  // Group names must be unique (case-insensitive); in edit mode the group
  // being edited is excluded so re-saving its own name works.
  const isGroupNameTaken = useCallback(
    (name: string) => {
      const editingId = editMode ? ((editVendor?.id as string | undefined) ?? null) : null;
      return allGroups.some(
        (g) => g.id !== editingId && g.name.trim().toLowerCase() === name.trim().toLowerCase()
      );
    },
    [allGroups, editMode, editVendor]
  );

  // Group-create handlers
  const handleContinueToMembers = useCallback(() => {
    const trimmedName = partnerName.trim();
    if (!trimmedName) {
      setErrors({ partnerName: "Group name is required" });
      return;
    }
    if (isGroupNameTaken(trimmedName)) {
      setErrors({ partnerName: "A partner group with this name already exists" });
      return;
    }
    setErrors({});
    setStep(1); // step=1 is repurposed as the "Add Partners" / member selection step.
  }, [partnerName, isGroupNameTaken]);

  const handleToggleMember = useCallback((id: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Unselecting a member implicitly drops their primary flag — a
        // partner can't be primary if they're not in the group. Also
        // clears any inherit-on-promote bookkeeping for the same id.
        setPrimaryMemberIds((p) => {
          if (!p.has(id)) return p;
          const np = new Set(p);
          np.delete(id);
          return np;
        });
        setPrimaryInheritIds((p) => {
          if (!p.has(id)) return p;
          const np = new Set(p);
          np.delete(id);
          return np;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Per-row primary toggle. Turning OFF is silent (just removes the flag).
  // Turning ON opens a confirmation modal first so the user has to
  // acknowledge that the partner's existing settings may differ from
  // the group's template.
  const handleTogglePrimaryMember = useCallback((id: string, partnerName: string) => {
    // Locked primaries (this group IS the partner's primary) can't be
    // unmarked from here — the pill is disabled in the row, this guard
    // is belt-and-braces for any other caller.
    if (lockedPrimaryIds.has(id)) {
      toast.error(`${partnerName} keeps this group as primary. Reassign their primary group from the partner page first.`);
      return;
    }
    setPrimaryMemberIds((prev) => {
      if (prev.has(id)) {
        const next = new Set(prev);
        next.delete(id);
        // Drop any inherit-on-promote flag too.
        setPrimaryInheritIds((p) => {
          if (!p.has(id)) return p;
          const np = new Set(p);
          np.delete(id);
          return np;
        });
        return next;
      }
      // Defer the actual write until the user confirms — open the dialog.
      setPendingPrimaryMember({ id, name: partnerName });
      return prev;
    });
  }, [lockedPrimaryIds]);

  // Confirmation actions for the primary-group prompt.
  // Stakeholder logic: setting primary should NOT auto-inherit. The
  // user picks between two paths in the modal:
  //   - "inherit"      → partner adopts this group's template values
  //   - "keepExisting" → partner stays primary on this group but keeps
  //                      whatever payment terms / pricing rules / etc.
  //                      they were already configured with.
  const handleConfirmPrimaryMember = useCallback((mode: "inherit" | "keepExisting") => {
    if (!pendingPrimaryMember) return;
    const { id } = pendingPrimaryMember;
    setPrimaryMemberIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setPrimaryInheritIds((prev) => {
      const next = new Set(prev);
      if (mode === "inherit") next.add(id);
      else next.delete(id);
      return next;
    });
    setPendingPrimaryMember(null);
  }, [pendingPrimaryMember]);
  const handleCancelPrimaryMember = useCallback(() => {
    setPendingPrimaryMember(null);
  }, []);

  // Bulk primary handlers. The CTA only opens the confirmation when at
  // least one selected member isn't already primary; the confirm
  // promotes all selected members to primary in one shot.
  const handleBulkSetPrimary = useCallback(() => {
    if (selectedMemberIds.size === 0) return;
    const ids = Array.from(selectedMemberIds).filter((id) => !primaryMemberIds.has(id));
    if (ids.length === 0) return;
    setBulkPrimarySnapshotIds(ids);
    setBulkPrimaryConfirmOpen(true);
  }, [selectedMemberIds, primaryMemberIds]);
  const handleConfirmBulkPrimary = useCallback((mode: "inherit" | "keepExisting") => {
    const ids = bulkPrimarySnapshotIds ?? Array.from(selectedMemberIds);
    setPrimaryMemberIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    setPrimaryInheritIds((prev) => {
      const next = new Set(prev);
      if (mode === "inherit") {
        ids.forEach((id) => next.add(id));
      } else {
        // keepExisting — make sure none of the selected partners are
        // marked to inherit, in case a prior promotion had set the flag.
        ids.forEach((id) => next.delete(id));
      }
      return next;
    });
    setBulkPrimaryConfirmOpen(false);
    setBulkPrimarySnapshotIds(null);
  }, [bulkPrimarySnapshotIds, selectedMemberIds]);
  const handleCancelBulkPrimary = useCallback(() => {
    setBulkPrimaryConfirmOpen(false);
    setBulkPrimarySnapshotIds(null);
  }, []);

  // Bulk remove primary — silent, mirrors the per-row OFF toggle which
  // also doesn't prompt. Reversible by hitting "Set N as primary" again.
  // Locked primaries (this group IS the partner's primary) are skipped
  // with an explanation — a partner must always keep a primary group.
  const handleBulkRemovePrimary = useCallback(() => {
    if (selectedMemberIds.size === 0) return;
    const lockedSelected = Array.from(selectedMemberIds).filter((id) => lockedPrimaryIds.has(id) && primaryMemberIds.has(id));
    const removable = new Set(Array.from(selectedMemberIds).filter((id) => !lockedPrimaryIds.has(id)));
    if (removable.size === 0 || Array.from(removable).every((id) => !primaryMemberIds.has(id))) {
      if (lockedSelected.length > 0) {
        toast.error(`${lockedSelected.length === 1 ? "This partner keeps" : `These ${lockedSelected.length} partners keep`} this group as primary. Reassign their primary group from the partner page first.`);
      }
      return;
    }
    if (lockedSelected.length > 0) {
      toast.info(`${lockedSelected.length} primary partner${lockedSelected.length === 1 ? "" : "s"} skipped — this group is their primary group.`);
    }
    setPrimaryMemberIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      removable.forEach((id) => {
        if (next.has(id)) {
          next.delete(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    // Also drop inherit-on-promote flags so a future promotion starts
    // clean (user picks inherit-or-keep again).
    setPrimaryInheritIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      removable.forEach((id) => {
        if (next.has(id)) {
          next.delete(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [selectedMemberIds, lockedPrimaryIds, primaryMemberIds]);

  const handleTogglePoc = useCallback((id: string) => {
    setSelectedPocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAddAttachments = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files).map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      size: `${Math.max(1, Math.round(f.size / 1024))} KB`,
      type: (f.name.split(".").pop() || "file").toUpperCase(),
    }));
    setGroupAttachments((prev) => [...prev, ...incoming]);
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setGroupAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleSelectGroupCountry = useCallback((country: string, flag: string) => {
    setGroupCountry(country);
    setGroupCountryFlag(flag);
  }, []);

  /* Carrier-profile confirmation gate — same UX primitive used in
   * CreatePartnerModal + the partner detail page. Toggling Carrier
   * routes through an explicit Enable/Disable modal so the user sees
   * downstream impact + the reassurance that vendor/customer setup
   * isn't replaced. */
  const [pendingCarrierAction, setPendingCarrierAction] = useState<"enable" | "disable" | null>(null);

  const applyVendorSubTypeToggle = useCallback((id: string) => {
    setSelectedVendorSubTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Vendor Rules can only be disabled if at least one other profile remains enabled
        if (id === "vendor_rules") {
          const othersEnabled = Array.from(next).filter(x => x !== "vendor_rules");
          if (othersEnabled.length === 0) return prev; // can't disable seller if it's the only one
        }
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleVendorSubType = useCallback((id: string) => {
    if (id === "carrier") {
      setSelectedVendorSubTypes((prev) => {
        setPendingCarrierAction(prev.has("carrier") ? "disable" : "enable");
        return prev;
      });
      return;
    }
    applyVendorSubTypeToggle(id);
  }, [applyVendorSubTypeToggle]);

  const handleToggleCustomerSubType = useCallback((id: string) => {
    setSelectedCustomerSubTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Buyer can only be disabled if at least one other profile remains enabled
        if (id === "customer_rules") {
          const othersEnabled = Array.from(next).filter(x => x !== "customer_rules");
          if (othersEnabled.length === 0) return prev; // can't disable buyer if it's the only one
        }
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
    // Reset all state — group flow lands on Group Identity, never the
    // bypassed parent-group-selection step.
    setStep(2);
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
    setActiveSubTypeTab("vendor_rules");
    setErrors({});
    // Group-specific fields
    setGroupStatus("Active");
    setGroupCountry("");
    setGroupCountryFlag("");
    setGroupCountrySearch("");
    setGroupDescription("");
    setSelectedPocIds(new Set());
    setPocSearch("");
    setGroupAttachments([]);
    setSelectedMemberIds(new Set());
    setMemberSearch("");
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSave = useCallback(() => {
    // Group Name is the only required field — Vendor/Customer scope
    // is OPTIONAL on a template (stakeholder feedback: groups don't
    // have to declare scope upfront, partners associated to the group
    // can be either type and the template still applies). If the user
    // tries to save without a name, surface the inline error and jump
    // them back to Identity so they can fix it; do NOT block on scope.
    const newErrors: Record<string, string> = {};
    const trimmedGroupName = partnerName.trim();
    if (!trimmedGroupName) newErrors.partnerName = "Group name is required";
    else if (isGroupNameTaken(trimmedGroupName)) newErrors.partnerName = "A partner group with this name already exists";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (step !== 2 && newErrors.partnerName) setStep(2);
      return;
    }

    // Build a Partner Group payload (template, not a partner).
    const data = {
      kind: "partner-group" as const,
      groupName: partnerName.trim(),
      status: groupStatus,
      country: groupCountry,
      countryFlag: groupCountryFlag,
      description: groupDescription,
      scope: Array.from(selectedPartnerTypes) as ("vendor" | "customer")[],
      defaultVendorSubTypes: Array.from(selectedVendorSubTypes),
      defaultCustomerSubTypes: Array.from(selectedCustomerSubTypes),
      pocIds: Array.from(selectedPocIds),
      attachments: groupAttachments,
      memberIds: Array.from(selectedMemberIds),
      // Per-partner primary-group bookkeeping. primaryMemberIds is the
      // set of partners for whom THIS group is primary; primaryInheritIds
      // is the subset whose partner-level values should be replaced by
      // this group's template at save time. The remaining primary
      // partners (in primaryMemberIds but NOT in primaryInheritIds)
      // keep their existing values intact per stakeholder spec.
      primaryMemberIds: Array.from(primaryMemberIds),
      primaryInheritMemberIds: Array.from(primaryInheritIds),
      // Include Step 3 (Template Configuration) config data
      ...(configDataRef.current || {}),
    };

    if (onPartnerCreated) {
      onPartnerCreated(data);
    }

    // Reset and close
    handleDiscard();
  }, [
    partnerName,
    isGroupNameTaken,
    groupStatus,
    groupCountry,
    groupCountryFlag,
    groupDescription,
    selectedPartnerTypes,
    selectedVendorSubTypes,
    selectedCustomerSubTypes,
    selectedPocIds,
    groupAttachments,
    selectedMemberIds,
    primaryMemberIds,
    primaryInheritIds,
    step,
    onPartnerCreated,
    handleDiscard,
  ]);

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
      let firstSelected = "vendor_rules";
      setSelectedVendorSubTypes((prev) => {
        if (prev.size === 0) return new Set(["vendor_rules"]);
        firstSelected = Array.from(prev)[0];
        return prev;
      });
      setActiveSubTypeTab(firstSelected);
    } else {
      let firstSelected = "customer_rules";
      setSelectedCustomerSubTypes((prev) => {
        if (prev.size === 0) return new Set(["customer_rules"]);
        firstSelected = Array.from(prev)[0];
        return prev;
      });
      setActiveSubTypeTab(firstSelected);
    }
    setStep(3);
  }, []);

  const handleBackFromConfig = useCallback(() => {
    if (configOnlyMode) {
      // configOnly has no Step 2 to return to — Back closes the modal.
      onOpenChange(false);
      return;
    }
    setStep(2);
  }, [configOnlyMode, onOpenChange]);

  // Form-modal sizing standard — see CreatePartnerModal for rationale.
  // Lock the height for ALL steps so:
  //   - Toggling between Group Identity (step 2) and Add Partners (step 1)
  //     keeps the modal at the same fixed size (no fluctuating chrome).
  //   - The Add Partners step's flex-1 / min-h-0 body chain has a definite
  //     parent height to resolve against, which is what lets the table
  //     scroll internally and the pagination footer stay pinned to the
  //     bottom of the modal body.
  //   - Step 3 (Configuration sub-page) keeps its existing locked-height
  //     behavior for the same reason it had it before.
  const modalBaseTransition = "transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";
  const lockHeight = true;

  const modalSizeClass = isFullScreen
    ? `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl`
    : `!fixed !top-[50%] !left-[50%] !translate-x-[-50%] !translate-y-[-50%] !w-[calc(100%-2rem)] ${modalBaseTransition} !max-w-[100%] sm:!max-w-[min(70vw,1320px)] ${lockHeight ? "!h-[100dvh] sm:!h-[90vh]" : "!max-h-[100dvh] sm:!max-h-[90vh]"} rounded-none sm:!rounded-2xl`;

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={`flex flex-col p-0 gap-0 border-0 sm:border ${modalSizeClass}`}
        hideCloseButton
        style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
      >
        <DialogTitle className="sr-only">{editMode ? "Edit Partner Group" : "Create Partner Group"}</DialogTitle>
        <DialogDescription className="sr-only">Configure the template defaults and members for this Partner Group.</DialogDescription>
        {step === 3 ? (
          /* ───────── Configuration Sub-page ───────── */
          <>
            {/* Config header bar — clean, no tabs */}
            <div className="shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
              <div className="px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  {!configOnlyMode && (
                    <button
                      onClick={handleBackFromConfig}
                      className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0"
                    >
                      <ArrowLeft className="w-4 h-4 text-slate-500" />
                    </button>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-[15px] text-foreground truncate" style={{ fontWeight: 600 }}>
                        Configure {configType === "vendor" ? "Vendor" : "Customer"}
                      </h3>
                      <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-muted text-[10px] text-slate-500 tracking-wide" style={{ fontWeight: 600 }}>
                        Step 3
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate hidden sm:block">
                      Defaults applied to every {configType === "vendor" ? "vendor" : "customer"} associated with this group
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <button
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all"
                    style={{ fontWeight: 500 }}
                  >
                    {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    {isFullScreen ? "Exit Full" : "Full View"}
                  </button>
                  <button
                    onClick={handleCancelAttempt}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all"
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
                sections={configType === "vendor" ? GROUP_VENDOR_CONFIG_SECTIONS : GROUP_CUSTOMER_CONFIG_SECTIONS}
                selectedSubTypes={configType === "vendor" ? selectedVendorSubTypes : selectedCustomerSubTypes}
                activeSubTypeTab={activeSubTypeTab}
                activeSection={configType === "vendor" ? activeConfigSection : activeCustomerConfigSection}
                onToggleSubType={configType === "vendor" ? handleToggleVendorSubType : handleToggleCustomerSubType}
                onSetActiveSubType={setActiveSubTypeTab}
                onActiveSectionChange={configType === "vendor" ? setActiveConfigSection : setActiveCustomerConfigSection}
                requiredProfileId={configType === "vendor" ? "vendor_rules" : "customer_rules"}
              />
              {/* Content area.
                  ConfigPageContent is mounted unconditionally (under the
                  overlays) so switching profiles never tears down its
                  internal state. State 1 / State 2 splashes render on top
                  via absolute positioning. */}
              <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAFBFC] relative">
                <div className="p-4">
                  <ConfigPageContent
                    sectionId={configType === "vendor" ? activeConfigSection : activeCustomerConfigSection}
                    configType={configType}
                    activeSubType={activeSubTypeTab}
                    selectedGroup={primaryGroup}
                    partnerName={partnerName}
                    configDataRef={configDataRef}
                  />
                </div>
                {(() => {
                  const isSubTypeEnabled = configType === "vendor" ? selectedVendorSubTypes.has(activeSubTypeTab) : selectedCustomerSubTypes.has(activeSubTypeTab);
                  const activeSubType = (configType === "vendor" ? VENDOR_SUB_TYPES : CUSTOMER_SUB_TYPES).find(s => s.id === activeSubTypeTab);
                  const isComingSoon = !!activeSubType?.comingSoon;
                  const subTypeLabel = activeSubType?.label;
                  const subTypeIcon = activeSubType?.icon;

                  const subTypeInfo: Record<string, string> = {
                    vendor_rules: "Global rules that apply to every partner in this group: billing, credit limit, payment terms, pricing rules, and freight. Subtypes layer on top.",
                    carrier: "Make partners in this group pickable as shipping providers on POs, SOs, and shipments, similar to FedEx or UPS. Doesn't replace the vendor or customer setup.",
                    online_vendor: "Operates through digital channels and e-commerce platforms. Set up online ordering workflows, digital catalogs, and electronic invoicing.",
                    in_store_vendor: "Supplies goods through physical retail locations and storefronts. Configure in-store pickup schedules, local delivery zones, and walk-in purchasing terms.",
                    sub_contractor: "Provides specialized contract labor, project-based work, or outsourced manufacturing. Manage work orders, project milestones, and contract agreements.",
                    service_provider: "Delivers professional, managed, or recurring services to your organization. Configure service-level agreements, billing schedules, and performance metrics.",
                    customer_rules: "Global rules applied to every customer in this group: billing, payment terms, pricing rules, and freight. Subtypes layer on top.",
                    wholesale_buyer: "Purchases goods in bulk at negotiated wholesale rates. Configure volume-based pricing tiers, minimum order quantities, and wholesale payment terms.",
                    distributor: "Resells and distributes your products across markets and regions. Set up distribution agreements, territory mapping, and margin structures.",
                    end_consumer: "The final user of your products or services. Manage direct-to-consumer pricing, warranty terms, and after-sales support channels.",
                    b2b_client: "Business entity purchasing goods or services for commercial use. Configure enterprise agreements, purchase order workflows, and net payment terms.",
                    reseller: "Authorized partner that resells your products under defined terms. Manage reseller discount structures, certification requirements, and co-branding guidelines.",
                  };
                  const profileDesc = subTypeInfo[activeSubTypeTab] || `Configure the ${subTypeLabel} profile settings.`;

                  if (isComingSoon) {
                    // Coming Soon profiles: read-only preview — no Enable CTA.
                    return (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#FAFBFC]">
                        <div className="flex flex-col items-center gap-4 text-center px-8 max-w-md animate-coming-soon-in">
                          <div className="relative">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted to-border border border-border flex items-center justify-center shadow-sm">
                              {subTypeIcon ? React.cloneElement(subTypeIcon as React.ReactElement, { className: "w-7 h-7 text-slate-400" }) : <Settings2 className="w-7 h-7 text-slate-400" />}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border-2 border-border flex items-center justify-center">
                              <Lock className="w-3 h-3 text-slate-300" />
                            </div>
                          </div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent text-primary text-[10px] tracking-wider" style={{ fontWeight: 600 }}>
                            Coming Soon
                          </span>
                          <div className="space-y-2">
                            <p className="text-[15px] text-foreground" style={{ fontWeight: 600 }}>{subTypeLabel} Profile</p>
                            <p className="text-[13px] text-slate-500 leading-relaxed max-w-sm">
                              {profileDesc}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (!isSubTypeEnabled) {
                    // Active profile that the user hasn't enabled yet — keep
                    // the rich empty state with Enable CTA so seller / carrier
                    // / buyer can be turned on from here.
                    const configCount = (configType === "vendor" ? GROUP_VENDOR_CONFIG_SECTIONS : GROUP_CUSTOMER_CONFIG_SECTIONS).length;
                    return (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#FAFBFC]">
                        <div className="flex flex-col items-center gap-5 text-center px-8 max-w-lg animate-coming-soon-in">
                          {/* Profile icon with lock indicator */}
                          <div className="relative">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted to-border border border-border flex items-center justify-center shadow-sm">
                              {subTypeIcon ? React.cloneElement(subTypeIcon as React.ReactElement, { className: "w-7 h-7 text-slate-400" }) : <Settings2 className="w-7 h-7 text-slate-400" />}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border-2 border-border flex items-center justify-center">
                              <Lock className="w-3 h-3 text-slate-300" />
                            </div>
                          </div>

                          {/* Title + description */}
                          <div className="space-y-2">
                            <p className="text-[15px] text-foreground" style={{ fontWeight: 600 }}>{subTypeLabel} Profile</p>
                            <p className="text-[13px] text-slate-500 leading-relaxed max-w-sm">
                              {profileDesc}
                            </p>
                          </div>

                          {/* What enabling unlocks */}
                          <div className="flex items-center gap-4 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <Settings2 className="w-3 h-3" />
                              {configCount} configuration sections
                            </span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
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
                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white text-[13px] shadow-md hover:bg-[#086AE6] hover:shadow-lg transition-all"
                            style={{ fontWeight: 600 }}
                          >
                            <Zap className="w-3.5 h-3.5" />
                            Enable {subTypeLabel} Profile
                          </button>
                          <p className="text-[11px] text-slate-300">You can disable this profile anytime</p>
                        </div>
                      </div>
                    );
                  }

                  // Active profile already enabled — no overlay needed.
                  // ConfigPageContent renders unconditionally above this IIFE.
                  return null;
                })()}
              </div>
            </div>

            {/* Config footer */}
            <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5 sm:rounded-b-2xl">
              {!configOnlyMode && (
                <button
                  onClick={handleBackFromConfig}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] text-slate-500 hover:text-foreground transition-colors mr-auto"
                  style={{ fontWeight: 500 }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Back</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleCancelAttempt}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white text-xs sm:text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0 cursor-pointer px-3 sm:px-4 h-8 sm:h-9"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <Button
                onClick={() => {
                  if (configOnlyMode) {
                    // Hand the config payload to the caller so it can
                    // surface the Yes/No push-prompt before persisting.
                    if (onPartnerCreated) {
                      onPartnerCreated({ ...(configDataRef.current || {}) });
                    }
                    return;
                  }
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
                  <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>{editMode ? "Edit Partner Group" : "Create Partner Group"}</h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                    {editMode
                      ? "Update the group's defaults and members. On save you'll choose whether to push the changes to associated partners or keep them at the group level only."
                      : "Set the defaults that apply to every partner associated with this group, then pick which existing partners belong to it."}
                  </p>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <button
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all"
                    style={{ fontWeight: 500 }}
                  >
                    {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    {isFullScreen ? "Exit Full" : "Full View"}
                  </button>
                  <button
                    onClick={handleCancelAttempt}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>

              {/* Step tabs — group create has two linear steps: Group Identity
                  then Add Partners. Template Configuration is a sub-page
                  launched from the Configure buttons on Identity, not a
                  linear step. */}
              <div className="flex items-center gap-4 sm:gap-6 mt-3 sm:mt-3.5 overflow-x-auto -mb-px">
                {[
                  { displayNum: 1, label: "Group Identity", shortLabel: "Identity", active: step === 2, completed: step === 1, gotoStep: 2 as const },
                  { displayNum: 2, label: "Add Partners", shortLabel: "Members", active: step === 1, completed: false, gotoStep: 1 as const },
                ].map((tab) => (
                  <div
                    key={tab.displayNum}
                    className={`relative flex items-center gap-2 pb-2.5 sm:pb-3 ${tab.gotoStep ? "cursor-pointer" : "cursor-default"}`}
                    onClick={() => { if (tab.gotoStep) setStep(tab.gotoStep); }}
                  >
                    <div
                      className={`w-[22px] h-[22px] sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-[12px] shrink-0 transition-all duration-200 ${
                        tab.completed
                          ? "bg-emerald-500 text-white"
                          : tab.active
                          ? "bg-primary text-white"
                          : "border-[1.5px] border-slate-300 text-slate-500 bg-white"
                      }`}
                      style={{ fontWeight: 600 }}
                    >
                      {tab.completed ? <Check className="w-3 h-3" /> : tab.displayNum}
                    </div>
                    <span
                      className={`text-[12px] sm:text-[13px] whitespace-nowrap transition-colors ${
                        tab.active
                          ? "text-primary"
                          : tab.completed
                          ? "text-emerald-500"
                          : "text-slate-700"
                      }`}
                      style={{ fontWeight: tab.active || tab.completed ? 600 : 500 }}
                    >
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.shortLabel}</span>
                    </span>
                    {(tab.active || tab.completed) && (
                      <div className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full ${tab.completed ? "bg-emerald-500" : "bg-primary"}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Body — step 1 (Add Partners) is its own branch so the
                wrapper stays a direct flex parent of GroupMembersStep
                (with NO intermediate auto-height div), letting its
                internal table-area + sticky pagination footer compute
                heights cleanly from the modal body's flex-1 allotment.
                Step 2 (Group Identity) keeps the original padded-scroll
                wrapper for the form. */}
            {step === 1 ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white">
                {(() => {
                  // Edit mode: vendors filter follows the active tab —
                  // Browse shows every candidate, Added narrows to the
                  // current membership set. Creation mode skips the tabs
                  // entirely (no existing membership to review yet).
                  const stepVendors = editMode && memberView === "added"
                    ? vendors.filter((v) => selectedMemberIds.has(v.id))
                    : vendors;
                  // Edit + Added + zero linked partners — show an empty
                  // state with a CTA that switches to the Browse tab so
                  // the user can pick partners to add. Avoids resizing
                  // the modal or surfacing a confusing "no matches" row
                  // when the underlying truth is "this group has no
                  // members yet." Mirrors the AddPartnersToGroupModal
                  // empty-state surface.
                  if (editMode && memberView === "added" && selectedMemberIds.size === 0) {
                    return (
                      <div className="flex flex-col flex-1 min-h-0 bg-white">
                        {/* Search + tabs strip stays mounted so the user
                            can use the toggle to switch tabs from this
                            surface (matching the Linked Partners modal
                            empty state). */}
                        <div className="px-3.5 py-2.5 border-b border-border flex items-center gap-2 shrink-0">
                          <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                            <Input
                              value={memberSearch}
                              onChange={(e) => setMemberSearch(e.target.value)}
                              placeholder="Search partners by name..."
                              className="pl-9 h-9 text-[13px]"
                            />
                          </div>
                          <div className="inline-flex items-center rounded-lg bg-muted p-0.5 shrink-0">
                            <button
                              onClick={() => setMemberView("browse")}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] text-slate-500 hover:text-slate-700 transition-all cursor-pointer"
                              style={{ fontWeight: 500 }}
                            >
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              Browse Partners
                              <span className="text-[10px] rounded-full px-1.5 py-px min-w-[16px] text-center bg-border text-slate-500" style={{ fontWeight: 600 }}>
                                {vendors.length}
                              </span>
                            </button>
                            <button
                              onClick={() => setMemberView("added")}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-foreground transition-all cursor-pointer"
                              style={{ fontWeight: 600 }}
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              Added Partners
                              <span className="text-[10px] rounded-full px-1.5 py-px min-w-[16px] text-center bg-emerald-50 text-emerald-700" style={{ fontWeight: 600 }}>
                                0
                              </span>
                            </button>
                          </div>
                        </div>
                        {/* Empty body — centered, with a CTA that drops
                            the user into Browse Partners to pick rows. */}
                        <div className="flex flex-col items-center justify-center flex-1 text-center px-6">
                          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                            <Users className="w-6 h-6 text-slate-400" />
                          </div>
                          <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>No partners added yet</p>
                          <p className="text-[12px] text-slate-500 mt-1 max-w-[320px]">
                            Pick partners from <span className="text-foreground" style={{ fontWeight: 600 }}>Browse Partners</span> to add them to this group. You can also do this later from the group's detail page.
                          </p>
                          <button
                            type="button"
                            onClick={() => setMemberView("browse")}
                            className="mt-4 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-blue-100 bg-accent text-primary text-[12px] hover:bg-blue-100 transition-colors cursor-pointer"
                            style={{ fontWeight: 600 }}
                          >
                            <Users className="w-3.5 h-3.5" />
                            Browse Partners
                          </button>
                        </div>
                      </div>
                    );
                  }
                  // In Edit + Added view, checkboxes drive a separate bulk-
                  // selection set (editAddedRemovalIds) so existing-member
                  // rows START UNCHECKED instead of pre-highlighted as
                  // "selected". Bulk Set/Remove primary and the destructive
                  // Remove-from-group action all operate on that set.
                  const isEditAdded = editMode && memberView === "added";
                  return (
                    <GroupMembersStep
                      vendors={stepVendors}
                      selectedMemberIds={isEditAdded ? editAddedRemovalIds : selectedMemberIds}
                      primaryMemberIds={primaryMemberIds}
                      onToggleMember={isEditAdded
                        ? (id) => setEditAddedRemovalIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id); else next.add(id);
                            return next;
                          })
                        : handleToggleMember
                      }
                      onTogglePrimary={handleTogglePrimaryMember}
                      onBulkSetPrimary={isEditAdded
                        ? () => {
                            if (editAddedRemovalIds.size === 0) return;
                            const ids = Array.from(editAddedRemovalIds).filter((id) => !primaryMemberIds.has(id));
                            if (ids.length === 0) return;
                            setBulkPrimarySnapshotIds(ids);
                            setBulkPrimaryConfirmOpen(true);
                          }
                        : handleBulkSetPrimary
                      }
                      onBulkRemovePrimary={isEditAdded
                        ? () => {
                            if (editAddedRemovalIds.size === 0) return;
                            const allPrimary = Array.from(editAddedRemovalIds).filter((id) => primaryMemberIds.has(id));
                            // Locked primaries (this group IS the partner's
                            // primary) stay — explain instead of silently
                            // dropping the rule-protected rows.
                            const lockedSel = allPrimary.filter((id) => lockedPrimaryIds.has(id));
                            const ids = allPrimary.filter((id) => !lockedPrimaryIds.has(id));
                            if (allPrimary.length === 0) return;
                            if (ids.length === 0) {
                              toast.error(`${lockedSel.length === 1 ? "This partner keeps" : `These ${lockedSel.length} partners keep`} this group as primary. Reassign their primary group from the partner page first.`);
                              return;
                            }
                            setPrimaryMemberIds((prev) => {
                              const next = new Set(prev);
                              ids.forEach((id) => next.delete(id));
                              return next;
                            });
                            setPrimaryInheritIds((prev) => {
                              const next = new Set(prev);
                              ids.forEach((id) => next.delete(id));
                              return next;
                            });
                            toast.success(
                              lockedSel.length > 0
                                ? `Primary marker removed from ${ids.length} partner${ids.length === 1 ? "" : "s"}. ${lockedSel.length} skipped — this group is their primary group.`
                                : `Primary marker removed from ${ids.length} partner${ids.length === 1 ? "" : "s"}.`,
                            );
                          }
                        : handleBulkRemovePrimary
                      }
                      onRowRemove={isEditAdded
                        ? (id, name) => setPendingEditRemove({ kind: "single", id, name })
                        : undefined
                      }
                      bulkRemoveMode={isEditAdded
                        ? { onBulkRemove: () => {
                            if (editAddedRemovalIds.size === 0) return;
                            setPendingEditRemove({ kind: "bulk", ids: Array.from(editAddedRemovalIds) });
                          } }
                        : undefined
                      }
                      search={memberSearch}
                      onSearchChange={setMemberSearch}
                      scope={selectedPartnerTypes}
                      hideHelperBanner
                      flush
                      alwaysShowPrimary={isEditAdded}
                      lockedPrimaryIds={lockedPrimaryIds}
                      currentGroup={editingGroupIdForLock ? { id: editingGroupIdForLock, name: partnerName || "this group" } : null}
                      toolbarExtras={editMode ? (
                        <div className="inline-flex items-center rounded-lg bg-muted p-0.5 shrink-0">
                          <button
                            onClick={() => setMemberView("browse")}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] transition-all cursor-pointer ${
                              memberView === "browse" ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-foreground" : "text-slate-500 hover:text-slate-700"
                            }`}
                            style={{ fontWeight: memberView === "browse" ? 600 : 500 }}
                          >
                            <Users className={`w-3.5 h-3.5 ${memberView === "browse" ? "text-primary" : "text-slate-400"}`} />
                            Browse Partners
                            <span
                              className={`text-[10px] rounded-full px-1.5 py-px min-w-[16px] text-center ${memberView === "browse" ? "bg-accent text-primary" : "bg-border text-slate-500"}`}
                              style={{ fontWeight: 600 }}
                            >
                              {vendors.length}
                            </span>
                          </button>
                          <button
                            onClick={() => setMemberView("added")}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] transition-all cursor-pointer ${
                              memberView === "added" ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-foreground" : "text-slate-500 hover:text-slate-700"
                            }`}
                            style={{ fontWeight: memberView === "added" ? 600 : 500 }}
                          >
                            <Check className={`w-3.5 h-3.5 ${memberView === "added" ? "text-emerald-500" : "text-slate-400"}`} />
                            Added Partners
                            <span
                              className={`text-[10px] rounded-full px-1.5 py-px min-w-[16px] text-center ${memberView === "added" ? "bg-emerald-50 text-emerald-700" : "bg-border text-slate-500"}`}
                              style={{ fontWeight: 600 }}
                            >
                              {selectedMemberIds.size}
                            </span>
                          </button>
                        </div>
                      ) : undefined}
                    />
                  );
                })()}
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto bg-[#FAFBFC] scrollbar-hide">
                <div className="px-4 pt-4 pb-4 transition-all duration-300 ease-out">
                  {/* Template-mode banner — every field on Identity is a
                      default that partners created under this group will
                      inherit. */}
                  <div className="mb-3 rounded-lg border border-[#E0E7FF] bg-[#EEF2FF] px-3.5 py-2.5 flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-white border border-[#E0E7FF] flex items-center justify-center shrink-0" style={{ color: "#4F46E5" }}>
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] text-[#312E81]" style={{ fontWeight: 600 }}>You're creating a Partner Group template</p>
                      <p className="text-[11px] text-[#4338CA] mt-0.5 leading-relaxed">
                        Every field on this screen is a default. Partners you create under this group will inherit these settings, and the user can override any of them on a per-partner basis. Leave a field blank to skip it, which simply means partners won't inherit that field.
                      </p>
                    </div>
                  </div>
                  <GroupIdentityStep
                    groupName={partnerName}
                    onGroupNameChange={setPartnerName}
                    groupStatus={groupStatus}
                    onGroupStatusChange={setGroupStatus}
                    groupCountry={groupCountry}
                    groupCountryFlag={groupCountryFlag}
                    groupCountrySearch={groupCountrySearch}
                    onGroupCountrySearchChange={setGroupCountrySearch}
                    onSelectGroupCountry={handleSelectGroupCountry}
                    groupDescription={groupDescription}
                    onGroupDescriptionChange={setGroupDescription}
                    selectedPartnerTypes={selectedPartnerTypes}
                    onPartnerTypeChange={handlePartnerTypeToggle}
                    onOpenConfigure={handleOpenConfigure}
                    selectedPocIds={selectedPocIds}
                    pocSearch={pocSearch}
                    onPocSearchChange={setPocSearch}
                    onTogglePoc={handleTogglePoc}
                    attachments={groupAttachments}
                    onAddAttachments={handleAddAttachments}
                    onRemoveAttachment={handleRemoveAttachment}
                    errors={errors}
                  />
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5 sm:rounded-b-2xl">
              {step === 2 ? (
                /* Step 1 (Group Identity) — Cancel + Continue → Members */
                <>
                  <button
                    type="button"
                    onClick={handleCancelAttempt}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white text-xs sm:text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0 cursor-pointer px-3 sm:px-5 h-8 sm:h-9"
                    style={{ fontWeight: 500 }}
                  >
                    Cancel
                  </button>
                  <Button onClick={handleContinueToMembers} className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm">
                    Continue
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : (
                /* Step 2 (Add Partners) — Back + Cancel + Create Group */
                <>
                  <button
                    onClick={handleBackToGroupSelection}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] text-slate-500 hover:text-foreground transition-colors mr-auto"
                    style={{ fontWeight: 500 }}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAttempt}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white text-xs sm:text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0 cursor-pointer px-3 sm:px-5 h-8 sm:h-9"
                    style={{ fontWeight: 500 }}
                  >
                    Cancel
                  </button>
                  <Button onClick={handleSave} className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm">
                    {editMode ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{editMode ? "Save Changes" : "Create Partner Group"}</span>
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
            <AlertTriangle className="w-8 h-8" style={{ color: "rgb(var(--destructive))" }} />
          </div>
          <span
            className="mt-4 px-3 py-1 rounded-full text-[11px]"
            style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", letterSpacing: "0.05em" }}
          >
            Discard
          </span>
        </div>
        {/* Body */}
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
            <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
              {editMode ? "Discard changes?" : "Discard group creation?"}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
            {editMode ? "All unsaved changes will be lost. This action cannot be undone." : "All the information you've entered will be lost. This action cannot be undone."}
          </AlertDialogDescription>
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              onClick={handleConfirmCancel}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
              style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
            >
              Discard Changes
            </button>
            <button
              onClick={() => setShowCancelConfirmation(false)}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
              style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
            >
              Continue Editing
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>

    {/* Unlink-from-group confirmation — fires from the Edit Added view's
        per-row X button OR the bulk "Remove N partners" toolbar action.
        Shared canonical dialog: red confirm for regular rows, amber
        "Can't unlink yet" guard when the group is the partner's primary
        (same prompts as the group details page's Linked Partners tab). */}
    <UnlinkPartnerDialog
      pending={pendingEditRemove}
      onClose={() => setPendingEditRemove(null)}
      groupName={partnerName || "this group"}
      lockedPrimaryIds={lockedPrimaryIds}
      onOpenPartner={(id) => window.open(`/vendors/${id}`, "_blank", "noopener,noreferrer")}
      onConfirm={(ids, skippedCount) => {
        if (ids.length === 0) return;
        setSelectedMemberIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        setPrimaryMemberIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        setPrimaryInheritIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        setEditAddedRemovalIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        const base = pendingEditRemove?.kind === "single"
          ? `${pendingEditRemove.name} unlinked from ${partnerName || "this group"}.`
          : `${ids.length} partner${ids.length === 1 ? "" : "s"} unlinked from ${partnerName || "this group"}.`;
        toast.success(
          skippedCount > 0
            ? `${base} ${skippedCount} primary partner${skippedCount === 1 ? "" : "s"} skipped.`
            : base,
        );
      }}
    />

    {/* Bulk Primary-Group Confirmation Dialog — fires from the toolbar
        "Set N as primary" CTA. Same warning content as the per-row
        prompt, scaled to "N partners" so the user only confirms once. */}
    <AlertDialog open={bulkPrimaryConfirmOpen} onOpenChange={(open) => { if (!open) handleCancelBulkPrimary(); }}>
      <AlertDialogContent
        className="sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
        style={{ zIndex: 220 }}
        onInteractOutside={handleCancelBulkPrimary}
      >
        <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #EBF3FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#0A77FF" }} />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#CFE6FF" }}>
            <Star className="w-8 h-8 fill-current" style={{ color: "rgb(var(--primary))" }} />
          </div>
          <span
            className="mt-4 px-3 py-1 rounded-full text-[11px]"
            style={{ fontWeight: 600, backgroundColor: "#EBF3FF", color: "#0548A3", letterSpacing: "0.05em" }}
          >
            Bulk · Set as Primary
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
            <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
              {(() => {
                const count = bulkPrimarySnapshotIds?.length ?? selectedMemberIds.size;
                return `Make ${partnerName || "this group"} the primary group for ${count} partner${count === 1 ? "" : "s"}?`;
              })()}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription className="text-[13px] mt-2 max-w-[380px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
            Some of these partners may already have payment terms, pricing rules, or other settings configured. Pick how setting primary should handle their values.
          </AlertDialogDescription>
          <div className="w-full mt-6 flex flex-col gap-2.5 text-left">
            {/* Option 1 — Inherit from this group's template. */}
            <button
              type="button"
              onClick={() => handleConfirmBulkPrimary("inherit")}
              className="w-full text-left rounded-xl border border-blue-100 bg-accent hover:bg-blue-100 transition-colors cursor-pointer p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-primary text-white shadow-[0_1px_4px_rgba(10,119,255,0.25)]">
                  <Star className="w-[18px] h-[18px] fill-current" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-primary" style={{ fontWeight: 600 }}>Set as Primary and Inherit Values from This Group</p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-slate-700 truncate">
                        Templated defaults adopt{" "}
                        <span className="text-foreground" style={{ fontWeight: 600 }}>{partnerName || "this group"}</span>'s template.
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-slate-700 truncate">
                        Going forward, new transactions resolve from the group's template.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </button>
            {/* Option 2 — Keep existing partner values. */}
            <button
              type="button"
              onClick={() => handleConfirmBulkPrimary("keepExisting")}
              className="w-full text-left rounded-xl border border-border bg-white hover:border-slate-300 hover:shadow-[0_2px_8px_-4px_rgba(0,0,0,0.06)] transition-all cursor-pointer p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-slate-100 text-slate-600">
                  <Check className="w-[18px] h-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Set as Primary but Keep Existing Values</p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-slate-600 truncate">
                        Partners are marked primary; existing settings stay untouched.
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-slate-600 truncate">
                        Example: a partner on Net 60 keeps Net 60 even if the group default is Net 30.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </button>
            <button
              onClick={handleCancelBulkPrimary}
              className="w-full h-10 text-[13px] rounded-xl border-0 cursor-pointer transition-colors mt-1"
              style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>

    {/* Primary-Group Confirmation Dialog — fires when the user marks a
        linked partner as having THIS group as their primary. Surfaces
        the override risk explicitly so they choose between the
        partner's existing settings and the group's template. */}
    <AlertDialog open={!!pendingPrimaryMember} onOpenChange={(open) => { if (!open) handleCancelPrimaryMember(); }}>
      <AlertDialogContent
        className="sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
        style={{ zIndex: 220 }}
        onInteractOutside={handleCancelPrimaryMember}
      >
        {/* Colored glow header */}
        <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #EBF3FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#0A77FF" }} />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#CFE6FF" }}>
            <Star className="w-8 h-8 fill-current" style={{ color: "rgb(var(--primary))" }} />
          </div>
          <span
            className="mt-4 px-3 py-1 rounded-full text-[11px]"
            style={{ fontWeight: 600, backgroundColor: "#EBF3FF", color: "#0548A3", letterSpacing: "0.05em" }}
          >
            Set as Primary
          </span>
        </div>
        {/* Body */}
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
            <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
              {`Make ${partnerName || "this group"} the primary group for ${pendingPrimaryMember?.name ?? "this partner"}?`}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription className="text-[13px] mt-2 max-w-[380px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
            <span className="text-foreground" style={{ fontWeight: 500 }}>{pendingPrimaryMember?.name ?? "This partner"}</span> may already have payment terms, pricing rules, or other settings configured. Pick how setting primary should handle their values.
          </AlertDialogDescription>
          <div className="w-full mt-6 flex flex-col gap-2.5 text-left">
            {/* Option 1 — Inherit from this group's template. */}
            <button
              type="button"
              onClick={() => handleConfirmPrimaryMember("inherit")}
              className="w-full text-left rounded-xl border border-blue-100 bg-accent hover:bg-blue-100 transition-colors cursor-pointer p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-primary text-white shadow-[0_1px_4px_rgba(10,119,255,0.25)]">
                  <Star className="w-[18px] h-[18px] fill-current" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-primary" style={{ fontWeight: 600 }}>Set as Primary and Inherit Values from This Group</p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-slate-700 truncate">
                        Templated defaults adopt{" "}
                        <span className="text-foreground" style={{ fontWeight: 600 }}>{partnerName || "this group"}</span>'s template.
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-slate-700 truncate">
                        Going forward, new transactions resolve from the group's template.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </button>
            {/* Option 2 — Keep existing partner values. */}
            <button
              type="button"
              onClick={() => handleConfirmPrimaryMember("keepExisting")}
              className="w-full text-left rounded-xl border border-border bg-white hover:border-slate-300 hover:shadow-[0_2px_8px_-4px_rgba(0,0,0,0.06)] transition-all cursor-pointer p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-slate-100 text-slate-600">
                  <Check className="w-[18px] h-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Set as Primary but Keep Existing Values</p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-slate-600 truncate">
                        <span className="text-foreground" style={{ fontWeight: 500 }}>{pendingPrimaryMember?.name ?? "This partner"}</span>
                        &nbsp;is marked primary; existing settings stay untouched.
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-[11px] text-slate-600 truncate">
                        Example: a partner on Net 60 keeps Net 60 even if the group default is Net 30.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </button>
            <button
              onClick={handleCancelPrimaryMember}
              className="w-full h-10 text-[13px] rounded-xl border-0 cursor-pointer transition-colors mt-1"
              style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>

    {/* Carrier Profile enable/disable confirmation — same primitive
        used in CreatePartnerModal + the partner detail page so the
        Carrier toggle reads the same on every surface. */}
    <AlertDialog open={!!pendingCarrierAction} onOpenChange={(o) => { if (!o) setPendingCarrierAction(null); }}>
      <AlertDialogContent
        className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
        style={{ zIndex: 290 }}
        onInteractOutside={() => setPendingCarrierAction(null)}
      >
        {pendingCarrierAction === "enable" ? (
          <>
            <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #ECFDF5 0%, rgba(236,253,245,0.3) 70%, transparent 100%)" }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#10B981" }} />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#D1FAE5" }}>
                <Truck className="w-8 h-8" style={{ color: "#047857" }} />
              </div>
              <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#ECFDF5", color: "#065F46", letterSpacing: "0.05em" }}>
                Enable Carrier Profile
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                  Turn on freight carrier mode for this group?
                </AlertDialogTitle>
              </AlertDialogHeader>
              <AlertDialogDescription asChild>
                <div className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                  <p>
                    Partners in this group will be pickable as a freight carrier on other partners' orders, similar to picking <span className="text-foreground" style={{ fontWeight: 600 }}>FedEx</span> or <span className="text-foreground" style={{ fontWeight: 600 }}>UPS</span>. Configure billing, payments, pricing, and shipping methods after enabling.
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px]" style={{ fontWeight: 600 }}>
                    <Info className="w-3 h-3" />
                    Doesn't replace the vendor or customer setup
                  </span>
                </div>
              </AlertDialogDescription>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    applyVendorSubTypeToggle("carrier");
                    // Land on the Carrier pane (mirrors the partner-modal
                    // flow). Without these the user bounces back to the
                    // section they were on before — the "AI glitch" Eli
                    // flagged after toggling Carrier on.
                    setActiveSubTypeTab("carrier");
                    setActiveConfigSection("shipping_methods");
                    setPendingCarrierAction(null);
                    toast.success("Carrier profile enabled for this group");
                  }}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: "#10B981", color: "#fff" }}
                >
                  Enable Carrier Profile
                </button>
                <button
                  onClick={() => setPendingCarrierAction(null)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        ) : pendingCarrierAction === "disable" ? (
          <>
            <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)" }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#F59E0B" }} />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
                <CircleSlash className="w-8 h-8" style={{ color: "#B45309" }} />
              </div>
              <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FFFBEB", color: "#92400E", letterSpacing: "0.05em" }}>
                Disable Carrier Profile
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                  Turn off freight carrier mode for this group?
                </AlertDialogTitle>
              </AlertDialogHeader>
              <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                Hidden from new orders as a freight option. In-flight shipments stay as is. The configuration is preserved, so you can turn it back on any time.
              </AlertDialogDescription>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  onClick={() => { applyVendorSubTypeToggle("carrier"); setPendingCarrierAction(null); toast.success("Carrier profile disabled for this group"); }}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: "#F59E0B", color: "#fff" }}
                >
                  Disable Carrier Profile
                </button>
                <button
                  onClick={() => setPendingCarrierAction(null)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        ) : null}
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
            ? "bg-emerald-500 text-white shadow-[0_0_0_2px_rgba(16,185,129,0.15)]"
            : isActive
            ? "bg-primary text-white shadow-[0_0_0_2px_rgba(10,119,255,0.15)]"
            : "bg-[#EEF2F6] text-slate-400"
        }`}
        style={{ fontWeight: 700 }}
      >
        {isCompleted ? <Check className="w-3 h-3" /> : stepNumber}
      </div>
      {/* Label */}
      <span
        className={`text-xs sm:text-[13px] whitespace-nowrap transition-colors ${
          isCompleted
            ? "text-emerald-500"
            : isActive
            ? "text-foreground"
            : "text-slate-400"
        }`}
        style={{ fontWeight: isActive || isCompleted ? 600 : 400 }}
      >
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{shortLabel || label}</span>
      </span>
      {/* Active underline bar */}
      {(isActive || isCompleted) && (
        <div className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full transition-all ${
          isCompleted ? "bg-emerald-500" : "bg-primary"
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
              ? "bg-accent text-primary border-primary/25"
              : "bg-slate-50 text-muted-foreground border-border hover:border-slate-300 hover:bg-muted"
          }`}
          style={{ fontWeight: 500 }}
        >
          {isPrimary && (
            <Star className="w-2.5 h-2.5 fill-primary text-primary" />
          )}
          <FlagImage code={flagEmojiCode(group.countryFlag)} className="text-[13px]" /> {group.name}
          <span
            className="text-[10px] text-slate-400"
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
        <div className="w-[280px] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border/60">
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
            <div className="flex items-center justify-between relative">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0"><FlagImage code={flagEmojiCode(group.countryFlag)} className="text-[13px]" /></span>
                <span className="text-white text-[13px] truncate" style={{ fontWeight: 600 }}>
                  {group.name}
                </span>
              </div>
              {isPrimary && (
                <PrimaryPill className="shrink-0" />
              )}
            </div>
          </div>
          <div className="bg-white px-3.5 py-3 space-y-3">
            <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-3">
              {group.description}
            </p>
            <div className="flex items-center gap-4 pt-2 border-t border-muted">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Users className="w-3 h-3 text-slate-400" />
                <span style={{ fontWeight: 500 }}>{group.memberCount} partners</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Globe className="w-3 h-3 text-slate-400" />
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
        className="inline-flex items-center px-2 py-1 rounded-lg text-[11px] border border-border bg-slate-50 text-slate-500 hover:bg-muted hover:text-muted-foreground hover:border-slate-300 transition-colors cursor-default shrink-0"
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
          <div className="w-[240px] rounded-xl border border-border/60 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden shrink-0">
            <div className="px-3 py-2 border-b border-muted bg-[#FAFBFC]">
              <span className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>
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
                      isHovered ? "bg-accent" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="shrink-0"><FlagImage code={flagEmojiCode(g.countryFlag)} className="text-[13px]" /></span>
                    <span
                      className={`text-[12px] truncate ${isHovered ? "text-primary" : "text-slate-700"}`}
                      style={{ fontWeight: 500 }}
                    >
                      {g.name}
                    </span>
                    {isPrimary && (
                      <Star className="w-2.5 h-2.5 fill-primary text-primary shrink-0" />
                    )}
                    <span className="text-[10px] text-slate-400 ml-auto shrink-0">
                      {g.memberCount}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemove(g); }}
                      className="w-4 h-4 rounded flex items-center justify-center hover:bg-black/10 transition-colors shrink-0 cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5 text-slate-400" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          {hoveredGroup && (
            <div className="shrink-0 animate-in fade-in-0 slide-in-from-left-2 duration-150">
              <div className="w-[280px] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border/60">
                <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                  <div className="flex items-center justify-between relative">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0"><FlagImage code={flagEmojiCode(hoveredGroup.countryFlag)} className="text-[13px]" /></span>
                      <span className="text-white text-[13px] truncate" style={{ fontWeight: 600 }}>
                        {hoveredGroup.name}
                      </span>
                    </div>
                    {hoveredGroup.id === primaryGroupId && (
                      <PrimaryPill className="shrink-0" />
                    )}
                  </div>
                </div>
                <div className="bg-white px-3.5 py-3 space-y-3">
                  <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-3">
                    {hoveredGroup.description}
                  </p>
                  <div className="flex items-center gap-4 pt-2 border-t border-muted">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span style={{ fontWeight: 500 }}>{hoveredGroup.memberCount} partners</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Globe className="w-3 h-3 text-slate-400" />
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

function ShippingMethodPill({
  method,
  isPrimary,
  carrierName,
  onRemove,
  onSetPrimary,
}: {
  method: { id: string; name: string; desc: string; days: string };
  isPrimary: boolean;
  carrierName: string;
  onRemove: () => void;
  onSetPrimary: () => void;
}) {
  const [open, setOpen] = useState(false);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 500ms open delay so the popover only fires on intentional hovers —
  // passing the cursor across multiple method pills no longer flashes a
  // popover cascade. The 150ms close delay stays so the user can move from
  // pill into the popover content without it disappearing on them.
  const handleEnter = useCallback(() => {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    if (enterTimer.current) return;
    enterTimer.current = setTimeout(() => {
      setOpen(true);
      enterTimer.current = null;
    }, 500);
  }, []);
  const handleLeave = useCallback(() => {
    if (enterTimer.current) { clearTimeout(enterTimer.current); enterTimer.current = null; }
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
              ? "bg-accent text-primary border-primary/25"
              : "bg-white text-slate-600 border-[#E8ECF1] hover:border-slate-300 hover:bg-muted"
          }`}
          style={{ fontWeight: 500 }}
        >
          {isPrimary && <Star className="w-2.5 h-2.5 fill-primary text-primary" />}
          <span className="truncate max-w-[180px]">{method.name}</span>
          <span className="text-[10px] text-slate-400" style={{ fontWeight: 400 }}>· {method.days}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="w-4 h-4 rounded flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors ml-0.5 cursor-pointer"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="p-0 w-auto border-0 shadow-none bg-transparent z-[300]"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div
          data-shipping-portal
          className="w-[280px] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border/60"
        >
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
            <div className="flex items-center justify-between relative gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Truck className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span className="text-white text-[13px] truncate" style={{ fontWeight: 600 }}>
                  {method.name}
                </span>
              </div>
              {isPrimary && (
                <PrimaryPill className="shrink-0" />
              )}
            </div>
            {carrierName && (
              <p className="text-[11px] text-slate-400 mt-1.5 relative">{carrierName}</p>
            )}
          </div>
          <div className="bg-white px-3.5 py-3 space-y-3">
            <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-3">
              {method.desc}
            </p>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-muted">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Clock className="w-3 h-3 text-slate-400" />
                <span style={{ fontWeight: 500 }}>{method.days}</span>
              </div>
              {!isPrimary && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSetPrimary(); }}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  <Star className="w-3 h-3" /> Set as primary
                </button>
              )}
            </div>
          </div>
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
  const [groupsPerPage, setGroupsPerPage] = useState(100);

  // Reset page when search changes or groups list changes
  useEffect(() => {
    setGroupPage(1);
  }, [search, groups.length]);

  // "All" is represented by groupsPerPage === -1.
  const effectiveGroupsPerPage = groupsPerPage === -1
    ? Math.max(1, groups.length)
    : groupsPerPage;
  const totalGroupPages = Math.max(1, Math.ceil(groups.length / effectiveGroupsPerPage));

  // Clamp page
  useEffect(() => {
    if (groupPage > totalGroupPages) {
      setGroupPage(totalGroupPages);
    }
  }, [groupPage, totalGroupPages]);

  const pagedGroups = useMemo(() => {
    const start = (groupPage - 1) * effectiveGroupsPerPage;
    return groups.slice(start, start + effectiveGroupsPerPage);
  }, [groups, groupPage, effectiveGroupsPerPage]);

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
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
            Choose one or more partner groups. Mark one as primary to inherit its configuration.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search partner groups..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-white border-border focus:border-primary focus:ring-1 focus:ring-primary/20 h-8 sm:h-9 text-sm"
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
        <div className="absolute bottom-0 left-0 right-0 h-px bg-border/60" />
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
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-slate-400 whitespace-nowrap" style={{ fontWeight: 500 }}>
                End of page {groupPage} of {totalGroupPages}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </div>
        )}

        {groups.length === 0 && (
          <div className="py-10 sm:py-14 text-center">
            <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Search className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-[13px] text-slate-700" style={{ fontWeight: 600 }}>No groups found</p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your search terms.
            </p>
          </div>
        )}

        {/* Pagination */}
        {groups.length > 0 && (
          <div className="sticky bottom-0 z-10 flex flex-col sm:flex-row items-center justify-center px-3 py-1.5 border-t border-border bg-white gap-1.5 sm:gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>Per Page</span>
              <Select
                value={groupsPerPage === -1 ? "all" : String(groupsPerPage)}
                onValueChange={(val) => {
                  setGroupsPerPage(val === "all" ? -1 : Number(val));
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
                  <SelectItem value="all">All</SelectItem>
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
          ? "border-primary/25 shadow-[0_2px_12px_rgba(10,119,255,0.10)]"
          : "border-[#E8ECF1] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-blue-200 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.10)]"
      }`}
    >
      {isApplied && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-10 shadow-sm">
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
            <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l" style={{ fontWeight: 500, borderColor: pill.border }}>
              {rule.basis === "volume" ? "Volume" : "Value"}
            </span>
          </span>
          <span className={`inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md border text-[9px] shrink-0 ${
            isCustom
              ? "border-slate-300 bg-white text-muted-foreground"
              : "bg-muted border-slate-300 text-slate-500"
          }`} style={{ fontWeight: 600 }}>
            {isCustom ? "Custom" : <><Lock className="w-2.5 h-2.5" /> Template</>}
          </span>
        </div>

        {/* Row 2: Name */}
        <div className="shrink-0 mb-1">
          <p className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{highlightMatch(rule.name, searchText || "")}</p>
        </div>

        {/* Row 3: Description */}
        <div className="h-[32px] shrink-0 mb-2">
          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed" style={{ fontWeight: 400 }}>{highlightMatch(rule.description, searchText || "")}</p>
        </div>

        {/* Row 4: Hero value + Valid period (matches the canonical
            partner-detail card pattern — VALID stack on the right
            parallel to the discount %). Falls back to "Always
            active" if the preset has no validity window. Same
            pattern as CreatePartnerModal's PrTemplateCardInner. */}
        <div className="flex items-baseline justify-between shrink-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[22px] text-foreground leading-none tracking-tight" style={{ fontWeight: 600 }}>
              {rule.tiers[0]?.discount ?? "—"}
            </span>
            <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>
              {isDis ? "off" : "markup"}
            </span>
          </div>
          <div className="flex flex-col items-end shrink-0 leading-tight">
            <span className="text-[9px] tracking-wide text-slate-400" style={{ fontWeight: 600 }}>Valid</span>
            <span className="text-[11px] text-slate-700" style={{ fontWeight: 500 }}>
              {rule.validityPeriod || "Always Active"}
            </span>
          </div>
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
                  className={`h-[22px] rounded-md text-[10px] transition-all duration-200 cursor-pointer flex items-center justify-center px-2 ${
                    isActive
                      ? "shadow-sm"
                      : "bg-muted text-slate-500 hover:bg-border"
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
          <div className="flex items-center justify-between px-3 py-[6px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] min-w-0">
            <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
              <span style={{ fontWeight: 400 }}>{shownTier?.minValue}</span>
              <span className="text-slate-300">–</span>
              <span style={{ fontWeight: 400 }}>{shownTier?.maxValue}</span>
            </div>
            <span className="shrink-0 ml-2 text-foreground" style={{ fontWeight: 600 }}>{shownTier?.discount}</span>
          </div>
        </div>
      </div>

      {/* Footer — Apply + Duplicate */}
      <div className="grid grid-cols-2 border-t border-muted shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onApply(); }}
          className="inline-flex items-center justify-center gap-1 py-2 text-[11px] text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors border-r border-muted"
          style={{ fontWeight: 500 }}
        >
          <Check className="w-3 h-3" /> Apply
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          className="inline-flex items-center justify-center gap-1 py-2 text-[11px] text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors"
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
        borderColor: isSelected ? "rgb(var(--primary))" : isHovered ? "#CBD5E1" : "rgb(var(--border))",
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
              className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-white/80 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
            </div>
            <div
              onClick={handlePrimaryClick}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isPrimary
                  ? "text-primary hover:bg-white/80"
                  : "text-slate-400 hover:text-amber-500 hover:bg-white/80"
              }`}
              title={isPrimary ? "Primary group" : "Set as primary"}
            >
              <Star className={`w-3.5 h-3.5 ${isPrimary ? "fill-primary" : ""}`} />
            </div>
          </>
        )}

        {/* Hover actions for unselected cards: eye + empty circle */}
        {!isSelected && isHovered && (
          <>
            <div
              onClick={(e) => { e.stopPropagation(); onQuickView(e); }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
            </div>
          </>
        )}

        {/* Primary badge (always visible when primary) */}
        {isPrimary && !isHovered && <PrimaryPill />}

        {/* Checkmark (always visible when selected) */}
        {isSelected && (
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}

        {/* Empty circle on hover for unselected */}
        {!isSelected && isHovered && (
          <div className="w-5 h-5 rounded-full border-2 border-slate-300 bg-white" />
        )}
      </div>

      {/* Icon */}
      <div className={`w-7 h-7 rounded-md flex items-center justify-center mb-1.5 transition-colors ${
        isSelected ? "bg-[#D6E8FF]" : "bg-muted"
      }`}>
        <Building2 className={`w-4 h-4 transition-colors ${
          isSelected ? "text-primary" : "text-slate-500"
        }`} />
      </div>

      {/* Name — no truncation, always show full text */}
      <p className="text-[13px] text-foreground pr-16 break-words" style={{ fontWeight: isSelected ? 600 : 500 }}>{highlightMatch(group.name, searchQuery || "")}</p>

      {/* Description — allow wrapping, show up to 2 lines */}
      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 pr-2 break-words">
        {highlightMatch(group.description, searchQuery || "")}
      </p>

      {/* Footer: partner count */}
      <div className="flex items-center gap-1 mt-1.5 text-[11px] text-slate-400">
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
    Active: { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0", dot: "rgb(var(--success))" },
    Inactive: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A", dot: "rgb(var(--warning))" },
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
        className="bg-white rounded-xl shadow-2xl border border-border w-[calc(100%-1rem)] sm:w-full max-w-[700px] max-h-[85vh] sm:max-h-[600px] flex flex-col animate-modal-pop mx-auto"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[13px] sm:text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
                {group.name}: Associated Vendors
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                {allVendors.length} vendor{allVendors.length !== 1 ? "s" : ""} in this group
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Search + Status Tabs */}
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
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
                className="w-full h-8 pl-8 pr-8 rounded-lg border border-border bg-slate-50 text-xs text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none transition-colors cursor-default"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-border hover:bg-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-2.5 h-2.5 text-slate-500" />
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
                      ? "bg-accent text-primary border-[#ADD1FF]"
                      : "bg-slate-50 text-slate-500 border-transparent hover:bg-muted"
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
            <span className="text-[10px] text-slate-400 tracking-wider" style={{ fontWeight: 600 }}>ID</span>
            <span className="text-[10px] text-slate-400 tracking-wider" style={{ fontWeight: 600 }}>Vendor Name</span>
            <span className="text-[10px] text-slate-400 tracking-wider hidden sm:block" style={{ fontWeight: 600 }}>Address</span>
            <span className="text-[10px] text-slate-400 tracking-wider text-right" style={{ fontWeight: 600 }}>Status</span>
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
                  className="grid grid-cols-[72px_1fr_72px] sm:grid-cols-[80px_1.2fr_1.5fr_76px] gap-2 items-center py-2.5 border-b border-muted last:border-b-0 hover:bg-slate-50 transition-colors -mx-4 sm:-mx-5 px-4 sm:px-5"
                  style={{ minHeight: VENDOR_ROW_HEIGHT }}
                >
                  <span className="text-[11px] text-primary truncate" style={{ fontWeight: 600 }}>
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
                    <span className="text-[12px] text-foreground truncate" style={{ fontWeight: 500 }}>
                      {vendor.name}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 truncate hidden sm:block">
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
                  <span className="text-[11px] text-slate-400">
                    Showing {visibleCount} of {filtered.length}, scroll for more
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-10 text-center">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mx-auto mb-2.5">
                {search ? (
                  <Search className="w-5 h-5 text-slate-400" />
                ) : (
                  <Users className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <p className="text-[13px] text-slate-700" style={{ fontWeight: 600 }}>
                {search ? "No matching vendors" : "No vendors yet"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {search
                  ? "Try adjusting your search or filter."
                  : "This group doesn't have any associated vendors."}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[#EEF2F6] px-4 sm:px-5 py-2.5 flex items-center justify-between bg-[#FAFBFC] rounded-b-xl">
          <span className="text-[11px] text-slate-400">
            {filtered.length === allVendors.length
              ? `${allVendors.length} total`
              : `${filtered.length} of ${allVendors.length} shown`}
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs text-foreground bg-white border border-border hover:bg-muted transition-colors cursor-pointer"
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
    "rgb(var(--primary))", "rgb(var(--violet))", "rgb(var(--success))", "rgb(var(--destructive))", "rgb(var(--warning))",
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
          <div className="rounded-lg bg-white border border-primary/25 shadow-[0_1px_4px_rgba(10,119,255,0.06),0_4px_12px_-2px_rgba(0,0,0,0.06)] overflow-hidden">
            {/* Header row */}
            <div className="flex items-center justify-between gap-2 px-2.5 sm:px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                      {allSelectedGroups.length} Group{allSelectedGroups.length !== 1 ? "s" : ""} Selected
                    </span>
                    {selectedGroup && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-primary/8 text-primary" style={{ fontWeight: 600 }}>
                        <Star className="w-2.5 h-2.5 fill-primary" />
                        Primary: {selectedGroup.name}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Configuration inherits from the primary group
                  </p>
                </div>
              </div>
              <button
                onClick={onEditGroup}
                className="group inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-border bg-white text-muted-foreground hover:border-primary hover:text-primary hover:bg-accent transition-all shrink-0 text-[11px] sm:text-xs cursor-pointer"
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
      <div className="rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center gap-2 bg-[#FAFBFC] rounded-t-lg">
          <div className="w-6 h-6 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
            <Info className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>Partner Details</span>
            <span className="text-[9px] sm:text-[10px] text-slate-400 tracking-wider hidden min-[480px]:inline" style={{ fontWeight: 500 }}>Required</span>
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
                {profileImage ? "Profile Photo" : "Add a Photo"}
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
                    <span className="text-border text-[11px]">·</span>
                    <button
                      type="button"
                      onClick={() => onProfileImageChange(null)}
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
                      alt="Partner profile"
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
                    <span className="text-[11px] text-slate-400 group-hover:text-primary transition-colors" style={{ fontWeight: 500 }}>Upload Photo</span>
                    <span className="text-[9px] text-slate-300">Max 5 MB</span>
                  </div>
                )}
              </div>
              {profileImage && (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => profileInputRef.current?.click()}
                    className="text-[11px] text-primary hover:text-[#086AE6] transition-colors cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    Change
                  </button>
                  <span className="text-border text-[11px]">·</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onProfileImageChange(null); }}
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
              {/* Row 1 Left: Partner Name */}
              <div>
                <Label htmlFor="create-partner-name" className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                  Partner Name<span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-partner-name"
                  placeholder="e.g. Acme Supply Co."
                  value={partnerName}
                  onChange={(e) => onPartnerNameChange(e.target.value)}
                  className="mt-1 rounded-lg border-border bg-white !h-10 text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
                {errors.partnerName && (
                  <p className="text-red-500 text-xs mt-1">{errors.partnerName}</p>
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
                <Label htmlFor="create-partner-phone" className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                  Phone Number
                </Label>
                <div className="flex items-center gap-0 mt-1">
                  <Popover open={countryPickerOpen} onOpenChange={setCountryPickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 pl-2.5 pr-1.5 !h-10 rounded-l-lg border border-r-0 border-border bg-white text-sm shrink-0 cursor-pointer hover:border-slate-300 transition-colors focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                      >
                        <span className="text-base leading-none"><FlagImage code={flagEmojiCode(selectedCountry.flag)} className="text-[13px]" /></span>
                        <span className="text-xs text-slate-700" style={{ fontWeight: 600 }}>{phoneCountryCode}</span>
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0 z-[200] rounded-xl shadow-lg border border-border" align="start" sideOffset={4}>
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
                                ? "bg-accent text-primary"
                                : "hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <span className="text-base"><FlagImage code={flagEmojiCode(c.flag)} className="text-[13px]" /></span>
                            <span className="text-sm flex-1 truncate" style={{ fontWeight: 500 }}>{c.country}</span>
                            <span className="text-xs text-slate-500" style={{ fontWeight: 500 }}>{c.code}</span>
                            {phoneCountryCode === c.code && selectedCountry.country === c.country && (
                              <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                            )}
                          </button>
                        ))}
                        {filteredCountries.length === 0 && (
                          <p className="text-xs text-slate-400 text-center py-4">No countries found</p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Input
                    id="create-partner-phone"
                    placeholder="(555) 123-4567"
                    value={partnerPhone}
                    onChange={(e) => onPartnerPhoneChange(e.target.value)}
                    className="rounded-l-none rounded-r-lg border-border bg-white !h-10 text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Row 2 Right: Website */}
              <div>
                <Label htmlFor="create-partner-website" className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                  Website
                </Label>
                <Input
                  id="create-partner-website"
                  placeholder="https://example.com"
                  value={website}
                  onChange={(e) => onWebsiteChange(e.target.value)}
                  className="mt-1 rounded-lg border-border bg-white !h-10 text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20"
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
          <div className="w-6 h-6 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
            <Users className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <span className="text-xs sm:text-[13px] text-foreground block" style={{ fontWeight: 600 }}>Partner Type</span>
            <span className="text-[10px] sm:text-[11px] text-slate-400 block mt-px">Select one or more partner classifications</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Vendor Card */}
          <div
            onClick={() => onPartnerTypeChange("vendor")}
            className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
              selectedPartnerTypes.has("vendor")
                ? "border-[#7AB8FF]/70 bg-white shadow-[0_1px_4px_rgba(10,119,255,0.06)]"
                : "border-border bg-white hover:border-blue-200 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.12)]"
            }`}
          >
            {/* Gradient hover overlay */}
            <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
              selectedPartnerTypes.has("vendor")
                ? "bg-gradient-to-br from-blue-50/50 to-transparent"
                : "bg-gradient-to-br from-accent/0 to-accent/0 group-hover:from-accent/60 group-hover:to-transparent"
            }`} />
            <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
              <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                selectedPartnerTypes.has("vendor")
                  ? "bg-gradient-to-br from-blue-100 to-blue-200 text-[#086AE6]"
                  : "bg-gradient-to-br from-accent to-blue-100 text-primary group-hover:scale-105"
              }`}>
                <Truck className="w-[18px] h-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] transition-colors duration-150 ${
                  selectedPartnerTypes.has("vendor") ? "text-blue-800" : "text-foreground group-hover:text-slate-800"
                }`} style={{ fontWeight: 600 }}>Vendor</p>
                <p className={`text-[11px] mt-0.5 truncate transition-colors duration-150 ${
                  selectedPartnerTypes.has("vendor") ? "text-[#3D98FF]" : "text-slate-400"
                }`}>Supplies goods or services</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {selectedPartnerTypes.has("vendor") && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenConfigure("vendor");
                    }}
                    className="inline-flex items-center gap-1 px-2 py-[5px] rounded-md bg-white/80 border border-[#7AB8FF]/40 text-[#086AE6] text-[11px] hover:bg-white hover:border-[#7AB8FF]/70 hover:shadow-sm transition-all duration-150 shrink-0"
                    style={{ fontWeight: 500 }}
                  >
                    <Settings2 className="w-3 h-3" />
                    <span className="hidden min-[480px]:inline">Configure</span>
                  </button>
                )}
                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                  selectedPartnerTypes.has("vendor")
                    ? "bg-[#0A77FF] shadow-[0_0_0_2px_rgba(59,130,246,0.15)]"
                    : "border-[1.5px] border-[#D1D5DB] bg-white group-hover:border-[#7AB8FF]"
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
                : "border-border bg-white hover:border-[#D5D3EC] hover:shadow-[0_4px_16px_-4px_rgba(124,58,237,0.10)]"
            }`}
          >
            {/* Gradient hover overlay */}
            <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
              selectedPartnerTypes.has("customer")
                ? "bg-gradient-to-br from-violet-50/50 to-transparent"
                : "bg-gradient-to-br from-violet-50/0 to-violet-50/0 group-hover:from-violet-50/60 group-hover:to-transparent"
            }`} />
            <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
              <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                selectedPartnerTypes.has("customer")
                  ? "bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] text-violet"
                  : "bg-gradient-to-br from-violet-50 to-[#EDE9FE] text-violet-500 group-hover:scale-105"
              }`}>
                <ShoppingCart className="w-[18px] h-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] transition-colors duration-150 ${
                  selectedPartnerTypes.has("customer") ? "text-[#5B21B6]" : "text-foreground group-hover:text-slate-800"
                }`} style={{ fontWeight: 600 }}>Customer</p>
                <p className={`text-[11px] mt-0.5 truncate transition-colors duration-150 ${
                  selectedPartnerTypes.has("customer") ? "text-[#A78BFA]" : "text-slate-400"
                }`}>Purchases goods or services</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {selectedPartnerTypes.has("customer") && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenConfigure("customer");
                    }}
                    className="inline-flex items-center gap-1 px-2 py-[5px] rounded-md bg-white/80 border border-[#C4B5FD]/40 text-violet text-[11px] hover:bg-white hover:border-[#C4B5FD]/70 hover:shadow-sm transition-all duration-150 shrink-0"
                    style={{ fontWeight: 500 }}
                  >
                    <Settings2 className="w-3 h-3" />
                    <span className="hidden min-[480px]:inline">Configure</span>
                  </button>
                )}
                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                  selectedPartnerTypes.has("customer")
                    ? "bg-violet-500 shadow-[0_0_0_2px_rgba(139,92,246,0.15)]"
                    : "border-[1.5px] border-[#D1D5DB] bg-white group-hover:border-[#C4B5FD]"
                }`}>
                  {selectedPartnerTypes.has("customer") && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Point of Contact section removed per stakeholder spec —
            Group-level contact assignment now happens at the partner
            level (each partner picks its own POCs) and at the
            location level. The group template was creating
            inheritance ambiguity, so the section is gone from both
            create and edit flows. State + handlers remain wired
            below pending a follow-up cleanup. ── */}

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
          ? "border-primary bg-[#F8FAFF] shadow-[0_0_0_3px_rgba(10,119,255,0.06)]"
          : "border-border bg-white hover:border-slate-300 hover:bg-[#FAFBFC]"
      }`}
    >
      <div className="flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-2.5 sm:py-2.5">
        {/* Checkbox */}
        <div
          className={`w-[18px] h-[18px] rounded flex items-center justify-center border-[1.5px] transition-all duration-150 shrink-0 ${
            isSelected ? "border-primary bg-primary shadow-[0_0_0_2px_rgba(10,119,255,0.12)]" : "border-slate-300 bg-white"
          }`}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 ${
          isSelected ? "bg-[#D6E8FF] text-primary" : "bg-muted text-slate-500"
        }`}>
          {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4 sm:w-5 sm:h-5" })}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <p className={`text-xs sm:text-[13px] ${isSelected ? "text-primary" : "text-foreground"}`} style={{ fontWeight: 600 }}>{label}</p>
            {isSelected && (
              <span className="inline-flex items-center px-1.5 py-px rounded-full bg-accent text-primary text-[9px] sm:text-[10px]" style={{ fontWeight: 600 }}>
                Selected
              </span>
            )}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-px hidden min-[400px]:block">{description}</p>
        </div>

        {/* Compact Configure CTA — only visible when selected */}
        {isSelected && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfigure();
            }}
            className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md border border-border text-foreground bg-white text-[11px] sm:text-xs hover:bg-slate-50 hover:border-slate-300 transition-colors shrink-0"
            style={{ fontWeight: 500 }}
          >
            <Settings2 className="w-3 h-3 text-slate-500" />
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
        <div className="w-6 h-6 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
          <Paperclip className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>Attachments</span>
          {files.length > 0 && (
            <span className="text-[10px] text-slate-500 bg-muted px-1.5 py-0.5 rounded-full" style={{ fontWeight: 500 }}>{files.length}</span>
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
            ? "border-primary bg-accent/30"
            : "border-border bg-white hover:border-slate-300 hover:bg-[#FAFBFC]"
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
            dragActive ? "bg-[#D6E8FF] text-primary" : "bg-muted text-slate-400"
          }`}>
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-foreground" style={{ fontWeight: 500 }}>
              <span className="text-primary">Click to upload</span><span className="hidden sm:inline"> or drag and drop</span>
            </p>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Images up to 10 MB. All other file types up to 100 MB</p>
          </div>
        </div>
      </div>

      {/* Uploaded files list */}
      {files.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-border bg-white hover:bg-[#FAFBFC] transition-colors group"
            >
              <span className="text-base">{getFileIcon(file.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate" style={{ fontWeight: 500 }}>{file.name}</p>
                <p className="text-[11px] text-slate-400">{file.size}</p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(file.id)}
                className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
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
  requiredProfileId = "vendor_rules",
}: {
  subTypes: VendorSubType[];
  sections: ConfigSection[];
  selectedSubTypes: Set<string>;
  activeSubTypeTab: string;
  activeSection: string;
  onToggleSubType: (id: string) => void;
  onSetActiveSubType: (id: string) => void;
  onActiveSectionChange: (id: string) => void;
  requiredProfileId?: string;
}) {
  const enabledCount = subTypes.filter(s => selectedSubTypes.has(s.id)).length;
  const requiredLabel = subTypes.find(s => s.id === requiredProfileId)?.label || "this profile";

  // Check if the required (default) profile can be disabled (only if another profile is enabled)
  const canDisableRequired = (id: string) => {
    if (id !== requiredProfileId) return true;
    return enabledCount > 1;
  };

  // Per-profile section list. Each section carries an explicit ownedBy
  // tag so we just filter by the active subtype. A section may carry a
  // titleBySubType override (e.g. "Freight & Logistics" under Vendor
  // Rules vs "Shipping Methods" under Carrier).
  const sectionsForSubType = (subTypeId: string): ConfigSection[] => {
    return sections
      .filter((s) => !s.ownedBy || s.ownedBy.includes(subTypeId))
      .map((s) => (s.titleBySubType?.[subTypeId] ? { ...s, title: s.titleBySubType[subTypeId] } : s));
  };

  return (
    <>
      {/* Mobile: horizontal scrollable nav */}
      <div className="sm:hidden shrink-0 border-b border-[#EEF2F6] bg-white overflow-x-auto scrollbar-hide">
        <nav className="flex flex-col">
          <div className="px-3 pt-2 pb-1">
            <p className="text-[10px] text-slate-400 tracking-wider" style={{ fontWeight: 600 }}>
              Profiles · {enabledCount} Active
            </p>
          </div>
          <div className="flex px-3 py-1.5 gap-1.5 min-w-max">
            {subTypes.map((subType) => {
              const isEnabled = selectedSubTypes.has(subType.id);
              const isActive = activeSubTypeTab === subType.id;
              const isComingSoon = !!subType.comingSoon;
              return (
                <button
                  key={subType.id}
                  onClick={() => onSetActiveSubType(subType.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all whitespace-nowrap shrink-0 ${
                    isActive && isEnabled
                      ? "bg-accent text-primary ring-1 ring-primary/20"
                      : isActive && !isEnabled
                      ? "bg-slate-50 text-muted-foreground ring-1 ring-border"
                      : isEnabled
                      ? "text-muted-foreground hover:bg-slate-50"
                      : "text-slate-400 hover:bg-slate-50"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                    isActive && isEnabled ? "bg-primary text-white" : isEnabled ? "bg-blue-100 text-primary" : "bg-muted text-slate-300"
                  }`}>
                    {React.cloneElement(subType.icon as React.ReactElement, { className: "w-3.5 h-3.5" })}
                  </div>
                  <span className="text-xs" style={{ fontWeight: isActive ? 600 : 500 }}>{subType.label}</span>
                  {isComingSoon ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-slate-400 tracking-wider whitespace-nowrap" style={{ fontWeight: 600 }}>Coming Soon</span>
                  ) : isEnabled ? (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-primary/10 text-primary" : "bg-[#DCFCE7] text-green-600"}`} style={{ fontWeight: 600 }}>On</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {/* Mobile config section pills — hidden when the active
              sub-type owns just one section (e.g. Carrier owns only
              Shipping Methods) so the nested row doesn't duplicate
              the sub-type card. */}
          {selectedSubTypes.has(activeSubTypeTab) && sectionsForSubType(activeSubTypeTab).length > 1 && (
            <div className="flex px-3 pb-2 gap-1 min-w-max overflow-x-auto scrollbar-hide border-t border-muted pt-1.5">
              {sectionsForSubType(activeSubTypeTab).map((section) => {
                const isActive = section.id === activeSection;
                return (
                  <button
                    key={section.id}
                    onClick={() => onActiveSectionChange(section.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] transition-all whitespace-nowrap ${
                      isActive ? "bg-primary text-white" : "text-slate-500 hover:bg-muted"
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
        <div className="px-3.5 pt-3.5 pb-2 border-b border-muted">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500 tracking-wider" style={{ fontWeight: 600 }}>Profiles</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-primary" style={{ fontWeight: 600 }}>
              {enabledCount} of {subTypes.length} Active
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Enable profiles to configure {requiredProfileId === "customer_rules" ? "customer" : "vendor"} capabilities</p>
        </div>

        <nav className="flex flex-col px-1.5 py-2 flex-1 gap-0.5">
          {subTypes.map((subType) => {
            const isEnabled = selectedSubTypes.has(subType.id);
            const isActive = activeSubTypeTab === subType.id;
            const isRequired = subType.id === requiredProfileId;
            const canToggle = !isRequired || canDisableRequired(subType.id);
            const isComingSoon = !!subType.comingSoon;
            const subTypeSections = sectionsForSubType(subType.id);

            return (
              <div key={subType.id}>
                {/* Profile card row */}
                <div
                  className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150 ${
                    isActive
                      ? isEnabled
                        ? "bg-accent ring-1 ring-primary/15"
                        : "bg-slate-50 ring-1 ring-border"
                      : "hover:bg-slate-50"
                  }`}
                  onClick={() => {
                    onSetActiveSubType(subType.id);
                    if (isEnabled) {
                      onActiveSectionChange(subTypeSections[0]?.id || activeSection);
                    }
                  }}
                >
                  {/* Profile icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150 ${
                    isActive && isEnabled
                      ? "bg-primary text-white shadow-sm"
                      : isEnabled
                      ? "bg-blue-100 text-primary"
                      : "bg-muted text-slate-400"
                  }`}>
                    {React.cloneElement(subType.icon as React.ReactElement, { className: "w-4 h-4" })}
                  </div>

                  {/* Label + status */}
                  <div className="flex-1 min-w-0">
                    <span className={`block text-[13px] truncate transition-colors duration-150 ${
                      isActive
                        ? "text-foreground"
                        : isEnabled
                        ? "text-slate-800"
                        : "text-slate-500 group-hover:text-slate-700"
                    }`} style={{ fontWeight: isActive ? 600 : isEnabled ? 500 : 400 }}>
                      {subType.label}
                    </span>
                    <span className={`text-[10px] ${
                      isComingSoon ? "text-slate-400" : isEnabled ? "text-green-600" : "text-slate-400"
                    }`} style={{ fontWeight: 500 }}>
                      {isComingSoon ? "Coming Soon" : isEnabled ? "Active" : "Inactive"}
                      {!isComingSoon && isRequired && isEnabled && enabledCount === 1 && (
                        <span className="text-primary ml-1" style={{ fontWeight: 500 }}>· Default</span>
                      )}
                    </span>
                  </div>

                  {/* Toggle switch — replaced by a "Coming soon" pill for
                      coming-soon profiles (Eli wants the full phrase). */}
                  {isComingSoon ? (
                    <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full bg-muted text-slate-400 text-[9px] tracking-wider whitespace-nowrap" style={{ fontWeight: 600 }}>
                      Coming Soon
                    </span>
                  ) : (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!canToggle && isEnabled) return;
                        onToggleSubType(subType.id);
                      }}
                      className="shrink-0"
                      title={!canToggle && isEnabled ? `Enable another profile before disabling ${requiredLabel}` : undefined}
                    >
                      <div className={`relative w-8 h-[18px] rounded-full transition-colors duration-200 cursor-pointer ${
                        isEnabled
                          ? "bg-primary"
                          : "bg-slate-300 hover:bg-slate-400"
                      } ${!canToggle && isEnabled ? "opacity-50 cursor-not-allowed" : ""}`}>
                        <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
                          isEnabled ? "left-[16px]" : "left-[2px]"
                        }`} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Nested config sections — collapsed for sub-types that
                    own a single section (Carrier → Shipping Methods only)
                    so the rail doesn't show a redundant "Carrier > Carrier"
                    style nested row. */}
                <div
                  className="overflow-hidden transition-all duration-200 ease-out"
                  style={{
                    maxHeight: isActive && isEnabled && subTypeSections.length > 1 ? `${subTypeSections.length * 36 + 12}px` : "0px",
                    opacity: isActive && isEnabled && subTypeSections.length > 1 ? 1 : 0,
                  }}
                >
                  <div className="ml-[20px] pl-[12px] border-l-[1.5px] border-border py-1 mt-0.5">
                    {subTypeSections.map((section) => {
                      const isSectionActive = isActive && isEnabled && section.id === activeSection;
                      return (
                        <button
                          key={section.id}
                          onClick={() => onActiveSectionChange(section.id)}
                          className={`group/item w-full flex items-center gap-2 px-2.5 py-[7px] rounded-md text-left transition-colors duration-150 ${
                            isSectionActive
                              ? "bg-accent"
                              : "hover:bg-muted/60"
                          }`}
                        >
                          <span className={`transition-colors duration-150 ${
                            isSectionActive
                              ? "text-primary"
                              : "text-slate-400 group-hover/item:text-slate-500"
                          }`}>
                            {React.cloneElement(section.icon as React.ReactElement, { className: "w-3.5 h-3.5" })}
                          </span>
                          <span className={`text-[12px] truncate transition-colors duration-150 ${
                            isSectionActive
                              ? "text-primary"
                              : "text-muted-foreground group-hover/item:text-slate-800"
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
        <div className="px-3.5 py-2.5 border-t border-muted">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            <Info className="w-3 h-3 inline mr-1 -mt-0.5" />
            {requiredLabel} is always required. Enable additional profiles to expand capabilities.
          </p>
        </div>
      </div>
    </>
  );
}


// ── Configuration Sub-page: Content (matches reference image) ──
//
// Exported so the Partner Group detail dialog can reuse the exact same
// configuration surface for editing — the values set during group
// creation flow back here for edit, with the same Yes/No push prompt
// driving propagation to associated partners.
export function ConfigPageContent({
  sectionId,
  configType,
  activeSubType,
  selectedGroup,
  partnerName,
  configDataRef,
}: {
  sectionId: string;
  configType: "vendor" | "customer";
  /** Which profile (sub-type) the user is currently configuring — drives
   *  per-profile copy for the shipping_methods section (Vendor Rules →
   *  "Freight & Logistics" / Carrier → "Shipping Methods"). */
  activeSubType: string;
  selectedGroup: PartnerGroup | null;
  partnerName: string;
  configDataRef: React.MutableRefObject<Record<string, unknown>>;
}) {
  const sections = configType === "vendor" ? GROUP_VENDOR_CONFIG_SECTIONS : GROUP_CUSTOMER_CONFIG_SECTIONS;
  const currentSection = sections.find((s) => s.id === sectionId) || sections[0];

  // Pull anything previously stashed by the parent into the configDataRef
  // (set during edit-mode hydration in CreatePartnerGroupModal). This lets
  // ConfigPageContent's local state lazy-init from the saved config so
  // every field round-trips when the user opens the edit dialog.
  const _seedCfg = configDataRef.current as Record<string, unknown>;
  const _seedCreditLimit = _seedCfg.configCreditLimit as {
    currency?: string;
    enforcement?: string;
    maxCreditLimit?: string;
    warningThreshold?: string;
    hardBlockRecipients?: string[];
    softWarningRecipients?: string[];
  } | undefined;
  const _seedPaymentTerm = _seedCfg.configPaymentTerm as { id?: string } | undefined;
  const _seedPricingRules = _seedCfg.configPricingRules as Array<{ id?: string }> | undefined;
  const _seedPaymentMethods = _seedCfg.configPaymentMethods as PaymentMethodEntry[] | undefined;
  const _seedBillingType = _seedCfg.configBillingType as string | undefined;

  // Local interactive state for pill/radio selections
  const [billingType, setBillingType] = useState(() => _seedBillingType || "domestic");
  const [shippingPref, setShippingPref] = useState("same_as_billing");
  const [enforcement, setEnforcement] = useState(() => _seedCreditLimit?.enforcement || "none");
  const [thresholdAlertRecipients, setThresholdAlertRecipients] = useState<Set<string>>(new Set());
  const [softWarningRecipients, setSoftWarningRecipients] = useState<Set<string>>(
    () => new Set(_seedCreditLimit?.softWarningRecipients ?? []),
  );
  const [hardBlockRecipients, setHardBlockRecipients] = useState<Set<string>>(
    () => new Set(_seedCreditLimit?.hardBlockRecipients ?? []),
  );
  // Maximum Credit Limit + Warning Threshold inputs — controlled so the
  // values round-trip through configDataRef into the edit dialog.
  const [maxCreditLimit, setMaxCreditLimit] = useState<string>(() => _seedCreditLimit?.maxCreditLimit ?? "");
  const [warningThreshold, setWarningThreshold] = useState<string>(() => _seedCreditLimit?.warningThreshold ?? "");
  // Format currency-style values with thousand separators while
  // typing — e.g. 8989000 → 8,989,000.
  const formatCreditAmount = (raw: string): string => {
    const cleaned = raw.replace(/[^\d.]/g, "");
    const firstDot = cleaned.indexOf(".");
    const intPart = firstDot === -1 ? cleaned : cleaned.slice(0, firstDot);
    const decPart = firstDot === -1 ? "" : "." + cleaned.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);
    if (!intPart) return decPart;
    return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + decPart;
  };
  
  const [paymentTerm, setPaymentTerm] = useState("net_30");
  const [pricingTier, setPricingTier] = useState("standard");
  const [shippingMethod, setShippingMethod] = useState("ground");

  // Payment Terms Presets state — lazy-init from configDataRef seed.
  const [selectedPaymentTermId, setSelectedPaymentTermId] = useState<string | null>(
    () => _seedPaymentTerm?.id ?? null,
  );
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
  const [createSmForEntry, setCreateSmForEntry] = useState<string>(""); // which shipping draft to add to
  const [createSmForCarrier, setCreateSmForCarrier] = useState<string>(""); // carrier id
  const [createSmMethods, setCreateSmMethods] = useState<Array<{
    id: string;
    name: string;
    description: string;
    minDuration: string;
    maxDuration: string;
    /** Lead-time unit — controls whether min/max read as days, weeks, or
     *  months. Defaults to "days"; ocean freight typically uses weeks. */
    leadUnit: LeadTimeUnit;
    /** Transportation mode is required at save time but starts unset so the
     *  segmented control isn't pre-biased toward Ground. */
    mode: CarrierMode | "";
    packageTypes: PackageType[];
    isDefault: boolean;
    /** UI-only — controls whether the optional Coverage block is expanded. */
    showCoverage: boolean;
    /** Packaging picker mode. "standard" shows the parcel/box/pallet pills;
     *  "custom" reveals Weight/L/W/H inputs for irregular cargo. */
    packagingMode: "standard" | "custom";
    weight: string;
    /** Unit for the weight input. Defaults to "lb"; users can switch
     *  to kg / g / oz for international or small-package shipping. */
    weightUnit: "lb" | "kg" | "g" | "oz";
    length: string;
    width: string;
    height: string;
    /** Unit for L/W/H inputs. Defaults to "in"; supports cm / mm / ft
     *  for metric or large-cargo measurements. */
    dimensionUnit: "in" | "cm" | "mm" | "ft";
  }>>([
    { id: `csm-1`, name: "", description: "", minDuration: "", maxDuration: "", leadUnit: "days", mode: "", packageTypes: [], isDefault: true, showCoverage: false, packagingMode: "standard", weight: "", weightUnit: "lb", length: "", width: "", height: "", dimensionUnit: "in" },
  ]);
  // User-created shipping methods, keyed by carrier id. Merged into the read-only
  // catalog at render time so newly created methods immediately appear in the
  // dropdown and can be selected for the current draft.
  const [customMethods, setCustomMethods] = useState<Record<string, CarrierMethodEntry[]>>(
    /* Hydrate from configDataRef.configCustomMethods (showcase or
       previously-saved record) so methods round-trip into edit. */
    () => (_seedCfg.configCustomMethods as Record<string, CarrierMethodEntry[]> | undefined) ?? {},
  );
  // When non-empty, the Create Shipping Method modal is in edit mode for this
  // existing custom method id — single-row form, save replaces in place
  // instead of appending.
  const [editingCustomMethodId, setEditingCustomMethodId] = useState<string>("");
  const [recentlyUsedMethods, setRecentlyUsedMethods] = useState<Record<string, string[]>>({
    fedex: ["fedex-air", "fedex-ground"],
    dhl: ["dhl-express"],
    ups: ["ups-next-day"],
  });
  // Add Shipping Method modal state
  const [addShippingModalOpen, setAddShippingModalOpen] = useState(false);
  const [shippingDrafts, setShippingDrafts] = useState<Array<{ id: string; carrier: string; methods: string; isDefault: boolean; primaryMethod: string }>>([]);
  // Inline error states for the Add Shipping Methods modal — replace
  // the prior toast.info / toast.error calls with red-bordered fields
  // and a small helper message under the field, matching the rest of
  // the form's validation language (Group Name etc.).
  const [shippingDraftCarrierErrors, setShippingDraftCarrierErrors] = useState<Record<string, boolean>>({});
  const [createSmNameErrors, setCreateSmNameErrors] = useState<Record<string, boolean>>({});
  const [discardShippingConfirmOpen, setDiscardShippingConfirmOpen] = useState(false);
  const [editingShippingId, setEditingShippingId] = useState<string | null>(null);
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
    const typeLabel = createPtType === "net" ? "Net" : createPtType === "prepayment" ? "Pre" : "Split";
    const badgeColor = createPtType === "net" ? "rgb(var(--primary))" : createPtType === "prepayment" ? "rgb(var(--violet))" : "rgb(var(--warning))";
    const triggerLabel = CREATE_PT_TRIGGERS.find((t) => t.id === createPtTrigger)?.label || createPtTrigger;
    // Written sentence phrases for the auto-description (no display case transforms).
    const PT_TRIGGER_PHRASES: Record<string, string> = {
      order_confirmation: "order confirmation",
      production_start: "production start",
      production_end: "production end",
      shipping: "shipping",
      delivery: "delivery",
    };
    const triggerPhrase = PT_TRIGGER_PHRASES[createPtTrigger] ?? triggerLabel;

    // Auto-generate a rich description if the user didn't provide one
    let autoDescription = "";
    if (createPtDescription.trim()) {
      autoDescription = createPtDescription.trim();
    } else {
      const durationLabel = CREATE_PT_DURATIONS.find((d) => d.id === createPtDuration)?.label || `${createPtDuration} days`;
      if (createPtType === "net") {
        autoDescription = `Payment is due ${durationLabel} after ${triggerPhrase}.`;
      } else if (createPtType === "prepayment") {
        autoDescription = `Prepayment required within ${durationLabel} of ${triggerPhrase}.`;
      } else {
        autoDescription = `Split payment term triggered on ${triggerPhrase}.`;
      }
      if (createPtApplyDiscount && createPtDiscountPercent) {
        const resolvedPeriod = createPtDiscountPeriod === "custom" ? createPtCustomDiscountPeriod : createPtDiscountPeriod;
        const discPeriodLabel = `${resolvedPeriod} days`;
        // Payment Term discounts are now percent-only (fixed-$ removed).
        autoDescription += ` ${createPtDiscountPercent}% discount if paid within ${discPeriodLabel}.`;
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

  // Hide archived terms entirely; hide inactive (disabled) terms from
  // the available-to-pick list so new partners can't adopt a disabled
  // template. Existing partners that already use a disabled term keep
  // it intact via the configData round-trip; this filter only gates
  // future selections.
  const { getStatus: getPtStatus } = usePaymentTermStatus();
  const filteredPaymentTermPresets = useMemo(() => {
    // Archived terms are hidden; inactive (disabled) terms stay visible
    // but applying them is blocked with an explanatory error.
    let terms = PAYMENT_TERM_PRESETS.filter((t) => {
      const s = getPtStatus(t.id);
      return s !== "archived";
    });
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
  }, [ptTypeFilters, ptStatusFilter, ptSearch, ptSortBy, ptSortDir, getPtStatus]);

  // Pricing Rules state — lazy-init from configDataRef seed.
  const [selectedPricingRuleIds, setSelectedPricingRuleIds] = useState<string[]>(
    () => (_seedPricingRules || []).map((r) => r.id).filter((x): x is string => typeof x === "string"),
  );
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
  /* Applies to — Specific items & categories / All items. Never defaults to All. */
  const [createPrItemScope, setCreatePrItemScope] = useState<PricingRuleItemScope>(DEFAULT_ITEM_SCOPE);
  const [createPrAllItemsConfirmOpen, setCreatePrAllItemsConfirmOpen] = useState(false);

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
  interface CpmAttachment { id: string; name: string; size: string; type: string; uploadedAt: string; }

  const [cpmSelectedItems, setCpmSelectedItems] = useState<PartnerItemData[]>([]);
  const [cpmSelectedCats, setCpmSelectedCats] = useState<InventoryCategory[]>([]);
  const [cpmAttachments, setCpmAttachments] = useState<CpmAttachment[]>([]);
  const [cpmItemSearch, setCpmItemSearch] = useState("");
  const [cpmCatSearch, setCpmCatSearch] = useState("");
  const [cpmShowItemPicker, setCpmShowItemPicker] = useState(false);
  const [cpmShowCatPicker, setCpmShowCatPicker] = useState(false);
  // Multi-select staging — gets reset whenever the picker opens, and is
  // committed in one shot via the modal's "Add Selected" button. Lets
  // users batch-pick instead of clicking-and-closing one row at a time
  // (the inline panel's behavior).

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

  function cpmRemoveItem(id: string) { setCpmSelectedItems(prev => prev.filter(i => i.id !== id)); }
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
    setCreatePrItemScope(DEFAULT_ITEM_SCOPE);
    setCreatePrAllItemsConfirmOpen(false);
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
  }

  function handleSaveNewPricingRule(confirmedAllItems = false) {
    if (!createPrName.trim()) return;
    // All items prices every item, including future ones — always confirm on purpose.
    if (createPrItemScope === "all" && !confirmedAllItems) { setCreatePrAllItemsConfirmOpen(true); return; }
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
          appliesToAllItems: createPrItemScope === "all",
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
        appliesToAllItems: createPrItemScope === "all",
      };
      customPricingRulesRef.current = [...customPricingRulesRef.current, newPreset];
      setSelectedPricingRuleIds((prev) => [...prev, newPreset.id]);
      setCreatePrModalOpen(false);
      resetCreatePrForm();
      toast.success("Pricing rule created and applied.");
    }
  }

  function handleDuplicatePricingRule(rule: PricingRulePreset) {
    // Mirrors CreatePartnerModal's canonical Duplicate flow: pre-fill
    // name + " (Copy)", description, category, basis, AND tiers (was
    // missing — tiers had to be re-entered from scratch). Plus the
    // canonical "Duplicated ... — rename and customize as needed."
    // toast so partner-group + partner-create + partner-detail all
    // behave identically when a user clicks Duplicate.
    resetCreatePrForm();
    setCreatePrName(`${rule.name} (Copy)`);
    setCreatePrDescription(rule.description);
    // Copy keeps the source's item scope; All items still asks for confirmation on save.
    if (rule.appliesToAllItems) setCreatePrItemScope("all");
    setCreatePrCategory(rule.category === "all" ? "discount" : rule.category);
    setCreatePrBasis(rule.basis);
    setCreatePrTiers(
      rule.tiers.map((t) => ({
        discount: t.discount,
        fixRate: false,
        qtyLimits: true,
        minQty: t.minValue || "",
        maxQty: t.maxValue || "",
      }))
    );
    setPricingRulesModalOpen(false);
    setPreviewPricingRuleId(null);
    setPrPreviewTab("preview");
    setCreatePrModalOpen(true);
    toast.info(`Duplicated "${rule.name}", rename and customize as needed.`);
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

  // Hide archived rules entirely; hide inactive (disabled) rules from
  // the available-to-pick list. Existing partners that already have a
  // disabled rule keep it via the configData round-trip.
  const { getStatus: getPrStatus } = usePricingRuleStatus();
  const filteredPricingRulePresets = useMemo(() => {
    let rules = allPricingRulePresets.filter((r) => getPrStatus(r.id) === "active");
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
  }, [prTypeFilters, prStatusFilter, prSearch, allPricingRulePresets, prSortBy, prSortDir, getPrStatus]);

  const selectedPricingRules = useMemo(() => {
    return selectedPricingRuleIds.map((id) =>
      allPricingRulePresets.find((r) => r.id === id)
    ).filter(Boolean) as PricingRulePreset[];
  }, [selectedPricingRuleIds, allPricingRulePresets]);

  // Billing & Shipping state — seed from configDataRef when present so
  // edit mode round-trips the user's currency choice. A group's default
  // currency is the base currency until it is set deliberately; it is never
  // inferred from the group's country (spec 4.2).
  // Seeded groups carry their currency in the template, not in configData.
  const [currency, setCurrency] = useState(() => _seedCreditLimit?.currency || selectedGroup?.template?.currency || currencyIdOf(BASE_CURRENCY));
  // Perspective-aware defaults.
  // Vendor: we receive from vendor → Ship To = our location (pl-1), Pay To = vendor (pl-3), Funded By = us (pl-7).
  // Customer: we deliver to customer → Ship To = customer location (pl-2), Pay To = us (pl-7), Funded By = customer (pl-3).
  const [shipTo, setShipTo] = useState<string | null>(configType === "customer" ? "pl-2" : "pl-1");
  const [payTo, setPayTo] = useState<string | null>(configType === "customer" ? "pl-7" : "pl-3");
  const [fundedBy, setFundedBy] = useState<string | null>(configType === "customer" ? "pl-3" : "pl-7");
  const lastConfigTypeRef = useRef(configType);
  useEffect(() => {
    if (lastConfigTypeRef.current !== configType) {
      setShipTo(configType === "customer" ? "pl-2" : "pl-1");
      setPayTo(configType === "customer" ? "pl-7" : "pl-3");
      setFundedBy(configType === "customer" ? "pl-3" : "pl-7");
      lastConfigTypeRef.current = configType;
    }
  }, [configType]);
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
  const [paymentEntries, setPaymentEntries] = useState<PaymentMethodEntry[]>(
    () => (_seedPaymentMethods as PaymentMethodEntry[] | undefined) ?? [],
  );
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentMethodType>("ach");

  // Shipping Methods state
  const _seedShipping = _seedCfg.configShipping as { carrierServices?: Array<{ name: string; description: string; minDays: number; maxDays: number; isDefault: boolean }>; vendorPreferences?: Array<{ carrier: string; methods: string[]; isDefault: boolean; primaryMethod: string }> } | undefined;
  const [carrierServices, setCarrierServices] = useState<Array<{ id: string; name: string; description: string; minDuration: number; maxDuration: number; isDefault: boolean }>>(
    () => (_seedShipping?.carrierServices ?? []).map((s, i) => ({
      id: `cs-${i}`, name: s.name, description: s.description,
      minDuration: s.minDays, maxDuration: s.maxDays, isDefault: s.isDefault,
    })),
  );
  const [vendorShippingPrefs, setVendorShippingPrefs] = useState<Array<{ id: string; carrier: string; methods: string; isDefault: boolean; primaryMethod: string }>>(
    () => (_seedShipping?.vendorPreferences ?? []).map((p, i) => ({
      id: `vp-${i}`, carrier: p.carrier,
      methods: Array.isArray(p.methods) ? p.methods.join(", ") : "",
      isDefault: p.isDefault, primaryMethod: p.primaryMethod,
    })),
  );
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

  const AVATAR_COLORS = ["rgb(var(--primary))", "rgb(var(--violet))", "rgb(var(--success))", "rgb(var(--destructive))", "rgb(var(--warning))", "#0891B2", "#4F46E5", "#BE185D", "#15803D", "#9333EA"];

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
        carrier: vp.carrier, methods: vp.methods ? vp.methods.split(",").map((m: string) => m.trim()) : [], isDefault: vp.isDefault, primaryMethod: vp.primaryMethod,
      })),
    };
    configDataRef.current = {
      configPaymentMethods: allSavedPayments,
      configPaymentTerm: ptConfig,
      configPricingRules: allPricingRules,
      configPointsOfContact: pocData,
      configCreditLimit: {
        currency,
        enforcement,
        maxCreditLimit,
        warningThreshold,
        hardBlockRecipients: Array.from(hardBlockRecipients),
        softWarningRecipients: Array.from(softWarningRecipients),
      },
      configShipping: shippingData,
      configBillingType: billingType,
      // Carrier-self methods (Mode/name/range/coverage cards) round-trip
      // here so a Carrier profile's saved methods reappear on edit.
      configCustomMethods: customMethods,
    };
  }, [paymentEntries, selectedPaymentTermPreset, selectedPricingRuleIds, selectedPocContacts, carrierServices, vendorShippingPrefs, currency, enforcement, maxCreditLimit, warningThreshold, hardBlockRecipients, softWarningRecipients, billingType, customMethods, configDataRef]);

  if (sectionId === "billing_shipping" || sectionId === "customer_billing") {
    const currencyObj = CURRENCY_OPTIONS.find((c) => c.id === currency);
    const shipToObj = PARTNER_LOCATION_ITEMS.find((i) => i.id === shipTo);
    const payToObj = PARTNER_LOCATION_ITEMS.find((i) => i.id === payTo);
    const fundedByObj = FUNDED_BY_ITEMS.find((i) => i.id === fundedBy);

    // Visual flow nodes — Partner Group only inherits Currency. Pay To, Ship To,
    // and Funded By are partner-specific (per Eli's address-is-never rule and the
    // fact that transaction-specific routing can't be templated) and are
    // therefore omitted from the Group flow entirely.
    void shipToObj; void payToObj; void fundedByObj;
    const flowNodes = [
      {
        icon: <DollarSign className="w-5 h-5" />,
        label: "Currency",
        sublabel: currencyObj ? currencyObj.label.split(", ")[0] : null,
        active: !!currencyObj,
        color: "rgb(var(--primary))",
        bgActive: "#EBF3FF",
        dataKey: "currency" as const,
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
          <span className="bg-[#FEF08A] text-foreground rounded-sm px-0.5" style={{ fontWeight: 600 }}>{text.slice(idx, idx + query.length)}</span>
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
            <div className="px-5 pt-4 pb-3 border-b border-muted">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: config.iconBg }}>{config.icon}</div>
                  <div>
                    <h3 className="text-sm text-foreground" style={{ fontWeight: 600 }}>{config.title}</h3>
                    <p className="text-[11px] text-slate-500">{config.description}</p>
                  </div>
                </div>
                <button onClick={() => { setDialogOpen(false); setDialogSearch(""); setDialogExpandedPartners(new Set()); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all"><X className="w-4 h-4" /></button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={dialogSearch} onChange={(e) => setDialogSearch(e.target.value)} placeholder="Search partners & locations..." className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" autoFocus />
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {grouped.length === 0 && orphanLocations.length === 0 ? (
                <div className="py-10 text-center">
                  <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500" style={{ fontWeight: 500 }}>No results found</p>
                  <p className="text-xs text-slate-400 mt-0.5">Try a different search term</p>
                </div>
              ) : (
                <div className="py-1">
                  {grouped.map(({ partner, locations: allLocs, matchingLocations }) => {
                    const locsToShow = hasSearch ? matchingLocations : allLocs;
                    const isPartnerSelected = selectedId === partner.id;
                    const isExpanded = hasSearch ? true : dialogExpandedPartners.has(partner.id);
                    const hasLocs = locsToShow.length > 0;
                    return (
                      <div key={partner.id} className="border-b border-slate-50 last:border-b-0">
                        <div className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50 ${isPartnerSelected ? "bg-accent/60" : ""}`}>
                          {hasLocs ? (
                            <button onClick={(e) => { e.stopPropagation(); togglePartnerExpand(partner.id); }} className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-500 hover:bg-muted transition-all shrink-0">
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          ) : <div className="w-5 h-5 shrink-0" />}
                          <PartnerLogo item={partner} size={32} />
                          <button onClick={() => { onSelect(partner.id); setDialogOpen(false); setDialogSearch(""); setDialogExpandedPartners(new Set()); }} className="flex flex-col min-w-0 flex-1 text-left">
                            <span className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{highlightMatch(partner.name, dialogSearch)}</span>
                          </button>
                          <div className="flex items-center gap-2 shrink-0">
                            {partner.isDefault && <PrimaryPill size="xs" />}
                            {hasLocs && <span className="text-[10px] text-slate-400 bg-slate-50 border border-[#E8ECF1] px-1.5 py-0.5 rounded" style={{ fontWeight: 500 }}>{locsToShow.length} loc{locsToShow.length !== 1 ? "s" : ""}</span>}
                            {isPartnerSelected && <Check className="w-4 h-4 text-primary" />}
                          </div>
                        </div>
                        {isExpanded && hasLocs && (
                          <div className="ml-9 border-l border-[#E8ECF1] bg-[#FAFBFC]/50">
                            {locsToShow.map((loc) => {
                              const isLocSelected = selectedId === loc.id;
                              return (
                                <button key={loc.id} onClick={() => { onSelect(loc.id); setDialogOpen(false); setDialogSearch(""); setDialogExpandedPartners(new Set()); }} className={`w-full flex items-center gap-3 pl-4 pr-4 py-2 text-left transition-colors hover:bg-muted ${isLocSelected ? "bg-accent/60" : ""}`}>
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>{highlightMatch(loc.name, dialogSearch)}</span>
                                    {loc.location && <span className="text-[10px] text-slate-400 hover:text-primary hover:underline transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.location!)}`, "_blank"); }}>{highlightMatch(loc.location, dialogSearch)}</span>}
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
                  {orphanLocations.length > 0 && (
                    <>
                      {grouped.length > 0 && <div className="border-t border-muted my-1" />}
                      {orphanLocations.map((loc) => {
                        const isLocSelected = selectedId === loc.id;
                        return (
                          <button key={loc.id} onClick={() => { onSelect(loc.id); setDialogOpen(false); setDialogSearch(""); setDialogExpandedPartners(new Set()); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 ${isLocSelected ? "bg-accent/60" : ""}`}>
                            <div className="w-5 h-5 shrink-0" />
                            <PartnerLogo item={loc} size={32} />
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-[13px] text-foreground truncate" style={{ fontWeight: 500 }}>{highlightMatch(loc.name, dialogSearch)}</span>
                              {loc.location && <span className="text-[10px] text-slate-400 hover:text-primary hover:underline transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.location!)}`, "_blank"); }}>{highlightMatch(loc.location, dialogSearch)}</span>}
                            </div>
                            {isLocSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
            {selectedId && (
              <div className="px-4 py-3 border-t border-muted bg-[#FAFBFC] flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] shrink-0" />
                  <span className="text-xs text-slate-700 truncate" style={{ fontWeight: 500 }}>Selected: <span style={{ fontWeight: 600 }}>{items.find(i => i.id === selectedId)?.name || ""}</span></span>
                </div>
                <button onClick={() => { setDialogOpen(false); setDialogSearch(""); setDialogExpandedPartners(new Set()); }} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs hover:bg-[#0966DB] transition-colors" style={{ fontWeight: 600 }}>Done</button>
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
          <h4 className="text-sm text-foreground" style={{ fontWeight: 700 }}>Billing & Shipping</h4>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Only <span className="text-foreground" style={{ fontWeight: 600 }}>Currency</span> is inherited from this group template. Delivery destination, payment recipient, and funding source are partner-specific and configured on each partner individually.
          </p>
        </div>

        {/* ── Visual Flow Header ── (hidden in Group flow per request; kept for future re-enable) */}
        <div className="hidden flex items-center justify-center py-5 px-2 relative" style={{ overflow: "visible" }}>
          {flowNodes.map((node, i) => {
            // Group flow only renders the Currency node; the Pay To / Ship To /
            // Funded By branches below are retained as dead arms in case this
            // fork is later re-merged with partner create.
            const partnerObj = null as (typeof PARTNER_LOCATION_ITEMS)[number] | null;
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
                    style={{ fontWeight: 700, backgroundColor: (partnerObj as PartnerLocationItem).logoColor }}
                  >
                    {(partnerObj as PartnerLocationItem).logoText}
                  </div>
                );
              }
              return node.icon;
            };

            const renderFlowHoverCard = () => {
              if (isCurrency && currencyObj) {
                const code = currencyObj.label.split(", ")[0];
                const name = currencyObj.label.split(", ")[1] || currencyObj.label;
                return (
                  <div className="w-[220px] bg-white rounded-xl border border-[#E8ECF1] shadow-lg p-3">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <FlagImage code={currencyObj.flag} style={{ fontSize: 21 }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{code} <span className="text-slate-400" style={{ fontWeight: 500 }}>· {currencyObj.symbol}</span></p>
                        <p className="text-[11px] text-slate-500 truncate">{name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-md">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="text-[10px] text-primary" style={{ fontWeight: 500 }}>Active Transaction Currency</span>
                    </div>
                  </div>
                );
              }
              if (!isCurrency && partnerObj) {
                const roleLabel = "Group Template";
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
                        <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{partnerObj.name}</p>
                        {partnerObj.location && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(partnerObj.location)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-1 mt-1 text-[10px] text-slate-500 hover:text-primary hover:underline leading-relaxed transition-colors"
                          >
                            <MapPin className="w-3 h-3 shrink-0 mt-0.5 text-slate-400" />
                            <span className="break-words">{partnerObj.location}</span>
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ backgroundColor: node.bgActive }}>
                      <span className="text-[10px]" style={{ fontWeight: 500, color: node.color }}>{roleLabel}</span>
                    </div>
                    {partnerObj.isDefault && (
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-muted">
                        <Star className="w-3 h-3 text-amber-500" />
                        <span className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>Primary Selection</span>
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
                          <span className="text-[10px] text-foreground max-w-[80px] truncate text-center" style={{ fontWeight: 600 }}>
                            {node.sublabel}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 max-w-[80px] truncate text-center" style={{ fontWeight: 500 }}>
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
                    <span className="text-[10px] text-slate-400 max-w-[80px] truncate text-center" style={{ fontWeight: 500 }}>
                      {node.label}
                    </span>
                  </div>
                )}
                {i < flowNodes.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-slate-300 mx-3 sm:mx-5 shrink-0 -mt-4" />
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

          // Every active currency (spec 2.3), searched by code, name or country.
          const currencyQuery = currencyPopoverSearch.trim().toLowerCase();
          const currencyFiltered = CURRENCY_OPTIONS.filter((c) =>
            !currencyQuery || c.label.toLowerCase().includes(currencyQuery) || (getCurrency(c.id)?.country ?? "").toLowerCase().includes(currencyQuery)
          );

          const fieldCardBase = "group relative rounded-xl border border-[#E8ECF1] bg-white hover:border-slate-300 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] transition-all duration-200 cursor-pointer";
          const disabledCardBase = "relative rounded-xl border border-dashed border-border bg-[#FAFBFC] transition-all duration-200";

          return (
            <div className="grid grid-cols-2 gap-2.5">
              {/* Currency — the only field inherited from the group template.
                  Grid stays 2-col so the card retains its original width; the
                  right column is intentionally empty. */}
              <Popover onOpenChange={(open) => { if (!open) setCurrencyPopoverSearch(""); }}>
                <PopoverTrigger asChild>
                  <div className={fieldCardBase + " p-3 flex flex-col gap-2.5"}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Currency</span>
                        <InfoTooltip>{`The default currency of every ${configType === "customer" ? "customer" : "vendor"} in this group. Each one inherits it and can override it. Until it is set, it is the base currency (${BASE_CURRENCY}).`}</InfoTooltip>
                      </div>
                      <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {currObj ? (
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 border border-primary/10 flex items-center justify-center shrink-0">
                          <FlagImage code={currObj.flag} style={{ fontSize: 21 }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{currObj.label.split(", ")[0]} <span className="text-slate-400" style={{ fontWeight: 500 }}>· {currObj.symbol}</span></p>
                          <p className="text-[11px] text-slate-500 truncate">{(currObj.label.split(", ")[1] || currObj.label)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center shrink-0">
                          <DollarSign className="w-4 h-4 text-slate-300" />
                        </div>
                        <p className="text-[12px] text-slate-400" style={{ fontWeight: 500 }}>Select currency</p>
                      </div>
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-[340px] p-0 rounded-xl border border-border shadow-lg z-[250]" align="start" sideOffset={4}>
                  <div className="p-3 shrink-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        value={currencyPopoverSearch}
                        onChange={(e) => setCurrencyPopoverSearch(e.target.value)}
                        placeholder="Search by code, name, or country…"
                        className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div
                    className="border-t border-muted overscroll-contain"
                    style={{ maxHeight: 280, overflowY: "auto" }}
                    // A Radix Dialog's scroll lock swallows wheel events on portaled
                    // popovers; scroll the list by hand so it scrolls inside Configure.
                    onWheelCapture={(e) => {
                      const el = e.currentTarget;
                      if (el.scrollHeight <= el.clientHeight) return;
                      el.scrollTop += e.deltaY;
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    {currencyFiltered.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">No results found</div>
                    ) : (
                      currencyFiltered.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setCurrency(c.id)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 ${currency === c.id ? "bg-accent/50" : ""}`}
                        >
                          <FlagImage code={c.flag} className="shrink-0 text-[13px]" />
                          <span className="w-7 text-center text-[12px] text-slate-500 shrink-0" style={{ fontWeight: 600 }}>{c.symbol}</span>
                          <span className="text-sm text-foreground truncate" style={{ fontWeight: 500 }}>{c.label}</span>
                          {currency === c.id && <Check className="w-4 h-4 text-primary ml-auto shrink-0" />}
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Pay To / Ship To / Funded By are NOT inherited from the group
                  template — they are partner-specific. Dead-coded below. */}
              {false && (
              <>
              <div
                className={fieldCardBase + " p-3 flex flex-col gap-2.5"}
                onClick={() => setPayToDialogOpen(true)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Pay To</span>
                    <InfoTooltip>{configType === "customer" ? "The entity that receives payment from this customer. Defaults to your company, since the customer pays you. Change this if payments should route to a different party, such as a billing agent or parent company." : "The entity that receives payment for this vendor's transactions. Defaults to this vendor. Change this if payments go to a different party, such as a parent company or billing agent."}</InfoTooltip>
                  </div>
                  <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {ptObj ? (
                  <div className="flex items-center gap-2.5">
                    <PartnerLogo item={ptObj} size={36} />
                    <p className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{ptObj.name}</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center shrink-0">
                      <Receipt className="w-4 h-4 text-slate-300" />
                    </div>
                    <p className="text-[12px] text-slate-400" style={{ fontWeight: 500 }}>Select recipient</p>
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
                    <Truck className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Ship To</span>
                    <InfoTooltip>{configType === "customer" ? "The default delivery destination for goods ordered by this customer. Defaults to the customer's address. Change this if items are regularly shipped to a different location." : "The default delivery destination for goods ordered from this vendor. Defaults to your company. Change this if items are regularly shipped to a different location."}</InfoTooltip>
                  </div>
                  <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {stObj ? (
                  <div className="flex items-start gap-2.5">
                    <PartnerLogo item={stObj} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{stObj.name}</p>
                      {stObj.location && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stObj.location)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] text-slate-500 hover:text-primary hover:underline flex items-start gap-1 mt-1 leading-snug transition-colors"
                        >
                          <MapPin className="w-3 h-3 shrink-0 text-slate-400 mt-[2px]" />
                          <span className="break-words">{stObj.location}</span>
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center shrink-0">
                      <Truck className="w-4 h-4 text-slate-300" />
                    </div>
                    <p className="text-[12px] text-slate-400" style={{ fontWeight: 500 }}>Select destination</p>
                  </div>
                )}
              </div>

              {/* 4. Funded By */}
              <div className={`${allowAltFunding ? fieldCardBase : disabledCardBase} p-3 flex flex-col`} onClick={allowAltFunding ? () => setFundedByDialogOpen(true) : undefined}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Landmark className={`w-3.5 h-3.5 ${allowAltFunding ? "text-slate-400" : "text-slate-300"}`} />
                    <span className={`text-[11px] ${allowAltFunding ? "text-slate-500" : "text-slate-400"}`} style={{ fontWeight: 500 }}>Funded By</span>
                    <InfoTooltip>{configType === "customer" ? "The entity that funds purchases made by this customer. Defaults to the customer. Change this only if another entity (such as a parent company or partner) is responsible for financing these transactions." : "The entity that funds purchases from this vendor. Defaults to your company. Change this only if another entity (such as a parent company or partner) is responsible for financing these transactions."}</InfoTooltip>
                  </div>
                  <Pencil className={`w-3 h-3 text-slate-300 opacity-0 ${allowAltFunding ? "group-hover:opacity-100" : ""} transition-opacity`} />
                </div>
                {/* Selection */}
                <div className={`mt-2 ${allowAltFunding ? "" : "opacity-30"}`}>
                  {fbObj ? (
                    <div className="flex items-center gap-2.5">
                      <PartnerLogo item={fbObj} size={36} />
                      <p className={`text-[13px] truncate ${allowAltFunding ? "text-foreground" : "text-slate-400"}`} style={{ fontWeight: 600 }}>{fbObj.name}</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center shrink-0">
                        <Landmark className="w-4 h-4 text-slate-300" />
                      </div>
                      <p className="text-[12px] text-slate-400" style={{ fontWeight: 500 }}>Select funding source</p>
                    </div>
                  )}
                </div>
                {/* Toggle at bottom */}
                <div className="flex items-center gap-2 mt-auto pt-2.5 mt-2.5 border-t border-muted" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={allowAltFunding}
                    onCheckedChange={(val) => { setAllowAltFunding(val); if (!val) setFundedBy("pl-7"); }}
                  />
                  <span className={`text-[11px] ${allowAltFunding ? "text-slate-500" : "text-slate-400"}`} style={{ fontWeight: 500 }}>Allow Alternative Funding Source</span>
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
                { icon: <Receipt className="w-4 h-4 text-violet-500" />, iconBg: "#F5F3FF", iconColor: "#8B5CF6", title: "Select Pay To", description: "Choose payment recipient" }
              )}

              {/* ── Funded By Dialog ── */}
              {renderPartnerSelectionDialog(
                fundedByDialogOpen, setFundedByDialogOpen,
                fundedByDialogSearch, setFundedByDialogSearch,
                FUNDED_BY_ITEMS, fundedBy, (id) => setFundedBy(id),
                { icon: <Landmark className="w-4 h-4 text-amber-500" />, iconBg: "#FFFBEB", iconColor: "#F59E0B", title: "Select Funded By", description: "Choose funding source" }
              )}
              </>
              )}
            </div>
          );
        })()}
      </div>
    );
  }

  // Payment Methods is intentionally NOT configurable at the group level —
  // payment methods are partner-specific (each partner carries its own ACH /
  // wire / card details), so the section is dropped from the group nav
  // (GROUP_VENDOR_CONFIG_SECTIONS / GROUP_CUSTOMER_CONFIG_SECTIONS) and never
  // rendered here.

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
              <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Bank Name *</Label>
              <Input value={e.bankName} onChange={(ev) => updatePaymentEntry(e.id, { bankName: ev.target.value })} placeholder="e.g. Chase Bank" className="mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
            </div>
            <div>
              <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Account Title *</Label>
              <Input value={e.accountTitle} onChange={(ev) => updatePaymentEntry(e.id, { accountTitle: ev.target.value })} placeholder="Enter account holder name" className="mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
            </div>
            <div>
              <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>{e.type === "wire" ? "Account Number/IBAN *" : "Account Number *"}</Label>
              <Input value={e.accountNumber} onChange={(ev) => updatePaymentEntry(e.id, { accountNumber: ev.target.value })} placeholder={e.type === "wire" ? "Enter account number/IBAN" : "••••••••1234"} className="mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
            </div>
            {e.type === "ach" && (
              <div>
                <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Routing Number *</Label>
                <Input value={e.routingNumber} onChange={(ev) => updatePaymentEntry(e.id, { routingNumber: ev.target.value })} placeholder="e.g. 021000021" className="mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
              </div>
            )}
            {e.type === "wire" && (
              <div>
                <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Swift Code *</Label>
                <Input value={e.swiftCode} onChange={(ev) => updatePaymentEntry(e.id, { swiftCode: ev.target.value })} placeholder="Enter swift code" className="mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
              </div>
            )}
            <div>
              <PhoneFieldWithCountry e={e} updateEntry={(id, updates) => updatePaymentEntry(id, updates)} defaultFormat={DEFAULT_FORMAT} />
            </div>
            <div>
              <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Special Instructions</Label>
              <Input value={e.specialInstructions} onChange={(ev) => updatePaymentEntry(e.id, { specialInstructions: ev.target.value })} placeholder="Enter any special instructions or notes..." className="mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
            </div>
          </>
        )}

        {/* Check fields */}
        {e.type === "check" && (
          <>
            <div>
              <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Payee Name *</Label>
              <Input value={e.payeeName} onChange={(ev) => updatePaymentEntry(e.id, { payeeName: ev.target.value })} placeholder="Enter payee name" className="mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
            </div>
            <div>
              <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Check Mailing Address *</Label>
              <Input value={e.mailingAddress} onChange={(ev) => updatePaymentEntry(e.id, { mailingAddress: ev.target.value })} placeholder="Enter mailing address" className="mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
            </div>
            <div>
              <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Bank Name</Label>
              <Input value={e.bankName} onChange={(ev) => updatePaymentEntry(e.id, { bankName: ev.target.value })} placeholder="e.g. Chase Bank" className="mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
            </div>
            <div>
              <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Account Number *</Label>
              <Input value={e.accountNumber} onChange={(ev) => updatePaymentEntry(e.id, { accountNumber: ev.target.value })} placeholder="••••••••1234" className="mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
            </div>
          </>
        )}

        {/* Credit/Debit Card fields */}
        {e.type === "card" && (
          <>
            <div>
              <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Cardholder Name *</Label>
              <Input value={e.cardholderName} onChange={(ev) => updatePaymentEntry(e.id, { cardholderName: ev.target.value })} placeholder="Enter cardholder name" className="mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
            </div>
            <div>
              <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Card Number *</Label>
              <Input value={e.cardNumber} onChange={(ev) => updatePaymentEntry(e.id, { cardNumber: ev.target.value })} placeholder="Enter card number" className="mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
            </div>
            <div>
              <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Expiry Date *</Label>
              <Input value={e.expiryDate} onChange={(ev) => updatePaymentEntry(e.id, { expiryDate: ev.target.value })} placeholder="MM/YY" className="mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
            </div>
            <div>
              <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Billing Address</Label>
              <Input value={e.billingAddress} onChange={(ev) => updatePaymentEntry(e.id, { billingAddress: ev.target.value })} placeholder="Enter billing address" className="mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
            </div>
          </>
        )}

        {/* Digital Wallet fields */}
        {e.type === "digital_wallet" && (
          <>
            <div>
              <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Wallet Provider *</Label>
              <Input value={e.walletProvider} onChange={(ev) => updatePaymentEntry(e.id, { walletProvider: ev.target.value })} placeholder="e.g. PayPal, Venmo, Stripe" className="mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
            </div>
            <div>
              <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Wallet ID/Email *</Label>
              <Input value={e.walletId} onChange={(ev) => updatePaymentEntry(e.id, { walletId: ev.target.value })} placeholder="Enter wallet ID or email" className="mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
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
              <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Recipient Name *</Label>
              <Input value={e.recipientName} onChange={(ev) => updatePaymentEntry(e.id, { recipientName: ev.target.value })} placeholder="Enter recipient name" className="mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
            </div>
            <div>
              <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Collection Point *</Label>
              <Input value={e.collectionPoint} onChange={(ev) => updatePaymentEntry(e.id, { collectionPoint: ev.target.value })} placeholder="Enter collection point or location" className="mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
            </div>
            <div>
              <PhoneFieldWithCountry e={e} updateEntry={(id, updates) => updatePaymentEntry(id, updates)} defaultFormat={DEFAULT_FORMAT} />
            </div>
          </>
        )}

        {/* Special Instructions (for types that don't already show it) */}
        {(e.type === "card" || e.type === "digital_wallet" || e.type === "cash") && (
          <div>
            <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Special Instructions</Label>
            <Input value={e.specialInstructions} onChange={(ev) => updatePaymentEntry(e.id, { specialInstructions: ev.target.value })} placeholder="Enter any special instructions or notes..." className="mt-1.5 rounded-lg border-border !h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
          </div>
        )}

        {/* Discount / Additional Charges checkbox */}
        <div className="pt-1 border-t border-border">
          <div
            className="flex items-center gap-2.5 cursor-pointer select-none pt-3 group/disc"
            onClick={() => updatePaymentEntry(e.id, { applyDiscount: !e.applyDiscount })}
          >
            <div
              className={`w-[16px] h-[16px] rounded-[4px] flex items-center justify-center shrink-0 transition-colors ${
                e.applyDiscount ? "bg-primary" : "border-[1.5px] border-slate-300 bg-white group-hover/disc:border-slate-400"
              }`}
            >
              {e.applyDiscount && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
            </div>
            <span className="text-xs text-slate-700" style={{ fontWeight: 500 }}>Apply Discount Terms or Additional Charges</span>
          </div>
        </div>

        {/* Discount fields */}
        {e.applyDiscount && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Discount</Label>
                <PctAmountToggle
                  isFixed={(e.discountMode ?? "percent") === "fixed"}
                  onChange={(fixed) => updatePaymentEntry(e.id, { discountMode: fixed ? "fixed" : "percent" })}
                  percentTooltip="Discount applied as a percentage of the transaction amount."
                  amountTooltip="Discount applied as a fixed dollar amount."
                />
              </div>
              <div className="relative mt-1.5">
                {(e.discountMode ?? "percent") === "fixed" && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                )}
                <Input value={e.discountPercent} onChange={(ev) => updatePaymentEntry(e.id, { discountPercent: ev.target.value })} placeholder={`e.g. ${(e.discountMode ?? "percent") === "percent" ? "5" : "25.00"}`} className={`rounded-lg border-border h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 ${(e.discountMode ?? "percent") === "fixed" ? "pl-7 pr-3" : "pr-8"}`} />
                {(e.discountMode ?? "percent") === "percent" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-500" style={{ fontWeight: 500 }}>Add. Charges</Label>
                <PctAmountToggle
                  isFixed={(e.additionalChargesMode ?? "percent") === "fixed"}
                  onChange={(fixed) => updatePaymentEntry(e.id, { additionalChargesMode: fixed ? "fixed" : "percent" })}
                  percentTooltip="Additional charges added as a percentage of the transaction amount."
                  amountTooltip="Additional charges added as a fixed dollar amount."
                />
              </div>
              <div className="relative mt-1.5">
                {(e.additionalChargesMode ?? "percent") === "fixed" && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                )}
                <Input value={e.additionalCharges} onChange={(ev) => updatePaymentEntry(e.id, { additionalCharges: ev.target.value })} placeholder={`e.g. ${(e.additionalChargesMode ?? "percent") === "percent" ? "2" : "50.00"}`} className={`rounded-lg border-border h-10 bg-white text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 ${(e.additionalChargesMode ?? "percent") === "fixed" ? "pl-7 pr-3" : "pr-8"}`} />
                {(e.additionalChargesMode ?? "percent") === "percent" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
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
          <h4 className="text-sm text-foreground" style={{ fontWeight: 700 }}>Payment Methods</h4>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            {configType === "customer"
              ? "Default methods we accept for incoming payments, such as bank transfer, card, or digital wallet. Every customer created under this template inherits this list and uses it when processing receipts on sales orders and invoices. Partners can add or remove methods on their own record. "
              : "Default methods used for outgoing payments to this vendor type, such as bank transfer, card, or digital wallet. Every vendor created under this template inherits this list and uses it when processing payments on purchase orders and invoices. Partners can add or remove methods on their own record. "}
            <span className="text-primary inline-flex items-center gap-0.5 cursor-pointer hover:underline" style={{ fontWeight: 500 }}>
              Learn More <ExternalLink className="w-3 h-3" />
            </span>
          </p>
        </div>

        {/* ── Two Column Layout ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* ���─ Left Column: Payment Type Cards ── */}
          <div className="rounded-lg border border-[#E8ECF1] bg-white p-3 space-y-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h5 className="text-xs text-slate-500" style={{ fontWeight: 600 }}>Select Payment Type</h5>

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
                        ? "bg-white border-[1.5px] border-primary shadow-[0_1px_4px_rgba(10,119,255,0.1)]"
                        : "bg-white border border-[#E8ECF1] hover:border-slate-300"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${isSelected ? "bg-accent" : "bg-slate-50"}`}>
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-primary" : "text-slate-500"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] truncate ${isSelected ? "text-primary" : "text-foreground"}`} style={{ fontWeight: 600 }}>{t.label}</p>
                      <p className="text-[11px] text-slate-400 truncate">{t.description}</p>
                    </div>
                    {count > 0 && (
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] shrink-0 ${
                        isSelected ? "bg-primary text-white" : "bg-muted text-slate-500"
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
                <p className="text-[11px] text-slate-500 mb-2" style={{ fontWeight: 600 }}>Saved {typeLabel(selectedPaymentType)}</p>
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
                              ? "bg-accent border border-primary/30 shadow-[0_1px_4px_rgba(10,119,255,0.08)]"
                              : "bg-white border border-[#E8ECF1] hover:bg-slate-50"
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${isActive && !isEditingPayment ? "bg-primary/10" : "bg-muted"}`}>
                            <PeIcon className={`w-3.5 h-3.5 ${isActive && !isEditingPayment ? "text-primary" : "text-slate-500"}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className={`text-[12px] block truncate ${isActive && !isEditingPayment ? "text-primary" : "text-foreground"}`} style={{ fontWeight: 600 }}>
                              #{idx + 1} {pe.bankName || pe.payeeName || pe.cardholderName || pe.walletProvider || pe.recipientName || typeLabel(pe.type)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={(ev) => { ev.stopPropagation(); editPaymentEntry(pe.id); }}
                              className="p-1 rounded hover:bg-accent transition-colors"
                            >
                              <Pencil className="w-3 h-3 text-slate-400 hover:text-primary" />
                            </button>
                            <button
                              onClick={(ev) => { ev.stopPropagation(); removePaymentEntry(pe.id); }}
                              className="p-1 rounded hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
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
                  <h5 className="text-[13px] text-slate-500" style={{ fontWeight: 600 }}>
                    {entry.isSaved ? "Edit" : "New"} {typeLabel(entry.type)}
                  </h5>
                  <button onClick={cancelPaymentEdit} className="text-xs text-slate-500 hover:text-foreground" style={{ fontWeight: 500 }}>Cancel</button>
                </div>
                {renderFormFields(entry)}

                {/* Save / Update CTA */}
                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => savePaymentEntry(entry.id)}
                    className="px-3.5 py-2 rounded-lg bg-primary text-white text-xs hover:bg-[#086AE6] transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    {entry.isSaved ? "Update" : "Save"}
                  </button>
                  <button
                    onClick={cancelPaymentEdit}
                    className="px-3 py-2 rounded-lg border border-border bg-white text-xs text-slate-500 hover:bg-muted transition-colors"
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
                  <h5 className="text-[13px] text-slate-500" style={{ fontWeight: 600 }}>
                    {typeLabel(entry.type)} Details
                  </h5>
                  <button
                    onClick={() => editPaymentEntry(entry.id)}
                    className="flex items-center gap-1 text-primary text-xs hover:underline"
                    style={{ fontWeight: 600 }}
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                </div>

                {/* Summary fields */}
                <div className="space-y-3">
                  {(entry.type === "wire" || entry.type === "ach") && (
                    <>
                      {entry.bankName && <div><p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Bank Name</p><p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 500 }}>{entry.bankName}</p></div>}
                      {entry.accountTitle && <div><p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Account Title</p><p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 500 }}>{entry.accountTitle}</p></div>}
                      {entry.accountNumber && <div><p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>{entry.type === "wire" ? "Account Number/IBAN" : "Account Number"}</p><p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 500 }}>•��••{entry.accountNumber.slice(-4)}</p></div>}
                      {entry.type === "ach" && entry.routingNumber && <div><p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Routing Number</p><p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 500 }}>{entry.routingNumber}</p></div>}
                      {entry.type === "wire" && entry.swiftCode && <div><p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Swift Code</p><p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 500 }}>{entry.swiftCode}</p></div>}
                    </>
                  )}
                  {entry.type === "check" && (
                    <>
                      {entry.payeeName && <div><p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Payee Name</p><p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 500 }}>{entry.payeeName}</p></div>}
                      {entry.mailingAddress && <div><p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Mailing Address</p><p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 500 }}>{entry.mailingAddress}</p></div>}
                      {entry.accountNumber && <div><p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Account Number</p><p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 500 }}>••••{entry.accountNumber.slice(-4)}</p></div>}
                    </>
                  )}
                  {entry.type === "card" && (
                    <>
                      {entry.cardholderName && <div><p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Cardholder</p><p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 500 }}>{entry.cardholderName}</p></div>}
                      {entry.cardNumber && <div><p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Card Number</p><p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 500 }}>••••{entry.cardNumber.slice(-4)}</p></div>}
                      {entry.expiryDate && <div><p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Expiry</p><p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 500 }}>{entry.expiryDate}</p></div>}
                    </>
                  )}
                  {entry.type === "digital_wallet" && (
                    <>
                      {entry.walletProvider && <div><p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Provider</p><p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 500 }}>{entry.walletProvider}</p></div>}
                      {entry.walletId && <div><p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Wallet ID/Email</p><p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 500 }}>{entry.walletId}</p></div>}
                    </>
                  )}
                  {entry.type === "cash" && (
                    <>
                      {entry.recipientName && <div><p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Recipient</p><p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 500 }}>{entry.recipientName}</p></div>}
                      {entry.collectionPoint && <div><p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Collection Point</p><p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 500 }}>{entry.collectionPoint}</p></div>}
                    </>
                  )}
                  {entry.phone && <div><p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Phone</p><p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 500 }}>{entry.countryCode} {entry.phone}</p></div>}
                  {entry.applyDiscount && (
                    <div className="flex gap-4">
                      {entry.discountPercent && <div><p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Discount</p><p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 500 }}>{(entry.discountMode ?? "percent") === "fixed" ? "$" : ""}{entry.discountPercent}{(entry.discountMode ?? "percent") === "percent" ? "%" : ""}</p></div>}
                      {entry.additionalCharges && <div><p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Add. Charges</p><p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 500 }}>{(entry.additionalChargesMode ?? "percent") === "fixed" ? "$" : ""}{entry.additionalCharges}{(entry.additionalChargesMode ?? "percent") === "percent" ? "%" : ""}</p></div>}
                    </div>
                  )}
                </div>

                {/* Add another */}
                <div className="pt-2 border-t border-border">
                  <button
                    onClick={() => addPaymentEntry(selectedPaymentType)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-primary text-xs hover:bg-blue-100 transition-colors border border-blue-100"
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
                <h5 className="text-xs text-slate-500" style={{ fontWeight: 600 }}>Payment Details</h5>
                <div className="flex flex-col items-center justify-center py-5 text-center">
                  <div className="w-10 h-10 rounded-lg bg-slate-50 border border-[#E8ECF1] flex items-center justify-center mb-2">
                    <CreditCard className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-500" style={{ fontWeight: 500 }}>No payment method added yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 max-w-[220px]">Select a type on the left, then add details.</p>
                  <button
                    onClick={() => addPaymentEntry(selectedPaymentType)}
                    className="mt-3 px-3.5 py-2 rounded-lg bg-accent text-primary text-xs hover:bg-blue-100 transition-colors flex items-center gap-1.5 border border-blue-100"
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
    // The limit is in the group's currency, set once in Billing & Shipping.
    const creditCurrency = currencyCodeOf(currency) ?? BASE_CURRENCY;

    return (
      <div className="space-y-4">
        {/* Section header */}
        <div>
          <h4 className="text-sm text-foreground" style={{ fontWeight: 700 }}>Credit Limit</h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {configType === "customer"
              ? "Default credit ceiling extended to every customer created under this template, plus the over-limit behaviour (block / warn / allow). Caps how much credit you grant before holds kick in on new sales orders. Each customer can override on their own configuration."
              : "Default cap on the outstanding balance carried with every vendor created under this template, plus the over-limit behaviour. Limits how much you can owe before new POs are held. Each vendor can override on their own configuration."}
          </p>
        </div>

        {/* ── Currency & Limit Row ── */}
        <div className="rounded-xl border border-border bg-card shadow-sm p-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Currency — inherited from Billing & Shipping (read-only), so
                the group has one currency everywhere. */}
            <div>
              <Label className="text-xs text-foreground" style={{ fontWeight: 600 }}>Currency</Label>
              <div className="mt-1.5 h-10 px-3 rounded-lg border border-border bg-muted/40 flex items-center gap-2 text-sm text-foreground">
                <CurrencyFlag code={creditCurrency} />
                <span style={{ fontWeight: 600 }}>{creditCurrency}</span>
                <span className="text-slate-600 truncate">{getCurrency(creditCurrency)?.name}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Inherited from Billing &amp; Shipping. Change it there to keep all financials aligned.</p>
            </div>
            {/* Maximum Credit Limit */}
            <div>
              <Label className="text-xs text-foreground" style={{ fontWeight: 600 }}>Maximum Credit Limit</Label>
              <div className="relative mt-1.5">
                <div className="absolute left-0 top-0 bottom-0 min-w-10 px-2 rounded-l-lg bg-muted/60 border-r border-border flex items-center justify-center">
                  <CurrencySymbol code={creditCurrency} className="text-xs text-muted-foreground font-medium" />
                </div>
                <Input
                  value={maxCreditLimit}
                  onChange={(e) => setMaxCreditLimit(formatCreditAmount(e.target.value))}
                  inputMode="decimal"
                  placeholder="50,000.00"
                  className="pl-14 rounded-lg border-border !h-10 bg-white text-sm placeholder:text-slate-400"
                />
              </div>
              <BaseCurrencyPreview raw={maxCreditLimit} fromCode={creditCurrency} />
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
                  ? "border-primary/30 shadow-sm"
                  : "border-border hover:border-primary/20 shadow-sm hover:shadow-md"
              }`}
            >
              <div className="p-3.5 flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    enforcement === "none" ? "bg-accent" : "bg-muted"
                  }`}>
                    <Info className={`w-4 h-4 ${enforcement === "none" ? "text-primary" : "text-slate-400"}`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] px-1.5 py-[1px] rounded-full bg-accent text-primary border border-primary/15" style={{ fontWeight: 600 }}>Recommended</span>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      enforcement === "none" ? "border-primary/60" : "border-slate-300"
                    }`}>
                      {enforcement === "none" && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-foreground" style={{ fontWeight: 600 }}>No Enforcement</p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">No action when exceeded. A passive "Over Limit" label appears on the {configType === "customer" ? "sales order" : "purchase order"} as an indicator only.</p>
              </div>
            </button>

            {/* ── Soft Warning Card ── */}
            <button
              onClick={() => setEnforcement("soft_warning")}
              className={`text-left rounded-xl border transition-all flex flex-col overflow-hidden bg-white ${
                enforcement === "soft_warning"
                  ? "border-[#EAB308]/30 shadow-sm"
                  : "border-border hover:border-[#EAB308]/20 shadow-sm hover:shadow-md"
              }`}
            >
              <div className="p-3.5 flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    enforcement === "soft_warning" ? "bg-[#FEFCE8]" : "bg-muted"
                  }`}>
                    <AlertTriangle className={`w-4 h-4 ${enforcement === "soft_warning" ? "text-[#CA8A04]" : "text-slate-400"}`} />
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    enforcement === "soft_warning" ? "border-[#EAB308]/60" : "border-slate-300"
                  }`}>
                    {enforcement === "soft_warning" && <div className="w-2 h-2 rounded-full bg-[#EAB308]" />}
                  </div>
                </div>
                <p className="text-xs text-foreground" style={{ fontWeight: 600 }}>Soft Warning</p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">A confirmation prompt is shown before the {configType === "customer" ? "sales order" : "purchase order"} can proceed. The user must acknowledge to continue.</p>
              </div>
            </button>

            {/* ── Hard Block Card ── */}
            <button
              onClick={() => setEnforcement("hard_block")}
              className={`text-left rounded-xl border transition-all flex flex-col overflow-hidden bg-white ${
                enforcement === "hard_block"
                  ? "border-red-500/40 shadow-sm"
                  : "border-border hover:border-red-500/20 shadow-sm hover:shadow-md"
              }`}
            >
              <div className="p-3.5 flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    enforcement === "hard_block" ? "bg-red-50" : "bg-muted"
                  }`}>
                    <Lock className={`w-4 h-4 ${enforcement === "hard_block" ? "text-red-500" : "text-slate-400"}`} />
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    enforcement === "hard_block" ? "border-red-500/60" : "border-slate-300"
                  }`}>
                    {enforcement === "hard_block" && <div className="w-2 h-2 rounded-full bg-red-500" />}
                  </div>
                </div>
                <p className="text-xs text-foreground" style={{ fontWeight: 600 }}>Hard Block</p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{configType === "customer" ? "Sales orders" : "Purchase orders"} cannot be placed when the limit is exceeded. Blocked until the balance is resolved.</p>
              </div>
            </button>
          </div>

          {/* ── Contextual settings for selected enforcement ── */}
          {enforcement === "hard_block" && (
            <div className="mt-3 rounded-xl border border-red-500/15 bg-white shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs text-foreground" style={{ fontWeight: 600 }}>Hard Block Settings</span>
              </div>
              <SearchableUserPicker
                selectedIds={hardBlockRecipients}
                onSelectionChange={setHardBlockRecipients}
                accentColor="#EF4444"
                accentBg="#FEF2F2"
                accentBorder="#FECACA"
                accentText="#991B1B"
                label="Notify When Credit Limit Is Exceeded"
              />
            </div>
          )}

          {enforcement === "soft_warning" && (
            <div className="mt-3 rounded-xl border border-[#EAB308]/15 bg-white shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-[#CA8A04]" />
                <span className="text-xs text-foreground" style={{ fontWeight: 600 }}>Soft Warning Settings</span>
              </div>
              {/* Warning Threshold */}
              <div>
                <Label className="text-xs text-foreground" style={{ fontWeight: 600 }}>Warning Threshold</Label>
                <div className="relative mt-1.5">
                  <div className="absolute left-0 top-0 bottom-0 w-10 rounded-l-lg bg-slate-50 border-r border-border flex items-center justify-center">
                    <span className="text-xs text-slate-400 font-medium">%</span>
                  </div>
                  <Input
                    value={warningThreshold}
                    onChange={(e) => setWarningThreshold(e.target.value)}
                    placeholder="80"
                    className="pl-12 rounded-lg border-border !h-10 bg-white text-sm placeholder:text-slate-400"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Alert triggers at this % of credit limit</p>
              </div>
              <SearchableUserPicker
                selectedIds={softWarningRecipients}
                onSelectionChange={setSoftWarningRecipients}
                accentColor="#CA8A04"
                accentBg="#FEFCE8"
                accentBorder="#FDE68A"
                accentText="#854D0E"
                label="Notify When Warning Threshold Is Reached"
              />
            </div>
          )}

          {enforcement === "none" && (
            <div className="mt-3 rounded-xl border border-primary/15 bg-white shadow-sm p-3.5">
              <div className="flex items-center gap-2.5">
                <Info className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs text-slate-500">No action is taken when the credit limit is exceeded. An "Over Limit" label appears on the {configType === "customer" ? "sales order" : "purchase order"} as a passive indicator only.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-[10px] text-muted-foreground">All fields are optional. Leave empty if credit is not tracked for this {configType}.</p>
      </div>
    );
  }

  if (sectionId === "payment_terms" || sectionId === "customer_payment_terms") {
    const selectedTypeOption = CREATE_PT_TYPES.find((t) => t.id === createPtType);
    const isCustomerCfg = sectionId === "customer_payment_terms";

    return (
      <div className="space-y-3">
        {/* ── Heading + Helper Copy ── */}
        <div className="mb-1">
          <h4 className="text-sm text-foreground" style={{ fontWeight: 700 }}>Payment Terms</h4>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            {isCustomerCfg
              ? "Default terms (e.g. Net 30, 2/10 Net 30) inherited by every customer created under this template. Apply automatically to their sales orders and invoices to set the due date. Partners can override per-transaction. "
              : "Default terms (e.g. Net 30, 2/10 Net 30) inherited by every vendor created under this template. Apply automatically to their purchase orders to set when our payment is due. Partners can override per-transaction. "}
            <span className="text-primary inline-flex items-center gap-0.5 cursor-pointer hover:underline" style={{ fontWeight: 500 }}>
              Learn More <ExternalLink className="w-3 h-3" />
            </span>
          </p>
        </div>

        {/* ── Content: Empty state or Toolbar + Card ── */}
        {!selectedPaymentTermPreset ? (
          /* ── Empty State — matches shipping methods pattern ── */
          <div className="rounded-xl border-2 border-dashed border-border bg-white py-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>No payment terms configured</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[300px]">Add payment terms to define when and how partners in this group pay for purchase orders.</p>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => { resetCreatePtForm(); setCreatePtModalOpen(true); }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs transition-colors hover:bg-primary/90 shadow-sm"
                style={{ fontWeight: 600 }}
              >
                <Plus className="w-3.5 h-3.5" /> Create Terms
              </button>
              <button
                onClick={() => { setPtTypeFilters("net"); setPtStatusFilter("all"); setPtSearch(""); setPaymentTermsModalOpen(true); }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border bg-white text-xs text-foreground hover:bg-slate-50 transition-colors shadow-sm"
                style={{ fontWeight: 600 }}
              >
                <FileText className="w-3.5 h-3.5" /> Browse Templates
              </button>
            </div>
          </div>
        ) : (
          /* ── Toolbar + Selected Payment Term Card ── */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                <span style={{ fontWeight: 600 }}>1</span> payment term configured
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { resetCreatePtForm(); setCreatePtModalOpen(true); }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs transition-colors hover:bg-primary/90 shadow-sm"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="w-3.5 h-3.5" /> Create Terms
                </button>
                <button
                  onClick={() => { setPtTypeFilters("net"); setPtStatusFilter("all"); setPtSearch(""); setPaymentTermsModalOpen(true); }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-white text-xs text-foreground hover:bg-slate-50 transition-colors shadow-sm"
                  style={{ fontWeight: 600 }}
                >
                  <FileText className="w-3.5 h-3.5" /> Browse Templates
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <PaymentTermCard
                term={selectedPaymentTermPreset}
                onClick={() => { setStandalonePtDetailTerm(selectedPaymentTermPreset); setStandalonePtDetailOpen(true); }}
                onRemove={() => { setSelectedPaymentTermId(null); customPaymentTermRef.current = null; }}
                showPresetBadge
              />
            </div>
          </div>
        )}

        {/* ── Create New Payment Terms Modal ── */}
        <Dialog open={createPtModalOpen} onOpenChange={(open) => { setCreatePtModalOpen(open); if (!open) { resetCreatePtForm(); setCreatePtFullscreen(false); } }}>
          <DialogContent
            className="p-0 gap-0 overflow-hidden z-[210] flex flex-col transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)]"
            style={createPtFullscreen
              ? { maxWidth: "calc(100% - 1rem)", width: "calc(100% - 1rem)", height: "calc(100dvh - 1rem)", maxHeight: "calc(100dvh - 1rem)", borderRadius: 16 }
              // Form-modal standard: hugs content vertically, width capped at 1320px on wide monitors
              : { maxWidth: "min(65vw, 960px)", width: "calc(100% - 2rem)", height: "auto", maxHeight: "90vh", borderRadius: 16 }
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
                    <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>Create New Payment Term</h2>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                      <Receipt className="w-3 h-3" /> Payment Term
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                    {configType === "customer" ? "Select the structure of the payment arrangement we offer to this customer." : "Select the structure of the payment arrangement with this vendor."}
                  </p>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <button
                    onClick={() => setCreatePtFullscreen(!createPtFullscreen)}
                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    {createPtFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    {createPtFullscreen ? "Exit Full" : "Full View"}
                  </button>
                  <button
                    onClick={() => { setCreatePtModalOpen(false); setCreatePtFullscreen(false); resetCreatePtForm(); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
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
                    {/* Start-from-template suggestion row */}
                    {(() => {
                      const suggestedPtTemplates = [...PAYMENT_TERM_PRESETS]
                        .sort((a, b) => b.vendorsApplied - a.vendorsApplied)
                        .slice(0, 4);
                      const categoryToType = (c: PaymentTermCategory): "net" | "prepayment" | "split" =>
                        c === "net" ? "net" : c === "prepayment" ? "prepayment" : "split";
                      const applyPtTemplate = (tpl: PaymentTermPreset) => {
                        resetCreatePtForm();
                        setCreatePtName(`Copy of ${tpl.name}`);
                        setCreatePtType(categoryToType(tpl.category));
                        const triggerMatch = CREATE_PT_TRIGGERS.find((t) => t.label === tpl.trigger);
                        if (triggerMatch) setCreatePtTrigger(triggerMatch.id);
                        if (tpl.duration) setCreatePtDuration(tpl.duration);
                        setCreatePtDescription(tpl.description);
                        if (tpl.applyDiscount) {
                          setCreatePtApplyDiscount(true);
                          if (tpl.discountPercent) setCreatePtDiscountPercent(tpl.discountPercent);
                          if (tpl.discountPeriod) setCreatePtDiscountPeriod(tpl.discountPeriod);
                        }
                        toast.success(`Template duplicated as a new custom term. Edit any field before saving; the original template stays unchanged.`);
                      };
                      return (
                        <div className="rounded-xl border border-dashed border-[#DBE4F0] bg-gradient-to-br from-[#F8FBFF] to-white p-3.5">
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                                <Sparkles className="w-3 h-3 text-primary" />
                              </div>
                              <div>
                                <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Start from a Template</p>
                                <p className="text-[10px] text-slate-400" style={{ fontWeight: 400 }}>Duplicates the template as a new custom term. Originals are never modified.</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => { setCreatePtModalOpen(false); setCreatePtFullscreen(false); setPtTypeFilters("net"); setPtStatusFilter("all"); setPtSearch(""); setPaymentTermsModalOpen(true); }}
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer shrink-0"
                              style={{ fontWeight: 600 }}
                            >
                              See All <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                            {suggestedPtTemplates.map((tpl) => {
                              const pill =
                                tpl.category === "net"
                                  ? { text: "#0A77FF", bg: "#EBF3FF", border: "#CFE6FF" }
                                  : tpl.category === "prepayment"
                                    ? { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" }
                                    : { text: "#B45309", bg: "#FFFBEB", border: "#FDE68A" };
                              return (
                                <button
                                  key={tpl.id}
                                  type="button"
                                  onClick={() => applyPtTemplate(tpl)}
                                  className="group text-left rounded-lg border border-[#E8ECF1] bg-white p-2.5 hover:border-primary/30 hover:shadow-[0_2px_8px_-2px_rgba(10,119,255,0.10)] transition-all cursor-pointer"
                                >
                                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                    <span className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0" style={{ borderColor: pill.border }}>
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px]"
                                        style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg }}
                                      >
                                        <Receipt className="w-3 h-3" />
                                        {tpl.typeBadge}
                                      </span>
                                      <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l truncate max-w-[110px]" style={{ fontWeight: 500, borderColor: pill.border }}>
                                        {tpl.trigger}
                                      </span>
                                    </span>
                                    {tpl.duration && (
                                      <span className="inline-flex items-center px-1.5 py-[2px] rounded-full border border-[#E8ECF1] bg-slate-50 text-slate-500 text-[10px]" style={{ fontWeight: 500 }}>
                                        {tpl.duration}d
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-foreground line-clamp-1 group-hover:text-primary transition-colors" style={{ fontWeight: 600 }}>
                                    {tpl.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-snug">
                                    {tpl.description}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                    {/* Payment Term Type — card selector matching partner type style */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Payment Term Type</span>
                        <Tooltip>
                          <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                            <p className="text-slate-500">Select a payment structure. Hover each card for details.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {CREATE_PT_TYPES.map((t) => {
                          const isActive = createPtType === t.id;
                          const icon = t.id === "net" ? <Clock className="w-[18px] h-[18px]" /> : t.id === "prepayment" ? <Banknote className="w-[18px] h-[18px]" /> : <ArrowUpDown className="w-[18px] h-[18px]" />;
                          const shortLabel = t.id === "net" ? "Net Terms" : t.id === "prepayment" ? "Prepayment" : "Split Payment";
                          const shortDesc = t.id === "net" ? "Pay After X Days" : t.id === "prepayment" ? "Pay Before Delivery" : "Multiple Installments";
                          const typeTooltip = t.id === "net"
                            ? { desc: "Full payment due after a set number of days from a trigger event.", example: "Net 30", exampleDesc: "pay in full within 30 days of shipment." }
                            : t.id === "prepayment"
                            ? { desc: "Collect partial or full payment upfront before goods ship.", example: "50% Upfront", exampleDesc: "half paid before dispatch." }
                            : { desc: "Split the total across multiple events, each with its own percentage.", example: "40/30/30", exampleDesc: "split across order, shipment, and delivery." };
                          const accentColor = t.id === "net" ? "rgb(var(--primary))" : t.id === "prepayment" ? "rgb(var(--violet))" : "rgb(var(--warning))";
                          const accentBg = t.id === "net" ? "#EBF3FF" : t.id === "prepayment" ? "#F5F3FF" : "#FFFBEB";
                          const accentBorder = t.id === "net" ? "#7AB8FF" : t.id === "prepayment" ? "#C4B5FD" : "#FCD34D";
                          const activeBorderClass = t.id === "net" ? "border-[#7AB8FF]/70" : t.id === "prepayment" ? "border-[#C4B5FD]/70" : "border-[#FCD34D]/70";
                          const hoverBorderClass = t.id === "net" ? "hover:border-blue-200" : t.id === "prepayment" ? "hover:border-[#DDD6FE]" : "hover:border-amber-200";
                          const circleActiveBg = t.id === "net" ? "#0A77FF" : t.id === "prepayment" ? "#8B5CF6" : "#F59E0B";
                          const circleActiveShadow = t.id === "net" ? "rgba(59,130,246,0.15)" : t.id === "prepayment" ? "rgba(139,92,246,0.15)" : "rgba(245,158,11,0.15)";
                          const hoverCircleBorder = t.id === "net" ? "group-hover:border-[#7AB8FF]" : t.id === "prepayment" ? "group-hover:border-[#C4B5FD]" : "group-hover:border-[#FCD34D]";
                          return (
                            <Tooltip key={t.id}>
                              <TooltipTrigger asChild>
                                <div
                                  onClick={() => {
                                    setCreatePtType(t.id as "net" | "prepayment" | "split");
                                    /* Delivery isn't offered for prepayment —
                                       fall back to the default trigger. */
                                    if (t.id === "prepayment" && createPtTrigger === "delivery") setCreatePtTrigger("order_confirmation");
                                  }}
                                  className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
                                    isActive
                                      ? `${activeBorderClass} bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]`
                                      : `border-border bg-white ${hoverBorderClass} hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)]`
                                  }`}
                                >
                                  <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`} style={{ background: `linear-gradient(135deg, ${accentBg}80 0%, transparent 70%)` }} />
                                  <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                                    <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${isActive ? "" : "group-hover:scale-105"}`} style={{ background: `linear-gradient(135deg, ${accentBg}, ${accentBorder}40)`, color: accentColor }}>
                                      {icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-[13px] transition-colors duration-150 ${isActive ? "" : "text-foreground group-hover:text-slate-800"}`} style={{ fontWeight: 600, color: isActive ? accentColor : undefined }}>{shortLabel}</p>
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
                                <p className="text-slate-500">{typeTooltip.desc}</p>
                                <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                                  <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                                  <p className="text-[11px] text-slate-700 mt-1"><span style={{ fontWeight: 600, color: accentColor }}>{typeTooltip.example}</span>: {typeTooltip.exampleDesc}</p>
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
                        <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Payment Term Details</span>
                        <Tooltip>
                          <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                            <p className="text-slate-500">Name, duration, and trigger shown on POs and invoices.</p>
                            <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                              <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Tip</p>
                              <p className="text-[11px] text-slate-700 mt-1">Use clear names like <span className="text-primary" style={{ fontWeight: 600 }}>Net 30 Standard</span> or <span className="text-primary" style={{ fontWeight: 600 }}>50% Upfront</span>.</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="rounded-xl border border-border bg-white p-4">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          {/* Row 1: Name + (NET only: Trigger) / (others: Description) */}
                          <div>
                            <label className="text-[12px] text-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
                              {createPtType === "net" ? "Net Term" : createPtType === "prepayment" ? "Prepayment Term" : "Split Term"} Name
                            </label>
                            <Input
                              value={createPtName}
                              onChange={(e) => setCreatePtName(e.target.value)}
                              placeholder={`e.g. ${createPtType === "net" ? "Net 30 Standard" : createPtType === "prepayment" ? "50% Upfront" : "3-Part Split"}`}
                              className="rounded-lg border-border bg-white h-9 text-[13px] text-foreground placeholder:text-slate-400"
                            />
                          </div>
                          {/* NET: Trigger next to name */}
                          {createPtType === "net" && (
                            <div>
                              <div className="flex items-center gap-1 mb-1.5">
                                <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Trigger Event</label>
                                <Tooltip>
                                  <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                                  <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                    <p className="text-slate-500">Event that starts the payment countdown.</p>
                                    <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                                      <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                                      <p className="text-[11px] text-slate-700 mt-1"><span className="text-primary" style={{ fontWeight: 600 }}>Shipping Date</span>: due 30 days after shipment.</p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <Select value={createPtTrigger} onValueChange={setCreatePtTrigger}>
                                <SelectTrigger className="h-9 rounded-lg border-border bg-white text-[13px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="z-[250] rounded-lg">
                                  {CREATE_PT_TRIGGERS.map((t) => (
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
                                  <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Net Duration (Days)</label>
                                  <Tooltip>
                                    <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                                    <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                      <p className="text-slate-500">Calendar days allowed after trigger. Common: 15, 30, 45, 60, or 90.</p>
                                      <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                                        <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                                        <p className="text-[11px] text-slate-700 mt-1"><span className="text-primary" style={{ fontWeight: 600 }}>Net 30</span>: pay in full within 30 days.</p>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <div className="relative">
                                  <Input
                                    value={createPtCustomDuration || createPtDuration}
                                    onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setCreatePtCustomDuration(v); setCreatePtDuration(v || "30"); }}
                                    placeholder="e.g. 30"
                                    className="h-9 rounded-lg border-border bg-white text-[13px] text-foreground placeholder:text-slate-400 pr-14"
                                    inputMode="numeric"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400" style={{ fontWeight: 500 }}>days</span>
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
                          <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Prepayment Configuration</span>
                          <Tooltip>
                            <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                              <p className="text-slate-500">Upfront payment before shipment as a percentage of the order total.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="rounded-xl border border-border bg-white p-4">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                            {/* Prepayment Value — percent only */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                                  Prepayment Value
                                </label>
                              </div>
                              <div className="relative">
                                <Input
                                  value={createPtCustomDuration || ""}
                                  onChange={(e) => setCreatePtCustomDuration(e.target.value)}
                                  placeholder="e.g. 50"
                                  className="rounded-lg border-border bg-white text-[13px] h-9 placeholder:text-slate-400 pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">%</span>
                              </div>
                            </div>
                            {/* Trigger */}
                            <div>
                              <div className="flex items-center h-[22px] mb-1.5">
                                <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Trigger Event</label>
                              </div>
                              <Select value={createPtTrigger} onValueChange={setCreatePtTrigger}>
                                <SelectTrigger className="h-9 rounded-lg border-border bg-white text-[13px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="z-[250] rounded-lg">
                                  {/* Prepayment happens before fulfillment, so
                                      Delivery is not a valid trigger here. */}
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
                            <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Payment Split Events</span>
                            <span className="text-[11px] text-slate-400 bg-muted px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>{createPtSplitEvents.length}</span>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          {createPtSplitEvents.map((evt, idx) => (
                            <div key={idx} className="rounded-xl border bg-white overflow-hidden transition-all" style={{ borderColor: "rgb(var(--border))" }}>
                              {/* Header — matches pricing rule tier card */}
                              <div className="flex items-center justify-between px-3.5 py-2 border-b border-muted" style={{ backgroundColor: "#FFFBEB" }}>
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] text-white" style={{ fontWeight: 700, backgroundColor: "rgb(var(--warning))" }}>{idx + 1}</span>
                                  <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Split {idx + 1}</span>
                                </div>
                                {createPtSplitEvents.length > 2 && (
                                  <button
                                    onClick={() => setCreatePtSplitEvents(createPtSplitEvents.filter((_, i) => i !== idx))}
                                    className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-white/60 transition-all cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              {/* Body */}
                              <div className="px-3.5 py-3">
                                <div className="grid grid-cols-2 gap-3">
                                  {/* Split Value — percent only */}
                                  <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                                        Split Value
                                      </label>
                                    </div>
                                    <div className="relative">
                                      <Input
                                        value={evt.percent}
                                        onChange={(e) => { const u = [...createPtSplitEvents]; u[idx] = { ...u[idx], percent: e.target.value }; setCreatePtSplitEvents(u); }}
                                        placeholder="e.g. 50"
                                        className="rounded-lg border-border bg-white text-[13px] h-9 text-foreground placeholder:text-slate-400 pr-8"
                                      />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">%</span>
                                    </div>
                                  </div>
                                  {/* Trigger Event dropdown */}
                                  <div>
                                    <div className="flex items-center h-[22px] mb-1.5">
                                      <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Trigger Event</label>
                                    </div>
                                    <Select
                                      value={evt.event}
                                      onValueChange={(v) => { const u = [...createPtSplitEvents]; u[idx] = { ...u[idx], event: v }; setCreatePtSplitEvents(u); }}
                                    >
                                      <SelectTrigger className="h-9 rounded-lg border-border bg-white text-[13px]">
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
                            className="inline-flex items-center gap-1 text-[12px] text-warning hover:text-[#B45309] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ fontWeight: 600 }}
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Event {createPtSplitEvents.length >= 5 ? "(Max 5)" : ""}
                          </button>
                          {(() => {
                            const total = createPtSplitEvents.reduce((sum, e) => sum + (parseFloat(e.percent) || 0), 0);
                            return (
                              <span className={`text-[11px] ${Math.abs(total - 100) < 0.01 ? "text-emerald-500" : "text-amber-500"}`} style={{ fontWeight: 600 }}>
                                Total: {total}%{Math.abs(total - 100) >= 0.01 ? " (must equal 100%)" : " ✓"}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Early Payment Discount — collapsible card */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Early Payment Discount</span>
                        <span className="text-[11px] text-slate-400 bg-muted px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>Optional</span>
                        <Tooltip>
                          <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                            <p className="text-slate-500">Encourage faster payment with an auto-applied discount within an eligible window.</p>
                            <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                              <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                              <p className="text-[11px] text-slate-700 mt-1"><span className="text-primary" style={{ fontWeight: 600 }}>2/10 Net 30</span>: 2% off if paid in 10 days, otherwise full payment in 30 days.</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      <div className={`rounded-xl border p-4 transition-all duration-200 ${createPtApplyDiscount ? "border-primary/25 bg-white shadow-sm" : "border-border bg-white"}`}>
                        <div className="flex items-center gap-3">
                          <Switch checked={createPtApplyDiscount} onCheckedChange={(v) => setCreatePtApplyDiscount(v === true)} />
                          <div className="flex-1 min-w-0">
                            <h5 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Apply Early Payment Discount</h5>
                            <p className="text-[11px] text-slate-500 mt-0.5">Incentivize faster payments by offering a percentage or fixed discount within a defined window.</p>
                          </div>
                        </div>

                        {createPtApplyDiscount && (
                          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-muted items-end">
                            <div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                  <Label className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>Discount</Label>
                                  <Tooltip>
                                    <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                                    <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                      <p className="text-slate-500">Percentage deducted when paid within the eligible window.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                              <div className="relative mt-1">
                                <Input
                                  value={createPtDiscountPercent}
                                  onChange={(e) => setCreatePtDiscountPercent(e.target.value)}
                                  placeholder="e.g. 5"
                                  className="rounded-lg border-border bg-white !h-10 text-sm placeholder:text-slate-400 pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-1">
                                <Label className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>Eligible Payment Period</Label>
                                <Tooltip>
                                  <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                                  <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                    <p className="text-slate-500">If paid within this window, the discount will be applied to the invoice total.</p>
                                    <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                                      <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                                      <p className="text-[11px] text-slate-700 mt-1"><span className="text-primary" style={{ fontWeight: 600 }}>2/10 Net 30</span>: 2% off if paid in 10 days, otherwise full payment in 30 days.</p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <div className="relative mt-1">
                                <Input
                                  value={createPtCustomDiscountPeriod || createPtDiscountPeriod}
                                  onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setCreatePtCustomDiscountPeriod(v); setCreatePtDiscountPeriod(v || "10"); }}
                                  placeholder="e.g. 10"
                                  className="!h-10 rounded-lg border-border bg-white text-sm text-foreground placeholder:text-slate-400 pr-14"
                                  inputMode="numeric"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400" style={{ fontWeight: 500 }}>days</span>
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
                className="px-3 sm:px-5 py-2 rounded-lg border border-border text-xs sm:text-[13px] bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
                style={{ fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewPaymentTerm}
                disabled={!createPtName.trim()}
                className="inline-flex items-center px-3 sm:px-5 py-2 rounded-lg bg-primary text-white text-xs sm:text-[13px] hover:bg-[#086AE6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
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
              // Detail-modal standard: stable frame for the preset grid, width capped at 1480px on wide monitors
              : { maxWidth: "min(75vw, 1080px)", width: "calc(100% - 2rem)", height: "min(88vh, 1080px)", maxHeight: "min(88vh, 1080px)", minHeight: 640, borderRadius: 16 }
            }
            hideCloseButton
          >
            
            <div className="flex items-center justify-between border-b border-[#EEF2F6] bg-card px-6 h-12 shrink-0">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Payment Terms</h3>
                  <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Browse templates or create custom terms</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPtFullscreen(!ptFullscreen)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  {ptFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {ptFullscreen ? "Exit Full" : "Full View"}
                </button>
                <button
                  onClick={() => setPaymentTermsModalOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-muted transition-all cursor-pointer"
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
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        value={ptSearch}
                        onChange={(e) => setPtSearch(e.target.value)}
                        placeholder="Search payment terms..."
                        className="pl-9 pr-8 rounded-lg border-[#D0D7E1] h-9 bg-white text-[13px] w-[220px] placeholder:text-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus:border-primary focus:shadow-[0_0_0_3px_rgba(10,119,255,0.08)]"
                      />
                      {ptSearch && (
                        <button onClick={() => setPtSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-foreground transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Type toggle — inline with search, each tab has a hover tooltip */}
                    <div className="inline-flex items-center rounded-lg bg-slate-50 border border-border/60 p-0.5 shrink-0">
                      {([
                        { key: "net", label: "Net", color: "rgb(var(--primary))", bg: "#EBF3FF", icon: Receipt, tip: "Payment is due a fixed number of days after an event (invoice date, delivery, etc.).", example: <><span className="text-primary" style={{ fontWeight: 600 }}>Net 30</span>, full payment due 30 days after invoice.</> },
                        { key: "prepayment", label: "Pre", color: "rgb(var(--violet))", bg: "#F5F3FF", icon: Clock, tip: "Full or partial payment required before goods are shipped or services rendered.", example: <><span className="text-violet" style={{ fontWeight: 600 }}>50% upfront</span> before production starts.</> },
                        { key: "split", label: "Split", color: "rgb(var(--warning))", bg: "#FFFBEB", icon: SquareSplitHorizontal, tip: "Payment is divided into multiple installments, each due at different milestones.", example: <><span className="text-amber-600" style={{ fontWeight: 600 }}>30/70 split</span>, 30% on order, 70% on delivery.</> },
                      ] as const).map((cat) => {
                        const active = ptTypeFilters === cat.key;
                        const count = PAYMENT_TERM_PRESETS.filter((t) => t.category === cat.key).length;
                        return (
                          <Tooltip key={cat.key}>
                            <TooltipTrigger asChild>
                              <button
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
                                  style={{ fontWeight: 600, color: active ? cat.color: "rgb(var(--muted-foreground))", backgroundColor: active ? `${cat.color}15` : "rgb(var(--border))" }}
                                >
                                  {count}
                                </span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                              <p className="text-slate-500">{cat.tip}</p>
                              <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                                <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                                <p className="text-[11px] text-slate-700 mt-1">{cat.example}</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>

                    <div className="flex-1" />
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center justify-center min-w-[22px] h-[20px] px-1.5 rounded-md bg-primary/[0.04] text-[11px] text-slate-500" style={{ fontWeight: 600 }}>
                        {filteredPaymentTermPresets.length}
                      </span>
                    <Popover open={ptSortOpen} onOpenChange={setPtSortOpen}>
                      <PopoverTrigger asChild>
                        <button className={`inline-flex items-center gap-1 text-[12px] transition-colors px-2 py-1 rounded-md border ${ptSortOpen ? "text-primary bg-blue-50 border-blue-100" : "text-slate-500 hover:text-foreground hover:bg-slate-50 border-transparent hover:border-border"}`} style={{ fontWeight: 500 }}>
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
                                    ? "bg-blue-50 text-primary"
                                    : "text-muted-foreground hover:bg-slate-50 hover:text-foreground"
                                }`}
                                style={{ fontWeight: isActive ? 600 : 500 }}
                              >
                                <span className={isActive ? "text-primary" : "text-slate-400"}>{opt.icon}</span>
                                <span className="flex-1 text-left">{opt.label}</span>
                                {isActive && (
                                  ptSortDir === "asc"
                                    ? <ArrowUp className="w-3 h-3 text-primary" />
                                    : <ArrowDown className="w-3 h-3 text-primary" />
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
                      <div className="w-12 h-12 rounded-lg bg-muted border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                        <Search className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-[13px] text-muted-foreground" style={{ fontWeight: 600 }}>No payment terms found</p>
                      <p className="text-[12px] text-slate-400 mt-1">Try adjusting your search or filter</p>
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
                            inactive={getPtStatus(term.id) === "inactive"}
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
          // Detail-modal Duplicate routes through the canonical
          // duplicate flow — opens Create Pricing Rule pre-filled
          // with the source rule's data. Same UX as Browse
          // Templates Duplicate + the partner-detail Duplicate.
          onDuplicate={(r) => {
            setPrDetailOpen(false);
            handleDuplicatePricingRule(r);
          }}
          onDisable={(r) => {
            toast.success(`"${r.name}" has been disabled`);
            setPrDetailOpen(false);
          }}
        />
      </div>
    );
  }

  if (sectionId === "pricing_rules" || sectionId === "customer_pricing_rules") {
    const isCustomerCfg = sectionId === "customer_pricing_rules";
    const PR_MOCK_ITEMS = [
      { partNo: "100219-42", desc: "Front bulkhead ca...", category: "Ram Pro Master 2500...", type: "Parts", typeBg: "#CFE6FF", typeColor: "rgb(var(--primary))", location: "Toyota Loca..." },
      { partNo: "100219-51", desc: "Box walls inlay ca...", category: "Hardware", type: "Parts", typeBg: "#CFE6FF", typeColor: "rgb(var(--primary))", location: "Toyota Tech..." },
      { partNo: "100219-51-01", desc: "Box walls inlay ca...", category: "Cabinet", type: "Equipment • Capital", typeBg: "#CFE6FF", typeColor: "rgb(var(--primary))", location: "Roseville To..." },
      { partNo: "100219-51-01RC", desc: "Box walls inlay ca...", category: "Electronics", type: "Equipment • Non-Capital", typeBg: "#FEF3C7", typeColor: "rgb(var(--warning))", location: "Right Toyota..." },
      { partNo: "100219-51-02", desc: "Box walls inlay ca...", category: "Hardware", type: "Parts", typeBg: "#CFE6FF", typeColor: "rgb(var(--primary))", location: "Maplewood..." },
      { partNo: "100219-52", desc: "Box closeout top...", category: "Electronics", type: "Equipment • Non-Capital", typeBg: "#FEF3C7", typeColor: "rgb(var(--warning))", location: "Peterson To..." },
      { partNo: "100219-52-02", desc: "Box closeout top...", category: "Cabinet", type: "Parts", typeBg: "#CFE6FF", typeColor: "rgb(var(--primary))", location: "Toyota of N..." },
      { partNo: "02901201000", desc: "Foam padding RF1...", category: "Hardware", type: "Parts", typeBg: "#CFE6FF", typeColor: "rgb(var(--primary))", location: "Toyota of C..." },
      { partNo: "100120-79", desc: "Toyota long cut, b...", category: "Electronics", type: "Equipment • Non-Capital", typeBg: "#FEF3C7", typeColor: "rgb(var(--warning))", location: "Toyota 101 (...)" },
    ];

    return (
      <div className="space-y-3">
        {/* Section header */}
        <div className="mb-1">
          <h4 className="text-sm text-foreground" style={{ fontWeight: 700 }}>{isCustomerCfg ? "Customer Pricing Rules" : "Vendor Pricing Rules"}</h4>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            {isCustomerCfg
              ? "Default rules inherited by every customer created under this template. Tiered discounts or premiums attach automatically to their quotes and sales orders (e.g. 5% off on orders over $1,000). Partners can attach extra rules or detach inherited ones. "
              : "Default rules inherited by every vendor created under this template. Tiered discounts or premiums attach automatically to their purchase orders (e.g. 3% volume discount over 500 units). Partners can attach extra rules or detach inherited ones. "}
            <span className="text-primary inline-flex items-center gap-0.5 cursor-pointer hover:underline" style={{ fontWeight: 500 }}>
              Learn More <ExternalLink className="w-3 h-3" />
            </span>
          </p>
        </div>

        {/* ── Content: Empty state or Toolbar + Cards ── */}
        {selectedPricingRules.length === 0 ? (
          /* ── Empty State — matches shipping methods pattern ── */
          <div className="rounded-xl border-2 border-dashed border-border bg-white py-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <ChartColumn className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>No pricing rules applied</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[300px]">
              {isCustomerCfg ? "Add pricing rules to automatically apply tier-based discounts or premiums on this customer group's orders." : "Add pricing rules to automatically apply tier-based discounts or premiums on purchase orders for vendors in this group."}
            </p>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => { resetCreatePrForm(); setCreatePrModalOpen(true); }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs transition-colors hover:bg-primary/90 shadow-sm"
                style={{ fontWeight: 600 }}
              >
                <Plus className="w-3.5 h-3.5" /> Create Rule
              </button>
              <button
                onClick={() => { setPrTypeFilters("discount"); setPrStatusFilter("all"); setPrSearch(""); setPreviewPricingRuleId(null); setPrPreviewTab("preview"); setPricingRulesModalOpen(true); }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border bg-white text-xs text-foreground hover:bg-slate-50 transition-colors shadow-sm"
                style={{ fontWeight: 600 }}
              >
                <FileText className="w-3.5 h-3.5" /> Browse Templates
              </button>
            </div>
          </div>
        ) : (
          /* ── Toolbar + Card Grid — matches shipping methods pattern ── */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                <span style={{ fontWeight: 600 }}>{selectedPricingRules.length}</span> pricing rule{selectedPricingRules.length !== 1 ? "s" : ""} applied
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { resetCreatePrForm(); setCreatePrModalOpen(true); }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs transition-colors hover:bg-primary/90 shadow-sm"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="w-3.5 h-3.5" /> Create Rule
                </button>
                <button
                  onClick={() => { setPrTypeFilters("discount"); setPrStatusFilter("all"); setPrSearch(""); setPreviewPricingRuleId(null); setPrPreviewTab("preview"); setPricingRulesModalOpen(true); }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-white text-xs text-foreground hover:bg-slate-50 transition-colors shadow-sm"
                  style={{ fontWeight: 600 }}
                >
                  <FileText className="w-3.5 h-3.5" /> Browse Templates
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                    className="bg-white border border-border rounded-xl cursor-pointer group transition-all duration-200 flex flex-col relative"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#A8D2FF";
                      e.currentTarget.style.boxShadow = "0 4px 16px -4px rgba(10,119,255,0.10), 0 0 0 1px #A8D2FF";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgb(var(--border))";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {/* Hover-action cluster — Duplicate + Remove,
                        matching the canonical applied-list card on the
                        partner creation form so both surfaces share the
                        same affordances (Duplicate routes through
                        handleDuplicatePricingRule for a pre-filled
                        Create Pricing Rule modal). */}
                    <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDuplicatePricingRule(rule); }}
                        className="w-6 h-6 rounded-full bg-white border border-border shadow-sm text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-blue-50 transition-colors flex items-center justify-center cursor-pointer"
                        title="Duplicate as custom"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removePricingRule(rule.id); }}
                        className="w-6 h-6 rounded-full bg-white border border-border shadow-sm text-slate-400 hover:text-destructive hover:border-destructive/30 hover:bg-red-50 transition-colors flex items-center justify-center cursor-pointer"
                        title="Remove from this group"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

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
                          <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l" style={{ fontWeight: 500, borderColor: pill.border }}>
                            {rule.basis === "volume" ? "Volume" : "Value"}
                          </span>
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isPreset ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md bg-muted border border-slate-300 text-[9px] text-slate-500" style={{ fontWeight: 600 }}>
                              <Lock className="w-2.5 h-2.5" /> TEMPLATE
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-[3px] rounded-md border border-slate-300 bg-white text-[9px] text-muted-foreground" style={{ fontWeight: 600 }}>Custom</span>
                          )}
                        </div>
                      </div>

                      {/* Row 2: Name */}
                      <div className="shrink-0 mb-1">
                        <p className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{rule.name}</p>
                      </div>

                      {/* Row 3: Description */}
                      <div className="h-[32px] shrink-0 mb-2">
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed" style={{ fontWeight: 400 }}>{rule.description}</p>
                      </div>

                      {/* Row 4: Hero value + VALID stack right (matches
                          canonical card — VALID label + dates parallel
                          to the discount %, falls back to "Always
                          active" when no validity window). */}
                      <div className="flex items-baseline justify-between gap-2 shrink-0">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span className="text-[22px] text-foreground leading-none tracking-tight" style={{ fontWeight: 600 }}>
                            {rule.tiers[0]?.discount ?? "—"}
                          </span>
                          <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>
                            {isDis ? "off" : "markup"}
                          </span>
                        </div>
                        <div className="flex flex-col items-end shrink-0 leading-tight">
                          <span className="text-[9px] tracking-wide text-slate-400" style={{ fontWeight: 600 }}>Valid</span>
                          <span className="text-[11px] text-slate-700" style={{ fontWeight: 500 }}>
                            {rule.validityPeriod || "Always Active"}
                          </span>
                        </div>
                      </div>

                      {/* Row 5: Tier detail */}
                      <div className="mt-auto pt-2 shrink-0">
                        <div className="flex items-center justify-between px-3 py-[6px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] min-w-0">
                          <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
                            <span style={{ fontWeight: 400 }}>{rule.tiers[0]?.minValue || "-"}</span>
                            <span className="text-slate-300">–</span>
                            <span style={{ fontWeight: 400 }}>{rule.tiers[0]?.maxValue || "-"}</span>
                          </div>
                          <span className="shrink-0 ml-2 text-foreground" style={{ fontWeight: 600 }}>{rule.tiers[0]?.discount || "-"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-muted shrink-0">
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                        <Users className="w-3 h-3" /> {rule.vendorsApplied}
                      </span>
                      <span
                        className="ml-auto px-2 py-[2px] rounded-full text-[10px] border"
                        style={{ fontWeight: 500, color: "rgb(var(--success))", backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }}
                      >
                        Active
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}


        {/* ── Explore Pricing Rules Presets Modal ──
            Overlay + content sit above z-[210] because this modal
            also opens from inside the Partner Group detail page's
            per-profile configuration Dialog (which itself has
            z-[210] content). Without bumping past 210 the inner
            Dialog's default overlay stays *below* the outer
            content and the user sees no scrim — the page behind
            blends with the modal. */}
        <Dialog open={pricingRulesModalOpen} onOpenChange={(v) => { setPricingRulesModalOpen(v); if (!v) { setPrFullscreen(false); } }}>
          <DialogContent
            className="p-0 gap-0 overflow-hidden z-[221] border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col"
            overlayClassName="!z-[220] !bg-black/50"
            style={prFullscreen
              ? { maxWidth: "calc(100% - 1rem)", width: "calc(100% - 1rem)", height: "calc(100dvh - 1rem)", maxHeight: "calc(100dvh - 1rem)", borderRadius: 16 }
              // Detail-modal standard: stable frame for the preset grid, width capped at 1480px on wide monitors
              : { maxWidth: "min(75vw, 1080px)", width: "calc(100% - 2rem)", height: "min(88vh, 1080px)", maxHeight: "min(88vh, 1080px)", minHeight: 640, borderRadius: 16 }
            }
            hideCloseButton
          >
            <DialogTitle className="sr-only">Pricing Rule Presets Library</DialogTitle>
            <DialogDescription className="sr-only">{configType === "customer" ? "Browse and select pricing rule presets to apply to this customer." : "Browse and select pricing rule presets to apply to this vendor."}</DialogDescription>

            {/* Header */}
            <div className="flex items-center justify-between px-6 h-12 border-b border-[#EEF2F6] bg-card shrink-0">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Pricing Rule Presets</h3>
                  <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>{configType === "customer" ? "Browse and apply pricing rules to this customer" : "Browse and apply pricing rules to this vendor"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPrFullscreen(!prFullscreen)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all"
                  style={{ fontWeight: 500 }}
                >
                  {prFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {prFullscreen ? "Exit Full" : "Full View"}
                </button>
                <button onClick={() => setPricingRulesModalOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-muted transition-all">
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
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        value={prSearch}
                        onChange={(e) => setPrSearch(e.target.value)}
                        placeholder="Search pricing rules..."
                        className="pl-9 pr-8 rounded-lg border-[#D0D7E1] h-9 bg-white text-[13px] w-[220px] placeholder:text-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus:border-primary focus:shadow-[0_0_0_3px_rgba(10,119,255,0.08)]"
                      />
                      {prSearch && (
                        <button onClick={() => setPrSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-foreground transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Type toggle — inline with search, each tab has a hover tooltip */}
                    <div className="inline-flex items-center rounded-lg bg-slate-50 border border-border/60 p-0.5 shrink-0">
                      {([
                        { key: "discount", label: "Discounts", color: "#047857", bg: "#ECFDF5", icon: TrendingDown, tip: "Reduce unit price when quantity or value thresholds are met.", example: <><span className="text-green-600" style={{ fontWeight: 600 }}>10% off</span> on orders over 500 units.</> },
                        { key: "premium", label: "Premiums", color: "rgb(var(--violet))", bg: "#F5F3FF", icon: TrendingUp, tip: "Markup on base price for express or value-added services.", example: <><span className="text-violet" style={{ fontWeight: 600 }}>15% markup</span> for expedited and priority shipping.</> },
                      ] as const).map((cat) => {
                        const active = prTypeFilters === cat.key;
                        const count = allPricingRulePresets.filter((r) => r.category === cat.key).length;
                        return (
                          <Tooltip key={cat.key}>
                            <TooltipTrigger asChild>
                              <button
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
                                  style={{ fontWeight: 600, color: active ? cat.color: "rgb(var(--muted-foreground))", backgroundColor: active ? `${cat.color}15` : "rgb(var(--border))" }}
                                >
                                  {count}
                                </span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                              <p className="text-slate-500">{cat.tip}</p>
                              <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                                <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                                <p className="text-[11px] text-slate-700 mt-1">{cat.example}</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>

                    <div className="flex-1" />
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center justify-center min-w-[22px] h-[20px] px-1.5 rounded-md bg-primary/[0.04] text-[11px] text-slate-500" style={{ fontWeight: 600 }}>
                        {filteredPricingRulePresets.length}
                      </span>
                    <Popover open={prSortOpen} onOpenChange={setPrSortOpen}>
                      <PopoverTrigger asChild>
                        <button className={`inline-flex items-center gap-1 text-[12px] transition-colors px-2 py-1 rounded-md border ${prSortOpen ? "text-primary bg-blue-50 border-blue-100" : "text-slate-500 hover:text-foreground hover:bg-slate-50 border-transparent hover:border-border"}`} style={{ fontWeight: 500 }}>
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
                                    ? "bg-blue-50 text-primary"
                                    : "text-muted-foreground hover:bg-slate-50 hover:text-foreground"
                                }`}
                                style={{ fontWeight: isActive ? 600 : 500 }}
                              >
                                <span className={isActive ? "text-primary" : "text-slate-400"}>{opt.icon}</span>
                                <span className="flex-1 text-left">{opt.label}</span>
                                {isActive && (
                                  prSortDir === "asc"
                                    ? <ArrowUp className="w-3 h-3 text-primary" />
                                    : <ArrowDown className="w-3 h-3 text-primary" />
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
                  {/* Kickstart helper — clarifies that templates are a
                      starting point, not the only option, so users don't
                      assume the catalog is closed. */}
                  <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/60 px-3.5 py-2.5 flex items-start gap-2.5">
                    <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      <span className="text-foreground" style={{ fontWeight: 600 }}>Templates are a kickstart.</span> Use them as-is or as a baseline, you can always create a new pricing rule tailored to your business needs from <span style={{ fontWeight: 600 }}>Create New</span> above.
                    </p>
                  </div>
                  {filteredPricingRulePresets.length === 0 ? (
                    <div className="py-20 text-center">
                      <div className="w-12 h-12 rounded-lg bg-muted border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                        <Search className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-[13px] text-muted-foreground" style={{ fontWeight: 600 }}>No pricing rules found</p>
                      <p className="text-[12px] text-slate-400 mt-1">Try adjusting your search or filter</p>
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
                          // Routes through the canonical duplicate
                          // flow so the Create Pricing Rule modal
                          // opens pre-filled with the source rule's
                          // data. Same UX everywhere in the system.
                          onDuplicate={() => handleDuplicatePricingRule(rule)}
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

        {/* ── Create New Pricing Rule Modal (multi-step) ──
            Same z-stacking rationale as the Browse Templates
            modal above — opens from inside the Partner Group
            detail page's per-profile config Dialog (z-[210]),
            so its overlay needs to sit above 210 to be visible. */}
        <Dialog open={createPrModalOpen} onOpenChange={(v) => { setCreatePrModalOpen(v); if (!v) { resetCreatePrForm(); setCreatePrFullscreen(false); } }}>
          <DialogContent
            className="p-0 gap-0 overflow-hidden z-[221] flex flex-col border-0 sm:border sm:!rounded-2xl transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            overlayClassName="!z-[220] !bg-black/50"
            style={createPrFullscreen
              ? { position: "fixed" as const, inset: 0, maxWidth: "100%", width: "100%", height: "100dvh", maxHeight: "100dvh", borderRadius: 0 }
              // Form-modal standard with stable frame for the multi-step pricing-rule wizard.
              // Width matches the Payment Term creation modal for system-wide consistency.
              : { maxWidth: "min(65vw, 960px)", width: "calc(100% - 2rem)", height: "min(88vh, 1080px)", maxHeight: "min(88vh, 1080px)", minHeight: 640 }
            }
            hideCloseButton
          >
            <DialogTitle className="sr-only">{createPrMode === "view" ? "Pricing Rule Details" : editingPrRuleId ? "Edit Pricing Rule" : "Create New Pricing Rule"}</DialogTitle>
            <DialogDescription className="sr-only">{createPrMode === "view" ? "View and edit pricing rule details." : configType === "customer" ? "Create a new pricing rule for this customer." : "Create a new pricing rule for this vendor."}</DialogDescription>

            {/* Header — matching PricingRulesTab pattern */}
            <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-0 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
              {/* Title row */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>
                      {createPrMode === "view" ? (createPrName || "Pricing Rule Details") : editingPrRuleId ? "Edit Pricing Rule" : "Create New Pricing Rule"}
                    </h2>
                    {createPrMode === "view" ? (
                      <>
                        <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] tracking-wide ${
                          createPrCategory === "discount" ? "bg-green-50 text-green-600" : "bg-violet-50 text-violet"
                        }`} style={{ fontWeight: 600 }}>
                          {createPrCategory === "discount" ? "Discount" : "Premium"}
                        </span>
                        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-[10px] text-slate-500" style={{ fontWeight: 500 }}>
                          {createPrBasis === "volume" ? "Volume" : "Value"}
                        </span>
                        {editingPrRuleId && !editingPrRuleId.startsWith("pr-custom-") && (
                          <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md bg-muted border border-slate-300 text-[9px] text-slate-500" style={{ fontWeight: 600 }}>
                            <Lock className="w-2.5 h-2.5" /> TEMPLATE
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="hidden sm:inline-flex items-center px-1.5 py-[3px] rounded-md border border-slate-300 bg-white text-[9px] text-muted-foreground" style={{ fontWeight: 600 }}>Custom</span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                    {createPrMode === "view"
                      ? (createPrDescription || "View and manage this pricing rule's configuration.")
                      : editingPrRuleId
                        ? "Update the type, tiers, and assigned items for this rule."
                        : "Configure the type, tiers, and assign items for the new rule."
                    }
                  </p>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <button
                    onClick={() => setCreatePrFullscreen(!createPrFullscreen)}
                    className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    {createPrFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    {createPrFullscreen ? "Exit Full" : "Full View"}
                  </button>
                  <button
                    onClick={() => { setCreatePrModalOpen(false); resetCreatePrForm(); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
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
                          ? "bg-emerald-500 text-white"
                          : tab.active
                          ? "bg-primary text-white"
                          : "border-[1.5px] border-slate-300 text-slate-500 bg-white"
                      }`}
                      style={{ fontWeight: 600 }}
                    >
                      {tab.completed ? <Check className="w-3 h-3" /> : tab.num}
                    </div>
                    <span
                      className={`text-[12px] sm:text-[13px] whitespace-nowrap transition-colors ${
                        tab.active
                          ? "text-primary"
                          : tab.completed
                          ? "text-emerald-500"
                          : "text-slate-700"
                      }`}
                      style={{ fontWeight: tab.active || tab.completed ? 600 : 500 }}
                    >
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.shortLabel}</span>
                    </span>
                    {(tab.active || tab.completed) && (
                      <div className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full ${tab.completed ? "bg-emerald-500" : "bg-primary"}`} />
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
                const showTemplateSuggestions = createPrMode === "create" && !editingPrRuleId;
                const suggestedTemplates = [...PRICING_RULE_PRESETS]
                  .sort((a, b) => b.vendorsApplied - a.vendorsApplied)
                  .slice(0, 4);
                const applyPricingTemplate = (tpl: PricingRulePreset) => {
                  setCreatePrName(`Copy of ${tpl.name}`);
                  setCreatePrDescription(tpl.description);
                  setCreatePrCategory(tpl.category === "all" ? "discount" : tpl.category);
                  setCreatePrBasis(tpl.basis);
                  const parseNum = (s: string) => (s || "").replace(/[^0-9.]/g, "");
                  const parsedTiers: CpmTierState[] = (tpl.tiers || []).map((t) => ({
                    discount: parseNum(t.discount),
                    fixRate: false,
                    qtyLimits: Boolean(t.minValue || t.maxValue),
                    minQty: parseNum(t.minValue || ""),
                    maxQty: parseNum(t.maxValue || ""),
                  }));
                  setCreatePrTiers(parsedTiers.length > 0 ? parsedTiers : [makeCpmTier()]);
                  toast.success(`Template duplicated as a new custom rule. Edit any field before saving; the original template stays unchanged.`);
                };
                return (
                <div className="space-y-5">
                  {/* Preset read-only banner */}
                  {isPresetReadOnly && (
                    <div className="rounded-xl border border-[#FEF3C7] bg-amber-50 p-3 flex items-start gap-2.5">
                      <Lock className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[12px] text-amber-800" style={{ fontWeight: 600 }}>Preset Rule (Configuration Locked)</p>
                        <p className="text-[11px] text-[#B45309] mt-0.5">This is a tenant-provided preset rule. You can view its configuration and add items, categories, and attachments, but you cannot modify the rule type, tiers, or names.</p>
                      </div>
                    </div>
                  )}
                  {/* Start-from-template suggestion row */}
                  {showTemplateSuggestions && (
                    <div className="rounded-xl border border-dashed border-[#DBE4F0] bg-gradient-to-br from-[#F8FBFF] to-white p-3.5">
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                            <Sparkles className="w-3 h-3 text-primary" />
                          </div>
                          <div>
                            <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Start from a Template</p>
                            <p className="text-[10px] text-slate-400" style={{ fontWeight: 400 }}>Duplicates the template as a new custom rule. Originals are never modified.</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setCreatePrModalOpen(false); setPrTypeFilters("discount"); setPrStatusFilter("all"); setPrSearch(""); setPreviewPricingRuleId(null); setPrPreviewTab("preview"); setPricingRulesModalOpen(true); }}
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer shrink-0"
                          style={{ fontWeight: 600 }}
                        >
                          See All <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        {suggestedTemplates.map((tpl) => {
                          const isDis = tpl.category === "discount";
                          const pill = isDis
                            ? { text: "#047857", bg: "#ECFDF5", border: "#D1FAE5" }
                            : { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" };
                          return (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => applyPricingTemplate(tpl)}
                              className="group text-left rounded-lg border border-[#E8ECF1] bg-white p-2.5 hover:border-primary/30 hover:shadow-[0_2px_8px_-2px_rgba(10,119,255,0.10)] transition-all cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0" style={{ borderColor: pill.border }}>
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px]"
                                    style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg }}
                                  >
                                    {isDis ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                    {isDis ? "Discount" : "Premium"}
                                  </span>
                                  <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l" style={{ fontWeight: 500, borderColor: pill.border }}>
                                    {tpl.basis === "volume" ? "Volume" : "Value"}
                                  </span>
                                </span>
                                {tpl.tierType === "multiple" && (
                                  <span className="inline-flex items-center px-1.5 py-[2px] rounded-full border border-[#E8ECF1] bg-slate-50 text-slate-500 text-[10px]" style={{ fontWeight: 500 }}>
                                    {tpl.totalTiers}-tier
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-foreground line-clamp-1 group-hover:text-primary transition-colors" style={{ fontWeight: 600 }}>
                                {tpl.name}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-snug">
                                {tpl.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Pricing Rule Type — gradient cards */}
                  <div className={isPresetReadOnly ? "opacity-60 pointer-events-none" : ""}>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Pricing Rule Type</span>
                      <Tooltip>
                        <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                          <p className="text-slate-500">Discount lowers prices, Premium adds markup. Hover each card for details.</p>
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
                                : "border-border bg-white hover:border-[#BBF7D0] hover:shadow-[0_4px_16px_-4px_rgba(4,120,87,0.10)]"
                            }`}
                          >
                            <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
                              createPrCategory === "discount" ? "bg-gradient-to-br from-green-50/50 to-transparent" : "bg-gradient-to-br from-green-50/0 to-green-50/0 group-hover:from-green-50/60 group-hover:to-transparent"
                            }`} />
                            <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                              <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                                createPrCategory === "discount" ? "bg-gradient-to-br from-[#DCFCE7] to-[#BBF7D0] text-[#15803D]" : "bg-gradient-to-br from-green-50 to-[#DCFCE7] text-green-600 group-hover:scale-105"
                              }`}>
                                <TrendingDown className="w-[18px] h-[18px]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[13px] transition-colors duration-150 ${createPrCategory === "discount" ? "text-[#166534]" : "text-foreground group-hover:text-slate-800"}`} style={{ fontWeight: 600 }}>Discount</p>
                                <p className={`text-[11px] mt-0.5 truncate transition-colors duration-150 ${createPrCategory === "discount" ? "text-[#22C55E]" : "text-slate-400"}`}>Lower Price Adjustment</p>
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 shrink-0 ${createPrCategory === "discount" ? "border-green-600 bg-green-600" : "border-slate-300 group-hover:border-[#86EFAC]"}`}>
                                {createPrCategory === "discount" && <Check className="w-3 h-3 text-white" />}
                              </div>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                          <p className="text-slate-500">Reduce unit price when quantity or value thresholds are met.</p>
                          <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                            <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                            <p className="text-[11px] text-slate-700 mt-1"><span className="text-green-600" style={{ fontWeight: 600 }}>10% off</span> on orders over 500 units.</p>
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
                                : "border-border bg-white hover:border-[#DDD6FE] hover:shadow-[0_4px_16px_-4px_rgba(124,58,237,0.10)]"
                            }`}
                          >
                            <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
                              createPrCategory === "premium" ? "bg-gradient-to-br from-violet-50/50 to-transparent" : "bg-gradient-to-br from-violet-50/0 to-violet-50/0 group-hover:from-violet-50/60 group-hover:to-transparent"
                            }`} />
                            <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                              <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                                createPrCategory === "premium" ? "bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] text-violet" : "bg-gradient-to-br from-violet-50 to-[#EDE9FE] text-violet-500 group-hover:scale-105"
                              }`}>
                                <TrendingUp className="w-[18px] h-[18px]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[13px] transition-colors duration-150 ${createPrCategory === "premium" ? "text-[#5B21B6]" : "text-foreground group-hover:text-slate-800"}`} style={{ fontWeight: 600 }}>Premium</p>
                                <p className={`text-[11px] mt-0.5 truncate transition-colors duration-150 ${createPrCategory === "premium" ? "text-violet-500" : "text-slate-400"}`}>Higher Price Adjustment</p>
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 shrink-0 ${createPrCategory === "premium" ? "border-violet bg-violet" : "border-slate-300 group-hover:border-[#C4B5FD]"}`}>
                                {createPrCategory === "premium" && <Check className="w-3 h-3 text-white" />}
                              </div>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                          <p className="text-slate-500">Markup on base price for express or value-added services.</p>
                          <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                            <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                            <p className="text-[11px] text-slate-700 mt-1"><span className="text-violet" style={{ fontWeight: 600 }}>15% markup</span> for expedited and priority shipping.</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Pricing Rule Details */}
                  <div className={isPresetReadOnly ? "opacity-60 pointer-events-none" : ""}>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Pricing Rule Details</span>
                      <Tooltip>
                        <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                          <p className="text-slate-500">Name and basis shown on POs and invoices.</p>
                          <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                            <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Tip</p>
                            <p className="text-[11px] text-slate-700 mt-1">Use clear names like <span className="text-primary" style={{ fontWeight: 600 }}>Q4 Volume Discount</span> or <span className="text-primary" style={{ fontWeight: 600 }}>VIP Premium</span>.</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-4">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {/* Row 1: Name + Basis */}
                        <div>
                          <label className="text-[12px] text-foreground mb-1.5 block" style={{ fontWeight: 500 }}>{createPrCategory === "discount" ? "Discount" : "Premium"} Name</label>
                          <Input value={createPrName} onChange={(e) => setCreatePrName(e.target.value)} placeholder={`e.g. ${createPrCategory === "discount" ? "Volume Discount for Q4" : "Premium Markup for VIP"}`} className="h-9 rounded-lg border-border bg-white text-[13px] text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-1.5">
                            <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Calculation Basis</label>
                            <Tooltip>
                              <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                              <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                <p className="text-slate-500">Measure thresholds by units ordered or order value.</p>
                                <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                                  <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                                  <p className="text-[11px] text-slate-700 mt-1"><span className="text-primary" style={{ fontWeight: 600 }}>Volume</span>: 500+ units. <span className="text-primary" style={{ fontWeight: 600 }}>Value</span>: orders over $10K.</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="flex items-center gap-2">
                            {(["volume", "value"] as const).map((b) => (
                              <button
                                key={b}
                                onClick={() => {
                                  if (createPrBasis !== b) {
                                    setCreatePrBasis(b);
                                    // Clear tier thresholds when switching basis — old quantity values
                                    // shouldn't linger as dollar amounts and vice versa.
                                    setCreatePrTiers(prev => prev.map(t => ({ ...t, minQty: "", maxQty: "" })));
                                  }
                                }}
                                className={`inline-flex items-center gap-1.5 flex-1 justify-center h-9 rounded-lg border text-[12px] transition-all cursor-pointer ${
                                  createPrBasis === b
                                    ? createPrCategory === "discount" ? "border-green-600/30 bg-green-50 text-[#15803D]" : "border-violet/30 bg-violet-50 text-[#6D28D9]"
                                    : "border-border bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
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
                            expandMode="contained"
                          />
                        </div>
                      </div>
                      {/* Validity Period — inline toggle that expands within the card */}
                      <div className="mt-3">
                        <div className="flex items-center gap-2.5">
                          <Switch checked={createPrLimitDateRange} onCheckedChange={setCreatePrLimitDateRange} />
                          <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>Set Validity Period</span>
                          <span className="text-[11px] text-slate-400 bg-muted px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>Optional</span>
                          <Tooltip>
                            <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                              <p className="text-slate-500">Set a date range. If off, rule applies indefinitely.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        {createPrLimitDateRange && (
                          <div className="grid grid-cols-2 gap-4 mt-3">
                            <div>
                              <div className="flex items-center gap-1 mb-1.5">
                                <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Valid From</label>
                                <Tooltip>
                                  <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                                  <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                    <p className="text-slate-500">Rule starts applying from this date.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <Input type="date" value={createPrValidFrom} onChange={(e) => setCreatePrValidFrom(e.target.value)} className="h-9 rounded-lg border-border bg-white text-[13px] text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1 mb-1.5">
                                <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Valid To</label>
                                <Tooltip>
                                  <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                                  <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                    <p className="text-slate-500">Rule auto-deactivates after this date.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <Input type="date" value={createPrValidTo} onChange={(e) => setCreatePrValidTo(e.target.value)} className="h-9 rounded-lg border-border bg-white text-[13px] text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20" />
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
                        <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>{createPrCategory === "discount" ? "Discount" : "Premium"} Tiers</span>
                        <span className="text-[11px] text-slate-400 bg-muted px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>{createPrTiers.length}</span>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {createPrTiers.map((tier, idx) => {
                        const isDis = createPrCategory === "discount";
                        const accent = isDis ? "#16A34A" : "rgb(var(--violet))";
                        const accentBg = isDis ? "#F0FDF4" : "#F5F3FF";
                        const accentBorder = isDis ? "#BBF7D0" : "#DDD6FE";
                        return (
                        <div key={idx} className="rounded-xl border bg-white overflow-hidden transition-all" style={{ borderColor: tier.qtyLimits ? accentBorder : "rgb(var(--border))" }}>
                          {/* Header */}
                          <div className="flex items-center justify-between px-3.5 py-2 border-b border-muted" style={{ backgroundColor: accentBg }}>
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] text-white" style={{ fontWeight: 700, backgroundColor: accent }}>{idx + 1}</span>
                              <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Tier {idx + 1}</span>
                            </div>
                            {idx > 0 && (
                              <button
                                onClick={() => removeCpmTier(idx)}
                                className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-white/60 transition-all cursor-pointer"
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
                                  <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                                    {isDis ? "Discount" : "Premium"} {tier.fixRate ? "Amount" : "Rate"}
                                  </label>
                                  <PctAmountToggle
                                    isFixed={tier.fixRate}
                                    onChange={(fixed) => updateCpmTier(idx, { fixRate: fixed })}
                                    percentTooltip={`${isDis ? "Discount" : "Premium"} applied as a percentage of the line value.`}
                                    amountTooltip={`${isDis ? "Discount" : "Premium"} applied as a fixed amount in USD.`}
                                  />
                                </div>
                                <div className="relative">
                                  {tier.fixRate && (
                                    <CurrencySymbol code={RULE_CURRENCY} className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400" />
                                  )}
                                  <Input value={tier.discount} onChange={(e) => updateCpmTier(idx, { discount: e.target.value })} placeholder={tier.fixRate ? "e.g. 25.00" : "e.g. 50"} className={`rounded-lg border-border bg-white text-[13px] h-9 text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 ${tier.fixRate ? "pl-7 pr-3" : "pr-8"}`} />
                                  {!tier.fixRate && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">%</span>
                                  )}
                                </div>
                                {tier.fixRate && <RuleAmountPreview raw={tier.discount ?? ""} from={RULE_CURRENCY} to={currencyCodeOf(currency) ?? BASE_CURRENCY} />}
                              </div>

                              {/* Quantity limits toggle */}
                              <div className="flex items-end h-full pb-[7px]">
                                <label
                                  className="flex items-center gap-2 cursor-pointer select-none"
                                  onClick={() => updateCpmTier(idx, { qtyLimits: !tier.qtyLimits })}
                                >
                                  <div className={`w-[16px] h-[16px] rounded-[4px] flex items-center justify-center shrink-0 transition-colors ${tier.qtyLimits ? "bg-primary" : "border-[1.5px] border-slate-300 bg-white hover:border-slate-400"}`}>
                                    {tier.qtyLimits && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                                  </div>
                                  <span className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>{createPrBasis === "volume" ? "Order Qty Limits" : "Order Value Limits"}</span>
                                  <span onClick={(e) => e.stopPropagation()}>
                                    <InfoTooltip>{createPrBasis === "volume"
                                      ? "Restricts this tier to orders within a specific quantity range. When enabled, the tier only applies when the order quantity falls between Min and Max."
                                      : "Restricts this tier to orders within a specific dollar-value range. When enabled, the tier only applies when the order total falls between Min and Max."}</InfoTooltip>
                                  </span>
                                </label>
                              </div>
                            </div>

                            {/* Expanded qty fields */}
                            {tier.qtyLimits && (
                              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-muted">
                                <div>
                                  <div className="flex items-center gap-1 mb-1.5">
                                    <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{createPrBasis === "volume" ? "Min Qty" : "Min Order Value"}</label>
                                    <InfoTooltip>{createPrBasis === "volume"
                                      ? "The smallest order quantity at which this tier starts to apply. Orders below this value fall into a lower tier or get no adjustment."
                                      : "The smallest order value (in USD, the currency pricing rules are written in) at which this tier starts to apply. Orders below this value fall into a lower tier or get no adjustment."}</InfoTooltip>
                                  </div>
                                  <div className="relative">
                                    {createPrBasis === "value" && (
                                      <CurrencySymbol code={RULE_CURRENCY} className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400" />
                                    )}
                                    <Input value={tier.minQty} onChange={(e) => updateCpmTier(idx, { minQty: e.target.value })} placeholder={createPrBasis === "volume" ? "e.g. 100" : "e.g. 1,000"} className={`rounded-lg border-border bg-white text-[13px] h-9 text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 ${createPrBasis === "value" ? "pl-7" : ""}`} />
                                  </div>
                                  {createPrBasis === "value" && <RuleAmountPreview raw={tier.minQty ?? ""} from={RULE_CURRENCY} to={currencyCodeOf(currency) ?? BASE_CURRENCY} />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1 mb-1.5">
                                    <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{createPrBasis === "volume" ? "Max Qty" : "Max Order Value"}</label>
                                    <InfoTooltip>{createPrBasis === "volume"
                                      ? "The largest order quantity this tier covers. Orders above this value roll into the next tier or stop receiving this adjustment."
                                      : "The largest order value (in USD, the currency pricing rules are written in) this tier covers. Orders above this value roll into the next tier or stop receiving this adjustment."}</InfoTooltip>
                                  </div>
                                  <div className="relative">
                                    {createPrBasis === "value" && (
                                      <CurrencySymbol code={RULE_CURRENCY} className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400" />
                                    )}
                                    <Input value={tier.maxQty} onChange={(e) => updateCpmTier(idx, { maxQty: e.target.value })} placeholder={createPrBasis === "volume" ? "e.g. 500" : "e.g. 5,000"} className={`rounded-lg border-border bg-white text-[13px] h-9 text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 ${createPrBasis === "value" ? "pl-7" : ""}`} />
                                  </div>
                                  {createPrBasis === "value" && <RuleAmountPreview raw={tier.maxQty ?? ""} from={RULE_CURRENCY} to={currencyCodeOf(currency) ?? BASE_CURRENCY} />}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                    <button onClick={addCpmTier} className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg border border-dashed text-[12px] transition-all cursor-pointer w-full justify-center ${createPrCategory === "discount" ? "border-[#BBF7D0] text-green-600 hover:bg-green-50 hover:border-[#86EFAC]" : "border-[#DDD6FE] text-violet hover:bg-violet-50 hover:border-[#C4B5FD]"}`} style={{ fontWeight: 600 }}>
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
                  <div className="rounded-xl border border-border bg-white p-3.5 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${createPrCategory === "discount" ? "bg-gradient-to-br from-[#DCFCE7] to-[#BBF7D0]" : "bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE]"}`}>
                      {createPrCategory === "discount" ? <TrendingDown className="w-4.5 h-4.5 text-[#15803D]" /> : <TrendingUp className="w-4.5 h-4.5 text-violet" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{createPrName || "Untitled Rule"}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {createPrCategory === "discount" ? "Discount" : "Premium"} · {createPrBasis === "volume" ? "Volume-Based" : "Value-Based"} · {createPrTiers.length} tier{createPrTiers.length !== 1 ? "s" : ""}
                        {createPrTiers[0]?.discount ? ` · ${createPrTiers[0].discount}${createPrTiers[0].fixRate ? "$" : "%"}` : ""}
                      </p>
                    </div>
                    <button onClick={() => setCreatePrStep(1)} className="text-[11px] text-primary hover:text-[#086AE6] transition-colors cursor-pointer shrink-0" style={{ fontWeight: 600 }}>{createPrMode === "view" ? "View Setup" : "Edit Setup"}</button>
                  </div>

                  {/* Applies to — Specific items & categories / All items */}
                  <ItemScopeToggle
                    value={createPrItemScope}
                    disabled={createPrMode === "view"}
                    onChange={(v) => { setCreatePrItemScope(v); setCreatePrItemsTab("items"); }}
                  />

                  {/* Items, Categories & Attachments card */}
                  <div className="rounded-xl border border-border bg-white overflow-hidden">
                    <div className="flex items-center gap-0 border-b border-border px-4">
                      {([
                        { key: "items" as const, label: "Items" },
                        { key: "categories" as const, label: "Categories" },
                        { key: "attachments" as const, label: "Attachments" },
                      ]).map((t) => (
                        <button
                          key={t.key}
                          onClick={() => setCreatePrItemsTab(t.key)}
                          className={`relative px-3 py-2.5 text-[12px] flex items-center transition-colors cursor-pointer ${createPrItemsTab === t.key ? "text-primary" : "text-slate-500 hover:text-slate-700"}`}
                          style={{ fontWeight: createPrItemsTab === t.key ? 600 : 500 }}
                        >
                          {t.label}
                          {createPrItemsTab === t.key && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-primary" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Tab content — Items */}
                    {createPrItemScope === "all" && createPrItemsTab !== "attachments" && (
                      <AllItemsCoverage kind={createPrItemsTab} showWarning={createPrMode !== "view"} />
                    )}
                    {createPrItemScope !== "all" && createPrItemsTab === "items" && (
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input
                              value={cpmItemSearch}
                              onChange={(e) => setCpmItemSearch(e.target.value)}
                              placeholder="Search assigned items..."
                              className="pl-9 rounded-lg border-border bg-slate-50 text-[13px] h-9"
                            />
                          </div>
                          <button
                            onClick={() => setCpmShowItemPicker(true)}
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary hover:bg-[#086AE6] text-white text-[12px] shadow-sm transition-colors cursor-pointer"
                            style={{ fontWeight: 600 }}
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Items
                          </button>
                        </div>

                        {/* Selected items list */}
                        {cpmSelectedItems.length > 0 ? (
                          <div className="space-y-1.5">
                            {cpmFilteredSelectedItems.map((item) => (
                              <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#E8ECF1] bg-white hover:border-slate-300 transition-all group">
                                <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${item.status === "Active" ? "bg-green-50" : "bg-red-50"}`}>
                                  <Package className={`w-3.5 h-3.5 ${item.status === "Active" ? "text-green-600" : "text-red-500"}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>{item.partNo}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${item.status === "Active" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`} style={{ fontWeight: 600 }}>{item.status}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 truncate">{item.description}</p>
                                </div>
                                <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-muted hidden sm:inline">{item.category}</span>
                                <span className="text-[10px] text-slate-500 px-1.5 py-0.5 rounded border border-border hidden sm:inline">{item.itemType}</span>
                                <button
                                  onClick={() => { cpmRemoveItem(item.id); toast("Item removed"); }}
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-8 text-center">
                            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                              <Package className="w-5 h-5 text-slate-400" />
                            </div>
                            <p className="text-[13px] text-slate-700 mb-1" style={{ fontWeight: 600 }}>No items assigned yet</p>
                            <p className="text-[11px] text-slate-400 max-w-[260px] mx-auto">Search and add items that should be affected by this pricing rule.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab content — Categories */}
                    {createPrItemScope !== "all" && createPrItemsTab === "categories" && (
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input
                              value={cpmCatSearch}
                              onChange={(e) => setCpmCatSearch(e.target.value)}
                              placeholder="Search assigned categories..."
                              className="pl-9 rounded-lg border-border bg-slate-50 text-[13px] h-9"
                            />
                          </div>
                          <button
                            onClick={() => setCpmShowCatPicker(true)}
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary hover:bg-[#086AE6] text-white text-[12px] shadow-sm transition-colors cursor-pointer"
                            style={{ fontWeight: 600 }}
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Categories
                          </button>
                        </div>

                        {/* Selected categories list */}
                        {cpmSelectedCats.length > 0 ? (
                          <div className="space-y-1.5">
                            {cpmFilteredSelectedCats.map((cat) => (
                              <div key={cat.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#E8ECF1] bg-white hover:border-slate-300 transition-all group">
                                <div className="w-7 h-7 rounded-md bg-violet-50 flex items-center justify-center shrink-0">
                                  <FolderOpen className="w-3.5 h-3.5 text-violet-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>{cat.name}</span>
                                    <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-muted">{cat.code}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 truncate">{cat.description} · {cat.linkedItems} linked items</p>
                                </div>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] ${cat.status === "Active" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`} style={{ fontWeight: 600 }}>{cat.status}</span>
                                <button
                                  onClick={() => { cpmRemoveCat(cat.id); toast("Category removed"); }}
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-8 text-center">
                            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                              <FolderOpen className="w-5 h-5 text-slate-400" />
                            </div>
                            <p className="text-[13px] text-slate-700 mb-1" style={{ fontWeight: 600 }}>No categories assigned yet</p>
                            <p className="text-[11px] text-slate-400 max-w-[260px] mx-auto">Assign categories to apply this pricing rule to all items within them.</p>
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
                              <div key={att.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#E8ECF1] bg-white hover:border-slate-300 transition-all group">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                  <FileText className="w-4 h-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}>{att.name}</p>
                                  <p className="text-[10px] text-slate-400">{att.size} · {att.type} · {att.uploadedAt}</p>
                                </div>
                                <button
                                  onClick={() => cpmRemoveAttachment(att.id)}
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <div className="py-6 text-center border-2 border-dashed border-border rounded-xl bg-[#FAFBFC]">
                          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-[#E8ECF1] border-dashed flex items-center justify-center mx-auto mb-3">
                            <Upload className="w-5 h-5 text-slate-400" />
                          </div>
                          <p className="text-[13px] text-slate-700 mb-1" style={{ fontWeight: 600 }}>
                            {cpmAttachments.length > 0 ? "Upload More Files" : "No attachments yet"}
                          </p>
                          <p className="text-[11px] text-slate-400 max-w-[280px] mx-auto mb-3">Upload supporting documents, contracts, or approval files for this pricing rule.</p>
                          <button
                            onClick={cpmAddAttachment}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-white text-[12px] text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
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
            <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-white shrink-0">
              <div>
                {createPrStep === 2 && (
                  <button onClick={() => setCreatePrStep(1)} className="px-4 py-2 rounded-lg border border-border bg-white text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer" style={{ fontWeight: 600 }}>
                    <ArrowLeft className="w-3.5 h-3.5 inline mr-1.5" />Back
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {createPrMode === "view" ? (
                  createPrStep === 1 ? (
                    <>
                      <button onClick={() => { setCreatePrModalOpen(false); resetCreatePrForm(); }} className="px-4 py-2 rounded-lg border border-border bg-white text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer" style={{ fontWeight: 600 }}>Close</button>
                      {editingPrRuleId?.startsWith("pr-custom-") && (
                        <button onClick={() => { setCreatePrMode("create"); }} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-blue-100 bg-blue-50 text-[13px] text-primary hover:bg-blue-100 transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                          <Pencil className="w-3.5 h-3.5" /> Edit Rule
                        </button>
                      )}
                      <button onClick={() => setCreatePrStep(2)} className="px-4 py-2 rounded-lg bg-primary text-white text-[13px] hover:bg-[#086AE6] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                        View Items & Categories
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setCreatePrModalOpen(false); resetCreatePrForm(); }} className="px-4 py-2 rounded-lg border border-border bg-white text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer" style={{ fontWeight: 600 }}>Close</button>
                      <button
                        onClick={() => {
                          toast.success(`Saved changes: ${cpmSelectedItems.length} items, ${cpmSelectedCats.length} categories, ${cpmAttachments.length} attachments`);
                          setCreatePrModalOpen(false);
                          resetCreatePrForm();
                        }}
                        className="px-4 py-2 rounded-lg bg-primary text-white text-[13px] hover:bg-[#086AE6] transition-colors cursor-pointer"
                        style={{ fontWeight: 600 }}
                      >
                        Save Changes
                      </button>
                    </>
                  )
                ) : (
                  createPrStep === 1 ? (
                    <>
                      <button onClick={() => { setCreatePrModalOpen(false); resetCreatePrForm(); }} className="px-4 py-2 rounded-lg border border-border bg-white text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer" style={{ fontWeight: 600 }}>Cancel</button>
                      <button onClick={() => setCreatePrStep(2)} disabled={!createPrName.trim()} className="px-4 py-2 rounded-lg bg-primary text-white text-[13px] hover:bg-[#086AE6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" style={{ fontWeight: 600 }}>Continue</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setCreatePrModalOpen(false); resetCreatePrForm(); }} className="px-4 py-2 rounded-lg border border-border bg-white text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer" style={{ fontWeight: 600 }}>Discard</button>
                      <button onClick={() => handleSaveNewPricingRule()} disabled={!createPrName.trim()} className="px-4 py-2 rounded-lg bg-primary text-white text-[13px] hover:bg-[#086AE6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" style={{ fontWeight: 600 }}>
                        {editingPrRuleId ? "Save" : "Save & Apply"}
                      </button>
                    </>
                  )
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <AllItemsConfirmDialog
          open={createPrAllItemsConfirmOpen}
          onOpenChange={setCreatePrAllItemsConfirmOpen}
          onConfirm={() => handleSaveNewPricingRule(true)}
          ruleName={createPrName}
          isEdit={!!editingPrRuleId}
        />

        {/* ── Items picker (Step 2 of Create Pricing Rule) — the canonical
            Manage Items modal from the Items tab, same as the partner
            detail Pricing Rules wizard. generic=true stacks it above
            the wizard (z-230 / overlay z-225) and drops the trade pill. */}
        <AddItemModal
          open={cpmShowItemPicker}
          onOpenChange={setCpmShowItemPicker}
          existingItemIds={new Set(cpmSelectedItems.map((it) => it.id))}
          existingItems={cpmSelectedItems}
          onItemsAdded={(items) => {
            setCpmSelectedItems((prev) => {
              const existing = new Set(prev.map((it) => it.id));
              return [...prev, ...items.filter((it) => !existing.has(it.id))];
            });
          }}
          onItemRemoved={cpmRemoveItem}
          activeSubTab="sell"
          generic
          contextLabel={createPrName || "Pricing Rule"}
          contextType={createPrCategory === "premium" ? "premium" : "discount"}
          partnerId="new-partner-group"
        />

        {/* ── Categories picker — canonical Manage Categories modal. */}
        <ManageCategoriesModal
          open={cpmShowCatPicker}
          onOpenChange={setCpmShowCatPicker}
          addedCategories={cpmSelectedCats}
          onAdd={(cats) => {
            setCpmSelectedCats((prev) => [...prev, ...cats]);
            toast.success(`${cats.length} categor${cats.length !== 1 ? "ies" : "y"} added`);
          }}
          onRemove={(ids) => setCpmSelectedCats((prev) => prev.filter((c) => !ids.includes(c.id)))}
          contextLabel={createPrName || "Pricing Rule"}
          contextType={createPrCategory === "premium" ? "premium" : "discount"}
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
          // Detail-modal Duplicate routes through the canonical
          // duplicate flow — opens Create Pricing Rule pre-filled
          // with the source rule's data. Same UX as Browse
          // Templates Duplicate + the partner-detail Duplicate.
          onDuplicate={(r) => {
            setPrDetailOpen(false);
            handleDuplicatePricingRule(r);
          }}
          onDisable={(r) => {
            toast.success(`"${r.name}" has been disabled`);
            setPrDetailOpen(false);
          }}
        />
      </div>
    );
  }

  if (sectionId === "shipping_methods" || sectionId === "customer_shipping_methods") {
    const isCustomerCfg = sectionId === "customer_shipping_methods";
    const CARRIER_CATALOG = SHIPPING_CARRIER_CATALOG;
    const CARRIER_METHODS = SHIPPING_CARRIER_METHODS;

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
        { id: `vsp-${Date.now()}`, carrier: "", methods: "", isDefault: prev.length === 0, primaryMethod: "" },
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

    // ── Shipping modal helpers ──
    function openAddShippingModal() {
      setShippingDrafts([{ id: `vsp-${Date.now()}`, carrier: "", methods: "", isDefault: vendorShippingPrefs.length === 0, primaryMethod: "" }]);
      setEditingShippingId(null);
      setAddShippingModalOpen(true);
    }
    function openEditShippingModal(entryId: string) {
      const entry = vendorShippingPrefs.find((e) => e.id === entryId);
      if (!entry) return;
      setShippingDrafts([{ ...entry, primaryMethod: entry.primaryMethod || "" }]);
      setEditingShippingId(entryId);
      setAddShippingModalOpen(true);
    }
    function hasDraftData() {
      return shippingDrafts.some((d) => d.carrier || d.methods);
    }
    function handleShippingModalClose() {
      if (hasDraftData()) { setDiscardShippingConfirmOpen(true); return; }
      setAddShippingModalOpen(false);
      setShippingDrafts([]);
      setEditingShippingId(null);
    }
    function confirmDiscardShipping() {
      setDiscardShippingConfirmOpen(false);
      setAddShippingModalOpen(false);
      setShippingDrafts([]);
      setEditingShippingId(null);
    }
    function confirmSaveShipping() {
      const valid = shippingDrafts.filter((d) => d.carrier);
      if (valid.length === 0) { toast.error("Please select a carrier for at least one entry"); return; }
      if (editingShippingId) {
        // Editing existing entry — replace it
        setVendorShippingPrefs((prev) => prev.map((e) => e.id === editingShippingId ? { ...valid[0] } : e));
        toast.success("Shipping method updated");
      } else {
        // Adding new entries
        setVendorShippingPrefs((prev) => [...prev, ...valid]);
        toast.success(`${valid.length} shipping method${valid.length > 1 ? "s" : ""} added`);
      }
      setAddShippingModalOpen(false);
      setShippingDrafts([]);
      setEditingShippingId(null);
    }
    function addDraftEntry() {
      setShippingDrafts((prev) => [...prev, { id: `vsp-${Date.now()}`, carrier: "", methods: "", isDefault: false, primaryMethod: "" }]);
    }

    // ── Create Shipping Method modal helpers ──
    // Open the inline modal pre-bound to a carrier + draft so saved methods
    // know where to appear and which draft to auto-select into.
    function openCreateMethodModal(carrierId: string, draftId: string) {
      setCreateSmForCarrier(carrierId);
      setCreateSmForEntry(draftId);
      setEditingCustomMethodId("");
      setCreateSmMethods([{ id: `csm-${Date.now()}`, name: "", description: "", minDuration: "", maxDuration: "", leadUnit: "days", mode: "", packageTypes: [], isDefault: true, showCoverage: false, packagingMode: "standard", weight: "", weightUnit: "lb", length: "", width: "", height: "", dimensionUnit: "in" }]);
      setCreateShippingMethodOpen(true);
    }
    // Edit-mode entry point. Pre-populates the modal with one row reflecting
    // the existing method so the user sees their data, not a blank form.
    function openEditCustomMethodModal(carrierId: string, method: CarrierMethodEntry) {
      setCreateSmForCarrier(carrierId);
      setCreateSmForEntry("");
      setEditingCustomMethodId(method.id);
      setCreateSmMethods([{
        id: `csm-edit-${method.id}`,
        name: method.name,
        description: method.desc,
        minDuration: method.minDays > 0 ? String(method.minDays) : "",
        maxDuration: method.maxDays > 0 ? String(method.maxDays) : "",
        leadUnit: method.leadTimeUnit || "days",
        mode: method.mode || "",
        packageTypes: method.packageTypes ? [...method.packageTypes] : [],
        isDefault: !!method.isDefault,
        showCoverage: !!((method.packageTypes && method.packageTypes.length) || method.dimensions),
        packagingMode: method.dimensions ? "custom" : "standard",
        weight: method.dimensions?.weight ?? "",
        length: method.dimensions?.length ?? "",
        width: method.dimensions?.width ?? "",
        height: method.dimensions?.height ?? "",
      }]);
      setCreateShippingMethodOpen(true);
    }
    function updateCsmRow(id: string, updates: Partial<typeof createSmMethods[0]>) {
      setCreateSmMethods((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    }
    function discardCreateMethodModal() {
      setCreateShippingMethodOpen(false);
      setCreateSmForCarrier("");
      setCreateSmForEntry("");
      setEditingCustomMethodId("");
      setCreateSmMethods([{ id: `csm-1`, name: "", description: "", minDuration: "", maxDuration: "", leadUnit: "days", mode: "", packageTypes: [], isDefault: true, showCoverage: false, packagingMode: "standard", weight: "", weightUnit: "lb", length: "", width: "", height: "", dimensionUnit: "in" }]);
    }
    function saveCreateMethodModal() {
      const carrierId = createSmForCarrier;
      const draftId = createSmForEntry;
      if (!carrierId) { toast.error("No carrier selected"); return; }
      const validRows = createSmMethods.filter((r) => r.name.trim());
      if (validRows.length === 0) {
        // Highlight every row that's missing a name with the inline
        // error state instead of toasting.
        const errs: Record<string, boolean> = {};
        for (const r of createSmMethods) {
          if (!r.name.trim()) errs[r.id] = true;
        }
        setCreateSmNameErrors(errs);
        return;
      }
      // Mode is required at save time — see CreatePartnerModal for rationale.
      if (validRows.some((r) => !r.mode)) { toast.error("Pick a transportation mode"); return; }

      // Coverage persistence is mode-gated: standard mode keeps the package-
      // type pills; custom mode swaps them for explicit Weight/L/W/H. Only
      // the active branch is written so the saved entry tells you which mode
      // was used at create-time.
      const buildDimensions = (r: typeof createSmMethods[0]) => {
        if (r.packagingMode !== "custom") return undefined;
        const w = r.weight.trim(), l = r.length.trim(), wd = r.width.trim(), h = r.height.trim();
        if (!w && !l && !wd && !h) return undefined;
        // Append the unit so the saved string reads "12 lb" / "30 cm".
        const wu = r.weightUnit || "lb";
        const du = r.dimensionUnit || "in";
        return {
          ...(w ? { weight: `${w} ${wu}` } : {}),
          ...(l ? { length: `${l} ${du}` } : {}),
          ...(wd ? { width: `${wd} ${du}` } : {}),
          ...(h ? { height: `${h} ${du}` } : {}),
        };
      };

      // Edit mode: replace the existing custom method in place.
      if (editingCustomMethodId) {
        const r = validRows[0];
        const trimmedName = r.name.trim();
        const min = parseInt(r.minDuration, 10);
        const max = parseInt(r.maxDuration, 10);
        const dimensions = buildDimensions(r);
        setCustomMethods((prev) => ({
          ...prev,
          [carrierId]: (prev[carrierId] || []).map((m) =>
            m.id === editingCustomMethodId
              ? {
                  ...m,
                  name: trimmedName,
                  shortName: trimmedName.split(/\s+/)[0] || trimmedName.slice(0, 8),
                  desc: r.description.trim(),
                  minDays: Number.isFinite(min) ? min : 0,
                  maxDays: Number.isFinite(max) ? max : 0,
                  isDefault: r.isDefault,
                  mode: r.mode || undefined,
                  leadTimeUnit: r.leadUnit,
                  packageTypes: r.packagingMode === "standard" && r.packageTypes.length ? [...r.packageTypes] : undefined,
                  dimensions,
                }
              : m,
          ),
        }));
        toast.success("Shipping method updated");
        setCreateShippingMethodOpen(false);
        setCreateSmForCarrier("");
        setCreateSmForEntry("");
        setEditingCustomMethodId("");
        setCreateSmMethods([{ id: `csm-1`, name: "", description: "", minDuration: "", maxDuration: "", leadUnit: "days", mode: "", packageTypes: [], isDefault: true, showCoverage: false, packagingMode: "standard", weight: "", weightUnit: "lb", length: "", width: "", height: "", dimensionUnit: "in" }]);
        return;
      }

      const newMethods: CarrierMethodEntry[] = validRows.map((r, idx) => {
        const trimmedName = r.name.trim();
        const min = parseInt(r.minDuration, 10);
        const max = parseInt(r.maxDuration, 10);
        const dimensions = buildDimensions(r);
        return {
          id: `cust-${carrierId}-${Date.now()}-${idx}`,
          name: trimmedName,
          shortName: trimmedName.split(/\s+/)[0] || trimmedName.slice(0, 8),
          desc: r.description.trim(),
          minDays: Number.isFinite(min) ? min : 0,
          maxDays: Number.isFinite(max) ? max : 0,
          cost: "—",
          isDefault: r.isDefault,
          mode: r.mode || undefined,
          leadTimeUnit: r.leadUnit,
          packageTypes: r.packagingMode === "standard" && r.packageTypes.length ? [...r.packageTypes] : undefined,
          dimensions,
        };
      });
      setCustomMethods((prev) => ({
        ...prev,
        [carrierId]: [...(prev[carrierId] || []), ...newMethods],
      }));
      if (draftId) {
        setShippingDrafts((prev) => prev.map((d) => {
          if (d.id !== draftId) return d;
          const existing = d.methods ? d.methods.split(",").filter(Boolean) : [];
          const newIds = newMethods.map((m) => m.id);
          const merged = Array.from(new Set([...existing, ...newIds]));
          const newDefault = newMethods.find((m) => m.isDefault);
          return {
            ...d,
            methods: merged.join(","),
            primaryMethod: newDefault ? newDefault.id : (d.primaryMethod || newIds[0] || ""),
          };
        }));
      }
      toast.success("Shipping method created");
      setCreateShippingMethodOpen(false);
      setCreateSmForCarrier("");
      setCreateSmForEntry("");
      setCreateSmMethods([{ id: `csm-1`, name: "", description: "", minDuration: "", maxDuration: "", leadUnit: "days", mode: "", packageTypes: [], isDefault: true, showCoverage: false, packagingMode: "standard", weight: "", weightUnit: "lb", length: "", width: "", height: "", dimensionUnit: "in" }]);
    }
    function removeDraftEntry(id: string) {
      setShippingDrafts((prev) => {
        const next = prev.filter((d) => d.id !== id);
        if (next.length > 0 && !next.some((d) => d.isDefault)) next[0].isDefault = true;
        return next;
      });
    }
    function updateDraft(id: string, updates: Partial<typeof shippingDrafts[0]>) {
      setShippingDrafts((prev) => prev.map((d) => d.id === id ? { ...d, ...updates } : d));
    }
    function toggleDraftDefault(id: string) {
      setShippingDrafts((prev) => prev.map((d) => ({ ...d, isDefault: d.id === id })));
    }

    // In Carrier-profile context, skip the carrier-picker modal and open the
    // Create Shipping Method modal directly — the partner *is* the carrier,
    // so there's nothing to pick.
    const isCarrierCfg = activeSubType === "carrier";
    const handleAddCtaClick = () => {
      if (isCarrierCfg) {
        openCreateMethodModal("self", "");
      } else {
        openAddShippingModal();
      }
    };

    return (
      <div className="space-y-4">
        {/* ── Section Header ── */}
        <div>
          <h4 className="text-sm text-foreground" style={{ fontWeight: 700 }}>{activeSubType === "carrier" ? "Carrier" : "Freight & Logistics"}</h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {activeSubType === "carrier"
              ? "Set up this group as a carrier template: list the shipping methods (Ground, Express, Overnight, etc.) every partner created under it will offer by default. Partners can override their own list later. "
              : isCustomerCfg
              ? "Default freight and shipping methods inherited by every customer created under this template, used for sales orders and outbound deliveries. Partners can pick a different default. "
              : "Default freight and shipping methods inherited by every vendor created under this template, used for purchase orders and inbound shipments. Partners can pick a different default. "}
            <span className="text-primary inline-flex items-center gap-0.5 cursor-pointer hover:underline" style={{ fontWeight: 500 }}>
              Learn More <ExternalLink className="w-3 h-3" />
            </span>
          </p>
        </div>

        {/* Carrier and non-carrier profiles render distinct sources:
              - Carrier profile: methods THIS group offers as a freight
                company → customMethods["self"], rendered with
                CarrierSelfMethodCard (mode icon + range + package types).
              - Non-carrier: external carriers picked for inbound/
                outbound logistics → vendorShippingPrefs, rendered with
                ShippingMethodCarrierCard (carrier logo + method chips). */}
        {isCarrierCfg ? (
          (customMethods["self"] || []).length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border bg-white py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <Truck className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>No carrier methods yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[300px]">
                Add the default shipping methods this carrier group offers (e.g., Ground, Express, Overnight), partners under this template will inherit them.
              </p>
              <button
                onClick={handleAddCtaClick}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs transition-colors hover:bg-primary/90 shadow-sm"
                style={{ fontWeight: 600 }}
              >
                <Plus className="w-3.5 h-3.5" /> Add Shipping Method
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  <span style={{ fontWeight: 600 }}>{(customMethods["self"] || []).length}</span> shipping method{(customMethods["self"] || []).length !== 1 ? "s" : ""} configured
                </p>
                <button
                  onClick={handleAddCtaClick}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs transition-colors hover:bg-primary/90 shadow-sm"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Shipping Method
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(customMethods["self"] || []).map((m) => (
                  <CarrierSelfMethodCard
                    key={m.id}
                    method={m}
                    onEdit={() => openEditCustomMethodModal("self", m)}
                    onRemove={() => {
                      setCustomMethods((prev) => ({
                        ...prev,
                        self: (prev["self"] || []).filter((x) => x.id !== m.id),
                      }));
                    }}
                    onSetPrimary={() => {
                      setCustomMethods((prev) => ({
                        ...prev,
                        self: (prev["self"] || []).map((x) => ({ ...x, isDefault: x.id === m.id })),
                      }));
                    }}
                  />
                ))}
              </div>
            </div>
          )
        ) : vendorShippingPrefs.length === 0 ? (
          /* ── Empty State (non-carrier) ── */
          <div className="rounded-xl border-2 border-dashed border-border bg-white py-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <Truck className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>No freight and shipping methods added</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[300px]">
              {isCustomerCfg
                ? "Choose freight and shipping methods for sales orders and deliveries to this customer."
                : "Choose freight and shipping methods for purchase orders and shipments from this vendor."}
            </p>
            <button
              onClick={handleAddCtaClick}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs transition-colors hover:bg-primary/90 shadow-sm"
              style={{ fontWeight: 600 }}
            >
              <Plus className="w-3.5 h-3.5" /> Add Freight
            </button>
          </div>
        ) : (
          /* ── Toolbar + Card Grid (non-carrier) ── */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                <span style={{ fontWeight: 600 }}>{vendorShippingPrefs.length}</span> shipping method{vendorShippingPrefs.length !== 1 ? "s" : ""} configured
              </p>
              <button
                onClick={handleAddCtaClick}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs transition-colors hover:bg-primary/90 shadow-sm"
                style={{ fontWeight: 600 }}
              >
                <Plus className="w-3.5 h-3.5" /> {activeSubType === "carrier" ? "Add Shipping Method" : "Add Freight"}
              </button>
            </div>

            {/* Card grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {vendorShippingPrefs.map((entry) => {
                // Merge custom methods so any user-created method shows up in
                // the saved-card view (delivery-window pill, method chips).
                const mergedMethodsForEntry = entry.carrier
                  ? { ...CARRIER_METHODS, [entry.carrier]: [...(CARRIER_METHODS[entry.carrier] || []), ...(customMethods[entry.carrier] || [])] }
                  : CARRIER_METHODS;
                return (
                  <ShippingMethodCarrierCard
                    key={entry.id}
                    entry={entry}
                    carrierCatalog={CARRIER_CATALOG}
                    carrierMethods={mergedMethodsForEntry}
                    onEdit={() => openEditShippingModal(entry.id)}
                    onRemove={() => removeVendorShippingPref(entry.id)}
                    onSetPrimary={() => toggleVendorDefault(entry.id)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* ── Add / Edit Shipping Method Modal ──
            modal={false} so the nested carrier + methods dropdowns
            (createPortal'd to document.body for proper z-stacking)
            can receive focus and wheel events. With modal=true Radix
            applies react-remove-scroll's scroll lock and aria-hidden
            on body siblings, which silently blocks the dropdown's
            search input and scrollable options list. */}
        {/* Manual backdrop — Radix's auto-overlay only renders when
            modal=true. We render it ourselves here so the freight
            modal still reads as a visual modal, and wire it to close
            on click. */}
        {addShippingModalOpen && createPortal(
          <div
            className="fixed inset-0 z-[245] bg-black/20"
            onClick={handleShippingModalClose}
          />,
          document.body,
        )}
        <Dialog open={addShippingModalOpen} onOpenChange={(open) => { if (!open) handleShippingModalClose(); }} modal={false}>
          <DialogContent
            className="!p-0 !gap-0 !bg-white overflow-hidden flex flex-col z-[250] !border-border/60"
            overlayClassName="!bg-black/20 !z-[250]"
            // Form-modal standard: hugs content vertically, width capped at 1320px on wide monitors
            style={{ maxWidth: "min(65vw, 960px)", width: "calc(100% - 2rem)", height: "auto", maxHeight: "90vh", borderRadius: 16, boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
            hideCloseButton
            onPointerDownOutside={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest("[data-shipping-portal]")) { e.preventDefault(); return; }
              e.preventDefault(); handleShippingModalClose();
            }}
            onEscapeKeyDown={(e) => { e.preventDefault(); handleShippingModalClose(); }}
          >
            <DialogTitle className="sr-only">{editingShippingId ? "Edit" : "Add"} Shipping Methods</DialogTitle>
            <DialogDescription className="sr-only">Configure carrier and delivery methods.</DialogDescription>

            {/* Header — PT/Pricing-Rule style: compact title row with a chip
                badge inline, subtitle below, close on the right. Matches the
                Create Shipping Method modal header for cross-modal consistency. */}
            <div className="px-4 sm:px-5 pt-4 pb-3.5 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-[16px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>
                      {editingShippingId ? "Edit Freight & Logistics" : "Add Freight & Logistics"}
                    </h2>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                      <Truck className="w-3 h-3" /> Carrier · Methods
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-500 mt-1" style={{ fontWeight: 400 }}>
                    {editingShippingId
                      ? "Update the carrier and the methods this group uses."
                      : "Pick a carrier and the methods it offers. Add another carrier below to stack multiple."}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={handleShippingModalClose}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 pt-4 pb-4 bg-[#FAFBFC] scrollbar-hide">
              <div className="space-y-3">
                {shippingDrafts.map((draft, dIdx) => {
                  const selectedCarrier = CARRIER_CATALOG.find((c) => c.id === draft.carrier);
                  // Merge baseline catalog with user-created methods so newly
                  // created methods immediately appear in this dropdown.
                  const carrierMethods = draft.carrier
                    ? [...(CARRIER_METHODS[draft.carrier] || []), ...(customMethods[draft.carrier] || [])]
                    : [];
                  const selectedMethodIds = draft.methods ? draft.methods.split(",").filter(Boolean) : [];
                  const dSearchVal = carrierSearches[draft.id] || "";
                  const filteredCarriers = dSearchVal.trim()
                    ? CARRIER_CATALOG.filter((c) => c.name.toLowerCase().includes(dSearchVal.toLowerCase()))
                    : CARRIER_CATALOG;
                  const mSearchVal = methodSearches[draft.id] || "";
                  const filteredMethods = mSearchVal.trim()
                    ? carrierMethods.filter((m) => m.name.toLowerCase().includes(mSearchVal.toLowerCase()) || m.desc.toLowerCase().includes(mSearchVal.toLowerCase()))
                    : carrierMethods;

                  const handleMethodToggle = (methodId: string) => {
                    const isRemoving = selectedMethodIds.includes(methodId);
                    const next = isRemoving
                      ? selectedMethodIds.filter((m) => m !== methodId)
                      : [...selectedMethodIds, methodId];
                    let nextPrimary = draft.primaryMethod;
                    if (isRemoving && draft.primaryMethod === methodId) {
                      nextPrimary = next[0] || "";
                    } else if (!isRemoving && !draft.primaryMethod) {
                      nextPrimary = methodId;
                    }
                    updateDraft(draft.id, { methods: next.join(","), primaryMethod: nextPrimary });
                  };
                  const handleSetPrimaryMethod = (methodId: string) => {
                    if (!selectedMethodIds.includes(methodId)) {
                      const next = [...selectedMethodIds, methodId];
                      updateDraft(draft.id, { methods: next.join(","), primaryMethod: methodId });
                    } else {
                      updateDraft(draft.id, { primaryMethod: methodId });
                    }
                  };

                  const isMulti = shippingDrafts.length > 1;
                  return (
                    <div key={draft.id} className={`rounded-lg bg-white overflow-hidden transition-all ${
                      isMulti && draft.isDefault
                        ? "border-[1.5px] border-primary/40 shadow-[0_2px_12px_-4px_rgba(10,119,255,0.12)]"
                        : "border border-border"
                    }`}>
                      {/* Card header strip — index pill (multi only) + carrier
                          name + Primary star + remove. Matches the visual
                          contract used in the new shipping/method modal. */}
                      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-[#EEF2F6] bg-[#FAFBFC]">
                        <div className="flex items-center gap-2 min-w-0">
                          {isMulti && (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 text-primary text-[11px]" style={{ fontWeight: 700 }}>
                              {dIdx + 1}
                            </span>
                          )}
                          {selectedCarrier ? (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <img src={selectedCarrier.logoImg} alt={selectedCarrier.name} className="w-4 h-4 object-contain rounded shrink-0" />
                              <span className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{selectedCarrier.name}</span>
                            </div>
                          ) : (
                            <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Carrier {dIdx + 1}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isMulti && (
                            draft.isDefault ? (
                              <PrimaryPill />
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => toggleDraftDefault(draft.id)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-white text-[10px] text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-accent transition-all cursor-pointer"
                                    style={{ fontWeight: 600 }}
                                  >
                                    <Star className="w-2.5 h-2.5" /> Set as Primary
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" sideOffset={4} className="z-[300]"><p className="text-[11px]">Mark this carrier as the group's default.</p></TooltipContent>
                              </Tooltip>
                            )
                          )}
                          {isMulti && (
                            <button
                              type="button"
                              onClick={() => removeDraftEntry(draft.id)}
                              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                              aria-label="Remove carrier"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="px-4 py-3.5 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          {/* Carrier Selector */}
                          <div>
                            <Label className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Shipping Carrier<span className="text-destructive">*</span></Label>
                            <button
                              id={`carrier-btn-${draft.id}`}
                              onClick={() => { setShippingDraftCarrierErrors((p) => ({ ...p, [draft.id]: false })); setCarrierDropdownOpen((prev) => ({ ...prev, [draft.id]: !prev[draft.id] })); }}
                              className={`mt-1 w-full flex items-center justify-between !h-10 px-3 rounded-lg border bg-white text-sm transition-colors cursor-pointer ${
                                shippingDraftCarrierErrors[draft.id]
                                  ? "border-destructive focus-within:ring-1 focus-within:ring-destructive"
                                  : "border-border hover:border-slate-300"
                              }`}
                            >
                              {selectedCarrier ? (
                                <div className="flex items-center gap-2">
                                  <img src={selectedCarrier.logoImg} alt={selectedCarrier.name} className="w-6 h-6 rounded object-contain" />
                                  <span className="text-foreground text-sm truncate">{selectedCarrier.name}</span>
                                </div>
                              ) : (
                                <span className="text-slate-300 text-sm">Select a carrier</span>
                              )}
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                            {carrierDropdownOpen[draft.id] && createPortal(
                              <>
                                <div data-shipping-portal className="fixed inset-0 z-[299]" style={{ pointerEvents: "auto" }} onClick={() => { setCarrierDropdownOpen((prev) => ({ ...prev, [draft.id]: false })); setCarrierSearches((prev) => ({ ...prev, [draft.id]: "" })); }} />
                                <div data-shipping-portal className="fixed z-[300] flex flex-col rounded-xl border border-[#E8ECF1] bg-white shadow-[0_8px_32px_-8px_rgba(0,0,0,0.16)] overflow-hidden" style={(() => {
                                  const el = document.getElementById(`carrier-btn-${draft.id}`);
                                  if (!el) return { pointerEvents: "auto" };
                                  const r = el.getBoundingClientRect();
                                  let host: HTMLElement | null = el.parentElement;
                                  while (host) {
                                    const style = window.getComputedStyle(host);
                                    if (style.overflowY === "auto" || style.overflowY === "scroll") break;
                                    host = host.parentElement;
                                  }
                                  const dialog = el.closest('[data-slot="dialog-content"]') as HTMLElement | null;
                                  const hostBottom = host
                                    ? host.getBoundingClientRect().bottom - 4
                                    : dialog ? dialog.getBoundingClientRect().bottom - 80 : window.innerHeight - 24;
                                  const available = Math.max(300, hostBottom - r.bottom - 4);
                                  return { top: r.bottom + 4, left: r.left, width: r.width, maxHeight: `min(480px, ${available}px)`, pointerEvents: "auto" };
                                })()}>
                                  <div className="p-2 border-b border-[#F1F5F9] shrink-0">
                                    <div className="relative">
                                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                      <input value={dSearchVal} onChange={(e) => setCarrierSearches((prev) => ({ ...prev, [draft.id]: e.target.value }))} placeholder="Search carriers..." className="w-full h-8 pl-8 pr-3 rounded-lg border border-[#E8ECF1] bg-white text-sm text-foreground outline-none focus:border-primary transition-colors placeholder:text-slate-300" autoFocus />
                                    </div>
                                  </div>
                                  {/* Create New Carrier — fixed header outside the scroll area. */}
                                  <div className="px-1.5 pt-1.5 pb-1 shrink-0 border-b border-[#F1F5F9]">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open("/vendors?createPartner=carrier", "_blank", "noopener,noreferrer");
                                        setCarrierDropdownOpen((prev) => ({ ...prev, [draft.id]: false }));
                                        setCarrierSearches((prev) => ({ ...prev, [draft.id]: "" }));
                                      }}
                                      className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] text-primary bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                                      style={{ fontWeight: 600 }}
                                    >
                                      <Plus className="w-3.5 h-3.5" /> Create New Carrier
                                    </button>
                                  </div>
                                  <div
                                    className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5"
                                    onWheel={(e) => {
                                      e.currentTarget.scrollTop += e.deltaY;
                                    }}
                                  >
                                    {filteredCarriers.map((c) => {
                                      const isActive = draft.carrier === c.id;
                                      return (
                                        <button key={c.id} onClick={() => { updateDraft(draft.id, { carrier: c.id, methods: "" }); setCarrierDropdownOpen((prev) => ({ ...prev, [draft.id]: false })); setCarrierSearches((prev) => ({ ...prev, [draft.id]: "" })); }} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${isActive ? "bg-primary/10" : "hover:bg-muted/60"}`}>
                                          <img src={c.logoImg} alt={c.name} className="w-6 h-6 rounded object-contain" />
                                          <span className="text-sm text-foreground flex-1 truncate" style={{ fontWeight: isActive ? 600 : 400 }}>{highlightMatch(c.name, dSearchVal)}</span>
                                          {isActive && <Check className="w-4 h-4 text-primary" />}
                                        </button>
                                      );
                                    })}
                                    {filteredCarriers.length === 0 && <p className="text-xs text-slate-400 text-center py-3">No carriers found</p>}
                                  </div>
                                </div>
                              </>,
                              document.body
                            )}
                            {shippingDraftCarrierErrors[draft.id] && (
                              <p className="mt-1 text-[10px] text-destructive" style={{ fontWeight: 500 }}>
                                Please select a carrier first
                              </p>
                            )}
                          </div>

                          {/* Methods Selector */}
                          <div>
                            <Label className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Shipping Methods</Label>
                            <button
                              id={`method-btn-${draft.id}`}
                              onClick={() => {
                                if (!draft.carrier) {
                                  // Highlight the carrier field instead of toasting.
                                  setShippingDraftCarrierErrors((p) => ({ ...p, [draft.id]: true }));
                                  return;
                                }
                                setMethodDropdownOpen((prev) => ({ ...prev, [draft.id]: !prev[draft.id] }));
                              }}
                              className="mt-1 w-full flex items-center justify-between gap-2 !h-10 px-3 rounded-lg border border-border bg-white text-sm hover:border-slate-300 transition-colors cursor-pointer overflow-hidden"
                            >
                              {selectedMethodIds.length > 0 ? (
                                (() => {
                                  const MAX_INLINE = 2;
                                  const visibleIds = selectedMethodIds.slice(0, MAX_INLINE);
                                  const overflowCount = selectedMethodIds.length - visibleIds.length;
                                  return (
                                    <div className="flex items-center gap-1 min-w-0 flex-1">
                                      {visibleIds.map((mid) => {
                                        const m = carrierMethods.find((x) => x.id === mid);
                                        if (!m) return null;
                                        const isPrimary = draft.primaryMethod === mid;
                                        return (
                                          <span
                                            key={mid}
                                            className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md border shrink-0 max-w-[140px] ${
                                              isPrimary
                                                ? "bg-primary/10 text-primary border-primary/25"
                                                : "bg-slate-50 text-slate-600 border-[#E8ECF1]"
                                            }`}
                                            style={{ fontWeight: 500 }}
                                          >
                                            {isPrimary && <Star className="w-2.5 h-2.5 fill-current shrink-0" />}
                                            <span className="truncate">{m.name}</span>
                                          </span>
                                        );
                                      })}
                                      {overflowCount > 0 && (
                                        <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-[#E8ECF1] shrink-0" style={{ fontWeight: 500 }}>
                                          +{overflowCount} more
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()
                              ) : (
                                <span className="text-slate-300 text-sm">Select methods</span>
                              )}
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            </button>
                            {methodDropdownOpen[draft.id] && carrierMethods.length > 0 && createPortal(
                              <>
                                <div data-shipping-portal className="fixed inset-0 z-[299]" style={{ pointerEvents: "auto" }} onClick={() => setMethodDropdownOpen((prev) => ({ ...prev, [draft.id]: false }))} />
                                <div data-shipping-portal className="fixed z-[300] flex flex-col rounded-xl border border-[#E8ECF1] bg-white shadow-[0_8px_32px_-8px_rgba(0,0,0,0.16)] overflow-hidden" style={(() => {
                                  const el = document.getElementById(`method-btn-${draft.id}`);
                                  if (!el) return { pointerEvents: "auto" };
                                  const r = el.getBoundingClientRect();
                                  let host: HTMLElement | null = el.parentElement;
                                  while (host) {
                                    const style = window.getComputedStyle(host);
                                    if (style.overflowY === "auto" || style.overflowY === "scroll") break;
                                    host = host.parentElement;
                                  }
                                  const dialog = el.closest('[data-slot="dialog-content"]') as HTMLElement | null;
                                  const hostBottom = host
                                    ? host.getBoundingClientRect().bottom - 4
                                    : dialog ? dialog.getBoundingClientRect().bottom - 80 : window.innerHeight - 24;
                                  const available = Math.max(300, hostBottom - r.bottom - 4);
                                  return { top: r.bottom + 4, left: r.left, width: r.width, maxHeight: `min(480px, ${available}px)`, pointerEvents: "auto" };
                                })()}>
                                  {/* Create Shipping Method — fixed header outside the scroll
                                      area so the CTA stays visible regardless of scroll. */}
                                  <div className="px-1.5 pt-1.5 pb-1 shrink-0 border-b border-[#F1F5F9]">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMethodDropdownOpen((prev) => ({ ...prev, [draft.id]: false }));
                                        openCreateMethodModal(draft.carrier, draft.id);
                                      }}
                                      className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] text-primary bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                                      style={{ fontWeight: 600 }}
                                    >
                                      <Plus className="w-3.5 h-3.5" /> Create Shipping Method
                                    </button>
                                  </div>
                                  <div
                                    className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5"
                                    onWheel={(e) => {
                                      e.currentTarget.scrollTop += e.deltaY;
                                    }}
                                  >
                                    {filteredMethods.map((method) => {
                                    const isChecked = selectedMethodIds.includes(method.id);
                                    const isPrimary = draft.primaryMethod === method.id;
                                    return (
                                      <div key={method.id} onClick={() => handleMethodToggle(method.id)} className={`group/method w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${isChecked ? "bg-primary/5" : "hover:bg-muted/60"}`}>
                                        <div className={`mt-0.5 w-4 h-4 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${isChecked ? "border-primary bg-primary" : "border-border bg-background"}`}>
                                          {isChecked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{highlightMatch(method.name, mSearchVal)}</span>
                                          <p className="text-[10px] text-slate-400 mt-0.5">{highlightMatch(method.desc, mSearchVal)}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                                          <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{method.days}</span>
                                          {/* Edit affordance — custom methods only. Catalog methods
                                              are read-only since their definitions live in code. */}
                                          {method.id.startsWith("cust-") && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setMethodDropdownOpen((prev) => ({ ...prev, [draft.id]: false }));
                                                openEditCustomMethodModal(draft.carrier, method);
                                              }}
                                              className="w-5 h-5 rounded-full flex items-center justify-center text-slate-300 hover:text-primary hover:bg-white transition-colors opacity-0 group-hover/method:opacity-100"
                                              title="Edit shipping method"
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleSetPrimaryMethod(method.id); }}
                                            className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                                              isPrimary
                                                ? "text-primary"
                                                : isChecked
                                                  ? "text-slate-300 hover:text-amber-500 hover:bg-white"
                                                  : "text-slate-200 opacity-0 group-hover/method:opacity-100 hover:text-amber-500 hover:bg-white"
                                            }`}
                                            title={isPrimary ? "Primary method" : "Set as primary"}
                                          >
                                            <Star className={`w-3 h-3 ${isPrimary ? "fill-primary" : ""}`} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {filteredMethods.length === 0 && <p className="text-xs text-slate-400 text-center py-3">No methods found</p>}
                                </div>
                              </div>
                              </>,
                              document.body
                            )}
                          </div>

                          {/* Chips */}
                          {selectedMethodIds.length > 0 && (
                            <div className="col-span-2 flex flex-wrap gap-1.5">
                              {selectedMethodIds.map((mid) => {
                                const method = carrierMethods.find((x) => x.id === mid);
                                if (!method) return null;
                                const isPrimary = draft.primaryMethod === mid;
                                return (
                                  <ShippingMethodPill
                                    key={mid}
                                    method={method}
                                    isPrimary={isPrimary}
                                    carrierName={selectedCarrier?.name || ""}
                                    onRemove={() => {
                                      const next = selectedMethodIds.filter((x) => x !== mid);
                                      const nextPrimary = isPrimary ? (next[0] || "") : draft.primaryMethod;
                                      updateDraft(draft.id, { methods: next.join(","), primaryMethod: nextPrimary });
                                    }}
                                    onSetPrimary={() => handleSetPrimaryMethod(mid)}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!editingShippingId && (
                  <button
                    type="button"
                    onClick={addDraftEntry}
                    className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-dashed border-[#DBE4F0] bg-white text-[12px] text-primary hover:bg-accent hover:border-primary/30 transition-all cursor-pointer"
                    style={{ fontWeight: 600 }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Another Carrier
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#E8ECF1] bg-white shrink-0">
              <button onClick={handleShippingModalClose} className="px-3.5 py-2 rounded-lg border border-border bg-white text-xs text-slate-500 hover:bg-muted transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
                Cancel
              </button>
              <button onClick={confirmSaveShipping} className="px-4 py-2 rounded-lg bg-primary text-white text-xs hover:bg-[#086AE6] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                {editingShippingId ? "Update Method" : "Save Methods"}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Discard Confirmation Dialog ── */}
        <AlertDialog open={discardShippingConfirmOpen} onOpenChange={setDiscardShippingConfirmOpen}>
          <AlertDialogContent
            className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] !z-[270]"
            overlayClassName="!z-[260] !bg-black/50"
            onInteractOutside={() => setDiscardShippingConfirmOpen(false)}
          >
            {/* Colored glow header */}
            <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
                <AlertTriangle className="w-8 h-8" style={{ color: "rgb(var(--destructive))" }} />
              </div>
              <span
                className="mt-4 px-3 py-1 rounded-full text-[11px]"
                style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", letterSpacing: "0.05em" }}
              >
                Discard
              </span>
            </div>
            {/* Body */}
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "rgb(var(--foreground))" }}>
                  Discard changes?
                </AlertDialogTitle>
              </AlertDialogHeader>
              <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "rgb(var(--muted-foreground))", lineHeight: "1.65" }}>
                Your unsaved shipping method configuration will be lost. This action cannot be undone.
              </AlertDialogDescription>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  onClick={confirmDiscardShipping}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: "rgb(var(--destructive))", color: "#fff" }}
                >
                  Discard Changes
                </button>
                <button
                  onClick={() => setDiscardShippingConfirmOpen(false)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{ fontWeight: 500, backgroundColor: "rgb(var(--muted))", color: "#334155" }}
                >
                  Continue Editing
                </button>
              </div>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Create Shipping Method Modal — inline carrier-method creation ──
            Stacks above the parent Add Shipping Methods modal (z-280 vs z-250).
            Saved methods land in customMethods[carrier] and auto-select on the
            originating draft so the user doesn't have to re-find them. */}
        <Dialog open={createShippingMethodOpen} onOpenChange={(open) => { if (!open) discardCreateMethodModal(); }}>
          <DialogContent
            className="!p-0 !gap-0 overflow-hidden flex flex-col z-[280] !border-0 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            overlayClassName="!bg-black/40 !z-[270]"
            style={{ maxWidth: "min(62vw, 820px)", width: "calc(100% - 2rem)", height: "auto", maxHeight: "88vh", borderRadius: 14, boxShadow: "0 24px 80px -12px rgba(0,0,0,0.18)" }}
            hideCloseButton
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => { e.preventDefault(); discardCreateMethodModal(); }}
          >
            <DialogTitle className="sr-only">{editingCustomMethodId ? "Edit Shipping Method" : "Create Shipping Method"}</DialogTitle>
            <DialogDescription className="sr-only">Define mode, lead time, and coverage for this shipping method.</DialogDescription>

            {/* Header — PT-style compact title row with chip badge inline,
                subtitle below, close on the right. Carrier chip slots in
                with the badge when bound to a parent carrier. */}
            <div className="px-4 sm:px-5 pt-4 pb-3.5 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-[16px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>
                      {editingCustomMethodId ? "Edit Shipping Method" : "Create Shipping Method"}
                    </h2>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                      <Truck className="w-3 h-3" /> Shipping Method
                    </span>
                    {(() => {
                      const c = CARRIER_CATALOG.find((x) => x.id === createSmForCarrier);
                      return c ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#E8ECF1] bg-white text-[11px] text-slate-600" style={{ fontWeight: 500 }}>
                          <img src={c.logoImg} alt={c.name} className="w-3.5 h-3.5 object-contain rounded" />
                          {c.name}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <p className="text-[12px] text-slate-500 mt-1" style={{ fontWeight: 400 }}>
                    {editingCustomMethodId
                      ? "Update the method definition. Changes apply wherever this method is referenced."
                      : "Add a shipping method this carrier offers. Coverage is optional."}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={discardCreateMethodModal}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Body — single method per modal session. Sections sit directly
                on the soft bg (no outer card wrapper), matching the Payment
                Term modal rhythm. Coverage is its own section block at the
                bottom with a switch-gated card. */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-[#FAFBFC] scrollbar-hide">
              <div className="px-4 py-4 space-y-5">
                {(() => {
                  const row = createSmMethods[0];
                  if (!row) return null;
                  return (
                    <>
                      {/* ── Mode — PT-style type cards with per-mode accents
                          (sky / green / cyan / amber). Foundational decision
                          framed first; gradient appears on select + hover. */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-3">
                          <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Mode</span>
                          <Tooltip>
                            <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                              <p className="text-slate-500">Pick how this method moves cargo. Hover each card for details.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                          {(["air", "ground", "sea", "multi"] as CarrierMode[]).map((m) => {
                            const isActive = row.mode === m;
                            const cfg = m === "air"
                              ? { icon: Plane, label: "Air", desc: "Time-Critical", color: "#0A77FF", bg: "#EBF3FF", border: "#7AB8FF", hoverBorder: "hover:border-blue-200", hoverCircle: "group-hover:border-[#7AB8FF]", explain: "Fastest mode, used for time-critical or high-value goods.", example: "Priority Overnight", exampleDesc: "1-day international parcel delivery." }
                              : m === "ground"
                              ? { icon: Truck, label: "Ground", desc: "Road · Rail", color: "#22C55E", bg: "#F0FDF4", border: "#86EFAC", hoverBorder: "hover:border-green-200", hoverCircle: "group-hover:border-[#86EFAC]", explain: "Road or rail, standard for domestic and regional shipments.", example: "Ground Freight", exampleDesc: "5-day cross-country LTL or full truckload." }
                              : m === "sea"
                              ? { icon: Ship, label: "Sea", desc: "Bulk · Ocean", color: "#06B6D4", bg: "#ECFEFF", border: "#67E8F9", hoverBorder: "hover:border-cyan-200", hoverCircle: "group-hover:border-[#67E8F9]", explain: "Ocean freight, lowest cost for bulk and international cargo.", example: "Ocean Container", exampleDesc: "4-week port-to-port FCL shipping." }
                              : { icon: Layers, label: "Multi-Modal", desc: "Combined", color: "#F59E0B", bg: "#FFFBEB", border: "#FCD34D", hoverBorder: "hover:border-amber-200", hoverCircle: "group-hover:border-[#FCD34D]", explain: "Combines two or more modes on a single route.", example: "Sea + Truck", exampleDesc: "Ocean leg to port, then drayage to warehouse." };
                            const Icon = cfg.icon;
                            return (
                              <Tooltip key={m}>
                                <TooltipTrigger asChild>
                                  <div
                                    onClick={() => updateCsmRow(row.id, { mode: m })}
                                    className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
                                      isActive
                                        ? "bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                                        : `border-border bg-white ${cfg.hoverBorder} hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)]`
                                    }`}
                                    style={isActive ? { borderColor: `${cfg.border}b3` } : undefined}
                                  >
                                    <div
                                      className={`absolute inset-0 transition-all duration-300 pointer-events-none ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`}
                                      style={{ background: `linear-gradient(135deg, ${cfg.bg}80 0%, transparent 70%)` }}
                                    />
                                    <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                                      <div
                                        className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${isActive ? "" : "group-hover:scale-105"}`}
                                        style={{ background: `linear-gradient(135deg, ${cfg.bg}, ${cfg.border}40)`, color: cfg.color }}
                                      >
                                        <Icon className="w-[18px] h-[18px]" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p
                                          className={`text-[13px] truncate transition-colors duration-150 ${isActive ? "" : "text-foreground group-hover:text-slate-800"}`}
                                          style={{ fontWeight: 600, color: isActive ? cfg.color : undefined }}
                                        >
                                          {cfg.label}
                                        </p>
                                        <p
                                          className="text-[11px] mt-0.5 truncate transition-colors duration-150"
                                          style={{ color: isActive ? cfg.color : "#94A3B8" }}
                                        >
                                          {cfg.desc}
                                        </p>
                                      </div>
                                      <div
                                        className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                                          isActive ? "" : `border-[1.5px] border-[#D1D5DB] bg-white ${cfg.hoverCircle}`
                                        }`}
                                        style={isActive ? { backgroundColor: cfg.color, boxShadow: `0 0 0 2px ${cfg.color}26` } : {}}
                                      >
                                        {isActive && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                                      </div>
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                  <p className="text-slate-500">{cfg.explain}</p>
                                  <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                                    <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                                    <p className="text-[11px] text-slate-700 mt-1">
                                      <span style={{ fontWeight: 600, color: cfg.color }}>{cfg.example}</span>: {cfg.exampleDesc}
                                    </p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </div>

                      {/* ── Method Details — section header + tooltip + a
                          single white card holding Name/Description and
                          Min/Max lead-time. */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-3">
                          <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Method Details</span>
                          <Tooltip>
                            <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                              <p className="text-slate-500">Name, summary, and transit window shown on POs and order tracking.</p>
                              <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                                <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Tip</p>
                                <p className="text-[11px] text-slate-700 mt-1">Use clear names like <span className="text-primary" style={{ fontWeight: 600 }}>Express Overnight</span> or <span className="text-primary" style={{ fontWeight: 600 }}>Ground 5-Day</span>.</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="rounded-xl border border-border bg-white p-4">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                            <div>
                              <label className="text-[12px] text-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
                                Shipping Method Name<span className="text-destructive ml-0.5">*</span>
                              </label>
                              <Input
                                value={row.name}
                                onChange={(e) => {
                                  updateCsmRow(row.id, { name: e.target.value });
                                  if (e.target.value.trim()) setCreateSmNameErrors((p) => ({ ...p, [row.id]: false }));
                                }}
                                placeholder="e.g. Express, Ground"
                                className={`h-9 rounded-lg bg-white text-[13px] text-foreground placeholder:text-slate-400 focus:ring-1 ${
                                  createSmNameErrors[row.id]
                                    ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                                    : "border-border focus:border-primary focus:ring-primary/20"
                                }`}
                              />
                              {createSmNameErrors[row.id] && (
                                <p className="mt-1 text-[10px] text-destructive" style={{ fontWeight: 500 }}>
                                  Shipping method name is required
                                </p>
                              )}
                            </div>
                            <ExpandableTextarea
                              label="Description"
                              value={row.description}
                              onChange={(v) => updateCsmRow(row.id, { description: v })}
                              placeholder="Brief summary of what this shipping method covers."
                              expandMode="contained"
                            />
                            <div>
                              <label className="text-[12px] text-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
                                Minimum (Days)
                              </label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  min={0}
                                  value={row.minDuration}
                                  onChange={(e) => updateCsmRow(row.id, { minDuration: e.target.value })}
                                  placeholder="e.g. 3"
                                  className="h-9 rounded-lg border-border bg-white text-[13px] text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 pr-12"
                                  inputMode="numeric"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400" style={{ fontWeight: 500 }}>days</span>
                              </div>
                            </div>
                            <div>
                              <label className="text-[12px] text-foreground mb-1.5 block" style={{ fontWeight: 500 }}>
                                Maximum (Days)
                              </label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  min={0}
                                  value={row.maxDuration}
                                  onChange={(e) => updateCsmRow(row.id, { maxDuration: e.target.value })}
                                  placeholder="e.g. 6"
                                  className="h-9 rounded-lg border-border bg-white text-[13px] text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 pr-12"
                                  inputMode="numeric"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400" style={{ fontWeight: 500 }}>days</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ── Coverage — own section block, PT/PR style.
                          Section header carries the Optional badge; the
                          card below holds a switch row that gates the
                          packaging + regions content. */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-3">
                          <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Coverage</span>
                          <span className="text-[11px] text-slate-400 bg-muted px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>Optional</span>
                          <Tooltip>
                            <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                              <p className="text-slate-500">Capture packaging so this method routes correctly. Skip if it handles anything within the carrier's defaults.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="rounded-xl border border-border bg-white p-4">
                          <div className="flex items-center gap-2.5">
                            <Switch checked={row.showCoverage} onCheckedChange={(v) => updateCsmRow(row.id, { showCoverage: v })} />
                            <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>Add Coverage Details</span>
                            <span className="text-[11px] text-slate-400">Specify packaging for this method.</span>
                          </div>
                          {row.showCoverage && (
                            <div className="mt-4 pt-4 border-t border-[#EEF2F6] space-y-4">
                              {/* Packaging — Standard | Custom toggle. */}
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                                    Packaging
                                  </label>
                                  <div className="inline-flex rounded-md bg-muted p-0.5">
                                    {(["standard", "custom"] as const).map((m) => {
                                      const isSelected = row.packagingMode === m;
                                      return (
                                        <button
                                          key={m}
                                          type="button"
                                          onClick={() => updateCsmRow(row.id, { packagingMode: m })}
                                          className={`px-2.5 h-7 rounded-sm text-[11px] transition-all cursor-pointer ${
                                            isSelected ? "bg-white shadow-sm text-foreground" : "text-slate-500 hover:text-slate-700"
                                          }`}
                                          style={{ fontWeight: isSelected ? 600 : 500 }}
                                        >
                                          {m === "standard" ? "Standard" : "Custom"}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                {row.packagingMode === "standard" ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {(["parcel", "box", "pallet", "ltl", "ftl"] as PackageType[]).map((pt) => {
                                      const selected = row.packageTypes.includes(pt);
                                      const info = pt === "parcel"
                                        ? { desc: "Small individual packages handled by parcel carriers (FedEx, UPS, USPS).", example: "Up to 70 lb · max 108 in length + girth", useCase: "E-commerce orders, individual parcels, small B2B." }
                                        : pt === "box"
                                        ? { desc: "Standard cardboard cartons, bulkier than a parcel, smaller than a pallet.", example: "Up to 150 lb · single carton", useCase: "Retail bulk shipments, multi-item B2B orders." }
                                        : pt === "pallet"
                                        ? { desc: "Standardized wooden pallet (48×40 in) carrying stacked goods.", example: "48×40 in · up to 4,000 lb", useCase: "Warehouse-to-warehouse, bulk B2B distribution." }
                                        : pt === "ltl"
                                        ? { desc: "Less-Than-Truckload, multiple shippers share a single truck.", example: "1 to 6 pallets · 150 to 15,000 lb", useCase: "Mid-volume freight, regional distribution lanes." }
                                        : { desc: "Full Truckload, your shipment fills the entire truck. Fastest freight tier.", example: "Up to 26 pallets · 26,000 to 44,000 lb", useCase: "High-volume, time-sensitive freight, single destination." };
                                      return (
                                        <Tooltip key={pt}>
                                          <TooltipTrigger asChild>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const next = selected
                                                  ? row.packageTypes.filter((x) => x !== pt)
                                                  : [...row.packageTypes, pt];
                                                updateCsmRow(row.id, { packageTypes: next });
                                              }}
                                              className={`px-3 h-8 rounded-md border text-[12px] transition-all cursor-pointer ${
                                                selected
                                                  ? "border-primary/40 bg-primary/5 text-primary"
                                                  : "border-border bg-white text-slate-600 hover:border-slate-300"
                                              }`}
                                              style={{ fontWeight: selected ? 600 : 500 }}
                                            >
                                              {PACKAGE_TYPE_LABELS[pt]}
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                            <p className="text-slate-500">{info.desc}</p>
                                            <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                                              <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Typical Size</p>
                                              <p className="text-[11px] text-slate-700 mt-1" style={{ fontWeight: 600 }}>{info.example}</p>
                                              <p className="text-[10px] text-slate-400 tracking-wide mt-2" style={{ fontWeight: 600 }}>When to Use</p>
                                              <p className="text-[11px] text-slate-600 mt-1">{info.useCase}</p>
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    {/* 3D box illustration — geometry reacts
                                        to the typed L/W/H so a long-flat
                                        shipment renders as a long-flat box. */}
                                    {(() => {
                                      const L = Math.max(parseFloat(row.length) || 0, 0);
                                      const W = Math.max(parseFloat(row.width) || 0, 0);
                                      const H = Math.max(parseFloat(row.height) || 0, 0);
                                      const anyTyped = L > 0 || W > 0 || H > 0;
                                      const fallback = anyTyped ? Math.max(L, W, H) : 60;
                                      const valL = L > 0 ? L : fallback;
                                      const valW = W > 0 ? W : fallback * 0.7;
                                      const valH = H > 0 ? H : fallback;
                                      const maxDim = Math.max(valL, valW, valH, 1);
                                      const scale = 130 / maxDim;
                                      const pxL = Math.max(valL * scale, 14);
                                      const pxW = Math.max(valW * scale, 14);
                                      const pxH = Math.max(valH * scale, 14);
                                      const dx = pxW * 0.55;
                                      const dy = -pxW * 0.34;
                                      const cx = 135;
                                      const baseY = 168;
                                      const flx = cx - pxL / 2 - dx / 2;
                                      const fty = baseY - pxH;
                                      const fbl: [number, number] = [flx, baseY];
                                      const fbr: [number, number] = [flx + pxL, baseY];
                                      const ftl: [number, number] = [flx, fty];
                                      const ftr: [number, number] = [flx + pxL, fty];
                                      const bbr: [number, number] = [fbr[0] + dx, fbr[1] + dy];
                                      const btl: [number, number] = [ftl[0] + dx, ftl[1] + dy];
                                      const btr: [number, number] = [ftr[0] + dx, ftr[1] + dy];
                                      const pt = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
                                      const topPts = `${pt(ftl)} ${pt(btl)} ${pt(btr)} ${pt(ftr)}`;
                                      const frontPts = `${pt(fbl)} ${pt(ftl)} ${pt(ftr)} ${pt(fbr)}`;
                                      const rightPts = `${pt(fbr)} ${pt(ftr)} ${pt(btr)} ${pt(bbr)}`;
                                      const tapeFront: [number, number] = [
                                        ftl[0] + (ftr[0] - ftl[0]) * 0.5 - 18,
                                        ftl[1] + (ftr[1] - ftl[1]) * 0.5,
                                      ];
                                      const tapeFrontEdge = (offset: number): [number, number] => [
                                        ftl[0] + (ftr[0] - ftl[0]) * 0.5 + offset + dx * 0.5,
                                        ftl[1] + (ftr[1] - ftl[1]) * 0.5 + dy * 0.5,
                                      ];
                                      const seamTop: [number, number] = [(ftl[0] + ftr[0]) / 2, (ftl[1] + ftr[1]) / 2];
                                      const seamBot: [number, number] = [(fbl[0] + fbr[0]) / 2, (fbl[1] + fbr[1]) / 2];
                                      const hGuideX = btr[0] + 9;
                                      const hLabelY = (btr[1] + bbr[1]) / 2 + 4;
                                      const lGuideY = baseY + 10;
                                      const lLabelX = (fbl[0] + fbr[0]) / 2 - 3;
                                      const wMid: [number, number] = [(fbr[0] + bbr[0]) / 2 + 6, (fbr[1] + bbr[1]) / 2 + 5];
                                      const hint = anyTyped ? "" : "Typical 60×42×60 in placeholder shown";
                                      return (
                                        <div className="flex flex-col items-center justify-center py-2 group/box">
                                          <svg
                                            width="220"
                                            height="190"
                                            viewBox="0 0 280 200"
                                            className="select-none transition-transform duration-300 ease-out group-hover/box:scale-[1.04]"
                                            aria-hidden="true"
                                          >
                                            <defs>
                                              <linearGradient id="csmGroupBoxTop" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stopColor="#F4DDB1" />
                                                <stop offset="55%" stopColor="#E5C48C" />
                                                <stop offset="100%" stopColor="#CFA467" />
                                              </linearGradient>
                                              <linearGradient id="csmGroupBoxFront" x1="0%" y1="0%" x2="0%" y2="100%">
                                                <stop offset="0%" stopColor="#D9A86A" />
                                                <stop offset="100%" stopColor="#A97A41" />
                                              </linearGradient>
                                              <linearGradient id="csmGroupBoxRight" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stopColor="#B58451" />
                                                <stop offset="100%" stopColor="#7E5828" />
                                              </linearGradient>
                                              <radialGradient id="csmGroupBoxShadow" cx="50%" cy="50%" r="50%">
                                                <stop offset="0%" stopColor="#1E293B" stopOpacity="0.45" />
                                                <stop offset="100%" stopColor="#1E293B" stopOpacity="0" />
                                              </radialGradient>
                                            </defs>
                                            <ellipse
                                              cx={cx}
                                              cy={baseY + 14}
                                              rx={Math.min(pxL * 0.55 + dx * 0.4, 110)}
                                              ry={9}
                                              fill="url(#csmGroupBoxShadow)"
                                              className="box-3d-shadow"
                                            />
                                            <g className="box-3d-float" style={{ transformOrigin: `${cx}px ${(fty + baseY) / 2}px` }}>
                                              <g className="box-3d-tilt" style={{ transformOrigin: `${cx}px ${(fty + baseY) / 2}px` }}>
                                                <polygon points={rightPts} fill="url(#csmGroupBoxRight)" stroke="#6B4920" strokeWidth="0.75" strokeLinejoin="round" />
                                                <polygon points={topPts} fill="url(#csmGroupBoxTop)" stroke="#6B4920" strokeWidth="0.75" strokeLinejoin="round" />
                                                <polygon points={frontPts} fill="url(#csmGroupBoxFront)" stroke="#6B4920" strokeWidth="0.75" strokeLinejoin="round" />
                                                <polygon
                                                  points={`${pt([tapeFront[0], tapeFront[1]])} ${pt([tapeFront[0] + 36, tapeFront[1]])} ${pt(tapeFrontEdge(36 - 2))} ${pt(tapeFrontEdge(2))}`}
                                                  fill="#9A6F3D"
                                                  opacity="0.55"
                                                />
                                                <line x1={seamTop[0]} y1={seamTop[1]} x2={seamBot[0]} y2={seamBot[1]} stroke="#6B4920" strokeWidth="0.6" opacity="0.55" strokeDasharray="2 2.5" />
                                                <line x1={ftl[0]} y1={ftl[1]} x2={ftr[0]} y2={ftr[1]} stroke="#FCEAC4" strokeWidth="1" opacity="0.55" />
                                                <line x1={btl[0]} y1={btl[1]} x2={btr[0]} y2={btr[1]} stroke="#FCEAC4" strokeWidth="1" opacity="0.45" />
                                                <line x1={ftl[0]} y1={ftl[1]} x2={btl[0]} y2={btl[1]} stroke="#FCEAC4" strokeWidth="0.75" opacity="0.4" />
                                                <line x1={ftr[0]} y1={ftr[1]} x2={fbr[0]} y2={fbr[1]} stroke="#5C3F1A" strokeWidth="0.5" opacity="0.45" />
                                              </g>
                                            </g>
                                            <line x1={hGuideX} y1={btr[1]} x2={hGuideX} y2={bbr[1]} stroke="#94A3B8" strokeWidth="0.75" strokeDasharray="2 2" />
                                            <text x={hGuideX + 4} y={hLabelY} fontSize="12" fill="#475569" fontWeight="700">H</text>
                                            <line x1={fbl[0]} y1={lGuideY} x2={fbr[0]} y2={lGuideY} stroke="#94A3B8" strokeWidth="0.75" strokeDasharray="2 2" />
                                            <text x={lLabelX} y={lGuideY + 12} fontSize="12" fill="#475569" fontWeight="700">L</text>
                                            <line x1={fbr[0] + 4} y1={fbr[1] + 4} x2={bbr[0] + 4} y2={bbr[1] + 4} stroke="#94A3B8" strokeWidth="0.75" strokeDasharray="2 2" />
                                            <text x={wMid[0]} y={wMid[1]} fontSize="12" fill="#475569" fontWeight="700">W</text>
                                          </svg>
                                          {hint && (
                                            <p className="text-[10px] text-slate-400 mt-1" style={{ fontWeight: 500 }}>{hint}</p>
                                          )}
                                        </div>
                                      );
                                    })()}
                                    <div className="grid grid-cols-4 gap-2">
                                      {([
                                        { key: "weight", label: "Weight", unitField: "weightUnit", units: ["lb", "kg", "g", "oz"], placeholder: "0" },
                                        { key: "length", label: "Length", unitField: "dimensionUnit", units: ["in", "cm", "mm", "ft"], placeholder: "0" },
                                        { key: "width", label: "Width", unitField: "dimensionUnit", units: ["in", "cm", "mm", "ft"], placeholder: "0" },
                                        { key: "height", label: "Height", unitField: "dimensionUnit", units: ["in", "cm", "mm", "ft"], placeholder: "0" },
                                      ] as const).map((f) => (
                                        <div key={f.key}>
                                          <label className="text-[11px] text-slate-500 mb-1 block" style={{ fontWeight: 500 }}>
                                            {f.label}
                                          </label>
                                          <div className="relative">
                                            <Input
                                              type="number"
                                              min={0}
                                              value={row[f.key]}
                                              onChange={(e) => updateCsmRow(row.id, { [f.key]: e.target.value })}
                                              placeholder={f.placeholder}
                                              className="h-9 rounded-md border-border bg-white text-[12px] text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 pr-12"
                                              inputMode="numeric"
                                            />
                                            <select
                                              value={row[f.unitField]}
                                              onChange={(e) => updateCsmRow(row.id, { [f.unitField]: e.target.value })}
                                              onClick={(e) => e.stopPropagation()}
                                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-1.5 rounded-md border-0 bg-slate-100 text-[10px] text-slate-600 cursor-pointer hover:bg-slate-200 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                              style={{ fontWeight: 600 }}
                                              aria-label={`${f.label} unit`}
                                            >
                                              {f.units.map((u) => (
                                                <option key={u} value={u}>{u}</option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Service Regions field removed per Eli — backlog. */}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-4 sm:px-5 py-3 border-t border-[#EEF2F6] bg-white shrink-0">
              <button onClick={discardCreateMethodModal} className="px-4 h-9 rounded-lg border border-border bg-white text-[12px] text-slate-600 hover:bg-muted transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
                {editingCustomMethodId ? "Cancel" : "Discard"}
              </button>
              <button onClick={saveCreateMethodModal} className="px-5 h-9 rounded-lg bg-primary text-white text-[12px] hover:bg-[#086AE6] transition-colors cursor-pointer shadow-sm" style={{ fontWeight: 600 }}>
                {editingCustomMethodId ? "Save Changes" : "Save"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (sectionId === "global_contact") {
    // Stakeholder spec — Point of Contact removed from group create
    // and edit flows. Group-level inheritance was creating ambiguity;
    // POCs now live at the partner level only. The branch returns
    // null so any stale nav entry resolves to nothing rather than
    // re-introducing the section. The original render below is kept
    // as a paper trail (unreachable) and will be cleaned up in a
    // follow-up pass.
    return null;
    return (
      <div className="space-y-3">
        {/* Section header */}
        <div className="mb-1">
          <h4 className="text-sm text-foreground" style={{ fontWeight: 700 }}>Point of Contact</h4>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Optional default contacts. Every partner created under this group inherits them; partners can add their own on top.
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenSelectPoc}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-primary text-xs hover:bg-blue-100 transition-colors border border-blue-100"
            style={{ fontWeight: 600 }}
          >
            <Users className="w-3.5 h-3.5" />
            Select from Contact Directory
          </button>
          <button
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-slate-700 text-xs hover:bg-slate-50 transition-colors border border-border"
            style={{ fontWeight: 600 }}
            onClick={handleOpenCreatePoc}
          >
            <Plus className="w-3.5 h-3.5" />
            Create New Contact
          </button>
        </div>

        {/* Selected contacts display */}
        {selectedPocContacts.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground" style={{ fontWeight: 600 }}>
                {selectedPocContacts.length} contact{selectedPocContacts.length !== 1 ? "s" : ""} selected
              </span>
              <span className="text-[10px] text-slate-500 bg-muted px-1.5 py-0.5 rounded-full" style={{ fontWeight: 500 }}>{selectedPocContacts.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {selectedPocContacts.map((contact) => (
                <div key={contact.id} className="rounded-lg border border-[#E8ECF1] bg-white p-3 relative group hover:border-blue-200 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <button
                    onClick={() => handleRemovePoc(contact.id)}
                    className="absolute top-3 right-3 w-6 h-6 rounded-full bg-red-50 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
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
                      <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>{contact.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{contact.company}</p>
                      <div className="mt-2.5 space-y-1.5">
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{contact.phone}</span>
                          <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] text-slate-500 shrink-0" style={{ fontWeight: 500 }}>
                            <Users className="w-2.5 h-2.5" /> {contact.department}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <PhoneCall className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{contact.secondaryPhone}</span>
                          {contact.secondaryPhoneExt && <span className="text-slate-400">Ext. {contact.secondaryPhoneExt}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
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
          <div className="py-6 rounded-lg border-2 border-dashed border-border bg-white flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-lg bg-slate-50 border border-[#E8ECF1] flex items-center justify-center mb-2.5">
              <UserPlus className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm text-slate-400" style={{ fontWeight: 500 }}>No contacts selected</p>
            <p className="text-xs text-slate-300 mt-1.5 max-w-[280px]">
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
            <DialogTitle className="sr-only">Select Point of Contact</DialogTitle>
            <DialogDescription className="sr-only">Choose contacts from the Contact Directory to associate with this partner.</DialogDescription>

            {/* Modal Header */}
            <div className="px-5 sm:px-6 pt-5 pb-4 shrink-0 border-b border-border bg-slate-50 rounded-t-none sm:rounded-t-2xl">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>Select Point of Contact</h3>
                <button
                  onClick={() => setShowSelectPocModal(false)}
                  className="w-8 h-8 rounded-lg hover:bg-border flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-4" style={{ fontWeight: 400 }}>
                Choose from your saved contacts or create a new one to assign to this partner.
              </p>

              {/* Search + Create CTA */}
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="relative w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={pocSearch}
                    onChange={(e) => { setPocSearch(e.target.value); setPocPage(1); }}
                    placeholder="Search point of contact"
                    className="pl-9 h-9 rounded-lg border-border bg-white text-sm"
                  />
                </div>
                <button
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-primary text-[13px] hover:bg-blue-100 transition-colors border border-blue-100 shrink-0"
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
                          ? "bg-white border-border text-foreground shadow-sm"
                          : "bg-transparent border-transparent text-slate-500 hover:bg-white/60"
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
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Search className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-400" style={{ fontWeight: 500 }}>No contacts found</p>
                  <p className="text-xs text-slate-300 mt-1">Try adjusting your search or filter.</p>
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
                            ? "border-primary bg-[#FAFCFF] shadow-[0_0_0_1px_#0A77FF]"
                            : "border-border bg-white hover:border-blue-200"
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`absolute top-3 right-3 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          isSelected ? "bg-primary border-primary" : "border-[#D1D5DB] bg-white"
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
                            <p className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{highlightMatch(contact.name, pocSearch)}</p>
                            <p className="text-[11px] text-slate-400 truncate">{highlightMatch(contact.company, pocSearch)}</p>
                          </div>
                        </div>

                        {/* Contact details */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{contact.phone}</span>
                            <span className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-[10px] text-slate-500 shrink-0" style={{ fontWeight: 500 }}>
                              <Users className="w-2.5 h-2.5" />
                              {contact.department.length > 15 ? contact.department.slice(0, 15) + "..." : contact.department}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <PhoneCall className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{contact.secondaryPhone}</span>
                            {contact.secondaryPhoneExt && <span className="text-slate-400">Ext. {contact.secondaryPhoneExt}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
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
            <div className="px-5 sm:px-6 py-3 border-t border-muted flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Records per Page</span>
                <span className="px-2 py-1 rounded border border-border text-xs text-foreground" style={{ fontWeight: 500 }}>{POC_PER_PAGE}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPocPage(1)} disabled={pocPage === 1} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronsLeft className="w-4 h-4 text-slate-500" />
                </button>
                <button onClick={() => setPocPage(Math.max(1, pocPage - 1))} disabled={pocPage === 1} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs text-slate-500">
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
                          ? "bg-primary text-white"
                          : "text-slate-500 hover:bg-muted"
                      }`}
                      style={{ fontWeight: pocPage === pageNum ? 600 : 400 }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button onClick={() => setPocPage(Math.min(pocTotalPages, pocPage + 1))} disabled={pocPage === pocTotalPages} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs text-slate-500">
                  <span className="mr-0.5">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={() => setPocPage(pocTotalPages)} disabled={pocPage === pocTotalPages} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronsRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 sm:px-6 py-3.5 border-t border-border bg-[#FAFBFC] rounded-b-none sm:rounded-b-2xl flex items-center justify-between shrink-0">
              <p className="text-sm text-foreground">
                <span style={{ fontWeight: 700 }}>{pocTempSelected.size}</span>{" "}
                <span className="text-slate-500">point of contact{pocTempSelected.size !== 1 ? "s" : ""} selected</span>
              </p>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setShowSelectPocModal(false)}
                  className="px-5 py-2.5 rounded-lg border border-border bg-white text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPocSelection}
                  className="px-5 py-2.5 rounded-lg bg-primary text-sm text-white hover:bg-[#0960D9] transition-colors"
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
    <div className="p-6 rounded-lg border-2 border-dashed border-border bg-white flex flex-col items-center justify-center text-center">
      <div className="w-10 h-10 rounded-lg bg-slate-50 border border-[#E8ECF1] flex items-center justify-center mb-2.5">
        <Settings2 className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-sm text-slate-500" style={{ fontWeight: 600 }}>No configuration set</p>
      <p className="text-xs text-slate-400 mt-1.5 max-w-[300px]">
        Configure {currentSection.title} settings for this {configType}. These will be applied as defaults for all associated orders.
      </p>
      <button className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg border border-border bg-white text-sm text-slate-700 hover:bg-slate-50 transition-colors" style={{ fontWeight: 500 }}>
        <Plus className="w-3.5 h-3.5" />
        Add Configuration
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Partner Group create flow — group-specific step components
   ──────────────────────────────────────────────────────────────────────── */

const GROUP_COUNTRY_OPTIONS: { name: string; flag: string }[] = [
  { name: "United States", flag: "🇺🇸" },
  { name: "Canada", flag: "🇨🇦" },
  { name: "Mexico", flag: "🇲🇽" },
  { name: "United Kingdom", flag: "🇬🇧" },
  { name: "Germany", flag: "🇩🇪" },
  { name: "France", flag: "🇫🇷" },
  { name: "Italy", flag: "🇮🇹" },
  { name: "Spain", flag: "🇪🇸" },
  { name: "Netherlands", flag: "🇳🇱" },
  { name: "Switzerland", flag: "🇨🇭" },
  { name: "Sweden", flag: "🇸🇪" },
  { name: "Norway", flag: "🇳🇴" },
  { name: "Denmark", flag: "🇩🇰" },
  { name: "Ireland", flag: "🇮🇪" },
  { name: "Poland", flag: "🇵🇱" },
  { name: "Australia", flag: "🇦🇺" },
  { name: "New Zealand", flag: "🇳🇿" },
  { name: "Japan", flag: "🇯🇵" },
  { name: "South Korea", flag: "🇰🇷" },
  { name: "China", flag: "🇨🇳" },
  { name: "Taiwan", flag: "🇹🇼" },
  { name: "Hong Kong", flag: "🇭🇰" },
  { name: "Singapore", flag: "🇸🇬" },
  { name: "Malaysia", flag: "🇲🇾" },
  { name: "Indonesia", flag: "🇮🇩" },
  { name: "Philippines", flag: "🇵🇭" },
  { name: "Thailand", flag: "🇹🇭" },
  { name: "Vietnam", flag: "🇻🇳" },
  { name: "India", flag: "🇮🇳" },
  { name: "Pakistan", flag: "🇵🇰" },
  { name: "Bangladesh", flag: "🇧🇩" },
  { name: "United Arab Emirates", flag: "🇦🇪" },
  { name: "Saudi Arabia", flag: "🇸🇦" },
  { name: "Israel", flag: "🇮🇱" },
  { name: "Turkey", flag: "🇹🇷" },
  { name: "South Africa", flag: "🇿🇦" },
  { name: "Egypt", flag: "🇪🇬" },
  { name: "Nigeria", flag: "🇳🇬" },
  { name: "Kenya", flag: "🇰🇪" },
  { name: "Brazil", flag: "🇧🇷" },
  { name: "Argentina", flag: "🇦🇷" },
  { name: "Chile", flag: "🇨🇱" },
  { name: "Colombia", flag: "🇨🇴" },
  { name: "Peru", flag: "🇵🇪" },
];

type GroupIdentityStepProps = {
  groupName: string;
  onGroupNameChange: (v: string) => void;
  groupStatus: "Active" | "Inactive";
  onGroupStatusChange: (v: "Active" | "Inactive") => void;
  groupCountry: string;
  groupCountryFlag: string;
  groupCountrySearch: string;
  onGroupCountrySearchChange: (v: string) => void;
  onSelectGroupCountry: (country: string, flag: string) => void;
  groupDescription: string;
  onGroupDescriptionChange: (v: string) => void;
  selectedPartnerTypes: Set<string>;
  onPartnerTypeChange: (type: "vendor" | "customer") => void;
  onOpenConfigure: (type: "vendor" | "customer") => void;
  selectedPocIds: Set<string>;
  pocSearch: string;
  onPocSearchChange: (v: string) => void;
  onTogglePoc: (id: string) => void;
  attachments: { id: string; name: string; size: string; type: string }[];
  onAddAttachments: (files: FileList | null) => void;
  onRemoveAttachment: (id: string) => void;
  errors: Record<string, string>;
};

function GroupIdentityStep({
  groupName, onGroupNameChange,
  groupStatus, onGroupStatusChange,
  groupCountry, groupCountryFlag, groupCountrySearch, onGroupCountrySearchChange, onSelectGroupCountry,
  groupDescription, onGroupDescriptionChange,
  selectedPartnerTypes, onPartnerTypeChange,
  onOpenConfigure,
  selectedPocIds, pocSearch, onPocSearchChange, onTogglePoc,
  attachments, onAddAttachments, onRemoveAttachment,
  errors,
}: GroupIdentityStepProps) {
  const [countryOpen, setCountryOpen] = useState(false);
  const [pocPickerOpen, setPocPickerOpen] = useState(false);
  const [attachDragActive, setAttachDragActive] = useState(false);
  const attachInputRef = useRef<HTMLInputElement>(null);

  const filteredCountries = useMemo(() => {
    const q = groupCountrySearch.trim().toLowerCase();
    if (!q) return GROUP_COUNTRY_OPTIONS;
    return GROUP_COUNTRY_OPTIONS.filter((c) => c.name.toLowerCase().includes(q));
  }, [groupCountrySearch]);

  const filteredContacts = useMemo(() => {
    const q = pocSearch.trim().toLowerCase();
    const list = CONTACT_DICTIONARY;
    if (!q) return list.slice(0, 50);
    return list.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.department.toLowerCase().includes(q)).slice(0, 50);
  }, [pocSearch]);

  const selectedContacts = useMemo(
    () => CONTACT_DICTIONARY.filter((c) => selectedPocIds.has(c.id)),
    [selectedPocIds]
  );

  const getAttachmentIcon = (type: string) => {
    const lc = type.toLowerCase();
    if (lc.includes("png") || lc.includes("jpg") || lc.includes("jpeg") || lc.includes("image")) return "\u{1F5BC}\u{FE0F}";
    if (lc.includes("pdf")) return "\u{1F4C4}";
    if (lc.includes("xls") || lc.includes("csv") || lc.includes("sheet")) return "\u{1F4CA}";
    if (lc.includes("doc") || lc.includes("word")) return "\u{1F4DD}";
    return "\u{1F4CE}";
  };

  // Match the exact pill-style statusConfig used in CreatePartnerStep2 /
  // Step2PartnerForm — soft-tinted pill with border, not a dot.
  const statusConfig = {
    Active: { text: "#065F46", bg: "#ECFDF5", border: "#A7F3D0", label: "Active" },
    Inactive: { text: "#92400E", bg: "#FFFBEB", border: "#FDE68A", label: "Inactive" },
  } as const;

  return (
    <div className="space-y-3 sm:space-y-3.5">
      {/* ── Group Details — boxed card matching Partner Details ── */}
      <div className="rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] flex items-center gap-2 bg-[#FAFBFC] rounded-t-lg">
          <div className="w-6 h-6 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
            <Info className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>Group Details</span>
            <span className="text-[9px] sm:text-[10px] text-slate-400 tracking-wider hidden min-[480px]:inline" style={{ fontWeight: 500 }}>Required</span>
          </div>
        </div>

        <div className="px-2.5 sm:px-3 pt-2 sm:pt-2.5 pb-1.5 sm:pb-2">
          {/* Fields in 2-column grid (no logo — groups don't use a photo) */}
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-2.5 sm:gap-y-3">
              {/* Group Name */}
              <div>
                <Label htmlFor="grp-name" className="text-xs sm:text-[13px] text-foreground inline-flex items-center gap-1.5" style={{ fontWeight: 500 }}>
                  Group Name<span className="text-red-500">*</span>
                  <InfoTooltip>The template's display name. Partners created under this group reference it on their detail page (e.g. "Member of Maryland Ambulance Dealers") and use it in filters, dashboards, and reports.</InfoTooltip>
                </Label>
                <Input
                  id="grp-name"
                  placeholder="e.g. Maryland Ambulance Dealers"
                  value={groupName}
                  onChange={(e) => onGroupNameChange(e.target.value)}
                  className={`mt-1 rounded-lg border-border bg-white !h-10 text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 ${errors.partnerName ? "border-destructive" : ""}`}
                />
                {errors.partnerName && <p className="text-red-500 text-xs mt-1">{errors.partnerName}</p>}
              </div>

              {/* Status — pill-style badge matching CreatePartnerStep2 */}
              <div>
                <Label className="text-xs sm:text-[13px] text-foreground inline-flex items-center gap-1.5" style={{ fontWeight: 500 }}>
                  Status
                  <InfoTooltip>Active templates are available when creating new vendors or customers. Inactive templates are hidden from the create flow, but existing partners keep the settings they inherited.</InfoTooltip>
                </Label>
                <Select value={groupStatus} onValueChange={(v: string) => onGroupStatusChange(v as "Active" | "Inactive")}>
                  <SelectTrigger className="mt-1 !h-10 rounded-lg border-border bg-white text-sm hover:border-slate-300 transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20 [&>svg]:text-slate-400">
                    <SelectValue>
                      <span
                        className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap"
                        style={{ fontWeight: 500, backgroundColor: statusConfig[groupStatus].bg, color: statusConfig[groupStatus].text, borderColor: statusConfig[groupStatus].border }}
                      >
                        {statusConfig[groupStatus].label}
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

              {/* Country */}
              <div>
                <Label className="text-xs sm:text-[13px] text-foreground inline-flex items-center gap-1.5" style={{ fontWeight: 500 }}>
                  Country
                  <InfoTooltip>Default country applied to vendors and customers created under this template. Pre-fills the partner's country field and the dial-code on phone numbers. Partners can override it individually.</InfoTooltip>
                </Label>
                <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="mt-1 w-full !h-10 px-3 rounded-lg border border-border bg-white text-sm text-left flex items-center justify-between gap-2 hover:border-slate-300 transition-colors focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {groupCountryFlag && <span className="text-base leading-none"><FlagImage code={flagEmojiCode(groupCountryFlag)} className="text-[13px]" /></span>}
                        <span className={`truncate ${groupCountry ? "text-foreground" : "text-slate-400"}`}>
                          {groupCountry || "Select country"}
                        </span>
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[200] rounded-xl shadow-lg border border-border" align="start" sideOffset={4}>
                    <div className="p-2 border-b border-muted">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search country..."
                          value={groupCountrySearch}
                          onChange={(e) => onGroupCountrySearchChange(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                    <div className="max-h-[240px] overflow-y-auto p-1">
                      {filteredCountries.length === 0 ? (
                        <p className="text-[12px] text-slate-400 px-3 py-3">No matches</p>
                      ) : filteredCountries.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => { onSelectGroupCountry(c.name, c.flag); setCountryOpen(false); onGroupCountrySearchChange(""); }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${groupCountry === c.name ? "bg-accent/40" : "hover:bg-slate-50"}`}
                        >
                          <span className="text-base leading-none"><FlagImage code={flagEmojiCode(c.flag)} className="text-[13px]" /></span>
                          <span className="flex-1 text-[13px] text-foreground" style={{ fontWeight: 500 }}>{c.name}</span>
                          {groupCountry === c.name && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Description — same ExpandableTextarea as Partner Step 2.
                  Surfaces in the group detail page header and in tooltips
                  when picking a group during partner creation. */}
              <ExpandableTextarea
                label="Description"
                value={groupDescription}
                onChange={onGroupDescriptionChange}
                placeholder="Brief summary of group purpose or context."
                maxLength={5000}
              />
          </div>
        </div>
      </div>

      {/* ── Group Scope (Partner Type equivalent) ── */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-6 h-6 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
            <Users className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <span className="text-xs sm:text-[13px] text-foreground block" style={{ fontWeight: 600 }}>
              Group Scope
              <span className="ml-1.5 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Optional</span>
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-400 block mt-px">Pick which partner type this template applies to (optional). You can configure the defaults without preselecting Vendor or Customer.</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Vendor card — blue tint matching Partner Step 2 */}
          <div
            onClick={() => onPartnerTypeChange("vendor")}
            className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
              selectedPartnerTypes.has("vendor")
                ? "border-[#7AB8FF]/70 bg-white shadow-[0_1px_4px_rgba(10,119,255,0.06)]"
                : "border-border bg-white hover:border-blue-200 hover:shadow-[0_4px_16px_-4px_rgba(10,119,255,0.12)]"
            }`}
          >
            <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
              selectedPartnerTypes.has("vendor")
                ? "bg-gradient-to-br from-blue-50/50 to-transparent"
                : "bg-gradient-to-br from-accent/0 to-accent/0 group-hover:from-accent/60 group-hover:to-transparent"
            }`} />
            <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
              <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                selectedPartnerTypes.has("vendor")
                  ? "bg-gradient-to-br from-blue-100 to-blue-200 text-[#086AE6]"
                  : "bg-gradient-to-br from-accent to-blue-100 text-primary group-hover:scale-105"
              }`}>
                <Truck className="w-[18px] h-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] transition-colors duration-150 ${
                  selectedPartnerTypes.has("vendor") ? "text-blue-800" : "text-foreground group-hover:text-slate-800"
                }`} style={{ fontWeight: 600 }}>Vendor</p>
                <p className={`text-[11px] mt-0.5 truncate transition-colors duration-150 ${
                  selectedPartnerTypes.has("vendor") ? "text-[#3D98FF]" : "text-slate-400"
                }`}>Suppliers, manufacturers, and carriers in this group.</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {selectedPartnerTypes.has("vendor") && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenConfigure("vendor"); }}
                    className="inline-flex items-center gap-1 px-2 py-[5px] rounded-md bg-white/80 border border-[#7AB8FF]/40 text-[#086AE6] text-[11px] hover:bg-white hover:border-[#7AB8FF]/70 hover:shadow-sm transition-all duration-150 shrink-0"
                    style={{ fontWeight: 500 }}
                  >
                    <Settings2 className="w-3 h-3" />
                    <span className="hidden min-[480px]:inline">Configure</span>
                  </button>
                )}
                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                  selectedPartnerTypes.has("vendor")
                    ? "bg-[#0A77FF] shadow-[0_0_0_2px_rgba(59,130,246,0.15)]"
                    : "border-[1.5px] border-[#D1D5DB] bg-white group-hover:border-[#7AB8FF]"
                }`}>
                  {selectedPartnerTypes.has("vendor") && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                </div>
              </div>
            </div>
          </div>

          {/* Customer card — violet tint matching Partner Step 2 */}
          <div
            onClick={() => onPartnerTypeChange("customer")}
            className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
              selectedPartnerTypes.has("customer")
                ? "border-[#C4B5FD]/70 bg-white shadow-[0_1px_4px_rgba(139,92,246,0.06)]"
                : "border-border bg-white hover:border-[#D5D3EC] hover:shadow-[0_4px_16px_-4px_rgba(124,58,237,0.10)]"
            }`}
          >
            <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
              selectedPartnerTypes.has("customer")
                ? "bg-gradient-to-br from-violet-50/50 to-transparent"
                : "bg-gradient-to-br from-violet-50/0 to-violet-50/0 group-hover:from-violet-50/60 group-hover:to-transparent"
            }`} />
            <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
              <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                selectedPartnerTypes.has("customer")
                  ? "bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] text-violet"
                  : "bg-gradient-to-br from-violet-50 to-[#EDE9FE] text-violet-500 group-hover:scale-105"
              }`}>
                <ShoppingCart className="w-[18px] h-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] transition-colors duration-150 ${
                  selectedPartnerTypes.has("customer") ? "text-[#5B21B6]" : "text-foreground group-hover:text-slate-800"
                }`} style={{ fontWeight: 600 }}>Customer</p>
                <p className={`text-[11px] mt-0.5 truncate transition-colors duration-150 ${
                  selectedPartnerTypes.has("customer") ? "text-violet-400" : "text-slate-400"
                }`}>Buyers, dealers, and resellers in this group.</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {selectedPartnerTypes.has("customer") && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenConfigure("customer"); }}
                    className="inline-flex items-center gap-1 px-2 py-[5px] rounded-md bg-white/80 border border-[#C4B5FD]/40 text-[#5B21B6] text-[11px] hover:bg-white hover:border-[#C4B5FD]/70 hover:shadow-sm transition-all duration-150 shrink-0"
                    style={{ fontWeight: 500 }}
                  >
                    <Settings2 className="w-3 h-3" />
                    <span className="hidden min-[480px]:inline">Configure</span>
                  </button>
                )}
                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                  selectedPartnerTypes.has("customer")
                    ? "bg-violet shadow-[0_0_0_2px_rgba(139,92,246,0.15)]"
                    : "border-[1.5px] border-[#D1D5DB] bg-white group-hover:border-[#C4B5FD]"
                }`}>
                  {selectedPartnerTypes.has("customer") && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Points of Contact section removed per stakeholder spec
          (May 7) — POCs are not assigned at the Partner Group level.
          They live at the partner level (each partner picks its own)
          and at the location level. The earlier removal at line 3545
          was the wrong instance — this is the actual rendered card
          in the Step-1 Group Identity form. State + handlers
          (selectedContacts / pocPickerOpen / etc.) remain wired
          below pending a follow-up cleanup. ── */}

      {/* ── Attachments ── mirrors CreatePartnerStep2 AttachmentsSection exactly */}
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

        {/* Drop zone — matches Partner Step 2 exactly */}
        <div
          onDragOver={(e) => { e.preventDefault(); setAttachDragActive(true); }}
          onDragLeave={() => setAttachDragActive(false)}
          onDrop={(e) => { e.preventDefault(); setAttachDragActive(false); onAddAttachments(e.dataTransfer.files); }}
          onClick={() => attachInputRef.current?.click()}
          className={`rounded-lg border-2 border-dashed p-3 sm:p-4 text-center cursor-pointer transition-all ${
            attachDragActive
              ? "border-primary bg-accent/30"
              : "border-border bg-white hover:border-slate-300 hover:bg-[#FAFBFC]"
          }`}
        >
          <input
            ref={attachInputRef}
            type="file"
            multiple
            onChange={(e) => { onAddAttachments(e.target.files); e.currentTarget.value = ""; }}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              attachDragActive ? "bg-[#D6E8FF] text-primary" : "bg-muted text-slate-400"
            }`}>
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-foreground" style={{ fontWeight: 500 }}>
                <span className="text-primary">Click to upload</span><span className="hidden sm:inline"> or drag and drop</span>
              </p>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Images up to 10 MB. All other file types up to 100 MB</p>
            </div>
          </div>
        </div>

        {/* Uploaded files list — matches Partner Step 2 exactly */}
        {attachments.length > 0 && (
          <div className="mt-2.5 space-y-1.5">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md border border-border bg-white hover:bg-[#FAFBFC] transition-colors group"
              >
                <span className="text-base">{getAttachmentIcon(a.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate" style={{ fontWeight: 500 }}>{a.name}</p>
                  <p className="text-[11px] text-slate-400">{a.size}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(a.id)}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export type GroupMembersStepProps = {
  vendors: import("../../data/vendors").Vendor[];
  selectedMemberIds: Set<string>;
  primaryMemberIds: Set<string>;
  onToggleMember: (id: string) => void;
  onTogglePrimary: (id: string, partnerName: string) => void;
  onBulkSetPrimary: () => void;
  onBulkRemovePrimary: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  scope: Set<string>;
  /** When true, suppresses the "Add existing partners · Optional"
   *  helper banner. Used when the host surface already explains the
   *  step (e.g. the Add Partners modal opened from a group's
   *  Linked Partners tab — there the modal header carries the copy). */
  hideHelperBanner?: boolean;
  /** Optional node rendered in the toolbar row directly after the
   *  search input — used by the Add Partners modal to inline its
   *  Browse Partners / Added Partners view toggle so it sits on the
   *  same baseline as the search instead of stealing its own row. */
  toolbarExtras?: React.ReactNode;
  /** When true, drops the outer rounded-card border + footer-strip and
   *  makes the table fill the parent container's height. Used by the
   *  Add Partners modal to render edge-to-edge inside the modal body
   *  (mirrors the qualified-vendor item picker layout). */
  flush?: boolean;
  /** Optional node rendered as the first "selected" row in the table
   *  e.g. an inline indicator banner above the rows when in "added"
   *  mode. Kept for future use; currently unused. */
  preTableContent?: React.ReactNode;
  /** Review-mode flag — when true:
   *   - the bulk-action toolbar (N selected, Set N as primary, Remove
   *     primary) is hidden
   *   - row click no longer toggles selection (use the explicit Set as
   *     Primary toggle + Remove button instead)
   *  Used by the Add Partners modal's "Added Partners" tab so the bulk-
   *  primary affordances don't apply on the review surface. */
  readonly?: boolean;
  /** When provided, renders a per-row Remove (X) button — typically wired
   *  to unlink the partner from the group / drop it from the session
   *  pick set. Visible in both modes so users can remove a row regardless
   *  of whether the view is read-only. */
  onRowRemove?: (id: string, name: string) => void;
  /** Repurposes the bulk-action toolbar for a Remove flow instead of
   *  Set/Remove Primary. When set, the right-cluster shows a single
   *  "Remove N partner(s)" destructive button that fires `onBulkRemove`.
   *  Used by the Add Partners modal's Added view so the same checkbox
   *  affordance bulk-unlinks instead of bulk-promoting. */
  bulkRemoveMode?: { onBulkRemove: () => void };
  /** Force the Primary cell to render its toggle for every row regardless
   *  of selection state. Used by the Added Partners view so existing
   *  members show their primary state at a glance, even when nothing is
   *  selected for bulk action. */
  alwaysShowPrimary?: boolean;
  /** Partner ids whose PRIMARY group is the group being edited. Locked
   *  rows: the Primary pill can't be unmarked and the row Unlink button
   *  is disabled — both explain why via tooltip (a partner must always
   *  keep a primary group, ERP-5770). */
  lockedPrimaryIds?: Set<string>;
  /** The group this surface edits — locked rows show it in the Primary
   *  Group column (instead of the deterministic placeholder) so the row
   *  reads consistently with its lock. */
  currentGroup?: { id: string; name: string } | null;
};

/* ─── Deterministic primary-group mapping ──────────────────────────
 * Vendor data carries `partnerGroup` (a single group ID) but no
 * dedicated primaryGroupId yet. For the Primary Group column we spread
 * vendors across PARTNER_GROUPS via a stable hash so the column reads
 * with realistic variety instead of "Americas" on every row. A 1-in-6
 * partition returns null so some rows surface as "—" (no primary).
 * Replace with the live primaryGroupId lookup once it lands on Vendor. */
function _hashPrimaryKey(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}
export function getPrimaryGroupForVendor(vendorId: string): typeof PARTNER_GROUPS[number] | null {
  const h = _hashPrimaryKey(vendorId + ":primary");
  const r = h % (PARTNER_GROUPS.length + 1);
  if (r === 0) return null;
  return PARTNER_GROUPS[r - 1];
}

/* "Is THIS group the partner's primary group?" — the same deterministic
 * rule PartnerGroupDetailsPage seeds its Linked Partners primary markers
 * with (hashString(v.id + group.id) % 3 === 0), shared so the unlink
 * guard and the primary lock agree on every surface. Replace with a
 * primaryGroupId comparison once that field lands on Vendor (ERP-5770). */
export function isPartnerPrimaryLockedToGroup(vendorId: string, groupId: string): boolean {
  return _hashPrimaryKey(vendorId + groupId) % 3 === 0;
}

// Yellow search highlighter — matches the system-wide pattern (#FEFCE8 / #854D0E)
// Splits the text on the query (case-insensitive) and wraps matches in <mark>.
function highlightSearchMatch(text: string, query: string): React.ReactNode {
  if (!text) return text;
  const q = query.trim();
  if (!q) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  if (parts.length === 1) return text;
  const lower = q.toLowerCase();
  return parts.map((part, i) =>
    part.toLowerCase() === lower ? (
      <mark
        key={i}
        className="bg-transparent px-0.5 rounded-sm"
        style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

/* ─── Member-picker column defs — shared column-header system ─────────
 * `filterType` follows the Column Filters spec's data-type rule:
 *  - Partner (open name text) → "text"
 *  - Type (fixed vendor/customer pick-list) → "multiselect"
 *  - Status (fixed pick-list) → "multiselect"
 *  - Primary Group (bounded group-name pick-list) → "multiselect"
 *  - Primary (boolean state) → constrained two-value multiselect
 *    ("Primary" / "—") per the spec's boolean-as-constrained rule.
 * The checkbox + trailing action columns are control-only and stay
 * plain headers with no menu. Widths feed the freeze-offset math —
 * the 40px checkbox column always sits sticky at left 0, so frozen
 * data columns stack starting at offset 40 (Partner is locked). */
type MemberVendor = import("../../data/vendors").Vendor;

const MEMBER_COLUMN_DEFS: { key: string; label: string; width: number; sortable: boolean; filterType: FilterType }[] = [
  { key: "partner", label: "Partner", width: 220, sortable: true, filterType: "text" },
  { key: "type", label: "Type", width: 130, sortable: true, filterType: "multiselect" },
  { key: "status", label: "Status", width: 110, sortable: true, filterType: "multiselect" },
  { key: "primary_group", label: "Primary Group", width: 180, sortable: true, filterType: "multiselect" },
  { key: "primary", label: "Primary", width: 120, sortable: true, filterType: "multiselect" },
];
const MEMBER_LOCKED_COLUMN = "partner";
const MEMBER_CHECKBOX_WIDTH = 40;
const memberFilterTypeFor = (key: string): FilterType =>
  MEMBER_COLUMN_DEFS.find((c) => c.key === key)?.filterType ?? "text";

export function GroupMembersStep({
  vendors,
  selectedMemberIds,
  primaryMemberIds,
  onToggleMember,
  onTogglePrimary,
  onBulkSetPrimary,
  onBulkRemovePrimary,
  search,
  onSearchChange,
  scope,
  hideHelperBanner,
  toolbarExtras,
  flush,
  readonly,
  onRowRemove,
  bulkRemoveMode,
  alwaysShowPrimary,
  lockedPrimaryIds,
  currentGroup,
}: GroupMembersStepProps) {
  /* ─── Cell accessor — maps (row, columnKey) → raw filterable value.
   * Captures primaryMemberIds / lockedPrimaryIds / currentGroup so the
   * Primary and Primary Group columns filter+sort on exactly what the
   * cells render (locked rows show the current group, not the hash
   * placeholder; Primary reads "Primary" / "—"). ─── */
  const memberCellValue = useCallback<CellAccessor<MemberVendor>>((v, columnKey) => {
    switch (columnKey) {
      case "partner": return v.displayName || v.companyName;
      case "type": return (v.partnerTypes || []).map((t) => (t === "vendor" ? "Vendor" : "Customer"));
      case "status": return STATUS_LABELS[v.status] ?? v.status;
      case "primary_group": {
        const pg = lockedPrimaryIds?.has(v.id) && currentGroup ? currentGroup : getPrimaryGroupForVendor(v.id);
        return pg ? pg.name : "—";
      }
      case "primary": return primaryMemberIds.has(v.id) ? "Primary" : "—";
      default: return undefined;
    }
  }, [primaryMemberIds, lockedPrimaryIds, currentGroup]);

  /* ─── Column header state (sort / filter / hide / freeze) ─── */
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterState>>({});
  const [autoOpenFilterKey, setAutoOpenFilterKey] = useState<string | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set([MEMBER_LOCKED_COLUMN]));

  const columnFiltersList = useMemo(() => Object.values(columnFilters), [columnFilters]);
  const columnLabels = useMemo(() => Object.fromEntries(MEMBER_COLUMN_DEFS.map((c) => [c.key, c.label])), []);

  /* Scope-only base set — multiselect filter options come from here so
   * they stay stable while the user types in search or stacks filters. */
  const scoped = useMemo(() => {
    return vendors.filter((v) => {
      const types = v.partnerTypes || [];
      return !(scope.size > 0 && !types.some((t) => scope.has(t)));
    });
  }, [vendors, scope]);

  const uniqueValuesMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    MEMBER_COLUMN_DEFS.forEach((c) => {
      if (c.filterType === "multiselect") map[c.key] = getUniqueColumnValues(c.key, scoped, memberCellValue);
    });
    return map;
  }, [scoped, memberCellValue]);

  const handleSort = useCallback((key: string, direction: "asc" | "desc" | null) => {
    setSortConfig(direction === null ? null : { key, direction });
  }, []);
  const handleAddColumnFilter = useCallback((columnKey: string) => {
    setColumnFilters((prev) => prev[columnKey] ? prev : { ...prev, [columnKey]: createBlankFilter(columnKey, memberFilterTypeFor(columnKey)) });
  }, []);
  const handleAddColumnFilterWithAutoOpen = useCallback((columnKey: string) => {
    setColumnFilters((prev) => prev[columnKey] ? prev : { ...prev, [columnKey]: createBlankFilter(columnKey, memberFilterTypeFor(columnKey)) });
    setAutoOpenFilterKey(null);
    setTimeout(() => setAutoOpenFilterKey(columnKey), 0);
  }, []);
  const handleColumnFilterChange = useCallback((columnKey: string, filter: ColumnFilterState) => {
    setColumnFilters((prev) => ({ ...prev, [columnKey]: filter }));
  }, []);
  const handleRemoveColumnFilter = useCallback((columnKey: string) => {
    setColumnFilters((prev) => { const next = { ...prev }; delete next[columnKey]; return next; });
  }, []);
  const handleClearAllColumnFilters = useCallback(() => setColumnFilters({}), []);
  const handleHideColumn = useCallback((columnKey: string) => {
    setHiddenColumns((prev) => new Set(prev).add(columnKey));
    setSortConfig((prev) => (prev?.key === columnKey ? null : prev));
  }, []);
  const handleFreezeColumn = useCallback((columnKey: string) => {
    setFrozenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey) && columnKey !== MEMBER_LOCKED_COLUMN) next.delete(columnKey); else next.add(columnKey);
      return next;
    });
  }, []);

  const visibleColumns = useMemo(() => MEMBER_COLUMN_DEFS.filter((c) => !hiddenColumns.has(c.key)), [hiddenColumns]);

  /* Frozen columns stack from the left in visible order. The sticky
   * checkbox column always occupies the first 40px, so data-column
   * offsets start there (Partner lands at 40 — its original offset). */
  const frozenOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let left = MEMBER_CHECKBOX_WIDTH;
    visibleColumns.forEach((c) => {
      if (frozenColumns.has(c.key)) { offsets[c.key] = left; left += c.width; }
    });
    return offsets;
  }, [visibleColumns, frozenColumns]);
  const lastFrozenKey = useMemo(() => {
    const frozen = visibleColumns.filter((c) => frozenColumns.has(c.key));
    return frozen.length ? frozen[frozen.length - 1].key : null;
  }, [visibleColumns, frozenColumns]);

  /* Pipeline: scope → search → column filters → sort. */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = !q ? scoped : scoped.filter((v) =>
      v.companyName.toLowerCase().includes(q) || v.code.toLowerCase().includes(q) || v.country.toLowerCase().includes(q)
    );
    result = applyFilters(result, columnFiltersList, memberCellValue);
    return sortRows(result, sortConfig, memberCellValue, memberFilterTypeFor);
  }, [scoped, search, columnFiltersList, sortConfig, memberCellValue]);

  // Pagination state — matches the canonical listing-page treatment.
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  useEffect(() => { setPage(1); }, [search, scope, vendors.length, columnFiltersList]);
  // "All" is represented by perPage === -1.
  const effectivePerPage = perPage === -1 ? Math.max(1, filtered.length) : perPage;
  const totalPages = Math.max(1, Math.ceil(filtered.length / effectivePerPage));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * effectivePerPage;
  const paginated = filtered.slice(pageStart, pageStart + effectivePerPage);
  const pageNumbers = useMemo<(number | "...")[]>(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (safePage > 3) pages.push("...");
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
    if (safePage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  }, [safePage, totalPages]);

  // Select-all checkbox state — scoped to the current page so it
  // doesn't silently fan out across paginated rows the user can't
  // see. Three visual states: empty (none on page), checked (all on
  // page), indeterminate (some on page).
  const pageIds = paginated.map((v) => v.id);
  const selectedOnPage = pageIds.filter((id) => selectedMemberIds.has(id));
  const allOnPageSelected = pageIds.length > 0 && selectedOnPage.length === pageIds.length;
  const someOnPageSelected = selectedOnPage.length > 0 && !allOnPageSelected;
  const toggleAllOnPage = () => {
    if (allOnPageSelected) {
      selectedOnPage.forEach((id) => onToggleMember(id));
    } else {
      pageIds.filter((id) => !selectedMemberIds.has(id)).forEach((id) => onToggleMember(id));
    }
  };

  return (
    <div className={flush ? "flex flex-col h-full" : "space-y-3.5"}>
      {/* Helper banner — calls out the optional nature of the step and the
          two distinct actions: linking (puts a partner in the group) vs
          marking as primary (group's template becomes the partner's
          default source). Suppressed when the host surface already
          explains the step (e.g. the Add Partners modal opened from the
          Linked Partners tab — its modal header carries the same copy). */}
      {!hideHelperBanner && (
        <div className="rounded-lg border border-border bg-white px-3.5 py-2.5 flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-md bg-accent border border-primary/20 flex items-center justify-center shrink-0 text-primary">
            <Users className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
              Add Existing Partners <span className="text-slate-400" style={{ fontWeight: 500 }}>· Optional</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              This step is optional, you can skip it now and add partners later from the group's detail page. If you do link partners here, only the rows you explicitly mark as <span className="text-foreground" style={{ fontWeight: 600 }}>primary</span> will use this group's template as their default source.
            </p>
          </div>
        </div>
      )}

      {/* Toolbar — when `flush`, drops the rounded-card border so the
          table sits edge-to-edge in its container (used by the Add
          Partners modal). */}
      <div className={flush ? "flex flex-col flex-1 min-h-0 bg-white overflow-hidden" : "rounded-xl border border-border bg-white overflow-hidden"}>
        <div className="px-3.5 py-2.5 border-b border-border flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search partners by name..."
              className="pl-9 h-9 text-[13px]"
            />
          </div>
          {/* Optional toolbar extras (e.g. Browse/Added view toggle from
              the Add Partners modal) — sits inline with the search so
              both controls share the same baseline. */}
          {toolbarExtras}
          {/* Right-aligned cluster — bulk action variants:
                - Default (Browse / Create-flow step 2): "N selected" +
                  Set N as primary / Remove primary.
                - bulkRemoveMode (Added view): "N selected" + destructive
                  "Remove N partners" red button.
              Both hidden when no rows are selected. */}
          {!readonly && selectedMemberIds.size > 0 && (() => {
            const unpromotedCount = Array.from(selectedMemberIds).filter((id) => !primaryMemberIds.has(id)).length;
            // Locked primaries (this group IS the partner's primary) can't
            // be un-primaried, so the Remove-primary CTA only counts the
            // removable ones — it never lights up for a rule-blocked no-op.
            const promotedCount = Array.from(selectedMemberIds).filter((id) => primaryMemberIds.has(id) && !lockedPrimaryIds?.has(id)).length;
            return (
              <div className="ml-auto flex items-center gap-2.5">
                <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                  <span className="text-foreground" style={{ fontWeight: 600 }}>{selectedMemberIds.size}</span> selected
                </span>
                {/* Bulk destructive actions live on the LEFT, primary
                    action on the RIGHT — same anchored layout across
                    Create / Edit / Add-Partners modals so the user's
                    muscle memory carries between surfaces. */}
                {/* Bulk remove primary — destructive red. Same pill as
                    bulk remove-from-group; visible only when at least
                    one selected member is currently primary. */}
                {promotedCount > 0 && (
                  <button
                    type="button"
                    onClick={onBulkRemovePrimary}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-[11px] hover:bg-red-100 hover:border-red-300 transition-colors cursor-pointer"
                    style={{ fontWeight: 600 }}
                  >
                    <X className="w-3 h-3" />
                    Remove Primary{promotedCount > 1 ? ` (${promotedCount})` : ""}
                  </button>
                )}
                {/* Bulk unlink from group — destructive, only when the
                    host wired bulkRemoveMode (i.e. Added Partners view).
                    Sits with the other destructive actions on the left.
                    Uses the canonical broken-link icon to match the
                    per-row Unlink action and the unlink-confirm dialog. */}
                {bulkRemoveMode && (
                  <button
                    type="button"
                    onClick={bulkRemoveMode.onBulkRemove}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-[11px] hover:bg-red-100 hover:border-red-300 transition-colors cursor-pointer"
                    style={{ fontWeight: 600 }}
                  >
                    <Unlink2 className="w-3 h-3" />
                    Unlink {selectedMemberIds.size} Partner{selectedMemberIds.size === 1 ? "" : "s"}
                  </button>
                )}
                {/* Bulk set primary — accent-tinted pill, the headline
                    bulk action. Hidden when every selected member is
                    already primary so it never lights up for a no-op.
                    Anchored to the RIGHT so the primary CTA always sits
                    last in the cluster. */}
                {unpromotedCount > 0 && (
                  <button
                    type="button"
                    onClick={onBulkSetPrimary}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-blue-100 bg-accent text-primary text-[11px] hover:bg-blue-100 transition-colors cursor-pointer"
                    style={{ fontWeight: 600 }}
                  >
                    <Star className="w-3 h-3" />
                    Set {unpromotedCount} as Primary
                  </button>
                )}
              </div>
            );
          })()}
        </div>

        {/* Active column filter chips — shared Notion-style bar, sits
            directly above the table container. */}
        {columnFiltersList.length > 0 && (
          <div className="pt-2.5 shrink-0 bg-white">
            <ActiveFiltersBar
              columnFilters={columnFiltersList}
              columnLabels={columnLabels}
              uniqueValuesByKey={uniqueValuesMap}
              lockedColumnKey={MEMBER_LOCKED_COLUMN}
              onFilterChange={handleColumnFilterChange}
              onRemoveFilter={handleRemoveColumnFilter}
              onAddFilter={handleAddColumnFilterWithAutoOpen}
              onClearAll={handleClearAllColumnFilters}
              autoOpenKey={autoOpenFilterKey}
              onAutoOpened={() => setAutoOpenFilterKey(null)}
              availableColumns={MEMBER_COLUMN_DEFS.map((c) => ({ key: c.key, label: c.label }))}
            />
          </div>
        )}

        {/* Member table — `flush` mode lets the table fill the parent
            container height instead of capping at 440px. */}
        <div className={flush ? "flex-1 min-h-0 overflow-auto" : "max-h-[440px] overflow-auto"}>
          {filtered.length === 0 ? (
            <div className="p-10 text-center">
              <Users className="w-7 h-7 mx-auto text-slate-300" />
              <p className="text-[12px] text-slate-500 mt-2" style={{ fontWeight: 600 }}>No partners match</p>
              <p className="text-[11px] text-slate-400 mt-1">Adjust your search or column filters, or skip this step and add partners later from the group's detail view.</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr>
                  {/* Control-only select column — plain header, no menu.
                      Sticky at left 0 so frozen data columns stack after it. */}
                  <th className="w-[40px] pl-3 py-2 text-left border-b border-border sticky left-0 z-20 bg-slate-50">
                    {!readonly && (
                      <Checkbox
                        checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
                        onCheckedChange={toggleAllOnPage}
                        aria-label={allOnPageSelected ? "Deselect all on page" : "Select all on page"}
                        title={allOnPageSelected ? "Deselect all on page" : "Select all on page"}
                        className="align-middle"
                      />
                    )}
                  </th>
                  {visibleColumns.map((def) => {
                    const isFrozen = frozenColumns.has(def.key);
                    const isLocked = def.key === MEMBER_LOCKED_COLUMN;
                    const currentColSort: "asc" | "desc" | null = sortConfig?.key === def.key ? sortConfig.direction : null;
                    const hasFilter = columnFilters[def.key] ? isFilterActive(columnFilters[def.key]) : false;
                    return (
                      <th
                        key={def.key}
                        className={`text-left pl-2 pr-2 py-2 text-slate-500 text-[11px] border-b border-border whitespace-nowrap relative group/colheader ${isFrozen ? "sticky bg-slate-50 z-20" : ""} ${hasFilter && !isFrozen ? "bg-primary/[0.03]" : ""}`}
                        style={{
                          fontWeight: 500,
                          minWidth: `${def.width}px`,
                          ...(isFrozen ? { left: `${frozenOffsets[def.key] ?? 0}px` } : {}),
                          ...(def.key === lastFrozenKey ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                        }}
                      >
                        <div className="flex items-center">
                          <ColumnHeaderMenu
                            columnKey={def.key}
                            label={def.label}
                            sortable={def.sortable}
                            sortConfig={sortConfig}
                            onSort={handleSort}
                            onAddFilter={handleAddColumnFilter}
                            onHideColumn={handleHideColumn}
                            onFreezeColumn={handleFreezeColumn}
                            isFrozen={isFrozen}
                            isLocked={isLocked}
                            hasActiveFilter={hasFilter}
                            filter={columnFilters[def.key] ?? null}
                            uniqueValues={uniqueValuesMap[def.key]}
                            filterTypeOverride={def.filterType}
                            onFilterChange={handleColumnFilterChange}
                          >
                            <div className="inline-flex items-center gap-1">
                              <span style={currentColSort || hasFilter ? { color: "rgb(var(--primary))" } : undefined}>{def.label}</span>
                              {hasFilter && !currentColSort && (
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "rgb(var(--primary))" }} />
                              )}
                              {currentColSort === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                              {currentColSort === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "rgb(var(--primary))" }} />}
                              {!currentColSort && !hasFilter && def.sortable && (
                                <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />
                              )}
                            </div>
                          </ColumnHeaderMenu>
                        </div>
                      </th>
                    );
                  })}
                  {onRowRemove && (
                    <th className="w-[44px] pr-3 py-2 text-right text-slate-500 text-[11px] border-b border-border" style={{ fontWeight: 500 }} />
                  )}
                </tr>
              </thead>
              <tbody>
                {paginated.map((v) => {
                  const checked = selectedMemberIds.has(v.id);
                  const isPrimary = primaryMemberIds.has(v.id);
                  // This group IS the partner's primary group — the row's
                  // Primary pill and Unlink button lock with an explainer
                  // (a partner must always keep a primary group).
                  const locked = !!lockedPrimaryIds?.has(v.id);
                  const tint = getAvatarTint(v.companyName);
                  const initials = v.companyName.split(/[\s&]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                  const types = v.partnerTypes || [];
                  const partnerLabel = v.displayName || v.companyName;
                  /* Frozen (sticky-left) cells need a solid background so
                     scrolled content doesn't bleed through — mirror the
                     row's checked/hover tint with solid equivalents
                     (#FAFCFF ≈ accent/30 flattened over white). */
                  const frozenTdBg = checked ? "bg-[#FAFCFF]" : readonly ? "bg-white" : "bg-white group-hover/row:bg-slate-50";
                  /* Per-column cell renderer — content unchanged, keyed so
                     hide/freeze render through the same visibleColumns map
                     as the header. */
                  const cell = (key: string): React.ReactNode => {
                    switch (key) {
                      case "partner":
                        return (
                          <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-md flex items-center justify-center text-[9px] shrink-0 border border-[#E8ECF1]" style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 700 }}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            {/* Name is its own click target — opens the partner
                                detail page in a new tab. stopPropagation keeps
                                the row's selection toggle from firing. Hover
                                turns it primary blue + underlines, matching
                                the rest of the listing tables. */}
                            <a
                              href={`/vendors/${v.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[12px] text-foreground truncate block hover:text-primary hover:underline transition-colors"
                              style={{ fontWeight: 500 }}
                            >
                              {highlightSearchMatch(partnerLabel, search)}
                            </a>
                            {/* One-line partner descriptor under the name —
                                falls back through description → services →
                                category so the row always shows context
                                regardless of which fields are populated. */}
                            <p className="text-[10px] text-slate-400 truncate">
                              {highlightSearchMatch(v.description || v.services || v.category || "—", search)}
                            </p>
                          </div>
                        </div>
                        );
                      case "type":
                        return (
                        <div className="flex items-center gap-1 flex-wrap">
                          {types.length > 0 ? types.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center px-1.5 py-px text-[10px] rounded-md border"
                              style={{
                                fontWeight: 500,
                                backgroundColor: t === "vendor" ? "#EBF3FF" : "#F5F3FF",
                                color: t === "vendor" ? "#0548A3" : "#5B21B6",
                                borderColor: t === "vendor" ? "#A8D2FF" : "#DDD6FE",
                              }}
                            >
                              {t === "vendor" ? "Vendor" : "Customer"}
                            </span>
                          )) : <span className="text-[11px] text-slate-400">–</span>}
                        </div>
                        );
                      case "status":
                        return (
                        <span
                          className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] border"
                          style={{
                            fontWeight: 500,
                            backgroundColor: v.status === "active" ? "#ECFDF5" : v.status === "inactive" ? "#FFFBEB" : "rgb(var(--muted))",
                            color: v.status === "active" ? "#065F46" : v.status === "inactive" ? "#92400E" : "#334155",
                            borderColor: v.status === "active" ? "#A7F3D0" : v.status === "inactive" ? "#FDE68A" : "#CBD5E1",
                          }}
                        >
                          {STATUS_LABELS[v.status] ?? v.status}
                        </span>
                        );
                      /* Primary Group — the partner's currently-set primary
                         group at the org level (separate from the row's
                         this-group primary toggle). Rendered as a small
                         tinted avatar + name link; clicking opens the
                         group's detail page in a new tab, mirroring how
                         partner names deep-link to /vendors/:id in the
                         same table. */
                      case "primary_group":
                        return (() => {
                          // Locked rows: THIS group is the partner's primary,
                          // so the column shows the current group rather than
                          // the deterministic placeholder — the row reads
                          // consistently with its locked Primary pill.
                          const pg = locked && currentGroup
                            ? { id: currentGroup.id, name: currentGroup.name }
                            : getPrimaryGroupForVendor(v.id);
                          if (!pg) return <span className="text-[11px] text-slate-300" style={{ fontWeight: 500 }}>—</span>;
                          const tint = getAvatarTint(pg.name);
                          const initials = pg.name.split(/[\s&]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                          return (
                            <a
                              href={`/partners/groups/${pg.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title={pg.name}
                              className="inline-flex items-center gap-2 min-w-0 group/pg cursor-pointer max-w-full"
                            >
                              <div
                                className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] shrink-0 border border-[#E8ECF1] group-hover/pg:border-primary/30 transition-colors"
                                style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 700 }}
                              >
                                {initials}
                              </div>
                              <span
                                className="text-[11px] text-slate-700 truncate group-hover/pg:text-primary group-hover/pg:underline transition-colors"
                                style={{ fontWeight: 500 }}
                              >
                                {pg.name}
                              </span>
                            </a>
                          );
                        })();
                      /* Primary toggle — interactive whenever the row is
                         checked OR the host explicitly opts every row in
                         via alwaysShowPrimary (Added Partners view), so
                         existing-member rows always show their primary
                         state at a glance. The td-level stopPropagation
                         lives on the mapped cell below. */
                      case "primary":
                        return checked || alwaysShowPrimary || readonly ? (
                          // Primary toggle is available in BOTH the
                          // pick (Browse) and review (Added) modes —
                          // the user explicitly asked for the same
                          // affordance in Added Partners. PrimaryPill
                          // matches the canonical style used elsewhere
                          // for filled-primary state.
                          isPrimary ? (
                            locked ? (
                              // Locked primary — this group IS the partner's
                              // primary group, so the pill can't be unmarked
                              // here. Tooltip explains why + how to change it.
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-[2px] rounded-md text-blue-800 bg-blue-50 border border-blue-200 text-[10px] cursor-not-allowed"
                                    style={{ fontWeight: 600 }}
                                    aria-label="Primary (locked)"
                                    aria-disabled
                                  >
                                    <Star className="w-2.5 h-2.5 fill-blue-800 text-blue-800" /> Primary
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="left" sideOffset={6} className="max-w-[250px] text-[11px] leading-[1.5] z-[300]">
                                  <p style={{ fontWeight: 600 }}>Primary can't be removed here</p>
                                  <p className="text-slate-500 mt-1">
                                    {currentGroup?.name || "This group"} is {partnerLabel}'s primary group, and every partner must keep one primary group. Open the partner's page and set a different group as primary first.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                            // Canonical PrimaryPill styling (light-blue
                            // tint + filled blue star) — matches the
                            // PrimaryPill component used everywhere
                            // else in the system. Kept as a button so
                            // users can click to unmark.
                            <button
                              type="button"
                              onClick={() => onTogglePrimary(v.id, partnerLabel)}
                              className="inline-flex items-center gap-1 px-2 py-[2px] rounded-md text-blue-800 bg-blue-50 border border-blue-200 text-[10px] cursor-pointer hover:bg-blue-100 transition-colors"
                              style={{ fontWeight: 600 }}
                              aria-label="Unmark primary"
                            >
                              <Star className="w-2.5 h-2.5 fill-blue-800 text-blue-800" /> Primary
                            </button>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => onTogglePrimary(v.id, partnerLabel)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-white text-[10px] text-slate-500 hover:text-primary hover:border-primary/30 hover:bg-accent transition-all cursor-pointer"
                              style={{ fontWeight: 600 }}
                            >
                              <Star className="w-2.5 h-2.5" /> Set as Primary
                            </button>
                          )
                        ) : (
                          <span className="text-[10px] text-slate-300" style={{ fontWeight: 500 }}>—</span>
                        );
                      default:
                        return null;
                    }
                  };
                  return (
                    <tr
                      key={v.id}
                      onClick={readonly ? undefined : () => onToggleMember(v.id)}
                      className={`group/row transition-colors border-b border-muted ${readonly ? "" : "cursor-pointer"} ${checked ? "bg-accent/30" : readonly ? "" : "hover:bg-slate-50"}`}
                    >
                      {/* Control-only select cell — sticky at left 0, in
                          lock-step with its sticky header. Display-only:
                          the row's onClick handles toggling, same as the
                          listing tables' square checkbox. */}
                      <td className={`pl-3 py-2 align-middle sticky left-0 z-10 ${frozenTdBg}`}>
                        <Checkbox
                          checked={checked}
                          tabIndex={-1}
                          className="align-middle pointer-events-none"
                          aria-hidden
                        />
                      </td>
                      {visibleColumns.map((def) => {
                        const isFrozen = frozenColumns.has(def.key);
                        return (
                          <td
                            key={def.key}
                            onClick={def.key === "primary" ? (e) => e.stopPropagation() : undefined}
                            className={`pl-2 pr-2 py-2 align-middle ${isFrozen ? `sticky z-10 ${frozenTdBg}` : ""}`}
                            style={{
                              ...(isFrozen ? { left: `${frozenOffsets[def.key] ?? 0}px` } : {}),
                              ...(def.key === lastFrozenKey ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                            }}
                          >
                            {cell(def.key)}
                          </td>
                        );
                      })}
                      {onRowRemove && (
                        <td className="pr-3 py-2 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                          {locked ? (
                            // Unlink is blocked while this group is the
                            // partner's primary — disabled button + tooltip
                            // explaining the why and the fix path.
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-slate-300 cursor-not-allowed" aria-label={`Can't unlink ${partnerLabel} — primary group`}>
                                  <Unlink2 className="w-3.5 h-3.5" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="left" sideOffset={6} className="max-w-[250px] text-[11px] leading-[1.5] z-[300]">
                                <p style={{ fontWeight: 600 }}>Can't unlink {partnerLabel} yet</p>
                                <p className="text-slate-500 mt-1">
                                  {currentGroup?.name || "This group"} is their primary group, and a partner must always have one. Set a different group as their primary from the partner's page, then unlink here.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => onRowRemove(v.id, partnerLabel)}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-md text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                  aria-label={`Unlink ${partnerLabel}`}
                                >
                                  <Unlink2 className="w-3.5 h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left" sideOffset={6} className="max-w-[250px] text-[11px] leading-[1.5] z-[300]">
                                <p style={{ fontWeight: 600 }}>Unlink {partnerLabel} from {currentGroup?.name || "this group"}</p>
                                <p className="text-slate-500 mt-1">
                                  Only the group link is removed — payment terms, pricing rules, and history stay as-is. E.g. a partner on Net 60 keeps Net 60; they just stop inheriting this group's template updates.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Standard pagination footer — matches the canonical listing-
            page treatment (Records per page · ‹‹ ‹ Prev · 1 2 ... ·
            Next › ››). Replaces the old "N partners match · You can add
            or remove members later" strip per stakeholder ask. */}
        <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-2.5 border-t border-border gap-3 shrink-0 bg-white">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Records per Page</span>
            <Select value={perPage === -1 ? "all" : String(perPage)} onValueChange={(v) => { setPerPage(v === "all" ? -1 : Number(v)); setPage(1); }}>
              <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[350]">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={safePage <= 1} onClick={() => setPage(1)}>
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </Button>
            {pageNumbers.map((p, idx) => p === "..." ? (
              <span key={`d${idx}`} className="px-1 text-sm text-muted-foreground">...</span>
            ) : (
              <Button
                key={p}
                variant={safePage === p ? "default" : "ghost"}
                size="sm"
                className={`h-8 w-8 p-0 text-sm ${safePage === p ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                onClick={() => setPage(p as number)}
              >
                {p}
              </Button>
            ))}
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}