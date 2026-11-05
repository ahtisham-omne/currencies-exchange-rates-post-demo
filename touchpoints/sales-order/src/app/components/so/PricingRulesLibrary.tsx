/**
 * Pricing Rules Library — SO module.
 *
 * Ported verbatim from Partner Management Vendors v5
 * (`/src/app/components/vendors/PricingRulesTab.tsx`) and re-shaped into a
 * modal (full-viewport overlay) for use from the Sales Order line item
 * configurator. The body matches the Partner detail page's Pricing Rules
 * tab so users see the same chrome, filters, card grid, kebab actions,
 * and create/browse-templates flows. The only delta vs. Partner is the
 * header — a back arrow, customer thumb/avatar, customer name, and
 * "Pricing Rules" subtitle — and the removal of the Vendor/Customer
 * scope toggle (the SO context is always customer-side).
 *
 * Stubs replace the partner-domain dependencies:
 *   - PartnerItemsTab → inline lightweight items panel
 *   - AttachmentsTab → inline lightweight attachments list
 *   - ActivityFeed → inline lightweight activity list
 *   - useVendors / usePricingRuleStatus → local state
 *   - PRICING_RULE_PRESETS / PricingRulePreset → inlined data + types
 */
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { ExpandableTextarea } from "./ExpandableTextarea";
import { PctAmountToggle } from "./PctAmountToggle";
import { InfoTooltip } from "../ui/info-tooltip";
import { FilterPills } from "./FilterPills";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Switch } from "../ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Checkbox } from "../ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Search,
  X,
  Plus,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreVertical,
  AlertCircle,
  AlertTriangle,
  Clock,
  Package,
  FolderOpen,
  FileText,
  BookOpen,
  Eye,
  Pencil,
  Copy,
  Trash2,
  Archive,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Tag,
  Users,
  Paperclip,
  History,
  Activity,
  MessageSquare,
  Info,
  MoreHorizontal,
  Grid3X3,
  Layers,
  CalendarDays,
  TrendingDown,
  TrendingUp,
  ToggleLeft,
  CircleSlash,
  Maximize2,
  Minimize2,
  CirclePlus,
  DollarSign,
  ChartColumn,
  Check,
  Lock,
  LayoutGrid,
  Rows3,
  Grid2X2,
  ExternalLink,
  Building2,
  Truck as TruckIcon,
  ShoppingCart,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmationModal } from "../ConfirmationModal";
import { getAvatarTint } from "./avatarTints";
import { Textarea } from "../ui/textarea";

// ── Inlined preset data + types (formerly imported from partnerConstants) ──
type PricingRuleBasis = "value" | "volume";
interface PricingRulePreset {
  id: string;
  name: string;
  category: "discount" | "premium" | "all";
  basis: PricingRuleBasis;
  tierType: "single" | "multiple";
  totalTiers?: number;
  tiers: { minValue: string; maxValue: string; discount: string }[];
  description: string;
  aboutText?: string;
  vendorsApplied?: number;
  validityPeriod?: string;
  warningText?: string;
}
const PRICING_RULE_PRESETS: PricingRulePreset[] = [
  { id: "pr-1", name: "Standard Discount – Value (Single-Tier)", category: "discount", basis: "value", tierType: "single", tiers: [{ minValue: "$1,000", maxValue: "$25,000", discount: "10%" }], description: "10% off on orders over $1,000", aboutText: "Straightforward, commonly used model where a fixed percentage discount is applied once the total purchase value exceeds a defined threshold." },
  { id: "pr-2", name: "Standard Discount – Volume (Single-Tier)", category: "discount", basis: "volume", tierType: "single", tiers: [{ minValue: "100 EA", maxValue: "500 EA", discount: "10%" }], description: "10% off on orders of 100+ units", aboutText: "Volume-based single-tier discount that applies a fixed percentage when the order quantity meets or exceeds a set threshold." },
  { id: "pr-3", name: "Tiered Discount – Value (Multi-Tier)", category: "discount", basis: "value", tierType: "multiple", tiers: [{ minValue: "$1,000", maxValue: "$4,999", discount: "10%" }, { minValue: "$5,000", maxValue: "$9,999", discount: "10%" }, { minValue: "$10,000", maxValue: "$24,999", discount: "10%" }, { minValue: "$25,000", maxValue: "$50,000", discount: "10%" }], description: "10% off at each tier from $1K to $25K", aboutText: "Multi-tier discount that applies at distinct value thresholds — useful when you want the discount percentage to scale with order size." },
  { id: "pr-4", name: "Tiered Discount – Volume (Multi-Tier)", category: "discount", basis: "volume", tierType: "multiple", tiers: [{ minValue: "35 EA", maxValue: "100 EA", discount: "5%" }, { minValue: "100 EA", maxValue: "250 EA", discount: "10%" }, { minValue: "250 EA", maxValue: "500 EA", discount: "15%" }, { minValue: "500 EA", maxValue: "1,000 EA", discount: "20%" }], description: "Increasing discount by quantity bracket", aboutText: "Quantity-based tiers that grow the discount as volume increases — encourages larger orders." },
  { id: "pr-5", name: "Standard Premium – Value (Single-Tier)", category: "premium", basis: "value", tierType: "single", tiers: [{ minValue: "$0", maxValue: "$5,000", discount: "8%" }], description: "8% premium for expedited / rush orders", aboutText: "Adds a flat premium percentage to qualifying orders — typically rush, custom, or non-standard processing." },
  { id: "pr-6", name: "Standard Premium – Volume (Single-Tier)", category: "premium", basis: "volume", tierType: "single", tiers: [{ minValue: "1 EA", maxValue: "20 EA", discount: "12%" }], description: "12% premium for small-batch orders", aboutText: "Premium applied to low-volume orders to recover fixed handling overhead." },
  { id: "pr-7", name: "Tiered Premium – Value (Multi-Tier)", category: "premium", basis: "value", tierType: "multiple", tiers: [{ minValue: "$0", maxValue: "$200", discount: "10%" }, { minValue: "$200", maxValue: "$500", discount: "7%" }, { minValue: "$500", maxValue: "$1,000", discount: "5%" }, { minValue: "$1,000", maxValue: "$5,000", discount: "3%" }], description: "Premium scales down as value grows", aboutText: "Multi-tier premium that fades as the order grows in value — common for handling-fee structures." },
  { id: "pr-8", name: "Tiered Premium – Volume (Multi-Tier)", category: "premium", basis: "volume", tierType: "multiple", tiers: [{ minValue: "1 EA", maxValue: "25 EA", discount: "$50" }, { minValue: "25 EA", maxValue: "50 EA", discount: "$25" }, { minValue: "50 EA", maxValue: "100 EA", discount: "$15" }, { minValue: "100 EA", maxValue: "250 EA", discount: "$10" }], description: "Flat handling premium per quantity bracket", aboutText: "Fixed-rate per-unit premium that decreases with order volume." },
];

// ── Stubbed AttachmentFile + ActivityFeedItemType (formerly imported) ──
interface AttachmentFile {
  id: string;
  name: string;
  size: string;
  type: string;
  date: string;
  uploadedBy: string;
}
// Partner's ActivityFeed accepts a string-union type per item (the kind of
// event). The exact tokens don't matter for the SO stub since we just
// render a placeholder list — keep the alias narrow enough that the
// callsite (which casts an arbitrary `string` to this) type-checks.
type ActivityFeedItemType = "create" | "edit" | "apply" | "remove" | "system" | "note" | "status" | string;

// ── Minimal Vendor type — the original Partner v5 file used a rich Vendor
// type pulled from the vendors data store. In SO we only need a "customer"
// shape, but the Partner tab body references several other fields when
// rendering the right-side detail (status, partnerTypes, itemCodes,
// countryFlag, creditLimit). We make those all optional so the library
// renders correctly with just `companyName`. ──
interface Vendor {
  id: string;
  companyName: string;
  displayName?: string;
  country?: string;
  countryFlag?: string;
  status?: "Active" | "Inactive";
  partnerTypes?: string[];
  itemCodes?: string[];
  creditLimit?: number;
}
interface VendorConfigData {
  [key: string]: unknown;
}

// ── Stubbed useVendors / usePricingRuleStatus — in Partner Management
// these are app-wide contexts. Here they're local no-ops: useVendors()
// returns an empty list (the library doesn't browse other partners), and
// usePricingRuleStatus() keeps state in-memory. ──
function useVendors(): { vendors: Vendor[] } {
  return { vendors: [] };
}
type PrStatus = "active" | "inactive" | "archived";
function usePricingRuleStatus(): {
  getStatus: (id: string) => PrStatus | undefined;
  setStatus: (id: string, status: PrStatus) => void;
} {
  const [map, setMap] = useState<Record<string, PrStatus>>({});
  return {
    getStatus: (id: string) => map[id],
    setStatus: (id: string, status: PrStatus) => setMap((m) => ({ ...m, [id]: status })),
  };
}

// ── Stubbed PartnerItemsTab / AttachmentsTab / ActivityFeed components.
// The Partner v5 detail modal embeds these heavy panels inside the Items,
// Attachments, and Recent Activity tabs. For the SO library we keep the
// tab shells but render simple summary lists. ──
function PartnerItemsTab(_: {
  vendor: Vendor;
  hideHeader?: boolean;
  compact?: boolean;
  contextLabel?: string;
  contextType?: "discount" | "premium";
}) {
  return (
    <div className="p-4 text-[12px] text-slate-500">
      <p style={{ fontWeight: 500 }}>Items associated with this pricing rule</p>
      <p className="mt-1 text-slate-400">Item assignment is configured at the rule level — see the customer's items list for full coverage.</p>
    </div>
  );
}
function AttachmentsTab(_: { files: AttachmentFile[]; embedded?: boolean }) {
  return (
    <div className="p-4 text-[12px] text-slate-500">
      <p style={{ fontWeight: 500 }}>Attachments</p>
      <p className="mt-1 text-slate-400">No attachments uploaded to this rule yet.</p>
    </div>
  );
}
interface ActivityFeedItem {
  id: string;
  type: ActivityFeedItemType;
  user: string;
  verb: string;
  target?: string;
  date: string;
}
function ActivityFeed(_: {
  items: ActivityFeedItem[];
  loading?: boolean;
  emptyText?: string;
  embedded?: boolean;
}) {
  return (
    <div className="p-4 text-[12px] text-slate-500">
      <p style={{ fontWeight: 500 }}>Recent activity</p>
      <p className="mt-1 text-slate-400">Rule edits, applications, and status changes will appear here.</p>
    </div>
  );
}

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface TierData {
  minQty: string;
  maxQty: string;
  discount: string;
  isFixRate?: boolean;
}

interface AssociatedItem {
  id: string;
  partNo: string;
  description: string;
  category: string;
  itemType: string;
  status: "Active" | "Inactive";
}

interface AssociatedCategory {
  id: string;
  code: string;
  name: string;
  description: string;
  itemType: string;
  status: "Active" | "Inactive";
  linkedItems: number;
}

interface AssociatedPartner {
  id: string;
  name: string;
  avatar: string;
  types: string[];
  itemCount: string;
  additionalItems: string;
  status: "Active" | "Inactive";
}

export interface PricingRule {
  id: string;
  ruleNo: string;
  name: string;
  category: "discount" | "premium";
  basis: "value" | "volume";
  tierType: "single" | "multiple";
  totalTiers: number;
  description: string;
  aboutText: string;
  status: "Active" | "Inactive";
  scope: "vendor" | "customer" | "both";
  validFrom: string;
  validTo: string;
  hasDateLimit: boolean;
  durationDays: number;
  itemCount: number;
  categoryCount: number;
  partnerCount: number;
  tiers: TierData[];
  createdBy: string;
  createdDate: string;
  warningText?: string;
  isPreset: boolean;
  items: AssociatedItem[];
  categories: AssociatedCategory[];
  partners: AssociatedPartner[];
}

// ──────────────────────────────────────────────
// Mock data constants
// ──────────────────────────────────────────────

const ITEM_DESCS = [
  "Front bulkhead cabinet lower cover", "Box walls inlay cabinet", "Box walls inlay cabinet with defibrillator",
  "Box closeout top cap inlay cabinet", "Toyota long cut, emergency brake", "Toyota long cut, brake line bracket",
  "Toyota long cut, 48 inch wide rear", "Toyota wide Black Diamond Tread", "Toyota long cut, second row seat",
  "Second row seat base, driver side", "Standard floor with kneeling system", "Phillips pan head screw steel black",
  "#10-16 x 3/4\" Phillips Drive Pan", "#10 x 1\" x .190\" 10N100TXPS/A", "Foam padding RF12 - 3/8\" X 72\"",
];

const PART_NOS = [
  "100219-42", "100219-51", "100219-51-01", "100219-51-01RC", "100219-51-02",
  "100219-52", "100219-52-02", "100120-70", "100120-71", "100120-72",
  "100120-73", "100120-74", "100120-75", "100120-75-01", "100150-20",
];

const ITEM_CATS = ["Electronics", "Hardware", "Cabinet", "Parts", "Fasteners", "Foam & Padding"];
const ITEM_TYPES = ["Parts", "Equipment + Capital", "Equipment + Non-Capital", "Miscellaneous"];
const CAT_NAMES = ["Ram Pro Master 2500", "Ram Pro Master 3500", "Ram Pro Master Default", "Ford Transit", "Sprinter Van", "Freightliner M2", "International MV", "Kenworth T680", "Peterbilt 579", "Volvo VNL", "Mack Anthem", "Western Star 4900"];
const CREATORS = ["Ahtisham Ahmad", "Sarah Chen", "Marcus Obi", "Elena Volkov"];
const PARTNER_NAMES = [
  "Toyota International", "Ford Motor Company", "General Motors (GM)", "Tesla, Inc.",
  "Chrysler (Stellantis N.V.)", "Rivian Automotive", "Lucid Motors",
  "Honda Motor Co., Ltd. (USA)", "Nissan North America", "BMW of North America",
  "Toyota China Motors", "Ford Motor Company", "General Motors (GM)", "Tesla, Inc.",
  "Chrysler (Stellantis N.V.)", "Rivian Automotive", "Lucid Motors",
  "Honda Motor Co., Ltd. (USA)", "Nissan North America", "BMW of North America",
];
const PARTNER_TYPE_SETS: string[][] = [
  ["Vendor", "Sub-Contractor", "Customer"], ["Vendor", "Service Provider"],
  ["Vendor", "Seller", "Customer"], ["Vendor", "Sub-Contractor"],
  ["Vendor", "Service Provider"], ["Vendor", "Seller"],
  ["Vendor", "Service Provider"], ["Vendor", "Seller"],
  ["Vendor", "Sub-Contractor"], ["Vendor", "Carrier", "Customer"],
  ["Vendor", "Service Provider"], ["Vendor", "Carrier"],
  ["Vendor", "Seller"], ["Vendor", "Seller", "Customer"],
  ["Vendor", "Sub-Contractor"], ["Vendor", "Seller"],
  ["Vendor", "Service Provider"], ["Vendor", "Seller"],
  ["Vendor", "Sub-Contractor"], ["Vendor", "Carrier", "Customer"],
];

// ──────────────────────────────────────────────
// Seeded RNG + Data generation
// ──────────────────────────────────────────────

function seededRng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

function pickArr<T>(arr: T[], rng: () => number): T { return arr[Math.floor(rng() * arr.length)]; }

function genItems(rng: () => number, count: number): AssociatedItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    partNo: pickArr(PART_NOS, rng),
    description: pickArr(ITEM_DESCS, rng),
    category: pickArr(ITEM_CATS, rng),
    itemType: pickArr(ITEM_TYPES, rng),
    status: rng() > 0.2 ? "Active" as const : "Inactive" as const,
  }));
}

const CAT_DESCRIPTIONS = [
  "Heavy-duty components for commercial fleet vehicles",
  "OEM replacement parts for ambulance platforms",
  "Interior trim and panel assemblies",
  "Exterior body panels and structural components",
  "Electrical harness and wiring assemblies",
  "Brake system components and friction materials",
  "Engine and drivetrain performance parts",
  "Suspension and steering system components",
  "HVAC and climate control modules",
  "Fuel system and emissions components",
  "Transmission and gearbox assemblies",
  "Lighting and visibility components",
];
const CAT_TAG_POOL = ["Electronics", "Engine", "Brake", "Transmission", "Safety", "Performance", "Exhaust", "Wiring", "Sensors", "Controls", "HVAC", "Fuel", "Lighting", "Suspension", "Interior", "Exterior"];
const CAT_STATUSES: ("Active" | "Inactive")[] = ["Active", "Active", "Active", "Active", "Active", "Active", "Active", "Inactive", "Inactive", "Active"];
const CAT_CREATOR_POOL = [
  { initials: "AA", name: "Ahtisham Ahmad", color: "var(--primary)" },
  { initials: "SJ", name: "Sarah Johnson", color: "var(--violet)" },
  { initials: "DK", name: "David Kim", color: "var(--warning)" },
  { initials: "EC", name: "Emily Chen", color: "var(--success)" },
  { initials: "MO", name: "Marcus Obi", color: "var(--destructive)" },
  { initials: "EV", name: "Elena Volkov", color: "#0891B2" },
];
const CAT_LINKED_CODES = ["HXB-M10-40", "BRK-PAD-22", "ENG-VLV-16", "WIR-HAR-08", "SUS-ARM-12", "TRN-GR-05", "FUL-INJ-09", "LGT-LED-14", "HVC-CMP-03", "EXT-PNL-07"];
const CAT_DATES = ["Mar 22, 2026", "Mar 18, 2026", "Mar 15, 2026", "Mar 10, 2026", "Feb 28, 2026", "Feb 22, 2026", "Feb 15, 2026", "Feb 08, 2026", "Jan 30, 2026", "Jan 22, 2026", "Jan 15, 2026", "Jan 08, 2026"];

function genCategories(rng: () => number, count: number): AssociatedCategory[] {
  const actualCount = Math.max(count, 10);
  return Array.from({ length: actualCount }, (_, i) => {
    const tagCount = Math.floor(rng() * 4) + 1;
    const tags: string[] = [];
    for (let t = 0; t < tagCount; t++) tags.push(CAT_TAG_POOL[Math.floor(rng() * CAT_TAG_POOL.length)]);
    const creator = CAT_CREATOR_POOL[i % CAT_CREATOR_POOL.length];
    return {
      id: `cat-${i}`,
      code: `C-${String(1001 + i)}`,
      name: pickArr(CAT_NAMES, rng),
      description: CAT_DESCRIPTIONS[i % CAT_DESCRIPTIONS.length],
      itemType: "Parts",
      status: CAT_STATUSES[i % CAT_STATUSES.length],
      linkedItems: Math.floor(rng() * 40) + 2,
      // Extended fields stored as JSON-safe extras
      _tags: [...new Set(tags)],
      _linkedCode: CAT_LINKED_CODES[i % CAT_LINKED_CODES.length],
      _linkedCount: Math.floor(rng() * 8) + 1,
      _creatorInitials: creator.initials,
      _creatorName: creator.name,
      _creatorColor: creator.color,
      _createdDate: CAT_DATES[i % CAT_DATES.length],
      _isMe: i === 0,
    } as AssociatedCategory & Record<string, unknown>;
  });
}

function genPartners(rng: () => number, count: number): AssociatedPartner[] {
  return Array.from({ length: count }, (_, i) => {
    const name = PARTNER_NAMES[i % PARTNER_NAMES.length];
    const types = PARTNER_TYPE_SETS[i % PARTNER_TYPE_SETS.length];
    const extraTypes = Math.floor(rng() * 3);
    return {
      id: `partner-${i}`,
      name,
      avatar: name.charAt(0),
      types: types.slice(0, Math.min(types.length, 2 + (rng() > 0.5 ? 1 : 0))),
      itemCount: pickArr(PART_NOS, rng),
      additionalItems: `+${Math.floor(rng() * 50 + 2)} more`,
      status: rng() > 0.15 ? "Active" as const : "Inactive" as const,
    };
  });
}

// ── Hardcoded diverse pricing rules covering every combination ──
// Each rule: preset/custom × discount/premium × single/multi-tier × value/volume
// All data is realistic and accurate with proper tier structures

interface HardcodedRuleDef {
  id: string;
  name: string;
  category: "discount" | "premium";
  basis: "value" | "volume";
  tierType: "single" | "multiple";
  description: string;
  aboutText: string;
  isPreset: boolean;
  status: "Active" | "Inactive";
  scope: "vendor" | "customer" | "both";
  validFrom: string;
  validTo: string;
  hasDateLimit: boolean;
  durationDays: number;
  createdBy: string;
  createdDate: string;
  tiers: TierData[];
  itemCount: number;
  categoryCount: number;
  partnerCount: number;
}

const HARDCODED_RULES: HardcodedRuleDef[] = [
  // ───── PRESET DISCOUNT RULES ─────
  {
    id: "hc-preset-disc-val-single",
    name: "Standard Discount – Value (Single-Tier)",
    category: "discount", basis: "value", tierType: "single",
    description: "10% off on orders over $1,000",
    aboutText: "The Standard Discount – Value (Single-Tier) pricing rule is a straightforward model where a fixed percentage discount is applied once the total purchase value exceeds a defined threshold. Commonly used for repeat customers.",
    isPreset: true, status: "Active", scope: "vendor",
    validFrom: "1 Jan 2025", validTo: "30 Jun 2025", hasDateLimit: true, durationDays: 180,
    createdBy: "Ahtisham Ahmad", createdDate: "15 Jan 2025",
    tiers: [{ minQty: "$1,000", maxQty: "$25,000", discount: "10%" }],
    itemCount: 12, categoryCount: 12, partnerCount: 8,
  },
  {
    id: "hc-preset-disc-vol-single",
    name: "Standard Discount – Volume (Single-Tier)",
    category: "discount", basis: "volume", tierType: "single",
    description: "10% off on orders of 100+ units",
    aboutText: "A volume-based single-tier discount that applies a fixed percentage when the order quantity meets or exceeds a set threshold. Ideal for bulk purchasing agreements.",
    isPreset: true, status: "Active", scope: "both",
    validFrom: "15 Feb 2025", validTo: "15 Aug 2025", hasDateLimit: true, durationDays: 180,
    createdBy: "Sarah Chen", createdDate: "10 Feb 2025",
    tiers: [{ minQty: "100 EA", maxQty: "500 EA", discount: "10%" }],
    itemCount: 8, categoryCount: 10, partnerCount: 5,
  },
  {
    id: "hc-preset-disc-val-multi",
    name: "Tiered Discount – Value (Multi-Tier)",
    category: "discount", basis: "value", tierType: "multiple",
    description: "10% off at each tier from $1K to $25K",
    aboutText: "A multi-tier value-based discount model where different discount percentages are applied at various purchase value thresholds. Encourages larger order values with increasing savings.",
    isPreset: true, status: "Active", scope: "vendor",
    validFrom: "1 Mar 2025", validTo: "31 Dec 2025", hasDateLimit: true, durationDays: 305,
    createdBy: "Marcus Obi", createdDate: "28 Feb 2025",
    tiers: [
      { minQty: "$1,000", maxQty: "$4,999", discount: "10%" },
      { minQty: "$5,000", maxQty: "$9,999", discount: "10%", isFixRate: false },
      { minQty: "$10,000", maxQty: "$24,999", discount: "10%" },
      { minQty: "$25,000", maxQty: "$50,000", discount: "10%" },
    ],
    itemCount: 15, categoryCount: 14, partnerCount: 12,
  },
  {
    id: "hc-preset-disc-vol-multi",
    name: "Tiered Discount – Volume (Multi-Tier)",
    category: "discount", basis: "volume", tierType: "multiple",
    description: "10% off at each tier from 100 to 1,000 units",
    aboutText: "A multi-tier volume-based discount model offering increasing discounts at higher quantity breakpoints. Perfect for incentivizing large batch orders.",
    isPreset: true, status: "Active", scope: "vendor",
    validFrom: "10 Jan 2025", validTo: "10 Jul 2025", hasDateLimit: true, durationDays: 180,
    createdBy: "Elena Volkov", createdDate: "5 Jan 2025",
    tiers: [
      { minQty: "100 EA", maxQty: "499 EA", discount: "10%" },
      { minQty: "500 EA", maxQty: "999 EA", discount: "10%" },
      { minQty: "1,000 EA", maxQty: "2,500 EA", discount: "10%" },
    ],
    itemCount: 10, categoryCount: 11, partnerCount: 7,
  },

  // ───── PRESET PREMIUM RULES ─────
  {
    id: "hc-preset-prem-val-single",
    name: "Standard Premium – Value (Single-Tier)",
    category: "premium", basis: "value", tierType: "single",
    description: "10% surcharge on orders over $1,000",
    aboutText: "A value-based premium surcharge applied to exclusive product lines and VIP offerings. Automate pricing increases to enhance exclusivity and maximize profitability.",
    isPreset: true, status: "Active", scope: "customer",
    validFrom: "1 Apr 2025", validTo: "30 Sep 2025", hasDateLimit: true, durationDays: 182,
    createdBy: "Sarah Chen", createdDate: "25 Mar 2025",
    tiers: [{ minQty: "$1,000", maxQty: "$25,000", discount: "10%" }],
    itemCount: 6, categoryCount: 10, partnerCount: 4,
  },
  {
    id: "hc-preset-prem-vol-single",
    name: "Standard Premium – Volume (Single-Tier)",
    category: "premium", basis: "volume", tierType: "single",
    description: "10% markup for orders of 100+ units",
    aboutText: "A volume-based premium surcharge applied to small-to-medium order quantities. Ensures profitability on orders that don't qualify for bulk pricing.",
    isPreset: true, status: "Inactive", scope: "both",
    validFrom: "20 Mar 2025", validTo: "20 Sep 2025", hasDateLimit: true, durationDays: 184,
    createdBy: "Marcus Obi", createdDate: "15 Mar 2025",
    tiers: [{ minQty: "100 EA", maxQty: "500 EA", discount: "10%" }],
    itemCount: 5, categoryCount: 10, partnerCount: 3,
  },
  {
    id: "hc-preset-prem-val-multi",
    name: "Tiered Premium – Value (Multi-Tier)",
    category: "premium", basis: "value", tierType: "multiple",
    description: "10% surcharge at each tier from $1K to $10K",
    aboutText: "A multi-tier value-based premium model where different surcharges are applied at decreasing purchase value thresholds. Protects margins on smaller deals.",
    isPreset: true, status: "Active", scope: "vendor",
    validFrom: "5 Feb 2025", validTo: "5 Nov 2025", hasDateLimit: true, durationDays: 273,
    createdBy: "Ahtisham Ahmad", createdDate: "1 Feb 2025",
    tiers: [
      { minQty: "$1,000", maxQty: "$4,999", discount: "10%" },
      { minQty: "$5,000", maxQty: "$9,999", discount: "10%" },
      { minQty: "$10,000", maxQty: "$25,000", discount: "10%" },
    ],
    itemCount: 9, categoryCount: 10, partnerCount: 6,
  },
  {
    id: "hc-preset-prem-vol-multi",
    name: "Tiered Premium – Volume (Multi-Tier)",
    category: "premium", basis: "volume", tierType: "multiple",
    description: "10% markup at each tier from 100 to 2,500 units",
    aboutText: "A multi-tier volume-based premium model where surcharges are applied at lower order quantity brackets. Encourages customers to order in larger quantities.",
    isPreset: true, status: "Active", scope: "customer",
    validFrom: "1 Jan 2025", validTo: "31 Dec 2025", hasDateLimit: false, durationDays: 365,
    createdBy: "Elena Volkov", createdDate: "28 Dec 2024",
    tiers: [
      { minQty: "100 EA", maxQty: "499 EA", discount: "10%" },
      { minQty: "500 EA", maxQty: "999 EA", discount: "10%" },
      { minQty: "1,000 EA", maxQty: "2,499 EA", discount: "10%" },
      { minQty: "2,500 EA", maxQty: "5,000 EA", discount: "10%" },
    ],
    itemCount: 14, categoryCount: 15, partnerCount: 10,
  },

  // ───── CUSTOM DISCOUNT RULES ─────
  {
    id: "hc-custom-disc-val-single",
    name: "Q2 Loyalty Value Discount",
    category: "discount", basis: "value", tierType: "single",
    description: "12% off on orders over $2,500 for loyal partners",
    aboutText: "A custom single-tier value-based discount created specifically for Q2 2025 to reward long-standing partners who consistently place high-value orders. Fully configurable tiers and settings.",
    isPreset: false, status: "Active", scope: "vendor",
    validFrom: "1 Apr 2025", validTo: "30 Jun 2025", hasDateLimit: true, durationDays: 90,
    createdBy: "Ahtisham Ahmad", createdDate: "20 Mar 2025",
    tiers: [{ minQty: "$2,500", maxQty: "$45,000", discount: "12%" }],
    itemCount: 7, categoryCount: 10, partnerCount: 6,
  },
  {
    id: "hc-custom-disc-vol-single",
    name: "Bulk Fastener Discount",
    category: "discount", basis: "volume", tierType: "single",
    description: "20% off on fastener orders of 250+ units",
    aboutText: "Custom volume discount targeting fastener and hardware categories. Applied automatically when order quantity exceeds the minimum threshold for eligible SKUs.",
    isPreset: false, status: "Active", scope: "both",
    validFrom: "15 Jan 2025", validTo: "15 Jul 2025", hasDateLimit: true, durationDays: 181,
    createdBy: "Sarah Chen", createdDate: "10 Jan 2025",
    tiers: [{ minQty: "250 EA", maxQty: "2,000 EA", discount: "20%" }],
    itemCount: 18, categoryCount: 10, partnerCount: 9,
  },
  {
    id: "hc-custom-disc-val-multi",
    name: "Annual Value-Based Savings Plan",
    category: "discount", basis: "value", tierType: "multiple",
    description: "Progressive savings: 3% at $750, 8% at $3K, 14% at $10K",
    aboutText: "A comprehensive multi-tier value-based savings program designed for annual contracts. Each tier offers increasing discounts to incentivize higher purchase commitments throughout the year.",
    isPreset: false, status: "Active", scope: "vendor",
    validFrom: "1 Jan 2025", validTo: "31 Dec 2025", hasDateLimit: true, durationDays: 365,
    createdBy: "Marcus Obi", createdDate: "28 Dec 2024",
    tiers: [
      { minQty: "$750", maxQty: "$2,999", discount: "3%" },
      { minQty: "$3,000", maxQty: "$9,999", discount: "8%" },
      { minQty: "$10,000", maxQty: "$24,999", discount: "14%" },
      { minQty: "$25,000", maxQty: "$100,000", discount: "19%", isFixRate: true },
    ],
    itemCount: 22, categoryCount: 13, partnerCount: 15,
  },
  {
    id: "hc-custom-disc-vol-multi",
    name: "Seasonal Volume Clearance",
    category: "discount", basis: "volume", tierType: "multiple",
    description: "7% off 75+ units, 12% over 300, 22% over 750",
    aboutText: "Custom seasonal clearance discount with three volume tiers designed to move excess inventory. Configured with aggressive discounts at higher quantities to accelerate stock turnover.",
    isPreset: false, status: "Active", scope: "customer",
    validFrom: "1 May 2025", validTo: "31 Aug 2025", hasDateLimit: true, durationDays: 122,
    createdBy: "Elena Volkov", createdDate: "20 Apr 2025",
    tiers: [
      { minQty: "75 EA", maxQty: "299 EA", discount: "7%" },
      { minQty: "300 EA", maxQty: "749 EA", discount: "12%" },
      { minQty: "750 EA", maxQty: "3,000 EA", discount: "22%" },
    ],
    itemCount: 11, categoryCount: 12, partnerCount: 8,
  },

  // ───── CUSTOM PREMIUM RULES ─────
  {
    id: "hc-custom-prem-val-single",
    name: "Expedited Processing Fee",
    category: "premium", basis: "value", tierType: "single",
    description: "18% surcharge for rush orders under $5,000",
    aboutText: "Custom premium rule applying an expedited processing surcharge on orders requiring priority handling. Covers additional logistics and labor costs for rush fulfillment.",
    isPreset: false, status: "Active", scope: "vendor",
    validFrom: "1 Mar 2025", validTo: "28 Feb 2026", hasDateLimit: false, durationDays: 365,
    createdBy: "Ahtisham Ahmad", createdDate: "25 Feb 2025",
    tiers: [{ minQty: "$50", maxQty: "$5,000", discount: "18%" }],
    itemCount: 4, categoryCount: 10, partnerCount: 11,
  },
  {
    id: "hc-custom-prem-vol-single",
    name: "Small Order Handling Fee",
    category: "premium", basis: "volume", tierType: "single",
    description: "12% markup on orders under 30 units",
    aboutText: "A custom volume-based premium applied to small quantity orders. Offsets the per-unit overhead costs of handling, packaging, and shipping small batches.",
    isPreset: false, status: "Inactive", scope: "both",
    validFrom: "10 Feb 2025", validTo: "10 Aug 2025", hasDateLimit: true, durationDays: 181,
    createdBy: "Sarah Chen", createdDate: "5 Feb 2025",
    tiers: [{ minQty: "1 EA", maxQty: "29 EA", discount: "12%" }],
    itemCount: 0, categoryCount: 10, partnerCount: 5,
  },
  {
    id: "hc-custom-prem-val-multi",
    name: "VIP Exclusive Tiered Markup",
    category: "premium", basis: "value", tierType: "multiple",
    description: "5% on $1K+, 10% on $5K+, 18% on $20K+ exclusives",
    aboutText: "A multi-tier value-based premium for exclusive product lines available only through VIP channels. Higher-value orders carry progressively higher premiums reflecting product exclusivity.",
    isPreset: false, status: "Active", scope: "customer",
    validFrom: "15 Jan 2025", validTo: "15 Jan 2026", hasDateLimit: false, durationDays: 365,
    createdBy: "Marcus Obi", createdDate: "10 Jan 2025",
    tiers: [
      { minQty: "$1,000", maxQty: "$4,999", discount: "5%" },
      { minQty: "$5,000", maxQty: "$19,999", discount: "10%" },
      { minQty: "$20,000", maxQty: "$75,000", discount: "18%", isFixRate: true },
    ],
    itemCount: 3, categoryCount: 10, partnerCount: 4,
  },
  {
    id: "hc-custom-prem-vol-multi",
    name: "Micro-Batch Premium Tiers",
    category: "premium", basis: "volume", tierType: "multiple",
    description: "30% for 1–5 units, 20% for 6–15, 10% for 16–40",
    aboutText: "Custom multi-tier volume premium for micro-batch and sample orders. Highest surcharge on the smallest quantities, tapering off as order size increases toward standard thresholds.",
    isPreset: false, status: "Active", scope: "vendor",
    validFrom: "1 Feb 2025", validTo: "31 Jul 2025", hasDateLimit: true, durationDays: 180,
    createdBy: "Elena Volkov", createdDate: "25 Jan 2025",
    tiers: [
      { minQty: "1 EA", maxQty: "5 EA", discount: "30%" },
      { minQty: "6 EA", maxQty: "15 EA", discount: "20%", isFixRate: true },
      { minQty: "16 EA", maxQty: "40 EA", discount: "10%" },
    ],
    itemCount: 8, categoryCount: 10, partnerCount: 7,
  },
];

function generatePricingRules(vendor: Vendor, cfg?: VendorConfigData): PricingRule[] {
  const rng = seededRng(vendor.companyName.length * 17 + 3);
  const rules: PricingRule[] = [];

  // First, add cfg-based rules (these come from tenant config, always preset)
  const cfgRules = ((cfg?.pricingRules as Array<{ id: string; name?: string; type?: string; basis?: string; description?: string }> | undefined) || []);
  cfgRules.forEach((cr) => {
    const p = PRICING_RULE_PRESETS.find((x) => x.id === cr.id);
    const itemCount = Math.floor(rng() * 14) + 3;
    const catCount = Math.floor(rng() * 6) + 10;
    const partnerCount = Math.floor(rng() * 10) + 3;
    const durDays = [60, 90, 180, 365][Math.floor(rng() * 4)];
    const start = new Date(2025, Math.floor(rng() * 4), Math.floor(rng() * 25) + 1);
    const end = new Date(start.getTime() + durDays * 86400000);
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

    const srcTiers = p?.tiers.map((t) => ({ minValue: t.minValue, maxValue: t.maxValue, discount: t.discount }))
      || [{ minValue: cr.basis === "volume" ? "35 EA" : "$1,000", maxValue: cr.basis === "volume" ? "500 EA" : "$32,000", discount: "13%" }];
    const tiers: TierData[] = srcTiers.map((t) => ({ minQty: t.minValue, maxQty: t.maxValue, discount: t.discount }));
    if ((p?.tierType === "multiple") && (p?.totalTiers || 1) > 1) {
      for (let ti = 1; ti < Math.min(p.totalTiers, 4); ti++) {
        const base = parseInt(srcTiers[0]?.maxValue.replace(/[^0-9]/g, "") || "100") * (ti + 1);
        tiers.push({
          minQty: p.basis === "volume" ? `${base} EA` : `$${base.toLocaleString()}`,
          maxQty: p.basis === "volume" ? `${base * 2} EA` : `$${(base * 2).toLocaleString()}`,
          discount: `${parseInt(srcTiers[0]?.discount || "5") + ti * 3}%`,
          isFixRate: ti === 1 && rng() > 0.7,
        });
      }
    }

    rules.push({
      id: cr.id,
      ruleNo: `VPR# ${23400 + rules.length + Math.floor(rng() * 200)}`,
      name: cr.name,
      category: (cr.type === "premium" ? "premium" : "discount") as "discount" | "premium",
      basis: (cr.basis === "volume" ? "volume" : "value") as "value" | "volume",
      tierType: (p?.tierType || "single") as "single" | "multiple",
      totalTiers: p?.totalTiers || 1,
      description: cr.description,
      aboutText: p?.aboutText || cr.description,
      status: rng() > 0.2 ? "Active" : "Inactive",
      scope: (["vendor", "customer", "both"] as const)[Math.floor(rng() * 3)],
      validFrom: fmt(start), validTo: fmt(end),
      hasDateLimit: rng() > 0.3, durationDays: durDays,
      itemCount, categoryCount: catCount, partnerCount, tiers,
      createdBy: pickArr(CREATORS, rng),
      createdDate: new Date(2025, Math.floor(rng() * 3), Math.floor(rng() * 28) + 1).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }),
      warningText: undefined,
      isPreset: true,
      items: genItems(rng, itemCount),
      categories: genCategories(rng, catCount),
      partners: genPartners(rng, partnerCount),
    });
  });

  // Now add ALL hardcoded rules (diverse mix of preset/custom × discount/premium × single/multi × value/volume)
  const usedIds = new Set(rules.map((r) => r.id));
  HARDCODED_RULES.forEach((hr) => {
    if (usedIds.has(hr.id)) return;
    rules.push({
      id: hr.id,
      ruleNo: `VPR# ${23400 + rules.length + Math.floor(rng() * 300)}`,
      name: hr.name,
      category: hr.category,
      basis: hr.basis,
      tierType: hr.tierType,
      totalTiers: hr.tiers.length,
      description: hr.description,
      aboutText: hr.aboutText,
      status: hr.status,
      scope: hr.scope,
      validFrom: hr.validFrom,
      validTo: hr.validTo,
      hasDateLimit: hr.hasDateLimit,
      durationDays: hr.durationDays,
      itemCount: hr.itemCount,
      categoryCount: hr.categoryCount,
      partnerCount: hr.partnerCount,
      tiers: hr.tiers,
      createdBy: hr.createdBy,
      createdDate: hr.createdDate,
      warningText: hr.itemCount === 0 && hr.categoryCount === 0 ? "No items or categories assigned. Add them to activate." : undefined,
      isPreset: hr.isPreset,
      items: genItems(rng, hr.itemCount),
      categories: genCategories(rng, hr.categoryCount),
      partners: genPartners(rng, hr.partnerCount),
    });
  });

  return rules;
}

// ──────────────────────────────────────────────
// Compact Pricing Rule Card (v1-style reimagined)
// ──────────────────────────────────────────────

function PricingRuleCard({
  rule,
  onClick,
  subTab,
  partnerName,
  variant = "applied",
  onApply,
  onDuplicate,
  onDeactivate,
  onActivate,
  onRemove,
  onEditRule,
  readOnly = false,
}: {
  rule: PricingRule;
  onClick: () => void;
  subTab?: "vendor" | "customer";
  partnerName?: string;
  readOnly?: boolean;
  /** "applied" — card on the partner-detail tab / creation form
   *  applied list. Shows the Active/Inactive pill + the count
   *  strip footer with three-dot menu (View Details, Edit,
   *  Duplicate, Deactivate, Remove).
   *  "browse" — Browse Templates view. Hides the status pill
   *  (templates aren't yet applied), replaces the count-strip
   *  footer with Apply + Duplicate buttons, no three-dot menu. */
  variant?: "applied" | "browse";
  onApply?: () => void;
  onDuplicate?: () => void;
  /** Optional host callbacks — invoked AFTER the local confirmation
   *  modals close. The library updates its own internal state for
   *  the card chrome (Active/Inactive pill) and forwards the rule
   *  id to these callbacks so the host (line item configurator,
   *  pricing rules summary modal) can reconcile its own state — e.g.
   *  flipping isApplied on the matching entry in formData.appliedRules
   *  so the change propagates to the summary carousel + totals. */
  /** Host callbacks receive the FULL rule because the library's seeded
   *  rule ids don't match the host's appliedRules ids — the host matches
   *  the rule by name (case-insensitive) to find the right entry. */
  onDeactivate?: (rule: PricingRule) => void;
  onActivate?: (rule: PricingRule) => void;
  onRemove?: (rule: PricingRule) => void;
  onEditRule?: (rule: PricingRule) => void;
}) {
  const isBrowse = variant === "browse";
  /* Plays a brief fade-out + shrink before the card unmounts so the
     removal reads as a deliberate action rather than a flash. */
  const [isRemoving, setIsRemoving] = useState(false);
  const [activeTier, setActiveTier] = useState(0);
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const isDis = rule.category === "discount";
  const isMulti = rule.tierType === "multiple" && rule.tiers.length > 1;
  const t0 = rule.tiers[0];
  const shownTier = rule.tiers[isMulti ? activeTier : 0];
  const isPreset = rule.isPreset;

  // Color ONLY for the type pill — card body stays neutral
  const pill = isDis
    ? { text: "#047857", bg: "#ECFDF5", border: "#D1FAE5" }
    : { text: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE" };

  // Status pill — moved out of the footer up to the top-right per
  // stakeholder review (sits alongside TEMPLATE/CUSTOM, anchored
  // next to the Discount/Premium pill on the row 1 strip).
  const statusPill = {
    color: rule.status === "Active" ? "#065F46" : "#92400E",
    bg: rule.status === "Active" ? "#ECFDF5" : "#FFFBEB",
    border: rule.status === "Active" ? "#A7F3D0" : "#FDE68A",
  };

  // Remove-from-this-side label — depends on whether we're on the
  // vendor or customer pricing rules tab. Falls back to a generic
  // partner phrasing when the prop isn't supplied.
  const removeLabel = subTab === "vendor"
    ? "Remove from Vendor Pricing"
    : subTab === "customer"
      ? "Remove from Customer Pricing"
      : "Remove from this partner";

  return (
    <div
      onClick={onClick}
      /* Card chrome stays static across hover/click — the blue ring +
         box-shadow halo from the original Partner card was visually
         intrusive when several cards were tiled side by side, so the
         hover styling has been removed per product feedback. The card
         keeps its border-border edge, cursor-pointer, and group hover
         (used by the kebab fade-in). */
      className="bg-white border border-border rounded-xl cursor-pointer group flex flex-col relative h-[260px] outline-none focus:outline-none focus-visible:outline-none"
      style={{
        transition: "opacity 250ms ease, transform 250ms ease",
        opacity: isRemoving ? 0 : 1,
        transform: isRemoving ? "scale(0.96)" : "scale(1)",
        pointerEvents: isRemoving ? "none" : undefined,
      }}
    >
      <div className="p-3.5 flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Row 1: Type pill left · Preset lock / Custom badge right */}
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
            {/* Status pill — only in "applied" variant. Browse
                Templates cards aren't yet attached to anything, so
                Active/Inactive doesn't apply there. */}
            {!isBrowse && (
              <span
                className="inline-flex items-center px-2 py-[3px] rounded-full text-[10px] border whitespace-nowrap"
                style={{ fontWeight: 600, color: statusPill.color, backgroundColor: statusPill.bg, borderColor: statusPill.border }}
              >
                {/* "Deactivated" reads more clearly than the seeded
                    "Inactive" label and matches the configurator's
                    Deactivate verb. Both flow from the same state. */}
                {rule.status === "Active" ? "Active" : "Deactivated"}
              </span>
            )}
            {isPreset ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md bg-muted border border-slate-300 text-[9px] text-slate-500" style={{ fontWeight: 600 }}>
                    <Lock className="w-2.5 h-2.5" /> TEMPLATE
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6} className="z-[12300] !bg-white !text-slate-700 !border !border-border !shadow-sm rounded-lg text-[11px] px-2.5 py-1.5 max-w-[220px]" style={{ fontWeight: 500 }}>
                  System preset — tiers & config are locked. You can assign items, categories, and partners.
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="inline-flex items-center px-1.5 py-[3px] rounded-md border border-slate-300 bg-white text-[9px] text-muted-foreground" style={{ fontWeight: 600 }}>CUSTOM</span>
            )}
          </div>
        </div>

        {/* Row 2: Name */}
        <div className="shrink-0 mb-1">
          <p className="text-[13px] text-slate-700 truncate" style={{ fontWeight: 600 }}>{rule.name}</p>
        </div>

        {/* Row 3: Description — fixed 2-line height */}
        <div className="h-[32px] shrink-0 mb-2">
          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed" style={{ fontWeight: 400 }}>{rule.description}</p>
        </div>

        {/* Row 4: Hero value left · Valid From / Valid To right.
            Validity dates anchor on the right edge of the row,
            parallel to the discount percentage, so the user can
            scan the rule's lifespan without opening the detail
            modal. Falls back to "Always active" when the rule has
            no date limit. */}
        <div className="flex items-baseline justify-between gap-2 shrink-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[22px] text-slate-700 tabular-nums leading-none tracking-tight" style={{ fontWeight: 600 }}>
              {t0?.discount ?? "—"}
            </span>
            <span className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>
              {isDis ? "off" : "markup"}
            </span>
            {rule.warningText && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span><AlertTriangle className="w-3.5 h-3.5 text-warning" /></span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6} className="z-[12300] !bg-white !text-amber-800 !border !border-amber-200 !shadow-sm rounded-lg text-[11px] px-2.5 py-1.5 max-w-[220px]" style={{ fontWeight: 500 }}>
                  {rule.warningText}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {rule.hasDateLimit ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-end shrink-0 leading-tight cursor-default">
                  <span className="text-[9px] uppercase tracking-wide text-slate-400" style={{ fontWeight: 600 }}>Valid</span>
                  <span className="text-[11px] text-slate-700 tabular-nums" style={{ fontWeight: 500 }}>
                    {rule.validFrom} – {rule.validTo}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6} className="z-[12300] !bg-white !text-slate-700 !border !border-border !shadow-sm rounded-lg text-[11px] px-2.5 py-1.5" style={{ fontWeight: 500 }}>
                Valid {rule.validFrom} → {rule.validTo}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex flex-col items-end shrink-0 leading-tight">
              <span className="text-[9px] uppercase tracking-wide text-slate-400" style={{ fontWeight: 600 }}>Valid</span>
              <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Always active</span>
            </div>
          )}
        </div>

        {/* Row 5: Tier display — fixed height region, pushed to bottom */}
        <div className="mt-auto pt-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Tier selector strip for multi-tier */}
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
                      {shownTier.discount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Tier detail row */}
          <div className="flex items-center justify-between px-3 py-[6px] rounded-lg border border-[#E8ECF1] bg-[#FAFBFC] text-[11px] tabular-nums min-w-0">
            <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
              <span style={{ fontWeight: 400 }}>{shownTier?.minQty}</span>
              <span className="text-slate-300">–</span>
              <span style={{ fontWeight: 400 }}>{shownTier?.maxQty}</span>
            </div>
            <span className="shrink-0 ml-2 text-slate-700" style={{ fontWeight: 600 }}>{shownTier?.discount}</span>
          </div>
        </div>
      </div>

      {/* Footer — variant-aware. "browse" gets a clean two-button
          Apply + Duplicate split that matches the creation form's
          PrTemplateCardInner footer; "applied" gets the count
          strip + three-dot menu (lifecycle actions). */}
      {isBrowse ? (
        readOnly ? (
          <div className="border-t border-muted shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onClick(); }}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 text-[11.5px] text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              <Eye className="w-3.5 h-3.5" /> View Details
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-2 border-t border-muted shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onApply?.(); }}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 text-[11.5px] text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors border-r border-muted cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <Check className="w-3.5 h-3.5" /> Apply
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 text-[11.5px] text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>
        </div>
        )
      ) : (
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-muted shrink-0">
        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
          <Package className="w-3 h-3" /> {rule.itemCount}
        </span>
        <span className="w-px h-3 bg-[#E8ECF1]" />
        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
          <Layers className="w-3 h-3" /> {rule.categoryCount}
        </span>
        <span className="w-px h-3 bg-[#E8ECF1]" />
        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
          <Users className="w-3 h-3" /> {rule.partnerCount}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="ml-auto w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-muted transition-all cursor-pointer"
              title="Rule actions"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[220px] p-1 z-[12200]" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem className="gap-2 py-1.5 cursor-pointer text-[13px]" onSelect={onClick}>
              <Eye className="w-3.5 h-3.5 text-slate-500" /> View Details
            </DropdownMenuItem>
            {!readOnly && !isPreset && (
              <DropdownMenuItem
                className="gap-2 py-1.5 cursor-pointer text-[13px]"
                onSelect={() => {
                  if (onEditRule) onEditRule(rule);
                  else toast.info("Edit coming soon");
                }}
              >
                <Pencil className="w-3.5 h-3.5 text-slate-500" /> Edit Rule
              </DropdownMenuItem>
            )}
            {!readOnly && (
              <DropdownMenuItem
                className="gap-2 py-1.5 cursor-pointer text-[13px]"
                onSelect={() => {
                  if (onDuplicate) onDuplicate();
                  else toast.info("Duplicate coming soon");
                }}
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" /> Duplicate as Custom
              </DropdownMenuItem>
            )}
            {/* Deactivate / Activate — yellow when active (about to
                turn off), neutral when re-activating. Routed through
                the AlertDialog below for confirmation. Hidden in
                readOnly mode so final-stage SOs can't mutate. */}
            {!readOnly && (rule.status === "Active" ? (
              <DropdownMenuItem
                className="gap-2 py-1.5 cursor-pointer text-[13px] text-amber-700 focus:text-amber-700 focus:bg-amber-50"
                /* No preventDefault — let Radix close the dropdown
                   naturally, then the confirmation opens on top. */
                onSelect={() => setDeactivateConfirmOpen(true)}
              >
                <CircleSlash className="w-3.5 h-3.5 text-amber-600" /> Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="gap-2 py-1.5 cursor-pointer text-[13px]"
                onSelect={() => { onActivate?.(rule); toast.success(`${rule.name} reactivated`); }}
              >
                <CirclePlus className="w-3.5 h-3.5 text-primary" /> Reactivate
              </DropdownMenuItem>
            ))}
            {!readOnly && <DropdownMenuSeparator />}
            {/* Remove from this vendor / customer side — destructive */}
            {!readOnly && (
              <DropdownMenuItem
                className="gap-2 py-1.5 cursor-pointer text-[13px] text-destructive focus:text-destructive focus:bg-red-50"
                onSelect={() => setRemoveConfirmOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" /> {removeLabel}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      )}

      {/* Deactivate + Remove confirmations — use the canonical
          ConfirmationModal so the chrome (size, gradient header, glow,
          icon, pill, button stack) matches every other confirm in the
          SO/Quote/Partner modules. Only the body copy differs. */}
      <ConfirmationModal
        isOpen={deactivateConfirmOpen}
        title={`Deactivate "${rule.name}"?`}
        message={
          `The rule will stop applying to ${partnerName || "this customer"}'s orders. Existing line-item assignments stay in place, just greyed out — you can reactivate any time from the same menu.`
        }
        confirmText="Deactivate rule"
        cancelText="Keep active"
        variant="yellow"
        icon={<CircleSlash />}
        // 12300 = above the library (12100) but below the Detail modal
        // (12231) — these card-level confirms open from the library grid,
        // not from inside the Detail modal.
        zIndex={12300}
        onConfirm={() => {
          setDeactivateConfirmOpen(false);
          onDeactivate?.(rule);
          toast.success(`${rule.name} deactivated.`);
        }}
        onCancel={() => setDeactivateConfirmOpen(false)}
      />
      <ConfirmationModal
        isOpen={removeConfirmOpen}
        title={`${removeLabel}?`}
        message={
          `${rule.name} will be removed from ${partnerName || "this customer"}'s pricing rules. Existing line-item assignments are dropped and totals are recalculated. The rule itself isn't deleted — re-attach it any time from Browse Templates.`
        }
        confirmText="Remove rule"
        cancelText="Keep on this customer"
        variant="red"
        icon={<Trash2 />}
        zIndex={12300}
        /* Play the fade-out animation first (250ms), then fire onRemove
           so the parent's filter drops the card after it's already faded. */
        onConfirm={() => {
          setRemoveConfirmOpen(false);
          setIsRemoving(true);
          window.setTimeout(() => {
            onRemove?.(rule);
            toast.success(`${rule.name} removed.`);
          }, 250);
        }}
        onCancel={() => setRemoveConfirmOpen(false)}
      />
    </div>
  );
}

// ─────────────────────────────────���────────────
// Detail Modal — Clean modern split panel
// ──────────────────────────────────────────────

const DETAIL_TABS_VISIBLE = [
  { id: "items", label: "Items", icon: Package },
  { id: "categories", label: "Categories", icon: Layers },
  { id: "partner", label: "Partners", icon: Users },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "attachments", label: "Attachments", icon: Paperclip },
  { id: "activity", label: "Recent Activity", icon: Clock },
] as const;

const DETAIL_TABS_OVERFLOW = [] as const;

const PR_DUMMY_ITEMS = [
  { id: "i1", code: "FAST-HEX-001", name: "Zinc-Plated Steel Hex Head Screw", vendor: "BoltMaster Inc.", status: "Active", img: "🔩" },
  { id: "i2", code: "FAST-NUT-004", name: "Stainless Steel Hex Nut M10", vendor: "MetalWorks Ltd.", status: "Active", img: "🔧" },
  { id: "i3", code: "BRK-PAD-012", name: "Ceramic Brake Pad Set — Front", vendor: "AutoParts Co.", status: "Active", img: "🛞" },
  { id: "i4", code: "ENG-FLT-007", name: "Oil Filter — Premium Grade", vendor: "FilterPro Inc.", status: "Inactive", img: "⚙️" },
];

const PR_DUMMY_CATEGORIES = [
  { id: "c1", name: "Fasteners", count: 245, color: "var(--primary)" },
  { id: "c2", name: "Brake Components", count: 89, color: "var(--violet)" },
  { id: "c3", name: "Engine Parts", count: 167, color: "var(--success)" },
  { id: "c4", name: "Electrical", count: 112, color: "var(--warning)" },
];

const PR_DUMMY_NOTES = [
  { id: "n1", author: "Sarah Johnson", initials: "SJ", color: "var(--primary)", date: "Mar 28, 2026", text: "Pricing rule approved for Q2. Applies to all fastener categories." },
  { id: "n2", author: "David Kim", initials: "DK", color: "var(--warning)", date: "Mar 22, 2026", text: "Increased discount from 10% to 15% for orders over 500 units per vendor request." },
  { id: "n3", author: "Emily Chen", initials: "EC", color: "var(--success)", date: "Mar 18, 2026", text: "Added quantity limit tiers based on supplier feedback." },
];

const PR_DUMMY_ATTACHMENTS: AttachmentFile[] = [
  { id: "a1", name: "Pricing_Agreement_Q2_2026.pdf", size: "312 KB", type: "pdf", date: "2026-03-28T15:15:00Z", uploadedBy: "Sarah Johnson" },
  { id: "a2", name: "Volume_Discount_Schedule.xlsx", size: "156 KB", type: "xlsx", date: "2026-03-20T10:45:00Z", uploadedBy: "David Kim" },
  { id: "a3", name: "Supplier_Rate_Card.pdf", size: "98 KB", type: "pdf", date: "2026-03-12T11:00:00Z", uploadedBy: "Emily Chen" },
];

const PR_DUMMY_ACTIVITY = [
  { id: "act1", action: "Pricing rule applied", target: "BoltMaster Inc.", user: "Sarah Johnson", date: "Mar 28, 2026 · 3:15 PM", type: "apply" },
  { id: "act2", action: "Discount tier updated", target: "Tier 2: 10% → 15%", user: "David Kim", date: "Mar 22, 2026 · 10:45 AM", type: "edit" },
  { id: "act3", action: "Item added", target: "FAST-NUT-004 — Hex Nut M10", user: "Emily Chen", date: "Mar 18, 2026 · 2:30 PM", type: "create" },
  { id: "act4", action: "Pricing rule created", target: "", user: "Sarah Johnson", date: "Mar 15, 2026 · 9:00 AM", type: "create" },
  { id: "act5", action: "Category added", target: "Brake Components", user: "David Kim", date: "Mar 14, 2026 · 4:20 PM", type: "create" },
];

const PARTNER_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Vendor": { bg: "#EFF6FF", text: "var(--primary)", border: "#BFDBFE" },
  "Seller": { bg: "#EFF6FF", text: "var(--primary)", border: "#BFDBFE" },
  "Sub-Contractor": { bg: "#F5F3FF", text: "var(--violet)", border: "#DDD6FE" },
  "Service Provider": { bg: "#ECFDF5", text: "var(--success)", border: "#A7F3D0" },
  "Customer": { bg: "#FEF3C7", text: "var(--warning)", border: "#FDE68A" },
  "Carrier": { bg: "#FFF1F2", text: "#E11D48", border: "#FECDD3" },
};

function ItemTypeBadge({ type }: { type: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    "Parts": { bg: "#EFF6FF", text: "var(--primary)", border: "#BFDBFE" },
    "Equipment + Capital": { bg: "#ECFDF5", text: "var(--success)", border: "#A7F3D0" },
    "Equipment + Non-Capital": { bg: "#F5F3FF", text: "var(--violet)", border: "#DDD6FE" },
    "Miscellaneous": { bg: "#FFFBEB", text: "var(--warning)", border: "#FDE68A" },
  };
  const c = colors[type] || colors["Parts"];
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] border" style={{ fontWeight: 500, color: c.text, backgroundColor: c.bg, borderColor: c.border }}>
      {type}
    </span>
  );
}

// Generate inventory of available categories for the add modal
const INVENTORY_CATEGORIES: (AssociatedCategory & Record<string, unknown>)[] = (() => {
  const rng = seededRng(777);
  const names = ["Fasteners & Hardware", "Brake Systems", "Engine Components", "Electrical Systems", "Suspension Parts", "HVAC Modules", "Fuel Systems", "Transmission Parts", "Lighting & Signals", "Body Panels", "Interior Trim", "Exhaust Systems", "Power Steering", "Cooling Systems", "Safety Equipment", "Wheel & Tire", "Fluid & Lubricants", "Gaskets & Seals", "Belts & Hoses", "Sensors & Controls", "Paint & Finish", "Glass & Mirrors", "Audio & Electronics", "Towing & Hitch", "Tools & Equipment"];
  const descs = ["Complete range of components for vehicle assembly", "OEM-spec replacement and aftermarket parts", "High-performance grade components", "Commercial fleet service parts", "Heavy-duty industrial components"];
  return names.map((name, i) => {
    const tagCount = Math.floor(rng() * 3) + 1;
    const tags: string[] = [];
    for (let t = 0; t < tagCount; t++) tags.push(CAT_TAG_POOL[Math.floor(rng() * CAT_TAG_POOL.length)]);
    const creator = CAT_CREATOR_POOL[i % CAT_CREATOR_POOL.length];
    return {
      id: `inv-cat-${i}`,
      code: `C-${String(2001 + i)}`,
      name,
      description: descs[i % descs.length],
      itemType: "Parts",
      status: (rng() > 0.15 ? "Active" : "Inactive") as "Active" | "Inactive",
      linkedItems: Math.floor(rng() * 30) + 5,
      _tags: [...new Set(tags)],
      _linkedCode: CAT_LINKED_CODES[i % CAT_LINKED_CODES.length],
      _linkedCount: Math.floor(rng() * 6) + 1,
      _creatorInitials: creator.initials,
      _creatorName: creator.name,
      _creatorColor: creator.color,
      _createdDate: CAT_DATES[i % CAT_DATES.length],
      _isMe: false,
    };
  });
})();

/* Card chrome that visually mirrors the Partner Details ContentCard. */
function ModalContentCard({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-muted flex items-center gap-2">
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
        )}
        <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{title}</span>
        {typeof count === "number" && (
          <span className="text-[10px] text-slate-500 bg-muted px-1.5 py-0.5 rounded-full ml-1" style={{ fontWeight: 500 }}>{count}</span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function PricingRuleDetailModal({ rule, open, onClose, mode = "create", onApply, onDuplicate, onDisable, onEdit, vendor }: { rule: PricingRule | null; open: boolean; onClose: () => void; mode?: "view" | "create"; onApply?: (rule: PricingRule) => void; onDuplicate?: (rule: PricingRule) => void; onDisable?: (rule: PricingRule) => void; onEdit?: (rule: PricingRule) => void; vendor?: Vendor }) {
  const [tab, setTab] = useState<string>("overview");
  const [itemSearch, setItemSearch] = useState("");
  const [catSearch, setCatSearch] = useState("");
  const [partnerSearch, setPartnerSearch] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Category management state
  const [addedCats, setAddedCats] = useState<(AssociatedCategory & Record<string, unknown>)[]>([]);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catModalView, setCatModalView] = useState<"browse" | "added">("browse");
  const [catModalSearch, setCatModalSearch] = useState("");
  const [catModalAddedSearch, setCatModalAddedSearch] = useState("");
  const [catModalSelectedIds, setCatModalSelectedIds] = useState<Set<string>>(new Set());
  const [catModalAddedSelectedIds, setCatModalAddedSelectedIds] = useState<Set<string>>(new Set());
  const [catRemoveConfirmOpen, setCatRemoveConfirmOpen] = useState(false);
  const [catRemoveSingleId, setCatRemoveSingleId] = useState<string | null>(null);

  // Partner management state
  const [addedPartnerIds, setAddedPartnerIds] = useState<Set<string>>(new Set());
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [partnerModalView, setPartnerModalView] = useState<"browse" | "added">("browse");
  const [partnerModalSearch, setPartnerModalSearch] = useState("");
  const [partnerModalAddedSearch, setPartnerModalAddedSearch] = useState("");
  const [partnerModalSelectedIds, setPartnerModalSelectedIds] = useState<Set<string>>(new Set());
  const [partnerModalAddedSelectedIds, setPartnerModalAddedSelectedIds] = useState<Set<string>>(new Set());
  const [partnerRemoveConfirmOpen, setPartnerRemoveConfirmOpen] = useState(false);
  const [partnerRemoveSingleId, setPartnerRemoveSingleId] = useState<string | null>(null);

  // Archive & Disable confirmation state
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);
  // Pull status from the runtime store so Archive/Disable persist
  // across the session and the picker filters know to hide them.
  const { getStatus: getPrStatus, setStatus: setPrStatus } = usePricingRuleStatus();

  // All hooks must be before early return
  const { vendors: ctxVendors } = useVendors();
  const rulePartners = rule?.partners || [];
  const rulePartnerCount = rule?.partnerCount || 0;
  const assignedPartnerIds = useMemo(() => new Set([...addedPartnerIds, ...rulePartners.map((p) => p.id)]), [addedPartnerIds, rulePartners]);
  const allPartnerVendors = useMemo(() => ctxVendors.filter((v) => assignedPartnerIds.has(v.id)), [ctxVendors, assignedPartnerIds]);
  const availablePartnerVendors = useMemo(() => ctxVendors.filter((v) => !assignedPartnerIds.has(v.id)), [ctxVendors, assignedPartnerIds]);
  const assignedVendors = useMemo(() => {
    const matched = ctxVendors.filter((v) => assignedPartnerIds.has(v.id));
    if (matched.length >= rulePartnerCount) return matched;
    const remaining = ctxVendors.filter((v) => !assignedPartnerIds.has(v.id));
    return [...matched, ...remaining.slice(0, Math.max(0, rulePartnerCount - matched.length))];
  }, [ctxVendors, assignedPartnerIds, rulePartnerCount]);

  if (!rule) return null;
  const isDis = rule.category === "discount";
  const isPreset = rule.isPreset;
  const theme = isDis
    ? { text: "#047857", pillBg: "#ECFDF5", pillBorder: "#D1FAE5" }
    : { text: "#6D28D9", pillBg: "#F5F3FF", pillBorder: "#EDE9FE" };

  // Use provided vendor or fallback to first vendor from context
  const effectiveVendor = vendor || ctxVendors[0] || null;

  // All categories = rule's original + user-added
  const allCats = [...addedCats, ...rule.categories];
  const allCatIds = new Set(allCats.map((c) => c.id));

  // Available inventory (not already added)
  const availableCats = INVENTORY_CATEGORIES.filter((c) => !allCatIds.has(c.id));

  // Detail-modal sizing standard — see PaymentTermDetailModal for rationale.
  // Stable frame across tabs, width capped at 1480px, min 640px height.
  const modalBaseTransition = "transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";
  const modalSizeClass = isFullscreen
    ? `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[calc(100%-1rem)] sm:!max-w-[calc(100%-1.5rem)] lg:!max-w-[calc(100%-2rem)] !max-h-[calc(100%-1rem)] sm:!max-h-[calc(100%-1.5rem)] lg:!max-h-[calc(100%-2rem)] !rounded-2xl`
    : `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[100%] sm:!max-w-[min(75vw,1480px)] !max-h-[100dvh] sm:!max-h-[min(88vh,1180px)] sm:!min-h-[640px] rounded-none sm:!rounded-2xl`;

  const filteredItems = rule.items.filter((it) =>
    !itemSearch.trim() || it.partNo.toLowerCase().includes(itemSearch.toLowerCase()) || it.description.toLowerCase().includes(itemSearch.toLowerCase())
  );
  const filteredCats = allCats.filter((c) =>
    !catSearch.trim() || c.name.toLowerCase().includes(catSearch.toLowerCase()) || c.code.toLowerCase().includes(catSearch.toLowerCase())
  );

  // Category modal helpers
  const catModalFiltered = catModalSearch.trim()
    ? availableCats.filter((c) => c.name.toLowerCase().includes(catModalSearch.toLowerCase()) || c.code.toLowerCase().includes(catModalSearch.toLowerCase()))
    : availableCats;
  const catModalAddedFiltered = catModalAddedSearch.trim()
    ? allCats.filter((c) => c.name.toLowerCase().includes(catModalAddedSearch.toLowerCase()) || c.code.toLowerCase().includes(catModalAddedSearch.toLowerCase()))
    : allCats;

  const handleAddCategories = () => {
    const items = INVENTORY_CATEGORIES.filter((c) => catModalSelectedIds.has(c.id));
    setAddedCats((prev) => [...items, ...prev]);
    setCatModalOpen(false);
    setCatModalSelectedIds(new Set());
    toast.success(`${items.length} categor${items.length !== 1 ? "ies" : "y"} added`);
  };

  const handleRemoveCategory = (id: string) => {
    setAddedCats((prev) => prev.filter((c) => c.id !== id));
    setCatRemoveSingleId(null);
    toast.success("Category removed");
  };

  const handleBulkRemoveCategories = () => {
    catModalAddedSelectedIds.forEach((id) => {
      setAddedCats((prev) => prev.filter((c) => c.id !== id));
    });
    const count = catModalAddedSelectedIds.size;
    setCatModalAddedSelectedIds(new Set());
    setCatRemoveConfirmOpen(false);
    toast.success(`${count} categor${count !== 1 ? "ies" : "y"} removed`);
  };

  const handleAddPartners = () => {
    setAddedPartnerIds((prev) => {
      const next = new Set(prev);
      partnerModalSelectedIds.forEach((id) => next.add(id));
      return next;
    });
    const count = partnerModalSelectedIds.size;
    setPartnerModalSelectedIds(new Set());
    setPartnerModalOpen(false);
    toast.success(`${count} partner${count !== 1 ? "s" : ""} added`);
  };

  const handleRemovePartner = (id: string) => {
    setAddedPartnerIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setPartnerRemoveSingleId(null);
    toast.success("Partner removed");
  };

  const handleBulkRemovePartners = () => {
    setAddedPartnerIds((prev) => {
      const n = new Set(prev);
      partnerModalAddedSelectedIds.forEach((id) => n.delete(id));
      return n;
    });
    const count = partnerModalAddedSelectedIds.size;
    setPartnerModalAddedSelectedIds(new Set());
    setPartnerRemoveConfirmOpen(false);
    toast.success(`${count} partner${count !== 1 ? "s" : ""} removed`);
  };
  const filteredPartners = rule.partners.filter((p) =>
    !partnerSearch.trim() || p.name.toLowerCase().includes(partnerSearch.toLowerCase())
  );

  const PR_DETAIL_TABS = [
    { id: "overview", label: "Overview", icon: FileText, count: 0 },
    { id: "items", label: "Items", icon: Package, count: rule.itemCount },
    { id: "categories", label: "Categories", icon: Layers, count: allCats.length },
    { id: "partner", label: "Partners", icon: Users, count: assignedVendors.length },
    { id: "notes", label: "Notes", icon: BookOpen, count: PR_DUMMY_NOTES.length },
    { id: "attachments", label: "Attachments", icon: Paperclip, count: PR_DUMMY_ATTACHMENTS.length },
    { id: "activity", label: "Recent Activity", icon: Clock, count: 0 },
  ];

  const creatorInitials = rule.createdBy.split(" ").map((n) => n[0]).join("");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setIsFullscreen(false); setTab("overview"); } }}>
      <DialogContent
        className="flex flex-col p-0 gap-0 border-0 sm:border z-[12231]"
        hideCloseButton
        overlayClassName="!z-[12230] !bg-black/50"
        /* Forced viewport centering — see Deactivate confirm note. */
        style={isFullscreen
          ? {
              position: "fixed",
            top: "50%",
            left: "50%",
            right: "auto",
            bottom: "auto",
            transform: "translate(-50%, -50%)",
            translate: "none",
            margin: 0,
              width: "calc(100% - 1rem)",
              height: "calc(100vh - 1rem)",
              maxWidth: "calc(100% - 1rem)",
              maxHeight: "calc(100vh - 1rem)",
              borderRadius: 16,
              boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
            }
          : {
              position: "fixed",
            top: "50%",
            left: "50%",
            right: "auto",
            bottom: "auto",
            transform: "translate(-50%, -50%)",
            translate: "none",
            margin: 0,
              width: "min(75vw, 1480px)",
              maxWidth: "calc(100% - 2rem)",
              height: "min(88vh, 1180px)",
              maxHeight: "calc(100vh - 2rem)",
              minHeight: 640,
              borderRadius: 16,
              boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
            }
        }
      >
        <DialogTitle className="sr-only">Pricing Rule Details — {rule.name}</DialogTitle>
        <DialogDescription className="sr-only">Detailed view of pricing rule {rule.name}</DialogDescription>

        {/* ─── Header: clean layout matching Payment Terms detail ─── */}
        <div className="shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-border">
          <div className="px-4 sm:px-5 pt-3 pb-3">
            <div className="flex items-start gap-3">
              <button onClick={onClose} className="w-8 h-8 rounded-lg border border-border bg-white flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer shrink-0 mt-0.5">
                <ArrowLeft className="w-3.5 h-3.5 text-slate-700" />
              </button>
              {/* Themed avatar */}
              <div
                className="w-[52px] h-[52px] rounded-xl flex flex-col items-center justify-center shrink-0 gap-0.5"
                style={{ backgroundColor: theme.pillBg, border: `1px solid ${theme.pillBorder}` }}
              >
                {isDis
                  ? <TrendingDown className="w-4 h-4" style={{ color: theme.text }} />
                  : <TrendingUp className="w-4 h-4" style={{ color: theme.text }} />}
                <span className="text-[11px] tabular-nums leading-none" style={{ color: theme.text, fontWeight: 700 }}>
                  {rule.tiers[0]?.discount || "—"}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center flex-wrap gap-2">
                  <h1 className="text-[17px] text-foreground truncate" style={{ fontWeight: 700 }}>{rule.name}</h1>
                  {/* Category + Basis segmented pill */}
                  <span className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0" style={{ borderColor: theme.pillBorder }}>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px]" style={{ fontWeight: 600, color: theme.text, backgroundColor: theme.pillBg }}>
                      {isDis ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                      {isDis ? "Discount" : "Premium"}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] bg-white text-slate-500 border-l" style={{ fontWeight: 500, borderColor: theme.pillBorder }}>
                      {rule.basis === "volume" ? "Volume" : "Value"}-Based
                    </span>
                  </span>
                  {/* Status */}
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] border"
                    style={{
                      fontWeight: 500,
                      backgroundColor: rule.status === "Active" ? "#ECFDF5" : "#FFFBEB",
                      color: rule.status === "Active" ? "#065F46" : "#92400E",
                      borderColor: rule.status === "Active" ? "#A7F3D0" : "#FDE68A",
                    }}
                  >
                    {rule.status}
                  </span>
                  {/* Template / Custom marker */}
                  <span className={`inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md border text-[9px] ${isPreset ? "bg-muted border-slate-300 text-slate-500" : "border-slate-300 bg-white text-slate-500"}`} style={{ fontWeight: 600 }}>
                    {isPreset ? <><Lock className="w-2.5 h-2.5" /> TEMPLATE</> : "CUSTOM"}
                  </span>
                </div>
                {/* Description */}
                {rule.description && (
                  <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed line-clamp-1">{rule.description}</p>
                )}
              </div>
              {/* Right-side actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="hidden sm:inline-flex">
                      <button
                        onClick={() => { if (!isPreset && onEdit && rule) { onEdit(rule); onClose(); } }}
                        disabled={isPreset}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:pointer-events-none"
                        style={{ fontWeight: 500 }}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                    </span>
                  </TooltipTrigger>
                  {isPreset && (
                    <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-center leading-relaxed">
                      This rule ships as a system template, so it can&rsquo;t be edited directly. Use <span className="font-semibold">Duplicate</span> to create a custom copy you can edit.
                    </TooltipContent>
                  )}
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="hidden sm:inline-flex">
                      <button
                        onClick={() => !isPreset && setArchiveConfirmOpen(true)}
                        disabled={isPreset}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs text-destructive hover:bg-red-100 hover:border-[#FCA5A5] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-50 disabled:pointer-events-none"
                        style={{ fontWeight: 500 }}
                      >
                        <Archive className="w-3.5 h-3.5" /> Archive
                      </button>
                    </span>
                  </TooltipTrigger>
                  {isPreset && (
                    <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-center leading-relaxed">
                      System templates can&rsquo;t be archived because they ship with the software. <span className="font-semibold">Duplicate</span> the template if you need a version you can manage.
                    </TooltipContent>
                  )}
                </Tooltip>
                <button
                  onClick={() => setDisableConfirmOpen(true)}
                  /* Label + icon aligned with the configurator's "Deactivate"
                     terminology and CircleSlash glyph so the same intent
                     reads identically everywhere (kebab card menu,
                     pricing-rules summary carousel, detail modal). */
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800 hover:bg-[#FEF3C7] hover:border-[#FCD34D] transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  <CircleSlash className="w-3.5 h-3.5" /> Deactivate
                </button>
                <button onClick={() => setIsFullscreen(!isFullscreen)} className="w-8 h-8 rounded-lg border border-border bg-white flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer">
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => { onClose(); setIsFullscreen(false); setTab("overview"); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Body: full-width tabs + data (sidebar hoisted to header) ─── */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Tabs */}
            <div className="flex items-center border-b border-border shrink-0 px-1 bg-white">
              {PR_DETAIL_TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`inline-flex items-center px-4 py-3 text-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                      active ? "border-primary text-primary font-semibold" : "border-transparent text-slate-500 hover:text-slate-700 font-medium"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Overview Tab — read-only view of rule structure */}
            {tab === "overview" && (
              <div className="flex-1 overflow-y-auto bg-[#FAFBFC]">
                <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-5 space-y-5">
                  {/* Mode banner */}
                  <div className={`rounded-lg border px-3.5 py-2.5 flex items-start gap-2.5 ${isPreset ? "border-[#E8ECF1] bg-white" : "border-[#E8ECF1] bg-white"}`}>
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${isPreset ? "bg-slate-50 border border-[#E8ECF1] text-slate-500" : "bg-slate-50 border border-[#E8ECF1] text-slate-500"}`}>
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12.5px] text-foreground" style={{ fontWeight: 600 }}>
                        {isPreset ? "System template (read-only)" : "Custom rule (read-only)"}
                      </p>
                      <p className="text-[11.5px] text-slate-500 mt-0.5 leading-relaxed">
                        {isPreset
                          ? "This rule ships with the software, so it can't be edited or archived. Duplicate it to create a customizable version."
                          : "Click Edit in the header to modify this rule's details."}
                      </p>
                    </div>
                  </div>

                  {/* Pricing Rule Type */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Pricing Rule Type</span>
                      <Tooltip>
                        <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[12300]">
                          <p className="text-slate-500">Type is fixed once a rule is created. To change it, duplicate and pick a new type.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        { key: "discount", label: "Discount", desc: "Lower price adjustment", icon: TrendingDown, color: "#047857", bg: "#ECFDF5", border: "#D1FAE5", activeBg: "#16A34A" },
                        { key: "premium", label: "Premium", desc: "Higher price adjustment", icon: TrendingUp, color: "#6D28D9", bg: "#F5F3FF", border: "#EDE9FE", activeBg: "#8B5CF6" },
                      ]).map((t) => {
                        const isActive = rule.category === t.key;
                        return (
                          <div key={t.key} className={`relative rounded-xl overflow-hidden border transition-all duration-200 ${isActive ? `border-[${t.border}]/70 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]` : "border-border bg-white opacity-50"}`}>
                            {isActive && <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(135deg, ${t.bg}80 0%, transparent 70%)` }} />}
                            <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                              <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${t.bg}, ${t.border}40)`, color: t.color }}>
                                <t.icon className="w-[18px] h-[18px]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px]" style={{ fontWeight: 600, color: isActive ? t.color : "#475569" }}>{t.label}</p>
                                <p className="text-[11px] mt-0.5 truncate" style={{ color: isActive ? t.color : "#94A3B8" }}>{t.desc}</p>
                              </div>
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isActive ? "" : "border-[1.5px] border-[#D1D5DB] bg-white"}`} style={isActive ? { backgroundColor: t.activeBg, boxShadow: `0 0 0 2px ${t.activeBg}26` } : {}}>
                                {isActive && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pricing Rule Details */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Pricing Rule Details</span>
                      <Tooltip>
                        <TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[12300]">
                          <p className="text-slate-500">Name, basis, and description as they appear on POs and invoices.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="rounded-xl border border-[#E8ECF1] bg-white p-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                            <div>
                              <label className="text-[12px] text-foreground block" style={{ fontWeight: 500 }}>{isDis ? "Discount" : "Premium"} Name</label>
                              <Input value={rule.name} disabled className="mt-1 !h-10 text-sm" />
                            </div>
                            <div>
                              <label className="text-[12px] text-foreground block" style={{ fontWeight: 500 }}>Calculation Basis</label>
                              <Input value={rule.basis === "volume" ? "Volume-Based" : "Value-Based"} disabled className="mt-1 !h-10 text-sm" />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-[12px] text-foreground block" style={{ fontWeight: 500 }}>Description</label>
                              <Input value={rule.description} disabled placeholder="—" className="mt-1 !h-10 text-sm" />
                            </div>
                            {rule.hasDateLimit && (
                              <>
                                <div>
                                  <label className="text-[12px] text-foreground block" style={{ fontWeight: 500 }}>Valid From</label>
                                  <Input value={rule.validFrom} disabled className="mt-1 !h-10 text-sm" />
                                </div>
                                <div>
                                  <label className="text-[12px] text-foreground block" style={{ fontWeight: 500 }}>Valid To</label>
                                  <Input value={rule.validTo} disabled className="mt-1 !h-10 text-sm" />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={6} className="max-w-[260px] text-center leading-relaxed text-xs">
                        {isPreset
                          ? <>This is a system template and can&rsquo;t be edited. Use <span className="font-semibold">Duplicate</span> to make a custom version.</>
                          : <>Click <span className="font-semibold">Edit</span> in the header to modify this rule.</>}
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Tier Details */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>{isDis ? "Discount" : "Premium"} Tiers</span>
                      <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-muted text-slate-500" style={{ fontWeight: 600 }}>{rule.tiers.length}</span>
                    </div>
                    <div className="rounded-xl border border-[#E8ECF1] bg-white p-4 space-y-2">
                      {rule.tiers.map((tier, idx) => (
                        <div key={idx} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[#E8ECF1] bg-[#FAFBFC]">
                          <div className="flex items-center gap-2.5 text-[12px]">
                            <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] shrink-0" style={{ backgroundColor: theme.pillBg, color: theme.text, fontWeight: 700 }}>{idx + 1}</span>
                            <span className="text-slate-500">{tier.minQty}</span>
                            <span className="text-slate-300">–</span>
                            <span className="text-slate-500">{tier.maxQty}</span>
                          </div>
                          <span className="text-[12px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>{tier.discount}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Metadata footer */}
                  <div className="flex items-center gap-3 pt-2 text-[11.5px] text-slate-500" style={{ fontWeight: 500 }}>
                    <span className="inline-flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px]" style={{ fontWeight: 700, backgroundColor: isPreset ? "var(--accent)" : theme.pillBg, color: isPreset ? "var(--primary)" : theme.text }}>
                        {isPreset ? "OS" : creatorInitials}
                      </div>
                      <span>Created by <span className="text-slate-700" style={{ fontWeight: 600 }}>{isPreset ? "Omnesoft" : rule.createdBy}</span></span>
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span>Created <span className="text-slate-700" style={{ fontWeight: 600 }}>{rule.createdDate}</span></span>
                  </div>
                </div>
              </div>
            )}

            {/* Items Tab — uses the shared PartnerItemsTab component everywhere */}
            {tab === "items" && effectiveVendor && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <PartnerItemsTab vendor={effectiveVendor} hideHeader compact contextLabel={rule.name} contextType={rule.category === "discount" ? "discount" : "premium"} />
              </div>
            )}
            {tab === "items" && !effectiveVendor && (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Package className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">No items data available</p>
                </div>
              </div>
            )}

            {/* Categories Tab — exact partner listing table match */}
            {tab === "categories" && (() => {
              const ST: Record<string, { bg: string; text: string; border: string }> = {
                "Active": { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
                "Inactive": { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
              };
              // Ensure we always have data by reading extended fields
              const cats = filteredCats.map((cat) => {
                const e = cat as any;
                return {
                  ...cat,
                  tags: (e._tags || [cat.name]) as string[],
                  linkedCode: (e._linkedCode || cat.code) as string,
                  linkedCount: (e._linkedCount ?? cat.linkedItems) as number,
                  creatorInitials: (e._creatorInitials || "??") as string,
                  creatorName: (e._creatorName || "Unknown") as string,
                  creatorColor: (e._creatorColor || "#94A3B8") as string,
                  createdDate: (e._createdDate || "—") as string,
                  isMe: !!e._isMe,
                };
              });

              return (
              <div className="flex-1 flex flex-col overflow-hidden bg-white">
                {/* Toolbar — same as partner listing */}
                <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 shrink-0">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                      <input type="text" value={catSearch} onChange={(e) => setCatSearch(e.target.value)} placeholder="Search categories..." className="w-full pl-9 pr-8 h-9 text-sm bg-white border border-border/80 rounded-lg shadow-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors placeholder:text-muted-foreground/50" />
                      {catSearch && (
                        <button onClick={() => setCatSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <button className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border border-border/80 bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none shrink-0 text-foreground" style={{ fontWeight: 500 }}>
                      <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm">Filters</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                      <span className="text-foreground">{cats.length}</span>
                      <span className="text-muted-foreground/70"> categories</span>
                    </span>
                    <div className="w-px h-5 bg-border/60 mx-0.5 hidden sm:block" />
                    <button onClick={() => { setCatModalOpen(true); setCatModalView("browse"); setCatModalSearch(""); setCatModalAddedSearch(""); setCatModalSelectedIds(new Set()); setCatModalAddedSelectedIds(new Set()); }} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-sm shadow-sm transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                      <Plus className="w-3.5 h-3.5" /> Add Category
                    </button>
                  </div>
                </div>

                {/* Quick filter pills — same as partner listing */}
                <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
                  {(["all", "Active", "Inactive"] as const).map((f) => {
                    const cnt = f === "all" ? cats.length : cats.filter((c) => c.status === f).length;
                    return (
                      <button
                        key={f}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          f === "all"
                            ? "border-primary bg-accent hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                            : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
                        }`}
                        style={{ fontWeight: f === "all" ? 500 : 400, color: f === "all" ? "var(--primary)" : undefined }}
                      >
                        {f === "all" ? "All Categories" : f}
                        <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${f === "all" ? "bg-primary/10" : "bg-muted"}`} style={{ fontWeight: 600, color: f === "all" ? "var(--primary)" : "var(--muted-foreground)" }}>
                          {cnt}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Divider */}
                <div className="border-t border-border shrink-0" />

                {/* Table — exact partner listing pattern */}
                <div className="min-h-0 overflow-auto flex-1 scrollbar-hide">
                  {cats.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                      <Layers className="w-8 h-8" />
                      <p className="text-sm" style={{ fontWeight: 500 }}>No categories assigned</p>
                    </div>
                  ) : (
                    <Table style={{ tableLayout: "fixed", width: `max(${40 + 140 + 220 + 200 + 160 + 170 + 120 + 100 + 60}px, 100%)` }}>
                      <TableHeader className="sticky top-0 z-20 bg-card">
                        <TableRow className="bg-muted/30 hover:bg-muted/30 [&>th]:h-8">
                          <TableHead className="sticky left-0 z-20 bg-slate-50" style={{ width: 40, minWidth: 40, maxWidth: 40, paddingLeft: 8, paddingRight: 0 }}>
                            <Checkbox disabled className="opacity-40" />
                          </TableHead>
                          <TableHead style={{ width: 140, minWidth: 140, maxWidth: 140 }} className="text-[13px] text-foreground !pl-4"><span style={{ fontWeight: 600 }}>Code</span></TableHead>
                          <TableHead style={{ width: 220, minWidth: 220, maxWidth: 220 }} className="text-[13px] text-foreground !pl-4"><span style={{ fontWeight: 600 }}>Description</span></TableHead>
                          <TableHead style={{ width: 200, minWidth: 200, maxWidth: 200 }} className="text-[13px] text-foreground !pl-4"><span style={{ fontWeight: 600 }}>Tags</span></TableHead>
                          <TableHead style={{ width: 160, minWidth: 160, maxWidth: 160 }} className="text-[13px] text-foreground !pl-4"><span style={{ fontWeight: 600 }}>Linked Records</span></TableHead>
                          <TableHead style={{ width: 170, minWidth: 170, maxWidth: 170 }} className="text-[13px] text-foreground !pl-4"><span style={{ fontWeight: 600 }}>Created By</span></TableHead>
                          <TableHead style={{ width: 120, minWidth: 120, maxWidth: 120 }} className="text-[13px] text-foreground !pl-4"><span style={{ fontWeight: 600 }}>Created Date</span></TableHead>
                          <TableHead style={{ width: 100, minWidth: 100, maxWidth: 100 }} className="text-[13px] text-foreground !pl-4"><span style={{ fontWeight: 600 }}>Status</span></TableHead>
                          <TableHead className="sticky right-0 z-20 bg-slate-50 !pl-2 !pr-2" style={{ width: 60, minWidth: 60, maxWidth: 60, boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                            <span className="text-[13px]">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cats.map((cat) => {
                          const s = ST[cat.status] || ST["Active"];
                          return (
                            <TableRow key={cat.id} className="cursor-pointer group hover:bg-[#F0F7FF] [&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2">
                              {/* Checkbox */}
                              <TableCell className="sticky left-0 z-10 bg-card group-hover:bg-[#F0F7FF] !pl-2 !pr-0" style={{ width: 40, minWidth: 40, maxWidth: 40 }}>
                                <Checkbox />
                              </TableCell>
                              {/* Code */}
                              <TableCell style={{ width: 140, minWidth: 140, maxWidth: 140, overflow: "hidden" }}>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm whitespace-nowrap" style={{ fontWeight: 500, color: '#1E293B' }}>{cat.code}</span>
                                  {cat.isMe && (
                                    <span className="inline-flex items-center px-1.5 py-px rounded text-[9px] border" style={{ fontWeight: 600, backgroundColor: "var(--accent)", color: "var(--primary)", borderColor: "#BFDBFE" }}>ME</span>
                                  )}
                                </div>
                              </TableCell>
                              {/* Description */}
                              <TableCell style={{ width: 220, minWidth: 220, maxWidth: 220, overflow: "hidden" }}>
                                <p className="text-sm text-slate-700 truncate" style={{ fontWeight: 400 }}>{cat.description}</p>
                              </TableCell>
                              {/* Tags */}
                              <TableCell style={{ width: 200, minWidth: 200, maxWidth: 200, overflow: "hidden" }}>
                                <div className="flex items-center gap-1">
                                  {cat.tags.slice(0, 2).map((tag) => (
                                    <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap bg-muted text-muted-foreground border border-border" style={{ fontWeight: 500 }}>
                                      {tag}
                                    </span>
                                  ))}
                                  {cat.tags.length > 2 && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] border cursor-default" style={{ fontWeight: 600, backgroundColor: "var(--muted)", color: "var(--muted-foreground)", borderColor: "var(--border)" }}>
                                      +{cat.tags.length - 2}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              {/* Linked Records */}
                              <TableCell style={{ width: 160, minWidth: 160, maxWidth: 160, overflow: "hidden" }}>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-sm text-primary cursor-pointer hover:underline" style={{ fontWeight: 500 }}>{cat.linkedCode}</span>
                                  {cat.linkedCount > 0 && (
                                    <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{cat.linkedCount} more</span>
                                  )}
                                </div>
                              </TableCell>
                              {/* Created By — matches partner listing avatar style */}
                              <TableCell style={{ width: 170, minWidth: 170, maxWidth: 170, overflow: "hidden" }}>
                                {(() => {
                                  const tint = getAvatarTint(cat.creatorName);
                                  return (
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] shrink-0 border" style={{ backgroundColor: tint.bg, color: tint.fg, borderColor: `${tint.fg}20`, fontWeight: 700 }}>
                                        {cat.creatorInitials}
                                      </div>
                                      <span className="text-sm text-slate-700 truncate block max-w-[120px]">{cat.creatorName}</span>
                                    </div>
                                  );
                                })()}
                              </TableCell>
                              {/* Created Date */}
                              <TableCell style={{ width: 120, minWidth: 120, maxWidth: 120, overflow: "hidden" }}>
                                <span className="text-sm whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>{cat.createdDate}</span>
                              </TableCell>
                              {/* Status */}
                              <TableCell style={{ width: 100, minWidth: 100, maxWidth: 100, overflow: "hidden" }}>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] border" style={{ fontWeight: 600, backgroundColor: s.bg, color: s.text, borderColor: s.border }}>
                                  {cat.status}
                                </span>
                              </TableCell>
                              {/* Actions */}
                              <TableCell className="sticky right-0 bg-card group-hover:bg-[#F0F7FF] z-10 !pl-2 !pr-2" style={{ width: 60, minWidth: 60, maxWidth: 60, boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <button className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-[180px] z-[12230]" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuItem onClick={() => toast.info("View — coming soon")}>
                                      <Eye className="w-4 h-4 mr-2" /> View
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => toast.info("Edit — coming soon")}>
                                      <Pencil className="w-4 h-4 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => toast.info(cat.status === "Active" ? "Deactivated" : "Activated")}>
                                      <CircleSlash className="w-4 h-4 mr-2" /> {cat.status === "Active" ? "Deactivate" : "Activate"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-red-50" onClick={() => setCatRemoveSingleId(cat.id)}>
                                      <Trash2 className="w-4 h-4 mr-2 text-destructive" /> Remove
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>

                {/* Pagination — exact partner listing match */}
                <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Records per page</span>
                    <select className="h-8 px-2 pr-7 rounded-lg border border-border bg-white text-sm text-foreground cursor-pointer outline-none focus:border-primary focus:ring-1 focus:ring-primary/20">
                      <option>20</option><option>50</option><option>100</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled>
                      <ChevronsLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled>
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Prev
                    </Button>

                    <Button variant="default" size="sm" className="h-8 w-8 p-0 text-sm bg-primary text-primary-foreground">
                      1
                    </Button>

                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled>
                      Next
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled>
                      <ChevronsRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              );
            })()}

            {/* Partners Tab — uses real vendor data from context, partner listing table style */}
            {tab === "partner" && (() => {
              const allVendors = ctxVendors;
              const pSearchQ = partnerSearch.toLowerCase();
              const pFiltered = pSearchQ
                ? allVendors.filter((v) => v.displayName?.toLowerCase().includes(pSearchQ) || v.companyName?.toLowerCase().includes(pSearchQ) || v.country?.toLowerCase().includes(pSearchQ))
                : allVendors;
              const ST_P: Record<string, { bg: string; text: string; border: string }> = {
                "active": { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
                "inactive": { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
                "archived": { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
              };

              return (
              <div className="flex-1 flex flex-col overflow-hidden bg-white">
                {/* Toolbar */}
                <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 shrink-0">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                      <input type="text" value={partnerSearch} onChange={(e) => setPartnerSearch(e.target.value)} placeholder="Search partners..." className="w-full pl-9 pr-8 h-9 text-sm bg-white border border-border/80 rounded-lg shadow-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors placeholder:text-muted-foreground/50" />
                      {partnerSearch && (
                        <button onClick={() => setPartnerSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <button className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border border-border/80 bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none shrink-0 text-foreground" style={{ fontWeight: 500 }}>
                      <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm">Filters</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                      <span className="text-foreground">{pFiltered.length}</span>
                      <span className="text-muted-foreground/70"> partners</span>
                    </span>
                    <div className="w-px h-5 bg-border/60 mx-0.5 hidden sm:block" />
                    <button onClick={() => { setPartnerModalOpen(true); setPartnerModalView("browse"); setPartnerModalSearch(""); setPartnerModalAddedSearch(""); setPartnerModalSelectedIds(new Set()); setPartnerModalAddedSelectedIds(new Set()); }} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-sm shadow-sm transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                      <Plus className="w-3.5 h-3.5" /> Add Partner
                    </button>
                  </div>
                </div>

                {/* Quick filter pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
                  {(["all", "active", "inactive", "archived"] as const).map((f) => {
                    const cnt = f === "all" ? pFiltered.length : pFiltered.filter((v) => (v.status?.toLowerCase() ?? "") === f).length;
                    return (
                      <button
                        key={f}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          f === "all"
                            ? "border-primary bg-accent hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                            : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
                        }`}
                        style={{ fontWeight: f === "all" ? 500 : 400, color: f === "all" ? "var(--primary)" : undefined }}
                      >
                        {f === "all" ? "All Partners" : f.charAt(0).toUpperCase() + f.slice(1)}
                        <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${f === "all" ? "bg-primary/10" : "bg-muted"}`} style={{ fontWeight: 600, color: f === "all" ? "var(--primary)" : "var(--muted-foreground)" }}>
                          {cnt}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Divider */}
                <div className="border-t border-border shrink-0" />

                {/* Table — partner listing style */}
                <div className="min-h-0 overflow-auto flex-1 scrollbar-hide">
                  {pFiltered.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                      <Users className="w-8 h-8" />
                      <p className="text-sm" style={{ fontWeight: 500 }}>No partners found</p>
                    </div>
                  ) : (
                    <Table style={{ tableLayout: "fixed", width: `max(${40 + 240 + 140 + 180 + 150 + 130 + 100 + 60}px, 100%)` }}>
                      <TableHeader className="sticky top-0 z-20 bg-card">
                        <TableRow className="bg-muted/30 hover:bg-muted/30 [&>th]:h-8">
                          <TableHead className="sticky left-0 z-20 bg-slate-50" style={{ width: 40, minWidth: 40, maxWidth: 40, paddingLeft: 8, paddingRight: 0 }}>
                            <Checkbox disabled className="opacity-40" />
                          </TableHead>
                          <TableHead style={{ width: 240, minWidth: 240, maxWidth: 240 }} className="text-[13px] text-foreground !pl-4"><span style={{ fontWeight: 600 }}>Partners</span></TableHead>
                          <TableHead style={{ width: 140, minWidth: 140, maxWidth: 140 }} className="text-[13px] text-foreground !pl-4"><span style={{ fontWeight: 600 }}>Partner Type</span></TableHead>
                          <TableHead style={{ width: 180, minWidth: 180, maxWidth: 180 }} className="text-[13px] text-foreground !pl-4"><span style={{ fontWeight: 600 }}>No. of Items</span></TableHead>
                          <TableHead style={{ width: 150, minWidth: 150, maxWidth: 150 }} className="text-[13px] text-foreground !pl-4"><span style={{ fontWeight: 600 }}>Country</span></TableHead>
                          <TableHead style={{ width: 130, minWidth: 130, maxWidth: 130 }} className="text-[13px] text-foreground !pl-4 text-right"><span style={{ fontWeight: 600 }}>Credit Limit ($)</span></TableHead>
                          <TableHead style={{ width: 100, minWidth: 100, maxWidth: 100 }} className="text-[13px] text-foreground !pl-4"><span style={{ fontWeight: 600 }}>Status</span></TableHead>
                          <TableHead className="sticky right-0 z-20 bg-slate-50 !pl-2 !pr-2" style={{ width: 60, minWidth: 60, maxWidth: 60, boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                            <span className="text-[13px]">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pFiltered.slice(0, 20).map((v) => {
                          const tint = getAvatarTint(v.displayName || v.companyName);
                          const initials = (v.displayName || v.companyName).split(/[\s&]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
                          const partnerTypes = v.partnerTypes || [];
                          const itemCodes = v.itemCodes || [];
                          const st = ST_P[v.status] || ST_P["active"];
                          const formatCurrency = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
                          return (
                            <TableRow key={v.id} className="cursor-pointer group hover:bg-[#F0F7FF] [&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2">
                              <TableCell className="sticky left-0 z-10 bg-card group-hover:bg-[#F0F7FF] !pl-2 !pr-0" style={{ width: 40, minWidth: 40, maxWidth: 40 }}>
                                <Checkbox />
                              </TableCell>
                              {/* Partner Name */}
                              <TableCell style={{ width: 240, minWidth: 240, maxWidth: 240, overflow: "hidden" }}>
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] shrink-0 border" style={{ backgroundColor: tint.bg, color: tint.fg, borderColor: `${tint.fg}20`, fontWeight: 700 }}>
                                    {initials}
                                  </div>
                                  <span className="text-sm truncate block max-w-[170px]" style={{ fontWeight: 500, color: '#1E293B' }}>{v.displayName}</span>
                                </div>
                              </TableCell>
                              {/* Partner Type */}
                              <TableCell style={{ width: 140, minWidth: 140, maxWidth: 140, overflow: "hidden" }}>
                                <div className="flex items-center gap-1.5">
                                  {partnerTypes.map((type) => (
                                    <span key={type} className="inline-flex items-center px-2 py-0.5 text-xs rounded-md border" style={{ fontWeight: 500, backgroundColor: type === "vendor" ? "#EFF6FF" : "#F5F3FF", color: type === "vendor" ? "#1E40AF" : "#5B21B6", borderColor: type === "vendor" ? "#BFDBFE" : "#DDD6FE" }}>
                                      {type === "vendor" ? "Vendor" : "Customer"}
                                    </span>
                                  ))}
                                </div>
                              </TableCell>
                              {/* No. of Items */}
                              <TableCell style={{ width: 180, minWidth: 180, maxWidth: 180, overflow: "hidden" }}>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm truncate" style={{ fontWeight: 500 }}>{itemCodes[0] || "\u2013"}</span>
                                  {itemCodes.length > 1 && (
                                    <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{itemCodes.length - 1} more</span>
                                  )}
                                </div>
                              </TableCell>
                              {/* Country */}
                              <TableCell style={{ width: 150, minWidth: 150, maxWidth: 150, overflow: "hidden" }}>
                                <div className="flex items-center gap-2">
                                  <span className="text-base">{v.countryFlag}</span>
                                  <span className="text-sm">{v.country}</span>
                                </div>
                              </TableCell>
                              {/* Credit Limit */}
                              <TableCell className="text-right" style={{ width: 130, minWidth: 130, maxWidth: 130, overflow: "hidden" }}>
                                <span className="text-sm">$ {formatCurrency(v.creditLimit)}</span>
                              </TableCell>
                              {/* Status */}
                              <TableCell style={{ width: 100, minWidth: 100, maxWidth: 100, overflow: "hidden" }}>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] border" style={{ fontWeight: 600, backgroundColor: st.bg, color: st.text, borderColor: st.border }}>
                                  {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                                </span>
                              </TableCell>
                              {/* Actions */}
                              <TableCell className="sticky right-0 bg-card group-hover:bg-[#F0F7FF] z-10 !pl-2 !pr-2" style={{ width: 60, minWidth: 60, maxWidth: 60, boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <button className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-[180px] z-[12230]" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuItem onClick={() => toast.info("View Details — coming soon")}>
                                      <Eye className="w-4 h-4 mr-2" /> View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-red-50" onClick={() => setPartnerRemoveSingleId(v.id)}>
                                      <Trash2 className="w-4 h-4 mr-2 text-destructive" /> Remove
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 border-t border-border gap-3 shrink-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Records per page</span>
                    <select className="h-8 px-2 pr-7 rounded-lg border border-border bg-white text-sm text-foreground cursor-pointer outline-none focus:border-primary focus:ring-1 focus:ring-primary/20">
                      <option>20</option><option>50</option><option>100</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled><ChevronsLeft className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled><ChevronLeft className="w-3.5 h-3.5" />Prev</Button>
                    <Button variant="default" size="sm" className="h-8 w-8 p-0 text-sm bg-primary text-primary-foreground">1</Button>
                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-sm text-muted-foreground" disabled>Next<ChevronRight className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled><ChevronsRight className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
              );
            })()}

            {/* Placeholder tabs */}
            {/* Notes Tab — Partner-details-style soft card with subtle author footer. */}
            {tab === "notes" && (
              <div className="flex-1 overflow-auto p-4">
                <ModalContentCard title="Notes" icon={MessageSquare} count={PR_DUMMY_NOTES.length}>
                  <div className="space-y-2">
                    {PR_DUMMY_NOTES.map((note) => (
                      <div key={note.id} className="rounded-md bg-[#FAFBFC] border border-muted p-3">
                        <p className="text-[12px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{note.text}</p>
                        <p className="text-[10.5px] text-slate-400 mt-2 pt-2 border-t border-muted/60">
                          — <span className="text-slate-500" style={{ fontWeight: 500 }}>{note.author}</span> · {note.date}
                        </p>
                      </div>
                    ))}
                  </div>
                </ModalContentCard>
              </div>
            )}

            {/* Attachments Tab — shared component matches Partner Detail page */}
            {tab === "attachments" && (
              <div className="flex-1 overflow-auto">
                <AttachmentsTab files={PR_DUMMY_ATTACHMENTS} embedded />
              </div>
            )}

            {/* Recent Activity Tab — shared feed-style log. */}
            {tab === "activity" && (
              <div className="flex-1 overflow-auto p-4">
                <ModalContentCard title="Activity Timeline" icon={Activity}>
                  <ActivityFeed
                    items={PR_DUMMY_ACTIVITY.map((act) => ({
                      id: act.id,
                      type: act.type as ActivityFeedItemType,
                      user: act.user,
                      verb: act.action,
                      target: act.target || undefined,
                      date: act.date,
                    }))}
                  />
                  <div className="pt-2.5 mt-3 border-t border-muted text-center">
                    <p className="text-[11px] text-slate-400">Full activity log will be available with backend integration</p>
                  </div>
                </ModalContentCard>
              </div>
            )}
          </div>

        </div>

        {/* ─── Footer ─── */}
        <div className="shrink-0 border-t border-border bg-white rounded-b-none sm:rounded-b-2xl">
          <div className="px-5 py-2.5 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Reviewing: <span className="text-slate-700" style={{ fontWeight: 600 }}>{rule.name}</span></span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (rule && onDuplicate) { onDuplicate(rule); onClose(); }
                  else { toast.info("Duplicate coming soon"); }
                }}
                className="h-8 px-3.5 rounded-lg border border-border bg-white text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer inline-flex items-center gap-1.5" style={{ fontWeight: 500 }}
              >
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </button>
              {mode === "create" && (
                <button
                  onClick={() => {
                    if (rule && onApply) { onApply(rule); onClose(); }
                  }}
                  className="h-8 px-3.5 rounded-lg bg-primary text-white text-xs hover:bg-primary/90 transition-colors cursor-pointer inline-flex items-center gap-1.5" style={{ fontWeight: 500 }}
                >
                  <Check className="w-3.5 h-3.5" /> Apply to Partner
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* ─── Add/Manage Category Modal — matches items modal exactly ─── */}
      <Dialog open={catModalOpen} onOpenChange={setCatModalOpen}>
        <DialogContent
          className="flex flex-col p-0 gap-0 border-0 sm:border z-[12230] !fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full !max-w-[100%] sm:!max-w-[960px] lg:!max-w-[1040px] !max-h-[100dvh] sm:!max-h-[88vh] rounded-none sm:!rounded-2xl transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          hideCloseButton
          overlayClassName="z-[12225]"
          style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
        >
          <DialogTitle className="sr-only">Manage Categories</DialogTitle>
          <DialogDescription className="sr-only">Add or remove categories for this pricing rule.</DialogDescription>

          {/* Header — same as items modal */}
          <div className="px-3 sm:px-5 pt-3 sm:pt-4 pb-2.5 sm:pb-3 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>Manage Categories</h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border whitespace-nowrap shrink-0" style={{ fontWeight: 600, backgroundColor: isDis ? "#ECFDF5" : "#F5F3FF", color: isDis ? "#047857" : "#6D28D9", borderColor: isDis ? "#A7F3D0" : "#DDD6FE" }}>
                    {isDis ? "Discount" : "Premium"}<span className="text-[10px] opacity-60">·</span>{rule.name}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1" style={{ fontWeight: 400 }}>Browse available categories to add, or manage already added ones.</p>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <button onClick={() => setCatModalOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Search + View tabs + Sorting pills — same layout as items modal */}
          <div className="px-3 sm:px-5 pt-2 bg-white shrink-0">
            <div className="flex items-center gap-3">
              {/* Search — leftmost */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                <input
                  type="text"
                  value={catModalView === "browse" ? catModalSearch : catModalAddedSearch}
                  onChange={(e) => catModalView === "browse" ? setCatModalSearch(e.target.value) : setCatModalAddedSearch(e.target.value)}
                  placeholder={catModalView === "browse" ? "Search available categories..." : "Search added categories..."}
                  className="w-full pl-9 pr-8 h-8 text-[13px] bg-white border border-border/80 rounded-lg shadow-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors placeholder:text-muted-foreground/50"
                />
                {(catModalView === "browse" ? catModalSearch : catModalAddedSearch) && (
                  <button onClick={() => catModalView === "browse" ? setCatModalSearch("") : setCatModalAddedSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* View toggle */}
              <div className="inline-flex items-center rounded-lg bg-muted p-0.5 shrink-0">
                <button onClick={() => setCatModalView("browse")} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] transition-all cursor-pointer ${catModalView === "browse" ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-foreground" : "text-slate-500 hover:text-slate-700"}`} style={{ fontWeight: catModalView === "browse" ? 600 : 500 }}>
                  <Layers className={`w-3.5 h-3.5 ${catModalView === "browse" ? "text-primary" : "text-slate-400"}`} />
                  Browse Categories
                  <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[16px] text-center ${catModalView === "browse" ? "bg-accent text-primary" : "bg-border text-slate-500"}`} style={{ fontWeight: 600 }}>{availableCats.length}</span>
                </button>
                <button onClick={() => setCatModalView("added")} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] transition-all cursor-pointer ${catModalView === "added" ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-foreground" : "text-slate-500 hover:text-slate-700"}`} style={{ fontWeight: catModalView === "added" ? 600 : 500 }}>
                  <Check className={`w-3.5 h-3.5 ${catModalView === "added" ? "text-success" : "text-slate-400"}`} />
                  Added Categories
                  <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[16px] text-center ${catModalView === "added" ? "bg-emerald-50 text-success" : "bg-border text-slate-500"}`} style={{ fontWeight: 600 }}>{allCats.length}</span>
                </button>
              </div>

              {/* Count */}
              <div className="flex items-center gap-2 ml-auto shrink-0">
                {catModalView === "browse" && catModalSelectedIds.size > 0 && (
                  <span className="text-xs text-primary shrink-0" style={{ fontWeight: 600 }}>{catModalSelectedIds.size} selected</span>
                )}
                <span className="text-xs text-muted-foreground shrink-0" style={{ fontWeight: 500 }}>
                  {(catModalView === "browse" ? catModalFiltered : catModalAddedFiltered).length} {catModalView === "browse" ? "available" : "categories"}
                </span>
              </div>
            </div>

            {/* Sorting pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 pb-2.5">
              {(["all", "Active", "Inactive"] as const).map((f) => {
                const src = catModalView === "browse" ? catModalFiltered : catModalAddedFiltered;
                const cnt = f === "all" ? src.length : src.filter((c) => c.status === f).length;
                return (
                  <button
                    key={f}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      f === "all"
                        ? "border-primary bg-accent hover:bg-[#D6E8FF] active:bg-[#ADD1FF]"
                        : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
                    }`}
                    style={{ fontWeight: f === "all" ? 500 : 400, color: f === "all" ? "var(--primary)" : undefined }}
                  >
                    {f === "all" ? "All" : f}
                    <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${f === "all" ? "bg-primary/10" : "bg-muted"}`} style={{ fontWeight: 600, color: f === "all" ? "var(--primary)" : "var(--muted-foreground)" }}>
                      {cnt}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table — white bg, same row pattern as items modal */}
          <div className="flex-1 min-h-0 overflow-auto bg-white">
            <Table style={{ tableLayout: "fixed", minWidth: catModalView === "added" ? 860 : 800 }}>
              <TableHeader className="sticky top-0 z-20 bg-white">
                <TableRow className="bg-[#FAFBFC] hover:bg-[#FAFBFC] [&>th]:h-8">
                  <TableHead className="sticky left-0 z-20 bg-[#FAFBFC] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0">
                    {(() => {
                      const list = catModalView === "browse" ? catModalFiltered : catModalAddedFiltered;
                      const selSet = catModalView === "browse" ? catModalSelectedIds : catModalAddedSelectedIds;
                      const setFn = catModalView === "browse" ? setCatModalSelectedIds : setCatModalAddedSelectedIds;
                      const allSel = list.length > 0 && list.every((c) => selSet.has(c.id));
                      const someSel = list.some((c) => selSet.has(c.id));
                      return (
                        <Checkbox
                          checked={allSel ? true : someSel ? "indeterminate" : false}
                          onCheckedChange={() => {
                            setFn((prev) => {
                              const next = new Set(prev);
                              list.forEach((c) => allSel ? next.delete(c.id) : next.add(c.id));
                              return next;
                            });
                          }}
                        />
                      );
                    })()}
                  </TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-3" style={{ fontWeight: 600, width: 120 }}>Code</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-3" style={{ fontWeight: 600, width: 200 }}>Name</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-3" style={{ fontWeight: 600, width: 280 }}>Description</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-3" style={{ fontWeight: 600, width: 100 }}>Status</TableHead>
                  {catModalView === "added" && (
                    <TableHead className="sticky right-0 z-20 bg-[#FAFBFC] w-[60px] min-w-[60px] max-w-[60px] !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }} />
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(catModalView === "browse" ? catModalFiltered : catModalAddedFiltered).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={catModalView === "added" ? 6 : 5} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Layers className="w-8 h-8" />
                        <p className="text-sm">{catModalView === "browse" ? "No categories available" : "No categories added"}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  (catModalView === "browse" ? catModalFiltered : catModalAddedFiltered).map((cat) => {
                    const isSelected = catModalView === "browse" ? catModalSelectedIds.has(cat.id) : catModalAddedSelectedIds.has(cat.id);
                    const stc = cat.status === "Active" ? { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" } : { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" };
                    return (
                      <TableRow
                        key={cat.id}
                        className={`cursor-pointer group bg-white hover:bg-[#F0F7FF] [&>td]:py-1 [&>td]:pl-3 [&>td]:pr-2 ${isSelected ? "!bg-accent/30" : ""}`}
                        onClick={() => {
                          const setFn = catModalView === "browse" ? setCatModalSelectedIds : setCatModalAddedSelectedIds;
                          setFn((p) => { const n = new Set(p); n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id); return n; });
                        }}
                      >
                        <TableCell className="sticky left-0 z-10 bg-white group-hover:bg-[#F0F7FF] !pl-2 !pr-0" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => {
                              const setFn = catModalView === "browse" ? setCatModalSelectedIds : setCatModalAddedSelectedIds;
                              setFn((p) => { const n = new Set(p); n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id); return n; });
                            }}
                          />
                        </TableCell>
                        <TableCell className="bg-white group-hover:bg-[#F0F7FF]">
                          <span className="font-mono text-sm whitespace-nowrap" style={{ fontWeight: 500, color: '#1E293B' }}>{cat.code}</span>
                        </TableCell>
                        <TableCell className="bg-white group-hover:bg-[#F0F7FF]">
                          <span className="text-sm text-foreground" style={{ fontWeight: 500 }}>{cat.name}</span>
                        </TableCell>
                        <TableCell className="bg-white group-hover:bg-[#F0F7FF]">
                          <p className="text-sm text-slate-700 truncate" style={{ fontWeight: 400 }}>{cat.description}</p>
                        </TableCell>
                        <TableCell className="bg-white group-hover:bg-[#F0F7FF]">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] border" style={{ fontWeight: 600, backgroundColor: stc.bg, color: stc.text, borderColor: stc.border }}>{cat.status}</span>
                        </TableCell>
                        {catModalView === "added" && (
                          <TableCell className="sticky right-0 z-10 bg-white group-hover:bg-[#F0F7FF] !px-0" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }} onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center">
                              <button onClick={() => handleRemoveCategory(cat.id)} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer" title="Remove">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-2.5 border-t border-border gap-3 shrink-0 bg-white">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled><ChevronsLeft className="w-3.5 h-3.5" /></Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-[13px] text-muted-foreground" disabled><ChevronLeft className="w-3 h-3" />Prev</Button>
              <Button variant="default" size="sm" className="h-7 w-7 p-0 text-[13px] bg-primary text-primary-foreground">1</Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-[13px] text-muted-foreground" disabled>Next<ChevronRight className="w-3 h-3" /></Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled><ChevronsRight className="w-3.5 h-3.5" /></Button>
            </div>
          </div>

          {/* Footer — same as items modal */}
          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-5 py-2.5 flex items-center justify-between sm:rounded-b-2xl">
            <div className="flex items-center gap-2 text-[12px] text-slate-500">
              <span style={{ fontWeight: 500 }}>{allCats.length} categories added</span>
              {catModalView === "browse" && catModalSelectedIds.size > 0 && (<><span className="text-slate-300">·</span><span className="text-primary" style={{ fontWeight: 600 }}>{catModalSelectedIds.size} ready to add</span></>)}
              {catModalView === "added" && catModalAddedSelectedIds.size > 0 && (<><span className="text-slate-300">·</span><span className="text-destructive" style={{ fontWeight: 600 }}>{catModalAddedSelectedIds.size} selected</span></>)}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setCatModalOpen(false)} className="rounded-lg px-4 text-xs h-9 bg-white border-border text-slate-500 hover:bg-slate-50 hover:text-foreground">Cancel</Button>
              {catModalView === "added" && catModalAddedSelectedIds.size > 0 && (
                <Button onClick={() => setCatRemoveConfirmOpen(true)} className="gap-1.5 rounded-lg px-4 text-xs h-9 bg-destructive text-white hover:bg-[#B91C1C] shadow-sm">
                  <Trash2 className="w-3.5 h-3.5" /> Remove {catModalAddedSelectedIds.size} Categor{catModalAddedSelectedIds.size !== 1 ? "ies" : "y"}
                </Button>
              )}
              {catModalView === "added" && catModalAddedSelectedIds.size === 0 && (
                <Button onClick={() => setCatModalOpen(false)} className="rounded-lg px-4 text-xs h-9 bg-primary text-white hover:bg-[#0862D0] shadow-sm">Done</Button>
              )}
              {catModalView === "browse" && (
                <Button onClick={handleAddCategories} disabled={catModalSelectedIds.size === 0} className="gap-1.5 rounded-lg px-4 text-xs h-9 bg-primary text-white hover:bg-[#0862D0] shadow-sm disabled:opacity-50">
                  <Plus className="w-3.5 h-3.5" /> Add {catModalSelectedIds.size > 0 ? `${catModalSelectedIds.size} Categor${catModalSelectedIds.size !== 1 ? "ies" : "y"}` : "Categories"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk remove categories confirmation */}
      <AlertDialog open={catRemoveConfirmOpen} onOpenChange={setCatRemoveConfirmOpen}>
        <AlertDialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] z-[12240]" overlayClassName="z-[12235]" onInteractOutside={() => setCatRemoveConfirmOpen(false)}>
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <Trash2 className="w-8 h-8" style={{ color: "var(--destructive)" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Remove Categories</span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "var(--foreground)" }}>Remove {catModalAddedSelectedIds.size} categor{catModalAddedSelectedIds.size !== 1 ? "ies" : "y"}?</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "var(--muted-foreground)", lineHeight: "1.65" }}>
              These categories will be removed from this pricing rule. You can add them back later.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction onClick={handleBulkRemoveCategories} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90" style={{ fontWeight: 600, backgroundColor: "var(--destructive)", color: "#fff" }}>
                Remove {catModalAddedSelectedIds.size} Categor{catModalAddedSelectedIds.size !== 1 ? "ies" : "y"}
              </AlertDialogAction>
              <AlertDialogCancel className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "var(--muted)", color: "#334155" }}>Cancel</AlertDialogCancel>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single category remove confirmation */}
      <AlertDialog open={!!catRemoveSingleId} onOpenChange={(o) => { if (!o) setCatRemoveSingleId(null); }}>
        <AlertDialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] z-[12240]" overlayClassName="z-[12235]" onInteractOutside={() => setCatRemoveSingleId(null)}>
          {(() => {
            const c = catRemoveSingleId ? allCats.find((cat) => cat.id === catRemoveSingleId) : null;
            return (
              <>
                <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
                  <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
                    <AlertTriangle className="w-8 h-8" style={{ color: "var(--destructive)" }} />
                  </div>
                  <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Caution</span>
                </div>
                <div className="flex flex-col items-center text-center px-8 pb-8">
                  <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                    <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "var(--foreground)" }}>Remove this category?</AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "var(--muted-foreground)", lineHeight: "1.65" }}>
                    {c && <><span style={{ fontWeight: 600, color: "#1E293B" }}>{c.code} — {c.name}</span>{" "}will be removed from this pricing rule.</>}
                  </AlertDialogDescription>
                  <div className="w-full mt-7 flex flex-col gap-2.5">
                    <AlertDialogAction onClick={() => catRemoveSingleId && handleRemoveCategory(catRemoveSingleId)} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90" style={{ fontWeight: 600, backgroundColor: "var(--destructive)", color: "#fff" }}>Remove Category</AlertDialogAction>
                    <AlertDialogCancel className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "var(--muted)", color: "#334155" }}>Cancel</AlertDialogCancel>
                  </div>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Add/Manage Partner Modal ─── */}
      {(() => {
        const pmSearch = partnerModalView === "browse" ? partnerModalSearch : partnerModalAddedSearch;
        const setPmSearch = partnerModalView === "browse" ? setPartnerModalSearch : setPartnerModalAddedSearch;
        const pmQ = pmSearch.toLowerCase();
        const pmBrowseList = pmQ ? availablePartnerVendors.filter((v) => v.displayName?.toLowerCase().includes(pmQ) || v.companyName?.toLowerCase().includes(pmQ) || v.country?.toLowerCase().includes(pmQ)) : availablePartnerVendors;
        const pmAddedList = pmQ ? assignedVendors.filter((v) => v.displayName?.toLowerCase().includes(pmQ) || v.companyName?.toLowerCase().includes(pmQ) || v.country?.toLowerCase().includes(pmQ)) : assignedVendors;
        const pmList = partnerModalView === "browse" ? pmBrowseList : pmAddedList;
        const pmSelSet = partnerModalView === "browse" ? partnerModalSelectedIds : partnerModalAddedSelectedIds;
        const pmSetSel = partnerModalView === "browse" ? setPartnerModalSelectedIds : setPartnerModalAddedSelectedIds;
        const ST_PM: Record<string, { bg: string; text: string; border: string }> = { "active": { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" }, "inactive": { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" }, "archived": { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" } };

        return (
        <Dialog open={partnerModalOpen} onOpenChange={setPartnerModalOpen}>
          <DialogContent
            className="flex flex-col p-0 gap-0 border-0 sm:border z-[12230] !fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full !max-w-[100%] sm:!max-w-[960px] lg:!max-w-[1040px] !max-h-[100dvh] sm:!max-h-[88vh] rounded-none sm:!rounded-2xl transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            hideCloseButton
            overlayClassName="z-[12225]"
            style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
          >
            <DialogTitle className="sr-only">Manage Partners</DialogTitle>
            <DialogDescription className="sr-only">Add or remove partners for this pricing rule.</DialogDescription>

            {/* Header */}
            <div className="px-3 sm:px-5 pt-3 sm:pt-4 pb-2.5 sm:pb-3 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>Manage Partners</h2>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border whitespace-nowrap shrink-0" style={{ fontWeight: 600, backgroundColor: isDis ? "#ECFDF5" : "#F5F3FF", color: isDis ? "#047857" : "#6D28D9", borderColor: isDis ? "#A7F3D0" : "#DDD6FE" }}>
                      {isDis ? "Discount" : "Premium"}<span className="text-[10px] opacity-60">·</span>{rule.name}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-1" style={{ fontWeight: 400 }}>Browse partners to add, or manage already assigned ones.</p>
                </div>
                <button onClick={() => setPartnerModalOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search + View tabs + Pills */}
            <div className="px-3 sm:px-5 pt-2 bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                  <input type="text" value={pmSearch} onChange={(e) => setPmSearch(e.target.value)} placeholder={partnerModalView === "browse" ? "Search available partners..." : "Search assigned partners..."} className="w-full pl-9 pr-8 h-8 text-[13px] bg-white border border-border/80 rounded-lg shadow-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors placeholder:text-muted-foreground/50" />
                  {pmSearch && (
                    <button onClick={() => setPmSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                  )}
                </div>
                <div className="inline-flex items-center rounded-lg bg-muted p-0.5 shrink-0">
                  <button onClick={() => setPartnerModalView("browse")} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] transition-all cursor-pointer ${partnerModalView === "browse" ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-foreground" : "text-slate-500 hover:text-slate-700"}`} style={{ fontWeight: partnerModalView === "browse" ? 600 : 500 }}>
                    <Users className={`w-3.5 h-3.5 ${partnerModalView === "browse" ? "text-primary" : "text-slate-400"}`} />
                    Browse Partners
                    <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[16px] text-center ${partnerModalView === "browse" ? "bg-accent text-primary" : "bg-border text-slate-500"}`} style={{ fontWeight: 600 }}>{availablePartnerVendors.length}</span>
                  </button>
                  <button onClick={() => setPartnerModalView("added")} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] transition-all cursor-pointer ${partnerModalView === "added" ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-foreground" : "text-slate-500 hover:text-slate-700"}`} style={{ fontWeight: partnerModalView === "added" ? 600 : 500 }}>
                    <Check className={`w-3.5 h-3.5 ${partnerModalView === "added" ? "text-success" : "text-slate-400"}`} />
                    Assigned Partners
                    <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[16px] text-center ${partnerModalView === "added" ? "bg-emerald-50 text-success" : "bg-border text-slate-500"}`} style={{ fontWeight: 600 }}>{assignedVendors.length}</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 ml-auto shrink-0">
                  {partnerModalView === "browse" && partnerModalSelectedIds.size > 0 && (<span className="text-xs text-primary shrink-0" style={{ fontWeight: 600 }}>{partnerModalSelectedIds.size} selected</span>)}
                  <span className="text-xs text-muted-foreground shrink-0" style={{ fontWeight: 500 }}>{pmList.length} {partnerModalView === "browse" ? "available" : "partners"}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 pb-2.5">
                {(["all", "active", "inactive"] as const).map((f) => {
                  const cnt = f === "all" ? pmList.length : pmList.filter((v) => (v.status?.toLowerCase() ?? "") === f).length;
                  return (
                    <button key={f} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${f === "all" ? "border-primary bg-accent hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"}`} style={{ fontWeight: f === "all" ? 500 : 400, color: f === "all" ? "var(--primary)" : undefined }}>
                      {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                      <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${f === "all" ? "bg-primary/10" : "bg-muted"}`} style={{ fontWeight: 600, color: f === "all" ? "var(--primary)" : "var(--muted-foreground)" }}>{cnt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 min-h-0 overflow-auto bg-white">
              <Table style={{ tableLayout: "fixed", minWidth: partnerModalView === "added" ? 920 : 860 }}>
                <TableHeader className="sticky top-0 z-20 bg-white">
                  <TableRow className="bg-[#FAFBFC] hover:bg-[#FAFBFC] [&>th]:h-8">
                    <TableHead className="sticky left-0 z-20 bg-[#FAFBFC] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0">
                      {(() => {
                        const allSel = pmList.length > 0 && pmList.every((v) => pmSelSet.has(v.id));
                        const someSel = pmList.some((v) => pmSelSet.has(v.id));
                        return (<Checkbox checked={allSel ? true : someSel ? "indeterminate" : false} onCheckedChange={() => { pmSetSel((prev) => { const n = new Set(prev); pmList.forEach((v) => allSel ? n.delete(v.id) : n.add(v.id)); return n; }); }} />);
                      })()}
                    </TableHead>
                    <TableHead className="text-[13px] text-foreground !pl-3" style={{ fontWeight: 600, width: 240 }}>Partner</TableHead>
                    <TableHead className="text-[13px] text-foreground !pl-3" style={{ fontWeight: 600, width: 140 }}>Type</TableHead>
                    <TableHead className="text-[13px] text-foreground !pl-3" style={{ fontWeight: 600, width: 150 }}>Country</TableHead>
                    <TableHead className="text-[13px] text-foreground !pl-3 text-right" style={{ fontWeight: 600, width: 130 }}>Credit Limit</TableHead>
                    <TableHead className="text-[13px] text-foreground !pl-3" style={{ fontWeight: 600, width: 100 }}>Status</TableHead>
                    {partnerModalView === "added" && (
                      <TableHead className="sticky right-0 z-20 bg-[#FAFBFC] w-[60px] min-w-[60px] max-w-[60px] !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }} />
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pmList.length === 0 ? (
                    <TableRow><TableCell colSpan={partnerModalView === "added" ? 7 : 6} className="text-center py-16 text-muted-foreground"><div className="flex flex-col items-center gap-2"><Users className="w-8 h-8" /><p className="text-sm">{partnerModalView === "browse" ? "No partners available" : "No partners assigned"}</p></div></TableCell></TableRow>
                  ) : (
                    pmList.slice(0, 20).map((v) => {
                      const isSelected = pmSelSet.has(v.id);
                      const tint = getAvatarTint(v.displayName || v.companyName);
                      const ini = (v.displayName || v.companyName).split(/[\s&]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
                      const pt = v.partnerTypes || [];
                      const stp = ST_PM[v.status] || ST_PM["active"];
                      const fmtC = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
                      return (
                        <TableRow key={v.id} className={`cursor-pointer group bg-white hover:bg-[#F0F7FF] [&>td]:py-1 [&>td]:pl-3 [&>td]:pr-2 ${isSelected ? "!bg-accent/30" : ""}`} onClick={() => pmSetSel((p) => { const n = new Set(p); n.has(v.id) ? n.delete(v.id) : n.add(v.id); return n; })}>
                          <TableCell className="sticky left-0 z-10 bg-white group-hover:bg-[#F0F7FF] !pl-2 !pr-0" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={isSelected} onCheckedChange={() => pmSetSel((p) => { const n = new Set(p); n.has(v.id) ? n.delete(v.id) : n.add(v.id); return n; })} />
                          </TableCell>
                          <TableCell className="bg-white group-hover:bg-[#F0F7FF]">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] shrink-0 border" style={{ backgroundColor: tint.bg, color: tint.fg, borderColor: `${tint.fg}20`, fontWeight: 700 }}>{ini}</div>
                              <span className="text-sm truncate block max-w-[170px]" style={{ fontWeight: 500, color: '#1E293B' }}>{v.displayName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="bg-white group-hover:bg-[#F0F7FF]">
                            <div className="flex items-center gap-1.5">
                              {pt.map((type) => (<span key={type} className="inline-flex items-center px-2 py-0.5 text-xs rounded-md border" style={{ fontWeight: 500, backgroundColor: type === "vendor" ? "#EFF6FF" : "#F5F3FF", color: type === "vendor" ? "#1E40AF" : "#5B21B6", borderColor: type === "vendor" ? "#BFDBFE" : "#DDD6FE" }}>{type === "vendor" ? "Vendor" : "Customer"}</span>))}
                            </div>
                          </TableCell>
                          <TableCell className="bg-white group-hover:bg-[#F0F7FF]">
                            <div className="flex items-center gap-2"><span className="text-base">{v.countryFlag}</span><span className="text-sm">{v.country}</span></div>
                          </TableCell>
                          <TableCell className="bg-white group-hover:bg-[#F0F7FF] text-right">
                            <span className="text-sm">$ {fmtC(v.creditLimit)}</span>
                          </TableCell>
                          <TableCell className="bg-white group-hover:bg-[#F0F7FF]">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] border" style={{ fontWeight: 600, backgroundColor: stp.bg, color: stp.text, borderColor: stp.border }}>{v.status.charAt(0).toUpperCase() + v.status.slice(1)}</span>
                          </TableCell>
                          {partnerModalView === "added" && (
                            <TableCell className="sticky right-0 z-10 bg-white group-hover:bg-[#F0F7FF] !px-0" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }} onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center"><button onClick={() => handleRemovePartner(v.id)} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button></div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center px-4 py-2.5 border-t border-border shrink-0 bg-white">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled><ChevronsLeft className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-[13px] text-muted-foreground" disabled><ChevronLeft className="w-3 h-3" />Prev</Button>
                <Button variant="default" size="sm" className="h-7 w-7 p-0 text-[13px] bg-primary text-primary-foreground">1</Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-[13px] text-muted-foreground" disabled>Next<ChevronRight className="w-3 h-3" /></Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled><ChevronsRight className="w-3.5 h-3.5" /></Button>
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-5 py-2.5 flex items-center justify-between sm:rounded-b-2xl">
              <div className="flex items-center gap-2 text-[12px] text-slate-500">
                <span style={{ fontWeight: 500 }}>{assignedVendors.length} partners assigned</span>
                {partnerModalView === "browse" && partnerModalSelectedIds.size > 0 && (<><span className="text-slate-300">·</span><span className="text-primary" style={{ fontWeight: 600 }}>{partnerModalSelectedIds.size} ready to add</span></>)}
                {partnerModalView === "added" && partnerModalAddedSelectedIds.size > 0 && (<><span className="text-slate-300">·</span><span className="text-destructive" style={{ fontWeight: 600 }}>{partnerModalAddedSelectedIds.size} selected</span></>)}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setPartnerModalOpen(false)} className="rounded-lg px-4 text-xs h-9 bg-white border-border text-slate-500 hover:bg-slate-50 hover:text-foreground">Cancel</Button>
                {partnerModalView === "added" && partnerModalAddedSelectedIds.size > 0 && (
                  <Button onClick={() => setPartnerRemoveConfirmOpen(true)} className="gap-1.5 rounded-lg px-4 text-xs h-9 bg-destructive text-white hover:bg-[#B91C1C] shadow-sm"><Trash2 className="w-3.5 h-3.5" /> Remove {partnerModalAddedSelectedIds.size} Partner{partnerModalAddedSelectedIds.size !== 1 ? "s" : ""}</Button>
                )}
                {partnerModalView === "added" && partnerModalAddedSelectedIds.size === 0 && (
                  <Button onClick={() => setPartnerModalOpen(false)} className="rounded-lg px-4 text-xs h-9 bg-primary text-white hover:bg-[#0862D0] shadow-sm">Done</Button>
                )}
                {partnerModalView === "browse" && (
                  <Button onClick={handleAddPartners} disabled={partnerModalSelectedIds.size === 0} className="gap-1.5 rounded-lg px-4 text-xs h-9 bg-primary text-white hover:bg-[#0862D0] shadow-sm disabled:opacity-50"><Plus className="w-3.5 h-3.5" /> Add {partnerModalSelectedIds.size > 0 ? `${partnerModalSelectedIds.size} Partner${partnerModalSelectedIds.size !== 1 ? "s" : ""}` : "Partners"}</Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
        );
      })()}

      {/* Bulk remove partners confirmation */}
      <AlertDialog open={partnerRemoveConfirmOpen} onOpenChange={setPartnerRemoveConfirmOpen}>
        <AlertDialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] z-[12240]" overlayClassName="z-[12235]" onInteractOutside={() => setPartnerRemoveConfirmOpen(false)}>
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}><Trash2 className="w-8 h-8" style={{ color: "var(--destructive)" }} /></div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Remove Partners</span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center"><AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "var(--foreground)" }}>Remove {partnerModalAddedSelectedIds.size} partner{partnerModalAddedSelectedIds.size !== 1 ? "s" : ""}?</AlertDialogTitle></AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "var(--muted-foreground)", lineHeight: "1.65" }}>These partners will be removed from this pricing rule. You can add them back later.</AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction onClick={handleBulkRemovePartners} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90" style={{ fontWeight: 600, backgroundColor: "var(--destructive)", color: "#fff" }}>Remove {partnerModalAddedSelectedIds.size} Partner{partnerModalAddedSelectedIds.size !== 1 ? "s" : ""}</AlertDialogAction>
              <AlertDialogCancel className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "var(--muted)", color: "#334155" }}>Cancel</AlertDialogCancel>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single partner remove confirmation */}
      <AlertDialog open={!!partnerRemoveSingleId} onOpenChange={(o) => { if (!o) setPartnerRemoveSingleId(null); }}>
        <AlertDialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] z-[12240]" overlayClassName="z-[12235]" onInteractOutside={() => setPartnerRemoveSingleId(null)}>
          {(() => {
            const pv = partnerRemoveSingleId ? ctxVendors.find((v) => v.id === partnerRemoveSingleId) : null;
            return (
              <>
                <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
                  <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}><AlertTriangle className="w-8 h-8" style={{ color: "var(--destructive)" }} /></div>
                  <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Caution</span>
                </div>
                <div className="flex flex-col items-center text-center px-8 pb-8">
                  <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center"><AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "var(--foreground)" }}>Remove this partner?</AlertDialogTitle></AlertDialogHeader>
                  <AlertDialogDescription className="text-[13px] mt-2 max-w-[300px] mx-auto" style={{ color: "var(--muted-foreground)", lineHeight: "1.65" }}>
                    {pv && <><span style={{ fontWeight: 600, color: "#1E293B" }}>{pv.displayName}</span> will be removed from this pricing rule.</>}
                  </AlertDialogDescription>
                  <div className="w-full mt-7 flex flex-col gap-2.5">
                    <AlertDialogAction onClick={() => partnerRemoveSingleId && handleRemovePartner(partnerRemoveSingleId)} className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90" style={{ fontWeight: 600, backgroundColor: "var(--destructive)", color: "#fff" }}>Remove Partner</AlertDialogAction>
                    <AlertDialogCancel className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "var(--muted)", color: "#334155" }}>Cancel</AlertDialogCancel>
                  </div>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive confirmation — canonical red palette */}
      <AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <AlertDialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] z-[12240]" overlayClassName="z-[12235]" onInteractOutside={() => setArchiveConfirmOpen(false)}>
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: "#EF4444" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <Archive className="w-8 h-8" style={{ color: "var(--destructive)" }} />
            </div>
            <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: "#FEF2F2", color: "#991B1B", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Archive</span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "var(--foreground)" }}>Archive {rule.name}?</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription className="text-[13px] mt-2 max-w-[340px] mx-auto" style={{ color: "var(--muted-foreground)", lineHeight: "1.65" }}>
              This pricing rule is removed from active lists and stops applying to partner transactions. Existing transactions are unaffected and the rule can be restored from the archive at any time.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <AlertDialogAction
                onClick={() => {
                  setPrStatus(rule.id, "archived");
                  setArchiveConfirmOpen(false);
                  toast.success(`${rule.name} archived.`);
                  onClose();
                }}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: "var(--destructive)", color: "#fff" }}
              >
                Archive rule
              </AlertDialogAction>
              <AlertDialogCancel className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors" style={{ fontWeight: 500, backgroundColor: "var(--muted)", color: "#334155" }}>Keep active</AlertDialogCancel>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate confirmation — same canonical ConfirmationModal as the
          card kebab Deactivate so the verb, copy, and chrome stay aligned. */}
      <ConfirmationModal
        isOpen={disableConfirmOpen}
        title={`Deactivate ${rule.name}?`}
        message="The rule will stop applying to this customer's orders. Existing line-item assignments stay in place, just greyed out — you can reactivate it any time."
        confirmText="Deactivate rule"
        cancelText="Keep active"
        variant="yellow"
        icon={<CircleSlash />}
        // 12400 = above the Detail modal (12231) since this confirm opens
        // from the Detail modal's "Deactivate" header trigger.
        zIndex={12400}
        onConfirm={() => {
          setPrStatus(rule.id, "inactive");
          setDisableConfirmOpen(false);
          if (onDisable) onDisable(rule);
          toast.success(`${rule.name} deactivated.`);
          onClose();
        }}
        onCancel={() => setDisableConfirmOpen(false)}
      />
    </Dialog>
  );
}

// ──────────────────────────────────────────────
// Helper: Convert PricingRulePreset → PricingRule for DetailModal
// ──────────────────────────────────────────────
export function presetToPricingRule(preset: PricingRulePreset & { vendorsApplied?: number; tierType?: "single" | "multiple"; validityPeriod?: string; warningText?: string }): PricingRule {
  const rng = seededRng(preset.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 1000);
  const ic = Math.floor(rng() * 12) + 3;
  const cc = Math.floor(rng() * 6) + 10;
  const pc = preset.vendorsApplied || Math.floor(rng() * 6) + 1;
  // Parse the preset's validityPeriod (e.g. "Jan 2026 – Apr 2026") into
  // validFrom/validTo so the detail modal's Validity section renders
  // real dates instead of the legacy 2025 placeholders.
  let validFrom = "Jan 01, 2025";
  let validTo = "Dec 31, 2025";
  let hasDateLimit = false;
  if (preset.validityPeriod) {
    const parts = preset.validityPeriod.split(/[–-]/).map((p) => p.trim());
    if (parts.length === 2) {
      validFrom = parts[0];
      validTo = parts[1];
      hasDateLimit = true;
    }
  }
  return {
    id: preset.id,
    ruleNo: `PRE-${(preset.id.split("-")[1] || "0").padStart(3, "0")}`,
    name: preset.name,
    category: (preset.category === "all" ? "discount" : preset.category) as "discount" | "premium",
    basis: preset.basis,
    tierType: preset.tierType,
    totalTiers: preset.totalTiers,
    description: preset.description,
    aboutText: preset.aboutText || preset.description,
    status: "Active",
    scope: "both",
    validFrom,
    validTo,
    hasDateLimit,
    durationDays: 365,
    itemCount: ic,
    categoryCount: cc,
    partnerCount: pc,
    tiers: preset.tiers.map(t => ({ minQty: t.minValue, maxQty: t.maxValue, discount: t.discount })),
    createdBy: preset.id.startsWith("pr-custom-") ? "Ahtisham Ahmad" : "Omnesoft",
    createdDate: "Mar 01, 2025",
    isPreset: !preset.id.startsWith("pr-custom-"),
    items: genItems(rng, ic),
    categories: genCategories(rng, cc),
    partners: genPartners(rng, pc),
  };
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────

type SubTab = "vendor" | "customer";
type CategoryView = "discount" | "premium";
type QuickFilter = "all" | "preset" | "custom" | "active" | "inactive";

const QUICK_FILTER_DEFS: { key: QuickFilter; label: string; showCount: boolean }[] = [
  { key: "all", label: "All", showCount: true },
  { key: "preset", label: "Template", showCount: true },
  { key: "custom", label: "Custom", showCount: true },
  { key: "active", label: "Active", showCount: true },
  { key: "inactive", label: "Inactive", showCount: true },
];

/**
 * SO Pricing Rules Library — modal wrapper over the canonical Partner
 * Pricing Rules tab body. Receives the customer name (rendered in the
 * header) instead of a Vendor object. Internally synthesizes a Vendor-
 * shaped stub so the existing tab logic (which still expects companyName /
 * displayName / country) continues to work without churn.
 */
export interface PricingRulesLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  /** Display name of the customer this SO is for — rendered in the header
   *  ("Acme Co.'s Pricing Rules") and used to seed the demo rule data. */
  customerName: string;
  /** Optional thumbnail color override; defaults to a name-derived tint. */
  customerColor?: string;
  /** Initial selection of rule ids already linked on this order — preserved
   *  across mount so the "N applied" pill reflects state from the caller.
   *  Library will call onApply when a rule is applied/removed. */
  appliedRuleIds?: string[];
  /** Called whenever the user applies a rule from the library to the
   *  current line / order. Mirrors the Partner version's onApply callback. */
  onApply?: (rule: PricingRule) => void;
  /** Host kebab callbacks — fired after the library's confirmation modals
   *  close. They receive the FULL rule because the library's seeded ids
   *  don't match the host's `appliedRules` ids; hosts match by rule.name. */
  onDeactivateRule?: (rule: PricingRule) => void;
  onActivateRule?: (rule: PricingRule) => void;
  onRemoveRule?: (rule: PricingRule) => void;
  /** Optional whitelist of rule names this host module knows about.
   *  When provided, the library hides rules whose name isn't in the
   *  list, so the configurator + summary only see rules that are
   *  actually part of the current SO/Quote module — no orphan Partner
   *  mocks leaking through. Match is case-insensitive. */
  restrictToNames?: string[];
  /** Optional host-provided rules that replace the library's mock
   *  customs. Templates from Partner v5 are still merged in alongside
   *  these so users can still browse + Apply new templates. */
  customRules?: PricingRule[];
  /** Reserved for parity with the legacy library prop signature. Currently
   *  unused — the new library doesn't expose a multi-select "apply all" CTA. */
  currentRules?: unknown;
  itemName?: string;
  currentQuantity?: number;
  currentValue?: number;
  /** When true, the library opens in view-only mode. Apply / Deactivate /
   *  Activate / Remove kebab actions are hidden so a final-stage SO can
   *  still inspect rules without mutating them. */
  readOnly?: boolean;
}

export function PricingRulesLibrary({
  isOpen,
  onClose,
  customerName,
  customerColor,
  appliedRuleIds: initialAppliedIds,
  onApply: onApplyExternal,
  onDeactivateRule,
  onActivateRule,
  onRemoveRule,
  restrictToNames,
  customRules,
  readOnly = false,
}: PricingRulesLibraryProps) {
  // Synthesize a Vendor-shaped stub from the customer name so the
  // downstream Partner tab logic (which still references .companyName,
  // .displayName, .country) continues to work without rewrites.
  const vendor: Vendor = useMemo(
    () => ({ id: `cust-${customerName}`, companyName: customerName, displayName: customerName, country: "USA" }),
    [customerName],
  );
  const cfg: VendorConfigData | undefined = undefined;
  // Modal mode is always "flush" — the tab body fills the modal interior
  // without its own outer border.
  const flush = true;
  // Lock body scroll + Esc to close while the library is open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  /* Data source for the grid: Partner v5 templates merge with the host's
     own custom rules. When `customRules` is provided we discard the
     generator's mock customs (`cust-me-*`, `cust-oth-*`) and use the
     host's rules instead — so the library's "Custom" filter reflects the
     actual quote/SO state instead of fake data. Templates are always
     preserved so users can still browse + Apply new ones. */
  const allRules = useMemo(() => {
    const base = generatePricingRules(vendor, cfg);
    if (!customRules || customRules.length === 0) return base;
    const templates = base.filter((r) => r.isPreset);
    return [...templates, ...customRules];
  }, [vendor, cfg, customRules]);

  // Scope is always "customer" in the SO context — vendor sub-tab is hidden.
  const [subTab] = useState<SubTab>("customer");
  const [categoryView, setCategoryView] = useState<CategoryView>("discount");
  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(20);
  const [selectedRule, setSelectedRule] = useState<PricingRule | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailMode, setDetailMode] = useState<"view" | "create">("view");
  const [appliedRuleIds, setAppliedRuleIds] = useState<Set<string>>(new Set());

  // ── Explore Presets Modal state ──
  const [explorePresetsOpen, setExplorePresetsOpen] = useState(false);
  const [explorePresetsFullscreen, setExplorePresetsFullscreen] = useState(false);
  const [explorePresetsSidebar, setExplorePresetsSidebar] = useState("all");
  const [exploreCategoryTab, setExploreCategoryTab] = useState<"discount" | "premium">("discount");
  const [explorePresetsSearch, setExplorePresetsSearch] = useState("");
  const [exploreActiveTiers, setExploreActiveTiers] = useState<Record<string, number>>({});
  // Sort state — mirrors the canonical creation-form Browse
  // Templates modal so the same Sort popover behavior travels
  // across surfaces. Same option keys (name / vendorsApplied /
  // category / basis), same asc/desc toggle.
  const [exploreSortOpen, setExploreSortOpen] = useState(false);
  const [exploreSortBy, setExploreSortBy] = useState<"name" | "vendorsApplied" | "category" | "basis">("name");
  const [exploreSortDir, setExploreSortDir] = useState<"asc" | "desc">("asc");

  const exploreCards = useMemo<PricingRule[]>(() => {
    const expandedTiers: Record<string, TierData[]> = {
      "pr-3": [
        { minQty: "$ 500", maxQty: "$ 2,300", discount: "5%" },
        { minQty: "$ 2,300", maxQty: "$ 5,000", discount: "10%" },
        { minQty: "$ 5,000", maxQty: "$ 10,000", discount: "15%" },
        { minQty: "$ 10,000", maxQty: "$ 25,000", discount: "20%" },
      ],
      "pr-4": [
        { minQty: "35 EA", maxQty: "100 EA", discount: "5%" },
        { minQty: "100 EA", maxQty: "250 EA", discount: "10%" },
        { minQty: "250 EA", maxQty: "500 EA", discount: "15%" },
        { minQty: "500 EA", maxQty: "1,000 EA", discount: "20%" },
      ],
      "pr-7": [
        { minQty: "$ 0", maxQty: "$ 200", discount: "10%" },
        { minQty: "$ 200", maxQty: "$ 500", discount: "7%" },
        { minQty: "$ 500", maxQty: "$ 1,000", discount: "5%" },
        { minQty: "$ 1,000", maxQty: "$ 5,000", discount: "3%" },
      ],
      "pr-8": [
        { minQty: "1 EA", maxQty: "25 EA", discount: "$50" },
        { minQty: "25 EA", maxQty: "50 EA", discount: "$25" },
        { minQty: "50 EA", maxQty: "100 EA", discount: "$15" },
        { minQty: "100 EA", maxQty: "250 EA", discount: "$10" },
      ],
    };
    const mk = (id: string, ruleNo: string, name: string, cat: "discount"|"premium", basis: "value"|"volume", tierType: "single"|"multiple", tiers: TierData[], desc: string, about: string, preset: boolean, by: string, scope: "vendor"|"customer"|"both"): PricingRule => {
      const seed = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 1000;
      const rng = seededRng(seed);
      const ic = Math.floor(rng() * 12) + 3, cc = Math.floor(rng() * 6) + 10, pc = Math.floor(rng() * 6) + 1;
      return { id, ruleNo, name, category: cat, basis, tierType, totalTiers: tiers.length, description: desc, aboutText: about, status: "Active", scope, validFrom: "Jan 01, 2026", validTo: "Dec 31, 2026", hasDateLimit: false, durationDays: 365, itemCount: ic, categoryCount: cc, partnerCount: pc, tiers, createdBy: by, createdDate: "Mar 01, 2026", isPreset: preset, items: genItems(rng, ic), categories: genCategories(rng, cc), partners: genPartners(rng, pc) };
    };
    const presetRules = PRICING_RULE_PRESETS.map(p => {
      const tiers = expandedTiers[p.id] || p.tiers.map(t => ({ minQty: t.minValue, maxQty: t.maxValue, discount: t.discount }));
      return mk(p.id, `PRE-${(p.id.split("-")[1] || "0").padStart(3, "0")}`, p.name, p.category as "discount" | "premium", p.basis, p.tierType, tiers, p.description, p.aboutText || "", true, "System", "both");
    });
    const byMe: PricingRule[] = [
      mk("cust-me-1", "CUS-001", "Early Payment Discount", "discount", "value", "single", [{ minQty: "$ 5,000", maxQty: "$ 50,000", discount: "8%" }], "8% discount for payments made within 10 days of invoice", "Encourages early payment by offering a percentage discount when partners pay invoices within a specified early window.", false, "Ahtisham Ahmad", "vendor"),
      mk("cust-me-2", "CUS-002", "Rush Order Premium", "premium", "volume", "single", [{ minQty: "1 EA", maxQty: "50 EA", discount: "12%" }], "12% surcharge on expedited orders under 50 units", "Applies a premium surcharge for rush orders requiring expedited processing and shipping for small quantities.", false, "Ahtisham Ahmad", "vendor"),
      mk("cust-me-3", "CUS-003", "Seasonal Volume Discount", "discount", "volume", "multiple", [{ minQty: "100 EA", maxQty: "300 EA", discount: "5%" }, { minQty: "300 EA", maxQty: "750 EA", discount: "10%" }, { minQty: "750 EA", maxQty: "2,000 EA", discount: "18%" }], "Tiered discounts for Q4 seasonal bulk ordering", "A multi-tier seasonal promotion offering increasing discounts at higher volume breakpoints during the Q4 ordering season.", false, "Ahtisham Ahmad", "both"),
    ];
    const byOthers: PricingRule[] = [
      mk("cust-oth-1", "CUS-004", "VIP Client Premium", "premium", "value", "single", [{ minQty: "$ 0", maxQty: "$ 10,000", discount: "15%" }], "15% premium for exclusive VIP-tier partnerships", "A value-based premium applied to VIP client orders, reflecting the enhanced service level and priority handling.", false, "Sarah Chen", "customer"),
      mk("cust-oth-2", "CUS-005", "Loyalty Tier Discount", "discount", "value", "multiple", [{ minQty: "$ 10,000", maxQty: "$ 25,000", discount: "3%" }, { minQty: "$ 25,000", maxQty: "$ 75,000", discount: "7%" }, { minQty: "$ 75,000", maxQty: "$ 200,000", discount: "12%" }], "Progressive discounts based on cumulative order value", "Rewards long-term partners with increasing discounts as their cumulative purchase value crosses defined thresholds.", false, "Marcus Obi", "both"),
      mk("cust-oth-3", "CUS-006", "Small Batch Surcharge", "premium", "volume", "single", [{ minQty: "1 EA", maxQty: "20 EA", discount: "$75" }], "Flat $75 handling fee for orders under 20 units", "Covers additional handling and logistics costs incurred when processing small batch orders below the minimum efficient quantity.", false, "Elena Volkov", "vendor"),
    ];
    return [...presetRules, ...byMe, ...byOthers];
  }, []);

  // ── Create Pricing Rule Modal state ──
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createFullscreen, setCreateFullscreen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createCategory, setCreateCategory] = useState<"discount" | "premium">("discount");
  const [createBasis, setCreateBasis] = useState<PricingRuleBasis>("value");
  const [createLimitDate, setCreateLimitDate] = useState(false);
  const [createValidFrom, setCreateValidFrom] = useState("");
  const [createValidTo, setCreateValidTo] = useState("");
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [createItemsTab, setCreateItemsTab] = useState<"items" | "categories" | "attachments">("items");

  interface CreateTierState {
    discount: string;
    fixRate: boolean;
    qtyLimits: boolean;
    minQty: string;
    maxQty: string;
  }
  const makeTier = (): CreateTierState => ({ discount: "", fixRate: false, qtyLimits: false, minQty: "", maxQty: "" });
  const [createTiers, setCreateTiers] = useState<CreateTierState[]>([makeTier()]);

  function updateTier(idx: number, patch: Partial<CreateTierState>) {
    setCreateTiers(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t));
  }
  function addTier() { setCreateTiers(prev => [...prev, makeTier()]); }
  function removeTier(idx: number) { setCreateTiers(prev => prev.filter((_, i) => i !== idx)); }

  function resetCreateForm() {
    setCreateName(""); setCreateDescription(""); setCreateCategory("discount");
    setCreateBasis("value"); setCreateLimitDate(false); setCreateValidFrom("");
    setCreateValidTo(""); setCreateStep(1); setCreateItemsTab("items");
    setCreateTiers([makeTier()]);
  }
  function handleSaveRule() {
    if (!createName.trim()) return;
    toast.success("Pricing rule created successfully.");
    setCreateModalOpen(false);
    resetCreateForm();
    setCreateFullscreen(false);
  }
  const openDetail = useCallback((rule: PricingRule, openMode: "view" | "create" = "view") => {
    setSelectedRule(rule);
    setDetailMode(openMode);
    setDetailOpen(true);
  }, []);

  const handleEditRule = useCallback((r: PricingRule) => {
    // Prefill create form with rule data
    setCreateName(r.name);
    setCreateDescription(r.description);
    setCreateCategory(r.category);
    setCreateBasis(r.basis);
    setCreateLimitDate(r.hasDateLimit);
    setCreateValidFrom(r.validFrom);
    setCreateValidTo(r.validTo);
    setCreateStep(1);
    setCreateItemsTab("items");
    setCreateTiers(r.tiers.length > 0
      ? r.tiers.map((t) => ({
          discount: t.discount,
          fixRate: t.discount.includes("$"),
          qtyLimits: !!(t.minQty || t.maxQty),
          minQty: t.minQty || "",
          maxQty: t.maxQty || "",
        }))
      : [makeTier()]
    );
    setCreateModalOpen(true);
  }, []);

  /* Local overlays on the seeded rule list — track rules the user has
     removed (so they disappear from the grid + counts) and rules the
     user has deactivated (so their Active pill flips to Inactive without
     mutating the seeded data). Re-applied to allRules to produce the
     view used by every downstream filter/count. */
  const [removedRuleIds, setRemovedRuleIds] = useState<Set<string>>(new Set());
  const [deactivatedRuleIds, setDeactivatedRuleIds] = useState<Set<string>>(new Set());

  // Lowercased whitelist for fast lookup. When the host provides a
  // restrictToNames list, we narrow the CUSTOM rules in the grid to that
  // set — Template rules (Partner-defined kickstarts) always remain
  // browseable so the user can still discover and apply new ones. This
  // keeps the library useful as a browse-and-apply surface while
  // suppressing orphan custom rules from other contexts.
  const restrictToNamesLC = useMemo(
    () => (restrictToNames ? new Set(restrictToNames.map((n) => n.toLowerCase())) : null),
    [restrictToNames],
  );

  const allRulesView = useMemo<PricingRule[]>(() => {
    return allRules
      .filter((r) => !removedRuleIds.has(r.id))
      .filter((r) => {
        if (!restrictToNamesLC) return true;
        // Templates are always visible — the host whitelist only filters
        // custom rules so orphan customs don't leak in from other modules.
        if (r.isPreset) return true;
        return restrictToNamesLC.has(r.name.toLowerCase());
      })
      .map((r) =>
        deactivatedRuleIds.has(r.id) && r.status !== "Inactive"
          ? { ...r, status: "Inactive" as const }
          : r,
      );
  }, [allRules, removedRuleIds, deactivatedRuleIds, restrictToNamesLC]);

  const subTabFiltered = useMemo(() => {
    if (subTab === "vendor") return allRulesView.filter((r) => r.scope === "vendor" || r.scope === "both");
    return allRulesView.filter((r) => r.scope === "customer" || r.scope === "both");
  }, [allRulesView, subTab]);

  // Category-scoped counts (used for the Discount/Premium toggle pills)
  const categoryCounts = useMemo(() => ({
    discount: subTabFiltered.filter((r) => r.category === "discount").length,
    premium: subTabFiltered.filter((r) => r.category === "premium").length,
  }), [subTabFiltered]);

  // The base list after category view is applied
  const categoryFiltered = useMemo(
    () => subTabFiltered.filter((r) => r.category === categoryView),
    [subTabFiltered, categoryView],
  );

  const filterCounts = useMemo(() => ({
    all: categoryFiltered.length,
    preset: categoryFiltered.filter((r) => r.isPreset).length,
    custom: categoryFiltered.filter((r) => !r.isPreset).length,
    active: categoryFiltered.filter((r) => r.status === "Active").length,
    inactive: categoryFiltered.filter((r) => r.status === "Inactive").length,
  }), [categoryFiltered]);

  const filtered = useMemo(() => {
    let list = categoryFiltered;
    if (quickFilter === "preset") list = list.filter((r) => r.isPreset);
    else if (quickFilter === "custom") list = list.filter((r) => !r.isPreset);
    else if (quickFilter === "active") list = list.filter((r) => r.status === "Active");
    else if (quickFilter === "inactive") list = list.filter((r) => r.status === "Inactive");

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.ruleNo.toLowerCase().includes(q));
    }
    // Sort: presets first, then custom; Active before Inactive; then alphabetical
    list = [...list].sort((a, b) => {
      if (a.isPreset !== b.isPreset) return a.isPreset ? -1 : 1;
      if (a.status !== b.status) return a.status === "Active" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [categoryFiltered, quickFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / recordsPerPage));
  const paginated = filtered.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);

  if (!isOpen) return null;

  /* Render the entire Partner Pricing Rules tab body inside a full-viewport
     modal overlay so the library opens centered above the SO line item
     configurator regardless of host stacking context. The inline-styled
     backdrop + flex centering mirrors the SO library's previous shell so
     existing z-index agreements (BaseModal=12000, popovers ≥ 12200) still
     hold. */
  return createPortal(
    <div
      style={{
        position: "fixed", top: 0, right: 0, bottom: 0, left: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 12100, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${customerName}'s Pricing Rules`}
        className="relative bg-white flex flex-col overflow-hidden shadow-2xl rounded-2xl border border-border w-[calc(100%-2rem)] sm:w-[1080px]"
        style={{ height: 'min(88vh, 880px)', minHeight: 560 }}
        onClick={(e) => e.stopPropagation()}
      >
    <div className="bg-card overflow-clip flex flex-col flex-1 min-h-0">
      <PricingRuleDetailModal
        rule={selectedRule}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        mode={detailMode}
        vendor={vendor}
        onApply={(r) => {
          setAppliedRuleIds(prev => new Set(prev).add(r.id));
          setExplorePresetsOpen(false);
          setExplorePresetsFullscreen(false);
          onApplyExternal?.(r);
        }}
        onDuplicate={(r) => toast.info(`Duplicated "${r.name}"`)}
        /* Detail modal's "Deactivate" header trigger pipes back to the
           host so the rule list / summary carousel grey out the row
           immediately — same behavior as the kebab Deactivate on the
           card itself. */
        onDisable={(r) => onDeactivateRule?.(r)}
        onEdit={handleEditRule}
      />

      {/* Header: Customer hero row + Toolbar — replaces the partner-tab's
          Vendor/Customer toggle since the SO context is always customer-side. */}
      <div className="bg-card shrink-0">
        {/* Customer hero row — avatar + "Pricing Rules Active for Customer"
            title + customer name subtitle on the left. Right side keeps
            count + Browse Templates + Create Rule and adds an X close
            button (back arrow / Customer pill intentionally dropped per
            product feedback). */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Customer avatar — tint derived from name. Shows initials so
                the user can confirm at a glance which customer's rules they
                are viewing. */}
            {(() => {
              const tint = getAvatarTint(customerName);
              const initials = customerName
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() ?? "")
                .join("") || "?";
              const bg = customerColor || tint.bg;
              const fg = customerColor ? "#FFFFFF" : tint.fg;
              return (
                <div
                  className="w-9 h-9 rounded-md flex items-center justify-center text-[12px] shrink-0"
                  style={{ backgroundColor: bg, color: fg, fontWeight: 700 }}
                >
                  {initials}
                </div>
              );
            })()}
            <div className="min-w-0">
              <h2 className="text-[14px] text-foreground truncate" style={{ fontWeight: 600 }}>
                Pricing Rules Applied to this Customer
              </h2>
              <p className="text-[12px] text-slate-500 mt-0.5 truncate" style={{ fontWeight: 400 }}>
                Showing pricing rules currently applied to <span className="text-foreground" style={{ fontWeight: 500 }}>{customerName}</span>.
              </p>
            </div>
          </div>

          {/* Right: Count + Templates + Create */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm tabular-nums hidden sm:inline" style={{ fontWeight: 500 }}>
              {filtered.length !== categoryFiltered.length ? (
                <>
                  <span className="text-foreground">{filtered.length}</span>
                  <span className="text-muted-foreground/60"> of </span>
                  <span className="text-muted-foreground">{categoryFiltered.length}</span>
                  <span className="text-muted-foreground/70"> rules</span>
                </>
              ) : (
                <>
                  <span className="text-foreground">{categoryFiltered.length}</span>
                  <span className="text-muted-foreground/70"> rules</span>
                </>
              )}
            </span>

            {appliedRuleIds.size > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full hidden sm:inline-flex" style={{ fontWeight: 600 }}>
                <Check className="w-3 h-3" /> {appliedRuleIds.size} applied
              </span>
            )}

            <div className="w-px h-5 bg-border/60 hidden sm:block" />

            {/* CTAs aligned to the canonical labels used by the
                Configure-Vendor empty state ("Browse Templates" +
                "Create Rule"). Same wording on both surfaces so
                users learn one set of actions. The "Create Another
                Rule" variant only changes when rules are already
                applied — Templates side stays "Browse Templates"
                regardless because the action is identical. */}
            {/* Browse Templates — secondary CTA, plain white +
                slate border to match the canonical pair shown in
                the Configure-Vendor empty state. Sits next to the
                primary "Create Rule" filled button. */}
            <button type="button" onClick={() => { setExplorePresetsOpen(true); setExplorePresetsSidebar("all"); setExploreCategoryTab("discount"); setExplorePresetsSearch(""); }} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-white text-foreground hover:bg-slate-50 hover:border-slate-300 text-[13px] transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Browse Templates</span>
            </button>

            <button
              type="button"
              /* New rule templates are authored in Partner Management.
                 This library only consumes the existing template/custom
                 set and applies rules to the current customer. */
              onClick={() => {
                toast.info("New pricing rule templates are created in the Partner Management module.");
              }}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[13px] shadow-sm transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Create Rule</span>
            </button>

            {/* X close — sits at the far right of the header, the
                canonical position used by every other modal in the app. */}
            <div className="w-px h-5 bg-border/60 hidden sm:block ml-1" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close library"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar row: Search + Filters + Category toggle */}
        <div className="flex items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
            <input
              type="text"
              placeholder="Search pricing rules..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-8 h-9 text-sm bg-white border border-border/80 rounded-lg shadow-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors placeholder:text-muted-foreground/50"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setCurrentPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button type="button" onClick={() => toast.info("Advanced filters coming soon!")} className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg border border-border/80 bg-white shadow-sm hover:bg-muted/50 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 shrink-0 text-foreground">
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm" style={{ fontWeight: 500 }}>Filters</span>
          </button>

          {/* Category toggle — inline with search. Each pill carries a
              hover tooltip explaining the category, mirroring the
              Browse Templates modal + the partner-creation form so
              users get the same explanation everywhere. */}
          <div className="inline-flex items-center rounded-lg bg-slate-50 border border-border/60 p-0.5 shrink-0">
            {([
              {
                key: "discount" as CategoryView,
                label: "Discounts",
                icon: TrendingDown,
                color: "#047857",
                bg: "#ECFDF5",
                tip: "Reduce unit price when quantity or value thresholds are met.",
                example: <><span className="text-green-700" style={{ fontWeight: 600 }}>10% off</span> on orders over 500 units.</>,
              },
              {
                key: "premium" as CategoryView,
                label: "Premiums",
                icon: TrendingUp,
                color: "#6D28D9",
                bg: "#F5F3FF",
                tip: "Markup on base price for express or value-added services.",
                example: <><span className="text-violet" style={{ fontWeight: 600 }}>15% markup</span> for expedited and priority shipping.</>,
              },
            ]).map((cat) => {
              const active = categoryView === cat.key;
              const count = categoryCounts[cat.key];
              return (
                <Tooltip key={cat.key}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { setCategoryView(cat.key); setQuickFilter("all"); setCurrentPage(1); }}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[12px] transition-all cursor-pointer ${
                        active ? "shadow-sm" : "hover:bg-white/60"
                      }`}
                      style={{ fontWeight: active ? 600 : 500, color: active ? cat.color : "#334155", backgroundColor: active ? cat.bg : undefined }}
                    >
                      <cat.icon className="w-3.5 h-3.5" />
                      {cat.label}
                      <span
                        className="text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center"
                        style={{ fontWeight: 600, color: active ? cat.color: "var(--muted-foreground)", backgroundColor: active ? `${cat.color}15` : "var(--border)" }}
                      >
                        {count}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[12300]">
                    <p className="text-slate-500">{cat.tip}</p>
                    <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                      <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>EXAMPLE</p>
                      <p className="text-[11px] text-slate-700 mt-1">{cat.example}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          {categoryView === "premium" && (
            <Tooltip><TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help shrink-0" /></span></TooltipTrigger><TooltipContent side="bottom" className="max-w-[260px]"><p className="text-xs">A premium is an additional charge applied to certain orders — e.g., government customers requiring special handling, rush processing, or exclusive product lines.</p></TooltipContent></Tooltip>
          )}
        </div>
      </div>

      {/* Quick Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 shrink-0">
        <FilterPills
          options={QUICK_FILTER_DEFS.map((f) => ({
            key: f.key,
            label: f.label,
            count: filterCounts[f.key],
            showCount: f.showCount,
          }))}
          activeKey={quickFilter}
          onSelect={(k) => { setQuickFilter(k as QuickFilter); setCurrentPage(1); }}
        />
      </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border shrink-0" />

      {/* Card Grid — single category at a time, grouped by preset/custom */}
      <div className={`p-4 min-h-0 overflow-y-auto flex-1 ${flush ? "bg-slate-50" : ""}`}>
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-[#E8ECF1] flex items-center justify-center">
              <FileText className="w-7 h-7 text-slate-400" />
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>No {categoryView} rules found</p>
              <p className="text-[13px] text-slate-400 mt-1" style={{ fontWeight: 400 }}>
                {searchQuery ? "Try a different search term" : appliedRuleIds.size > 0 ? `No ${categoryView} rules applied yet. Add one from templates or create your own.` : `Create a new ${categoryView} rule or browse templates to get started.`}
              </p>
            </div>
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setCurrentPage(1); }} className="text-xs text-primary hover:text-[#0862D0] cursor-pointer transition-colors" style={{ fontWeight: 500 }}>
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {(() => {
              const presets = paginated.filter((r) => r.isPreset);
              const custom = paginated.filter((r) => !r.isPreset);
              const showSubHeaders = presets.length > 0 && custom.length > 0;
              return (
                <>
                  {presets.length > 0 && (
                    <div>
                      {showSubHeaders && (
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider" style={{ fontWeight: 600 }}>System Presets</span>
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full" style={{ fontWeight: 600 }}>{presets.length}</span>
                          <Tooltip><TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger><TooltipContent side="right" className="max-w-[240px]"><p className="text-xs">Templates show structures, not final values. Pick the one closest to what you need and customize from there.</p></TooltipContent></Tooltip>
                        </div>
                      )}
                      <div className="@container/prpresets">
                      <div className="grid grid-cols-1 @[400px]/prpresets:grid-cols-2 @[750px]/prpresets:grid-cols-3 gap-3">
                        {presets.map((rule) => (
                          <PricingRuleCard
                            key={rule.id}
                            rule={rule}
                            onClick={() => openDetail(rule)}
                            subTab={subTab}
                            partnerName={vendor.companyName}
                            readOnly={readOnly}
                            /* Wrap each kebab callback so the library
                               updates its local view (removedRuleIds /
                               deactivatedRuleIds) AND fires the host
                               callback for the configurator / summary
                               carousel to stay in sync. */
                            onDeactivate={(r) => {
                              setDeactivatedRuleIds((prev) => { const next = new Set(prev); next.add(r.id); return next; });
                              onDeactivateRule?.(r);
                            }}
                            onActivate={(r) => {
                              setDeactivatedRuleIds((prev) => { const next = new Set(prev); next.delete(r.id); return next; });
                              onActivateRule?.(r);
                            }}
                            onRemove={(r) => {
                              setRemovedRuleIds((prev) => { const next = new Set(prev); next.add(r.id); return next; });
                              onRemoveRule?.(r);
                            }}
                            onEditRule={handleEditRule}
                          />
                        ))}
                      </div>
                      </div>
                    </div>
                  )}
                  {custom.length > 0 && (
                    <div>
                      {showSubHeaders && (
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <Pencil className="w-3 h-3 text-slate-400" />
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider" style={{ fontWeight: 600 }}>Custom Rules</span>
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full" style={{ fontWeight: 600 }}>{custom.length}</span>
                        </div>
                      )}
                      <div className="@container/prcustom">
                      <div className="grid grid-cols-1 @[400px]/prcustom:grid-cols-2 @[750px]/prcustom:grid-cols-3 gap-3">
                        {custom.map((rule) => (
                          <PricingRuleCard
                            key={rule.id}
                            rule={rule}
                            onClick={() => openDetail(rule)}
                            subTab={subTab}
                            partnerName={vendor.companyName}
                            readOnly={readOnly}
                            /* Wrap each kebab callback so the library
                               updates its local view (removedRuleIds /
                               deactivatedRuleIds) AND fires the host
                               callback for the configurator / summary
                               carousel to stay in sync. */
                            onDeactivate={(r) => {
                              setDeactivatedRuleIds((prev) => { const next = new Set(prev); next.add(r.id); return next; });
                              onDeactivateRule?.(r);
                            }}
                            onActivate={(r) => {
                              setDeactivatedRuleIds((prev) => { const next = new Set(prev); next.delete(r.id); return next; });
                              onActivateRule?.(r);
                            }}
                            onRemove={(r) => {
                              setRemovedRuleIds((prev) => { const next = new Set(prev); next.add(r.id); return next; });
                              onRemoveRule?.(r);
                            }}
                            onEditRule={handleEditRule}
                          />
                        ))}
                      </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="border-t border-border shrink-0" />
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 shrink-0 bg-white">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden sm:inline" style={{ fontWeight: 500 }}>Records per page</span>
          <select value={recordsPerPage} onChange={(e) => { setRecordsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="h-8 px-2 pr-7 rounded-lg border border-border bg-white text-sm text-foreground cursor-pointer outline-none focus:border-primary focus:ring-1 focus:ring-primary/20">
            {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1.5 rounded-lg hover:bg-muted/60 disabled:opacity-30 text-muted-foreground cursor-pointer disabled:cursor-default transition-colors">
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-muted/60 disabled:opacity-30 text-muted-foreground text-xs cursor-pointer disabled:cursor-default transition-colors" style={{ fontWeight: 500 }}>
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </button>
          {(() => {
            const pages: (number | "...")[] = [];
            if (totalPages <= 5) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
            else {
              pages.push(1);
              if (currentPage > 3) pages.push("...");
              for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
              if (currentPage < totalPages - 2) pages.push("...");
              pages.push(totalPages);
            }
            return pages.map((p, idx) =>
              p === "..." ? <span key={`d-${idx}`} className="px-1 text-muted-foreground text-xs">...</span> : (
                <button key={p} onClick={() => setCurrentPage(p as number)} className={`min-w-[32px] h-8 rounded-lg text-xs transition-colors cursor-pointer ${currentPage === p ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-muted/60"}`} style={{ fontWeight: currentPage === p ? 600 : 500 }}>{p}</button>
              ));
          })()}
          <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-muted/60 disabled:opacity-30 text-muted-foreground text-xs cursor-pointer disabled:cursor-default transition-colors" style={{ fontWeight: 500 }}>
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded-lg hover:bg-muted/60 disabled:opacity-30 text-muted-foreground cursor-pointer disabled:cursor-default transition-colors">
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Create New Pricing Rule Modal ── */}
      <Dialog open={createModalOpen} onOpenChange={(v) => { setCreateModalOpen(v); if (!v) { setCreateFullscreen(false); setCreateStep(1); } }}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden !z-[12201] flex flex-col border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)]"
          overlayClassName="!z-[12200]"
          /* Inset:0 + margin:auto centering — bulletproof against shadcn's
             animation transforms (zoom-in-95 etc.) which can override an
             explicit `transform: translate(-50%, -50%)`. */
          style={createFullscreen
            ? {
                position: "fixed",
            top: "50%",
            left: "50%",
            right: "auto",
            bottom: "auto",
            transform: "translate(-50%, -50%)",
            translate: "none",
            margin: 0,
                width: "calc(100% - 1rem)",
                height: "calc(100dvh - 1rem)",
                maxWidth: "calc(100% - 1rem)",
                maxHeight: "calc(100dvh - 1rem)",
                borderRadius: 16,
              }
            : {
                position: "fixed",
            top: "50%",
            left: "50%",
            right: "auto",
            bottom: "auto",
            transform: "translate(-50%, -50%)",
            translate: "none",
            margin: 0,
                width: "min(65vw, 960px)",
                maxWidth: "calc(100% - 2rem)",
                height: "fit-content",
                maxHeight: "calc(100vh - 2rem)",
                borderRadius: 16,
              }
          }
          hideCloseButton
        >
          <DialogTitle className="sr-only">Create New Pricing Rule</DialogTitle>
          <DialogDescription className="sr-only">Build a new pricing rule for this partner — pick the type, set tiers, and attach items.</DialogDescription>

          {/* Header — matches the canonical creation-form Create
              New Pricing Rule modal so the wizard frame is byte-
              for-byte the same on every surface (partner creation,
              partner group creation, partner detail). */}
          <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-0 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
            {/* Title row */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>Create New Pricing Rule</h2>
                  <span className="hidden sm:inline-flex items-center px-1.5 py-[3px] rounded-md border border-slate-300 bg-white text-[9px] text-muted-foreground" style={{ fontWeight: 600 }}>CUSTOM</span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                  Configure the type, tiers, and assign items for the new rule.
                </p>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <button
                  onClick={() => setCreateFullscreen(!createFullscreen)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  {createFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {createFullscreen ? "Exit full" : "Full view"}
                </button>
                <button
                  onClick={() => { setCreateModalOpen(false); setCreateFullscreen(false); resetCreateForm(); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* Step tabs */}
            <div className="flex items-center gap-4 sm:gap-6 mt-3 sm:mt-3.5 overflow-x-auto -mb-px">
              {[
                { num: 1 as const, label: "Rule Setup", shortLabel: "Setup", active: createStep === 1, completed: createStep === 2 },
                { num: 2 as const, label: "Items & Attachments", shortLabel: "Items", active: createStep === 2, completed: false },
              ].map((tab) => (
                <div
                  key={tab.num}
                  className={`relative flex items-center gap-2 pb-2.5 sm:pb-3 ${
                    tab.num < createStep || (tab.num === 2 && createStep === 1 && createName.trim()) ? "cursor-pointer" : "cursor-default"
                  }`}
                  onClick={() => {
                    if (tab.num < createStep) setCreateStep(tab.num);
                    if (tab.num === 2 && createStep === 1 && createName.trim()) setCreateStep(2);
                  }}
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
          <div className="flex-1 min-h-0 overflow-y-auto bg-[#FAFBFC] scrollbar-hide">
            <div className="px-4 py-4 transition-all duration-300 ease-out">

              {/* ─── Step 1: Rule Setup ─── */}
              {createStep === 1 && (() => {
                // Start-from-a-template applier — clones a preset
                // into the create form so the user can edit before
                // saving, exactly like the canonical creation-form
                // pattern. Original templates are never modified.
                const suggestedTemplates = [...PRICING_RULE_PRESETS]
                  .sort((a, b) => b.vendorsApplied - a.vendorsApplied)
                  .slice(0, 4);
                const applyPricingTemplate = (tpl: PricingRulePreset) => {
                  setCreateName(`Copy of ${tpl.name}`);
                  setCreateDescription(tpl.description);
                  setCreateCategory(tpl.category === "all" ? "discount" : tpl.category);
                  setCreateBasis(tpl.basis);
                  const parseNum = (s: string) => (s || "").replace(/[^0-9.]/g, "");
                  const parsedTiers = (tpl.tiers || []).map((t) => ({
                    discount: parseNum(t.discount),
                    fixRate: false,
                    qtyLimits: Boolean(t.minValue || t.maxValue),
                    minQty: parseNum(t.minValue || ""),
                    maxQty: parseNum(t.maxValue || ""),
                  }));
                  setCreateTiers(parsedTiers.length > 0 ? parsedTiers : [{ discount: "", fixRate: false, qtyLimits: false, minQty: "", maxQty: "" }]);
                  toast.success("Template duplicated as a new custom rule. Edit any field before saving; the original template stays unchanged.");
                };
                return (
                <div className="space-y-5">
                  {/* Start-from-template suggestion row — same
                      pattern as the canonical creation-form modal.
                      Click a card to clone the preset's data into
                      the form, or "See all" to open Browse Templates. */}
                  <div className="rounded-xl border border-dashed border-[#DBE4F0] bg-gradient-to-br from-[#F8FBFF] to-white p-3.5">
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                          <Sparkles className="w-3 h-3 text-primary" />
                        </div>
                        <div>
                          <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Start from a template</p>
                          <p className="text-[10.5px] text-slate-400" style={{ fontWeight: 400 }}>Duplicates the template as a new custom rule. Originals are never modified.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setCreateModalOpen(false); setCreateFullscreen(false); setExplorePresetsOpen(true); setExplorePresetsSidebar("all"); setExploreCategoryTab("discount"); setExplorePresetsSearch(""); }}
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer shrink-0"
                        style={{ fontWeight: 600 }}
                      >
                        See all <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      {suggestedTemplates.map((tpl) => {
                        const isDis = tpl.category === "discount";
                        const tplPill = isDis
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
                              <span className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0" style={{ borderColor: tplPill.border }}>
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px]"
                                  style={{ fontWeight: 600, color: tplPill.text, backgroundColor: tplPill.bg }}
                                >
                                  {isDis ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                  {isDis ? "Discount" : "Premium"}
                                </span>
                                <span className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l" style={{ fontWeight: 500, borderColor: tplPill.border }}>
                                  {tpl.basis === "volume" ? "Volume" : "Value"}
                                </span>
                              </span>
                              {tpl.tierType === "multiple" && (
                                <span className="inline-flex items-center px-1.5 py-[2px] rounded-full border border-[#E8ECF1] bg-slate-50 text-slate-500 text-[10px]" style={{ fontWeight: 500 }}>
                                  {tpl.totalTiers}-tier
                                </span>
                              )}
                            </div>
                            <p className="text-[11.5px] text-foreground line-clamp-1 group-hover:text-primary transition-colors" style={{ fontWeight: 600 }}>
                              {tpl.name}
                            </p>
                            <p className="text-[10.5px] text-slate-400 mt-0.5 line-clamp-2 leading-snug">
                              {tpl.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pricing Rule Type — Clean gradient cards (CreatePartnerModal style) */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Pricing Rule Type</span>
                      <Tooltip><TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger><TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[12300]"><p className="text-slate-500">Discount lowers prices, Premium adds markup. Hover each card for details.</p></TooltipContent></Tooltip>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Discount card — green accents */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                      <div
                        onClick={() => setCreateCategory("discount")}
                        className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
                          createCategory === "discount"
                            ? "border-[#86EFAC]/70 bg-white shadow-[0_1px_4px_rgba(4,120,87,0.06)]"
                            : "border-border bg-white hover:border-[#BBF7D0] hover:shadow-[0_4px_16px_-4px_rgba(4,120,87,0.10)]"
                        }`}
                      >
                        <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
                          createCategory === "discount"
                            ? "bg-gradient-to-br from-green-50/50 to-transparent"
                            : "bg-gradient-to-br from-green-50/0 to-green-50/0 group-hover:from-green-50/60 group-hover:to-transparent"
                        }`} />
                        <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                          <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                            createCategory === "discount"
                              ? "bg-gradient-to-br from-[#DCFCE7] to-[#BBF7D0] text-[#15803D]"
                              : "bg-gradient-to-br from-green-50 to-[#DCFCE7] text-green-600 group-hover:scale-105"
                          }`}>
                            <TrendingDown className="w-[18px] h-[18px]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] transition-colors duration-150 ${
                              createCategory === "discount" ? "text-[#166534]" : "text-foreground group-hover:text-slate-800"
                            }`} style={{ fontWeight: 600 }}>Discount</p>
                            <p className={`text-[11px] mt-0.5 truncate transition-colors duration-150 ${
                              createCategory === "discount" ? "text-[#22C55E]" : "text-slate-400"
                            }`}>Lower price adjustment</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                            createCategory === "discount"
                              ? ""
                              : "border-[1.5px] border-[#D1D5DB] bg-white group-hover:border-[#86EFAC]"
                          }`} style={createCategory === "discount" ? { backgroundColor: "#16A34A", boxShadow: "0 0 0 2px rgba(22,163,74,0.15)" } : {}}>
                            {createCategory === "discount" && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                          </div>
                        </div>
                      </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[12300]">
                          <p className="text-slate-500">Reduce unit price when quantity or value thresholds are met.</p>
                          <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                            <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>EXAMPLE</p>
                            <p className="text-[11px] text-slate-700 mt-1"><span className="text-green-600" style={{ fontWeight: 600 }}>10% off</span> on orders over 500 units.</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>

                      {/* Premium card — purple accents */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                      <div
                        onClick={() => setCreateCategory("premium")}
                        className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
                          createCategory === "premium"
                            ? "border-[#C4B5FD]/70 bg-white shadow-[0_1px_4px_rgba(124,58,237,0.06)]"
                            : "border-border bg-white hover:border-[#DDD6FE] hover:shadow-[0_4px_16px_-4px_rgba(124,58,237,0.10)]"
                        }`}
                      >
                        <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
                          createCategory === "premium"
                            ? "bg-gradient-to-br from-violet-50/50 to-transparent"
                            : "bg-gradient-to-br from-violet-50/0 to-violet-50/0 group-hover:from-violet-50/60 group-hover:to-transparent"
                        }`} />
                        <div className="relative flex items-center gap-3 pl-3.5 pr-3 py-3">
                          <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${
                            createCategory === "premium"
                              ? "bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] text-violet"
                              : "bg-gradient-to-br from-violet-50 to-[#EDE9FE] text-violet-500 group-hover:scale-105"
                          }`}>
                            <TrendingUp className="w-[18px] h-[18px]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] transition-colors duration-150 ${
                              createCategory === "premium" ? "text-[#5B21B6]" : "text-foreground group-hover:text-slate-800"
                            }`} style={{ fontWeight: 600 }}>Premium</p>
                            <p className={`text-[11px] mt-0.5 truncate transition-colors duration-150 ${
                              createCategory === "premium" ? "text-violet-500" : "text-slate-400"
                            }`}>Higher price adjustment</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                            createCategory === "premium"
                              ? ""
                              : "border-[1.5px] border-[#D1D5DB] bg-white group-hover:border-[#C4B5FD]"
                          }`} style={createCategory === "premium" ? { backgroundColor: "#8B5CF6", boxShadow: "0 0 0 2px rgba(139,92,246,0.15)" } : {}}>
                            {createCategory === "premium" && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                          </div>
                        </div>
                      </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[12300]">
                          <p className="text-slate-500">Markup on base price for express or value-added services.</p>
                          <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                            <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>EXAMPLE</p>
                            <p className="text-[11px] text-slate-700 mt-1"><span className="text-violet" style={{ fontWeight: 600 }}>15% markup</span> for expedited and priority shipping.</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                  </div>

                  {/* Pricing Rule Details */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Pricing Rule Details</span>
                      <Tooltip><TooltipTrigger asChild><span><Info className="w-3.5 h-3.5 text-slate-300 cursor-help" /></span></TooltipTrigger><TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[12300]"><p className="text-slate-500">Name and basis shown on POs and invoices.</p><div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted"><p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>TIP</p><p className="text-[11px] text-slate-700 mt-1">Use a descriptive name like &ldquo;Q4 Volume Discount&rdquo; so partners can identify it on their orders.</p></div></TooltipContent></Tooltip>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-4">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {/* Row 1: Name + Calculation Basis */}
                        <div>
                          <label className="text-[12px] text-foreground mb-1.5 block" style={{ fontWeight: 500 }}>{createCategory === "discount" ? "Discount" : "Premium"} Name</label>
                          <Input
                            value={createName}
                            onChange={(e) => setCreateName(e.target.value)}
                            placeholder={`e.g. ${createCategory === "discount" ? "Volume Discount for Q4" : "Premium Markup for VIP"}`}
                            className="h-9 rounded-lg border-border bg-white text-[13px] text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1 mb-1.5">
                            <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Calculation Basis</label>
                            <Tooltip>
                              <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                              <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[12300]">
                                <p className="text-slate-500">Measure thresholds by units ordered or order value.</p>
                                <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                                  <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>EXAMPLE</p>
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
                                  if (createBasis !== b) {
                                    setCreateBasis(b);
                                    // Clear tier thresholds when switching basis — old quantity values
                                    // shouldn't linger as dollar amounts and vice versa.
                                    setCreateTiers(prev => prev.map(t => ({ ...t, minQty: "", maxQty: "" })));
                                  }
                                }}
                                className={`inline-flex items-center gap-1.5 flex-1 justify-center h-9 rounded-lg border text-[12px] transition-all cursor-pointer ${
                                  createBasis === b
                                    ? createCategory === "discount" ? "border-green-600/30 bg-green-50 text-[#15803D]" : "border-violet/30 bg-violet-50 text-[#6D28D9]"
                                    : "border-border bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                                }`}
                                style={{ fontWeight: createBasis === b ? 600 : 500 }}
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
                            value={createDescription}
                            onChange={setCreateDescription}
                            placeholder="Brief summary of pricing rule purpose or context."
                          />
                        </div>
                      </div>

                      {/* Validity Period — inline toggle that
                          expands within the card. Same "Optional"
                          chip as the canonical creation form. */}
                      <div className="mt-3">
                        <div className="flex items-center gap-2.5">
                          <Switch checked={createLimitDate} onCheckedChange={setCreateLimitDate} />
                          <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>Set Validity Period</span>
                          <span className="text-[11px] text-slate-400 bg-muted px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>Optional</span>
                          <Tooltip>
                            <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[12300]">
                              <p className="text-slate-500">Set a date range. If off, rule applies indefinitely.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        {createLimitDate && (
                          <div className="grid grid-cols-2 gap-4 mt-3">
                            <div>
                              <div className="flex items-center gap-1 mb-1.5">
                                <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Valid From</label>
                                <Tooltip>
                                  <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                                  <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[12300]">
                                    <p className="text-slate-500">Rule starts applying from this date.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <Input
                                type="date"
                                value={createValidFrom}
                                onChange={(e) => setCreateValidFrom(e.target.value)}
                                className="h-9 rounded-lg border-border bg-white text-[13px] text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20"
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-1 mb-1.5">
                                <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Valid To</label>
                                <Tooltip>
                                  <TooltipTrigger asChild><span><Info className="w-3 h-3 text-slate-300 cursor-help" /></span></TooltipTrigger>
                                  <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[11px] leading-[1.5] z-[12300]">
                                    <p className="text-slate-500">Rule auto-deactivates after this date.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <Input
                                type="date"
                                value={createValidTo}
                                onChange={(e) => setCreateValidTo(e.target.value)}
                                className="h-9 rounded-lg border-border bg-white text-[13px] text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tiers — multiple, with add/remove */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>{createCategory === "discount" ? "Discount" : "Premium"} Tiers</span>
                        <span className="text-[11px] text-slate-400 bg-muted px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>{createTiers.length}</span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {createTiers.map((tier, idx) => {
                        const isDis = createCategory === "discount";
                        const accent = isDis ? "#16A34A" : "var(--violet)";
                        const accentBg = isDis ? "#F0FDF4" : "#F5F3FF";
                        const accentBorder = isDis ? "#BBF7D0" : "#DDD6FE";
                        return (
                        <div key={idx} className="rounded-xl border bg-white overflow-hidden transition-all" style={{ borderColor: tier.qtyLimits ? accentBorder : "var(--border)" }}>
                          {/* Header */}
                          <div className="flex items-center justify-between px-3.5 py-2 border-b border-muted" style={{ backgroundColor: accentBg }}>
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] text-white" style={{ fontWeight: 700, backgroundColor: accent }}>{idx + 1}</span>
                              <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Tier {idx + 1}</span>
                            </div>
                            {idx > 0 && (
                              <button
                                onClick={() => removeTier(idx)}
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
                                    {isDis ? "Discount" : "Premium"} {tier.fixRate ? "Amount (USD)" : "Rate"}
                                  </label>
                                  <PctAmountToggle
                                    isFixed={tier.fixRate}
                                    onChange={(fixed) => updateTier(idx, { fixRate: fixed })}
                                    percentTooltip={`${isDis ? "Discount" : "Premium"} applied as a percentage of the line value.`}
                                    amountTooltip={`${isDis ? "Discount" : "Premium"} applied as a fixed amount in USD, the currency the rule book is written in.`}
                                  />
                                </div>
                                <div className="relative">
                                  {tier.fixRate && (
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">$</span>
                                  )}
                                  <Input
                                    value={tier.discount}
                                    onChange={(e) => updateTier(idx, { discount: e.target.value })}
                                    placeholder={tier.fixRate ? "e.g. 25.00" : "e.g. 50"}
                                    className={`rounded-lg border-border bg-white text-[13px] h-9 text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 ${tier.fixRate ? "pl-7 pr-3" : "pr-8"}`}
                                  />
                                  {!tier.fixRate && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">%</span>
                                  )}
                                </div>
                              </div>

                              {/* Quantity limits toggle */}
                              <div className="flex items-end h-full pb-[7px]">
                                <label
                                  className="flex items-center gap-2 cursor-pointer select-none"
                                  onClick={() => updateTier(idx, { qtyLimits: !tier.qtyLimits })}
                                >
                                  <div className={`w-[16px] h-[16px] rounded-[4px] flex items-center justify-center shrink-0 transition-colors ${tier.qtyLimits ? "bg-primary" : "border-[1.5px] border-slate-300 bg-white hover:border-slate-400"}`}>
                                    {tier.qtyLimits && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                                  </div>
                                  <span className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>{createBasis === "volume" ? "Order Qty Limits" : "Order Value Limits"}</span>
                                  <span onClick={(e) => e.stopPropagation()}>
                                    <InfoTooltip>{createBasis === "volume"
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
                                    <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{createBasis === "volume" ? "Min Qty" : "Min Order Value (USD)"}</label>
                                    <InfoTooltip>{createBasis === "volume"
                                      ? "The smallest order quantity at which this tier starts to apply. Orders below this value fall into a lower tier or get no adjustment."
                                      : "The smallest order value (in USD) at which this tier starts to apply. Orders below this value fall into a lower tier or get no adjustment."}</InfoTooltip>
                                  </div>
                                  <div className="relative">
                                    {createBasis === "value" && (
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">$</span>
                                    )}
                                    <Input
                                      value={tier.minQty}
                                      onChange={(e) => updateTier(idx, { minQty: e.target.value })}
                                      placeholder={createBasis === "volume" ? "e.g. 100" : "e.g. 1,000"}
                                      className={`rounded-lg border-border bg-white text-[13px] h-9 text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 ${createBasis === "value" ? "pl-7" : ""}`}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center gap-1 mb-1.5">
                                    <label className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{createBasis === "volume" ? "Max Qty" : "Max Order Value (USD)"}</label>
                                    <InfoTooltip>{createBasis === "volume"
                                      ? "The largest order quantity this tier covers. Orders above this value roll into the next tier or stop receiving this adjustment."
                                      : "The largest order value (in USD) this tier covers. Orders above this value roll into the next tier or stop receiving this adjustment."}</InfoTooltip>
                                  </div>
                                  <div className="relative">
                                    {createBasis === "value" && (
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">$</span>
                                    )}
                                    <Input
                                      value={tier.maxQty}
                                      onChange={(e) => updateTier(idx, { maxQty: e.target.value })}
                                      placeholder={createBasis === "volume" ? "e.g. 500" : "e.g. 5,000"}
                                      className={`rounded-lg border-border bg-white text-[13px] h-9 text-foreground placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 ${createBasis === "value" ? "pl-7" : ""}`}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={addTier}
                      className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg border border-dashed text-[12px] transition-all cursor-pointer w-full justify-center ${createCategory === "discount" ? "border-[#BBF7D0] text-green-600 hover:bg-green-50 hover:border-[#86EFAC]" : "border-[#DDD6FE] text-violet hover:bg-violet-50 hover:border-[#C4B5FD]"}`}
                      style={{ fontWeight: 600 }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Tier
                    </button>
                  </div>
                </div>
                );
              })()}

              {/* ─── Step 2: Items, Categories & Attachments ─── */}
              {createStep === 2 && (
                <div className="space-y-5">
                  {/* Summary banner */}
                  <div className="rounded-xl border border-border bg-white p-3.5 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${createCategory === "discount" ? "bg-gradient-to-br from-[#DCFCE7] to-[#BBF7D0]" : "bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE]"}`}>
                      {createCategory === "discount" ? <TrendingDown className="w-4.5 h-4.5 text-[#15803D]" /> : <TrendingUp className="w-4.5 h-4.5 text-violet" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-slate-700 truncate" style={{ fontWeight: 600 }}>{createName || "Untitled Rule"}</p>
                      <p className="text-[11px] text-slate-500 truncate">{createCategory === "discount" ? "Discount" : "Premium"} · {createBasis === "volume" ? "Volume-Based" : "Value-Based"} · {createTiers.length} tier{createTiers.length !== 1 ? "s" : ""}{createTiers[0]?.discount ? ` · ${createTiers[0].discount}${createTiers[0].fixRate ? "$" : "%"}` : ""}</p>
                    </div>
                    <button
                      onClick={() => setCreateStep(1)}
                      className="text-[11px] text-primary hover:text-[#0862D0] transition-colors cursor-pointer shrink-0"
                      style={{ fontWeight: 600 }}
                    >
                      Edit Setup
                    </button>
                  </div>

                  {/* Items, Categories, Partners & Attachments card */}
                  <div className="rounded-xl border border-border bg-white overflow-hidden">
                    <div className="flex items-center gap-0 border-b border-border px-4">
                      {([
                        { key: "items" as const, label: "Items" },
                        { key: "categories" as const, label: "Categories" },
                        { key: "attachments" as const, label: "Attachments" },
                      ]).map((t) => (
                        <button
                          key={t.key}
                          onClick={() => setCreateItemsTab(t.key)}
                          className={`relative px-3 py-2.5 text-[12px] flex items-center transition-colors cursor-pointer ${createItemsTab === t.key ? "text-primary" : "text-slate-500 hover:text-slate-700"}`}
                          style={{ fontWeight: createItemsTab === t.key ? 600 : 500 }}
                        >
                          {t.label}
                          {createItemsTab === t.key && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-primary" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Tab content — Items */}
                    {createItemsTab === "items" && (
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input placeholder="Search items to assign..." className="pl-9 rounded-lg border-border bg-slate-50 text-[13px] h-9" />
                          </div>
                          <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[12px] shadow-sm transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                            <Plus className="w-3.5 h-3.5" /> Add Items
                          </button>
                        </div>
                        <div className="py-8 text-center">
                          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                            <Package className="w-5.5 h-5.5 text-slate-400" />
                          </div>
                          <p className="text-[13px] text-slate-700 mb-1" style={{ fontWeight: 600 }}>No items assigned yet</p>
                          <p className="text-[11px] text-slate-400 max-w-[260px] mx-auto">Search and add items that should be affected by this pricing rule.</p>
                        </div>
                      </div>
                    )}

                    {/* Tab content — Categories */}
                    {createItemsTab === "categories" && (
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input placeholder="Search categories to assign..." className="pl-9 rounded-lg border-border bg-slate-50 text-[13px] h-9" />
                          </div>
                          <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary hover:bg-[#0862D0] text-white text-[12px] shadow-sm transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                            <Plus className="w-3.5 h-3.5" /> Add Categories
                          </button>
                        </div>
                        <div className="py-8 text-center">
                          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                            <FolderOpen className="w-5.5 h-5.5 text-slate-400" />
                          </div>
                          <p className="text-[13px] text-slate-700 mb-1" style={{ fontWeight: 600 }}>No categories assigned yet</p>
                          <p className="text-[11px] text-slate-400 max-w-[260px] mx-auto">Assign categories to apply this pricing rule to all items within them.</p>
                        </div>
                      </div>
                    )}

                    {/* Tab content — Attachments */}
                    {createItemsTab === "attachments" && (
                      <div className="p-4">
                        <div className="py-8 text-center">
                          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-[#E8ECF1] border-dashed flex items-center justify-center mx-auto mb-3">
                            <Upload className="w-5.5 h-5.5 text-slate-400" />
                          </div>
                          <p className="text-[13px] text-slate-700 mb-1" style={{ fontWeight: 600 }}>No attachments yet</p>
                          <p className="text-[11px] text-slate-400 max-w-[280px] mx-auto mb-3">Upload supporting documents, contracts, or approval files for this pricing rule.</p>
                          <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-white text-[12px] text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
                            <Upload className="w-3.5 h-3.5" /> Upload Files
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer — step-aware */}
          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5 sm:rounded-b-2xl">
            {createStep === 1 ? (
              <>
                <button
                  onClick={() => { setCreateModalOpen(false); resetCreateForm(); setCreateFullscreen(false); }}
                  className="px-3 sm:px-5 py-2 rounded-lg border border-border text-xs sm:text-[13px] text-slate-500 hover:text-foreground hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => { if (createName.trim()) setCreateStep(2); }}
                  disabled={!createName.trim()}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-5 py-2 rounded-lg bg-primary text-white text-xs sm:text-[13px] hover:bg-[#0862D0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  Continue
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setCreateStep(1)}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] text-slate-500 hover:text-foreground transition-colors mr-auto cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Back</span>
                </button>
                <button
                  onClick={() => { setCreateModalOpen(false); resetCreateForm(); setCreateFullscreen(false); }}
                  className="px-3 sm:px-5 py-2 rounded-lg border border-border text-xs sm:text-[13px] text-slate-500 hover:text-foreground hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  Discard
                </button>
                <button
                  onClick={handleSaveRule}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-5 py-2 rounded-lg bg-primary text-white text-xs sm:text-[13px] hover:bg-[#0862D0] transition-colors shadow-sm cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Save & Create</span>
                  <span className="sm:hidden">Create</span>
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Explore Presets Modal ───
            Mirrors the canonical creation-form "Pricing Rule
            Presets" modal byte-for-byte: 12px tall header strip,
            sticky toolbar with search + type-toggle + count
            badge + sort popover + Create New, FilterPills row,
            kickstart banner, @container card grid. Same frame on
            every surface so the Browse Templates experience is
            visually identical across partner creation, partner
            group creation, and the partner detail page. */}
      <Dialog open={explorePresetsOpen} onOpenChange={(v) => { if (!v) { setExplorePresetsOpen(false); setExplorePresetsFullscreen(false); } }}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden !z-[12201] border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)] flex flex-col"
          overlayClassName="!z-[12200]"
          /* Forced viewport centering — see Deactivate confirm note. */
          style={explorePresetsFullscreen
            ? {
                position: "fixed",
            top: "50%",
            left: "50%",
            right: "auto",
            bottom: "auto",
            transform: "translate(-50%, -50%)",
            translate: "none",
            margin: 0,
                width: "calc(100% - 1rem)",
                height: "calc(100dvh - 1rem)",
                maxWidth: "calc(100% - 1rem)",
                maxHeight: "calc(100dvh - 1rem)",
                borderRadius: 16,
              }
            : {
                position: "fixed",
            top: "50%",
            left: "50%",
            right: "auto",
            bottom: "auto",
            transform: "translate(-50%, -50%)",
            translate: "none",
            margin: 0,
                width: "min(75vw, 1080px)",
                maxWidth: "calc(100% - 2rem)",
                height: "min(88vh, 1080px)",
                maxHeight: "calc(100vh - 2rem)",
                minHeight: 640,
                borderRadius: 16,
              }
          }
          hideCloseButton
        >
          <DialogTitle className="sr-only">Pricing rule presets library</DialogTitle>
          <DialogDescription className="sr-only">Browse and select pricing rule presets to apply to this partner.</DialogDescription>

          {/* Header — 12px strip, identical to canonical */}
          <div className="flex items-center justify-between px-6 h-12 border-b border-[#EEF2F6] bg-card shrink-0">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Pricing Rule Presets</h3>
                <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Browse and apply pricing rules to this partner</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExplorePresetsFullscreen(f => !f)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all"
                style={{ fontWeight: 500 }}
              >
                {explorePresetsFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {explorePresetsFullscreen ? "Exit full" : "Full view"}
              </button>
              <button onClick={() => { setExplorePresetsOpen(false); setExplorePresetsFullscreen(false); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-muted transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">
              {/* Sticky toolbar */}
              <div className="shrink-0 bg-white border-b border-[#EEF2F6] px-5 pt-4 pb-3 space-y-3">
                {/* Search + type toggle + sort row */}
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={explorePresetsSearch}
                      onChange={(e) => setExplorePresetsSearch(e.target.value)}
                      placeholder="Search pricing rules..."
                      className="pl-9 pr-8 rounded-lg border-[#D0D7E1] h-9 bg-white text-[13px] w-[220px] placeholder:text-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus:border-primary focus:shadow-[0_0_0_3px_rgba(10,119,255,0.08)]"
                    />
                    {explorePresetsSearch && (
                      <button onClick={() => setExplorePresetsSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-foreground transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Type toggle — same hover tooltips as the
                      canonical creation-form Browse Templates modal. */}
                  <div className="inline-flex items-center rounded-lg bg-slate-50 border border-border/60 p-0.5 shrink-0">
                    {([
                      { key: "discount", label: "Discounts", color: "#047857", bg: "#ECFDF5", icon: TrendingDown, tip: "Reduce unit price when quantity or value thresholds are met.", example: <><span className="text-green-600" style={{ fontWeight: 600 }}>10% off</span> on orders over 500 units.</> },
                      { key: "premium", label: "Premiums", color: "var(--violet)", bg: "#F5F3FF", icon: TrendingUp, tip: "Markup on base price for express or value-added services.", example: <><span className="text-violet" style={{ fontWeight: 600 }}>15% markup</span> for expedited and priority shipping.</> },
                    ] as const).map((cat) => {
                      const active = exploreCategoryTab === cat.key;
                      const count = exploreCards.filter((c) => c.category === cat.key).length;
                      return (
                        <Tooltip key={cat.key}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setExploreCategoryTab(cat.key)}
                              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[12px] transition-all cursor-pointer ${
                                active ? "shadow-sm" : "hover:bg-white/60"
                              }`}
                              style={{ fontWeight: active ? 600 : 500, color: active ? cat.color : "#334155", backgroundColor: active ? cat.bg : undefined }}
                            >
                              <cat.icon className="w-3.5 h-3.5" />
                              {cat.label}
                              <span
                                className="text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center"
                                style={{ fontWeight: 600, color: active ? cat.color: "var(--muted-foreground)", backgroundColor: active ? `${cat.color}15` : "var(--border)" }}
                              >
                                {count}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[12300]">
                            <p className="text-slate-500">{cat.tip}</p>
                            <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                              <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>EXAMPLE</p>
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
                      {(() => {
                        let c = exploreCards.filter(card => card.category === exploreCategoryTab);
                        if (explorePresetsSidebar === "preset") c = c.filter(card => card.isPreset);
                        else if (explorePresetsSidebar === "custom") c = c.filter(card => !card.isPreset);
                        else if (explorePresetsSidebar === "created_by_me") c = c.filter(card => !card.isPreset && card.createdBy === "Ahtisham Ahmad");
                        else if (explorePresetsSidebar === "vendors_applied") c = c.filter(card => card.partnerCount >= 3);
                        if (explorePresetsSearch.trim()) {
                          const q = explorePresetsSearch.toLowerCase();
                          c = c.filter(card => card.name.toLowerCase().includes(q) || card.description.toLowerCase().includes(q) || card.ruleNo.toLowerCase().includes(q) || card.createdBy.toLowerCase().includes(q));
                        }
                        return c.length;
                      })()}
                    </span>
                    <Popover open={exploreSortOpen} onOpenChange={setExploreSortOpen}>
                      <PopoverTrigger asChild>
                        <button className={`inline-flex items-center gap-1 text-[12px] transition-colors px-2 py-1 rounded-md border ${exploreSortOpen ? "text-primary bg-blue-50 border-blue-100" : "text-slate-500 hover:text-foreground hover:bg-slate-50 border-transparent hover:border-border"}`} style={{ fontWeight: 500 }}>
                          <ArrowUpDown className="w-3 h-3" />
                          {exploreSortBy === "name" ? "Name" : exploreSortBy === "vendorsApplied" ? "In Use" : exploreSortBy === "category" ? "Type" : "Basis"}
                          {exploreSortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-[200px] p-1.5 rounded-lg z-[12250]" sideOffset={6}>
                        <div className="space-y-0.5">
                          {([
                            { key: "name", label: "Name", icon: <ArrowUpDown className="w-3.5 h-3.5" /> },
                            { key: "vendorsApplied", label: "In Use", icon: <Building2 className="w-3.5 h-3.5" /> },
                            { key: "category", label: "Type", icon: <Tag className="w-3.5 h-3.5" /> },
                            { key: "basis", label: "Basis", icon: <ChartColumn className="w-3.5 h-3.5" /> },
                          ] as const).map((opt) => {
                            const isActive = exploreSortBy === opt.key;
                            return (
                              <button
                                key={opt.key}
                                onClick={() => {
                                  if (isActive) {
                                    setExploreSortDir((d) => d === "asc" ? "desc" : "asc");
                                  } else {
                                    setExploreSortBy(opt.key);
                                    setExploreSortDir("asc");
                                  }
                                  setExploreSortOpen(false);
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
                                  exploreSortDir === "asc"
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
                      /* Disabled inside Browse Templates: new rule
                         templates are authored in Partner Management.
                         The Pricing Rules tab here only lets the user
                         apply / duplicate / deactivate existing rules. */
                      onClick={() => {
                        toast.info("New pricing rule templates are created in the Partner Management module.");
                      }}
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
                      const base = exploreCards.filter((c) => c.category === exploreCategoryTab);
                      return [
                        { key: "all", label: "All", count: base.length, showCount: true },
                        { key: "preset", label: "Template", count: base.filter((c) => c.isPreset).length, showCount: true },
                        { key: "custom", label: "Custom", count: base.filter((c) => !c.isPreset).length, showCount: true },
                        { key: "created_by_me", label: "Created by Me", count: base.filter((c) => !c.isPreset && c.createdBy === "Ahtisham Ahmad").length, showCount: true },
                        { key: "vendors_applied", label: "In Use", count: base.filter((c) => c.partnerCount >= 3).length, showCount: true },
                      ];
                    })()}
                    activeKey={explorePresetsSidebar}
                    onSelect={(k) => setExplorePresetsSidebar(k)}
                  />
                </div>
              </div>

              {/* Cards area — same kickstart banner + @container
                  grid as the canonical creation-form modal. */}
              <div className="flex-1 min-h-0 overflow-y-auto p-5">
                <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/60 px-3.5 py-2.5 flex items-start gap-2.5">
                  <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <p className="text-[11.5px] text-slate-600 leading-relaxed">
                    <span className="text-foreground" style={{ fontWeight: 600 }}>Templates are a kickstart.</span> Use them as-is or as a baseline — you can always create a new pricing rule tailored to your business needs from <span style={{ fontWeight: 600 }}>Create New</span> above.
                  </p>
                </div>
                {(() => {
                  let cards = exploreCards;
                  cards = cards.filter(c => c.category === exploreCategoryTab);
                  if (explorePresetsSidebar === "preset") cards = cards.filter(c => c.isPreset);
                  else if (explorePresetsSidebar === "custom") cards = cards.filter(c => !c.isPreset);
                  else if (explorePresetsSidebar === "created_by_me") cards = cards.filter(c => !c.isPreset && c.createdBy === "Ahtisham Ahmad");
                  else if (explorePresetsSidebar === "vendors_applied") cards = cards.filter(c => c.partnerCount >= 3);

                  if (explorePresetsSearch.trim()) {
                    const q = explorePresetsSearch.toLowerCase();
                    cards = cards.filter(c =>
                      c.name.toLowerCase().includes(q) ||
                      c.category.toLowerCase().includes(q) ||
                      c.basis.toLowerCase().includes(q) ||
                      c.description.toLowerCase().includes(q) ||
                      c.ruleNo.toLowerCase().includes(q) ||
                      c.createdBy.toLowerCase().includes(q)
                    );
                  }

                  // Sort — same option keys / asc-desc semantics as
                  // the canonical creation-form Browse Templates modal.
                  const sorted = [...cards].sort((a, b) => {
                    let cmp = 0;
                    if (exploreSortBy === "name") cmp = a.name.localeCompare(b.name);
                    else if (exploreSortBy === "vendorsApplied") cmp = a.partnerCount - b.partnerCount;
                    else if (exploreSortBy === "category") cmp = a.category.localeCompare(b.category);
                    else if (exploreSortBy === "basis") cmp = a.basis.localeCompare(b.basis);
                    return exploreSortDir === "asc" ? cmp : -cmp;
                  });

                  if (sorted.length === 0) {
                    return (
                      <div className="py-20 text-center">
                        <div className="w-12 h-12 rounded-lg bg-muted border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                          <Search className="w-5 h-5 text-slate-400" />
                        </div>
                        <p className="text-[13px] text-muted-foreground" style={{ fontWeight: 600 }}>No pricing rules found</p>
                        <p className="text-[12px] text-slate-400 mt-1">Try adjusting your search or filter</p>
                      </div>
                    );
                  }

                  return (
                    <div className="@container/prgrid">
                      <div className="grid grid-cols-1 @[400px]/prgrid:grid-cols-2 @[750px]/prgrid:grid-cols-3 auto-rows-fr gap-4">
                        {sorted.map((card) => (
                          <PricingRuleCard
                            key={card.id}
                            rule={card}
                            variant="browse"
                            partnerName={vendor.companyName}
                            readOnly={readOnly}
                            onClick={() => { setSelectedRule(card); setDetailMode("create"); setDetailOpen(true); }}
                            onApply={() => {
                              setAppliedRuleIds((prev) => new Set(prev).add(card.id));
                              setExplorePresetsOpen(false);
                              setExplorePresetsFullscreen(false);
                              /* Fire both onApply callbacks so the host
                                 (SO/Quote PricingRulesManageModal) gets
                                 the rule into its `rules` list. */
                              onApplyExternal?.(card);
                              toast.success(`"${card.name}" applied to this customer.`);
                            }}
                            onDuplicate={() => {
                              resetCreateForm();
                              setCreateName(`${card.name} (Copy)`);
                              setCreateDescription(card.description);
                              setCreateCategory(card.category);
                              setCreateBasis(card.basis);
                              setCreateTiers(card.tiers.map((t) => ({ discount: t.discount, fixRate: false, qtyLimits: true, minQty: t.minQty, maxQty: t.maxQty })));
                              setExplorePresetsOpen(false);
                              setExplorePresetsFullscreen(false);
                              setCreateModalOpen(true);
                              toast.info(`Duplicated "${card.name}" — rename and customize as needed.`);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
      </div>
    </div>,
    document.body,
  );
}
